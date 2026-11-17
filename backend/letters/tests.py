from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import LetterTemplate


User = get_user_model()


class LetterTemplateAuthorizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.users = {
            role: User.objects.create_user(
                email=f"{index}@example.test",
                password="test-password",
                full_name=f"Test {role}",
                role=role,
            )
            for index, role in enumerate(User.Role.values)
        }
        self.template = LetterTemplate.objects.create(
            name="Enrollment confirmation",
            status=LetterTemplate.Status.ACTIVE,
            content="Dear {{STUDENT_NAME}}",
        )
        self.payload = {
            "name": "Status confirmation",
            "status": LetterTemplate.Status.DRAFT,
            "content": "Dear {{STUDENT_NAME}}",
        }

    def authenticate(self, role):
        self.client.force_authenticate(self.users[role])

    def test_all_authenticated_roles_can_read_templates(self):
        for role in User.Role.values:
            with self.subTest(role=role):
                self.authenticate(role)
                self.assertEqual(self.client.get("/api/letter-templates/").status_code, 200)
                self.assertEqual(
                    self.client.get(f"/api/letter-templates/{self.template.pk}/").status_code,
                    200,
                )

    def test_only_office_staff_can_create_templates(self):
        for role in User.Role.values:
            with self.subTest(role=role):
                self.authenticate(role)
                response = self.client.post(
                    "/api/letter-templates/", self.payload, format="json"
                )
                expected = 201 if role == User.Role.OFFICE_ADMIN else 403
                self.assertEqual(response.status_code, expected)

    def test_a_coordinator_cannot_delete_a_template(self):
        self.authenticate(User.Role.COORDINATOR)
        self.assertEqual(self.client.delete(f"/api/letter-templates/{self.template.pk}/").status_code, 403)
        self.assertTrue(type(self.template).objects.filter(pk=self.template.pk).exists())

    def test_only_office_staff_can_modify_templates(self):
        for role in User.Role.values:
            with self.subTest(role=role):
                self.authenticate(role)
                response = self.client.patch(
                    f"/api/letter-templates/{self.template.pk}/",
                    {"name": f"Updated by {role}"},
                    format="json",
                )
                expected = 200 if role == User.Role.OFFICE_ADMIN else 403
                self.assertEqual(response.status_code, expected)
