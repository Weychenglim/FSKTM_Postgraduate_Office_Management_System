"""While the portal is under maintenance, turn away every signed-in API request
that is not from PG office staff, before any module's code runs.

Session renewal and reading one's own account stay open, so a signed-in person
keeps their sign-in and the portal can show them the maintenance page. Requests
without a token can only reach the public views (sign-in, password links, the
maintenance status), and those check maintenance themselves.
"""
from django.urls import reverse
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from accounts.authorization import office_actor

from . import state

OPEN_VIEWS = ("health", "maintenance-status", "login", "refresh", "logout", "password-reset", "password-reset-confirm")
READ_ONLY_VIEWS = ("me",)


def _from_office(request):
    try:
        found = JWTAuthentication().authenticate(request)
    except AuthenticationFailed:
        return False
    return bool(found) and office_actor(found[0])


class MaintenanceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.open_paths = None
        self.read_only_paths = None

    def __call__(self, request):
        if self._checks(request) and state.is_on() and not _from_office(request):
            return state.maintenance_response()
        return self.get_response(request)

    def _checks(self, request):
        if not request.path.startswith("/api/") or not request.META.get("HTTP_AUTHORIZATION"):
            return False
        if self.open_paths is None:
            self.open_paths = {reverse(name) for name in OPEN_VIEWS}
            self.read_only_paths = {reverse(name) for name in READ_ONLY_VIEWS}
        if request.method == "GET" and request.path in self.read_only_paths:
            return False
        return request.path not in self.open_paths
