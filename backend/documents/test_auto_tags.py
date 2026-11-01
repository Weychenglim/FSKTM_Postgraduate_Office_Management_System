"""Files are tagged by the system from their type, semester and uploader and from
their students' records. Nobody types a tag."""
from urllib.parse import urlencode

from django.core.cache import cache
from rest_framework.test import APITestCase

from accounts.models import Student

from .fixtures import AI, CS, DS, TEST_MEDIA, DocumentPeople
from .models import DocumentType
from .test_access import DocumentClient


def tags(document, kind=None):
    return [(tag["kind"], tag["label"]) for tag in document["autoTags"] if kind is None or tag["kind"] == kind]


@TEST_MEDIA
class AutoTagTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()
        Student.objects.filter(pk=cls.ali.pk).update(intake_semester="2025/2026 Semester 1")
        Student.objects.filter(pk=cls.bella.pk).update(intake_semester="2024/2025 Semester 2")

    def setUp(self):
        cache.clear()

    def test_a_student_upload_is_tagged_from_its_record(self):
        thesis = DocumentType.objects.get(code="thesis")
        made = self.made(self.ali.user, "thesis", "Thesis", tags=["typed", "ignored"])
        self.assertNotIn("tags", made)
        self.assertEqual(tags(made), [
            ("category", thesis.get_group_display()),
            ("semester", self.semester.label),
            ("from", "Student"),
            ("programme", DS),
            ("intake", "Intake 2025/2026 Semester 1"),
        ])
        filters = [tag["filter"] for tag in made["autoTags"]]
        self.assertEqual(filters[0], {"group": thesis.group})
        self.assertEqual(filters[1], {"semester": str(self.semester.pk)})
        self.assertEqual(filters[2], {"sender": "student"})
        self.assertEqual(filters[4], {"intake": "2025/2026 Semester 1"})

    def test_required_types_staff_files_and_files_about_several_students(self):
        DocumentType.objects.filter(code="turnitin-report").update(required=True)
        report = self.made(self.ali.user, "turnitin-report", "Report")
        self.assertIn(("required", "Required"), tags(report))
        memo = self.made(self.office, "staff-document", "Memo", programmes=[AI])
        self.assertEqual(tags(memo, "programme"), [("programme", AI)])
        self.assertEqual((tags(memo, "intake"), tags(memo, "from")), ([], [("from", "PG office")]))
        joint = self.made(self.office, "evaluation-form", "Joint", students=[self.ali.matric_no, self.bella.matric_no, self.chen.matric_no])
        self.assertEqual(tags(joint, "programme"), [("programme", DS), ("programme", CS)])
        self.assertEqual(len(tags(joint, "intake")), 2)
        lecturer = self.made(self.supervisor, "evaluation-form", "Evaluation", students=[self.ali.matric_no])
        self.assertEqual(tags(lecturer, "from"), [("from", "Lecturer")])

    def test_tags_follow_a_student_who_changes_programme(self):
        made = self.made(self.ali.user, "thesis", "Thesis")
        Student.objects.filter(pk=self.ali.pk).update(programme=CS)
        self.client.force_authenticate(self.office)
        again = self.client.get(f"/api/documents/{made['id']}/").data
        self.assertEqual(tags(again, "programme"), [("programme", CS)])

    def test_each_tag_filters_the_list(self):
        self.made(self.ali.user, "thesis", "Ali thesis")
        self.made(self.supervisor, "evaluation-form", "Bella evaluation", students=[self.bella.matric_no])
        self.made(self.office, "staff-document", "AI memo", programmes=[AI])
        office = self.office
        self.assertEqual(self.titles(office, "?sender=student"), {"Ali thesis"})
        self.assertEqual(self.titles(office, "?sender=lecturer"), {"Bella evaluation"})
        self.assertEqual(self.titles(office, "?sender=office"), {"AI memo"})
        self.assertEqual(self.titles(office, "?" + urlencode({"intake": "2024/2025 semester 2"})), {"Bella evaluation"})
        self.assertEqual(self.titles(office, "?" + urlencode({"programme": AI})), {"AI memo"})
        self.assertEqual(self.titles(office, "?" + urlencode({"programme": DS})), {"Ali thesis"})
        self.assertEqual(self.titles(office, "?required=1"), set())
        DocumentType.objects.filter(code="thesis").update(required=True)
        self.assertEqual(self.titles(office, "?required=1"), {"Ali thesis"})
        self.client.force_authenticate(office)
        self.assertEqual(self.client.get("/api/documents/?sender=everyone").status_code, 400)

    def test_search_finds_programme_intake_and_category_words(self):
        self.made(self.ali.user, "thesis", "Ali thesis")
        self.made(self.office, "staff-document", "AI memo", programmes=[AI])
        office = self.office
        self.assertEqual(self.titles(office, "?q=data science"), {"Ali thesis"})
        self.assertEqual(self.titles(office, "?q=artificial"), {"AI memo"})
        self.assertEqual(self.titles(office, "?" + urlencode({"q": "2025/2026 semester 1"})), {"Ali thesis"})
        group = DocumentType.objects.get(code="thesis").get_group_display()
        self.assertIn("Ali thesis", self.titles(office, "?" + urlencode({"q": group})))

    def test_typed_tags_are_gone(self):
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.get("/api/documents/tags/").status_code, 404)
        made = self.made(self.ali.user, "thesis", "Thesis")
        self.client.force_authenticate(self.ali.user)
        response = self.client.patch(f"/api/documents/{made['id']}/", {"tags": ["draft"]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("tags", response.data)

    def test_a_student_is_told_their_own_record_for_the_upload_summary(self):
        self.client.force_authenticate(self.ali.user)
        me = self.client.get("/api/documents/options/").data["me"]
        self.assertEqual((me["programme"], me["intake"]), (DS, "2025/2026 Semester 1"))
        self.assertEqual(me["supervisors"], ["Dr Supervisor", "Dr Co"])
        self.assertEqual(me["panel"], ["Dr Panel"])
        self.assertEqual(me["coordinators"], [])
        self.client.force_authenticate(self.bella.user)
        self.assertEqual(self.client.get("/api/documents/options/").data["me"]["coordinators"], ["Prof Coordinator"])
        self.client.force_authenticate(self.office)
        self.assertNotIn("me", self.client.get("/api/documents/options/").data)

    def test_the_office_and_coordinators_see_how_many_students_are_behind(self):
        DocumentType.objects.filter(code="thesis").update(required=True)
        self.made(self.ali.user, "thesis", "Ali thesis")
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.get("/api/documents/summary/").data["studentsStillToHandIn"], 2)
        self.assertEqual(self.client.get("/api/documents/options/").data["intakes"], ["2025/2026 Semester 1", "2024/2025 Semester 2"])
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.get("/api/documents/summary/").data["studentsStillToHandIn"], 1)
        self.client.force_authenticate(self.supervisor)
        self.assertNotIn("studentsStillToHandIn", self.client.get("/api/documents/summary/").data)
