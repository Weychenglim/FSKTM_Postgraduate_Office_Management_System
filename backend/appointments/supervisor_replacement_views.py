from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser
from rest_framework.response import Response

from .models import SupervisorAppointment
from .serializers import SupervisorApplicationSerializer
from .supervisor_replacement import (
    ReplacementSerializer, initiate_replacement, replacement_context, require_office,
)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def replacement_view(request, pk):
    require_office(request.user)
    if request.method == "GET":
        appointment = get_object_or_404(SupervisorAppointment.objects.select_related(
            "student__user", "supervisor", "application"), pk=pk)
        return Response(replacement_context(appointment, request.user))
    serializer = ReplacementSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    application = initiate_replacement(
        appointment_id=pk, actor=request.user,
        proposed_supervisor_id=serializer.validated_data["proposedSupervisorId"],
        reason=serializer.validated_data["reason"],
    )
    return Response(SupervisorApplicationSerializer(application, context={"request": request}).data, status=201)
