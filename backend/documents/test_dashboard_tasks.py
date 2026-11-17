"""Waiting work from File Management, Registry, Letters and the FAQ on the dashboard (FR-63, UC31)."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ProjectRegistration
from dashboard.actions import build_dashboard_tasks
from dashboard.office_attention import attention_page, build_office_attention_tasks
from faq.models import FaqQuestion
from letters.models import GeneratedLetter, LetterPurpose

from .fixtures import TEST_MEDIA
from .test_submissions import SubmissionBase

MINE = ("submission_", "registry_", "letters_", "faq_")


def mine(user, now=None):
    return {task["id"]: task for task in build_dashboard_tasks(user, now=now) if task["id"].startswith(MINE)}


@TEST_MEDIA
class StudentDocumentTasks(SubmissionBase, APITestCase):
    def setUp(self):
        super().setUp()
        self.today = self.due - timedelta(days=7)

    def test_a_document_that_is_due_is_a_task_until_it_is_sent(self):
        pk = self.made()
        task = mine(self.bella.user, self.today)[f"submission_{pk}"]
        self.assertEqual(task["name"], "Submit: RP2 final report")
        self.assertEqual(task["status"], "upcoming")
        self.assertEqual(task["statusText"], "Due in 7 days")
        self.assertEqual(task["deadlineState"], "UPCOMING")
        self.assertEqual(task["dueAt"], self.due)
        self.assertEqual((task["targetModule"], task["recordType"], task["recordId"]), ("FILES", "SUBMISSION", str(pk)))
        self.assertEqual(task["semesterCode"], self.semester.code)
        self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        self.assertEqual(mine(self.bella.user, self.today), {})

    def test_only_the_students_who_must_send_it_get_the_task(self):
        self.made()
        for user in (self.ali.user, self.deferred.user, self.coordinator, self.supervisor, self.office):
            self.assertEqual(mine(user, self.today), {})

    def test_the_due_day_and_late_work(self):
        pk = self.made(afterDue="ACCEPT_LATE")
        key = f"submission_{pk}"
        due_day = mine(self.bella.user, self.due - timedelta(hours=1))[key]
        self.assertEqual((due_day["status"], due_day["statusText"]), ("deadline", "Due today"))
        late = mine(self.bella.user, self.due + timedelta(days=2))[key]
        self.assertEqual((late["status"], late["statusText"]), ("overdue", "2 days overdue"))

    def test_a_closed_submission_is_no_longer_a_task(self):
        self.made()
        self.assertEqual(mine(self.bella.user, self.due + timedelta(seconds=1)), {})

    def test_an_overdue_document_comes_before_one_due_later(self):
        late = self.made(afterDue="ACCEPT_LATE", title="Late one")
        self.due += timedelta(days=5)
        later = self.made(title="Later one", type="turnitin-report")
        now = self.due - timedelta(days=4)
        ids = [task["id"] for task in build_dashboard_tasks(self.bella.user, now=now) if task["id"].startswith("submission_")]
        self.assertEqual(ids, [f"submission_{late}", f"submission_{later}"])

    def test_the_dashboard_sends_the_task_to_the_student(self):
        pk = self.made()
        self.client.force_authenticate(self.bella.user)
        response = self.client.get("/api/dashboard/tasks/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(f"submission_{pk}", [task["id"] for task in response.data["tasks"]])


class StaffTasks(SubmissionBase, APITestCase):
    def letter(self, student, name, purpose=LetterPurpose.REQUEST, days_ago=0, **fields):
        letter = GeneratedLetter.objects.create(student=student, template_name=name, purpose=purpose, **fields)
        if days_ago:
            GeneratedLetter.objects.filter(pk=letter.pk).update(created_at=timezone.now() - timedelta(days=days_ago, hours=1))
        return letter

    def test_the_office_sees_letters_and_student_questions_that_are_waiting(self):
        self.assertEqual(mine(self.office), {})
        self.letter(self.bella, "Student Confirmation Letter")
        self.letter(self.ali, "Supervisor Appointment Letter", LetterPurpose.SUPERVISOR_APPOINTMENT, days_ago=3)
        self.letter(self.bella, "Issued", status=GeneratedLetter.Status.ISSUED, reference_number="UM/TEST/1")
        self.letter(self.bella, "Rejected", status=GeneratedLetter.Status.REJECTED)
        for text in ("how to park", "where is the lab"):
            FaqQuestion.objects.create(text=text, outcome=FaqQuestion.Outcome.NO_MATCH)
        FaqQuestion.objects.create(text="not helpful", outcome=FaqQuestion.Outcome.ANSWERED, helpful=False)
        FaqQuestion.objects.create(text="answered", outcome=FaqQuestion.Outcome.ANSWERED)
        FaqQuestion.objects.create(text="dismissed", outcome=FaqQuestion.Outcome.NO_MATCH, review=FaqQuestion.Review.DISMISSED)
        tasks = mine(self.office)
        self.assertEqual(sorted(tasks), ["faq_questions", "letters_requests"])
        letters = tasks["letters_requests"]
        self.assertEqual(letters["name"], "Letter requests to review")
        self.assertEqual(letters["statusText"], "2 waiting · oldest 3 days")
        self.assertEqual((letters["targetModule"], letters["recordType"]), ("LETTERS", "LETTER_REQUESTS"))
        questions = tasks["faq_questions"]
        self.assertEqual(questions["name"], "Student questions to answer")
        self.assertEqual(questions["statusText"], "3 waiting")
        self.assertEqual((questions["targetModule"], questions["recordType"]), ("FAQ", "FAQ_QUESTIONS"))
        for user in (self.coordinator, self.supervisor, self.bella.user):
            self.assertEqual(mine(user), {})

    def test_a_request_from_today_has_no_oldest_line(self):
        self.letter(self.bella, "Student Confirmation Letter")
        self.assertEqual(mine(self.office)["letters_requests"]["statusText"], "1 waiting")

    def test_the_office_finds_them_under_needs_attention(self):
        self.letter(self.bella, "Student Confirmation Letter", days_ago=1)
        FaqQuestion.objects.create(text="how to park", outcome=FaqQuestion.Outcome.NO_MATCH)
        page = attention_page(build_office_attention_tasks(self.office), {})
        groups = {group["category"]: group for group in page["summary"]}
        self.assertEqual(groups["letters"]["title"], "Letter requests")
        self.assertEqual(groups["letters"]["detail"], "1 waiting · oldest 1 day")
        self.assertEqual(groups["letters"]["responsibility"], "review")
        self.assertEqual(groups["questions"]["title"], "Student questions")
        self.assertEqual(groups["questions"]["detail"], "1 waiting")
        rows = {row["id"]: row for row in page["results"]}
        self.assertEqual(rows["letters_requests"]["category"], "letters")
        self.assertEqual(rows["faq_questions"]["category"], "questions")
        self.assertIn({"value": "letters", "label": "Letter requests"}, page["categories"])
        self.client.force_authenticate(self.office)
        response = self.client.get("/api/dashboard/attention/", {"category": "questions"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data["results"]], ["faq_questions"])

    def test_a_coordinator_sees_correction_requests_for_their_own_programme(self):
        registration = ProjectRegistration.objects.create(
            student=self.bella,
            academic_semester=self.semester,
            stage=ProjectRegistration.Stage.NONE,
            source=ProjectRegistration.Source.STUDENT,
            correction_requested_at=timezone.now(),
        )
        task = mine(self.coordinator)["registry_stage_corrections"]
        self.assertEqual(task["name"], "RP Registration correction requests")
        self.assertEqual(task["statusText"], "1 waiting")
        self.assertEqual((task["targetModule"], task["recordType"]), ("REGISTRY", "PROJECT_STAGE"))
        for user in (self.checker, self.office, self.supervisor, self.bella.user):
            self.assertEqual(mine(user), {})
        ProjectRegistration.objects.filter(pk=registration.pk).update(correction_closed_at=timezone.now())
        self.assertEqual(mine(self.coordinator), {})
