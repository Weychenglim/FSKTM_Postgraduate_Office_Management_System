"""Remind people of timeline and Marks deadlines that are coming up.

Run it daily from Windows Task Scheduler or cron (see the backend README). It
is safe to run repeatedly: each person gets one reminder per deadline.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone

from announcements.models import DeadlineReminderRun, Notification, DeadlineEmailDelivery
from announcements.reminders import send_deadline_reminders, preview_deadline_reminders
from maintenance.state import is_on as under_maintenance


class Command(BaseCommand):
    help = "Send in-app (and, where allowed, email) reminders for deadlines in the next few days."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Preview recipient counts without writes or deliveries.')
        parser.add_argument(
            "--days",
            type=int,
            default=3,
            help="Remind about deadlines due within this many days (default 3).",
        )

    def handle(self, *args, **options):
        days = options["days"]
        if days < 0:
            raise CommandError("--days cannot be negative.")
        if options['dry_run']:
            calendar, marks, operations = preview_deadline_reminders(days=days)
            def pending(items):
                keys = {(item['recipient'].pk, item['eventKey']) for item in items}
                return sum(not Notification.objects.filter(recipient_id=user_id,event_key=key).exists() for user_id,key in keys)
            self.stdout.write(f'Dry run: {pending(calendar)} calendar, {pending(operations)} appointment and {pending(marks)} Marks notification(s) would be created. No writes or deliveries.')
            return
        if under_maintenance():
            self.stdout.write("The portal is under maintenance; skipped.")
            return
        locked = False
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_try_advisory_lock(%s)', [62483170])
                locked = cursor.fetchone()[0]
            if not locked:
                self.stdout.write('Another deadline reminder job is running; skipped.')
                return
        run = DeadlineReminderRun.objects.create()
        delivered_before = DeadlineEmailDelivery.objects.filter(delivered_at__isnull=False,last_error='').count()
        operations_before = Notification.objects.filter(record_type='OPERATIONAL_PERIOD').count()
        try:
            timeline, marks = send_deadline_reminders(days=days)
            run.marks_count = marks
            run.operation_count = Notification.objects.filter(record_type='OPERATIONAL_PERIOD').count() - operations_before
            run.timeline_count = timeline - run.operation_count
            run.email_delivered = DeadlineEmailDelivery.objects.filter(delivered_at__isnull=False,last_error='').count() - delivered_before
            run.email_failed = DeadlineEmailDelivery.objects.filter(delivered_at__isnull=True).exclude(last_error='').count()
            self.stdout.write(f"Sent {run.timeline_count} timeline reminder(s) and {marks} Marks reminder(s).")
            self.stdout.write(f'Appointment notices: {run.operation_count}; optional email copies delivered: {run.email_delivered}; queued for retry: {run.email_failed}.')
        except Exception as error:
            run.error = type(error).__name__
            raise
        finally:
            run.completed_at = timezone.now()
            run.save()
            if locked:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_unlock(%s)', [62483170])
