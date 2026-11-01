"""Looking after the FAQ entries (UC29): create, edit, publish, check,
archive, restore and delete, each kept in the history."""
import re

from django.db import transaction
from django.utils import timezone

from .models import FaqAltQuestion, FaqCategory, FaqChange, FaqEntry

Status = FaqEntry.Status
Action = FaqChange.Action

MAX_ANSWER = 5000
MAX_ALT_QUESTIONS = 20
HISTORY_LIMIT = 50

# [text](address) links in an answer. Only web, email and portal addresses
# are allowed, so an answer can never carry a script link.
MARKDOWN_LINK = re.compile(r"\[[^\]]*\]\(([^)\s]*)\)")
SAFE_LINK = re.compile(r"^(https?://|mailto:|/(?!/))", re.IGNORECASE)

FIELD_WORDS = {
    "question": "question",
    "answer": "answer",
    "category": "category",
    "portal_link": "portal button",
    "alt_questions": "other ways students ask",
}


class FaqRefused(Exception):
    def __init__(self, errors, status=400):
        super().__init__(next(iter(errors.values())))
        self.errors = errors
        self.status = status


def record(entry, actor, action, details=None, question=None):
    return FaqChange.objects.create(
        entry=entry,
        question=entry.question if question is None else question,
        action=action,
        actor=actor,
        actor_name=actor.full_name if actor else "",
        details=details or {},
    )


def answer_problem(answer):
    if len(answer) > MAX_ANSWER:
        return f"Keep the answer under {MAX_ANSWER} characters."
    for address in MARKDOWN_LINK.findall(answer):
        if not SAFE_LINK.match(address):
            return f"The link \"{address}\" can't be used. Links must start with https://, http://, mailto: or /."
    return None


def clean_alt_questions(values, question=""):
    """Trimmed, without repeats or the main question itself."""
    seen = {question.strip().casefold()}
    cleaned = []
    for value in values:
        text = " ".join(str(value).split())
        if text and text.casefold() not in seen:
            seen.add(text.casefold())
            cleaned.append(text[:500])
    if len(cleaned) > MAX_ALT_QUESTIONS:
        raise FaqRefused({"altQuestions": f"Keep it to {MAX_ALT_QUESTIONS} other ways of asking."})
    return cleaned


def publish_problems(entry):
    problems = {}
    if not entry.question.strip():
        problems["question"] = "Write the question before publishing."
    if not entry.answer.strip():
        problems["answer"] = "Write the answer before publishing."
    return problems


def history_dict(change):
    return {
        "id": change.pk,
        "action": change.action,
        "actor": change.actor_name,
        "at": change.created_at.isoformat(),
        "details": change.details,
    }


def usage(entry):
    """How often students got this answer this month, and how often it didn't help."""
    if hasattr(entry, "asked_this_month"):
        return entry.asked_this_month, entry.not_helpful_this_month
    from .questions import month_start

    asked = entry.asked.filter(asked_at__gte=month_start())
    return asked.count(), asked.filter(helpful=False).count()


def entry_dict(entry, detail=False):
    asked, not_helpful = usage(entry)
    data = {
        "id": str(entry.pk),
        "question": entry.question,
        "answer": entry.answer,
        "category": {"id": str(entry.category_id), "name": entry.category.name},
        "status": entry.status,
        "portalLink": entry.portal_link,
        "imported": bool(entry.source_ref),
        "note": entry.source_note if entry.status == Status.NEEDS_CHECKING else "",
        "altCount": entry.alt_count if hasattr(entry, "alt_count") else entry.alt_questions.count(),
        "askedThisMonth": asked,
        "notHelpfulThisMonth": not_helpful,
        "updatedAt": entry.updated_at.isoformat(),
        "updatedBy": entry.updated_by.full_name if entry.updated_by else "",
    }
    if detail:
        data.update(
            {
                "altQuestions": [alt.text for alt in entry.alt_questions.all()],
                "source": (
                    {
                        "text": entry.source_text,
                        "note": entry.source_note,
                        "page": entry.source_page,
                    }
                    if entry.source_ref
                    else None
                ),
                "checkedBy": entry.checked_by.full_name if entry.checked_by else "",
                "checkedAt": entry.checked_at.isoformat() if entry.checked_at else None,
                "history": [history_dict(change) for change in entry.changes.all()[:HISTORY_LIMIT]],
            }
        )
    return data


def _category(category_id):
    category = FaqCategory.objects.filter(pk=category_id).first() if str(category_id).isdigit() else None
    if category is None:
        raise FaqRefused({"category": "Choose a category."})
    return category


def _apply(entry, data, actor):
    """Copy the office's fields onto ``entry``; returns what changed."""
    changed = []
    if "question" in data:
        question = " ".join(data["question"].split())
        if question != entry.question:
            entry.question = question
            changed.append("question")
    if "answer" in data:
        answer = data["answer"].strip()
        problem = answer_problem(answer)
        if problem:
            raise FaqRefused({"answer": problem})
        if answer != entry.answer:
            entry.answer = answer
            changed.append("answer")
    if "category" in data:
        category = _category(data["category"])
        if category.pk != entry.category_id:
            entry.category = category
            changed.append("category")
    if "portalLink" in data and data["portalLink"] != entry.portal_link:
        entry.portal_link = data["portalLink"]
        changed.append("portal_link")
    entry.updated_by = actor
    return changed


def _set_alt_questions(entry, values, actor):
    wanted = clean_alt_questions(values, entry.question)
    current = list(entry.alt_questions.all())
    if [alt.text for alt in current] == wanted:
        return False
    keep = {text.casefold() for text in wanted}
    entry.alt_questions.exclude(pk__in=[alt.pk for alt in current if alt.text.casefold() in keep]).delete()
    have = {alt.text.casefold() for alt in current if alt.text.casefold() in keep}
    FaqAltQuestion.objects.bulk_create(
        FaqAltQuestion(entry=entry, text=text, created_by=actor) for text in wanted if text.casefold() not in have
    )
    return True


@transaction.atomic
def create_entry(*, actor, data, publish=False):
    if "category" not in data:
        raise FaqRefused({"category": "Choose a category."})
    entry = FaqEntry(category=_category(data["category"]), status=Status.DRAFT)
    _apply(entry, data, actor)
    if publish:
        problems = publish_problems(entry)
        if problems:
            raise FaqRefused(problems)
        entry.status = Status.PUBLISHED
    last = FaqEntry.objects.filter(category=entry.category).order_by("-position").values_list("position", flat=True).first()
    entry.position = (last or 0) + 1
    entry.save()
    if "altQuestions" in data:
        _set_alt_questions(entry, data["altQuestions"], actor)
    record(entry, actor, Action.CREATED, {"status": entry.status})
    return entry


def _locked(entry_id):
    entry = FaqEntry.objects.select_for_update().filter(pk=entry_id).first() if str(entry_id).isdigit() else None
    if entry is None:
        raise FaqRefused({"error": "No such entry."}, status=404)
    return entry


@transaction.atomic
def edit_entry(*, actor, entry_id, data):
    entry = _locked(entry_id)
    changed = _apply(entry, data, actor)
    if entry.status == Status.PUBLISHED:
        problems = publish_problems(entry)
        if problems:
            raise FaqRefused(problems)
    if "altQuestions" in data and _set_alt_questions(entry, data["altQuestions"], actor):
        changed.append("alt_questions")
    if changed:
        entry.save()
        record(entry, actor, Action.EDITED, {"fields": [FIELD_WORDS[name] for name in changed]})
    return entry


TRANSITIONS = {
    "publish": ({Status.DRAFT, Status.NEEDS_CHECKING, Status.ARCHIVED}, Status.PUBLISHED, Action.PUBLISHED),
    "checked": ({Status.NEEDS_CHECKING}, Status.DRAFT, Action.CHECKED),
    "archive": ({Status.PUBLISHED, Status.DRAFT, Status.NEEDS_CHECKING}, Status.ARCHIVED, Action.ARCHIVED),
    "restore": ({Status.ARCHIVED}, Status.DRAFT, Action.RESTORED),
}


@transaction.atomic
def change_status(*, actor, entry_id, step):
    entry = _locked(entry_id)
    allowed, target, action = TRANSITIONS[step]
    if entry.status not in allowed:
        raise FaqRefused(
            {"error": f"This entry is {entry.get_status_display().lower()}, so it can't be {action.label.lower()} now."},
            status=409,
        )
    if target == Status.PUBLISHED:
        problems = publish_problems(entry)
        if problems:
            raise FaqRefused(problems)
    if entry.status == Status.NEEDS_CHECKING and target in (Status.PUBLISHED, Status.DRAFT):
        entry.checked_by = actor
        entry.checked_at = timezone.now()
    previous = entry.status
    entry.status = target
    entry.updated_by = actor
    entry.save()
    record(entry, actor, action, {"from": previous})
    return entry


@transaction.atomic
def delete_entry(*, actor, entry_id):
    entry = _locked(entry_id)
    record(entry, actor, Action.DELETED, {"status": entry.status, "category": entry.category.name})
    entry.delete()
