from django.contrib import admin
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.admin import StudentAdmin, StudentInline
from accounts.models import Student, User
from accounts.participant_lifecycle import transition_student
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

    def request_amendment(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.post(self.base, {
            'kind': 'RESEARCH', 'reason': 'Documented academic change.', 'title': 'An amended title',
        }, format='json')
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

    def test_withdrawal_cancels_pending_research(self):
        pk = self.request_amendment()
        transition_student(matric_no=self.student.matric_no, actor=self.office,
                           target_status='WITHDRAWN', reason='Student withdrew.')
        self.assertEqual(self.status_of(pk), 'CANCELLED')

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
