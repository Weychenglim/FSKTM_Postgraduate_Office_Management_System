"""Appointment letters follow their appointments: a supporting supervisor gets a
confirmation letter like a supervisor or panel member does, and a letter stops
counting once its appointment ends or is replaced."""
from django.utils import timezone
from rest_framework import status

from announcements.models import Notification
from appointments.models import CoSupervisorAppointment, CoSupervisorNomination

from .appointment_letters import SUPPORTING, recipient_rows
from .models import GeneratedLetter, LetterPurpose, LetterTemplate
from .test_appointment_letters import CREATE, MISSING, RECEIVED, AppointmentLetterFixtures, clear_sample_templates


class LifecycleFixtures(AppointmentLetterFixtures):
    keep_samples = True

    def setUp(self):
        super().setUp()
        self.helper = self.lecturer("letters-help@example.test", "LTR-L4", "Dr Helper")

    def appoint_supporting(self, student, primary, helper, *, run=True):
        def create():
            nomination = CoSupervisorNomination.objects.create(
                student=student, primary_appointment=primary, nominator=primary.supervisor, candidate=helper,
                academic_semester=self.semester, justification="Fixture", status=CoSupervisorNomination.Status.APPROVED,
                candidate_decided_at=timezone.now(), coordinator_decided_at=timezone.now(),
            )
            return CoSupervisorAppointment.objects.create(
                nomination=nomination, student=student, supervisor=helper, approved_by=self.coordinator,
            )

        if not run:
            return create()
        with self.captureOnCommitCallbacks(execute=True):
            return create()

    def end(self, appointment, outcome="COMPLETED", replacement=None):
        with self.captureOnCommitCallbacks(execute=True):
            appointment.status = "ENDED"
            appointment.end_outcome = outcome
            appointment.ended_at = timezone.now()
            appointment.ended_by = self.office
            appointment.save(update_fields=["status", "end_outcome", "ended_at", "ended_by"])
            return replacement() if replacement else None

    def revoke_notices(self, letter):
        return Notification.objects.filter(event_key=f"letters:letter-revoked:{letter.pk}")


class SupportingSupervisorLetterTests(LifecycleFixtures):
    def test_an_approved_supporting_supervisor_gets_a_letter_with_the_supervisor_in_copy(self):
        primary = self.appoint_supervisor(self.ali, self.supervisor)
        appointment = self.appoint_supporting(self.ali, primary, self.helper)
        letter = GeneratedLetter.objects.get(co_supervisor_appointment=appointment)
        self.assertEqual(letter.status, GeneratedLetter.Status.ISSUED)
        self.assertTrue(letter.reference_number.startswith(f"UMF/PG/CSV/{self.year}/"))
        self.assertIn("Dear Dr Helper,", letter.content)
        self.assertIn("| Main Supervisor | Dr Supervisor |", letter.content)
        self.assertIn("PENGESAHAN PELANTIKAN SEBAGAI PENYELIA BERSAMA", letter.content_ms)
        self.assertNotIn("{{", letter.content + letter.content_ms)
        self.assertEqual(set(letter.recipients.all()), {self.ali.user, self.helper, self.supervisor})
        self.assertEqual(
            [(row["name"], row["relation"]) for row in recipient_rows(letter)],
            [("Ali Hassan", "Student"), ("Dr Helper", "Supporting supervisor"), ("Dr Supervisor", "Supervisor")],
        )
        titles = {notice.recipient_id: notice.title for notice in self.notices(letter)}
        self.assertEqual(titles[self.ali.user.pk], "Your supporting supervisor appointment letter is ready")
        self.assertEqual(titles[self.helper.pk], "Appointment letter: supporting supervisor for Ali Hassan")
        self.assertEqual(titles[self.supervisor.pk], "Copy of Ali Hassan's supporting supervisor appointment letter")
        self.as_user(self.helper)
        self.assertEqual([row["id"] for row in self.client.get(RECEIVED).data], [str(letter.pk)])

    def test_the_office_can_make_a_missing_supporting_supervisor_letter(self):
        primary = self.appoint_supervisor(self.ali, self.supervisor)
        LetterTemplate.objects.filter(purpose="CO_SUPERVISOR_APPOINTMENT").delete()
        appointment = self.appoint_supporting(self.ali, primary, self.helper)
        self.as_user(self.office)
        missing = [row for row in self.client.get(MISSING).data if row["kind"] == SUPPORTING]
        self.assertEqual([(row["appointmentId"], row["lecturerName"]) for row in missing], [(str(appointment.pk), "Dr Helper")])
        self.assertIn("no active supporting supervisor appointment letter template", missing[0]["problem"])
        notice = Notification.objects.get(event_key=f"letters:appointment-letter-missing:{SUPPORTING}:{appointment.pk}", recipient=self.office)
        self.assertIn("supporting supervisor appointment was approved", notice.message)
        self.make_template(purpose=LetterPurpose.CO_SUPERVISOR_APPOINTMENT, content="{{CO_SUPERVISOR_NAME}} for {{STUDENT_NAME}}", reference_prefix="UMF/PG/CSV")
        made = self.client.post(CREATE, {"appointments": [{"kind": SUPPORTING, "id": appointment.pk}]}, format="json")
        self.assertEqual(made.data["made"], 1, made.data)


class EndedAppointmentTests(LifecycleFixtures):
    def test_a_replaced_supervisor_loses_the_letter_and_the_new_one_gets_theirs(self):
        old = self.appoint_supervisor(self.ali, self.supervisor)
        letter = GeneratedLetter.objects.get(supervisor_appointment=old)
        new = self.end(old, "REPLACED", replacement=lambda: self.appoint_supervisor(self.ali, self.helper, run=False, supersedes=old))
        letter.refresh_from_db()
        self.assertEqual(letter.status, GeneratedLetter.Status.REVOKED)
        self.assertRegex(letter.revoke_reason, r"^Replaced on .+: Dr Helper is now the supervisor\.$")
        self.assertEqual(letter.revoked_by, self.office)
        told = {notice.recipient_id: notice for notice in self.revoke_notices(letter)}
        self.assertEqual(set(told), {self.ali.user.pk, self.supervisor.pk})
        self.assertIn("no longer valid", told[self.ali.user.pk].message)
        self.assertEqual(GeneratedLetter.objects.get(supervisor_appointment=new).status, GeneratedLetter.Status.ISSUED)

    def test_an_ended_panel_appointment_revokes_its_letter(self):
        self.appoint_supervisor(self.bella, self.supervisor)
        panel = self.appoint_panel(self.bella, self.panel)
        letter = GeneratedLetter.objects.get(panel_appointment=panel)
        self.end(panel)
        letter.refresh_from_db()
        self.assertEqual(letter.status, GeneratedLetter.Status.REVOKED)
        self.assertRegex(letter.revoke_reason, r"^The panel member appointment ended on .+\.$")
        self.assertEqual(self.revoke_notices(letter).count(), 3)

    def test_an_ended_supporting_supervisor_revokes_its_letter(self):
        primary = self.appoint_supervisor(self.ali, self.supervisor)
        supporting = self.appoint_supporting(self.ali, primary, self.helper)
        letter = GeneratedLetter.objects.get(co_supervisor_appointment=supporting)
        self.end(supporting)
        letter.refresh_from_db()
        self.assertEqual(letter.status, GeneratedLetter.Status.REVOKED)
        self.assertIn("supporting supervisor appointment ended", letter.revoke_reason)

    def test_a_letter_waiting_for_the_office_is_withdrawn_instead(self):
        clear_sample_templates()
        self.make_template(content="{{STUDENT_NAME}} {{COURSE_CODES}}")
        appointment = self.appoint_supervisor(self.ali, self.supervisor, course_codes="")
        letter = GeneratedLetter.objects.get(supervisor_appointment=appointment)
        self.assertEqual(letter.status, GeneratedLetter.Status.PENDING)
        self.end(appointment)
        letter.refresh_from_db()
        self.assertEqual(letter.status, GeneratedLetter.Status.WITHDRAWN)
        self.assertFalse(self.revoke_notices(letter).exists())

    def test_saving_an_active_appointment_again_changes_nothing(self):
        appointment = self.appoint_supervisor(self.ali, self.supervisor)
        with self.captureOnCommitCallbacks(execute=True):
            appointment.save()
        self.assertEqual(GeneratedLetter.objects.get(supervisor_appointment=appointment).status, GeneratedLetter.Status.ISSUED)

    def test_the_office_revoke_still_tells_everyone(self):
        appointment = self.appoint_supervisor(self.ali, self.supervisor)
        letter = GeneratedLetter.objects.get(supervisor_appointment=appointment)
        self.as_user(self.office)
        response = self.client.post(f"/api/letters/requests/{letter.pk}/revoke/", {"reason": "Wrong semester."}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["status"], "Revoked")
        self.assertEqual(self.revoke_notices(letter).count(), 2)
