"""Office marks workbook; submitted scores only, with assignment-level provenance."""
from collections import defaultdict
from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from accounts.programmes import APPROVED_PROGRAMMES, normalise_programme
from .completion_windows import task_due_at
from .models import EvaluationTask, MarkEntry


PROGRAMME_TABS = dict(zip(APPROVED_PROGRAMMES, (
    'Data Science', 'Cyber Security', 'Artificial Intelligence',
)))
IDENTITY = ['Record ID', 'Student ID', 'Student name', 'Programme', 'Semester',
            'Evaluation period', 'Assessment', 'Research title', 'Evaluator', 'Evaluator role',
            'Assignment status', 'Period status']


def export_tasks():
    return EvaluationTask.objects.select_related(
        'profile', 'evaluator', 'period__rubric', 'mark_entry',
    ).prefetch_related('mark_entry__scores__component', 'period__rubric__components', 'completion_windows')


def entry_for(task):
    return getattr(task, 'mark_entry', None)


def submitted(task):
    entry = entry_for(task)
    return bool(entry and entry.status == MarkEntry.Status.SUBMITTED)


def identity(task):
    return [f'MRK-{task.pk:05d}', task.profile.matric_no, task.profile.student_name,
            task.profile.programme, task.period.semester, task.period.name,
            task.period.assessment or 'Unclassified (legacy)',
            task.profile.proposed_topic, task.evaluator.full_name,
            task.get_evaluator_role_display(), task.lifecycle_status, task.period.lifecycle_status]


def excel_date(value):
    return timezone.localtime(value).strftime('%Y-%m-%d %H:%M:%S') if value else ''


def build_marks_workbook(tasks, scope):
    tasks = sorted(tasks, key=lambda t: (t.profile.matric_no, t.period_id, t.evaluator_role, t.pk))
    # Completion is independent of the selected status/evaluator filter.
    pairs = {(t.profile_id, t.period_id) for t in tasks}
    relevant = defaultdict(list)
    active = EvaluationTask.objects.filter(
        profile_id__in={p for p, _ in pairs}, period_id__in={p for _, p in pairs},
        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
    ).select_related('mark_entry', 'evaluator')
    for task in active:
        if (task.profile_id, task.period_id) in pairs:
            relevant[task.profile_id, task.period_id].append(task)

    book = Workbook()
    book.remove(book.active)
    stamp = excel_date(timezone.now())

    def sheet(name, headers, rows, note):
        ws = book.create_sheet(name)
        ws.append([f'Marks records — {name}'])
        ws.append([f'Exported {stamp} (Asia/Kuala_Lumpur) | Matching records: {len(tasks)}'])
        ws.append([f'Filters: {scope}'])
        ws.append([note])
        ws.append([])
        ws.append(headers)
        for row in rows:
            ws.append(row)
        for row in ws:
            for cell in row:
                if isinstance(cell.value, str):
                    # User-provided strings must remain text, including leading '='.
                    cell.data_type = 's'
                cell.alignment = Alignment(vertical='top', wrap_text=True)
        for row_index in (1, 6):
            for cell in ws[row_index]:
                cell.font = Font(bold=True, color='FFFFFF')
                cell.fill = PatternFill('solid', fgColor='17324D')
        for row_index in range(1, 5):
            ws.merge_cells(start_row=row_index, start_column=1, end_row=row_index, end_column=len(headers))
            ws.row_dimensions[row_index].height = 32 if row_index > 1 else 26
        for index, header in enumerate(headers, 1):
            ws.column_dimensions[get_column_letter(index)].width = (
                48 if header in ('Research title', 'Evaluator progress') else
                32 if header in ('Student name', 'Programme', 'Evaluation period') else 23
            )
        ws.freeze_panes = 'C7'
        ws.auto_filter.ref = f'A6:{get_column_letter(len(headers))}{max(6, ws.max_row)}'
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.orientation = 'landscape'
        ws.page_setup.paperSize = ws.PAPERSIZE_A3
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.print_title_rows = '1:6'
        return ws

    summary = []
    seen = set()
    for task in tasks:
        key = task.profile_id, task.period_id
        if key in seen:
            continue
        seen.add(key)
        assignments = relevant[key]
        count = sum(submitted(t) for t in assignments)
        progress = '; '.join(f'{t.get_evaluator_role_display()}: {t.evaluator.full_name} — '
                             f'{"Submitted" if submitted(t) else "Pending"}' for t in assignments)
        summary.append([task.profile.matric_no, task.profile.student_name, task.profile.programme,
                        task.period.semester, task.period.name, task.period.assessment or 'Unclassified (legacy)',
                        f'{count} / {len(assignments)}',
                        'Complete' if assignments and count == len(assignments) else
                        'Incomplete' if assignments else 'No active assignments', progress])
    sheet('Summary', ['Student ID', 'Student name', 'Programme', 'Semester', 'Evaluation period', 'Assessment',
                     'Submitted / active assignments', 'Completion', 'Evaluator progress'], summary,
          'Completion checks all active assignments for these students and periods, including assignments hidden by filters. '
          'No combined grade is calculated. Students without any matching assignment are not listed.')

    grouped = {name: [] for name in PROGRAMME_TABS.values()}
    for task in tasks:
        if submitted(task):
            name = PROGRAMME_TABS.get(normalise_programme(task.profile.programme), 'Other programmes')
            grouped.setdefault(name, []).append(task)
    for name, results in grouped.items():
        components = {}
        for task in results:
            for component in task.period.rubric.components.all():
                if component.is_active:
                    components[component.pk] = component
        headers = IDENTITY + ['Rubric', 'Rubric version', 'Submitted at', 'Last updated at', 'Total mark', 'Maximum mark']
        # Include the rubric/version when different rubrics share component labels.
        multiple = len({t.period.rubric_id for t in results}) > 1
        for component in components.values():
            prefix = f'{component.rubric.name} v{component.rubric.version}: ' if multiple else ''
            maximum = format(component.max_marks.normalize(), 'f')
            headers.append(f'{prefix}{component.name} ({maximum} max)')
        rows = []
        for task in results:
            entry = entry_for(task)
            rubric = task.period.rubric
            scores = {s.component_id: s.marks_awarded for s in entry.scores.all()}
            rows.append(identity(task) + [rubric.name, rubric.version, excel_date(entry.submitted_at),
                        excel_date(entry.updated_at), entry.total_mark, rubric.target_mark] +
                        [scores.get(pk) if component.rubric_id == rubric.pk else None
                         for pk, component in components.items()])
        sheet(name, headers, rows, 'Submitted results only. One row per evaluator assignment. '
              'Totals are evaluator totals, not a combined student grade. Blank component cells mean no recorded score / not applicable. '
              'Historical or paused assignments are identified in Assignment status.')

    outstanding = []
    now = timezone.now()
    for task in tasks:
        if submitted(task):
            continue
        entry = entry_for(task)
        due = task_due_at(task)
        state = 'Overdue' if due and due < now else 'Draft' if entry and entry.status == 'DRAFT' else 'Not Started'
        outstanding.append(identity(task) + [state, excel_date(due)])
    sheet('Outstanding', IDENTITY + ['Status', 'Deadline'], outstanding,
          'Matching unsubmitted assignments only; draft scores and feedback are excluded. '
          'Paused/retired assignments are historical, not current follow-up obligations. '
          'Results stored only in Google Forms are not included in this system export.')
    output = BytesIO()
    book.save(output)
    return output.getvalue()
