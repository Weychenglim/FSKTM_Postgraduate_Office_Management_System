"""The office's look at what students asked (UC29): questions the chatbot
could not answer, or that students said did not help, grouped when they say
the same thing, with a few numbers on top."""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .encoder import get_encoder
from .entries import FaqRefused, edit_entry
from .models import FaqEntry, FaqQuestion
from .text import words

Outcome = FaqQuestion.Outcome
Review = FaqQuestion.Review
MALAYSIA = ZoneInfo("Asia/Kuala_Lumpur")
MAX_GROUPS = 100
# How close in meaning two questions must be to count as the same question.
SAME_QUESTION = 0.75
logger = logging.getLogger(__name__)
NEEDS_A_LOOK = Q(outcome=Outcome.NO_MATCH) | Q(helpful=False)


def group_key(text):
    """Questions with the same content words, in any order, are one group."""
    found = sorted(set(words(text)))
    return " ".join(found) if found else text.strip().casefold()


def _meanings(texts):
    """Unit vectors for the texts, or None without the meaning model."""
    encoder = get_encoder()
    if encoder is None or not texts:
        return None
    try:
        return encoder.encode(texts)
    except Exception:
        logger.exception("Could not group the student questions by meaning.")
        return None


def waiting_groups():
    """Groups of questions that say the same thing: the same content words,
    or close in meaning when the model is available."""
    waiting = list(
        FaqQuestion.objects.filter(NEEDS_A_LOOK, review=Review.WAITING).select_related("entry").order_by("-asked_at", "-pk")
    )
    texts = list(dict.fromkeys(question.text for question in waiting))
    vectors = _meanings(texts)
    vector_of = dict(zip(texts, vectors)) if vectors is not None else {}
    groups = []
    by_key = {}
    for question in waiting:
        key = group_key(question.text)
        group = by_key.get(key)
        if group is None and vector_of:
            mine = vector_of[question.text]
            group = next((g for g in groups if float(g["vector"] @ mine) >= SAME_QUESTION), None)
        if group is None:
            if len(groups) >= MAX_GROUPS:
                continue
            group = {
                "key": key,
                "text": question.text,
                "count": 0,
                "lastAsked": question.asked_at.isoformat(),
                "noMatch": 0,
                "notHelpful": 0,
                "lastOutcome": question.outcome,
                "lastEntry": {"id": str(question.entry_id), "question": question.entry.question} if question.entry else None,
                "lastAiAnswer": question.ai_answer if question.helpful is False else "",
                "ids": [],
                "vector": vector_of.get(question.text),
            }
            groups.append(group)
        by_key.setdefault(key, group)
        group["count"] += 1
        group["ids"].append(str(question.pk))
        if question.outcome == Outcome.NO_MATCH:
            group["noMatch"] += 1
        if question.helpful is False:
            group["notHelpful"] += 1
    for group in groups:
        del group["vector"]
    # Most asked first; groups asked equally often stay newest first.
    return sorted(groups, key=lambda group: -group["count"])


def month_start():
    now = timezone.localtime(timezone.now(), MALAYSIA)
    return datetime(now.year, now.month, 1, tzinfo=MALAYSIA)


def share(part, whole):
    return round(100 * part / whole) if whole else None


def question_stats():
    month = FaqQuestion.objects.filter(asked_at__gte=month_start(), typed=True)
    total = month.count()
    answered = month.filter(outcome__in=[Outcome.ANSWERED, Outcome.DOCUMENT]).count()
    rated = FaqQuestion.objects.filter(asked_at__gte=month_start(), helpful__isnull=False)
    return {
        "thisMonth": total,
        "answeredPercent": share(answered, total),
        "helpfulPercent": share(rated.filter(helpful=True).count(), rated.count()),
        "waiting": FaqQuestion.objects.filter(NEEDS_A_LOOK, review=Review.WAITING).count(),
    }


@transaction.atomic
def review_questions(*, actor, ids, action, entry_id=None, text=""):
    """Settle a group: add it to an entry as another way to ask, note that an
    entry was created for it, or dismiss it. Returns how many were settled."""
    questions = list(
        FaqQuestion.objects.select_for_update().filter(pk__in=[pk for pk in ids if str(pk).isdigit()], review=Review.WAITING)
    )
    if not questions:
        raise FaqRefused({"error": "These questions were already looked at. Reload the list."}, status=409)
    if action in ("add", "create"):
        entry = FaqEntry.objects.filter(pk=entry_id).first() if str(entry_id or "").isdigit() else None
        if entry is None:
            raise FaqRefused({"entryId": "Choose the entry."})
    if action == "add":
        wording = " ".join((text or questions[0].text).split())
        current = list(entry.alt_questions.values_list("text", flat=True))
        edit_entry(actor=actor, entry_id=entry.pk, data={"altQuestions": [*current, wording]})
        review = Review.ADDED
    elif action == "create":
        review = Review.CREATED
    elif action == "dismiss":
        review = Review.DISMISSED
    else:
        raise FaqRefused({"action": "Choose add, create or dismiss."})
    FaqQuestion.objects.filter(pk__in=[question.pk for question in questions]).update(
        review=review, reviewed_by=actor, reviewed_at=timezone.now()
    )
    return len(questions)
