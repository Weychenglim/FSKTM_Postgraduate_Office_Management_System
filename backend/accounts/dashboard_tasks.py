"""Waiting work from Registry, Letters, File Management and the FAQ, as dashboard tasks.

Each module answers for its own work; ``module_tasks`` is the one call the
dashboard makes.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone

from .project_stages import open_corrections

User = get_user_model()


def dashboard_tasks(user, now):
    if getattr(user, "role", None) != User.Role.COORDINATOR:
        return []
    count = open_corrections(user)
    if not count:
        return []
    return [
        {
            "id": "registry_stage_corrections",
            "name": "RP Registration correction requests",
            "status": "pending",
            "statusText": f"{count} waiting",
            "target": "Registry Management",
            "targetModule": "REGISTRY",
            "recordType": "PROJECT_STAGE",
        }
    ]


def module_tasks(user, now=None):
    from documents.dashboard_tasks import dashboard_tasks as file_tasks
    from faq.dashboard_tasks import dashboard_tasks as faq_tasks
    from letters.dashboard_tasks import dashboard_tasks as letter_tasks

    now = now or timezone.now()
    return [
        *file_tasks(user, now),
        *dashboard_tasks(user, now),
        *letter_tasks(user, now),
        *faq_tasks(user, now),
    ]
