"""Registry read scope (UC05): who sees which students, and supervisor details."""

from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from appointments.models import (
    CoSupervisorAppointment,
    CoSupervisorNomination,
    SupervisorApplication,
    SupervisorAppointment,
)

from .models import Coordinator, Lecturer, Student, User
from .programmes import APPROVED_PROGRAMMES

DS, CS, AI = APPROVED_PROGRAMMES


class RegistryScopeTests(APITestCase):
    def setUp(self):
        self.office = self._user("scope-office@example.test", "Scope Office", User.Role.OFFICE_ADMIN)
        self.supervisor = self._lecturer("scope-sup@example.test", "SCOPE-L1", "Dr Supervisor")
        self.co_supervisor = self._lecturer("scope-co@example.test", "SCOPE-L2", "Dr Supporting")
        self.coordinator = self._lecturer(
            "scope-coord@example.test", "SCOPE-C1", "Dr Coordinator", User.Role.COORDINATOR
        )
        Coordinator.objects.create(lecturer=self.coordinator.lecturer, programme_managed=CS)
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(
            code="SCOPE-SEMESTER",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SPECIAL,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=60),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )

        self.supervised = self._student("SCOPE-S1", DS)
        self.co_supervised = self._student("SCOPE-S2", AI)
        self.in_programme = self._student("SCOPE-S3", CS)
        self.unrelated = self._student("SCOPE-S4", DS)
        self.formerly_supervised = self._student("SCOPE-S5", DS)

        self._appoint(self.supervised, self.supervisor)
        primary = self._appoint(self.co_supervised, self.supervisor)
        ended = self._appoint(self.formerly_supervised, self.supervisor)
        ended.status = SupervisorAppointment.Status.ENDED
        ended.end_outcome = SupervisorAppointment.EndOutcome.OTHER
        ended.ended_at = timezone.now()
        ended.save()
        nomination = CoSupervisorNomination.objects.create(
            student=self.co_supervised,
            primary_appointment=primary,
            nominator=self.supervisor,
            candidate=self.co_supervisor,
            academic_semester=self.semester,
            justification="Methodology support",
        )
        CoSupervisorAppointment.objects.create(
            nomination=nomination,
            student=self.co_supervised,
            supervisor=self.co_supervisor,
            approved_by=self.coordinator,
        )

    def _user(self, email, name, role):
        return User.objects.create_user(
            email=email, password="pw-scope-6601", full_name=name, role=role
        )

    def _lecturer(self, email, staff_no, name, role=User.Role.LECTURER):
        user = self._user(email, name, role)
        Lecturer.objects.create(user=user, staff_no=staff_no, department="Computer Science")
        return user

    def _student(self, matric_no, programme):
        user = self._user(f"{matric_no.lower()}@example.test", f"Student {matric_no}", User.Role.STUDENT)
        return Student.objects.create(user=user, matric_no=matric_no, programme=programme)

    def _appoint(self, student, supervisor):
        application = SupervisorApplication.objects.create(
            student=student,
            academic_semester=self.semester,
            proposed_supervisor=supervisor,
            research_title=f"Research for {student.matric_no}",
            research_area="Information Systems",
            research_abstract="Registry scope fixture.",
            status=SupervisorApplication.Status.APPROVED,
        )
        return SupervisorAppointment.objects.create(
            application=application,
            student=student,
            supervisor=supervisor,
            approved_by=self.coordinator,
        )

    def _ids(self, user, query=""):
        self.client.force_authenticate(user)
        response = self.client.get(f"/api/registry/students/{query}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {record["id"] for record in response.data}

    def test_office_sees_every_student_with_current_supervisor_details(self):
        self.client.force_authenticate(self.office)
        records = {r["id"]: r for r in self.client.get("/api/registry/students/").data}
        self.assertEqual(records["SCOPE-S1"]["supervisor"], "Dr Supervisor")
        self.assertEqual(records["SCOPE-S1"]["supervisorStaffNo"], "SCOPE-L1")
        self.assertEqual(records["SCOPE-S3"]["supervisor"], "")
        self.assertEqual(records["SCOPE-S3"]["supervisorStaffNo"], "")
        self.assertEqual(records["SCOPE-S5"]["supervisor"], "", "ended appointments are not current")

    def test_supervisor_filter_matches_staff_number_or_name(self):
        self.assertEqual(self._ids(self.office, "?supervisor=scope-l1"), {"SCOPE-S1", "SCOPE-S2"})
        self.assertEqual(self._ids(self.office, "?supervisor=supervisor"), {"SCOPE-S1", "SCOPE-S2"})
        self.assertEqual(self._ids(self.office, "?supervisor=SCOPE-L2"), set())
        self.assertEqual(self._ids(self.office, "?supervisor=nobody"), set())

    def test_lecturers_read_only_their_current_supervisees(self):
        self.assertEqual(self._ids(self.supervisor), {"SCOPE-S1", "SCOPE-S2"})
        self.assertEqual(self._ids(self.co_supervisor), {"SCOPE-S2"})
        self.client.force_authenticate(self.supervisor)
        self.assertEqual(
            self.client.get("/api/registry/students/SCOPE-S1/").status_code, status.HTTP_200_OK
        )
        for outside in ("SCOPE-S4", "SCOPE-S5"):
            self.assertEqual(
                self.client.get(f"/api/registry/students/{outside}/").status_code,
                status.HTTP_404_NOT_FOUND,
            )

    def test_a_lecturer_reads_every_student_of_their_programme(self):
        Lecturer.objects.filter(user=self.co_supervisor).update(programme=f" {DS.lower()} ")
        self.assertEqual(self._ids(self.co_supervisor), {"SCOPE-S1", "SCOPE-S2", "SCOPE-S4", "SCOPE-S5"})
        self.assertEqual(self._ids(self.co_supervisor, "?search=SCOPE-S4"), {"SCOPE-S4"})
        self.client.force_authenticate(self.co_supervisor)
        self.assertEqual(self.client.get("/api/registry/students/SCOPE-S4/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/registry/students/SCOPE-S3/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.patch("/api/registry/students/SCOPE-S4/", {"phone": "012-1"}).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_coordinators_read_their_managed_programme(self):
        self.assertEqual(self._ids(self.coordinator), {"SCOPE-S3"})
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(
            self.client.get("/api/registry/students/SCOPE-S1/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_readers_cannot_write(self):
        for reader in (self.supervisor, self.coordinator):
            self.client.force_authenticate(reader)
            attempts = [
                self.client.patch("/api/registry/students/SCOPE-S1/", {"phone": "012-1"}),
                self.client.post("/api/registry/students/", {"id": "X1", "name": "X", "email": "x@example.test"}),
                self.client.post("/api/registry/students/import/", {}),
                self.client.post("/api/registry/students/SCOPE-S1/send-access-link/"),
                self.client.get("/api/registry/imports/"),
            ]
            for response in attempts:
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.supervised.refresh_from_db()
        self.assertEqual(self.supervised.user.phone, "")

    def test_students_have_no_registry_access(self):
        self.client.force_authenticate(self.supervised.user)
        self.assertEqual(
            self.client.get("/api/registry/students/").status_code, status.HTTP_403_FORBIDDEN
        )

    def test_list_queries_do_not_grow_with_the_number_of_students(self):
        self.client.force_authenticate(self.office)
        with CaptureQueriesContext(connection) as before:
            self.client.get("/api/registry/students/")
        for index in range(4):
            self._appoint(self._student(f"SCOPE-X{index}", DS), self.supervisor)
        with CaptureQueriesContext(connection) as after:
            response = self.client.get("/api/registry/students/")
        self.assertEqual(len(response.data), 9)
        self.assertEqual(len(after.captured_queries), len(before.captured_queries))

    def test_letter_details_name_the_current_primary_supervisor(self):
        self.client.force_authenticate(self.supervised.user)
        response = self.client.get("/api/auth/me/letter-details/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["supervisorName"], "Dr Supervisor")
        for student in (self.unrelated, self.formerly_supervised):
            self.client.force_authenticate(student.user)
            self.assertEqual(
                self.client.get("/api/auth/me/letter-details/").data["supervisorName"], ""
            )
