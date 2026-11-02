"""Shared synthetic A05 fixtures, guarded against development database use."""
from datetime import timedelta

from django.db import connection
from django.utils import timezone

from accounts.models import Student, User
from appointments import co_supervision
from appointments import test_appointment_lifecycle as primary
from appointments.models import StudentResearchProfile, SupervisorApplication
from appointments.test_co_supervision_lifecycle import submitted_marks
from dashboard.models import SemesterTimeline, SemesterTimelineEntry


class ReportingAcceptanceFixture:
    _panel_appointment = primary.AppointmentLifecycleTests._panel_appointment

    def _lecturer(self, email, staff_no, *, supervisor=False, panel=False):
        return primary.AppointmentLifecycleTests._lecturer(
            self, email, staff_no, supervisor=supervisor or panel, panel=panel,
        )

    def setUp(self):
        self.assertTrue(str(connection.settings_dict['NAME']).startswith('test_'))
        primary.AppointmentLifecycleTests.setUp(self)
        self.assertFalse(self.office.is_staff or self.office.is_superuser)
        self.panel_appointment = self._panel_appointment()
        self.nomination = co_supervision.nominate(
            actor=self.supervisor, student_id=self.student.pk,
            candidate_id=self.new_supervisor.pk, justification='PRIVATE supporting nomination',
        )
        co_supervision.decide(nomination_id=self.nomination.pk, actor=self.new_supervisor, action='accept')
        co_supervision.decide(nomination_id=self.nomination.pk, actor=self.coordinator, action='approve')
        self.supporting = self.nomination.appointment
        self.entry, self.period = submitted_marks(self)
        self.foreign_user = User.objects.create_user(
            email='a05-foreign@example.test', full_name='=A05 foreign student', role=User.Role.STUDENT,
        )
        self.foreign_student = Student.objects.create(
            user=self.foreign_user, matric_no='A05-FOREIGN',
            programme=self.other_coordinator.lecturer.coordinator.programme_managed,
        )
        self.foreign_profile = StudentResearchProfile.objects.create(
            student=self.foreign_user, matric_no=self.foreign_student.matric_no,
            student_name=self.foreign_user.full_name, programme=self.foreign_student.programme,
            proposed_topic='Foreign research', abstract='Foreign abstract', supervisor=self.new_supervisor,
        )
        self.legacy = SupervisorApplication.objects.create(
            student=self.foreign_student, proposed_supervisor=self.new_supervisor,
            research_title='A05 legacy request', research_area='Testing',
            research_abstract='Isolated legacy academic-semester repair.',
            academic_semester=None, status='SUBMITTED_TO_SUPERVISOR', submitted_at=timezone.now(),
        )
        self.timeline = SemesterTimeline.objects.create(
            academic_semester=self.semester, semester=self.semester.get_term_display(),
            session=self.semester.academic_session, uploaded_by=self.office, is_active=True,
        )
        today = timezone.localdate()
        self.public_event = SemesterTimelineEntry.objects.create(
            timeline=self.timeline, level='P1', step=1, display_order=1,
            title='A05 public milestone', detail='Public milestone detail', action_owner='Student',
            deadline_start=today, deadline_end=today + timedelta(days=2), target_roles=['STUDENT', 'LECTURER'],
        )
        self.private_event = SemesterTimelineEntry.objects.create(
            timeline=self.timeline, level='P1', step=2, display_order=2,
            title='PRIVATE Office calendar', detail='PRIVATE internal calendar details', action_owner='Office',
            deadline_start=today, deadline_end=today + timedelta(days=3), target_roles=['OFFICE_STAFF'],
        )

    def dossier_url(self, student=None):
        return f'/api/dashboard/progress/{(student or self.student).matric_no}/'
