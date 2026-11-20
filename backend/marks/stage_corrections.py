"""Marks-owned impact/apply contract for semester registration changes.

Registry holds Student before calling apply; task writers take the same Student
lock before task locks. No period locks are acquired after Student here.
"""
import json

from django.db import connection
from django.utils import timezone
from django.utils.crypto import salted_hmac

from accounts.project_stages import NOT_STUDYING, project_stages
from .models import EvaluationTask, EvaluationTaskLifecycleAudit, MarkEntry
from .write_versions import entry_version

REVIEW_ACTION = 'STAGE_REVIEW'


def stage_review_pending(task):
    """Only an explicit lifecycle resolution clears a registration review hold."""
    events = task.lifecycle_audits.all()
    review = next((event for event in events if event.action == REVIEW_ACTION), None)
    return bool(review and not any(event.pk > review.pk and event.action in ('RESUMED', 'STAGE_RESOLVED') for event in events))


def stage_review_resolution(task):
    """Offer only existing eligible recovery; submitted academic decisions stay manual."""
    from accounts.eligibility import profile_student_is_workflow_eligible
    from .services import _task_appointment_is_active, _task_is_submitted
    from .stage_eligibility import profile_stage_eligibility
    from .targeting import profile_in_scope
    if (_task_is_submitted(task) or not task.period.accepts_submissions
            or not profile_student_is_workflow_eligible(task.profile)
            or not profile_stage_eligibility(task.period, task.profile).eligible
            or not profile_in_scope(task.period, task.profile, task.evaluator_role)):
        return None
    if task.lifecycle_status == 'PAUSED' and not _task_appointment_is_active(task):
        return 'RETIRE_MARKS_TASK'
    return {'PAUSED': 'RESUME_MARKS_TASK', 'RETIRED': 'RELEASE_STAGE_REVIEW'}.get(task.lifecycle_status)


def assignment_stage_review_pending(period, profile, role=None):
    tasks = EvaluationTask.objects.filter(period=period, profile=profile,
        lifecycle_audits__action=REVIEW_ACTION).distinct().prefetch_related('lifecycle_audits')
    if role:
        tasks = tasks.filter(evaluator_role=role)
    return any(stage_review_pending(task) for task in tasks)


def stage_tasks(student, academic_semester, *, lock=False):
    tasks = EvaluationTask.objects.filter(profile__student_id=student.pk,
        period__academic_semester=academic_semester).order_by('pk')
    if lock:
        tasks = tasks.select_for_update(of=('self',))
    return list(tasks.select_related('period__academic_semester', 'mark_entry').prefetch_related(
        'mark_entry__scores', 'completion_windows', 'lifecycle_audits'))


def preview_stage_change(student, academic_semester, proposed_stage, *, tasks=None):
    """Version 1: serialisable impact, with an opaque token over all task evidence."""
    answer = project_stages(academic_semester, [student.pk])[student.pk]
    return _preview_stage_change(student, academic_semester, proposed_stage,
        tasks=stage_tasks(student, academic_semester) if tasks is None else tasks,
        stage_context={'lookupState': answer.state, 'lookupReason': answer.reason,
            'recordId': answer.record_id, 'revision': answer.revision})


def _preview_stage_change(student, academic_semester, proposed_stage, *, tasks, stage_context):
    """Shared task evidence; callers supply their own registration contract context."""
    counts = {'notStarted': 0, 'draft': 0, 'submitted': 0, 'paused': 0, 'retired': 0, 'legacy': 0}
    affected, evidence = [], []
    for task in tasks:
        entry = getattr(task, 'mark_entry', None)
        state = entry.status if entry else MarkEntry.Status.NOT_STARTED
        legacy = task.period.assessment not in ('P1', 'P2')
        ineligible = stage_context.get('lookupState') == NOT_STUDYING or proposed_stage != task.period.assessment or proposed_stage not in ('P1', 'P2')
        evidence.append({
            'taskId': task.pk, 'periodId': task.period_id, 'assessment': task.period.assessment,
            'lifecycle': task.lifecycle_status, 'pauseReason': task.pause_reason,
            'retirementReason': task.retirement_reason, 'evaluatorId': task.evaluator_id,
            'role': task.evaluator_role, 'entryVersion': entry_version(task, entry),
            'windows': sorted((w.pk, w.deadline.isoformat(), str(w.ended_at), w.end_kind) for w in task.completion_windows.all()),
            'reviewPending': stage_review_pending(task),
        })
        if not legacy and not ineligible:
            continue
        if legacy:
            action = 'REVIEW_LEGACY'
            counts['legacy'] += 1
            # The coordinator's preview must include every task we will touch.
            counts[{'SUBMITTED': 'submitted', 'DRAFT': 'draft'}.get(state, 'notStarted')] += 1
        elif state == 'SUBMITTED':
            action = 'REVIEW_SUBMITTED'
            counts['submitted'] += 1
        elif task.lifecycle_status == 'RETIRED':
            action = 'PRESERVE_HISTORY'
            counts['retired'] += 1
        elif task.lifecycle_status == 'PAUSED':
            action = 'PRESERVE_PAUSE'
            counts['paused'] += 1
            counts['draft' if state == 'DRAFT' else 'notStarted'] += 1
        elif state == 'DRAFT':
            action = 'PAUSE'
            counts['draft'] += 1
        else:
            action = 'RETIRE'
            counts['notStarted'] += 1
        affected.append({'taskId': task.pk, 'periodId': task.period_id, 'periodName': task.period.name,
            'assessment': task.period.assessment, 'evaluatorRole': task.evaluator_role,
            'lifecycleStatus': task.lifecycle_status, 'entryStatus': state, 'action': action})
    context = {'studentId': student.pk, 'semesterId': academic_semester.pk,
        'proposedStage': proposed_stage, **stage_context, 'evidence': evidence}
    fingerprint = salted_hmac('marks.stage-correction.v1', json.dumps(context, sort_keys=True), algorithm='sha256').hexdigest()
    periods = {}
    for row in affected:
        group = periods.setdefault(row['periodId'], {'periodId': row['periodId'],
            'periodName': row['periodName'], 'taskIds': [], 'states': {}, 'actions': {}})
        group['taskIds'].append(row['taskId'])
        for key, value in (('states', row['entryStatus']), ('actions', row['action'])):
            group[key][value] = group[key].get(value, 0) + 1
    return {'version': 1, **counts, 'requiresReview': bool(affected), 'tasks': affected,
        'periods': list(periods.values()), 'fingerprint': fingerprint}


def apply_stage_change(*, student, academic_semester, actor, reason, impact, tasks, revision):
    """Run inside Registry's transaction after its locked impact revalidation."""
    if not connection.in_atomic_block:
        raise RuntimeError('Registration and Marks changes require one transaction.')
    from .completion_windows import invalidate_task_windows
    from .services import _task_entry_snapshot

    by_id = {task.pk: task for task in tasks}
    outcomes = []
    for row in impact['tasks']:
        task = by_id[row['taskId']]
        action = row['action']
        if action == 'PRESERVE_HISTORY':
            continue
        snapshot = _task_entry_snapshot(task)
        snapshot['stageCorrection'] = {'semesterId': academic_semester.pk, 'studentId': student.pk,
            'registrationRevision': revision, 'impactFingerprint': impact['fingerprint'], 'action': action}
        if action == 'RETIRE':
            task.lifecycle_status = 'RETIRED'
            task.retired_at, task.retired_by, task.retirement_reason = timezone.now(), actor, reason
            task.save(update_fields=['lifecycle_status', 'retired_at', 'retired_by', 'retirement_reason'])
        elif action == 'PAUSE':
            task.lifecycle_status = 'PAUSED'
            task.paused_at, task.paused_by, task.pause_reason = timezone.now(), actor, reason
            task.save(update_fields=['lifecycle_status', 'paused_at', 'paused_by', 'pause_reason'])
        # Submitted evidence, including its due/window snapshot, stays immutable.
        if row['entryStatus'] != 'SUBMITTED':
            invalidate_task_windows(task, actor, reason)
        if action in ('RETIRE', 'PAUSE'):
            EvaluationTaskLifecycleAudit.objects.create(task=task, actor=actor,
                action='RETIRED' if action == 'RETIRE' else 'PAUSED', reason=reason, entry_snapshot=snapshot)
        EvaluationTaskLifecycleAudit.objects.create(task=task, actor=actor,
            action=REVIEW_ACTION, reason=reason, entry_snapshot=snapshot)
        outcomes.append({'taskId': task.pk, 'action': action})
    return outcomes
