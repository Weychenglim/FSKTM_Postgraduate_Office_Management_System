"""The Marks stage gate uses effective Registry stages for the exact semester."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from academics.models import AcademicSemester
from accounts.models import ProjectRegistration, Student, StudentCompletion, StudentSemester
from .models import EvaluationPeriod
from . import stage_eligibility


class StageEligibilityTests(TestCase):
    def setUp(self):
        today = timezone.localdate()
        self.office = get_user_model().objects.create_user(
            email="stage-office@example.test", role="OFFICE_ADMIN",
        )
        self.semester = AcademicSemester.objects.create(
            code="STAGE-S1", academic_session="2026/2027", term="SEMESTER_I",
            starts_on=today, ends_on=today + timezone.timedelta(days=90),
            created_by=self.office,
        )
        self.period = EvaluationPeriod(academic_semester=self.semester, assessment="P1")
        user = get_user_model().objects.create_user(
            email="stage@example.test", full_name="Stage student", role="STUDENT",
        )
        self.student = Student.objects.create(user=user, matric_no="STAGE-1")

    def studied(self):
        return StudentSemester.objects.create(student=self.student,
            session=self.semester.academic_session, term=self.semester.term, outcome='STUDIED')

    def registration(self, **overrides):
        return ProjectRegistration.objects.create(
            student=self.student, academic_semester=self.semester,
            **{"stage": "P1", **overrides},
        )

    def decision(self):
        return stage_eligibility.period_stage_eligibility(self.period, [self.student.pk])[self.student.pk]

    def test_only_matching_confirmed_stage_is_allowed(self):
        self.studied()
        record = self.registration()
        for assessment, stage, eligible, reason in (
            ("P1", "P1", True, ""), ("P2", "P2", True, ""),
            ("P1", "P2", False, "STAGE_MISMATCH"),
            ("P2", "P1", False, "STAGE_MISMATCH"),
        ):
            with self.subTest(assessment=assessment, stage=stage):
                self.period.assessment = assessment
                record.stage = stage
                record.save(update_fields=["stage"])
                decision = self.decision()
                self.assertEqual((decision.eligible, decision.reason), (eligible, reason))

    def test_missing_voided_and_no_project_are_excluded(self):
        self.assertEqual(self.decision().reason, "NO_SEMESTER_ROW")
        self.studied()
        record = self.registration(status="VOIDED")
        self.assertFalse(self.decision().eligible)
        self.assertEqual(self.decision().reason, "NOT_STARTED")
        record.status, record.stage = "CONFIRMED", "NONE"
        record.save(update_fields=["status", "stage"])
        self.assertFalse(self.decision().eligible)
        self.assertEqual(self.decision().reason, "NOT_STARTED")

    def test_other_semester_registration_cannot_supply_stage(self):
        self.registration()
        other = AcademicSemester.objects.create(
            code="STAGE-S2", academic_session="2026/2027", term="SEMESTER_II",
            starts_on=self.semester.ends_on + timezone.timedelta(days=1),
            ends_on=self.semester.ends_on + timezone.timedelta(days=90),
            created_by=self.office,
        )
        self.period.academic_semester = other
        self.assertFalse(self.decision().eligible)
        self.assertEqual(self.decision().reason, "NO_SEMESTER_ROW")

    def test_not_registered_overrides_confirmed_stage(self):
        self.registration()
        StudentSemester.objects.create(
            student=self.student, session="2026/2027", term="SEMESTER_I", outcome="NOT_REGISTERED",
        )
        decision = self.decision()
        self.assertFalse(decision.eligible)
        self.assertEqual(decision.reason, "NOT_REGISTERED")

    def test_unclassified_period_is_blocked_without_querying_registry(self):
        self.registration()
        for assessment in ("", "P3"):
            self.period.assessment = assessment
            with self.subTest(assessment=assessment), self.assertNumQueries(0):
                decision = self.decision()
                self.assertFalse(decision.eligible)
                self.assertEqual(decision.reason, "PERIOD_STAGE_NOT_CONFIGURED")
        self.period.assessment = "P1"
        self.period.academic_semester = None
        with self.assertNumQueries(0):
            self.assertEqual(self.decision().reason, "PERIOD_SEMESTER_NOT_CONFIGURED")

    def test_unlinked_student_is_excluded(self):
        with self.assertNumQueries(0):
            decision = stage_eligibility.period_stage_eligibility(self.period, [None])[None]
        self.assertFalse(decision.eligible)
        self.assertEqual(decision.reason, "STUDENT_NOT_LINKED")

    def test_leave_overrides_confirmed_stage(self):
        self.registration()
        outcome = StudentSemester.objects.create(
            student=self.student, session="2026/2027", term="SEMESTER_I", outcome="LEAVE",
        )
        for value in ("LEAVE", "LEAVE_MEDICAL", "LEAVE_MOBILITY"):
            with self.subTest(outcome=value):
                outcome.outcome = value
                outcome.save(update_fields=["outcome"])
                decision = self.decision()
                self.assertFalse(decision.eligible)
                self.assertEqual(decision.reason, "ON_LEAVE")

    def test_waiting_senate_excludes_later_semester_but_not_finished_semester(self):
        self.registration()
        self.studied()
        completion = StudentCompletion.objects.create(
            student=self.student, last_session="2026/2027", last_term="SEMESTER_I",
        )
        self.assertTrue(self.decision().eligible)
        completion.last_session = "2025/2026"
        completion.save(update_fields=["last_session"])
        self.assertFalse(self.decision().eligible)
        self.assertEqual(self.decision().reason, "FINISHED")

    def test_special_semester_requires_a_studied_row(self):
        self.semester.term = "SPECIAL"
        self.semester.save(update_fields=["term"])
        self.period.assessment = "P2"
        self.assertFalse(self.decision().eligible)
        self.registration(stage="P2")
        self.assertFalse(self.decision().eligible)
        self.studied()
        self.assertTrue(self.decision().eligible)

    def test_batch_is_read_only_and_does_not_query_per_student(self):
        self.registration()
        self.studied()
        ids = [self.student.pk]
        for index in range(10):
            user = get_user_model().objects.create_user(
                email=f"stage-{index}@example.test", role="STUDENT",
            )
            ids.append(Student.objects.create(user=user, matric_no=f"STAGE-{index+2}").pk)
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as single:
            self.decision()
        with self.assertNumQueries(len(single)):
            decisions = stage_eligibility.period_stage_eligibility(self.period, ids + ids + [None])
        self.assertEqual(set(decisions), set(ids + [None]))
        self.assertTrue(decisions[self.student.pk].eligible)
        self.assertTrue(all(not decisions[pk].eligible for pk in ids[1:]))
        self.assertEqual(ProjectRegistration.objects.count(), 1)
        self.assertEqual(ProjectRegistration.objects.get().revision, 1)
