from .test_write_helpers import with_version
from .test_write_helpers import submission_payload
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from marks import test_period_targeting as fixtures
from marks.models import EvaluationTask, EvaluationPeriod

@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class CompletionWindowTests(APITestCase):
    user = fixtures.PeriodTargetingTests.user
    lecturer = fixtures.PeriodTargetingTests.lecturer
    profile = fixtures.PeriodTargetingTests.profile
    payload = fixtures.PeriodTargetingTests.payload
    period = fixtures.PeriodTargetingTests.period
    publish = fixtures.PeriodTargetingTests.publish
    def setUp(self):
        fixtures.PeriodTargetingTests.setUp(self)
        self.student_profile = self.profile('completion-student')
        self.period_obj = self.period()
        self.publish(self.period_obj)
        self.task = EvaluationTask.objects.create(period=self.period_obj, evaluator=self.supervisor, profile=self.student_profile, evaluator_role="SUPERVISOR")

    def grant(self, **values):
        return self.client.post('/api/marks/completion-windows/', {'taskIds': [self.task.pk], 'deadline': (timezone.now()+timezone.timedelta(days=10)).isoformat(), 'reason': 'Approved additional time', **values}, format='json')

    def test_monitoring_overdue_respects_personal_completion_deadline(self):
        from .views import period_task_totals
        self.period_obj.closes_at = timezone.now() - timezone.timedelta(days=1)
        self.period_obj.save()
        self.assertEqual(period_task_totals(self.period_obj)['overdue'], 1)
        self.assertEqual(self.grant().status_code, 201)
        self.assertEqual(period_task_totals(self.period_obj)['overdue'], 0)

    def test_close_retires_unfinished_tasks_preserving_marks_and_other_periods(self):
        from .models import MarkEntry, EvaluationTaskLifecycleAudit
        from .services import close_evaluation_period, MarksStateConflict
        from .closure_preview import period_closure_preview
        draft = MarkEntry.objects.create(task=self.task, status='DRAFT', comments='Keep this draft')
        submitted_task = EvaluationTask.objects.create(period=self.period_obj, evaluator=self.panel,
            profile=self.student_profile, evaluator_role='PANEL')
        submitted = MarkEntry.objects.create(task=submitted_task, status='SUBMITTED', total_mark='80.00')
        paused = EvaluationTask.objects.create(period=self.period_obj, evaluator=self.office,
            profile=self.student_profile, evaluator_role='BACKUP', lifecycle_status='PAUSED')
        other_period = self.period()
        other = EvaluationTask.objects.create(period=other_period, evaluator=self.supervisor,
            profile=self.student_profile, evaluator_role='SUPERVISOR')
        self.assertEqual(self.grant().status_code, 201)
        preview = period_closure_preview(self.period_obj)
        with self.assertRaises(MarksStateConflict):
            close_evaluation_period(period=self.period_obj, actor=self.office, reason='Assessment replaced',
                preview_token=preview['previewToken'], acknowledge_unfinished=False)
        close_evaluation_period(period=self.period_obj, actor=self.office, reason='Assessment replaced',
            preview_token=preview['previewToken'], acknowledge_unfinished=True)
        for task in (self.task, paused):
            task.refresh_from_db()
            self.assertEqual(task.lifecycle_status, 'RETIRED')
            self.assertEqual(task.retired_by, self.office)
            self.assertTrue(EvaluationTaskLifecycleAudit.objects.filter(task=task, action='RETIRED').exists())
        self.assertFalse(self.task.completion_windows.filter(ended_at__isnull=True).exists())
        draft.refresh_from_db()
        self.assertEqual(draft.comments, 'Keep this draft')
        submitted.refresh_from_db()
        self.assertEqual(submitted.status, 'SUBMITTED')
        self.assertEqual(str(submitted.total_mark), '80.00')
        for task in (submitted_task, other):
            task.refresh_from_db()
            self.assertEqual(task.lifecycle_status, 'ACTIVE')

    def test_grant_closed_task_allows_draft_and_snapshots_submission(self):
        self.period_obj.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period_obj.save()
        response = self.grant()
        self.assertEqual(response.status_code, 201)
        window_id = response.data['windows'][0]['id']
        self.client.force_authenticate(self.supervisor)
        response = self.client.put(f'/api/marks/tasks/{self.task.pk}/draft/', with_version(self.task, {'scores':[{'componentId':self.rubric.components.get().pk,'marksAwarded':'80.00'}]}), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data.get('periodEffectiveStatus'), 'CLOSED')
        response = self.client.post(f'/api/marks/tasks/{self.task.pk}/submit/', submission_payload(self.task), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.task.refresh_from_db()
        self.assertEqual(self.task.mark_entry.submitted_completion_window_id, window_id)
        self.assertIsNotNone(self.task.mark_entry.submitted_due_at)

    def test_non_admin_office_grants_but_future_extension_is_required(self):
        self.office.is_staff = False
        self.office.save()
        self.assertEqual(self.grant(deadline=(timezone.now()+timezone.timedelta(days=1)).isoformat()).status_code, 400)
        self.assertEqual(self.grant().status_code, 201)

    def test_history_cannot_be_rewritten_through_queryset(self):
        from django.core.exceptions import ValidationError
        from .models import TaskCompletionWindow, TaskCompletionWindowAudit
        self.assertEqual(self.grant().status_code, 201)
        for model in (TaskCompletionWindow, TaskCompletionWindowAudit):
            with self.assertRaises(ValidationError):
                model.objects.update(reason='Rewritten')
            with self.assertRaises(ValidationError):
                model.objects.all().delete()

    def test_submission_snapshot_fields_are_readonly_in_admin(self):
        from django.contrib import admin
        from django.test import RequestFactory
        from .models import MarkEntry
        request = RequestFactory().get('/admin/')
        request.user = self.office
        fields = admin.site._registry[MarkEntry].get_readonly_fields(request)
        self.assertTrue({'submitted_due_at', 'submitted_due_recorded', 'submitted_completion_window'}.issubset(fields))

    def test_supersede_and_revoke_keep_history(self):
        first = self.grant()
        self.assertEqual(first.status_code, 201)
        second = self.grant()
        self.assertEqual(second.status_code, 201)
        response = self.client.post(f"/api/marks/completion-windows/{second.data['windows'][0]['id']}/revoke/", {'reason':'No longer needed'}, format='json')
        self.assertEqual(response.status_code, 200)
        response = self.client.get(f'/api/marks/tasks/{self.task.pk}/completion-windows/')
        self.assertEqual([w['status'] for w in response.data['windows']], ['REVOKED','SUPERSEDED'])

    def test_expiry_preserves_due_and_blocks_draft(self):
        from marks.completion_windows import task_due_at, task_access
        deadline = timezone.now()+timezone.timedelta(days=10)
        self.assertEqual(self.grant(deadline=deadline.isoformat()).status_code, 201)
        later = deadline + timezone.timedelta(seconds=1)
        self.assertEqual(task_due_at(self.task, later), deadline)
        self.assertFalse(task_access(self.task, later)['canEdit'])

    def test_published_renewal_cannot_shorten_current_due(self):
        self.assertEqual(self.grant().status_code, 201)
        response = self.grant(deadline=(timezone.now()+timezone.timedelta(days=9)).isoformat())
        self.assertEqual(response.status_code, 400)

    def test_ineligible_tasks_periods_and_participants_cannot_receive_windows(self):
        from .models import MarkEntry
        student = self.student_profile.student.student
        cases = [
            (self.task, 'lifecycle_status', 'PAUSED'),
            (self.task, 'lifecycle_status', 'RETIRED'),
            (self.period_obj, 'lifecycle_status', 'DRAFT'),
            (self.period_obj, 'lifecycle_status', 'ARCHIVED'),
            (self.period_obj, 'opens_at', timezone.now()+timezone.timedelta(days=1)),
            (self.semester, 'lifecycle_status', 'ARCHIVED'),
            (student, 'status', 'Deferred'),
            (self.supervisor, 'is_active', False),
        ]
        for instance, field, value in cases:
            with self.subTest(model=type(instance).__name__, field=field, value=value):
                previous = getattr(instance, field)
                setattr(instance, field, value)
                instance.save()
                self.assertEqual(self.grant().status_code, 409)
                setattr(instance, field, previous)
                instance.save()
        MarkEntry.objects.create(task=self.task, status='SUBMITTED')
        self.assertEqual(self.grant().status_code, 409)
        self.assertFalse(self.task.completion_windows.exists())

    def test_only_office_can_manage_or_read_window_history(self):
        for user in (self.supervisor, self.panel, self.student_profile.student):
            with self.subTest(role=user.role):
                self.client.force_authenticate(user)
                self.assertEqual(self.grant().status_code, 403)
                self.assertEqual(self.client.get(f'/api/marks/tasks/{self.task.pk}/completion-windows/').status_code, 403)

    def test_official_handover_invalidates_window_without_transferring_it(self):
        from .services import retire_official_evaluation_tasks
        self.assertEqual(self.grant().status_code, 201)
        retire_official_evaluation_tasks(profile=self.student_profile,
            evaluator=self.supervisor, evaluator_role='SUPERVISOR', actor=self.office,
            reason='New primary supervisor', replacement_evaluator=self.backup)
        self.task.refresh_from_db()
        self.assertEqual(self.task.lifecycle_status, 'RETIRED')
        self.assertEqual(self.task.completion_windows.get().end_kind, 'INVALIDATED')
        replacement = EvaluationTask.objects.get(period=self.period_obj, evaluator=self.backup)
        self.assertFalse(replacement.completion_windows.exists())

    def test_pause_permanently_invalidates_and_resume_does_not_restore(self):
        from marks.services import pause_student_evaluation_tasks, resume_student_evaluation_tasks
        from marks.completion_windows import task_window_active
        self.assertEqual(self.grant().status_code, 201)
        pause_student_evaluation_tasks(profile=self.student_profile, actor=self.office, reason='Leave')
        resume_student_evaluation_tasks(profile=self.student_profile, actor=self.office, reason='Returned')
        self.task.refresh_from_db()
        self.assertIsNone(task_window_active(self.task))
        self.assertEqual(self.task.completion_windows.get().end_kind, 'INVALIDATED')

    def test_closed_recovery_may_be_before_original_future_deadline(self):
        self.period_obj.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period_obj.save()
        deadline = timezone.now()+timezone.timedelta(days=1)
        self.assertEqual(self.grant(deadline=deadline.isoformat()).status_code, 201)

    def test_batch_ineligibility_rolls_back_every_grant(self):
        invalid = EvaluationTask.objects.create(period=self.period_obj, evaluator=self.panel, profile=self.student_profile, evaluator_role='PANEL',lifecycle_status='PAUSED')
        response = self.grant(taskIds=[self.task.pk, invalid.pk])
        self.assertEqual(response.status_code, 409)
        self.assertFalse(self.task.completion_windows.exists())

    def test_submitted_snapshot_survives_period_deadline_changes(self):
        from marks.completion_windows import task_due_at
        from marks.serializers import submit_entry
        from marks.models import MarkEntry, MarkScore
        entry = MarkEntry.objects.create(task=self.task, status='DRAFT')
        MarkScore.objects.create(entry=entry, component=self.rubric.components.get(), marks_awarded=80)
        self.period_obj.closes_at = None
        self.period_obj.save()
        self.task.refresh_from_db()
        submit_entry(self.task)
        self.period_obj.closes_at = timezone.now()+timezone.timedelta(days=2)
        self.period_obj.save()
        self.task.refresh_from_db()
        self.assertIsNone(task_due_at(self.task))
