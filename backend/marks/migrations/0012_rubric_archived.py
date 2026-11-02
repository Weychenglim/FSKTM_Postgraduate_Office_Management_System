from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("marks", "0011_lecturer_write_reliability")]

    operations = [
        migrations.AddField(
            model_name="rubric", name="is_archived",
            field=models.BooleanField(default=False),
        ),
    ]
