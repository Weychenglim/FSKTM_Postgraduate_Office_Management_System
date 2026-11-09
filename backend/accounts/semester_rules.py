"""How far along a student is, against their programme's minimum and maximum.

The minimum counts semesters actually studied. The maximum is a fixed semester
counted from the intake in normal semesters, as the office's own letters do it:
personal leave does not move it, medical or mobility leave and an extension do.
"""
from dataclasses import dataclass

from django.db import transaction

from .models import ProgrammeRule, Student, StudentCompletion, StudentRegistry, StudentSemester, StudentSemesterMove
from .registry_programmes import programme_key
from .semesters import Semester, from_parts, nth_normal, read, seeded_semesters

STUDIED = StudentSemester.Outcome.STUDIED
LEAVE = StudentSemester.Outcome.LEAVE
NOT_REGISTERED = StudentSemester.Outcome.NOT_REGISTERED
EXEMPT_LEAVE = (StudentSemester.Outcome.LEAVE_MEDICAL, StudentSemester.Outcome.LEAVE_MOBILITY)
LEAVE_OUTCOMES = (LEAVE, *EXEMPT_LEAVE)
WAITING_FOR_SENATE = "Waiting for Senate"
NOT_STARTED = "Not started"


def _rule_start(rule):
    start = from_parts(rule.from_session, rule.from_term)
    return start.key if start else (0, 0)


def rules_by_programme():
    """Each programme's rules, earliest first."""
    rules = {}
    for rule in ProgrammeRule.objects.all():
        rules.setdefault(programme_key(rule.programme), []).append(rule)
    for group in rules.values():
        group.sort(key=_rule_start)
    return rules


def rule_for(programme, rules=None, intake=None):
    """The rule for a student on this intake: the latest one that had started by
    then. A student whose intake is unknown follows the newest rule."""
    group = (rules_by_programme() if rules is None else rules).get(programme_key(programme), [])
    if not group:
        return None
    if intake is None:
        return group[-1]
    chosen = group[0]
    for rule in group:
        if _rule_start(rule) <= intake.key:
            chosen = rule
    return chosen


def start_of(student, rows):
    """The semester a student began: their intake, or their first semester on record."""
    start = read(student.intake_semester)
    if start is None and rows:
        start = from_parts(rows[0].session, rows[0].term)
    return start


def intake_label(text):
    """An intake in the portal's own wording, or as written when it cannot be read."""
    intake = read(text)
    return intake.label if intake else (text or "")


def active_semester():
    from academics.services import current_effective_semester

    portal = current_effective_semester()
    return from_parts(portal.academic_session, portal.term) if portal else None


def starts_later(student, semester):
    """Whether a student's intake comes after this semester, so they have not started by then."""
    intake = read(student.intake_semester)
    return bool(intake and semester and intake.key > semester.key)


def _registry(student):
    return StudentRegistry.objects.filter(student_id=student.pk).first()


def completion_of(student):
    try:
        return student.completion
    except StudentCompletion.DoesNotExist:
        return None


def is_waiting(student):
    completion = completion_of(student)
    return bool(completion and completion.senate_decision_id is None and student.status == Student.Status.ACTIVE)


def shown_status(student, active=...):
    """The one status the office and the student see."""
    if student.status != Student.Status.ACTIVE:
        return student.get_status_display()
    if is_waiting(student):
        return WAITING_FOR_SENATE
    return NOT_STARTED if starts_later(student, active_semester() if active is ... else active) else Student.Status.ACTIVE.label


def enrolment_problem(student):
    """Why an Active student is not enrolled right now, in words for the student, or None."""
    active = active_semester()
    if active is None:
        return None
    if starts_later(student, active):
        return "Your studies have not started yet. Contact the PG Office if you need a letter."
    row = student.semesters.filter(session=active.session, term=active.term).first()
    if row is not None and row.outcome == NOT_REGISTERED:
        return "You are not registered for this semester. Contact the PG Office if you need a letter."
    return None


def rows_of(student):
    return sorted(
        student.semesters.all(),
        key=lambda row: from_parts(row.session, row.term).key if from_parts(row.session, row.term) else (0, 0),
    )


@dataclass
class Progress:
    rule: ProgrammeRule | None
    rows: list
    studied: int
    extension: int
    extension_reason: str
    current: Semester | None
    maximum_semester: Semester | None
    intake: Semester | None = None

    @property
    def _semesters(self):
        return [semester for semester in (from_parts(row.session, row.term) for row in self.rows) if semester]

    @property
    def before_intake(self):
        """Semesters on the record from before the intake, which should not be counted."""
        return [s for s in self._semesters if self.intake and s.key < self.intake.key]

    @property
    def starts_after_intake(self):
        """Whether the record begins later than the intake, so semesters may be missing."""
        semesters = self._semesters
        return bool(self.intake and semesters and semesters[0].key > self.intake.key)

    @property
    def has_record(self):
        return bool(self.rows)

    @property
    def minimum(self):
        return self.rule.min_semesters if self.rule else None

    @property
    def maximum(self):
        return self.rule.max_semesters if self.rule else None

    @property
    def short_of_minimum(self):
        return max(self.minimum - self.studied, 0) if self.rule else 0

    @property
    def past_maximum(self):
        return bool(self.current and self.maximum_semester and self.current.key > self.maximum_semester.key)

    @property
    def last_semester(self):
        return bool(self.current and self.maximum_semester and self.current.key == self.maximum_semester.key)


def progress_of(student, rules=None, rows=None, registry=...):
    rows = rows_of(student) if rows is None else rows
    start = start_of(student, rows)
    rule = rule_for(student.programme, rules, start)
    registry = _registry(student) if registry is ... else registry
    studied = 0
    exempt = 0
    current = None
    for row in rows:
        semester = from_parts(row.session, row.term)
        if semester is None:
            continue
        current = semester
        if row.outcome == STUDIED and (not semester.is_special or rule is None or rule.special_counts):
            studied += 1
        if row.outcome in EXEMPT_LEAVE and not semester.is_special:
            exempt += 1
    extension = registry.extension_semesters if registry else 0
    maximum_semester = nth_normal(start, rule.max_semesters + exempt + extension) if rule and start else None
    return Progress(
        rule=rule,
        rows=rows,
        studied=studied,
        extension=extension,
        extension_reason=registry.extension_reason if registry else "",
        current=current,
        maximum_semester=maximum_semester,
        intake=read(student.intake_semester),
    )


def maximum_flag(student, rules=None, registry=...):
    """Whether an Active student is on their last allowed semester, or past it."""
    if student.status != student.Status.ACTIVE or is_waiting(student):
        return ""
    progress = progress_of(student, rules, registry=registry)
    return "past" if progress.past_maximum else "last" if progress.last_semester else ""


def minimum_problem(student, *, early_approved=False, rules=None):
    """Why this student cannot graduate yet because of the semesters studied, or None.

    Regulation 20(3) allows finishing one semester early, so that needs approval.
    Anything further below the minimum is refused.
    """
    progress = progress_of(student, rules)
    if progress.rule is None:
        return None
    name = student.user.full_name
    if not progress.has_record:
        return f"{name} has no semester record. Add their semesters on the Student Record first."
    short = progress.short_of_minimum
    if short == 0 or (short == 1 and early_approved):
        return None
    if short == 1:
        return (
            f"{name} has studied {progress.studied} of the minimum {progress.minimum} semesters. "
            "Finishing one semester early needs approval, and it can only be recorded in Student Registry."
        )
    return f"{name} has studied {progress.studied} of the minimum {progress.minimum} semesters, so they cannot graduate yet."


def sync_current(student):
    """The record's current semester follows the student's latest semester."""
    rows = rows_of(student)
    if not rows:
        return
    latest = from_parts(rows[-1].session, rows[-1].term)
    if latest is None:
        return
    registry, _ = StudentRegistry.objects.get_or_create(student=student)
    if registry.current_semester != latest.label:
        registry.current_semester = latest.label
        registry.save(update_fields=["current_semester", "updated_at"])


@transaction.atomic
def record_semester(student, semester, *, actor=None, outcome=STUDIED, note=""):
    """Add one semester to a student's record. Returns (row, created)."""
    row, created = StudentSemester.objects.get_or_create(
        student=student,
        session=semester.session,
        term=semester.term,
        defaults={"outcome": outcome, "note": note, "created_by": actor},
    )
    if created:
        sync_current(student)
    return row, created


def status_follows_row(student, actor, session, term):
    """The active semester's row is the one record of leave, so the status follows it. Other rows leave the status alone."""
    from .participant_lifecycle import transition_student

    active = active_semester()
    if active is None or (session, term) != (active.session, active.term):
        return
    row = student.semesters.filter(session=active.session, term=active.term).first()
    on_leave = bool(row and row.outcome in LEAVE_OUTCOMES)
    if student.status == Student.Status.ACTIVE and on_leave and not is_waiting(student):
        transition_student(matric_no=student.matric_no, actor=actor, target_status="DEFERRED", reason="Recorded as leave on the student's semesters")
    elif student.status == Student.Status.DEFERRED and not on_leave:
        transition_student(matric_no=student.matric_no, actor=actor, target_status="ACTIVE", reason="No longer on leave this semester")


def on_semester(semester):
    return StudentSemester.objects.filter(session=semester.session, term=semester.term).values("student_id")


def waiting_ids():
    return StudentCompletion.objects.filter(senate_decision__isnull=True).values("student_id")


def not_on_semester(semester):
    """(students to update, how many start later). A student whose intake is after this semester has not begun."""
    students = (
        Student.objects.filter(status=Student.Status.ACTIVE)
        .exclude(pk__in=on_semester(semester))
        .exclude(pk__in=waiting_ids())
        .select_related("user", "registry")
        .order_by("user__full_name")
    )
    ready, later = [], 0
    for student in students:
        if starts_later(student, semester):
            later += 1
        else:
            ready.append(student)
    return ready, later


def put_on_semester(students, semester, *, outcome, actor, note=""):
    """Add this semester to each student, and make it their current one."""
    StudentSemester.objects.bulk_create(
        [
            StudentSemester(
                student=student, session=semester.session, term=semester.term, outcome=outcome, note=note, created_by=actor,
            )
            for student in students
        ],
        ignore_conflicts=True,
    )
    registries = {row.student_id: row for row in StudentRegistry.objects.filter(student__in=students)}
    missing, changed = [], []
    for student in students:
        registry = registries.get(student.pk)
        if registry is None:
            missing.append(StudentRegistry(student=student, current_semester=semester.label))
            continue
        current = read(registry.current_semester)
        if current is None or current.key < semester.key:
            registry.current_semester = semester.label
            changed.append(registry)
    StudentRegistry.objects.bulk_create(missing)
    StudentRegistry.objects.bulk_update(changed, ["current_semester"])


def end_leaves(semester, *, actor):
    """Leave is one semester at a time, so a new semester ends it unless leave was already recorded for it."""
    from .participant_lifecycle import ParticipantLifecycleConflict, transition_student

    ended = 0
    for student in Student.objects.filter(status=Student.Status.DEFERRED).exclude(pk__in=on_semester(semester)):
        if starts_later(student, semester):
            continue
        try:
            transition_student(
                matric_no=student.matric_no,
                actor=actor,
                target_status="ACTIVE",
                reason=f"Semester leave ended when {semester.label} started",
            )
        except (ParticipantLifecycleConflict, PermissionError, ValueError):
            continue
        ended += 1
    return ended


@transaction.atomic
def move_everyone_on(portal, actor=None):
    """Activating a normal semester moves everyone on it. Only some take a Special Semester, so the office picks those."""
    semester = from_parts(portal.academic_session, portal.term)
    if semester is None or semester.is_special:
        return None
    back = end_leaves(semester, actor=actor)
    already_on = set(on_semester(semester).values_list("student_id", flat=True))
    active = Student.objects.filter(status=Student.Status.ACTIVE).exclude(pk__in=waiting_ids()).select_for_update()
    moving = [student for student in active if student.pk not in already_on and not starts_later(student, semester)]
    put_on_semester(moving, semester, outcome=STUDIED, actor=actor)
    if not moving and not back:
        return None
    return StudentSemesterMove.objects.create(
        session=semester.session,
        term=semester.term,
        moved_count=len(moving),
        back_from_leave_count=back,
        moved_by=actor,
        automatic=True,
    )


def mark_current_semester_as_leave(student):
    """A student who defers has withdrawn from the semester they are on."""
    from academics.services import current_effective_semester

    portal = current_effective_semester()
    if portal is None:
        return
    student.semesters.filter(
        session=portal.academic_session, term=portal.term, outcome=STUDIED,
    ).update(outcome=LEAVE, note="Deferred during this semester")


def seed_student(student, *, actor=None, note="From the intake and current semester"):
    """Give a student with no semesters yet the ones their record implies."""
    if student.semesters.exists():
        return
    registry = _registry(student)
    semesters = seeded_semesters(student.intake_semester, registry.current_semester if registry else "")
    StudentSemester.objects.bulk_create(
        [
            StudentSemester(student=student, session=s.session, term=s.term, note=note, created_by=actor)
            for s in semesters
        ],
        ignore_conflicts=True,
    )


def _trailing(rows, outcomes):
    count = 0
    for row in reversed(rows):
        if row.outcome not in outcomes:
            break
        count += 1
    return count


def limit_warnings(progress):
    """Where a student stands against UM's limits. The portal only warns: the Faculty or the Senate decides."""
    normal = [row for row in progress.rows if (semester := from_parts(row.session, row.term)) and not semester.is_special]
    warnings = []
    missed = _trailing(normal, (NOT_REGISTERED,))
    if missed >= 3:
        warnings.append({"level": "stop", "code": "NOT_REGISTERED", "text": f"Not registered for {missed} normal semesters in a row. Regulation 5(5) ends candidature."})
    elif missed == 2:
        warnings.append({"level": "check", "code": "NOT_REGISTERED", "text": "Not registered for 2 normal semesters in a row. One more ends candidature."})
    personal = sum(1 for row in normal if row.outcome == LEAVE)
    if personal > 2:
        warnings.append({"level": "stop", "code": "PERSONAL_LEAVE", "text": f"{personal} semesters of personal leave. Regulation 8 allows 2."})
    elif personal == 2:
        warnings.append({"level": "check", "code": "PERSONAL_LEAVE", "text": "Both semesters of personal leave are used."})
    medical = _trailing(normal, (StudentSemester.Outcome.LEAVE_MEDICAL,))
    if medical >= 4:
        warnings.append({"level": "stop", "code": "MEDICAL_LEAVE", "text": f"Medical leave for {medical} normal semesters in a row. Regulation 9(1) may end candidature."})
    if progress.past_maximum and progress.extension >= 3:
        warnings.append({"level": "stop", "code": "FAILED_AND_EXIT", "text": "Past the maximum after all 3 extra semesters. Regulation 55 makes this Failed and Exit."})
    return warnings


def serialize_row(row):
    semester = from_parts(row.session, row.term)
    return {
        "id": row.pk,
        "session": row.session,
        "term": row.term,
        "label": semester.label if semester else f"{row.get_term_display()}, {row.session}",
        "outcome": row.outcome,
        "outcomeLabel": row.get_outcome_display(),
        "note": row.note,
    }


def serialize_progress(student, rules=None):
    progress = progress_of(student, rules)
    return {
        "matric": student.matric_no,
        "studied": progress.studied,
        "minimum": progress.minimum,
        "maximum": progress.maximum,
        "specialCounts": progress.rule.special_counts if progress.rule else True,
        "hasRule": progress.rule is not None,
        "hasRecord": progress.has_record,
        "shortOfMinimum": progress.short_of_minimum,
        "maximumSemester": progress.maximum_semester.label if progress.maximum_semester else "",
        "currentSemester": progress.current.label if progress.current else "",
        "lastSemester": progress.last_semester,
        "pastMaximum": progress.past_maximum,
        "intake": intake_label(student.intake_semester),
        "beforeIntake": [semester.label for semester in progress.before_intake],
        "startsAfterIntake": progress.starts_after_intake,
        "extensionSemesters": progress.extension,
        "extensionReason": progress.extension_reason,
        "warnings": limit_warnings(progress),
        "rows": [serialize_row(row) for row in progress.rows],
    }
