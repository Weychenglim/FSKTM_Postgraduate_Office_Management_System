from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F, Q
from django.db.models.functions import Lower, Trim
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import AcademicSemester
from accounts.models import Lecturer, Student
from accounts.authorization import office_actor, can_correct_marks
from academics.services import current_effective_semester
from appointments.models import StudentResearchProfile

from .completion_windows import task_access, task_due_at, window_payload, grant_completion_windows, revoke_completion_window
from .deadlines import mark_deadline_metadata
from .targeting import profile_programme, programme_options, recipient_preview
from .models import (
    EvaluationPeriod,
    EvaluationTask,
    MarkEntry,
    MarksConfigurationAudit,
    Rubric,
    RubricComponent,
)
from .serializers import (
    EvaluationPeriodCreateSerializer,
    EvaluationPeriodUpdateSerializer,
    EvaluationTaskSerializer,
    SubmittedEvaluationSerializer,
    MarkDraftSerializer,
    MarkSubmissionSerializer,
    ReasonSerializer,
    SubmittedMarksCorrectionSerializer,
    SubmittedMarksReasonSerializer,
    RubricComponentInputSerializer,
    RubricCreateSerializer,
    RubricUpdateSerializer,
)
from .services import (
    MarksStateConflict,
    archive_evaluation_period,
    set_rubric_family_archived,
    clone_rubric_version,
    close_evaluation_period,
    create_evaluation_period,
    create_backup_evaluation_task,
    create_rubric,
    create_rubric_component,
    correct_submitted_marks,
    delete_draft_evaluation_period,
    ensure_active_period_tasks,
    ensure_period_tasks,
    publish_evaluation_period,
    reopen_submitted_marks,
    submitted_marks_version,
    update_evaluation_period,
    update_rubric,
    update_rubric_component,
)


User = get_user_model()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_mark_records_view(request):
    if not office_only(request.user):
        return Response({'error': 'Only Office Staff/Admin can export marks.'}, status=403)
    from .export import build_marks_workbook, export_tasks
    ids = request.data.get('recordIds')
    scope = request.data.get('scope', 'Selected records')
    if (not isinstance(ids, list) or not ids or len(ids) > 20000 or
            any(not isinstance(value, str) or not value.startswith('MRK-') or
                not value[4:].isascii() or not value[4:].isdigit() or len(value) > 24 for value in ids) or
            not isinstance(scope, str) or len(scope) > 4000):
        return Response({'error': 'Supply 1–20,000 valid record IDs and a filter description.'}, status=400)
    keys = {int(value[4:]) for value in ids}
    if any(key > 9223372036854775807 for key in keys):
        return Response({'error': 'Invalid record ID.'}, status=400)
    tasks = list(export_tasks().filter(pk__in=keys))
    if len(tasks) != len(keys):
        return Response({'error': 'Some records no longer exist. Refresh the list and try again.'}, status=400)
    response = HttpResponse(build_marks_workbook(tasks, scope),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="marks_records.xlsx"'
    response['Cache-Control'] = 'no-store'
    return response


def office_only(user):
    return office_actor(user)


def may_edit_submitted_marks(user):
    return can_correct_marks(user)


def task_entry_or_none(task):
    try:
        return task.mark_entry
    except MarkEntry.DoesNotExist:
        return None


def task_display_status(task):
    entry = task_entry_or_none(task)
    if entry and entry.status == MarkEntry.Status.SUBMITTED:
        return "SUBMITTED"
    if task_due_at(task) and task_due_at(task) < timezone.now():
        return "OVERDUE"
    if entry and entry.status == MarkEntry.Status.DRAFT:
        return "DRAFT"
    return "NOT_STARTED"


def mark_record_display_status(task, entry):
    if entry and entry.status == MarkEntry.Status.SUBMITTED:
        return "Submitted"
    if task_due_at(task) and task_due_at(task) < timezone.now():
        return "Overdue"
    if entry and entry.status == MarkEntry.Status.DRAFT:
        return "Draft"
    return "Not Started"


def period_task_totals(period):
    tasks = EvaluationTask.objects.filter(
        period=period,
        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
    ).select_related("mark_entry", "period").prefetch_related("completion_windows")
    total = tasks.count()
    submitted = tasks.filter(mark_entry__status=MarkEntry.Status.SUBMITTED).count()
    now = timezone.now()
    return {
        "total": total,
        "supervisor": tasks.filter(
            evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
        ).count(),
        "panel": tasks.filter(
            evaluator_role=EvaluationTask.EvaluatorRole.PANEL,
        ).count(),
        "backup": tasks.filter(
            evaluator_role=EvaluationTask.EvaluatorRole.BACKUP,
        ).count(),
        "submitted": submitted,
        "incomplete": total - submitted,
        "overdue": sum(
            bool(task_due_at(task, now) and task_due_at(task, now) < now)
            for task in tasks
            if not hasattr(task, "mark_entry") or task.mark_entry.status != MarkEntry.Status.SUBMITTED
        ),
    }


def period_payload(period):
    return {
        "assessment": period.assessment,
        "programmeScope": period.programme_scope,
        "programmes": period.programmes,
        "evaluatorRoles": period.evaluator_roles,
        "id": period.pk,
        "name": period.name,
        "semester": period.semester,
        "semesterId": period.academic_semester_id,
        "semesterCode": (
            period.academic_semester.code
            if period.academic_semester_id
            else None
        ),
        "rubricId": period.rubric_id,
        "rubricName": period.rubric.name,
        "opensAt": period.opens_at.isoformat() if period.opens_at else None,
        "closesAt": period.closes_at.isoformat() if period.closes_at else None,
        "isOpen": period.accepts_submissions,
        "lifecycleStatus": period.lifecycle_status,
        "effectiveStatus": period.effective_status,
        "publishedAt": (
            period.published_at.isoformat() if period.published_at else None
        ),
        "closedAt": period.closed_at.isoformat() if period.closed_at else None,
        "archivedAt": (
            period.archived_at.isoformat() if period.archived_at else None
        ),
        "rubric": rubric_payload(period.rubric),
        "taskTotals": period_task_totals(period),
    }


def configuration_audit_payload(audit):
    return {
        "id": audit.pk,
        "entityType": audit.entity_type,
        "entityId": audit.entity_id,
        "action": audit.action,
        "actorName": audit.actor.full_name,
        "actorRole": audit.actor.get_role_display(),
        "reason": audit.reason,
        "beforeValues": audit.before_values,
        "afterValues": audit.after_values,
        "createdAt": audit.created_at.isoformat(),
    }


def rubric_component_payload(component):
    return {
        "id": component.pk,
        "code": component.code,
        "name": component.name,
        "description": component.description,
        "maxMarks": f"{component.max_marks:.2f}",
        "required": component.is_required,
        "isActive": component.is_active,
        "status": "ACTIVE" if component.is_active else "INACTIVE",
        "displayOrder": component.display_order,
    }


def rubric_payload(rubric, *, include_audit=False):
    payload = {
        "id": rubric.pk,
        "allowedEvaluatorRoles": rubric.allowed_evaluator_roles,
        "familyCode": rubric.family_code,
        "code": rubric.code,
        "name": rubric.name,
        "description": rubric.description,
        "version": rubric.version,
        "targetMark": f"{rubric.target_mark:.2f}",
        "componentTotal": f"{rubric.component_total:.2f}",
        "isReady": rubric.is_ready,
        "isLocked": rubric.is_locked,
        "isActive": rubric.is_active,
        "isArchived": rubric.is_archived,
        "usage": [{"id": period.pk, "name": period.name, "semester": period.semester,
                   "status": period.lifecycle_status}
                  for period in rubric.evaluation_periods.all()],
        "supersedesId": rubric.supersedes_id,
        "components": [
            rubric_component_payload(component)
            for component in rubric.components.order_by("display_order", "id")
        ],
    }
    if include_audit:
        audits = MarksConfigurationAudit.objects.filter(
            entity_type=MarksConfigurationAudit.EntityType.RUBRIC,
            entity_id=rubric.pk,
        ).select_related("actor")
        payload["auditEvents"] = [
            configuration_audit_payload(audit) for audit in audits
        ]
    return payload


def django_validation_response(exc, *, conflict=False):
    messages = getattr(exc, "messages", None) or [str(exc)]
    return Response(
        {"error": messages[0], "errors": messages},
        status=(
            status.HTTP_409_CONFLICT
            if conflict
            else status.HTTP_400_BAD_REQUEST
        ),
    )


def state_conflict_response(exc):
    return Response(
        {"error": str(exc)},
        status=status.HTTP_409_CONFLICT,
    )


def component_values(data):
    mapping = {
        "code": "code",
        "name": "name",
        "description": "description",
        "maxMarks": "max_marks",
        "required": "is_required",
        "isActive": "is_active",
        "displayOrder": "display_order",
    }
    return {
        target: data[source]
        for source, target in mapping.items()
        if source in data
    }


def task_option_payload(task):
    entry = task_entry_or_none(task)
    return {
        **task_access(task),
        "taskId": task.pk,
        "id": f"EVT-{task.pk:05d}",
        "periodId": task.period_id,
        "studentId": task.profile.matric_no,
        "studentName": task.profile.student_name,
        "researchTitle": task.profile.proposed_topic,
        "panelMember": task.evaluator.full_name,
        "evaluatorId": task.evaluator_id,
        "evaluatorRole": task.evaluator_role,
        "evaluatorRoleLabel": task.get_evaluator_role_display(),
        "semester": task.period.semester,
        "status": task_display_status(task),
        **mark_deadline_metadata(
            task_due_at(task),
            is_submitted=bool(
                entry and entry.status == MarkEntry.Status.SUBMITTED
            ),
        ),
    }


def lecturer_task_or_none(user, pk):
    if user.role != User.Role.LECTURER:
        return None
    return (
        EvaluationTask.objects.filter(
            pk=pk,
            evaluator=user,
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
        )
        .select_related("profile", "period", "period__rubric", "mark_entry")
        .prefetch_related(
            "period__rubric__components",
            "mark_entry__scores__component",
        )
        .first()
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def evaluation_periods_view(request):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can view evaluation periods."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if request.method == "POST":
        serializer = EvaluationPeriodCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        semester_id = serializer.validated_data.get("semesterId")
        academic_semester = (
            AcademicSemester.objects.filter(pk=semester_id).first()
            if semester_id
            else current_effective_semester()
        )
        if academic_semester is None:
            return Response(
                {
                    "error": (
                        "Select a Draft or Active academic semester before "
                        "creating an evaluation period."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        rubric = Rubric.objects.filter(
            pk=serializer.validated_data["rubricId"]
        ).first()
        if rubric is None:
            return Response(
                {"error": "Rubric version was not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            period = create_evaluation_period(
                actor=request.user,
                assessment=serializer.validated_data.get("assessment", ""),
                name=serializer.validated_data["name"],
                academic_semester=academic_semester,
                rubric=rubric,
                opens_at=serializer.validated_data.get("opensAt"),
                closes_at=serializer.validated_data.get("closesAt"),
                programme_scope=serializer.validated_data.get("programmeScope", "ALL"),
                programmes=serializer.validated_data.get("programmes", []),
                evaluator_roles=serializer.validated_data.get("evaluatorRoles", ["SUPERVISOR", "PANEL"]),
            )
        except MarksStateConflict as exc:
            return state_conflict_response(exc)
        except DjangoValidationError as exc:
            return django_validation_response(exc)
        period = EvaluationPeriod.objects.select_related(
            "rubric",
            "academic_semester",
        ).get(
            pk=period.pk
        )
        return Response(period_payload(period), status=status.HTTP_201_CREATED)

    periods = EvaluationPeriod.objects.select_related(
        "rubric",
        "academic_semester",
    )
    if request.query_params.get("includeArchived", "").lower() != "true":
        periods = periods.exclude(
            lifecycle_status=EvaluationPeriod.Lifecycle.ARCHIVED
        )
    periods = periods.all()[:100]
    return Response([period_payload(period) for period in periods])


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def evaluation_period_detail_view(request, pk):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can manage evaluation periods."},
            status=status.HTTP_403_FORBIDDEN,
        )
    period = EvaluationPeriod.objects.select_related(
        "rubric",
        "academic_semester",
    ).filter(pk=pk).first()
    if period is None:
        return Response(
            {"error": "Evaluation period was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    if request.method == "GET":
        payload = period_payload(period)
        audits = MarksConfigurationAudit.objects.filter(
            entity_type=MarksConfigurationAudit.EntityType.PERIOD,
            entity_id=period.pk,
        ).select_related("actor")
        payload["auditEvents"] = [
            configuration_audit_payload(audit) for audit in audits
        ]
        return Response(payload)

    if request.method == "DELETE":
        try:
            delete_draft_evaluation_period(period=period, actor=request.user)
        except MarksStateConflict as exc:
            return state_conflict_response(exc)
        except DjangoValidationError as exc:
            return django_validation_response(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = EvaluationPeriodUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    values = {}
    for source, target in (
        ("assessment", "assessment"),
        ("name", "name"),
        ("opensAt", "opens_at"),
        ("closesAt", "closes_at"),
        ("programmeScope", "programme_scope"),
        ("programmes", "programmes"),
        ("evaluatorRoles", "evaluator_roles"),
    ):
        if source in data:
            values[target] = data[source]
    if "rubricId" in data:
        rubric = Rubric.objects.filter(pk=data["rubricId"]).first()
        if rubric is None:
            return Response(
                {"error": "Rubric version was not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        values["rubric"] = rubric
    if "semesterId" in data:
        academic_semester = AcademicSemester.objects.filter(
            pk=data["semesterId"]
        ).first()
        if academic_semester is None:
            return Response(
                {"error": "Academic semester was not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        values["academic_semester"] = academic_semester
    try:
        period = update_evaluation_period(
            period=period,
            actor=request.user,
            values=values,
            reason=data.get("reason", ""),
        )
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response(period_payload(period))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def evaluation_programme_options_view(request):
    if not office_only(request.user):
        return Response({"error": "Only Office Staff/Admin can view programme options."}, status=403)
    return Response(programme_options())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def evaluation_recipient_preview_view(request, pk):
    if not office_only(request.user):
        return Response({"error": "Only Office Staff/Admin can preview recipients."}, status=403)
    period = EvaluationPeriod.objects.filter(pk=pk).first()
    if period is None:
        return Response({"error": "Evaluation period was not found."}, status=404)
    return Response(recipient_preview(period))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def publish_evaluation_period_view(request, pk):
    return period_transition_response(request, pk, "publish")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def close_evaluation_period_view(request, pk):
    return period_transition_response(request, pk, "close")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def archive_evaluation_period_view(request, pk):
    return period_transition_response(request, pk, "archive")


def period_transition_response(request, pk, action):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can manage evaluation periods."},
            status=status.HTTP_403_FORBIDDEN,
        )
    period = EvaluationPeriod.objects.filter(pk=pk).first()
    if period is None:
        return Response(
            {"error": "Evaluation period was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    reason = ""
    if action in {"close", "archive"}:
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]
    try:
        if action == "publish":
            period = publish_evaluation_period(
                period=period,
                actor=request.user,
            )
        elif action == "close":
            period = close_evaluation_period(
                period=period,
                actor=request.user,
                reason=reason,
                preview_token=request.data.get("previewToken"),
                acknowledge_unfinished=request.data.get("acknowledgeUnfinished") is True,
            )
        else:
            period = archive_evaluation_period(
                period=period,
                actor=request.user,
                reason=reason,
            )
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    period = EvaluationPeriod.objects.select_related("rubric").get(pk=period.pk)
    return Response(period_payload(period))


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def rubrics_view(request):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can manage rubric configuration."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if request.method == "GET":
        rubrics = Rubric.objects.prefetch_related("components", "evaluation_periods").order_by(
            "family_code",
            "-version",
        )
        return Response([rubric_payload(rubric) for rubric in rubrics])
    serializer = RubricCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        rubric = create_rubric(
            actor=request.user,
            family_code=data["familyCode"],
            name=data["name"],
            description=data.get("description", ""),
            allowed_evaluator_roles=data["allowedEvaluatorRoles"],
            target_mark=data["targetMark"],
        )
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response(rubric_payload(rubric), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def rubric_detail_view(request, pk):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can manage rubric configuration."},
            status=status.HTTP_403_FORBIDDEN,
        )
    rubric = Rubric.objects.prefetch_related("components").filter(pk=pk).first()
    if rubric is None:
        return Response(
            {"error": "Rubric version was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    if request.method == "GET":
        return Response(rubric_payload(rubric, include_audit=True))
    serializer = RubricUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    values = {}
    for source, target in (
        ("name", "name"),
        ("description", "description"),
        ("allowedEvaluatorRoles", "allowed_evaluator_roles"),
        ("targetMark", "target_mark"),
        ("isActive", "is_active"),
    ):
        if source in data:
            values[target] = data[source]
    try:
        rubric = update_rubric(
            rubric=rubric,
            actor=request.user,
            values=values,
        )
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response(rubric_payload(rubric))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rubric_family_archive_view(request, pk):
    if not office_only(request.user):
        return Response({"error": "Only Office Staff/Admin can manage rubric configuration."}, status=403)
    rubric = Rubric.objects.filter(pk=pk).first()
    if rubric is None:
        return Response({"error": "Rubric family was not found."}, status=404)
    archived = request.data.get("archived")
    if not isinstance(archived, bool):
        return Response({"error": "Choose archive or restore."}, status=400)
    rubric = set_rubric_family_archived(rubric=rubric, actor=request.user, archived=archived)
    return Response(rubric_payload(rubric))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def clone_rubric_view(request, pk):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can manage rubric configuration."},
            status=status.HTTP_403_FORBIDDEN,
        )
    rubric = Rubric.objects.filter(pk=pk).first()
    if rubric is None:
        return Response(
            {"error": "Rubric version was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    try:
        cloned = clone_rubric_version(rubric=rubric, actor=request.user)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response(rubric_payload(cloned), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_rubric_component_view(request, pk):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can manage rubric configuration."},
            status=status.HTTP_403_FORBIDDEN,
        )
    rubric = Rubric.objects.filter(pk=pk).first()
    if rubric is None:
        return Response(
            {"error": "Rubric version was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    serializer = RubricComponentInputSerializer(
        data=request.data,
        context={"create": True},
    )
    serializer.is_valid(raise_exception=True)
    try:
        component = create_rubric_component(
            rubric=rubric,
            actor=request.user,
            values=component_values(serializer.validated_data),
        )
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response(
        rubric_component_payload(component),
        status=status.HTTP_201_CREATED,
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def rubric_component_detail_view(request, pk, component_pk):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can manage rubric configuration."},
            status=status.HTTP_403_FORBIDDEN,
        )
    component = RubricComponent.objects.filter(
        pk=component_pk,
        rubric_id=pk,
    ).first()
    if component is None:
        return Response(
            {"error": "Rubric component was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    serializer = RubricComponentInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        component = update_rubric_component(
            component=component,
            actor=request.user,
            values=component_values(serializer.validated_data),
        )
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response(rubric_component_payload(component))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def assignment_options_view(request):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can view assignment options."},
            status=status.HTTP_403_FORBIDDEN,
        )
    search_kind = request.query_params.get("kind")
    if search_kind:
        if search_kind not in {"students", "lecturers"}:
            return Response(
                {"error": "Search kind must be students or lecturers."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        query = request.query_params.get("q", "").strip()[:100]
        try:
            limit = max(1, min(50, int(request.query_params.get("limit", 50))))
        except (TypeError, ValueError):
            return Response(
                {"error": "Result limit must be a whole number."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if search_kind == "students":
            period_id = request.query_params.get("period_id")
            try:
                period_pk = int(period_id)
            except (TypeError, ValueError):
                return Response(
                    {"error": "A valid period is required when searching students."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            period = EvaluationPeriod.objects.filter(pk=period_pk).first()
            if period is None:
                return Response(
                    {"error": "Evaluation period was not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            students = StudentResearchProfile.objects.select_related(
                "supervisor", "student__student",
            ).filter(
                Q(student__isnull=True)
                | Q(student__student__status=Student.Status.ACTIVE)
            )
            if period.programme_scope == "SELECTED":
                programme_names = [
                    name.strip().casefold() for name in period.programmes if name.strip()
                ]
                students = students.annotate(
                    _linked_programme=Lower(Trim("student__student__programme")),
                    _legacy_programme=Lower(Trim("programme")),
                ).filter(
                    Q(
                        student__isnull=False,
                        _linked_programme__in=programme_names,
                    )
                    | Q(
                        student__isnull=True,
                        _legacy_programme__in=programme_names,
                    )
                )
            if query:
                students = students.filter(
                    Q(student_name__icontains=query)
                    | Q(matric_no__icontains=query)
                    | Q(student__isnull=True, programme__icontains=query)
                    | Q(
                        student__isnull=False,
                        student__student__programme__icontains=query,
                    )
                )
            total = students.count()
            results = [
                {
                    "studentId": student.matric_no,
                    "studentName": student.student_name,
                    "programme": profile_programme(student),
                    "semester": student.semester,
                    "researchTitle": student.proposed_topic,
                    "supervisorName": student.supervisor.full_name,
                }
                for student in students.order_by("student_name", "matric_no")[:limit]
            ]
        else:
            lecturers = User.objects.filter(
                role=User.Role.LECTURER,
                is_active=True,
                lecturer__lifecycle_status=Lecturer.Lifecycle.ACTIVE,
            ).select_related("lecturer")
            if query:
                lecturers = lecturers.filter(
                    Q(full_name__icontains=query)
                    | Q(email__icontains=query)
                    | Q(lecturer__staff_no__icontains=query)
                    | Q(lecturer__department__icontains=query)
                )
            total = lecturers.count()
            results = [
                {
                    "userId": lecturer.pk,
                    "staffId": getattr(
                        getattr(lecturer, "lecturer", None), "staff_no", ""
                    ),
                    "fullName": lecturer.full_name,
                    "department": getattr(
                        getattr(lecturer, "lecturer", None), "department", ""
                    ),
                    "email": lecturer.email,
                }
                for lecturer in lecturers.order_by("full_name", "pk")[:limit]
            ]
        return Response({"results": results, "total": total, "limit": limit})

    students = StudentResearchProfile.objects.select_related("supervisor", "student__student").order_by(
        "student_name",
    ).filter(
        Q(student__isnull=True) | Q(student__student__status=Student.Status.ACTIVE)
    )
    lecturers = User.objects.filter(
        role=User.Role.LECTURER,
        is_active=True,
        lecturer__lifecycle_status=Lecturer.Lifecycle.ACTIVE,
    ).select_related("lecturer").order_by("full_name")
    tasks = EvaluationTask.objects.filter(
        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
    ).select_related(
        "profile",
        "evaluator",
        "period",
        "mark_entry",
    ).order_by("-assigned_at", "-id")
    return Response(
        {
            "students": [
                {
                    "studentId": student.matric_no,
                    "studentName": student.student_name,
                    "programme": profile_programme(student),
                    "semester": student.semester,
                    "researchTitle": student.proposed_topic,
                    "supervisorName": student.supervisor.full_name,
                }
                for student in students
            ],
            "lecturers": [
                {
                    "userId": lecturer.pk,
                    "staffId": getattr(
                        getattr(lecturer, "lecturer", None),
                        "staff_no",
                        "",
                    ),
                    "fullName": lecturer.full_name,
                    "department": getattr(
                        getattr(lecturer, "lecturer", None),
                        "department",
                        "",
                    ),
                    "email": lecturer.email,
                }
                for lecturer in lecturers
            ],
            "tasks": [task_option_payload(task) for task in tasks],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_evaluation_tasks_view(request):
    if request.user.role != User.Role.LECTURER:
        return Response(
            {"error": "Only lecturers can view assigned evaluation tasks."},
            status=status.HTTP_403_FORBIDDEN,
        )
    ensure_active_period_tasks()
    tasks = (
        EvaluationTask.objects.filter(
            evaluator=request.user,
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
        )
        .select_related("profile", "period", "period__rubric", "mark_entry")
        .prefetch_related(
            "period__rubric__components",
            "mark_entry__scores__component",
        )
    )
    return Response(EvaluationTaskSerializer(tasks, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_submitted_evaluations_view(request):
    if request.user.role != User.Role.LECTURER:
        return Response({"error": "Only lecturers can view their submitted evaluations."}, status=status.HTTP_403_FORBIDDEN)
    # A history read is independent of current appointment, semester and task generation.
    tasks = (
        EvaluationTask.objects.filter(evaluator=request.user, mark_entry__status=MarkEntry.Status.SUBMITTED)
        .select_related("profile", "period", "period__rubric", "mark_entry")
        .prefetch_related("period__rubric__components", "mark_entry__scores__component")
        .order_by(F("mark_entry__submitted_at").desc(nulls_last=True), "-id")
    )
    return Response(SubmittedEvaluationSerializer(tasks, many=True).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def save_draft_view(request, pk):
    task = lecturer_task_or_none(request.user, pk)
    if task is None:
        return Response(
            {"error": "Evaluation task was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    serializer = MarkDraftSerializer(
        data=request.data,
        context={"task": task},
    )
    serializer.is_valid(raise_exception=True)
    try:
        serializer.save()
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    task = lecturer_task_or_none(request.user, pk)
    return Response(EvaluationTaskSerializer(task).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_marks_view(request, pk):
    task = lecturer_task_or_none(request.user, pk)
    if task is None:
        return Response(
            {"error": "Evaluation task was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    serializer = MarkSubmissionSerializer(data=request.data, context={'task': task})
    serializer.is_valid(raise_exception=True)
    try:
        serializer.save()
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    task = lecturer_task_or_none(request.user, pk)
    return Response(EvaluationTaskSerializer(task).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mark_records_view(request):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can monitor mark records."},
            status=status.HTTP_403_FORBIDDEN,
        )
    tasks = EvaluationTask.objects.select_related(
        "profile",
        "evaluator",
        "period",
        "mark_entry",
    ).prefetch_related("mark_entry__scores__component")
    records = []
    for task in tasks:
        try:
            entry = task.mark_entry
        except MarkEntry.DoesNotExist:
            entry = None
        display_status = mark_record_display_status(task, entry)
        deadline_metadata = mark_deadline_metadata(
            task_due_at(task),
            is_submitted=bool(
                entry and entry.status == MarkEntry.Status.SUBMITTED
            ),
        )
        records.append(
            {
                "id": f"MRK-{task.pk:05d}",
                "studentId": task.profile.matric_no,
                "studentName": task.profile.student_name,
                "studentInitials": "".join(
                    part[0] for part in task.profile.student_name.split()[:2]
                ).upper(),
                "researchTitle": task.profile.proposed_topic,
                "panelMember": task.evaluator.full_name,
                "evaluatorRole": task.evaluator_role,
                "evaluatorRoleLabel": task.get_evaluator_role_display(),
                "periodId": task.period_id,
                "periodName": task.period.name,
                "periodLifecycleStatus": task.period.lifecycle_status,
                "semester": task.period.semester,
                "programme": task.profile.programme,
                "totalMark": (
                    f"{entry.total_mark:.2f}"
                    if entry and entry.status == MarkEntry.Status.SUBMITTED
                    else "Draft"
                    if entry and entry.status == MarkEntry.Status.DRAFT
                    else None
                ),
                "status": display_status,
                "taskLifecycleStatus": task.lifecycle_status,
                "pausedAt": task.paused_at,
                "pauseReason": task.pause_reason or None,
                "retiredAt": task.retired_at,
                "retirementReason": task.retirement_reason or None,
                "submittedDate": (
                    timezone.localtime(entry.submitted_at).strftime("%d %b %Y")
                    if entry and entry.submitted_at
                    else "-"
                ),
                **deadline_metadata,
            }
        )
    return Response(records)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mark_record_detail_view(request, record_id):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can view mark record details."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if not record_id.startswith("MRK-") or not record_id[4:].isdigit():
        return Response(
            {"error": "Mark record was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    task = (
        EvaluationTask.objects.filter(pk=int(record_id[4:]))
        .select_related(
            "profile",
            "evaluator",
            "evaluator__lecturer",
            "assigned_by",
            "retired_by",
            "period",
            "period__rubric",
            "mark_entry",
        )
        .prefetch_related(
            "period__rubric__components",
            "mark_entry__scores__component",
            "mark_entry__correction_audits__actor",
            "override_audits__actor",
            "override_audits__original_evaluator",
            "override_audits__new_evaluator",
            "handover_audits__actor",
            "handover_audits__replacement_task",
        )
        .first()
    )
    if task is None:
        return Response(
            {"error": "Mark record was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    entry = task_entry_or_none(task)
    score_map = (
        {score.component_id: score for score in entry.scores.all()}
        if entry
        else {}
    )
    deadline = mark_deadline_metadata(
        task_due_at(task),
        is_submitted=bool(
            entry and entry.status == MarkEntry.Status.SUBMITTED
        ),
    )
    lecturer_profile = getattr(task.evaluator, "lecturer", None)
    authorized = may_edit_submitted_marks(request.user)
    submitted = bool(entry and entry.status == MarkEntry.Status.SUBMITTED)
    return Response(
        {
            "recordId": f"MRK-{task.pk:05d}",
            "officeActions": {
                "canCorrect": authorized and submitted,
                "canReopen": authorized and submitted and task.period.accepts_submissions,
                "version": submitted_marks_version(entry) if authorized and submitted else None,
            },
            **task_access(task),
        "taskId": task.pk,
            "student": {
                "studentId": task.profile.matric_no,
                "name": task.profile.student_name,
                "programme": task.profile.programme,
                "semester": task.profile.semester,
                "researchTitle": task.profile.proposed_topic,
            },
            "evaluator": {
                "userId": task.evaluator_id,
                "name": task.evaluator.full_name,
                "email": task.evaluator.email,
                "staffId": getattr(lecturer_profile, "staff_no", ""),
                "department": getattr(lecturer_profile, "department", ""),
                "role": task.evaluator_role,
                "roleLabel": task.get_evaluator_role_display(),
            },
            "assignment": {
                "assignedAt": task.assigned_at.isoformat(),
                "assignedBy": (
                    task.assigned_by.full_name if task.assigned_by else None
                ),
                "lifecycleStatus": task.lifecycle_status,
                "pausedAt": (
                    task.paused_at.isoformat() if task.paused_at else None
                ),
                "pausedBy": (
                    task.paused_by.full_name if task.paused_by else None
                ),
                "pauseReason": task.pause_reason or None,
                "retiredAt": (
                    task.retired_at.isoformat() if task.retired_at else None
                ),
                "retiredBy": (
                    task.retired_by.full_name if task.retired_by else None
                ),
                "retirementReason": task.retirement_reason or None,
            },
            "period": {
                "id": task.period_id,
                "name": task.period.name,
                "semester": task.period.semester,
                "opensAt": (
                    task.period.opens_at.isoformat()
                    if task.period.opens_at
                    else None
                ),
                "closesAt": (
                    task.period.closes_at.isoformat()
                    if task.period.closes_at
                    else None
                ),
                "lifecycleStatus": task.period.lifecycle_status,
                "effectiveStatus": task.period.effective_status,
                **deadline,
            },
            "rubric": {
                "id": task.period.rubric_id,
                "familyCode": task.period.rubric.family_code,
                "name": task.period.rubric.name,
                "version": task.period.rubric.version,
                "targetMark": f"{task.period.rubric.target_mark:.2f}",
                "componentTotal": (
                    f"{task.period.rubric.component_total:.2f}"
                ),
                "components": [
                    {
                        **rubric_component_payload(component),
                        "marksAwarded": (
                            f"{score_map[component.pk].marks_awarded:.2f}"
                            if component.pk in score_map
                            else None
                        ),
                        "feedback": (
                            score_map[component.pk].feedback
                            if component.pk in score_map
                            else ""
                        ),
                    }
                    for component in task.period.rubric.components.filter(
                        is_active=True
                    ).order_by("display_order", "id")
                ],
            },
            "entry": {
                "status": (
                    entry.status
                    if entry
                    else MarkEntry.Status.NOT_STARTED
                ),
                "totalMark": f"{entry.total_mark:.2f}" if entry else None,
                "comments": entry.comments if entry else "",
                "submittedAt": (
                    entry.submitted_at.isoformat()
                    if entry and entry.submitted_at
                    else None
                ),
                "updatedAt": (
                    entry.updated_at.isoformat() if entry else None
                ),
                "isLocked": bool(entry and entry.is_locked),
            },
            "overrideHistory": [
                {
                    "id": audit.pk,
                    "actorName": audit.actor.full_name,
                    "originalEvaluator": (
                        audit.original_evaluator.full_name
                        if audit.original_evaluator
                        else None
                    ),
                    "newEvaluator": audit.new_evaluator.full_name,
                    "reason": audit.reason,
                    "createdAt": audit.created_at.isoformat(),
                }
                for audit in task.override_audits.all()
            ],
            "correctionHistory": [
                {
                    "id": audit.pk,
                    "action": audit.action,
                    "actorName": audit.actor.full_name,
                    "actorRole": audit.actor.get_role_display(),
                    "reason": audit.reason,
                    "beforeValues": audit.before_values,
                    "afterValues": audit.after_values,
                    "createdAt": audit.created_at.isoformat(),
                }
                for audit in (
                    entry.correction_audits.all() if entry else []
                )
            ],
            "handoverHistory": [
                {
                    "id": audit.pk,
                    "replacementTaskId": audit.replacement_task_id,
                    "actorName": audit.actor.full_name,
                    "reason": audit.reason,
                    "draftSnapshot": audit.draft_snapshot,
                    "createdAt": audit.created_at.isoformat(),
                }
                for audit in task.handover_audits.select_related(
                    "actor", "replacement_task"
                )
            ],
        }
    )


def mutate_submitted_mark_record(request, record_id, *, reopen):
    if not may_edit_submitted_marks(request.user):
        return Response({"error": "Only authorized Office Staff/Admin with Marks change permission may perform this operation."}, status=403)
    if not record_id.startswith("MRK-") or not record_id[4:].isdigit():
        return Response({"error": "Mark record was not found."}, status=404)
    entry = MarkEntry.objects.filter(task_id=int(record_id[4:])).first()
    if entry is None:
        return Response({"error": "Submitted mark record was not found."}, status=404)
    serializer = (SubmittedMarksReasonSerializer if reopen else SubmittedMarksCorrectionSerializer)(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        if reopen:
            reopen_submitted_marks(entry=entry, actor=request.user, reason=data['reason'], expected_version=data['expectedVersion'])
        else:
            correct_submitted_marks(entry=entry, actor=request.user, reason=data['reason'],
                expected_version=data['expectedVersion'], comments=data.get('comments'),
                score_values={score['componentId']: score['marksAwarded'] for score in data['scores']})
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response({"recordId": record_id, "action": "REOPEN" if reopen else "CORRECT"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def correct_mark_record_view(request, record_id):
    return mutate_submitted_mark_record(request, record_id, reopen=False)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reopen_mark_record_view(request, record_id):
    return mutate_submitted_mark_record(request, record_id, reopen=True)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def rubric_components_view(request):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can view rubric configuration."},
            status=status.HTTP_403_FORBIDDEN,
        )
    components = RubricComponent.objects.select_related("rubric").order_by(
        "rubric__name", "display_order", "id"
    )
    return Response(
        [
            {
                "id": str(component.pk),
                "name": component.name,
                "description": component.description,
                "maxMarks": float(component.max_marks),
                "required": component.is_required,
                "status": "ACTIVE" if component.is_active else "INACTIVE",
                "displayOrder": component.display_order,
            }
            for component in components
        ]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def evaluation_preview_tasks_view(request):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can view evaluation assignments."},
            status=status.HTTP_403_FORBIDDEN,
        )
    tasks = EvaluationTask.objects.filter(
        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
    ).select_related(
        "profile",
        "evaluator",
        "period",
        "mark_entry",
    )
    return Response([task_option_payload(task) for task in tasks])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_period_tasks_view(request, pk):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can generate evaluation tasks."},
            status=status.HTTP_403_FORBIDDEN,
        )
    try:
        period = EvaluationPeriod.objects.get(pk=pk)
    except EvaluationPeriod.DoesNotExist:
        return Response(
            {"error": "Evaluation period was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    try:
        result = ensure_period_tasks(period, actor=request.user)
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    return Response(
        {
            "createdCount": result["total"],
            "supervisorCreatedCount": result["supervisor"],
            "panelCreatedCount": result["panel"],
            "totalCount": result["period_total"],
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def manual_override_task_view(request, pk):
    if not office_only(request.user):
        return Response(
            {"error": "Only Office Staff/Admin can assign backup evaluators."},
            status=status.HTTP_403_FORBIDDEN,
        )
    try:
        period = EvaluationPeriod.objects.get(pk=pk)
    except EvaluationPeriod.DoesNotExist:
        return Response(
            {"error": "Evaluation period was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    profile = StudentResearchProfile.objects.filter(
        matric_no=request.data.get("studentId")
    ).first()
    if profile is None:
        return Response(
            {"error": "Student research profile was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    evaluator = User.objects.filter(pk=request.data.get("evaluatorId")).first()
    if evaluator is None:
        return Response(
            {"error": "Backup evaluator was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    original_task = None
    original_task_id = request.data.get("originalTaskId")
    if original_task_id:
        original_task = EvaluationTask.objects.filter(
            pk=original_task_id,
            period=period,
        ).first()
        if original_task is None:
            return Response(
                {"error": "Original evaluation task was not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
    try:
        task = create_backup_evaluation_task(
            period=period,
            profile=profile,
            evaluator=evaluator,
            actor=request.user,
            reason=request.data.get("reason", ""),
            original_task=original_task,
        )
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)
    task = (
        EvaluationTask.objects.filter(pk=task.pk)
        .select_related("profile", "period", "period__rubric", "mark_entry")
        .prefetch_related(
            "period__rubric__components",
            "mark_entry__scores__component",
        )
        .get()
    )
    return Response(EvaluationTaskSerializer(task).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def completion_window_history_view(request, pk):
    if not office_only(request.user):
        return Response({"error":"Only Office Staff/Admin may view completion history."}, status=403)
    task = EvaluationTask.objects.filter(pk=pk).first()
    if task is None:
        return Response({"error":"Task not found."}, status=404)
    return Response({"windows":[window_payload(w) for w in task.completion_windows.select_related('granted_by')]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def completion_window_grant_view(request):
    from rest_framework import serializers
    if not office_only(request.user):
        return Response({"error":"Only Office Staff/Admin may grant completion windows."}, status=403)
    class Input(serializers.Serializer):
        taskIds = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)
        deadline = serializers.DateTimeField()
        reason = serializers.CharField(allow_blank=False, trim_whitespace=True)
    data = Input(data=request.data)
    data.is_valid(raise_exception=True)
    try:
        windows = grant_completion_windows(task_ids=data.validated_data['taskIds'], deadline=data.validated_data['deadline'], reason=data.validated_data['reason'], actor=request.user)
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response({"windows":[window_payload(w) for w in windows]}, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def completion_window_revoke_view(request, pk):
    from .models import TaskCompletionWindow
    if not office_only(request.user):
        return Response({"error":"Only Office Staff/Admin may revoke completion windows."}, status=403)
    data = ReasonSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    try:
        window = revoke_completion_window(window_id=pk, reason=data.validated_data['reason'], actor=request.user)
    except TaskCompletionWindow.DoesNotExist:
        return Response({"error":"Completion window not found."}, status=404)
    except MarksStateConflict as exc:
        return state_conflict_response(exc)
    except DjangoValidationError as exc:
        return django_validation_response(exc)
    return Response({"window":window_payload(window)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def period_closure_preview_view(request, pk):
    from .closure_preview import period_closure_preview
    if not office_only(request.user):
        return Response({"error":"Only Office Staff/Admin may preview closure."},status=403)
    period = EvaluationPeriod.objects.filter(pk=pk).first()
    if period is None:
        return Response({"error":"Period not found."},status=404)
    return Response(period_closure_preview(period))
