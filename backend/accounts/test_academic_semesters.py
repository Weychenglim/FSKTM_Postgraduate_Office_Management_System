from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, TransactionTestCase
from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework.test import APIClient

from academics.capacity_services import (
    capacity_plan_content_fingerprint,
    create_capacity_plan,
    publish_capacity_plan,
    update_capacity_entry,
)
from academics.models import AcademicSemester, AcademicSemesterAudit
from academics.services import activate_semester, lock_academic_semesters
from academics.test_capacity_helpers import publish_test_capacity_plan
from accounts.models import Lecturer, Supervisor
from marks.models import EvaluationPeriod, MarksConfigurationAudit, Rubric

User = get_user_model()


class AcademicSemesterModelTests(TestCase):
    def test_semester_validates_session_and_exposes_stable_metadata(self):
        actor = User.objects.create_user(
            email="semester.model@example.test",
            password="local-test-password",
            full_name="Semester Model Actor",
            role=User.Role.OFFICE_ADMIN,
        )
        semester = AcademicSemester(
            academic_session="2026/2027",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2026, 7, 1),
            ends_on=date(2026, 12, 31),
            created_by=actor,
        )

        semester.full_clean()

        self.assertEqual(semester.code, "2026-2027-S1")
        self.assertEqual(semester.label, "Semester I 2026/2027")
        self.assertEqual(semester.effective_status, AcademicSemester.Lifecycle.DRAFT)

    def test_semester_rejects_non_consecutive_session(self):
        actor = User.objects.create_user(
            email="semester.invalid@example.test",
            password="local-test-password",
            full_name="Semester Invalid Actor",
            role=User.Role.OFFICE_ADMIN,
        )
        semester = AcademicSemester(
            academic_session="2026/2028",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2026, 7, 1),
            ends_on=date(2026, 12, 31),
            created_by=actor,
        )

        with self.assertRaises(ValidationError):
            semester.full_clean()

    def test_non_archived_semesters_cannot_overlap(self):
        actor = User.objects.create_user(
            email="semester.overlap@example.test",
            password="local-test-password",
            full_name="Semester Overlap Actor",
            role=User.Role.OFFICE_ADMIN,
        )
        AcademicSemester.objects.create(
            code="2026-2027-S1",
            academic_session="2026/2027",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2026, 7, 1),
            ends_on=date(2026, 12, 31),
            created_by=actor,
        )
        overlapping = AcademicSemester(
            academic_session="2026/2027",
            term=AcademicSemester.Term.SEMESTER_II,
            starts_on=date(2026, 12, 1),
            ends_on=date(2027, 5, 31),
            created_by=actor,
        )

        with self.assertRaises(ValidationError):
            overlapping.full_clean()


class AcademicSemesterLockOrderTests(TransactionTestCase):
    def test_activation_locks_reverse_id_target_and_current_in_pk_order(self):
        actor = User.objects.create_user(
            email="semester.locking@example.test",
            password="local-test-password",
            full_name="Semester Locking Actor",
            role=User.Role.OFFICE_ADMIN,
        )
        today = date.today()
        current = AcademicSemester.objects.create(
            code=f"{today.year - 1}-{today.year}-S2",
            academic_session=f"{today.year - 1}/{today.year}",
            term=AcademicSemester.Term.SEMESTER_II,
            starts_on=today - timedelta(days=120),
            ends_on=today - timedelta(days=1),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=actor,
        )
        target = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today,
            ends_on=today + timedelta(days=100),
            created_by=actor,
        )
        self.assertLess(current.pk, target.pk)
        publish_test_capacity_plan(target, actor)
        observed_lock_orders = []

        def record_lock_order(semester_ids=None):
            locked = lock_academic_semesters(semester_ids)
            observed_lock_orders.append(list(locked))
            return locked

        with patch(
            "academics.services.lock_academic_semesters",
            side_effect=record_lock_order,
        ):
            activated = activate_semester(
                target,
                actor=actor,
                reason="Exercise deterministic handover locking.",
            )

        current.refresh_from_db()
        self.assertEqual(observed_lock_orders, [[current.pk, target.pk]])
        self.assertEqual(current.lifecycle_status, AcademicSemester.Lifecycle.CLOSED)
        self.assertEqual(activated.lifecycle_status, AcademicSemester.Lifecycle.ACTIVE)


class AcademicSemesterApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.office = User.objects.create_user(
            email="semester.office@example.test",
            password="local-test-password",
            full_name="Semester Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.student = User.objects.create_user(
            email="semester.student@example.test",
            password="local-test-password",
            full_name="Semester Student",
            role=User.Role.STUDENT,
        )
        self.client.force_authenticate(self.office)

    def test_archived_identity_can_be_reused_without_changing_archived_record(self):
        archived = AcademicSemester.objects.create(code='2026-2027-S2', academic_session='2026/2027', term='SEMESTER_II', starts_on=date(2027, 8, 1), ends_on=date(2028, 1, 1), lifecycle_status='ARCHIVED', created_by=self.office)
        audit = AcademicSemesterAudit.objects.create(semester=archived, actor=self.office, action='ARCHIVE')
        response = self.client.post('/api/academics/semesters/', {'academicSession': '2026/2027', 'term': 'SEMESTER_II', 'startsOn': '2027-02-01', 'endsOn': '2027-07-01'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotEqual(response.data['id'], archived.pk)
        archived.refresh_from_db()
        self.assertEqual(archived.lifecycle_status, 'ARCHIVED')
        self.assertEqual(archived.code, '2026-2027-S2')
        audit.refresh_from_db()
        self.assertEqual(audit.semester_id, archived.pk)

    def test_database_rejects_two_non_archived_records_for_one_term(self):
        values = dict(code='2026-2027-S2', academic_session='2026/2027', term='SEMESTER_II', starts_on=date(2027, 8, 1), ends_on=date(2028, 1, 1), created_by=self.office)
        AcademicSemester.objects.create(**values)
        with self.assertRaises(IntegrityError), transaction.atomic():
            AcademicSemester.objects.create(**values)

    def test_duplicate_and_overlap_are_both_field_errors(self):
        AcademicSemester.objects.create(code='2026-2027-S2', academic_session='2026/2027', term='SEMESTER_II', starts_on=date(2027, 8, 1), ends_on=date(2028, 1, 1), created_by=self.office)
        AcademicSemester.objects.create(code='2026-2027-S1', academic_session='2026/2027', term='SEMESTER_I', starts_on=date(2026, 10, 30), ends_on=date(2027, 6, 1), lifecycle_status='ACTIVE', created_by=self.office)
        response = self.client.post('/api/academics/semesters/', {'academicSession': '2026/2027', 'term': 'SEMESTER_II', 'startsOn': '2027-02-01', 'endsOn': '2027-07-01'}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertIn('Semester II', str(response.data['term']))
        self.assertIn('Semester I 2026/2027', str(response.data['starts_on']))
        self.assertIn('1 Jun 2027', str(response.data['starts_on']))
        self.assertNotIn('__all__', response.data)
        self.assertNotIn('code', response.data)

    def test_office_creates_draft_and_all_roles_read_active_context(self):
        today = date.today()
        response = self.client.post(
            "/api/academics/semesters/",
            {
                "academicSession": f"{today.year}/{today.year + 1}",
                "term": "SEMESTER_I",
                "startsOn": (today - timedelta(days=10)).isoformat(),
                "endsOn": (today + timedelta(days=100)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        semester_id = response.data["id"]
        publish_test_capacity_plan(
            AcademicSemester.objects.get(pk=semester_id),
            self.office,
        )

        activated = self.client.post(
            f"/api/academics/semesters/{semester_id}/activate/",
            {"reason": "Start the configured faculty semester."},
            format="json",
        )
        self.assertEqual(activated.status_code, 200)
        self.assertEqual(activated.data["effectiveStatus"], "ACTIVE")

        self.client.force_authenticate(self.student)
        active = self.client.get("/api/academics/semesters/active/")
        self.assertEqual(active.status_code, 200)
        self.assertEqual(active.data["semester"]["id"], semester_id)

    def test_activation_requires_a_published_capacity_plan_without_side_effects(self):
        today = date.today()
        previous = AcademicSemester.objects.create(
            code=f"{today.year - 1}-{today.year}-S2",
            academic_session=f"{today.year - 1}/{today.year}",
            term=AcademicSemester.Term.SEMESTER_II,
            starts_on=today - timedelta(days=120),
            ends_on=today - timedelta(days=1),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        rubric = Rubric.objects.create(
            name="Blocked Handover Rubric",
            code="blocked-handover-rubric",
        )
        period = EvaluationPeriod.objects.create(
            name="Blocked Handover Period",
            semester=previous.label,
            academic_semester=previous,
            rubric=rubric,
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
            is_open=True,
        )
        target = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today,
            ends_on=today + timedelta(days=100),
            created_by=self.office,
        )

        blocked = self.client.post(
            f"/api/academics/semesters/{target.pk}/activate/",
            {"reason": "Attempt without capacity policy."},
            format="json",
        )

        self.assertEqual(blocked.status_code, 409)
        self.assertIn("published capacity plan", str(blocked.data).lower())
        previous.refresh_from_db()
        target.refresh_from_db()
        period.refresh_from_db()
        self.assertEqual(previous.lifecycle_status, AcademicSemester.Lifecycle.ACTIVE)
        self.assertEqual(target.lifecycle_status, AcademicSemester.Lifecycle.DRAFT)
        self.assertEqual(period.lifecycle_status, EvaluationPeriod.Lifecycle.PUBLISHED)
        self.assertTrue(period.is_open)
        self.assertFalse(previous.audits.filter(action="HANDOVER_CLOSE").exists())
        self.assertFalse(target.audits.filter(action="ACTIVATE").exists())
        self.assertFalse(
            MarksConfigurationAudit.objects.filter(
                entity_id=period.pk,
                action="SEMESTER_CLOSE",
            ).exists()
        )

    def test_activation_rejects_an_incomplete_published_capacity_plan(self):
        lecturer_user = User.objects.create_user(
            email="capacity.supervisor@example.test",
            password="local-test-password",
            full_name="Capacity Supervisor",
            role=User.Role.LECTURER,
        )
        lecturer = Lecturer.objects.create(
            user=lecturer_user,
            staff_no="CAP-ACT-001",
            lifecycle_status=Lecturer.Lifecycle.ACTIVE,
        )
        Supervisor.objects.create(lecturer=lecturer, max_supervisees=4)
        today = date.today()
        target = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today,
            ends_on=today + timedelta(days=100),
            created_by=self.office,
        )
        plan = create_capacity_plan(semester=target, actor=self.office)
        type(plan).objects.filter(pk=plan.pk).update(lifecycle_status="PUBLISHED")

        blocked = self.client.post(
            f"/api/academics/semesters/{target.pk}/activate/",
            {"reason": "Attempt with incomplete capacity policy."},
            format="json",
        )

        self.assertEqual(blocked.status_code, 409)
        self.assertIn("capacity entry is required", str(blocked.data).lower())
        target.refresh_from_db()
        self.assertEqual(target.lifecycle_status, AcademicSemester.Lifecycle.DRAFT)
        self.assertFalse(target.audits.filter(action="ACTIVATE").exists())

    def test_activation_accepts_one_complete_published_capacity_plan(self):
        lecturer_user = User.objects.create_user(
            email="capacity.valid@example.test",
            password="local-test-password",
            full_name="Capacity Valid Supervisor",
            role=User.Role.LECTURER,
        )
        lecturer = Lecturer.objects.create(
            user=lecturer_user,
            staff_no="CAP-ACT-002",
            lifecycle_status=Lecturer.Lifecycle.ACTIVE,
        )
        Supervisor.objects.create(lecturer=lecturer, max_supervisees=5)
        today = date.today()
        target = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today,
            ends_on=today + timedelta(days=100),
            created_by=self.office,
        )
        plan = create_capacity_plan(semester=target, actor=self.office)
        update_capacity_entry(
            plan,
            lecturer=lecturer,
            actor=self.office,
            supervisor_limit=5,
            panel_limit=None,
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
        publish_capacity_plan(
            plan,
            actor=self.office,
            reason="Publish a complete activation policy.",
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )

        activated = self.client.post(
            f"/api/academics/semesters/{target.pk}/activate/",
            {"reason": "Start the capacity-governed semester."},
            format="json",
        )

        self.assertEqual(activated.status_code, 200)
        target.refresh_from_db()
        self.assertEqual(target.lifecycle_status, AcademicSemester.Lifecycle.ACTIVE)

    def test_student_cannot_manage_semesters(self):
        self.client.force_authenticate(self.student)
        response = self.client.get("/api/academics/semesters/")
        self.assertEqual(response.status_code, 403)

    def test_office_receives_conflict_for_overlapping_semester(self):
        today = date.today()
        AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today,
            ends_on=today + timedelta(days=100),
            created_by=self.office,
        )

        response = self.client.post(
            "/api/academics/semesters/",
            {
                "academicSession": f"{today.year}/{today.year + 1}",
                "term": "SEMESTER_II",
                "startsOn": (today + timedelta(days=90)).isoformat(),
                "endsOn": (today + timedelta(days=180)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)

    def test_expired_active_semester_is_not_effectively_available(self):
        today = date.today()
        AcademicSemester.objects.create(
            code=f"{today.year - 1}-{today.year}-S1",
            academic_session=f"{today.year - 1}/{today.year}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timedelta(days=100),
            ends_on=today - timedelta(days=1),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )

        response = self.client.get("/api/academics/semesters/active/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["available"])
        self.assertEqual(response.data["semester"]["effectiveStatus"], "EXPIRED")

    def test_active_semester_extension_requires_later_date_and_records_reason(self):
        today = date.today()
        semester = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timedelta(days=10),
            ends_on=today + timedelta(days=20),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        rejected = self.client.post(
            f"/api/academics/semesters/{semester.pk}/extend/",
            {
                "endsOn": semester.ends_on.isoformat(),
                "reason": "No actual extension.",
            },
            format="json",
        )
        extended_end = semester.ends_on + timedelta(days=10)
        accepted = self.client.post(
            f"/api/academics/semesters/{semester.pk}/extend/",
            {
                "endsOn": extended_end.isoformat(),
                "reason": "Faculty approved a later semester end.",
            },
            format="json",
        )

        self.assertEqual(rejected.status_code, 409)
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.data["endsOn"], extended_end.isoformat())
        audit = semester.audits.get(action=AcademicSemesterAudit.Action.EXTEND)
        self.assertEqual(audit.reason, "Faculty approved a later semester end.")
        audit.reason = "Changed"
        with self.assertRaises(ValidationError):
            audit.save()

    def test_closed_semester_cannot_be_reactivated_and_can_be_archived(self):
        today = date.today()
        semester = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timedelta(days=10),
            ends_on=today + timedelta(days=20),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        closed = self.client.post(
            f"/api/academics/semesters/{semester.pk}/close/",
            {"reason": "Complete the current semester."},
            format="json",
        )
        reactivate = self.client.post(
            f"/api/academics/semesters/{semester.pk}/activate/",
            {"reason": "Attempt to reopen."},
            format="json",
        )
        archived = self.client.post(
            f"/api/academics/semesters/{semester.pk}/archive/",
            {"reason": "Retain as read-only history."},
            format="json",
        )

        self.assertEqual(closed.status_code, 200)
        self.assertEqual(reactivate.status_code, 409)
        self.assertEqual(archived.status_code, 200)
        self.assertEqual(archived.data["lifecycleStatus"], "ARCHIVED")

    def test_activation_atomically_closes_previous_semester_and_marks_periods(self):
        today = date.today()
        previous = AcademicSemester.objects.create(
            code=f"{today.year - 1}-{today.year}-S2",
            academic_session=f"{today.year - 1}/{today.year}",
            term=AcademicSemester.Term.SEMESTER_II,
            starts_on=today - timedelta(days=120),
            ends_on=today - timedelta(days=1),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        rubric = Rubric.objects.create(
            name="Handover Rubric",
            code="handover-rubric",
        )
        period = EvaluationPeriod.objects.create(
            name="Handover Period",
            semester=previous.label,
            academic_semester=previous,
            rubric=rubric,
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
            is_open=True,
        )
        created = self.client.post(
            "/api/academics/semesters/",
            {
                "academicSession": f"{today.year}/{today.year + 1}",
                "term": "SEMESTER_I",
                "startsOn": today.isoformat(),
                "endsOn": (today + timedelta(days=100)).isoformat(),
            },
            format="json",
        )
        publish_test_capacity_plan(
            AcademicSemester.objects.get(pk=created.data["id"]),
            self.office,
        )

        activated = self.client.post(
            f"/api/academics/semesters/{created.data['id']}/activate/",
            {"reason": "Begin the next faculty semester."},
            format="json",
        )

        self.assertEqual(activated.status_code, 200)
        previous.refresh_from_db()
        period.refresh_from_db()
        self.assertEqual(previous.lifecycle_status, "CLOSED")
        self.assertEqual(period.lifecycle_status, "CLOSED")
        self.assertFalse(period.is_open)
        self.assertTrue(previous.audits.filter(action="HANDOVER_CLOSE").exists())
        self.assertTrue(
            MarksConfigurationAudit.objects.filter(
                entity_id=period.pk,
                action="SEMESTER_CLOSE",
            ).exists()
        )
