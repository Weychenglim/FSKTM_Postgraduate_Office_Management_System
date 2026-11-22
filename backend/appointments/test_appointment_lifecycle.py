from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import AcademicSemester, LecturerAvailabilityWindow
from academics.test_capacity_helpers import publish_test_capacity_plan
from accounts.models import (
    Coordinator,
    Lecturer,
    OfficeStaff,
    Panel,
    ProjectRegistration,
    StudentSemester,
    Student,
    Supervisor,
)
from marks.models import (
    EvaluationPeriod,
    EvaluationTask,
    EvaluationTaskHandoverAudit,
    MarkEntry,
    MarkScore,
    Rubric,
    RubricComponent,
)

from .models import (
    AppointmentLifecycleEvent,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
    SupervisorDocumentRequirement,
)

User = get_user_model()


class AppointmentLifecycleTests(APITestCase):
    def setUp(self):
        self.student_user = User.objects.create_user(
            email="lifecycle.student@example.test",
            password="password123",
            full_name="Lifecycle Student",
            role=User.Role.STUDENT,
        )
        self.student = Student.objects.create(
            user=self.student_user,
            matric_no="DEMO-LIFE-001",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.supervisor = self._lecturer("old@example.test", "OLD-001", supervisor=True)
        self.new_supervisor = self._lecturer(
            "new@example.test", "NEW-001", supervisor=True
        )
        self.panel = self._lecturer("panel@example.test", "PANEL-001", panel=True)
        self.new_panel = self._lecturer(
            "new-panel@example.test", "PANEL-002", panel=True
        )
        self.coordinator = self._lecturer("coordinator@example.test", "COORD-001")
        self.coordinator.role = User.Role.COORDINATOR
        self.coordinator.save(update_fields=["role"])
        Coordinator.objects.create(
            lecturer=self.coordinator.lecturer,
            programme_managed=self.student.programme,
        )
        self.other_coordinator = self._lecturer("other-coord@example.test", "COORD-002")
        self.other_coordinator.role = User.Role.COORDINATOR
        self.other_coordinator.save(update_fields=["role"])
        Coordinator.objects.create(
            lecturer=self.other_coordinator.lecturer,
            programme_managed="MASTER OF SOFTWARE ENGINEERING",
        )
        self.office = User.objects.create_user(
            email="office@example.test",
            password="password123",
            full_name="Office Administrator",
            role=User.Role.OFFICE_ADMIN,
        )
        OfficeStaff.objects.create(
            user=self.office,
            staff_no="OFFICE-001",
            department="Postgraduate Office",
        )
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(
            code="2099-2100-S1",
            academic_session="2099/2100",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=120),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
            activated_at=timezone.now(),
        )
        SupervisorDocumentRequirement.objects.create(
            code="research-proposal",
            label="Research Proposal",
            is_required=True,
            is_active=True,
        )
        self.application = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.supervisor,
            research_title="Lifecycle-safe postgraduate workflows",
            research_area="Software Engineering",
            research_abstract="Persisted lifecycle research.",
            status=SupervisorApplication.Status.APPROVED,
            supervisor_decided_at=timezone.now(),
            coordinator_decided_at=timezone.now(),
        )
        self.supervisor_appointment = SupervisorAppointment.objects.create(
            application=self.application,
            student=self.student,
            supervisor=self.supervisor,
            approved_by=self.coordinator,
        )
        self.profile = StudentResearchProfile.objects.create(
            student=self.student_user,
            matric_no=self.student.matric_no,
            student_name=self.student_user.full_name,
            programme=self.student.programme,
            semester=self.semester.label,
            proposed_topic=self.application.research_title,
            research_area=self.application.research_area,
            abstract=self.application.research_abstract,
            supervisor=self.supervisor,
        )
        StudentSemester.objects.get_or_create(student=self.student,
            session=self.semester.academic_session, term=self.semester.term)
        ProjectRegistration.objects.create(student=self.student, academic_semester=self.semester, stage="P1")
        publish_test_capacity_plan(self.semester, self.office)

    def _lecturer(self, email, staff_no, *, supervisor=False, panel=False):
        user = User.objects.create_user(
            email=email,
            password="password123",
            full_name=staff_no,
            role=User.Role.LECTURER,
        )
        lecturer = Lecturer.objects.create(
            user=user,
            staff_no=staff_no,
            department="Computing",
        )
        if supervisor:
            Supervisor.objects.create(lecturer=lecturer, max_supervisees=5)
        if panel:
            Panel.objects.create(lecturer=lecturer, max_appointments=5)
        return user

    def _panel_appointment(self):
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            academic_semester=self.semester,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            status=PanelRecommendation.Status.APPROVED,
            submitted_at=timezone.now(),
            panel_decided_at=timezone.now(),
            coordinator_decided_at=timezone.now(),
        )
        return PanelAppointment.objects.create(
            recommendation=recommendation,
            profile=self.profile,
            supervisor=self.supervisor,
            panel_member=self.panel,
            approved_by=self.coordinator,
        )

    def _post_end(self, kind, appointment, user, outcome="WITHDRAWN"):
        self.client.force_authenticate(user=user)
        return self.client.post(
            f"/api/appointments/{kind}/appointments/{appointment.pk}/end/",
            {"outcome": outcome, "reason": "Documented faculty decision."},
            format="json",
        )

    def test_office_can_end_supervisor_appointment_with_immutable_audit(self):
        self.client.force_authenticate(user=self.office)
        malformed = self.client.post(
            f"/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/end/",
            {"outcome": "WITHDRAWN", "reason": ""},
            format="json",
        )
        self.assertEqual(malformed.status_code, status.HTTP_400_BAD_REQUEST)

        response = self._post_end(
            "supervisor", self.supervisor_appointment, self.office
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(
            self.supervisor_appointment.status, SupervisorAppointment.Status.ENDED
        )
        self.assertEqual(self.supervisor_appointment.end_outcome, "WITHDRAWN")
        self.assertEqual(self.supervisor_appointment.ended_by, self.office)
        self.assertIsNotNone(self.supervisor_appointment.ended_at)
        event = AppointmentLifecycleEvent.objects.get(
            supervisor_appointment=self.supervisor_appointment
        )
        self.assertEqual(event.action, AppointmentLifecycleEvent.Action.ENDED)
        with self.assertRaises(Exception):
            event.delete()

        repeated = self._post_end(
            "supervisor", self.supervisor_appointment, self.office
        )
        self.assertEqual(repeated.status_code, status.HTTP_409_CONFLICT)

        report = self.client.get("/api/dashboard/reports/?semester=all")
        self.assertEqual(report.status_code, status.HTTP_200_OK)
        row = next(
            item
            for item in report.data["supervisor"]["records"]
            if item["recordId"] == str(self.application.pk)
        )
        self.assertEqual(row["appointmentOutcome"], "WITHDRAWN")
        self.assertEqual(row["appointmentEndReason"], "Documented faculty decision.")
        self.assertEqual(row["appointmentEndedBy"], self.office.full_name)

        self.client.force_authenticate(user=self.student_user)
        public_dossier = self.client.get(
            f"/api/dashboard/progress/{self.student.matric_no}/"
        )
        self.assertEqual(public_dossier.status_code, status.HTTP_200_OK)
        appointment_payload = public_dossier.data["supervisor"]["records"][0][
            "appointment"
        ]
        self.assertNotIn("lifecycle", appointment_payload)
        self.assertNotIn("endedBy", appointment_payload)

    def test_coordinator_scope_and_replaced_outcome_are_enforced(self):
        forbidden = self._post_end(
            "supervisor", self.supervisor_appointment, self.other_coordinator
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        replaced = self._post_end(
            "supervisor", self.supervisor_appointment, self.coordinator, "REPLACED"
        )
        self.assertEqual(replaced.status_code, status.HTTP_400_BAD_REQUEST)

        allowed = self._post_end(
            "supervisor", self.supervisor_appointment, self.coordinator
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

        records = self.client.get("/api/appointments/supervisor/coordinator-records/")
        self.assertEqual(records.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in records.data], [self.application.pk])

        self.client.force_authenticate(user=self.other_coordinator)
        other_records = self.client.get(
            "/api/appointments/supervisor/coordinator-records/"
        )
        self.assertEqual(other_records.status_code, status.HTTP_200_OK)
        self.assertEqual(other_records.data, [])

        self.client.force_authenticate(user=self.student_user)
        student_records = self.client.get(
            "/api/appointments/supervisor/coordinator-records/"
        )
        self.assertEqual(student_records.status_code, status.HTTP_403_FORBIDDEN)

    def test_panel_closure_releases_active_workload(self):
        appointment = self._panel_appointment()
        response = self._post_end("panel", appointment, self.office, "COMPLETED")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, PanelAppointment.Status.ENDED)
        self.assertEqual(appointment.end_outcome, "COMPLETED")

    def test_office_submits_replacement_without_reusing_student_documents(self):
        self.client.force_authenticate(user=self.office)
        response = self.client.post(
            f"/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/replacement/",
            {
                "proposedSupervisorId": self.new_supervisor.lecturer.staff_no,
                "reason": "Research direction changed.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        replacement = SupervisorApplication.objects.get(pk=response.data["id"])
        self.assertEqual(replacement.replaces_appointment, self.supervisor_appointment)
        self.assertEqual(replacement.replacement_reason, "Research direction changed.")
        self.assertFalse(replacement.documents.exists())
        self.assertIsNone(replacement.section_a)
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(
            self.supervisor_appointment.status, SupervisorAppointment.Status.ACTIVE
        )

    def test_supervisor_replacement_submission_enforces_incoming_capacity(self):
        today = timezone.localdate()
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.new_supervisor.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=today,
            ends_on=today + timedelta(days=3),
            reason="Replacement assignment is temporarily unavailable.",
            created_by=self.office,
        )
        self.client.force_authenticate(user=self.office)

        response = self.client.post(
            f"/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/replacement/",
            {
                "proposedSupervisorId": self.new_supervisor.lecturer.staff_no,
                "reason": "Research direction changed.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(
            SupervisorApplication.objects.exclude(pk=self.application.pk).exists()
        )
        self.supervisor_appointment.refresh_from_db()
        self.assertEqual(
            self.supervisor_appointment.status,
            SupervisorAppointment.Status.ACTIVE,
        )

    def test_supervisor_replacement_handover_is_atomic_and_cancels_pending_panel(self):
        replacement = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.new_supervisor,
            research_title=self.profile.proposed_topic,
            research_area=self.profile.research_area,
            research_abstract=self.profile.abstract,
            replaces_appointment=self.supervisor_appointment,
            replacement_reason="Research alignment.",
            status=SupervisorApplication.Status.PENDING_COORDINATOR,
            supervisor_decided_at=timezone.now(),
        )
        pending_panel = PanelRecommendation.objects.create(
            profile=self.profile,
            academic_semester=self.semester,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            submitted_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.post(
            f"/api/appointments/supervisor/applications/{replacement.pk}/coordinator-approve/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.supervisor_appointment.refresh_from_db()
        replacement.refresh_from_db()
        pending_panel.refresh_from_db()
        self.profile.refresh_from_db()
        new_appointment = replacement.appointment
        self.assertEqual(
            self.supervisor_appointment.status, SupervisorAppointment.Status.ENDED
        )
        self.assertEqual(self.supervisor_appointment.end_outcome, "REPLACED")
        self.assertEqual(new_appointment.supersedes, self.supervisor_appointment)
        self.assertEqual(self.profile.supervisor, self.new_supervisor)
        self.assertEqual(
            pending_panel.status,
            PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR,
        )

    def test_panel_replacement_uses_existing_approval_chain(self):
        old = self._panel_appointment()
        self.client.force_authenticate(user=self.supervisor)
        submitted = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.student.matric_no,
                "recommendedMemberId": self.new_panel.lecturer.staff_no,
                "justification": "Replacement expertise.",
                "replacesAppointmentId": old.pk,
                "replacementReason": "Original member withdrew.",
            },
            format="json",
        )
        self.assertEqual(submitted.status_code, status.HTTP_201_CREATED)
        recommendation = PanelRecommendation.objects.get(pk=submitted.data["id"])

        self.client.force_authenticate(user=self.new_panel)
        self.assertEqual(
            self.client.post(
                f"/api/appointments/panel/recommendations/{recommendation.pk}/panel-accept/"
            ).status_code,
            status.HTTP_200_OK,
        )
        self.client.force_authenticate(user=self.coordinator)
        approved = self.client.post(
            f"/api/appointments/panel/recommendations/{recommendation.pk}/coordinator-approve/"
        )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        old.refresh_from_db()
        recommendation.refresh_from_db()
        self.assertEqual(old.status, PanelAppointment.Status.ENDED)
        self.assertEqual(old.end_outcome, "REPLACED")
        self.assertEqual(recommendation.panel_appointment.supersedes, old)

    def test_draft_marks_are_snapshotted_retired_and_restarted_on_replacement(self):
        rubric = Rubric.objects.create(
            family_code="LIFE",
            code="LIFE-V1",
            name="Lifecycle Rubric",
            target_mark=Decimal("100"),
        )
        component = RubricComponent.objects.create(
            rubric=rubric,
            code="QUALITY",
            name="Quality",
            max_marks=Decimal("100"),
            display_order=1,
            is_required=True,
        )
        now = timezone.now()
        period = EvaluationPeriod.objects.create(
            assessment="P1",
            name="Lifecycle Evaluation",
            semester=self.semester.label,
            academic_semester=self.semester,
            rubric=rubric,
            opens_at=now - timedelta(days=1),
            closes_at=now + timedelta(days=5),
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
        )
        task = EvaluationTask.objects.create(
            profile=self.profile,
            evaluator=self.supervisor,
            period=period,
            evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
        )
        entry = MarkEntry.objects.create(
            task=task,
            status=MarkEntry.Status.DRAFT,
            comments="Outgoing draft",
        )
        MarkScore.objects.create(
            entry=entry,
            component=component,
            marks_awarded=Decimal("70"),
        )
        replacement = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.new_supervisor,
            research_title=self.profile.proposed_topic,
            research_area=self.profile.research_area,
            research_abstract=self.profile.abstract,
            replaces_appointment=self.supervisor_appointment,
            replacement_reason="Research alignment.",
            status=SupervisorApplication.Status.PENDING_COORDINATOR,
            supervisor_decided_at=now,
        )
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.post(
            f"/api/appointments/supervisor/applications/{replacement.pk}/coordinator-approve/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, EvaluationTask.Lifecycle.RETIRED)
        audit = EvaluationTaskHandoverAudit.objects.get(task=task)
        self.assertEqual(audit.draft_snapshot["comments"], "Outgoing draft")
        self.assertEqual(audit.draft_snapshot["scores"][str(component.pk)], "70.00")
        new_task = EvaluationTask.objects.get(
            profile=self.profile,
            evaluator=self.new_supervisor,
            period=period,
            evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
        )
        self.assertEqual(audit.replacement_task, new_task)
        self.assertFalse(hasattr(new_task, "mark_entry"))

        self.client.force_authenticate(user=self.office)
        records = self.client.get("/api/marks/")
        self.assertEqual(records.status_code, status.HTTP_200_OK)
        retired_record = next(
            item for item in records.data if item["id"] == f"MRK-{task.pk:05d}"
        )
        self.assertEqual(retired_record["taskLifecycleStatus"], "RETIRED")
        detail = self.client.get(f"/api/marks/records/MRK-{task.pk:05d}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["assignment"]["lifecycleStatus"], "RETIRED")
        self.assertEqual(len(detail.data["handoverHistory"]), 1)

        dossier = self.client.get(f"/api/dashboard/progress/{self.student.matric_no}/")
        self.assertEqual(dossier.status_code, status.HTTP_200_OK)
        retired_dossier_task = next(
            item
            for item in dossier.data["marks"]["tasks"]
            if item.get("taskId") == str(task.pk)
        )
        self.assertEqual(retired_dossier_task["status"], "RETIRED")
        self.assertEqual(dossier.data["marks"]["summaryStatus"], "NOT_STARTED")

    def test_replacement_after_direct_closure_creates_clean_marks_task(self):
        rubric = Rubric.objects.create(
            family_code="LATE",
            code="LATE-V1",
            name="Late Replacement Rubric",
            target_mark=Decimal("100"),
        )
        RubricComponent.objects.create(
            rubric=rubric,
            code="QUALITY",
            name="Quality",
            max_marks=Decimal("100"),
            display_order=1,
            is_required=True,
        )
        now = timezone.now()
        period = EvaluationPeriod.objects.create(
            assessment="P1",
            name="Late Replacement Evaluation",
            semester=self.semester.label,
            academic_semester=self.semester,
            rubric=rubric,
            opens_at=now - timedelta(days=1),
            closes_at=now + timedelta(days=5),
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
        )
        old_task = EvaluationTask.objects.create(
            profile=self.profile,
            evaluator=self.supervisor,
            period=period,
            evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
        )
        ended = self._post_end(
            "supervisor", self.supervisor_appointment, self.office, "WITHDRAWN"
        )
        self.assertEqual(ended.status_code, status.HTTP_200_OK)
        old_task.refresh_from_db()
        self.assertEqual(old_task.lifecycle_status, EvaluationTask.Lifecycle.RETIRED)

        replacement = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.new_supervisor,
            research_title=self.profile.proposed_topic,
            research_area=self.profile.research_area,
            research_abstract=self.profile.abstract,
            replaces_appointment=self.supervisor_appointment,
            replacement_reason="Replacement approved after withdrawal.",
            status=SupervisorApplication.Status.PENDING_COORDINATOR,
            supervisor_decided_at=now,
        )
        self.client.force_authenticate(user=self.coordinator)
        approved = self.client.post(
            f"/api/appointments/supervisor/applications/{replacement.pk}/coordinator-approve/"
        )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        new_task = EvaluationTask.objects.get(
            profile=self.profile,
            evaluator=self.new_supervisor,
            period=period,
            evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
        )
        self.assertFalse(hasattr(new_task, "mark_entry"))
        self.assertTrue(
            old_task.handover_audits.filter(replacement_task=new_task).exists()
        )
