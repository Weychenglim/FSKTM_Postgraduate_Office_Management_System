from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from accounts.models import (
    ParticipantLifecycleAudit,
    ProgrammeRule,
    ProgrammeRuleChange,
    Student,
    StudentRegistry,
    StudentSemester,
    User,
)
from accounts.semester_rules import minimum_problem, progress_of
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
        StudentSemester.objects.filter(student=student, term="SEMESTER_II").update(outcome=StudentSemester.Outcome.LEAVE_EXEMPT)
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
        self.assertEqual(change.before_values, {"minSemesters": 3, "maxSemesters": 8, "specialCounts": True})
        self.assertEqual(change.after_values, {"minSemesters": 4, "maxSemesters": 9, "specialCounts": False})
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
        self.assertEqual((data["waiting"], data["deferred"], data["lastMove"]), (3, 1, None))
        self.assertEqual(data["movingFrom"], "Semester I, 2026/2027 Session")
        summary = self.client.get(self.url, {"summary": "1"}).data
        self.assertEqual(summary["waiting"], 3)
        self.assertNotIn("students", summary)

    def test_moving_adds_the_semester_and_can_run_twice(self):
        self.client.force_authenticate(self.office)
        moved = self.client.post(self.url, self.body("mv1", "MV2"), format="json")
        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertEqual((moved.data["moved"], moved.data["leftOut"]), (2, 1))
        self.assertEqual(self.one.semesters.count(), 2)
        self.assertEqual(
            StudentRegistry.objects.get(student=self.one).current_semester, "Semester II, 2026/2027 Session"
        )
        self.assertFalse(StudentRegistry.objects.filter(student=self.three).exists())
        again = self.client.post(self.url, self.body("MV1", "MV2"), format="json")
        self.assertEqual(again.data["moved"], 0)
        self.assertEqual(self.one.semesters.count(), 2)
        state = self.client.get(self.url).data
        self.assertEqual([row["matric"] for row in state["students"]], ["MV3"])
        self.assertEqual(state["lastMove"]["by"], "Office Person")

    def test_a_deferred_student_gets_leave_and_nobody_else_moves(self):
        self.client.force_authenticate(self.office)
        response = self.client.post(self.url, self.body("MV1", "MV4", "MV5", "NOPE"), format="json")
        self.assertEqual(response.data["moved"], 1)
        self.assertEqual(sorted(response.data["notActive"]), ["MV4", "MV5", "NOPE"])
        row = self.deferred.semesters.get(term="SEMESTER_II")
        self.assertEqual(row.outcome, StudentSemester.Outcome.LEAVE)
        self.assertFalse(self.gone.semesters.exists())

    def test_a_special_semester_moves_only_those_added_and_nobody_on_leave(self):
        self.portal.term = "SPECIAL"
        self.portal.code = "2026-2027-SP"
        self.portal.save()
        self.client.force_authenticate(self.office)
        data = self.client.get(self.url).data
        self.assertTrue(data["semester"]["isSpecial"])
        self.assertEqual(data["deferred"], 0)
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


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class GraduationApiTests(APITestCase):
    url = "/api/registry/graduation/"
    check = "/api/registry/graduation/check/"
    REASON = "Senate meeting, 12 March 2027"
    THREE = ("Semester I, 2026/2027", "Semester II, 2026/2027", "Special Semester, 2026/2027")

    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        cls.ready = make_student("GR1")
        semesters_for(cls.ready, *cls.THREE)
        cls.early = make_student("GR2")
        semesters_for(cls.early, *cls.THREE[:2])
        cls.first_year = make_student("GR3")
        semesters_for(cls.first_year, cls.THREE[0])
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
        self.assertEqual(self.client.post(self.url, {"matrics": ["GR1"], "reason": "x"}, format="json").status_code, 403)
        self.assertEqual(self.client.post(self.check, {"matrics": ["GR1"]}, format="json").status_code, 403)
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

    def test_a_pasted_list_shows_everyone_on_it(self):
        self.client.force_authenticate(self.office)
        data = self.client.post(self.check, {"matrics": ["gr1", "GR3", "GR5", "99999", "GR1"]}, format="json").data
        self.assertEqual([row["matric"] for row in data["ready"]], ["GR1"])
        group, row = self.group_of(data, "GR3")
        self.assertEqual((group, row["tooEarly"]), ("stop", True))
        self.assertIn("Only 1 semester studied", row["items"][0]["text"])
        self.assertEqual(data["notFound"], ["99999"])
        self.assertEqual(data["notActive"], [{"matric": "GR5", "name": "Student GR5", "status": "Graduated"}])

    def test_graduating_a_group_skips_anyone_who_cannot_and_says_why(self):
        self.client.force_authenticate(self.office)
        response = self.client.post(
            self.url, {"matrics": ["GR1", "GR2", "GR3", "GR4", "GR5", "NOPE"], "reason": self.REASON}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row["matric"] for row in response.data["graduated"]], ["GR1"])
        why = {row["matric"]: row["why"] for row in response.data["skipped"]}
        self.assertEqual(set(why), {"GR2", "GR3", "GR4", "GR5", "NOPE"})
        self.assertIn("needs approval", why["GR2"])
        self.assertIn("Only 1 semester studied", why["GR3"])
        self.assertIn("No semester record", why["GR4"])
        self.ready.refresh_from_db()
        self.assertEqual((self.ready.status, self.ready.status_reason), (Student.Status.GRADUATED, self.REASON))
        self.first_year.refresh_from_db()
        self.assertEqual(self.first_year.status, Student.Status.ACTIVE)
        self.assertTrue(ParticipantLifecycleAudit.objects.filter(student=self.ready, new_status="GRADUATED", reason=self.REASON).exists())

    def test_one_semester_early_needs_the_approval_and_two_is_never_allowed(self):
        self.client.force_authenticate(self.office)
        body = {"matrics": ["GR2", "GR3"], "earlyApproved": ["gr2", "GR3"], "reason": self.REASON}
        response = self.client.post(self.url, body, format="json")
        self.assertEqual([row["matric"] for row in response.data["graduated"]], ["GR2"])
        self.assertEqual([row["matric"] for row in response.data["skipped"]], ["GR3"])

    def test_a_reason_is_required(self):
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.post(self.url, {"matrics": ["GR1"], "reason": "  "}, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, {"matrics": [], "reason": "x"}, format="json").status_code, 400)

    def test_waiting_work_warns_or_stops(self):
        from documents.models import Document, DocumentStudent, DocumentType
        from letters.models import GeneratedLetter

        self.client.force_authenticate(self.office)
        GeneratedLetter.objects.create(student=self.ready, template_name="Confirmation", status=GeneratedLetter.Status.PENDING, purpose="BANKING")
        doc_type = DocumentType.objects.create(label="Progress report", code="progress", required=True, is_active=True)
        data = self.client.post(self.check, {"matrics": ["GR1"]}, format="json").data
        group, row = self.group_of(data, "GR1")
        self.assertEqual(group, "check")
        self.assertEqual(sorted(item["code"] for item in row["items"]), ["DOCUMENTS", "LETTERS"])
        document = Document.objects.create(
            title="Report", doc_type=doc_type, uploaded_by=self.ready.user, check_status=Document.CheckStatus.WAITING,
        )
        DocumentStudent.objects.create(document=document, student=self.ready)
        data = self.client.post(self.check, {"matrics": ["GR1"]}, format="json").data
        self.assertEqual(sorted(item["code"] for item in self.group_of(data, "GR1")[1]["items"]), ["FILES", "LETTERS"])
        response = self.client.post(self.url, {"matrics": ["GR1"], "reason": self.REASON}, format="json")
        self.assertEqual([row["matric"] for row in response.data["graduated"]], ["GR1"])

    def test_the_rule_also_holds_for_one_student_at_a_time(self):
        self.client.force_authenticate(self.office)
        record = "/api/registry/students/GR3/"
        body = {"academicStatus": "Graduated", "statusReason": self.REASON}
        refused = self.client.patch(record, body, format="json")
        self.assertEqual(refused.status_code, 409)
        self.assertIn("cannot graduate yet", refused.data["error"])
        also = self.client.post("/api/accounts/participants/students/GR3/transition/", {"targetStatus": "GRADUATED", "reason": self.REASON}, format="json")
        self.assertEqual(also.status_code, 409)
        self.assertIn("cannot graduate yet", also.data["error"])
        early = self.client.post("/api/accounts/participants/students/GR2/transition/", {"targetStatus": "GRADUATED", "reason": self.REASON}, format="json")
        self.assertEqual(early.status_code, 409)
        self.assertIn("needs approval", early.data["error"])
        early_record = "/api/registry/students/GR2/"
        self.assertEqual(self.client.patch(early_record, body, format="json").status_code, 409)
        approved = self.client.patch(early_record, {**body, "earlyCompletionApproved": True}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["academicStatus"], "Graduated")

    def test_the_student_record_check(self):
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.get("/api/registry/students/GR1/graduation-check/").data["group"], "ready")
        self.assertEqual(self.client.get("/api/registry/students/GR3/graduation-check/").data["group"], "stop")
        self.assertEqual(self.client.get("/api/registry/students/GR5/graduation-check/").status_code, 409)

    def test_deferring_makes_this_semester_leave(self):
        from datetime import timedelta

        from django.utils import timezone

        from academics.models import AcademicSemester

        today = timezone.localdate()
        AcademicSemester.objects.create(
            code="2026-2027-S2", academic_session="2026/2027", term="SEMESTER_II", created_by=self.office,
            starts_on=today - timedelta(days=5), ends_on=today + timedelta(days=60), lifecycle_status="ACTIVE",
        )
        self.client.force_authenticate(self.office)
        response = self.client.patch(
            "/api/registry/students/GR2/", {"academicStatus": "Deferred", "statusReason": "Family reasons"}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        row = self.early.semesters.get(term="SEMESTER_II")
        self.assertEqual(row.outcome, StudentSemester.Outcome.LEAVE)
        self.assertEqual(self.early.semesters.get(term="SEMESTER_I").outcome, StudentSemester.Outcome.STUDIED)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class StatusNoticeTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.office = User.objects.create_user(
            email="office@example.test", password="pw", full_name="Office Person", role=User.Role.OFFICE_ADMIN,
        )
        cls.student = make_student("SN1")
        semesters_for(cls.student, "Semester I, 2026/2027", "Semester II, 2026/2027", "Special Semester, 2026/2027")

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
        self.assertEqual(self.change("Graduated").status_code, 200)
        notices = self.notices()
        self.assertEqual(
            [notice.title for notice in notices],
            ["Your studies are now deferred", "You are Active again", "You have graduated"],
        )
        self.assertIn("Family reasons", notices[0].message)
        self.assertEqual((notices[2].target_module, notices[2].is_read), ("DASHBOARD", False))
        self.assertEqual(notices[2].summary, "Your status is now Graduated.")

    def test_graduating_many_tells_each_of_them(self):
        self.client.force_authenticate(self.office)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/registry/graduation/", {"matrics": ["SN1"], "reason": "Senate meeting"}, format="json",
            )
        self.assertEqual(len(response.data["graduated"]), 1)
        self.assertEqual([notice.title for notice in self.notices()], ["You have graduated"])

    def test_a_suspended_account_is_not_told(self):
        User.objects.filter(pk=self.student.user.pk).update(is_active=False)
        self.change("Graduated")
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
