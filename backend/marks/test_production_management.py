from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import OfficeStaff
from academics.models import AcademicSemester
from academics.test_capacity_helpers import publish_test_capacity_plan
from appointments.models import StudentResearchProfile
from dashboard.models import SemesterTimeline, SemesterTimelineEntry

from .models import (
    EvaluationPeriod,
    EvaluationTask,
    MarksConfigurationAudit,
    Rubric,
    RubricComponent,
)
from .services import clone_rubric_version, publish_evaluation_period

User = get_user_model()


class MarksConfigurationModelTests(TestCase):
    def setUp(self):
        self.office_admin = User.objects.create_user(
            email="marks-config-office@example.test",
            password="password123",
            full_name="Marks Configuration Administrator",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(
            user=self.office_admin,
            staff_no="DEMO-MARKS-ADMIN",
            department="Postgraduate Office",
        )
        today = timezone.localdate()
        self.academic_semester = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timezone.timedelta(days=30),
            ends_on=today + timezone.timedelta(days=120),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office_admin,
            activated_at=timezone.now(),
        )
        self.rubric = Rubric.objects.create(
            name="Research Evaluation",
            code="research-evaluation-v1",
            family_code="research-evaluation",
            version=1,
            allowed_evaluator_roles=["SUPERVISOR", "PANEL"],
            target_mark=Decimal("100.00"),
            is_active=True,
        )
        RubricComponent.objects.create(
            rubric=self.rubric,
            code="proposal",
            name="Proposal",
            max_marks=Decimal("40.00"),
            display_order=1,
        )
        RubricComponent.objects.create(
            rubric=self.rubric,
            code="presentation",
            name="Presentation",
            max_marks=Decimal("60.00"),
            display_order=2,
        )
        publish_test_capacity_plan(self.academic_semester, self.office_admin)

    def test_rubric_readiness_uses_configurable_target(self):
        self.assertEqual(self.rubric.component_total, Decimal("100.00"))
        self.assertTrue(self.rubric.is_ready)
        self.assertFalse(self.rubric.is_locked)

        self.rubric.target_mark = Decimal("120.00")
        self.rubric.save(update_fields=["target_mark"])

        self.assertFalse(self.rubric.is_ready)

    def test_rubric_locks_when_referenced_by_published_period(self):
        EvaluationPeriod.objects.create(
            assessment="P1",
            name="Semester 1 Evaluation",
            semester="Sem 1 2026/2027",
            academic_semester=self.academic_semester,
            rubric=self.rubric,
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
            opens_at=timezone.now() - timezone.timedelta(hours=1),
            closes_at=timezone.now() + timezone.timedelta(days=7),
        )

        self.assertTrue(self.rubric.is_locked)

    def test_clone_creates_next_version_and_copies_components(self):
        cloned = clone_rubric_version(
            rubric=self.rubric,
            actor=self.office_admin,
        )

        self.rubric.refresh_from_db()
        self.assertEqual(cloned.family_code, self.rubric.family_code)
        self.assertEqual(cloned.version, 2)
        self.assertEqual(cloned.code, "research-evaluation-v2")
        self.assertEqual(cloned.supersedes, self.rubric)
        self.assertEqual(cloned.components.count(), 2)
        self.assertFalse(self.rubric.is_active)
        self.assertTrue(cloned.is_active)
        audit = MarksConfigurationAudit.objects.get(
            entity_type=MarksConfigurationAudit.EntityType.RUBRIC,
            entity_id=cloned.pk,
        )
        self.assertEqual(audit.action, "CLONE")
        self.assertEqual(audit.actor, self.office_admin)
        self.assertTrue(audit.before_values["isActive"])
        self.assertTrue(audit.after_values["isActive"])

    def test_publishing_ready_period_is_audited(self):
        period = EvaluationPeriod.objects.create(
            assessment="P1",
            name="Semester 1 Evaluation",
            semester="Sem 1 2026/2027",
            academic_semester=self.academic_semester,
            rubric=self.rubric,
            lifecycle_status=EvaluationPeriod.Lifecycle.DRAFT,
            opens_at=timezone.now() - timezone.timedelta(hours=1),
            closes_at=timezone.now() + timezone.timedelta(days=7),
        )

        published = publish_evaluation_period(
            period=period,
            actor=self.office_admin,
        )

        self.assertEqual(
            published.lifecycle_status,
            EvaluationPeriod.Lifecycle.PUBLISHED,
        )
        self.assertEqual(published.effective_status, "OPEN")
        self.assertTrue(published.accepts_submissions)
        audit = MarksConfigurationAudit.objects.get(
            entity_type=MarksConfigurationAudit.EntityType.PERIOD,
            entity_id=period.pk,
        )
        self.assertEqual(audit.action, "PUBLISH")

    def test_publishing_rejects_unready_rubric(self):
        self.rubric.target_mark = Decimal("90.00")
        self.rubric.save(update_fields=["target_mark"])
        period = EvaluationPeriod.objects.create(
            assessment="P1",
            name="Semester 1 Evaluation",
            semester="Sem 1 2026/2027",
            academic_semester=self.academic_semester,
            rubric=self.rubric,
            lifecycle_status=EvaluationPeriod.Lifecycle.DRAFT,
            opens_at=timezone.now(),
            closes_at=timezone.now() + timezone.timedelta(days=7),
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Rubric components must match the configured target mark.",
        ):
            publish_evaluation_period(
                period=period,
                actor=self.office_admin,
            )

    def test_effective_period_status_uses_lifecycle_and_dates(self):
        now = timezone.now()
        scheduled = EvaluationPeriod(
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
            opens_at=now + timezone.timedelta(days=1),
            closes_at=now + timezone.timedelta(days=2),
        )
        ended = EvaluationPeriod(
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
            opens_at=now - timezone.timedelta(days=2),
            closes_at=now - timezone.timedelta(days=1),
        )

        self.assertEqual(scheduled.status_at(now), "SCHEDULED")
        self.assertEqual(ended.status_at(now), "CLOSED")

    def test_lifecycle_partial_save_keeps_legacy_open_flag_in_sync(self):
        period = EvaluationPeriod.objects.create(
            assessment="P1",
            name="Semester 1 Evaluation",
            semester="Sem 1 2026/2027",
            academic_semester=self.academic_semester,
            rubric=self.rubric,
            lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
            opens_at=timezone.now() - timezone.timedelta(hours=1),
            closes_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.assertTrue(period.is_open)

        period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        period.save(update_fields=["lifecycle_status"])
        period.refresh_from_db()

        self.assertFalse(period.is_open)

    def test_cloned_component_changes_do_not_mutate_prior_version(self):
        original = self.rubric.components.get(code="proposal")
        cloned = clone_rubric_version(
            rubric=self.rubric,
            actor=self.office_admin,
        )
        cloned_component = cloned.components.get(code="proposal")

        cloned_component.name = "Updated proposal"
        cloned_component.max_marks = Decimal("35.00")
        cloned_component.save(update_fields=["name", "max_marks"])
        original.refresh_from_db()

        self.assertNotEqual(cloned_component.pk, original.pk)
        self.assertEqual(original.name, "Proposal")
        self.assertEqual(original.max_marks, Decimal("40.00"))


class MarksConfigurationApiTests(APITestCase):
    def setUp(self):
        self.office_admin = User.objects.create_user(
            email="marks-api-office@example.test",
            password="password123",
            full_name="Marks API Administrator",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(
            user=self.office_admin,
            staff_no="DEMO-MARKS-API",
            department="Postgraduate Office",
        )
        self.lecturer = User.objects.create_user(
            email="marks-api-lecturer@example.test",
            password="password123",
            full_name="Marks API Lecturer",
            role=User.Role.LECTURER,
        )
        self.coordinator = User.objects.create_user(
            email="marks-api-coordinator@example.test",
            password="password123",
            full_name="Marks API Coordinator",
            role=User.Role.COORDINATOR,
        )
        self.student = User.objects.create_user(
            email="marks-api-student@example.test",
            password="password123",
            full_name="Marks API Student",
            role=User.Role.STUDENT,
        )
        self.client.force_authenticate(self.office_admin)
        today = timezone.localdate()
        self.academic_semester = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timezone.timedelta(days=30),
            ends_on=today + timezone.timedelta(days=120),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office_admin,
            activated_at=timezone.now(),
        )
        publish_test_capacity_plan(self.academic_semester, self.office_admin)

    def create_ready_rubric(self):
        created = self.client.post(
            "/api/marks/rubrics/",
            {
                "allowedEvaluatorRoles": ["SUPERVISOR", "PANEL"],
                "familyCode": "faculty-evaluation",
                "name": "Faculty Evaluation",
                "description": "Faculty-wide evaluation rubric.",
                "targetMark": "100.00",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        rubric_id = created.data["id"]
        for code, name, maximum, order in [
            ("research", "Research", "70.00", 1),
            ("presentation", "Presentation", "30.00", 2),
        ]:
            component = self.client.post(
                f"/api/marks/rubrics/{rubric_id}/components/",
                {
                    "code": code,
                    "name": name,
                    "description": "",
                    "maxMarks": maximum,
                    "required": True,
                    "displayOrder": order,
                    "isActive": True,
                },
                format="json",
            )
            self.assertEqual(component.status_code, status.HTTP_201_CREATED)
        return rubric_id

    def create_draft_period(self, rubric_id):
        now = timezone.now()
        response = self.client.post(
            "/api/marks/periods/",
            {
                "name": "Semester 1 Evaluation",
                "semesterId": self.academic_semester.pk,
                "assessment": "P1",
                "rubricId": rubric_id,
                "opensAt": (now - timezone.timedelta(hours=1)).isoformat(),
                "closesAt": (now + timezone.timedelta(days=7)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["semesterId"], self.academic_semester.pk)
        self.assertEqual(response.data["semester"], self.academic_semester.label)
        return response

    def test_delete_draft_period_preserves_audit_snapshot(self):
        rubric_id = self.create_ready_rubric()
        period = self.create_draft_period(rubric_id)
        period_id = period.data["id"]

        deleted = self.client.delete(f"/api/marks/periods/{period_id}/")

        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(EvaluationPeriod.objects.filter(pk=period_id).exists())
        audit = MarksConfigurationAudit.objects.get(
            entity_type=MarksConfigurationAudit.EntityType.PERIOD,
            entity_id=period_id,
            action="DELETE",
        )
        self.assertEqual(audit.before_values["name"], "Semester 1 Evaluation")
        self.assertEqual(audit.after_values, {})

    def test_delete_period_requires_office_access_and_draft_lifecycle(self):
        rubric_id = self.create_ready_rubric()
        period = self.create_draft_period(rubric_id)
        period_id = period.data["id"]

        for user in (self.lecturer, self.coordinator, self.student):
            with self.subTest(role=user.role):
                self.client.force_authenticate(user)
                self.assertEqual(
                    self.client.delete(f"/api/marks/periods/{period_id}/").status_code,
                    status.HTTP_403_FORBIDDEN,
                )
        self.client.force_authenticate(self.office_admin)
        self.client.post(f"/api/marks/periods/{period_id}/publish/", {}, format="json")
        blocked = self.client.delete(f"/api/marks/periods/{period_id}/")

        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(EvaluationPeriod.objects.filter(pk=period_id).exists())

    def test_delete_draft_period_with_tasks_or_timeline_links_is_blocked(self):
        rubric_id = self.create_ready_rubric()
        task_period = self.create_draft_period(rubric_id)
        profile = StudentResearchProfile.objects.create(
            matric_no="UAT-DELETE-01",
            student_name="UAT Student",
            programme="Computer Science",
            semester=self.academic_semester.label,
            proposed_topic="Draft deletion guard",
            supervisor=self.lecturer,
        )
        EvaluationTask.objects.create(
            profile=profile,
            evaluator=self.lecturer,
            period_id=task_period.data["id"],
        )
        task_blocked = self.client.delete(
            f"/api/marks/periods/{task_period.data['id']}/"
        )

        timeline_period = self.create_draft_period(rubric_id)
        timeline = SemesterTimeline.objects.create(
            academic_semester=self.academic_semester,
            semester=self.academic_semester.label,
            session=self.academic_semester.academic_session,
            uploaded_by=self.office_admin,
        )
        SemesterTimelineEntry.objects.create(
            timeline=timeline,
            level="P1",
            step=1,
            title="Marks window",
            detail="Linked marks period",
            action_owner="Lecturers",
            deadline_start=self.academic_semester.starts_on,
            deadline_end=self.academic_semester.ends_on,
            marks_period_id=timeline_period.data["id"],
        )
        timeline_blocked = self.client.delete(
            f"/api/marks/periods/{timeline_period.data['id']}/"
        )

        self.assertEqual(task_blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(EvaluationPeriod.objects.filter(pk=task_period.data["id"]).exists())
        self.assertEqual(timeline_blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(EvaluationPeriod.objects.filter(pk=timeline_period.data["id"]).exists())

    def test_archive_family_preserves_used_versions_and_restores(self):
        rubric_id = self.create_ready_rubric()
        period = self.create_draft_period(rubric_id)
        published = self.client.post(f"/api/marks/periods/{period.data['id']}/publish/", {}, format="json")
        self.assertEqual(published.status_code, 200)
        cloned = self.client.post(f"/api/marks/rubrics/{rubric_id}/clone/", {}, format="json")
        self.assertEqual(cloned.status_code, 201)
        archived = self.client.post(f"/api/marks/rubrics/{rubric_id}/archive/", {"archived": True}, format="json")
        self.assertEqual(archived.status_code, 200)
        self.assertTrue(all(Rubric.objects.values_list("is_archived", flat=True)))
        self.assertEqual(EvaluationPeriod.objects.get(pk=period.data["id"]).rubric_id, rubric_id)
        self.assertEqual(archived.data["usage"][0]["id"], period.data["id"])
        self.assertEqual(Rubric.objects.get(pk=rubric_id).components.count(), 2)
        self.assertEqual(self.client.patch(f"/api/marks/rubrics/{cloned.data['id']}/", {"name": "Changed"}, format="json").status_code, 409)
        self.assertEqual(self.client.post(f"/api/marks/rubrics/{rubric_id}/clone/", {}, format="json").status_code, 400)
        blocked = self.client.post("/api/marks/periods/", {
            "name": "Blocked", "semesterId": self.academic_semester.pk,
            "rubricId": cloned.data["id"],
        }, format="json")
        self.assertEqual(blocked.status_code, 409)
        restored = self.client.post(f"/api/marks/rubrics/{rubric_id}/archive/", {"archived": False}, format="json")
        self.assertEqual(restored.status_code, 200)
        self.assertFalse(Rubric.objects.filter(is_archived=True).exists())
        self.assertTrue(Rubric.objects.get(pk=cloned.data["id"]).is_active)
        self.assertFalse(Rubric.objects.get(pk=rubric_id).is_active)

    def test_archive_family_is_office_only_and_validates_input(self):
        rubric_id = self.create_ready_rubric()
        endpoint = f"/api/marks/rubrics/{rubric_id}/archive/"
        self.assertEqual(self.client.post(endpoint, {"archived": "false"}, format="json").status_code, 400)
        for user in (self.lecturer, self.coordinator, self.student):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post(endpoint, {"archived": True}, format="json").status_code, 403)
        self.assertFalse(Rubric.objects.get(pk=rubric_id).is_archived)

    def test_family_code_preserves_case_and_rejects_case_duplicate(self):
        payload = {"allowedEvaluatorRoles": ["SUPERVISOR", "PANEL"], "familyCode": "CODE-Mixed01", "name": "TEST PANEL", "targetMark": "100.00"}
        response = self.client.post("/api/marks/rubrics/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["familyCode"], "CODE-Mixed01")
        self.assertEqual(response.data["name"], "TEST PANEL")
        payload["familyCode"] = "code-mixed01"
        self.assertEqual(self.client.post("/api/marks/rubrics/", payload, format="json").status_code, 400)

    def test_office_can_create_rubric_and_components(self):
        rubric_id = self.create_ready_rubric()

        response = self.client.get(f"/api/marks/rubrics/{rubric_id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["version"], 1)
        self.assertEqual(response.data["targetMark"], "100.00")
        self.assertEqual(response.data["componentTotal"], "100.00")
        self.assertTrue(response.data["isReady"])
        self.assertFalse(response.data["isLocked"])
        self.assertEqual(len(response.data["components"]), 2)

    def test_non_office_user_cannot_access_configuration(self):
        for user in (self.lecturer, self.coordinator, self.student):
            with self.subTest(role=user.role):
                self.client.force_authenticate(user)
                rubric_response = self.client.get("/api/marks/rubrics/")
                period_response = self.client.post(
                    "/api/marks/periods/",
                    {},
                    format="json",
                )

                self.assertEqual(
                    rubric_response.status_code,
                    status.HTTP_403_FORBIDDEN,
                )
                self.assertEqual(
                    period_response.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

    def test_publish_locks_rubric_and_locked_component_edit_returns_conflict(self):
        rubric_id = self.create_ready_rubric()
        period = self.create_draft_period(rubric_id)

        published = self.client.post(
            f"/api/marks/periods/{period.data['id']}/publish/",
            {},
            format="json",
        )
        component_id = published.data["rubric"]["components"][0]["id"]
        locked_edit = self.client.patch(
            f"/api/marks/rubrics/{rubric_id}/components/{component_id}/",
            {"name": "Changed historical component"},
            format="json",
        )

        self.assertEqual(published.status_code, status.HTTP_200_OK)
        self.assertEqual(published.data["lifecycleStatus"], "PUBLISHED")
        self.assertEqual(published.data["effectiveStatus"], "OPEN")
        self.assertEqual(locked_edit.status_code, status.HTTP_409_CONFLICT)

    def test_published_period_only_allows_reasoned_deadline_extension(self):
        rubric_id = self.create_ready_rubric()
        period = self.create_draft_period(rubric_id)
        self.client.post(
            f"/api/marks/periods/{period.data['id']}/publish/",
            {},
            format="json",
        )
        extended_close = timezone.now() + timezone.timedelta(days=14)

        forbidden_name_change = self.client.patch(
            f"/api/marks/periods/{period.data['id']}/",
            {"name": "Changed name", "reason": "Not allowed."},
            format="json",
        )
        missing_reason = self.client.patch(
            f"/api/marks/periods/{period.data['id']}/",
            {"closesAt": extended_close.isoformat()},
            format="json",
        )
        extended = self.client.patch(
            f"/api/marks/periods/{period.data['id']}/",
            {
                "closesAt": extended_close.isoformat(),
                "reason": "Faculty approved an extension.",
            },
            format="json",
        )

        self.assertEqual(
            forbidden_name_change.status_code,
            status.HTTP_409_CONFLICT,
        )
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(extended.status_code, status.HTTP_200_OK)
        self.assertEqual(
            MarksConfigurationAudit.objects.filter(action="EXTEND").count(),
            1,
        )

    def test_close_archive_and_archived_filtering(self):
        rubric_id = self.create_ready_rubric()
        period = self.create_draft_period(rubric_id)
        period_id = period.data["id"]
        self.client.post(
            f"/api/marks/periods/{period_id}/publish/",
            {},
            format="json",
        )

        closed = self.client.post(
            f"/api/marks/periods/{period_id}/close/",
            {"reason": "Evaluation collection completed."},
            format="json",
        )
        archived = self.client.post(
            f"/api/marks/periods/{period_id}/archive/",
            {"reason": "Semester records archived."},
            format="json",
        )
        default_list = self.client.get("/api/marks/periods/")
        archived_list = self.client.get("/api/marks/periods/?includeArchived=true")

        self.assertEqual(closed.status_code, status.HTTP_200_OK)
        self.assertEqual(closed.data["effectiveStatus"], "CLOSED")
        self.assertEqual(archived.status_code, status.HTTP_200_OK)
        self.assertEqual(archived.data["effectiveStatus"], "ARCHIVED")
        self.assertEqual(default_list.data, [])
        self.assertEqual(len(archived_list.data), 1)

    def test_clone_returns_next_editable_version(self):
        rubric_id = self.create_ready_rubric()
        period = self.create_draft_period(rubric_id)
        self.client.post(
            f"/api/marks/periods/{period.data['id']}/publish/",
            {},
            format="json",
        )

        cloned = self.client.post(
            f"/api/marks/rubrics/{rubric_id}/clone/",
            {},
            format="json",
        )

        self.assertEqual(cloned.status_code, status.HTTP_201_CREATED)
        self.assertEqual(cloned.data["version"], 2)
        self.assertFalse(cloned.data["isLocked"])
        self.assertTrue(cloned.data["isActive"])
        self.assertEqual(len(cloned.data["components"]), 2)
