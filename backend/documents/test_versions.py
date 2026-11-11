from django.core.cache import cache
from rest_framework.test import APITestCase

from announcements.models import Notification

from .fixtures import TEST_MEDIA, DocumentPeople, image_bytes, pdf_bytes, upload
from .models import Document, DocumentEvent, DocumentType
from .test_access import DocumentClient


@TEST_MEDIA
class NoCheckTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()
        cls.make_checker()

    def setUp(self):
        cache.clear()
        self.form = self.made(self.ali.user, "ai-use-declaration", "Signed form", name="form.png", content=image_bytes())

    def test_files_carry_no_check(self):
        for field in ("checkStatus", "checkStatusLabel", "checkReason", "checkedBy", "checkedAt"):
            self.assertNotIn(field, self.form)
        self.assertNotIn("canCheck", self.form["permissions"])
        self.client.force_authenticate(self.checker)
        self.assertNotIn("canCheck", self.client.get("/api/documents/options/").data)
        self.assertNotIn("toCheck", self.client.get("/api/documents/summary/").data)
        self.assertNotIn("coordinatorChecks", self.client.get(f"/api/documents/{self.form['id']}/sharing/").data)

    def test_there_is_no_way_to_accept_or_return_a_file(self):
        self.client.force_authenticate(self.checker)
        response = self.client.post(f"/api/documents/{self.form['id']}/check/", {"decision": "ACCEPT"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertIn("view", self.client.get("/api/documents/?view=check").data)
        self.assertNotIn("needsCheck", DocumentType.objects.get(code="ai-use-declaration").to_public_dict())

    def test_a_coordinator_sees_a_file_only_when_its_type_shares_it(self):
        DocumentType.objects.filter(code="supporting-document").update(share_coordinator=False)
        self.made(self.ali.user, "supporting-document", "AI declaration", name="ai.png", content=image_bytes(size=(64, 64)))
        self.assertNotIn("AI declaration", self.titles(self.checker))
        self.assertIn("Signed form", self.titles(self.checker))


@TEST_MEDIA
class VersionTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()
        cls.make_checker()

    def setUp(self):
        cache.clear()
        self.form = self.made(self.ali.user, "ai-use-declaration", "Signed form", name="form.png", content=image_bytes())
        self.thesis_bytes = pdf_bytes(1)
        self.thesis = self.made(self.ali.user, "final-research-report", "Thesis", content=self.thesis_bytes)

    def add(self, user, document, content, note=""):
        self.client.force_authenticate(user)
        return self.client.post(
            f"/api/documents/{document['id']}/versions/",
            {"file": upload("again.pdf" if content.startswith(b"%PDF") else "again.png", content), "note": note},
            format="multipart",
        )

    def test_a_new_version_is_kept_and_shared(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.add(self.ali.user, self.form, image_bytes(size=(50, 50)), "Signed now")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["file"]["number"], 2)
        self.assertEqual([version["number"] for version in response.data["versions"]], [2, 1])
        self.assertTrue(Notification.objects.filter(recipient=self.supervisor, event_key=f"documents:uploaded:{self.form['id']}:v2").exists())
        self.assertEqual(DocumentEvent.objects.get(action="VERSION_ADDED").reason, "Signed now")

    def test_only_the_uploader_adds_versions(self):
        self.assertEqual(self.add(self.office, self.form, image_bytes(size=(60, 60))).status_code, 403)
        self.assertEqual(self.add(self.checker, self.form, image_bytes(size=(60, 60))).status_code, 403)
        office_copy = self.made(self.office, "ai-use-declaration", "Office copy", students=[self.ali.matric_no], name="copy.png", content=image_bytes(size=(70, 70)))
        self.assertEqual(self.add(self.office, office_copy, image_bytes(size=(80, 80))).status_code, 201)

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
        self.thesis = self.made(self.ali.user, "final-research-report", "Thesis")
        self.evaluation = self.made(self.supervisor, "supporting-document", "Evaluation", students=[self.ali.matric_no])

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
        self.assertEqual(self.patch(self.office, self.thesis, {"title": "Office fix"}).status_code, 403)
        self.client.force_authenticate(self.office)
        office_view = self.client.get(f"/api/documents/{self.thesis['id']}/").data["permissions"]
        self.assertEqual(
            (office_view["canEdit"], office_view["canUploadVersion"], office_view["canChangeSharing"], office_view["canArchive"]),
            (False, False, False, False),
        )
        self.assertIn("title", self.patch(self.ali.user, self.thesis, {"title": ""}).data)
        ignored = self.patch(self.ali.user, self.thesis, {"students": [self.bella.matric_no]})
        self.assertEqual([student["matric"] for student in ignored.data["students"]], [self.ali.matric_no])
        moved = self.patch(self.supervisor, self.evaluation, {"students": [self.ali.matric_no, self.bella.matric_no]})
        self.assertEqual([student["matric"] for student in moved.data["students"]], [self.ali.matric_no, self.bella.matric_no])
        self.assertIn("students", self.patch(self.supervisor, self.evaluation, {"students": [self.chen.matric_no]}).data)
