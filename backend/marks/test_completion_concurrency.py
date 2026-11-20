from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest import skipUnless
from django.db import close_old_connections, connection, connections
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITransactionTestCase
from . import test_completion_windows as fixture
from .models import MarkEntry, MarkScore, TaskCompletionWindow
from .completion_windows import grant_completion_windows, revoke_completion_window
from .serializers import submit_entry
from .services import MarksStateConflict, retire_participant_evaluation_tasks

@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locking')
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class CompletionConcurrencyTests(APITransactionTestCase):
    setUp = fixture.CompletionWindowTests.setUp
    user = fixture.CompletionWindowTests.user
    lecturer = fixture.CompletionWindowTests.lecturer
    profile = fixture.CompletionWindowTests.profile
    payload = fixture.CompletionWindowTests.payload
    period = fixture.CompletionWindowTests.period
    publish = fixture.CompletionWindowTests.publish

    def race(self, first, second):
        barrier = Barrier(2)
        def run(fn):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout TO '5s'")
                barrier.wait(timeout=5)
                try:
                    fn()
                    return 'ok'
                except MarksStateConflict:
                    return 'conflict'
            finally:
                connections['default'].close()
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(run, fn) for fn in (first, second)]
            return [future.result(timeout=15) for future in futures]

    def grant_window(self):
        return grant_completion_windows(task_ids=[self.task.pk], deadline=timezone.now()+timezone.timedelta(days=10), reason='Recovery', actor=self.office)[0]

    def close_period(self):
        self.period_obj.lifecycle_status = 'CLOSED'
        self.period_obj.save()

    def test_concurrent_grants_keep_one_current_and_both_audits(self):
        self.close_period()
        self.assertEqual(self.race(self.grant_window, self.grant_window), ['ok','ok'])
        self.assertEqual(TaskCompletionWindow.objects.filter(task=self.task,ended_at__isnull=True).count(), 1)
        self.assertEqual(TaskCompletionWindow.objects.filter(task=self.task).count(), 2)

    def test_revoke_and_submission_have_one_winner(self):
        self.close_period()
        window = self.grant_window()
        entry = MarkEntry.objects.create(task=self.task,status='DRAFT')
        MarkScore.objects.create(entry=entry,component=self.rubric.components.get(),marks_awarded=80)
        results = self.race(lambda: revoke_completion_window(window_id=window.pk,reason='Withdrawn',actor=self.office), lambda: submit_entry(self.task))
        self.assertCountEqual(results,['ok','conflict'])
        entry.refresh_from_db()
        window.refresh_from_db()
        self.assertEqual(entry.status == 'SUBMITTED', window.ended_at is None)

    def test_retirement_never_leaves_live_window(self):
        self.close_period()
        results = self.race(self.grant_window, lambda: retire_participant_evaluation_tasks(tasks=type(self.task).objects.filter(pk=self.task.pk),actor=self.office,reason='Retired'))
        self.assertIn('ok',results)
        self.task.refresh_from_db()
        self.assertEqual(self.task.lifecycle_status,'RETIRED')
        self.assertFalse(self.task.completion_windows.filter(ended_at__isnull=True).exists())

    def test_grant_does_not_deadlock_an_inflight_evaluator_handover(self):
        from unittest.mock import patch
        from django.db import transaction
        from django.db.models.query import QuerySet
        from .models import EvaluationTask, EvaluationPeriod
        locked_task, locked_period = Event(), Event()
        original_fetch = QuerySet._fetch_all

        def observed_fetch(query):
            result = original_fetch(query)
            if query.model is EvaluationPeriod and query.query.select_for_update:
                locked_period.set()
            return result

        def handover():
            with transaction.atomic():
                task = EvaluationTask.objects.select_for_update().get(pk=self.task.pk)
                locked_task.set()
                if not locked_period.wait(5):
                    raise RuntimeError('Grant did not lock its period')
                # Appointment handovers preserve the original task and may insert
                # its replacement in the same period before committing.
                EvaluationTask.objects.create(period_id=task.period_id,
                    profile_id=task.profile_id, evaluator=self.panel, evaluator_role='SUPERVISOR')
                task.lifecycle_status = 'RETIRED'
                task.save(update_fields=['lifecycle_status'])

        def grant():
            if not locked_task.wait(5):
                raise RuntimeError('Handover did not lock its task')
            self.grant_window()

        with patch.object(QuerySet, '_fetch_all', observed_fetch):
            self.assertCountEqual(self.race(handover, grant), ['ok', 'conflict'])

    def test_closure_preview_includes_inflight_handover_replacement(self):
        from unittest.mock import patch
        from django.db import transaction
        from django.db.models.query import QuerySet
        from .closure_preview import period_closure_preview
        from .models import EvaluationTask, EvaluationPeriod
        locked_task, locked_period = Event(), Event()
        result = {}
        original_fetch = QuerySet._fetch_all

        def observed_fetch(query):
            value = original_fetch(query)
            if query.model is EvaluationPeriod and query.query.select_for_update:
                locked_period.set()
            return value

        def handover():
            with transaction.atomic():
                task = EvaluationTask.objects.select_for_update().get(pk=self.task.pk)
                locked_task.set()
                if not locked_period.wait(5):
                    raise RuntimeError('Preview did not lock its period')
                EvaluationTask.objects.create(period_id=task.period_id,
                    profile_id=task.profile_id, evaluator=self.panel, evaluator_role='SUPERVISOR')
                task.lifecycle_status = 'RETIRED'
                task.save(update_fields=['lifecycle_status'])

        def preview():
            if not locked_task.wait(5):
                raise RuntimeError('Handover did not lock its task')
            result.update(period_closure_preview(self.period_obj))

        with patch.object(QuerySet, '_fetch_all', observed_fetch):
            self.assertEqual(self.race(handover, preview), ['ok', 'ok'])
        self.assertEqual(result['totals']['unfinished'], 1)
        self.assertTrue(result['requiresAcknowledgement'])
