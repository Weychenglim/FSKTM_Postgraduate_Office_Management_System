"""In-app notices for programme transfers.

Each new entry in a transfer's history (``appointments.ResearchAmendmentEvent``)
tells whoever has to act next, or, once it ends, the student and the office user
who started it. The workflow itself is not changed here.
"""
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from announcements.models import Notification
from appointments.models import ResearchAmendment, ResearchAmendmentEvent

from .authorization import programme_coordinators

TARGET_MODULE = "REGISTRY"
RECORD_TYPE = "PROGRAMME_TRANSFER"
WAITING = ("PENDING_SOURCE_COORDINATOR", "PENDING_DESTINATION_COORDINATOR")
ENDED = ("APPROVED", "REJECTED", "CANCELLED")


def _send(recipients, row, event, *, title, summary, message):
    notices = [
        Notification(
            recipient=user,
            event_key=f"registry:transfer:{row.pk}:{event.pk}",
            title=title[:255],
            service="Postgraduate Office",
            summary=summary[:255],
            message=message,
            is_announcement=False,
            reference=f"Transfer #{row.pk}",
            module_label="Student Registry",
            target_module=TARGET_MODULE,
            record_type=RECORD_TYPE,
            record_id=str(row.pk),
        )
        for user in recipients
        if user.is_active and user.pk != event.actor_id
    ]
    if notices:
        Notification.objects.bulk_create(notices, ignore_conflicts=True)


def send_transfer_notices(event_id):
    event = ResearchAmendmentEvent.objects.select_related(
        "request__student__user", "request__initiated_by",
    ).get(pk=event_id)
    row = event.request
    if row.kind != ResearchAmendment.Kind.TRANSFER:
        return
    route = f"{row.source_programme} to {row.destination_programme}"
    if event.new_status in WAITING:
        programme = row.source_programme if event.new_status == "PENDING_SOURCE_COORDINATOR" else row.destination_programme
        _send(
            list(programme_coordinators(programme)), row, event,
            title=f"Programme transfer waiting for you: {row.student_name}",
            summary=route,
            message=f"{row.student_name} ({row.matric_no}) is moving from {route}. Approve or reject it in Student Registry, Programme transfers.",
        )
        return
    if event.new_status not in ENDED:
        return
    reason = f" Reason: {event.reason}" if event.reason else ""
    student_text = {
        "APPROVED": (f"You are now in {row.destination_programme}", f"Your programme transfer is complete. You are now in {row.destination_programme}. Your supervisors and panel stay the same."),
        "REJECTED": ("Your programme transfer was not approved", f"Your transfer from {route} was not approved.{reason}"),
        "CANCELLED": ("Your programme transfer was cancelled", f"The request to move you from {route} was cancelled.{reason}"),
    }[event.new_status]
    office_text = {
        "APPROVED": (f"Transferred: {row.student_name}", f"{row.student_name} ({row.matric_no}) moved from {route}."),
        "REJECTED": (f"Transfer not approved: {row.student_name}", f"{event.actor_name} rejected the transfer of {row.student_name} ({row.matric_no}) from {route}.{reason}"),
        "CANCELLED": (f"Transfer cancelled: {row.student_name}", f"The transfer of {row.student_name} ({row.matric_no}) from {route} was cancelled.{reason}"),
    }[event.new_status]
    _send([row.student.user], row, event, title=student_text[0], summary=route, message=student_text[1])
    if row.initiated_by_id != row.student.user_id:
        _send([row.initiated_by], row, event, title=office_text[0], summary=route, message=office_text[1])


@receiver(post_save, sender=ResearchAmendmentEvent, dispatch_uid="registry_transfer_notices")
def transfer_event_saved(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        transaction.on_commit(lambda: send_transfer_notices(instance.pk))
