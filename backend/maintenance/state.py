"""Whether the portal is under maintenance, and the PG office's changes to it.

Every signed-in request asks, so the answer is kept in the cache and read from
the database only when the cache has lost it.
"""
import math
from datetime import timedelta

from django.core.cache import cache
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone

from accounts.authorization import office_actor

from .models import MaintenanceEvent, PortalMaintenance

CACHE_KEY = "portal-maintenance"
NOTHING = {"startsAt": None, "expectedEnd": None, "message": ""}
OFF, PLANNED, ON = "off", "planned", "on"

DEFAULT_MESSAGE = "The portal is down for maintenance. Please try again later."
USE_DETAIL = "The portal is under maintenance. Only PG office staff can use it until it ends."
SIGN_IN_DETAIL = "The portal is under maintenance. Only PG office staff can sign in until it ends."
COMMAND_LINE = "Technical administrator (command line)"

MAX_MESSAGE = 500
MAX_NOTICE = timedelta(days=90)
MAX_LENGTH = timedelta(days=30)
HISTORY_SHOWN = 5


class MaintenanceProblem(Exception):
    def __init__(self, errors):
        super().__init__(errors)
        self.errors = errors


def _snapshot(row):
    if row is None or row.starts_at is None:
        return dict(NOTHING)
    return {"startsAt": row.starts_at, "expectedEnd": row.expected_end, "message": row.message}


def current():
    found = cache.get(CACHE_KEY)
    if found is None:
        found = _snapshot(PortalMaintenance.objects.filter(pk=1).first())
        cache.set(CACHE_KEY, found, None)
    return found


def _remember(snapshot):
    # Set now so this request sees it, and again on commit in case a request
    # that missed the cache read the old row in between.
    cache.set(CACHE_KEY, snapshot, None)
    transaction.on_commit(lambda: cache.set(CACHE_KEY, snapshot, None))


def status(snapshot=None, now=None):
    snapshot = current() if snapshot is None else snapshot
    if snapshot["startsAt"] is None:
        return OFF
    return ON if snapshot["startsAt"] <= (now or timezone.now()) else PLANNED


def is_on():
    return status() == ON


def blocks(user):
    """True while maintenance is on, for everyone but PG office staff."""
    return is_on() and not office_actor(user)


def _iso(value):
    return value.isoformat() if value else None


def public_dict(snapshot=None):
    snapshot = current() if snapshot is None else snapshot
    state = status(snapshot)
    return {
        "status": state,
        "startsAt": _iso(snapshot["startsAt"]),
        "expectedEnd": _iso(snapshot["expectedEnd"]),
        "message": "" if state == OFF else snapshot["message"] or DEFAULT_MESSAGE,
    }


def _retry_after(snapshot):
    end = snapshot["expectedEnd"]
    if end is None or end <= timezone.now():
        return 300
    return min(max(math.ceil((end - timezone.now()).total_seconds()), 60), 86400)


def maintenance_response(detail=USE_DETAIL):
    snapshot = current()
    response = JsonResponse(
        {"detail": detail, "code": "portal_maintenance", "maintenance": public_dict(snapshot)},
        status=503,
    )
    response["Retry-After"] = str(_retry_after(snapshot))
    return response


def _event_dict(event):
    return {
        "id": event.pk,
        "action": event.action,
        "actionLabel": event.get_action_display(),
        "by": event.actor_name,
        "at": _iso(event.created_at),
        "startsAt": _iso(event.starts_at),
        "expectedEnd": _iso(event.expected_end),
    }


def office_dict():
    row = PortalMaintenance.objects.filter(pk=1).first()
    payload = public_dict(_snapshot(row))
    on_or_planned = payload["status"] != OFF
    payload.update(
        defaultMessage=DEFAULT_MESSAGE,
        setBy=row.set_by_name if on_or_planned else "",
        updatedAt=_iso(row.updated_at) if on_or_planned else None,
        history=[_event_dict(event) for event in MaintenanceEvent.objects.all()[:HISTORY_SHOWN]],
    )
    return payload


def _who(actor):
    return getattr(actor, "full_name", "") or COMMAND_LINE


def _note(action, actor, starts_at, expected_end, message):
    MaintenanceEvent.objects.create(
        action=action,
        actor=actor,
        actor_name=_who(actor),
        starts_at=starts_at,
        expected_end=expected_end,
        message=message,
    )


def _problems(was, starts_at, start, expected_end, message, now):
    errors = {}
    if starts_at is not None:
        if was == ON:
            errors["startsAt"] = "Maintenance has already started. You can change the expected end and the message."
        elif starts_at <= now:
            errors["startsAt"] = "Choose a time in the future, or start it now."
        elif starts_at > now + MAX_NOTICE:
            errors["startsAt"] = "Plan it within the next 90 days."
    if expected_end is not None and not errors:
        if expected_end <= max(start, now):
            errors["expectedEnd"] = (
                "The expected end must be after the start." if start > now else "The expected end must be later than now."
            )
        elif expected_end > start + MAX_LENGTH:
            errors["expectedEnd"] = "Keep it within 30 days of the start."
    if len(message) > MAX_MESSAGE:
        errors["message"] = "Keep the message under 500 characters."
    return errors


def change(actor, *, starts_at=None, expected_end=None, message=""):
    """Start maintenance now (no ``starts_at``) or plan it for later. Once it is
    on, only the expected end and the message can change."""
    now = timezone.now()
    message = (message or "").strip()
    with transaction.atomic():
        PortalMaintenance.objects.get_or_create(pk=1)
        row = PortalMaintenance.objects.select_for_update().get(pk=1)
        was = status(_snapshot(row), now)
        start = row.starts_at if was == ON else starts_at or now
        errors = _problems(was, starts_at, start, expected_end, message, now)
        if errors:
            raise MaintenanceProblem(errors)

        if was == ON or (was == PLANNED and start > now):
            action = MaintenanceEvent.Action.CHANGED
        else:
            action = MaintenanceEvent.Action.STARTED if start <= now else MaintenanceEvent.Action.PLANNED
        row.starts_at, row.expected_end, row.message = start, expected_end, message
        row.set_by, row.set_by_name, row.updated_at = actor, _who(actor), now
        row.save()
        _note(action, actor, start, expected_end, message)
        snapshot = _snapshot(row)
    _remember(snapshot)
    return action


def end(actor):
    """End maintenance that is on, or cancel maintenance that is planned."""
    now = timezone.now()
    with transaction.atomic():
        row = PortalMaintenance.objects.select_for_update().filter(pk=1).first()
        was = status(_snapshot(row), now)
        if was == OFF:
            raise MaintenanceProblem({"detail": "Maintenance is not on or planned."})
        action = MaintenanceEvent.Action.ENDED if was == ON else MaintenanceEvent.Action.CANCELLED
        _note(action, actor, row.starts_at, row.expected_end, row.message)
        row.starts_at = row.expected_end = None
        row.message = ""
        row.set_by, row.set_by_name, row.updated_at = actor, _who(actor), now
        row.save()
    _remember(dict(NOTHING))
    return action
