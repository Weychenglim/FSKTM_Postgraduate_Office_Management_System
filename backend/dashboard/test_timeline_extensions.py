from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from appointments import test_dashboard_timeline as fixtures
from .models import SemesterTimeline, SemesterTimelineEntry, TimelineAuditLog


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class TimelineExtensionTests(APITestCase):
    def setUp(self):
        fixtures.DashboardTimelineApiTests.setUp(self)
        timeline = SemesterTimeline.objects.create(academic_semester=self.academic_semester,
            semester=self.academic_semester.label, session=self.academic_semester.academic_session,
            uploaded_by=self.admin)
        self.entry = SemesterTimelineEntry.objects.create(timeline=timeline, level='P1',step=1,
            title='Research presentation',detail='Present the proposal',action_owner='Student',
            deadline_start=timezone.localdate(),deadline_end=timezone.localdate()+timedelta(days=3),
            target_roles=['STUDENT'])
        self.client.force_authenticate(self.admin)

    def extend(self, **values):
        return self.client.post(f'/api/dashboard/timeline/entries/{self.entry.pk}/extend/',
            {'deadlineEnd': (timezone.localdate()+timedelta(days=6)).isoformat(),
             'expectedDeadlineEnd': self.entry.deadline_end.isoformat(),
             'reason': 'Additional presentation sessions approved', **values}, format='json')

    def test_extension_updates_the_event_and_preserves_reason_and_original_dates(self):
        before = self.entry.deadline_end
        result = self.extend()
        self.assertEqual(result.status_code,200,getattr(result,'data',None))
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.deadline_end,timezone.localdate()+timedelta(days=6))
        audit=TimelineAuditLog.objects.get(entry=self.entry,action='EXTEND')
        self.assertEqual(audit.reason,'Additional presentation sessions approved')
        self.assertEqual(audit.before_values['deadlineEnd'],before.isoformat())
        self.assertEqual(audit.after_values['deadlineEnd'],self.entry.deadline_end.isoformat())

    def test_invalid_stale_and_outside_semester_requests_preserve_event(self):
        for values in ({'reason':''},{'expectedDeadlineEnd':'2000-01-01'},
                       {'deadlineEnd':self.entry.deadline_end.isoformat()},
                       {'deadlineEnd':(self.academic_semester.ends_on+timedelta(days=1)).isoformat()}):
            with self.subTest(values=values):
                self.assertIn(self.extend(**values).status_code,(400,409))
                self.assertFalse(TimelineAuditLog.objects.filter(entry=self.entry,action='EXTEND').exists())

    def test_student_cannot_extend_and_replaced_timelines_are_locked(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.extend().status_code,403)
        self.client.force_authenticate(self.admin)
        self.entry.timeline.is_active=False
        self.entry.timeline.save()
        self.assertEqual(self.extend().status_code,409)

    def test_informational_extension_is_announced_once_to_target_roles(self):
        from announcements.models import Notification
        from announcements.reminders import send_deadline_reminders
        self.assertEqual(self.extend().status_code,200)
        # Calendar extensions stay private until the updated draft is published.
        send_deadline_reminders(now=timezone.now())
        self.assertFalse(Notification.objects.filter(recipient=self.student,title__startswith='Deadline extended').exists())
        from .calendar_publication import publication_state, publish_calendar
        token = publication_state(self.entry.timeline, self.admin)['reviewToken']
        publish_calendar(self.academic_semester, self.admin, token)
        send_deadline_reminders(now=timezone.now())
        notices=Notification.objects.filter(recipient=self.student,title__startswith='Deadline extended')
        self.assertEqual(notices.count(),1)
        send_deadline_reminders(now=timezone.now())
        self.assertEqual(notices.count(),1)

    def test_edit_extension_is_atomic_and_requires_a_reason(self):
        url = f'/api/dashboard/timeline/entries/{self.entry.pk}/'
        deadline = (timezone.localdate()+timedelta(days=7)).isoformat()
        response = self.client.patch(url, {'title':'Updated presentation','deadlineEnd':deadline}, format='json')
        self.assertEqual(response.status_code,400)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.title,'Research presentation')
        before = self.entry.deadline_end.isoformat()
        response = self.client.patch(url, {'title':'Updated presentation','deadlineEnd':deadline,
            'extensionReason':'Extra presentation sessions','expectedDeadlineEnd':before}, format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.title,'Updated presentation')
        audit = TimelineAuditLog.objects.get(entry=self.entry,action='EXTEND')
        self.assertEqual(audit.reason,'Extra presentation sessions')
        self.assertEqual(audit.before_values['deadlineEnd'],before)
        self.assertEqual(audit.after_values['deadlineEnd'],deadline)

    def test_edit_extension_rejects_stale_and_outside_semester(self):
        url = f'/api/dashboard/timeline/entries/{self.entry.pk}/'
        for values in (
            {'deadlineEnd':(timezone.localdate()+timedelta(days=7)).isoformat(),'expectedDeadlineEnd':'2000-01-01'},
            {'deadlineEnd':(self.academic_semester.ends_on+timedelta(days=1)).isoformat()},
        ):
            result = self.client.patch(url, {'extensionReason':'Extra sessions',**values}, format='json')
            self.assertEqual(result.status_code,400,result.data)
        self.assertFalse(TimelineAuditLog.objects.filter(entry=self.entry,action='EXTEND').exists())
