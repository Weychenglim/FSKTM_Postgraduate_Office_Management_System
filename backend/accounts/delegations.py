"""Programme-bound delegation grants and append-only revocation audit."""
import hashlib
from zoneinfo import ZoneInfo

from django.db import connection, models, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from .authorization import office_actor
from .models import Coordinator, CoordinatorDelegation, Lecturer, Student, User
from .programmes import APPROVED_PROGRAMMES


class DelegationConflict(APIException):
    status_code = 409
    default_detail = "The delegation changed; refresh and try again."


def today():
    return timezone.localtime(timezone.now(), ZoneInfo('Asia/Kuala_Lumpur')).date()


def is_office(user):
    return office_actor(user)


def require_office(user):
    if not is_office(user):
        raise PermissionDenied('Only Office Staff/Admin may manage coordinator delegations.')


def recognised_programmes():
    from appointments.models import StudentResearchProfile
    values = list(APPROVED_PROGRAMMES)
    values += list(Student.objects.values_list('programme', flat=True))
    values += list(Coordinator.objects.values_list('programme_managed', flat=True))
    values += list(StudentResearchProfile.objects.values_list('programme', flat=True))
    canonical = {}
    for value in values:
        if value.strip():
            canonical.setdefault(value.strip().casefold(), value.strip())
    return sorted(canonical.values(), key=str.casefold)


def delegation_status(row):
    if row.revoked_at:
        return 'REVOKED'
    date = today()
    if date < row.starts_on:
        return 'SCHEDULED'
    if date > row.ends_on:
        return 'EXPIRED'
    return 'ACTIVE'


def serialize_delegation(row, actor):
    person = lambda user: {'id': user.pk, 'name': user.full_name}
    state = delegation_status(row)
    return {
        'id': row.pk, 'programme': row.programme,
        'coordinator': person(row.coordinator),
        'startsOn': row.starts_on.isoformat(), 'endsOn': row.ends_on.isoformat(),
        'justification': row.justification, 'status': state,
        'grantedBy': person(row.granted_by), 'createdAt': row.created_at.isoformat(),
        'revokedAt': row.revoked_at.isoformat() if row.revoked_at else None,
        'revokedBy': person(row.revoked_by) if row.revoked_by else None,
        'revocationReason': row.revocation_reason,
        'canRevoke': bool(is_office(actor) and state in ('SCHEDULED', 'ACTIVE')),
    }


def _lock_programme(programme):
    # A transaction-scoped PostgreSQL advisory lock also protects the first grant,
    # for which there is no delegation row to lock. Hash collisions only serialize
    # unrelated programmes, never weaken the overlap check.
    key = int.from_bytes(hashlib.sha256(('coordinator-delegation:' + programme.casefold()).encode()).digest()[:8], 'big', signed=True)
    with connection.cursor() as cursor:
        cursor.execute('SELECT pg_advisory_xact_lock(%s)', [key])


@transaction.atomic
def grant_delegation(*, actor, coordinator_id, programme, starts_on, ends_on, justification):
    require_office(actor)
    justification = str(justification or '').strip()
    if not justification:
        raise ValidationError({'justification': 'A justification is required.'})
    if starts_on < today() or ends_on < starts_on:
        raise ValidationError('Start must be today or later and end must be on or after start.')
    canonical = {p.casefold(): p for p in recognised_programmes()}
    programme = canonical.get(str(programme or '').strip().casefold())
    if not programme:
        raise ValidationError({'programme': 'Select a recognised programme.'})
    _lock_programme(programme)
    lecturer = Lecturer.objects.select_for_update().filter(pk=coordinator_id).first()
    from .authorization import _eligible
    if not lecturer or not _eligible(lecturer.user):
        raise ValidationError({'coordinatorId': 'Select an active Programme Coordinator with an active Lecturer profile.'})
    regular = Coordinator.objects.get(pk=coordinator_id).programme_managed.strip()
    if regular.casefold() == programme.casefold():
        raise ValidationError({'programme': 'The coordinator already manages this regular programme.'})
    if CoordinatorDelegation.objects.filter(programme__iexact=programme, revoked_at__isnull=True, starts_on__lte=ends_on, ends_on__gte=starts_on).exists():
        raise DelegationConflict('An acting coordinator already covers this programme during these dates.')
    return CoordinatorDelegation.objects.create(coordinator_id=coordinator_id, programme=programme, starts_on=starts_on, ends_on=ends_on, justification=justification, granted_by=actor)


@transaction.atomic
def revoke_delegation(*, delegation_id, actor, reason):
    require_office(actor)
    reason = str(reason or '').strip()
    if not reason:
        raise ValidationError({'reason': 'A revocation reason is required.'})
    reference = CoordinatorDelegation.objects.get(pk=delegation_id)
    Lecturer.objects.select_for_update().get(pk=reference.coordinator_id)
    row = CoordinatorDelegation.objects.select_for_update().get(pk=delegation_id)
    if delegation_status(row) not in ('SCHEDULED', 'ACTIVE'):
        raise DelegationConflict('Only scheduled or active delegations can be revoked.')
    row.revoked_at, row.revoked_by, row.revocation_reason = timezone.now(), actor, reason
    # Sole controlled update path; public manager/model updates are forbidden.
    models.QuerySet(model=CoordinatorDelegation, using=row._state.db).filter(pk=row.pk, revoked_at__isnull=True).update(revoked_at=row.revoked_at, revoked_by=actor, revocation_reason=reason)
    return row
