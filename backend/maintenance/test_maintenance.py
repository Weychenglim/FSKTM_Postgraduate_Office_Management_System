"""Portal maintenance: switched in Django admin by the technical administrator;
while it is on, nobody can sign in or use the portal."""
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
from accounts.session_tokens import issue_refresh
from announcements.models import DeadlineReminderRun

from . import state
from .models import MaintenanceEvent

STATUS = "/api/maintenance/"
ME = "/api/auth/me/"
SETTINGS = "/api/auth/settings/"
LOGIN = "/api/auth/login/"
REFRESH = "/api/auth/refresh/"
LOGOUT = "/api/auth/logout/"
ADMIN_PAGE = "/admin/maintenance/portalmaintenance/1/change/"


def later(**delta):
    return timezone.now() + timedelta(**delta)


def admin_time(value):
    local = timezone.localtime(value)
    return {"0": local.strftime("%Y-%m-%d"), "1": local.strftime("%H:%M")}


class MaintenanceCase(APITestCase):
    password = "Maintenance-pass-7731!"

    def setUp(self):
        cache.delete(state.CACHE_KEY)
        self.office = self.person("office", User.Role.OFFICE_ADMIN, "Olivia Office")
        self.student = self.person("student", User.Role.STUDENT, "Sam Student")
        self.lecturer = self.person("lecturer", User.Role.LECTURER, "Lee Lecturer")
        self.tech = User.objects.create_superuser(email="tech.maintenance@example.test", password=self.password, full_name="Tia Technical")

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

    def sign_in(self, browser, user):
        return browser.post(LOGIN, {"identifier": user.email, "password": self.password}, format="json")


class PortalTests(MaintenanceCase):
    def test_the_portal_is_open_until_maintenance_starts(self):
        response = self.client.get(STATUS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "off", "startsAt": None, "expectedEnd": None, "message": ""})
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 200)

    def test_nobody_can_use_the_portal_while_it_is_on(self):
        state.change(self.tech, message="Moving to a new server.", expected_end=later(hours=2))
        for person in (self.student, self.lecturer, self.office):
            response = self.as_user(person).get(SETTINGS)
            self.assertEqual(response.status_code, 503, person.role)
            body = response.json()
            self.assertEqual((body["code"], body["detail"]), ("portal_maintenance", state.DETAIL))
            self.assertEqual(body["maintenance"]["message"], "Moving to a new server.")
            self.assertTrue(60 <= int(response["Retry-After"]) <= 7200)
        public = self.client.get(STATUS).json()
        self.assertEqual((public["status"], public["message"]), ("on", "Moving to a new server."))

    def test_nobody_can_sign_in(self):
        state.change(self.tech)
        for person in (self.student, self.office):
            response = self.sign_in(APIClient(), person)
            self.assertEqual(response.status_code, 503, person.role)
            self.assertNotIn(settings.JWT_REFRESH_COOKIE_NAME, response.cookies)
            person.refresh_from_db()
            self.assertIsNone(person.last_portal_login)
        wrong = APIClient().post(LOGIN, {"identifier": self.student.email, "password": "not-it"}, format="json")
        self.assertEqual(wrong.status_code, 503, "a wrong password tells nothing during maintenance")
        self.assertEqual(APIClient().post(LOGIN, {}, format="json").status_code, 400)

    def test_a_signed_in_person_keeps_their_sign_in(self):
        for person in (self.student, self.office):
            browser = APIClient()
            self.assertEqual(self.sign_in(browser, person).status_code, 200)
            state.change(self.tech)

            renewed = browser.post(REFRESH, {}, format="json")
            self.assertEqual(renewed.status_code, 200, "the session is renewed, so it outlasts the maintenance")
            browser.credentials(HTTP_AUTHORIZATION=f"Bearer {renewed.data['token']}")
            self.assertEqual(browser.get(ME).status_code, 200, "the portal can still tell who is signed in")
            self.assertEqual(browser.patch(ME, {"phone": "0123456789"}, format="json").status_code, 503)
            self.assertEqual(browser.get(SETTINGS).status_code, 503)

            state.end(self.tech)
            self.assertEqual(browser.get(SETTINGS).status_code, 200)

    def test_signing_out_still_works(self):
        browser = APIClient()
        self.sign_in(browser, self.student)
        state.change(self.tech)
        self.assertEqual(browser.post(LOGOUT, {}, format="json").status_code, 200)

    def test_requests_without_a_token_are_left_to_their_views(self):
        state.change(self.tech)
        self.assertEqual(self.client.get(SETTINGS).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")
        self.assertEqual(self.client.get(SETTINGS).status_code, 503)

    def test_planned_maintenance_starts_on_time(self):
        starts = later(hours=1)
        self.assertEqual(state.change(self.tech, starts_at=starts, expected_end=later(hours=3)), MaintenanceEvent.Action.PLANNED)
        public = self.client.get(STATUS).json()
        self.assertEqual((public["status"], public["message"]), ("planned", state.DEFAULT_MESSAGE))
        self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 200)

        with mock.patch("django.utils.timezone.now", return_value=starts + timedelta(minutes=1)):
            self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 503)
            self.assertEqual(self.client.get(STATUS).json()["status"], "on")

    def test_password_links_wait_until_it_ends(self):
        state.change(self.tech)
        reset = self.client.post("/api/auth/password-reset/", {"email": self.student.email}, format="json")
        self.assertEqual(reset.status_code, 503)
        check = self.client.post(
            "/api/auth/password-reset/confirm/", {"uid": "abc", "token": "def", "dryRun": True}, format="json"
        )
        self.assertEqual(check.status_code, 503)
        state.end(self.tech)
        self.assertEqual(
            self.client.post("/api/auth/password-reset/", {"email": self.student.email}, format="json").status_code, 200
        )

    def test_it_stays_on_when_the_cache_is_lost(self):
        state.change(self.tech)
        cache.clear()
        self.assertEqual(self.as_user(self.student).get(SETTINGS).status_code, 503)

    def test_the_check_costs_no_query_once_known(self):
        state.current()
        with CaptureQueriesContext(connection) as seen:
            self.assertFalse(state.is_on())
        self.assertEqual(len(seen.captured_queries), 0)

    def test_retry_after_without_an_expected_end(self):
        state.change(self.tech)
        self.assertEqual(self.as_user(self.student).get(SETTINGS)["Retry-After"], "300")

    def test_the_office_has_no_switch_in_the_portal(self):
        office = self.as_user(self.office)
        self.assertEqual(office.get("/api/maintenance/manage/").status_code, 404)
        self.assertEqual(office.post("/api/maintenance/manage/end/").status_code, 404)

    def test_scheduled_emails_wait_until_it_ends(self):
        state.change(self.tech)
        for command in ("release_announcements", "send_deadline_reminders", "send_weekly_summary"):
            out = StringIO()
            call_command(command, stdout=out)
            self.assertIn("under maintenance; skipped", out.getvalue(), command)
        self.assertFalse(DeadlineReminderRun.objects.exists())

        state.end(self.tech)
        out = StringIO()
        call_command("release_announcements", stdout=out)
        self.assertIn("Released", out.getvalue())

    def test_the_command_line_switch(self):
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


class DjangoAdminTests(MaintenanceCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.tech)

    def post(self, when, starts_at=None, expected_end=None, message=""):
        data = {"when": when, "message": message}
        for name, value in (("starts_at", starts_at), ("expected_end", expected_end)):
            parts = admin_time(value) if value else {"0": "", "1": ""}
            data[f"{name}_0"], data[f"{name}_1"] = parts["0"], parts["1"]
        return self.client.post(ADMIN_PAGE, data)

    def test_the_technical_administrator_switches_it_on_and_off(self):
        listing = self.client.get("/admin/maintenance/portalmaintenance/")
        self.assertRedirects(listing, ADMIN_PAGE)
        page = self.client.get(ADMIN_PAGE)
        self.assertContains(page, "Off. Everyone can use the portal.")
        self.assertNotContains(page, "Save and add another")

        response = self.post("now", expected_end=later(hours=2), message="Moving to a new server.")
        self.assertRedirects(response, ADMIN_PAGE, fetch_redirect_response=False)
        self.assertTrue(state.is_on())
        event = MaintenanceEvent.objects.get()
        self.assertEqual((event.action, event.actor, event.message), ("STARTED", self.tech, "Moving to a new server."))
        page = self.client.get(ADMIN_PAGE)
        self.assertContains(page, "Maintenance is on. Nobody can use the portal until you switch it off.")
        self.assertContains(page, "On since")
        self.assertEqual(self.as_user(self.office).get(SETTINGS).status_code, 503)

        self.post("off")
        self.assertFalse(state.is_on())
        self.assertEqual(MaintenanceEvent.objects.first().action, "ENDED")
        self.assertEqual(self.as_user(self.office).get(SETTINGS).status_code, 200)

    def test_planning_it_for_later(self):
        starts = later(days=1)
        self.post("later", starts_at=starts, expected_end=starts + timedelta(hours=2))
        self.assertEqual(state.status(), state.PLANNED)
        self.assertContains(self.client.get(ADMIN_PAGE), "Planned from")
        self.post("now")
        self.assertEqual(state.status(), state.ON)
        self.assertEqual([event.action for event in MaintenanceEvent.objects.all()], ["STARTED", "PLANNED"])
        self.post("off")
        self.post("later", starts_at=starts)
        self.post("off")
        self.assertEqual(MaintenanceEvent.objects.first().action, "CANCELLED")

    def test_the_form_checks_the_times(self):
        self.assertContains(self.post("later"), "Choose when it starts.")
        self.assertContains(self.post("later", starts_at=later(hours=-1)), "Choose a time in the future, or start it now.")
        self.assertContains(self.post("now", expected_end=later(hours=-1)), "The expected end must be later than now.")
        self.assertContains(self.post("now", message="x" * 501), "Keep the message under 500 characters.")
        self.assertFalse(MaintenanceEvent.objects.exists())
        self.post("now")
        self.assertContains(self.post("later", starts_at=later(hours=2)), "Maintenance has already started.")
        self.assertEqual(MaintenanceEvent.objects.count(), 1)

    def test_only_the_technical_administrator_can_open_it(self):
        for person in (self.office, self.student):
            self.client.force_login(person)
            response = self.client.get(ADMIN_PAGE)
            self.assertEqual(response.status_code, 302, person.role)
            self.assertIn("/admin/login/", response["Location"])

    def test_the_history_is_view_only(self):
        self.post("now")
        listing = self.client.get("/admin/maintenance/maintenanceevent/")
        self.assertContains(listing, "Started maintenance")
        self.assertEqual(self.client.get("/admin/maintenance/maintenanceevent/add/").status_code, 403)
        event = MaintenanceEvent.objects.get()
        self.assertEqual(self.client.post(f"/admin/maintenance/maintenanceevent/{event.pk}/delete/", {"post": "yes"}).status_code, 403)
        self.assertTrue(MaintenanceEvent.objects.exists())
