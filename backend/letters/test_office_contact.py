from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase

from .pdf_export import ADDRESS_LINES, MALAY_ADDRESS_LINES

FRONTEND = Path(settings.BASE_DIR).parent / "frontend" / "src" / "constants" / "office.ts"


class OfficeContactTests(SimpleTestCase):
    def test_letters_print_the_one_office_contact(self):
        line = f"{settings.OFFICE_PHONE}  |  {settings.OFFICE_EMAIL}"
        self.assertEqual(ADDRESS_LINES[-1], line)
        self.assertEqual(MALAY_ADDRESS_LINES[-1], line)

    def test_the_portal_screens_use_the_same_contact(self):
        screens = FRONTEND.read_text(encoding="utf-8")
        self.assertIn(f"phone: '{settings.OFFICE_PHONE}'", screens)
        self.assertIn(f"email: '{settings.OFFICE_EMAIL}'", screens)
