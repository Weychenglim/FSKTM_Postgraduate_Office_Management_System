import hashlib
import json
from dataclasses import asdict, dataclass, field

from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.eligibility import (
    profile_student_is_workflow_eligible,
    student_is_workflow_eligible,
    user_is_assignable_lecturer,
)
from accounts.authorization import coordinator_manages_programme, programme_coordinators
from accounts.models import Coordinator, Lecturer, Panel, Student, Supervisor, User
from academics.capacity_services import (
    CapacityLifecycleConflict,
    create_capacity_plan,
    validate_published_capacity_ready,
)
from academics.capacity import CapacityConflict
from appointments.capacity_reassessment import assert_request_capacity
from academics.models import (
    AcademicSemester,
    LecturerAvailabilityWindow,
    SemesterCapacityPlan,
)
from appointments.models import (
    AppointmentWorkflowEvent,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)
from appointments.appointment_lifecycle import (
    AppointmentLifecycleConflict,
    activate_replacement,
)
from appointments.supervisor_handoff import (
    SupervisorApprovalConflict,
    _resolve_research_profile,
)
from marks.models import EvaluationPeriod, EvaluationTask, MarkEntry
from marks.services import (
    MarksStateConflict,
    ensure_period_tasks,
    reconcile_evaluation_task,
)

from .models import SemesterTimeline, WorkflowReconciliationAudit


class ReconciliationError(Exception):
    pass


class ReconciliationConflict(ReconciliationError):
    pass


@dataclass
class ReconciliationIssue:
    issue_id: str
    module: str
    issue_type: str
    severity: str
    repairability: str
    title: str
    summary: str
    record_type: str
    record_id: str
    programme: str | None
    student_id: str | None
    current_state: dict
    suggestion: dict = field(default_factory=dict)
    dependencies: list[str] = field(default_factory=list)
    navigation: dict = field(default_factory=dict)

    @property
    def fingerprint(self):
        payload = {
            "issueId": self.issue_id,
            "studentId": self.student_id,
            "programme": self.programme,
            "currentState": self.current_state,
            "suggestion": self.suggestion,
        }
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def to_dict(self):
        values = asdict(self)
        navigation = values["navigation"] or {
            "targetModule": (
                "DASHBOARD"
                if values["module"] == "WORKFLOW_TRACKING"
                else values["module"]
            ),
            "recordType": values["record_type"],
            "recordId": values["record_id"],
        }
        return {
            "issueId": values["issue_id"],
            "module": values["module"],
            "issueType": values["issue_type"],
            "severity": values["severity"],
            "repairability": values["repairability"],
            "title": values["title"],
            "summary": values["summary"],
            "recordType": values["record_type"],
            "recordId": values["record_id"],
            "programme": values["programme"],
            "studentId": values["student_id"],
            "currentState": values["current_state"],
            "suggestion": values["suggestion"],
            "dependencies": values["dependencies"],
            "navigation": navigation,
            "fingerprint": self.fingerprint,
        }


def _issue_id(issue_type, record_type, record_id):
    return f"{issue_type}.{record_type}.{record_id}"


def _programme_issue_id(programme):
    return hashlib.sha256(_normalized(programme).encode("utf-8")).hexdigest()[:16]


def _normalized(value):
    return " ".join(str(value or "").casefold().split())


def _semester_payload(semester):
    return {
        "semesterId": semester.pk,
        "semesterCode": semester.code,
        "semesterLabel": semester.label,
    }


def _semester_candidates(*, label="", occurred_on=None, starts_at=None, ends_at=None):
    candidates = []
    normalized_label = _normalized(label)
    for semester in AcademicSemester.objects.all():
        label_matches = bool(normalized_label) and normalized_label in {
            _normalized(semester.label),
            _normalized(semester.code),
            _normalized(f"{semester.get_term_display()} {semester.academic_session}"),
        }
        date_matches = bool(
            occurred_on and semester.starts_on <= occurred_on <= semester.ends_on
        )
        range_matches = bool(
            starts_at
            and ends_at
            and semester.starts_on <= starts_at <= ends_at <= semester.ends_on
        )
        supplied_signals = [
            result
            for supplied, result in (
                (bool(normalized_label), label_matches),
                (occurred_on is not None, date_matches),
                (starts_at is not None and ends_at is not None, range_matches),
            )
            if supplied
        ]
        if supplied_signals and all(supplied_signals):
            candidates.append(semester)
    return candidates


def _semester_issue(
    record,
    *,
    module,
    record_type,
    programme,
    student_id,
    label="",
    occurred_on=None,
    starts_at=None,
    ends_at=None,
):
    candidates = _semester_candidates(
        label=label,
        occurred_on=occurred_on,
        starts_at=starts_at,
        ends_at=ends_at,
    )
    suggestion = _semester_payload(candidates[0]) if len(candidates) == 1 else {}
    repairability = "REPAIRABLE" if suggestion else "REVIEW_REQUIRED"
    return ReconciliationIssue(
        issue_id=_issue_id("SEMESTER_UNASSIGNED", record_type, record.pk),
        module=module,
        issue_type="SEMESTER_UNASSIGNED",
        severity="WARNING",
        repairability=repairability,
        title="Academic semester is unassigned",
        summary=f"{record_type.replace('_', ' ').title()} {record.pk} remains Legacy / Unassigned.",
        record_type=record_type,
        record_id=str(record.pk),
        programme=programme or None,
        student_id=student_id or None,
        current_state={
            "academicSemesterId": None,
            **({"recordStatus": record.status} if hasattr(record, "status") else {}),
            **({"isCurrentTimeline": record.is_active} if hasattr(record, "is_active") else {}),
            **({"profileId": record.profile_id} if hasattr(record, "profile_id") else {}),
            "recordedSemester": label or None,
            "occurredOn": occurred_on.isoformat() if occurred_on else None,
            "startsOn": starts_at.isoformat() if starts_at else None,
            "endsOn": ends_at.isoformat() if ends_at else None,
            "matchingSemesterCount": len(candidates),
        },
        suggestion=suggestion,
        dependencies=[] if suggestion else ["Select a non-conflicting semester."],
    )


def _capacity_issue(
    issue_type,
    record_type,
    record_id,
    *,
    title,
    summary,
    current_state,
    severity="WARNING",
    repairability="REVIEW_REQUIRED",
    suggestion=None,
    dependencies=None,
):
    return ReconciliationIssue(
        issue_id=_issue_id(issue_type, record_type, record_id),
        module="WORKFLOW_TRACKING",
        issue_type=issue_type,
        severity=severity,
        repairability=repairability,
        title=title,
        summary=summary,
        record_type=record_type,
        record_id=str(record_id),
        programme=None,
        student_id=None,
        current_state=current_state,
        suggestion=suggestion or {},
        dependencies=dependencies or [],
        navigation={
            "targetModule": "DASHBOARD",
            "recordType": record_type,
            "recordId": str(record_id),
        },
    )


def _capacity_reconciliation_issues():
    issues = []
    for semester in AcademicSemester.objects.filter(
        lifecycle_status__in=(
            AcademicSemester.Lifecycle.DRAFT,
            AcademicSemester.Lifecycle.ACTIVE,
        )
    ).order_by("starts_on", "pk"):
        plans = list(semester.capacity_plans.order_by("version", "pk"))
        published = [
            plan
            for plan in plans
            if plan.lifecycle_status == SemesterCapacityPlan.Lifecycle.PUBLISHED
        ]
        if not plans:
            prior = list(
                SemesterCapacityPlan.objects.filter(
                    lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
                    academic_semester__ends_on__lt=semester.starts_on,
                )
                .select_related("academic_semester")
                .order_by("-academic_semester__ends_on", "-pk")
            )
            repairable = (
                semester.lifecycle_status == AcademicSemester.Lifecycle.DRAFT
                and len(prior) == 1
            )
            issues.append(
                _capacity_issue(
                    "CAPACITY_PLAN_MISSING",
                    "ACADEMIC_SEMESTER",
                    semester.pk,
                    title="Academic semester has no capacity plan",
                    summary=f"{semester.label} has no versioned Lecturer capacity policy.",
                    current_state={
                        **_semester_payload(semester),
                        "lifecycleStatus": semester.lifecycle_status,
                        "capacityPlanIds": [],
                    },
                    severity=(
                        "BLOCKING"
                        if semester.lifecycle_status
                        == AcademicSemester.Lifecycle.ACTIVE
                        else "WARNING"
                    ),
                    repairability="REPAIRABLE" if repairable else "REVIEW_REQUIRED",
                    suggestion=(
                        {
                            "action": "COPY_CAPACITY_PLAN",
                            "sourcePlanId": prior[0].pk,
                            "sourcePlanVersion": prior[0].version,
                            "sourceSemesterLabel": prior[0].academic_semester.label,
                        }
                        if repairable
                        else {}
                    ),
                    dependencies=(
                        []
                        if repairable
                        else ["Create and review a Draft capacity plan manually."]
                    ),
                )
            )
            continue
        if len(published) > 1:
            issues.append(
                _capacity_issue(
                    "CAPACITY_MULTIPLE_PUBLISHED",
                    "ACADEMIC_SEMESTER",
                    semester.pk,
                    title="Multiple capacity plans are published",
                    summary=f"{semester.label} has more than one Published capacity plan.",
                    current_state={**_semester_payload(semester), "publishedPlanIds": [plan.pk for plan in published]},
                    severity="BLOCKING",
                )
            )
        if len(published) == 1:
            errors = validate_published_capacity_ready(semester)
            if errors:
                issues.append(
                    _capacity_issue(
                        "CAPACITY_PLAN_INCOMPLETE",
                        "CAPACITY_PLAN",
                        published[0].pk,
                        title="Published capacity plan is incomplete",
                        summary=" ".join(errors),
                        current_state={
                            **_semester_payload(semester),
                            "capacityPlanId": published[0].pk,
                            "planVersion": published[0].version,
                            "readinessErrors": errors,
                        },
                        severity="BLOCKING",
                    )
                )

        for plan in plans:
            for entry in plan.entries.select_related("lecturer__user"):
                entry_context = {
                    **_semester_payload(semester),
                    "capacityPlanId": plan.pk,
                    "planVersion": plan.version,
                    "planStatus": plan.lifecycle_status,
                    "lecturerName": entry.lecturer.user.full_name,
                    "staffNo": entry.lecturer.staff_no,
                }
                supervisor_profile = Supervisor.objects.filter(
                    lecturer_id=entry.lecturer_id
                ).first()
                panel_profile = Panel.objects.filter(
                    lecturer_id=entry.lecturer_id
                ).first()
                has_supervisor = supervisor_profile is not None
                has_panel = panel_profile is not None
                mismatch = (
                    (has_supervisor and entry.supervisor_limit is None)
                    or (not has_supervisor and entry.supervisor_limit is not None)
                    or (has_panel and entry.panel_limit is None)
                    or (not has_panel and entry.panel_limit is not None)
                )
                if mismatch:
                    issues.append(
                        _capacity_issue(
                            "CAPACITY_ENTRY_ROLE_MISMATCH",
                            "CAPACITY_ENTRY",
                            entry.pk,
                            title="Capacity entry no longer matches Lecturer roles",
                            summary=f"{entry.lecturer.user.full_name} has role-alignment drift in plan {plan.pk}.",
                            current_state={
                                **entry_context,
                                "lecturerId": entry.lecturer.staff_no,
                                "hasSupervisorRole": has_supervisor,
                                "hasPanelRole": has_panel,
                                "supervisorLimit": entry.supervisor_limit,
                                "panelLimit": entry.panel_limit,
                            },
                        )
                    )

    windows = list(
        LecturerAvailabilityWindow.objects.filter(cancelled_at__isnull=True).select_related(
            "academic_semester", "lecturer__user"
        ).order_by(
            "academic_semester_id", "lecturer_id", "role", "starts_on", "pk"
        )
    )
    for index, window in enumerate(windows):
        overlap = next(
            (
                other
                for other in windows[index + 1 :]
                if other.academic_semester_id == window.academic_semester_id
                and other.lecturer_id == window.lecturer_id
                and other.role == window.role
                and other.starts_on <= window.ends_on
                and window.starts_on <= other.ends_on
            ),
            None,
        )
        if overlap is not None:
            issues.append(
                _capacity_issue(
                    "CAPACITY_AVAILABILITY_OVERLAP",
                    "LECTURER_AVAILABILITY",
                    window.pk,
                    title="Lecturer availability windows overlap",
                    summary="Two active same-role availability windows overlap.",
                    current_state={
                        **_semester_payload(window.academic_semester),
                        "lecturerName": window.lecturer.user.full_name,
                        "staffNo": window.lecturer.staff_no,
                        "role": window.role,
                        "startsOn": window.starts_on.isoformat(),
                        "endsOn": window.ends_on.isoformat(),
                        "otherStartsOn": overlap.starts_on.isoformat(),
                        "otherEndsOn": overlap.ends_on.isoformat(),
                        "windowIds": [window.pk, overlap.pk],
                    },
                    severity="BLOCKING",
                )
            )
    return issues


def _request_capacity_available(row):
    try:
        assert_request_capacity(row)
    except CapacityConflict:
        return False
    return True


def detect_reconciliation_issues(*, include_accepted=False):
    from .co_supervision_tracking import co_supervisor_reconciliation_issues
    from .amendment_tracking import amendment_reconciliation_issues

    issues = _capacity_reconciliation_issues()
    issues.extend(co_supervisor_reconciliation_issues())
    issues.extend(amendment_reconciliation_issues())
    for coordinator in Coordinator.objects.select_related("lecturer__user").filter(
        programme_managed=""
    ):
        user = coordinator.lecturer.user
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "COORDINATOR_PROGRAMME_MISSING", "COORDINATOR", coordinator.pk
                ),
                module="WORKFLOW_TRACKING",
                issue_type="COORDINATOR_PROGRAMME_MISSING",
                severity="BLOCKING",
                repairability=(
                    "REPAIRABLE"
                    if user.role == User.Role.COORDINATOR
                    else "REVIEW_REQUIRED"
                ),
                title="Coordinator programme is missing",
                summary=f"{user.full_name} has no authoritative managed programme.",
                record_type="COORDINATOR",
                record_id=str(coordinator.pk),
                programme=None,
                student_id=None,
                current_state={
                    "userId": user.pk,
                    "role": user.role,
                    "programmeManaged": "",
                },
                suggestion={},
                dependencies=["Select a programme represented by persisted students."],
            )
        )

    for user in User.objects.filter(role=User.Role.COORDINATOR).select_related(
        "lecturer"
    ):
        lecturer = getattr(user, "lecturer", None)
        if lecturer and not Coordinator.objects.filter(lecturer=lecturer).exists():
            issues.append(
                ReconciliationIssue(
                    issue_id=_issue_id("COORDINATOR_PROFILE_MISSING", "USER", user.pk),
                    module="WORKFLOW_TRACKING",
                    issue_type="COORDINATOR_PROFILE_MISSING",
                    severity="BLOCKING",
                    repairability="REPAIRABLE",
                    title="Coordinator profile is missing",
                    summary=f"{user.full_name} has Coordinator access but no programme profile.",
                    record_type="USER",
                    record_id=str(user.pk),
                    programme=None,
                    student_id=None,
                    current_state={"userId": user.pk, "role": user.role},
                    dependencies=["Select a managed programme."],
                )
            )

    for coordinator in Coordinator.objects.select_related("lecturer__user").exclude(
        lecturer__user__role=User.Role.COORDINATOR
    ):
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "COORDINATOR_ROLE_MISMATCH", "COORDINATOR", coordinator.pk
                ),
                module="WORKFLOW_TRACKING",
                issue_type="COORDINATOR_ROLE_MISMATCH",
                severity="BLOCKING",
                repairability="REVIEW_REQUIRED",
                title="Coordinator profile and portal role do not match",
                summary=(
                    f"{coordinator.lecturer.user.full_name} has a Coordinator profile "
                    "without the Coordinator portal role."
                ),
                record_type="COORDINATOR",
                record_id=str(coordinator.pk),
                programme=coordinator.programme_managed or None,
                student_id=None,
                current_state={
                    "role": coordinator.lecturer.user.role,
                    "programmeManaged": coordinator.programme_managed,
                },
                dependencies=[
                    "Review the account role through controlled administration."
                ],
            )
        )

    pending_programmes = set(
        SupervisorApplication.objects.filter(
            status=SupervisorApplication.Status.PENDING_COORDINATOR
        ).values_list("student__programme", flat=True)
    ) | set(
        PanelRecommendation.objects.filter(
            status=PanelRecommendation.Status.PENDING_COORDINATOR
        ).values_list("profile__programme", flat=True)
    )
    for programme in sorted(filter(None, pending_programmes)):
        if programme_coordinators(programme).exists():
            continue
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "PROGRAMME_COORDINATOR_UNAVAILABLE",
                    "PROGRAMME",
                    _programme_issue_id(programme),
                ),
                module="WORKFLOW_TRACKING",
                issue_type="PROGRAMME_COORDINATOR_UNAVAILABLE",
                severity="BLOCKING",
                repairability="REVIEW_REQUIRED",
                title="Pending approvals have no valid Programme Coordinator",
                summary=f"{programme} has pending workflow decisions but no valid Coordinator assignment.",
                record_type="PROGRAMME",
                record_id=_programme_issue_id(programme),
                programme=programme,
                student_id=None,
                current_state={"programme": programme, "hasValidCoordinator": False},
                dependencies=["Create or repair an eligible Coordinator assignment."],
            )
        )

    for application in SupervisorApplication.objects.filter(
        academic_semester__isnull=True
    ).select_related("student", "student__user"):
        issues.append(
            _semester_issue(
                application,
                module="SUPERVISOR_APPOINTMENTS",
                record_type="SUPERVISOR_APPLICATION",
                programme=application.student.programme,
                student_id=application.student.matric_no,
                occurred_on=timezone.localdate(application.submitted_at),
            )
        )
    for recommendation in PanelRecommendation.objects.filter(
        academic_semester__isnull=True
    ).select_related("profile"):
        occurred = recommendation.submitted_at or recommendation.created_at
        issues.append(
            _semester_issue(
                recommendation,
                module="PANEL_APPOINTMENTS",
                record_type="PANEL_RECOMMENDATION",
                programme=recommendation.profile.programme,
                student_id=recommendation.profile.matric_no,
                label=recommendation.profile.semester,
                occurred_on=timezone.localdate(occurred) if occurred else None,
            )
        )
    for timeline in SemesterTimeline.objects.filter(academic_semester__isnull=True):
        issues.append(
            _semester_issue(
                timeline,
                module="DASHBOARD",
                record_type="SEMESTER_TIMELINE",
                programme=None,
                student_id=None,
                label=f"{timeline.semester} {timeline.session}",
            )
        )
    for period in EvaluationPeriod.objects.filter(academic_semester__isnull=True):
        issues.append(
            _semester_issue(
                period,
                module="MARKS",
                record_type="EVALUATION_PERIOD",
                programme=None,
                student_id=None,
                label=period.semester,
                starts_at=timezone.localdate(period.opens_at) if period.opens_at else None,
                ends_at=timezone.localdate(period.closes_at) if period.closes_at else None,
            )
        )

    for profile in StudentResearchProfile.objects.filter(student__isnull=True):
        student = Student.objects.filter(matric_no__iexact=profile.matric_no).first()
        downstream_used = bool(
            profile.panel_recommendations.exists()
            or profile.panel_appointments.exists()
            or profile.evaluation_tasks.exists()
        )
        competing_profile = bool(
            student
            and StudentResearchProfile.objects.filter(student=student.user)
            .exclude(pk=profile.pk)
            .exists()
        )
        repairable = bool(student and not downstream_used and not competing_profile)
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "RESEARCH_PROFILE_UNLINKED", "RESEARCH_PROFILE", profile.pk
                ),
                module="SUPERVISOR_APPOINTMENTS",
                issue_type="RESEARCH_PROFILE_UNLINKED",
                severity="BLOCKING",
                repairability="REPAIRABLE" if repairable else "REVIEW_REQUIRED",
                title="Research profile is not linked to a Student account",
                summary=f"Research profile {profile.matric_no} has no linked user.",
                record_type="RESEARCH_PROFILE",
                record_id=str(profile.pk),
                programme=profile.programme,
                student_id=profile.matric_no,
                current_state={
                    "studentUserId": None,
                    "downstreamUsed": downstream_used,
                    "competingProfile": competing_profile,
                },
                suggestion={"studentUserId": student.user_id} if repairable else {},
                dependencies=(
                    []
                    if repairable
                    else ["Resolve profile ownership outside the portal."]
                ),
            )
        )

    for profile in StudentResearchProfile.objects.exclude(
        student__isnull=True
    ).select_related("student"):
        student = Student.objects.filter(user_id=profile.student_id).first()
        if student and _normalized(student.matric_no) == _normalized(profile.matric_no):
            continue
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "RESEARCH_PROFILE_IDENTITY_MISMATCH", "RESEARCH_PROFILE", profile.pk
                ),
                module="SUPERVISOR_APPOINTMENTS",
                issue_type="RESEARCH_PROFILE_IDENTITY_MISMATCH",
                severity="BLOCKING",
                repairability="REVIEW_REQUIRED",
                title="Research profile identity is inconsistent",
                summary=f"Research profile {profile.pk} does not match its linked Student matric identity.",
                record_type="RESEARCH_PROFILE",
                record_id=str(profile.pk),
                programme=profile.programme,
                student_id=profile.matric_no,
                current_state={
                    "profileMatricNo": profile.matric_no,
                    "studentMatricNo": student.matric_no if student else None,
                    "studentUserId": profile.student_id,
                },
                dependencies=["Resolve the conflicting identities outside the portal."],
            )
        )

    for profile in StudentResearchProfile.objects.all():
        active_appointments = list(
            SupervisorAppointment.objects.filter(
                student__matric_no__iexact=profile.matric_no,
                status=SupervisorAppointment.Status.ACTIVE,
            ).select_related("supervisor")[:2]
        )
        if len(active_appointments) != 1:
            continue
        authoritative = active_appointments[0]
        if profile.supervisor_id == authoritative.supervisor_id:
            continue
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "RESEARCH_PROFILE_SUPERVISOR_MISMATCH",
                    "RESEARCH_PROFILE",
                    profile.pk,
                ),
                module="SUPERVISOR_APPOINTMENTS",
                issue_type="RESEARCH_PROFILE_SUPERVISOR_MISMATCH",
                severity="BLOCKING",
                repairability="REPAIRABLE",
                title="Research profile Supervisor differs from active appointment",
                summary=f"{profile.matric_no} has one authoritative active Supervisor appointment.",
                record_type="RESEARCH_PROFILE",
                record_id=str(profile.pk),
                programme=profile.programme,
                student_id=profile.matric_no,
                current_state={
                    "profileSupervisorId": profile.supervisor_id,
                    "activeAppointmentId": authoritative.pk,
                    "activeSupervisorId": authoritative.supervisor_id,
                },
                suggestion={
                    "action": "SYNC_PROFILE_SUPERVISOR",
                    "supervisorId": authoritative.supervisor_id,
                },
            )
        )

    for application in SupervisorApplication.objects.filter(
        status=SupervisorApplication.Status.APPROVED,
        appointment__isnull=True,
    ).select_related("student", "proposed_supervisor"):
        approval_event = (
            application.workflow_events.filter(action="COORDINATOR_APPROVE")
            .order_by("-created_at", "-id")
            .first()
        )
        repairable = bool(
            approval_event
            and application.coordinator_decided_at
            and application.academic_semester_id
            and coordinator_manages_programme(
                approval_event.actor, application.student.programme
            )
            and student_is_workflow_eligible(application.student)
            and user_is_assignable_lecturer(application.proposed_supervisor)
            and _request_capacity_available(application)
            and not SupervisorAppointment.objects.filter(
                student=application.student,
                status=SupervisorAppointment.Status.ACTIVE,
            ).exists()
        )
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "SUPERVISOR_HANDOFF_INCOMPLETE",
                    "SUPERVISOR_APPLICATION",
                    application.pk,
                ),
                module="SUPERVISOR_APPOINTMENTS",
                issue_type="SUPERVISOR_HANDOFF_INCOMPLETE",
                severity="BLOCKING",
                repairability="REPAIRABLE" if repairable else "REVIEW_REQUIRED",
                title="Approved Supervisor workflow has no appointment",
                summary=f"Application {application.pk} is approved without a final appointment.",
                record_type="SUPERVISOR_APPLICATION",
                record_id=str(application.pk),
                programme=application.student.programme,
                student_id=application.student.matric_no,
                current_state={
                    "status": application.status,
                    "appointmentId": None,
                    "coordinatorDecisionAt": application.coordinator_decided_at,
                    "approvalEventId": approval_event.pk if approval_event else None,
                },
                suggestion=(
                    {"action": "COMPLETE_SUPERVISOR_HANDOFF"} if repairable else {}
                ),
                dependencies=(
                    []
                    if repairable
                    else ["Restore all authoritative approval prerequisites."]
                ),
            )
        )
    for recommendation in PanelRecommendation.objects.filter(
        status=PanelRecommendation.Status.APPROVED,
        panel_appointment__isnull=True,
    ).select_related("profile"):
        approval_event = (
            recommendation.workflow_events.filter(action="COORDINATOR_APPROVE")
            .order_by("-created_at", "-id")
            .first()
        )
        repairable = bool(
            approval_event
            and recommendation.coordinator_decided_at
            and recommendation.academic_semester_id
            and coordinator_manages_programme(
                approval_event.actor, recommendation.profile.programme
            )
            and profile_student_is_workflow_eligible(recommendation.profile)
            and recommendation.supervisor_id != recommendation.recommended_member_id
            and SupervisorAppointment.objects.filter(
                student__matric_no__iexact=recommendation.profile.matric_no,
                supervisor=recommendation.supervisor,
                status=SupervisorAppointment.Status.ACTIVE,
            ).exists()
            and user_is_assignable_lecturer(recommendation.recommended_member)
            and _request_capacity_available(recommendation)
            and (
                recommendation.replaces_appointment_id is not None
                or not PanelAppointment.objects.filter(
                    profile=recommendation.profile,
                    status=PanelAppointment.Status.ACTIVE,
                ).exists()
            )
        )
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "PANEL_HANDOFF_INCOMPLETE",
                    "PANEL_RECOMMENDATION",
                    recommendation.pk,
                ),
                module="PANEL_APPOINTMENTS",
                issue_type="PANEL_HANDOFF_INCOMPLETE",
                severity="BLOCKING",
                repairability="REPAIRABLE" if repairable else "REVIEW_REQUIRED",
                title="Approved Panel workflow has no appointment",
                summary=f"Recommendation {recommendation.pk} is approved without a final appointment.",
                record_type="PANEL_RECOMMENDATION",
                record_id=str(recommendation.pk),
                programme=recommendation.profile.programme,
                student_id=recommendation.profile.matric_no,
                current_state={
                    "status": recommendation.status,
                    "appointmentId": None,
                    "coordinatorDecisionAt": recommendation.coordinator_decided_at,
                    "approvalEventId": approval_event.pk if approval_event else None,
                },
                suggestion={"action": "COMPLETE_PANEL_HANDOFF"} if repairable else {},
                dependencies=(
                    [] if repairable else ["Restore authoritative approval metadata."]
                ),
            )
        )

    issues.extend(_detect_marks_issues())
    issues.extend(_detect_appointment_integrity_issues())
    if include_accepted:
        return issues
    accepted = accepted_issue_audits(issues)
    return [issue for issue in issues if issue.issue_id not in accepted]


def _task_student(task):
    if task.profile.student_id:
        return Student.objects.filter(user_id=task.profile.student_id).first()
    return Student.objects.filter(matric_no__iexact=task.profile.matric_no).first()


def _task_evaluator_and_appointment_valid(task):
    if not user_is_assignable_lecturer(task.evaluator):
        return False
    if task.evaluator_role == EvaluationTask.EvaluatorRole.SUPERVISOR:
        return SupervisorAppointment.objects.filter(
            student__matric_no__iexact=task.profile.matric_no,
            supervisor=task.evaluator,
            status=SupervisorAppointment.Status.ACTIVE,
        ).exists()
    if task.evaluator_role == EvaluationTask.EvaluatorRole.PANEL:
        return PanelAppointment.objects.filter(
            profile=task.profile,
            panel_member=task.evaluator,
            status=PanelAppointment.Status.ACTIVE,
        ).exists()
    return True


def _detect_marks_issues():
    issues = []
    tasks = EvaluationTask.objects.filter(
        lifecycle_status__in=[
            EvaluationTask.Lifecycle.ACTIVE,
            EvaluationTask.Lifecycle.PAUSED,
        ]
    ).select_related("profile__student__student", "evaluator__lecturer", "period__academic_semester", "mark_entry").prefetch_related("completion_windows__granted_by")
    submitted_ids = set(
        MarkEntry.objects.filter(
            task__in=tasks,
            status=MarkEntry.Status.SUBMITTED,
        ).values_list("task_id", flat=True)
    )
    for task in tasks:
        if task.pk in submitted_ids:
            continue
        student = _task_student(task)
        student_status = student.status if student else None
        appointment_valid = _task_evaluator_and_appointment_valid(task)
        from marks.completion_windows import task_window_active

        period_valid = task.period.accepts_submissions or bool(task_window_active(task))
        action = None
        reason = None
        review_required = False
        if task.lifecycle_status == EvaluationTask.Lifecycle.ACTIVE:
            if student and student.status == Student.Status.DEFERRED:
                action = "PAUSE_MARKS_TASK"
                reason = (
                    "The Student is deferred but the unfinished task remains active."
                )
            elif not student or not student_is_workflow_eligible(student):
                action = "RETIRE_MARKS_TASK"
                reason = "The Student is not eligible for an active evaluation task."
            elif not appointment_valid:
                action = "RETIRE_MARKS_TASK"
                reason = "The evaluator assignment has no eligible active appointment."
            elif not period_valid:
                semester = task.period.academic_semester
                if (task.period.effective_status == "CLOSED" and semester
                        and semester.lifecycle_status != AcademicSemester.Lifecycle.ARCHIVED):
                    review_required = True
                    reason = "The evaluation period closed with unfinished work; Office must review a completion window or task retirement."
                else:
                    action = "RETIRE_MARKS_TASK"
                    reason = "The evaluation period no longer accepts submissions."
        elif task.lifecycle_status == EvaluationTask.Lifecycle.PAUSED:
            if student and student.status == Student.Status.DEFERRED:
                continue
            if (
                student
                and student_is_workflow_eligible(student)
                and appointment_valid
                and period_valid
            ):
                action = "RESUME_MARKS_TASK"
                reason = "The participant, appointment, evaluator, and period are eligible again."
            else:
                action = "RETIRE_MARKS_TASK"
                reason = "The paused task can no longer return to an eligible workflow."
        if action is None and not review_required:
            continue
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "MARKS_TASK_INCONSISTENT", "EVALUATION_TASK", task.pk
                ),
                module="MARKS",
                issue_type="MARKS_TASK_INCONSISTENT",
                severity="BLOCKING",
                repairability="REVIEW_REQUIRED" if review_required else "REPAIRABLE",
                title="Evaluation task lifecycle is inconsistent",
                summary=reason,
                record_type="EVALUATION_TASK",
                record_id=str(task.pk),
                programme=task.profile.programme,
                student_id=task.profile.matric_no,
                current_state={
                    "lifecycleStatus": task.lifecycle_status,
                    "studentStatus": student_status,
                    "periodStatus": task.period.effective_status,
                    "appointmentValid": appointment_valid,
                    "evaluatorId": task.evaluator_id,
                    "evaluatorRole": task.evaluator_role,
                },
                suggestion={"action": action} if action else {},
                navigation={
                    "targetModule": "MARKS",
                    "recordType": "MARKS_TASK",
                    "recordId": str(task.pk),
                },
            )
        )

    for period in EvaluationPeriod.objects.select_related("academic_semester").all():
        if not period.accepts_submissions:
            continue
        from marks.targeting import period_recipients

        expected = {row.key for row in period_recipients(period)}
        existing = set(
            EvaluationTask.objects.filter(
                period=period,
                lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
            ).values_list("profile_id", "evaluator_id", "evaluator_role")
        )
        missing = expected - existing
        if not missing:
            continue
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(
                    "MARKS_TASKS_MISSING", "EVALUATION_PERIOD", period.pk
                ),
                module="MARKS",
                issue_type="MARKS_TASKS_MISSING",
                severity="BLOCKING",
                repairability="REPAIRABLE",
                title="Eligible evaluation tasks are missing",
                summary=f"Evaluation period {period.name} is missing {len(missing)} official task(s).",
                record_type="EVALUATION_PERIOD",
                record_id=str(period.pk),
                programme=None,
                student_id=None,
                current_state={
                    "periodStatus": period.effective_status,
                    "missingCount": len(missing),
                    "missingAssignments": sorted(
                        [list(item) for item in missing],
                        key=lambda item: tuple(map(str, item)),
                    ),
                },
                suggestion={"action": "GENERATE_MISSING_MARKS_TASKS"},
            )
        )
    return issues


def _detect_appointment_integrity_issues():
    issues = []
    appointment_specs = (
        (
            SupervisorAppointment.objects.select_related("application", "student"),
            "SUPERVISOR_APPOINTMENT",
            "SUPERVISOR_APPOINTMENTS",
            "application",
            SupervisorApplication.Status.APPROVED,
        ),
        (
            PanelAppointment.objects.select_related("recommendation", "profile"),
            "PANEL_APPOINTMENT",
            "PANEL_APPOINTMENTS",
            "recommendation",
            PanelRecommendation.Status.APPROVED,
        ),
    )
    for (
        queryset,
        record_type,
        module,
        source_field,
        approved_status,
    ) in appointment_specs:
        for appointment in queryset:
            source = getattr(appointment, source_field)
            programme = (
                appointment.student.programme
                if record_type == "SUPERVISOR_APPOINTMENT"
                else appointment.profile.programme
            )
            student_id = (
                appointment.student.matric_no
                if record_type == "SUPERVISOR_APPOINTMENT"
                else appointment.profile.matric_no
            )
            problems = []
            if source.status != approved_status:
                problems.append("The source workflow is not approved.")
            if source.replaces_appointment_id != appointment.supersedes_id:
                problems.append(
                    "Replacement lineage differs between workflow and appointment."
                )
            if appointment.supersedes_id and (
                appointment.supersedes.status == appointment.supersedes.Status.ACTIVE
                or appointment.supersedes.end_outcome
                != appointment.supersedes.EndOutcome.REPLACED
            ):
                problems.append("The superseded appointment is not closed as replaced.")
            if not problems:
                continue
            issues.append(
                ReconciliationIssue(
                    issue_id=_issue_id(
                        "APPOINTMENT_LINEAGE_INCONSISTENT", record_type, appointment.pk
                    ),
                    module=module,
                    issue_type="APPOINTMENT_LINEAGE_INCONSISTENT",
                    severity="BLOCKING",
                    repairability="REVIEW_REQUIRED",
                    title="Appointment source or replacement lineage is inconsistent",
                    summary=" ".join(problems),
                    record_type=record_type,
                    record_id=str(appointment.pk),
                    programme=programme,
                    student_id=student_id,
                    current_state={
                        "status": appointment.status,
                        "sourceStatus": source.status,
                        "supersedesId": appointment.supersedes_id,
                        "sourceReplacesAppointmentId": source.replaces_appointment_id,
                    },
                    dependencies=[
                        "Review the immutable workflow and appointment history."
                    ],
                )
            )
    return issues


def get_reconciliation_issue(issue_id):
    return next(
        (
            issue
            for issue in detect_reconciliation_issues(include_accepted=True)
            if issue.issue_id == issue_id
        ),
        None,
    )


ACCEPT_INTENTIONAL = "ACCEPT_INTENTIONAL"
ACCEPTABLE_WARNING_TYPES = frozenset({"SEMESTER_UNASSIGNED", "CAPACITY_ENTRY_ROLE_MISMATCH"})


def can_accept_issue(issue):
    if issue.severity != "WARNING" or issue.repairability != "REVIEW_REQUIRED" or issue.issue_type not in ACCEPTABLE_WARNING_TYPES:
        return False
    if issue.issue_type == "CAPACITY_ENTRY_ROLE_MISMATCH":
        return True
    if issue.record_type == "SEMESTER_TIMELINE":
        return issue.current_state.get("isCurrentTimeline") is False
    if issue.record_type in {"SUPERVISOR_APPLICATION", "PANEL_RECOMMENDATION"}:
        return str(issue.current_state.get("recordStatus", "")).startswith(("REJECTED_", "CANCELLED_"))
    return False


def accepted_issue_audits(issues):
    """An acceptance applies only to the same eligible warning and exact evidence."""
    eligible = {(item.issue_type, item.record_type, item.record_id, item.fingerprint): item.issue_id
                for item in issues if can_accept_issue(item)}
    if not eligible:
        return {}
    audits = WorkflowReconciliationAudit.objects.filter(
        action=ACCEPT_INTENTIONAL, fingerprint__in=[key[3] for key in eligible],
    ).select_related("actor")
    return {eligible[key]: audit for audit in audits
            if (key := (audit.issue_type, audit.entity_type, audit.entity_id, audit.fingerprint)) in eligible}


def acceptance_payload(audit):
    return {"id": audit.pk, "actor": {"id": audit.actor_id, "name": audit.actor.full_name},
            "reason": audit.reason, "createdAt": audit.created_at.isoformat()}


@transaction.atomic
def accept_reconciliation_issue(*, issue_id, expected_fingerprint, reason, actor):
    from accounts.models import User

    if actor.role != User.Role.OFFICE_ADMIN:
        raise ReconciliationError("Only Office Staff/Admin can accept a warning.")
    if not reason.strip():
        raise ReconciliationError("A reason is required.")
    issue = get_reconciliation_issue(issue_id)
    if issue is None or issue.fingerprint != expected_fingerprint:
        raise ReconciliationConflict("The issue changed after preview. Refresh and review it again.")
    if not can_accept_issue(issue):
        raise ReconciliationConflict("This issue requires correction and cannot be accepted as intentional.")
    try:
        with transaction.atomic():
            audit = WorkflowReconciliationAudit.objects.create(
                issue_type=issue.issue_type, entity_type=issue.record_type, entity_id=issue.record_id,
                action=ACCEPT_INTENTIONAL, actor=actor, reason=reason.strip(), fingerprint=issue.fingerprint,
                before_values=issue.current_state, after_values=issue.current_state,
                affected_records={"issue": issue.to_dict()},
            )
    except IntegrityError as exc:
        raise ReconciliationConflict("This warning has already been accepted. Refresh the list.") from exc
    return {"accepted": True, "issueId": issue.issue_id, "acceptance": acceptance_payload(audit)}


def allowed_resolutions(issue):
    if issue.repairability != "REPAIRABLE":
        return []
    if issue.issue_type == "SEMESTER_UNASSIGNED" and issue.suggestion.get("semesterId"):
        return [
            {
                "action": "ASSIGN_SEMESTER",
                "label": "Assign verified academic semester",
                "semesterId": issue.suggestion["semesterId"],
            }
        ]
    if issue.issue_type == "CAPACITY_PLAN_MISSING" and issue.suggestion.get(
        "sourcePlanId"
    ):
        return [
            {
                "action": "COPY_CAPACITY_PLAN",
                "label": "Copy the verified prior Published capacity plan",
                "sourcePlanId": issue.suggestion["sourcePlanId"],
            }
        ]
    if issue.issue_type == "COORDINATOR_PROFILE_MISSING":
        return [
            {
                "action": "CREATE_COORDINATOR_PROFILE",
                "label": "Create Coordinator profile and assign programme",
                "requiresProgramme": True,
            }
        ]
    if issue.issue_type == "COORDINATOR_PROGRAMME_MISSING":
        return [
            {
                "action": "ASSIGN_COORDINATOR_PROGRAMME",
                "label": "Assign managed programme",
                "requiresProgramme": True,
            }
        ]
    if issue.issue_type == "RESEARCH_PROFILE_UNLINKED":
        return [
            {
                "action": "LINK_RESEARCH_PROFILE",
                "label": "Link exact matric-number Student account",
                "studentUserId": issue.suggestion.get("studentUserId"),
            }
        ]
    if issue.issue_type == "RESEARCH_PROFILE_SUPERVISOR_MISMATCH":
        return [
            {
                "action": "SYNC_PROFILE_SUPERVISOR",
                "label": "Use the sole active Supervisor appointment",
                "supervisorId": issue.suggestion.get("supervisorId"),
            }
        ]
    if issue.issue_type == "SUPERVISOR_HANDOFF_INCOMPLETE":
        return [
            {
                "action": "COMPLETE_SUPERVISOR_HANDOFF",
                "label": "Create the missing approved Supervisor appointment",
            }
        ]
    if issue.issue_type == "PANEL_HANDOFF_INCOMPLETE":
        return [
            {
                "action": "COMPLETE_PANEL_HANDOFF",
                "label": "Create the missing approved Panel appointment",
            }
        ]
    if issue.issue_type == "MARKS_TASK_INCONSISTENT" and issue.suggestion.get("action"):
        return [
            {
                "action": issue.suggestion["action"],
                "label": issue.suggestion["action"].replace("_", " ").title(),
            }
        ]
    if issue.issue_type == "MARKS_TASKS_MISSING":
        return [
            {
                "action": "GENERATE_MISSING_MARKS_TASKS",
                "label": "Generate missing eligible evaluation tasks",
            }
        ]
    return []


SEMESTER_RECORD_MODELS = {
    "SUPERVISOR_APPLICATION": SupervisorApplication,
    "PANEL_RECOMMENDATION": PanelRecommendation,
    "SEMESTER_TIMELINE": SemesterTimeline,
    "EVALUATION_PERIOD": EvaluationPeriod,
}


def _revalidate_locked_issue(issue):
    current = get_reconciliation_issue(issue.issue_id)
    if current is None or current.fingerprint != issue.fingerprint:
        raise ReconciliationConflict(
            "The issue changed after preview. Refresh and review it again."
        )


def _apply_semester_assignment(issue, resolution):
    model = SEMESTER_RECORD_MODELS.get(issue.record_type)
    if model is None:
        raise ReconciliationError("This record type cannot receive a semester.")
    try:
        semester_id = int(resolution.get("semesterId"))
    except (TypeError, ValueError):
        raise ReconciliationError("A valid semesterId is required.") from None
    if semester_id != issue.suggestion.get("semesterId"):
        raise ReconciliationConflict(
            "The selected semester is not the current unambiguous suggestion."
        )
    semester = (
        AcademicSemester.objects.select_for_update(no_key=True).filter(pk=semester_id).first()
    )
    record = model.objects.select_for_update().filter(pk=issue.record_id).first()
    if record is None or semester is None:
        raise ReconciliationConflict(
            "The affected record or semester no longer exists."
        )
    if record.academic_semester_id is not None:
        raise ReconciliationConflict("The record already has an academic semester.")
    _revalidate_locked_issue(issue)
    before = {"academicSemesterId": None}
    record.academic_semester = semester
    record.save(update_fields=["academic_semester"])
    after = {
        "academicSemesterId": semester.pk,
        "semesterCode": semester.code,
        "semesterLabel": semester.label,
    }
    return (
        before,
        after,
        {
            "recordType": issue.record_type,
            "recordId": issue.record_id,
            "semesterId": semester.pk,
        },
    )


def _validated_programme(resolution):
    programme = str(resolution.get("programme") or "").strip()
    if not programme:
        raise ReconciliationError("A managed programme is required.")
    canonical = (
        Student.objects.exclude(programme="")
        .filter(programme__iexact=programme)
        .values_list("programme", flat=True)
        .first()
    )
    if canonical is None:
        raise ReconciliationError(
            "The selected programme is not represented by a Student record."
        )
    return canonical


def _apply_coordinator_profile(issue, resolution):
    programme = _validated_programme(resolution)
    user = User.objects.select_for_update().filter(pk=issue.record_id).first()
    if user is None or user.role != User.Role.COORDINATOR:
        raise ReconciliationConflict(
            "The account is no longer an eligible Coordinator."
        )
    lecturer = Lecturer.objects.select_for_update().filter(user=user).first()
    if lecturer is None:
        raise ReconciliationConflict("The Coordinator account has no Lecturer profile.")
    if Coordinator.objects.filter(lecturer=lecturer).exists():
        raise ReconciliationConflict("The Coordinator profile already exists.")
    coordinator = Coordinator.objects.create(
        lecturer=lecturer,
        programme_managed=programme,
    )
    return (
        {"coordinatorProfileId": None, "programmeManaged": None},
        {"coordinatorProfileId": coordinator.pk, "programmeManaged": programme},
        {"userId": user.pk, "lecturerId": lecturer.pk, "coordinatorId": coordinator.pk},
    )


def _apply_coordinator_programme(issue, resolution):
    programme = _validated_programme(resolution)
    coordinator = (
        Coordinator.objects.select_for_update()
        .select_related("lecturer__user")
        .filter(pk=issue.record_id)
        .first()
    )
    if coordinator is None:
        raise ReconciliationConflict("The Coordinator profile no longer exists.")
    if coordinator.lecturer.user.role != User.Role.COORDINATOR:
        raise ReconciliationConflict(
            "The profile role mismatch requires manual review."
        )
    if coordinator.programme_managed.strip():
        raise ReconciliationConflict("The Coordinator already has a managed programme.")
    before = {"programmeManaged": coordinator.programme_managed}
    coordinator.programme_managed = programme
    coordinator.save(update_fields=["programme_managed"])
    return (
        before,
        {"programmeManaged": programme},
        {"coordinatorId": coordinator.pk, "userId": coordinator.lecturer.user_id},
    )


def _apply_research_profile_link(issue):
    profile = (
        StudentResearchProfile.objects.select_for_update()
        .filter(pk=issue.record_id)
        .first()
    )
    if profile is None or profile.student_id is not None:
        raise ReconciliationConflict("The research profile is no longer unassigned.")
    student = (
        Student.objects.select_for_update()
        .select_related("user")
        .filter(matric_no__iexact=profile.matric_no)
        .first()
    )
    if student is None:
        raise ReconciliationConflict("No exact matric-number Student account exists.")
    if (
        StudentResearchProfile.objects.filter(student=student.user)
        .exclude(pk=profile.pk)
        .exists()
    ):
        raise ReconciliationConflict(
            "A competing research profile exists for this Student."
        )
    if (
        profile.panel_recommendations.exists()
        or profile.panel_appointments.exists()
        or profile.evaluation_tasks.exists()
    ):
        raise ReconciliationConflict(
            "This profile has downstream history and cannot be relinked here."
        )
    profile.student = student.user
    profile.save(update_fields=["student", "updated_at"])
    return (
        {"studentUserId": None},
        {"studentUserId": student.user_id},
        {"researchProfileId": profile.pk, "studentUserId": student.user_id},
    )


def _apply_profile_supervisor_sync(issue):
    profile = (
        StudentResearchProfile.objects.select_for_update()
        .filter(pk=issue.record_id)
        .first()
    )
    if profile is None:
        raise ReconciliationConflict("The research profile no longer exists.")
    appointments = list(
        SupervisorAppointment.objects.select_for_update().filter(
            student__matric_no__iexact=profile.matric_no,
            status=SupervisorAppointment.Status.ACTIVE,
        )[:2]
    )
    if len(appointments) != 1:
        raise ReconciliationConflict(
            "There is no longer one authoritative active appointment."
        )
    appointment = appointments[0]
    if appointment.supervisor_id != issue.suggestion.get("supervisorId"):
        raise ReconciliationConflict(
            "The authoritative Supervisor changed after preview."
        )
    before = {"supervisorId": profile.supervisor_id}
    profile.supervisor_id = appointment.supervisor_id
    profile.save(update_fields=["supervisor", "updated_at"])
    return (
        before,
        {"supervisorId": appointment.supervisor_id},
        {
            "researchProfileId": profile.pk,
            "supervisorAppointmentId": appointment.pk,
            "supervisorId": appointment.supervisor_id,
        },
    )


def _approval_event_for(source):
    query = AppointmentWorkflowEvent.objects.select_for_update().filter(
        action="COORDINATOR_APPROVE"
    )
    if isinstance(source, SupervisorApplication):
        query = query.filter(supervisor_application=source)
    else:
        query = query.filter(panel_recommendation=source)
    return query.select_related("actor").order_by("-created_at", "-id").first()


def _apply_supervisor_handoff(issue, actor):
    from appointments.capacity_reassessment import lock_policy_semesters

    lock_policy_semesters()
    student_id = SupervisorApplication.objects.filter(pk=issue.record_id).values_list(
        "student_id", flat=True
    ).first()
    if student_id:
        Student.objects.select_for_update().filter(pk=student_id).first()
    application = (
        SupervisorApplication.objects.select_for_update(of=("self",))
        .select_related(
            "student", "student__user", "proposed_supervisor", "academic_semester"
        )
        .filter(pk=issue.record_id)
        .first()
    )
    if (
        application is None
        or application.status != SupervisorApplication.Status.APPROVED
    ):
        raise ReconciliationConflict("The Supervisor workflow is no longer approved.")
    if SupervisorAppointment.objects.filter(application=application).exists():
        raise ReconciliationConflict("The Supervisor appointment already exists.")
    approval_event = _approval_event_for(application)
    if not approval_event or not application.coordinator_decided_at:
        raise ReconciliationConflict(
            "Authoritative Coordinator approval metadata is missing."
        )
    if not coordinator_manages_programme(
        approval_event.actor, application.student.programme
    ):
        raise ReconciliationConflict(
            "The original approval actor is no longer authoritative for this programme."
        )
    if not application.academic_semester_id:
        raise ReconciliationConflict(
            "The workflow must have an academic semester before handoff."
        )
    if not student_is_workflow_eligible(application.student):
        raise ReconciliationConflict(
            "The Student is not currently eligible for appointment activation."
        )
    if not user_is_assignable_lecturer(application.proposed_supervisor):
        raise ReconciliationConflict("The proposed Supervisor is no longer assignable.")
    Lecturer.objects.select_for_update().get(pk=application.proposed_supervisor_id)
    if not _request_capacity_available(application):
        raise ReconciliationConflict(
            "The proposed Supervisor has reached the workload limit."
        )
    try:
        profile = _resolve_research_profile(application)
        appointment = activate_replacement(
            model=SupervisorAppointment,
            replacement_source=application,
            actor=actor,
            create_values={
                "application": application,
                "student": application.student,
                "supervisor": application.proposed_supervisor,
                "approved_by": approval_event.actor,
                "appointment_date": timezone.localtime(
                    application.coordinator_decided_at
                ).date(),
            },
        )
    except (SupervisorApprovalConflict, AppointmentLifecycleConflict) as exc:
        raise ReconciliationConflict(str(exc)) from exc
    from appointments.capacity_closure import close_capacity_full_requests
    close_capacity_full_requests(supervisor=application.proposed_supervisor, actor=actor)
    return (
        {"appointmentId": None, "researchProfileId": None},
        {"appointmentId": appointment.pk, "researchProfileId": profile.pk},
        {
            "supervisorApplicationId": application.pk,
            "supervisorAppointmentId": appointment.pk,
            "researchProfileId": profile.pk,
            "approvedById": approval_event.actor_id,
        },
    )


def _apply_panel_handoff(issue, actor):
    from appointments.capacity_reassessment import lock_policy_semesters

    lock_policy_semesters()
    student_id = PanelRecommendation.objects.filter(pk=issue.record_id).values_list(
        "profile__student_id", flat=True
    ).first()
    if student_id:
        Student.objects.select_for_update().filter(pk=student_id).first()
    recommendation = (
        PanelRecommendation.objects.select_for_update(of=("self",))
        .select_related(
            "profile",
            "recommended_member",
            "supervisor",
            "academic_semester",
            "replaces_appointment",
        )
        .filter(pk=issue.record_id)
        .first()
    )
    if (
        recommendation is None
        or recommendation.status != PanelRecommendation.Status.APPROVED
    ):
        raise ReconciliationConflict("The Panel workflow is no longer approved.")
    if PanelAppointment.objects.filter(recommendation=recommendation).exists():
        raise ReconciliationConflict("The Panel appointment already exists.")
    approval_event = _approval_event_for(recommendation)
    if not approval_event or not recommendation.coordinator_decided_at:
        raise ReconciliationConflict(
            "Authoritative Coordinator approval metadata is missing."
        )
    if not coordinator_manages_programme(
        approval_event.actor, recommendation.profile.programme
    ):
        raise ReconciliationConflict(
            "The original approval actor is no longer authoritative for this programme."
        )
    if not recommendation.academic_semester_id:
        raise ReconciliationConflict(
            "The workflow must have an academic semester before handoff."
        )
    if not profile_student_is_workflow_eligible(recommendation.profile):
        raise ReconciliationConflict(
            "The Student is not currently eligible for appointment activation."
        )
    if recommendation.supervisor_id == recommendation.recommended_member_id:
        raise ReconciliationConflict(
            "A Supervisor cannot be appointed as the same Student's Panel member."
        )
    if not SupervisorAppointment.objects.filter(
        student__matric_no__iexact=recommendation.profile.matric_no,
        supervisor=recommendation.supervisor,
        status=SupervisorAppointment.Status.ACTIVE,
    ).exists():
        raise ReconciliationConflict(
            "The submitting Supervisor has no authoritative active appointment."
        )
    if not user_is_assignable_lecturer(recommendation.recommended_member):
        raise ReconciliationConflict(
            "The selected Panel lecturer is no longer assignable."
        )
    Lecturer.objects.select_for_update().get(pk=recommendation.recommended_member_id)
    try:
        assert_request_capacity(recommendation)
    except CapacityConflict as exc:
        raise ReconciliationConflict(str(exc)) from exc
    try:
        appointment = activate_replacement(
            model=PanelAppointment,
            replacement_source=recommendation,
            actor=actor,
            create_values={
                "recommendation": recommendation,
                "profile": recommendation.profile,
                "supervisor": recommendation.supervisor,
                "panel_member": recommendation.recommended_member,
                "approved_by": approval_event.actor,
                "appointment_date": timezone.localtime(
                    recommendation.coordinator_decided_at
                ).date(),
            },
        )
    except AppointmentLifecycleConflict as exc:
        raise ReconciliationConflict(str(exc)) from exc
    from appointments.capacity_closure import close_capacity_full_panel_requests
    close_capacity_full_panel_requests(panel_member=recommendation.recommended_member, actor=actor)
    return (
        {"appointmentId": None},
        {"appointmentId": appointment.pk},
        {
            "panelRecommendationId": recommendation.pk,
            "panelAppointmentId": appointment.pk,
            "approvedById": approval_event.actor_id,
        },
    )


MARKS_RECONCILIATION_ACTIONS = {
    "PAUSE_MARKS_TASK": "PAUSED",
    "RESUME_MARKS_TASK": "RESUMED",
    "RETIRE_MARKS_TASK": "RETIRED",
}


def _apply_marks_task(issue, action, actor, reason):
    task = EvaluationTask.objects.filter(pk=issue.record_id).first()
    if task is None:
        raise ReconciliationConflict("The evaluation task no longer exists.")
    before = {"lifecycleStatus": task.lifecycle_status}
    try:
        task = reconcile_evaluation_task(
            task_id=task.pk,
            action=MARKS_RECONCILIATION_ACTIONS[action],
            actor=actor,
            reason=reason,
        )
    except MarksStateConflict as exc:
        raise ReconciliationConflict(str(exc)) from exc
    return (
        before,
        {"lifecycleStatus": task.lifecycle_status},
        {"evaluationTaskId": task.pk},
    )


def _apply_missing_marks_tasks(issue, actor):
    period = EvaluationPeriod.objects.filter(pk=issue.record_id).first()
    if period is None:
        raise ReconciliationConflict("The evaluation period no longer exists.")
    before = {
        "activeTaskCount": period.tasks.filter(
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE
        ).count()
    }
    try:
        result = ensure_period_tasks(period, actor=actor)
    except MarksStateConflict as exc:
        raise ReconciliationConflict(str(exc)) from exc
    after = {"activeTaskCount": result["period_total"]}
    return before, after, {"evaluationPeriodId": period.pk, **result}


def _apply_capacity_plan_copy(issue, actor):
    semester = AcademicSemester.objects.select_for_update().get(pk=issue.record_id)
    if semester.lifecycle_status != AcademicSemester.Lifecycle.DRAFT:
        raise ReconciliationConflict(
            "Only a Draft semester can copy a missing capacity plan."
        )
    if semester.capacity_plans.exists():
        raise ReconciliationConflict(
            "The semester already has capacity policy history."
        )
    source_id = issue.suggestion.get("sourcePlanId")
    source = (
        SemesterCapacityPlan.objects.select_for_update()
        .filter(
            pk=source_id,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        .first()
    )
    if source is None:
        raise ReconciliationConflict(
            "The verified prior Published capacity plan is no longer available."
        )
    _revalidate_locked_issue(issue)
    before = {
        "semesterId": semester.pk,
        "capacityPlanIds": [],
        "sourcePlanId": source.pk,
    }
    try:
        copied = create_capacity_plan(
            semester=semester,
            actor=actor,
            copy_from=source,
        )
    except CapacityLifecycleConflict as exc:
        raise ReconciliationConflict(str(exc)) from exc
    after = {
        "semesterId": semester.pk,
        "capacityPlanIds": [copied.pk],
        "sourcePlanId": source.pk,
    }
    return (
        before,
        after,
        {
            "academicSemesterId": semester.pk,
            "capacityPlanId": copied.pk,
            "sourcePlanId": source.pk,
        },
    )


@transaction.atomic
def apply_reconciliation_issue(
    *, issue_id, expected_fingerprint, reason, resolution, actor
):
    issue = get_reconciliation_issue(issue_id)
    if issue is None:
        raise ReconciliationConflict("This issue has already been resolved or removed.")
    if issue.fingerprint != expected_fingerprint:
        raise ReconciliationConflict(
            "The issue changed after preview. Refresh and review it again."
        )
    if issue.repairability != "REPAIRABLE":
        raise ReconciliationConflict(
            "This issue requires manual review and cannot be repaired here."
        )

    action = str(resolution.get("action") or "").strip().upper()
    valid_actions = {item["action"] for item in allowed_resolutions(issue)}
    if action not in valid_actions:
        raise ReconciliationError(
            "The selected resolution is not valid for this issue."
        )

    # Write handlers lock their affected rows and recheck their prerequisites.
    if action == "ASSIGN_SEMESTER":
        before, after, affected = _apply_semester_assignment(issue, resolution)
    elif action == "CREATE_COORDINATOR_PROFILE":
        before, after, affected = _apply_coordinator_profile(issue, resolution)
    elif action == "ASSIGN_COORDINATOR_PROGRAMME":
        before, after, affected = _apply_coordinator_programme(issue, resolution)
    elif action == "LINK_RESEARCH_PROFILE":
        before, after, affected = _apply_research_profile_link(issue)
    elif action == "SYNC_PROFILE_SUPERVISOR":
        before, after, affected = _apply_profile_supervisor_sync(issue)
    elif action == "COMPLETE_SUPERVISOR_HANDOFF":
        before, after, affected = _apply_supervisor_handoff(issue, actor)
    elif action == "COMPLETE_PANEL_HANDOFF":
        before, after, affected = _apply_panel_handoff(issue, actor)
    elif action in MARKS_RECONCILIATION_ACTIONS:
        before, after, affected = _apply_marks_task(issue, action, actor, reason)
    elif action == "GENERATE_MISSING_MARKS_TASKS":
        before, after, affected = _apply_missing_marks_tasks(issue, actor)
    elif action == "COPY_CAPACITY_PLAN":
        before, after, affected = _apply_capacity_plan_copy(issue, actor)
    else:
        raise ReconciliationError("The selected resolution is not supported.")

    WorkflowReconciliationAudit.objects.create(
        issue_type=issue.issue_type,
        entity_type=issue.record_type,
        entity_id=issue.record_id,
        action=action,
        actor=actor,
        reason=reason,
        fingerprint=expected_fingerprint,
        before_values=before,
        after_values=after,
        affected_records=affected,
    )
    return {"resolved": True, "issueId": issue.issue_id, "action": action}


def filter_reconciliation_issues(issues, params):
    module = str(params.get("module") or "").strip().upper()
    severity = str(params.get("severity") or "").strip().upper()
    repairability = str(params.get("repairability") or "").strip().upper()
    programme = _normalized(params.get("programme"))
    search = _normalized(params.get("search"))
    filtered = []
    for issue in issues:
        if module and issue.module != module:
            continue
        if severity and issue.severity != severity:
            continue
        if repairability and issue.repairability != repairability:
            continue
        if programme and _normalized(issue.programme) != programme:
            continue
        haystack = _normalized(
            " ".join(
                filter(
                    None,
                    [
                        issue.title,
                        issue.summary,
                        issue.record_type,
                        issue.record_id,
                        issue.student_id,
                        issue.programme,
                        *[str(issue.current_state.get(key) or "") for key in (
                            "lecturerName", "staffNo", "semesterLabel", "semesterCode", "recordedSemester",
                        )],
                    ],
                )
            )
        )
        if search and search not in haystack:
            continue
        filtered.append(issue)
    # Prioritize blocking checks before paging so warnings cannot bury them.
    return sorted(filtered, key=lambda issue: (
        issue.severity != "BLOCKING",
        issue.repairability != "REPAIRABLE",
        issue.title.casefold(),
        issue.issue_id,
    ))
