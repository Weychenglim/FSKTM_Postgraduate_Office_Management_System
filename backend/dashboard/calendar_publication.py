"""Immutable publication copies; editable timeline IDs and period ownership stay stable."""
import hashlib
import json

from django.core import signing
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import SemesterTimeline, SemesterTimelineEntry, TimelineAuditLog
from .timeline_import import fingerprint

SALT = 'dashboard.calendar.publish.v1'


def entry_values(timeline):
    excluded = {'id', 'timeline', 'created_at', 'updated_at', 'source_entry_id'}
    fields = [f.attname for f in SemesterTimelineEntry._meta.fields if f.name not in excluded]
    return list(timeline.entries.order_by('display_order', 'level', 'step', 'pk').values(*fields))


def content_digest(timeline):
    return hashlib.sha256(json.dumps(entry_values(timeline), default=str, sort_keys=True).encode()).hexdigest()


def publication_state(timeline, actor):
    semester = timeline.academic_semester
    published = SemesterTimeline.objects.filter(academic_semester=semester, is_published=True).first()
    return {
        'publishedAt': published.published_at if published else None,
        'publishedCount': published.entries.count() if published else 0,
        'hasUnpublishedChanges': published is None or published.content_digest != content_digest(timeline),
        'reviewToken': signing.dumps({'actor': actor.pk, 'semester': semester.pk,
            'state': fingerprint(semester)}, salt=SALT),
    }


@transaction.atomic
def publish_calendar(semester, actor, token):
    semester = type(semester).objects.select_for_update().get(pk=semester.pk)
    if semester.lifecycle_status not in {'DRAFT', 'ACTIVE'}:
        raise ValidationError('Calendar publication requires a Draft or Active semester.')
    if not isinstance(token, str):
        raise ValidationError('Reload and review the calendar before publishing.')
    try:
        payload = signing.loads(token, salt=SALT, max_age=15 * 60)
    except (signing.BadSignature, TypeError):
        raise ValidationError('Publication review expired or invalid. Reload and review the calendar.')
    if payload != {'actor': actor.pk, 'semester': semester.pk, 'state': fingerprint(semester, lock=True)}:
        raise ValidationError('The calendar or its periods changed. Reload and review before publishing.')
    draft = SemesterTimeline.objects.get(academic_semester=semester, is_active=True)
    rows = entry_values(draft)
    digest = content_digest(draft)
    previous = SemesterTimeline.objects.filter(academic_semester=semester, is_published=True)
    if previous.filter(content_digest=digest).exists():
        return draft
    # Retired copies preserve historical facts without owning live draft periods.
    # Keep the former link identity in the publication audit before releasing FKs.
    from .serializers import TimelineEntrySerializer
    retired_links = []
    for entry in SemesterTimelineEntry.objects.filter(timeline__in=previous).select_related('operational_period', 'marks_period'):
        if entry.linked_period:
            start, end = entry.projected_dates
            retired_links.append({'entryId': entry.pk, 'operationalPeriodId': entry.operational_period_id,
                'marksPeriodId': entry.marks_period_id, 'deadlineStart': start.isoformat(), 'deadlineEnd': end.isoformat()})
            entry.status = TimelineEntrySerializer().get_status(entry)
            entry.deadline_start, entry.deadline_end = start, end
            entry.operational_period = entry.marks_period = None
            entry.save(update_fields=['deadline_start', 'deadline_end', 'status', 'operational_period', 'marks_period'])
    previous.update(is_published=False)
    snapshot = SemesterTimeline.objects.create(academic_semester=semester,
        semester=draft.semester, session=draft.session, source_filename=draft.source_filename,
        uploaded_by=actor, is_active=False, is_published=True, published_at=timezone.now(), content_digest=digest)
    source_ids = draft.entries.order_by('display_order', 'level', 'step', 'pk').values_list('pk', flat=True)
    SemesterTimelineEntry.objects.bulk_create([SemesterTimelineEntry(timeline=snapshot,
        source_entry_id=source_id, **row) for source_id, row in zip(source_ids, rows)])
    TimelineAuditLog.objects.create(actor=actor, timeline=draft, action='PUBLISH',
        summary=f'Published calendar with {len(rows)} events.', before_values={'retiredPeriodLinks': retired_links},
        after_values={'publishedTimelineId': snapshot.pk, 'eventCount': len(rows)})
    return draft
