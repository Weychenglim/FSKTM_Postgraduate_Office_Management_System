"""The office confirms and corrects each student's project stage, from Student Registry."""
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import AcademicSemester
from academics.services import current_effective_semester

from .models import ProjectRegistration, Student
from .project_stages import (
    CONFIRMED,
    NO_PROJECT,
    NOT_CONFIRMED,
    NOT_STUDYING,
    VOID,
    StageConflict,
    confirm_stages,
    correct_stage,
    marks_impact,
    page_rows,
)
from .registry_views import _avatar_bg, _initials, _require_office_admin
from .semester_rules import intake_label

STAGES = [choice for choice, _ in ProjectRegistration.Stage.choices]
SEMESTERS_SHOWN = 6


def _semester(semester_id):
    if semester_id in (None, ""):
        return current_effective_semester()
    try:
        return AcademicSemester.objects.filter(pk=int(semester_id)).first()
    except (TypeError, ValueError):
        return None


def _person(student):
    return {
        "matric": student.matric_no,
        "name": student.user.full_name,
        "programme": student.programme,
        "intake": intake_label(student.intake_semester),
        "avatarText": _initials(student.user.full_name),
        "avatarBg": _avatar_bg(student.matric_no),
    }


class ConfirmItem(serializers.Serializer):
    matric = serializers.CharField(max_length=64)
    stage = serializers.ChoiceField(choices=STAGES)


class ConfirmSerializer(serializers.Serializer):
    semesterId = serializers.IntegerField()
    items = ConfirmItem(many=True, allow_empty=False)


class CorrectSerializer(serializers.Serializer):
    semesterId = serializers.IntegerField()
    matric = serializers.CharField(max_length=64)
    stage = serializers.ChoiceField(choices=[*STAGES, VOID])
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    revision = serializers.IntegerField(min_value=0)
    acknowledged = serializers.BooleanField(default=False)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def project_stages_view(request):
    _require_office_admin(request)
    if request.method == "POST":
        serializer = ConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        semester = _semester(data["semesterId"])
        if semester is None:
            return Response({"error": "That semester no longer exists."}, status=status.HTTP_404_NOT_FOUND)
        return Response(confirm_stages(semester, [(item["matric"], item["stage"]) for item in data["items"]], request.user))

    semester = _semester(request.query_params.get("semester"))
    choices = [{"id": row.pk, "label": row.label} for row in AcademicSemester.objects.order_by("-starts_on")[:SEMESTERS_SHOWN]]
    if semester is None:
        return Response({"semester": None, "semesters": choices, "toConfirm": [], "confirmed": [], "notStudying": 0, "noActivity": 0})
    students, stages, suggested, appointed = page_rows(semester)
    to_confirm, confirmed, not_studying, no_activity = [], [], 0, 0
    for student in students:
        stage = stages[student.pk]
        if stage.state == NOT_STUDYING:
            not_studying += 1
        elif stage.state in (CONFIRMED, NO_PROJECT):
            confirmed.append({**_person(student), "stage": stage.stage or "NONE", "revision": stage.revision})
        elif student.pk in suggested or student.pk in appointed:
            to_confirm.append({
                **_person(student),
                "suggested": suggested.get(student.pk, ""),
                "attention": student.pk in appointed,
                "revision": stage.revision,
            })
        else:
            no_activity += 1
    return Response({
        "semester": {"id": semester.pk, "label": semester.label},
        "semesters": choices,
        "toConfirm": to_confirm,
        "confirmed": confirmed,
        "notStudying": not_studying,
        "noActivity": no_activity,
        "notConfirmed": NOT_CONFIRMED,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def project_stage_impact_view(request):
    """What changing a confirmed stage would touch in Marks."""
    _require_office_admin(request)
    semester = _semester(request.query_params.get("semester"))
    student = Student.objects.filter(matric_no__iexact=request.query_params.get("matric", "")).first()
    new_stage = request.query_params.get("stage", "")
    if semester is None or student is None:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    record = ProjectRegistration.objects.filter(student=student, academic_semester=semester).first()
    current = record.stage if record and record.status == ProjectRegistration.Status.CONFIRMED else ""
    return Response(marks_impact(student, semester, current, None if new_stage == VOID else new_stage))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def project_stage_correct_view(request):
    _require_office_admin(request)
    serializer = CorrectSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    semester = _semester(data["semesterId"])
    student = Student.objects.filter(matric_no__iexact=data["matric"]).first()
    if semester is None or student is None:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    try:
        record = correct_stage(
            student,
            semester,
            new_stage=data["stage"],
            reason=data["reason"],
            actor=request.user,
            revision=data["revision"],
            acknowledged=data["acknowledged"],
        )
    except StageConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
    return Response({"revision": record.revision, "status": record.status, "stage": record.stage})
