"""Announcement + Notification models for the FSKTM PG Office system.

Flow (UC45 publish + UC42/UC49 deliver):

1. A sender (Office Staff/Admin, Programme Coordinator, or Lecturer) creates an
   :class:`Announcement` choosing a target audience, priority, and an optional
   file attachment.
2. When the announcement is published (``status = Active``) the system *fans
   out* one :class:`Notification` per targeted user, so every recipient sees it
   in their personal in-app feed and can download the attachment.

The ``to_public_dict`` methods shape each row exactly the way the React
frontend's ``AnnouncementItem`` / ``NotificationItem`` types expect.
"""
import os

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.timezone import localtime, now


class Announcement(models.Model):
    """A broadcast authored by office staff / coordinators / lecturers."""

    class Audience(models.TextChoices):
        ALL = "All", "Everyone"
        STUDENTS = "All Students", "All Students"
        LECTURERS = "Lecturers", "Lecturers"
        STAFF = "Staff", "Staff"
        COORDINATORS = "Coordinators", "Coordinators"

    class Priority(models.TextChoices):
        URGENT = "Urgent", "Urgent"
        INFO = "Info", "Info"
        GENERAL = "General", "General"

    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        DRAFT = "Draft", "Draft"
        SCHEDULED = "Scheduled", "Scheduled"
        EXPIRED = "Expired", "Expired"

    title = models.CharField(max_length=255)
    content = models.TextField(blank=True, default="")
    target = models.CharField(
        max_length=32, choices=Audience.choices, default=Audience.ALL
    )
    # Further audiences when a notice goes to several groups, e.g. students and lecturers.
    also_targets = models.JSONField(default=list, blank=True)
    priority = models.CharField(
        max_length=16, choices=Priority.choices, default=Priority.INFO
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    # Empty publish_at means "publish when saved"; a future one keeps the notice
    # Scheduled until release_due_announcements() delivers it. After expires_at
    # it becomes Expired, and recipients keep their copies.
    publish_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    # Registry targeting for student announcements; an empty list means all.
    target_programmes = models.JSONField(default=list, blank=True)
    target_intakes = models.JSONField(default=list, blank=True)
    # A lecturer's notice: the user ids of the students they supervised when it was saved.
    target_students = models.JSONField(default=list, blank=True)
    # Optional file recipients can download (PDF, DOCX, etc.).
    attachment = models.FileField(
        upload_to="announcements/%Y/%m/", blank=True, null=True
    )
    # Author. Kept nullable so deleting a staff account does not erase history.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="announcements",
    )
    created_by_name = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} -> {self.target} ({self.status})"

    @property
    def audiences(self):
        return [self.target, *self.also_targets]

    @property
    def summary(self):
        """Short, table-friendly preview of the body."""
        text = " ".join(self.content.split())
        return text if len(text) <= 90 else f"{text[:90]}..."

    @property
    def attachment_name(self):
        return os.path.basename(self.attachment.name) if self.attachment else None

    def to_public_dict(self):
        """Shape this row the way the frontend ``AnnouncementItem`` expects."""
        attachment_url = (
            f"/api/announcements/{self.pk}/attachment/" if self.attachment else None
        )
        return {
            "id": str(self.pk),
            "title": self.title,
            "summary": self.summary,
            "content": self.content,
            "target": self.target,
            "audiences": self.audiences,
            "priority": self.priority,
            "status": self.status,
            "dateCreated": localtime(self.created_at).strftime("%d %b %Y"),
            "createdBy": self.created_by_name or "Postgraduate Office",
            "createdById": str(self.created_by_id) if self.created_by_id else None,
            "attachmentName": self.attachment_name,
            "attachmentUrl": attachment_url,
            "publishAt": localtime(self.publish_at).isoformat() if self.publish_at else None,
            "expiresAt": localtime(self.expires_at).isoformat() if self.expires_at else None,
            "targetProgrammes": self.target_programmes,
            "targetIntakes": self.target_intakes,
            "targetStudentCount": len(self.target_students),
        }


class WeeklySummaryLog(models.Model):
    """One weekly summary email per person per week, so a rerun sends nothing new."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="weekly_summaries",
    )
    week_start = models.DateField(help_text="The Monday of the week it covers.")
    notification_count = models.PositiveIntegerField(default=0)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-week_start"]
        constraints = [
            models.UniqueConstraint(fields=["user", "week_start"], name="one_weekly_summary_per_user_week")
        ]

    def __str__(self):
        return f"Summary for {self.user_id} (week of {self.week_start})"


class DeadlineReminderRun(models.Model):
    """Operational evidence for the scheduled deadline command, never student data."""
    started_at = models.DateTimeField(default=now)
    completed_at = models.DateTimeField(null=True, blank=True)
    timeline_count = models.PositiveIntegerField(default=0)
    marks_count = models.PositiveIntegerField(default=0)
    operation_count = models.PositiveIntegerField(default=0)
    email_delivered = models.PositiveIntegerField(default=0)
    email_failed = models.PositiveIntegerField(default=0)
    error = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-started_at']


def visible_notifications(user):
    """Current-role projection also protects staff history after an account role change."""
    rows = Notification.objects.filter(recipient=user)
    if user.role == user.Role.STUDENT:
        rows = rows.exclude(
            Q(target_module='MARKS')
            | Q(record_type__in=('CO_SUPERVISOR_NOMINATION', 'EVALUATION_PERIOD',
                                 'EVALUATION_TASK', 'MARK_ENTRY', 'TASK_COMPLETION_WINDOW'))
            | Q(record_type='OPERATIONAL_PERIOD', target_module='PANEL_APPOINTMENTS')
        )
    return rows


class DeadlineEmailDelivery(models.Model):
    """Durable optional email copy; the in-app notification is authoritative."""
    notification = models.OneToOneField('announcements.Notification', on_delete=models.CASCADE,
                                        related_name='deadline_email_delivery')
    link = models.CharField(max_length=255)
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=now)
    delivered_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=255, blank=True)


class Notification(models.Model):
    """A per-recipient in-app notification (the bell feed, UC49)."""

    class Priority(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        NORMAL = "normal", "Normal"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=255)
    # Shown as the "From" / service label in the UI.
    service = models.CharField(max_length=128, default="Postgraduate Office")
    summary = models.CharField(max_length=255, blank=True, default="")
    message = models.TextField(blank=True, default="")
    priority = models.CharField(
        max_length=16, choices=Priority.choices, default=Priority.NORMAL
    )
    is_read = models.BooleanField(default=False)
    is_announcement = models.BooleanField(default=True)
    reference = models.CharField(max_length=64, blank=True, default="")
    module_label = models.CharField(max_length=128, blank=True, default="Announcement")
    target_module = models.CharField(max_length=64, blank=True, default="")
    record_type = models.CharField(max_length=64, blank=True, default="")
    record_id = models.CharField(max_length=64, blank=True, default="")
    event_key = models.CharField(max_length=160, blank=True, default="", db_index=True)
    # Source announcement, so the recipient can open the full content + file.
    announcement = models.ForeignKey(
        Announcement,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "is_read"])]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "event_key"],
                condition=~Q(event_key=""),
                name="unique_workflow_notification_per_recipient_event",
            )
        ]

    def __str__(self):
        return f"{self.title} -> {self.recipient_id} ({'read' if self.is_read else 'unread'})"

    def to_public_dict(self):
        """Shape this row the way the frontend ``NotificationItem`` expects."""
        student_appointment = self.recipient.role == "Student" and self.record_type == "CO_SUPERVISOR_APPOINTMENT"
        # Legacy appointment messages may contain internal lifecycle reasons.
        student_summary = "Your supporting supervisor appointment has been updated."
        student_message = "View your confirmed supporting appointments in My supervisors."
        attachment_name = (
            self.announcement.attachment_name if self.announcement else None
        )
        return {
            "id": str(self.pk),
            "title": self.title,
            "service": self.service,
            "description": student_summary if student_appointment else self.summary or " ".join(self.message.split())[:90],
            "detailedMessage": student_message if student_appointment else self.message,
            "timeAgo": localtime(self.created_at).strftime("%d %b %Y, %I:%M %p"),
            "priority": self.priority,
            "isUnread": not self.is_read,
            "isAnnouncement": self.is_announcement,
            "reference": self.reference,
            "recipient": getattr(self.recipient, "full_name", "") or self.recipient.email,
            "moduleLabel": self.module_label,
            "targetModule": self.target_module,
            "recordType": self.record_type,
            "recordId": self.record_id,
            "announcementId": str(self.announcement_id) if self.announcement_id else None,
            "attachmentName": attachment_name,
        }
