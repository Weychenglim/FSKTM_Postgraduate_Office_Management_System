"""Letter templates (UC21): archive and restore, and placeholder validation."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import LetterTemplate
from .placeholders import ALL_PLACEHOLDERS, PLACEHOLDERS
from .test_appointment_letters import clear_sample_templates

User = get_user_model()


class LetterTemplateLifecycleTests(APITestCase):
    def setUp(self):
        self.office = User.objects.create_user(
            email="letters-office@example.test",
            password="pw-office-5501",
            full_name="Letters Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.student = User.objects.create_user(
            email="letters-student@example.test",
            password="pw-student-5502",
            full_name="Letters Student",
            role=User.Role.STUDENT,
        )
        self.template = LetterTemplate.objects.create(
            name="Confirmation of Study",
            status=LetterTemplate.Status.ACTIVE,
            content="Dear {{STUDENT_NAME}} ({{STUDENT_ID}})",
        )

    def _patch(self, data, user=None):
        self.client.force_authenticate(user or self.office)
        return self.client.patch(f"/api/letter-templates/{self.template.pk}/", data, format="json")

    def _student_sees(self):
        self.client.force_authenticate(self.student)
        listed = [t["id"] for t in self.client.get("/api/letter-templates/").data]
        detail = self.client.get(f"/api/letter-templates/{self.template.pk}/").status_code
        return str(self.template.pk) in listed, detail

    def test_archive_hides_the_template_from_students_and_keeps_its_wording(self):
        response = self._patch({"status": LetterTemplate.Status.ARCHIVED})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.template.refresh_from_db()
        self.assertEqual(self.template.status, LetterTemplate.Status.ARCHIVED)
        self.assertEqual(self.template.content, "Dear {{STUDENT_NAME}} ({{STUDENT_ID}})")
        self.assertEqual(self._student_sees(), (False, status.HTTP_404_NOT_FOUND))

        self.client.force_authenticate(self.office)
        staff_view = [t["status"] for t in self.client.get("/api/letter-templates/").data]
        self.assertIn(LetterTemplate.Status.ARCHIVED, staff_view)

    def test_restore_returns_an_archived_template_to_draft_or_active(self):
        self._patch({"status": LetterTemplate.Status.ARCHIVED})
        self.assertEqual(self._patch({"status": LetterTemplate.Status.DRAFT}).status_code, 200)
        self.assertEqual(self._student_sees(), (False, status.HTTP_404_NOT_FOUND))
        self.assertEqual(self._patch({"status": LetterTemplate.Status.ACTIVE}).status_code, 200)
        self.assertEqual(self._student_sees(), (True, status.HTTP_200_OK))

    def test_students_cannot_archive(self):
        response = self._patch({"status": LetterTemplate.Status.ARCHIVED}, user=self.student)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class PlaceholderValidationTests(APITestCase):
    def setUp(self):
        clear_sample_templates()
        self.office = User.objects.create_user(
            email="placeholders-office@example.test",
            password="pw-office-5503",
            full_name="Placeholder Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.client.force_authenticate(self.office)

    def _create(self, content, template_status=LetterTemplate.Status.DRAFT):
        return self.client.post(
            "/api/letter-templates/",
            {"name": "Visa Support", "status": template_status, "content": content},
            format="json",
        )

    def test_every_supported_placeholder_is_accepted(self):
        content = " ".join(f"{{{{{name}}}}}" for name in PLACEHOLDERS)
        response = self._create(content, LetterTemplate.Status.ACTIVE)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_unknown_placeholders_are_rejected_on_create(self):
        response = self._create("Dear {{STUDNET_NAME}}, ref {{REFERENCE_NUMBER}} {{STUDNET_NAME}}")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["unknownPlaceholders"], ["{{STUDNET_NAME}}"])
        self.assertIn("{{STUDNET_NAME}}", response.data["content"])
        self.assertFalse(LetterTemplate.objects.exists())

    def test_malformed_placeholders_are_rejected(self):
        for content in ("Dear {{STUDENT_NAME}", "Dear {STUDENT_NAME}}", "Dear {{ student_name }}"):
            with self.subTest(content=content):
                response = self._create(content)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertTrue(response.data["malformedPlaceholders"])

    def test_unknown_placeholders_are_rejected_on_update(self):
        template = LetterTemplate.objects.create(
            name="Existing", status=LetterTemplate.Status.DRAFT, content="Dear {{STUDENT_NAME}}"
        )
        response = self.client.patch(
            f"/api/letter-templates/{template.pk}/",
            {"content": "Dear {{STUDENT_NAMES}}"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["unknownPlaceholders"], ["{{STUDENT_NAMES}}"])
        template.refresh_from_db()
        self.assertEqual(template.content, "Dear {{STUDENT_NAME}}")

    def test_a_legacy_template_with_a_bad_tag_can_be_archived_but_not_published(self):
        template = LetterTemplate.objects.create(
            name="Legacy", status=LetterTemplate.Status.DRAFT, content="Dear {{OLD_TAG}}"
        )
        url = f"/api/letter-templates/{template.pk}/"
        archived = self.client.patch(url, {"status": LetterTemplate.Status.ARCHIVED}, format="json")
        self.assertEqual(archived.status_code, status.HTTP_200_OK)
        published = self.client.patch(url, {"status": LetterTemplate.Status.ACTIVE}, format="json")
        self.assertEqual(published.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(published.data["unknownPlaceholders"], ["{{OLD_TAG}}"])

    def test_placeholder_catalogue_lists_every_tag_and_needs_authentication(self):
        response = self.client.get("/api/letter-templates/placeholders/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["name"] for item in response.data], list(ALL_PLACEHOLDERS))
        self.assertEqual(response.data[0]["tag"], "{{STUDENT_NAME}}")
        self.assertTrue(all(item["label"] and item["source"] for item in response.data))

        self.client.force_authenticate(None)
        anonymous = self.client.get("/api/letter-templates/placeholders/")
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)


class OfficeFilledFieldTests(APITestCase):
    """Fields the office types in when it approves a request, e.g. attendance."""

    def setUp(self):
        clear_sample_templates()
        self.office = User.objects.create_user(
            email="fields-office@example.test",
            password="pw-office-5504",
            full_name="Fields Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.client.force_authenticate(self.office)

    def _create(self, content, fields, template_status=LetterTemplate.Status.DRAFT):
        return self.client.post(
            "/api/letter-templates/",
            {"name": "Visa Support", "status": template_status, "content": content, "customFields": fields},
            format="json",
        )

    def test_a_template_can_use_its_own_fields(self):
        response = self._create(
            "{{STUDENT_NAME}} attended {{ATTENDANCE}} of classes.",
            [{"name": "attendance", "label": " Attendance (%) ", "hint": "From the attendance system"}],
            LetterTemplate.Status.ACTIVE,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(
            response.data["customFields"],
            [{"name": "ATTENDANCE", "label": "Attendance (%)", "hint": "From the attendance system"}],
        )
        self.assertEqual(LetterTemplate.objects.get().custom_fields[0]["name"], "ATTENDANCE")

    def test_a_tag_needs_its_field_defined(self):
        response = self._create("{{STUDENT_NAME}} attended {{ATTENDANCE}}.", [])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["unknownPlaceholders"], ["{{ATTENDANCE}}"])

    def test_bad_field_definitions_are_refused(self):
        cases = {
            "built-in name": [{"name": "STUDENT_NAME", "label": "Name"}],
            "repeated": [{"name": "ATTENDANCE", "label": "A"}, {"name": "attendance", "label": "B"}],
            "bad name": [{"name": "ATTEND-1", "label": "Attendance"}],
            "no label": [{"name": "ATTENDANCE", "label": "  "}],
            "not a list": {"name": "ATTENDANCE"},
            "too many": [{"name": f"FIELD_{chr(65 + n)}", "label": "x"} for n in range(21)],
        }
        for case, fields in cases.items():
            with self.subTest(case=case):
                response = self._create("Dear {{STUDENT_NAME}}", fields)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("customFields", response.data)
        self.assertFalse(LetterTemplate.objects.exists())

    def test_removing_a_field_still_in_use_is_refused(self):
        template_id = self._create(
            "Attendance: {{ATTENDANCE}}", [{"name": "ATTENDANCE", "label": "Attendance"}]
        ).data["id"]
        url = f"/api/letter-templates/{template_id}/"
        response = self.client.patch(url, {"customFields": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["unknownPlaceholders"], ["{{ATTENDANCE}}"])
        removed = self.client.patch(url, {"content": "No fields", "customFields": []}, format="json")
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertEqual(removed.data["customFields"], [])


class TemplateWordingVisibilityTests(APITestCase):
    """Students choose a letter by name; they never see its wording."""

    def setUp(self):
        clear_sample_templates()
        self.template = LetterTemplate.objects.create(
            name="Visa Support",
            status=LetterTemplate.Status.ACTIVE,
            description="For student pass renewal",
            content="Dear {{STUDENT_NAME}}, attendance {{ATTENDANCE}}",
            custom_fields=[{"name": "ATTENDANCE", "label": "Attendance", "hint": ""}],
        )

    def _views(self, role):
        user = User.objects.create_user(email=f"{role.split()[0].lower()}.wording@example.test", password="pw-5505", role=role)
        self.client.force_authenticate(user)
        listed = self.client.get("/api/letter-templates/").data[0]
        detail = self.client.get(f"/api/letter-templates/{self.template.pk}/").data
        return listed, detail

    def test_students_and_lecturers_get_name_and_description_only(self):
        for role in (User.Role.STUDENT, User.Role.LECTURER):
            with self.subTest(role=role):
                for data in self._views(role):
                    self.assertEqual(data["name"], "Visa Support")
                    self.assertEqual(data["description"], "For student pass renewal")
                    self.assertNotIn("content", data)
                    self.assertNotIn("customFields", data)

    def test_staff_get_the_wording_and_fields(self):
        for role in (User.Role.OFFICE_ADMIN, User.Role.COORDINATOR):
            with self.subTest(role=role):
                for data in self._views(role):
                    self.assertIn("{{ATTENDANCE}}", data["content"])
                    self.assertEqual(data["customFields"][0]["name"], "ATTENDANCE")


class EarlierLettersMigrationTests(APITestCase):
    def test_letters_issued_before_approval_get_their_decision_date(self):
        from importlib import import_module

        from django.apps import apps

        from .models import GeneratedLetter

        migration = import_module("letters.migrations.0004_letter_requests")
        issued = GeneratedLetter.objects.create(
            template_name="Old", reference_number="UMF/PG/2026/0099", content="x",
            status=GeneratedLetter.Status.ISSUED,
        )
        pending = GeneratedLetter.objects.create(template_name="New")
        migration.date_earlier_letters(apps, None)
        issued.refresh_from_db()
        pending.refresh_from_db()
        self.assertEqual(issued.decided_at, issued.created_at)
        self.assertIsNone(pending.decided_at)
        self.assertEqual(pending.status, GeneratedLetter.Status.PENDING)
        self.assertIsNone(pending.reference_number)
