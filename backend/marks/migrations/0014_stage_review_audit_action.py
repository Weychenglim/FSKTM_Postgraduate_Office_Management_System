from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('marks', '0013_publication_safeguards')]

    operations = [migrations.AlterField(
        model_name='evaluationtasklifecycleaudit', name='action',
        field=models.CharField(max_length=16, choices=[('PAUSED', 'Paused'),
            ('RESUMED', 'Resumed'), ('RETIRED', 'Retired'),
            ('STAGE_REVIEW', 'Registration stage review'),
            ('STAGE_RESOLVED', 'Registration stage review resolved')]),
    )]
