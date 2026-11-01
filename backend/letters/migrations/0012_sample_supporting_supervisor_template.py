"""A sample template for the supporting supervisor appointment letter, added
when the office has none, like the supervisor and panel samples."""
from django.db import migrations

SAMPLE = {
    "purpose": "CO_SUPERVISOR_APPOINTMENT",
    "name": "Supporting Supervisor Appointment Confirmation Letter",
    "reference_prefix": "UMF/PG/CSV",
    "content": (
        "**CONFIRMATION OF SUPPORTING SUPERVISOR APPOINTMENT**\n"
        "\n"
        "This is to confirm that the supporting supervisor named below has been appointed for the student below, as approved by the Programme Coordinator.\n"
        "\n"
        "| Student | {{STUDENT_NAME}} |\n"
        "| Matric Number | {{STUDENT_ID}} |\n"
        "| Programme | {{PROGRAMME_NAME}} |\n"
        "| Research Title | {{RESEARCH_TITLE}} |\n"
        "| Supporting Supervisor | {{CO_SUPERVISOR_NAME}} |\n"
        "| Main Supervisor | {{SUPERVISOR_NAME}} |\n"
        "| Semester | {{SEMESTER}} |\n"
        "| Effective From | {{APPOINTMENT_DATE}} |\n"
        "| Approved By | {{COORDINATOR_NAME}}, Programme Coordinator, on {{APPROVED_DATE}} |\n"
        "\n"
        "The supporting supervisor will help the main supervisor guide the student's research, until the student completes the programme, or until the Faculty changes this appointment.\n"
        "\n"
        "Please keep this letter for your records."
    ),
    "content_ms": (
        "**PENGESAHAN PELANTIKAN PENYELIA BERSAMA**\n"
        "\n"
        "Adalah disahkan bahawa penyelia bersama yang dinamakan di bawah telah dilantik bagi pelajar berikut, sebagaimana yang diluluskan oleh Penyelaras Program.\n"
        "\n"
        "| Nama Pelajar | {{STUDENT_NAME}} |\n"
        "| No. Matrik | {{STUDENT_ID}} |\n"
        "| Program | {{PROGRAMME_NAME}} |\n"
        "| Tajuk Penyelidikan | {{RESEARCH_TITLE}} |\n"
        "| Penyelia Bersama | {{CO_SUPERVISOR_NAME}} |\n"
        "| Penyelia Utama | {{SUPERVISOR_NAME}} |\n"
        "| Semester | {{SEMESTER}} |\n"
        "| Berkuat Kuasa Mulai | {{APPOINTMENT_DATE}} |\n"
        "| Diluluskan Oleh | {{COORDINATOR_NAME}}, Penyelaras Program, pada {{APPROVED_DATE}} |\n"
        "\n"
        "Penyelia bersama akan membantu penyelia utama membimbing penyelidikan pelajar sehingga pelajar menamatkan program, atau sehingga Fakulti mengubah pelantikan ini.\n"
        "\n"
        "Sila simpan surat ini untuk rujukan."
    ),
}


def add_sample(apps, schema_editor):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    if LetterTemplate.objects.filter(purpose=SAMPLE["purpose"]).exists():
        return
    LetterTemplate.objects.create(
        **SAMPLE,
        letter_type="Academic Certification",
        status="Active",
        description="Sample wording set up by the system. Replace it with the faculty's own letter.",
        modified_by="System",
    )


def remove_sample(apps, schema_editor):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    LetterTemplate.objects.filter(name=SAMPLE["name"], purpose=SAMPLE["purpose"], modified_by="System").delete()


class Migration(migrations.Migration):
    dependencies = [("letters", "0011_co_supervisor_letters")]

    operations = [migrations.RunPython(add_sample, remove_sample)]
