"""The FAQ knowledge base behind the chatbot (UC28, UC29).

Students only ever see Published entries. Entries imported from the office's
FAQ PDF that came out damaged wait as Needs checking until the office fixes
them.
"""
import uuid
from pathlib import PurePosixPath

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class FaqCategory(models.Model):
    name = models.CharField(max_length=80, unique=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "name"]
        verbose_name = "FAQ category"
        verbose_name_plural = "FAQ categories"

    def __str__(self):
        return self.name


class FaqEntryQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=FaqEntry.Status.PUBLISHED)


class FaqEntry(models.Model):
    class Status(models.TextChoices):
        PUBLISHED = "PUBLISHED", "Published"
        DRAFT = "DRAFT", "Draft"
        NEEDS_CHECKING = "NEEDS_CHECKING", "Needs checking"
        ARCHIVED = "ARCHIVED", "Archived"

    # A button under the answer that opens part of the portal.
    class PortalLink(models.TextChoices):
        SUPERVISOR_APPOINTMENTS = "SUPERVISOR_APPOINTMENTS", "Open Supervisor Appointments"
        PANEL_APPOINTMENTS = "PANEL_APPOINTMENTS", "Open Panel Appointments"
        LETTERS = "LETTERS", "Open Letter Generation"
        FILES = "FILES", "Open File Submission"
        ANNOUNCEMENTS = "ANNOUNCEMENTS", "Open Announcements"

    question = models.CharField(max_length=500, blank=True)
    answer = models.TextField(blank=True)
    category = models.ForeignKey(FaqCategory, on_delete=models.PROTECT, related_name="entries")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    portal_link = models.CharField(max_length=32, choices=PortalLink.choices, blank=True)
    position = models.PositiveIntegerField(default=0)
    # Where an imported entry came from, so the import never makes it twice,
    # and the PDF's own text for the office to compare while checking it.
    source_ref = models.CharField(max_length=80, unique=True, null=True, blank=True)
    source_text = models.TextField(blank=True)
    source_note = models.CharField(max_length=255, blank=True)
    source_page = models.PositiveIntegerField(null=True, blank=True)
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checked_faq_entries",
    )
    checked_at = models.DateTimeField(null=True, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_faq_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = FaqEntryQuerySet.as_manager()

    class Meta:
        ordering = ["category__position", "position", "pk"]
        verbose_name = "FAQ entry"
        verbose_name_plural = "FAQ entries"

    def __str__(self):
        return self.question or f"FAQ entry {self.pk}"


class FaqAltQuestion(models.Model):
    """Another way students ask the same thing."""

    entry = models.ForeignKey(FaqEntry, on_delete=models.CASCADE, related_name="alt_questions")
    text = models.CharField(max_length=500)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="faq_alt_questions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "pk"]
        constraints = [
            models.UniqueConstraint(Lower("text"), "entry", name="unique_faq_alt_question_per_entry")
        ]

    def __str__(self):
        return self.text


class FaqChange(models.Model):
    """The history of the knowledge base. Rows are never changed or deleted,
    and keep the question as text after an entry is deleted."""

    class Action(models.TextChoices):
        IMPORTED = "IMPORTED", "Imported from the FAQ PDF"
        CREATED = "CREATED", "Created"
        EDITED = "EDITED", "Edited"
        PUBLISHED = "PUBLISHED", "Published"
        CHECKED = "CHECKED", "Marked as checked"
        ARCHIVED = "ARCHIVED", "Archived"
        RESTORED = "RESTORED", "Restored as a draft"
        DELETED = "DELETED", "Deleted"
        DOCUMENT_ADDED = "DOCUMENT_ADDED", "Document uploaded"
        DOCUMENT_REPLACED = "DOCUMENT_REPLACED", "Document replaced"
        DOCUMENT_RENAMED = "DOCUMENT_RENAMED", "Document renamed"
        DOCUMENT_ARCHIVED = "DOCUMENT_ARCHIVED", "Document archived"
        DOCUMENT_RESTORED = "DOCUMENT_RESTORED", "Document restored"

    entry = models.ForeignKey(FaqEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name="changes")
    document = models.ForeignKey("FaqDocument", on_delete=models.SET_NULL, null=True, blank=True, related_name="changes")
    question = models.CharField(max_length=500, blank=True)
    action = models.CharField(max_length=20, choices=Action.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="faq_changes",
    )
    actor_name = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("FAQ history cannot be changed.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("FAQ history cannot be deleted.")


DEFAULT_CONTACT_TEXT = (
    "Please contact the FSKTM Postgraduate Office. Visit the counter during office hours, "
    "or email the office with your question and your matric number."
)


class FaqSettings(models.Model):
    """The office's chatbot settings. There is only ever one row."""

    contact_text = models.TextField(default=DEFAULT_CONTACT_TEXT)
    common_questions = models.JSONField(default=list, blank=True)
    # AI replies on top of the search. Off until the office turns them on. The
    # database defaults let the code from before AI replies keep working here.
    ai_enabled = models.BooleanField(default=False, db_default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="faq_settings_changes",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "FAQ chatbot settings"
        verbose_name_plural = "FAQ chatbot settings"

    @classmethod
    def load(cls):
        found, _ = cls.objects.get_or_create(pk=1)
        return found


class FaqVector(models.Model):
    """A text's meaning as numbers, kept so a restart does not work them out
    again. Found by the model and a fingerprint of the text."""

    model_name = models.CharField(max_length=200)
    fingerprint = models.CharField(max_length=64)
    dimensions = models.PositiveIntegerField()
    vector = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["model_name", "fingerprint"], name="unique_faq_vector")]


class FaqQuestion(models.Model):
    """A question asked in the chatbot. It keeps no name and no student ID,
    and is deleted after 12 months (purge_faq_questions)."""

    class Outcome(models.TextChoices):
        ANSWERED = "ANSWERED", "Answered"
        CHOICES = "CHOICES", "Offered choices"
        DOCUMENT = "DOCUMENT", "Answered from a document"
        NO_MATCH = "NO_MATCH", "No match"

    class Review(models.TextChoices):
        WAITING = "WAITING", "Waiting"
        ADDED = "ADDED", "Added as another way to ask"
        CREATED = "CREATED", "Entry created"
        DISMISSED = "DISMISSED", "Dismissed"

    class AiStatus(models.TextChoices):
        USED = "USED", "AI reply shown"
        NOT_COVERED = "NOT_COVERED", "AI said the FAQ does not cover it"
        REJECTED = "REJECTED", "AI reply failed a check"
        UNAVAILABLE = "UNAVAILABLE", "AI not available"

    text = models.CharField(max_length=300)
    typed = models.BooleanField(default=True)
    outcome = models.CharField(max_length=16, choices=Outcome.choices)
    entry = models.ForeignKey(FaqEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name="asked")
    document = models.ForeignKey("FaqDocument", on_delete=models.SET_NULL, null=True, blank=True, related_name="asked")
    score = models.FloatField(null=True, blank=True)
    search_mode = models.CharField(max_length=16, blank=True)
    helpful = models.BooleanField(null=True, blank=True)
    review = models.CharField(max_length=16, choices=Review.choices, default=Review.WAITING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_faq_questions",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    ai_status = models.CharField(max_length=16, choices=AiStatus.choices, blank=True, default="", db_default="")
    ai_answer = models.TextField(blank=True, default="", db_default="")
    ai_model = models.CharField(max_length=80, blank=True, default="", db_default="")
    # The question before this one in the same chat, for follow-ups.
    follows = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    asked_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-asked_at", "-pk"]


def document_path(instance, filename):
    now = timezone.localtime()
    return f"faq/{now:%Y}/{now:%m}/{uuid.uuid4().hex}{PurePosixPath(filename).suffix.lower()}"


class FaqDocument(models.Model):
    """A reference document the office uploaded (a handbook, a guide). When
    no FAQ entry fits, the chatbot can show a passage from it, labelled as
    an extract."""

    class Status(models.TextChoices):
        READY = "READY", "Ready"
        NO_TEXT = "NO_TEXT", "No text found"

    title = models.CharField(max_length=200)
    file = models.FileField(upload_to=document_path, max_length=255)
    original_name = models.CharField(max_length=150)
    kind = models.CharField(max_length=8)
    content_type = models.CharField(max_length=128)
    size = models.PositiveBigIntegerField()
    page_count = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices)
    archived = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="faq_documents",
    )
    uploaded_by_name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-uploaded_at", "-pk"]
        verbose_name = "FAQ reference document"

    def __str__(self):
        return self.title


class FaqPassage(models.Model):
    """About 150 words of a document, with the page it came from."""

    document = models.ForeignKey(FaqDocument, on_delete=models.CASCADE, related_name="passages")
    position = models.PositiveIntegerField()
    page = models.PositiveIntegerField(null=True, blank=True)
    text = models.TextField()

    class Meta:
        ordering = ["document", "position"]
