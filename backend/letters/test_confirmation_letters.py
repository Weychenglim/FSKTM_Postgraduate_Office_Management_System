"""The student confirmation letter, as in Maya: the student says who the letter is
for and which optional details to show, the office approves it, and the letter
comes in English and Malay with a valid-until date and the semesters left."""
import io
from datetime import date
from importlib import import_module

from django.apps import apps
from django.test import SimpleTestCase
from django.utils import timezone
from pypdf import PdfReader
from rest_framework import status

from accounts.models import StudentRegistry

from .confirmation import add_months, malay_date, malay_values, semesters_left
from .management.commands.seed_letters import TEMPLATES
from .models import GeneratedLetter, LetterTemplate
from .recipients import recipient_block
from .test_letter_requests import REQUESTS, LetterRequestTestCase, make_student

MAYBANK = {
    "purpose": "BANKING",
    "organisation": "Malayan Banking Berhad (Maybank)",
    "addressLine1": "Maybank Universiti Malaya Branch",
    "addressLine2": "Jalan Universiti",
    "postcode": "50603",
    "city": "Kuala Lumpur",
    "state": "Wilayah Persekutuan Kuala Lumpur",
    "country": "Malaysia",
    "include": ["MIN_PERIOD", "MAX_PERIOD"],
}
KTMB = {
    "purpose": "TRANSPORTATION",
    "organisation": "Keretapi Tanah Melayu Berhad (KTMB)",
    "addressLine1": "Stesen Sentral Kuala Lumpur",
    "postcode": "50470",
    "city": "Kuala Lumpur",
    "state": "Wilayah Persekutuan Kuala Lumpur",
    "country": "Malaysia",
    "include": [],
}


class ConfirmationLetterTestCase(LetterRequestTestCase):
    def setUp(self):
        super().setUp()
        seeded = next(data for data in TEMPLATES if data["name"] == "Student Confirmation Letter")
        self.confirmation = LetterTemplate.objects.create(**seeded)

    def student(self, matric, **registry):
        user = make_student(matric)
        StudentRegistry.objects.filter(student__user=user).update(
            **{
                "mode_of_study": "Full Time",
                "current_semester": "Semester II, 2025/2026 Session",
                "expected_completion": "Semester I, 2026/2027 Session",
                "max_semester": "Semester I, 2027/2028 Session",
                **registry,
            }
        )
        return user

    def ask_for(self, user, details):
        self.client.force_authenticate(user)
        return self.client.post(REQUESTS, {"templateId": self.confirmation.pk, "details": details}, format="json")

    def issued_for(self, user, details, values=None):
        request_id = self.ask_for(user, details).data["id"]
        response = self.approve(request_id, values)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return GeneratedLetter.objects.get(pk=response.data["id"])


class AskingTests(ConfirmationLetterTestCase):
    def test_the_form_lists_purposes_banks_and_optional_details(self):
        self.client.force_authenticate(self.student("SCL001"))
        options = self.client.get(f"{REQUESTS}recipient-options/").data
        purposes = {row["code"]: row for row in options["purposes"]}
        self.assertEqual(list(purposes), ["BANKING", "GOVERNMENT", "MOBILITY", "NGO", "SPONSORSHIP", "TRANSPORTATION"])
        names = lambda code: [row["name"] for row in purposes[code]["organisations"]]
        self.assertIn("Malayan Banking Berhad (Maybank)", names("BANKING"))
        self.assertIn("Keretapi Tanah Melayu Berhad (KTMB)", names("TRANSPORTATION"))
        self.assertEqual([row["code"] for row in options["optionalDetails"]], ["MIN_PERIOD", "MAX_PERIOD", "CURRENT_SEMESTER"])

    def test_the_student_must_say_who_the_letter_is_for(self):
        user = self.student("SCL002")
        missing = self.ask_for(user, None)
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        blank = self.ask_for(user, {**MAYBANK, "purpose": "SHOPPING", "organisation": " "})
        self.assertEqual(set(blank.data), {"purpose"})
        no_name = self.ask_for(user, {**MAYBANK, "organisation": " "})
        self.assertEqual(set(no_name.data), {"organisation"})
        odd = self.ask_for(user, {**MAYBANK, "include": ["EVERYTHING"]})
        self.assertIn("include", odd.data)
        self.assertFalse(GeneratedLetter.objects.filter(student__user=user).exists())

    def test_the_address_is_needed_except_its_second_line(self):
        user = self.student("SCL008")
        no_address = self.ask_for(user, {**MAYBANK, "addressLine1": " ", "postcode": "", "city": "", "state": "", "country": ""})
        self.assertEqual(no_address.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(no_address.data), {"addressLine1", "postcode", "city", "state", "country"})
        self.assertEqual((no_address.data["state"], no_address.data["country"]), ("Choose the state.", "Choose the country."))
        no_second_line = self.ask_for(user, {**MAYBANK, "addressLine2": ""})
        self.assertEqual(no_second_line.status_code, status.HTTP_201_CREATED, no_second_line.data)

    def test_the_state_and_country_come_from_the_lists(self):
        user = self.student("SCL011")
        typed_state = self.ask_for(user, {**MAYBANK, "state": "WP"})
        self.assertEqual(typed_state.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(typed_state.data["state"], "Choose a state from the list.")
        typed_country = self.ask_for(user, {**MAYBANK, "country": "Malaya"})
        self.assertEqual(typed_country.data["country"], "Choose a country from the list.")
        abroad = self.ask_for(
            user,
            {**MAYBANK, "addressLine1": "1 Raffles Place", "postcode": "048616", "city": "Singapore", "state": "Selangor", "country": "Singapore"},
        )
        self.assertEqual(abroad.status_code, status.HTTP_201_CREATED, abroad.data)
        self.assertEqual((abroad.data["requestDetails"]["state"], abroad.data["requestDetails"]["country"]), ("", "Singapore"))
        self.assertEqual(
            recipient_block(abroad.data["requestDetails"]),
            "MALAYAN BANKING BERHAD (MAYBANK)\n1 RAFFLES PLACE\nJALAN UNIVERSITI\n048616 SINGAPORE\nSINGAPORE",
        )

    def test_the_request_keeps_who_it_is_for(self):
        user = self.student("SCL003")
        response = self.ask_for(user, {**MAYBANK, "include": ["MAX_PERIOD", "MIN_PERIOD"]})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        details = response.data["requestDetails"]
        self.assertEqual(details["organisation"], "Malayan Banking Berhad (Maybank)")
        self.assertFalse(details["typedIn"])
        self.assertEqual(details["include"], ["MIN_PERIOD", "MAX_PERIOD"])

    def test_an_organisation_not_listed_can_be_typed_in(self):
        user = self.student("SCL004")
        response = self.ask_for(
            user,
            {
                "purpose": "MOBILITY",
                "organisation": "  National   University of Singapore ",
                "addressLine1": "21 Lower Kent Ridge Road",
                "postcode": "119077",
                "city": "Singapore",
                "country": "Singapore",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["requestDetails"]["organisation"], "National University of Singapore")
        self.assertTrue(response.data["requestDetails"]["typedIn"])

    def test_students_are_offered_only_the_details_the_letter_shows(self):
        user = self.student("SCL006")
        self.client.force_authenticate(user)
        listed = {row["name"]: row for row in self.client.get("/api/letter-templates/").data}
        self.assertEqual(listed["Student Confirmation Letter"]["optionalDetails"], ["MIN_PERIOD", "MAX_PERIOD", "CURRENT_SEMESTER"])
        self.assertEqual(listed["Visa Support Letter"]["optionalDetails"], [])
        self.assertNotIn("content", listed["Student Confirmation Letter"])
        short = LetterTemplate.objects.create(
            name="Bank Letter",
            status=LetterTemplate.Status.ACTIVE,
            asks_recipient=True,
            form_questions=[{"kind": "recipient", "purposes": [], "askAddress": True}, {"kind": "extras"}],
            content="{{RECIPIENT}}\n\n{{STUDENT_NAME}} ({{STUDENT_ID}}) is registered.",
        )
        response = self.client.post(
            REQUESTS, {"templateId": short.pk, "details": {**MAYBANK, "include": ["MIN_PERIOD"]}}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["requestDetails"]["include"], [])

    def test_the_lists_cover_the_maya_examples(self):
        self.client.force_authenticate(self.student("SCL007"))
        options = {
            row["code"]: [entry["name"] for entry in row["organisations"]]
            for row in self.client.get(f"{REQUESTS}recipient-options/").data["purposes"]
        }
        for name in ("Keretapi Tanah Melayu Berhad (KTMB)", "AirAsia Berhad", "AirAsia X Berhad", "Malaysia Airlines Berhad"):
            self.assertIn(name, options["TRANSPORTATION"])
        self.assertIn("Bahagian Kemasukan Pelajar IPTA, Kementerian Pendidikan Tinggi Malaysia", options["GOVERNMENT"])
        self.assertIn("High Commission of the Republic of Singapore", options["GOVERNMENT"])
        self.assertEqual(options["MOBILITY"], [], "host universities are typed in")

    def test_other_letters_do_not_ask_who_they_are_for(self):
        user = self.student("SCL005")
        self.assertEqual(self.ask(user).status_code, status.HTTP_201_CREATED)


class ReviewAndIssueTests(ConfirmationLetterTestCase):
    def test_the_office_sees_both_pages_with_only_the_chosen_lines(self):
        user = self.student("SCL010")
        request_id = self.ask_for(user, MAYBANK).data["id"]
        self.client.force_authenticate(self.office)
        review = self.client.get(f"{REQUESTS}{request_id}/").data
        self.assertIn("Balance Semester (Minimum)", review["templateContent"])
        self.assertNotIn("Current Semester", review["templateContent"])
        self.assertIn("SURAT PENGESAHAN PELAJAR", review["templateContentMs"])
        self.assertNotIn("Semester Semasa", review["templateContentMs"])
        fields = {field["name"]: field for field in review["fields"]}
        self.assertEqual(
            fields["RECIPIENT"]["value"],
            "MALAYAN BANKING BERHAD (MAYBANK)\nMAYBANK UNIVERSITI MALAYA BRANCH\nJALAN UNIVERSITI\n"
            "50603 KUALA LUMPUR\nWILAYAH PERSEKUTUAN KUALA LUMPUR",
        )
        self.assertEqual(fields["BALANCE_SEMESTERS_MIN"]["value"], "1 SEMESTER(S)")
        self.assertEqual(fields["BALANCE_SEMESTERS_MAX"]["value"], "3 SEMESTER(S)")
        self.assertFalse(any(field["needed"] for field in review["fields"]))
        valid_until = add_months(timezone.localdate(), 3)
        self.assertEqual(review["previewValidUntil"], valid_until.strftime("%d %B %Y").upper())
        self.assertEqual(review["malayValues"]["MODE_OF_STUDY"], "Sepenuh Masa")
        self.assertEqual(review["malayValues"]["VALID_UNTIL"], malay_date(valid_until).upper())
        self.assertEqual(review["malayValues"]["BALANCE_SEMESTERS_MAX"], "3 SEMESTER")

    def test_approval_fills_both_pages_and_the_valid_until_date(self):
        user = self.student("SCL011")
        letter = self.issued_for(user, {**MAYBANK, "include": ["CURRENT_SEMESTER"]})
        valid_until = add_months(letter.issued_on, 3)
        self.assertEqual(letter.valid_until, valid_until)
        self.assertIn("MALAYAN BANKING BERHAD (MAYBANK)\nMAYBANK UNIVERSITI MALAYA BRANCH", letter.content)
        self.assertIn(f"| Date Valid | {valid_until.strftime('%d %B %Y').upper()} |", letter.content)
        self.assertIn("| Current Semester | Semester II, 2025/2026 Session |", letter.content)
        self.assertNotIn("Balance Semester", letter.content)
        self.assertIn(f"| Tarikh Sah | {malay_date(valid_until).upper()} |", letter.content_ms)
        self.assertIn("| Kaedah Pengajian | Sepenuh Masa |", letter.content_ms)
        self.assertIn("| Semester Semasa | Semester II, Sesi 2025/2026 |", letter.content_ms)
        self.assertNotIn("{{", letter.content + letter.content_ms)
        self.assertEqual(letter.request_details["organisation"], "Malayan Banking Berhad (Maybank)")

    def test_the_office_types_the_semesters_left_when_the_registry_cannot_tell(self):
        user = self.student("SCL012", expected_completion="2027")
        request_id = self.ask_for(user, MAYBANK).data["id"]
        refused = self.approve(request_id)
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(refused.data["fieldErrors"]), {"BALANCE_SEMESTERS_MIN"})
        approved = self.approve(request_id, {"BALANCE_SEMESTERS_MIN": "2 SEMESTER(S)"})
        self.assertEqual(approved.status_code, status.HTTP_200_OK, approved.data)
        letter = GeneratedLetter.objects.get(pk=request_id)
        self.assertIn("| Balance Semester (Minimum) | 2 SEMESTER(S) |", letter.content)
        self.assertIn("| Baki Semester (Minimum) | 2 SEMESTER |", letter.content_ms)

    def test_the_pdf_has_an_english_and_a_malay_page(self):
        user = self.student("SCL013")
        letter = self.issued_for(user, MAYBANK)
        self.client.force_authenticate(user)
        response = self.client.get(f"{REQUESTS}{letter.pk}/pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        reader = PdfReader(io.BytesIO(response.content))
        reader.decrypt("")
        self.assertEqual(len(reader.pages), 2)
        english, malay = (page.extract_text() for page in reader.pages)
        self.assertIn("STUDENT CONFIRMATION LETTER", english)
        self.assertIn("MALAYAN BANKING BERHAD (MAYBANK)", english)
        self.assertIn("Matric Number", english)
        self.assertNotIn("| Name", english)
        self.assertIn("SURAT PENGESAHAN PELAJAR", malay)
        self.assertIn("Rujukan Kami", malay)
        self.assertIn(malay_date(letter.issued_on), malay)

    def test_the_office_is_told_who_the_letter_is_for(self):
        user = self.student("SCL014")
        self.ask_for(user, KTMB)
        notice = self.office.notifications.latest("id")
        self.assertIn("for Keretapi Tanah Melayu Berhad (KTMB).", notice.message)

    def test_the_student_sees_when_the_letter_stops_being_valid(self):
        user = self.student("SCL015")
        letter = self.issued_for(user, MAYBANK)
        self.client.force_authenticate(user)
        listed = {row["id"]: row for row in self.client.get(REQUESTS).data}
        self.assertEqual(listed[str(letter.pk)]["validUntil"], add_months(letter.issued_on, 3).isoformat())


class ReplacementTests(ConfirmationLetterTestCase):
    def test_a_new_letter_replaces_only_the_copy_for_the_same_recipient(self):
        user = self.student("SCL020")
        bank = self.issued_for(user, MAYBANK)
        train = self.issued_for(user, KTMB)
        bank.refresh_from_db()
        self.assertEqual(bank.status, GeneratedLetter.Status.ISSUED)
        request_id = self.ask_for(user, {**MAYBANK, "organisation": "malayan banking berhad (maybank)"}).data["id"]
        self.client.force_authenticate(self.office)
        review = self.client.get(f"{REQUESTS}{request_id}/").data
        self.assertEqual([row["referenceNumber"] for row in review["replaces"]], [bank.reference_number])
        newer = GeneratedLetter.objects.get(pk=self.approve(request_id).data["id"])
        bank.refresh_from_db()
        train.refresh_from_db()
        self.assertEqual(bank.status, GeneratedLetter.Status.REVOKED)
        self.assertEqual(bank.replaced_by, newer)
        self.assertEqual(train.status, GeneratedLetter.Status.ISSUED)


class TemplateRulesTests(ConfirmationLetterTestCase):
    def create(self, **data):
        self.client.force_authenticate(self.office)
        return self.client.post("/api/letter-templates/", {"name": "Bank Letter", "status": "Draft", **data}, format="json")

    def test_recipient_tags_need_the_student_to_say_who_it_is_for(self):
        refused = self.create(content="{{RECIPIENT}}\n\nDear Sir/Madam,")
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("asksRecipient", refused.data)
        allowed = self.create(content="{{RECIPIENT}}\n\nDear Sir/Madam,", asksRecipient=True)
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED, allowed.data)
        self.assertTrue(allowed.data["asksRecipient"])

    def test_a_letter_that_asks_who_it_is_for_must_show_it(self):
        refused = self.create(content="Dear Sir/Madam,", asksRecipient=True)
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("does not show it", refused.data["asksRecipient"])
        malay = self.create(content="{{RECIPIENT}}\n\nDear Sir/Madam,", contentMs="Tuan/Puan,", asksRecipient=True)
        self.assertIn("contentMs", malay.data)
        both = self.create(content="{{RECIPIENT}}\n\nDear Sir/Madam,", contentMs="{{RECIPIENT}}\n\nTuan/Puan,", asksRecipient=True)
        self.assertEqual(both.status_code, status.HTTP_201_CREATED, both.data)

    def test_a_valid_until_date_needs_the_months_it_is_valid(self):
        refused = self.create(content="Valid until {{VALID_UNTIL}}.")
        self.assertIn("validMonths", refused.data)
        allowed = self.create(content="Valid until {{VALID_UNTIL}}.", validMonths=6)
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED, allowed.data)
        self.assertEqual(allowed.data["validMonths"], 6)

    def test_the_malay_page_is_checked_too(self):
        refused = self.create(content="Dear {{STUDENT_NAME}}", contentMs="Kepada {{NAMA_PELAJAR}}")
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("contentMs", refused.data)
        self.assertEqual(refused.data["unknownPlaceholders"], ["{{NAMA_PELAJAR}}"])

    def test_appointment_letters_cannot_ask_who_they_are_for(self):
        refused = self.create(content="Dear {{STUDENT_NAME}}", purpose="PANEL_APPOINTMENT", asksRecipient=True)
        self.assertIn("formQuestions", refused.data)
        recipient = self.create(content="{{RECIPIENT}}", purpose="PANEL_APPOINTMENT")
        self.assertIn("works only in student request letters", recipient.data["content"])

    def test_the_confirmation_letter_replaces_the_enrolment_letter(self):
        migration = import_module("letters.migrations.0007_student_confirmation_letter")
        self.confirmation.delete()
        migration.add_confirmation_letter(apps, None)
        self.assertFalse(LetterTemplate.objects.filter(name="Student Confirmation Letter").exists(), "nothing to replace")
        enrolment = LetterTemplate.objects.create(name="Confirmation of Enrolment", status="Active", content="{{STUDENT_NAME}}")
        migration.add_confirmation_letter(apps, None)
        added = LetterTemplate.objects.get(name="Student Confirmation Letter")
        enrolment.refresh_from_db()
        self.assertEqual(enrolment.status, LetterTemplate.Status.ARCHIVED)
        self.assertEqual(added.status, LetterTemplate.Status.ACTIVE)
        self.assertTrue(added.asks_recipient)
        self.assertEqual(added.valid_months, 3)
        self.assertEqual(added.content, self.confirmation.content)
        self.assertEqual(added.content_ms, self.confirmation.content_ms)


class ValueTests(SimpleTestCase):
    def test_semesters_left_from_labels_or_a_count(self):
        self.assertEqual(semesters_left("Semester II, 2025/2026 Session", "Semester I, 2027/2028 Session"), "3")
        self.assertEqual(semesters_left("Semester I, 2026/2027 Session", "4", "2026/2027 Semester I"), "3")
        self.assertEqual(semesters_left("Semester II, 2027/2028 Session", "Semester I, 2027/2028 Session"), "0")
        self.assertEqual(semesters_left("3", "8"), "")
        self.assertEqual(semesters_left("Semester I, 2026/2027 Session", "2028"), "")
        self.assertEqual(semesters_left("Semester I, 2026/2027 Session", "2028", "2026/2027 Semester I"), "")

    def test_malay_values(self):
        values = malay_values(
            {
                "programName": "Master of Data Science (Coursework)",
                "modeOfStudy": "PART TIME",
                "balanceSemestersMin": "2 SEMESTER(S)",
                "_issuedOn": date(2026, 10, 23),
                "_validUntil": date(2027, 1, 23),
            }
        )
        self.assertEqual(values["programName"], "SARJANA SAINS DATA (KERJA KURSUS)")
        self.assertEqual(values["modeOfStudy"], "SEPARUH MASA")
        self.assertEqual(values["balanceSemestersMin"], "2 SEMESTER")
        self.assertEqual(values["date"], "23 Oktober 2026")
        self.assertEqual(values["validUntil"], "23 JANUARI 2027")

    def test_valid_until_keeps_to_the_end_of_a_short_month(self):
        self.assertEqual(add_months(date(2026, 11, 30), 3), date(2027, 2, 28))

    def test_the_recipient_block_skips_blank_lines(self):
        details = {"organisation": "CIMB Bank Berhad", "organisationMs": "", "addressLine1": "", "city": "Kuala Lumpur"}
        self.assertEqual(recipient_block(details), "CIMB BANK BERHAD\nKUALA LUMPUR")
        self.assertEqual(recipient_block({**details, "organisationMs": "Bank CIMB"}, malay=True), "BANK CIMB\nKUALA LUMPUR")
