"""Staff and lecturer accounts (UC03).

The office creates and looks after office staff, lecturer and programme
coordinator accounts here instead of in the Django admin site. No password is
ever made or seen: a new account gets the same activation link as an imported
student (D1, D7). Every change is kept as an ``AccountChange`` row.

Technical Administrator accounts never appear here.
"""
import hashlib

from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
from django.contrib.auth.models import Permission
from django.core.exceptions import ObjectDoesNotExist
from django.db import connection, transaction
from django.db.models import Q

from academics.capacity import CapacityRole, resolve_lecturer_capacity
from academics.models import LecturerCapacityEntry, SemesterCapacityPlan
from academics.services import current_effective_semester
from appointments.models import (
    CoSupervisorAppointment,
    CoSupervisorNomination,
    PanelAppointment,
    PanelRecommendation,
    ResearchAmendment,
    SupervisorApplication,
    SupervisorAppointment,
)

from .coordinator_alias import (
    alias_email,
    alias_staff_id,
    coordinator_account_of,
    is_alias_email,
    lecturer_account_of,
    shown_staff_id,
)
from .delegations import today
from .models import (
    AccountChange,
    Coordinator,
    Lecturer,
    OfficeStaff,
    Panel,
    Student,
    Supervisor,
    User,
)
from .participant_lifecycle import lecturer_blockers
from .programmes import APPROVED_PROGRAMMES
from .registry_views import send_activation_email
from .session_tokens import blacklist_user_refresh_tokens
from .tokens import ACTIVATION, RESET, activation_link
from .validators import MATRIC_PATTERN
from .views import send_password_reset_email


OFFICE = User.Role.OFFICE_ADMIN
LECTURER = User.Role.LECTURER
COORDINATOR = User.Role.COORDINATOR
STAFF_ROLES = (OFFICE, LECTURER, COORDINATOR)
# As listed on fsktm.um.edu.my/departments-and-unit, plus the office itself.
FACULTY_DEPARTMENTS = [
    "Department of Artificial Intelligence",
    "Department of Computer System & Technology",
    "Department of Information Systems",
    "Department of Software Engineering",
    "Multimedia Unit",
    "Postgraduate Office",
]
ROLE_FILTERS = {"OFFICE": OFFICE, "LECTURER": LECTURER, "COORDINATOR": COORDINATOR}

ACTIVE = "ACTIVE"
NOT_ACTIVATED = "NOT_ACTIVATED"
SIGN_IN_OFF = "SIGN_IN_OFF"
STATUSES = (ACTIVE, NOT_ACTIVATED, SIGN_IN_OFF)

SUPERVISOR = "Supervisor"
PANEL = "Panel"
DUTIES = (SUPERVISOR, PANEL)

# Fields the office edits on the account page, as the API names them.
USER_FIELDS = {"name": "full_name", "email": "email", "phone": "phone"}
PROFILE_FIELDS = {"staffId": "staff_no", "department": "department"}
LECTURER_FIELDS = {"title": "title", "researchArea": "specialization"}
OFFICE_FIELDS = {"position": "position"}
FIELD_LABELS = {
    "name": "Full name",
    "email": "Email",
    "phone": "Phone",
    "staffId": "Staff ID",
    "department": "Department",
    "title": "Title",
    "researchArea": "Research area",
    "position": "Position",
}

EMAIL_TAKEN = "Another account already uses this email."
STAFF_ID_TAKEN = "Another account already uses this Staff ID."
STAFF_ID_IS_MATRIC = (
    "This is already a student's matric number. Sign-in accepts both, so they must differ."
)
ALIAS_EMAIL_TYPED = "Email addresses containing +coordinator are reserved for coordinator accounts."
FROM_LECTURER = "These details come from the lecturer account. Change them there."
CHOOSE_LECTURER = "Choose the lecturer."
HISTORY_LIMIT = 200

_LOCK_KEY = int.from_bytes(
    hashlib.sha256(b"accounts:staff-accounts").digest()[:8], "big", signed=True
)


class StaffAccountError(Exception):
    """A refused change. ``errors`` maps a field, or "error", to its message;
    ``existing`` names the account that already holds a value, per field."""

    def __init__(self, errors, *, existing=None, status=400, blockers=None):
        super().__init__(next(iter(errors.values())))
        self.errors = errors
        self.existing = existing or {}
        self.status = status
        self.blockers = blockers or []


def _lock_staff_accounts():
    # A Staff ID is unique across two tables and a programme has one
    # coordinator, which no database constraint can hold. Account changes are
    # rare, so they simply take turns.
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [_LOCK_KEY])


def staff_id_problem(value):
    if not MATRIC_PATTERN.match(value):
        return "Use letters, digits, '.', '_' or '-' only in the Staff ID (no spaces or '/')."
    return None


def staff_accounts():
    return User.objects.filter(role__in=STAFF_ROLES).select_related(
        "office_staff",
        "lecturer__coordinator__lecturer_account",
        "lecturer__supervisor",
        "lecturer__panel",
        "linked_coordinator__lecturer__user",
    )


def find_account(account_id, *, lock=False):
    queryset = User.objects.filter(role__in=STAFF_ROLES)
    if lock:
        queryset = queryset.select_for_update()
    return queryset.filter(pk=account_id).first()


def _part(row, name):
    if row is None:
        return None
    try:
        return getattr(row, name)
    except ObjectDoesNotExist:
        return None


def account_status(user):
    if not user.is_active:
        return SIGN_IN_OFF
    return ACTIVE if user.has_usable_password() else NOT_ACTIVATED


def duties_of(user):
    lecturer = user._related_or_none("lecturer")
    return [
        duty
        for duty, name in ((SUPERVISOR, "supervisor"), (PANEL, "panel"))
        if _part(lecturer, name) is not None
    ]


def _linked(user):
    if user is None:
        return None
    return {"id": str(user.pk), "name": user.full_name, "email": user.email, "status": account_status(user)}


def to_staff_dict(user, viewer=None):
    office = user._related_or_none("office_staff")
    lecturer = user._related_or_none("lecturer")
    profile = office or lecturer
    coordinator = _part(lecturer, "coordinator")
    lecturer_account = lecturer_account_of(user)
    staff_id = profile.staff_no if profile else ""
    if lecturer_account is not None:
        staff_id = shown_staff_id(staff_id)
    signed_in = user.last_portal_login or user.last_login
    return {
        "id": str(user.pk),
        "name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "staffId": staff_id,
        "department": profile.department if profile else "",
        "title": lecturer.title if lecturer else "",
        "researchArea": lecturer.specialization if lecturer else "",
        "position": office.position if office else "",
        "duties": duties_of(user),
        "programme": coordinator.programme_managed if coordinator else lecturer.programme if lecturer else "",
        "status": account_status(user),
        "lifecycle": lecturer.lifecycle_status if lecturer else None,
        "lastSignedIn": signed_in.isoformat() if signed_in else None,
        "createdAt": user.date_joined.isoformat(),
        "isYou": bool(viewer and viewer.pk == user.pk),
        "lecturerAccount": _linked(lecturer_account),
        "coordinatorAccount": _linked(coordinator_account_of(user)) if user.role == LECTURER else None,
    }


def filter_staff(queryset, *, search="", role="", status=""):
    if search:
        queryset = queryset.filter(
            Q(full_name__icontains=search)
            | Q(email__icontains=search)
            | Q(office_staff__staff_no__icontains=search)
            | Q(lecturer__staff_no__icontains=search)
            | Q(office_staff__department__icontains=search)
            | Q(lecturer__department__icontains=search)
        )
    if role:
        queryset = queryset.filter(role=ROLE_FILTERS[role])
    unusable = Q(password__startswith=UNUSABLE_PASSWORD_PREFIX)
    if status == SIGN_IN_OFF:
        queryset = queryset.filter(is_active=False)
    elif status == NOT_ACTIVATED:
        queryset = queryset.filter(unusable, is_active=True)
    elif status == ACTIVE:
        queryset = queryset.filter(is_active=True).exclude(unusable)
    return queryset


def _holder(user):
    """The account holding a duplicate value, as far as the office may open it."""
    if user.role in STAFF_ROLES:
        return {"kind": "staff", "id": str(user.pk), "name": user.full_name, "role": user.role}
    student = user._related_or_none("student")
    if student is not None:
        return {"kind": "student", "id": student.matric_no, "name": user.full_name}
    return {"kind": "other"}


def _email_holder(email, account=None):
    queryset = User.objects.filter(email__iexact=email).select_related("student")
    if account is not None:
        queryset = queryset.exclude(pk=account.pk)
    return queryset.first()


def _staff_id_holder(staff_id, account=None):
    """``(message, holder)`` when ``staff_id`` is taken, else ``(None, None)``."""
    for model in (OfficeStaff, Lecturer):
        queryset = model.objects.filter(staff_no__iexact=staff_id).select_related("user")
        if account is not None:
            queryset = queryset.exclude(user=account)
        row = queryset.first()
        if row is not None:
            return STAFF_ID_TAKEN, row.user
    student = Student.objects.filter(matric_no__iexact=staff_id).select_related("user").first()
    if student is not None:
        return STAFF_ID_IS_MATRIC, student.user
    return None, None


def programme_coordinator(programme, account=None):
    """The signed-in-able coordinator who already manages ``programme``."""
    wanted = programme.strip().casefold()
    rows = Coordinator.objects.filter(lecturer__user__is_active=True).select_related("lecturer__user")
    for row in rows:
        user = row.lecturer.user
        if account is not None and user.pk == account.pk:
            continue
        if row.programme_managed.strip().casefold() == wanted:
            return user
    return None


def _check_unique(*, email=None, staff_id=None, programme=None, account=None):
    errors, existing = {}, {}
    if email is not None:
        holder = _email_holder(email, account)
        if holder is not None:
            errors["email"] = EMAIL_TAKEN
            existing["email"] = _holder(holder)
    if staff_id is not None:
        message, holder = _staff_id_holder(staff_id, account)
        if holder is not None:
            errors["staffId"] = message
            existing["staffId"] = _holder(holder)
    if programme:
        holder = programme_coordinator(programme, account)
        if holder is not None:
            errors["programme"] = f"{holder.full_name} already coordinates this programme."
            existing["programme"] = _holder(holder)
    if errors:
        raise StaffAccountError(errors, existing=existing)


def record(account, actor, action, details=None):
    return AccountChange.objects.create(
        account=account,
        account_name=account.full_name,
        account_email=account.email,
        actor=actor,
        actor_name=actor.full_name if actor else "",
        action=action,
        details=details or {},
    )


def _grant_office_powers(user):
    # The office screens built on ``is_staff`` and the marks permissions (see
    # seed_users) need both, so a new office account matches the existing ones.
    user.user_permissions.add(*Permission.objects.filter(content_type__app_label="marks"))


@transaction.atomic
def create_account(*, actor, data):
    """Create the account and its profile rows. The caller sends the
    activation email once this has committed."""
    _lock_staff_accounts()
    role = data["role"]
    if role == COORDINATOR:
        raise StaffAccountError({"lecturerId": CHOOSE_LECTURER})
    if is_alias_email(data["email"]):
        raise StaffAccountError({"email": ALIAS_EMAIL_TYPED})
    _check_unique(email=data["email"], staff_id=data["staffId"])
    user = User(
        email=data["email"],
        full_name=data["name"],
        role=role,
        phone=data.get("phone", ""),
        is_staff=role == OFFICE,
    )
    user.set_unusable_password()
    user.save()
    details = {"role": role, "staffId": data["staffId"]}
    if role == OFFICE:
        OfficeStaff.objects.create(
            user=user,
            staff_no=data["staffId"],
            department=data.get("department", ""),
            position=data.get("position", ""),
        )
        _grant_office_powers(user)
    else:
        lecturer = Lecturer.objects.create(
            user=user,
            staff_no=data["staffId"],
            department=data.get("department", ""),
            title=data.get("title", ""),
            specialization=data.get("researchArea", ""),
            programme=data.get("programme", ""),
        )
        duties = data.get("duties", [])
        if SUPERVISOR in duties:
            Supervisor.objects.create(lecturer=lecturer)
        if PANEL in duties:
            Panel.objects.create(lecturer=lecturer)
        details["duties"] = duties
        if data.get("programme"):
            details["programme"] = data["programme"]
    record(user, actor, AccountChange.Action.CREATED, details)
    return staff_accounts().get(pk=user.pk)


def _clash_on_lecturer(exc, email, staff_id):
    """Report a taken alias email or Staff ID against the lecturer picker."""
    errors, existing = {}, {}
    if "email" in exc.errors:
        errors["lecturerId"] = f"The coordinator sign-in email {email} is already used by another account."
        existing["lecturerId"] = exc.existing.get("email")
    elif "staffId" in exc.errors:
        errors["lecturerId"] = f"The Staff ID {staff_id} is already used by another account."
        existing["lecturerId"] = exc.existing.get("staffId")
    if "programme" in exc.errors:
        errors["programme"] = exc.errors["programme"]
        existing["programme"] = exc.existing.get("programme")
    return StaffAccountError(errors, existing={key: value for key, value in existing.items() if value})


def _reopen_coordinator(*, actor, account, programme):
    _check_unique(programme=programme, account=account)
    coordinator = Coordinator.objects.select_for_update().get(lecturer__user=account)
    before = coordinator.programme_managed.strip()
    coordinator.programme_managed = programme
    coordinator.appointed_date = today()
    coordinator.save(update_fields=["programme_managed", "appointed_date"])
    if before.casefold() != programme.casefold():
        record(account, actor, AccountChange.Action.PROGRAMME_CHANGED, {"from": before, "to": programme})
    account.is_active = True
    account.save(update_fields=["is_active"])
    record(account, actor, AccountChange.Action.SIGN_IN_ON, {"reason": "Appointed Programme Coordinator again."})
    return staff_accounts().get(pk=account.pk)


@transaction.atomic
def create_coordinator_account(*, actor, lecturer_id, programme):
    """Give a lecturer their +coordinator account for ``programme``, or switch
    their earlier one back on. Returns ``(account, reopened)``; the caller sends
    the activation email for a new account."""
    _lock_staff_accounts()
    owner = find_account(lecturer_id, lock=True)
    lecturer = Lecturer.objects.select_for_update().filter(user=owner).first() if owner else None
    if owner is None or owner.role != LECTURER or lecturer is None:
        raise StaffAccountError({"lecturerId": CHOOSE_LECTURER})
    if not owner.is_active or lecturer.lifecycle_status != Lecturer.Lifecycle.ACTIVE:
        raise StaffAccountError(
            {"lecturerId": "Only an active lecturer who can sign in can be made a coordinator."}
        )
    earlier = coordinator_account_of(owner)
    if earlier is not None:
        earlier = find_account(earlier.pk, lock=True)
        if earlier.is_active:
            raise StaffAccountError(
                {"lecturerId": f"{owner.full_name} already has a coordinator account."},
                existing={"lecturerId": _holder(earlier)},
            )
        return _reopen_coordinator(actor=actor, account=earlier, programme=programme), True

    email, staff_id = alias_email(owner.email), alias_staff_id(lecturer.staff_no)
    try:
        _check_unique(email=email, staff_id=staff_id, programme=programme)
    except StaffAccountError as exc:
        raise _clash_on_lecturer(exc, email, staff_id) from None
    user = User(email=email, full_name=owner.full_name, role=COORDINATOR, phone=owner.phone)
    user.set_unusable_password()
    user.save()
    profile = Lecturer.objects.create(
        user=user,
        staff_no=staff_id,
        department=lecturer.department,
        title=lecturer.title,
        specialization=lecturer.specialization,
    )
    Coordinator.objects.create(
        lecturer=profile, programme_managed=programme, appointed_date=today(), lecturer_account=owner
    )
    record(
        user,
        actor,
        AccountChange.Action.CREATED,
        {"role": COORDINATOR, "staffId": staff_id, "programme": programme, "lecturerAccount": str(owner.pk)},
    )
    return staff_accounts().get(pk=user.pk), False


@transaction.atomic
def edit_account(*, actor, account_id, data):
    """Apply the office's edits. Returns ``(user, old_email)``; ``old_email``
    is set when the email changed, so the old address can be told."""
    _lock_staff_accounts()
    user = find_account(account_id, lock=True)
    if user is None:
        raise StaffAccountError({"error": "No such account."}, status=404)
    if lecturer_account_of(user) is not None:
        raise StaffAccountError({"error": FROM_LECTURER}, status=409)
    office = OfficeStaff.objects.select_for_update().filter(user=user).first()
    lecturer = Lecturer.objects.select_for_update().filter(user=user).first()
    profile = office or lecturer

    refused = {}
    if "email" in data and is_alias_email(data["email"]):
        refused["email"] = ALIAS_EMAIL_TYPED
    for field in (*PROFILE_FIELDS, *LECTURER_FIELDS, *OFFICE_FIELDS):
        if field not in data:
            continue
        if profile is None:
            refused[field] = "This account has no staff details yet. Ask the technical administrator."
        elif field in LECTURER_FIELDS and lecturer is None:
            refused[field] = "Only lecturer and coordinator accounts have this."
        elif field in OFFICE_FIELDS and office is None:
            refused[field] = "Only office staff accounts have a position."
        elif field == "department" and lecturer is not None and not data[field]:
            refused[field] = "Enter the department."
    if refused:
        raise StaffAccountError(refused)

    _check_unique(
        email=data["email"] if "email" in data and data["email"] != user.email else None,
        staff_id=data.get("staffId") if "staffId" in data and data["staffId"] != profile.staff_no else None,
        account=user,
    )

    changes = []

    def apply(row, mapping):
        fields = []
        for name, attribute in mapping.items():
            if name in data and data[name] != getattr(row, attribute):
                if name != "email":
                    changes.append({"field": name, "from": getattr(row, attribute), "to": data[name]})
                setattr(row, attribute, data[name])
                fields.append(attribute)
        if fields:
            row.save(update_fields=fields)

    old_email = user.email
    apply(user, USER_FIELDS)
    if profile is not None:
        apply(profile, PROFILE_FIELDS)
    if lecturer is not None:
        apply(lecturer, LECTURER_FIELDS)
    if office is not None:
        apply(office, OFFICE_FIELDS)

    if changes:
        record(user, actor, AccountChange.Action.DETAILS_EDITED, {"changes": changes})
    if user.email != old_email:
        record(user, actor, AccountChange.Action.EMAIL_CHANGED, {"from": old_email, "to": user.email})
    else:
        old_email = None
    if user.role == LECTURER and lecturer is not None:
        _follow_lecturer(actor=actor, owner=user, lecturer=lecturer)
    return staff_accounts().get(pk=user.pk), old_email


ALIAS_FIELDS = (
    ("full_name", "name"),
    ("phone", "phone"),
    ("staff_no", "staffId"),
    ("department", "department"),
    ("title", "title"),
    ("specialization", "researchArea"),
)


def _follow_lecturer(*, actor, owner, lecturer):
    """Copy the lecturer's details to their coordinator account, if they have one."""
    linked = coordinator_account_of(owner)
    if linked is None:
        return
    account = find_account(linked.pk, lock=True)
    profile = Lecturer.objects.select_for_update().get(user=account)
    email, staff_id = alias_email(owner.email), alias_staff_id(lecturer.staff_no)
    try:
        _check_unique(
            email=email if email != account.email else None,
            staff_id=staff_id if staff_id != profile.staff_no else None,
            account=account,
        )
    except StaffAccountError as exc:
        field = "email" if "email" in exc.errors else "staffId"
        clash = email if field == "email" else staff_id
        raise StaffAccountError(
            {field: f"Their coordinator account would become {clash}, which another account already uses."},
            existing={field: exc.existing.get(field)} if exc.existing.get(field) else None,
        ) from None
    wanted = {
        "full_name": owner.full_name,
        "phone": owner.phone,
        "staff_no": staff_id,
        "department": lecturer.department,
        "title": lecturer.title,
        "specialization": lecturer.specialization,
    }
    changes, user_fields, profile_fields = [], [], []
    for attribute, name in ALIAS_FIELDS:
        row = account if attribute in ("full_name", "phone") else profile
        if getattr(row, attribute) != wanted[attribute]:
            changes.append({"field": name, "from": getattr(row, attribute), "to": wanted[attribute]})
            setattr(row, attribute, wanted[attribute])
            (user_fields if row is account else profile_fields).append(attribute)
    old_email = account.email
    if email != old_email:
        account.email = email
        user_fields.append("email")
    if user_fields:
        account.save(update_fields=user_fields)
    if profile_fields:
        profile.save(update_fields=profile_fields)
    if changes:
        record(account, actor, AccountChange.Action.DETAILS_EDITED, {"changes": changes})
    if email != old_email:
        record(account, actor, AccountChange.Action.EMAIL_CHANGED, {"from": old_email, "to": email})


def link_kind(user):
    """Which link fits: activation until a password is set, then reset."""
    if not user.is_active:
        raise StaffAccountError(
            {"error": "Turn sign-in back on before sending a link."}, status=409
        )
    return RESET if user.has_usable_password() else ACTIVATION


def send_access_link(*, actor, user, kind):
    sent = send_activation_email(user) if kind == ACTIVATION else send_password_reset_email(user)
    record(user, actor, AccountChange.Action.LINK_SENT, {"kind": kind, "sent": sent})
    return sent


@transaction.atomic
def copy_activation_link(*, actor, account_id):
    """The activation link itself, for the office to pass on when the email
    keeps failing. Reset links are never handed out, so the office cannot
    sign in as someone who already has a password."""
    user = find_account(account_id, lock=True)
    if user is None:
        raise StaffAccountError({"error": "No such account."}, status=404)
    if link_kind(user) != ACTIVATION:
        raise StaffAccountError(
            {"error": "This account is already activated. Send a password reset link instead."},
            status=409,
        )
    record(user, actor, AccountChange.Action.LINK_COPIED)
    return activation_link(user)


def account_history(user):
    return [
        {
            "id": row.pk,
            "action": row.action,
            "actor": row.actor_name,
            "at": row.created_at.isoformat(),
            "details": row.details,
        }
        for row in user.account_changes.all()[:HISTORY_LIMIT]
    ]


def staff_options():
    """What the Add account form offers: the faculty's departments, each
    programme with the coordinator who manages it, if any, and the lecturers
    who can be made a coordinator."""
    programmes = []
    for programme in APPROVED_PROGRAMMES:
        holder = programme_coordinator(programme)
        programmes.append(
            {
                "programme": programme,
                "coordinator": {"id": str(holder.pk), "name": holder.full_name} if holder else None,
            }
        )
    lecturers = (
        User.objects.filter(
            role=LECTURER, is_active=True, lecturer__lifecycle_status=Lecturer.Lifecycle.ACTIVE
        )
        .exclude(linked_coordinator__lecturer__user__is_active=True)
        .select_related("lecturer", "linked_coordinator__lecturer__user")
        .order_by("full_name", "pk")
    )
    return {
        "departments": FACULTY_DEPARTMENTS,
        "programmes": programmes,
        "lecturers": [
            {
                "id": str(user.pk),
                "name": user.full_name,
                "staffId": user.lecturer.staff_no,
                "programme": user.lecturer.programme,
                "reopens": coordinator_account_of(user) is not None,
            }
            for user in lecturers
        ],
    }


def _work(counts):
    return [{"key": key, "count": count} for key, count in counts.items() if count]


def active_work(user):
    """What a lecturer or coordinator still has open, from the participant
    lifecycle's own count, so both screens agree."""
    lecturer = user._related_or_none("lecturer")
    return _work(lecturer_blockers(lecturer)) if lecturer is not None else []


def duty_work(user, duty):
    """Open work that needs the duty: removing it would strand these."""
    if duty == SUPERVISOR:
        counts = {
            "activeSupervisorAppointments": SupervisorAppointment.objects.filter(
                supervisor=user, status=SupervisorAppointment.Status.ACTIVE
            ).count(),
            "pendingSupervisorApplications": SupervisorApplication.objects.filter(
                proposed_supervisor=user,
                status__in=[
                    SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
                    SupervisorApplication.Status.PENDING_COORDINATOR,
                ],
            ).count(),
            "activeCoSupervisorAppointments": CoSupervisorAppointment.objects.filter(
                supervisor=user, status=CoSupervisorAppointment.Status.ACTIVE
            ).count(),
            "pendingCoSupervisorNominations": CoSupervisorNomination.objects.filter(
                candidate=user, status__in=CoSupervisorNomination.PENDING_STATUSES
            ).count(),
        }
    else:
        counts = {
            "activePanelAppointments": PanelAppointment.objects.filter(
                panel_member=user, status=PanelAppointment.Status.ACTIVE
            ).count(),
            "pendingPanelRecommendations": PanelRecommendation.objects.filter(
                recommended_member=user,
                status__in=PanelRecommendation.PENDING_STATUSES,
            ).count(),
        }
    return _work(counts)


def capacity_summary(user):
    """Each duty's capacity this semester, read from Lecturer capacity. A
    limit left behind for a duty the lecturer no longer has is flagged, so
    the office can clear it there."""
    if user.role != LECTURER or user._related_or_none("lecturer") is None:
        return None
    semester = current_effective_semester()
    if semester is None:
        return {"semester": None, "duties": []}
    duties = duties_of(user)
    entries = list(
        LecturerCapacityEntry.objects.filter(
            lecturer_id=user.pk,
            plan__academic_semester=semester,
            plan__lifecycle_status__in=[
                SemesterCapacityPlan.Lifecycle.DRAFT,
                SemesterCapacityPlan.Lifecycle.PUBLISHED,
            ],
        ).values("supervisor_limit", "panel_limit")
    )
    rows = []
    for duty, role, field in (
        (SUPERVISOR, CapacityRole.SUPERVISOR, "supervisor_limit"),
        (PANEL, CapacityRole.PANEL, "panel_limit"),
    ):
        if duty in duties:
            result = resolve_lecturer_capacity(user=user, semester=semester, role=role)
            rows.append(
                {
                    "duty": duty,
                    "state": str(result.state),
                    "limit": result.limit,
                    "load": result.active_load + result.reserved_load,
                    "unavailableUntil": (
                        result.unavailable_until.isoformat() if result.unavailable_until else None
                    ),
                }
            )
        elif any(entry[field] is not None for entry in entries):
            rows.append({"duty": duty, "state": "LIMIT_WITHOUT_DUTY"})
    return {"semester": semester.label, "duties": rows}


@transaction.atomic
def set_duties(*, actor, account_id, duties):
    _lock_staff_accounts()
    user = find_account(account_id, lock=True)
    if user is None:
        raise StaffAccountError({"error": "No such account."}, status=404)
    lecturer = Lecturer.objects.select_for_update().filter(user=user).first()
    if user.role != LECTURER or lecturer is None:
        raise StaffAccountError(
            {
                "error": "Only lecturer accounts have duties. Supervisor and panel work "
                "stays on the lecturer account."
            },
            status=409,
        )
    list(Supervisor.objects.select_for_update().filter(lecturer=lecturer))
    list(Panel.objects.select_for_update().filter(lecturer=lecturer))
    before = duties_of(staff_accounts().get(pk=user.pk))
    added = [duty for duty in duties if duty not in before]
    removed = [duty for duty in before if duty not in duties]
    if added and (not user.is_active or lecturer.lifecycle_status != Lecturer.Lifecycle.ACTIVE):
        raise StaffAccountError(
            {"error": "Duties can only be added while the lecturer is active and can sign in."},
            status=409,
        )
    blockers = [item for duty in removed for item in duty_work(user, duty)]
    if blockers:
        names = " and ".join(removed)
        raise StaffAccountError(
            {"error": f"{user.full_name} still has work that needs the {names} duty. Resolve it first."},
            status=409,
            blockers=blockers,
        )
    for duty in added:
        (Supervisor if duty == SUPERVISOR else Panel).objects.create(lecturer=lecturer)
    for duty in removed:
        (Supervisor if duty == SUPERVISOR else Panel).objects.filter(lecturer=lecturer).delete()
    if added or removed:
        record(user, actor, AccountChange.Action.DUTIES_CHANGED, {"from": before, "to": list(duties)})
    return staff_accounts().get(pk=user.pk)


def waiting_approvals(programme):
    """Approvals waiting for the coordinator of ``programme``."""
    programme = programme.strip()
    counts = {
        "supervisorRequests": 0,
        "coSupervisorNominations": 0,
        "panelNominations": 0,
        "amendments": 0,
    }
    if programme:
        counts = {
            "supervisorRequests": SupervisorApplication.objects.filter(
                status=SupervisorApplication.Status.PENDING_COORDINATOR,
                student__programme__iexact=programme,
            ).count(),
            "coSupervisorNominations": CoSupervisorNomination.objects.filter(
                status=CoSupervisorNomination.Status.PENDING_COORDINATOR,
                student__programme__iexact=programme,
            ).count(),
            "panelNominations": PanelRecommendation.objects.filter(
                status=PanelRecommendation.Status.PENDING_COORDINATOR,
                profile__programme__iexact=programme,
            ).count(),
            "amendments": ResearchAmendment.objects.filter(
                Q(
                    status__in=[
                        ResearchAmendment.Status.PENDING_COORDINATOR,
                        ResearchAmendment.Status.PENDING_SOURCE_COORDINATOR,
                    ],
                    source_programme__iexact=programme,
                )
                | Q(
                    status=ResearchAmendment.Status.PENDING_DESTINATION_COORDINATOR,
                    destination_programme__iexact=programme,
                )
            ).count(),
        }
    counts["total"] = sum(counts.values())
    return counts


def _change_lecturer_programme(*, actor, user, programme, check):
    lecturer = Lecturer.objects.select_for_update().filter(user=user).first()
    if lecturer is None:
        raise StaffAccountError({"error": "This account has no staff details yet. Ask the technical administrator."}, status=409)
    before = lecturer.programme.strip()
    if check:
        return {"from": {"programme": before, "waiting": None}, "to": {"programme": programme, "waiting": None}}
    if before.casefold() != programme.casefold():
        lecturer.programme = programme
        lecturer.save(update_fields=["programme"])
        record(user, actor, AccountChange.Action.PROGRAMME_CHANGED, {"from": before, "to": programme})
    return staff_accounts().get(pk=user.pk)


@transaction.atomic
def change_programme(*, actor, account_id, programme, check=False):
    """Move a coordinator or lecturer to another programme, or to none. With
    ``check``, nothing is saved and, for a coordinator, the approvals that
    would move are counted."""
    _lock_staff_accounts()
    user = find_account(account_id, lock=True)
    if user is None:
        raise StaffAccountError({"error": "No such account."}, status=404)
    if user.role == LECTURER:
        return _change_lecturer_programme(actor=actor, user=user, programme=programme, check=check)
    coordinator = Coordinator.objects.select_for_update().filter(lecturer__user=user).first()
    if user.role != COORDINATOR or coordinator is None:
        raise StaffAccountError({"error": "Only lecturer and coordinator accounts have a programme."}, status=409)
    before = coordinator.programme_managed.strip()
    if programme and user.is_active:
        _check_unique(programme=programme, account=user)
    if check:
        return {
            "from": {"programme": before, "waiting": waiting_approvals(before)},
            "to": {"programme": programme, "waiting": waiting_approvals(programme)},
        }
    if before.casefold() != programme.casefold():
        coordinator.programme_managed = programme
        coordinator.save(update_fields=["programme_managed"])
        record(user, actor, AccountChange.Action.PROGRAMME_CHANGED, {"from": before, "to": programme})
    return staff_accounts().get(pk=user.pk)


@transaction.atomic
def set_sign_in(*, actor, account_id, on, reason=""):
    _lock_staff_accounts()
    user = find_account(account_id, lock=True)
    if user is None:
        raise StaffAccountError({"error": "No such account."}, status=404)
    lecturer = Lecturer.objects.select_for_update().filter(user=user).first()
    if on:
        if user.is_active:
            raise StaffAccountError({"error": "Sign-in is already on."}, status=409)
        if lecturer is not None and lecturer.lifecycle_status in (Lecturer.Lifecycle.RETIRED, Lecturer.Lifecycle.RESIGNED):
            raise StaffAccountError(
                {"error": "This lecturer has left. Use Returned to work to turn sign-in back on."}, status=409
            )
        owner = lecturer_account_of(user)
        if owner is not None and (
            not owner.is_active or owner.lecturer.lifecycle_status != Lecturer.Lifecycle.ACTIVE
        ):
            raise StaffAccountError(
                {"error": "Turn sign-in back on for the lecturer account first."}, status=409
            )
        coordinator = _part(lecturer, "coordinator")
        if user.role == COORDINATOR and coordinator and coordinator.programme_managed.strip():
            holder = programme_coordinator(coordinator.programme_managed, user)
            if holder is not None:
                raise StaffAccountError(
                    {
                        "error": f"{holder.full_name} now coordinates this programme. "
                        "Change this account's programme first."
                    },
                    existing={"programme": _holder(holder)},
                    status=409,
                )
        user.is_active = True
        user.save(update_fields=["is_active"])
        record(user, actor, AccountChange.Action.SIGN_IN_ON, {"reason": reason} if reason else {})
        return staff_accounts().get(pk=user.pk)

    if not reason:
        raise StaffAccountError({"reason": "Give a reason."})
    if user.pk == actor.pk:
        raise StaffAccountError({"error": "You cannot turn off your own sign-in."}, status=409)
    if not user.is_active:
        raise StaffAccountError({"error": "Sign-in is already off."}, status=409)
    others = User.objects.filter(role=OFFICE, is_active=True).exclude(pk=user.pk)
    if user.role == OFFICE and not others.exists():
        raise StaffAccountError(
            {"error": "This is the last office account that can sign in."}, status=409
        )
    blockers = _work(lecturer_blockers(lecturer)) if lecturer is not None else []
    if blockers:
        raise StaffAccountError(
            {"error": f"{user.full_name} still has active work. Resolve it in Participant lifecycle first."},
            status=409,
            blockers=blockers,
        )
    user.is_active = False
    user.save(update_fields=["is_active"])
    blacklist_user_refresh_tokens(user)
    record(user, actor, AccountChange.Action.SIGN_IN_OFF, {"reason": reason})
    if user.role == LECTURER:
        close_coordinator_account(owner=user, actor=actor, reason=f"The lecturer account was turned off: {reason}")
    return staff_accounts().get(pk=user.pk)


def close_coordinator_account(*, owner, actor, reason):
    """Turn off the lecturer's coordinator account along with their own."""
    linked = coordinator_account_of(owner)
    if linked is None:
        return
    account = User.objects.select_for_update().get(pk=linked.pk)
    if not account.is_active:
        return
    account.is_active = False
    account.save(update_fields=["is_active"])
    blacklist_user_refresh_tokens(account)
    record(account, actor, AccountChange.Action.SIGN_IN_OFF, {"reason": reason})


# Rows that belong to the account itself, or only tell it things, so they do
# not count as the account having been used.
OWN_ROWS = {
    "accounts.officestaff",
    "accounts.lecturer",
    "accounts.student",
    "accounts.coordinator",
    "accounts.supervisor",
    "accounts.panel",
    "accounts.accountchange",
    "accounts.user_groups",
    "accounts.user_user_permissions",
    "announcements.notification",
    "announcements.weeklysummarylog",
    "token_blacklist.outstandingtoken",
}


def _linked_records(instance):
    """Names of the kinds of records that point at ``instance``."""
    names = []
    for relation in instance._meta.get_fields(include_hidden=True):
        if not relation.auto_created or relation.concrete or relation.many_to_many:
            continue
        model = relation.related_model
        if model._meta.label_lower in OWN_ROWS:
            continue
        if model._base_manager.filter(**{relation.field.name: instance}).exists():
            owner = model._meta.auto_created or model
            name = str(owner._meta.verbose_name_plural)
            if name not in names:
                names.append(name)
    return names


def deletion_check(user, actor):
    """Why ``user`` cannot be deleted; empty when it can."""
    reasons = []
    if actor is not None and user.pk == actor.pk:
        reasons.append("This is your own account.")
    if user.last_portal_login or user.last_login:
        reasons.append("It has been used to sign in.")
    if coordinator_account_of(user) is not None:
        reasons.append("It has a Programme Coordinator account. Delete that account first.")
    linked = _linked_records(user)
    lecturer = user._related_or_none("lecturer")
    if lecturer is not None:
        linked += [name for name in _linked_records(lecturer) if name not in linked]
    if linked:
        reasons.append(f"Records point to it: {', '.join(linked)}.")
    return reasons


@transaction.atomic
def delete_account(*, actor, account_id):
    _lock_staff_accounts()
    user = find_account(account_id, lock=True)
    if user is None:
        raise StaffAccountError({"error": "No such account."}, status=404)
    reasons = deletion_check(user, actor)
    if reasons:
        raise StaffAccountError(
            {"error": "This account cannot be deleted. Turn off sign-in instead."},
            status=409,
            blockers=[{"key": "reason", "text": reason} for reason in reasons],
        )
    profile = user._related_or_none("office_staff") or user._related_or_none("lecturer")
    record(
        user,
        actor,
        AccountChange.Action.DELETED,
        {"role": user.role, "staffId": profile.staff_no if profile else ""},
    )
    user.delete()
