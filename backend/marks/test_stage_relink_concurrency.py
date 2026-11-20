"""A concurrent legacy-profile link must not escape Marks' Student lock set."""
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
from accounts.project_stages import change_stages, preview_change
from appointments.models import StudentResearchProfile, SupervisorApplication
from appointments.supervisor_handoff import _resolve_research_profile
from . import test_completion_windows as fixtures
from .test_stage_corrections import coordinator_for
from .completion_windows import grant_completion_windows
from .services import MarksStateConflict
from .stage_eligibility import profile_stage_eligibility


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locking')
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class StageRelinkConcurrencyTests(APITransactionTestCase):
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

    def test_completion_window_rejects_profile_linked_after_student_lock(self):
        student = self.student_profile.student.student
        StudentResearchProfile.objects.filter(pk=self.student_profile.pk).update(student=None)
        sampled = Event()
        linked = Event()
        checked_or_finished = Event()
        corrected = Event()
        main_thread = get_ident()
        original_fetch = QuerySet._fetch_all
        observed = False

        def observe_fetch(query):
            nonlocal observed
            result = original_fetch(query)
            if (get_ident() != main_thread and query.model is Student
                    and query.query.select_for_update and not observed):
                observed = True
                sampled.set()
                self.assertTrue(linked.wait(10), 'Supervisor approval did not finish linking the profile')
            return result

        def pause_after_stage_check(period, profile):
            decision = profile_stage_eligibility(period, profile)
            if get_ident() != main_thread:
                # On the vulnerable path the newly linked profile has confirmed
                # P1, but its Student was absent from the earlier lock set.
                self.assertTrue(decision.eligible)
                checked_or_finished.set()
                self.assertTrue(corrected.wait(10), 'Office correction did not finish')
            return decision

        def grant():
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '5s'")
                    cursor.execute("SET statement_timeout = '10s'")
                try:
                    return grant_completion_windows(
                        task_ids=[self.task.pk], actor=self.office, reason='More time',
                        deadline=timezone.now() + timezone.timedelta(days=10),
                    )
                except MarksStateConflict:
                    return 'blocked'
            finally:
                checked_or_finished.set()
                connections.close_all()

        with (patch.object(QuerySet, '_fetch_all', observe_fetch),
                patch('marks.completion_windows.profile_stage_eligibility', pause_after_stage_check),
                ThreadPoolExecutor(max_workers=1) as pool):
            future = pool.submit(grant)
            try:
                self.assertTrue(sampled.wait(10), 'Marks did not finish sampling its Student lock set')
                with transaction.atomic():
                    with connection.cursor() as cursor:
                        cursor.execute("SET LOCAL lock_timeout = '5s'")
                    Student.objects.select_for_update().get(pk=student.pk)
                    application = SupervisorApplication.objects.get(student=student)
                    # Supervisor approval supports linking an unlinked legacy
                    # profile even when it already has evaluation-task history.
                    profile = _resolve_research_profile(application)
                    self.assertEqual(profile.student_id, student.pk)
                linked.set()
                self.assertTrue(checked_or_finished.wait(10), 'Marks did not recheck the linked profile')
                with transaction.atomic():
                    with connection.cursor() as cursor:
                        cursor.execute("SET LOCAL lock_timeout = '5s'")
                    impact = preview_change(self.semester, student, 'P2', self.coordinator)
                    change_stages(self.semester, [(student.matric_no, 'P1')], choice='P2',
                        reason='WRONG_ANSWER', actor=self.coordinator, checked=True, token=impact['token'])
                corrected.set()
                self.assertEqual(future.result(timeout=10), 'blocked')
            finally:
                # Release both worker pauses even when a main-thread assertion
                # fails, so executor shutdown cannot wait on an unreleased event.
                linked.set()
                corrected.set()

        self.assertFalse(self.task.completion_windows.exists())
