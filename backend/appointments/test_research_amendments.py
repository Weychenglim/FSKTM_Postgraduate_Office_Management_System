from django.core.exceptions import ValidationError
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import Student
from . import test_appointment_lifecycle as fixture


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class ResearchAmendmentTests(APITestCase):
    def setUp(self):
        fixture.AppointmentLifecycleTests.setUp(self)
        self.office.is_staff = False
        self.office.save(update_fields=['is_staff'])
    _lecturer = fixture.AppointmentLifecycleTests._lecturer
    base = '/api/appointments/research-amendments/'

    def post(self, actor, suffix='', **data):
        self.client.force_authenticate(user=actor)
        if suffix.endswith('/decision/') and 'expectedStatus' not in data:
            detail = self.client.get(self.base + suffix.replace('/decision/', '/'))
            if detail.status_code == 200:
                data['expectedStatus'] = detail.data['status']
        return self.client.post(self.base + suffix, data, format='json')

    def research(self):
        result = self.post(self.student_user, kind='RESEARCH', title='Revised research', reason='Changed scope')
        self.assertEqual(result.status_code, 201, result.data)
        return result.data['id']

    def test_profile_link_resolves_only_existing_profile_access(self):
        fixture.AppointmentLifecycleTests._panel_appointment(self)
        endpoint = self.base + 'profile-link/'
        for actor, expected in (
            (self.student_user, self.student_user.pk),
            (self.supervisor, self.student_user.pk),
            (self.coordinator, self.student_user.pk),
            (self.office, self.student_user.pk),
            (self.panel, None),
            (self.new_supervisor, None),
            (self.other_coordinator, None),
        ):
            with self.subTest(actor=actor.pk):
                self.client.force_authenticate(user=actor)
                response = self.client.get(endpoint, {'matricNo': self.student.matric_no})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, {'studentId': expected})
                self.assertIn('no-store', response['Cache-Control'])
        self.client.force_authenticate(user=self.office)
        response = self.client.get(endpoint, {'matricNo': self.student.matric_no + '-missing'})
        self.assertEqual(response.data, {'studentId': None})

    def test_scoped_profiles_share_the_approved_plan_and_keep_the_original_separate(self):
        from .models import SupervisorApplication
        from .research_intent_test_helpers import valid_research_intent

        intent = valid_research_intent()
        SupervisorApplication.objects.filter(pk=self.application.pk).update(research_intent=intent)
        request_id = self.post(
            self.student_user, kind='RESEARCH', title='Revised research',
            planChanges={'methodology': 'Use an approved survey.'}, reason='Changed scope',
        ).data['id']
        self.assertEqual(self.post(self.supervisor, f'{request_id}/decision/', decision='APPROVE').status_code, 200)

        endpoint = self.base + 'options/'
        self.client.force_authenticate(user=self.student_user)
        self.assertNotIn('submittedIntent', self.client.get(endpoint).data['profile'])
        profile = self.client.get(endpoint, {'includeResearchIntent': 'true'}).data['profile']
        self.assertEqual(profile['title'], 'Revised research')
        self.assertEqual(profile['researchArea'], self.profile.research_area)
        self.assertEqual(profile['submittedIntent'], {
            'record': intent, 'submittedAt': self.application.submitted_at.isoformat(),
            'titleOrAbstractChanged': True,
        })
        self.assertEqual(profile['currentIntent'], {**intent, 'methodology': 'Use an approved survey.'})
        for actor in (self.supervisor, self.coordinator, self.office):
            with self.subTest(role=actor.role):
                self.client.force_authenticate(user=actor)
                response = self.client.get(endpoint, {'studentId': self.student_user.pk})
                self.assertNotIn('currentIntent', response.data['profile'])
                response = self.client.get(endpoint, {
                    'studentId': self.student_user.pk, 'includeResearchIntent': 'true',
                })
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['profile'], {
                    key: value for key, value in profile.items() if key != 'submittedIntent'
                })
        self.client.force_authenticate(user=self.new_supervisor)
        self.assertEqual(self.client.get(endpoint, {
            'studentId': self.student_user.pk, 'includeResearchIntent': 'true',
        }).status_code, 404)

    def test_student_profile_keeps_original_intent_after_supervisor_handover(self):
        from .models import SupervisorApplication
        from .research_intent_test_helpers import valid_research_intent

        original_intent = valid_research_intent()
        SupervisorApplication.objects.filter(pk=self.application.pk).update(research_intent=original_intent)
        replacement = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.new_supervisor,
            research_title=self.profile.proposed_topic,
            research_abstract=self.profile.abstract,
            research_intent=valid_research_intent(introduction='Replacement submission'),
            replaces_appointment=self.supervisor_appointment,
            status=SupervisorApplication.Status.PENDING_COORDINATOR,
        )
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.post(f'/api/appointments/supervisor/applications/{replacement.pk}/coordinator-approve/')
        self.assertEqual(response.status_code, 200, response.data)

        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(self.base + 'options/', {'includeResearchIntent': 'true'})
        self.assertEqual(response.data['profile']['submittedIntent']['record'], original_intent)

    def test_student_profile_can_have_no_submitted_intent(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(self.base + 'options/', {'includeResearchIntent': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['profile']['submittedIntent'])

    def test_plan_amendment_updates_current_plan_and_preserves_submitted_intent(self):
        from .models import ResearchProfileRevision, SupervisorApplication
        from .research_intent_test_helpers import valid_research_intent
        from dashboard.amendment_tracking import amendment_reconciliation_issues

        original = valid_research_intent()
        SupervisorApplication.objects.filter(pk=self.application.pk).update(research_intent=original)
        response = self.post(self.student_user, kind='RESEARCH', reason='Switch to a survey',
            planChanges={'methodology': 'Survey postgraduate students.', 'researchArea': 'Human-computer interaction'})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['before']['methodology'], original['methodology'])
        self.assertNotIn('timeline', response.data['after'])
        self.assertEqual(response.data['after']['methodology'], 'Survey postgraduate students.')
        endpoint = self.base + 'options/'
        self.assertEqual(self.client.get(endpoint, {'includeResearchIntent': 'true'}).data['profile']['currentIntent'], original)

        request_id = response.data['id']
        self.assertEqual(self.post(self.supervisor, f'{request_id}/decision/', decision='APPROVE').status_code, 200)
        revision = ResearchProfileRevision.objects.get(request_id=request_id)
        self.assertEqual(revision.before_values['methodology'], original['methodology'])
        self.assertEqual(revision.after_values['methodology'], 'Survey postgraduate students.')
        self.client.force_authenticate(user=self.student_user)
        profile = self.client.get(endpoint, {'includeResearchIntent': 'true'}).data['profile']
        self.assertEqual(profile['researchArea'], 'Human-computer interaction')
        self.assertEqual(profile['currentIntent'], {**original, 'methodology': 'Survey postgraduate students.'})
        self.assertEqual(profile['submittedIntent']['record'], original)
        self.application.refresh_from_db()
        self.assertEqual(self.application.research_intent, original)

        title_change = self.research()
        self.assertEqual(self.post(self.supervisor, f'{title_change}/decision/', decision='APPROVE').status_code, 200)
        self.assertFalse(any(issue.issue_type.startswith('RESEARCH_') for issue in amendment_reconciliation_issues()))

    def test_missing_intent_can_gain_its_first_value_and_rejects_unsupported_fields(self):
        invalid = self.post(self.student_user, kind='RESEARCH', reason='Set the plan',
            planChanges={'introduction': 'Not an editable field.'})
        self.assertEqual(invalid.status_code, 400)
        blank = self.post(self.student_user, kind='RESEARCH', title='Also changed', reason='Set the plan',
            planChanges={'methodology': ' '})
        self.assertEqual(blank.status_code, 400)
        response = self.post(self.student_user, kind='RESEARCH', reason='Set the plan',
            planChanges={'methodology': 'Survey postgraduate students.'})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['before']['methodology'], '')
        self.assertEqual(self.post(self.supervisor, f"{response.data['id']}/decision/", decision='APPROVE').status_code, 200)
        self.client.force_authenticate(user=self.student_user)
        profile = self.client.get(self.base + 'options/', {'includeResearchIntent': 'true'}).data['profile']
        self.assertIsNone(profile['submittedIntent'])
        self.assertEqual(profile['currentIntent'], {'methodology': 'Survey postgraduate students.'})

    def test_reviewer_cannot_approve_stale_plan_values(self):
        from .models import ResearchProfileRevision, StudentResearchProfile

        response = self.post(self.student_user, kind='RESEARCH', reason='Set the plan',
            planChanges={'timeline': 'Analyse surveys in May.'})
        self.assertEqual(response.status_code, 201, response.data)
        StudentResearchProfile.objects.filter(pk=self.profile.pk).update(
            approved_intent_changes={'timeline': 'Analyse surveys in June.'})
        request_id = response.data['id']
        result = self.post(self.supervisor, f'{request_id}/decision/', decision='APPROVE')
        self.assertEqual(result.status_code, 409, result.data)
        self.assertFalse(ResearchProfileRevision.objects.filter(request_id=request_id).exists())

    def test_student_cannot_submit_against_a_stale_form_revision(self):
        from .models import ResearchAmendment

        response = self.post(self.student_user, kind='RESEARCH', reason='Use a different method',
            expectedRevision=self.profile.revision + 1, planChanges={'methodology': 'Run a survey'})
        self.assertEqual(response.status_code, 409, response.data)
        self.assertFalse(ResearchAmendment.objects.exists())

    def test_programme_transfer_creation_is_unavailable(self):
        from .models import ResearchAmendment
        self.client.force_authenticate(user=self.office)
        options = self.client.get(self.base + 'options/', {'studentId': self.student.pk})
        self.assertEqual(options.status_code, 200)
        self.assertFalse(options.data['canTransfer'])
        response = self.post(self.office, kind='TRANSFER', studentId=self.student.pk,
            destinationProgramme='MASTER OF SOFTWARE ENGINEERING', reason='Transfer')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(ResearchAmendment.objects.filter(kind='TRANSFER').exists())

    def test_supervisor_finalizes_research_and_preserves_original_proposal(self):
        pk = self.research()
        result = self.post(self.coordinator, f'{pk}/decision/', decision='APPROVE')
        self.assertEqual(result.status_code, 403)
        result = self.post(self.supervisor, f'{pk}/decision/', decision='APPROVE')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['status'], 'APPROVED')
        self.assertEqual(result.data['events'][-1]['action'], 'APPROVE')
        self.assertEqual(result.data['events'][-1]['actorName'], self.supervisor.full_name)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.proposed_topic, 'Revised research')
        self.assertEqual(self.profile.revision, 1)
        self.assertEqual(self.application.research_title, 'Lifecycle-safe postgraduate workflows')
        self.client.force_authenticate(user=self.supervisor)
        active = self.client.get('/api/appointments/supervisor/supervisees/')
        self.assertEqual(active.status_code, 200)
        self.assertEqual(active.data[0]['researchTitle'], 'Revised research')
        self.assertEqual(active.data[0]['researchAbstract'], self.profile.abstract)
        self.assertEqual(active.data[0]['researchArea'], self.profile.research_area)

        from .models import ResearchAmendment, ResearchProfileRevision
        row = ResearchAmendment.objects.get(pk=pk)
        row.reason = 'rewritten'
        with self.assertRaises(ValidationError):
            row.save()
        self.assertEqual(ResearchProfileRevision.objects.filter(profile=self.profile).count(), 2)
        self.assertEqual(ResearchProfileRevision.objects.get(request_id=pk).actor_id, self.supervisor.pk)

    def test_legacy_coordinator_stage_returns_final_authority_to_primary_supervisor(self):
        from django.db import models
        from .models import ResearchAmendment, ResearchAmendmentEvent
        from dashboard.amendment_tracking import amendment_waiting_metadata, amendment_actions
        from django.utils import timezone
        pk = self.research()
        models.QuerySet(model=ResearchAmendment).filter(pk=pk).update(status='PENDING_COORDINATOR')
        endorsement = ResearchAmendmentEvent.objects.create(
            request_id=pk, actor=self.supervisor, actor_role=self.supervisor.role,
            actor_name=self.supervisor.full_name, action='ENDORSE',
            previous_status='PENDING_SUPERVISOR', new_status='PENDING_COORDINATOR',
            reason='Historical Supervisor endorsement.',
        )
        self.assertEqual(self.post(self.supervisor, f'{pk}/decision/',
            decision='APPROVE', expectedStatus='PENDING_SUPERVISOR').status_code, 409)
        for actor, allowed in ((self.supervisor, True), (self.coordinator, False)):
            self.client.force_authenticate(user=actor)
            detail = self.client.get(self.base + f'{pk}/')
            self.assertEqual(detail.status_code, 200)
            self.assertEqual(detail.data['canDecide'], allowed)
            self.assertEqual(detail.data['stageLabel'], 'Awaiting primary supervisor')
        self.assertEqual(self.post(self.coordinator, f'{pk}/decision/', decision='APPROVE').status_code, 403)
        self.client.force_authenticate(user=self.coordinator)
        queue = self.client.get(self.base, {'page': 1, 'focus': 'decision'})
        self.assertEqual(queue.data['pagination']['reviewCount'], 0)
        self.assertEqual(queue.data['requests'], [])
        self.client.force_authenticate(user=self.office)
        report = self.client.get('/api/dashboard/reports/?semester=all')
        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.data['researchAmendments']['records'][0]['status'], 'PENDING_SUPERVISOR')
        row = ResearchAmendment.objects.get(pk=pk)
        self.assertEqual(amendment_waiting_metadata(row)['waitingOn'], 'SUPERVISOR')
        self.assertFalse(amendment_actions(self.coordinator, timezone.now()))
        self.assertEqual(amendment_actions(self.supervisor, timezone.now())[0]['recordId'], str(pk))
        result = self.post(self.supervisor, f'{pk}/decision/', decision='APPROVE')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['status'], 'APPROVED')
        endorsement.refresh_from_db()
        self.assertEqual(endorsement.new_status, 'PENDING_COORDINATOR')
        self.assertEqual(endorsement.reason, 'Historical Supervisor endorsement.')
        self.assertEqual([event['action'] for event in result.data['events']], ['SUBMIT', 'ENDORSE', 'APPROVE'])

    def test_programme_coordinator_and_supporting_lecturer_have_no_research_decision_authority(self):
        pk = self.research()
        self.client.force_authenticate(user=self.coordinator)
        queue = self.client.get(self.base, {'page': 1, 'focus': 'decision'})
        self.assertEqual(queue.data['pagination']['reviewCount'], 0)
        self.assertEqual(queue.data['requests'], [])
        for actor, expected in ((self.coordinator, 403), (self.new_supervisor, 404)):
            response = self.post(actor, f'{pk}/decision/', decision='APPROVE')
            self.assertEqual(response.status_code, expected)

    def test_active_supervisee_without_linked_profile_uses_original_application(self):
        from .models import StudentResearchProfile
        StudentResearchProfile.objects.filter(pk=self.profile.pk).update(student=None)
        self.client.force_authenticate(user=self.supervisor)
        response = self.client.get('/api/appointments/supervisor/supervisees/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['researchTitle'], self.application.research_title)
        self.assertEqual(response.data[0]['researchAbstract'], self.application.research_abstract)
        self.client.force_authenticate(user=self.new_supervisor)
        self.assertEqual(self.client.get('/api/appointments/supervisor/supervisees/').data, [])

    def test_correction_is_audited_and_conflicts_with_pending(self):
        self.assertEqual(self.post(self.office, 'corrections/', studentId=self.student.pk, title='Typo corrected', reason='Typo', meaningUnchanged=True, expectedRevision=0).status_code, 200)
        self.assertEqual(self.post(self.office, 'corrections/', studentId=self.student.pk, title='Another typo', reason='Typo', meaningUnchanged=True, expectedRevision=0).status_code, 409)
        self.research()
        self.assertEqual(self.post(self.office, 'corrections/', studentId=self.student.pk, title='Another typo', reason='Typo', meaningUnchanged=True, expectedRevision=1).status_code, 409)

    def test_deferred_can_cancel_but_cannot_decide(self):
        pk = self.research()
        Student.objects.filter(pk=self.student.pk).update(status=Student.Status.DEFERRED)
        self.assertEqual(self.post(self.supervisor, f'{pk}/decision/', decision='APPROVE').status_code, 409)
        self.assertEqual(self.post(self.student_user, f'{pk}/cancel/', reason='Withdraw request').status_code, 200)

    def test_unrelated_lecturer_cannot_read_private_amendments(self):
        pk = self.research()
        self.client.force_authenticate(user=self.new_supervisor)
        self.assertEqual(self.client.get(self.base + f'{pk}/').status_code, 404)
        self.assertEqual(self.client.get(self.base).data['requests'], [])

    def test_only_one_pending_and_immutable_audit_queryset(self):
        pk = self.research()
        self.assertEqual(self.post(self.student_user, kind='RESEARCH', title='Another', reason='Change').status_code, 409)
        from .models import ResearchAmendmentEvent, ResearchAmendment
        with self.assertRaises(ValidationError):
            ResearchAmendment.objects.filter(pk=pk).update(reason='rewritten')
        with self.assertRaises(ValidationError):
            ResearchAmendmentEvent.objects.all().delete()

    def test_final_approval_detects_stale_profile(self):
        pk = self.research()
        from .models import StudentResearchProfile
        StudentResearchProfile.objects.filter(pk=self.profile.pk).update(abstract='External changed value')
        result = self.post(self.supervisor, f'{pk}/decision/', decision='APPROVE')
        self.assertEqual(result.status_code, 409)

    def test_rejections_and_cancellations_preserve_profile(self):
        original = self.profile.proposed_topic
        pk = self.research()
        self.assertEqual(self.post(self.coordinator, f'{pk}/decision/', decision='REJECT', reason='Programme reviewer').status_code, 403)
        self.assertEqual(self.post(self.supervisor, f'{pk}/decision/', decision='REJECT', reason='Revise proposal').status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.proposed_topic, original)
        self.assertEqual(self.profile.revision, 0)

        pk = self.research()
        self.assertEqual(self.post(self.student_user, f'{pk}/cancel/', reason='Withdraw request').status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.proposed_topic, original)
        self.assertEqual(self.profile.revision, 0)

    def test_legacy_research_records_without_a_linked_student_are_rejected(self):
        from .models import StudentResearchProfile
        StudentResearchProfile.objects.filter(pk=self.profile.pk).update(student=None)
        self.assertEqual(self.post(self.student_user, kind='RESEARCH', title='New', reason='Change').status_code, 404)

    def test_corrections_require_office_and_attestation_and_protect_admin(self):
        from django.contrib import admin
        from .models import StudentResearchProfile
        data = dict(studentId=self.student.pk, title='Typo corrected', reason='Typo', expectedRevision=0)
        self.assertEqual(self.post(self.office, 'corrections/', **data).status_code, 400)
        self.assertEqual(self.post(self.supervisor, 'corrections/', **data, meaningUnchanged=True).status_code, 403)
        fields = admin.site._registry[StudentResearchProfile].get_readonly_fields(None, self.profile)
        self.assertTrue({'proposed_topic', 'abstract', 'programme', 'revision'}.issubset(fields))
