"""Bringing the office's FAQ into the knowledge base.

The source is ``docs/faq/faq-entries.json``, extracted from the office's
FAQ.pdf. Rows from the six category sheets come in first: clean rows are
Published, and damaged rows wait as Needs checking with the PDF's own text
beside them. Rows found only on the "ALL" sheet also wait as Needs checking,
in the category of the row before them on that sheet. Rows on the "ALL" sheet
that repeat a categorised question are skipped.

Running it again adds nothing that is already there, and never overwrites an
entry the office has edited.
"""
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

from django.conf import settings
from django.db import transaction

from .entries import record
from .models import FaqCategory, FaqChange, FaqEntry
from .proofreading import proofread

# The sheet names in the PDF, with their spelling slips fixed, in PDF order.
CATEGORIES = {
    "STUDENT APPLICATION": "Student application",
    "ADMISSION & OFFER LETTER": "Admission and offer letter",
    "COURSE REGISTRATION": "Course registration",
    "DURING SEMESTER": "During the semester",
    "RP - DISSERTATION - THESIS": "Research project, dissertation and thesis",
    "COMPLETION & GRADUATION": "Completion and graduation",
}
ONLY_ON_ALL_SHEET = "Found only on the ALL sheet of the PDF."
ALL_SHEET_POSITION = 1000


class ImportProblem(Exception):
    pass


def default_path():
    return Path(settings.BASE_DIR).parent / "docs" / "faq" / "faq-entries.json"


def same_question_key(text):
    text = unicodedata.normalize("NFKC", text).casefold().replace("’", "'")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _rows(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        rows = data["entries"]
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise ImportProblem(f"Could not read {path}: {exc}") from exc
    unknown = {row["category"] for row in rows if row["sheet"] == "CATEGORIZED"} - set(CATEGORIES)
    if unknown:
        raise ImportProblem(f"Unknown categories in {path}: {', '.join(sorted(unknown))}")
    return rows


@transaction.atomic
def import_faq(path=None, *, actor=None):
    """Import the FAQ file. Returns counts of what happened."""
    rows = _rows(path or default_path())
    categories = {}
    for position, (key, name) in enumerate(CATEGORIES.items(), start=1):
        categories[key], _ = FaqCategory.objects.get_or_create(name=name, defaults={"position": position})
    already = set(FaqEntry.objects.exclude(source_ref=None).values_list("source_ref", flat=True))
    counts = Counter()

    def add(row, category, status, note, position):
        if row["id"] in already:
            counts["alreadyThere"] += 1
            return
        entry = FaqEntry.objects.create(
            question=proofread(row["id"], "question", " ".join(row["question"].split())[:500]),
            answer=proofread(row["id"], "answer", row["answer"].strip()),
            category=categories[category],
            status=status,
            position=position,
            source_ref=row["id"],
            source_text=row["source_text"],
            source_note=note[:255],
            source_page=row.get("source_page"),
        )
        record(entry, actor, FaqChange.Action.IMPORTED, {"status": status, "sheet": row["sheet"], "source": row["id"]})
        already.add(row["id"])
        counts["published" if status == FaqEntry.Status.PUBLISHED else "needsChecking"] += 1

    categorised = [row for row in rows if row["sheet"] == "CATEGORIZED"]
    known = {same_question_key(row["question"]): row for row in categorised}
    for row in categorised:
        status = FaqEntry.Status.NEEDS_CHECKING if row["needs_review"] else FaqEntry.Status.PUBLISHED
        add(row, row["category"], status, row.get("review_note", ""), row["source_number"])

    nearest = next(iter(CATEGORIES))
    for row in sorted((row for row in rows if row["sheet"] == "ALL"), key=lambda row: row["position"]):
        match = known.get(same_question_key(row["question"]))
        if match:
            nearest = match["category"]
            counts["repeatsSkipped"] += 1
            continue
        note = " ".join(filter(None, [ONLY_ON_ALL_SHEET, row.get("review_note", "")]))
        add(row, nearest, FaqEntry.Status.NEEDS_CHECKING, note, ALL_SHEET_POSITION + row["source_number"])
    return dict(counts)
