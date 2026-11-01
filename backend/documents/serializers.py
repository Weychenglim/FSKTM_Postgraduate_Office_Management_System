"""JSON shapes for documents (camelCase, like the other apps)."""
from django.db.models import Prefetch

from accounts.models import User

from .access import people_reached, permissions
from .history import file_history
from .models import Document, DocumentStudent

ROLE_LABELS = {
    User.Role.OFFICE_ADMIN: "PG office",
    User.Role.COORDINATOR: "Programme coordinator",
    User.Role.LECTURER: "Lecturer",
    User.Role.STUDENT: "Student",
}
# The "From" tag's filter value for each role, as in ``?sender=``.
SENDERS = {
    User.Role.STUDENT: "student",
    User.Role.LECTURER: "lecturer",
    User.Role.COORDINATOR: "coordinator",
    User.Role.OFFICE_ADMIN: "office",
}


def with_details(queryset):
    return queryset.select_related(
        "doc_type", "semester", "uploaded_by", "current_version", "checked_by", "archived_by"
    ).prefetch_related(
        Prefetch("student_links", queryset=DocumentStudent.objects.select_related("student__user")),
    )


def student_dict(student):
    return {"matric": student.matric_no, "name": student.user.full_name, "programme": student.programme}


def version_dict(version):
    if version is None:
        return None
    return {
        "number": version.number,
        "name": version.original_name,
        "kind": version.kind,
        "size": version.size,
        "pageCount": version.page_count,
        "uploadedAt": version.uploaded_at.isoformat(),
    }


def auto_tags(document, students):
    """The tags the system gives a file, from its type, semester and uploader and
    its students' records, each with the list filter it opens. They are worked
    out every time, so they follow a student who changes programme."""
    doc_type = document.doc_type
    tags = [{"kind": "category", "label": doc_type.get_group_display(), "filter": {"group": doc_type.group}}]
    if doc_type.required:
        tags.append({"kind": "required", "label": "Required", "filter": {"required": "1"}})
    if document.semester:
        tags.append({"kind": "semester", "label": document.semester.label, "filter": {"semester": str(document.semester_id)}})
    if document.uploader_role in SENDERS:
        tags.append({
            "kind": "from",
            "label": ROLE_LABELS[document.uploader_role],
            "filter": {"sender": SENDERS[document.uploader_role]},
        })
    programmes = [student.programme.strip() for student in students] if students else list(document.staff_programmes or [])
    for programme in dict.fromkeys(name for name in programmes if name):
        tags.append({"kind": "programme", "label": programme, "filter": {"programme": programme}})
    for intake in dict.fromkeys(student.intake_semester.strip() for student in students if student.intake_semester.strip()):
        tags.append({"kind": "intake", "label": f"Intake {intake}", "filter": {"intake": intake}})
    return tags


def document_dict(document, user, scope):
    students = [link.student for link in document.student_links.all()]
    doc_type = document.doc_type
    return {
        "id": document.pk,
        "reference": document.reference,
        "title": document.title,
        "description": document.description,
        "type": {"code": doc_type.code, "label": doc_type.label},
        "group": doc_type.group,
        "groupLabel": doc_type.get_group_display(),
        "students": [student_dict(student) for student in students],
        "isStaffFile": document.is_staff_file,
        "staffAudience": document.staff_audience,
        "staffAudienceLabel": document.get_staff_audience_display() if document.staff_audience else "",
        "staffProgrammes": list(document.staff_programmes or []),
        "share": {
            "supervisors": document.share_supervisors,
            "panel": document.share_panel,
            "coordinator": document.share_coordinator,
        },
        "autoTags": auto_tags(document, students),
        "semester": {"id": document.semester_id, "label": document.semester.label} if document.semester else None,
        "uploadedBy": {
            "name": document.uploaded_by.full_name,
            "role": document.uploader_role,
            "roleLabel": ROLE_LABELS.get(document.uploader_role, document.uploader_role),
            "isMe": document.uploaded_by_id == user.pk,
        },
        "uploadedAt": document.created_at.isoformat(),
        "checkStatus": document.check_status,
        "checkStatusLabel": document.get_check_status_display(),
        "checkReason": document.check_reason,
        "checkedBy": document.checked_by.full_name if document.checked_by else "",
        "checkedAt": document.checked_at.isoformat() if document.checked_at else None,
        "file": version_dict(document.current_version),
        "archived": document.archived_at is not None,
        "archivedAt": document.archived_at.isoformat() if document.archived_at else None,
        "archivedBy": document.archived_by.full_name if document.archived_by else "",
        "archiveReason": document.archive_reason,
        "permissions": permissions(user, document, scope),
    }


def shared_with(document, students):
    people = [{"name": "PG office", "role": "always"}]
    if document.is_staff_file:
        if document.staff_audience == Document.Audience.OFFICE:
            return people
        if not document.staff_programmes:
            people.append({"name": document.get_staff_audience_display(), "role": ""})
            return people
    for user, label in people_reached(document, students):
        people.append({"name": user.full_name, "role": label})
    return people


def detail_dict(document, user, scope):
    payload = document_dict(document, user, scope)
    students = [link.student for link in document.student_links.all()]
    payload["sharedWith"] = shared_with(document, students)
    payload["versions"] = [version_dict(version) for version in document.versions.order_by("-number")]
    if scope.office:
        payload["history"] = file_history(document)
    return payload
