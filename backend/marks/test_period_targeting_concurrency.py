from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.db import close_old_connections, connection, connections
from django.test import override_settings
from rest_framework.test import APITransactionTestCase

from . import test_period_targeting as fixture
from .models import EvaluationTask
from .services import ensure_period_tasks


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locking")
@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class PeriodTargetingConcurrencyTests(APITransactionTestCase):
    setUp = fixture.PeriodTargetingTests.setUp
    user = fixture.PeriodTargetingTests.user
    lecturer = fixture.PeriodTargetingTests.lecturer
    profile = fixture.PeriodTargetingTests.profile
    payload = fixture.PeriodTargetingTests.payload
    period = fixture.PeriodTargetingTests.period
    publish = fixture.PeriodTargetingTests.publish

    def test_concurrent_generation_creates_each_scoped_assignment_once(self):
        self.profile("in-scope")
        self.profile("out-of-scope", "Programme B")
        period = self.period(programmeScope="SELECTED", programmes=["Programme A"], evaluatorRoles=["PANEL"])
        self.publish(period)
        barrier = Barrier(2)

        def generate():
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '10s'")
                    cursor.execute("SET statement_timeout = '20s'")
                barrier.wait(timeout=10)
                return ensure_period_tasks(period, actor=self.office)["total"]
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(generate) for _ in range(2)]
            self.assertEqual(sorted(future.result(timeout=30) for future in futures), [0, 1])
        self.assertEqual(list(EvaluationTask.objects.values_list("profile__matric_no", "evaluator_role")),
                         [("in-scope", "PANEL")])

    def test_concurrent_differently_named_publications_reserve_coverage_once(self):
        from django.core.exceptions import ValidationError
        from .models import EvaluationPeriod
        from .services import publish_evaluation_period
        first = self.period(name="First publication", assessment="P1")
        second = self.period(name="Second publication", assessment="P1")
        barrier = Barrier(2)

        def publish(period):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '10s'")
                    cursor.execute("SET statement_timeout = '20s'")
                barrier.wait(timeout=10)
                try:
                    publish_evaluation_period(period=period, actor=self.office)
                    return "published"
                except ValidationError as exc:
                    if "coverage" not in str(exc):
                        raise
                    return "conflict"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(publish, period) for period in (first, second)]
            self.assertEqual(sorted(future.result(timeout=30) for future in futures), ["conflict", "published"])
        self.assertEqual(EvaluationPeriod.objects.filter(lifecycle_status="PUBLISHED").count(), 1)
