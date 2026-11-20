from rest_framework.exceptions import ValidationError

from academics.services import current_effective_semester
from accounts.project_stages import project_stages, shown


CURRENT_ROSTER_STAGES = ('P1', 'P2', 'NOT_CONFIRMED', 'NOT_STARTED', 'NOT_STUDYING', 'COMPLETED')


def project_stage_filter(params, category):
    value = str(params.get('projectStage', '')).strip()
    allowed = {
        'students': ('', 'P1', 'P2', 'NOT_CONFIRMED'),
        'current_roster': ('', *CURRENT_ROSTER_STAGES),
    }.get(category, ('',))
    if value not in allowed:
        raise ValidationError({'projectStage': 'Unsupported project stage filter.'})
    return value


def attention_stages(semester, student_ids):
    if not semester or not student_ids:
        return {}
    return {
        pk: shown(answer)
        for pk, answer in project_stages(semester, student_ids).items()
    }


def current_stage_fields(student_id):
    if not student_id:
        return {}
    semester = current_effective_semester()
    if not semester:
        return {}
    return {
        'projectStage': attention_stages(semester, [student_id])[student_id],
        'projectSemester': semester.label,
    }


def filter_attention_stages(rows, semester, student_field, stage):
    if not semester:
        return rows, {}
    stages = attention_stages(semester, list(rows.order_by().values_list(student_field, flat=True)))
    return rows.filter(**{f'{student_field}__in': [pk for pk, value in stages.items() if value == stage]}), stages


def stage_coverage_page(data, semester, stages):
    if stages is None:
        stages = attention_stages(semester, [row['id'] for row in data['results']])
    for row in data['results']:
        row['projectStage'] = stages.get(row['id'])
        row['projectSemester'] = semester.label if semester else None
    data['projectSemester'] = semester.label if semester else None
    return data


def panel_appointment_stages(appointments, semester):
    """Project linked, active assignments from an already authorised collection."""
    active = [row for row in appointments if row.status == "ACTIVE" and row.profile.student_id]
    stages = attention_stages(semester, [row.profile.student_id for row in active])
    return {row.pk: stages[row.profile.student_id] for row in active if row.profile.student_id in stages}
