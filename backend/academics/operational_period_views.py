"""Office operational configuration and privacy-scoped intake availability APIs."""
from functools import wraps
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.models import Student, User
from .models import AcademicSemester, OperationalPeriod, OperationalException
from .services import current_effective_semester
from . import operational_periods as service


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key:'Unknown field.' for key in unknown})
        return super().to_internal_value(data)


class PeriodWrite(StrictSerializer):
    semesterId = serializers.IntegerField(min_value=1)
    activity = serializers.ChoiceField(choices=OperationalPeriod.Activity.choices)
    name = serializers.CharField(max_length=255)
    programmeScope = serializers.ChoiceField(choices=OperationalPeriod.Scope.choices, default='ALL')
    programmes = serializers.ListField(child=serializers.CharField(max_length=255), default=list)
    opensAt = serializers.DateTimeField()
    closesAt = serializers.DateTimeField()
    expectedRevision = serializers.IntegerField(min_value=1,required=False)
    timelineEntryId = serializers.IntegerField(min_value=1,required=False,allow_null=True)


class PeriodPatch(StrictSerializer):
    reason = serializers.CharField(required=False,default="")
    name = serializers.CharField(max_length=255,required=False)
    programmeScope = serializers.ChoiceField(choices=OperationalPeriod.Scope.choices,required=False)
    programmes = serializers.ListField(child=serializers.CharField(max_length=255),required=False)
    opensAt = serializers.DateTimeField(required=False)
    closesAt = serializers.DateTimeField(required=False)
    expectedRevision = serializers.IntegerField(min_value=1,required=False)


class PeriodCommand(StrictSerializer):
    expectedRevision = serializers.IntegerField(min_value=1,required=False)
    reason = serializers.CharField(required=False,default='')


class PeriodExtend(PeriodCommand):
    expectedRevision = serializers.IntegerField(min_value=1)
    reason = serializers.CharField()
    closesAt = serializers.DateTimeField()


class ExceptionWrite(StrictSerializer):
    studentId = serializers.IntegerField(min_value=1)
    participantId = serializers.IntegerField(min_value=1)
    deadline = serializers.DateTimeField()
    reason = serializers.CharField()
    expectedRevision = serializers.IntegerField(min_value=1,required=False)


class EnforcementWrite(StrictSerializer):
    semesterId = serializers.IntegerField(min_value=1)
    activity = serializers.ChoiceField(choices=OperationalPeriod.Activity.choices)
    enabled = serializers.BooleanField()
    reason = serializers.CharField()


class AvailabilityQuery(StrictSerializer):
    activity = serializers.ChoiceField(choices=OperationalPeriod.Activity.choices)
    studentId = serializers.IntegerField(min_value=1,required=False)
    semesterId = serializers.IntegerField(min_value=1,required=False)


FIELD_MAP = {'name':'name','programmeScope':'programme_scope','programmes':'programmes','opensAt':'opens_at','closesAt':'closes_at'}


def validated(serializer_class,data):
    serializer = serializer_class(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def office_endpoint(methods):
    def decorate(function):
        @wraps(function)
        def wrapped(request,*args,**kwargs):
            service.require_office(request.user)
            try:
                return function(request,*args,**kwargs)
            except DjangoValidationError as exc:
                return Response({'error':getattr(exc,'message_dict',None) or exc.messages},status=400)
            except IntegrityError:
                raise service.OperationalConflict('The records changed concurrently. Reload and retry.')
        return api_view(methods)(permission_classes([IsAuthenticated])(wrapped))
    return decorate


def period_query():
    return OperationalPeriod.objects.select_related('academic_semester').prefetch_related('audits__actor')


def semester_from_query(request):
    value = request.query_params.get('semesterId')
    if value is None:
        raise serializers.ValidationError({'semesterId':'Select an academic semester.'})
    number = serializers.IntegerField(min_value=1).run_validation(value)
    return get_object_or_404(AcademicSemester,pk=number)


@office_endpoint(['GET','POST'])
def period_list(request):
    if request.method == 'GET':
        semester = semester_from_query(request)
        return Response({'periods':[service.period_payload(p,history=True) for p in period_query().filter(academic_semester=semester)],
                         'enforcement':service.enforcement_payload(semester)})
    data = validated(PeriodWrite,request.data)
    semester = get_object_or_404(AcademicSemester,pk=data['semesterId'])
    period = service.create_period(actor=request.user,semester=semester,values={target:data[source] for source,target in FIELD_MAP.items() if source in data} | {'activity':data['activity']},timeline_entry_id=data.get('timelineEntryId'))
    return Response(service.period_payload(period,history=True),status=201)


@office_endpoint(['GET','PATCH'])
def period_detail(request,pk):
    period = get_object_or_404(period_query(),pk=pk)
    if request.method == 'GET':
        return Response(service.period_payload(period,history=True))
    data = validated(PeriodPatch,request.data)
    period = service.mutate_period(actor=request.user,period=period,action='UPDATE',
        values={target:data[source] for source,target in FIELD_MAP.items() if source in data},reason=data.get('reason',''),expected_revision=data.get('expectedRevision'))
    return Response(service.period_payload(period,history=True))


@office_endpoint(['POST'])
def period_action(request,pk,action):
    period = get_object_or_404(period_query(),pk=pk)
    data = validated(PeriodExtend if action=='EXTEND' else PeriodCommand,request.data)
    period = service.mutate_period(actor=request.user,period=period,action=action,reason=data.get('reason',''),
        expected_revision=data.get('expectedRevision'),values={'closes_at':data['closesAt']} if 'closesAt' in data else {})
    return Response(service.period_payload(period,history=True))


@office_endpoint(['GET','POST'])
def enforcement(request):
    if request.method=='GET':
        semester = semester_from_query(request)
    else:
        data = validated(EnforcementWrite,request.data)
        semester = get_object_or_404(AcademicSemester,pk=data['semesterId'])
        service.set_enforcement(actor=request.user,semester=semester,activity=data['activity'],enabled=data['enabled'],reason=data['reason'])
    return Response({'semesterId':semester.pk,'enforcement':service.enforcement_payload(semester)})


@office_endpoint(['GET','POST'])
def exceptions(request,pk):
    period = get_object_or_404(period_query(),pk=pk)
    if request.method=='GET':
        return Response({'exceptions':[service.exception_payload(e) for e in period.exceptions.select_related('student','participant','created_by','period__academic_semester')]})
    data = validated(ExceptionWrite,request.data)
    exception = service.grant_exception(actor=request.user,period=period,
        student=get_object_or_404(Student.objects.select_related('user'),pk=data['studentId']),
        participant=get_object_or_404(User,pk=data['participantId']),deadline=data['deadline'],reason=data['reason'],expected_revision=data.get('expectedRevision'))
    return Response(service.exception_payload(exception),status=201)


@office_endpoint(['POST'])
def revoke_exception(request,pk):
    exception = get_object_or_404(OperationalException.objects.select_related('period__academic_semester','student','participant'),pk=pk)
    data = validated(PeriodCommand,request.data)
    exception = service.revoke_exception(actor=request.user,exception=exception,reason=data.get('reason',''),expected_revision=data.get('expectedRevision'))
    return Response(service.exception_payload(exception))


@office_endpoint(['GET'])
def exception_candidates(request,pk):
    from appointments.models import StudentResearchProfile
    period = get_object_or_404(period_query(),pk=pk)
    candidates = []
    if period.lifecycle_status != 'PUBLISHED' or period.academic_semester.lifecycle_status in ('CLOSED','ARCHIVED'):
        return Response({'candidates':candidates})
    for student in Student.objects.select_related('user').filter(status=Student.Status.ACTIVE,user__is_active=True).order_by('matric_no'):
        if not service.applies(period,student):
            continue
        if period.activity == 'SUPERVISOR_APPLICATION':
            participant = student.user
        else:
            profile = StudentResearchProfile.objects.select_related('supervisor__lecturer').filter(student_id=student.pk).first()
            if not profile:
                continue
            participant = profile.supervisor
        if service.eligible_participant(activity=period.activity,student=student,participant=participant):
            candidates.append(dict(studentId=student.pk,studentName=student.user.full_name,matricNo=student.matric_no,
                programme=student.programme,participantId=participant.pk,participantName=participant.full_name))
    return Response({'candidates':candidates})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def availability(request):
    data = validated(AvailabilityQuery,request.query_params)
    actor = request.user
    activity = data['activity']
    student_id = data.get('studentId',actor.pk if actor.role==User.Role.STUDENT else None)
    if actor.role==User.Role.STUDENT:
        if activity!='SUPERVISOR_APPLICATION' or student_id!=actor.pk:
            raise PermissionDenied('Only your own Supervisor application intake is available.')
    elif actor.role==User.Role.LECTURER:
        if activity!='PANEL_RECOMMENDATION' or student_id is None:
            raise PermissionDenied('Select a student for whom you hold the active primary supervisor appointment.')
    elif actor.role!=User.Role.OFFICE_ADMIN:
        raise PermissionDenied('Intake availability is limited to the submitting participant or Office.')
    if student_id is None:
        raise serializers.ValidationError({'studentId':'Select a student.'})
    student = get_object_or_404(Student.objects.select_related('user'),pk=student_id)
    if activity=='SUPERVISOR_APPLICATION':
        participant = student.user
    elif actor.role==User.Role.OFFICE_ADMIN:
        from appointments.models import StudentResearchProfile
        profile = get_object_or_404(StudentResearchProfile.objects.select_related('supervisor'),student_id=student_id)
        participant = profile.supervisor
    else:
        participant = actor
    if actor.role==User.Role.LECTURER:
        from appointments.models import StudentResearchProfile, SupervisorAppointment
        if not StudentResearchProfile.objects.filter(student_id=student.pk,supervisor=actor).exists() or not SupervisorAppointment.objects.filter(student=student,supervisor=actor,status='ACTIVE').exists():
            raise PermissionDenied('Only the current active primary supervisor can inspect this intake.')
    semester = get_object_or_404(AcademicSemester,pk=data['semesterId']) if 'semesterId' in data else current_effective_semester()
    return Response(service.resolve_availability(semester=semester,activity=activity,student=student,participant=participant))
