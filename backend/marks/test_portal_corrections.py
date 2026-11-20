"""Submitted Marks editing belongs to authorized, audited portal operations."""
from .test_write_helpers import submission_payload

from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import Permission
from django.test import Client, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from . import tests as fixture
from .models import EvaluationPeriod, MarkCorrectionAudit, MarkEntry


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class MarksPortalCorrectionTests(APITestCase):
    score_payload = fixture.MarkEntryWorkflowTests.score_payload

    def setUp(self):
        fixture.MarkEntryWorkflowTests.setUp(self)
        self.office_admin.user_permissions.add(Permission.objects.get(
            content_type__app_label='marks', codename='change_markentry',
        ))
        self.office_admin.is_staff = False
        self.office_admin.save(update_fields=['is_staff'])
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.client.put(f'/api/marks/tasks/{self.task.pk}/draft/', self.score_payload(), format='json').status_code, 200)
        self.assertEqual(self.client.post(f'/api/marks/tasks/{self.task.pk}/submit/', submission_payload(self.task), format='json').status_code, 200)
        self.entry = MarkEntry.objects.get(task=self.task)
        self.record_id = f'MRK-{self.task.pk:05d}'
        self.url = f'/api/marks/records/{self.record_id}/'
        self.client.force_authenticate(self.office_admin)

    def detail(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('officeActions', response.data)
        return response.data

    def payload(self, **changes):
        return {'expectedVersion': self.detail()['officeActions']['version'],
                'reason': 'Verified transcription error',
                'scores': [{'componentId': self.problem.pk, 'marksAwarded': '35.00'}], **changes}

    def snapshot(self):
        return (MarkEntry.objects.values().get(pk=self.entry.pk),
                list(self.entry.scores.order_by('pk').values()),
                list(MarkCorrectionAudit.objects.order_by('pk').values()))

    def test_detail_exposes_authorized_actions_and_reviewed_version(self):
        actions = self.detail()['officeActions']
        self.assertTrue(actions['canCorrect'])
        self.assertTrue(actions['canReopen'])
        self.assertTrue(actions['version'])

    def test_correction_recalculates_preserves_submission_and_returns_audit(self):
        before = self.entry.submitted_at
        response = self.client.post(self.url+'correct/', self.payload(comments='Corrected narrative'), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.entry.refresh_from_db()
        self.assertEqual((self.entry.status, self.entry.total_mark, self.entry.submitted_at), ('SUBMITTED', Decimal('85'), before))
        audit = MarkCorrectionAudit.objects.get(entry=self.entry)
        self.assertEqual((audit.actor, audit.reason, audit.action), (self.office_admin, 'Verified transcription error', 'CORRECT'))
        self.assertEqual((audit.before_values['totalMark'], audit.after_values['totalMark']), ('80.00', '85.00'))
        self.assertEqual(audit.after_values['comments'], 'Corrected narrative')
        self.assertEqual(self.detail()['correctionHistory'][0]['id'], audit.pk)

    def test_comment_only_correction_is_audited(self):
        response = self.client.post(self.url+'correct/', self.payload(scores=[], comments='Comment-only correction'), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.total_mark, Decimal('80'))
        self.assertEqual(MarkCorrectionAudit.objects.get().after_values['comments'], 'Comment-only correction')

    def test_feedback_only_correction_is_audited_and_can_be_cleared(self):
        score = self.entry.scores.get(component=self.problem)
        other_feedback = self.entry.scores.get(component=self.method).feedback
        key = str(self.problem.pk)
        updated = 'Corrected feedback\nSecond line'
        payload = self.payload(scores=[], feedback=[{'componentId': self.problem.pk, 'feedback': updated}])
        response = self.client.post(self.url+'correct/', payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        detail = self.detail()
        component = next(item for item in detail['rubric']['components'] if item['id'] == self.problem.pk)
        self.assertEqual((component['feedback'], detail['entry']['totalMark']), (updated, '80.00'))
        self.assertEqual(detail['entry']['status'], 'SUBMITTED')
        audit = detail['correctionHistory'][0]
        self.assertEqual(audit['beforeValues']['feedback'][key], score.feedback)
        self.assertEqual(audit['afterValues']['feedback'][key], updated)
        self.assertEqual(self.entry.scores.get(component=self.method).feedback, other_feedback)
        self.assertEqual(self.client.post(self.url+'correct/', payload, format='json').status_code, 409)
        self.assertEqual(self.client.post(self.url+'correct/', self.payload(scores=[], feedback=payload['feedback']), format='json').status_code, 400)
        clear = self.payload(scores=[], feedback=[{'componentId': self.problem.pk, 'feedback': ''}])
        self.assertEqual(self.client.post(self.url+'correct/', clear, format='json').status_code, 200)
        score.refresh_from_db()
        self.assertEqual(score.feedback, '')

    def test_feedback_rejects_unknown_duplicate_and_unexpected_fields(self):
        before = self.snapshot()
        feedback = {'componentId': self.problem.pk, 'feedback': 'New feedback'}
        for items in [[{**feedback, 'componentId': 999999}], [feedback, feedback], [{**feedback, 'status': 'DRAFT'}]]:
            with self.subTest(items=items):
                response = self.client.post(self.url+'correct/', self.payload(feedback=items), format='json')
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(self.snapshot(), before)

    def test_missing_reason_version_and_no_change_are_validation_errors(self):
        before = self.snapshot()
        for payload in [self.payload(reason='  '), self.payload(expectedVersion=''),
                        self.payload(scores=[]), self.payload(scores=[], comments=self.entry.comments)]:
            with self.subTest(payload=payload):
                response = self.client.post(self.url+'correct/', payload, format='json')
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(self.snapshot(), before)

    def test_invalid_component_scores_roll_back_everything(self):
        before = self.snapshot()
        for invalid in ['-1', '61', 'NaN', 'Infinity', '1.001', '12345678901234567890']:
            with self.subTest(invalid=invalid):
                response = self.client.post(self.url+'correct/', self.payload(scores=[
                    {'componentId': self.problem.pk, 'marksAwarded': '35'},
                    {'componentId': self.method.pk, 'marksAwarded': invalid},
                ]), format='json')
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(self.snapshot(), before)
        response = self.client.post(self.url+'correct/', self.payload(scores=[{'componentId': 999999, 'marksAwarded': '1'}]), format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(self.snapshot(), before)

    def test_duplicate_components_and_forged_fields_are_rejected(self):
        before = self.snapshot()
        for payload in [self.payload(scores=[{'componentId': self.problem.pk, 'marksAwarded': '35'}]*2),
                        self.payload(status='DRAFT'), self.payload(totalMark='1'), self.payload(taskId=999)]:
            response = self.client.post(self.url+'correct/', payload, format='json')
            self.assertEqual(response.status_code, 400, response.data)
            self.assertEqual(self.snapshot(), before)

    def test_closed_period_allows_correction_but_rejects_reopening(self):
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period.save(update_fields=['lifecycle_status'])
        actions = self.detail()['officeActions']
        self.assertTrue(actions['canCorrect']); self.assertFalse(actions['canReopen'])
        before = self.snapshot()
        response = self.client.post(self.url+'reopen/', {'reason': 'Cannot reopen closed period', 'expectedVersion': actions['version']}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.client.post(self.url+'correct/', self.payload(), format='json').status_code, 200)

    def test_reopening_preserves_scores_and_lecturer_can_resubmit(self):
        payload = {'reason': 'Return to evaluator for review', 'expectedVersion': self.detail()['officeActions']['version']}
        response = self.client.post(self.url+'reopen/', payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.entry.refresh_from_db()
        self.assertEqual((self.entry.status, self.entry.total_mark, self.entry.submitted_at), ('DRAFT', Decimal('80'), None))
        self.assertEqual(MarkCorrectionAudit.objects.get().action, 'REOPEN')
        self.assertFalse(self.detail()['officeActions']['canCorrect'])
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.client.put(f'/api/marks/tasks/{self.task.pk}/draft/', self.score_payload(problem='36'), format='json').status_code, 200)
        self.assertEqual(self.client.post(f'/api/marks/tasks/{self.task.pk}/submit/', submission_payload(self.task), format='json').status_code, 200)
        self.entry.refresh_from_db(); self.assertEqual(self.entry.total_mark, Decimal('86'))

    def test_stale_or_forged_versions_cannot_overwrite_newer_correction(self):
        stale = self.payload()
        self.assertEqual(self.client.post(self.url+'correct/', stale, format='json').status_code, 200)
        before = self.snapshot()
        for payload in [stale, {**stale, 'expectedVersion': 'forged'}]:
            self.assertEqual(self.client.post(self.url+'correct/', payload, format='json').status_code, 409)
            self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.client.post(self.url+'reopen/', {'reason': 'Stale reopen', 'expectedVersion': stale['expectedVersion']}, format='json').status_code, 409)

    def test_reopening_cannot_be_combined_with_correction(self):
        before = self.snapshot()
        response = self.client.post(self.url+'reopen/', self.payload(), format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(self.snapshot(), before)

    def test_permissions_require_active_office_and_model_change_permission(self):
        payload = self.payload(); before = self.snapshot()
        for actor in [self.lecturer, self.student_user, self.other_lecturer]:
            actor.is_staff = True; actor.save(update_fields=['is_staff'])
            actor.user_permissions.add(Permission.objects.get(content_type__app_label='marks', codename='change_markentry'))
            self.client.force_authenticate(actor)
            for action in ['correct', 'reopen']:
                self.assertEqual(self.client.post(self.url+action+'/', payload, format='json').status_code, 403)
            self.assertEqual(self.snapshot(), before)
        self.office_admin.user_permissions.clear()
        self.office_admin = type(self.office_admin).objects.get(pk=self.office_admin.pk)
        self.client.force_authenticate(self.office_admin)
        self.assertFalse(self.detail()['officeActions']['canCorrect'])
        self.assertEqual(self.client.post(self.url+'correct/', payload, format='json').status_code, 403)
        self.office_admin.user_permissions.add(Permission.objects.get(content_type__app_label='marks', codename='change_markentry'))
        self.office_admin = type(self.office_admin).objects.get(pk=self.office_admin.pk)
        self.client.force_authenticate(self.office_admin)
        self.assertEqual(self.client.post(self.url+'correct/', payload, format='json').status_code, 200)

    def test_direct_services_require_explicit_permission_and_active_office(self):
        from django.core.exceptions import ValidationError
        from .services import correct_submitted_marks, reopen_submitted_marks
        self.office_admin.user_permissions.clear()
        self.office_admin = type(self.office_admin).objects.get(pk=self.office_admin.pk)
        before = self.snapshot()
        for service, extra in [(correct_submitted_marks, {'score_values': {}, 'comments': 'Forbidden'}),
                               (reopen_submitted_marks, {})]:
            with self.subTest(service=service.__name__), self.assertRaises(ValidationError):
                service(entry=self.entry, actor=self.office_admin, reason='Must be rejected', **extra)
            self.assertEqual(self.snapshot(), before)
        self.office_admin.user_permissions.add(Permission.objects.get(content_type__app_label='marks', codename='change_markentry'))
        self.office_admin.is_active = False
        self.office_admin.save(update_fields=['is_active'])
        with self.assertRaises(ValidationError):
            reopen_submitted_marks(entry=self.entry, actor=self.office_admin, reason='Inactive actor')
        self.assertEqual(self.snapshot(), before)

    def test_missing_and_unsubmitted_records_cannot_be_edited(self):
        payload = self.payload()
        self.assertEqual(self.client.post('/api/marks/records/MRK-999999/correct/', payload, format='json').status_code, 404)
        self.entry.status = 'DRAFT'; self.entry.save(update_fields=['status'])
        before = self.snapshot()
        self.assertEqual(self.client.post(self.url+'correct/', payload, format='json').status_code, 409)
        self.assertEqual(self.snapshot(), before)

    def test_audit_failure_rolls_back_marks(self):
        payload = self.payload(comments='Must roll back', feedback=[{'componentId': self.problem.pk, 'feedback': 'Must also roll back'}])
        before = self.snapshot()
        with patch('marks.services.MarkCorrectionAudit.objects.create', side_effect=RuntimeError('Synthetic audit outage')):
            with self.assertRaisesRegex(RuntimeError, 'Synthetic audit outage'):
                self.client.post(self.url+'correct/', payload, format='json')
        self.assertEqual(self.snapshot(), before)

    def test_django_admin_is_inspection_only_even_for_superuser(self):
        technical = type(self.office_admin).objects.create_superuser('marks.inspect@example.test')
        client = Client(); client.force_login(technical)
        url = reverse('admin:marks_markentry_change', args=[self.entry.pk])
        response = client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="corrected_scores"')
        self.assertNotContains(response, 'name="reopen_for_lecturer"')
        self.assertNotContains(response, 'name="comments"')
        self.assertNotContains(response, 'name="_save"')
        before = self.snapshot()
        self.assertEqual(client.post(url, {'comments': 'Must not persist', 'corrected_scores': f'{self.problem.pk}=35', 'correction_reason': 'Old admin path', '_save': 'Save'}).status_code, 403)
        self.assertEqual(self.snapshot(), before)
