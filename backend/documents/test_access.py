from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordinatorDelegation
from appointments.models import CoSupervisorAppointment, PanelAppointment

from .fixtures import AI, CS, TEST_MEDIA, DocumentPeople, image_bytes, pdf_bytes, upload


class DocumentClient:
    def send(self, user, doc_type, name="file.pdf", content=None, **fields):
        self.client.force_authenticate(user)
        data = {"type": doc_type, "file": upload(name, content if content is not None else pdf_bytes()), **fields}
        return self.client.post("/api/documents/", data, format="multipart")

    def made(self, user, doc_type, title, **fields):
        response = self.send(user, doc_type, title=title, **fields)
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def titles(self, user, query=""):
        self.client.force_authenticate(user)
        response = self.client.get(f"/api/documents/{query}")
        self.assertEqual(response.status_code, 200, response.data)
        return {row["title"] for row in response.data["results"]}


@TEST_MEDIA
class WhoSeesWhatTests(DocumentPeople, DocumentClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()

    def setUp(self):
        cache.clear()
        self.thesis = self.made(self.ali.user, "final-research-report", "Ali thesis")
        self.letter = self.made(self.ali.user, "supporting-document", "Ali medical letter", name="letter.png", content=image_bytes("PNG"))
        self.evaluation = self.made(
            self.supervisor, "supporting-document", "Joint evaluation",
            students=[self.ali.matric_no, self.bella.matric_no],
        )
        self.everyone = self.made(self.coordinator, "staff-document", "Rubric for all")
        self.cs_coordinators = self.made(self.office, "staff-document", "CS coordinators memo", audience="COORDINATORS", programmes=[CS])
        self.ai_lecturers = self.made(self.office, "staff-document", "AI lecturers memo", programmes=[AI])
        self.private = self.made(self.supervisor, "staff-document", "Supervisor note to office", audience="OFFICE")

    def test_each_person_sees_only_what_their_relationships_allow(self):
        all_titles = {
            "Ali thesis", "Ali medical letter", "Joint evaluation", "Rubric for all",
            "CS coordinators memo", "AI lecturers memo", "Supervisor note to office",
        }
        self.assertEqual(self.titles(self.office), all_titles)
        self.assertEqual(self.titles(self.ali.user), {"Ali thesis", "Ali medical letter"})
        self.assertEqual(self.titles(self.bella.user), set())
        self.assertEqual(
            self.titles(self.supervisor),
            {"Ali thesis", "Ali medical letter", "Joint evaluation", "Rubric for all", "Supervisor note to office"},
        )
        self.assertEqual(self.titles(self.co_supervisor), {"Ali thesis", "Ali medical letter", "Joint evaluation", "Rubric for all"})
        self.assertEqual(self.titles(self.panel), {"Ali thesis", "Rubric for all"})
        self.assertEqual(self.titles(self.coordinator), {"Joint evaluation", "Rubric for all", "CS coordinators memo"})
        self.assertEqual(self.titles(self.outsider), {"Rubric for all"})

    def test_a_hidden_file_answers_like_a_missing_one(self):
        self.client.force_authenticate(self.outsider)
        for path in (f"/api/documents/{self.thesis['id']}/", f"/api/documents/{self.thesis['id']}/download/", "/api/documents/999999/"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.data["detail"], "This file isn't available to you.")

    def test_ended_appointments_stop_access_but_uploads_stay_visible(self):
        CoSupervisorAppointment.objects.filter(supervisor=self.co_supervisor).update(
            status=CoSupervisorAppointment.Status.ENDED, ended_at=timezone.now()
        )
        self.assertEqual(self.titles(self.co_supervisor), {"Rubric for all"})
        mine = self.made(self.panel, "supporting-document", "Panel own upload", students=[self.ali.matric_no])
        PanelAppointment.objects.filter(panel_member=self.panel).update(status=PanelAppointment.Status.ENDED)
        self.assertEqual(self.titles(self.panel), {"Rubric for all", mine["title"]})

    def test_panel_access_through_a_matric_only_profile(self):
        self.give_panel(self.chen, self.outsider, linked=False)
        self.made(self.chen.user, "final-research-report", "Chen thesis")
        self.assertIn("Chen thesis", self.titles(self.outsider))

    def test_acting_coordinators_see_while_the_delegation_lasts(self):
        today = timezone.localdate()
        self.made(self.chen.user, "final-research-report", "Chen thesis")
        CoordinatorDelegation.objects.create(
            coordinator=self.coordinator, programme=self.chen.programme, starts_on=today - timedelta(days=5),
            ends_on=today - timedelta(days=1), justification="Old cover", granted_by=self.office,
        )
        self.assertNotIn("Chen thesis", self.titles(self.coordinator))
        CoordinatorDelegation.objects.create(
            coordinator=self.coordinator, programme=self.chen.programme, starts_on=today, ends_on=today,
            justification="Cover", granted_by=self.office,
        )
        self.assertIn("Chen thesis", self.titles(self.coordinator))

    def test_shared_with_names_the_people(self):
        self.client.force_authenticate(self.office)
        detail = self.client.get(f"/api/documents/{self.thesis['id']}/").data
        self.assertEqual(
            {(person["name"], person["role"]) for person in detail["sharedWith"]},
            {("PG office", "always"), ("Dr Supervisor", "supervisor"), ("Dr Co", "co-supervisor"), ("Dr Panel", "panel member")},
        )
        letter = self.client.get(f"/api/documents/{self.letter['id']}/").data
        self.assertEqual(
            {(person["name"], person["role"]) for person in letter["sharedWith"]},
            {("PG office", "always"), ("Dr Supervisor", "supervisor"), ("Dr Co", "co-supervisor")},
        )
        rubric = self.client.get(f"/api/documents/{self.everyone['id']}/").data
        self.assertEqual(rubric["sharedWith"][1]["name"], "All lecturers and coordinators")
