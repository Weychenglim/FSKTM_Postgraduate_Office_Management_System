"""Publish scheduled announcements that are due and expire finished ones.

Run it every few minutes from Windows Task Scheduler or cron (see the backend
README). It is safe to run repeatedly: nothing is delivered twice.
"""
from django.core.management.base import BaseCommand

from announcements.views import release_due_announcements
from maintenance.state import is_on as under_maintenance


class Command(BaseCommand):
    help = "Publish scheduled announcements that are due and expire finished ones."

    def handle(self, *args, **options):
        if under_maintenance():
            self.stdout.write("The portal is under maintenance; skipped.")
            return
        released, expired = release_due_announcements()
        self.stdout.write(
            f"Released {released} scheduled announcement(s); expired {expired}."
        )
