"""The student details a letter is filled from.

Shared by the student's letter-details endpoint (the live preview) and by
letter generation, so the saved letter carries exactly what the preview showed.
"""
from django.core.exceptions import ObjectDoesNotExist

from accounts.semester_rules import progress_of
from appointments.models import SupervisorAppointment


def current_supervisor_name(student):
    appointment = (
        SupervisorAppointment.objects.filter(
            student=student, status=SupervisorAppointment.Status.ACTIVE
        )
        .select_related("supervisor")
        .first()
    )
    return appointment.supervisor.full_name if appointment else ""


def letter_details(student):
    """The base profile plus the registry fields, keyed like the frontend's
    ``StudentLetterDetails``. Registry fields stay blank until a registry row
    exists."""
    data = {
        "studentName": student.user.full_name,
        "matricNumber": student.matric_no,
        "programName": student.programme,
        "currentStatus": student.status,
        "supervisorName": current_supervisor_name(student),
        "passportNumber": "",
        "country": "",
        "programmeMode": "",
        "fieldOfResearch": "",
        "modeOfStudy": "",
        "initialSemester": student.intake_semester,
        "currentSemester": "",
        "maxSemester": "",
        "expectedCompletion": "",
    }
    try:
        data.update(student.registry.to_letter_dict())
    except ObjectDoesNotExist:
        pass
    progress = progress_of(student)
    if progress.current and not data["currentSemester"]:
        data["currentSemester"] = progress.current.label
    if progress.maximum_semester and not data["maxSemester"]:
        data["maxSemester"] = progress.maximum_semester.label
    if progress.rule and progress.has_record:
        data["minSemestersLeft"] = str(progress.short_of_minimum)
    return data
