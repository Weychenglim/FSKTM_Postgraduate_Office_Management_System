"""Spelling and grammar fixes for the imported FAQ entries (faq/proofreading.py).
Only entries that still have the wording from the PDF change, and each change
is kept in the knowledge base history."""
from django.db import migrations

from faq.proofreading import apply_fixes

SOURCE = "a spelling and grammar check"


def fix(apps, schema_editor):
    FaqEntry = apps.get_model("faq", "FaqEntry")
    FaqChange = apps.get_model("faq", "FaqChange")
    for entry, fields in apply_fixes(FaqEntry.objects.all()):
        FaqChange.objects.create(
            entry=entry, question=entry.question, action="EDITED", actor_name="System", details={"fields": fields, "source": SOURCE}
        )


class Migration(migrations.Migration):
    dependencies = [("faq", "0003_reference_documents")]

    operations = [migrations.RunPython(fix, migrations.RunPython.noop)]
