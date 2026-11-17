"""Reference documents for the chatbot (C5): upload, text, passages, search
and who may open them."""
import io
import zipfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from documents.fixtures import CONTENT_TYPES, MAIN, ROOT_RELS, TEST_MEDIA, pdf_bytes

from .encoder import reset_encoder
from .models import FaqCategory, FaqChange, FaqDocument, FaqEntry, FaqPassage, FaqQuestion
from .reading import WORDS_PER_PASSAGE, passages
from .search import clear_index

DOCUMENTS = "/api/faq/documents/"
THESIS_PAGE = (
    "Thesis submission. Students submit the thesis to the faculty office before the deadline in the academic calendar. "
    "The dissertation must follow the faculty template and include the signed declaration form. "
)
FEES_PAGE = "Tuition fee payment. Fees are paid each semester through MAYA before registration closes. " * 3


def text_pdf(*pages):
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    for page in pages:
        writer = pdf.beginText(40, 800)
        sentence = ""
        for word in page.split():
            if len(sentence) + len(word) > 90:
                writer.textLine(sentence)
                sentence = ""
            sentence += word + " "
        writer.textLine(sentence)
        pdf.drawText(writer)
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def docx(*paragraphs):
    part, main_type, _ = MAIN["docx"]
    body = "".join(f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>" for text in paragraphs)
    xml = f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>'
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", CONTENT_TYPES.format(part=part, content_type=main_type, extra=""))
        archive.writestr("_rels/.rels", ROOT_RELS.format(part=part))
        archive.writestr(part, xml)
    return buffer.getvalue()


@TEST_MEDIA
@override_settings(FAQ_ENCODER="faq.fake_encoder.FakeEncoder", FAQ_DOCUMENT_MATCH=0.6)
class DocumentBase(APITestCase):
    def setUp(self):
        cache.clear()
        reset_encoder()
        clear_index()
        self.addCleanup(reset_encoder)
        self.addCleanup(clear_index)
        self.office = User.objects.create_user(email="faq-docs@example.test", password="pw", full_name="Docs Office", role=User.Role.OFFICE_ADMIN, is_staff=True)
        self.student = User.objects.create_user(email="faq-docs-s@example.test", password="pw", full_name="Docs Student", role=User.Role.STUDENT)
        self.client.force_authenticate(self.office)

    def upload(self, name, content, title=""):
        return self.client.post(DOCUMENTS, {"file": SimpleUploadedFile(name, content), "title": title}, format="multipart")


class UploadTests(DocumentBase):
    def test_a_pdf_is_read_into_passages_with_pages(self):
        response = self.upload("Postgraduate_Handbook_2026.pdf", text_pdf(THESIS_PAGE, FEES_PAGE))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["title"], "Postgraduate Handbook 2026")
        self.assertEqual((response.data["status"], response.data["pages"], response.data["kind"]), ("READY", 2, "PDF"))
        self.assertRegex(response.data["size"], r"^\d+ KB$")
        document = FaqDocument.objects.get()
        self.assertEqual(list(document.passages.values_list("page", flat=True)), [1, 2])
        self.assertIn("faculty template", document.passages.first().text)
        change = FaqChange.objects.get(document=document)
        self.assertEqual((change.action, change.details), ("DOCUMENT_ADDED", {"file": "Postgraduate_Handbook_2026.pdf", "passages": 2}))

    def test_a_scanned_pdf_has_no_text(self):
        response = self.upload("scan.pdf", pdf_bytes(2), title="Old scanned guide")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual((response.data["status"], response.data["passages"]), ("NO_TEXT", 0))

    def test_word_text_is_read(self):
        response = self.upload("guide.docx", docx("Thesis submission happens at the faculty office.", THESIS_PAGE))
        self.assertEqual(response.data["status"], "READY", response.data)
        passage = FaqPassage.objects.get()
        self.assertIsNone(passage.page)
        self.assertTrue(passage.text.startswith("Thesis submission happens at the faculty office."))

    def test_only_pdf_and_word(self):
        response = self.upload("notes.txt", b"plain text")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unsupported file type", response.data["file"][0])
        self.assertEqual(self.client.post(DOCUMENTS, {"title": "x"}, format="multipart").data["file"], ["Choose a file to upload."])
        broken = self.upload("broken.pdf", b"%PDF-1.4 not really")
        self.assertEqual(broken.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(FaqDocument.objects.exists())

    def test_rename_replace_archive_restore(self):
        document_id = self.upload("guide.pdf", text_pdf(THESIS_PAGE)).data["id"]
        renamed = self.client.patch(f"{DOCUMENTS}{document_id}/", {"title": "Thesis guide"}, format="json")
        self.assertEqual(renamed.data["title"], "Thesis guide")
        self.assertEqual(self.client.patch(f"{DOCUMENTS}{document_id}/", {"title": " "}, format="json").status_code, 400)
        old_file = FaqDocument.objects.get().file.name
        with self.captureOnCommitCallbacks(execute=True):
            replaced = self.client.post(f"{DOCUMENTS}{document_id}/replace/", {"file": SimpleUploadedFile("fees.pdf", text_pdf(FEES_PAGE))}, format="multipart")
        self.assertEqual(replaced.status_code, status.HTTP_200_OK, replaced.data)
        self.assertEqual(replaced.data["fileName"], "fees.pdf")
        self.assertIn("Tuition fee", FaqPassage.objects.get().text)
        self.assertFalse(FaqDocument.objects.get().file.storage.exists(old_file))
        self.assertEqual(self.client.post(f"{DOCUMENTS}{document_id}/archive/").data["archived"], True)
        self.assertEqual(self.client.post(f"{DOCUMENTS}{document_id}/restore/").data["archived"], False)
        actions = list(FaqChange.objects.order_by("pk").values_list("action", flat=True))
        self.assertEqual(actions, ["DOCUMENT_ADDED", "DOCUMENT_RENAMED", "DOCUMENT_REPLACED", "DOCUMENT_ARCHIVED", "DOCUMENT_RESTORED"])

    def test_only_the_office_manages_documents(self):
        document_id = self.upload("guide.pdf", text_pdf(THESIS_PAGE)).data["id"]
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(DOCUMENTS).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.upload("x.pdf", text_pdf(THESIS_PAGE)).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post(f"{DOCUMENTS}{document_id}/archive/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(FaqDocument.objects.count(), 1)


class SearchTests(DocumentBase):
    def setUp(self):
        super().setUp()
        self.category = FaqCategory.objects.create(name="Thesis", position=1)
        self.document_id = self.upload("Thesis Guide.pdf", text_pdf(FEES_PAGE, THESIS_PAGE)).data["id"]
        self.client.force_authenticate(self.student)

    def ask(self, question):
        return self.client.post("/api/faq/ask/", {"question": question}, format="json")

    def test_with_no_entry_a_passage_answers(self):
        response = self.ask("When do I submit my thesis?")
        self.assertEqual(response.data["outcome"], "DOCUMENT", response.data)
        self.assertEqual(response.data["passage"]["title"], "Thesis Guide")
        self.assertEqual(response.data["passage"]["page"], 2)
        self.assertEqual(response.data["passage"]["fileName"], "Thesis Guide.pdf")
        self.assertIn("Thesis submission", response.data["passage"]["text"])
        saved = FaqQuestion.objects.get()
        self.assertEqual((saved.outcome, saved.document_id, saved.entry), ("DOCUMENT", int(self.document_id), None))

    def test_a_clear_entry_wins_over_documents(self):
        FaqEntry.objects.create(question="How do I submit my thesis?", answer="Through the faculty office.", category=self.category, status=FaqEntry.Status.PUBLISHED)
        response = self.ask("When do I submit my thesis?")
        self.assertEqual(response.data["outcome"], "ANSWERED")
        self.assertIsNone(response.data["passage"])

    def test_archived_and_unreadable_documents_are_not_searched(self):
        FaqDocument.objects.filter(pk=self.document_id).update(archived=True)
        self.assertEqual(self.ask("When do I submit my thesis?").data["outcome"], "NO_MATCH")
        FaqDocument.objects.filter(pk=self.document_id).update(archived=False, status=FaqDocument.Status.NO_TEXT)
        self.assertEqual(self.ask("When do I submit my thesis?").data["outcome"], "NO_MATCH")

    def test_a_weak_passage_is_not_shown(self):
        self.assertEqual(self.ask("Where is the cafeteria?").data["outcome"], "NO_MATCH")

    @override_settings(FAQ_SEARCH="keywords")
    def test_keyword_search_needs_two_words_to_agree(self):
        reset_encoder()
        clear_index()
        self.assertEqual(self.ask("thesis").data["outcome"], "NO_MATCH")
        self.assertEqual(self.ask("thesis submission deadline").data["outcome"], "DOCUMENT")

    @override_settings(FAQ_STRONG_MATCH=0.9, FAQ_POSSIBLE_MATCH=0.5)
    def test_a_better_passage_answers_when_the_faq_only_loosely_matches(self):
        clear_index()
        loose = FaqEntry.objects.create(
            question="How much is the thesis printing fee?", answer="RM 20 at the library.", category=self.category, status=FaqEntry.Status.PUBLISHED,
        )
        response = self.ask("When do I submit my thesis?")
        self.assertEqual(response.data["outcome"], "DOCUMENT", response.data)
        self.assertIn("Thesis submission", response.data["passage"]["text"])
        self.assertEqual([link["id"] for link in response.data["related"]], [str(loose.pk)])


class FileTests(DocumentBase):
    def test_who_can_open_a_document(self):
        ready = self.upload("guide.pdf", text_pdf(THESIS_PAGE)).data["id"]
        scanned = self.upload("scan.pdf", pdf_bytes(1)).data["id"]
        office = self.client.get(f"{DOCUMENTS}{scanned}/file/")
        self.assertEqual(office.status_code, status.HTTP_200_OK)
        self.assertIn('attachment; filename="scan.pdf"', office["Content-Disposition"])
        self.client.force_authenticate(self.student)
        opened = self.client.get(f"{DOCUMENTS}{ready}/file/")
        self.assertEqual(opened.status_code, status.HTTP_200_OK)
        self.assertEqual(opened["X-Content-Type-Options"], "nosniff")
        self.assertTrue(b"".join(opened.streaming_content).startswith(b"%PDF"))
        self.assertEqual(self.client.get(f"{DOCUMENTS}{scanned}/file/").status_code, status.HTTP_404_NOT_FOUND)
        FaqDocument.objects.filter(pk=ready).update(archived=True)
        self.assertEqual(self.client.get(f"{DOCUMENTS}{ready}/file/").status_code, status.HTTP_404_NOT_FOUND)
        lecturer = User.objects.create_user(email="faq-docs-l@example.test", password="pw", full_name="L", role=User.Role.LECTURER)
        self.client.force_authenticate(lecturer)
        self.assertEqual(self.client.get(f"{DOCUMENTS}{scanned}/file/").status_code, status.HTTP_403_FORBIDDEN)


class PassageSplitTests(APITestCase):
    def test_passages_end_at_a_sentence_and_never_cross_a_page(self):
        sentence = "This sentence has exactly eight words in it. "
        long_page = sentence * 40
        found = passages([(1, long_page), (2, "Short page two.")])
        self.assertTrue(all(len(text.split()) <= WORDS_PER_PASSAGE for _, text in found))
        self.assertTrue(all(text.endswith(".") for _, text in found))
        self.assertEqual(found[-1], (2, "Short page two."))
        self.assertEqual(sum(len(text.split()) for page, text in found if page == 1), 320)

