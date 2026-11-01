"""The sample confirmation letters the system sets up for appointments: a
coordinator's approval issues them at once, in English and Malay, to everyone
the appointment concerns."""
import importlib
import io

from django.apps import apps
from django.utils import timezone
from pypdf import PdfReader

from .appointment_letters import PANEL, SUPERVISOR, active_template, template_problem
from .confirmation import malay_date, malay_values
from .models import GeneratedLetter, LetterTemplate
from .test_appointment_letters import PANEL_LETTER, REQUESTS, SUPERVISOR_LETTER, AppointmentLetterFixtures

WORDING = importlib.import_module("letters.migrations.0014_malay_signatory_and_sample_wording")
FIRST_SAMPLES = importlib.import_module("letters.migrations.0010_sample_appointment_templates")


class SampleTemplateTests(AppointmentLetterFixtures):
    keep_samples = True

    def pdf_pages(self, letter):
        self.as_user(self.office)
        response = self.client.get(f"{REQUESTS}{letter.pk}/pdf/")
        return [" ".join(page.extract_text().split()) for page in PdfReader(io.BytesIO(response.content)).pages]

    def test_the_samples_are_active_and_need_nothing_from_the_office(self):
        for purpose, kind in ((SUPERVISOR_LETTER, SUPERVISOR), (PANEL_LETTER, PANEL)):
            with self.subTest(kind=kind):
                template = active_template(purpose)
                self.assertIsNotNone(template)
                self.assertIsNone(template_problem(template, kind))
                self.assertTrue(template.content_ms.strip())
                self.assertIn("Sample wording", template.description)
                self.assertEqual(template.custom_fields, [])
                self.assertEqual((template.signatory_name, template.signatory_name_ms), ("Dean", "Dekan"))

    def test_an_approved_supervisor_gets_the_letter_at_once_in_both_languages(self):
        appointment = self.appoint_supervisor(self.ali, self.supervisor, course_codes="")
        letter = GeneratedLetter.objects.get(supervisor_appointment=appointment)
        self.assertEqual(letter.status, GeneratedLetter.Status.ISSUED)
        self.assertTrue(letter.reference_number.startswith(f"UMF/PG/SV/{self.year}/"))
        self.assertIn("Dear Dr Supervisor,", letter.content)
        self.assertIn("CONFIRMATION OF APPOINTMENT AS SUPERVISOR", letter.content)
        self.assertIn("| Research Title | Research for LTR-S1 |", letter.content)
        self.assertIn("PENGESAHAN PELANTIKAN SEBAGAI PENYELIA", letter.content_ms)
        self.assertIn(f"| Tarikh Berkuat Kuasa | {malay_date(timezone.localdate())} |", letter.content_ms)
        self.assertNotIn("{{", letter.content + letter.content_ms)
        self.assertEqual(set(letter.recipients.all()), {self.ali.user, self.supervisor})
        self.assertEqual(set(self.notices(letter).values_list("recipient", flat=True)), {self.ali.user.pk, self.supervisor.pk})

    def test_an_approved_panel_member_gets_the_letter_with_the_supervisor_in_copy(self):
        self.appoint_supervisor(self.bella, self.supervisor)
        appointment = self.appoint_panel(self.bella, self.panel)
        letter = GeneratedLetter.objects.get(panel_appointment=appointment)
        self.assertEqual(letter.status, GeneratedLetter.Status.ISSUED)
        self.assertIn("Dear Dr Panel,", letter.content)
        self.assertIn("| Supervisor | Dr Supervisor |", letter.content)
        self.assertIn("| Penyelia | Dr Supervisor |", letter.content_ms)
        self.assertEqual(set(letter.recipients.all()), {self.bella.user, self.panel, self.supervisor})

    def test_the_malay_page_is_signed_in_malay(self):
        letter = GeneratedLetter.objects.get(supervisor_appointment=self.appoint_supervisor(self.ali, self.supervisor))
        english, malay = self.pdf_pages(letter)
        self.assertIn("Dean FACULTY OF COMPUTER SCIENCE AND INFORMATION TECHNOLOGY", english)
        self.assertIn("Dekan FAKULTI SAINS KOMPUTER DAN TEKNOLOGI MAKLUMAT", malay)
        self.assertIn("FAKULTI SAINS KOMPUTER & TEKNOLOGI MAKLUMAT", malay)
        self.assertIn("Pejabat Hal Ehwal Akademik, Aras 4", malay)
        self.assertNotIn("FACULTY OF COMPUTER SCIENCE", malay)
        self.assertNotIn("Academic Affairs", malay)


class MalaySignatoryTests(AppointmentLetterFixtures):
    def malay_page(self, **fields):
        self.make_template(content_ms="Tuan/Puan, {{STUDENT_NAME}}", **fields)
        letter = GeneratedLetter.objects.get(supervisor_appointment=self.appoint_supervisor(self.ali, self.supervisor))
        self.as_user(self.office)
        response = self.client.get(f"{REQUESTS}{letter.pk}/pdf/")
        return " ".join(PdfReader(io.BytesIO(response.content)).pages[1].extract_text().split())

    def test_the_malay_lines_are_used_when_set(self):
        page = self.malay_page(signatory_name="Prof Signer", signatory_title="Deputy Dean", signatory_name_ms="Prof Penandatangan", signatory_title_ms="Timbalan Dekan")
        self.assertIn("Prof Penandatangan TIMBALAN DEKAN", page)

    def test_without_malay_lines_the_english_ones_are_used(self):
        self.assertIn("Prof Signer DEPUTY DEAN", self.malay_page(signatory_name="Prof Signer", signatory_title="Deputy Dean"))

    def test_without_any_lines_the_malay_default_is_used(self):
        self.assertIn("Dekan Pengajian Pascasiswazah SEKRETARIAT EKSEKUTIF PEJABAT FSKTM", self.malay_page())

    def test_the_office_saves_the_malay_lines(self):
        self.as_user(self.office)
        response = self.client.post(
            "/api/letter-templates/",
            {"name": "Signed", "type": "Academic Certification", "status": "Draft", "description": "", "content": "Dear {{STUDENT_NAME}}", "signatoryNameMs": " Dekan ", "signatoryTitleMs": "Fakulti"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["signatoryNameMs"], response.data["signatoryTitleMs"]), ("Dekan", "Fakulti"))


class SampleWordingUpdateTests(AppointmentLetterFixtures):
    keep_samples = True

    def test_only_untouched_samples_take_the_new_wording(self):
        first = {sample["purpose"]: sample for sample in FIRST_SAMPLES.TEMPLATES}
        supervisor = active_template(SUPERVISOR_LETTER)
        panel = active_template(PANEL_LETTER)
        LetterTemplate.objects.filter(pk=supervisor.pk).update(
            content=first["SUPERVISOR_APPOINTMENT"]["content"], content_ms=first["SUPERVISOR_APPOINTMENT"]["content_ms"],
            signatory_name="", signatory_name_ms="",
        )
        LetterTemplate.objects.filter(pk=panel.pk).update(content="The office's own wording.", signatory_name="", signatory_name_ms="")
        WORDING.use_new_wording(apps, None)
        supervisor.refresh_from_db()
        panel.refresh_from_db()
        self.assertEqual(supervisor.content, WORDING.WORDING["SUPERVISOR_APPOINTMENT"]["content"])
        self.assertEqual((supervisor.signatory_name, supervisor.signatory_name_ms), ("Dean", "Dekan"))
        self.assertEqual((panel.content, panel.signatory_name), ("The office's own wording.", ""))

    def test_the_student_confirmation_letter_gets_its_malay_title(self):
        template = LetterTemplate.objects.create(name="Student Confirmation Letter", status=LetterTemplate.Status.ACTIVE, content="Dear {{STUDENT_NAME}}", signatory_name="Dean / Director")
        WORDING.use_new_wording(apps, None)
        template.refresh_from_db()
        self.assertEqual(template.signatory_name_ms, "Dekan / Pengarah")


class MalayDateTests(AppointmentLetterFixtures):
    def test_appointment_dates_print_in_malay(self):
        values = malay_values({"appointmentDate": "08 October 2026", "approvedDate": "01 March 2026", "semester": "Semester I 2026/2027", "panelAcceptedDate": ""})
        self.assertEqual((values["appointmentDate"], values["approvedDate"]), ("08 Oktober 2026", "01 Mac 2026"))
        self.assertEqual(values["panelAcceptedDate"], "")
        self.assertEqual(values["semester"], "Semester I 2026/2027")
