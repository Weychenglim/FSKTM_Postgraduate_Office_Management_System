"""Registry stage corrections serialize against Marks writes on PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event, get_ident
from unittest import skipUnless
from unittest.mock import patch

from django.db import close_old_connections, connection, connections, transaction
from django.db.models.query import QuerySet
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import Student
from accounts.project_stages import StageConflict, change_stages, preview_change
from . import test_completion_windows as fixtures
from .test_stage_corrections import coordinator_for
from .completion_windows import grant_completion_windows
from .models import EvaluationTask, MarkEntry
from .serializers import MarkDraftSerializer
from .services import MarksStateConflict, ensure_period_tasks
from .test_write_helpers import with_version


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locking')
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class StageConcurrencyTests(APITransactionTestCase):
    user = fixtures.CompletionWindowTests.user
    lecturer = fixtures.CompletionWindowTests.lecturer
    profile = fixtures.CompletionWindowTests.profile
    payload = fixtures.CompletionWindowTests.payload
    period = fixtures.CompletionWindowTests.period
    publish = fixtures.CompletionWindowTests.publish

    def setUp(self):
        fixtures.CompletionWindowTests.setUp(self)
        self.student = self.student_profile.student.student
        self.coordinator = coordinator_for(self, self.student.programme)

    def after_correction(self, operation):
        attempted_student_lock = Event()
        main_thread = get_ident()
        original_fetch = QuerySet._fetch_all

        def observe_fetch(query):
            if get_ident() != main_thread and query.model is Student and query.query.select_for_update:
                attempted_student_lock.set()
            return original_fetch(query)

        def run():
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '5s'")
                try:
                    return operation()
                except MarksStateConflict:
                    return 'blocked'
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                impact = preview_change(self.semester, self.student, 'P2', self.coordinator)
                change_stages(self.semester, [(self.student.matric_no, 'P1')], choice='P2',
                    reason='WRONG_ANSWER', actor=self.coordinator, checked=True, token=impact['token'])
                with patch.object(QuerySet, '_fetch_all', observe_fetch):
                    future = pool.submit(run)
                    self.assertTrue(attempted_student_lock.wait(5), 'Marks must serialize with the Registry correction')
            return future.result(timeout=10)

    def test_generation_rechecks_stage_after_waiting_for_correction(self):
        self.assertEqual(self.after_correction(lambda: ensure_period_tasks(self.period_obj, actor=self.office)['total']), 0)
        self.assertFalse(EvaluationTask.objects.filter(evaluator_role='PANEL').exists())

    def test_draft_rechecks_stage_after_waiting_for_correction(self):
        serializer = MarkDraftSerializer(data=with_version(self.task, {'scores': [], 'comments': 'Wrong-stage draft'}), context={'task': self.task})
        serializer.is_valid(raise_exception=True)
        self.assertEqual(self.after_correction(serializer.save), 'blocked')
        self.assertFalse(MarkEntry.objects.filter(task=self.task).exists())

    def test_extension_rechecks_stage_after_waiting_for_correction(self):
        self.assertEqual(self.after_correction(lambda: grant_completion_windows(
            task_ids=[self.task.pk], deadline=timezone.now()+timezone.timedelta(days=10),
            actor=self.office, reason='More time')), 'blocked')
        self.assertFalse(self.task.completion_windows.exists())

    def test_correction_rejects_preview_when_waiting_draft_write_commits(self):
        student = self.student_profile.student.student
        impact = preview_change(self.semester, student, 'P2', self.coordinator)
        attempted = Event()
        main_thread = get_ident()
        original_fetch = QuerySet._fetch_all

        def observe_fetch(query):
            if get_ident() != main_thread and query.model is Student and query.query.select_for_update:
                attempted.set()
            return original_fetch(query)

        def correct():
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '5s'")
                try:
                    change_stages(self.semester, [(student.matric_no, 'P1')], choice='P2',
                        reason='WRONG_ANSWER', actor=self.coordinator, checked=True, token=impact['token'])
                    return 'unexpected correction'
                except StageConflict:
                    return 'stale review'
            finally:
                connections.close_all()

        serializer = MarkDraftSerializer(data=with_version(self.task, {'scores': [], 'comments': 'Concurrent draft'}), context={'task': self.task})
        serializer.is_valid(raise_exception=True)
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                Student.objects.select_for_update().get(pk=student.pk)
                with patch.object(QuerySet, '_fetch_all', observe_fetch):
                    future = pool.submit(correct)
                    self.assertTrue(attempted.wait(5))
                    serializer.save()
            self.assertEqual(future.result(timeout=10), 'stale review')
        self.assertEqual(MarkEntry.objects.get(task=self.task).comments, 'Concurrent draft')
