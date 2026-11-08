from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("announcements", "0006_deadlinereminderrun_deadlineemaildelivery"),
    ]

    operations = [
        migrations.AddField(
            model_name="announcement",
            name="also_targets",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
