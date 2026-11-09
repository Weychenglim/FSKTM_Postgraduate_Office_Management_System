"""The office records what happened to a student, and the status follows."""
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Student, StudentCompletion
from .participant_lifecycle import (
    ParticipantLifecycleConflict,
    _set_student_status,
    blacklist_user_refresh_tokens,
    transition_student,
)
from .registry_views import _find_student, _require_office_admin, to_record
from .semester_rules import LEAVE_OUTCOMES, STUDIED, active_semester, is_waiting, record_semester, starts_later, sync_current

LEAVE, END_LEAVE, WITHDRAW, TERMINATE, DECEASED, REINSTATE = "LEAVE", "END_LEAVE", "WITHDRAW", "TERMINATE", "DECEASED", "REINSTATE"


class StatusActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=[LEAVE, END_LEAVE, WITHDRAW, TERMINATE, DECEASED, REINSTATE])
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    outcome = serializers.ChoiceField(choices=LEAVE_OUTCOMES, required=False)
    exitReason = serializers.ChoiceField(choices=Student.ExitReason.choices, required=False)

    def validate(self, attrs):
        if attrs["action"] == LEAVE and "outcome" not in attrs:
            raise serializers.ValidationError({"outcome": ["Choose the type of leave."]})
        if attrs["action"] == TERMINATE and "exitReason" not in attrs:
            raise serializers.ValidationError({"exitReason": ["Choose why candidature ended."]})
        return attrs


def _change(student, actor, target, reason):
    transition_student(matric_no=student.matric_no, actor=actor, target_status=target, reason=reason)
    student.refresh_from_db()


def _active_row(student, semester):
    return student.semesters.filter(session=semester.session, term=semester.term).first()


def _record_leave(student, outcome, actor, reason):
    semester = active_semester()
    if semester is None:
        raise ValueError("There is no active semester.")
    if starts_later(student, semester):
        raise ParticipantLifecycleConflict("This student has not started yet.", {})
    if is_waiting(student):
        raise ParticipantLifecycleConflict("This student has finished and is waiting for the Senate.", {})
    if _active_row(student, semester) is None and semester.is_special:
        raise ParticipantLifecycleConflict("This student is not taking the Special Semester.", {})
    if student.status == Student.Status.ACTIVE:
        _change(student, actor, "DEFERRED", reason)
    elif student.status != Student.Status.DEFERRED:
        raise ParticipantLifecycleConflict("This student can't take semester leave.", {})
    row = _active_row(student, semester)
    if row is None:
        record_semester(student, semester, actor=actor, outcome=outcome, note=reason[:255])
    else:
        row.outcome = outcome
        row.note = reason[:255]
        row.save(update_fields=["outcome", "note", "updated_at"])
        sync_current(student)


def _end_leave(student, actor, reason):
    _change(student, actor, "ACTIVE", reason)
    semester = active_semester()
    row = _active_row(student, semester) if semester else None
    if row is not None and row.outcome in LEAVE_OUTCOMES:
        row.outcome = STUDIED
        row.note = ""
        row.save(update_fields=["outcome", "note", "updated_at"])


def _leave_studies(student, actor, target, reason, exit_reason=""):
    StudentCompletion.objects.filter(pk=student.pk, senate_decision__isnull=True).delete()
    _change(student, actor, target, reason)
    student.exit_reason = exit_reason
    student.save(update_fields=["exit_reason"])
    if target == "DECEASED":
        student.user.is_active = False
        student.user.save(update_fields=["is_active"])
        blacklist_user_refresh_tokens(student.user)


def _reinstate(student, actor, reason):
    if student.status not in (Student.Status.TERMINATED, Student.Status.DECEASED):
        raise ParticipantLifecycleConflict("Only a terminated student can be reinstated.", {})
    if student.status == Student.Status.DECEASED and not student.user.is_active:
        student.user.is_active = True
        student.user.save(update_fields=["is_active"])
    _set_student_status(student, target=Student.Status.ACTIVE, actor=actor, reason=reason, affected={"reinstated": True})
    student.exit_reason = ""
    student.save(update_fields=["exit_reason"])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def student_status_action_view(request, matric_no):
    _require_office_admin(request)
    student, error = _find_student(matric_no)
    if error:
        return error
    serializer = StatusActionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    action, reason = data["action"], data["reason"]
    try:
        with transaction.atomic():
            if action == LEAVE:
                _record_leave(student, data["outcome"], request.user, reason)
            elif action == END_LEAVE:
                _end_leave(student, request.user, reason)
            elif action == WITHDRAW:
                _leave_studies(student, request.user, "WITHDRAWN", reason)
            elif action == TERMINATE:
                _leave_studies(student, request.user, "TERMINATED", reason, data["exitReason"])
            elif action == DECEASED:
                _leave_studies(student, request.user, "DECEASED", reason)
            else:
                _reinstate(student, request.user, reason)
    except PermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except ParticipantLifecycleConflict as exc:
        return Response({"error": str(exc), "blockers": exc.blockers}, status=status.HTTP_409_CONFLICT)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    student.refresh_from_db()
    return Response(to_record(student))
