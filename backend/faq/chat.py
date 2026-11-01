"""What the chatbot says (UC28): an answer, a few choices, or the office's
contact text. Students' questions are kept without a name or student ID."""
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.utils import timezone

from .models import FaqEntry, FaqQuestion, FaqSettings
from .search import MAX_CHOICES, MAX_RELATED, NONE, POSSIBLE, STRONG, find, find_passage
from .text import clean_question

Outcome = FaqQuestion.Outcome
TOKEN_SALT = "faq.question"
TOKEN_AGE = 60 * 60 * 24 * 7
START_QUESTIONS_PER_CATEGORY = 6
RELATED_SHARE = 0.8


class ChatRefused(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def token_for(question):
    return signing.dumps(question.pk, salt=TOKEN_SALT)


def question_for(question_id, token):
    """The saved question a token was issued for, or None."""
    try:
        if str(signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_AGE)) != str(question_id):
            return None
    except (signing.BadSignature, TypeError):
        return None
    return FaqQuestion.objects.filter(pk=question_id).first()


def entry_card(item):
    return {
        "id": str(item.entry_id),
        "question": item.question,
        "answer": item.answer,
        "category": item.category,
        "portalLink": item.portal_link,
    }


def entry_card_from(entry):
    return {
        "id": str(entry.pk),
        "question": entry.question,
        "answer": entry.answer,
        "category": entry.category.name,
        "portalLink": entry.portal_link,
    }


def _link(item):
    return {"id": str(item.entry_id), "question": item.question}


def _related(result, answer_id):
    floor = result.possible * RELATED_SHARE
    return [
        _link(candidate.item)
        for candidate in result.candidates
        if candidate.item.entry_id != answer_id and candidate.confidence >= floor
    ][:MAX_RELATED]


def passage_card(match):
    passage = match.passage
    return {
        "documentId": str(passage.document_id),
        "title": passage.title,
        "fileName": passage.file_name,
        "page": passage.page,
        "text": passage.text,
    }


def reply_for(text):
    """The reply to a question, and what to save about it."""
    result = find(text)
    reply = {
        "outcome": Outcome.NO_MATCH,
        "answer": None,
        "choices": [],
        "related": [],
        "passage": None,
        "contactText": "",
        "mode": result.mode,
    }
    top = result.top
    if result.band == STRONG:
        reply.update(outcome=Outcome.ANSWERED, answer=entry_card(top.item), related=_related(result, top.item.entry_id))
    elif result.band == POSSIBLE:
        floor = result.possible * RELATED_SHARE
        reply.update(
            outcome=Outcome.CHOICES,
            choices=[_link(c.item) for c in result.candidates[:MAX_CHOICES] if c is top or c.confidence >= floor],
        )
    else:
        match = find_passage(text)
        result.passage = match
        if match is not None and match.confidence >= settings.FAQ_DOCUMENT_MATCH:
            reply.update(outcome=Outcome.DOCUMENT, passage=passage_card(match))
        else:
            reply["contactText"] = FaqSettings.load().contact_text
    return reply, result


def ask(text, *, typed=True):
    text = clean_question(text)
    if not text:
        raise ChatRefused("Type a question.")
    reply, result = reply_for(text)
    top = result.top
    if reply["passage"]:
        score = result.passage.confidence
    else:
        score = top.confidence if top else None
    saved = FaqQuestion.objects.create(
        text=text,
        typed=typed,
        outcome=reply["outcome"],
        entry_id=int(reply["answer"]["id"]) if reply["answer"] else None,
        document_id=int(reply["passage"]["documentId"]) if reply["passage"] else None,
        score=round(score, 4) if score is not None else None,
        search_mode=result.mode,
    )
    return {**reply, "questionId": str(saved.pk), "token": token_for(saved)}


def open_entry(entry_id, *, question_id=None, token=None):
    """A choice or a related question the student picked."""
    entry = FaqEntry.objects.published().select_related("category").filter(pk=entry_id).first() if str(entry_id).isdigit() else None
    if entry is None:
        raise ChatRefused("That answer is no longer available.", status=404)
    asked = question_for(question_id, token) if question_id and token else None
    if asked is not None and asked.outcome == Outcome.CHOICES:
        FaqQuestion.objects.filter(pk=asked.pk).update(entry=entry)
        saved = asked
    else:
        saved = FaqQuestion.objects.create(
            text=clean_question(entry.question), typed=False, outcome=Outcome.ANSWERED, entry=entry, score=1.0, search_mode=""
        )
    reply, result = reply_for(entry.question)
    related = [link for link in reply["related"] if link["id"] != str(entry.pk)]
    if reply["answer"] and reply["answer"]["id"] != str(entry.pk):
        related = [{"id": reply["answer"]["id"], "question": reply["answer"]["question"]}, *related]
    return {
        "outcome": Outcome.ANSWERED,
        "answer": entry_card_from(entry),
        "choices": [],
        "related": related[:MAX_RELATED],
        "passage": None,
        "contactText": "",
        "mode": result.mode,
        "questionId": str(saved.pk),
        "token": token_for(saved),
    }


def give_feedback(question_id, token, helpful):
    question = question_for(question_id, token)
    if question is None:
        raise ChatRefused("This answer can't be rated any more.", status=403)
    FaqQuestion.objects.filter(pk=question.pk).update(helpful=helpful)
    return {"helpful": helpful, "contactText": "" if helpful else FaqSettings.load().contact_text}


def same_wording(text):
    return " ".join(str(text or "").split()).casefold()


def start_screen():
    chatbot = FaqSettings.load()
    categories = {}
    live = set()
    for entry in FaqEntry.objects.published().select_related("category").order_by("category__position", "position", "pk"):
        live.add(same_wording(entry.question))
        group = categories.setdefault(entry.category_id, {"id": str(entry.category_id), "name": entry.category.name, "questions": []})
        if len(group["questions"]) < START_QUESTIONS_PER_CATEGORY and entry.question:
            group["questions"].append({"id": str(entry.pk), "question": entry.question})
    # A common question only shows while a live answer still has that question.
    common = [text for text in chatbot.common_questions if same_wording(text) in live][:4]
    if not common:
        common = [group["questions"][0]["question"] for group in categories.values() if group["questions"]][:4]
    return {"categories": list(categories.values()), "commonQuestions": common, "contactText": chatbot.contact_text}


def try_question(text):
    """What a student would see, for the office. Nothing is saved."""
    text = clean_question(text)
    if not text:
        raise ChatRefused("Type a question.")
    reply, result = reply_for(text)
    band = {STRONG: "Strong", POSSIBLE: "Possible", NONE: "None"}[result.band]
    match = getattr(result, "passage", None)
    return {
        **reply,
        "match": band,
        "passageConfidence": round(match.confidence, 3) if match is not None else None,
        "candidates": [
            {
                "id": str(c.item.entry_id),
                "question": c.item.question,
                "confidence": round(c.confidence, 3),
                "meaning": None if c.meaning is None else round(c.meaning, 3),
                "keywords": round(c.keywords, 3),
            }
            for c in result.candidates[:5]
        ],
    }


def purge_old_questions(days=None):
    days = settings.FAQ_QUESTION_RETENTION_DAYS if days is None else days
    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = FaqQuestion.objects.filter(asked_at__lt=cutoff).delete()
    return deleted
