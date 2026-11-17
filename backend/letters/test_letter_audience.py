from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Student, StudentCompletion, StudentRegistry

from .models import GeneratedLetter, LetterAudience, LetterTemplate

User = get_user_model()
PASSWORD = "Audience-pass-4410!"
TEMPLATES = "/api/letter-templates/"
REQUESTS = "/api/letters/requests/"


class LetterAudienceTests(APITestCase):
    def setUp(self):
        self.current = self.template("Student Confirmation Letter", LetterAudience.CURRENT)
        self.finished = self.template("Completion Letter", LetterAudience.FINISHED)
        self.international = self.template("Student Pass Renewal", LetterAudience.INTERNATIONAL)
        self.office = User.objects.create_user(
            email="office.audience@example.test", password=PASSWORD, full_name="Office", role=User.Role.OFFICE_ADMIN
        )

    def template(self, name, audience):
        return LetterTemplate.objects.create(
            name=name,
            status=LetterTemplate.Status.ACTIVE,
            audience=audience,
            content="Dear {{STUDENT_NAME}} ({{STUDENT_ID}})",
        )

    def student(self, matric_no, *, student_status=Student.Status.ACTIVE, nationality="", ic="", passport="", finished=False):
        user = User.objects.create_user(
            email=f"{matric_no.lower()}@example.test",
            password=PASSWORD,
            full_name=f"Student {matric_no}",
            role=User.Role.STUDENT,
        )
        student = Student.objects.create(
            user=user, matric_no=matric_no, programme="Master of Computer Science", status=student_status
        )
        StudentRegistry.objects.create(student=student, nationality=nationality, ic_number=ic, passport_number=passport)
        if finished:
            StudentCompletion.objects.create(student=student, last_session="2026/2027", last_term="SEMESTER_I")
        return user

    def offered(self, user):
        self.client.force_authenticate(user)
        response = self.client.get(TEMPLATES)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {row["name"] for row in response.data}

    def ask(self, user, template):
        self.client.force_authenticate(user)
        return self.client.post(REQUESTS, {"templateId": template.pk}, format="json")

    def test_a_current_student_is_not_offered_the_completion_letter(self):
        user = self.student("AUD001", passport="A7654321", nationality="Indonesia")
        self.assertEqual(self.offered(user), {"Student Confirmation Letter", "Student Pass Renewal"})
        response = self.ask(user, self.finished)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "letter_not_for_this_student")
        self.assertIn("finished their studies", response.data["detail"])
        self.assertFalse(GeneratedLetter.objects.exists())

    def test_a_student_who_finished_can_ask_for_the_completion_letter(self):
        user = self.student("AUD002", finished=True)
        self.assertIn("Completion Letter", self.offered(user))
        self.assertEqual(self.ask(user, self.finished).status_code, status.HTTP_201_CREATED)

    def test_a_graduate_is_offered_only_letters_for_finished_students(self):
        user = self.student("AUD003", student_status=Student.Status.GRADUATED)
        self.assertEqual(self.offered(user), {"Completion Letter"})
        self.assertEqual(self.client.get(f"{TEMPLATES}{self.current.pk}/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(f"{REQUESTS}form/{self.current.pk}/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.ask(user, self.current).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.ask(user, self.finished).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.client.get(REQUESTS).status_code, status.HTTP_200_OK)

    def test_a_graduate_is_refused_when_no_letter_is_for_finished_students(self):
        self.finished.audience = LetterAudience.CURRENT
        self.finished.save()
        self.client.force_authenticate(self.student("AUD004", student_status=Student.Status.GRADUATED))
        response = self.client.get(TEMPLATES)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "letters_need_active_status")

    def test_a_withdrawn_student_is_still_refused(self):
        self.client.force_authenticate(self.student("AUD005", student_status=Student.Status.WITHDRAWN))
        self.assertEqual(self.client.get(TEMPLATES).status_code, status.HTTP_403_FORBIDDEN)

    def test_a_malaysian_student_is_not_offered_letters_for_international_students(self):
        for index, record in enumerate(({"nationality": "Malaysian"}, {"nationality": " malaysia "}, {"ic": "950101-14-7774"})):
            with self.subTest(record=record):
                user = self.student(f"AUD10{index}", **record)
                self.assertEqual(self.offered(user), {"Student Confirmation Letter"})
                response = self.ask(user, self.international)
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                self.assertIn("international students", response.data["detail"])

    def test_a_record_with_no_nationality_is_not_held_back(self):
        self.assertIn("Student Pass Renewal", self.offered(self.student("AUD006")))
        self.assertIn("Student Pass Renewal", self.offered(self.student("AUD007", ic="950101-14-7774", passport="A1")))

    def test_the_office_sets_who_can_ask(self):
        self.client.force_authenticate(self.office)
        rows = {row["name"]: row["audience"] for row in self.client.get(TEMPLATES).data}
        self.assertEqual(rows["Completion Letter"], "FINISHED")
        response = self.client.patch(f"{TEMPLATES}{self.current.pk}/", {"audience": "INTERNATIONAL"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["audience"], "INTERNATIONAL")
        response = self.client.patch(f"{TEMPLATES}{self.current.pk}/", {"audience": "EVERYONE"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(LetterTemplate.objects.get(pk=self.current.pk).audience, "INTERNATIONAL")

    def test_a_new_letter_type_is_for_current_students(self):
        self.client.force_authenticate(self.office)
        response = self.client.post(TEMPLATES, {"name": "Fee Statement", "content": "Dear {{STUDENT_NAME}}"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["audience"], "CURRENT")

    def test_the_office_is_told_when_a_waiting_request_no_longer_fits(self):
        user = self.student("AUD008", finished=True)
        letter_id = self.ask(user, self.finished).data["id"]
        StudentCompletion.objects.filter(student__matric_no="AUD008").delete()
        self.client.force_authenticate(self.office)
        review = self.client.get(f"{REQUESTS}{letter_id}/").data
        self.assertIn("finished their studies", review["problem"])
        response = self.client.post(f"{REQUESTS}{letter_id}/approve/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
