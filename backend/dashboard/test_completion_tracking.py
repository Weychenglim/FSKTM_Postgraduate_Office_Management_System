from datetime import timedelta
from io import BytesIO

from django.test import override_settings
from openpyxl import load_workbook
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from appointments.models import PanelAppointment
from marks.models import EvaluationPeriod, EvaluationTask
from . import test_reports as fixture


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CompletionWindowTrackingTests(APITestCase):
    _user = fixture.WorkflowReportTests._user
    _lecturer = fixture.WorkflowReportTests._lecturer
    _student = fixture.WorkflowReportTests._student

    def setUp(self):
        fixture.WorkflowReportTests.setUp(self)
        self.office.is_staff = True
        self.office.save(update_fields=["is_staff"])
        PanelAppointment.objects.create(
            recommendation=self.pending_panel, profile=self.profile,
            supervisor=self.supervisor, panel_member=self.panel, approved_by=self.office,
        )
        self.deadline = self.now + timedelta(days=3)
        self.client.force_authenticate(self.office)

    def grant(self):
        response = self.client.post("/api/marks/completion-windows/", {
            "taskIds": [self.mark_task.pk], "deadline": self.deadline.isoformat(),
            "reason": "Approved individual completion time",
        }, format="json")
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))

    def close_semester(self):
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period.save()
        self.academic_semester.lifecycle_status = AcademicSemester.Lifecycle.CLOSED
        self.academic_semester.save()

    def test_closed_work_requires_review_instead_of_automatic_retirement(self):
        from .reconciliation import _detect_marks_issues
        self.close_semester()
        issues = [i for i in _detect_marks_issues() if i.record_id == str(self.mark_task.pk)
                  and i.record_type == "EVALUATION_TASK"]
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].repairability, "REVIEW_REQUIRED")
        self.assertNotEqual(issues[0].suggestion.get("action"), "RETIRE_MARKS_TASK")

    def test_extension_updates_counts_report_dossier_and_export(self):
        self.grant()
        summary = self.client.get("/api/dashboard/summary/")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["overdueMarkEntries"], 0)
        report = self.client.get("/api/dashboard/reports/")
        self.assertEqual(report.data["overview"]["overdueMarks"], 0)
        dossier = self.client.get(f"/api/dashboard/progress/{self.student.matric_no}/")
        row = dossier.data["marks"]["tasks"][0]
        self.assertEqual(row["dueAt"], self.deadline.isoformat())
        self.assertEqual(row["deadlineState"], "UPCOMING")
        exported = self.client.get("/api/dashboard/reports/export/")
        self.assertEqual(exported.status_code, 200)
        workbook = load_workbook(BytesIO(exported.content), read_only=True)
        values = [str(value) for sheet in workbook for row in sheet.values for value in row]
        self.assertIn(self.deadline.isoformat(), values)

    def test_closed_semester_window_remains_actionable_and_scoped(self):
        from .actions import build_dashboard_tasks
        from .reconciliation import _detect_marks_issues
        self.close_semester()
        self.grant()
        actions = build_dashboard_tasks(self.panel, now=self.now)
        self.assertIn(f"marks_{self.mark_task.pk}", [row["id"] for row in actions])
        self.assertNotIn(f"marks_{self.mark_task.pk}",
                         [row["id"] for row in build_dashboard_tasks(self.foreign_panel)])
        self.assertFalse(any(i.record_type == "EVALUATION_TASK"
                             and i.record_id == str(self.mark_task.pk)
                             for i in _detect_marks_issues()))
        self.client.force_authenticate(self.coordinator)
        self.assertIsNone(self.client.get("/api/dashboard/reports/").data["marks"])
        self.client.force_authenticate(self.student_user)
        public = self.client.get(f"/api/dashboard/progress/{self.student.matric_no}/").data
        self.assertNotIn("Approved individual completion time", str(public))
