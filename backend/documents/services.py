"""Creating and deleting documents, and the notices they send."""
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from announcements.emails import DOCUMENT, SIGN_OFF, email_users, portal_link
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
        if not document.share_supervisors:
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
                    students, is_staff_file, share, follows_type, audience, programmes, check_status):
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
                share_supervisors=share["supervisors"],
                share_panel=share["panel"],
                share_coordinator=share["coordinator"],
                follows_type=follows_type,
                staff_audience=audience,
                staff_programmes=programmes,
                check_status=check_status,
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


def add_version(document, *, actor, checked, note, is_office):
    """A corrected or newer file. Older versions stay; the check starts again
    for types the office checks, unless the office added the version."""
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
            if document.doc_type.needs_check:
                document.check_status = Document.CheckStatus.ACCEPTED if is_office else Document.CheckStatus.WAITING
                if is_office:
                    document.checked_by, document.checked_at, document.check_reason = actor, timezone.now(), ""
            document.save(update_fields=["current_version", "check_status", "checked_by", "checked_at", "check_reason", "updated_at"])
            record_event(document, DocumentEvent.Action.VERSION_ADDED, actor, version_number=number, reason=note)
            students = list(document.students.select_related("user"))
            if actor.pk == document.uploaded_by_id:
                transaction.on_commit(lambda: send_upload_notices(document, students, number))
    except Exception:
        default_storage.delete(stored_name)
        raise
    return document


def check_document(document, *, actor, accept, reason):
    with transaction.atomic():
        document = Document.objects.select_for_update(of=("self",)).select_related("uploaded_by", "doc_type", "current_version").get(pk=document.pk)
        document.check_status = Document.CheckStatus.ACCEPTED if accept else Document.CheckStatus.RETURNED
        document.checked_by = actor
        document.checked_at = timezone.now()
        document.check_reason = "" if accept else reason
        document.save(update_fields=["check_status", "checked_by", "checked_at", "check_reason", "updated_at"])
        number = document.current_version.number if document.current_version else None
        record_event(
            document,
            DocumentEvent.Action.ACCEPTED if accept else DocumentEvent.Action.RETURNED,
            actor,
            version_number=number,
            reason=document.check_reason,
        )
        transaction.on_commit(lambda: send_check_notice(document, number))
    return document


def send_check_notice(document, number):
    uploader = document.uploaded_by
    if not uploader.is_active or uploader.role == User.Role.OFFICE_ADMIN:
        return
    accepted = document.check_status == Document.CheckStatus.ACCEPTED
    title = f"Accepted: {document.title}" if accepted else f"Returned: {document.title}"
    message = (
        f"The PG office accepted your {document.doc_type.label}, {document.title}."
        if accepted
        else f"The PG office returned your {document.doc_type.label}, {document.title}: {document.check_reason} Please upload a corrected file."
    )
    _notify(
        [uploader],
        document,
        event_key=f"documents:{'accepted' if accepted else 'returned'}:{document.pk}:{number}",
        title=title,
        summary=document.check_reason[:255] if not accepted else document.doc_type.label,
        message=message,
    )
    email_users(
        [uploader],
        DOCUMENT,
        title,
        f"{message}\n\nOpen it in the portal: {portal_link(f'/files/documents/{document.pk}')}\n\n"
        "You get this email because email alerts are on in your Settings.\n\n"
        f"{SIGN_OFF}",
    )


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
    if document.is_staff_file:
        return {"audience": document.staff_audience, "programmes": list(document.staff_programmes or [])}
    return {
        "supervisors": document.share_supervisors,
        "panel": document.share_panel,
        "coordinator": document.share_coordinator,
    }


def change_sharing(document, *, actor, sharing):
    """Change who a file is shared with. A student upload changed here stops
    following its type. People who can newly see it get a notice."""
    with transaction.atomic():
        document = Document.objects.select_for_update(of=("self",)).select_related("uploaded_by", "doc_type").get(pk=document.pk)
        before = sharing_of(document)
        if sharing == before:
            return document
        students = list(document.students.select_related("user"))
        reached = {user.pk for user, _ in people_reached(document, students)}
        if document.is_staff_file:
            document.staff_audience = sharing["audience"]
            document.staff_programmes = sharing["programmes"]
        else:
            document.share_supervisors = sharing["supervisors"]
            document.share_panel = sharing["panel"]
            document.share_coordinator = sharing["coordinator"]
            document.follows_type = False
        document.save(update_fields=[
            "staff_audience", "staff_programmes", "share_supervisors", "share_panel",
            "share_coordinator", "follows_type", "updated_at",
        ])
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
    """The office takes a file out of use without deleting it (UC27)."""
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
