"""Student Registry API coverage: role gating, read shape, and updates."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from appointments.models import SupervisorApplication, SupervisorAppointment

from .models import Lecturer, ParticipantLifecycleAudit, Student, StudentRegistry, Supervisor

User = get_user_model()


class StudentRegistryApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            email="registry-admin@example.test",
            password="pw-admin-7781",
            full_name="Registry Admin",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        cls.lecturer = User.objects.create_user(
            email="registry-lect@example.test",
            password="pw-lect-7782",
            full_name="Some Lecturer",
            role=User.Role.LECTURER,
        )
        cls.student_user = User.objects.create_user(
            email="wga210045@example.test",
            password="pw-stud-7783",
            full_name="Aisyah binti Rahman",
            role=User.Role.STUDENT,
            phone="012-1112222",
        )
        cls.student = Student.objects.create(
            user=cls.student_user,
            matric_no="DEMO-WGA210045",
            programme="MASTER OF DATA SCIENCE (COURSEWORK)",
            status=Student.Status.ACTIVE,
            intake_semester="Semester 1, 2025/2026",
        )

    # Role gating

    def test_anonymous_is_denied(self):
        response = self.client.get("/api/registry/students/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lecturer_without_supervisees_sees_no_students(self):
        self.client.force_authenticate(self.lecturer)
        response = self.client.get("/api/registry/students/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])
        detail = self.client.get(f"/api/registry/students/{self.student.matric_no}/")
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_student_cannot_read_the_registry(self):
        self.client.force_authenticate(self.student_user)
        response = self.client.get("/api/registry/students/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_patch_own_record(self):
        self.client.force_authenticate(self.student_user)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {"academicStatus": Student.Status.ACTIVE},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # Read shape

    def test_admin_lists_records_in_frontend_shape(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/registry/students/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        record = next(r for r in response.data if r["id"] == self.student.matric_no)
        for key in (
            "id", "name", "avatarText", "avatarBg", "programme", "academicStatus",
            "accountStatus", "semester", "email", "phone", "supervisor", "intakeDate",
        ):
            self.assertIn(key, record)
        self.assertEqual(record["name"], "Aisyah binti Rahman")
        self.assertEqual(record["avatarText"], "AB")
        self.assertEqual(record["accountStatus"], "Verified")

    def test_the_list_comes_in_name_order(self):
        for index, name in enumerate(("zainal Abidin", "Bala a/l Muthu", "Chong Wei Ling")):
            user = User.objects.create_user(
                email=f"order{index}@example.test", password="pw-order-7784", full_name=name, role=User.Role.STUDENT
            )
            Student.objects.create(user=user, matric_no=f"ORDER-{index}", programme=self.student.programme)
        self.client.force_authenticate(self.admin)
        names = [record["name"] for record in self.client.get("/api/registry/students/").data]
        self.assertEqual(names, ["Aisyah binti Rahman", "Bala a/l Muthu", "Chong Wei Ling", "zainal Abidin"])

    def test_search_filters_by_matric_and_name(self):
        self.client.force_authenticate(self.admin)
        hit = self.client.get("/api/registry/students/?search=WGA210045")
        self.assertEqual(len(hit.data), 1)
        miss = self.client.get("/api/registry/students/?search=zzzznotpresent")
        self.assertEqual(len(miss.data), 0)

    def test_detail_returns_404_for_unknown_matric(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/registry/students/NOT-A-STUDENT/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_supervisor_is_blank_not_guessed(self):
        """The supervisor relationship belongs to the appointments module."""
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/registry/students/{self.student.matric_no}/")
        self.assertEqual(response.data["supervisor"], "")

    # Updates

    def test_admin_updates_programme_and_status(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {
                "programme": "MASTER OF CYBER SECURITY (COURSEWORK)",
                "academicStatus": Student.Status.DEFERRED,
                "statusReason": "Deferment approved for medical leave.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.programme, "MASTER OF CYBER SECURITY (COURSEWORK)")
        self.assertEqual(self.student.status, Student.Status.DEFERRED)

    def test_status_change_requires_a_reason(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {
                "programme": "MASTER OF CYBER SECURITY (COURSEWORK)",
                "academicStatus": Student.Status.DEFERRED,
                "statusReason": "   ",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("statusReason", response.data)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.ACTIVE)
        self.assertEqual(self.student.programme, "MASTER OF DATA SCIENCE (COURSEWORK)")

    def test_status_change_is_recorded_by_the_participant_lifecycle(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {
                "academicStatus": Student.Status.DEFERRED,
                "statusReason": "Deferment approved for medical leave.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["academicStatus"], Student.Status.DEFERRED)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status_changed_by, self.admin)
        self.assertEqual(self.student.status_reason, "Deferment approved for medical leave.")
        audit = ParticipantLifecycleAudit.objects.get(student=self.student)
        self.assertEqual(audit.previous_status, "ACTIVE")
        self.assertEqual(audit.new_status, "DEFERRED")
        self.assertEqual(audit.actor, self.admin)

    def test_unchanged_status_needs_no_reason(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {"academicStatus": Student.Status.ACTIVE, "phone": "012-9990000"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(ParticipantLifecycleAudit.objects.filter(student=self.student).exists())

    def test_terminal_status_cannot_be_reversed_and_nothing_else_changes(self):
        self.student.status = Student.Status.GRADUATED
        self.student.save(update_fields=["status"])
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {
                "programme": "MASTER OF CYBER SECURITY (COURSEWORK)",
                "academicStatus": Student.Status.ACTIVE,
                "statusReason": "Reopening the record.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("blockers", response.data)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.GRADUATED)
        self.assertEqual(self.student.programme, "MASTER OF DATA SCIENCE (COURSEWORK)")

    def test_non_admin_office_retains_lifecycle_rights_through_registry(self):
        office_without_staff_flag = User.objects.create_user(
            email="registry-office-plain@example.test",
            password="pw-office-7790",
            full_name="Plain Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.client.force_authenticate(office_without_staff_flag)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {
                "academicStatus": Student.Status.DEFERRED,
                "statusReason": "Deferment approved for medical leave.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.DEFERRED)
        self.assertEqual(self.student.status_changed_by, office_without_staff_flag)
        self.assertEqual(self.student.status_reason, 'Deferment approved for medical leave.')

    def test_account_status_toggles_user_active_flag(self):
        self.client.force_authenticate(self.admin)
        self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {"accountStatus": "Suspended"},
        )
        self.student_user.refresh_from_db()
        self.assertFalse(self.student_user.is_active)

    def test_semester_creates_registry_row_on_demand(self):
        self.assertFalse(StudentRegistry.objects.filter(student=self.student).exists())
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {"semester": "Semester 2, 2025/2026"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["semester"], "2025/2026 Semester II")
        self.assertTrue(StudentRegistry.objects.filter(student=self.student).exists())

    def test_invalid_academic_status_is_rejected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {"academicStatus": "Graduated Yesterday"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.ACTIVE)

    def test_matric_number_is_not_writable(self):
        """A non-editable field is refused, not silently dropped, and nothing in
        the request is written."""
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {
                "id": "DEMO-CHANGED",
                "matric_no": "DEMO-CHANGED",
                "programme": "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(response.data), {"id", "matric_no"})
        self.student.refresh_from_db()
        self.assertEqual(self.student.matric_no, "DEMO-WGA210045")
        self.assertEqual(self.student.programme, "MASTER OF DATA SCIENCE (COURSEWORK)")

    def test_case_variant_matric_numbers_cannot_exist(self):
        """Matrics differing only by case are refused by the database, so the
        case-insensitive lookup can never edit the wrong student."""
        twin_user = User.objects.create_user(
            email="twin@example.test",
            password="pw-twin-3391",
            full_name="Case Twin",
            role=User.Role.STUDENT,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            Student.objects.create(
                user=twin_user,
                matric_no=self.student.matric_no.lower(),
                programme="MASTER OF DATA SCIENCE (COURSEWORK)",
                status=Student.Status.ACTIVE,
            )

    def test_admin_cannot_suspend_their_own_account(self):
        admin_student = Student.objects.create(
            user=self.admin,
            matric_no="DEMO-ADMIN-STUDENT",
            programme="MASTER OF DATA SCIENCE (COURSEWORK)",
            status=Student.Status.ACTIVE,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/registry/students/{admin_student.matric_no}/",
            {"accountStatus": "Suspended"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_cannot_suspend_a_superuser(self):
        root = User.objects.create_user(
            email="root@example.test",
            password="pw-root-8812",
            full_name="Root Account",
            role=User.Role.STUDENT,
        )
        root.is_superuser = True
        root.save(update_fields=["is_superuser"])
        Student.objects.create(
            user=root,
            matric_no="DEMO-ROOT",
            programme="MASTER OF DATA SCIENCE (COURSEWORK)",
            status=Student.Status.ACTIVE,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            "/api/registry/students/DEMO-ROOT/", {"accountStatus": "Suspended"}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        root.refresh_from_db()
        self.assertTrue(root.is_active)

    # Registration

    NEW_STUDENT = {
        "id": "DEMO-WGA260001",
        "name": "Nurul Huda binti Kamal",
        "email": "wga260001@example.test",
        "programme": "MASTER OF DATA SCIENCE (COURSEWORK)",
        "phone": "011-2223333",
        "semester": "Semester 1, 2026/2027",
    }

    def test_admin_registers_a_student(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post("/api/registry/students/", self.NEW_STUDENT)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["id"], "DEMO-WGA260001")
        self.assertEqual(response.data["accountStatus"], "Verified")
        self.assertEqual(response.data["semester"], "2026/2027 Semester I")

        created = Student.objects.get(matric_no="DEMO-WGA260001")
        self.assertEqual(created.user.role, User.Role.STUDENT)
        self.assertEqual(created.user.phone, "011-2223333")

    def test_registered_account_has_no_usable_password(self):
        """The office never handles a temporary credential."""
        self.client.force_authenticate(self.admin)
        self.client.post("/api/registry/students/", self.NEW_STUDENT)
        created = Student.objects.get(matric_no="DEMO-WGA260001")
        self.assertFalse(created.user.has_usable_password())

        # No password can authenticate an unusable-password account.
        for attempt in ("", "password", "DEMO-WGA260001", "changeme123"):
            login = self.client.post(
                "/api/auth/login/",
                {"identifier": self.NEW_STUDENT["email"], "password": attempt},
                format="json",
            )
            self.assertIn(
                login.status_code,
                (status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED),
                msg=f"password {attempt!r} unexpectedly authenticated",
            )

    def test_duplicate_matric_is_rejected_case_insensitively(self):
        self.client.force_authenticate(self.admin)
        payload = {**self.NEW_STUDENT, "id": self.student.matric_no.lower()}
        response = self.client.post("/api/registry/students/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_email_is_rejected(self):
        self.client.force_authenticate(self.admin)
        payload = {**self.NEW_STUDENT, "email": self.student_user.email.upper()}
        response = self.client.post("/api/registry/students/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Student.objects.filter(matric_no="DEMO-WGA260001").exists())

    def test_failed_registration_leaves_no_orphan_user(self):
        """User + Student are created in one transaction."""
        before = User.objects.count()
        self.client.force_authenticate(self.admin)
        self.client.post(
            "/api/registry/students/", {**self.NEW_STUDENT, "id": ""}
        )
        self.assertEqual(User.objects.count(), before)

    def test_non_admin_cannot_register(self):
        self.client.force_authenticate(self.lecturer)
        response = self.client.post("/api/registry/students/", self.NEW_STUDENT)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Student.objects.filter(matric_no="DEMO-WGA260001").exists())

    def test_anonymous_cannot_register(self):
        response = self.client.post("/api/registry/students/", self.NEW_STUDENT)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_registration_rejects_invalid_academic_status(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/registry/students/",
            {**self.NEW_STUDENT, "academicStatus": "Enrolled Forever"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_must_start_active(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/registry/students/",
            {**self.NEW_STUDENT, "academicStatus": Student.Status.WITHDRAWN},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("academicStatus", response.data)
        self.assertFalse(Student.objects.filter(matric_no=self.NEW_STUDENT["id"]).exists())

    def test_registered_student_can_start_a_password_reset(self):
        """Registration relies on the reset flow to set the first password."""
        self.client.force_authenticate(self.admin)
        self.client.post("/api/registry/students/", self.NEW_STUDENT)
        self.client.force_authenticate(None)
        response = self.client.post(
            "/api/auth/password-reset/", {"email": self.NEW_STUDENT["email"]}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_is_staff_flag_alone_does_not_grant_registry_access(self):
        self.lecturer.is_staff = True
        self.lecturer.save(update_fields=["is_staff"])
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.client.get("/api/registry/students/").data, [])
        response = self.client.post("/api/registry/students/", self.NEW_STUDENT)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class RegistryStatusWorkflowTests(APITestCase):
    """Registry status changes must carry the lifecycle's workflow effects."""

    def setUp(self):
        self.office = User.objects.create_user(
            email="registry-workflow-office@example.test",
            password="pw-office-8801",
            full_name="Workflow Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        student_user = User.objects.create_user(
            email="registry-workflow-student@example.test",
            password="pw-student-8802",
            full_name="Workflow Student",
            role=User.Role.STUDENT,
        )
        self.student = Student.objects.create(
            user=student_user,
            matric_no="DEMO-WGA230077",
            programme="MASTER OF DATA SCIENCE (COURSEWORK)",
        )
        supervisor_user = User.objects.create_user(
            email="registry-workflow-lecturer@example.test",
            password="pw-lect-8803",
            full_name="Workflow Supervisor",
            role=User.Role.LECTURER,
        )
        lecturer = Lecturer.objects.create(
            user=supervisor_user, staff_no="REG-LECT-001", department="Computer Science"
        )
        Supervisor.objects.create(lecturer=lecturer, max_supervisees=5)
        today = timezone.localdate()
        semester = AcademicSemester.objects.create(
            code="REG-WORKFLOW",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SPECIAL,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=60),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        application = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=semester,
            proposed_supervisor=supervisor_user,
            research_title="Registry lifecycle integrity",
            research_area="Information Systems",
            research_abstract="Registry changes that respect workflow state.",
            status=SupervisorApplication.Status.APPROVED,
        )
        self.appointment = SupervisorAppointment.objects.create(
            application=application,
            student=self.student,
            supervisor=supervisor_user,
            approved_by=self.office,
        )

    def test_withdrawal_from_registry_ends_the_active_supervisor_appointment(self):
        self.client.force_authenticate(self.office)
        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/",
            {
                "academicStatus": Student.Status.WITHDRAWN,
                "statusReason": "Student withdrew from the programme.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.WITHDRAWN)
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.status, SupervisorAppointment.Status.ENDED)
        self.assertEqual(
            self.appointment.end_outcome, SupervisorAppointment.EndOutcome.WITHDRAWN
        )


@override_settings(REGISTRY_ACCESS_LINK_THROTTLE_RATE="2/hour")
class RegistryAccessLinkTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user(
            email="access-office@example.test",
            password="pw-office-9901",
            full_name="Access Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.lecturer = User.objects.create_user(
            email="access-lecturer@example.test",
            password="pw-lect-9902",
            full_name="Access Lecturer",
            role=User.Role.LECTURER,
        )
        new_user = User(
            email="access-new@example.test",
            full_name="Never Activated",
            role=User.Role.STUDENT,
        )
        new_user.set_unusable_password()
        new_user.save()
        self.new_student = Student.objects.create(user=new_user, matric_no="DEMO-WGA240001")
        active_user = User.objects.create_user(
            email="access-active@example.test",
            password="pw-student-9903",
            full_name="Already Active",
            role=User.Role.STUDENT,
        )
        self.active_student = Student.objects.create(
            user=active_user, matric_no="DEMO-WGA240002"
        )

    def _send(self, matric_no, user=None):
        self.client.force_authenticate(user or self.office)
        return self.client.post(f"/api/registry/students/{matric_no}/send-access-link/")

    def test_unactivated_student_gets_the_activation_link(self):
        response = self._send(self.new_student.matric_no)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"kind": "activation", "sent": True})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Activate", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["access-new@example.test"])

    def test_activated_student_gets_a_password_reset_link(self):
        response = self._send(self.active_student.matric_no)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"kind": "reset", "sent": True})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "Reset your FSKTM Postgraduate Office password")

    def test_suspended_account_is_refused(self):
        self.active_student.user.is_active = False
        self.active_student.user.save(update_fields=["is_active"])
        response = self._send(self.active_student.matric_no)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(len(mail.outbox), 0)

    def test_only_the_office_can_send(self):
        response = self._send(self.new_student.matric_no, user=self.lecturer)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(mail.outbox), 0)

    def test_unknown_student_is_not_found(self):
        self.assertEqual(self._send("DEMO-NOBODY").status_code, status.HTTP_404_NOT_FOUND)

    def test_links_are_throttled_per_student(self):
        for _ in range(2):
            self.assertEqual(self._send(self.new_student.matric_no).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._send(self.new_student.matric_no).status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )
        self.assertEqual(self._send(self.active_student.matric_no).status_code, status.HTTP_200_OK)

    def test_refused_requests_do_not_spend_the_office_budget(self):
        for _ in range(3):
            self._send(self.new_student.matric_no, user=self.lecturer)
        self.assertEqual(self._send(self.new_student.matric_no).status_code, status.HTTP_200_OK)
