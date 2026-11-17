from django.db import migrations

from accounts.semesters import stored_label


def one_spelling(apps, schema_editor):
    Announcement = apps.get_model("announcements", "Announcement")
    for announcement in Announcement.objects.exclude(target_intakes=[]):
        labels = list(dict.fromkeys(stored_label(intake) for intake in announcement.target_intakes))
        if labels != announcement.target_intakes:
            announcement.target_intakes = labels
            announcement.save(update_fields=["target_intakes"])


class Migration(migrations.Migration):
    dependencies = [
        ("announcements", "0008_announcement_target_students"),
        ("accounts", "0025_one_semester_spelling"),
    ]

    operations = [migrations.RunPython(one_spelling, migrations.RunPython.noop)]
