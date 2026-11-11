"""Creating and deleting documents, and the notices they send."""
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from announcements.models import Notification

from .access import people_reached, supervisors_of
from .models import (
    Document,
    DocumentEvent,
    DocumentStudent,
    DocumentVersion,
    version_path,
)

FILES_MODULE = "FILES"
DOCUMENT_RECORD = "STUDENT_DOCUMENT"


def record_event(document, action, actor, *, version_number=None, reason="", details=None):
    return DocumentEvent.objects.create(
        document=document,
        reference=document.reference or "",
        title=document.title,
        version_number=version_number,
        action=action,
        actor=actor,
        actor_name=getattr(actor, "full_name", "") or "",
        reason=reason,
        details=details or {},
    )


def _notify(recipients, document, *, event_key, title, summary, message):
    rows = [
        Notification(
            recipient=user,
            event_key=event_key,
            title=title[:255],
            service="Postgraduate Office",
            summary=summary[:255],
            message=message,
            is_announcement=False,
            reference=(document.reference or "")[:64],
            module_label="File Management",
            target_module=FILES_MODULE,
            record_type=DOCUMENT_RECORD,
            record_id=str(document.pk),
        )
        for user in recipients
    ]
    if rows:
        Notification.objects.bulk_create(rows, ignore_conflicts=True)


def _student_names(students):
    names = [student.user.full_name for student in students]
    if len(names) <= 2:
        return " and ".join(names)
    return f"{names[0]} and {len(names) - 1} others"


def send_upload_notices(document, students, version_number=1):
    uploader = document.uploaded_by
    suffix = "" if version_number == 1 else f":v{version_number}"
    if document.uploader_role == User.Role.STUDENT:
        if not document.doc_type.share_supervisors:
            return
        ids = {lecturer for _, lecturer in supervisors_of({s.user_id for s in students})}
        recipients = User.objects.filter(pk__in=ids, is_active=True)
        _notify(
            recipients,
            document,
            event_key=f"documents:uploaded:{document.pk}{suffix}",
            title=f"New file from {uploader.full_name}" if version_number == 1 else f"New version from {uploader.full_name}",
            summary=f"{document.doc_type.label}: {document.title}",
            message=f"{uploader.full_name} uploaded {document.title} ({document.doc_type.label}).",
        )
        return
    recipients = [user for user, _ in people_reached(document, students)]
    about = f" about {_student_names(students)}" if students else ""
    _notify(
        recipients,
        document,
        event_key=f"documents:shared:{document.pk}{suffix}",
        title=f"{uploader.full_name} shared a file with you",
        summary=f"{document.doc_type.label}: {document.title}",
        message=f"{uploader.full_name} shared {document.title}{about}.",
    )


def create_document(*, actor, uploader_role, doc_type, checked, title, description, semester,
                    students, is_staff_file, audience, programmes):
    """Store the file first, then write every row in one transaction. If the
    database step fails, the stored file is removed again."""
    stored_name = default_storage.save(version_path(None, checked.original_name), ContentFile(checked.content))
    try:
        with transaction.atomic():
            document = Document.objects.create(
                doc_type=doc_type,
                title=title,
                description=description,
                semester=semester,
                uploaded_by=actor,
                uploader_role=uploader_role,
                is_staff_file=is_staff_file,
                staff_audience=audience,
                staff_programmes=programmes,
            )
            document.reference = f"DOC-{timezone.localdate().year}-{document.pk:06d}"
            version = DocumentVersion(
                document=document,
                number=1,
                original_name=checked.original_name,
                content_type=checked.content_type,
                kind=checked.kind,
                size=checked.size,
                sha256=checked.sha256,
                page_count=checked.page_count,
                uploaded_by=actor,
            )
            version.file.name = stored_name
            version.save()
            document.current_version = version
            document.save(update_fields=["reference", "current_version"])
            DocumentStudent.objects.bulk_create(
                [DocumentStudent(document=document, student=student) for student in students]
            )
            record_event(
                document,
                DocumentEvent.Action.UPLOADED,
                actor,
                version_number=1,
                details={"type": doc_type.code, "students": [s.matric_no for s in students]},
            )
            transaction.on_commit(lambda: send_upload_notices(document, students))
    except Exception:
        default_storage.delete(stored_name)
        raise
    return document


def delete_document(document, actor):
    with transaction.atomic():
        document = Document.objects.select_for_update().get(pk=document.pk)
        stored = list(document.versions.values_list("file", flat=True))
        students = list(document.students.select_related("user"))
        record_event(
            document,
            DocumentEvent.Action.DELETED,
            actor,
            details={
                "type": document.doc_type.label,
                "students": [{"name": s.user.full_name, "matric": s.matric_no} for s in students],
                "uploadedBy": document.uploaded_by.full_name,
                "uploadedAt": document.created_at.isoformat(),
            },
        )
        document.delete()
        transaction.on_commit(lambda: _remove_files(stored))


def _remove_files(names):
    for name in names:
        try:
            default_storage.delete(name)
        except OSError:
            pass


def add_version(document, *, actor, checked, note):
    """A corrected or newer file. Older versions stay."""
    stored_name = default_storage.save(version_path(None, checked.original_name), ContentFile(checked.content))
    try:
        with transaction.atomic():
            document = Document.objects.select_for_update(of=("self",)).select_related("doc_type").get(pk=document.pk)
            number = (document.versions.order_by("-number").values_list("number", flat=True).first() or 0) + 1
            version = DocumentVersion(
                document=document,
                number=number,
                original_name=checked.original_name,
                content_type=checked.content_type,
                kind=checked.kind,
                size=checked.size,
                sha256=checked.sha256,
                page_count=checked.page_count,
                uploaded_by=actor,
                note=note,
            )
            version.file.name = stored_name
            version.save()
            document.current_version = version
            document.save(update_fields=["current_version", "updated_at"])
            record_event(document, DocumentEvent.Action.VERSION_ADDED, actor, version_number=number, reason=note)
            students = list(document.students.select_related("user"))
            if actor.pk == document.uploaded_by_id:
                transaction.on_commit(lambda: send_upload_notices(document, students, number))
    except Exception:
        default_storage.delete(stored_name)
        raise
    return document


def update_details(document, *, actor, changes, students=None):
    with transaction.atomic():
        document = Document.objects.select_for_update().get(pk=document.pk)
        before = {
            "title": document.title,
            "description": document.description,
            "semester": document.semester_id,
            "students": sorted(document.students.values_list("matric_no", flat=True)),
        }
        for field, value in changes.items():
            setattr(document, field, value)
        document.save()
        if students is not None:
            DocumentStudent.objects.filter(document=document).delete()
            DocumentStudent.objects.bulk_create([DocumentStudent(document=document, student=student) for student in students])
        after = {
            "title": document.title,
            "description": document.description,
            "semester": document.semester_id,
            "students": sorted(student.matric_no for student in students) if students is not None else before["students"],
        }
        changed = {key: {"before": before[key], "after": after[key]} for key in before if before[key] != after[key]}
        if changed:
            record_event(document, DocumentEvent.Action.DETAILS_CHANGED, actor, details=changed)
    return document


def sharing_of(document):
    return {"audience": document.staff_audience, "programmes": list(document.staff_programmes or [])}


def change_sharing(document, *, actor, sharing):
    """Change who a staff file is shared with. People who can newly see it get a
    notice. A student file is seen by whoever its type names, so it never changes."""
    with transaction.atomic():
        document = Document.objects.select_for_update(of=("self",)).select_related("uploaded_by", "doc_type").get(pk=document.pk)
        before = sharing_of(document)
        if sharing == before:
            return document
        students = list(document.students.select_related("user"))
        reached = {user.pk for user, _ in people_reached(document, students)}
        document.staff_audience = sharing["audience"]
        document.staff_programmes = sharing["programmes"]
        document.save(update_fields=["staff_audience", "staff_programmes", "updated_at"])
        event = record_event(
            document,
            DocumentEvent.Action.SHARING_CHANGED,
            actor,
            details={"before": before, "after": sharing_of(document)},
        )
        newcomers = [user for user, _ in people_reached(document, students) if user.pk not in reached and user.pk != actor.pk]
        about = f" about {_student_names(students)}" if students else ""
        transaction.on_commit(lambda: _notify(
            newcomers,
            document,
            event_key=f"documents:shared:{document.pk}:e{event.pk}",
            title=f"{actor.full_name} shared a file with you",
            summary=f"{document.doc_type.label}: {document.title}",
            message=f"{actor.full_name} shared {document.title}{about}.",
        ))
    return document


def archive_document(document, *, actor, reason):
    """The student's programme coordinator takes a file out of use without deleting it (UC27)."""
    with transaction.atomic():
        document = Document.objects.select_for_update(of=("self",)).get(pk=document.pk)
        document.archived_at = timezone.now()
        document.archived_by = actor
        document.archive_reason = reason
        document.save(update_fields=["archived_at", "archived_by", "archive_reason", "updated_at"])
        record_event(document, DocumentEvent.Action.ARCHIVED, actor, reason=reason)
    return document


def restore_document(document, *, actor):
    with transaction.atomic():
        document = Document.objects.select_for_update(of=("self",)).get(pk=document.pk)
        reason = document.archive_reason
        document.archived_at = None
        document.archived_by = None
        document.archive_reason = ""
        document.save(update_fields=["archived_at", "archived_by", "archive_reason", "updated_at"])
        record_event(document, DocumentEvent.Action.RESTORED, actor, details={"archiveReason": reason})
    return document
