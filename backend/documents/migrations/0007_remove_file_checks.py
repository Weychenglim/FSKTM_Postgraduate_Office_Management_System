from django.db import migrations, models
from django.db.models import Q


def clear_check_history(apps, schema_editor):
    apps.get_model("documents", "DocumentEvent").objects.filter(action__in=["ACCEPTED", "RETURNED"]).delete()
    apps.get_model("announcements", "Notification").objects.filter(
        Q(event_key__startswith="documents:accepted:") | Q(event_key__startswith="documents:returned:")
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('announcements', '0008_announcement_target_students'),
        ('documents', '0006_submissions'),
    ]

    operations = [
        migrations.RunPython(clear_check_history, migrations.RunPython.noop),
        migrations.RemoveIndex(
            model_name='document',
            name='documents_d_check_s_0d3623_idx',
        ),
        migrations.RemoveField(
            model_name='document',
            name='check_reason',
        ),
        migrations.RemoveField(
            model_name='document',
            name='check_status',
        ),
        migrations.RemoveField(
            model_name='document',
            name='checked_at',
        ),
        migrations.RemoveField(
            model_name='document',
            name='checked_by',
        ),
        migrations.RemoveField(
            model_name='documenttype',
            name='needs_check',
        ),
        migrations.AlterField(
            model_name='documentevent',
            name='action',
            field=models.CharField(choices=[('UPLOADED', 'Uploaded'), ('VERSION_ADDED', 'Added a new version'), ('DETAILS_CHANGED', 'Changed the details'), ('SHARING_CHANGED', 'Changed who it is shared with'), ('ARCHIVED', 'Archived'), ('RESTORED', 'Restored'), ('LINKED', 'Linked a record'), ('UNLINKED', 'Removed a record link'), ('PREVIEWED', 'Opened'), ('DOWNLOADED', 'Downloaded'), ('DELETED', 'Deleted')], max_length=24),
        ),
    ]
