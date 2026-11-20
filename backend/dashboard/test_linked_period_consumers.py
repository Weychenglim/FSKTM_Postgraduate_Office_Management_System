from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ProjectRegistration, Student
from accounts.test_registry_semesters import semesters_for
from dashboard import test_timeline_extensions as fixtures
from dashboard.actions import _timeline_actions
from dashboard.models import SemesterTimelineEntry
from dashboard.reports import _timeline_rows
from marks.models import EvaluationPeriod, Rubric


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class LinkedPeriodConsumerTests(APITestCase):
    setUp = fixtures.TimelineExtensionTests.setUp

    def linked_marks_event(self):
        period = EvaluationPeriod.objects.create(academic_semester=self.academic_semester,
            rubric=Rubric.objects.create(name='Linked calendar rubric',code='linked-calendar'),
            name='Marks period',semester=self.academic_semester.label,lifecycle_status='PUBLISHED',
            opens_at=timezone.now()-timedelta(days=1),closes_at=timezone.now()+timedelta(days=8))
        self.entry.marks_period=period
        self.entry.target_roles=['STUDENT','OFFICE_STAFF']
        self.entry.save()
        self.publish_calendar()
        return period

    def publish_calendar(self):
        from .calendar_publication import publication_state, publish_calendar
        publish_calendar(self.academic_semester, self.admin, publication_state(self.entry.timeline, self.admin)['reviewToken'])

    def test_student_dashboard_never_exposes_marks_linked_timeline_rows(self):
        self.linked_marks_event()
        self.assertEqual(_timeline_actions(self.student,timezone.now()),[])

    def test_student_actions_match_registry_stage_while_calendar_shows_both(self):
        student = Student.objects.get(pk=self.student.pk)
        semesters_for(student, self.academic_semester.label)
        final = SemesterTimelineEntry.objects.create(
            timeline=self.entry.timeline, level="P2", step=2, title="Final presentation",
            deadline_start=self.entry.deadline_start, deadline_end=self.entry.deadline_end,
            target_roles=["STUDENT"],
        )
        self.publish_calendar()
        self.client.force_authenticate(self.student)

        def action_names():
            response = self.client.get("/api/dashboard/tasks/")
            self.assertEqual(response.status_code, 200)
            return [row["name"] for row in response.data["tasks"] if row["recordType"] == "TIMELINE_ENTRY"]

        self.assertEqual(action_names(), [])
        registration = ProjectRegistration.objects.create(
            student=student, academic_semester=self.academic_semester,
            stage="P1", status="CONFIRMED", source=ProjectRegistration.Source.COORDINATOR,
        )
        self.assertEqual(action_names(), [self.entry.title])
        registration.stage = "P2"
        registration.save(update_fields=["stage"])
        self.assertEqual(action_names(), [final.title])
        calendar = self.client.get("/api/dashboard/timeline/active/").data
        self.assertEqual([group["level"] for group in calendar["levels"]], ["P1", "P2"])

    def test_staff_dashboard_and_report_read_owning_period_dates(self):
        period=self.linked_marks_event()
        tasks=_timeline_actions(self.admin,timezone.now())
        self.assertEqual(len(tasks),1)
        self.assertEqual(tasks[0]['dueAt'],timezone.localdate(period.closes_at))
        rows=_timeline_rows(self.admin,None,None,timezone.localdate(),'all',None)
        self.assertEqual(rows[0]['dueAt'],timezone.localdate(period.closes_at).isoformat())

    def test_ended_calendar_report_does_not_claim_actual_completion(self):
        self.entry.deadline_start=timezone.localdate()-timedelta(days=4)
        self.entry.deadline_end=timezone.localdate()-timedelta(days=1)
        self.entry.save()
        self.publish_calendar()
        rows=_timeline_rows(self.admin,None,None,timezone.localdate(),'all',None)
        self.assertEqual(rows[0]['status'],'ENDED')

    def test_linked_status_separates_draft_schedule_and_activity_enforcement(self):
        from academics.models import OperationalPeriod, OperationalEnforcement
        from dashboard.serializers import TimelineEntrySerializer
        period = OperationalPeriod.objects.create(academic_semester=self.academic_semester,
            activity='SUPERVISOR_APPLICATION', name='Draft intake', created_by=self.admin,
            opens_at=timezone.now()-timedelta(days=1), closes_at=timezone.now()+timedelta(days=2))
        self.entry.operational_period=period
        self.entry.save()
        def status():
            return TimelineEntrySerializer(self.entry).data['linkedPeriodStatus']
        self.assertEqual(status(), {'lifecycleStatus':'DRAFT','scheduleStatus':'OPEN','datesEnforced':False})
        OperationalEnforcement.objects.create(academic_semester=self.academic_semester,
            activity=period.activity, enabled=True, updated_by=self.admin)
        self.assertEqual(status()['lifecycleStatus'],'DRAFT')
        self.assertTrue(status()['datesEnforced'])
        period.lifecycle_status='PUBLISHED'
        period.closes_at=timezone.now()-timedelta(hours=1)
        period.save()
        self.assertEqual(status(), {'lifecycleStatus':'PUBLISHED','scheduleStatus':'ENDED','datesEnforced':True})

    def test_marks_and_informational_status_do_not_claim_appointment_enforcement(self):
        from dashboard.serializers import TimelineEntrySerializer
        self.assertIsNone(TimelineEntrySerializer(self.entry).data['linkedPeriodStatus'])
        self.linked_marks_event()
        self.assertIsNone(TimelineEntrySerializer(self.entry).data['linkedPeriodStatus']['datesEnforced'])
