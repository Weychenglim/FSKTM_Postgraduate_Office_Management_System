"""Sample templates for the supervisor and panel appointment letters, so a
coordinator's approval issues a confirmation letter straight away. They are
added only when the office has no template for that kind of letter, and the
office replaces the wording once the faculty's own letter is ready. They use
only details the system always has, so no letter waits for the office."""
from django.db import migrations

SAMPLE_NOTE = "Sample wording set up by the system. Replace it with the faculty's own letter."

TEMPLATES = [
    {
        "purpose": "SUPERVISOR_APPOINTMENT",
        "name": "Supervisor Appointment Confirmation Letter",
        "reference_prefix": "UMF/PG/SV",
        "content": (
            "**CONFIRMATION OF SUPERVISOR APPOINTMENT**\n"
            "\n"
            "This is to confirm that the supervisor named below has been appointed for the student below, as approved by the Programme Coordinator.\n"
            "\n"
            "| Student | {{STUDENT_NAME}} |\n"
            "| Matric Number | {{STUDENT_ID}} |\n"
            "| Programme | {{PROGRAMME_NAME}} |\n"
            "| Research Title | {{RESEARCH_TITLE}} |\n"
            "| Supervisor | {{SUPERVISOR_NAME}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Effective From | {{APPOINTMENT_DATE}} |\n"
            "| Approved By | {{COORDINATOR_NAME}}, Programme Coordinator, on {{APPROVED_DATE}} |\n"
            "\n"
            "The supervisor will guide the student's research and follow the student's progress each semester until the student completes the programme, or until the Faculty changes this appointment.\n"
            "\n"
            "Please keep this letter for your records."
        ),
        "content_ms": (
            "**PENGESAHAN PELANTIKAN PENYELIA**\n"
            "\n"
            "Adalah disahkan bahawa penyelia yang dinamakan di bawah telah dilantik bagi pelajar berikut, sebagaimana yang diluluskan oleh Penyelaras Program.\n"
            "\n"
            "| Nama Pelajar | {{STUDENT_NAME}} |\n"
            "| No. Matrik | {{STUDENT_ID}} |\n"
            "| Program | {{PROGRAMME_NAME}} |\n"
            "| Tajuk Penyelidikan | {{RESEARCH_TITLE}} |\n"
            "| Penyelia | {{SUPERVISOR_NAME}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Berkuat Kuasa Mulai | {{APPOINTMENT_DATE}} |\n"
            "| Diluluskan Oleh | {{COORDINATOR_NAME}}, Penyelaras Program, pada {{APPROVED_DATE}} |\n"
            "\n"
            "Penyelia akan membimbing penyelidikan pelajar dan memantau kemajuan pelajar setiap semester sehingga pelajar menamatkan program, atau sehingga Fakulti mengubah pelantikan ini.\n"
            "\n"
            "Sila simpan surat ini untuk rujukan."
        ),
    },
    {
        "purpose": "PANEL_APPOINTMENT",
        "name": "Panel Appointment Confirmation Letter",
        "reference_prefix": "UMF/PG/PNL",
        "content": (
            "**CONFIRMATION OF PANEL MEMBER APPOINTMENT**\n"
            "\n"
            "This is to confirm that the panel member named below has been appointed for the student below, as approved by the Programme Coordinator.\n"
            "\n"
            "| Student | {{STUDENT_NAME}} |\n"
            "| Matric Number | {{STUDENT_ID}} |\n"
            "| Programme | {{PROGRAMME_NAME}} |\n"
            "| Research Title | {{RESEARCH_TITLE}} |\n"
            "| Panel Member | {{PANEL_NAME}} |\n"
            "| Supervisor | {{SUPERVISOR_NAME}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Effective From | {{APPOINTMENT_DATE}} |\n"
            "| Approved By | {{COORDINATOR_NAME}}, Programme Coordinator, on {{APPROVED_DATE}} |\n"
            "\n"
            "The panel member will evaluate the student's research project together with the supervisor, until the student completes the programme, or until the Faculty changes this appointment.\n"
            "\n"
            "Please keep this letter for your records."
        ),
        "content_ms": (
            "**PENGESAHAN PELANTIKAN AHLI PANEL**\n"
            "\n"
            "Adalah disahkan bahawa ahli panel yang dinamakan di bawah telah dilantik bagi pelajar berikut, sebagaimana yang diluluskan oleh Penyelaras Program.\n"
            "\n"
            "| Nama Pelajar | {{STUDENT_NAME}} |\n"
            "| No. Matrik | {{STUDENT_ID}} |\n"
            "| Program | {{PROGRAMME_NAME}} |\n"
            "| Tajuk Penyelidikan | {{RESEARCH_TITLE}} |\n"
            "| Ahli Panel | {{PANEL_NAME}} |\n"
            "| Penyelia | {{SUPERVISOR_NAME}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Berkuat Kuasa Mulai | {{APPOINTMENT_DATE}} |\n"
            "| Diluluskan Oleh | {{COORDINATOR_NAME}}, Penyelaras Program, pada {{APPROVED_DATE}} |\n"
            "\n"
            "Ahli panel akan menilai projek penyelidikan pelajar bersama penyelia sehingga pelajar menamatkan program, atau sehingga Fakulti mengubah pelantikan ini.\n"
            "\n"
            "Sila simpan surat ini untuk rujukan."
        ),
    },
]


def add_samples(apps, schema_editor):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    for sample in TEMPLATES:
        if LetterTemplate.objects.filter(purpose=sample["purpose"]).exists():
            continue
        LetterTemplate.objects.create(
            **sample,
            letter_type="Academic Certification",
            status="Active",
            description=SAMPLE_NOTE,
            modified_by="System",
        )


def remove_samples(apps, schema_editor):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    for sample in TEMPLATES:
        LetterTemplate.objects.filter(name=sample["name"], purpose=sample["purpose"], modified_by="System").delete()


class Migration(migrations.Migration):
    dependencies = [("letters", "0009_seed_recipients_and_questions")]

    operations = [migrations.RunPython(add_samples, remove_samples)]
