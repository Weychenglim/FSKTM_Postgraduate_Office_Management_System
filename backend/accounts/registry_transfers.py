"""Programme transfers as Student Registry shows them.

The transfer workflow (requests, the two coordinator decisions and the final
change of programme) lives in ``appointments.research_amendments``. This module
only reads it, to tell the office whether a transfer can start and who decides.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.services import current_effective_semester
from appointments import research_amendments as transfers
from appointments.models import ResearchAmendment, StudentResearchProfile
from marks.models import EvaluationTask

from .authorization import programme_coordinators
from .models import Student, User
from .programmes import APPROVED_PROGRAMMES
from .registry_views import _find_student, _require_registry_reader


def coordinator_names(programme):
    if not str(programme or "").strip():
        return []
    return sorted({user.full_name for user in programme_coordinators(programme)}, key=str.casefold)


def same_programme(first, second):
    return str(first or "").strip().casefold() == str(second or "").strip().casefold()


def _pending(student):
    row = ResearchAmendment.objects.filter(
        student_id=student.pk, kind="TRANSFER", status__in=ResearchAmendment.PENDING_STATUSES,
    ).first()
    if row is None:
        return None
    waiting_on_new = row.status == "PENDING_DESTINATION_COORDINATOR"
    return {
        "id": row.pk,
        "status": row.status,
        "destination": row.destination_programme,
        "stage": "new" if waiting_on_new else "current",
        "waitingFor": coordinator_names(row.destination_programme if waiting_on_new else row.source_programme),
    }


def _blockers(student, profile):
    """Plain reasons a transfer cannot start, following the workflow's own rules."""
    found = []
    if student.status != Student.Status.ACTIVE or not student.user.is_active:
        found.append("The student must be Active, with sign-in allowed.")
    if ResearchAmendment.objects.filter(
        student_id=student.pk, kind="RESEARCH", status__in=ResearchAmendment.PENDING_STATUSES,
    ).exists():
        found.append("A research title or abstract change is waiting for a decision. It must be finished first.")
    if not same_programme(student.programme, profile.programme):
        found.append(
            f"The research profile says {profile.programme or 'no programme'} but the record says "
            f"{student.programme or 'no programme'}. Ask the technical administrator to correct it first."
        )
    try:
        transfers._no_nominations(student.pk)
    except transfers.AmendmentConflict:
        found.append(
            "A supervisor, co-supervisor or panel nomination is waiting for a decision. "
            "Finish it in Supervisor Appointments first."
        )
    if current_effective_semester() is None:
        found.append("There is no active semester. Set one in Academic Semesters first.")
    return found


def _team(student):
    team = transfers.team_snapshot(student.pk)
    return {
        "primary": team["primary"]["name"] if team["primary"] else "",
        "coSupervisors": [member["name"] for member in team["coSupervisors"]],
        "panel": [member["name"] for member in team["panel"]],
    }


def _unfinished_tasks(profile):
    return EvaluationTask.objects.filter(
        profile_id=profile.pk, lifecycle_status__in=["ACTIVE", "PAUSED"],
    ).exclude(mark_entry__status="SUBMITTED").count()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_transfer_view(request, matric_no):
    """Whether the office can move this student to another programme, and any transfer in progress."""
    student, error = _find_student(matric_no, _require_registry_reader(request))
    if error:
        return error
    profile = StudentResearchProfile.objects.filter(student_id=student.pk).first()
    payload = {
        "studentId": student.pk,
        "matric": student.matric_no,
        "name": student.user.full_name,
        "programme": student.programme,
        "hasResearchProfile": profile is not None,
        "pending": _pending(student),
        "canRequest": False,
    }
    if request.user.role != User.Role.OFFICE_ADMIN or profile is None:
        return Response(payload)
    blockers = _blockers(student, profile)
    payload.update(
        canRequest=not blockers and payload["pending"] is None,
        blockers=blockers,
        currentCoordinators=coordinator_names(student.programme),
        destinations=[
            {"programme": programme, "coordinators": coordinator_names(programme)}
            for programme in transfers.programme_options()
            if not same_programme(programme, student.programme)
        ],
        team=_team(student),
        unfinishedTasks=_unfinished_tasks(profile),
    )
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def programme_coordinators_view(request):
    """Who coordinates each programme today, regular or acting, for the transfer screens."""
    user = request.user
    if not user.is_active or user.role not in (User.Role.OFFICE_ADMIN, User.Role.COORDINATOR):
        return Response(
            {"error": "Only the PG office and programme coordinators follow programme transfers."},
            status=status.HTTP_403_FORBIDDEN,
        )
    programmes = {}
    for programme in [*APPROVED_PROGRAMMES, *transfers.programme_options()]:
        programmes.setdefault(programme.strip().casefold(), programme.strip())
    return Response({
        "programmes": [
            {"programme": programme, "coordinators": coordinator_names(programme)}
            for programme in sorted(programmes.values(), key=str.casefold)
        ],
    })
