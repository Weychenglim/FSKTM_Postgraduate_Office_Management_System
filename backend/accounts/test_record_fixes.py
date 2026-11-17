from django.core.cache import cache
from rest_framework.test import APITestCase

from announcements.models import Notification
from letters.models import GeneratedLetter

from .models import Coordinator, Lecturer, ProgrammeRule, Student, StudentRegistry, User
from .semesters import same_semester, stored_label

DS = "MASTER OF DATA SCIENCE (COURSEWORK)"


class RecordFixTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(email="fix-office@example.test", password="x", full_name="Fix Office", role=User.Role.OFFICE_ADMIN)
        cls.coordinator = User.objects.create_user(email="fix-coord@example.test", password="x", full_name="Fix Coordinator", role=User.Role.COORDINATOR)
        lecturer = Lecturer.objects.create(user=cls.coordinator, staff_no="FIX-C1", programme=DS)
        Coordinator.objects.create(lecturer=lecturer, programme_managed=DS)
        user = User.objects.create_user(email="fix-student@example.test", password="x", full_name="Fix Student", role=User.Role.STUDENT)
        cls.student = Student.objects.create(user=user, matric_no="FIX001", programme=DS, intake_semester="2025/2026 Semester I")

    def setUp(self):
        cache.clear()
        self.client.force_authenticate(self.office)

    def test_a_new_student_needs_a_programme(self):
        response = self.client.post(
            "/api/registry/students/", {"id": "S9990001", "name": "No Programme", "email": "nop@example.test", "sendInvite": False}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["programme"], ["Choose the programme."])
        self.assertFalse(Student.objects.filter(matric_no="S9990001").exists())

    def test_intakes_are_saved_in_one_spelling(self):
        response = self.client.patch(f"/api/registry/students/{self.student.matric_no}/", {"intakeDate": "Semester 1, 2024/2025"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.student.refresh_from_db()
        self.assertEqual(self.student.intake_semester, "2024/2025 Semester I")
        self.assertEqual(stored_label("2025/2026 Semester 2"), "2025/2026 Semester II")
        self.assertTrue(same_semester("2025/2026 Semester 1", "Semester I, 2025/2026 Session"))
        self.assertFalse(same_semester("2025/2026 Semester 1", "2025/2026 Semester II"))

    def test_the_office_sets_expected_completion_and_letters_use_it(self):
        from letters.details import letter_details

        response = self.client.patch(
            f"/api/registry/students/{self.student.matric_no}/", {"expectedCompletion": "Semester 2 2026/2027"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["expectedCompletion"], "2026/2027 Semester II")
        self.assertEqual(StudentRegistry.objects.get(student=self.student).expected_completion, "2026/2027 Semester II")
        self.assertEqual(letter_details(self.student)["expectedCompletion"], "2026/2027 Semester II")

    def test_without_an_entry_expected_completion_comes_from_the_programme_minimum(self):
        from letters.details import letter_details

        ProgrammeRule.objects.update_or_create(programme=DS, defaults={"min_semesters": 3, "max_semesters": 8})
        detail = self.client.get(f"/api/registry/students/{self.student.matric_no}/").data
        self.assertEqual(detail["expectedCompletionEstimate"], "", "no semesters on record, so no guess")
        self.client.patch(f"/api/registry/students/{self.student.matric_no}/", {"semester": "2025/2026 Semester I"}, format="json")
        detail = self.client.get(f"/api/registry/students/{self.student.matric_no}/").data
        self.assertEqual(detail["expectedCompletion"], "")
        self.assertTrue(detail["expectedCompletionEstimate"])
        self.assertTrue(letter_details(self.student)["expectedCompletion"])

    def test_the_record_links_to_letters_and_announcements(self):
        GeneratedLetter.objects.create(student=self.student, template_name="Student Confirmation Letter", status=GeneratedLetter.Status.ISSUED)
        Notification.objects.create(recipient=self.student.user, title="Registration week", is_announcement=True, event_key="ANN-fix-1")
        links = self.client.get(f"/api/registry/students/{self.student.matric_no}/links/").data
        self.assertEqual(links["letters"]["total"], 1)
        self.assertEqual(links["letters"]["latest"][0]["name"], "Student Confirmation Letter")
        self.assertEqual(links["announcements"]["latest"][0]["title"], "Registration week")
        self.assertEqual((links["supervisors"], links["panel"], links["marks"], links["files"]), ([], [], [], 0))

    def test_marks_and_letters_are_for_the_office_only(self):
        self.client.force_authenticate(self.coordinator)
        links = self.client.get(f"/api/registry/students/{self.student.matric_no}/links/")
        self.assertEqual(links.status_code, 200, links.data)
        self.assertIsNone(links.data["letters"])
        self.assertIsNone(links.data["marks"])

    def test_students_cannot_read_links(self):
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.client.get(f"/api/registry/students/{self.student.matric_no}/links/").status_code, 403)
