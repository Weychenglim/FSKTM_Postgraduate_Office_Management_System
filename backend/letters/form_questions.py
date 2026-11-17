"""The questions a student answers when asking for a letter.

Each letter type keeps its own ordered list in ``LetterTemplate.form_questions``:

- ``recipient``: "Who is the letter for?", the purpose, then the organisation from
  the recipients list, then its address. ``purposes`` limits the purposes offered
  (empty offers all) and ``askAddress`` turns the address rows off.
- ``extras``: "Optional study details", tick boxes for the optional lines the
  wording shows (semesters left, current semester). Without it those lines
  always print.
- ``text``, ``date``, ``choice``, ``yesno``: the office's own questions. Each has a
  ``name`` that is also its tag on the letter (``{{DATE_NEEDED}}``), a ``label``,
  an optional ``hint`` and ``required`` (never for yes or no). A choice question
  keeps the options the office typed in ``options``, or names a saved simple
  list in ``listId``.

What the student answered is saved with the request, with the label and the
printed value, so a later change to the question or its list never alters it.
"""
from datetime import date

from .confirmation import english_date, malay_date
from .models import ChoiceItem, ChoiceList, LetterPurpose
from .placeholders import ALL_PLACEHOLDERS, FIELD_NAME_RE, field_names

KINDS = ("recipient", "extras", "text", "date", "choice", "yesno")
CUSTOM_KINDS = ("text", "date", "choice", "yesno")
KIND_LABELS = {"text": "Short answer", "date": "Date", "choice": "Choose one option", "yesno": "Yes or no"}
MAX_QUESTIONS = 15
MAX_LABEL = 80
MAX_HINT = 200
MAX_ANSWER = 300
MAX_OPTIONS = 200
MAX_OPTION = 120
YES_NO = {True: ("Yes", "Ya"), False: ("No", "Tidak")}


def custom_questions(questions):
    return [q for q in questions or [] if q.get("kind") in CUSTOM_KINDS]


def question_names(questions):
    return [q["name"] for q in custom_questions(questions)]


def known_fields(template):
    """The template's own tags: what the office fills in and what the student answers."""
    return [*(template.custom_fields or []), *({"name": name} for name in question_names(template.form_questions))]


def clean_questions(raw, custom_fields=(), purpose=LetterPurpose.REQUEST, recipient_codes=None):
    """``(questions, error)`` for the questions the office set on a letter type."""
    if raw in (None, ""):
        return [], None
    if not isinstance(raw, list):
        return None, "Questions must be a list."
    if raw and purpose != LetterPurpose.REQUEST:
        return None, "Only letters students ask for have a student form."
    if len(raw) > MAX_QUESTIONS:
        return None, f"A letter can ask at most {MAX_QUESTIONS} questions."
    office_names = field_names(custom_fields)
    questions, seen_kinds, seen_names = [], set(), set()
    for item in raw:
        if not isinstance(item, dict) or item.get("kind") not in KINDS:
            return None, "Each question needs a kind: recipient, extras, text, date, choice or yesno."
        kind = item["kind"]
        if kind in ("recipient", "extras"):
            if kind in seen_kinds:
                return None, "Ask \"Who is the letter for?\" and \"Optional study details\" once each."
            seen_kinds.add(kind)
            if kind == "extras":
                questions.append({"kind": "extras"})
                continue
            purposes = item.get("purposes") or []
            if not isinstance(purposes, list) or not all(isinstance(code, str) for code in purposes):
                return None, "Choose the purposes from the recipients list."
            if recipient_codes is not None and any(code not in recipient_codes for code in purposes):
                return None, "One of the chosen purposes is no longer in the recipients list."
            questions.append({"kind": "recipient", "purposes": list(dict.fromkeys(purposes)), "askAddress": item.get("askAddress", True) is not False})
            continue
        name = str(item.get("name") or "").strip().upper()
        label = " ".join(str(item.get("label") or "").split())
        hint = " ".join(str(item.get("hint") or "").split())
        if not label:
            return None, "Give every question a label, the words the student sees."
        if len(label) > MAX_LABEL:
            return None, f"Keep the question \"{label[:30]}…\" under {MAX_LABEL} characters."
        if len(hint) > MAX_HINT:
            return None, f"Keep the hint of \"{label}\" under {MAX_HINT} characters."
        if not FIELD_NAME_RE.fullmatch(name):
            return None, f"The question \"{label}\" needs a tag name of 2 to 40 capital letters or underscores."
        if name in ALL_PLACEHOLDERS or name in office_names or name in seen_names:
            return None, f"The question \"{label}\" uses the tag {{{{{name}}}}}, which is already taken. Rename it."
        seen_names.add(name)
        question = {"kind": kind, "name": name, "label": label, "hint": hint, "required": kind != "yesno" and bool(item.get("required"))}
        if kind == "choice":
            list_id = item.get("listId")
            if list_id not in (None, ""):
                if not ChoiceList.objects.filter(pk=list_id if str(list_id).isdigit() else None, kind=ChoiceList.Kind.SIMPLE).exists():
                    return None, f"Choose the saved list for \"{label}\"."
                question["listId"] = int(list_id)
            else:
                options, problem = _clean_options(item.get("options"), label)
                if problem:
                    return None, problem
                question["options"] = options
        questions.append(question)
    return questions, None


def _clean_options(raw, label):
    """``(options, problem)`` for the options the office typed for a choice question."""
    if not isinstance(raw, list):
        return None, f"Add the options students choose from for \"{label}\"."
    options, seen = [], set()
    for value in raw:
        text = " ".join(str(value or "").split())
        if not text or text.casefold() in seen:
            continue
        if len(text) > MAX_OPTION:
            return None, f"Keep each option of \"{label}\" under {MAX_OPTION} characters."
        seen.add(text.casefold())
        options.append(text)
    if len(options) < 2:
        return None, f"Give \"{label}\" at least two options."
    if len(options) > MAX_OPTIONS:
        return None, f"\"{label}\" can have at most {MAX_OPTIONS} options."
    return options, None


def _display(question, value):
    """``(english, malay)`` as printed on the letter."""
    kind = question["kind"]
    if kind == "date":
        return english_date(value), malay_date(value)
    if kind == "yesno":
        return YES_NO[bool(value)]
    return value, value


def clean_answers(questions, raw):
    """``(answers, errors, items)`` for what the student answered. ``items`` are
    the list entries chosen, so the office can see which are in use."""
    raw = raw if isinstance(raw, dict) else {}
    answers, errors, items = {}, {}, []
    for question in custom_questions(questions):
        name, kind = question["name"], question["kind"]
        given = raw.get(name)
        saved = {"kind": kind, "label": question["label"]}
        if kind == "yesno":
            value = given is True or str(given).lower() in ("true", "yes", "1")
            english, malay = _display(question, value)
            answers[name] = {**saved, "answer": value, "value": english, "valueMs": malay}
            continue
        text = " ".join(str(given or "").split())
        if not text:
            if question.get("required"):
                errors[name] = "Answer this question." if kind != "choice" else "Choose one."
            continue
        if kind == "text":
            if len(text) > MAX_ANSWER:
                errors[name] = f"Keep it under {MAX_ANSWER} characters."
                continue
            answers[name] = {**saved, "answer": text, "value": text, "valueMs": text}
        elif kind == "date":
            try:
                day = date.fromisoformat(text)
            except ValueError:
                errors[name] = "Choose a date."
                continue
            english, malay = _display(question, day)
            answers[name] = {**saved, "answer": day.isoformat(), "value": english, "valueMs": malay}
        elif question.get("options"):
            chosen = next((option for option in question["options"] if option.casefold() == text.casefold()), None)
            if chosen is None:
                errors[name] = "Choose one of the options."
                continue
            answers[name] = {**saved, "answer": chosen, "value": chosen, "valueMs": chosen}
        else:
            entries = ChoiceItem.objects.filter(choice_list_id=question["listId"], hidden=False)
            item = entries.filter(pk=text).first() if text.isdigit() else entries.filter(name__iexact=text).first()
            if item is None:
                errors[name] = "Choose one from the list."
                continue
            items.append(item)
            answers[name] = {**saved, "answer": str(item.pk), "value": item.name, "valueMs": item.name_ms or item.name}
    return answers, errors, items


def answer_values(answers, malay=False):
    """What each answered tag prints as, by tag name."""
    key = "valueMs" if malay else "value"
    return {name: str(answer.get(key) or "") for name, answer in (answers or {}).items()}


def resolve(template):
    """The letter's questions with what the student chooses from, for the form."""
    from .choice_lists import recipient_options, simple_list_options
    from .recipients import OPTIONAL_DETAILS

    offered = template.optional_details()
    resolved = []
    for question in template.form_questions or []:
        kind = question.get("kind")
        if kind == "recipient":
            resolved.append({**question, "options": recipient_options(question.get("purposes") or None)})
        elif kind == "extras":
            options = [{"code": code, "label": label} for code, label, _ in OPTIONAL_DETAILS if code in offered]
            if options:
                resolved.append({"kind": "extras", "options": options})
        elif kind == "choice" and question.get("options"):
            items = [{"id": option, "name": option} for option in question["options"]]
            resolved.append({**question, "list": {"id": None, "name": "", "itemNoun": "Option", "items": items}})
        elif kind == "choice":
            listed = simple_list_options(question.get("listId"))
            resolved.append({**question, "list": listed or {"id": None, "name": "", "itemNoun": "Item", "items": []}})
        else:
            resolved.append(dict(question))
    return resolved
