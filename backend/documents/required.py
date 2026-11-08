"""Required documents: which Active students must hand in a type, and how far
each of them has got. A returned upload counts as still to hand in."""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounts.models import Student, User
from announcements.emails import DEADLINE, SIGN_OFF, email_users, portal_link
from announcements.models import Notification

from .models import Document, DocumentStudent, DocumentType, RequiredReminder

DONE, WAITING, RETURNED, MISSING = "DONE", "WAITING", "RETURNED", "MISSING"
RANK = {MISSING: 0, RETURNED: 1, WAITING: 2, DONE: 3}
STILL_TO_HAND_IN = (MISSING, RETURNED)
REQUIRED_RECORD = "REQUIRED_DOCUMENT"


def required_types():
    return DocumentType.objects.filter(is_active=True, required=True).order_by("display_order", "label")


def programme_filter(programmes):
    return Q(*[Q(programme__trim__iexact=programme) for programme in programmes], _connector=Q.OR)


def students_for(doc_type, students):
    """The Active students, out of ``students``, who must hand in ``doc_type``."""
    rows = students.filter(status=Student.Status.ACTIVE)
    programmes = list(doc_type.required_programmes or [])
    return rows.filter(programme_filter(programmes)) if programmes else rows


def states(doc_type, student_ids):
    """{student id: (state, document id)}, keeping each student's furthest file."""
    found = {}
    links = DocumentStudent.objects.filter(
        document__doc_type=doc_type,
        document__archived_at__isnull=True,
        student_id__in=student_ids,
    ).values_list("student_id", "document_id", "document__check_status")
    for student_id, document_id, check in links:
        state = {
            Document.CheckStatus.WAITING: WAITING,
            Document.CheckStatus.RETURNED: RETURNED,
        }.get(check, DONE)
        if student_id not in found or RANK[state] > RANK[found[student_id][0]]:
            found[student_id] = (state, document_id)
    return found


def progress(doc_type, students):
    """(rows, counts): one (student, state, document id) row per student who must hand it in."""
    applicable = list(students_for(doc_type, students).select_related("user"))
    found = states(doc_type, [student.pk for student in applicable])
    counts = {DONE: 0, WAITING: 0, RETURNED: 0, MISSING: 0}
    rows = []
    for student in applicable:
        state, document_id = found.get(student.pk, (MISSING, None))
        counts[state] += 1
        rows.append((student, state, document_id))
    return rows, counts


def mine(student):
    """The required types that apply to ``student``, with where they stand."""
    if student.status != Student.Status.ACTIVE:
        return []
    items = []
    for doc_type in required_types():
        if not students_for(doc_type, Student.objects.filter(pk=student.pk)).exists():
            continue
        state, document_id = states(doc_type, [student.pk]).get(student.pk, (MISSING, None))
        items.append((doc_type, state, document_id))
    return items


def reminded_today(doc_type, actor):
    return doc_type.reminders.filter(sent_by=actor, sent_at__date=timezone.localdate()).first()


class AlreadyReminded(Exception):
    pass


class NobodyToRemind(Exception):
    pass


def remind(doc_type, *, actor, students):
    """Tell the coordinator's students still to hand it in, once a day at most."""
    with transaction.atomic():
        doc_type = DocumentType.objects.select_for_update().get(pk=doc_type.pk)
        if reminded_today(doc_type, actor):
            raise AlreadyReminded
        rows, _ = progress(doc_type, students)
        recipients = [student.user for student, state, _ in rows if state in STILL_TO_HAND_IN and student.user.is_active]
        if not recipients:
            raise NobodyToRemind
        RequiredReminder.objects.create(
            doc_type=doc_type,
            sent_by=actor,
            sent_by_name=actor.full_name,
            students=len(recipients),
        )
        transaction.on_commit(lambda: send_reminders(doc_type, recipients))
    return len(recipients)


def send_reminders(doc_type, recipients):
    due = f" {doc_type.required_due_note}." if doc_type.required_due_note else ""
    title = f"Reminder: hand in your {doc_type.label}"
    message = f"Your programme coordinator asks you to hand in your {doc_type.label}.{due} If it was returned, upload a corrected file."
    Notification.objects.bulk_create(
        [
            Notification(
                recipient=user,
                event_key=f"documents:required:{doc_type.pk}:{timezone.localdate().isoformat()}",
                title=title[:255],
                service="Postgraduate Office",
                summary=(doc_type.required_due_note or "Required by your programme coordinator")[:255],
                message=message,
                is_announcement=False,
                module_label="File Management",
                target_module="FILES",
                record_type=REQUIRED_RECORD,
                record_id=doc_type.code,
            )
            for user in recipients
        ],
        ignore_conflicts=True,
    )
    email_users(
        [user for user in recipients if user.role == User.Role.STUDENT],
        DEADLINE,
        title,
        f"{message}\n\nUpload it in the portal: {portal_link(f'/files/upload?type={doc_type.code}')}\n\n"
        "You get this email because deadline reminders are on in your Settings.\n\n"
        f"{SIGN_OFF}",
        wait=False,
    )
