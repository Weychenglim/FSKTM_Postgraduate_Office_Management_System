from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from announcements.models import Notification

from .fixtures import CS, DS, TEST_MEDIA, DocumentPeople, image_bytes, upload
from .models import DocumentType, RequiredReminder
from .test_access import DocumentClient


class RequiredClient(DocumentClient):
    def require(self, code, **body):
        self.client.force_authenticate(self.coordinator)
        doc_type = DocumentType.objects.get(code=code)
        return self.client.patch(f"/api/documents/types/{doc_type.pk}/", {"required": True, **body}, format="json")

    def overview(self, user):
        self.client.force_authenticate(user)
        return self.client.get("/api/documents/required/")

    def row(self, user, code):
        return next(item for item in self.overview(user).data["types"] if item["code"] == code)

    def names(self, user, code, show=""):
        self.client.force_authenticate(user)
        doc_type = DocumentType.objects.get(code=code)
        response = self.client.get(f"/api/documents/required/{doc_type.pk}/students/?show={show}")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def remind(self, user, code):
        self.client.force_authenticate(user)
        doc_type = DocumentType.objects.get(code=code)
        return self.client.post(f"/api/documents/required/{doc_type.pk}/remind/", {}, format="json")


@TEST_MEDIA
class RequiredSettingsTests(DocumentPeople, RequiredClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def test_marking_a_type_required(self):
        response = self.require("thesis", requiredDueNote="Due before Week 12", requiredProgrammes=[DS.lower()])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            (response.data["required"], response.data["requiredDueNote"], response.data["requiredProgrammes"]),
            (True, "Due before Week 12", [DS]),
        )
        self.assertIn("required", self.require("evaluation-form").data)
        self.assertFalse(self.require("staff-document").data["required"])
        self.assertIn("requiredProgrammes", self.require("thesis", requiredProgrammes=["Basket Weaving"]).data)


@TEST_MEDIA
class RequiredProgressTests(DocumentPeople, RequiredClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()
        cls.make_checker()

    def setUp(self):
        cache.clear()
        self.require("thesis", requiredDueNote="Due before Week 12")
        self.require("supervisor-appointment-form")

    def test_counts_cover_active_students_only(self):
        self.made(self.ali.user, "thesis", "Ali thesis")
        thesis = self.row(self.checker, "thesis")
        self.assertEqual((thesis["students"], thesis["done"], thesis["missing"], thesis["dueNote"]), (2, 1, 1, "Due before Week 12"))
        self.assertEqual(self.row(self.coordinator, "thesis")["students"], 1)
        self.require("thesis", requiredProgrammes=[DS])
        self.assertEqual(self.row(self.checker, "thesis")["students"], 2)
        self.assertEqual(self.row(self.coordinator, "thesis")["students"], 0)

    def test_checked_types_move_from_waiting_to_returned_to_done(self):
        form = self.made(self.ali.user, "supervisor-appointment-form", "Form", name="form.png", content=image_bytes())
        self.assertEqual(self.row(self.checker, "supervisor-appointment-form")["waiting"], 1)
        self.client.force_authenticate(self.checker)
        self.client.post(f"/api/documents/{form['id']}/check/", {"decision": "RETURN", "reason": "Sign it."}, format="json")
        row = self.row(self.checker, "supervisor-appointment-form")
        self.assertEqual((row["returned"], row["waiting"]), (1, 0))
        self.assertEqual([item["name"] for item in self.names(self.checker, "supervisor-appointment-form", "todo")], ["Chen Wei", "Ali Hassan"])
        self.client.force_authenticate(self.ali.user)
        self.client.post(f"/api/documents/{form['id']}/versions/", {"file": upload("again.png", image_bytes(size=(50, 50)))}, format="multipart")
        self.client.force_authenticate(self.checker)
        self.client.post(f"/api/documents/{form['id']}/check/", {"decision": "ACCEPT"}, format="json")
        done = self.names(self.checker, "supervisor-appointment-form", "done")
        self.assertEqual([(item["name"], item["documentId"]) for item in done], [("Ali Hassan", form["id"])])

    def test_students_whose_programme_has_no_coordinator_are_followed_by_every_coordinator(self):
        self.student("DOC-S8", "Lina Legacy", "Master of Computer Science (By Coursework)")
        self.assertEqual([item["name"] for item in self.names(self.coordinator, "thesis", "todo")], ["Bella Tan", "Lina Legacy"])
        self.assertEqual([item["name"] for item in self.names(self.checker, "thesis", "todo")], ["Ali Hassan", "Chen Wei", "Lina Legacy"])
        self.assertEqual(self.row(self.coordinator, "thesis")["students"], 2)

    def test_coordinators_follow_their_programmes_only(self):
        self.assertEqual(self.row(self.coordinator, "thesis")["students"], 1)
        self.assertEqual([item["name"] for item in self.names(self.coordinator, "thesis")], ["Bella Tan"])
        self.assertTrue(self.overview(self.coordinator).data["canRemind"])
        self.assertEqual(self.overview(self.office).status_code, 403)
        self.assertEqual(self.overview(self.supervisor).status_code, 403)
        self.assertEqual(self.overview(self.ali.user).status_code, 403)

    def test_students_see_their_own_required_documents(self):
        self.made(self.ali.user, "thesis", "Ali thesis")
        self.client.force_authenticate(self.ali.user)
        mine = {item["code"]: item for item in self.client.get("/api/documents/required/mine/").data}
        self.assertEqual((mine["thesis"]["state"], mine["thesis"]["dueNote"]), ("DONE", "Due before Week 12"))
        self.assertEqual(mine["supervisor-appointment-form"]["state"], "MISSING")
        self.client.force_authenticate(self.deferred.user)
        self.assertEqual(self.client.get("/api/documents/required/mine/").data, [])
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.get("/api/documents/required/mine/").status_code, 403)
        self.assertIsNone(self.client.get(f"/api/documents/students/{self.ali.matric_no}/").data["required"])
        self.client.force_authenticate(self.checker)
        header = self.client.get(f"/api/documents/students/{self.ali.matric_no}/").data
        self.assertEqual({item["label"]: item["state"] for item in header["required"]}, {"Supervisor Appointment Form": "MISSING", "Thesis": "DONE"})
        self.client.force_authenticate(self.supervisor)
        self.assertIsNone(self.client.get(f"/api/documents/students/{self.ali.matric_no}/").data["required"])

    def test_the_student_to_do_count_for_the_sidebar(self):
        def to_do(user):
            self.client.force_authenticate(user)
            return self.client.get("/api/documents/summary/").data.get("toDo")

        self.assertEqual(to_do(self.ali.user), 2)
        self.made(self.ali.user, "thesis", "Ali thesis")
        self.assertEqual(to_do(self.ali.user), 1)
        form = self.made(self.ali.user, "supervisor-appointment-form", "Form", name="form.png", content=image_bytes())
        self.assertEqual(to_do(self.ali.user), 0, "a file waiting for a check is not the student's to do")
        faculty = self.made(self.ali.user, "faculty-form", "AI declaration", name="ai.png", content=image_bytes(size=(64, 64)))
        self.client.force_authenticate(self.checker)
        for document in (form, faculty):
            self.client.post(f"/api/documents/{document['id']}/check/", {"decision": "RETURN", "reason": "Sign it."}, format="json")
        self.assertEqual(to_do(self.ali.user), 2, "a returned required file and a returned faculty form")
        self.assertIsNone(to_do(self.office))
        self.assertEqual(to_do(self.deferred.user), 0)

    def test_remind_once_a_day(self):
        self.made(self.ali.user, "thesis", "Ali thesis")
        self.chen.user.email_notifications = True
        self.chen.user.deadline_reminders = True
        self.chen.user.save(update_fields=["email_notifications", "deadline_reminders"])
        self.assertEqual(self.remind(self.office, "thesis").status_code, 403)
        self.assertEqual(self.remind(self.supervisor, "thesis").status_code, 403)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.remind(self.checker, "thesis")
        self.assertEqual((response.status_code, response.data["sent"]), (200, 1))
        notices = Notification.objects.filter(event_key__startswith="documents:required:")
        self.assertEqual({notice.recipient for notice in notices}, {self.chen.user})
        self.assertEqual(notices.first().record_id, "thesis")
        self.assertTrue(notices.first().message.startswith("Your programme coordinator asks you to hand in your Thesis."))
        self.assertEqual([message.to for message in mail.outbox], [[self.chen.user.email]])
        self.assertEqual(self.remind(self.checker, "thesis").data["code"], "reminded_today")
        row = self.row(self.checker, "thesis")
        self.assertEqual((row["remindedToday"], row["lastReminder"]["students"], row["lastReminder"]["by"]), (True, 1, "Prof Checker"))
        self.assertFalse(self.row(self.coordinator, "thesis")["remindedToday"])
        self.assertIsNone(self.row(self.coordinator, "thesis")["lastReminder"])
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.remind(self.coordinator, "thesis").data["sent"], 1)
        self.assertIn(self.bella.user, {notice.recipient for notice in Notification.objects.filter(event_key__startswith="documents:required:")})

    def test_nobody_left_to_remind(self):
        self.require("thesis", requiredProgrammes=[CS])
        self.made(self.office, "thesis", "Bella thesis", students=[self.bella.matric_no])
        self.assertEqual(self.remind(self.coordinator, "thesis").data["code"], "nobody_to_remind")
        self.assertFalse(RequiredReminder.objects.exists())
