"""Letter requests and issued letters (UC23).

Mounted under ``/api/letters/`` by the project URLconf.

- A student asks for a letter from an Active template, with an optional note.
  The request is Pending: it has no wording, reference number or date yet, and
  the student never sees the template's wording. Office staff are notified.
- Office staff review a request. They fill in anything the student's record
  cannot supply (the template's own office-filled fields, and any record field
  that is blank), then approve it, which fills the template's current wording,
  issues the reference number and saves the letter; or they reject it with a
  reason. The student is notified in the app, and by email if they allow it.
- A student can withdraw a pending request, and can request the same letter
  again once the earlier request is decided or withdrawn.
- Only Issued letters can be viewed in full, downloaded, resent or revoked.
- Students whose status is not Active can neither request nor view letters.

Appointment letters (UC22, see ``appointment_letters.py``) use the same
records. Their lecturers may open them too, students see them only once
issued, and the office can make missing ones or reissue them.
"""
import re
from datetime import date

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from announcements.emails import LETTER, SIGN_OFF, email_users, portal_link
from announcements.models import Notification

from .appointment_letters import (
    KINDS,
    LetterRefused,
    LetterValuesMissing,
    create_letters,
    letter_values,
    missing_appointment_letters,
    notify_recipients,
    recipient_rows,
    reissue_letter,
    revoke_appointment_letter,
)
from .details import letter_details
from .eligibility import inactive_student_refusal
from .choice_lists import recipient_options
from .confirmation import add_months, english_date, malay_values, request_values
from .form_questions import answer_values, clean_answers, custom_questions, known_fields, resolve
from .issuing import issue_letter, letter_wording
from .models import AUTOMATIC_PURPOSES, GeneratedLetter, LetterPurpose, LetterTemplate
from .notices import send_notice
from .pdf_export import build_letter_pdf
from .placeholders import VALUE_KEYS, letter_fields, placeholder_problems, used_names, value_problem
from .recipients import OPTIONAL_DETAILS, clean_request_details, same_recipient

PDF_TYPE = "application/pdf"
# Students' notifications point at their letter; office ones at the request.
LETTER_RECORD = "GENERATED_LETTER"
REQUEST_RECORD = "LETTER_REQUEST"
MAX_NOTE_LENGTH = 500
MAX_REASON_LENGTH = 500
MAX_CREATE = 100
PENDING_CODE = "letter_request_pending"
Status = GeneratedLetter.Status
SEEN_BY_RECIPIENTS = (Status.ISSUED, Status.REVOKED)


def _is_office(user):
    return getattr(user, "role", None) == User.Role.OFFICE_ADMIN


def _require_office(request):
    if not _is_office(request.user):
        raise PermissionDenied("Only office staff can manage letter requests.")


def _own_student(request):
    if getattr(request.user, "role", None) != User.Role.STUDENT:
        return None
    return request.user._related_or_none("student")


def _inactive_refusal(request):
    """A 403 response for a student who is not Active, otherwise None."""
    if _is_office(request.user):
        return None
    refusal = inactive_student_refusal(request.user)
    return Response(refusal, status=status.HTTP_403_FORBIDDEN) if refusal else None


def _letter_for(request, pk):
    """The letter if the caller is its student, one of its lecturers or office
    staff, else 404. Appointment letters are shown only once issued."""
    letter = get_object_or_404(GeneratedLetter.objects.select_related("decided_by"), pk=pk)
    if _is_office(request.user):
        return letter
    if letter.is_automatic and letter.status not in SEEN_BY_RECIPIENTS:
        raise NotFound("Letter not found.")
    student = _own_student(request)
    if student is not None and letter.student_id == student.pk:
        return letter
    if letter.is_automatic and student is None and letter.recipients.filter(pk=request.user.pk).exists():
        return letter
    raise NotFound("Letter not found.")


def _conflict(detail):
    return Response({"detail": detail}, status=status.HTTP_409_CONFLICT)


def _not_pending(letter):
    return _conflict(f"This request is already {letter.get_status_display().lower()}.")


def _student_name(letter):
    return (letter.student_data or {}).get("studentName") or "the student"


# Notifications and email


def _notify(recipient, letter, *, event_key, title, summary, message, record_type, priority=Notification.Priority.NORMAL):
    send_notice(
        recipient,
        event_key=event_key,
        title=title,
        summary=summary,
        message=message,
        record_type=record_type,
        record_id=letter.pk,
        reference=letter.reference_number or "",
        priority=priority,
    )


def _notify_office(letter):
    matric = (letter.student_data or {}).get("matricNumber", "")
    organisation = (letter.request_details or {}).get("organisation")
    message = f"{_student_name(letter)} ({matric}) asked for a {letter.template_name}"
    message += f" for {organisation}." if organisation else "."
    if letter.student_note:
        message += f" Their note: {letter.student_note}"
    for user in User.objects.filter(role=User.Role.OFFICE_ADMIN, is_active=True):
        _notify(
            user,
            letter,
            event_key=f"letters:request-new:{letter.pk}",
            title=f"Letter request: {letter.template_name}",
            summary=f"From {_student_name(letter)} ({matric})",
            message=message,
            record_type=REQUEST_RECORD,
        )


def _email_student(letter, subject, message):
    user = letter.student.user
    transaction.on_commit(
        lambda: email_users(
            [user],
            LETTER,
            subject,
            f"{message}\n\nOpen it in the portal: {portal_link('/letters/my-letters')}\n\n"
            "You get this email because email alerts are on in your Settings.\n\n"
            f"{SIGN_OFF}",
        )
    )


def _notify_ready(letter, event_key, replaced=()):
    _notify(
        letter.student.user,
        letter,
        event_key=event_key,
        title=f"Letter approved: {letter.template_name}",
        summary=f"Reference {letter.reference_number}",
        message=(
            f"Your {letter.template_name} was approved on {letter.issued_on.strftime('%d %B %Y')} "
            f"with reference {letter.reference_number}. You can view, print or download it "
            "from My Requests."
            + (f" It replaces {', '.join(replaced)}, which is no longer valid." if replaced else "")
        ),
        record_type=LETTER_RECORD,
    )


# Listing


def _parse_day(value, field):
    try:
        return date.fromisoformat(value), None
    except ValueError:
        return None, {field: "Use the YYYY-MM-DD format."}


def _office_register(params):
    """Every request for office staff, narrowed by the optional filters.

    ``status`` takes one status or several separated by commas. ``from`` and
    ``to`` bound the issue date, so they only match issued letters. ``madeBy``
    is ``request`` or ``automatic``.
    """
    letters = GeneratedLetter.objects.select_related("decided_by")
    made_by = (params.get("madeBy") or "").strip().lower()
    if made_by == "request":
        letters = letters.filter(purpose=LetterPurpose.REQUEST)
    elif made_by == "automatic":
        letters = letters.filter(purpose__in=AUTOMATIC_PURPOSES)
    elif made_by:
        return None, {"madeBy": "Use request or automatic."}
    search = (params.get("search") or "").strip()
    if search:
        letters = letters.filter(
            Q(reference_number__icontains=search)
            | Q(template_name__icontains=search)
            | Q(student_data__studentName__icontains=search)
            | Q(student_data__matricNumber__icontains=search)
        )
    for field, lookup in (("from", "issued_on__gte"), ("to", "issued_on__lte")):
        value = (params.get(field) or "").strip()
        if value:
            day, error = _parse_day(value, field)
            if error:
                return None, error
            letters = letters.filter(**{lookup: day})
    status_param = (params.get("status") or "").strip()
    if status_param:
        known = {choice.lower(): choice for choice in Status.values}
        wanted = [known.get(part.strip().lower()) for part in status_param.split(",") if part.strip()]
        if not wanted or None in wanted:
            return None, {"status": f"Use one or more of: {', '.join(Status.values)}."}
        letters = letters.filter(status__in=wanted)
    return letters, None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def letter_requests(request):
    """GET: the caller's requests (office: all of them). POST: a student asks for a letter."""
    if request.method == "POST":
        return _create_request(request)
    if _is_office(request.user):
        letters, error = _office_register(request.query_params)
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)
    else:
        student = _own_student(request)
        if student is None:
            raise PermissionDenied("Only students and office staff can view letter requests.")
        refused = _inactive_refusal(request)
        if refused:
            return refused
        letters = (
            GeneratedLetter.objects.filter(student=student)
            .exclude(Q(purpose__in=AUTOMATIC_PURPOSES) & ~Q(status__in=SEEN_BY_RECIPIENTS))
            .select_related("decided_by")
        )
    return Response([letter.to_public_dict(include_content=False) for letter in letters])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def request_counts(request):
    """Office: how many requests are in each status, for the tab badge and filters."""
    _require_office(request)
    counts = dict(GeneratedLetter.objects.values_list("status").annotate(n=Count("id")))
    return Response({value: counts.get(value, 0) for value in Status.values})


def _create_request(request):
    student = _own_student(request)
    if student is None:
        raise PermissionDenied("Only students can request letters.")
    refusal = inactive_student_refusal(request.user)
    if refusal:
        return Response(refusal, status=status.HTTP_403_FORBIDDEN)

    try:
        template_id = int(request.data.get("templateId"))
    except (TypeError, ValueError):
        return Response({"templateId": "Choose a letter."}, status=status.HTTP_400_BAD_REQUEST)
    note = str(request.data.get("note") or "").strip()
    if len(note) > MAX_NOTE_LENGTH:
        return Response(
            {"note": f"Keep the note under {MAX_NOTE_LENGTH} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    template = LetterTemplate.objects.filter(
        pk=template_id, status=LetterTemplate.Status.ACTIVE, purpose=LetterPurpose.REQUEST
    ).first()
    if template is None:
        raise NotFound("This letter is no longer available.")
    unknown, malformed = placeholder_problems(f"{template.content}\n{template.content_ms}", known_fields(template))
    if unknown or malformed or not template.content.strip():
        return _conflict("This letter cannot be requested right now. Please contact the postgraduate office.")
    details, chosen, errors = {}, [], {}
    recipient = template.question("recipient")
    if recipient:
        cleaned, problems, item = clean_request_details(request.data.get("details"), recipient)
        if problems:
            errors.update(problems)
        else:
            details = cleaned
            offered = template.optional_details()
            details["include"] = [code for code in details["include"] if code in offered]
            chosen += [item] if item else []
    answers, answer_errors, answer_items = clean_answers(template.form_questions, request.data.get("answers"))
    if answer_errors:
        errors["answers"] = answer_errors
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    if answers:
        details["answers"] = answers
    chosen += answer_items

    pending = Response(
        {
            "detail": "You already asked for this letter. Wait for the office's decision, "
            "or withdraw that request to ask again.",
            "code": PENDING_CODE,
        },
        status=status.HTTP_409_CONFLICT,
    )
    if GeneratedLetter.objects.filter(student=student, template=template, status=Status.PENDING).exists():
        return pending
    try:
        with transaction.atomic():
            letter = GeneratedLetter.objects.create(
                student=student,
                template=template,
                template_name=template.name,
                letter_type=template.letter_type,
                student_data=letter_details(student),
                student_note=note,
                request_details=details,
                status=Status.PENDING,
                requested_by=request.user,
            )
            letter.choice_items.set(chosen)
            _notify_office(letter)
    except IntegrityError:
        # A second request raced this one past the check above.
        return pending
    return Response(letter.to_public_dict(include_content=False), status=status.HTTP_201_CREATED)


def _earlier_copies(letter):
    """The student's issued copies of the same letter, which a newly approved
    request replaces (a student pass letter, say, is only valid for months).
    A letter addressed to someone replaces only the copy for that recipient."""
    if letter.is_automatic or letter.student_id is None or letter.template_id is None:
        return []
    copies = GeneratedLetter.objects.filter(
        student_id=letter.student_id,
        template_id=letter.template_id,
        purpose=LetterPurpose.REQUEST,
        status=Status.ISSUED,
    ).exclude(pk=letter.pk)
    if (letter.request_details or {}).get("organisation"):
        return [old for old in copies if same_recipient(old.request_details, letter.request_details)]
    return list(copies)


def _review(letter):
    """What the office needs to decide a pending request: the template's current
    wording and every value it needs, from the student's record or typed in."""
    template = letter.template
    content, content_ms = letter_wording(template, letter.request_details) if template else ("", "")
    custom = template.custom_fields if template else []
    values = request_values(letter_values(letter), letter.request_details)
    answers = (letter.request_details or {}).get("answers") or {}
    student = {
        question["name"]: {"label": question["label"], "value": answer_values(answers).get(question["name"], "")}
        for question in custom_questions(template.form_questions if template else [])
    }
    unknown, malformed = placeholder_problems(
        f"{content}\n{content_ms}", known_fields(template) if template else [], template.purpose if template else LetterPurpose.REQUEST
    )
    if template is None:
        problem = "The letter template was deleted."
    elif template.purpose != letter.purpose:
        problem = "The template is no longer used for this kind of letter. Choose it again in the template."
    elif unknown or malformed or not content.strip():
        problem = "The template has placeholder problems. Fix the template first."
    elif letter.is_automatic and letter.appointment is None:
        problem = "The appointment for this letter no longer exists."
    elif letter.student is None:
        problem = "The student's account no longer exists."
    elif letter.student.status != letter.student.Status.ACTIVE:
        problem = (
            f"The student's status is now {letter.student.status}. Letters are issued only "
            "to Active students, so reject this request with the reason."
        )
    else:
        problem = None
    today = timezone.localdate()
    valid_until = add_months(today, template.valid_months) if template and template.valid_months else None
    preview = {**values, "validUntil": english_date(valid_until).upper()}
    malay = malay_values({**preview, "_issuedOn": today, "_validUntil": valid_until})
    malay_answers = {
        name: text for name, text in answer_values(answers, malay=True).items() if text != answer_values(answers).get(name)
    }
    return {
        "templateContent": content,
        "templateContentMs": content_ms,
        "previewValidUntil": preview["validUntil"],
        "malayValues": {
            name: str(malay.get(VALUE_KEYS[name]) or "")
            for name in used_names(content_ms)
            if name in VALUE_KEYS and malay.get(VALUE_KEYS[name]) != preview.get(VALUE_KEYS[name])
        }
        | malay_answers,
        "templateStatus": template.status if template else None,
        "referencePrefix": template.reference_prefix if template else "",
        # Who will sign it: the letter takes the template's signatory when issued.
        "signatoryName": template.signatory_name if template else "",
        "signatoryTitle": template.signatory_title if template else "",
        "signatoryNameMs": template.signatory_name_ms if template else "",
        "signatoryTitleMs": template.signatory_title_ms if template else "",
        "fields": letter_fields(f"{content}\n{content_ms}", values, custom, student),
        "problem": problem,
        "replaces": [
            {"id": str(old.pk), "referenceNumber": old.reference_number, "issuedAt": old.to_public_dict(include_content=False)["issuedAt"]}
            for old in _earlier_copies(letter)
        ],
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recipient_options_view(request):
    """The visible purposes and organisations a student chooses from, and the optional details."""
    return Response(
        {
            "purposes": recipient_options(),
            "optionalDetails": [{"code": code, "label": label} for code, label, _ in OPTIONAL_DETAILS],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def letter_form(request, template_id):
    """The questions a letter's form asks, with what the student chooses from.
    Students get it for Active request letters; office staff for any, to preview."""
    refused = _inactive_refusal(request)
    if refused:
        return refused
    templates = LetterTemplate.objects.filter(purpose=LetterPurpose.REQUEST)
    if not _is_office(request.user):
        if _own_student(request) is None:
            raise PermissionDenied("Only students ask for letters.")
        templates = templates.filter(status=LetterTemplate.Status.ACTIVE)
    template = templates.filter(pk=template_id).first()
    if template is None:
        raise NotFound("This letter is no longer available.")
    return Response({"templateId": str(template.pk), "questions": resolve(template), "readyInDays": template.ready_in_days})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def letter_detail(request, pk):
    """One request. Its wording is shown only once issued, and to students only
    then; office staff also get what they need to review a pending one."""
    refused = _inactive_refusal(request)
    if refused:
        return refused
    letter = _letter_for(request, pk)
    office = _is_office(request.user)
    show_content = letter.status == Status.ISSUED or (office and letter.status == Status.REVOKED)
    data = letter.to_public_dict(include_content=show_content)
    if letter.is_automatic:
        data["recipients"] = recipient_rows(letter)
    if office:
        data["officeValues"] = letter.office_values or {}
        if letter.status == Status.PENDING:
            data.update(_review(letter))
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def withdraw_request(request, pk):
    """Student: take back a request the office has not decided yet."""
    if _own_student(request) is None:
        raise PermissionDenied("Only the student who asked can withdraw a request.")
    refused = _inactive_refusal(request)
    if refused:
        return refused
    with transaction.atomic():
        owned = _letter_for(request, pk)
        letter = GeneratedLetter.objects.select_for_update().get(pk=owned.pk)
        if letter.is_automatic:
            return _conflict("An appointment letter comes from the office and cannot be withdrawn.")
        if letter.status != Status.PENDING:
            return _not_pending(letter)
        letter.status = Status.WITHDRAWN
        letter.withdrawn_at = timezone.now()
        letter.save(update_fields=["status", "withdrawn_at"])
    return Response(letter.to_public_dict(include_content=False))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_request(request, pk):
    """Office: fill in the missing values and issue the letter."""
    _require_office(request)
    typed_in = request.data.get("values") or {}
    if not isinstance(typed_in, dict):
        return Response({"values": "Send the values as name: value pairs."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        letter = get_object_or_404(GeneratedLetter.objects.select_for_update(), pk=pk)
        if letter.status != Status.PENDING:
            return _not_pending(letter)
        review = _review(letter)
        if review["problem"]:
            return _conflict(review["problem"])

        typed, errors = {}, {}
        for field in review["fields"]:
            if not field["needed"]:
                continue
            value = str(typed_in.get(field["name"]) or "").strip()
            problem = value_problem(value)
            if problem:
                errors[field["name"]] = problem
            else:
                typed[field["name"]] = value
        if errors:
            return Response(
                {"detail": "Fill in every value before approving.", "fieldErrors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issue_letter(letter, letter.template, letter_values(letter), typed, request.user)
        reference = letter.reference_number
        if letter.is_automatic:
            notify_recipients(letter)
            return Response(letter.to_public_dict())
        replaced = []
        earlier = [old.pk for old in _earlier_copies(letter)]
        for old in GeneratedLetter.objects.select_for_update().filter(pk__in=earlier):
            old.status = Status.REVOKED
            old.revoked_at = letter.decided_at or timezone.now()
            old.revoked_by = request.user
            old.revoke_reason = f"Replaced by {reference}."
            old.replaced_by = letter
            old.save(update_fields=["status", "revoked_at", "revoked_by", "revoke_reason", "replaced_by"])
            replaced.append(old.reference_number)
        _notify_ready(letter, f"letters:request-approved:{letter.pk}", replaced)
        _email_student(
            letter,
            f"Letter approved: {letter.template_name}",
            f"Your {letter.template_name} was approved with reference {reference}. "
            "You can view, print or download it now."
            + (
                f"\n\nIt replaces your earlier {letter.template_name} ({', '.join(replaced)}), "
                "which is no longer valid."
                if replaced
                else ""
            ),
        )
    return Response(letter.to_public_dict())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_request(request, pk):
    """Office: turn a request down. The reason is shown to the student."""
    _require_office(request)
    reason = str(request.data.get("reason") or "").strip()
    if not reason:
        return Response(
            {"reason": "Give the reason, so the student knows what to do."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(reason) > MAX_REASON_LENGTH:
        return Response(
            {"reason": f"Keep the reason under {MAX_REASON_LENGTH} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    with transaction.atomic():
        letter = get_object_or_404(GeneratedLetter.objects.select_for_update(), pk=pk)
        if letter.status != Status.PENDING:
            return _not_pending(letter)
        letter.status = Status.REJECTED
        letter.reject_reason = reason
        letter.decided_by = request.user
        letter.decided_at = timezone.now()
        letter.save(update_fields=["status", "reject_reason", "decided_by", "decided_at"])
        # Nobody asked for an appointment letter, so there is nobody to tell.
        if letter.student is not None and not letter.is_automatic:
            _notify(
                letter.student.user,
                letter,
                event_key=f"letters:request-rejected:{letter.pk}",
                title=f"Letter request not approved: {letter.template_name}",
                summary="See the reason in My Requests",
                message=(
                    f"The postgraduate office did not approve your request for a {letter.template_name}. "
                    f"Reason: {reason} You can request it again when ready."
                ),
                record_type=LETTER_RECORD,
            )
            _email_student(
                letter,
                f"Letter request not approved: {letter.template_name}",
                f"The postgraduate office did not approve your request for a {letter.template_name}.\n\n"
                f"Reason: {reason}\n\nYou can request it again when ready.",
            )
    return Response(letter.to_public_dict(include_content=False))


def _file_name(letter):
    slug = re.sub(r"[^a-z0-9]+", "_", letter.template_name, flags=re.IGNORECASE).strip("_")
    matric = re.sub(r"[^a-z0-9]+", "", (letter.student_data or {}).get("matricNumber", ""), flags=re.IGNORECASE)
    return f"UM_{slug or 'Letter'}{f'_{matric}' if matric else ''}.pdf"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def letter_pdf(request, pk):
    """An issued letter as a PDF locked against editing, for its student or office staff."""
    refused = _inactive_refusal(request)
    if refused:
        return refused
    letter = _letter_for(request, pk)
    if letter.status == Status.REVOKED:
        return _conflict("This letter was revoked and can no longer be downloaded.")
    if letter.status != Status.ISSUED:
        return _conflict("This letter has not been issued.")
    response = HttpResponse(build_letter_pdf(letter), content_type=PDF_TYPE)
    response["Content-Disposition"] = f'attachment; filename="{_file_name(letter)}"'
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_notification(request, pk):
    """Office: send the student the "letter approved" notification again."""
    _require_office(request)
    with transaction.atomic():
        letter = get_object_or_404(GeneratedLetter.objects.select_for_update(), pk=pk)
        if letter.status != Status.ISSUED:
            return _conflict("Only an issued letter's notification can be sent again.")
        if letter.student is None:
            return _conflict("The student's account no longer exists.")
        letter.resend_count += 1
        letter.save(update_fields=["resend_count"])
        if letter.is_automatic:
            notify_recipients(letter, resend=letter.resend_count)
            return Response({"detail": "Notifications sent again to everyone on the letter."})
        _notify_ready(letter, f"letters:request-approved:{letter.pk}:resend-{letter.resend_count}")
    return Response({"detail": f"Notification sent again to {_student_name(letter)}."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def revoke_letter(request, pk):
    """Office: revoke a letter issued in error. The reason is shown to the student."""
    _require_office(request)
    reason = str(request.data.get("reason") or "").strip()
    if not reason:
        return Response({"reason": "Give a reason for revoking this letter."}, status=status.HTTP_400_BAD_REQUEST)
    if len(reason) > MAX_REASON_LENGTH:
        return Response(
            {"reason": f"Keep the reason under {MAX_REASON_LENGTH} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    with transaction.atomic():
        letter = get_object_or_404(GeneratedLetter.objects.select_for_update(), pk=pk)
        if letter.status == Status.REVOKED:
            return _conflict("This letter is already revoked.")
        if letter.status != Status.ISSUED:
            return _conflict("Only an issued letter can be revoked.")
        if letter.is_automatic:
            revoke_appointment_letter(letter, actor=request.user, reason=reason)
            return Response(letter.to_public_dict())
        letter.status = Status.REVOKED
        letter.revoked_at = timezone.now()
        letter.revoked_by = request.user
        letter.revoke_reason = reason
        letter.save(update_fields=["status", "revoked_at", "revoked_by", "revoke_reason"])
        if letter.student is not None:
            _notify(
                letter.student.user,
                letter,
                event_key=f"letters:letter-revoked:{letter.pk}",
                title=f"Letter revoked: {letter.template_name}",
                summary=f"Reference {letter.reference_number}",
                message=(
                    f"The postgraduate office revoked your {letter.template_name} "
                    f"({letter.reference_number}). Reason: {reason}"
                ),
                record_type=LETTER_RECORD,
                priority=Notification.Priority.HIGH,
            )
        if letter.student is not None:
            # A student may already be using the letter, so the email goes out
            # like the approval and rejection emails do.
            _email_student(
                letter,
                f"Letter revoked: {letter.template_name}",
                f"The postgraduate office revoked your {letter.template_name} ({letter.reference_number}). "
                f"It is no longer valid.\n\nReason: {reason}",
            )
    return Response(letter.to_public_dict())


def _selection(data):
    """``(kind, appointment id)`` pairs from a create request, or an error body."""
    if data.get("all") is True:
        return [(row["kind"], row["appointmentId"]) for row in missing_appointment_letters() if not row["problem"]], None
    items = data.get("appointments")
    if not isinstance(items, list) or not items:
        return None, {"appointments": "Choose at least one appointment, or send all: true."}
    if len(items) > MAX_CREATE:
        return None, {"appointments": f"Choose at most {MAX_CREATE} appointments at a time."}
    selection = []
    for item in items:
        kind = item.get("kind") if isinstance(item, dict) else None
        try:
            appointment_id = int(item.get("id")) if isinstance(item, dict) else None
        except (TypeError, ValueError):
            appointment_id = None
        if kind not in KINDS or appointment_id is None:
            return None, {"appointments": f"Each item needs a kind ({', '.join(KINDS)}) and an id."}
        selection.append((kind, appointment_id))
    return list(dict.fromkeys(selection)), None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def missing_letters(request):
    """Office: active appointments that have no letter yet, and why."""
    _require_office(request)
    return Response(missing_appointment_letters())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_missing_letters(request):
    """Office: make the letters for the chosen appointments (or all that can be made)."""
    _require_office(request)
    selection, error = _selection(request.data)
    if error:
        return Response(error, status=status.HTTP_400_BAD_REQUEST)
    results = create_letters(selection, request.user)
    made = sum(1 for row in results if row["letterId"])
    return Response({"made": made, "results": results})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def received_letters(request):
    """The appointment letters the caller received as a lecturer. ``?student=``
    narrows them to one student's matric number."""
    letters = GeneratedLetter.objects.filter(
        recipients=request.user, purpose__in=AUTOMATIC_PURPOSES, status__in=SEEN_BY_RECIPIENTS
    ).select_related("decided_by")
    matric = (request.query_params.get("student") or "").strip()
    if matric:
        letters = letters.filter(student__matric_no__iexact=matric)
    return Response([letter.to_public_dict(include_content=False) for letter in letters])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reissue(request, pk):
    """Office: issue an appointment letter again with the current details."""
    _require_office(request)
    typed_in = request.data.get("values")
    if typed_in is not None and not isinstance(typed_in, dict):
        return Response({"values": "Send the values as name: value pairs."}, status=status.HTTP_400_BAD_REQUEST)
    get_object_or_404(GeneratedLetter, pk=pk)
    try:
        letter = reissue_letter(pk, request.user, typed_in)
    except LetterRefused as refused:
        return _conflict(str(refused))
    except LetterValuesMissing as missing:
        return Response(
            {"detail": "Fill in every value before reissuing.", "fieldErrors": missing.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(letter.to_public_dict(), status=status.HTTP_201_CREATED)
