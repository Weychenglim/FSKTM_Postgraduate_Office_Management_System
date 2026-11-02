from datetime import timedelta
from decimal import Decimal

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone
from rest_framework.test import APITestCase, APITransactionTestCase

from accounts.participant_lifecycle import (
    ParticipantLifecycleConflict,
    transition_lecturer,
    transition_student,
)
from accounts.test_registry_semesters import semesters_for
from marks.models import (
    EvaluationPeriod,
    EvaluationTask,
    MarkEntry,
    MarkScore,
    Rubric,
    RubricComponent,
)
from marks.services import ensure_period_tasks
from . import test_co_supervision as fixture
from . import test_appointment_lifecycle as primary_fixture
from .co_supervision import end_appointment
from .models import (
    AppointmentWorkflowEvent,
    CoSupervisorNomination,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)
from .supervisor_handoff import approve_supervisor_application


def submitted_marks(test):
    now = timezone.now()
    rubric = Rubric.objects.create(
        family_code="CO-HISTORY",
        code="CO-HISTORY-V1",
        name="Historical rubric",
        target_mark=100,
    )
    component = RubricComponent.objects.create(
        rubric=rubric,
        code="RESEARCH",
        name="Research",
        max_marks=100,
        display_order=1,
        is_required=True,
    )
    period = EvaluationPeriod.objects.create(
        name="Historical period",
        semester=test.semester.label,
        academic_semester=test.semester,
        rubric=rubric,
        opens_at=now - timedelta(days=1),
        closes_at=now + timedelta(days=3),
        lifecycle_status="PUBLISHED",
    )
    task = EvaluationTask.objects.create(
        profile=test.profile,
        evaluator=test.supervisor,
        period=period,
        evaluator_role="SUPERVISOR",
    )
    entry = MarkEntry.objects.create(
        task=task,
        status="SUBMITTED",
        total_mark=85,
        comments="Historical evaluation",
        submitted_at=now,
    )
    MarkScore.objects.create(entry=entry, component=component, marks_awarded=85)
    return entry, period


class CoSupervisionLifecycleTests(APITestCase):
    def setUp(self):
        fixture.CoSupervisionTests.setUp(self)
        self.office.is_staff = True
        self.office.save(update_fields=["is_staff"])

    _lecturer = fixture.CoSupervisionTests._lecturer
    nominate = fixture.CoSupervisionTests.nominate
    decide = fixture.CoSupervisionTests.decide
    activate = fixture.CoSupervisionTests.activate

    def test_graduation_closes_supporting_appointments_preserving_submitted_marks(self):
        appointment = self.activate()
        entry, _ = submitted_marks(self)
        semesters_for(self.student, "Semester I, 2026/2027", "Semester II, 2026/2027", "Semester I, 2027/2028")
        transition_student(
            matric_no=self.student.matric_no,
            actor=self.office,
            target_status="GRADUATED",
            reason="Completed programme",
        )
        appointment.refresh_from_db()
        entry.refresh_from_db()
        self.assertEqual(
            (appointment.status, appointment.end_outcome), ("ENDED", "COMPLETED")
        )
        self.assertEqual(
            (entry.status, entry.total_mark, entry.comments),
            ("SUBMITTED", Decimal("85"), "Historical evaluation"),
        )
        self.assertEqual(entry.scores.get().marks_awarded, Decimal("85"))

    def test_retirement_requires_supporting_appointments_to_end(self):
        appointment = self.activate()
        transition_lecturer(
            staff_no=self.new_supervisor.lecturer.staff_no,
            actor=self.office,
            target_status="RETIRING",
            reason="Retiring",
        )
        with self.assertRaises(ParticipantLifecycleConflict):
            transition_lecturer(
                staff_no=self.new_supervisor.lecturer.staff_no,
                actor=self.office,
                target_status="RETIRED",
                reason="Retired",
            )
        end_appointment(
            appointment_id=appointment.pk,
            actor=self.office,
            outcome="OTHER",
            reason="Retirement handover",
        )
        transition_lecturer(
            staff_no=self.new_supervisor.lecturer.staff_no,
            actor=self.office,
            target_status="RETIRED",
            reason="Retired",
        )
        self.new_supervisor.refresh_from_db()
        self.assertFalse(self.new_supervisor.is_active)

    def test_primary_handover_retains_cos_and_cancels_old_pending_nominations(self):
        appointment = self.activate()
        pending = self.nominate(self.panel).data["id"]
        replacement = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.new_panel,
            research_title=self.profile.proposed_topic,
            research_area=self.profile.research_area,
            research_abstract=self.profile.abstract,
            status="PENDING_COORDINATOR",
            supervisor_decided_at=timezone.now(),
            replaces_appointment=self.supervisor_appointment,
            replacement_reason="Primary retirement handover",
        )
        approve_supervisor_application(
            application_id=replacement.pk, actor=self.coordinator
        )
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "ACTIVE")
        self.assertEqual(
            CoSupervisorNomination.objects.get(pk=pending).status, "CANCELLED"
        )
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.supervisor_id, self.new_panel.pk)

    def test_supporting_appointment_never_generates_marks_or_grants_marks_write(self):
        self.activate()
        entry, period = submitted_marks(self)
        ensure_period_tasks(period, actor=self.office)
        self.assertFalse(
            EvaluationTask.objects.filter(evaluator=self.new_supervisor).exists()
        )
        self.client.force_authenticate(user=self.new_supervisor)
        response = self.client.put(
            f"/api/marks/tasks/{entry.task_id}/draft/",
            {"comments": "Unauthorized"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        entry.refresh_from_db()
        self.assertEqual(entry.comments, "Historical evaluation")

    def test_direct_closure_cancels_unfinished_replacement(self):
        appointment = self.activate()
        nomination = self.nominate(self.panel, appointment.pk).data["id"]
        end_appointment(
            appointment_id=appointment.pk,
            actor=self.office,
            outcome="OTHER",
            reason="No further supervision required",
        )
        self.assertEqual(
            CoSupervisorNomination.objects.get(pk=nomination).status, "CANCELLED"
        )
        self.assertEqual(self.decide(nomination, "accept", self.panel).status_code, 409)

    def test_final_panel_approval_rejects_supporting_role_even_if_nomination_preexisted(
        self,
    ):
        panel = PanelRecommendation.objects.create(
            profile=self.profile,
            academic_semester=self.semester,
            supervisor=self.supervisor,
            recommended_member=self.panel,
            status="PENDING_COORDINATOR",
            justification="Panel expertise",
            submitted_at=timezone.now(),
            panel_decided_at=timezone.now(),
        )
        # Represent an inconsistent imported record: final approval must still fail closed.
        CoSupervisorNomination.objects.create(
            student=self.student,
            primary_appointment=self.supervisor_appointment,
            nominator=self.supervisor,
            candidate=self.panel,
            academic_semester=self.semester,
            justification="Imported supporting request",
        )
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.post(
            f"/api/appointments/panel/recommendations/{panel.pk}/coordinator-approve/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        panel.refresh_from_db()
        self.assertEqual(panel.status, "PENDING_COORDINATOR")


class CoSupervisionMigrationPreservationTests(APITransactionTestCase):
    setUp = fixture.CoSupervisionTests.setUp
    _lecturer = fixture.CoSupervisionTests._lecturer
    _panel_appointment = primary_fixture.AppointmentLifecycleTests._panel_appointment

    def test_additive_migration_preserves_primary_panel_marks_and_audits(self):
        panel = self._panel_appointment()
        entry, _ = submitted_marks(self)
        event = AppointmentWorkflowEvent.objects.create(
            supervisor_application=self.application,
            actor=self.coordinator,
            actor_role=self.coordinator.role,
            action="COORDINATOR_APPROVE",
            previous_status="PENDING_COORDINATOR",
            new_status="APPROVED",
        )
        models = [
            SupervisorAppointment,
            StudentResearchProfile,
            type(panel),
            MarkEntry,
            MarkScore,
        ]
        before = [list(model.objects.order_by("pk").values()) for model in models]
        latest = MigrationExecutor(connection).loader.graph.leaf_nodes()
        try:
            MigrationExecutor(connection).migrate(
                [("appointments", "0011_alter_panelrecommendation_status_and_more")]
            )
            MigrationExecutor(connection).migrate(latest)
            self.assertEqual(
                before,
                [list(model.objects.order_by("pk").values()) for model in models],
            )
            self.assertEqual(
                AppointmentWorkflowEvent.objects.get(
                    pk=event.pk
                ).supervisor_application_id,
                self.application.pk,
            )
        finally:
            MigrationExecutor(connection).migrate(latest)
