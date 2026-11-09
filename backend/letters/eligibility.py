"""Who may generate letters.

A letter states the student's current enrolment, so only students whose
academic status is Active may generate one. Deferred, withdrawn and graduated
students are refused and pointed to the PG Office instead.
"""

INACTIVE_STUDENT_CODE = "letters_need_active_status"


def inactive_student_refusal(user):
    """The 403 body for a student who may not generate letters, or None."""
    student = user._related_or_none("student")
    if student is None:
        return None
    if student.status == student.Status.ACTIVE:
        from accounts.semester_rules import enrolment_problem

        problem = enrolment_problem(student)
        return {"detail": problem, "code": INACTIVE_STUDENT_CODE} if problem else None
    return {
        "detail": (
            "Letters can only be generated while your status is Active. "
            f"Your status is {student.get_status_display()}; please contact the PG Office if you need a letter."
        ),
        "code": INACTIVE_STUDENT_CODE,
    }
