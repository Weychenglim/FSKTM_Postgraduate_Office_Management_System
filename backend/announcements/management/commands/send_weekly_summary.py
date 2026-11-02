"""Email the weekly summary of unread notifications to everyone who turned it on.

Run it once a week from Windows Task Scheduler or cron (see the backend
README). A second run in the same week sends nothing new.
"""
from django.core.management.base import BaseCommand

from announcements.reminders import send_weekly_summaries
from maintenance.state import is_on as under_maintenance


class Command(BaseCommand):
    help = "Email each opted-in user a summary of their unread notifications from the past week."

    def handle(self, *args, **options):
        if under_maintenance():
            self.stdout.write("The portal is under maintenance; skipped.")
            return
        sent = send_weekly_summaries()
        self.stdout.write(f"Sent {sent} weekly summary email(s).")
