"""Issuing a letter: its reference number, date, wording and signatory.

Used when the office approves a request and when an appointment letter is
issued by itself, so both kinds of letter are filled the same way.
"""
from django.utils import timezone

from .confirmation import add_months, drop_unchosen_lines, english_date, malay_typed, malay_values, request_values
from .form_questions import answer_values, question_names
from .models import GeneratedLetter
from .placeholders import fill_placeholders
from .references import next_reference_number


def letter_wording(template, details):
    """The English and Malay wording to fill, without the optional lines the
    student did not tick when the letter asks about them."""
    english, malay = template.content or "", template.content_ms or ""
    if template.question("extras"):
        include = (details or {}).get("include")
        english, malay = drop_unchosen_lines(english, include), drop_unchosen_lines(malay, include)
    return english, malay


def issue_letter(letter, template, values, typed, actor):
    """Fill ``letter`` from ``template`` and save it as Issued.

    Call it inside the transaction that saves the letter, so the reference
    number is only used up if the letter is saved.
    """
    issued_on = timezone.localdate()
    reference = next_reference_number(template.reference_prefix, issued_on.year)
    details = letter.request_details or {}
    valid_until = add_months(issued_on, template.valid_months) if template.valid_months else None
    values = {
        **request_values(values, details),
        "referenceNumber": reference,
        "date": english_date(issued_on),
        "validUntil": english_date(valid_until).upper(),
    }
    english, malay = letter_wording(template, details)
    answers = details.get("answers")
    unanswered = dict.fromkeys(question_names(template.form_questions), "")
    letter.content = fill_placeholders(english, values, {**unanswered, **answer_values(answers), **typed})
    letter.content_ms = (
        fill_placeholders(
            malay,
            malay_values({**values, "_issuedOn": issued_on, "_validUntil": valid_until}),
            {**unanswered, **answer_values(answers, malay=True), **malay_typed(typed)},
        )
        if malay.strip()
        else ""
    )
    letter.valid_until = valid_until
    letter.student_data = values
    letter.office_values = typed
    letter.template = template
    letter.template_name = template.name
    letter.letter_type = template.letter_type
    letter.signatory_name = template.signatory_name
    letter.signatory_title = template.signatory_title
    letter.signatory_name_ms = template.signatory_name_ms
    letter.signatory_title_ms = template.signatory_title_ms
    letter.reference_number = reference
    letter.issued_on = issued_on
    letter.status = GeneratedLetter.Status.ISSUED
    letter.decided_by = actor
    letter.decided_at = timezone.now()
    letter.save()
    return letter
