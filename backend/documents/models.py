"""Official documents linked to student records (File Management, UC24 to UC27)."""
import uuid
from pathlib import PurePosixPath

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class DocumentType(models.Model):
    """A kind of document from the faculty's research project timeline: who may
    upload it and who sees it. The Technical Admin keeps the list in Django admin."""

    class Group(models.TextChoices):
        RP1 = "RP1", "Research Project 1"
        RP2 = "RP2", "Research Project 2"
        SUPPORTING = "SUPPORTING", "Supporting Documents"
        STAFF = "STAFF", "Staff Documents"

    class Kind(models.TextChoices):
        STUDENT = "STUDENT", "Student files"
        STAFF = "STAFF", "Staff files"
        BOTH = "BOTH", "Student or staff files"

    UPLOADERS = ("STUDENT", "SUPERVISOR", "PANEL", "COORDINATOR", "LECTURER")
    FILE_KINDS = ("PDF", "DOCX", "IMAGE", "XLSX", "PPTX")

    code = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=120)
    description = models.CharField(max_length=300, blank=True)
    group = models.CharField(max_length=32, choices=Group.choices, default=Group.SUPPORTING)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.STUDENT)
    uploaders = models.JSONField(default=list, blank=True)
    allowed_kinds = models.JSONField(default=list, blank=True)
    share_supervisors = models.BooleanField(default=False)
    share_panel = models.BooleanField(default=False)
    share_coordinator = models.BooleanField(default=False)
    one_per_student = models.BooleanField(default=False)
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
            "onePerStudent": self.one_per_student,
            "isActive": self.is_active,
        }


class Document(models.Model):
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
    staff_audience = models.CharField(max_length=16, choices=Audience.choices, blank=True)
    staff_programmes = models.JSONField(default=list, blank=True)
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


class Submission(models.Model):
    """A dated hand-in a programme coordinator sets up for one semester."""

    class AfterDue(models.TextChoices):
        CLOSE = "CLOSE", "Close"
        ACCEPT_LATE = "ACCEPT_LATE", "Accept late"

    class Stage(models.TextChoices):
        ALL = "ALL", "Everyone"
        P1 = "P1", "RP1"
        P2 = "P2", "RP2"

    title = models.CharField(max_length=120)
    doc_type = models.ForeignKey(DocumentType, on_delete=models.PROTECT, related_name="submissions")
    academic_semester = models.ForeignKey(
        "academics.AcademicSemester", on_delete=models.PROTECT, related_name="submissions"
    )
    programmes = models.JSONField(default=list)
    stage = models.CharField(max_length=8, choices=Stage.choices, default=Stage.ALL)
    due_at = models.DateTimeField()
    after_due = models.CharField(max_length=16, choices=AfterDue.choices, default=AfterDue.CLOSE)
    late_until = models.DateTimeField(null=True, blank=True)
    is_open = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-due_at", "-pk"]


class SubmissionExtension(models.Model):
    """One student's own later due date."""

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="extensions")
    student = models.ForeignKey("accounts.Student", on_delete=models.CASCADE, related_name="submission_extensions")
    due_at = models.DateTimeField()
    reason = models.CharField(max_length=120)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    granted_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["submission", "student"], name="one_extension_per_submission_student")
        ]


class SubmissionEntry(models.Model):
    """The file a student sent for a submission. Each upload keeps its own time on the document's versions."""

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="entries")
    student = models.ForeignKey("accounts.Student", on_delete=models.CASCADE, related_name="submission_entries")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="submission_entries")
    first_sent_at = models.DateTimeField()
    last_sent_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["submission", "student"], name="one_entry_per_submission_student")
        ]


class SubmissionChange(models.Model):
    """Every change to a submission, its switches and its extensions. Rows are never changed."""

    class Action(models.TextChoices):
        CREATED = "CREATED", "Set up"
        CHANGED = "CHANGED", "Changed"
        OPENED = "OPENED", "Opened"
        CLOSED = "CLOSED", "Closed"
        EXTENDED = "EXTENDED", "Gave an extension"
        EXTENSION_REMOVED = "EXTENSION_REMOVED", "Removed an extension"
        REMINDED = "REMINDED", "Reminded"

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="changes")
    action = models.CharField(max_length=24, choices=Action.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    actor_name = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Submission history cannot be changed.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Submission history cannot be deleted.")


ACTIVE_DOCUMENT = Q(archived_at__isnull=True)
