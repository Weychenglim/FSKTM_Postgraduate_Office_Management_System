"""Correcting a programme entered by mistake, for a student with a research profile.

UM does not allow a change of programme (Master's Regulations 2024, regulation 16),
so this is only for mistakes. The research profile keeps its own copy of the programme,
so the two change together, and the profile's history records who, when, why and the
old value.
"""
from appointments import research_amendments as research


class ProgrammeCorrectionConflict(Exception):
    pass


def correct_programme(student, programme, *, actor, reason):
    """Correct the research profile. Call inside a transaction; the caller saves the student."""
    _, profile = research._lock_student(student.pk)
    try:
        research._no_pending(student.pk)
    except research.AmendmentConflict as exc:
        raise ProgrammeCorrectionConflict(
            "A research change or programme transfer is waiting for a decision. Finish it first."
        ) from exc
    try:
        research._no_nominations(student.pk)
    except research.AmendmentConflict as exc:
        raise ProgrammeCorrectionConflict(
            "A supervisor, co-supervisor or panel nomination is waiting for a decision. "
            "Finish it in Supervisor Appointments first."
        ) from exc
    research._apply(student, profile, {**research.snapshot(profile), "programme": programme}, actor, "CORRECTION", reason)
