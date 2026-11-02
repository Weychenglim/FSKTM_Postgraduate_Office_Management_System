"""Read-only supporting-supervision projections for tracking and data quality."""

from collections import Counter, defaultdict

from django.db.models import Q

from accounts.authorization import coordinator_scope_q
from accounts.models import User
from appointments.co_supervision import nominations_queryset
from appointments.models import (
    CoSupervisorAppointment,
    CoSupervisorNomination,
    PanelAppointment,
    PanelRecommendation,
    SupervisorAppointment,
)


def scoped_nominations(user, programme=None):
    rows = nominations_queryset()
    if user.role == User.Role.COORDINATOR:
        rows = rows.filter(coordinator_scope_q(user, "student__programme"))
    elif user.role == User.Role.LECTURER:
        rows = rows.filter(Q(candidate=user) | Q(nominator=user))
    elif user.role == User.Role.STUDENT:
        return rows.none()
    elif user.role != User.Role.OFFICE_ADMIN:
        return rows.none()
    if programme:
        rows = rows.filter(student__programme__trim__iexact=programme)
    return rows


def co_supervisor_actions(user, now):
    from appointments.ageing import elapsed_calendar_days

    rows = scoped_nominations(user).filter(
        status__in=CoSupervisorNomination.PENDING_STATUSES
    )
    if user.role == User.Role.COORDINATOR:
        rows = rows.filter(status=CoSupervisorNomination.Status.PENDING_COORDINATOR)
    result = []
    for row in rows:
        waiting_on = (
            "PROGRAMME_COORDINATOR"
            if row.status == CoSupervisorNomination.Status.PENDING_COORDINATOR
            else "CO_SUPERVISOR"
        )
        timestamp = (
            row.candidate_decided_at
            if waiting_on == "PROGRAMME_COORDINATOR"
            else row.submitted_at
        )
        timestamp = timestamp or row.updated_at
        days = elapsed_calendar_days(timestamp, now=now)
        result.append(
            {
                "id": f"co_supervisor_{row.pk}",
                "name": f"Co-supervisor nomination: {row.student.user.full_name}",
                "status": "pending",
                "statusText": f'{waiting_on.replace("_", " ").title()} for {days} calendar days',
                "target": "Supervisor Appointments",
                "targetModule": "SUPERVISOR_APPOINTMENTS",
                "recordType": "CO_SUPERVISOR_NOMINATION",
                "recordId": str(row.pk),
                "waitingSince": timestamp,
                "waitingDays": days,
                "waitingOn": waiting_on,
                "semester": row.academic_semester.label,
                "semesterCode": row.academic_semester.code,
                "dueAt": None,
                "daysUntilDue": None,
                "deadlineState": None,
            }
        )
    return result


def co_supervisor_reconciliation_issues():
    from .reconciliation import ReconciliationIssue, _issue_id

    issues = []
    nominations = list(
        nominations_queryset().select_related("primary_appointment").all()
    )
    appointments = list(
        CoSupervisorAppointment.objects.select_related(
            "student__user", "nomination", "supersedes"
        ).all()
    )
    by_source = {row.nomination_id: row for row in appointments}
    active = defaultdict(list)
    pending = defaultdict(list)
    primary_pairs = set(
        SupervisorAppointment.objects.filter(status="ACTIVE").values_list(
            "student_id", "supervisor_id"
        )
    )
    panel_pairs = set(
        PanelAppointment.objects.filter(status="ACTIVE").values_list(
            "profile__matric_no", "panel_member_id"
        )
    )
    panel_pairs.update(
        PanelRecommendation.objects.filter(
            status__in=PanelRecommendation.PENDING_STATUSES
        ).values_list("profile__matric_no", "recommended_member_id")
    )
    panel_pairs = {(str(matric).casefold(), user_id) for matric, user_id in panel_pairs}

    def issue(kind, row, record_type, title, state):
        record_id = row.student_id if record_type == "CO_SUPERVISOR_TEAM" else row.pk
        issues.append(
            ReconciliationIssue(
                issue_id=_issue_id(kind, record_type, record_id),
                module="SUPERVISOR_APPOINTMENTS",
                issue_type=kind,
                severity="BLOCKING",
                repairability="REVIEW_REQUIRED",
                title=title,
                summary="Review the supporting appointment, source decisions, and immutable history.",
                record_type=record_type,
                record_id=str(record_id),
                programme=row.student.programme,
                student_id=row.student.matric_no,
                current_state=state,
            )
        )

    for row in nominations:
        if row.status == "APPROVED" and row.pk not in by_source:
            issue(
                "CO_SUPERVISOR_HANDOFF_MISSING",
                row,
                "CO_SUPERVISOR_NOMINATION",
                "Approved co-supervisor nomination has no appointment",
                {"status": row.status, "candidateId": row.candidate_id},
            )
        if row.status in CoSupervisorNomination.PENDING_STATUSES:
            pending[row.student_id].append(row)
            if (
                row.primary_appointment.status != "ACTIVE"
                or row.primary_appointment.student_id != row.student_id
                or row.primary_appointment.supervisor_id != row.nominator_id
            ):
                issue(
                    "CO_SUPERVISOR_PRIMARY_INCONSISTENT",
                    row,
                    "CO_SUPERVISOR_NOMINATION",
                    "Pending nomination has no matching active primary supervisor",
                    {
                        "primaryAppointmentId": row.primary_appointment_id,
                        "primaryStatus": row.primary_appointment.status,
                        "nominatorId": row.nominator_id,
                    },
                )
            if (row.student.matric_no.casefold(), row.candidate_id) in panel_pairs:
                issue(
                    "CO_SUPERVISOR_PANEL_OVERLAP",
                    row,
                    "CO_SUPERVISOR_NOMINATION",
                    "Co-supervisor nomination conflicts with Panel duties",
                    {"candidateId": row.candidate_id, "status": row.status},
                )
    for row in appointments:
        source = row.nomination
        problems = []
        if (
            source.status != "APPROVED"
            or source.student_id != row.student_id
            or source.candidate_id != row.supervisor_id
        ):
            problems.append("Source approval or identity mismatch")
        if source.replaces_appointment_id != row.supersedes_id:
            problems.append("Replacement source mismatch")
        if row.supersedes_id and (
            row.supersedes.status != "ENDED"
            or row.supersedes.end_outcome != "REPLACED"
            or row.supersedes.student_id != row.student_id
        ):
            problems.append("Invalid predecessor lifecycle")
        if problems:
            issue(
                "CO_SUPERVISOR_RECORD_INCONSISTENT",
                row,
                "CO_SUPERVISOR_APPOINTMENT",
                "Supporting appointment source or history is inconsistent",
                {
                    "problems": problems,
                    "sourceId": source.pk,
                    "sourceStatus": source.status,
                    "studentId": row.student_id,
                    "supervisorId": row.supervisor_id,
                    "supersedesId": row.supersedes_id,
                },
            )
        if row.status == "ACTIVE":
            active[row.student_id].append(row)
            if (row.student.matric_no.casefold(), row.supervisor_id) in panel_pairs:
                issue(
                    "CO_SUPERVISOR_PANEL_OVERLAP",
                    row,
                    "CO_SUPERVISOR_APPOINTMENT",
                    "Co-supervisor also holds or awaits Panel duties",
                    {"supervisorId": row.supervisor_id, "status": row.status},
                )
            if (row.student_id, row.supervisor_id) in primary_pairs:
                issue(
                    "CO_SUPERVISOR_PRIMARY_OVERLAP",
                    row,
                    "CO_SUPERVISOR_APPOINTMENT",
                    "Primary and supporting supervisor identities overlap",
                    {"supervisorId": row.supervisor_id, "status": row.status},
                )
    for student_id in active.keys() | pending.keys():
        members, requests = active[student_id], pending[student_id]
        member_ids = {row.pk for row in members}
        occupied = len(members) + sum(
            row.replaces_appointment_id not in member_ids for row in requests
        )
        candidates = Counter(
            [row.supervisor_id for row in members]
            + [row.candidate_id for row in requests]
        )
        if occupied > 2 or any(count > 1 for count in candidates.values()):
            representative = (members or requests)[0]
            issue(
                "CO_SUPERVISOR_TEAM_INCONSISTENT",
                representative,
                "CO_SUPERVISOR_TEAM",
                "Supporting team exceeds its limit or contains duplicate lecturers",
                {
                    "activeIds": sorted(member_ids),
                    "pendingIds": sorted(row.pk for row in requests),
                    "occupiedPositions": occupied,
                    "candidateCounts": dict(candidates),
                },
            )
    return issues
