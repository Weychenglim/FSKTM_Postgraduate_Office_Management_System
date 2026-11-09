from .test_write_helpers import submission_payload
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

from django.test import override_settings
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from .models import EvaluationTask, MarkEntry, MarkScore
from . import tests as fixture


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class LecturerSubmissionHistoryTests(APITestCase):
    setUp = fixture.MarkEntryWorkflowTests.setUp
    url = "/api/marks/my-submitted-evaluations/"

    def submitted(self, task, when=None):
        entry = MarkEntry.objects.create(
            task=task, status="SUBMITTED", total_mark=Decimal("80.00"),
            comments="Retained evaluation", submitted_at=when or datetime(2026, 1, 2, 4, tzinfo=dt_timezone.utc),
        )
        for component, score in [(self.problem, "30.00"), (self.method, "50.00")]:
            MarkScore.objects.create(entry=entry, component=component, marks_awarded=score, feedback="Retained feedback")
        return entry

    def task_for(self, role, lifecycle="ACTIVE", evaluator=None):
        return EvaluationTask.objects.create(
            profile=self.profile, evaluator=evaluator or self.lecturer, period=self.period,
            evaluator_role=role, lifecycle_status=lifecycle,
        )

    def test_retained_submissions_include_all_roles_and_assignment_lifecycles(self):
        self.submitted(self.task)
        paused = self.task_for("SUPERVISOR", "PAUSED")
        retired = self.task_for("BACKUP", "RETIRED")
        self.submitted(paused)
        self.submitted(retired)
        self.period.lifecycle_status = "ARCHIVED"
        self.period.save(update_fields=["lifecycle_status"])
        self.client.force_authenticate(self.lecturer)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual({row["id"] for row in response.data}, {self.task.pk, paused.pk, retired.pk})
        self.assertEqual({row["evaluatorRole"] for row in response.data}, {"SUPERVISOR", "PANEL", "BACKUP"})
        by_id = {row["id"]: row for row in response.data}
        self.assertEqual(by_id[retired.pk]["taskLifecycleStatus"], "RETIRED")
        for row in response.data:
            self.assertFalse(row["canEdit"])
            self.assertFalse(row["canSubmit"])
            self.assertEqual(row["status"], "SUBMITTED")
            self.assertEqual(row["totalMark"], "80.00")
            self.assertEqual([score["marksAwarded"] for score in row["components"]], ["30.00", "50.00"])
            self.assertEqual(row["periodName"], self.period.name)
            self.assertEqual(row["periodId"], self.period.pk)
            self.assertEqual(row["rubricName"], self.rubric.name)
            self.assertEqual(row["rubricVersion"], self.rubric.version)

    def test_only_own_currently_submitted_entries_are_returned_newest_first(self):
        older = self.submitted(self.task, datetime(2025, 12, 30, tzinfo=dt_timezone.utc))
        newer_task = self.task_for("SUPERVISOR", "RETIRED")
        newer = self.submitted(newer_task)
        draft = self.task_for("BACKUP")
        MarkEntry.objects.create(task=draft, status="DRAFT", submitted_at=newer.submitted_at)
        self.task_for("SUPERVISOR")  # Not started.
        other = self.task_for("PANEL", evaluator=self.other_lecturer)
        self.submitted(other)
        self.client.force_authenticate(self.lecturer)
        response = self.client.get(f"{self.url}?evaluator={self.other_lecturer.pk}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [newer_task.pk, self.task.pk])
        self.assertEqual(parse_datetime(response.data[0]["submittedAt"]), newer.submitted_at)
        self.assertEqual(parse_datetime(response.data[1]["submittedAt"]), older.submitted_at)

    def test_history_reads_never_generate_tasks_or_change_scores(self):
        entry = self.submitted(self.task)
        before = (EvaluationTask.objects.count(), MarkEntry.objects.count(), list(entry.scores.values()))
        self.client.force_authenticate(self.lecturer)
        with patch("marks.views.ensure_active_period_tasks") as generate:
            for _ in range(2):
                response = self.client.get(self.url)
                self.assertEqual(response.status_code, 200)
            generate.assert_not_called()
        self.assertEqual((EvaluationTask.objects.count(), MarkEntry.objects.count(), list(entry.scores.values())), before)

    def test_history_is_lecturer_only_and_get_only(self):
        self.assertIn(self.client.get(self.url).status_code, [401, 403])
        for user in [self.office_admin, self.student_user]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.client.post(self.url, {}).status_code, 405)

    def test_history_does_not_reenable_retired_assignment_writes(self):
        self.task.lifecycle_status = "RETIRED"
        self.task.save(update_fields=["lifecycle_status"])
        self.submitted(self.task)
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertEqual(self.client.put(f"/api/marks/tasks/{self.task.pk}/draft/", {}, format="json").status_code, 404)
        self.assertEqual(self.client.post(f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json').status_code, 404)

    def test_empty_history_is_a_successful_empty_list(self):
        self.client.force_authenticate(self.lecturer)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_queue_and_history_use_the_same_submission_instant_at_malaysia_midnight(self):
        instant = datetime(2026, 1, 1, 17, 30, tzinfo=dt_timezone.utc)
        self.submitted(self.task, instant)
        self.client.force_authenticate(self.lecturer)
        history = self.client.get(self.url)
        queue = self.client.get('/api/marks/my-evaluation-tasks/')
        self.assertEqual(queue.status_code, 200)
        row = next(row for row in queue.data if row['id'] == self.task.pk)
        self.assertEqual(row.get('submittedAt'), history.data[0]['submittedAt'])
        self.assertEqual(row['submittedDate'], '02 Jan 2026')
        for key in ['periodName', 'rubricName', 'rubricVersion', 'opensAt', 'closesAt', 'assignedAt']:
            self.assertEqual(row[key], history.data[0][key])
        self.assertEqual(row['periodName'], self.period.name)
        self.assertEqual(row['rubricName'], self.rubric.name)
        self.assertEqual(parse_datetime(row['assignedAt']), self.task.assigned_at)

    def test_unknown_submission_dates_sort_after_known_dates(self):
        self.submitted(self.task)
        historical = self.task_for("SUPERVISOR", "RETIRED")
        entry = self.submitted(historical)
        MarkEntry.objects.filter(pk=entry.pk).update(submitted_at=None)
        self.client.force_authenticate(self.lecturer)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [self.task.pk, historical.pk])
        self.assertIsNone(response.data[-1]["submittedAt"])

    def test_office_records_use_the_same_malaysia_submission_day_as_lecturer_history(self):
        self.submitted(self.task, datetime(2026, 1, 1, 17, 30, tzinfo=dt_timezone.utc))
        self.client.force_authenticate(self.lecturer)
        history = self.client.get(self.url)
        self.assertEqual(history.data[0]['submittedDate'], '02 Jan 2026')
        self.client.force_authenticate(self.office_admin)
        records = self.client.get('/api/marks/')
        self.assertEqual(records.status_code, 200)
        record = next(row for row in records.data if row['id'] == f'MRK-{self.task.pk:05d}')
        self.assertEqual(record['submittedDate'], history.data[0]['submittedDate'])

    def test_history_prefetches_scores_and_components_without_per_record_queries(self):
        for _ in range(8):
            self.submitted(self.task_for("SUPERVISOR", "RETIRED"))
        self.client.force_authenticate(self.lecturer)
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 8)
        self.assertLessEqual(len(queries), 6)
