"""Graduating students from Student Registry. Office only."""
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .graduation import check_student, graduate_many, overview
from .models import Student
from .registry_views import _find_student, _require_office_admin

MAX_LIST = 2000


def _matric_list(**kwargs):
    return serializers.ListField(child=serializers.CharField(max_length=64), max_length=MAX_LIST, **kwargs)


class GraduateSerializer(serializers.Serializer):
    matrics = _matric_list(allow_empty=False)
    earlyApproved = _matric_list(required=False, default=list)
    reason = serializers.CharField(max_length=1000)

    def validate_reason(self, value):
        reason = value.strip()
        if not reason:
            raise serializers.ValidationError("Say why, such as the Senate meeting.")
        return reason


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def graduation_view(request):
    """Who can graduate and who is still held up, or graduate the students ticked."""
    _require_office_admin(request)
    if request.method == "GET":
        return Response(overview())
    serializer = GraduateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    return Response(graduate_many(data["matrics"], actor=request.user, reason=data["reason"], early_approved=data["earlyApproved"]))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_graduation_check_view(request, matric_no):
    """The same check for one student, shown on the Student Record."""
    _require_office_admin(request)
    student, error = _find_student(matric_no)
    if error:
        return error
    if student.status != Student.Status.ACTIVE:
        return Response({"error": f"Their status is {student.status}."}, status=status.HTTP_409_CONFLICT)
    return Response(check_student(student))
