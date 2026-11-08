from appointments.request_visibility import routine_supervisor_requests
from collections import Counter
from datetime import date, datetime
from io import BytesIO

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.dateparse import parse_date
from openpyxl import Workbook
from openpyxl.cell.cell import Cell
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from rest_framework.exceptions import PermissionDenied, ValidationError

from academics.capacity import CapacityRole, CapacityState, resolve_lecturer_capacity
from academics.models import AcademicSemester
from accounts.authorization import (
    coordinator_programme, coordinator_programmes, coordinator_scope_q,
)
from accounts.models import Lecturer, Panel, Student, Supervisor
from appointments.ageing import panel_waiting_metadata, supervisor_waiting_metadata
from appointments.models import PanelRecommendation, SupervisorApplication
from marks.deadlines import mark_deadline_metadata
from marks.models import EvaluationTask, MarkEntry
from marks.completion_windows import task_due_at, task_access

from .models import SemesterTimelineEntry
from .serializers import TimelineEntrySerializer
from .reconciliation import detect_reconciliation_issues
from .co_supervision_tracking import scoped_nominations

User = get_user_model()
AUTHORIZED_ROLES = {
    User.Role.OFFICE_ADMIN,
    User.Role.COORDINATOR,
    User.Role.LECTURER,
}
AGE_BANDS = ("0-3", "4-7", "8-14", "15+")
REPORT_ROLE_NAMES = {
    User.Role.OFFICE_ADMIN: "OFFICE_ADMIN",
    User.Role.COORDINATOR: "COORDINATOR",
    User.Role.LECTURER: "LECTURER",
}


def _parse_optional_date(value, field_name):
    if value in (None, ""):
        return None
    try:
        parsed = parse_date(str(value))
    except ValueError:
        parsed = None
    if parsed is None:
        raise ValidationError({field_name: f"{field_name} must be an ISO date."})
    return parsed


def _date_of(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return (
            timezone.localtime(value).date()
            if timezone.is_aware(value)
            else value.date()
        )
    if isinstance(value, date):
        return value
    return None


def _within_range(value, start_date, end_date):
    record_date = _date_of(value)
    if record_date is None:
        return start_date is None and end_date is None
    if start_date and record_date < start_date:
        return False
    if end_date and record_date > end_date:
        return False
    return True


def _iso(value):
    return value.isoformat() if value is not None else None


def _age_band(days):
    if days is None:
        return None
    if days <= 3:
        return "0-3"
    if days <= 7:
        return "4-7"
    if days <= 14:
        return "8-14"
    return "15+"


def _counts(values):
    return dict(sorted(Counter(values).items()))


def _resolve_semester_filter(params):
    selector = str(params.get("semester") or "active").strip()
    available = list(AcademicSemester.objects.order_by("-starts_on", "-id"))
    if selector in {"all", "unassigned"}:
        return selector, None, available
    if selector == "active":
        semester = next(
            (
                item
                for item in available
                if item.lifecycle_status == AcademicSemester.Lifecycle.ACTIVE
                and item.is_active
            ),
            None,
        )
        return selector, semester, available
    semester = next((item for item in available if item.code == selector), None)
    if semester is None:
        raise ValidationError(
            {"semester": "Select active, all, unassigned, or a valid semester code."}
        )
    return selector, semester, available


def _filter_semester(queryset, lookup, selector, semester):
    if selector == "all":
        return queryset
    if selector == "unassigned":
        return queryset.filter(**{f"{lookup}__isnull": True})
    if semester is None:
        return queryset.none()
    return queryset.filter(**{lookup: semester})


def _semester_row(semester):
    return {
        "semesterId": semester.pk if semester else None,
        "semesterCode": semester.code if semester else None,
        "semester": semester.label if semester else "Legacy / Unassigned",
    }


def _capacity_fields(*, lecturer, semester, role):
    if semester is None:
        return {
            "capacityPlanId": None,
            "capacityPlanVersion": None,
            "capacityState": CapacityState.NOT_CONFIGURED,
            "capacityLimit": 0,
            "capacityLoad": 0,
            "availableSlots": 0,
            "unavailableUntil": None,
        }
    resolution = resolve_lecturer_capacity(
        user=lecturer,
        semester=semester,
        role=role,
    )
    return {
        "capacityPlanId": resolution.plan_id,
        "capacityPlanVersion": resolution.plan_version,
        "capacityState": resolution.state,
        "capacityLimit": resolution.limit or 0,
        "capacityLoad": resolution.active_load + resolution.reserved_load,
        "availableSlots": resolution.available_slots,
        "unavailableUntil": _iso(resolution.unavailable_until),
    }


def _capacity_summary(user, semester):
    if user.role != User.Role.OFFICE_ADMIN or semester is None:
        return None, []
    states = tuple(state.value for state in CapacityState)
    summary = {
        "semesterId": semester.pk,
        "semesterCode": semester.code,
        "supervisor": {state: 0 for state in states},
        "panel": {state: 0 for state in states},
    }
    attention = []
    role_specs = (
        (CapacityRole.SUPERVISOR, Supervisor, "supervisor"),
        (CapacityRole.PANEL, Panel, "panel"),
    )
    for role, role_model, key in role_specs:
        lecturers = Lecturer.objects.select_related("user").filter(
            pk__in=role_model.objects.values_list("lecturer_id", flat=True)
        )
        for lecturer in lecturers:
            resolution = resolve_lecturer_capacity(
                user=lecturer.user,
                semester=semester,
                role=role,
            )
            summary[key][resolution.state] += 1
            reportable = resolution.state in {
                CapacityState.OVER_CAPACITY,
                CapacityState.TEMPORARILY_UNAVAILABLE,
            } or (
                resolution.state == CapacityState.NOT_CONFIGURED
                and semester.lifecycle_status == AcademicSemester.Lifecycle.ACTIVE
            )
            if not reportable:
                continue
            attention.append(
                {
                    "kind": "LECTURER_CAPACITY",
                    "recordType": "LECTURER_CAPACITY",
                    "recordId": lecturer.staff_no,
                    "studentId": None,
                    "label": f"{lecturer.user.full_name} - {role.value.title()} {resolution.state.replace('_', ' ').title()}",
                    "programme": lecturer.department or None,
                    "waitingDays": None,
                    "waitingOn": None,
                    "deadlineState": None,
                    "dueAt": None,
                    "targetModule": "DASHBOARD",
                    "capacityRole": role.value,
                    "capacityState": resolution.state,
                    "unavailableUntil": _iso(resolution.unavailable_until),
                }
            )
    return summary, attention


def _module_summary(records):
    waiting_records = [
        record for record in records if record["waitingDays"] is not None
    ]
    return {
        "total": len(records),
        "statusCounts": _counts(record["status"] for record in records),
        "waitingOwnerCounts": _counts(
            record["waitingOn"] for record in waiting_records if record["waitingOn"]
        ),
        "ageBands": {
            band: sum(record["ageBand"] == band for record in waiting_records)
            for band in AGE_BANDS
        },
        "records": records,
    }


def _scope_supervisor_records(user, programme, selector, semester):
    records = SupervisorApplication.objects.select_related(
        "student",
        "student__user",
        "proposed_supervisor",
        "academic_semester",
        "appointment__ended_by",
        "appointment__supersedes",
    ).prefetch_related("workflow_events")
    records = routine_supervisor_requests(records, user)
    if user.role == User.Role.COORDINATOR:
        records = records.filter(coordinator_scope_q(user, "student__programme"))
    elif user.role == User.Role.LECTURER:
        records = records.filter(proposed_supervisor=user)
    if programme:
        records = records.filter(student__programme__trim__iexact=programme)
    return _filter_semester(
        records,
        "academic_semester",
        selector,
        semester,
    )


def _scope_panel_records(user, programme, selector, semester):
    records = PanelRecommendation.objects.select_related(
        "profile",
        "supervisor",
        "recommended_member",
        "academic_semester",
        "panel_appointment__ended_by",
        "panel_appointment__supersedes",
    ).prefetch_related("workflow_events")
    if user.role == User.Role.COORDINATOR:
        records = records.filter(coordinator_scope_q(user, "profile__programme"))
    elif user.role == User.Role.LECTURER:
        records = records.filter(recommended_member=user)
    if programme:
        records = records.filter(profile__programme__trim__iexact=programme)
    return _filter_semester(
        records,
        "academic_semester",
        selector,
        semester,
    )


def _supervisor_rows(
    user,
    programme,
    start_date,
    end_date,
    now,
    selector,
    semester,
):
    rows = []
    for application in _scope_supervisor_records(
        user,
        programme,
        selector,
        semester,
    ):
        if not _within_range(application.submitted_at, start_date, end_date):
            continue
        waiting = supervisor_waiting_metadata(application, now=now)
        rows.append(
            {
                "recordType": "SUPERVISOR_APPLICATION",
                "recordId": str(application.pk),
                "studentId": application.student.matric_no,
                "studentName": application.student.user.full_name,
                "programme": application.student.programme,
                "researchTitle": application.research_title,
                "researchArea": application.research_area,
                "assignee": application.proposed_supervisor.full_name,
                "status": application.status,
                "reportDate": _iso(application.submitted_at),
                "waitingSince": _iso(waiting["waitingSince"]),
                "waitingDays": waiting["waitingDays"],
                "waitingOn": waiting["waitingOn"],
                "ageBand": _age_band(waiting["waitingDays"]),
                "appointmentStatus": (
                    application.appointment.status
                    if hasattr(application, "appointment")
                    else None
                ),
                "appointmentOutcome": (
                    application.appointment.end_outcome or None
                    if hasattr(application, "appointment")
                    else None
                ),
                "appointmentEndedAt": (
                    _iso(application.appointment.ended_at)
                    if hasattr(application, "appointment")
                    else None
                ),
                "appointmentEndReason": (
                    application.appointment.end_reason or None
                    if hasattr(application, "appointment")
                    else None
                ),
                "appointmentEndedBy": (
                    application.appointment.ended_by.full_name
                    if hasattr(application, "appointment")
                    and application.appointment.ended_by_id
                    else None
                ),
                "supersedesAppointmentId": (
                    application.appointment.supersedes_id
                    if hasattr(application, "appointment")
                    else None
                ),
                "replacementAppointmentId": (
                    application.appointment.replacement_appointment.pk
                    if hasattr(application, "appointment")
                    and hasattr(application.appointment, "replacement_appointment")
                    else None
                ),
                **_capacity_fields(
                    lecturer=application.proposed_supervisor,
                    semester=application.academic_semester,
                    role=CapacityRole.SUPERVISOR,
                ),
                **_semester_row(application.academic_semester),
            }
        )
    return rows


def _co_supervisor_rows(user, programme, start_date, end_date, now, selector, semester):
    from appointments.ageing import elapsed_calendar_days
    from appointments.co_supervision import can_read_team
    from appointments.models import CoSupervisorNomination

    records = _filter_semester(
        scoped_nominations(user, programme), "academic_semester", selector, semester
    )
    rows = []
    for nomination in records.select_related(
        "appointment__ended_by",
        "appointment__replacement_appointment",
        "student__user__research_profile",
    ):
        if not _within_range(nomination.submitted_at, start_date, end_date):
            continue
        waiting_since = None
        waiting_on = None
        if nomination.status in CoSupervisorNomination.PENDING_STATUSES:
            waiting_on = "CO_SUPERVISOR"
            waiting_since = nomination.submitted_at
            if nomination.status == CoSupervisorNomination.Status.PENDING_COORDINATOR:
                waiting_on = "PROGRAMME_COORDINATOR"
                waiting_since = nomination.candidate_decided_at or nomination.updated_at
        waiting_days = elapsed_calendar_days(waiting_since, now=now)
        appointment = getattr(nomination, "appointment", None)
        successor = (
            getattr(appointment, "replacement_appointment", None)
            if appointment
            else None
        )
        profile = (
            getattr(nomination.student.user, "research_profile", None)
            if can_read_team(user, nomination.student)
            else None
        )
        rows.append(
            {
                "recordType": "CO_SUPERVISOR_NOMINATION",
                "recordId": str(nomination.pk),
                "supervisionRole": "CO_SUPERVISOR",
                "studentId": nomination.student.matric_no,
                "studentName": nomination.student.user.full_name,
                "programme": nomination.student.programme,
                "researchTitle": profile.proposed_topic if profile else "",
                "researchArea": profile.research_area if profile else "",
                "assignee": nomination.candidate.full_name,
                "nominator": nomination.nominator.full_name,
                "status": nomination.status,
                "reportDate": _iso(nomination.submitted_at),
                "waitingSince": _iso(waiting_since),
                "waitingDays": waiting_days,
                "waitingOn": waiting_on,
                "ageBand": _age_band(waiting_days),
                "appointmentStatus": appointment.status if appointment else None,
                "appointmentOutcome": (
                    appointment.end_outcome or None if appointment else None
                ),
                "appointmentEndedAt": (
                    _iso(appointment.ended_at) if appointment else None
                ),
                "appointmentEndReason": (
                    appointment.end_reason or None if appointment else None
                ),
                "appointmentEndedBy": (
                    appointment.ended_by.full_name
                    if appointment and appointment.ended_by_id
                    else None
                ),
                "supersedesAppointmentId": (
                    appointment.supersedes_id if appointment else None
                ),
                "replacementAppointmentId": successor.pk if successor else None,
                **_capacity_fields(
                    lecturer=nomination.candidate,
                    semester=nomination.academic_semester,
                    role=CapacityRole.SUPERVISOR,
                ),
                **_semester_row(nomination.academic_semester),
            }
        )
    return rows


def _panel_rows(
    user,
    programme,
    start_date,
    end_date,
    now,
    selector,
    semester,
):
    rows = []
    for recommendation in _scope_panel_records(
        user,
        programme,
        selector,
        semester,
    ):
        report_date = recommendation.submitted_at or recommendation.created_at
        if not _within_range(report_date, start_date, end_date):
            continue
        waiting = panel_waiting_metadata(recommendation, now=now)
        rows.append(
            {
                "recordType": "PANEL_RECOMMENDATION",
                "recordId": str(recommendation.pk),
                "studentId": recommendation.profile.matric_no,
                "studentName": recommendation.profile.student_name,
                "programme": recommendation.profile.programme,
                "researchTitle": recommendation.profile.proposed_topic,
                "researchArea": recommendation.profile.research_area,
                "assignee": recommendation.recommended_member.full_name,
                "status": recommendation.status,
                "reportDate": _iso(report_date),
                "waitingSince": _iso(waiting["waitingSince"]),
                "waitingDays": waiting["waitingDays"],
                "waitingOn": waiting["waitingOn"],
                "ageBand": _age_band(waiting["waitingDays"]),
                "appointmentStatus": (
                    recommendation.panel_appointment.status
                    if hasattr(recommendation, "panel_appointment")
                    else None
                ),
                "appointmentOutcome": (
                    recommendation.panel_appointment.end_outcome or None
                    if hasattr(recommendation, "panel_appointment")
                    else None
                ),
                "appointmentEndedAt": (
                    _iso(recommendation.panel_appointment.ended_at)
                    if hasattr(recommendation, "panel_appointment")
                    else None
                ),
                "appointmentEndReason": (
                    recommendation.panel_appointment.end_reason or None
                    if hasattr(recommendation, "panel_appointment")
                    else None
                ),
                "appointmentEndedBy": (
                    recommendation.panel_appointment.ended_by.full_name
                    if hasattr(recommendation, "panel_appointment")
                    and recommendation.panel_appointment.ended_by_id
                    else None
                ),
                "supersedesAppointmentId": (
                    recommendation.panel_appointment.supersedes_id
                    if hasattr(recommendation, "panel_appointment")
                    else None
                ),
                "replacementAppointmentId": (
                    recommendation.panel_appointment.replacement_appointment.pk
                    if hasattr(recommendation, "panel_appointment")
                    and hasattr(
                        recommendation.panel_appointment,
                        "replacement_appointment",
                    )
                    else None
                ),
                **_capacity_fields(
                    lecturer=recommendation.recommended_member,
                    semester=recommendation.academic_semester,
                    role=CapacityRole.PANEL,
                ),
                **_semester_row(recommendation.academic_semester),
            }
        )
    return rows


def _mark_rows(
    user,
    programme,
    start_date,
    end_date,
    now,
    selector,
    semester,
):
    if user.role == User.Role.COORDINATOR:
        return None
    tasks = EvaluationTask.objects.filter(
        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
    ).select_related(
        "profile__student__student",
        "evaluator__lecturer",
        "period",
        "period__academic_semester",
        "mark_entry",
    ).prefetch_related("completion_windows__granted_by")
    if user.role == User.Role.LECTURER:
        tasks = tasks.filter(evaluator=user)
    elif programme:
        tasks = tasks.filter(profile__programme=programme)
    tasks = _filter_semester(
        tasks,
        "period__academic_semester",
        selector,
        semester,
    )

    rows = []
    for task in tasks:
        effective_due_at = task_due_at(task, now=now)
        report_date = effective_due_at or task.assigned_at
        if not _within_range(report_date, start_date, end_date):
            continue
        try:
            entry = task.mark_entry
        except MarkEntry.DoesNotExist:
            entry = None
        entry_status = entry.status if entry else MarkEntry.Status.NOT_STARTED
        deadline = mark_deadline_metadata(
            effective_due_at,
            is_submitted=entry_status == MarkEntry.Status.SUBMITTED,
            now=now,
        )
        rows.append(
            {
                "recordType": "MARK_TASK",
                "recordId": str(task.pk),
                "studentId": task.profile.matric_no,
                "studentName": task.profile.student_name,
                "programme": task.profile.programme,
                "assignee": task.evaluator.full_name,
                "status": entry_status,
                "evaluatorRole": task.evaluator_role,
                "completionWindowStatus": (task_access(task, now=now).get("completionWindow") or {}).get("status"),
                "reportDate": _iso(report_date),
                **_semester_row(task.period.academic_semester),
                **deadline,
                "dueAt": _iso(deadline["dueAt"]),
            }
        )
    return rows


def _timeline_status(entry, today):
    if entry.linked_period:
        return TimelineEntrySerializer().get_status(entry).upper()
    start, end = entry.projected_dates
    if today < start:
        return "UPCOMING"
    if today > end:
        return "ENDED"
    if start == end:
        return "DEADLINE"
    return "ACTIVE"


def _timeline_rows(
    user,
    start_date,
    end_date,
    today,
    selector,
    semester,
):
    if user.role == User.Role.COORDINATOR:
        return None
    rows = []
    entries = SemesterTimelineEntry.objects.select_related(
        "timeline",
        "timeline__academic_semester",
        "marks_period", "operational_period",
    ).filter(
        timeline__is_active=True,
    )
    entries = _filter_semester(
        entries,
        "timeline__academic_semester",
        selector,
        semester,
    )
    for entry in entries:
        projected_start, projected_end = entry.projected_dates
        if user.role == User.Role.LECTURER and "LECTURER" not in entry.target_roles:
            continue
        if not _within_range(projected_start, start_date, end_date):
            continue
        rows.append(
            {
                "recordType": "TIMELINE_ENTRY",
                "recordId": str(entry.pk),
                "title": entry.title or entry.detail,
                "level": entry.level,
                "status": _timeline_status(entry, today),
                "targetRoles": entry.target_roles,
                "reportDate": projected_start.isoformat(),
                "dueAt": projected_end.isoformat(),
                **_semester_row(entry.timeline.academic_semester),
            }
        )
    return rows


def _marks_summary(rows):
    if rows is None:
        return None
    submitted = sum(row["status"] == MarkEntry.Status.SUBMITTED for row in rows)
    return {
        "total": len(rows),
        "statusCounts": _counts(row["status"] for row in rows),
        "deadlineStateCounts": _counts(row["deadlineState"] for row in rows),
        "evaluatorRoleCounts": _counts(row["evaluatorRole"] for row in rows),
        "completionRate": round((submitted / len(rows)) * 100, 1) if rows else None,
        "records": rows,
    }


def _timeline_summary(rows):
    if rows is None:
        return None
    role_counts = Counter()
    for row in rows:
        role_counts.update(row["targetRoles"])
    return {
        "total": len(rows),
        "statusCounts": _counts(row["status"] for row in rows),
        "levelCounts": _counts(row["level"] for row in rows),
        "targetRoleCounts": dict(sorted(role_counts.items())),
        "records": rows,
    }


def _attention(supervisor_rows, panel_rows, mark_rows, lifecycle_items=None):
    items = list(lifecycle_items or [])
    for row in [*supervisor_rows, *panel_rows]:
        if row["waitingDays"] is None:
            continue
        items.append(
            {
                "kind": "WAITING",
                "recordType": row["recordType"],
                "recordId": row["recordId"],
                "studentId": row["studentId"],
                "label": f'{row["studentName"]} - {row["status"]}',
                "programme": row["programme"],
                "waitingDays": row["waitingDays"],
                "waitingOn": row["waitingOn"],
                "deadlineState": None,
                "dueAt": None,
            }
        )
    for row in mark_rows or []:
        if row["deadlineState"] != "OVERDUE":
            continue
        items.append(
            {
                "kind": "DEADLINE",
                "recordType": row["recordType"],
                "recordId": row["recordId"],
                "studentId": row["studentId"],
                "label": f'{row["studentName"]} - {row["evaluatorRole"]} marks',
                "programme": row["programme"],
                "waitingDays": None,
                "waitingOn": None,
                "deadlineState": row["deadlineState"],
                "dueAt": row["dueAt"],
            }
        )
    return sorted(
        items,
        key=lambda item: (
            0 if item["kind"] == "DEADLINE" else 1,
            -(item["waitingDays"] or 0),
            item["label"],
        ),
    )[:20]


def _participant_lifecycle_summary(user, programme):
    if user.role != User.Role.OFFICE_ADMIN:
        return None, []
    students = Student.objects.select_related("user")
    if programme:
        students = students.filter(programme__iexact=programme)
    lecturers = Lecturer.objects.select_related("user")
    counts = {
        "activeStudents": students.filter(status=Student.Status.ACTIVE).count(),
        "deferredStudents": students.filter(status=Student.Status.DEFERRED).count(),
        "graduatedStudents": students.filter(status=Student.Status.GRADUATED).count(),
        "withdrawnStudents": students.filter(status=Student.Status.WITHDRAWN).count(),
        "activeLecturers": lecturers.filter(
            lifecycle_status=Lecturer.Lifecycle.ACTIVE
        ).count(),
        "retiringLecturers": lecturers.filter(
            lifecycle_status=Lecturer.Lifecycle.RETIRING
        ).count(),
        "retiredLecturers": lecturers.filter(
            lifecycle_status=Lecturer.Lifecycle.RETIRED
        ).count(),
        "resignedLecturers": lecturers.filter(
            lifecycle_status=Lecturer.Lifecycle.RESIGNED
        ).count(),
    }
    attention = [
        {
            "kind": "PARTICIPANT_LIFECYCLE",
            "recordType": "STUDENT_PARTICIPANT",
            "recordId": student.matric_no,
            "studentId": student.matric_no,
            "label": f"{student.user.full_name} - Deferred",
            "programme": student.programme,
            "waitingDays": None,
            "waitingOn": None,
            "deadlineState": None,
            "dueAt": None,
            "participantStatus": "DEFERRED",
            "targetModule": "DASHBOARD",
        }
        for student in students.filter(status=Student.Status.DEFERRED)
    ]
    attention.extend(
        {
            "kind": "PARTICIPANT_LIFECYCLE",
            "recordType": "LECTURER_PARTICIPANT",
            "recordId": lecturer.staff_no,
            "studentId": None,
            "label": f"{lecturer.user.full_name} - Retiring",
            "programme": lecturer.department,
            "waitingDays": None,
            "waitingOn": None,
            "deadlineState": None,
            "dueAt": None,
            "participantStatus": "RETIRING",
            "targetModule": "DASHBOARD",
        }
        for lecturer in lecturers.filter(lifecycle_status=Lecturer.Lifecycle.RETIRING)
    )
    return counts, attention


def build_workflow_report(user, query_params=None, now=None):
    if user.role not in AUTHORIZED_ROLES:
        raise PermissionDenied("Workflow reports are not available for this role.")

    params = query_params or {}
    start_date = _parse_optional_date(params.get("startDate"), "startDate")
    end_date = _parse_optional_date(params.get("endDate"), "endDate")
    if start_date and end_date and start_date > end_date:
        raise ValidationError({"endDate": "endDate must be on or after startDate."})

    now = now or timezone.now()
    semester_selector, selected_semester, available_semesters = (
        _resolve_semester_filter(params)
    )
    programme = None
    if user.role in {User.Role.COORDINATOR, User.Role.OFFICE_ADMIN}:
        programme = str(params.get("programme") or "").strip() or None

    available_programmes = (
        sorted(
            {
                value.strip()
                for value in list(
                    SupervisorApplication.objects.values_list(
                        "student__programme", flat=True
                    )
                )
                + list(
                    PanelRecommendation.objects.values_list(
                        "profile__programme", flat=True
                    )
                )
                + list(
                    EvaluationTask.objects.filter(
                        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
                    ).values_list("profile__programme", flat=True)
                )
                if value and value.strip()
            }
        )
        if user.role == User.Role.OFFICE_ADMIN
        else coordinator_programmes(user)
    )

    supervisor_rows = _supervisor_rows(
        user,
        programme,
        start_date,
        end_date,
        now,
        semester_selector,
        selected_semester,
    )
    for row in supervisor_rows:
        row["supervisionRole"] = "PRIMARY"
    supervisor_rows.extend(
        _co_supervisor_rows(
            user,
            programme,
            start_date,
            end_date,
            now,
            semester_selector,
            selected_semester,
        )
    )
    panel_rows = _panel_rows(
        user,
        programme,
        start_date,
        end_date,
        now,
        semester_selector,
        selected_semester,
    )
    mark_rows = _mark_rows(
        user,
        programme,
        start_date,
        end_date,
        now,
        semester_selector,
        selected_semester,
    )
    timeline_rows = _timeline_rows(
        user,
        start_date,
        end_date,
        timezone.localtime(now).date(),
        semester_selector,
        selected_semester,
    )
    from .amendment_tracking import amendment_report_rows
    amendment_rows = amendment_report_rows(user, programme, start_date, end_date, now,
                                            semester_selector, selected_semester)
    waiting_days = [
        row["waitingDays"]
        for row in [*supervisor_rows, *panel_rows, *amendment_rows]
        if row["waitingDays"] is not None
    ]
    all_sections = [
        amendment_rows,
        supervisor_rows,
        panel_rows,
        mark_rows or [],
        timeline_rows or [],
    ]
    participant_lifecycle, participant_attention = _participant_lifecycle_summary(
        user, programme
    )
    capacity, capacity_attention = _capacity_summary(user, selected_semester)
    reconciliation_issues = (
        detect_reconciliation_issues() if user.role == User.Role.OFFICE_ADMIN else []
    )
    reconciliation_summary = (
        {
            "total": len(reconciliation_issues),
            "blocking": sum(
                issue.severity == "BLOCKING" for issue in reconciliation_issues
            ),
            "warnings": sum(
                issue.severity == "WARNING" for issue in reconciliation_issues
            ),
            "repairable": sum(
                issue.repairability == "REPAIRABLE" for issue in reconciliation_issues
            ),
            "reviewRequired": sum(
                issue.repairability == "REVIEW_REQUIRED"
                for issue in reconciliation_issues
            ),
        }
        if user.role == User.Role.OFFICE_ADMIN
        else None
    )

    return {
        "generatedAt": now.isoformat(),
        "scope": {
            "role": REPORT_ROLE_NAMES[user.role],
            "programme": (
                coordinator_programme(user)
                if user.role == User.Role.COORDINATOR else programme
            ),
            "programmes": available_programmes,
        },
        "filters": {
            "startDate": start_date.isoformat() if start_date else None,
            "endDate": end_date.isoformat() if end_date else None,
            "programme": programme,
            "availableProgrammes": available_programmes,
            "semester": semester_selector,
            "selectedSemester": (
                _semester_row(selected_semester) if selected_semester else None
            ),
            "availableSemesters": [
                {
                    **_semester_row(item),
                    "lifecycleStatus": item.lifecycle_status,
                    "effectiveStatus": item.effective_status,
                }
                for item in available_semesters
            ],
        },
        "overview": {
            "totalRecords": sum(len(section) for section in all_sections),
            "pendingApprovals": len(waiting_days),
            "averageWaitingDays": (
                round(sum(waiting_days) / len(waiting_days), 1)
                if waiting_days
                else None
            ),
            "longestWaitingDays": max(waiting_days) if waiting_days else None,
            "marksCompletionRate": (
                _marks_summary(mark_rows)["completionRate"]
                if mark_rows is not None
                else None
            ),
            "overdueMarks": sum(
                row["deadlineState"] == "OVERDUE" for row in mark_rows or []
            ),
            "activeTimelineEntries": sum(
                row["status"] in {"ACTIVE", "DEADLINE"} for row in timeline_rows or []
            ),
        },
        "supervisor": _module_summary(supervisor_rows),
        "researchAmendments": _module_summary(amendment_rows),
        "panel": _module_summary(panel_rows),
        "marks": _marks_summary(mark_rows),
        "timeline": _timeline_summary(timeline_rows),
        "participantLifecycle": participant_lifecycle,
        "capacity": capacity,
        "reconciliation": reconciliation_summary,
        "attention": _attention(
            [*supervisor_rows, *amendment_rows],
            panel_rows,
            mark_rows,
            [*participant_attention, *capacity_attention],
        )
        + [
            {
                "kind": "RECONCILIATION",
                "studentId": issue.student_id,
                "label": issue.title,
                "programme": issue.programme or "Faculty-wide",
                "waitingDays": None,
                "waitingOn": None,
                "deadlineState": None,
                "dueAt": None,
                "targetModule": "DASHBOARD",
                "recordType": "RECONCILIATION_ISSUE",
                "recordId": issue.issue_id,
            }
            for issue in reconciliation_issues
            if issue.severity == "BLOCKING"
        ][:20],
    }


def _append_literal_row(sheet, values):
    cells = []
    for value in values:
        cell = Cell(sheet, value=value)
        if isinstance(value, str):
            # openpyxl infers formulas and error cells from string content.
            # Report text must remain literal without changing numeric cells.
            cell.data_type = "s"
        cells.append(cell)
    sheet.append(cells)


def _append_sheet(workbook, title, headers, rows):
    sheet = workbook.create_sheet(title=title)
    _append_literal_row(sheet, [label for _key, label in headers])
    for row in rows:
        _append_literal_row(sheet, [row.get(key) for key, _label in headers])
    for column_index, (_key, label) in enumerate(headers, start=1):
        sheet.cell(1, column_index).font = Font(bold=True, color="FFFFFF")
        sheet.cell(1, column_index).fill = PatternFill("solid", fgColor="1E3A5F")
        column_widths = [
            len(label),
            *[
                len(str(sheet.cell(row_index, column_index).value or ""))
                for row_index in range(2, sheet.max_row + 1)
            ],
        ]
        width = min(42, max(column_widths) + 2)
        sheet.column_dimensions[get_column_letter(column_index)].width = width
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    return sheet


def build_workflow_report_workbook(report):
    workbook = Workbook()
    _append_sheet(workbook, 'Research Amendments', [
        ('recordId', 'Request ID'), ('studentId', 'Student ID'), ('studentName', 'Student Name'),
        ('kind', 'Type'), ('status', 'Status'), ('sourceProgramme', 'Source Programme'),
        ('destinationProgramme', 'Destination Programme'), ('waitingOn', 'Responsible Stage'),
        ('waitingDays', 'Waiting Days'), ('reportDate', 'Requested At'),
    ], report.get('researchAmendments', {}).get('records', []))
    summary = workbook.active
    summary.title = "Summary"
    summary_rows = [
        ("Generated At", report["generatedAt"]),
        ("Role", report["scope"]["role"]),
        ("Programme", report["filters"]["programme"] or ", ".join(report["scope"].get("programmes", [])) or "All authorised programmes"),
        ("Start Date", report["filters"]["startDate"] or "All"),
        ("End Date", report["filters"]["endDate"] or "All"),
        ("Semester", report["filters"]["semester"]),
    ] + [(key, value) for key, value in report["overview"].items()]
    if report.get("participantLifecycle"):
        summary_rows.extend(
            (f"Participant {key}", value)
            for key, value in report["participantLifecycle"].items()
        )
    for row in summary_rows:
        _append_literal_row(summary, row)
    summary["A1"].font = Font(bold=True)
    summary.column_dimensions["A"].width = 28
    summary.column_dimensions["B"].width = 30

    workflow_headers = [
        ("recordId", "Record ID"),
        ("semesterId", "Semester ID"),
        ("semesterCode", "Semester Code"),
        ("semester", "Semester"),
        ("studentId", "Student ID"),
        ("studentName", "Student Name"),
        ("programme", "Programme"),
        ("researchTitle", "Research Title"),
        ("researchArea", "Research Area"),
        ("assignee", "Assigned To"),
        ("status", "Status"),
        ("reportDate", "Report Date"),
        ("waitingSince", "Waiting Since"),
        ("waitingDays", "Waiting Days"),
        ("waitingOn", "Waiting On"),
        ("ageBand", "Age Band"),
        ("appointmentStatus", "Appointment Status"),
        ("appointmentOutcome", "Appointment Outcome"),
        ("appointmentEndedAt", "Appointment Ended At"),
        ("appointmentEndReason", "Appointment End Reason"),
        ("appointmentEndedBy", "Appointment Ended By"),
        ("supersedesAppointmentId", "Supersedes Appointment ID"),
        ("replacementAppointmentId", "Replacement Appointment ID"),
        ("capacityPlanId", "Capacity Plan ID"),
        ("capacityPlanVersion", "Capacity Plan Version"),
        ("capacityState", "Capacity State"),
        ("capacityLimit", "Capacity Limit"),
        ("capacityLoad", "Capacity Load"),
        ("availableSlots", "Available Slots"),
        ("unavailableUntil", "Unavailable Until"),
        ("recordType", "Record Type"),
        ("supervisionRole", "Supervision Role"),
    ]
    _append_sheet(
        workbook,
        "Supervisor",
        workflow_headers,
        report["supervisor"]["records"],
    )
    _append_sheet(
        workbook,
        "Panel",
        workflow_headers,
        report["panel"]["records"],
    )
    if report["marks"] is not None:
        _append_sheet(
            workbook,
            "Marks",
            [
                ("recordId", "Record ID"),
                ("semesterId", "Semester ID"),
                ("semesterCode", "Semester Code"),
                ("semester", "Semester"),
                ("studentId", "Student ID"),
                ("studentName", "Student Name"),
                ("programme", "Programme"),
                ("assignee", "Evaluator"),
                ("evaluatorRole", "Evaluator Role"),
                ("status", "Status"),
                ("deadlineState", "Deadline State"),
                ("dueAt", "Due At"),
                ("daysUntilDue", "Days Until Due"),
                ("completionWindowStatus", "Completion Window"),
            ],
            report["marks"]["records"],
        )
    if report["timeline"] is not None:
        timeline_rows = [
            {**row, "targetRoles": ", ".join(row["targetRoles"])}
            for row in report["timeline"]["records"]
        ]
        _append_sheet(
            workbook,
            "Timeline",
            [
                ("recordId", "Record ID"),
                ("semesterId", "Semester ID"),
                ("semesterCode", "Semester Code"),
                ("semester", "Semester"),
                ("title", "Title"),
                ("level", "Level"),
                ("status", "Status"),
                ("targetRoles", "Target Roles"),
                ("reportDate", "Start Date"),
                ("dueAt", "End Date"),
            ],
            timeline_rows,
        )

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()
