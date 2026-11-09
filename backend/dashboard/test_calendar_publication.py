from django.core.files.uploadedfile import SimpleUploadedFile
from appointments import test_dashboard_timeline as fixture
from rest_framework.test import APITestCase
from django.test import override_settings
from .models import SemesterTimeline, SemesterTimelineEntry


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class CalendarPublicationTests(APITestCase):
    setUp = fixture.DashboardTimelineApiTests.setUp
    valid_rows = fixture.DashboardTimelineApiTests.valid_rows

    def import_rows(self, mode='ADD', count=3):
        self.client.force_authenticate(self.admin)
        upload = fixture.workbook_upload(self.valid_rows()[:count])
        content = upload.read()
        response = self.client.post('/api/dashboard/timeline/upload/preview/', {
            'semesterId': self.academic_semester.pk, 'file': SimpleUploadedFile('calendar.xlsx', content),
            'mode': mode}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data, content

    def confirm(self, preview, content, mode='ADD'):
        return self.client.post('/api/dashboard/timeline/upload/', {
            'semesterId': self.academic_semester.pk, 'file': SimpleUploadedFile('calendar.xlsx', content),
            'mode': mode, 'previewToken': preview['previewToken'], 'acknowledgeWarnings': 'true'}, format='multipart')

    def managed(self):
        self.client.force_authenticate(self.admin)
        return self.client.get('/api/dashboard/timeline/active/', {'semesterId': self.academic_semester.pk}).data

    def publish(self, token=None):
        token = token or self.managed()['publication']['reviewToken']
        return self.client.post('/api/dashboard/timeline/publish/', {
            'semesterId': self.academic_semester.pk, 'reviewToken': token}, format='json')

    def public(self):
        self.client.force_authenticate(self.student)
        return self.client.get('/api/dashboard/timeline/active/').data

    def test_add_preserves_existing_and_replace_reports_counts(self):
        preview, content = self.import_rows()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        preview, content = self.import_rows(count=2)
        self.assertEqual((preview['existingCount'], preview['resultingCount']), (3, 5))
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        self.assertEqual(SemesterTimelineEntry.objects.filter(timeline__is_active=True).count(), 5)
        preview, content = self.import_rows('REPLACE', 2)
        self.assertEqual((preview['existingCount'], preview['resultingCount']), (5, 2))
        self.assertEqual(self.confirm(preview, content, 'ADD').status_code, 409)
        self.assertEqual(self.confirm(preview, content, 'REPLACE').status_code, 201)
        self.assertEqual(SemesterTimelineEntry.objects.filter(timeline__is_active=True).count(), 2)

    def test_save_publish_edit_delete_and_republish_are_isolated(self):
        preview, content = self.import_rows()
        self.assertEqual(self.confirm(preview, content).status_code, 201)
        self.assertFalse(self.public()['available'])
        self.assertEqual(self.publish().status_code, 200)
        public = self.public()
        self.assertTrue(public['available'])
        self.assertTrue(all('STUDENT' in e['targetRoles'] for g in public['levels'] for e in g['entries']))
        managed = self.managed()
        self.assertFalse(managed['publication']['hasUnpublishedChanges'])
        entry = SemesterTimelineEntry.objects.filter(timeline__is_active=True).first()
        self.client.patch(f'/api/dashboard/timeline/entries/{entry.pk}/', {'title': 'Draft title'}, format='json')
        self.assertNotIn('Draft title', str(self.public()))
        self.assertTrue(self.managed()['publication']['hasUnpublishedChanges'])
        self.assertEqual(self.publish().status_code, 200)
        self.assertIn('Draft title', str(self.public()))
        self.managed()
        self.client.delete(f'/api/dashboard/timeline/entries/{entry.pk}/')
        self.assertIn('Draft title', str(self.public()))
        self.assertEqual(self.publish().status_code, 200)
        self.assertNotIn('Draft title', str(self.public()))

    def test_stale_publish_and_permissions(self):
        preview, content = self.import_rows()
        self.confirm(preview, content)
        token = self.managed()['publication']['reviewToken']
        entry = SemesterTimelineEntry.objects.first()
        self.client.patch(f'/api/dashboard/timeline/entries/{entry.pk}/', {'title': 'Changed'}, format='json')
        self.assertEqual(self.publish(token).status_code, 409)
        self.assertFalse(self.public()['available'])
        self.assertEqual(self.client.post('/api/dashboard/timeline/publish/', {}, format='json').status_code, 403)
        self.assertFalse(SemesterTimeline.objects.filter(is_published=True).exists())

    def test_publication_rejects_invalid_tokens_without_mutation(self):
        preview, content = self.import_rows()
        self.confirm(preview, content)
        for token in (None, 1, {}, [], '', 'invalid'):
            response = self.client.post('/api/dashboard/timeline/publish/', {
                'semesterId': self.academic_semester.pk, 'reviewToken': token}, format='json')
            self.assertEqual(response.status_code, 409, response.data)
        self.assertFalse(SemesterTimeline.objects.filter(is_published=True).exists())

    def test_draft_semester_publication_is_not_the_current_dashboard(self):
        preview, content = self.import_rows()
        self.confirm(preview, content)
        self.academic_semester.lifecycle_status = 'DRAFT'
        self.academic_semester.save(update_fields=['lifecycle_status'])
        self.assertEqual(self.publish().status_code, 200)
        self.assertFalse(self.public()['available'])

    def test_empty_draft_can_remove_published_events_and_snapshot_is_read_only(self):
        preview, content = self.import_rows()
        self.confirm(preview, content)
        self.assertEqual(self.publish().status_code, 200)
        published_entry = SemesterTimelineEntry.objects.filter(timeline__is_published=True).first()
        for method in ('patch', 'delete'):
            response = getattr(self.client, method)(f'/api/dashboard/timeline/entries/{published_entry.pk}/',
                {'title': 'Tampered'}, format='json')
            self.assertEqual(response.status_code, 409)
        for entry in SemesterTimelineEntry.objects.filter(timeline__is_active=True):
            self.client.delete(f'/api/dashboard/timeline/entries/{entry.pk}/')
        self.assertTrue(self.public()['levels'])
        self.assertEqual(self.publish().status_code, 200)
        self.assertEqual(self.public()['levels'], [])

    def test_retired_publication_releases_period_ownership_after_unlink(self):
        from .test_timeline_preview import TimelinePreviewSafetyTests
        from marks.services import delete_draft_evaluation_period
        period = TimelinePreviewSafetyTests.period(self, marks=True)
        period.lifecycle_status = 'DRAFT'
        period.save(update_fields=['lifecycle_status'])
        preview, content = self.import_rows()
        self.confirm(preview, content)
        entry = SemesterTimelineEntry.objects.filter(timeline__is_active=True).first()
        response = self.client.patch(f'/api/dashboard/timeline/entries/{entry.pk}/', {'marksPeriodId': period.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.publish().status_code, 200)
        period.refresh_from_db()
        self.assertEqual(period.lifecycle_status, 'DRAFT', 'Publishing a calendar must not publish a period')
        self.assertFalse(any(e.get('marksPeriodId') for g in self.public()['levels'] for e in g['entries']))
        self.managed()
        self.assertEqual(self.client.patch(f'/api/dashboard/timeline/entries/{entry.pk}/', {'marksPeriodId': None}, format='json').status_code, 200)
        self.assertEqual(self.publish().status_code, 200)
        self.assertFalse(period.timeline_entries.exists(), 'Superseded publications must not own draft periods')
        delete_draft_evaluation_period(period=period, actor=self.admin)

    def test_failed_publish_rolls_back_and_repeated_publish_is_idempotent(self):
        from unittest.mock import patch
        from django.db import DatabaseError
        preview, content = self.import_rows()
        self.confirm(preview, content)
        self.assertEqual(self.publish().status_code, 200)
        first = SemesterTimeline.objects.get(is_published=True).pk
        self.assertEqual(self.publish().status_code, 200)
        self.assertEqual(SemesterTimeline.objects.get(is_published=True).pk, first)
        entry = SemesterTimelineEntry.objects.filter(timeline__is_active=True).first()
        self.client.patch(f'/api/dashboard/timeline/entries/{entry.pk}/', {'title': 'New draft'}, format='json')
        with patch('dashboard.calendar_publication.SemesterTimelineEntry.objects.bulk_create', side_effect=DatabaseError('outage')):
            with self.assertRaises(DatabaseError):
                self.publish()
        self.assertEqual(SemesterTimeline.objects.get(is_published=True).pk, first)

    def test_migration_preserves_active_calendar_and_leaves_draft_private(self):
        import importlib
        from types import SimpleNamespace
        from django.apps import apps
        from django.db import connection
        from .calendar_publication import content_digest
        preview, content = self.import_rows()
        self.confirm(preview, content)
        draft = SemesterTimeline.objects.get(is_active=True)
        from academics.models import AcademicSemester
        for year, lifecycle in enumerate(('DRAFT', 'CLOSED', 'ARCHIVED'), start=2100):
            semester = AcademicSemester.objects.create(code=f'calendar-{lifecycle}', academic_session=f'{year}/{year + 1}',
                term='SEMESTER_I', starts_on=self.academic_semester.starts_on, ends_on=self.academic_semester.ends_on,
                lifecycle_status=lifecycle, created_by=self.admin)
            SemesterTimeline.objects.create(academic_semester=semester, semester=lifecycle, session=semester.academic_session,
                uploaded_by=self.admin)
        migration = importlib.import_module('dashboard.migrations.0010_preserve_published_calendars')
        migration.preserve_existing_calendars(apps, SimpleNamespace(connection=connection))
        published = SemesterTimeline.objects.get(academic_semester=self.academic_semester, is_published=True)
        self.assertFalse(SemesterTimeline.objects.filter(academic_semester__lifecycle_status='DRAFT', is_published=True).exists())
        self.assertEqual(SemesterTimeline.objects.filter(academic_semester__lifecycle_status__in=['CLOSED', 'ARCHIVED'], is_published=True).count(), 2)
        self.assertEqual(published.entries.count(), draft.entries.count())
        self.assertEqual(published.content_digest, content_digest(draft))
        self.assertEqual(set(published.entries.values_list('source_entry_id', flat=True)), set(draft.entries.values_list('pk', flat=True)))
        self.assertTrue(self.public()['levels'])

    def test_republication_keeps_reminder_identity(self):
        from announcements.reminders import timeline_notices
        from django.utils import timezone
        preview, content = self.import_rows()
        self.confirm(preview, content)
        entry = SemesterTimelineEntry.objects.filter(timeline__is_active=True, target_roles__contains=['STUDENT']).first()
        entry.deadline_start = entry.deadline_end = timezone.localdate()
        entry.save()
        self.assertEqual(self.publish().status_code, 200)
        before = {n['eventKey'] for n in timeline_notices(timezone.now(), 7)}
        self.assertTrue(before)
        self.client.patch(f'/api/dashboard/timeline/entries/{entry.pk}/', {'title': 'Reviewed title'}, format='json')
        self.assertEqual(self.publish().status_code, 200)
        self.assertEqual({n['eventKey'] for n in timeline_notices(timezone.now(), 7)}, before)
