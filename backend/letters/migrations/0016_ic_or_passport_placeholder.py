from django.db import migrations

SWAPS = (
    ("| IC/Passport Number | {{PASSPORT_NUMBER}} |", "| IC/Passport Number | {{IC_OR_PASSPORT}} |"),
    ("| No. K/P / Pasport | {{PASSPORT_NUMBER}} |", "| No. K/P / Pasport | {{IC_OR_PASSPORT}} |"),
)


def use_ic_or_passport(apps, schema_editor):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    for template in LetterTemplate.objects.all():
        content, content_ms = template.content or "", template.content_ms or ""
        for old, new in SWAPS:
            content, content_ms = content.replace(old, new), content_ms.replace(old, new)
        if (content, content_ms) != (template.content or "", template.content_ms or ""):
            template.content, template.content_ms = content, content_ms
            template.save(update_fields=["content", "content_ms"])


def back_to_passport(apps, schema_editor):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    for template in LetterTemplate.objects.all():
        content, content_ms = template.content or "", template.content_ms or ""
        for old, new in SWAPS:
            content, content_ms = content.replace(new, old), content_ms.replace(new, old)
        if (content, content_ms) != (template.content or "", template.content_ms or ""):
            template.content, template.content_ms = content, content_ms
            template.save(update_fields=["content", "content_ms"])


class Migration(migrations.Migration):
    dependencies = [("letters", "0015_letter_audience")]

    operations = [migrations.RunPython(use_ic_or_passport, back_to_passport)]
