from types import SimpleNamespace
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.db import close_old_connections, connection, connections, transaction
from rest_framework.exceptions import ValidationError, APIException
from rest_framework.test import APITestCase, APITransactionTestCase

from . import test_appointment_lifecycle as fixture
from .research_intent_test_helpers import valid_research_intent_json
from .models import (
    AppointmentLifecycleEvent,
    AppointmentWorkflowEvent,
    PanelAppointment,
    PanelRecommendation,
    SupervisorApplication,
    SupervisorAppointment,
)
from .serializers import (
    PanelRecommendationCreateSerializer,
    SupervisorApplicationCreateSerializer,
)


class AppointmentRoleIntegrityTests(APITestCase):
    setUp = fixture.AppointmentLifecycleTests.setUp
    def _lecturer(self, email, staff_no, *, supervisor=False, panel=False):
        return fixture.AppointmentLifecycleTests._lecturer(
            self, email, staff_no, supervisor=supervisor,
            panel=panel or supervisor,
        )

    def supervisor_payload(self):
        return {
            "proposedSupervisorId": self.new_supervisor.lecturer.staff_no,
            "projectCourseCodes": "WQD7002",
            "researchTitle": self.profile.proposed_topic,
            "researchArea": self.profile.research_area,
            "researchAbstract": self.profile.abstract,
            "researchIntent": valid_research_intent_json(),
        }

    def panel_role(self, status="SUBMITTED_TO_PANEL", *, linked=True):
        if not linked:
            self.profile.student = None
            self.profile.save(update_fields=["student"])
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            academic_semester=self.semester,
            supervisor=self.supervisor,
            recommended_member=self.new_supervisor,
            status=status,
        )
        if status == "APPROVED":
            PanelAppointment.objects.create(
                recommendation=recommendation,
                profile=self.profile,
                supervisor=self.supervisor,
                panel_member=self.new_supervisor,
                approved_by=self.coordinator,
            )
        return recommendation

    def primary_request(self, status="PENDING_COORDINATOR"):
        return SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.new_supervisor,
            research_title=self.profile.proposed_topic,
            research_area=self.profile.research_area,
            research_abstract=self.profile.abstract,
            replaces_appointment=self.supervisor_appointment,
            replacement_reason="Research alignment.",
            status=status,
        )

    def assert_supervisor_submission_conflicts(self, panel_status, *, linked=True):
        self.panel_role(panel_status, linked=linked)
        self.client.force_authenticate(self.office)
        response = self.client.post(
            f"/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/replacement/",
            {"proposedSupervisorId": self.new_supervisor.lecturer.staff_no, "reason": "Research alignment."},
            format="json",
        )
        self.assertEqual(response.status_code, 409, response.data)
        self.assertIn("Panel", str(response.data))
        self.assertEqual(SupervisorApplication.objects.count(), 1)
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(self.supervisor_appointment.status, "ACTIVE")

    def test_primary_submission_rejects_active_panel(self):
        self.assert_supervisor_submission_conflicts("APPROVED")

    def test_primary_submission_rejects_pending_panel(self):
        self.assert_supervisor_submission_conflicts("PENDING_COORDINATOR")

    def test_primary_submission_checks_unlinked_matric_profile(self):
        self.assert_supervisor_submission_conflicts("APPROVED", linked=False)

    def test_primary_save_rechecks_panel_role_after_validation(self):
        self.supervisor_appointment.status = "ENDED"
        self.supervisor_appointment.save(update_fields=["status"])
        serializer = SupervisorApplicationCreateSerializer(
            data=self.supervisor_payload(),
            context={"request": SimpleNamespace(user=self.student_user)},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.panel_role()
        with self.assertRaisesMessage(ValidationError, "Panel"):
            with transaction.atomic():
                serializer.save()
        self.assertEqual(SupervisorApplication.objects.count(), 1)

    def assert_primary_approval_conflicts(self, panel_status):
        application = self.primary_request()
        recommendation = self.panel_role(panel_status)
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/appointments/supervisor/applications/{application.pk}/coordinator-approve/"
        )
        self.assertEqual(response.status_code, 409, response.data)
        application.refresh_from_db()
        recommendation.refresh_from_db()
        self.supervisor_appointment.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(application.status, "PENDING_COORDINATOR")
        self.assertEqual(recommendation.status, panel_status)
        self.assertEqual(self.supervisor_appointment.status, "ACTIVE")
        self.assertEqual(self.profile.supervisor, self.supervisor)
        self.assertEqual(SupervisorAppointment.objects.count(), 1)
        self.assertFalse(AppointmentLifecycleEvent.objects.exists())
        self.assertFalse(AppointmentWorkflowEvent.objects.exists())

    def test_primary_final_approval_rejects_active_panel(self):
        self.assert_primary_approval_conflicts("APPROVED")

    def test_primary_final_approval_rejects_pending_panel(self):
        self.assert_primary_approval_conflicts("SUBMITTED_TO_PANEL")

    def test_supervisor_candidates_exclude_active_and_pending_panel_roles(self):
        recommendation = self.panel_role()
        self.client.force_authenticate(self.student_user)
        for panel_status in ("SUBMITTED_TO_PANEL", "APPROVED"):
            if panel_status == "APPROVED":
                recommendation.status = panel_status
                recommendation.save(update_fields=["status"])
                PanelAppointment.objects.create(
                    recommendation=recommendation,
                    profile=self.profile,
                    supervisor=self.supervisor,
                    panel_member=self.new_supervisor,
                    approved_by=self.coordinator,
                )
            with self.subTest(status=panel_status):
                response = self.client.get("/api/appointments/supervisor/candidates/")
                self.assertEqual(response.status_code, 200)
                self.assertNotIn(
                    self.new_supervisor.lecturer.staff_no,
                    [row["id"] for row in response.data],
                )

    def test_supervisor_candidates_without_student_profile_return_controlled_error(self):
        user = type(self.student_user).objects.create_user(
            email="unprovisioned-student@example.test", full_name="Unprovisioned student",
            role=self.student_user.role,
        )
        self.client.force_authenticate(user)
        response = self.client.get("/api/appointments/supervisor/candidates/")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("student profile", str(response.data))

    def test_panel_submission_rejects_pending_primary_candidate(self):
        self.primary_request()
        self.client.force_authenticate(self.supervisor)
        response = self.client.post(
            "/api/appointments/panel/recommendations/",
            {"studentId": self.student.matric_no,
             "recommendedMemberId": self.new_supervisor.lecturer.staff_no},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("primary", str(response.data).lower())
        self.assertFalse(PanelRecommendation.objects.exists())

    def test_panel_save_rechecks_primary_role_after_validation(self):
        serializer = PanelRecommendationCreateSerializer(
            data={"studentId": self.student.matric_no,
                  "recommendedMemberId": self.new_supervisor.lecturer.staff_no},
            context={"request": SimpleNamespace(user=self.supervisor)},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.primary_request()
        with self.assertRaisesMessage(ValidationError, "primary"):
            with transaction.atomic():
                serializer.save()
        self.assertFalse(PanelRecommendation.objects.exists())

    def test_panel_final_approval_rejects_pending_primary(self):
        self.primary_request()
        recommendation = self.panel_role("PENDING_COORDINATOR")
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.pk}/coordinator-approve/"
        )
        self.assertEqual(response.status_code, 409, response.data)
        recommendation.refresh_from_db()
        self.assertEqual(recommendation.status, "PENDING_COORDINATOR")
        self.assertFalse(PanelAppointment.objects.exists())
        self.assertFalse(AppointmentWorkflowEvent.objects.exists())

    def test_panel_final_approval_rechecks_active_primary_against_stale_profile(self):
        self.supervisor_appointment.supervisor = self.new_supervisor
        self.supervisor_appointment.save(update_fields=["supervisor"])
        recommendation = self.panel_role("PENDING_COORDINATOR")
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.pk}/coordinator-approve/"
        )
        self.assertEqual(response.status_code, 409, response.data)
        self.assertIn("primary", str(response.data))
        recommendation.refresh_from_db()
        self.assertEqual(recommendation.status, "PENDING_COORDINATOR")
        self.assertFalse(PanelAppointment.objects.exists())

    def test_terminal_panel_history_allows_primary_replacement(self):
        self.panel_role("REJECTED_BY_PANEL")
        application = self.primary_request()
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/appointments/supervisor/applications/{application.pk}/coordinator-approve/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(SupervisorAppointment.objects.filter(
            application=application, status="ACTIVE"
        ).exists())


class AppointmentRoleConcurrencyTests(APITransactionTestCase):
    setUp = AppointmentRoleIntegrityTests.setUp
    _lecturer = AppointmentRoleIntegrityTests._lecturer
    supervisor_payload = AppointmentRoleIntegrityTests.supervisor_payload

    def test_competing_primary_and_panel_submissions_cannot_reserve_both_roles(self):
        from .supervisor_replacement import initiate_replacement
        panel = PanelRecommendationCreateSerializer(
            data={"studentId": self.student.matric_no,
                  "recommendedMemberId": self.new_supervisor.lecturer.staff_no},
            context={"request": SimpleNamespace(user=self.supervisor)},
        )
        self.assertTrue(panel.is_valid(), panel.errors)
        barrier = Barrier(2)

        def save(serializer):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '10s'")
                    cursor.execute("SET statement_timeout = '20s'")
                barrier.wait(timeout=10)
                try:
                    with transaction.atomic():
                        if serializer is None:
                            initiate_replacement(appointment_id=self.supervisor_appointment.pk, actor=self.office,
                                proposed_supervisor_id=self.new_supervisor.lecturer.staff_no, reason="Research alignment.")
                        else:
                            serializer.save()
                    return "created"
                except APIException:
                    return "conflict"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(save, serializer) for serializer in (None, panel)]
            results = [future.result(timeout=30) for future in futures]
        self.assertCountEqual(results, ["created", "conflict"])
        primary_count = SupervisorApplication.objects.filter(
            proposed_supervisor=self.new_supervisor,
            status__in=["SUBMITTED_TO_SUPERVISOR", "PENDING_COORDINATOR"],
        ).count()
        panel_count = PanelRecommendation.objects.filter(
            recommended_member=self.new_supervisor,
            status__in=PanelRecommendation.WORKLOAD_RESERVED_STATUSES,
        ).count()
        self.assertEqual(primary_count + panel_count, 1)
