"""Announcement scheduling, expiry and registry targeting (UC30)."""

import tempfile
from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Student
from accounts.programmes import APPROVED_PROGRAMMES

from .models import Announcement, Notification
from .views import release_due_announcements

User = get_user_model()
PASSWORD = "Schedule-pass-3307!"
DATA_SCIENCE, CYBER_SECURITY = APPROVED_PROGRAMMES[0], APPROVED_PROGRAMMES[1]
SEM1, SEM2 = "Semester 1 2025/2026", "Semester 2 2025/2026"


def later(**delta):
    return (timezone.now() + timedelta(**delta)).isoformat()


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class SchedulingTests(APITestCase):
    def setUp(self):
        self.office = self.user("office.sched@example.test", User.Role.OFFICE_ADMIN)
        self.lecturer = self.user("lect.sched@example.test", User.Role.LECTURER)
        self.other_lecturer = self.user("lect.other.sched@example.test", User.Role.LECTURER)
        self.ds_sem1 = self.student("ds1", DATA_SCIENCE, SEM1)
        self.ds_sem2 = self.student("ds2", DATA_SCIENCE, SEM2)
        self.cs_sem1 = self.student("cs1", CYBER_SECURITY, SEM1)
        self.quiet = self.student("quiet", DATA_SCIENCE, SEM1, announcement_alerts=False)

    def user(self, email, role, **extra):
        return User.objects.create_user(email=email, password=PASSWORD, full_name=email, role=role, **extra)

    def student(self, name, programme, intake, **extra):
        user = self.user(f"{name}.sched@example.test", User.Role.STUDENT, **extra)
        Student.objects.create(user=user, matric_no=f"SCH-{name}", programme=programme, intake_semester=intake)
        return user

    def post(self, actor, fmt="json", **fields):
        body = {"title": "Notice", "content": "Body", "target": "All Students", "priority": "Info", "status": "Active"}
        body.update(fields)
        self.client.force_authenticate(actor)
        return self.client.post("/api/announcements/", body, format=fmt)

    def created(self, actor, **fields):
        response = self.post(actor, **fields)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return Announcement.objects.get(pk=response.data["id"])

    def recipients(self, announcement):
        return set(Notification.objects.filter(announcement=announcement).values_list("recipient_id", flat=True))

    def listed_ids(self, user):
        self.client.force_authenticate(user)
        return {row["id"] for row in self.client.get("/api/announcements/").data}

    def test_a_future_publish_time_schedules_without_delivering(self):
        response = self.post(self.office, publishAt=later(hours=2))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "Scheduled")
        self.assertEqual(response.data["deliveredTo"], 0)
        notice = Announcement.objects.get(pk=response.data["id"])
        self.assertEqual(self.recipients(notice), set())
        self.assertNotIn(str(notice.pk), self.listed_ids(self.ds_sem1))
        self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/").status_code, status.HTTP_404_NOT_FOUND)

        past = self.created(self.office, publishAt=later(hours=-1))
        self.assertEqual(past.status, Announcement.Status.ACTIVE)
        self.assertIn(self.ds_sem1.pk, self.recipients(past))

    def test_a_due_notice_is_released_once(self):
        notice = self.created(self.office, publishAt=later(hours=2))
        Announcement.objects.filter(pk=notice.pk).update(publish_at=timezone.now() - timedelta(minutes=1))

        self.assertEqual(release_due_announcements(), (1, 0))
        notice.refresh_from_db()
        self.assertEqual(notice.status, Announcement.Status.ACTIVE)
        delivered = self.recipients(notice)
        self.assertEqual(delivered, {self.ds_sem1.pk, self.ds_sem2.pk, self.cs_sem1.pk})
        self.assertEqual(release_due_announcements(), (0, 0))
        self.assertEqual(Notification.objects.filter(announcement=notice).count(), 3)

    def test_the_list_endpoints_release_due_notices_on_read(self):
        notice = self.created(self.office, publishAt=later(hours=2))
        Announcement.objects.filter(pk=notice.pk).update(publish_at=timezone.now() - timedelta(minutes=1))
        self.assertIn(str(notice.pk), self.listed_ids(self.ds_sem1))

        bell = self.created(self.office, title="Bell", publishAt=later(hours=2))
        Announcement.objects.filter(pk=bell.pk).update(publish_at=timezone.now() - timedelta(minutes=1))
        self.client.force_authenticate(self.cs_sem1)
        feed = self.client.get("/api/notifications/").data
        self.assertIn(str(bell.pk), {row["announcementId"] for row in feed})

    def test_expiry_leaves_the_active_list_but_keeps_what_was_delivered(self):
        attachment = SimpleUploadedFile("brief.pdf", b"%PDF-1.4 brief", content_type="application/pdf")
        response = self.post(self.office, fmt="multipart", expiresAt=later(hours=1), attachment=attachment)
        notice = Announcement.objects.get(pk=response.data["id"])
        Announcement.objects.filter(pk=notice.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
        latecomer = self.student("late", DATA_SCIENCE, SEM1)

        self.assertNotIn(str(notice.pk), self.listed_ids(self.ds_sem1))
        notice.refresh_from_db()
        self.assertEqual(notice.status, Announcement.Status.EXPIRED)
        self.assertIn(self.ds_sem1.pk, self.recipients(notice))
        self.client.force_authenticate(self.ds_sem1)
        self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/attachment/").status_code, status.HTTP_200_OK)
        self.client.force_authenticate(latecomer)
        self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/").status_code, status.HTTP_404_NOT_FOUND)

    def test_a_window_that_passed_before_release_expires_undelivered(self):
        notice = self.created(self.office, publishAt=later(hours=1), expiresAt=later(hours=2))
        Announcement.objects.filter(pk=notice.pk).update(
            publish_at=timezone.now() - timedelta(hours=2), expires_at=timezone.now() - timedelta(hours=1)
        )
        self.assertEqual(release_due_announcements(), (0, 1))
        notice.refresh_from_db()
        self.assertEqual(notice.status, Announcement.Status.EXPIRED)
        self.assertEqual(self.recipients(notice), set())

    def test_invalid_schedules_are_refused(self):
        same_time = later(hours=3)
        cases = (
            ({"publishAt": later(hours=3), "expiresAt": later(hours=2)}, "expiresAt"),
            ({"publishAt": same_time, "expiresAt": same_time}, "expiresAt"),
            ({"expiresAt": later(hours=-1)}, "expiresAt"),
            ({"status": "Scheduled"}, "publishAt"),
        )
        for fields, field in cases:
            with self.subTest(fields=fields):
                response = self.post(self.office, **fields)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
        self.assertFalse(Announcement.objects.exists())
        draft = self.created(self.office, status="Draft", expiresAt=later(hours=-1))
        self.assertEqual(draft.status, Announcement.Status.DRAFT)

    def test_editing_a_published_notice_to_a_future_time_withdraws_it(self):
        notice = self.created(self.office)
        self.assertTrue(self.recipients(notice))
        self.client.force_authenticate(self.office)
        response = self.client.patch(f"/api/announcements/{notice.pk}/", {"publishAt": later(days=1)}, format="json")
        self.assertEqual(response.data["status"], "Scheduled")
        self.assertEqual(self.recipients(notice), set())

    def test_programme_and_intake_targeting_reaches_exactly_the_matching_students(self):
        both = self.created(self.office, targetProgrammes=[DATA_SCIENCE], targetIntakes=[SEM1])
        self.assertEqual(self.recipients(both), {self.ds_sem1.pk})
        urgent = self.created(self.office, priority="Urgent", targetProgrammes=[DATA_SCIENCE], targetIntakes=[SEM1])
        self.assertEqual(self.recipients(urgent), {self.ds_sem1.pk, self.quiet.pk})
        programme = self.created(self.office, targetProgrammes=[DATA_SCIENCE.lower()])
        self.assertEqual(programme.target_programmes, [DATA_SCIENCE])
        self.assertEqual(self.recipients(programme), {self.ds_sem1.pk, self.ds_sem2.pk})

        self.assertIn(str(both.pk), self.listed_ids(self.ds_sem1))
        self.assertNotIn(str(both.pk), self.listed_ids(self.cs_sem1))
        self.assertNotIn(str(both.pk), self.listed_ids(self.ds_sem2))
        self.client.force_authenticate(self.cs_sem1)
        self.assertEqual(self.client.get(f"/api/announcements/{both.pk}/").status_code, status.HTTP_404_NOT_FOUND)

    def test_role_only_audiences_behave_as_before(self):
        lecturers = self.created(self.office, target="Lecturers")
        self.assertEqual(self.recipients(lecturers), {self.lecturer.pk, self.other_lecturer.pk})
        everyone = self.created(self.office, target="All")
        self.assertEqual(
            self.recipients(everyone),
            {self.office.pk, self.lecturer.pk, self.other_lecturer.pk, self.ds_sem1.pk, self.ds_sem2.pk, self.cs_sem1.pk},
        )

    def test_targeting_needs_a_student_audience_and_known_programmes(self):
        response = self.post(self.office, target="Staff", targetProgrammes=[DATA_SCIENCE])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("target", response.data)
        response = self.post(self.office, targetProgrammes=["MASTER OF BASKET WEAVING"])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("targetProgrammes", response.data)
        self.assertFalse(Announcement.objects.exists())

    def test_a_multipart_form_sends_the_lists_as_json(self):
        response = self.post(
            self.office, fmt="multipart", targetProgrammes=f'["{CYBER_SECURITY}"]', targetIntakes="[]", publishAt=""
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["targetProgrammes"], [CYBER_SECURITY])
        self.assertEqual(response.data["publishAt"], None)
        self.assertEqual(self.recipients(Announcement.objects.get(pk=response.data["id"])), {self.cs_sem1.pk})

    def test_a_scheduled_notice_stays_with_the_office_until_it_publishes(self):
        self.client.force_authenticate(self.office)
        response = self.client.post(
            "/api/announcements/",
            {"title": "Later", "content": "Body", "target": "Lecturers", "publishAt": later(hours=3)},
            format="json",
        )
        pk = response.data["id"]
        self.assertIn(pk, self.listed_ids(self.office))
        self.assertNotIn(pk, self.listed_ids(self.lecturer))
        self.assertNotIn(pk, self.listed_ids(self.other_lecturer))

    def test_recipient_count_matches_delivery_and_is_for_senders(self):
        self.client.force_authenticate(self.office)
        count = lambda **params: self.client.get("/api/announcements/recipient-count/", params).data["recipients"]
        self.assertEqual(count(target="All Students", programmes=DATA_SCIENCE), 2)
        self.assertEqual(count(target="All Students", programmes=DATA_SCIENCE, priority="Urgent"), 3)
        self.assertEqual(count(target="All Students", programmes=DATA_SCIENCE, intakes=SEM2), 1)
        self.assertEqual(count(target="Lecturers"), 2)
        response = self.client.get("/api/announcements/recipient-count/", {"target": "Staff", "intakes": SEM1})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(self.ds_sem1)
        self.assertEqual(
            self.client.get("/api/announcements/recipient-count/").status_code, status.HTTP_403_FORBIDDEN
        )

    def test_audience_options_list_programmes_and_intakes_for_senders(self):
        self.client.force_authenticate(self.office)
        options = self.client.get("/api/announcements/audience-options/").data
        self.assertEqual(options["scope"], "office")
        self.assertEqual(options["programmes"], APPROVED_PROGRAMMES)
        self.assertEqual(options["intakes"], [SEM1, SEM2])
        self.client.force_authenticate(self.ds_sem1)
        self.assertEqual(
            self.client.get("/api/announcements/audience-options/").status_code, status.HTTP_403_FORBIDDEN
        )

    def test_the_release_command_can_run_twice(self):
        notice = self.created(self.office, publishAt=later(hours=2))
        Announcement.objects.filter(pk=notice.pk).update(publish_at=timezone.now() - timedelta(minutes=1))
        first, second = StringIO(), StringIO()
        call_command("release_announcements", stdout=first)
        call_command("release_announcements", stdout=second)
        self.assertIn("Released 1 scheduled announcement(s); expired 0.", first.getvalue())
        self.assertIn("Released 0 scheduled announcement(s); expired 0.", second.getvalue())
        self.assertEqual(Notification.objects.filter(announcement=notice).count(), 3)
