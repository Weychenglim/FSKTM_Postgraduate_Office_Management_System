from .test_write_helpers import with_version
from .test_write_helpers import submission_payload
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Lecturer, OfficeStaff, Student
from academics.models import AcademicSemester
from academics.test_capacity_helpers import publish_test_capacity_plan
from appointments.models import (
    PanelAppointment,
    PanelRecommendation,
    SupervisorApplication,
    SupervisorAppointment,
    StudentResearchProfile,
)

from .models import (
    EvaluationPeriod,
    EvaluationTask,
    EvaluationTaskOverrideAudit,
    MarkCorrectionAudit,
    MarkEntry,
    Rubric,
    RubricComponent,
)
from .serializers import MarkDraftSerializer, submit_entry
from .services import (
    MarksStateConflict,
    correct_submitted_marks,
    reopen_submitted_marks,
)

User = get_user_model()


class MarkEntryWorkflowTests(APITestCase):
    def setUp(self):
        self.lecturer = User.objects.create_user(
            email="marks-lecturer@example.com",
            password="password123",
            full_name="Dr. Marker",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.lecturer,
            staff_no="MK1001",
            department="Artificial Intelligence",
        )
        self.other_lecturer = User.objects.create_user(
            email="other-marker@example.com",
            password="password123",
            full_name="Dr. Other Marker",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.other_lecturer,
            staff_no="MK1002",
            department="Software Engineering",
        )
        self.office_admin = User.objects.create_user(
            email="marks-office@example.com",
            password="password123",
            full_name="Marks Administrator",
            role=User.Role.OFFICE_ADMIN,
            is_staff=False,
        )
        self.office_admin.user_permissions.add(Permission.objects.get(content_type__app_label='marks', codename='change_markentry'))
        OfficeStaff.objects.create(
            user=self.office_admin,
            staff_no="MO1001",
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
            created_by=self.office_admin,
            activated_at=timezone.now(),
        )
        self.student_user = User.objects.create_user(
            email="marks-student@example.com",
            password="password123",
            full_name="Evaluation Student",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=self.student_user,
            matric_no="MEA-MARK-001",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            intake_semester="Sem 1 2025/2026",
        )
        self.profile = StudentResearchProfile.objects.create(
            student=self.student_user,
            matric_no=self.student_user.student.matric_no,
            student_name=self.student_user.full_name,
            programme=self.student_user.student.programme,
            semester=self.student_user.student.intake_semester,
            proposed_topic="Reliable marks management",
            supervisor=self.other_lecturer,
        )
        self.rubric = Rubric.objects.create(
            name="Research Project Evaluation",
            code="RP-EVAL",
            is_active=True,
        )
        self.problem = RubricComponent.objects.create(
            rubric=self.rubric,
            code="problem_definition",
            name="Problem Definition",
            max_marks=Decimal("40.00"),
            display_order=1,
        )
        self.method = RubricComponent.objects.create(
            rubric=self.rubric,
            code="methodology",
            name="Methodology",
            max_marks=Decimal("60.00"),
            display_order=2,
        )
        self.period = EvaluationPeriod.objects.create(
            name="Semester 1 Evaluation",
            semester="Sem 1 2025/2026",
            academic_semester=self.academic_semester,
            rubric=self.rubric,
            is_open=True,
            opens_at=timezone.now() - timezone.timedelta(days=1),
            closes_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.task = EvaluationTask.objects.create(
            profile=self.profile,
            evaluator=self.lecturer,
            period=self.period,
        )
        publish_test_capacity_plan(self.academic_semester, self.office_admin)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def score_payload(self, problem="30.00", method="50.00"):
        return with_version(self.task, {
            "scores": [
                {
                    "componentId": self.problem.pk,
                    "marksAwarded": problem,
                    "feedback": "Problem feedback",
                },
                {
                    "componentId": self.method.pk,
                    "marksAwarded": method,
                    "feedback": "Method feedback",
                },
            ],
            "comments": "Overall comments",
        })

    def test_assigned_lecturer_can_save_draft_and_total_is_recalculated(self):
        self.authenticate(self.lecturer)

        response = self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "DRAFT SAVED")
        self.assertEqual(Decimal(response.data["totalMark"]), Decimal("80.00"))
        entry = MarkEntry.objects.get(task=self.task)
        self.assertEqual(entry.total_mark, Decimal("80.00"))

    def test_component_score_cannot_exceed_configured_maximum(self):
        self.authenticate(self.lecturer)

        response = self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(problem="41.00"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(MarkEntry.objects.filter(task=self.task).exists())

    def test_submission_requires_every_required_component(self):
        self.authenticate(self.lecturer)
        payload = self.score_payload()
        payload["scores"] = payload["scores"][:1]
        draft = self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            payload,
            format="json",
        )

        submitted = self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json')

        self.assertEqual(draft.status_code, status.HTTP_200_OK)
        self.assertEqual(submitted.status_code, status.HTTP_400_BAD_REQUEST)

    def test_submission_locks_record_without_an_approval_step(self):
        self.authenticate(self.lecturer)
        self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )

        submitted = self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json')
        self.assertEqual(submitted.status_code, status.HTTP_200_OK)
        self.assertEqual(submitted.data["status"], "SUBMITTED")

        locked_edit = self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(problem="31.00"),
            format="json",
        )
        self.assertEqual(locked_edit.status_code, status.HTTP_409_CONFLICT)

        duplicate_submit = self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json')
        self.assertEqual(
            duplicate_submit.status_code,
            status.HTTP_409_CONFLICT,
        )

    def test_marks_cannot_be_saved_before_or_after_submission_window(self):
        self.authenticate(self.lecturer)
        self.period.opens_at = timezone.now() + timezone.timedelta(days=1)
        self.period.closes_at = timezone.now() + timezone.timedelta(days=2)
        self.period.save(update_fields=["opens_at", "closes_at"])

        before_open = self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )

        self.period.opens_at = timezone.now() - timezone.timedelta(days=2)
        self.period.closes_at = timezone.now() - timezone.timedelta(days=1)
        self.period.save(update_fields=["opens_at", "closes_at"])
        after_close = self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )

        self.assertEqual(before_open.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(after_close.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(MarkEntry.objects.filter(task=self.task).exists())

    def test_draft_reloads_and_locks_period_before_window_check(self):
        stale_task = EvaluationTask.objects.select_related(
            "period__rubric",
        ).get(pk=self.task.pk)
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period.save(update_fields=["lifecycle_status"])
        serializer = MarkDraftSerializer(
            data=self.score_payload(),
            context={"task": stale_task},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with self.assertRaisesMessage(
            MarksStateConflict,
            "Marks can only be saved while the evaluation period is open.",
        ):
            serializer.save()

        self.assertFalse(MarkEntry.objects.filter(task=self.task).exists())

    def test_submission_reloads_and_locks_period_before_window_check(self):
        self.authenticate(self.lecturer)
        self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )
        stale_task = EvaluationTask.objects.select_related(
            "period__rubric",
        ).get(pk=self.task.pk)
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period.save(update_fields=["lifecycle_status"])

        with self.assertRaisesMessage(
            MarksStateConflict,
            "Marks can only be saved while the evaluation period is open.",
        ):
            submit_entry(stale_task)

        self.assertEqual(
            MarkEntry.objects.get(task=self.task).status,
            MarkEntry.Status.DRAFT,
        )

    def test_resaving_draft_removes_omitted_optional_score(self):
        optional = RubricComponent.objects.create(
            rubric=self.rubric,
            code="optional_impact",
            name="Optional Impact",
            max_marks=Decimal("10.00"),
            is_required=False,
            display_order=3,
        )
        self.authenticate(self.lecturer)
        initial = self.score_payload()
        initial["scores"].append(
            {
                "componentId": optional.pk,
                "marksAwarded": "8.00",
                "feedback": "Optional feedback",
            }
        )
        self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            initial,
            format="json",
        )

        response = self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry = MarkEntry.objects.get(task=self.task)
        self.assertFalse(entry.scores.filter(component=optional).exists())
        self.assertEqual(entry.total_mark, Decimal("80.00"))

    def test_unassigned_lecturer_cannot_view_or_edit_task(self):
        self.authenticate(self.other_lecturer)

        task_list = self.client.get("/api/marks/my-evaluation-tasks/")
        edit = self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )

        self.assertEqual(task_list.status_code, status.HTTP_200_OK)
        self.assertEqual(task_list.data, [])
        self.assertEqual(edit.status_code, status.HTTP_404_NOT_FOUND)

    def test_office_staff_correction_requires_reason_and_records_before_after(self):
        self.authenticate(self.lecturer)
        self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )
        self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json')
        entry = MarkEntry.objects.get(task=self.task)

        with self.assertRaises(ValidationError):
            correct_submitted_marks(
                entry=entry,
                actor=self.office_admin,
                score_values={self.problem.pk: Decimal("35.00")},
                reason="",
            )

        correct_submitted_marks(
            entry=entry,
            actor=self.office_admin,
            score_values={self.problem.pk: Decimal("35.00")},
            reason="Corrected transcription error.",
        )
        entry.refresh_from_db()

        self.assertEqual(entry.status, MarkEntry.Status.SUBMITTED)
        self.assertEqual(entry.total_mark, Decimal("85.00"))
        audit = MarkCorrectionAudit.objects.get()
        self.assertEqual(audit.actor, self.office_admin)
        self.assertEqual(audit.reason, "Corrected transcription error.")
        self.assertEqual(audit.before_values["totalMark"], "80.00")
        self.assertEqual(audit.after_values["totalMark"], "85.00")

    def test_submitted_comment_correction_requires_reason_and_is_audited(self):
        self.authenticate(self.lecturer)
        self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )
        self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json')
        entry = MarkEntry.objects.get(task=self.task)

        with self.assertRaisesMessage(
            ValidationError,
            "A correction reason is required.",
        ):
            correct_submitted_marks(
                entry=entry,
                actor=self.office_admin,
                score_values={},
                comments="Corrected comment",
                reason="",
            )

        correct_submitted_marks(
            entry=entry,
            actor=self.office_admin,
            score_values={},
            comments="Corrected comment",
            reason="Corrected the submitted narrative.",
        )
        entry.refresh_from_db()
        audit = MarkCorrectionAudit.objects.get()

        self.assertEqual(entry.comments, "Corrected comment")
        self.assertEqual(audit.before_values["comments"], "Overall comments")
        self.assertEqual(audit.after_values["comments"], "Corrected comment")

    def test_submitted_marks_admin_has_no_editable_fields(self):
        from django.contrib import admin
        from django.test import RequestFactory
        request = RequestFactory().get('/admin/marks/markentry/')
        request.user = self.office_admin
        model_admin = admin.site._registry[MarkEntry]
        self.assertFalse(model_admin.has_change_permission(request))
        self.assertEqual(model_admin.get_form(request).base_fields, {})

    def test_office_staff_can_reopen_submitted_marks_with_audit_reason(self):
        self.authenticate(self.lecturer)
        self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )
        self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json')
        entry = MarkEntry.objects.get(task=self.task)

        reopen_submitted_marks(
            entry=entry,
            actor=self.office_admin,
            reason="Lecturer requested a correction.",
        )
        entry.refresh_from_db()

        self.assertEqual(entry.status, MarkEntry.Status.DRAFT)
        self.assertEqual(entry.submitted_at, None)
        self.assertEqual(MarkCorrectionAudit.objects.get().action, "REOPEN")

    def test_office_staff_cannot_reopen_after_period_closes(self):
        self.authenticate(self.lecturer)
        self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )
        self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json')
        entry = MarkEntry.objects.get(task=self.task)
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period.save(update_fields=["lifecycle_status"])

        with self.assertRaisesMessage(
            ValidationError,
            "Marks may only be reopened while the evaluation period is open.",
        ):
            reopen_submitted_marks(
                entry=entry,
                actor=self.office_admin,
                reason="Lecturer requested a correction.",
            )

    def test_task_response_exposes_configurable_rubric_components(self):
        self.authenticate(self.lecturer)

        response = self.client.get("/api/marks/my-evaluation-tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["status"], "NOT STARTED")
        self.assertEqual(
            [item["maxMarks"] for item in response.data[0]["components"]],
            ["40.00", "60.00"],
        )

    def test_office_staff_can_generate_tasks_from_approved_panel_appointments(self):
        self.task.delete()
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            supervisor=self.other_lecturer,
            recommended_member=self.lecturer,
            status=PanelRecommendation.Status.APPROVED,
        )
        PanelAppointment.objects.create(
            recommendation=recommendation,
            profile=self.profile,
            supervisor=self.other_lecturer,
            panel_member=self.lecturer,
            approved_by=self.office_admin,
        )
        self.authenticate(self.office_admin)

        response = self.client.post(
            f"/api/marks/periods/{self.period.pk}/generate-tasks/"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["createdCount"], 1)
        self.assertTrue(
            EvaluationTask.objects.filter(
                profile=self.profile,
                evaluator=self.lecturer,
                period=self.period,
            ).exists()
        )

    def test_generation_creates_supervisor_and_panel_evaluation_tasks(self):
        self.task.delete()
        application = SupervisorApplication.objects.create(
            student=self.student_user.student,
            proposed_supervisor=self.other_lecturer,
            research_title=self.profile.proposed_topic,
            research_abstract="Supervisor marks required.",
            status=SupervisorApplication.Status.APPROVED,
        )
        SupervisorAppointment.objects.create(
            application=application,
            student=self.student_user.student,
            supervisor=self.other_lecturer,
            approved_by=self.office_admin,
        )
        recommendation = PanelRecommendation.objects.create(
            profile=self.profile,
            supervisor=self.other_lecturer,
            recommended_member=self.lecturer,
            status=PanelRecommendation.Status.APPROVED,
        )
        PanelAppointment.objects.create(
            recommendation=recommendation,
            profile=self.profile,
            supervisor=self.other_lecturer,
            panel_member=self.lecturer,
            approved_by=self.office_admin,
        )
        self.authenticate(self.office_admin)

        response = self.client.post(
            f"/api/marks/periods/{self.period.pk}/generate-tasks/"
        )
        repeated = self.client.post(
            f"/api/marks/periods/{self.period.pk}/generate-tasks/"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["createdCount"], 2)
        self.assertEqual(response.data["supervisorCreatedCount"], 1)
        self.assertEqual(response.data["panelCreatedCount"], 1)
        self.assertEqual(repeated.data["createdCount"], 0)
        self.assertTrue(
            EvaluationTask.objects.filter(
                profile=self.profile,
                evaluator=self.other_lecturer,
                period=self.period,
                evaluator_role=EvaluationTask.EvaluatorRole.SUPERVISOR,
            ).exists()
        )

    def test_task_generation_rejects_draft_and_ended_periods(self):
        self.authenticate(self.office_admin)
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.DRAFT
        self.period.save(update_fields=["lifecycle_status"])
        draft_response = self.client.post(
            f"/api/marks/periods/{self.period.pk}/generate-tasks/"
        )

        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.PUBLISHED
        self.period.opens_at = timezone.now() - timezone.timedelta(days=2)
        self.period.closes_at = timezone.now() - timezone.timedelta(days=1)
        self.period.save(update_fields=["lifecycle_status", "opens_at", "closes_at"])
        ended_response = self.client.post(
            f"/api/marks/periods/{self.period.pk}/generate-tasks/"
        )

        self.assertEqual(
            draft_response.status_code,
            status.HTTP_409_CONFLICT,
        )
        self.assertEqual(
            ended_response.status_code,
            status.HTTP_409_CONFLICT,
        )
        self.assertTrue(
            EvaluationTask.objects.filter(
                profile=self.profile,
                evaluator=self.lecturer,
                period=self.period,
                evaluator_role=EvaluationTask.EvaluatorRole.PANEL,
            ).exists()
        )

    def test_active_period_safety_generation_runs_when_lecturer_loads_tasks(self):
        self.task.delete()
        application = SupervisorApplication.objects.create(
            student=self.student_user.student,
            proposed_supervisor=self.other_lecturer,
            research_title=self.profile.proposed_topic,
            research_abstract="Supervisor marks required.",
            status=SupervisorApplication.Status.APPROVED,
        )
        SupervisorAppointment.objects.create(
            application=application,
            student=self.student_user.student,
            supervisor=self.other_lecturer,
            approved_by=self.office_admin,
        )
        self.authenticate(self.other_lecturer)

        response = self.client.get("/api/marks/my-evaluation-tasks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["evaluatorRole"], "SUPERVISOR")
        task = EvaluationTask.objects.get()
        self.assertIsNone(task.assigned_by)

    def test_office_staff_can_create_backup_evaluator_with_audit_reason(self):
        self.authenticate(self.office_admin)

        response = self.client.post(
            f"/api/marks/periods/{self.period.pk}/manual-overrides/",
            {
                "studentId": self.profile.matric_no,
                "evaluatorId": self.other_lecturer.pk,
                "reason": "Panel member is unavailable.",
                "originalTaskId": self.task.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["evaluatorRole"], "BACKUP")
        task = EvaluationTask.objects.get(pk=response.data["id"])
        self.assertEqual(task.evaluator, self.other_lecturer)
        audit = EvaluationTaskOverrideAudit.objects.get(task=task)
        self.assertEqual(audit.actor, self.office_admin)
        self.assertEqual(audit.original_evaluator, self.lecturer)
        self.assertEqual(audit.new_evaluator, self.other_lecturer)
        self.assertEqual(audit.reason, "Panel member is unavailable.")

    def test_backup_evaluator_requires_office_staff_and_reason(self):
        self.authenticate(self.office_admin)
        missing_reason = self.client.post(
            f"/api/marks/periods/{self.period.pk}/manual-overrides/",
            {
                "studentId": self.profile.matric_no,
                "evaluatorId": self.other_lecturer.pk,
                "reason": " ",
            },
            format="json",
        )
        self.authenticate(self.lecturer)
        wrong_user = self.client.post(
            f"/api/marks/periods/{self.period.pk}/manual-overrides/",
            {
                "studentId": self.profile.matric_no,
                "evaluatorId": self.other_lecturer.pk,
                "reason": "Panel member is unavailable.",
            },
            format="json",
        )

        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(wrong_user.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            EvaluationTask.objects.filter(
                evaluator_role=EvaluationTask.EvaluatorRole.BACKUP
            ).exists()
        )

    def test_backup_evaluator_rejects_closed_period(self):
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period.save(update_fields=["lifecycle_status"])
        self.authenticate(self.office_admin)

        response = self.client.post(
            f"/api/marks/periods/{self.period.pk}/manual-overrides/",
            {
                "studentId": self.profile.matric_no,
                "evaluatorId": self.other_lecturer.pk,
                "reason": "Panel member is unavailable.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(
            EvaluationTask.objects.filter(
                evaluator_role=EvaluationTask.EvaluatorRole.BACKUP
            ).exists()
        )

    def test_office_staff_can_list_evaluation_periods_with_task_totals(self):
        MarkEntry.objects.create(
            task=self.task,
            status=MarkEntry.Status.SUBMITTED,
            total_mark=Decimal("88.00"),
        )
        EvaluationTask.objects.create(
            profile=self.profile,
            evaluator=self.other_lecturer,
            period=self.period,
            evaluator_role=EvaluationTask.EvaluatorRole.BACKUP,
            assigned_by=self.office_admin,
        )
        self.authenticate(self.office_admin)

        response = self.client.get("/api/marks/periods/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["id"], self.period.pk)
        self.assertEqual(response.data[0]["name"], "Semester 1 Evaluation")
        self.assertEqual(response.data[0]["rubricName"], "Research Project Evaluation")
        self.assertEqual(response.data[0]["taskTotals"]["total"], 2)
        self.assertEqual(response.data[0]["taskTotals"]["panel"], 1)
        self.assertEqual(response.data[0]["taskTotals"]["backup"], 1)
        self.assertEqual(response.data[0]["taskTotals"]["submitted"], 1)
        self.assertEqual(response.data[0]["taskTotals"]["incomplete"], 1)

    def test_non_office_users_cannot_list_assignment_options(self):
        self.authenticate(self.lecturer)

        periods = self.client.get("/api/marks/periods/")
        options = self.client.get("/api/marks/assignment-options/")

        self.assertEqual(periods.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(options.status_code, status.HTTP_403_FORBIDDEN)

    def test_office_staff_can_load_assignment_options_for_real_forms(self):
        self.authenticate(self.office_admin)

        response = self.client.get("/api/marks/assignment-options/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["students"][0]["studentId"], self.profile.matric_no
        )
        self.assertEqual(
            response.data["students"][0]["studentName"], self.profile.student_name
        )
        lecturer_ids = {item["userId"] for item in response.data["lecturers"]}
        self.assertIn(self.lecturer.pk, lecturer_ids)
        self.assertIn(self.other_lecturer.pk, lecturer_ids)
        self.assertEqual(response.data["tasks"][0]["taskId"], self.task.pk)
        self.assertEqual(response.data["tasks"][0]["periodId"], self.period.pk)
        self.assertEqual(
            response.data["tasks"][0]["evaluatorRole"],
            EvaluationTask.EvaluatorRole.PANEL,
        )

    def test_office_staff_can_monitor_persisted_mark_records(self):
        MarkEntry.objects.create(
            task=self.task,
            status=MarkEntry.Status.DRAFT,
            total_mark=Decimal("0.00"),
        )
        self.authenticate(self.office_admin)

        response = self.client.get("/api/marks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["periodId"], self.period.pk)
        self.assertEqual(response.data[0]["periodName"], self.period.name)
        self.assertEqual(response.data[0]["periodLifecycleStatus"], self.period.lifecycle_status)
        self.assertEqual(response.data[0]["studentId"], "MEA-MARK-001")
        self.assertEqual(response.data[0]["status"], "Draft")

    def test_office_staff_mark_records_show_overdue_for_unsubmitted_closed_period_tasks(
        self,
    ):
        self.period.closes_at = timezone.now() - timezone.timedelta(days=1)
        self.period.save(update_fields=["closes_at"])
        self.authenticate(self.office_admin)

        response = self.client.get("/api/marks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["studentId"], "MEA-MARK-001")
        self.assertEqual(response.data[0]["status"], "Overdue")

    def test_office_staff_mark_records_keep_submitted_status_after_period_closes(self):
        self.period.closes_at = timezone.now() - timezone.timedelta(days=1)
        self.period.save(update_fields=["closes_at"])
        MarkEntry.objects.create(
            task=self.task,
            status=MarkEntry.Status.SUBMITTED,
            total_mark=Decimal("88.00"),
            submitted_at=timezone.now(),
        )
        self.authenticate(self.office_admin)

        response = self.client.get("/api/marks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["status"], "Submitted")

    def test_students_cannot_monitor_mark_records(self):
        self.authenticate(self.student_user)

        response = self.client.get("/api/marks/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_office_staff_can_view_complete_persisted_mark_record_detail(self):
        self.authenticate(self.lecturer)
        self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/",
            self.score_payload(),
            format="json",
        )
        self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json')
        entry = MarkEntry.objects.get(task=self.task)
        correct_submitted_marks(
            entry=entry,
            actor=self.office_admin,
            score_values={self.problem.pk: Decimal("35.00")},
            reason="Corrected transcription error.",
        )
        self.authenticate(self.office_admin)

        response = self.client.get(f"/api/marks/records/MRK-{self.task.pk:05d}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["recordId"], f"MRK-{self.task.pk:05d}")
        self.assertEqual(response.data["taskId"], self.task.pk)
        self.assertEqual(response.data["student"]["studentId"], "MEA-MARK-001")
        self.assertEqual(response.data["evaluator"]["name"], "Dr. Marker")
        self.assertEqual(response.data["period"]["lifecycleStatus"], "PUBLISHED")
        self.assertEqual(response.data["rubric"]["version"], 1)
        self.assertEqual(response.data["entry"]["status"], "SUBMITTED")
        self.assertEqual(response.data["entry"]["totalMark"], "85.00")
        self.assertTrue(response.data["entry"]["isLocked"])
        self.assertEqual(len(response.data["rubric"]["components"]), 2)
        self.assertEqual(
            response.data["correctionHistory"][0]["reason"],
            "Corrected transcription error.",
        )
        self.assertEqual(response.data["overrideHistory"], [])

    def test_mark_record_detail_is_office_only_and_unknown_records_return_not_found(
        self,
    ):
        self.authenticate(self.lecturer)
        forbidden = self.client.get(f"/api/marks/records/MRK-{self.task.pk:05d}/")
        self.authenticate(self.office_admin)
        missing = self.client.get("/api/marks/records/MRK-99999/")

        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)
