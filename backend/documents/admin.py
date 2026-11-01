from django.contrib import admin

from .models import Document, DocumentEvent, DocumentType, DocumentVersion


class InspectOnly(admin.ModelAdmin):
    """Inspection only: files are uploaded, shared and archived in the portal,
    which checks every file and keeps the history."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DocumentType)
class DocumentTypeAdmin(InspectOnly):
    list_display = ("label", "group", "kind", "needs_check", "is_active")
    list_filter = ("group", "kind", "is_active")
    search_fields = ("label", "code")


@admin.register(Document)
class DocumentAdmin(InspectOnly):
    list_display = ("reference", "title", "doc_type", "uploaded_by", "check_status", "created_at")
    list_filter = ("check_status", "is_staff_file", "doc_type")
    search_fields = ("reference", "title", "student_links__student__matric_no")


@admin.register(DocumentVersion)
class DocumentVersionAdmin(InspectOnly):
    list_display = ("document", "number", "original_name", "kind", "size", "uploaded_at")


@admin.register(DocumentEvent)
class DocumentEventAdmin(InspectOnly):
    list_display = ("reference", "action", "actor_name", "created_at")
    list_filter = ("action",)
    search_fields = ("reference", "title", "actor_name")

