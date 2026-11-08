"""Semester labels as the office writes them, and counting through them.

Labels reach the portal from spreadsheets and typing ("Semester I, 2026/2027
Session", "2026/2027 Semester 1"), so anything that compares or counts semesters
reads them here. A session runs Semester I, Semester II, then the optional
Special Semester.
"""
import re
from dataclasses import dataclass

SEMESTER_I, SEMESTER_II, SPECIAL = "SEMESTER_I", "SEMESTER_II", "SPECIAL"
TERM_NAMES = {SEMESTER_I: "Semester I", SEMESTER_II: "Semester II", SPECIAL: "Special Semester"}
_ORDER = {SEMESTER_I: 0, SEMESTER_II: 1, SPECIAL: 2}
_NUMBERED = {"i": SEMESTER_I, "1": SEMESTER_I, "ii": SEMESTER_II, "2": SEMESTER_II, "iii": SPECIAL, "3": SPECIAL}

_SESSION = re.compile(r"(\d{4})\s*[/-]\s*(\d{4})")
_SPECIAL = re.compile(r"\b(?:special|khas|short)\b|-sp\b", re.IGNORECASE)
_TERM = re.compile(r"\bsem(?:ester)?\s*(iii|ii|i|[123])\b|-s([123])\b", re.IGNORECASE)
# A record built from a typing slip should not fill a student's history with rows.
MAX_SEEDED_ROWS = 40


@dataclass(frozen=True)
class Semester:
    year: int
    term: str

    @property
    def session(self):
        return f"{self.year}/{self.year + 1}"

    @property
    def label(self):
        return f"{TERM_NAMES[self.term]}, {self.session} Session"

    @property
    def key(self):
        return (self.year, _ORDER[self.term])

    @property
    def is_special(self):
        return self.term == SPECIAL

    def next_normal(self):
        if self.term == SEMESTER_I:
            return Semester(self.year, SEMESTER_II)
        return Semester(self.year + 1, SEMESTER_I)


def read(label):
    """The semester a label names, or None when it cannot be read."""
    text = label or ""
    session = _SESSION.search(text)
    if not session or int(session.group(2)) != int(session.group(1)) + 1:
        return None
    if _SPECIAL.search(text):
        return Semester(int(session.group(1)), SPECIAL)
    term = _TERM.search(text)
    if not term:
        return None
    return Semester(int(session.group(1)), _NUMBERED[(term.group(1) or term.group(2)).lower()])


def from_parts(session, term):
    """A semester from a stored session and term, or None when they are not valid."""
    match = _SESSION.fullmatch((session or "").strip())
    if not match or term not in _ORDER or int(match.group(2)) != int(match.group(1)) + 1:
        return None
    return Semester(int(match.group(1)), term)


def nth_normal(start, count):
    """The normal semester ``count`` semesters into a programme that began at ``start``."""
    current = start.next_normal() if start.is_special else start
    for _ in range(max(count, 1) - 1):
        current = current.next_normal()
    return current


def steps_to(now, target):
    """Semesters after ``now`` up to and including ``target``. A Special Semester
    only counts when it is the target, because taking one is optional."""
    if target.key <= now.key:
        return 0
    steps = 0
    current = now.next_normal()
    while current.key <= target.key:
        steps += 1
        current = current.next_normal()
    return steps + (1 if target.is_special else 0)


def seeded_semesters(intake, current):
    """The semesters a record implies: every normal semester from the intake to the
    current one. Past Special Semesters are not implied, so the office adds them."""
    first, last = read(intake), read(current)
    if first is None:
        return [last] if last else []
    if last is None or last.key < first.key:
        return [first]
    rows = [first]
    step = first.next_normal()
    while step.key <= last.key and len(rows) < MAX_SEEDED_ROWS:
        rows.append(step)
        step = step.next_normal()
    if last.is_special and last != rows[-1] and len(rows) < MAX_SEEDED_ROWS:
        rows.append(last)
    return rows
