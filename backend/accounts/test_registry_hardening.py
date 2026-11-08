"""Registry hardening from the October 2026 review: coordinator scope matches the
other modules, programme changes respect research profiles, suspension ends
sessions, strict validation, and an import parser that cannot be tripped up."""

import io
import time
import zipfile
from datetime import timedelta
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from appointments.models import StudentResearchProfile

from .delegations import grant_delegation, today
from .models import Coordinator, Lecturer, OfficeStaff, RegistryImportBatch, Student, User

PASSWORD = "Registry-pass-7731!"
DS = "MASTER OF DATA SCIENCE (COURSEWORK)"
CS = "MASTER OF CYBER SECURITY (COURSEWORK)"
AI = "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)"
HEADER = "student_id,full_name,programme,email,phone\n"


def make_student(matric, programme, email=None):
    user = User.objects.create_user(
        email=email or f"{matric.lower()}@example.test",
        password=PASSWORD,
        full_name=f"Student {matric}",
        role=User.Role.STUDENT,
    )
    return Student.objects.create(user=user, matric_no=matric, programme=programme)


class RegistryHardeningBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user(
            email="office.hard@example.test",
            password=PASSWORD,
            full_name="Office Hardening",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(user=self.office, staff_no="OFF-HARD-1")
        self.client.force_authenticate(self.office)

    def make_coordinator(self, email, programme):
        user = User.objects.create_user(
            email=email, password=PASSWORD, full_name="Coordinator", role=User.Role.COORDINATOR
        )
        lecturer = Lecturer.objects.create(user=user, staff_no=f"CO-{email[:6].upper()}")
        Coordinator.objects.create(lecturer=lecturer, programme_managed=programme)
        return user


class CoordinatorScopeTests(RegistryHardeningBase):
    def setUp(self):
        super().setUp()
        self.ds_student = make_student("WGT270001", DS)
        self.ai_student = make_student("WGT270002", AI)

    def _visible(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return {row["id"] for row in client.get("/api/registry/students/").data}

    def test_a_retiring_coordinator_loses_programme_scope(self):
        coordinator = self.make_coordinator("coord.retire@example.test", DS)
        self.assertEqual(self._visible(coordinator), {"WGT270001"})
        Lecturer.objects.filter(user=coordinator).update(lifecycle_status=Lecturer.Lifecycle.RETIRING)
        self.assertEqual(self._visible(coordinator), set())
        client = APIClient()
        client.force_authenticate(coordinator)
        self.assertEqual(client.get("/api/registry/students/WGT270001/").status_code, status.HTTP_404_NOT_FOUND)

    def test_an_acting_coordinator_reads_the_delegated_programme(self):
        coordinator = self.make_coordinator("coord.acting@example.test", DS)
        grant_delegation(
            actor=self.office,
            coordinator_id=coordinator.pk,
            programme=AI,
            starts_on=today(),
            ends_on=today() + timedelta(days=7),
            justification="Covering leave",
        )
        self.assertEqual(self._visible(coordinator), {"WGT270001", "WGT270002"})


class RecordEditingTests(RegistryHardeningBase):
    def setUp(self):
        super().setUp()
        self.student = make_student("WGT270010", DS)

    def test_programme_correction_needs_a_reason_when_a_research_profile_exists(self):
        supervisor = User.objects.create_user(
            email="sv.hard@example.test", password=PASSWORD, full_name="Supervisor", role=User.Role.LECTURER
        )
        StudentResearchProfile.objects.create(
            student=self.student.user,
            matric_no=self.student.matric_no,
            student_name=self.student.user.full_name,
            programme=DS,
            semester="Sem 1 2026/2027",
            proposed_topic="Topic",
            supervisor=supervisor,
        )
        response = self.client.patch(
            "/api/registry/students/WGT270010/", {"programme": CS, "phone": "012-1110000"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("programmeReason", response.data)
        self.student.refresh_from_db()
        self.student.user.refresh_from_db()
        self.assertEqual(self.student.programme, DS)
        self.assertEqual(self.student.user.phone, "")

    def test_programme_change_is_allowed_without_a_research_profile(self):
        response = self.client.patch("/api/registry/students/WGT270010/", {"programme": CS}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["programme"], CS)

    def test_suspension_ends_existing_sessions_for_good(self):
        student_client = APIClient()
        login = student_client.post(
            "/api/auth/login/",
            {"identifier": self.student.user.email, "password": PASSWORD},
            format="json",
            REMOTE_ADDR="192.0.2.150",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        for account_status in ("Suspended", "Verified"):
            self.assertEqual(
                self.client.patch(
                    "/api/registry/students/WGT270010/", {"accountStatus": account_status}, format="json"
                ).status_code,
                status.HTTP_200_OK,
            )
        refreshed = student_client.post("/api/auth/refresh/", {}, format="json")
        self.assertEqual(refreshed.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_programme_filter_is_applied(self):
        make_student("WGT270011", CS)
        response = self.client.get("/api/registry/students/", {"programme": CS.lower()})
        self.assertEqual([row["id"] for row in response.data], ["WGT270011"])

    def test_phone_must_look_like_a_phone_number(self):
        response = self.client.patch(
            "/api/registry/students/WGT270010/", {"phone": '=HYPERLINK("//x.y","!")'}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)


class SingleRegistrationValidationTests(RegistryHardeningBase):
    def _register(self, **overrides):
        body = {
            "id": "WGT270020",
            "name": "New Registration",
            "email": "new.registration@example.test",
            "programme": DS,
            "sendInvite": False,
        }
        body.update(overrides)
        return self.client.post("/api/registry/students/", body, format="json")

    def test_matric_numbers_must_be_usable_in_links(self):
        Lecturer.objects.create(
            user=User.objects.create_user(email="lect.clash@example.test", password=PASSWORD, role=User.Role.LECTURER),
            staff_no="L270099",
        )
        for matric in ("SMK/REG/1", "import", "WGT 270020", "l270099"):
            with self.subTest(matric=matric):
                response = self._register(id=matric)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("id", response.data)
        self.assertEqual(self._register(id="WGT-2026.01").status_code, status.HTTP_201_CREATED)

    def test_overlong_email_is_a_validation_error_not_a_crash(self):
        response = self._register(email=f"{'a' * 250}@example.test")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_phone_is_validated_on_registration(self):
        response = self._register(phone='012","Suspended')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)


class ImportParserTests(RegistryHardeningBase):
    def _import(self, content, name="students.csv", dry_run=True):
        upload = SimpleUploadedFile(name, content, content_type="text/csv")
        return self.client.post(
            "/api/registry/students/import/",
            {"file": upload, "dryRun": "true" if dry_run else "false"},
            format="multipart",
        )

    def test_old_mac_line_endings_are_read(self):
        body = (HEADER + f"WGT270030,Mac Row,{DS},mac.row@example.test,012-1\n").replace("\n", "\r").encode()
        response = self._import(body)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["status"] for row in response.data["rows"]], ["Ready"])

    def test_a_malformed_csv_is_a_clear_error_not_a_crash(self):
        body = (HEADER + f'WGT270031,"{"x" * 140000}"\n').encode()
        response = self._import(body)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("could not be read", response.data["error"])

    def test_a_windows_1252_file_keeps_accented_names(self):
        body = (HEADER + f"WGT270032,José Ramos,{DS},jose.ramos@example.test,\n").encode("cp1252")
        response = self._import(body)
        self.assertEqual(response.data["rows"][0]["name"], "José Ramos")

    def test_a_utf8_file_with_a_stray_byte_is_refused_instead_of_garbled(self):
        body = (HEADER + f"WGT270033,José Ramos,{DS},jose.r@example.test,\n").encode() + b"WGT270034,Bad \xff Byte,x,y,\n"
        response = self._import(body)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Line 3", response.data["error"])

    def test_the_preview_applies_the_registration_limits(self):
        OfficeStaff.objects.create(
            user=User.objects.create_user(email="staff.clash@example.test", password=PASSWORD, role=User.Role.OFFICE_ADMIN),
            staff_no="WGT270049",
        )
        rows = [
            f"WGT270040,Long Phone,{DS},long.phone@example.test,{'1' * 40}",
            f"WGT270041,{'N' * 300},{DS},long.name@example.test,",
            f"WGT270042,Long Email,{DS},{'e' * 250}@example.test,",
            f"WGT/270043,Slash Matric,{DS},slash@example.test,",
            f"WGT270044,Formula Phone,{DS},formula@example.test,=1+1",
            f"WGT270049,Staff Clash,{DS},clash@example.test,",
            f"WGT270045,Fine Row,{DS},fine@example.test,012-3456789",
        ]
        response = self._import((HEADER + "\n".join(rows) + "\n").encode())
        statuses = [row["status"] for row in response.data["rows"]]
        self.assertEqual(
            statuses,
            ["Invalid Field", "Invalid Field", "Missing Email", "Invalid Field", "Invalid Field", "Invalid Field", "Ready"],
        )

    def _xlsx(self, build):
        workbook = Workbook()
        build(workbook.active)
        buffer = io.BytesIO()
        workbook.save(buffer)
        return buffer.getvalue()

    def test_a_padded_workbook_is_read_quickly(self):
        def build(sheet):
            sheet.append(HEADER.strip().split(","))
            sheet.append(["WGT270050", "Padded Row", DS, "padded@example.test", ""])
            sheet.cell(row=1_048_576, column=16_384, value="x")

        content = self._xlsx(build)
        started = time.monotonic()
        response = self._import(content, name="padded.xlsx")
        self.assertLess(time.monotonic() - started, 10)
        self.assertEqual([row["status"] for row in response.data["rows"]], ["Ready"])

    def test_an_oversized_workbook_is_refused_before_loading(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("xl/sharedStrings.xml", "0" * (31 * 1024 * 1024))
        response = self._import(buffer.getvalue(), name="bomb.xlsx")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("too large", response.data["error"])


class ImportInvitationTests(RegistryHardeningBase):
    def test_invitations_share_one_connection_after_the_batch_is_recorded(self):
        body = HEADER + "".join(
            f"WGT27006{i},Invite {i},{DS},invite{i}@example.test,\n" for i in range(3)
        )
        seen = []

        def fake_send(user, connection=None):
            seen.append((connection, RegistryImportBatch.objects.count()))
            return user.email != "invite1@example.test"

        with mock.patch("accounts.registry_views.send_activation_email", side_effect=fake_send):
            response = self.client.post(
                "/api/registry/students/import/",
                {"file": SimpleUploadedFile("invite.csv", body.encode(), content_type="text/csv")},
                format="multipart",
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(seen), 3)
        self.assertEqual(len({id(connection) for connection, _ in seen}), 1)
        self.assertTrue(all(batches == 1 for _, batches in seen))
        batch = RegistryImportBatch.objects.get()
        self.assertEqual(batch.created_count, 3)
        self.assertEqual(batch.invitations_failed, 1)
        self.assertEqual(
            [problem["issue"] for problem in batch.problems], ["activation email could not be sent"]
        )
