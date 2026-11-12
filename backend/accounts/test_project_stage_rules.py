from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import (
    Coordinator,
    Lecturer,
    ProgrammeRule,
    ProjectRegistration,
    ProjectRegistrationChange,
    Student,
    StudentCompletion,
    StudentSemester,
    User,
)
from accounts.project_stages import (
    AUTO,
    BREAK_AFTER_P1,
    COMPLETED,
    COORDINATOR,
    FINISHED,
    NO_SEMESTER_ROW,
    NOT_ANSWERED,
    NOT_CONFIRMED,
    NOT_STARTED,
    NOT_STUDYING,
    ON_LEAVE,
    ON_PROJECT,
    STUDENT,
    SUPERVISOR_APPROVAL,
    UNREGISTERED,
    project_stages,
    research_course,
)
from accounts.project_stage_marks import count_tasks
from accounts.semesters import read
from accounts.test_registry_semesters import DS, make_student, semesters_for
from accounts.test_student_lifecycle import make_semester
from announcements.models import Notification
from appointments.models import StudentResearchProfile, SupervisorApplication, SupervisorAppointment
from marks.models import EvaluationPeriod, EvaluationTask, MarkEntry, Rubric

Outcome = StudentSemester.Outcome
CS = "MASTER OF CYBER SECURITY (COURSEWORK)"
S1_25, S2_25, SP_25 = "Semester I, 2025/2026", "Semester II, 2025/2026", "Special Semester, 2025/2026"
S1_26, S2_26 = "Semester I, 2026/2027", "Semester II, 2026/2027"
S1_27 = "Semester I, 2027/2028"
STAGES = "/api/registry/project-stages/"


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class StageBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN)
        cls.lecturer = User.objects.create_user(email="sv@example.test", password="pw", full_name="Dr Supervisor", role=User.Role.LECTURER)
        cls.s1_25 = make_semester(cls.office, "2025/2026", "SEMESTER_I", active=False, days=-600)
        cls.s2_25 = make_semester(cls.office, "2025/2026", "SEMESTER_II", active=False, days=-450)
        cls.sp_25 = make_semester(cls.office, "2025/2026", "SPECIAL", active=False, days=-330)
        cls.s1_26 = make_semester(cls.office, "2026/2027", "SEMESTER_I", active=False, days=-250)
        cls.portal = make_semester(cls.office, "2026/2027", "SEMESTER_II")
        cls.s1_27 = make_semester(cls.office, "2027/2028", "SEMESTER_I", active=False, days=150)

    def setUp(self):
        self.client.force_authenticate(self.office)

    def student(self, matric, *labels, intake="2025/2026 Semester I", programme=DS):
        student = make_student(matric, intake=intake, programme=programme)
        semesters_for(student, *labels)
        return student

    def answer(self, student, semester=None):
        semester = semester or self.portal
        return project_stages(semester, [student.pk])[student.pk]

    def said(self, student, semester, stage, source=ProjectRegistration.Source.STUDENT, status=ProjectRegistration.Status.CONFIRMED):
        return ProjectRegistration.objects.create(student=student, academic_semester=semester, stage=stage, source=source, status=status, confirmed_by=self.office)

    def approve(self, student, semester, *, replacing=None, day=None):
        application = SupervisorApplication.objects.create(
            student=student, academic_semester=semester, proposed_supervisor=self.lecturer,
            research_title="Title", research_abstract="Abstract", status="APPROVED", replaces_appointment=replacing,
        )
        values = {"application": application, "student": student, "supervisor": self.lecturer, "approved_by": self.office, "supersedes": replacing}
        if day:
            values["appointment_date"] = day
        return SupervisorAppointment.objects.create(**values)

    def outcome(self, student, label, outcome):
        semester = read(label)
        StudentSemester.objects.filter(student=student, session=semester.session, term=semester.term).update(outcome=outcome)


class StartTests(StageBase):
    def test_first_semester_with_nothing_said_is_not_started_and_not_asked(self):
        student = self.student("ST1", S2_26, intake="2026/2027 Semester II")
        answer = self.answer(student)
        self.assertEqual((answer.state, answer.reason, answer.source), (NOT_STARTED, "", AUTO))

    def test_past_the_first_semester_without_an_answer_is_not_answered(self):
        student = self.student("ST2", S1_26, S2_26, intake="2026/2027 Semester I")
        answer = self.answer(student)
        self.assertEqual((answer.state, answer.reason), (NOT_STARTED, NOT_ANSWERED))

    def test_yes_is_rp1_from_the_student(self):
        student = self.student("ST3", S1_26, S2_26)
        self.said(student, self.portal, "P1")
        answer = self.answer(student)
        self.assertEqual((answer.state, answer.stage, answer.source), (ON_PROJECT, "P1", STUDENT))

    def test_not_this_semester_is_not_started_from_the_student(self):
        student = self.student("ST4", S1_26, S2_26)
        self.said(student, self.portal, "NONE")
        answer = self.answer(student)
        self.assertEqual((answer.state, answer.reason, answer.source), (NOT_STARTED, "", STUDENT))

    def test_a_supervisor_approval_is_rp1_without_an_answer(self):
        student = self.student("ST5", S1_26, S2_26)
        self.approve(student, self.portal)
        answer = self.answer(student)
        self.assertEqual((answer.state, answer.stage, answer.source), (ON_PROJECT, "P1", SUPERVISOR_APPROVAL))

    def test_an_approval_wins_over_not_this_semester(self):
        student = self.student("ST6", S1_26, S2_26)
        self.said(student, self.portal, "NONE")
        self.approve(student, self.portal)
        self.assertEqual(self.answer(student).stage, "P1")

    def test_an_approval_with_no_semester_uses_the_appointment_date(self):
        student = self.student("ST7", S1_26, S2_26)
        appointment = self.approve(student, None, day=timezone.localdate())
        self.assertIsNone(appointment.application.academic_semester)
        self.assertEqual(self.answer(student).stage, "P1")

    def test_an_approval_while_on_leave_counts_from_the_next_semester_studied(self):
        student = self.student("ST8", S1_26, S2_26)
        self.outcome(student, S1_26, Outcome.LEAVE)
        self.approve(student, self.s1_26)
        answer = self.answer(student)
        self.assertEqual((answer.stage, answer.source), ("P1", SUPERVISOR_APPROVAL))

    def test_a_replacement_supervisor_does_not_start_it_again(self):
        student = self.student("ST9", S1_26, S2_26)
        first = self.approve(student, self.s1_26)
        SupervisorAppointment.objects.filter(pk=first.pk).update(status="ENDED")
        self.approve(student, self.portal, replacing=first)
        self.assertEqual(self.answer(student).stage, "P2")


class FollowOnTests(StageBase):
    def test_rp1_then_rp2_then_completed(self):
        student = self.student("FO1", S1_26, S2_26, S1_27)
        self.said(student, self.s1_26, "P1")
        self.assertEqual(self.answer(student, self.s1_26).stage, "P1")
        answer = self.answer(student)
        self.assertEqual((answer.state, answer.stage, answer.source), (ON_PROJECT, "P2", AUTO))
        self.assertEqual(self.answer(student, self.s1_27).state, COMPLETED)

    def test_the_special_semester_counts_when_the_student_is_on_it(self):
        student = self.student("FO2", S1_25, S2_25, SP_25, S1_26, S2_26)
        self.said(student, self.s2_25, "P1")
        self.assertEqual(self.answer(student, self.sp_25).stage, "P2")
        self.assertEqual(self.answer(student, self.s1_26).state, COMPLETED)

    def test_a_special_semester_not_taken_is_skipped(self):
        student = self.student("FO3", S1_25, S2_25, S1_26, S2_26)
        self.said(student, self.s2_25, "P1")
        self.assertEqual(self.answer(student, self.s1_26).stage, "P2")
        self.assertEqual(self.answer(student).state, COMPLETED)

    def test_leave_right_after_rp1_needs_a_look(self):
        student = self.student("FO4", S1_25, S2_25, S1_26, S2_26)
        self.said(student, self.s2_25, "P1")
        self.outcome(student, S1_26, Outcome.LEAVE)
        self.assertEqual((self.answer(student, self.s1_26).state, self.answer(student, self.s1_26).reason), (NOT_STUDYING, ON_LEAVE))
        answer = self.answer(student)
        self.assertEqual((answer.state, answer.reason), (NOT_CONFIRMED, BREAK_AFTER_P1))

    def test_not_registered_right_after_rp1_needs_a_look_too(self):
        student = self.student("FO5", S1_26, S2_26, S1_27)
        self.said(student, self.s1_26, "P1")
        self.outcome(student, S2_26, Outcome.NOT_REGISTERED)
        self.assertEqual(self.answer(student, self.s1_27).reason, BREAK_AFTER_P1)

    def test_a_special_semester_marked_not_registered_is_skipped_not_a_break(self):
        student = self.student("FO7", S1_25, S2_25, S1_26, S2_26)
        semesters_for(student, SP_25, outcome=Outcome.NOT_REGISTERED)
        self.said(student, self.s2_25, "P1")
        self.assertEqual(self.answer(student, self.s1_26).stage, "P2")

    def test_leave_after_rp2_still_ends_as_completed(self):
        student = self.student("FO6", S1_25, S2_25, S1_26, S2_26)
        self.said(student, self.s1_25, "P1")
        self.outcome(student, S1_26, Outcome.LEAVE)
        self.assertEqual(self.answer(student).state, COMPLETED)


class CoordinatorRecordTests(StageBase):
    def test_a_coordinator_change_wins_and_the_next_semester_follows(self):
        student = self.student("CR1", S1_25, S2_25, S1_26, S2_26, S1_27)
        self.said(student, self.s2_25, "P1")
        self.outcome(student, S1_26, Outcome.LEAVE)
        self.said(student, self.portal, "P1", source=ProjectRegistration.Source.COORDINATOR)
        answer = self.answer(student)
        self.assertEqual((answer.stage, answer.source), ("P1", COORDINATOR))
        self.assertEqual(self.answer(student, self.s1_27).stage, "P2")

    def test_not_started_after_an_approval_asks_the_student_again(self):
        student = self.student("CR2", S1_25, S1_26, S2_26)
        self.approve(student, self.s1_26)
        self.said(student, self.s1_26, "NONE", source=ProjectRegistration.Source.COORDINATOR)
        earlier = self.answer(student, self.s1_26)
        self.assertEqual((earlier.state, earlier.source), (NOT_STARTED, COORDINATOR))
        self.assertEqual(self.answer(student).reason, NOT_ANSWERED)
        self.said(student, self.portal, "P1")
        self.assertEqual(self.answer(student).stage, "P1")

    def test_a_voided_change_goes_back_to_automatic(self):
        student = self.student("CR3", S1_26, S2_26)
        self.said(student, self.s1_26, "P1")
        self.said(student, self.portal, "P1", source=ProjectRegistration.Source.COORDINATOR, status=ProjectRegistration.Status.VOIDED)
        self.assertEqual((self.answer(student).stage, self.answer(student).source), ("P2", AUTO))

    def test_a_repeat_after_completed(self):
        student = self.student("CR4", S1_25, S2_25, S1_26, S2_26, S1_27)
        self.said(student, self.s2_25, "P1")
        self.assertEqual(self.answer(student).state, COMPLETED)
        self.said(student, self.portal, "P1", source=ProjectRegistration.Source.COORDINATOR)
        self.assertEqual(self.answer(student).stage, "P1")
        self.assertEqual(self.answer(student, self.s1_27).stage, "P2")

    def test_an_old_office_confirmation_counts_as_a_staff_change(self):
        student = self.student("CR5", S1_26, S2_26)
        self.said(student, self.portal, "P2", source=ProjectRegistration.Source.OFFICE)
        self.assertEqual((self.answer(student).stage, self.answer(student).source), ("P2", COORDINATOR))


class NotStudyingTests(StageBase):
    def test_every_id_gets_an_answer_and_no_row_is_not_confirmed(self):
        student = make_student("NS1", intake="2025/2026 Semester I")
        answers = project_stages(self.portal, [student.pk, 999999])
        self.assertEqual({(row.state, row.reason) for row in answers.values()}, {(NOT_CONFIRMED, NO_SEMESTER_ROW)})

    def test_not_on_a_special_semester_is_not_studying_not_missing(self):
        student = self.student("NS6", S1_25, S2_25)
        answer = self.answer(student, self.sp_25)
        self.assertEqual((answer.state, answer.reason), (NOT_STUDYING, UNREGISTERED))

    def test_leave_wins_over_a_stage(self):
        student = self.student("NS2", S1_26, S2_26)
        self.said(student, self.portal, "P1")
        self.outcome(student, S2_26, Outcome.LEAVE)
        self.assertEqual((self.answer(student).state, self.answer(student).reason), (NOT_STUDYING, ON_LEAVE))

    def test_being_on_leave_now_only_counts_for_the_current_semester(self):
        student = self.student("NS3", S1_26, S2_26)
        self.said(student, self.s1_26, "P1")
        Student.objects.filter(pk=student.pk).update(status=Student.Status.DEFERRED)
        self.assertEqual(self.answer(student, self.s1_26).stage, "P1")
        self.assertEqual(self.answer(student).reason, ON_LEAVE)

    def test_not_registered_is_not_studying(self):
        student = self.student("NS4", S1_26, S2_26)
        self.outcome(student, S2_26, Outcome.NOT_REGISTERED)
        self.assertEqual((self.answer(student).state, self.answer(student).reason), (NOT_STUDYING, UNREGISTERED))

    def test_waiting_for_the_senate_is_not_studying_later_but_the_last_semester_still_answers(self):
        student = self.student("NS5", S1_26, S2_26)
        self.said(student, self.s1_26, "P1")
        StudentCompletion.objects.create(student=student, last_session="2026/2027", last_term="SEMESTER_I")
        self.assertEqual(self.answer(student, self.s1_26).stage, "P1")
        self.assertEqual(self.answer(student).reason, FINISHED)


class ResearchCourseTests(StageBase):
    def test_each_programme_has_its_own_code(self):
        self.assertEqual(research_course(self.student("RC1", S2_26)), ("WQD7025", "Data Science Research Project"))
        self.assertEqual(research_course(self.student("RC2", S2_26, programme=CS)), ("WQE7023", "Cyber Security Research Project"))

    def test_an_older_intake_can_have_an_older_code(self):
        ProgrammeRule.objects.create(programme=DS, from_session="2026/2027", from_term="SEMESTER_I", min_semesters=3, max_semesters=8, research_course_code="WQD7099", research_course_name="New Project")
        self.assertEqual(research_course(self.student("RC3", S2_26, intake="2025/2026 Semester I"))[0], "WQD7025")
        self.assertEqual(research_course(self.student("RC4", S2_26, intake="2026/2027 Semester I"))[0], "WQD7099")


class StudentQuestionTests(StageBase):
    MINE = STAGES + "mine/"

    def ask(self, student):
        self.client.force_authenticate(student.user)
        return self.client.get(self.MINE).data["question"]

    def reply(self, student, answer):
        self.client.force_authenticate(student.user)
        return self.client.post(self.MINE, {"answer": answer}, format="json")

    def test_a_first_semester_student_is_not_asked(self):
        self.assertIsNone(self.ask(self.student("SQ1", S2_26, intake="2026/2027 Semester II")))

    def test_the_question_names_the_course_and_the_answer_is_saved_once_with_history(self):
        student = self.student("SQ2", S1_26, S2_26)
        question = self.ask(student)
        self.assertEqual((question["code"], question["name"], question["answer"], question["canChange"]), ("WQD7025", "Data Science Research Project", None, True))
        saved = self.reply(student, "YES").data["question"]
        self.assertEqual((saved["answer"], saved["canChange"]), ("YES", False))
        self.assertEqual(self.answer(student).stage, "P1")
        refused = self.reply(student, "NO")
        self.assertEqual(refused.status_code, 409)
        self.assertIn("contact your programme coordinator", refused.data["error"])
        self.assertEqual(self.answer(student).stage, "P1")
        history = list(ProjectRegistrationChange.objects.order_by("id"))
        self.assertEqual([(row.previous_stage, row.new_stage, row.actor_id, row.reason) for row in history], [("", "P1", student.pk, "Student's answer")])

    def test_not_this_semester_is_locked_too(self):
        student = self.student("SQ11", S1_26, S2_26)
        self.assertEqual(self.reply(student, "NO").data["question"]["answer"], "NO")
        self.assertEqual(self.answer(student).state, NOT_STARTED)
        self.assertFalse(self.ask(student)["canChange"])
        self.assertEqual(self.reply(student, "YES").status_code, 409)
        self.assertEqual(self.answer(student).state, NOT_STARTED)

    def test_the_same_answer_twice_adds_no_history(self):
        student = self.student("SQ3", S1_26, S2_26)
        self.reply(student, "YES")
        self.assertEqual(self.reply(student, "YES").status_code, 200)
        self.assertEqual(ProjectRegistrationChange.objects.count(), 1)

    def test_a_student_with_a_supervisor_also_answers_once(self):
        student = self.student("SQ4", S1_25, S1_26, S2_26)
        self.approve(student, self.s1_26)
        self.said(student, self.s1_26, "NONE", source=ProjectRegistration.Source.COORDINATOR)
        self.assertTrue(self.ask(student)["canChange"])
        self.assertEqual(self.reply(student, "YES").status_code, 200)
        self.assertFalse(self.ask(student)["canChange"])
        refused = self.reply(student, "NO")
        self.assertEqual(refused.status_code, 409)
        self.assertEqual(self.answer(student).stage, "P1")

    def test_nobody_is_asked_once_on_the_project_or_set_by_a_coordinator(self):
        on_rp2 = self.student("SQ5", S1_26, S2_26)
        self.said(on_rp2, self.s1_26, "P1")
        self.assertIsNone(self.ask(on_rp2))
        set_by_staff = self.student("SQ6", S1_26, S2_26)
        self.said(set_by_staff, self.portal, "NONE", source=ProjectRegistration.Source.COORDINATOR)
        self.assertIsNone(self.ask(set_by_staff))
        self.assertEqual(self.reply(set_by_staff, "YES").status_code, 409)

    def test_a_student_waiting_for_the_senate_is_not_asked(self):
        student = self.student("SQ8", S1_26, S2_26)
        StudentCompletion.objects.create(student=student, last_session="2026/2027", last_term="SEMESTER_II")
        self.assertIsNone(self.ask(student))
        self.assertEqual(self.answer(student).reason, "")

    def test_a_withdrawn_student_is_not_counted_as_not_answered(self):
        student = self.student("SQ9", S1_26, S2_26)
        Student.objects.filter(pk=student.pk).update(status=Student.Status.WITHDRAWN)
        self.assertEqual(self.answer(student).reason, "")

    def test_a_student_on_leave_is_not_asked(self):
        student = self.student("SQ7", S1_26, S2_26)
        self.outcome(student, S2_26, Outcome.LEAVE)
        self.assertIsNone(self.ask(student))

    def test_only_students_answer(self):
        self.assertEqual(self.client.get(self.MINE).status_code, 403)


class PageAndChangeBase(StageBase):
    def setUp(self):
        super().setUp()
        self.coordinator = User.objects.create_user(email="coord@example.test", password="pw", full_name="Coordinator DS", role=User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=Lecturer.objects.create(user=self.coordinator, staff_no="C1"), programme_managed=DS)

    def page(self, user=None, semester=None):
        self.client.force_authenticate(user or self.coordinator)
        return self.client.get(STAGES + (f"?semester={semester.pk}" if semester else ""))

    def change(self, items, stage, *, reason="STARTED_LATER", semester=None, **extra):
        self.client.force_authenticate(self.coordinator)
        body = {"semesterId": (semester or self.portal).pk, "stage": stage, "reason": reason, "students": [{"matric": m, "shown": s} for m, s in items], **extra}
        return self.client.post(STAGES + "change/", body, format="json")

    def task(self, student, assessment, status=None):
        rubric, _ = Rubric.objects.get_or_create(code="rp", defaults={"name": "RP"})
        period = EvaluationPeriod.objects.create(name=f"{assessment} review", semester="S2", academic_semester=self.portal, rubric=rubric, lifecycle_status="PUBLISHED", assessment=assessment)
        profile, _ = StudentResearchProfile.objects.get_or_create(student=student.user, defaults={"matric_no": student.matric_no, "student_name": "S", "programme": DS, "semester": "S2", "proposed_topic": "T", "supervisor": self.lecturer})
        task = EvaluationTask.objects.create(profile=profile, evaluator=self.lecturer, period=period)
        if status:
            MarkEntry.objects.create(task=task, status=status)
        return task


class PageTests(PageAndChangeBase):
    def test_the_office_sees_everyone_but_cannot_change(self):
        self.student("PG1", S1_26, S2_26)
        self.student("PG2", S1_26, S2_26, programme=CS)
        data = self.page(self.office).data
        self.assertEqual(sorted(row["matric"] for row in data["rows"]), ["PG1", "PG2"])
        self.assertFalse(data["canChange"])

    def test_a_coordinator_sees_only_their_programmes_and_can_change_the_current_semester(self):
        self.student("PG3", S1_26, S2_26)
        self.student("PG4", S1_26, S2_26, programme=CS)
        data = self.page().data
        self.assertEqual([row["matric"] for row in data["rows"]], ["PG3"])
        self.assertTrue(data["canChange"])
        self.assertTrue(data["semester"]["current"])
        self.assertFalse(self.page(semester=self.s1_26).data["canChange"])

    def test_lecturers_and_students_cannot_open_it(self):
        student = self.student("PG5", S2_26)
        self.assertEqual(self.page(self.lecturer).status_code, 403)
        self.assertEqual(self.page(student.user).status_code, 403)

    def test_the_rows_show_who_to_chase(self):
        no_request = self.student("PG6", S1_26, S2_26)
        self.said(no_request, self.portal, "P1")
        waiting = self.student("PG7", S1_26, S2_26)
        self.said(waiting, self.portal, "P1")
        SupervisorApplication.objects.create(student=waiting, academic_semester=self.portal, proposed_supervisor=self.lecturer, research_title="T", research_abstract="A", status="PENDING_COORDINATOR")
        supervised = self.student("PG8", S1_26, S2_26)
        self.approve(supervised, self.portal)
        self.student("PG9", S1_26, S2_26)
        on_leave = self.student("PG10", S1_26, S2_26)
        self.outcome(on_leave, S2_26, Outcome.LEAVE)
        data = self.page().data
        rows = {row["matric"]: row for row in data["rows"]}
        self.assertEqual((rows["PG6"]["noSupervisor"], rows["PG6"]["requestWaiting"]), (True, False))
        self.assertEqual((rows["PG7"]["noSupervisor"], rows["PG7"]["requestWaiting"]), (True, True))
        self.assertFalse(rows["PG8"]["noSupervisor"])
        self.assertEqual((rows["PG9"]["shown"], rows["PG9"]["notAnswered"]), (NOT_STARTED, True))
        self.assertNotIn("PG10", rows)
        self.assertEqual(data["notStudying"], 1)

    def test_the_current_semester_leaves_out_students_who_have_left(self):
        self.student("PG12", S1_26, S2_26)
        gone = self.student("PG13", S1_26, S2_26)
        Student.objects.filter(pk=gone.pk).update(status=Student.Status.WITHDRAWN)
        rows = [row["matric"] for row in self.page().data["rows"]]
        self.assertEqual(rows, ["PG12"])

    def test_a_past_semester_lists_who_was_on_it(self):
        student = self.student("PG11", S1_26, S2_26)
        self.said(student, self.s1_26, "P1")
        Student.objects.filter(pk=student.pk).update(status=Student.Status.GRADUATED)
        rows = self.page(self.office, self.s1_26).data["rows"]
        self.assertEqual([(row["matric"], row["shown"]) for row in rows], [("PG11", "P1")])


class ChangeTests(PageAndChangeBase):
    def test_one_change_is_saved_with_its_reason(self):
        student = self.student("CH1", S1_26, S2_26)
        response = self.change([("CH1", NOT_STARTED)], "P1", reason="WRONG_ANSWER")
        self.assertEqual(response.data, {"changed": ["CH1"], "leftOut": []})
        self.assertEqual((self.answer(student).stage, self.answer(student).source), ("P1", COORDINATOR))
        change = ProjectRegistrationChange.objects.get()
        self.assertEqual((change.new_stage, change.reason, change.actor_id), ("P1", "Wrong answer", self.coordinator.pk))
        self.assertTrue(self.page().data["rows"][0]["setByCoordinator"])

    def test_back_to_automatic(self):
        student = self.student("CH2", S1_26, S2_26)
        self.said(student, self.s1_26, "P1")
        self.change([("CH2", "P2")], "P1", reason="REPEAT")
        self.assertEqual(self.answer(student).stage, "P1")
        self.assertEqual(self.change([("CH2", "P1")], "AUTO").status_code, 200)
        self.assertEqual((self.answer(student).stage, self.answer(student).source), ("P2", AUTO))
        self.assertEqual(self.change([("CH2", "P2")], "AUTO").status_code, 409)

    def test_only_the_current_semester_can_change(self):
        self.student("CH3", S1_26, S2_26)
        response = self.change([("CH3", NOT_STARTED)], "P1", semester=self.s1_26)
        self.assertEqual(response.status_code, 409)

    def test_a_stale_page_is_refused(self):
        student = self.student("CH4", S1_26, S2_26)
        self.said(student, self.portal, "P1")
        self.assertEqual(self.change([("CH4", NOT_STARTED)], "P2").status_code, 409)
        self.assertEqual(self.answer(student).source, STUDENT)

    def test_the_office_cannot_change_and_other_programmes_are_left_out(self):
        self.student("CH5", S1_26, S2_26)
        self.student("CH6", S1_26, S2_26, programme=CS)
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.post(STAGES + "change/", {}, format="json").status_code, 403)
        response = self.change([("CH5", NOT_STARTED), ("CH6", NOT_STARTED), ("NOBODY", NOT_STARTED)], "P1")
        self.assertEqual(response.data["changed"], ["CH5"])
        self.assertEqual([(row["matric"], row["why"]) for row in response.data["leftOut"]], [("CH6", "Not in a programme you manage."), ("NOBODY", "Not found.")])
        self.assertEqual(self.change([("CH6", NOT_STARTED)], "P1").status_code, 409)

    def test_not_studying_cannot_change(self):
        student = self.student("CH7", S1_26, S2_26)
        self.outcome(student, S2_26, Outcome.LEAVE)
        self.assertEqual(self.change([("CH7", NOT_STUDYING)], "P1").status_code, 409)

    def test_a_change_that_touches_marks_must_be_checked_and_several_at_once_leave_it_out(self):
        touched = self.student("CH8", S1_26, S2_26)
        self.said(touched, self.s1_26, "P1")
        self.task(touched, "P2", MarkEntry.Status.DRAFT)
        self.student("CH9", S1_26, S2_26)
        both = self.change([("CH8", "P2"), ("CH9", NOT_STARTED)], "P1")
        self.assertEqual(both.data["changed"], ["CH9"])
        self.assertEqual(both.data["leftOut"][0]["matric"], "CH8")
        self.assertEqual(self.answer(touched).stage, "P2")
        self.assertEqual(self.change([("CH8", "P2")], "P1", reason="REPEAT").status_code, 409)
        self.client.force_authenticate(self.coordinator)
        impact = self.client.get(STAGES + f"impact/?semester={self.portal.pk}&matric=CH8&stage=P1").data
        self.assertEqual((impact["notStarted"], impact["draft"], impact["submitted"]), (0, 1, 0))
        self.assertEqual(self.answer(touched).stage, "P2")
        self.assertEqual(self.change([("CH8", "P2")], "P1", reason="REPEAT", checked=True, token="old").status_code, 409)
        saved = self.change([("CH8", "P2")], "P1", reason="REPEAT", checked=True, token=impact["token"])
        self.assertEqual(saved.data["changed"], ["CH8"])
        self.assertEqual(ProjectRegistrationChange.objects.filter(registration__student=touched).get().impact, {"notStarted": 0, "draft": 1, "submitted": 0})

    def test_marks_functions_are_called_inside_the_change_and_a_stale_answer_rolls_it_back(self):
        student = self.student("CH10", S1_26, S2_26)
        calls = []

        class StageChangeStale(Exception):
            pass

        fake = SimpleNamespace(
            preview_stage_change=lambda **kw: {"notStarted": 0, "draft": 0, "submitted": 0, "token": "t"},
            apply_stage_change=lambda **kw: calls.append(kw),
        )
        with mock.patch("accounts.project_stage_marks._marks", return_value=fake):
            self.assertEqual(self.change([("CH10", NOT_STARTED)], "P1").status_code, 200)
        self.assertEqual((calls[0]["old_stage"], calls[0]["new_stage"], calls[0]["reason"]), (None, "P1", "Started later"))

        def stale(**kw):
            raise StageChangeStale("changed")

        fake.apply_stage_change = stale
        with mock.patch("accounts.project_stage_marks._marks", return_value=fake):
            self.assertEqual(self.change([("CH10", "P1")], "P2").status_code, 409)
        self.assertEqual(self.answer(student).stage, "P1")
        self.assertEqual(ProjectRegistrationChange.objects.count(), 1)


class MarksCountTests(PageAndChangeBase):
    def test_counts_tasks_left_on_the_wrong_stage_and_skips_retired(self):
        student = self.student("MC1", S1_26, S2_26)
        self.task(student, "P1")
        self.task(student, "P1", MarkEntry.Status.SUBMITTED)
        retired = self.task(student, "P1", MarkEntry.Status.DRAFT)
        retired.lifecycle_status = "RETIRED"
        retired.save()
        self.task(student, "P2", MarkEntry.Status.DRAFT)
        found = count_tasks(student, self.portal, "P1", "P2")
        self.assertEqual((found["notStarted"], found["draft"], found["submitted"]), (1, 0, 1))
        self.assertTrue(found["token"])
        self.assertEqual(count_tasks(student, self.portal, "P1", "P1")["token"], "")


class ProgrammeRuleCodeTests(StageBase):
    RULES = "/api/registry/programme-rules/"

    def rule(self, programme=DS):
        return next(row for row in self.client.get(self.RULES).data["rules"] if row["programme"] == programme)

    def save(self, **body):
        return self.client.put(self.RULES, {"programme": DS, "minSemesters": 3, "maxSemesters": 8, "specialCounts": True, **body}, format="json")

    def test_the_codes_are_seeded_and_kept_when_not_sent(self):
        self.assertEqual((self.rule()["researchCourseCode"], self.rule()["researchCourseName"]), ("WQD7025", "Data Science Research Project"))
        self.assertEqual(self.save().status_code, 200)
        self.assertEqual(self.rule()["researchCourseCode"], "WQD7025")

    def test_the_office_can_change_the_code_and_a_bad_code_is_refused(self):
        self.assertEqual(self.save(researchCourseCode=" wqd7023 ", researchCourseName="Data Science Research Project").status_code, 200)
        self.assertEqual(self.rule()["researchCourseCode"], "WQD7023")
        self.assertEqual(self.save(researchCourseCode="7023").status_code, 400)

    def test_a_new_intake_rule_starts_with_the_programme_code(self):
        self.save(fromSession="2027/2028", fromTerm="SEMESTER_I")
        self.assertEqual(self.rule()["laterRules"][0]["researchCourseCode"], "WQD7025")


class GraduationOnP2Tests(StageBase):
    def test_the_graduation_list_marks_students_on_rp2(self):
        student = self.student("GP1", S1_25, S2_25, S1_26, S2_26)
        self.said(student, self.s1_26, "P1")
        data = self.client.get("/api/registry/graduation/").data
        found = [row for group in ("ready", "check", "stop") for row in data[group] if row["matric"] == "GP1"]
        self.assertTrue(found and found[0]["onP2"])


class CorrectionTests(PageAndChangeBase):
    MINE = STAGES + "mine/"

    def reply(self, student, answer):
        self.client.force_authenticate(student.user)
        return self.client.post(self.MINE, {"answer": answer}, format="json")

    def correct(self, student, note=""):
        self.client.force_authenticate(student.user)
        return self.client.post(self.MINE + "correction/", {"note": note}, format="json")

    def keep(self, matrics):
        self.client.force_authenticate(self.coordinator)
        return self.client.post(STAGES + "keep/", {"semesterId": self.portal.pk, "students": matrics}, format="json")

    def told(self, user):
        return list(Notification.objects.filter(recipient=user).values_list("title", flat=True))

    def test_a_student_requests_a_correction_once_and_the_coordinator_is_told(self):
        student = self.student("CR1", S1_26, S2_26)
        self.reply(student, "YES")
        response = self.correct(student, "  I clicked the wrong   one ")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["question"]["correction"], "REQUESTED")
        self.assertEqual(self.correct(student).status_code, 409)
        self.assertEqual(ProjectRegistration.objects.get(student=student).correction_note, "I clicked the wrong one")
        self.assertEqual(self.told(self.coordinator), ["Research Project registration: correction requested"])
        row = self.page().data["rows"][0]
        self.assertEqual((row["correctionRequested"], row["correctionNote"]), (True, "I clicked the wrong one"))
        reasons = list(ProjectRegistrationChange.objects.order_by("id").values_list("reason", flat=True))
        self.assertEqual(reasons, ["Student's answer", "Student requested a correction: I clicked the wrong one"])

    def waiting(self, user):
        self.client.force_authenticate(user)
        return self.client.get(STAGES + "waiting/").data["corrections"]

    def test_the_sidebar_number_counts_open_requests_in_the_coordinators_programmes(self):
        first = self.student("CR8", S1_26, S2_26)
        second = self.student("CR9", S1_26, S2_26)
        other = self.student("CR10", S1_26, S2_26, programme=CS)
        for student in (first, second, other):
            self.reply(student, "YES")
            self.correct(student)
        self.assertEqual(self.waiting(self.coordinator), 2)
        self.assertEqual(self.waiting(self.office), 0)
        self.assertEqual(self.waiting(first.user), 0)
        self.keep(["CR8"])
        self.assertEqual(self.waiting(self.coordinator), 1)
        self.change([("CR9", "P1")], "NONE", reason="WRONG_ANSWER")
        self.assertEqual(self.waiting(self.coordinator), 0)

    def test_the_page_can_show_one_student_for_their_record(self):
        self.student("CR11", S1_26, S2_26)
        self.student("CR12", S1_26, S2_26)
        self.student("CR13", S1_26, S2_26, programme=CS)
        self.client.force_authenticate(self.coordinator)
        rows = self.client.get(STAGES + "?student=cr12").data["rows"]
        self.assertEqual([row["matric"] for row in rows], ["CR12"])
        self.assertEqual(self.client.get(STAGES + "?student=CR13").data["rows"], [])

    def test_there_is_nothing_to_correct_before_an_answer(self):
        student = self.student("CR2", S1_26, S2_26)
        self.assertEqual(self.correct(student).status_code, 409)
        self.assertFalse(Notification.objects.exists())

    def test_a_coordinator_change_closes_the_request_and_tells_the_student(self):
        student = self.student("CR3", S1_26, S2_26)
        self.reply(student, "YES")
        self.correct(student)
        self.assertEqual(self.change([("CR3", "P1")], "NONE", reason="WRONG_ANSWER").status_code, 200)
        record = ProjectRegistration.objects.get(student=student)
        self.assertEqual((record.correction_open, record.correction_kept), (False, False))
        self.assertEqual(self.answer(student).state, NOT_STARTED)
        self.assertEqual(self.told(student.user), ["Research Project registration updated"])
        self.assertFalse(self.page().data["rows"][0]["correctionRequested"])

    def test_keeping_the_answer_closes_the_request_for_good(self):
        student = self.student("CR4", S1_26, S2_26)
        self.reply(student, "NO")
        self.correct(student)
        self.assertEqual(self.keep(["CR4"]).data, {"changed": ["CR4"], "leftOut": []})
        self.assertEqual(self.answer(student).state, NOT_STARTED)
        self.client.force_authenticate(student.user)
        self.assertEqual(self.client.get(self.MINE).data["question"]["correction"], "KEPT")
        self.assertEqual(self.told(student.user), ["Research Project registration checked"])
        self.assertEqual(self.correct(student).status_code, 409)
        self.assertEqual(self.keep(["CR4"]).data["leftOut"][0]["why"], "No correction request to close.")

    def test_only_the_students_own_coordinator_can_keep_an_answer(self):
        other = self.student("CR5", S1_26, S2_26, programme=CS)
        self.reply(other, "YES")
        self.correct(other)
        self.assertEqual(self.keep(["CR5"]).data["leftOut"][0]["why"], "Not in a programme you manage.")
        self.client.force_authenticate(other.user)
        self.assertEqual(self.client.post(STAGES + "keep/", {"semesterId": self.portal.pk, "students": ["CR5"]}, format="json").status_code, 403)

    def test_the_coordinator_can_switch_a_correction_back(self):
        student = self.student("CR6", S1_26, S2_26)
        self.reply(student, "YES")
        self.correct(student, "Wrong button")
        self.assertEqual(self.change([("CR6", "P1")], "NONE", reason="WRONG_ANSWER").status_code, 200)
        self.assertEqual(self.answer(student).state, NOT_STARTED)
        self.assertEqual(self.change([("CR6", "NOT_STARTED")], "P1", reason="WRONG_ANSWER").status_code, 200)
        self.assertEqual((self.answer(student).stage, self.answer(student).source), ("P1", COORDINATOR))
        self.assertEqual(self.told(student.user), ["Research Project registration updated"])
        self.assertEqual(self.change([("CR6", "P1")], "AUTO").status_code, 200)
        self.client.force_authenticate(student.user)
        question = self.client.get(self.MINE).data["question"]
        self.assertEqual((question["answer"], question["canChange"]), (None, True))

    def test_a_kept_answer_can_still_be_changed_by_the_coordinator(self):
        student = self.student("CR7", S1_26, S2_26)
        self.reply(student, "YES")
        self.correct(student)
        self.keep(["CR7"])
        self.assertEqual(self.change([("CR7", "P1")], "NONE", reason="WRONG_ANSWER").status_code, 200)
        self.assertEqual(self.answer(student).state, NOT_STARTED)
        self.assertEqual(self.change([("CR7", "NOT_STARTED")], "P1", reason="WRONG_ANSWER").status_code, 200)
        self.assertEqual(self.answer(student).stage, "P1")
