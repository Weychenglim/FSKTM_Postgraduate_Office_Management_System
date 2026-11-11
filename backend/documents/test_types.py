from django.contrib import admin
from django.core.cache import cache
from rest_framework.test import APITestCase

from announcements.models import Notification

from .admin import DocumentTypeAdmin, DocumentTypeForm
from .fixtures import DS, TEST_MEDIA, DocumentPeople, image_bytes
from .models import DocumentEvent, DocumentType
from .test_access import DocumentClient

STUDENT_TYPES = ["p1-research-report", "final-research-report", "turnitin-report", "ai-use-declaration", "supporting-document"]


class SharingClient(DocumentClient):
    def sharing(self, user, document, body=None):
        self.client.force_authenticate(user)
        url = f"/api/documents/{document['id']}/sharing/"
        return self.client.get(url) if body is None else self.client.put(url, body, format="json")


@TEST_MEDIA
class TypeListTests(DocumentPeople, SharingClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()

    def options(self, user):
        self.client.force_authenticate(user)
        return self.client.get("/api/documents/options/").data

    def test_the_list_follows_the_research_project_timeline(self):
        student = self.options(self.ali.user)
        self.assertEqual([row["code"] for row in student["types"]], STUDENT_TYPES)
        self.assertEqual(
            [(row["code"], row["group"]) for row in student["types"]][:4],
            [("p1-research-report", "RP1"), ("final-research-report", "RP2"), ("turnitin-report", "RP2"), ("ai-use-declaration", "RP2")],
        )
        self.assertEqual([group["value"] for group in student["groups"]], ["RP1", "RP2", "SUPPORTING", "STAFF"])
        staff = self.options(self.coordinator)
        self.assertEqual([row["code"] for row in staff["types"]], STUDENT_TYPES + ["staff-document"])
        for key in ("canManageTypes", "canSeeRequired"):
            self.assertNotIn(key, staff)
        self.assertNotIn("required", staff["types"][0])

    def test_the_settings_and_required_pages_are_gone(self):
        self.client.force_authenticate(self.coordinator)
        for url in ("/api/documents/types/", "/api/documents/required/", "/api/documents/required/mine/"):
            self.assertEqual(self.client.get(url).status_code, 404, url)
        self.assertNotIn("studentsStillToHandIn", self.client.get("/api/documents/summary/").data)

    def test_a_type_switched_off_keeps_its_files(self):
        self.made(self.ali.user, "final-research-report", "Report")
        DocumentType.objects.filter(code="final-research-report").update(is_active=False)
        self.assertNotIn("final-research-report", [row["code"] for row in self.options(self.ali.user)["types"]])
        self.assertEqual(self.send(self.ali.user, "final-research-report", title="Again").status_code, 400)
        self.assertEqual(self.titles(self.supervisor), {"Report"})

    def test_the_technical_admin_adds_a_type_in_django_admin(self):
        form = DocumentTypeForm(data={
            "label": "Ethics  Approval", "description": "", "group": "SUPPORTING", "kind": "STUDENT",
            "uploaders": ["STUDENT"], "allowed_kinds": ["PDF"], "share_supervisors": True,
            "share_coordinator": True, "is_active": True, "display_order": 7,
        })
        self.assertTrue(form.is_valid(), form.errors)
        doc_type = form.save(commit=False)
        type_admin = DocumentTypeAdmin(DocumentType, admin.site)
        type_admin.save_model(None, doc_type, form, False)
        doc_type.refresh_from_db()
        self.assertEqual((doc_type.code, doc_type.label, doc_type.uploaders), ("ethics-approval", "Ethics Approval", ["STUDENT"]))
        self.assertIn("ethics-approval", [row["code"] for row in self.options(self.ali.user)["types"]])
        twin = DocumentTypeForm(data={"label": "turnitin report", "group": "RP2", "kind": "STUDENT", "allowed_kinds": ["PDF"], "display_order": 1})
        self.assertIn("label", twin.errors)
        self.assertFalse(type_admin.has_delete_permission(None))


@TEST_MEDIA
class FixedSharingTests(DocumentPeople, SharingClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()
        cls.make_checker()

    def setUp(self):
        cache.clear()

    def test_a_research_report_reaches_the_supervisors_panel_and_coordinator(self):
        self.made(self.ali.user, "final-research-report", "Final report")
        for user in (self.supervisor, self.co_supervisor, self.panel, self.checker, self.office):
            self.assertIn("Final report", self.titles(user), user.full_name)
        for user in (self.outsider, self.coordinator, self.bella.user):
            self.assertNotIn("Final report", self.titles(user), user.full_name)

    def test_a_supporting_document_is_kept_from_the_panel(self):
        self.made(self.ali.user, "supporting-document", "Medical letter", name="letter.png", content=image_bytes())
        self.assertIn("Medical letter", self.titles(self.supervisor))
        self.assertIn("Medical letter", self.titles(self.checker))
        self.assertNotIn("Medical letter", self.titles(self.panel))

    def test_staff_cannot_pick_who_sees_a_student_file(self):
        letter = self.made(
            self.supervisor, "supporting-document", "Ethics approval", students=[self.ali.matric_no],
            sharePanel="true", shareCoordinator="false",
        )
        self.assertEqual(letter["share"], {"supervisors": True, "panel": False, "coordinator": True})
        self.assertNotIn("Ethics approval", self.titles(self.panel))
        self.assertIn("Ethics approval", self.titles(self.checker))
        self.assertFalse(letter["permissions"]["canChangeSharing"])
        self.assertEqual(self.sharing(self.supervisor, letter).status_code, 403)
        self.assertEqual(self.sharing(self.supervisor, letter, {"audience": "ACADEMIC"}).status_code, 403)
        self.assertFalse(DocumentEvent.objects.filter(action=DocumentEvent.Action.SHARING_CHANGED).exists())

    def test_the_type_decides_for_files_already_uploaded(self):
        self.made(self.ali.user, "supporting-document", "Medical letter", name="letter.png", content=image_bytes())
        DocumentType.objects.filter(code="supporting-document").update(share_panel=True)
        self.assertIn("Medical letter", self.titles(self.panel))

    def test_staff_file_audience(self):
        notes = self.made(self.supervisor, "staff-document", "Meeting notes", audience="OFFICE")
        self.assertTrue(notes["permissions"]["canChangeSharing"])
        self.assertNotIn("Meeting notes", self.titles(self.outsider))
        self.assertEqual(self.sharing(self.supervisor, notes).data["audience"], "OFFICE")
        self.assertIn("audience", self.sharing(self.supervisor, notes, {"audience": "EVERYONE"}).data)
        self.assertIn("programmes", self.sharing(self.supervisor, notes, {"audience": "ACADEMIC", "programmes": ["Basket Weaving"]}).data)
        self.assertEqual(self.sharing(self.co_supervisor, notes).status_code, 404)
        response = self.sharing(self.supervisor, notes, {"audience": "ACADEMIC", "programmes": []})
        self.assertEqual(response.data["staffAudience"], "ACADEMIC")
        self.assertIn("Meeting notes", self.titles(self.outsider))

    def test_people_who_can_newly_see_a_staff_file_are_told(self):
        notes = self.made(self.supervisor, "staff-document", "Rubric", audience="OFFICE")
        with self.captureOnCommitCallbacks(execute=True):
            response = self.sharing(self.supervisor, notes, {"audience": "ACADEMIC", "programmes": [DS]})
        self.assertEqual(response.status_code, 200, response.data)
        told = set(Notification.objects.filter(event_key__startswith=f"documents:shared:{notes['id']}:e").values_list("recipient", flat=True))
        self.assertTrue({self.panel.pk, self.co_supervisor.pk} <= told)
        self.assertNotIn(self.supervisor.pk, told)
