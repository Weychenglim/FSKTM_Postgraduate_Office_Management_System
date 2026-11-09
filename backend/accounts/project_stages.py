"""Which part of the research project each student is on in a semester.

The office confirms it. Suggestions are worked out when the page opens and are
never stored, so they can never reach Marks. ``project_stages`` is the one read
other modules use.
"""
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone

from academics.models import AcademicSemester
from appointments.models import CoSupervisorAppointment, PanelAppointment, SupervisorApplication, SupervisorAppointment

from .models import ProjectRegistration, ProjectRegistrationChange, Student, StudentCompletion, StudentSemester
from .semester_rules import LEAVE_OUTCOMES, NOT_REGISTERED, active_semester, starts_later
from .semesters import from_parts

CONFIRMED, NO_PROJECT, NOT_CONFIRMED, NOT_STUDYING = "CONFIRMED", "NO_PROJECT", "NOT_CONFIRMED", "NOT_STUDYING"
ON_LEAVE, UNREGISTERED, FINISHED = "ON_LEAVE", "NOT_REGISTERED", "FINISHED"
P1, P2, NONE = ProjectRegistration.Stage.P1, ProjectRegistration.Stage.P2, ProjectRegistration.Stage.NONE
VOID = "VOID"


@dataclass(frozen=True)
class ProjectStage:
    state: str
    stage: str | None
    reason: str
    record_id: int | None
    revision: int


def _not_studying(reason):
    return ProjectStage(NOT_STUDYING, None, reason, None, 0)


def project_stages(academic_semester, student_ids):
    """Every student id passed in gets an answer. Student ids are the same as user ids."""
    ids = list(set(student_ids))
    semester = from_parts(academic_semester.academic_session, academic_semester.term)
    outcomes = dict(
        StudentSemester.objects.filter(
            student_id__in=ids, session=academic_semester.academic_session, term=academic_semester.term,
        ).values_list("student_id", "outcome")
    )
    deferred = set()
    if semester and semester == active_semester():
        deferred = set(Student.objects.filter(pk__in=ids, status=Student.Status.DEFERRED).values_list("pk", flat=True))
    finished = {
        row.student_id
        for row in StudentCompletion.objects.filter(student_id__in=ids, senate_decision__isnull=True)
        if (last := from_parts(row.last_session, row.last_term)) and semester and last.key < semester.key
    }
    records = {
        row.student_id: row
        for row in ProjectRegistration.objects.filter(student_id__in=ids, academic_semester=academic_semester)
    }
    answers = {}
    for student_id in ids:
        outcome = outcomes.get(student_id)
        record = records.get(student_id)
        if outcome in LEAVE_OUTCOMES or student_id in deferred:
            answers[student_id] = _not_studying(ON_LEAVE)
        elif outcome == NOT_REGISTERED:
            answers[student_id] = _not_studying(UNREGISTERED)
        elif student_id in finished:
            answers[student_id] = _not_studying(FINISHED)
        elif record is None:
            answers[student_id] = ProjectStage(NOT_CONFIRMED, None, "", None, 0)
        elif record.status != ProjectRegistration.Status.CONFIRMED:
            answers[student_id] = ProjectStage(NOT_CONFIRMED, None, "", record.pk, record.revision)
        elif record.stage == NONE:
            answers[student_id] = ProjectStage(NO_PROJECT, None, "", record.pk, record.revision)
        else:
            answers[student_id] = ProjectStage(CONFIRMED, record.stage, "", record.pk, record.revision)
    return answers


def semesters_before(academic_semester):
    """The semester before this one. A Special Semester is optional, so the normal semester before it counts too."""
    chosen = []
    for earlier in AcademicSemester.objects.filter(starts_on__lt=academic_semester.starts_on).order_by("-starts_on"):
        chosen.append(earlier)
        if earlier.term != AcademicSemester.Term.SPECIAL:
            break
    return chosen


def suggestions(academic_semester, student_ids):
    """The first approved supervisor request suggests P1. P1 in the semester before suggests P2."""
    ids = list(student_ids)
    first_requests = set(
        SupervisorApplication.objects.filter(
            student_id__in=ids,
            academic_semester=academic_semester,
            status=SupervisorApplication.Status.APPROVED,
            replaces_appointment__isnull=True,
        ).values_list("student_id", flat=True)
    )
    on_p1 = set(
        ProjectRegistration.objects.filter(
            student_id__in=ids,
            academic_semester__in=semesters_before(academic_semester),
            status=ProjectRegistration.Status.CONFIRMED,
            stage=P1,
        ).values_list("student_id", flat=True)
    )
    return {student_id: P2 if student_id in on_p1 else P1 for student_id in ids if student_id in on_p1 or student_id in first_requests}


def appointed_ids(student_ids):
    """Students Marks would otherwise give a task to."""
    ids = list(student_ids)
    appointed = set(SupervisorAppointment.objects.filter(student_id__in=ids, status="ACTIVE").values_list("student_id", flat=True))
    appointed |= set(CoSupervisorAppointment.objects.filter(student_id__in=ids, status="ACTIVE").values_list("student_id", flat=True))
    appointed |= set(PanelAppointment.objects.filter(profile__student_id__in=ids, status="ACTIVE").values_list("profile__student_id", flat=True))
    return appointed


def marks_impact(student, academic_semester, previous_stage, new_stage):
    """How many existing Marks tasks a change would touch."""
    from marks.models import EvaluationTask, MarkEntry

    counts = {"notStarted": 0, "draft": 0, "submitted": 0}
    if previous_stage not in (P1, P2) or previous_stage == new_stage:
        return counts
    tasks = (
        EvaluationTask.objects.filter(
            profile__student_id=student.pk, period__academic_semester=academic_semester, period__assessment=previous_stage,
        )
        .exclude(lifecycle_status=EvaluationTask.Lifecycle.RETIRED)
        .select_related("mark_entry")
    )
    for task in tasks:
        entry = getattr(task, "mark_entry", None)
        state = entry.status if entry else MarkEntry.Status.NOT_STARTED
        counts["submitted" if state == MarkEntry.Status.SUBMITTED else "draft" if state == MarkEntry.Status.DRAFT else "notStarted"] += 1
    return counts


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


@transaction.atomic
def confirm_stages(academic_semester, items, actor):
    """First confirmations. A stage that is already confirmed goes through a correction instead."""
    wanted = {matric.strip().lower(): (matric, stage) for matric, stage in items}
    students = Student.objects.select_for_update().annotate(matric_key=Lower("matric_no")).filter(matric_key__in=list(wanted)).order_by("pk")
    confirmed, skipped, found = [], [], set()
    for student in students:
        found.add(student.matric_key)
        stage = wanted[student.matric_key][1]
        record = ProjectRegistration.objects.select_for_update().filter(student=student, academic_semester=academic_semester).first()
        if record is not None and record.status == ProjectRegistration.Status.CONFIRMED:
            skipped.append({"matric": student.matric_no, "why": "Already confirmed."})
            continue
        previous_stage, previous_status = (record.stage, record.status) if record else ("", "")
        if record is None:
            record = ProjectRegistration(student=student, academic_semester=academic_semester)
        else:
            record.revision += 1
        record.stage = stage
        record.status = ProjectRegistration.Status.CONFIRMED
        record.confirmed_by = actor
        record.confirmed_at = timezone.now()
        record.save()
        _write_change(record, actor, previous_stage, previous_status, "", {})
        confirmed.append(student.matric_no)
    skipped += [{"matric": matric, "why": "Not found."} for key, (matric, _) in wanted.items() if key not in found]
    return {"confirmed": confirmed, "skipped": skipped}


class StageConflict(Exception):
    pass


@transaction.atomic
def correct_stage(student, academic_semester, *, new_stage, reason, actor, revision, acknowledged):
    """Change or void a confirmed stage. Whoever does it has to see what it touches in Marks first."""
    Student.objects.select_for_update().get(pk=student.pk)
    record = ProjectRegistration.objects.select_for_update().filter(student=student, academic_semester=academic_semester).first()
    if record is None:
        raise StageConflict("This stage has not been confirmed yet.")
    if record.revision != revision:
        raise StageConflict("Someone has just changed this stage. Reload the page.")
    impact = marks_impact(student, academic_semester, record.stage if record.status == ProjectRegistration.Status.CONFIRMED else "", None if new_stage == VOID else new_stage)
    if any(impact.values()) and not acknowledged:
        raise StageConflict("Check what this changes in Marks first.")
    previous_stage, previous_status = record.stage, record.status
    if new_stage == VOID:
        record.status = ProjectRegistration.Status.VOIDED
    else:
        record.stage = new_stage
        record.status = ProjectRegistration.Status.CONFIRMED
        record.confirmed_by = actor
        record.confirmed_at = timezone.now()
    record.revision += 1
    record.save()
    _write_change(record, actor, previous_stage, previous_status, reason, impact)
    return record


def page_rows(academic_semester):
    """The Project stage page: everyone still studying, and anyone already on record for this semester."""
    semester = from_parts(academic_semester.academic_session, academic_semester.term)
    on_record = ProjectRegistration.objects.filter(academic_semester=academic_semester).values("student_id")
    students = list(
        Student.objects.filter(Q(status=Student.Status.ACTIVE) | Q(pk__in=on_record))
        .select_related("user")
        .order_by("user__full_name")
    )
    students = [student for student in students if not starts_later(student, semester)]
    ids = [student.pk for student in students]
    return students, project_stages(academic_semester, ids), suggestions(academic_semester, ids), appointed_ids(ids)
