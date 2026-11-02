"""Show, start or end portal maintenance from the command line.

For the technical administrator, for example in a deploy script or when the
admin site cannot be reached. It is normally switched in Django admin.
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from maintenance import state


class Command(BaseCommand):
    help = "Show, start or end portal maintenance."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["status", "on", "off"])
        parser.add_argument("--message", default="", help="Shown to everyone who is turned away.")
        parser.add_argument("--hours", type=float, help="How long it is expected to take.")

    def handle(self, *args, **options):
        action = options["action"]
        try:
            if action == "on":
                hours = options["hours"]
                state.change(
                    None,
                    expected_end=timezone.now() + timedelta(hours=hours) if hours else None,
                    message=options["message"],
                )
            elif action == "off":
                state.end(None)
        except state.MaintenanceProblem as problem:
            raise CommandError(" ".join(problem.errors.values()))

        found = state.public_dict()
        line = f"Maintenance is {found['status']}."
        if found["startsAt"]:
            line += f" Starts {found['startsAt']}."
        if found["expectedEnd"]:
            line += f" Expected end {found['expectedEnd']}."
        self.stdout.write(line)
        if action != "status" and "LocMemCache" in settings.CACHES["default"]["BACKEND"]:
            self.stdout.write("The server keeps its own in-memory cache: restart it to pick this up.")
