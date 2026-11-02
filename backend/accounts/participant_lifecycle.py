from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from appointments.appointment_lifecycle import end_appointment
from appointments.models import (
    AppointmentWorkflowEvent,
    CoSupervisorNomination,
    CoSupervisorAppointment,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)
from marks.models import EvaluationTask, MarkEntry
from marks.services import (
    pause_student_evaluation_tasks,
    resume_student_evaluation_tasks,
    retire_participant_evaluation_tasks,
)

from .models import (
    Coordinator,
    CoordinatorDelegation,
    Lecturer,
    ParticipantLifecycleAudit,
    Student,
    User,
)
from .authorization import office_actor
from .semester_rules import mark_current_semester_as_leave, minimum_problem
from .session_tokens import blacklist_user_refresh_tokens


class ParticipantLifecycleConflict(Exception):
    def __init__(self, message, blockers=None):
        super().__init__(message)
        self.blockers = blockers or {}


def assert_office_actor(actor):
    if not office_actor(actor):
        raise PermissionError("Only Office Staff/Admin may manage participant lifecycles.")


def _profile_for_student(student):
    return StudentResearchProfile.objects.filter(
        Q(student=student.user) | Q(matric_no__iexact=student.matric_no)
    ).first()


def _unfinished_tasks(queryset):
    return queryset.filter(
        lifecycle_status__in=[
            EvaluationTask.Lifecycle.ACTIVE,
            EvaluationTask.Lifecycle.PAUSED,
        ]
    ).exclude(mark_entry__status=MarkEntry.Status.SUBMITTED)


def student_blockers(student):
    profile = _profile_for_student(student)
    supervisor_pending = student.supervisor_applications.filter(
        status__in=[
            SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
            SupervisorApplication.Status.PENDING_COORDINATOR,
        ]
    )
    panel_pending = PanelRecommendation.objects.none()
    tasks = EvaluationTask.objects.none()
    active_panel = PanelAppointment.objects.none()
    if profile:
        panel_pending = profile.panel_recommendations.filter(
            status__in=[
                PanelRecommendation.Status.SUBMITTED_TO_PANEL,
                PanelRecommendation.Status.PENDING_COORDINATOR,
            ]
        )
        tasks = profile.evaluation_tasks.all()
        active_panel = profile.panel_appointments.filter(
            status=PanelAppointment.Status.ACTIVE
        )
    return {
        "pendingCoSupervisorNominations": student.co_supervisor_nominations.filter(
            status__in=CoSupervisorNomination.PENDING_STATUSES
        ).count(),
        "activeCoSupervisorAppointments": student.co_supervisor_appointments.filter(
            status="ACTIVE"
        ).count(),
        "pendingSupervisorApplications": supervisor_pending.count(),
        "pendingPanelRecommendations": panel_pending.count(),
        "activeSupervisorAppointments": student.supervisor_appointments.filter(
            status=SupervisorAppointment.Status.ACTIVE
        ).count(),
        "activePanelAppointments": active_panel.count(),
        "unfinishedMarksTasks": _unfinished_tasks(tasks).count(),
        "managedProgrammes": 0,
    }


def lecturer_blockers(lecturer):
    from .delegations import today
    user = lecturer.user
    coordinator = Coordinator.objects.filter(lecturer=lecturer).first()
    tasks = _unfinished_tasks(EvaluationTask.objects.filter(evaluator=user))
    return {
        "pendingCoSupervisorNominations": CoSupervisorNomination.objects.filter(
            candidate=user, status__in=CoSupervisorNomination.PENDING_STATUSES
        ).count(),
        "activeCoSupervisorAppointments": CoSupervisorAppointment.objects.filter(
            supervisor=user, status="ACTIVE"
        ).count(),
        "pendingSupervisorApplications": SupervisorApplication.objects.filter(
            proposed_supervisor=user,
            status=SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
        ).count(),
        "pendingPanelRecommendations": PanelRecommendation.objects.filter(
            recommended_member=user,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        ).count(),
        "activeSupervisorAppointments": SupervisorAppointment.objects.filter(
            supervisor=user,
            status=SupervisorAppointment.Status.ACTIVE,
        ).count(),
        "activePanelAppointments": PanelAppointment.objects.filter(
            panel_member=user,
            status=PanelAppointment.Status.ACTIVE,
        ).count(),
        "unfinishedMarksTasks": tasks.count(),
        "coordinatorDelegations": CoordinatorDelegation.objects.filter(
            coordinator=user, revoked_at__isnull=True, ends_on__gte=today()
        ).count(),
        "managedProgrammes": int(
            bool(coordinator and coordinator.programme_managed.strip())
        ),
    }


def _audit_row(row):
    return {
        "id": row.pk,
        "previousStatus": row.previous_status,
        "newStatus": row.new_status,
        "reason": row.reason,
        "actor": row.actor.full_name,
        "actorRole": row.actor.role,
        "affectedRecords": row.affected_records,
        "createdAt": row.created_at.isoformat(),
    }


def serialize_student(student, include_audits=True):
    pending_work = [
        {
            "recordType": "SUPERVISOR_APPLICATION",
            "recordId": row.pk,
            "status": row.status,
            "assignedTo": row.proposed_supervisor.full_name,
        }
        for row in student.supervisor_applications.filter(
            status__in=[
                SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
                SupervisorApplication.Status.PENDING_COORDINATOR,
            ]
        ).select_related("proposed_supervisor")
    ]
    pending_work.extend(
        {
            "recordType": "CO_SUPERVISOR_NOMINATION",
            "recordId": row.pk,
            "status": row.status,
            "assignedTo": row.candidate.full_name,
        }
        for row in student.co_supervisor_nominations.filter(
            status__in=CoSupervisorNomination.PENDING_STATUSES
        ).select_related("candidate")
    )
    profile = _profile_for_student(student)
    if profile:
        pending_work.extend(
            {
                "recordType": "PANEL_RECOMMENDATION",
                "recordId": row.pk,
                "status": row.status,
                "assignedTo": row.recommended_member.full_name,
            }
            for row in profile.panel_recommendations.filter(
                status__in=[
                    PanelRecommendation.Status.SUBMITTED_TO_PANEL,
                    PanelRecommendation.Status.PENDING_COORDINATOR,
                ]
            ).select_related("recommended_member")
        )
    return {
        "participantType": "STUDENT",
        "identifier": student.matric_no,
        "name": student.user.full_name,
        "programme": student.programme,
        "department": None,
        "lifecycleStatus": student.status.upper(),
        "accountAccess": "ACTIVE" if student.status == Student.Status.ACTIVE else "READ_ONLY",
        "changedAt": student.status_changed_at.isoformat() if student.status_changed_at else None,
        "changedBy": student.status_changed_by.full_name if student.status_changed_by else None,
        "reason": student.status_reason or None,
        "blockers": student_blockers(student),
        "pendingWork": pending_work,
        "audits": [
            _audit_row(row)
            for row in student.lifecycle_audits.select_related("actor").all()
        ] if include_audits else [],
    }


def serialize_lecturer(lecturer, include_audits=True):
    pending_work = [
        {
            "recordType": "SUPERVISOR_APPLICATION",
            "recordId": row.pk,
            "status": row.status,
            "studentId": row.student.matric_no,
        }
        for row in SupervisorApplication.objects.filter(
            proposed_supervisor=lecturer.user,
            status=SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
        ).select_related("student")
    ]
    pending_work.extend(
        {
            "recordType": "PANEL_RECOMMENDATION",
            "recordId": row.pk,
            "status": row.status,
            "studentId": row.profile.matric_no,
        }
        for row in PanelRecommendation.objects.filter(
            recommended_member=lecturer.user,
            status=PanelRecommendation.Status.SUBMITTED_TO_PANEL,
        ).select_related("profile")
    )
    pending_work.extend(
        {
            "recordType": "CO_SUPERVISOR_NOMINATION",
            "recordId": row.pk,
            "status": row.status,
            "studentId": row.student.matric_no,
        }
        for row in CoSupervisorNomination.objects.filter(
            candidate=lecturer.user, status__in=CoSupervisorNomination.PENDING_STATUSES
        ).select_related("student")
    )
    return {
        "participantType": "LECTURER",
        "identifier": lecturer.staff_no,
        "name": lecturer.user.full_name,
        "programme": None,
        "department": lecturer.department,
        "lifecycleStatus": lecturer.lifecycle_status,
        "accountAccess": "DISABLED" if lecturer.lifecycle_status == Lecturer.Lifecycle.RETIRED else "ACTIVE",
        "changedAt": lecturer.lifecycle_changed_at.isoformat() if lecturer.lifecycle_changed_at else None,
        "changedBy": lecturer.lifecycle_changed_by.full_name if lecturer.lifecycle_changed_by else None,
        "reason": lecturer.lifecycle_reason or None,
        "blockers": lecturer_blockers(lecturer),
        "pendingWork": pending_work,
        "audits": [
            _audit_row(row)
            for row in lecturer.lifecycle_audits.select_related("actor").all()
        ] if include_audits else [],
    }


def _workflow_event(*, actor, record, previous_status, reason):
    values = {
        "actor": actor,
        "actor_role": actor.role,
        "action": "OFFICE_CANCEL_PARTICIPANT_LIFECYCLE",
        "previous_status": previous_status,
        "new_status": record.status,
        "reason": reason,
    }
    if isinstance(record, SupervisorApplication):
        values["supervisor_application"] = record
    else:
        values["panel_recommendation"] = record
    return AppointmentWorkflowEvent.objects.create(**values)


def _cancel_supervisor_application(application, *, actor, reason):
    previous = application.status
    application.status = SupervisorApplication.Status.CANCELLED_BY_OFFICE
    application.cancellation_reason = reason
    application.cancelled_at = timezone.now()
    application.save(
        update_fields=["status", "cancellation_reason", "cancelled_at", "updated_at"]
    )
    _workflow_event(actor=actor, record=application, previous_status=previous, reason=reason)


def _cancel_panel_recommendation(recommendation, *, actor, reason):
    previous = recommendation.status
    recommendation.status = PanelRecommendation.Status.CANCELLED_BY_OFFICE
    recommendation.cancellation_reason = reason
    recommendation.cancelled_at = timezone.now()
    recommendation.save(
        update_fields=["status", "cancellation_reason", "cancelled_at", "updated_at"]
    )
    _workflow_event(actor=actor, record=recommendation, previous_status=previous, reason=reason)


def _cancel_student_pending_work(student, *, actor, reason):
    from appointments.co_supervision import cancel_locked

    affected = {
        "supervisorApplications": [],
        "panelRecommendations": [],
        "coSupervisorNominations": [],
    }
    for row in student.co_supervisor_nominations.select_for_update().filter(
        status__in=CoSupervisorNomination.PENDING_STATUSES
    ):
        cancel_locked(
            row,
            actor=actor,
            reason=reason,
            action="OFFICE_CANCEL_PARTICIPANT_LIFECYCLE",
        )
        affected["coSupervisorNominations"].append(row.pk)
    applications = student.supervisor_applications.select_for_update().filter(
        status__in=[
            SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
            SupervisorApplication.Status.PENDING_COORDINATOR,
        ]
    )
    for application in applications:
        _cancel_supervisor_application(application, actor=actor, reason=reason)
        affected["supervisorApplications"].append(application.pk)
    profile = _profile_for_student(student)
    if profile:
        recommendations = profile.panel_recommendations.select_for_update().filter(
            status__in=[
                PanelRecommendation.Status.SUBMITTED_TO_PANEL,
                PanelRecommendation.Status.PENDING_COORDINATOR,
            ]
        )
        for recommendation in recommendations:
            _cancel_panel_recommendation(recommendation, actor=actor, reason=reason)
            affected["panelRecommendations"].append(recommendation.pk)
    return affected


def _end_student_appointments(student, *, actor, outcome, reason):
    from appointments.co_supervision import end_appointment as end_co_appointment

    affected = {
        "supervisorAppointments": [],
        "panelAppointments": [],
        "coSupervisorAppointments": [],
    }
    for row_id in student.co_supervisor_appointments.filter(
        status="ACTIVE"
    ).values_list("pk", flat=True):
        end_co_appointment(
            appointment_id=row_id, actor=actor, outcome=outcome, reason=reason
        )
        affected["coSupervisorAppointments"].append(row_id)
    for appointment_id in list(
        student.supervisor_appointments.filter(
            status=SupervisorAppointment.Status.ACTIVE
        ).values_list("pk", flat=True)
    ):
        end_appointment(
            model=SupervisorAppointment,
            appointment_id=appointment_id,
            actor=actor,
            outcome=outcome,
            reason=reason,
        )
        affected["supervisorAppointments"].append(appointment_id)
    profile = _profile_for_student(student)
    if profile:
        for appointment_id in list(
            profile.panel_appointments.filter(
                status=PanelAppointment.Status.ACTIVE
            ).values_list("pk", flat=True)
        ):
            end_appointment(
                model=PanelAppointment,
                appointment_id=appointment_id,
                actor=actor,
                outcome=outcome,
                reason=reason,
            )
            affected["panelAppointments"].append(appointment_id)
    return affected


def _set_student_status(student, *, target, actor, reason, affected):
    previous = student.status
    student.status = target
    student.status_changed_at = timezone.now()
    student.status_changed_by = actor
    student.status_reason = reason
    student.save(
        update_fields=["status", "status_changed_at", "status_changed_by", "status_reason"]
    )
    ParticipantLifecycleAudit.objects.create(
        student=student,
        actor=actor,
        previous_status=previous.upper(),
        new_status=target.upper(),
        reason=reason,
        affected_records=affected,
    )


@transaction.atomic
def transition_student(*, matric_no, actor, target_status, reason, early_approved=False):
    assert_office_actor(actor)
    reason = str(reason or "").strip()
    if not reason:
        raise ValueError("A lifecycle reason is required.")
    target_map = {choice.value.upper(): choice.value for choice in Student.Status}
    if target_status not in target_map:
        raise ValueError("Select Active, Deferred, Graduated, or Withdrawn.")
    student = Student.objects.select_for_update().select_related("user").get(
        matric_no__iexact=matric_no
    )
    target = target_map[target_status]
    allowed = {
        Student.Status.ACTIVE: {
            Student.Status.DEFERRED,
            Student.Status.GRADUATED,
            Student.Status.WITHDRAWN,
        },
        Student.Status.DEFERRED: {Student.Status.ACTIVE, Student.Status.WITHDRAWN},
        Student.Status.GRADUATED: set(),
        Student.Status.WITHDRAWN: set(),
    }
    if target not in allowed[student.status]:
        raise ParticipantLifecycleConflict(
            "This Student lifecycle transition is no longer available.",
            student_blockers(student),
        )
    affected = {}
    profile = _profile_for_student(student)
    if target == Student.Status.DEFERRED and profile:
        paused = pause_student_evaluation_tasks(profile=profile, actor=actor, reason=reason)
        affected["pausedMarksTasks"] = [task.pk for task in paused]
    elif target == Student.Status.ACTIVE and profile:
        result = resume_student_evaluation_tasks(profile=profile, actor=actor, reason=reason)
        affected["resumedMarksTasks"] = [task.pk for task in result["resumed"]]
        affected["retiredMarksTasks"] = [task.pk for task in result["retired"]]
    elif target == Student.Status.GRADUATED:
        blockers = student_blockers(student)
        blocking = {
            "pendingCoSupervisorNominations": blockers[
                "pendingCoSupervisorNominations"
            ],
            "pendingSupervisorApplications": blockers["pendingSupervisorApplications"],
            "pendingPanelRecommendations": blockers["pendingPanelRecommendations"],
            "unfinishedMarksTasks": blockers["unfinishedMarksTasks"],
        }
        if any(blocking.values()):
            raise ParticipantLifecycleConflict(
                "Graduation is blocked by unresolved workflow or Marks records.",
                blockers,
            )
        problem = minimum_problem(student, early_approved=early_approved)
        if problem:
            raise ParticipantLifecycleConflict(problem, blockers)
        affected.update(
            _end_student_appointments(
                student,
                actor=actor,
                outcome=SupervisorAppointment.EndOutcome.COMPLETED,
                reason=reason,
            )
        )
    elif target == Student.Status.WITHDRAWN:
        affected.update(_cancel_student_pending_work(student, actor=actor, reason=reason))
        affected.update(
            _end_student_appointments(
                student,
                actor=actor,
                outcome=SupervisorAppointment.EndOutcome.WITHDRAWN,
                reason=reason,
            )
        )
        if profile:
            retired = retire_participant_evaluation_tasks(
                tasks=profile.evaluation_tasks.all(), actor=actor, reason=reason
            )
            affected["retiredMarksTasks"] = [task.pk for task in retired]
    if target == Student.Status.DEFERRED:
        mark_current_semester_as_leave(student)
    if target in {Student.Status.GRADUATED, Student.Status.WITHDRAWN}:
        from appointments.research_amendments import cancel_pending_amendments
        affected["cancelledAmendments"] = cancel_pending_amendments(
            student.pk, actor, f"Automatically cancelled on student {target.lower()}: {reason}"
        )
    _set_student_status(student, target=target, actor=actor, reason=reason, affected=affected)
    student.refresh_from_db()
    return student


def _set_lecturer_status(lecturer, *, target, actor, reason, affected):
    previous = lecturer.lifecycle_status
    lecturer.lifecycle_status = target
    lecturer.lifecycle_changed_at = timezone.now()
    lecturer.lifecycle_changed_by = actor
    lecturer.lifecycle_reason = reason
    lecturer.save(
        update_fields=[
            "lifecycle_status",
            "lifecycle_changed_at",
            "lifecycle_changed_by",
            "lifecycle_reason",
        ]
    )
    ParticipantLifecycleAudit.objects.create(
        lecturer=lecturer,
        actor=actor,
        previous_status=previous,
        new_status=target,
        reason=reason,
        affected_records=affected,
    )


@transaction.atomic
def transition_lecturer(*, staff_no, actor, target_status, reason):
    assert_office_actor(actor)
    reason = str(reason or "").strip()
    if not reason:
        raise ValueError("A lifecycle reason is required.")
    if target_status not in Lecturer.Lifecycle.values:
        raise ValueError("Select Active, Retiring, or Retired.")
    lecturer = Lecturer.objects.select_for_update().select_related("user").get(
        staff_no__iexact=staff_no
    )
    allowed = {
        Lecturer.Lifecycle.ACTIVE: {Lecturer.Lifecycle.RETIRING},
        Lecturer.Lifecycle.RETIRING: {
            Lecturer.Lifecycle.ACTIVE,
            Lecturer.Lifecycle.RETIRED,
        },
        Lecturer.Lifecycle.RETIRED: set(),
    }
    if target_status not in allowed[lecturer.lifecycle_status]:
        raise ParticipantLifecycleConflict(
            "This Lecturer lifecycle transition is no longer available.",
            lecturer_blockers(lecturer),
        )
    affected = {}
    if target_status == Lecturer.Lifecycle.RETIRED:
        blockers = lecturer_blockers(lecturer)
        required_zero = [
            "pendingCoSupervisorNominations",
            "activeCoSupervisorAppointments",
            "pendingSupervisorApplications",
            "pendingPanelRecommendations",
            "activeSupervisorAppointments",
            "activePanelAppointments",
            "managedProgrammes",
            "coordinatorDelegations",
        ]
        if any(blockers[key] for key in required_zero):
            raise ParticipantLifecycleConflict(
                "Retirement is blocked by active appointments or responsibilities.",
                blockers,
            )
        retired = retire_participant_evaluation_tasks(
            tasks=EvaluationTask.objects.filter(evaluator=lecturer.user),
            actor=actor,
            reason=reason,
        )
        affected["retiredMarksTasks"] = [task.pk for task in retired]
        lecturer.user.is_active = False
        lecturer.user.save(update_fields=["is_active"])
        blacklist_user_refresh_tokens(lecturer.user)
    _set_lecturer_status(
        lecturer,
        target=target_status,
        actor=actor,
        reason=reason,
        affected=affected,
    )
    lecturer.refresh_from_db()
    return lecturer


@transaction.atomic
def cancel_pending_work(*, participant, actor, record_type, record_id, reason):
    assert_office_actor(actor)
    reason = str(reason or "").strip()
    if not reason:
        raise ValueError("A cancellation reason is required.")
    if isinstance(participant, Student):
        if participant.status not in {Student.Status.DEFERRED, Student.Status.ACTIVE}:
            raise ParticipantLifecycleConflict("This Student has no actionable lifecycle work.")
        allowed_student = participant
        allowed_lecturer = None
    else:
        if participant.lifecycle_status != Lecturer.Lifecycle.RETIRING:
            raise ParticipantLifecycleConflict("The Lecturer must be Retiring first.")
        allowed_student = None
        allowed_lecturer = participant.user
    if record_type == "CO_SUPERVISOR_NOMINATION":
        from appointments.co_supervision import cancel_locked

        reference = CoSupervisorNomination.objects.get(pk=record_id)
        Student.objects.select_for_update().get(pk=reference.student_id)
        nomination = CoSupervisorNomination.objects.select_for_update().get(
            pk=record_id
        )
        if allowed_student and nomination.student_id != allowed_student.pk:
            raise ParticipantLifecycleConflict(
                "The workflow does not belong to this Student."
            )
        if allowed_lecturer and nomination.candidate_id != allowed_lecturer.pk:
            raise ParticipantLifecycleConflict(
                "The workflow is not assigned to this Lecturer."
            )
        if nomination.status not in CoSupervisorNomination.PENDING_STATUSES:
            raise ParticipantLifecycleConflict(
                "The co-supervisor workflow is no longer pending."
            )
        return cancel_locked(
            nomination,
            actor=actor,
            reason=reason,
            action="OFFICE_CANCEL_PARTICIPANT_LIFECYCLE",
        )
    if record_type == "SUPERVISOR_APPLICATION":
        application = SupervisorApplication.objects.select_for_update().get(pk=record_id)
        if allowed_student and application.student_id != allowed_student.pk:
            raise ParticipantLifecycleConflict("The workflow does not belong to this Student.")
        if allowed_lecturer and application.proposed_supervisor_id != allowed_lecturer.pk:
            raise ParticipantLifecycleConflict("The workflow is not assigned to this Lecturer.")
        if application.status not in {
            SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR,
            SupervisorApplication.Status.PENDING_COORDINATOR,
        }:
            raise ParticipantLifecycleConflict("The Supervisor workflow is no longer pending.")
        _cancel_supervisor_application(application, actor=actor, reason=reason)
        return application
    if record_type == "PANEL_RECOMMENDATION":
        recommendation = PanelRecommendation.objects.select_for_update().get(pk=record_id)
        if allowed_student and recommendation.profile.matric_no.casefold() != allowed_student.matric_no.casefold():
            raise ParticipantLifecycleConflict("The workflow does not belong to this Student.")
        if allowed_lecturer and recommendation.recommended_member_id != allowed_lecturer.pk:
            raise ParticipantLifecycleConflict("The workflow is not assigned to this Lecturer.")
        if recommendation.status not in {
            PanelRecommendation.Status.SUBMITTED_TO_PANEL,
            PanelRecommendation.Status.PENDING_COORDINATOR,
        }:
            raise ParticipantLifecycleConflict("The Panel workflow is no longer pending.")
        _cancel_panel_recommendation(recommendation, actor=actor, reason=reason)
        return recommendation
    raise ValueError(
        "Select Supervisor Application, Co-Supervisor Nomination, or Panel Recommendation."
    )
