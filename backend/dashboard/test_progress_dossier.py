from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Coordinator, Lecturer, OfficeStaff, ProjectRegistration, StudentSemester, Student, Supervisor
from academics.models import AcademicSemester
from academics.test_capacity_helpers import publish_test_capacity_plan
from appointments.models import (
    AppointmentWorkflowEvent,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
)
from dashboard.models import SemesterTimeline, SemesterTimelineEntry
from marks.models import EvaluationPeriod, EvaluationTask, MarkEntry, Rubric

User = get_user_model()
PROGRAMME = "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)"
FOREIGN_PROGRAMME = "MASTER OF DATA SCIENCE (COURSEWORK)"


class StudentProgressDossierTests(APITestCase):
    def setUp(self):
        self.now = timezone.now()
        self.office = self.create_user(
            "dossier-office@example.test",
            "Dossier Office",
            User.Role.OFFICE_ADMIN,
        )
        OfficeStaff.objects.create(
            user=self.office,
            staff_no="DOSSIER-OFFICE",
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
            created_by=self.office,
            activated_at=self.now,
        )
        self.coordinator = self.create_lecturer(
            "dossier-coordinator@example.test",
            "Dossier Coordinator",
            "DOSSIER-COORD",
            role=User.Role.COORDINATOR,
        )
        Coordinator.objects.create(
            lecturer=self.coordinator.lecturer,
            programme_managed=PROGRAMME,
        )
        self.supervisor = self.create_lecturer(
            "dossier-supervisor@example.test",
            "Dossier Supervisor",
            "DOSSIER-SUP",
        )
        Supervisor.objects.create(
            lecturer=self.supervisor.lecturer,
            max_supervisees=5,
        )
        self.panel = self.create_lecturer(
            "dossier-panel@example.test",
            "Dossier Panel",
            "DOSSIER-PANEL",
        )
        self.other_lecturer = self.create_lecturer(
            "dossier-other@example.test",
            "Dossier Other Lecturer",
            "DOSSIER-OTHER",
        )
        (
            self.student_user,
            self.student,
            self.profile,
        ) = self.create_student(
            "dossier-student@example.test",
            "Dossier Student",
            "DOSSIER-STUDENT-001",
            PROGRAMME,
            with_profile=True,
        )
        (
            self.foreign_student_user,
            self.foreign_student,
            self.foreign_profile,
        ) = self.create_student(
            "dossier-foreign@example.test",
            "Dossier Foreign Student",
            "DOSSIER-STUDENT-002",
            FOREIGN_PROGRAMME,
            with_profile=True,
        )
        (
            self.unprofiled_user,
            self.unprofiled_student,
            _,
        ) = self.create_student(
            "dossier-unprofiled@example.test",
            "Dossier Unprofiled Student",
            "DOSSIER-STUDENT-003",
            PROGRAMME,
            with_profile=False,
        )

        self.pending_supervisor = SupervisorApplication.objects.create(
            student=self.student,
            proposed_supervisor=self.supervisor,
            research_title="Persisted dossier research",
            research_abstract="Supervisor workflow in progress.",
            status=SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
            submitted_at=self.now - timedelta(days=5),
        )
        self.rejected_supervisor = SupervisorApplication.objects.create(
            student=self.student,
            proposed_supervisor=self.other_lecturer,
            research_title="Historical dossier research",
            research_abstract="Historical supervisor workflow.",
            status=SupervisorApplication.Status.REJECTED_BY_SUPERVISOR,
            supervisor_rejection_reason="Capacity unavailable.",
            submitted_at=self.now - timedelta(days=30),
            supervisor_decided_at=self.now - timedelta(days=28),
        )
        AppointmentWorkflowEvent.objects.create(
            supervisor_application=self.pending_supervisor,
            actor=self.student_user,
            actor_role=User.Role.STUDENT,
            action="SUBMITTED",
            new_status=self.pending_supervisor.status,
        )

        self.pending_panel = PanelRecommendation.objects.create(
            profile=self.profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            submitted_at=self.now - timedelta(days=8),
        )
        self.rejected_panel = PanelRecommendation.objects.create(
            profile=self.profile,
            supervisor=self.supervisor,
            recommended_member=self.other_lecturer,
            status=PanelRecommendation.Status.REJECTED_BY_PANEL,
            panel_rejection_reason="Unable to participate.",
            submitted_at=self.now - timedelta(days=20),
            panel_decided_at=self.now - timedelta(days=19),
        )
        AppointmentWorkflowEvent.objects.create(
            panel_recommendation=self.pending_panel,
            actor=self.supervisor,
            actor_role=User.Role.LECTURER,
            action="SUBMITTED",
            new_status=self.pending_panel.status,
        )

        rubric = Rubric.objects.create(
            name="Dossier Rubric",
            code="dossier-rubric",
        )
        self.period = EvaluationPeriod.objects.create(
            name="Dossier Period",
            assessment='P1',
            semester="Semester 1 2026/2027",
            academic_semester=self.academic_semester,
            rubric=rubric,
            closes_at=self.now - timedelta(days=1),
            is_open=True,
        )
        self.panel_task = EvaluationTask.objects.create(
            profile=self.profile,
            evaluator=self.panel,
            period=self.period,
            evaluator_role=EvaluationTask.EvaluatorRole.PANEL,
        )
        MarkEntry.objects.create(
            task=self.panel_task,
            status=MarkEntry.Status.DRAFT,
        )
        self.other_task = EvaluationTask.objects.create(
            profile=self.profile,
            evaluator=self.other_lecturer,
            period=self.period,
            evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
        )
        MarkEntry.objects.create(
            task=self.other_task,
            status=MarkEntry.Status.SUBMITTED,
            submitted_at=self.now - timedelta(days=2),
        )

        self.active_timeline = SemesterTimeline.objects.create(
            semester="Semester 1",
            session="2026/2027",
            academic_semester=self.academic_semester,
            is_active=True,
            uploaded_by=self.office,
        )
        self.student_timeline_entry = SemesterTimelineEntry.objects.create(
            timeline=self.active_timeline,
            level=SemesterTimelineEntry.Level.P1,
            step=1,
            title="Student proposal submission",
            detail="Submit the proposal.",
            action_owner="Student",
            deadline_start=timezone.localdate(),
            deadline_end=timezone.localdate() + timedelta(days=2),
            target_roles=["STUDENT"],
            display_order=1,
        )
        SemesterTimelineEntry.objects.create(
            timeline=self.active_timeline,
            level=SemesterTimelineEntry.Level.P1,
            step=2,
            title="Lecturer review only",
            detail="Lecturer task.",
            action_owner="Lecturer",
            deadline_start=timezone.localdate(),
            deadline_end=timezone.localdate() + timedelta(days=3),
            target_roles=["LECTURER"],
            display_order=2,
        )
        inactive_timeline = SemesterTimeline.objects.create(
            semester="Semester 2",
            session="2025/2026",
            is_active=False,
            uploaded_by=self.office,
        )
        SemesterTimelineEntry.objects.create(
            timeline=inactive_timeline,
            level=SemesterTimelineEntry.Level.P2,
            step=1,
            title="Historical student milestone",
            detail="Inactive timeline.",
            action_owner="Student",
            deadline_start=timezone.localdate() - timedelta(days=100),
            deadline_end=timezone.localdate() - timedelta(days=90),
            target_roles=["STUDENT"],
            display_order=1,
        )
        publish_test_capacity_plan(self.academic_semester, self.office)
        from .calendar_publication import publication_state, publish_calendar
        publish_calendar(self.academic_semester, self.office,
            publication_state(self.active_timeline, self.office)['reviewToken'])
        self.student_timeline_entry = SemesterTimelineEntry.objects.get(
            timeline__academic_semester=self.academic_semester, timeline__is_published=True,
            source_entry_id=self.student_timeline_entry.pk)

    def create_user(self, email, name, role):
        return User.objects.create_user(
            email=email,
            full_name=name,
            role=role,
        )

    def create_lecturer(self, email, name, staff_no, role=User.Role.LECTURER):
        user = self.create_user(email, name, role)
        Lecturer.objects.create(
            user=user,
            staff_no=staff_no,
            department="Artificial Intelligence",
        )
        return user

    def create_student(self, email, name, matric_no, programme, with_profile):
        user = self.create_user(email, name, User.Role.STUDENT)
        student = Student.objects.create(
            user=user,
            matric_no=matric_no,
            programme=programme,
            intake_semester="Semester 1 2026/2027",
        )
        StudentSemester.objects.get_or_create(student=student,
            session=self.academic_semester.academic_session, term=self.academic_semester.term)
        ProjectRegistration.objects.create(student=student, academic_semester=self.academic_semester, stage='P1')
        profile = None
        if with_profile:
            profile = StudentResearchProfile.objects.create(
                student=user,
                matric_no=matric_no,
                student_name=name,
                programme=programme,
                semester="Semester 1 2026/2027",
                proposed_topic=f"{name} research topic",
                research_area="Responsible AI",
                abstract="Persisted research profile.",
                supervisor=self.supervisor,
            )
        return user, student, profile

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def dossier_url(self, student=None):
        target = student or self.student
        return f"/api/dashboard/progress/{target.matric_no}/"

    def test_office_receives_complete_dossier_and_ordered_attention(self):
        self.authenticate(self.office)

        response = self.client.get(self.dossier_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["visibility"], "INTERNAL")
        self.assertEqual(
            response.data["visibleSections"],
            ["SUPERVISOR", "PANEL", "MARKS", "TIMELINE"],
        )
        self.assertEqual(response.data["student"]["studentId"], self.student.matric_no)
        self.assertEqual(
            response.data["supervisor"]["currentRecordId"],
            str(self.pending_supervisor.pk),
        )
        self.assertEqual(
            response.data["panel"]["currentRecordId"], str(self.pending_panel.pk)
        )
        self.assertEqual(len(response.data["supervisor"]["records"]), 2)
        self.assertEqual(len(response.data["panel"]["records"]), 2)
        self.assertEqual(len(response.data["marks"]["tasks"]), 2)
        self.assertEqual(
            response.data["timeline"]["entries"][0]["recordId"],
            str(self.student_timeline_entry.pk),
        )
        self.assertEqual(len(response.data["timeline"]["entries"]), 1)
        self.assertEqual(
            [item["kind"] for item in response.data["attention"][:3]],
            ["MARKS_DEADLINE", "WORKFLOW_WAIT", "WORKFLOW_WAIT"],
        )
        self.assertGreaterEqual(
            response.data["attention"][1]["waitingDays"],
            response.data["attention"][2]["waitingDays"],
        )
        self.assertEqual(response.data["overview"]["attentionCount"], 4)

    def test_coordinator_is_programme_scoped_and_marks_are_hidden(self):
        self.authenticate(self.coordinator)

        response = self.client.get(self.dossier_url())
        foreign = self.client.get(self.dossier_url(self.foreign_student))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["visibleSections"],
            ["SUPERVISOR", "PANEL", "TIMELINE"],
        )
        self.assertIsNone(response.data["marks"])
        self.assertEqual(foreign.status_code, status.HTTP_404_NOT_FOUND)

    def test_lecturer_sees_only_records_assigned_to_them(self):
        self.authenticate(self.panel)

        response = self.client.get(self.dossier_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("SUPERVISOR", response.data["visibleSections"])
        self.assertEqual(
            [row["recordId"] for row in response.data["panel"]["records"]],
            [str(self.pending_panel.pk)],
        )
        self.assertEqual(
            [row["taskId"] for row in response.data["marks"]["tasks"]],
            [str(self.panel_task.pk)],
        )
        self.assertNotIn(
            str(self.other_task.pk),
            {row["taskId"] for row in response.data["marks"]["tasks"]},
        )

        unrelated = self.create_lecturer(
            "dossier-unrelated@example.test",
            "Dossier Unrelated Lecturer",
            "DOSSIER-UNRELATED",
        )
        self.authenticate(unrelated)
        denied = self.client.get(self.dossier_url())
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

    def test_milestones_match_student_stage_for_authorised_viewers(self):
        from .calendar_publication import publication_state, publish_calendar

        SemesterTimelineEntry.objects.create(
            timeline=self.active_timeline,
            level=SemesterTimelineEntry.Level.P2,
            step=1,
            title="Final presentation",
            action_owner="Student",
            deadline_start=self.student_timeline_entry.deadline_start,
            deadline_end=self.student_timeline_entry.deadline_end,
            target_roles=["STUDENT"],
        )
        publish_calendar(self.academic_semester, self.office,
            publication_state(self.active_timeline, self.office)["reviewToken"])

        def milestone_titles(stage):
            response = self.client.get(self.dossier_url())
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["student"]["projectStage"], stage)
            self.assertEqual(response.data["student"]["projectSemester"], self.academic_semester.label)
            return [entry["title"] for entry in response.data["timeline"]["entries"]]

        viewers = (self.student_user, self.supervisor, self.panel, self.coordinator, self.office)
        for viewer in viewers:
            with self.subTest(viewer=viewer.role, stage="P1"):
                self.authenticate(viewer)
                self.assertEqual(milestone_titles("P1"), ["Student proposal submission"])

        registration = ProjectRegistration.objects.get(student=self.student, academic_semester=self.academic_semester)
        registration.stage = "P2"
        registration.source = ProjectRegistration.Source.COORDINATOR
        registration.save(update_fields=["stage", "source"])
        for viewer in viewers:
            with self.subTest(viewer=viewer.role, stage="P2"):
                self.authenticate(viewer)
                self.assertEqual(milestone_titles("P2"), ["Final presentation"])

    def test_student_self_view_redacts_internal_panel_marks_and_audit_fields(self):
        self.authenticate(self.student_user)

        response = self.client.get(self.dossier_url())
        denied = self.client.get(self.dossier_url(self.foreign_student))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["visibility"], "PUBLIC")
        self.assertEqual(response.data["overview"]["panelStatus"], "FACULTY_PROCESSING")
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

        panel_record = response.data["panel"]["records"][0]
        self.assertEqual(panel_record["status"], "FACULTY_PROCESSING")
        for sensitive_key in (
            "recordId",
            "recommendedMember",
            "recommendedMemberId",
            "waitingOn",
            "workflow",
            "submittedAt",
            "decisionAt",
            "panelDecisionAt",
            "coordinatorDecisionAt",
        ):
            self.assertNotIn(sensitive_key, panel_record)

        self.assertEqual(len(response.data["panel"]["records"]), 1)
        for sensitive_key in ("rejectionReason", "cancellationReason"):
            self.assertNotIn(sensitive_key, panel_record)
        self.assertIsNone(panel_record["waitingDays"])
        self.assertNotIn("Unable to participate.", str(response.data))
        self.assertNotIn(self.panel.full_name, str(response.data))

        self.assertNotIn("MARKS", response.data["visibleSections"])
        self.assertIsNone(response.data["marks"])
        self.assertIsNone(response.data["overview"]["marksStatus"])
        self.assertFalse(any(
            item["targetModule"] == "MARKS" for item in response.data["attention"]
        ))

        supervisor_record = response.data["supervisor"]["records"][0]
        self.assertNotIn("workflow", supervisor_record)

    def approved_panel(self, member, *, appointment_status="ACTIVE", days_ago=0):
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile, supervisor=self.supervisor, recommended_member=member,
            academic_semester=self.academic_semester, status=PanelRecommendation.Status.APPROVED,
        )
        return PanelAppointment.objects.create(
            recommendation=recommendation, profile=self.profile, supervisor=self.supervisor,
            panel_member=member, approved_by=self.coordinator,
            appointment_date=timezone.localdate() - timedelta(days=days_ago),
            status=appointment_status,
            ended_at=self.now if appointment_status != "ACTIVE" else None,
            end_reason="Internal appointment closure explanation.",
        )

    def test_student_active_panel_takes_precedence_over_pending_replacement(self):
        appointment = self.approved_panel(self.other_lecturer)
        self.pending_panel.replaces_appointment = appointment
        self.pending_panel.save(update_fields=["replaces_appointment"])
        self.authenticate(self.student_user)
        response = self.client.get(self.dossier_url())
        records = response.data["panel"]["records"]
        self.assertEqual(response.data["overview"]["panelStatus"], "CONFIRMED")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["status"], "CONFIRMED")
        self.assertEqual(records[0]["appointment"], {
            "appointmentDate": appointment.appointment_date.isoformat(),
            "status": "ACTIVE", "panelMember": self.other_lecturer.full_name, "endedAt": None,
        })
        for key in ("recordId", "recommendedMember", "rejectionReason", "cancellationReason", "workflow"):
            self.assertNotIn(key, records[0])
        self.assertFalse(any(item["targetModule"] == "PANEL_APPOINTMENTS" for item in response.data["attention"]))

    def test_student_panel_history_contains_only_actual_confirmed_appointments(self):
        past = self.approved_panel(self.panel, appointment_status="ENDED", days_ago=30)
        current = self.approved_panel(self.other_lecturer)
        self.authenticate(self.student_user)
        records = self.client.get(self.dossier_url()).data["panel"]["records"]
        self.assertEqual([row["status"] for row in records], ["CONFIRMED", "ENDED"])
        self.assertEqual([row["appointment"]["appointmentDate"] for row in records],
                         [current.appointment_date.isoformat(), past.appointment_date.isoformat()])
        self.assertNotIn("Internal appointment closure explanation.", str(records))
        self.assertNotIn("Unable to participate.", str(records))

    def test_student_pending_panel_precedes_history_without_revealing_candidate(self):
        self.approved_panel(self.other_lecturer, appointment_status="COMPLETED", days_ago=30)
        self.authenticate(self.student_user)
        response = self.client.get(self.dossier_url())
        records = response.data["panel"]["records"]
        self.assertEqual([row["status"] for row in records], ["FACULTY_PROCESSING", "COMPLETED"])
        self.assertIsNone(records[0]["appointment"])
        self.assertNotIn("recommendedMember", records[0])
        self.assertEqual(response.data["overview"]["panelStatus"], "FACULTY_PROCESSING")

    def test_student_does_not_receive_failed_attempts_or_unconfirmed_approval(self):
        for state in [PanelRecommendation.Status.REJECTED_BY_COORDINATOR,
                      PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR,
                      PanelRecommendation.Status.CANCELLED_BY_OFFICE,
                      PanelRecommendation.Status.APPROVED]:
            with self.subTest(state=state):
                self.pending_panel.status = state
                self.pending_panel.coordinator_rejection_reason = "Private coordinator feedback."
                self.pending_panel.cancellation_reason = "Private nomination cancellation."
                self.pending_panel.save()
                self.authenticate(self.student_user)
                response = self.client.get(self.dossier_url())
                self.assertEqual(response.data["panel"]["records"], [])
                self.assertIsNone(response.data["overview"]["panelStatus"])

    def test_student_past_panel_is_not_the_current_appointment(self):
        self.pending_panel.status = PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR
        self.pending_panel.save(update_fields=["status"])
        self.approved_panel(self.panel, appointment_status="ENDED", days_ago=30)
        self.authenticate(self.student_user)
        response = self.client.get(self.dossier_url())
        self.assertEqual([row["status"] for row in response.data["panel"]["records"]], ["ENDED"])
        self.assertIsNone(response.data["overview"]["panelStatus"])

    def test_office_keeps_rejected_panel_reason_and_workflow_history(self):
        self.authenticate(self.office)
        records = self.client.get(self.dossier_url()).data["panel"]["records"]
        rejected = next(row for row in records if row["recordId"] == str(self.rejected_panel.pk))
        self.assertEqual(rejected["rejectionReason"], "Unable to participate.")
        pending = next(row for row in records if row["recordId"] == str(self.pending_panel.pk))
        self.assertEqual(pending["recommendedMember"], self.panel.full_name)
        self.assertTrue(pending["workflow"])

    def test_unknown_and_unauthorized_students_share_not_found_response(self):
        self.authenticate(self.panel)

        unknown = self.client.get("/api/dashboard/progress/UNKNOWN-STUDENT/")
        unauthorized = self.client.get(self.dossier_url(self.foreign_student))

        self.assertEqual(unknown.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(unauthorized.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(unknown.data, unauthorized.data)

    def test_student_without_research_profile_receives_available_sections(self):
        SupervisorApplication.objects.create(
            student=self.unprofiled_student,
            proposed_supervisor=self.supervisor,
            research_title="Unprofiled supervisor request",
            research_abstract="Supervisor data remains available.",
            status=SupervisorApplication.Status.REJECTED_BY_SUPERVISOR,
            supervisor_rejection_reason="Please update the request.",
            submitted_at=self.now - timedelta(days=2),
            supervisor_decided_at=self.now - timedelta(days=1),
        )
        self.authenticate(self.unprofiled_user)

        response = self.client.get(self.dossier_url(self.unprofiled_student))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["student"]["research"])
        self.assertEqual(len(response.data["supervisor"]["records"]), 1)
        self.assertEqual(response.data["panel"]["records"], [])
        self.assertNotIn("MARKS", response.data["visibleSections"])
        self.assertIsNone(response.data["marks"])
        self.assertEqual(len(response.data["timeline"]["entries"]), 1)

    def test_terminal_records_do_not_contribute_stale_waiting_metadata(self):
        self.authenticate(self.office)

        response = self.client.get(self.dossier_url())

        rejected_supervisor = next(
            row
            for row in response.data["supervisor"]["records"]
            if row["recordId"] == str(self.rejected_supervisor.pk)
        )
        rejected_panel = next(
            row
            for row in response.data["panel"]["records"]
            if row["recordId"] == str(self.rejected_panel.pk)
        )
        self.assertIsNone(rejected_supervisor["waitingDays"])
        self.assertIsNone(rejected_panel["waitingDays"])
