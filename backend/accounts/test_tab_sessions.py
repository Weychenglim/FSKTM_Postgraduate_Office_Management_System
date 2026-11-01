"""Each browser tab keeps its own sign-in, so two tabs can hold two accounts."""

from django.conf import settings
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import User
from .session_tokens import MAX_TAB_SESSIONS, refresh_cookie_name

LOGIN = "/api/auth/login/"
REFRESH = "/api/auth/refresh/"
LOGOUT = "/api/auth/logout/"
SHARED = settings.JWT_REFRESH_COOKIE_NAME
TAB_ONE = "tab-one-0001"
TAB_TWO = "tab-two-0002"
TAB_NEW = "tab-new-0003"


class TabSessionTests(APITestCase):
    password = "Tab-session-pass-5521!"

    def setUp(self):
        cache.clear()
        self.alice = User.objects.create_user(
            email="alice.tab@example.test", password=self.password, full_name="Alice Tab", role=User.Role.STUDENT
        )
        self.bob = User.objects.create_user(
            email="bob.tab@example.test", password=self.password, full_name="Bob Tab", role=User.Role.STUDENT
        )
        self.browser = APIClient()

    def sign_in(self, user, tab, remember=False):
        response = self.browser.post(
            LOGIN,
            {"identifier": user.email, "password": self.password, "rememberMe": remember},
            format="json",
            HTTP_X_PORTAL_TAB=tab,
        )
        self.assertEqual(response.status_code, 200)
        return response

    def refresh(self, tab, resume=False):
        return self.browser.post(REFRESH, {"resume": True} if resume else {}, format="json", HTTP_X_PORTAL_TAB=tab)

    def account_of(self, tab):
        response = self.refresh(tab)
        self.assertEqual(response.status_code, 200)
        return str(AccessToken(response.data["token"])["user_id"])

    def sign_out(self, tab, open_tabs=()):
        response = self.browser.post(LOGOUT, {"openTabs": list(open_tabs)}, format="json", HTTP_X_PORTAL_TAB=tab)
        self.assertEqual(response.status_code, 200)
        return response

    def test_two_tabs_keep_two_accounts(self):
        self.sign_in(self.alice, TAB_ONE)
        self.sign_in(self.bob, TAB_TWO)
        for _ in range(2):
            self.assertEqual(self.account_of(TAB_ONE), str(self.alice.pk))
            self.assertEqual(self.account_of(TAB_TWO), str(self.bob.pk))

    def test_a_new_tab_opens_with_the_latest_sign_in(self):
        self.sign_in(self.alice, TAB_ONE)
        self.sign_in(self.bob, TAB_TWO)
        first = self.refresh(TAB_NEW)
        self.assertEqual(str(AccessToken(first.data["token"])["user_id"]), str(self.bob.pk))
        self.assertIn(refresh_cookie_name(TAB_NEW), first.cookies)
        self.assertNotIn(SHARED, first.cookies, "starting a tab leaves the browser sign-in as it was")
        self.sign_in(self.alice, TAB_ONE)
        self.assertEqual(self.account_of(TAB_NEW), str(self.bob.pk), "after that the new tab keeps its own")

    def test_a_signed_in_tab_never_takes_another_account(self):
        self.sign_in(self.alice, TAB_ONE)
        self.browser.cookies[refresh_cookie_name(TAB_ONE)] = ""
        self.sign_in(self.bob, TAB_TWO)
        self.assertEqual(self.refresh(TAB_ONE, resume=True).status_code, 401)

    def test_remember_me_stays_on_the_browser_sign_in(self):
        response = self.sign_in(self.alice, TAB_ONE, remember=True)
        self.assertEqual(response.cookies[refresh_cookie_name(TAB_ONE)]["max-age"], "")
        self.assertTrue(response.cookies[SHARED]["max-age"])
        self.assertTrue(self.refresh(TAB_ONE).cookies[refresh_cookie_name(TAB_ONE)].value)

    def test_signing_out_keeps_other_open_tabs(self):
        self.sign_in(self.alice, TAB_ONE)
        self.assertEqual(self.account_of(TAB_TWO), str(self.alice.pk))
        self.sign_out(TAB_TWO, open_tabs=[TAB_ONE])
        self.assertEqual(self.refresh(TAB_TWO).status_code, 401)
        self.assertEqual(self.refresh(TAB_NEW).status_code, 401, "new tabs no longer open with the account")
        self.assertEqual(self.account_of(TAB_ONE), str(self.alice.pk))

    def test_signing_out_ends_the_account_in_closed_tabs(self):
        self.sign_in(self.alice, TAB_ONE)
        closed = self.browser.cookies[refresh_cookie_name(TAB_ONE)].value
        self.account_of(TAB_TWO)
        self.sign_out(TAB_TWO)
        self.browser.cookies[refresh_cookie_name(TAB_ONE)] = closed
        self.assertEqual(self.refresh(TAB_ONE).status_code, 401)

    def test_signing_out_leaves_other_accounts(self):
        self.sign_in(self.alice, TAB_ONE)
        self.sign_in(self.bob, TAB_TWO)
        self.sign_out(TAB_ONE)
        self.assertEqual(self.account_of(TAB_TWO), str(self.bob.pk))
        self.assertEqual(self.account_of(TAB_NEW), str(self.bob.pk))

    def test_old_tab_cookies_are_dropped(self):
        self.sign_in(self.alice, TAB_ONE)
        for number in range(MAX_TAB_SESSIONS + 3):
            self.refresh(f"tab-extra-{number:04}")
        prefix = f"{SHARED}__"
        kept = [name for name, cookie in self.browser.cookies.items() if name.startswith(prefix) and cookie.value]
        self.assertEqual(len(kept), MAX_TAB_SESSIONS)
        self.assertIn(refresh_cookie_name(f"tab-extra-{MAX_TAB_SESSIONS + 2:04}"), kept)

    def test_a_password_change_in_one_tab_leaves_the_other_account(self):
        self.sign_in(self.bob, TAB_TWO)
        token = self.sign_in(self.alice, TAB_ONE).data["token"]
        response = self.browser.post(
            "/api/auth/settings/password/",
            {"currentPassword": self.password, "newPassword": "Tab-session-new-8812!"},
            format="json",
            HTTP_X_PORTAL_TAB=TAB_ONE,
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies[refresh_cookie_name(TAB_ONE)]["max-age"], 0)
        self.assertEqual(response.cookies[SHARED]["max-age"], 0, "the browser sign-in was Alice's")
        self.assertEqual(self.account_of(TAB_TWO), str(self.bob.pk))

    def test_requests_without_a_tab_work_as_before(self):
        self.browser.post(LOGIN, {"identifier": self.alice.email, "password": self.password}, format="json")
        response = self.browser.post(REFRESH, {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn(SHARED, response.cookies)
        self.assertFalse([name for name in response.cookies if name.startswith(f"{SHARED}__")])

    def test_a_malformed_tab_name_is_ignored(self):
        self.sign_in(self.alice, "bad name;")
        self.assertFalse([name for name in self.browser.cookies if name.startswith(f"{SHARED}__")])
