"""The office's settings for File Management: document types (UC26)."""
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils.text import slugify

from .models import Document, DocumentType, SettingsChange

KIND_UPLOADERS = {
    DocumentType.Kind.STUDENT: ("STUDENT", "SUPERVISOR", "PANEL", "COORDINATOR"),
    DocumentType.Kind.STAFF: ("LECTURER", "COORDINATOR"),
    DocumentType.Kind.BOTH: DocumentType.UPLOADERS,
}
SHARE_FIELDS = ("share_supervisors", "share_panel", "share_coordinator")
EDITABLE = (
    "label",
    "description",
    "group",
    "kind",
    "uploaders",
    *SHARE_FIELDS,
    "needs_check",
    "one_per_student",
    "required",
    "required_due_note",
    "required_programmes",
    "is_active",
)


def note_change(area, action, label, actor, *, doc_type=None, details=None):
    return SettingsChange.objects.create(
        area=area,
        action=action,
        label=label[:120],
        doc_type=doc_type,
        actor=actor,
        actor_name=getattr(actor, "full_name", "") or "",
        details=details or {},
    )


def types_with_counts():
    current = Q(documents__archived_at__isnull=True)
    return DocumentType.objects.annotate(
        file_count=Count("documents", filter=current, distinct=True),
        following_count=Count("documents", filter=current & Q(documents__follows_type=True), distinct=True),
        waiting_count=Count(
            "documents",
            filter=current & Q(documents__check_status=Document.CheckStatus.WAITING),
            distinct=True,
        ),
    )


def type_settings_dict(doc_type):
    payload = doc_type.to_public_dict()
    payload.update(
        id=doc_type.pk,
        files=getattr(doc_type, "file_count", 0),
        studentUploads=getattr(doc_type, "following_count", 0),
        waiting=getattr(doc_type, "waiting_count", 0),
    )
    return payload


def _values(doc_type):
    return {field: getattr(doc_type, field) for field in EDITABLE}


def _new_code(label):
    base = slugify(label)[:56] or "type"
    code, number = base, 2
    while DocumentType.objects.filter(code=code).exists():
        code = f"{base}-{number}"
        number += 1
    return code


def add_type(*, actor, values):
    with transaction.atomic():
        order = DocumentType.objects.aggregate(top=Max("display_order"))["top"] or 0
        doc_type = DocumentType.objects.create(
            code=_new_code(values["label"]),
            allowed_kinds=list(DocumentType.FILE_KINDS),
            display_order=order + 1,
            **values,
        )
        note_change(
            SettingsChange.Area.TYPE,
            SettingsChange.Action.ADDED,
            doc_type.label,
            actor,
            doc_type=doc_type,
            details={"after": _values(doc_type)},
        )
    return doc_type


def change_type(doc_type, *, actor, values):
    """Save the office's changes. Student uploads follow their type's sharing,
    so new ticks reach them too; what staff chose when uploading stays."""
    with transaction.atomic():
        doc_type = DocumentType.objects.select_for_update().get(pk=doc_type.pk)
        before = _values(doc_type)
        for field, value in values.items():
            setattr(doc_type, field, value)
        after = _values(doc_type)
        changed = {field: {"before": before[field], "after": after[field]} for field in EDITABLE if before[field] != after[field]}
        if not changed:
            return doc_type, 0
        doc_type.save()
        updated = 0
        if any(field in changed for field in SHARE_FIELDS):
            updated = Document.objects.filter(doc_type=doc_type, follows_type=True).update(
                **{field: after[field] for field in SHARE_FIELDS}
            )
        note_change(
            SettingsChange.Area.TYPE,
            SettingsChange.Action.CHANGED,
            doc_type.label,
            actor,
            doc_type=doc_type,
            details={"changes": changed, "updatedFiles": updated},
        )
    return doc_type, updated

