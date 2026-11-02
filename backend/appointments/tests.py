from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Coordinator, Lecturer, OfficeStaff, Panel, Student
from announcements.models import Notification
from academics.models import AcademicSemester, LecturerAvailabilityWindow
from academics.test_capacity_helpers import publish_test_capacity_plan

from .models import (
    AppointmentWorkflowEvent,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
    count_panel_workload,
)

User = get_user_model()


class PanelRecommendationWorkflowTests(APITestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user(
            email="supervisor@example.com",
            password="password123",
            full_name="Dr. Supervisor",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.supervisor, staff_no="L10001", department="Software Engineering"
        )
        self.panel = User.objects.create_user(
            email="panel@example.com",
            password="password123",
            full_name="Dr. Panel",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.panel, staff_no="L10002", department="Data Science"
        )
        Panel.objects.create(lecturer=self.panel.lecturer, max_appointments=5)
        self.other_panel = User.objects.create_user(
            email="other-panel@example.com",
            password="password123",
            full_name="Dr. Other Panel",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.other_panel,
            staff_no="L10003",
            department="Artificial Intelligence",
        )
        Panel.objects.create(lecturer=self.other_panel.lecturer, max_appointments=5)
        self.coordinator = User.objects.create_user(
            email="coordinator@example.com",
            password="password123",
            full_name="Dr. Coordinator",
            role=User.Role.COORDINATOR,
        )
        Lecturer.objects.create(
            user=self.coordinator, staff_no="C10001", department="Software Engineering"
        )
        Coordinator.objects.create(
            lecturer=self.coordinator.lecturer,
            programme_managed="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.office_admin = User.objects.create_user(
            email="office@example.com",
            password="password123",
            full_name="Office Admin",
            role=User.Role.OFFICE_ADMIN,
        )
        OfficeStaff.objects.create(
            user=self.office_admin,
            staff_no="M10001",
            department="Postgraduate Office",
        )
        self.student = User.objects.create_user(
            email="student@example.com",
            password="password123",
            full_name="Nur Student",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=self.student,
            matric_no="MEA999001",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.profile = StudentResearchProfile.objects.create(
            student=self.student,
            matric_no="MEA999001",
            student_name="Nur Student",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            semester="Sem 1 2025/2026",
            proposed_topic="Secure Workflow Automation",
            research_area="Software Engineering",
            abstract="Research abstract",
            supervisor=self.supervisor,
        )
        today = timezone.localdate()
        self.academic_semester = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=120),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office_admin,
            activated_at=timezone.now(),
        )
        supervisor_application = SupervisorApplication.objects.create(
            student=self.student.student,
            academic_semester=self.academic_semester,
            proposed_supervisor=self.supervisor,
            research_title=self.profile.proposed_topic,
            research_area=self.profile.research_area,
            research_abstract=self.profile.abstract,
            status=SupervisorApplication.Status.APPROVED,
            supervisor_decided_at=timezone.now(),
            coordinator_decided_at=timezone.now(),
        )
        self.supervisor_appointment = SupervisorAppointment.objects.create(
            application=supervisor_application,
            student=self.student.student,
            supervisor=self.supervisor,
            approved_by=self.coordinator,
        )
        publish_test_capacity_plan(self.academic_semester, self.office_admin)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_submitted_recommendation(self):
        self.authenticate(self.supervisor)
        response = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.panel.lecturer.staff_no,
                "justification": "Strong match for the research topic.",
                "status": PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def create_profile(self, matric_no, supervisor=None, with_appointment=True):
        student = User.objects.create_user(
            email=f"{matric_no.lower()}@example.com",
            password="password123",
            full_name=f"Student {matric_no}",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=student,
            matric_no=matric_no,
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        assigned_supervisor = supervisor or self.other_panel
        profile = StudentResearchProfile.objects.create(
            student=student,
            matric_no=matric_no,
            student_name=f"Student {matric_no}",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            semester="Sem 1 2025/2026",
            proposed_topic=f"Research Topic {matric_no}",
            research_area="Software Engineering",
            abstract="Research abstract",
            supervisor=assigned_supervisor,
        )
        if with_appointment:
            application = SupervisorApplication.objects.create(
                student=student.student,
                academic_semester=self.academic_semester,
                proposed_supervisor=assigned_supervisor,
                research_title=profile.proposed_topic,
                research_area=profile.research_area,
                research_abstract=profile.abstract,
                status=SupervisorApplication.Status.APPROVED,
                supervisor_decided_at=timezone.now(),
                coordinator_decided_at=timezone.now(),
            )
            SupervisorAppointment.objects.create(
                application=application,
                student=student.student,
                supervisor=assigned_supervisor,
                approved_by=self.coordinator,
            )
        return profile

    def test_legacy_accepted_by_panel_status_is_removed(self):
        self.assertNotIn("ACCEPTED_BY_PANEL", PanelRecommendation.Status.values)

    def test_submitted_recommendation_uses_active_semester(self):
        payload = self.create_submitted_recommendation()
        recommendation = PanelRecommendation.objects.get(pk=payload["id"])

        self.assertEqual(recommendation.academic_semester, self.academic_semester)
        self.assertEqual(payload["semesterId"], self.academic_semester.pk)
        self.assertEqual(payload["semester"], self.academic_semester.label)

        self.authenticate(self.student)
        student_status = self.client.get("/api/appointments/panel/student/")
        self.assertEqual(
            student_status.data["readinessState"],
            "FACULTY_PROCESSING",
        )
        self.assertIsNone(student_status.data["panelMemberName"])

    def test_panel_eligibility_requires_active_supervisor_appointment(self):
        self.authenticate(self.supervisor)
        eligible = self.client.get("/api/appointments/panel/eligible-supervisees/")

        self.assertEqual(eligible.status_code, status.HTTP_200_OK)
        self.assertEqual(eligible.data[0]["studentId"], self.profile.matric_no)
        self.assertEqual(
            eligible.data[0]["supervisorAppointmentId"],
            self.supervisor_appointment.pk,
        )

        self.supervisor_appointment.delete()
        eligible = self.client.get("/api/appointments/panel/eligible-supervisees/")
        self.assertEqual(eligible.data, [])

        bypass = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.panel.lecturer.staff_no,
                "justification": "Attempt a direct identifier bypass.",
            },
            format="json",
        )
        self.assertEqual(bypass.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(PanelRecommendation.objects.exists())

    def test_recommendation_is_blocked_without_effective_semester(self):
        self.academic_semester.lifecycle_status = AcademicSemester.Lifecycle.CLOSED
        self.academic_semester.save(update_fields=["lifecycle_status"])
        self.authenticate(self.supervisor)

        response = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.panel.lecturer.staff_no,
                "justification": "No semester should reject this.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(PanelRecommendation.objects.exists())

    def reserve_panel_workload(self, panel_member, count):
        for index in range(count):
            profile = self.create_profile(f"MEA888{index:03d}")
            PanelRecommendation.objects.create(
                profile=profile,
                supervisor=profile.supervisor,
                recommended_member=panel_member,
                justification="Existing accepted nomination.",
                status=PanelRecommendation.Status.PENDING_COORDINATOR,
            )

    def test_office_panel_records_include_approved_pending_rejected_and_no_panel_profiles(
        self,
    ):
        approved_profile = self.create_profile("MEA999010", supervisor=self.supervisor)
        approved_recommendation = PanelRecommendation.objects.create(
            profile=approved_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Approved panel.",
            status=PanelRecommendation.Status.APPROVED,
        )
        PanelAppointment.objects.create(
            recommendation=approved_recommendation,
            profile=approved_profile,
            supervisor=self.supervisor,
            panel_member=self.panel,
            approved_by=self.coordinator,
        )
        pending_profile = self.create_profile("MEA999011", supervisor=self.supervisor)
        PanelRecommendation.objects.create(
            profile=pending_profile,
            supervisor=self.supervisor,
            recommended_member=self.other_panel,
            justification="Awaiting coordinator.",
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
        )
        submitted_profile = self.create_profile("MEA999012", supervisor=self.supervisor)
        PanelRecommendation.objects.create(
            profile=submitted_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Awaiting selected panel.",
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        )
        rejected_profile = self.create_profile("MEA999013", supervisor=self.supervisor)
        PanelRecommendation.objects.create(
            profile=rejected_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Rejected panel.",
            status=PanelRecommendation.Status.REJECTED_BY_PANEL,
        )

        self.authenticate(self.office_admin)
        response = self.client.get("/api/appointments/panel/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        records_by_id = {record["id"]: record for record in response.data}
        self.assertEqual(records_by_id[self.profile.matric_no]["status"], "No Panel")
        self.assertEqual(
            records_by_id[self.profile.matric_no]["panelMember"], "Not Assigned"
        )
        self.assertEqual(
            records_by_id[approved_profile.matric_no]["status"], "Approved"
        )
        self.assertEqual(records_by_id[pending_profile.matric_no]["status"], "Pending")
        self.assertEqual(
            records_by_id[submitted_profile.matric_no]["status"], "Recommendation"
        )
        self.assertEqual(
            records_by_id[rejected_profile.matric_no]["status"], "Rejected"
        )

    def test_panel_records_are_office_admin_only(self):
        for user in [self.supervisor, self.panel, self.coordinator, self.student]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get("/api/appointments/panel/")
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_office_panel_records_include_cancelled_recommendation_payload(self):
        cancelled_profile = self.create_profile("MEA999020", supervisor=self.supervisor)
        cancelled = PanelRecommendation.objects.create(
            profile=cancelled_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Cancelled recommendation.",
            status=PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR,
            cancellation_reason="Student changed research direction.",
            cancelled_at=timezone.now(),
        )
        AppointmentWorkflowEvent.objects.create(
            actor=self.supervisor,
            actor_role=self.supervisor.role,
            action="SUPERVISOR_CANCEL",
            previous_status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            new_status=PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR,
            reason=cancelled.cancellation_reason,
            panel_recommendation=cancelled,
        )

        self.authenticate(self.office_admin)
        response = self.client.get("/api/appointments/panel/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(
            record
            for record in response.data
            if record["id"] == cancelled_profile.matric_no
        )
        self.assertEqual(row["status"], "Cancelled")
        self.assertEqual(row["recordId"], f"recommendation-{cancelled.pk}")
        self.assertEqual(row["recommendationId"], cancelled.pk)
        self.assertIsNotNone(row["cancelledAt"])
        self.assertEqual(
            row["cancellationReason"], "Student changed research direction."
        )
        self.assertEqual(row["workflow"][0]["action"], "SUPERVISOR_CANCEL")

    def test_office_panel_records_keep_rejected_history_after_later_approval(self):
        profile = self.create_profile("MEA999014", supervisor=self.supervisor)
        rejected = PanelRecommendation.objects.create(
            profile=profile,
            supervisor=self.supervisor,
            recommended_member=self.other_panel,
            justification="First attempt.",
            panel_rejection_reason="Panel member unavailable.",
            status=PanelRecommendation.Status.REJECTED_BY_PANEL,
        )
        approved = PanelRecommendation.objects.create(
            profile=profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Second attempt.",
            status=PanelRecommendation.Status.APPROVED,
        )
        PanelAppointment.objects.create(
            recommendation=approved,
            profile=profile,
            supervisor=self.supervisor,
            panel_member=self.panel,
            approved_by=self.coordinator,
        )

        self.authenticate(self.office_admin)
        response = self.client.get("/api/appointments/panel/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = [row for row in response.data if row["id"] == profile.matric_no]
        self.assertEqual(len(rows), 2)
        self.assertEqual({row["status"] for row in rows}, {"Approved", "Rejected"})
        self.assertEqual(len({row["recordId"] for row in rows}), 2)
        rejected_row = next(row for row in rows if row["status"] == "Rejected")
        self.assertEqual(rejected_row["panelMember"], self.other_panel.full_name)
        self.assertEqual(rejected_row["rejectionStage"], "Selected Panel")
        self.assertEqual(rejected_row["rejectionReason"], "Panel member unavailable.")
        self.assertEqual(rejected_row["recommendationId"], rejected.pk)

    def test_coordinator_workspace_is_scoped_to_managed_programme(self):
        in_scope_profile = self.create_profile("MEA999015", supervisor=self.supervisor)
        in_scope_recommendation = PanelRecommendation.objects.create(
            profile=in_scope_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="In scope.",
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
        )
        out_of_scope_profile = self.create_profile(
            "MEA999016", supervisor=self.supervisor
        )
        out_of_scope_profile.programme = "MASTER OF DATA SCIENCE (COURSEWORK)"
        out_of_scope_profile.save(update_fields=["programme", "updated_at"])
        PanelRecommendation.objects.create(
            profile=out_of_scope_profile,
            supervisor=self.supervisor,
            recommended_member=self.other_panel,
            justification="Out of scope.",
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
        )

        self.authenticate(self.coordinator)
        response = self.client.get("/api/appointments/panel/coordinator-workspace/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["programme"],
            "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.assertEqual(response.data["pendingCount"], 1)
        self.assertEqual(
            [item["id"] for item in response.data["queue"]],
            [in_scope_recommendation.pk],
        )
        self.assertEqual(
            {item["studentId"] for item in response.data["records"]},
            {in_scope_profile.matric_no},
        )
        queue_response = self.client.get("/api/appointments/panel/coordinator-queue/")
        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in queue_response.data], [in_scope_recommendation.pk]
        )

    def test_coordinator_without_managed_programme_gets_empty_workspace(self):
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="No programme assignment.",
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
        )
        self.coordinator.lecturer.coordinator.programme_managed = ""
        self.coordinator.lecturer.coordinator.save(update_fields=["programme_managed"])

        self.authenticate(self.coordinator)
        response = self.client.get("/api/appointments/panel/coordinator-workspace/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["programme"], "")
        self.assertEqual(response.data["pendingCount"], 0)
        self.assertEqual(response.data["queue"], [])
        self.assertEqual(response.data["records"], [])
        self.assertEqual(response.data["message"], "No programme assigned")
        decision = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.pk}/coordinator-approve/"
        )
        self.assertEqual(decision.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordinator_workspace_contains_full_recommendation_lifecycle(self):
        lifecycle_statuses = [
            PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            PanelRecommendation.Status.REJECTED_BY_PANEL,
            PanelRecommendation.Status.PENDING_COORDINATOR,
            PanelRecommendation.Status.REJECTED_BY_COORDINATOR,
            PanelRecommendation.Status.APPROVED,
        ]
        for index, recommendation_status in enumerate(lifecycle_statuses, start=30):
            profile = self.create_profile(f"MEA9990{index}", supervisor=self.supervisor)
            PanelRecommendation.objects.create(
                profile=profile,
                supervisor=self.supervisor,
                recommended_member=self.panel,
                justification=f"Lifecycle {recommendation_status}.",
                status=recommendation_status,
                panel_decided_at=(
                    timezone.now()
                    if recommendation_status
                    != PanelRecommendation.Status.SUBMITTED_TO_PANEL
                    else None
                ),
                coordinator_decided_at=(
                    timezone.now()
                    if recommendation_status
                    in [
                        PanelRecommendation.Status.REJECTED_BY_COORDINATOR,
                        PanelRecommendation.Status.APPROVED,
                    ]
                    else None
                ),
            )

        self.authenticate(self.coordinator)
        response = self.client.get("/api/appointments/panel/coordinator-workspace/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["status"] for item in response.data["records"]},
            set(lifecycle_statuses),
        )

    def test_coordinator_cannot_decide_recommendation_for_another_programme(self):
        profile = self.create_profile("MEA999017", supervisor=self.supervisor)
        profile.programme = "MASTER OF DATA SCIENCE (COURSEWORK)"
        profile.save(update_fields=["programme", "updated_at"])
        recommendation = PanelRecommendation.objects.create(
            profile=profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Different programme.",
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
        )

        self.authenticate(self.coordinator)
        response = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.pk}/coordinator-approve/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        recommendation.refresh_from_db()
        self.assertEqual(
            recommendation.status, PanelRecommendation.Status.PENDING_COORDINATOR
        )

    def test_selected_panel_review_history_keeps_later_coordinator_outcome(self):
        accepted_profile = self.create_profile("MEA999018", supervisor=self.supervisor)
        accepted = PanelRecommendation.objects.create(
            profile=accepted_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Accepted by selected panel.",
            status=PanelRecommendation.Status.APPROVED,
            submitted_at=timezone.now(),
            panel_decided_at=timezone.now(),
            coordinator_decided_at=timezone.now(),
        )
        rejected_profile = self.create_profile("MEA999019", supervisor=self.supervisor)
        rejected = PanelRecommendation.objects.create(
            profile=rejected_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Rejected by selected panel.",
            panel_rejection_reason="Topic conflict.",
            status=PanelRecommendation.Status.REJECTED_BY_PANEL,
            submitted_at=timezone.now(),
            panel_decided_at=timezone.now(),
        )
        other_profile = self.create_profile("MEA999021", supervisor=self.supervisor)
        PanelRecommendation.objects.create(
            profile=other_profile,
            supervisor=self.supervisor,
            recommended_member=self.other_panel,
            justification="Another lecturer.",
            status=PanelRecommendation.Status.REJECTED_BY_PANEL,
            submitted_at=timezone.now(),
            panel_decided_at=timezone.now(),
        )

        self.authenticate(self.panel)
        response = self.client.get("/api/appointments/panel/review-history/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data}, {accepted.pk, rejected.pk}
        )
        accepted_row = next(item for item in response.data if item["id"] == accepted.pk)
        rejected_row = next(item for item in response.data if item["id"] == rejected.pk)
        self.assertEqual(accepted_row["selectedPanelDecision"], "ACCEPTED")
        self.assertEqual(accepted_row["status"], PanelRecommendation.Status.APPROVED)
        self.assertEqual(rejected_row["selectedPanelDecision"], "REJECTED")
        self.assertEqual(rejected_row["rejectionReason"], "Topic conflict.")

    def test_supervisor_can_submit_one_recommendation_and_duplicate_is_blocked(self):
        recommendation = self.create_submitted_recommendation()
        self.assertEqual(
            recommendation["status"], PanelRecommendation.Status.SUBMITTED_TO_PANEL
        )
        self.assertEqual(recommendation["studentId"], self.profile.matric_no)
        self.assertEqual(
            recommendation["recommendedMemberId"], self.panel.lecturer.staff_no
        )
        self.assertIsNotNone(recommendation["submittedAt"])
        self.assertIsNone(recommendation["panelDecisionAt"])
        self.assertIsNone(recommendation["coordinatorDecisionAt"])

        duplicate = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.other_panel.lecturer.staff_no,
                "justification": "Try another active recommendation.",
                "status": PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_supervisor_cannot_save_panel_recommendation_as_draft(self):
        self.authenticate(self.supervisor)
        response = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.panel.lecturer.staff_no,
                "justification": "Save this for later.",
                "status": "DRAFT",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            PanelRecommendation.objects.filter(profile=self.profile).exists()
        )

    def test_full_panel_workload_blocks_new_submission(self):
        self.reserve_panel_workload(self.panel, 5)

        self.authenticate(self.supervisor)
        response = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.panel.lecturer.staff_no,
                "justification": "Strong match for the research topic.",
                "status": PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("capacity", str(response.data).lower())
        self.assertFalse(
            PanelRecommendation.objects.filter(profile=self.profile).exists()
        )

    def test_panel_candidates_expose_capacity_and_hide_unavailable_lecturers(self):
        today = timezone.localdate()
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.academic_semester,
            lecturer=self.panel.lecturer,
            role=LecturerAvailabilityWindow.Role.PANEL,
            starts_on=today,
            ends_on=today + timedelta(days=2),
            reason="Private operational reason.",
            created_by=self.office_admin,
        )
        self.authenticate(self.supervisor)

        response = self.client.get("/api/appointments/panel/candidates/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            self.panel.lecturer.staff_no,
            {candidate["staffId"] for candidate in response.data},
        )
        candidate = next(
            item
            for item in response.data
            if item["staffId"] == self.other_panel.lecturer.staff_no
        )
        self.assertEqual(candidate["semesterId"], self.academic_semester.pk)
        self.assertIsNotNone(candidate["capacityPlanId"])
        self.assertEqual(candidate["capacityPlanVersion"], 1)
        self.assertEqual(candidate["capacityState"], "AVAILABLE")
        self.assertEqual(candidate["workloadCount"], 0)
        self.assertEqual(candidate["workloadLimit"], 5)
        self.assertEqual(candidate["availableSlots"], 5)
        self.assertTrue(candidate["selectable"])
        self.assertIsNone(candidate["unavailableUntil"])

    def test_crafted_unavailable_panel_submission_returns_conflict(self):
        today = timezone.localdate()
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.academic_semester,
            lecturer=self.panel.lecturer,
            role=LecturerAvailabilityWindow.Role.PANEL,
            starts_on=today,
            ends_on=today + timedelta(days=2),
            reason="Private operational reason must remain hidden.",
            created_by=self.office_admin,
        )
        self.authenticate(self.supervisor)

        response = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.panel.lecturer.staff_no,
                "justification": "Direct identifiers must not bypass capacity.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("temporarily unavailable", str(response.data).lower())
        self.assertNotIn("private operational", str(response.data).lower())
        self.assertFalse(PanelRecommendation.objects.exists())

    def test_full_panel_candidate_remains_visible_but_is_not_selectable(self):
        self.reserve_panel_workload(self.panel, 5)
        self.authenticate(self.supervisor)

        response = self.client.get("/api/appointments/panel/candidates/")

        candidate = next(
            item
            for item in response.data
            if item["staffId"] == self.panel.lecturer.staff_no
        )
        self.assertEqual(candidate["capacityState"], "FULL")
        self.assertEqual(candidate["workloadCount"], 5)
        self.assertEqual(candidate["availableSlots"], 0)
        self.assertFalse(candidate["selectable"])

        extra_profile = self.create_profile("MEA888999")
        PanelRecommendation.objects.create(
            profile=extra_profile,
            supervisor=extra_profile.supervisor,
            recommended_member=self.panel,
            justification="Existing over-capacity reservation.",
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
        )
        response = self.client.get("/api/appointments/panel/candidates/")
        candidate = next(
            item
            for item in response.data
            if item["staffId"] == self.panel.lecturer.staff_no
        )
        self.assertEqual(candidate["capacityState"], "OVER_CAPACITY")
        self.assertEqual(candidate["workloadCount"], 6)
        self.assertFalse(candidate["selectable"])

    def test_existing_recommendation_keeps_selected_identity_with_public_unavailable_date(
        self,
    ):
        recommendation = self.create_submitted_recommendation()
        today = timezone.localdate()
        ends_on = today + timedelta(days=2)
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.academic_semester,
            lecturer=self.panel.lecturer,
            role=LecturerAvailabilityWindow.Role.PANEL,
            starts_on=today,
            ends_on=ends_on,
            reason="Private panel availability reason.",
            created_by=self.office_admin,
        )
        self.authenticate(self.supervisor)

        response = self.client.get("/api/appointments/panel/recommendations/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        persisted = next(
            item for item in response.data if item["id"] == recommendation["id"]
        )
        self.assertEqual(persisted["recommendedMember"], self.panel.full_name)
        self.assertEqual(persisted["unavailableUntil"], ends_on.isoformat())
        self.assertNotIn("private panel", str(persisted).lower())

    def test_panel_candidates_include_pending_nomination_workload(self):
        self.reserve_panel_workload(self.panel, 4)

        self.authenticate(self.supervisor)
        response = self.client.get("/api/appointments/panel/candidates/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        candidate = next(
            item
            for item in response.data
            if item["staffId"] == self.panel.lecturer.staff_no
        )
        self.assertEqual(candidate["workloadCount"], 4)
        self.assertEqual(candidate["workloadLimit"], 5)
        self.assertTrue(candidate["canSubmit"])
        self.assertEqual(candidate["capacityState"], "AVAILABLE")
        self.assertEqual(candidate["availableSlots"], 1)
        self.assertTrue(candidate["selectable"])
        self.assertIn("accepted nominations", candidate["workloadHelpText"])

    def test_office_panel_workload_counts_confirmed_appointments_and_pending_nominations(
        self,
    ):
        approved_profile = self.create_profile("MEA999020", supervisor=self.supervisor)
        approved_recommendation = PanelRecommendation.objects.create(
            profile=approved_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Approved panel.",
            status=PanelRecommendation.Status.APPROVED,
        )
        PanelAppointment.objects.create(
            recommendation=approved_recommendation,
            profile=approved_profile,
            supervisor=self.supervisor,
            panel_member=self.panel,
            approved_by=self.coordinator,
        )
        self.reserve_panel_workload(self.panel, 4)

        self.authenticate(self.office_admin)
        response = self.client.get("/api/appointments/panel/workload/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        panel_row = next(
            row for row in response.data if row["id"] == self.panel.lecturer.staff_no
        )
        self.assertEqual(panel_row["currentStudents"], 5)
        self.assertEqual(panel_row["semesterId"], self.academic_semester.pk)
        self.assertEqual(panel_row["semesterCode"], self.academic_semester.code)
        self.assertIsNotNone(panel_row["capacityPlanId"])
        self.assertEqual(panel_row["capacityPlanVersion"], 1)
        self.assertEqual(panel_row["capacityState"], "FULL")
        self.assertEqual(panel_row["workloadCount"], 5)
        self.assertEqual(panel_row["availableSlots"], 0)
        self.assertFalse(panel_row["selectable"])
        self.assertIsNone(panel_row["unavailableUntil"])
        self.assertEqual(panel_row["confirmedAppointments"], 1)
        self.assertEqual(panel_row["pendingNominations"], 4)
        self.assertEqual(panel_row["availability"], "Full Load")
        self.assertEqual(len(panel_row["workloadItems"]), 5)

    def test_lecturer_can_view_own_panel_capacity_and_reserved_workload(self):
        recommendation = self.create_submitted_recommendation()
        self.authenticate(self.panel)
        accepted=self.client.post(f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-accept/")
        self.assertEqual(accepted.status_code,status.HTTP_200_OK,accepted.data)

        response = self.client.get("/api/appointments/panel/my-workload/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["semesterId"], self.academic_semester.pk)
        self.assertEqual(response.data["semesterCode"], self.academic_semester.code)
        self.assertEqual(response.data["capacityPlanVersion"], 1)
        self.assertEqual(response.data["capacityState"], "AVAILABLE")
        self.assertEqual(response.data["confirmedAppointments"], 0)
        self.assertEqual(response.data["pendingNominations"], 1)
        self.assertEqual(response.data["currentStudents"], 1)
        self.assertEqual(response.data["workloadCount"], 1)
        self.assertEqual(response.data["availableSlots"], 4)
        self.assertTrue(response.data["selectable"])
        self.assertIsNone(response.data["unavailableUntil"])
        self.assertEqual(recommendation["recommendedMemberId"], "L10002")

    def test_student_cannot_view_office_panel_workload(self):
        self.authenticate(self.student)

        response = self.client.get("/api/appointments/panel/workload/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_eligible_supervisees_include_supervisor_profile_staff_number(self):
        self.authenticate(self.supervisor)

        response = self.client.get("/api/appointments/panel/eligible-supervisees/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        supervisee = response.data[0]
        self.assertEqual(supervisee["studentId"], self.profile.matric_no)
        self.assertEqual(supervisee["supervisorName"], self.supervisor.full_name)
        self.assertEqual(supervisee["supervisorId"], self.supervisor.lecturer.staff_no)

    def test_selected_panel_accepts_then_coordinator_approves_final_assignment(self):
        recommendation = self.create_submitted_recommendation()
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.panel,
                event_key=f"panel:{recommendation['id']}:submit",
            ).exists()
        )

        self.authenticate(self.panel)
        accept = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-accept/",
            format="json",
        )
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        self.assertEqual(
            accept.data["status"], PanelRecommendation.Status.PENDING_COORDINATOR
        )
        self.assertIsNotNone(accept.data["panelDecisionAt"])
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.supervisor,
                event_key=f"panel:{recommendation['id']}:panel-accept",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.coordinator,
                event_key=f"panel:{recommendation['id']}:panel-accept",
            ).exists()
        )

        self.authenticate(self.coordinator)
        approve = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/coordinator-approve/",
            format="json",
        )
        self.assertEqual(approve.status_code, status.HTTP_200_OK)
        self.assertEqual(approve.data["status"], PanelRecommendation.Status.APPROVED)
        self.assertIsNotNone(approve.data["coordinatorDecisionAt"])
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.student,
                event_key=f"panel:{recommendation['id']}:coordinator-approve",
            ).exists()
        )

        self.authenticate(self.panel)
        assignments = self.client.get("/api/appointments/panel/assignments/")
        self.assertEqual(assignments.status_code, status.HTTP_200_OK)
        self.assertEqual(assignments.data[0]["studentId"], self.profile.matric_no)
        self.assertEqual(assignments.data[0]["status"], "ACTIVE")
        self.assertTrue(
            PanelAppointment.objects.filter(
                recommendation_id=recommendation["id"]
            ).exists()
        )

    def test_final_approval_rechecks_restrictions_after_panel_acceptance(self):
        recommendation = self.create_submitted_recommendation()
        self.authenticate(self.panel)
        accepted = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-accept/"
        )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        today = timezone.localdate()
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.academic_semester,
            lecturer=self.panel.lecturer,
            role=LecturerAvailabilityWindow.Role.PANEL,
            starts_on=today,
            ends_on=today + timedelta(days=1),
            reason="Private approval-time restriction.",
            created_by=self.office_admin,
        )

        self.authenticate(self.coordinator)
        url = (
            f"/api/appointments/panel/recommendations/{recommendation['id']}/"
            "coordinator-approve/"
        )
        blocked = self.client.post(url)

        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        persisted = PanelRecommendation.objects.get(pk=recommendation["id"])
        self.assertEqual(
            persisted.status,
            PanelRecommendation.Status.PENDING_COORDINATOR,
        )
        self.assertFalse(PanelAppointment.objects.exists())
        with patch(
            "academics.capacity.timezone.localdate",
            return_value=today + timedelta(days=2),
        ):
            approved = self.client.post(url)
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        self.assertEqual(PanelAppointment.objects.count(), 1)

    def test_final_panel_approval_converts_its_own_last_reserved_slot(self):
        self.reserve_panel_workload(self.panel, 4)
        recommendation = self.create_submitted_recommendation()
        self.authenticate(self.panel)
        accepted = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-accept/"
        )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.authenticate(self.coordinator)

        approved = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/coordinator-approve/"
        )

        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        self.assertTrue(
            PanelAppointment.objects.filter(
                recommendation_id=recommendation["id"],
                status=PanelAppointment.Status.ACTIVE,
            ).exists()
        )

    def test_student_without_confirmed_panel_appointment_receives_pending_state(self):
        self.authenticate(self.student)

        response = self.client.get("/api/appointments/panel/student/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(
            response.data["readinessState"],
            "READY_FOR_PANEL_RECOMMENDATION",
        )
        self.assertEqual(response.data["studentId"], self.profile.matric_no)
        self.assertEqual(response.data["supervisorName"], self.supervisor.full_name)
        self.assertIsNone(response.data["panelMemberName"])

    def test_student_without_research_profile_receives_pending_state(self):
        unprofiled_student = User.objects.create_user(
            email="unprofiled-student@example.com",
            password="password123",
            full_name="Profile Pending Student",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=unprofiled_student,
            matric_no="MEA777001",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )

        self.authenticate(unprofiled_student)
        response = self.client.get("/api/appointments/panel/student/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(response.data["readinessState"], "SUPERVISOR_REQUIRED")
        self.assertEqual(response.data["studentName"], unprofiled_student.full_name)
        self.assertEqual(
            response.data["studentId"], unprofiled_student.student.matric_no
        )
        self.assertEqual(
            response.data["programme"], unprofiled_student.student.programme
        )
        self.assertEqual(response.data["supervisorName"], "Not assigned yet")
        self.assertIsNone(response.data["panelMemberName"])

    def test_student_with_confirmed_panel_appointment_receives_panel_details(self):
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Confirmed panel.",
            status=PanelRecommendation.Status.APPROVED,
        )
        PanelAppointment.objects.create(
            recommendation=recommendation,
            profile=self.profile,
            supervisor=self.supervisor,
            panel_member=self.panel,
            approved_by=self.coordinator,
        )

        self.authenticate(self.student)
        response = self.client.get("/api/appointments/panel/student/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "CONFIRMED")
        self.assertEqual(response.data["readinessState"], "CONFIRMED")
        self.assertEqual(response.data["panelMemberName"], self.panel.full_name)
        self.assertIsNone(response.data["panelMemberId"])
        self.assertNotIn(self.panel.lecturer.staff_no, str(response.data))
        self.assertEqual(response.data["panelMemberEmail"], self.panel.email)
        self.assertEqual(response.data["researchTitle"], self.profile.proposed_topic)
        self.assertTrue(response.data["appointmentDate"])
        self.assertEqual(response.data["approvedRequest"]["id"], recommendation.pk)
        self.assertEqual(response.data["approvedRequest"]["nominatedBy"], self.supervisor.full_name)
        self.assertNotIn("justification", response.data["approvedRequest"])
        self.assertNotIn("workflow", response.data["approvedRequest"])

    def test_student_panel_endpoint_denies_non_student_roles(self):
        for user in [self.supervisor, self.panel, self.coordinator]:
            self.authenticate(user)
            response = self.client.get("/api/appointments/panel/student/")
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_panel_endpoint_only_returns_logged_in_students_record(self):
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            justification="Confirmed panel.",
            status=PanelRecommendation.Status.APPROVED,
        )
        PanelAppointment.objects.create(
            recommendation=recommendation,
            profile=self.profile,
            supervisor=self.supervisor,
            panel_member=self.panel,
            approved_by=self.coordinator,
        )
        other_student = User.objects.create_user(
            email="other-student@example.com",
            password="password123",
            full_name="Other Student",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=other_student,
            matric_no="MEA999002",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        other_profile = StudentResearchProfile.objects.create(
            student=other_student,
            matric_no="MEA999002",
            student_name="Other Student",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            semester="Sem 1 2025/2026",
            proposed_topic="Separate Research Topic",
            research_area="Software Engineering",
            abstract="Research abstract",
            supervisor=self.supervisor,
        )

        self.authenticate(other_student)
        response = self.client.get("/api/appointments/panel/student/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(response.data["studentId"], other_profile.matric_no)
        self.assertIsNone(response.data["panelMemberName"])

    def test_wrong_users_cannot_make_panel_or_coordinator_decisions(self):
        recommendation = self.create_submitted_recommendation()

        self.authenticate(self.supervisor)
        supervisor_accept = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-accept/",
            format="json",
        )
        self.assertEqual(supervisor_accept.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.other_panel)
        wrong_panel_accept = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-accept/",
            format="json",
        )
        self.assertEqual(wrong_panel_accept.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.panel)
        self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-accept/",
            format="json",
        )

        self.authenticate(self.panel)
        panel_coordinator_approve = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/coordinator-approve/",
            format="json",
        )
        self.assertEqual(
            panel_coordinator_approve.status_code, status.HTTP_403_FORBIDDEN
        )

    def test_panel_recommendation_detail_protects_internal_history_from_student(self):
        recommendation = self.create_submitted_recommendation()
        detail_url = f"/api/appointments/panel/recommendations/{recommendation['id']}/"

        for user in [self.supervisor, self.panel, self.coordinator, self.office_admin]:
            self.authenticate(user)
            response = self.client.get(detail_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["id"], recommendation["id"])
            self.assertEqual(response.data["workflow"][0]["action"], "SUBMIT")

        self.authenticate(self.student)
        denied = self.client.get(detail_url)
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_panel_reject_requires_reason_and_allows_new_recommendation(self):
        recommendation = self.create_submitted_recommendation()

        self.authenticate(self.panel)
        missing_reason = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-reject/",
            {"reason": ""},
            format="json",
        )
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)

        rejected = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-reject/",
            {"reason": "Workload conflict."},
            format="json",
        )
        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.assertEqual(
            rejected.data["status"], PanelRecommendation.Status.REJECTED_BY_PANEL
        )
        self.assertEqual(rejected.data["rejectionReason"], "Workload conflict.")

        self.authenticate(self.supervisor)
        replacement = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.other_panel.lecturer.staff_no,
                "justification": "Replacement recommendation.",
                "status": PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            },
            format="json",
        )
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED)

    def test_submitting_supervisor_can_cancel_pending_panel_recommendation(self):
        recommendation = self.create_submitted_recommendation()
        self.assertEqual(count_panel_workload(self.panel), 0)

        self.authenticate(self.supervisor)
        response = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/cancel/",
            {"reason": "The proposed research scope has changed."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["status"],
            PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR,
        )
        self.assertEqual(
            response.data["cancellationReason"],
            "The proposed research scope has changed.",
        )
        self.assertIsNotNone(response.data["cancelledAt"])
        self.assertEqual(count_panel_workload(self.panel), 0)
        event = AppointmentWorkflowEvent.objects.get(
            panel_recommendation_id=recommendation["id"],
            action="SUPERVISOR_CANCEL",
        )
        self.assertEqual(event.actor, self.supervisor)
        self.assertEqual(event.reason, "The proposed research scope has changed.")

    def test_panel_cancellation_requires_owner_reason_and_submitted_status(self):
        recommendation = self.create_submitted_recommendation()
        cancel_url = (
            f"/api/appointments/panel/recommendations/{recommendation['id']}/cancel/"
        )

        self.authenticate(self.other_panel)
        wrong_supervisor = self.client.post(
            cancel_url,
            {"reason": "Not my recommendation."},
            format="json",
        )
        self.assertEqual(wrong_supervisor.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.supervisor)
        missing_reason = self.client.post(
            cancel_url,
            {"reason": ""},
            format="json",
        )
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)

        self.authenticate(self.panel)
        accepted = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/panel-accept/"
        )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)

        self.authenticate(self.supervisor)
        too_late = self.client.post(
            cancel_url,
            {"reason": "Attempted after panel acceptance."},
            format="json",
        )
        self.assertEqual(too_late.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancelled_recommendation_leaves_queue_and_allows_replacement(self):
        recommendation = self.create_submitted_recommendation()
        self.authenticate(self.supervisor)
        cancelled = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation['id']}/cancel/",
            {"reason": "Recommend a different specialist."},
            format="json",
        )
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)

        self.authenticate(self.panel)
        queue = self.client.get("/api/appointments/panel/review-queue/")
        history = self.client.get("/api/appointments/panel/review-history/")
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        self.assertNotIn(recommendation["id"], [item["id"] for item in queue.data])
        self.assertIn(recommendation["id"], [item["id"] for item in history.data])

        self.authenticate(self.supervisor)
        replacement = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.profile.matric_no,
                "recommendedMemberId": self.other_panel.lecturer.staff_no,
                "justification": "Replacement recommendation.",
                "status": PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            },
            format="json",
        )
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED)
