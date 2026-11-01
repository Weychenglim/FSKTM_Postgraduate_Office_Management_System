from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from announcements.models import Notification

from .fixtures import TEST_MEDIA, DocumentPeople, image_bytes, pdf_bytes, upload
from .models import Document, DocumentEvent
from .test_access import DocumentClient


@TEST_MEDIA
class CheckTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.ali.user.email_notifications = True
        self.ali.user.save(update_fields=["email_notifications"])
        self.form = self.made(self.ali.user, "supervisor-appointment-form", "Signed form", name="form.png", content=image_bytes())

    def check(self, user, decision, reason="", expected=None):
        self.client.force_authenticate(user)
        body = {"decision": decision, "reason": reason}
        if expected is not None:
            body["expectedVersion"] = expected
        return self.client.post(f"/api/documents/{self.form['id']}/check/", body, format="json")

    def test_the_office_accepts_and_the_student_hears(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.check(self.office, "ACCEPT", expected=1)
        self.assertEqual((response.status_code, response.data["checkStatus"], response.data["checkedBy"]), (200, "ACCEPTED", "Siti Office"))
        notice = Notification.objects.get(recipient=self.ali.user, event_key=f"documents:accepted:{self.form['id']}:1")
        self.assertEqual(notice.title, "Accepted: Signed form")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "Accepted: Signed form")
        self.assertTrue(DocumentEvent.objects.filter(action="ACCEPTED", actor=self.office).exists())

    def test_returning_needs_a_reason_the_student_sees(self):
        self.assertIn("reason", self.check(self.office, "RETURN").data)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.check(self.office, "RETURN", "The signature is missing.")
        self.assertEqual((response.data["checkStatus"], response.data["checkReason"]), ("RETURNED", "The signature is missing."))
        notice = Notification.objects.get(recipient=self.ali.user, event_key=f"documents:returned:{self.form['id']}:1")
        self.assertIn("The signature is missing.", notice.message)
        self.client.force_authenticate(self.ali.user)
        mine = self.client.get(f"/api/documents/{self.form['id']}/").data
        self.assertEqual((mine["checkStatus"], mine["checkReason"]), ("RETURNED", "The signature is missing."))

    def test_only_the_office_checks_and_only_waiting_files(self):
        self.assertEqual(self.check(self.supervisor, "ACCEPT").status_code, 403)
        self.assertEqual(self.check(self.ali.user, "ACCEPT").status_code, 403)
        self.assertEqual(self.check(self.office, "MAYBE").status_code, 400)
        self.assertEqual(self.check(self.office, "ACCEPT", expected=2).data["code"], "stale_version")
        self.check(self.office, "ACCEPT")
        response = self.check(self.office, "ACCEPT")
        self.assertEqual((response.status_code, response.data["code"]), (409, "not_waiting"))


@TEST_MEDIA
class VersionTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.form = self.made(self.ali.user, "supervisor-appointment-form", "Signed form", name="form.png", content=image_bytes())
        self.thesis_bytes = pdf_bytes(1)
        self.thesis = self.made(self.ali.user, "thesis", "Thesis", content=self.thesis_bytes)

    def add(self, user, document, content, note=""):
        self.client.force_authenticate(user)
        return self.client.post(
            f"/api/documents/{document['id']}/versions/",
            {"file": upload("again.pdf" if content.startswith(b"%PDF") else "again.png", content), "note": note},
            format="multipart",
        )

    def test_a_corrected_file_goes_back_for_a_check(self):
        self.client.force_authenticate(self.office)
        self.client.post(f"/api/documents/{self.form['id']}/check/", {"decision": "RETURN", "reason": "Sign it."}, format="json")
        with self.captureOnCommitCallbacks(execute=True):
            response = self.add(self.ali.user, self.form, image_bytes(size=(50, 50)), "Signed now")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["checkStatus"], response.data["file"]["number"]), ("WAITING", 2))
        self.assertEqual([version["number"] for version in response.data["versions"]], [2, 1])
        self.assertTrue(Notification.objects.filter(recipient=self.supervisor, event_key=f"documents:uploaded:{self.form['id']}:v2").exists())
        self.assertEqual(DocumentEvent.objects.get(action="VERSION_ADDED").reason, "Signed now")

    def test_the_office_adding_a_version_accepts_it(self):
        response = self.add(self.office, self.form, image_bytes(size=(60, 60)))
        self.assertEqual(response.data["checkStatus"], "ACCEPTED")
        response = self.add(self.office, self.thesis, pdf_bytes(2))
        self.assertEqual(response.data["checkStatus"], "NONE")

    def test_version_rules(self):
        self.assertIn("same file", self.add(self.ali.user, self.thesis, self.thesis_bytes).data["file"][0])
        self.assertEqual(self.add(self.supervisor, self.thesis, pdf_bytes(2)).status_code, 403)
        self.assertEqual(self.add(self.outsider, self.thesis, pdf_bytes(2)).status_code, 404)
        self.assertIn("file", self.add(self.ali.user, self.thesis, image_bytes()).data)
        self.add(self.ali.user, self.thesis, pdf_bytes(2))
        self.add(self.ali.user, self.thesis, pdf_bytes(3))
        numbers = list(Document.objects.get(pk=self.thesis["id"]).versions.values_list("number", flat=True))
        self.assertEqual(sorted(numbers), [1, 2, 3])
        self.client.force_authenticate(self.supervisor)
        old = self.client.get(f"/api/documents/{self.thesis['id']}/download/?version=1")
        self.assertEqual(old.status_code, 200)


@TEST_MEDIA
class EditTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.thesis = self.made(self.ali.user, "thesis", "Thesis")
        self.evaluation = self.made(self.supervisor, "evaluation-form", "Evaluation", students=[self.ali.matric_no])

    def patch(self, user, document, body):
        self.client.force_authenticate(user)
        return self.client.patch(f"/api/documents/{document['id']}/", body, format="json")

    def test_the_uploader_edits_details_and_the_change_is_logged(self):
        response = self.patch(self.ali.user, self.thesis, {"title": "Thesis, chapter 1", "description": "For my supervisor"})
        self.assertEqual((response.status_code, response.data["title"]), (200, "Thesis, chapter 1"))
        change = DocumentEvent.objects.get(action="DETAILS_CHANGED")
        self.assertEqual(change.details["title"], {"before": "Thesis", "after": "Thesis, chapter 1"})
        self.assertNotIn("tags", change.details)

    def test_who_may_edit_what(self):
        self.assertEqual(self.patch(self.supervisor, self.thesis, {"title": "Mine now"}).status_code, 403)
        self.assertEqual(self.patch(self.outsider, self.thesis, {"title": "Mine now"}).status_code, 404)
        self.assertEqual(self.patch(self.office, self.thesis, {"title": "Office fix"}).data["title"], "Office fix")
        self.assertIn("title", self.patch(self.ali.user, self.thesis, {"title": ""}).data)
        ignored = self.patch(self.ali.user, self.thesis, {"students": [self.bella.matric_no]})
        self.assertEqual([student["matric"] for student in ignored.data["students"]], [self.ali.matric_no])
        moved = self.patch(self.supervisor, self.evaluation, {"students": [self.ali.matric_no, self.bella.matric_no]})
        self.assertEqual([student["matric"] for student in moved.data["students"]], [self.ali.matric_no, self.bella.matric_no])
        self.assertIn("students", self.patch(self.supervisor, self.evaluation, {"students": [self.chen.matric_no]}).data)
