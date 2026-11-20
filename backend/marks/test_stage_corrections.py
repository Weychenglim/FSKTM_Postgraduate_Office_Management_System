"""Atomic Registry/Marks correction contract, through the coordinator workflow."""
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Coordinator, Lecturer, ProjectRegistration, ProjectRegistrationChange, User
from accounts.project_stages import StageConflict, change_stages, preview_change, project_stages, shown
from . import test_period_targeting as fixtures
from .models import EvaluationTask, EvaluationTaskLifecycleAudit, MarkEntry, MarkScore, TaskCompletionWindow
from .services import MarksStateConflict, ensure_period_tasks, resume_student_evaluation_tasks


def coordinator_for(test, programme):
    user = test.user('stage-coordinator', User.Role.COORDINATOR)
    lecturer = Lecturer.objects.create(user=user, staff_no='STAGE-COORD')
    Coordinator.objects.create(lecturer=lecturer, programme_managed=programme)
    return user


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class StageCorrectionTests(APITestCase):
    setUp = fixtures.PeriodTargetingTests.setUp
    user = fixtures.PeriodTargetingTests.user
    lecturer = fixtures.PeriodTargetingTests.lecturer
    profile = fixtures.PeriodTargetingTests.profile
    payload = fixtures.PeriodTargetingTests.payload
    period = fixtures.PeriodTargetingTests.period
    publish = fixtures.PeriodTargetingTests.publish

    def setup_tasks(self):
        self.person = self.profile('correction')
        self.period_obj = self.period(evaluatorRoles=['SUPERVISOR'])
        self.publish(self.period_obj)
        self.student = self.person.student.student
        self.record = ProjectRegistration.objects.get(student=self.student)
        self.coordinator = coordinator_for(self, self.student.programme)

    def task(self, *, state=None, lifecycle='ACTIVE', period=None):
        task = EvaluationTask.objects.create(profile=self.person, evaluator=self.supervisor,
            period=period or self.period_obj, evaluator_role='SUPERVISOR', lifecycle_status=lifecycle,
            pause_reason='Original leave reason' if lifecycle == 'PAUSED' else '')
        if state:
            MarkEntry.objects.create(task=task, status=state, comments='Keep my comments',
                submitted_at=timezone.now() if state == 'SUBMITTED' else None)
        return task

    def impact(self, stage='P2'):
        return preview_change(self.semester, self.student, stage, self.coordinator)

    def correct(self, stage='P2', impact=None, expected=None):
        if expected is None:
            expected = shown(project_stages(self.semester, [self.student.pk])[self.student.pk])
        return change_stages(self.semester, [(self.student.matric_no, expected)],
            choice=stage, reason='WRONG_ANSWER', actor=self.coordinator, checked=True,
            token=(impact if impact is not None else self.impact(stage))['token'])

    def test_all_task_states_and_other_stage_are_classified_and_applied(self):
        self.setup_tasks()
        empty = self.task()
        draft = self.task(state='DRAFT', lifecycle='PAUSED')
        submitted = self.task(state='SUBMITTED', lifecycle='PAUSED')
        component = self.rubric.components.get()
        score = MarkScore.objects.create(entry=submitted.mark_entry, component=component,
            marks_awarded='81.00', feedback='Original feedback')
        matching_period = self.period(assessment='P2', evaluatorRoles=['SUPERVISOR'])
        matching = self.task(period=matching_period)
        legacy_period = self.period()
        legacy_period.assessment = ''
        legacy_period.save(update_fields=['assessment'])
        legacy = self.task(period=legacy_period)
        impact = self.impact()
        self.assertEqual((impact['notStarted'], impact['draft'], impact['submitted']), (2, 1, 1))
        self.correct(impact=impact)
        empty.refresh_from_db(); draft.refresh_from_db(); submitted.refresh_from_db(); matching.refresh_from_db()
        self.assertEqual(empty.lifecycle_status, 'RETIRED')
        self.assertEqual(draft.pause_reason, 'Original leave reason')
        self.assertEqual(submitted.mark_entry.status, 'SUBMITTED')
        self.assertEqual(submitted.mark_entry.comments, 'Keep my comments')
        score.refresh_from_db()
        self.assertEqual((str(score.marks_awarded), score.feedback), ('81.00', 'Original feedback'))
        self.assertEqual(matching.lifecycle_status, 'ACTIVE')
        self.assertTrue(EvaluationTaskLifecycleAudit.objects.filter(task=submitted, action='STAGE_REVIEW').exists())
        self.assertTrue(legacy.lifecycle_audits.filter(action='STAGE_REVIEW').exists())
        change = ProjectRegistrationChange.objects.latest('pk')
        self.assertEqual(change.impact, {'notStarted': 2, 'draft': 1, 'submitted': 1})
        with self.assertRaises(PermissionError):
            change.delete()
        with self.assertRaises(PermissionError):
            ProjectRegistrationChange.objects.all().update(reason='rewrite')

    def test_active_draft_is_paused_and_window_invalidated(self):
        self.setup_tasks()
        draft = self.task(state='DRAFT')
        window = TaskCompletionWindow.objects.create(task=draft, granted_by=self.office,
            reason='Finish', deadline=timezone.now()+timezone.timedelta(days=10))
        self.correct()
        draft.refresh_from_db(); window.refresh_from_db()
        self.assertEqual(draft.lifecycle_status, 'PAUSED')
        self.assertEqual(window.end_kind, 'INVALIDATED')
        self.assertEqual(draft.mark_entry.comments, 'Keep my comments')
        self.assertTrue(draft.lifecycle_audits.filter(action='PAUSED').exists())

    def test_preview_changes_on_draft_edit_submission_and_new_task(self):
        self.setup_tasks()
        draft = self.task(state='DRAFT')
        for mutate in (
            lambda: MarkEntry.objects.filter(task=draft).update(comments='Changed draft'),
            lambda: MarkEntry.objects.filter(task=draft).update(status='SUBMITTED'),
            lambda: self.task(lifecycle='PAUSED'),
        ):
            impact = self.impact()
            mutate()
            with self.assertRaises(StageConflict):
                self.correct(impact=impact)
            self.record.refresh_from_db()
            self.assertEqual(self.record.revision, 1)
        self.assertFalse(ProjectRegistrationChange.objects.exists())

    def test_bulk_skips_affected_first_override_but_changes_safe_rows(self):
        self.setup_tasks(); self.task(state='DRAFT')
        self.record.delete()
        self.profile('safe', appointed=False)
        result = change_stages(self.semester, [('correction', 'P1'), ('safe', 'P1')],
            choice='P2', reason='WRONG_ANSWER', actor=self.coordinator)
        self.assertEqual(result['changed'], ['safe'])
        self.assertEqual(result['leftOut'][0]['matric'], 'correction')
        self.assertFalse(ProjectRegistration.objects.filter(student=self.student).exists())

    def test_individual_review_can_set_first_override_over_existing_tasks(self):
        self.setup_tasks(); task = self.task()
        self.record.delete()
        self.correct()
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, 'RETIRED')
        self.assertEqual(ProjectRegistration.objects.get(student=self.student).stage, 'P2')

    def test_failure_rolls_back_registration_lifecycle_and_windows(self):
        self.setup_tasks(); task = self.task(state='DRAFT')
        window = TaskCompletionWindow.objects.create(task=task, granted_by=self.office,
            reason='Finish', deadline=timezone.now()+timezone.timedelta(days=10))
        from accounts.project_stage_marks import apply_marks

        def fail_after_cleanup(*args, **kwargs):
            apply_marks(*args, **kwargs)
            raise RuntimeError('Cleanup failed')

        with patch('accounts.project_stages.apply_marks', side_effect=fail_after_cleanup):
            with self.assertRaisesRegex(RuntimeError, 'Cleanup failed'):
                self.correct()
        self.record.refresh_from_db(); task.refresh_from_db()
        self.assertEqual((self.record.stage, self.record.revision, task.lifecycle_status), ('P1', 1, 'ACTIVE'))
        self.assertFalse(ProjectRegistrationChange.objects.exists())
        window.refresh_from_db()
        self.assertIsNone(window.ended_at)
        self.assertFalse(task.lifecycle_audits.exists())

    def test_unrelated_retirement_does_not_clear_stage_review(self):
        from .services import retire_participant_evaluation_tasks
        from .stage_corrections import stage_review_pending
        self.setup_tasks(); task = self.task(state='DRAFT')
        self.correct()
        retire_participant_evaluation_tasks(tasks=EvaluationTask.objects.filter(pk=task.pk),
            actor=self.office, reason='Participant withdrew')
        task.refresh_from_db()
        self.assertTrue(stage_review_pending(task))

    def test_explicit_review_release_keeps_retired_history_and_allows_new_generation(self):
        from dashboard.reconciliation import _detect_marks_issues, apply_reconciliation_issue
        self.setup_tasks(); task = self.task()
        self.correct(); self.record.refresh_from_db(); self.correct(stage='P1')
        issue = next(issue for issue in _detect_marks_issues()
            if issue.issue_type == 'MARKS_STAGE_REVIEW' and issue.record_id == str(task.pk))
        self.assertEqual(issue.suggestion['action'], 'RELEASE_STAGE_REVIEW')
        apply_reconciliation_issue(issue_id=issue.issue_id, expected_fingerprint=issue.fingerprint,
            actor=self.office, reason='Reviewed retired work; permit a new assignment',
            resolution={'action': 'RELEASE_STAGE_REVIEW'})
        ensure_period_tasks(self.period_obj, actor=self.office)
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, 'RETIRED')
        self.assertEqual(EvaluationTask.objects.filter(period=self.period_obj, lifecycle_status='ACTIVE').count(), 1)

    def test_bulk_change_after_not_started_cannot_bypass_wrong_tasks(self):
        self.setup_tasks(); task = self.task(state='DRAFT')
        self.correct(stage='NONE')
        self.profile('safe', appointed=False)
        result = change_stages(self.semester, [('correction', 'NOT_STARTED'), ('safe', 'P1')],
            choice='P2', reason='WRONG_ANSWER', actor=self.coordinator)
        self.assertEqual(result['changed'], ['safe'])
        self.assertEqual([row['matric'] for row in result['leftOut']], ['correction'])
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, 'PAUSED')

    def test_registry_api_requires_preview_and_preserves_submitted_marks(self):
        self.setup_tasks()
        task = self.task(state='SUBMITTED')
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.get('/api/marks/periods/').status_code, 403)
        url = '/api/registry/project-stages/'
        preview = self.client.get(url+'impact/', {'semester': self.semester.pk, 'matric': self.student.matric_no, 'stage': 'P2'})
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data['submitted'], 1)
        payload = {'semesterId': self.semester.pk, 'students': [{'matric': self.student.matric_no, 'shown': 'P1'}],
            'stage': 'P2', 'reason': 'WRONG_ANSWER', 'checked': True}
        self.assertEqual(self.client.post(url+'change/', payload, format='json').status_code, 409)
        payload['token'] = preview.data['token']
        self.assertEqual(self.client.post(url+'change/', payload, format='json').status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.stage, 'P2')
        self.assertEqual(task.mark_entry.status, 'SUBMITTED')
        self.assertEqual(task.mark_entry.comments, 'Keep my comments')
        self.assertTrue(task.lifecycle_audits.filter(action='STAGE_REVIEW').exists())

    def test_supplied_preview_is_rejected_even_if_affected_work_disappears(self):
        self.setup_tasks()
        task = self.task()
        impact = self.impact()
        task.lifecycle_status = 'RETIRED'
        task.save(update_fields=['lifecycle_status'])
        with self.assertRaises(StageConflict):
            self.correct(impact=impact)
        self.record.refresh_from_db()
        self.assertEqual(self.record.stage, 'P1')

    def test_later_matching_stage_does_not_auto_resume_or_regenerate(self):
        self.setup_tasks()
        draft = self.task(state='DRAFT')
        self.correct()
        self.record.refresh_from_db()
        self.correct(stage='P1')
        result = resume_student_evaluation_tasks(profile=self.person, actor=self.office, reason='Return')
        ensure_period_tasks(self.period_obj, actor=self.office)
        draft.refresh_from_db()
        self.assertEqual(result['resumed'], [])
        self.assertEqual(draft.lifecycle_status, 'PAUSED')
        self.assertEqual(EvaluationTask.objects.filter(period=self.period_obj).count(), 1)

    def test_retired_stage_work_is_not_duplicated_when_stage_matches_again(self):
        self.setup_tasks(); task = self.task()
        self.correct(); self.record.refresh_from_db(); self.correct(stage='P1')
        ensure_period_tasks(self.period_obj, actor=self.office)
        self.assertEqual(EvaluationTask.objects.filter(period=self.period_obj).count(), 1)
        task.refresh_from_db(); self.assertEqual(task.lifecycle_status, 'RETIRED')

    def test_office_reconciliation_exposes_submitted_and_paused_stage_review(self):
        from dashboard.reconciliation import _detect_marks_issues
        self.setup_tasks()
        draft = self.task(state='DRAFT')
        submitted = self.task(state='SUBMITTED', lifecycle='PAUSED')
        self.correct()
        issues = _detect_marks_issues()
        stage_issues = [issue for issue in issues if issue.issue_type == 'MARKS_STAGE_REVIEW']
        self.assertEqual({issue.record_id for issue in stage_issues}, {str(draft.pk), str(submitted.pk)})
        self.assertTrue(all(issue.repairability == 'REVIEW_REQUIRED' for issue in stage_issues))

    def test_eligible_paused_work_resumes_only_through_explicit_review(self):
        from dashboard.reconciliation import _detect_marks_issues, apply_reconciliation_issue
        from .stage_corrections import stage_review_pending
        self.setup_tasks(); task = self.task(state='DRAFT')
        self.correct(); self.record.refresh_from_db(); self.correct(stage='P1')
        issue = next(issue for issue in _detect_marks_issues()
            if issue.issue_type == 'MARKS_STAGE_REVIEW' and issue.record_id == str(task.pk))
        self.assertEqual(issue.suggestion['action'], 'RESUME_MARKS_TASK')
        apply_reconciliation_issue(issue_id=issue.issue_id, expected_fingerprint=issue.fingerprint,
            actor=self.office, reason='Reviewed preserved draft', resolution={'action': 'RESUME_MARKS_TASK'})
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, 'ACTIVE')
        self.assertEqual(task.mark_entry.comments, 'Keep my comments')
        self.assertFalse(stage_review_pending(task))

    def test_office_recheck_retains_retired_task_when_registration_still_differs(self):
        self.setup_tasks()
        task = self.task()
        self.correct(stage='P2')
        self.client.force_authenticate(self.office)
        url = '/api/dashboard/reconciliation/'
        filters = {'search': self.person.matric_no, 'pageSize': 100}

        def finding():
            response = self.client.get(url, filters)
            self.assertEqual(response.status_code, 200, response.data)
            return next(row for row in response.data['results']
                        if row['issueType'] == 'MARKS_STAGE_REVIEW' and row['recordId'] == str(task.pk))

        issue = finding()
        self.assertEqual(issue['currentState']['lifecycleStatus'], 'RETIRED')
        self.assertEqual(issue['currentState']['entryStatus'], 'NOT_STARTED')
        preview = self.client.get(f"{url}issues/{issue['issueId']}/preview/")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertFalse(preview.data['allowedResolutions'])
        self.assertEqual(finding()['issueId'], issue['issueId'])

    def test_retired_history_release_does_not_require_ended_original_appointment(self):
        from appointments.models import SupervisorAppointment
        from .stage_corrections import stage_review_resolution
        self.setup_tasks(); task = self.task()
        self.correct(); self.record.refresh_from_db(); self.correct(stage='P1')
        SupervisorAppointment.objects.filter(student=self.student).update(status='ENDED')
        task.refresh_from_db()
        self.assertEqual(stage_review_resolution(task), 'RELEASE_STAGE_REVIEW')

    def test_ended_appointment_draft_can_be_explicitly_retired_then_released(self):
        from appointments.models import SupervisorAppointment
        from dashboard.reconciliation import _detect_marks_issues, apply_reconciliation_issue
        from .stage_corrections import stage_review_pending, stage_review_resolution
        self.setup_tasks(); task = self.task(state='DRAFT')
        self.correct(); self.record.refresh_from_db(); self.correct(stage='P1')
        SupervisorAppointment.objects.filter(student=self.student).update(status='ENDED')
        issue = next(issue for issue in _detect_marks_issues()
            if issue.issue_type == 'MARKS_STAGE_REVIEW' and issue.record_id == str(task.pk))
        self.assertEqual(issue.suggestion['action'], 'RETIRE_MARKS_TASK')
        apply_reconciliation_issue(issue_id=issue.issue_id, expected_fingerprint=issue.fingerprint,
            actor=self.office, reason='Preserve draft after evaluator replacement', resolution={'action': 'RETIRE_MARKS_TASK'})
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, 'RETIRED')
        self.assertEqual(task.mark_entry.comments, 'Keep my comments')
        self.assertTrue(stage_review_pending(task))
        self.assertEqual(stage_review_resolution(task), 'RELEASE_STAGE_REVIEW')

    def test_submitted_completion_evidence_stays_unchanged_and_repeat_is_stale(self):
        self.setup_tasks(); task = self.task(state='SUBMITTED')
        window = TaskCompletionWindow.objects.create(task=task, granted_by=self.office,
            reason='Original extension', deadline=timezone.now()+timezone.timedelta(days=10))
        MarkEntry.objects.filter(task=task).update(submitted_completion_window=window,
            submitted_due_recorded=True, submitted_due_at=window.deadline)
        impact = self.impact()
        self.correct(impact=impact)
        count = task.lifecycle_audits.count()
        with self.assertRaises(StageConflict):
            self.correct(impact=impact, expected='P1')
        window.refresh_from_db(); task.refresh_from_db()
        self.assertIsNone(window.ended_at)
        self.assertEqual(task.mark_entry.submitted_completion_window_id, window.pk)
        self.assertEqual(task.mark_entry.submitted_due_at, window.deadline)
        self.assertEqual(task.lifecycle_audits.count(), count)

    def test_window_change_invalidates_reviewed_impact(self):
        self.setup_tasks(); task = self.task(state='DRAFT')
        impact = self.impact()
        TaskCompletionWindow.objects.create(task=task, granted_by=self.office,
            reason='New extension', deadline=timezone.now()+timezone.timedelta(days=10))
        with self.assertRaises(StageConflict):
            self.correct(impact=impact)
        task.refresh_from_db(); self.assertEqual(task.lifecycle_status, 'ACTIVE')
