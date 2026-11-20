"""Appointment continuity and Marks handoffs using Registry's effective RP stages."""

from django.db import transaction
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from academics.capacity import CapacityRole, resolve_lecturer_capacity
from academics.capacity_services import (
    capacity_plan_content_fingerprint, clone_capacity_plan, publish_capacity_plan,
    update_capacity_entry, validate_capacity_plan_ready,
)
from academics.models import AcademicSemester
from academics.services import activate_semester
from academics.serializers import capacity_plan_payload
from academics.test_capacity_helpers import publish_test_capacity_plan
from accounts.models import ProjectRegistration, Student, StudentRegistry, StudentSemester, User
from accounts.project_stages import project_stages
from accounts.semesters import from_parts, read
from marks.models import EvaluationPeriod, EvaluationTask, MarkEntry, Rubric
from marks.closure_preview import semester_closure_preview
from marks.services import ensure_period_tasks
from marks.stage_changes import apply_stage_change, preview_stage_change
from . import test_appointment_lifecycle as fixtures
from .models import (CoSupervisorAppointment, CoSupervisorNomination, PanelAppointment,
                     PanelRecommendation, SupervisorApplication, SupervisorAppointment)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class RPStageAppointmentHandoffTests(APITestCase):
    _lecturer = fixtures.AppointmentLifecycleTests._lecturer
    _panel_appointment = fixtures.AppointmentLifecycleTests._panel_appointment

    def setUp(self):
        fixtures.AppointmentLifecycleTests.setUp(self)
        self.panel_appointment = self._panel_appointment()
        self.rubric = Rubric.objects.create(name='RP continuity', code='rp-continuity')
        ProjectRegistration.objects.filter(student=self.student).delete()

    def stage(self, semester):
        return project_stages(semester, [self.student.pk])[self.student.pk]

    def set_initial_term(self, term):
        StudentSemester.objects.filter(student=self.student, term=self.semester.term).update(term=term)
        self.semester.term = term
        self.semester.save(update_fields=['term'])

    def attention(self, module, *, student=None, **filters):
        self.client.force_authenticate(self.office)
        path = 'office-workspace/attention' if module == 'supervisor' else 'panel/attention'
        response = self.client.get(f'/api/appointments/{path}/', {
            'category': 'students', 'q': (student or self.student).matric_no, **filters,
        })
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def period(self, semester, assessment):
        return EvaluationPeriod.objects.create(name=f'{semester.code} {assessment}',
            academic_semester=semester, semester=semester.label, assessment=assessment,
            rubric=self.rubric, lifecycle_status='PUBLISHED',
            opens_at=timezone.now()-timezone.timedelta(days=1),
            closes_at=timezone.now()+timezone.timedelta(days=7))

    def appointment_snapshot(self):
        return (list(SupervisorAppointment.objects.order_by('pk').values()),
            list(PanelAppointment.objects.order_by('pk').values()))

    def advance(self, **options):
        semester = self.prepare_next(**options)
        self.activate_next(semester)
        return semester

    def prepare_next(self, *, term='SEMESTER_II', session='2099/2100', starts_on=None, special_registered=True):
        starts_on = starts_on or timezone.localdate()
        AcademicSemester.objects.filter(pk=self.semester.pk).update(
            ends_on=starts_on-timezone.timedelta(days=1))
        semester = AcademicSemester.objects.create(code=f'NEXT-{term}', academic_session=session,
            term=term, starts_on=starts_on,
            ends_on=timezone.localdate()+timezone.timedelta(days=90),
            lifecycle_status='DRAFT', created_by=self.office)
        if term == 'SPECIAL' and special_registered:
            StudentSemester.objects.create(student=self.student, session=session, term=term, outcome='STUDIED')
        publish_test_capacity_plan(semester, self.office)
        return semester

    def activate_next(self, semester, *, expect_studied=True):
        session, term = semester.academic_session, semester.term
        preview = semester_closure_preview(self.semester, target_semester=semester)
        with self.captureOnCommitCallbacks(execute=True):
            activate_semester(semester, actor=self.office, reason='RP semester handover',
                preview_token=preview['previewToken'], acknowledge_unfinished=True)
        semester.refresh_from_db()
        self.assertEqual(StudentSemester.objects.filter(student=self.student,
            session=session, term=term, outcome='STUDIED').exists(), expect_studied)
        if term != 'SPECIAL':
            registry = StudentRegistry.objects.get(student=self.student)
            self.assertEqual(read(registry.current_semester), from_parts(session, term))
        return semester

    def workload(self, semester):
        return tuple(resolve_lecturer_capacity(user=user, semester=semester, role=role).active_load
            for user, role in ((self.supervisor, CapacityRole.SUPERVISOR), (self.panel, CapacityRole.PANEL)))

    def assert_continues(self, **next_semester):
        initial = self.stage(self.semester)
        self.assertEqual((initial.stage, initial.source), ('P1', 'SUPERVISOR_APPROVAL'))
        before = self.appointment_snapshot()
        self.assertEqual(self.workload(self.semester), (1, 1))
        p1 = self.period(self.semester, 'P1')
        self.assertEqual(ensure_period_tasks(p1)['total'], 2)
        original_tasks = list(EvaluationTask.objects.filter(period=p1).order_by('pk').values())
        semester = self.advance(**next_semester)
        stage = self.stage(semester)
        self.assertEqual((stage.stage, stage.source), ('P2', 'AUTO'))
        self.assertFalse(ProjectRegistration.objects.filter(student=self.student, academic_semester=semester).exists())
        self.assertEqual(self.workload(semester), (1, 1))
        for module in ('supervisor', 'panel'):
            self.assertEqual(self.attention(module, projectStage='P2')['results'], [])
        p2 = self.period(semester, 'P2')
        self.assertEqual(ensure_period_tasks(p2)['total'], 2)
        self.assertEqual(ensure_period_tasks(p2)['total'], 0)
        self.assertEqual(set(EvaluationTask.objects.filter(period=p2).values_list(
            'evaluator_id', 'evaluator_role')), {(self.supervisor.pk, 'SUPERVISOR'), (self.panel.pk, 'PANEL')})
        self.assertEqual(self.appointment_snapshot(), before)
        self.assertEqual(list(EvaluationTask.objects.filter(period=p1).order_by('pk').values()), original_tasks)

    def test_same_appointments_continue_from_semester_one_to_two(self):
        self.assert_continues()

    def test_current_details_show_live_stage_and_past_panel_omits_it(self):
        semester = self.advance()
        base = '/api/appointments/'
        panel_id = self.panel_appointment.pk
        paths = (
            (self.supervisor, f'co-supervisor/students/{self.student.pk}/', None),
            (self.coordinator, f'coordinator-workspace/teams/{self.student.matric_no}/', 'teams'),
            (self.office, f'office-workspace/teams/{self.student.matric_no}/', 'teams'),
            (self.panel, f'panel/appointments/{panel_id}/', None),
            (self.coordinator, f'panel/recommendations/{self.panel_appointment.recommendation_id}/', None),
            (self.office, f'panel/records/appointment-{panel_id}/', None),
            (self.office, f'panel/records/profile-{self.profile.pk}/', None),
            (self.student_user, 'panel/student/', None),
            (self.student_user, 'co-supervisor/', 'teams'),
        )
        for viewer, path, collection in paths:
            with self.subTest(path=path, role=viewer.role):
                self.client.force_authenticate(viewer)
                response = self.client.get(base + path)
                self.assertEqual(response.status_code, 200, response.data)
                record = response.data[collection][0] if collection else response.data
                self.assertEqual(record['projectStage'], 'P2')
                self.assertEqual(record['projectSemester'], semester.label)

        self.client.force_authenticate(self.office)
        PanelAppointment.objects.filter(pk=panel_id).update(status=PanelAppointment.Status.ENDED)
        response = self.client.get(base + f'panel/records/appointment-{panel_id}/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn('projectStage', response.data)
        response = self.client.get(base + f'panel/records/profile-{self.profile.pk}/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['projectStage'], 'P2')

    def test_same_appointments_continue_into_registered_special_semester(self):
        self.set_initial_term('SEMESTER_II')
        self.assert_continues(term='SPECIAL')

    def test_same_appointments_continue_when_special_is_skipped(self):
        self.set_initial_term('SEMESTER_II')
        self.assert_continues(term='SEMESTER_I', session='2100/2101')

    def test_same_appointments_continue_from_special_to_next_session(self):
        self.set_initial_term('SPECIAL')
        self.assert_continues(term='SEMESTER_I', session='2100/2101')

    def test_rp2_release_changes_future_plan_and_closes_appointments_at_rollover(self):
        second = self.advance(starts_on=timezone.localdate()-timezone.timedelta(days=10))
        self.assertEqual(self.stage(second).stage, 'P2')
        p2 = self.period(second, 'P2')
        self.assertEqual(ensure_period_tasks(p2)['total'], 2)
        task = EvaluationTask.objects.get(period=p2, evaluator_role='PANEL')
        submitted = MarkEntry.objects.create(task=task, status='SUBMITTED', comments='Keep RP2')
        nomination = CoSupervisorNomination.objects.create(student=self.student,
            primary_appointment=self.supervisor_appointment, nominator=self.supervisor,
            candidate=self.new_supervisor, academic_semester=second, status='APPROVED')
        supporting = CoSupervisorAppointment.objects.create(nomination=nomination,
            student=self.student, supervisor=self.new_supervisor, approved_by=self.coordinator)
        self.semester = second
        self.assertEqual(self.workload(second), (1, 1))
        third = self.prepare_next(term='SEMESTER_I', session='2100/2101')
        current_plan = second.capacity_plans.get(lifecycle_status='PUBLISHED')
        future_plan = third.capacity_plans.get(lifecycle_status='PUBLISHED')
        for plan, expected in ((current_plan, 0), (future_plan, 1)):
            entries = {row['lecturerId']: row for row in capacity_plan_payload(plan)['entries']}
            self.client.force_authenticate(self.office)
            response = self.client.get(f'/api/academics/semesters/{plan.academic_semester_id}/capacity-workspace/')
            self.assertEqual(response.status_code, 200, response.data)
            roster = {row['lecturerId']: row for row in response.data['lecturers']}
            for user, role in ((self.supervisor, 'supervisor'), (self.panel, 'panel'),
                               (self.new_supervisor, 'supervisor')):
                resolution = entries[user.lecturer.pk][role]
                self.assertEqual(resolution['activeLoad'], 1)
                self.assertEqual(resolution.get('expectedRp2Releases', 0), expected)
                self.assertEqual(roster[user.lecturer.pk][role]['expectedRp2Releases'], expected)

        for plan in (current_plan, future_plan):
            draft = clone_capacity_plan(plan, actor=self.office)
            update_capacity_entry(draft, lecturer=self.supervisor.lecturer, actor=self.office,
                supervisor_limit=0, panel_limit=None,
                expected_fingerprint=capacity_plan_content_fingerprint(draft))
            errors = validate_capacity_plan_ready(draft)
            if plan == current_plan:
                self.assertTrue(any('committed workload 1' in error for error in errors))
            else:
                self.assertEqual(errors, [])
                publish_capacity_plan(draft, actor=self.office, reason='Plan after RP2 release',
                    expected_fingerprint=capacity_plan_content_fingerprint(draft))
                self.assertEqual(self.workload(third), (1, 1))

        self.activate_next(third)
        self.assertEqual(self.workload(third), (0, 0))
        for row in (self.supervisor_appointment, self.panel_appointment, supporting):
            row.refresh_from_db()
            self.assertEqual((row.status, row.end_outcome), ('ENDED', 'COMPLETED'))
        submitted.refresh_from_db()
        self.assertEqual((submitted.status, submitted.comments), ('SUBMITTED', 'Keep RP2'))

    def test_explicit_new_rp1_overrides_automatic_release(self):
        self.semester = self.advance(starts_on=timezone.localdate()-timezone.timedelta(days=10))
        third = self.prepare_next(term='SEMESTER_I', session='2100/2101')
        ProjectRegistration.objects.create(student=self.student, academic_semester=third,
            source='COORDINATOR', stage='P1')
        plan = third.capacity_plans.get(lifecycle_status='PUBLISHED')
        entry = next(row for row in capacity_plan_payload(plan)['entries']
                     if row['lecturerId'] == self.supervisor.lecturer.pk)
        self.assertEqual(entry['supervisor']['expectedRp2Releases'], 0)
        self.activate_next(third)
        self.assertEqual(self.stage(third).stage, 'P1')
        self.assertEqual(self.workload(third), (1, 1))

    def test_unregistered_special_keeps_rp2_appointments_until_next_studied_semester(self):
        self.semester = self.advance(starts_on=timezone.localdate()-timezone.timedelta(days=20))
        special = self.prepare_next(term='SPECIAL', starts_on=timezone.localdate()-timezone.timedelta(days=10),
            special_registered=False)
        self.activate_next(special, expect_studied=False)
        self.assertEqual(self.stage(special).state, 'NOT_STUDYING')
        self.assertEqual(self.workload(special), (1, 1))
        self.semester = special
        following = self.advance(term='SEMESTER_I', session='2100/2101')
        self.assertEqual(self.stage(following).state, 'COMPLETED')
        self.assertEqual(self.workload(following), (0, 0))

    def test_non_project_states_create_no_tasks_and_preserve_appointments(self):
        before = self.appointment_snapshot()
        p1, p2 = self.period(self.semester, 'P1'), self.period(self.semester, 'P2')
        studied = StudentSemester.objects.get(student=self.student,
            session=self.semester.academic_session, term=self.semester.term)
        for outcome, state in (('STUDIED', 'NOT_STARTED'), ('NOT_REGISTERED', 'NOT_STUDYING'),
                               (None, 'NOT_CONFIRMED')):
            with self.subTest(state=state):
                if outcome is None:
                    studied.delete()
                else:
                    studied.outcome = outcome
                    studied.save(update_fields=['outcome'])
                ProjectRegistration.objects.update_or_create(
                    student=self.student, academic_semester=self.semester,
                    defaults={'stage': 'NONE', 'source': 'COORDINATOR'})
                self.assertEqual(self.stage(self.semester).state, state)
                self.assertEqual(ensure_period_tasks(p1)['total'], 0)
                self.assertEqual(ensure_period_tasks(p2)['total'], 0)
                self.assertEqual(self.appointment_snapshot(), before)

    def test_completed_project_creates_no_new_tasks(self):
        second = self.advance(starts_on=timezone.localdate()-timezone.timedelta(days=10))
        self.assertEqual(self.stage(second).stage, 'P2')
        self.semester = second
        third = self.advance(term='SEMESTER_I', session='2100/2101')
        self.assertEqual(self.stage(third).state, 'COMPLETED')
        for assessment in ('P1', 'P2'):
            self.assertEqual(ensure_period_tasks(self.period(third, assessment))['total'], 0)

    def test_declaration_and_approval_feed_both_attention_filters(self):
        self.set_initial_term('SEMESTER_II')
        StudentSemester.objects.create(student=self.student, session=self.semester.academic_session,
            term='SEMESTER_I', outcome='STUDIED')
        self.panel_appointment.delete()
        self.supervisor_appointment.delete()
        self.application.status = 'PENDING_COORDINATOR'
        self.application.save(update_fields=['status'])

        self.client.force_authenticate(self.student_user)
        response = self.client.post('/api/registry/project-stages/mine/', {'answer': 'YES'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.stage(self.semester).source, 'STUDENT')
        rows = self.attention('supervisor', projectStage='P1')['results']
        self.assertEqual([(row['id'], row['projectStage'], row['projectSemester']) for row in rows],
            [(self.student.pk, 'P1', self.semester.label)])
        self.assertEqual(self.attention('supervisor', projectStage='P2')['results'], [])

        self.client.force_authenticate(self.coordinator)
        response = self.client.post(f'/api/appointments/supervisor/applications/{self.application.pk}/coordinator-approve/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.stage(self.semester).source, 'SUPERVISOR_APPROVAL')
        self.assertEqual(self.attention('supervisor', projectStage='P1')['results'], [])
        rows = self.attention('panel', projectStage='P1')['results']
        self.assertEqual([(row['id'], row['projectStage'], row['projectSemester']) for row in rows],
            [(self.student.pk, 'P1', self.semester.label)])

        # A second declared student stays without a supervisor into Special Semester.
        user = User.objects.create_user(
            email='no-supervisor@example.test', full_name='No Supervisor', role=User.Role.STUDENT)
        student = Student.objects.create(
            user=user, matric_no='NO-SUPERVISOR', programme=self.student.programme)
        for term in ('SEMESTER_I', 'SEMESTER_II', 'SPECIAL'):
            StudentSemester.objects.create(student=student, session=self.semester.academic_session,
                term=term, outcome='STUDIED')
        self.client.force_authenticate(user)
        response = self.client.post('/api/registry/project-stages/mine/', {'answer': 'YES'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

        semester = self.advance(term='SPECIAL')
        for module, expected in (('supervisor', student), ('panel', self.student)):
            self.assertEqual(self.attention(module, student=expected, projectStage='P1')['results'], [])
            rows = self.attention(module, student=expected, projectStage='P2', size=50)['results']
            self.assertEqual([(row['id'], row['projectStage'], row['projectSemester']) for row in rows],
                [(expected.pk, 'P2', semester.label)])

    def test_stage_correction_preserves_appointments_pending_requests_and_marks(self):
        p1 = self.period(self.semester, 'P1')
        ensure_period_tasks(p1)
        tasks = list(EvaluationTask.objects.filter(period=p1).order_by('evaluator_role'))
        draft = MarkEntry.objects.create(task=tasks[0], status='DRAFT', comments='Keep draft')
        submitted = MarkEntry.objects.create(task=tasks[1], status='SUBMITTED', comments='Keep submission')
        supervisor_request = SupervisorApplication.objects.create(student=self.student,
            academic_semester=self.semester, proposed_supervisor=self.new_supervisor,
            status='PENDING_COORDINATOR', replaces_appointment=self.supervisor_appointment,
            replacement_reason='Pending replacement')
        panel_request = PanelRecommendation.objects.create(profile=self.profile,
            academic_semester=self.semester, supervisor=self.supervisor,
            recommended_member=self.new_panel, status='PENDING_COORDINATOR',
            replaces_appointment=self.panel_appointment, replacement_reason='Pending replacement')
        before = self.appointment_snapshot()
        request_before = (SupervisorApplication.objects.filter(pk=supervisor_request.pk).values().get(),
            PanelRecommendation.objects.filter(pk=panel_request.pk).values().get())
        kwargs = dict(student_id=self.student.pk, academic_semester=self.semester,
            old_stage='P1', new_stage='P2')
        preview = preview_stage_change(**kwargs)
        with transaction.atomic():
            ProjectRegistration.objects.create(student=self.student, academic_semester=self.semester,
                stage='P2', source='COORDINATOR')
            apply_stage_change(**kwargs, token=preview['token'], actor=self.coordinator, reason='Reviewed correction')
        self.assertEqual(self.stage(self.semester).stage, 'P2')
        self.assertEqual(self.appointment_snapshot(), before)
        self.assertEqual((SupervisorApplication.objects.filter(pk=supervisor_request.pk).values().get(),
            PanelRecommendation.objects.filter(pk=panel_request.pk).values().get()), request_before)
        tasks[0].refresh_from_db(); draft.refresh_from_db(); submitted.refresh_from_db()
        self.assertEqual(tasks[0].lifecycle_status, 'PAUSED')
        self.assertEqual((draft.comments, submitted.comments, submitted.status), ('Keep draft', 'Keep submission', 'SUBMITTED'))
        self.assertEqual(ensure_period_tasks(p1)['total'], 0)
        p2 = self.period(self.semester, 'P2')
        self.assertEqual(ensure_period_tasks(p2)['total'], 2)
        self.assertEqual(set(EvaluationTask.objects.filter(period=p2).values_list('evaluator_id', flat=True)),
            {self.supervisor.pk, self.panel.pk})

    def replacement_in_rp2(self, role):
        p1 = self.period(self.semester, 'P1')
        ensure_period_tasks(p1)
        for task in EvaluationTask.objects.filter(period=p1):
            MarkEntry.objects.create(task=task, status='SUBMITTED', comments='RP1 evidence')
        semester = self.advance()
        p2 = self.period(semester, 'P2')
        ensure_period_tasks(p2)
        registration_before = list(ProjectRegistration.objects.order_by('pk').values())
        self.client.force_authenticate(self.coordinator)
        if role == 'SUPERVISOR':
            source = SupervisorApplication.objects.create(student=self.student, academic_semester=semester,
                proposed_supervisor=self.new_supervisor, status='PENDING_COORDINATOR',
                research_title=self.profile.proposed_topic, research_abstract=self.profile.abstract,
                replaces_appointment=self.supervisor_appointment, replacement_reason='RP2 replacement')
            url = f'/api/appointments/supervisor/applications/{source.pk}/coordinator-approve/'
            outgoing, incoming = self.supervisor, self.new_supervisor
            old, model = self.supervisor_appointment, SupervisorAppointment
            untouched, untouched_model = self.panel_appointment, PanelAppointment
        else:
            source = PanelRecommendation.objects.create(profile=self.profile, academic_semester=semester,
                supervisor=self.supervisor, recommended_member=self.new_panel, status='PENDING_COORDINATOR',
                replaces_appointment=self.panel_appointment, replacement_reason='RP2 replacement')
            url = f'/api/appointments/panel/recommendations/{source.pk}/coordinator-approve/'
            outgoing, incoming = self.panel, self.new_panel
            old, model = self.panel_appointment, PanelAppointment
            untouched, untouched_model = self.supervisor_appointment, SupervisorAppointment
        untouched_before = untouched_model.objects.filter(pk=untouched.pk).values().get()
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200, response.data)
        old.refresh_from_db()
        self.assertEqual((old.status, old.end_outcome), ('ENDED', 'REPLACED'))
        self.assertEqual(model.objects.get(supersedes=old).status, 'ACTIVE')
        self.assertEqual(untouched_model.objects.filter(pk=untouched.pk).values().get(), untouched_before)
        self.assertEqual(list(ProjectRegistration.objects.order_by('pk').values()), registration_before)
        self.assertEqual(self.stage(semester).stage, 'P2')
        self.assertFalse(EvaluationTask.objects.filter(period=p1, evaluator=incoming).exists())
        self.assertEqual(MarkEntry.objects.filter(task__period=p1, status='SUBMITTED', comments='RP1 evidence').count(), 2)
        self.assertEqual(EvaluationTask.objects.get(period=p2, evaluator=outgoing, evaluator_role=role).lifecycle_status, 'RETIRED')
        self.assertEqual(EvaluationTask.objects.get(period=p2, evaluator=incoming, evaluator_role=role).lifecycle_status, 'ACTIVE')
        self.assertEqual(ensure_period_tasks(p2)['total'], 0)

    def test_supervisor_replacement_in_rp2_keeps_panel_stage_and_rp1_history(self):
        self.replacement_in_rp2('SUPERVISOR')

    def test_panel_replacement_in_rp2_keeps_supervisor_stage_and_rp1_history(self):
        self.replacement_in_rp2('PANEL')
