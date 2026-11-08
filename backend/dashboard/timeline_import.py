"""Signed, non-mutating calendar workbook review and existing-link preservation."""
import hashlib
import json
from zoneinfo import ZoneInfo

from django.core import signing
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .excel import parse_timeline_workbook
from .models import SemesterTimeline, SemesterTimelineEntry
from .upload_security import validate_timeline_upload

PREVIEW_SALT = 'dashboard.timeline.preview.v1'
PREVIEW_MAX_AGE = 15 * 60
MALAYSIA = ZoneInfo('Asia/Kuala_Lumpur')


def fingerprint(semester, lock=False):
    from academics.models import OperationalPeriod
    from marks.models import EvaluationPeriod
    def values(query):
        if lock:
            query = query.select_for_update()
        return list(query.order_by('pk').values())
    timelines = SemesterTimeline.objects.filter(academic_semester=semester).filter(
        Q(is_active=True) | Q(is_published=True))
    state = {
        'semester': list(type(semester).objects.filter(pk=semester.pk).values()),
        'timelines': values(timelines),
        'entries': values(SemesterTimelineEntry.objects.filter(timeline__in=timelines)),
        'operations': values(OperationalPeriod.objects.filter(academic_semester=semester)),
        'marks': values(EvaluationPeriod.objects.filter(academic_semester=semester)),
        'today': timezone.localdate(timezone=MALAYSIA),
    }
    return hashlib.sha256(json.dumps(state, default=str, sort_keys=True).encode()).hexdigest()


def digest(upload):
    upload.seek(0)
    result = hashlib.sha256(upload.read()).hexdigest()
    upload.seek(0)
    return result


def prepare_rows(upload, semester, mode='ADD'):
    if mode not in {'ADD', 'REPLACE'}:
        raise ValidationError('Choose Add events or Replace calendar.')
    errors = validate_timeline_upload(upload)
    if errors:
        raise ValidationError(errors)
    rows, errors = parse_timeline_workbook(upload)
    if errors:
        raise ValidationError(errors)
    warnings = []
    today = timezone.localdate(timezone=MALAYSIA)
    current_links = list(SemesterTimelineEntry.objects.filter(
        timeline__academic_semester=semester, timeline__is_active=True,
    ).exclude(operational_period__isnull=True, marks_period__isnull=True)) if mode == 'REPLACE' else []
    preserved = set()
    for row in rows:
        code = row.pop('activity_code')
        period_id = row.pop('period_id')
        if code or period_id:
            raise ValidationError('Link events in Periods & deadlines, not through Excel import. Clear Activity Code and Period ID or download a fresh template.')
        for old in current_links:
            # Workbook order and exact facts make preservation explicit and deterministic.
            same = all(row[key] == getattr(old, key) for key in (
                'level', 'step', 'title', 'detail', 'action_owner', 'target_roles'))
            same = same and (row['deadline_start'], row['deadline_end']) == old.projected_dates
            if same:
                row['week_label'] = old.week_label
                row['operational_period'] = old.operational_period
                row['marks_period'] = old.marks_period
                preserved.add(old.pk)
        if row['deadline_end'] < today:
            warnings.append(f"{row['level']} step {row['step']}: dates have already ended.")
        if row['deadline_start'] < semester.starts_on or row['deadline_end'] > semester.ends_on:
            warnings.append(f"{row['level']} step {row['step']}: dates are outside the selected semester.")
    if any(old.pk not in preserved for old in current_links):
        raise ValidationError('Replacement would lose an existing period link. Keep the equivalent row or explicitly resolve its link before importing.')
    return rows, warnings


def display_rows(rows):
    return [{
        'level': row['level'], 'step': row['step'], 'title': row['title'],
        'detail': row['detail'], 'action': row['action_owner'],
        'deadlineStart': row['deadline_start'].isoformat(),
        'deadlineEnd': row['deadline_end'].isoformat(), 'targetRoles': row['target_roles'],
            } for row in rows]


@transaction.atomic
def create_preview(upload, semester, actor, mode='ADD'):
    semester = type(semester).objects.select_for_update().get(pk=semester.pk)
    if semester.lifecycle_status not in {"DRAFT", "ACTIVE"}:
        raise ValidationError("Timeline changes require a Draft or Active academic semester.")
    state = fingerprint(semester, lock=True)
    rows, warnings = prepare_rows(upload, semester, mode)
    existing = SemesterTimelineEntry.objects.filter(timeline__academic_semester=semester, timeline__is_active=True).count()
    token = signing.dumps({'actor': actor.pk, 'semester': semester.pk,
        'file': digest(upload), 'state': state, 'mode': mode}, salt=PREVIEW_SALT, compress=True)
    return {'previewToken': token, 'warnings': warnings, 'rows': display_rows(rows),
            'importedCount': len(rows), 'mode': mode, 'existingCount': existing,
            'resultingCount': len(rows) + (existing if mode == 'ADD' else 0),
            'requiresAcknowledgement': bool(warnings)}


def verify_preview(token, upload, semester, actor, mode='ADD'):
    if not isinstance(token, str):
        raise ValidationError("A valid preview token is required.")
    try:
        payload = signing.loads(token, salt=PREVIEW_SALT, max_age=PREVIEW_MAX_AGE)
    except signing.BadSignature:
        raise ValidationError('Preview expired or invalid. Preview the file again.')
    expected = {'actor': actor.pk, 'semester': semester.pk,
                'file': digest(upload), 'state': fingerprint(semester, lock=True), 'mode': mode}
    if payload != expected:
        raise ValidationError('The file, actor, semester or timeline/period data changed. Preview again.')
