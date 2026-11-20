"""Operational tracking excludes stage-blocked work without losing evidence."""
from types import SimpleNamespace
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from announcements.connected_reminders import marks_notices
from marks import test_stage_corrections as fixtures
from marks.closure_preview import period_closure_preview
from marks.completion_windows import task_access
from marks.models import EvaluationTaskLifecycleAudit
from marks.views import period_task_totals
from .dossiers import _attention, _marks_records
from .actions import _mark_actions
from .reports import _mark_rows, _marks_summary


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class RPStageTrackingTests(APITestCase):
    setUp = fixtures.StageCorrectionTests.setUp
    user = fixtures.StageCorrectionTests.user
    lecturer = fixtures.StageCorrectionTests.lecturer
    profile = fixtures.StageCorrectionTests.profile
    payload = fixtures.StageCorrectionTests.payload
    period = fixtures.StageCorrectionTests.period
    publish = fixtures.StageCorrectionTests.publish
    setup_tasks = fixtures.StageCorrectionTests.setup_tasks
    task = fixtures.StageCorrectionTests.task

    def prepare(self, *, stage='P2', held=False, state='DRAFT', overdue=True):
        self.setup_tasks()
        self.now = timezone.now()
        self.period_obj.closes_at = self.now + timezone.timedelta(days=-1 if overdue else 1)
        self.period_obj.save(update_fields=['closes_at'])
        self.row = self.task(state=state)
        if held:
            EvaluationTaskLifecycleAudit.objects.create(task=self.row, actor=self.office,
                action='STAGE_REVIEW', reason='Academic review outstanding', entry_snapshot={})
        lookup = patch('marks.stage_eligibility.project_stages', return_value={
            self.student.pk: SimpleNamespace(state='ON_PROJECT', stage=stage, reason='')})
        lookup.start()
        self.addCleanup(lookup.stop)

    def report_rows(self):
        return _mark_rows(self.office, None, None, None, self.now, 'all', None)

    def test_wrong_stage_work_is_not_normal_report_or_period_work(self):
        self.prepare()
        self.assertEqual(self.report_rows(), [])
        totals = period_task_totals(self.period_obj)
        self.assertEqual((totals['total'], totals['incomplete'], totals['overdue']), (0, 0, 0))
        self.row.refresh_from_db()
        self.assertEqual(self.row.lifecycle_status, 'ACTIVE')
        self.assertEqual(self.row.mark_entry.comments, 'Keep my comments')

    def test_homepage_counts_and_actions_exclude_stage_blocked_work(self):
        self.prepare()
        self.client.force_authenticate(self.supervisor)
        response = self.client.get('/api/dashboard/summary/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['incompleteMarkEntries'], 0)
        self.assertEqual(response.data['overdueMarkEntries'], 0)
        self.assertEqual(_mark_actions(self.supervisor, self.now), [])

    def test_blocked_dossier_keeps_record_without_overdue_alert_or_denominator(self):
        self.prepare()
        marks = _marks_records(self.person, self.office, 'INTERNAL', self.now)
        self.assertIsNone(marks['summaryStatus'])
        self.assertIsNone(marks['completionRate'])
        self.assertEqual(len(marks['tasks']), 1)
        self.assertEqual(marks['tasks'][0]['status'], 'REVIEW_REQUIRED')
        self.assertEqual(_attention(None, None, marks, None, 'INTERNAL'), [])

    def test_matching_but_review_held_task_is_not_counted_or_reminded(self):
        self.prepare(stage='P1', held=True, overdue=False)
        self.assertEqual(self.report_rows(), [])
        self.assertEqual(period_task_totals(self.period_obj)['incomplete'], 0)
        self.assertEqual(marks_notices(self.now, 3), [])
        access = task_access(self.row, self.now)
        self.assertFalse(access['canSubmit'])
        self.assertFalse(access['canGrantCompletionWindow'])
        self.client.force_authenticate(self.supervisor)
        self.assertEqual(self.client.get('/api/dashboard/summary/').data['incompleteMarkEntries'], 0)
        self.assertEqual(_mark_actions(self.supervisor, self.now), [])

    def test_submitted_evidence_stays_in_reports_despite_stage_review(self):
        self.prepare(state='SUBMITTED', held=True)
        rows = self.report_rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['status'], 'SUBMITTED')
        self.assertEqual(_marks_summary(rows)['completionRate'], 100.0)
        self.assertEqual(period_task_totals(self.period_obj)['submitted'], 1)
        marks = _marks_records(self.person, self.office, 'INTERNAL', self.now)
        self.assertEqual(marks['summaryStatus'], 'SUBMITTED')
        self.assertEqual(marks['tasks'][0]['status'], 'SUBMITTED')
        self.assertTrue(self.row.lifecycle_audits.filter(action='STAGE_REVIEW').exists())
        self.assertEqual(marks_notices(self.now, 3), [])

    def test_matching_open_work_still_counts_and_receives_reminders(self):
        self.prepare(stage='P1', overdue=False)
        self.assertEqual(len(self.report_rows()), 1)
        self.assertEqual(period_task_totals(self.period_obj)['incomplete'], 1)
        self.assertTrue(marks_notices(self.now, 3))
        self.assertTrue(task_access(self.row, self.now)['canSubmit'])

    def test_review_hold_does_not_remove_unfinished_closure_acknowledgement(self):
        self.prepare(stage='P1', held=True)
        preview = period_closure_preview(self.period_obj)
        self.assertEqual(preview['totals']['unfinished'], 1)
        self.assertTrue(preview['requiresAcknowledgement'])

    def test_paused_and_retired_history_remain_outside_normal_totals(self):
        self.prepare(stage='P1')
        for lifecycle in ('PAUSED', 'RETIRED'):
            with self.subTest(lifecycle=lifecycle):
                self.row.lifecycle_status = lifecycle
                self.row.save(update_fields=['lifecycle_status'])
                self.assertEqual(self.report_rows(), [])
                self.assertEqual(period_task_totals(self.period_obj)['total'], 0)
                marks = _marks_records(self.person, self.office, 'INTERNAL', self.now)
                self.assertEqual(marks['tasks'][0]['status'], lifecycle)
                self.assertIsNone(marks['completionRate'])
                self.assertEqual(marks_notices(self.now, 3), [])
