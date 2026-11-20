from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient, APITestCase

from .models import Student, User

LOGIN = "/api/auth/login/"
REFRESH = "/api/auth/refresh/"
LOGOUT = "/api/auth/logout/"
ME = "/api/auth/me/"
TAB_ONE = "tab-one-0001"
TAB_TWO = "tab-two-0002"


class SignOutEndsAccessTokenTests(APITestCase):
    password = "Sign-out-pass-5521"

    def setUp(self):
        cache.clear()
        self.alice = User.objects.create_user(
            email="alice.out@example.test", password=self.password, full_name="Alice Out", role=User.Role.STUDENT
        )
        self.browser = APIClient()

    def sign_in(self, tab):
        response = self.browser.post(
            LOGIN, {"identifier": self.alice.email, "password": self.password}, format="json", HTTP_X_PORTAL_TAB=tab
        )
        self.assertEqual(response.status_code, 200)
        return response.data["token"]

    def me(self, token):
        return APIClient().get(ME, HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_signing_out_stops_the_access_token(self):
        token = self.sign_in(TAB_ONE)
        self.assertEqual(self.me(token).status_code, 200)
        self.browser.post(LOGOUT, {}, format="json", HTTP_X_PORTAL_TAB=TAB_ONE)
        response = self.me(token)
        self.assertEqual(response.status_code, 401)
        self.assertIn("session has ended", str(response.data))

    def test_a_renewed_access_token_also_stops(self):
        self.sign_in(TAB_ONE)
        renewed = self.browser.post(REFRESH, {}, format="json", HTTP_X_PORTAL_TAB=TAB_ONE).data["token"]
        self.browser.post(LOGOUT, {}, format="json", HTTP_X_PORTAL_TAB=TAB_ONE)
        self.assertEqual(self.me(renewed).status_code, 401)

    def test_another_open_tab_keeps_working(self):
        first = self.sign_in(TAB_ONE)
        second = self.sign_in(TAB_TWO)
        self.browser.post(LOGOUT, {"openTabs": [TAB_TWO]}, format="json", HTTP_X_PORTAL_TAB=TAB_ONE)
        self.assertEqual(self.me(first).status_code, 401)
        self.assertEqual(self.me(second).status_code, 200)

    def test_changing_the_password_stops_older_access_tokens(self):
        other_tab = self.sign_in(TAB_TWO)
        this_tab = self.sign_in(TAB_ONE)
        response = APIClient().post(
            "/api/auth/settings/password/",
            {"currentPassword": self.password, "newPassword": "Fresh-pass-9931"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {this_tab}",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.me(other_tab).status_code, 401)
        self.assertEqual(self.me(this_tab).status_code, 401)


class PersonalPasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="puteri.aisyah@siswa.um.edu.my", password="x", full_name="Puteri Aisyah binti Rahman", role=User.Role.STUDENT
        )
        Student.objects.create(user=self.user, matric_no="S2101234")

    def refused(self, password):
        with self.assertRaises(ValidationError):
            validate_password(password, user=self.user)

    def test_passwords_made_from_the_person_are_refused(self):
        for password in ("puteriaisyah1", "puteri.aisyah1", "PuteriAisyah2026", "S2101234abc", "aisyah123456"):
            with self.subTest(password=password):
                self.refused(password)

    def test_letters_and_numbers_are_both_needed(self):
        for password in ("bluehorizonmeadow", "8264917305"):
            with self.subTest(password=password):
                self.refused(password)

    def test_a_good_password_passes(self):
        validate_password("Kelapa-Sawit-8812", user=self.user)
        validate_password("Puteri-loves-chess-2026", user=self.user)
