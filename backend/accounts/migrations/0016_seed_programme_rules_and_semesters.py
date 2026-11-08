from django.db import migrations

from accounts.semesters import seeded_semesters

HANDBOOK = "Postgraduate Handbook 2026/2027"
PROGRAMMES = [
    "MASTER OF DATA SCIENCE (COURSEWORK)",
    "MASTER OF CYBER SECURITY (COURSEWORK)",
    "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
]


def seed_rules(apps, schema_editor):
    ProgrammeRule = apps.get_model("accounts", "ProgrammeRule")
    for programme in PROGRAMMES:
        ProgrammeRule.objects.get_or_create(
            programme=programme,
            defaults={"min_semesters": 3, "special_counts": True, "max_semesters": 8, "source": HANDBOOK},
        )


def seed_semesters(apps, schema_editor):
    Student = apps.get_model("accounts", "Student")
    StudentRegistry = apps.get_model("accounts", "StudentRegistry")
    StudentSemester = apps.get_model("accounts", "StudentSemester")
    current = dict(StudentRegistry.objects.values_list("student_id", "current_semester"))
    rows = []
    for student in Student.objects.all():
        semesters = seeded_semesters(student.intake_semester, current.get(student.pk, ""))
        for index, semester in enumerate(semesters):
            on_leave = student.status == "Deferred" and index == len(semesters) - 1
            rows.append(
                StudentSemester(
                    student_id=student.pk,
                    session=semester.session,
                    term=semester.term,
                    outcome="LEAVE" if on_leave else "STUDIED",
                    note="From the intake and current semester",
                )
            )
    StudentSemester.objects.bulk_create(rows, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0015_semesters_and_programme_rules"),
    ]

    operations = [
        migrations.RunPython(seed_rules, migrations.RunPython.noop),
        migrations.RunPython(seed_semesters, migrations.RunPython.noop),
    ]
