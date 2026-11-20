"""Period locks must allow an in-flight appointment handover's task FK insert."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest import skipUnless
from unittest.mock import patch

from django.db import DatabaseError, close_old_connections, connection, connections, transaction
from django.db.models.query import QuerySet
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import Lecturer, Student
from appointments.models import SupervisorApplication, SupervisorAppointment
from . import test_completion_windows as fixtures
from .models import EvaluationPeriod, EvaluationTask
from .services import (
    ensure_period_tasks,
    ensure_replacement_evaluation_tasks,
)


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locking")
@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CapacityHandoverLockingTests(APITransactionTestCase):
    setUp = fixtures.CompletionWindowTests.setUp
    user = fixtures.CompletionWindowTests.user
    lecturer = fixtures.CompletionWindowTests.lecturer
    profile = fixtures.CompletionWindowTests.profile
    payload = fixtures.CompletionWindowTests.payload
    period = fixtures.CompletionWindowTests.period
    publish = fixtures.CompletionWindowTests.publish

    def _race_handover(self, *, legacy_period_lock=False):
        student_locked, period_locked = Event(), Event()
        original_fetch = QuerySet._fetch_all
        original_lock = QuerySet.select_for_update

        def observed_fetch(query):
            result = original_fetch(query)
            if query.model is EvaluationPeriod and query.query.select_for_update:
                period_locked.set()
            return result

        def period_lock(query, *args, **kwargs):
            # Sensitivity control: restore only the pre-fix period lock, leaving
            # both production services and the actual FK insertion unchanged.
            if legacy_period_lock and query.model is EvaluationPeriod:
                kwargs["no_key"] = False
            return original_lock(query, *args, **kwargs)

        def handover():
            with transaction.atomic():
                student = Student.objects.select_for_update().get(
                    pk=self.student_profile.student_id
                )
                Lecturer.objects.select_for_update().get(pk=self.backup.pk)
                student_locked.set()
                if not period_locked.wait(10):
                    raise AssertionError("Task creation did not acquire its period lock")
                old = SupervisorAppointment.objects.get(student=student, status="ACTIVE")
                old.status = "ENDED"
                old.end_outcome = "Replaced"
                old.ended_at = timezone.now()
                old.ended_by = self.office
                old.save(update_fields=["status", "end_outcome", "ended_at", "ended_by"])
                application = SupervisorApplication.objects.create(
                    student=student,
                    proposed_supervisor=self.backup,
                    research_title="Replacement",
                    research_abstract="Replacement",
                    status=SupervisorApplication.Status.APPROVED,
                )
                replacement = SupervisorAppointment.objects.create(
                    application=application, student=student, supervisor=self.backup,
                    approved_by=self.office, supersedes=old,
                )
                ensure_replacement_evaluation_tasks(
                    old_appointment=old, replacement_appointment=replacement,
                    actor=self.office, reason="Concurrent replacement regression",
                )
                # Django's PostgreSQL foreign keys are deferred until commit.
                # The real transaction commit below must coexist with the period
                # lock while the other transaction waits for this Student.

        def create_tasks():
            if not student_locked.wait(10):
                raise AssertionError("Handover did not acquire its Student lock")
            return ensure_period_tasks(self.period_obj, actor=self.office)

        def run(operation):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout TO '3s'")
                try:
                    operation()
                except DatabaseError as exc:
                    return exc
                return None
            finally:
                connections["default"].close()

        with patch.object(QuerySet, "_fetch_all", observed_fetch), patch.object(
            QuerySet, "select_for_update", period_lock
        ), ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(run, operation) for operation in (handover, create_tasks)]
            results = [future.result(timeout=20) for future in futures]

        if legacy_period_lock:
            errors = [result for result in results if result is not None]
            self.assertTrue(errors, "Legacy FOR UPDATE unexpectedly allowed both commits")
            for error in errors:
                cause = error.__cause__
                self.assertIn(
                    getattr(cause, "sqlstate", None) or getattr(cause, "pgcode", None),
                    {"40P01", "55P03"},  # Deadlock or bounded lock timeout only.
                )
            return

        self.assertEqual(results, [None, None])
        self.task.refresh_from_db()
        self.assertEqual(self.task.lifecycle_status, EvaluationTask.Lifecycle.RETIRED)
        replacement_task = EvaluationTask.objects.get(
            period=self.period_obj, profile=self.student_profile,
            evaluator=self.backup, evaluator_role="SUPERVISOR", lifecycle_status="ACTIVE",
        )
        self.assertTrue(self.task.handover_audits.filter(replacement_task=replacement_task).exists())

    def test_period_generation_allows_inflight_replacement_task_commit(self):
        self._race_handover()

    def test_legacy_generation_lock_reproduces_the_conflict(self):
        self._race_handover(legacy_period_lock=True)
