"""Registry import of files in the office's own layout (UC04): sheets, title
rows above the column names, English and Malay column names, column matches."""

import io
import json
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from openpyxl import Workbook
from rest_framework import status
from rest_framework.test import APITestCase

from . import registry_import
from .models import Student, StudentRegistry, User
from .programmes import APPROVED_PROGRAMMES
from .registry_columns import (
    FIELD_KEYS,
    KNOWN_NAMES,
    column_letter,
    field_for_header,
    normalise_header,
    suggest_mapping,
)

DS, CS, AI = APPROVED_PROGRAMMES
TITLE_ROWS = [["SENARAI PELAJAR BAHARU SARJANA (KERJA KURSUS)"], ["SESI 2026/2027 SEMESTER I"]]
MALAY_HEADER = ["Bil", "No. Matrik", "Nama Pelajar", "No. KP/Pasport", "Program", "E-mel", "No. Tel"]
DATA = [
    [1, "WQD260001", "NURUL HUDA BINTI KAMAL", "990101-14-5678", DS, "wqd260001@example.test", "012-3456789"],
    [2, "WQD260002", "LIM WEI JIE", "A12345678", CS, "wqd260002@example.test", None],
]
EXPECTED_MAPPING = {
    "student_id": 1,
    "full_name": 2,
    "programme": 4,
    "email": 5,
    "phone": 6,
    "intake": None,
    "current_semester": None,
}


def workbook_file(*sheets, name="smoke-extract.xlsx"):
    book = Workbook()
    for position, (title, rows) in enumerate(sheets):
        sheet = book.active if position == 0 else book.create_sheet()
        sheet.title = title
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    book.save(buffer)
    return SimpleUploadedFile(
        name,
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def maya_extract():
    return workbook_file(
        ("Nota", [["Extracted from Maya"], ["Do not edit"]]),
        ("Senarai", [*TITLE_ROWS, MALAY_HEADER, *DATA]),
    )


def text_file(text, name="smoke-list.csv"):
    return SimpleUploadedFile(name, text.encode("utf-8"), content_type="text/csv")


class ImportLayoutTests(APITestCase):
    def setUp(self):
        self.office = User.objects.create_user(
            email="layout-office@example.test",
            password="pw-office-7301",
            full_name="Layout Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.client.force_authenticate(self.office)

    def inspect(self, upload, options=None):
        data = {"file": upload}
        if options is not None:
            data["options"] = json.dumps(options)
        return self.client.post("/api/registry/students/import/inspect/", data, format="multipart")

    def preview(self, upload, options, dry_run=True):
        data = {"file": upload, "options": json.dumps(options)}
        if dry_run:
            data["dryRun"] = "true"
        return self.client.post("/api/registry/students/import/", data, format="multipart")

    # Inspect

    def test_inspect_finds_the_sheet_the_column_names_and_the_columns(self):
        response = self.inspect(maya_extract())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual((data["sheets"], data["sheet"], data["headerRow"]), (["Nota", "Senarai"], "Senarai", 3))
        self.assertEqual(data["mapping"], EXPECTED_MAPPING)
        self.assertEqual(data["ignoredColumns"], ["Bil", "No. KP/Pasport"])
        self.assertEqual(data["rowCount"], 2)
        self.assertFalse(data["layoutRecognised"])
        matric = data["columns"][1]
        self.assertEqual(
            (matric["letter"], matric["header"], matric["samples"], matric["suggestedField"]),
            ("B", "No. Matrik", ["WQD260001", "WQD260002"], "student_id"),
        )
        self.assertEqual(data["headerRowOptions"][0], {"row": 1, "preview": TITLE_ROWS[0][0]})
        self.assertEqual([field["key"] for field in data["fields"]], FIELD_KEYS)

    def test_our_template_is_recognised_so_the_match_step_can_be_skipped(self):
        template = text_file(
            "student_id,full_name,programme,email,phone,intake,current_semester\n"
            f"WGA260301,Aisyah,{DS},aisyah.layout@example.test,,2026/2027 Semester I,Semester I\n"
        )
        self.assertTrue(self.inspect(template).data["layoutRecognised"])
        titled = text_file(f"Intake list\nstudent_id,full_name,programme,email,phone\nWGA260302,B,{DS},b@example.test,\n")
        response = self.inspect(titled)
        self.assertEqual(response.data["headerRow"], 2)
        self.assertFalse(response.data["layoutRecognised"])

    def test_inspect_is_office_only_and_needs_a_file(self):
        lecturer = User.objects.create_user(
            email="layout-lecturer@example.test",
            password="pw-lect-7302",
            full_name="Layout Lecturer",
            role=User.Role.LECTURER,
        )
        self.assertEqual(self.client.post("/api/registry/students/import/inspect/", {}, format="multipart").status_code, 400)
        self.client.force_authenticate(lecturer)
        self.assertEqual(self.inspect(maya_extract()).status_code, status.HTTP_403_FORBIDDEN)

    # Preview and import with the confirmed matches

    def test_a_preview_reads_the_matched_columns_and_ignores_the_rest(self):
        response = self.preview(maya_extract(), {"sheet": "Senarai", "mapping": EXPECTED_MAPPING})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first, second = response.data["rows"]
        self.assertEqual(
            (first["line"], first["id"], first["name"], first["programme"], first["email"], first["phone"], first["status"]),
            (4, "WQD260001", "NURUL HUDA BINTI KAMAL", DS, "wqd260001@example.test", "012-3456789", "Ready"),
        )
        self.assertEqual((second["id"], second["phone"], second["status"]), ("WQD260002", "", "Ready"))
        # Columns the office did not match never reach the response.
        self.assertNotIn("990101-14-5678", json.dumps(response.data))

    def test_without_a_mapping_the_suggested_matches_are_used(self):
        response = self.preview(maya_extract(), {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["status"] for row in response.data["rows"]], ["Ready", "Ready"])

    def test_semicolon_and_tab_separated_files_are_read(self):
        for delimiter in (";", "\t"):
            body = delimiter.join(["No. Matrik", "Nama", "Program", "Emel"]) + "\n"
            body += delimiter.join(["WQD260010", "Tan, Mei Ling", AI, f"tan{len(delimiter)}@example.test"]) + "\n"
            response = self.preview(text_file(body), {})
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
            row = response.data["rows"][0]
            self.assertEqual((row["name"], row["programme"], row["status"]), ("Tan, Mei Ling", AI, "Ready"))

    def test_english_column_names_in_any_order(self):
        body = (
            "Email Address,Programme,Full Name,Student ID,Mobile No\n"
            f"farah.layout@example.test,{CS},Farah Aziz,WQD260020,013-1112222\n"
        )
        inspected = self.inspect(text_file(body)).data
        self.assertEqual(
            inspected["mapping"],
            {"student_id": 3, "full_name": 2, "programme": 1, "email": 0, "phone": 4, "intake": None, "current_semester": None},
        )
        self.assertTrue(inspected["layoutRecognised"])
        row = self.preview(text_file(body), {}).data["rows"][0]
        self.assertEqual((row["id"], row["name"], row["phone"], row["status"]), ("WQD260020", "Farah Aziz", "013-1112222", "Ready"))

    def test_a_field_two_columns_could_fill_stays_unmatched(self):
        body = f"Name,Nama,Student ID,Programme,Email\nA,B,WQD260030,{DS},a.layout@example.test\n"
        self.assertIsNone(self.inspect(text_file(body)).data["mapping"]["full_name"])
        response = self.preview(text_file(body), {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["mapping"], ["Choose a column for: Full name."])
        chosen = self.preview(text_file(body), {"mapping": {"student_id": 2, "full_name": 1, "programme": 3, "email": 4}})
        self.assertEqual(chosen.data["rows"][0]["name"], "B")

    def test_bad_options_are_refused_with_clear_messages(self):
        cases = [
            ({"mapping": {"surname": 1}}, "mapping", "Unknown field: surname."),
            ({"mapping": {**EXPECTED_MAPPING, "student_id": 25}}, "mapping", "Student ID: column Z is not in the file."),
            ({"mapping": {**EXPECTED_MAPPING, "full_name": 1}}, "mapping", "Column B is chosen for both Student ID and Full name."),
            ({"mapping": {"student_id": "B"}}, "mapping", "Each match must be a column number."),
            ({"headerRow": 40}, "headerRow", "Row 40 is empty or too far down. Choose one of the first rows."),
            ({"sheet": "Missing"}, "sheet", 'This workbook has no sheet called "Missing".'),
        ]
        for options, field, message in cases:
            with self.subTest(options=options):
                response = self.preview(maya_extract(), options)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(message, response.data[field])
        not_json = self.client.post(
            "/api/registry/students/import/",
            {"file": maya_extract(), "options": "{not json", "dryRun": "true"},
            format="multipart",
        )
        self.assertEqual(not_json.data, {"options": ["The import options could not be read."]})

    def test_the_column_name_row_can_be_chosen(self):
        body = f"student_id,full_name\nNo. Matrik,Nama,Program,Emel\nWQD260040,Siti,{DS},siti.layout@example.test\n"
        self.assertEqual(self.inspect(text_file(body)).data["headerRow"], 2)
        response = self.inspect(text_file(body), {"headerRow": 1})
        self.assertEqual(response.data["headerRow"], 1)
        self.assertEqual(response.data["rowCount"], 2)

    def test_intake_and_semester_are_saved(self):
        body = (
            "No. Matrik,Nama Pelajar,Program,E-mel,Sesi Kemasukan,Semester Semasa\n"
            f"WQD260050,Hafiz,{DS},hafiz.layout@example.test,2026/2027 Semester I,Semester I 2026/2027\n"
            f"WQD260051,Iman,{DS},iman.layout@example.test,{'x' * 40},\n"
        )
        response = self.preview(text_file(body), {}, dry_run=False)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        saved, too_long = response.data["rows"]
        self.assertEqual((saved["intake"], saved["semester"], saved["result"]), ("2026/2027 Semester I", "Semester I 2026/2027", "created"))
        self.assertEqual((too_long["status"], too_long["issue"]), ("Invalid Field", "intake is longer than 32 characters"))
        student = Student.objects.get(matric_no="WQD260050")
        self.assertEqual(student.intake_semester, "2026/2027 Semester I")
        self.assertEqual(StudentRegistry.objects.get(student=student).current_semester, "2026/2027 Semester I")

    def test_rows_after_title_rows_still_count_towards_the_limit(self):
        rows = [[f"WQD27000{index}", f"Student {index}", DS, f"s{index}.layout@example.test"] for index in range(4)]
        upload = workbook_file(("Senarai", [*TITLE_ROWS, ["No. Matrik", "Nama", "Program", "Emel"], *rows]))
        with mock.patch.object(registry_import, "MAX_IMPORT_ROWS", 3):
            response = self.preview(upload, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("more than 3 student rows", response.data["error"])

    def test_old_excel_files_get_a_save_as_message(self):
        response = self.inspect(SimpleUploadedFile("list.xls", b"\xd0\xcf\x11\xe0", content_type="application/vnd.ms-excel"))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("save it as .xlsx", response.data["error"])


class ColumnNameTests(SimpleTestCase):
    def test_names_are_compared_without_case_punctuation_or_spacing(self):
        self.assertEqual(normalise_header("  No. Matrik "), "no matrik")
        self.assertEqual(normalise_header("student_id"), "student id")
        self.assertEqual(field_for_header("E-mel"), "email")
        self.assertEqual(field_for_header("NAMA PELAJAR"), "full_name")
        self.assertEqual(field_for_header("current_semester"), "current_semester")

    def test_identity_document_columns_never_match_the_student_id(self):
        for name in ("ID", "No.", "No. KP", "IC", "Passport", "No. KP/Pasport"):
            self.assertIsNone(field_for_header(name), name)

    def test_each_known_name_belongs_to_one_field(self):
        seen = {}
        for field, names in KNOWN_NAMES.items():
            for name in names:
                self.assertNotIn(name, seen, f"{name!r} is listed for {seen.get(name)} and {field}")
                seen[name] = field
                self.assertEqual(normalise_header(name), name, f"{name!r} is not in normalised form")

    def test_the_template_columns_are_the_fields(self):
        self.assertEqual(registry_import.IMPORT_HEADERS, FIELD_KEYS)
        self.assertEqual(suggest_mapping(FIELD_KEYS), {key: index for index, key in enumerate(FIELD_KEYS)})

    def test_column_letters_follow_spreadsheets(self):
        self.assertEqual([column_letter(index) for index in (0, 25, 26, 51, 52)], ["A", "Z", "AA", "AZ", "BA"])
