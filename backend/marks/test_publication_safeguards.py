from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from . import test_production_management as management
from .models import EvaluationPeriod, EvaluationTask, MarksConfigurationAudit
from appointments.models import StudentResearchProfile
from rest_framework.test import APIClient
from .services import publish_evaluation_period, update_evaluation_period, update_rubric, clone_rubric_version, MarksStateConflict
from django.utils import timezone


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PublicationSafeguardsTests(TestCase):
    def setUp(self):
        management.MarksConfigurationModelTests.setUp(self)
        self.rubric.allowed_evaluator_roles = ['SUPERVISOR', 'PANEL']
        self.rubric.save()

    def period(self, **kwargs):
        values = dict(name='Evaluation', semester=self.academic_semester.label,
                      academic_semester=self.academic_semester, rubric=self.rubric,
                      opens_at=timezone.now(), closes_at=timezone.now()+timezone.timedelta(days=2))
        values.update(kwargs)
        return EvaluationPeriod.objects.create(**values)

    def classified(self, **kwargs):
        period = self.period(**kwargs)
        period.assessment = 'P1'
        period.save()
        return period

    def test_requires_assessment(self):
        with self.assertRaisesMessage(ValidationError, 'P1 or P2'):
            publish_evaluation_period(period=self.period(), actor=self.office_admin)

    def test_requires_explicit_rubric_roles(self):
        self.rubric.allowed_evaluator_roles = []
        self.rubric.save()
        with self.assertRaisesMessage(ValidationError, 'configured'):
            publish_evaluation_period(period=self.classified(), actor=self.office_admin)

    def test_rejects_role_mismatch(self):
        self.rubric.allowed_evaluator_roles = ['SUPERVISOR']
        self.rubric.save()
        with self.assertRaisesMessage(ValidationError, 'rubric'):
            publish_evaluation_period(period=self.classified(evaluator_roles=['PANEL']), actor=self.office_admin)

    def test_duplicate_ignores_name_dates_and_rubric(self):
        first = self.classified()
        publish_evaluation_period(period=first, actor=self.office_admin)
        clone = clone_rubric_version(rubric=self.rubric, actor=self.office_admin)
        second = self.classified(name='Different', rubric=clone, opens_at=timezone.now()+timezone.timedelta(days=3), closes_at=timezone.now()+timezone.timedelta(days=4))
        with self.assertRaisesMessage(ValidationError, 'coverage'):
            publish_evaluation_period(period=second, actor=self.office_admin)

    def test_p1_p2_publish_separately(self):
        publish_evaluation_period(period=self.classified(), actor=self.office_admin)
        second = self.classified(name='P2')
        second.assessment = 'P2'
        second.save()
        self.assertEqual(publish_evaluation_period(period=second, actor=self.office_admin).assessment, 'P2')

    def test_disjoint_roles_publish(self):
        publish_evaluation_period(period=self.classified(evaluator_roles=['SUPERVISOR']), actor=self.office_admin)
        publish_evaluation_period(period=self.classified(name='Panel', evaluator_roles=['PANEL']), actor=self.office_admin)

    def test_disjoint_programmes_publish(self):
        publish_evaluation_period(period=self.classified(programme_scope='SELECTED', programmes=['Computing']), actor=self.office_admin)
        publish_evaluation_period(period=self.classified(name='Other', programme_scope='SELECTED', programmes=['Engineering']), actor=self.office_admin)

    def test_unclassified_published_blocks(self):
        self.period(lifecycle_status='PUBLISHED')
        with self.assertRaisesMessage(ValidationError, 'unclassified'):
            publish_evaluation_period(period=self.classified(name='New'), actor=self.office_admin)

    def test_legacy_assessment_update_is_rejected(self):
        period = self.period(lifecycle_status='CLOSED')
        with self.assertRaises(MarksStateConflict):
            update_evaluation_period(period=period, actor=self.office_admin, values={'assessment':'P1'}, reason='Verified source')
        period.refresh_from_db()
        self.assertEqual(period.assessment, '')
        self.assertFalse(MarksConfigurationAudit.objects.filter(entity_id=period.pk, entity_type='PERIOD', action='CLASSIFY').exists())

    def test_clone_copies_roles_and_locked_update_rejected(self):
        self.period(lifecycle_status='PUBLISHED')
        with self.assertRaises(MarksStateConflict):
            update_rubric(rubric=self.rubric, actor=self.office_admin, values={'allowed_evaluator_roles':['PANEL']})
        clone = clone_rubric_version(rubric=self.rubric, actor=self.office_admin)
        self.assertEqual(clone.allowed_evaluator_roles, ['SUPERVISOR','PANEL'])

    def test_closed_and_archived_with_tasks_reserve_coverage(self):
        for state in ('CLOSED', 'ARCHIVED'):
            with self.subTest(state=state):
                existing = self.classified(name=state, lifecycle_status=state)
                profile = StudentResearchProfile.objects.create(matric_no=state, student_name='Student', programme='Computing', semester='Legacy', proposed_topic='Research', supervisor=self.office_admin)
                EvaluationTask.objects.create(period=existing, profile=profile, evaluator=self.office_admin)
                with self.assertRaisesMessage(ValidationError, 'coverage'):
                    publish_evaluation_period(period=self.classified(name='New '+state), actor=self.office_admin)
                existing.assessment = 'P2'
                existing.save()

    def test_unused_archived_does_not_reserve_coverage(self):
        self.classified(lifecycle_status='ARCHIVED')
        publish_evaluation_period(period=self.classified(name='Replacement'), actor=self.office_admin)

    def test_classification_requires_reason_and_preserves_honest_historical_duplicates(self):
        legacy = self.period(name='Legacy', lifecycle_status='CLOSED')
        with self.assertRaises(MarksStateConflict):
            update_evaluation_period(period=legacy, actor=self.office_admin, values={'assessment':'P1'}, reason='Records')
        legacy.refresh_from_db()
        self.assertEqual(legacy.assessment, '')

    def test_inactive_and_archived_rubric_cannot_publish(self):
        for field in ('is_active', 'is_archived'):
            setattr(self.rubric, field, field == 'is_archived')
            self.rubric.save()
            with self.assertRaises(MarksStateConflict):
                publish_evaluation_period(period=self.classified(), actor=self.office_admin)
            setattr(self.rubric, field, field == 'is_active')
            self.rubric.save()

    def test_draft_save_checks_configured_roles_and_accepts_blank_assessment(self):
        from .services import create_evaluation_period
        self.rubric.allowed_evaluator_roles = ['SUPERVISOR']
        self.rubric.save()
        values = dict(actor=self.office_admin, name='Draft', academic_semester=self.academic_semester, rubric=self.rubric, opens_at=None, closes_at=None)
        with self.assertRaisesMessage(ValidationError, 'rubric'):
            create_evaluation_period(**values, evaluator_roles=['PANEL'])
        period = create_evaluation_period(**values, evaluator_roles=['SUPERVISOR'])
        self.assertEqual(period.assessment, '')
        with self.assertRaisesMessage(ValidationError, 'rubric'):
            update_evaluation_period(period=period, actor=self.office_admin, values={'evaluator_roles':['PANEL']})

    def test_api_requires_explicit_roles_and_returns_fields(self):
        client = APIClient()
        client.force_authenticate(self.office_admin)
        payload = {'familyCode':'explicit', 'name':'Explicit', 'targetMark':'100.00'}
        for roles in (None, [], ['BACKUP']):
            if roles is not None:
                payload['allowedEvaluatorRoles'] = roles
            response = client.post('/api/marks/rubrics/', payload, format='json')
            self.assertEqual(response.status_code, 400, response.data)
        payload['allowedEvaluatorRoles'] = ['SUPERVISOR', 'PANEL']
        response = client.post('/api/marks/rubrics/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['allowedEvaluatorRoles'], payload['allowedEvaluatorRoles'])
        period = self.period(lifecycle_status='CLOSED')
        response = client.patch(f'/api/marks/periods/{period.pk}/', {'assessment':'P1','reason':'Verified'}, format='json')
        self.assertEqual(response.status_code, 409, response.data)
        period.refresh_from_db()
        self.assertEqual(period.assessment, '')

    def test_two_legacy_periods_can_be_classified_sequentially(self):
        legacy = self.period(name='Legacy', lifecycle_status='CLOSED')
        with self.assertRaises(MarksStateConflict):
            update_evaluation_period(period=legacy, actor=self.office_admin, values={'assessment':'P1'}, reason='Records')
        legacy.refresh_from_db()
        self.assertEqual(legacy.assessment, '')

    def test_null_semester_legacy_label_blocks_publication(self):
        self.period(name='Legacy label', academic_semester=None, semester=' '+self.academic_semester.label.upper()+' ', lifecycle_status='CLOSED')
        with self.assertRaisesMessage(ValidationError, 'unclassified'):
            publish_evaluation_period(period=self.classified(name='New'), actor=self.office_admin)

    def test_null_semester_different_label_does_not_block(self):
        self.period(name='Other semester', academic_semester=None, semester='Unrelated', lifecycle_status='CLOSED')
        publish_evaluation_period(period=self.classified(name='New'), actor=self.office_admin)

    def test_overlapping_programmes_ignore_case_and_spacing(self):
        self.classified(name='Existing', programme_scope='SELECTED', programmes=[' Computing ', 'Engineering'], lifecycle_status='CLOSED')
        with self.assertRaisesMessage(ValidationError, 'coverage'):
            publish_evaluation_period(period=self.classified(name='New', programme_scope='SELECTED', programmes=['computing']), actor=self.office_admin)

    def test_original_name_uniqueness_is_preserved_for_disjoint_assessments(self):
        publish_evaluation_period(period=self.classified(), actor=self.office_admin)
        second = self.classified()
        second.assessment = 'P2'
        second.save()
        with self.assertRaisesMessage(ValidationError, 'name and semester'):
            publish_evaluation_period(period=second, actor=self.office_admin)

    def test_explicit_both_roles_can_publish(self):
        period = publish_evaluation_period(period=self.classified(), actor=self.office_admin)
        self.assertEqual(period.evaluator_roles, ['SUPERVISOR', 'PANEL'])

    def test_used_unconfigured_rubric_needs_a_configured_clone(self):
        self.rubric.allowed_evaluator_roles = []
        self.rubric.save()
        self.period(name='Historical', lifecycle_status='CLOSED', assessment='P2')
        with self.assertRaises(MarksStateConflict):
            update_rubric(rubric=self.rubric, actor=self.office_admin, values={'allowed_evaluator_roles':['PANEL']})
        clone = clone_rubric_version(rubric=self.rubric, actor=self.office_admin)
        clone = update_rubric(rubric=clone, actor=self.office_admin, values={'allowed_evaluator_roles':['PANEL']})
        period = self.classified(name='New', rubric=clone, evaluator_roles=['PANEL'])
        self.assertEqual(publish_evaluation_period(period=period, actor=self.office_admin).lifecycle_status, 'PUBLISHED')
