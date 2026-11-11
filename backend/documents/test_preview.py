import io
import os
import zipfile
from unittest import mock

from django.core.cache import cache
from PIL import Image
from rest_framework.test import APITestCase

from .fixtures import TEST_MEDIA, DocumentPeople, image_bytes, office_bytes, pdf_bytes
from .models import Document, DocumentEvent
from .previews import docx_text
from .test_access import DocumentClient

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


@TEST_MEDIA
class PreviewTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.thesis = self.made(self.ali.user, "final-research-report", "Thesis", content=pdf_bytes(3))
        self.photo = self.made(self.ali.user, "supporting-document", "Photo", name="photo.png", content=image_bytes("PNG", size=(3000, 1500)))
        self.notes = self.made(self.ali.user, "supporting-document", "Notes", name="notes.docx", content=office_bytes("docx"))
        self.sheet = self.made(self.office, "staff-document", "Sheet", name="sheet.xlsx", content=office_bytes("xlsx"))

    def get(self, user, path):
        self.client.force_authenticate(user)
        return self.client.get(path)

    def test_pdf_pages_come_back_as_pictures(self):
        info = self.get(self.supervisor, f"/api/documents/{self.thesis['id']}/preview/").data
        self.assertEqual((info["kind"], info["available"], info["pageCount"]), ("PDF", True, 3))
        page = self.get(self.supervisor, f"/api/documents/{self.thesis['id']}/preview/pages/2/")
        self.assertEqual((page.status_code, page["Content-Type"]), (200, "image/png"))
        self.assertTrue(page.content.startswith(PNG_SIGNATURE))
        self.assertEqual(page["Cache-Control"], "private, no-store")
        with Image.open(io.BytesIO(page.content)) as picture:
            self.assertEqual(picture.size[0], 1100)
        self.assertEqual(self.get(self.supervisor, f"/api/documents/{self.thesis['id']}/preview/pages/4/").status_code, 404)
        self.assertEqual(self.get(self.supervisor, f"/api/documents/{self.thesis['id']}/preview/pages/0/").status_code, 404)
        self.assertTrue(DocumentEvent.objects.filter(action="PREVIEWED", actor=self.supervisor).exists())

    def test_images_are_scaled_down(self):
        info = self.get(self.ali.user, f"/api/documents/{self.photo['id']}/preview/").data
        self.assertEqual((info["kind"], info["pageCount"]), ("IMAGE", 1))
        picture = self.get(self.ali.user, f"/api/documents/{self.photo['id']}/preview/pages/1/")
        with Image.open(io.BytesIO(picture.content)) as image:
            self.assertEqual(image.size, (1600, 800))
        self.assertEqual(self.get(self.ali.user, f"/api/documents/{self.photo['id']}/preview/pages/2/").status_code, 404)

    def test_word_shows_text_and_other_kinds_explain(self):
        info = self.get(self.ali.user, f"/api/documents/{self.notes['id']}/preview/").data
        self.assertEqual((info["kind"], info["text"], info["truncated"]), ("DOCX", "Hello", False))
        with mock.patch("documents.previews.MAX_TEXT", 3):
            self.assertEqual(docx_text(office_bytes("docx")), ("Hel", True))
        sheet = self.get(self.office, f"/api/documents/{self.sheet['id']}/preview/").data
        self.assertEqual((sheet["available"], sheet["reason"]), (False, "Preview isn't available for this file type. Download it to open."))
        self.assertEqual(self.get(self.office, f"/api/documents/{self.sheet['id']}/preview/pages/1/").status_code, 404)

    def test_previews_follow_the_view_right(self):
        for path in (f"/api/documents/{self.thesis['id']}/preview/", f"/api/documents/{self.thesis['id']}/preview/pages/1/"):
            self.assertEqual(self.get(self.outsider, path).status_code, 404)
            self.assertEqual(self.get(self.bella.user, path).status_code, 404)

    def test_missing_stored_files_are_reported(self):
        os.remove(Document.objects.get(pk=self.thesis["id"]).current_version.file.path)
        response = self.get(self.ali.user, f"/api/documents/{self.thesis['id']}/preview/pages/1/")
        self.assertEqual((response.status_code, response.data["code"]), (404, "file_missing"))


@TEST_MEDIA
class ZipDownloadTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.thesis = self.made(self.ali.user, "final-research-report", "Thesis", name="report.pdf", content=pdf_bytes(2))
        self.letter = self.made(self.chen.user, "supporting-document", "Letter", name="report.pdf", content=pdf_bytes(3))
        self.rubric = self.made(self.office, "staff-document", "Rubric", name="rubric.docx", content=office_bytes("docx"))

    def post(self, user, ids):
        self.client.force_authenticate(user)
        return self.client.post("/api/documents/download-zip/", {"ids": ids}, format="json")

    def test_the_zip_holds_each_file_under_its_student_and_type(self):
        response = self.post(self.office, [self.thesis["id"], self.letter["id"], self.rubric["id"]])
        self.assertEqual(response.status_code, 200)
        self.assertRegex(response["Content-Disposition"], r'attachment; filename="documents-\d{8}-\d{4}\.zip"')
        archive = zipfile.ZipFile(io.BytesIO(b"".join(response.streaming_content)))
        names = archive.namelist()
        self.assertEqual(names, [
            f"{self.ali.matric_no}/final-research-report/{self.thesis['reference']} report.pdf",
            f"{self.chen.matric_no}/supporting-document/{self.letter['reference']} report.pdf",
            f"STAFF/staff-document/{self.rubric['reference']} rubric.docx",
        ])
        self.assertEqual(DocumentEvent.objects.filter(action="DOWNLOADED", details__bulk=True).count(), 3)

    def test_all_or_nothing(self):
        response = self.post(self.supervisor, [self.thesis["id"], self.letter["id"]])
        self.assertEqual((response.status_code, response.data["detail"]), (404, "Some selected files are not available."))
        self.assertEqual(self.post(self.supervisor, [self.thesis["id"], 999999]).status_code, 404)
        self.assertEqual(self.post(self.supervisor, [self.thesis["id"]]).status_code, 200)

    def test_limits(self):
        self.assertEqual(self.post(self.office, []).status_code, 400)
        self.assertEqual(self.post(self.office, list(range(1, 52))).status_code, 400)
        self.assertEqual(self.post(self.office, ["x"]).status_code, 400)
        with mock.patch("documents.views.MAX_ZIP_BYTES", 10):
            self.assertIn("100 MB", self.post(self.office, [self.thesis["id"]]).data["ids"][0])
