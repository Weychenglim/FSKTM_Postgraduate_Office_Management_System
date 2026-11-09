from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Coordinator, Lecturer, OfficeStaff, Student, Supervisor
from academics.models import AcademicSemester
from academics.test_capacity_helpers import publish_test_capacity_plan
from appointments.models import (
    CoSupervisorAppointment,
    CoSupervisorNomination,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)
from marks.models import EvaluationPeriod, EvaluationTask, MarkEntry, Rubric
from dashboard.models import SemesterTimeline, SemesterTimelineEntry
from dashboard.actions import _sort_key

User = get_user_model()


class DashboardSummaryTests(APITestCase):
    def setUp(self):
        self.office = User.objects.create_user(
            email="summary-office@example.com",
            password="password123",
            full_name="Summary Office",
            role=User.Role.OFFICE_ADMIN,
        )
        OfficeStaff.objects.create(
            user=self.office,
            staff_no="DS1001",
            department="Postgraduate Office",
        )
        today = timezone.localdate()
        self.academic_semester = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timezone.timedelta(days=30),
            ends_on=today + timezone.timedelta(days=120),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
            activated_at=timezone.now(),
        )
        self.supervisor = User.objects.create_user(
            email="summary-supervisor@example.com",
            password="password123",
            full_name="Summary Supervisor",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.supervisor,
            staff_no="DS1002",
            department="Artificial Intelligence",
        )
        Supervisor.objects.create(lecturer=self.supervisor.lecturer, max_supervisees=5)
        self.panel = User.objects.create_user(
            email="summary-panel@example.com",
            password="password123",
            full_name="Summary Panel",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.panel,
            staff_no="DS1003",
            department="Artificial Intelligence",
        )
        self.coordinator = User.objects.create_user(
            email="summary-coordinator@example.com",
            password="password123",
            full_name="Summary Coordinator",
            role=User.Role.COORDINATOR,
        )
        Lecturer.objects.create(
            user=self.coordinator,
            staff_no="DS1004",
            department="Artificial Intelligence",
        )
        Coordinator.objects.create(
            lecturer=self.coordinator.lecturer,
            programme_managed="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.student_user = User.objects.create_user(
            email="summary-student@example.com",
            password="password123",
            full_name="Summary Student",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=self.student_user,
            matric_no="MEA-DASH-001",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        self.profile = StudentResearchProfile.objects.create(
            student=self.student_user,
            matric_no=self.student_user.student.matric_no,
            student_name=self.student_user.full_name,
            programme=self.student_user.student.programme,
            semester="Sem 1 2025/2026",
            proposed_topic="Dashboard integration",
            supervisor=self.supervisor,
        )
        SupervisorApplication.objects.create(
            student=self.student_user.student,
            proposed_supervisor=self.supervisor,
            research_title="Dashboard integration",
            research_abstract="Summary test",
            status=SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
        )
        PanelRecommendation.objects.create(
            profile=self.profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
        )
        rubric = Rubric.objects.create(name="Summary Rubric", code="summary-rubric")
        period = EvaluationPeriod.objects.create(
            name="Summary Period",
            semester="Sem 1 2025/2026",
            academic_semester=self.academic_semester,
            rubric=rubric,
            is_open=True,
        )
        task = EvaluationTask.objects.create(
            profile=self.profile,
            evaluator=self.panel,
            period=period,
        )
        MarkEntry.objects.create(task=task, status=MarkEntry.Status.DRAFT)
        publish_test_capacity_plan(self.academic_semester, self.office)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_office_summary_uses_live_cross_module_counts(self):
        self.authenticate(self.office)

        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pendingSupervisorRequests"], 1)
        self.assertEqual(response.data["pendingPanelApprovals"], 1)
        self.assertEqual(response.data["incompleteMarkEntries"], 1)

    def test_lecturer_summary_is_scoped_to_own_work(self):
        self.authenticate(self.panel)

        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pendingSupervisorRequests"], 0)
        self.assertEqual(response.data["pendingPanelReviews"], 0)
        self.assertEqual(response.data["incompleteMarkEntries"], 1)

    def test_lecturer_assignment_counts_are_distinct_from_pending_reviews(self):
        application = SupervisorApplication.objects.get(student=self.student_user.student)
        application.status = SupervisorApplication.Status.APPROVED
        application.save(update_fields=["status"])
        primary = SupervisorAppointment.objects.create(application=application,
            student=self.student_user.student, supervisor=self.supervisor, approved_by=self.coordinator)
        supporting_user = User.objects.create_user(email="summary-supporting-student@example.test",
            password="unused-test-password", full_name="Supporting Student", role=User.Role.STUDENT)
        supporting_student = Student.objects.create(user=supporting_user, matric_no="SUMMARY-SUPPORTING", programme="AI")
        other_application = SupervisorApplication.objects.create(student=supporting_student,
            proposed_supervisor=self.panel, research_title="Supporting research", status="APPROVED")
        other_primary = SupervisorAppointment.objects.create(application=other_application,
            student=supporting_student, supervisor=self.panel, approved_by=self.coordinator)
        nomination = CoSupervisorNomination.objects.create(student=supporting_student,
            primary_appointment=other_primary, nominator=self.panel, candidate=self.supervisor,
            academic_semester=self.academic_semester, justification="Supporting test", status="APPROVED")
        CoSupervisorAppointment.objects.create(student=supporting_student, nomination=nomination,
            supervisor=self.supervisor, approved_by=self.coordinator)
        self.authenticate(self.supervisor)
        response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.data["activeSupervisees"], 2)
        self.assertEqual(response.data["pendingSupervisorRequests"], 0)
        primary.status = "ENDED"
        primary.save(update_fields=["status"])
        response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.data["activeSupervisees"], 1)
        self.authenticate(self.panel)
        self.assertEqual(self.client.get("/api/dashboard/summary/").data["activeSupervisees"], 1)

    def test_panel_assignments_require_active_confirmed_appointment(self):
        recommendation = PanelRecommendation.objects.get(profile=self.profile)
        self.authenticate(self.panel)
        self.assertEqual(self.client.get("/api/dashboard/summary/").data["activePanelAssignments"], 0)
        recommendation.status = "APPROVED"
        recommendation.save(update_fields=["status"])
        appointment = PanelAppointment.objects.create(recommendation=recommendation, profile=self.profile,
            supervisor=self.supervisor, panel_member=self.panel, approved_by=self.coordinator)
        self.assertEqual(self.client.get("/api/dashboard/summary/").data["activePanelAssignments"], 1)
        self.authenticate(self.supervisor)
        self.assertEqual(self.client.get("/api/dashboard/summary/").data["activePanelAssignments"], 0)
        appointment.status = "ENDED"
        appointment.save(update_fields=["status"])
        self.authenticate(self.panel)
        self.assertEqual(self.client.get("/api/dashboard/summary/").data["activePanelAssignments"], 0)

    def test_assigned_tasks_include_submissions_but_exclude_inactive_and_other_evaluators(self):
        task = EvaluationTask.objects.get(evaluator=self.panel)
        MarkEntry.objects.filter(task=task).update(status=MarkEntry.Status.SUBMITTED)
        EvaluationTask.objects.create(profile=self.profile, evaluator=self.panel, period=task.period,
            evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR)
        EvaluationTask.objects.create(profile=self.profile, evaluator=self.panel, period=task.period,
            evaluator_role=EvaluationTask.EvaluatorRole.BACKUP, lifecycle_status=EvaluationTask.Lifecycle.RETIRED)
        EvaluationTask.objects.create(profile=self.profile, evaluator=self.supervisor, period=task.period)
        self.authenticate(self.panel)
        result = self.client.get("/api/dashboard/summary/").data
        self.assertEqual(result["assignedMarkTasks"], 2)
        self.assertEqual(result["incompleteMarkEntries"], 1)
        self.assertEqual(result["submittedMarkEntries"], 1)
        self.assertEqual(result["supervisorMarkTasks"], 1)
        self.assertEqual(result["panelMarkTasks"], 1)
        self.assertEqual(result["backupMarkTasks"], 0)
        self.authenticate(self.student_user)
        result = self.client.get("/api/dashboard/summary/").data
        self.assertEqual(result["assignedMarkTasks"], 0)
        self.assertEqual(result["activeSupervisees"], 0)
        self.assertEqual(result["activePanelAssignments"], 0)

    def test_coordinator_summary_is_scoped_to_managed_programme(self):
        self.authenticate(self.coordinator)

        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pendingPanelApprovals"], 1)
        self.assertEqual(response.data["pendingSupervisorApprovals"], 0)

    def test_office_action_feed_contains_persisted_owned_module_actions(self):
        self.authenticate(self.office)

        response = self.client.get("/api/dashboard/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        modules = {task["targetModule"] for task in response.data["tasks"]}
        self.assertIn("SUPERVISOR_APPOINTMENTS", modules)
        self.assertIn("PANEL_APPOINTMENTS", modules)
        self.assertIn("MARKS", modules)
        self.assertTrue(all("waitingDays" in task for task in response.data["tasks"]))
        self.assertTrue(all("deadlineState" in task for task in response.data["tasks"]))

    def test_coordinator_action_feed_contains_only_managed_programme_approvals(self):
        foreign_student_user = User.objects.create_user(
            email="summary-foreign-student@example.test",
            password="password123",
            full_name="Summary Foreign Student",
            role=User.Role.STUDENT,
        )
        foreign_student = Student.objects.create(
            user=foreign_student_user,
            matric_no="MEA-DASH-FOREIGN",
            programme="MASTER OF DATA SCIENCE",
        )
        foreign_application = SupervisorApplication.objects.create(
            student=foreign_student,
            proposed_supervisor=self.supervisor,
            research_title="Foreign programme",
            research_abstract="Must remain hidden",
            status=SupervisorApplication.Status.PENDING_COORDINATOR,
            supervisor_decided_at=timezone.now(),
        )
        self.authenticate(self.coordinator)

        response = self.client.get("/api/dashboard/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tasks = response.data["tasks"]
        self.assertTrue(tasks)
        self.assertTrue(
            all(
                task["targetModule"]
                in {"SUPERVISOR_APPOINTMENTS", "PANEL_APPOINTMENTS"}
                for task in tasks
            )
        )
        self.assertNotIn(
            str(foreign_application.pk),
            {task["recordId"] for task in tasks},
        )

    def test_student_action_feed_uses_generic_panel_processing_metadata(self):
        foreign_student_user = User.objects.create(
            email="summary-hidden-student@example.test",
            password="!unused",
            full_name="Summary Hidden Student",
            role=User.Role.STUDENT,
        )
        foreign_student = Student.objects.create(
            user=foreign_student_user,
            matric_no="MEA-DASH-HIDDEN",
            programme=self.student_user.student.programme,
        )
        foreign_profile = StudentResearchProfile.objects.create(
            student=foreign_student_user,
            matric_no=foreign_student.matric_no,
            student_name=foreign_student_user.full_name,
            programme=foreign_student.programme,
            semester="Sem 1 2025/2026",
            proposed_topic="Hidden panel workflow",
            supervisor=self.supervisor,
        )
        PanelRecommendation.objects.create(
            profile=foreign_profile,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        )
        self.authenticate(self.student_user)

        response = self.client.get("/api/dashboard/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        panel_tasks = [
            task
            for task in response.data["tasks"]
            if task["targetModule"] == "PANEL_APPOINTMENTS"
        ]
        self.assertEqual(len(panel_tasks), 1)
        panel_task = panel_tasks[0]
        self.assertEqual(panel_task["waitingOn"], "FACULTY_PROCESSING")
        self.assertIsNone(panel_task["recordId"])
        self.assertNotIn("Programme Coordinator", panel_task["statusText"])
        self.assertNotIn("selected panel", panel_task["statusText"].lower())

    def test_lecturer_action_feed_contains_only_assigned_work(self):
        self.authenticate(self.supervisor)

        response = self.client.get("/api/dashboard/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tasks = response.data["tasks"]
        self.assertTrue(tasks)
        self.assertEqual(
            {task["targetModule"] for task in tasks},
            {"SUPERVISOR_APPOINTMENTS"},
        )
        self.assertTrue(all(task["waitingOn"] == "SUPERVISOR" for task in tasks))

    def test_action_feed_limits_results_to_twenty(self):
        timeline = SemesterTimeline.objects.create(
            semester="Semester 1",
            session="2026/2027",
            academic_semester=self.academic_semester,
            is_active=True,
            uploaded_by=self.office,
        )
        today = timezone.localdate()
        for index in range(25):
            SemesterTimelineEntry.objects.create(
                timeline=timeline,
                level=SemesterTimelineEntry.Level.P1,
                step=index + 1,
                title=f"Timeline action {index + 1}",
                detail=f"Timeline detail {index + 1}",
                action_owner="Office Staff",
                deadline_start=today,
                deadline_end=today,
                target_roles=["OFFICE_STAFF"],
                display_order=index,
            )
        from .calendar_publication import publication_state, publish_calendar
        publish_calendar(self.academic_semester, self.office, publication_state(timeline, self.office)['reviewToken'])
        self.authenticate(self.office)

        response = self.client.get("/api/dashboard/tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["tasks"]), 20)


class DashboardActionOrderingTests(SimpleTestCase):
    def test_action_priority_orders_deadlines_waiting_and_timeline(self):
        tasks = [
            {
                "id": "upcoming",
                "dueAt": "2026-07-30",
                "deadlineState": "UPCOMING",
                "waitingDays": None,
                "waitingSince": None,
                "targetModule": "MARKS",
                "status": "upcoming",
            },
            {
                "id": "active",
                "dueAt": "2026-07-28",
                "deadlineState": "UPCOMING",
                "waitingDays": None,
                "waitingSince": None,
                "targetModule": "DASHBOARD",
                "status": "active",
            },
            {
                "id": "waiting-new",
                "dueAt": None,
                "deadlineState": None,
                "waitingDays": 2,
                "waitingSince": "2026-07-21T00:00:00+08:00",
                "targetModule": "PANEL_APPOINTMENTS",
                "status": "pending",
            },
            {
                "id": "waiting-old",
                "dueAt": None,
                "deadlineState": None,
                "waitingDays": 8,
                "waitingSince": "2026-07-15T00:00:00+08:00",
                "targetModule": "SUPERVISOR_APPOINTMENTS",
                "status": "pending",
            },
            {
                "id": "due-today",
                "dueAt": "2026-07-23",
                "deadlineState": "DUE_TODAY",
                "waitingDays": None,
                "waitingSince": None,
                "targetModule": "MARKS",
                "status": "deadline",
            },
            {
                "id": "overdue",
                "dueAt": "2026-07-20",
                "deadlineState": "OVERDUE",
                "waitingDays": None,
                "waitingSince": None,
                "targetModule": "MARKS",
                "status": "overdue",
            },
        ]

        ordered = sorted(tasks, key=_sort_key)

        self.assertEqual(
            [task["id"] for task in ordered],
            [
                "overdue",
                "due-today",
                "waiting-old",
                "waiting-new",
                "active",
                "upcoming",
            ],
        )
