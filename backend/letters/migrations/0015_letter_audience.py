from django.db import migrations, models

FINISHED = ("Completion Letter",)
INTERNATIONAL = ("Confirmation Letter for Student Pass Renewal", "Visa Support Letter")
DESCRIPTIONS = {
    "Embassy-ready documentation supporting a student visa application.": "Supports a student visa application at an embassy.",
    "Proof of degree fulfilment, issued after the viva.": "Confirms that the student has completed the programme.",
}


def set_sample_letters(apps, schema_editor):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    requests = LetterTemplate.objects.filter(purpose="REQUEST", audience="CURRENT")
    requests.filter(name__in=FINISHED).update(audience="FINISHED")
    requests.filter(name__in=INTERNATIONAL).update(audience="INTERNATIONAL")
    for old, new in DESCRIPTIONS.items():
        LetterTemplate.objects.filter(description=old).update(description=new)


def unset_sample_letters(apps, schema_editor):
    LetterTemplate = apps.get_model("letters", "LetterTemplate")
    for old, new in DESCRIPTIONS.items():
        LetterTemplate.objects.filter(description=new).update(description=old)


class Migration(migrations.Migration):

    dependencies = [
        ('letters', '0014_malay_signatory_and_sample_wording'),
    ]

    operations = [
        migrations.AddField(
            model_name='lettertemplate',
            name='audience',
            field=models.CharField(choices=[('CURRENT', 'Current students'), ('FINISHED', 'Students who have finished their studies'), ('INTERNATIONAL', 'International students')], default='CURRENT', max_length=16),
        ),
        migrations.RunPython(set_sample_letters, unset_sample_letters),
    ]
