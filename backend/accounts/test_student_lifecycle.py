from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from academics.services import activate_semester
from accounts.eligibility import student_is_workflow_eligible
from accounts.models import (
    ParticipantLifecycleAudit,
    ProjectRegistration,
    ProjectRegistrationChange,
    SenateDecision,
    Student,
    StudentCompletion,
    StudentSemester,
    StudentSemesterMove,
    User,
)
from accounts.project_stages import (
    CONFIRMED,
    FINISHED,
    NO_PROJECT,
    NOT_CONFIRMED,
    NOT_STUDYING,
    ON_LEAVE,
    UNREGISTERED,
    confirm_stages,
    correct_stage,
    project_stages,
    suggestions,
)
from accounts.retention import due_for_removal
from accounts.semester_rules import limit_warnings, progress_of, shown_status
from accounts.test_registry_semesters import make_student, semesters_for
from academics.test_capacity_helpers import publish_test_capacity_plan
from appointments.models import SupervisorAppointment, SupervisorApplication

Outcome = StudentSemester.Outcome
THREE = ("Semester I, 2026/2027", "Semester II, 2026/2027", "Special Semester, 2026/2027")
ACTIVE_SESSION, ACTIVE_TERM = "2026/2027", "SPECIAL"


def make_semester(office, session=ACTIVE_SESSION, term=ACTIVE_TERM, *, active=True, days=0):
    today = timezone.localdate()
    return AcademicSemester.objects.create(
        code=f"{session.replace('/', '-')}-{term}",
        academic_session=session,
        term=term,
        created_by=office,
        starts_on=today - timedelta(days=5) + timedelta(days=days),
        ends_on=today + timedelta(days=60) + timedelta(days=days),
        lifecycle_status="ACTIVE" if active else "DRAFT",
    )


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class Base(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN)
        cls.portal = make_semester(cls.office)

    def setUp(self):
        self.client.force_authenticate(self.office)

    def act(self, matric, **body):
        return self.client.post(f"/api/registry/students/{matric}/status-action/", {"reason": "Dean approved", **body}, format="json")

    def finish(self, *matrics, early=()):
        return self.client.post("/api/registry/graduation/finish/", {"matrics": list(matrics), "earlyApproved": list(early), "lastSession": ACTIVE_SESSION, "lastTerm": ACTIVE_TERM}, format="json")

    def senate(self, *matrics, decided=None, reference="Meeting 512"):
        day = decided or timezone.localdate() - timedelta(days=3)
        return self.client.post("/api/registry/graduation/senate/", {"matrics": list(matrics), "decidedOn": day.isoformat(), "reference": reference}, format="json")

    def row(self, student):
        return student.semesters.get(session=ACTIVE_SESSION, term=ACTIVE_TERM)


class StatusActionTests(Base):
    def setUp(self):
        super().setUp()
        self.student = make_student("SA1")
        semesters_for(self.student, *THREE)

    def status(self):
        self.student.refresh_from_db()
        return self.student.status

    def test_leave_needs_a_type_and_records_it_on_the_semester(self):
        self.assertEqual(self.act("SA1", action="LEAVE").status_code, 400)
        response = self.act("SA1", action="LEAVE", outcome="LEAVE_MEDICAL")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["displayStatus"], "On semester leave")
        self.assertEqual(self.status(), Student.Status.DEFERRED)
        self.assertEqual(self.row(self.student).outcome, Outcome.LEAVE_MEDICAL)

    def test_medical_and_mobility_push_the_maximum_and_personal_does_not(self):
        before = progress_of(self.student).maximum_semester
        row = self.student.semesters.get(term="SEMESTER_I")
        row.outcome = Outcome.LEAVE_MOBILITY
        row.save()
        self.assertEqual(progress_of(Student.objects.get(pk=self.student.pk)).maximum_semester.key, (2030, 0))
        self.assertEqual(before.key, (2029, 1))
        row.outcome = Outcome.LEAVE
        row.save()
        self.assertEqual(progress_of(Student.objects.get(pk=self.student.pk)).maximum_semester, before)

    def test_ending_leave_puts_the_semester_back(self):
        self.act("SA1", action="LEAVE", outcome="LEAVE")
        response = self.act("SA1", action="END_LEAVE")
        self.assertEqual(response.data["displayStatus"], "Active")
        self.assertEqual(self.row(self.student).outcome, Outcome.STUDIED)

    def test_changing_the_row_moves_the_status_so_the_two_cannot_disagree(self):
        row = self.row(self.student)
        url = f"/api/registry/students/SA1/semesters/{row.pk}/"
        self.assertEqual(self.client.patch(url, {"outcome": "LEAVE"}, format="json").status_code, 200)
        self.assertEqual(self.status(), Student.Status.DEFERRED)
        self.assertEqual(self.client.patch(url, {"outcome": "STUDIED"}, format="json").status_code, 200)
        self.assertEqual(self.status(), Student.Status.ACTIVE)

    def test_changing_another_semester_leaves_the_status_alone(self):
        student = make_student("SA3", status=Student.Status.DEFERRED)
        semesters_for(student, THREE[0])
        row = student.semesters.get()
        response = self.client.patch(f"/api/registry/students/SA3/semesters/{row.pk}/", {"note": "Typo fixed"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Student.objects.get(pk=student.pk).status, Student.Status.DEFERRED)

    def test_a_student_who_has_not_started_cannot_take_leave(self):
        make_student("SA2", intake="2030/2031 Semester I")
        self.assertEqual(self.act("SA2", action="LEAVE", outcome="LEAVE").status_code, 409)
        self.assertEqual(Student.objects.get(matric_no="SA2").status, Student.Status.ACTIVE)

    def test_termination_needs_a_reason_type_and_can_be_reinstated(self):
        self.assertEqual(self.act("SA1", action="TERMINATE").status_code, 400)
        response = self.act("SA1", action="TERMINATE", exitReason="FAILED_AND_EXIT")
        self.assertEqual((response.data["displayStatus"], response.data["exitReasonLabel"]), ("Terminated", "Failed and Exit"))
        self.assertEqual(self.act("SA1", action="WITHDRAW").status_code, 409)
        back = self.act("SA1", action="REINSTATE")
        self.assertEqual((back.data["displayStatus"], back.data["exitReason"]), ("Active", ""))

    def test_withdrawal_is_final(self):
        self.assertEqual(self.act("SA1", action="WITHDRAW").data["displayStatus"], "Withdrawn")
        self.assertEqual(self.act("SA1", action="REINSTATE").status_code, 409)

    def test_a_student_who_passes_away_loses_sign_in_and_gets_no_notice(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.act("SA1", action="DECEASED")
        self.assertEqual(response.data["displayStatus"], "Passed away")
        self.student.user.refresh_from_db()
        self.assertFalse(self.student.user.is_active)
        self.assertFalse(self.student.user.notifications.exists())

    def test_only_the_office_can_use_it(self):
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.act("SA1", action="WITHDRAW").status_code, 403)

    def test_graduating_from_the_record_is_refused(self):
        response = self.client.patch("/api/registry/students/SA1/", {"academicStatus": "Graduated", "statusReason": "x"}, format="json")
        self.assertEqual(response.status_code, 409)


class TwoStepGraduationTests(Base):
    def setUp(self):
        super().setUp()
        self.student = make_student("TG1")
        semesters_for(self.student, *THREE)

    def test_finished_then_senate_keeps_the_real_date(self):
        finished = self.finish("TG1")
        self.assertEqual([row["matric"] for row in finished.data["finished"]], ["TG1"])
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.ACTIVE)
        self.assertEqual(shown_status(Student.objects.get(pk=self.student.pk)), "Waiting for Senate")
        self.assertEqual([row["matric"] for row in self.client.get("/api/registry/graduation/").data["waiting"]], ["TG1"])
        day = timezone.localdate() - timedelta(days=10)
        result = self.senate("TG1", decided=day)
        self.assertEqual([row["matric"] for row in result.data["graduated"]], ["TG1"])
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, Student.Status.GRADUATED)
        decision = SenateDecision.objects.get()
        self.assertEqual((decision.decided_on, decision.reference), (day, "Meeting 512"))
        self.assertEqual(self.client.get("/api/registry/students/TG1/").data["senateDate"], day.isoformat())

    def test_the_senate_step_only_takes_waiting_students(self):
        result = self.senate("TG1")
        self.assertEqual(result.data["skipped"][0]["why"], "Not waiting for the Senate.")
        self.assertFalse(SenateDecision.objects.exists())

    def test_a_future_senate_date_is_refused(self):
        self.finish("TG1")
        self.assertEqual(self.senate("TG1", decided=timezone.localdate() + timedelta(days=1)).status_code, 400)

    def test_back_to_active_needs_a_reason(self):
        self.finish("TG1")
        url = "/api/registry/graduation/return/"
        self.assertEqual(self.client.post(url, {"matrics": ["TG1"], "reason": " "}, format="json").status_code, 400)
        self.assertEqual(len(self.client.post(url, {"matrics": ["TG1"], "reason": "Failed P2"}, format="json").data["returned"]), 1)
        self.assertFalse(StudentCompletion.objects.exists())
        self.assertTrue(ParticipantLifecycleAudit.objects.filter(previous_status="WAITING_FOR_SENATE", new_status="ACTIVE").exists())

    def test_a_wrong_entry_goes_back_to_waiting(self):
        self.finish("TG1")
        self.senate("TG1")
        response = self.client.post("/api/registry/graduation/correct/", {"matric": "TG1", "reason": "Not on the Senate's list"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data["academicStatus"], response.data["displayStatus"]), ("Active", "Waiting for Senate"))
        self.assertEqual(self.senate("TG1").status_code, 200)

    def test_a_graduation_from_before_this_can_be_corrected(self):
        old = make_student("TG2", status=Student.Status.GRADUATED)
        semesters_for(old, *THREE)
        response = self.client.post("/api/registry/graduation/correct/", {"matric": "TG2", "reason": "Mistake"}, format="json")
        self.assertEqual(response.data["displayStatus"], "Waiting for Senate")

    def test_only_a_graduate_can_be_corrected(self):
        self.assertEqual(self.client.post("/api/registry/graduation/correct/", {"matric": "TG1", "reason": "x"}, format="json").status_code, 409)

    def test_marking_late_removes_the_semester_they_never_took(self):
        self.client.post("/api/registry/graduation/finish/", {"matrics": ["TG1"], "lastSession": ACTIVE_SESSION, "lastTerm": "SEMESTER_II"}, format="json")
        self.assertEqual(self.client.get("/api/registry/graduation/").data["lastSemesters"][0]["term"], ACTIVE_TERM)
        self.assertEqual(self.student.semesters.count(), 3, "semester II is not offered without a calendar row")
        AcademicSemester.objects.create(code="earlier", academic_session=ACTIVE_SESSION, term="SEMESTER_II", created_by=self.office, starts_on=timezone.localdate() - timedelta(days=120), ends_on=timezone.localdate() - timedelta(days=30), lifecycle_status="CLOSED")
        semesters_for(self.student, "Semester I, 2025/2026")
        result = self.client.post("/api/registry/graduation/finish/", {"matrics": ["TG1"], "lastSession": ACTIVE_SESSION, "lastTerm": "SEMESTER_II"}, format="json")
        self.assertEqual(len(result.data["finished"]), 1, result.data)
        self.assertFalse(self.student.semesters.filter(term="SPECIAL").exists())
        self.assertEqual(self.student.completion.last_term, "SEMESTER_II")

    def test_unfinished_work_stops_the_finished_step(self):
        from unittest.mock import patch

        with patch("accounts.graduation.student_blockers", return_value={"unfinishedMarksTasks": 2, "pendingSupervisorApplications": 0, "pendingCoSupervisorNominations": 0, "pendingPanelRecommendations": 0}):
            result = self.finish("TG1")
        self.assertEqual(result.data["skipped"][0]["why"], "2 unfinished marks.")

    def test_the_senate_list_ticks_waiting_students_and_reports_the_rest(self):
        self.finish("TG1")
        other = make_student("TG3")
        file = SimpleUploadedFile("senate.csv", b"No,Matric\n1,TG1\n2,TG3\n3,XX99999\n")
        data = self.client.post("/api/registry/graduation/match-list/", {"file": file}, format="multipart").data
        self.assertEqual(data["matched"], ["TG1"])
        self.assertEqual(data["notWaiting"], [{"matric": other.matric_no, "name": other.user.full_name, "status": "Active"}])
        self.assertEqual(data["notFound"], ["XX99999"])

    def test_a_senate_list_of_the_wrong_type_is_refused(self):
        file = SimpleUploadedFile("senate.txt", b"x")
        self.assertEqual(self.client.post("/api/registry/graduation/match-list/", {"file": file}, format="multipart").status_code, 400)


class SpecialSemesterInBetweenTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN)
        cls.normal = make_semester(cls.office, "2025/2026", "SEMESTER_II", active=False, days=-200)
        cls.special = make_semester(cls.office, "2025/2026", "SPECIAL", active=False, days=-100)
        cls.portal = make_semester(cls.office, "2026/2027", "SEMESTER_I")

    def setUp(self):
        self.client.force_authenticate(self.office)

    def test_a_late_finish_can_pick_the_normal_semester_before_it(self):
        student = make_student("SB1", intake="2025/2026 Semester I")
        semesters_for(student, "Semester I, 2025/2026", "Semester II, 2025/2026", "Semester I, 2026/2027")
        data = self.client.get("/api/registry/graduation/").data
        self.assertEqual([row["term"] for row in data["lastSemesters"]], ["SEMESTER_I", "SPECIAL", "SEMESTER_II"])
        result = self.client.post("/api/registry/graduation/finish/", {"matrics": ["SB1"], "earlyApproved": ["SB1"], "lastSession": "2025/2026", "lastTerm": "SEMESTER_II"}, format="json")
        self.assertEqual(len(result.data["finished"]), 1, result.data)
        self.assertFalse(student.semesters.filter(session="2026/2027").exists())

    def test_p1_before_it_still_suggests_p2(self):
        student = make_student("SB2", intake="2025/2026 Semester I")
        ProjectRegistration.objects.create(student=student, academic_semester=self.normal, stage="P1", confirmed_by=self.office)
        self.assertEqual(suggestions(self.portal, [student.pk]), {student.pk: "P2"})


class ActivationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN)
        cls.target = make_semester(cls.office, "2026/2027", "SEMESTER_I", active=False)
        publish_test_capacity_plan(cls.target, cls.office)
        cls.intake = "2025/2026 Semester I"

    def activate(self):
        with self.captureOnCommitCallbacks(execute=True):
            activate_semester(self.target, actor=self.office, reason="New semester")

    def test_leave_ends_and_finished_students_are_skipped(self):
        on_leave = make_student("AC1", intake=self.intake, status=Student.Status.DEFERRED)
        finished = make_student("AC2", intake=self.intake)
        semesters_for(finished, "Semester II, 2025/2026")
        StudentCompletion.objects.create(student=finished, last_session="2025/2026", last_term="SEMESTER_II")
        plain = make_student("AC3", intake=self.intake)
        self.activate()
        on_leave.refresh_from_db()
        self.assertEqual(on_leave.status, Student.Status.ACTIVE)
        self.assertEqual(on_leave.semesters.get().outcome, Outcome.STUDIED)
        self.assertFalse(finished.semesters.filter(session="2026/2027").exists())
        self.assertTrue(plain.semesters.filter(session="2026/2027").exists())
        move = StudentSemesterMove.objects.get()
        self.assertEqual((move.moved_count, move.back_from_leave_count), (2, 1))


class NotStartedAndEnrolmentTests(Base):
    def test_a_later_intake_shows_not_started_and_cannot_start_requests(self):
        later = make_student("NS1", intake="2027/2028 Semester I")
        self.assertEqual(shown_status(later), "Not started")
        self.assertFalse(student_is_workflow_eligible(later))
        current = make_student("NS2", intake="2026/2027 Semester I")
        self.assertEqual(shown_status(current), "Active")
        self.assertTrue(student_is_workflow_eligible(current))

    def test_a_student_who_did_not_register_cannot_ask_for_a_letter(self):
        from letters.eligibility import inactive_student_refusal

        student = make_student("NS3")
        semesters_for(student, THREE[2], outcome=Outcome.NOT_REGISTERED)
        self.assertIn("not registered", inactive_student_refusal(student.user)["detail"])
        StudentSemester.objects.filter(student=student).update(outcome=Outcome.STUDIED)
        self.assertIsNone(inactive_student_refusal(student.user))

    def test_a_student_waiting_for_the_senate_can_still_ask_for_a_letter(self):
        from letters.eligibility import inactive_student_refusal

        student = make_student("NS4")
        semesters_for(student, *THREE)
        self.finish("NS4")
        self.assertIsNone(inactive_student_refusal(student.user))


class LimitWarningTests(Base):
    def codes(self, student):
        return [(row["code"], row["level"]) for row in limit_warnings(progress_of(student))]

    def test_not_registered_warns_then_stops(self):
        student = make_student("LW1")
        semesters_for(student, "Semester I, 2026/2027", "Semester II, 2026/2027", outcome=Outcome.NOT_REGISTERED)
        self.assertEqual(self.codes(student), [("NOT_REGISTERED", "check")])
        semesters_for(student, "Semester I, 2027/2028", outcome=Outcome.NOT_REGISTERED)
        self.assertEqual(self.codes(Student.objects.get(pk=student.pk)), [("NOT_REGISTERED", "stop")])

    def test_personal_leave_is_limited_to_two(self):
        student = make_student("LW2")
        semesters_for(student, "Semester I, 2026/2027", "Semester II, 2026/2027", outcome=Outcome.LEAVE)
        self.assertEqual(self.codes(student), [("PERSONAL_LEAVE", "check")])

    def test_the_page_lists_who_needs_a_decision(self):
        student = make_student("LW3")
        semesters_for(student, "Semester I, 2026/2027", "Semester II, 2026/2027", outcome=Outcome.NOT_REGISTERED)
        data = self.client.get("/api/registry/semester-move/").data
        self.assertEqual([row["matric"] for row in data["attention"]], ["LW3"])


class ProjectStageTests(Base):
    def setUp(self):
        super().setUp()
        self.student = make_student("PS1")
        semesters_for(self.student, THREE[2])

    def stage(self):
        return project_stages(self.portal, [self.student.pk])[self.student.pk]

    def confirm(self, stage="P1"):
        return confirm_stages(self.portal, [(self.student.matric_no, stage)], self.office)

    def test_nothing_confirmed_means_not_confirmed_and_every_id_gets_an_answer(self):
        other = make_student("PS2")
        answers = project_stages(self.portal, [self.student.pk, other.pk])
        self.assertEqual({row.state for row in answers.values()}, {NOT_CONFIRMED})
        self.assertEqual(len(answers), 2)

    def test_confirming_gives_the_stage(self):
        self.confirm("P2")
        stage = self.stage()
        self.assertEqual((stage.state, stage.stage, stage.revision), (CONFIRMED, "P2", 1))

    def test_no_project_is_its_own_answer(self):
        self.confirm("NONE")
        self.assertEqual((self.stage().state, self.stage().stage), (NO_PROJECT, None))

    def test_leave_wins_over_a_confirmed_stage(self):
        self.confirm("P1")
        StudentSemester.objects.filter(student=self.student).update(outcome=Outcome.LEAVE)
        self.assertEqual((self.stage().state, self.stage().reason), (NOT_STUDYING, ON_LEAVE))

    def test_leave_now_only_counts_for_the_active_semester(self):
        before = make_semester(self.office, "2026/2027", "SEMESTER_II", active=False, days=-120)
        ProjectRegistration.objects.create(student=self.student, academic_semester=before, stage="P2", confirmed_by=self.office)
        Student.objects.filter(pk=self.student.pk).update(status=Student.Status.DEFERRED)
        answer = project_stages(before, [self.student.pk])[self.student.pk]
        self.assertEqual((answer.state, answer.stage), (CONFIRMED, "P2"))
        self.assertEqual((self.stage().state, self.stage().reason), (NOT_STUDYING, ON_LEAVE))

    def test_not_registered_is_not_studying(self):
        StudentSemester.objects.filter(student=self.student).update(outcome=Outcome.NOT_REGISTERED)
        self.assertEqual((self.stage().state, self.stage().reason), (NOT_STUDYING, UNREGISTERED))

    def test_waiting_for_the_senate_is_not_studying_in_a_later_semester(self):
        StudentCompletion.objects.create(student=self.student, last_session="2026/2027", last_term="SEMESTER_II")
        self.assertEqual((self.stage().state, self.stage().reason), (NOT_STUDYING, FINISHED))

    def test_the_finished_semester_itself_still_answers(self):
        self.confirm("P2")
        StudentCompletion.objects.create(student=self.student, last_session=ACTIVE_SESSION, last_term=ACTIVE_TERM)
        self.assertEqual(self.stage().state, CONFIRMED)

    def test_a_suggestion_is_never_returned_by_the_lookup(self):
        before = make_semester(self.office, "2026/2027", "SEMESTER_II", active=False, days=-120)
        ProjectRegistration.objects.create(student=self.student, academic_semester=before, stage="P1", confirmed_by=self.office)
        self.assertEqual(suggestions(self.portal, [self.student.pk]), {self.student.pk: "P2"})
        self.assertEqual(self.stage().state, NOT_CONFIRMED)

    def test_the_first_approved_request_suggests_p1(self):
        supervisor = User.objects.create_user(email="sv@example.test", password="pw", full_name="Sup", role=User.Role.LECTURER)
        SupervisorApplication.objects.create(student=self.student, academic_semester=self.portal, proposed_supervisor=supervisor, research_title="T", research_abstract="A", status="APPROVED")
        self.assertEqual(suggestions(self.portal, [self.student.pk]), {self.student.pk: "P1"})

    def test_a_confirmed_stage_goes_through_a_correction_with_history(self):
        self.confirm("P1")
        self.assertEqual(self.confirm("P2")["skipped"][0]["why"], "Already confirmed.")
        record = correct_stage(self.student, self.portal, new_stage="P2", reason="Wrong list", actor=self.office, revision=1, acknowledged=False)
        self.assertEqual((record.stage, record.revision), ("P2", 2))
        changes = list(ProjectRegistrationChange.objects.order_by("id"))
        self.assertEqual([(row.previous_stage, row.new_stage) for row in changes], [("", "P1"), ("P1", "P2")])

    def test_a_stale_correction_is_refused(self):
        from accounts.project_stages import StageConflict

        self.confirm("P1")
        with self.assertRaises(StageConflict):
            correct_stage(self.student, self.portal, new_stage="P2", reason="x", actor=self.office, revision=5, acknowledged=False)

    def test_voiding_makes_it_not_confirmed_again(self):
        self.confirm("P1")
        correct_stage(self.student, self.portal, new_stage="VOID", reason="By mistake", actor=self.office, revision=1, acknowledged=False)
        self.assertEqual(self.stage().state, NOT_CONFIRMED)
        self.assertEqual(self.confirm("P2")["confirmed"], [self.student.matric_no])

    def test_history_cannot_be_changed(self):
        self.confirm("P1")
        row = ProjectRegistrationChange.objects.get()
        with self.assertRaises(PermissionError):
            row.delete()
        with self.assertRaises(PermissionError):
            ProjectRegistrationChange.objects.all().update(reason="x")

    def test_the_page_lists_appointed_students_and_counts_the_rest(self):
        supervisor = User.objects.create_user(email="sv@example.test", password="pw", full_name="Sup", role=User.Role.LECTURER)
        application = SupervisorApplication.objects.create(student=self.student, proposed_supervisor=supervisor, research_title="T", research_abstract="A", status="APPROVED")
        SupervisorAppointment.objects.create(application=application, student=self.student, supervisor=supervisor, approved_by=self.office)
        make_student("PS3")
        data = self.client.get("/api/registry/project-stages/").data
        self.assertEqual([(row["matric"], row["attention"], row["suggested"]) for row in data["toConfirm"]], [("PS1", True, "")])
        self.assertEqual(data["noActivity"], 1)
        saved = self.client.post("/api/registry/project-stages/", {"semesterId": self.portal.pk, "items": [{"matric": "PS1", "stage": "P1"}]}, format="json")
        self.assertEqual(saved.data["confirmed"], ["PS1"])
        again = self.client.get("/api/registry/project-stages/").data
        self.assertEqual([row["stage"] for row in again["confirmed"]], ["P1"])

    def test_a_student_marked_as_finished_stays_on_the_page_for_their_last_semester(self):
        supervisor = User.objects.create_user(email="sv@example.test", password="pw", full_name="Sup", role=User.Role.LECTURER)
        application = SupervisorApplication.objects.create(student=self.student, proposed_supervisor=supervisor, research_title="T", research_abstract="A", status="APPROVED")
        SupervisorAppointment.objects.create(application=application, student=self.student, supervisor=supervisor, approved_by=self.office)
        StudentCompletion.objects.create(student=self.student, last_session=ACTIVE_SESSION, last_term=ACTIVE_TERM)
        data = self.client.get("/api/registry/project-stages/").data
        self.assertEqual([row["matric"] for row in data["toConfirm"]], ["PS1"])

    def test_a_graduate_stays_on_the_page_for_a_semester_they_were_confirmed_in(self):
        self.confirm("P2")
        Student.objects.filter(pk=self.student.pk).update(status=Student.Status.GRADUATED)
        data = self.client.get("/api/registry/project-stages/").data
        self.assertEqual([row["matric"] for row in data["confirmed"]], ["PS1"])

    def test_a_matric_in_other_letters_is_found_and_an_unknown_one_is_reported(self):
        result = confirm_stages(self.portal, [("ps1", "P1"), ("NOBODY", "P1")], self.office)
        self.assertEqual(result["confirmed"], ["PS1"])
        self.assertEqual(result["skipped"], [{"matric": "NOBODY", "why": "Not found."}])

    def test_only_the_office_uses_the_page(self):
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.client.get("/api/registry/project-stages/").status_code, 403)


class RetentionTests(Base):
    def ended(self, matric, status, years_ago):
        student = make_student(matric, status=status)
        student.status_changed_at = timezone.now() - timedelta(days=366 * years_ago)
        student.save(update_fields=["status_changed_at"])
        return student

    def test_the_period_counts_from_when_studies_ended(self):
        old = self.ended("RT1", Student.Status.WITHDRAWN, 9)
        self.ended("RT2", Student.Status.TERMINATED, 3)
        make_student("RT3")
        due, soon = due_for_removal()
        self.assertEqual([row[0].pk for row in due], [old.pk])
        self.assertEqual(soon, 0)

    def test_a_graduate_counts_from_the_senate_date(self):
        graduate = self.ended("RT4", Student.Status.GRADUATED, 1)
        decision = SenateDecision.objects.create(decided_on=timezone.localdate() - timedelta(days=366 * 9), recorded_by=self.office)
        StudentCompletion.objects.create(student=graduate, last_session="2016/2017", last_term="SEMESTER_I", senate_decision=decision)
        self.assertEqual([row[0].pk for row in due_for_removal()[0]], [graduate.pk])

    def test_the_page_lists_them_and_removes_nothing(self):
        self.ended("RT5", Student.Status.WITHDRAWN, 9)
        data = self.client.get("/api/registry/retention/").data
        self.assertEqual((data["years"], [row["matric"] for row in data["due"]]), (8, ["RT5"]))
        self.assertTrue(Student.objects.filter(matric_no="RT5").exists())
