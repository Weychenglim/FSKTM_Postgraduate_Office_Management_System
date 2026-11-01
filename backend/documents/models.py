"""Official documents linked to student records (File Management, UC24 to UC27)."""
import uuid
from pathlib import PurePosixPath

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class DocumentType(models.Model):
    """An office-managed kind of document: who may upload it, who sees it by
    default, and whether the office checks it."""

    class Group(models.TextChoices):
        SUPERVISION = "SUPERVISION", "Supervision"
        RESEARCH_PROJECT = "RESEARCH_PROJECT", "Research Project"
        FORMS = "FORMS", "Faculty Forms"
        LETTERS = "LETTERS", "Letters"
        EVALUATION = "EVALUATION", "Evaluation"
        STAFF = "STAFF", "Staff Documents"
        OTHER = "OTHER", "Other"

    class Kind(models.TextChoices):
        STUDENT = "STUDENT", "Student files"
        STAFF = "STAFF", "Staff files"
        BOTH = "BOTH", "Student or staff files"

    UPLOADERS = ("STUDENT", "SUPERVISOR", "PANEL", "COORDINATOR", "LECTURER")
    FILE_KINDS = ("PDF", "DOCX", "IMAGE", "XLSX", "PPTX")

    code = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=120)
    description = models.CharField(max_length=300, blank=True)
    group = models.CharField(max_length=32, choices=Group.choices, default=Group.OTHER)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.STUDENT)
    uploaders = models.JSONField(default=list, blank=True)
    allowed_kinds = models.JSONField(default=list, blank=True)
    share_supervisors = models.BooleanField(default=False)
    share_panel = models.BooleanField(default=False)
    share_coordinator = models.BooleanField(default=False)
    needs_check = models.BooleanField(default=False)
    one_per_student = models.BooleanField(default=False)
    # Every Active student must hand it in; an empty list means every programme.
    required = models.BooleanField(default=False)
    required_due_note = models.CharField(max_length=120, blank=True)
    required_programmes = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "label"]

    def __str__(self):
        return self.label

    def save(self, *args, **kwargs):
        if self.pk:
            stored = type(self).objects.filter(pk=self.pk).values_list("code", flat=True).first()
            if stored is not None and stored != self.code:
                raise ValidationError("Document type codes cannot change.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Document types cannot be deleted; switch them off instead.")

    @property
    def for_students(self):
        return self.kind in (self.Kind.STUDENT, self.Kind.BOTH)

    @property
    def for_staff(self):
        return self.kind in (self.Kind.STAFF, self.Kind.BOTH)

    def to_public_dict(self):
        return {
            "code": self.code,
            "label": self.label,
            "description": self.description,
            "group": self.group,
            "groupLabel": self.get_group_display(),
            "kind": self.kind,
            "uploaders": list(self.uploaders or []),
            "allowedKinds": list(self.allowed_kinds or []),
            "shareSupervisors": self.share_supervisors,
            "sharePanel": self.share_panel,
            "shareCoordinator": self.share_coordinator,
            "needsCheck": self.needs_check,
            "onePerStudent": self.one_per_student,
            "required": self.required,
            "requiredDueNote": self.required_due_note,
            "requiredProgrammes": list(self.required_programmes or []),
            "isActive": self.is_active,
        }


class Document(models.Model):
    class CheckStatus(models.TextChoices):
        NONE = "NONE", "No check needed"
        WAITING = "WAITING", "Waiting for office"
        ACCEPTED = "ACCEPTED", "Accepted"
        RETURNED = "RETURNED", "Returned"

    class Audience(models.TextChoices):
        ACADEMIC = "ACADEMIC", "All lecturers and coordinators"
        COORDINATORS = "COORDINATORS", "Programme coordinators only"
        OFFICE = "OFFICE", "PG office only"

    reference = models.CharField(max_length=32, unique=True, null=True, blank=True)
    doc_type = models.ForeignKey(DocumentType, on_delete=models.PROTECT, related_name="documents")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    semester = models.ForeignKey(
        "academics.AcademicSemester",
        on_delete=models.PROTECT,
        related_name="documents",
        null=True,
        blank=True,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="uploaded_documents"
    )
    uploader_role = models.CharField(max_length=64)
    is_staff_file = models.BooleanField(default=False)
    share_supervisors = models.BooleanField(default=False)
    share_panel = models.BooleanField(default=False)
    share_coordinator = models.BooleanField(default=False)
    # Student uploads keep following their type's sharing; staff choices stay put.
    follows_type = models.BooleanField(default=False)
    staff_audience = models.CharField(max_length=16, choices=Audience.choices, blank=True)
    staff_programmes = models.JSONField(default=list, blank=True)
    check_status = models.CharField(
        max_length=16, choices=CheckStatus.choices, default=CheckStatus.NONE
    )
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="checked_documents",
        null=True,
        blank=True,
    )
    checked_at = models.DateTimeField(null=True, blank=True)
    check_reason = models.TextField(blank=True)
    current_version = models.ForeignKey(
        "DocumentVersion",
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="archived_documents",
        null=True,
        blank=True,
    )
    archive_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    students = models.ManyToManyField(
        "accounts.Student", through="DocumentStudent", related_name="documents"
    )

    class Meta:
        ordering = ["-created_at", "-pk"]
        indexes = [
            models.Index(fields=["archived_at", "created_at"]),
            models.Index(fields=["check_status", "archived_at"]),
            models.Index(fields=["doc_type", "archived_at"]),
        ]

    def __str__(self):
        return f"{self.reference or 'DOC'} {self.title}"


class DocumentStudent(models.Model):
    """One student a document is about."""

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="student_links")
    student = models.ForeignKey(
        "accounts.Student", on_delete=models.PROTECT, related_name="document_links"
    )

    class Meta:
        ordering = ["pk"]
        constraints = [
            models.UniqueConstraint(fields=["document", "student"], name="one_link_per_document_student")
        ]


def version_path(instance, filename):
    now = timezone.localtime()
    suffix = PurePosixPath(filename).suffix.lower()
    return f"documents/{now:%Y}/{now:%m}/{uuid.uuid4().hex}{suffix}"


class DocumentVersion(models.Model):
    """One uploaded file. Never changed once saved; removed only with its document."""

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    file = models.FileField(upload_to=version_path, max_length=255)
    original_name = models.CharField(max_length=150)
    content_type = models.CharField(max_length=128)
    kind = models.CharField(max_length=8)
    size = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64)
    page_count = models.PositiveIntegerField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="document_versions"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["document", "-number"]
        constraints = [
            models.UniqueConstraint(fields=["document", "number"], name="one_number_per_document_version")
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Saved document versions cannot be changed.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("A version is removed only together with its document.")


class DocumentEvent(models.Model):
    """The history of a document. Rows stay when the document is deleted."""

    class Action(models.TextChoices):
        UPLOADED = "UPLOADED", "Uploaded"
        VERSION_ADDED = "VERSION_ADDED", "Added a new version"
        DETAILS_CHANGED = "DETAILS_CHANGED", "Changed the details"
        SHARING_CHANGED = "SHARING_CHANGED", "Changed who it is shared with"
        ACCEPTED = "ACCEPTED", "Accepted"
        RETURNED = "RETURNED", "Returned"
        ARCHIVED = "ARCHIVED", "Archived"
        RESTORED = "RESTORED", "Restored"
        LINKED = "LINKED", "Linked a record"
        UNLINKED = "UNLINKED", "Removed a record link"
        PREVIEWED = "PREVIEWED", "Opened"
        DOWNLOADED = "DOWNLOADED", "Downloaded"
        DELETED = "DELETED", "Deleted"

    document = models.ForeignKey(
        Document, on_delete=models.SET_NULL, related_name="events", null=True, blank=True
    )
    reference = models.CharField(max_length=32, blank=True)
    title = models.CharField(max_length=200, blank=True)
    version_number = models.PositiveIntegerField(null=True, blank=True)
    action = models.CharField(max_length=24, choices=Action.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="document_events",
        null=True,
        blank=True,
    )
    actor_name = models.CharField(max_length=255, blank=True)
    reason = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        indexes = [models.Index(fields=["action", "created_at"])]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Document history cannot be changed.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Document history cannot be deleted.")


class SettingsChange(models.Model):
    """The office's changes to document types (and, before tags became automatic,
    to typed tags). Never changed or deleted."""

    class Area(models.TextChoices):
        TYPE = "TYPE", "Document type"
        TAG = "TAG", "Tag"

    class Action(models.TextChoices):
        ADDED = "ADDED", "Added"
        CHANGED = "CHANGED", "Changed"
        RENAMED = "RENAMED", "Renamed"
        MERGED = "MERGED", "Merged"
        REMOVED = "REMOVED", "Removed"

    area = models.CharField(max_length=8, choices=Area.choices)
    action = models.CharField(max_length=16, choices=Action.choices)
    label = models.CharField(max_length=120)
    doc_type = models.ForeignKey(
        DocumentType, on_delete=models.SET_NULL, related_name="changes", null=True, blank=True
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="document_settings_changes",
        null=True,
        blank=True,
    )
    actor_name = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Settings history cannot be changed.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Settings history cannot be deleted.")


class RequiredReminder(models.Model):
    """One press of Remind for a required type. At most one a day per type."""

    doc_type = models.ForeignKey(DocumentType, on_delete=models.CASCADE, related_name="reminders")
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="document_reminders",
        null=True,
        blank=True,
    )
    sent_by_name = models.CharField(max_length=255, blank=True)
    students = models.PositiveIntegerField(default=0)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sent_at", "-pk"]


ACTIVE_DOCUMENT = Q(archived_at__isnull=True)
