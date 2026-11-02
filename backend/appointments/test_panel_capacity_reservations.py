"""Panel capacity is promised by acceptance, never by an unanswered nomination."""
from django.test import override_settings
from rest_framework.test import APITestCase, APITransactionTestCase

from academics.capacity import resolve_lecturer_capacity
from academics.capacity_services import (clone_capacity_plan, update_capacity_entry,
    publish_capacity_plan, capacity_plan_content_fingerprint)
from academics.models import SemesterCapacityPlan
from accounts.models import Student, User
from announcements.models import Notification
from . import test_appointment_lifecycle as fixture
from .models import PanelRecommendation, PanelAppointment, StudentResearchProfile, SupervisorApplication, SupervisorAppointment


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PanelCapacityReservationTests(APITestCase):
    setUp = fixture.AppointmentLifecycleTests.setUp
    _lecturer = fixture.AppointmentLifecycleTests._lecturer

    def limit(self, value):
        previous = SemesterCapacityPlan.objects.get(academic_semester=self.semester, lifecycle_status='PUBLISHED')
        plan = clone_capacity_plan(previous, actor=self.office)
        update_capacity_entry(plan, lecturer=self.panel.lecturer, actor=self.office,
            supervisor_limit=None, panel_limit=value, expected_fingerprint=capacity_plan_content_fingerprint(plan))
        publish_capacity_plan(plan, actor=self.office, reason='Synthetic panel capacity',
            expected_fingerprint=capacity_plan_content_fingerprint(plan))

    def nomination(self, status='SUBMITTED_TO_PANEL', semester=None):
        number = Student.objects.count() + 1
        user = User.objects.create_user(email=f'panel-capacity-{number}@example.test', full_name=f'Applicant {number}', role='STUDENT')
        student = Student.objects.create(user=user, matric_no=f'PC-{number}', programme=self.student.programme)
        application = SupervisorApplication.objects.create(student=student, proposed_supervisor=self.supervisor,
            academic_semester=self.semester, status='APPROVED', research_title='Synthetic research', research_abstract='Synthetic abstract')
        SupervisorAppointment.objects.create(application=application, student=student, supervisor=self.supervisor, approved_by=self.coordinator)
        profile = StudentResearchProfile.objects.create(student=user, matric_no=student.matric_no, student_name=user.full_name,
            programme=student.programme, semester=self.semester.label, proposed_topic='Synthetic research', supervisor=self.supervisor)
        return PanelRecommendation.objects.create(profile=profile, supervisor=self.supervisor, recommended_member=self.panel,
            academic_semester=semester or self.semester, status=status)

    def accept(self, row):
        self.client.force_authenticate(self.panel)
        return self.client.post(f'/api/appointments/panel/recommendations/{row.pk}/panel-accept/')

    def test_candidates_expose_accepted_reservations_separately_from_active_workload(self):
        self.limit(2)
        self.nomination('PENDING_COORDINATOR')
        self.nomination()
        self.client.force_authenticate(self.supervisor)
        response = self.client.get('/api/appointments/panel/candidates/')
        self.assertEqual(response.status_code, 200)
        candidate = next(row for row in response.data if row['staffId'] == self.panel.lecturer.staff_no)
        self.assertEqual((candidate.get('activeLoad'), candidate.get('reservedLoad'), candidate['availableSlots']), (0, 1, 1))

    def approve(self, row):
        self.client.force_authenticate(self.coordinator)
        return self.client.post(f'/api/appointments/panel/recommendations/{row.pk}/coordinator-approve/')

    def test_submitted_nominations_do_not_reserve_and_acceptance_claims_last_place(self):
        self.limit(1)
        first, second = self.nomination(), self.nomination()
        result = resolve_lecturer_capacity(user=self.panel, semester=self.semester, role='PANEL')
        self.assertEqual((result.reserved_load, result.available_slots), (0, 1))
        self.assertEqual(self.accept(first).status_code, 200)
        self.assertEqual(self.accept(second).status_code, 409)
        second.refresh_from_db()
        self.assertEqual(second.status, 'SUBMITTED_TO_PANEL')
        self.assertEqual(second.workflow_events.count(), 0)

    def test_two_supervisor_submissions_can_compete_for_one_available_place(self):
        self.limit(1)
        for unused in range(2):
            row=self.nomination()
            matric=row.profile.matric_no
            row.delete()
            self.client.force_authenticate(self.supervisor)
            response=self.client.post('/api/appointments/panel/recommendations/',{
                'studentId':matric,'recommendedMemberId':self.panel.lecturer.staff_no,'justification':'Synthetic suitability'},format='json')
            self.assertEqual(response.status_code,201,response.data)
        result=resolve_lecturer_capacity(user=self.panel,semester=self.semester,role='PANEL')
        self.assertEqual((result.reserved_load,result.available_slots),(0,1))

    def test_final_approval_converts_reservation_and_closes_unaccepted_once(self):
        self.limit(1)
        first, waiting = self.nomination('PENDING_COORDINATOR'), self.nomination()
        response = self.approve(first)
        self.assertEqual(response.status_code, 200, response.data)
        waiting.refresh_from_db()
        self.assertEqual(waiting.status, 'CANCELLED_CAPACITY_FULL')
        self.assertIsNone(waiting.panel_decided_at)
        self.assertIsNotNone(waiting.cancelled_at)
        event = waiting.workflow_events.get(action='SYSTEM_CLOSE_CAPACITY')
        self.assertEqual(event.actor_role, 'SYSTEM')
        self.assertEqual(event.actor_id, self.coordinator.pk)
        self.assertEqual(PanelAppointment.objects.filter(panel_member=self.panel, status='ACTIVE').count(), 1)
        count = Notification.objects.filter(event_key=f'panel:{waiting.pk}:capacity-full').count()
        self.assertEqual(count, 3)
        from .capacity_closure import close_capacity_full_panel_requests
        from django.db import transaction
        with transaction.atomic():
            close_capacity_full_panel_requests(panel_member=self.panel, actor=self.coordinator)
        self.assertEqual(waiting.workflow_events.count(), 1)
        self.assertEqual(Notification.objects.filter(event_key=f'panel:{waiting.pk}:capacity-full').count(), count)
        self.client.force_authenticate(self.panel)
        detail = self.client.get(f'/api/appointments/panel/recommendations/{waiting.pk}/').data
        self.assertEqual(detail['workflow'][0]['actorName'], 'System')
        self.assertIsNone(detail['acceptanceCapacity'])

    def test_rejection_releases_reservation_without_closing_another_nomination(self):
        self.limit(1)
        first, waiting = self.nomination('PENDING_COORDINATOR'), self.nomination()
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(f'/api/appointments/panel/recommendations/{first.pk}/coordinator-reject/', {'reason':'Synthetic rejection'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.accept(waiting).status_code, 200)

    def test_request_payload_and_workload_distinguish_waiting_from_reserved(self):
        self.limit(2)
        self.nomination('PENDING_COORDINATOR')
        waiting = self.nomination()
        self.client.force_authenticate(self.panel)
        detail = self.client.get(f'/api/appointments/panel/recommendations/{waiting.pk}/').data
        self.assertEqual(detail.get('acceptanceCapacity'), {'activeLoad':0, 'reservedLoad':1, 'limit':2,
            'availableSlots':1, 'pendingRequests':1, 'state':'AVAILABLE'})
        workload = self.client.get('/api/appointments/panel/my-workload/').data
        self.assertEqual((workload['confirmedAppointments'], workload['pendingNominations'], workload['workloadCount']), (0, 1, 1))

    def test_duplicate_unaccepted_nomination_for_same_student_is_still_blocked(self):
        waiting = self.nomination()
        self.client.force_authenticate(self.supervisor)
        response = self.client.post('/api/appointments/panel/recommendations/', {
            'studentId':waiting.profile.matric_no, 'recommendedMemberId':self.new_panel.lecturer.staff_no}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('active panel recommendation', str(response.data))

    def test_single_active_appointment_does_not_close_under_higher_limit(self):
        self.limit(2)
        accepted = self.nomination('PENDING_COORDINATOR')
        waiting = self.nomination()
        other = self.nomination()
        other.recommended_member = self.new_panel
        other.save()
        legacy = self.nomination()
        legacy.academic_semester = None
        legacy.save()
        # A single confirmed appointment does not fill this two-place policy.
        response = self.approve(accepted)
        self.assertEqual(response.status_code, 200, response.data)
        for row in (waiting, other, legacy):
            row.refresh_from_db()
            self.assertEqual(row.status, 'SUBMITTED_TO_PANEL')

    def test_closed_capacity_request_appears_in_history_and_student_can_be_nominated_again(self):
        self.limit(1)
        first, waiting = self.nomination('PENDING_COORDINATOR'), self.nomination()
        self.assertEqual(self.approve(first).status_code, 200)
        self.client.force_authenticate(self.panel)
        history = self.client.get('/api/appointments/panel/review-history/')
        self.assertEqual(history.status_code, 200, history.data)
        self.assertTrue(any(row['id'] == waiting.pk for row in history.data))
        self.client.force_authenticate(self.supervisor)
        response = self.client.post('/api/appointments/panel/recommendations/', {
            'studentId':waiting.profile.matric_no, 'recommendedMemberId':self.new_panel.lecturer.staff_no}, format='json')
        self.assertEqual(response.status_code, 201, response.data)

    def test_reservations_do_not_close_waiting_requests_before_all_places_activate(self):
        self.limit(2)
        first, second, waiting = self.nomination('PENDING_COORDINATOR'), self.nomination('PENDING_COORDINATOR'), self.nomination()
        self.assertEqual(self.approve(first).status_code, 200)
        second.refresh_from_db()
        waiting.refresh_from_db()
        self.assertEqual(second.status, 'PENDING_COORDINATOR')
        self.assertEqual(waiting.status, 'SUBMITTED_TO_PANEL')
        self.assertEqual(self.approve(second).status_code, 200)
        waiting.refresh_from_db()
        self.assertEqual(waiting.status, 'CANCELLED_CAPACITY_FULL')

    def test_closure_uses_each_policy_and_preserves_archived_missing_and_reassessed_requests(self):
        from datetime import timedelta
        from django.utils import timezone
        from academics.models import AcademicSemester
        from academics.test_capacity_helpers import publish_test_capacity_plan
        from accounts.models import Panel
        from .capacity_reassessment import decide
        self.limit(2)
        today = timezone.localdate()
        old = AcademicSemester.objects.create(code='2098-2099-S1',academic_session='2098/2099',term='SEMESTER_I',
            starts_on=today-timedelta(days=400),ends_on=today-timedelta(days=200),created_by=self.office)
        Panel.objects.filter(pk=self.panel.pk).update(max_appointments=1)
        publish_test_capacity_plan(old,self.office)
        old.lifecycle_status='CLOSED'
        old.save()
        archived = AcademicSemester.objects.create(code='2097-2098-S1',academic_session='2097/2098',term='SEMESTER_I',
            starts_on=today-timedelta(days=800),ends_on=today-timedelta(days=600),created_by=self.office)
        publish_test_capacity_plan(archived,self.office)
        archived.lifecycle_status='ARCHIVED'
        archived.save()
        missing = AcademicSemester.objects.create(code='2096-2097-S1',academic_session='2096/2097',term='SEMESTER_I',
            starts_on=today-timedelta(days=1200),ends_on=today-timedelta(days=1000),created_by=self.office)
        lower=self.nomination(semester=old)
        reassessed=self.nomination(semester=old)
        frozen=self.nomination(semester=archived)
        unconfigured=self.nomination(semester=missing)
        waiting=self.nomination()
        accepted=self.nomination('PENDING_COORDINATOR')
        decide(actor=self.office,kind='PANEL',pk=reassessed.pk,action='authorize',data={
            'reason':'Synthetic authorization','expectedStatus':'SUBMITTED_TO_PANEL',
            'expectedActiveSemesterId':self.semester.pk,'expectedAuthorizationId':None,'expectedEventId':None})
        response=self.approve(accepted)
        self.assertEqual(response.status_code,200,response.data)
        lower.refresh_from_db()
        self.assertEqual(lower.status,'CANCELLED_CAPACITY_FULL')
        for row in (reassessed,frozen,unconfigured,waiting):
            row.refresh_from_db()
            self.assertEqual(row.status,'SUBMITTED_TO_PANEL')

    def test_full_capacity_allows_rejection_and_prevents_new_submission(self):
        self.limit(1)
        self.nomination('PENDING_COORDINATOR')
        waiting=self.nomination()
        self.client.force_authenticate(self.supervisor)
        response=self.client.post('/api/appointments/panel/recommendations/',{
            'studentId':self.profile.matric_no,'recommendedMemberId':self.panel.lecturer.staff_no},format='json')
        self.assertEqual(response.status_code,409,response.data)
        self.client.force_authenticate(self.panel)
        response=self.client.post(f'/api/appointments/panel/recommendations/{waiting.pk}/panel-reject/',{'reason':'Synthetic decline'},format='json')
        self.assertEqual(response.status_code,200,response.data)

    def test_automatic_closure_preserves_incumbent_replacement_appointment(self):
        self.limit(1)
        first,waiting=self.nomination('PENDING_COORDINATOR'),self.nomination()
        original=PanelRecommendation.objects.create(profile=waiting.profile,supervisor=self.supervisor,
            recommended_member=self.new_panel,academic_semester=self.semester,status='APPROVED')
        incumbent=PanelAppointment.objects.create(recommendation=original,profile=waiting.profile,
            supervisor=self.supervisor,panel_member=self.new_panel,approved_by=self.coordinator)
        waiting.replaces_appointment=incumbent
        waiting.replacement_reason='Synthetic replacement'
        waiting.save()
        self.assertEqual(self.approve(first).status_code,200)
        waiting.refresh_from_db()
        incumbent.refresh_from_db()
        self.assertEqual((waiting.status,incumbent.status),('CANCELLED_CAPACITY_FULL','ACTIVE'))


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PanelAcceptanceConcurrencyTests(APITransactionTestCase):
    setUp = PanelCapacityReservationTests.setUp
    _lecturer = PanelCapacityReservationTests._lecturer
    limit = PanelCapacityReservationTests.limit
    nomination = PanelCapacityReservationTests.nomination

    def test_two_simultaneous_acceptances_reserve_only_one_place(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections, connection, connections
        from rest_framework.test import APIClient
        if connection.vendor != 'postgresql':
            self.skipTest('Requires PostgreSQL row locks')
        self.limit(1)
        rows = [self.nomination(), self.nomination()]
        barrier = Barrier(2)

        def accept(pk):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET statement_timeout = '20s'")
                client = APIClient()
                client.force_authenticate(self.panel)
                barrier.wait(timeout=20)
                return client.post(f'/api/appointments/panel/recommendations/{pk}/panel-accept/').status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(accept, [row.pk for row in rows]))
        self.assertCountEqual(results, [200,409])
        self.assertEqual(PanelRecommendation.objects.filter(status='PENDING_COORDINATOR').count(), 1)
