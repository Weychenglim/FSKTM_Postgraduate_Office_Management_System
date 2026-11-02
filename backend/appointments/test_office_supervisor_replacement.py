from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase, APITransactionTestCase

from academics.models import OperationalEnforcement, OperationalPeriod, OperationalException
from announcements.models import Notification
from . import test_appointment_lifecycle as fixture
from .research_intent_test_helpers import valid_research_intent_json
from .models import SupervisorApplication, SupervisorAppointment, AppointmentWorkflowEvent


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class OfficeSupervisorReplacementTests(APITestCase):
    def setUp(self):
        from tempfile import TemporaryDirectory
        fixture.AppointmentLifecycleTests.setUp(self)
        media = TemporaryDirectory(prefix="office-replacement-")
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)
    _lecturer = fixture.AppointmentLifecycleTests._lecturer
    _panel_appointment = fixture.AppointmentLifecycleTests._panel_appointment

    @property
    def url(self):
        return f"/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/replacement/"

    def submit(self, actor=None, **fields):
        self.client.force_authenticate(actor or self.office)
        return self.client.post(self.url, {
            "proposedSupervisorId": self.new_supervisor.lecturer.staff_no,
            "reason": "Faculty-approved change of supervision.", **fields,
        }, format="json")

    def test_office_context_and_submission_keep_current_research_and_incumbent(self):
        self.profile.proposed_topic = "Current amended topic"
        self.profile.abstract = "Current saved abstract"
        self.profile.save()
        self.client.force_authenticate(self.office)
        context = self.client.get(self.url)
        self.assertEqual(context.status_code, 200)
        self.assertEqual(context.data["researchTitle"], "Current amended topic")
        self.assertEqual(context.data["studentId"], "DEMO-LIFE-001")
        self.assertTrue(context.data["canSubmit"])
        self.assertNotIn(self.supervisor.lecturer.staff_no, [row["id"] for row in context.data["candidates"]])
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["initiatedByOffice"])
        replacement = SupervisorApplication.objects.get(pk=response.data["id"])
        self.assertEqual(replacement.research_title, "Current amended topic")
        self.assertEqual(replacement.research_abstract, "Current saved abstract")
        self.assertEqual(replacement.replaces_appointment_id, self.supervisor_appointment.pk)
        self.assertIsNone(replacement.section_a)
        self.assertFalse(replacement.documents.exists())
        event = replacement.workflow_events.get(action="SUBMIT")
        self.assertEqual(event.actor, self.office)
        self.assertEqual(event.actor_role, "Office Staff/Admin")
        self.assertEqual(event.reason, "Faculty-approved change of supervision.")
        self.assertIn("Office", Notification.objects.get(recipient=self.new_supervisor).summary)
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(self.supervisor_appointment.status, "ACTIVE")
        team = self.client.get(f"/api/appointments/co-supervisor/students/{self.student.pk}/")
        self.assertFalse(team.data["canChangePrimarySupervisor"])
        self.assertEqual(team.data["pendingPrimaryReplacement"]["applicationId"], replacement.pk)
        self.assertEqual(self.submit().status_code, 409)

    def test_only_office_can_read_or_submit_replacement(self):
        for actor in [self.student_user, self.supervisor, self.coordinator]:
            self.client.force_authenticate(actor)
            self.assertEqual(self.client.get(self.url).status_code, 403)
            self.assertEqual(self.submit(actor).status_code, 403)
        self.assertEqual(SupervisorApplication.objects.count(), 1)

    def test_ambiguous_staff_identifier_returns_conflict_without_partial_mutation(self):
        self._lecturer("case-duplicate@example.test", "new-001", supervisor=True)
        applications = SupervisorApplication.objects.count()
        events = AppointmentWorkflowEvent.objects.count()
        notifications = Notification.objects.count()
        for staff_id in ["NEW-001", "new-001"]:
            with self.subTest(staff_id=staff_id):
                response = self.submit(proposedSupervisorId=staff_id)
                self.assertEqual(response.status_code, 409, response.data)
                self.assertIn("staff ID", str(response.data))
                self.assertEqual(SupervisorApplication.objects.count(), applications)
                self.assertEqual(AppointmentWorkflowEvent.objects.count(), events)
                self.assertEqual(Notification.objects.count(), notifications)
                self.supervisor_appointment.refresh_from_db()
                self.assertEqual(self.supervisor_appointment.status, "ACTIVE")

    def test_student_cannot_submit_replacement_or_new_application_with_incumbent(self):
        self.client.force_authenticate(self.student_user)
        payload = {"proposedSupervisorId": "NEW-001", "projectCourseCodes": "WQD7002", "researchTitle": "Forged topic",
                   "researchArea": "Computing", "researchAbstract": "Forged abstract", "researchIntent": valid_research_intent_json()}
        for extra in [{}, {"replacesAppointmentId": self.supervisor_appointment.pk,
                              "replacementReason": "Student request"}]:
            response = self.client.post("/api/appointments/supervisor/applications/", {**payload, **extra}, format="json")
            self.assertEqual(response.status_code, 400, response.data)
            self.assertIn("Office", str(response.data))
        self.assertEqual(self.client.get("/api/appointments/supervisor/application-prefill/").status_code, 403)

    def test_office_replacement_cannot_be_cancelled_by_student(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        self.client.force_authenticate(self.student_user)
        response = self.client.post(f"/api/appointments/supervisor/applications/{response.data['id']}/cancel/",
                                    {"reason": "Student must not cancel Office decision"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(SupervisorApplication.objects.latest("pk").status, "SUBMITTED_TO_SUPERVISOR")

    def test_strict_payload_rejects_research_declarations_and_nontext_values(self):
        for fields in [{"researchTitle": "Forged"}, {"sectionA": {"declarationAccepted": True}},
                       {"reason": "  "}, {"reason": 123}, {"proposedSupervisorId": 12}]:
            response = self.submit(**fields)
            self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(SupervisorApplication.objects.count(), 1)

    def test_replacement_accepts_json_only_without_uploads(self):
        self.client.force_authenticate(self.office)
        response = self.client.post(self.url, {"proposedSupervisorId": "NEW-001", "reason": "Office change"}, format="multipart")
        self.assertEqual(response.status_code, 415)
        self.assertEqual(SupervisorApplication.objects.count(), 1)

    def test_student_save_rechecks_incumbent_appointed_after_validation(self):
        from types import SimpleNamespace
        from rest_framework.exceptions import ValidationError
        from .serializers import SupervisorApplicationCreateSerializer
        self.supervisor_appointment.status = "ENDED"
        self.supervisor_appointment.save(update_fields=["status"])
        serializer = SupervisorApplicationCreateSerializer(data={
            "proposedSupervisorId": "NEW-001", "projectCourseCodes": "WQD7002", "researchTitle": "First request",
            "researchArea": "Computing", "researchAbstract": "Synthetic abstract",
            "researchIntent": valid_research_intent_json(),
        }, context={"request": SimpleNamespace(user=self.student_user)})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.supervisor_appointment.status = "ACTIVE"
        self.supervisor_appointment.save(update_fields=["status"])
        with self.assertRaisesMessage(ValidationError, "Office"):
            serializer.save()
        self.assertEqual(SupervisorApplication.objects.count(), 1)

    def test_stale_ended_appointment_is_not_eligible_for_office_change(self):
        self.supervisor_appointment.status = "ENDED"
        self.supervisor_appointment.save()
        response = self.submit()
        self.assertEqual(response.status_code, 409, response.data)

    def test_profile_absence_falls_back_to_incumbent_application(self):
        self.profile.delete()
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["researchTitle"], "Lifecycle-safe postgraduate workflows")
        self.assertEqual(response.data["researchAbstract"], "Persisted lifecycle research.")

    def test_legacy_case_variant_profile_and_active_panel_remain_linked_on_approval(self):
        panel = self._panel_appointment()
        self.profile.student = None
        self.profile.matric_no = "demo-life-001"
        self.profile.save(update_fields=["student", "matric_no"])
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        application_id = response.data["id"]
        self.client.force_authenticate(self.new_supervisor)
        self.assertEqual(self.client.post(f"/api/appointments/supervisor/applications/{application_id}/supervisor-accept/").status_code, 200)
        self.client.force_authenticate(self.coordinator)
        approved = self.client.post(f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/")
        self.assertEqual(approved.status_code, 200, approved.data)
        from .models import StudentResearchProfile
        self.assertEqual(StudentResearchProfile.objects.count(), 1)
        self.profile.refresh_from_db()
        panel.refresh_from_db()
        self.assertEqual(self.profile.student_id, self.student_user.pk)
        self.assertEqual(self.profile.supervisor_id, self.new_supervisor.pk)
        self.assertEqual(panel.profile_id, self.profile.pk)
        self.assertEqual(panel.status, "ACTIVE")

    def test_mismatched_profile_supervisor_blocks_office_change(self):
        self.profile.supervisor = self.new_supervisor
        self.profile.save(update_fields=["supervisor"])
        response = self.submit()
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(SupervisorApplication.objects.count(), 1)

    def test_team_change_action_is_office_only_and_student_lifecycle_guarded(self):
        url = f"/api/appointments/co-supervisor/students/{self.student.pk}/"
        for actor, allowed in [(self.office, True), (self.coordinator, False),
                               (self.supervisor, False), (self.student_user, False)]:
            self.client.force_authenticate(actor)
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["canChangePrimarySupervisor"], allowed)
        self.student.status = self.student.Status.DEFERRED
        self.student.save(update_fields=["status"])
        self.client.force_authenticate(self.office)
        self.assertFalse(self.client.get(url).data["canChangePrimarySupervisor"])
        self.assertEqual(self.submit().status_code, 409)

    def test_pending_supporting_role_is_excluded_and_rejected_on_submit(self):
        from .models import CoSupervisorNomination
        CoSupervisorNomination.objects.create(student=self.student, candidate=self.new_supervisor,
            nominator=self.supervisor, primary_appointment=self.supervisor_appointment,
            academic_semester=self.semester, justification="Supporting expertise")
        self.client.force_authenticate(self.office)
        context = self.client.get(self.url)
        self.assertNotIn("NEW-001", [row["id"] for row in context.data["candidates"]])
        response = self.submit()
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("co-supervisor", str(response.data))

    def test_office_attribution_survives_later_actor_role_change(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        application_id = response.data["id"]
        self.office.role = self.student_user.role
        self.office.save(update_fields=["role"])
        self.client.force_authenticate(self.student_user)
        exact = self.client.get(f"/api/appointments/supervisor/applications/{application_id}/")
        self.assertTrue(exact.data["initiatedByOffice"])

    def test_active_panel_appointment_survives_office_replacement_approval(self):
        panel = self._panel_appointment()
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        application_id = response.data["id"]
        self.client.force_authenticate(self.new_supervisor)
        self.assertEqual(self.client.post(f"/api/appointments/supervisor/applications/{application_id}/supervisor-accept/").status_code, 200)
        self.client.force_authenticate(self.coordinator)
        approved = self.client.post(f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/")
        self.assertEqual(approved.status_code, 200, approved.data)
        panel.refresh_from_db()
        self.assertEqual(panel.status, "ACTIVE")
        self.assertEqual(panel.profile_id, self.profile.pk)
        self.assertEqual(panel.panel_member, self.panel)

    def test_panel_candidate_is_excluded_and_cannot_be_forged(self):
        self._panel_appointment()
        from accounts.models import Supervisor
        Supervisor.objects.create(lecturer=self.panel.lecturer, max_supervisees=5)
        self.client.force_authenticate(self.office)
        context = self.client.get(self.url)
        self.assertEqual(context.status_code, 200)
        self.assertNotIn("PANEL-001", [row["id"] for row in context.data["candidates"]])
        self.assertEqual(self.submit(proposedSupervisorId="PANEL-001").status_code, 409)

    def test_closed_intake_blocks_office_but_student_personal_extension_applies(self):
        now = timezone.now()
        OperationalEnforcement.objects.create(academic_semester=self.semester,
            activity="SUPERVISOR_APPLICATION", enabled=True, updated_by=self.office)
        period = OperationalPeriod.objects.create(academic_semester=self.semester,
            activity="SUPERVISOR_APPLICATION", name="Ended intake", opens_at=now-timedelta(days=3),
            closes_at=now-timedelta(days=1), lifecycle_status="PUBLISHED", created_by=self.office)
        response = self.submit()
        self.assertEqual(response.status_code, 409, response.data)
        self.client.force_authenticate(self.office)
        context = self.client.get(self.url)
        self.assertFalse(context.data["canSubmit"])
        self.assertIsNotNone(context.data["blockedReason"])
        self.assertEqual(context.data["researchTitle"], self.profile.proposed_topic)
        OperationalException.objects.create(period=period, student=self.student_user, participant=self.student_user,
            deadline=now+timedelta(days=1), reason="Approved extra time", created_by=self.office)
        self.assertEqual(self.submit().status_code, 201)

    def test_approval_preserves_research_changed_while_replacement_pending(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        application_id = response.data["id"]
        self.client.force_authenticate(self.new_supervisor)
        accepted = self.client.post(f"/api/appointments/supervisor/applications/{application_id}/supervisor-accept/")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.profile.proposed_topic = "Research saved during review"
        self.profile.abstract = "Latest authoritative abstract"
        self.profile.save()
        self.client.force_authenticate(self.coordinator)
        approved = self.client.post(f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.proposed_topic, "Research saved during review")
        self.assertEqual(self.profile.abstract, "Latest authoritative abstract")
        self.assertEqual(self.profile.supervisor, self.new_supervisor)
        retry = self.client.post(f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/")
        self.assertEqual(retry.status_code, 200, retry.data)

    def test_ended_predecessor_blocks_office_replacement_acceptance(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        application_id = response.data["id"]
        self.supervisor_appointment.status = "ENDED"
        self.supervisor_appointment.save(update_fields=["status"])
        self.client.force_authenticate(self.new_supervisor)
        accepted = self.client.post(f"/api/appointments/supervisor/applications/{application_id}/supervisor-accept/")
        self.assertEqual(accepted.status_code, 409, accepted.data)
        self.assertEqual(SupervisorApplication.objects.get(pk=application_id).status, "SUBMITTED_TO_SUPERVISOR")
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.supervisor, self.supervisor)

    def test_ended_predecessor_blocks_office_replacement_final_approval(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        application_id = response.data["id"]
        self.client.force_authenticate(self.new_supervisor)
        self.assertEqual(self.client.post(f"/api/appointments/supervisor/applications/{application_id}/supervisor-accept/").status_code, 200)
        self.supervisor_appointment.status = "ENDED"
        self.supervisor_appointment.save(update_fields=["status"])
        self.client.force_authenticate(self.coordinator)
        approved = self.client.post(f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/")
        self.assertEqual(approved.status_code, 409, approved.data)
        self.assertEqual(SupervisorApplication.objects.get(pk=application_id).status, "PENDING_COORDINATOR")
        self.assertEqual(SupervisorAppointment.objects.count(), 1)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.supervisor, self.supervisor)

    def test_student_first_application_after_ending_has_no_replacement_metadata(self):
        self.supervisor_appointment.status = "ENDED"
        self.supervisor_appointment.save()
        from .test_supervisor_documents import valid_pdf
        self.client.force_authenticate(self.student_user)
        payload = {"proposedSupervisorId": "NEW-001", "projectCourseCodes": "WQD7002", "researchTitle": "New topic",
                   "researchArea": "Computing", "researchAbstract": "New abstract", "researchIntent": valid_research_intent_json()}
        forged = self.client.post("/api/appointments/supervisor/applications/", {
            **payload, "replacesAppointmentId": self.supervisor_appointment.pk, "replacementReason": "Forged",
        }, format="json")
        self.assertEqual(forged.status_code, 400, forged.data)
        response = self.client.post("/api/appointments/supervisor/applications/", {
            **payload, "documents": [valid_pdf()], "requirementCodes": ["research-proposal"],
        }, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(response.data["initiatedByOffice"])
        self.assertIsNone(response.data["replacesAppointmentId"])


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class OfficeSupervisorReplacementConcurrencyTests(APITransactionTestCase):
    setUp = fixture.AppointmentLifecycleTests.setUp
    _lecturer = fixture.AppointmentLifecycleTests._lecturer

    def test_simultaneous_office_submissions_create_one_audited_request(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections, connection, connections
        from rest_framework.test import APIClient
        if connection.vendor != "postgresql":
            self.skipTest("Requires PostgreSQL row locking")
        barrier = Barrier(2)

        def submit():
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET statement_timeout = '20s'")
                client = APIClient()
                client.force_authenticate(self.office)
                barrier.wait(timeout=10)
                response = client.post(
                    f"/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/replacement/",
                    {"proposedSupervisorId": "NEW-001", "reason": "Concurrent Office change"}, format="json")
                return response.status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(submit) for _ in range(2)]
            self.assertCountEqual([future.result(timeout=35) for future in futures], [201, 409])
        self.assertEqual(SupervisorApplication.objects.filter(replaces_appointment=self.supervisor_appointment).count(), 1)
        self.assertEqual(AppointmentWorkflowEvent.objects.filter(action="SUBMIT").count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=self.new_supervisor).count(), 1)
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(self.supervisor_appointment.status, "ACTIVE")
