from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.authorization import coordinator_scope_q
from accounts.models import Student
from appointments.models import (
    CoSupervisorNomination,
    PanelRecommendation,
    PanelAppointment,
    SupervisorApplication,
)
from marks.models import EvaluationTask, MarkEntry
from marks.services import ensure_active_period_tasks
from academics.models import AcademicSemester
from academics.services import current_effective_semester
from .actions import build_dashboard_tasks
from .dossiers import build_student_progress_dossier
from .excel import build_template_workbook, parse_timeline_workbook
from .models import (
    SemesterTimeline,
    SemesterTimelineEntry,
    TimelineAuditLog,
    WorkflowReconciliationAudit,
)
from .reports import build_workflow_report, build_workflow_report_workbook
from .reconciliation import (
    ReconciliationConflict,
    ReconciliationError,
    allowed_resolutions,
    accept_reconciliation_issue,
    accepted_issue_audits,
    acceptance_payload,
    can_accept_issue,
    apply_reconciliation_issue,
    detect_reconciliation_issues,
    filter_reconciliation_issues,
    get_reconciliation_issue,
)
from .serializers import (
    TimelineAuditLogSerializer,
    TimelineEntryCreateSerializer,
    TimelineEntrySerializer,
    TimelineEntryUpdateSerializer,
    active_timeline_payload,
)
from .upload_security import validate_timeline_upload
from .timeline_import import create_preview, prepare_rows, verify_preview


User = get_user_model()


def is_office_admin(user):
    return user.role == User.Role.OFFICE_ADMIN


def admin_required_response(user):
    if not is_office_admin(user):
        return Response(
            {"error": "Only Office Staff/Admin can manage semester timelines."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def workflow_reconciliation_view(request):
    denied = admin_required_response(request.user)
    if denied:
        return Response(
            {"error": "Only Office Staff/Admin can access workflow reconciliation."},
            status=status.HTTP_403_FORBIDDEN,
        )
    review_status = request.query_params.get("reviewStatus", "OPEN")
    if review_status not in {"OPEN", "ACCEPTED"}:
        return Response({"error": "Review status must be OPEN or ACCEPTED."}, status=status.HTTP_400_BAD_REQUEST)
    all_issues = detect_reconciliation_issues(include_accepted=True)
    accepted = accepted_issue_audits(all_issues)
    issues = [issue for issue in all_issues if issue.issue_id not in accepted]
    selected = [issue for issue in all_issues if issue.issue_id in accepted] if review_status == "ACCEPTED" else issues
    filtered = filter_reconciliation_issues(selected, request.query_params)
    try:
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(max(int(request.query_params.get("pageSize", 50)), 1), 100)
    except (TypeError, ValueError):
        return Response(
            {"error": "Page and page size must be valid integers."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    start = (page - 1) * page_size
    summary = {
        "total": len(issues),
        "blocking": sum(issue.severity == "BLOCKING" for issue in issues),
        "warnings": sum(issue.severity == "WARNING" for issue in issues),
        "repairable": sum(issue.repairability == "REPAIRABLE" for issue in issues),
        "reviewRequired": sum(
            issue.repairability == "REVIEW_REQUIRED" for issue in issues
        ),
        "accepted": len(accepted),
    }
    programmes = sorted(
        Student.objects.exclude(programme="")
        .values_list("programme", flat=True)
        .distinct()
    )
    return Response(
        {
            "summary": summary,
            "checkedAt": timezone.now(),
            "count": len(filtered),
            "page": page,
            "pageSize": page_size,
            "availableProgrammes": programmes,
            "results": [
                {**issue.to_dict(), **({"acceptance": acceptance_payload(accepted[issue.issue_id])} if issue.issue_id in accepted else {})}
                for issue in filtered[start : start + page_size]
            ],
        }
    )


def reconciliation_admin_required(request):
    if is_office_admin(request.user):
        return None
    return Response(
        {"error": "Only Office Staff/Admin can access workflow reconciliation."},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def workflow_reconciliation_preview_view(request, issue_id):
    denied = reconciliation_admin_required(request)
    if denied:
        return denied
    issue = get_reconciliation_issue(issue_id)
    if issue is None:
        return Response(
            {"error": "Reconciliation issue not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    accepted = accepted_issue_audits([issue]).get(issue.issue_id)
    return Response(
        {
            "issue": {**issue.to_dict(), **({"acceptance": acceptance_payload(accepted)} if accepted else {})},
            "allowedResolutions": allowed_resolutions(issue),
            "canAccept": can_accept_issue(issue) and accepted is None,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def workflow_reconciliation_accept_view(request, issue_id):
    denied = reconciliation_admin_required(request)
    if denied:
        return denied
    fingerprint = str(request.data.get("expectedFingerprint") or "").strip()
    reason = str(request.data.get("reason") or "").strip()
    if len(fingerprint) != 64 or not reason:
        return Response({"error": "A valid expectedFingerprint and a reason are required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return Response(accept_reconciliation_issue(
            issue_id=issue_id, expected_fingerprint=fingerprint, reason=reason, actor=request.user,
        ))
    except ReconciliationConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
    except ReconciliationError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def workflow_reconciliation_apply_view(request, issue_id):
    denied = reconciliation_admin_required(request)
    if denied:
        return denied
    expected_fingerprint = str(request.data.get("expectedFingerprint") or "").strip()
    reason = str(request.data.get("reason") or "").strip()
    resolution = request.data.get("resolution")
    if len(expected_fingerprint) != 64:
        return Response(
            {"error": "A valid expectedFingerprint is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not reason:
        return Response(
            {"error": "A reason is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not isinstance(resolution, dict):
        return Response(
            {"error": "A resolution object is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        result = apply_reconciliation_issue(
            issue_id=issue_id,
            expected_fingerprint=expected_fingerprint,
            reason=reason,
            resolution=resolution,
            actor=request.user,
        )
    except ReconciliationConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
    except ReconciliationError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(result)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def workflow_reconciliation_audits_view(request):
    denied = reconciliation_admin_required(request)
    if denied:
        return denied
    audits = WorkflowReconciliationAudit.objects.select_related("actor")
    for parameter, field in (("entityType", "entity_type"), ("entityId", "entity_id")):
        value = str(request.query_params.get(parameter) or "").strip()
        if value:
            audits = audits.filter(**{field: value})
    count = audits.count()
    return Response(
        {
            "count": count,
            "results": [
                {
                    "id": audit.pk,
                    "issueType": audit.issue_type,
                    "entityType": audit.entity_type,
                    "entityId": audit.entity_id,
                    "action": audit.action,
                    "actor": {
                        "id": audit.actor_id,
                        "name": audit.actor.full_name,
                    },
                    "reason": audit.reason,
                    "fingerprint": audit.fingerprint,
                    "beforeValues": audit.before_values,
                    "afterValues": audit.after_values,
                    "affectedRecords": audit.affected_records,
                    "createdAt": audit.created_at,
                }
                for audit in audits[:200]
            ]
        }
    )


def get_active_timeline():
    semester = current_effective_semester()
    if semester is None:
        return None
    return (
        SemesterTimeline.objects.filter(
            is_published=True,
            academic_semester=semester,
        )
        .prefetch_related("entries")
        .select_related("uploaded_by", "academic_semester")
        .first()
    )


def get_timeline_semester(request):
    raw_id = request.data.get("semesterId") or request.query_params.get(
        "semesterId"
    )
    if raw_id:
        try:
            semester = AcademicSemester.objects.get(pk=raw_id)
        except (AcademicSemester.DoesNotExist, ValueError, TypeError):
            return None
        if semester.lifecycle_status not in {
            AcademicSemester.Lifecycle.DRAFT,
            AcademicSemester.Lifecycle.ACTIVE,
        }:
            return None
        return semester
    return current_effective_semester()


def get_managed_timeline(request):
    semester = get_timeline_semester(request)
    if semester is None:
        return None
    return (
        SemesterTimeline.objects.filter(
            academic_semester=semester,
            is_active=True,
        )
        .prefetch_related("entries")
        .select_related("uploaded_by", "academic_semester")
        .first()
    )


def timeline_locked_response():
    return Response(
        {
            "error": (
                "Timeline changes require a Draft or Active academic semester."
            )
        },
        status=status.HTTP_409_CONFLICT,
    )


def derive_entry_status(deadline_start, deadline_end):
    today = timezone.localdate()
    if today < deadline_start:
        return SemesterTimelineEntry.Status.UPCOMING
    if today > deadline_end:
        return SemesterTimelineEntry.Status.ENDED
    if deadline_start == deadline_end:
        return SemesterTimelineEntry.Status.DEADLINE
    return SemesterTimelineEntry.Status.ACTIVE


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def active_timeline_view(request):
    if request.query_params.get("semesterId"):
        denied = admin_required_response(request.user)
        if denied:
            return denied
        semester = get_timeline_semester(request)
        if semester is not None:
            AcademicSemester.objects.select_for_update().get(pk=semester.pk)
            from .timeline_import import fingerprint
            # Lock period sources before reading both visible rows and their review token.
            fingerprint(semester, lock=True)
        timeline = get_managed_timeline(request)
    else:
        timeline = get_active_timeline()
    if timeline is None:
        return Response(
            {
                "available": False,
                "message": "No timeline available at now",
                "levels": [],
            }
        )
    payload = active_timeline_payload(timeline, user=request.user,
        management=bool(request.query_params.get('semesterId')))
    if request.query_params.get('semesterId'):
        from .calendar_publication import publication_state
        payload['publication'] = publication_state(timeline, request.user)
    return Response(payload)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def publish_timeline_view(request):
    denied = admin_required_response(request.user)
    if denied:
        return denied
    semester = get_timeline_semester(request)
    if semester is None:
        return timeline_locked_response()
    from .calendar_publication import publish_calendar
    try:
        draft = publish_calendar(semester, request.user, request.data.get('reviewToken'))
    except (ValidationError, SemesterTimeline.DoesNotExist) as exc:
        return Response({'error': ' '.join(exc.messages) if isinstance(exc, ValidationError)
            else 'Create a calendar draft before publishing.'}, status=409)
    return Response(active_timeline_payload(draft))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def template_view(request):
    denied = admin_required_response(request.user)
    if denied:
        return denied

    semester = get_timeline_semester(request)
    if semester is None:
        return timeline_locked_response()
    response = HttpResponse(
        build_template_workbook(semester),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = 'attachment; filename="FSKTM_Semester_Timeline_Template.xlsx"'
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def preview_timeline_upload_view(request):
    denied = admin_required_response(request.user)
    if denied:
        return denied
    uploaded_file = request.FILES.get("file")
    if uploaded_file is None:
        return Response({"errors": ["Timeline Excel file is required."]}, status=400)
    semester = get_timeline_semester(request)
    if semester is None:
        return timeline_locked_response()
    try:
        return Response(create_preview(uploaded_file, semester, request.user, request.data.get('mode', 'ADD')))
    except ValidationError as exc:
        return Response({"errors": exc.messages}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_timeline_view(request):
    denied = admin_required_response(request.user)
    if denied:
        return denied
    uploaded_file = request.FILES.get("file")
    if uploaded_file is None:
        return Response({"errors": ["Timeline Excel file is required."]}, status=400)
    upload_errors = validate_timeline_upload(uploaded_file)
    if upload_errors:
        return Response({"errors": upload_errors}, status=400)
    # Preserve full workbook validation even when a token is missing.
    _, errors = parse_timeline_workbook(uploaded_file)
    uploaded_file.seek(0)
    if errors:
        return Response({"errors": errors}, status=400)
    semester = get_timeline_semester(request)
    if semester is None:
        return timeline_locked_response()
    token = request.data.get("previewToken")
    if not token:
        return Response({"errors": ["Preview the workbook before confirming the import."]}, status=400)
    with transaction.atomic():
        semester = AcademicSemester.objects.select_for_update().get(pk=semester.pk)
        if semester.lifecycle_status not in {"DRAFT", "ACTIVE"}:
            return timeline_locked_response()
        try:
            verify_preview(token, uploaded_file, semester, request.user, request.data.get('mode', 'ADD'))
        except ValidationError as exc:
            return Response({"errors": exc.messages}, status=409)
        try:
            rows, warnings = prepare_rows(uploaded_file, semester, request.data.get('mode', 'ADD'))
        except ValidationError as exc:
            return Response({"errors": exc.messages}, status=400)
        if warnings and str(request.data.get("acknowledgeWarnings", "")).lower() != "true":
            return Response({"errors": ["Acknowledge all preview warnings before importing."]}, status=400)
        current = SemesterTimeline.objects.filter(academic_semester=semester, is_active=True)
        replaced = current.exists()
        adding = request.data.get('mode', 'ADD') == 'ADD'
        timeline = current.first() if adding else None
        if timeline is None:
            current.update(is_active=False, replaced_at=timezone.now())
            timeline = SemesterTimeline.objects.create(
                academic_semester=semester, semester=semester.get_term_display(),
                session=semester.academic_session, source_filename=uploaded_file.name,
                uploaded_by=request.user, is_active=True)
        elif adding:
            next_order = timeline.entries.aggregate(value=Max('display_order'))['value'] or 0
            next_steps = {level: timeline.entries.filter(level=level).aggregate(value=Max('step'))['value'] or 0
                for level in ('P1', 'P2')}
            for row in rows:
                next_steps[row['level']] += 1
                next_order += 1
                row['step'] = next_steps[row['level']]
                row['display_order'] = next_order
        SemesterTimelineEntry.objects.bulk_create([
            SemesterTimelineEntry(timeline=timeline, **row) for row in rows])
        TimelineAuditLog.objects.create(actor=request.user, timeline=timeline,
            action=TimelineAuditLog.Action.REPLACE if replaced and not adding else TimelineAuditLog.Action.UPLOAD,
            summary=f"{'Added' if adding else 'Replaced draft with'} {len(rows)} calendar events from {uploaded_file.name}."[:500])
    return Response({"importedCount": len(rows), "timeline": active_timeline_payload(timeline)}, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def timeline_entry_list_view(request):
    denied = admin_required_response(request.user)
    if denied:
        return denied

    semester = get_timeline_semester(request)
    if semester is None:
        return timeline_locked_response()
    # Serialize first-event creation with imports and other calendar mutations.
    semester = AcademicSemester.objects.select_for_update().get(pk=semester.pk)
    if semester.lifecycle_status not in {
        AcademicSemester.Lifecycle.DRAFT, AcademicSemester.Lifecycle.ACTIVE,
    }:
        return timeline_locked_response()
    timeline = get_managed_timeline(request)
    if timeline is None:
        timeline = SemesterTimeline(
            academic_semester=semester,
            semester=semester.get_term_display(),
            session=semester.academic_session,
            uploaded_by=request.user,
        )

    serializer = TimelineEntryCreateSerializer(data=request.data, context={"timeline": timeline})
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if timeline.pk is None:
        timeline.save()

    with transaction.atomic():
        level_entries = SemesterTimelineEntry.objects.select_for_update().filter(
            timeline=timeline,
            level=data["level"],
        )
        next_step = (level_entries.aggregate(max_step=Max("step"))["max_step"] or 0) + 1
        next_display_order = (
            SemesterTimelineEntry.objects.select_for_update().filter(timeline=timeline)
            .aggregate(max_order=Max("display_order"))["max_order"]
            or 0
        ) + 1
        entry = SemesterTimelineEntry.objects.create(
            timeline=timeline,
            level=data["level"],
            step=next_step,
            title=data["title"],
            detail=data["detail"],
            action_owner=data["action"],
            deadline_start=data["deadlineStart"],
            deadline_end=data["deadlineEnd"],
            week_label=data.get("weekLabel", ""),
            target_roles=data["targetRoles"],
            status=derive_entry_status(data["deadlineStart"], data["deadlineEnd"]),
            display_order=next_display_order,
            operational_period=data.get("operational_period"),
            marks_period=data.get("marks_period"),
        )
        TimelineAuditLog.objects.create(
            actor=request.user,
            timeline=timeline,
            entry=entry,
            action=TimelineAuditLog.Action.ADD_ENTRY,
            summary=f"Added {entry.level} entry: {(entry.title or entry.detail)[:120]}",
        )

    return Response(TimelineEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def timeline_entry_detail_view(request, pk):
    denied = admin_required_response(request.user)
    if denied:
        return denied

    try:
        entry = SemesterTimelineEntry.objects.select_related(
            "timeline",
            "timeline__academic_semester",
        ).get(pk=pk)
    except SemesterTimelineEntry.DoesNotExist:
        return Response({"error": "Timeline entry was not found."}, status=status.HTTP_404_NOT_FOUND)
    semester = entry.timeline.academic_semester
    if semester is not None:
        semester = AcademicSemester.objects.select_for_update().get(pk=semester.pk)
        # Refresh after the parent lock so a concurrent replacement cannot edit stale rows.
        entry = SemesterTimelineEntry.objects.select_related("timeline").filter(pk=pk).first()
        if entry is None:
            return Response({"error": "Timeline entry was removed. Reload the timeline."}, status=404)
    if not entry.timeline.is_active:
        return timeline_locked_response()
    if semester is None or semester.lifecycle_status not in {
        AcademicSemester.Lifecycle.DRAFT,
        AcademicSemester.Lifecycle.ACTIVE,
    }:
        return timeline_locked_response()

    if request.method == "DELETE":
        timeline = entry.timeline
        summary = f"Deleted {entry.level} entry: {(entry.title or entry.detail)[:120]}"
        TimelineAuditLog.objects.create(
            actor=request.user,
            timeline=timeline,
            entry=entry,
            action=TimelineAuditLog.Action.DELETE_ENTRY,
            summary=summary,
        )
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = TimelineEntryUpdateSerializer(data=request.data, context={"entry": entry}, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    extension_reason = data.pop("extensionReason", "")
    data.pop("expectedDeadlineEnd", None)
    before_dates = {"deadlineStart": entry.deadline_start.isoformat(), "deadlineEnd": entry.deadline_end.isoformat()}

    if "level" in data and data["level"] != entry.level:
        target_level_entries = SemesterTimelineEntry.objects.filter(
            timeline=entry.timeline,
            level=data["level"],
        )
        entry.level = data["level"]
        entry.step = (target_level_entries.aggregate(max_step=Max("step"))["max_step"] or 0) + 1

    for api_field, model_field in [
        ("detail", "detail"),
        ("title", "title"),
        ("action", "action_owner"),
        ("deadlineStart", "deadline_start"),
        ("deadlineEnd", "deadline_end"),
        ("weekLabel", "week_label"),
        ("targetRoles", "target_roles"),
        ("operational_period", "operational_period"),
        ("marks_period", "marks_period"),
    ]:
        if api_field in data:
            setattr(entry, model_field, data[api_field])

    if "deadlineStart" in data or "deadlineEnd" in data:
        entry.status = derive_entry_status(entry.deadline_start, entry.deadline_end)

    entry.save()
    TimelineAuditLog.objects.create(
        actor=request.user,
        timeline=entry.timeline,
        entry=entry,
        action="EXTEND" if extension_reason else TimelineAuditLog.Action.EDIT_ENTRY,
        summary=f"{'Extended' if extension_reason else 'Updated'} {entry.level} entry: {(entry.title or entry.detail)[:120]}",
        reason=extension_reason,
        before_values=before_dates if extension_reason else {},
        after_values={"deadlineStart": entry.deadline_start.isoformat(), "deadlineEnd": entry.deadline_end.isoformat()} if extension_reason else {},
    )
    return Response(TimelineEntrySerializer(entry).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def timeline_audit_logs_view(request):
    denied = admin_required_response(request.user)
    if denied:
        return denied

    logs = TimelineAuditLog.objects.select_related(
        "actor",
        "timeline",
        "entry",
    )
    semester = get_timeline_semester(request)
    if request.query_params.get("semesterId"):
        if semester is None:
            return timeline_locked_response()
        logs = logs.filter(timeline__academic_semester=semester)
    logs = logs.order_by("-created_at", "-id")[:50]
    return Response({"logs": TimelineAuditLogSerializer(logs, many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_tasks_view(request):
    ensure_active_period_tasks()
    return Response({"tasks": build_dashboard_tasks(request.user)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_summary_view(request):
    ensure_active_period_tasks()
    summary = {
        "activeSupervisees": 0,
        "activePanelAssignments": 0,
        "assignedMarkTasks": 0,
        "pendingSupervisorRequests": 0,
        "pendingSupervisorApprovals": 0,
        "pendingPanelReviews": 0,
        "pendingPanelApprovals": 0,
        "incompleteMarkEntries": 0,
        "overdueMarkEntries": 0,
        "supervisorMarkTasks": 0,
        "panelMarkTasks": 0,
        "backupMarkTasks": 0,
        "submittedMarkEntries": 0,
        "reconciliationIssues": 0,
        "reconciliationBlocking": 0,
    }

    if request.user.role == User.Role.OFFICE_ADMIN:
        reconciliation_issues = detect_reconciliation_issues()
        summary["reconciliationIssues"] = len(reconciliation_issues)
        summary["reconciliationBlocking"] = sum(
            issue.severity == "BLOCKING" for issue in reconciliation_issues
        )
        summary["pendingSupervisorRequests"] = SupervisorApplication.objects.filter(
            status=SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR
        ).count()
        summary["pendingSupervisorApprovals"] = SupervisorApplication.objects.filter(
            status=SupervisorApplication.Status.PENDING_COORDINATOR
        ).count()
        summary["pendingPanelReviews"] = PanelRecommendation.objects.filter(
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL
        ).count()
        summary["pendingPanelApprovals"] = PanelRecommendation.objects.filter(
            status=PanelRecommendation.Status.PENDING_COORDINATOR
        ).count()
        all_tasks = EvaluationTask.objects.filter(
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
        )
    elif request.user.role == User.Role.COORDINATOR:
        summary["pendingSupervisorApprovals"] = SupervisorApplication.objects.filter(
            coordinator_scope_q(request.user, "student__programme"),
            status=SupervisorApplication.Status.PENDING_COORDINATOR,
        ).count()
        summary["pendingPanelApprovals"] = PanelRecommendation.objects.filter(
            coordinator_scope_q(request.user, "profile__programme"),
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
        ).count()
        all_tasks = EvaluationTask.objects.none()
    elif request.user.role == User.Role.LECTURER:
        from appointments.co_supervision import visible_students

        summary["activeSupervisees"] = visible_students(request.user).count()
        summary["activePanelAssignments"] = PanelAppointment.objects.filter(
            panel_member=request.user,
            status=PanelAppointment.Status.ACTIVE,
        ).values("profile__student_id").distinct().count()
        summary["pendingSupervisorRequests"] = SupervisorApplication.objects.filter(
            proposed_supervisor=request.user,
            status=SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
        ).count()
        summary["pendingPanelReviews"] = PanelRecommendation.objects.filter(
            recommended_member=request.user,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        ).count()
        all_tasks = EvaluationTask.objects.filter(
            evaluator=request.user,
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
        )
    else:
        all_tasks = EvaluationTask.objects.none()

    submitted_task_ids = MarkEntry.objects.filter(
        task__in=all_tasks,
        status=MarkEntry.Status.SUBMITTED,
    ).values_list("task_id", flat=True)
    from .co_supervision_tracking import scoped_nominations

    co_nominations = scoped_nominations(request.user)
    if request.user.role == User.Role.LECTURER:
        co_nominations = co_nominations.filter(candidate=request.user)
    if request.user.role in {User.Role.OFFICE_ADMIN, User.Role.LECTURER}:
        summary["pendingSupervisorRequests"] += co_nominations.filter(
            status=CoSupervisorNomination.Status.SUBMITTED_TO_CO_SUPERVISOR
        ).count()
    if request.user.role in {User.Role.OFFICE_ADMIN, User.Role.COORDINATOR}:
        summary["pendingSupervisorApprovals"] += co_nominations.filter(
            status=CoSupervisorNomination.Status.PENDING_COORDINATOR
        ).count()
    summary["supervisorMarkTasks"] = all_tasks.filter(
        evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
    ).count()
    summary["assignedMarkTasks"] = all_tasks.count()
    from appointments.models import ResearchAmendment
    from appointments.research_amendments import scoped_requests
    summary["pendingResearchAmendments"] = scoped_requests(request.user).filter(
        status__in=ResearchAmendment.PENDING_STATUSES
    ).count()
    summary["panelMarkTasks"] = all_tasks.filter(
        evaluator_role=EvaluationTask.EvaluatorRole.PANEL,
    ).count()
    summary["backupMarkTasks"] = all_tasks.filter(
        evaluator_role=EvaluationTask.EvaluatorRole.BACKUP,
    ).count()
    summary["submittedMarkEntries"] = len(submitted_task_ids)
    summary["incompleteMarkEntries"] = all_tasks.exclude(
        pk__in=submitted_task_ids
    ).count()
    from marks.completion_windows import task_due_at

    now = timezone.now()
    summary["overdueMarkEntries"] = sum(
        due is not None and due < now
        for task in all_tasks.exclude(pk__in=submitted_task_ids).select_related(
            "period__academic_semester", "mark_entry"
        ).prefetch_related("completion_windows__granted_by")
        for due in [task_due_at(task, now=now)]
    )

    return Response(summary)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def workflow_report_view(request):
    return Response(build_workflow_report(request.user, request.query_params))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def workflow_report_export_view(request):
    report = build_workflow_report(request.user, request.query_params)
    response = HttpResponse(
        build_workflow_report_workbook(report),
        content_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
    )
    response["Content-Disposition"] = (
        'attachment; filename="workflow_analytics_report.xlsx"'
    )
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_progress_dossier_view(request, student_id):
    return Response(
        build_student_progress_dossier(
            request.user,
            student_id,
        )
    )
