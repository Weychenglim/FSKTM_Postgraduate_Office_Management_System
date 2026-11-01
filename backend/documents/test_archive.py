import os
import tempfile
import time
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APITestCase

from .fixtures import TEST_MEDIA, DocumentPeople, pdf_bytes, upload
from .models import Document, DocumentEvent, DocumentVersion
from .test_access import DocumentClient


class ArchiveClient(DocumentClient):
    def archive(self, user, document, reason="Uploaded by mistake."):
        self.client.force_authenticate(user)
        return self.client.post(f"/api/documents/{document['id']}/archive/", {"reason": reason}, format="json")

    def restore(self, user, document):
        self.client.force_authenticate(user)
        return self.client.post(f"/api/documents/{document['id']}/restore/", {}, format="json")

    def detail(self, user, document):
        self.client.force_authenticate(user)
        return self.client.get(f"/api/documents/{document['id']}/")

    def history(self, query=""):
        self.client.force_authenticate(self.office)
        return self.client.get(f"/api/documents/history/{query}")


@TEST_MEDIA
class ArchiveTests(DocumentPeople, ArchiveClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.thesis = self.made(self.ali.user, "thesis", "Ali thesis")

    def test_an_archived_file_is_seen_by_the_office_only(self):
        response = self.archive(self.office, self.thesis, "Replaced by a newer file.")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            (response.data["archived"], response.data["archivedBy"], response.data["archiveReason"]),
            (True, "Siti Office", "Replaced by a newer file."),
        )
        self.assertTrue(response.data["permissions"]["canRestore"])
        self.assertFalse(response.data["permissions"]["canEdit"])
        for user in (self.ali.user, self.supervisor, self.panel):
            self.assertEqual(self.detail(user, self.thesis).status_code, 404)
            self.assertNotIn("Ali thesis", self.titles(user))
        self.assertNotIn("Ali thesis", self.titles(self.office))
        self.assertIn("Ali thesis", self.titles(self.office, "?archived=1"))
        self.assertEqual(DocumentEvent.objects.get(action="ARCHIVED").reason, "Replaced by a newer file.")

    def test_archive_rules(self):
        self.assertIn("reason", self.archive(self.office, self.thesis, "  ").data)
        self.assertEqual(self.archive(self.supervisor, self.thesis).status_code, 403)
        self.assertEqual(self.archive(self.ali.user, self.thesis).status_code, 403)
        self.archive(self.office, self.thesis)
        self.assertEqual(self.archive(self.office, self.thesis).data["code"], "already_archived")
        self.client.force_authenticate(self.office)
        added = self.client.post(
            f"/api/documents/{self.thesis['id']}/versions/",
            {"file": upload("again.pdf", pdf_bytes(2))},
            format="multipart",
        )
        self.assertEqual(added.status_code, 403)

    def test_restoring_brings_it_back(self):
        self.archive(self.office, self.thesis)
        self.assertEqual(self.restore(self.supervisor, self.thesis).status_code, 403)
        response = self.restore(self.office, self.thesis)
        self.assertEqual((response.status_code, response.data["archived"], response.data["archiveReason"]), (200, False, ""))
        self.assertEqual(self.detail(self.ali.user, self.thesis).status_code, 200)
        self.assertEqual(DocumentEvent.objects.get(action="RESTORED").details["archiveReason"], "Uploaded by mistake.")
        self.assertEqual(self.restore(self.office, self.thesis).data["code"], "not_archived")


@TEST_MEDIA
class HistoryTests(DocumentPeople, ArchiveClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.thesis = self.made(self.ali.user, "thesis", "Ali thesis")
        self.evaluation = self.made(self.supervisor, "evaluation-form", "Evaluation", students=[self.ali.matric_no])

    def test_deleted_files_stay_in_the_history(self):
        self.client.force_authenticate(self.ali.user)
        self.client.patch(f"/api/documents/{self.thesis['id']}/", {"title": "Ali thesis v2"}, format="json")
        self.client.get(f"/api/documents/{self.thesis['id']}/download/")
        self.client.delete(f"/api/documents/{self.thesis['id']}/")
        deleted = self.history("?show=deleted").data
        self.assertEqual(deleted["count"], 1)
        row = deleted["results"][0]
        self.assertEqual((row["title"], row["documentId"], row["actor"]), ("Ali thesis v2", None, "Ali Hassan"))
        self.assertEqual(row["detail"], "Thesis · Ali Hassan (DOC-S1) · uploaded by Ali Hassan")
        every = self.history().data["results"]
        self.assertNotIn("DOWNLOADED", [item["action"] for item in every])
        changed = next(item for item in every if item["action"] == "DETAILS_CHANGED")
        self.assertEqual(changed["detail"], "Changed title")
        self.assertEqual(self.history("?show=opened").data["count"], 1)
        self.assertEqual([item["title"] for item in self.history("?q=Evaluation").data["results"]], ["Evaluation"])

    def test_sharing_and_settings_changes_read_plainly(self):
        self.client.force_authenticate(self.supervisor)
        self.client.put(f"/api/documents/{self.evaluation['id']}/sharing/", {"supervisors": True, "panel": False, "coordinator": False}, format="json")
        sharing = self.history("?show=changes").data["results"][0]
        self.assertEqual(sharing["detail"], "Now shared with supervisors")
        self.client.force_authenticate(self.office)
        thesis_type = Document.objects.get(pk=self.thesis["id"]).doc_type
        self.client.patch(f"/api/documents/types/{thesis_type.pk}/", {"sharePanel": False}, format="json")
        settings = self.history("?show=settings").data["results"][0]
        self.assertEqual(
            (settings["actionLabel"], settings["title"], settings["detail"]),
            ("Document type changed", "Thesis", "Changed who can see it; 1 student file now follows the new sharing"),
        )

    def test_only_the_office_reads_the_history(self):
        for user in (self.supervisor, self.coordinator, self.ali.user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/documents/history/").status_code, 403)
        self.assertIn("show", self.history("?show=everything").data)
        office_view = self.detail(self.office, self.thesis).data
        self.assertEqual([item["action"] for item in office_view["history"]], ["UPLOADED"])
        self.assertNotIn("history", self.detail(self.ali.user, self.thesis).data)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="fsktm-documents-storage-"))
class StorageCheckTests(DocumentPeople, ArchiveClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def run_check(self, *args):
        out = StringIO()
        call_command("check_document_storage", *args, stdout=out)
        return out.getvalue()

    def test_missing_and_left_over_files(self):
        cache.clear()
        self.made(self.ali.user, "thesis", "Kept")
        gone = self.made(self.ali.user, "research-proposal", "Gone")
        version = DocumentVersion.objects.get(document_id=gone["id"])
        Path(version.file.path).unlink()
        folder = Path(settings.MEDIA_ROOT) / "documents" / "2020" / "01"
        folder.mkdir(parents=True, exist_ok=True)
        old = folder / "old.pdf"
        old.write_bytes(b"%PDF-1.4")
        hour_ago = time.time() - 7200
        os.utime(old, (hour_ago, hour_ago))
        fresh = folder / "fresh.pdf"
        fresh.write_bytes(b"%PDF-1.4")

        report = self.run_check()
        self.assertIn(f"Missing: {version.file.name}", report)
        self.assertIn("Left over: documents/2020/01/old.pdf", report)
        self.assertIn("Checked 2 stored file(s): 1 missing, 2 left over.", report)
        report = self.run_check("--remove-orphans")
        self.assertIn("2 left over, 1 removed", report)
        self.assertEqual((old.exists(), fresh.exists()), (False, True))
