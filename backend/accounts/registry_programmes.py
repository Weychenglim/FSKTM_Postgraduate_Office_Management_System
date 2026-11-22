"""Programme names in the office's own spreadsheets (UC04).

An extract may write one programme several ways ("Master of Data Science",
"MDS", "Sarjana Sains Data") or list students of other programmes, such as
PhD. Each distinct name is shown once: the office maps it to an approved
programme or skips its rows, and the choice is remembered for the next import.
Nothing is mapped without the office choosing it.
"""

import re

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import RegistryProgrammeAlias
from .programmes import APPROVED_PROGRAMMES, normalise_programme

# The value the browser sends for "Skip these rows". Stored as a blank programme.
SKIP_PROGRAMME = "__skip__"
MAX_PROGRAMME_KEY_LENGTH = 255
# More distinct names than this usually means the wrong column is matched.
MAX_PROGRAMME_VALUES = 100

_PUNCTUATION = re.compile(r"[^\w\s]")
_COURSEWORK = re.compile(r"\b(?:(?:by )?coursework|(?:secara )?kerja kursus)\b")


def _words(value):
    return " ".join(_PUNCTUATION.sub(" ", (value or "").casefold()).split())


def programme_key(value):
    """A programme name compared without letter case, punctuation or spaces,
    so "M.D.S" and "MDS" are one name."""
    return _words(value).replace(" ", "")


def _core(value):
    """The key without "coursework" or "by coursework"."""
    return _COURSEWORK.sub(" ", _words(value)).replace(" ", "")


MALAY_NAMES = {
    "Sarjana Sains Data": "MASTER OF DATA SCIENCE (COURSEWORK)",
    "Sarjana Keselamatan Siber": "MASTER OF CYBER SECURITY (COURSEWORK)",
    "Sarjana Kecerdasan Buatan": "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
}


def similar_programme(value):
    """The one approved programme this name differs from only in letter case,
    punctuation, spacing, "(Coursework)" or its official Malay name, else None."""
    matches = [programme for programme in APPROVED_PROGRAMMES if _core(programme) == _core(value)]
    if len(matches) == 1:
        return matches[0]
    malay = {_core(name): programme for name, programme in MALAY_NAMES.items()}
    return malay.get(_core(value))


def saved_choices():
    """The office's remembered choices: {name key: approved programme, or "" to skip}.
    A choice of a programme that is no longer approved is left out."""
    choices = {}
    for alias in RegistryProgrammeAlias.objects.all():
        approved = normalise_programme(alias.programme)
        if approved or not alias.programme:
            choices[alias.value_key] = approved or ""
    return choices


def parse_programme_map(raw, errors):
    """Read ``options.programmeMap``: {name in the file: approved programme or
    "__skip__"}. Returns {name key: approved programme, or "" to skip}."""
    if raw is None:
        return {}
    if (
        not isinstance(raw, dict)
        or len(raw) > MAX_PROGRAMME_VALUES
        or any(not isinstance(name, str) or not isinstance(target, str) for name, target in raw.items())
        or any(len(programme_key(name)) > MAX_PROGRAMME_KEY_LENGTH for name in raw)
    ):
        errors["programmeMap"] = ["The programme choices could not be read."]
        return {}
    choices, problems = {}, []
    for name, target in raw.items():
        key = programme_key(name)
        approved = normalise_programme(target)
        if not key:
            continue
        if target == SKIP_PROGRAMME or approved:
            choices[key] = approved or ""
        else:
            problems.append(f'"{target}" is not an approved programme.')
    if problems:
        errors["programmeMap"] = list(dict.fromkeys(problems))
    return choices


def programme_values(rows):
    """Each distinct programme name in the rows that is not an approved
    programme, in file order, with how many rows use it and a suggestion: the
    office's saved choice, else a similar approved name. Returns the first
    ``MAX_PROGRAMME_VALUES`` and the number of distinct names."""
    found = {}
    for _, cells in rows:
        value = cells["programme"]
        if not value or normalise_programme(value):
            continue
        key = programme_key(value)
        if not key or len(key) > MAX_PROGRAMME_KEY_LENGTH:
            continue
        found.setdefault(key, {"key": key, "value": value, "rows": 0})["rows"] += 1
    listed = list(found.values())[:MAX_PROGRAMME_VALUES]
    saved = saved_choices() if listed else {}
    for entry in listed:
        if entry["key"] in saved:
            entry["suggestion"] = saved[entry["key"]] or SKIP_PROGRAMME
            entry["source"] = "saved"
        else:
            entry["suggestion"] = similar_programme(entry["value"])
            entry["source"] = "similar" if entry["suggestion"] else None
    return listed, len(found)


def remember_choices(rows, choices, user):
    """Save the office's choice for each programme name in this file, so the
    next import suggests it. Called on a real import only, never a preview."""
    in_file = {programme_key(cells["programme"]) for _, cells in rows if cells["programme"]}
    for key, programme in choices.items():
        if key not in in_file:
            continue
        try:
            with transaction.atomic():
                RegistryProgrammeAlias.objects.update_or_create(
                    value_key=key, defaults={"programme": programme, "updated_by": user}
                )
        except IntegrityError:
            # Another import saved this name at the same moment.
            RegistryProgrammeAlias.objects.filter(value_key=key).update(
                programme=programme, updated_by=user, updated_at=timezone.now()
            )
