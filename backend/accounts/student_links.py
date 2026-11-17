"""What a student record links to (FR-12, UC05): supervisor, panel, marks,
files, letters and announcements. Marks and letters are for the office only."""
from django.utils.timezone import localtime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from announcements.models import Notification
from appointments.models import PanelAppointment, SupervisorAppointment
from documents.access import visible_documents
from letters.models import GeneratedLetter
from marks.models import EvaluationTask, MarkEntry

from .models import User
from .registry_views import _find_student, _require_registry_reader

LATEST = 5


def _date(moment):
    return localtime(moment).date().isoformat() if moment else None


def _supervisors(student):
    rows = SupervisorAppointment.objects.filter(student=student, status=SupervisorAppointment.Status.ACTIVE).select_related("supervisor")
    return [{"name": row.supervisor.full_name, "since": row.appointment_date.isoformat()} for row in rows]


def _panel(profile):
    if profile is None:
        return []
    rows = PanelAppointment.objects.filter(profile=profile, status=PanelAppointment.Status.ACTIVE).select_related("panel_member")
    return [{"name": row.panel_member.full_name, "since": row.appointment_date.isoformat()} for row in rows]


def _marks(profile):
    if profile is None:
        return []
    tasks = (
        EvaluationTask.objects.filter(profile=profile)
        .exclude(lifecycle_status=EvaluationTask.Lifecycle.RETIRED)
        .select_related("period", "evaluator")
        .order_by("period__name", "evaluator_role", "pk")
    )
    entries = {entry.task_id: entry for entry in MarkEntry.objects.filter(task__in=tasks)}
    rows = []
    for task in tasks:
        entry = entries.get(task.pk)
        rows.append({
            "period": task.period.name,
            "evaluator": task.evaluator.full_name,
            "role": task.get_evaluator_role_display(),
            "status": entry.get_status_display() if entry else MarkEntry.Status.NOT_STARTED.label,
        })
    return rows


def _letters(student):
    letters = GeneratedLetter.objects.filter(student=student).order_by("-created_at", "-pk")
    return {
        "total": letters.count(),
        "latest": [
            {
                "id": letter.pk,
                "name": letter.template_name,
                "reference": letter.reference_number or "",
                "status": letter.status,
                "date": _date(letter.decided_at or letter.created_at),
            }
            for letter in letters[:LATEST]
        ],
    }


def _announcements(student):
    received = Notification.objects.filter(recipient=student.user, is_announcement=True).order_by("-created_at", "-pk")
    return {
        "total": received.count(),
        "latest": [{"title": row.title, "date": _date(row.created_at)} for row in received[:LATEST]],
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_links_view(request, matric_no):
    student, error = _find_student(matric_no, _require_registry_reader(request))
    if error:
        return error
    profile = student.user._related_or_none("research_profile")
    office = request.user.role == User.Role.OFFICE_ADMIN
    return Response({
        "supervisors": _supervisors(student),
        "panel": _panel(profile),
        "files": visible_documents(request.user).filter(students=student, archived_at__isnull=True).distinct().count(),
        "announcements": _announcements(student),
        "marks": _marks(profile) if office else None,
        "letters": _letters(student) if office else None,
    })
