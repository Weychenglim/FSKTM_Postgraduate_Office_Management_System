"""Signature lines for the Malay page, and the appointment letters' sample
wording in the faculty's letter style, addressed to the lecturer appointed.

The samples change only while they still have the wording the system set up;
a sample the office has edited is left alone. The Student Confirmation Letter
gets the Malay title it prints in Maya."""
import importlib

from django.db import migrations, models

FACULTY = "Faculty of Computer Science and Information Technology"
FACULTY_MS = "Fakulti Sains Komputer dan Teknologi Maklumat"
CONTACT = "If you require any further information, please do not hesitate to contact the Postgraduate Office."
CONTACT_MS = "Sekiranya Tuan/Puan memerlukan maklumat lanjut, sila hubungi Pejabat Pascasiswazah."
SIGNATORY = {
    "signatory_name": "Dean",
    "signatory_title": FACULTY,
    "signatory_name_ms": "Dekan",
    "signatory_title_ms": FACULTY_MS,
}

WORDING = {
    "SUPERVISOR_APPOINTMENT": {
        "content": (
            "{{SUPERVISOR_NAME}}\n"
            f"{FACULTY}\n"
            "Universiti Malaya\n"
            "\n"
            "Dear {{SUPERVISOR_NAME}},\n"
            "\n"
            "**CONFIRMATION OF APPOINTMENT AS SUPERVISOR**\n"
            "\n"
            "We are pleased to inform you that you have been appointed as the supervisor of the following student. The details are as follows:\n"
            "\n"
            "| Name | {{STUDENT_NAME}} |\n"
            "| Matric Number | {{STUDENT_ID}} |\n"
            "| Programme | {{PROGRAMME_NAME}} |\n"
            "| Research Title | {{RESEARCH_TITLE}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Effective Date | {{APPOINTMENT_DATE}} |\n"
            "| Approved By | {{COORDINATOR_NAME}}, Programme Coordinator |\n"
            "| Date Approved | {{APPROVED_DATE}} |\n"
            "\n"
            "As the supervisor, you will guide the student's research project and follow the student's progress each semester until the student completes the programme, or until the Faculty changes this appointment.\n"
            "\n"
            f"{CONTACT}\n"
            "\n"
            "Thank you."
        ),
        "content_ms": (
            "{{SUPERVISOR_NAME}}\n"
            f"{FACULTY_MS}\n"
            "Universiti Malaya\n"
            "\n"
            "Tuan/Puan,\n"
            "\n"
            "**PENGESAHAN PELANTIKAN SEBAGAI PENYELIA**\n"
            "\n"
            "Sukacita dimaklumkan bahawa Tuan/Puan telah dilantik sebagai penyelia bagi pelajar berikut. Butirannya adalah seperti berikut:\n"
            "\n"
            "| Nama | {{STUDENT_NAME}} |\n"
            "| No. Matrik | {{STUDENT_ID}} |\n"
            "| Program | {{PROGRAMME_NAME}} |\n"
            "| Tajuk Penyelidikan | {{RESEARCH_TITLE}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Tarikh Berkuat Kuasa | {{APPOINTMENT_DATE}} |\n"
            "| Diluluskan Oleh | {{COORDINATOR_NAME}}, Penyelaras Program |\n"
            "| Tarikh Kelulusan | {{APPROVED_DATE}} |\n"
            "\n"
            "Sebagai penyelia, Tuan/Puan akan membimbing projek penyelidikan pelajar dan memantau kemajuan pelajar pada setiap semester sehingga pelajar menamatkan program, atau sehingga Fakulti meminda pelantikan ini.\n"
            "\n"
            f"{CONTACT_MS}\n"
            "\n"
            "Sekian, terima kasih."
        ),
    },
    "PANEL_APPOINTMENT": {
        "content": (
            "{{PANEL_NAME}}\n"
            f"{FACULTY}\n"
            "Universiti Malaya\n"
            "\n"
            "Dear {{PANEL_NAME}},\n"
            "\n"
            "**CONFIRMATION OF APPOINTMENT AS PANEL MEMBER**\n"
            "\n"
            "We are pleased to inform you that you have been appointed as the panel member for the following student's research project. The details are as follows:\n"
            "\n"
            "| Name | {{STUDENT_NAME}} |\n"
            "| Matric Number | {{STUDENT_ID}} |\n"
            "| Programme | {{PROGRAMME_NAME}} |\n"
            "| Research Title | {{RESEARCH_TITLE}} |\n"
            "| Supervisor | {{SUPERVISOR_NAME}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Effective Date | {{APPOINTMENT_DATE}} |\n"
            "| Approved By | {{COORDINATOR_NAME}}, Programme Coordinator |\n"
            "| Date Approved | {{APPROVED_DATE}} |\n"
            "\n"
            "As the panel member, you will evaluate the student's research project together with the supervisor until the student completes the programme, or until the Faculty changes this appointment.\n"
            "\n"
            f"{CONTACT}\n"
            "\n"
            "Thank you."
        ),
        "content_ms": (
            "{{PANEL_NAME}}\n"
            f"{FACULTY_MS}\n"
            "Universiti Malaya\n"
            "\n"
            "Tuan/Puan,\n"
            "\n"
            "**PENGESAHAN PELANTIKAN SEBAGAI AHLI PANEL**\n"
            "\n"
            "Sukacita dimaklumkan bahawa Tuan/Puan telah dilantik sebagai ahli panel bagi projek penyelidikan pelajar berikut. Butirannya adalah seperti berikut:\n"
            "\n"
            "| Nama | {{STUDENT_NAME}} |\n"
            "| No. Matrik | {{STUDENT_ID}} |\n"
            "| Program | {{PROGRAMME_NAME}} |\n"
            "| Tajuk Penyelidikan | {{RESEARCH_TITLE}} |\n"
            "| Penyelia | {{SUPERVISOR_NAME}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Tarikh Berkuat Kuasa | {{APPOINTMENT_DATE}} |\n"
            "| Diluluskan Oleh | {{COORDINATOR_NAME}}, Penyelaras Program |\n"
            "| Tarikh Kelulusan | {{APPROVED_DATE}} |\n"
            "\n"
            "Sebagai ahli panel, Tuan/Puan akan menilai projek penyelidikan pelajar bersama penyelia sehingga pelajar menamatkan program, atau sehingga Fakulti meminda pelantikan ini.\n"
            "\n"
            f"{CONTACT_MS}\n"
            "\n"
            "Sekian, terima kasih."
        ),
    },
    "CO_SUPERVISOR_APPOINTMENT": {
        "content": (
            "{{CO_SUPERVISOR_NAME}}\n"
            f"{FACULTY}\n"
            "Universiti Malaya\n"
            "\n"
            "Dear {{CO_SUPERVISOR_NAME}},\n"
            "\n"
            "**CONFIRMATION OF APPOINTMENT AS SUPPORTING SUPERVISOR**\n"
            "\n"
            "We are pleased to inform you that you have been appointed as a supporting supervisor of the following student, together with the main supervisor named below. The details are as follows:\n"
            "\n"
            "| Name | {{STUDENT_NAME}} |\n"
            "| Matric Number | {{STUDENT_ID}} |\n"
            "| Programme | {{PROGRAMME_NAME}} |\n"
            "| Research Title | {{RESEARCH_TITLE}} |\n"
            "| Main Supervisor | {{SUPERVISOR_NAME}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Effective Date | {{APPOINTMENT_DATE}} |\n"
            "| Approved By | {{COORDINATOR_NAME}}, Programme Coordinator |\n"
            "| Date Approved | {{APPROVED_DATE}} |\n"
            "\n"
            "As a supporting supervisor, you will work with the main supervisor to guide the student's research project until the student completes the programme, or until the Faculty changes this appointment.\n"
            "\n"
            f"{CONTACT}\n"
            "\n"
            "Thank you."
        ),
        "content_ms": (
            "{{CO_SUPERVISOR_NAME}}\n"
            f"{FACULTY_MS}\n"
            "Universiti Malaya\n"
            "\n"
            "Tuan/Puan,\n"
            "\n"
            "**PENGESAHAN PELANTIKAN SEBAGAI PENYELIA BERSAMA**\n"
            "\n"
            "Sukacita dimaklumkan bahawa Tuan/Puan telah dilantik sebagai penyelia bersama bagi pelajar berikut, bersama-sama penyelia utama yang dinamakan di bawah. Butirannya adalah seperti berikut:\n"
            "\n"
            "| Nama | {{STUDENT_NAME}} |\n"
            "| No. Matrik | {{STUDENT_ID}} |\n"
            "| Program | {{PROGRAMME_NAME}} |\n"
            "| Tajuk Penyelidikan | {{RESEARCH_TITLE}} |\n"
            "| Penyelia Utama | {{SUPERVISOR_NAME}} |\n"
            "| Semester | {{SEMESTER}} |\n"
            "| Tarikh Berkuat Kuasa | {{APPOINTMENT_DATE}} |\n"
            "| Diluluskan Oleh | {{COORDINATOR_NAME}}, Penyelaras Program |\n"
            "| Tarikh Kelulusan | {{APPROVED_DATE}} |\n"
            "\n"
            "Sebagai penyelia bersama, Tuan/Puan akan bekerjasama dengan penyelia utama untuk membimbing projek penyelidikan pelajar sehingga pelajar menamatkan program, atau sehingga Fakulti meminda pelantikan ini.\n"
            "\n"
            f"{CONTACT_MS}\n"
            "\n"
            "Sekian, terima kasih."
        ),
    },
}


def _first_samples():
    first = importlib.import_module("letters.migrations.0010_sample_appointment_templates")
    supporting = importlib.import_module("letters.migrations.0012_sample_supporting_supervisor_template")
    return {sample["purpose"]: sample for sample in [*first.TEMPLATES, supporting.SAMPLE]}


def _swap(apps, old, new, signatory):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    for purpose, before in old.items():
        after = new[purpose]
        LetterTemplate.objects.filter(
            purpose=purpose,
            content=before["content"],
            content_ms=before["content_ms"],
        ).update(content=after["content"], content_ms=after["content_ms"], **signatory)


def use_new_wording(apps, schema_editor):
    _swap(apps, _first_samples(), WORDING, SIGNATORY)
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    LetterTemplate.objects.filter(signatory_name="Dean / Director", signatory_name_ms="").update(signatory_name_ms="Dekan / Pengarah")


def use_first_wording(apps, schema_editor):
    _swap(apps, WORDING, _first_samples(), {"signatory_name": "", "signatory_title": ""})


class Migration(migrations.Migration):
    dependencies = [("letters", "0013_choice_item_country")]

    operations = [
        migrations.AddField(
            model_name="lettertemplate",
            name="signatory_name_ms",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="lettertemplate",
            name="signatory_title_ms",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="generatedletter",
            name="signatory_name_ms",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="generatedletter",
            name="signatory_title_ms",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.RunPython(use_new_wording, use_first_wording),
    ]
