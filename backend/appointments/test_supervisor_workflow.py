from datetime import timedelta
from decimal import Decimal
from importlib import import_module
from unittest.mock import patch

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    Coordinator,
    Lecturer,
    OfficeStaff,
    Panel,
    Student,
    Supervisor,
)
from announcements.models import Notification
from academics.models import AcademicSemester, LecturerAvailabilityWindow
from academics.test_capacity_helpers import publish_test_capacity_plan

from .research_intent_test_helpers import valid_research_intent_json
from .models import (
    AppointmentWorkflowEvent,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
    SupervisorDocumentRequirement,
)
from marks.models import EvaluationPeriod, EvaluationTask, Rubric, RubricComponent

User = get_user_model()


class SupervisorAppointmentWorkflowTests(APITestCase):
    def setUp(self):
        self.student_user = User.objects.create_user(
            email="student-supervisor@example.com",
            password="password123",
            full_name="Student Applicant",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=self.student_user,
            matric_no="MEA-SUP-001",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            intake_semester="Sem 1 2025/2026",
        )
        self.supervisor_user = User.objects.create_user(
            email="requested-supervisor@example.com",
            password="password123",
            full_name="Dr. Requested Supervisor",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.supervisor_user,
            staff_no="SV1001",
            department="Artificial Intelligence",
            specialization="Machine Learning",
        )
        Supervisor.objects.create(
            lecturer=self.supervisor_user.lecturer,
            max_supervisees=2,
        )
        self.other_supervisor = User.objects.create_user(
            email="other-supervisor@example.com",
            password="password123",
            full_name="Dr. Other Supervisor",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.other_supervisor,
            staff_no="SV1002",
            department="Software Engineering",
        )
        Supervisor.objects.create(
            lecturer=self.other_supervisor.lecturer,
            max_supervisees=2,
        )
        Panel.objects.create(
            lecturer=self.other_supervisor.lecturer,
            max_appointments=5,
        )
        self.coordinator = User.objects.create_user(
            email="supervisor-coordinator@example.com",
            password="password123",
            full_name="Programme Coordinator",
            role=User.Role.COORDINATOR,
        )
        Lecturer.objects.create(
            user=self.coordinator,
            staff_no="CO1001",
            department="Artificial Intelligence",
        )
        Coordinator.objects.create(
            lecturer=self.coordinator.lecturer,
            programme_managed="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.office_admin = User.objects.create_user(
            email="supervisor-office@example.com",
            password="password123",
            full_name="Office Administrator",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(
            user=self.office_admin,
            staff_no="OA1001",
            department="Postgraduate Office",
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
        SupervisorDocumentRequirement.objects.create(
            code="research-proposal",
            label="Research Proposal",
            description="Upload the current research proposal.",
            is_required=True,
            is_active=True,
            display_order=1,
        )
        publish_test_capacity_plan(self.academic_semester, self.office_admin)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def submit_application(self, supervisor=None):
        self.authenticate(self.student_user)
        response = self.client.post(
            "/api/appointments/supervisor/applications/",
            {
                "proposedSupervisorId": (
                    supervisor or self.supervisor_user
                ).lecturer.staff_no,
                "projectCourseCodes": "WQD7002",
                "researchTitle": "Configurable postgraduate workflow",
                "researchArea": "Human-Centred Artificial Intelligence",
                "researchAbstract": "A sufficiently detailed research abstract.",
                "researchIntent": valid_research_intent_json(),
                "documents": [
                    SimpleUploadedFile(
                        "proposal.pdf",
                        b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF",
                        content_type="application/pdf",
                    )
                ],
                "requirementCodes": ["research-proposal"],
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response

    def accept_by_supervisor(self, application_id):
        self.authenticate(self.supervisor_user)
        return self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/supervisor-accept/"
        )

    def test_lecturer_tracking_distinguishes_acceptance_from_final_approval(self):
        application_id = self.submit_application().data["id"]
        self.authenticate(self.supervisor_user)
        pending = self.client.get("/api/appointments/supervisor/requests/").data[0]
        self.assertEqual(pending["semester"], self.academic_semester.label)
        self.assertEqual(pending["semesterId"], self.academic_semester.pk)
        self.assertEqual(self.accept_by_supervisor(application_id).status_code, 200)
        response = self.client.get("/api/appointments/supervisor/request-history/")
        self.assertEqual(response.status_code, 200)
        row = response.data[0]
        self.assertEqual(row["decision"], "Pending Approval")
        self.assertEqual(row["status"], "PENDING_COORDINATOR")
        self.assertEqual(row["applicationId"], application_id)
        self.assertIsNotNone(row["supervisorDecisionAt"])
        self.assertIsNone(row["coordinatorDecisionAt"])
        self.assertEqual(row["waitingOn"], "PROGRAMME_COORDINATOR")
        self.assertEqual(row["waitingDays"], 0)
        self.assertEqual(row["semester"], pending["semester"])
        self.authenticate(self.other_supervisor)
        self.assertEqual(self.client.get("/api/appointments/supervisor/request-history/").data, [])
        self.authenticate(self.student_user)
        self.assertEqual(self.client.get("/api/appointments/supervisor/request-history/").status_code, 403)

    def test_lecturer_tracking_reports_coordinator_rejection_and_recorded_reason(self):
        application_id = self.submit_application().data["id"]
        self.accept_by_supervisor(application_id)
        self.authenticate(self.coordinator)
        rejected = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-reject/",
            {"reason": "Recorded coordinator decision"}, format="json",
        )
        self.assertEqual(rejected.status_code, 200)
        self.authenticate(self.supervisor_user)
        row = self.client.get("/api/appointments/supervisor/request-history/").data[0]
        self.assertEqual(row["decision"], "Rejected")
        self.assertEqual(row["status"], "REJECTED_BY_COORDINATOR")
        self.assertEqual(row["decisionReason"], "Recorded coordinator decision")
        self.assertIsNotNone(row["coordinatorDecisionAt"])
        self.assertIsNone(row["waitingDays"])

    def test_student_submission_creates_pending_request_documents_and_audit_event(self):
        response = self.submit_application()

        application = SupervisorApplication.objects.get()
        self.assertEqual(application.academic_semester, self.academic_semester)
        self.assertEqual(response.data["semesterId"], self.academic_semester.pk)
        self.assertEqual(response.data["semester"], self.academic_semester.label)
        self.assertEqual(
            application.status,
            SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
        )
        self.assertEqual(application.documents.count(), 1)
        self.assertEqual(response.data["status"], "SUBMITTED_TO_SUPERVISOR")
        self.assertEqual(
            response.data["researchArea"],
            "Human-Centred Artificial Intelligence",
        )
        self.assertFalse(response.data["researchProfileReady"])
        event = AppointmentWorkflowEvent.objects.get(supervisor_application=application)
        self.assertEqual(event.action, "SUBMIT")
        self.assertEqual(event.new_status, "SUBMITTED_TO_SUPERVISOR")
        self.assertEqual(event.actor, self.student_user)
        notification = Notification.objects.get(recipient=self.supervisor_user)
        self.assertFalse(notification.is_announcement)
        self.assertEqual(notification.record_type, "SUPERVISOR_APPLICATION")
        self.assertEqual(notification.record_id, str(application.pk))

    def test_student_submission_requires_research_area(self):
        self.authenticate(self.student_user)
        response = self.client.post(
            "/api/appointments/supervisor/applications/",
            {
                "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
                "projectCourseCodes": "WQD7002",
                "researchTitle": "Missing research area",
                "researchAbstract": "The application should fail before persistence.",
                "researchIntent": valid_research_intent_json(),
                "documents": [
                    SimpleUploadedFile(
                        "proposal.pdf",
                        b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF",
                        content_type="application/pdf",
                    )
                ],
                "requirementCodes": ["research-proposal"],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("researchArea", response.data)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_candidates_expose_semester_capacity_and_hide_unavailable_lecturers(self):
        today = timezone.localdate()
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.academic_semester,
            lecturer=self.supervisor_user.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=today,
            ends_on=today + timedelta(days=2),
            reason="Unavailable for a private operational reason.",
            created_by=self.office_admin,
        )
        self.authenticate(self.student_user)

        response = self.client.get("/api/appointments/supervisor/candidates/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            self.supervisor_user.lecturer.staff_no,
            {candidate["id"] for candidate in response.data},
        )
        candidate = next(
            item
            for item in response.data
            if item["id"] == self.other_supervisor.lecturer.staff_no
        )
        self.assertEqual(candidate["semesterId"], self.academic_semester.pk)
        self.assertIsNotNone(candidate["capacityPlanId"])
        self.assertEqual(candidate["capacityPlanVersion"], 1)
        self.assertEqual(candidate["capacityState"], "AVAILABLE")
        self.assertEqual(candidate["workloadCount"], 0)
        self.assertEqual(candidate["workloadLimit"], 2)
        self.assertEqual(candidate["availableSlots"], 2)
        self.assertTrue(candidate["selectable"])
        self.assertIsNone(candidate["unavailableUntil"])

    def test_crafted_unavailable_supervisor_submission_returns_conflict(self):
        today = timezone.localdate()
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.academic_semester,
            lecturer=self.supervisor_user.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=today,
            ends_on=today + timedelta(days=2),
            reason="Private operational reason must not be disclosed.",
            created_by=self.office_admin,
        )
        self.authenticate(self.student_user)

        response = self.client.post(
            "/api/appointments/supervisor/applications/",
            {
                "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
                "projectCourseCodes": "WQD7002",
                "researchTitle": "Capacity guarded workflow",
                "researchArea": "Software Engineering",
                "researchAbstract": "A direct identifier must not bypass capacity.",
                "researchIntent": valid_research_intent_json(),
                "documents": [
                    SimpleUploadedFile(
                        "proposal.pdf",
                        b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF",
                        content_type="application/pdf",
                    )
                ],
                "requirementCodes": ["research-proposal"],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("temporarily unavailable", str(response.data).lower())
        self.assertNotIn("private operational", str(response.data).lower())
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_full_supervisor_remains_visible_but_is_not_selectable(self):
        for index in range(2):
            user = User.objects.create_user(
                email=f"capacity-supervisee-{index}@example.test",
                password="password123",
                full_name=f"Capacity Supervisee {index}",
                role=User.Role.STUDENT,
            )
            student = Student.objects.create(
                user=user,
                matric_no=f"CAP-SUP-{index}",
                programme=self.student_user.student.programme,
            )
            application = SupervisorApplication.objects.create(
                student=student,
                academic_semester=self.academic_semester,
                proposed_supervisor=self.supervisor_user,
                research_title=f"Capacity research {index}",
                research_area="Software Engineering",
                research_abstract="Existing active supervision.",
                status=SupervisorApplication.Status.APPROVED,
            )
            SupervisorAppointment.objects.create(
                application=application,
                student=student,
                supervisor=self.supervisor_user,
                approved_by=self.coordinator,
            )
        self.authenticate(self.student_user)

        response = self.client.get("/api/appointments/supervisor/candidates/")

        candidate = next(
            item
            for item in response.data
            if item["id"] == self.supervisor_user.lecturer.staff_no
        )
        self.assertEqual(candidate["capacityState"], "FULL")
        self.assertEqual(candidate["workloadCount"], 2)
        self.assertEqual(candidate["availableSlots"], 0)
        self.assertFalse(candidate["selectable"])

    def test_existing_application_keeps_selected_identity_with_public_unavailable_date(
        self,
    ):
        application_id = self.submit_application().data["id"]
        today = timezone.localdate()
        ends_on = today + timedelta(days=2)
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.academic_semester,
            lecturer=self.supervisor_user.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=today,
            ends_on=ends_on,
            reason="Private reason must not leave the Office boundary.",
            created_by=self.office_admin,
        )
        self.authenticate(self.student_user)

        response = self.client.get("/api/appointments/supervisor/applications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        application = next(
            item for item in response.data if item["id"] == application_id
        )
        self.assertEqual(
            application["proposedSupervisor"],
            self.supervisor_user.full_name,
        )
        self.assertEqual(application["unavailableUntil"], ends_on.isoformat())
        self.assertNotIn("private reason", str(application).lower())

    def test_final_approval_rechecks_capacity_and_preserves_pending_application(self):
        application_id = self.submit_application().data["id"]
        self.assertEqual(
            self.accept_by_supervisor(application_id).status_code,
            status.HTTP_200_OK,
        )
        today = timezone.localdate()
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.academic_semester,
            lecturer=self.supervisor_user.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=today,
            ends_on=today + timedelta(days=1),
            reason="Private final-approval restriction.",
            created_by=self.office_admin,
        )
        self.authenticate(self.coordinator)
        url = (
            f"/api/appointments/supervisor/applications/{application_id}/"
            "coordinator-approve/"
        )

        blocked = self.client.post(url)

        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        application = SupervisorApplication.objects.get(pk=application_id)
        self.assertEqual(
            application.status,
            SupervisorApplication.Status.PENDING_COORDINATOR,
        )
        self.assertFalse(SupervisorAppointment.objects.exists())
        self.assertFalse(StudentResearchProfile.objects.exists())
        with patch(
            "academics.capacity.timezone.localdate",
            return_value=today + timedelta(days=2),
        ):
            approved = self.client.post(url)
        self.assertEqual(approved.status_code, status.HTTP_200_OK)

    def test_student_submission_is_blocked_without_effective_semester(self):
        AcademicSemester.objects.filter(pk=self.academic_semester.pk).update(
            lifecycle_status=AcademicSemester.Lifecycle.CLOSED
        )
        self.authenticate(self.student_user)

        response = self.client.post(
            "/api/appointments/supervisor/applications/",
            {
                "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
                "projectCourseCodes": "WQD7002",
                "researchTitle": "No active semester",
                "researchArea": "Artificial Intelligence",
                "researchAbstract": "This request must not be accepted.",
                "researchIntent": valid_research_intent_json(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_office_staff_can_view_persisted_supervisor_workload(self):
        application_id = self.submit_application().data["id"]
        application = SupervisorApplication.objects.get(pk=application_id)
        application.status = SupervisorApplication.Status.APPROVED
        application.save(update_fields=["status"])
        SupervisorAppointment.objects.create(
            application=application,
            student=self.student_user.student,
            supervisor=self.supervisor_user,
            approved_by=self.coordinator,
        )
        self.authenticate(self.office_admin)

        response = self.client.get("/api/appointments/supervisor/workload/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        supervisor_row = next(
            row for row in response.data if row["lecturerId"] == "SV1001"
        )
        self.assertEqual(supervisor_row["lecturerName"], "Dr. Requested Supervisor")
        self.assertEqual(supervisor_row["currentStudents"], 1)
        self.assertEqual(supervisor_row["workloadLimit"], 2)
        self.assertEqual(supervisor_row["semesterId"], self.academic_semester.pk)
        self.assertIsNotNone(supervisor_row["capacityPlanId"])
        self.assertEqual(supervisor_row["capacityPlanVersion"], 1)
        self.assertEqual(supervisor_row["capacityState"], "AVAILABLE")
        self.assertEqual(supervisor_row["workloadCount"], 1)
        self.assertEqual(supervisor_row["availableSlots"], 1)
        self.assertTrue(supervisor_row["selectable"])
        self.assertIsNone(supervisor_row["unavailableUntil"])
        self.assertEqual(supervisor_row["availability"], "Near Limit")
        self.assertEqual(len(supervisor_row["supervisees"]), 1)
        self.assertEqual(
            supervisor_row["supervisees"][0]["id"],
            "MEA-SUP-001",
        )

    def test_supervisor_workload_is_office_only(self):
        for user in [
            self.student_user,
            self.supervisor_user,
            self.coordinator,
        ]:
            self.authenticate(user)
            response = self.client.get("/api/appointments/supervisor/workload/")
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN,
            )

    def test_lecturer_can_view_own_persisted_workload_and_supervisee_details(self):
        application_id = self.submit_application().data["id"]
        application = SupervisorApplication.objects.get(pk=application_id)
        application.status = SupervisorApplication.Status.APPROVED
        application.save(update_fields=["status"])
        appointment = SupervisorAppointment.objects.create(
            application=application,
            student=self.student_user.student,
            supervisor=self.supervisor_user,
            approved_by=self.coordinator,
        )
        self.authenticate(self.supervisor_user)

        workload = self.client.get("/api/appointments/supervisor/my-workload/")
        supervisees = self.client.get("/api/appointments/supervisor/supervisees/")

        self.assertEqual(workload.status_code, status.HTTP_200_OK)
        self.assertEqual(
            workload.data,
            {
                "currentStudents": 1,
                "workloadLimit": 2,
                "availableSlots": 1,
                "semesterId": self.academic_semester.pk,
                "semesterCode": self.academic_semester.code,
                "capacityPlanId": self.academic_semester.capacity_plans.get().pk,
                "capacityPlanVersion": 1,
                "capacityState": "AVAILABLE",
                "workloadCount": 1,
                "activeLoad": 1,
                "reservedLoad": 0,
                "pendingRequests": 0,
                "selectable": True,
                "unavailableUntil": None,
            },
        )
        self.assertEqual(supervisees.status_code, status.HTTP_200_OK)
        self.assertEqual(supervisees.data[0]["appointmentId"], appointment.pk)
        self.assertEqual(
            supervisees.data[0]["programme"],
            "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.assertEqual(
            supervisees.data[0]["semester"],
            self.academic_semester.label,
        )
        self.assertEqual(
            supervisees.data[0]["email"],
            "student-supervisor@example.com",
        )
        self.assertEqual(
            supervisees.data[0]["researchAbstract"],
            "A sufficiently detailed research abstract.",
        )
        self.assertEqual(
            supervisees.data[0]["supervisorName"],
            "Dr. Requested Supervisor",
        )

    def test_own_supervisor_workload_is_lecturer_only(self):
        for user in [
            self.student_user,
            self.coordinator,
            self.office_admin,
        ]:
            self.authenticate(user)
            response = self.client.get("/api/appointments/supervisor/my-workload/")
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN,
            )

    def test_student_can_cancel_pending_request_with_reason_and_resubmit(self):
        application_id = self.submit_application().data["id"]

        self.authenticate(self.student_user)
        cancelled = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/cancel/",
            {"reason": "I selected the wrong supervisor."},
            format="json",
        )

        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertEqual(cancelled.data["status"], "CANCELLED_BY_STUDENT")
        self.assertEqual(
            cancelled.data["cancellationReason"],
            "I selected the wrong supervisor.",
        )
        self.assertIsNotNone(cancelled.data["cancelledAt"])
        self.assertEqual(
            [event["action"] for event in cancelled.data["workflow"]],
            ["SUBMIT", "STUDENT_CANCEL"],
        )
        cancellation_audit = cancelled.data["workflow"][-1]
        self.assertEqual(cancellation_audit["newStatus"], "CANCELLED_BY_STUDENT")
        self.assertEqual(cancellation_audit["reason"], "I selected the wrong supervisor.")
        event = AppointmentWorkflowEvent.objects.get(
            supervisor_application_id=application_id,
            action="STUDENT_CANCEL",
        )
        self.assertEqual(event.actor, self.student_user)
        self.assertEqual(event.reason, "I selected the wrong supervisor.")
        self.assertEqual(cancellation_audit["id"], event.pk)
        self.assertEqual(cancellation_audit["actorName"], self.student_user.full_name)
        self.assertEqual(cancellation_audit["actorRole"], User.Role.STUDENT)
        self.assertEqual(cancellation_audit["previousStatus"], "SUBMITTED_TO_SUPERVISOR")
        self.assertIsNotNone(cancellation_audit["createdAt"])
        detail = self.client.get(
            f"/api/appointments/supervisor/applications/{application_id}/"
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(cancelled.data["workflow"], detail.data["workflow"])
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.supervisor_user,
                event_key=f"supervisor:{application_id}:student-cancel",
            ).exists()
        )

        self.authenticate(self.supervisor_user)
        queue = self.client.get("/api/appointments/supervisor/requests/")
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        self.assertEqual(queue.data, [])

        replacement = self.submit_application(supervisor=self.other_supervisor)
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED)

    def test_supervisor_cancellation_requires_owner_reason_and_pending_status(self):
        application_id = self.submit_application().data["id"]
        cancel_url = (
            f"/api/appointments/supervisor/applications/{application_id}/cancel/"
        )

        self.authenticate(self.supervisor_user)
        wrong_user = self.client.post(
            cancel_url,
            {"reason": "Not my request."},
            format="json",
        )
        self.assertEqual(wrong_user.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.student_user)
        missing_reason = self.client.post(
            cancel_url,
            {"reason": ""},
            format="json",
        )
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)

        accepted = self.accept_by_supervisor(application_id)
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)

        self.authenticate(self.student_user)
        too_late = self.client.post(
            cancel_url,
            {"reason": "Attempted after supervisor acceptance."},
            format="json",
        )
        self.assertEqual(too_late.status_code, status.HTTP_400_BAD_REQUEST)

    def test_supervisor_application_detail_is_role_scoped_and_returns_audit(self):
        application_id = self.submit_application().data["id"]
        detail_url = f"/api/appointments/supervisor/applications/{application_id}/"

        for user in [
            self.student_user,
            self.supervisor_user,
            self.coordinator,
            self.office_admin,
        ]:
            self.authenticate(user)
            response = self.client.get(detail_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["id"], application_id)
            self.assertEqual(response.data["workflow"][0]["action"], "SUBMIT")

        self.authenticate(self.other_supervisor)
        denied = self.client.get(detail_url)
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_create_duplicate_active_application(self):
        self.submit_application()

        response = self.client.post(
            "/api/appointments/supervisor/applications/",
            {
                "proposedSupervisorId": self.other_supervisor.lecturer.staff_no,
                "projectCourseCodes": "WQD7002",
                "researchTitle": "Second active request",
                "researchArea": "Artificial Intelligence",
                "researchAbstract": "This must be rejected while another request is active.",
                "researchIntent": valid_research_intent_json(),
                "documents": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SupervisorApplication.objects.count(), 1)

    def test_selected_supervisor_accepts_then_coordinator_approves_appointment(self):
        application_id = self.submit_application().data["id"]

        accepted = self.accept_by_supervisor(application_id)
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.assertEqual(accepted.data["status"], "PENDING_COORDINATOR")

        self.authenticate(self.coordinator)
        approved = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
        )

        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        self.assertEqual(approved.data["status"], "APPROVED")
        self.assertTrue(approved.data["researchProfileReady"])
        appointment = SupervisorAppointment.objects.get()
        self.assertEqual(appointment.student, self.student_user.student)
        self.assertEqual(appointment.supervisor, self.supervisor_user)
        profile = StudentResearchProfile.objects.get(student=self.student_user)
        self.assertEqual(profile.matric_no, "MEA-SUP-001")
        self.assertEqual(profile.student_name, "Student Applicant")
        self.assertEqual(
            profile.programme,
            "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.assertEqual(profile.semester, self.academic_semester.label)
        self.assertEqual(
            profile.proposed_topic,
            "Configurable postgraduate workflow",
        )
        self.assertEqual(
            profile.research_area,
            "Human-Centred Artificial Intelligence",
        )
        self.assertEqual(
            profile.abstract,
            "A sufficiently detailed research abstract.",
        )
        self.assertEqual(profile.supervisor, self.supervisor_user)

    def test_complete_supervisor_panel_marks_handoff(self):
        application_id = self.submit_application().data["id"]
        self.assertEqual(
            self.accept_by_supervisor(application_id).status_code,
            status.HTTP_200_OK,
        )
        self.authenticate(self.coordinator)
        supervisor_approval = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
        )
        self.assertEqual(supervisor_approval.status_code, status.HTTP_200_OK)

        self.authenticate(self.supervisor_user)
        eligible = self.client.get("/api/appointments/panel/eligible-supervisees/")
        self.assertEqual(eligible.status_code, status.HTTP_200_OK)
        self.assertEqual(eligible.data[0]["studentId"], "MEA-SUP-001")
        self.assertEqual(
            eligible.data[0]["supervisorAppointmentId"],
            SupervisorAppointment.objects.get().pk,
        )
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
        panel_acceptance = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.data['id']}/panel-accept/"
        )
        self.assertEqual(panel_acceptance.status_code, status.HTTP_200_OK)
        self.authenticate(self.coordinator)
        panel_approval = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.data['id']}/coordinator-approve/"
        )
        self.assertEqual(panel_approval.status_code, status.HTTP_200_OK)
        self.assertTrue(
            PanelAppointment.objects.filter(
                recommendation_id=recommendation.data["id"],
                status=PanelAppointment.Status.ACTIVE,
            ).exists()
        )

        rubric = Rubric.objects.create(
            name="Handoff Evaluation",
            code="handoff-evaluation",
            target_mark=Decimal("100.00"),
        )
        RubricComponent.objects.create(
            rubric=rubric,
            code="overall",
            name="Overall Evaluation",
            max_marks=Decimal("100.00"),
        )
        period = EvaluationPeriod.objects.create(
            name="Handoff Evaluation Period",
            semester=self.academic_semester.label,
            academic_semester=self.academic_semester,
            rubric=rubric,
            is_open=True,
            opens_at=timezone.now() - timedelta(days=1),
            closes_at=timezone.now() + timedelta(days=7),
        )
        self.authenticate(self.office_admin)
        generated = self.client.post(f"/api/marks/periods/{period.pk}/generate-tasks/")
        self.assertEqual(generated.status_code, status.HTTP_201_CREATED)
        self.assertEqual(generated.data["supervisorCreatedCount"], 1)
        self.assertEqual(generated.data["panelCreatedCount"], 1)
        profile = StudentResearchProfile.objects.get(student=self.student_user)
        self.assertTrue(
            EvaluationTask.objects.filter(
                profile=profile,
                evaluator=self.supervisor_user,
                evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
            ).exists()
        )
        self.assertTrue(
            EvaluationTask.objects.filter(
                profile=profile,
                evaluator=self.other_supervisor,
                evaluator_role=EvaluationTask.EvaluatorRole.PANEL,
            ).exists()
        )
        self.assertEqual(
            AppointmentWorkflowEvent.objects.filter(
                supervisor_application_id=application_id
            ).count(),
            3,
        )

    def test_final_approval_reuses_and_refreshes_unused_legacy_profile(self):
        legacy = StudentResearchProfile.objects.create(
            matric_no=self.student_user.student.matric_no,
            student_name="Legacy Student Name",
            programme="Legacy Programme",
            semester="Legacy Semester",
            proposed_topic="Legacy Topic",
            research_area="Legacy Area",
            abstract="Legacy abstract.",
            supervisor=self.other_supervisor,
        )
        legacy_id = legacy.pk
        application_id = self.submit_application().data["id"]
        self.assertEqual(
            self.accept_by_supervisor(application_id).status_code,
            status.HTTP_200_OK,
        )

        self.authenticate(self.coordinator)
        approved = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
        )

        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        legacy.refresh_from_db()
        self.assertEqual(legacy.pk, legacy_id)
        self.assertEqual(legacy.student, self.student_user)
        self.assertEqual(legacy.supervisor, self.supervisor_user)
        self.assertEqual(
            legacy.research_area,
            "Human-Centred Artificial Intelligence",
        )

    def test_final_approval_preserves_downstream_used_profile_content(self):
        profile = StudentResearchProfile.objects.create(
            student=self.student_user,
            matric_no=self.student_user.student.matric_no,
            student_name="Historical Student",
            programme="Historical Programme",
            semester="Historical Semester",
            proposed_topic="Historical downstream topic",
            research_area="Historical downstream area",
            abstract="Historical downstream abstract.",
            supervisor=self.supervisor_user,
        )
        PanelRecommendation.objects.create(
            profile=profile,
            supervisor=self.supervisor_user,
            recommended_member=self.other_supervisor,
            status=PanelRecommendation.Status.REJECTED_BY_PANEL,
        )
        application_id = self.submit_application().data["id"]
        self.assertEqual(
            self.accept_by_supervisor(application_id).status_code,
            status.HTTP_200_OK,
        )
        self.authenticate(self.coordinator)

        approved = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
        )

        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.proposed_topic, "Historical downstream topic")
        self.assertEqual(profile.research_area, "Historical downstream area")
        self.assertEqual(profile.abstract, "Historical downstream abstract.")

    def test_downstream_used_profile_for_another_supervisor_blocks_approval(self):
        profile = StudentResearchProfile.objects.create(
            matric_no=self.student_user.student.matric_no,
            student_name="Historical Student",
            programme=self.student_user.student.programme,
            semester="Historical Semester",
            proposed_topic="Historical downstream topic",
            research_area="Historical downstream area",
            supervisor=self.other_supervisor,
        )
        PanelRecommendation.objects.create(
            profile=profile,
            supervisor=self.other_supervisor,
            recommended_member=self.supervisor_user,
            status=PanelRecommendation.Status.REJECTED_BY_PANEL,
        )
        application_id = self.submit_application().data["id"]
        self.assertEqual(
            self.accept_by_supervisor(application_id).status_code,
            status.HTTP_200_OK,
        )
        self.authenticate(self.coordinator)

        response = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(SupervisorAppointment.objects.exists())
        self.assertEqual(
            SupervisorApplication.objects.get(pk=application_id).status,
            SupervisorApplication.Status.PENDING_COORDINATOR,
        )
        self.assertFalse(
            AppointmentWorkflowEvent.objects.filter(
                supervisor_application_id=application_id,
                action="COORDINATOR_APPROVE",
            ).exists()
        )

    def test_final_approval_is_idempotent_after_complete_handoff(self):
        application_id = self.submit_application().data["id"]
        self.assertEqual(
            self.accept_by_supervisor(application_id).status_code,
            status.HTTP_200_OK,
        )
        self.authenticate(self.coordinator)
        url = f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"

        first = self.client.post(url)
        second = self.client.post(url)

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(SupervisorAppointment.objects.count(), 1)
        self.assertEqual(StudentResearchProfile.objects.count(), 1)
        self.assertEqual(
            AppointmentWorkflowEvent.objects.filter(
                supervisor_application_id=application_id,
                action="COORDINATOR_APPROVE",
            ).count(),
            1,
        )

    def test_conflicting_profiles_roll_back_final_approval(self):
        StudentResearchProfile.objects.create(
            student=self.student_user,
            matric_no="LEGACY-LINKED-001",
            student_name=self.student_user.full_name,
            programme=self.student_user.student.programme,
            semester="Legacy Semester",
            proposed_topic="Linked profile",
            supervisor=self.supervisor_user,
        )
        StudentResearchProfile.objects.create(
            matric_no=self.student_user.student.matric_no,
            student_name="Unlinked duplicate",
            programme=self.student_user.student.programme,
            semester="Legacy Semester",
            proposed_topic="Matric profile",
            supervisor=self.supervisor_user,
        )
        application_id = self.submit_application().data["id"]
        self.assertEqual(
            self.accept_by_supervisor(application_id).status_code,
            status.HTTP_200_OK,
        )
        self.authenticate(self.coordinator)

        response = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        application = SupervisorApplication.objects.get(pk=application_id)
        self.assertEqual(
            application.status,
            SupervisorApplication.Status.PENDING_COORDINATOR,
        )
        self.assertFalse(SupervisorAppointment.objects.exists())
        self.assertFalse(
            AppointmentWorkflowEvent.objects.filter(
                supervisor_application_id=application_id,
                action="COORDINATOR_APPROVE",
            ).exists()
        )

    def test_matric_profile_linked_to_another_user_blocks_approval(self):
        another_student = User.objects.create_user(
            email="wrong-profile-owner@example.test",
            password="password123",
            full_name="Wrong Profile Owner",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=another_student,
            matric_no="MEA-SUP-OTHER",
            programme=self.student_user.student.programme,
        )
        StudentResearchProfile.objects.create(
            student=another_student,
            matric_no=self.student_user.student.matric_no,
            student_name=another_student.full_name,
            programme=self.student_user.student.programme,
            semester="Legacy Semester",
            proposed_topic="Incorrectly linked profile",
            supervisor=self.supervisor_user,
        )
        application_id = self.submit_application().data["id"]
        self.assertEqual(
            self.accept_by_supervisor(application_id).status_code,
            status.HTTP_200_OK,
        )
        self.authenticate(self.coordinator)

        response = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(SupervisorAppointment.objects.exists())
        self.assertEqual(
            SupervisorApplication.objects.get(pk=application_id).status,
            SupervisorApplication.Status.PENDING_COORDINATOR,
        )

    def test_research_profile_migration_backfills_confirmed_appointment(self):
        application = SupervisorApplication.objects.create(
            student=self.student_user.student,
            academic_semester=self.academic_semester,
            proposed_supervisor=self.supervisor_user,
            research_title="Historical approved topic",
            research_area="Historical research area",
            research_abstract="Historical approved abstract.",
            status=SupervisorApplication.Status.APPROVED,
            supervisor_decided_at=timezone.now(),
            coordinator_decided_at=timezone.now(),
        )
        appointment = SupervisorAppointment.objects.create(
            application=application,
            student=self.student_user.student,
            supervisor=self.supervisor_user,
            approved_by=self.coordinator,
        )
        migration = import_module(
            "appointments.migrations.0009_supervisorapplication_research_area"
        )

        migration.backfill_confirmed_research_profiles(django_apps, None)

        profile = StudentResearchProfile.objects.get(student=self.student_user)
        self.assertEqual(profile.matric_no, self.student_user.student.matric_no)
        self.assertEqual(profile.supervisor, self.supervisor_user)
        self.assertEqual(profile.proposed_topic, application.research_title)
        self.assertEqual(profile.research_area, application.research_area)
        self.assertTrue(
            SupervisorAppointment.objects.filter(pk=appointment.pk).exists()
        )

    def test_rejection_requires_reason_and_allows_student_resubmission(self):
        application_id = self.submit_application().data["id"]
        self.authenticate(self.supervisor_user)

        missing_reason = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/supervisor-reject/",
            {},
            format="json",
        )
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)

        rejected = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/supervisor-reject/",
            {"reason": "Research topic is outside my current expertise."},
            format="json",
        )
        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.assertEqual(rejected.data["status"], "REJECTED_BY_SUPERVISOR")

        resubmitted = self.submit_application(supervisor=self.other_supervisor)
        self.assertEqual(resubmitted.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SupervisorApplication.objects.count(), 2)

    def test_acceptance_and_final_approval_both_recheck_full_capacity(
        self,
    ):
        application_id = self.submit_application().data["id"]
        for index in range(2):
            user = User.objects.create_user(
                email=f"active-supervisee-{index}@example.com",
                password="password123",
                full_name=f"Active Student {index}",
                role=User.Role.STUDENT,
            )
            student = Student.objects.create(
                user=user,
                matric_no=f"MEA-ACT-{index}",
                programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            )
            previous_application = SupervisorApplication.objects.create(
                student=student,
                proposed_supervisor=self.supervisor_user,
                research_title=f"Existing research {index}",
                research_abstract="Existing appointment.",
                status=SupervisorApplication.Status.APPROVED,
            )
            SupervisorAppointment.objects.create(
                application=previous_application,
                student=student,
                supervisor=self.supervisor_user,
                approved_by=self.coordinator,
            )

        accepted = self.accept_by_supervisor(application_id)

        self.assertEqual(accepted.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(SupervisorApplication.objects.get(pk=application_id).status,
                         SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR)
        # Existing accepted promises must also recheck before final activation.
        SupervisorApplication.objects.filter(pk=application_id).update(status="PENDING_COORDINATOR")
        self.authenticate(self.coordinator)
        blocked = self.client.post(
            f"/api/appointments/supervisor/applications/{application_id}/coordinator-approve/"
        )
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            SupervisorApplication.objects.get(pk=application_id).status,
            SupervisorApplication.Status.PENDING_COORDINATOR,
        )

    def test_role_scoped_queues_records_and_history(self):
        application_id = self.submit_application().data["id"]

        self.authenticate(self.supervisor_user)
        queue = self.client.get("/api/appointments/supervisor/requests/")
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        self.assertEqual(queue.data[0]["applicationId"], application_id)

        self.accept_by_supervisor(application_id)
        history = self.client.get("/api/appointments/supervisor/request-history/")
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(history.data[0]["decision"], "Pending Approval")

        self.authenticate(self.coordinator)
        coordinator_queue = self.client.get(
            "/api/appointments/supervisor/coordinator-queue/"
        )
        self.assertEqual(coordinator_queue.status_code, status.HTTP_200_OK)
        self.assertEqual(coordinator_queue.data[0]["id"], application_id)

        self.authenticate(self.office_admin)
        records = self.client.get("/api/appointments/supervisor/")
        self.assertEqual(records.status_code, status.HTTP_200_OK)
        self.assertEqual(records.data[0]["studentId"], "MEA-SUP-001")
        self.assertEqual(records.data[0]["status"], "Pending")

    def test_panel_actions_are_written_to_shared_workflow_audit(self):
        from .models import PanelRecommendation, StudentResearchProfile

        profile = StudentResearchProfile.objects.create(
            student=self.student_user,
            matric_no=self.student_user.student.matric_no,
            student_name=self.student_user.full_name,
            programme=self.student_user.student.programme,
            semester=self.student_user.student.intake_semester,
            proposed_topic="Panel workflow audit",
            supervisor=self.supervisor_user,
        )
        recommendation = PanelRecommendation.objects.create(
            profile=profile,
            supervisor=self.supervisor_user,
            recommended_member=self.other_supervisor,
            academic_semester=self.academic_semester,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        )

        self.authenticate(self.other_supervisor)
        accepted = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.pk}/panel-accept/"
        )

        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        event = AppointmentWorkflowEvent.objects.get(
            panel_recommendation=recommendation
        )
        self.assertEqual(event.action, "PANEL_ACCEPT")
        self.assertEqual(event.actor, self.other_supervisor)
