"""Seed a starter set of official letter templates.

Idempotent: re-running updates the existing rows (matched by name) instead of
creating duplicates. The body text uses the same ``{{PLACEHOLDER}}`` tags the
frontend substitutes when a student generates a letter:

    {{STUDENT_NAME}} {{STUDENT_ID}} {{PROGRAMME_NAME}} {{CURRENT_STATUS}}
    {{SUPERVISOR_NAME}} {{REFERENCE_NUMBER}} {{CURRENT_DATE}}
"""
from importlib import import_module

from django.core.management.base import BaseCommand

from letters.models import LetterTemplate

# The same wording the migration adds, so a fresh seed matches a migrated database.
confirmation = import_module("letters.migrations.0007_student_confirmation_letter")

TEMPLATES = [
    {
        "name": "Student Confirmation Letter",
        "letter_type": "Academic Certification",
        "status": LetterTemplate.Status.ACTIVE,
        "reference_prefix": "UMF/PG/SCL",
        "description": "Confirms the student is registered, for banks, agencies, sponsors and transport companies.",
        "content": confirmation.CONTENT,
        "content_ms": confirmation.CONTENT_MS,
        "asks_recipient": True,
        "form_questions": [{"kind": "recipient", "purposes": [], "askAddress": True}, {"kind": "extras"}],
        "valid_months": 3,
        "ready_in_days": 2,
        "signatory_name": "Dean / Director",
        "signatory_name_ms": "Dekan / Pengarah",
    },
    {
        # Replaced by the Student Confirmation Letter.
        "name": "Confirmation of Enrolment",
        "letter_type": "Academic Certification",
        "status": LetterTemplate.Status.ARCHIVED,
        "reference_prefix": "UMF/PG/ENR",
        "description": "Official status verification for currently registered students.",
        "content": (
            "To Whom It May Concern,\n\n"
            "This is to certify that {{STUDENT_NAME}} (Matric No: {{STUDENT_ID}}) is a "
            "bona fide postgraduate student at the Faculty of Computer Science & "
            "Information Technology, Universiti Malaya.\n\n"
            "The student is currently pursuing the {{PROGRAMME_NAME}} and their present "
            "registration status is {{CURRENT_STATUS}}. This letter is issued upon the "
            "student's request for official purposes.\n\n"
            "Should you require any further verification, please contact the "
            "Postgraduate Office at +603-7967 6300."
        ),
    },
    {
        "name": "Visa Support Letter",
        "letter_type": "Visa & Immigration",
        "status": LetterTemplate.Status.ACTIVE,
        "reference_prefix": "UMF/PG/VS",
        "description": "Embassy-ready documentation supporting a student visa application.",
        "content": (
            "To Whom It May Concern,\n\n"
            "This letter is issued to support the student visa application of "
            "{{STUDENT_NAME}} (Matric No: {{STUDENT_ID}}) with the Immigration "
            "Department of Malaysia.\n\n"
            "{{STUDENT_NAME}} is a full-time candidate of the {{PROGRAMME_NAME}} and is "
            "currently {{CURRENT_STATUS}}. The Faculty fully supports the continuation "
            "of their studies and requests that the necessary visa facilities be "
            "extended to the candidate."
        ),
    },
    {
        "name": "Supervisor Confirmation Letter",
        "letter_type": "Academic Certification",
        "status": LetterTemplate.Status.ACTIVE,
        "reference_prefix": "UMF/PG/SUP",
        "description": "Confirms the student's appointed research supervisor.",
        "content": (
            "To Whom It May Concern,\n\n"
            "This is to confirm that {{STUDENT_NAME}} (Matric No: {{STUDENT_ID}}), a "
            "candidate of the {{PROGRAMME_NAME}}, is currently under the supervision of "
            "{{SUPERVISOR_NAME}} at the Faculty of Computer Science & Information "
            "Technology, Universiti Malaya.\n\n"
            "The candidate's registration status is {{CURRENT_STATUS}}."
        ),
    },
    {
        # Real letter supplied by the postgraduate office (visa / student-pass
        # renewal). Auto-filled fields use the standard placeholders; the
        # immigration-specific fields (passport, country, research, semesters)
        # have no system data source, so they render as blank fill-in lines for
        # the office to complete by hand.
        "name": "Confirmation Letter for Student Pass Renewal",
        "letter_type": "Visa & Immigration",
        "status": LetterTemplate.Status.ACTIVE,
        "reference_prefix": "UM.W/606/2",
        "description": "EMGS / Immigration confirmation letter supporting a student pass (visa) renewal.",
        "content": (
            "HEAD OF STUDENT PASS UNIT\n"
            "Immigration Department of Malaysia\n"
            "Wilayah Persekutuan Kuala Lumpur EMGS Branch\n"
            "Menara TA One\n"
            "No 22 Jalan P. Ramlee\n"
            "50250 Kuala Lumpur\n\n"
            "Dear Sir/Madam,\n\n"
            "**CONFIRMATION LETTER FOR STUDENT PASS RENEWAL**\n\n"
            "This is to confirm that the following student is currently pursuing "
            "studies at the Faculty of Computer Science & Information Technology, "
            "Universiti Malaya. The details of this candidate are as follows:\n\n"
            "**STUDENT DETAILS**\n\n"
            "NAME: {{STUDENT_NAME}}\n"
            "MATRIC NUMBER: {{STUDENT_ID}}\n"
            "PASSPORT NUMBER: {{PASSPORT_NUMBER}}\n"
            "COUNTRY: {{COUNTRY}}\n"
            "STATUS: {{CURRENT_STATUS}}\n\n"
            "**PROGRAMME OF STUDY DETAILS**\n\n"
            "PROGRAMME: {{PROGRAMME_NAME}}\n"
            "PROGRAMME MODE: {{PROGRAMME_MODE}}\n"
            "FIELD OF RESEARCH: {{FIELD_OF_RESEARCH}}\n"
            "MODE OF STUDY: {{MODE_OF_STUDY}}\n"
            "INITIAL SEMESTER: {{INITIAL_SEMESTER}}\n"
            "CURRENT SEMESTER: {{CURRENT_SEMESTER}}\n"
            "MAXIMUM SEMESTER: {{MAX_SEMESTER}}\n"
            "SUPERVISOR(S): {{SUPERVISOR_NAME}}\n"
            "EXPECTED COMPLETION OF STUDY: {{EXPECTED_COMPLETION}}\n\n"
            "Should you require any further enquiries, please do not hesitate to "
            "contact us at +603-7967 6408.\n\n"
            "Thank you."
        ),
    },
    {
        "name": "Completion Letter",
        "letter_type": "Academic Certification",
        "status": LetterTemplate.Status.DRAFT,
        "reference_prefix": "UMF/PG/CMP",
        "description": "Proof of degree fulfilment, issued after the viva.",
        "content": (
            "To Whom It May Concern,\n\n"
            "We are pleased to verify that {{STUDENT_NAME}} (Matric No: {{STUDENT_ID}}) "
            "has satisfactorily fulfilled all academic requirements for the "
            "{{PROGRAMME_NAME}}.\n\n"
            "The final Senate approval is pending formal conferral at the upcoming "
            "university graduation ceremony."
        ),
    },
]


class Command(BaseCommand):
    help = "Seed / update the default letter templates."

    def handle(self, *args, **options):
        for data in TEMPLATES:
            obj, created = LetterTemplate.objects.update_or_create(
                name=data["name"],
                defaults={**data, "modified_by": "System Seed"},
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(f"  {verb} {obj.status:7} {obj.name}")
        self.stdout.write(self.style.SUCCESS("\nLetter templates ready."))
