"""Submissions with deadlines: coordinators set them up and follow them, the office looks, students send."""
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.services import current_effective_semester
from accounts.authorization import coordinator_programmes
from accounts.models import Student, User

from . import submissions as rules
from .access import programme_key, visible_documents
from .models import DocumentType, Submission
from .validation import UploadRejected, check_upload
from .views import DocumentUploadThrottle, INACTIVE_STUDENT_CODE, _scope_or_refuse

MAX_HISTORY = 20


def _when(value):
    return timezone.localtime(value).isoformat() if value else None


def _seconds(delta):
    return int(delta.total_seconds()) if delta else None


def _parse_when(raw):
    if raw in (None, ""):
        return None
    value = parse_datetime(str(raw))
    if value is None:
        return None
    return timezone.make_aware(value) if timezone.is_naive(value) else value


def _refuse(message, code, http=status.HTTP_403_FORBIDDEN):
    return Response({"detail": message, "code": code}, status=http)


def _staff_scope(request):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return scope, refused
    if not (scope.office or scope.coordinated):
        return scope, _refuse("Only programme coordinators and the PG office follow submissions.", "submissions_role")
    return scope, None


def _sees(scope, submission):
    return scope.office or any(programme_key(programme) in scope.coordinated for programme in submission.programmes)


def _type_dict(doc_type):
    return {"code": doc_type.code, "label": doc_type.label, "allowedKinds": list(doc_type.allowed_kinds or [])}


def _summary(submission, rows, scope, at):
    portal = current_effective_semester()
    return {
        "id": submission.pk,
        "title": submission.title,
        "type": _type_dict(submission.doc_type),
        "programmes": list(submission.programmes),
        "stage": submission.stage,
        "semester": submission.academic_semester.label,
        "isCurrent": bool(portal and portal.pk == submission.academic_semester_id),
        "dueAt": _when(submission.due_at),
        "afterDue": submission.after_due,
        "lateUntil": _when(submission.late_until),
        "isOpen": submission.is_open,
        "acceptingNow": submission.is_open and rules.window(submission, None, at)[0],
        "canManage": rules.can_manage(scope, submission),
        "counts": rules.counts(rows),
    }


def _visible_rows(scope, rows):
    return rows if scope.office else [row for row in rows if scope.covers(row.student)]


def _row_dict(row, visible_ids):
    entry = row.entry
    return {
        "matric": row.student.matric_no,
        "name": row.student.user.full_name,
        "programme": row.student.programme,
        "state": row.state,
        "expected": row.expected,
        "dueAt": _when(row.due),
        "sentAt": _when(entry.last_sent_at) if entry else None,
        "firstSentAt": _when(entry.first_sent_at) if entry else None,
        "lateBySeconds": _seconds(row.late_by),
        "documentId": entry.document_id if entry and entry.document_id in visible_ids else None,
        "extension": {
            "dueAt": _when(row.extension.due_at),
            "reason": row.extension.reason,
            "by": row.extension.granted_by.full_name if row.extension.granted_by else "",
        } if row.extension else None,
    }


def _options(scope):
    programmes = [programme_key(value) for value in coordinator_programmes(scope.user)] if scope.coordinated else []
    return {
        "types": [_type_dict(doc_type) for doc_type in rules.uploadable_types()],
        "programmes": programmes,
        "stages": [{"value": value, "label": label} for value, label in Submission.Stage.choices],
        "reasons": [{"value": value, "label": label} for value, label in rules.EXTENSION_REASONS.items()],
    }


def _values(request, scope):
    data = request.data
    errors = {}
    doc_type = DocumentType.objects.filter(code=str(data.get("type") or ""), is_active=True).first()
    if doc_type is None or doc_type not in rules.uploadable_types():
        errors["type"] = ["Choose a file type students can upload."]
    programmes = []
    raw = data.get("programmes") or []
    for value in raw if isinstance(raw, list) else [raw]:
        key = programme_key(value)
        if key not in scope.coordinated:
            errors["programmes"] = [f"You don't coordinate {value}."]
        elif key not in programmes:
            programmes.append(key)
    stage = str(data.get("stage") or Submission.Stage.ALL)
    if stage not in Submission.Stage.values:
        errors["stage"] = ["Choose who must send it."]
    after_due = str(data.get("afterDue") or Submission.AfterDue.CLOSE)
    if after_due not in Submission.AfterDue.values:
        errors["afterDue"] = ["Choose what happens after the due date."]
    due_at = _parse_when(data.get("dueAt"))
    if data.get("dueAt") not in (None, "") and due_at is None:
        errors["dueAt"] = ["Choose the due date and time."]
    late_until = _parse_when(data.get("lateUntil"))
    if data.get("lateUntil") not in (None, "") and late_until is None:
        errors["lateUntil"] = ["Choose the last day for late work."]
    values = {
        "title": str(data.get("title") or ""),
        "doc_type": doc_type,
        "programmes": programmes,
        "stage": stage,
        "due_at": due_at,
        "after_due": after_due,
        "late_until": late_until,
    }
    return values, errors


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def submissions_view(request):
    scope, refused = _staff_scope(request)
    if refused:
        return refused
    if request.method == "POST":
        if not scope.coordinated:
            return _refuse("Only programme coordinators set up submissions.", "submissions_role")
        semester = current_effective_semester()
        if semester is None:
            return _refuse("There is no active semester.", "no_semester", status.HTTP_409_CONFLICT)
        values, errors = _values(request, scope)
        errors.update(rules.check_values(values, creating=True) if not errors else {})
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        submission = rules.create(values, actor=request.user, semester=semester)
        return Response({"id": submission.pk}, status=status.HTTP_201_CREATED)
    at = rules.now()
    items = []
    for submission in Submission.objects.select_related("doc_type", "academic_semester"):
        if _sees(scope, submission):
            items.append(_summary(submission, _visible_rows(scope, rules.standings(submission)), scope, at))
    return Response({"submissions": items, "canCreate": bool(scope.coordinated), "options": _options(scope)})


def _found(request, pk):
    scope, refused = _staff_scope(request)
    if refused:
        return scope, None, refused
    submission = Submission.objects.select_related("doc_type", "academic_semester").filter(pk=pk).first()
    if submission is None or not _sees(scope, submission):
        return scope, None, Response({"detail": "This submission isn't available to you."}, status=status.HTTP_404_NOT_FOUND)
    return scope, submission, None


def _manageable(request, pk):
    scope, submission, refused = _found(request, pk)
    if refused:
        return scope, submission, refused
    if not rules.can_manage(scope, submission):
        return scope, submission, _refuse("Only the programme coordinators of every programme in it can change it.", "submissions_manage")
    return scope, submission, None


def _detail(request, scope, submission):
    at = rules.now()
    rows = _visible_rows(scope, rules.standings(submission))
    documents = [row.entry.document_id for row in rows if row.entry]
    visible = set(visible_documents(request.user, scope).filter(pk__in=documents).values_list("pk", flat=True))
    history = [
        {"action": change.get_action_display(), "by": change.actor_name, "at": _when(change.created_at), "details": change.details}
        for change in submission.changes.all()[:MAX_HISTORY]
    ]
    return Response({
        **_summary(submission, rows, scope, at),
        "students": [_row_dict(row, visible) for row in rows],
        "history": history,
        "remindedToday": rules.reminded_today(submission, request.user),
        "options": _options(scope),
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def submission_view(request, pk):
    if request.method == "GET":
        scope, submission, refused = _found(request, pk)
        if refused:
            return refused
        return _detail(request, scope, submission)
    scope, submission, refused = _manageable(request, pk)
    if refused:
        return refused
    values, errors = _values(request, scope)
    errors.update(rules.check_values(values, creating=False) if not errors else {})
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    try:
        submission = rules.change(submission, values, actor=request.user, confirmed=str(request.data.get("confirm")).lower() in ("1", "true"))
    except rules.NeedsConfirming as asked:
        return Response(
            {"detail": f"{asked.count} {'file' if asked.count == 1 else 'files'} sent on time would become late.", "code": "would_become_late", "count": asked.count},
            status=status.HTTP_409_CONFLICT,
        )
    except rules.SubmissionRefused as refused_change:
        return Response({"detail": str(refused_change)}, status=status.HTTP_409_CONFLICT)
    return _detail(request, scope, Submission.objects.select_related("doc_type", "academic_semester").get(pk=submission.pk))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submission_open_view(request, pk):
    scope, submission, refused = _manageable(request, pk)
    if refused:
        return refused
    is_open = request.data.get("open")
    if not isinstance(is_open, bool):
        return Response({"open": ["Say whether it is open."]}, status=status.HTTP_400_BAD_REQUEST)
    rules.set_open(submission, is_open, actor=request.user)
    return _detail(request, scope, Submission.objects.select_related("doc_type", "academic_semester").get(pk=submission.pk))


def _student_in(scope, submission, matric):
    student = Student.objects.select_related("user").filter(matric_no__iexact=str(matric or "")).first()
    if student is None or not scope.covers(student):
        return None
    if student.pk in {row.student.pk for row in rules.standings(submission)}:
        return student
    return None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submission_extensions_view(request, pk):
    scope, submission, refused = _manageable(request, pk)
    if refused:
        return refused
    student = _student_in(scope, submission, request.data.get("matric"))
    if student is None:
        return Response({"matric": ["Choose a student on this submission."]}, status=status.HTTP_400_BAD_REQUEST)
    due_at = _parse_when(request.data.get("dueAt"))
    reason = str(request.data.get("reason") or "")
    errors = {}
    if due_at is None:
        errors["dueAt"] = ["Choose the new due date and time."]
    if reason not in rules.EXTENSION_REASONS:
        errors["reason"] = ["Choose a reason."]
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    try:
        rules.give_extension(submission, student, due_at=due_at, reason=reason, actor=request.user)
    except rules.SubmissionRefused as problem:
        return Response({"dueAt": [str(problem)]}, status=status.HTTP_400_BAD_REQUEST)
    return _detail(request, scope, submission)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def submission_extension_view(request, pk, matric):
    scope, submission, refused = _manageable(request, pk)
    if refused:
        return refused
    student = _student_in(scope, submission, matric)
    if student is None:
        return Response({"detail": "That student isn't on this submission."}, status=status.HTTP_404_NOT_FOUND)
    try:
        rules.remove_extension(submission, student, actor=request.user)
    except rules.SubmissionRefused as problem:
        return Response({"detail": str(problem)}, status=status.HTTP_404_NOT_FOUND)
    return _detail(request, scope, submission)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submission_remind_view(request, pk):
    scope, submission, refused = _manageable(request, pk)
    if refused:
        return refused
    try:
        sent = rules.remind(submission, actor=request.user)
    except rules.SubmissionRefused as problem:
        return Response({"detail": str(problem)}, status=status.HTTP_409_CONFLICT)
    return Response({"sent": sent})


def _card(submission, student, at):
    view = rules.student_view(submission, student, at)
    entry, extension = view["entry"], view["extension"]
    return {
        "id": submission.pk,
        "title": submission.title,
        "type": _type_dict(submission.doc_type),
        "semester": submission.academic_semester.label,
        "dueAt": _when(view["due"]),
        "originalDueAt": _when(submission.due_at),
        "extended": extension is not None,
        "closesAt": _when(view["closesAt"]),
        "afterDue": submission.after_due,
        "isOpen": submission.is_open,
        "canSend": view["canSend"],
        "lateIfSentNow": view["lateIfSentNow"],
        "why": view["why"],
        "state": view["state"],
        "sentAt": _when(entry.last_sent_at) if entry else None,
        "lateBySeconds": _seconds(view["lateBy"]),
        "documentId": entry.document_id if entry else None,
    }


def _student(request):
    user = request.user
    if user.role != User.Role.STUDENT:
        return None, _refuse("Only students send submissions.", "documents_role")
    student = user._related_or_none("student")
    if student is None:
        return None, _refuse("Your student record is missing. Contact the PG office.", "documents_role")
    return student, None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_submissions_view(request):
    student, refused = _student(request)
    if refused:
        return refused
    at = rules.now()
    cards = [_card(submission, student, at) for submission in rules.for_student(student)]
    cards.sort(key=lambda card: (card["state"] != rules.NOT_SENT or not card["canSend"], card["dueAt"] or ""))
    return Response({"submissions": cards, "now": _when(at)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([DocumentUploadThrottle])
def submission_send_view(request, pk):
    student, refused = _student(request)
    if refused:
        return refused
    if student.status != Student.Status.ACTIVE:
        return _refuse("You can send files while your status is Active.", INACTIVE_STUDENT_CODE)
    submission = Submission.objects.select_related("doc_type", "academic_semester").filter(pk=pk).first()
    if submission is None:
        return Response({"detail": "This submission isn't available to you."}, status=status.HTTP_404_NOT_FOUND)
    try:
        checked = check_upload(request.FILES.get("file"), doc_type=submission.doc_type, staff=False)
    except UploadRejected as problem:
        return Response({"file": [str(problem)]}, status=status.HTTP_400_BAD_REQUEST)
    try:
        rules.send(submission, student, actor=request.user, checked=checked)
    except rules.SubmissionRefused as problem:
        return Response({"detail": str(problem), "code": "submission_refused"}, status=status.HTTP_409_CONFLICT)
    return Response(_card(submission, student, rules.now()), status=status.HTTP_201_CREATED)
