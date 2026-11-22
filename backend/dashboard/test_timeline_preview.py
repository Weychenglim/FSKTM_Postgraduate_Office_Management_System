import json

from django.utils import timezone
from rest_framework.test import APITestCase
from appointments import test_dashboard_timeline as fixture
workbook_upload = fixture.workbook_upload
from accounts.models import User
from dashboard.models import SemesterTimeline, SemesterTimelineEntry, TimelineAuditLog


class TimelinePreviewSafetyTests(APITestCase):
    setUp = fixture.DashboardTimelineApiTests.setUp
    valid_rows = fixture.DashboardTimelineApiTests.valid_rows

    def preview(self, rows=None, **kwargs):
        self.client.force_authenticate(self.admin)
        upload = workbook_upload(rows or self.valid_rows())
        content = upload.read()
        upload.seek(0)
        response = self.client.post('/api/dashboard/timeline/upload/preview/',
            {'semesterId': self.academic_semester.pk, 'file': upload, 'mode': 'REPLACE', **kwargs}, format='multipart')
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        return response.data, content

    def confirm(self, preview, content, **kwargs):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return self.client.post('/api/dashboard/timeline/upload/', {
            'semesterId': self.academic_semester.pk,
            'file': SimpleUploadedFile('timeline.xlsx', content),
            'previewToken': preview['previewToken'], 'acknowledgeWarnings': 'true', **kwargs,
            'mode': 'REPLACE',
        }, format='multipart')

    def test_preview_is_nonmutating_and_old_rows_require_acknowledgement(self):
        preview, content = self.preview()
        self.assertEqual(preview['importedCount'], 3)
        self.assertTrue(preview['warnings'])
        self.assertTrue(preview['requiresAcknowledgement'])
        self.assertEqual(len(preview['rows']), 3)
        self.assertFalse(SemesterTimeline.objects.exists())
        self.assertFalse(TimelineAuditLog.objects.exists())
        self.assertEqual(self.confirm(preview, content, acknowledgeWarnings='false').status_code, 400)
        self.assertFalse(SemesterTimeline.objects.exists())
        self.assertEqual(self.confirm(preview, content).status_code, 201)

    def test_confirm_requires_preview_and_binds_actor_and_file(self):
        preview, content = self.preview()
        self.assertEqual(self.confirm(preview, content, previewToken='').status_code, 400)
        self.assertEqual(self.confirm(preview, content + b'changed').status_code, 409)
        other = User.objects.create_user(email='other-preview@example.test', role=User.Role.OFFICE_ADMIN)
        self.client.force_authenticate(other)
        self.assertEqual(self.confirm(preview, content).status_code, 409)
        self.assertFalse(SemesterTimeline.objects.exists())

    def test_stale_preview_preserves_current_timeline(self):
        preview, content = self.preview()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        current = SemesterTimeline.objects.get(is_active=True)
        self.assertEqual(self.confirm(preview, content).status_code, 409)
        current.refresh_from_db()
        self.assertTrue(current.is_active)
        self.assertEqual(SemesterTimeline.objects.count(), 1)

    def test_preview_office_permission_and_invalid_range(self):
        self.client.force_authenticate(self.student)
        result = self.client.post('/api/dashboard/timeline/upload/preview/',
            {'file': workbook_upload(self.valid_rows()), 'semesterId': self.academic_semester.pk}, format='multipart')
        self.assertEqual(result.status_code, 403)
        self.client.force_authenticate(self.admin)
        rows = self.valid_rows()
        rows[0][5] = rows[0][4] - timezone.timedelta(days=1)
        result = self.client.post('/api/dashboard/timeline/upload/preview/',
            {'file': workbook_upload(rows), 'semesterId': self.academic_semester.pk}, format='multipart')
        self.assertEqual(result.status_code, 400)
        self.assertFalse(SemesterTimeline.objects.exists())

    def period(self, marks=False, semester=None):
        from academics.models import OperationalPeriod
        from marks.models import EvaluationPeriod, Rubric
        values = dict(academic_semester=semester or self.academic_semester,
            name='Explicit configured operation', opens_at=timezone.now() - timezone.timedelta(hours=1),
            closes_at=timezone.now() + timezone.timedelta(days=2), lifecycle_status='PUBLISHED')
        if marks:
            return EvaluationPeriod.objects.create(**values, semester='test',
                rubric=Rubric.objects.create(name='Preview rubric', code='preview-rubric'))
        return OperationalPeriod.objects.create(**values, activity='SUPERVISOR_APPLICATION', created_by=self.admin)

    def linked_row(self, period, marks=False):
        from dashboard.timeline_import import MALAYSIA
        return ['P1', 'Explicit linked event', 'Existing operation', 'Office',
            period.opens_at.astimezone(MALAYSIA).date(), period.closes_at.astimezone(MALAYSIA).date(),
            'Week 1', 'LECTURER', 'MARKS' if marks else period.activity, period.pk]

    def test_expired_or_calendar_day_stale_preview_is_rejected(self):
        from unittest.mock import patch
        import time
        preview, content = self.preview()
        with patch('django.core.signing.time.time', return_value=time.time() + 901):
            self.assertEqual(self.confirm(preview, content).status_code, 409)
        with patch('dashboard.timeline_import.timezone.localdate', return_value=timezone.localdate() + timezone.timedelta(days=1)):
            self.assertEqual(self.confirm(preview, content).status_code, 409)
        self.assertFalse(SemesterTimeline.objects.exists())

    def test_linked_period_changes_invalidate_preview(self):
        period = self.period()
        preview, content = self.preview()
        period.closes_at += timezone.timedelta(days=1)
        period.save(update_fields=['closes_at'])
        self.assertEqual(self.confirm(preview, content).status_code, 409)
        self.assertFalse(SemesterTimeline.objects.exists())

    def test_import_rejects_link_mapping_without_changing_existing_windows(self):
        period = self.period()
        original_dates = (period.opens_at, period.closes_at)
        upload = workbook_upload([self.linked_row(period)], headers=fixture.REQUIRED_HEADERS + ['Activity Code', 'Period ID'])
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/dashboard/timeline/upload/preview/',
            {'semesterId': self.academic_semester.pk, 'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('Periods & deadlines', str(response.data))
        self.assertFalse(SemesterTimeline.objects.exists())
        period.refresh_from_db()
        self.assertEqual((period.opens_at, period.closes_at), original_dates)

    def existing_link(self, period, marks=False):
        timeline = SemesterTimeline.objects.create(academic_semester=self.academic_semester,
            semester='Semester I', session='2026/2027', uploaded_by=self.admin)
        row = self.linked_row(period, marks=marks)[:8]
        entry = SemesterTimelineEntry.objects.create(timeline=timeline, level='P1', step=1,
            title=row[1], detail=row[2], action_owner=row[3], deadline_start=row[4], deadline_end=row[5],
            week_label=row[6], target_roles=['LECTURER'], **{'marks_period' if marks else 'operational_period': period})
        return entry, row

    def resolve(self, preview, content, choices):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return self.client.post('/api/dashboard/timeline/upload/preview/', {
            'semesterId': self.academic_semester.pk,
            'file': SimpleUploadedFile('timeline.xlsx', content), 'mode': 'REPLACE',
            'linkReviewToken': preview['linkReviewToken'], 'linkChoices': json.dumps(choices),
        }, format='multipart')

    def test_equivalent_legacy_row_preserves_link(self):
        period = self.period()
        entry, row = self.existing_link(period)
        preview, content = self.preview([row])
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        self.assertEqual(SemesterTimelineEntry.objects.get(timeline__is_active=True).operational_period_id, period.pk)

    def test_replacement_can_keep_missing_ended_event_after_explicit_review(self):
        period = self.period()
        period.closes_at -= timezone.timedelta(days=4)
        period.opens_at = period.closes_at - timezone.timedelta(days=1)
        period.save(update_fields=['opens_at', 'closes_at'])
        entry, _ = self.existing_link(period)
        preview, content = self.preview()
        self.assertIsNone(preview['previewToken'])
        self.assertEqual(preview['linkConflicts'][0]['title'], entry.title)
        self.assertEqual(self.confirm(preview, content, previewToken=preview['linkReviewToken']).status_code, 400)
        reviewed = self.resolve(preview, content, {str(entry.pk): 'keep'})
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.assertEqual(reviewed.data['resultingCount'], 4)
        self.assertEqual(reviewed.data['carriedCount'], 1)
        self.assertTrue(SemesterTimeline.objects.get(pk=entry.timeline_id).is_active)
        response = self.confirm(reviewed.data, content, linkChoices=json.dumps({str(entry.pk): 'match:1'}))
        self.assertEqual(response.status_code, 201, response.data)
        saved = SemesterTimelineEntry.objects.get(timeline__is_active=True, operational_period=period)
        self.assertEqual(saved.title, entry.title)
        self.assertEqual(saved.projected_dates, entry.projected_dates)

    def test_replacement_can_confirm_renamed_row_with_same_dates(self):
        period = self.period()
        entry, row = self.existing_link(period)
        row[1] = 'Renamed event'
        preview, content = self.preview([row])
        reviewed = self.resolve(preview, content, {str(entry.pk): 'match:1'})
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.assertEqual(self.confirm(reviewed.data, content).status_code, 201)
        saved = SemesterTimelineEntry.objects.get(timeline__is_active=True)
        self.assertEqual((saved.title, saved.operational_period_id), (row[1], period.pk))

    def test_replacement_uses_window_dates_after_explicit_confirmation(self):
        period = self.period(marks=True)
        entry, row = self.existing_link(period, marks=True)
        original_close = period.closes_at
        row[5] += timezone.timedelta(days=3)
        preview, content = self.preview([row])
        self.assertEqual(preview['linkConflicts'][0]['marksPeriodId'], period.pk)
        self.assertEqual(self.resolve(preview, content, {str(entry.pk): 'match:1'}).status_code, 400)
        reviewed = self.resolve(preview, content, {str(entry.pk): 'keep-dates:1'})
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.assertEqual(reviewed.data['rows'][0]['deadlineEnd'], entry.deadline_end.isoformat())
        self.assertEqual(self.confirm(reviewed.data, content).status_code, 201)
        saved = SemesterTimelineEntry.objects.get(timeline__is_active=True, marks_period=period)
        period.refresh_from_db()
        self.assertEqual(saved.deadline_end, entry.deadline_end)
        self.assertEqual(period.closes_at, original_close)

    def test_link_decisions_reject_duplicate_rows_and_stale_window_dates(self):
        period = self.period()
        entry, row = self.existing_link(period)
        second = SemesterTimelineEntry.objects.create(timeline=entry.timeline, level='P1', step=2,
            title='Another linked event', deadline_start=row[4], deadline_end=row[5], operational_period=period)
        row[1] = 'Renamed'
        preview, content = self.preview([row])
        choices = {str(entry.pk): 'match:1', str(second.pk): 'match:1'}
        self.assertEqual(self.resolve(preview, content, choices).status_code, 400)
        period.closes_at += timezone.timedelta(days=1)
        period.save(update_fields=['closes_at'])
        self.assertEqual(self.resolve(preview, content, choices).status_code, 409)

    def test_link_edit_makes_preview_stale(self):
        preview, content = self.preview()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        next_preview, next_content = self.preview()
        entry = SemesterTimelineEntry.objects.first()
        entry.operational_period = self.period()
        entry.save(update_fields=['operational_period'])
        self.assertEqual(self.confirm(next_preview, next_content).status_code, 409)
        self.assertEqual(SemesterTimeline.objects.filter(is_active=True).count(), 1)

    def test_add_link_validation_and_student_marks_privacy(self):
        from academics.models import AcademicSemester
        from dashboard.serializers import TimelineEntryCreateSerializer
        from . import test_timeline_creation as creation
        preview, content = self.preview()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        timeline = SemesterTimeline.objects.get(is_active=True)
        period = self.period(marks=True)
        payload = creation.TimelineCreationContractTests.payload(self, self.academic_semester.pk)
        payload['deadlineStart'], payload['deadlineEnd'] = [timezone.localdate(value).isoformat() for value in (period.opens_at, period.closes_at)]
        payload['marksPeriodId'] = period.pk
        response = self.client.post('/api/dashboard/timeline/entries/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.client.force_authenticate(self.student)
        active = self.client.get('/api/dashboard/timeline/active/').data
        self.assertFalse(any(entry.get('marksPeriodId') for group in active['levels'] for entry in group['entries']))
        self.client.force_authenticate(self.admin)
        operation = self.period()
        payload['operationalPeriodId'] = operation.pk
        self.assertEqual(self.client.post('/api/dashboard/timeline/entries/', payload, format='json').status_code, 400)
        payload.pop('operationalPeriodId')
        foreign = AcademicSemester.objects.create(code='2200-2201-S1', academic_session='2200/2201',
            term='SEMESTER_I', starts_on='2200-01-01', ends_on='2200-06-01', created_by=self.admin)
        period.academic_semester = foreign
        period.save(update_fields=['academic_semester'])
        self.assertEqual(self.client.post('/api/dashboard/timeline/entries/', payload, format='json').status_code, 400)

    def test_failed_replacement_rolls_back_old_timeline_and_audit(self):
        from unittest.mock import patch
        preview, content = self.preview()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        preview, content = self.preview()
        current = SemesterTimeline.objects.get(is_active=True)
        with patch('dashboard.views.SemesterTimelineEntry.objects.bulk_create', side_effect=RuntimeError('write failure')):
            with self.assertRaises(RuntimeError):
                self.confirm(preview, content)
        current.refresh_from_db()
        self.assertTrue(current.is_active)
        self.assertEqual(SemesterTimeline.objects.count(), 1)
        self.assertEqual(TimelineAuditLog.objects.count(), 1)

    def test_semester_binding_and_semester_edits_invalidate_preview(self):
        from academics.models import AcademicSemester
        preview, content = self.preview()
        other = AcademicSemester.objects.create(code='2201-2202-S1', academic_session='2201/2202', term='SEMESTER_I',
            starts_on='2201-01-01', ends_on='2201-06-01', created_by=self.admin)
        self.assertEqual(self.confirm(preview, content, semesterId=other.pk).status_code, 409)
        self.academic_semester.ends_on += timezone.timedelta(days=1)
        self.academic_semester.save(update_fields=['ends_on'])
        self.assertEqual(self.confirm(preview, content).status_code, 409)
        self.assertFalse(SemesterTimeline.objects.exists())

    def test_informational_status_uses_complete_malaysia_days_and_ended_label(self):
        from datetime import datetime, date, timezone as dt_timezone
        from unittest.mock import patch
        from dashboard.excel import derive_status
        from dashboard.serializers import derive_entry_status
        # 16:01 UTC is the next day in Malaysia, even under a UTC request override.
        with timezone.override('UTC'), patch('django.utils.timezone.now', return_value=datetime(2026, 10, 16, 16, 1, tzinfo=dt_timezone.utc)):
            self.assertEqual(derive_status(date(2026, 10, 16), date(2026, 10, 16)), 'Ended')
            self.assertEqual(derive_entry_status(date(2026, 10, 17), date(2026, 10, 17)), 'Deadline')

    def test_template_dates_come_from_selected_semester(self):
        from io import BytesIO
        from openpyxl import load_workbook
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/dashboard/timeline/template/?semesterId={self.academic_semester.pk}')
        self.assertEqual(response.status_code, 200)
        workbook = load_workbook(BytesIO(response.content), data_only=True)
        for row in list(workbook.active.values)[1:]:
            self.assertGreaterEqual(row[4].date(), self.academic_semester.starts_on)
            self.assertLessEqual(row[5].date(), self.academic_semester.ends_on)

    def test_mapping_rejects_mismatch_foreign_and_implicit_title_inference(self):
        period = self.period()
        row = self.linked_row(period)
        self.client.force_authenticate(self.admin)
        for bad_row in ([*row[:9], 999999], [*row[:8], 'PANEL_RECOMMENDATION', period.pk],
                        [*row[:4], row[4], row[5] + timezone.timedelta(days=1), *row[6:]]):
            response = self.client.post('/api/dashboard/timeline/upload/preview/',
                {'semesterId': self.academic_semester.pk, 'file': workbook_upload([bad_row],
                    headers=fixture.REQUIRED_HEADERS + ['Activity Code', 'Period ID'])}, format='multipart')
            self.assertEqual(response.status_code, 400, response.data)
        preview, content = self.preview([row[:8]])
        self.assertNotIn('operationalPeriodId', preview['rows'][0])
        self.assertNotIn('marksPeriodId', preview['rows'][0])
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        self.assertIsNone(SemesterTimelineEntry.objects.get().operational_period_id)

    def test_stale_replaced_entry_cannot_be_edited(self):
        preview, content = self.preview()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        old = SemesterTimelineEntry.objects.first()
        preview, content = self.preview()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        result = self.client.patch(f'/api/dashboard/timeline/entries/{old.pk}/', {'title': 'Stale edit'}, format='json')
        self.assertEqual(result.status_code, 409)
        old.refresh_from_db()
        self.assertNotEqual(old.title, 'Stale edit')

    def test_link_foreign_keys_are_protected_and_mutually_exclusive(self):
        from django.core.exceptions import ValidationError
        from django.db import IntegrityError, transaction
        from django.db.models.deletion import ProtectedError
        preview, content = self.preview()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        entry = SemesterTimelineEntry.objects.first()
        entry.operational_period = self.period()
        entry.save(update_fields=['operational_period'])
        with self.assertRaises(ProtectedError):
            entry.operational_period.delete()
        entry.marks_period = self.period(marks=True)
        with self.assertRaises(ValidationError):
            entry.clean()
        with self.assertRaises(IntegrityError), transaction.atomic():
            entry.save(update_fields=['marks_period'])
        entry.refresh_from_db()
        self.assertIsNone(entry.marks_period_id)
