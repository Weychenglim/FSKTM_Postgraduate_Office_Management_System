from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.db import close_old_connections, connection, connections
from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from academics.models import SemesterCapacityPlan
from academics.capacity_services import (
    capacity_plan_content_fingerprint,
    clone_capacity_plan,
    publish_capacity_plan,
    update_capacity_entry,
)
from accounts.models import Student, User
from . import test_co_supervision as fixture
from .co_supervision import CoSupervisionConflict, decide, nominate
from .models import (
    CoSupervisorAppointment,
    CoSupervisorNomination,
    SupervisorApplication,
    SupervisorAppointment,
)


class CoSupervisionConcurrencyTests(APITransactionTestCase):
    setUp = fixture.CoSupervisionTests.setUp
    _lecturer = fixture.CoSupervisionTests._lecturer

    def parallel(self, functions):
        barrier = Barrier(len(functions))

        def worker(function):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '10s'")
                    cursor.execute("SET statement_timeout = '20s'")
                barrier.wait(timeout=10)
                try:
                    function()
                    return "committed"
                except CoSupervisionConflict:
                    return "conflict"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=len(functions)) as pool:
            futures = [pool.submit(worker, function) for function in functions]
            return [future.result(timeout=30) for future in futures]

    def submit(self, student, candidate):
        return nominate(
            actor=self.supervisor,
            student_id=student.pk,
            candidate_id=candidate.pk,
            justification="Shared research expertise",
        )

    def test_competing_nominations_cannot_claim_same_last_team_position(self):
        first = self.submit(self.student, self.new_supervisor)
        decide(nomination_id=first.pk, actor=self.new_supervisor, action="accept")
        decide(nomination_id=first.pk, actor=self.coordinator, action="approve")
        results = self.parallel(
            [
                lambda: self.submit(self.student, self.panel),
                lambda: self.submit(self.student, self.new_panel),
            ]
        )
        self.assertCountEqual(results, ["committed", "conflict"])
        self.assertEqual(
            CoSupervisorNomination.objects.filter(
                student=self.student, status__in=CoSupervisorNomination.PENDING_STATUSES
            ).count(),
            1,
        )

    def test_competing_approvals_cannot_exceed_shared_lecturer_capacity(self):
        second_user = User.objects.create_user(
            email="second-race@example.test",
            full_name="Second race student",
            role=User.Role.STUDENT,
        )
        second = Student.objects.create(
            user=second_user, matric_no="CO-RACE-002", programme=self.student.programme
        )
        application = SupervisorApplication.objects.create(
            student=second,
            proposed_supervisor=self.supervisor,
            academic_semester=self.semester,
            research_title="Second student",
            research_area="Computing",
            research_abstract="Research",
            status="APPROVED",
            supervisor_decided_at=timezone.now(),
            coordinator_decided_at=timezone.now(),
        )
        SupervisorAppointment.objects.create(
            application=application,
            student=second,
            supervisor=self.supervisor,
            approved_by=self.coordinator,
        )
        plan = clone_capacity_plan(
            SemesterCapacityPlan.objects.get(
                academic_semester=self.semester, lifecycle_status="PUBLISHED"
            ),
            actor=self.office,
        )
        update_capacity_entry(
            plan,
            actor=self.office,
            lecturer=self.new_supervisor.lecturer,
            supervisor_limit=1,
            panel_limit=None,
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
        publish_capacity_plan(
            plan,
            actor=self.office,
            reason="Capacity race test",
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
        first_nomination = self.submit(self.student, self.new_supervisor)
        second_nomination = self.submit(second, self.new_supervisor)
        for row in [first_nomination, second_nomination]:
            decide(nomination_id=row.pk, actor=self.new_supervisor, action="accept")
        results = self.parallel(
            [
                lambda: decide(
                    nomination_id=first_nomination.pk,
                    actor=self.coordinator,
                    action="approve",
                ),
                lambda: decide(
                    nomination_id=second_nomination.pk,
                    actor=self.coordinator,
                    action="approve",
                ),
            ]
        )
        self.assertCountEqual(results, ["committed", "conflict"])
        self.assertEqual(
            CoSupervisorAppointment.objects.filter(
                supervisor=self.new_supervisor, status="ACTIVE"
            ).count(),
            1,
        )
        self.assertEqual(
            CoSupervisorNomination.objects.filter(status="PENDING_COORDINATOR").count(),
            1,
        )
