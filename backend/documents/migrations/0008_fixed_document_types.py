"""The document types follow the faculty's research project timeline. Types that
other modules already handle are gone with their files, and a student file is seen
by whoever its type names."""
from django.core.files.storage import default_storage
from django.db import migrations

ALL_KINDS = ["PDF", "DOCX", "IMAGE", "XLSX", "PPTX"]
TYPES = [
    {
        "code": "p1-research-report", "was": ["research-proposal"], "label": "P1 Research Report", "group": "RP1",
        "kind": "STUDENT", "uploaders": ["STUDENT"], "allowed_kinds": ["PDF", "DOCX"],
        "share": (True, True, True), "one_per_student": True, "description": "",
    },
    {
        "code": "final-research-report", "was": ["thesis"], "label": "Final Research Report", "group": "RP2",
        "kind": "STUDENT", "uploaders": ["STUDENT"], "allowed_kinds": ["PDF", "DOCX"],
        "share": (True, True, True), "one_per_student": True, "description": "",
    },
    {
        "code": "turnitin-report", "was": [], "label": "Turnitin Report", "group": "RP2",
        "kind": "STUDENT", "uploaders": ["STUDENT", "SUPERVISOR"], "allowed_kinds": ["PDF"],
        "share": (True, True, True), "one_per_student": True, "description": "",
    },
    {
        "code": "ai-use-declaration", "was": ["faculty-form"], "label": "AI Use Declaration", "group": "RP2",
        "kind": "STUDENT", "uploaders": ["STUDENT"], "allowed_kinds": ["PDF", "DOCX", "IMAGE"],
        "share": (True, True, True), "one_per_student": True, "description": "",
    },
    {
        "code": "supporting-document", "was": ["other"], "label": "Supporting Document", "group": "SUPPORTING",
        "kind": "STUDENT", "uploaders": ["STUDENT", "SUPERVISOR", "PANEL", "COORDINATOR"], "allowed_kinds": ["PDF", "DOCX", "IMAGE"],
        "share": (True, False, True), "one_per_student": False, "description": "For example an ethics approval or a medical letter.",
    },
    {
        "code": "staff-document", "was": [], "label": "Staff Document", "group": "STAFF",
        "kind": "STAFF", "uploaders": ["LECTURER", "COORDINATOR"], "allowed_kinds": ALL_KINDS,
        "share": (False, False, False), "one_per_student": False, "description": "",
    },
]
HANDLED_ELSEWHERE = ["supervisor-appointment-form", "evaluation-form", "letter"]


def remove_files(apps, codes):
    Document = apps.get_model("documents", "Document")
    Version = apps.get_model("documents", "DocumentVersion")
    ids = list(Document.objects.filter(doc_type__code__in=codes).values_list("pk", flat=True))
    stored = [name for name in Version.objects.filter(document_id__in=ids).values_list("file", flat=True) if name]
    apps.get_model("announcements", "Notification").objects.filter(
        record_type="STUDENT_DOCUMENT", record_id__in=[str(pk) for pk in ids]
    ).delete()
    apps.get_model("documents", "DocumentEvent").objects.filter(document_id__in=ids).delete()
    apps.get_model("documents", "SubmissionEntry").objects.filter(document_id__in=ids).delete()
    Document.objects.filter(pk__in=ids).update(current_version=None)
    Version.objects.filter(document_id__in=ids).delete()
    Document.objects.filter(pk__in=ids).delete()
    return stored


def move(apps, sources, target):
    apps.get_model("documents", "Document").objects.filter(doc_type__in=sources).update(doc_type=target)
    apps.get_model("documents", "Submission").objects.filter(doc_type__in=sources).update(doc_type=target)


def settle_types(apps, schema_editor):
    DocumentType = apps.get_model("documents", "DocumentType")
    stored = remove_files(apps, HANDLED_ELSEWHERE)
    apps.get_model("announcements", "Notification").objects.filter(record_type="REQUIRED_DOCUMENT").delete()
    kept = {}
    for order, spec in enumerate(TYPES, start=1):
        target = DocumentType.objects.filter(code=spec["code"]).first()
        sources = list(DocumentType.objects.filter(code__in=spec["was"]).order_by("pk"))
        if target is None and sources:
            target = sources.pop(0)
            DocumentType.objects.filter(pk=target.pk).update(code=spec["code"])
            target.refresh_from_db()
        if target is None:
            target = DocumentType.objects.create(code=spec["code"], label=spec["label"])
        if sources:
            move(apps, sources, target)
            DocumentType.objects.filter(pk__in=[source.pk for source in sources]).delete()
        supervisors, panel, coordinator = spec["share"]
        DocumentType.objects.filter(pk=target.pk).update(
            label=spec["label"], description=spec["description"], group=spec["group"], kind=spec["kind"],
            uploaders=spec["uploaders"], allowed_kinds=spec["allowed_kinds"], share_supervisors=supervisors,
            share_panel=panel, share_coordinator=coordinator, one_per_student=spec["one_per_student"],
            is_active=True, display_order=order,
        )
        kept[spec["code"]] = target
    leftovers = DocumentType.objects.exclude(pk__in=[target.pk for target in kept.values()])
    for doc_type in leftovers:
        documents = apps.get_model("documents", "Document").objects.filter(doc_type=doc_type)
        documents.filter(is_staff_file=True).update(doc_type=kept["staff-document"])
        move(apps, [doc_type], kept["supporting-document"])
    leftovers.delete()
    for name in stored:
        default_storage.delete(name)


class Migration(migrations.Migration):

    dependencies = [
        ('announcements', '0008_announcement_target_students'),
        ('documents', '0007_remove_file_checks'),
    ]

    operations = [
        migrations.RunPython(settle_types, migrations.RunPython.noop),
    ]
