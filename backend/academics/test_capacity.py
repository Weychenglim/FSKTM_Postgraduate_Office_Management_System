import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.db.models.query import QuerySet
from django.db.models.signals import post_delete, pre_delete
from django.test import RequestFactory, TestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Lecturer, OfficeStaff, Panel, Student, Supervisor
from appointments.models import (
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
    count_panel_workload,
    panel_workload_limit,
    supervisor_workload_limit,
)

from . import capacity_services
from .capacity import (
    CapacityConflict,
    CapacityRole,
    CapacityState,
    assert_capacity_allows_assignment,
    capacity_conflict_message,
    resolve_lecturer_capacity,
)
from .capacity_services import (
    AvailabilityConflict,
    CapacityLifecycleConflict,
    CapacityPlanConflict,
    cancel_availability_window,
    capacity_plan_content_fingerprint,
    capacity_plan_snapshot,
    clone_capacity_plan,
    create_availability_window,
    create_capacity_plan,
    publish_capacity_plan,
    update_capacity_entry,
    validate_capacity_plan_ready,
)

from .admin import (
    LecturerCapacityAuditAdmin,
    LecturerCapacityEntryAdmin,
    SemesterCapacityPlanAdmin,
)
from .models import (
    AcademicSemester,
    LecturerAvailabilityWindow,
    LecturerCapacityAudit,
    LecturerCapacityEntry,
    SemesterCapacityPlan,
)

User = get_user_model()


class CapacityModelTests(TestCase):
    def setUp(self):
        self.office = User.objects.create_user(
            email="capacity.office@example.test",
            password="local-test-password",
            full_name="Capacity Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(
            user=self.office,
            staff_no="CAP-OFFICE-001",
            department="Postgraduate Office",
        )
        lecturer_user = User.objects.create_user(
            email="capacity.lecturer@example.test",
            password="local-test-password",
            full_name="Capacity Lecturer",
            role=User.Role.LECTURER,
        )
        self.lecturer = Lecturer.objects.create(
            user=lecturer_user,
            staff_no="CAP-LECT-001",
            department="Computing",
        )
        Supervisor.objects.create(lecturer=self.lecturer, max_supervisees=5)
        Panel.objects.create(lecturer=self.lecturer, max_appointments=10)
        self.semester = AcademicSemester.objects.create(
            code="2026-2027-S1",
            academic_session="2026/2027",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2026, 9, 1),
            ends_on=date(2027, 1, 31),
            created_by=self.office,
        )

    def create_plan(self, *, version=1, lifecycle_status=None):
        return SemesterCapacityPlan.objects.create(
            academic_semester=self.semester,
            version=version,
            lifecycle_status=(lifecycle_status or SemesterCapacityPlan.Lifecycle.DRAFT),
            origin=SemesterCapacityPlan.Origin.CREATED,
            created_by=self.office,
        )

    def create_additional_lecturer(self, suffix):
        user = User.objects.create_user(
            email=f"capacity.lecturer.{suffix}@example.test",
            password="local-test-password",
            full_name=f"Capacity Lecturer {suffix}",
            role=User.Role.LECTURER,
        )
        lecturer = Lecturer.objects.create(
            user=user,
            staff_no=f"CAP-LECT-{suffix}",
            department="Computing",
        )
        Supervisor.objects.create(lecturer=lecturer, max_supervisees=5)
        Panel.objects.create(lecturer=lecturer, max_appointments=10)
        return lecturer

    def create_audit(self, *, plan=None, reason="Capacity policy event."):
        plan = plan or self.create_plan()
        return LecturerCapacityAudit.objects.create(
            academic_semester=self.semester,
            plan=plan,
            lecturer=self.lecturer,
            actor=self.office,
            action=LecturerCapacityAudit.Action.PLAN_CREATE,
            reason=reason,
            before_values={},
            after_values={"planId": plan.pk, "version": plan.version},
        )

    def availability_values(self, **overrides):
        values = {
            "academic_semester": self.semester,
            "lecturer": self.lecturer,
            "role": LecturerAvailabilityWindow.Role.SUPERVISOR,
            "starts_on": self.semester.starts_on,
            "ends_on": self.semester.starts_on + timedelta(days=5),
            "reason": "Approved research leave.",
            "created_by": self.office,
        }
        values.update(overrides)
        return values

    def capacity_entry_persistence_states(self, entries):
        return [(entry.pk, entry._state.adding, entry._state.db) for entry in entries]

    def delete_capacity_entries_after_related_predicate_expands(self, *, raw):
        draft_plan = self.create_plan()
        second_draft_lecturer = self.create_additional_lecturer("DRAFT-DELETE")
        draft_entries = [
            LecturerCapacityEntry.objects.create(
                plan=draft_plan,
                lecturer=lecturer,
                supervisor_limit=4,
                panel_limit=8,
                updated_by=self.office,
            )
            for lecturer in (self.lecturer, second_draft_lecturer)
        ]

        published_plan = self.create_plan(version=2)
        published_lecturer = self.create_additional_lecturer("PUBLISHED-DELETE")
        Lecturer.objects.filter(pk=published_lecturer.pk).update(
            department="Mathematics"
        )
        published_entry = LecturerCapacityEntry.objects.create(
            plan=published_plan,
            lecturer=published_lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=published_plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )

        queryset = LecturerCapacityEntry.objects.filter(
            lecturer__department="Computing"
        )
        original_guard = queryset.__class__._lock_and_validate_delete
        guard_call_count = 0
        expansion_call = 1 if raw else 2
        predicate_expanded = False

        def expand_predicate_after_validation(candidate_queryset):
            nonlocal guard_call_count, predicate_expanded
            guard_call_count += 1
            captured_pks = original_guard(candidate_queryset)
            if guard_call_count == expansion_call:
                Lecturer.objects.filter(pk=published_lecturer.pk).update(
                    department="Computing"
                )
                predicate_expanded = True
            return captured_pks

        with patch.object(
            queryset.__class__,
            "_lock_and_validate_delete",
            expand_predicate_after_validation,
        ):
            result = queryset._raw_delete(using="default") if raw else queryset.delete()

        self.assertTrue(predicate_expanded)
        self.assertTrue(
            LecturerCapacityEntry.objects.filter(pk=published_entry.pk).exists()
        )
        self.assertFalse(
            LecturerCapacityEntry.objects.filter(
                pk__in=[entry.pk for entry in draft_entries]
            ).exists()
        )
        return result

    def test_plan_version_is_unique_within_semester(self):
        self.create_plan(version=1)

        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_plan(version=1)

    def test_only_one_plan_can_be_published_per_semester(self):
        self.create_plan(
            version=1,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_plan(
                version=2,
                lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
            )

    def test_entry_limits_match_lecturer_roles(self):
        plan = self.create_plan()
        valid_entry = LecturerCapacityEntry(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        valid_entry.full_clean()
        valid_entry.save()

        invalid_entry = LecturerCapacityEntry(
            plan=self.create_plan(version=2),
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=None,
            updated_by=self.office,
        )

        with self.assertRaises(ValidationError):
            invalid_entry.full_clean()

    def test_entry_objects_create_rejects_role_mismatched_limits(self):
        plan = self.create_plan()
        self.lecturer.panel.delete()

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.create(
                plan=plan,
                lecturer=self.lecturer,
                supervisor_limit=4,
                panel_limit=8,
                updated_by=self.office,
            )

        self.assertFalse(LecturerCapacityEntry.objects.exists())

    def test_entry_validation_rejects_non_draft_plans(self):
        for version, lifecycle_status in (
            (1, SemesterCapacityPlan.Lifecycle.PUBLISHED),
            (2, SemesterCapacityPlan.Lifecycle.SUPERSEDED),
        ):
            with self.subTest(lifecycle_status=lifecycle_status):
                entry = LecturerCapacityEntry(
                    plan=self.create_plan(
                        version=version,
                        lifecycle_status=lifecycle_status,
                    ),
                    lecturer=self.lecturer,
                    supervisor_limit=4,
                    panel_limit=8,
                    updated_by=self.office,
                )

                with self.assertRaises(ValidationError) as context:
                    entry.full_clean()

                self.assertIn("plan", context.exception.message_dict)

    def test_entry_save_rejects_creation_against_a_published_plan(self):
        published = self.create_plan(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.create(
                plan=published,
                lecturer=self.lecturer,
                supervisor_limit=4,
                panel_limit=8,
                updated_by=self.office,
            )

    def test_entry_save_rejects_reassignment_to_a_published_plan(self):
        draft = self.create_plan(version=1)
        published = self.create_plan(
            version=2,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        entry = LecturerCapacityEntry.objects.create(
            plan=draft,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )

        entry.plan = published
        with self.assertRaises(ValidationError):
            entry.save()

        entry.refresh_from_db()
        self.assertEqual(entry.plan, draft)

    def test_entry_partial_save_rejects_published_persisted_source_plan(self):
        source = self.create_plan(version=1)
        destination = self.create_plan(version=2)
        entry = LecturerCapacityEntry.objects.create(
            plan=source,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=source.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )
        entry.plan = destination
        entry.supervisor_limit = 2

        with self.assertRaises(ValidationError):
            entry.save(update_fields=["supervisor_limit"])

        entry.refresh_from_db()
        self.assertEqual(entry.plan, source)
        self.assertEqual(entry.supervisor_limit, 4)

    def test_entry_save_rejects_moving_from_published_to_draft(self):
        source = self.create_plan(version=1)
        destination = self.create_plan(version=2)
        entry = LecturerCapacityEntry.objects.create(
            plan=source,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=source.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )
        entry.plan = destination

        with self.assertRaises(ValidationError):
            entry.save(update_fields=["plan"])

        entry.refresh_from_db()
        self.assertEqual(entry.plan, source)

    def test_entry_save_locks_plan_and_persisted_entry_before_mutation(self):
        plan = self.create_plan()
        entry = LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        locked_models = []
        original_select_for_update = QuerySet.select_for_update

        def track_select_for_update(queryset, *args, **kwargs):
            locked_models.append(queryset.model)
            return original_select_for_update(queryset, *args, **kwargs)

        entry.supervisor_limit = 3
        with patch.object(
            QuerySet,
            "select_for_update",
            new=track_select_for_update,
        ):
            entry.save(update_fields=["supervisor_limit"])

        self.assertIn(SemesterCapacityPlan, locked_models)
        self.assertIn(LecturerCapacityEntry, locked_models)

    def test_entry_partial_save_validates_the_projected_persisted_lecturer(self):
        plan = self.create_plan()
        supervisor_only = self.create_additional_lecturer("PROJECTED")
        supervisor_only.panel.delete()
        entry = LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=supervisor_only,
            supervisor_limit=4,
            panel_limit=None,
            updated_by=self.office,
        )
        entry.lecturer = self.lecturer
        entry.panel_limit = 8

        with self.assertRaises(ValidationError):
            entry.save(update_fields=["panel_limit"])

        entry.refresh_from_db()
        self.assertEqual(entry.lecturer, supervisor_only)
        self.assertIsNone(entry.panel_limit)

    def test_published_entry_instance_delete_is_rejected(self):
        plan = self.create_plan()
        entry = LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )

        with self.assertRaises(ValidationError):
            entry.delete()

        self.assertTrue(LecturerCapacityEntry.objects.filter(pk=entry.pk).exists())

    def test_draft_entry_instance_delete_preserves_signal_instance_and_origin(self):
        entry = LecturerCapacityEntry.objects.create(
            plan=self.create_plan(),
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        entry_pk = entry.pk
        deletion_events = []

        def capture_delete(sender, instance, origin, **kwargs):
            deletion_events.append((instance, origin))

        pre_delete.connect(
            capture_delete,
            sender=LecturerCapacityEntry,
            weak=False,
        )
        post_delete.connect(
            capture_delete,
            sender=LecturerCapacityEntry,
            weak=False,
        )
        try:
            deleted, deleted_by_model = entry.delete()
        finally:
            pre_delete.disconnect(capture_delete, sender=LecturerCapacityEntry)
            post_delete.disconnect(capture_delete, sender=LecturerCapacityEntry)

        self.assertEqual(deleted, 1)
        self.assertEqual(
            deleted_by_model,
            {LecturerCapacityEntry._meta.label: 1},
        )
        self.assertFalse(LecturerCapacityEntry.objects.filter(pk=entry_pk).exists())
        self.assertEqual(len(deletion_events), 2)
        for signal_instance, origin in deletion_events:
            self.assertIs(signal_instance, entry)
            self.assertIs(origin, entry)

    def test_published_entry_queryset_delete_is_rejected(self):
        plan = self.create_plan()
        entry = LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.filter(pk=entry.pk).delete()

        self.assertTrue(LecturerCapacityEntry.objects.filter(pk=entry.pk).exists())

    def test_superseded_entry_raw_delete_is_rejected(self):
        plan = self.create_plan()
        entry = LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.SUPERSEDED
        )

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.filter(pk=entry.pk)._raw_delete(
                using="default"
            )

        self.assertTrue(LecturerCapacityEntry.objects.filter(pk=entry.pk).exists())

    def test_draft_entry_queryset_delete_remains_available(self):
        entry = LecturerCapacityEntry.objects.create(
            plan=self.create_plan(),
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )

        deleted, _ = LecturerCapacityEntry.objects.filter(pk=entry.pk).delete()

        self.assertEqual(deleted, 1)
        self.assertFalse(LecturerCapacityEntry.objects.filter(pk=entry.pk).exists())

    def test_queryset_delete_uses_locked_pks_if_related_predicate_expands(self):
        deleted, deleted_by_model = (
            self.delete_capacity_entries_after_related_predicate_expands(raw=False)
        )

        self.assertEqual(deleted, 2)
        self.assertEqual(
            deleted_by_model,
            {LecturerCapacityEntry._meta.label: 2},
        )

    def test_raw_delete_uses_locked_pks_if_related_predicate_expands(self):
        deleted = self.delete_capacity_entries_after_related_predicate_expands(raw=True)

        self.assertEqual(deleted, 2)

    def test_plan_admin_keeps_publication_fields_read_only(self):
        draft = self.create_plan()
        request = RequestFactory().get("/admin/academics/semestercapacityplan/add/")
        request.user = self.office
        plan_admin = SemesterCapacityPlanAdmin(SemesterCapacityPlan, AdminSite())
        publication_fields = {
            "lifecycle_status",
            "published_by",
            "publication_reason",
            "published_at",
        }

        self.assertTrue(
            publication_fields.issubset(plan_admin.get_readonly_fields(request))
        )
        draft_readonly = set(plan_admin.get_readonly_fields(request, obj=draft))
        self.assertTrue(publication_fields.issubset(draft_readonly))
        self.assertTrue(
            {
                "academic_semester",
                "version",
                "origin",
                "supersedes",
                "created_by",
            }.issubset(draft_readonly)
        )

    def test_plan_admin_add_is_disabled_in_favour_of_audited_configuration(self):
        request = RequestFactory().post("/admin/academics/semestercapacityplan/add/")
        request.user = self.office
        plan_admin = SemesterCapacityPlanAdmin(SemesterCapacityPlan, AdminSite())
        self.assertFalse(plan_admin.has_add_permission(request))
        self.assertEqual(plan_admin.get_form(request).base_fields, {})
        self.assertFalse(SemesterCapacityPlan.objects.exists())

    def test_plan_admin_rejects_a_stale_draft_edit_after_publication(self):
        plan = self.create_plan()
        stale_plan = SemesterCapacityPlan.objects.get(pk=plan.pk)
        stale_plan.version = 99
        stale_plan.origin = SemesterCapacityPlan.Origin.COPIED_FORWARD
        SemesterCapacityPlan.objects.filter(pk=plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )
        request = RequestFactory().post(
            f"/admin/academics/semestercapacityplan/{plan.pk}/change/"
        )
        request.user = self.office
        plan_admin = SemesterCapacityPlanAdmin(SemesterCapacityPlan, AdminSite())

        with self.assertRaises(ValidationError):
            plan_admin.save_model(request, stale_plan, form=None, change=True)

        plan.refresh_from_db()
        self.assertEqual(
            plan.lifecycle_status,
            SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        self.assertEqual(plan.version, 1)
        self.assertEqual(plan.origin, SemesterCapacityPlan.Origin.CREATED)

    def test_capacity_audit_admin_selects_displayed_relations(self):
        audit_admin = LecturerCapacityAuditAdmin(
            LecturerCapacityAudit,
            AdminSite(),
        )

        self.assertTrue(
            {
                "plan",
                "plan__academic_semester",
                "lecturer",
                "lecturer__user",
                "actor",
            }.issubset(set(audit_admin.list_select_related or ()))
        )

    def test_capacity_entry_admin_add_is_disabled_for_all_plan_states(self):
        draft = self.create_plan(version=1)
        published = self.create_plan(
            version=2,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        self.create_plan(
            version=3,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.SUPERSEDED,
        )
        request = RequestFactory().get("/admin/academics/lecturercapacityentry/add/")
        request.user = self.office
        entry_admin = LecturerCapacityEntryAdmin(LecturerCapacityEntry, AdminSite())
        form_class = entry_admin.get_form(request)

        self.assertFalse(entry_admin.has_add_permission(request))
        self.assertEqual(form_class.base_fields, {})

    def test_capacity_entry_admin_change_is_disabled_even_for_draft_plans(self):
        draft = self.create_plan(version=1)
        published = self.create_plan(
            version=2,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        entry = LecturerCapacityEntry.objects.create(
            plan=draft,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        request = RequestFactory().post(
            f"/admin/academics/lecturercapacityentry/{entry.pk}/change/"
        )
        request.user = self.office
        entry_admin = LecturerCapacityEntryAdmin(LecturerCapacityEntry, AdminSite())
        form_class = entry_admin.get_form(request, obj=entry)
        self.assertFalse(entry_admin.has_change_permission(request, entry))
        self.assertEqual(form_class.base_fields, {})
        entry.refresh_from_db()
        self.assertEqual(entry.plan, draft)

    def test_negative_entry_limits_are_rejected(self):
        plan = self.create_plan()

        for field_name in ("supervisor_limit", "panel_limit"):
            with self.subTest(field_name=field_name):
                limits = {"supervisor_limit": 4, "panel_limit": 8}
                limits[field_name] = -1
                entry = LecturerCapacityEntry(
                    plan=plan,
                    lecturer=self.lecturer,
                    updated_by=self.office,
                    **limits,
                )

                with self.assertRaises(ValidationError) as context:
                    entry.full_clean()

                self.assertIn(field_name, context.exception.message_dict)

    def test_zero_entry_limits_are_accepted(self):
        entry = LecturerCapacityEntry(
            plan=self.create_plan(),
            lecturer=self.lecturer,
            supervisor_limit=0,
            panel_limit=0,
            updated_by=self.office,
        )

        entry.full_clean()
        entry.save()

        self.assertEqual(entry.supervisor_limit, 0)
        self.assertEqual(entry.panel_limit, 0)

    def test_duplicate_plan_lecturer_entries_are_rejected(self):
        plan = self.create_plan()
        LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.create(
                plan=plan,
                lecturer=self.lecturer,
                supervisor_limit=5,
                panel_limit=9,
                updated_by=self.office,
            )

    def test_bulk_create_rejects_entries_for_non_draft_plans(self):
        published = self.create_plan(
            version=1,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        second_lecturer = self.create_additional_lecturer("PUBLISHED-CREATE")

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.bulk_create(
                [
                    LecturerCapacityEntry(
                        plan=published,
                        lecturer=self.lecturer,
                        supervisor_limit=4,
                        panel_limit=8,
                        updated_by=self.office,
                    ),
                    LecturerCapacityEntry(
                        plan=published,
                        lecturer=second_lecturer,
                        supervisor_limit=5,
                        panel_limit=9,
                        updated_by=self.office,
                    ),
                ]
            )

        self.assertFalse(LecturerCapacityEntry.objects.exists())

    def test_bulk_create_rejects_mixed_plans_without_mutating_inputs(self):
        first_plan = self.create_plan(version=1)
        second_plan = self.create_plan(version=2)
        entries = [
            LecturerCapacityEntry(
                plan=first_plan,
                lecturer=self.lecturer,
                supervisor_limit=4,
                panel_limit=8,
                updated_by=self.office,
            ),
            LecturerCapacityEntry(
                plan=second_plan,
                lecturer=self.create_additional_lecturer("MIXED-PLAN"),
                supervisor_limit=5,
                panel_limit=9,
                updated_by=self.office,
            ),
        ]
        original_states = self.capacity_entry_persistence_states(entries)

        with self.assertRaisesMessage(
            ValidationError,
            "Capacity entry bulk creation requires every entry to use the same "
            "plan.",
        ):
            LecturerCapacityEntry.objects.bulk_create(entries)

        self.assertFalse(LecturerCapacityEntry.objects.exists())
        self.assertEqual(
            self.capacity_entry_persistence_states(entries),
            original_states,
        )

    def test_bulk_create_rejects_role_mismatched_limits(self):
        plan = self.create_plan()
        invalid_lecturer = self.create_additional_lecturer("INVALID-ROLE")
        invalid_lecturer.panel.delete()
        entries = [
            LecturerCapacityEntry(
                plan=plan,
                lecturer=self.lecturer,
                supervisor_limit=4,
                panel_limit=8,
                updated_by=self.office,
            ),
            LecturerCapacityEntry(
                plan=plan,
                lecturer=invalid_lecturer,
                supervisor_limit=5,
                panel_limit=9,
                updated_by=self.office,
            ),
        ]
        original_states = self.capacity_entry_persistence_states(entries)

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.bulk_create(entries)

        self.assertFalse(LecturerCapacityEntry.objects.exists())
        self.assertEqual(
            self.capacity_entry_persistence_states(entries),
            original_states,
        )

    def test_bulk_create_rejects_upsert_into_a_published_entry(self):
        published_plan = self.create_plan(version=1)
        published_entry = LecturerCapacityEntry.objects.create(
            plan=published_plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=published_plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )
        draft_plan = self.create_plan(version=2)
        replacement = LecturerCapacityEntry(
            pk=published_entry.pk,
            plan=draft_plan,
            lecturer=self.lecturer,
            supervisor_limit=1,
            panel_limit=2,
            updated_by=self.office,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Capacity entry bulk creation does not support batch or conflict "
            "options.",
        ):
            LecturerCapacityEntry.objects.bulk_create(
                [replacement],
                update_conflicts=True,
                update_fields=["supervisor_limit"],
                unique_fields=["pk"],
            )

        published_entry.refresh_from_db()
        self.assertEqual(published_entry.plan, published_plan)
        self.assertEqual(published_entry.supervisor_limit, 4)

    def test_bulk_create_rejects_unsupported_options(self):
        option_sets = (
            {"batch_size": 1},
            {"ignore_conflicts": True},
            {"update_fields": ["supervisor_limit"]},
            {"unique_fields": ["pk"]},
        )

        for options in option_sets:
            with self.subTest(options=options), self.assertRaisesMessage(
                ValidationError,
                "Capacity entry bulk creation does not support batch or conflict "
                "options.",
            ):
                LecturerCapacityEntry.objects.bulk_create([], **options)

    def test_bulk_create_empty_batch_returns_an_empty_list(self):
        created = LecturerCapacityEntry.objects.bulk_create(())

        self.assertEqual(created, [])

    def test_bulk_create_rejects_duplicate_input_without_mutating_inputs(self):
        plan = self.create_plan()
        entries = [
            LecturerCapacityEntry(
                plan=plan,
                lecturer=self.lecturer,
                supervisor_limit=4,
                panel_limit=8,
                updated_by=self.office,
            ),
            LecturerCapacityEntry(
                plan=plan,
                lecturer=self.lecturer,
                supervisor_limit=5,
                panel_limit=9,
                updated_by=self.office,
            ),
        ]
        original_states = self.capacity_entry_persistence_states(entries)

        with self.assertRaises(ValidationError) as context:
            LecturerCapacityEntry.objects.bulk_create(entries)

        self.assertFalse(LecturerCapacityEntry.objects.exists())
        self.assertEqual(
            self.capacity_entry_persistence_states(entries),
            original_states,
        )
        self.assertIn(
            "Capacity entry bulk creation cannot contain duplicate plan and "
            "lecturer pairs.",
            context.exception.messages,
        )

    def test_bulk_create_restores_input_states_after_a_later_database_failure(self):
        plan = self.create_plan()
        entries = [
            LecturerCapacityEntry(
                plan=plan,
                lecturer=self.lecturer,
                supervisor_limit=4,
                panel_limit=8,
                updated_by=self.office,
            ),
            LecturerCapacityEntry(
                plan=plan,
                lecturer=self.create_additional_lecturer("DATABASE-FAILURE"),
                supervisor_limit=5,
                panel_limit=9,
                updated_by=self.office,
            ),
        ]
        original_states = self.capacity_entry_persistence_states(entries)
        original_save = LecturerCapacityEntry.save
        save_call_count = 0

        def fail_second_save(instance, *args, **kwargs):
            nonlocal save_call_count
            save_call_count += 1
            if save_call_count == 2:
                raise IntegrityError("Simulated later database failure.")
            return original_save(instance, *args, **kwargs)

        with patch.object(
            LecturerCapacityEntry,
            "save",
            new=fail_second_save,
        ), self.assertRaisesMessage(
            IntegrityError,
            "Simulated later database failure.",
        ):
            LecturerCapacityEntry.objects.bulk_create(entries)

        self.assertEqual(save_call_count, 2)
        self.assertFalse(LecturerCapacityEntry.objects.exists())
        self.assertEqual(
            self.capacity_entry_persistence_states(entries),
            original_states,
        )

    def test_bulk_create_same_plan_valid_batch_succeeds(self):
        draft = self.create_plan()
        second_lecturer = self.create_additional_lecturer("DRAFT-CREATE")

        entries = [
            LecturerCapacityEntry(
                plan=draft,
                lecturer=self.lecturer,
                supervisor_limit=4,
                panel_limit=8,
                updated_by=self.office,
            ),
            LecturerCapacityEntry(
                plan=draft,
                lecturer=second_lecturer,
                supervisor_limit=5,
                panel_limit=9,
                updated_by=self.office,
            ),
        ]

        created = LecturerCapacityEntry.objects.bulk_create(entries)

        self.assertEqual(len(created), 2)
        self.assertIs(created[0], entries[0])
        self.assertIs(created[1], entries[1])
        self.assertTrue(all(entry.pk is not None for entry in created))
        self.assertEqual(LecturerCapacityEntry.objects.filter(plan=draft).count(), 2)

    def test_bulk_update_rejects_changes_to_non_draft_plan_entries(self):
        plan = self.create_plan()
        entry = LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.SUPERSEDED
        )
        entry.supervisor_limit = 2

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.bulk_update(
                [entry],
                ["supervisor_limit"],
            )

        entry.refresh_from_db()
        self.assertEqual(entry.supervisor_limit, 4)

    def test_bulk_update_rejects_reassignment_to_a_non_draft_plan(self):
        draft = self.create_plan(version=1)
        published = self.create_plan(
            version=2,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        entry = LecturerCapacityEntry.objects.create(
            plan=draft,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        entry.plan = published

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.bulk_update([entry], ["plan"])

        entry.refresh_from_db()
        self.assertEqual(entry.plan, draft)

    def test_bulk_update_rejects_draft_plan_changes_and_reassignment(self):
        first_draft = self.create_plan(version=1)
        second_draft = self.create_plan(version=2)
        entry = LecturerCapacityEntry.objects.create(
            plan=first_draft,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        entry.plan = second_draft
        entry.supervisor_limit = 0
        entry.panel_limit = 0

        with self.assertRaisesMessage(
            ValidationError,
            "Capacity entries must be changed through validated individual saves.",
        ):
            LecturerCapacityEntry.objects.bulk_update(
                [entry],
                ["plan", "supervisor_limit", "panel_limit"],
            )

        entry.refresh_from_db()
        self.assertEqual(entry.plan, first_draft)
        self.assertEqual(entry.supervisor_limit, 4)
        self.assertEqual(entry.panel_limit, 8)

    def test_queryset_update_cannot_expand_a_related_predicate(self):
        draft_plan = self.create_plan(version=1)
        draft_entry = LecturerCapacityEntry.objects.create(
            plan=draft_plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        published_plan = self.create_plan(version=2)
        published_lecturer = self.create_additional_lecturer("PUBLISHED-UPDATE")
        Lecturer.objects.filter(pk=published_lecturer.pk).update(
            department="Mathematics"
        )
        published_entry = LecturerCapacityEntry.objects.create(
            plan=published_plan,
            lecturer=published_lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=published_plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )
        queryset = LecturerCapacityEntry.objects.filter(
            lecturer__department="Computing"
        )
        original_validate = queryset.__class__._validate_plan_ids_are_draft

        def validate_then_expand(candidate_queryset, plan_ids):
            original_validate(candidate_queryset, plan_ids)
            Lecturer.objects.filter(pk=published_lecturer.pk).update(
                department="Computing"
            )

        mutation_error = None
        with patch.object(
            queryset.__class__,
            "_validate_plan_ids_are_draft",
            validate_then_expand,
        ):
            try:
                queryset.update(panel_limit=1)
            except ValidationError as error:
                mutation_error = error

        draft_entry.refresh_from_db()
        published_entry.refresh_from_db()
        self.assertEqual(published_entry.panel_limit, 8)
        self.assertEqual(draft_entry.panel_limit, 8)
        self.assertIsNotNone(mutation_error)
        self.assertIn(
            "Capacity entries must be changed through validated individual saves.",
            mutation_error.messages,
        )

    def test_queryset_update_rejects_changes_to_non_draft_plan_entries(self):
        plan = self.create_plan()
        entry = LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.filter(pk=entry.pk).update(panel_limit=1)

        entry.refresh_from_db()
        self.assertEqual(entry.panel_limit, 8)

    def test_queryset_update_rejects_reassignment_to_a_non_draft_plan(self):
        draft = self.create_plan(version=1)
        superseded = self.create_plan(
            version=2,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.SUPERSEDED,
        )
        entry = LecturerCapacityEntry.objects.create(
            plan=draft,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )

        with self.assertRaises(ValidationError):
            LecturerCapacityEntry.objects.filter(pk=entry.pk).update(plan=superseded)

        entry.refresh_from_db()
        self.assertEqual(entry.plan, draft)

    def test_queryset_update_rejects_draft_plan_writes(self):
        first_draft = self.create_plan(version=1)
        second_draft = self.create_plan(version=2)
        entry = LecturerCapacityEntry.objects.create(
            plan=first_draft,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Capacity entries must be changed through validated individual saves.",
        ):
            LecturerCapacityEntry.objects.filter(pk=entry.pk).update(
                plan=second_draft,
                supervisor_limit=0,
                panel_limit=0,
            )

        entry.refresh_from_db()
        self.assertEqual(entry.plan, first_draft)
        self.assertEqual(entry.supervisor_limit, 4)
        self.assertEqual(entry.panel_limit, 8)

    def test_published_plan_entries_remain_readable(self):
        plan = self.create_plan()
        entry = LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=self.lecturer,
            supervisor_limit=4,
            panel_limit=8,
            updated_by=self.office,
        )
        SemesterCapacityPlan.objects.filter(pk=plan.pk).update(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
        )

        historical = LecturerCapacityEntry.objects.select_related("plan").get(
            pk=entry.pk
        )

        self.assertEqual(historical.plan.lifecycle_status, "PUBLISHED")
        self.assertEqual(historical.supervisor_limit, 4)

    def test_availability_window_must_be_bounded_by_semester(self):
        invalid_ranges = (
            (self.semester.starts_on - timedelta(days=1), self.semester.starts_on),
            (self.semester.ends_on, self.semester.ends_on + timedelta(days=1)),
            (self.semester.starts_on + timedelta(days=1), self.semester.starts_on),
        )

        for starts_on, ends_on in invalid_ranges:
            with self.subTest(starts_on=starts_on, ends_on=ends_on):
                window = LecturerAvailabilityWindow(
                    academic_semester=self.semester,
                    lecturer=self.lecturer,
                    role=LecturerAvailabilityWindow.Role.SUPERVISOR,
                    starts_on=starts_on,
                    ends_on=ends_on,
                    reason="Approved research leave.",
                    created_by=self.office,
                )
                with self.assertRaises(ValidationError):
                    window.full_clean()

    def test_active_availability_windows_cannot_overlap_for_the_same_role(self):
        window = LecturerAvailabilityWindow(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.semester.starts_on,
            ends_on=self.semester.starts_on + timedelta(days=5),
            reason="Approved research leave.",
            created_by=self.office,
        )
        window.full_clean()
        window.save()

        overlapping = LecturerAvailabilityWindow(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=window.starts_on + timedelta(days=2),
            ends_on=window.ends_on + timedelta(days=2),
            reason="Overlapping leave.",
            created_by=self.office,
        )

        with self.assertRaises(ValidationError):
            overlapping.full_clean()

    def test_availability_objects_create_rejects_out_of_semester_dates(self):
        with self.assertRaises(ValidationError):
            LecturerAvailabilityWindow.objects.create(
                **self.availability_values(
                    starts_on=self.semester.starts_on - timedelta(days=1)
                )
            )

        self.assertFalse(LecturerAvailabilityWindow.objects.exists())

    def test_availability_objects_create_rejects_active_overlap(self):
        existing = LecturerAvailabilityWindow.objects.create(
            **self.availability_values()
        )

        with self.assertRaises(ValidationError):
            LecturerAvailabilityWindow.objects.create(
                **self.availability_values(
                    starts_on=existing.starts_on + timedelta(days=2),
                    ends_on=existing.ends_on + timedelta(days=2),
                )
            )

        self.assertEqual(LecturerAvailabilityWindow.objects.count(), 1)

    def test_availability_objects_create_rejects_inconsistent_cancellation(self):
        with self.assertRaises(ValidationError):
            LecturerAvailabilityWindow.objects.create(
                **self.availability_values(cancelled_by=self.office)
            )

        self.assertFalse(LecturerAvailabilityWindow.objects.exists())

    def test_availability_save_locks_semester_and_current_row(self):
        window = LecturerAvailabilityWindow.objects.create(**self.availability_values())
        locked_models = []
        original_select_for_update = QuerySet.select_for_update

        def track_select_for_update(queryset, *args, **kwargs):
            locked_models.append(queryset.model)
            return original_select_for_update(queryset, *args, **kwargs)

        window.reason = "Approved amended research leave."
        with patch.object(
            QuerySet,
            "select_for_update",
            new=track_select_for_update,
        ):
            window.save(update_fields=["reason"])

        self.assertIn(AcademicSemester, locked_models)
        self.assertIn(LecturerAvailabilityWindow, locked_models)

    def test_availability_partial_save_validates_projected_cancellation_state(self):
        blocker = LecturerAvailabilityWindow.objects.create(
            **self.availability_values()
        )
        window = LecturerAvailabilityWindow.objects.create(
            **self.availability_values(
                starts_on=self.semester.starts_on + timedelta(days=10),
                ends_on=self.semester.starts_on + timedelta(days=15),
            )
        )
        original_dates = (window.starts_on, window.ends_on)
        window.starts_on = blocker.starts_on + timedelta(days=1)
        window.ends_on = blocker.ends_on + timedelta(days=1)
        window.cancelled_at = timezone.now()
        window.cancelled_by = self.office
        window.cancellation_reason = "Cancelled after the form was loaded."

        with self.assertRaises(ValidationError):
            window.save(update_fields=["starts_on", "ends_on"])

        window.refresh_from_db()
        self.assertEqual((window.starts_on, window.ends_on), original_dates)
        self.assertIsNone(window.cancelled_at)

    def test_availability_partial_save_rejects_incomplete_cancellation_metadata(self):
        window = LecturerAvailabilityWindow.objects.create(**self.availability_values())
        window.cancelled_at = timezone.now()
        window.cancelled_by = self.office
        window.cancellation_reason = "Cancelled after review."

        with self.assertRaises(ValidationError):
            window.save(update_fields=["cancelled_at"])

        window.refresh_from_db()
        self.assertIsNone(window.cancelled_at)
        self.assertIsNone(window.cancelled_by)
        self.assertEqual(window.cancellation_reason, "")

    def test_availability_full_save_accepts_complete_cancellation_metadata(self):
        window = LecturerAvailabilityWindow.objects.create(**self.availability_values())
        cancelled_at = timezone.now()
        window.cancelled_at = cancelled_at
        window.cancelled_by = self.office
        window.cancellation_reason = "Cancelled after review."

        window.save()

        window.refresh_from_db()
        self.assertEqual(window.cancelled_at, cancelled_at)
        self.assertEqual(window.cancelled_by, self.office)
        self.assertEqual(window.cancellation_reason, "Cancelled after review.")

    def test_new_fully_cancelled_window_still_requires_selected_role(self):
        lecturer_without_panel_role = self.create_additional_lecturer("NO-PANEL")
        Panel.objects.filter(lecturer=lecturer_without_panel_role).delete()

        with self.assertRaises(ValidationError):
            LecturerAvailabilityWindow.objects.create(
                **self.availability_values(
                    lecturer=lecturer_without_panel_role,
                    role=LecturerAvailabilityWindow.Role.PANEL,
                    cancelled_by=self.office,
                    cancelled_at=timezone.now(),
                    cancellation_reason="Entered as already cancelled.",
                )
            )

        self.assertFalse(
            LecturerAvailabilityWindow.objects.filter(
                lecturer=lecturer_without_panel_role
            ).exists()
        )

    def test_cancelled_window_identity_reassignment_requires_selected_role(self):
        window = LecturerAvailabilityWindow.objects.create(**self.availability_values())
        window.cancelled_by = self.office
        window.cancelled_at = timezone.now()
        window.cancellation_reason = "Cancelled before identity edit."
        window.save()
        lecturer_without_supervisor_role = self.create_additional_lecturer(
            "NO-SUPERVISOR"
        )
        Supervisor.objects.filter(lecturer=lecturer_without_supervisor_role).delete()

        window.lecturer = lecturer_without_supervisor_role
        with self.assertRaises(ValidationError):
            window.save(update_fields=["lecturer"])

        window.refresh_from_db()
        self.assertEqual(window.lecturer, self.lecturer)
        self.assertIsNotNone(window.cancelled_at)

    def test_unchanged_historical_window_can_cancel_after_role_removal(self):
        window = LecturerAvailabilityWindow.objects.create(**self.availability_values())
        Supervisor.objects.filter(lecturer=self.lecturer).delete()
        Lecturer.objects.filter(pk=self.lecturer.pk).update(
            lifecycle_status=Lecturer.Lifecycle.RETIRED
        )
        cancelled_at = timezone.now()
        window.cancelled_by = self.office
        window.cancelled_at = cancelled_at
        window.cancellation_reason = "Cancelled after role removal."

        window.save(
            update_fields=[
                "cancelled_by",
                "cancelled_at",
                "cancellation_reason",
            ]
        )

        window.refresh_from_db()
        self.assertEqual(window.cancelled_at, cancelled_at)
        self.assertEqual(window.cancelled_by, self.office)
        self.assertEqual(
            window.cancellation_reason,
            "Cancelled after role removal.",
        )

    def test_availability_bulk_create_is_rejected(self):
        with self.assertRaises(ValidationError):
            LecturerAvailabilityWindow.objects.bulk_create(
                [LecturerAvailabilityWindow(**self.availability_values())]
            )

        self.assertFalse(LecturerAvailabilityWindow.objects.exists())

    def test_availability_bulk_update_is_rejected(self):
        window = LecturerAvailabilityWindow.objects.create(**self.availability_values())
        window.reason = "Attempted bulk rewrite."

        with self.assertRaises(ValidationError):
            LecturerAvailabilityWindow.objects.bulk_update([window], ["reason"])

        window.refresh_from_db()
        self.assertEqual(window.reason, "Approved research leave.")

    def test_availability_queryset_update_is_rejected(self):
        window = LecturerAvailabilityWindow.objects.create(**self.availability_values())

        with self.assertRaises(ValidationError):
            LecturerAvailabilityWindow.objects.filter(pk=window.pk).update(
                reason="Attempted queryset rewrite."
            )

        window.refresh_from_db()
        self.assertEqual(window.reason, "Approved research leave.")

    def test_availability_deletion_paths_are_rejected(self):
        window = LecturerAvailabilityWindow.objects.create(**self.availability_values())

        with self.assertRaises(ValidationError):
            LecturerAvailabilityWindow.objects.filter(pk=window.pk).delete()
        with self.assertRaises(ValidationError):
            window.delete()

        self.assertTrue(
            LecturerAvailabilityWindow.objects.filter(pk=window.pk).exists()
        )

    def test_capacity_audits_are_immutable(self):
        plan = self.create_plan()
        audit = LecturerCapacityAudit.objects.create(
            academic_semester=self.semester,
            plan=plan,
            lecturer=self.lecturer,
            actor=self.office,
            action=LecturerCapacityAudit.Action.PLAN_CREATE,
            reason="Created the initial semester capacity plan.",
            before_values={},
            after_values={"planId": plan.pk, "version": plan.version},
        )

        audit.reason = "Attempted rewrite."
        with self.assertRaises(ValidationError):
            audit.save()
        with self.assertRaises(ValidationError):
            audit.delete()

    def test_capacity_audit_queryset_update_is_rejected(self):
        audit = self.create_audit()

        with self.assertRaises(ValidationError):
            LecturerCapacityAudit.objects.filter(pk=audit.pk).update(
                reason="Attempted queryset rewrite."
            )

        audit.refresh_from_db()
        self.assertEqual(audit.reason, "Capacity policy event.")

    def test_capacity_audit_bulk_update_is_rejected(self):
        audit = self.create_audit()
        audit.reason = "Attempted bulk rewrite."

        with self.assertRaises(ValidationError):
            LecturerCapacityAudit.objects.bulk_update([audit], ["reason"])

        audit.refresh_from_db()
        self.assertEqual(audit.reason, "Capacity policy event.")

    def test_capacity_audit_queryset_delete_is_rejected(self):
        audit = self.create_audit()

        with self.assertRaises(ValidationError):
            LecturerCapacityAudit.objects.filter(pk=audit.pk).delete()

        self.assertTrue(LecturerCapacityAudit.objects.filter(pk=audit.pk).exists())

    def test_capacity_audit_raw_bulk_delete_is_rejected(self):
        audit = self.create_audit()

        with self.assertRaises(ValidationError):
            LecturerCapacityAudit.objects.filter(pk=audit.pk)._raw_delete(
                using="default"
            )

        self.assertTrue(LecturerCapacityAudit.objects.filter(pk=audit.pk).exists())

    def test_capacity_audit_bulk_create_remains_available(self):
        plan = self.create_plan()
        audits = LecturerCapacityAudit.objects.bulk_create(
            [
                LecturerCapacityAudit(
                    academic_semester=self.semester,
                    plan=plan,
                    lecturer=self.lecturer,
                    actor=self.office,
                    action=LecturerCapacityAudit.Action.PLAN_CREATE,
                    reason="Created through an append-only bulk insert.",
                    before_values={},
                    after_values={"planId": plan.pk},
                )
            ]
        )

        self.assertEqual(len(audits), 1)
        self.assertEqual(LecturerCapacityAudit.objects.count(), 1)

    def test_capacity_audit_bulk_upsert_is_rejected(self):
        audit = self.create_audit()
        replacement = LecturerCapacityAudit(
            pk=audit.pk,
            academic_semester=self.semester,
            plan=audit.plan,
            lecturer=self.lecturer,
            actor=self.office,
            action=LecturerCapacityAudit.Action.PLAN_CREATE,
            reason="Attempted conflict update.",
            before_values={},
            after_values={"planId": audit.plan_id},
        )

        with self.assertRaises(ValidationError):
            LecturerCapacityAudit.objects.bulk_create(
                [replacement],
                update_conflicts=True,
                update_fields=["reason"],
                unique_fields=["pk"],
            )

        audit.refresh_from_db()
        self.assertEqual(audit.reason, "Capacity policy event.")


class CapacityLifecycleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(
            email="capacity.lifecycle.office@example.test",
            password="local-test-password",
            full_name="Capacity Lifecycle Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(
            user=cls.office,
            staff_no="CAP-LIFE-OFFICE",
            department="Postgraduate Office",
        )
        cls.lecturer = cls.create_lecturer(
            "002",
            supervisor=True,
            panel=True,
        )
        cls.supervisor_only = cls.create_lecturer(
            "001",
            supervisor=True,
            panel=False,
        )
        cls.prior_semester = AcademicSemester.objects.create(
            code="2025-2026-S2",
            academic_session="2025/2026",
            term=AcademicSemester.Term.SEMESTER_II,
            starts_on=date(2026, 2, 1),
            ends_on=date(2026, 6, 30),
            created_by=cls.office,
        )
        cls.semester = AcademicSemester.objects.create(
            code="2026-2027-S1",
            academic_session="2026/2027",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2026, 9, 1),
            ends_on=date(2027, 1, 31),
            created_by=cls.office,
        )

    @classmethod
    def create_lecturer(cls, suffix, *, supervisor, panel):
        user = User.objects.create_user(
            email=f"capacity.lifecycle.{suffix}@example.test",
            password="local-test-password",
            full_name=f"Capacity Lifecycle Lecturer {suffix}",
            role=User.Role.LECTURER,
        )
        lecturer = Lecturer.objects.create(
            user=user,
            staff_no=f"CAP-LIFE-LECT-{suffix}",
            department="Computing",
        )
        if supervisor:
            Supervisor.objects.create(lecturer=lecturer, max_supervisees=5)
        if panel:
            Panel.objects.create(lecturer=lecturer, max_appointments=10)
        return lecturer

    def complete_plan(self, plan=None, *, semester=None):
        semester = semester or self.semester
        plan = plan or create_capacity_plan(
            semester=semester,
            actor=self.office,
        )
        update_capacity_entry(
            plan,
            lecturer=self.supervisor_only,
            actor=self.office,
            supervisor_limit=4,
            panel_limit=None,
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
        update_capacity_entry(
            plan,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=5,
            panel_limit=8,
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
        return plan

    def publish_complete_plan(self, plan=None, *, semester=None, version=1):
        plan = self.complete_plan(plan, semester=semester)
        self.assertEqual(plan.version, version)
        return publish_capacity_plan(
            plan,
            actor=self.office,
            reason="Approved complete capacity allocation.",
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )

    def create_student_appointment(self):
        student_user = User.objects.create_user(
            email="capacity.lifecycle.student@example.test",
            password="local-test-password",
            full_name="Capacity Lifecycle Student",
            role=User.Role.STUDENT,
        )
        student = Student.objects.create(
            user=student_user,
            matric_no="CAP-LIFE-STUDENT",
            programme="Master of Computer Science",
        )
        application = SupervisorApplication.objects.create(
            student=student,
            academic_semester=self.semester,
            proposed_supervisor=self.lecturer.user,
            research_title="Capacity policy verification",
            research_area="Software Engineering",
            research_abstract="Capacity changes preserve active work.",
            status=SupervisorApplication.Status.APPROVED,
        )
        return SupervisorAppointment.objects.create(
            application=application,
            student=student,
            supervisor=self.lecturer.user,
            approved_by=self.office,
        )

    def test_blank_plan_creation_starts_empty_draft_version(self):
        plan = create_capacity_plan(semester=self.semester, actor=self.office)

        self.assertEqual(plan.version, 1)
        self.assertEqual(plan.lifecycle_status, SemesterCapacityPlan.Lifecycle.DRAFT)
        self.assertEqual(plan.origin, SemesterCapacityPlan.Origin.CREATED)
        self.assertIsNone(plan.supersedes_id)
        self.assertFalse(plan.entries.exists())
        self.assertIsNone(capacity_plan_snapshot(plan)["supersedesId"])
        audit = LecturerCapacityAudit.objects.get(
            plan=plan,
            action=LecturerCapacityAudit.Action.PLAN_CREATE,
        )
        self.assertEqual(audit.actor, self.office)
        self.assertEqual(audit.after_values, capacity_plan_snapshot(plan))

    def test_internal_version_allocation_defers_uniqueness_to_database(self):
        with patch.object(
            SemesterCapacityPlan,
            "validate_unique",
            side_effect=AssertionError("model uniqueness validation was called"),
        ), patch.object(
            SemesterCapacityPlan,
            "validate_constraints",
            side_effect=AssertionError("model constraint validation was called"),
        ):
            plan = create_capacity_plan(semester=self.semester, actor=self.office)

        self.assertEqual(plan.version, 1)
        self.assertEqual(plan.lifecycle_status, SemesterCapacityPlan.Lifecycle.DRAFT)

    def test_copy_from_prior_published_plan_uses_current_eligibility_only(self):
        historical = self.create_lecturer(
            "HISTORICAL",
            supervisor=True,
            panel=False,
        )
        source = create_capacity_plan(
            semester=self.prior_semester,
            actor=self.office,
        )
        self.complete_plan(source, semester=self.prior_semester)
        update_capacity_entry(
            source,
            lecturer=historical,
            actor=self.office,
            supervisor_limit=3,
            panel_limit=None,
            expected_fingerprint=capacity_plan_content_fingerprint(source),
        )
        source = publish_capacity_plan(
            source,
            actor=self.office,
            reason="Approved prior-semester capacity allocation.",
            expected_fingerprint=capacity_plan_content_fingerprint(source),
        )
        Lecturer.objects.filter(pk=historical.pk).update(
            lifecycle_status=Lecturer.Lifecycle.RETIRED
        )
        create_availability_window(
            semester=self.prior_semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.prior_semester.starts_on,
            ends_on=self.prior_semester.starts_on + timedelta(days=2),
            actor=self.office,
            reason="Approved prior-semester leave.",
        )

        shared_semester_lock = capacity_services.lock_academic_semesters
        observed_lock_orders = []

        def capture_semester_lock_order(semester_ids=None):
            locked = shared_semester_lock(semester_ids)
            observed_lock_orders.append(list(locked))
            return locked

        with patch(
            "academics.capacity_services.lock_academic_semesters",
            side_effect=capture_semester_lock_order,
        ):
            copied = create_capacity_plan(
                semester=self.semester,
                actor=self.office,
                copy_from=source,
            )

        self.assertEqual(copied.version, 1)
        self.assertEqual(
            observed_lock_orders,
            [[self.prior_semester.pk, self.semester.pk]],
        )
        self.assertEqual(copied.origin, SemesterCapacityPlan.Origin.COPIED_FORWARD)
        self.assertEqual(copied.supersedes_id, source.pk)
        copied_snapshot = capacity_plan_snapshot(copied)
        self.assertEqual(copied_snapshot["supersedesId"], source.pk)
        self.assertEqual(
            list(copied.entries.values_list("lecturer__staff_no", flat=True)),
            [self.supervisor_only.staff_no, self.lecturer.staff_no],
        )
        self.assertFalse(
            LecturerAvailabilityWindow.objects.filter(
                academic_semester=self.semester
            ).exists()
        )
        copy_audit = LecturerCapacityAudit.objects.get(
            plan=copied,
            action=LecturerCapacityAudit.Action.PLAN_COPY,
        )
        self.assertEqual(copy_audit.academic_semester_id, self.semester.pk)
        self.assertEqual(copy_audit.before_values["planId"], source.pk)
        self.assertEqual(copy_audit.after_values["planId"], copied.pk)
        self.assertEqual(copy_audit.after_values["supersedesId"], source.pk)

    def test_copy_requires_latest_strictly_prior_published_semester(self):
        older_semester = AcademicSemester.objects.create(
            code="2025-2026-S1",
            academic_session="2025/2026",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2025, 9, 1),
            ends_on=date(2026, 1, 15),
            created_by=self.office,
        )
        older_source = self.publish_complete_plan(semester=older_semester)
        latest_source = self.publish_complete_plan(semester=self.prior_semester)

        with self.assertRaises(CapacityPlanConflict):
            create_capacity_plan(
                semester=self.semester,
                actor=self.office,
                copy_from=older_source,
            )

        copied = create_capacity_plan(
            semester=self.semester,
            actor=self.office,
            copy_from=latest_source,
        )
        self.assertEqual(copied.supersedes_id, latest_source.pk)

        future_semester = AcademicSemester.objects.create(
            code="2027-2028-S1",
            academic_session="2027/2028",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2027, 9, 1),
            ends_on=date(2028, 1, 31),
            created_by=self.office,
        )
        future_source = self.publish_complete_plan(semester=future_semester)
        with self.assertRaises(CapacityPlanConflict):
            create_capacity_plan(
                semester=self.semester,
                actor=self.office,
                copy_from=future_source,
            )

    def test_copy_rejects_same_semester_and_overlapping_source(self):
        same_semester_source = self.publish_complete_plan()
        with self.assertRaises(CapacityPlanConflict):
            create_capacity_plan(
                semester=self.semester,
                actor=self.office,
                copy_from=same_semester_source,
            )

        overlapping_semester = AcademicSemester.objects.create(
            code="2026-2027-SP",
            academic_session="2026/2027",
            term=AcademicSemester.Term.SPECIAL,
            starts_on=date(2026, 8, 1),
            ends_on=date(2026, 10, 1),
            created_by=self.office,
        )
        overlapping_source = self.publish_complete_plan(semester=overlapping_semester)
        with self.assertRaises(CapacityPlanConflict):
            create_capacity_plan(
                semester=self.semester,
                actor=self.office,
                copy_from=overlapping_source,
            )

    def test_capacity_writes_reject_closed_and_archived_target_semesters(self):
        current = self.publish_complete_plan()
        draft = clone_capacity_plan(current, actor=self.office)
        AcademicSemester.objects.filter(pk=self.semester.pk).update(
            lifecycle_status=AcademicSemester.Lifecycle.CLOSED
        )
        self.semester.refresh_from_db()

        with self.assertRaises(CapacityPlanConflict):
            create_capacity_plan(semester=self.semester, actor=self.office)
        with self.assertRaises(CapacityPlanConflict):
            clone_capacity_plan(current, actor=self.office)
        with self.assertRaises(CapacityPlanConflict):
            update_capacity_entry(
                draft,
                lecturer=self.lecturer,
                actor=self.office,
                supervisor_limit=4,
                panel_limit=8,
                expected_fingerprint=capacity_plan_content_fingerprint(draft),
            )
        with self.assertRaises(CapacityPlanConflict):
            publish_capacity_plan(
                draft,
                actor=self.office,
                reason="Closed semester must reject publication.",
                expected_fingerprint=capacity_plan_content_fingerprint(draft),
            )
        with self.assertRaises(CapacityPlanConflict):
            create_availability_window(
                semester=self.semester,
                lecturer=self.lecturer,
                role=LecturerAvailabilityWindow.Role.SUPERVISOR,
                starts_on=self.semester.starts_on,
                ends_on=self.semester.starts_on,
                actor=self.office,
                reason="Closed semester must reject a new restriction.",
            )

        AcademicSemester.objects.filter(pk=self.semester.pk).update(
            lifecycle_status=AcademicSemester.Lifecycle.ARCHIVED
        )
        self.semester.refresh_from_db()
        with self.assertRaises(CapacityPlanConflict):
            create_capacity_plan(semester=self.semester, actor=self.office)

    def test_active_semester_allows_replacement_publication(self):
        current = self.publish_complete_plan()
        draft = clone_capacity_plan(current, actor=self.office)
        AcademicSemester.objects.filter(pk=self.semester.pk).update(
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE
        )

        updated = update_capacity_entry(
            draft,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=4,
            panel_limit=8,
            expected_fingerprint=capacity_plan_content_fingerprint(draft),
        )
        published = publish_capacity_plan(
            draft,
            actor=self.office,
            reason="Approved active-semester replacement.",
            expected_fingerprint=capacity_plan_content_fingerprint(draft),
        )

        self.assertEqual(updated.supervisor_limit, 4)
        self.assertEqual(
            published.lifecycle_status,
            SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )

    def test_same_semester_clone_increments_version_and_records_source(self):
        first = self.publish_complete_plan(version=1)
        second = clone_capacity_plan(first, actor=self.office)
        second = publish_capacity_plan(
            second,
            actor=self.office,
            reason="Approved second capacity version.",
            expected_fingerprint=capacity_plan_content_fingerprint(second),
        )

        third = clone_capacity_plan(second, actor=self.office)

        self.assertEqual(third.version, 3)
        self.assertEqual(third.lifecycle_status, SemesterCapacityPlan.Lifecycle.DRAFT)
        self.assertEqual(third.origin, SemesterCapacityPlan.Origin.COPIED_FORWARD)
        self.assertEqual(third.supersedes_id, second.pk)
        self.assertEqual(third.entries.count(), 2)

    def test_same_semester_clone_can_restore_a_superseded_source_version(self):
        first = self.publish_complete_plan(version=1)
        second = clone_capacity_plan(first, actor=self.office)
        publish_capacity_plan(
            second,
            actor=self.office,
            reason="Approved second capacity version.",
            expected_fingerprint=capacity_plan_content_fingerprint(second),
        )
        first.refresh_from_db()

        restored = clone_capacity_plan(first, actor=self.office)

        self.assertEqual(restored.version, 3)
        self.assertEqual(restored.supersedes_id, first.pk)
        self.assertEqual(restored.entries.count(), 2)

    def test_draft_entry_is_created_then_updated_with_before_after_audits(self):
        plan = create_capacity_plan(semester=self.semester, actor=self.office)

        created = update_capacity_entry(
            plan,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=5,
            panel_limit=8,
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
        updated = update_capacity_entry(
            plan,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=2,
            panel_limit=6,
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )

        self.assertEqual(created.pk, updated.pk)
        self.assertEqual(plan.entries.count(), 1)
        self.assertEqual(updated.supervisor_limit, 2)
        audits = list(
            LecturerCapacityAudit.objects.filter(
                plan=plan,
                lecturer=self.lecturer,
                action=LecturerCapacityAudit.Action.ENTRY_UPDATE,
            ).order_by("pk")
        )
        self.assertEqual(len(audits), 2)
        self.assertIsNone(audits[0].before_values["entry"])
        self.assertEqual(audits[0].after_values["entry"]["supervisorLimit"], 5)
        self.assertEqual(audits[1].before_values["entry"]["supervisorLimit"], 5)
        self.assertEqual(audits[1].after_values["entry"]["supervisorLimit"], 2)

    def test_content_fingerprint_is_required_validated_and_detects_stale_edits(self):
        plan = create_capacity_plan(semester=self.semester, actor=self.office)
        initial_fingerprint = capacity_plan_content_fingerprint(plan)

        self.assertRegex(initial_fingerprint, r"^[0-9a-f]{64}$")
        self.assertEqual(
            capacity_plan_snapshot(plan)["contentFingerprint"],
            initial_fingerprint,
        )
        with self.assertRaises(ValidationError):
            update_capacity_entry(
                plan,
                lecturer=self.lecturer,
                actor=self.office,
                supervisor_limit=5,
                panel_limit=8,
                expected_fingerprint="not-a-fingerprint",
            )

        audit_count = LecturerCapacityAudit.objects.count()
        with self.assertRaises(CapacityPlanConflict):
            update_capacity_entry(
                plan,
                lecturer=self.lecturer,
                actor=self.office,
                supervisor_limit=5,
                panel_limit=8,
                expected_fingerprint="0" * 64,
            )
        self.assertFalse(plan.entries.exists())
        self.assertEqual(LecturerCapacityAudit.objects.count(), audit_count)

        update_capacity_entry(
            plan,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=5,
            panel_limit=8,
            expected_fingerprint=initial_fingerprint,
        )
        self.assertNotEqual(
            capacity_plan_content_fingerprint(plan),
            initial_fingerprint,
        )

    def test_publish_rejects_stale_content_fingerprint_before_mutation(self):
        plan = self.complete_plan()
        stale_fingerprint = capacity_plan_content_fingerprint(plan)
        update_capacity_entry(
            plan,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=4,
            panel_limit=8,
            expected_fingerprint=stale_fingerprint,
        )
        audit_count = LecturerCapacityAudit.objects.count()

        with self.assertRaises(CapacityPlanConflict):
            publish_capacity_plan(
                plan,
                actor=self.office,
                reason="Stale content must not publish.",
                expected_fingerprint=stale_fingerprint,
            )

        plan.refresh_from_db()
        self.assertEqual(plan.lifecycle_status, SemesterCapacityPlan.Lifecycle.DRAFT)
        self.assertEqual(LecturerCapacityAudit.objects.count(), audit_count)

    def test_readiness_requires_complete_current_lecturer_coverage(self):
        plan = self.complete_plan()
        self.assertEqual(validate_capacity_plan_ready(plan), [])
        newly_eligible = self.create_lecturer(
            "NEW",
            supervisor=False,
            panel=True,
        )

        errors = validate_capacity_plan_ready(plan)

        self.assertTrue(any(newly_eligible.staff_no in error for error in errors))
        with self.assertRaises(CapacityLifecycleConflict):
            publish_capacity_plan(
                plan,
                actor=self.office,
                reason="Incomplete allocation must not publish.",
                expected_fingerprint=capacity_plan_content_fingerprint(plan),
            )

    def test_readiness_excludes_disabled_lecturer_accounts(self):
        plan = self.complete_plan()
        disabled = self.create_lecturer(
            "DISABLED",
            supervisor=True,
            panel=True,
        )
        disabled.user.is_active = False
        disabled.user.save(update_fields=["is_active"])

        self.assertEqual(validate_capacity_plan_ready(plan), [])
        published = publish_capacity_plan(
            plan,
            actor=self.office,
            reason="Disabled accounts are not capacity participants.",
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )

        self.assertEqual(
            published.lifecycle_status,
            SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )

    def test_readiness_detects_role_limit_alignment_changes(self):
        plan = self.complete_plan()
        Panel.objects.filter(lecturer=self.lecturer).delete()

        absent_role_errors = validate_capacity_plan_ready(plan)

        self.assertTrue(
            any("Panel limit must be empty" in error for error in absent_role_errors)
        )
        Panel.objects.create(lecturer=self.supervisor_only, max_appointments=10)
        newly_required_errors = validate_capacity_plan_ready(plan)
        self.assertTrue(
            any(
                self.supervisor_only.staff_no in error
                and "Panel limit is required" in error
                for error in newly_required_errors
            )
        )

    def test_publish_with_no_current_plan_publishes_target(self):
        draft = self.complete_plan()

        published = publish_capacity_plan(
            draft,
            actor=self.office,
            reason="Approved initial capacity plan.",
            expected_fingerprint=capacity_plan_content_fingerprint(draft),
        )

        self.assertEqual(
            published.lifecycle_status,
            SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        self.assertEqual(published.published_by, self.office)
        self.assertIsNotNone(published.published_at)
        self.assertEqual(
            published.publication_reason,
            "Approved initial capacity plan.",
        )

    def test_publishing_replacement_supersedes_current_plan_atomically(self):
        current = self.publish_complete_plan(version=1)
        draft = clone_capacity_plan(current, actor=self.office)
        update_capacity_entry(
            draft,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=1,
            panel_limit=7,
            expected_fingerprint=capacity_plan_content_fingerprint(draft),
        )
        publish_audits_before = LecturerCapacityAudit.objects.filter(
            action=LecturerCapacityAudit.Action.PUBLISH
        ).count()

        published = publish_capacity_plan(
            draft,
            actor=self.office,
            reason="Approved revised allocation.",
            expected_fingerprint=capacity_plan_content_fingerprint(draft),
        )

        current.refresh_from_db()
        self.assertEqual(current.lifecycle_status, "SUPERSEDED")
        self.assertEqual(published.lifecycle_status, "PUBLISHED")
        self.assertEqual(
            LecturerCapacityAudit.objects.filter(action="PUBLISH").count(),
            publish_audits_before + 1,
        )
        replacement_audits = LecturerCapacityAudit.objects.filter(
            reason="Approved revised allocation."
        )
        self.assertEqual(
            set(replacement_audits.values_list("action", flat=True)),
            {
                LecturerCapacityAudit.Action.PUBLISH,
                LecturerCapacityAudit.Action.SUPERSEDE,
            },
        )

    def test_publication_locks_entries_for_every_same_semester_plan_only(self):
        prior = self.publish_complete_plan(
            semester=self.prior_semester,
            version=1,
        )
        current = self.publish_complete_plan(version=1)
        draft = clone_capacity_plan(current, actor=self.office)
        expected_locked_rows = list(
            LecturerCapacityEntry.objects.filter(plan_id__in=[current.pk, draft.pk])
            .order_by("plan_id", "lecturer_id", "pk")
            .values_list("plan_id", "lecturer_id", "pk")
        )
        prior_entry_ids = set(
            LecturerCapacityEntry.objects.filter(plan=prior).values_list(
                "pk",
                flat=True,
            )
        )
        locked_entry_batches = []
        original_lock_entries = capacity_services._lock_capacity_entries_for_plans

        def capture_locked_entries(plan_ids):
            entries = original_lock_entries(plan_ids)
            locked_entry_batches.append(
                [(entry.plan_id, entry.lecturer_id, entry.pk) for entry in entries]
            )
            return entries

        with patch(
            "academics.capacity_services._lock_capacity_entries_for_plans",
            side_effect=capture_locked_entries,
        ):
            publish_capacity_plan(
                draft,
                actor=self.office,
                reason="Approved replacement with complete entry locks.",
                expected_fingerprint=capacity_plan_content_fingerprint(draft),
            )

        self.assertEqual(locked_entry_batches, [expected_locked_rows])
        self.assertTrue(
            prior_entry_ids.isdisjoint(
                entry_id for batch in locked_entry_batches for _, _, entry_id in batch
            )
        )

    def test_stale_and_non_draft_plan_mutations_are_conflicts(self):
        draft = self.complete_plan()
        stale = SemesterCapacityPlan.objects.get(pk=draft.pk)
        published = publish_capacity_plan(
            draft,
            actor=self.office,
            reason="Approved capacity plan.",
            expected_fingerprint=capacity_plan_content_fingerprint(draft),
        )

        with self.assertRaises(CapacityLifecycleConflict):
            publish_capacity_plan(
                stale,
                actor=self.office,
                reason="Stale retry.",
                expected_fingerprint=capacity_plan_content_fingerprint(stale),
            )
        with self.assertRaises(CapacityLifecycleConflict):
            update_capacity_entry(
                published,
                lecturer=self.lecturer,
                actor=self.office,
                supervisor_limit=1,
                panel_limit=1,
                expected_fingerprint=capacity_plan_content_fingerprint(published),
            )

    def test_concurrent_publication_integrity_failure_rolls_back_supersession(self):
        current = self.publish_complete_plan()
        draft = clone_capacity_plan(current, actor=self.office)
        original_save = SemesterCapacityPlan.save

        def fail_target_publication(instance, *args, **kwargs):
            if (
                instance.pk == draft.pk
                and instance.lifecycle_status
                == SemesterCapacityPlan.Lifecycle.PUBLISHED
            ):
                raise IntegrityError("simulated concurrent publication")
            return original_save(instance, *args, **kwargs)

        audit_count = LecturerCapacityAudit.objects.count()
        with patch.object(
            SemesterCapacityPlan,
            "save",
            fail_target_publication,
        ):
            with self.assertRaises(CapacityLifecycleConflict):
                publish_capacity_plan(
                    draft,
                    actor=self.office,
                    reason="Approved concurrent replacement.",
                    expected_fingerprint=capacity_plan_content_fingerprint(draft),
                )

        current.refresh_from_db()
        draft.refresh_from_db()
        self.assertEqual(
            current.lifecycle_status,
            SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        self.assertEqual(draft.lifecycle_status, SemesterCapacityPlan.Lifecycle.DRAFT)
        self.assertEqual(LecturerCapacityAudit.objects.count(), audit_count)

    def test_publication_window_and_cancellation_reasons_are_mandatory(self):
        plan = self.complete_plan()
        with self.assertRaises(ValidationError):
            publish_capacity_plan(
                plan,
                actor=self.office,
                reason="  ",
                expected_fingerprint=capacity_plan_content_fingerprint(plan),
            )
        with self.assertRaises(ValidationError):
            create_availability_window(
                semester=self.semester,
                lecturer=self.lecturer,
                role=LecturerAvailabilityWindow.Role.SUPERVISOR,
                starts_on=self.semester.starts_on,
                ends_on=self.semester.starts_on,
                actor=self.office,
                reason="",
            )
        window = create_availability_window(
            semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.semester.starts_on,
            ends_on=self.semester.starts_on,
            actor=self.office,
            reason="Approved leave.",
        )
        with self.assertRaises(ValidationError):
            cancel_availability_window(window, actor=self.office, reason="\t")

    def test_capacity_reduction_below_load_blocks_publication_and_preserves_appointment(self):
        current = self.publish_complete_plan()
        appointment = self.create_student_appointment()
        draft = clone_capacity_plan(current, actor=self.office)

        entry = update_capacity_entry(
            draft,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=0,
            panel_limit=8,
            expected_fingerprint=capacity_plan_content_fingerprint(draft),
        )
        self.assertTrue(validate_capacity_plan_ready(draft))
        with self.assertRaises(CapacityLifecycleConflict):
            publish_capacity_plan(
                draft,
                actor=self.office,
                reason="Attempted zero-capacity replacement.",
                expected_fingerprint=capacity_plan_content_fingerprint(draft),
            )

        appointment.refresh_from_db()
        self.assertEqual(entry.supervisor_limit, 0)
        draft.refresh_from_db()
        current.refresh_from_db()
        self.assertEqual(draft.lifecycle_status, SemesterCapacityPlan.Lifecycle.DRAFT)
        self.assertEqual(current.lifecycle_status, SemesterCapacityPlan.Lifecycle.PUBLISHED)
        self.assertEqual(appointment.status, SupervisorAppointment.Status.ACTIVE)

    def test_availability_validates_bounds_roles_overlap_and_cancellation(self):
        with self.assertRaises(ValidationError):
            create_availability_window(
                semester=self.semester,
                lecturer=self.lecturer,
                role="NOT_A_ROLE",
                starts_on=self.semester.starts_on,
                ends_on=self.semester.starts_on,
                actor=self.office,
                reason="Invalid role.",
            )
        with self.assertRaises(ValidationError):
            create_availability_window(
                semester=self.semester,
                lecturer=self.lecturer,
                role=LecturerAvailabilityWindow.Role.SUPERVISOR,
                starts_on=self.semester.starts_on - timedelta(days=1),
                ends_on=self.semester.starts_on,
                actor=self.office,
                reason="Outside semester.",
            )
        with self.assertRaises(ValidationError):
            create_availability_window(
                semester=self.semester,
                lecturer=self.lecturer,
                role=LecturerAvailabilityWindow.Role.SUPERVISOR,
                starts_on=self.semester.starts_on + timedelta(days=1),
                ends_on=self.semester.starts_on,
                actor=self.office,
                reason="Reversed dates.",
            )
        starts_on = self.semester.starts_on + timedelta(days=5)
        ends_on = starts_on + timedelta(days=3)
        supervisor_window = create_availability_window(
            semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=starts_on,
            ends_on=ends_on,
            actor=self.office,
            reason="Approved Supervisor leave.",
        )
        with self.assertRaises(AvailabilityConflict):
            create_availability_window(
                semester=self.semester,
                lecturer=self.lecturer,
                role=LecturerAvailabilityWindow.Role.SUPERVISOR,
                starts_on=ends_on,
                ends_on=ends_on + timedelta(days=2),
                actor=self.office,
                reason="Overlapping Supervisor leave.",
            )
        panel_window = create_availability_window(
            semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.PANEL,
            starts_on=starts_on,
            ends_on=ends_on,
            actor=self.office,
            reason="Independent Panel leave.",
        )
        stale_window = LecturerAvailabilityWindow.objects.get(pk=supervisor_window.pk)

        cancelled = cancel_availability_window(
            supervisor_window,
            actor=self.office,
            reason="Lecturer returned early.",
        )

        self.assertIsNotNone(cancelled.cancelled_at)
        self.assertEqual(cancelled.reason, "Approved Supervisor leave.")
        self.assertEqual(cancelled.starts_on, starts_on)
        self.assertIsNone(panel_window.cancelled_at)
        with self.assertRaises(AvailabilityConflict):
            cancel_availability_window(
                stale_window,
                actor=self.office,
                reason="Stale cancellation.",
            )
        with self.assertRaises(AvailabilityConflict):
            cancel_availability_window(
                cancelled,
                actor=self.office,
                reason="Duplicate cancellation.",
            )

    def test_availability_requires_active_lecturer_with_requested_profile(self):
        with self.assertRaises(CapacityLifecycleConflict):
            create_availability_window(
                semester=self.semester,
                lecturer=self.supervisor_only,
                role=LecturerAvailabilityWindow.Role.PANEL,
                starts_on=self.semester.starts_on,
                ends_on=self.semester.starts_on,
                actor=self.office,
                reason="Unavailable for an absent role.",
            )
        Lecturer.objects.filter(pk=self.lecturer.pk).update(
            lifecycle_status=Lecturer.Lifecycle.RETIRING
        )
        with self.assertRaises(CapacityLifecycleConflict):
            create_availability_window(
                semester=self.semester,
                lecturer=self.lecturer,
                role=LecturerAvailabilityWindow.Role.SUPERVISOR,
                starts_on=self.semester.starts_on,
                ends_on=self.semester.starts_on,
                actor=self.office,
                reason="Inactive lecturer restriction.",
            )

    def test_window_can_be_cancelled_after_role_removal_but_not_reactivated(self):
        window = create_availability_window(
            semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.semester.starts_on,
            ends_on=self.semester.starts_on + timedelta(days=2),
            actor=self.office,
            reason="Approved Supervisor leave.",
        )
        Supervisor.objects.filter(lecturer=self.lecturer).delete()

        cancelled = cancel_availability_window(
            window,
            actor=self.office,
            reason="Restriction safely terminated after role removal.",
        )

        self.assertIsNotNone(cancelled.cancelled_at)
        self.assertTrue(
            LecturerCapacityAudit.objects.filter(
                availability_window=cancelled,
                action=LecturerCapacityAudit.Action.AVAILABILITY_CANCEL,
                reason="Restriction safely terminated after role removal.",
            ).exists()
        )
        Supervisor.objects.create(lecturer=self.lecturer, max_supervisees=5)
        cancelled.cancelled_by = None
        cancelled.cancelled_at = None
        cancelled.cancellation_reason = ""
        with self.assertRaises(ValidationError):
            cancelled.save(
                update_fields=[
                    "cancelled_by",
                    "cancelled_at",
                    "cancellation_reason",
                ]
            )

    def test_window_cancellation_rolls_back_when_audit_creation_fails(self):
        window = create_availability_window(
            semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.semester.starts_on,
            ends_on=self.semester.starts_on + timedelta(days=2),
            actor=self.office,
            reason="Approved leave.",
        )

        with patch(
            "academics.capacity_services._audit",
            side_effect=RuntimeError("simulated audit failure"),
        ):
            with self.assertRaises(RuntimeError):
                cancel_availability_window(
                    window,
                    actor=self.office,
                    reason="Cancelled after review.",
                )

        window.refresh_from_db()
        self.assertIsNone(window.cancelled_at)
        self.assertIsNone(window.cancelled_by_id)
        self.assertEqual(window.cancellation_reason, "")

    def test_service_audits_cover_every_action_with_json_safe_snapshots(self):
        source = self.publish_complete_plan(
            semester=self.prior_semester,
            version=1,
        )
        copied = create_capacity_plan(
            semester=self.semester,
            actor=self.office,
            copy_from=source,
        )
        update_capacity_entry(
            copied,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=2,
            panel_limit=7,
            expected_fingerprint=capacity_plan_content_fingerprint(copied),
        )
        copied = publish_capacity_plan(
            copied,
            actor=self.office,
            reason="Approved copied plan.",
            expected_fingerprint=capacity_plan_content_fingerprint(copied),
        )
        replacement = clone_capacity_plan(copied, actor=self.office)
        publish_capacity_plan(
            replacement,
            actor=self.office,
            reason="Approved replacement plan.",
            expected_fingerprint=capacity_plan_content_fingerprint(replacement),
        )
        window = create_availability_window(
            semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.PANEL,
            starts_on=self.semester.starts_on,
            ends_on=self.semester.starts_on,
            actor=self.office,
            reason="Approved Panel leave.",
        )
        cancel_availability_window(
            window,
            actor=self.office,
            reason="Panel leave cancelled.",
        )

        unused_draft = create_capacity_plan(semester=self.semester, actor=self.office)
        capacity_services.discard_capacity_plan(
            unused_draft, actor=self.office, reason="Duplicate draft discarded.",
            expected_fingerprint=capacity_plan_content_fingerprint(unused_draft),
        )

        audits = LecturerCapacityAudit.objects.all()
        self.assertEqual(
            set(audits.values_list("action", flat=True)),
            set(LecturerCapacityAudit.Action.values),
        )
        for audit in audits:
            self.assertEqual(audit.actor, self.office)
            self.assertTrue(audit.reason.strip())
            json.dumps(audit.before_values, sort_keys=True)
            json.dumps(audit.after_values, sort_keys=True)
        self.assertTrue(
            audits.filter(
                action=LecturerCapacityAudit.Action.AVAILABILITY_CREATE,
                availability_window=window,
                lecturer=self.lecturer,
            ).exists()
        )
        self.assertTrue(
            audits.filter(
                action=LecturerCapacityAudit.Action.SUPERSEDE,
                plan=copied,
                reason="Approved replacement plan.",
            ).exists()
        )

    def test_capacity_plan_snapshot_is_deterministic_and_json_safe(self):
        plan = self.complete_plan()

        first = capacity_plan_snapshot(plan)
        second = capacity_plan_snapshot(plan)

        self.assertEqual(first, second)
        self.assertEqual(
            [entry["staffNo"] for entry in first["entries"]],
            sorted([self.lecturer.staff_no, self.supervisor_only.staff_no]),
        )
        encoded = json.dumps(first, sort_keys=True)
        self.assertEqual(json.loads(encoded), first)


class CapacityApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(
            email="capacity.api.office@example.test",
            password="local-test-password",
            full_name="Capacity API Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(
            user=cls.office,
            staff_no="CAP-API-OFFICE",
            department="Postgraduate Office",
        )
        cls.student_user = User.objects.create_user(
            email="capacity.api.student@example.test",
            password="local-test-password",
            full_name="Capacity API Student",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=cls.student_user,
            matric_no="CAP-API-STUDENT",
            programme="Master of Computer Science",
        )
        cls.coordinator_user = User.objects.create_user(
            email="capacity.api.coordinator@example.test",
            password="local-test-password",
            full_name="Capacity API Coordinator",
            role=User.Role.COORDINATOR,
        )
        cls.supervisor_only = cls._create_lecturer(
            "001",
            supervisor=True,
            panel=False,
        )
        cls.dual_role = cls._create_lecturer(
            "002",
            supervisor=True,
            panel=True,
        )
        cls.prior_semester = AcademicSemester.objects.create(
            code="2025-2026-S2-API",
            academic_session="2025/2026",
            term=AcademicSemester.Term.SEMESTER_II,
            starts_on=date(2026, 2, 1),
            ends_on=date(2026, 6, 30),
            created_by=cls.office,
        )
        cls.semester = AcademicSemester.objects.create(
            code="2026-2027-S1-API",
            academic_session="2026/2027",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2026, 9, 1),
            ends_on=date(2027, 1, 31),
            created_by=cls.office,
        )

    @classmethod
    def _create_lecturer(cls, suffix, *, supervisor, panel):
        user = User.objects.create_user(
            email=f"capacity.api.lecturer.{suffix}@example.test",
            password="local-test-password",
            full_name=f"Capacity API Lecturer {suffix}",
            role=User.Role.LECTURER,
        )
        lecturer = Lecturer.objects.create(
            user=user,
            staff_no=f"CAP-API-LECT-{suffix}",
            department="Computing",
        )
        if supervisor:
            Supervisor.objects.create(lecturer=lecturer, max_supervisees=5)
        if panel:
            Panel.objects.create(lecturer=lecturer, max_appointments=10)
        return lecturer

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.office)

    def create_plan(self, *, semester=None, copy_from_plan_id=None):
        semester = semester or self.semester
        response = self.client.post(
            f"/api/academics/semesters/{semester.pk}/capacity-plans/",
            {"copyFromPlanId": copy_from_plan_id},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def update_entry(
        self,
        plan_payload,
        lecturer,
        *,
        supervisor_limit,
        panel_limit,
    ):
        response = self.client.patch(
            (
                f"/api/academics/capacity-plans/{plan_payload['id']}"
                f"/lecturers/{lecturer.pk}/"
            ),
            {
                "supervisorLimit": supervisor_limit,
                "panelLimit": panel_limit,
                "expectedVersion": plan_payload["version"],
                "expectedFingerprint": plan_payload["contentFingerprint"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def complete_plan(self, *, semester=None, copy_from_plan_id=None):
        plan = self.create_plan(
            semester=semester,
            copy_from_plan_id=copy_from_plan_id,
        ).data
        if copy_from_plan_id is None:
            plan = self.update_entry(
                plan,
                self.supervisor_only,
                supervisor_limit=4,
                panel_limit=None,
            )
            plan = self.update_entry(
                plan,
                self.dual_role,
                supervisor_limit=5,
                panel_limit=8,
            )
        return plan

    def publish_plan(self, plan, *, reason="Approved capacity policy."):
        response = self.client.post(
            f"/api/academics/capacity-plans/{plan['id']}/publish/",
            {
                "reason": reason,
                "expectedVersion": plan["version"],
                "expectedFingerprint": plan["contentFingerprint"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_office_lists_creates_and_reads_deterministic_plan_payloads(self):
        created = self.create_plan().data

        self.assertEqual(created["semesterId"], self.semester.pk)
        self.assertEqual(created["semesterCode"], self.semester.code)
        self.assertEqual(created["semesterLabel"], self.semester.label)
        self.assertEqual(created["version"], 1)
        self.assertEqual(created["lifecycleStatus"], "DRAFT")
        self.assertEqual(created["origin"], "CREATED")
        self.assertIsNone(created["supersedesId"])
        self.assertFalse(created["isComplete"])
        self.assertFalse(created["isCurrentPublished"])
        self.assertTrue(created["readinessErrors"])
        self.assertRegex(created["contentFingerprint"], r"^[0-9a-f]{64}$")
        self.assertEqual(created["entries"], [])
        self.assertEqual(created["createdBy"]["id"], self.office.pk)
        self.assertEqual(created["createdBy"]["name"], self.office.full_name)
        self.assertIn("createdAt", created)
        self.assertIsNone(created["publishedBy"])
        self.assertIsNone(created["publishedAt"])

        listed = self.client.get(
            f"/api/academics/semesters/{self.semester.pk}/capacity-plans/"
        )
        detail = self.client.get(f"/api/academics/capacity-plans/{created['id']}/")

        self.assertEqual(listed.status_code, 200)
        self.assertEqual([row["id"] for row in listed.data], [created["id"]])
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data, listed.data[0])

    def test_capacity_plan_history_uses_bounded_array_pagination(self):
        plans = [
            SemesterCapacityPlan.objects.create(
                academic_semester=self.semester,
                version=version,
                lifecycle_status=SemesterCapacityPlan.Lifecycle.DRAFT,
                origin=SemesterCapacityPlan.Origin.CREATED,
                created_by=self.office,
            )
            for version in range(1, 32)
        ]

        default_page = self.client.get(
            f"/api/academics/semesters/{self.semester.pk}/capacity-plans/"
        )
        second_page = self.client.get(
            (
                f"/api/academics/semesters/{self.semester.pk}/capacity-plans/"
                "?limit=10&offset=10"
            )
        )

        self.assertEqual(default_page.status_code, 200)
        self.assertEqual(len(default_page.data), 25)
        self.assertEqual(
            [row["version"] for row in default_page.data],
            list(range(31, 6, -1)),
        )
        self.assertEqual(default_page["X-Total-Count"], "31")
        self.assertEqual(default_page["X-Limit"], "25")
        self.assertEqual(default_page["X-Offset"], "0")
        self.assertEqual(second_page.status_code, 200)
        self.assertEqual(len(second_page.data), 10)
        self.assertEqual(
            [row["id"] for row in second_page.data],
            [plan.pk for plan in reversed(plans)][10:20],
        )
        self.assertEqual(second_page["X-Total-Count"], "31")
        self.assertEqual(second_page["X-Limit"], "10")
        self.assertEqual(second_page["X-Offset"], "10")
        self.assertTrue(
            {"X-Total-Count", "X-Limit", "X-Offset"}.issubset(
                set(getattr(settings, "CORS_EXPOSE_HEADERS", ()))
            )
        )

    def test_capacity_audit_and_availability_history_are_paginated(self):
        audits = [
            LecturerCapacityAudit.objects.create(
                academic_semester=self.semester,
                actor=self.office,
                action=LecturerCapacityAudit.Action.PLAN_CREATE,
                reason=f"Capacity audit {index}.",
                before_values={},
                after_values={"index": index},
            )
            for index in range(30)
        ]
        windows = [
            LecturerAvailabilityWindow.objects.create(
                academic_semester=self.semester,
                lecturer=self.dual_role,
                role=LecturerAvailabilityWindow.Role.PANEL,
                starts_on=self.semester.starts_on + timedelta(days=index),
                ends_on=self.semester.starts_on + timedelta(days=index),
                reason=f"Availability history {index}.",
                created_by=self.office,
            )
            for index in range(30)
        ]

        audit_page = self.client.get(
            (
                f"/api/academics/semesters/{self.semester.pk}/capacity-audits/"
                "?limit=7&offset=3"
            )
        )
        availability_page = self.client.get(
            (
                f"/api/academics/semesters/{self.semester.pk}/availability/"
                "?limit=8&offset=4"
            )
        )

        self.assertEqual(audit_page.status_code, 200)
        self.assertEqual(
            [row["id"] for row in audit_page.data],
            [audit.pk for audit in reversed(audits)][3:10],
        )
        self.assertEqual(audit_page["X-Total-Count"], "30")
        self.assertEqual(audit_page["X-Limit"], "7")
        self.assertEqual(audit_page["X-Offset"], "3")
        self.assertEqual(availability_page.status_code, 200)
        self.assertEqual(
            [row["id"] for row in availability_page.data],
            [window.pk for window in windows][4:12],
        )
        self.assertEqual(availability_page["X-Total-Count"], "30")
        self.assertEqual(availability_page["X-Limit"], "8")
        self.assertEqual(availability_page["X-Offset"], "4")

    def test_capacity_history_pagination_rejects_invalid_values(self):
        endpoints = (
            f"/api/academics/semesters/{self.semester.pk}/capacity-plans/",
            f"/api/academics/semesters/{self.semester.pk}/capacity-audits/",
            f"/api/academics/semesters/{self.semester.pk}/availability/",
        )
        invalid_queries = (
            "limit=invalid",
            "limit=0",
            "limit=-1",
            "limit=101",
            "offset=invalid",
            "offset=-1",
        )

        for endpoint in endpoints:
            for query in invalid_queries:
                with self.subTest(endpoint=endpoint, query=query):
                    response = self.client.get(f"{endpoint}?{query}")
                    self.assertEqual(response.status_code, 400)

    def test_capacity_history_pagination_bounds_large_offsets(self):
        endpoints = (
            (
                f"/api/academics/semesters/{self.semester.pk}/capacity-plans/",
                SemesterCapacityPlan.objects.filter(
                    academic_semester=self.semester
                ).count(),
            ),
            (
                f"/api/academics/semesters/{self.semester.pk}/capacity-audits/",
                LecturerCapacityAudit.objects.filter(
                    academic_semester=self.semester
                ).count(),
            ),
            (
                f"/api/academics/semesters/{self.semester.pk}/availability/",
                LecturerAvailabilityWindow.objects.filter(
                    academic_semester=self.semester
                ).count(),
            ),
        )

        for endpoint, total_count in endpoints:
            with self.subTest(endpoint=endpoint, offset="over maximum"):
                response = self.client.get(f"{endpoint}?offset=1000001")
                self.assertEqual(response.status_code, 400)

            with self.subTest(endpoint=endpoint, offset="maximum"):
                response = self.client.get(f"{endpoint}?offset=1000000")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, [])
                self.assertEqual(response["X-Limit"], "25")
                self.assertEqual(response["X-Offset"], "1000000")
                self.assertEqual(response["X-Total-Count"], str(total_count))

    def test_plan_create_and_clone_reject_unknown_fields_without_side_effects(self):
        plan_count = SemesterCapacityPlan.objects.count()
        audit_count = LecturerCapacityAudit.objects.count()

        snake_case = self.client.post(
            f"/api/academics/semesters/{self.semester.pk}/capacity-plans/",
            {"copy_from_plan_id": 123},
            format="json",
        )

        self.assertEqual(snake_case.status_code, 400)
        self.assertEqual(SemesterCapacityPlan.objects.count(), plan_count)
        self.assertEqual(LecturerCapacityAudit.objects.count(), audit_count)

        published = self.publish_plan(self.complete_plan())
        plan_count = SemesterCapacityPlan.objects.count()
        audit_count = LecturerCapacityAudit.objects.count()
        surplus_clone = self.client.post(
            f"/api/academics/capacity-plans/{published['id']}/clone/",
            {"unexpected": "value"},
            format="json",
        )

        self.assertEqual(surplus_clone.status_code, 400)
        self.assertEqual(SemesterCapacityPlan.objects.count(), plan_count)
        self.assertEqual(LecturerCapacityAudit.objects.count(), audit_count)

    def test_plan_writes_reject_wrong_case_and_surplus_fields(self):
        plan = self.create_plan().data
        entry_count = LecturerCapacityEntry.objects.count()
        audit_count = LecturerCapacityAudit.objects.count()
        entry_endpoint = (
            f"/api/academics/capacity-plans/{plan['id']}"
            f"/lecturers/{self.supervisor_only.pk}/"
        )
        valid_values = {
            "supervisorLimit": 4,
            "panelLimit": None,
            "expectedVersion": plan["version"],
            "expectedFingerprint": plan["contentFingerprint"],
        }

        wrong_case = self.client.patch(
            entry_endpoint,
            {
                **valid_values,
                "supervisor_limit": valid_values["supervisorLimit"],
            },
            format="json",
        )
        detail_surplus = self.client.patch(
            f"/api/academics/capacity-plans/{plan['id']}/",
            {
                "lecturerId": self.supervisor_only.pk,
                **valid_values,
                "unexpected": True,
            },
            format="json",
        )
        publish_surplus = self.client.post(
            f"/api/academics/capacity-plans/{plan['id']}/publish/",
            {
                "reason": "Must not be accepted.",
                "expectedVersion": plan["version"],
                "expectedFingerprint": plan["contentFingerprint"],
                "unexpected": True,
            },
            format="json",
        )

        self.assertEqual(wrong_case.status_code, 400)
        self.assertEqual(detail_surplus.status_code, 400)
        self.assertEqual(publish_surplus.status_code, 400)
        self.assertEqual(LecturerCapacityEntry.objects.count(), entry_count)
        self.assertEqual(LecturerCapacityAudit.objects.count(), audit_count)

    def test_availability_create_and_cancel_reject_unknown_fields(self):
        endpoint = f"/api/academics/semesters/{self.semester.pk}/availability/"
        window_count = LecturerAvailabilityWindow.objects.count()
        audit_count = LecturerCapacityAudit.objects.count()
        snake_case = self.client.post(
            endpoint,
            {
                "lecturer_id": self.dual_role.pk,
                "role": "PANEL",
                "starts_on": "2026-11-01",
                "ends_on": "2026-11-02",
                "reason": "Must not be accepted.",
            },
            format="json",
        )

        self.assertEqual(snake_case.status_code, 400)
        self.assertEqual(LecturerAvailabilityWindow.objects.count(), window_count)
        self.assertEqual(LecturerCapacityAudit.objects.count(), audit_count)

        created = self.client.post(
            endpoint,
            {
                "lecturerId": self.dual_role.pk,
                "role": "PANEL",
                "startsOn": "2026-11-01",
                "endsOn": "2026-11-02",
                "reason": "Approved internal leave.",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        audit_count = LecturerCapacityAudit.objects.count()
        surplus_cancel = self.client.post(
            f"/api/academics/availability/{created.data['id']}/cancel/",
            {"reason": "Cancel leave.", "unexpected": True},
            format="json",
        )

        self.assertEqual(surplus_cancel.status_code, 400)
        self.assertIsNone(
            LecturerAvailabilityWindow.objects.get(pk=created.data["id"]).cancelled_at
        )
        self.assertEqual(LecturerCapacityAudit.objects.count(), audit_count)

    def test_plan_entry_write_requires_both_stale_tokens_and_maps_errors(self):
        plan = self.create_plan().data
        endpoint = (
            f"/api/academics/capacity-plans/{plan['id']}"
            f"/lecturers/{self.supervisor_only.pk}/"
        )
        values = {
            "supervisorLimit": 4,
            "panelLimit": None,
            "expectedVersion": plan["version"],
            "expectedFingerprint": plan["contentFingerprint"],
        }

        missing_version = self.client.patch(
            endpoint,
            {key: value for key, value in values.items() if key != "expectedVersion"},
            format="json",
        )
        missing_fingerprint = self.client.patch(
            endpoint,
            {
                key: value
                for key, value in values.items()
                if key != "expectedFingerprint"
            },
            format="json",
        )
        malformed = self.client.patch(
            endpoint,
            {**values, "expectedFingerprint": "not-a-fingerprint"},
            format="json",
        )
        negative = self.client.patch(
            endpoint,
            {**values, "supervisorLimit": -1},
            format="json",
        )

        self.assertEqual(missing_version.status_code, 400)
        self.assertEqual(missing_fingerprint.status_code, 400)
        self.assertEqual(malformed.status_code, 400)
        self.assertEqual(negative.status_code, 400)

        saved = self.client.patch(endpoint, values, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(
            saved.data["entries"][0]["lecturerId"], self.supervisor_only.pk
        )
        self.assertEqual(saved.data["entries"][0]["supervisorLimit"], 4)
        self.assertIsNone(saved.data["entries"][0]["panel"])
        self.assertEqual(saved.data["entries"][0]["supervisor"]["activeLoad"], 0)
        self.assertNotEqual(
            saved.data["contentFingerprint"],
            plan["contentFingerprint"],
        )

        stale_version = self.client.patch(
            endpoint,
            {**values, "expectedVersion": plan["version"] + 1},
            format="json",
        )
        stale_fingerprint = self.client.patch(endpoint, values, format="json")
        unknown_plan = self.client.patch(
            (
                "/api/academics/capacity-plans/999999"
                f"/lecturers/{self.supervisor_only.pk}/"
            ),
            values,
            format="json",
        )
        unknown_lecturer = self.client.patch(
            f"/api/academics/capacity-plans/{plan['id']}/lecturers/999999/",
            values,
            format="json",
        )

        self.assertEqual(stale_version.status_code, 409)
        self.assertEqual(stale_fingerprint.status_code, 409)
        self.assertEqual(unknown_plan.status_code, 404)
        self.assertEqual(unknown_lecturer.status_code, 404)

    def test_plan_detail_patch_uses_the_same_entry_write_contract(self):
        plan = self.create_plan().data
        response = self.client.patch(
            f"/api/academics/capacity-plans/{plan['id']}/",
            {
                "lecturerId": self.supervisor_only.pk,
                "supervisorLimit": 3,
                "panelLimit": None,
                "expectedVersion": plan["version"],
                "expectedFingerprint": plan["contentFingerprint"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["entries"][0]["supervisorLimit"], 3)

    def test_plan_detail_query_count_is_bounded_across_role_entries(self):
        plan = self.complete_plan()
        for suffix in ("QUERY-003", "QUERY-004", "QUERY-005"):
            lecturer = self._create_lecturer(
                suffix,
                supervisor=True,
                panel=True,
            )
            plan = self.update_entry(
                plan,
                lecturer,
                supervisor_limit=4,
                panel_limit=8,
            )

        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(f"/api/academics/capacity-plans/{plan['id']}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["entries"]), 5)
        self.assertLessEqual(len(captured), 20)

    def test_plan_history_reuses_one_resolution_context_across_versions(self):
        additional_lecturers = [
            self._create_lecturer(
                f"LIST-QUERY-{index}",
                supervisor=True,
                panel=True,
            )
            for index in range(3)
        ]
        plan = self.complete_plan()
        for lecturer in additional_lecturers:
            plan = self.update_entry(
                plan,
                lecturer,
                supervisor_limit=4,
                panel_limit=8,
            )
        published = self.publish_plan(plan)
        second = self.client.post(
            f"/api/academics/capacity-plans/{published['id']}/clone/",
            {},
            format="json",
        ).data
        second = self.publish_plan(second, reason="Approved second version.")
        third = self.client.post(
            f"/api/academics/capacity-plans/{second['id']}/clone/",
            {},
            format="json",
        )
        self.assertEqual(third.status_code, 201, third.data)
        endpoint = f"/api/academics/semesters/{self.semester.pk}/capacity-plans/"

        with CaptureQueriesContext(connection) as one_plan_queries:
            one_plan = self.client.get(f"{endpoint}?limit=1")
        with CaptureQueriesContext(connection) as all_plan_queries:
            all_plans = self.client.get(endpoint)

        self.assertEqual(one_plan.status_code, 200)
        self.assertEqual(all_plans.status_code, 200)
        self.assertEqual(len(one_plan.data), 1)
        self.assertEqual(len(all_plans.data), 3)
        self.assertEqual([row["version"] for row in all_plans.data], [3, 2, 1])
        self.assertLessEqual(len(all_plan_queries), len(one_plan_queries) + 2)
        self.assertLessEqual(len(all_plan_queries), 20)

    def test_office_publishes_complete_plan_and_lifecycle_conflicts_are_409(self):
        incomplete = self.create_plan().data
        incomplete_response = self.client.post(
            f"/api/academics/capacity-plans/{incomplete['id']}/publish/",
            {
                "reason": "Incomplete publication attempt.",
                "expectedVersion": incomplete["version"],
                "expectedFingerprint": incomplete["contentFingerprint"],
            },
            format="json",
        )
        self.assertEqual(incomplete_response.status_code, 409)

        plan = self.complete_plan()
        published = self.publish_plan(plan)

        self.assertEqual(published["lifecycleStatus"], "PUBLISHED")
        self.assertTrue(published["isComplete"])
        self.assertTrue(published["isCurrentPublished"])
        self.assertEqual(published["publishedBy"]["id"], self.office.pk)
        self.assertEqual(published["publicationReason"], "Approved capacity policy.")
        self.assertIsNotNone(published["publishedAt"])

        repeated = self.client.post(
            f"/api/academics/capacity-plans/{published['id']}/publish/",
            {
                "reason": "Repeated publication.",
                "expectedVersion": published["version"],
                "expectedFingerprint": published["contentFingerprint"],
            },
            format="json",
        )
        self.assertEqual(repeated.status_code, 409)

    def test_office_copies_and_clones_plans_with_stable_lineage(self):
        prior = self.publish_plan(
            self.complete_plan(semester=self.prior_semester),
            reason="Approved prior policy.",
        )

        copied = self.create_plan(
            copy_from_plan_id=prior["id"],
        ).data
        published_copied = self.publish_plan(
            copied,
            reason="Approved copied policy.",
        )
        cloned = self.client.post(
            f"/api/academics/capacity-plans/{published_copied['id']}/clone/",
            {},
            format="json",
        )

        self.assertEqual(copied["origin"], "COPIED_FORWARD")
        self.assertEqual(copied["supersedesId"], prior["id"])
        self.assertEqual(len(copied["entries"]), 2)
        self.assertEqual(cloned.status_code, 201, cloned.data)
        self.assertEqual(cloned.data["version"], copied["version"] + 1)
        self.assertEqual(cloned.data["supersedesId"], published_copied["id"])
        self.assertEqual(
            cloned.data["entries"],
            sorted(
                cloned.data["entries"],
                key=lambda entry: (entry["staffNo"], entry["lecturerId"]),
            ),
        )

        unknown_copy = self.client.post(
            f"/api/academics/semesters/{self.semester.pk}/capacity-plans/",
            {"copyFromPlanId": 999999},
            format="json",
        )
        malformed_copy = self.client.post(
            f"/api/academics/semesters/{self.semester.pk}/capacity-plans/",
            {"copyFromPlanId": "invalid"},
            format="json",
        )
        unknown_clone = self.client.post(
            "/api/academics/capacity-plans/999999/clone/",
            {},
            format="json",
        )

        self.assertEqual(unknown_copy.status_code, 404)
        self.assertEqual(malformed_copy.status_code, 400)
        self.assertEqual(unknown_clone.status_code, 404)

    def test_office_manages_availability_with_internal_reason_and_history(self):
        endpoint = f"/api/academics/semesters/{self.semester.pk}/availability/"
        payload = {
            "lecturerId": self.dual_role.pk,
            "role": "SUPERVISOR",
            "startsOn": "2026-09-10",
            "endsOn": "2026-09-20",
            "reason": "Internal approved research leave.",
        }
        created = self.client.post(endpoint, payload, format="json")

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["reason"], payload["reason"])
        self.assertEqual(created.data["lecturerId"], self.dual_role.pk)
        self.assertFalse(created.data["isCancelled"])
        self.assertEqual(created.data["createdBy"]["id"], self.office.pk)

        listed = self.client.get(endpoint)
        overlap = self.client.post(
            endpoint,
            {**payload, "startsOn": "2026-09-20", "endsOn": "2026-09-21"},
            format="json",
        )
        malformed = self.client.post(
            endpoint,
            {**payload, "role": "UNSUPPORTED"},
            format="json",
        )
        unknown_lecturer = self.client.post(
            endpoint,
            {**payload, "lecturerId": 999999},
            format="json",
        )

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data, [created.data])
        self.assertEqual(overlap.status_code, 409)
        self.assertEqual(malformed.status_code, 400)
        self.assertEqual(unknown_lecturer.status_code, 404)

        cancelled = self.client.post(
            f"/api/academics/availability/{created.data['id']}/cancel/",
            {"reason": "Leave was withdrawn."},
            format="json",
        )
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertTrue(cancelled.data["isCancelled"])
        self.assertEqual(cancelled.data["cancellationReason"], "Leave was withdrawn.")
        self.assertEqual(cancelled.data["cancelledBy"]["id"], self.office.pk)

        repeated = self.client.post(
            f"/api/academics/availability/{created.data['id']}/cancel/",
            {"reason": "Repeated cancellation."},
            format="json",
        )
        unknown_window = self.client.post(
            "/api/academics/availability/999999/cancel/",
            {"reason": "Unknown window."},
            format="json",
        )
        unknown_semester = self.client.get(
            "/api/academics/semesters/999999/availability/"
        )

        self.assertEqual(repeated.status_code, 409)
        self.assertEqual(unknown_window.status_code, 404)
        self.assertEqual(unknown_semester.status_code, 404)

    def test_capacity_audits_filter_versions_before_pagination(self):
        first = self.create_plan().data
        second = self.create_plan().data
        semester_event = LecturerCapacityAudit.objects.create(
            academic_semester=self.semester, actor=self.office,
            action=LecturerCapacityAudit.Action.AVAILABILITY_CREATE,
            reason="Semester-wide availability change.",
        )
        url = f"/api/academics/semesters/{self.semester.pk}/capacity-audits/"
        response = self.client.get(url, {
            "pageResult": "true", "version": second["version"], "limit": 1,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["versions"], [second["version"], first["version"]])
        self.assertEqual(response.data["rows"][0]["planId"], second["id"])
        self.assertEqual(response.data["rows"][0]["planVersion"], second["version"])
        all_events = self.client.get(url).data
        self.assertIsNone(next(row for row in all_events if row["id"] == semester_event.pk)["planVersion"])
        self.assertEqual(self.client.get(url, {"version": 999, "pageResult": "true"}).data["total"], 0)
        self.assertEqual(self.client.get(url, {"version": 0}).status_code, 400)
        self.assertEqual(self.client.get(url, {"version": "invalid"}).status_code, 400)

    def test_capacity_audits_are_office_only_and_deterministic(self):
        plan = self.complete_plan()
        self.publish_plan(plan)
        response = self.client.get(
            f"/api/academics/semesters/{self.semester.pk}/capacity-audits/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 4)
        self.assertEqual(
            [row["id"] for row in response.data],
            sorted([row["id"] for row in response.data], reverse=True),
        )
        self.assertEqual(response.data[0]["actor"]["id"], self.office.pk)
        self.assertIn("beforeValues", response.data[0])
        self.assertIn("afterValues", response.data[0])
        self.assertIn("createdAt", response.data[0])

        unknown = self.client.get("/api/academics/semesters/999999/capacity-audits/")
        self.assertEqual(unknown.status_code, 404)

        self.client.force_authenticate(self.student_user)
        denied = self.client.get(
            f"/api/academics/semesters/{self.semester.pk}/capacity-audits/"
        )
        self.assertEqual(denied.status_code, 403)

    def test_non_office_users_cannot_probe_capacity_management_objects(self):
        plan = self.create_plan().data
        availability = self.client.post(
            f"/api/academics/semesters/{self.semester.pk}/availability/",
            {
                "lecturerId": self.dual_role.pk,
                "role": "PANEL",
                "startsOn": "2026-10-01",
                "endsOn": "2026-10-02",
                "reason": "Private availability reason.",
            },
            format="json",
        ).data
        self.client.force_authenticate(self.student_user)

        requests = (
            self.client.get(
                f"/api/academics/semesters/{self.semester.pk}/capacity-plans/"
            ),
            self.client.post(
                f"/api/academics/semesters/{self.semester.pk}/capacity-plans/",
                {"copyFromPlanId": None},
                format="json",
            ),
            self.client.get(f"/api/academics/capacity-plans/{plan['id']}/"),
            self.client.patch(
                f"/api/academics/capacity-plans/{plan['id']}/",
                {},
                format="json",
            ),
            self.client.post(
                f"/api/academics/capacity-plans/{plan['id']}/clone/",
                {},
                format="json",
            ),
            self.client.post(
                f"/api/academics/capacity-plans/{plan['id']}/publish/",
                {
                    "reason": "Unauthorized publication.",
                    "expectedVersion": plan["version"],
                    "expectedFingerprint": plan["contentFingerprint"],
                },
                format="json",
            ),
            self.client.patch(
                (
                    f"/api/academics/capacity-plans/{plan['id']}"
                    f"/lecturers/{self.dual_role.pk}/"
                ),
                {},
                format="json",
            ),
            self.client.get(
                f"/api/academics/semesters/{self.semester.pk}/availability/"
            ),
            self.client.post(
                f"/api/academics/semesters/{self.semester.pk}/availability/",
                {},
                format="json",
            ),
            self.client.post(
                f"/api/academics/availability/{availability['id']}/cancel/",
                {"reason": "Unauthorized cancellation."},
                format="json",
            ),
            self.client.get(
                f"/api/academics/semesters/{self.semester.pk}/capacity-audits/"
            ),
        )

        for response in requests:
            self.assertEqual(response.status_code, 403)

    def test_capacity_permission_denies_non_office_methods_before_lookup(self):
        endpoints = (
            "/api/academics/semesters/999999/capacity-plans/",
            "/api/academics/capacity-plans/999999/",
            "/api/academics/capacity-plans/999999/clone/",
            "/api/academics/capacity-plans/999999/publish/",
            "/api/academics/capacity-plans/999999/lecturers/999999/",
            "/api/academics/semesters/999999/availability/",
            "/api/academics/availability/999999/cancel/",
            "/api/academics/semesters/999999/capacity-audits/",
        )
        users = (
            self.student_user,
            self.supervisor_only.user,
            self.coordinator_user,
        )

        for user in users:
            self.client.force_authenticate(user)
            for method in ("options", "head", "delete"):
                for endpoint in endpoints:
                    with self.subTest(
                        role=user.role,
                        method=method,
                        endpoint=endpoint,
                    ):
                        response = getattr(self.client, method)(
                            endpoint,
                            {},
                            format="json",
                        )
                        self.assertEqual(response.status_code, 403)
                        self.assertNotIn("actions", response.data)
                        self.assertNotIn("not found", str(response.data).lower())


@skipUnless(
    connection.vendor == "postgresql",
    "Concurrent capacity writes require PostgreSQL row locks.",
)
class CapacityConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.office = User.objects.create_user(
            email="capacity.concurrent.office@example.test",
            password="local-test-password",
            full_name="Capacity Concurrency Office",
            role=User.Role.OFFICE_ADMIN,
        )
        lecturer_user = User.objects.create_user(
            email="capacity.concurrent.lecturer@example.test",
            password="local-test-password",
            full_name="Capacity Concurrency Lecturer",
            role=User.Role.LECTURER,
        )
        self.lecturer = Lecturer.objects.create(
            user=lecturer_user,
            staff_no="CAP-CONCURRENT-LECT",
            department="Computing",
        )
        Supervisor.objects.create(lecturer=self.lecturer, max_supervisees=5)
        self.semester = AcademicSemester.objects.create(
            code="2026-2027-S1",
            academic_session="2026/2027",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2026, 9, 1),
            ends_on=date(2027, 1, 31),
            created_by=self.office,
        )
        self.plan = create_capacity_plan(
            semester=self.semester,
            actor=self.office,
        )
        update_capacity_entry(
            self.plan,
            lecturer=self.lecturer,
            actor=self.office,
            supervisor_limit=5,
            panel_limit=None,
            expected_fingerprint=capacity_plan_content_fingerprint(self.plan),
        )

    def test_same_fingerprint_concurrent_entry_updates_allow_one_commit(self):
        expected_fingerprint = capacity_plan_content_fingerprint(self.plan)
        audit_count = LecturerCapacityAudit.objects.filter(
            action=LecturerCapacityAudit.Action.ENTRY_UPDATE
        ).count()
        barrier = Barrier(2)

        def update_from_independent_connection(supervisor_limit):
            close_old_connections()
            try:
                plan = SemesterCapacityPlan.objects.get(pk=self.plan.pk)
                lecturer = Lecturer.objects.get(pk=self.lecturer.pk)
                actor = User.objects.get(pk=self.office.pk)
                barrier.wait(timeout=10)
                update_capacity_entry(
                    plan,
                    lecturer=lecturer,
                    actor=actor,
                    supervisor_limit=supervisor_limit,
                    panel_limit=None,
                    expected_fingerprint=expected_fingerprint,
                )
                return "updated"
            except CapacityPlanConflict:
                return "conflict"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(update_from_independent_connection, limit)
                for limit in (1, 2)
            ]
            outcomes = sorted(future.result(timeout=20) for future in futures)

        self.assertEqual(outcomes, ["conflict", "updated"])
        entry = LecturerCapacityEntry.objects.get(
            plan=self.plan,
            lecturer=self.lecturer,
        )
        self.assertIn(entry.supervisor_limit, {1, 2})
        self.assertEqual(
            LecturerCapacityAudit.objects.filter(
                action=LecturerCapacityAudit.Action.ENTRY_UPDATE
            ).count(),
            audit_count + 1,
        )


@override_settings(TIME_ZONE="Asia/Kuala_Lumpur")
class CapacityResolverTests(TestCase):
    def setUp(self):
        self.today = date(2026, 10, 15)
        self.office = User.objects.create_user(
            email="resolver.office@example.test",
            password="local-test-password",
            full_name="Resolver Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(
            user=self.office,
            staff_no="RES-OFFICE-001",
            department="Postgraduate Office",
        )
        self.lecturer = self.create_lecturer("PRIMARY")
        self.semester = self.create_semester(
            session_start=2026,
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=date(2026, 9, 1),
            ends_on=date(2027, 1, 31),
        )
        self.other_semester = self.create_semester(
            session_start=2025,
            term=AcademicSemester.Term.SEMESTER_II,
            starts_on=date(2026, 2, 1),
            ends_on=date(2026, 6, 30),
        )
        self.record_index = 0

    def create_lecturer(
        self,
        suffix,
        *,
        is_active=True,
        lifecycle_status=Lecturer.Lifecycle.ACTIVE,
        supervisor=True,
        panel=True,
        supervisor_limit=8,
        panel_limit=9,
    ):
        user = User.objects.create_user(
            email=f"resolver.lecturer.{suffix.lower()}@example.test",
            password="local-test-password",
            full_name=f"Resolver Lecturer {suffix}",
            role=User.Role.LECTURER,
            is_active=is_active,
        )
        lecturer = Lecturer.objects.create(
            user=user,
            staff_no=f"RES-LECT-{suffix}",
            department="Computing",
            lifecycle_status=lifecycle_status,
        )
        if supervisor:
            Supervisor.objects.create(
                lecturer=lecturer,
                max_supervisees=supervisor_limit,
            )
        if panel:
            Panel.objects.create(
                lecturer=lecturer,
                max_appointments=panel_limit,
            )
        return lecturer

    def create_semester(self, *, session_start, term, starts_on, ends_on):
        return AcademicSemester.objects.create(
            code=(
                f"{session_start}-{session_start + 1}-"
                f"{AcademicSemester.TERM_CODES[term]}"
            ),
            academic_session=f"{session_start}/{session_start + 1}",
            term=term,
            starts_on=starts_on,
            ends_on=ends_on,
            created_by=self.office,
        )

    def publish_plan(
        self,
        *,
        lecturer=None,
        semester=None,
        supervisor_limit=5,
        panel_limit=5,
        version=1,
    ):
        lecturer = lecturer or self.lecturer
        semester = semester or self.semester
        plan = SemesterCapacityPlan.objects.create(
            academic_semester=semester,
            version=version,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.DRAFT,
            origin=SemesterCapacityPlan.Origin.CREATED,
            created_by=self.office,
        )
        LecturerCapacityEntry.objects.create(
            plan=plan,
            lecturer=lecturer,
            supervisor_limit=supervisor_limit,
            panel_limit=panel_limit,
            updated_by=self.office,
        )
        plan.lifecycle_status = SemesterCapacityPlan.Lifecycle.PUBLISHED
        plan.published_by = self.office
        plan.publication_reason = "Approved resolver test plan."
        plan.published_at = timezone.now()
        plan.save(
            update_fields=(
                "lifecycle_status",
                "published_by",
                "publication_reason",
                "published_at",
            )
        )
        return plan

    def create_student(self):
        self.record_index += 1
        suffix = f"{self.record_index:03d}"
        user = User.objects.create_user(
            email=f"resolver.student.{suffix}@example.test",
            password="local-test-password",
            full_name=f"Resolver Student {suffix}",
            role=User.Role.STUDENT,
        )
        return Student.objects.create(
            user=user,
            matric_no=f"RES-STUDENT-{suffix}",
            programme="Master of Computing",
        )

    def create_active_supervisor_appointment(self, supervisor, *, semester=None):
        student = self.create_student()
        application = SupervisorApplication.objects.create(
            student=student,
            academic_semester=semester or self.semester,
            proposed_supervisor=supervisor,
            research_title=f"Resolver research {student.matric_no}",
            research_abstract="Resolver workload fixture.",
            status=SupervisorApplication.Status.APPROVED,
        )
        return SupervisorAppointment.objects.create(
            application=application,
            student=student,
            supervisor=supervisor,
            approved_by=self.office,
            status=SupervisorAppointment.Status.ACTIVE,
        )

    def create_panel_recommendation(self, panel_member, *, status, semester=None):
        student = self.create_student()
        profile = StudentResearchProfile.objects.create(
            student=student.user,
            matric_no=student.matric_no,
            student_name=student.user.full_name,
            programme=student.programme,
            semester=(semester or self.semester).label,
            proposed_topic=f"Panel research {student.matric_no}",
            supervisor=self.lecturer.user,
        )
        return PanelRecommendation.objects.create(
            profile=profile,
            academic_semester=semester or self.semester,
            supervisor=self.lecturer.user,
            recommended_member=panel_member,
            status=status,
            justification="Resolver workload fixture.",
        )

    def create_active_panel_appointment(self, panel_member, *, semester=None):
        recommendation = self.create_panel_recommendation(
            panel_member,
            status=PanelRecommendation.Status.APPROVED,
            semester=semester,
        )
        return PanelAppointment.objects.create(
            recommendation=recommendation,
            profile=recommendation.profile,
            supervisor=recommendation.supervisor,
            panel_member=panel_member,
            approved_by=self.office,
            status=PanelAppointment.Status.ACTIVE,
        )

    def test_resolver_returns_available_with_published_role_limit(self):
        plan = self.publish_plan(supervisor_limit=2, panel_limit=4)

        result = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )

        self.assertEqual(result.semester_id, self.semester.pk)
        self.assertEqual(result.plan_id, plan.pk)
        self.assertEqual(result.plan_version, 1)
        self.assertEqual(result.role, CapacityRole.SUPERVISOR)
        self.assertEqual(result.limit, 2)
        self.assertEqual(result.active_load, 0)
        self.assertEqual(result.reserved_load, 0)
        self.assertEqual(result.available_slots, 2)
        self.assertEqual(result.state, CapacityState.AVAILABLE)
        self.assertIsNone(result.unavailable_until)

    def test_zero_limit_is_full_then_over_capacity_without_mutating_work(self):
        self.publish_plan(supervisor_limit=0, panel_limit=5)

        full = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )
        appointment = self.create_active_supervisor_appointment(self.lecturer.user)
        over_capacity = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )

        self.assertEqual(full.state, CapacityState.FULL)
        self.assertEqual(full.available_slots, 0)
        self.assertEqual(over_capacity.state, CapacityState.OVER_CAPACITY)
        self.assertEqual(over_capacity.active_load, 1)
        self.assertEqual(over_capacity.available_slots, 0)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, SupervisorAppointment.Status.ACTIVE)

    def test_supervisor_active_load_is_global_across_semesters(self):
        self.publish_plan(supervisor_limit=1, panel_limit=5)
        first = self.create_active_supervisor_appointment(self.lecturer.user)
        second = self.create_active_supervisor_appointment(
            self.lecturer.user,
            semester=self.other_semester,
        )

        result = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )

        self.assertEqual(result.state, CapacityState.OVER_CAPACITY)
        self.assertEqual(result.active_load, 2)
        self.assertEqual(result.reserved_load, 0)
        self.assertEqual(result.available_slots, 0)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, SupervisorAppointment.Status.ACTIVE)
        self.assertEqual(second.status, SupervisorAppointment.Status.ACTIVE)

    def test_panel_load_separates_active_appointments_and_reservations(self):
        self.publish_plan(supervisor_limit=5, panel_limit=4)
        self.create_active_panel_appointment(
            self.lecturer.user,
            semester=self.other_semester,
        )
        self.create_panel_recommendation(
            self.lecturer.user,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        )
        self.create_panel_recommendation(
            self.lecturer.user,
            status=PanelRecommendation.Status.PENDING_COORDINATOR,
            semester=self.other_semester,
        )
        for terminal_status in (
            PanelRecommendation.Status.REJECTED_BY_PANEL,
            PanelRecommendation.Status.REJECTED_BY_COORDINATOR,
            PanelRecommendation.Status.CANCELLED_BY_SUPERVISOR,
            PanelRecommendation.Status.CANCELLED_BY_OFFICE,
        ):
            self.create_panel_recommendation(
                self.lecturer.user,
                status=terminal_status,
            )

        result = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.PANEL,
            on_date=self.today,
        )

        self.assertEqual(result.state, CapacityState.AVAILABLE)
        self.assertEqual(result.active_load, 1)
        self.assertEqual(result.reserved_load, 1)
        self.assertEqual(result.available_slots, 2)
        self.assertEqual(count_panel_workload(self.lecturer.user), 2)

    def test_temporary_unavailability_exposes_latest_applicable_end_date(self):
        self.publish_plan(supervisor_limit=0, panel_limit=5)
        internal_reason = "Private medical leave details must never be public."
        window = LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today - timedelta(days=1),
            ends_on=self.today + timedelta(days=4),
            reason=internal_reason,
            created_by=self.office,
        )
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today,
            ends_on=self.today + timedelta(days=8),
            reason="Cancelled private staffing context.",
            created_by=self.office,
            cancelled_by=self.office,
            cancelled_at=timezone.now(),
            cancellation_reason="Availability restored.",
        )

        supervisor_result = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )
        panel_result = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.PANEL,
            on_date=self.today,
        )
        message = capacity_conflict_message(supervisor_result)

        self.assertEqual(
            supervisor_result.state,
            CapacityState.TEMPORARILY_UNAVAILABLE,
        )
        self.assertEqual(supervisor_result.unavailable_until, window.ends_on)
        self.assertEqual(panel_result.state, CapacityState.AVAILABLE)
        self.assertNotIn("reason", asdict(supervisor_result))
        self.assertNotIn(internal_reason, repr(supervisor_result))
        self.assertNotIn(internal_reason, message)
        self.assertIn(window.ends_on.isoformat(), message)
        with self.assertRaisesMessage(CapacityConflict, message):
            assert_capacity_allows_assignment(
                user=self.lecturer.user,
                semester=self.semester,
                role=CapacityRole.SUPERVISOR,
                on_date=self.today,
            )

    def test_ineligible_state_redacts_active_window_end_date(self):
        self.publish_plan(supervisor_limit=3, panel_limit=5)
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today,
            ends_on=self.today + timedelta(days=3),
            reason="Internal lifecycle transition context.",
            created_by=self.office,
        )
        self.lecturer.lifecycle_status = Lecturer.Lifecycle.RETIRED
        self.lecturer.save(update_fields=["lifecycle_status"])

        result = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )

        self.assertEqual(result.state, CapacityState.INELIGIBLE)
        self.assertIsNone(result.unavailable_until)

    def test_non_effective_windows_do_not_expose_unavailability(self):
        self.publish_plan(supervisor_limit=3, panel_limit=5)
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today,
            ends_on=self.today + timedelta(days=3),
            reason="Cancelled internal availability reason.",
            created_by=self.office,
            cancelled_by=self.office,
            cancelled_at=timezone.now(),
            cancellation_reason="Availability restored.",
        )
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today - timedelta(days=4),
            ends_on=self.today - timedelta(days=1),
            reason="Expired internal availability reason.",
            created_by=self.office,
        )
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today + timedelta(days=1),
            ends_on=self.today + timedelta(days=4),
            reason="Future internal availability reason.",
            created_by=self.office,
        )

        result = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )

        self.assertEqual(result.state, CapacityState.AVAILABLE)
        self.assertIsNone(result.unavailable_until)

    def test_default_date_uses_kuala_lumpur_local_date_at_midnight(self):
        self.publish_plan(supervisor_limit=3, panel_limit=5)
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today,
            ends_on=self.today,
            reason="Internal one-day availability reason.",
            created_by=self.office,
        )

        with patch(
            "academics.capacity.timezone.now",
            return_value=datetime(2026, 10, 14, 15, 59, 59, tzinfo=UTC),
        ):
            before_midnight = resolve_lecturer_capacity(
                user=self.lecturer.user,
                semester=self.semester,
                role=CapacityRole.SUPERVISOR,
            )
        with patch(
            "academics.capacity.timezone.now",
            return_value=datetime(2026, 10, 14, 16, 0, tzinfo=UTC),
        ):
            at_midnight = resolve_lecturer_capacity(
                user=self.lecturer.user,
                semester=self.semester,
                role=CapacityRole.SUPERVISOR,
            )

        self.assertEqual(before_midnight.state, CapacityState.AVAILABLE)
        self.assertIsNone(before_midnight.unavailable_until)
        self.assertEqual(
            at_midnight.state,
            CapacityState.TEMPORARILY_UNAVAILABLE,
        )
        self.assertEqual(at_midnight.unavailable_until, self.today)

    def test_available_supervisor_resolution_uses_bounded_queries(self):
        self.publish_plan(supervisor_limit=3, panel_limit=5)

        with CaptureQueriesContext(connection) as captured_queries:
            result = resolve_lecturer_capacity(
                user=self.lecturer.user,
                semester=self.semester,
                role=CapacityRole.SUPERVISOR,
                on_date=self.today,
            )

        self.assertEqual(result.state, CapacityState.AVAILABLE)
        self.assertLessEqual(len(captured_queries), 7)

    def test_not_configured_ignores_non_published_plans_and_missing_entries(self):
        for version, lifecycle_status in (
            (1, SemesterCapacityPlan.Lifecycle.DRAFT),
            (2, SemesterCapacityPlan.Lifecycle.SUPERSEDED),
        ):
            SemesterCapacityPlan.objects.create(
                academic_semester=self.semester,
                version=version,
                lifecycle_status=lifecycle_status,
                origin=SemesterCapacityPlan.Origin.CREATED,
                created_by=self.office,
            )
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester,
            lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today,
            ends_on=self.today + timedelta(days=2),
            reason="Internal operational reason.",
            created_by=self.office,
        )

        without_published_plan = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )
        published = SemesterCapacityPlan.objects.create(
            academic_semester=self.semester,
            version=3,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
            origin=SemesterCapacityPlan.Origin.CREATED,
            created_by=self.office,
        )
        without_entry = resolve_lecturer_capacity(
            user=self.lecturer.user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )

        self.assertEqual(
            without_published_plan.state,
            CapacityState.NOT_CONFIGURED,
        )
        self.assertIsNone(without_published_plan.plan_id)
        self.assertIsNone(without_published_plan.unavailable_until)
        self.assertEqual(without_entry.state, CapacityState.NOT_CONFIGURED)
        self.assertEqual(without_entry.plan_id, published.pk)
        self.assertEqual(without_entry.plan_version, 3)
        self.assertIsNone(without_entry.limit)
        self.assertEqual(without_entry.available_slots, 0)
        self.assertIsNone(without_entry.unavailable_until)

    def test_not_configured_when_new_role_has_no_published_limit(self):
        lecturer = self.create_lecturer("NEW-PANEL", panel=False)
        self.publish_plan(
            lecturer=lecturer,
            supervisor_limit=3,
            panel_limit=None,
        )
        Panel.objects.create(lecturer=lecturer, max_appointments=7)

        result = resolve_lecturer_capacity(
            user=lecturer.user,
            semester=self.semester,
            role=CapacityRole.PANEL,
            on_date=self.today,
        )

        self.assertEqual(result.state, CapacityState.NOT_CONFIGURED)
        self.assertIsNone(result.limit)

    def test_ineligible_precedes_missing_configuration(self):
        cases = (
            self.create_lecturer("INACTIVE", is_active=False),
            self.create_lecturer(
                "RETIRED",
                lifecycle_status=Lecturer.Lifecycle.RETIRED,
            ),
            self.create_lecturer("NO-SUPERVISOR", supervisor=False),
        )

        for lecturer in cases:
            with self.subTest(lecturer=lecturer.staff_no):
                result = resolve_lecturer_capacity(
                    user=lecturer.user,
                    semester=self.semester,
                    role=CapacityRole.SUPERVISOR,
                    on_date=self.today,
                )
                self.assertEqual(result.state, CapacityState.INELIGIBLE)
                self.assertIsNone(result.plan_id)

    def test_eligibility_uses_persisted_account_state(self):
        self.publish_plan(supervisor_limit=3, panel_limit=4)
        stale_user = User.objects.get(pk=self.lecturer.user_id)
        persisted_user = User.objects.get(pk=self.lecturer.user_id)
        persisted_user.is_active = False
        persisted_user.save(update_fields=["is_active"])
        self.assertTrue(stale_user.is_active)

        result = resolve_lecturer_capacity(
            user=stale_user,
            semester=self.semester,
            role=CapacityRole.SUPERVISOR,
            on_date=self.today,
        )

        self.assertEqual(result.state, CapacityState.INELIGIBLE)

    def test_workload_limit_helpers_delegate_without_changing_legacy_paths(self):
        self.publish_plan(supervisor_limit=3, panel_limit=4)

        self.assertEqual(supervisor_workload_limit(self.lecturer.user), 8)
        self.assertEqual(supervisor_workload_limit(self.lecturer.supervisor), 8)
        self.assertEqual(panel_workload_limit(self.lecturer.user), 9)
        self.assertEqual(panel_workload_limit(self.lecturer.panel), 9)
        self.assertEqual(
            supervisor_workload_limit(self.lecturer.user, self.semester),
            3,
        )
        self.assertEqual(
            supervisor_workload_limit(self.lecturer.supervisor, self.semester),
            3,
        )
        self.assertEqual(
            panel_workload_limit(self.lecturer.user, self.semester),
            4,
        )
        self.assertEqual(
            panel_workload_limit(self.lecturer.panel, self.semester),
            4,
        )

        self.lecturer.user.is_active = False
        self.lecturer.user.save(update_fields=["is_active"])
        self.assertEqual(
            supervisor_workload_limit(self.lecturer.user, self.semester),
            0,
        )
        self.assertEqual(supervisor_workload_limit(self.lecturer.user), 8)
