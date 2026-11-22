from datetime import timedelta
from unittest.mock import patch

from django.db import connection, models
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from academics.capacity import CapacityRole, resolve_lecturer_capacity
from academics.models import AcademicSemester, LecturerAvailabilityWindow
from academics.test_capacity_helpers import publish_test_capacity_plan
from accounts.models import ProjectRegistration, StudentSemester, Student, Supervisor, User
from . import test_coordinator_workspace as cw, test_research_paging as rp
from .models import (AppointmentWorkflowEvent, CoSupervisorAppointment, ResearchAmendment,
                     ResearchAmendmentEvent, SupervisorApplication, SupervisorAppointment)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class OfficeAttentionTests(APITestCase):
    _lecturer = cw.CoordinatorWorkspaceTests._lecturer
    application_for = cw.CoordinatorWorkspaceTests.application_for
    nomination = cw.CoordinatorWorkspaceTests.nomination
    row = rp.ResearchPagingTests.row

    def setUp(self):
        cw.CoordinatorWorkspaceTests.setUp(self)
        self.office.is_staff = False
        self.office.save(update_fields=['is_staff'])
        self.sequence = 0
        self.client.force_authenticate(self.office)

    def get(self, category='students', **query):
        return self.client.get('/api/appointments/office-workspace/attention/',
                               {'category': category, **query})

    def summary(self):
        return self.client.get('/api/appointments/office-workspace/attention-summary/')

    def never_applied(self, number, **fields):
        user = User.objects.create_user(email=f'never-{number}@example.test',
                                       full_name=f'Never {number:03d}', role=User.Role.STUDENT)
        return Student.objects.create(user=user, matric_no=f'NEVER-{number:03d}',
                                      programme=self.student.programme, **fields)

    def test_students_include_never_applied_and_one_row_per_student(self):
        never = self.never_applied(1, intake_semester='Intake 1')
        pending = self.application_for(1)
        SupervisorApplication.objects.create(student=pending.student, proposed_supervisor=self.supervisor,
            status='REJECTED_BY_SUPERVISOR', research_title='Older', research_abstract='Older')
        rejected = self.application_for(2, status='REJECTED_BY_COORDINATOR')
        response = self.get(sort='no_request')
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data['total'], 3)
        rows = {r['id']: r for r in data['results']}
        self.assertEqual(rows[never.pk]['semester'], 'Intake 1')
        self.assertEqual((rows[never.pk]['reason'], rows[never.pk]['applicationId'], rows[never.pk]['pendingStatus']),
                         ('none', None, None))
        self.assertEqual((rows[pending.student_id]['reason'], rows[pending.student_id]['applicationId']),
                         ('in_progress', pending.pk))
        self.assertEqual(rows[rejected.student_id]['reason'], 'none')
        self.assertEqual(data['results'][-1]['id'], pending.student_id)
        self.assertEqual(self.get(status='in_progress').data['total'], 1)
        self.assertEqual(self.get(q=never.matric_no, semester='Intake 1').data['total'], 1)
        self.assertEqual(self.summary().data['withoutSupervisor'], 3)

    def test_supporting_only_and_ended_primary_do_not_mask_missing_primary(self):
        supporting = self.nomination(status='APPROVED')
        CoSupervisorAppointment.objects.create(nomination=supporting, student=self.student,
            supervisor=self.new_supervisor, approved_by=self.coordinator)
        self.supervisor_appointment.status = 'ENDED'
        self.supervisor_appointment.save(update_fields=['status'])
        self.assertEqual(self.get().data['results'][0]['id'], self.student.pk)
        self.assertEqual(self.summary().data['withoutSupervisor'], 1)

    def test_rp1_count_matches_filtered_coverage_and_prioritizes_no_application(self):
        pending = self.application_for(1)
        no_request = self.never_applied(1)
        unknown = self.never_applied(2)
        for student in (pending.student, no_request, self.student):
            StudentSemester.objects.get_or_create(student=student,
                session=self.semester.academic_session, term=self.semester.term)
            ProjectRegistration.objects.update_or_create(student=student, academic_semester=self.semester,
                                                         defaults={'stage': 'P1'})
        page = self.get(projectStage='P1').data
        self.assertEqual([(row['id'], row['projectStage']) for row in page['results']],
                         [(no_request.pk, 'P1'), (pending.student_id, 'P1')])
        self.assertEqual(self.summary().data['withoutSupervisorRp1'], page['total'])
        self.assertEqual(self.get(projectStage='NOT_CONFIRMED').data['results'][0]['id'], unknown.pk)

    def test_saved_stage_filter_preserves_coverage_without_active_semester(self):
        student = self.never_applied(1)
        with patch('appointments.office_attention.current_effective_semester', return_value=None):
            page = self.get(projectStage='P1').data
        self.assertIsNone(page['projectSemester'])
        self.assertEqual([(row['id'], row['projectStage']) for row in page['results']], [(student.pk, None)])

    def test_disabled_and_nonactive_students_are_excluded_from_both_categories(self):
        for n, status in enumerate([Student.Status.DEFERRED, Student.Status.GRADUATED, Student.Status.WITHDRAWN], 1):
            application = self.application_for(n)
            Student.objects.filter(pk=application.student_id).update(status=status)
        disabled = self.application_for(4)
        User.objects.filter(pk=disabled.student_id).update(is_active=False)
        wrong_role = self.never_applied(9)
        User.objects.filter(pk=wrong_role.pk).update(role=User.Role.LECTURER)
        self.application_for(5, status='CANCELLED_BY_STUDENT')
        self.assertEqual(self.get().data['total'], 1)  # enabled student may reapply after withdrawal
        self.assertEqual(self.get('waiting').data['total'], 0)
        self.assertEqual(self.summary().data['waitingRequests'], 0)

    def test_waiting_mixes_kinds_and_uses_current_stage_age_and_legacy_research_status(self):
        primary = self.application_for(1)
        primary.supervisor_decided_at = timezone.now() - timedelta(days=2)
        primary.save(update_fields=['supervisor_decided_at'])
        supporting = self.nomination(status='SUBMITTED_TO_CO_SUPERVISOR')
        research = self.row(status='PENDING_COORDINATOR')
        transfer = self.row(status='PENDING_DESTINATION_COORDINATOR', kind='TRANSFER')
        stage_at = timezone.now() - timedelta(days=4)
        event = ResearchAmendmentEvent.objects.create(request=transfer, actor=self.coordinator,
            actor_role=self.coordinator.role, actor_name=self.coordinator.full_name, action='APPROVE',
            previous_status='PENDING_SOURCE_COORDINATOR', new_status=transfer.status)
        models.QuerySet(model=ResearchAmendmentEvent).filter(pk=event.pk).update(created_at=stage_at)
        models.QuerySet(model=ResearchAmendment).filter(pk=transfer.pk).update(created_at=timezone.now()-timedelta(days=20))
        self.row(status='REJECTED')
        data = self.get('waiting', sort='waiting').data
        self.assertEqual(data['total'], 4)
        self.assertEqual(data['results'][0]['key'], f'transfer-{transfer.pk}')
        self.assertEqual(data['results'][0]['waitingDays'], 4)
        rows = {r['key']: r for r in data['results']}
        self.assertEqual(rows[f'primary-{primary.pk}']['waitingDays'], 2)
        self.assertEqual(rows[f'research-{research.pk}']['status'], 'PENDING_SUPERVISOR')
        self.assertEqual(rows[f'research-{research.pk}']['waitingOn'], 'Supervisor')
        self.assertEqual(rows[f'supporting-{supporting.pk}']['waitingOn'], 'Supporting lecturer')
        self.assertEqual(self.get('waiting', type='research', status='PENDING_SUPERVISOR').data['total'], 1)
        self.assertEqual(self.get('waiting', semester=self.semester.label, q=primary.student.matric_no).data['total'], 1)
        research.refresh_from_db()
        self.assertEqual(research.status, 'PENDING_COORDINATOR')
        self.assertEqual(self.summary().data['waitingRequests'], 4)

    def test_primary_missing_explicit_stage_timestamp_uses_immutable_workflow_event(self):
        row = self.application_for(1)
        row.supervisor_decided_at = None
        row.save(update_fields=['supervisor_decided_at'])
        event = AppointmentWorkflowEvent.objects.create(supervisor_application=row, actor=self.supervisor,
            actor_role=self.supervisor.role, action='ACCEPT', previous_status='SUBMITTED_TO_SUPERVISOR', new_status=row.status)
        AppointmentWorkflowEvent.objects.filter(pk=event.pk).update(created_at=timezone.now()-timedelta(days=7))
        self.assertEqual(self.get('waiting').data['results'][0]['waitingDays'], 7)

    def test_supporting_stage_uses_transition_event_when_explicit_timestamp_is_absent(self):
        row = self.nomination()
        row.candidate_decided_at = None
        row.save(update_fields=['candidate_decided_at'])
        event = AppointmentWorkflowEvent.objects.create(co_supervisor_nomination=row, actor=self.new_supervisor,
            actor_role=self.new_supervisor.role, action='ACCEPT', previous_status='SUBMITTED_TO_CO_SUPERVISOR', new_status=row.status)
        AppointmentWorkflowEvent.objects.filter(pk=event.pk).update(created_at=timezone.now()-timedelta(days=3))
        self.assertEqual(self.get('waiting').data['results'][0]['waitingDays'], 3)

    def test_mixed_request_submitted_order_and_category_filters_precede_paging(self):
        primary = self.application_for(1, status='SUBMITTED_TO_SUPERVISOR')
        supporting = self.nomination(status='SUBMITTED_TO_CO_SUPERVISOR')
        for _ in range(11):
            self.row(status='PENDING_SOURCE_COORDINATOR', kind='TRANSFER')
        self.row(status='PENDING_SUPERVISOR')
        oldest = self.get('waiting', sort='oldest').data
        newest = self.get('waiting', sort='newest').data
        self.assertEqual(oldest['total'], 14)
        self.assertEqual(oldest['results'][0]['key'], f'primary-{primary.pk}')
        self.assertEqual(newest['results'][0]['kind'], 'research')
        page = self.get('waiting', type='transfer', status='PENDING_SOURCE_COORDINATOR', page=2).data
        self.assertEqual((page['total'], len(page['results'])), (11, 1))
        self.assertEqual(self.get('waiting', type='supporting').data['results'][0]['key'], f'supporting-{supporting.pk}')

    def test_waiting_submitted_dates_filter_before_paging_and_validate_iso_ranges(self):
        first = self.application_for(1)
        self.application_for(10)
        today = timezone.localdate()
        response = self.get('waiting', **{'from': (today-timedelta(days=2)).isoformat(), 'to': today.isoformat()})
        self.assertEqual(response.data['total'], 1)
        self.assertEqual(response.data['results'][0]['key'], f'primary-{first.pk}')
        for query in ({'from': 'bad'}, {'to': '2026-02-30'}, {'from': '2026-2-1'},
                      {'from': today.isoformat(), 'to': (today-timedelta(days=1)).isoformat()}):
            self.assertEqual(self.get('waiting', **query).status_code, 400, query)
        self.assertEqual(self.summary().data['waitingRequests'], 2)

    def test_waiting_type_facets_only_offer_relevant_effective_stages(self):
        self.application_for(1)
        self.nomination(status='SUBMITTED_TO_CO_SUPERVISOR')
        self.row(status='PENDING_COORDINATOR')
        research = self.get('waiting', type='research').data
        self.assertEqual(research['facets']['statuses'], ['PENDING_SUPERVISOR'])

    def test_waiting_excludes_disabled_research_and_deferred_supporting_participants(self):
        self.nomination()
        Student.objects.filter(pk=self.student.pk).update(status=Student.Status.DEFERRED)
        research = self.row(status='PENDING_SUPERVISOR')
        User.objects.filter(pk=research.student_id).update(is_active=False)
        transfer = self.row(status='PENDING_SOURCE_COORDINATOR', kind='TRANSFER')
        Student.objects.filter(pk=transfer.student_id).update(status=Student.Status.WITHDRAWN)
        self.assertEqual(self.get('waiting').data['total'], 0)
        self.assertEqual(self.summary().data['waitingRequests'], 0)

    def test_compact_students_and_mixed_requests_count_filter_and_slice_in_sql(self):
        for n in range(1, 14):
            self.application_for(n)
        with CaptureQueriesContext(connection) as captured:
            response = self.get('waiting', page=2, size=10, sort='oldest')
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.data['total'], response.data['pageCount'], len(response.data['results'])), (13, 2, 3))
        self.assertTrue(any('LIMIT 10 OFFSET 10' in q['sql'] for q in captured))
        self.assertFalse(any('research_abstract' in q['sql'] or '"before_values"' in q['sql'] for q in captured))
        with CaptureQueriesContext(connection) as captured:
            students = self.get(page=2, size=10)
        self.assertEqual(students.data['total'], 13)
        self.assertEqual(len(students.data['results']), 3)
        self.assertTrue(any('LIMIT 10 OFFSET 10' in q['sql'] for q in captured))
        self.assertEqual(self.get('waiting', programme='Outside').data['total'], 0)
        self.assertEqual(self.summary().data['waitingRequests'], 13)

    def test_workload_uses_published_capacity_and_primary_plus_supporting_load(self):
        for n in range(1, 4):
            row = self.application_for(n, status='APPROVED')
            SupervisorAppointment.objects.create(application=row, student=row.student,
                supervisor=self.supervisor, approved_by=self.coordinator)
        nomination = self.nomination(candidate=self.supervisor, status='APPROVED')
        CoSupervisorAppointment.objects.create(nomination=nomination, student=self.student,
            supervisor=self.supervisor, approved_by=self.coordinator)
        missing = self._lecturer('missing@example.test', 'MISSING', supervisor=True)
        data = self.get('workload').data
        self.assertEqual(data['total'], 2)
        rows = {r['id']: r for r in data['results']}
        resolution = resolve_lecturer_capacity(user=self.supervisor, semester=self.semester, role=CapacityRole.SUPERVISOR)
        self.assertEqual((rows[self.supervisor.pk]['currentStudents'], rows[self.supervisor.pk]['workloadLimit']), (5, resolution.limit))
        self.assertEqual(rows[self.supervisor.pk]['reason'], 'full')
        self.assertEqual(rows[missing.pk]['reason'], 'not_configured')
        self.assertEqual(rows[missing.pk]['capacityState'], 'NOT_CONFIGURED')
        self.assertIsNone(rows[missing.pk]['workloadLimit'])
        self.assertNotIn('supervisees', rows[self.supervisor.pk])
        self.assertEqual(self.get('workload', status='full').data['total'], 1)
        self.assertEqual(self.get('workload', q='MISSING').data['total'], 1)
        summary = self.summary().data
        self.assertEqual(summary['workloadConcerns'], 2)
        self.assertEqual(summary['capacitySemester'], {'id': self.semester.pk, 'label': self.semester.label})

    def test_workload_near_and_over_are_distinct_and_no_semester_is_unconfigured(self):
        for n in range(1, 4):
            row = self.application_for(n, status='APPROVED')
            SupervisorAppointment.objects.create(application=row, student=row.student,
                supervisor=self.supervisor, approved_by=self.coordinator)
        self.assertEqual(self.get('workload').data['results'][0]['reason'], 'near_limit')
        for n in (4, 5):
            row = self.application_for(n, status='APPROVED')
            SupervisorAppointment.objects.create(application=row, student=row.student,
                supervisor=self.supervisor, approved_by=self.coordinator)
        self.assertEqual(self.get('workload').data['results'][0]['reason'], 'over_capacity')
        with patch('appointments.office_attention.current_effective_semester', return_value=None):
            rows = self.get('workload').data['results']
            self.assertTrue(all(r['reason'] == 'not_configured' for r in rows))
            self.assertIsNone(self.summary().data['capacitySemester'])

    def test_configured_zero_is_full_and_published_limits_ignore_legacy_profile_limits(self):
        self.semester.lifecycle_status = 'CLOSED'
        self.semester.save(update_fields=['lifecycle_status'])
        semester = AcademicSemester.objects.create(code='CURRENT-ZERO', academic_session='2100/2101',
            term=AcademicSemester.Term.SEMESTER_I, starts_on=self.semester.starts_on, ends_on=self.semester.ends_on,
            lifecycle_status='ACTIVE', created_by=self.office)
        Supervisor.objects.filter(lecturer=self.new_supervisor.lecturer).update(max_supervisees=0)
        publish_test_capacity_plan(semester, self.office)
        Supervisor.objects.filter(lecturer=self.new_supervisor.lecturer).update(max_supervisees=99)
        data = self.get('workload').data
        zero = next(r for r in data['results'] if r['id'] == self.new_supervisor.pk)
        self.assertEqual((zero['workloadLimit'], zero['reason'], zero['capacityState']), (0, 'full', 'FULL'))
        self.assertEqual(self.summary().data['capacitySemester']['id'], semester.pk)

    def test_workload_capacity_state_respects_current_availability_window(self):
        for n in range(1, 5):
            row = self.application_for(n, status='APPROVED')
            SupervisorAppointment.objects.create(application=row, student=row.student,
                supervisor=self.supervisor, approved_by=self.coordinator)
        LecturerAvailabilityWindow.objects.create(academic_semester=self.semester, lecturer=self.supervisor.lecturer,
            role='SUPERVISOR', starts_on=timezone.localdate(), ends_on=timezone.localdate()+timedelta(days=5),
            created_by=self.office, reason='Documented leave')
        row = self.get('workload').data['results'][0]
        capacity = resolve_lecturer_capacity(user=self.supervisor, semester=self.semester, role=CapacityRole.SUPERVISOR)
        self.assertEqual(row['capacityState'], capacity.state)
        self.assertEqual(row['reason'], 'full')

    def test_workload_pages_aggregates_before_serialization_without_supervisee_details(self):
        for n in range(13):
            self._lecturer(f'unconfigured-{n}@example.test', f'UNCONFIGURED-{n:03d}', supervisor=True)
        with CaptureQueriesContext(connection) as captured:
            response = self.get('workload', page=2, size=10)
        self.assertEqual((response.data['total'], len(response.data['results'])), (13, 3))
        self.assertTrue(any('LIMIT 10 OFFSET 10' in q['sql'] for q in captured))
        self.assertFalse(any('research_abstract' in q['sql'] or 'research_title' in q['sql'] for q in captured))
        self.assertEqual(self.summary().data['workloadConcerns'], 13)

    def test_attention_validation_and_office_only_access(self):
        for query in ({'category': 'bad'}, {'size': 11}, {'page': 0}, {'page': 'bad'},
                      {'status': 'bad'}, {'sort': 'bad'}, {'category': 'waiting', 'type': 'panel'},
                      {'category': 'workload', 'semester': 'ignored'}, {'category': 'workload', 'programme': 'ignored'}):
            self.assertEqual(self.get(**query).status_code, 400, query)
        for actor in (self.coordinator, self.supervisor, self.student_user,
                      User.objects.create_user(email='technical@example.test', role=User.TECHNICAL_ADMIN)):
            self.client.force_authenticate(actor)
            self.assertEqual(self.get().status_code, 403)
            self.assertEqual(self.summary().status_code, 403)
        for field in ('is_active',):
            setattr(self.office, field, False)
            self.office.save(update_fields=[field])
            self.client.force_authenticate(self.office)
            self.assertEqual(self.get().status_code, 403)
            self.assertEqual(self.summary().status_code, 403)
            setattr(self.office, field, True)
            self.office.save(update_fields=[field])
        self.assertEqual(self.client.get('/api/appointments/coordinator-workspace/attention/').status_code, 404)
