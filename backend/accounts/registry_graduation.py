"""Graduating students from Student Registry. Office only."""
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .graduation import (
    check_student,
    correct_graduation,
    last_semesters,
    mark_finished,
    match_senate_list,
    overview,
    record_senate_decision,
    return_to_active,
    waiting_list,
)
from .models import Student
from .participant_lifecycle import ParticipantLifecycleConflict
from .registry_views import _find_student, _require_office_admin, to_record
from .semester_rules import is_waiting
from .semesters import from_parts

MAX_LIST = 2000


def _matric_list(**kwargs):
    return serializers.ListField(child=serializers.CharField(max_length=64), max_length=MAX_LIST, **kwargs)


def _reason_field():
    return serializers.CharField(max_length=1000, trim_whitespace=True)


class FinishSerializer(serializers.Serializer):
    matrics = _matric_list(allow_empty=False)
    earlyApproved = _matric_list(required=False, default=list)
    lastSession = serializers.CharField(max_length=9)
    lastTerm = serializers.CharField(max_length=16)


class SenateSerializer(serializers.Serializer):
    matrics = _matric_list(allow_empty=False)
    decidedOn = serializers.DateField()
    reference = serializers.CharField(max_length=120, allow_blank=True, required=False, default="")

    def validate_decidedOn(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("The Senate date can't be in the future.")
        return value


class ReturnSerializer(serializers.Serializer):
    matrics = _matric_list(allow_empty=False)
    reason = _reason_field()


class CorrectSerializer(serializers.Serializer):
    matric = serializers.CharField(max_length=64)
    reason = _reason_field()


def _valid(serializer_class, request):
    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def _semester_choice(portal):
    return {"session": portal.academic_session, "term": portal.term, "label": portal.label}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def graduation_view(request):
    """Who can be marked as finished, and who is waiting for the Senate."""
    _require_office_admin(request)
    return Response({**overview(), "waiting": waiting_list(), "lastSemesters": [_semester_choice(row) for row in last_semesters()]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def graduation_finish_view(request):
    _require_office_admin(request)
    data = _valid(FinishSerializer, request)
    last = from_parts(data["lastSession"], data["lastTerm"])
    allowed = [from_parts(row.academic_session, row.term) for row in last_semesters()]
    if last is None or last not in allowed:
        return Response({"error": "Choose the semester they finished on."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(mark_finished(data["matrics"], last=last, actor=request.user, early_approved=data["earlyApproved"]))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def graduation_senate_view(request):
    _require_office_admin(request)
    data = _valid(SenateSerializer, request)
    return Response(record_senate_decision(data["matrics"], decided_on=data["decidedOn"], reference=data["reference"].strip(), actor=request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def graduation_return_view(request):
    _require_office_admin(request)
    data = _valid(ReturnSerializer, request)
    return Response(return_to_active(data["matrics"], actor=request.user, reason=data["reason"]))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def graduation_correct_view(request):
    _require_office_admin(request)
    data = _valid(CorrectSerializer, request)
    try:
        student = correct_graduation(data["matric"], actor=request.user, reason=data["reason"])
    except Student.DoesNotExist:
        return Response({"error": "Student not found."}, status=status.HTTP_404_NOT_FOUND)
    except ParticipantLifecycleConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
    return Response(to_record(student))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def graduation_match_list_view(request):
    """Tick the waiting students who are on an uploaded copy of the Senate's list."""
    _require_office_admin(request)
    uploaded = request.FILES.get("file")
    if uploaded is None:
        return Response({"error": "Choose a file."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return Response(match_senate_list(uploaded))
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_graduation_check_view(request, matric_no):
    """The same check for one student, shown on the Student Record."""
    _require_office_admin(request)
    student, error = _find_student(matric_no)
    if error:
        return error
    if student.status != Student.Status.ACTIVE or is_waiting(student):
        return Response({"error": f"Their status is {student.get_status_display()}."}, status=status.HTTP_409_CONFLICT)
    return Response({**check_student(student), "lastSemesters": [_semester_choice(row) for row in last_semesters()]})
