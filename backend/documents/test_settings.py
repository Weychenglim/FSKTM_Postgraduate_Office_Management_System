from django.core.cache import cache
from rest_framework.test import APITestCase

from announcements.models import Notification

from .fixtures import TEST_MEDIA, DocumentPeople
from .models import Document, DocumentEvent, DocumentType, SettingsChange
from .test_access import DocumentClient


class SettingsClient(DocumentClient):
    def as_office(self):
        self.client.force_authenticate(self.office)

    def change_type(self, code, body, user=None):
        self.client.force_authenticate(user or self.office)
        doc_type = DocumentType.objects.get(code=code)
        return self.client.patch(f"/api/documents/types/{doc_type.pk}/", body, format="json")

    def sharing(self, user, document, body=None):
        self.client.force_authenticate(user)
        url = f"/api/documents/{document['id']}/sharing/"
        return self.client.get(url) if body is None else self.client.put(url, body, format="json")


@TEST_MEDIA
class TypeSettingsTests(DocumentPeople, SettingsClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()

    def test_the_office_sees_every_type_with_counts(self):
        DocumentType.objects.filter(code="other").update(is_active=False)
        self.made(self.ali.user, "thesis", "Thesis")
        self.as_office()
        response = self.client.get("/api/documents/types/")
        self.assertEqual(response.status_code, 200)
        rows = {row["code"]: row for row in response.data["types"]}
        self.assertEqual(len(rows), 9)
        self.assertFalse(rows["other"]["isActive"])
        self.assertEqual((rows["thesis"]["files"], rows["thesis"]["studentUploads"]), (1, 1))
        self.assertEqual(response.data["kindUploaders"]["STAFF"], ["LECTURER", "COORDINATOR"])
        self.assertEqual(len(response.data["programmes"]), 3)
        for user in (self.supervisor, self.coordinator, self.ali.user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/documents/types/").status_code, 403)
        self.assertEqual(self.change_type("thesis", {"label": "Mine"}, self.coordinator).status_code, 403)

    def test_new_ticks_reach_student_uploads_but_not_staff_choices(self):
        student_upload = self.made(self.ali.user, "research-proposal", "Ali proposal")
        staff_upload = self.made(self.supervisor, "research-proposal", "Supervisor copy", students=[self.ali.matric_no])
        self.assertIn("Ali proposal", self.titles(self.co_supervisor))
        response = self.change_type("research-proposal", {"shareSupervisors": False})
        self.assertEqual((response.status_code, response.data["updatedFiles"]), (200, 1))
        self.assertFalse(Document.objects.get(pk=student_upload["id"]).share_supervisors)
        self.assertTrue(Document.objects.get(pk=staff_upload["id"]).share_supervisors)
        self.assertEqual(self.titles(self.co_supervisor), {"Supervisor copy"})
        change = SettingsChange.objects.get(action=SettingsChange.Action.CHANGED)
        self.assertEqual(change.details["changes"]["share_supervisors"], {"before": True, "after": False})
        self.assertEqual((change.actor, change.details["updatedFiles"]), (self.office, 1))

    def test_saving_without_changes_logs_nothing(self):
        doc_type = DocumentType.objects.get(code="thesis")
        response = self.change_type("thesis", {"label": doc_type.label, "needsCheck": doc_type.needs_check})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(SettingsChange.objects.exists())

    def test_adding_a_type_students_can_use(self):
        self.as_office()
        response = self.client.post(
            "/api/documents/types/",
            {
                "label": "AI Use Declaration",
                "description": "The signed declaration form",
                "group": "FORMS",
                "kind": "STUDENT",
                "uploaders": ["STUDENT"],
                "shareSupervisors": True,
                "needsCheck": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            (response.data["code"], response.data["isActive"], response.data["allowedKinds"]),
            ("ai-use-declaration", True, list(DocumentType.FILE_KINDS)),
        )
        self.assertTrue(SettingsChange.objects.filter(action=SettingsChange.Action.ADDED, label="AI Use Declaration").exists())
        self.client.force_authenticate(self.ali.user)
        codes = [row["code"] for row in self.client.get("/api/documents/options/").data["types"]]
        self.assertIn("ai-use-declaration", codes)
        uploaded = self.made(self.ali.user, "ai-use-declaration", "My declaration")
        self.assertEqual(uploaded["checkStatus"], "WAITING")

    def test_type_rules(self):
        self.as_office()
        self.assertIn("label", self.client.post("/api/documents/types/", {"label": "thesis"}, format="json").data)
        self.assertIn("uploaders", self.client.post(
            "/api/documents/types/", {"label": "Rubric", "kind": "STAFF", "uploaders": ["STUDENT"]}, format="json"
        ).data)
        staff = self.client.post(
            "/api/documents/types/",
            {"label": "Rubric", "kind": "STAFF", "uploaders": ["COORDINATOR", "LECTURER"], "shareSupervisors": True},
            format="json",
        ).data
        self.assertEqual((staff["uploaders"], staff["shareSupervisors"]), (["LECTURER", "COORDINATOR"], False))
        self.made(self.ali.user, "thesis", "Thesis")
        self.assertIn("kind", self.change_type("thesis", {"kind": "STAFF"}).data)
        self.assertEqual(self.change_type("turnitin-report", {"kind": "STAFF"}).data["uploaders"], [])

    def test_switching_a_type_off_keeps_its_files(self):
        self.made(self.ali.user, "thesis", "Thesis")
        self.change_type("thesis", {"isActive": False})
        self.client.force_authenticate(self.ali.user)
        codes = [row["code"] for row in self.client.get("/api/documents/options/").data["types"]]
        self.assertNotIn("thesis", codes)
        self.assertEqual(self.send(self.ali.user, "thesis", title="Again").status_code, 400)
        self.assertEqual(self.titles(self.supervisor), {"Thesis"})


@TEST_MEDIA
class SharingTests(DocumentPeople, SettingsClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()

    def test_the_office_changes_a_student_upload_and_it_stops_following_its_type(self):
        thesis = self.made(self.ali.user, "thesis", "Thesis")
        options = self.sharing(self.office, thesis).data
        self.assertEqual(options["people"]["panel"], [{"name": "Dr Panel", "role": "panel member"}])
        self.assertEqual({person["name"] for person in options["people"]["supervisors"]}, {"Dr Supervisor", "Dr Co"})
        response = self.sharing(self.office, thesis, {"supervisors": True, "panel": False, "coordinator": True})
        self.assertEqual((response.status_code, response.data["share"]["panel"]), (200, False))
        self.assertNotIn("Thesis", self.titles(self.panel))
        event = DocumentEvent.objects.get(action=DocumentEvent.Action.SHARING_CHANGED)
        self.assertEqual((event.details["before"]["panel"], event.details["after"]["panel"]), (True, False))
        self.change_type("thesis", {"sharePanel": True, "shareSupervisors": False})
        stored = Document.objects.get(pk=thesis["id"])
        self.assertEqual((stored.follows_type, stored.share_panel, stored.share_supervisors), (False, False, True))

    def test_people_who_can_newly_see_a_file_are_told(self):
        evaluation = self.made(self.supervisor, "evaluation-form", "Evaluation", students=[self.ali.matric_no], sharePanel="false")
        with self.captureOnCommitCallbacks(execute=True):
            response = self.sharing(self.supervisor, evaluation, {"supervisors": True, "panel": True, "coordinator": True})
        self.assertEqual(response.status_code, 200, response.data)
        notices = Notification.objects.filter(event_key__startswith=f"documents:shared:{evaluation['id']}:e")
        self.assertEqual([notice.recipient for notice in notices], [self.panel])
        with self.captureOnCommitCallbacks(execute=True):
            self.sharing(self.supervisor, evaluation, {"supervisors": True, "panel": True, "coordinator": True})
        self.assertEqual(DocumentEvent.objects.filter(action=DocumentEvent.Action.SHARING_CHANGED).count(), 1)

    def test_who_may_change_sharing(self):
        thesis = self.made(self.ali.user, "thesis", "Thesis")
        evaluation = self.made(self.supervisor, "evaluation-form", "Evaluation", students=[self.ali.matric_no])
        self.assertEqual(self.sharing(self.ali.user, thesis).status_code, 403)
        self.assertEqual(self.sharing(self.co_supervisor, evaluation, {"panel": False}).status_code, 403)
        self.assertEqual(self.sharing(self.outsider, evaluation).status_code, 404)

    def test_staff_file_audience(self):
        notes = self.made(self.supervisor, "staff-document", "Meeting notes", audience="OFFICE")
        self.assertNotIn("Meeting notes", self.titles(self.outsider))
        self.assertEqual(self.sharing(self.supervisor, notes).data["audience"], "OFFICE")
        self.assertIn("audience", self.sharing(self.supervisor, notes, {"audience": "EVERYONE"}).data)
        self.assertIn("programmes", self.sharing(self.supervisor, notes, {"audience": "ACADEMIC", "programmes": ["Basket Weaving"]}).data)
        response = self.sharing(self.supervisor, notes, {"audience": "ACADEMIC", "programmes": []})
        self.assertEqual(response.data["staffAudience"], "ACADEMIC")
        self.assertIn("Meeting notes", self.titles(self.outsider))
