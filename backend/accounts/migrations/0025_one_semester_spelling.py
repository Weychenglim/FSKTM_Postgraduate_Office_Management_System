from django.db import migrations

from accounts.semesters import stored_label


def one_spelling(apps, schema_editor):
    Student = apps.get_model("accounts", "Student")
    StudentRegistry = apps.get_model("accounts", "StudentRegistry")
    for student in Student.objects.exclude(intake_semester=""):
        label = stored_label(student.intake_semester)
        if label != student.intake_semester:
            student.intake_semester = label
            student.save(update_fields=["intake_semester"])
    for registry in StudentRegistry.objects.exclude(current_semester=""):
        label = stored_label(registry.current_semester)
        if label != registry.current_semester:
            registry.current_semester = label
            registry.save(update_fields=["current_semester"])


class Migration(migrations.Migration):
    dependencies = [("accounts", "0024_lecturer_programme")]

    operations = [migrations.RunPython(one_spelling, migrations.RunPython.noop)]
