from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from appointments.models import PanelRecommendation, SupervisorApplication

from .models import Lecturer, Student
from .participant_lifecycle import (
    ParticipantLifecycleConflict,
    assert_office_actor,
    cancel_pending_work,
    serialize_lecturer,
    serialize_student,
    transition_lecturer,
    transition_student,
)


def _office_or_403(request):
    try:
        assert_office_actor(request.user)
    except PermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    return None


def _error_response(exc):
    if isinstance(exc, ParticipantLifecycleConflict):
        return Response(
            {"error": str(exc), "blockers": exc.blockers},
            status=status.HTTP_409_CONFLICT,
        )
    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def participant_list_view(request):
    denied = _office_or_403(request)
    if denied:
        return denied
    participant_type = request.query_params.get("type", "ALL").upper()
    lifecycle_status = request.query_params.get("status", "").upper()
    programme = request.query_params.get("programme", "").strip()
    search = request.query_params.get("search", "").strip()
    students = Student.objects.select_related("user", "status_changed_by")
    lecturers = Lecturer.objects.select_related("user", "lifecycle_changed_by")
    if programme:
        students = students.filter(programme__iexact=programme)
    if search:
        students = students.filter(
            Q(matric_no__icontains=search) | Q(user__full_name__icontains=search)
        )
        lecturers = lecturers.filter(
            Q(staff_no__icontains=search) | Q(user__full_name__icontains=search)
        )
    if lifecycle_status:
        student_values = {choice.value.upper(): choice.value for choice in Student.Status}
        if lifecycle_status in student_values:
            students = students.filter(status=student_values[lifecycle_status])
        else:
            students = students.none()
        if lifecycle_status in Lecturer.Lifecycle.values:
            lecturers = lecturers.filter(lifecycle_status=lifecycle_status)
        else:
            lecturers = lecturers.none()
    rows = []
    if participant_type in {"ALL", "STUDENT"}:
        rows.extend(serialize_student(row, include_audits=False) for row in students)
    if participant_type in {"ALL", "LECTURER"}:
        rows.extend(serialize_lecturer(row, include_audits=False) for row in lecturers)
    rows.sort(key=lambda row: (row["participantType"], row["name"].casefold()))
    summary = {
        "activeStudents": Student.objects.filter(status=Student.Status.ACTIVE).count(),
        "deferredStudents": Student.objects.filter(status=Student.Status.DEFERRED).count(),
        "graduatedStudents": Student.objects.filter(status=Student.Status.GRADUATED).count(),
        "withdrawnStudents": Student.objects.filter(status__in=[Student.Status.WITHDRAWN, Student.Status.TERMINATED, Student.Status.DECEASED]).count(),
        "activeLecturers": Lecturer.objects.filter(lifecycle_status=Lecturer.Lifecycle.ACTIVE).count(),
        "retiringLecturers": Lecturer.objects.filter(lifecycle_status=Lecturer.Lifecycle.RETIRING).count(),
        "retiredLecturers": Lecturer.objects.filter(lifecycle_status=Lecturer.Lifecycle.RETIRED).count(),
        "resignedLecturers": Lecturer.objects.filter(lifecycle_status=Lecturer.Lifecycle.RESIGNED).count(),
    }
    programmes = list(
        Student.objects.exclude(programme="")
        .order_by("programme")
        .values_list("programme", flat=True)
        .distinct()
    )
    return Response({"summary": summary, "availableProgrammes": programmes, "records": rows})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_participant_detail_view(request, matric_no):
    denied = _office_or_403(request)
    if denied:
        return denied
    try:
        student = Student.objects.select_related("user", "status_changed_by").get(
            matric_no__iexact=matric_no
        )
    except Student.DoesNotExist:
        return Response({"error": "Participant was not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(serialize_student(student))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def student_transition_view(request, matric_no):
    denied = _office_or_403(request)
    if denied:
        return denied
    try:
        student = transition_student(
            matric_no=matric_no,
            actor=request.user,
            target_status=str(request.data.get("targetStatus", "")).upper(),
            reason=request.data.get("reason", ""),
        )
    except Student.DoesNotExist:
        return Response({"error": "Participant was not found."}, status=status.HTTP_404_NOT_FOUND)
    except (ValueError, ParticipantLifecycleConflict) as exc:
        return _error_response(exc)
    return Response(serialize_student(student))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lecturer_participant_detail_view(request, staff_no):
    denied = _office_or_403(request)
    if denied:
        return denied
    try:
        lecturer = Lecturer.objects.select_related("user", "lifecycle_changed_by").get(
            staff_no__iexact=staff_no
        )
    except Lecturer.DoesNotExist:
        return Response({"error": "Participant was not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(serialize_lecturer(lecturer))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def lecturer_transition_view(request, staff_no):
    denied = _office_or_403(request)
    if denied:
        return denied
    try:
        lecturer = transition_lecturer(
            staff_no=staff_no,
            actor=request.user,
            target_status=str(request.data.get("targetStatus", "")).upper(),
            reason=request.data.get("reason", ""),
        )
    except Lecturer.DoesNotExist:
        return Response({"error": "Participant was not found."}, status=status.HTTP_404_NOT_FOUND)
    except (ValueError, ParticipantLifecycleConflict) as exc:
        return _error_response(exc)
    return Response(serialize_lecturer(lecturer))


def _pending_cancel(request, participant):
    try:
        record = cancel_pending_work(
            participant=participant,
            actor=request.user,
            record_type=str(request.data.get("recordType", "")).upper(),
            record_id=request.data.get("recordId"),
            reason=request.data.get("reason", ""),
        )
    except (PanelRecommendation.DoesNotExist, SupervisorApplication.DoesNotExist):
        return Response(
            {"error": "Pending workflow was not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    except (ValueError, ParticipantLifecycleConflict) as exc:
        return _error_response(exc)
    return Response({"recordType": request.data.get("recordType"), "recordId": record.pk, "status": record.status})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def student_pending_cancel_view(request, matric_no):
    denied = _office_or_403(request)
    if denied:
        return denied
    try:
        student = Student.objects.get(matric_no__iexact=matric_no)
    except Student.DoesNotExist:
        return Response({"error": "Participant was not found."}, status=status.HTTP_404_NOT_FOUND)
    return _pending_cancel(request, student)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def lecturer_pending_cancel_view(request, staff_no):
    denied = _office_or_403(request)
    if denied:
        return denied
    try:
        lecturer = Lecturer.objects.select_related("user").get(staff_no__iexact=staff_no)
    except Lecturer.DoesNotExist:
        return Response({"error": "Participant was not found."}, status=status.HTTP_404_NOT_FOUND)
    return _pending_cancel(request, lecturer)
