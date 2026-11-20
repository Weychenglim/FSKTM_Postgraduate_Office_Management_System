"""Signed, non-mutating calendar workbook review and existing-link preservation."""
import hashlib
import json
from zoneinfo import ZoneInfo

from django.core import signing
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .excel import derive_status, parse_timeline_workbook
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


def row_dates(row):
    return row['deadline_start'], row['deadline_end']


def carry_link(row, old):
    start, end = old.projected_dates
    row.update(deadline_start=start, deadline_end=end, status=derive_status(start, end),
        operational_period_id=old.operational_period_id, marks_period_id=old.marks_period_id)


def match_links(rows, semester, choices):
    current_links = SemesterTimelineEntry.objects.filter(
        timeline__academic_semester=semester, timeline__is_active=True,
    ).exclude(operational_period__isnull=True, marks_period__isnull=True).select_related(
        'operational_period', 'marks_period')
    conflicts = {}
    available = {str(row['display_order']): row for row in rows}
    by_step = {(row['level'], row['step']): row for row in rows}
    for old in current_links:
        row = by_step.get((old.level, old.step))
        matches = row and all(row[key] == getattr(old, key) for key in (
            'title', 'detail', 'action_owner', 'target_roles'))
        if matches and row_dates(row) == old.projected_dates:
            row['week_label'] = old.week_label
            carry_link(row, old)
            del available[str(row['display_order'])]
        else:
            conflicts[str(old.pk)] = old

    if not choices:
        return list(conflicts.values()), [row['display_order'] for row in available.values()], 0
    if choices.keys() != conflicts.keys():
        raise ValidationError('Choose what to do with every linked event before reviewing the replacement.')

    carried = 0
    next_step = {level: max((row['step'] for row in rows if row['level'] == level), default=0)
        for level in SemesterTimelineEntry.Level.values}
    for key, old in conflicts.items():
        choice = choices[key]
        if choice == 'keep':
            next_step[old.level] += 1
            row = {field: getattr(old, field) for field in (
                'level', 'title', 'detail', 'action_owner', 'target_roles', 'week_label')}
            row.update(step=next_step[old.level], display_order=len(rows) + 1)
            rows.append(row)
            carried += 1
        else:
            action, _, position = choice.partition(':')
            row = available.pop(position, None)
            if row is None or row['level'] != old.level:
                raise ValidationError('Choose a different available workbook row for each linked event in the same project level.')
            expected = 'match' if row_dates(row) == old.projected_dates else 'keep-dates'
            if action != expected:
                raise ValidationError('Confirm the match and keep the current window dates when they differ from Excel.')
        carry_link(row, old)
    return [], [], carried


def prepare_rows(upload, semester, mode='ADD', choices=None):
    if mode not in {'ADD', 'REPLACE'}:
        raise ValidationError('Choose Add events or Replace calendar.')
    errors = validate_timeline_upload(upload)
    if errors:
        raise ValidationError(errors)
    rows, errors = parse_timeline_workbook(upload)
    if errors:
        raise ValidationError(errors)
    for row in rows:
        code, period_id = row.pop('activity_code'), row.pop('period_id')
        if code or period_id:
            raise ValidationError('Link events in Periods & deadlines, not through Excel import. Clear Activity Code and Period ID or download a fresh template.')
    conflicts, available, carried = match_links(rows, semester, choices) if mode == 'REPLACE' else ([], [], 0)
    warnings = []
    today = timezone.localdate(timezone=MALAYSIA)
    for row in rows[:len(rows) - carried]:
        if row['deadline_end'] < today:
            warnings.append(f"{row['level']} step {row['step']}: dates have already ended.")
        if row['deadline_start'] < semester.starts_on or row['deadline_end'] > semester.ends_on:
            warnings.append(f"{row['level']} step {row['step']}: dates are outside the selected semester.")
    return rows, warnings, conflicts, available, carried


def display_rows(rows):
    return [{
        'level': row['level'], 'step': row['step'], 'title': row['title'],
        'position': row['display_order'],
        'detail': row['detail'], 'action': row['action_owner'],
        'deadlineStart': row['deadline_start'].isoformat(),
        'deadlineEnd': row['deadline_end'].isoformat(), 'targetRoles': row['target_roles'],
            } for row in rows]


def link_conflict(entry):
    start, end = entry.projected_dates
    return {'entryId': entry.pk, 'level': entry.level, 'step': entry.step,
        'title': entry.title or entry.detail, 'periodName': entry.linked_period.name,
        'deadlineStart': start.isoformat(), 'deadlineEnd': end.isoformat(),
        'operationalPeriodId': entry.operational_period_id, 'marksPeriodId': entry.marks_period_id}


def parse_choices(raw):
    try:
        choices = json.loads(raw)
    except (ValueError, TypeError):
        raise ValidationError('Invalid linked event choices.') from None
    if not isinstance(choices, dict) or not all(isinstance(value, str) for value in choices.values()):
        raise ValidationError('Invalid linked event choices.')
    return choices


@transaction.atomic
def create_preview(upload, semester, actor, mode='ADD', choices=None):
    semester = type(semester).objects.select_for_update().get(pk=semester.pk)
    if semester.lifecycle_status not in {"DRAFT", "ACTIVE"}:
        raise ValidationError("Timeline changes require a Draft or Active academic semester.")
    state = fingerprint(semester, lock=True)
    rows, warnings, conflicts, available, carried = prepare_rows(upload, semester, mode, choices)
    existing = SemesterTimelineEntry.objects.filter(timeline__academic_semester=semester, timeline__is_active=True).count()
    token = signing.dumps({'actor': actor.pk, 'semester': semester.pk,
        'file': digest(upload), 'state': state, 'mode': mode, 'choices': choices or {}}, salt=PREVIEW_SALT, compress=True)
    return {'previewToken': None if conflicts else token, 'warnings': warnings, 'rows': display_rows(rows),
            'linkReviewToken': token if conflicts else None, 'linkConflicts': [link_conflict(entry) for entry in conflicts],
            'availableLinkRows': available if conflicts else [], 'carriedCount': carried,
            'importedCount': len(rows) - carried, 'mode': mode, 'existingCount': existing,
            'resultingCount': None if conflicts else len(rows) + (existing if mode == 'ADD' else 0),
            'requiresAcknowledgement': bool(warnings)}


def verify_preview(token, upload, semester, actor, mode='ADD'):
    if not isinstance(token, str):
        raise ValidationError("A valid preview token is required.")
    try:
        payload = signing.loads(token, salt=PREVIEW_SALT, max_age=PREVIEW_MAX_AGE)
    except signing.BadSignature:
        raise ValidationError('Preview expired or invalid. Preview the file again.')
    choices = payload.pop('choices', {})
    expected = {'actor': actor.pk, 'semester': semester.pk,
                'file': digest(upload), 'state': fingerprint(semester, lock=True), 'mode': mode}
    if payload != expected:
        raise ValidationError('The file, actor, semester or timeline/period data changed. Preview again.')
    return choices
