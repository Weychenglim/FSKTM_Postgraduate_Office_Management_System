"""The placeholders a letter template may use, and where each value comes from.

Built-in placeholders are filled from the student's record. A template may also
define its own fields that the office types in when it approves a request (for
example attendance, worked out in another system). Each template's fields are
stored on it as ``custom_fields``.

Appointment letters may also use ``APPOINTMENT_PLACEHOLDERS``, filled from the
approved appointment, and letters students ask for may use
``REQUEST_PLACEHOLDERS``, filled from what they entered. Each one works only in
the letter kinds listed for it in ``APPOINTMENT_PURPOSES``.

``PLACEHOLDERS``, ``APPOINTMENT_PLACEHOLDERS`` and ``REQUEST_PLACEHOLDERS`` are
mirrored, in this order, by ``LETTER_PLACEHOLDERS`` and ``APPOINTMENT_PLACEHOLDERS``
in frontend/src/utils/letterDocument.ts; a frontend test fails if they differ.
"""

import re

REQUEST = "REQUEST"
SUPERVISOR_LETTER = "SUPERVISOR_APPOINTMENT"
PANEL_LETTER = "PANEL_APPOINTMENT"
CO_SUPERVISOR_LETTER = "CO_SUPERVISOR_APPOINTMENT"
PURPOSE_LABELS = {
    REQUEST: "student request letters",
    SUPERVISOR_LETTER: "supervisor appointment letters",
    PANEL_LETTER: "panel appointment letters",
    CO_SUPERVISOR_LETTER: "supporting supervisor appointment letters",
}

PLACEHOLDERS = {
    "STUDENT_NAME": ("Student Name", "The student's full name"),
    "STUDENT_ID": ("Matric Number", "The student's matric number"),
    "PROGRAMME_NAME": ("Programme", "The student's programme"),
    "CURRENT_STATUS": ("Current Status", "The student's academic status"),
    "SUPERVISOR_NAME": ("Supervisor", "The student's current primary supervisor"),
    "REFERENCE_NUMBER": ("Reference No.", "Issued when the letter is approved"),
    "CURRENT_DATE": ("Date", "The date the letter is approved"),
    "PASSPORT_NUMBER": ("Passport No.", "Registry passport number, or IC for local students"),
    "COUNTRY": ("Country", "Registry nationality"),
    "PROGRAMME_MODE": ("Programme Mode", "Registry programme mode"),
    "FIELD_OF_RESEARCH": ("Field of Research", "Registry field of study"),
    "MODE_OF_STUDY": ("Mode of Study", "Registry mode of study"),
    "INITIAL_SEMESTER": ("Initial Semester", "The student's intake semester"),
    "CURRENT_SEMESTER": ("Current Semester", "Registry current semester"),
    "MAX_SEMESTER": ("Maximum Semester", "Registry maximum semester"),
    "EXPECTED_COMPLETION": ("Expected Completion", "Registry expected completion"),
}

APPOINTMENT_PLACEHOLDERS = {
    "RESEARCH_TITLE": ("Research Title", "The student's current research title"),
    "RESEARCH_AREA": ("Research Area", "The student's current research area"),
    "COURSE_CODES": ("Course Codes", "Research project course codes from the supervisor application"),
    "SUPERVISOR_DEPARTMENT": ("Supervisor Department", "The supervisor's department"),
    "SUPERVISOR_ACCEPTED_DATE": ("Supervisor Accepted On", "The date the supervisor accepted the request"),
    "PANEL_NAME": ("Panel Member", "The appointed panel member"),
    "PANEL_DEPARTMENT": ("Panel Department", "The panel member's department"),
    "PANEL_ACCEPTED_DATE": ("Panel Accepted On", "The date the panel member accepted"),
    "CO_SUPERVISOR_NAME": ("Supporting Supervisor", "The appointed supporting supervisor"),
    "CO_SUPERVISOR_DEPARTMENT": ("Supporting Supervisor Department", "The supporting supervisor's department"),
    "CO_SUPERVISOR_ACCEPTED_DATE": ("Supporting Supervisor Accepted On", "The date the supporting supervisor accepted"),
    "COORDINATOR_NAME": ("Approved By", "The programme coordinator who approved the appointment"),
    "APPROVED_DATE": ("Approved On", "The date the coordinator approved the appointment"),
    "APPOINTMENT_DATE": ("Appointment Date", "The date the appointment starts"),
    "SEMESTER": ("Semester", "The semester of the appointment"),
}

REQUEST_PLACEHOLDERS = {
    "RECIPIENT": ("Recipient", "Who the letter is for, with the address the student typed"),
    "VALID_UNTIL": ("Valid Until", "The date the letter stops being valid, from the template"),
    "BALANCE_SEMESTERS_MIN": ("Semesters Left (Minimum)", "Semesters until the expected completion, from the registry"),
    "BALANCE_SEMESTERS_MAX": ("Semesters Left (Maximum)", "Semesters until the maximum semester, from the registry"),
}

_APPOINTMENTS = (SUPERVISOR_LETTER, PANEL_LETTER, CO_SUPERVISOR_LETTER)
APPOINTMENT_PURPOSES = {
    "RESEARCH_TITLE": _APPOINTMENTS,
    "RESEARCH_AREA": _APPOINTMENTS,
    "COURSE_CODES": _APPOINTMENTS,
    "SUPERVISOR_DEPARTMENT": _APPOINTMENTS,
    "SUPERVISOR_ACCEPTED_DATE": (SUPERVISOR_LETTER,),
    "PANEL_NAME": (PANEL_LETTER,),
    "PANEL_DEPARTMENT": (PANEL_LETTER,),
    "PANEL_ACCEPTED_DATE": (PANEL_LETTER,),
    "CO_SUPERVISOR_NAME": (CO_SUPERVISOR_LETTER,),
    "CO_SUPERVISOR_DEPARTMENT": (CO_SUPERVISOR_LETTER,),
    "CO_SUPERVISOR_ACCEPTED_DATE": (CO_SUPERVISOR_LETTER,),
    "COORDINATOR_NAME": _APPOINTMENTS,
    "APPROVED_DATE": _APPOINTMENTS,
    "APPOINTMENT_DATE": _APPOINTMENTS,
    "SEMESTER": _APPOINTMENTS,
    "RECIPIENT": (REQUEST,),
    "VALID_UNTIL": (REQUEST,),
    "BALANCE_SEMESTERS_MIN": (REQUEST,),
    "BALANCE_SEMESTERS_MAX": (REQUEST,),
}

ALL_PLACEHOLDERS = {**PLACEHOLDERS, **APPOINTMENT_PLACEHOLDERS, **REQUEST_PLACEHOLDERS}

# The key in ``letters.details.letter_details`` each placeholder is filled from.
VALUE_KEYS = {
    "STUDENT_NAME": "studentName",
    "STUDENT_ID": "matricNumber",
    "PROGRAMME_NAME": "programName",
    "CURRENT_STATUS": "currentStatus",
    "SUPERVISOR_NAME": "supervisorName",
    "REFERENCE_NUMBER": "referenceNumber",
    "CURRENT_DATE": "date",
    "PASSPORT_NUMBER": "passportNumber",
    "COUNTRY": "country",
    "PROGRAMME_MODE": "programmeMode",
    "FIELD_OF_RESEARCH": "fieldOfResearch",
    "MODE_OF_STUDY": "modeOfStudy",
    "INITIAL_SEMESTER": "initialSemester",
    "CURRENT_SEMESTER": "currentSemester",
    "MAX_SEMESTER": "maxSemester",
    "EXPECTED_COMPLETION": "expectedCompletion",
    "RESEARCH_TITLE": "researchTitle",
    "RESEARCH_AREA": "researchArea",
    "COURSE_CODES": "courseCodes",
    "SUPERVISOR_DEPARTMENT": "supervisorDepartment",
    "SUPERVISOR_ACCEPTED_DATE": "supervisorAcceptedDate",
    "PANEL_NAME": "panelName",
    "PANEL_DEPARTMENT": "panelDepartment",
    "PANEL_ACCEPTED_DATE": "panelAcceptedDate",
    "CO_SUPERVISOR_NAME": "coSupervisorName",
    "CO_SUPERVISOR_DEPARTMENT": "coSupervisorDepartment",
    "CO_SUPERVISOR_ACCEPTED_DATE": "coSupervisorAcceptedDate",
    "COORDINATOR_NAME": "coordinatorName",
    "APPROVED_DATE": "approvedDate",
    "APPOINTMENT_DATE": "appointmentDate",
    "SEMESTER": "semester",
    "RECIPIENT": "recipient",
    "VALID_UNTIL": "validUntil",
    "BALANCE_SEMESTERS_MIN": "balanceSemestersMin",
    "BALANCE_SEMESTERS_MAX": "balanceSemestersMax",
}

# Filled by the server when the letter is issued, so never missing.
ISSUED_WITH_LETTER = {"REFERENCE_NUMBER", "CURRENT_DATE", "VALID_UNTIL"}

TOKEN_RE = re.compile(r"\{\{([^{}]*)\}\}")
NAME_RE = re.compile(r"[A-Z_]+")
TRIPLE_RE = re.compile(r"\{\{\{[^{}]*\}\}\}")
STRAY_BRACES_RE = re.compile(r"\{\{[^{}\n]{0,40}|[^{}\n]{0,40}\}\}")
# A tag typed with single braces, e.g. {STUDENT_NAME}, would print literally.
# Ordinary braces in prose ("{text}") are left alone.
SINGLE_TAG_RE = re.compile(r"(?<!\{)\{[A-Z_]+\}(?!\})")

# Office-filled fields: names like the built-in ones, a readable label, and an
# optional hint shown to the office when it fills the value in.
FIELD_NAME_RE = re.compile(r"[A-Z][A-Z_]{1,39}")
MAX_FIELDS = 20
MAX_LABEL_LENGTH = 80
MAX_HINT_LENGTH = 200
MAX_VALUE_LENGTH = 300


def placeholder_catalogue():
    every = (REQUEST, SUPERVISOR_LETTER, PANEL_LETTER, CO_SUPERVISOR_LETTER)
    return [
        {"tag": f"{{{{{name}}}}}", "name": name, "label": label, "source": source,
         "purposes": list(APPOINTMENT_PURPOSES.get(name, every))}
        for name, (label, source) in ALL_PLACEHOLDERS.items()
    ]


def allowed_names(purpose=REQUEST):
    """The built-in placeholder names a template used for ``purpose`` may use."""
    return set(PLACEHOLDERS) | {name for name, purposes in APPOINTMENT_PURPOSES.items() if purpose in purposes}


def purpose_hint(tag):
    """For a tag that only some letter kinds may use, which ones; else None."""
    match = TOKEN_RE.fullmatch(tag)
    purposes = APPOINTMENT_PURPOSES.get(match.group(1)) if match else None
    if not purposes:
        return None
    kinds = "appointment letters" if purposes == _APPOINTMENTS else " and ".join(PURPOSE_LABELS[purpose] for purpose in purposes)
    return f"{tag} works only in {kinds}."


def clean_custom_fields(raw):
    """``(fields, error)`` for a template's office-filled fields.

    Names are upper-cased; each needs a label, and may not repeat or reuse a
    built-in placeholder's name.
    """
    if raw is None or raw == "":
        return [], None
    if not isinstance(raw, list):
        return None, "Office-filled fields must be a list."
    if len(raw) > MAX_FIELDS:
        return None, f"A template can have at most {MAX_FIELDS} office-filled fields."
    fields, seen = [], set()
    for item in raw:
        if not isinstance(item, dict):
            return None, "Each office-filled field needs a name and a label."
        name = str(item.get("name") or "").strip().upper()
        label = str(item.get("label") or "").strip()
        hint = str(item.get("hint") or "").strip()
        if not FIELD_NAME_RE.fullmatch(name):
            return None, (
                f"Field name {name or '(blank)'} must be 2 to 40 capital letters or underscores, "
                "for example ATTENDANCE."
            )
        if name in ALL_PLACEHOLDERS:
            return None, f"{{{{{name}}}}} is already a built-in placeholder; choose another name."
        if name in seen:
            return None, f"The field {{{{{name}}}}} is listed twice."
        if not label:
            return None, f"Give the field {{{{{name}}}}} a label."
        if len(label) > MAX_LABEL_LENGTH:
            return None, f"Keep the label of {{{{{name}}}}} under {MAX_LABEL_LENGTH} characters."
        if len(hint) > MAX_HINT_LENGTH:
            return None, f"Keep the hint of {{{{{name}}}}} under {MAX_HINT_LENGTH} characters."
        seen.add(name)
        fields.append({"name": name, "label": label, "hint": hint})
    return fields, None


def field_names(custom_fields):
    return {field["name"] for field in custom_fields or []}


def placeholder_problems(content, custom_fields=(), purpose=REQUEST):
    """Return ``(unknown, malformed)`` tags found in ``content``, each de-duplicated.

    The template's own office-filled fields count as known tags, and so do the
    appointment placeholders its ``purpose`` allows.
    """
    content = content or ""
    known = allowed_names(purpose) | field_names(custom_fields)
    unknown, malformed = [], []
    malformed += TRIPLE_RE.findall(content)
    rest = TRIPLE_RE.sub(" ", content)
    for match in TOKEN_RE.finditer(rest):
        token, name = match.group(0), match.group(1)
        if not NAME_RE.fullmatch(name):
            malformed.append(token)
        elif name not in known:
            unknown.append(token)
    rest = TOKEN_RE.sub(" ", rest)
    malformed += SINGLE_TAG_RE.findall(rest)
    malformed += [stray.strip() for stray in STRAY_BRACES_RE.findall(SINGLE_TAG_RE.sub(" ", rest))]
    return list(dict.fromkeys(unknown)), list(dict.fromkeys(malformed))


def _value(values, name):
    return str(values.get(VALUE_KEYS[name]) or "").strip()


def used_names(content):
    """The placeholder names ``content`` uses, in the order they first appear."""
    return list(dict.fromkeys(match.group(1) for match in TOKEN_RE.finditer(content or "")))


def missing_labels(content, values):
    """Labels of the built-in placeholders ``content`` uses that ``values`` leaves blank."""
    used = [name for name in used_names(content) if name in ALL_PLACEHOLDERS and name not in ISSUED_WITH_LETTER]
    return [ALL_PLACEHOLDERS[name][0] for name in used if not _value(values, name)]


def letter_fields(content, values, custom_fields=(), student=None):
    """Every value a letter needs, in the order its tags first appear.

    Record fields that have a value are shown as they are. A record field the
    student's record leaves blank, and every office-filled field, is ``needed``:
    the office types it in before approving. ``student`` maps the tags of the
    letter's questions to ``{"label", "value"}``, what the student answered.
    """
    own = {field["name"]: field for field in custom_fields or []}
    student = student or {}
    fields = []
    for name in used_names(content):
        if name in ISSUED_WITH_LETTER:
            continue
        if name in student:
            answer = student[name]
            fields.append(
                {"name": name, "label": answer["label"], "hint": "The student's answer", "source": "student", "value": answer["value"], "needed": False}
            )
            continue
        if name in ALL_PLACEHOLDERS:
            label, source = ALL_PLACEHOLDERS[name]
            value = _value(values, name)
            fields.append(
                {"name": name, "label": label, "hint": source, "source": "record", "value": value, "needed": not value}
            )
        elif name in own:
            field = own[name]
            fields.append(
                {"name": name, "label": field["label"], "hint": field.get("hint", ""), "source": "office", "value": "", "needed": True}
            )
    return fields


def value_problem(value):
    """Why a typed value cannot go on a letter, or None."""
    if not value:
        return "Fill this in before approving."
    if "\n" in value or "\r" in value:
        return "Keep it on one line."
    if len(value) > MAX_VALUE_LENGTH:
        return f"Keep it under {MAX_VALUE_LENGTH} characters."
    return None


def fill_placeholders(content, values, typed=None):
    """Replace every ``{{TAG}}`` in ``content``.

    Built-in placeholders come from ``values`` (keyed like ``letter_details``);
    ``typed`` holds what the office entered, by placeholder name, and wins.
    """
    typed = typed or {}

    def replace(match):
        name = match.group(1)
        if name in typed:
            return str(typed[name])
        if name in ALL_PLACEHOLDERS:
            return _value(values, name)
        return match.group(0)

    return TOKEN_RE.sub(replace, content or "")
