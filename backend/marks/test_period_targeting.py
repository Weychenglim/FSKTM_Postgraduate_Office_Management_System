"""Programme and official-role boundaries for preview and task creation."""

from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Lecturer, OfficeStaff, Student
from academics.models import AcademicSemester
from academics.test_capacity_helpers import publish_test_capacity_plan
from appointments.models import (
    PanelAppointment, PanelRecommendation, StudentResearchProfile,
    SupervisorApplication, SupervisorAppointment,
)
from .models import EvaluationPeriod, EvaluationTask, MarkEntry, Rubric, RubricComponent
from .services import create_backup_evaluation_task, ensure_period_tasks

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class PeriodTargetingTests(APITestCase):
    def setUp(self):
        self.office = self.user("office", User.Role.OFFICE_ADMIN)
        self.office.is_staff = False
        self.office.save(update_fields=["is_staff"])
        OfficeStaff.objects.create(user=self.office, staff_no="TARGET-OFFICE")
        self.supervisor = self.lecturer("supervisor")
        self.panel = self.lecturer("panel")
        self.backup = self.lecturer("backup")
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(
            code="TARGET-S1", academic_session="2026/2027",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timezone.timedelta(days=30),
            ends_on=today + timezone.timedelta(days=90),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office, activated_at=timezone.now(),
        )
        publish_test_capacity_plan(self.semester, self.office)
        self.rubric = Rubric.objects.create(name="Target rubric", code="target-rubric", allowed_evaluator_roles=["SUPERVISOR", "PANEL"])
        RubricComponent.objects.create(
            rubric=self.rubric, code="total", name="Total", max_marks="100.00",
        )
        self.client.force_authenticate(self.office)

    def user(self, name, role):
        return User.objects.create_user(
            email=f"target-{name}@example.test", password="password123",
            full_name=name.title(), role=role,
        )

    def lecturer(self, name):
        user = self.user(name, User.Role.LECTURER)
        Lecturer.objects.create(user=user, staff_no=f"TARGET-{name}")
        return user

    def profile(self, name, programme="Programme A", *, linked=True, appointed=True):
        student_user = self.user(name, User.Role.STUDENT) if linked else None
        if linked:
            Student.objects.create(user=student_user, matric_no=name, programme=programme)
        profile = StudentResearchProfile.objects.create(
            student=student_user, matric_no=name, student_name=name,
            programme=programme, semester=self.semester.label,
            proposed_topic="Programme targeting", supervisor=self.supervisor,
        )
        if appointed:
            if linked:
                application = SupervisorApplication.objects.create(
                    student=student_user.student, proposed_supervisor=self.supervisor,
                    research_title=profile.proposed_topic, research_abstract="Research",
                    status=SupervisorApplication.Status.APPROVED,
                )
                SupervisorAppointment.objects.create(
                    application=application, student=student_user.student,
                    supervisor=self.supervisor, approved_by=self.office,
                )
            recommendation = PanelRecommendation.objects.create(
                profile=profile, supervisor=self.supervisor, recommended_member=self.panel,
                status=PanelRecommendation.Status.APPROVED,
            )
            PanelAppointment.objects.create(
                recommendation=recommendation, profile=profile,
                supervisor=self.supervisor, panel_member=self.panel, approved_by=self.office,
            )
        return profile

    def payload(self, **targeting):
        return {
            "assessment": "P1",
            "name": f"Target period {EvaluationPeriod.objects.count()}",
            "semesterId": self.semester.pk, "rubricId": self.rubric.pk,
            "opensAt": (timezone.now() - timezone.timedelta(hours=1)).isoformat(),
            "closesAt": (timezone.now() + timezone.timedelta(days=7)).isoformat(),
            **targeting,
        }

    def period(self, **targeting):
        response = self.client.post("/api/marks/periods/", self.payload(**targeting), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return EvaluationPeriod.objects.get(pk=response.data["id"])

    def preview(self, period):
        response = self.client.get(f"/api/marks/periods/{period.pk}/recipient-preview/")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        return response.data

    def publish(self, period):
        response = self.client.post(f"/api/marks/periods/{period.pk}/publish/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        period.refresh_from_db()

    def test_assignment_options_use_linked_programme_including_blank_and_legacy_fallback(self):
        linked = self.profile("assignment-linked", "Programme A")
        linked.programme = "Stale Programme"
        linked.save(update_fields=["programme"])
        blank = self.profile("assignment-blank", "")
        blank.programme = "Stale Programme"
        blank.save(update_fields=["programme"])
        legacy = self.profile("assignment-legacy", "Programme B", linked=False)
        response = self.client.get("/api/marks/assignment-options/")
        self.assertEqual(response.status_code, 200)
        programmes = {row["studentId"]: row["programme"] for row in response.data["students"]}
        self.assertEqual(programmes[linked.matric_no], "Programme A")
        self.assertEqual(programmes[blank.matric_no], "")
        self.assertEqual(programmes[legacy.matric_no], "Programme B")

    def test_omitted_targeting_preserves_legacy_defaults(self):
        period = self.period()
        self.assertEqual(period.programme_scope, "ALL")
        self.assertEqual(period.programmes, [])
        self.assertEqual(period.evaluator_roles, ["SUPERVISOR", "PANEL"])
        response = self.client.get(f"/api/marks/periods/{period.pk}/")
        self.assertEqual(response.data["programmeScope"], "ALL")
        self.assertEqual(response.data["programmes"], [])
        self.assertEqual(response.data["evaluatorRoles"], ["SUPERVISOR", "PANEL"])

    def test_invalid_targeting_is_rejected_on_create(self):
        for targeting in (
            {"programmeScope": "SELECTED", "programmes": []},
            {"programmeScope": "SELECTED", "programmes": [" "]},
            {"programmeScope": "INVALID"},
            {"evaluatorRoles": []}, {"evaluatorRoles": ["BACKUP"]},
            {"evaluatorRoles": ["SUPERVISOR", "UNKNOWN"]},
        ):
            with self.subTest(targeting=targeting):
                response = self.client.post("/api/marks/periods/", self.payload(**targeting), format="json")
                self.assertEqual(response.status_code, 400, response.data)

    def test_draft_targeting_edit_and_published_lock(self):
        period = self.period()
        values = {"programmeScope": "SELECTED", "programmes": ["Programme A"], "evaluatorRoles": ["PANEL"]}
        response = self.client.patch(f"/api/marks/periods/{period.pk}/", values, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["evaluatorRoles"], ["PANEL"])
        self.publish(period)
        for values in ({"programmeScope": "ALL"}, {"programmes": ["Programme B"]}, {"evaluatorRoles": ["SUPERVISOR"]}):
            response = self.client.patch(f"/api/marks/periods/{period.pk}/", values, format="json")
            self.assertEqual(response.status_code, 409, response.data)

    def test_preview_matches_generation_and_is_read_only_and_idempotent(self):
        self.profile("included", " Programme A ")
        self.profile("excluded", "Programme B")
        self.profile("blank", "")
        period = self.period(programmeScope="SELECTED", programmes=["programme a"], evaluatorRoles=["SUPERVISOR"])
        preview = self.preview(period)
        self.assertEqual(preview["periodId"], period.pk)
        self.assertTrue(preview["generatedAt"])
        self.assertEqual([(r["matricNo"], r["evaluatorRole"], r["taskStatus"]) for r in preview["recipients"]], [("included", "SUPERVISOR", "NEW")])
        self.assertEqual(preview["totals"], {"students": 1, "supervisor": 1, "panel": 0, "total": 1, "existing": 0, "new": 1})
        self.assertEqual(EvaluationTask.objects.count(), 0)
        self.assertEqual(MarkEntry.objects.count(), 0)
        self.publish(period)
        ensure_period_tasks(period, actor=self.office)
        self.assertEqual(ensure_period_tasks(period, actor=self.office)["total"], 0)
        self.assertEqual(set(EvaluationTask.objects.values_list("profile__matric_no", "evaluator_role")), {("included", "SUPERVISOR")})
        self.assertEqual(self.preview(period)["totals"]["existing"], 1)
        self.assertEqual(self.preview(period)["totals"]["new"], 0)

    def test_linked_student_programme_is_authoritative_with_unlinked_fallback(self):
        stale = self.profile("stale", "Programme B")
        stale.programme = "Programme A"
        stale.save(update_fields=["programme"])
        blank = self.profile("linked-blank", "")
        blank.programme = "Programme A"
        blank.save(update_fields=["programme"])
        unlinked = self.profile("unlinked", " Programme A ", linked=False)
        period = self.period(programmeScope="SELECTED", programmes=["programme a"], evaluatorRoles=["PANEL"])
        rows = self.preview(period)["recipients"]
        self.assertEqual([r["matricNo"] for r in rows], [unlinked.matric_no])
        self.assertIsNone(rows[0]["studentId"])

    def test_all_includes_blank_programmes_and_selected_roles_only(self):
        profile = self.profile("all-blank", "")
        period = self.period(evaluatorRoles=["PANEL"])
        rows = self.preview(period)["recipients"]
        self.assertEqual([(r["studentId"], r["evaluatorRole"]) for r in rows], [(profile.student_id, "PANEL")])

    def test_missing_appointments_only_count_targeted_students_and_roles(self):
        self.profile("missing", appointed=False)
        self.profile("outside", "Programme B", appointed=False)
        period = self.period(programmeScope="SELECTED", programmes=["Programme A"], evaluatorRoles=["PANEL"])
        preview = self.preview(period)
        self.assertEqual(preview["recipients"], [])
        self.assertEqual(preview["missingAppointments"], {"supervisor": 0, "panel": 1})
        self.publish(period)  # An empty recipient set does not block publication.

    def test_ineligible_students_and_lecturers_are_excluded(self):
        inactive = self.profile("inactive")
        Student.objects.filter(pk=inactive.student_id).update(status=Student.Status.DEFERRED)
        self.profile("active")
        User.objects.filter(pk=self.panel.pk).update(is_active=False)
        period = self.period()
        rows = self.preview(period)["recipients"]
        self.assertEqual([(r["matricNo"], r["evaluatorRole"]) for r in rows], [("active", "SUPERVISOR")])

    def test_late_eligible_appointment_obeys_scope_on_lecturer_task_load(self):
        period = self.period(programmeScope="SELECTED", programmes=["Programme A"], evaluatorRoles=["PANEL"])
        self.publish(period)
        self.profile("late-in")
        self.profile("late-out", "Programme B")
        self.client.force_authenticate(self.panel)
        response = self.client.get("/api/marks/my-evaluation-tasks/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(EvaluationTask.objects.values_list("profile__matric_no", "evaluator_role")), {("late-in", "PANEL")})

    def test_programme_options_and_preview_are_office_only(self):
        self.profile("option", "Programme A")
        self.profile("empty-option", "")
        period = self.period()
        response = self.client.get("/api/marks/programme-options/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Programme A", response.data)
        self.assertNotIn("", response.data)
        self.assertTrue(all(isinstance(item, str) for item in response.data))
        for user in (self.panel, self.user("coordinator", User.Role.COORDINATOR), self.user("viewer", User.Role.STUDENT)):
            self.client.force_authenticate(user)
            for path in ("/api/marks/programme-options/", f"/api/marks/periods/{period.pk}/recipient-preview/"):
                self.assertEqual(self.client.get(path).status_code, 403)

    def test_backup_rejects_out_of_scope_student(self):
        profile = self.profile("outside-backup", "Programme B")
        period = self.period(programmeScope="SELECTED", programmes=["Programme A"])
        self.publish(period)
        with self.assertRaises(ValidationError):
            create_backup_evaluation_task(period=period, profile=profile, evaluator=self.backup, actor=self.office, reason="Cover absence")

    def test_standalone_backup_permitted_within_programme(self):
        profile = self.profile("inside-backup")
        period = self.period(programmeScope="SELECTED", programmes=["Programme A"], evaluatorRoles=["PANEL"])
        self.publish(period)
        task = create_backup_evaluation_task(period=period, profile=profile, evaluator=self.backup, actor=self.office, reason="Cover absence")
        self.assertEqual(task.evaluator_role, "BACKUP")

    def test_backup_original_must_match_period_student_and_included_official_role(self):
        profile = self.profile("backup-original")
        other = self.profile("backup-other")
        period = self.period(evaluatorRoles=["PANEL"])
        other_period = self.period()
        self.publish(period)
        originals = [
            EvaluationTask.objects.create(period=other_period, profile=profile, evaluator=self.panel, evaluator_role="PANEL"),
            EvaluationTask.objects.create(period=period, profile=other, evaluator=self.panel, evaluator_role="PANEL"),
            EvaluationTask.objects.create(period=period, profile=profile, evaluator=self.supervisor, evaluator_role="SUPERVISOR"),
            EvaluationTask.objects.create(period=period, profile=profile, evaluator=self.panel, evaluator_role="BACKUP"),
        ]
        for original in originals:
            with self.subTest(original=original.pk), self.assertRaises(ValidationError):
                create_backup_evaluation_task(period=period, profile=profile, evaluator=self.backup, actor=self.office, reason="Cover absence", original_task=original)

    def test_reconciliation_does_not_report_untargeted_assignments_missing(self):
        from dashboard.reconciliation import _detect_marks_issues
        profile = self.profile("reconcile-in")
        self.profile("reconcile-out", "Programme B")
        period = self.period(programmeScope="SELECTED", programmes=["Programme A"], evaluatorRoles=["PANEL"])
        self.publish(period)
        EvaluationTask.objects.create(period=period, profile=profile, evaluator=self.panel, evaluator_role="PANEL")
        issues = [issue for issue in _detect_marks_issues() if issue.issue_type == "MARKS_TASKS_MISSING" and issue.record_id == str(period.pk)]
        self.assertEqual(issues, [])

    def test_handover_preserves_draft_but_does_not_assign_outside_current_programme(self):
        from .services import ensure_replacement_evaluation_tasks
        profile = self.profile("handover")
        period = self.period(programmeScope="SELECTED", programmes=["Programme A"], evaluatorRoles=["PANEL"])
        self.publish(period)
        task = EvaluationTask.objects.create(period=period, profile=profile, evaluator=self.panel, evaluator_role="PANEL")
        entry = MarkEntry.objects.create(task=task, status=MarkEntry.Status.DRAFT, comments="Existing draft feedback")
        Student.objects.filter(pk=profile.student_id).update(programme="Programme B")
        ensure_replacement_evaluation_tasks(
            old_appointment=PanelAppointment.objects.get(profile=profile),
            replacement_appointment=SimpleNamespace(panel_member=self.backup),
            actor=self.office, reason="Panel handover",
        )
        task.refresh_from_db()
        entry.refresh_from_db()
        self.assertEqual(task.lifecycle_status, EvaluationTask.Lifecycle.RETIRED)
        self.assertEqual(entry.comments, "Existing draft feedback")
        self.assertFalse(EvaluationTask.objects.filter(period=period, evaluator=self.backup).exists())

    def test_handover_keeps_submitted_history_without_replacement(self):
        from .services import ensure_replacement_evaluation_tasks
        profile = self.profile("submitted-handover")
        period = self.period(programmeScope="SELECTED", programmes=["Programme A"], evaluatorRoles=["PANEL"])
        self.publish(period)
        task = EvaluationTask.objects.create(period=period, profile=profile, evaluator=self.panel, evaluator_role="PANEL")
        entry = MarkEntry.objects.create(task=task, status=MarkEntry.Status.SUBMITTED, comments="Final feedback", submitted_at=timezone.now())
        ensure_replacement_evaluation_tasks(
            old_appointment=PanelAppointment.objects.get(profile=profile),
            replacement_appointment=SimpleNamespace(panel_member=self.backup),
            actor=self.office, reason="Panel handover",
        )
        task.refresh_from_db()
        entry.refresh_from_db()
        self.assertEqual(task.lifecycle_status, EvaluationTask.Lifecycle.ACTIVE)
        self.assertEqual(entry.status, MarkEntry.Status.SUBMITTED)
        self.assertEqual(entry.comments, "Final feedback")
        self.assertFalse(EvaluationTask.objects.filter(period=period, evaluator=self.backup).exists())
