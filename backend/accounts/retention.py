"""Who has reached the end of the period their data is kept for.

Only a list for now. Destroying public records needs written consent under the
National Archives Act 2003 (s.25), so nothing is removed until UM confirms its
disposal schedule.
"""
import os

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Student
from .participant_lifecycle import STUDIES_ENDED
from .registry_views import _avatar_bg, _initials, _require_office_admin
from .semester_rules import completion_of, intake_label

ENDED = (Student.Status.GRADUATED, *STUDIES_ENDED)


def retention_years():
    return int(os.environ.get("STUDENT_RETENTION_YEARS", "8"))


def ended_on(student):
    """The Senate date for a graduate, otherwise the day their studies ended."""
    completion = completion_of(student)
    if student.status == Student.Status.GRADUATED and completion and completion.senate_decision_id:
        return completion.senate_decision.decided_on
    return timezone.localdate(student.status_changed_at) if student.status_changed_at else None


def _years_after(day, years):
    try:
        return day.replace(year=day.year + years)
    except ValueError:
        return day.replace(year=day.year + years, day=28)


def due_for_removal(*, today=None, years=None):
    """(students past the period, how many reach it within a year)."""
    today = today or timezone.localdate()
    years = retention_years() if years is None else years
    due, soon = [], 0
    students = Student.objects.filter(status__in=ENDED).select_related("user", "completion__senate_decision").order_by("user__full_name")
    for student in students:
        ended = ended_on(student)
        if ended is None:
            continue
        expires = _years_after(ended, years)
        if expires <= today:
            due.append((student, ended, expires))
        elif expires <= _years_after(today, 1):
            soon += 1
    return due, soon


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def retention_view(request):
    _require_office_admin(request)
    due, soon = due_for_removal()
    return Response({
        "years": retention_years(),
        "soon": soon,
        "due": [
            {
                "matric": student.matric_no,
                "name": student.user.full_name,
                "programme": student.programme,
                "intake": intake_label(student.intake_semester),
                "avatarText": _initials(student.user.full_name),
                "avatarBg": _avatar_bg(student.matric_no),
                "status": student.get_status_display(),
                "endedOn": ended.isoformat(),
                "dueOn": expires.isoformat(),
            }
            for student, ended, expires in due
        ],
    })
