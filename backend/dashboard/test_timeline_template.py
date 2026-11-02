from datetime import date
from io import BytesIO
from types import SimpleNamespace

from django.test import SimpleTestCase
from openpyxl import load_workbook

from .excel import TEMPLATE_HEADERS, build_template_workbook, parse_timeline_workbook


class TimelineTemplateTests(SimpleTestCase):
    def setUp(self):
        self.semester = SimpleNamespace(starts_on=date(2026, 10, 1), ends_on=date(2027, 3, 1))
        self.content = build_template_workbook(self.semester)
        self.workbook = load_workbook(BytesIO(self.content))

    def test_template_examples_round_trip_and_use_panel(self):
        rows, errors = parse_timeline_workbook(BytesIO(self.content))
        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1]["action_owner"], "Student / Supervisor / Panel")
        self.assertEqual(rows[0]["target_roles"], ["STUDENT", "LECTURER"])
        self.assertEqual(rows[2]["action_owner"], "Office Staff")
        self.assertEqual(rows[2]["target_roles"], ["OFFICE_STAFF"])
        for row in rows:
            self.assertGreaterEqual(row["deadline_start"], self.semester.starts_on)
            self.assertLessEqual(row["deadline_end"], self.semester.ends_on)
            self.assertEqual(row["activity_code"], "")
            self.assertEqual(row["period_id"], "")

    def test_instructions_are_not_imported_even_when_saved_as_active_sheet(self):
        self.workbook.active = 1
        stream = BytesIO()
        self.workbook.save(stream)
        stream.seek(0)
        rows, errors = parse_timeline_workbook(stream)
        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 3)

    def test_field_help_and_spreadsheet_entry_assistance(self):
        sheet = self.workbook["Timeline"]
        self.assertEqual([cell.value for cell in sheet[1]], TEMPLATE_HEADERS)
        self.assertEqual(len(TEMPLATE_HEADERS), 7)
        self.assertTrue(all(header not in TEMPLATE_HEADERS for header in ["Week Label", "Activity Code", "Period ID"]))
        self.assertEqual(sheet.freeze_panes, "C2")
        self.assertTrue(all(cell.comment for cell in sheet[1]))
        self.assertEqual(sheet["E2"].number_format, "yyyy-mm-dd")
        self.assertTrue(sheet["C2"].alignment.wrap_text)
        self.assertEqual(len(sheet.data_validations.dataValidation), 2)
        guide = " ".join(str(cell.value or "") for row in self.workbook["Instructions"] for cell in row)
        self.assertNotIn("not Examiner", guide)
        self.assertIn("Responsible parties in Create/Edit", guide)
        for phrase in ["REPLACES", "examples", "P1 = Research Project 1", "P2 = Research Project 2", "does not control visibility", "OFFICE_STAFF", "Periods & deadlines", "no separate Publish step"]:
            self.assertIn(phrase, guide)

    def test_instructions_leave_viewport_available_for_scrolling(self):
        guide = self.workbook["Instructions"]
        self.assertIsNone(guide.freeze_panes)
        self.assertIsNone(guide.sheet_view.pane)
        self.assertFalse(guide.protection.sheet)
        self.assertTrue(self.workbook.views[0].showVerticalScroll)
