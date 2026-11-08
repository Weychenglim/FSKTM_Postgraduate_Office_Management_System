from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class SemesterTimeline(models.Model):
    academic_semester = models.ForeignKey(
        "academics.AcademicSemester",
        on_delete=models.PROTECT,
        related_name="timelines",
        null=True,
        blank=True,
    )
    semester = models.CharField(max_length=128)
    session = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True, db_index=True)
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    content_digest = models.CharField(max_length=64, blank=True)
    source_filename = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_semester_timelines",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    replaced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-uploaded_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["academic_semester"],
                condition=Q(is_published=True, academic_semester__isnull=False),
                name="one_published_timeline_per_semester"),
            models.CheckConstraint(condition=Q(is_active=False) | Q(is_published=False),
                name="published_timeline_is_snapshot"),
            models.UniqueConstraint(
                fields=["academic_semester"],
                condition=Q(
                    is_active=True,
                    academic_semester__isnull=False,
                ),
                name="one_current_timeline_per_semester",
            )
        ]

    def __str__(self):
        return f"{self.semester} {self.session}"


class SemesterTimelineEntry(models.Model):
    # Stable reminder identity across publication copies, including deleted draft rows.
    source_entry_id = models.PositiveBigIntegerField(null=True, blank=True, editable=False)
    class Level(models.TextChoices):
        P1 = "P1", "Research Project (P1)"
        P2 = "P2", "Research Project (P2)"

    class Status(models.TextChoices):
        ENDED = "Ended", "Ended"
        ACTIVE = "Active", "Active"
        DEADLINE = "Deadline", "Deadline"
        UPCOMING = "Upcoming", "Upcoming"

    VALID_TARGET_ROLES = {"STUDENT", "LECTURER", "OFFICE_STAFF"}

    timeline = models.ForeignKey(
        SemesterTimeline,
        on_delete=models.CASCADE,
        related_name="entries",
    )
    operational_period = models.ForeignKey(
        "academics.OperationalPeriod", on_delete=models.PROTECT,
        related_name="timeline_entries", null=True, blank=True,
    )
    marks_period = models.ForeignKey(
        "marks.EvaluationPeriod", on_delete=models.PROTECT,
        related_name="timeline_entries", null=True, blank=True,
    )
    level = models.CharField(max_length=2, choices=Level.choices, db_index=True)
    step = models.PositiveIntegerField()
    title = models.CharField(max_length=255, blank=True)
    detail = models.TextField()
    action_owner = models.CharField(max_length=255)
    deadline_start = models.DateField()
    deadline_end = models.DateField()
    week_label = models.CharField(max_length=64, blank=True)
    target_roles = models.JSONField(default=list)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UPCOMING)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "level", "step", "deadline_start", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["timeline", "level", "step"],
                name="unique_step_per_timeline_level",
            ),
            models.CheckConstraint(
                condition=Q(operational_period__isnull=True) | Q(marks_period__isnull=True),
                name="timeline_entry_one_period_link",
            )
        ]

    def clean(self):
        super().clean()
        if self.operational_period_id and self.marks_period_id:
            raise ValidationError("A timeline entry can link to only one period.")
        for period in (self.operational_period, self.marks_period):
            if period and period.academic_semester_id != self.timeline.academic_semester_id:
                raise ValidationError("The period must belong to the timeline semester.")

    @property
    def linked_period(self):
        return self.operational_period or self.marks_period

    @property
    def projected_dates(self):
        from zoneinfo import ZoneInfo
        period = self.linked_period
        if period and period.opens_at and period.closes_at:
            malaysia = ZoneInfo("Asia/Kuala_Lumpur")
            return (period.opens_at.astimezone(malaysia).date(),
                    period.closes_at.astimezone(malaysia).date())
        return self.deadline_start, self.deadline_end

    def __str__(self):
        return f"{self.timeline}: {self.level} step {self.step}"


class TimelineAuditLog(models.Model):
    class Action(models.TextChoices):
        UPLOAD = "UPLOAD", "Upload"
        REPLACE = "REPLACE", "Replace"
        ADD_ENTRY = "ADD_ENTRY", "Add Entry"
        EDIT_ENTRY = "EDIT_ENTRY", "Edit Entry"
        DELETE_ENTRY = "DELETE_ENTRY", "Delete Entry"
        EXTEND = "EXTEND", "Extend event"
        PUBLISH = "PUBLISH", "Publish calendar"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dashboard_timeline_audit_logs",
    )
    timeline = models.ForeignKey(
        SemesterTimeline,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    entry = models.ForeignKey(
        SemesterTimelineEntry,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    summary = models.CharField(max_length=500)
    reason = models.TextField(blank=True)
    before_values = models.JSONField(default=dict)
    after_values = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.action}: {self.summary}"


class WorkflowReconciliationAudit(models.Model):
    """Append-only record of an Office-authorized review or data repair."""

    issue_type = models.CharField(max_length=64, db_index=True)
    entity_type = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=64)
    action = models.CharField(max_length=64)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="workflow_reconciliation_audits",
    )
    reason = models.TextField()
    fingerprint = models.CharField(max_length=64)
    before_values = models.JSONField(default=dict)
    after_values = models.JSONField(default=dict)
    affected_records = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [models.UniqueConstraint(
            fields=["issue_type", "entity_type", "entity_id", "fingerprint"],
            condition=Q(action="ACCEPT_INTENTIONAL"), name="reconcile_accept_evidence_unique",
        )]
        indexes = [
            models.Index(
                fields=["entity_type", "entity_id"],
                name="reconcile_entity_idx",
            )
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Workflow reconciliation audits are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Workflow reconciliation audits are immutable.")
