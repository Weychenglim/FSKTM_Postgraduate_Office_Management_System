"""Who may ask for letters.

Each letter type says who it is for (``LetterTemplate.audience``):

- current students: status Active and enrolled this semester;
- students who have finished their studies: marked Finished studies, or Graduated;
- international students: current students who are not Malaysian.

A student who cannot ask for any Active letter type is refused the whole module
and pointed to the PG Office.
"""
from .models import LetterAudience, LetterPurpose, LetterTemplate

INACTIVE_STUDENT_CODE = "letters_need_active_status"
NOT_FOR_STUDENT_CODE = "letter_not_for_this_student"

_MALAYSIAN = {"malaysia", "malaysian", "warganegara", "warganegara malaysia"}


def _current_problem(student):
    """Why this student does not count as a current student, in words for the student, or None."""
    if student.status == student.Status.ACTIVE:
        from accounts.semester_rules import enrolment_problem

        return enrolment_problem(student)
    return (
        "Letters can only be generated while your status is Active. "
        f"Your status is {student.get_status_display()}; please contact the PG Office if you need a letter."
    )


def has_finished(student):
    """Marked Finished studies by the office, or already Graduated."""
    if student.status == student.Status.GRADUATED:
        return True
    return student.status == student.Status.ACTIVE and hasattr(student, "completion")


def is_malaysian(student):
    """True only when the record says so; a record with no nationality is not held back."""
    registry = getattr(student, "registry", None)
    if registry is None:
        return False
    nationality = (registry.nationality or "").strip().lower()
    if nationality:
        return nationality in _MALAYSIAN
    return bool(registry.ic_number) and not registry.passport_number


def template_problem(student, template):
    """Why this student cannot ask for this letter type, in words for the student, or None."""
    if template.audience == LetterAudience.FINISHED:
        return None if has_finished(student) else "This letter is for students who have finished their studies."
    problem = _current_problem(student)
    if problem:
        return problem
    if template.audience == LetterAudience.INTERNATIONAL and is_malaysian(student):
        return "This letter is for international students."
    return None


def template_refusal(user, template):
    """The 403 body when this student cannot ask for this letter type, or None."""
    student = user._related_or_none("student")
    if student is None:
        return None
    problem = template_problem(student, template)
    return {"detail": problem, "code": NOT_FOR_STUDENT_CODE} if problem else None


def open_templates(student, queryset=None):
    """The Active letter types this student can ask for."""
    if queryset is None:
        queryset = LetterTemplate.objects.all()
    queryset = queryset.filter(status=LetterTemplate.Status.ACTIVE, purpose=LetterPurpose.REQUEST)
    return [template for template in queryset if template_problem(student, template) is None]


def inactive_student_refusal(user):
    """The 403 body for a student who may not use Letter Generation at all, or None."""
    student = user._related_or_none("student")
    if student is None:
        return None
    problem = _current_problem(student)
    if problem is None:
        return None
    if has_finished(student) and LetterTemplate.objects.filter(
        status=LetterTemplate.Status.ACTIVE, purpose=LetterPurpose.REQUEST, audience=LetterAudience.FINISHED
    ).exists():
        return None
    return {"detail": problem, "code": INACTIVE_STUDENT_CODE}
