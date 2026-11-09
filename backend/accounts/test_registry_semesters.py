from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from accounts.models import (
    ParticipantLifecycleAudit,
    ProgrammeRule,
    ProgrammeRuleChange,
    Student,
    StudentRegistry,
    StudentSemester,
    StudentSemesterMove,
    User,
)
from accounts.semester_rules import minimum_problem, progress_of, rule_for, rules_by_programme
from announcements.models import Notification
from accounts.semesters import SPECIAL, Semester, nth_normal, read, seeded_semesters, steps_to

DS = "MASTER OF DATA SCIENCE (COURSEWORK)"
RULES = "/api/registry/programme-rules/"


def make_student(matric, *, programme=DS, intake="2026/2027 Semester I", current="", status=Student.Status.ACTIVE):
    user = User.objects.create_user(
        email=f"{matric.lower()}@example.test", password="pw", full_name=f"Student {matric}", role=User.Role.STUDENT,
    )
    student = Student.objects.create(user=user, matric_no=matric, programme=programme, intake_semester=intake, status=status)
    if current:
        StudentRegistry.objects.create(student=student, current_semester=current)
    return student


def semesters_for(student, *labels, outcome=StudentSemester.Outcome.STUDIED):
    for label in labels:
        semester = read(label)
        StudentSemester.objects.create(student=student, session=semester.session, term=semester.term, outcome=outcome)


class LabelTests(SimpleTestCase):
    def test_reads_the_ways_the_office_writes_a_semester(self):
        for label, expected in {
            "Semester I, 2026/2027 Session": Semester(2026, "SEMESTER_I"),
            "2026/2027 Semester II": Semester(2026, "SEMESTER_II"),
            "2024/2025 Semester 1": Semester(2024, "SEMESTER_I"),
            "Sem 2 2026/2027": Semester(2026, "SEMESTER_II"),
            "Special Semester, 2026/2027 Session": Semester(2026, SPECIAL),
            "Semester Khas 2026/2027": Semester(2026, SPECIAL),
            "2026-2027-SP": Semester(2026, SPECIAL),
            "2026/2027-S2": Semester(2026, "SEMESTER_II"),
            "Semester III, 2026/2027": Semester(2026, SPECIAL),
        }.items():
            self.assertEqual(read(label), expected, label)
        for label in ("", "2027", "Semester 1", "Semester I, 2026/2028", None):
            self.assertIsNone(read(label), label)

    def test_writes_the_office_label(self):
        self.assertEqual(read("2026/2027 Semester 1").label, "Semester I, 2026/2027 Session")
        self.assertEqual(read("2026-2027-SP").label, "Special Semester, 2026/2027 Session")

    def test_the_maximum_counts_normal_semesters_like_the_office_visa_letter(self):
        start = read("Semester II, 2022/2023 Session")
        self.assertEqual(nth_normal(start, 12).label, "Semester I, 2028/2029 Session")
        self.assertEqual(nth_normal(read("Semester I, 2026/2027"), 8).label, "Semester II, 2029/2030 Session")

    def test_steps_count_a_special_semester_only_as_the_target(self):
        first, second = read("Semester I, 2026/2027"), read("Semester II, 2026/2027")
        special, next_first = read("Special Semester, 2026/2027"), read("Semester I, 2027/2028")
        self.assertEqual(steps_to(first, special), 2)
        self.assertEqual(steps_to(second, special), 1)
        self.assertEqual(steps_to(special, special), 0)
        self.assertEqual(steps_to(special, next_first), 1)
        self.assertEqual(steps_to(second, next_first), 1)
        self.assertEqual(steps_to(next_first, second), 0)

    def test_a_record_implies_every_normal_semester_up_to_the_current_one(self):
        labels = lambda *args: [s.label for s in seeded_semesters(*args)]
        self.assertEqual(labels("2026/2027 Semester I", ""), ["Semester I, 2026/2027 Session"])
        self.assertEqual(
            labels("2025/2026 Semester I", "Semester I, 2026/2027 Session"),
            ["Semester I, 2025/2026 Session", "Semester II, 2025/2026 Session", "Semester I, 2026/2027 Session"],
        )
        self.assertEqual(
            labels("2026/2027 Semester I", "Special Semester, 2026/2027 Session"),
            ["Semester I, 2026/2027 Session", "Semester II, 2026/2027 Session", "Special Semester, 2026/2027 Session"],
        )
        self.assertEqual(labels("", "Semester I, 2026/2027"), ["Semester I, 2026/2027 Session"])
        self.assertEqual(labels("nonsense", "more nonsense"), [])
        self.assertEqual(labels("2026/2027 Semester I", "2024/2025 Semester I"), ["Semester I, 2026/2027 Session"])


class ProgressTests(APITestCase):
    def test_programmes_start_from_the_handbook(self):
        for programme in (DS, "MASTER OF CYBER SECURITY (COURSEWORK)", "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)"):
            rule = ProgrammeRule.objects.get(programme=programme)
            self.assertEqual((rule.min_semesters, rule.max_semesters, rule.special_counts), (3, 8, True))
            self.assertEqual(rule.source, "Postgraduate Handbook 2026/2027")

    def test_two_semesters_and_a_special_reach_the_minimum(self):
        student = make_student("P1")
        semesters_for(student, "Semester I, 2026/2027", "Semester II, 2026/2027", "Special Semester, 2026/2027")
        progress = progress_of(student)
        self.assertEqual((progress.studied, progress.minimum, progress.short_of_minimum), (3, 3, 0))
        self.assertEqual(progress.maximum_semester.label, "Semester II, 2029/2030 Session")

    def test_special_does_not_count_when_the_rule_says_so(self):
        ProgrammeRule.objects.filter(programme=DS).update(special_counts=False)
        student = make_student("P2")
        semesters_for(student, "Semester I, 2026/2027", "Semester II, 2026/2027", "Special Semester, 2026/2027")
        self.assertEqual(progress_of(student).studied, 2)

    def test_leave_does_not_count_and_only_medical_leave_moves_the_maximum(self):
        student = make_student("P3")
        semesters_for(student, "Semester I, 2026/2027")
        semesters_for(student, "Semester II, 2026/2027", outcome=StudentSemester.Outcome.LEAVE)
        progress = progress_of(student)
        self.assertEqual((progress.studied, progress.maximum_semester.label), (1, "Semester II, 2029/2030 Session"))
        StudentSemester.objects.filter(student=student, term="SEMESTER_II").update(outcome=StudentSemester.Outcome.LEAVE_MEDICAL)
        self.assertEqual(progress_of(student).maximum_semester.label, "Semester I, 2030/2031 Session")

    def test_an_extension_moves_the_maximum_and_the_last_semester_shows(self):
        student = make_student("P4", intake="Semester I, 2020/2021")
        semesters_for(student, "Semester II, 2023/2024")
        progress = progress_of(student)
        self.assertEqual(progress.maximum_semester.label, "Semester II, 2023/2024 Session")
        self.assertTrue(progress.last_semester)
        self.assertFalse(progress.past_maximum)
        semesters_for(student, "Semester I, 2024/2025")
        self.assertTrue(progress_of(student).past_maximum)
        StudentRegistry.objects.update_or_create(student=student, defaults={"extension_semesters": 2})
        progress = progress_of(student)
        self.assertEqual(progress.maximum_semester.label, "Semester II, 2024/2025 Session")
        self.assertFalse(progress.past_maximum)

    def test_the_minimum_problem(self):
        one = make_student("P5")
        semesters_for(one, "Semester I, 2026/2027")
        self.assertIn("cannot graduate yet", minimum_problem(one))
        self.assertIn("cannot graduate yet", minimum_problem(one, early_approved=True))
        two = make_student("P6")
        semesters_for(two, "Semester I, 2026/2027", "Semester II, 2026/2027")
        self.assertIn("needs approval", minimum_problem(two))
        self.assertIsNone(minimum_problem(two, early_approved=True))
        three = make_student("P7")
        semesters_for(three, "Semester I, 2026/2027", "Semester II, 2026/2027", "Semester I, 2027/2028")
        self.assertIsNone(minimum_problem(three))
        none = make_student("P8")
        self.assertIn("no semester record", minimum_problem(none))
        other = make_student("P9", programme="MASTER OF SOMETHING ELSE")
        self.assertIsNone(minimum_problem(other))


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class RegistrySemesterApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        cls.lecturer = User.objects.create_user(
            email="lect@example.test", password="pw", full_name="Some Lecturer", role=User.Role.LECTURER,
        )
        cls.student = make_student("REG1", current="Semester II, 2026/2027 Session")
        semesters_for(cls.student, "Semester I, 2026/2027", "Semester II, 2026/2027")

    def url(self, suffix=""):
        return f"/api/registry/students/{self.student.matric_no}/{suffix}"

    def test_only_the_office_reads_and_edits_programme_rules(self):
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.client.get(RULES).status_code, 403)
        self.assertEqual(self.client.put(RULES, {}, format="json").status_code, 403)
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.client.get(RULES).status_code, 403)
        self.client.force_authenticate(self.office)
        rows = {row["programme"]: row for row in self.client.get(RULES).data["rules"]}
        self.assertEqual(len(rows), 3)
        self.assertEqual((rows[DS]["minSemesters"], rows[DS]["activeStudents"], rows[DS]["changedBy"]), (3, 1, ""))

    def test_the_office_changes_a_rule_and_the_change_is_kept(self):
        self.client.force_authenticate(self.office)
        body = {"programme": DS, "minSemesters": 4, "maxSemesters": 9, "specialCounts": False}
        response = self.client.put(RULES, body, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        row = next(item for item in response.data["rules"] if item["programme"] == DS)
        self.assertEqual((row["minSemesters"], row["maxSemesters"], row["specialCounts"]), (4, 9, False))
        self.assertEqual(row["changedBy"], "Office Person")
        change = ProgrammeRuleChange.objects.get(rule__programme=DS)
        same = {"programme": DS, "appliesFrom": ""}
        self.assertEqual(change.before_values, {**same, "minSemesters": 3, "maxSemesters": 8, "specialCounts": True})
        self.assertEqual(change.after_values, {**same, "minSemesters": 4, "maxSemesters": 9, "specialCounts": False})
        self.client.put(RULES, body, format="json")
        self.assertEqual(ProgrammeRuleChange.objects.filter(rule__programme=DS).count(), 1)

    def test_rule_edits_are_checked(self):
        self.client.force_authenticate(self.office)
        for body in (
            {"programme": DS, "minSemesters": 9, "maxSemesters": 8, "specialCounts": True},
            {"programme": DS, "minSemesters": 0, "maxSemesters": 8, "specialCounts": True},
            {"programme": "MASTER OF NOTHING", "minSemesters": 3, "maxSemesters": 8, "specialCounts": True},
        ):
            self.assertEqual(self.client.put(RULES, body, format="json").status_code, 400, body)

    def test_a_student_record_shows_progress_to_those_who_can_read_it(self):
        self.client.force_authenticate(self.office)
        data = self.client.get(self.url("semesters/")).data
        self.assertEqual((data["studied"], data["minimum"], data["shortOfMinimum"], data["hasRecord"]), (2, 3, 1, True))
        self.assertEqual(data["maximumSemester"], "Semester II, 2029/2030 Session")
        self.assertEqual([row["label"] for row in data["rows"]], ["Semester I, 2026/2027 Session", "Semester II, 2026/2027 Session"])
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.client.get(self.url("semesters/")).status_code, 404)
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.client.get(self.url("semesters/")).status_code, 403)

    def test_adding_a_semester_moves_the_current_semester_and_only_once(self):
        self.client.force_authenticate(self.office)
        body = {"session": "2026/2027", "term": "SPECIAL"}
        response = self.client.post(self.url("semesters/"), body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["studied"], 3)
        self.student.registry.refresh_from_db()
        self.assertEqual(self.student.registry.current_semester, "Special Semester, 2026/2027 Session")
        self.assertEqual(self.client.post(self.url("semesters/"), body, format="json").status_code, 409)
        bad = self.client.post(self.url("semesters/"), {"session": "2026/2028", "term": "SPECIAL"}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_only_the_office_changes_a_semester(self):
        row = self.student.semesters.first()
        self.client.force_authenticate(self.lecturer)
        self.assertEqual(self.client.post(self.url("semesters/"), {"session": "2026/2027", "term": "SPECIAL"}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(self.url(f"semesters/{row.pk}/"), {"outcome": "LEAVE"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(self.url(f"semesters/{row.pk}/")).status_code, 403)
        self.assertEqual(self.client.put(self.url("semester-extension/"), {"semesters": 1, "reason": "x"}, format="json").status_code, 403)

    def test_correcting_and_removing_a_semester(self):
        self.client.force_authenticate(self.office)
        rows = list(self.student.semesters.order_by("term"))
        changed = self.client.patch(self.url(f"semesters/{rows[1].pk}/"), {"outcome": "LEAVE"}, format="json")
        self.assertEqual((changed.status_code, changed.data["studied"]), (200, 1))
        removed = self.client.delete(self.url(f"semesters/{rows[1].pk}/"))
        self.assertEqual((removed.status_code, len(removed.data["rows"])), (200, 1))
        self.student.registry.refresh_from_db()
        self.assertEqual(self.student.registry.current_semester, "Semester I, 2026/2027 Session")
        self.assertEqual(self.client.delete(self.url(f"semesters/{rows[1].pk}/")).status_code, 404)

    def test_an_extension_needs_a_reason_and_stops_at_three(self):
        self.client.force_authenticate(self.office)
        url = self.url("semester-extension/")
        self.assertEqual(self.client.put(url, {"semesters": 2, "reason": " "}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"semesters": 4, "reason": "Dean"}, format="json").status_code, 400)
        saved = self.client.put(url, {"semesters": 2, "reason": "Dean's approval"}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual((saved.data["extensionSemesters"], saved.data["maximumSemester"]), (2, "Semester II, 2030/2031 Session"))
        cleared = self.client.put(url, {"semesters": 0, "reason": "old"}, format="json")
        self.assertEqual((cleared.data["extensionSemesters"], cleared.data["extensionReason"]), (0, ""))

    def test_registering_and_editing_a_student_gives_them_semesters(self):
        self.client.force_authenticate(self.office)
        response = self.client.post(
            "/api/registry/students/",
            {
                "id": "NEW1",
                "name": "New Student",
                "email": "new1@example.test",
                "programme": DS,
                "intakeDate": "2025/2026 Semester I",
                "semester": "Semester I, 2026/2027 Session",
                "sendInvite": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        rows = StudentSemester.objects.filter(student__matric_no="NEW1")
        self.assertEqual(rows.count(), 3)
        blank = make_student("NEW2", intake="")
        self.assertFalse(blank.semesters.exists())
        patched = self.client.patch("/api/registry/students/NEW2/", {"intakeDate": "2026/2027 Semester I"}, format="json")
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertEqual(blank.semesters.count(), 1)
        typed = self.client.patch("/api/registry/students/NEW2/", {"semester": "Semester II, 2026/2027 Session"}, format="json")
        self.assertEqual(typed.status_code, 200, typed.data)
        self.assertEqual(blank.semesters.count(), 2)
        self.assertEqual(typed.data["semester"], "Semester II, 2026/2027 Session")


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class MoveStudentsApiTests(APITestCase):
    url = "/api/registry/semester-move/"

    @classmethod
    def setUpTestData(cls):
        from datetime import timedelta

        from django.utils import timezone

        from academics.models import AcademicSemester

        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        today = timezone.localdate()
        cls.portal = AcademicSemester.objects.create(
            code="2026-2027-S2", academic_session="2026/2027", term="SEMESTER_II", created_by=cls.office,
            starts_on=today - timedelta(days=5), ends_on=today + timedelta(days=60), lifecycle_status="ACTIVE",
        )
        cls.one = make_student("MV1", current="Semester I, 2026/2027 Session")
        cls.two = make_student("MV2", current="Semester I, 2026/2027 Session")
        cls.three = make_student("MV3")
        cls.deferred = make_student("MV4", status=Student.Status.DEFERRED)
        cls.gone = make_student("MV5", status=Student.Status.GRADUATED)
        for student in (cls.one, cls.two, cls.three):
            semesters_for(student, "Semester I, 2026/2027")

    def body(self, *matrics):
        return {"semesterId": self.portal.pk, "matrics": list(matrics)}

    def test_only_the_office_moves_students(self):
        self.client.force_authenticate(self.one.user)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.post(self.url, self.body("MV1"), format="json").status_code, 403)

    def test_it_lists_active_students_not_yet_on_the_semester(self):
        self.client.force_authenticate(self.office)
        data = self.client.get(self.url).data
        self.assertEqual(data["semester"]["label"], "Semester II, 2026/2027 Session")
        self.assertEqual(sorted(row["matric"] for row in data["students"]), ["MV1", "MV2", "MV3"])
        self.assertEqual((data["waiting"], data["lastMove"]), (3, None))
        self.assertEqual(data["movingFrom"], "Semester I, 2026/2027 Session")
        summary = self.client.get(self.url, {"summary": "1"}).data
        self.assertEqual(summary["waiting"], 3)
        self.assertNotIn("students", summary)

    def test_moving_adds_the_semester_and_can_run_twice(self):
        self.client.force_authenticate(self.office)
        moved = self.client.post(self.url, self.body("mv1", "MV2"), format="json")
        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertEqual((moved.data["moved"], moved.data["leftOut"]), (2, 2))
        self.assertEqual(self.one.semesters.count(), 2)
        self.assertEqual(
            StudentRegistry.objects.get(student=self.one).current_semester, "Semester II, 2026/2027 Session"
        )
        self.assertFalse(StudentRegistry.objects.filter(student=self.three).exists())
        again = self.client.post(self.url, self.body("MV1", "MV2"), format="json")
        self.assertEqual(again.data["moved"], 0)
        self.assertEqual(self.one.semesters.count(), 2)
        state = self.client.get(self.url).data
        self.assertEqual([row["matric"] for row in state["students"]], ["MV3", "MV4"])
        self.assertEqual(state["lastMove"]["by"], "Office Person")

    def test_a_student_already_on_a_later_semester_keeps_it_as_current(self):
        StudentRegistry.objects.filter(student=self.one).update(current_semester="Semester I, 2027/2028 Session")
        self.client.force_authenticate(self.office)
        self.client.post(self.url, self.body("MV1"), format="json")
        self.assertEqual(self.one.semesters.count(), 2)
        self.assertEqual(StudentRegistry.objects.get(student=self.one).current_semester, "Semester I, 2027/2028 Session")

    def test_the_first_update_ends_leave_and_moves_only_who_was_asked(self):
        self.client.force_authenticate(self.office)
        response = self.client.post(self.url, self.body("MV1", "MV4", "MV5", "NOPE"), format="json")
        self.assertEqual(response.data["moved"], 2)
        self.assertEqual(sorted(response.data["notActive"]), ["MV5", "NOPE"])
        self.deferred.refresh_from_db()
        self.assertEqual(self.deferred.status, Student.Status.ACTIVE)
        self.assertFalse(self.gone.semesters.exists())

    def test_a_later_update_leaves_someone_on_leave_alone(self):
        self.client.force_authenticate(self.office)
        self.client.post(self.url, self.body("MV1"), format="json")
        on_leave = make_student("MV9", intake="2026/2027 Semester I", status=Student.Status.DEFERRED)
        self.client.post(self.url, self.body("MV2"), format="json")
        on_leave.refresh_from_db()
        self.assertEqual(on_leave.status, Student.Status.DEFERRED)

    def test_a_special_semester_moves_only_those_added_and_nobody_on_leave(self):
        self.portal.term = "SPECIAL"
        self.portal.code = "2026-2027-SP"
        self.portal.save()
        self.client.force_authenticate(self.office)
        data = self.client.get(self.url).data
        self.assertTrue(data["semester"]["isSpecial"])
        response = self.client.post(self.url, self.body("MV2"), format="json")
        self.assertEqual((response.data["moved"], response.data["semester"]), (1, "Special Semester, 2026/2027 Session"))
        self.assertFalse(self.deferred.semesters.filter(term="SPECIAL").exists())
        self.assertEqual(self.two.semesters.filter(term="SPECIAL").count(), 1)

    def test_it_refuses_a_stale_page_and_no_active_semester(self):
        self.client.force_authenticate(self.office)
        stale = self.client.post(self.url, {"semesterId": self.portal.pk + 1, "matrics": ["MV1"]}, format="json")
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.one.semesters.count(), 1)
        self.portal.lifecycle_status = "CLOSED"
        self.portal.save()
        self.assertEqual(self.client.get(self.url).data["semester"], None)
        self.assertEqual(self.client.post(self.url, self.body("MV1"), format="json").status_code, 409)


class SemesterMovesOnActivationTests(APITestCase):
    url = "/api/registry/semester-move/"
    STUDIED_LAST = "2025/2026 Semester II"

    @classmethod
    def setUpTestData(cls):
        from datetime import timedelta

        from django.utils import timezone

        from academics.models import AcademicSemester
        from academics.test_capacity_helpers import publish_test_capacity_plan

        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        today = timezone.localdate()
        AcademicSemester.objects.create(
            code="2025-2026-S2", academic_session="2025/2026", term="SEMESTER_II", created_by=cls.office,
            starts_on=today - timedelta(days=120), ends_on=today - timedelta(days=1), lifecycle_status="ACTIVE",
        )
        cls.target = AcademicSemester.objects.create(
            code="2026-2027-S1", academic_session="2026/2027", term="SEMESTER_I", created_by=cls.office,
            starts_on=today, ends_on=today + timedelta(days=100),
        )
        publish_test_capacity_plan(cls.target, cls.office)
        cls.one = make_student("AM1", intake=cls.STUDIED_LAST, current="Semester II, 2025/2026 Session")
        semesters_for(cls.one, "Semester II, 2025/2026")
        cls.later = make_student("AM2", intake="2026/2027 Semester II")
        cls.deferred = make_student("AM3", intake=cls.STUDIED_LAST, status=Student.Status.DEFERRED)
        cls.gone = make_student("AM4", intake=cls.STUDIED_LAST, status=Student.Status.GRADUATED)

    def setUp(self):
        self.client.force_authenticate(self.office)

    def activate(self):
        from academics.services import activate_semester

        with self.captureOnCommitCallbacks(execute=True):
            activate_semester(self.target, actor=self.office, reason="New semester")

    def make_it_special(self):
        self.target.term = "SPECIAL"
        self.target.code = "2026-2027-SP"
        self.target.save()

    def test_activating_a_normal_semester_moves_active_students_and_ends_leave(self):
        self.activate()
        row = self.one.semesters.get(session="2026/2027", term="SEMESTER_I")
        self.assertEqual((row.outcome, row.created_by), (StudentSemester.Outcome.STUDIED, self.office))
        self.assertEqual(StudentRegistry.objects.get(student=self.one).current_semester, "Semester I, 2026/2027 Session")
        self.assertEqual(progress_of(self.one).studied, 2)
        self.deferred.refresh_from_db()
        self.assertEqual(self.deferred.status, Student.Status.ACTIVE)
        self.assertEqual(self.deferred.semesters.get().outcome, StudentSemester.Outcome.STUDIED)
        self.assertFalse(self.later.semesters.exists())
        self.assertFalse(self.gone.semesters.exists())
        move = StudentSemesterMove.objects.get()
        self.assertEqual((move.moved_count, move.back_from_leave_count, move.automatic, move.moved_by), (2, 1, True, self.office))

    def test_the_students_tab_is_told_and_has_nothing_to_ask(self):
        self.activate()
        summary = self.client.get(self.url, {"summary": "1"}).data
        self.assertEqual(summary["waiting"], 0)
        last = summary["lastMove"]
        self.assertEqual((last["moved"], last["backFromLeave"], last["automatic"]), (2, 1, True))

    def test_the_page_lists_who_is_on_the_semester(self):
        self.activate()
        data = self.client.get(self.url).data
        self.assertEqual([row["matric"] for row in data["onSemester"]], ["AM1", "AM3"])
        self.assertEqual(data["onSemester"][0]["outcome"], "STUDIED")
        self.assertEqual(data["onLeave"], 0)
        self.assertEqual(data["students"], [])

    def test_someone_who_arrives_afterwards_still_waits(self):
        self.activate()
        make_student("AM5", intake="2026/2027 Semester I")
        data = self.client.get(self.url).data
        self.assertEqual([row["matric"] for row in data["students"]], ["AM5"])
        self.assertEqual(data["waiting"], 1)

    def test_running_it_again_changes_nothing(self):
        from accounts.semester_rules import move_everyone_on

        self.activate()
        self.assertIsNone(move_everyone_on(self.target, self.office))
        self.assertEqual(self.one.semesters.count(), 2)
        self.assertEqual(StudentSemesterMove.objects.count(), 1)

    def test_a_special_semester_moves_nobody(self):
        self.make_it_special()
        self.activate()
        self.assertFalse(StudentSemester.objects.filter(term="SPECIAL").exists())
        self.assertFalse(StudentSemesterMove.objects.exists())
        data = self.client.get(self.url).data
        self.assertEqual([row["matric"] for row in data["students"]], ["AM1", "AM2"])
        self.assertEqual((data["onSemester"], data["lastMove"]), ([], None))

    def test_a_failed_move_leaves_the_semester_active_and_can_be_redone(self):
        from unittest.mock import patch

        with patch("accounts.semester_rules.move_everyone_on", side_effect=RuntimeError("no")), self.assertLogs("django.test", "ERROR"):
            self.activate()
        self.target.refresh_from_db()
        self.assertEqual(self.target.lifecycle_status, "ACTIVE")
        self.assertEqual(self.client.get(self.url, {"summary": "1"}).data["waiting"], 1)
        done = self.client.post(self.url, {"semesterId": self.target.pk, "matrics": ["AM1"]}, format="json")
        self.assertEqual(done.data["moved"], 1)
        self.assertEqual(self.client.get(self.url, {"summary": "1"}).data["lastMove"]["automatic"], False)

    def test_not_registered_is_recorded_and_does_not_count_as_studied(self):
        self.activate()
        maximum = progress_of(self.one).maximum_semester
        row = self.one.semesters.get(session="2026/2027", term="SEMESTER_I")
        response = self.client.patch(
            f"/api/registry/students/AM1/semesters/{row.pk}/", {"outcome": "NOT_REGISTERED"}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["rows"][-1]["outcomeLabel"], "Not registered")
        fresh = Student.objects.get(pk=self.one.pk)
        self.assertEqual(progress_of(fresh).studied, 1)
        self.assertEqual(progress_of(fresh).maximum_semester, maximum)
        self.assertEqual(self.client.get(self.url).data["onSemester"][0]["outcome"], "NOT_REGISTERED")
        self.assertEqual(self.client.get(self.url, {"summary": "1"}).data["waiting"], 0)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class GraduationApiTests(APITestCase):
    url = "/api/registry/graduation/"
    finish_url = "/api/registry/graduation/finish/"
    REASON = "Senate meeting, 12 March 2027"
    THREE = ("Semester I, 2026/2027", "Semester II, 2026/2027", "Special Semester, 2026/2027")
    LAST = {"lastSession": "2026/2027", "lastTerm": "SPECIAL"}

    @classmethod
    def setUpTestData(cls):
        from datetime import timedelta

        from django.utils import timezone

        from academics.models import AcademicSemester

        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        today = timezone.localdate()
        cls.portal = AcademicSemester.objects.create(
            code="2026-2027-SP", academic_session="2026/2027", term="SPECIAL", created_by=cls.office,
            starts_on=today - timedelta(days=5), ends_on=today + timedelta(days=60), lifecycle_status="ACTIVE",
        )
        cls.ready = make_student("GR1")
        semesters_for(cls.ready, *cls.THREE)
        cls.early = make_student("GR2")
        semesters_for(cls.early, cls.THREE[0], cls.THREE[2])
        cls.first_year = make_student("GR3")
        semesters_for(cls.first_year, cls.THREE[2])
        cls.no_record = make_student("GR4", intake="")
        cls.gone = make_student("GR5", status=Student.Status.GRADUATED)
        semesters_for(cls.gone, *cls.THREE)
        cls.other = make_student("GR6", programme="MASTER OF SOMETHING ELSE")
        semesters_for(cls.other, cls.THREE[0])

    def group_of(self, data, matric):
        for group in ("ready", "check", "stop"):
            for row in data[group]:
                if row["matric"] == matric:
                    return group, row
        return None, None

    def test_only_the_office_uses_it(self):
        self.client.force_authenticate(self.ready.user)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.post(self.finish_url, {"matrics": ["GR1"], **self.LAST}, format="json").status_code, 403)
        self.assertEqual(self.client.get("/api/registry/students/GR1/graduation-check/").status_code, 403)
        self.ready.refresh_from_db()
        self.assertEqual(self.ready.status, Student.Status.ACTIVE)

    def test_the_overview_groups_students_and_only_counts_those_well_below_the_minimum(self):
        self.client.force_authenticate(self.office)
        data = self.client.get(self.url).data
        self.assertEqual(self.group_of(data, "GR1")[0], "ready")
        group, row = self.group_of(data, "GR2")
        self.assertEqual((group, row["early"], row["studied"], row["minimum"]), ("check", True, 2, 3))
        self.assertEqual(self.group_of(data, "GR3")[0], None)
        self.assertEqual(data["tooEarly"], 1)
        group, row = self.group_of(data, "GR4")
        self.assertEqual((group, row["items"][0]["code"], row["items"][0]["fix"]), ("stop", "NO_RECORD", "record"))
        self.assertEqual(self.group_of(data, "GR5")[0], None)
        group, row = self.group_of(data, "GR6")
        self.assertEqual((group, row["items"][-1]["code"]), ("check", "NO_RULE"))

    def test_finishing_a_group_skips_anyone_who_cannot_and_says_why(self):
        self.client.force_authenticate(self.office)
        response = self.client.post(
            self.finish_url, {"matrics": ["GR1", "GR2", "GR3", "GR4", "GR5", "NOPE"], **self.LAST}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row["matric"] for row in response.data["finished"]], ["GR1"])
        why = {row["matric"]: row["why"] for row in response.data["skipped"]}
        self.assertEqual(set(why), {"GR2", "GR3", "GR4", "GR5", "NOPE"})
        self.assertIn("needs approval", why["GR2"])
        self.assertIn("Only 1 semester studied", why["GR3"])
        self.assertIn("Not on Special Semester", why["GR4"])
        self.ready.refresh_from_db()
        self.assertEqual(self.ready.status, Student.Status.ACTIVE)
        self.assertTrue(ParticipantLifecycleAudit.objects.filter(student=self.ready, new_status="WAITING_FOR_SENATE").exists())

    def test_one_semester_early_needs_the_approval_and_two_is_never_allowed(self):
        self.client.force_authenticate(self.office)
        body = {"matrics": ["GR2", "GR3"], "earlyApproved": ["gr2", "GR3"], **self.LAST}
        response = self.client.post(self.finish_url, body, format="json")
        self.assertEqual([row["matric"] for row in response.data["finished"]], ["GR2"])
        self.assertEqual([row["matric"] for row in response.data["skipped"]], ["GR3"])

    def test_the_semester_must_be_one_the_portal_offers(self):
        self.client.force_authenticate(self.office)
        body = {"matrics": ["GR1"], "lastSession": "2020/2021", "lastTerm": "SEMESTER_I"}
        self.assertEqual(self.client.post(self.finish_url, body, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.finish_url, {"matrics": [], **self.LAST}, format="json").status_code, 400)

    def test_waiting_work_warns_or_stops(self):
        from documents.models import Document, DocumentStudent, DocumentType
        from letters.models import GeneratedLetter

        self.client.force_authenticate(self.office)
        GeneratedLetter.objects.create(student=self.ready, template_name="Confirmation", status=GeneratedLetter.Status.PENDING, purpose="BANKING")
        doc_type = DocumentType.objects.create(label="Progress report", code="progress", required=True, is_active=True)
        data = self.client.get(self.url).data
        group, row = self.group_of(data, "GR1")
        self.assertEqual(group, "check")
        self.assertEqual(sorted(item["code"] for item in row["items"]), ["DOCUMENTS", "LETTERS"])
        document = Document.objects.create(
            title="Report", doc_type=doc_type, uploaded_by=self.ready.user, check_status=Document.CheckStatus.WAITING,
        )
        DocumentStudent.objects.create(document=document, student=self.ready)
        data = self.client.get(self.url).data
        self.assertEqual(sorted(item["code"] for item in self.group_of(data, "GR1")[1]["items"]), ["FILES", "LETTERS"])
        response = self.client.post(self.finish_url, {"matrics": ["GR1"], **self.LAST}, format="json")
        self.assertEqual([row["matric"] for row in response.data["finished"]], ["GR1"])

    def test_the_rule_also_holds_for_one_student_at_a_time(self):
        self.client.force_authenticate(self.office)
        record = "/api/registry/students/GR3/"
        body = {"academicStatus": "Graduated", "statusReason": self.REASON}
        refused = self.client.patch(record, body, format="json")
        self.assertEqual(refused.status_code, 409)
        self.assertIn("Graduation page", refused.data["error"])
        also = self.client.post("/api/accounts/participants/students/GR3/transition/", {"targetStatus": "GRADUATED", "reason": self.REASON}, format="json")
        self.assertEqual(also.status_code, 409)
        self.assertIn("cannot graduate yet", also.data["error"])
        early = self.client.post("/api/accounts/participants/students/GR2/transition/", {"targetStatus": "GRADUATED", "reason": self.REASON}, format="json")
        self.assertEqual(early.status_code, 409)
        self.assertIn("needs approval", early.data["error"])

    def test_the_student_record_check(self):
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.get("/api/registry/students/GR1/graduation-check/").data["group"], "ready")
        self.assertEqual(self.client.get("/api/registry/students/GR3/graduation-check/").data["group"], "stop")
        self.assertEqual(self.client.get("/api/registry/students/GR5/graduation-check/").status_code, 409)

    def test_deferring_makes_this_semester_leave(self):
        self.client.force_authenticate(self.office)
        response = self.client.patch(
            "/api/registry/students/GR2/", {"academicStatus": "Deferred", "statusReason": "Family reasons"}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        row = self.early.semesters.get(term="SPECIAL")
        self.assertEqual(row.outcome, StudentSemester.Outcome.LEAVE)
        self.assertEqual(self.early.semesters.get(term="SEMESTER_I").outcome, StudentSemester.Outcome.STUDIED)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class StatusNoticeTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        from datetime import timedelta

        from django.utils import timezone

        from academics.models import AcademicSemester

        today = timezone.localdate()
        AcademicSemester.objects.create(
            code="2026-2027-SP", academic_session="2026/2027", term="SPECIAL", created_by=cls.office,
            starts_on=today - timedelta(days=5), ends_on=today + timedelta(days=60), lifecycle_status="ACTIVE",
        )
        cls.student = make_student("SN1")
        semesters_for(cls.student, "Semester I, 2025/2026", "Semester I, 2026/2027", "Semester II, 2026/2027", "Special Semester, 2026/2027")

    def graduate(self):
        from django.utils import timezone

        self.client.force_authenticate(self.office)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post("/api/registry/graduation/finish/", {"matrics": ["SN1"], "lastSession": "2026/2027", "lastTerm": "SPECIAL"}, format="json")
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post("/api/registry/graduation/senate/", {"matrics": ["SN1"], "decidedOn": timezone.localdate().isoformat()}, format="json")

    def change(self, status, reason="Senate meeting"):
        self.client.force_authenticate(self.office)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.patch(
                "/api/registry/students/SN1/", {"academicStatus": status, "statusReason": reason}, format="json",
            )

    def notices(self):
        return list(Notification.objects.filter(recipient=self.student.user, record_type="STUDENT_STATUS").order_by("pk"))

    def test_the_student_is_told_when_their_status_changes(self):
        self.assertEqual(self.change("Deferred", "Family reasons").status_code, 200)
        self.assertEqual(self.change("Active", "Back from leave").status_code, 200)
        self.assertEqual(self.graduate().status_code, 200)
        notices = self.notices()
        self.assertEqual(
            [notice.title for notice in notices],
            ["You are on semester leave", "You are Active again", "Your studies are marked as finished", "You have graduated"],
        )
        self.assertIn("Family reasons", notices[0].message)
        self.assertEqual(notices[2].summary, "Your status is now Waiting for Senate.")
        self.assertEqual((notices[3].target_module, notices[3].is_read), ("DASHBOARD", False))
        self.assertEqual(notices[3].summary, "Your status is now Graduated.")

    def test_graduating_tells_them_at_both_steps(self):
        response = self.graduate()
        self.assertEqual(len(response.data["graduated"]), 1)
        self.assertEqual([notice.title for notice in self.notices()], ["Your studies are marked as finished", "You have graduated"])

    def test_a_suspended_account_is_not_told(self):
        User.objects.filter(pk=self.student.user.pk).update(is_active=False)
        self.change("Deferred", "Family reasons")
        self.assertEqual(self.notices(), [])


class MaximumFlagTests(APITestCase):
    def test_the_list_flags_the_last_semester_and_past_the_maximum(self):
        office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        last = make_student("MX1", intake="Semester I, 2020/2021")
        semesters_for(last, "Semester II, 2023/2024")
        past = make_student("MX2", intake="Semester I, 2020/2021")
        semesters_for(past, "Semester I, 2024/2025")
        fine = make_student("MX3")
        semesters_for(fine, "Semester I, 2026/2027")
        done = make_student("MX4", intake="Semester I, 2020/2021", status=Student.Status.GRADUATED)
        semesters_for(done, "Semester I, 2024/2025")
        self.client.force_authenticate(office)
        flags = {row["id"]: row["maximumFlag"] for row in self.client.get("/api/registry/students/").data}
        self.assertEqual(flags, {"MX1": "last", "MX2": "past", "MX3": "", "MX4": ""})
        self.assertEqual(self.client.get("/api/registry/students/MX2/").data["maximumFlag"], "past")


class IntakeTests(APITestCase):
    """October and March students sit side by side, each counted from their own intake."""

    url = "/api/registry/semester-move/"
    graduation = "/api/registry/graduation/"
    LATER = "2026/2027 Semester II"

    @classmethod
    def setUpTestData(cls):
        from datetime import timedelta

        from django.utils import timezone

        from academics.models import AcademicSemester

        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        today = timezone.localdate()
        cls.portal = AcademicSemester.objects.create(
            code="2026-2027-S1", academic_session="2026/2027", term="SEMESTER_I", created_by=cls.office,
            starts_on=today - timedelta(days=5), ends_on=today + timedelta(days=60), lifecycle_status="ACTIVE",
        )
        cls.october = make_student("IN1", intake="2025/2026 Semester II", current="Semester II, 2025/2026 Session")
        semesters_for(cls.october, "Semester II, 2025/2026")
        cls.march = make_student("IN2", intake=cls.LATER)
        semesters_for(cls.march, "Semester II, 2026/2027")

    def setUp(self):
        self.client.force_authenticate(self.office)

    def test_a_student_on_a_later_intake_is_not_waiting_and_cannot_be_moved(self):
        data = self.client.get(self.url).data
        self.assertEqual([row["matric"] for row in data["students"]], ["IN1"])
        self.assertEqual((data["waiting"], data["notStarted"]), (1, 1))
        self.assertEqual(data["students"][0]["intake"], "Semester II, 2025/2026 Session")
        self.assertEqual(self.client.get(f"{self.url}?summary=1").data["waiting"], 1)
        done = self.client.post(self.url, {"semesterId": self.portal.pk, "matrics": ["IN1", "IN2"]}, format="json").data
        self.assertEqual((done["moved"], done["leftOut"]), (1, 0))
        self.assertFalse(self.march.semesters.filter(session="2026/2027", term="SEMESTER_I").exists())
        self.assertEqual(progress_of(self.march).studied, 1)

    def test_leave_ends_for_a_started_student_and_not_for_a_later_intake(self):
        waiting = make_student("IN3", intake=self.LATER, status=Student.Status.DEFERRED)
        back = make_student("IN4", intake="2025/2026 Semester II", status=Student.Status.DEFERRED)
        self.client.post(self.url, {"semesterId": self.portal.pk, "matrics": ["IN1"]}, format="json")
        waiting.refresh_from_db()
        back.refresh_from_db()
        self.assertEqual((waiting.status, back.status), (Student.Status.DEFERRED, Student.Status.ACTIVE))

    def test_a_student_on_a_later_intake_is_counted_as_too_early_and_cannot_graduate(self):
        ProgrammeRule.objects.filter(programme=DS).delete()
        data = self.client.get(self.graduation).data
        listed = [row["matric"] for group in ("ready", "check", "stop") for row in data[group]]
        self.assertNotIn("IN2", listed)
        self.assertEqual(data["tooEarly"], 1)
        self.assertEqual(self.client.get("/api/registry/students/IN2/graduation-check/").data["items"][0]["code"], "NOT_STARTED")
        result = self.client.post(f"{self.graduation}finish/", {"matrics": ["IN2"], "lastSession": "2026/2027", "lastTerm": "SEMESTER_I"}, format="json").data
        self.assertEqual((result["finished"], result["skipped"][0]["why"]), ([], "Not on Semester I, 2026/2027 Session."))

    def test_a_semester_before_the_intake_cannot_be_added_and_an_old_one_is_flagged(self):
        url = f"/api/registry/students/{self.march.matric_no}/semesters/"
        refused = self.client.post(url, {"session": "2026/2027", "term": "SEMESTER_I"}, format="json")
        self.assertEqual(refused.status_code, 409)
        self.assertIn("before this student's intake", refused.data["error"])
        self.assertEqual(self.client.get(url).data["intake"], "Semester II, 2026/2027 Session")

        self.october.intake_semester = "2026/2027 Semester I"
        self.october.save(update_fields=["intake_semester"])
        semesters_for(self.october, "Semester I, 2026/2027", "Semester II, 2026/2027")
        data = self.client.get(f"/api/registry/students/{self.october.matric_no}/semesters/").data
        self.assertEqual(data["beforeIntake"], ["Semester II, 2025/2026 Session"])
        check = self.client.get(f"/api/registry/students/{self.october.matric_no}/graduation-check/").data
        self.assertIn("BEFORE_INTAKE", [item["code"] for item in check["items"]])

    def test_a_record_that_starts_after_the_intake_is_flagged(self):
        self.october.intake_semester = "2025/2026 Semester I"
        self.october.save(update_fields=["intake_semester"])
        self.assertTrue(self.client.get(f"/api/registry/students/{self.october.matric_no}/semesters/").data["startsAfterIntake"])
        self.assertFalse(self.client.get(f"/api/registry/students/{self.march.matric_no}/semesters/").data["startsAfterIntake"])

    def test_the_intake_must_be_readable(self):
        bad = {"id": "IN9", "name": "New Student", "email": "in9@example.test", "programme": DS, "intakeDate": "next year", "sendInvite": False}
        response = self.client.post("/api/registry/students/", bad, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("intakeDate", response.data)
        good = self.client.post("/api/registry/students/", {**bad, "intakeDate": self.LATER}, format="json")
        self.assertEqual(good.status_code, 201, good.data)
        self.assertEqual(good.data["intakeLabel"], "Semester II, 2026/2027 Session")
        record = "/api/registry/students/IN9/"
        self.assertEqual(self.client.patch(record, {"intakeDate": "soon"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(record, {"intakeDate": ""}, format="json").status_code, 200)


class RulesByIntakeTests(APITestCase):
    NEW_INTAKE = {"programme": DS, "minSemesters": 4, "maxSemesters": 6, "specialCounts": False, "fromSession": "2026/2027", "fromTerm": "SEMESTER_II"}

    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        cls.old = make_student("RI1", intake="2026/2027 Semester I")
        cls.new = make_student("RI2", intake="2026/2027 Semester II")
        cls.newer = make_student("RI3", intake="2027/2028 Semester I")
        cls.unknown = make_student("RI4", intake="")

    def setUp(self):
        self.client.force_authenticate(self.office)

    def row(self, response):
        return next(item for item in response.data["rules"] if item["programme"] == DS)

    def test_a_new_rule_only_covers_that_intake_and_later_ones(self):
        response = self.client.put(RULES, self.NEW_INTAKE, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        row = self.row(response)
        self.assertEqual((row["minSemesters"], row["activeStudents"]), (3, 1))
        later = row["laterRules"][0]
        self.assertEqual(
            (later["fromLabel"], later["minSemesters"], later["maxSemesters"], later["activeStudents"], later["changedBy"]),
            ("Semester II, 2026/2027 Session", 4, 6, 3, "Office Person"),
        )
        self.assertEqual(progress_of(self.old).minimum, 3)
        self.assertEqual(progress_of(self.new).minimum, 4)
        self.assertEqual(progress_of(self.newer).maximum, 6)
        self.assertEqual(progress_of(self.unknown).minimum, 4)

    def test_the_maximum_uses_the_rule_for_the_intake(self):
        self.client.put(RULES, self.NEW_INTAKE, format="json")
        self.assertEqual(progress_of(self.old).maximum_semester, nth_normal(read("2026/2027 Semester I"), 8))
        self.assertEqual(progress_of(self.new).maximum_semester, nth_normal(read("2026/2027 Semester II"), 6))

    def test_an_intake_before_every_later_rule_keeps_the_first_rule(self):
        rules = rules_by_programme()
        self.assertEqual(rule_for(DS, rules, read("2020/2021 Semester I")).min_semesters, 3)

    def test_saving_the_same_intake_again_changes_that_rule(self):
        self.client.put(RULES, self.NEW_INTAKE, format="json")
        response = self.client.put(RULES, {**self.NEW_INTAKE, "minSemesters": 5}, format="json")
        self.assertEqual([later["minSemesters"] for later in self.row(response)["laterRules"]], [5])
        self.assertEqual(ProgrammeRule.objects.filter(programme=DS).count(), 2)

    def test_editing_the_first_rule_leaves_a_later_one_alone(self):
        self.client.put(RULES, self.NEW_INTAKE, format="json")
        body = {"programme": DS, "minSemesters": 2, "maxSemesters": 7, "specialCounts": True}
        row = self.row(self.client.put(RULES, body, format="json"))
        self.assertEqual((row["minSemesters"], row["laterRules"][0]["minSemesters"]), (2, 4))

    def test_the_first_intake_is_checked(self):
        for extra in (
            {"fromSession": "2026/2027", "fromTerm": ""},
            {"fromSession": "", "fromTerm": "SEMESTER_I"},
            {"fromSession": "2026/2028", "fromTerm": "SEMESTER_I"},
            {"fromSession": "2026/2027", "fromTerm": "SPECIAL"},
        ):
            self.assertEqual(self.client.put(RULES, {**self.NEW_INTAKE, **extra}, format="json").status_code, 400, extra)

    def test_a_programme_needs_its_first_rule_before_a_later_one(self):
        ProgrammeRule.objects.filter(programme=DS).delete()
        self.assertEqual(self.client.put(RULES, self.NEW_INTAKE, format="json").status_code, 409)

    def test_a_later_rule_can_be_removed_and_the_history_stays(self):
        later = self.row(self.client.put(RULES, self.NEW_INTAKE, format="json"))["laterRules"][0]
        response = self.client.delete(f"{RULES}{later['id']}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.row(response)["laterRules"], [])
        self.assertEqual(progress_of(self.new).minimum, 3)
        change = ProgrammeRuleChange.objects.filter(after_values={}).get()
        self.assertEqual((change.rule, change.before_values["appliesFrom"]), (None, "Semester II, 2026/2027 Session"))
        self.assertEqual(self.client.delete(f"{RULES}{later['id']}/").status_code, 404)

    def test_the_first_rule_cannot_be_removed_and_only_the_office_can_remove(self):
        first = ProgrammeRule.objects.get(programme=DS)
        self.assertEqual(self.client.delete(f"{RULES}{first.pk}/").status_code, 409)
        self.client.force_authenticate(self.old.user)
        self.assertEqual(self.client.delete(f"{RULES}{first.pk}/").status_code, 403)
