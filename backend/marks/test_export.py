from io import BytesIO

from openpyxl import load_workbook
from rest_framework.test import APITestCase

from accounts.programmes import APPROVED_PROGRAMMES
from .models import EvaluationTask, MarkEntry, MarkScore
from . import tests as workflow_tests


class MarksExportTests(APITestCase):
    setUp = workflow_tests.MarkEntryWorkflowTests.setUp

    def export(self, ids=None):
        return self.client.post('/api/marks/export/', {
            'recordIds': ids if ids is not None else [f'MRK-{self.task.pk:05d}'],
            'scope': 'All records; All programmes',
        }, format='json')

    def submit(self):
        entry = MarkEntry.objects.create(task=self.task, status='SUBMITTED', total_mark=75)
        MarkScore.objects.create(entry=entry, component=self.problem, marks_awarded=30)
        MarkScore.objects.create(entry=entry, component=self.method, marks_awarded=45)
        return entry

    def test_office_only_and_input_validation(self):
        self.assertIn(self.export().status_code, [401, 403])
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.export().status_code, 403)
        self.client.force_authenticate(self.office_admin)
        for ids in [[], ['bad'], ['MRK-999999999'], [True], 'MRK-1']:
            self.assertEqual(self.export(ids).status_code, 400)

    def test_five_tabs_numeric_results_and_safe_text(self):
        self.client.force_authenticate(self.office_admin)
        self.profile.student_name = '=1+1'
        self.profile.save()
        self.submit()
        response = self.export()
        self.assertEqual(response.status_code, 200)
        book = load_workbook(BytesIO(response.content))
        self.assertEqual(book.sheetnames, ['Summary', 'Data Science', 'Cyber Security', 'Artificial Intelligence', 'Outstanding'])
        sheet = book['Artificial Intelligence']
        headers = [c.value for c in sheet[6]]
        values = dict(zip(headers, [c.value for c in sheet[7]]))
        self.assertEqual(values['Total mark'], 75)
        self.assertEqual(values['Maximum mark'], 100)
        self.assertEqual(values['Problem Definition (40 max)'], 30)
        self.assertEqual(sheet.cell(7, headers.index('Student name') + 1).data_type, 's')
        self.assertEqual(values['Student name'], '=1+1')
        self.assertEqual(sheet.freeze_panes, 'C7')
        self.assertTrue(sheet.auto_filter.ref)

    def test_draft_scores_and_comments_never_exported(self):
        self.client.force_authenticate(self.office_admin)
        entry = MarkEntry.objects.create(task=self.task, status='DRAFT', total_mark=42, comments='PRIVATE DRAFT')
        MarkScore.objects.create(entry=entry, component=self.problem, marks_awarded=22, feedback='PRIVATE FEEDBACK')
        book = load_workbook(BytesIO(self.export().content))
        text = str([[row for row in sheet.values] for sheet in book])
        self.assertNotIn('PRIVATE', text)
        self.assertEqual(book['Artificial Intelligence'].max_row, 6)
        headers = [c.value for c in book['Outstanding'][6]]
        row = dict(zip(headers, [c.value for c in book['Outstanding'][7]]))
        self.assertEqual(row['Status'], 'Draft')
        self.assertNotIn('Total mark', headers)

    def test_summary_does_not_claim_complete_when_filter_hides_missing_evaluator(self):
        self.client.force_authenticate(self.office_admin)
        self.submit()
        EvaluationTask.objects.create(profile=self.profile, evaluator=self.other_lecturer,
                                      period=self.period, evaluator_role='SUPERVISOR')
        book = load_workbook(BytesIO(self.export().content))
        headers = [c.value for c in book['Summary'][6]]
        row = dict(zip(headers, [c.value for c in book['Summary'][7]]))
        self.assertEqual(row['Submitted / active assignments'], '1 / 2')
        self.assertEqual(row['Completion'], 'Incomplete')
        self.assertEqual(book['Outstanding'].max_row, 6, 'Detail tabs respect selected records')

    def test_selection_not_pagination_and_programme_routing(self):
        self.client.force_authenticate(self.office_admin)
        self.submit()
        tasks = [self.task]
        for index in range(6):
            task = EvaluationTask.objects.create(profile=self.profile, evaluator=self.other_lecturer,
                period=self.period, evaluator_role='BACKUP', lifecycle_status='RETIRED')
            MarkEntry.objects.create(task=task, status='SUBMITTED', total_mark=index)
            tasks.append(task)
        book = load_workbook(BytesIO(self.export([f'MRK-{t.pk:05d}' for t in tasks]).content))
        self.assertEqual(book['Artificial Intelligence'].max_row, 13)
        for programme, tab in zip(APPROVED_PROGRAMMES, ['Data Science', 'Cyber Security', 'Artificial Intelligence']):
            self.profile.programme = programme
            self.profile.save()
            result = load_workbook(BytesIO(self.export().content))
            self.assertEqual(result[tab].max_row, 7)

    def test_unknown_programme_is_preserved(self):
        self.client.force_authenticate(self.office_admin)
        self.submit()
        self.profile.programme = 'Legacy programme'
        self.profile.save()
        book = load_workbook(BytesIO(self.export().content))
        self.assertEqual(book['Other programmes'].max_row, 7)

    def test_assessment_identity_is_traceable_in_workbook(self):
        self.client.force_authenticate(self.office_admin)
        self.period.assessment = 'P2'
        self.period.save(update_fields=['assessment'])
        self.submit()
        book = load_workbook(BytesIO(self.export().content))
        for name in ['Summary', 'Artificial Intelligence']:
            headers = [cell.value for cell in book[name][6]]
            row = dict(zip(headers, [cell.value for cell in book[name][7]]))
            self.assertEqual(row['Assessment'], 'P2')
