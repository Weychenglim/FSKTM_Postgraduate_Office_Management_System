"""Coordinator accounts that belong to a lecturer.

An account has one role, so a lecturer who coordinates a programme signs in to
a second account. It uses the lecturer's own address with ``+coordinator``
added, and every email to it is delivered to the lecturer's inbox.
"""
from email.utils import formataddr, parseaddr

from django.core.exceptions import ObjectDoesNotExist

TAG = "+coordinator"
STAFF_ID_SUFFIX = "-PC"


def alias_email(email):
    local, _, domain = email.strip().lower().rpartition("@")
    return f"{local}{TAG}@{domain}"


def is_alias_email(email):
    local, at, _ = (email or "").strip().lower().rpartition("@")
    return bool(at) and TAG in local


def real_address(address):
    name, email = parseaddr(address)
    local, at, domain = email.rpartition("@")
    if not at or not local.lower().endswith(TAG):
        return address
    real = f"{local[: -len(TAG)]}@{domain}"
    return formataddr((name, real)) if name else real


def alias_staff_id(staff_no):
    return f"{staff_no}{STAFF_ID_SUFFIX}"


def shown_staff_id(staff_no):
    if staff_no.upper().endswith(STAFF_ID_SUFFIX):
        return staff_no[: -len(STAFF_ID_SUFFIX)]
    return staff_no


def _part(row, name):
    if row is None:
        return None
    try:
        return getattr(row, name)
    except ObjectDoesNotExist:
        return None


def is_coordinator_account(user):
    coordinator = _part(_part(user, "lecturer"), "coordinator")
    return coordinator is not None and coordinator.lecturer_account_id is not None


def lecturer_account_of(user):
    """The lecturer's own account, when ``user`` is their coordinator account."""
    coordinator = _part(_part(user, "lecturer"), "coordinator")
    if coordinator is None or not coordinator.lecturer_account_id:
        return None
    return coordinator.lecturer_account


def coordinator_account_of(user):
    """The coordinator account that belongs to the lecturer ``user``, if any."""
    linked = _part(user, "linked_coordinator")
    return linked.lecturer.user if linked is not None else None
