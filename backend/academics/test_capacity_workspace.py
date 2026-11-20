from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounts.models import Lecturer, Student
from appointments.models import (
    CoSupervisorAppointment,
    CoSupervisorNomination,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
)

from . import test_capacity as fixtures
from .models import LecturerAvailabilityWindow, LecturerCapacityEntry, SemesterCapacityPlan


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CapacityWorkspaceTests(TestCase):
    # Bind fixture methods without importing another discoverable TestCase class.
    setUp = fixtures.CapacityResolverTests.setUp
    create_lecturer = fixtures.CapacityResolverTests.create_lecturer
    create_semester = fixtures.CapacityResolverTests.create_semester
    create_student = fixtures.CapacityResolverTests.create_student
    publish_plan = fixtures.CapacityResolverTests.publish_plan
    create_active_supervisor_appointment = fixtures.CapacityResolverTests.create_active_supervisor_appointment
    create_active_panel_appointment = fixtures.CapacityResolverTests.create_active_panel_appointment
    create_panel_recommendation = fixtures.CapacityResolverTests.create_panel_recommendation

    def get_workspace(self, *, user=None, semester_id=None):
        client = APIClient()
        client.force_authenticate(user or self.office)
        return client.get(
            f"/api/academics/semesters/{semester_id or self.semester.pk}/capacity-workspace/"
        )

    def roster(self):
        response = self.get_workspace()
        self.assertEqual(response.status_code, 200)
        return {row["lecturerId"]: row for row in response.data["lecturers"]}

    def create_supporting_appointment(self, primary, lecturer):
        nomination = CoSupervisorNomination.objects.create(
            student=primary.student,
            primary_appointment=primary,
            nominator=primary.supervisor,
            candidate=lecturer.user,
            academic_semester=self.semester,
            justification="Supporting research expertise.",
            status=CoSupervisorNomination.Status.APPROVED,
        )
        return CoSupervisorAppointment.objects.create(
            nomination=nomination,
            student=primary.student,
            supervisor=lecturer.user,
            approved_by=self.office,
        )

    def test_eligible_lecturers_without_draft_rows_are_included(self):
        plan = SemesterCapacityPlan.objects.create(
            academic_semester=self.semester, version=1, created_by=self.office,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.DRAFT,
            origin=SemesterCapacityPlan.Origin.CREATED,
        )
        LecturerCapacityEntry.objects.create(
            plan=plan, lecturer=self.lecturer, supervisor_limit=2, panel_limit=3,
            updated_by=self.office,
        )
        missing = self.create_lecturer("MISSING", supervisor=False)
        row = self.roster()[missing.pk]
        self.assertEqual(row["lecturerName"], missing.user.full_name)
        self.assertIsNone(row["supervisor"])
        self.assertIsNone(row["panelLimit"])
        self.assertEqual(row["panel"]["state"], "NOT_CONFIGURED")
        self.assertEqual(row["activeStudentCount"], 0)

    def test_supervisor_capacity_combines_primary_and_supporting_active_load(self):
        self.semester.lifecycle_status = self.semester.Lifecycle.ACTIVE
        self.semester.save(update_fields=["lifecycle_status"])
        self.publish_plan(supervisor_limit=2)
        direct = self.create_active_supervisor_appointment(self.lecturer.user)
        primary_lecturer = self.create_lecturer("OTHER")
        primary = self.create_active_supervisor_appointment(primary_lecturer.user)
        self.create_supporting_appointment(primary, self.lecturer)
        with patch("academics.capacity_workspace.timezone.localdate", return_value=self.today), patch(
            "academics.capacity_workspace.project_stages", return_value={
            direct.student_id: SimpleNamespace(stage="P1"),
            primary.student_id: SimpleNamespace(stage="P2"),
        }) as lookup:
            row = self.roster()[self.lecturer.pk]
        lookup.assert_called_once_with(self.semester, {direct.student_id, primary.student_id})
        self.assertEqual(row["primaryStudentCount"], 1)
        self.assertEqual(row["supportingStudentCount"], 1)
        self.assertEqual(row["activeStudentCount"], 2)
        self.assertEqual(row["supervisor"]["activeLoad"], 2)
        self.assertEqual(row["supervisor"]["state"], "FULL")
        self.assertEqual(row["workloadStages"]["supervisor"], {"rp1": 1, "rp2": 1, "withoutStage": 0})

    def test_active_students_are_deduplicated_across_roles(self):
        primary = self.create_active_supervisor_appointment(self.lecturer.user)
        profile = StudentResearchProfile.objects.create(
            student=primary.student.user,
            matric_no=primary.student.matric_no,
            student_name=primary.student.user.full_name,
            programme=primary.student.programme,
            supervisor=self.lecturer.user,
        )
        recommendation = PanelRecommendation.objects.create(
            profile=profile, academic_semester=self.semester,
            supervisor=self.lecturer.user, recommended_member=self.lecturer.user,
            status=PanelRecommendation.Status.APPROVED,
        )
        PanelAppointment.objects.create(
            recommendation=recommendation, profile=profile,
            supervisor=self.lecturer.user, panel_member=self.lecturer.user,
            approved_by=self.office,
        )
        row = self.roster()[self.lecturer.pk]
        self.assertEqual(row["primaryStudentCount"], 1)
        self.assertEqual(row["panelStudentCount"], 1)
        self.assertEqual(row["activeStudentCount"], 1)
        self.assertEqual(sum(row["workloadStages"]["panel"].values()), 1)

    def test_pending_panel_reservations_are_not_active_students(self):
        self.publish_plan(panel_limit=2)
        self.create_panel_recommendation(
            self.lecturer.user, status=PanelRecommendation.Status.PENDING_COORDINATOR
        )
        row = self.roster()[self.lecturer.pk]
        self.assertEqual(row["panel"]["reservedLoad"], 1)
        self.assertEqual(row["panel"]["availableSlots"], 1)
        self.assertEqual(row["panelStudentCount"], 0)
        self.assertEqual(row["activeStudentCount"], 0)

    def test_unlinked_panel_profiles_do_not_invent_distinct_student_counts(self):
        self.publish_plan(panel_limit=4)
        for index in range(2):
            profile = StudentResearchProfile.objects.create(
                matric_no=f"LEGACY-UNLINKED-{index}",
                student_name=f"Unlinked student {index}",
                programme="Legacy programme",
                supervisor=self.lecturer.user,
            )
            recommendation = PanelRecommendation.objects.create(
                profile=profile, academic_semester=self.semester,
                supervisor=self.lecturer.user,
                recommended_member=self.lecturer.user,
                status=PanelRecommendation.Status.APPROVED,
            )
            PanelAppointment.objects.create(
                recommendation=recommendation, profile=profile,
                supervisor=self.lecturer.user, panel_member=self.lecturer.user,
                approved_by=self.office,
            )
        row = self.roster()[self.lecturer.pk]
        self.assertIsNone(row["panelStudentCount"])
        self.assertIsNone(row["activeStudentCount"])
        self.assertTrue(row["workloadIdentityIncomplete"])
        self.assertEqual(row["primaryStudentCount"], 0)
        self.assertEqual(row["supportingStudentCount"], 0)
        self.assertEqual(row["panel"]["activeLoad"], 2)
        self.assertEqual(row["panel"]["availableSlots"], 2)

    def test_baseline_counts_all_programmes_and_only_enabled_active_participants(self):
        self.create_lecturer("PANEL", supervisor=False)
        elsewhere = self.create_lecturer("ELSEWHERE", panel=False)
        Lecturer.objects.filter(pk=elsewhere.pk).update(department="Other Faculty")
        self.create_lecturer("DISABLED", is_active=False)
        self.create_lecturer("RETIRED", lifecycle_status=Lecturer.Lifecycle.RETIRED)
        self.create_lecturer("RETIRING", lifecycle_status=Lecturer.Lifecycle.RETIRING)
        self.create_lecturer("NO-ROLE", supervisor=False, panel=False)
        for programme in ("Master of Computing", "Other Faculty Programme"):
            student = self.create_student()
            Student.objects.filter(pk=student.pk).update(programme=programme)
        for status in (Student.Status.GRADUATED, Student.Status.WITHDRAWN, Student.Status.DEFERRED):
            student = self.create_student()
            Student.objects.filter(pk=student.pk).update(status=status)
        student = self.create_student()
        get_user_model().objects.filter(pk=student.user_id).update(is_active=False)
        response = self.get_workspace()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["baseline"], {
            "activeStudents": 2, "eligibleLecturers": 3, "studentsPerLecturer": 2 / 3,
        })
        self.assertEqual(len(response.data["lecturers"]), 3)

    def test_zero_eligible_lecturers_has_no_invented_baseline(self):
        Lecturer.objects.update(lifecycle_status=Lecturer.Lifecycle.RETIRED)
        self.create_student()
        response = self.get_workspace()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["lecturers"], [])
        self.assertEqual(response.data["baseline"], {
            "activeStudents": 1, "eligibleLecturers": 0, "studentsPerLecturer": None,
        })

    def test_selected_semester_plan_rows_retain_ineligible_participants(self):
        self.publish_plan()
        disabled = self.create_lecturer("DISABLED-HISTORY", is_active=False)
        draft = SemesterCapacityPlan.objects.create(
            academic_semester=self.semester, version=2, created_by=self.office,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.DRAFT,
            origin=SemesterCapacityPlan.Origin.CREATED,
        )
        LecturerCapacityEntry.objects.create(
            plan=draft, lecturer=disabled, supervisor_limit=3, panel_limit=4,
            updated_by=self.office,
        )
        Lecturer.objects.filter(pk=self.lecturer.pk).update(
            lifecycle_status=Lecturer.Lifecycle.RETIRED
        )
        response = self.get_workspace()
        self.assertEqual(response.status_code, 200)
        rows = {row["lecturerId"]: row for row in response.data["lecturers"]}
        self.assertEqual(set(rows), {self.lecturer.pk, disabled.pk})
        retired_row = rows[self.lecturer.pk]
        self.assertTrue(retired_row["userEnabled"])
        self.assertFalse(retired_row["canConfigure"])
        self.assertEqual(retired_row["participantLifecycle"], "RETIRED")
        self.assertEqual(retired_row["supervisor"]["state"], "INELIGIBLE")
        self.assertEqual(retired_row["supervisorLimit"], 5)
        self.assertFalse(rows[disabled.pk]["userEnabled"])
        self.assertFalse(rows[disabled.pk]["canConfigure"])
        self.assertEqual(rows[disabled.pk]["panel"]["state"], "INELIGIBLE")
        self.assertEqual(response.data["baseline"]["eligibleLecturers"], 0)
        self.assertIsNone(response.data["baseline"]["studentsPerLecturer"])

    def test_ongoing_work_without_plan_rows_retains_actual_counts_for_ineligible_staff(self):
        primary = self.create_active_supervisor_appointment(self.lecturer.user)
        supporting = self.create_lecturer("RETIRED-SUPPORT", lifecycle_status=Lecturer.Lifecycle.RETIRED)
        self.create_supporting_appointment(primary, supporting)
        disabled = self.create_lecturer("DISABLED-PANEL", is_active=False)
        self.create_active_panel_appointment(disabled.user)
        Lecturer.objects.filter(pk=self.lecturer.pk).update(
            lifecycle_status=Lecturer.Lifecycle.RETIRING
        )
        eligible = self.create_lecturer("CURRENT")
        response = self.get_workspace()
        self.assertEqual(response.status_code, 200)
        rows = {row["lecturerId"]: row for row in response.data["lecturers"]}
        self.assertEqual(set(rows), {self.lecturer.pk, supporting.pk, disabled.pk, eligible.pk})
        for lecturer, role_count, role in (
            (self.lecturer, "primaryStudentCount", "supervisor"),
            (supporting, "supportingStudentCount", "supervisor"),
            (disabled, "panelStudentCount", "panel"),
        ):
            with self.subTest(lecturer=lecturer.pk):
                self.assertEqual(rows[lecturer.pk][role_count], 1)
                self.assertEqual(rows[lecturer.pk]["activeStudentCount"], 1)
                self.assertEqual(rows[lecturer.pk][role]["activeLoad"], 1)
                self.assertEqual(rows[lecturer.pk][role]["state"], "INELIGIBLE")
                self.assertFalse(rows[lecturer.pk]["canConfigure"])
        self.assertTrue(rows[eligible.pk]["canConfigure"])
        self.assertTrue(rows[eligible.pk]["userEnabled"])
        self.assertEqual(response.data["baseline"], {
            "activeStudents": 2, "eligibleLecturers": 1, "studentsPerLecturer": 2,
        })

    def test_resolutions_use_published_limits_and_real_current_availability(self):
        published = self.publish_plan(supervisor_limit=2, panel_limit=4)
        draft = SemesterCapacityPlan.objects.create(
            academic_semester=self.semester, version=2, created_by=self.office,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.DRAFT,
            origin=SemesterCapacityPlan.Origin.CREATED,
        )
        LecturerCapacityEntry.objects.create(
            plan=draft, lecturer=self.lecturer, supervisor_limit=99, panel_limit=99,
            updated_by=self.office,
        )
        LecturerAvailabilityWindow.objects.create(
            academic_semester=self.semester, lecturer=self.lecturer,
            role=LecturerAvailabilityWindow.Role.SUPERVISOR,
            starts_on=self.today, ends_on=self.today + timedelta(days=2),
            reason="Approved leave.", created_by=self.office,
        )
        with patch("academics.capacity_workspace.timezone.localdate", return_value=self.today):
            row = self.roster()[self.lecturer.pk]
        self.assertEqual(row["supervisorLimit"], 2)
        self.assertEqual(row["panelLimit"], 4)
        self.assertEqual(row["supervisor"]["planId"], published.pk)
        self.assertEqual(row["supervisor"]["state"], "TEMPORARILY_UNAVAILABLE")
        self.assertEqual(row["supervisor"]["unavailableUntil"], "2026-10-17")
        with patch("academics.capacity_workspace.timezone.localdate", return_value=self.today + timedelta(days=3)):
            row = self.roster()[self.lecturer.pk]
        self.assertEqual(row["supervisor"]["state"], "AVAILABLE")

    def test_only_office_role_can_read(self):
        url = f"/api/academics/semesters/{self.semester.pk}/capacity-workspace/"
        self.assertEqual(APIClient().get(url).status_code, 401)
        user_model = get_user_model()
        for index, role in enumerate((
            user_model.Role.STUDENT, user_model.Role.LECTURER,
            user_model.Role.COORDINATOR, user_model.TECHNICAL_ADMIN,
        )):
            user = get_user_model().objects.create_user(
                email=f"workspace.role.{index}@example.test",
                full_name=role, role=role, is_staff=True, is_superuser=True,
            )
            with self.subTest(role=role):
                self.assertEqual(self.get_workspace(user=user).status_code, 403)

    def test_unknown_semester_and_write_methods_fail_closed(self):
        self.assertEqual(self.get_workspace(semester_id=99999).status_code, 404)
        client = APIClient()
        client.force_authenticate(self.office)
        self.assertEqual(client.post(
            f"/api/academics/semesters/{self.semester.pk}/capacity-workspace/", {}
        ).status_code, 405)

    def test_queries_are_read_only_and_bounded_as_roster_grows(self):
        self.semester.lifecycle_status = self.semester.Lifecycle.ACTIVE
        self.semester.save(update_fields=["lifecycle_status"])
        self.publish_plan()
        self.create_active_supervisor_appointment(self.lecturer.user)
        with patch("academics.capacity_workspace.timezone.localdate", return_value=self.today), CaptureQueriesContext(connection) as small:
            self.assertEqual(self.get_workspace().status_code, 200)
        for index in range(20):
            self.create_lecturer(f"BATCH-{index}")
        with patch("academics.capacity_workspace.timezone.localdate", return_value=self.today), CaptureQueriesContext(connection) as large:
            response = self.get_workspace()
            self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["lecturers"]), 21)
        self.assertEqual(len(large), len(small))
        self.assertLessEqual(len(large), 24)
        self.assertTrue(all(query["sql"].lstrip().upper().startswith("SELECT") for query in large))
