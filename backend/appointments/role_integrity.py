"""Primary/Panel role separation, rechecked under the shared Student lock."""

from django.db.models import Q

from .models import (
    PanelAppointment,
    PanelRecommendation,
    SupervisorApplication,
    SupervisorAppointment,
)


class AppointmentRoleConflict(Exception):
    pass


def _panel_roles(student):
    profiles = Q(profile__student_id=student.user_id) | Q(
        profile__matric_no__iexact=student.matric_no
    )
    return (
        PanelAppointment.objects.filter(profiles, status=PanelAppointment.Status.ACTIVE),
        PanelRecommendation.objects.filter(
            profiles, status__in=PanelRecommendation.PENDING_STATUSES
        ),
    )


def panel_role_candidate_ids(student):
    appointments, recommendations = _panel_roles(student)
    return set(appointments.values_list("panel_member_id", flat=True)) | set(
        recommendations.values_list("recommended_member_id", flat=True)
    )


def assert_no_panel_role(*, student, candidate_id):
    appointments, recommendations = _panel_roles(student)
    if (
        appointments.filter(panel_member_id=candidate_id).exists()
        or recommendations.filter(recommended_member_id=candidate_id).exists()
    ):
        raise AppointmentRoleConflict(
            "This lecturer already has an active or pending Panel role for the student."
        )


def assert_no_primary_role(*, profile, candidate_id):
    student = Q(student__matric_no__iexact=profile.matric_no)
    if profile.student_id:
        student |= Q(student__user_id=profile.student_id)
    if (
        SupervisorAppointment.objects.filter(
            student, supervisor_id=candidate_id, status=SupervisorAppointment.Status.ACTIVE
        ).exists()
        or SupervisorApplication.objects.filter(
            student, proposed_supervisor_id=candidate_id,
            status__in=[SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
                        SupervisorApplication.Status.PENDING_COORDINATOR],
        ).exists()
    ):
        raise AppointmentRoleConflict(
            "This lecturer already has an active or pending primary Supervisor role for the student."
        )
