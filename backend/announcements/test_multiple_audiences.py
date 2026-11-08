"""An announcement can go to several groups at once."""

import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Student
from accounts.programmes import APPROVED_PROGRAMMES

from .models import Announcement, Notification
from .views import deliver_missed_announcements

User = get_user_model()
PASSWORD = "Audience-pass-3307!"
DATA_SCIENCE, CYBER_SECURITY = APPROVED_PROGRAMMES[0], APPROVED_PROGRAMMES[1]
SEM1, SEM2 = "Semester 1 2025/2026", "Semester 2 2025/2026"
BOTH = ["All Students", "Lecturers"]


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class MultipleAudienceTests(APITestCase):
    def setUp(self):
        self.office = self.user("office.aud@example.test", User.Role.OFFICE_ADMIN)
        self.lecturer = self.user("lect.aud@example.test", User.Role.LECTURER)
        self.coordinator = self.user("coord.aud@example.test", User.Role.COORDINATOR)
        self.ds = self.student("ds", DATA_SCIENCE, SEM1)
        self.cs = self.student("cs", CYBER_SECURITY, SEM2)

    def user(self, email, role, **extra):
        return User.objects.create_user(email=email, password=PASSWORD, full_name=email, role=role, **extra)

    def student(self, name, programme, intake):
        user = self.user(f"{name}.aud@example.test", User.Role.STUDENT)
        Student.objects.create(user=user, matric_no=f"AUD-{name}", programme=programme, intake_semester=intake)
        return user

    def post(self, fmt="json", **fields):
        body = {"title": "Notice", "content": "Body", "priority": "Urgent", "status": "Active"}
        body.update(fields)
        self.client.force_authenticate(self.office)
        return self.client.post("/api/announcements/", body, format=fmt)

    def created(self, **fields):
        response = self.post(**fields)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return Announcement.objects.get(pk=response.data["id"])

    def recipients(self, announcement):
        return set(Notification.objects.filter(announcement=announcement).values_list("recipient_id", flat=True))

    def listed_ids(self, user):
        self.client.force_authenticate(user)
        return {row["id"] for row in self.client.get("/api/announcements/").data}

    def count(self, **params):
        self.client.force_authenticate(self.office)
        return self.client.get("/api/announcements/recipient-count/", {"priority": "Urgent", **params})

    def test_it_reaches_every_chosen_group_and_nobody_else(self):
        notice = self.created(audiences=BOTH)
        self.assertEqual(notice.target, "All Students")
        self.assertEqual(notice.also_targets, ["Lecturers"])
        self.assertEqual(self.recipients(notice), {self.ds.pk, self.cs.pk, self.lecturer.pk})

    def test_the_list_and_the_detail_follow_the_audiences(self):
        notice = self.created(audiences=BOTH)
        self.assertIn(str(notice.pk), self.listed_ids(self.lecturer))
        self.assertIn(str(notice.pk), self.listed_ids(self.ds))
        self.assertNotIn(str(notice.pk), self.listed_ids(self.coordinator))
        for user, expected in ((self.lecturer, 200), (self.ds, 200), (self.coordinator, 404)):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/").status_code, expected)

    def test_programme_and_intake_narrow_the_students_only(self):
        notice = self.created(audiences=BOTH, targetProgrammes=[DATA_SCIENCE], targetIntakes=[SEM1])
        self.assertEqual(self.recipients(notice), {self.ds.pk, self.lecturer.pk})
        self.assertIn(str(notice.pk), self.listed_ids(self.lecturer))
        self.assertIn(str(notice.pk), self.listed_ids(self.ds))
        self.assertNotIn(str(notice.pk), self.listed_ids(self.cs))
        self.client.force_authenticate(self.cs)
        self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/").status_code, 404)

    def test_narrowing_needs_students_in_the_audience(self):
        response = self.post(audiences=["Lecturers", "Staff"], targetProgrammes=[DATA_SCIENCE])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("target", response.data)

    def test_everyone_stands_alone(self):
        notice = self.created(audiences=["All", "Lecturers"])
        self.assertEqual(notice.audiences, ["All"])
        self.assertEqual(self.recipients(notice), {self.office.pk, self.lecturer.pk, self.coordinator.pk, self.ds.pk, self.cs.pk})

    def test_an_unknown_audience_is_refused(self):
        response = self.post(audiences=["Lecturers", "Parents"])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("audiences", response.data)

    def test_a_multipart_form_sends_the_list_as_json(self):
        notice = self.created(fmt="multipart", audiences='["All Students", "Coordinators"]', target="All Students")
        self.assertEqual(notice.audiences, ["All Students", "Coordinators"])
        self.assertEqual(self.recipients(notice), {self.ds.pk, self.cs.pk, self.coordinator.pk})

    def test_only_a_target_still_works_and_clears_older_groups(self):
        notice = self.created(target="Lecturers")
        self.assertEqual(notice.audiences, ["Lecturers"])
        multi = self.created(audiences=BOTH)
        self.client.force_authenticate(self.office)
        response = self.client.patch(f"/api/announcements/{multi.pk}/", {"target": "Staff"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["audiences"], ["Staff"])

    def test_adding_a_group_to_a_published_notice_delivers_to_it(self):
        notice = self.created(audiences=["Lecturers"])
        self.client.force_authenticate(self.office)
        response = self.client.patch(f"/api/announcements/{notice.pk}/", {"audiences": ["Lecturers", "Coordinators"]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(self.recipients(notice), {self.lecturer.pk, self.coordinator.pk})

    def test_someone_who_joins_later_gets_it_when_in_a_further_group(self):
        notice = self.created(audiences=["Staff", "Lecturers"])
        late = self.user("late.aud@example.test", User.Role.LECTURER)
        self.assertEqual(deliver_missed_announcements(late), 1)
        self.assertIn(late.pk, self.recipients(notice))

    def test_the_preview_counts_people_once_across_groups(self):
        self.assertEqual(self.count(audiences=BOTH).data["recipients"], 3)
        self.assertEqual(self.count(audiences=BOTH, programmes=[DATA_SCIENCE]).data["recipients"], 2)
        self.assertEqual(self.count(target="Lecturers").data["recipients"], 1)
        self.assertEqual(self.count(audiences=["Lecturers"], programmes=[DATA_SCIENCE]).status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_response_lists_the_audiences(self):
        response = self.post(audiences=BOTH)
        self.assertEqual(response.data["target"], "All Students")
        self.assertEqual(response.data["audiences"], BOTH)
