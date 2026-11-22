"""Read committed operational facts and target only outstanding, authorised work."""
from collections import defaultdict

from django.utils import timezone

from accounts.eligibility import profile_student_is_workflow_eligible, user_is_assignable_lecturer
from accounts.models import Student, User
from academics.models import OperationalEnforcement, OperationalException, OperationalPeriod, OperationalPeriodAudit
from academics.operational_periods import applies, eligible_participant, resolve_availability
from appointments.models import PanelAppointment, PanelRecommendation, SupervisorApplication, SupervisorAppointment
from marks.completion_windows import task_access, task_due_at, task_window_active
from marks.models import EvaluationTask, MarksConfigurationAudit

from .deadline_delivery import enqueue_deadline_notice


def closing_phase(left, days):
    if left < 0 or left > days:
        return None
    return 'today' if left == 0 else 'one-day' if left == 1 else 'approaching'


def due_text(left):
    return 'today' if left == 0 else 'tomorrow' if left == 1 else f'in {left} days'


def notice(user, key, title, message, module, record_type, record_id, *, urgent=False):
    return dict(recipient=user, eventKey=key, title=title, summary=message.split('\n')[0],
                message=message, targetModule=module, recordType=record_type, recordId=record_id,
                link='/marks' if module == 'MARKS' else '/supervisor-appointments' if module == 'SUPERVISOR_APPOINTMENTS'
                else '/panel-appointments', urgent=urgent)


def marks_notices(now, days, *, recipient_id=None, period_id=None):
    """One notice per evaluator/effective deadline, including closed-period recovery."""
    today = timezone.localdate(now)
    tasks = EvaluationTask.objects.filter(lifecycle_status='ACTIVE', evaluator__is_active=True,
        evaluator__deadline_reminders=True).exclude(mark_entry__status='SUBMITTED').select_related(
            'period__academic_semester', 'profile__student__student', 'evaluator__lecturer', 'mark_entry').prefetch_related(
                'completion_windows__granted_by', 'lifecycle_audits')
    if recipient_id is not None:
        tasks = tasks.filter(evaluator_id=recipient_id)
    if period_id is not None:
        tasks = tasks.filter(period_id=period_id)
    groups = defaultdict(list)
    result = []
    for task in tasks:
        if not user_is_assignable_lecturer(task.evaluator) or not profile_student_is_workflow_eligible(task.profile):
            continue
        access = task_access(task, now)
        if not access['canSubmit']:
            continue
        due = task_due_at(task, now)
        if due is None or due < now:
            continue
        window = task_window_active(task, now)
        groups[(task.period_id, task.evaluator_id, due)].append((task, window))
    for (period_id, evaluator_id, due), rows in groups.items():
        task = rows[0][0]
        period, evaluator = task.period, task.evaluator
        left = (timezone.localdate(due) - today).days
        phase = closing_phase(left, days)
        personal = any(window for _, window in rows)
        if phase:
            message = (f"You have {len(rows)} evaluation task{'s' if len(rows) != 1 else ''} in {period.name} "
                f"not submitted yet. Your {'completion-window ' if personal else ''}deadline is "
                f"{timezone.localtime(due):%d %B %Y, %I:%M %p} (Malaysia).")
            result.append(notice(evaluator, f"deadline:marks:{period_id}:{evaluator_id}:{due.isoformat()}:{phase}",
                f"Marks due {due_text(left)}: {period.name}", message, 'MARKS', 'EVALUATION_PERIOD', period_id,
                urgent=left <= 1))
        if period.opens_at and period.opens_at <= now and period.lifecycle_status == 'PUBLISHED':
            result.append(notice(evaluator, f"opened:marks:{period_id}:{evaluator_id}:{period.opens_at.isoformat()}",
                f"Marks entry is open: {period.name}",
                f"Your outstanding evaluations in {period.name} are available. Check each task for its deadline.",
                'MARKS', 'EVALUATION_PERIOD', period_id))
        for window_task, window in rows:
            if window:
                result.append(notice(evaluator, f"extra:marks:{window.pk}", f"Extra time granted: {period.name}",
                    f"Extra time is available for your unfinished evaluation of {window_task.profile.student_name}. "
                    f"Your deadline is {timezone.localtime(due):%d %B %Y, %I:%M %p} (Malaysia).",
                    'MARKS', 'EVALUATION_PERIOD', period_id))
        for audit in MarksConfigurationAudit.objects.filter(entity_type='PERIOD', entity_id=period_id, action='EXTEND'):
            # Older changes superseded by another deadline must not be announced later.
            if audit.after_values.get('closesAt') != period.closes_at.isoformat():
                continue
            result.append(notice(evaluator, f"extended:marks:{audit.pk}:{evaluator_id}",
                f"Deadline extended: {period.name}",
                f"The normal deadline is now {timezone.localtime(period.closes_at):%d %B %Y, %I:%M %p} (Malaysia). "
                'Check your unfinished tasks for any later personal deadline.', 'MARKS', 'EVALUATION_PERIOD', period_id))
    return result


def _outstanding(activity, student, since=None):
    if activity == OperationalPeriod.Activity.SUPERVISOR_APPLICATION:
        if SupervisorAppointment.objects.filter(student=student, status='ACTIVE').exists():
            return False
        pending = SupervisorApplication.objects.filter(student=student, status__in=(
            'SUBMITTED_TO_SUPERVISOR', 'PENDING_COORDINATOR'))
        submitted = SupervisorApplication.objects.filter(student=student, submitted_at__gte=since) if since else pending
    else:
        if PanelAppointment.objects.filter(profile__student_id=student.pk, status='ACTIVE').exists():
            return False
        pending = PanelRecommendation.objects.filter(profile__student_id=student.pk,
            status__in=('SUBMITTED_TO_PANEL', 'PENDING_COORDINATOR'))
        submitted = PanelRecommendation.objects.filter(profile__student_id=student.pk, submitted_at__gte=since) if since else pending
    return not pending.exists() and not submitted.exists()


def operation_notices(now, days, *, recipient_id=None, period_id=None):
    today = timezone.localdate(now)
    enabled = set(OperationalEnforcement.objects.filter(enabled=True).values_list('academic_semester_id', 'activity'))
    periods = OperationalPeriod.objects.filter(lifecycle_status='PUBLISHED', opens_at__lte=now).select_related('academic_semester')
    if period_id is not None:
        periods = periods.filter(pk=period_id)
    result = []
    for period in periods:
        if (period.academic_semester_id, period.activity) not in enabled or not period.academic_semester.is_active:
            continue
        students = Student.objects.filter(status='Active', user__is_active=True).select_related('user')
        if recipient_id is not None:
            students = students.filter(pk=recipient_id) if period.activity == OperationalPeriod.Activity.SUPERVISOR_APPLICATION else students.filter(
                supervisor_appointments__supervisor_id=recipient_id,supervisor_appointments__status='ACTIVE').distinct()
        for student in students:
            if not applies(period, student) or not _outstanding(period.activity, student):
                continue
            participant = student.user
            if period.activity == OperationalPeriod.Activity.PANEL_RECOMMENDATION:
                appointment = SupervisorAppointment.objects.filter(student=student, status='ACTIVE').select_related('supervisor').first()
                if not appointment:
                    continue
                participant = appointment.supervisor
            if not participant.deadline_reminders or not eligible_participant(activity=period.activity, student=student, participant=participant):
                continue
            access = resolve_availability(semester=period.academic_semester, activity=period.activity,
                                          student=student, participant=participant, now=now)
            if not access['canSubmit'] or access['opensAt'] != period.opens_at.isoformat():
                continue
            grants = OperationalException.objects.filter(period=period, student_id=student.pk, participant=participant,
                revoked_at__isnull=True, deadline__gte=now).order_by('-deadline')
            grant = grants.first()
            due = max(period.closes_at, grant.deadline) if grant else period.closes_at
            left = (timezone.localdate(due) - today).days
            phase = closing_phase(left, days)
            module = 'SUPERVISOR_APPOINTMENTS' if period.activity == OperationalPeriod.Activity.SUPERVISOR_APPLICATION else 'PANEL_APPOINTMENTS'
            # Panel reminders go to the primary supervisor, never the student.
            scope = f'{period.pk}:{student.pk}:{participant.pk}'
            name = f'{period.name} — {student.user.full_name}'
            result.append(notice(participant, f'opened:operation:{scope}:{period.opens_at.isoformat()}',
                f'Submissions are open: {name}', 'The submission period is open. Your outstanding action is available.',
                module, 'OPERATIONAL_PERIOD', period.pk))
            if phase:
                result.append(notice(participant, f'deadline:operation:{scope}:{due.isoformat()}:{phase}',
                    f'Submission due {due_text(left)}: {name}',
                    f'Your submission deadline is {timezone.localtime(due):%d %B %Y, %I:%M %p} (Malaysia).',
                    module, 'OPERATIONAL_PERIOD', period.pk, urgent=left <= 1))
            if grant and _outstanding(period.activity, student, since=grant.created_at):
                result.append(notice(participant, f'extra:operation:{grant.pk}', f'Extra time granted: {name}',
                    f'Your deadline is {timezone.localtime(due):%d %B %Y, %I:%M %p} (Malaysia).',
                    module, 'OPERATIONAL_PERIOD', period.pk))
            for audit in period.audits.filter(action='EXTEND'):
                if audit.after_values.get('closesAt') != period.closes_at.isoformat():
                    continue
                result.append(notice(participant, f'extended:operation:{audit.pk}:{student.pk}:{participant.pk}',
                    f'Deadline extended: {name}',
                    f'The normal deadline is now {timezone.localtime(period.closes_at):%d %B %Y, %I:%M %p} (Malaysia).',
                    module, 'OPERATIONAL_PERIOD', period.pk))
    return result


def enqueue_notices(notices):
    return sum(enqueue_deadline_notice(item) for item in notices)


def current_notice(notification, now, *, days=3):
    """Recheck audience and action just before optional mail delivery, not at batch start."""
    if notification.target_module == 'MARKS':
        candidates = marks_notices(now, days, recipient_id=notification.recipient_id, period_id=notification.record_id)
    elif notification.record_type == 'OPERATIONAL_PERIOD':
        candidates = operation_notices(now, days, recipient_id=notification.recipient_id, period_id=notification.record_id)
    elif notification.record_type == 'TIMELINE_ENTRY':
        from .reminders import timeline_notices
        candidates = timeline_notices(now, days, recipient_id=notification.recipient_id, entry_id=notification.record_id)
    else:
        return None
    return next((item for item in candidates if item['eventKey']==notification.event_key
                 and item['recipient'].pk==notification.recipient_id), None)
