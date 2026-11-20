"""Public coordinator callback contract; Registry owns the outer transaction."""
import importlib.util
from types import SimpleNamespace
from unittest.mock import patch

from django.db import transaction
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from accounts.models import ProjectRegistration
from . import test_stage_corrections as fixtures


class ContractAvailableTests(SimpleTestCase):
    def test_public_contract_exists(self):
        self.assertIsNotNone(importlib.util.find_spec('marks.stage_changes'))

    def test_apply_requires_callers_transaction(self):
        from .stage_changes import apply_stage_change
        with self.assertRaises(RuntimeError):
            apply_stage_change(student_id=1, academic_semester=None, old_stage='P1',
                new_stage='P2', token='', actor=None, reason='Correction')


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class StageChangeContractTests(APITestCase):
    setUp = fixtures.StageCorrectionTests.setUp
    user = fixtures.StageCorrectionTests.user
    lecturer = fixtures.StageCorrectionTests.lecturer
    profile = fixtures.StageCorrectionTests.profile
    payload = fixtures.StageCorrectionTests.payload
    period = fixtures.StageCorrectionTests.period
    publish = fixtures.StageCorrectionTests.publish
    setup_tasks = fixtures.StageCorrectionTests.setup_tasks
    task = fixtures.StageCorrectionTests.task

    def preview_contract(self, old_stage='P1', new_stage='P2'):
        from .stage_changes import preview_stage_change
        return preview_stage_change(student_id=self.student.pk,
            academic_semester=self.semester, old_stage=old_stage, new_stage=new_stage)

    def apply_contract(self, token, old_stage='P1', new_stage='P2'):
        from .stage_changes import apply_stage_change
        return apply_stage_change(student_id=self.student.pk,
            academic_semester=self.semester, old_stage=old_stage, new_stage=new_stage,
            token=token, actor=self.office, reason='Coordinator correction')

    def test_public_callback_preserves_work_and_survives_registry_save(self):
        self.setup_tasks()
        empty = self.task()
        draft = self.task(state='DRAFT', period=self.period())
        submitted = self.task(state='SUBMITTED', period=self.period())
        preview = self.preview_contract()
        self.assertEqual(set(preview), {'notStarted', 'draft', 'submitted', 'token'})
        self.assertEqual([preview[key] for key in ('notStarted', 'draft', 'submitted')], [1, 1, 1])
        ProjectRegistration.objects.filter(pk=self.record.pk).update(stage='P2', revision=2)
        self.apply_contract(preview['token'])
        empty.refresh_from_db(); draft.refresh_from_db(); submitted.refresh_from_db()
        self.assertEqual((empty.lifecycle_status, draft.lifecycle_status), ('RETIRED', 'PAUSED'))
        self.assertEqual(submitted.mark_entry.status, 'SUBMITTED')
        self.assertEqual(submitted.mark_entry.comments, 'Keep my comments')
        self.assertTrue(submitted.lifecycle_audits.filter(action='STAGE_REVIEW').exists())

    def test_public_token_rejects_changed_work_and_changed_arguments(self):
        from .stage_changes import StageChangeStale
        self.setup_tasks()
        draft = self.task(state='DRAFT')
        token = self.preview_contract()['token']
        for kwargs in ({'old_stage': None}, {'new_stage': None}):
            with self.assertRaises(StageChangeStale):
                self.apply_contract(token, **kwargs)
        draft.mark_entry.comments = 'Edited since preview'
        draft.mark_entry.save(update_fields=['comments'])
        with self.assertRaises(StageChangeStale):
            self.apply_contract(token)
        draft.refresh_from_db()
        self.assertEqual(draft.lifecycle_status, 'ACTIVE')
        self.assertFalse(draft.lifecycle_audits.exists())

    def test_public_token_detects_new_tasks_and_is_not_reusable(self):
        from .stage_changes import StageChangeStale
        self.setup_tasks()
        token = self.preview_contract()['token']
        self.task()
        with self.assertRaises(StageChangeStale):
            self.apply_contract(token)
        token = self.preview_contract()['token']
        self.apply_contract(token)
        with self.assertRaises(StageChangeStale):
            self.apply_contract(token)

    def test_public_token_cannot_be_used_for_another_student(self):
        from .stage_changes import StageChangeStale, apply_stage_change
        self.setup_tasks(); self.task()
        other = self.profile('other-student').student.student
        with self.assertRaises(StageChangeStale):
            apply_stage_change(student_id=other.pk, academic_semester=self.semester,
                old_stage='P1', new_stage='P2', token=self.preview_contract()['token'],
                actor=self.office, reason='Coordinator correction')

    def test_public_callback_rolls_back_with_registry(self):
        self.setup_tasks()
        draft = self.task(state='DRAFT')
        token = self.preview_contract()['token']
        with self.assertRaisesRegex(RuntimeError, 'Registry audit failed'):
            with transaction.atomic():
                ProjectRegistration.objects.filter(pk=self.record.pk).update(stage='P2', revision=2)
                self.apply_contract(token)
                raise RuntimeError('Registry audit failed')
        self.record.refresh_from_db(); draft.refresh_from_db()
        self.assertEqual((self.record.stage, self.record.revision, draft.lifecycle_status), ('P1', 1, 'ACTIVE'))
        self.assertFalse(draft.lifecycle_audits.exists())

    def test_none_retires_tasks_but_matching_stage_leaves_them_alone(self):
        self.setup_tasks()
        task = self.task()
        preview = self.preview_contract(new_stage='P1')
        self.assertEqual(preview['notStarted'], 0)
        self.apply_contract(preview['token'], new_stage='P1')
        self.assertFalse(task.lifecycle_audits.exists())
        preview = self.preview_contract(new_stage=None)
        self.apply_contract(preview['token'], new_stage=None)
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, 'RETIRED')

    def test_preview_does_not_depend_on_old_lookup_metadata(self):
        self.setup_tasks(); self.task()
        with patch('marks.stage_corrections.project_stages', side_effect=AssertionError('Old lookup used')):
            self.assertEqual(self.preview_contract()['notStarted'], 1)

    def test_new_lookup_states_need_only_public_fields(self):
        from .stage_eligibility import period_stage_eligibility
        self.setup_tasks()
        for state, stage, expected in (
            ('ON_PROJECT', 'P1', True), ('ON_PROJECT', 'P2', False),
            ('NOT_STARTED', None, False), ('COMPLETED', None, False),
            ('NOT_STUDYING', None, False), ('NOT_CONFIRMED', None, False),
        ):
            with self.subTest(state=state, stage=stage), patch('marks.stage_eligibility.project_stages',
                    return_value={self.student.pk: SimpleNamespace(state=state, stage=stage, reason='')}):
                result = period_stage_eligibility(self.period_obj, [self.student.pk])[self.student.pk]
                self.assertEqual(result.eligible, expected)
