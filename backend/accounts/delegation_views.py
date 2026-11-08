from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .delegations import grant_delegation, is_office, require_office, revoke_delegation, serialize_delegation
from .models import CoordinatorDelegation, Lecturer, User
from .programmes import APPROVED_PROGRAMMES


class GrantSerializer(serializers.Serializer):
    coordinatorId = serializers.IntegerField(min_value=1)
    programme = serializers.CharField(max_length=255)
    startsOn = serializers.DateField()
    endsOn = serializers.DateField()
    justification = serializers.CharField(trim_whitespace=True)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def delegations_view(request):
    if request.method == 'POST':
        require_office(request.user)
        serializer = GrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        row = grant_delegation(actor=request.user, coordinator_id=data['coordinatorId'], programme=data['programme'], starts_on=data['startsOn'], ends_on=data['endsOn'], justification=data['justification'])
        return Response(serialize_delegation(row, request.user), status=201)
    rows = CoordinatorDelegation.objects.select_related('coordinator', 'granted_by', 'revoked_by')
    if not is_office(request.user):
        if request.user.role != User.Role.COORDINATOR:
            raise PermissionDenied('Only Office Staff/Admin and Programme Coordinators may view delegations.')
        rows = rows.filter(coordinator=request.user)
    return Response([serialize_delegation(row, request.user) for row in rows])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def options_view(request):
    require_office(request.user)
    users = User.objects.filter(is_active=True, role=User.Role.COORDINATOR, lecturer__lifecycle_status=Lecturer.Lifecycle.ACTIVE, lecturer__coordinator__isnull=False).select_related('lecturer__coordinator')
    return Response({'programmes': APPROVED_PROGRAMMES, 'coordinators': [{'id': user.pk, 'name': user.full_name, 'programme': user.lecturer.coordinator.programme_managed.strip()} for user in users]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def revoke_view(request, delegation_id):
    require_office(request.user)
    get_object_or_404(CoordinatorDelegation, pk=delegation_id)
    row = revoke_delegation(delegation_id=delegation_id, actor=request.user, reason=request.data.get('reason'))
    return Response(serialize_delegation(row, request.user))
