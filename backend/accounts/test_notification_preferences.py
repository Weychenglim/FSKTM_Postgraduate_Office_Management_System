"""The three notification switches added to Settings (Phase 8, UC33)."""

from rest_framework.test import APITestCase

from .models import User


class NotificationPreferenceSettingsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="prefs@example.test", password="Prefs-pass-5518!", full_name="Prefs")
        self.client.force_authenticate(self.user)

    def test_defaults_are_email_on_reminders_on_summary_off(self):
        data = self.client.get("/api/auth/settings/").data
        self.assertEqual(
            data["preferences"],
            {"announcementAlerts": True, "emailNotifications": True, "deadlineReminders": True, "weeklySummary": False},
        )
        self.assertTrue(all(data["capabilities"].values()))

    def test_each_switch_saves_on_its_own(self):
        self.assertEqual(
            self.client.patch("/api/auth/settings/", {"preferences": {"emailNotifications": False}}, format="json").status_code,
            200,
        )
        self.client.patch("/api/auth/settings/", {"preferences": {"weeklySummary": True, "deadlineReminders": False}}, format="json")
        self.user.refresh_from_db()
        self.assertEqual(
            (self.user.announcement_alerts, self.user.email_notifications, self.user.deadline_reminders, self.user.weekly_summary),
            (True, False, False, True),
        )

    def test_bad_values_change_nothing(self):
        for payload in (
            {"preferences": {"emailNotifications": "true"}},
            {"preferences": {"weeklySummary": None}},
            {"preferences": {}},
            {"preferences": {"emailNotifications": True, "smsAlerts": True}},
        ):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.patch("/api/auth/settings/", payload, format="json").status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_notifications)
