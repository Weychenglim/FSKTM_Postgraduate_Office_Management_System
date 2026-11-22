from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('appointments', '0021_supervisor_document_setup')]

    operations = [
        migrations.AddField(
            model_name='studentresearchprofile',
            name='approved_intent_changes',
            field=models.JSONField(blank=True, default=dict, editable=False),
        ),
    ]
