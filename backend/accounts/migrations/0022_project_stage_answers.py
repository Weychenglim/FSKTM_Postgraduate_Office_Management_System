from django.db import migrations, models

# PG Kit 2025/2026 and the Research Project timeline for Semester I 2026/2027.
RESEARCH_COURSES = {
    "MASTER OF DATA SCIENCE (COURSEWORK)": ("WQD7025", "Data Science Research Project"),
    "MASTER OF CYBER SECURITY (COURSEWORK)": ("WQE7023", "Cyber Security Research Project"),
    "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)": ("WQF7023", "Artificial Intelligence Research Project"),
}


def seed_research_courses(apps, schema_editor):
    ProgrammeRule = apps.get_model("accounts", "ProgrammeRule")
    for rule in ProgrammeRule.objects.filter(research_course_code=""):
        course = RESEARCH_COURSES.get(rule.programme.strip().upper())
        if course:
            rule.research_course_code, rule.research_course_name = course
            rule.save(update_fields=["research_course_code", "research_course_name"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0021_student_lifecycle"),
    ]

    operations = [
        migrations.AddField(
            model_name="programmerule",
            name="research_course_code",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.AddField(
            model_name="programmerule",
            name="research_course_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AlterField(
            model_name="projectregistration",
            name="source",
            field=models.CharField(
                choices=[("OFFICE", "Office"), ("LIST", "Office list"), ("STUDENT", "Student"), ("COORDINATOR", "Coordinator")],
                default="OFFICE",
                max_length=12,
            ),
        ),
        migrations.AlterField(
            model_name="projectregistration",
            name="stage",
            field=models.CharField(choices=[("P1", "P1"), ("P2", "P2"), ("NONE", "Not started")], max_length=4),
        ),
        migrations.RunPython(seed_research_courses, migrations.RunPython.noop),
    ]
