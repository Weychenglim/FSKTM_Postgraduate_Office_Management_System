"""Stage boundaries at the existing Marks write and Office preview paths."""
from django.core.exceptions import ValidationError
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from accounts.models import ProjectRegistration, StudentSemester
from . import test_period_targeting as fixtures
from .completion_windows import grant_completion_windows, task_access
from .models import EvaluationTask, MarkEntry
from .services import (
    MarksStateConflict, ensure_period_tasks,
    reconcile_evaluation_task, retire_official_evaluation_tasks,
    resume_student_evaluation_tasks,
)
from .test_write_helpers import submission_payload, with_version


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class StageIntegrationTests(APITestCase):
    setUp = fixtures.PeriodTargetingTests.setUp
    user = fixtures.PeriodTargetingTests.user
    lecturer = fixtures.PeriodTargetingTests.lecturer
    profile = fixtures.PeriodTargetingTests.profile
    payload = fixtures.PeriodTargetingTests.payload
    period = fixtures.PeriodTargetingTests.period
    preview = fixtures.PeriodTargetingTests.preview
    publish = fixtures.PeriodTargetingTests.publish

    def registered(self, name, stage='P1', **kwargs):
        profile = self.profile(name, **kwargs)
        ProjectRegistration.objects.update_or_create(
            student_id=profile.student_id, academic_semester=self.semester,
            defaults={'stage': stage, 'status': 'CONFIRMED'},
        )
        return profile

    def task(self, profile, period, **kwargs):
        return EvaluationTask.objects.create(
            profile=profile, period=period, evaluator=self.supervisor,
            evaluator_role='SUPERVISOR', **kwargs,
        )

    def test_preview_and_generation_use_only_matching_effective_stages(self):
        self.registered('match')
        rp2 = self.profile('progressed')
        previous = AcademicSemester.objects.create(
            code='TARGET-PREV', academic_session='2025/2026', term='SEMESTER_II',
            starts_on=self.semester.starts_on - timezone.timedelta(days=90),
            ends_on=self.semester.starts_on - timezone.timedelta(days=1),
            created_by=self.office,
        )
        StudentSemester.objects.create(student_id=rp2.student_id,
            session=previous.academic_session, term=previous.term)
        ProjectRegistration.objects.filter(student_id=rp2.student_id).update(
            academic_semester=previous, source=ProjectRegistration.Source.STUDENT)
        missing = self.profile('missing', appointed=False)
        StudentSemester.objects.filter(student_id=missing.student_id).delete()
        self.registered('none', 'NONE')
        void = self.registered('void', appointed=False)
        ProjectRegistration.objects.filter(student_id=void.student_id).update(status='VOIDED')
        leave = self.registered('leave')
        StudentSemester.objects.filter(student_id=leave.student_id).update(outcome='LEAVE')
        self.registered('no-appointment', appointed=False)
        self.profile('unlinked', linked=False)
        period = self.period()
        preview = self.preview(period)
        self.assertEqual({row['matricNo'] for row in preview['recipients']}, {'match'})
        self.assertEqual(preview['missingAppointments'], {'supervisor': 1, 'panel': 1})
        self.assertEqual(preview['eligibility']['expectedStudents'], 2)
        self.assertEqual(preview['eligibility']['excludedStudents'], 6)
        reasons = {row['matricNo']: row['reason'] for row in preview['exclusions']}
        self.assertEqual(reasons, {'progressed': 'STAGE_MISMATCH', 'missing': 'NO_SEMESTER_ROW',
                                  'none': 'NOT_STARTED', 'void': 'NOT_STARTED',
                                  'leave': 'ON_LEAVE', 'unlinked': 'STUDENT_NOT_LINKED'})
        self.publish(period)
        ensure_period_tasks(period, actor=self.office)
        self.assertEqual(set(EvaluationTask.objects.values_list('profile__matric_no', flat=True)), {'match'})
        rp2_period = self.period(assessment='P2')
        self.publish(rp2_period)
        ensure_period_tasks(rp2_period, actor=self.office)
        self.assertEqual(set(rp2_period.tasks.values_list('profile__matric_no', flat=True)), {'progressed'})

    def test_records_period_options_include_empty_published_periods_and_exclude_drafts(self):
        draft = self.period()
        published = self.period(assessment='P2')
        self.publish(published)
        self.assertFalse(published.tasks.exists())
        response = self.client.get('/api/marks/periods/?recordOptions=true')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [{
            'id': published.pk, 'name': published.name, 'assessment': 'P2',
            'semester': self.semester.label, 'effectiveStatus': 'OPEN', 'lifecycleStatus': 'PUBLISHED',
            'closesAt': published.closes_at.isoformat(),
        }])
        self.assertEqual(draft.lifecycle_status, 'DRAFT')
        self.client.force_authenticate(self.supervisor)
        self.assertEqual(self.client.get('/api/marks/periods/?recordOptions=true').status_code, 403)

    def test_unlinked_profile_is_not_matched_by_matric_to_supervisor(self):
        linked = self.registered('legacy-match')
        linked.student = None
        linked.save(update_fields=['student'])
        period = self.period()
        self.assertEqual(self.preview(period)['recipients'], [])

    def test_missing_period_assessment_blocks_generation(self):
        self.registered('unclassified')
        period = self.period()
        self.publish(period)
        period.assessment = ''
        period.save(update_fields=['assessment'])
        with self.assertRaises(MarksStateConflict):
            ensure_period_tasks(period, actor=self.office)

    def test_resume_keeps_wrong_stage_draft_paused(self):
        profile = self.registered('wrong-resume', 'P2')
        period = self.period()
        self.publish(period)
        task = self.task(profile, period, lifecycle_status='PAUSED')
        entry = MarkEntry.objects.create(task=task, comments='Keep this draft')
        result = resume_student_evaluation_tasks(profile=profile, actor=self.office, reason='Return')
        task.refresh_from_db()
        entry.refresh_from_db()
        self.assertEqual(result['resumed'], [])
        self.assertEqual(task.lifecycle_status, 'PAUSED')
        self.assertEqual(entry.comments, 'Keep this draft')
        with self.assertRaises(MarksStateConflict):
            reconcile_evaluation_task(task_id=task.pk, action='RESUMED', actor=self.office, reason='Review')

    def test_handover_does_not_create_wrong_stage_replacement(self):
        profile = self.registered('wrong-handover', 'P2')
        period = self.period()
        self.publish(period)
        self.task(profile, period)
        retire_official_evaluation_tasks(profile=profile, evaluator=self.supervisor,
            evaluator_role='SUPERVISOR', actor=self.office, reason='Replacement',
            replacement_evaluator=self.backup)
        self.assertFalse(EvaluationTask.objects.filter(evaluator=self.backup).exists())

    def test_replacement_backfill_does_not_create_wrong_stage_task(self):
        from types import SimpleNamespace
        from appointments.models import SupervisorAppointment
        from .services import ensure_replacement_evaluation_tasks
        profile = self.registered('wrong-backfill', 'P2')
        period = self.period()
        self.publish(period)
        self.task(profile, period, lifecycle_status='RETIRED')
        ensure_replacement_evaluation_tasks(
            old_appointment=SupervisorAppointment.objects.get(student_id=profile.student_id),
            replacement_appointment=SimpleNamespace(supervisor=self.backup),
            actor=self.office, reason='Replace retired assignment',
        )
        self.assertFalse(EvaluationTask.objects.filter(evaluator=self.backup).exists())

    def test_confirmed_student_without_profile_is_listed_as_missing_profile(self):
        from accounts.models import Student
        student = Student.objects.create(user=self.user('without-profile', 'STUDENT'), matric_no='NO-PROFILE', programme='Programme A')
        StudentSemester.objects.create(student=student, session=self.semester.academic_session,
            term=self.semester.term, outcome='STUDIED')
        ProjectRegistration.objects.create(student=student, academic_semester=self.semester, stage='P1')
        period = self.period()
        preview = self.preview(period)
        self.assertEqual(preview['eligibility']['expectedStudents'], 1)
        self.assertEqual(preview['missingAppointments'], {'supervisor': 1, 'panel': 1})
        self.assertTrue(all(row['studentId'] == student.pk and row['reason'] == 'MISSING_RESEARCH_PROFILE' for row in preview['missingAssignments']))
        self.assertEqual(len(preview['missingAssignments']), 1)

    def test_return_to_active_uses_new_status_before_resuming(self):
        from accounts.models import Student
        from accounts.participant_lifecycle import transition_student
        profile = self.registered('return-to-active')
        period = self.period()
        self.publish(period)
        task = self.task(profile, period, lifecycle_status='PAUSED')
        Student.objects.filter(pk=profile.student_id).update(status=Student.Status.DEFERRED)
        transition_student(matric_no=profile.matric_no, actor=self.office, target_status='ACTIVE', reason='Return to study')
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, 'ACTIVE')

    def test_stage_change_blocks_existing_window_draft_submit_and_new_extension(self):
        profile = self.registered('write-guard')
        period = self.period()
        self.publish(period)
        task = self.task(profile, period)
        grant_completion_windows(task_ids=[task.pk], actor=self.office, reason='More time',
            deadline=timezone.now()+timezone.timedelta(days=10))
        ProjectRegistration.objects.filter(student_id=profile.student_id).update(stage='P2')
        self.assertFalse(task_access(task)['canEdit'])
        self.assertFalse(task_access(task)['canGrantCompletionWindow'])
        with self.assertRaises(MarksStateConflict):
            grant_completion_windows(task_ids=[task.pk], actor=self.office, reason='Again',
                deadline=timezone.now()+timezone.timedelta(days=11))
        self.client.force_authenticate(self.supervisor)
        payload = {'scores': [], 'comments': 'Blocked'}
        self.assertEqual(self.client.put(f'/api/marks/tasks/{task.pk}/draft/', with_version(task, payload), format='json').status_code, 409)
        self.assertEqual(self.client.post(f'/api/marks/tasks/{task.pk}/submit/', submission_payload(task), format='json').status_code, 409)
        self.assertFalse(MarkEntry.objects.filter(task=task).exists())

    def test_paused_task_is_not_recreated_by_generation(self):
        profile = self.registered('paused')
        period = self.period(evaluatorRoles=['SUPERVISOR'])
        self.publish(period)
        self.task(profile, period, lifecycle_status='PAUSED')
        ensure_period_tasks(period, actor=self.office)
        self.assertEqual(EvaluationTask.objects.filter(profile=profile).count(), 1)
        self.assertEqual(self.preview(period)['totals']['new'], 0)

    def test_student_without_appointment_is_discoverable_in_registry(self):
        profile = self.profile('unappointed', appointed=False)
        ProjectRegistration.objects.filter(student_id=profile.student_id).delete()
        response = self.client.get(f'/api/registry/project-stages/?semester={self.semester.pk}')
        self.assertEqual(response.status_code, 200)
        row = next(row for row in response.data['rows'] if row['matric'] == profile.matric_no)
        self.assertEqual(row['shown'], 'NOT_STARTED')
        self.assertFalse(row['noSupervisor'])

    def test_handover_and_generation_cannot_bypass_paused_work(self):
        from types import SimpleNamespace
        from appointments.models import SupervisorApplication, SupervisorAppointment
        from .services import ensure_replacement_evaluation_tasks
        profile = self.registered('paused-handover')
        period = self.period(evaluatorRoles=['SUPERVISOR'])
        self.publish(period)
        paused = self.task(profile, period, lifecycle_status='PAUSED')
        MarkEntry.objects.create(task=paused, comments='Protected paused feedback')
        old = SupervisorAppointment.objects.get(student_id=profile.student_id)
        ensure_replacement_evaluation_tasks(old_appointment=old,
            replacement_appointment=SimpleNamespace(supervisor=self.backup), actor=self.office, reason='Handover')
        self.assertFalse(EvaluationTask.objects.filter(evaluator=self.backup).exists())
        old.status = 'ENDED'
        old.save(update_fields=['status'])
        application = SupervisorApplication.objects.create(student_id=profile.student_id,
            proposed_supervisor=self.backup, research_title='Replacement', research_abstract='Research', status='APPROVED')
        SupervisorAppointment.objects.create(application=application, student_id=profile.student_id,
            supervisor=self.backup, approved_by=self.office)
        self.assertEqual(ensure_period_tasks(period, actor=self.office)['total'], 0)
        preview = self.preview(period)
        self.assertEqual(preview['recipients'][0]['taskStatus'], 'BLOCKED')
        self.assertEqual(preview['totals']['new'], 0)
        self.assertEqual(preview['missingAppointments']['supervisor'], 0)
        self.assertEqual(EvaluationTask.objects.filter(profile=profile).count(), 1)
        self.assertEqual(MarkEntry.objects.get(task=paused).comments, 'Protected paused feedback')

    def test_handover_does_not_duplicate_paused_replacement_assignment(self):
        profile = self.registered('paused-target')
        period = self.period(evaluatorRoles=['SUPERVISOR'])
        self.publish(period)
        self.task(profile, period)
        EvaluationTask.objects.create(profile=profile, period=period, evaluator=self.backup,
            evaluator_role='SUPERVISOR', lifecycle_status='PAUSED')
        retire_official_evaluation_tasks(profile=profile, evaluator=self.supervisor,
            evaluator_role='SUPERVISOR', replacement_evaluator=self.backup, actor=self.office, reason='Handover')
        self.assertEqual(EvaluationTask.objects.filter(evaluator=self.backup).count(), 1)

    def test_reconciliation_cannot_resume_out_of_scope_task(self):
        from accounts.models import Student
        profile = self.registered('resume-scope')
        period = self.period(programmeScope='SELECTED', programmes=['Programme A'])
        self.publish(period)
        task = self.task(profile, period, lifecycle_status='PAUSED')
        Student.objects.filter(pk=profile.student_id).update(programme='Programme B')
        with self.assertRaises(MarksStateConflict):
            reconcile_evaluation_task(task_id=task.pk, action='RESUMED', actor=self.office, reason='Resume')

    def test_preview_query_count_is_bounded_for_students_with_intakes(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        from accounts.models import Student
        from .targeting import recipient_preview
        first = self.registered('batch-intake-first')
        Student.objects.filter(pk=first.student_id).update(intake_semester='Sem 1 2026/2027')
        period = self.period()
        with CaptureQueriesContext(connection) as baseline:
            recipient_preview(period)
        for index in range(8):
            self.registered(f'batch-intake-{index}')
        Student.objects.all().update(intake_semester='Sem 1 2026/2027')
        with CaptureQueriesContext(connection) as expanded:
            preview = recipient_preview(period)
        self.assertEqual(preview['totals']['students'], 9)
        self.assertLessEqual(len(expanded), len(baseline) + 2)

    def test_stale_unlinked_profile_requires_retry_before_resume(self):
        from accounts.models import Student
        from appointments.models import StudentResearchProfile
        legacy = self.profile('relinked-legacy', linked=False)
        period = self.period()
        self.publish(period)
        task = self.task(legacy, period, lifecycle_status='PAUSED')
        student = Student.objects.create(user=self.user('legacy-linked', 'STUDENT'), matric_no=legacy.matric_no)
        StudentSemester.objects.create(student=student, session=self.semester.academic_session,
            term=self.semester.term, outcome='STUDIED')
        ProjectRegistration.objects.create(student=student, academic_semester=self.semester, stage='P1')
        StudentResearchProfile.objects.filter(pk=legacy.pk).update(student=student.user)
        with self.assertRaises(MarksStateConflict):
            resume_student_evaluation_tasks(profile=legacy, actor=self.office, reason='Resume after concurrent linking')
        task.refresh_from_db()
        self.assertEqual(task.lifecycle_status, 'PAUSED')
