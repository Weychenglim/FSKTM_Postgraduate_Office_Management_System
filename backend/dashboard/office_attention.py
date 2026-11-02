"""Read-only Office attention projection, separate from capped role dashboards."""
from collections import Counter
from math import ceil

from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from appointments.models import CoSupervisorNomination, PanelRecommendation, ResearchAmendment, SupervisorApplication
from appointments.supervisor_documents import document_setup_status
from marks.models import EvaluationTask
from .actions import _task, build_dashboard_tasks


CATEGORIES = {
    'reconciliation': 'Check inconsistent records',
    'capacity': 'Review capacity settings',
    'evaluations': 'Review evaluations',
    'calendar': 'Set up semester timeline',
    'documents': 'Configure supervisor document requirements',
    'supervision': 'Supervision requests',
    'panel': 'Panel appointment requests',
}
URGENCY = {'overdue': 0, 'due': 1, 'blocking': 2, 'normal': 3}
OWNERS = {
    'SUPERVISOR': 'Supervisor', 'CO_SUPERVISOR': 'Co-supervisor',
    'SELECTED_PANEL': 'Panel', 'PROGRAMME_COORDINATOR': 'Programme Coordinator',
    'COORDINATOR': 'Programme Coordinator', 'SOURCE_COORDINATOR': 'Source Programme Coordinator',
    'DESTINATION_COORDINATOR': 'Destination Programme Coordinator',
    'FACULTY_PROCESSING': 'Office',
}


def build_office_attention_tasks(user):
    if user.role != User.Role.OFFICE_ADMIN:
        raise PermissionDenied('Only Office Staff/Admin can read Office attention records.')
    tasks = build_dashboard_tasks(user, limit=None)
    if not document_setup_status()["configured"]:
        tasks.append(_task(
            id='supervisor_document_setup',
            name='Configure supervisor document requirements',
            status='critical',
            statusText='Applications cannot be submitted until document requirements are configured.',
            target='Supervisor document requirements',
            targetModule='SUPERVISOR_APPOINTMENTS',
            recordType='SUPERVISOR_DOCUMENT_REQUIREMENTS',
        ))
    # Batch programme lookup; capacity and calendar setup are faculty-wide, not a programme.
    specifications = (
        ('SUPERVISOR_APPLICATION', SupervisorApplication, 'student__programme'),
        ('CO_SUPERVISOR_NOMINATION', CoSupervisorNomination, 'student__programme'),
        ('RESEARCH_AMENDMENT', ResearchAmendment, 'source_programme'),
        ('PANEL_RECOMMENDATION', PanelRecommendation, 'profile__programme'),
        ('EVALUATION_TASK', EvaluationTask, 'profile__programme'),
    )
    programmes = {}
    for kind, model, field in specifications:
        ids = [t['recordId'] for t in tasks if t.get('recordType') == kind and str(t.get('recordId', '')).isdigit()]
        if ids:
            programmes.update({(kind, str(pk)): (value or '').strip() or 'Not recorded' for pk, value in model.objects.filter(pk__in=ids).values_list('pk', field)})
    return [{**task, 'programme': programmes.get((task.get('recordType'), task.get('recordId')), task.get('programme') or 'Faculty-wide')} for task in tasks]


def category_for(task):
    kind = task.get('recordType')
    if kind == 'SUPERVISOR_DOCUMENT_REQUIREMENTS':
        return 'documents'
    if kind == 'RECONCILIATION_ISSUE':
        return 'reconciliation'
    if kind == 'LECTURER_CAPACITY':
        return 'capacity'
    if task.get('targetModule') == 'MARKS':
        return 'evaluations'
    if task['id'] == 'task_upload':
        return 'calendar'
    if task.get('targetModule') == 'PANEL_APPOINTMENTS':
        return 'panel'
    if task.get('targetModule') == 'SUPERVISOR_APPOINTMENTS':
        return 'supervision'
    return None


def attention_rows(tasks):
    rows, seen = [], set()
    for task in tasks:
        category = category_for(task)
        if not category or task['id'] in seen or task['status'].lower() in {'completed', 'complete', 'done'} or task.get('recordType') == 'TIMELINE_ENTRY':
            continue
        seen.add(task['id'])
        responsibility = 'waiting' if task.get('waitingOn') and task['waitingOn'] != 'FACULTY_PROCESSING' else 'review'
        urgency = {'OVERDUE': 'overdue', 'DUE_TODAY': 'due'}.get(task.get('deadlineState'), 'normal')
        if category in {'reconciliation', 'documents'} and task['status'] == 'critical':
            urgency = 'blocking'
        rows.append({**task, 'category': category, 'responsibility': responsibility, 'urgency': urgency,
                     'programme': task.get('programme') or 'Faculty-wide'})
    return sorted(rows, key=lambda row: (row['responsibility'] == 'waiting', URGENCY[row['urgency']], -(row.get('waitingDays') or 0), str(row.get('dueAt') or ''), row['id']))


def summaries(rows):
    groups = {}
    for row in rows:
        key = (row['responsibility'], row['category'])
        groups.setdefault(key, []).append(row)
    result = []
    for (responsibility, category), entries in groups.items():
        count = len(entries)
        urgency = min((row['urgency'] for row in entries), key=URGENCY.get)
        detail = f'{count} {"record" if count == 1 else "records"}'
        if category == 'documents':
            detail = 'Required before students can submit applications.'
        elif category == 'capacity':
            roles = Counter('Supervisor' if row['id'].startswith('capacity_supervisor_') else 'Panel' if row['id'].startswith('capacity_panel_') else 'Other' for row in entries)
            detail = ' · '.join(f'{amount} {role}' for role, amount in sorted(roles.items())) + ' role entries'
        elif category == 'reconciliation':
            detail = f'{count} blocking {"issue" if count == 1 else "issues"}'
        elif responsibility == 'waiting':
            owners = sorted({OWNERS.get(row['waitingOn'], row['waitingOn'].replace('_', ' ').title()) for row in entries})
            detail += ' · Waiting on ' + ', '.join(owners)
            days = [row['waitingDays'] for row in entries if row.get('waitingDays') is not None]
            if days:
                longest = max(days)
                detail += f' · {"Longest " if count > 1 else ""}{longest} {"day" if longest == 1 else "days"}'
        if urgency in {'overdue', 'due'}:
            amount = sum(row['urgency'] == urgency for row in entries)
            detail += f' · {amount} {"overdue" if urgency == "overdue" else "due today"}'
        result.append({'id': f'{responsibility}:{category}', 'category': category, 'responsibility': responsibility,
                       'title': CATEGORIES[category], 'count': count, 'detail': detail, 'urgency': urgency})
    return sorted(result, key=lambda group: (group['responsibility'] == 'waiting', URGENCY[group['urgency']], group['category']))


def attention_page(tasks, params):
    category, responsibility = params.get('category', ''), params.get('responsibility', '')
    if category and category not in CATEGORIES:
        raise ValidationError({'category': 'Unknown attention category.'})
    if responsibility not in {'', 'review', 'waiting'}:
        raise ValidationError({'responsibility': 'Unknown responsibility.'})
    try:
        page, size = int(params.get('page', 1)), int(params.get('size', 10))
        if page < 1 or size not in {10, 25, 50}:
            raise ValueError
    except (ValueError, TypeError):
        raise ValidationError({'page': 'Use a positive page and a page size of 10, 25 or 50.'})
    rows = attention_rows(tasks)
    summary = summaries(rows)
    programmes = sorted({row['programme'] for row in rows})
    search = params.get('q', '').strip().casefold()
    programme = params.get('programme', '').strip().casefold()
    filtered = [row for row in rows if (not category or row['category'] == category)
                and (not responsibility or row['responsibility'] == responsibility)
                and (not programme or row['programme'].casefold() == programme)
                and (not search or search in ' '.join(str(row.get(key) or '') for key in ('name', 'recordId', 'statusText', 'programme', 'semester', 'semesterCode')).casefold())]
    total = len(filtered)
    page_count = max(1, ceil(total / size))
    page = min(page, page_count)
    return {'results': filtered[(page-1)*size:page*size], 'total': total, 'page': page, 'pageSize': size,
            'pageCount': page_count, 'summary': summary, 'programmes': programmes,
            'categories': [{'value': key, 'label': title} for key, title in CATEGORIES.items()]}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def office_attention_view(request):
    if request.user.role != User.Role.OFFICE_ADMIN:
        raise PermissionDenied('Only Office Staff/Admin can read Office attention records.')
    return Response(attention_page(build_office_attention_tasks(request.user), request.query_params))
