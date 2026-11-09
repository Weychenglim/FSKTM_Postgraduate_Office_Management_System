"""Copy pre-publication calendars after PostgreSQL has committed deferred indexes."""
from django.db import migrations
from django.utils import timezone
import hashlib
import json


def preserve_existing_calendars(apps, schema_editor):
    Timeline = apps.get_model('dashboard', 'SemesterTimeline')
    Entry = apps.get_model('dashboard', 'SemesterTimelineEntry')
    alias = schema_editor.connection.alias
    excluded = {'id', 'timeline', 'created_at', 'updated_at', 'source_entry_id'}
    fields = [f.attname for f in Entry._meta.fields if f.name not in excluded]
    # Preserve current and historical published calendars; Draft semesters stay private.
    for draft in Timeline.objects.using(alias).filter(is_active=True,
            academic_semester__isnull=False).exclude(academic_semester__lifecycle_status='DRAFT').iterator():
        entries = Entry.objects.using(alias).filter(timeline=draft).order_by('display_order', 'level', 'step', 'pk')
        rows = list(entries.values(*fields))
        digest = hashlib.sha256(json.dumps(rows, default=str, sort_keys=True).encode()).hexdigest()
        snapshot = Timeline.objects.using(alias).create(academic_semester_id=draft.academic_semester_id,
            semester=draft.semester, session=draft.session, source_filename=draft.source_filename,
            uploaded_by_id=draft.uploaded_by_id, is_active=False, is_published=True,
            published_at=timezone.now(), content_digest=digest)
        Entry.objects.using(alias).bulk_create([Entry(timeline=snapshot, source_entry_id=pk, **row)
            for pk, row in zip(entries.values_list('pk', flat=True), rows)])


def remove_publication_copies(apps, schema_editor):
    apps.get_model('dashboard', 'SemesterTimeline').objects.using(schema_editor.connection.alias).filter(
        is_active=False, published_at__isnull=False).delete()


class Migration(migrations.Migration):
    dependencies = [('dashboard', '0009_calendar_publication')]
    operations = [migrations.RunPython(preserve_existing_calendars, remove_publication_copies)]
