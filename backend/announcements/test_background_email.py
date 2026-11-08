from types import SimpleNamespace
from unittest import mock

from django.core import mail
from django.test import SimpleTestCase, override_settings

from announcements.emails import LETTER, SMTP_BACKEND, email_users

ALI = SimpleNamespace(is_active=True, email="ali@example.test", email_notifications=True)
OFF = SimpleNamespace(is_active=True, email="off@example.test", email_notifications=False)


class BackgroundEmailTests(SimpleTestCase):
    @override_settings(EMAIL_BACKEND=SMTP_BACKEND)
    def test_a_page_hands_real_mail_to_a_background_send(self):
        with mock.patch("announcements.emails.threading.Thread") as thread, \
                mock.patch("announcements.emails.send_mass_mail") as send:
            self.assertEqual(email_users([ALI, OFF], LETTER, "Your letter", "Ready.", wait=False), 1)
        send.assert_not_called()
        thread.return_value.start.assert_called_once()
        messages = thread.call_args.kwargs["args"][0]
        self.assertEqual([message[3] for message in messages], [["ali@example.test"]])

    @override_settings(EMAIL_BACKEND=SMTP_BACKEND)
    def test_scheduled_commands_still_wait_for_the_count(self):
        with mock.patch("announcements.emails.threading.Thread") as thread, \
                mock.patch("announcements.emails.send_mass_mail", return_value=1) as send:
            self.assertEqual(email_users([ALI], LETTER, "Your letter", "Ready."), 1)
        thread.assert_not_called()
        send.assert_called_once()

    def test_other_backends_send_straight_away(self):
        with mock.patch("announcements.emails.threading.Thread") as thread:
            self.assertEqual(email_users([ALI], LETTER, "Your letter", "Ready.", wait=False), 1)
        thread.assert_not_called()
        self.assertEqual(mail.outbox[0].to, ["ali@example.test"])
