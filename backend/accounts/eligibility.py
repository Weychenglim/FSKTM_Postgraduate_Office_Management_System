from django.core.exceptions import ObjectDoesNotExist

from .models import Lecturer, Student, User


def student_is_workflow_eligible(student):
    if not student or student.status != Student.Status.ACTIVE:
        return False
    from .semester_rules import active_semester, starts_later

    return not (student.intake_semester and starts_later(student, active_semester()))


def user_is_assignable_lecturer(user):
    if not user or user.role != User.Role.LECTURER or not user.is_active:
        return False
    try:
        lecturer = user.lecturer
    except ObjectDoesNotExist:
        return False
    return lecturer.lifecycle_status == Lecturer.Lifecycle.ACTIVE


def profile_student_is_workflow_eligible(profile):
    if not profile or not profile.student_id:
        return True
    try:
        student = profile.student.student
    except ObjectDoesNotExist:
        return False
    return student_is_workflow_eligible(student)
