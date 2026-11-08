from django.contrib import admin
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.admin import StudentAdmin, StudentInline
from accounts.models import Student, User
from accounts.participant_lifecycle import transition_student
from accounts.test_registry_semesters import semesters_for
from . import test_appointment_lifecycle as fixture
from .models import SupervisorApplication
from .supervisor_handoff import _resolve_research_profile


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class AmendmentLifecycleTests(APITestCase):
    _lecturer = fixture.AppointmentLifecycleTests._lecturer
    base = '/api/appointments/research-amendments/'

    def setUp(self):
        fixture.AppointmentLifecycleTests.setUp(self)
        self.office.is_staff = True
        self.office.save(update_fields=['is_staff'])

    def request_amendment(self, kind='RESEARCH'):
        self.client.force_authenticate(user=self.office if kind == 'TRANSFER' else self.student_user)
        data = {'kind': kind, 'reason': 'Documented academic change.'}
        if kind == 'TRANSFER':
            data.update(studentId=self.student.pk, destinationProgramme='MASTER OF SOFTWARE ENGINEERING')
        else:
            data['title'] = 'An amended title'
        response = self.client.post(self.base, data, format='json')
        self.assertEqual(response.status_code, 201, getattr(response, 'data', None))
        return response.data['id']

    def status_of(self, pk):
        self.client.force_authenticate(user=self.office)
        return self.client.get(f'{self.base}{pk}/').data['status']

    def test_primary_closure_cancels_pending_research(self):
        pk = self.request_amendment()
        self.client.force_authenticate(user=self.office)
        response = self.client.post(
            f'/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/end/',
            {'outcome': 'OTHER', 'reason': 'Primary supervisor leaves.'}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.status_of(pk), 'CANCELLED')

    def test_graduation_cancels_pending_transfer(self):
        pk = self.request_amendment('TRANSFER')
        semesters_for(self.student, "Semester I, 2026/2027", "Semester II, 2026/2027", "Semester I, 2027/2028")
        transition_student(matric_no=self.student.matric_no, actor=self.office,
                           target_status='GRADUATED', reason='Programme completed.')
        self.assertEqual(self.status_of(pk), 'CANCELLED')

    def test_withdrawal_cancels_pending_research(self):
        pk = self.request_amendment()
        transition_student(matric_no=self.student.matric_no, actor=self.office,
                           target_status='WITHDRAWN', reason='Student withdrew.')
        self.assertEqual(self.status_of(pk), 'CANCELLED')

    def test_transfer_blocks_supporting_nomination(self):
        self.request_amendment('TRANSFER')
        self.client.force_authenticate(user=self.supervisor)
        response = self.client.post('/api/appointments/co-supervisor/nominations/', {
            'studentId': self.student.pk, 'candidateId': self.new_supervisor.pk,
            'justification': 'Supporting expertise.',
        }, format='json')
        self.assertEqual(response.status_code, 409, response.data)
        self.assertFalse(self.student.co_supervisor_nominations.exists())

    def test_transfer_blocks_panel_nomination(self):
        self.request_amendment('TRANSFER')
        self.client.force_authenticate(user=self.supervisor)
        response = self.client.post('/api/appointments/panel/recommendations/', {
            'studentId': self.student.matric_no,
            'recommendedMemberId': self.panel.lecturer.staff_no,
            'justification': 'Panel expertise.',
        }, format='json')
        self.assertEqual(response.status_code, 409, response.data)
        self.assertFalse(self.profile.panel_recommendations.exists())

    def test_transfer_blocks_primary_replacement_submission(self):
        self.request_amendment('TRANSFER')
        self.client.force_authenticate(user=self.office)
        response = self.client.post(f'/api/appointments/supervisor/appointments/{self.supervisor_appointment.pk}/replacement/', {
            'proposedSupervisorId': self.new_supervisor.lecturer.staff_no,
            'reason': 'Primary change.',
        }, format='json')
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(self.student.supervisor_applications.count(), 1)

    def test_handoff_preserves_correction_without_panel_or_marks_history(self):
        self.client.force_authenticate(user=self.office)
        response = self.client.post(self.base + 'corrections/', {
            'studentId': self.student.pk, 'title': 'Corrected historical title',
            'abstract': 'Corrected abstract.', 'reason': 'Spelling correction.',
            'meaningUnchanged': True, 'expectedRevision': 0,
        }, format='json')
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        replacement = SupervisorApplication.objects.create(
            student=self.student, academic_semester=self.semester,
            proposed_supervisor=self.new_supervisor,
            research_title=self.application.research_title,
            research_area=self.application.research_area,
            research_abstract=self.application.research_abstract,
            replaces_appointment=self.supervisor_appointment,
        )
        profile = _resolve_research_profile(replacement)
        self.assertEqual(profile.proposed_topic, 'Corrected historical title')
        self.assertEqual(profile.abstract, 'Corrected abstract.')
        self.assertEqual(profile.supervisor_id, self.new_supervisor.pk)

    def test_handoff_preserves_recorded_baseline_after_cancelled_amendment(self):
        pk = self.request_amendment()
        response = self.client.post(f'{self.base}{pk}/cancel/',
                                    {'reason': 'Proposal withdrawn.'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        baseline = self.profile.revisions.get(revision=0)
        replacement = SupervisorApplication.objects.create(
            student=self.student, academic_semester=self.semester,
            proposed_supervisor=self.new_supervisor,
            research_title='Replacement application wording',
            research_area=self.application.research_area,
            research_abstract='Different replacement abstract.',
            replaces_appointment=self.supervisor_appointment,
        )
        profile = _resolve_research_profile(replacement)
        self.assertEqual(profile.proposed_topic, baseline.after_values['title'])
        self.assertEqual(profile.abstract, baseline.after_values['abstract'])
        self.assertEqual(profile.revision, 0)
        self.assertEqual(profile.supervisor_id, self.new_supervisor.pk)

    def test_admin_cannot_bypass_linked_programme_audit(self):
        standalone = StudentAdmin(Student, admin.site)
        inline = StudentInline(User, admin.site)
        self.assertIn('programme', standalone.get_readonly_fields(None, self.student))
        self.assertIn('programme', inline.get_readonly_fields(None, self.student_user))
        self.assertNotIn('programme', standalone.get_readonly_fields(None, None))
        self.assertNotIn('programme', inline.get_readonly_fields(None, None))

    def test_transfer_preserves_marks_and_windows_and_changes_new_eligibility(self):
        from marks.models import (EvaluationPeriod, EvaluationTask, MarkEntry, MarkScore,
                                  Rubric, RubricComponent, TaskCompletionWindow)
        from marks.completion_windows import grant_completion_windows, task_access
        from marks.targeting import profile_in_scope
        rubric = Rubric.objects.create(name='Transfer preservation', code='transfer-preservation')
        component = RubricComponent.objects.create(rubric=rubric, code='research', name='Research', max_marks=100)
        period = EvaluationPeriod.objects.create(
            name='Source evaluation', semester=self.semester.label, academic_semester=self.semester,
            rubric=rubric, lifecycle_status='PUBLISHED',
            opens_at=timezone.now() - timezone.timedelta(days=2),
            closes_at=timezone.now() + timezone.timedelta(days=2),
            programme_scope='SELECTED', programmes=[self.student.programme],
        )
        task = EvaluationTask.objects.create(period=period, profile=self.profile,
                                            evaluator=self.supervisor, evaluator_role='SUPERVISOR')
        draft = MarkEntry.objects.create(task=task, status='DRAFT')
        MarkScore.objects.create(entry=draft, component=component, marks_awarded=70)
        grant_completion_windows(task_ids=[task.pk], actor=self.office, reason='Approved extension.',
                                 deadline=timezone.now() + timezone.timedelta(days=5))
        submitted_task = EvaluationTask.objects.create(period=period, profile=self.profile,
                                                      evaluator=self.panel, evaluator_role='BACKUP')
        submitted = MarkEntry.objects.create(task=submitted_task, status='SUBMITTED', total_mark=85)
        MarkScore.objects.create(entry=submitted, component=component, marks_awarded=85)
        models = (EvaluationTask, MarkEntry, MarkScore, TaskCompletionWindow)
        before = {model: list(model.objects.order_by('pk').values()) for model in models}
        pk = self.request_amendment('TRANSFER')
        for actor in (self.coordinator, self.other_coordinator):
            self.client.force_authenticate(user=actor)
            stage = self.client.get(f'{self.base}{pk}/').data['status']
            response = self.client.post(f'{self.base}{pk}/decision/',
                                       {'decision': 'APPROVE', 'retainTeam': True, 'expectedStatus': stage}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
        for model, snapshot in before.items():
            self.assertEqual(list(model.objects.order_by('pk').values()), snapshot)
        profile = type(self.profile).objects.select_related('student__student').get(pk=self.profile.pk)
        self.assertFalse(profile_in_scope(period, profile))
        period.programmes = ['MASTER OF SOFTWARE ENGINEERING']
        self.assertTrue(profile_in_scope(period, profile))
        self.assertTrue(task_access(EvaluationTask.objects.get(pk=task.pk))['canEdit'])
