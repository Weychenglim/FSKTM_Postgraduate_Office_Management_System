from datetime import timedelta

from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from academics.models import AcademicSemester
from academics.test_capacity_helpers import publish_test_capacity_plan
from accounts.test_registry_semesters import semesters_for
from appointments.models import (
    AppointmentWorkflowEvent,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)
from marks.models import (
    EvaluationPeriod,
    EvaluationTask,
    EvaluationTaskLifecycleAudit,
    MarkEntry,
    Rubric,
)

from .models import (
    Coordinator,
    Lecturer,
    OfficeStaff,
    Panel,
    ParticipantLifecycleAudit,
    Student,
    Supervisor,
    User,
)
from .participant_lifecycle import ParticipantLifecycleConflict

PROGRAMME = "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)"


class ParticipantLifecycleTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.office = User.objects.create_user(
            email="office.lifecycle@example.test",
            password="StrongPass123!",
            full_name="Lifecycle Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=False,
        )
        OfficeStaff.objects.create(
            user=self.office,
            staff_no="OFF-LIFE-001",
            department="Postgraduate Office",
        )
        self.student_user = User.objects.create_user(
            email="student.lifecycle@example.test",
            password="StrongPass123!",
            full_name="Lifecycle Student",
            role=User.Role.STUDENT,
        )
        self.student = Student.objects.create(
            user=self.student_user,
            matric_no="LIFE-STUDENT-001",
            programme=PROGRAMME,
        )
        self.supervisor_user = self._lecturer(
            "supervisor.lifecycle@example.test", "LIFE-LECT-001"
        )
        Supervisor.objects.create(
            lecturer=self.supervisor_user.lecturer,
            max_supervisees=5,
        )
        Panel.objects.create(
            lecturer=self.supervisor_user.lecturer,
            max_appointments=5,
        )
        self.panel_user = self._lecturer(
            "panel.lifecycle@example.test", "LIFE-LECT-002"
        )
        Panel.objects.create(
            lecturer=self.panel_user.lecturer,
            max_appointments=5,
        )
        self.coordinator_user = self._lecturer(
            "coordinator.lifecycle@example.test",
            "LIFE-COORD-001",
            role=User.Role.COORDINATOR,
        )
        Coordinator.objects.create(
            lecturer=self.coordinator_user.lecturer,
            programme_managed=PROGRAMME,
        )
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(
            code="LIFE-SEMESTER",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SPECIAL,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=60),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        self.application = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.supervisor_user,
            research_title="Participant lifecycle integrity",
            research_area="Information Systems",
            research_abstract="Lifecycle-safe postgraduate administration.",
            status=SupervisorApplication.Status.APPROVED,
        )
        self.supervisor_appointment = SupervisorAppointment.objects.create(
            application=self.application,
            student=self.student,
            supervisor=self.supervisor_user,
            approved_by=self.coordinator_user,
        )
        self.profile = StudentResearchProfile.objects.create(
            student=self.student_user,
            matric_no=self.student.matric_no,
            student_name=self.student_user.full_name,
            programme=PROGRAMME,
            semester=self.semester.label,
            proposed_topic=self.application.research_title,
            research_area=self.application.research_area,
            supervisor=self.supervisor_user,
        )
        publish_test_capacity_plan(self.semester, self.office)

    def _lecturer(self, email, staff_no, role=User.Role.LECTURER):
        user = User.objects.create_user(
            email=email,
            password="StrongPass123!",
            full_name=staff_no,
            role=role,
        )
        Lecturer.objects.create(
            user=user,
            staff_no=staff_no,
            department="Computer Science",
        )
        return user

    def _open_task(self, evaluator=None, role=EvaluationTask.EvaluatorRole.SUPERVISOR):
        rubric = Rubric.objects.create(
            name="Lifecycle Rubric",
            code=f"lifecycle-rubric-{Rubric.objects.count() + 1}",
            family_code=f"lifecycle-family-{Rubric.objects.count() + 1}",
            target_mark="10.00",
        )
        period = EvaluationPeriod.objects.create(
            name=f"Lifecycle Evaluation {EvaluationPeriod.objects.count() + 1}",
            semester=self.semester.label,
            academic_semester=self.semester,
            rubric=rubric,
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
            opens_at=timezone.now() - timedelta(days=1),
            closes_at=timezone.now() + timedelta(days=10),
            is_open=True,
        )
        task = EvaluationTask.objects.create(
            profile=self.profile,
            evaluator=evaluator or self.supervisor_user,
            evaluator_role=role,
            period=period,
            assigned_by=self.office,
        )
        MarkEntry.objects.create(
            task=task, status=MarkEntry.Status.DRAFT, comments="Saved draft"
        )
        return task

    def _transition_student(self, target_status, reason="Lifecycle transition reason"):
        self.client.force_authenticate(self.office)
        return self.client.post(
            f"/api/accounts/participants/students/{self.student.matric_no}/transition/",
            {"targetStatus": target_status, "reason": reason},
            format="json",
        )

    def _transition_lecturer(self, target_status, reason="Lecturer lifecycle reason"):
        self.client.force_authenticate(self.office)
        return self.client.post(
            f"/api/accounts/participants/lecturers/{self.supervisor_user.lecturer.staff_no}/transition/",
            {"targetStatus": target_status, "reason": reason},
            format="json",
        )

    def test_deferral_pauses_marks_and_reactivation_resumes_open_period_task(self):
        task = self._open_task()

        deferred = self._transition_student("DEFERRED")

        self.assertEqual(deferred.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        task.refresh_from_db()
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.DEFERRED)
        self.assertEqual(task.lifecycle_status, EvaluationTask.Lifecycle.PAUSED)
        self.assertEqual(
            self.supervisor_appointment.status, SupervisorAppointment.Status.ACTIVE
        )
        self.assertTrue(self.student_user.is_active)
        records = self.client.get("/api/marks/")
        detail = self.client.get(f"/api/marks/records/MRK-{task.pk:05d}/")
        paused_record = next(
            row for row in records.data if row["id"] == f"MRK-{task.pk:05d}"
        )
        self.assertEqual(paused_record["taskLifecycleStatus"], "PAUSED")
        self.assertEqual(detail.data["assignment"]["lifecycleStatus"], "PAUSED")
        self.assertEqual(
            detail.data["assignment"]["pauseReason"], "Lifecycle transition reason"
        )

        active = self._transition_student("ACTIVE", "Student returned to study")

        self.assertEqual(active.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, EvaluationTask.Lifecycle.ACTIVE)
        self.assertEqual(task.lifecycle_audits.count(), 2)

    def test_graduation_conflicts_until_pending_work_is_cancelled_then_completes_appointments(
        self,
    ):
        SupervisorApplication.objects.filter(pk=self.application.pk).update(
            status=SupervisorApplication.Status.PENDING_COORDINATOR
        )

        blocked = self._transition_student("GRADUATED")

        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertGreater(blocked.data["blockers"]["pendingSupervisorApplications"], 0)
        SupervisorApplication.objects.filter(pk=self.application.pk).update(
            status=SupervisorApplication.Status.APPROVED
        )
        semesters_for(self.student, "Semester I, 2026/2027", "Semester II, 2026/2027", "Semester I, 2027/2028")

        graduated = self._transition_student("GRADUATED", "Award confirmed")

        self.assertEqual(graduated.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.GRADUATED)
        self.assertEqual(
            self.supervisor_appointment.end_outcome,
            SupervisorAppointment.EndOutcome.COMPLETED,
        )
        self.assertTrue(self.student_user.is_active)

    def test_withdrawal_cancels_pending_panel_and_ends_appointments(self):
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            academic_semester=self.semester,
            supervisor=self.supervisor_user,
            recommended_member=self.panel_user,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            submitted_at=timezone.now(),
        )
        task = self._open_task()

        withdrawn = self._transition_student("WITHDRAWN", "Student withdrew")

        self.assertEqual(withdrawn.status_code, status.HTTP_200_OK)
        recommendation.refresh_from_db()
        task.refresh_from_db()
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(
            recommendation.status, PanelRecommendation.Status.CANCELLED_BY_OFFICE
        )
        self.assertEqual(
            self.supervisor_appointment.end_outcome,
            SupervisorAppointment.EndOutcome.WITHDRAWN,
        )
        self.assertEqual(task.lifecycle_status, EvaluationTask.Lifecycle.RETIRED)
        self.assertTrue(
            EvaluationTaskLifecycleAudit.objects.filter(
                task=task,
                action=EvaluationTaskLifecycleAudit.Action.RETIRED,
            ).exists()
        )
        self.assertTrue(
            AppointmentWorkflowEvent.objects.filter(
                panel_recommendation=recommendation,
                action="OFFICE_CANCEL_PARTICIPANT_LIFECYCLE",
            ).exists()
        )

    def test_retiring_blocks_candidates_and_final_retirement_requires_resolved_work(
        self,
    ):
        refresh = RefreshToken.for_user(self.supervisor_user)
        retiring = self._transition_lecturer("RETIRING")
        self.assertEqual(retiring.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.student_user)
        candidates = self.client.get("/api/appointments/supervisor/candidates/")
        self.assertNotIn(
            self.supervisor_user.lecturer.staff_no,
            {row["id"] for row in candidates.data},
        )

        blocked = self._transition_lecturer("RETIRED")
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(blocked.data["blockers"]["activeSupervisorAppointments"], 1)

        self.client.force_authenticate(self.office)
        ended = self.client.post(
            f"/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/end/",
            {"outcome": "OTHER", "reason": "Retirement preparation"},
            format="json",
        )
        self.assertEqual(ended.status_code, status.HTTP_200_OK)
        retired = self._transition_lecturer("RETIRED")
        self.assertEqual(retired.status_code, status.HTTP_200_OK)
        self.supervisor_user.refresh_from_db()
        self.supervisor_user.lecturer.refresh_from_db()
        self.assertFalse(self.supervisor_user.is_active)
        self.assertEqual(
            self.supervisor_user.lecturer.lifecycle_status,
            Lecturer.Lifecycle.RETIRED,
        )
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
        )
        login = self.client.post(
            "/api/auth/login/",
            {
                "email": self.supervisor_user.email,
                "password": "StrongPass123!",
            },
            format="json",
        )
        self.assertIn(
            login.status_code,
            {status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED},
        )

    def test_deferred_student_workflows_remain_visible_but_decisions_are_blocked(self):
        self.application.status = SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR
        self.application.save(update_fields=["status"])
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            academic_semester=self.semester,
            supervisor=self.supervisor_user,
            recommended_member=self.panel_user,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        )
        self.assertEqual(
            self._transition_student("DEFERRED").status_code, status.HTTP_200_OK
        )

        self.client.force_authenticate(self.supervisor_user)
        supervisor_queue = self.client.get("/api/appointments/supervisor/requests/")
        supervisor_decision = self.client.post(
            f"/api/appointments/supervisor/applications/{self.application.pk}/supervisor-accept/",
            {},
            format="json",
        )
        self.client.force_authenticate(self.panel_user)
        panel_queue = self.client.get("/api/appointments/panel/review-queue/")
        panel_decision = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.pk}/panel-accept/",
            {},
            format="json",
        )

        self.assertFalse(supervisor_queue.data[0]["participantEligible"])
        self.assertEqual(
            supervisor_queue.data[0]["participantLifecycleStatus"], "DEFERRED"
        )
        self.assertFalse(panel_queue.data[0]["participantEligible"])
        self.assertEqual(supervisor_decision.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(panel_decision.status_code, status.HTTP_409_CONFLICT)
        self.application.refresh_from_db()
        recommendation.refresh_from_db()
        self.assertEqual(
            self.application.status,
            SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
        )
        self.assertEqual(
            recommendation.status,
            PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        )

    def test_retiring_panel_lecturer_cannot_be_selected_by_query_or_direct_id(self):
        self.client.force_authenticate(self.office)
        transitioned = self.client.post(
            f"/api/accounts/participants/lecturers/{self.panel_user.lecturer.staff_no}/transition/",
            {"targetStatus": "RETIRING", "reason": "Preparing retirement"},
            format="json",
        )
        self.assertEqual(transitioned.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.supervisor_user)
        candidates = self.client.get("/api/appointments/panel/candidates/")
        submitted = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.student.matric_no,
                "recommendedMemberId": self.panel_user.lecturer.staff_no,
                "justification": "Direct identifier bypass attempt",
            },
            format="json",
        )

        self.assertNotIn(
            self.panel_user.lecturer.staff_no,
            {row["staffId"] for row in candidates.data},
        )
        self.assertEqual(submitted.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lifecycle_api_is_office_only_and_audits_are_immutable(self):
        self.client.force_authenticate(self.student_user)
        forbidden = self.client.get("/api/accounts/participants/")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        transitioned = self._transition_student("DEFERRED")
        self.assertEqual(transitioned.status_code, status.HTTP_200_OK)
        audit = ParticipantLifecycleAudit.objects.get(student=self.student)
        audit.reason = "Changed"
        with self.assertRaises(ValidationError):
            audit.save()

    def test_office_can_cancel_retiring_lecturer_pending_work(self):
        self.application.status = SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR
        self.application.save(update_fields=["status"])
        self.assertEqual(
            self._transition_lecturer("RETIRING").status_code, status.HTTP_200_OK
        )

        self.client.force_authenticate(self.office)
        response = self.client.post(
            f"/api/accounts/participants/lecturers/{self.supervisor_user.lecturer.staff_no}/pending-work/cancel/",
            {
                "recordType": "SUPERVISOR_APPLICATION",
                "recordId": self.application.pk,
                "reason": "Resolve pending work before retirement",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(
            self.application.status,
            SupervisorApplication.Status.CANCELLED_BY_OFFICE,
        )
        self.assertTrue(
            self.application.workflow_events.filter(
                action="OFFICE_CANCEL_PARTICIPANT_LIFECYCLE"
            ).exists()
        )

    def test_reports_and_dossiers_apply_lifecycle_scope_and_public_redaction(self):
        self.assertEqual(
            self._transition_student("DEFERRED", "Approved study deferral").status_code,
            status.HTTP_200_OK,
        )

        self.client.force_authenticate(self.office)
        report = self.client.get("/api/dashboard/reports/")
        internal = self.client.get(f"/api/dashboard/progress/{self.student.matric_no}/")
        self.client.force_authenticate(self.student_user)
        public = self.client.get(f"/api/dashboard/progress/{self.student.matric_no}/")

        self.assertEqual(report.status_code, status.HTTP_200_OK)
        self.assertEqual(report.data["participantLifecycle"]["deferredStudents"], 1)
        self.assertEqual(
            internal.data["student"]["lifecycle"]["reason"], "Approved study deferral"
        )
        self.assertEqual(public.data["student"]["lifecycle"]["status"], "DEFERRED")
        self.assertNotIn("reason", public.data["student"]["lifecycle"])
        self.assertNotIn("changedBy", public.data["student"]["lifecycle"])

    def test_invalid_transition_and_blank_reason_return_400(self):
        blank = self._transition_student("DEFERRED", " ")
        self.assertEqual(blank.status_code, status.HTTP_400_BAD_REQUEST)
        invalid = self._transition_student("RETIRED")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self._transition_student("DEFERRED").status_code, status.HTTP_200_OK
        )
        stale = self._transition_student("DEFERRED")
        self.assertEqual(stale.status_code, status.HTTP_409_CONFLICT)

    def test_office_lifecycle_cancellation_is_not_a_pending_supervisor_record(self):
        self.application.status = SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR
        self.application.save(update_fields=['status'])
        self.assertEqual(self._transition_student('WITHDRAWN').status_code, 200)
        self.client.force_authenticate(self.office)
        records = self.client.get('/api/appointments/supervisor/')
        row = next(row for row in records.data if row['applicationId'] == self.application.pk)
        self.assertEqual(row['status'], 'Cancelled')
        self.assertEqual(row['cancellationReason'], 'Lifecycle transition reason')
        self.client.force_authenticate(self.supervisor_user)
        history = self.client.get('/api/appointments/supervisor/request-history/')
        row = next(row for row in history.data if row['requestId'] == f'SV-REQ-{self.application.pk:05d}')
        self.assertEqual(row['decision'], 'Cancelled')
        self.assertEqual(row['decisionReason'], 'Lifecycle transition reason')

    def test_retiring_lecturer_can_resolve_existing_supervisor_request(self):
        self.application.status = SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR
        self.application.save(update_fields=['status'])
        self.assertEqual(self._transition_lecturer('RETIRING').status_code, 200)
        self.client.force_authenticate(self.supervisor_user)
        response = self.client.post(
            f'/api/appointments/supervisor/applications/{self.application.pk}/supervisor-reject/',
            {'reason': 'Existing request resolved during retirement preparation'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, SupervisorApplication.Status.REJECTED_BY_SUPERVISOR)

    def test_office_lifecycle_panel_cancellation_is_not_approved_or_hidden(self):
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile, academic_semester=self.semester,
            supervisor=self.supervisor_user, recommended_member=self.panel_user,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        )
        self.assertEqual(self._transition_student('WITHDRAWN').status_code, 200)
        self.client.force_authenticate(self.office)
        records = self.client.get('/api/appointments/panel/')
        row = next(row for row in records.data if row['recommendationId'] == recommendation.pk)
        self.assertEqual(row['status'], 'Cancelled')
        self.client.force_authenticate(self.panel_user)
        history = self.client.get('/api/appointments/panel/review-history/')
        self.assertIn(recommendation.pk, [row['id'] for row in history.data])
