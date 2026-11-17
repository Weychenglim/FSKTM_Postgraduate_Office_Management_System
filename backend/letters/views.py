"""Letter-template API: list/create + retrieve/update/delete.

Mounted under ``/api/letter-templates/`` by the project URLconf.

- Any authenticated user can read templates (students fetch ``?status=Active``).
  Only staff get a template's wording and office-filled fields: a student sees
  a letter's text only once the office has approved their request.
- Only office staff / coordinators can create, update, or delete them.
- Students get 404 for a template that is not Active, so draft ids stay hidden.
- Students whose own status is not Active get 403 (see ``eligibility.py``).
- A template is used for student requests, or for supervisor or panel
  appointment letters, which are made by themselves. Students only see
  request templates, and each appointment letter has one Active template.
"""
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import Student

from .choice_lists import recipients_list
from .confirmation import request_values
from .details import letter_details
from .eligibility import inactive_student_refusal, open_templates, template_refusal
from .form_questions import clean_questions, known_fields, question_names
from .models import GeneratedLetter, LetterPurpose, LetterTemplate
from .placeholders import VALUE_KEYS, field_names, placeholder_catalogue, placeholder_problems, purpose_hint
from .serializers import LetterTemplateSerializer

ACTIVE_CLASH_CODE = "appointment_template_already_active"

# Only Office Staff manage letter types (UC21). Everyone else reads live ones.
STAFF_ROLES = {"Office Staff/Admin"}


def _is_staff(user):
    # Keyed on the role, not ``is_staff`` or superuser status. Those flags only
    # concern Django admin and should not confer template-management rights.
    return getattr(user, "role", None) in STAFF_ROLES


def _require_staff(request):
    """Raise 403 unless the caller may manage templates."""
    if not _is_staff(request.user):
        raise PermissionDenied("Only office staff can manage letter templates.")


def _require_content(template):
    """Error dict when an Active template has no body, otherwise None."""
    if (
        template.status == LetterTemplate.Status.ACTIVE
        and not (template.content or "").strip()
    ):
        return {"content": "Letter content is required."}
    return None


def _placeholder_errors(content, custom_fields=(), purpose=LetterPurpose.REQUEST):
    """Error body when ``content`` uses unknown or malformed tags, otherwise None.

    The template's own office-filled fields are known tags, and so are the
    appointment placeholders its purpose allows.
    """
    unknown, malformed = placeholder_problems(content, custom_fields, purpose)
    if not unknown and not malformed:
        return None
    problems = []
    if unknown:
        problems.append(f"Unknown placeholder(s): {', '.join(unknown)}.")
        problems += [hint for hint in map(purpose_hint, unknown) if hint]
    if malformed:
        problems.append(
            f"Malformed placeholder(s): {', '.join(malformed)}. Write them as {{{{NAME}}}}."
        )
    return {
        "content": " ".join(problems),
        "unknownPlaceholders": unknown,
        "malformedPlaceholders": malformed,
    }


RECIPIENT_QUESTION = [{"kind": "recipient", "purposes": [], "askAddress": True}, {"kind": "extras"}]


def _apply_questions(template, data):
    """Check the student form and keep ``asks_recipient`` in step with it.
    Turning ``asksRecipient`` on or off adds or removes "Who is the letter for?"
    and "Additional information". Returns an error body, or None."""
    if "formQuestions" in data:
        recipients = recipients_list()
        codes = set(recipients.groups.values_list("code", flat=True)) if recipients else set()
        questions, error = clean_questions(data["formQuestions"], template.custom_fields, template.purpose, codes)
        if error:
            return {"formQuestions": error}
        template.form_questions = questions
    elif "asksRecipient" in data:
        others = [q for q in template.form_questions or [] if q.get("kind") not in ("recipient", "extras")]
        template.form_questions = (RECIPIENT_QUESTION + others) if data["asksRecipient"] else others
    template.asks_recipient = bool(template.question("recipient"))
    return None


def _template_errors(template):
    """Error body when either page uses tags the template cannot fill, otherwise None."""
    clash = field_names(template.custom_fields) & set(question_names(template.form_questions))
    if clash:
        return {"customFields": f"{{{{{sorted(clash)[0]}}}}} is both a student question and an office blank. Rename one."}
    for field, wording in (("content", template.content), ("contentMs", template.content_ms)):
        invalid = _placeholder_errors(wording, known_fields(template), template.purpose)
        if invalid:
            problem = invalid.pop("content")
            return {**invalid, field: problem}
    both = f"{template.content}\n{template.content_ms}"
    if template.form_questions and template.purpose != LetterPurpose.REQUEST:
        return {"formQuestions": "Only letters students ask for have a student form. Remove its questions first."}
    if template.asks_recipient and template.purpose != LetterPurpose.REQUEST:
        return {"asksRecipient": "Only letters students ask for can ask who the letter is for."}
    if not template.asks_recipient and "{{RECIPIENT}}" in both:
        return {"asksRecipient": "This letter shows who it is for. Add \"Who is the letter for?\" to the student form."}
    if template.asks_recipient and "{{RECIPIENT}}" not in (template.content or ""):
        return {"asksRecipient": "Students say who this letter is for, but the letter does not show it. Add Recipient from Student info."}
    if template.asks_recipient and (template.content_ms or "").strip() and "{{RECIPIENT}}" not in template.content_ms:
        return {"contentMs": "The Malay page does not show who the letter is for. Add Recipient to it too."}
    if "{{VALID_UNTIL}}" in both and not template.valid_months:
        return {"validMonths": "This letter shows a valid-until date. Say how many months it stays valid."}
    return None


def _actor(request):
    user = request.user
    return getattr(user, "full_name", "") or getattr(user, "email", "Office Staff")


def _active_clash(template):
    """409 body when another Active template already makes this kind of
    appointment letter, otherwise None."""
    if template.status != LetterTemplate.Status.ACTIVE or not template.is_automatic:
        return None
    other = (
        LetterTemplate.objects.filter(purpose=template.purpose, status=LetterTemplate.Status.ACTIVE)
        .exclude(pk=template.pk)
        .first()
    )
    if other is None:
        return None
    return {
        "detail": f"{other.name} is already the active {template.get_purpose_display().lower()}. "
        "Set it to Draft or archive it first.",
        "code": ACTIVE_CLASH_CODE,
    }


def _save(template):
    """Save, turning a lost race for the one Active appointment template into a 409 body."""
    try:
        with transaction.atomic():
            template.save()
    except IntegrityError:
        return _active_clash(template) or {
            "detail": "Another template was made active at the same time. Refresh and try again.",
            "code": ACTIVE_CLASH_CODE,
        }
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def placeholders_list(request):
    """The placeholders a template may use, with labels and where each value comes from."""
    return Response(placeholder_catalogue())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sample_values(request):
    """Staff: one student's details by tag (``?student=<matric number>``), to
    preview a letter type with real values before students ask for it."""
    _require_staff(request)
    matric = (request.query_params.get("student") or "").strip()
    student = Student.objects.select_related("user").filter(matric_no__iexact=matric).first() if matric else None
    if student is None:
        raise NotFound("No student has this matric number.")
    values = request_values(letter_details(student), {})
    return Response(
        {
            "studentName": student.user.full_name,
            "matricNumber": student.matric_no,
            "values": {name: str(values.get(key)) for name, key in VALUE_KEYS.items() if values.get(key)},
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def templates_list(request):
    """GET: list templates (optional ?status=Active). POST: create one (staff)."""
    if request.method == "GET":
        refusal = None if _is_staff(request.user) else inactive_student_refusal(request.user)
        if refusal:
            return Response(refusal, status=status.HTTP_403_FORBIDDEN)
        queryset = LetterTemplate.objects.all()
        if not _is_staff(request.user):
            # Unpublished wording is office-internal; students and lecturers
            # only ever see live templates they can request. Previously any
            # authenticated user could read drafts by passing ?status=Draft.
            queryset = queryset.filter(status=LetterTemplate.Status.ACTIVE, purpose=LetterPurpose.REQUEST)
        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status__iexact=status_param)
        include_wording = _is_staff(request.user)
        student = None if include_wording else request.user._related_or_none("student")
        templates = open_templates(student, queryset) if student is not None else queryset
        return Response([t.to_public_dict(include_wording=include_wording) for t in templates])

    _require_staff(request)
    serializer = LetterTemplateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if not serializer.validated_data.get("content", "").strip():
        return Response(
            {"content": "Letter content is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    template = LetterTemplate(modified_by=_actor(request), **serializer.to_model_kwargs())
    invalid = _apply_questions(template, serializer.validated_data) or _template_errors(template)
    if invalid:
        return Response(invalid, status=status.HTTP_400_BAD_REQUEST)
    clash = _active_clash(template) or _save(template)
    if clash:
        return Response(clash, status=status.HTTP_409_CONFLICT)
    return Response(template.to_public_dict(), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def templates_detail(request, pk):
    """Retrieve, update (PATCH), or delete a single template.

    PUT is intentionally unsupported: every serializer field except ``name`` is
    optional, so a PUT behaved identically to a PATCH rather than replacing the
    record, which is misleading for callers.
    """
    if request.method == "GET" and not _is_staff(request.user):
        refusal = inactive_student_refusal(request.user)
        if refusal:
            return Response(refusal, status=status.HTTP_403_FORBIDDEN)

    template = get_object_or_404(LetterTemplate, pk=pk)

    if request.method == "GET":
        staff = _is_staff(request.user)
        if not staff and (template.status != LetterTemplate.Status.ACTIVE or template.is_automatic):
            raise NotFound("Letter template not found.")
        refusal = None if staff else template_refusal(request.user, template)
        if refusal:
            return Response(refusal, status=status.HTTP_403_FORBIDDEN)
        return Response(template.to_public_dict(include_wording=staff))

    _require_staff(request)

    if request.method == "DELETE":
        # Approval fills the template's wording, so it must outlive its requests.
        waiting = template.generated_letters.filter(status=GeneratedLetter.Status.PENDING).count()
        if waiting:
            return Response(
                {
                    "detail": f"{waiting} request{'s' if waiting != 1 else ''} for this letter "
                    f"{'are' if waiting != 1 else 'is'} waiting for a decision. Approve or reject "
                    "them first, or archive the template instead."
                },
                status=status.HTTP_409_CONFLICT,
            )
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = LetterTemplateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    new_purpose = serializer.validated_data.get("purpose", template.purpose)
    if new_purpose != template.purpose:
        waiting = template.generated_letters.filter(status=GeneratedLetter.Status.PENDING).count()
        if waiting:
            return Response(
                {
                    "detail": f"{waiting} letter{'s' if waiting != 1 else ''} from this template "
                    f"{'are' if waiting != 1 else 'is'} waiting for a decision. Decide "
                    f"{'them' if waiting != 1 else 'it'} before changing what the template is used for."
                },
                status=status.HTTP_409_CONFLICT,
            )
    for field, value in serializer.to_model_kwargs().items():
        setattr(template, field, value)

    invalid = _apply_questions(template, serializer.validated_data) or _require_content(template)
    if not invalid and (
        set(serializer.validated_data)
        & {"content", "contentMs", "customFields", "purpose", "asksRecipient", "validMonths", "formQuestions"}
        or template.status == LetterTemplate.Status.ACTIVE
    ):
        invalid = _template_errors(template)
    if invalid:
        return Response(invalid, status=status.HTTP_400_BAD_REQUEST)

    template.modified_by = _actor(request)
    clash = _active_clash(template) or _save(template)
    if clash:
        return Response(clash, status=status.HTTP_409_CONFLICT)
    return Response(template.to_public_dict())
