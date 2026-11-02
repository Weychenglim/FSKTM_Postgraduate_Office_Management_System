from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIRequestFactory, APITestCase, force_authenticate

from academics.capacity import CapacityRole, resolve_lecturer_capacity
from academics.models import AcademicSemester, LecturerAvailabilityWindow
from academics.test_capacity_helpers import publish_test_capacity_plan
from accounts.models import Lecturer, Panel, Student, User
from . import test_appointment_lifecycle as fixtures
from .models import (AppointmentWorkflowEvent, PanelAppointment, PanelRecommendation,
                     ResearchAmendment, StudentResearchProfile, SupervisorApplication,
                     SupervisorAppointment)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PanelWorkspaceTests(APITestCase):
    setUp = fixtures.AppointmentLifecycleTests.setUp
    _lecturer = fixtures.AppointmentLifecycleTests._lecturer
    _panel_appointment = fixtures.AppointmentLifecycleTests._panel_appointment

    def page(self, category='students', **params):
        from .panel_workspace import attention_page
        return attention_page({'category': category, **params})

    def summary(self):
        from .panel_workspace import attention_summary
        return attention_summary()

    def student_profile(self, number, *, programme=None):
        user = User.objects.create_user(email=f'panel-browse-{number}@example.test',
            full_name=f'Panel Student {number:03d}', role=User.Role.STUDENT)
        student = Student.objects.create(user=user, matric_no=f'PANEL-BROWSE-{number:03d}',
            programme=programme or self.student.programme)
        application = SupervisorApplication.objects.create(student=student, proposed_supervisor=self.supervisor,
            academic_semester=self.semester, status='APPROVED', research_title='Research', research_abstract='Private abstract')
        SupervisorAppointment.objects.create(application=application, student=student,
            supervisor=self.supervisor, approved_by=self.coordinator)
        return StudentResearchProfile.objects.create(student=user, matric_no=student.matric_no,
            student_name=user.full_name, programme=student.programme, semester=self.semester.label,
            proposed_topic='Research', abstract='Private abstract', supervisor=self.supervisor)

    def recommendation(self, profile=None, *, status='SUBMITTED_TO_PANEL', candidate=None, **fields):
        return PanelRecommendation.objects.create(profile=profile or self.profile,
            supervisor=self.supervisor, recommended_member=candidate or self.panel,
            academic_semester=self.semester, status=status, submitted_at=timezone.now(), **fields)

    def appointment(self, profile=None, *, status='ACTIVE', candidate=None):
        recommendation = self.recommendation(profile, status='APPROVED', candidate=candidate)
        return PanelAppointment.objects.create(recommendation=recommendation, profile=recommendation.profile,
            supervisor=self.supervisor, panel_member=candidate or self.panel,
            approved_by=self.coordinator, status=status)

    def response(self, view, actor, **params):
        from . import panel_workspace
        request = APIRequestFactory().get('/panel/attention/', params)
        if actor is not None:
            force_authenticate(request, user=actor)
        return getattr(panel_workspace, view)(request)

    def test_students_use_current_coverage_and_keep_pending_progress_once(self):
        pending_profile = self.student_profile(1)
        pending = self.recommendation(pending_profile)
        self.recommendation(pending_profile, status='REJECTED_BY_PANEL')
        for number, status in enumerate(('REJECTED_BY_PANEL', 'REJECTED_BY_COORDINATOR',
                'CANCELLED_BY_SUPERVISOR', 'CANCELLED_BY_OFFICE'), 2):
            self.recommendation(self.student_profile(number), status=status)
        self.appointment(self.student_profile(6), status='ENDED')
        self.appointment(self.student_profile(7), status='COMPLETED')
        covered = self.student_profile(8)
        active = self.appointment(covered)
        self.recommendation(covered, candidate=self.new_panel, replaces_appointment=active)
        data = self.page()
        self.assertEqual(data['total'], 8)
        rows = {row['id']: row for row in data['results']}
        self.assertEqual(len(rows), 8)
        self.assertNotIn(covered.student_id, rows)
        self.assertEqual((rows[pending_profile.student_id]['reason'],
                          rows[pending_profile.student_id]['recommendationId']), ('in_progress', pending.pk))
        self.assertEqual(rows[self.student.pk]['reason'], 'none')
        self.assertEqual(self.summary()['withoutPanel'], 8)
        self.assertEqual(self.summary()['waitingRequests'], 2)

    def test_students_exclude_missing_or_unsuitable_profiles_and_ineligible_supervision(self):
        for number, change in enumerate(('disabled', 'deferred', 'wrong_role', 'no_primary',
                'wrong_supervisor', 'programme_mismatch', 'unlinked', 'missing_profile'), 1):
            profile = self.student_profile(number)
            if change == 'disabled':
                User.objects.filter(pk=profile.student_id).update(is_active=False)
            elif change == 'deferred':
                Student.objects.filter(pk=profile.student_id).update(status=Student.Status.DEFERRED)
            elif change == 'wrong_role':
                User.objects.filter(pk=profile.student_id).update(role=User.Role.LECTURER)
            elif change == 'no_primary':
                SupervisorAppointment.objects.filter(student_id=profile.student_id).update(status='ENDED')
            elif change == 'wrong_supervisor':
                StudentResearchProfile.objects.filter(pk=profile.pk).update(supervisor=self.new_supervisor)
            elif change == 'programme_mismatch':
                StudentResearchProfile.objects.filter(pk=profile.pk).update(programme='Outside')
            elif change == 'unlinked':
                StudentResearchProfile.objects.filter(pk=profile.pk).update(student=None)
            else:
                profile.delete()
        self.assertEqual([row['id'] for row in self.page()['results']], [self.student.pk])
        Lecturer.objects.filter(pk=self.supervisor.pk).update(lifecycle_status=Lecturer.Lifecycle.RETIRING)
        self.assertEqual(self.page()['total'], 0)

    def test_students_use_authoritative_identity_and_trimmed_programme_agreement(self):
        self.profile.student_name = 'Outdated name'
        self.profile.programme = '  ' + self.student.programme.lower() + ' '
        self.profile.save(update_fields=['student_name', 'programme'])
        row = self.page()['results'][0]
        self.assertEqual((row['studentName'], row['programme']), (self.student_user.full_name, self.student.programme))
        self.assertEqual(row['profileId'], self.profile.pk)

    def test_pending_transfer_is_not_eligible_for_new_panel_nomination(self):
        ResearchAmendment.objects.create(student=self.student, profile=self.profile, initiated_by=self.student_user,
            kind='TRANSFER', status='PENDING_SOURCE_COORDINATOR', source_programme=self.student.programme,
            destination_programme='Outside', before_values={}, after_values={}, baseline_revision=0,
            reason='Transfer request', student_name=self.student_user.full_name, matric_no=self.student.matric_no)
        self.assertEqual(self.page()['total'], 0)

    def test_waiting_uses_current_stage_age_event_fallback_and_real_reviewer(self):
        coordinator = self.recommendation(status='PENDING_COORDINATOR', panel_decided_at=timezone.now()-timedelta(days=2))
        PanelRecommendation.objects.filter(pk=coordinator.pk).update(submitted_at=timezone.now()-timedelta(days=30))
        event_row = self.recommendation(self.student_profile(1), status='PENDING_COORDINATOR')
        event = AppointmentWorkflowEvent.objects.create(panel_recommendation=event_row, actor=self.panel,
            actor_role=self.panel.role, action='ACCEPT', previous_status='SUBMITTED_TO_PANEL', new_status='PENDING_COORDINATOR')
        AppointmentWorkflowEvent.objects.filter(pk=event.pk).update(created_at=timezone.now()-timedelta(days=7))
        selected = self.recommendation(self.student_profile(2))
        data = self.page('waiting')
        self.assertEqual([row['id'] for row in data['results']], [event_row.pk, coordinator.pk, selected.pk])
        self.assertEqual([row['waitingDays'] for row in data['results']], [7, 2, 0])
        self.assertEqual([row['waitingOn'] for row in data['results']],
            ['PROGRAMME_COORDINATOR', 'PROGRAMME_COORDINATOR', 'SELECTED_PANEL'])
        self.assertIsNotNone(data['results'][0]['waitingSince'])

    def test_waiting_includes_stuck_active_students_but_excludes_disabled_and_nonactive(self):
        self.recommendation()
        self.supervisor_appointment.status = 'ENDED'
        self.supervisor_appointment.save(update_fields=['status'])
        for number, status in enumerate((Student.Status.DEFERRED, Student.Status.GRADUATED, Student.Status.WITHDRAWN), 1):
            profile = self.student_profile(number)
            self.recommendation(profile)
            Student.objects.filter(pk=profile.student_id).update(status=status)
        disabled = self.student_profile(4)
        self.recommendation(disabled)
        User.objects.filter(pk=disabled.student_id).update(is_active=False)
        self.assertEqual(self.page('waiting')['total'], 1)
        self.assertEqual(self.summary()['waitingRequests'], 1)

    def test_waiting_filters_and_sql_paging_keep_global_facets_and_counts(self):
        for number in range(1, 14):
            self.recommendation(self.student_profile(number), status='PENDING_COORDINATOR',
                panel_decided_at=timezone.now()-timedelta(days=number))
        other = self.recommendation(self.student_profile(20, programme='Outside'))
        with CaptureQueriesContext(connection) as captured:
            data = self.page('waiting', programme=self.student.programme, page=2, size=10)
        self.assertEqual((data['total'], data['page'], data['pageCount'], len(data['results'])), (13, 2, 2, 3))
        self.assertTrue(any('LIMIT 10 OFFSET 10' in query['sql'] for query in captured))
        self.assertFalse(any('"abstract"' in query['sql'] or '"justification"' in query['sql'] for query in captured))
        self.assertEqual(data['facets']['programmes'], sorted([self.student.programme, 'Outside']))
        self.assertEqual(data['facets']['statuses'], ['PENDING_COORDINATOR', 'SUBMITTED_TO_PANEL'])
        filtered = self.page('waiting', q=other.profile.matric_no, programme='Outside', semester=self.semester.label,
            status='SUBMITTED_TO_PANEL', **{'from': timezone.localdate().isoformat(), 'to': timezone.localdate().isoformat()})
        self.assertEqual([row['id'] for row in filtered['results']], [other.pk])
        self.assertEqual(self.summary()['waitingRequests'], 14)

    def test_student_filters_counts_and_page_slicing(self):
        for number in range(1, 14):
            profile = self.student_profile(number)
            if number == 1:
                self.recommendation(profile)
        with CaptureQueriesContext(connection) as captured:
            data = self.page(page=2, size=10)
        self.assertEqual((data['total'], len(data['results'])), (14, 4))
        self.assertTrue(any('LIMIT 10 OFFSET 10' in query['sql'] for query in captured))
        pending = self.page(status='in_progress')
        self.assertEqual((pending['total'], pending['results'][0]['matricNo']), (1, 'PANEL-BROWSE-001'))
        self.assertEqual(self.page(q='PANEL-BROWSE-002', programme=self.student.programme,
            semester=self.semester.label)['total'], 1)
        self.assertEqual(self.page(q='Nothing')['facets'], data['facets'])
        self.assertEqual(self.summary()['withoutPanel'], 14)

    def test_workload_counts_all_active_and_reserved_rows_against_current_published_limit(self):
        self.appointment()
        for number in range(1, 4):
            self.recommendation(self.student_profile(number), status='PENDING_COORDINATOR')
        missing = self._lecturer('unconfigured-panel@example.test', 'MISSING', panel=True)
        # A persisted old profile limit must not replace the published semester policy.
        Panel.objects.filter(pk=self.panel.pk).update(max_appointments=99)
        Student.objects.filter(pk=self.student.pk).update(status=Student.Status.GRADUATED)
        data = self.page('workload')
        rows = {row['id']: row for row in data['results']}
        row = rows[self.panel.pk]
        self.assertEqual((row['activeLoad'], row['reservedLoad'], row['currentStudents'], row['workloadLimit']), (1, 3, 4, 5))
        self.assertEqual((row['reason'], row['capacityState'], row['availableSlots']), ('near_limit', 'AVAILABLE', 1))
        self.assertEqual((rows[missing.pk]['reason'], rows[missing.pk]['capacityState']), ('not_configured', 'NOT_CONFIGURED'))
        self.assertNotIn('supervisees', row)
        self.assertEqual(self.page('workload', status='near_limit')['total'], 1)
        self.assertEqual(self.page('workload', q='MISSING')['total'], 1)
        self.assertEqual(self.summary()['capacitySemester'], {'id': self.semester.pk, 'label': self.semester.label})

    def test_workload_full_over_and_temporary_unavailability_match_authoritative_resolver(self):
        for number in range(1, 7):
            self.recommendation(self.student_profile(number), status='PENDING_COORDINATOR')
            if number in (5, 6):
                row = next(row for row in self.page('workload')['results'] if row['id'] == self.panel.pk)
                self.assertEqual((row['reason'], row['currentStudents']), ('full' if number == 5 else 'over_capacity', number))
        until = timezone.localdate()+timedelta(days=5)
        LecturerAvailabilityWindow.objects.create(academic_semester=self.semester, lecturer=self.new_panel.lecturer,
            role='PANEL', starts_on=timezone.localdate(), ends_on=until, created_by=self.office, reason='Leave')
        rows = {row['id']: row for row in self.page('workload')['results']}
        self.assertEqual((rows[self.new_panel.pk]['reason'], rows[self.new_panel.pk]['unavailableUntil']),
            ('temporarily_unavailable', until))
        for user in (self.panel, self.new_panel):
            expected = resolve_lecturer_capacity(user=user, semester=self.semester, role=CapacityRole.PANEL)
            self.assertEqual((rows[user.pk]['capacityState'], rows[user.pk]['activeLoad'], rows[user.pk]['reservedLoad']),
                (expected.state, expected.active_load, expected.reserved_load))
        self.assertEqual(self.summary()['workloadConcerns'], 2)

    def test_unanswered_nominations_remain_in_waiting_queue_without_using_capacity(self):
        for number in range(1, 7):
            self.recommendation(self.student_profile(number))
        self.assertEqual(self.page('waiting')['total'], 6)
        self.assertEqual(self.summary()['waitingRequests'], 6)
        self.assertEqual(self.page('workload')['total'], 0)

    def test_workload_uses_current_semester_and_all_semester_reservations(self):
        self.recommendation(status='PENDING_COORDINATOR')
        self.semester.lifecycle_status = 'CLOSED'
        self.semester.save(update_fields=['lifecycle_status'])
        semester = AcademicSemester.objects.create(code='PANEL-CURRENT', academic_session='2100/2101', term='SEMESTER_I',
            starts_on=self.semester.starts_on, ends_on=self.semester.ends_on, lifecycle_status='ACTIVE', created_by=self.office)
        Panel.objects.filter(pk=self.panel.pk).update(max_appointments=1)
        publish_test_capacity_plan(semester, self.office)
        row = self.page('workload')['results'][0]
        self.assertEqual((row['id'], row['workloadLimit'], row['reservedLoad'], row['reason']), (self.panel.pk, 1, 1, 'full'))
        self.assertEqual(self.summary()['capacitySemester']['id'], semester.pk)
        with patch('appointments.panel_workspace.current_effective_semester', return_value=None):
            self.assertEqual(self.page('workload')['total'], 2)
            self.assertTrue(all(row['capacityState'] == 'NOT_CONFIGURED' for row in self.page('workload')['results']))
            self.assertIsNone(self.summary()['capacitySemester'])

    def test_zero_capacity_is_full_and_ineligible_lecturers_are_excluded(self):
        self.semester.lifecycle_status = 'CLOSED'
        self.semester.save(update_fields=['lifecycle_status'])
        semester = AcademicSemester.objects.create(code='PANEL-ZERO', academic_session='2100/2101', term='SEMESTER_I',
            starts_on=self.semester.starts_on, ends_on=self.semester.ends_on, lifecycle_status='ACTIVE', created_by=self.office)
        Panel.objects.filter(pk=self.new_panel.pk).update(max_appointments=0)
        publish_test_capacity_plan(semester, self.office)
        disabled = self._lecturer('disabled-panel@example.test', 'DISABLED', panel=True)
        retired = self._lecturer('retired-panel@example.test', 'RETIRED', panel=True)
        User.objects.filter(pk=disabled.pk).update(is_active=False)
        Lecturer.objects.filter(pk=retired.pk).update(lifecycle_status=Lecturer.Lifecycle.RETIRED)
        data = self.page('workload')
        self.assertEqual(data['total'], 1)
        row = data['results'][0]
        self.assertEqual((row['id'], row['currentStudents'], row['workloadLimit'], row['reason'], row['capacityState']),
            (self.new_panel.pk, 0, 0, 'full', 'FULL'))

    def test_workload_paging_is_compact_and_facets_precede_filters(self):
        for number in range(13):
            self._lecturer(f'missing-panel-{number}@example.test', f'MISSING-{number:03d}', panel=True)
        with CaptureQueriesContext(connection) as captured:
            data = self.page('workload', page=2, size=10, status='not_configured')
        self.assertEqual((data['total'], data['pageCount'], len(data['results'])), (13, 2, 3))
        self.assertTrue(any('LIMIT 10 OFFSET 10' in query['sql'] for query in captured))
        self.assertFalse(any('"abstract"' in query['sql'] or '"justification"' in query['sql'] for query in captured))
        self.assertEqual(self.page('workload', q='No such lecturer')['facets'], data['facets'])

    def test_missing_submission_timestamp_retains_truth_and_uses_stage_event_age(self):
        row = self.recommendation()
        PanelRecommendation.objects.filter(pk=row.pk).update(submitted_at=None)
        event = AppointmentWorkflowEvent.objects.create(panel_recommendation=row, actor=self.supervisor,
            actor_role=self.supervisor.role, action='SUBMIT', previous_status='', new_status='SUBMITTED_TO_PANEL')
        entered = timezone.now()-timedelta(days=4)
        AppointmentWorkflowEvent.objects.filter(pk=event.pk).update(created_at=entered)
        data = self.page('waiting')['results'][0]
        self.assertIsNone(data['submittedAt'])
        self.assertEqual((data['waitingSince'], data['waitingDays']), (entered, 4))

    def test_office_attention_reads_do_not_modify_academic_records(self):
        self.recommendation()
        with CaptureQueriesContext(connection) as captured:
            for view, params in (('summary_view', {}), ('attention_view', {'category': 'students'}),
                    ('attention_view', {'category': 'waiting'}), ('attention_view', {'category': 'workload'})):
                self.assertEqual(self.response(view, self.office, **params).status_code, 200)
        self.assertFalse(any(query['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for query in captured))

    def test_office_only_read_views_reject_every_other_role_and_inactive_accounts(self):
        for view in ('summary_view', 'attention_view'):
            self.assertEqual(self.response(view, self.office).status_code, 200)
            for actor in (self.student_user, self.supervisor, self.panel, self.coordinator):
                self.assertEqual(self.response(view, actor).status_code, 403)
            self.assertIn(self.response(view, None).status_code, (401, 403))
            self.office.is_active = False
            self.assertEqual(self.response(view, self.office).status_code, 403)
            self.office.is_active = True

    def test_invalid_filters_are_rejected_and_empty_and_excess_pages_are_valid(self):
        for params in ({'category': 'invalid'}, {'size': 100}, {'page': 0}, {'page': 'x'},
                {'category': 'waiting', 'sort': 'random'}, {'category': 'waiting', 'status': 'APPROVED'},
                {'category': 'waiting', 'from': '2026-2-1'}, {'category': 'waiting', 'to': '2026-02-30'},
                {'category': 'waiting', 'from': '2026-02-03', 'to': '2026-02-01'},
                {'category': 'workload', 'semester': 'Old'}, {'category': 'workload', 'programme': 'Outside'}):
            self.assertEqual(self.response('attention_view', self.office, **params).status_code, 400, params)
        self.assertEqual(self.page(page=99)['page'], 1)
        empty = self.page(q='No such student', size=50)
        self.assertEqual((empty['total'], empty['page'], empty['pageSize'], empty['pageCount'], empty['results']), (0, 1, 50, 0, []))
