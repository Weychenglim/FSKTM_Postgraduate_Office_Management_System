"""Portal maintenance: while it is on, only PG office staff can use the portal."""
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from announcements.models import DeadlineReminderRun
from accounts.session_tokens import issue_refresh

from . import state
from .models import MaintenanceEvent

STATUS = "/api/maintenance/"
MANAGE = "/api/maintenance/manage/"
END = "/api/maintenance/manage/end/"
ME = "/api/auth/me/"
SETTINGS = "/api/auth/settings/"
LOGIN = "/api/auth/login/"
REFRESH = "/api/auth/refresh/"
LOGOUT = "/api/auth/logout/"


def later(**delta):
    return (timezone.now() + timedelta(**delta)).isoformat()


class MaintenanceTests(APITestCase):
    password = "Maintenance-pass-7731!"

    def setUp(self):
        cache.delete(state.CACHE_KEY)
        self.office = self.person("office", User.Role.OFFICE_ADMIN, "Olivia Office")
        self.student = self.person("student", User.Role.STUDENT, "Sam Student")
        self.lecturer = self.person("lecturer", User.Role.LECTURER, "Lee Lecturer")

    def tearDown(self):
        cache.set(state.CACHE_KEY, dict(state.NOTHING), None)

    def person(self, name, role, full_name):
        return User.objects.create_user(
            email=f"{name}.maintenance@example.test", password=self.password, full_name=full_name, role=role
        )

    def as_user(self, user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_refresh(user, False).access_token}")
        return client

    def change(self, **values):
        response = self.as_user(self.office).put(MANAGE, values, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        return response.data

    def problem(self, **values):
        response = self.as_user(self.office).put(MANAGE, values, format="json")
        self.assertEqual(response.status_code, 400, response.content)
        return response.data

    def sign_in(self, browser, user):
        return browser.post(LOGIN, {"identifier": user.email, "password": self.password}, format="json")

    def test_the_portal_is_open_until_the_office_starts_maintenance(self):
        response = self.client.get(STATUS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "off", "startsAt": None, "expectedEnd": None, "message": ""})
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 200)

    def test_only_office_staff_can_use_the_portal_while_it_is_on(self):
        data = self.change(message="Moving to a new server.", expectedEnd=later(hours=2))
        self.assertEqual((data["status"], data["setBy"]), ("on", "Olivia Office"))

        for person in (self.student, self.lecturer):
            response = self.as_user(person).get(SETTINGS)
            self.assertEqual(response.status_code, 503)
            body = response.json()
            self.assertEqual(body["code"], "portal_maintenance")
            self.assertEqual(body["detail"], state.USE_DETAIL)
            self.assertEqual(body["maintenance"]["message"], "Moving to a new server.")
            self.assertTrue(60 <= int(response["Retry-After"]) <= 7200)
        self.assertEqual(self.as_user(self.office).get(SETTINGS).status_code, 200)
        self.assertEqual(self.client.get(STATUS).json()["status"], "on")

    def test_requests_without_a_token_are_left_to_their_views(self):
        self.change()
        self.assertEqual(self.client.get(SETTINGS).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")
        self.assertEqual(self.client.get(SETTINGS).status_code, 503)

    def test_only_office_staff_can_sign_in(self):
        self.change()
        response = self.sign_in(APIClient(), self.student)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], state.SIGN_IN_DETAIL)
        self.assertNotIn(settings.JWT_REFRESH_COOKIE_NAME, response.cookies)
        self.student.refresh_from_db()
        self.assertIsNone(self.student.last_portal_login)
        self.assertEqual(self.sign_in(APIClient(), self.office).status_code, 200)

    def test_a_signed_in_person_keeps_their_sign_in(self):
        browser = APIClient()
        self.assertEqual(self.sign_in(browser, self.student).status_code, 200)
        self.change()

        renewed = browser.post(REFRESH, {}, format="json")
        self.assertEqual(renewed.status_code, 200, "the session is renewed, so it outlasts the maintenance")
        browser.credentials(HTTP_AUTHORIZATION=f"Bearer {renewed.data['token']}")
        self.assertEqual(browser.get(ME).status_code, 200, "the portal can still tell who is signed in")
        self.assertEqual(browser.patch(ME, {"phone": "0123456789"}, format="json").status_code, 503)
        self.assertEqual(browser.get(SETTINGS).status_code, 503)

        self.as_user(self.office).post(END)
        self.assertEqual(browser.get(SETTINGS).status_code, 200)

    def test_signing_out_still_works(self):
        browser = APIClient()
        self.sign_in(browser, self.student)
        self.change()
        self.assertEqual(browser.post(LOGOUT, {}, format="json").status_code, 200)

    def test_planned_maintenance_starts_on_time(self):
        starts = timezone.now() + timedelta(hours=1)
        data = self.change(startsAt=starts.isoformat(), expectedEnd=later(hours=3))
        self.assertEqual(data["status"], "planned")
        public = self.client.get(STATUS).json()
        self.assertEqual((public["status"], public["message"]), ("planned", state.DEFAULT_MESSAGE))
        self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 200)

        with mock.patch("django.utils.timezone.now", return_value=starts + timedelta(minutes=1)):
            self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 503)
            self.assertEqual(self.client.get(STATUS).json()["status"], "on")

    def test_times_and_message_are_checked(self):
        self.assertIn("startsAt", self.problem(startsAt=later(minutes=-5)))
        self.assertIn("startsAt", self.problem(startsAt=later(days=91)))
        self.assertEqual(
            self.problem(startsAt=later(hours=2), expectedEnd=later(hours=1))["expectedEnd"],
            "The expected end must be after the start.",
        )
        self.assertEqual(self.problem(expectedEnd=later(minutes=-1))["expectedEnd"], "The expected end must be later than now.")
        self.assertIn("expectedEnd", self.problem(expectedEnd=later(days=31)))
        self.assertIn("message", self.problem(message="x" * 501))
        self.assertFalse(MaintenanceEvent.objects.exists())

        self.change()
        self.assertIn("startsAt", self.problem(startsAt=later(hours=1)))
        self.assertEqual(self.change(message="Nearly done.", expectedEnd=later(minutes=30))["message"], "Nearly done.")

    def test_only_the_office_can_change_it(self):
        self.assertEqual(self.client.get(MANAGE).status_code, 401)
        self.assertEqual(self.client.post(END).status_code, 401)
        for person in (self.student, self.lecturer):
            client = self.as_user(person)
            self.assertEqual(client.get(MANAGE).status_code, 403)
            self.assertEqual(client.put(MANAGE, {}, format="json").status_code, 403)
            self.assertEqual(client.post(END).status_code, 403)
        self.assertEqual(self.client.get(STATUS).json()["status"], "off")

    def test_each_change_is_recorded(self):
        office = self.as_user(self.office)
        self.change(startsAt=later(hours=1))
        self.change(startsAt=later(hours=2), message="Moved to later.")
        self.assertEqual(office.post(END).data["status"], "off")
        self.change(message="Quick fix.")
        ended = office.post(END)
        self.assertEqual(ended.status_code, 200)
        self.assertEqual(office.post(END).status_code, 409)

        history = office.get(MANAGE).data["history"]
        self.assertEqual(
            [entry["action"] for entry in history],
            ["ENDED", "STARTED", "CANCELLED", "CHANGED", "PLANNED"],
        )
        self.assertEqual({entry["by"] for entry in history}, {"Olivia Office"})
        self.assertEqual(MaintenanceEvent.objects.get(action="STARTED").message, "Quick fix.")

    def test_starting_planned_maintenance_now_is_a_start(self):
        self.change(startsAt=later(hours=1))
        self.assertEqual(self.change()["status"], "on")
        self.assertEqual(MaintenanceEvent.objects.first().action, "STARTED")

    def test_password_links_wait_until_it_ends(self):
        self.change()
        reset = self.client.post("/api/auth/password-reset/", {"email": self.student.email}, format="json")
        self.assertEqual(reset.status_code, 503)
        check = self.client.post(
            "/api/auth/password-reset/confirm/", {"uid": "abc", "token": "def", "dryRun": True}, format="json"
        )
        self.assertEqual(check.status_code, 503)
        self.as_user(self.office).post(END)
        self.assertEqual(
            self.client.post("/api/auth/password-reset/", {"email": self.student.email}, format="json").status_code, 200
        )

    def test_it_stays_on_when_the_cache_is_lost(self):
        self.change()
        cache.clear()
        self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 503)

    def test_the_check_costs_no_query_once_known(self):
        state.current()
        with CaptureQueriesContext(connection) as seen:
            self.assertFalse(state.is_on())
        self.assertEqual(len(seen.captured_queries), 0)

    def test_retry_after_without_an_expected_end(self):
        self.change()
        self.assertEqual(self.as_user(self.student).get(SETTINGS)["Retry-After"], "300")

    def test_scheduled_emails_wait_until_it_ends(self):
        self.change()
        for command in ("release_announcements", "send_deadline_reminders", "send_weekly_summary"):
            out = StringIO()
            call_command(command, stdout=out)
            self.assertIn("under maintenance; skipped", out.getvalue(), command)
        self.assertFalse(DeadlineReminderRun.objects.exists())

        self.as_user(self.office).post(END)
        out = StringIO()
        call_command("release_announcements", stdout=out)
        self.assertIn("Released", out.getvalue())

    def test_the_technical_administrator_can_switch_it_from_the_command_line(self):
        out = StringIO()
        call_command("maintenance", "on", "--hours", "2", "--message", "Server move", stdout=out)
        self.assertIn("Maintenance is on.", out.getvalue())
        self.assertEqual(MaintenanceEvent.objects.get().actor_name, state.COMMAND_LINE)
        self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 503)

        call_command("maintenance", "off", stdout=StringIO())
        self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 200)
        with self.assertRaises(CommandError):
            call_command("maintenance", "off", stdout=StringIO())
        status_out = StringIO()
        call_command("maintenance", "status", stdout=status_out)
        self.assertIn("Maintenance is off.", status_out.getvalue())
