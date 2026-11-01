"""Who a letter is for, as in Maya: the purpose, then the organisation, then the
address. The purposes and organisations are the office's recipients list (see
``choice_lists.py``); an organisation not listed can be typed in when its purpose
allows it. The address starts from the organisation's saved one and the student
can change it, since a letter usually goes to one branch or office. When the
letter asks for the address, everything but its second line must be filled in;
the state, chosen from Malaysia's states, only for an address in Malaysia.
"""
from .places import COUNTRIES, MALAYSIA, MALAYSIAN_STATES

# The extra lines a student may ask to have shown, and the tag each one fills.
OPTIONAL_DETAILS = [
    ("MIN_PERIOD", "Minimum period of study", "BALANCE_SEMESTERS_MIN"),
    ("MAX_PERIOD", "Maximum period of study", "BALANCE_SEMESTERS_MAX"),
    ("CURRENT_SEMESTER", "Current semester", "CURRENT_SEMESTER"),
]
OPTIONAL_CODES = [code for code, _, _ in OPTIONAL_DETAILS]
OPTIONAL_TAGS = {code: tag for code, _, tag in OPTIONAL_DETAILS}

ADDRESS_FIELDS = ["addressLine1", "addressLine2", "postcode", "city", "state", "country"]
REQUIRED_ADDRESS = {
    "addressLine1": "Enter the address.",
    "postcode": "Enter the postcode.",
    "city": "Enter the city.",
    "state": "Choose the state.",
    "country": "Choose the country.",
}
MAX_NAME = 160
MAX_ADDRESS = 120


def clean_request_details(raw, question=None):
    """``(details, errors, item)`` for who a student said the letter is for.

    ``question`` is the letter's "recipient" question: it may offer only some
    purposes, and may not ask for the address. ``item`` is the organisation
    chosen from the list, or None when it was typed in.
    """
    from .models import ChoiceItem
    from .choice_lists import recipients_list

    question = question or {}
    if not isinstance(raw, dict):
        return None, {"details": "Say who the letter is for."}, None
    recipients = recipients_list()
    groups = recipients.groups.filter(hidden=False) if recipients else []
    offered = question.get("purposes") or []
    if offered:
        groups = groups.filter(code__in=offered)
    code = str(raw.get("purpose") or "").strip().upper()
    group = next((g for g in groups if g.code == code), None)
    errors = {}
    if group is None:
        errors["purpose"] = "Choose what the letter is for."
    item = None
    organisation = " ".join(str(raw.get("organisation") or "").split())
    item_id = str(raw.get("organisationId") or "")
    if group is not None:
        visible = ChoiceItem.objects.filter(group=group, hidden=False)
        item = visible.filter(pk=item_id).first() if item_id.isdigit() else None
        if item is None and organisation:
            item = next((entry for entry in visible if entry.name.casefold() == organisation.casefold()), None)
        if item is None:
            noun = group.item_noun.lower() or "organisation"
            if not organisation:
                errors["organisation"] = f"Choose or type the {noun}."
            elif not group.allow_other:
                errors["organisation"] = f"Choose a {noun} from the list."
            elif len(organisation) > MAX_NAME:
                errors["organisation"] = f"Keep the name under {MAX_NAME} characters."
    if question.get("askAddress", True) is not False:
        address, problems = clean_address(raw)
        errors.update(problems)
    else:
        address = {field: "" for field in ADDRESS_FIELDS}
    include = raw.get("include") or []
    if not isinstance(include, list) or any(code not in OPTIONAL_CODES for code in include):
        errors["include"] = "Choose from the listed details only."
        include = []
    if errors:
        return None, errors, None
    return {
        "purpose": group.code,
        "purposeLabel": group.name,
        "organisation": item.name if item else organisation,
        "organisationMs": (item.name_ms if item else "") or "",
        "organisationId": item.pk if item else None,
        "typedIn": item is None,
        **address,
        "include": [code for code in OPTIONAL_CODES if code in include],
    }, None, item


def clean_address(raw):
    """``(address, errors)`` for the address lines a student entered."""
    address = {field: " ".join(str(raw.get(field) or "").split()) for field in ADDRESS_FIELDS}
    abroad = address["country"] not in ("", MALAYSIA)
    if abroad:
        address["state"] = ""
    errors = {}
    for field, value in address.items():
        if not value and field in REQUIRED_ADDRESS and not (abroad and field == "state"):
            errors[field] = REQUIRED_ADDRESS[field]
        elif len(value) > MAX_ADDRESS:
            errors[field] = f"Keep it under {MAX_ADDRESS} characters."
    if address["country"] and address["country"] not in COUNTRIES:
        errors["country"] = "Choose a country from the list."
    if address["state"] and address["state"] not in MALAYSIAN_STATES:
        errors["state"] = "Choose a state from the list."
    return address, errors


def recipient_block(details, malay=False):
    """The name and address lines as printed at the top of the letter."""
    if not details or not details.get("organisation"):
        return ""
    name = (malay and details.get("organisationMs")) or details.get("organisation")
    city_line = " ".join(part for part in (details.get("postcode"), details.get("city")) if part)
    country = details.get("country") if details.get("country") != MALAYSIA else ""
    lines = [name, details.get("addressLine1"), details.get("addressLine2"), city_line, details.get("state"), country]
    return "\n".join(line.upper() for line in lines if line)


def same_recipient(first, second):
    return bool(first and second) and (first.get("organisation") or "").casefold() == (second.get("organisation") or "").casefold()
