"""Shared current-record selection for student-facing Panel responses."""

from .models import PanelAppointment, PanelRecommendation


def current_student_panel_records(profile):
    """An active appointment remains public while its replacement is pending."""
    appointment = (
        PanelAppointment.objects.filter(
            profile=profile, status=PanelAppointment.Status.ACTIVE,
        )
        .select_related(
            "panel_member", "panel_member__lecturer", "supervisor",
            "recommendation", "recommendation__academic_semester",
        )
        .first()
    )
    if appointment:
        return appointment, None
    recommendation = (
        profile.panel_recommendations.filter(
            status__in=PanelRecommendation.PENDING_STATUSES,
        )
        .prefetch_related("workflow_events")
        .select_related("academic_semester")
        .order_by("-updated_at", "-id")
        .first()
    )
    return None, recommendation


def student_panel_timeline(profile):
    appointment, recommendation = current_student_panel_records(profile)
    if not appointment and not recommendation:
        return []
    return [{
        "id": "panel-current-status",
        "title": "Panel appointment",
        "date": appointment.appointment_date.isoformat() if appointment else None,
        "status": "CONFIRMED" if appointment else "FACULTY_PROCESSING",
    }]
