"""Tells a student when the office changes their academic status.

Listens for new rows in the status history (``ParticipantLifecycleAudit``), so
the status service itself is not changed and every route that changes a status
gives the same notice.
"""
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from announcements.models import Notification

from .models import ParticipantLifecycleAudit

NOTICES = {
    "GRADUATED": (
        "You have graduated",
        "You can still sign in to see your records and letters. For a new letter, contact the PG office.",
    ),
    "DEFERRED": (
        "Your studies are now deferred",
        "You cannot upload files or ask for letters while deferred. Contact the PG office with any questions.",
    ),
    "ACTIVE": (
        "You are Active again",
        "You can upload files and ask for letters again.",
    ),
    "WITHDRAWN": (
        "You are now Withdrawn",
        "You can still sign in to see your records. Contact the PG office with any questions.",
    ),
}


def send_status_notice(audit_id):
    audit = ParticipantLifecycleAudit.objects.select_related("student__user").get(pk=audit_id)
    notice = NOTICES.get(audit.new_status)
    user = audit.student.user if audit.student_id else None
    if notice is None or user is None or not user.is_active:
        return
    title, advice = notice
    Notification.objects.bulk_create(
        [
            Notification(
                recipient=user,
                event_key=f"registry:student-status:{audit.pk}",
                title=title,
                service="Postgraduate Office",
                summary=f"Your status is now {audit.new_status.capitalize()}.",
                message=f"The PG office changed your status to {audit.new_status.capitalize()}. Reason: {audit.reason} {advice}",
                is_announcement=False,
                module_label="Student Registry",
                target_module="DASHBOARD",
                record_type="STUDENT_STATUS",
                record_id=str(audit.student_id),
            )
        ],
        ignore_conflicts=True,
    )


@receiver(post_save, sender=ParticipantLifecycleAudit, dispatch_uid="registry_student_status_notices")
def student_status_changed(sender, instance, created, raw=False, **kwargs):
    if created and not raw and instance.student_id:
        transaction.on_commit(lambda: send_status_notice(instance.pk), robust=True)
