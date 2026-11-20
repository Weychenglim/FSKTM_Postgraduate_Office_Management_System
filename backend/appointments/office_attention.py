"""Compact Office operational projections; filters, counts and pages stay in SQL."""
from django.db.models import (Case, CharField, Count, DateField, DateTimeField, Exists,
                             F, IntegerField, OuterRef, Q, Subquery, Value, When)
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from academics.capacity import CapacityRole, derive_capacity_resolution
from academics.models import LecturerAvailabilityWindow, LecturerCapacityEntry, SemesterCapacityPlan
from academics.services import current_effective_semester
from accounts.models import Lecturer, Student, User
from . import coordinator_workspace as browse
from .ageing import elapsed_calendar_days
from .attention_project_stages import filter_attention_stages, project_stage_filter, stage_coverage_page
from .models import (AppointmentWorkflowEvent, CoSupervisorAppointment, CoSupervisorNomination,
                     ResearchAmendment, ResearchAmendmentEvent, SupervisorApplication, SupervisorAppointment)


REASONS = ('near_limit', 'full', 'over_capacity', 'not_configured')
WAITING_STATUSES = tuple(dict.fromkeys((*browse.PENDING_PRIMARY, *CoSupervisorNomination.PENDING_STATUSES,
                                      *ResearchAmendment.PENDING_STATUSES)))


def options(params):
    category = str(params.get('category', 'students')).strip()
    if category not in ('students', 'waiting', 'workload'):
        raise ValidationError({'category': 'Use students, waiting, or workload.'})
    opts = {key: str(params.get(key, default)).strip() for key, default in (
        ('q', ''), ('programme', ''), ('semester', ''), ('status', ''), ('type', 'all'),
        ('sort', 'waiting' if category == 'waiting' else 'no_request' if category == 'students' else 'name'))}
    for key, default in (('page', 1), ('size', 10)):
        try:
            opts[key] = int(params.get(key, default))
        except (TypeError, ValueError):
            raise ValidationError({key: 'Use a positive integer.'})
    if opts['page'] < 1 or opts['size'] not in (10, 25, 50):
        raise ValidationError('Page must be positive and size must be 10, 25, or 50.')
    choices = {
        'students': {'sort': ('no_request', 'name'), 'status': ('', 'none', 'in_progress'), 'type': ('all',)},
        'waiting': {'sort': ('waiting', 'oldest', 'newest'), 'status': ('', *WAITING_STATUSES),
                    'type': ('all', 'primary', 'supporting', 'research', 'transfer')},
        'workload': {'sort': ('name', 'load'), 'status': ('', *REASONS), 'type': ('all',)},
    }
    for key, allowed in choices[category].items():
        if opts[key] not in allowed:
            raise ValidationError({key: 'Unsupported filter value.'})
    if category == 'waiting':
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
                raise ValidationError({key: 'Lecturer workload uses the current capacity semester and all active supervision.'})
    opts['projectStage'] = project_stage_filter(params, category)
    return category, opts


def eligible_students():
    return Student.objects.filter(status=Student.Status.ACTIVE, user__is_active=True, user__role=User.Role.STUDENT)


def students_without_primary():
    primary = SupervisorAppointment.objects.filter(student_id=OuterRef('pk'), status='ACTIVE')
    pending = SupervisorApplication.objects.filter(student_id=OuterRef('pk'), status__in=browse.PENDING_PRIMARY).order_by('-submitted_at', '-pk')
    return eligible_students().annotate(hasPrimary=Exists(primary)).filter(hasPrimary=False).annotate(
        applicationId=Subquery(pending.values('pk')[:1]), pendingStatus=Subquery(pending.values('status')[:1]),
        reason=Case(When(applicationId__isnull=True, then=Value('none')), default=Value('in_progress'), output_field=CharField()))


def students_page(opts):
    rows = students_without_primary()
    facets = {'programmes': list(rows.order_by().exclude(programme='').values_list('programme', flat=True).distinct().order_by('programme')),
              'semesters': list(rows.order_by().exclude(intake_semester='').values_list('intake_semester', flat=True).distinct().order_by('intake_semester')),
              'statuses': ['none', 'in_progress']}
    if opts['q']:
        rows = rows.filter(Q(user__full_name__icontains=opts['q']) | Q(matric_no__icontains=opts['q']))
    if opts['programme']:
        rows = rows.filter(programme__trim__iexact=opts['programme'])
    if opts['semester']:
        rows = rows.filter(intake_semester=opts['semester'])
    if opts['status']:
        rows = rows.filter(reason=opts['status'])
    semester = current_effective_semester()
    stages = None
    if opts['projectStage']:
        rows, stages = filter_attention_stages(rows, semester, 'pk', opts['projectStage'])
    rows = rows.annotate(studentName=F('user__full_name'), matricNo=F('matric_no'), semester=F('intake_semester'), rowId=F('pk'))
    order = ('user__full_name', 'matric_no', 'pk')
    if opts['sort'] == 'no_request':
        rows = rows.annotate(pendingOrder=Case(When(applicationId__isnull=True, then=Value(0)), default=Value(1), output_field=IntegerField()))
        order = ('pendingOrder', *order)
    rows = rows.order_by(*order).values('rowId', 'matricNo', 'studentName', 'programme', 'semester', 'applicationId', 'pendingStatus', 'reason')
    def compact(row):
        row['id'] = row.pop('rowId')
        return row
    data = browse.envelope(rows, opts, facets, serializer=compact)
    return stage_coverage_page(data, semester, stages)


def waiting_bases():
    eligible = eligible_students().values('pk')
    return (SupervisorApplication.objects.filter(student_id__in=eligible, status__in=browse.PENDING_PRIMARY),
            CoSupervisorNomination.objects.filter(student_id__in=eligible, status__in=CoSupervisorNomination.PENDING_STATUSES),
            ResearchAmendment.objects.filter(student_id__in=eligible, status__in=ResearchAmendment.PENDING_STATUSES))


def waiting_annotations(rows, kind):
    if kind in ('primary', 'supporting'):
        primary = kind == 'primary'
        event_field = 'supervisor_application_id' if primary else 'co_supervisor_nomination_id'
        transition = AppointmentWorkflowEvent.objects.filter(**{event_field: OuterRef('pk')}, new_status=OuterRef('status')).exclude(
            previous_status=F('new_status')).order_by('-created_at', '-pk').values('created_at')[:1]
        decision = 'supervisor_decided_at' if primary else 'candidate_decided_at'
        stage = Case(When(status='PENDING_COORDINATOR', then=Coalesce(decision, Subquery(transition), 'updated_at')),
                     default=F('submitted_at'), output_field=DateTimeField())
        reviewer = Case(When(status='PENDING_COORDINATOR', then=Value('Programme Coordinator')),
                        default=Value('Supervisor' if primary else 'Supporting lecturer'), output_field=CharField())
        return rows.annotate(effectiveStatus=F('status'), waitingAt=stage, waitingOn=reviewer,
            candidateName=F('proposed_supervisor__full_name' if primary else 'candidate__full_name'),
            semesterLabel=browse.semester_label('academic_semester__label'), submittedAt=F('submitted_at'))
    transition = ResearchAmendmentEvent.objects.filter(request_id=OuterRef('pk'), new_status=OuterRef('status')).exclude(
        previous_status=F('new_status')).order_by('-created_at', '-pk').values('created_at')[:1]
    return rows.annotate(
        effectiveStatus=Case(When(kind='RESEARCH', status='PENDING_COORDINATOR', then=Value('PENDING_SUPERVISOR')),
                             default=F('status'), output_field=CharField()),
        waitingAt=Coalesce(Subquery(transition), 'created_at'), submittedAt=F('created_at'),
        semesterLabel=Coalesce(browse.semester_label('academic_semester__label'), KeyTextTransform('label', 'semester_snapshot'),
                               F('profile__semester'), output_field=CharField()),
        candidateName=Coalesce(KeyTextTransform('name', 'team_snapshot__primary'), F('profile__supervisor__full_name'),
                               Value(''), output_field=CharField()),
    ).annotate(waitingOn=Case(
        When(effectiveStatus='PENDING_SUPERVISOR', then=Value('Supervisor')),
        When(effectiveStatus='PENDING_SOURCE_COORDINATOR', then=Value('Source Programme Coordinator')),
        When(effectiveStatus='PENDING_DESTINATION_COORDINATOR', then=Value('Destination Programme Coordinator')),
        default=Value('Programme Coordinator'), output_field=CharField()))


def waiting_page(opts):
    primary, supporting, amendments = waiting_bases()
    bases = [(kind, waiting_annotations(rows, kind)) for kind, rows in (
        ('primary', primary), ('supporting', supporting), ('research', amendments.filter(kind='RESEARCH')),
        ('transfer', amendments.filter(kind='TRANSFER')))]
    facets = {'programmes': set(), 'semesters': set(), 'statuses': set()}
    sources = []
    for kind, rows in bases:
        if opts['type'] not in ('all', kind):
            continue
        for key, field in (('programmes', 'student__programme'), ('semesters', 'semesterLabel'), ('statuses', 'effectiveStatus')):
            facets[key].update(filter(None, rows.order_by().values_list(field, flat=True).distinct()))
        if opts['q']:
            rows = rows.filter(Q(student__user__full_name__icontains=opts['q']) | Q(student__matric_no__icontains=opts['q']))
        if opts['programme']:
            rows = rows.filter(student__programme__trim__iexact=opts['programme'])
        if opts['semester']:
            rows = rows.filter(semesterLabel=opts['semester'])
        if opts['status']:
            rows = rows.filter(effectiveStatus=opts['status'])
        for key, lookup in (('from', 'gte'), ('to', 'lte')):
            if opts[key]:
                rows = rows.filter(**{f'submittedAt__date__{lookup}': opts[key]})
        sources.append(rows.order_by().values('pk', 'candidateName', 'effectiveStatus', 'submittedAt', 'waitingAt', 'waitingOn').annotate(
            rowId=F('pk'), kind=Value(kind, output_field=CharField()),
            studentId=F('student_id'), studentName=F('student__user__full_name'), matricNo=F('student__matric_no'),
            programme=F('student__programme'), sortAt=F('waitingAt' if opts['sort'] == 'waiting' else 'submittedAt')).values(
                'rowId', 'kind', 'studentId', 'studentName', 'matricNo', 'programme', 'candidateName',
                'effectiveStatus', 'submittedAt', 'waitingAt', 'waitingOn', 'sortAt'))
    def compact(row):
        row.pop('sortAt')
        row['id'] = row.pop('rowId')
        row['key'] = f"{row['kind']}-{row['id']}"
        row['status'] = row.pop('effectiveStatus')
        row['waitingDays'] = elapsed_calendar_days(row.pop('waitingAt'))
        return row
    return browse.envelope(browse.union_order(sources, opts), opts, {key: sorted(values) for key, values in facets.items()}, serializer=compact)


def workload_rows(semester):
    """Load the authoritative resolver's policy inputs without supervisee lists."""
    rows = Lecturer.objects.filter(user__is_active=True, lifecycle_status=Lecturer.Lifecycle.ACTIVE, supervisor__isnull=False)
    def load(model):
        return Subquery(model.objects.filter(supervisor_id=OuterRef('pk'), status='ACTIVE').order_by().values('supervisor_id').annotate(
            total=Count('pk')).values('total')[:1])
    rows = rows.annotate(primaryLoad=Coalesce(load(SupervisorAppointment), 0),
                         supportingLoad=Coalesce(load(CoSupervisorAppointment), 0)).annotate(currentStudents=F('primaryLoad') + F('supportingLoad'))
    def requests(status):
        return Coalesce(Subquery(SupervisorApplication.objects.filter(proposed_supervisor_id=OuterRef('pk'), status=status)
            .order_by().values('proposed_supervisor_id').annotate(total=Count('pk')).values('total')[:1]), 0)
    rows = rows.annotate(reservedLoad=requests('PENDING_COORDINATOR'), pendingRequests=requests('SUBMITTED_TO_SUPERVISOR')).annotate(
        workloadCount=F('currentStudents') + F('reservedLoad'))
    plan = SemesterCapacityPlan.objects.filter(academic_semester=semester, lifecycle_status='PUBLISHED').only('pk', 'version').first() if semester else None
    limit = Subquery(LecturerCapacityEntry.objects.filter(plan=plan, lecturer_id=OuterRef('pk')).values('supervisor_limit')[:1]) if plan else Value(None, output_field=IntegerField())
    today = timezone.localdate()
    window = Subquery(LecturerAvailabilityWindow.objects.filter(academic_semester=semester, lecturer_id=OuterRef('pk'),
        role=CapacityRole.SUPERVISOR, cancelled_at__isnull=True, starts_on__lte=today, ends_on__gte=today).order_by('-ends_on', '-pk').values('ends_on')[:1]) if semester else Value(None, output_field=DateField())
    rows = rows.annotate(workloadLimit=limit, unavailableUntil=window).annotate(reason=Case(
        When(workloadLimit__isnull=True, then=Value('not_configured')),
        When(workloadCount__gt=F('workloadLimit'), then=Value('over_capacity')),
        When(workloadCount=F('workloadLimit'), then=Value('full')),
        When(Q(workloadCount__gte=1) & Q(workloadCount__gte=F('workloadLimit') - 1), then=Value('near_limit')),
        default=Value(''), output_field=CharField()))
    return rows, plan


def workload_page(opts):
    semester = current_effective_semester()
    rows, plan = workload_rows(semester)
    rows = rows.exclude(reason='')
    facets = {'programmes': [], 'semesters': [], 'statuses': list(REASONS)}
    if opts['q']:
        rows = rows.filter(Q(user__full_name__icontains=opts['q']) | Q(staff_no__icontains=opts['q']) | Q(department__icontains=opts['q']))
    if opts['status']:
        rows = rows.filter(reason=opts['status'])
    ordering = ('user__full_name', 'pk') if opts['sort'] == 'name' else ('-workloadCount', 'user__full_name', 'pk')
    rows = rows.order_by(*ordering).annotate(rowId=F('pk'), lecturerId=F('staff_no'), lecturerName=F('user__full_name')).values(
        'rowId', 'lecturerId', 'lecturerName', 'department', 'currentStudents', 'reservedLoad', 'pendingRequests', 'workloadCount', 'workloadLimit', 'reason', 'unavailableUntil')
    def compact(row):
        resolution = derive_capacity_resolution(semester_id=semester.pk if semester else None,
            plan_id=plan.pk if plan else None, plan_version=plan.version if plan else None, role=CapacityRole.SUPERVISOR,
            limit=row['workloadLimit'], active_load=row['currentStudents'], reserved_load=row['reservedLoad'], eligible=True,
            unavailable_until=row.pop('unavailableUntil'))
        row['id'] = row.pop('rowId')
        row['capacityState'] = resolution.state
        row['activeLoad'] = resolution.active_load
        row['availableSlots'] = resolution.available_slots
        return row
    return browse.envelope(rows, opts, facets, serializer=compact)


def attention_page(params):
    category, opts = options(params)
    return {'students': students_page, 'waiting': waiting_page, 'workload': workload_page}[category](opts)


def attention_summary():
    semester = current_effective_semester()
    workloads, _ = workload_rows(semester)
    missing = students_without_primary()
    rp1, _ = filter_attention_stages(missing, semester, 'pk', 'P1')
    return {'withoutSupervisor': missing.count(),
            'withoutSupervisorRp1': rp1.count() if semester else None,
            'waitingRequests': sum(rows.count() for rows in waiting_bases()),
            'workloadConcerns': workloads.exclude(reason='').count(),
            'capacitySemester': {'id': semester.pk, 'label': semester.label} if semester else None}
