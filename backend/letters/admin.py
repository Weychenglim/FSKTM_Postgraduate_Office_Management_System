from django.contrib import admin

from .models import GeneratedLetter, LetterTemplate


@admin.register(LetterTemplate)
class LetterTemplateAdmin(admin.ModelAdmin):
    """Inspection only: templates are edited in the portal, where placeholders
    are validated and archiving rules apply."""

    list_display = ("name", "purpose", "letter_type", "status", "modified_by", "updated_at")
    list_filter = ("status", "purpose", "letter_type")
    search_fields = ("name", "description", "content")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("name", "purpose", "letter_type", "status", "description")}),
        ("Body", {"fields": ("content", "reference_prefix", "signatory_name", "signatory_title", "signatory_name_ms", "signatory_title_ms")}),
        ("Audit", {"fields": ("modified_by", "created_at", "updated_at")}),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(GeneratedLetter)
class GeneratedLetterAdmin(admin.ModelAdmin):
    """Inspection only: letters are issued, resent and revoked in the portal,
    which keeps the reference numbers and notifications consistent."""

    list_display = ("reference_number", "template_name", "purpose", "student", "status", "issued_on")
    list_filter = ("status", "purpose", "letter_type", "issued_on")
    search_fields = ("reference_number", "template_name", "student__matric_no")
    readonly_fields = ("created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
