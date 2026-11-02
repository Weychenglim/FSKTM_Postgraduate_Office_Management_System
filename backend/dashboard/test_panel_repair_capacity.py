"""Office handoff repair must use the approved request's effective policy."""
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import Coordinator, Lecturer, Panel, Student, User
from academics.capacity_services import (clone_capacity_plan, update_capacity_entry,
    publish_capacity_plan, capacity_plan_content_fingerprint)
from academics.models import AcademicSemester, LecturerAvailabilityWindow, SemesterCapacityPlan
from academics.test_capacity_helpers import publish_test_capacity_plan
from appointments.capacity_reassessment import assert_request_capacity, consume, decide
from appointments.models import (AppointmentWorkflowEvent, PanelAppointment, PanelRecommendation,
    StudentResearchProfile, SupervisorApplication, SupervisorAppointment)
from . import test_reconciliation as fixture
from .models import WorkflowReconciliationAudit


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PanelRepairCapacityTests(TestCase):
    setUp = fixture.WorkflowReconciliationApiTests.setUp
    authenticate = fixture.WorkflowReconciliationApiTests.authenticate
    issue = fixture.WorkflowReconciliationApiTests.issue
    apply_issue = fixture.WorkflowReconciliationApiTests.apply_issue

    def coordinator(self):
        user = User.objects.create_user(email='repair.coordinator@example.test', full_name='Original Coordinator', role=User.Role.COORDINATOR)
        lecturer = Lecturer.objects.create(user=user, staff_no='REPAIR-COORD')
        Coordinator.objects.create(lecturer=lecturer, programme_managed=self.student.programme)
        return user

    def source_limit(self, limit):
        previous = SemesterCapacityPlan.objects.get(academic_semester=self.semester, lifecycle_status='PUBLISHED')
        plan = clone_capacity_plan(previous, actor=self.office)
        update_capacity_entry(plan, lecturer=self.panel_member.lecturer, actor=self.office,
            supervisor_limit=None, panel_limit=limit, expected_fingerprint=capacity_plan_content_fingerprint(plan))
        publish_capacity_plan(plan, actor=self.office, reason='Synthetic source policy',
            expected_fingerprint=capacity_plan_content_fingerprint(plan))

    def new_current_semester(self, limit):
        AcademicSemester.objects.filter(lifecycle_status='ACTIVE').update(lifecycle_status='CLOSED')
        self.semester.refresh_from_db()
        number = AcademicSemester.objects.count() + 1
        today = timezone.localdate()
        semester = AcademicSemester.objects.create(code=f'REPAIR-{number}', academic_session=f'{2099+number}/{2100+number}',
            term='SEMESTER_I', starts_on=today-timedelta(days=1), ends_on=today+timedelta(days=90),
            lifecycle_status='ACTIVE', created_by=self.office)
        Panel.objects.filter(pk=self.panel_member.pk).update(max_appointments=limit)
        publish_test_capacity_plan(semester, self.office)
        return semester

    def request(self, *, active=False):
        coordinator = User.objects.filter(email='repair.coordinator@example.test').first() or self.coordinator()
        number = Student.objects.count() + 1
        user = User.objects.create_user(email=f'repair.student.{number}@example.test',full_name=f'Student {number}',role=User.Role.STUDENT)
        student = Student.objects.create(user=user,matric_no=f'REPAIR-{number}',programme=self.student.programme)
        application = SupervisorApplication.objects.create(student=student,proposed_supervisor=self.lecturer,
            academic_semester=self.semester,status='APPROVED',research_title='Synthetic research')
        SupervisorAppointment.objects.create(application=application,student=student,supervisor=self.lecturer,approved_by=coordinator)
        profile = StudentResearchProfile.objects.create(student=user,matric_no=student.matric_no,student_name=user.full_name,
            programme=student.programme,semester=self.semester.label,supervisor=self.lecturer,proposed_topic='Synthetic research')
        row = PanelRecommendation.objects.create(profile=profile,supervisor=self.lecturer,recommended_member=self.panel_member,
            academic_semester=self.semester,status='APPROVED',coordinator_decided_at=timezone.now())
        AppointmentWorkflowEvent.objects.create(panel_recommendation=row,actor=coordinator,actor_role=User.Role.COORDINATOR,
            action='COORDINATOR_APPROVE',previous_status='PENDING_COORDINATOR',new_status='APPROVED')
        if active:
            PanelAppointment.objects.create(recommendation=row,profile=profile,supervisor=self.lecturer,
                panel_member=self.panel_member,approved_by=coordinator)
        return row

    def repair_issue(self, row):
        self.authenticate(self.office)
        return self.issue('PANEL_HANDOFF_INCOMPLETE', record_id=row.pk)

    def test_old_policy_allows_repair_despite_full_current_semester(self):
        self.new_current_semester(1)
        self.request(active=True)
        row = self.request()
        issue = self.repair_issue(row)
        self.assertEqual(issue['repairability'], 'REPAIRABLE')
        response = self.apply_issue(issue, {'action':'COMPLETE_PANEL_HANDOFF'})
        self.assertEqual(response.status_code, 200, response.data)
        appointment = PanelAppointment.objects.get(recommendation=row)
        self.assertEqual(appointment.approved_by_id, row.workflow_events.get().actor_id)
        self.assertEqual(appointment.appointment_date, timezone.localdate(row.coordinator_decided_at))
        self.assertTrue(WorkflowReconciliationAudit.objects.filter(affected_records__panelAppointmentId=appointment.pk).exists())
        self.assertEqual(self.apply_issue(issue, {'action':'COMPLETE_PANEL_HANDOFF'}).status_code, 409)

    def test_full_source_policy_is_review_required_even_when_today_has_space(self):
        self.source_limit(1)
        self.new_current_semester(5)
        self.request(active=True)
        row = self.request()
        self.assertEqual(self.repair_issue(row)['repairability'], 'REVIEW_REQUIRED')
        self.assertFalse(PanelAppointment.objects.filter(recommendation=row).exists())

    def test_archived_source_cannot_be_repaired(self):
        row = self.request()
        self.new_current_semester(5)
        AcademicSemester.objects.filter(pk=self.semester.pk).update(lifecycle_status='ARCHIVED')
        self.assertEqual(self.repair_issue(row)['repairability'], 'REVIEW_REQUIRED')

    def test_source_restriction_is_used_instead_of_current_semester_availability(self):
        row = self.request()
        self.new_current_semester(5)
        today = timezone.localdate()
        LecturerAvailabilityWindow.objects.create(academic_semester=self.semester,lecturer=self.panel_member.lecturer,
            role='PANEL',starts_on=today,ends_on=today,reason='Synthetic restriction',created_by=self.office)
        self.assertEqual(self.repair_issue(row)['repairability'], 'REVIEW_REQUIRED')

    def authorize_approved_request(self, row, target):
        row.status = 'PENDING_COORDINATOR'
        row.save(update_fields=['status'])
        decide(actor=self.office,kind='PANEL',pk=row.pk,action='authorize',data={
            'reason':'Synthetic carryover','expectedStatus':row.status,'expectedActiveSemesterId':target.pk,
            'expectedAuthorizationId':None,'expectedEventId':None})
        result = assert_request_capacity(row)
        row.status = 'APPROVED'
        row.save(update_fields=['status'])
        consume(row, row.workflow_events.get().actor, result)

    def test_consumed_office_reassessment_remains_the_policy_for_approved_repair(self):
        self.source_limit(0)
        target = self.new_current_semester(5)
        row = self.request()
        self.authorize_approved_request(row, target)
        self.new_current_semester(0)
        issue = self.repair_issue(row)
        self.assertEqual(issue['repairability'], 'REPAIRABLE')
        response = self.apply_issue(issue, {'action':'COMPLETE_PANEL_HANDOFF'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(list(row.capacity_reassessments.order_by('pk').values_list('action',flat=True)), ['GRANTED','CONSUMED'])
        row.refresh_from_db()
        self.assertEqual(row.academic_semester_id, self.semester.pk)

    def test_missing_source_policy_cannot_be_repaired_using_today_policy(self):
        row = self.request()
        today = timezone.localdate()
        missing = AcademicSemester.objects.create(code='REPAIR-MISSING', academic_session='2199/2200',
            term='SEMESTER_I',starts_on=today-timedelta(days=400),ends_on=today-timedelta(days=200),
            lifecycle_status='CLOSED',created_by=self.office)
        row.academic_semester = missing
        row.save(update_fields=['academic_semester'])
        self.assertEqual(self.repair_issue(row)['repairability'], 'REVIEW_REQUIRED')

    def test_other_accepted_reservations_still_block_repair_at_source_limit(self):
        self.source_limit(1)
        self.new_current_semester(5)
        other = self.request()
        other.status = 'PENDING_COORDINATOR'
        other.save(update_fields=['status'])
        row = self.request()
        self.assertEqual(self.repair_issue(row)['repairability'], 'REVIEW_REQUIRED')
        self.assertFalse(PanelAppointment.objects.filter(recommendation=row).exists())

    def test_stale_unconsumed_reassessment_cannot_be_used_for_repair(self):
        target = self.new_current_semester(5)
        row = self.request()
        row.status = 'PENDING_COORDINATOR'
        row.save(update_fields=['status'])
        decide(actor=self.office,kind='PANEL',pk=row.pk,action='authorize',data={
            'reason':'Synthetic carryover','expectedStatus':row.status,'expectedActiveSemesterId':target.pk,
            'expectedAuthorizationId':None,'expectedEventId':None})
        row.status = 'APPROVED'
        row.save(update_fields=['status'])
        self.new_current_semester(5)
        self.assertEqual(self.repair_issue(row)['repairability'], 'REVIEW_REQUIRED')

    def test_archived_consumed_target_cannot_be_used_for_repair(self):
        target = self.new_current_semester(5)
        row = self.request()
        self.authorize_approved_request(row, target)
        self.new_current_semester(5)
        AcademicSemester.objects.filter(pk=target.pk).update(lifecycle_status='ARCHIVED')
        self.assertEqual(self.repair_issue(row)['repairability'], 'REVIEW_REQUIRED')

    def test_consumed_policy_is_rechecked_against_workload_added_after_approval(self):
        target = self.new_current_semester(1)
        row = self.request()
        self.authorize_approved_request(row, target)
        self.new_current_semester(5)
        self.request(active=True)
        self.assertEqual(self.repair_issue(row)['repairability'], 'REVIEW_REQUIRED')
        self.assertFalse(PanelAppointment.objects.filter(recommendation=row).exists())

    def test_apply_rechecks_capacity_after_preview_without_partial_writes(self):
        self.source_limit(1)
        self.new_current_semester(5)
        row = self.request()
        issue = self.repair_issue(row)
        self.assertEqual(issue['repairability'], 'REPAIRABLE')
        self.request(active=True)
        response = self.apply_issue(issue, {'action':'COMPLETE_PANEL_HANDOFF'})
        self.assertEqual(response.status_code, 409, response.data)
        self.assertFalse(PanelAppointment.objects.filter(recommendation=row).exists())
        self.assertFalse(WorkflowReconciliationAudit.objects.filter(entity_id=str(row.pk),issue_type='PANEL_HANDOFF_INCOMPLETE').exists())

    def test_locked_handler_rechecks_capacity_even_after_a_successful_detection(self):
        from .reconciliation import get_reconciliation_issue, _apply_panel_handoff, ReconciliationConflict
        from django.db import transaction
        self.source_limit(1)
        row = self.request()
        payload = self.repair_issue(row)
        issue = get_reconciliation_issue(payload['issueId'])
        self.assertEqual(issue.repairability, 'REPAIRABLE')
        self.request(active=True)
        with transaction.atomic():
            with self.assertRaises(ReconciliationConflict):
                _apply_panel_handoff(issue, self.office)
        self.assertFalse(PanelAppointment.objects.filter(recommendation=row).exists())

    def test_shared_consumed_policy_resolution_also_preserves_supervisor_repair(self):
        previous = SemesterCapacityPlan.objects.get(academic_semester=self.semester,lifecycle_status='PUBLISHED')
        plan = clone_capacity_plan(previous,actor=self.office)
        update_capacity_entry(plan,lecturer=self.lecturer.lecturer,actor=self.office,
            supervisor_limit=0,panel_limit=None,expected_fingerprint=capacity_plan_content_fingerprint(plan))
        publish_capacity_plan(plan,actor=self.office,reason='Synthetic source policy',
            expected_fingerprint=capacity_plan_content_fingerprint(plan))
        target = self.new_current_semester(5)
        coordinator = self.coordinator()
        application = SupervisorApplication.objects.create(student=self.student,proposed_supervisor=self.lecturer,
            academic_semester=self.semester,status='PENDING_COORDINATOR',research_title='Synthetic repair',
            research_area='Computing',research_abstract='Synthetic approved research')
        decide(actor=self.office,kind='SUPERVISOR',pk=application.pk,action='authorize',data={
            'reason':'Synthetic carryover','expectedStatus':application.status,'expectedActiveSemesterId':target.pk,
            'expectedAuthorizationId':None,'expectedEventId':None})
        result = assert_request_capacity(application)
        application.status = 'APPROVED'
        application.coordinator_decided_at = timezone.now()
        application.save(update_fields=['status','coordinator_decided_at'])
        AppointmentWorkflowEvent.objects.create(supervisor_application=application,actor=coordinator,
            actor_role=User.Role.COORDINATOR,action='COORDINATOR_APPROVE',
            previous_status='PENDING_COORDINATOR',new_status='APPROVED')
        consume(application,coordinator,result)
        self.new_current_semester(5)
        self.authenticate(self.office)
        issue = self.issue('SUPERVISOR_HANDOFF_INCOMPLETE',record_id=application.pk)
        self.assertEqual(issue['repairability'],'REPAIRABLE')
        response = self.apply_issue(issue,{'action':'COMPLETE_SUPERVISOR_HANDOFF'})
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(SupervisorAppointment.objects.get(application=application).approved_by_id,coordinator.pk)
