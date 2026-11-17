"""Dated hand-ins a programme coordinator sets up: who must send one, whether a
student can still send, and how each student stands.

The time a file is sent is taken on the server when the request arrives, so the
student's own clock never counts. Every upload also keeps its own time on the
document's versions, which can never be changed.
"""
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import Student, StudentCompletion, StudentSemester, User
from accounts.project_stages import project_stages
from accounts.semester_rules import STUDIED
from announcements.emails import DEADLINE, SIGN_OFF, email_users, portal_link
from announcements.models import Notification

from .access import programme_key
from .models import Document, DocumentType, Submission, SubmissionChange, SubmissionEntry, SubmissionExtension
from .services import add_version, create_document

ON_TIME, LATE, NOT_SENT = "ON_TIME", "LATE", "NOT_SENT"
EXTENSION_REASONS = {
    "MEDICAL": "Medical",
    "PERSONAL": "Personal or family",
    "TECHNICAL": "Technical problem",
    "OTHER": "Other",
}
RECORD = "SUBMISSION"
INSTRUCTIONS_LIMIT = 2000
CLOSE, ACCEPT_LATE = Submission.AfterDue.CLOSE, Submission.AfterDue.ACCEPT_LATE
ALL = Submission.Stage.ALL


class SubmissionRefused(Exception):
    pass


class NeedsConfirming(Exception):
    def __init__(self, count):
        super().__init__(count)
        self.count = count


def now():
    return timezone.now()


def due_for(submission, extension):
    return extension.due_at if extension else submission.due_at


def closes_at(submission, due):
    """When a student with this due date can no longer send. None means late work is accepted any time."""
    if submission.after_due == CLOSE:
        return due
    if submission.late_until is None:
        return None
    return max(submission.late_until, due)


def not_open_yet(submission, at):
    return submission.opens_at is not None and at < submission.opens_at


def window(submission, extension, at):
    """(can send, would be late, why not)."""
    due = due_for(submission, extension)
    if not submission.is_open:
        return False, at > due, "This submission is closed."
    if not_open_yet(submission, at):
        return False, False, f"Opens {due_text(submission.opens_at)}."
    end = closes_at(submission, due)
    if end is not None and at > end:
        return False, True, "The deadline has passed."
    return True, at > due, ""


def _programme_q(programmes, prefix=""):
    return Q(*[Q(**{f"{prefix}programme__trim__iexact": programme}) for programme in programmes], _connector=Q.OR) if programmes else Q(pk__in=[])


def expected_students(submission):
    """Who must send it: Active students studying in its semester, in its programmes and, if set, on its RP stage.
    Students waiting for the Senate have finished, so they are not expected."""
    semester = submission.academic_semester
    studying = StudentSemester.objects.filter(
        session=semester.academic_session, term=semester.term, outcome=STUDIED,
    ).values("student_id")
    waiting = StudentCompletion.objects.filter(senate_decision__isnull=True).values("student_id")
    students = list(
        Student.objects.filter(status=Student.Status.ACTIVE, pk__in=studying)
        .exclude(pk__in=waiting)
        .filter(_programme_q(submission.programmes))
        .select_related("user")
        .order_by("user__full_name")
    )
    if submission.stage != ALL:
        answers = project_stages(semester, [student.pk for student in students])
        students = [student for student in students if answers[student.pk].stage == submission.stage]
    return students


@dataclass
class Standing:
    student: Student
    state: str
    entry: SubmissionEntry | None
    extension: SubmissionExtension | None
    due: object
    late_by: timedelta | None
    expected: bool


def _entries(submission):
    return {
        entry.student_id: entry
        for entry in submission.entries.select_related("student__user", "document")
    }


def standings(submission):
    """One row per expected student, plus anyone who sent a file but is no longer expected."""
    expected = expected_students(submission)
    entries = _entries(submission)
    extensions = {row.student_id: row for row in submission.extensions.all()}
    expected_ids = {student.pk for student in expected}
    people = expected + sorted(
        (entry.student for student_id, entry in entries.items() if student_id not in expected_ids),
        key=lambda student: student.user.full_name.casefold(),
    )
    rows = []
    for student in people:
        entry, extension = entries.get(student.pk), extensions.get(student.pk)
        due = due_for(submission, extension)
        late_by = entry.last_sent_at - due if entry and entry.last_sent_at > due else None
        state = NOT_SENT if entry is None else LATE if late_by else ON_TIME
        rows.append(Standing(student, state, entry, extension, due, late_by, student.pk in expected_ids))
    return rows


def counts(rows):
    found = {ON_TIME: 0, LATE: 0, NOT_SENT: 0}
    for row in rows:
        found[row.state] += 1
    found["extensions"] = sum(1 for row in rows if row.extension)
    return found


def for_student(student):
    """The submissions a student sees: this semester's ones they must send, and any they sent before."""
    from academics.services import current_effective_semester

    sent = set(SubmissionEntry.objects.filter(student=student).values_list("submission_id", flat=True))
    portal = current_effective_semester()
    mine = Q(pk__in=sent)
    if portal is not None:
        mine |= Q(academic_semester=portal, programmes__contains=[programme_key(student.programme)])
    found = []
    for submission in Submission.objects.filter(mine).select_related("doc_type", "academic_semester"):
        if submission.pk in sent or any(row.pk == student.pk for row in expected_students(submission)):
            found.append(submission)
    return found


def student_view(submission, student, at=None):
    """Where one student stands on one submission, for their card."""
    at = at or now()
    entry = _entries(submission).get(student.pk)
    extension = submission.extensions.filter(student=student).first()
    due = due_for(submission, extension)
    can_send, late_now, why = window(submission, extension, at)
    late_by = entry.last_sent_at - due if entry and entry.last_sent_at > due else None
    return {
        "entry": entry,
        "extension": extension,
        "due": due,
        "closesAt": closes_at(submission, due),
        "canSend": can_send,
        "lateIfSentNow": late_now,
        "why": why,
        "state": NOT_SENT if entry is None else LATE if late_by else ON_TIME,
        "lateBy": late_by,
    }


def to_do_count(student):
    """Submissions a student still has to send and can still send."""
    if student is None or student.status != Student.Status.ACTIVE:
        return 0
    at = now()
    owed = 0
    for submission in for_student(student):
        view = student_view(submission, student, at)
        if view["state"] == NOT_SENT and view["canSend"]:
            owed += 1
    return owed


def _same_file(document, checked):
    return document.current_version is not None and document.current_version.sha256 == checked.sha256


def send(submission, student, *, actor, checked):
    """A student sends their file. A second file before the window closes becomes a new version, and the latest counts."""
    at = now()
    with transaction.atomic():
        submission = Submission.objects.select_for_update().select_related("doc_type", "academic_semester").get(pk=submission.pk)
        entry = SubmissionEntry.objects.select_for_update().filter(submission=submission, student=student).select_related("document").first()
        if entry is not None and entry.document.archived_at is not None:
            entry = None
        if entry is None and not any(row.pk == student.pk for row in expected_students(submission)):
            raise SubmissionRefused("This submission is not for you.")
        extension = submission.extensions.filter(student=student).first()
        can_send, _late, why = window(submission, extension, at)
        if not can_send:
            raise SubmissionRefused(why)
        doc_type = submission.doc_type
        if entry is not None:
            if _same_file(entry.document, checked):
                raise SubmissionRefused("This is the same file you already sent.")
            add_version(entry.document, actor=actor, checked=checked, note="")
            entry.last_sent_at = at
            entry.save(update_fields=["last_sent_at"])
            return entry
        existing = None
        if doc_type.one_per_student:
            existing = Document.objects.filter(doc_type=doc_type, uploaded_by=actor, archived_at__isnull=True).first()
        if existing is not None:
            if _same_file(existing, checked):
                raise SubmissionRefused("This is the same file you already sent.")
            add_version(existing, actor=actor, checked=checked, note="")
            document = existing
        else:
            document = create_document(
                actor=actor,
                uploader_role=actor.role,
                doc_type=doc_type,
                checked=checked,
                title=submission.title,
                description="",
                semester=submission.academic_semester,
                students=[student],
                is_staff_file=False,
                audience="",
                programmes=[],
            )
        SubmissionEntry.objects.filter(submission=submission, student=student).delete()
        return SubmissionEntry.objects.create(submission=submission, student=student, document=document, first_sent_at=at, last_sent_at=at)


def entries_for_new_version(document, student):
    """A student adding a version to a file they sent for a submission keeps to the same deadline.
    Returns the entries to stamp, or raises when any of them is closed."""
    at = now()
    entries = list(SubmissionEntry.objects.filter(document=document, student=student).select_related("submission"))
    for entry in entries:
        extension = entry.submission.extensions.filter(student=student).first()
        can_send, _late, why = window(entry.submission, extension, at)
        if not can_send:
            raise SubmissionRefused(f"{why} This file was sent for {entry.submission.title}.")
    return entries, at


def stamp(entries, at):
    for entry in entries:
        entry.last_sent_at = at
        entry.save(update_fields=["last_sent_at"])


def is_sent_for_a_submission(document):
    return SubmissionEntry.objects.filter(document=document).exists()


def links_for(document, scope, at=None):
    """The submissions a file was sent for, for the file page and the archive warning.
    Archiving the file keeps the student's sent time; ``open`` says whether they can still send a new file."""
    at = at or now()
    entries = SubmissionEntry.objects.filter(document=document).select_related("submission", "student__user")
    links = []
    for entry in sorted(entries, key=lambda row: (row.submission.due_at, row.pk)):
        submission = entry.submission
        extension = submission.extensions.filter(student=entry.student).first()
        can_send, _late, _why = window(submission, extension, at)
        links.append(
            {
                "id": submission.pk,
                "title": submission.title,
                "dueAt": due_for(submission, extension).isoformat(),
                "open": can_send,
                "student": entry.student.user.full_name,
                "canOpen": scope.office or any(programme_key(programme) in scope.coordinated for programme in submission.programmes),
            }
        )
    return links


def _record(submission, action, actor, details=None):
    SubmissionChange.objects.create(
        submission=submission, action=action, actor=actor, actor_name=actor.full_name if actor else "", details=details or {},
    )


def _values(submission):
    return {
        "title": submission.title,
        "type": submission.doc_type.label,
        "programmes": list(submission.programmes),
        "stage": submission.stage,
        "instructions": submission.instructions,
        "opensAt": submission.opens_at.isoformat() if submission.opens_at else None,
        "dueAt": submission.due_at.isoformat(),
        "afterDue": submission.after_due,
        "lateUntil": submission.late_until.isoformat() if submission.late_until else None,
    }


def can_manage(scope, submission):
    managed = set(scope.coordinated)
    return bool(managed) and all(programme_key(programme) in managed for programme in submission.programmes)


def uploadable_types():
    return [
        doc_type for doc_type in DocumentType.objects.filter(is_active=True).order_by("display_order", "label")
        if doc_type.for_students and "STUDENT" in (doc_type.uploaders or [])
    ]


NEW_TYPE_LIMIT = 80
STAGE_GROUP = {Submission.Stage.P1: DocumentType.Group.RP1, Submission.Stage.P2: DocumentType.Group.RP2}


def type_name(text):
    return " ".join(str(text or "").split())


def type_named(name):
    return DocumentType.objects.filter(label__iexact=type_name(name)).first()


def _free_code(name):
    base = slugify(name)[:56] or "file-type"
    code, number = base, 2
    while DocumentType.objects.filter(code=code).exists():
        code, number = f"{base}-{number}", number + 1
    return code


def _group_for(stage):
    return STAGE_GROUP.get(stage, DocumentType.Group.SUPPORTING)


def _fit_type(doc_type, stage, submission):
    """A coordinator's own type with no files yet follows who must send it."""
    if not doc_type.custom or doc_type.documents.exists() or doc_type.submissions.exclude(pk=submission.pk).exists():
        return
    group = _group_for(stage)
    if doc_type.group != group:
        doc_type.group = group
        doc_type.share_panel = group != DocumentType.Group.SUPPORTING
        doc_type.save(update_fields=["group", "share_panel", "updated_at"])


def _type_for(values, actor):
    """The submission's file type, adding the coordinator's new one the first time it is used."""
    if values["doc_type"] is not None:
        return values["doc_type"]
    name = type_name(values["new_type"])
    found = DocumentType.objects.select_for_update().filter(label__iexact=name).first()
    if found is not None:
        if not found.custom and not found.is_active:
            raise SubmissionRefused("That file type is switched off.")
        if not found.is_active:
            found.is_active = True
            found.save(update_fields=["is_active", "updated_at"])
        return found
    group = _group_for(values["stage"])
    top = DocumentType.objects.aggregate(top=Max("display_order"))["top"] or 0
    return DocumentType.objects.create(
        code=_free_code(name),
        label=name,
        group=group,
        kind=DocumentType.Kind.STUDENT,
        uploaders=["STUDENT", "SUPERVISOR", "COORDINATOR"],
        allowed_kinds=["PDF", "DOCX", "IMAGE"],
        share_supervisors=True,
        share_panel=group != DocumentType.Group.SUPPORTING,
        share_coordinator=True,
        one_per_student=False,
        display_order=top + 1,
        custom=True,
        added_by=actor,
    )


def _drop_if_unused(doc_type):
    """A coordinator's type nothing uses any more, such as a misspelt one, leaves the lists."""
    if doc_type.custom and doc_type.is_active and not doc_type.submissions.exists() and not doc_type.documents.exists():
        doc_type.is_active = False
        doc_type.save(update_fields=["is_active", "updated_at"])


def check_values(values, *, creating, at=None):
    """Plain checks on a submission's fields. Returns {field: [message]}."""
    at = at or now()
    errors = {}
    if not values["title"].strip():
        errors["title"] = ["Give it a title."]
    elif len(values["title"]) > 120:
        errors["title"] = ["Keep the title to 120 characters."]
    if len(values["instructions"]) > INSTRUCTIONS_LIMIT:
        errors["instructions"] = [f"Keep the instructions to {INSTRUCTIONS_LIMIT} characters."]
    if not values["programmes"]:
        errors["programmes"] = ["Choose at least one programme."]
    if values["due_at"] is None:
        errors["dueAt"] = ["Choose the due date and time."]
    elif creating and values["due_at"] <= at:
        errors["dueAt"] = ["The due date must be in the future."]
    if values["opens_at"] is not None and values["due_at"] is not None and values["opens_at"] >= values["due_at"]:
        errors["opensAt"] = ["The opening date must be before the due date."]
    if values["after_due"] == ACCEPT_LATE and values["late_until"] is not None and values["due_at"] is not None and values["late_until"] <= values["due_at"]:
        errors["lateUntil"] = ["The last day for late work must be after the due date."]
    return errors


def _apply(submission, values):
    submission.title = values["title"].strip()
    submission.instructions = values["instructions"].strip()
    submission.opens_at = values["opens_at"]
    submission.doc_type = values["doc_type"]
    submission.programmes = values["programmes"]
    submission.stage = values["stage"]
    submission.due_at = values["due_at"]
    submission.after_due = values["after_due"]
    submission.late_until = values["late_until"] if values["after_due"] == ACCEPT_LATE else None


def create(values, *, actor, semester):
    with transaction.atomic():
        values = {**values, "doc_type": _type_for(values, actor)}
        submission = Submission(academic_semester=semester, created_by=actor)
        _apply(submission, values)
        submission.save()
        _fit_type(submission.doc_type, submission.stage, submission)
        _record(submission, SubmissionChange.Action.CREATED, actor, _values(submission))
        recipients = [student.user for student in expected_students(submission) if student.user.is_active]
        transaction.on_commit(lambda: tell_students(submission, recipients, reminder=False))
    return submission


def would_become_late(submission, values):
    """How many files sent on time would be late under the new due date."""
    extensions = {row.student_id: row for row in submission.extensions.all()}
    count = 0
    for student_id, entry in _entries(submission).items():
        extension = extensions.get(student_id)
        before = due_for(submission, extension)
        after = extension.due_at if extension else values["due_at"]
        if entry.last_sent_at <= before and entry.last_sent_at > after:
            count += 1
    return count


def change(submission, values, *, actor, confirmed):
    with transaction.atomic():
        submission = Submission.objects.select_for_update().select_related("doc_type").get(pk=submission.pk)
        wanted = values["doc_type"]
        if (wanted is None or wanted.pk != submission.doc_type_id) and submission.entries.exists():
            raise SubmissionRefused("Students have already sent files, so the file type can't change.")
        count = would_become_late(submission, values)
        if count and not confirmed:
            raise NeedsConfirming(count)
        values = {**values, "doc_type": _type_for(values, actor)}
        old_type = submission.doc_type
        before = _values(submission)
        _apply(submission, values)
        submission.save()
        _fit_type(submission.doc_type, submission.stage, submission)
        if old_type.pk != submission.doc_type_id:
            _drop_if_unused(old_type)
        after = _values(submission)
        if before != after:
            _record(submission, SubmissionChange.Action.CHANGED, actor, {"before": before, "after": after})
    return submission


def set_open(submission, is_open, *, actor):
    with transaction.atomic():
        submission = Submission.objects.select_for_update().get(pk=submission.pk)
        if submission.is_open == is_open:
            return submission
        submission.is_open = is_open
        submission.save(update_fields=["is_open", "updated_at"])
        _record(submission, SubmissionChange.Action.OPENED if is_open else SubmissionChange.Action.CLOSED, actor)
    return submission


def give_extension(submission, student, *, due_at, reason, actor):
    if due_at <= submission.due_at:
        raise SubmissionRefused("An extension must be later than the due date.")
    with transaction.atomic():
        extension, _ = SubmissionExtension.objects.update_or_create(
            submission=submission, student=student,
            defaults={"due_at": due_at, "reason": EXTENSION_REASONS[reason], "granted_by": actor},
        )
        _record(submission, SubmissionChange.Action.EXTENDED, actor, {"matric": student.matric_no, "dueAt": due_at.isoformat(), "reason": extension.reason})
    return extension


def remove_extension(submission, student, *, actor):
    with transaction.atomic():
        removed, _ = SubmissionExtension.objects.filter(submission=submission, student=student).delete()
        if not removed:
            raise SubmissionRefused("This student has no extension.")
        _record(submission, SubmissionChange.Action.EXTENSION_REMOVED, actor, {"matric": student.matric_no})


def reminded_today(submission, actor):
    return submission.changes.filter(
        action=SubmissionChange.Action.REMINDED, actor=actor, created_at__date=timezone.localdate(),
    ).exists()


def remind(submission, *, actor):
    """Tell students who haven't sent it and still can. Once a day."""
    at = now()
    with transaction.atomic():
        submission = Submission.objects.select_for_update().get(pk=submission.pk)
        if not_open_yet(submission, at):
            raise SubmissionRefused("It is not open yet. You can remind students once it opens.")
        if reminded_today(submission, actor):
            raise SubmissionRefused("You already reminded them today. You can remind them again tomorrow.")
        recipients = [
            row.student.user for row in standings(submission)
            if row.expected and row.state == NOT_SENT and window(submission, row.extension, at)[0] and row.student.user.is_active
        ]
        if not recipients:
            raise SubmissionRefused("Nobody who can still send it is missing.")
        _record(submission, SubmissionChange.Action.REMINDED, actor, {"students": len(recipients)})
        transaction.on_commit(lambda: tell_students(submission, recipients, reminder=True))
    return len(recipients)


def due_text(when):
    return timezone.localtime(when).strftime("%d %b %Y, %I:%M %p").replace(" 0", " ")


def tell_students(submission, recipients, *, reminder):
    due = due_text(submission.due_at)
    title = f"{'Reminder: send' if reminder else 'New submission:'} {submission.title}"
    message = f"Send your {submission.doc_type.label} for {submission.title} by {due}."
    if not reminder and not_open_yet(submission, now()):
        message = f"{submission.title} opens on {due_text(submission.opens_at)}. Send your {submission.doc_type.label} by {due}."
    instructions = f"Instructions:\n{submission.instructions}\n\n" if submission.instructions else ""
    Notification.objects.bulk_create(
        [
            Notification(
                recipient=user,
                event_key=f"documents:submission:{submission.pk}:{'reminder:' + timezone.localdate().isoformat() if reminder else 'new'}",
                title=title[:255],
                service="Postgraduate Office",
                summary=f"Due {due}"[:255],
                message=message,
                is_announcement=False,
                module_label="File Management",
                target_module="FILES",
                record_type=RECORD,
                record_id=str(submission.pk),
            )
            for user in recipients
        ],
        ignore_conflicts=True,
    )
    email_users(
        [user for user in recipients if user.role == User.Role.STUDENT],
        DEADLINE,
        title,
        f"{message}\n\n{instructions}Send it in the portal: {portal_link('/files?tab=todo')}\n\n"
        "You get this email because deadline reminders are on in your Settings.\n\n"
        f"{SIGN_OFF}",
        wait=False,
    )
