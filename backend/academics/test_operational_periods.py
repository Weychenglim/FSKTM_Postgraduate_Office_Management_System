from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import User, Student
from academics.models import AcademicSemester
from academics.operational_periods import OperationalConflict
from appointments.research_intent_test_helpers import valid_research_intent_json

BASE = '/api/academics/operational-periods/'
ACTIVITY = 'SUPERVISOR_APPLICATION'

class OperationalPeriodTests(TestCase):
    def setUp(self):
        self.office = User.objects.create_user('period-office@test.local', role=User.Role.OFFICE_ADMIN, full_name='Office')
        self.user = User.objects.create_user('period-student@test.local', role=User.Role.STUDENT, full_name='Student')
        self.student = Student.objects.create(user=self.user, matric_no='PERIOD1', programme='Computer Science')
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(code='2026-2027-S1', academic_session='2026/2027', term='SEMESTER_I', starts_on=today-timedelta(days=30), ends_on=today+timedelta(days=120), lifecycle_status='ACTIVE', created_by=self.office)
        self.client = APIClient()
        self.client.force_authenticate(self.office)

    def data(self, **changes):
        now = timezone.now()
        data = dict(semesterId=self.semester.pk, activity=ACTIVITY, name='Supervisor intake', programmeScope='ALL', programmes=[], opensAt=(now-timedelta(days=1)).isoformat(), closesAt=(now+timedelta(days=2)).isoformat())
        data.update(changes)
        return data

    def create_period(self, **changes):
        response = self.client.post(BASE, self.data(**changes), format='json')
        self.assertEqual(response.status_code, 201, response.content)
        return response.data

    def publish(self, period):
        response = self.client.post(f'{BASE}{period["id"]}/publish/', {'reason':'Open intake', 'expectedRevision':period['revision']}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        return response.data

    def enable(self):
        return self.client.post(BASE+'enforcement/', {'semesterId':self.semester.pk, 'activity':ACTIVITY, 'enabled':True, 'reason':'Configured'}, format='json')

    def availability(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(BASE+'availability/', {'activity':ACTIVITY})
        self.assertEqual(response.status_code, 200, response.content)
        return response.data

    def test_disabled_enforcement_preserves_existing_intake(self):
        self.assertTrue(self.availability()['canSubmit'])

    def test_enabling_requires_a_published_period(self):
        self.assertEqual(self.enable().status_code, 400)

    def test_office_only_and_date_scope_validation(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(BASE, self.data(), format='json').status_code, 403)
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.post(BASE, self.data(programmeScope='SELECTED'), format='json').status_code, 400)
        self.assertEqual(self.client.post(BASE, self.data(closesAt=(timezone.now()-timedelta(days=2)).isoformat()), format='json').status_code, 400)
        self.assertEqual(self.client.post(BASE, self.data(opensAt=(timezone.now()-timedelta(days=40)).isoformat()), format='json').status_code, 400)

    def test_published_overlap_and_stale_mutations_are_rejected(self):
        first = self.publish(self.create_period())
        second = self.create_period(name='Conflicting intake')
        self.assertEqual(self.client.post(f'{BASE}{second["id"]}/publish/', {'reason':'Publish'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'{BASE}{first["id"]}/', {'name':'Changed','expectedRevision':1}, format='json').status_code, 409)

    def test_open_cutoff_extension_exception_and_revocation(self):
        period = self.publish(self.create_period())
        self.assertEqual(self.enable().status_code, 200)
        self.assertTrue(self.availability()['canSubmit'])
        self.client.force_authenticate(self.office)
        self.client.post(f'{BASE}{period["id"]}/close/', {'reason':'Close'}, format='json')
        self.assertFalse(self.availability()['canSubmit'])

    def test_personal_exception_is_private_and_rechecked(self):
        period = self.publish(self.create_period(closesAt=(timezone.now()-timedelta(hours=1)).isoformat()))
        self.assertEqual(self.enable().status_code, 200)
        grant = self.client.post(f'{BASE}{period["id"]}/exceptions/', {'studentId':self.user.pk,'participantId':self.user.pk,'deadline':(timezone.now()+timedelta(days=3)).isoformat(),'reason':'Medical extension'}, format='json')
        self.assertEqual(grant.status_code, 201, grant.data)
        self.assertTrue(self.availability()['canSubmit'])
        other = User.objects.create_user('period-other@test.local',role=User.Role.STUDENT,full_name='Other')
        Student.objects.create(user=other,matric_no='PERIOD2',programme='Computer Science')
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(BASE+'availability/', {'activity':ACTIVITY,'studentId':self.user.pk}).status_code,403)
        self.client.force_authenticate(self.office)
        revoke = self.client.post(f'/api/academics/operational-exceptions/{grant.data["id"]}/revoke/', {'reason':'Withdrawn'}, format='json')
        self.assertEqual(revoke.status_code,200,revoke.data)
        self.assertFalse(self.availability()['canSubmit'])


    def test_cutoff_instants_are_inclusive_and_missing_scope_fails_closed(self):
        from academics.models import OperationalPeriod, OperationalEnforcement
        from academics.operational_periods import resolve_availability
        period=self.publish(self.create_period(programmeScope='SELECTED',programmes=[self.student.programme]))
        self.assertEqual(self.enable().status_code,200)
        model=OperationalPeriod.objects.get(pk=period['id'])
        def at(now):
            return resolve_availability(semester=self.semester,activity=ACTIVITY,student=self.student,participant=self.user,now=now)
        self.assertFalse(at(model.opens_at-timedelta(microseconds=1))['canSubmit'])
        self.assertTrue(at(model.opens_at)['canSubmit'])
        self.assertTrue(at(model.closes_at)['canSubmit'])
        self.assertFalse(at(model.closes_at+timedelta(microseconds=1))['canSubmit'])
        self.student.programme='Another programme'
        self.student.save()
        self.assertEqual(at(timezone.now())['status'],'MISSING')
        OperationalEnforcement.objects.filter(academic_semester=self.semester).update(enabled=False)
        self.assertTrue(at(timezone.now())['canSubmit'])

    def test_draft_patch_records_optional_reason(self):
        period=self.create_period()
        response=self.client.patch(f'{BASE}{period["id"]}/',{'name':'Renamed','reason':'Corrected label','expectedRevision':1},format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data['history'][0]['reason'],'Corrected label')

    def test_selected_intake_matches_legacy_student_programme_case_and_whitespace(self):
        from accounts.programmes import APPROVED_PROGRAMMES
        self.student.programme='  '+APPROVED_PROGRAMMES[0].lower()+'  '
        self.student.save()
        self.publish(self.create_period(programmeScope='SELECTED',programmes=[APPROVED_PROGRAMMES[0]]))
        self.assertEqual(self.enable().status_code,200)
        result=self.availability()
        self.assertTrue(result['canSubmit'],result)
        self.assertEqual(result['status'],'OPEN')

    def test_scope_accepts_normalized_known_names_and_preserves_display_case(self):
        from accounts.programmes import APPROVED_PROGRAMMES
        display=APPROVED_PROGRAMMES[0].title()
        period=self.create_period(programmeScope='SELECTED',programmes=[display])
        self.assertEqual(period['programmes'],[display])
        self.student.programme='  Stra\u00dfe Research Programme  '
        self.student.save()
        legacy=self.create_period(name='Legacy programme',programmeScope='SELECTED',programmes=['strasse research programme'])
        self.assertEqual(legacy['programmes'],['strasse research programme'])
        self.assertEqual(self.client.post(BASE,self.data(programmeScope='SELECTED',programmes=['X'*256]),format='json').status_code,400)

    def test_publication_rejects_case_and_whitespace_variants_of_same_cohort(self):
        from academics.models import OperationalPeriod
        first=self.publish(self.create_period(programmeScope='SELECTED',programmes=[self.student.programme]))
        # Preserve a legacy display spelling while testing the real publication service.
        OperationalPeriod.objects.filter(pk=first['id']).update(programmes=['  '+self.student.programme.lower()+'  '])
        second=self.create_period(name='Same cohort',programmeScope='SELECTED',programmes=[self.student.programme])
        response=self.client.post(f'{BASE}{second["id"]}/publish/',{},format='json')
        self.assertEqual(response.status_code,400,response.data)
        self.assertEqual(OperationalPeriod.objects.get(pk=second['id']).lifecycle_status,'DRAFT')

    def test_model_rejects_duplicate_programmes_by_normalized_identity(self):
        from django.core.exceptions import ValidationError
        from academics.models import OperationalPeriod
        now=timezone.now()
        period=OperationalPeriod(academic_semester=self.semester,activity=ACTIVITY,name='Duplicate cohort',programme_scope='SELECTED',programmes=['Computer Science','  computer science  '],opens_at=now-timedelta(days=1),closes_at=now+timedelta(days=1),created_by=self.office)
        with self.assertRaisesMessage(ValidationError,'Duplicate programmes'):
            period.full_clean()

    def test_scope_overlap_and_unknown_fields(self):
        self.publish(self.create_period(programmeScope='SELECTED',programmes=[self.student.programme]))
        student_user=User.objects.create_user('period-scope@test.local',full_name='Scope')
        Student.objects.create(user=student_user,matric_no='SCOPE',programme='Other')
        self.publish(self.create_period(name='Disjoint',programmeScope='SELECTED',programmes=['Other']))
        all_period=self.create_period(name='All')
        self.assertEqual(self.client.post(f'{BASE}{all_period["id"]}/publish/',{},format='json').status_code,400)
        self.assertEqual(self.client.post(BASE,self.data(levelScope='P1'),format='json').status_code,400)
        self.assertEqual(self.client.post(BASE,self.data(programmeScope='SELECTED',programmes=['invented']),format='json').status_code,400)

    def test_extension_rejects_a_later_deadline_that_is_still_expired(self):
        from academics.models import OperationalPeriod, OperationalPeriodAudit
        now=timezone.now()
        period=self.publish(self.create_period(opensAt=(now-timedelta(days=4)).isoformat(),closesAt=(now-timedelta(days=3)).isoformat()))
        before=OperationalPeriod.objects.values().get(pk=period['id'])
        audit_count=OperationalPeriodAudit.objects.filter(period_id=period['id']).count()
        response=self.client.post(f'{BASE}{period["id"]}/extend/',{
            'closesAt':(now-timedelta(days=1)).isoformat(),
            'reason':'Proposed expired extension',
            'expectedRevision':period['revision'],
        },format='json')
        self.assertEqual(response.status_code,400,response.data)
        self.assertEqual(OperationalPeriod.objects.values().get(pk=period['id']),before)
        self.assertEqual(OperationalPeriodAudit.objects.filter(period_id=period['id']).count(),audit_count)

    def test_extension_requires_reason_revision_and_preserves_audit_facts(self):
        period=self.publish(self.create_period())
        url=f'{BASE}{period["id"]}/extend/'
        later=timezone.now()+timedelta(days=4)
        self.assertEqual(self.client.post(url,{'closesAt':later.isoformat(),'reason':'Reason'},format='json').status_code,400)
        self.assertEqual(self.client.post(url,{'closesAt':later.isoformat(),'expectedRevision':period['revision']},format='json').status_code,400)
        response=self.client.post(url,{'closesAt':later.isoformat(),'expectedRevision':period['revision'],'reason':'Extension approved'},format='json')
        self.assertEqual(response.status_code,200,response.data)
        history=response.data['history'][0]
        self.assertEqual(history['action'],'EXTEND')
        self.assertEqual(history['before']['closesAt'],period['closesAt'])
        self.assertEqual(history['after']['closesAt'],response.data['closesAt'])
        self.assertEqual(response.data['revision'],period['revision']+1)
        self.assertEqual(self.client.post(url,{'closesAt':(later+timedelta(days=1)).isoformat(),'expectedRevision':period['revision'],'reason':'Stale'},format='json').status_code,409)
        from academics.models import OperationalPeriodAudit
        from django.core.exceptions import ValidationError
        audit=OperationalPeriodAudit.objects.first()
        audit.reason='Tamper'
        with self.assertRaises(ValidationError): audit.save()
        with self.assertRaises(ValidationError): OperationalPeriodAudit.objects.filter(pk=audit.pk).update(reason='Tamper')
        with self.assertRaises(ValidationError): audit.delete()
        with self.assertRaises(ValidationError): OperationalPeriodAudit.objects.all().delete()

    def test_exception_renewal_revoke_expiry_and_changed_eligibility(self):
        from academics.models import OperationalException
        period=self.publish(self.create_period(closesAt=(timezone.now()-timedelta(hours=1)).isoformat()))
        self.assertEqual(self.enable().status_code,200)
        def grant(days):
            self.client.force_authenticate(self.office)
            response=self.client.post(f'{BASE}{period["id"]}/exceptions/',{'studentId':self.user.pk,'participantId':self.user.pk,'deadline':(timezone.now()+timedelta(days=days)).isoformat(),'reason':'Extra time'},format='json')
            self.assertEqual(response.status_code,201,response.data)
            return response.data
        first=grant(1)
        renewed=grant(2)
        self.assertEqual(renewed['history'][0]['action'],'RENEW')
        self.assertEqual(renewed['history'][0]['before']['status'],'ACTIVE')
        listed=self.client.get(f'{BASE}{period["id"]}/exceptions/').data['exceptions']
        superseded=next(e for e in listed if e['id']==first['id'])
        self.assertEqual(superseded['status'],'SUPERSEDED')
        self.assertFalse(superseded['canRevoke'])
        self.assertTrue(self.availability()['canSubmit'])
        self.student.status='Deferred'
        self.student.save()
        self.assertFalse(self.availability()['canSubmit'])
        self.student.status='Active'
        self.student.save()
        self.client.force_authenticate(self.office)
        response=self.client.post(f'/api/academics/operational-exceptions/{renewed["id"]}/revoke/',{'reason':'Revoke renewal'},format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.assertFalse(self.availability()['canSubmit'])
        self.assertIsNotNone(OperationalException.objects.get(pk=first['id']).revoked_at)
        latest=grant(3)
        OperationalException.objects.filter(pk=latest['id']).update(deadline=timezone.now()-timedelta(seconds=1))
        self.assertFalse(self.availability()['canSubmit'])

    def test_exceptions_require_effective_active_semester_and_bound_participant(self):
        period=self.publish(self.create_period())
        grant={'studentId':self.user.pk,'participantId':self.office.pk,'deadline':(timezone.now()+timedelta(days=4)).isoformat(),'reason':'Reason'}
        url=f'{BASE}{period["id"]}/exceptions/'
        self.assertEqual(self.client.post(url,grant,format='json').status_code,400)
        grant['participantId']=self.user.pk
        self.semester.lifecycle_status='DRAFT'
        self.semester.save()
        self.assertEqual(self.client.post(url,grant,format='json').status_code,400)

    def test_disabled_enforcement_does_not_add_legacy_profile_eligibility_gate(self):
        from academics.operational_periods import resolve_availability
        result=resolve_availability(semester=self.semester,activity='PANEL_RECOMMENDATION',student=None,participant=self.office)
        self.assertTrue(result['canSubmit'])

    def test_student_cannot_list_periods_or_receive_panel_details(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(BASE,{'semesterId':self.semester.pk}).status_code,403)
        self.assertEqual(self.client.get(BASE+'availability/',{'activity':'PANEL_RECOMMENDATION'}).status_code,403)


class AppointmentIntakeGuardTests(TestCase):
    def setUp(self):
        from appointments import test_supervisor_workflow as fixtures
        fixtures.SupervisorAppointmentWorkflowTests.setUp(self)
        self.client = APIClient()
        from tempfile import TemporaryDirectory
        from django.test import override_settings
        media = TemporaryDirectory(prefix='fkstm-operational-guard-')
        self.addCleanup(media.cleanup)
        override = override_settings(MEDIA_ROOT=media.name)
        override.enable()
        self.addCleanup(override.disable)

    def configure(self, activity=ACTIVITY, opens=None, closes=None):
        from academics.models import OperationalPeriod, OperationalEnforcement
        now=timezone.now()
        period=OperationalPeriod.objects.create(academic_semester=self.academic_semester,activity=activity,name='Intake',opens_at=opens or now-timedelta(days=2),closes_at=closes or now+timedelta(days=2),lifecycle_status='PUBLISHED',created_by=self.office_admin)
        OperationalEnforcement.objects.create(academic_semester=self.academic_semester,activity=activity,enabled=True,updated_by=self.office_admin)
        return period

    def supervisor_serializer(self):
        from appointments.serializers import SupervisorApplicationCreateSerializer
        from types import SimpleNamespace
        return SupervisorApplicationCreateSerializer(data={'proposedSupervisorId':self.supervisor_user.lecturer.staff_no,'projectCourseCodes':'WQD7002','researchTitle':'Research','researchArea':'Area','researchAbstract':'Abstract','researchIntent':valid_research_intent_json()},context={'request':SimpleNamespace(user=self.student_user)})

    def panel_context(self):
        from appointments.models import SupervisorApplication, SupervisorAppointment, StudentResearchProfile
        application=SupervisorApplication.objects.create(student=self.student_user.student,proposed_supervisor=self.supervisor_user,academic_semester=self.academic_semester,research_title='Research',research_area='Area',research_abstract='Abstract',status='APPROVED')
        appointment=SupervisorAppointment.objects.create(application=application,student=self.student_user.student,supervisor=self.supervisor_user,approved_by=self.coordinator)
        profile=StudentResearchProfile.objects.create(student=self.student_user,matric_no=self.student_user.student.matric_no,student_name='Student',programme=self.student_user.student.programme,semester='Semester I',proposed_topic='Research',supervisor=self.supervisor_user)
        return appointment, profile

    def panel_serializer(self):
        from appointments.serializers import PanelRecommendationCreateSerializer
        from types import SimpleNamespace
        return PanelRecommendationCreateSerializer(data={'studentId':self.student_user.student.matric_no,'recommendedMemberId':self.other_supervisor.lecturer.staff_no},context={'request':SimpleNamespace(user=self.supervisor_user)})

    def test_supervisor_validation_rejects_before_open(self):
        self.configure(opens=timezone.now()+timedelta(days=1))
        with self.assertRaisesMessage(OperationalConflict,'not opened'):
            self.supervisor_serializer().is_valid(raise_exception=True)

    def test_supervisor_create_rechecks_deadline_after_validation(self):
        from academics.models import OperationalPeriod
        period=self.configure()
        serializer=self.supervisor_serializer()
        self.assertTrue(serializer.is_valid(),serializer.errors)
        OperationalPeriod.objects.filter(pk=period.pk).update(closes_at=timezone.now()-timedelta(hours=1))
        with self.assertRaisesMessage(OperationalConflict,'deadline has passed'):
            serializer.save()
        self.assertFalse(self.student_user.student.supervisor_applications.exists())

    def test_panel_validation_and_create_are_both_guarded(self):
        from academics.models import OperationalPeriod
        self.panel_context()
        period=self.configure(activity='PANEL_RECOMMENDATION')
        serializer=self.panel_serializer()
        self.assertTrue(serializer.is_valid(),serializer.errors)
        OperationalPeriod.objects.filter(pk=period.pk).update(closes_at=timezone.now()-timedelta(hours=1))
        with self.assertRaisesMessage(OperationalConflict,'deadline has passed'):
            serializer.save()
        with self.assertRaisesMessage(OperationalConflict,'deadline has passed'):
            self.panel_serializer().is_valid(raise_exception=True)

    def test_panel_availability_requires_current_active_primary(self):
        appointment,profile=self.panel_context()
        self.configure(activity='PANEL_RECOMMENDATION')
        url=BASE+'availability/'
        self.client.force_authenticate(self.other_supervisor)
        self.assertEqual(self.client.get(url,{'activity':'PANEL_RECOMMENDATION','studentId':self.student_user.pk}).status_code,403)
        self.client.force_authenticate(self.supervisor_user)
        self.assertTrue(self.client.get(url,{'activity':'PANEL_RECOMMENDATION','studentId':self.student_user.pk}).data['canSubmit'])
        appointment.status='ENDED'
        appointment.save()
        self.assertEqual(self.client.get(url,{'activity':'PANEL_RECOMMENDATION','studentId':self.student_user.pk}).status_code,403)

    def test_expired_intake_does_not_block_supervisor_review(self):
        from appointments.models import SupervisorApplication
        period=self.configure(closes=timezone.now()-timedelta(hours=1))
        application=SupervisorApplication.objects.create(student=self.student_user.student,proposed_supervisor=self.supervisor_user,academic_semester=self.academic_semester,research_title='Research',research_area='Area',research_abstract='Abstract')
        self.client.force_authenticate(self.supervisor_user)
        response=self.client.post(f'/api/appointments/supervisor/applications/{application.pk}/supervisor-accept/')
        self.assertEqual(response.status_code,200,response.data)

    def test_create_rechecks_student_programme_after_validation(self):
        from academics.models import OperationalPeriod
        period=self.configure()
        OperationalPeriod.objects.filter(pk=period.pk).update(programme_scope='SELECTED',programmes=[self.student_user.student.programme])
        serializer=self.supervisor_serializer()
        self.assertTrue(serializer.is_valid(),serializer.errors)
        Student.objects.filter(pk=self.student_user.pk).update(programme='Changed programme')
        with self.assertRaisesMessage(OperationalConflict,'No published intake period applies'):
            serializer.save()

    def test_direct_api_rejects_closed_intake_before_upload_side_effects(self):
        self.configure(closes=timezone.now()-timedelta(hours=1))
        self.client.force_authenticate(self.student_user)
        response=self.client.post('/api/appointments/supervisor/applications/',{'proposedSupervisorId':self.supervisor_user.lecturer.staff_no,'projectCourseCodes':'WQD7002','researchTitle':'Research','researchArea':'Area','researchAbstract':'Abstract','researchIntent':valid_research_intent_json()},format='json')
        self.assertEqual(response.status_code,409,response.data)
        self.assertFalse(self.student_user.student.supervisor_applications.exists())

    def test_panel_exception_is_bound_to_current_primary_and_expires_with_ownership(self):
        from academics.models import OperationalException
        from academics.operational_periods import grant_exception, resolve_availability
        appointment,profile=self.panel_context()
        period=self.configure(activity='PANEL_RECOMMENDATION',closes=timezone.now()-timedelta(hours=1))
        exception=grant_exception(actor=self.office_admin,period=period,student=self.student_user.student,participant=self.supervisor_user,deadline=timezone.now()+timedelta(days=1),reason='Late case')
        def available(participant):
            return resolve_availability(semester=self.academic_semester,activity='PANEL_RECOMMENDATION',student=self.student_user.student,participant=participant)
        self.assertTrue(available(self.supervisor_user)['canSubmit'])
        self.assertFalse(available(self.other_supervisor)['canSubmit'])
        appointment.status='ENDED'
        appointment.save()
        self.assertFalse(available(self.supervisor_user)['canSubmit'])
        self.client.force_authenticate(self.office_admin)
        candidates=self.client.get(f'{BASE}{period.pk}/exception-candidates/')
        self.assertEqual(candidates.status_code,200,candidates.data)
        self.assertEqual(candidates.data['candidates'],[])

    def test_panel_review_remains_available_after_intake_deadline(self):
        from appointments.models import PanelRecommendation
        appointment,profile=self.panel_context()
        self.configure(activity='PANEL_RECOMMENDATION',closes=timezone.now()-timedelta(hours=1))
        recommendation=PanelRecommendation.objects.create(profile=profile,supervisor=self.supervisor_user,recommended_member=self.other_supervisor,academic_semester=self.academic_semester,status='SUBMITTED_TO_PANEL')
        self.client.force_authenticate(self.other_supervisor)
        response=self.client.post(f'/api/appointments/panel/recommendations/{recommendation.pk}/panel-accept/')
        self.assertEqual(response.status_code,200,response.data)

    def test_enabled_intake_preserves_cross_programme_lecturer_eligibility(self):
        from academics.models import OperationalPeriod
        period=self.configure()
        OperationalPeriod.objects.filter(pk=period.pk).update(programme_scope='SELECTED',programmes=[self.student_user.student.programme])
        self.assertNotEqual(self.supervisor_user.lecturer.department,self.other_supervisor.lecturer.department)
        serializer=self.supervisor_serializer()
        serializer.initial_data['proposedSupervisorId']=self.other_supervisor.lecturer.staff_no
        self.assertTrue(serializer.is_valid(),serializer.errors)
        application=serializer.save()
        self.assertEqual(application.proposed_supervisor_id,self.other_supervisor.pk)

    def test_locked_guard_refreshes_participant_lifecycle(self):
        from academics.operational_periods import assert_intake_allowed
        self.panel_context()
        self.configure(activity='PANEL_RECOMMENDATION')
        # A request object can retain a User instance from earlier validation.
        self.assertTrue(self.supervisor_user.is_active)
        User.objects.filter(pk=self.supervisor_user.pk).update(is_active=False)
        with self.assertRaisesMessage(OperationalConflict,'not eligible'):
            assert_intake_allowed(semester=self.academic_semester,activity='PANEL_RECOMMENDATION',student=self.student_user.student,participant=self.supervisor_user,lock=True)

    def test_missing_and_ambiguous_published_periods_fail_closed_only_after_opt_in(self):
        from academics.models import OperationalPeriod,OperationalEnforcement
        serializer=self.supervisor_serializer()
        self.assertTrue(serializer.is_valid(),serializer.errors)
        period=self.configure()
        OperationalPeriod.objects.filter(pk=period.pk).update(lifecycle_status='ARCHIVED')
        with self.assertRaisesMessage(OperationalConflict,'No published intake period applies'):
            self.supervisor_serializer().is_valid(raise_exception=True)
        OperationalPeriod.objects.filter(pk=period.pk).update(lifecycle_status='PUBLISHED')
        OperationalPeriod.objects.create(academic_semester=self.academic_semester,activity=ACTIVITY,name='Invalid overlapping persisted row',opens_at=period.opens_at,closes_at=period.closes_at,lifecycle_status='PUBLISHED',created_by=self.office_admin)
        with self.assertRaisesMessage(OperationalConflict,'Multiple intake periods apply'):
            self.supervisor_serializer().is_valid(raise_exception=True)
        OperationalEnforcement.objects.filter(academic_semester=self.academic_semester,activity=ACTIVITY).update(enabled=False)
        serializer=self.supervisor_serializer()
        self.assertTrue(serializer.is_valid(),serializer.errors)


class OperationalAdminBoundaryTests(TestCase):
    def test_operational_admin_is_registered_and_read_only(self):
        from django.contrib import admin
        from django.test import RequestFactory
        from academics.models import OperationalPeriod, OperationalException, OperationalEnforcement, OperationalPeriodAudit
        request=RequestFactory().get('/admin/')
        request.user=User.objects.create_superuser('period-tech@test.local',full_name='Technical')
        for model in (OperationalPeriod,OperationalException,OperationalEnforcement,OperationalPeriodAudit):
            self.assertIn(model,admin.site._registry)
            config=admin.site._registry[model]
            self.assertFalse(config.has_add_permission(request))
            self.assertFalse(config.has_change_permission(request))
            self.assertFalse(config.has_delete_permission(request))

from django.test import TransactionTestCase, skipUnlessDBFeature


class OperationalPeriodLockingTests(TransactionTestCase):
    @skipUnlessDBFeature('has_select_for_update')
    def test_intake_guard_holds_semester_lock_until_creation_transaction_finishes(self):
        import threading
        from django.db import close_old_connections, connection, transaction
        from academics.models import OperationalPeriod, OperationalEnforcement
        from academics.operational_periods import assert_intake_allowed, mutate_period
        office=User.objects.create_user('lock-office@test.local',full_name='Office',role=User.Role.OFFICE_ADMIN)
        user=User.objects.create_user('lock-student@test.local',full_name='Student',role=User.Role.STUDENT)
        student=Student.objects.create(user=user,matric_no='LOCK1',programme='Programme')
        now=timezone.now()
        semester=AcademicSemester.objects.create(code='2026-2027-S1',academic_session='2026/2027',term='SEMESTER_I',starts_on=timezone.localdate()-timedelta(days=30),ends_on=timezone.localdate()+timedelta(days=30),lifecycle_status='ACTIVE',created_by=office)
        period=OperationalPeriod.objects.create(academic_semester=semester,activity=ACTIVITY,name='Lock test',opens_at=now-timedelta(days=1),closes_at=now+timedelta(days=1),lifecycle_status='PUBLISHED',created_by=office)
        OperationalEnforcement.objects.create(academic_semester=semester,activity=ACTIVITY,enabled=True,updated_by=office)
        attempted=threading.Event()
        finished=threading.Event()
        errors=[]
        def close_period():
            close_old_connections()
            def record_attempt(execute,sql,params,many,context):
                if 'FOR UPDATE' in sql and 'academics_academicsemester' in sql:
                    attempted.set()
                return execute(sql,params,many,context)
            try:
                with connection.execute_wrapper(record_attempt):
                    mutate_period(actor=office,period=period,action='CLOSE',reason='Intake closed',expected_revision=1)
            except Exception as exc:
                errors.append(exc)
            finally:
                close_old_connections()
                finished.set()
        worker=threading.Thread(target=close_period,daemon=True)
        try:
            with transaction.atomic():
                self.assertTrue(assert_intake_allowed(semester=semester,activity=ACTIVITY,student=student,participant=user,lock=True)['canSubmit'])
                worker.start()
                self.assertTrue(attempted.wait(3),'The concurrent close must attempt the semester lock.')
                self.assertFalse(finished.wait(0.2),'Close raced past a locked intake transaction.')
            worker.join(5)
            self.assertTrue(finished.is_set(),'Concurrent close did not finish after intake released its lock.')
            self.assertEqual(errors,[])
            period.refresh_from_db()
            self.assertEqual(period.lifecycle_status,'CLOSED')
        finally:
            if worker.is_alive():
                worker.join(5)
