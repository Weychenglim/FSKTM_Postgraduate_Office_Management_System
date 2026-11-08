"""Announcement and notification fixes from the October 2026 review: reading
follows the audience, delivery follows every edit, files follow their
announcement, and the feed stays cheap."""

import datetime
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from letters.models import LetterTemplate

from .models import Announcement, Notification

User = get_user_model()
PASSWORD = "Announce-pass-5520!"


def pdf(name):
    return SimpleUploadedFile(name, b"%PDF-1.4 review fixture", content_type="application/pdf")


class AnnouncementReviewBase(APITestCase):
    def setUp(self):
        def user(email, role, **extra):
            return User.objects.create_user(
                email=email, password=PASSWORD, full_name=email.split("@")[0], role=role, **extra
            )

        self.office = user("office.ann@example.test", User.Role.OFFICE_ADMIN)
        self.author = user("lect.author@example.test", User.Role.LECTURER)
        self.other_lecturer = user("lect.other@example.test", User.Role.LECTURER)
        self.coordinator = user("coord.ann@example.test", User.Role.COORDINATOR)
        self.student = user("student.ann@example.test", User.Role.STUDENT)
        self.quiet_student = user("student.quiet@example.test", User.Role.STUDENT, announcement_alerts=False)

    def publish(self, actor, **fields):
        body = {"title": "Notice", "content": "Body", "target": "All", "priority": "Info", "status": "Active"}
        body.update(fields)
        self.client.force_authenticate(actor)
        response = self.client.post("/api/announcements/", body, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return Announcement.objects.get(pk=response.data["id"])

    def patch(self, actor, announcement, body, fmt="json"):
        self.client.force_authenticate(actor)
        return self.client.patch(f"/api/announcements/{announcement.pk}/", body, format=fmt)

    def recipients(self, announcement):
        return set(Notification.objects.filter(announcement=announcement).values_list("recipient_id", flat=True))


class AudienceReadingTests(AnnouncementReviewBase):
    def test_a_sender_outside_the_audience_cannot_read_or_download(self):
        notice = self.publish(self.office, target="Coordinators", attachment=pdf("coord.pdf"))
        self.client.force_authenticate(self.other_lecturer)
        self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.get(f"/api/announcements/{notice.pk}/attachment/").status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertNotIn(str(notice.pk), [a["id"] for a in self.client.get("/api/announcements/").data])
        for reader in (self.coordinator, self.office):
            self.client.force_authenticate(reader)
            self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/").status_code, status.HTTP_200_OK)

    def authored(self, target):
        # Lecturers now send only to their own students, so an older notice is made directly.
        return Announcement.objects.create(
            title="Notice", content="Body", target=target, status=Announcement.Status.ACTIVE,
            created_by=self.author, created_by_name=self.author.full_name,
        )

    def test_an_author_still_reads_their_own_notice_for_another_audience(self):
        notice = self.authored("Staff")
        self.client.force_authenticate(self.author)
        self.assertEqual(self.client.get(f"/api/announcements/{notice.pk}/").status_code, status.HTTP_200_OK)

    def test_the_payload_says_who_may_manage_it(self):
        notice = self.authored("Lecturers")
        expectations ={self.author: True, self.other_lecturer: False, self.office: True}
        for reader, can_manage in expectations.items():
            self.client.force_authenticate(reader)
            payload = self.client.get(f"/api/announcements/{notice.pk}/").data
            self.assertEqual(payload["canManage"], can_manage, reader.email)
            self.assertEqual(payload["createdById"], str(self.author.pk))


class DeliverySyncTests(AnnouncementReviewBase):
    def test_an_expired_round_trip_with_a_new_audience_does_not_leak(self):
        notice = self.publish(self.office, target="All Students")
        self.assertIn(self.student.pk, self.recipients(notice))
        self.patch(self.office, notice, {"status": "Expired"})
        self.patch(self.office, notice, {"status": "Active", "target": "Staff", "content": "staff only v2"})
        self.patch(self.office, notice, {"content": "staff only v3 secret"})
        self.assertEqual(self.recipients(notice), {self.office.pk})
        self.assertFalse(Notification.objects.filter(recipient=self.student, message__contains="secret").exists())

    def test_an_upgrade_to_urgent_reaches_people_who_turned_alerts_off(self):
        notice = self.publish(self.office, target="All Students")
        self.assertNotIn(self.quiet_student.pk, self.recipients(notice))
        self.patch(self.office, notice, {"priority": "Urgent"})
        self.assertIn(self.quiet_student.pk, self.recipients(notice))

    def test_scheduled_withdraws_delivery_but_expired_keeps_history(self):
        notice = self.publish(self.office, target="All Students")
        tomorrow = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).isoformat()
        self.patch(self.office, notice, {"status": "Scheduled", "publishAt": tomorrow})
        self.assertEqual(self.recipients(notice), set())
        self.patch(self.office, notice, {"status": "Active", "publishAt": None})
        self.assertIn(self.student.pk, self.recipients(notice))
        self.patch(self.office, notice, {"status": "Expired"})
        self.assertIn(self.student.pk, self.recipients(notice))

    def test_a_retarget_keeps_read_state_for_people_still_in_the_audience(self):
        notice = self.publish(self.office, target="All")
        Notification.objects.filter(announcement=notice, recipient=self.student).update(is_read=True)
        self.patch(self.office, notice, {"target": "All Students"})
        self.assertTrue(Notification.objects.get(announcement=notice, recipient=self.student).is_read)
        self.assertNotIn(self.author.pk, self.recipients(notice))

    def test_a_very_long_author_name_still_delivers(self):
        long_named = User.objects.create_user(
            email="long.name@example.test", password=PASSWORD, full_name="N" * 250, role=User.Role.OFFICE_ADMIN
        )
        notice = self.publish(long_named, target="All Students")
        services = Notification.objects.filter(announcement=notice).values_list("service", flat=True)
        self.assertTrue(services)
        self.assertTrue(all(len(service) <= 128 for service in services))


class AttachmentFileTests(AnnouncementReviewBase):
    def setUp(self):
        super().setUp()
        media = tempfile.TemporaryDirectory(prefix="fsktm-test-media-")
        self.addCleanup(media.cleanup)
        self.enterContext(override_settings(MEDIA_ROOT=media.name))

    def test_replaced_removed_and_deleted_files_leave_storage(self):
        with self.captureOnCommitCallbacks(execute=True):
            notice = self.publish(self.office, attachment=pdf("first.pdf"))
        first = notice.attachment.name
        with self.captureOnCommitCallbacks(execute=True):
            self.patch(self.office, notice, {"attachment": pdf("second.pdf")}, fmt="multipart")
        notice.refresh_from_db()
        second = notice.attachment.name
        self.assertFalse(default_storage.exists(first))
        self.assertTrue(default_storage.exists(second))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.patch(self.office, notice, {"removeAttachment": "true"}, fmt="multipart")
        self.assertIsNone(response.data["attachmentName"])
        self.assertFalse(default_storage.exists(second))

        with self.captureOnCommitCallbacks(execute=True):
            self.patch(self.office, notice, {"attachment": pdf("third.pdf")}, fmt="multipart")
        notice.refresh_from_db()
        third = notice.attachment.name
        with self.captureOnCommitCallbacks(execute=True):
            self.client.delete(f"/api/announcements/{notice.pk}/")
        self.assertFalse(default_storage.exists(third))


class NotificationFeedTests(AnnouncementReviewBase):
    def test_mark_read_reads_booleans_strictly(self):
        notice = self.publish(self.office, target="All Students")
        row = Notification.objects.get(announcement=notice, recipient=self.student)
        self.client.force_authenticate(self.student)
        response = self.client.post(f"/api/notifications/{row.pk}/read/", {"isRead": "false"}, format="json")
        self.assertTrue(response.data["isUnread"])
        response = self.client.post(f"/api/notifications/{row.pk}/read/", {"isRead": "maybe"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_feed_is_one_query_however_long_it_is(self):
        for total in (1, 7):
            while Notification.objects.filter(recipient=self.student).count() < total:
                self.publish(self.office, target="All Students", title=f"Notice {total}")
            self.client.force_authenticate(User.objects.get(pk=self.student.pk))
            # Due scheduled announcements, the student's programme, live ones
            # this student missed, then the feed: the same four for any length.
            with self.assertNumQueries(4):
                response = self.client.get("/api/notifications/")
            self.assertEqual(len(response.data), total)


class LetterTemplateReviewTests(APITestCase):
    def setUp(self):
        self.office = User.objects.create_user(
            email="office.letters@example.test", password=PASSWORD, role=User.Role.OFFICE_ADMIN
        )
        self.client.force_authenticate(self.office)

    def test_single_and_triple_braces_are_malformed(self):
        for content, fragment in (
            ("Dear {STUDENT_NAME}, welcome", "{STUDENT_NAME}"),
            ("Dear {{{STUDENT_NAME}}}", "{{{STUDENT_NAME}}}"),
        ):
            with self.subTest(content=content):
                response = self.client.post(
                    "/api/letter-templates/", {"name": "Braces", "content": content}, format="json"
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(fragment, response.data["malformedPlaceholders"])

    def test_last_modified_uses_malaysia_dates(self):
        template = LetterTemplate.objects.create(name="Late edit", content="Dear {{STUDENT_NAME}}")
        late_utc = datetime.datetime(2026, 1, 1, 20, 30, tzinfo=datetime.timezone.utc)
        LetterTemplate.objects.filter(pk=template.pk).update(updated_at=late_utc)
        template.refresh_from_db()
        self.assertEqual(template.to_public_dict()["lastModified"], "Jan 02, 2026")
