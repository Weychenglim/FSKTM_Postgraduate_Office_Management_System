from django.contrib import admin

from .models import Announcement, Notification, DeadlineEmailDelivery, DeadlineReminderRun


class InspectionOnlyAdmin(admin.ModelAdmin):
    """Announcements are published, edited and withdrawn in the portal, which
    validates attachments and keeps recipients' notifications in step."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Announcement)
class AnnouncementAdmin(InspectionOnlyAdmin):
    list_display = ("title", "target", "priority", "status", "created_by_name", "created_at")
    list_filter = ("status", "priority", "target")
    search_fields = ("title", "content", "created_by_name")
    readonly_fields = ("attachment_file", "created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("title", "content", "target", "also_targets", "priority", "status")}),
        ("Schedule and targeting", {"fields": ("publish_at", "expires_at", "target_programmes", "target_intakes", "target_students")}),
        ("Attachment", {"fields": ("attachment_file",)}),
        ("Audit", {"fields": ("created_by", "created_by_name", "created_at", "updated_at")}),
    )

    @admin.display(description="Attachment")
    def attachment_file(self, obj):
        # Files are private; the raw media link would not resolve, so show the name.
        return obj.attachment_name or "-"


@admin.register(Notification)
class NotificationAdmin(InspectionOnlyAdmin):
    list_display = ("title", "recipient", "priority", "is_read", "is_announcement", "created_at")
    list_filter = ("is_read", "is_announcement", "priority", "module_label")
    search_fields = ("title", "summary", "message", "recipient__email")
    readonly_fields = ("created_at",)
    autocomplete_fields = ()


@admin.register(DeadlineReminderRun)
class DeadlineReminderRunAdmin(InspectionOnlyAdmin):
    list_display = ('started_at', 'completed_at', 'timeline_count', 'marks_count', 'operation_count', 'email_failed', 'error')


@admin.register(DeadlineEmailDelivery)
class DeadlineEmailDeliveryAdmin(InspectionOnlyAdmin):
    list_display = ('notification', 'attempts', 'next_attempt_at', 'delivered_at', 'last_error')
