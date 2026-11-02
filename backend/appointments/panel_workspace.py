"""Read-only, Office-only Panel attention projections with database pagination."""
from django.db.models import (Case, CharField, Count, DateField, DateTimeField, Exists,
                             F, IntegerField, OuterRef, Q, Subquery, Value, When)
from django.db.models.functions import Coalesce, Trim
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.capacity import CapacityRole, derive_capacity_resolution
from academics.models import LecturerAvailabilityWindow, LecturerCapacityEntry, SemesterCapacityPlan
from academics.services import current_effective_semester
from accounts.models import Lecturer, Student, User
from . import coordinator_workspace as browse
from .ageing import elapsed_calendar_days
from .models import (AppointmentWorkflowEvent, PanelAppointment, PanelRecommendation,
                     ResearchAmendment, StudentResearchProfile, SupervisorAppointment)


WAITING_STATUSES = PanelRecommendation.PENDING_STATUSES
CONCERN_REASONS = ('near_limit', 'full', 'over_capacity', 'not_configured', 'temporarily_unavailable')


def options(params):
    category = str(params.get('category', 'students')).strip()
    choices = {
        'students': {'sort': ('no_request', 'name'), 'status': ('', 'none', 'in_progress')},
        'waiting': {'sort': ('waiting', 'oldest', 'newest'), 'status': ('', *WAITING_STATUSES)},
        'workload': {'sort': ('name', 'load'), 'status': ('', *CONCERN_REASONS)},
    }
    if category not in choices:
        raise ValidationError({'category': 'Use students, waiting, or workload.'})
    opts = {key: str(params.get(key, default)).strip() for key, default in (
        ('q', ''), ('programme', ''), ('semester', ''), ('status', ''),
        ('sort', choices[category]['sort'][0]))}
    for key, default in (('page', 1), ('size', 10)):
        try:
            opts[key] = int(params.get(key, default))
        except (TypeError, ValueError):
            raise ValidationError({key: 'Use a positive integer.'})
    if opts['page'] < 1 or opts['size'] not in (10, 25, 50):
        raise ValidationError('Page must be positive and size must be 10, 25, or 50.')
    for key, allowed in choices[category].items():
        if opts[key] not in allowed:
            raise ValidationError({key: 'Unsupported filter value.'})
    for key in ('from', 'to'):
        raw = str(params.get(key, '')).strip()
        try:
            opts[key] = parse_date(raw) if raw else None
        except ValueError:
            opts[key] = None
        if raw and (opts[key] is None or opts[key].isoformat() != raw):
            raise ValidationError({key: 'Use an ISO date (YYYY-MM-DD).'})
    if opts['from'] and opts['to'] and opts['from'] > opts['to']:
        raise ValidationError('The start date must be before the end date.')
    if category == 'workload':
        for key in ('programme', 'semester'):
            if opts[key]:
                raise ValidationError({key: 'Panel workload uses the current capacity semester and all active and reserved appointments.'})
    return category, opts


def active_student_q(prefix):
    return Q(**{f'{prefix}__student__status': Student.Status.ACTIVE,
                f'{prefix}__is_active': True, f'{prefix}__role': User.Role.STUDENT})


def students_without_panel():
    """Current nomination eligibility and coverage, independent of workflow history."""
    primary = SupervisorAppointment.objects.filter(student_id=OuterRef('student_id'),
        supervisor_id=OuterRef('supervisor_id'), status='ACTIVE')
    panel = PanelAppointment.objects.filter(profile_id=OuterRef('pk'), status='ACTIVE')
    pending = PanelRecommendation.objects.filter(profile_id=OuterRef('pk'), status__in=WAITING_STATUSES).order_by('-submitted_at', '-pk')
    transfer = ResearchAmendment.objects.filter(student_id=OuterRef('student_id'), kind='TRANSFER',
        status__in=ResearchAmendment.PENDING_STATUSES)
    return StudentResearchProfile.objects.filter(active_student_q('student'),
        supervisor__is_active=True, supervisor__role=User.Role.LECTURER,
        supervisor__lecturer__lifecycle_status=Lecturer.Lifecycle.ACTIVE,
        programme__trim__iexact=Trim(F('student__student__programme')),
    ).annotate(hasPrimary=Exists(primary), hasPanel=Exists(panel), hasTransfer=Exists(transfer)).filter(
        hasPrimary=True, hasPanel=False, hasTransfer=False).annotate(
        recommendationId=Subquery(pending.values('pk')[:1]), pendingStatus=Subquery(pending.values('status')[:1]),
        studentProgramme=F('student__student__programme'),
        reason=Case(When(recommendationId__isnull=True, then=Value('none')), default=Value('in_progress'), output_field=CharField()))


def facets(rows, *, programme, semester, status):
    return {key: list(rows.order_by().exclude(**{f'{field}__isnull': True}).exclude(**{field: ''})
        .values_list(field, flat=True).distinct().order_by(field))
        for key, field in (('programmes', programme), ('semesters', semester), ('statuses', status))}


def students_page(opts):
    rows = students_without_panel()
    available = facets(rows, programme='studentProgramme', semester='semester', status='reason')
    if opts['q']:
        rows = rows.filter(Q(student__full_name__icontains=opts['q']) |
            Q(student__student__matric_no__icontains=opts['q']) | Q(supervisor__full_name__icontains=opts['q']))
    if opts['programme']:
        rows = rows.filter(studentProgramme__trim__iexact=opts['programme'])
    if opts['semester']:
        rows = rows.filter(semester=opts['semester'])
    if opts['status']:
        rows = rows.filter(reason=opts['status'])
    order = ('student__full_name', 'student__student__matric_no', 'pk')
    if opts['sort'] == 'no_request':
        rows = rows.annotate(pendingOrder=Case(When(recommendationId__isnull=True, then=Value(0)),
            default=Value(1), output_field=IntegerField()))
        order = ('pendingOrder', *order)
    rows = rows.order_by(*order).annotate(rowId=F('student_id'), profileId=F('pk'),
        studentName=F('student__full_name'), matricNo=F('student__student__matric_no'),
        supervisorId=F('supervisor_id'), supervisorName=F('supervisor__full_name')).values(
            'rowId', 'profileId', 'studentName', 'matricNo', 'studentProgramme', 'semester',
            'supervisorId', 'supervisorName', 'recommendationId', 'pendingStatus', 'reason')
    def compact(row):
        row['id'] = row.pop('rowId')
        row['programme'] = row.pop('studentProgramme')
        return row
    return browse.envelope(rows, opts, available, serializer=compact)


def waiting_recommendations():
    # Keep stuck ongoing work visible even when a primary appointment has since ended.
    return PanelRecommendation.objects.filter(active_student_q('profile__student'), status__in=WAITING_STATUSES)


def waiting_page(opts):
    transition = AppointmentWorkflowEvent.objects.filter(panel_recommendation_id=OuterRef('pk'),
        new_status=OuterRef('status')).order_by('created_at', 'pk').values('created_at')[:1]
    rows = waiting_recommendations().annotate(
        waitingSince=Case(When(status='PENDING_COORDINATOR', then=Coalesce('panel_decided_at', Subquery(transition), 'updated_at')),
            default=Coalesce('submitted_at', Subquery(transition), 'updated_at'), output_field=DateTimeField()),
        waitingOn=Case(When(status='PENDING_COORDINATOR', then=Value('PROGRAMME_COORDINATOR')),
            default=Value('SELECTED_PANEL'), output_field=CharField()),
        semesterLabel=Coalesce(browse.semester_label('academic_semester__label'), F('profile__semester')),
        submittedAt=F('submitted_at'), submittedFilterAt=Coalesce('submitted_at', 'created_at'))
    available = facets(rows, programme='profile__student__student__programme', semester='semesterLabel', status='status')
    if opts['q']:
        rows = rows.filter(Q(profile__student__full_name__icontains=opts['q']) |
            Q(profile__student__student__matric_no__icontains=opts['q']) |
            Q(recommended_member__full_name__icontains=opts['q']) | Q(profile__proposed_topic__icontains=opts['q']))
    if opts['programme']:
        rows = rows.filter(profile__student__student__programme__trim__iexact=opts['programme'])
    if opts['semester']:
        rows = rows.filter(semesterLabel=opts['semester'])
    if opts['status']:
        rows = rows.filter(status=opts['status'])
    for key, lookup in (('from', 'gte'), ('to', 'lte')):
        if opts[key]:
            rows = rows.filter(**{f'submittedFilterAt__date__{lookup}': opts[key]})
    order = 'waitingSince' if opts['sort'] == 'waiting' else 'submittedFilterAt'
    direction = F(order).desc(nulls_last=True) if opts['sort'] == 'newest' else F(order).asc(nulls_last=True)
    rows = rows.order_by(direction, 'pk').annotate(rowId=F('pk'), studentId=F('profile__student_id'),
        profileId=F('profile_id'), studentName=F('profile__student__full_name'),
        matricNo=F('profile__student__student__matric_no'), programme=F('profile__student__student__programme'),
        candidateName=F('recommended_member__full_name')).values('rowId', 'profileId', 'studentId', 'studentName',
            'matricNo', 'programme', 'semesterLabel', 'candidateName', 'status', 'submittedAt', 'waitingSince', 'waitingOn')
    def compact(row):
        row['id'] = row.pop('rowId')
        row['key'] = f"panel-{row['id']}"
        row['kind'] = 'panel'
        row['semester'] = row.pop('semesterLabel')
        row['waitingDays'] = elapsed_calendar_days(row['waitingSince'])
        return row
    return browse.envelope(rows, opts, available, serializer=compact)


def workload_rows(semester):
    """Batch the exact resolver inputs, including reservations from all semesters."""
    rows = Lecturer.objects.filter(user__is_active=True, lifecycle_status=Lecturer.Lifecycle.ACTIVE, panel__isnull=False)
    def count(model, field, statuses):
        return Coalesce(Subquery(model.objects.filter(**{f'{field}_id': OuterRef('pk'), 'status__in': statuses})
            .order_by().values(field).annotate(total=Count('pk')).values('total')[:1]), 0)
    rows = rows.annotate(activeLoad=count(PanelAppointment, 'panel_member', ('ACTIVE',)),
        reservedLoad=count(PanelRecommendation, 'recommended_member', PanelRecommendation.WORKLOAD_RESERVED_STATUSES))
    plan = SemesterCapacityPlan.objects.filter(academic_semester=semester, lifecycle_status='PUBLISHED').only('pk', 'version').first() if semester else None
    limit = Subquery(LecturerCapacityEntry.objects.filter(plan=plan, lecturer_id=OuterRef('pk')).values('panel_limit')[:1]) if plan else Value(None, output_field=IntegerField())
    today = timezone.localdate()
    window = Subquery(LecturerAvailabilityWindow.objects.filter(academic_semester=semester, lecturer_id=OuterRef('pk'),
        role=CapacityRole.PANEL, cancelled_at__isnull=True, starts_on__lte=today, ends_on__gte=today)
        .order_by('-ends_on', '-pk').values('ends_on')[:1]) if semester else Value(None, output_field=DateField())
    rows = rows.annotate(currentStudents=F('activeLoad') + F('reservedLoad'), workloadLimit=limit,
        unavailableUntil=window).annotate(reason=Case(
            When(workloadLimit__isnull=True, then=Value('not_configured')),
            When(unavailableUntil__isnull=False, then=Value('temporarily_unavailable')),
            When(currentStudents__gt=F('workloadLimit'), then=Value('over_capacity')),
            When(currentStudents=F('workloadLimit'), then=Value('full')),
            When(Q(currentStudents__gte=1) & Q(currentStudents__gte=F('workloadLimit') - 1), then=Value('near_limit')),
            default=Value(''), output_field=CharField()))
    return rows, plan


def workload_page(opts):
    semester = current_effective_semester()
    rows, plan = workload_rows(semester)
    rows = rows.exclude(reason='')
    available = {'programmes': [], 'semesters': [],
        'statuses': list(rows.order_by().values_list('reason', flat=True).distinct().order_by('reason'))}
    if opts['q']:
        rows = rows.filter(Q(user__full_name__icontains=opts['q']) | Q(staff_no__icontains=opts['q']) | Q(department__icontains=opts['q']))
    if opts['status']:
        rows = rows.filter(reason=opts['status'])
    order = ('user__full_name', 'pk') if opts['sort'] == 'name' else ('-currentStudents', 'user__full_name', 'pk')
    rows = rows.order_by(*order).annotate(rowId=F('pk'), lecturerId=F('staff_no'),
        lecturerName=F('user__full_name')).values('rowId', 'lecturerId', 'lecturerName', 'department',
            'activeLoad', 'reservedLoad', 'currentStudents', 'workloadLimit', 'reason', 'unavailableUntil')
    def compact(row):
        resolution = derive_capacity_resolution(semester_id=semester.pk if semester else None,
            plan_id=plan.pk if plan else None, plan_version=plan.version if plan else None,
            role=CapacityRole.PANEL, limit=row['workloadLimit'], active_load=row['activeLoad'],
            reserved_load=row['reservedLoad'], eligible=True, unavailable_until=row['unavailableUntil'])
        row['id'] = row.pop('rowId')
        row['capacityState'] = resolution.state
        row['availableSlots'] = resolution.available_slots
        row['unavailableUntil'] = resolution.unavailable_until
        return row
    return browse.envelope(rows, opts, available, serializer=compact)


def attention_page(params):
    category, opts = options(params)
    return {'students': students_page, 'waiting': waiting_page, 'workload': workload_page}[category](opts)


def attention_summary():
    semester = current_effective_semester()
    workloads, _ = workload_rows(semester)
    return {'withoutPanel': students_without_panel().count(), 'waitingRequests': waiting_recommendations().count(),
        'workloadConcerns': workloads.exclude(reason='').count(),
        'capacitySemester': {'id': semester.pk, 'label': semester.label} if semester else None}


def require_office(user):
    if user.role != User.Role.OFFICE_ADMIN or not user.is_active:
        raise PermissionDenied('Only active Office Staff/Admin can view Panel attention.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def summary_view(request):
    require_office(request.user)
    return Response(attention_summary())


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attention_view(request):
    require_office(request.user)
    return Response(attention_page(request.query_params))
