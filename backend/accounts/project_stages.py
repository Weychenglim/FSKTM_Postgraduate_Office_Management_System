"""Which part of the research project each student is on in a semester.

Worked out every time it is read, from the student's own answer, their first
supervisor approval, the semester before, and any coordinator change. Only the
answers and the changes are stored. ``project_stages`` is the one read other
modules use.
"""
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone

from academics.models import AcademicSemester
from appointments.models import SupervisorApplication, SupervisorAppointment

from .authorization import coordinator_manages_programme, coordinator_programmes, programme_coordinators
from .models import ProjectRegistration, ProjectRegistrationChange, Student, StudentCompletion, StudentSemester, User
from .project_stage_marks import COUNTS, MarksChanged, apply_marks, preview_marks, touches_marks
from .semester_rules import LEAVE_OUTCOMES, NOT_REGISTERED, STUDIED, active_semester, rule_for, starts_later
from .semesters import SEMESTER_II, SPECIAL, Semester, from_parts, read

ON_PROJECT, NOT_STARTED, COMPLETED, NOT_STUDYING, NOT_CONFIRMED = (
    "ON_PROJECT", "NOT_STARTED", "COMPLETED", "NOT_STUDYING", "NOT_CONFIRMED",
)
ON_LEAVE, UNREGISTERED, FINISHED = "ON_LEAVE", "NOT_REGISTERED", "FINISHED"
NOT_ANSWERED, BREAK_AFTER_P1, NO_SEMESTER_ROW = "NOT_ANSWERED", "BREAK_AFTER_P1", "NO_SEMESTER_ROW"
STUDENT, SUPERVISOR_APPROVAL, COORDINATOR, AUTO = "STUDENT", "SUPERVISOR_APPROVAL", "COORDINATOR", "AUTO"

P1, P2, NONE = ProjectRegistration.Stage.P1, ProjectRegistration.Stage.P2, ProjectRegistration.Stage.NONE
AUTOMATIC = "AUTO"
CONFIRMED, VOIDED = ProjectRegistration.Status.CONFIRMED, ProjectRegistration.Status.VOIDED
Source = ProjectRegistration.Source
STAFF_SOURCES = (Source.OFFICE, Source.LIST, Source.COORDINATOR)
_DONE, _BREAK = "DONE", "BREAK"

REASONS = {
    "REPEAT": "Repeat after a fail",
    "STARTED_LATER": "Started later",
    "WRONG_ANSWER": "Wrong answer",
    "OTHER": "Other",
}
CHOICES = (P1, P2, NONE, AUTOMATIC)
STAGE_NAMES = {P1: "RP1", P2: "RP2"}
CORRECTION_ASKED = "Student requested a correction"
CORRECTION_KEPT = "Correction request closed, answer kept"


@dataclass(frozen=True)
class ProjectStage:
    state: str
    stage: str | None
    reason: str
    source: str
    record_id: int | None
    revision: int


class StageConflict(Exception):
    pass


def semester_of(academic_semester):
    return from_parts(academic_semester.academic_session, academic_semester.term) if academic_semester else None


def semesters_before(academic_semester):
    """The semester before this one. A Special Semester is optional, so the normal semester before it counts too."""
    chosen = []
    for earlier in AcademicSemester.objects.filter(starts_on__lt=academic_semester.starts_on).order_by("-starts_on"):
        chosen.append(earlier)
        if earlier.term != AcademicSemester.Term.SPECIAL:
            break
    return chosen


def approval_semesters(student_ids):
    """The semester of each student's first supervisor approval that is not a replacement."""
    first, calendar = {}, None
    appointments = SupervisorAppointment.objects.filter(
        student_id__in=student_ids, supersedes__isnull=True, application__replaces_appointment__isnull=True,
    ).select_related("application__academic_semester")
    for appointment in appointments:
        semester = semester_of(appointment.application.academic_semester)
        if semester is None:
            calendar = list(AcademicSemester.objects.all()) if calendar is None else calendar
            day = appointment.appointment_date
            semester = next((semester_of(row) for row in calendar if row.starts_on <= day <= row.ends_on), None)
        if semester and (appointment.student_id not in first or semester.key < first[appointment.student_id].key):
            first[appointment.student_id] = semester
    return first


@dataclass
class _Facts:
    students: dict
    rows: dict
    records: dict
    approvals: dict


def _facts(ids):
    rows, records = {}, {}
    for row in StudentSemester.objects.filter(student_id__in=ids):
        semester = from_parts(row.session, row.term)
        if semester:
            rows.setdefault(row.student_id, {})[semester.key] = (semester, row.outcome)
    for record in ProjectRegistration.objects.filter(student_id__in=ids).select_related("academic_semester"):
        semester = semester_of(record.academic_semester)
        if semester:
            records.setdefault(record.student_id, {})[semester.key] = record
    students = {student.pk: student for student in Student.objects.filter(pk__in=ids)}
    return _Facts(students, rows, records, approval_semesters(ids))


def _semesters_up_to(start, target, own):
    """Normal semesters from the start, and the Special Semesters the student studied in. A Special Semester is
    optional, so one they did not register for is skipped, not a break."""
    chosen, current = [], start
    while current.key <= target.key:
        chosen.append(current)
        special = Semester(current.year, SPECIAL)
        if current.term == SEMESTER_II and special.key <= target.key and own.get(special.key, (None, None))[1] == STUDIED:
            chosen.append(special)
        current = current.next_normal()
    if not chosen or chosen[-1].key != target.key:
        chosen.append(target)
    return chosen


def _walk(semesters, own, records, approval):
    stage, source, used, earlier = NONE, AUTO, approval is None, False
    for index, semester in enumerate(semesters):
        if own.get(semester.key, (None, None))[1] != STUDIED:
            if stage == P1:
                stage, source = _BREAK, AUTO
            continue
        record = records.get(semester.key)
        record = record if record is not None and record.status == CONFIRMED else None
        approved_now = not used and semester.key >= approval.key
        used = used or approved_now
        if record is not None and record.source in STAFF_SOURCES:
            stage, source = record.stage, COORDINATOR
        elif stage == P1:
            stage, source = P2, AUTO
        elif stage in (P2, _DONE):
            stage, source = _DONE, AUTO
        elif stage == _BREAK:
            pass
        elif approved_now:
            stage, source = P1, SUPERVISOR_APPROVAL
        elif record is not None:
            stage, source = (P1 if record.stage == P1 else NONE), STUDENT
        else:
            stage, source = NONE, AUTO
        earlier = earlier or index < len(semesters) - 1
    return stage, source, earlier


def _answer(student_id, target, facts, deferred, finished, waiting):
    own = facts.rows.get(student_id, {})
    records = facts.records.get(student_id, {})
    record = records.get(target.key) if target else None
    record_id, revision = (record.pk, record.revision) if record else (None, 0)

    def made(state, stage=None, reason="", source=AUTO):
        return ProjectStage(state, str(stage) if stage else None, reason, source, record_id, revision)

    outcome = own.get(target.key, (None, None))[1] if target else None
    if outcome in LEAVE_OUTCOMES or student_id in deferred:
        return made(NOT_STUDYING, reason=ON_LEAVE)
    if outcome == NOT_REGISTERED:
        return made(NOT_STUDYING, reason=UNREGISTERED)
    if student_id in finished:
        return made(NOT_STUDYING, reason=FINISHED)
    if outcome is None:
        if target and target.is_special:
            return made(NOT_STUDYING, reason=UNREGISTERED)
        return made(NOT_CONFIRMED, reason=NO_SEMESTER_ROW)
    student = facts.students.get(student_id)
    start = read(student.intake_semester) if student else None
    if start is None:
        start = min((semester for semester, _ in own.values()), key=lambda semester: semester.key)
    stage, source, earlier = _walk(_semesters_up_to(start, target, own), own, records, facts.approvals.get(student_id))
    if stage in (P1, P2):
        return made(ON_PROJECT, stage, source=source)
    if stage == _DONE:
        return made(COMPLETED)
    if stage == _BREAK:
        return made(NOT_CONFIRMED, reason=BREAK_AFTER_P1)
    asked = source == AUTO and earlier and student is not None and student.status == Student.Status.ACTIVE and student_id not in waiting
    return made(NOT_STARTED, reason=NOT_ANSWERED if asked else "", source=source)


def project_stages(academic_semester, student_ids):
    """Every student id passed in gets an answer. Student ids are the same as user ids."""
    ids = list(set(student_ids))
    target = semester_of(academic_semester)
    facts = _facts(ids)
    deferred = set()
    if target and target == active_semester():
        deferred = {pk for pk, student in facts.students.items() if student.status == Student.Status.DEFERRED}
    waiting, finished = set(), set()
    for row in StudentCompletion.objects.filter(student_id__in=ids, senate_decision__isnull=True):
        waiting.add(row.student_id)
        last = from_parts(row.last_session, row.last_term)
        if last and target and last.key < target.key:
            finished.add(row.student_id)
    return {student_id: _answer(student_id, target, facts, deferred, finished, waiting) for student_id in ids}


def shown(answer):
    """One word for what a list shows: P1, P2, or the state."""
    return answer.stage if answer.state == ON_PROJECT else answer.state


def research_course(student):
    rule = rule_for(student.programme, intake=read(student.intake_semester))
    return (rule.research_course_code, rule.research_course_name) if rule else ("", "")


def _write_change(record, actor, previous_stage, previous_status, reason, impact):
    ProjectRegistrationChange.objects.create(
        registration=record,
        actor=actor,
        actor_name=actor.full_name,
        previous_stage=previous_stage,
        new_stage=record.stage,
        previous_status=previous_status,
        new_status=record.status,
        reason=reason,
        impact=impact,
    )


def _save(record, student, academic_semester, *, stage, status, source, actor):
    previous = (record.stage, record.status) if record else ("", "")
    if record is None:
        record = ProjectRegistration(student=student, academic_semester=academic_semester)
    else:
        record.revision += 1
    if stage is not None:
        record.stage = stage
    record.status, record.source = status, source
    record.confirmed_by, record.confirmed_at = actor, timezone.now()
    record.save()
    return record, previous


def current_semester():
    from academics.services import current_effective_semester

    return current_effective_semester()


def question_for(student, portal=...):
    """The dashboard question for a student, or None when they are not asked this semester."""
    portal = current_semester() if portal is ... else portal
    if portal is None or student.status != Student.Status.ACTIVE:
        return None
    answer = project_stages(portal, [student.pk])[student.pk]
    answered = answer.source == STUDENT
    open_question = answer.state == NOT_STARTED and (answered or answer.reason == NOT_ANSWERED)
    said_yes = answer.state == ON_PROJECT and answered
    if not (open_question or said_yes):
        return None
    code, name = research_course(student)
    record = ProjectRegistration.objects.filter(pk=answer.record_id).first() if answered and answer.record_id else None
    return {
        "semester": portal,
        "answer": ("YES" if said_yes else "NO") if answered else None,
        "canChange": not answered,
        "code": code,
        "name": name,
        "correction": correction_state(record),
    }


def correction_state(record):
    if record is None or record.correction_requested_at is None:
        return None
    if record.correction_closed_at is None:
        return "REQUESTED"
    return "KEPT" if record.correction_kept else "DONE"


def _notify(users, *, event_key, title, summary, message, target, record_type="", record_id=""):
    from announcements.models import Notification

    rows = [
        Notification(
            recipient=user,
            event_key=event_key[:160],
            title=title[:255],
            service="Postgraduate Office",
            summary=summary[:255],
            message=message,
            is_announcement=False,
            module_label="Student Registry",
            target_module=target,
            record_type=record_type,
            record_id=record_id[:64],
        )
        for user in users
    ]
    if rows:
        Notification.objects.bulk_create(rows, ignore_conflicts=True)


def _answer_words(record, code):
    if record.stage == P1:
        return f"registered for {code}" if code else "registered for the Research Project"
    return "not registered for the Research Project"


@transaction.atomic
def request_correction(student, note, actor):
    """The student asks their programme coordinator to correct a locked answer. Once a semester."""
    Student.objects.select_for_update().get(pk=student.pk)
    question = question_for(student)
    if question is None or question["answer"] is None:
        raise StageConflict("There is no answer to correct this semester.")
    record = ProjectRegistration.objects.select_for_update().get(student=student, academic_semester=question["semester"])
    if record.correction_requested_at is not None:
        raise StageConflict("You have already requested a correction this semester.")
    note = " ".join(note.split())[:300]
    record.correction_requested_at = timezone.now()
    record.correction_note = note
    record.save(update_fields=["correction_requested_at", "correction_note"])
    _write_change(record, actor, record.stage, record.status, f"{CORRECTION_ASKED}: {note}" if note else CORRECTION_ASKED, {})
    name = f"{student.user.full_name} ({student.matric_no})"
    said = _answer_words(record, question["code"])
    _notify(
        programme_coordinators(student.programme),
        event_key=f"registry:stage-correction:{record.pk}",
        title="Research Project registration: correction requested",
        summary=f"{name} asked to correct their answer for {question['semester'].label}.",
        message=f"{name} answered that they {said} in MAYA for {question['semester'].label}, and has asked for a correction."
        + (f" Reason given: {note}" if note else ""),
        target="REGISTRY",
        record_type="PROJECT_STAGE",
        record_id=student.matric_no,
    )
    return record


def _close_correction(record, *, kept):
    record.correction_closed_at = timezone.now()
    record.correction_kept = kept
    record.save(update_fields=["correction_closed_at", "correction_kept"])


@transaction.atomic
def keep_answers(academic_semester, matrics, actor):
    """The coordinator checked the student's MAYA registration and the answer was right."""
    _semester_check(academic_semester)
    wanted = {matric.strip().lower(): matric.strip() for matric in matrics}
    students = list(
        Student.objects.select_for_update().select_related("user").annotate(matric_key=Lower("matric_no"))
        .filter(matric_key__in=list(wanted)).order_by("pk")
    )
    kept, left_out = [], []
    for student in students:
        record = ProjectRegistration.objects.select_for_update().filter(student=student, academic_semester=academic_semester).first()
        if not can_change(actor, student, lock=True):
            left_out.append({"matric": student.matric_no, "name": student.user.full_name, "why": "Not in a programme you manage."})
            continue
        if record is None or not record.correction_open:
            left_out.append({"matric": student.matric_no, "name": student.user.full_name, "why": "No correction request to close."})
            continue
        _close_correction(record, kept=True)
        _write_change(record, actor, record.stage, record.status, CORRECTION_KEPT, {})
        _notify(
            [student.user],
            event_key=f"registry:stage-correction-kept:{record.pk}",
            title="Research Project registration checked",
            summary="Your programme coordinator checked your registration and kept your answer.",
            message=f"Your programme coordinator checked your MAYA registration for {academic_semester.label} and kept your answer: "
            f"{_answer_words(record, research_course(student)[0])}.",
            target="DASHBOARD",
        )
        kept.append(student.matric_no)
    found = {student.matric_key for student in students}
    missing = [{"matric": matric, "name": "", "why": "Not found."} for key, matric in wanted.items() if key not in found]
    return {"changed": kept, "leftOut": left_out + missing}


@transaction.atomic
def answer_question(student, choice, actor):
    """The student's own answer, given once a semester. After that only a programme coordinator can change it."""
    Student.objects.select_for_update().get(pk=student.pk)
    question = question_for(student)
    if question is None:
        raise StageConflict("There is nothing to answer this semester.")
    stage = P1 if choice == "YES" else NONE
    portal = question["semester"]
    record = ProjectRegistration.objects.select_for_update().filter(student=student, academic_semester=portal).first()
    if record and record.status == CONFIRMED and record.source == Source.STUDENT and record.stage == stage:
        return record
    if not question["canChange"]:
        raise StageConflict("Your answer is already recorded. To correct it, contact your programme coordinator.")
    record, previous = _save(record, student, portal, stage=stage, status=CONFIRMED, source=Source.STUDENT, actor=actor)
    _write_change(record, actor, *previous, "Student's answer", {})
    return record


def can_change(user, student, *, lock=False):
    return getattr(user, "role", None) == User.Role.COORDINATOR and coordinator_manages_programme(user, student.programme, lock=lock)


class _LeftOut(Exception):
    def __init__(self, why):
        super().__init__(why)
        self.why = why


class _DryRun(Exception):
    pass


def _change_one(student, academic_semester, before, expected, choice, actor):
    """Save one change and return (record, previous, after). Checks that apply whether or not it is kept."""
    if not can_change(actor, student, lock=True):
        raise _LeftOut("Not in a programme you manage.")
    if before.state == NOT_STUDYING:
        raise _LeftOut("Not studying this semester.")
    if expected is not None and shown(before) != expected:
        raise _LeftOut("This has changed since the page opened. Reload it.")
    record = ProjectRegistration.objects.select_for_update().filter(student=student, academic_semester=academic_semester).first()
    set_by_staff = record is not None and record.status == CONFIRMED and record.source in STAFF_SOURCES
    if choice == AUTOMATIC:
        if not set_by_staff:
            raise _LeftOut("There is no coordinator change to undo.")
        record, previous = _save(record, student, academic_semester, stage=None, status=VOIDED, source=record.source, actor=actor)
    else:
        if set_by_staff and record.stage == choice:
            raise _LeftOut("Already set to this.")
        record, previous = _save(record, student, academic_semester, stage=choice, status=CONFIRMED, source=Source.COORDINATOR, actor=actor)
    after = project_stages(academic_semester, [student.pk])[student.pk]
    return record, previous, after


def _semester_check(academic_semester):
    portal = current_semester()
    if portal is None or portal.pk != academic_semester.pk:
        raise StageConflict("Only the current semester can be changed.")


def preview_change(academic_semester, student, choice, actor):
    """What a change would do to Marks, without keeping it."""
    _semester_check(academic_semester)
    found = {}
    try:
        with transaction.atomic():
            Student.objects.select_for_update().get(pk=student.pk)
            before = project_stages(academic_semester, [student.pk])[student.pk]
            _record, _previous, after = _change_one(student, academic_semester, before, None, choice, actor)
            found.update(preview_marks(student, academic_semester, before.stage, after.stage))
            raise _DryRun
    except _DryRun:
        pass
    except _LeftOut as left:
        raise StageConflict(left.why) from left
    return found


@transaction.atomic
def change_stages(academic_semester, items, *, choice, reason, actor, checked=False, token=""):
    """Coordinator changes for the current semester. ``items`` is (matric, what the page showed).
    One student: a change that touches Marks needs ``checked``. Several: anyone it would touch is left out."""
    _semester_check(academic_semester)
    single = len(items) == 1
    wanted = {matric.strip().lower(): (matric.strip(), shown_as) for matric, shown_as in items}
    students = list(
        Student.objects.select_for_update().select_related("user").annotate(matric_key=Lower("matric_no"))
        .filter(matric_key__in=list(wanted)).order_by("pk")
    )
    before = project_stages(academic_semester, [student.pk for student in students])
    label = REASONS[reason]
    changed, left_out, found = [], [], set()
    for student in students:
        found.add(student.matric_key)
        try:
            with transaction.atomic():
                record, previous, after = _change_one(student, academic_semester, before[student.pk], wanted[student.matric_key][1], choice, actor)
                impact = preview_marks(student, academic_semester, before[student.pk].stage, after.stage)
                if touches_marks(impact):
                    if not single:
                        raise _LeftOut("Has Marks tasks. Change this student on their own.")
                    if not checked:
                        raise StageConflict("Check what this changes in Marks first.")
                    if token and token != impact.get("token"):
                        raise StageConflict("Marks has changed since you checked. Look again.")
                _write_change(record, actor, *previous, label, {key: impact.get(key, 0) for key in COUNTS})
                try:
                    apply_marks(student, academic_semester, before[student.pk].stage, after.stage, token=impact.get("token", ""), actor=actor, reason=label)
                except MarksChanged as exc:
                    raise StageConflict("Marks has changed since you checked. Look again.") from exc
                if record.correction_open:
                    _close_correction(record, kept=False)
                    _notify(
                        [student.user],
                        event_key=f"registry:stage-correction-done:{record.pk}",
                        title="Research Project registration updated",
                        summary=f"Your programme coordinator updated your Research Project stage to {STAGE_NAMES.get(after.stage, 'Not started')}.",
                        message=f"Your programme coordinator updated your Research Project stage for {academic_semester.label} "
                        f"to {STAGE_NAMES.get(after.stage, 'Not started')}.",
                        target="DASHBOARD",
                    )
            changed.append(student.matric_no)
        except _LeftOut as left:
            if single:
                raise StageConflict(left.why) from left
            left_out.append({"matric": student.matric_no, "name": student.user.full_name, "why": left.why})
    missing = [{"matric": matric, "name": "", "why": "Not found."} for key, (matric, _) in wanted.items() if key not in found]
    if single and missing:
        raise StageConflict("That student was not found.")
    return {"changed": changed, "leftOut": left_out + missing}


def page_students(academic_semester, *, current):
    """Everyone on this semester. For the current one, only students still studying, plus Active students
    without a row yet."""
    target = semester_of(academic_semester)
    on_it = StudentSemester.objects.filter(session=academic_semester.academic_session, term=academic_semester.term).values("student_id")
    recorded = ProjectRegistration.objects.filter(academic_semester=academic_semester).values("student_id")
    query = Q(pk__in=on_it) | Q(pk__in=recorded)
    if current:
        query = (query | Q(status=Student.Status.ACTIVE)) & Q(status__in=[Student.Status.ACTIVE, Student.Status.DEFERRED])
    students = Student.objects.filter(query).select_related("user").order_by("user__full_name")
    return [student for student in students if not starts_later(student, target)]


def visible_to(user, students):
    if getattr(user, "role", None) != User.Role.COORDINATOR:
        return students
    managed = {programme.casefold() for programme in coordinator_programmes(user)}
    return [student for student in students if (student.programme or "").strip().casefold() in managed]


def open_corrections(user):
    """Correction requests waiting for this coordinator in the current semester."""
    portal = current_semester()
    if portal is None or getattr(user, "role", None) != User.Role.COORDINATOR:
        return 0
    rows = ProjectRegistration.objects.filter(
        academic_semester=portal,
        status=ProjectRegistration.Status.CONFIRMED,
        correction_requested_at__isnull=False,
        correction_closed_at__isnull=True,
        student__status__in=[Student.Status.ACTIVE, Student.Status.DEFERRED],
    ).select_related("student")
    return len(visible_to(user, [row.student for row in rows]))


def supervision_of(student_ids):
    """(students with a supervisor now, students with a supervisor request waiting)."""
    supervised = set(
        SupervisorAppointment.objects.filter(student_id__in=student_ids, status=SupervisorAppointment.Status.ACTIVE)
        .values_list("student_id", flat=True)
    )
    waiting = set(
        SupervisorApplication.objects.filter(
            student_id__in=student_ids,
            status__in=[SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR, SupervisorApplication.Status.PENDING_COORDINATOR],
        ).values_list("student_id", flat=True)
    )
    return supervised, waiting
