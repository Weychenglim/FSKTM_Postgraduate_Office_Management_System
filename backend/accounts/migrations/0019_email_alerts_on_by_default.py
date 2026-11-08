from django.db import migrations, models


def switch_on(apps, schema_editor):
    apps.get_model("accounts", "User").objects.filter(email_notifications=False).update(email_notifications=True)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0018_lecturer_resigned_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="email_notifications",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(switch_on, migrations.RunPython.noop),
    ]
