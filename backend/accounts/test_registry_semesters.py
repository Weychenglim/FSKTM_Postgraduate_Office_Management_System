from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from accounts.models import (
    ProgrammeRule,
    ProgrammeRuleChange,
    Student,
    StudentRegistry,
    StudentSemester,
    User,
)
from accounts.semester_rules import minimum_problem, progress_of
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
