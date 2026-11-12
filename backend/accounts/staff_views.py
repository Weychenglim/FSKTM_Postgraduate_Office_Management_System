"""Staff and lecturer accounts API (UC03), mounted under ``/api/registry/staff/``.

Office Staff/Admin only. The rules live in ``staff_accounts``; the read shape
matches the frontend ``StaffAccount`` type.
"""
from django.db import IntegrityError
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .programmes import APPROVED_PROGRAMMES
from .staff_accounts import (
    COORDINATOR,
    DUTIES,
    LECTURER,
    OFFICE,
    ROLE_FILTERS,
    STAFF_ROLES,
    STATUSES,
    StaffAccountError,
    account_history,
    active_work,
    capacity_summary,
    change_programme,
    copy_activation_link,
    create_account,
    delete_account,
    deletion_check,
    edit_account,
    filter_staff,
    find_account,
    link_kind,
    send_access_link,
    set_duties,
    set_sign_in,
    staff_accounts,
    staff_id_problem,
    staff_options,
    to_staff_dict,
)
from .registry_views import tell_old_address
from .throttles import StaffAccessLinkRateThrottle
from .tokens import ACTIVATION
from .validators import validate_phone

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
CHANGED_ELSEWHERE = "That email or Staff ID was just taken by another account. Please reload."


def _require_office(request):
    if getattr(request.user, "role", None) != OFFICE:
        raise PermissionDenied("Only Office Staff/Admin may manage staff accounts.")


def _refused(exc):
    body = {key: [message] if key != "error" else message for key, message in exc.errors.items()}
    if exc.existing:
        body["existing"] = exc.existing
    if exc.blockers:
        body["blockers"] = exc.blockers
    return Response(body, status=exc.status)


def account_page(user, viewer):
    """The account page: the account, plus its capacity, open work and
    whether it can be deleted, which the list leaves out."""
    reasons = deletion_check(user, viewer)
    return {
        **to_staff_dict(user, viewer),
        "capacity": capacity_summary(user),
        "activeWork": active_work(user),
        "deletion": {"allowed": not reasons, "reasons": reasons},
    }


class StaffDetailsMixin(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField(max_length=254)
    staffId = serializers.CharField(max_length=64)
    phone = serializers.CharField(
        max_length=32, allow_blank=True, required=False, validators=[validate_phone]
    )
    department = serializers.CharField(max_length=255, allow_blank=True, required=False)
    title = serializers.CharField(max_length=64, allow_blank=True, required=False)
    researchArea = serializers.CharField(max_length=255, allow_blank=True, required=False)
    position = serializers.CharField(max_length=128, allow_blank=True, required=False)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_staffId(self, value):
        problem = staff_id_problem(value)
        if problem:
            raise serializers.ValidationError(problem)
        return value


class StaffAccountCreateSerializer(StaffDetailsMixin):
    role = serializers.ChoiceField(choices=STAFF_ROLES)
    duties = serializers.ListField(
        child=serializers.ChoiceField(choices=DUTIES), required=False, max_length=len(DUTIES)
    )
    programme = serializers.ChoiceField(choices=APPROVED_PROGRAMMES, required=False)
    sendActivation = serializers.BooleanField(required=False, default=True)

    def validate_duties(self, value):
        return [duty for duty in DUTIES if duty in value]

    def validate(self, attrs):
        role = attrs["role"]
        errors = {}
        lecturer_like = role in (LECTURER, COORDINATOR)
        if lecturer_like and not attrs.get("department"):
            errors["department"] = "Enter the department."
        for field in ("title", "researchArea"):
            if attrs.get(field) and not lecturer_like:
                errors[field] = "Only lecturer and coordinator accounts have this."
        if attrs.get("position") and role != OFFICE:
            errors["position"] = "Only office staff accounts have a position."
        if attrs.get("duties") and role != LECTURER:
            errors["duties"] = "Only lecturer accounts have duties."
        if role == COORDINATOR and not attrs.get("programme"):
            errors["programme"] = "Choose the programme this coordinator manages."
        if attrs.get("programme") and not lecturer_like:
            errors["programme"] = "Only lecturer and coordinator accounts have a programme."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class StaffAccountUpdateSerializer(StaffDetailsMixin):
    ELSEWHERE = {
        "role": "The role cannot be changed. If this account was never used, delete it and add it again.",
        "duties": "Change duties in the Duties box.",
        "programme": "Change the programme with Change programme.",
    }

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            unknown = sorted(set(data.keys()) - set(self.fields))
            if unknown:
                raise serializers.ValidationError(
                    {
                        key: [self.ELSEWHERE.get(key, "This field cannot be changed here.")]
                        for key in unknown
                    }
                )
        return super().to_internal_value(data)


class DutiesSerializer(serializers.Serializer):
    duties = serializers.ListField(
        child=serializers.ChoiceField(choices=DUTIES), allow_empty=True, max_length=len(DUTIES)
    )

    def validate_duties(self, value):
        return [duty for duty in DUTIES if duty in value]


class ProgrammeSerializer(serializers.Serializer):
    programme = serializers.ChoiceField(choices=["", *APPROVED_PROGRAMMES], allow_blank=True)
    check = serializers.BooleanField(required=False, default=False)


class SignInSerializer(serializers.Serializer):
    on = serializers.BooleanField()
    reason = serializers.CharField(max_length=500, allow_blank=True, required=False, default="")


def _page_number(value, default, upper=None):
    number = int(value) if value not in (None, "") else default
    if number < 1:
        raise ValueError
    return min(number, upper) if upper else number


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def staff_accounts_view(request):
    """List staff accounts (search, role, status, page), or add one."""
    _require_office(request)
    if request.method == "POST":
        return _create(request)

    role = (request.query_params.get("role") or "").strip().upper()
    account_status = (request.query_params.get("status") or "").strip().upper()
    problem = None
    if role and role not in ROLE_FILTERS:
        problem = "Choose Office, Lecturer or Coordinator."
    elif account_status and account_status not in STATUSES:
        problem = "Choose Active, Not activated yet or Sign-in off."
    try:
        page = _page_number(request.query_params.get("page"), 1)
        page_size = _page_number(request.query_params.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    except ValueError:
        problem = problem or "Page and page size must be whole numbers from 1."
    if problem:
        return Response({"error": problem}, status=status.HTTP_400_BAD_REQUEST)

    queryset = filter_staff(
        staff_accounts(),
        search=(request.query_params.get("search") or "").strip(),
        role=role,
        status=account_status,
    ).order_by("full_name", "pk")
    start = (page - 1) * page_size
    return Response(
        {
            "count": queryset.count(),
            "page": page,
            "pageSize": page_size,
            "results": [to_staff_dict(user, request.user) for user in queryset[start : start + page_size]],
        }
    )


def _create(request):
    serializer = StaffAccountCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        user = create_account(actor=request.user, data=serializer.validated_data)
    except StaffAccountError as exc:
        return _refused(exc)
    except IntegrityError:
        return Response({"error": CHANGED_ELSEWHERE}, status=status.HTTP_409_CONFLICT)

    activation = "held"
    if serializer.validated_data["sendActivation"]:
        sent = send_access_link(actor=request.user, user=user, kind=ACTIVATION)
        activation = "sent" if sent else "failed"
    return Response(
        {"account": to_staff_dict(user, request.user), "activation": activation},
        status=status.HTTP_201_CREATED,
    )


def _account_or_404(account_id):
    user = staff_accounts().filter(pk=account_id).first()
    if user is None:
        return None, Response({"error": "No such account."}, status=status.HTTP_404_NOT_FOUND)
    return user, None


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def staff_account_detail_view(request, account_id):
    """One account, the office's edits to its details, or deleting it."""
    _require_office(request)
    if request.method == "GET":
        user, missing = _account_or_404(account_id)
        return missing or Response(account_page(user, request.user))
    if request.method == "DELETE":
        try:
            delete_account(actor=request.user, account_id=account_id)
        except StaffAccountError as exc:
            return _refused(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = StaffAccountUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    try:
        user, old_email = edit_account(
            actor=request.user, account_id=account_id, data=serializer.validated_data
        )
    except StaffAccountError as exc:
        return _refused(exc)
    except IntegrityError:
        return Response({"error": CHANGED_ELSEWHERE}, status=status.HTTP_409_CONFLICT)

    # Someone who never activated never used the old address, which may have
    # been a typing mistake, so only an activated account's old address is told.
    told = None
    if old_email and user.has_usable_password():
        told = tell_old_address(user, old_email)
    return Response({"account": account_page(user, request.user), "oldAddressTold": told})


def _change(request, serializer_class, action):
    """Run one account change and answer with the updated account page."""
    _require_office(request)
    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        result = action(serializer.validated_data)
    except StaffAccountError as exc:
        return _refused(exc)
    if isinstance(result, dict):
        return Response(result)
    return Response(account_page(result, request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def staff_duties_view(request, account_id):
    """Set a lecturer's duties (Supervisor, Panel)."""
    return _change(
        request,
        DutiesSerializer,
        lambda data: set_duties(actor=request.user, account_id=account_id, duties=data["duties"]),
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def staff_programme_view(request, account_id):
    """Move a coordinator or lecturer to another programme, or to none.
    ``check`` only counts the approvals that would move."""
    return _change(
        request,
        ProgrammeSerializer,
        lambda data: change_programme(
            actor=request.user,
            account_id=account_id,
            programme=data["programme"],
            check=data["check"],
        ),
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def staff_sign_in_view(request, account_id):
    """Turn sign-in off (with a reason) or back on."""
    return _change(
        request,
        SignInSerializer,
        lambda data: set_sign_in(
            actor=request.user,
            account_id=account_id,
            on=data["on"],
            reason=data["reason"].strip(),
        ),
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([StaffAccessLinkRateThrottle])
def staff_send_link_view(request, account_id):
    """Email the activation link, or a password reset link once activated."""
    _require_office(request)
    user, missing = _account_or_404(account_id)
    if missing:
        return missing
    try:
        kind = link_kind(user)
    except StaffAccountError as exc:
        return _refused(exc)
    return Response({"kind": kind, "sent": send_access_link(actor=request.user, user=user, kind=kind)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def staff_activation_link_view(request, account_id):
    """The activation link to copy, for when the email keeps failing."""
    _require_office(request)
    try:
        link = copy_activation_link(actor=request.user, account_id=account_id)
    except StaffAccountError as exc:
        return _refused(exc)
    return Response({"link": link})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_history_view(request, account_id):
    _require_office(request)
    user = find_account(account_id)
    if user is None:
        return Response({"error": "No such account."}, status=status.HTTP_404_NOT_FOUND)
    return Response(account_history(user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_options_view(request):
    _require_office(request)
    return Response(staff_options())
