from django.contrib import admin

from .models import (
    EvaluationPeriod,
    EvaluationTask,
    EvaluationTaskHandoverAudit,
    EvaluationTaskLifecycleAudit,
    MarkCorrectionAudit,
    MarkEntry,
    MarkScore,
    MarksConfigurationAudit,
    Rubric,
    RubricComponent,
)


class ReadOnlyMarksAdmin(admin.ModelAdmin):
    """Configuration, assignments and history are governed by portal services."""

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class RubricComponentInline(admin.TabularInline):
    model = RubricComponent
    extra = 0
    readonly_fields = (
        "code",
        "name",
        "description",
        "max_marks",
        "is_required",
        "is_active",
        "display_order",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Rubric)
class RubricAdmin(ReadOnlyMarksAdmin):
    list_display = (
        "code",
        "name",
        "version",
        "maximum_mark",
        "target_mark",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    inlines = [RubricComponentInline]
    readonly_fields = (
        "name",
        "code",
        "family_code",
        "version",
        "target_mark",
        "supersedes",
        "description",
        "is_active",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(EvaluationPeriod)
class EvaluationPeriodAdmin(ReadOnlyMarksAdmin):
    list_display = (
        "name",
        "semester",
        "rubric",
        "lifecycle_status",
        "opens_at",
        "closes_at",
    )
    list_filter = ("lifecycle_status", "semester")
    search_fields = ("name", "semester")
    readonly_fields = (
        "name",
        "semester",
        "programme_scope",
        "programmes",
        "evaluator_roles",
        "rubric",
        "opens_at",
        "closes_at",
        "lifecycle_status",
        "is_open",
        "published_at",
        "closed_at",
        "archived_at",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MarksConfigurationAudit)
class MarksConfigurationAuditAdmin(ReadOnlyMarksAdmin):
    list_display = (
        "entity_type",
        "entity_id",
        "action",
        "actor",
        "created_at",
    )
    list_filter = ("entity_type", "action")
    search_fields = ("actor__full_name", "reason")
    readonly_fields = (
        "entity_type",
        "entity_id",
        "action",
        "actor",
        "reason",
        "before_values",
        "after_values",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(EvaluationTask)
class EvaluationTaskAdmin(ReadOnlyMarksAdmin):
    list_display = (
        "profile",
        "evaluator",
        "evaluator_role",
        "period",
        "lifecycle_status",
        "assigned_at",
    )
    list_filter = ("period", "evaluator_role", "lifecycle_status")
    search_fields = (
        "profile__matric_no",
        "profile__student_name",
        "evaluator__full_name",
    )
    readonly_fields = (
        "lifecycle_status",
        "paused_at",
        "paused_by",
        "pause_reason",
        "retired_at",
        "retired_by",
        "retirement_reason",
    )


@admin.register(EvaluationTaskLifecycleAudit)
class EvaluationTaskLifecycleAuditAdmin(ReadOnlyMarksAdmin):
    list_display = ("task", "action", "actor", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("task__profile__matric_no", "actor__full_name", "reason")
    readonly_fields = (
        "task",
        "action",
        "actor",
        "reason",
        "entry_snapshot",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(EvaluationTaskHandoverAudit)
class EvaluationTaskHandoverAuditAdmin(ReadOnlyMarksAdmin):
    list_display = ("task", "replacement_task", "actor", "created_at")
    readonly_fields = (
        "task",
        "replacement_task",
        "actor",
        "reason",
        "draft_snapshot",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class MarkScoreInline(admin.TabularInline):
    model = MarkScore
    extra = 0
    readonly_fields = ("component", "marks_awarded", "feedback")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(MarkEntry)
class MarkEntryAdmin(ReadOnlyMarksAdmin):
    inlines = [MarkScoreInline]
    list_display = ("task", "status", "total_mark", "submitted_at", "updated_at")
    list_filter = ("status", "task__period")
    search_fields = (
        "task__profile__matric_no",
        "task__profile__student_name",
        "task__evaluator__full_name",
    )


@admin.register(MarkCorrectionAudit)
class MarkCorrectionAuditAdmin(ReadOnlyMarksAdmin):
    list_display = ("entry", "action", "actor", "reason", "created_at")
    list_filter = ("action",)
    search_fields = (
        "entry__task__profile__matric_no",
        "actor__full_name",
        "reason",
    )
    readonly_fields = (
        "entry",
        "action",
        "actor",
        "reason",
        "before_values",
        "after_values",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
