"""Registry import settings for every row, and activation emails sent later (UC04)."""

import json
from datetime import timedelta
from unittest import mock

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import RegistryImportBatch, Student, StudentRegistry, User
from .programmes import APPROVED_PROGRAMMES

DS, CS, AI = APPROVED_PROGRAMMES
IMPORT = "/api/registry/students/import/"


def csv_file(lines, name="smoke-settings.csv"):
    return SimpleUploadedFile(name, "\n".join(lines).encode("utf-8"), content_type="text/csv")


class BatchSettingsBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user(
            email="settings-office@example.test",
            password="pw-office-7401",
            full_name="Settings Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.client.force_authenticate(self.office)

    def post(self, lines, options, dry_run=False):
        data = {"file": csv_file(lines), "options": json.dumps(options)}
        if dry_run:
            data["dryRun"] = "true"
        return self.client.post(IMPORT, data, format="multipart")

    def held_import(self, count):
        lines = ["No. Matrik,Nama,Program,Emel"] + [
            f"WQD28000{index},Held {index},{DS},held{index}@example.test" for index in range(count)
        ]
        response = self.post(lines, {"sendInvites": False})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data["batch"]["id"]

    def send_later(self, batch_id):
        return self.client.post(f"/api/registry/imports/{batch_id}/send-invitations/")


class SettingsForEveryRowTests(BatchSettingsBase):
    def test_settings_fill_blank_cells_only(self):
        response = self.post(
            [
                "No. Matrik,Nama,Program,Emel,Sesi Kemasukan",
                "WQD280101,Blank Cells,,blank.cells@example.test,",
                f"WQD280102,Own Values,{CS},own.values@example.test,2025/2026 Semester II",
            ],
            {
                "defaults": {
                    "programme": DS.lower(),
                    "intake": "2026/2027 Semester I",
                    "semester": "Semester I 2026/2027",
                }
            },
            dry_run=True,
        )
        blank, own = response.data["rows"]
        self.assertEqual(
            (blank["programme"], blank["intake"], blank["semester"], blank["status"]),
            (DS, "2026/2027 Semester I", "Semester I 2026/2027", "Ready"),
        )
        self.assertEqual(
            (own["programme"], own["intake"], own["semester"]),
            (CS, "2025/2026 Semester II", "Semester I 2026/2027"),
        )

    def test_a_programme_for_every_row_replaces_a_missing_column(self):
        lines = ["No. Matrik,Nama,Emel", "WQD280201,No Programme,no.programme@example.test"]
        missing = self.post(lines, {}, dry_run=True)
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(missing.data["mapping"], ["Choose a column for: Programme."])
        response = self.post(lines, {"defaults": {"programme": AI}}, dry_run=False)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        student = Student.objects.get(matric_no="WQD280201")
        self.assertEqual(student.programme, AI)

    def test_semester_and_intake_settings_are_saved(self):
        self.post(
            ["No. Matrik,Nama,Program,Emel", f"WQD280301,Saved,{DS},saved@example.test"],
            {"defaults": {"programme": "", "intake": "2026/2027 Semester I", "semester": "Semester I 2026/2027"}},
        )
        student = Student.objects.get(matric_no="WQD280301")
        self.assertEqual(student.intake_semester, "2026/2027 Semester I")
        self.assertEqual(StudentRegistry.objects.get(student=student).current_semester, "2026/2027 Semester I")
        batch = RegistryImportBatch.objects.get()
        self.assertEqual(
            batch.settings_used,
            {
                "defaults": {"intake": "2026/2027 Semester I", "semester": "Semester I 2026/2027"},
                "programmeMap": {},
                "fillEmail": True,
                "idRule": None,
                "sendInvites": True,
            },
        )

    def test_bad_settings_are_refused(self):
        lines = ["No. Matrik,Nama,Program,Emel", f"WQD280401,Bad,{DS},bad@example.test"]
        cases = [
            ({"defaults": {"programme": "PhD"}}, "defaults", '"PhD" is not an approved programme.'),
            ({"defaults": {"intake": "x" * 40}}, "defaults", "Intake is longer than 32 characters."),
            ({"defaults": {"faculty": "FSKTM"}}, "defaults", "The settings for every row could not be read."),
            ({"sendInvites": "yes"}, "sendInvites", "Choose whether to send the activation emails now."),
        ]
        for options, field, message in cases:
            with self.subTest(options=options):
                response = self.post(lines, options, dry_run=True)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(message, response.data[field])


class HeldInvitationTests(BatchSettingsBase):
    def test_an_import_can_hold_the_activation_emails(self):
        response = self.post(
            ["No. Matrik,Nama,Program,Emel", f"WQD280501,Held One,{DS},held.one@example.test"],
            {"sendInvites": False},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 0)
        batch = response.data["batch"]
        self.assertTrue(batch["invitationsHeld"])
        self.assertIsNone(batch["invitationsSentAt"])
        self.assertEqual(
            batch["settingsUsed"],
            {"defaults": {}, "programmeMap": {}, "fillEmail": True, "idRule": None, "sendInvites": False},
        )
        self.assertEqual(response.data["rows"][0]["invitationHeld"], True)
        self.assertEqual(RegistryImportBatch.objects.get().created_students, [{"id": "WQD280501", "line": 2}])

    def test_imports_that_send_emails_are_not_held(self):
        response = self.post(["No. Matrik,Nama,Program,Emel", f"WQD280601,Sent,{DS},sent@example.test"], {})
        self.assertFalse(response.data["batch"]["invitationsHeld"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(RegistryImportBatch.objects.get().created_students, [{"id": "WQD280601", "line": 2}])

    def test_held_emails_go_only_to_students_still_waiting(self):
        batch_id = self.held_import(4)
        activated = Student.objects.get(matric_no="WQD280000").user
        activated.set_password("Activated-pass-7402!")
        activated.save()
        suspended = Student.objects.get(matric_no="WQD280001").user
        suspended.is_active = False
        suspended.save(update_fields=["is_active"])
        Student.objects.get(matric_no="WQD280003").user.delete()

        response = self.send_later(batch_id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {key: response.data[key] for key in ("sent", "failed", "alreadyActivated", "suspended", "notFound")},
            {"sent": 1, "failed": 0, "alreadyActivated": 1, "suspended": 1, "notFound": 1},
        )
        self.assertEqual([message.to for message in mail.outbox], [["held2@example.test"]])
        self.assertEqual(
            response.data["students"],
            [
                {"id": "WQD280000", "line": 2, "outcome": "alreadyActivated"},
                {"id": "WQD280001", "line": 3, "outcome": "suspended"},
                {"id": "WQD280002", "line": 4, "outcome": "sent"},
            ],
        )
        self.assertFalse(response.data["batch"]["invitationsHeld"])
        self.assertIsNotNone(response.data["batch"]["invitationsSentAt"])

    def test_emails_that_fail_later_are_recorded_on_the_import(self):
        batch_id = self.held_import(2)
        with mock.patch(
            "accounts.registry_views.send_activation_email",
            side_effect=lambda user, connection=None: user.email != "held1@example.test",
        ):
            response = self.send_later(batch_id)
        self.assertEqual((response.data["sent"], response.data["failed"]), (1, 1))
        self.assertEqual(
            [entry["outcome"] for entry in response.data["students"]], ["sent", "failed"]
        )
        self.assertEqual(response.data["batch"]["invitationsFailed"], 1)
        self.assertEqual(
            response.data["batch"]["problems"],
            [
                {
                    "line": 3,
                    "id": "WQD280001",
                    "name": "Held 1",
                    "status": "Ready",
                    "result": "created",
                    "issue": "activation email could not be sent",
                }
            ],
        )

        RegistryImportBatch.objects.filter(pk=batch_id).update(
            invitations_sent_at=timezone.now() - timedelta(minutes=5)
        )
        again = self.send_later(batch_id)
        self.assertEqual((again.data["sent"], again.data["failed"]), (2, 0))
        self.assertEqual(again.data["batch"]["problems"], [])
        self.assertEqual(again.data["batch"]["invitationsFailed"], 0)

    def test_a_second_send_straight_away_is_refused(self):
        batch_id = self.held_import(1)
        self.assertEqual(self.send_later(batch_id).status_code, status.HTTP_200_OK)
        again = self.send_later(batch_id)
        self.assertEqual(again.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(len(mail.outbox), 1)
        RegistryImportBatch.objects.filter(pk=batch_id).update(
            invitations_sent_at=timezone.now() - timedelta(minutes=5)
        )
        later = self.send_later(batch_id)
        self.assertEqual((later.status_code, later.data["sent"]), (status.HTTP_200_OK, 1))

    def test_sending_later_is_office_only_and_needs_a_real_import(self):
        batch_id = self.held_import(1)
        lecturer = User.objects.create_user(
            email="settings-lecturer@example.test",
            password="pw-lect-7403",
            full_name="Settings Lecturer",
            role=User.Role.LECTURER,
        )
        self.client.force_authenticate(lecturer)
        self.assertEqual(self.send_later(batch_id).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.office)
        self.assertEqual(self.send_later(batch_id + 999).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(REGISTRY_BATCH_INVITE_THROTTLE_RATE="1/hour")
    def test_sending_later_is_throttled_per_import(self):
        batch_id = self.held_import(1)
        other_batch = RegistryImportBatch.objects.create(file_name="other.csv", created_students=[])
        self.assertEqual(self.send_later(batch_id).status_code, status.HTTP_200_OK)
        RegistryImportBatch.objects.filter(pk=batch_id).update(
            invitations_sent_at=timezone.now() - timedelta(minutes=5)
        )
        self.assertEqual(self.send_later(batch_id).status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(self.send_later(other_batch.pk).status_code, status.HTTP_200_OK)
