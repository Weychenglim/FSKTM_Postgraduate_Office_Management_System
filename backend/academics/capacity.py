from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from django.db.models import Count
from django.utils import timezone

from accounts.models import Lecturer

from .models import (
    LecturerAvailabilityWindow,
    LecturerCapacityEntry,
    SemesterCapacityPlan,
)


class CapacityRole(StrEnum):
    SUPERVISOR = "SUPERVISOR"
    PANEL = "PANEL"


class CapacityState(StrEnum):
    AVAILABLE = "AVAILABLE"
    FULL = "FULL"
    OVER_CAPACITY = "OVER_CAPACITY"
    TEMPORARILY_UNAVAILABLE = "TEMPORARILY_UNAVAILABLE"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    INELIGIBLE = "INELIGIBLE"


@dataclass(frozen=True)
class CapacityResolution:
    semester_id: int
    plan_id: int | None
    plan_version: int | None
    role: str
    limit: int | None
    active_load: int
    reserved_load: int
    available_slots: int
    state: str
    unavailable_until: date | None
    pending_requests: int = 0


class CapacityConflict(Exception):
    """Raised when current capacity policy blocks a new assignment."""


def _non_negative(value):
    try:
        return max(int(value), 0)
    except (TypeError, ValueError):
        return 0


def capacity_workload_counts(user_ids):
    """Batch global commitments for plan previews and locked publication checks."""
    from appointments.models import (
        CoSupervisorAppointment, PanelAppointment, PanelRecommendation,
        SupervisorAppointment, SupervisorApplication,
    )

    user_ids = set(user_ids)

    def counts(model, field, statuses):
        return {
            row[field]: row["total"]
            for row in model.objects.filter(
                **{f"{field}__in": user_ids, "status__in": statuses}
            ).order_by().values(field).annotate(total=Count("pk"))
        }

    supervisor = counts(SupervisorAppointment, "supervisor_id", ["ACTIVE"])
    for user_id, total in counts(
        CoSupervisorAppointment, "supervisor_id", ["ACTIVE"]
    ).items():
        supervisor[user_id] = supervisor.get(user_id, 0) + total
    return {
        "supervisorLoad": supervisor,
        "supervisorReservations": counts(SupervisorApplication, "proposed_supervisor_id", ["PENDING_COORDINATOR"]),
        "supervisorPendingRequests": counts(SupervisorApplication, "proposed_supervisor_id", ["SUBMITTED_TO_SUPERVISOR"]),
        "panelLoad": counts(PanelAppointment, "panel_member_id", ["ACTIVE"]),
        "panelReservations": counts(
            PanelRecommendation, "recommended_member_id",
            PanelRecommendation.WORKLOAD_RESERVED_STATUSES,
        ),
    }


def _workloads(*, user, role, exclude_panel_recommendation_id=None, exclude_supervisor_application_id=None):
    from appointments.models import (
        PanelAppointment,
        PanelRecommendation,
        SupervisorAppointment,
        CoSupervisorAppointment,
        SupervisorApplication,
    )

    if role == CapacityRole.SUPERVISOR:
        primary = SupervisorAppointment.objects.filter(
            supervisor=user,
            status=SupervisorAppointment.Status.ACTIVE,
        ).order_by().values("pk")
        supporting = CoSupervisorAppointment.objects.filter(
            supervisor=user, status=CoSupervisorAppointment.Status.ACTIVE
        ).order_by().values("pk")
        active_load = primary.union(supporting, all=True).count()
        reservations = SupervisorApplication.objects.filter(proposed_supervisor=user, status="PENDING_COORDINATOR")
        if exclude_supervisor_application_id is not None:
            reservations = reservations.exclude(pk=exclude_supervisor_application_id)
        return _non_negative(active_load), reservations.count()

    active_load = PanelAppointment.objects.filter(
        panel_member=user,
        status=PanelAppointment.Status.ACTIVE,
    ).count()
    reserved_recommendations = PanelRecommendation.objects.filter(
        recommended_member=user,
        status__in=PanelRecommendation.WORKLOAD_RESERVED_STATUSES,
    )
    if exclude_panel_recommendation_id is not None:
        reserved_recommendations = reserved_recommendations.exclude(
            pk=exclude_panel_recommendation_id
        )
    reserved_load = reserved_recommendations.count()
    return _non_negative(active_load), _non_negative(reserved_load)


def _is_eligible(*, user, lecturer, role):
    if (
        not getattr(user, "is_active", False)
        or lecturer is None
        or lecturer.lifecycle_status != Lecturer.Lifecycle.ACTIVE
    ):
        return False

    return hasattr(lecturer, "supervisor" if role == CapacityRole.SUPERVISOR else "panel")


def derive_capacity_resolution(
    *,
    semester_id,
    plan_id,
    plan_version,
    role,
    limit,
    active_load,
    reserved_load,
    eligible,
    unavailable_until,
    pending_requests=0,
):
    """Apply the shared capacity-state precedence to caller-loaded values."""
    role = CapacityRole(role)
    active_load = _non_negative(active_load)
    reserved_load = _non_negative(reserved_load)
    limit = _non_negative(limit) if limit is not None else None
    total_load = active_load + reserved_load
    available_slots = max(limit - total_load, 0) if limit is not None else 0

    if not eligible:
        state = CapacityState.INELIGIBLE
    elif plan_id is None or limit is None:
        state = CapacityState.NOT_CONFIGURED
    elif unavailable_until is not None:
        state = CapacityState.TEMPORARILY_UNAVAILABLE
    elif total_load > limit:
        state = CapacityState.OVER_CAPACITY
    elif total_load == limit:
        state = CapacityState.FULL
    else:
        state = CapacityState.AVAILABLE

    return CapacityResolution(
        semester_id=semester_id,
        plan_id=plan_id,
        plan_version=plan_version,
        role=role,
        limit=limit,
        active_load=active_load,
        reserved_load=reserved_load,
        available_slots=available_slots,
        state=state,
        unavailable_until=(
            unavailable_until
            if state == CapacityState.TEMPORARILY_UNAVAILABLE
            else None
        ),
        pending_requests=_non_negative(pending_requests),
    )


def resolve_lecturer_capacity(
    *,
    user,
    semester,
    role,
    on_date=None,
    exclude_panel_recommendation_id=None,
    exclude_supervisor_application_id=None,
) -> CapacityResolution:
    role = CapacityRole(role)
    on_date = on_date or timezone.localdate()

    lecturer = (
        Lecturer.objects.select_related("user", "supervisor" if role == CapacityRole.SUPERVISOR else "panel")
        .filter(user_id=getattr(user, "pk", None))
        .first()
    )
    persisted_user = lecturer.user if lecturer is not None else user
    eligible = _is_eligible(
        user=persisted_user,
        lecturer=lecturer,
        role=role,
    )
    active_load, reserved_load = _workloads(
        user=user,
        role=role,
        exclude_panel_recommendation_id=exclude_panel_recommendation_id,
        exclude_supervisor_application_id=exclude_supervisor_application_id,
    )

    plan = (
        SemesterCapacityPlan.objects.filter(
            academic_semester_id=semester.pk,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        .only("pk", "version")
        .first()
    )
    entry_values = None
    if plan is not None and lecturer is not None:
        entry_values = (
            LecturerCapacityEntry.objects.filter(
                plan_id=plan.pk,
                lecturer_id=lecturer.pk,
            )
            .values("supervisor_limit", "panel_limit")
            .first()
        )

    limit_field = (
        "supervisor_limit" if role == CapacityRole.SUPERVISOR else "panel_limit"
    )
    configured_limit = entry_values[limit_field] if entry_values is not None else None
    limit = _non_negative(configured_limit) if configured_limit is not None else None

    matched_window_end = None
    if lecturer is not None:
        matched_window_end = (
            LecturerAvailabilityWindow.objects.filter(
                academic_semester_id=semester.pk,
                lecturer_id=lecturer.pk,
                role=role.value,
                cancelled_at__isnull=True,
                starts_on__lte=on_date,
                ends_on__gte=on_date,
            )
            .order_by("-ends_on", "-pk")
            .values_list("ends_on", flat=True)
            .first()
        )

    from appointments.models import SupervisorApplication, PanelRecommendation
    pending_requests = (SupervisorApplication.objects.filter(proposed_supervisor=user, status="SUBMITTED_TO_SUPERVISOR").count()
        if role == CapacityRole.SUPERVISOR else PanelRecommendation.objects.filter(recommended_member=user, status="SUBMITTED_TO_PANEL").count())
    return derive_capacity_resolution(
        semester_id=semester.pk,
        plan_id=plan.pk if plan is not None else None,
        plan_version=plan.version if plan is not None else None,
        role=role,
        limit=limit,
        active_load=active_load,
        reserved_load=reserved_load,
        eligible=eligible,
        unavailable_until=matched_window_end,
        pending_requests=pending_requests,
    )


def capacity_conflict_message(result):
    state = CapacityState(result.state)
    if (
        state == CapacityState.TEMPORARILY_UNAVAILABLE
        and result.unavailable_until is not None
    ):
        return (
            "Lecturer is temporarily unavailable for new assignments through "
            f"{result.unavailable_until.isoformat()}."
        )
    if state == CapacityState.NOT_CONFIGURED:
        return "Lecturer capacity is not configured for this assignment."
    if state == CapacityState.INELIGIBLE:
        return "Lecturer is not eligible for this assignment."
    if state == CapacityState.OVER_CAPACITY:
        return "Lecturer is over capacity and cannot accept a new assignment."
    if state == CapacityState.FULL:
        return "Lecturer has no available capacity for this assignment."
    return "Lecturer capacity allows this assignment."


def assert_capacity_allows_assignment(
    *,
    user,
    semester,
    role,
    on_date=None,
    exclude_panel_recommendation_id=None,
    exclude_supervisor_application_id=None,
):
    if semester is None:
        raise CapacityConflict(
            "Lecturer capacity is not configured for this assignment."
        )
    result = resolve_lecturer_capacity(
        user=user,
        semester=semester,
        role=role,
        on_date=on_date,
        exclude_panel_recommendation_id=exclude_panel_recommendation_id,
        exclude_supervisor_application_id=exclude_supervisor_application_id,
    )
    if result.state != CapacityState.AVAILABLE:
        raise CapacityConflict(capacity_conflict_message(result))
    return result
