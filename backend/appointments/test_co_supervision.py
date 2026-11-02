from django.core.exceptions import ValidationError
from rest_framework.test import APITestCase

from academics.capacity import CapacityRole, resolve_lecturer_capacity
from academics.models import LecturerCapacityEntry
from accounts.models import Panel, Supervisor
from marks.models import EvaluationTask
from . import test_appointment_lifecycle as fixture
from .models import (
    AppointmentWorkflowEvent,
    AppointmentLifecycleEvent,
    SupervisorAppointment,
)


class CoSupervisionTests(APITestCase):
    setUp = fixture.AppointmentLifecycleTests.setUp

    def test_student_sees_appointment_results_without_nomination_workflow(self):
        from announcements.models import Notification

        nomination = self.nominate().data["id"]
        self.client.force_authenticate(user=self.student_user)
        for path in ["/api/appointments/co-supervisor/", f"/api/appointments/co-supervisor/students/{self.student.pk}/"]:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["nominations"], [])
            self.assertNotIn("Additional subject expertise", str(response.data))
            for team in response.data.get("teams", [response.data]):
                self.assertEqual(team["nominations"], [])
                self.assertFalse(any(event["id"].startswith("co-nomination-") for event in team["timeline"]))
        self.assertFalse(Notification.objects.filter(recipient=self.student_user, record_type="CO_SUPERVISOR_NOMINATION").exists())
        self.decide(nomination, "accept", self.new_supervisor)
        self.assertFalse(Notification.objects.filter(recipient=self.student_user, record_type="CO_SUPERVISOR_NOMINATION").exists())
        self.decide(nomination, "approve", self.coordinator)
        self.client.force_authenticate(user=self.student_user)
        result = self.client.get("/api/appointments/co-supervisor/").data
        self.assertEqual(result["nominations"], [])
        appointment = result["appointments"][0]
        self.assertEqual(appointment["supervisor"]["id"], self.new_supervisor.pk)
        self.assertEqual(appointment["history"], [])
        self.assertIsNone(appointment["nominationId"])
        notices = self.client.get("/api/notifications/").data
        self.assertEqual(len(notices), 1)
        self.assertEqual(notices[0]["title"], "Supporting supervisor appointed")
        self.assertNotIn("Additional subject expertise", str(notices))
        self.client.force_authenticate(user=self.office)
        self.client.post(f"/api/appointments/co-supervisor/appointments/{appointment['id']}/end/", {"reason": "Internal staff explanation", "outcome": "COMPLETED"}, format="json")
        self.client.force_authenticate(user=self.student_user)
        result = self.client.get("/api/appointments/co-supervisor/").data
        self.assertEqual(result["appointments"][0]["status"], "ENDED")
        self.assertNotIn("Internal staff explanation", str(result))
        self.assertNotIn("Internal staff explanation", str(self.client.get("/api/notifications/").data))
        self.client.force_authenticate(user=self.supervisor)
        staff = self.client.get("/api/appointments/co-supervisor/").data
        self.assertEqual(staff["nominations"][0]["justification"], "Additional subject expertise.")
        self.assertEqual(staff["appointments"][0]["endReason"], "Internal staff explanation")

    def test_legacy_student_notifications_do_not_expose_staff_workflow(self):
        from announcements.models import Notification

        hidden = Notification.objects.create(recipient=self.student_user, title="Nomination updated", message="Private nomination", record_type="CO_SUPERVISOR_NOMINATION", record_id="1")
        ended = Notification.objects.create(recipient=self.student_user, title="Appointment ended", message="Private end reason", summary="Internal summary", record_type="CO_SUPERVISOR_APPOINTMENT", record_id="1")
        self.client.force_authenticate(user=self.student_user)
        feed = self.client.get("/api/notifications/")
        self.assertEqual(len(feed.data), 1)
        self.assertNotIn("Private", str(feed.data))
        self.assertNotIn("Internal summary", str(feed.data))
        self.assertEqual(self.client.post(f"/api/notifications/{hidden.pk}/read/").status_code, 404)
        self.assertNotIn("Private end reason", str(self.client.post(f"/api/notifications/{ended.pk}/read/").data))

    def _lecturer(self, email, staff_no, *, supervisor=False, panel=False):
        return fixture.AppointmentLifecycleTests._lecturer(
            self, email, staff_no, supervisor=supervisor or panel, panel=panel
        )

    _panel_appointment = fixture.AppointmentLifecycleTests._panel_appointment

    def nominate(self, candidate=None, replaces=None, actor=None):
        self.client.force_authenticate(user=actor or self.supervisor)
        data = {
            "studentId": self.student.pk,
            "candidateId": (candidate or self.new_supervisor).pk,
            "justification": "Additional subject expertise.",
        }
        if replaces:
            data["replacesAppointmentId"] = replaces
        return self.client.post(
            "/api/appointments/co-supervisor/nominations/", data, format="json"
        )

    def decide(self, row, action, actor, reason="Faculty decision."):
        self.client.force_authenticate(user=actor)
        return self.client.post(
            f"/api/appointments/co-supervisor/nominations/{row}/{action}/",
            {"reason": reason},
            format="json",
        )

    def activate(self, candidate=None, replaces=None):
        candidate = candidate or self.new_supervisor
        response = self.nominate(candidate, replaces)
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))
        row = response.data["id"]
        self.assertEqual(self.decide(row, "accept", candidate).status_code, 200)
        approved = self.decide(row, "approve", self.coordinator)
        self.assertEqual(approved.status_code, 200, approved.data)
        from .models import CoSupervisorAppointment

        return CoSupervisorAppointment.objects.get(nomination_id=row)

    def test_nomination_approval_audits_capacity_and_no_marks(self):
        before = EvaluationTask.objects.count()
        row = self.activate()
        self.assertEqual(row.status, "ACTIVE")
        self.assertEqual(row.nomination.workflow_events.count(), 3)
        self.assertEqual(row.lifecycle_events.count(), 1)
        capacity = resolve_lecturer_capacity(
            user=self.new_supervisor,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
        )
        self.assertEqual(capacity.active_load, 1)
        self.assertEqual(capacity.reserved_load, 0)
        self.assertEqual(EvaluationTask.objects.count(), before)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.supervisor_id, self.supervisor.pk)
        event = row.nomination.workflow_events.first()
        with self.assertRaises(ValidationError):
            event.save()
        with self.assertRaises(ValidationError):
            event.delete()

    def test_coordinator_rejection_retains_history_and_allows_new_attempt(self):
        from .models import CoSupervisorAppointment, CoSupervisorNomination

        nomination = self.nominate().data["id"]
        self.assertEqual(
            self.decide(nomination, "accept", self.new_supervisor).status_code, 200
        )
        self.assertEqual(
            self.decide(
                nomination, "coordinator-reject", self.coordinator, ""
            ).status_code,
            400,
        )
        rejected = self.decide(
            nomination,
            "coordinator-reject",
            self.coordinator,
            "Expertise does not match the proposed research.",
        )
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.data["status"], "REJECTED_BY_COORDINATOR")
        self.assertEqual(len(rejected.data["history"]), 3)
        self.assertFalse(CoSupervisorAppointment.objects.exists())
        retry = self.nominate()
        self.assertEqual(retry.status_code, 201)
        self.assertNotEqual(retry.data["id"], nomination)
        self.assertEqual(
            CoSupervisorNomination.objects.get(pk=nomination).status,
            "REJECTED_BY_COORDINATOR",
        )

    def test_final_approval_rechecks_new_temporary_unavailability(self):
        from datetime import timedelta
        from django.utils import timezone
        from academics.capacity_services import create_availability_window
        from .models import CoSupervisorAppointment, CoSupervisorNomination

        nomination = self.nominate().data["id"]
        self.assertEqual(
            self.decide(nomination, "accept", self.new_supervisor).status_code, 200
        )
        internal_reason = "Private availability management detail"
        create_availability_window(
            semester=self.semester,
            lecturer=self.new_supervisor.lecturer,
            role="SUPERVISOR",
            starts_on=timezone.localdate(),
            ends_on=timezone.localdate() + timedelta(days=1),
            actor=self.office,
            reason=internal_reason,
        )
        self.client.force_authenticate(user=self.supervisor)
        directory = self.client.get(
            f"/api/appointments/co-supervisor/students/{self.student.pk}/candidates/"
        )
        self.assertEqual(directory.status_code, 200)
        candidate = next(
            row for row in directory.data if row["id"] == self.new_supervisor.pk
        )
        self.assertEqual(candidate["staffId"], self.new_supervisor.lecturer.staff_no)
        self.assertEqual(candidate["department"], self.new_supervisor.lecturer.department)
        self.assertFalse(candidate["selectable"])
        self.assertEqual(candidate["capacityState"], "TEMPORARILY_UNAVAILABLE")
        self.assertNotIn(internal_reason, str(directory.data))
        result = self.decide(nomination, "approve", self.coordinator)
        self.assertEqual(result.status_code, 409)
        self.assertNotIn(internal_reason, str(result.data))
        self.assertEqual(
            CoSupervisorNomination.objects.get(pk=nomination).status,
            "PENDING_COORDINATOR",
        )
        self.assertFalse(CoSupervisorAppointment.objects.exists())

    def test_pending_team_limit_and_duplicate(self):
        first = self.nominate()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(self.nominate().status_code, 409)
        self.assertEqual(self.nominate(self.panel).status_code, 409)
        self.client.force_authenticate(user=self.supervisor)
        team = self.client.get(f"/api/appointments/co-supervisor/students/{self.student.pk}/").data
        self.assertFalse(team["canNominate"])
        self.assertEqual(self.decide(first.data["id"], "accept", self.new_supervisor).status_code, 200)
        self.assertEqual(self.nominate(self.panel).status_code, 409)
        self.assertEqual(self.decide(first.data["id"], "approve", self.coordinator).status_code, 200)
        second = self.nominate(self.panel)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(self.nominate(self.new_panel).status_code, 409)

    def test_rejected_and_cancelled_nominations_free_positions(self):
        row = self.nominate().data["id"]
        self.assertEqual(
            self.decide(row, "reject", self.new_supervisor).status_code, 200
        )
        self.assertEqual(
            self.decide(row, "accept", self.new_supervisor).status_code, 409
        )
        second = self.nominate().data["id"]
        self.assertEqual(
            self.decide(second, "cancel", self.supervisor, "").status_code, 400
        )
        self.assertEqual(
            self.decide(second, "cancel", self.supervisor).status_code, 200
        )
        self.assertEqual(self.nominate().status_code, 201)

    def test_final_approval_rechecks_capacity_without_partial_changes(self):
        row = self.nominate().data["id"]
        self.assertEqual(
            self.decide(row, "accept", self.new_supervisor).status_code, 200
        )
        from academics.capacity_services import (
            clone_capacity_plan,
            update_capacity_entry,
            publish_capacity_plan,
            capacity_plan_content_fingerprint,
        )
        from academics.models import SemesterCapacityPlan

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
            supervisor_limit=0,
            panel_limit=None,
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
        publish_capacity_plan(
            plan,
            actor=self.office,
            reason="Capacity reduced.",
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
        result = self.decide(row, "approve", self.coordinator)
        self.assertEqual(result.status_code, 409)
        from .models import CoSupervisorNomination, CoSupervisorAppointment

        self.assertEqual(
            CoSupervisorNomination.objects.get(pk=row).status, "PENDING_COORDINATOR"
        )
        self.assertEqual(CoSupervisorAppointment.objects.count(), 0)

    def test_authorization_and_restricted_team_read(self):
        self.assertEqual(self.nominate(actor=self.student_user).status_code, 403)
        row = self.nominate().data["id"]
        self.assertEqual(self.decide(row, "accept", self.panel).status_code, 403)
        self.assertEqual(
            self.decide(row, "accept", self.new_supervisor).status_code, 200
        )
        self.assertEqual(
            self.decide(row, "approve", self.other_coordinator).status_code, 403
        )
        self.assertEqual(self.decide(row, "approve", self.coordinator).status_code, 200)
        self.client.force_authenticate(user=self.new_supervisor)
        team = self.client.get(
            f"/api/appointments/co-supervisor/students/{self.student.pk}/"
        )
        self.assertEqual(team.status_code, 200)
        self.assertEqual(team.data["research"]["title"], self.profile.proposed_topic)
        self.assertFalse(team.data["canNominate"])
        self.assertNotIn("documents", team.data)
        self.assertNotIn("marks", team.data)
        self.assertEqual(
            self.client.get(
                f"/api/appointments/supervisor/applications/{self.application.pk}/"
            ).status_code,
            403,
        )
        self.client.force_authenticate(user=self.new_panel)
        self.assertEqual(
            self.client.get(
                f"/api/appointments/co-supervisor/students/{self.student.pk}/"
            ).status_code,
            403,
        )

    def test_closure_removes_team_access_but_retains_own_history(self):
        row = self.activate()
        self.client.force_authenticate(user=self.office)
        result = self.client.post(
            f"/api/appointments/co-supervisor/appointments/{row.pk}/end/",
            {"reason": "Completed support.", "outcome": "COMPLETED"},
            format="json",
        )
        self.assertEqual(result.status_code, 200)
        self.client.force_authenticate(user=self.new_supervisor)
        self.assertEqual(
            self.client.get(
                f"/api/appointments/co-supervisor/students/{self.student.pk}/"
            ).status_code,
            403,
        )
        workspace = self.client.get("/api/appointments/co-supervisor/")
        self.assertEqual(workspace.status_code, 200)
        self.assertEqual(workspace.data["teams"], [])
        self.assertEqual(workspace.data["appointments"][0]["status"], "ENDED")

    def test_primary_closure_retains_active_cos_and_cancels_pending(self):
        row = self.activate()
        pending = self.nominate(self.panel).data["id"]
        from .appointment_lifecycle import end_appointment

        end_appointment(
            model=SupervisorAppointment,
            appointment_id=self.supervisor_appointment.pk,
            actor=self.office,
            outcome="OTHER",
            reason="Primary ended.",
        )
        row.refresh_from_db()
        self.assertEqual(row.status, "ACTIVE")
        from .models import CoSupervisorNomination

        self.assertEqual(
            CoSupervisorNomination.objects.get(pk=pending).status, "CANCELLED"
        )

    def test_panel_conflicts_in_both_directions(self):
        self._panel_appointment()
        self.assertEqual(self.nominate(self.panel).status_code, 409)
        row = self.activate()
        Panel.objects.create(lecturer=self.new_supervisor.lecturer)
        self.client.force_authenticate(user=self.supervisor)
        response = self.client.post(
            "/api/appointments/panel/recommendations/",
            {
                "studentId": self.student.matric_no,
                "recommendedMemberId": self.new_supervisor.lecturer.staff_no,
                "status": "SUBMITTED_TO_PANEL",
                "justification": "Conflict",
                "replacesAppointmentId": self.profile.panel_appointments.first().pk,
                "replacementReason": "Panel change.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("supervis", str(response.data).lower())

    def test_replacement_keeps_outgoing_until_approval(self):
        row = self.activate()
        pending = self.nominate(self.panel, row.pk)
        self.assertEqual(pending.status_code, 201)
        row.refresh_from_db()
        self.assertEqual(row.status, "ACTIVE")
        self.assertEqual(
            self.decide(pending.data["id"], "accept", self.panel).status_code, 200
        )
        self.assertEqual(
            self.decide(pending.data["id"], "approve", self.coordinator).status_code,
            200,
        )
        row.refresh_from_db()
        self.assertEqual(row.status, "ENDED")
        self.assertEqual(row.end_outcome, "REPLACED")
        self.assertEqual(row.replacement_appointment.supervisor_id, self.panel.pk)

    def test_deferred_student_and_retiring_candidate_cannot_be_nominated(self):
        self.student.status = "deferred"
        self.student.save()
        self.assertEqual(self.nominate().status_code, 409)
        self.student.status = "active"
        self.student.save()
        self.new_supervisor.lecturer.lifecycle_status = "RETIRING"
        self.new_supervisor.lecturer.save()
        self.assertEqual(self.nominate().status_code, 409)

    def test_participant_blockers_include_active_and_pending_cos(self):
        from accounts.participant_lifecycle import lecturer_blockers, student_blockers

        row = self.nominate()
        self.assertEqual(row.status_code, 201)
        self.assertEqual(
            lecturer_blockers(self.new_supervisor.lecturer)[
                "pendingCoSupervisorNominations"
            ],
            1,
        )
        self.assertEqual(
            student_blockers(self.student)["pendingCoSupervisorNominations"], 1
        )

    def test_withdrawal_closes_cos_and_cancels_pending(self):
        from accounts.participant_lifecycle import transition_student

        row = self.activate()
        self.office.is_staff = True
        self.office.save()
        transition_student(
            matric_no=self.student.matric_no,
            actor=self.office,
            target_status="WITHDRAWN",
            reason="Withdrawn.",
        )
        row.refresh_from_db()
        self.assertEqual(row.status, "ENDED")
        self.assertEqual(row.end_outcome, "WITHDRAWN")
