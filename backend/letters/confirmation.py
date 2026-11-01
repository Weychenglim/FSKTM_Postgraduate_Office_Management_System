"""Values for letters a student asks for with a recipient, such as the student
confirmation letter: who it is for, how long it is valid, semesters left, and
the Malay wording of the dates and study details on the Malay page.
"""
import calendar
import re
from datetime import datetime

from .recipients import OPTIONAL_TAGS, recipient_block

MALAY_MONTHS = [
    "Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember",
]
PROGRAMMES_MS = {
    "MASTER OF DATA SCIENCE (COURSEWORK)": "SARJANA SAINS DATA (KERJA KURSUS)",
    "MASTER OF CYBER SECURITY (COURSEWORK)": "SARJANA KESELAMATAN SIBER (KERJA KURSUS)",
    "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)": "SARJANA KECERDASAN BUATAN (KERJA KURSUS)",
    "MASTER OF COMPUTER SCIENCE (BY COURSEWORK)": "SARJANA SAINS KOMPUTER (KERJA KURSUS)",
}
MODES_MS = {"full time": "Sepenuh Masa", "full-time": "Sepenuh Masa", "part time": "Separuh Masa", "part-time": "Separuh Masa"}

SESSION_RE = re.compile(r"(\d{4})\s*[/-]\s*(\d{4})")
TERM_RE = re.compile(r"semester\s+(iii|ii|i|[123])\b|-s([123])\b", re.IGNORECASE)
TERMS = {"i": 1, "1": 1, "ii": 2, "2": 2, "iii": 2, "3": 2}
SESSION_WORD_RE = re.compile(r"(\d{4}/\d{4})\s+Session\b", re.IGNORECASE)
# A plain number above this is a year, not a count of semesters.
MAX_COUNT = 30


# Appointment letter dates, stored already worded in English ("08 October 2026").
APPOINTMENT_DATES = ("appointmentDate", "approvedDate", "supervisorAcceptedDate", "panelAcceptedDate", "coSupervisorAcceptedDate")


def english_date(day):
    return day.strftime("%d %B %Y") if day else ""


def malay_date(day):
    return f"{day.day:02d} {MALAY_MONTHS[day.month - 1]} {day.year}" if day else ""


def add_months(day, months):
    month = day.month - 1 + months
    year, month = day.year + month // 12, month % 12 + 1
    return day.replace(year=year, month=month, day=min(day.day, calendar.monthrange(year, month)[1]))


def semester_number(label):
    """Count semesters from a label like "Semester II, 2025/2026 Session"; None if unreadable."""
    session, term = SESSION_RE.search(label or ""), TERM_RE.search(label or "")
    if not session or not term:
        return None
    return int(session.group(1)) * 2 + TERMS[(term.group(1) or term.group(2)).lower()] - 1


def semesters_left(current, target, intake=""):
    """Semesters after the current one until ``target``: a semester label, or a
    plain count of semesters allowed counted from the intake. "" when unknown,
    such as a bare year."""
    now = semester_number(current)
    if now is None:
        return ""
    count = (target or "").strip()
    if count.isdigit():
        start = semester_number(intake)
        if start is None or int(count) > MAX_COUNT:
            return ""
        return str(max(0, int(count) - (now - start + 1)))
    end = semester_number(target)
    return "" if end is None else str(max(0, end - now))


def request_values(values, details):
    """``values`` plus who the letter is for (in English and Malay) and the semesters left."""
    details = details or {}
    current = values.get("currentSemester", "")
    minimum = semesters_left(current, values.get("expectedCompletion", ""), values.get("initialSemester", ""))
    maximum = semesters_left(current, values.get("maxSemester", ""), values.get("initialSemester", ""))
    return {
        **values,
        "recipient": recipient_block(details),
        "recipientMs": recipient_block(details, malay=True),
        "balanceSemestersMin": f"{minimum} SEMESTER(S)" if minimum else "",
        "balanceSemestersMax": f"{maximum} SEMESTER(S)" if maximum else "",
    }


def malay_values(values):
    """The same values with dates, programme, mode of study and semesters in Malay."""
    malay = dict(values)
    if values.get("recipientMs"):
        malay["recipient"] = values["recipientMs"]
    programme = (values.get("programName") or "").strip().upper()
    if programme in PROGRAMMES_MS:
        malay["programName"] = PROGRAMMES_MS[programme]
    mode = (values.get("modeOfStudy") or "").strip()
    if mode.lower() in MODES_MS:
        malay["modeOfStudy"] = MODES_MS[mode.lower()].upper() if mode.isupper() else MODES_MS[mode.lower()]
    for key in ("currentSemester", "initialSemester", "maxSemester", "expectedCompletion"):
        if malay.get(key):
            malay[key] = SESSION_WORD_RE.sub(r"Sesi \1", malay[key])
    for key in ("balanceSemestersMin", "balanceSemestersMax"):
        if malay.get(key):
            malay[key] = malay[key].replace("SEMESTER(S)", "SEMESTER")
    for key in APPOINTMENT_DATES:
        try:
            malay[key] = malay_date(datetime.strptime(malay.get(key) or "", "%d %B %Y").date())
        except ValueError:
            pass
    if values.get("_issuedOn"):
        malay["date"] = malay_date(values["_issuedOn"])
    if values.get("_validUntil"):
        malay["validUntil"] = malay_date(values["_validUntil"]).upper()
    return malay


def malay_typed(typed):
    """What the office typed, with semesters left worded for the Malay page."""
    return {
        name: value.replace("SEMESTER(S)", "SEMESTER") if name.startswith("BALANCE_SEMESTERS") else value
        for name, value in (typed or {}).items()
    }


def drop_unchosen_lines(content, include):
    """Remove the lines of optional details the student did not ask for."""
    unchosen = [f"{{{{{tag}}}}}" for code, tag in OPTIONAL_TAGS.items() if code not in (include or [])]
    if not unchosen:
        return content or ""
    return "\n".join(line for line in (content or "").split("\n") if not any(tag in line for tag in unchosen))
