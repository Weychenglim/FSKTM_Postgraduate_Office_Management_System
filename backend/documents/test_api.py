import os
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from announcements.models import Notification

from .fixtures import TEST_MEDIA, DocumentPeople, image_bytes, office_bytes, pdf_bytes
from .models import Document, DocumentEvent, DocumentType, DocumentVersion
from .test_access import DocumentClient


def stored_files():
    root = Path(settings.MEDIA_ROOT) / "documents"
    return {str(path) for path in root.rglob("*") if path.is_file()} if root.exists() else set()


@TEST_MEDIA
class UploadRuleTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()

    def test_a_student_uploads_only_for_themselves(self):
        made = self.made(self.ali.user, "thesis", "", students=[self.bella.matric_no], name="Thesis_draft_1.pdf")
        self.assertEqual([s["matric"] for s in made["students"]], [self.ali.matric_no])
        self.assertEqual(made["title"], "Thesis draft 1")
        self.assertRegex(made["reference"], r"^DOC-\d{4}-\d{6}$")
        self.assertEqual(made["semester"]["id"], self.semester.pk)
        self.assertEqual(made["share"], {"supervisors": True, "panel": True, "coordinator": True})
        self.assertTrue(Document.objects.get(pk=made["id"]).follows_type)

    def test_student_refusals(self):
        response = self.send(self.deferred.user, "thesis")
        self.assertEqual((response.status_code, response.data["code"]), (403, "documents_need_active_status"))
        self.assertIn("type", self.send(self.ali.user, "evaluation-form").data)
        self.assertIn("file", self.send(self.ali.user, "other", name="marks.xlsx", content=office_bytes("xlsx")).data)
        self.assertIn("type", self.send(self.ali.user, "no-such-type").data)
        DocumentType.objects.filter(code="letter").update(is_active=False)
        self.assertEqual(self.send(self.ali.user, "letter").status_code, 400)

    def test_one_per_student_types_ask_for_a_new_version(self):
        first = self.made(self.ali.user, "thesis", "Draft 1")
        response = self.send(self.ali.user, "thesis", content=pdf_bytes(2))
        self.assertEqual(response.status_code, 409)
        self.assertEqual((response.data["code"], response.data["existingDocumentId"]), ("already_have_one", first["id"]))

    def test_staff_tag_only_their_own_students_through_allowed_relationships(self):
        response = self.send(self.supervisor, "evaluation-form", students=[self.chen.matric_no])
        self.assertIn("You cannot add these students: DOC-S3", response.data["students"][0])
        response = self.send(self.panel, "research-proposal", students=[self.ali.matric_no])
        self.assertIn("You cannot upload a Research Proposal for: DOC-S1", response.data["students"][0])
        self.made(self.panel, "evaluation-form", "Panel evaluation", students=[self.ali.matric_no])
        self.made(self.office, "evaluation-form", "Office copy", students=[self.chen.matric_no])
        too_many = [f"X{n}" for n in range(51)]
        self.assertIn("at most 50", self.send(self.office, "evaluation-form", students=too_many).data["students"][0])

    def test_staff_files_and_student_files_keep_to_their_types(self):
        self.assertIn("students", self.send(self.supervisor, "evaluation-form").data)
        self.assertIn("staff files", self.send(self.supervisor, "staff-document", students=[self.ali.matric_no]).data["students"][0])
        made = self.made(self.supervisor, "staff-document", "Rubric", name="rubric.xlsx", content=office_bytes("xlsx"))
        self.assertEqual((made["isStaffFile"], made["staffAudience"]), (True, "ACADEMIC"))
        self.assertIn("programmes", self.send(self.office, "staff-document", programmes=["Master of Nothing"]).data)
        self.assertIn("audience", self.send(self.office, "staff-document", audience="EVERYONE").data)
        self.assertEqual(self.send(self.ali.user, "staff-document").status_code, 400)

    def test_staff_choose_the_ticks_and_the_semester(self):
        made = self.made(
            self.supervisor, "evaluation-form", "Ticks", students=[self.ali.matric_no],
            sharePanel="false", semester="none",
        )
        self.assertEqual(made["share"], {"supervisors": True, "panel": False, "coordinator": True})
        self.assertIsNone(made["semester"])
        self.assertFalse(Document.objects.get(pk=made["id"]).follows_type)
        self.assertIn("semester", self.send(self.supervisor, "evaluation-form", students=[self.ali.matric_no], semester="99999").data)

    def test_office_checks_only_uploads_from_others(self):
        waiting = self.made(self.ali.user, "supervisor-appointment-form", "Signed form")
        self.assertEqual(waiting["checkStatus"], "WAITING")
        office = self.made(self.office, "supervisor-appointment-form", "Office copy", students=[self.ali.matric_no])
        self.assertEqual(office["checkStatus"], "NONE")
        self.assertEqual(self.made(self.ali.user, "thesis", "No check")["checkStatus"], "NONE")

    def test_duplicates_need_a_confirmation(self):
        content = pdf_bytes(3)
        self.made(self.ali.user, "letter", "Letter one", content=content)
        response = self.send(self.ali.user, "letter", content=content)
        self.assertEqual(response.status_code, 409)
        self.assertTrue(response.data["requiresAcknowledgement"])
        self.made(self.ali.user, "letter", "Letter again", content=content, acknowledgeWarnings="true")

    @override_settings(DOCUMENT_UPLOAD_THROTTLE_RATE="2/hour")
    def test_uploads_are_throttled(self):
        self.made(self.ali.user, "letter", "One")
        self.made(self.ali.user, "letter", "Two", content=pdf_bytes(2))
        self.assertEqual(self.send(self.ali.user, "letter", content=pdf_bytes(3)).status_code, 429)
        self.client.force_authenticate(self.ali.user)
        self.assertEqual(self.client.get("/api/documents/").status_code, 200)

    def test_a_failed_save_leaves_no_stored_file(self):
        before = stored_files()
        with mock.patch.object(DocumentVersion, "save", side_effect=RuntimeError("database down")):
            with self.assertRaises(RuntimeError):
                self.send(self.ali.user, "letter")
        self.assertEqual(stored_files(), before)
        self.assertFalse(Document.objects.exists())


@TEST_MEDIA
class NoticeTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()

    def notified(self, document):
        return set(Notification.objects.filter(record_id=str(document["id"])).values_list("recipient__full_name", flat=True))

    def test_supervisors_hear_when_their_student_uploads(self):
        with self.captureOnCommitCallbacks(execute=True):
            thesis = self.made(self.ali.user, "thesis", "Thesis")
        self.assertEqual(self.notified(thesis), {"Dr Supervisor", "Dr Co"})
        row = Notification.objects.filter(record_id=str(thesis["id"])).first()
        self.assertEqual((row.target_module, row.record_type, row.event_key), ("FILES", "STUDENT_DOCUMENT", f"documents:uploaded:{thesis['id']}"))
        with self.captureOnCommitCallbacks(execute=True):
            letter = self.made(self.ali.user, "letter", "Private letter", content=pdf_bytes(2))
        self.assertEqual(self.notified(letter), set())

    def test_staff_uploads_reach_the_people_ticked(self):
        with self.captureOnCommitCallbacks(execute=True):
            evaluation = self.made(self.supervisor, "evaluation-form", "Evaluation", students=[self.ali.matric_no, self.bella.matric_no])
        self.assertEqual(self.notified(evaluation), {"Dr Co", "Dr Panel", "Prof Coordinator"})
        with self.captureOnCommitCallbacks(execute=True):
            rubric = self.made(self.coordinator, "staff-document", "Rubric")
        self.assertEqual(self.notified(rubric), {"Dr Supervisor", "Dr Co", "Dr Panel", "Dr Outsider"})
        with self.captureOnCommitCallbacks(execute=True):
            private = self.made(self.supervisor, "staff-document", "To office", audience="OFFICE", content=pdf_bytes(2))
        self.assertEqual(self.notified(private), set())


@TEST_MEDIA
class ListingTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.made(self.ali.user, "thesis", "Ali thesis")
        self.made(self.ali.user, "supervisor-appointment-form", "Ali form", name="form.png",
                  content=image_bytes())
        self.made(self.supervisor, "evaluation-form", "Evaluation", students=[self.bella.matric_no], semester="none")
        self.made(self.office, "staff-document", "Rubric", name="rubric.docx", content=office_bytes("docx"))

    def test_filters_and_search(self):
        office = self.office
        self.assertEqual(self.titles(office, "?view=check"), {"Ali form"})
        self.assertEqual(self.titles(office, "?view=staff"), {"Rubric"})
        self.assertEqual(self.titles(office, "?view=mine"), {"Rubric"})
        self.assertEqual(self.titles(office, "?type=thesis"), {"Ali thesis"})
        self.assertEqual(self.titles(office, "?group=STAFF"), {"Rubric"})
        self.assertEqual(self.titles(office, f"?student={self.ali.matric_no.lower()}"), {"Ali thesis", "Ali form"})
        self.assertEqual(self.titles(office, "?uploader=students"), {"Ali thesis", "Ali form"})
        self.assertEqual(self.titles(office, "?uploader=staff"), {"Evaluation", "Rubric"})
        self.assertEqual(self.titles(office, "?status=WAITING"), {"Ali form"})
        self.assertEqual(self.titles(office, "?kind=IMAGE"), {"Ali form"})
        self.assertEqual(self.titles(office, "?kind=DOCX"), {"Rubric"})
        self.assertEqual(self.titles(office, "?semester=none"), {"Evaluation"})
        self.assertEqual(self.titles(office, f"?semester={self.semester.pk}&type=thesis"), {"Ali thesis"})
        self.assertEqual(self.titles(office, "?q=ali hassan"), {"Ali thesis", "Ali form"})
        self.assertEqual(self.titles(office, f"?q={self.bella.matric_no}"), {"Evaluation"})
        self.assertEqual(self.titles(office, "?q=nothing matches"), set())
        reference = Document.objects.get(title="Rubric").reference
        self.assertEqual(self.titles(office, f"?q={reference}"), {"Rubric"})
        self.assertEqual(self.titles(office, "?from=2000-01-01&to=2999-12-31"), {"Ali thesis", "Ali form", "Evaluation", "Rubric"})
        self.assertEqual(self.titles(office, "?to=2000-01-01"), set())

    def test_paging_ordering_and_bad_values(self):
        self.client.force_authenticate(self.office)
        page = self.client.get("/api/documents/?limit=2&offset=1&ordering=title").data
        self.assertEqual((page["count"], page["limit"], page["offset"]), (4, 2, 1))
        self.assertEqual([row["title"] for row in page["results"]], ["Ali thesis", "Evaluation"])
        for query in ("limit=0", "limit=101", "offset=-1", "ordering=size", "view=everything", "from=yesterday", "status=MAYBE"):
            self.assertEqual(self.client.get(f"/api/documents/?{query}").status_code, 400, query)

    def test_the_list_uses_a_fixed_number_of_queries(self):
        self.client.force_authenticate(self.office)
        with CaptureQueriesContext(connection) as few:
            self.client.get("/api/documents/")
        for number in range(6):
            self.made(self.office, "evaluation-form", f"More {number}", students=[self.ali.matric_no, self.bella.matric_no],
                      content=pdf_bytes(number + 2))
        self.client.force_authenticate(self.office)
        with CaptureQueriesContext(connection) as many:
            self.client.get("/api/documents/")
        self.assertEqual(len(few.captured_queries), len(many.captured_queries))

    def test_summary_options_and_student_search(self):
        self.client.force_authenticate(self.office)
        self.assertEqual(
            self.client.get("/api/documents/summary/").data,
            {"all": 4, "staffFiles": 1, "mine": 1, "toCheck": 1, "returned": 0, "archived": 0, "studentsStillToHandIn": 0},
        )
        self.client.force_authenticate(self.ali.user)
        options = self.client.get("/api/documents/options/").data
        codes = {t["code"] for t in options["types"]}
        self.assertIn("thesis", codes)
        self.assertNotIn("evaluation-form", codes)
        self.assertNotIn("semesters", options)
        self.assertEqual(self.client.get("/api/documents/students/").status_code, 403)
        self.client.force_authenticate(self.supervisor)
        found = {row["matric"]: row for row in self.client.get("/api/documents/students/").data}
        self.assertEqual(set(found), {self.ali.matric_no, self.bella.matric_no})
        self.assertEqual(found[self.ali.matric_no]["relation"], "Your supervisee")
        self.assertEqual(found[self.ali.matric_no]["supervisors"], ["Dr Co"])
        self.assertEqual(found[self.ali.matric_no]["panel"], ["Dr Panel"])
        self.assertEqual(found[self.bella.matric_no]["coordinators"], ["Prof Coordinator"])
        self.assertEqual([row["matric"] for row in self.client.get("/api/documents/students/?search=bella").data], [self.bella.matric_no])
        self.assertEqual(found[self.ali.matric_no]["roles"], ["SUPERVISOR"])

    def test_student_header(self):
        self.client.force_authenticate(self.office)
        header = self.client.get(f"/api/documents/students/{self.ali.matric_no.lower()}/").data
        self.assertEqual(
            (header["name"], header["supervisors"], header["panel"], header["letters"]),
            ("Ali Hassan", ["Dr Supervisor", "Dr Co"], ["Dr Panel"], 0),
        )
        self.client.force_authenticate(self.panel)
        self.assertIsNone(self.client.get(f"/api/documents/students/{self.ali.matric_no}/").data["letters"])
        for user in (self.outsider, self.ali.user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f"/api/documents/students/{self.ali.matric_no}/").status_code, 404)


@TEST_MEDIA
class DownloadAndDeleteTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.content = pdf_bytes(2)
        self.thesis = self.made(self.ali.user, "thesis", "Thesis", name="My Thesis.pdf", content=self.content)

    def test_download_sends_the_file_privately(self):
        self.client.force_authenticate(self.supervisor)
        response = self.client.get(f"/api/documents/{self.thesis['id']}/download/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), self.content)
        self.assertIn('attachment; filename="My Thesis.pdf"', response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertTrue(DocumentEvent.objects.filter(action="DOWNLOADED", actor=self.supervisor).exists())

    def test_a_missing_stored_file_is_reported(self):
        version = Document.objects.get(pk=self.thesis["id"]).current_version
        os.remove(version.file.path)
        self.client.force_authenticate(self.office)
        response = self.client.get(f"/api/documents/{self.thesis['id']}/download/")
        self.assertEqual((response.status_code, response.data["code"]), (404, "file_missing"))

    def test_only_the_uploader_deletes_and_the_history_keeps_a_line(self):
        path = Document.objects.get(pk=self.thesis["id"]).current_version.file.path
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.delete(f"/api/documents/{self.thesis['id']}/").status_code, 403)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.delete(f"/api/documents/{self.thesis['id']}/").status_code, 404)
        self.client.force_authenticate(self.ali.user)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(f"/api/documents/{self.thesis['id']}/").status_code, 204)
        self.assertFalse(Document.objects.filter(pk=self.thesis["id"]).exists())
        self.assertFalse(os.path.exists(path))
        line = DocumentEvent.objects.get(action="DELETED")
        self.assertIsNone(line.document_id)
        self.assertEqual((line.title, line.details["uploadedBy"]), ("Thesis", "Ali Hassan"))
        self.assertEqual(line.details["students"], [{"name": "Ali Hassan", "matric": self.ali.matric_no}])
