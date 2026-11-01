"""Audited changes to current research records; applications remain historical."""
from .request_visibility import routine_research_requests
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone

from academics.services import current_effective_semester
from accounts.authorization import office_actor, coordinator_manages_programme, coordinator_scope_q, programme_coordinators
from accounts.eligibility import user_is_assignable_lecturer
from accounts.models import Coordinator, Lecturer, Student, User
from .models import (CoSupervisorAppointment, CoSupervisorNomination, PanelAppointment,
                     PanelRecommendation, ResearchAmendment, ResearchAmendmentEvent,
                     ResearchProfileRevision, StudentResearchProfile, SupervisorApplication,
                     SupervisorAppointment)


class AmendmentConflict(Exception):
    pass


class AmendmentForbidden(Exception):
    pass


def office(actor):
    return office_actor(actor)


def snapshot(profile):
    return {'title': profile.proposed_topic, 'abstract': profile.abstract, 'programme': profile.programme}


def team_snapshot(student_id):
    def member(row, user):
        return {'appointmentId': row.pk, 'userId': user.pk, 'name': user.full_name}
    primary = SupervisorAppointment.objects.filter(student_id=student_id, status='ACTIVE').select_related('supervisor').first()
    return {
        'primary': member(primary, primary.supervisor) if primary else None,
        'coSupervisors': [member(r, r.supervisor) for r in CoSupervisorAppointment.objects.filter(student_id=student_id, status='ACTIVE').select_related('supervisor').order_by('pk')],
        'panel': [member(r, r.panel_member) for r in PanelAppointment.objects.filter(profile__student_id=student_id, status='ACTIVE').select_related('panel_member').order_by('pk')],
    }


def team_identity(value):
    return {key: ([{'appointmentId': r['appointmentId'], 'userId': r['userId']} for r in rows]
                  if isinstance(rows, list) else ({'appointmentId': rows['appointmentId'], 'userId': rows['userId']} if rows else None))
            for key, rows in value.items()}


def _reason(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError('A reason is required.')
    return value.strip()


def _eligible(student):
    if student.status != Student.Status.ACTIVE or not student.user.is_active:
        raise AmendmentConflict('The student must be active for an academic amendment.')


def _lock_student(student_id):
    student = Student.objects.select_for_update().select_related('user').get(pk=student_id)
    profile = StudentResearchProfile.objects.select_for_update().get(student_id=student_id)
    return student, profile


def _primary(student, profile):
    row = SupervisorAppointment.objects.filter(student=student, status='ACTIVE').select_related('supervisor').first()
    if not row or row.supervisor_id != profile.supervisor_id or not user_is_assignable_lecturer(row.supervisor):
        raise AmendmentConflict('A current eligible primary supervisor is required.')
    return row


def assert_no_pending_transfer(student_id):
    if ResearchAmendment.objects.filter(student_id=student_id, kind='TRANSFER', status__in=ResearchAmendment.PENDING_STATUSES).exists():
        raise AmendmentConflict('Resolve the pending programme transfer before creating another nomination.')


def _no_pending(student_id):
    if ResearchAmendment.objects.filter(student_id=student_id, status__in=ResearchAmendment.PENDING_STATUSES).exists():
        raise AmendmentConflict('Resolve the pending amendment before submitting another change.')


def _no_nominations(student_id):
    if (SupervisorApplication.objects.filter(student_id=student_id, status__in=['SUBMITTED_TO_SUPERVISOR', 'PENDING_COORDINATOR']).exists()
        or CoSupervisorNomination.objects.filter(student_id=student_id, status__in=CoSupervisorNomination.PENDING_STATUSES).exists()
        or PanelRecommendation.objects.filter(profile__student_id=student_id, status__in=PanelRecommendation.WORKLOAD_RESERVED_STATUSES).exists()):
        raise AmendmentConflict('Resolve pending Supervisor, co-supervisor and Panel nominations before transferring.')


def programme_options():
    values = list(Student.objects.values_list('programme', flat=True))
    values += list(StudentResearchProfile.objects.values_list('programme', flat=True))
    values += list(Coordinator.objects.values_list('programme_managed', flat=True))
    names = {}
    for value in sorted(values):
        if value.strip():
            names.setdefault(value.strip().casefold(), value.strip())
    return sorted(names.values(), key=str.casefold)


def _baseline(profile):
    if profile.revision == 0:
        ResearchProfileRevision.objects.get_or_create(profile=profile, revision=0,
            defaults={'kind': 'BASELINE', 'after_values': snapshot(profile)})


def _event(row, actor, action, previous='', reason='', retain_team=False):
    return ResearchAmendmentEvent.objects.create(request=row, actor=actor,
        actor_role=actor.role, actor_name=actor.full_name, action=action,
        previous_status=previous, new_status=row.status, reason=reason, retain_team=retain_team)


def _transition(row, actor, status, action, reason='', retain_team=False):
    previous = row.status
    row.status = status
    row.updated_at = timezone.now()
    models.Model.save(row, update_fields=['status', 'updated_at'])
    _event(row, actor, action, previous, reason, retain_team)


def _apply(student, profile, values, actor, kind, reason, request=None):
    _baseline(profile)
    before = snapshot(profile)
    profile.proposed_topic = values['title']
    profile.abstract = values['abstract']
    profile.programme = values['programme']
    profile.revision += 1
    profile.save(update_fields=['proposed_topic', 'abstract', 'programme', 'revision', 'updated_at'])
    if kind == 'TRANSFER':
        student.programme = profile.programme
        student.save(update_fields=['programme'])
    return ResearchProfileRevision.objects.create(profile=profile, revision=profile.revision,
        kind=kind, request=request, actor=actor, before_values=before, after_values=snapshot(profile), reason=reason)


def _research_values(profile, data):
    result = snapshot(profile)
    for key in ('title', 'abstract'):
        if key in data:
            if not isinstance(data[key], str) or not data[key].strip():
                raise ValueError(f'{key.title()} cannot be blank.')
            result[key] = data[key].strip()
    if len(result['title']) > 500:
        raise ValueError('Title cannot exceed 500 characters.')
    if result == snapshot(profile):
        raise ValueError('Provide a change to the title or abstract.')
    return result


@transaction.atomic
def submit(*, actor, data):
    kind = data.get('kind')
    if kind == 'RESEARCH':
        if actor.role != User.Role.STUDENT or data.get('studentId', actor.pk) != actor.pk:
            raise AmendmentForbidden('Students may request amendments only to their own research.')
        student_id = actor.pk
    elif kind == 'TRANSFER':
        if not office(actor):
            raise AmendmentForbidden('Only Office Staff/Admin may initiate programme transfers.')
        student_id = data.get('studentId')
    else:
        raise ValueError('Select RESEARCH or TRANSFER.')
    student, profile = _lock_student(student_id)
    _eligible(student)
    _no_pending(student_id)
    if student.programme.strip().casefold() != profile.programme.strip().casefold():
        raise AmendmentConflict('Student and research programmes differ; Office must resolve the existing integrity issue.')
    reason = _reason(data.get('reason'))
    destination = ''
    if kind == 'RESEARCH':
        _primary(student, profile)
        after = _research_values(profile, data)
        status = 'PENDING_SUPERVISOR'
    else:
        _no_nominations(student_id)
        proposed = str(data.get('destinationProgramme', '')).strip().casefold()
        destination = next((p for p in programme_options() if p.casefold() == proposed), '')
        if not destination or proposed == student.programme.strip().casefold():
            raise ValueError('Select a different recognised destination programme.')
        if not programme_coordinators(destination).exists():
            raise AmendmentConflict('No eligible coordinator currently manages the destination programme.')
        after = {**snapshot(profile), 'programme': destination}
        # Nobody can give the first approval when the current programme has no
        # coordinator, so the request starts with the destination coordinator.
        status = ('PENDING_SOURCE_COORDINATOR' if programme_coordinators(student.programme).exists()
                  else 'PENDING_DESTINATION_COORDINATOR')
    semester = current_effective_semester()
    if semester is None:
        raise AmendmentConflict('An active academic semester is required for a new amendment.')
    _baseline(profile)
    row = ResearchAmendment.objects.create(student=student, profile=profile,
        initiated_by=actor, kind=kind, status=status, source_programme=student.programme,
        destination_programme=destination, before_values=snapshot(profile), after_values=after,
        baseline_revision=profile.revision, team_snapshot=team_snapshot(student_id),
        academic_semester=semester, semester_snapshot={'id': semester.pk, 'label': semester.label},
        reason=reason, student_name=student.user.full_name, matric_no=student.matric_no)
    _event(row, actor, 'SUBMIT', reason=reason)
    return row


def review_status(row):
    # Keep legacy persisted status/events intact; only the primary Supervisor
    # may finish a research request left at the former Coordinator stage.
    if getattr(row, 'kind', None) == 'RESEARCH' and row.status == 'PENDING_COORDINATOR':
        return 'PENDING_SUPERVISOR'
    return row.status


def can_decide(row, actor, *, lock=False):
    if not actor.is_active:
        return False
    if row.kind == 'RESEARCH':
        if review_status(row) != 'PENDING_SUPERVISOR':
            return False
        primary = row.team_snapshot.get('primary')
        return bool(primary and primary['userId'] == actor.pk and user_is_assignable_lecturer(actor)
                    and SupervisorAppointment.objects.filter(pk=primary['appointmentId'], status='ACTIVE', supervisor=actor).exists())
    programme = (row.destination_programme if row.status == 'PENDING_DESTINATION_COORDINATOR' else row.source_programme)
    return row.kind == 'TRANSFER' and row.status in {'PENDING_SOURCE_COORDINATOR', 'PENDING_DESTINATION_COORDINATOR'} and coordinator_manages_programme(actor, programme, lock=lock)


def can_cancel(row, actor):
    return row.status in ResearchAmendment.PENDING_STATUSES and (office(actor) or
        (actor.is_active and actor.role == User.Role.STUDENT and row.kind == 'RESEARCH' and row.initiated_by_id == actor.pk))


def _fresh(row, student, profile):
    if (row.baseline_revision != profile.revision or row.before_values != snapshot(profile)
        or student.programme.strip().casefold() != row.source_programme.strip().casefold()):
        raise AmendmentConflict('The research record changed. Cancel and resubmit this request.')
    if row.kind == 'TRANSFER' and team_identity(row.team_snapshot) != team_identity(team_snapshot(student.pk)):
        raise AmendmentConflict('The reviewed team changed. Cancel and resubmit this transfer.')
    if row.kind == 'RESEARCH':
        primary = _primary(student, profile)
        if row.team_snapshot.get('primary', {}).get('appointmentId') != primary.pk:
            raise AmendmentConflict('The primary supervisor changed. Resubmit the research request.')


@transaction.atomic
def decide(*, request_id, actor, decision, reason='', retain_team=False, expected_status=None):
    source = ResearchAmendment.objects.get(pk=request_id)
    student, profile = _lock_student(source.student_id)
    row = ResearchAmendment.objects.select_for_update().get(pk=request_id)
    if row.status != (expected_status or source.status):
        raise AmendmentConflict('The approval stage changed. Refresh before making another decision.')
    if row.status not in ResearchAmendment.PENDING_STATUSES:
        raise AmendmentConflict('This request has already been decided.')
    list(Lecturer.objects.select_for_update().filter(pk__in=[actor.pk, profile.supervisor_id]).order_by('pk'))
    if not can_decide(row, actor, lock=True):
        raise AmendmentForbidden('You are not the authorized reviewer for this stage.')
    _eligible(student)
    _fresh(row, student, profile)
    if decision == 'REJECT':
        _transition(row, actor, 'REJECTED', 'REJECT', _reason(reason))
        return row
    if decision != 'APPROVE':
        raise ValueError('Select APPROVE or REJECT.')
    if row.kind == 'TRANSFER':
        if retain_team is not True:
            raise ValueError('Acknowledge retention of the reviewed appointments before approving.')
        _no_nominations(student.pk)
        if not programme_coordinators(row.destination_programme).exists():
            raise AmendmentConflict('The destination programme has no eligible coordinator.')
    next_status = 'PENDING_DESTINATION_COORDINATOR' if row.kind == 'TRANSFER' and row.status == 'PENDING_SOURCE_COORDINATOR' else 'APPROVED'
    if next_status == 'APPROVED':
        _apply(student, profile, row.after_values, actor, row.kind, row.reason, row)
    _transition(row, actor, next_status, 'APPROVE' if next_status == 'APPROVED' else 'ENDORSE', reason, retain_team)
    return row


@transaction.atomic
def cancel(*, request_id, actor, reason):
    source = ResearchAmendment.objects.get(pk=request_id)
    _lock_student(source.student_id)
    row = ResearchAmendment.objects.select_for_update().get(pk=request_id)
    if row.status not in ResearchAmendment.PENDING_STATUSES:
        raise AmendmentConflict('This request is no longer pending.')
    if not can_cancel(row, actor):
        raise AmendmentForbidden('Only the requesting student or Office may cancel this request.')
    _transition(row, actor, 'CANCELLED', 'CANCEL', _reason(reason))
    return row


@transaction.atomic
def cancel_pending_amendments(student_id, actor, reason, research_only=False):
    Student.objects.select_for_update().get(pk=student_id)
    rows = ResearchAmendment.objects.select_for_update().filter(student_id=student_id, status__in=ResearchAmendment.PENDING_STATUSES)
    if research_only:
        rows = rows.filter(kind='RESEARCH')
    ids = []
    for row in rows:
        _transition(row, actor, 'CANCELLED', 'SYSTEM_CANCEL', reason)
        ids.append(row.pk)
    return ids


@transaction.atomic
def correct(*, actor, data):
    if not office(actor):
        raise AmendmentForbidden('Only Office Staff/Admin may record minor corrections.')
    if data.get('meaningUnchanged') is not True:
        raise ValueError('Confirm that research meaning is unchanged.')
    student, profile = _lock_student(data.get('studentId'))
    _eligible(student)
    _no_pending(student.pk)
    if data.get('expectedRevision') != profile.revision:
        raise AmendmentConflict('The research record changed; refresh before correcting it.')
    return _apply(student, profile, _research_values(profile, data), actor, 'CORRECTION', _reason(data.get('reason')))


def scoped_requests(actor, *, routine=True):
    rows = ResearchAmendment.objects.select_related('student__user', 'profile', 'academic_semester').prefetch_related('events')
    if routine:
        rows = routine_research_requests(rows, actor)
    if not actor.is_active:
        return rows.none()
    if office(actor):
        return rows
    if actor.role == User.Role.STUDENT:
        return rows.filter(student_id=actor.pk)
    if actor.role == User.Role.COORDINATOR:
        return rows.filter(coordinator_scope_q(actor, 'student__programme') |
            (Q(status='PENDING_DESTINATION_COORDINATOR') & coordinator_scope_q(actor, 'destination_programme')) |
            Q(events__actor=actor)).distinct()
    if user_is_assignable_lecturer(actor):
        active = SupervisorAppointment.objects.filter(supervisor=actor, status='ACTIVE').values('student_id')
        return rows.filter(kind='RESEARCH', student_id__in=active)
    return rows.none()


def current_profiles(actor):
    rows = StudentResearchProfile.objects.filter(student__student__isnull=False).select_related('student__student')
    if not actor.is_active:
        return rows.none()
    if office(actor):
        return rows
    if actor.role == User.Role.STUDENT:
        return rows.filter(student_id=actor.pk)
    if actor.role == User.Role.COORDINATOR:
        return rows.filter(coordinator_scope_q(actor, 'student__student__programme'))
    if user_is_assignable_lecturer(actor):
        return rows.filter(student_id__in=SupervisorAppointment.objects.filter(supervisor=actor, status='ACTIVE').values('student_id'))
    return rows.none()


def revision_payload(row):
    return {'id': row.pk, 'revision': row.revision, 'studentId': row.profile.student_id,
            'studentName': row.profile.student_name, 'kind': row.kind, 'before': row.before_values,
            'after': row.after_values, 'reason': row.reason, 'requestId': row.request_id,
            'actorName': row.actor.full_name if row.actor else 'Initial record', 'createdAt': row.created_at.isoformat()}


def request_payload(row, actor):
    from marks.models import EvaluationTask
    # Historical decisions carry snapshots, never a new doorway into live student records.
    current_access = current_profiles(actor).filter(pk=row.profile_id).exists()
    unfinished = None
    if current_access or row.status == 'PENDING_DESTINATION_COORDINATOR' and can_decide(row, actor):
        unfinished = EvaluationTask.objects.filter(profile_id=row.profile_id, lifecycle_status__in=['ACTIVE', 'PAUSED']).exclude(mark_entry__status='SUBMITTED').count()
    return {'id': row.pk, 'kind': row.kind, 'status': row.status, 'studentId': row.student_id,
            'studentName': row.student_name, 'matricNo': row.matric_no, 'sourceProgramme': row.source_programme,
            'destinationProgramme': row.destination_programme, 'before': row.before_values, 'after': row.after_values,
            'reason': row.reason, 'createdAt': row.created_at.isoformat(), 'updatedAt': row.updated_at.isoformat(),
            'stageLabel': ResearchAmendment.Status(review_status(row)).label, 'canDecide': can_decide(row, actor) and row.student.status == Student.Status.ACTIVE,
            'canCancel': can_cancel(row, actor), 'requiresTeamAcknowledgement': row.kind == 'TRANSFER',
            'teamSnapshot': row.team_snapshot, 'unfinishedTaskCount': unfinished,
            'events': [{'id': e.pk, 'action': e.action, 'actorName': e.actor_name, 'actorRole': e.actor_role,
                        'previousStatus': e.previous_status, 'newStatus': e.new_status, 'reason': e.reason,
                        'retainTeam': e.retain_team, 'createdAt': e.created_at.isoformat()} for e in row.events.all()]}
