"""How far along a student is, against their programme's minimum and maximum.

The minimum counts semesters actually studied. The maximum is a fixed semester
counted from the intake in normal semesters, as the office's own letters do it:
personal leave does not move it, medical or mobility leave and an extension do.
"""
from dataclasses import dataclass

from django.db import transaction

from .models import ProgrammeRule, StudentRegistry, StudentSemester
from .registry_programmes import programme_key
from .semesters import Semester, from_parts, nth_normal, read, seeded_semesters

STUDIED = StudentSemester.Outcome.STUDIED
LEAVE = StudentSemester.Outcome.LEAVE
LEAVE_EXEMPT = StudentSemester.Outcome.LEAVE_EXEMPT


def rules_by_programme():
    return {programme_key(rule.programme): rule for rule in ProgrammeRule.objects.all()}


def rule_for(programme, rules=None):
    rules = rules_by_programme() if rules is None else rules
    return rules.get(programme_key(programme))


def _registry(student):
    return StudentRegistry.objects.filter(student_id=student.pk).first()


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
    rule = rule_for(student.programme, rules)
    rows = rows_of(student) if rows is None else rows
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
        if row.outcome == LEAVE_EXEMPT and not semester.is_special:
            exempt += 1
    extension = registry.extension_semesters if registry else 0
    start = read(student.intake_semester)
    if start is None and rows:
        start = from_parts(rows[0].session, rows[0].term)
    maximum_semester = nth_normal(start, rule.max_semesters + exempt + extension) if rule and start else None
    return Progress(
        rule=rule,
        rows=rows,
        studied=studied,
        extension=extension,
        extension_reason=registry.extension_reason if registry else "",
        current=current,
        maximum_semester=maximum_semester,
    )


def maximum_flag(student, rules=None, registry=...):
    """Whether an Active student is on their last allowed semester, or past it."""
    if student.status != student.Status.ACTIVE:
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
        "extensionSemesters": progress.extension,
        "extensionReason": progress.extension_reason,
        "rows": [serialize_row(row) for row in progress.rows],
    }
