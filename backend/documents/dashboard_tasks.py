"""A student's documents that are due, as dashboard tasks."""
from django.contrib.auth import get_user_model

from accounts.models import Student
from marks.deadlines import mark_deadline_metadata

from .submissions import NOT_SENT, for_student, student_view

User = get_user_model()

STATUS = {"OVERDUE": "overdue", "DUE_TODAY": "deadline", "UPCOMING": "upcoming"}


def _due_line(metadata):
    days = metadata["daysUntilDue"] or 0
    if metadata["deadlineState"] == "OVERDUE":
        return "Overdue today" if days == 0 else f"{abs(days)} day{'s' if abs(days) != 1 else ''} overdue"
    if metadata["deadlineState"] == "DUE_TODAY":
        return "Due today"
    return f"Due in {days} day{'s' if days != 1 else ''}"


def dashboard_tasks(user, now):
    if getattr(user, "role", None) != User.Role.STUDENT:
        return []
    student = user._related_or_none("student")
    if student is None or student.status != Student.Status.ACTIVE:
        return []
    tasks = []
    for submission in for_student(student):
        view = student_view(submission, student, now)
        if view["state"] != NOT_SENT or not view["canSend"]:
            continue
        metadata = mark_deadline_metadata(view["due"], is_submitted=False, now=now)
        tasks.append(
            {
                "id": f"submission_{submission.pk}",
                "name": f"Submit: {submission.title}",
                "status": STATUS.get(metadata["deadlineState"], "pending"),
                "statusText": _due_line(metadata),
                "target": "File Submission",
                "targetModule": "FILES",
                "recordType": "SUBMISSION",
                "recordId": str(submission.pk),
                "semester": submission.academic_semester.label if submission.academic_semester_id else None,
                "semesterCode": submission.academic_semester.code if submission.academic_semester_id else None,
                **metadata,
            }
        )
    return tasks
