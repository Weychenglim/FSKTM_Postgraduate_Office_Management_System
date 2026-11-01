"""Appointment letters (UC22).

A coordinator's approval of a supervisor or panel appointment makes the letter
by itself, from the office's active template for that kind of letter, and sends
it to the student and the lecturers on it.
"""
import io
import shutil
import tempfile
from datetime import timedelta

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.test import override_settings
from django.utils import timezone
from pypdf import PdfReader
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from accounts.models import Coordinator, Lecturer, Student, User
from accounts.programmes import APPROVED_PROGRAMMES
from announcements.models import Notification
from appointments import test_supervisor_workflow as workflow
from appointments.research_intent_test_helpers import valid_research_intent_json
from appointments.models import (
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)

from .appointment_letters import (
    LETTER_RECORD,
    MISSING_RECORD,
    create_appointment_letter,
    make_letter_after_approval,
)
from .models import AUTOMATIC_PURPOSES, GeneratedLetter, LetterPurpose, LetterTemplate

DS = APPROVED_PROGRAMMES[0]
PASSWORD = "Appointment-letters-8803!"
REQUESTS = "/api/letters/requests/"
MISSING = "/api/letters/appointment-letters/missing/"
CREATE = "/api/letters/appointment-letters/create/"
RECEIVED = "/api/letters/appointment-letters/received/"
TEMPLATES = "/api/letter-templates/"
SUPERVISOR_LETTER = LetterPurpose.SUPERVISOR_APPOINTMENT
PANEL_LETTER = LetterPurpose.PANEL_APPOINTMENT

SUPERVISOR_CONTENT = (
    "**APPOINTMENT OF SUPERVISOR**\n\nDear {{STUDENT_NAME}} ({{STUDENT_ID}}),\n\n"
    "- Research title: {{RESEARCH_TITLE}}\n- Course codes: {{COURSE_CODES}}\n"
    "- Supervisor: {{SUPERVISOR_NAME}}, {{SUPERVISOR_DEPARTMENT}}\n"
    "- Accepted on: {{SUPERVISOR_ACCEPTED_DATE}}\n"
    "- Approved by {{COORDINATOR_NAME}} on {{APPROVED_DATE}}\n"
    "- Effective from {{APPOINTMENT_DATE}} ({{SEMESTER}})\n\nRef {{REFERENCE_NUMBER}}"
)
PANEL_CONTENT = (
    "Dear {{STUDENT_NAME}},\n\nPanel member: {{PANEL_NAME}} ({{PANEL_DEPARTMENT}}), "
    "accepted on {{PANEL_ACCEPTED_DATE}}.\nSupervisor: {{SUPERVISOR_NAME}}\n"
    "Research title: {{RESEARCH_TITLE}}"
)


def clear_sample_templates():
    """Remove the sample appointment templates the migration adds, for tests
    that make their own or expect no template at all."""
    LetterTemplate.objects.filter(purpose__in=AUTOMATIC_PURPOSES).delete()


class AppointmentLetterFixtures(APITestCase):
    keep_samples = False

    def setUp(self):
        if not self.keep_samples:
            clear_sample_templates()
        self.office = self.user("letters-office@example.test", "Siti Office", User.Role.OFFICE_ADMIN)
        self.coordinator = self.lecturer("letters-coord@example.test", "LTR-C1", "Prof Coordinator", User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=self.coordinator.lecturer, programme_managed=DS)
        self.supervisor = self.lecturer("letters-sup@example.test", "LTR-L1", "Dr Supervisor")
        self.panel = self.lecturer("letters-panel@example.test", "LTR-L2", "Dr Panel")
        self.outsider = self.lecturer("letters-out@example.test", "LTR-L3", "Dr Outsider")
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(
            code="LTR-SEMESTER",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=90),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        self.ali = self.student("LTR-S1", "Ali Hassan")
        self.bella = self.student("LTR-S2", "Bella Tan")
        self.year = today.year

    @staticmethod
    def user(email, name, role):
        return User.objects.create_user(email=email, password=PASSWORD, full_name=name, role=role)

    @classmethod
    def lecturer(cls, email, staff_no, name, role=User.Role.LECTURER):
        user = cls.user(email, name, role)
        Lecturer.objects.create(user=user, staff_no=staff_no, department="Department of Artificial Intelligence")
        return user

    @classmethod
    def student(cls, matric, name, state=Student.Status.ACTIVE):
        user = cls.user(f"{matric.lower()}@example.test", name, User.Role.STUDENT)
        return Student.objects.create(user=user, matric_no=matric, programme=DS, status=state)

    def make_template(self, purpose=SUPERVISOR_LETTER, content=None, **fields):
        defaults = {
            "name": f"{purpose.label} template",
            "letter_type": "Academic Certification",
            "purpose": purpose,
            "status": LetterTemplate.Status.ACTIVE,
            "reference_prefix": "UMF/PG/SV" if purpose == SUPERVISOR_LETTER else "UMF/PG/PN",
            "content": content or (SUPERVISOR_CONTENT if purpose == SUPERVISOR_LETTER else PANEL_CONTENT),
        }
        return LetterTemplate.objects.create(**{**defaults, **fields})

    def appoint_supervisor(self, student, supervisor, *, course_codes="WQD7002", run=True, supersedes=None):
        def create():
            now = timezone.now()
            application = SupervisorApplication.objects.create(
                student=student, academic_semester=self.semester, proposed_supervisor=supervisor,
                research_title=f"Research for {student.matric_no}", research_area="Data Mining",
                research_abstract="Fixture.", project_course_codes=course_codes,
                status=SupervisorApplication.Status.APPROVED,
                supervisor_decided_at=now - timedelta(days=2), coordinator_decided_at=now,
            )
            return SupervisorAppointment.objects.create(
                application=application, student=student, supervisor=supervisor,
                approved_by=self.coordinator, supersedes=supersedes,
            )

        if not run:
            return create()
        with self.captureOnCommitCallbacks(execute=True):
            return create()

    def appoint_panel(self, student, member, *, linked=True, matric=None, run=True):
        def create():
            profile = StudentResearchProfile.objects.create(
                student=student.user if linked else None,
                matric_no=matric or student.matric_no,
                student_name=student.user.full_name,
                programme=student.programme,
                semester=self.semester.label,
                proposed_topic=f"Topic {student.matric_no}",
                research_area="Data Mining",
                supervisor=self.supervisor,
            )
            recommendation = PanelRecommendation.objects.create(
                profile=profile, academic_semester=self.semester, supervisor=self.supervisor,
                recommended_member=member, status=PanelRecommendation.Status.APPROVED,
                justification="Fixture", panel_decided_at=timezone.now(), coordinator_decided_at=timezone.now(),
            )
            return PanelAppointment.objects.create(
                recommendation=recommendation, profile=profile, supervisor=self.supervisor,
                panel_member=member, approved_by=self.coordinator,
            )

        if not run:
            return create()
        with self.captureOnCommitCallbacks(execute=True):
            return create()

    def as_user(self, user):
        self.client.force_authenticate(user)

    def notices(self, letter):
        return Notification.objects.filter(record_type=LETTER_RECORD, record_id=str(letter.pk))


class AppointmentLetterTests(AppointmentLetterFixtures):
    def test_supervisor_letter_is_issued_once_the_approval_is_saved(self):
        self.make_template()
        appointment = self.appoint_supervisor(self.ali, self.supervisor)

        letter = GeneratedLetter.objects.get()
        self.assertEqual(letter.status, GeneratedLetter.Status.ISSUED)
        self.assertEqual(letter.purpose, SUPERVISOR_LETTER)
        self.assertEqual(letter.supervisor_appointment, appointment)
        self.assertEqual(letter.student, self.ali)
        self.assertTrue(letter.reference_number.startswith(f"UMF/PG/SV/{self.year}/"))
        self.assertIsNone(letter.decided_by)
        for text in (
            "Research for LTR-S1", "WQD7002", "Dr Supervisor, Department of Artificial Intelligence",
            "Prof Coordinator", self.semester.label, letter.reference_number,
        ):
            self.assertIn(text, letter.content)
        self.assertNotIn("{{", letter.content)
        self.assertEqual(set(letter.recipients.all()), {self.ali.user, self.supervisor})
        notices = {notice.recipient: notice for notice in self.notices(letter)}
        self.assertEqual(set(notices), {self.ali.user, self.supervisor})
        self.assertEqual(notices[self.ali.user].title, "Your supervisor appointment letter is ready")
        self.assertEqual(notices[self.supervisor].title, "Appointment letter: supervisor for Ali Hassan")
        self.assertEqual(notices[self.supervisor].target_module, "LETTERS")

    def test_no_letter_when_the_approval_is_rolled_back(self):
        self.make_template()
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            try:
                with transaction.atomic():
                    self.appoint_supervisor(self.ali, self.supervisor, run=False)
                    raise RuntimeError("approval failed")
            except RuntimeError:
                pass
        self.assertEqual(callbacks, [])
        self.assertFalse(GeneratedLetter.objects.exists())

    def test_email_follows_each_persons_settings(self):
        User.objects.filter(pk=self.supervisor.pk).update(email_notifications=True)
        self.make_template()
        self.appoint_supervisor(self.ali, self.supervisor)

        letter = GeneratedLetter.objects.get()
        self.assertEqual([message.to for message in mail.outbox], [[self.supervisor.email]])
        self.assertIn(f"/files/letters/{letter.pk}", mail.outbox[0].body)
        self.assertIn(letter.reference_number, mail.outbox[0].body)

    def test_panel_letter_goes_to_the_panel_member_with_the_supervisor_in_copy(self):
        self.make_template(PANEL_LETTER)
        appointment = self.appoint_panel(self.ali, self.panel)

        letter = GeneratedLetter.objects.get()
        self.assertEqual(letter.panel_appointment, appointment)
        self.assertEqual(letter.status, GeneratedLetter.Status.ISSUED)
        self.assertIn("Panel member: Dr Panel (Department of Artificial Intelligence)", letter.content)
        self.assertIn("Research title: Topic LTR-S1", letter.content)
        self.assertEqual(set(letter.recipients.all()), {self.ali.user, self.panel, self.supervisor})
        titles = {notice.recipient: notice.title for notice in self.notices(letter)}
        self.assertEqual(titles[self.ali.user], "Your panel appointment letter is ready")
        self.assertEqual(titles[self.panel], "Appointment letter: panel member for Ali Hassan")
        self.assertEqual(titles[self.supervisor], "Copy of Ali Hassan's panel appointment letter")

    def test_panel_letter_finds_an_older_profile_by_matric_number(self):
        self.make_template(PANEL_LETTER)
        self.appoint_panel(self.ali, self.panel, linked=False)
        self.assertEqual(GeneratedLetter.objects.get().student, self.ali)

    def test_profile_without_a_student_tells_the_office_instead(self):
        self.make_template(PANEL_LETTER)
        appointment = self.appoint_panel(self.ali, self.panel, linked=False, matric="LTR-NOBODY")

        self.assertFalse(GeneratedLetter.objects.exists())
        notice = Notification.objects.get(recipient=self.office, record_type=MISSING_RECORD)
        self.assertEqual(notice.record_id, str(appointment.pk))
        self.assertIn("not linked to a student account", notice.message)

    def test_missing_template_tells_the_office_once_and_the_letter_can_be_made_later(self):
        appointment = self.appoint_supervisor(self.ali, self.supervisor)
        make_letter_after_approval(SupervisorAppointment, appointment.pk)

        self.assertFalse(GeneratedLetter.objects.exists())
        notices = Notification.objects.filter(recipient=self.office, record_type=MISSING_RECORD)
        self.assertEqual(notices.count(), 1)
        self.assertIn("no active supervisor appointment letter template", notices.get().message)

        self.as_user(self.office)
        missing = self.client.get(MISSING)
        self.assertEqual(missing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(missing.data), 1)
        self.assertEqual(missing.data[0]["kind"], "supervisor")
        self.assertEqual(missing.data[0]["studentName"], "Ali Hassan")
        self.assertIn("There is no active supervisor appointment letter template", missing.data[0]["problem"])

        self.make_template()
        self.assertIsNone(self.client.get(MISSING).data[0]["problem"])
        with self.captureOnCommitCallbacks(execute=True):
            made = self.client.post(CREATE, {"all": True}, format="json")
        self.assertEqual(made.status_code, status.HTTP_200_OK)
        self.assertEqual(made.data["made"], 1)
        letter = GeneratedLetter.objects.get()
        self.assertEqual(letter.status, GeneratedLetter.Status.ISSUED)
        self.assertEqual(letter.decided_by, self.office)
        self.assertEqual(self.client.get(MISSING).data, [])

    def test_making_chosen_letters_reports_each_appointment(self):
        self.make_template()
        appointment = self.appoint_supervisor(self.ali, self.supervisor, run=False)
        ended = self.appoint_supervisor(self.bella, self.supervisor, run=False)
        SupervisorAppointment.objects.filter(pk=ended.pk).update(status=SupervisorAppointment.Status.ENDED)

        self.as_user(self.office)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                CREATE,
                {"appointments": [{"kind": "supervisor", "id": appointment.pk}, {"kind": "supervisor", "id": ended.pk}]},
                format="json",
            )
        self.assertEqual(response.data["made"], 1)
        problems = {row["appointmentId"]: row["problem"] for row in response.data["results"]}
        self.assertIsNone(problems[str(appointment.pk)])
        self.assertEqual(problems[str(ended.pk)], "This appointment is no longer active.")
        bad = self.client.post(CREATE, {"appointments": [{"kind": "co-supervisor", "id": 1}]}, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_the_office_sees_and_makes_missing_letters(self):
        for user in (self.coordinator, self.supervisor, self.ali.user):
            self.as_user(user)
            self.assertEqual(self.client.get(MISSING).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(self.client.post(CREATE, {"all": True}, format="json").status_code, status.HTTP_403_FORBIDDEN)

    def test_office_filled_values_make_the_letter_wait_in_requests(self):
        self.make_template(
            content=SUPERVISOR_CONTENT + "\nAttendance: {{ATTENDANCE}}",
            custom_fields=[{"name": "ATTENDANCE", "label": "Attendance (%)", "hint": ""}],
            signatory_name="Prof Signer",
        )
        self.appoint_supervisor(self.ali, self.supervisor)

        letter = GeneratedLetter.objects.get()
        self.assertEqual(letter.status, GeneratedLetter.Status.PENDING)
        self.assertIsNone(letter.reference_number)
        waiting = Notification.objects.get(recipient=self.office, record_type="LETTER_REQUEST")
        self.assertIn("Attendance (%)", waiting.summary)
        self.assertFalse(self.notices(letter).exists())

        self.as_user(self.ali.user)
        self.assertEqual(self.client.get(REQUESTS).data, [])
        self.assertEqual(self.client.get(f"{REQUESTS}{letter.pk}/").status_code, status.HTTP_404_NOT_FOUND)
        self.as_user(self.supervisor)
        self.assertEqual(self.client.get(f"{REQUESTS}{letter.pk}/").status_code, status.HTTP_404_NOT_FOUND)

        self.as_user(self.office)
        review = self.client.get(f"{REQUESTS}{letter.pk}/").data
        self.assertIsNone(review["problem"])
        self.assertEqual(review["signatoryName"], "Prof Signer", "the preview shows who will sign it")
        self.assertEqual([field["name"] for field in review["fields"] if field["needed"]], ["ATTENDANCE"])
        with self.captureOnCommitCallbacks(execute=True):
            approved = self.client.post(f"{REQUESTS}{letter.pk}/approve/", {"values": {"ATTENDANCE": "92%"}}, format="json")
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        letter.refresh_from_db()
        self.assertEqual(letter.status, GeneratedLetter.Status.ISSUED)
        self.assertIn("Attendance: 92%", letter.content)
        self.assertIn("Research for LTR-S1", letter.content)
        self.assertEqual({notice.recipient for notice in self.notices(letter)}, {self.ali.user, self.supervisor})

    def test_a_blank_record_value_also_waits_for_the_office(self):
        self.make_template()
        self.appoint_supervisor(self.ali, self.supervisor, course_codes="")

        letter = GeneratedLetter.objects.get()
        self.assertEqual(letter.status, GeneratedLetter.Status.PENDING)
        self.as_user(self.office)
        review = self.client.get(f"{REQUESTS}{letter.pk}/").data
        self.assertEqual([field["name"] for field in review["fields"] if field["needed"]], ["COURSE_CODES"])

    def test_one_letter_per_appointment_even_when_asked_twice(self):
        self.make_template()
        appointment = self.appoint_supervisor(self.ali, self.supervisor)
        first = GeneratedLetter.objects.get()
        with self.captureOnCommitCallbacks(execute=True):
            again, problem = create_appointment_letter(appointment, actor=self.office)
        self.assertIsNone(problem)
        self.assertEqual(again.pk, first.pk)
        self.assertEqual(GeneratedLetter.objects.count(), 1)

    def test_a_replacement_appointment_gets_its_own_letter(self):
        self.make_template()
        old = self.appoint_supervisor(self.ali, self.supervisor)
        SupervisorAppointment.objects.filter(pk=old.pk).update(status=SupervisorAppointment.Status.ENDED)
        new = self.appoint_supervisor(self.ali, self.outsider, supersedes=old)

        old_letter = GeneratedLetter.objects.get(supervisor_appointment=old)
        new_letter = GeneratedLetter.objects.get(supervisor_appointment=new)
        self.assertEqual(old_letter.status, GeneratedLetter.Status.ISSUED)
        self.assertEqual(new_letter.status, GeneratedLetter.Status.ISSUED)
        self.assertEqual(set(new_letter.recipients.all()), {self.ali.user, self.outsider})

    def test_reissue_uses_the_current_details_and_replaces_the_old_letter(self):
        self.make_template()
        appointment = self.appoint_supervisor(self.ali, self.supervisor)
        old = GeneratedLetter.objects.get()
        StudentResearchProfile.objects.create(
            student=self.ali.user, matric_no=self.ali.matric_no, student_name="Ali Hassan", programme=DS,
            semester=self.semester.label, proposed_topic="An amended research title", supervisor=self.supervisor,
        )

        self.as_user(self.office)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"{REQUESTS}{old.pk}/reissue/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new = GeneratedLetter.objects.get(pk=response.data["id"])
        old.refresh_from_db()
        self.assertEqual(new.supervisor_appointment, appointment)
        self.assertEqual(new.status, GeneratedLetter.Status.ISSUED)
        self.assertIn("An amended research title", new.content)
        self.assertNotEqual(new.reference_number, old.reference_number)
        self.assertEqual(old.status, GeneratedLetter.Status.REVOKED)
        self.assertEqual(old.replaced_by, new)
        self.assertEqual(old.revoke_reason, f"Replaced by {new.reference_number}.")
        titles = {notice.recipient: notice.title for notice in self.notices(new)}
        self.assertEqual(titles[self.ali.user], "Updated: Your supervisor appointment letter is ready")
        self.assertIn(old.reference_number, self.notices(new).get(recipient=self.supervisor).message)

        again = self.client.post(f"{REQUESTS}{old.pk}/reissue/", {}, format="json")
        self.assertEqual(again.status_code, status.HTTP_409_CONFLICT)

    def test_reissue_keeps_the_office_values_unless_new_ones_are_sent(self):
        self.make_template(
            content=SUPERVISOR_CONTENT + "\nAttendance: {{ATTENDANCE}}",
            custom_fields=[{"name": "ATTENDANCE", "label": "Attendance (%)", "hint": ""}],
        )
        self.appoint_supervisor(self.ali, self.supervisor)
        letter = GeneratedLetter.objects.get()
        self.as_user(self.office)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(f"{REQUESTS}{letter.pk}/approve/", {"values": {"ATTENDANCE": "92%"}}, format="json")
            kept = self.client.post(f"{REQUESTS}{letter.pk}/reissue/", {}, format="json")
        self.assertEqual(kept.status_code, status.HTTP_201_CREATED)
        self.assertIn("Attendance: 92%", GeneratedLetter.objects.get(pk=kept.data["id"]).content)

        with self.captureOnCommitCallbacks(execute=True):
            blank = self.client.post(f"{REQUESTS}{kept.data['id']}/reissue/", {"values": {"ATTENDANCE": ""}}, format="json")
        self.assertEqual(blank.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ATTENDANCE", blank.data["fieldErrors"])

    def test_only_appointment_letters_can_be_reissued(self):
        request_template = LetterTemplate.objects.create(
            name="Confirmation", status=LetterTemplate.Status.ACTIVE, content="Dear {{STUDENT_NAME}}",
        )
        letter = GeneratedLetter.objects.create(
            student=self.ali, template=request_template, template_name="Confirmation",
            status=GeneratedLetter.Status.ISSUED, reference_number="UMF/PG/2026/9999",
        )
        self.as_user(self.office)
        response = self.client.post(f"{REQUESTS}{letter.pk}/reissue/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.as_user(self.supervisor)
        self.assertEqual(
            self.client.post(f"{REQUESTS}{letter.pk}/reissue/", {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_who_can_open_an_appointment_letter(self):
        self.make_template()
        self.appoint_supervisor(self.ali, self.supervisor)
        letter = GeneratedLetter.objects.get()
        detail, pdf = f"{REQUESTS}{letter.pk}/", f"{REQUESTS}{letter.pk}/pdf/"

        for user in (self.ali.user, self.supervisor, self.office):
            self.as_user(user)
            response = self.client.get(detail)
            self.assertEqual(response.status_code, status.HTTP_200_OK, user.email)
            self.assertEqual(response.data["purpose"], SUPERVISOR_LETTER)
            self.assertEqual(
                response.data["recipients"],
                [{"name": "Ali Hassan", "relation": "Student"}, {"name": "Dr Supervisor", "relation": "Supervisor"}],
            )
            self.assertEqual(self.client.get(pdf).status_code, status.HTTP_200_OK, user.email)
        for user in (self.outsider, self.coordinator, self.bella.user, self.panel):
            self.as_user(user)
            self.assertEqual(self.client.get(detail).status_code, status.HTTP_404_NOT_FOUND, user.email)
            self.assertEqual(self.client.get(pdf).status_code, status.HTTP_404_NOT_FOUND, user.email)

        self.as_user(self.supervisor)
        received = self.client.get(RECEIVED)
        self.assertEqual([row["id"] for row in received.data], [str(letter.pk)])
        self.assertEqual(len(self.client.get(RECEIVED, {"student": "ltr-s1"}).data), 1)
        self.assertEqual(self.client.get(RECEIVED, {"student": "LTR-S2"}).data, [])
        self.as_user(self.outsider)
        self.assertEqual(self.client.get(RECEIVED).data, [])

    def test_the_office_can_filter_letters_by_how_they_were_made(self):
        self.make_template()
        self.appoint_supervisor(self.ali, self.supervisor)
        request_template = LetterTemplate.objects.create(name="Confirmation", status=LetterTemplate.Status.ACTIVE, content="x")
        GeneratedLetter.objects.create(student=self.bella, template=request_template, template_name="Confirmation")
        self.as_user(self.office)
        self.assertEqual([row["purpose"] for row in self.client.get(REQUESTS, {"madeBy": "automatic"}).data], [SUPERVISOR_LETTER])
        self.assertEqual([row["purpose"] for row in self.client.get(REQUESTS, {"madeBy": "request"}).data], ["REQUEST"])
        self.assertEqual(self.client.get(REQUESTS, {"madeBy": "robot"}).status_code, status.HTTP_400_BAD_REQUEST)

    def test_students_cannot_withdraw_or_request_appointment_letters(self):
        template = self.make_template()
        self.appoint_supervisor(self.ali, self.supervisor)
        letter = GeneratedLetter.objects.get()
        self.as_user(self.ali.user)
        self.assertEqual(self.client.post(f"{REQUESTS}{letter.pk}/withdraw/").status_code, status.HTTP_409_CONFLICT)
        self.assertEqual([row["id"] for row in self.client.get(REQUESTS).data], [str(letter.pk)])
        self.assertEqual(self.client.get(TEMPLATES).data, [])
        self.assertEqual(self.client.get(f"{TEMPLATES}{template.pk}/").status_code, status.HTTP_404_NOT_FOUND)
        asked = self.client.post(REQUESTS, {"templateId": template.pk}, format="json")
        self.assertEqual(asked.status_code, status.HTTP_404_NOT_FOUND)

    def test_rejecting_a_waiting_appointment_letter_tells_no_student(self):
        self.make_template()
        self.appoint_supervisor(self.ali, self.supervisor, course_codes="")
        letter = GeneratedLetter.objects.get()
        self.as_user(self.office)
        response = self.client.post(f"{REQUESTS}{letter.pk}/reject/", {"reason": "Made by mistake."}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Notification.objects.filter(recipient=self.ali.user).exists())
        self.assertEqual(len(self.client.get(MISSING).data), 1)

    def test_revoking_and_resending_reach_everyone_on_the_letter(self):
        self.make_template()
        self.appoint_supervisor(self.ali, self.supervisor)
        letter = GeneratedLetter.objects.get()
        self.as_user(self.office)
        resent = self.client.post(f"{REQUESTS}{letter.pk}/resend-notification/")
        self.assertEqual(resent.status_code, status.HTTP_200_OK)
        self.assertEqual(self.notices(letter).filter(event_key__endswith=":resend-1").count(), 2)

        revoked = self.client.post(f"{REQUESTS}{letter.pk}/revoke/", {"reason": "Wrong title."}, format="json")
        self.assertEqual(revoked.status_code, status.HTTP_200_OK)
        for user in (self.ali.user, self.supervisor):
            notice = Notification.objects.get(recipient=user, event_key=f"letters:letter-revoked:{letter.pk}")
            self.assertEqual(notice.record_type, LETTER_RECORD)
            self.assertIn("Wrong title.", notice.message)

    def test_the_pdf_carries_the_template_signatory_and_the_office_wording(self):
        self.make_template(signatory_name="Prof Signer", signatory_title="Deputy Dean (Postgraduate)")
        self.appoint_supervisor(self.ali, self.supervisor)
        letter = GeneratedLetter.objects.get()
        self.assertEqual(letter.signatory_name, "Prof Signer")
        self.as_user(self.supervisor)
        response = self.client.get(f"{REQUESTS}{letter.pk}/pdf/")
        text = " ".join(page.extract_text() for page in PdfReader(io.BytesIO(response.content)).pages)
        self.assertIn("Prof Signer", text)
        self.assertIn("DEPUTY DEAN (POSTGRADUATE)", text)
        self.assertIn("issued by the postgraduate office", " ".join(text.split()))
        self.assertNotIn("student's request", text)


class AppointmentTemplateTests(AppointmentLetterFixtures):
    def post(self, **fields):
        self.as_user(self.office)
        data = {"name": "Appointment letter", "status": LetterTemplate.Status.ACTIVE, "content": "Dear {{STUDENT_NAME}}"}
        return self.client.post(TEMPLATES, {**data, **fields}, format="json")

    def test_appointment_tags_only_work_in_their_kind_of_letter(self):
        request_letter = self.post(content="Panel: {{PANEL_NAME}}")
        self.assertEqual(request_letter.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(request_letter.data["unknownPlaceholders"], ["{{PANEL_NAME}}"])
        self.assertIn("{{PANEL_NAME}} works only in panel appointment letters.", request_letter.data["content"])
        supervisor_letter = self.post(purpose=SUPERVISOR_LETTER, content="Panel: {{PANEL_NAME}}")
        self.assertEqual(supervisor_letter.status_code, status.HTTP_400_BAD_REQUEST)
        panel_letter = self.post(purpose=PANEL_LETTER, content="Panel: {{PANEL_NAME}}, {{RESEARCH_TITLE}}")
        self.assertEqual(panel_letter.status_code, status.HTTP_201_CREATED)
        self.assertEqual(panel_letter.data["purpose"], PANEL_LETTER)

    def test_one_active_template_for_each_appointment_letter(self):
        first = self.post(purpose=SUPERVISOR_LETTER, name="Supervisor letter")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.post(purpose=SUPERVISOR_LETTER, name="Second supervisor letter")
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Supervisor letter is already the active supervisor appointment letter", second.data["detail"])
        draft = self.post(purpose=SUPERVISOR_LETTER, name="Draft letter", status=LetterTemplate.Status.DRAFT)
        self.assertEqual(draft.status_code, status.HTTP_201_CREATED)
        activated = self.client.patch(f"{TEMPLATES}{draft.data['id']}/", {"status": LetterTemplate.Status.ACTIVE}, format="json")
        self.assertEqual(activated.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.post(purpose=PANEL_LETTER, name="Panel letter").status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.post(name="Another request letter").status_code, status.HTTP_201_CREATED)

    def test_purpose_cannot_change_while_letters_wait(self):
        template = self.make_template()
        self.appoint_supervisor(self.ali, self.supervisor, course_codes="")
        self.as_user(self.office)
        response = self.client.patch(f"{TEMPLATES}{template.pk}/", {"purpose": "REQUEST"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        template.refresh_from_db()
        self.assertEqual(template.purpose, SUPERVISOR_LETTER)

    def test_office_fields_cannot_reuse_appointment_tag_names(self):
        response = self.post(
            purpose=SUPERVISOR_LETTER,
            customFields=[{"name": "COURSE_CODES", "label": "Course codes"}],
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signatory_is_saved_and_shown(self):
        response = self.post(purpose=SUPERVISOR_LETTER, signatoryName="  Prof Signer ", signatoryTitle="Deputy Dean")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["signatoryName"], "Prof Signer")
        self.assertEqual(response.data["signatoryTitle"], "Deputy Dean")

    def test_request_letters_keep_the_signatory_they_were_issued_with(self):
        template = LetterTemplate.objects.create(
            name="Confirmation", status=LetterTemplate.Status.ACTIVE, content="Dear {{STUDENT_NAME}}",
            signatory_name="Prof Signer", signatory_title="Deputy Dean",
        )
        self.as_user(self.ali.user)
        asked = self.client.post(REQUESTS, {"templateId": template.pk}, format="json")
        self.as_user(self.office)
        self.client.post(f"{REQUESTS}{asked.data['id']}/approve/", {"values": {}}, format="json")
        LetterTemplate.objects.filter(pk=template.pk).update(signatory_name="Someone Else")
        self.as_user(self.ali.user)
        letter = self.client.get(f"{REQUESTS}{asked.data['id']}/").data
        self.assertEqual((letter["signatoryName"], letter["signatoryTitle"]), ("Prof Signer", "Deputy Dean"))
        self.assertEqual(letter["purpose"], "REQUEST")
        self.assertNotIn("recipients", letter)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ApprovalFlowLetterTests(APITestCase):
    """The letters through the real appointment approval endpoints."""

    authenticate = workflow.SupervisorAppointmentWorkflowTests.authenticate
    accept_by_supervisor = workflow.SupervisorAppointmentWorkflowTests.accept_by_supervisor

    def setUp(self):
        workflow.SupervisorAppointmentWorkflowTests.setUp(self)
        media_root = tempfile.mkdtemp(prefix="appointment-letters-")
        self.media_settings = override_settings(MEDIA_ROOT=media_root)
        self.media_settings.enable()
        self.addCleanup(shutil.rmtree, media_root, True)
        self.addCleanup(self.media_settings.disable)
        clear_sample_templates()
        LetterTemplate.objects.create(
            name="Supervisor appointment", purpose=SUPERVISOR_LETTER, status=LetterTemplate.Status.ACTIVE,
            content="{{STUDENT_NAME}}: {{RESEARCH_TITLE}} ({{COURSE_CODES}}) with {{SUPERVISOR_NAME}}",
        )
        LetterTemplate.objects.create(
            name="Panel appointment", purpose=PANEL_LETTER, status=LetterTemplate.Status.ACTIVE,
            content="{{STUDENT_NAME}}: panel {{PANEL_NAME}}",
        )

    def test_approving_supervisor_and_panel_makes_both_letters(self):
        self.authenticate(self.student_user)
        submitted = self.client.post(
            "/api/appointments/supervisor/applications/",
            {
                "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
                "projectCourseCodes": "WQF7023",
                "researchTitle": "Letters on approval",
                "researchArea": "Software Engineering",
                "researchAbstract": "A synthetic application for appointment letters.",
                "researchIntent": valid_research_intent_json(),
                "documents": [SimpleUploadedFile(
                    "proposal.pdf", b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF", content_type="application/pdf",
                )],
                "requirementCodes": ["research-proposal"],
            },
            format="multipart",
        )
        self.assertEqual(submitted.status_code, status.HTTP_201_CREATED, submitted.data)
        application_id = submitted.data["id"]
        self.assertEqual(self.accept_by_supervisor(application_id).status_code, status.HTTP_200_OK)
        self.assertFalse(GeneratedLetter.objects.exists())

        self.authenticate(self.coordinator)
        with self.captureOnCommitCallbacks(execute=True):
            approved = self.client.post(
                f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
            )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        letter = GeneratedLetter.objects.get(purpose=SUPERVISOR_LETTER)
        self.assertEqual(letter.status, GeneratedLetter.Status.ISSUED)
        self.assertEqual(
            letter.content, "Student Applicant: Letters on approval (WQF7023) with Dr. Requested Supervisor"
        )
        self.assertEqual(set(letter.recipients.all()), {self.student_user, self.supervisor_user})

        self.authenticate(self.supervisor_user)
        recommendation = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": "MEA-SUP-001",
                "recommendedMemberId": self.other_supervisor.lecturer.staff_no,
                "justification": "Relevant expertise for the approved research area.",
            },
            format="json",
        )
        self.assertEqual(recommendation.status_code, status.HTTP_201_CREATED)
        self.authenticate(self.other_supervisor)
        self.client.post(f"/api/appointments/panel/recommendations/{recommendation.data['id']}/panel-accept/")
        self.authenticate(self.coordinator)
        with self.captureOnCommitCallbacks(execute=True):
            panel_approval = self.client.post(
                f"/api/appointments/panel/recommendations/{recommendation.data['id']}/coordinator-approve/"
            )
        self.assertEqual(panel_approval.status_code, status.HTTP_200_OK)
        panel_letter = GeneratedLetter.objects.get(purpose=PANEL_LETTER)
        self.assertEqual(panel_letter.content, "Student Applicant: panel Dr. Other Supervisor")
        self.assertEqual(
            set(panel_letter.recipients.all()), {self.student_user, self.other_supervisor, self.supervisor_user}
        )
