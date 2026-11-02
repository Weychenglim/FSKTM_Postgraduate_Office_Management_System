"""Marks remains authoritative while calendar links retain their owning semester."""
from datetime import datetime, time, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from dashboard.models import SemesterTimeline, SemesterTimelineEntry
from marks import test_period_targeting as fixtures
from marks.models import MarksConfigurationAudit


class TimelinePeriodSemesterInvariantTests(APITestCase):
    setUp = fixtures.PeriodTargetingTests.setUp
    user = fixtures.PeriodTargetingTests.user
    lecturer = fixtures.PeriodTargetingTests.lecturer
    payload = fixtures.PeriodTargetingTests.payload
    period = fixtures.PeriodTargetingTests.period

    def destination(self):
        today = timezone.localdate()
        return AcademicSemester.objects.create(
            code='2200-2201-S2', academic_session='2200/2201', term='SEMESTER_II',
            starts_on=today + timedelta(days=150), ends_on=today + timedelta(days=240),
            lifecycle_status='DRAFT', created_by=self.office)

    def move_payload(self, semester):
        start = timezone.make_aware(datetime.combine(semester.starts_on, time(hour=9)))
        return {'semesterId': semester.pk, 'name': 'Moved draft',
            'opensAt': start.isoformat(), 'closesAt': (start + timedelta(days=7)).isoformat()}

    def link(self, period):
        timeline = SemesterTimeline.objects.create(academic_semester=self.semester,
            semester=self.semester.get_term_display(), session=self.semester.academic_session,
            uploaded_by=self.office)
        response = self.client.post('/api/dashboard/timeline/entries/', {
            'semesterId': self.semester.pk, 'level': 'P1', 'title': 'Linked draft Marks dates',
            'detail': 'Dates belong to the selected Marks period.', 'action': 'Lecturer',
            'deadlineStart': timezone.localdate(period.opens_at).isoformat(),
            'deadlineEnd': timezone.localdate(period.closes_at).isoformat(),
            'targetRoles': ['LECTURER'], 'marksPeriodId': period.pk,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return SemesterTimelineEntry.objects.get(pk=response.data['id'])

    def test_linked_draft_cannot_move_to_another_semester_and_preserves_all_facts(self):
        period = self.period()
        entry = self.link(period)
        original = (period.name, period.academic_semester_id, period.opens_at, period.closes_at)
        audit_count = MarksConfigurationAudit.objects.count()
        result = self.client.patch(f'/api/marks/periods/{period.pk}/',
            self.move_payload(self.destination()), format='json')
        self.assertEqual(result.status_code, 409, result.data)
        period.refresh_from_db(); entry.refresh_from_db()
        self.assertEqual((period.name, period.academic_semester_id, period.opens_at, period.closes_at), original)
        self.assertEqual(entry.marks_period_id, period.pk)
        self.assertEqual(entry.timeline.academic_semester_id, original[1])
        self.assertEqual(MarksConfigurationAudit.objects.count(), audit_count)

    def test_unlinked_draft_can_move_to_another_editable_semester(self):
        period = self.period()
        destination = self.destination()
        result = self.client.patch(f'/api/marks/periods/{period.pk}/',
            self.move_payload(destination), format='json')
        self.assertEqual(result.status_code, 200, result.data)
        period.refresh_from_db()
        self.assertEqual(period.academic_semester_id, destination.pk)
        self.assertEqual(period.name, 'Moved draft')
        self.assertEqual(period.semester, destination.label)

    def test_linked_same_semester_date_update_still_projects_authoritative_marks_dates(self):
        period = self.period()
        entry = self.link(period)
        original_snapshot = (entry.deadline_start, entry.deadline_end)
        end = period.closes_at + timedelta(days=2)
        result = self.client.patch(f'/api/marks/periods/{period.pk}/',
            {'semesterId': self.semester.pk, 'closesAt': end.isoformat()}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        active = self.client.get(f'/api/dashboard/timeline/active/?semesterId={self.semester.pk}')
        projected = active.data['levels'][0]['entries'][0]
        self.assertEqual(projected['deadlineEnd'], timezone.localdate(end).isoformat())
        self.assertEqual(projected['marksPeriodId'], period.pk)
        entry.refresh_from_db()
        self.assertEqual((entry.deadline_start, entry.deadline_end), original_snapshot)

    def test_stale_source_semester_snapshot_requires_reload_without_applying_other_edits(self):
        from marks.models import EvaluationPeriod
        from marks.services import MarksStateConflict, update_evaluation_period
        period = self.period()
        destination = self.destination()
        move = self.client.patch(f'/api/marks/periods/{period.pk}/',
            self.move_payload(destination), format='json')
        self.assertEqual(move.status_code, 200, move.data)
        with self.assertRaises(MarksStateConflict):
            update_evaluation_period(period=period, actor=self.office, values={'name': 'Stale rename'})
        current = EvaluationPeriod.objects.get(pk=period.pk)
        self.assertEqual(current.academic_semester_id, destination.pk)
        self.assertEqual(current.name, 'Moved draft')

    def test_destination_lifecycle_is_refreshed_after_parent_lock(self):
        from marks.services import MarksStateConflict, update_evaluation_period
        period = self.period()
        destination = self.destination()
        # Simulate closure after the API resolves its requested semester.
        AcademicSemester.objects.filter(pk=destination.pk).update(lifecycle_status='CLOSED')
        move = self.move_payload(destination)
        from django.utils.dateparse import parse_datetime
        with self.assertRaises(MarksStateConflict):
            update_evaluation_period(period=period, actor=self.office, values={
                'academic_semester': destination, 'opens_at': parse_datetime(move['opensAt']),
                'closes_at': parse_datetime(move['closesAt'])})
        period.refresh_from_db()
        self.assertEqual(period.academic_semester_id, self.semester.pk)

    def test_linked_event_metadata_can_change_without_dates(self):
        period = self.period()
        entry = self.link(period)
        result = self.client.patch(f'/api/dashboard/timeline/entries/{entry.pk}/', {
            'title':'Updated linked event', 'detail':'Updated instructions', 'targetRoles':['STUDENT'], 'level':'P2',
        }, format='json')
        self.assertEqual(result.status_code,200,result.data)
        entry.refresh_from_db()
        self.assertEqual(entry.title,'Updated linked event')
        self.assertEqual(entry.target_roles,['STUDENT'])
        self.assertEqual(entry.level,'P2')
        self.assertEqual(entry.marks_period_id,period.pk)
        result = self.client.patch(f'/api/dashboard/timeline/entries/{entry.pk}/', {
            'deadlineEnd':(timezone.localdate(period.closes_at)+timedelta(days=1)).isoformat(),
            'extensionReason':'Trying to change linked dates',
        }, format='json')
        self.assertEqual(result.status_code,400,result.data)
