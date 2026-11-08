from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import Student, User
from accounts.programmes import APPROVED_PROGRAMMES
from appointments import test_appointment_lifecycle as fixture
from appointments.models import ResearchAmendment, ResearchProfileRevision, StudentResearchProfile, SupervisorApplication


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ProgrammeCorrectionTests(APITestCase):
    amendments = "/api/appointments/research-amendments/"

    def setUp(self):
        fixture.AppointmentLifecycleTests.setUp(self)
        self.wrong = self.student.programme
        self.right = next(programme for programme in APPROVED_PROGRAMMES if programme != self.wrong)
        self.url = f"/api/registry/students/{self.student.matric_no}/"
        self.client.force_authenticate(self.office)

    _lecturer = fixture.AppointmentLifecycleTests._lecturer

    def correct(self, **body):
        return self.client.patch(self.url, {"programme": self.right, **body}, format="json")

    def assert_unchanged(self):
        self.student.refresh_from_db()
        self.assertEqual(self.student.programme, self.wrong)
        self.assertEqual(StudentResearchProfile.objects.get(student_id=self.student.pk).programme, self.wrong)

    def test_record_says_whether_there_is_a_research_profile(self):
        self.assertTrue(self.client.get(self.url).data["hasResearchProfile"])
        StudentResearchProfile.objects.filter(student_id=self.student.pk).delete()
        self.assertFalse(self.client.get(self.url).data["hasResearchProfile"])

    def test_a_reason_is_required(self):
        for body in ({}, {"programmeReason": "   "}):
            response = self.correct(**body)
            self.assertEqual(response.status_code, 400)
            self.assertIn("programmeReason", response.data)
        self.assert_unchanged()

    def test_the_record_and_research_profile_change_together_and_it_is_logged(self):
        profile = StudentResearchProfile.objects.get(student_id=self.student.pk)
        title, revision = profile.proposed_topic, profile.revision
        response = self.correct(programmeReason="Imported with the wrong programme", phone="012-3334444")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["programme"], self.right)
        self.assertEqual(response.data["phone"], "012-3334444")
        self.student.refresh_from_db()
        profile.refresh_from_db()
        self.assertEqual(self.student.programme, self.right)
        self.assertEqual(profile.programme, self.right)
        self.assertEqual(profile.proposed_topic, title)
        self.assertEqual(profile.revision, revision + 1)
        log = ResearchProfileRevision.objects.get(profile=profile, revision=profile.revision)
        self.assertEqual(log.kind, "CORRECTION")
        self.assertEqual(log.actor_id, self.office.pk)
        self.assertEqual(log.reason, "Imported with the wrong programme")
        self.assertEqual(log.before_values["programme"], self.wrong)
        self.assertEqual(log.after_values["programme"], self.right)

    def test_a_waiting_nomination_stops_it_and_nothing_is_saved(self):
        SupervisorApplication.objects.create(
            student=self.student, proposed_supervisor=self.new_supervisor, academic_semester=self.semester,
            research_title="Replacement", research_area="SE", research_abstract="Abstract",
        )
        response = self.correct(programmeReason="Wrong programme", phone="012-5556666")
        self.assertEqual(response.status_code, 409)
        self.assertIn("nomination is waiting", response.data["error"])
        self.assert_unchanged()
        self.student.user.refresh_from_db()
        self.assertNotEqual(self.student.user.phone, "012-5556666")

    def test_a_waiting_research_change_stops_it(self):
        self.client.force_authenticate(self.student_user)
        submitted = self.client.post(self.amendments, {"kind": "RESEARCH", "title": "New title", "reason": "Scope"}, format="json")
        self.assertEqual(submitted.status_code, 201, submitted.data)
        self.assertTrue(ResearchAmendment.objects.filter(student_id=self.student.pk).exists())
        self.client.force_authenticate(self.office)
        response = self.correct(programmeReason="Wrong programme")
        self.assertEqual(response.status_code, 409)
        self.assertIn("research change", response.data["error"])
        self.assert_unchanged()

    def test_a_student_who_is_no_longer_active_can_still_be_corrected(self):
        Student.objects.filter(pk=self.student.pk).update(status=Student.Status.GRADUATED)
        response = self.correct(programmeReason="Wrong programme")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(StudentResearchProfile.objects.get(student_id=self.student.pk).programme, self.right)

    def test_only_the_office_can_correct_it(self):
        reader = User.objects.create_user(
            email="reader.fix@example.test", password="Registry-pass-7731!", full_name="Reader", role=User.Role.COORDINATOR,
        )
        self.client.force_authenticate(reader)
        self.assertEqual(self.correct(programmeReason="Wrong programme").status_code, 403)
        self.assert_unchanged()
