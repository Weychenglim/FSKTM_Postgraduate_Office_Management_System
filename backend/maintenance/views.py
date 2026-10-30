"""Portal maintenance: anyone can see whether it is planned or on; the PG office
plans, changes and ends it."""
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from accounts.authorization import office_actor

from . import state


class OfficeOnly(BasePermission):
    message = "Only the PG office can change portal maintenance."

    def has_permission(self, request, view):
        return office_actor(request.user)


class ChangeSerializer(serializers.Serializer):
    startsAt = serializers.DateTimeField(allow_null=True, default=None)
    expectedEnd = serializers.DateTimeField(allow_null=True, default=None)
    message = serializers.CharField(allow_blank=True, default="", trim_whitespace=True)


@require_GET
def status_view(request):
    response = JsonResponse(state.public_dict())
    response["Cache-Control"] = "no-store"
    return response


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated, OfficeOnly])
def manage_view(request):
    if request.method == "PUT":
        serializer = ChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            state.change(
                request.user,
                starts_at=serializer.validated_data["startsAt"],
                expected_end=serializer.validated_data["expectedEnd"],
                message=serializer.validated_data["message"],
            )
        except state.MaintenanceProblem as problem:
            return Response(problem.errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(state.office_dict())


@api_view(["POST"])
@permission_classes([IsAuthenticated, OfficeOnly])
def end_view(request):
    try:
        state.end(request.user)
    except state.MaintenanceProblem as problem:
        return Response(problem.errors, status=status.HTTP_409_CONFLICT)
    return Response(state.office_dict())
