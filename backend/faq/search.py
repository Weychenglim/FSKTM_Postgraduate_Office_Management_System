"""Finding the answer to a question (UC28).

Two searches run over every Published entry, its question and the other ways
students ask it:
- a keyword search (Okapi BM25), which catches exact words such as "PTPTN"
  or a course code;
- a meaning search with the multilingual model, which catches paraphrases
  and Malay.

Their rankings are merged with reciprocal rank fusion. How sure the top
entry is decides the outcome: Strong shows the answer, Possible offers a few
choices, anything lower is No match. Without the model the keyword search
works alone.
"""
import hashlib
import math
import threading
from collections import Counter
from dataclasses import dataclass, field

from django.conf import settings
from django.db.models import Count, Max

from .encoder import HYBRID, KEYWORDS, get_encoder
from .models import FaqAltQuestion, FaqCategory, FaqDocument, FaqEntry, FaqPassage, FaqVector
from .text import words

K1 = 1.5
B = 0.75
RRF_K = 60
ANSWER_WORD_CREDIT = 0.5
STRONG = "STRONG"
POSSIBLE = "POSSIBLE"
NONE = "NONE"
MAX_CHOICES = 3
MAX_RELATED = 3
# A shown answer has to clearly beat the next entry on meaning; closer than
# this, the student chooses. Choices come from this many leading entries.
CLEAR_MARGIN = 0.05
CHOICE_POOL = 6
# Among entries that tie on meaning, one this far ahead on keywords still wins.
KEYWORD_LEAD = 0.2


@dataclass
class Item:
    entry_id: int
    question: str
    answer: str
    category: str
    portal_link: str
    asked_as: list
    question_words: set
    answer_words: set
    doc_words: Counter
    length: int


@dataclass
class Index:
    key: tuple
    mode: str
    items: list
    doc_freq: Counter
    average_length: float
    vectors: object = None
    owners: list = field(default_factory=list)

    def idf(self, word):
        total = len(self.items)
        found = self.doc_freq.get(word, 0)
        return math.log(1 + (total - found + 0.5) / (found + 0.5))


@dataclass
class Candidate:
    item: Item
    bm25: float
    keywords: float
    meaning: float | None
    fused: float = 0.0

    @property
    def confidence(self):
        return max(self.keywords, self.meaning or 0.0)


@dataclass
class Result:
    band: str
    candidates: list
    mode: str
    passage: object = None
    possible: float = 0.0
    # Sure enough to answer, but other entries are as close: the student chooses,
    # and the AI, when on, may still write from them.
    close_call: bool = False

    @property
    def top(self):
        return self.candidates[0] if self.candidates else None


def fingerprint(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def index_key():
    """Changes whenever anything students can find changes."""
    entries = FaqEntry.objects.published().aggregate(total=Count("pk"), latest=Max("updated_at"))
    alts = FaqAltQuestion.objects.filter(entry__status=FaqEntry.Status.PUBLISHED).aggregate(
        total=Count("pk"), latest=Max("pk")
    )
    categories = tuple(FaqCategory.objects.order_by("pk").values_list("pk", "name"))
    return (entries["total"], entries["latest"], alts["total"], alts["latest"], categories)


def vectors_for(texts, encoder):
    """A unit vector per text, worked out only for texts not seen before."""
    import numpy

    prints = [fingerprint(text) for text in texts]
    stored = {
        row.fingerprint: numpy.frombuffer(bytes(row.vector), dtype="float32")
        for row in FaqVector.objects.filter(model_name=encoder.name, fingerprint__in=set(prints))
    }
    missing = list(dict.fromkeys(text for text, mark in zip(texts, prints) if mark not in stored))
    if missing:
        rows = []
        for text, vector in zip(missing, encoder.encode(missing)):
            vector = numpy.asarray(vector, dtype="float32")
            stored[fingerprint(text)] = vector
            rows.append(
                FaqVector(
                    model_name=encoder.name,
                    fingerprint=fingerprint(text),
                    dimensions=len(vector),
                    vector=vector.tobytes(),
                )
            )
        FaqVector.objects.bulk_create(rows, ignore_conflicts=True)
    if not prints:
        return numpy.zeros((0, 0), dtype="float32")
    return numpy.vstack([stored[mark] for mark in prints])


def build_index(key, encoder):
    items = []
    entries = FaqEntry.objects.published().select_related("category").prefetch_related("alt_questions")
    for entry in entries:
        asked_as = [text for text in [entry.question, *(alt.text for alt in entry.alt_questions.all())] if text.strip()]
        question_words = [word for text in asked_as for word in words(text)]
        answer_words = words(entry.answer)
        # Words in the question count twice: they say what the entry is about.
        doc = Counter(question_words * 2 + answer_words)
        items.append(
            Item(
                entry_id=entry.pk,
                question=entry.question,
                answer=entry.answer,
                category=entry.category.name,
                portal_link=entry.portal_link,
                asked_as=asked_as,
                question_words=set(question_words),
                answer_words=set(answer_words),
                doc_words=doc,
                length=sum(doc.values()),
            )
        )
    doc_freq = Counter(word for item in items for word in item.doc_words)
    average = sum(item.length for item in items) / len(items) if items else 1.0
    index = Index(key=key, mode=HYBRID if encoder else KEYWORDS, items=items, doc_freq=doc_freq, average_length=average or 1.0)
    if encoder is not None:
        texts = [text for item in items for text in item.asked_as]
        index.owners = [position for position, item in enumerate(items) for _ in item.asked_as]
        index.vectors = vectors_for(texts, encoder)
    return index


_cache = {}
_lock = threading.Lock()


def current_index():
    encoder = get_encoder()
    key = (index_key(), getattr(encoder, "name", KEYWORDS))
    cached = _cache.get("index")
    if cached is not None and cached.key == key:
        return cached
    with _lock:
        cached = _cache.get("index")
        if cached is None or cached.key != key:
            cached = build_index(key, encoder)
            _cache["index"] = cached
        return cached


def clear_index():
    _cache.clear()


def _bm25(index, item, query):
    score = 0.0
    for word in query:
        count = item.doc_words.get(word, 0)
        if count:
            norm = count + K1 * (1 - B + B * item.length / index.average_length)
            score += index.idf(word) * count * (K1 + 1) / norm
    return score


def _keywords(index, item, query):
    """How much of the question's weight the entry's own words cover."""
    total = sum(index.idf(word) for word in query)
    if not total:
        return 0.0
    covered = 0.0
    for word in query:
        if word in item.question_words:
            covered += index.idf(word)
        elif word in item.answer_words:
            covered += index.idf(word) * ANSWER_WORD_CREDIT
    return covered / total


def _meanings(index, text):
    encoder = get_encoder()
    if index.vectors is None or not len(index.owners) or encoder is None:
        return None
    scores = index.vectors @ encoder.encode([text])[0]
    best = [-1.0] * len(index.items)
    for row, owner in enumerate(index.owners):
        best[owner] = max(best[owner], float(scores[row]))
    return best


def search(text, *, use_meaning=True, use_keywords=True):
    index = current_index()
    query = list(dict.fromkeys(words(text)))
    meanings = _meanings(index, text) if use_meaning else None
    candidates = [
        Candidate(
            item=item,
            bm25=_bm25(index, item, query) if use_keywords else 0.0,
            keywords=_keywords(index, item, query) if use_keywords else 0.0,
            meaning=meanings[position] if meanings is not None else None,
        )
        for position, item in enumerate(index.items)
    ]
    rankings = []
    if use_keywords:
        rankings.append(sorted((c for c in candidates if c.bm25 > 0), key=lambda c: -c.bm25))
    if meanings is not None:
        rankings.append(sorted(candidates, key=lambda c: -(c.meaning or 0.0)))
    for ranking in rankings:
        for rank, candidate in enumerate(ranking, start=1):
            candidate.fused += 1 / (RRF_K + rank)
    ranked = sorted((c for c in candidates if c.fused > 0), key=lambda c: (-c.fused, -c.confidence))
    return ranked, (HYBRID if meanings is not None else KEYWORDS)


def find(text, *, strong=None, possible=None, **kinds):
    """Search and decide how sure the answer is."""
    ranked, mode = search(text, **kinds)
    keywords_only = mode == KEYWORDS
    if strong is None:
        strong = settings.FAQ_KEYWORD_STRONG_MATCH if keywords_only else settings.FAQ_STRONG_MATCH
    if possible is None:
        possible = settings.FAQ_KEYWORD_POSSIBLE_MATCH if keywords_only else settings.FAQ_POSSIBLE_MATCH
    if not ranked:
        return Result(NONE, [], mode, possible=possible)
    # The fused order can put a near miss first; a clear match close behind it wins.
    leader = max(ranked[:MAX_CHOICES], key=lambda c: c.confidence)
    if leader is not ranked[0] and leader.confidence >= strong > ranked[0].confidence:
        ranked = [leader, *(c for c in ranked if c is not leader)]
    confidence = ranked[0].confidence
    band = STRONG if confidence >= strong else POSSIBLE if confidence >= possible else NONE
    close_call = False
    if band == STRONG and not keywords_only:
        winner = _clear_winner(ranked)
        if winner is None:
            band, close_call = POSSIBLE, True
        elif winner is not ranked[0]:
            ranked = [winner, *(c for c in ranked if c is not winner)]
    if band == POSSIBLE:
        pool = sorted(ranked[:CHOICE_POOL], key=lambda c: -c.confidence)
        ranked = [*pool, *ranked[CHOICE_POOL:]]
    return Result(band, ranked, mode, possible=possible, close_call=close_call)


def _clear_winner(ranked):
    """The entry to show, or None when the leading entries are too close to call.
    Entries within CLEAR_MARGIN of the best meaning are contenders; the top
    entry must be one of them, and among several the keywords must decide."""
    pool = ranked[:CHOICE_POOL]
    if ranked[0].meaning is None:
        return ranked[0]
    best = max(c.meaning or 0.0 for c in pool)
    contenders = [c for c in pool if (c.meaning or 0.0) >= best - CLEAR_MARGIN]
    if ranked[0] not in contenders:
        return None
    if len(contenders) == 1:
        return ranked[0]
    leader = max(contenders, key=lambda c: c.keywords)
    if all(leader.keywords - c.keywords >= KEYWORD_LEAD for c in contenders if c is not leader):
        return leader
    return None


# Passages from the office's reference documents, searched only when no
# entry is a clear match. They have their own, stricter cut-off.


@dataclass
class Passage:
    passage_id: int
    document_id: int
    title: str
    file_name: str
    page: int | None
    text: str
    words: Counter
    length: int


@dataclass
class PassageIndex:
    key: tuple
    items: list
    doc_freq: Counter
    average_length: float
    vectors: object = None

    def idf(self, word):
        total = len(self.items)
        found = self.doc_freq.get(word, 0)
        return math.log(1 + (total - found + 0.5) / (found + 0.5))


@dataclass
class PassageMatch:
    passage: Passage
    meaning: float | None
    keywords: float
    mode: str

    @property
    def confidence(self):
        return self.meaning if self.meaning is not None else self.keywords


def passage_key():
    documents = FaqDocument.objects.filter(status=FaqDocument.Status.READY, archived=False).aggregate(
        total=Count("pk"), latest=Max("updated_at")
    )
    return (documents["total"], documents["latest"])


def build_passage_index(key, encoder):
    rows = FaqPassage.objects.filter(
        document__status=FaqDocument.Status.READY, document__archived=False
    ).select_related("document")
    items = []
    for row in rows:
        counted = Counter(words(row.text))
        items.append(
            Passage(
                passage_id=row.pk,
                document_id=row.document_id,
                title=row.document.title,
                file_name=row.document.original_name,
                page=row.page,
                text=row.text,
                words=counted,
                length=sum(counted.values()),
            )
        )
    doc_freq = Counter(word for item in items for word in item.words)
    average = sum(item.length for item in items) / len(items) if items else 1.0
    index = PassageIndex(key=key, items=items, doc_freq=doc_freq, average_length=average or 1.0)
    if encoder is not None and items:
        index.vectors = vectors_for([item.text for item in items], encoder)
    return index


def current_passages():
    encoder = get_encoder()
    key = (passage_key(), getattr(encoder, "name", KEYWORDS))
    cached = _cache.get("passages")
    if cached is not None and cached.key == key:
        return cached
    with _lock:
        cached = _cache.get("passages")
        if cached is None or cached.key != key:
            cached = build_passage_index(key, encoder)
            _cache["passages"] = cached
        return cached


def find_passage(text):
    """The best passage for a question, or None. With the model the meaning
    decides; keyword search alone needs at least two words to agree."""
    index = current_passages()
    if not index.items:
        return None
    query = list(dict.fromkeys(words(text)))
    total = sum(index.idf(word) for word in query)
    encoder = get_encoder()
    meanings = None
    if index.vectors is not None and encoder is not None:
        meanings = index.vectors @ encoder.encode([text])[0]
    best = None
    for position, item in enumerate(index.items):
        found = [word for word in query if word in item.words]
        keywords = sum(index.idf(word) for word in found) / total if total else 0.0
        if meanings is None and len(found) < 2:
            keywords = 0.0
        match = PassageMatch(
            passage=item,
            meaning=float(meanings[position]) if meanings is not None else None,
            keywords=keywords,
            mode=HYBRID if meanings is not None else KEYWORDS,
        )
        if best is None or match.confidence > best.confidence:
            best = match
    return best
