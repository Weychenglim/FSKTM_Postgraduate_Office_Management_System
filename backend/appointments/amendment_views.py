from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import Student, User
from accounts.eligibility import user_is_assignable_lecturer
from . import research_amendments as service
from .models import ResearchAmendment, ResearchProfileRevision


class AmendmentInput(serializers.Serializer):
    studentId = serializers.IntegerField(min_value=1, required=False)
    kind = serializers.ChoiceField(choices=['RESEARCH', 'TRANSFER'], required=False)
    title = serializers.CharField(max_length=500, required=False)
    abstract = serializers.CharField(required=False)
    destinationProgramme = serializers.CharField(max_length=255, required=False)
    reason = serializers.CharField(required=False, allow_blank=True)
    meaningUnchanged = serializers.BooleanField(required=False)
    expectedRevision = serializers.IntegerField(min_value=0, required=False)
    decision = serializers.ChoiceField(choices=['APPROVE', 'REJECT'], required=False)
    retainTeam = serializers.BooleanField(required=False)
    expectedStatus = serializers.ChoiceField(choices=ResearchAmendment.Status.choices, required=False)


def _data(request):
    serializer = AmendmentInput(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def _perform(action):
    try:
        return action()
    except service.AmendmentForbidden as exc:
        return Response({'error': str(exc)}, status=403)
    except service.AmendmentConflict as exc:
        return Response({'error': str(exc)}, status=409)
    except IntegrityError:
        return Response({'error': 'The record changed concurrently; refresh before retrying.'}, status=409)
    except ObjectDoesNotExist:
        return Response({'error': 'A linked student research record was not found.'}, status=404)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=400)


def _student_filter(request):
    serializer = AmendmentInput(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data.get('studentId')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def collection(request):
    if request.method == 'POST':
        data = _data(request)
        return _perform(lambda: Response(service.request_payload(service.submit(actor=request.user, data=data), request.user), status=201))
    rows = service.scoped_requests(request.user)
    student_id = _student_filter(request)
    if student_id is not None:
        rows = rows.filter(student_id=student_id)
    if (request.user.role == User.Role.COORDINATOR or service.office(request.user)) and 'page' in request.query_params:
        from .research_paging import collection_page
        return Response(collection_page(rows, request.user, request.query_params))
    profiles = service.current_profiles(request.user)
    if student_id is not None:
        profiles = profiles.filter(student_id=student_id)
    revisions = ResearchProfileRevision.objects.filter(profile__in=profiles).select_related('actor', 'profile').order_by('-created_at', '-pk')
    return Response({'requests': [service.request_payload(row, request.user) for row in rows],
                     'revisions': [service.revision_payload(row) for row in revisions]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def options(request):
    student_id = _student_filter(request)
    if (request.user.role == User.Role.COORDINATOR or service.office(request.user)) and student_id is None and request.query_params.get('minimal') == 'true':
        return Response({'students': [], 'programmes': [], 'profile': None,
                         'canSubmitResearch': False, 'canCorrect': False, 'canTransfer': False})
    profiles = service.current_profiles(request.user)
    selected = profiles.filter(student_id=student_id).first() if student_id is not None else (profiles.first() if request.user.role == User.Role.STUDENT else None)
    if student_id is not None and selected is None:
        return Response({'error': 'Student research record was not found.'}, status=404)
    eligible = bool(selected and selected.student.student.status == Student.Status.ACTIVE and selected.student.is_active)
    pending = bool(selected and ResearchAmendment.objects.filter(student_id=selected.student_id, status__in=ResearchAmendment.PENDING_STATUSES).exists())
    primary = False
    if eligible:
        try:
            service._primary(selected.student.student, selected)
            primary = True
        except service.AmendmentConflict:
            pass
    student_rows = ([selected] if selected else []) if request.query_params.get('selectedOnly') == 'true' else profiles
    return Response({
        'students': [{'id': row.student_id, 'name': row.student.full_name,
                      'matricNo': row.student.student.matric_no, 'programme': row.student.student.programme} for row in student_rows],
        'programmes': service.programme_options() if service.office(request.user) else [],
        'profile': {**service.snapshot(selected), 'studentId': selected.student_id, 'revision': selected.revision} if selected else None,
        'canSubmitResearch': eligible and not pending and primary and request.user.role == User.Role.STUDENT,
        'canCorrect': eligible and not pending and service.office(request.user),
        'canTransfer': False,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profiles(request):
    actor = request.user
    if not actor.is_active or not (service.office(actor) or actor.role == User.Role.COORDINATOR or user_is_assignable_lecturer(actor)):
        return Response({'error': 'Research profile browsing is available to authorised staff.'}, status=403)
    from .research_profiles import profile_page
    return Response(profile_page(actor, request.query_params))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detail(request, pk):
    row = get_object_or_404(service.scoped_requests(request.user, routine=False), pk=pk)
    payload = service.request_payload(row, request.user)
    if request.user.role == User.Role.COORDINATOR:
        payload['canDecide'] = payload['canDecide'] and row.student.user.is_active
    return Response(payload)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decision(request, pk):
    get_object_or_404(service.scoped_requests(request.user), pk=pk)
    data = _data(request)
    if 'expectedStatus' not in data:
        return Response({'error': 'Refresh the request and provide its current approval stage.'}, status=400)
    return _perform(lambda: Response(service.request_payload(service.decide(request_id=pk,
        actor=request.user, decision=data.get('decision'), reason=data.get('reason', ''),
        retain_team=data.get('retainTeam', False), expected_status=data['expectedStatus']), request.user)))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel(request, pk):
    get_object_or_404(service.scoped_requests(request.user), pk=pk)
    data = _data(request)
    return _perform(lambda: Response(service.request_payload(service.cancel(request_id=pk,
        actor=request.user, reason=data.get('reason')), request.user)))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def corrections(request):
    data = _data(request)
    return _perform(lambda: Response(service.revision_payload(service.correct(actor=request.user, data=data))))
