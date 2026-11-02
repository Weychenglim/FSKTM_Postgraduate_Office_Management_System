from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from accounts.models import User


def task(index, **values):
    return {
        'id': f'panel_{index}', 'name': f'Student {index:02}', 'status': 'pending',
        'statusText': 'Programme Coordinator for 7 calendar days',
        'recordType': 'PANEL_RECOMMENDATION', 'recordId': str(index),
        'target': 'Panel Appointments', 'targetModule': 'PANEL_APPOINTMENTS',
        'waitingOn': 'PROGRAMME_COORDINATOR', 'waitingDays': 7,
        'waitingSince': None, 'dueAt': None, 'deadlineState': None,
        'semesterCode': '2026-S1', **values,
    }


class OfficeAttentionProjectionTests(SimpleTestCase):
    def project(self, rows, **params):
        from dashboard.office_attention import attention_page
        return attention_page(rows, params)

    def test_full_totals_and_paging_do_not_hide_categories_after_twenty(self):
        rows = [task(i) for i in range(1, 32)] + [task(99,
            recordType='RECONCILIATION_ISSUE', status='critical', waitingOn=None)]
        data = self.project(rows, page='3', size='10')
        self.assertEqual(data['total'], 32)
        self.assertEqual(data['pageCount'], 4)
        self.assertEqual(len(data['results']), 10)
        self.assertEqual(sum(group['count'] for group in data['summary']), 32)
        self.assertEqual(data['summary'][0]['category'], 'reconciliation')
        last = self.project(rows, page='4', size='10')
        self.assertEqual(len(last['results']), 2)
        self.assertFalse(set(r['id'] for r in data['results']) & set(r['id'] for r in last['results']))

    def test_filters_apply_before_pagination_and_summary_stays_complete(self):
        rows = [task(1, programme='Computing'), task(2, programme='Science'),
                task(3, programme='Computing', waitingOn='FACULTY_PROCESSING')]
        data = self.project(rows, responsibility='waiting', category='panel', programme='Computing', q='Student 01')
        self.assertEqual([r['id'] for r in data['results']], ['panel_1'])
        self.assertEqual(sum(group['count'] for group in data['summary']), 3)
        self.assertEqual(data['programmes'], ['Computing', 'Science'])
        self.assertEqual(self.project(rows, q='no matching student')['total'], 0)

    def test_capacity_units_deadline_severity_and_completed_exclusion(self):
        rows = [task(1, id='capacity_supervisor_1', recordType='LECTURER_CAPACITY', waitingOn=None),
                task(2, id='capacity_panel_1', recordType='LECTURER_CAPACITY', waitingOn=None),
                task(3, recordType='EVALUATION_TASK', targetModule='MARKS', waitingOn=None, deadlineState='OVERDUE'),
                task(4, status='completed'), task(5, recordType='TIMELINE_ENTRY')]
        data = self.project(rows)
        self.assertEqual(data['total'], 3)
        self.assertEqual(data['results'][0]['urgency'], 'overdue')
        group = next(g for g in data['summary'] if g['category'] == 'capacity')
        self.assertEqual(group['count'], 2)
        self.assertIn('1 Supervisor', group['detail'])
        self.assertIn('1 Panel', group['detail'])
        self.assertEqual(next(r for r in data['results'] if r['id']=='panel_3')['responsibility'], 'review')

    def test_invalid_filters_fail_closed_and_page_sizes_are_bounded(self):
        from rest_framework.exceptions import ValidationError
        for params in [{'category':'unknown'}, {'responsibility':'unknown'}, {'page':'oops'}, {'size':'10000'}]:
            with self.subTest(params=params), self.assertRaises(ValidationError):
                self.project([task(1)], **params)
        self.assertEqual(self.project([task(1)], page='99')['page'], 1)


class OfficeAttentionAccessTests(APITestCase):
    def test_only_office_can_read_and_mutations_are_rejected(self):
        for role in [User.Role.STUDENT, User.Role.LECTURER, User.Role.COORDINATOR]:
            user = User.objects.create_user(email=f'attention-{role}@example.test', role=role)
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get('/api/dashboard/attention/').status_code, 403)
        office = User.objects.create_user(email='attention-office@example.test', role=User.Role.OFFICE_ADMIN)
        self.client.force_authenticate(office)
        with patch('dashboard.office_attention.build_office_attention_tasks', return_value=[task(1)]) as loader:
            response = self.client.get('/api/dashboard/attention/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total'], 1)
        loader.assert_called_once_with(office)
        self.assertEqual(self.client.post('/api/dashboard/attention/', {}).status_code, 405)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/dashboard/attention/').status_code, [401,403])

    def test_uncapped_access_preserves_legacy_builder_default(self):
        from dashboard.actions import build_dashboard_tasks
        office = User.objects.create_user(email='attention-builder@example.test', role=User.Role.OFFICE_ADMIN)
        with patch('dashboard.actions.current_effective_semester', return_value=None), \
             patch('dashboard.amendment_tracking.amendment_actions', return_value=[]), \
             patch('dashboard.actions._supervisor_actions', return_value=[]), \
             patch('dashboard.actions.co_supervisor_actions', return_value=[]), \
             patch('dashboard.actions._panel_actions', return_value=[task(i) for i in range(1,32)]), \
             patch('dashboard.actions._mark_actions', return_value=[]), \
             patch('dashboard.actions._timeline_actions', return_value=[]), \
             patch('dashboard.actions._capacity_actions', return_value=[]), \
             patch('dashboard.actions._reconciliation_actions', return_value=[]):
            self.assertEqual(len(build_dashboard_tasks(office)), 20)
            self.assertEqual(len(build_dashboard_tasks(office, limit=None)), 32)


from dashboard import test_progress_dossier as dossier_fixture


class OfficeAttentionPersistedDataTests(APITestCase):
    setUp = dossier_fixture.StudentProgressDossierTests.setUp
    create_user = dossier_fixture.StudentProgressDossierTests.create_user
    create_lecturer = dossier_fixture.StudentProgressDossierTests.create_lecturer
    create_student = dossier_fixture.StudentProgressDossierTests.create_student

    def test_real_projection_enriches_programmes_and_get_does_not_write(self):
        from django.apps import apps
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        from dashboard.actions import build_dashboard_tasks
        models = [model for model in apps.get_models() if model._meta.app_label in {'accounts','appointments','academics','dashboard','marks'}]
        before = {model._meta.label: model.objects.count() for model in models}
        self.client.force_authenticate(self.office)
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get('/api/dashboard/attention/?size=50')
        self.assertFalse([query['sql'] for query in queries if query['sql'].lstrip().upper().startswith(('INSERT ', 'UPDATE ', 'DELETE ', 'ALTER '))])
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(data['total'], sum(group['count'] for group in data['summary']))
        supervisor = next(row for row in data['results'] if row['id']==f'supervisor_{self.pending_supervisor.pk}')
        self.assertEqual(supervisor['programme'], self.student.programme)
        self.assertEqual(supervisor['responsibility'], 'waiting')
        filtered = self.client.get('/api/dashboard/attention/', {'programme': self.student.programme, 'category':'supervision'})
        self.assertEqual(filtered.status_code, 200)
        self.assertTrue(filtered.data['results'])
        self.assertTrue(all(row['programme']==self.student.programme for row in filtered.data['results']))
        self.assertTrue(all(row['category']=='supervision' for row in filtered.data['results']))
        # The uncapped read remains a projection of existing eligibility, not a new workflow.
        legacy_ids = {row['id'] for row in build_dashboard_tasks(self.office)}
        self.assertTrue({row['id'] for row in data['results'] if row['category'] not in {'calendar', 'documents'}}.issubset(
            {row['id'] for row in build_dashboard_tasks(self.office, limit=None)}))
        self.assertTrue(legacy_ids)
        self.assertEqual(before, {model._meta.label: model.objects.count() for model in models})


class DocumentRequirementAttentionTests(APITestCase):
    def setUp(self):
        self.office = User.objects.create_user(email='document-setup-office@example.test', role=User.Role.OFFICE_ADMIN)
        self.client.force_authenticate(self.office)

    def read(self):
        with patch('dashboard.office_attention.build_dashboard_tasks', return_value=[]):
            response = self.client.get('/api/dashboard/attention/')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_missing_setup_is_one_faculty_wide_office_action(self):
        data = self.read()
        self.assertEqual(data['total'], 1)
        row = data['results'][0]
        self.assertEqual(row['recordType'], 'SUPERVISOR_DOCUMENT_REQUIREMENTS')
        self.assertEqual(row['category'], 'documents')
        self.assertEqual(row['responsibility'], 'review')
        self.assertEqual(row['urgency'], 'blocking')
        self.assertEqual(row['programme'], 'Faculty-wide')
        self.assertEqual(data['summary'][0]['title'], 'Configure supervisor document requirements')
        self.assertEqual(data['summary'][0]['count'], 1)

    def test_inactive_requirement_does_not_resolve_setup(self):
        from appointments.models import SupervisorDocumentRequirement
        SupervisorDocumentRequirement.objects.create(code='old', label='Old upload', is_active=False)
        self.assertEqual(self.read()['total'], 1)

    def test_any_active_requirement_resolves_and_deactivation_restores_reminder(self):
        from appointments.models import SupervisorDocumentRequirement
        requirement = SupervisorDocumentRequirement.objects.create(code='custom', label='Custom upload', is_required=False)
        self.assertEqual(self.read()['total'], 0)
        requirement.is_required = True
        requirement.save()
        self.assertEqual(self.read()['total'], 0)
        requirement.is_active = False
        requirement.save()
        self.assertEqual(self.read()['total'], 1)

    def test_explicit_no_documents_resolves_and_revocation_restores_reminder(self):
        from appointments.supervisor_documents import set_document_setup
        set_document_setup(actor=self.office, no_documents_required=True, reason="No uploads needed")
        self.assertEqual(self.read()['total'], 0)
        set_document_setup(actor=self.office, no_documents_required=False, reason="Require checklist setup")
        self.assertEqual(self.read()['total'], 1)
