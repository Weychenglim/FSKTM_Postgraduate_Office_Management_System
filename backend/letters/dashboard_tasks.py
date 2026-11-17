"""The office's waiting letter work, as a dashboard task.

It counts what the Requests tab counts: every letter still Pending, whether a
student asked for it or an appointment letter is waiting for office details.
"""
from django.contrib.auth import get_user_model
from django.db.models import Count, Min

from .models import GeneratedLetter

User = get_user_model()


def _waiting_line(count, oldest, now):
    days = (now - oldest).days if oldest else 0
    if days < 1:
        return f"{count} waiting"
    return f"{count} waiting · oldest {days} day{'s' if days != 1 else ''}"


def dashboard_tasks(user, now):
    if getattr(user, "role", None) != User.Role.OFFICE_ADMIN:
        return []
    pending = GeneratedLetter.objects.filter(status=GeneratedLetter.Status.PENDING).aggregate(
        count=Count("id"), oldest=Min("created_at")
    )
    if not pending["count"]:
        return []
    return [
        {
            "id": "letters_requests",
            "name": "Letter requests to review",
            "status": "pending",
            "statusText": _waiting_line(pending["count"], pending["oldest"], now),
            "target": "Letter Generation",
            "targetModule": "LETTERS",
            "recordType": "LETTER_REQUESTS",
        }
    ]
