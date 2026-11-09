from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, Sum
from django.utils.text import slugify
from django.utils import timezone


class Rubric(models.Model):
    name = models.CharField(max_length=255)
    code = models.SlugField(max_length=64, unique=True)
    family_code = models.SlugField(max_length=64, default="")
    version = models.PositiveIntegerField(default=1)
    target_mark = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("100.00"),
    )
    supersedes = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="newer_versions",
        null=True,
        blank=True,
    )
    allowed_evaluator_roles = models.JSONField(default=list, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["family_code", "version"],
                name="unique_rubric_family_version",
            ),
            models.CheckConstraint(
                condition=Q(target_mark__gt=0),
                name="rubric_target_mark_positive",
            ),
        ]

    def __str__(self):
        return f"{self.name} v{self.version}"

    def save(self, *args, **kwargs):
        if not self.family_code:
            self.family_code = slugify(self.code or self.name)[:64]
        super().save(*args, **kwargs)

    @property
    def maximum_mark(self):
        return self.component_total

    @property
    def component_total(self):
        return self.components.filter(is_active=True).aggregate(
            total=Sum("max_marks")
        )["total"] or Decimal("0.00")

    @property
    def is_ready(self):
        return (
            self.components.filter(is_active=True).exists()
            and self.component_total == self.target_mark
        )

    @property
    def is_locked(self):
        return (
            self.evaluation_periods.exclude(
                lifecycle_status=EvaluationPeriod.Lifecycle.DRAFT
            ).exists()
            or self.evaluation_periods.filter(tasks__isnull=False).exists()
        )


class RubricComponent(models.Model):
    rubric = models.ForeignKey(
        Rubric,
        on_delete=models.CASCADE,
        related_name="components",
    )
    code = models.SlugField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    max_marks = models.DecimalField(max_digits=7, decimal_places=2)
    is_required = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["rubric", "code"],
                name="unique_component_code_per_rubric",
            ),
            models.CheckConstraint(
                condition=Q(max_marks__gt=0),
                name="rubric_component_max_marks_positive",
            ),
            models.UniqueConstraint(
                fields=["rubric", "display_order"],
                condition=Q(is_active=True),
                name="unique_active_component_order_per_rubric",
            ),
        ]

    def __str__(self):
        return f"{self.rubric.code}: {self.name}"


def default_evaluator_roles():
    return ["SUPERVISOR", "PANEL"]


class EvaluationPeriod(models.Model):
    class Lifecycle(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"
        CLOSED = "CLOSED", "Closed"
        ARCHIVED = "ARCHIVED", "Archived"

    name = models.CharField(max_length=255)
    assessment = models.CharField(max_length=2, choices=[("P1", "P1"), ("P2", "P2")], blank=True, default="")
    semester = models.CharField(max_length=128)
    programme_scope = models.CharField(
        max_length=8, choices=[("ALL", "All programmes"), ("SELECTED", "Selected programmes")],
        default="ALL",
    )
    programmes = models.JSONField(default=list, blank=True)
    evaluator_roles = models.JSONField(default=default_evaluator_roles)
    academic_semester = models.ForeignKey(
        "academics.AcademicSemester",
        on_delete=models.PROTECT,
        related_name="evaluation_periods",
        null=True,
        blank=True,
    )
    rubric = models.ForeignKey(
        Rubric,
        on_delete=models.PROTECT,
        related_name="evaluation_periods",
    )
    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    lifecycle_status = models.CharField(
        max_length=16,
        choices=Lifecycle.choices,
        default=Lifecycle.DRAFT,
        db_index=True,
    )
    is_open = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.semester})"

    def save(self, *args, **kwargs):
        if (
            self._state.adding
            and self.is_open
            and self.lifecycle_status == self.Lifecycle.DRAFT
        ):
            self.lifecycle_status = self.Lifecycle.PUBLISHED
        self.is_open = self.lifecycle_status == self.Lifecycle.PUBLISHED
        update_fields = kwargs.get("update_fields")
        if update_fields and "lifecycle_status" in update_fields:
            kwargs["update_fields"] = set(update_fields) | {"is_open"}
        super().save(*args, **kwargs)

    def status_at(self, now=None):
        now = now or timezone.now()
        if self.lifecycle_status == self.Lifecycle.ARCHIVED:
            return "ARCHIVED"
        if self.lifecycle_status == self.Lifecycle.CLOSED:
            return "CLOSED"
        if self.lifecycle_status == self.Lifecycle.DRAFT:
            return "DRAFT"
        if self.opens_at and now < self.opens_at:
            return "SCHEDULED"
        if self.closes_at and now > self.closes_at:
            return "CLOSED"
        return "OPEN"

    @property
    def effective_status(self):
        return self.status_at()

    @property
    def accepts_submissions(self):
        return (
            self.effective_status == "OPEN"
            and self.academic_semester_id is not None
            and self.academic_semester.is_active
        )


class MarksConfigurationAudit(models.Model):
    class EntityType(models.TextChoices):
        RUBRIC = "RUBRIC", "Rubric"
        PERIOD = "PERIOD", "Evaluation period"

    entity_type = models.CharField(max_length=16, choices=EntityType.choices)
    entity_id = models.PositiveBigIntegerField()
    action = models.CharField(max_length=32)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="marks_configuration_audits",
    )
    reason = models.TextField(blank=True)
    before_values = models.JSONField(default=dict)
    after_values = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["entity_type", "entity_id"],
                name="marks_config_entity_idx",
            )
        ]


class EvaluationTask(models.Model):
    class Lifecycle(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        PAUSED = "PAUSED", "Paused"
        RETIRED = "RETIRED", "Retired"

    class EvaluatorRole(models.TextChoices):
        SUPERVISOR = "SUPERVISOR", "Supervisor"
        PANEL = "PANEL", "Panel"
        BACKUP = "BACKUP", "Backup / Manual Override"

    profile = models.ForeignKey(
        "appointments.StudentResearchProfile",
        on_delete=models.PROTECT,
        related_name="evaluation_tasks",
    )
    evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evaluation_tasks",
    )
    period = models.ForeignKey(
        EvaluationPeriod,
        on_delete=models.PROTECT,
        related_name="tasks",
    )
    evaluator_role = models.CharField(
        max_length=16,
        choices=EvaluatorRole.choices,
        default=EvaluatorRole.PANEL,
        db_index=True,
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assigned_evaluation_tasks",
        null=True,
        blank=True,
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    lifecycle_status = models.CharField(
        max_length=16,
        choices=Lifecycle.choices,
        default=Lifecycle.ACTIVE,
        db_index=True,
    )
    retired_at = models.DateTimeField(null=True, blank=True)
    retired_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="retired_evaluation_tasks",
        null=True,
        blank=True,
    )
    retirement_reason = models.TextField(blank=True)
    paused_at = models.DateTimeField(null=True, blank=True)
    paused_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="paused_evaluation_tasks",
        null=True,
        blank=True,
    )
    pause_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["profile__student_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "evaluator", "period", "evaluator_role"],
                condition=Q(lifecycle_status="ACTIVE"),
                name="unique_evaluation_task_assignment",
            )
        ]

    def __str__(self):
        return (
            f"{self.profile.matric_no} evaluated by {self.evaluator} "
            f"({self.evaluator_role})"
        )


class CompletionHistoryQuerySet(models.QuerySet):
    def update(self, **kwargs):
        from django.core.exceptions import ValidationError
        raise ValidationError("Completion history is immutable; use audited services.")

    def delete(self):
        from django.core.exceptions import ValidationError
        raise ValidationError("Completion history cannot be deleted.")

    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False,
                    update_conflicts=False, update_fields=None, unique_fields=None):
        from django.core.exceptions import ValidationError
        if update_conflicts:
            raise ValidationError("Completion history cannot be overwritten.")
        return super().bulk_create(objs, batch_size=batch_size,
                                  ignore_conflicts=ignore_conflicts)


class TaskCompletionWindow(models.Model):
    """Grant facts are immutable; termination is recorded once with an audit event."""
    task = models.ForeignKey(EvaluationTask, on_delete=models.PROTECT, related_name="completion_windows")
    deadline = models.DateTimeField()
    reason = models.TextField()
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="completion_window_grants")
    created_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    end_kind = models.CharField(max_length=16, blank=True)
    ended_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="completion_window_endings")
    end_reason = models.TextField(blank=True)
    supersedes = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True)
    objects = CompletionHistoryQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [models.UniqueConstraint(fields=["task"], condition=Q(ended_at__isnull=True), name="one_current_completion_window")]

    def save(self, *args, **kwargs):
        if self.pk:
            from django.core.exceptions import ValidationError
            raise ValidationError("Completion window records are immutable; use audited services.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        raise ValidationError("Completion window records cannot be deleted.")


class TaskCompletionWindowAudit(models.Model):
    objects = CompletionHistoryQuerySet.as_manager()
    window = models.ForeignKey(TaskCompletionWindow, on_delete=models.PROTECT, related_name="events")
    action = models.CharField(max_length=16)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    reason = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):
        if self.pk:
            from django.core.exceptions import ValidationError
            raise ValidationError("Completion window events are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        raise ValidationError("Completion window events are immutable.")


class EvaluationTaskOverrideAudit(models.Model):
    task = models.ForeignKey(
        EvaluationTask,
        on_delete=models.PROTECT,
        related_name="override_audits",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evaluation_task_override_audits",
    )
    original_evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evaluation_task_overrides_replaced",
        null=True,
        blank=True,
    )
    new_evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evaluation_task_overrides_received",
    )
    reason = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]


class EvaluationTaskLifecycleAudit(models.Model):
    class Action(models.TextChoices):
        PAUSED = "PAUSED", "Paused"
        RESUMED = "RESUMED", "Resumed"
        RETIRED = "RETIRED", "Retired"

    task = models.ForeignKey(
        EvaluationTask,
        on_delete=models.PROTECT,
        related_name="lifecycle_audits",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evaluation_task_lifecycle_audits",
    )
    action = models.CharField(max_length=16, choices=Action.choices)
    reason = models.TextField()
    entry_snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs):
        if self.pk:
            from django.core.exceptions import ValidationError

            raise ValidationError("Evaluation task lifecycle audits are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError

        raise ValidationError("Evaluation task lifecycle audits are immutable.")


class EvaluationTaskHandoverAudit(models.Model):
    """Immutable snapshot produced when an official evaluator appointment ends."""

    task = models.ForeignKey(
        EvaluationTask,
        on_delete=models.PROTECT,
        related_name="handover_audits",
    )
    replacement_task = models.ForeignKey(
        EvaluationTask,
        on_delete=models.PROTECT,
        related_name="replacement_handover_audits",
        null=True,
        blank=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evaluation_task_handover_audits",
    )
    reason = models.TextField()
    draft_snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs):
        if self.pk:
            from django.core.exceptions import ValidationError

            raise ValidationError("Evaluation task handover audits are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError

        raise ValidationError("Evaluation task handover audits are immutable.")


class MarkEntry(models.Model):
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not Started"
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"

    task = models.OneToOneField(
        EvaluationTask,
        on_delete=models.CASCADE,
        related_name="mark_entry",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.NOT_STARTED,
        db_index=True,
    )
    total_mark = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    comments = models.TextField(blank=True)
    submitted_due_recorded = models.BooleanField(default=False)
    submitted_due_at = models.DateTimeField(null=True, blank=True)
    submitted_completion_window = models.ForeignKey(TaskCompletionWindow, on_delete=models.PROTECT, null=True, blank=True, related_name="submissions")
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    @property
    def is_locked(self):
        return self.status == self.Status.SUBMITTED

    def recalculate_total(self, save=True):
        total = self.scores.aggregate(total=Sum("marks_awarded"))["total"] or Decimal(
            "0.00"
        )
        self.total_mark = total
        if save:
            self.save(update_fields=["total_mark", "updated_at"])
        return total


class MarkScore(models.Model):
    entry = models.ForeignKey(
        MarkEntry,
        on_delete=models.CASCADE,
        related_name="scores",
    )
    component = models.ForeignKey(
        RubricComponent,
        on_delete=models.PROTECT,
        related_name="scores",
    )
    marks_awarded = models.DecimalField(max_digits=7, decimal_places=2)
    feedback = models.TextField(blank=True)

    class Meta:
        ordering = ["component__display_order", "component_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["entry", "component"],
                name="unique_score_per_entry_component",
            ),
            models.CheckConstraint(
                condition=Q(marks_awarded__gte=0),
                name="mark_score_non_negative",
            ),
        ]

    def clean(self):
        super().clean()
        if self.marks_awarded > self.component.max_marks:
            from django.core.exceptions import ValidationError

            raise ValidationError(
                {
                    "marks_awarded": (
                        f"Marks cannot exceed {self.component.max_marks} "
                        f"for {self.component.name}."
                    )
                }
            )


class SubmissionReceiptQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError('Submission receipts are immutable.')

    def delete(self):
        raise ValidationError('Submission receipts cannot be deleted.')

    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False,
                    update_conflicts=False, update_fields=None, unique_fields=None):
        if update_conflicts:
            raise ValidationError('Submission receipts cannot be overwritten.')
        return super().bulk_create(objs, batch_size=batch_size, ignore_conflicts=ignore_conflicts)


class MarkSubmissionReceipt(models.Model):
    task = models.ForeignKey(EvaluationTask, on_delete=models.PROTECT, related_name='submission_receipts')
    submission_id = models.UUIDField()
    request_hash = models.CharField(max_length=64)
    entry_version = models.CharField(max_length=64)
    created_at = models.DateTimeField(default=timezone.now)
    objects = SubmissionReceiptQuerySet.as_manager()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['task', 'submission_id'], name='unique_mark_submission_receipt')]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError('Submission receipts are immutable.')
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Submission receipts are immutable.')


class MarkCorrectionAudit(models.Model):
    class Action(models.TextChoices):
        CORRECT = "CORRECT", "Correct submitted marks"
        REOPEN = "REOPEN", "Reopen submitted marks"

    entry = models.ForeignKey(
        MarkEntry,
        on_delete=models.PROTECT,
        related_name="correction_audits",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="mark_correction_audits",
    )
    action = models.CharField(max_length=16, choices=Action.choices)
    reason = models.TextField()
    before_values = models.JSONField()
    after_values = models.JSONField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
