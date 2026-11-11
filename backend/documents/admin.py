from django import forms
from django.contrib import admin
from django.utils.text import slugify

from .models import Document, DocumentEvent, DocumentType, DocumentVersion


class DocumentTypeForm(forms.ModelForm):
    uploaders = forms.MultipleChoiceField(
        choices=[(role, role.title()) for role in DocumentType.UPLOADERS],
        widget=forms.CheckboxSelectMultiple,
        required=False,
    )
    allowed_kinds = forms.MultipleChoiceField(
        choices=[(kind, kind) for kind in DocumentType.FILE_KINDS],
        widget=forms.CheckboxSelectMultiple,
    )

    class Meta:
        model = DocumentType
        fields = (
            "label", "description", "group", "kind", "uploaders", "allowed_kinds",
            "share_supervisors", "share_panel", "share_coordinator", "one_per_student",
            "is_active", "display_order",
        )

    def clean_label(self):
        label = " ".join(self.cleaned_data["label"].split())
        if DocumentType.objects.filter(label__iexact=label).exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError("There is already a type with this name.")
        return label


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
class DocumentTypeAdmin(admin.ModelAdmin):
    """The Technical Admin keeps the list of types. Switch one off instead of deleting it."""

    form = DocumentTypeForm
    list_display = ("label", "group", "kind", "display_order", "is_active")
    list_filter = ("group", "kind", "is_active")
    search_fields = ("label", "code")
    ordering = ("display_order", "label")

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if not obj.code:
            base = slugify(obj.label)[:56] or "type"
            code, number = base, 2
            while DocumentType.objects.filter(code=code).exists():
                code, number = f"{base}-{number}", number + 1
            obj.code = code
        super().save_model(request, obj, form, change)


@admin.register(Document)
class DocumentAdmin(InspectOnly):
    list_display = ("reference", "title", "doc_type", "uploaded_by", "created_at")
    list_filter = ("is_staff_file", "doc_type")
    search_fields = ("reference", "title", "student_links__student__matric_no")


@admin.register(DocumentVersion)
class DocumentVersionAdmin(InspectOnly):
    list_display = ("document", "number", "original_name", "kind", "size", "uploaded_at")


@admin.register(DocumentEvent)
class DocumentEventAdmin(InspectOnly):
    list_display = ("reference", "action", "actor_name", "created_at")
    list_filter = ("action",)
    search_fields = ("reference", "title", "actor_name")

