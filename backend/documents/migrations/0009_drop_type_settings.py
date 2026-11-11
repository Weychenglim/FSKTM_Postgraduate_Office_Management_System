from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0008_fixed_document_types'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='settingschange',
            name='actor',
        ),
        migrations.RemoveField(
            model_name='settingschange',
            name='doc_type',
        ),
        migrations.RemoveField(
            model_name='document',
            name='follows_type',
        ),
        migrations.RemoveField(
            model_name='document',
            name='share_coordinator',
        ),
        migrations.RemoveField(
            model_name='document',
            name='share_panel',
        ),
        migrations.RemoveField(
            model_name='document',
            name='share_supervisors',
        ),
        migrations.RemoveField(
            model_name='documenttype',
            name='required',
        ),
        migrations.RemoveField(
            model_name='documenttype',
            name='required_due_note',
        ),
        migrations.RemoveField(
            model_name='documenttype',
            name='required_programmes',
        ),
        migrations.AlterField(
            model_name='documenttype',
            name='group',
            field=models.CharField(choices=[('RP1', 'Research Project 1'), ('RP2', 'Research Project 2'), ('SUPPORTING', 'Supporting Documents'), ('STAFF', 'Staff Documents')], default='SUPPORTING', max_length=32),
        ),
        migrations.DeleteModel(
            name='RequiredReminder',
        ),
        migrations.DeleteModel(
            name='SettingsChange',
        ),
    ]
