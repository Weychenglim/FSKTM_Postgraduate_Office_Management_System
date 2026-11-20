"""Release appointments from an RP2 attempt when Registry advances to Completed."""

from collections import Counter

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from academics.models import AcademicSemester
from accounts.models import Student
from accounts.project_stages import (
    COMPLETED, NOT_STUDYING, NO_SEMESTER_ROW, P2, project_stages, semesters_before,
)
from . import appointment_lifecycle, co_supervision
from .models import CoSupervisorAppointment, PanelAppointment, SupervisorAppointment


_ROLES = (
    (SupervisorAppointment, "student_id", "supervisor_id", "application"),
    (CoSupervisorAppointment, "student_id", "supervisor_id", "nomination"),
    (PanelAppointment, "profile__student_id", "panel_member_id", "recommendation"),
)


def _older_appointments(semester, model, student_field, source):
    source_semester = f"{source}__academic_semester"
    return model.objects.filter(status=model.Status.ACTIVE).filter(
        Q(**{f"{source_semester}__starts_on__lt": semester.starts_on})
        | Q(**{f"{source_semester}__isnull": True}, appointment_date__lt=semester.starts_on)
    ).exclude(**{f"{student_field}__isnull": True}).order_by()


def _finished_students(semester, prior, student_ids, *, forecast=False):
    if not student_ids:
        return set()

    target = project_stages(semester, student_ids)
    candidates = {pk for pk, answer in target.items() if answer.state == COMPLETED}
    if forecast and semester.term != AcademicSemester.Term.SPECIAL:
        # Registry adds missing STUDIED rows for active students at normal rollover.
        candidates.update(pk for pk, answer in target.items()
                          if answer.reason == NO_SEMESTER_ROW and answer.record_id is None)

    finished = set()
    for previous in prior:
        if not candidates or previous.lifecycle_status == AcademicSemester.Lifecycle.DRAFT:
            break
        stages = project_stages(previous, candidates)
        finished.update(pk for pk, answer in stages.items() if answer.stage == P2)
        if previous.term != AcademicSemester.Term.SPECIAL:
            break
        # A Special Semester may be skipped, or the first Completed lookup may
        # have appeared there only after the student's registration was entered.
        candidates = {pk for pk, answer in stages.items()
                      if answer.state in (NOT_STUDYING, COMPLETED)}
    return finished


def expected_rp2_releases(semester, user_ids):
    """Return forecast role counts. Live workload and reservations stay intact."""
    supervisor, panel = Counter(), Counter()
    if semester.lifecycle_status != AcademicSemester.Lifecycle.DRAFT or semester.starts_on < timezone.localdate():
        return supervisor, panel
    prior = semesters_before(semester)
    if not prior or prior[0].lifecycle_status == AcademicSemester.Lifecycle.DRAFT:
        return supervisor, panel

    assignments = [
        list(_older_appointments(semester, model, student_field, source)
             .filter(**{f"{lecturer_field}__in": user_ids}).values_list(student_field, lecturer_field))
        for model, student_field, lecturer_field, source in _ROLES
    ]
    active_students = Student.objects.filter(
        pk__in={pk for rows in assignments for pk, _ in rows}, status=Student.Status.ACTIVE,
    ).values_list("pk", flat=True)
    finished = _finished_students(semester, prior, set(active_students), forecast=True)
    for counter, rows in zip((supervisor, supervisor, panel), assignments):
        counter.update(lecturer_id for pk, lecturer_id in rows if pk in finished)
    return supervisor, panel


@transaction.atomic
def release_completed_rp2_appointments(semester, *, actor):
    semester = AcademicSemester.objects.select_for_update().get(pk=semester.pk)
    if not semester.is_active:
        return
    prior = semesters_before(semester)
    if not prior or prior[0].lifecycle_status == AcademicSemester.Lifecycle.DRAFT:
        return

    assignments = [
        (model, student_field, _older_appointments(semester, model, student_field, source))
        for model, student_field, _, source in _ROLES
    ]
    student_ids = {pk for _, field, rows in assignments for pk in rows.values_list(field, flat=True)}
    candidates = _finished_students(semester, prior, student_ids)
    if not candidates:
        return
    locked = Student.objects.select_for_update().filter(pk__in=candidates).order_by("pk")
    finished = _finished_students(semester, prior, set(locked.values_list("pk", flat=True)))
    reason = f"RP2 appointment released at rollover to {semester.label} after Registry showed Completed."

    # End supporting appointments before primary supervision closes its pending nominations.
    for model, field, rows in (assignments[1], assignments[0], assignments[2]):
        for appointment_id in rows.filter(**{f"{field}__in": finished}).order_by("pk").values_list("pk", flat=True):
            values = {"appointment_id": appointment_id, "actor": actor,
                      "outcome": model.EndOutcome.COMPLETED, "reason": reason}
            if model is CoSupervisorAppointment:
                co_supervision.end_appointment(**values)
            else:
                appointment_lifecycle.end_appointment(model=model, **values)
