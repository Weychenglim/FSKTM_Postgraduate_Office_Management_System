"""Publication must honour live commitments without rewriting appointments."""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Student, User
from appointments.models import (
    CoSupervisorAppointment, CoSupervisorNomination, PanelAppointment,
    PanelRecommendation, StudentResearchProfile, SupervisorApplication,
    SupervisorAppointment,
)

from .capacity_services import (
    CapacityLifecycleConflict, capacity_plan_content_fingerprint,
    clone_capacity_plan, publish_capacity_plan, update_capacity_entry,
    validate_capacity_plan_ready,
)
from .models import LecturerCapacityAudit, SemesterCapacityPlan
from . import test_capacity as fixtures


class CapacityPublicationWorkloadTests(TestCase):
    setUpTestData = classmethod(fixtures.CapacityLifecycleTests.setUpTestData.__func__)
    create_lecturer = classmethod(fixtures.CapacityLifecycleTests.create_lecturer.__func__)
    complete_plan = fixtures.CapacityLifecycleTests.complete_plan
    publish_complete_plan = fixtures.CapacityLifecycleTests.publish_complete_plan

    def setUp(self):
        self.index = 0
        self.current = self.publish_complete_plan()
        self.draft = clone_capacity_plan(self.current, actor=self.office)

    def student(self):
        self.index += 1
        user = User.objects.create_user(
            email=f"publication.student.{self.index}@example.test",
            full_name=f"Publication Student {self.index}", role=User.Role.STUDENT,
        )
        return Student.objects.create(
            user=user, matric_no=f"PUBLICATION-{self.index}", programme="Computing",
        )

    def primary(self, *, student=None, lecturer=None):
        student = student or self.student()
        lecturer = lecturer or self.lecturer
        application = SupervisorApplication.objects.create(
            student=student, proposed_supervisor=lecturer.user,
            academic_semester=self.prior_semester, research_title="Research",
            research_abstract="Research", status="APPROVED",
        )
        return SupervisorAppointment.objects.create(
            student=student, supervisor=lecturer.user, application=application,
            approved_by=self.office,
        )

    def supporting(self, *, active=True):
        primary = self.primary(lecturer=self.supervisor_only)
        nomination = CoSupervisorNomination.objects.create(
            student=primary.student, primary_appointment=primary,
            nominator=self.supervisor_only.user, candidate=self.lecturer.user,
            academic_semester=self.prior_semester, justification="Expertise",
            status="APPROVED" if active else "PENDING_COORDINATOR",
        )
        if active:
            return CoSupervisorAppointment.objects.create(
                nomination=nomination, student=primary.student,
                supervisor=self.lecturer.user, approved_by=self.office,
            )
        return nomination

    def panel(self, status):
        student = self.student()
        profile = StudentResearchProfile.objects.create(
            student=student.user, matric_no=student.matric_no,
            student_name=student.user.full_name, programme=student.programme,
            semester="Prior semester", proposed_topic="Research",
            supervisor=self.supervisor_only.user,
        )
        recommendation = PanelRecommendation.objects.create(
            profile=profile, supervisor=self.supervisor_only.user,
            recommended_member=self.lecturer.user,
            academic_semester=self.prior_semester, status=status,
        )
        if status == "APPROVED":
            return PanelAppointment.objects.create(
                recommendation=recommendation, profile=profile,
                supervisor=self.supervisor_only.user,
                panel_member=self.lecturer.user, approved_by=self.office,
            )
        return recommendation

    def limits(self, supervisor=5, panel=8):
        update_capacity_entry(
            self.draft, lecturer=self.lecturer, actor=self.office,
            supervisor_limit=supervisor, panel_limit=panel,
            expected_fingerprint=capacity_plan_content_fingerprint(self.draft),
        )

    def publish(self):
        return publish_capacity_plan(
            self.draft, actor=self.office, reason="Reviewed limits",
            expected_fingerprint=capacity_plan_content_fingerprint(self.draft),
        )

    def test_five_active_supervisor_appointments_block_limit_of_one_atomically(self):
        appointments = [self.primary() for _ in range(5)]
        self.limits(supervisor=1)
        audits = LecturerCapacityAudit.objects.count()
        with self.assertRaisesRegex(CapacityLifecycleConflict, "Supervisor.*5"):
            self.publish()
        self.current.refresh_from_db()
        self.draft.refresh_from_db()
        self.assertEqual(self.current.lifecycle_status, "PUBLISHED")
        self.assertEqual(self.draft.lifecycle_status, "DRAFT")
        self.assertEqual(LecturerCapacityAudit.objects.count(), audits)
        self.assertEqual(SupervisorAppointment.objects.filter(
            pk__in=[row.pk for row in appointments], status="ACTIVE",
        ).count(), 5)

    def test_primary_and_supporting_workload_across_semesters_is_combined(self):
        self.primary()
        self.supporting()
        self.limits(supervisor=1)
        errors = validate_capacity_plan_ready(self.draft)
        self.assertTrue(any("Supervisor" in error and "2" in error for error in errors))
        with self.assertRaises(CapacityLifecycleConflict):
            self.publish()

    def test_panel_limit_includes_active_and_accepted_but_not_unanswered_nominations(self):
        self.panel("APPROVED")
        self.panel("SUBMITTED_TO_PANEL")
        self.panel("PENDING_COORDINATOR")
        self.limits(panel=1)
        with self.assertRaisesRegex(CapacityLifecycleConflict, "Panel.*2"):
            self.publish()
        self.limits(panel=2)
        self.assertEqual(self.publish().lifecycle_status, "PUBLISHED")

    def test_limit_equal_to_load_and_zero_without_load_can_publish(self):
        self.primary()
        self.limits(supervisor=1, panel=0)
        self.assertEqual(validate_capacity_plan_ready(self.draft), [])
        self.assertEqual(self.publish().lifecycle_status, "PUBLISHED")

    def test_ended_terminal_and_unaccepted_supervisor_requests_do_not_count(self):
        appointment = self.primary()
        SupervisorAppointment.objects.filter(pk=appointment.pk).update(status="ENDED")
        for status in ("REJECTED_BY_PANEL", "REJECTED_BY_COORDINATOR",
                       "CANCELLED_BY_SUPERVISOR", "CANCELLED_BY_OFFICE"):
            self.panel(status)
        SupervisorApplication.objects.create(
            student=self.student(), proposed_supervisor=self.lecturer.user,
            academic_semester=self.semester, research_title="Pending",
            research_abstract="Pending", status="SUBMITTED_TO_SUPERVISOR",
        )
        self.supporting(active=False)
        self.limits(supervisor=0, panel=0)
        self.assertEqual(self.publish().lifecycle_status, "PUBLISHED")

    def test_accepted_primary_request_reserves_capacity_before_appointment(self):
        application = SupervisorApplication.objects.create(
            student=self.student(), proposed_supervisor=self.lecturer.user,
            academic_semester=self.semester, research_title="Accepted request",
            research_abstract="Awaiting Coordinator", status="PENDING_COORDINATOR",
        )
        self.limits(supervisor=0, panel=0)
        with self.assertRaisesRegex(CapacityLifecycleConflict, "0 active.*1 reserved"):
            self.publish()
        self.limits(supervisor=1, panel=0)
        self.assertEqual(self.publish().lifecycle_status, "PUBLISHED")
        application.refresh_from_db()
        self.assertEqual(application.status, "PENDING_COORDINATOR")
        self.assertFalse(SupervisorAppointment.objects.filter(application=application).exists())

    def test_publish_rechecks_workload_after_an_earlier_ready_preview(self):
        self.limits(supervisor=0)
        self.assertEqual(validate_capacity_plan_ready(self.draft), [])
        fingerprint = capacity_plan_content_fingerprint(self.draft)
        self.primary()
        self.assertEqual(capacity_plan_content_fingerprint(self.draft), fingerprint)
        with self.assertRaises(CapacityLifecycleConflict):
            self.publish()

    def test_api_allows_draft_save_but_reports_workload_and_rejects_publication(self):
        self.primary()
        self.supporting()
        self.limits(supervisor=1)
        client = APIClient()
        client.force_authenticate(self.office)
        detail = client.get(f"/api/academics/capacity-plans/{self.draft.pk}/")
        self.assertEqual(detail.status_code, 200)
        self.assertFalse(detail.data["isComplete"])
        self.assertTrue(any("Supervisor" in error and "2" in error
                            for error in detail.data["readinessErrors"]))
        entry = next(row for row in detail.data["entries"]
                     if row["lecturerId"] == self.lecturer.pk)
        self.assertEqual(entry["supervisor"]["activeLoad"], 2)
        response = client.post(
            f"/api/academics/capacity-plans/{self.draft.pk}/publish/",
            {"reason": "Reviewed limits", "expectedVersion": self.draft.version,
             "expectedFingerprint": detail.data["contentFingerprint"]}, format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("Supervisor", str(response.data))

    def test_old_published_over_capacity_policy_remains_readable_and_cannot_be_edited(self):
        self.primary()
        self.limits(supervisor=0)
        # Represent a version published under the former policy, without using
        # the guarded publication service to create new invalid policy.
        self.current.lifecycle_status = SemesterCapacityPlan.Lifecycle.SUPERSEDED
        self.current.save(update_fields=["lifecycle_status"])
        self.draft.lifecycle_status = SemesterCapacityPlan.Lifecycle.PUBLISHED
        self.draft.save(update_fields=["lifecycle_status"])
        self.assertEqual(validate_capacity_plan_ready(self.draft), [])
        with self.assertRaises(CapacityLifecycleConflict):
            self.limits(supervisor=1)
