from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0023_project_stage_corrections"),
    ]

    operations = [
        migrations.AddField(
            model_name="lecturer",
            name="programme",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
