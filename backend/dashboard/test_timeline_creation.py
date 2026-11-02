from django.utils import timezone
from django.db import DatabaseError
from django.test import override_settings
from unittest.mock import patch
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from appointments import test_dashboard_timeline as fixture
from .models import SemesterTimeline, SemesterTimelineEntry, TimelineAuditLog


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class TimelineCreationContractTests(APITestCase):
    setUp = fixture.DashboardTimelineApiTests.setUp

    def payload(self, semester_id):
        return {
            "semesterId": semester_id,
            "level": "P1",
            "title": "Proposal presentation",
            "detail": "Present the proposal.",
            "action": "Student / Supervisor",
            "deadlineStart": timezone.localdate().isoformat(),
            "deadlineEnd": timezone.localdate().isoformat(),
            "weekLabel": "Week 2",
            "targetRoles": ["STUDENT", "LECTURER"],
        }

    def timeline(self, semester):
        return SemesterTimeline.objects.create(
            academic_semester=semester,
            semester=semester.get_term_display(),
            session=semester.academic_session,
            source_filename="timeline.xlsx",
            uploaded_by=self.admin,
        )

    def test_frontend_add_entry_payload_targets_selected_active_semester(self):
        timeline = self.timeline(self.academic_semester)
        self.client.force_authenticate(self.admin)
        response = self.client.post("/api/dashboard/timeline/entries/",
                                    self.payload(self.academic_semester.pk), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        entry = SemesterTimelineEntry.objects.get(pk=response.data["id"])
        self.assertEqual(entry.timeline, timeline)
        self.assertTrue(TimelineAuditLog.objects.filter(
            entry=entry, timeline=timeline, action="ADD_ENTRY", actor=self.admin
        ).exists())

    def test_first_manual_event_initializes_the_selected_semester_calendar(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/dashboard/timeline/entries/',
            self.payload(self.academic_semester.pk), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        timeline = SemesterTimeline.objects.get(academic_semester=self.academic_semester)
        self.assertEqual(timeline.uploaded_by, self.admin)
        self.assertEqual((timeline.semester, timeline.session),
            (self.academic_semester.get_term_display(), self.academic_semester.academic_session))
        entry = timeline.entries.get()
        self.assertEqual(entry.pk, response.data['id'])
        self.assertEqual(TimelineAuditLog.objects.get(entry=entry).action, 'ADD_ENTRY')
        second = self.client.post('/api/dashboard/timeline/entries/',
            self.payload(self.academic_semester.pk), format='json')
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(SemesterTimeline.objects.count(), 1)
        self.assertEqual(timeline.entries.count(), 2)

    def test_invalid_first_event_creates_no_calendar_or_audit(self):
        self.client.force_authenticate(self.admin)
        values = self.payload(self.academic_semester.pk)
        values['deadlineEnd'] = (timezone.localdate() - timezone.timedelta(days=1)).isoformat()
        response = self.client.post('/api/dashboard/timeline/entries/', values, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(SemesterTimeline.objects.exists())
        self.assertFalse(SemesterTimelineEntry.objects.exists())
        self.assertFalse(TimelineAuditLog.objects.exists())

    def test_first_event_audit_outage_rolls_back_calendar_and_entry(self):
        self.client.force_authenticate(self.admin)
        with patch('dashboard.views.TimelineAuditLog.objects.create', side_effect=DatabaseError('Controlled outage')):
            with self.assertRaises(DatabaseError):
                self.client.post('/api/dashboard/timeline/entries/',
                    self.payload(self.academic_semester.pk), format='json')
        self.assertFalse(SemesterTimeline.objects.exists())
        self.assertFalse(SemesterTimelineEntry.objects.exists())
        self.assertFalse(TimelineAuditLog.objects.exists())

    def test_student_cannot_initialize_a_calendar_by_direct_request(self):
        self.client.force_authenticate(self.student)
        response = self.client.post('/api/dashboard/timeline/entries/',
            self.payload(self.academic_semester.pk), format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(SemesterTimeline.objects.exists())

    def test_semester_closed_since_initial_read_cannot_initialize_a_calendar(self):
        self.client.force_authenticate(self.admin)
        stale = self.academic_semester
        AcademicSemester.objects.filter(pk=stale.pk).update(lifecycle_status='CLOSED')
        with patch('dashboard.views.get_timeline_semester', return_value=stale):
            response = self.client.post('/api/dashboard/timeline/entries/',
                self.payload(stale.pk), format='json')
        self.assertEqual(response.status_code, 409)
        self.assertFalse(SemesterTimeline.objects.exists())

    def test_selected_draft_does_not_write_to_effective_active_semester(self):
        active = self.timeline(self.academic_semester)
        draft = AcademicSemester.objects.create(
            code="2100-2101-S2", academic_session="2100/2101",
            term=AcademicSemester.Term.SEMESTER_II,
            starts_on=timezone.localdate() + timezone.timedelta(days=150),
            ends_on=timezone.localdate() + timezone.timedelta(days=300),
            created_by=self.admin,
        )
        timeline = self.timeline(draft)
        self.client.force_authenticate(self.admin)
        response = self.client.post("/api/dashboard/timeline/entries/",
                                    self.payload(draft.pk), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(SemesterTimelineEntry.objects.get(pk=response.data["id"]).timeline, timeline)
        self.assertFalse(active.entries.exists())

    def test_locked_and_missing_semesters_leave_entries_and_audits_unchanged(self):
        self.timeline(self.academic_semester)
        self.client.force_authenticate(self.admin)
        for lifecycle in ("CLOSED", "ARCHIVED"):
            self.academic_semester.lifecycle_status = lifecycle
            self.academic_semester.save(update_fields=["lifecycle_status"])
            response = self.client.post("/api/dashboard/timeline/entries/",
                                        self.payload(self.academic_semester.pk), format="json")
            self.assertEqual(response.status_code, 409, response.data)
        response = self.client.post("/api/dashboard/timeline/entries/",
                                    self.payload(999999), format="json")
        self.assertEqual(response.status_code, 409)
        self.assertFalse(SemesterTimelineEntry.objects.exists())
        self.assertFalse(TimelineAuditLog.objects.exists())

    def test_selected_semester_does_not_allow_system_derived_fields(self):
        self.timeline(self.academic_semester)
        self.client.force_authenticate(self.admin)
        for field, value in (("status", "Completed"), ("step", 99), ("timelineId", 99)):
            response = self.client.post("/api/dashboard/timeline/entries/",
                {**self.payload(self.academic_semester.pk), field: value}, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(SemesterTimelineEntry.objects.exists())
