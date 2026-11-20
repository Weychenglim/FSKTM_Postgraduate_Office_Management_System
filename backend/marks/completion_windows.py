"""Task-specific completion rights and audited Office operations."""
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from accounts.eligibility import profile_student_is_workflow_eligible, user_is_assignable_lecturer
from accounts.models import Student, User
from accounts.authorization import office_actor as is_office_actor
from academics.models import AcademicSemester
from .models import EvaluationPeriod, EvaluationTask, MarkEntry, TaskCompletionWindow, TaskCompletionWindowAudit
from .stage_eligibility import profile_stage_eligibility


def office_actor(actor):
    if not is_office_actor(actor):
        raise PermissionError('Only Office Staff/Admin may manage completion windows.')


def task_eligible(task, now=None):
    from .services import _task_appointment_is_active
    from .stage_corrections import stage_review_pending
    now = now or timezone.now()
    period = task.period
    return bool(task.lifecycle_status == 'ACTIVE'
        and not _submitted(task)
        and not stage_review_pending(task)
        and period.lifecycle_status in ('PUBLISHED', 'CLOSED')
        and (not period.opens_at or period.opens_at <= now)
        and period.academic_semester_id
        and period.academic_semester.lifecycle_status in ('ACTIVE', 'CLOSED')
        and profile_student_is_workflow_eligible(task.profile)
        and profile_stage_eligibility(period, task.profile).eligible
        and (not task.profile.student_id or task.profile.student.is_active)
        and user_is_assignable_lecturer(task.evaluator)
        and _task_appointment_is_active(task))


def _submitted(task):
    try:
        return task.mark_entry.status == 'SUBMITTED'
    except MarkEntry.DoesNotExist:
        return False


def _windows(task):
    cache = getattr(task, '_prefetched_objects_cache', {})
    if 'completion_windows' in cache:
        return list(cache['completion_windows'])
    return list(task.completion_windows.select_related('granted_by'))


def _current_window(task):
    return next((window for window in _windows(task) if window.ended_at is None), None)


def task_window_active(task, now=None):
    now = now or timezone.now()
    window = _current_window(task)
    if window and window.deadline > now and task_eligible(task, now):
        return window
    return None


def task_due_at(task, now=None):
    if _submitted(task):
        entry = task.mark_entry
        if entry.submitted_due_recorded:
            return entry.submitted_due_at
        return task.period.closes_at
    window = _current_window(task)
    if window:
        if task.period.lifecycle_status == 'PUBLISHED' and task.period.closes_at:
            return max(window.deadline, task.period.closes_at)
        return window.deadline
    return task.period.closes_at


def window_payload(window, now=None, *, submitted=None):
    now = now or timezone.now()
    state = window.end_kind or ('EXPIRED' if window.deadline <= now else 'ACTIVE')
    if not window.end_kind and submitted is None:
        submitted = MarkEntry.objects.filter(task_id=window.task_id, status='SUBMITTED').exists()
    if not window.end_kind and submitted:
        state = 'COMPLETED'
    return {'id':window.pk, 'taskId':window.task_id, 'deadline':window.deadline,
        'status':state, 'reason':window.reason,
        'grantedBy':{'id':window.granted_by_id,'name':window.granted_by.full_name},
        'createdAt':window.created_at, 'revokedAt':window.ended_at if window.end_kind == 'REVOKED' else None,
        'revocationReason':window.end_reason if window.end_kind == 'REVOKED' else '',
        'supersedesId':window.supersedes_id, 'canRevoke':state == 'ACTIVE'}


def task_access(task, now=None):
    from .stage_corrections import stage_review_pending
    now = now or timezone.now()
    eligible = task_eligible(task, now)
    window = task_window_active(task, now) if eligible else None
    windows = _windows(task)
    latest = windows[0] if windows else None
    normal_open = task.period.status_at(now) == 'OPEN' and task.period.academic_semester_id and task.period.academic_semester.is_active
    # Existing assigned tasks retain their normal-period access. Completion
    # exceptions require the stronger current-appointment eligibility above.
    ordinary_eligible = (
        task.lifecycle_status == 'ACTIVE' and not _submitted(task)
        and not stage_review_pending(task)
        and task.evaluator.is_active and task.evaluator.role == User.Role.LECTURER
        and profile_student_is_workflow_eligible(task.profile)
        and profile_stage_eligibility(task.period, task.profile).eligible
        and (not task.profile.student_id or task.profile.student.is_active)
    )
    allowed = bool(window) or (ordinary_eligible and normal_open)
    return {'canEdit':bool(allowed),'canSubmit':bool(allowed),
        'periodEffectiveStatus':task.period.status_at(now),
        'effectiveDueAt':task_due_at(task, now),
        'completionWindow':window_payload(latest, now) if latest else None,
        'canGrantCompletionWindow':eligible and (task.period.lifecycle_status == 'CLOSED' or task.period.closes_at is not None), 'taskLifecycleStatus':task.lifecycle_status}


def lock_tasks(task_ids):
    """Semester and period serialize closure; task serializes lifecycle and marks writes."""
    period_ids = list(EvaluationTask.objects.filter(pk__in=task_ids).values_list('period_id',flat=True))
    semester_ids = EvaluationPeriod.objects.filter(pk__in=period_ids).values_list('academic_semester_id',flat=True)
    list(AcademicSemester.objects.select_for_update().filter(pk__in=semester_ids).order_by('pk'))
    # Allow an already-running handover's replacement FK insert to finish while
    # we wait on its original task. Period writes still serialize on this lock.
    list(EvaluationPeriod.objects.select_for_update(no_key=True).filter(pk__in=period_ids).order_by('pk'))
    # Registry confirmation/correction holds Student first. Serialize eligibility
    # reads with it before locking tasks or writing marks/completion windows.
    student_ids = dict(EvaluationTask.objects.filter(pk__in=task_ids).values_list('pk', 'profile__student_id'))
    list(Student.objects.select_for_update().filter(pk__in=student_ids.values()).order_by('pk'))
    tasks = list(EvaluationTask.objects.select_for_update(of=('self',)).filter(pk__in=task_ids).select_related('period__academic_semester','profile__student','evaluator').order_by('pk'))
    if any(task.profile.student_id != student_ids.get(task.pk) for task in tasks):
        from .services import MarksStateConflict
        raise MarksStateConflict('A research profile was linked while this request was running. Reload and retry.')
    return tasks


def _end(window, actor, kind, reason):
    models.QuerySet(model=TaskCompletionWindow, using=window._state.db).filter(pk=window.pk, ended_at__isnull=True).update(ended_at=timezone.now(), ended_by=actor, end_kind=kind, end_reason=reason)
    TaskCompletionWindowAudit.objects.create(window=window, actor=actor, action=kind, reason=reason)


def invalidate_task_windows(task, actor, reason):
    for window in task.completion_windows.select_for_update().filter(ended_at__isnull=True):
        _end(window, actor, 'INVALIDATED', reason)


@transaction.atomic
def grant_completion_windows(*, task_ids, deadline, reason, actor):
    from .services import MarksStateConflict
    office_actor(actor)
    reason = reason.strip()
    if not reason or deadline <= timezone.now():
        raise ValidationError('A reason and future deadline are required.')
    tasks = lock_tasks(task_ids)
    if not tasks or len(tasks) != len(set(task_ids)):
        raise MarksStateConflict('One or more selected tasks no longer exist.')
    for task in tasks:
        if not task_eligible(task):
            raise MarksStateConflict('A selected task is no longer eligible for a completion window.')
        if task.period.lifecycle_status == 'PUBLISHED' and (not task.period.closes_at or deadline <= task_due_at(task)):
            raise ValidationError('The deadline must extend the published period deadline.')
    windows = []
    for task in tasks:
        current = task.completion_windows.select_for_update().filter(ended_at__isnull=True).first()
        if current:
            _end(current, actor, 'SUPERSEDED', reason)
        window = TaskCompletionWindow.objects.create(task=task, deadline=deadline, reason=reason, granted_by=actor, supersedes=current)
        TaskCompletionWindowAudit.objects.create(window=window, actor=actor, action='GRANTED',reason=reason)
        windows.append(window)
    return windows


@transaction.atomic
def revoke_completion_window(*, window_id, reason, actor):
    from .services import MarksStateConflict
    office_actor(actor)
    if not reason.strip():
        raise ValidationError('A revocation reason is required.')
    initial = TaskCompletionWindow.objects.get(pk=window_id)
    lock_tasks([initial.task_id])
    window = TaskCompletionWindow.objects.select_for_update().get(pk=window_id)
    if window.ended_at or window.deadline <= timezone.now() or MarkEntry.objects.filter(task_id=window.task_id,status='SUBMITTED').exists():
        raise MarksStateConflict('The completion window is no longer revocable.')
    _end(window, actor, 'REVOKED', reason.strip())
    window.refresh_from_db()
    return window
