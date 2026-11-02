from .request_visibility import can_view_supervisor_application, routine_supervisor_requests
from .supervisor_replacement import is_office_replacement, assert_current_predecessor
from .capacity_reassessment import lock_request, assert_not_archived, ReassessmentConflict
from .capacity_closure import acceptance_capacity, supervisor_workload_summary
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import OuterRef, Q, Subquery
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from announcements.models import Notification
from accounts.authorization import (
    coordinator_programme, coordinator_programmes, coordinator_scope_q,
    coordinator_manages_programme, programme_coordinators,
)
from accounts.eligibility import (
    profile_student_is_workflow_eligible,
    student_is_workflow_eligible,
    user_is_assignable_lecturer,
)
from accounts.models import Lecturer, Student
from academics.capacity import (
    CapacityConflict,
    CapacityRole,
    CapacityState,
    assert_capacity_allows_assignment,
    resolve_lecturer_capacity,
)
from academics.services import current_effective_semester

from .ageing import panel_waiting_metadata, supervisor_waiting_metadata
from .role_integrity import (
    AppointmentRoleConflict,
    assert_no_primary_role,
    panel_role_candidate_ids,
)
from .models import (
    AppointmentLifecycleEvent,
    AppointmentWorkflowEvent,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorApplicationDocument,
    SupervisorAppointment,
    SupervisorDocumentRequirement,
    SupervisorDocumentRequirementAudit,
    count_supervisor_workload,
)
from .appointment_lifecycle import (
    AppointmentLifecycleConflict,
    AppointmentLifecycleForbidden,
    activate_replacement,
    end_appointment,
)
from .notifications import publish_workflow_notification
from .panel_access import (can_view_panel_recommendation, coordinator_can_decide_panel,
                           coordinator_panel_scope_q)
from .serializers import (
    PanelAssignmentSerializer,
    PanelCandidateSerializer,
    PanelRecommendationCreateSerializer,
    PanelRecommendationSerializer,
    ReasonSerializer,
    AppointmentWorkflowEventSerializer,
    SupervisorApplicationCreateSerializer,
    SupervisorApplicationDocumentSerializer,
    SupervisorApplicationSerializer,
    SupervisorCandidateSerializer,
    SupervisorDocumentRequirementSerializer,
    SupervisorDocumentRequirementUpdateSerializer,
    SupervisorDocumentRequirementWriteSerializer,
    StudentPanelAppointmentSerializer,
    StudentResearchProfileSerializer,
    department_for_user,
    format_display_date,
    pending_student_panel_payload_from_user,
    staff_no_for_user,
    student_panel_appointment_payload,
)
from .supervisor_documents import (
    DocumentRequirementsNotConfigured,
    create_requirement,
    update_requirement,
    validate_application_documents,
)
from .supervisor_handoff import (
    SupervisorApprovalConflict,
    SupervisorApprovalForbidden,
    approve_supervisor_application,
)

User = get_user_model()


def participant_ineligible_response():
    return error_response(
        "The student's lifecycle status temporarily prevents workflow decisions.",
        status.HTTP_409_CONFLICT,
    )


def workflow_semester_payload(record):
    semester = getattr(record, "academic_semester", None)
    return {
        "semester": semester.label if semester else "Legacy / Unassigned",
        "semesterId": semester.pk if semester else None,
        "semesterCode": semester.code if semester else None,
    }


def panel_record_from_appointment(appointment):
    panel_member = appointment.panel_member
    recommendation = appointment.recommendation
    return {
        "recordId": f"appointment-{appointment.pk}",
        "recommendation": PanelRecommendationSerializer(recommendation).data,
        "recommendationId": recommendation.pk,
        "id": appointment.profile.matric_no,
        "studentName": appointment.profile.student_name,
        "programme": appointment.profile.programme,
        **workflow_semester_payload(recommendation),
        "researchTitle": appointment.profile.proposed_topic,
        "researchArea": appointment.profile.research_area,
        "abstract": appointment.profile.abstract,
        "supervisor": appointment.supervisor.full_name,
        "panelMember": panel_member.full_name,
        "panelMemberId": staff_no_for_user(panel_member),
        "panelMemberDepartment": department_for_user(panel_member),
        "panelMemberEmail": panel_member.email,
        "appointmentDate": format_display_date(appointment.appointment_date),
        "recommendationSubmittedAt": recommendation.submitted_at,
        "panelDecisionAt": recommendation.panel_decided_at,
        "coordinatorDecisionAt": recommendation.coordinator_decided_at,
        "appointmentConfirmedAt": recommendation.coordinator_decided_at
        or appointment.created_at,
        "rejectionStage": None,
        "rejectionReason": "",
        "workflow": AppointmentWorkflowEventSerializer(
            appointment.recommendation.workflow_events.all(),
            many=True,
        ).data,
        "status": (
            "Approved"
            if appointment.status == PanelAppointment.Status.ACTIVE
            else "Ended"
        ),
        "updatedDate": appointment.updated_at.strftime("%d %b %Y"),
        "appointmentLifecycle": appointment_lifecycle_payload(appointment),
        **panel_waiting_metadata(recommendation),
    }


def panel_record_from_recommendation(recommendation):
    if recommendation.status == PanelRecommendation.Status.SUBMITTED_TO_PANEL:
        display_status = "Recommendation"
    elif recommendation.status == PanelRecommendation.Status.PENDING_COORDINATOR:
        display_status = "Pending"
    elif recommendation.status in [
        PanelRecommendation.Status.REJECTED_BY_PANEL,
        PanelRecommendation.Status.REJECTED_BY_COORDINATOR,
    ]:
        display_status = "Rejected"
    elif recommendation.status in [
        PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR,
        PanelRecommendation.Status.CANCELLED_BY_OFFICE,
        PanelRecommendation.Status.CANCELLED_CAPACITY_FULL,
    ]:
        display_status = "Cancelled"
    else:
        display_status = "Approved"

    rejection_stage = None
    if recommendation.status == PanelRecommendation.Status.REJECTED_BY_PANEL:
        rejection_stage = "Selected Panel"
    elif recommendation.status == PanelRecommendation.Status.REJECTED_BY_COORDINATOR:
        rejection_stage = "Programme Coordinator"

    return {
        "recordId": f"recommendation-{recommendation.pk}",
        "recommendation": PanelRecommendationSerializer(recommendation).data,
        "recommendationId": recommendation.pk,
        "id": recommendation.profile.matric_no,
        "studentName": recommendation.profile.student_name,
        "programme": recommendation.profile.programme,
        **workflow_semester_payload(recommendation),
        "researchTitle": recommendation.profile.proposed_topic,
        "researchArea": recommendation.profile.research_area,
        "abstract": recommendation.profile.abstract,
        "supervisor": recommendation.supervisor.full_name,
        "panelMember": recommendation.recommended_member.full_name,
        "panelMemberId": staff_no_for_user(recommendation.recommended_member),
        "panelMemberDepartment": department_for_user(recommendation.recommended_member),
        "panelMemberEmail": recommendation.recommended_member.email,
        "appointmentDate": "",
        "recommendationSubmittedAt": recommendation.submitted_at,
        "panelDecisionAt": recommendation.panel_decided_at,
        "coordinatorDecisionAt": recommendation.coordinator_decided_at,
        "cancelledAt": recommendation.cancelled_at,
        "appointmentConfirmedAt": None,
        "rejectionStage": rejection_stage,
        "rejectionReason": recommendation.display_rejection_reason,
        "cancellationReason": recommendation.cancellation_reason,
        "workflow": AppointmentWorkflowEventSerializer(
            recommendation.workflow_events.all(),
            many=True,
        ).data,
        "status": display_status,
        "updatedDate": recommendation.updated_at.strftime("%d %b %Y"),
        **panel_waiting_metadata(recommendation),
    }


def panel_record_from_profile(profile):
    return {
        "recordId": f"profile-{profile.pk}",
        "recommendationId": None,
        "id": profile.matric_no,
        "studentName": profile.student_name,
        "programme": profile.programme,
        "semester": "Legacy / Unassigned",
        "semesterId": None,
        "semesterCode": None,
        "researchTitle": profile.proposed_topic,
        "researchArea": profile.research_area,
        "abstract": profile.abstract,
        "supervisor": profile.supervisor.full_name,
        "panelMember": "Not Assigned",
        "panelMemberId": "",
        "panelMemberDepartment": "",
        "panelMemberEmail": "",
        "appointmentDate": "",
        "recommendationSubmittedAt": None,
        "panelDecisionAt": None,
        "coordinatorDecisionAt": None,
        "appointmentConfirmedAt": None,
        "rejectionStage": None,
        "rejectionReason": "",
        "workflow": [],
        "status": "No Panel",
        "updatedDate": profile.updated_at.strftime("%d %b %Y"),
        "waitingSince": None,
        "waitingDays": None,
        "waitingOn": None,
    }


def initials_for_name(name):
    return "".join(part[0] for part in name.split()[:2]).upper()


def panel_workload_availability(count, limit):
    if count >= limit:
        return "Full Load"
    if count >= max(limit - 1, 1):
        return "Near Limit"
    return "Available"


def capacity_workload_payload(*, lecturer, academic_semester, role, fallback_load):
    if academic_semester is None:
        from academics.capacity import _workloads
        active, reserved = _workloads(user=lecturer, role=role)
        pending = SupervisorApplication.objects.filter(proposed_supervisor=lecturer, status="SUBMITTED_TO_SUPERVISOR").count() if role == CapacityRole.SUPERVISOR else 0
        return {
            "semesterId": None,
            "semesterCode": None,
            "capacityPlanId": None,
            "capacityPlanVersion": None,
            "capacityState": CapacityState.NOT_CONFIGURED,
            "workloadCount": active + reserved,
            "activeLoad": active,
            "reservedLoad": reserved,
            "pendingRequests": pending,
            "workloadLimit": 0,
            "availableSlots": 0,
            "selectable": False,
            "unavailableUntil": None,
        }
    resolution = resolve_lecturer_capacity(
        user=lecturer,
        semester=academic_semester,
        role=role,
    )
    return {
        "semesterId": resolution.semester_id,
        "semesterCode": academic_semester.code,
        "capacityPlanId": resolution.plan_id,
        "capacityPlanVersion": resolution.plan_version,
        "capacityState": resolution.state,
        "workloadCount": resolution.active_load + resolution.reserved_load,
        "activeLoad": resolution.active_load,
        "reservedLoad": resolution.reserved_load,
        "pendingRequests": resolution.pending_requests,
        "workloadLimit": resolution.limit or 0,
        "availableSlots": resolution.available_slots,
        "selectable": resolution.state == CapacityState.AVAILABLE,
        "unavailableUntil": (
            resolution.unavailable_until.isoformat()
            if resolution.unavailable_until is not None
            else None
        ),
    }


def supervisor_workload_row(lecturer, academic_semester=None):
    active_appointments = list(
        SupervisorAppointment.objects.filter(
            supervisor=lecturer,
            status=SupervisorAppointment.Status.ACTIVE,
        ).select_related(
            "student",
            "student__user",
            "application",
        )
    )
    from .models import CoSupervisorAppointment

    supporting = list(
        CoSupervisorAppointment.objects.filter(
            supervisor=lecturer, status="ACTIVE"
        ).select_related(
            "student__user", "nomination__primary_appointment__application"
        )
    )
    capacity = capacity_workload_payload(
        lecturer=lecturer,
        academic_semester=academic_semester,
        role=CapacityRole.SUPERVISOR,
        fallback_load=len(active_appointments) + len(supporting),
    )
    workload_count = capacity["workloadCount"]
    workload_limit = capacity["workloadLimit"]
    return {
        "lecturerId": staff_no_for_user(lecturer),
        "lecturerName": lecturer.full_name,
        "department": department_for_user(lecturer),
        "currentStudents": capacity["activeLoad"],
        "workloadLimit": workload_limit,
        "availability": panel_workload_availability(
            workload_count,
            workload_limit,
        ),
        "email": lecturer.email,
        **capacity,
        "supervisees": [
            {
                "id": appointment.student.matric_no,
                "name": appointment.student.user.full_name,
                "programme": appointment.student.programme,
                "status": "Approved",
                "topic": appointment.application.research_title,
                "appointmentDate": format_display_date(appointment.appointment_date),
                "supervisionRole": "PRIMARY",
            }
            for appointment in active_appointments
        ]
        + [
            {
                "id": appointment.student.matric_no,
                "name": appointment.student.user.full_name,
                "programme": appointment.student.programme,
                "status": "Approved",
                "topic": appointment.nomination.primary_appointment.application.research_title,
                "appointmentDate": format_display_date(appointment.appointment_date),
                "supervisionRole": "CO_SUPERVISOR",
            }
            for appointment in supporting
        ],
    }


def panel_workload_row(lecturer, academic_semester=None):
    confirmed_appointments = list(
        PanelAppointment.objects.filter(
            panel_member=lecturer,
            status=PanelAppointment.Status.ACTIVE,
        ).select_related("profile")
    )
    pending_nominations = list(
        PanelRecommendation.objects.filter(
            recommended_member=lecturer,
            status__in=PanelRecommendation.WORKLOAD_RESERVED_STATUSES,
        ).select_related("profile")
    )
    capacity = capacity_workload_payload(
        lecturer=lecturer,
        academic_semester=academic_semester,
        role=CapacityRole.PANEL,
        fallback_load=len(confirmed_appointments) + len(pending_nominations),
    )
    workload_count = capacity["workloadCount"]
    workload_limit = capacity["workloadLimit"]
    workload_items = [
        {
            "type": "Confirmed Appointment",
            "studentName": appointment.profile.student_name,
            "studentId": appointment.profile.matric_no,
            "researchTitle": appointment.profile.proposed_topic,
            "date": format_display_date(appointment.appointment_date),
        }
        for appointment in confirmed_appointments
    ] + [
        {
            "type": "Pending Nomination",
            "studentName": recommendation.profile.student_name,
            "studentId": recommendation.profile.matric_no,
            "researchTitle": recommendation.profile.proposed_topic,
            "date": format_display_date(
                recommendation.submitted_at or recommendation.updated_at
            ),
        }
        for recommendation in pending_nominations
    ]
    return {
        "id": staff_no_for_user(lecturer),
        "name": lecturer.full_name,
        "department": department_for_user(lecturer),
        "currentStudents": workload_count,
        "workloadLimit": workload_limit,
        "availability": panel_workload_availability(workload_count, workload_limit),
        "initials": initials_for_name(lecturer.full_name),
        **capacity,
        "confirmedAppointments": len(confirmed_appointments),
        "pendingNominations": len(pending_nominations),
        "workloadItems": workload_items,
    }


def error_response(message, response_status=status.HTTP_400_BAD_REQUEST):
    return Response({"error": message}, status=response_status)


def lifecycle_event_payload(event):
    return {
        "id": event.pk,
        "action": event.action,
        "actorName": event.actor.full_name,
        "actorRole": event.actor_role,
        "previousStatus": event.previous_status,
        "newStatus": event.new_status,
        "outcome": event.outcome or None,
        "reason": event.reason or None,
        "createdAt": event.created_at,
    }


def appointment_lifecycle_payload(appointment):
    replacement = getattr(appointment, "replacement_appointment", None)
    return {
        "appointmentId": appointment.pk,
        "status": appointment.status,
        "endOutcome": appointment.end_outcome or None,
        "endReason": appointment.end_reason or None,
        "endedAt": appointment.ended_at,
        "endedBy": appointment.ended_by.full_name if appointment.ended_by else None,
        "supersedesAppointmentId": appointment.supersedes_id,
        "replacementAppointmentId": replacement.pk if replacement else None,
        "lifecycle": [
            lifecycle_event_payload(event)
            for event in appointment.lifecycle_events.select_related("actor")
        ],
    }


def _end_appointment_response(request, pk, model):
    outcome = str(request.data.get("outcome") or "").strip().upper()
    reason = str(request.data.get("reason") or "").strip()
    try:
        appointment = end_appointment(
            model=model,
            appointment_id=pk,
            actor=request.user,
            outcome=outcome,
            reason=reason,
        )
    except model.DoesNotExist:
        return error_response("Appointment was not found.", status.HTTP_404_NOT_FOUND)
    except AppointmentLifecycleForbidden as exc:
        return error_response(str(exc), status.HTTP_403_FORBIDDEN)
    except AppointmentLifecycleConflict as exc:
        valid_direct_outcomes = {
            model.EndOutcome.COMPLETED,
            model.EndOutcome.WITHDRAWN,
            model.EndOutcome.OTHER,
        }
        response_status = (
            status.HTTP_400_BAD_REQUEST
            if outcome not in valid_direct_outcomes or not reason
            else status.HTTP_409_CONFLICT
        )
        return error_response(str(exc), response_status)
    appointment.refresh_from_db()
    return Response(appointment_lifecycle_payload(appointment))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def end_supervisor_appointment_view(request, pk):
    return _end_appointment_response(request, pk, SupervisorAppointment)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def end_panel_appointment_view(request, pk):
    return _end_appointment_response(request, pk, PanelAppointment)


def record_workflow_event(
    *,
    actor,
    action,
    previous_status,
    new_status,
    reason="",
    panel_recommendation=None,
    supervisor_application=None,
):
    event = AppointmentWorkflowEvent.objects.create(
        actor=actor,
        actor_role=actor.role,
        action=action,
        previous_status=previous_status,
        new_status=new_status,
        reason=reason,
        panel_recommendation=panel_recommendation,
        supervisor_application=supervisor_application,
    )
    # Mutations must not serialize history prefetched before this event existed.
    for record in (panel_recommendation, supervisor_application):
        if record is not None:
            getattr(record, "_prefetched_objects_cache", {}).pop("workflow_events", None)
    return event


def notify_workflow(
    *,
    recipients,
    actor,
    event_key,
    title,
    summary,
    message,
    module_label,
    target_module,
    record_type,
    record_id,
    priority=Notification.Priority.NORMAL,
):
    for recipient in recipients:
        publish_workflow_notification(
            recipient=recipient,
            actor=actor,
            event_key=event_key,
            title=title,
            summary=summary,
            message=message,
            module_label=module_label,
            target_module=target_module,
            record_type=record_type,
            record_id=record_id,
            priority=priority,
        )


def get_recommendation_or_404(pk):
    try:
        return PanelRecommendation.objects.select_related(
            "profile__student__student", "supervisor", "recommended_member"
        ).get(pk=pk)
    except PanelRecommendation.DoesNotExist:
        return None


def coordinator_can_access_recommendation(user, recommendation, *, lock=False):
    return coordinator_can_decide_panel(user, recommendation, lock=lock)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def panel_records_view(request):
    if request.user.role != User.Role.OFFICE_ADMIN:
        return error_response(
            "Only Office Staff/Admin can view panel records.",
            status.HTTP_403_FORBIDDEN,
        )

    appointments = list(
        PanelAppointment.objects.select_related(
            "profile", "supervisor", "panel_member", "recommendation"
        ).prefetch_related("recommendation__workflow_events__actor")
    )
    appointment_recommendation_ids = {
        appointment.recommendation_id for appointment in appointments
    }
    recommendations = list(
        PanelRecommendation.objects.select_related(
            "profile", "supervisor", "recommended_member"
        )
        .prefetch_related("workflow_events__actor")
        .exclude(pk__in=appointment_recommendation_ids)
    )

    workflow_records = [
        (appointment.updated_at, panel_record_from_appointment(appointment))
        for appointment in appointments
    ] + [
        (recommendation.updated_at, panel_record_from_recommendation(recommendation))
        for recommendation in recommendations
    ]
    workflow_records.sort(key=lambda item: item[0], reverse=True)

    profiles_with_workflow = {
        appointment.profile_id for appointment in appointments
    } | {recommendation.profile_id for recommendation in recommendations}
    no_panel_profiles = (
        StudentResearchProfile.objects.select_related("supervisor")
        .exclude(pk__in=profiles_with_workflow)
        .order_by("student_name")
    )
    records = [record for _, record in workflow_records]
    records.extend(panel_record_from_profile(profile) for profile in no_panel_profiles)

    return Response(records)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def panel_workload_view(request):
    if request.user.role != User.Role.OFFICE_ADMIN:
        return error_response(
            "Only Office Staff/Admin can view panel workload monitoring.",
            status.HTTP_403_FORBIDDEN,
        )

    academic_semester = current_effective_semester()
    lecturers = User.objects.filter(
        role=User.Role.LECTURER, is_active=True
    ).select_related("lecturer")
    return Response(
        [panel_workload_row(lecturer, academic_semester) for lecturer in lecturers]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_workload_view(request):
    if request.user.role != User.Role.OFFICE_ADMIN:
        return error_response(
            "Only Office Staff/Admin can view supervisor workload monitoring.",
            status.HTTP_403_FORBIDDEN,
        )
    lecturers = (
        User.objects.filter(
            role=User.Role.LECTURER,
            is_active=True,
            lecturer__supervisor__isnull=False,
        )
        .select_related("lecturer", "lecturer__supervisor")
        .order_by("full_name")
    )
    academic_semester = current_effective_semester()
    return Response(
        [supervisor_workload_row(lecturer, academic_semester) for lecturer in lecturers]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def own_supervisor_workload_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view their supervisor workload.",
            status.HTTP_403_FORBIDDEN,
        )
    current_students = count_supervisor_workload(request.user)
    capacity = capacity_workload_payload(
        lecturer=request.user,
        academic_semester=current_effective_semester(),
        role=CapacityRole.SUPERVISOR,
        fallback_load=current_students,
    )
    return Response(
        {
            "currentStudents": capacity["activeLoad"],
            **capacity,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def own_panel_workload_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view their panel workload.",
            status.HTTP_403_FORBIDDEN,
        )
    confirmed_appointments = PanelAppointment.objects.filter(
        panel_member=request.user,
        status=PanelAppointment.Status.ACTIVE,
    ).count()
    pending_nominations = PanelRecommendation.objects.filter(
        recommended_member=request.user,
        status__in=PanelRecommendation.WORKLOAD_RESERVED_STATUSES,
    ).count()
    capacity = capacity_workload_payload(
        lecturer=request.user,
        academic_semester=current_effective_semester(),
        role=CapacityRole.PANEL,
        fallback_load=confirmed_appointments + pending_nominations,
    )
    return Response(
        {
            "currentStudents": capacity["workloadCount"],
            "confirmedAppointments": confirmed_appointments,
            "pendingNominations": pending_nominations,
            **capacity,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def eligible_supervisees_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view eligible supervisees.", status.HTTP_403_FORBIDDEN
        )
    if request.user.lecturer.lifecycle_status != request.user.lecturer.Lifecycle.ACTIVE:
        return Response([])
    active_appointment = SupervisorAppointment.objects.filter(
        student_id=OuterRef("student_id"),
        supervisor=request.user,
        status=SupervisorAppointment.Status.ACTIVE,
    ).order_by("-appointment_date", "-pk")
    profiles = (
        StudentResearchProfile.objects.filter(
            supervisor=request.user,
            student__student__status=Student.Status.ACTIVE,
            student__student__supervisor_appointments__supervisor=request.user,
            student__student__supervisor_appointments__status=SupervisorAppointment.Status.ACTIVE,
        )
        .annotate(
            active_supervisor_appointment_id=Subquery(
                active_appointment.values("pk")[:1]
            )
        )
        .select_related("supervisor", "supervisor__lecturer")
        .distinct()
    )
    return Response(StudentResearchProfileSerializer(profiles, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def panel_candidates_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view panel candidates.", status.HTTP_403_FORBIDDEN
        )
    academic_semester = current_effective_semester()
    if academic_semester is None:
        return Response([])
    lecturers = list(
        User.objects.filter(
            role=User.Role.LECTURER,
            is_active=True,
            lecturer__lifecycle_status=Lecturer.Lifecycle.ACTIVE,
        )
        .select_related("lecturer")
        .exclude(pk=request.user.pk)
    )
    resolutions = {
        lecturer.pk: resolve_lecturer_capacity(
            user=lecturer,
            semester=academic_semester,
            role=CapacityRole.PANEL,
        )
        for lecturer in lecturers
    }
    visible = [
        lecturer
        for lecturer in lecturers
        if resolutions[lecturer.pk].state
        not in {CapacityState.INELIGIBLE, CapacityState.TEMPORARILY_UNAVAILABLE}
    ]
    return Response(
        PanelCandidateSerializer(
            visible,
            many=True,
            context={"capacity_resolutions": resolutions},
        ).data
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_panel_appointment_view(request):
    if request.user.role != User.Role.STUDENT:
        return error_response(
            "Only students can view their panel appointment.", status.HTTP_403_FORBIDDEN
        )

    try:
        profile = StudentResearchProfile.objects.select_related("supervisor").get(
            student=request.user
        )
    except StudentResearchProfile.DoesNotExist:
        serializer = StudentPanelAppointmentSerializer(
            pending_student_panel_payload_from_user(request.user)
        )
        return Response(serializer.data)

    serializer = StudentPanelAppointmentSerializer(
        student_panel_appointment_payload(profile)
    )
    return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def recommendations_view(request):
    if request.method == "GET":
        if request.user.role != User.Role.LECTURER:
            return error_response(
                "Only lecturers can view submitted panel recommendations.",
                status.HTTP_403_FORBIDDEN,
            )
        recommendations = PanelRecommendation.objects.filter(
            supervisor=request.user
        ).select_related(
            "profile", "recommended_member", "recommended_member__lecturer"
        )
        return Response(PanelRecommendationSerializer(recommendations, many=True, context={"request": request}).data)

    serializer = PanelRecommendationCreateSerializer(
        data=request.data, context={"request": request}
    )
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        recommendation = serializer.save()
        record_workflow_event(
            actor=request.user,
            action="SUBMIT",
            previous_status="",
            new_status=recommendation.status,
            panel_recommendation=recommendation,
        )
        notify_workflow(
            recipients=[recommendation.recommended_member],
            actor=request.user,
            event_key=f"panel:{recommendation.pk}:submit",
            title="Panel recommendation requires your review",
            summary=f"{recommendation.profile.student_name} was recommended for your panel review.",
            message="Open Panel Appointments to accept or reject this recommendation.",
            module_label="Panel Appointment",
            target_module="PANEL_APPOINTMENTS",
            record_type="PANEL_RECOMMENDATION",
            record_id=recommendation.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(
        PanelRecommendationSerializer(recommendation).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def panel_recommendation_detail_view(request, pk):
    recommendation = get_recommendation_or_404(pk)
    if recommendation is None:
        return error_response(
            "Panel recommendation was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    if not can_view_panel_recommendation(request.user, recommendation):
        return error_response(
            "You do not have permission to view this recommendation.",
            status.HTTP_403_FORBIDDEN,
        )
    return Response(PanelRecommendationSerializer(recommendation, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def review_queue_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view selected-panel review queues.",
            status.HTTP_403_FORBIDDEN,
        )
    recommendations = PanelRecommendation.objects.filter(
        recommended_member=request.user,
        status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
    ).select_related("profile", "recommended_member", "recommended_member__lecturer")
    return Response(PanelRecommendationSerializer(recommendations, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def coordinator_queue_view(request):
    if request.user.role != User.Role.COORDINATOR:
        return error_response(
            "Only Programme Coordinators can view coordinator review queues.",
            status.HTTP_403_FORBIDDEN,
        )
    recommendations = PanelRecommendation.objects.filter(
        coordinator_panel_scope_q(request.user),
        status=PanelRecommendation.Status.PENDING_COORDINATOR,
    ).select_related(
        "profile", "supervisor", "recommended_member", "recommended_member__lecturer"
    )
    return Response(PanelRecommendationSerializer(recommendations, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def coordinator_workspace_view(request):
    if request.user.role != User.Role.COORDINATOR:
        return error_response(
            "Only Programme Coordinators can view the coordinator panel workspace.",
            status.HTTP_403_FORBIDDEN,
        )

    programme = coordinator_programme(request.user)
    programmes = coordinator_programmes(request.user)
    if not programmes:
        return Response(
            {
                "programme": "",
                "programmes": [],
                "pendingCount": 0,
                "queue": [],
                "records": [],
                "message": "No programme assigned",
            }
        )

    recommendations = (
        PanelRecommendation.objects.filter(coordinator_panel_scope_q(request.user, include_legacy=True))
        .select_related(
            "profile",
            "supervisor",
            "recommended_member",
            "recommended_member__lecturer",
        )
        .order_by("-updated_at", "-created_at")
    )
    decision_ids = set(recommendations.filter(
        coordinator_panel_scope_q(request.user),
        status=PanelRecommendation.Status.PENDING_COORDINATOR,
    ).values_list("pk", flat=True))
    queue = [
        recommendation
        for recommendation in recommendations
        if recommendation.pk in decision_ids
    ]
    return Response(
        {
            "programme": programme,
            "programmes": programmes,
            "pendingCount": len(queue),
            "queue": PanelRecommendationSerializer(queue, many=True, context={"request": request}).data,
            "records": PanelRecommendationSerializer(recommendations, many=True, context={"request": request}).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def review_history_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view selected-panel review history.",
            status.HTTP_403_FORBIDDEN,
        )
    recommendations = (
        PanelRecommendation.objects.filter(
            recommended_member=request.user,
        )
        .filter(
            Q(panel_decided_at__isnull=False)
            | Q(status__in=[
                PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR,
                PanelRecommendation.Status.CANCELLED_BY_OFFICE,
                PanelRecommendation.Status.CANCELLED_CAPACITY_FULL,
            ])
        )
        .select_related(
            "profile",
            "supervisor",
            "recommended_member",
            "recommended_member__lecturer",
        )
        .order_by("-updated_at")
    )
    return Response(PanelRecommendationSerializer(recommendations, many=True, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_panel_recommendation_view(request, pk):
    with transaction.atomic():
        from .capacity_reassessment import lock_policy_semesters
        lock_policy_semesters()
        try:
            student_id = PanelRecommendation.objects.values_list("profile__student_id", flat=True).get(pk=pk)
            if student_id:
                Student.objects.select_for_update().get(pk=student_id)
            recommendation = (
                PanelRecommendation.objects.select_for_update(of=("self",))
                .select_related("profile", "supervisor", "recommended_member")
                .get(pk=pk)
            )
        except PanelRecommendation.DoesNotExist:
            return error_response(
                "Panel recommendation was not found.",
                status.HTTP_404_NOT_FOUND,
            )
        try:
            assert_not_archived(recommendation)
        except ReassessmentConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if request.user.pk != recommendation.supervisor_id:
            return error_response(
                "Only the submitting supervisor can cancel this recommendation.",
                status.HTTP_403_FORBIDDEN,
            )
        if recommendation.status != PanelRecommendation.Status.SUBMITTED_TO_PANEL:
            return error_response(
                "Only recommendations awaiting selected panel review can be cancelled."
            )
        if not profile_student_is_workflow_eligible(recommendation.profile):
            return participant_ineligible_response()

        reason_serializer = ReasonSerializer(data=request.data)
        reason_serializer.is_valid(raise_exception=True)
        previous_status = recommendation.status
        recommendation.status = PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR
        recommendation.cancellation_reason = reason_serializer.validated_data["reason"]
        recommendation.cancelled_at = timezone.now()
        recommendation.save(
            update_fields=[
                "status",
                "cancellation_reason",
                "cancelled_at",
                "updated_at",
            ]
        )
        record_workflow_event(
            actor=request.user,
            action="SUPERVISOR_CANCEL",
            previous_status=previous_status,
            new_status=recommendation.status,
            reason=recommendation.cancellation_reason,
            panel_recommendation=recommendation,
        )
        notify_workflow(
            recipients=[recommendation.recommended_member],
            actor=request.user,
            event_key=f"panel:{recommendation.pk}:supervisor-cancel",
            title="Panel recommendation cancelled",
            summary=f"The recommendation for {recommendation.profile.student_name} was cancelled.",
            message=recommendation.cancellation_reason,
            module_label="Panel Appointment",
            target_module="PANEL_APPOINTMENTS",
            record_type="PANEL_RECOMMENDATION",
            record_id=recommendation.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(PanelRecommendationSerializer(recommendation, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def panel_accept_view(request, pk):
    recommendation = get_recommendation_or_404(pk)
    if recommendation is None:
        return error_response(
            "Panel recommendation was not found.", status.HTTP_404_NOT_FOUND
        )
    if request.user.pk != recommendation.recommended_member_id:
        return error_response(
            "Only the selected panel lecturer can accept this recommendation.",
            status.HTTP_403_FORBIDDEN,
        )
    if recommendation.status != PanelRecommendation.Status.SUBMITTED_TO_PANEL:
        return error_response(
            "This recommendation is not awaiting selected panel review."
        )
    if not profile_student_is_workflow_eligible(recommendation.profile):
        return participant_ineligible_response()

    with transaction.atomic():
        recommendation = lock_request(recommendation)
        try:
            assert_not_archived(recommendation)
        except ReassessmentConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if recommendation.status != "SUBMITTED_TO_PANEL":
            return error_response("The approval stage changed; refresh before retrying.", status.HTTP_409_CONFLICT)
        if not profile_student_is_workflow_eligible(recommendation.profile):
            return participant_ineligible_response()
        Lecturer.objects.select_for_update().get(pk=recommendation.recommended_member_id)
        from .capacity_reassessment import assert_request_capacity
        try:
            assert_request_capacity(recommendation)
        except CapacityConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        previous_status = recommendation.status
        recommendation.status = PanelRecommendation.Status.PENDING_COORDINATOR
        recommendation.panel_decided_at = timezone.now()
        recommendation.save(update_fields=["status", "panel_decided_at", "updated_at"])
        record_workflow_event(
            actor=request.user,
            action="PANEL_ACCEPT",
            previous_status=previous_status,
            new_status=recommendation.status,
            panel_recommendation=recommendation,
        )
        notify_workflow(
            recipients=[
                recommendation.supervisor,
                *programme_coordinators(recommendation.profile.programme),
            ],
            actor=request.user,
            event_key=f"panel:{recommendation.pk}:panel-accept",
            title="Panel recommendation accepted",
            summary=f"{request.user.full_name} accepted the recommendation for {recommendation.profile.student_name}.",
            message="The recommendation is now awaiting Programme Coordinator confirmation.",
            module_label="Panel Appointment",
            target_module="PANEL_APPOINTMENTS",
            record_type="PANEL_RECOMMENDATION",
            record_id=recommendation.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(PanelRecommendationSerializer(recommendation, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def panel_reject_view(request, pk):
    recommendation = get_recommendation_or_404(pk)
    if recommendation is None:
        return error_response(
            "Panel recommendation was not found.", status.HTTP_404_NOT_FOUND
        )
    if request.user.pk != recommendation.recommended_member_id:
        return error_response(
            "Only the selected panel lecturer can reject this recommendation.",
            status.HTTP_403_FORBIDDEN,
        )
    if recommendation.status != PanelRecommendation.Status.SUBMITTED_TO_PANEL:
        return error_response(
            "This recommendation is not awaiting selected panel review."
        )
    if not profile_student_is_workflow_eligible(recommendation.profile):
        return participant_ineligible_response()

    reason_serializer = ReasonSerializer(data=request.data)
    reason_serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        recommendation = lock_request(recommendation)
        try:
            assert_not_archived(recommendation)
        except ReassessmentConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if recommendation.status != "SUBMITTED_TO_PANEL":
            return error_response("The approval stage changed; refresh before retrying.", status.HTTP_409_CONFLICT)
        if not profile_student_is_workflow_eligible(recommendation.profile):
            return participant_ineligible_response()
        previous_status = recommendation.status
        recommendation.status = PanelRecommendation.Status.REJECTED_BY_PANEL
        recommendation.panel_rejection_reason = reason_serializer.validated_data[
            "reason"
        ]
        recommendation.panel_decided_at = timezone.now()
        recommendation.save(
            update_fields=[
                "status",
                "panel_rejection_reason",
                "panel_decided_at",
                "updated_at",
            ]
        )
        record_workflow_event(
            actor=request.user,
            action="PANEL_REJECT",
            previous_status=previous_status,
            new_status=recommendation.status,
            reason=recommendation.panel_rejection_reason,
            panel_recommendation=recommendation,
        )
        notify_workflow(
            recipients=[recommendation.supervisor],
            actor=request.user,
            event_key=f"panel:{recommendation.pk}:panel-reject",
            title="Panel recommendation rejected",
            summary=f"The selected panel rejected the recommendation for {recommendation.profile.student_name}.",
            message=recommendation.panel_rejection_reason,
            module_label="Panel Appointment",
            target_module="PANEL_APPOINTMENTS",
            record_type="PANEL_RECOMMENDATION",
            record_id=recommendation.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(PanelRecommendationSerializer(recommendation, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def coordinator_approve_view(request, pk):
    recommendation = get_recommendation_or_404(pk)
    if recommendation is None:
        return error_response(
            "Panel recommendation was not found.", status.HTTP_404_NOT_FOUND
        )
    if request.user.role != User.Role.COORDINATOR:
        return error_response(
            "Only Programme Coordinators can approve panel recommendations.",
            status.HTTP_403_FORBIDDEN,
        )
    if not coordinator_can_access_recommendation(request.user, recommendation):
        return error_response(
            "This recommendation is outside your managed programme.",
            status.HTTP_403_FORBIDDEN,
        )
    if recommendation.status != PanelRecommendation.Status.PENDING_COORDINATOR:
        return error_response(
            "This recommendation is not awaiting Programme Coordinator review."
        )
    if not profile_student_is_workflow_eligible(recommendation.profile):
        return participant_ineligible_response()

    from .capacity_reassessment import lock_policy_semesters, assert_request_capacity, consume
    with transaction.atomic():
        lock_policy_semesters()
        locked_student = Student.objects.select_for_update().get(
            pk=recommendation.profile.student_id
        )
        if not student_is_workflow_eligible(locked_student):
            return participant_ineligible_response()
        recommendation = (
            PanelRecommendation.objects.select_for_update(of=("self",))
            .select_related(
                "profile",
                "profile__student",
                "academic_semester",
                "supervisor",
                "recommended_member",
                "replaces_appointment",
            )
            .get(pk=recommendation.pk)
        )
        if recommendation.profile.student_id != locked_student.pk:
            return error_response("The linked student changed. Review the latest recommendation.", status.HTTP_409_CONFLICT)
        if not profile_student_is_workflow_eligible(recommendation.profile):
            return participant_ineligible_response()
        if not user_is_assignable_lecturer(recommendation.recommended_member):
            return error_response(
                "The selected panel lecturer is not eligible for a new appointment.",
                status.HTTP_409_CONFLICT,
            )
        from .co_supervision import assert_no_supporting_role, CoSupervisionConflict

        try:
            assert_no_supporting_role(
                student_id=recommendation.profile.student_id,
                candidate_id=recommendation.recommended_member_id,
            )
        except CoSupervisionConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        Lecturer.objects.select_for_update().get(
            pk=recommendation.recommended_member_id
        )
        try:
            assert_no_primary_role(
                profile=recommendation.profile,
                candidate_id=recommendation.recommended_member_id,
            )
        except AppointmentRoleConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if not coordinator_can_access_recommendation(request.user, recommendation, lock=True):
            return error_response("Your authority for this programme is no longer active.", status.HTTP_403_FORBIDDEN)
        if recommendation.status != PanelRecommendation.Status.PENDING_COORDINATOR:
            return error_response(
                "This recommendation is not awaiting Programme Coordinator review.",
                status.HTTP_409_CONFLICT,
            )
        try:
            capacity_result = assert_request_capacity(recommendation)
        except CapacityConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        previous_status = recommendation.status
        recommendation.status = PanelRecommendation.Status.APPROVED
        recommendation.coordinator_decided_at = timezone.now()
        recommendation.save(
            update_fields=["status", "coordinator_decided_at", "updated_at"]
        )
        try:
            activate_replacement(
                model=PanelAppointment,
                replacement_source=recommendation,
                actor=request.user,
                create_values={
                    "recommendation": recommendation,
                    "profile": recommendation.profile,
                    "supervisor": recommendation.supervisor,
                    "panel_member": recommendation.recommended_member,
                    "approved_by": request.user,
                },
            )
        except AppointmentLifecycleConflict as exc:
            transaction.set_rollback(True)
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        consume(recommendation, request.user, capacity_result)
        from .capacity_closure import close_capacity_full_panel_requests
        close_capacity_full_panel_requests(panel_member=recommendation.recommended_member, actor=request.user)
        record_workflow_event(
            actor=request.user,
            action="COORDINATOR_APPROVE",
            previous_status=previous_status,
            new_status=recommendation.status,
            panel_recommendation=recommendation,
        )
        notify_workflow(
            recipients=[
                recommendation.supervisor,
                recommendation.recommended_member,
                recommendation.profile.student,
            ],
            actor=request.user,
            event_key=f"panel:{recommendation.pk}:coordinator-approve",
            title="Panel appointment confirmed",
            summary=f"The panel appointment for {recommendation.profile.student_name} was confirmed.",
            message="The Programme Coordinator approved the panel recommendation.",
            module_label="Panel Appointment",
            target_module="PANEL_APPOINTMENTS",
            record_type="PANEL_RECOMMENDATION",
            record_id=recommendation.pk,
        )
    return Response(PanelRecommendationSerializer(recommendation, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def coordinator_reject_view(request, pk):
    recommendation = get_recommendation_or_404(pk)
    if recommendation is None:
        return error_response(
            "Panel recommendation was not found.", status.HTTP_404_NOT_FOUND
        )
    if request.user.role != User.Role.COORDINATOR:
        return error_response(
            "Only Programme Coordinators can reject panel recommendations.",
            status.HTTP_403_FORBIDDEN,
        )
    if not coordinator_can_access_recommendation(request.user, recommendation):
        return error_response(
            "This recommendation is outside your managed programme.",
            status.HTTP_403_FORBIDDEN,
        )
    if recommendation.status != PanelRecommendation.Status.PENDING_COORDINATOR:
        return error_response(
            "This recommendation is not awaiting Programme Coordinator review."
        )
    if not profile_student_is_workflow_eligible(recommendation.profile):
        return participant_ineligible_response()

    reason_serializer = ReasonSerializer(data=request.data)
    reason_serializer.is_valid(raise_exception=True)
    reason = reason_serializer.validated_data["reason"]
    with transaction.atomic():
        from .capacity_reassessment import lock_policy_semesters
        lock_policy_semesters()
        locked_student = Student.objects.select_for_update().get(pk=recommendation.profile.student_id)
        recommendation = PanelRecommendation.objects.select_for_update(of=("self",)).select_related("profile").get(pk=pk)
        if recommendation.profile.student_id != locked_student.pk:
            return error_response("The linked student changed. Review the latest recommendation.", status.HTTP_409_CONFLICT)
        try:
            assert_not_archived(recommendation)
        except ReassessmentConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if not coordinator_can_access_recommendation(request.user, recommendation, lock=True):
            return error_response("Your authority for this programme is no longer active.", status.HTTP_403_FORBIDDEN)
        if recommendation.status != PanelRecommendation.Status.PENDING_COORDINATOR:
            return error_response("This recommendation is no longer awaiting coordinator review.", status.HTTP_409_CONFLICT)
        if not profile_student_is_workflow_eligible(recommendation.profile):
            return participant_ineligible_response()
        previous_status = recommendation.status
        recommendation.status = PanelRecommendation.Status.REJECTED_BY_COORDINATOR
        recommendation.coordinator_rejection_reason = str(reason).strip()
        recommendation.coordinator_decided_at = timezone.now()
        recommendation.save(
            update_fields=[
                "status",
                "coordinator_rejection_reason",
                "coordinator_decided_at",
                "updated_at",
            ]
        )
        record_workflow_event(
            actor=request.user,
            action="COORDINATOR_REJECT",
            previous_status=previous_status,
            new_status=recommendation.status,
            reason=recommendation.coordinator_rejection_reason,
            panel_recommendation=recommendation,
        )
        notify_workflow(
            recipients=[recommendation.supervisor, recommendation.recommended_member],
            actor=request.user,
            event_key=f"panel:{recommendation.pk}:coordinator-reject",
            title="Panel recommendation rejected by coordinator",
            summary=f"The recommendation for {recommendation.profile.student_name} was not approved.",
            message=recommendation.coordinator_rejection_reason,
            module_label="Panel Appointment",
            target_module="PANEL_APPOINTMENTS",
            record_type="PANEL_RECOMMENDATION",
            record_id=recommendation.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(PanelRecommendationSerializer(recommendation, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def assignments_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view panel assignments.", status.HTTP_403_FORBIDDEN
        )
    appointments = PanelAppointment.objects.filter(
        panel_member=request.user
    ).select_related("profile", "profile__student", "supervisor", "panel_member", "recommendation", "recommendation__replaces_appointment__panel_member").prefetch_related("recommendation__workflow_events__actor", "lifecycle_events__actor")
    return Response(PanelAssignmentSerializer(appointments, many=True).data)


def supervisor_programme_access(user, application, *, lock=False):
    return coordinator_manages_programme(user, application.student.programme, lock=lock)


def get_supervisor_application(pk):
    try:
        return (
            SupervisorApplication.objects.select_related(
                "student",
                "student__user",
                "proposed_supervisor",
                "proposed_supervisor__lecturer",
            )
            .prefetch_related("documents", "workflow_events__actor")
            .get(pk=pk)
        )
    except SupervisorApplication.DoesNotExist:
        return None


def _django_validation_error_response(exc):
    messages = getattr(exc, "messages", None) or [str(exc)]
    return error_response(messages[0], status.HTTP_400_BAD_REQUEST)


def _office_requirement_access(request):
    if request.user.role == User.Role.OFFICE_ADMIN:
        return None
    return error_response(
        "Only Office Staff/Admin can manage supervisor document requirements.",
        status.HTTP_403_FORBIDDEN,
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def supervisor_document_setup_view(request):
    from .supervisor_documents import document_setup_status, set_document_setup
    if request.method == "GET":
        return Response(document_setup_status())
    denied = _office_requirement_access(request)
    if denied:
        return denied
    from rest_framework import serializers
    class SetupSerializer(serializers.Serializer):
        noDocumentsRequired = serializers.BooleanField()
        reason = serializers.CharField(max_length=2000)
    serializer = SetupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        return Response(set_document_setup(actor=request.user,
            no_documents_required=serializer.validated_data["noDocumentsRequired"],
            reason=serializer.validated_data["reason"]))
    except DjangoValidationError as exc:
        return _django_validation_error_response(exc)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def active_supervisor_document_requirements_view(_request):
    requirements = SupervisorDocumentRequirement.objects.filter(is_active=True)
    return Response(
        SupervisorDocumentRequirementSerializer(requirements, many=True).data
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def supervisor_document_requirements_view(request):
    denied = _office_requirement_access(request)
    if denied:
        return denied
    if request.method == "GET":
        requirements = SupervisorDocumentRequirement.objects.all()
        return Response(
            SupervisorDocumentRequirementSerializer(requirements, many=True).data
        )

    serializer = SupervisorDocumentRequirementWriteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        requirement = create_requirement(
            actor=request.user,
            values=serializer.service_values(),
        )
    except DjangoValidationError as exc:
        return _django_validation_error_response(exc)
    return Response(
        SupervisorDocumentRequirementSerializer(requirement).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def supervisor_document_requirement_detail_view(request, pk):
    denied = _office_requirement_access(request)
    if denied:
        return denied
    try:
        requirement = SupervisorDocumentRequirement.objects.get(pk=pk)
    except SupervisorDocumentRequirement.DoesNotExist:
        return error_response(
            "Supervisor document requirement was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    serializer = SupervisorDocumentRequirementUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        requirement = update_requirement(
            requirement,
            actor=request.user,
            values=serializer.service_values(),
            reason=serializer.validated_data["reason"],
        )
    except DjangoValidationError as exc:
        return _django_validation_error_response(exc)
    return Response(SupervisorDocumentRequirementSerializer(requirement).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_document_requirement_audits_view(request):
    denied = _office_requirement_access(request)
    if denied:
        return denied
    audits = SupervisorDocumentRequirementAudit.objects.select_related(
        "requirement", "actor"
    )
    return Response(
        [
            {
                "id": audit.pk,
                "requirementId": audit.requirement_id,
                "requirementCode": audit.requirement.code if audit.requirement_id else "",
                "requirementLabel": audit.requirement.label if audit.requirement_id else "Document setup",
                "actorName": audit.actor.full_name,
                "actorRole": audit.actor.role,
                "action": audit.action,
                "reason": audit.reason,
                "beforeValues": audit.before_values,
                "afterValues": audit.after_values,
                "createdAt": audit.created_at,
            }
            for audit in audits
        ]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_application_document_download_view(request, pk, document_pk):
    try:
        document = SupervisorApplicationDocument.objects.select_related(
            "application",
            "application__student",
            "application__student__user",
            "application__proposed_supervisor",
        ).get(pk=document_pk, application_id=pk)
    except SupervisorApplicationDocument.DoesNotExist:
        return error_response("Document was not found.", status.HTTP_404_NOT_FOUND)
    if not can_view_supervisor_application(request.user, document.application):
        return error_response("Document was not found.", status.HTTP_404_NOT_FOUND)
    if not document.file:
        return error_response("Document was not found.", status.HTTP_404_NOT_FOUND)
    try:
        handle = document.file.open("rb")
    except (FileNotFoundError, OSError):
        return error_response("Document was not found.", status.HTTP_404_NOT_FOUND)
    response = FileResponse(
        handle,
        as_attachment=True,
        filename=document.name,
        content_type=document.content_type or "application/octet-stream",
    )
    response["X-Content-Type-Options"] = "nosniff"
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_candidates_view(request):
    if request.user.role != User.Role.STUDENT:
        return error_response(
            "Only students can view supervisor candidates.",
            status.HTTP_403_FORBIDDEN,
        )
    academic_semester = current_effective_semester()
    if academic_semester is None:
        return Response([])
    try:
        student = request.user.student
    except ObjectDoesNotExist:
        return error_response("The student profile is not available.")
    conflicting_ids = panel_role_candidate_ids(student)
    candidates = list(
        User.objects.filter(
            role=User.Role.LECTURER,
            is_active=True,
            lecturer__lifecycle_status=Lecturer.Lifecycle.ACTIVE,
            lecturer__supervisor__isnull=False,
        ).exclude(pk__in=conflicting_ids).select_related("lecturer", "lecturer__supervisor")
    )
    resolutions = {
        candidate.pk: resolve_lecturer_capacity(
            user=candidate,
            semester=academic_semester,
            role=CapacityRole.SUPERVISOR,
        )
        for candidate in candidates
    }
    visible = [
        candidate
        for candidate in candidates
        if resolutions[candidate.pk].state
        not in {CapacityState.INELIGIBLE, CapacityState.TEMPORARILY_UNAVAILABLE}
    ]
    return Response(
        SupervisorCandidateSerializer(
            visible,
            many=True,
            context={"capacity_resolutions": resolutions},
        ).data
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def supervisor_applications_view(request):
    if request.method == "GET":
        if request.user.role != User.Role.STUDENT:
            return error_response(
                "Only students can view their supervisor applications.",
                status.HTTP_403_FORBIDDEN,
            )
        applications = (
            SupervisorApplication.objects.filter(student=request.user.student)
            .select_related(
                "student",
                "student__user",
                "proposed_supervisor",
                "proposed_supervisor__lecturer",
            )
            .prefetch_related("documents", "workflow_events__actor")
        )
        return Response(SupervisorApplicationSerializer(applications, many=True, context={"request": request}).data)

    serializer = SupervisorApplicationCreateSerializer(
        data=request.data,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    files = request.FILES.getlist("documents")
    if hasattr(request.data, "getlist"):
        requirement_codes = request.data.getlist("requirementCodes")
    else:
        requirement_codes = request.data.get("requirementCodes", [])
        if isinstance(requirement_codes, str):
            requirement_codes = [requirement_codes]
    try:
        validated_documents = validate_application_documents(
            files,
            requirement_codes,
        )
    except DocumentRequirementsNotConfigured as exc:
        return error_response(str(exc), status.HTTP_409_CONFLICT)
    except DjangoValidationError as exc:
        return _django_validation_error_response(exc)

    try:
        with transaction.atomic():
            application = serializer.save(validated_documents=validated_documents)
            record_workflow_event(
                actor=request.user,
                action="SUBMIT",
                previous_status="",
                new_status=application.status,
                supervisor_application=application,
            )
            notify_workflow(
                recipients=[application.proposed_supervisor],
                actor=request.user,
                event_key=f"supervisor:{application.pk}:submit",
                title="Supervisor request requires your review",
                summary=f"{application.student.user.full_name} requested you as supervisor.",
                message="Open Supervisor Appointments to accept or reject this request.",
                module_label="Supervisor Appointment",
                target_module="SUPERVISOR_APPOINTMENTS",
                record_type="SUPERVISOR_APPLICATION",
                record_id=application.pk,
                priority=Notification.Priority.MEDIUM,
            )
    except Exception:
        for name in getattr(serializer, "saved_file_names", []):
            default_storage.delete(name)
        raise
    application = get_supervisor_application(application.pk)
    return Response(
        SupervisorApplicationSerializer(application, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_application_detail_view(request, pk):
    application = get_supervisor_application(pk)
    if application is None:
        return error_response(
            "Supervisor application was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    if not can_view_supervisor_application(request.user, application):
        return error_response(
            "You do not have permission to view this supervisor application.",
            status.HTTP_403_FORBIDDEN,
        )
    return Response(SupervisorApplicationSerializer(application, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_supervisor_application_view(request, pk):
    with transaction.atomic():
        from .capacity_reassessment import lock_policy_semesters
        lock_policy_semesters()
        try:
            student_id = SupervisorApplication.objects.values_list("student_id", flat=True).get(pk=pk)
            if student_id:
                Student.objects.select_for_update().get(pk=student_id)
            application = (
                SupervisorApplication.objects.select_for_update(of=("self",))
                .select_related(
                    "student",
                    "student__user",
                    "proposed_supervisor",
                )
                .prefetch_related("documents", "workflow_events__actor")
                .get(pk=pk)
            )
        except SupervisorApplication.DoesNotExist:
            return error_response(
                "Supervisor application was not found.",
                status.HTTP_404_NOT_FOUND,
            )
        try:
            assert_not_archived(application)
        except ReassessmentConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if request.user.pk != application.student.user_id:
            return error_response(
                "Only the student who submitted this request can cancel it.",
                status.HTTP_403_FORBIDDEN,
            )
        if is_office_replacement(application):
            return error_response(
                "Only the Office can manage cancellation of an Office-initiated Supervisor change.",
                status.HTTP_403_FORBIDDEN,
            )
        if application.status != SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR:
            return error_response(
                "Only requests awaiting supervisor review can be cancelled."
            )
        if not student_is_workflow_eligible(application.student):
            return participant_ineligible_response()

        reason_serializer = ReasonSerializer(data=request.data)
        reason_serializer.is_valid(raise_exception=True)
        previous_status = application.status
        application.status = SupervisorApplication.Status.CANCELLED_BY_STUDENT
        application.cancellation_reason = reason_serializer.validated_data["reason"]
        application.cancelled_at = timezone.now()
        application.save(
            update_fields=[
                "status",
                "cancellation_reason",
                "cancelled_at",
                "updated_at",
            ]
        )
        record_workflow_event(
            actor=request.user,
            action="STUDENT_CANCEL",
            previous_status=previous_status,
            new_status=application.status,
            reason=application.cancellation_reason,
            supervisor_application=application,
        )
        notify_workflow(
            recipients=[application.proposed_supervisor],
            actor=request.user,
            event_key=f"supervisor:{application.pk}:student-cancel",
            title="Supervisor request cancelled",
            summary=f"{application.student.user.full_name} cancelled their supervisor request.",
            message=application.cancellation_reason,
            module_label="Supervisor Appointment",
            target_module="SUPERVISOR_APPOINTMENTS",
            record_type="SUPERVISOR_APPLICATION",
            record_id=application.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(SupervisorApplicationSerializer(application, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_requests_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view supervisor requests.",
            status.HTTP_403_FORBIDDEN,
        )
    applications = SupervisorApplication.objects.filter(
        proposed_supervisor=request.user,
        status=SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
    ).select_related("student", "student__user", "proposed_supervisor", "academic_semester")
    capacity_cache = {}
    rows = [
        {
            "applicationId": application.pk,
            "studentId": application.student.matric_no,
            "studentName": application.student.user.full_name,
            "programme": application.student.programme,
            "proposedTopic": application.research_title,
            "researchArea": application.research_area,
            "submittedDate": format_display_date(application.submitted_at),
            "receivedTime": application.submitted_at.isoformat(),
            **workflow_semester_payload(application),
            "status": "Pending Review",
            "participantLifecycleStatus": application.student.status.upper(),
            "participantEligible": student_is_workflow_eligible(application.student),
            "abstract": application.research_abstract,
            "acceptanceCapacity": acceptance_capacity(application, cache=capacity_cache),
            **supervisor_waiting_metadata(application),
        }
        for application in applications
    ]
    return Response(rows)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def supervisor_accept_view(request, pk):
    application = get_supervisor_application(pk)
    if application is None:
        return error_response(
            "Supervisor application was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    if request.user.pk != application.proposed_supervisor_id:
        return error_response(
            "Only the requested supervisor can accept this application.",
            status.HTTP_403_FORBIDDEN,
        )
    if application.status != SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR:
        return error_response("This application is not awaiting supervisor review.")
    if not student_is_workflow_eligible(application.student):
        return participant_ineligible_response()
    with transaction.atomic():
        application = lock_request(application)
        try:
            assert_not_archived(application)
        except ReassessmentConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if application.status != "SUBMITTED_TO_SUPERVISOR":
            return error_response("The approval stage changed; refresh before retrying.", status.HTTP_409_CONFLICT)
        if not student_is_workflow_eligible(application.student):
            return participant_ineligible_response()
        assert_current_predecessor(application)
        # Acceptance promises a place; serialize it with every activation path.
        Lecturer.objects.select_for_update().get(pk=application.proposed_supervisor_id)
        from .capacity_reassessment import assert_request_capacity
        try:
            assert_request_capacity(application)
        except CapacityConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        previous_status = application.status
        application.status = SupervisorApplication.Status.PENDING_COORDINATOR
        application.supervisor_decided_at = timezone.now()
        application.save(
            update_fields=["status", "supervisor_decided_at", "updated_at"]
        )
        record_workflow_event(
            actor=request.user,
            action="SUPERVISOR_ACCEPT",
            previous_status=previous_status,
            new_status=application.status,
            supervisor_application=application,
        )
        notify_workflow(
            recipients=[
                application.student.user,
                *programme_coordinators(application.student.programme),
            ],
            actor=request.user,
            event_key=f"supervisor:{application.pk}:supervisor-accept",
            title="Supervisor request accepted",
            summary=f"{request.user.full_name} accepted the supervisor request.",
            message="The request is now awaiting Programme Coordinator confirmation.",
            module_label="Supervisor Appointment",
            target_module="SUPERVISOR_APPOINTMENTS",
            record_type="SUPERVISOR_APPLICATION",
            record_id=application.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(SupervisorApplicationSerializer(application, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def supervisor_reject_view(request, pk):
    application = get_supervisor_application(pk)
    if application is None:
        return error_response(
            "Supervisor application was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    if request.user.pk != application.proposed_supervisor_id:
        return error_response(
            "Only the requested supervisor can reject this application.",
            status.HTTP_403_FORBIDDEN,
        )
    if application.status != SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR:
        return error_response("This application is not awaiting supervisor review.")
    if not student_is_workflow_eligible(application.student):
        return participant_ineligible_response()
    reason_serializer = ReasonSerializer(data=request.data)
    reason_serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        application = lock_request(application)
        try:
            assert_not_archived(application)
        except ReassessmentConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if application.status != "SUBMITTED_TO_SUPERVISOR":
            return error_response("The approval stage changed; refresh before retrying.", status.HTTP_409_CONFLICT)
        if not student_is_workflow_eligible(application.student):
            return participant_ineligible_response()
        previous_status = application.status
        application.status = SupervisorApplication.Status.REJECTED_BY_SUPERVISOR
        application.supervisor_rejection_reason = reason_serializer.validated_data[
            "reason"
        ]
        application.supervisor_decided_at = timezone.now()
        application.save(
            update_fields=[
                "status",
                "supervisor_rejection_reason",
                "supervisor_decided_at",
                "updated_at",
            ]
        )
        record_workflow_event(
            actor=request.user,
            action="SUPERVISOR_REJECT",
            previous_status=previous_status,
            new_status=application.status,
            reason=application.supervisor_rejection_reason,
            supervisor_application=application,
        )
        notify_workflow(
            recipients=[application.student.user],
            actor=request.user,
            event_key=f"supervisor:{application.pk}:supervisor-reject",
            title="Supervisor request rejected",
            summary=f"{request.user.full_name} rejected the supervisor request.",
            message=application.supervisor_rejection_reason,
            module_label="Supervisor Appointment",
            target_module="SUPERVISOR_APPOINTMENTS",
            record_type="SUPERVISOR_APPLICATION",
            record_id=application.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(SupervisorApplicationSerializer(application, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_coordinator_queue_view(request):
    if request.user.role != User.Role.COORDINATOR:
        return error_response(
            "Only Programme Coordinators can view supervisor approvals.",
            status.HTTP_403_FORBIDDEN,
        )
    applications = SupervisorApplication.objects.filter(
        coordinator_scope_q(request.user, "student__programme"),
        status=SupervisorApplication.Status.PENDING_COORDINATOR,
    ).select_related("student", "student__user", "proposed_supervisor")
    return Response(SupervisorApplicationSerializer(applications, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_coordinator_history_view(request):
    if request.user.role != User.Role.COORDINATOR:
        return error_response(
            "Only Programme Coordinators can view supervisor request history.",
            status.HTTP_403_FORBIDDEN,
        )
    applications = (
        SupervisorApplication.objects.filter(
            coordinator_scope_q(request.user, "student__programme"),
            status__in=(
                SupervisorApplication.Status.APPROVED,
                SupervisorApplication.Status.REJECTED_BY_SUPERVISOR,
                SupervisorApplication.Status.REJECTED_BY_COORDINATOR,
                SupervisorApplication.Status.CANCELLED_BY_STUDENT,
                SupervisorApplication.Status.CANCELLED_BY_OFFICE,
                SupervisorApplication.Status.CANCELLED_CAPACITY_FULL,
            ),
        )
        .select_related(
            "student", "student__user", "proposed_supervisor",
            "appointment__ended_by", "appointment__supersedes",
        )
        .prefetch_related(
            "documents", "workflow_events__actor", "appointment__lifecycle_events__actor",
        )
        .order_by("-updated_at", "-pk")
    )
    applications = routine_supervisor_requests(applications, request.user)
    return Response(SupervisorApplicationSerializer(applications, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_coordinator_records_view(request):
    if request.user.role != User.Role.COORDINATOR:
        return error_response(
            "Only Programme Coordinators can view supervisor appointment records.",
            status.HTTP_403_FORBIDDEN,
        )
    applications = (
        SupervisorApplication.objects.filter(
            coordinator_scope_q(request.user, "student__programme"),
            status=SupervisorApplication.Status.APPROVED,
            appointment__isnull=False,
        )
        .select_related(
            "student",
            "student__user",
            "proposed_supervisor",
            "appointment__ended_by",
            "appointment__supersedes",
        )
        .prefetch_related(
            "documents",
            "workflow_events__actor",
            "appointment__lifecycle_events__actor",
        )
        .order_by("-coordinator_decided_at", "-pk")
    )
    return Response(SupervisorApplicationSerializer(applications, many=True, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def supervisor_coordinator_approve_view(request, pk):
    try:
        application, transitioned = approve_supervisor_application(
            application_id=pk,
            actor=request.user,
        )
    except SupervisorApplication.DoesNotExist:
        return error_response(
            "Supervisor application was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    except SupervisorApprovalForbidden as exc:
        return error_response(str(exc), status.HTTP_403_FORBIDDEN)
    except SupervisorApprovalConflict as exc:
        return error_response(str(exc), status.HTTP_409_CONFLICT)

    if transitioned:
        with transaction.atomic():
            application = get_supervisor_application(application.pk)
            notify_workflow(
                recipients=[application.student.user, application.proposed_supervisor],
                actor=request.user,
                event_key=f"supervisor:{application.pk}:coordinator-approve",
                title="Supervisor appointment approved",
                summary=f"The supervisor appointment for {application.student.user.full_name} was approved.",
                message="The Programme Coordinator confirmed the supervisor appointment.",
                module_label="Supervisor Appointment",
                target_module="SUPERVISOR_APPOINTMENTS",
                record_type="SUPERVISOR_APPLICATION",
                record_id=application.pk,
            )
    application = get_supervisor_application(application.pk)
    return Response(SupervisorApplicationSerializer(application, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def supervisor_coordinator_reject_view(request, pk):
    application = get_supervisor_application(pk)
    if application is None:
        return error_response(
            "Supervisor application was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    if request.user.role != User.Role.COORDINATOR:
        return error_response(
            "Only Programme Coordinators can reject supervisor applications.",
            status.HTTP_403_FORBIDDEN,
        )
    if not supervisor_programme_access(request.user, application):
        return error_response(
            "This application is outside your managed programme.",
            status.HTTP_403_FORBIDDEN,
        )
    if application.status != SupervisorApplication.Status.PENDING_COORDINATOR:
        return error_response(
            "This application is not awaiting Programme Coordinator review."
        )
    if not student_is_workflow_eligible(application.student):
        return participant_ineligible_response()
    reason_serializer = ReasonSerializer(data=request.data)
    reason_serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        from .capacity_reassessment import lock_policy_semesters
        lock_policy_semesters()
        Student.objects.select_for_update().get(pk=application.student_id)
        application = SupervisorApplication.objects.select_for_update(of=("self",)).select_related("student__user", "proposed_supervisor").get(pk=pk)
        try:
            assert_not_archived(application)
        except ReassessmentConflict as exc:
            return error_response(str(exc), status.HTTP_409_CONFLICT)
        if not supervisor_programme_access(request.user, application, lock=True):
            return error_response("Your authority for this programme is no longer active.", status.HTTP_403_FORBIDDEN)
        if application.status != SupervisorApplication.Status.PENDING_COORDINATOR:
            return error_response("This application is no longer awaiting coordinator review.", status.HTTP_409_CONFLICT)
        if not student_is_workflow_eligible(application.student):
            return participant_ineligible_response()
        previous_status = application.status
        application.status = SupervisorApplication.Status.REJECTED_BY_COORDINATOR
        application.coordinator_rejection_reason = reason_serializer.validated_data[
            "reason"
        ]
        application.coordinator_decided_at = timezone.now()
        application.save(
            update_fields=[
                "status",
                "coordinator_rejection_reason",
                "coordinator_decided_at",
                "updated_at",
            ]
        )
        record_workflow_event(
            actor=request.user,
            action="COORDINATOR_REJECT",
            previous_status=previous_status,
            new_status=application.status,
            reason=application.coordinator_rejection_reason,
            supervisor_application=application,
        )
        notify_workflow(
            recipients=[application.student.user, application.proposed_supervisor],
            actor=request.user,
            event_key=f"supervisor:{application.pk}:coordinator-reject",
            title="Supervisor request rejected by coordinator",
            summary=f"The supervisor request for {application.student.user.full_name} was not approved.",
            message=application.coordinator_rejection_reason,
            module_label="Supervisor Appointment",
            target_module="SUPERVISOR_APPOINTMENTS",
            record_type="SUPERVISOR_APPLICATION",
            record_id=application.pk,
            priority=Notification.Priority.MEDIUM,
        )
    return Response(SupervisorApplicationSerializer(application, context={"request": request}).data)


def _active_supervisee_research(appointment):
    profile = getattr(appointment.student.user, "research_profile", None)
    if profile is not None and profile.supervisor_id == appointment.supervisor_id:
        return {
            "researchTitle": profile.proposed_topic,
            "researchArea": profile.research_area,
            "researchAbstract": profile.abstract,
        }
    return {
        "researchTitle": appointment.application.research_title,
        "researchArea": appointment.application.research_area,
        "researchAbstract": appointment.application.research_abstract,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def active_supervisees_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view active supervisees.",
            status.HTTP_403_FORBIDDEN,
        )
    appointments = SupervisorAppointment.objects.filter(
        supervisor=request.user,
        status=SupervisorAppointment.Status.ACTIVE,
    ).select_related(
        "student",
        "student__user",
        "student__user__research_profile",
        "application",
        "supervisor",
    )
    return Response(
        [
            {
                "appointmentId": appointment.pk,
                "studentId": appointment.student.matric_no,
                "studentName": appointment.student.user.full_name,
                "programme": appointment.student.programme,
                **workflow_semester_payload(appointment.application),
                "email": appointment.student.user.email,
                **_active_supervisee_research(appointment),
                "supervisorName": appointment.supervisor.full_name,
                "appointmentDate": format_display_date(appointment.appointment_date),
                "status": "Active",
            }
            for appointment in appointments
        ]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_request_history_view(request):
    if request.user.role != User.Role.LECTURER:
        return error_response(
            "Only lecturers can view supervisor request history.",
            status.HTTP_403_FORBIDDEN,
        )
    applications = (
        SupervisorApplication.objects.filter(
            proposed_supervisor=request.user,
        )
        .filter(
            Q(supervisor_decided_at__isnull=False)
            | Q(status__in=[
                SupervisorApplication.Status.CANCELLED_BY_STUDENT,
                SupervisorApplication.Status.CANCELLED_BY_OFFICE,
                SupervisorApplication.Status.CANCELLED_CAPACITY_FULL,
            ])
        )
        .select_related("student", "student__user")
    )
    applications = routine_supervisor_requests(applications, request.user)
    return Response(
        [
            {
                "requestId": f"SV-REQ-{application.pk:05d}",
                "applicationId": application.pk,
                "status": application.status,
                "submittedAt": application.submitted_at.isoformat(),
                "supervisorDecisionAt": application.supervisor_decided_at.isoformat() if application.supervisor_decided_at else None,
                "coordinatorDecisionAt": application.coordinator_decided_at.isoformat() if application.coordinator_decided_at else None,
                **supervisor_waiting_metadata(application),
                "studentName": application.student.user.full_name,
                "studentId": application.student.matric_no,
                "programme": application.student.programme,
                "researchTitle": application.research_title,
                "submittedDate": format_display_date(application.submitted_at),
                "decision": (
                    "Capacity full" if application.status == SupervisorApplication.Status.CANCELLED_CAPACITY_FULL else
                    "Cancelled"
                    if application.status
                    in [
                        SupervisorApplication.Status.CANCELLED_BY_STUDENT,
                        SupervisorApplication.Status.CANCELLED_BY_OFFICE,
                        SupervisorApplication.Status.CANCELLED_CAPACITY_FULL,
                    ]
                    else (
                        "Rejected"
                        if application.status
                        in [SupervisorApplication.Status.REJECTED_BY_SUPERVISOR, SupervisorApplication.Status.REJECTED_BY_COORDINATOR]
                        else "Pending Approval" if application.status == SupervisorApplication.Status.PENDING_COORDINATOR
                        else "Approved"
                    )
                ),
                **workflow_semester_payload(application),
                "abstract": application.research_abstract,
                "decisionReason": (
                    application.cancellation_reason
                    or application.coordinator_rejection_reason
                    or application.supervisor_rejection_reason
                ),
            }
            for application in applications
        ]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def supervisor_records_view(request):
    if request.user.role != User.Role.OFFICE_ADMIN:
        return error_response(
            "Only Office Staff/Admin can view supervisor records.",
            status.HTTP_403_FORBIDDEN,
        )
    applications = SupervisorApplication.objects.select_related(
        "student",
        "student__user",
        "proposed_supervisor",
        "proposed_supervisor__lecturer",
        "appointment__ended_by",
        "appointment__supersedes",
    ).prefetch_related("documents", "workflow_events__actor")

    def display_status(application):
        if application.status == SupervisorApplication.Status.APPROVED:
            try:
                return (
                    "Approved"
                    if application.appointment.status
                    == SupervisorAppointment.Status.ACTIVE
                    else "Ended"
                )
            except SupervisorAppointment.DoesNotExist:
                return "Approved"
        if application.status in [
            SupervisorApplication.Status.REJECTED_BY_SUPERVISOR,
            SupervisorApplication.Status.REJECTED_BY_COORDINATOR,
        ]:
            return "Rejected"
        if application.status == SupervisorApplication.Status.CANCELLED_CAPACITY_FULL:
            return "Capacity full"
        if application.status in [
            SupervisorApplication.Status.CANCELLED_BY_STUDENT,
            SupervisorApplication.Status.CANCELLED_BY_OFFICE,
            SupervisorApplication.Status.CANCELLED_CAPACITY_FULL,
        ]:
            return "Cancelled"
        return "Pending"

    applications = routine_supervisor_requests(applications, request.user)
    return Response(
        [
            {
                "studentId": application.student.matric_no,
                "applicationId": application.pk,
                "studentName": application.student.user.full_name,
                "programme": application.student.programme,
                "supervisor": application.proposed_supervisor.full_name,
                "status": display_status(application),
                "updatedDate": format_display_date(application.updated_at),
                "email": application.student.user.email,
                **workflow_semester_payload(application),
                "researchTopic": application.research_title,
                "projectCourseCodes": application.project_course_codes,
                "researchArea": application.research_area,
                "abstract": application.research_abstract,
                "appointmentId": (
                    application.appointment.pk
                    if hasattr(application, "appointment")
                    else None
                ),
                "workloadLimit": supervisor_workload_summary(application),
                "approvedDate": format_display_date(application.coordinator_decided_at),
                "cancelledAt": application.cancelled_at,
                "cancellationReason": application.cancellation_reason,
                "workflow": AppointmentWorkflowEventSerializer(
                    application.workflow_events.all(),
                    many=True,
                ).data,
                "documents": SupervisorApplicationDocumentSerializer(
                    application.documents.all(),
                    many=True,
                ).data,
                "appointmentLifecycle": (
                    appointment_lifecycle_payload(application.appointment)
                    if hasattr(application, "appointment")
                    else None
                ),
                "replacesAppointmentId": application.replaces_appointment_id,
                "replacementReason": application.replacement_reason or None,
                "initiatedByOffice": is_office_replacement(application),
                **supervisor_waiting_metadata(application),
            }
            for application in applications
        ]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def panel_appointment_detail_view(request, pk):
    appointment = PanelAppointment.objects.select_related("profile", "profile__student", "supervisor", "panel_member", "recommendation").filter(pk=pk).first()
    if appointment is None:
        return error_response("Panel appointment was not found.", status.HTTP_404_NOT_FOUND)
    if request.user.role == User.Role.STUDENT or not can_view_panel_recommendation(request.user, appointment.recommendation):
        return error_response("You do not have permission to view this appointment.", status.HTTP_403_FORBIDDEN)
    return Response(PanelAssignmentSerializer(appointment, context={"include_academic_team": True}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def panel_record_detail_view(request, record_id):
    if request.user.role != User.Role.OFFICE_ADMIN:
        return error_response("Only Office Staff/Admin can view faculty Panel records.", status.HTTP_403_FORBIDDEN)
    kind, separator, identity = record_id.partition("-")
    if not separator or not identity.isdecimal():
        return error_response("Panel record was not found.", status.HTTP_404_NOT_FOUND)
    if kind == "appointment":
        row = PanelAppointment.objects.select_related("profile", "supervisor", "panel_member", "recommendation").filter(pk=identity).first()
        payload = panel_record_from_appointment(row) if row else None
    elif kind == "recommendation":
        row = get_recommendation_or_404(identity)
        if row:
            try:
                payload = panel_record_from_appointment(row.panel_appointment)
            except PanelAppointment.DoesNotExist:
                payload = panel_record_from_recommendation(row)
        else:
            payload = None
    elif kind == "profile":
        row = StudentResearchProfile.objects.select_related("supervisor").filter(pk=identity).first()
        if row:
            current = row.panel_appointments.filter(status=PanelAppointment.Status.ACTIVE).first()
            pending = row.panel_recommendations.filter(status__in=PanelRecommendation.PENDING_STATUSES).order_by("-submitted_at", "-pk").first()
            payload = panel_record_from_appointment(current) if current else panel_record_from_recommendation(pending) if pending else panel_record_from_profile(row)
        else:
            payload = None
    else:
        payload = None
    return Response(payload) if payload else error_response("Panel record was not found.", status.HTTP_404_NOT_FOUND)
