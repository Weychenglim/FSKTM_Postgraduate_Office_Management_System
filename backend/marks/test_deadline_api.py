from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from accounts.models import Lecturer, OfficeStaff, ProjectRegistration, Student, StudentSemester
from appointments.models import StudentResearchProfile
from marks.models import EvaluationPeriod, EvaluationTask, MarkEntry, Rubric


User = get_user_model()


class MarkDeadlineApiTests(APITestCase):
    def setUp(self):
        self.office = User.objects.create_user(
            email="deadline-office@example.test",
            password="password123",
            full_name="Deadline Office",
            role=User.Role.OFFICE_ADMIN,
        )
        OfficeStaff.objects.create(
            user=self.office,
            staff_no="DEADLINE-OFFICE-001",
            department="Postgraduate Office",
        )
        self.lecturer = User.objects.create_user(
            email="deadline-lecturer@example.test",
            password="password123",
            full_name="Deadline Lecturer",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.lecturer,
            staff_no="DEADLINE-LECT-001",
            department="Artificial Intelligence",
        )
        student_user = User.objects.create_user(
            email="deadline-student@example.test",
            password="password123",
            full_name="Deadline Student",
            role=User.Role.STUDENT,
        )
        student = Student.objects.create(
            user=student_user,
            matric_no="DEADLINE-STUDENT-001",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        )
        profile = StudentResearchProfile.objects.create(
            student=student_user,
            matric_no=student.matric_no,
            student_name=student_user.full_name,
            programme=student.programme,
            semester="Semester 1 2026/2027",
            proposed_topic="Deadline API metadata",
            supervisor=self.lecturer,
        )
        rubric = Rubric.objects.create(
            name="Deadline Rubric",
            code="deadline-rubric",
        )
        self.due_at = timezone.now() - timedelta(days=2)
        semester = AcademicSemester.objects.create(
            code="DEADLINE-S1", academic_session="2026/2027", term="SEMESTER_I",
            starts_on=timezone.localdate() - timedelta(days=30),
            ends_on=timezone.localdate() + timedelta(days=60), created_by=self.office,
        )
        StudentSemester.objects.create(student=student, session=semester.academic_session, term=semester.term)
        ProjectRegistration.objects.create(student=student, academic_semester=semester, stage="P1")
        period = EvaluationPeriod.objects.create(
            name="Deadline Period",
            semester="Semester 1 2026/2027",
            academic_semester=semester,
            assessment="P1",
            rubric=rubric,
            is_open=True,
            closes_at=self.due_at,
        )
        self.task = EvaluationTask.objects.create(
            profile=profile,
            evaluator=self.lecturer,
            period=period,
        )
        MarkEntry.objects.create(task=self.task, status=MarkEntry.Status.DRAFT)

    def test_office_mark_records_include_deadline_metadata(self):
        self.client.force_authenticate(user=self.office)

        response = self.client.get("/api/marks/")

        self.assertEqual(response.status_code, 200)
        record = response.data[0]
        self.assertEqual(record["deadlineState"], "OVERDUE")
        self.assertLessEqual(record["daysUntilDue"], -2)
        self.assertEqual(record["dueAt"], self.due_at)

    def test_lecturer_tasks_include_deadline_metadata(self):
        self.client.force_authenticate(user=self.lecturer)

        response = self.client.get("/api/marks/my-evaluation-tasks/")

        self.assertEqual(response.status_code, 200)
        task = response.data[0]
        self.assertEqual(task["assessment"], "P1")
        self.assertEqual(task["deadlineState"], "OVERDUE")
        self.assertLessEqual(task["daysUntilDue"], -2)
        self.assertIsNotNone(task["dueAt"])
