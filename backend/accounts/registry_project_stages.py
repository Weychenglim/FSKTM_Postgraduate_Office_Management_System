"""Project stages: the student's own answer, and the page the office and coordinators use."""
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import AcademicSemester

from .models import Student, User
from .project_stages import (
    CHOICES,
    COORDINATOR,
    NOT_ANSWERED,
    NOT_STUDYING,
    ON_PROJECT,
    P1,
    REASONS,
    StageConflict,
    answer_question,
    change_stages,
    current_semester,
    page_students,
    preview_change,
    project_stages,
    question_for,
    shown,
    supervision_of,
    visible_to,
)
from .registry_views import _avatar_bg, _initials
from .semester_rules import intake_label

SEMESTERS_SHOWN = 6


def _semester(semester_id):
    if semester_id in (None, ""):
        return current_semester()
    try:
        return AcademicSemester.objects.filter(pk=int(semester_id)).first()
    except (TypeError, ValueError):
        return None


def _staff(request):
    role = getattr(request.user, "role", None)
    if role not in (User.Role.OFFICE_ADMIN, User.Role.COORDINATOR):
        raise PermissionDenied("Only the office and programme coordinators can see project stages.")
    return role


def _coordinator(request):
    if getattr(request.user, "role", None) != User.Role.COORDINATOR:
        raise PermissionDenied("Only programme coordinators can change project stages.")


def _person(student):
    return {
        "matric": student.matric_no,
        "name": student.user.full_name,
        "programme": student.programme,
        "intake": intake_label(student.intake_semester),
        "avatarText": _initials(student.user.full_name),
        "avatarBg": _avatar_bg(student.matric_no),
    }


REASON_OPTIONS = [{"value": value, "label": label} for value, label in REASONS.items()]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def project_stages_view(request):
    role = _staff(request)
    semester = _semester(request.query_params.get("semester"))
    choices = [{"id": row.pk, "label": row.label} for row in AcademicSemester.objects.order_by("-starts_on")[:SEMESTERS_SHOWN]]
    if semester is None:
        return Response({"semester": None, "semesters": choices, "rows": [], "notStudying": 0, "canChange": False, "reasons": REASON_OPTIONS})
    portal = current_semester()
    current = portal is not None and portal.pk == semester.pk
    students = visible_to(request.user, page_students(semester, current=current))
    ids = [student.pk for student in students]
    answers = project_stages(semester, ids)
    supervised, waiting = supervision_of(ids)
    rows, not_studying = [], 0
    for student in students:
        answer = answers[student.pk]
        if answer.state == NOT_STUDYING:
            not_studying += 1
            continue
        rows.append({
            **_person(student),
            "shown": shown(answer),
            "reason": answer.reason,
            "noSupervisor": answer.state == ON_PROJECT and answer.stage == P1 and student.pk not in supervised,
            "requestWaiting": student.pk in waiting,
            "notAnswered": current and answer.reason == NOT_ANSWERED,
            "setByCoordinator": answer.source == COORDINATOR,
        })
    return Response({
        "semester": {"id": semester.pk, "label": semester.label, "current": current},
        "semesters": choices,
        "rows": rows,
        "notStudying": not_studying,
        "canChange": role == User.Role.COORDINATOR and current,
        "reasons": REASON_OPTIONS,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def project_stage_impact_view(request):
    """What one change would do in Marks, before the coordinator saves it."""
    _coordinator(request)
    semester = _semester(request.query_params.get("semester"))
    student = Student.objects.select_related("user").filter(matric_no__iexact=request.query_params.get("matric", "")).first()
    choice = request.query_params.get("stage", "")
    if semester is None or student is None or choice not in CHOICES:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    try:
        return Response(preview_change(semester, student, choice, request.user))
    except StageConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)


class ChangeItem(serializers.Serializer):
    matric = serializers.CharField(max_length=64)
    shown = serializers.CharField(max_length=20)


class ChangeSerializer(serializers.Serializer):
    semesterId = serializers.IntegerField()
    stage = serializers.ChoiceField(choices=CHOICES)
    reason = serializers.ChoiceField(choices=list(REASONS))
    students = ChangeItem(many=True, allow_empty=False, max_length=500)
    checked = serializers.BooleanField(default=False)
    token = serializers.CharField(max_length=64, allow_blank=True, required=False, default="")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def project_stage_change_view(request):
    _coordinator(request)
    serializer = ChangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    semester = _semester(data["semesterId"])
    if semester is None:
        return Response({"error": "That semester no longer exists."}, status=status.HTTP_404_NOT_FOUND)
    try:
        result = change_stages(
            semester,
            [(item["matric"], item["shown"]) for item in data["students"]],
            choice=data["stage"],
            reason=data["reason"],
            actor=request.user,
            checked=data["checked"],
            token=data["token"],
        )
    except StageConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
    return Response(result)


def _question(student):
    question = question_for(student)
    if question is None:
        return {"question": None}
    return {"question": {
        "semester": question["semester"].label,
        "code": question["code"],
        "name": question["name"],
        "answer": question["answer"],
        "canChange": question["canChange"],
    }}


class AnswerSerializer(serializers.Serializer):
    answer = serializers.ChoiceField(choices=["YES", "NO"])


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def my_project_stage_view(request):
    """The student's own Research Project question for this semester."""
    if getattr(request.user, "role", None) != User.Role.STUDENT:
        raise PermissionDenied("Only students answer this.")
    student = Student.objects.filter(pk=request.user.pk).first()
    if student is None:
        return Response({"question": None})
    if request.method == "GET":
        return Response(_question(student))
    serializer = AnswerSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        answer_question(student, serializer.validated_data["answer"], request.user)
    except StageConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
    return Response(_question(Student.objects.get(pk=student.pk)))
