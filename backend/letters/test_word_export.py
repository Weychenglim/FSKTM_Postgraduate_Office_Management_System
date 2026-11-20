"""The Word copy of an issued letter (FR-55): office staff only, same wording as the PDF."""
import io

from docx import Document
from rest_framework import status

from .models import GeneratedLetter
from .test_confirmation_letters import MAYBANK, ConfirmationLetterTestCase
from .test_letter_requests import REQUESTS
from .word_export import WORD_TYPE, build_letter_docx


def words_in(document):
    lines = [paragraph.text for paragraph in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            lines.append(" ".join(cell.text for cell in row.cells))
    return "\n".join(lines)


class WordExportTests(ConfirmationLetterTestCase):
    def word(self, letter, user=None):
        self.client.force_authenticate(user or self.office)
        return self.client.get(f"{REQUESTS}{letter.pk}/word/")

    def test_the_office_downloads_the_letter_in_english_and_malay(self):
        letter = self.issued_for(self.student("WRD001"), MAYBANK)
        response = self.word(letter)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], WORD_TYPE)
        self.assertIn(".docx", response["Content-Disposition"])
        self.assertIn("WRD001", response["Content-Disposition"])
        document = Document(io.BytesIO(response.content))
        text = words_in(document)
        self.assertIn(letter.reference_number, text)
        self.assertIn("STUDENT CONFIRMATION LETTER", text)
        self.assertIn("MALAYAN BANKING BERHAD (MAYBANK)", text)
        self.assertIn("SURAT PENGESAHAN PELAJAR", text)
        self.assertIn("Rujukan Kami", text)
        self.assertIn("Matric Number", text)
        self.assertNotIn("| Name", text)
        self.assertNotIn("**", text)
        self.assertEqual(document.element.xml.count('w:type="page"'), 1)

    def test_only_office_staff_get_the_word_file(self):
        owner = self.student("WRD002")
        letter = self.issued_for(owner, MAYBANK)
        other = self.student("WRD003")
        for user in (owner, other):
            self.assertEqual(self.word(letter, user).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{REQUESTS}{letter.pk}/word/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_only_an_issued_letter_can_be_downloaded(self):
        user = self.student("WRD004")
        pending = GeneratedLetter.objects.get(pk=self.ask_for(user, MAYBANK).data["id"])
        self.assertEqual(self.word(pending).status_code, status.HTTP_409_CONFLICT)
        letter = self.issued_for(self.student("WRD005"), MAYBANK)
        GeneratedLetter.objects.filter(pk=letter.pk).update(status=GeneratedLetter.Status.REVOKED)
        self.assertEqual(self.word(letter).status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.word(GeneratedLetter(pk=999999)).status_code, status.HTTP_404_NOT_FOUND)

    def test_the_markup_becomes_real_formatting(self):
        letter = self.issued_for(self.student("WRD006"), MAYBANK)
        letter.content = "To **whom** it may *concern*\nSecond line\n\n- First point\n- __Second__ point\n\n| Name | ALI |"
        letter.content_ms = ""
        document = Document(io.BytesIO(build_letter_docx(letter)))
        runs = {run.text: run for paragraph in document.paragraphs for run in paragraph.runs if run.text}
        self.assertTrue(runs["whom"].bold)
        self.assertTrue(runs["concern"].italic)
        self.assertTrue(runs["Second"].underline)
        bullets = [paragraph.text for paragraph in document.paragraphs if paragraph.style.name == "List Bullet"]
        self.assertEqual(bullets, ["First point", "Second point"])
        rows = [[cell.text for cell in row.cells] for table in document.tables for row in table.rows]
        self.assertIn(["Name", ":", "ALI"], rows)
        self.assertEqual(document.element.xml.count('w:type="page"'), 0)
