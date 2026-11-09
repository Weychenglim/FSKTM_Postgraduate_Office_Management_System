"""Only students whose academic status is Active may generate letters."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Student

from .models import LetterTemplate

User = get_user_model()
PASSWORD = "Eligibility-pass-6601!"


class StudentLetterEligibilityTests(APITestCase):
    def setUp(self):
        self.template = LetterTemplate.objects.create(
            name="Confirmation of Study",
            status=LetterTemplate.Status.ACTIVE,
            content="Dear {{STUDENT_NAME}} ({{STUDENT_ID}})",
        )

    def student(self, matric_no, student_status):
        user = User.objects.create_user(
            email=f"{matric_no.lower()}@example.test",
            password=PASSWORD,
            full_name=f"Student {matric_no}",
            role=User.Role.STUDENT,
        )
        Student.objects.create(
            user=user, matric_no=matric_no, programme="Master of Computer Science", status=student_status
        )
        return user

    def paths(self):
        return (
            "/api/letter-templates/",
            f"/api/letter-templates/{self.template.pk}/",
            "/api/auth/me/letter-details/",
        )

    def test_an_active_student_gets_templates_and_details(self):
        self.client.force_authenticate(self.student("ELIG001", Student.Status.ACTIVE))
        for path in self.paths():
            self.assertEqual(self.client.get(path).status_code, status.HTTP_200_OK, path)

    def test_students_who_are_not_active_are_refused_with_the_reason(self):
        inactive = (Student.Status.DEFERRED, Student.Status.WITHDRAWN, Student.Status.GRADUATED)
        for index, student_status in enumerate(inactive):
            with self.subTest(status=student_status):
                self.client.force_authenticate(self.student(f"ELIG10{index}", student_status))
                for path in self.paths():
                    response = self.client.get(path)
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, path)
                    self.assertEqual(response.data["code"], "letters_need_active_status")
                    self.assertIn(Student.Status(student_status).label, response.data["detail"])

    def test_a_student_regains_letters_when_active_again(self):
        user = self.student("ELIG200", Student.Status.DEFERRED)
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get("/api/auth/me/letter-details/").status_code, status.HTTP_403_FORBIDDEN)
        Student.objects.filter(user=user).update(status=Student.Status.ACTIVE)
        user.refresh_from_db()
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get("/api/auth/me/letter-details/").status_code, status.HTTP_200_OK)

    def test_staff_and_lecturers_are_unaffected(self):
        for role in (User.Role.OFFICE_ADMIN, User.Role.LECTURER):
            with self.subTest(role=role):
                user = User.objects.create_user(
                    email=f"{role.split()[0].lower()}.elig@example.test", password=PASSWORD, role=role
                )
                self.client.force_authenticate(user)
                self.assertEqual(self.client.get("/api/letter-templates/").status_code, status.HTTP_200_OK)
                self.assertEqual(
                    self.client.get(f"/api/letter-templates/{self.template.pk}/").status_code, status.HTTP_200_OK
                )
