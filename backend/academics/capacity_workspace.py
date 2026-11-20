"""Read-only Office roster of eligible staff and retained capacity/work history."""

from collections import Counter, defaultdict

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import Lecturer, Student
from accounts.project_stages import project_stages
from appointments.models import (
    CoSupervisorAppointment,
    PanelAppointment,
    PanelRecommendation,
    SupervisorAppointment,
    SupervisorApplication,
)
from appointments.rp_rollover import expected_rp2_releases

from .capacity import CapacityRole, derive_capacity_resolution
from .models import (
    AcademicSemester,
    LecturerAvailabilityWindow,
    LecturerCapacityEntry,
    SemesterCapacityPlan,
)
from .permissions import IsOfficeStaffAdmin
from .serializers import _capacity_resolution_payload
from .services import current_effective_semester


def _active_workload(queryset, lecturer_field, student_field):
    """Keep appointment counts for policy and distinct students for roster display."""
    loads = Counter()
    students = defaultdict(Counter)
    incomplete_user_ids = set()
    for user_id, student_id in queryset.order_by().values_list(
        lecturer_field, student_field
    ):
        loads[user_id] += 1
        if student_id is None:
            incomplete_user_ids.add(user_id)
        else:
            students[user_id][student_id] += 1
    return loads, students, incomplete_user_ids


def _stage_counts(appointments, stages, active_load):
    rp1 = rp2 = 0
    for student_id, count in appointments.items():
        answer = stages.get(student_id)
        if answer and answer.stage == "P1":
            rp1 += count
        elif answer and answer.stage == "P2":
            rp2 += count
    return {"rp1": rp1, "rp2": rp2, "withoutStage": active_load - rp1 - rp2}


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsOfficeStaffAdmin])
def capacity_workspace_view(request, pk):
    semester = get_object_or_404(AcademicSemester, pk=pk)
    current_eligible = (
        (Q(supervisor__isnull=False) | Q(panel__isnull=False))
        & Q(user__is_active=True, lifecycle_status=Lecturer.Lifecycle.ACTIVE)
    )
    retained_plan_rows = Q(pk__in=LecturerCapacityEntry.objects.filter(
        plan__academic_semester=semester
    ).values("lecturer_id"))
    ongoing_primary = Q(user_id__in=SupervisorAppointment.objects.filter(
        status=SupervisorAppointment.Status.ACTIVE
    ).values("supervisor_id"))
    ongoing_supporting = Q(user_id__in=CoSupervisorAppointment.objects.filter(
        status=CoSupervisorAppointment.Status.ACTIVE
    ).values("supervisor_id"))
    ongoing_panel = Q(user_id__in=PanelAppointment.objects.filter(
        status=PanelAppointment.Status.ACTIVE
    ).values("panel_member_id"))
    ongoing_reservations = Q(user_id__in=SupervisorApplication.objects.filter(status="PENDING_COORDINATOR").values("proposed_supervisor_id"))
    lecturers = list(
        Lecturer.objects.filter(
            current_eligible | retained_plan_rows
            | ongoing_primary | ongoing_supporting | ongoing_panel | ongoing_reservations
        )
        .select_related("user", "supervisor", "panel")
        .order_by("user__full_name", "staff_no", "pk")
    )
    lecturer_ids = [lecturer.pk for lecturer in lecturers]
    user_ids = [lecturer.user_id for lecturer in lecturers]
    supervisor_releases, panel_releases = expected_rp2_releases(semester, user_ids)
    primary_requests = {row["proposed_supervisor_id"]: row for row in SupervisorApplication.objects.filter(
        proposed_supervisor_id__in=user_ids, status__in=["SUBMITTED_TO_SUPERVISOR", "PENDING_COORDINATOR"]
    ).order_by().values("proposed_supervisor_id").annotate(
        reserved=Count("pk", filter=Q(status="PENDING_COORDINATOR")),
        pending=Count("pk", filter=Q(status="SUBMITTED_TO_SUPERVISOR")))}
    published_plan = (
        SemesterCapacityPlan.objects.filter(
            academic_semester=semester,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        .only("pk", "version")
        .first()
    )
    published_limits = {}
    if published_plan is not None:
        published_limits = {
            entry["lecturer_id"]: entry
            for entry in LecturerCapacityEntry.objects.filter(
                plan=published_plan, lecturer_id__in=lecturer_ids
            ).values("lecturer_id", "supervisor_limit", "panel_limit")
        }

    today = timezone.localdate()
    unavailable_until = {}
    restriction_counts = defaultdict(lambda: {"current": 0, "scheduled": 0})
    for window in LecturerAvailabilityWindow.objects.filter(
        academic_semester=semester,
        lecturer_id__in=lecturer_ids,
        cancelled_at__isnull=True,
        ends_on__gte=today,
    ).values("lecturer_id", "role", "starts_on", "ends_on"):
        key_name = "current" if window["starts_on"] <= today else "scheduled"
        restriction_counts[window["lecturer_id"]][key_name] += 1
        if key_name == "scheduled":
            continue
        key = (window["lecturer_id"], window["role"])
        unavailable_until[key] = max(
            unavailable_until.get(key, window["ends_on"]), window["ends_on"]
        )

    # Policy applies to all active appointments, including appointments originating
    # in earlier semesters. Match the shared resolver's primary + supporting load.
    primary_load, primary_students, _ = _active_workload(
        SupervisorAppointment.objects.filter(
            supervisor_id__in=user_ids, status=SupervisorAppointment.Status.ACTIVE
        ),
        "supervisor_id", "student_id",
    )
    supporting_load, supporting_students, _ = _active_workload(
        CoSupervisorAppointment.objects.filter(
            supervisor_id__in=user_ids, status=CoSupervisorAppointment.Status.ACTIVE
        ),
        "supervisor_id", "student_id",
    )
    panel_load, panel_students, incomplete_panel_identities = _active_workload(
        PanelAppointment.objects.filter(
            panel_member_id__in=user_ids, status=PanelAppointment.Status.ACTIVE
        ),
        "panel_member_id", "profile__student_id",
    )
    student_ids = {
        student_id
        for workload in (primary_students, supporting_students, panel_students)
        for students in workload.values()
        for student_id in students
    }
    current_semester = current_effective_semester() if student_ids else None
    stages = project_stages(current_semester, student_ids) if current_semester else {}
    reservations = {
        row["recommended_member_id"]: row["total"]
        for row in PanelRecommendation.objects.filter(
            recommended_member_id__in=user_ids,
            status__in=PanelRecommendation.WORKLOAD_RESERVED_STATUSES,
        ).order_by().values("recommended_member_id").annotate(total=Count("pk"))
    }

    roster = []
    eligible_lecturers = 0
    for lecturer in lecturers:
        user_id = lecturer.user_id
        identity_incomplete = user_id in incomplete_panel_identities
        limits = published_limits.get(lecturer.pk, {})
        has_supervisor_role = hasattr(lecturer, "supervisor")
        has_panel_role = hasattr(lecturer, "panel")
        participant_eligible = (
            lecturer.user.is_active
            and lecturer.lifecycle_status == Lecturer.Lifecycle.ACTIVE
        )
        can_configure = participant_eligible and (has_supervisor_role or has_panel_role)
        eligible_lecturers += int(can_configure)
        supervisor = None
        panel = None
        for role, exists, limit_key, active_load, reserved_load in (
            (
                CapacityRole.SUPERVISOR, has_supervisor_role,
                "supervisor_limit", primary_load[user_id] + supporting_load[user_id], primary_requests.get(user_id, {}).get("reserved", 0),
            ),
            (
                CapacityRole.PANEL, has_panel_role,
                "panel_limit", panel_load[user_id], reservations.get(user_id, 0),
            ),
        ):
            if not exists:
                continue
            capacity = derive_capacity_resolution(
                semester_id=semester.pk,
                plan_id=published_plan.pk if published_plan is not None else None,
                plan_version=published_plan.version if published_plan is not None else None,
                role=role,
                limit=limits.get(limit_key),
                active_load=active_load,
                reserved_load=reserved_load,
                pending_requests=primary_requests.get(user_id, {}).get("pending", 0) if role == CapacityRole.SUPERVISOR else 0,
                eligible=participant_eligible,
                unavailable_until=unavailable_until.get((lecturer.pk, role.value)),
            )
            releases = supervisor_releases if role == CapacityRole.SUPERVISOR else panel_releases
            resolution = _capacity_resolution_payload(
                capacity, expected_rp2_releases=releases.get(user_id, 0),
            )
            if role == CapacityRole.SUPERVISOR:
                supervisor = resolution
            else:
                panel = resolution
        roster.append({
            "id": lecturer.pk,
            "lecturerId": lecturer.pk,
            "staffNo": lecturer.staff_no,
            "lecturerName": lecturer.user.full_name,
            "participantLifecycle": lecturer.lifecycle_status,
            "userEnabled": lecturer.user.is_active,
            "canConfigure": can_configure,
            "supervisorLimit": limits.get("supervisor_limit"),
            "panelLimit": limits.get("panel_limit"),
            "supervisor": supervisor,
            "panel": panel,
            "workloadStages": {
                "supervisor": _stage_counts(
                    primary_students[user_id] + supporting_students[user_id],
                    stages, primary_load[user_id] + supporting_load[user_id],
                ),
                "panel": _stage_counts(panel_students[user_id], stages, panel_load[user_id]),
            },
            "primaryStudentCount": len(primary_students[user_id]),
            "supportingStudentCount": len(supporting_students[user_id]),
            "panelStudentCount": (
                None if identity_incomplete else len(panel_students[user_id])
            ),
            "activeStudentCount": (
                None if identity_incomplete else len(
                    primary_students[user_id].keys()
                    | supporting_students[user_id].keys()
                    | panel_students[user_id].keys()
                )
            ),
            "workloadIdentityIncomplete": identity_incomplete,
            "availabilitySummary": restriction_counts[lecturer.pk],
        })

    active_students = Student.objects.filter(
        user__is_active=True, status=Student.Status.ACTIVE
    ).count()
    return Response({
        "lecturers": roster,
        "baseline": {
            "activeStudents": active_students,
            "eligibleLecturers": eligible_lecturers,
            "studentsPerLecturer": (
                active_students / eligible_lecturers if eligible_lecturers else None
            ),
        },
    })
