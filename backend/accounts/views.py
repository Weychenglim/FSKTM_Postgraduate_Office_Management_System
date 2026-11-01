"""Auth API views: login, logout, me, password-reset (request + confirm)."""
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, UnsupportedMediaType
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from letters.details import letter_details
from letters.eligibility import inactive_student_refusal

from .account_emails import password_reset_email
from .authentication import RefreshCookieAuthentication
from .password_policy import TechnicalAccountForbidden
from .serializers import (
    ChangePasswordSerializer,
    ContactDetailsSerializer,
    AccountSettingsSerializer,
    SettingsPasswordSerializer,
    LoginSerializer,
    PasswordLinkSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)
from .session_tokens import (
    TAB_NAME,
    blacklist_user_refresh_tokens,
    delete_refresh_cookie,
    end_session,
    SessionTokenRefreshSerializer,
    issue_refresh,
    make_room_for_tab,
    new_session_key,
    note_rotation,
    remembered,
    request_tab,
    session_key_cookie_name,
    set_refresh_cookie,
    set_sign_in_cookies,
    sign_out_account_in_browser,
    signed_in_tab,
)
from .throttles import (
    ChangePasswordRateThrottle,
    SettingsPasswordRateThrottle,
    LoginIdentifierRateThrottle,
    LoginRateThrottle,
    PasswordLinkCheckRateThrottle,
    PasswordResetConfirmRateThrottle,
    PasswordResetRateThrottle,
    is_password_link_check,
)
from .tokens import ACTIVATION, password_link_kind, reset_link

User = get_user_model()
logger = logging.getLogger(__name__)


def _require_json_request(request):
    if request.content_type != "application/json":
        raise UnsupportedMediaType(request.content_type or "missing")


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle, LoginIdentifierRateThrottle])
def login_view(request):
    """Authenticate by email / student ID / staff ID (case-insensitive)."""
    _require_json_request(request)
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)  # 400 on missing fields
    identifier = serializer.validated_data["identifier"].strip()
    password = serializer.validated_data["password"]

    # Match the identifier against the email, a student's matric no, or a
    # staff/lecturer's staff no (the latter two now live in the profile tables).
    user = (
        User.objects.filter(
            Q(email__iexact=identifier)
            | Q(student__matric_no__iexact=identifier)
            | Q(office_staff__staff_no__iexact=identifier)
            | Q(lecturer__staff_no__iexact=identifier)
        )
        .distinct()
        .first()
    )
    # Hash even when no account matched, so response time does not reveal
    # whether an identifier exists. Skipping this made unknown identifiers
    # roughly 100x faster to reject than known ones.
    if user is None:
        User().set_password(password)
        return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

    # A disabled account returns the same generic 401 whether or not the
    # password was right; a distinct 403 confirmed valid credentials and
    # revealed which accounts the office had suspended.
    if not user.check_password(password) or not user.is_active:
        return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

    if user.is_technical_admin:
        raise TechnicalAccountForbidden()

    User.objects.filter(pk=user.pk).update(last_portal_login=timezone.now())
    remember = serializer.validated_data["rememberMe"]
    refresh = issue_refresh(user, remember)
    response = Response(
        {"token": str(refresh.access_token), "user": user.to_public_dict()}
    )
    return set_sign_in_cookies(request, response, user, refresh, remember)


@api_view(["POST"])
@authentication_classes([RefreshCookieAuthentication])
@permission_classes([IsAuthenticated])
def refresh_view(request):
    _require_json_request(request)
    tab = request.refresh_tab
    if request.user.is_technical_admin:
        request.auth.blacklist()
        response = Response(
            TechnicalAccountForbidden.default_detail, status=status.HTTP_403_FORBIDDEN
        )
        return delete_refresh_cookie(response, tab)
    new_tab = request_tab(request)
    if new_tab and not tab:
        # A tab with no sign-in of its own starts from the browser's latest one,
        # unless it was already signed in: then its own sign-in has ended.
        if isinstance(request.data, dict) and request.data.get("resume") is True:
            raise AuthenticationFailed("This tab's session has ended.")
        remember = remembered(request.auth)
        refresh = issue_refresh(request.user, remember)
        response = Response({"token": str(refresh.access_token)})
        make_room_for_tab(request, response, new_tab)
        return set_refresh_cookie(response, refresh, remember, session_key=new_session_key(), tab=new_tab)
    # Noted before rotating, so a second request from the same page load
    # that arrives mid-rotation already finds the grace.
    note_rotation(request, request.auth, tab)
    serializer = SessionTokenRefreshSerializer(data={"refresh": str(request.auth)})
    serializer.is_valid(raise_exception=True)
    response = Response({"token": serializer.validated_data["access"]})
    return set_refresh_cookie(
        response,
        serializer.validated_data["refresh"],
        remembered(request.auth),
        session_key=request.COOKIES.get(session_key_cookie_name(tab)),
        tab=tab,
    )


def _open_tabs(request):
    tabs = request.data.get("openTabs") if isinstance(request.data, dict) else None
    if not isinstance(tabs, list):
        return set()
    return {tab for tab in tabs[:50] if isinstance(tab, str) and TAB_NAME.fullmatch(tab)}


@api_view(["POST"])
@authentication_classes([RefreshCookieAuthentication])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Revoke the authenticated refresh session and remove its cookie. The
    account is also signed out for new tabs and in closed ones; other open
    tabs, listed by the page in openTabs, keep their own sign-in."""
    _require_json_request(request)
    tab = request.refresh_tab
    request.auth.blacklist()
    end_session(request, tab)
    response = Response({"message": "Logged out successfully."})
    delete_refresh_cookie(response, tab)
    return sign_out_account_in_browser(request, response, request.user, _open_tabs(request) - {tab})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return the authenticated user, or update their own contact details.

    Only the phone number is writable. Email is the login identifier and role /
    department / ID fields are office-controlled, so those stay read-only here
    and are managed through Registry Management or the Django admin.
    """
    if request.method == "GET":
        return Response(request.user.to_public_dict())

    serializer = ContactDetailsSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    if "phone" in serializer.validated_data:
        request.user.phone = serializer.validated_data["phone"]
        request.user.save(update_fields=["phone"])
    return Response(request.user.to_public_dict())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ChangePasswordRateThrottle])
def change_password_view(request):
    """Change the caller's own password after verifying the current one."""
    serializer = ChangePasswordSerializer(
        data=request.data, context={"user": request.user}
    )
    serializer.is_valid(raise_exception=True)

    request.user.set_password(serializer.validated_data["new_password"])
    request.user.must_change_password = False
    request.user.save(update_fields=["password", "must_change_password"])
    blacklist_user_refresh_tokens(request.user)

    # The new session keeps the "Remember me" choice of the one in use.
    end_session(request, signed_in_tab(request))
    remember = remembered(request.auth)
    refresh = issue_refresh(request.user, remember)
    response = Response(
        {
            "message": "Your password has been updated.",
            "token": str(refresh.access_token),
        }
    )
    return set_sign_in_cookies(request, response, request.user, refresh, remember)


PREFERENCE_FIELDS = {
    "announcementAlerts": "announcement_alerts",
    "emailNotifications": "email_notifications",
    "deadlineReminders": "deadline_reminders",
    "weeklySummary": "weekly_summary",
}


def _settings_payload(user):
    return {
        "user": user.to_public_dict(),
        "preferences": {key: getattr(user, field) for key, field in PREFERENCE_FIELDS.items()},
        "capabilities": {
            "emailNotifications": True,
            "deadlineReminders": True,
            "weeklySummary": True,
        },
    }


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def settings_view(request):
    user = request.user
    if request.method == "PATCH":
        _require_json_request(request)
        serializer = AccountSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fields = []
        if "phone" in serializer.validated_data:
            user.phone = serializer.validated_data["phone"]
            fields.append("phone")
        for key, value in serializer.validated_data.get("preferences", {}).items():
            setattr(user, PREFERENCE_FIELDS[key], value)
            fields.append(PREFERENCE_FIELDS[key])
        if fields:
            user.save(update_fields=fields)
    return Response(_settings_payload(user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([SettingsPasswordRateThrottle])
def settings_password_view(request):
    _require_json_request(request)
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if not user.is_active:
            raise PermissionDenied("This account is disabled.")
        serializer = SettingsPasswordSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        if not user.check_password(serializer.validated_data["currentPassword"]):
            return Response({"currentPassword": ["Current password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["newPassword"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        blacklist_user_refresh_tokens(user)
    tab = signed_in_tab(request)
    end_session(request, tab)
    response = delete_refresh_cookie(Response({"message": "Password updated. Please sign in again."}), tab)
    return sign_out_account_in_browser(request, response, user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_letter_details_view(request):
    """Return the logged-in student's details for letter generation: the base
    profile (name, matric, programme, status) plus the extended StudentRegistry
    fields (passport, country, semesters…). The student Letter Generation screen
    fills its template placeholders from this. Non-students get 403; a student
    with no registry row yet gets the base fields with the extras left blank
    (so the office still completes them by hand)."""
    student = request.user._related_or_none("student")
    if student is None:
        return Response(
            {"error": "Only students have letter details."},
            status=status.HTTP_403_FORBIDDEN,
        )
    refusal = inactive_student_refusal(request.user)
    if refusal:
        return Response(refusal, status=status.HTTP_403_FORBIDDEN)
    return Response(letter_details(student))


def send_password_reset_email(user) -> bool:
    subject, message = password_reset_email(user, reset_link(user))
    # Failures are logged, never raised: an SMTP outage otherwise turned this
    # endpoint into a registered/unregistered oracle (500 for a real address,
    # 200 for an unknown one) despite the deliberately generic response body.
    try:
        sent = send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception("Password reset email to user %s could not be sent.", user.pk)
        return False
    return bool(sent)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRateThrottle])
def password_reset_view(request):
    """Send a reset link. Always returns 200 so we never reveal which emails
    are registered."""
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"]

    user = (
        User.objects.filter(email__iexact=email, is_active=True)
        .exclude(role=User.TECHNICAL_ADMIN)
        .first()
    )
    if user is not None:
        send_password_reset_email(user)

    return Response(
        {"message": "If that email is registered, a password reset link has been sent."}
    )


def _usable_link(uidb64, token):
    """``(user, kind)`` for a set-password link that still works, else ``(None, None)``."""
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None, None
    # ``is_active`` is not covered by the token hash, so a suspended account
    # could still complete an outstanding link and choose its password.
    if not user.is_active or user.is_technical_admin:
        return None, None
    kind = password_link_kind(user, token)
    return (user, kind) if kind else (None, None)


def _invalid_link():
    return Response(
        {
            "error": "This link can no longer be used. It may have expired or already been used.",
            "code": "invalid_link",
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetConfirmRateThrottle, PasswordLinkCheckRateThrottle])
def password_reset_confirm_view(request):
    """Set a password from an activation or reset link (uid + token).

    With ``dryRun`` it only reports whether the link still works and which kind
    it is, so the page can explain a used or expired link before anyone types a
    password. Nothing is changed.
    """
    if is_password_link_check(request):
        check = PasswordLinkSerializer(data=request.data)
        check.is_valid(raise_exception=True)
        _, kind = _usable_link(check.validated_data["uid"], check.validated_data["token"])
        return _invalid_link() if kind is None else Response({"kind": kind})

    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    token = serializer.validated_data["token"]
    new_password = serializer.validated_data["new_password"]

    user, kind = _usable_link(serializer.validated_data["uid"], token)
    if kind is None:
        return _invalid_link()

    # Validated here rather than in the serializer so the resolved user is
    # available; without it UserAttributeSimilarityValidator never runs and a
    # user could reset their password to their own email address.
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        return Response(
            {"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST
        )

    with transaction.atomic():
        # Checked again under a row lock, so two tabs submitting the same link
        # cannot both set a password.
        user = User.objects.select_for_update().get(pk=user.pk)
        if not user.is_active or password_link_kind(user, token) != kind:
            return _invalid_link()
        user.set_password(new_password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
    blacklist_user_refresh_tokens(user)
    if kind == ACTIVATION:
        return Response(
            {"kind": kind, "message": "Your account is now active. You can sign in."}
        )
    return Response(
        {"kind": kind, "message": "Your password has been reset. You can now sign in."}
    )
