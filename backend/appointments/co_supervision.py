"""Supporting supervision workflow and explicitly restricted read projections.

Student rows serialize all changes to a student's team and cross-module roles.
Lecturer rows serialize shared capacity changes, after the student lock.
"""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from academics.capacity import (
    CapacityRole,
    CapacityConflict,
    CapacityState,
    assert_capacity_allows_assignment,
    resolve_lecturer_capacity,
)
from academics.services import current_effective_semester
from accounts.authorization import coordinator_manages_programme, coordinator_scope_q, programme_coordinators
from accounts.eligibility import (
    user_is_assignable_lecturer,
    student_is_workflow_eligible,
)
from accounts.models import Student, Lecturer, User
from .ageing import elapsed_calendar_days
from .models import (
    CoSupervisorNomination,
    CoSupervisorAppointment,
    SupervisorAppointment,
    SupervisorApplication,
    StudentResearchProfile,
    PanelAppointment,
    PanelRecommendation,
    AppointmentWorkflowEvent,
    AppointmentLifecycleEvent,
)
from .notifications import publish_workflow_notification
from .request_visibility import can_view_supervisor_application, routine_supervisor_requests
from .student_panel import student_panel_timeline


class CoSupervisionConflict(Exception):
    pass


class CoSupervisionForbidden(Exception):
    pass


MAX_CO_SUPERVISORS = 2


def can_manage(actor, student, *, lock=False):
    return actor.role == User.Role.OFFICE_ADMIN or coordinator_manages_programme(
        actor, student.programme, lock=lock
    )


def active_primary(student):
    return (
        SupervisorAppointment.objects.filter(
            student=student, status=SupervisorAppointment.Status.ACTIVE
        )
        .select_related("supervisor__lecturer", "application__academic_semester")
        .first()
    )


def can_nominate(actor, student, *, check_pending=True):
    return (
        student_is_workflow_eligible(student)
        and user_is_assignable_lecturer(actor)
        and (not check_pending or not CoSupervisorNomination.objects.filter(
            student=student, status__in=CoSupervisorNomination.PENDING_STATUSES
        ).exists())
        and SupervisorAppointment.objects.filter(
            student=student, supervisor=actor, status="ACTIVE"
        ).exists()
    )


def can_read_team(actor, student):
    return (
        can_manage(actor, student)
        or actor.pk == student.user_id
        or SupervisorAppointment.objects.filter(
            student=student, supervisor=actor, status="ACTIVE"
        ).exists()
        or CoSupervisorAppointment.objects.filter(
            student=student, supervisor=actor, status="ACTIVE"
        ).exists()
    )


def visible_students(actor):
    rows = Student.objects.select_related("user")
    if actor.role == User.Role.OFFICE_ADMIN:
        return rows
    if actor.role == User.Role.COORDINATOR:
        return rows.filter(coordinator_scope_q(actor, "programme"))
    if actor.role == User.Role.STUDENT:
        return rows.filter(user=actor)
    return rows.filter(
        Q(
            supervisor_appointments__supervisor=actor,
            supervisor_appointments__status="ACTIVE",
        )
        | Q(
            co_supervisor_appointments__supervisor=actor,
            co_supervisor_appointments__status="ACTIVE",
        )
    ).distinct()


def nominations_queryset():
    return CoSupervisorNomination.objects.select_related(
        "student__user",
        "candidate",
        "nominator",
        "primary_appointment",
        "academic_semester",
        "replaces_appointment",
    ).prefetch_related("workflow_events__actor")


def appointments_queryset():
    return CoSupervisorAppointment.objects.select_related(
        "student__user", "supervisor__lecturer", "nomination__academic_semester"
    ).prefetch_related("lifecycle_events__actor")


def assert_no_supporting_role(*, student_id, candidate_id):
    """Used by Primary and Panel submission/activation under their student lock."""
    if (
        CoSupervisorAppointment.objects.filter(
            student_id=student_id, supervisor_id=candidate_id, status="ACTIVE"
        ).exists()
        or CoSupervisorNomination.objects.filter(
            student_id=student_id,
            candidate_id=candidate_id,
            status__in=CoSupervisorNomination.PENDING_STATUSES,
        ).exists()
    ):
        raise CoSupervisionConflict(
            "This lecturer already has an active or pending co-supervisor role for the student."
        )


def _check_candidate(
    *,
    student,
    candidate,
    primary,
    semester,
    exclude_nomination=None,
    replaces=None,
    check_positions=True,
):
    if not student_is_workflow_eligible(student):
        raise CoSupervisionConflict(
            "The student's lifecycle status does not permit a new co-supervisor appointment."
        )
    if primary is None or primary.status != "ACTIVE":
        raise CoSupervisionConflict(
            "An active primary supervisor appointment is required."
        )
    if not user_is_assignable_lecturer(candidate):
        raise CoSupervisionConflict(
            "The candidate is not eligible for new supervisor appointments."
        )
    if primary.supervisor_id == candidate.pk:
        raise CoSupervisionConflict(
            "The primary supervisor cannot also be a co-supervisor."
        )
    if SupervisorApplication.objects.filter(
        student=student,
        proposed_supervisor=candidate,
        status__in=["SUBMITTED_TO_SUPERVISOR", "PENDING_COORDINATOR"],
    ).exists():
        raise CoSupervisionConflict(
            "The candidate has a pending primary supervisor application for this student."
        )
    if CoSupervisorAppointment.objects.filter(
        student=student, supervisor=candidate, status="ACTIVE"
    ).exists():
        raise CoSupervisionConflict(
            "The candidate is already an active co-supervisor for this student."
        )
    pending = CoSupervisorNomination.objects.filter(
        student=student, status__in=CoSupervisorNomination.PENDING_STATUSES
    )
    if exclude_nomination:
        pending = pending.exclude(pk=exclude_nomination)
    if check_positions and exclude_nomination is None and pending.exists():
        raise CoSupervisionConflict(
            "A co-supervisor nomination is already pending for this student. Wait for it to be resolved before submitting another."
        )
    if pending.filter(candidate=candidate).exists():
        raise CoSupervisionConflict(
            "A pending nomination already exists for this candidate."
        )
    profile_filter = Q(profile__student_id=student.user_id) | Q(
        profile__matric_no__iexact=student.matric_no
    )
    if (
        PanelAppointment.objects.filter(
            profile_filter, panel_member=candidate, status="ACTIVE"
        ).exists()
        or PanelRecommendation.objects.filter(
            profile_filter,
            recommended_member=candidate,
            status__in=PanelRecommendation.PENDING_STATUSES,
        ).exists()
    ):
        raise CoSupervisionConflict(
            "An active or pending Panel role conflicts with co-supervision for this student."
        )
    if check_positions:
        active_ids = set(
            CoSupervisorAppointment.objects.filter(
                student=student, status="ACTIVE"
            ).values_list("pk", flat=True)
        )
        if replaces:
            if (
                replaces.student_id != student.pk
                or replaces.pk not in active_ids
                or hasattr(replaces, "replacement_appointment")
            ):
                raise CoSupervisionConflict(
                    "Select an active co-supervisor appointment belonging to this student for replacement."
                )
            if pending.filter(replaces_appointment=replaces).exists():
                raise CoSupervisionConflict(
                    "A replacement nomination is already pending for this appointment."
                )
        # A pending replacement and its active predecessor occupy a single team position.
        occupied = len(active_ids) + sum(
            1
            for target in pending.values_list("replaces_appointment_id", flat=True)
            if target not in active_ids
        )
        if occupied + (0 if replaces else 1) > MAX_CO_SUPERVISORS:
            raise CoSupervisionConflict(
                "A student may have at most two active or pending co-supervisor positions."
            )
    try:
        return assert_capacity_allows_assignment(
            user=candidate, semester=semester, role=CapacityRole.SUPERVISOR
        )
    except CapacityConflict as exc:
        raise CoSupervisionConflict(str(exc)) from exc


def _workflow(row, actor, action, previous="", reason=""):
    event = AppointmentWorkflowEvent.objects.create(
        co_supervisor_nomination=row,
        actor=actor,
        actor_role=actor.role,
        action=action,
        previous_status=previous,
        new_status=row.status,
        reason=reason,
    )
    recipients = {
        user.pk: user for user in [row.candidate, row.nominator]
    }
    if row.status == CoSupervisorNomination.Status.PENDING_COORDINATOR:
        for user in programme_coordinators(row.student.programme):
            recipients[user.pk] = user
    for recipient in recipients.values():
        publish_workflow_notification(
            recipient=recipient,
            actor=actor,
            event_key=f"co-supervisor:{row.pk}:{event.pk}",
            title="Co-supervisor nomination updated",
            summary=f"{row.student.user.full_name}: {row.get_status_display()}.",
            message=row.justification,
            module_label="Supervisor Appointments",
            target_module="SUPERVISOR_APPOINTMENTS",
            record_type="CO_SUPERVISOR_NOMINATION",
            record_id=row.pk,
        )
    return event


def _lifecycle(row, actor, action, previous="", reason=""):
    return AppointmentLifecycleEvent.objects.create(
        co_supervisor_appointment=row,
        actor=actor,
        actor_role=actor.role,
        action=action,
        previous_status=previous,
        new_status=row.status,
        outcome=row.end_outcome,
        reason=reason,
    )


@transaction.atomic
def nominate(
    *, actor, student_id, candidate_id, justification, replaces_appointment_id=None
):
    student = (
        Student.objects.select_for_update().select_related("user").get(pk=student_id)
    )
    from .research_amendments import assert_no_pending_transfer, AmendmentConflict
    try:
        assert_no_pending_transfer(student.pk)
    except AmendmentConflict as exc:
        raise CoSupervisionConflict(str(exc)) from exc
    primary = active_primary(student)
    if primary is None or primary.supervisor_id != actor.pk:
        raise CoSupervisionForbidden(
            "Only the active primary supervisor may nominate a co-supervisor."
        )
    if not user_is_assignable_lecturer(actor):
        raise CoSupervisionConflict(
            "The primary supervisor is unavailable for new nominations."
        )
    justification = str(justification or "").strip()
    if not justification:
        raise ValueError("A nomination justification is required.")
    candidate = User.objects.get(pk=candidate_id)
    # Lock all relevant lecturers in deterministic order before checking eligibility/capacity.
    list(
        Lecturer.objects.select_for_update()
        .filter(pk__in=[actor.pk, candidate.pk])
        .order_by("pk")
    )
    candidate = User.objects.get(pk=candidate_id)
    actor = User.objects.get(pk=actor.pk)
    if not user_is_assignable_lecturer(actor):
        raise CoSupervisionConflict(
            "The primary supervisor is unavailable for new nominations."
        )
    semester = current_effective_semester()
    if semester is None:
        raise CoSupervisionConflict(
            "An effective academic semester is required for nominations."
        )
    target = (
        CoSupervisorAppointment.objects.get(pk=replaces_appointment_id)
        if replaces_appointment_id
        else None
    )
    _check_candidate(
        student=student,
        candidate=candidate,
        primary=primary,
        semester=semester,
        replaces=target,
    )
    row = CoSupervisorNomination.objects.create(
        student=student,
        primary_appointment=primary,
        candidate=candidate,
        nominator=actor,
        academic_semester=semester,
        justification=justification,
        replaces_appointment=target,
    )
    _workflow(row, actor, "NOMINATE")
    return row


def allowed_actions(row, actor):
    pending = row.status in CoSupervisorNomination.PENDING_STATUSES
    actions = []
    eligible = student_is_workflow_eligible(row.student)
    if (
        row.status == "SUBMITTED_TO_CO_SUPERVISOR"
        and actor.pk == row.candidate_id
        and actor.is_active
    ):
        actions.append("reject")
        if eligible and user_is_assignable_lecturer(actor):
            actions.insert(0, "accept")
    if row.status == "PENDING_COORDINATOR" and coordinator_manages_programme(
        actor, row.student.programme
    ):
        actions.append("coordinator-reject")
        if eligible:
            actions.insert(0, "approve")
    if pending and (
        actor.role == User.Role.OFFICE_ADMIN
        or (actor.pk == row.nominator_id and row.primary_appointment.status == "ACTIVE")
    ):
        actions.append("cancel")
    return actions


def cancel_locked(row, *, actor, reason, action="CANCEL"):
    if row.status not in CoSupervisorNomination.PENDING_STATUSES:
        raise CoSupervisionConflict(
            "This co-supervisor nomination is no longer pending."
        )
    previous = row.status
    row.status = CoSupervisorNomination.Status.CANCELLED
    row.reason = reason
    row.cancelled_at = timezone.now()
    row.save(update_fields=["status", "reason", "cancelled_at", "updated_at"])
    _workflow(row, actor, action, previous, reason)
    return row


def cancel_primary_pending(primary, *, actor, reason):
    rows = CoSupervisorNomination.objects.select_for_update().filter(
        primary_appointment=primary, status__in=CoSupervisorNomination.PENDING_STATUSES
    )
    for row in rows:
        cancel_locked(
            row, actor=actor, reason=reason, action="SYSTEM_CANCEL_PRIMARY_ENDED"
        )


def end_locked(row, *, actor, outcome, reason):
    if row.status != "ACTIVE":
        raise CoSupervisionConflict(
            "This co-supervisor appointment is no longer active."
        )
    row.status = CoSupervisorAppointment.Status.ENDED
    row.end_outcome, row.end_reason, row.ended_at, row.ended_by = (
        outcome,
        reason,
        timezone.now(),
        actor,
    )
    row.save(
        update_fields=[
            "status",
            "end_outcome",
            "end_reason",
            "ended_at",
            "ended_by",
            "updated_at",
        ]
    )
    _lifecycle(
        row, actor, "REPLACED" if outcome == "REPLACED" else "ENDED", "ACTIVE", reason
    )
    # A directly closed predecessor cannot leave a pending nomination claiming its slot.
    if outcome != "REPLACED":
        for pending in row.replacement_nominations.select_for_update().filter(
            status__in=CoSupervisorNomination.PENDING_STATUSES
        ):
            cancel_locked(
                pending,
                actor=actor,
                reason="The co-supervisor appointment selected for replacement was ended.",
                action="SYSTEM_CANCEL_PREDECESSOR_ENDED",
            )
    for recipient in [row.supervisor, row.student.user]:
        is_student = recipient.pk == row.student.user_id
        publish_workflow_notification(
            recipient=recipient,
            actor=actor,
            event_key=f"co-supervisor-appointment:{row.pk}:ended",
            title="Supporting supervisor appointment ended" if is_student else "Co-supervisor appointment ended",
            summary=f"{row.supervisor.full_name}'s supporting appointment has ended." if is_student else f"{row.student.user.full_name}: {row.get_end_outcome_display()}.",
            message="Your updated supporting appointment record is available in My supervisors." if is_student else reason,
            module_label="Supervisor Appointments",
            target_module="SUPERVISOR_APPOINTMENTS",
            record_type="CO_SUPERVISOR_APPOINTMENT",
            record_id=row.pk,
        )
    return row


@transaction.atomic
def decide(*, nomination_id, actor, action, reason=""):
    from .capacity_reassessment import lock_policy_semesters, capacity_semester, consume, assert_not_archived
    lock_policy_semesters()
    ref = CoSupervisorNomination.objects.only("student_id").get(pk=nomination_id)
    student = (
        Student.objects.select_for_update()
        .select_related("user")
        .get(pk=ref.student_id)
    )
    row = (
        CoSupervisorNomination.objects.select_for_update(of=("self",))
        .select_related(
            "student__user",
            "candidate",
            "nominator",
            "primary_appointment",
            "academic_semester",
            "replaces_appointment",
        )
        .get(pk=nomination_id)
    )
    try:
        assert_not_archived(row)
    except CapacityConflict as exc:
        raise CoSupervisionConflict(str(exc)) from exc
    if action not in {"accept", "reject", "approve", "coordinator-reject", "cancel"}:
        raise ValueError("Unknown nomination action.")
    # Authorize actor separately from stale state so retries receive a conflict.
    authorized = (
        (action in {"accept", "reject"} and actor.pk == row.candidate_id)
        or (
            action in {"approve", "coordinator-reject"}
            and coordinator_manages_programme(actor, student.programme)
        )
        or (
            action == "cancel"
            and (actor.role == User.Role.OFFICE_ADMIN or actor.pk == row.nominator_id)
        )
    )
    if not authorized:
        raise CoSupervisionForbidden(
            "This nomination decision is outside your role or programme scope."
        )
    if action not in allowed_actions(row, actor):
        raise CoSupervisionConflict(
            "This decision is no longer available for the nomination."
        )
    reason = str(reason or "").strip()
    if action in {"reject", "coordinator-reject", "cancel"} and not reason:
        raise ValueError("A decision reason is required.")
    if action == "cancel":
        return cancel_locked(row, actor=actor, reason=reason)
    previous = row.status
    now = timezone.now()
    if action in {"accept", "approve"}:
        list(
            Lecturer.objects.select_for_update()
            .filter(pk__in=[row.candidate_id, row.nominator_id])
            .order_by("pk")
        )
        row.candidate = User.objects.get(pk=row.candidate_id)
        primary = active_primary(student)
        if primary is None or primary.pk != row.primary_appointment_id:
            raise CoSupervisionConflict(
                "The originating primary supervisor appointment has ended."
            )
        try:
            assessed_semester = capacity_semester(row)
        except CapacityConflict as exc:
            raise CoSupervisionConflict(str(exc)) from exc
        capacity_result = _check_candidate(
            student=student,
            candidate=row.candidate,
            primary=primary,
            semester=assessed_semester,
            exclude_nomination=row.pk,
            replaces=row.replaces_appointment,
        )
    if action in {"approve", "coordinator-reject"} and not coordinator_manages_programme(
        actor, student.programme, lock=True,
    ):
        raise CoSupervisionForbidden("Your authority for this programme is no longer active.")
    if action == "accept":
        row.status, row.candidate_decided_at = "PENDING_COORDINATOR", now
    elif action == "reject":
        row.status, row.candidate_decided_at = "REJECTED_BY_CO_SUPERVISOR", now
    elif action == "coordinator-reject":
        row.status, row.coordinator_decided_at = "REJECTED_BY_COORDINATOR", now
    else:
        if row.replaces_appointment:
            end_locked(
                row.replaces_appointment,
                actor=actor,
                outcome="REPLACED",
                reason=row.justification,
            )
        row.status, row.coordinator_decided_at = "APPROVED", now
        appointment = CoSupervisorAppointment.objects.create(
            nomination=row,
            student=student,
            supervisor=row.candidate,
            approved_by=actor,
            supersedes=row.replaces_appointment,
        )
        _lifecycle(appointment, actor, "ACTIVATED")
        publish_workflow_notification(
            recipient=student.user,
            actor=actor,
            event_key=f"co-supervisor-appointment:{appointment.pk}:activated",
            title="Supporting supervisor appointed",
            summary=f"{row.candidate.full_name} is now your supporting supervisor.",
            message="Your confirmed supporting appointment is available in My supervisors.",
            module_label="Supervisor Appointments",
            target_module="SUPERVISOR_APPOINTMENTS",
            record_type="CO_SUPERVISOR_APPOINTMENT",
            record_id=appointment.pk,
        )
        # Snapshot the checked policy before the new appointment changes workload.
        consume(row, actor, capacity_result)
    row.reason = reason if action in {"reject", "coordinator-reject"} else ""
    row.save(
        update_fields=[
            "status",
            "candidate_decided_at",
            "coordinator_decided_at",
            "reason",
            "updated_at",
        ]
    )
    _workflow(row, actor, action.upper().replace("-", "_"), previous, row.reason)
    if action == "approve":
        from .capacity_closure import close_capacity_full_requests
        close_capacity_full_requests(supervisor=row.candidate, actor=actor)
    return row


@transaction.atomic
def end_appointment(*, appointment_id, actor, reason, outcome):
    ref = CoSupervisorAppointment.objects.only("student_id").get(pk=appointment_id)
    student = Student.objects.select_for_update().get(pk=ref.student_id)
    row = CoSupervisorAppointment.objects.select_for_update().get(pk=appointment_id)
    if not can_manage(actor, student, lock=True):
        raise CoSupervisionForbidden(
            "This appointment is outside your lifecycle management scope."
        )
    reason = str(reason or "").strip()
    if not reason:
        raise ValueError("A lifecycle reason is required.")
    if outcome not in {"COMPLETED", "WITHDRAWN", "OTHER"}:
        raise ValueError("Select Completed, Withdrawn, or Other for direct closure.")
    return end_locked(row, actor=actor, outcome=outcome, reason=reason)


def person(user):
    return {"id": user.pk, "name": user.full_name}


def iso(value):
    return value.isoformat() if value else None


def serialize_event(event):
    return {
        "id": event.pk,
        "action": event.action,
        "actor": event.actor.full_name,
        "actorRole": event.actor_role,
        "previousStatus": event.previous_status,
        "newStatus": event.new_status,
        "reason": event.reason,
        "createdAt": iso(event.created_at),
    }


def waiting_metadata(row):
    since = (
        row.submitted_at
        if row.status == "SUBMITTED_TO_CO_SUPERVISOR"
        else row.candidate_decided_at if row.status == "PENDING_COORDINATOR" else None
    )
    stage = (
        "CO_SUPERVISOR"
        if row.status == "SUBMITTED_TO_CO_SUPERVISOR"
        else "PROGRAMME_COORDINATOR" if row.status == "PENDING_COORDINATOR" else None
    )
    return {
        "waitingSince": iso(since),
        "waitingDays": elapsed_calendar_days(since),
        "responsibleStage": stage,
        "waitingOn": stage,
    }


def serialize_nomination(row, actor):
    if actor.role == User.Role.STUDENT:
        raise CoSupervisionForbidden("Supporting nominations are staff workflow records.")
    return {
        "id": row.pk,
        "studentId": row.student_id,
        "matricNo": row.student.matric_no,
        "studentName": row.student.user.full_name,
        "programme": row.student.programme,
        "candidate": person(row.candidate),
        "nominator": person(row.nominator),
        "status": row.status,
        "justification": row.justification,
        "reason": row.reason,
        "submittedAt": iso(row.submitted_at),
        "decidedAt": iso(
            row.cancelled_at or row.coordinator_decided_at or row.candidate_decided_at
        ),
        "academicSemesterId": row.academic_semester_id,
        "semester": row.academic_semester.label if row.academic_semester_id else "",
        "primaryAppointmentId": row.primary_appointment_id,
        "replacesAppointmentId": row.replaces_appointment_id,
        "allowedActions": allowed_actions(row, actor),
        "history": [serialize_event(event) for event in row.workflow_events.all()],
        **waiting_metadata(row),
    }


def serialize_appointment(row, actor):
    return {
        "id": row.pk,
        "studentId": row.student_id,
        "matricNo": row.student.matric_no,
        "studentName": row.student.user.full_name,
        "programme": row.student.programme,
        "supervisor": {**person(row.supervisor), "email": row.supervisor.email, "department": getattr(getattr(row.supervisor, "lecturer", None), "department", "")},
        "status": row.status,
        "appointmentDate": iso(row.appointment_date),
        "endOutcome": row.end_outcome,
        "endReason": "" if actor.role == User.Role.STUDENT else row.end_reason,
        "endedAt": iso(row.ended_at),
        "supersedesId": row.supersedes_id,
        "nominationId": None if actor.role == User.Role.STUDENT else row.nomination_id,
        "canEnd": row.status == "ACTIVE" and can_manage(actor, row.student),
        "history": [] if actor.role == User.Role.STUDENT else [serialize_event(event) for event in row.lifecycle_events.all()],
    }


def supervision_panel_summary(student, actor, profile, primary):
    from .panel_access import can_view_panel_recommendation

    current = profile.panel_appointments.filter(status="ACTIVE").select_related(
        "panel_member__lecturer", "recommendation__profile"
    ).first() if profile else None
    pending = profile.panel_recommendations.filter(
        status__in=PanelRecommendation.PENDING_STATUSES
    ).select_related("profile", "recommended_member").order_by("-submitted_at", "-pk").first() if profile else None
    eligible = bool(profile and primary and primary.supervisor_id == actor.pk
        and profile.supervisor_id == actor.pk and profile.student_id == student.user_id
        and student_is_workflow_eligible(student) and user_is_assignable_lecturer(actor)
        and current_effective_semester() and not pending)
    return {
        "current": {
            "member": person(current.panel_member), "email": current.panel_member.email,
            "department": getattr(getattr(current.panel_member, "lecturer", None), "department", ""),
            "appointmentDate": iso(current.appointment_date),
            "requestId": current.recommendation_id,
            "recordKey": f"appointment-{current.pk}",
            "canView": can_view_panel_recommendation(actor, current.recommendation),
        } if current else None,
        "pending": {"id": pending.pk, "status": pending.status, "recordKey": f"recommendation-{pending.pk}",
            "member": person(pending.recommended_member) if can_view_panel_recommendation(actor, pending) else None,
            "replacement": bool(pending.replaces_appointment_id),
            "canView": can_view_panel_recommendation(actor, pending)} if pending else None,
        "canRecommend": eligible and current is None,
        "canReplace": eligible and current is not None,
    }


def serialize_team(student, actor, *, include_details=False):
    if not can_read_team(actor, student):
        raise CoSupervisionForbidden(
            "This student is outside your current supervisory team access."
        )
    primary = active_primary(student)
    profile = StudentResearchProfile.objects.filter(
        Q(student_id=student.user_id) | Q(matric_no__iexact=student.matric_no)
    ).first()
    nominations = [
        serialize_nomination(row, actor)
        for row in (nominations_queryset().none() if actor.role == User.Role.STUDENT else nominations_queryset().filter(student=student))
    ]
    appointments = [
        serialize_appointment(row, actor)
        for row in appointments_queryset().filter(student=student)
    ]
    timeline = []
    for kind, rows in [("nomination", nominations), ("appointment", appointments)]:
        for row in rows:
            for event in row["history"]:
                timeline.append(
                    {
                        "id": f"co-{kind}-{row['id']}-event-{event['id']}",
                        "title": "Co-supervisor: "
                        + event["action"].replace("_", " ").title(),
                        "date": event["createdAt"],
                        "status": event["newStatus"],
                    }
                )
    for row in routine_supervisor_requests(student.supervisor_applications.all(), actor):
        timeline.append(
            {
                "id": f"primary-workflow-{row.pk}",
                "title": "Primary supervisor application",
                "date": iso(row.updated_at),
                "status": row.status,
            }
        )
    if profile and actor.role == User.Role.STUDENT:
        timeline.extend(student_panel_timeline(profile))
    elif profile:
        for row in profile.panel_recommendations.all():
            timeline.append(
                {
                    "id": f"panel-workflow-{row.pk}",
                    "title": "Panel recommendation",
                    "date": iso(row.updated_at),
                    "status": row.status,
                }
            )
    from dashboard.models import SemesterTimelineEntry
    from dashboard.serializers import TimelineEntrySerializer

    semester = current_effective_semester()
    if semester:
        for entry in SemesterTimelineEntry.objects.filter(
            timeline__academic_semester=semester, timeline__is_active=True,
            marks_period__isnull=True,
        ).select_related('operational_period'):
            if "STUDENT" in entry.target_roles:
                timeline.append(
                    {
                        "id": f"timeline-{entry.pk}",
                        "title": entry.title or entry.detail,
                        "date": iso(entry.projected_dates[1]),
                        "status": TimelineEntrySerializer().get_status(entry),
                    }
                )
    timeline.sort(key=lambda event: (event["date"] or "", event["id"]))
    result = {
        "studentId": student.pk,
        "matricNo": student.matric_no,
        "studentName": student.user.full_name,
        "programme": student.programme,
        "studentStatus": student.status,
        "primarySupervisor": person(primary.supervisor) if primary else None,
        "primaryAppointmentId": primary.pk if primary else None,
        "research": {
            "title": profile.proposed_topic if profile else "",
            "area": profile.research_area if profile else "",
            "abstract": profile.abstract if profile else "",
        },
        "appointments": appointments,
        "nominations": nominations,
        "canNominate": can_nominate(actor, student),
        "timeline": timeline,
    }
    result["primaryAppointmentDetails"] = {
        "email": primary.supervisor.email,
        "department": getattr(getattr(primary.supervisor, "lecturer", None), "department", ""),
        "appointmentDate": iso(primary.appointment_date),
        "semester": primary.application.academic_semester.label if primary.application.academic_semester_id else "Legacy / Unassigned",
    } if primary else None
    from .research_amendments import assert_no_pending_transfer, AmendmentConflict
    pending_primary = student.supervisor_applications.filter(status__in=[
        "SUBMITTED_TO_SUPERVISOR", "PENDING_COORDINATOR"
    ]).select_related("proposed_supervisor").order_by("-submitted_at", "-pk").first()
    can_change = bool(actor.role == User.Role.OFFICE_ADMIN and actor.is_active
                      and primary and student_is_workflow_eligible(student) and not pending_primary)
    if can_change:
        try:
            assert_no_pending_transfer(student.pk)
        except AmendmentConflict:
            can_change = False
    result["canChangePrimarySupervisor"] = can_change
    result["pendingPrimaryReplacement"] = {
        "applicationId": pending_primary.pk, "status": pending_primary.status,
        "supervisorName": pending_primary.proposed_supervisor.full_name,
    } if pending_primary and pending_primary.replaces_appointment_id else None
    if include_details and actor.role in {User.Role.OFFICE_ADMIN, User.Role.COORDINATOR, User.Role.LECTURER}:
        application = primary.application if primary else None
        result["approvedApplicationId"] = application.pk if (
            application and application.student_id == student.pk
            and application.status == SupervisorApplication.Status.APPROVED
            and can_view_supervisor_application(actor, application)
        ) else None
        result["studentEmail"] = student.user.email
        result["panel"] = supervision_panel_summary(student, actor, profile, primary)
    return result


def workspace(actor):
    students = visible_students(actor)
    ids = list(students.values_list("pk", flat=True))
    nominations = (
        nominations_queryset()
        .filter(Q(student_id__in=ids) | Q(candidate=actor) | Q(nominator=actor))
        .distinct()
    )
    if actor.role == User.Role.STUDENT:
        nominations = nominations.none()
    appointments = (
        appointments_queryset()
        .filter(Q(student_id__in=ids) | Q(supervisor=actor))
        .distinct()
    )
    return {
        "teams": [serialize_team(student, actor) for student in students],
        "nominations": [serialize_nomination(row, actor) for row in nominations],
        "appointments": [serialize_appointment(row, actor) for row in appointments],
    }


def candidates(*, student, actor):
    if not can_nominate(actor, student, check_pending=False):
        raise CoSupervisionForbidden(
            "Only the active primary supervisor can select candidates."
        )
    semester = current_effective_semester()
    if semester is None:
        raise CoSupervisionConflict("An effective academic semester is required.")
    primary = active_primary(student)
    rows = []
    for user in (
        User.objects.filter(role=User.Role.LECTURER, lecturer__supervisor__isnull=False)
        .select_related("lecturer")
        .order_by("full_name", "pk")
    ):
        capacity = resolve_lecturer_capacity(
            user=user, semester=semester, role=CapacityRole.SUPERVISOR
        )
        conflict = ""
        # Team-space limits depend on whether the caller chooses a replacement.
        try:
            _check_candidate(
                student=student,
                candidate=user,
                primary=primary,
                semester=semester,
                check_positions=False,
            )
        except CoSupervisionConflict as exc:
            conflict = str(exc)
        rows.append(
            {
                **person(user),
                "staffId": user.lecturer.staff_no,
                "department": user.lecturer.department,
                "selectable": not conflict,
                "capacityState": capacity.state,
                "activeLoad": capacity.active_load,
                "reservedLoad": capacity.reserved_load,
                "pendingRequests": capacity.pending_requests,
                "availableSlots": capacity.available_slots,
                "limit": capacity.limit,
                "unavailableUntil": iso(capacity.unavailable_until),
                "reason": conflict,
            }
        )
    return rows
