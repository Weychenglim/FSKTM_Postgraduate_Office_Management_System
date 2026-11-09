"""Deadline reminders and the weekly summary email (UC33).

Run by the ``send_deadline_reminders`` and ``send_weekly_summary`` commands from
Task Scheduler or cron. Both are safe to rerun: a reminder is one notification
per person per deadline (``event_key``), and a summary is one email per person
per week (``WeeklySummaryLog``).

People with "Deadline reminders" off get no reminders; email copies also need
"Email alerts" (see ``emails.py``).
"""
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from academics.services import current_effective_semester
from dashboard.models import SemesterTimelineEntry, TimelineAuditLog

from .emails import DEADLINE, SIGN_OFF, SUMMARY, email_users, portal_link
from .models import Notification, WeeklySummaryLog, DeadlineReminderRun, visible_notifications
from .connected_reminders import closing_phase, enqueue_notices, marks_notices, operation_notices, current_notice
from .deadline_delivery import deliver_deadline_emails

User = get_user_model()

# Timeline target roles -> portal roles, the same mapping the dashboard uses.
TIMELINE_ROLES = {
    "STUDENT": User.Role.STUDENT,
    "LECTURER": User.Role.LECTURER,
    "OFFICE_STAFF": User.Role.OFFICE_ADMIN,
}
SUMMARY_ITEMS = 20


def _due_in(days):
    if days <= 0:
        return "today"
    if days == 1:
        return "tomorrow"
    return f"in {days} days"


def timeline_notices(now, days, *, recipient_id=None, entry_id=None):
    """Calendar-only entries; linked records use their owning operational source."""
    semester = current_effective_semester()
    if semester is None:
        return []
    today = timezone.localdate(now)
    entries = SemesterTimelineEntry.objects.filter(
        timeline__is_published=True, timeline__academic_semester=semester,
        operational_period__isnull=True, marks_period__isnull=True,
        deadline_end__gte=today,
    ).order_by("deadline_end", "display_order")
    if entry_id is not None:
        entries = entries.filter(source_entry_id=entry_id)
    last_run = DeadlineReminderRun.objects.filter(completed_at__isnull=False,error='').order_by('-completed_at').first()
    opening_since = min(today, timezone.localdate(last_run.completed_at)) if last_run else today
    result = []
    for entry in entries:
        stable_id = entry.source_entry_id or entry.pk
        left = (entry.deadline_end - today).days
        roles = [TIMELINE_ROLES[role] for role in entry.target_roles if role in TIMELINE_ROLES]
        users = User.objects.filter(is_active=True, role__in=roles, deadline_reminders=True)
        if recipient_id is not None:
            users = users.filter(pk=recipient_id)
        for user in users:
            base = dict(recipient=user, targetModule='DASHBOARD', recordType='TIMELINE_ENTRY',
                        recordId=stable_id, link='/dashboard')
            if left <= days:
                phase = closing_phase(left, days)
                result.append(dict(base, eventKey=f'reminder:timeline:{stable_id}:{entry.deadline_end.isoformat()}:{phase}',
                    title=f'Deadline {_due_in(left)}: {entry.title or entry.detail[:80]}',
                    summary=f'Due {entry.deadline_end:%d %b %Y}',
                    message=f'{entry.detail}\n\nDue: {entry.deadline_end:%d %B %Y}. Action by: {entry.action_owner}.', urgent=left<=1))
            if opening_since <= entry.deadline_start <= today:
                result.append(dict(base,eventKey=f'opened:timeline:{stable_id}:{entry.deadline_start.isoformat()}',
                    title=f'Event period is open: {entry.title or entry.detail[:80]}',
                    summary='The event period is open.', message=entry.detail, urgent=False))
            for audit in TimelineAuditLog.objects.filter(entry_id=stable_id, action='EXTEND', created_at__lte=entry.timeline.published_at):
                if audit.after_values.get('deadlineEnd') != entry.deadline_end.isoformat():
                    continue
                result.append(dict(base,eventKey=f'extended:timeline:{audit.pk}',
                    title=f'Deadline extended: {entry.title or entry.detail[:80]}',
                    summary=f'New deadline: {entry.deadline_end:%d %b %Y}',
                    message=f'The event deadline is now {entry.deadline_end:%d %B %Y} (complete Malaysia day).',urgent=False))
    return result


def _timeline_reminders(today, days):
    now = timezone.make_aware(datetime.combine(today, time.min))
    return enqueue_notices(timeline_notices(now, days))


def _marks_reminders(now, today, days):
    return enqueue_notices(marks_notices(now, days))


def preview_deadline_reminders(days=3, now=None):
    """Read-only job plan; used by --dry-run and stale-email suppression."""
    now = now or timezone.now()
    return timeline_notices(now, days), marks_notices(now, days), operation_notices(now, days)


def send_deadline_reminders(days=3, now=None):
    now = now or timezone.now()
    calendar, marks, operations = preview_deadline_reminders(days, now)
    timeline_count = enqueue_notices(calendar) + enqueue_notices(operations)
    marks_count = enqueue_notices(marks)
    current = {(notice['recipient'].pk,notice['eventKey']):notice for notice in calendar+marks+operations}
    deliver_deadline_emails(now=now, valid_keys=set(current), current_notices=current,
                            notice_loader=lambda notification,at:current_notice(notification,at,days=days))
    return timeline_count, marks_count


def send_weekly_summaries(now=None):
    """Email everyone who turned the weekly summary on a list of their unread
    notifications from the past seven days. Returns how many emails were sent."""
    now = now or timezone.now()
    today = timezone.localdate(now)
    week_start = today - timedelta(days=today.weekday())
    since = now - timedelta(days=7)
    sent = 0
    people = (
        User.objects.filter(is_active=True, weekly_summary=True)
        .exclude(email="")
        .exclude(role=User.TECHNICAL_ADMIN)
    )
    for user in people:
        unread = visible_notifications(user).filter(is_read=False, created_at__gte=since)
        total = unread.count()
        if not total:
            continue
        with transaction.atomic():
            log, created = WeeklySummaryLog.objects.get_or_create(
                user=user, week_start=week_start, defaults={"notification_count": total}
            )
        if not created:
            continue
        lines = [
            f"- {item.title} ({timezone.localtime(item.created_at):%d %b, %I:%M %p})"
            for item in unread.order_by("-created_at")[:SUMMARY_ITEMS]
        ]
        if total > SUMMARY_ITEMS:
            lines.append(f"- and {total - SUMMARY_ITEMS} more")
        message = (
            f"Hello {user.full_name or user.email},\n\n"
            f"You have {total} unread notification{'s' if total != 1 else ''} from the past week:\n\n"
            + "\n".join(lines)
            + f"\n\nRead them in the portal: {portal_link('/notifications')}\n\n"
            "You get this email because the weekly summary is on in your Settings.\n\n"
            f"{SIGN_OFF}"
        )
        if email_users([user], SUMMARY, "Your FSKTM PG Office weekly summary", message):
            sent += 1
        else:
            # Nothing went out, so let a later run try again this week.
            log.delete()
    return sent
