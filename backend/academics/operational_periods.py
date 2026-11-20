"""Validated appointment-period commands and intake resolution.

All mutations and locked intake creation serialize on the owning semester row.
Existing request review services deliberately do not call these intake guards.
"""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from accounts.models import Student, User
from accounts.eligibility import user_is_assignable_lecturer
from .models import AcademicSemester, OperationalPeriod, OperationalEnforcement, OperationalException, OperationalPeriodAudit
from .operational_period_models import programme_identity


class OperationalConflict(APIException):
    status_code = 409
    default_code = 'operational_period_conflict'


def _iso(value):
    return value.isoformat() if value else None


def period_payload(period, *, history=False):
    result = dict(id=period.pk, semesterId=period.academic_semester_id, activity=period.activity,
                  name=period.name, programmeScope=period.programme_scope, programmes=period.programmes,
                  opensAt=_iso(period.opens_at), closesAt=_iso(period.closes_at), lifecycleStatus=period.lifecycle_status,
                  effectiveStatus=period.effective_status, revision=period.revision)
    if history:
        result['history'] = [audit_payload(a) for a in period.audits.select_related('actor')]
    return result


def audit_payload(audit):
    return dict(id=audit.pk, action=audit.action, reason=audit.reason, actorName=audit.actor.full_name,
                createdAt=_iso(audit.created_at), before=audit.before_values, after=audit.after_values)


def _audit(period, actor, action, reason='', before=None, exception=None, after=None):
    return OperationalPeriodAudit.objects.create(academic_semester=period.academic_semester, period=period,
        exception=exception, actor=actor, activity=period.activity, action=action, reason=reason,
        before_values=before or {}, after_values=after if after is not None else period_payload(period))


def require_office(actor):
    from rest_framework.exceptions import PermissionDenied
    if not actor or not actor.is_active or actor.role != User.Role.OFFICE_ADMIN:
        raise PermissionDenied('Only Office Staff/Admin can manage operational periods.')


def _semester_lock(semester):
    return AcademicSemester.objects.select_for_update().get(pk=semester.pk)


def _editable_semester(semester):
    if semester.lifecycle_status in ('CLOSED', 'ARCHIVED'):
        raise ValidationError('Closed or archived semesters cannot accept appointment-period changes.')


def _revision(period, expected):
    if expected is not None and expected != period.revision:
        raise OperationalConflict('This period changed. Reload and retry.')


def _reason(reason):
    if not str(reason or '').strip():
        raise ValidationError({'reason': 'A reason is required.'})
    return reason.strip()


def applies(period, student):
    return period.programme_scope == 'ALL' or programme_identity(student.programme) in {programme_identity(value) for value in period.programmes}


def _validate_scope(period):
    from accounts.programmes import APPROVED_PROGRAMMES
    names = list(APPROVED_PROGRAMMES) + list(Student.objects.exclude(programme='').values_list('programme', flat=True))
    known = {programme_identity(value) for value in names}
    if any(programme_identity(value) not in known for value in period.programmes):
        raise ValidationError({'programmes': 'Select recognised student programmes.'})


def _validate_publication(period):
    # Disjoint programme cohorts may use the same instant; intersecting cohorts may not.
    others = OperationalPeriod.objects.filter(academic_semester=period.academic_semester,
        activity=period.activity, lifecycle_status='PUBLISHED', opens_at__lte=period.closes_at,
        closes_at__gte=period.opens_at).exclude(pk=period.pk)
    for other in others:
        if period.programme_scope == 'ALL' or other.programme_scope == 'ALL' or {programme_identity(value) for value in period.programmes} & {programme_identity(value) for value in other.programmes}:
            raise ValidationError('Published periods overlap for the same activity and programme scope.')


@transaction.atomic
def create_period(*, actor, semester, values, timeline_entry_id=None):
    require_office(actor)
    semester = _semester_lock(semester)
    _editable_semester(semester)
    entry = None
    if timeline_entry_id is not None:
        from dashboard.models import SemesterTimelineEntry
        entry = SemesterTimelineEntry.objects.select_related('timeline').select_for_update(of=('self',)).filter(
            pk=timeline_entry_id, timeline__academic_semester=semester, timeline__is_active=True).first()
        if entry is None:
            raise OperationalConflict('The selected event is no longer available in this semester timeline. Reload calendar events and choose again.')
        if entry.operational_period_id or entry.marks_period_id:
            raise OperationalConflict('The selected event is already linked to a period. Reload calendar events and choose another event.')
    period = OperationalPeriod(academic_semester=semester, created_by=actor, **values)
    period.full_clean()
    _validate_scope(period)
    period.save()
    created = period_payload(period)
    if entry is not None:
        created['timelineEntryId'] = entry.pk
    _audit(period, actor, 'CREATE', after=created)
    if entry is not None:
        from zoneinfo import ZoneInfo
        from dashboard.models import TimelineAuditLog
        before = dict(operationalPeriodId=None, marksPeriodId=None,
                      deadlineStart=entry.deadline_start.isoformat(), deadlineEnd=entry.deadline_end.isoformat())
        entry.operational_period = period
        entry.deadline_start = timezone.localdate(period.opens_at, timezone=ZoneInfo('Asia/Kuala_Lumpur'))
        entry.deadline_end = timezone.localdate(period.closes_at, timezone=ZoneInfo('Asia/Kuala_Lumpur'))
        entry.status = entry.Status.UPCOMING
        entry.full_clean()
        entry.save(update_fields=['operational_period', 'deadline_start', 'deadline_end', 'status', 'updated_at'])
        TimelineAuditLog.objects.create(actor=actor, timeline=entry.timeline, entry=entry,
            action=TimelineAuditLog.Action.EDIT_ENTRY,
            summary=f'Linked {entry.level} event to submission window {period.pk}: {entry.title[:200]}',
            before_values=before, after_values=dict(operationalPeriodId=period.pk, marksPeriodId=None,
                deadlineStart=entry.deadline_start.isoformat(), deadlineEnd=entry.deadline_end.isoformat()))
    return period


@transaction.atomic
def mutate_period(*, actor, period, action, values=None, reason='', expected_revision=None):
    require_office(actor)
    semester = _semester_lock(period.academic_semester)
    _editable_semester(semester)
    period = OperationalPeriod.objects.select_for_update().get(pk=period.pk)
    _revision(period, expected_revision)
    before = period_payload(period)
    values = values or {}
    if period.lifecycle_status == 'ARCHIVED':
        raise ValidationError('Archived periods cannot be changed.')
    if action == 'UPDATE':
        if period.lifecycle_status != 'DRAFT':
            raise ValidationError('Only draft periods can be edited. Use Extend deadline for published dates.')
        for key, value in values.items():
            setattr(period, key, value)
    elif action == 'PUBLISH':
        if period.lifecycle_status != 'DRAFT':
            raise ValidationError('Only draft periods can be published.')
        period.lifecycle_status = 'PUBLISHED'
    elif action == 'EXTEND':
        reason = _reason(reason)
        if expected_revision is None:
            raise ValidationError({'expectedRevision': 'Current revision is required to extend a period.'})
        if period.lifecycle_status != 'PUBLISHED':
            raise ValidationError('Only published periods can be extended.')
        deadline = values['closes_at']
        if deadline <= period.closes_at or deadline <= timezone.now():
            raise ValidationError({'closesAt': 'The new deadline must be in the future and extend the current deadline.'})
        period.closes_at = deadline
    elif action == 'CLOSE':
        reason = _reason(reason)
        if period.lifecycle_status != 'PUBLISHED':
            raise ValidationError('Only published periods can be closed.')
        period.lifecycle_status = 'CLOSED'
    elif action == 'ARCHIVE':
        reason = _reason(reason)
        if period.lifecycle_status not in ('DRAFT', 'CLOSED'):
            raise ValidationError('Close the period before archiving it.')
        period.lifecycle_status = 'ARCHIVED'
    else:
        raise ValidationError('Unsupported period action.')
    period.full_clean()
    _validate_scope(period)
    if period.lifecycle_status == 'PUBLISHED':
        _validate_publication(period)
    period.revision += 1
    period.save()
    _audit(period, actor, action, reason, before)
    return period


@transaction.atomic
def set_enforcement(*, actor, semester, activity, enabled, reason):
    require_office(actor)
    reason = _reason(reason)
    semester = _semester_lock(semester)
    _editable_semester(semester)
    if enabled and not OperationalPeriod.objects.filter(academic_semester=semester,activity=activity,lifecycle_status='PUBLISHED').exists():
        raise ValidationError('Publish at least one period for this activity before enabling enforcement.')
    row = OperationalEnforcement.objects.filter(academic_semester=semester, activity=activity).first()
    before = {'enabled': row.enabled if row else False}
    row, _ = OperationalEnforcement.objects.update_or_create(academic_semester=semester, activity=activity,
        defaults={'enabled':enabled,'updated_by':actor})
    OperationalPeriodAudit.objects.create(academic_semester=semester, actor=actor,activity=activity,
        action='ENFORCEMENT',reason=reason,before_values=before,after_values={'enabled':enabled})
    return row


def enforcement_payload(semester):
    result = {activity:False for activity in OperationalPeriod.Activity.values}
    result.update(dict(OperationalEnforcement.objects.filter(academic_semester=semester).values_list('activity','enabled')))
    return result


def eligible_participant(*, activity, student, participant):
    from appointments.models import StudentResearchProfile, SupervisorAppointment, ResearchAmendment
    if not student or student.status != Student.Status.ACTIVE or not student.user.is_active or student.user.role != User.Role.STUDENT:
        return False
    if ResearchAmendment.objects.filter(student=student,kind='TRANSFER',status__in=ResearchAmendment.PENDING_STATUSES).exists():
        return False
    if activity == OperationalPeriod.Activity.SUPERVISOR_APPLICATION:
        return participant.pk == student.pk
    if activity == OperationalPeriod.Activity.PANEL_RECOMMENDATION:
        return bool(user_is_assignable_lecturer(participant)
            and StudentResearchProfile.objects.filter(student_id=student.pk, supervisor=participant).exists()
            and SupervisorAppointment.objects.filter(student=student,supervisor=participant,status='ACTIVE').exists())
    return False


def exception_payload(exception, *, history=True):
    eligible = False
    student = Student.objects.select_related('user').filter(pk=exception.student_id).first()
    if student and applies(exception.period,student):
        eligible = eligible_participant(activity=exception.period.activity,student=student,participant=exception.participant)
    superseded = OperationalException.objects.filter(period=exception.period,student_id=exception.student_id,
        participant_id=exception.participant_id,pk__gt=exception.pk).exists()
    status = 'REVOKED' if exception.revoked_at else ('SUPERSEDED' if superseded else ('EXPIRED' if timezone.now() > exception.deadline else 'ACTIVE'))
    if status == 'ACTIVE' and (not eligible or exception.period.lifecycle_status != 'PUBLISHED' or not exception.period.academic_semester.is_active):
        status = 'INELIGIBLE'
    result = dict(id=exception.pk, periodId=exception.period_id, studentId=exception.student_id,
        studentName=exception.student.full_name, matricNo=student.matric_no if student else '',
        programme=student.programme if student else '', grantedBy={'id':exception.created_by_id,'name':exception.created_by.full_name}, participantId=exception.participant_id,
        participantName=exception.participant.full_name, deadline=_iso(exception.deadline),reason=exception.reason,
        status=status, createdAt=_iso(exception.created_at), revokedAt=_iso(exception.revoked_at),
        revocationReason=exception.revocation_reason, revision=exception.revision, canRevoke=exception.revoked_at is None and not superseded)
    if history:
        result['history'] = [audit_payload(a) for a in exception.audits.select_related('actor')]
    return result


@transaction.atomic
def grant_exception(*, actor, period, student, participant, deadline, reason, expected_revision=None):
    require_office(actor)
    reason = _reason(reason)
    semester = _semester_lock(period.academic_semester)
    _editable_semester(semester)
    period = OperationalPeriod.objects.select_for_update().get(pk=period.pk)
    _revision(period,expected_revision)
    student = Student.objects.select_for_update().select_related('user').get(pk=student.pk)
    participant = User.objects.get(pk=participant.pk)
    if not semester.is_active:
        raise ValidationError('Appointment extra time requires an effective active semester.')
    if period.lifecycle_status != 'PUBLISHED':
        raise ValidationError('Extra time requires a published period.')
    if not applies(period,student) or not eligible_participant(activity=period.activity,student=student,participant=participant):
        raise ValidationError('The student and participant are no longer eligible for this activity and scope.')
    if deadline <= period.closes_at or deadline <= timezone.now():
        raise ValidationError({'deadline':'Extra time must be in the future and extend the standard deadline.'})
    if timezone.localtime(deadline).date() > semester.ends_on:
        raise ValidationError({'deadline':'The deadline must fall within the semester.'})
    previous = OperationalException.objects.filter(period=period,student=student.user,participant=participant,revoked_at__isnull=True).order_by('-deadline').first()
    if previous and deadline <= previous.deadline:
        raise ValidationError({'deadline':'Renewal must extend the previous personal deadline.'})
    previous_facts = exception_payload(previous,history=False) if previous else {}
    exception = OperationalException.objects.create(period=period,student=student.user,participant=participant,
        deadline=deadline,reason=reason,created_by=actor)
    _audit(period,actor,'RENEW' if previous else 'GRANT',reason,
        before=previous_facts,exception=exception,after=exception_payload(exception,history=False))
    return exception


@transaction.atomic
def revoke_exception(*, actor, exception, reason, expected_revision=None):
    require_office(actor)
    reason = _reason(reason)
    _semester_lock(exception.period.academic_semester)
    exception = OperationalException.objects.select_for_update().get(pk=exception.pk)
    if expected_revision is not None and expected_revision != exception.revision:
        raise OperationalConflict('This extra-time record changed. Reload and retry.')
    if exception.revoked_at:
        raise ValidationError('This extra-time grant was already revoked.')
    before = exception_payload(exception,history=False)
    exception.revoked_at = timezone.now()
    exception.revoked_by = actor
    exception.revocation_reason = reason
    exception.revision += 1
    exception.save()
    # Revoking a renewal must not revive an earlier grant.
    earlier = OperationalException.objects.filter(period=exception.period,student=exception.student,
        participant=exception.participant,revoked_at__isnull=True,created_at__lte=exception.created_at).exclude(pk=exception.pk)
    for old in earlier:
        old.revoked_at = exception.revoked_at
        old.revoked_by = actor
        old.revocation_reason = reason
        old.revision += 1
        old.save()
        _audit(old.period,actor,'REVOKE',reason,exception=old,after=exception_payload(old,history=False))
    _audit(exception.period,actor,'REVOKE',reason,before,exception=exception,after=exception_payload(exception,history=False))
    return exception


def resolve_availability(*, semester, activity, student, participant, now=None):
    now = now or timezone.now()
    result = dict(enforcementEnabled=False,canSubmit=False,status='UNAVAILABLE',opensAt=None,closesAt=None,effectiveDueAt=None,
                  message='No active academic semester is accepting submissions.')
    if semester is None or not semester.is_active:
        return result
    enabled = OperationalEnforcement.objects.filter(academic_semester=semester,activity=activity,enabled=True).exists()
    result['enforcementEnabled'] = enabled
    if not enabled:
        # Existing serializer eligibility remains authoritative until Office opts in.
        result.update(canSubmit=True,status='UNRESTRICTED',message='Submissions are available during the current semester.')
        return result
    if not eligible_participant(activity=activity,student=student,participant=participant):
        result.update(status='INELIGIBLE',message='This student and participant are not eligible for new submissions.')
        return result
    periods = [p for p in OperationalPeriod.objects.filter(academic_semester=semester,activity=activity,lifecycle_status='PUBLISHED') if applies(p,student)]
    # Disjoint windows for the same scope are allowed. Personal extra time is resolved
    # against its owning window; multiple matching windows at an instant fail closed.
    opened = [p for p in periods if p.opens_at <= now <= p.closes_at]
    extras = []
    for period in periods:
        grants = OperationalException.objects.filter(period=period,student_id=student.pk,participant=participant,revoked_at__isnull=True,deadline__gte=now).order_by('-deadline')
        grant = grants.first()
        if grant and period.opens_at <= now:
            extras.append((period,grant))
    matching = {p.pk:p for p in opened}
    matching.update({p.pk:p for p,_ in extras})
    if len(matching) > 1:
        result.update(status='AMBIGUOUS',message='Multiple intake periods apply. Contact the Office.')
        return result
    if matching:
        period = next(iter(matching.values()))
        deadline = max([period.closes_at]+[g.deadline for p,g in extras if p.pk==period.pk])
        result.update(canSubmit=True,status='OPEN',opensAt=_iso(period.opens_at),closesAt=_iso(period.closes_at),effectiveDueAt=_iso(deadline),message='Submissions are open.')
        return result
    if not periods:
        result.update(status='MISSING',message='No published intake period applies. Contact the Office.')
        return result
    future = sorted([p for p in periods if p.opens_at > now],key=lambda p:p.opens_at)
    period = future[0] if future else max(periods,key=lambda p:p.closes_at)
    result.update(status='UPCOMING' if future else 'ENDED', opensAt=_iso(period.opens_at), closesAt=_iso(period.closes_at), effectiveDueAt=_iso(period.closes_at),
        message='Submissions have not opened yet.' if future else 'The submission deadline has passed.')
    return result


def assert_intake_allowed(*, semester, activity, student, participant, lock=False):
    if lock:
        semester = _semester_lock(semester)
        if student is not None:
            student = Student.objects.select_for_update().get(pk=student.pk)
        participant = User.objects.get(pk=participant.pk)
    availability = resolve_availability(semester=semester,activity=activity,student=student,participant=participant)
    if not availability['canSubmit']:
        raise OperationalConflict(availability['message'])
    return availability
