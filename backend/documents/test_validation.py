import io
from unittest import mock

from django.test import SimpleTestCase, override_settings
from PIL import Image
from reportlab.pdfgen import canvas

from .fixtures import image_bytes, office_bytes, pdf_bytes, upload
from .models import DocumentType
from .validation import UploadRejected, check_upload, clean_name, title_from_name

EVERYTHING = DocumentType(
    code="everything", label="Everything", allowed_kinds=["PDF", "DOCX", "IMAGE", "XLSX", "PPTX"]
)
THESIS = DocumentType(code="final-research-report", label="Thesis", allowed_kinds=["PDF", "DOCX"])


def check(name, content, doc_type=EVERYTHING, staff=True):
    return check_upload(upload(name, content), doc_type=doc_type, staff=staff)


@override_settings(DOCUMENT_MAX_UPLOAD_BYTES=10 * 1024 * 1024)
class AcceptedFileTests(SimpleTestCase):
    def test_each_kind_passes(self):
        self.assertEqual(check("report.pdf", pdf_bytes(2)).page_count, 2)
        self.assertEqual(check("notes.docx", office_bytes("docx")).kind, "DOCX")
        self.assertEqual(check("marks.xlsx", office_bytes("xlsx")).kind, "XLSX")
        self.assertEqual(check("talk.pptx", office_bytes("pptx")).kind, "PPTX")
        self.assertEqual(check("photo.png", image_bytes("PNG")).kind, "IMAGE")
        photo = check("photo.JPEG", image_bytes("JPEG"))
        self.assertEqual((photo.kind, photo.extension, photo.content_type), ("IMAGE", ".jpg", "image/jpeg"))

    def test_external_hyperlinks_are_fine(self):
        rels = ('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" '
                'Target="https://fsktm.um.edu.my" TargetMode="External"/></Relationships>')
        self.assertEqual(check("links.docx", office_bytes("docx", extra_files={"word/_rels/document.xml.rels": rels})).kind, "DOCX")

    def test_names_are_cleaned_and_titles_come_from_them(self):
        self.assertEqual(clean_name("C:\\fake\\path\\my<bad>:name?.pdf"), "my_bad__name_.pdf")
        self.assertEqual(clean_name("../../etc/passwd.pdf"), "passwd.pdf")
        self.assertEqual(len(clean_name("a" * 300 + ".pdf")), 150)
        self.assertTrue(clean_name("a" * 300 + ".pdf").endswith(".pdf"))
        self.assertEqual(title_from_name("Thesis_draft__3.pdf"), "Thesis draft 3")
        self.assertEqual(title_from_name("ethics-approval.pdf"), "Ethics approval")
        self.assertEqual(title_from_name("minutes 2026-11-11.docx"), "Minutes 2026-11-11")

    def test_images_lose_hidden_data_and_turn_upright(self):
        exif = Image.Exif()
        exif[0x010E] = "secret description"
        exif[0x0112] = 6
        stored = check("photo.jpg", image_bytes("JPEG", size=(40, 20), exif=exif.tobytes()))
        with Image.open(io.BytesIO(stored.content)) as image:
            self.assertNotIn(0x010E, image.getexif())
            self.assertEqual(image.size, (20, 40))


@override_settings(DOCUMENT_MAX_UPLOAD_BYTES=10 * 1024 * 1024)
class RefusedFileTests(SimpleTestCase):
    def refused(self, name, content, message, **kwargs):
        with self.assertRaises(UploadRejected) as caught:
            check(name, content, **kwargs)
        self.assertIn(message, str(caught.exception))

    def test_general_refusals(self):
        self.refused("empty.pdf", b"", "empty")
        self.refused("noextension", pdf_bytes(), "name ending in its type")
        self.refused("script.exe", b"MZ", "Unsupported file type")
        self.refused("report.exe.pdf", pdf_bytes(), "hides another file type")
        self.refused("photo.png", image_bytes(), "Thesis accepts PDF or Word (.docx).", doc_type=THESIS)

    def test_students_cannot_send_excel_or_powerpoint(self):
        self.refused("marks.xlsx", office_bytes("xlsx"), "Everything accepts PDF, Word (.docx) or JPG or PNG", staff=False)

    @override_settings(DOCUMENT_MAX_UPLOAD_BYTES=1024 * 1024)
    def test_oversized(self):
        self.refused("big.pdf", b"%PDF-" + b"0" * (1024 * 1024 + 10), "The maximum is 1 MB")

    def test_pdf_refusals(self):
        self.refused("fake.pdf", image_bytes(), "not a valid PDF")
        script = (b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R /OpenAction 3 0 R >> endobj\n"
                  b"2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n"
                  b"3 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n")
        self.refused("script.pdf", script, "scripts or attachments")
        self.refused("broken.pdf", b"%PDF-1.4 nothing here %%EOF", "could not be opened")
        buffer = io.BytesIO()
        locked = canvas.Canvas(buffer, encrypt="secret")
        locked.drawString(100, 100, "Locked")
        locked.save()
        self.refused("locked.pdf", buffer.getvalue(), "password-protected")

    def test_binary_stream_content_is_not_mistaken_for_scripts(self):
        content = pdf_bytes()
        content = content.replace(b"%%EOF", b"4 0 obj << /Length 8 >>\nstream\n/JS(x)()\nendstream\nendobj\n%%EOF", 1)
        self.assertEqual(check("binary.pdf", content).kind, "PDF")

    def test_pdf_page_limit(self):
        with mock.patch("documents.pdfium.MAX_PAGES", 1):
            self.refused("long.pdf", pdf_bytes(2), "The most allowed is 1")

    def test_office_refusals(self):
        self.refused("macro.docx", office_bytes("docx", extra_files={"word/vbaProject.bin": b"x"}), "macros")
        self.refused("macro.xlsx", office_bytes("xlsx", extra_files={"xl/macrosheets/sheet1.xml": "<x/>"}), "macros")
        self.refused("activex.pptx", office_bytes("pptx", extra_files={"ppt/activeX/activeX1.xml": "<x/>"}), "macros")
        self.refused("ole.xlsx", office_bytes("xlsx", extra_files={"xl/embeddings/oleObject1.bin": b"x"}), "macros")
        self.refused("links.xlsx", office_bytes("xlsx", extra_files={"xl/externalLinks/externalLink1.xml": "<x/>"}), "links to other files")
        macro_type = "application/vnd.ms-word.document.macroEnabled.main+xml"
        self.refused("macro-type.docx", office_bytes("docx", content_type=macro_type), "macros")
        template = "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml"
        self.refused("template.docx", office_bytes("docx", content_type=template), "Templates")
        remote = ('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" '
                  'Target="https://evil.example/t.dotm" TargetMode="External"/></Relationships>')
        self.refused("remote.docx", office_bytes("docx", extra_files={"word/_rels/settings.xml.rels": remote}), "outside it")
        self.refused("escape.docx", office_bytes("docx", extra_files={"../escape.txt": "x"}), "unsafe parts")
        self.refused("locked.docx", b"\xd0\xcf\x11\xe0" + b"0" * 100, "password-protected")
        self.refused("broken.docx", b"PK\x03\x04 not really a zip", "damaged")
        self.refused("missing.docx", office_bytes("xlsx"), "not a normal .docx")

    def test_encrypted_entries_and_too_many_parts(self):
        content = bytearray(office_bytes("docx"))
        central = content.find(b"PK\x01\x02")
        content[central + 8] |= 0x01
        self.refused("encrypted.docx", bytes(content), "password-protected")
        with mock.patch("documents.office_files.MAX_ENTRIES", 2):
            self.refused("many.docx", office_bytes("docx"), "too many parts")

    def test_expansion_limit(self):
        with mock.patch("documents.office_files.MAX_UNCOMPRESSED_BYTES", 100):
            self.refused("bomb.docx", office_bytes("docx", extra_files={"word/big.xml": "<x>" + "a" * 500 + "</x>"}), "expands too much")

    def test_image_refusals(self):
        self.refused("photo.jpg", image_bytes("PNG"), "not really a JPG")
        with mock.patch("documents.validation.MAX_IMAGE_PIXELS", 100):
            self.refused("huge.png", image_bytes("PNG", size=(20, 20)), "too large")
        self.refused("broken.png", b"\x89PNG\r\n\x1a\nnope", "could not be opened")
