"""Explicit Office authorization changes capacity policy only, never request history."""
from django.db import transaction
from django.db.models import Q
from academics.capacity import CapacityConflict, resolve_lecturer_capacity, assert_capacity_allows_assignment
from academics.models import AcademicSemester
from academics.services import current_effective_semester
from accounts.authorization import office_actor, coordinator_manages_programme
from accounts.models import Student, User
from .models import SupervisorApplication, CoSupervisorNomination, PanelRecommendation, CapacityReassessmentEvent

KINDS = {
    'SUPERVISOR': (SupervisorApplication, 'supervisor_application', ('SUBMITTED_TO_SUPERVISOR', 'PENDING_COORDINATOR')),
    'CO_SUPERVISOR': (CoSupervisorNomination, 'co_supervisor_nomination', CoSupervisorNomination.PENDING_STATUSES),
    'PANEL': (PanelRecommendation, 'panel_recommendation', PanelRecommendation.PENDING_STATUSES),
}

class ReassessmentConflict(CapacityConflict):
    pass

class ReassessmentForbidden(Exception):
    pass

def lock_policy_semesters():
    """Serialize lifecycle/policy writes without blocking unrelated FK inserts."""
    return list(AcademicSemester.objects.select_for_update(no_key=True).order_by("pk"))

def office(actor):
    return office_actor(actor)

def require_reader(actor):
    if not actor.is_active or not (office(actor) or actor.role == User.Role.COORDINATOR):
        raise ReassessmentForbidden('Only Office Staff/Admin and authorized Programme Coordinators can read capacity reassessments.')

def kind_of(row):
    return next(kind for kind, (model, _, _) in KINDS.items() if isinstance(row, model))

def student_of(row):
    return row.profile.student.student if isinstance(row, PanelRecommendation) else row.student

def lock_request(row):
    """Caller holds atomic; acquire policy, Student, then request in that order."""
    lock_policy_semesters()
    student_id = row.profile.student_id if isinstance(row, PanelRecommendation) else row.student_id
    if student_id:
        Student.objects.select_for_update().get(pk=student_id)
    return type(row).objects.select_for_update().get(pk=row.pk)

def assert_not_archived(row):
    if row.academic_semester and row.academic_semester.lifecycle_status == 'ARCHIVED':
        raise ReassessmentConflict('Archived semester requests are locked.')

def candidate_of(row):
    return row.recommended_member if isinstance(row, PanelRecommendation) else (row.candidate if isinstance(row, CoSupervisorNomination) else row.proposed_supervisor)

def semester_payload(row):
    return {'id': row.pk, 'label': row.label, 'lifecycleStatus': row.lifecycle_status} if row else None

def policy_payload(result):
    if result is None:
        return None
    return {'semesterId': result.semester_id, 'planId': result.plan_id, 'planVersion': result.plan_version,
            'limit': result.limit, 'activeLoad': result.active_load, 'reservedLoad': result.reserved_load,
            'state': str(result.state), 'unavailableUntil': result.unavailable_until.isoformat() if result.unavailable_until else None}

def policy(row, semester):
    if semester is None:
        return None
    return resolve_lecturer_capacity(user=candidate_of(row), semester=semester,
        role='PANEL' if isinstance(row, PanelRecommendation) else 'SUPERVISOR',
        exclude_panel_recommendation_id=row.pk if isinstance(row, PanelRecommendation) else None,
        exclude_supervisor_application_id=row.pk if isinstance(row, SupervisorApplication) and row.status == 'PENDING_COORDINATOR' else None)

def latest(row):
    return row.capacity_reassessments.order_by('-pk').first()

def current_grant(row):
    event = latest(row)
    return event if event and event.action in ('GRANTED', 'REPLACED') else None

def capacity_semester(row):
    source = row.academic_semester
    # Archived records cannot be brought back into an appointment workflow.
    if source and source.lifecycle_status == AcademicSemester.Lifecycle.ARCHIVED:
        raise ReassessmentConflict('Archived semester requests cannot be approved.')
    event = latest(row)
    # Approved handoff repairs retain the policy consumed by that approval.
    # Pending grants still require the currently Active target below.
    if row.status == 'APPROVED' and event and event.action == 'CONSUMED':
        target = event.target_semester
        if target.lifecycle_status == AcademicSemester.Lifecycle.ARCHIVED:
            raise ReassessmentConflict('Archived capacity policies cannot be used for appointment repair.')
        return target
    grant = event if event and event.action in ('GRANTED', 'REPLACED') else None
    if grant is None:
        return source
    active = current_effective_semester()
    if source is None or source.lifecycle_status != AcademicSemester.Lifecycle.CLOSED or active is None or active.pk != grant.target_semester_id:
        raise ReassessmentConflict('Capacity reassessment is stale; Office must authorize the current Active semester again.')
    return active

def assert_request_capacity(row):
    return assert_capacity_allows_assignment(user=candidate_of(row), semester=capacity_semester(row),
        role='PANEL' if isinstance(row, PanelRecommendation) else 'SUPERVISOR',
        exclude_panel_recommendation_id=row.pk if isinstance(row, PanelRecommendation) else None,
        exclude_supervisor_application_id=row.pk if isinstance(row, SupervisorApplication) and row.status == 'PENDING_COORDINATOR' else None)

def _event(row, actor, action, semester, reason='', authorization=None, result=None):
    return CapacityReassessmentEvent.objects.create(**{KINDS[kind_of(row)][1]: row},
        actor=actor, actor_role=actor.role, actor_name=actor.full_name, action=action,
        target_semester=semester, reason=reason, authorization=authorization,
        request_status=row.status, policy=policy_payload(result) or {})

def consume(row, actor, result):
    grant = current_grant(row)
    if grant:
        _event(row, actor, 'CONSUMED', grant.target_semester, authorization=grant, result=result)

def request_payload(row, actor, active=None):
    active = active if active is not None else current_effective_semester()
    student = student_of(row)
    events = list(row.capacity_reassessments.select_related('target_semester').order_by('pk'))
    last = events[-1] if events else None
    grant = next((e for e in reversed(events) if e.action in ('GRANTED', 'REPLACED')), None)
    pending = row.status in KINDS[kind_of(row)][2]
    closed = row.academic_semester is not None and row.academic_semester.lifecycle_status == 'CLOSED'
    state = None
    if grant:
        state = {'REVOKED': 'REVOKED', 'CONSUMED': 'CONSUMED'}.get(last.action)
        state = state or ('ACTIVE' if pending and closed and active and active.pk == grant.target_semester_id else 'STALE')
    return {'latestEventId': last.pk if last else None, 'kind': kind_of(row), 'id': row.pk, 'status': row.status,
        'student': {'id': student.pk, 'name': student.user.full_name, 'matricNo': student.matric_no, 'programme': student.programme},
        'candidate': {'id': candidate_of(row).pk, 'name': candidate_of(row).full_name},
        'originalSemester': semester_payload(row.academic_semester),
        'originalCapacity': policy_payload(policy(row, row.academic_semester)),
        'currentCapacity': policy_payload(policy(row, active)),
        'authorization': {'id': grant.pk, 'targetSemester': semester_payload(grant.target_semester), 'reason': grant.reason,
            'createdAt': grant.created_at.isoformat(), 'state': state} if grant else None,
        'history': [{'id': e.pk, 'action': e.action, 'actorName': e.actor_name, 'actorRole': e.actor_role, 'reason': e.reason,
            'createdAt': e.created_at.isoformat(), 'targetSemester': semester_payload(e.target_semester), 'policy': e.policy or None} for e in events],
        'canAuthorize': bool(office(actor) and pending and closed and active),
        'canRevoke': bool(office(actor) and pending and closed and state in ('ACTIVE', 'STALE'))}

def collection(actor, student_id=None):
    require_reader(actor)
    active = current_effective_semester()
    result = []
    for kind, (model, _, pending) in KINDS.items():
        rows = model.objects.filter(Q(academic_semester__lifecycle_status='CLOSED', status__in=pending) | Q(capacity_reassessments__isnull=False)).distinct()
        rows = rows.filter(profile__student_id=student_id) if kind == 'PANEL' and student_id else (rows.filter(student_id=student_id) if student_id else rows)
        for row in rows.select_related('academic_semester'):
            if kind == 'PANEL' and not row.profile.student_id:
                continue
            student = student_of(row)
            if office(actor) or coordinator_manages_programme(actor, student.programme):
                result.append(request_payload(row, actor, active))
    return {'activeSemester': semester_payload(active), 'requests': result}

@transaction.atomic
def decide(*, actor, kind, pk, action, data):
    if not office(actor):
        raise ReassessmentForbidden('Only Office Staff/Admin may authorize or revoke capacity reassessment.')
    if kind not in KINDS:
        raise ValueError('Unknown appointment request kind.')
    model, _, pending = KINDS[kind]
    # Semester policy writers use semesters -> plans -> lecturers. Take the
    # semester lock first, then the shared student -> request -> lecturer order.
    lock_policy_semesters()
    reference = model.objects.get(pk=pk)
    if kind == 'PANEL' and not reference.profile.student_id:
        raise ReassessmentConflict('Link the legacy research profile to a student before reassessment.')
    Student.objects.select_for_update().get(pk=student_of(reference).pk)
    row = model.objects.select_for_update().get(pk=pk)
    if row.status != data['expectedStatus']:
        raise ReassessmentConflict('The approval stage changed; refresh before retrying.')
    if row.status not in pending or not row.academic_semester or row.academic_semester.lifecycle_status != 'CLOSED':
        raise ReassessmentConflict('Only pending requests from Closed semesters may be reassessed.')
    reason = str(data.get('reason') or '').strip()
    if not reason:
        raise ValueError('A reason is required.')
    last_event = latest(row)
    if data['expectedEventId'] != (last_event.pk if last_event else None):
        raise ReassessmentConflict('The reassessment history changed; refresh before retrying.')
    events = row.capacity_reassessments.filter(action__in=['GRANTED', 'REPLACED']).order_by('-pk')
    last_grant = events.first()
    if data['expectedAuthorizationId'] != (last_grant.pk if last_grant else None):
        raise ReassessmentConflict('The authorization changed; refresh before retrying.')
    grant = current_grant(row)
    if action == 'authorize':
        active = current_effective_semester()
        if active is None or active.pk != data['expectedActiveSemesterId']:
            raise ReassessmentConflict('The Active semester changed; refresh before retrying.')
        result = policy(row, active)
        if result.plan_id is None:
            raise ReassessmentConflict('The Active semester requires a Published capacity plan.')
        _event(row, actor, 'REPLACED' if grant else 'GRANTED', active, reason, authorization=grant, result=result)
    else:
        if grant is None:
            raise ReassessmentConflict('There is no usable authorization to revoke.')
        _event(row, actor, 'REVOKED', grant.target_semester, reason, authorization=grant)
    return request_payload(row, actor)
