import hashlib
import re
import secrets

from django.conf import settings
from django.core.cache import cache
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import datetime_from_epoch

# Whether the person ticked "Remember me" when signing in. Sessions from
# before the choice existed have no claim and stay remembered, as they were.
REMEMBER_CLAIM = "remember"

# A reload that cuts off a refresh leaves the browser holding the refresh
# cookie the server has just replaced, which signed people out. For a short
# time after a rotation that browser, and only it, may renew with the replaced
# cookie: it must also send the session key cookie set when it signed in, which
# a copied refresh token alone does not carry.
SESSION_KEY_COOKIE = "fsktm_session_key"
ROTATION_GRACE_SECONDS = 30

# Each browser tab keeps its own sign-in, so two tabs can hold two accounts.
# A tab sends its name in this header and its cookies carry the name. The
# unnamed cookies hold the latest sign-in in the browser, which a new tab
# starts from.
TAB_HEADER = "HTTP_X_PORTAL_TAB"
TAB_NAME = re.compile(r"[A-Za-z0-9-]{8,64}")
# Closed tabs leave their cookies behind; past this many the least recently
# used are dropped, so the cookie header stays small.
MAX_TAB_SESSIONS = 6


def request_tab(request):
    tab = request.META.get(TAB_HEADER, "")
    return tab if TAB_NAME.fullmatch(tab) else None


def refresh_cookie_name(tab=None):
    return f"{settings.JWT_REFRESH_COOKIE_NAME}__{tab}" if tab else settings.JWT_REFRESH_COOKIE_NAME


def session_key_cookie_name(tab=None):
    return f"{SESSION_KEY_COOKIE}__{tab}" if tab else SESSION_KEY_COOKIE


def signed_in_tab(request):
    """The request's tab when it has a sign-in of its own, else None (the
    browser's latest sign-in)."""
    tab = request_tab(request)
    return tab if tab and request.COOKIES.get(refresh_cookie_name(tab)) else None


def tab_refresh_cookies(request):
    prefix = f"{settings.JWT_REFRESH_COOKIE_NAME}__"
    return {
        name[len(prefix):]: value
        for name, value in request.COOKIES.items()
        if name.startswith(prefix) and TAB_NAME.fullmatch(name[len(prefix):])
    }


def remembered(token):
    return token is None or token.get(REMEMBER_CLAIM, True) is not False


class SessionRefreshToken(RefreshToken):
    """A refresh token that keeps the "Remember me" choice. Without it the
    session ends JWT_SESSION_REFRESH_LIFETIME after its last use, so a
    browser that restores closed tabs cannot keep it open for days."""

    def set_exp(self, claim="exp", from_time=None, lifetime=None):
        if lifetime is None and claim == "exp" and not remembered(self):
            lifetime = settings.JWT_SESSION_REFRESH_LIFETIME
        super().set_exp(claim=claim, from_time=from_time, lifetime=lifetime)


class CookieRefreshToken(SessionRefreshToken):
    """The refresh cookie's token. Its blacklist check is made by
    RefreshCookieAuthentication, which also applies the rotation grace."""

    def check_blacklist(self):
        pass


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    """Rotates the refresh token without losing the "Remember me" choice."""

    token_class = CookieRefreshToken


def new_session_key():
    return secrets.token_urlsafe(32)


def _session_key_hash(request, tab=None):
    key = request.COOKIES.get(session_key_cookie_name(tab))
    return hashlib.sha256(key.encode()).hexdigest() if key else None


def _rotated_key(token):
    return f"auth:rotated:{token[api_settings.JTI_CLAIM]}"


def is_blacklisted(token):
    return BlacklistedToken.objects.filter(token__jti=token[api_settings.JTI_CLAIM]).exists()


def note_rotation(request, replaced_token, tab=None):
    """Let this browser renew with the replaced token for a short time."""
    key = _session_key_hash(request, tab)
    if key:
        cache.set(_rotated_key(replaced_token), key, ROTATION_GRACE_SECONDS)


def rotation_grace_allows(request, token, tab=None):
    """True when a blacklisted token was replaced moments ago in this browser's
    session, and that session has not been signed out."""
    key = _session_key_hash(request, tab)
    return bool(key) and cache.get(_rotated_key(token)) == key and not cache.get(f"auth:ended:{key}")


def end_session(request, tab=None):
    """Sign-out: the replaced tokens of this session may no longer renew it."""
    key = _session_key_hash(request, tab)
    if key:
        lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
        cache.set(f"auth:ended:{key}", True, int(lifetime.total_seconds()))


def _readable(raw_token):
    try:
        return CookieRefreshToken(raw_token)
    except TokenError:
        return None


def _belongs_to(token, user):
    return str(token.get(api_settings.USER_ID_CLAIM)) == str(user.pk)


def issue_refresh(user, remember):
    """A refresh token for a new sign-in, remembered on this device or not."""
    refresh = SessionRefreshToken.for_user(user)
    refresh[REMEMBER_CLAIM] = bool(remember)
    refresh.set_exp()
    OutstandingToken.objects.filter(jti=refresh[api_settings.JTI_CLAIM]).update(
        expires_at=datetime_from_epoch(refresh["exp"])
    )
    return refresh


def set_refresh_cookie(response, refresh_token, remember=True, session_key=None, tab=None):
    """A remembered session keeps its cookie for the refresh lifetime;
    otherwise the browser drops the cookie when it closes. The session key
    cookie, when given, is kept the same way. A tab's cookies always go when
    the browser closes: "Remember me" lives in the unnamed cookies."""
    lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    cookies = [(refresh_cookie_name(tab), str(refresh_token))]
    if session_key:
        cookies.append((session_key_cookie_name(tab), session_key))
    for name, value in cookies:
        response.set_cookie(
            key=name,
            value=value,
            max_age=int(lifetime.total_seconds()) if remember and not tab else None,
            secure=settings.JWT_REFRESH_COOKIE_SECURE,
            httponly=True,
            samesite="Strict",
            path=settings.JWT_REFRESH_COOKIE_PATH,
        )
    return response


def set_sign_in_cookies(request, response, user, refresh, remember):
    """A new sign-in. From a tab, the tab keeps it and the unnamed cookies get
    a token of their own, so new tabs open with this account."""
    tab = request_tab(request)
    if tab:
        make_room_for_tab(request, response, tab)
        set_refresh_cookie(response, refresh, remember, session_key=new_session_key(), tab=tab)
        refresh = issue_refresh(user, remember)
    return set_refresh_cookie(response, refresh, remember, session_key=new_session_key())


def make_room_for_tab(request, response, tab):
    """Drops tab cookies that no longer work, then the least recently used
    past MAX_TAB_SESSIONS."""
    live = []
    for other, raw_token in tab_refresh_cookies(request).items():
        if other == tab:
            continue
        token = _readable(raw_token)
        if token is None or (is_blacklisted(token) and not rotation_grace_allows(request, token, other)):
            delete_refresh_cookie(response, other)
        else:
            live.append((token.get("iat", 0), other, token))
    live.sort(key=lambda item: item[0], reverse=True)
    for _, other, token in live[MAX_TAB_SESSIONS - 1:]:
        token.blacklist()
        delete_refresh_cookie(response, other)


def sign_out_account_in_browser(request, response, user, open_tabs=()):
    """Ends the account's sign-in in every cookie of this browser that holds
    it (new tabs, and tabs closed since), except tabs still open with it."""
    cookies = {None: request.COOKIES.get(refresh_cookie_name()), **tab_refresh_cookies(request)}
    for tab, raw_token in cookies.items():
        if not raw_token or tab in open_tabs:
            continue
        token = _readable(raw_token)
        if token is None or not _belongs_to(token, user):
            continue
        token.blacklist()
        end_session(request, tab)
        delete_refresh_cookie(response, tab)
    return response


def delete_refresh_cookie(response, tab=None):
    for name in (refresh_cookie_name(tab), session_key_cookie_name(tab)):
        response.set_cookie(
            key=name,
            value="",
            max_age=0,
            expires="Thu, 01 Jan 1970 00:00:00 GMT",
            path=settings.JWT_REFRESH_COOKIE_PATH,
            secure=settings.JWT_REFRESH_COOKIE_SECURE,
            httponly=True,
            samesite="Strict",
        )
    return response


def blacklist_user_refresh_tokens(user):
    outstanding_tokens = OutstandingToken.objects.filter(user=user).exclude(
        blacklistedtoken__isnull=False
    )
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in outstanding_tokens],
        ignore_conflicts=True,
    )
