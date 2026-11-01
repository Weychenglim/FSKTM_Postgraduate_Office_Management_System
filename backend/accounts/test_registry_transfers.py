from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import Coordinator, Student, User
from announcements.models import Notification
from appointments import test_appointment_lifecycle as fixture
from appointments.models import ResearchAmendment, SupervisorApplication

SE = "MASTER OF SOFTWARE ENGINEERING"


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class RegistryTransferTests(APITestCase):
    amendments = "/api/appointments/research-amendments/"

    def setUp(self):
        fixture.AppointmentLifecycleTests.setUp(self)

    _lecturer = fixture.AppointmentLifecycleTests._lecturer

    def summary(self, user):
        self.client.force_authenticate(user)
        return self.client.get(f"/api/registry/students/{self.student.matric_no}/transfer/")

    def request_transfer(self, destination=SE):
        self.client.force_authenticate(self.office)
        response = self.client.post(
            self.amendments,
            {"kind": "TRANSFER", "studentId": self.student.pk, "destinationProgramme": destination, "reason": "Student asked to move"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def act(self, user, pk, action="decision", **body):
        self.client.force_authenticate(user)
        if action == "decision":
            body.setdefault("expectedStatus", self.client.get(f"{self.amendments}{pk}/").data["status"])
        return self.client.post(f"{self.amendments}{pk}/{action}/", body, format="json")

    def notices(self, user):
        return list(Notification.objects.filter(recipient=user, target_module="REGISTRY").order_by("pk"))

    def test_the_office_sees_who_decides_and_what_stays(self):
        self.client.force_authenticate(self.office)
        record = self.client.get(f"/api/registry/students/{self.student.matric_no}/")
        self.assertEqual(record.data["userId"], self.student.pk)
        data = self.summary(self.office).data
        self.assertEqual(
            (data["studentId"], data["hasResearchProfile"], data["canRequest"], data["blockers"], data["pending"]),
            (self.student.pk, True, True, [], None),
        )
        self.assertEqual(data["currentCoordinators"], ["COORD-001"])
        destinations = {row["programme"]: row["coordinators"] for row in data["destinations"]}
        self.assertEqual(destinations[SE], ["COORD-002"])
        self.assertNotIn(self.student.programme, destinations)
        self.assertEqual(data["team"], {"primary": "OLD-001", "coSupervisors": [], "panel": []})
        self.assertEqual(data["unfinishedTasks"], 0)

    def test_read_only_roles_see_only_the_transfer_in_progress(self):
        for user in (self.coordinator, self.supervisor):
            data = self.summary(user).data
            self.assertEqual((data["hasResearchProfile"], data["canRequest"]), (True, False))
            self.assertNotIn("destinations", data)
        self.assertEqual(self.summary(self.new_supervisor).status_code, 404)
        self.assertEqual(self.summary(self.student_user).status_code, 403)
        row = self.request_transfer()
        pending = self.summary(self.coordinator).data["pending"]
        self.assertEqual(pending, {"id": row["id"], "status": "PENDING_SOURCE_COORDINATOR", "destination": SE, "stage": "current", "waitingFor": ["COORD-001"]})
        office = self.summary(self.office).data
        self.assertFalse(office["canRequest"])
        self.assertEqual(office["pending"]["id"], row["id"])

    def test_blockers_explain_why_a_transfer_cannot_start(self):
        pending = SupervisorApplication.objects.create(
            student=self.student, proposed_supervisor=self.new_supervisor, academic_semester=self.semester,
            research_title="Replacement", research_area="SE", research_abstract="Abstract",
        )
        data = self.summary(self.office).data
        self.assertFalse(data["canRequest"])
        self.assertEqual(len(data["blockers"]), 1)
        self.assertIn("nomination is waiting", data["blockers"][0])
        pending.delete()
        self.client.force_authenticate(self.student_user)
        self.client.post(self.amendments, {"kind": "RESEARCH", "title": "New title", "reason": "Scope"}, format="json")
        self.assertIn("research title or abstract change", self.summary(self.office).data["blockers"][0])
        Student.objects.filter(pk=self.student.pk).update(status=Student.Status.DEFERRED)
        self.assertIn("must be Active", self.summary(self.office).data["blockers"][0])

    def test_without_a_research_profile_the_record_is_edited_directly(self):
        self.profile.delete()
        data = self.summary(self.office).data
        self.assertEqual((data["hasResearchProfile"], data["canRequest"]), (False, False))
        self.assertNotIn("destinations", data)

    def test_no_coordinator_for_the_current_programme_skips_the_first_approval(self):
        Coordinator.objects.filter(lecturer=self.coordinator.lecturer).delete()
        self.assertEqual(self.summary(self.office).data["currentCoordinators"], [])
        with self.captureOnCommitCallbacks(execute=True):
            row = self.request_transfer()
        self.assertEqual(row["status"], "PENDING_DESTINATION_COORDINATOR")
        self.assertEqual(row["events"][0]["newStatus"], "PENDING_DESTINATION_COORDINATOR")
        self.assertEqual([notice.title for notice in self.notices(self.other_coordinator)], ["Programme transfer waiting for you: Lifecycle Student"])
        response = self.act(self.other_coordinator, row["id"], decision="APPROVE", retainTeam=True)
        self.assertEqual((response.status_code, response.data["status"]), (200, "APPROVED"))
        self.student.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual((self.student.programme, self.profile.programme), (SE, SE))

    def test_notices_follow_the_transfer_to_its_end(self):
        with self.captureOnCommitCallbacks(execute=True):
            row = self.request_transfer()
        first = self.notices(self.coordinator)
        self.assertEqual(len(first), 1)
        self.assertEqual(
            (first[0].title, first[0].record_type, first[0].record_id, first[0].is_announcement),
            ("Programme transfer waiting for you: Lifecycle Student", "PROGRAMME_TRANSFER", str(row["id"]), False),
        )
        self.assertEqual(self.notices(self.office), [])
        with self.captureOnCommitCallbacks(execute=True):
            self.act(self.coordinator, row["id"], decision="APPROVE", retainTeam=True)
        self.assertEqual(len(self.notices(self.other_coordinator)), 1)
        with self.captureOnCommitCallbacks(execute=True):
            self.act(self.other_coordinator, row["id"], decision="APPROVE", retainTeam=True)
        self.assertEqual([notice.title for notice in self.notices(self.student_user)], [f"You are now in {SE}"])
        self.assertEqual([notice.title for notice in self.notices(self.office)], ["Transferred: Lifecycle Student"])

    def test_a_rejection_or_cancellation_tells_the_student_why(self):
        row = self.request_transfer()
        with self.captureOnCommitCallbacks(execute=True):
            self.act(self.coordinator, row["id"], decision="REJECT", reason="Wrong semester")
        student_notice = self.notices(self.student_user)[-1]
        self.assertEqual(student_notice.title, "Your programme transfer was not approved")
        self.assertIn("Wrong semester", student_notice.message)
        self.assertIn("COORD-001 rejected", self.notices(self.office)[-1].message)
        row = self.request_transfer()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.act(self.office, row["id"], action="cancel", reason="Asked in error")
        self.assertEqual(response.data["status"], "CANCELLED")
        self.assertEqual(self.notices(self.student_user)[-1].title, "Your programme transfer was cancelled")
        self.assertNotIn("Transfer cancelled: Lifecycle Student", [notice.title for notice in self.notices(self.office)])

    def test_programme_coordinators_for_the_transfer_screens(self):
        self.client.force_authenticate(self.office)
        rows = {row["programme"]: row["coordinators"] for row in self.client.get("/api/registry/programme-coordinators/").data["programmes"]}
        self.assertEqual(rows[self.student.programme], ["COORD-001"])
        self.assertEqual(rows[SE], ["COORD-002"])
        self.assertEqual(rows["MASTER OF DATA SCIENCE (COURSEWORK)"], [])
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.get("/api/registry/programme-coordinators/").status_code, 200)
        for user in (self.supervisor, self.student_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/registry/programme-coordinators/").status_code, 403)
        self.assertEqual(User.objects.filter(role=User.Role.COORDINATOR).count(), 2)
        self.assertFalse(ResearchAmendment.objects.exists())
