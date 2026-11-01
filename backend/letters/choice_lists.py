"""The lists the office keeps for letter questions.

The recipients list holds the purposes students choose from (Banking,
Transportation...) and the organisations under each, with an address that is
filled in for the student. Simple lists, such as embassies, back "Choose from a
list" questions. Requests keep their own copy of what was chosen, so editing a
list never changes a letter already asked for.

An item a letter used can only be hidden; an unused one can be deleted.
"""
import re

from django.db.models import Count

from .models import ChoiceGroup, ChoiceItem, ChoiceList, GeneratedLetter, LetterTemplate
from .places import COUNTRIES, MALAYSIA, MALAYSIAN_STATES

MAX_NAME = 160
MAX_LIST_NAME = 120
MAX_NOUN = 60
MAX_ADDRESS = 120
MAX_PASTE = 200
ADDRESS_FIELDS = {
    "addressLine1": "address_line1",
    "addressLine2": "address_line2",
    "postcode": "postcode",
    "city": "city",
    "state": "state",
    "country": "country",
}


def recipients_list():
    return ChoiceList.objects.filter(kind=ChoiceList.Kind.RECIPIENTS).first()


def tidy(value):
    return " ".join(str(value or "").split())


def _templates_using(choice_list):
    """Names of letter types with a question that uses ``choice_list``."""
    names = []
    for template in LetterTemplate.objects.exclude(form_questions=[]):
        for question in template.form_questions or []:
            if choice_list.kind == ChoiceList.Kind.RECIPIENTS and question.get("kind") == "recipient":
                names.append(template.name)
                break
            if question.get("kind") == "choice" and question.get("listId") == choice_list.pk:
                names.append(template.name)
                break
    return names


def item_dict(item, used=None):
    return {
        "id": str(item.pk),
        "groupId": str(item.group_id) if item.group_id else None,
        "name": item.name,
        "nameMs": item.name_ms,
        **item.address(),
        "hidden": item.hidden,
        "usedCount": used if used is not None else getattr(item, "used_count", 0),
        "modifiedBy": item.modified_by,
    }


def group_dict(group, used_letters=0):
    return {
        "id": str(group.pk),
        "code": group.code,
        "name": group.name,
        "nameMs": group.name_ms,
        "itemNoun": group.item_noun,
        "allowOther": group.allow_other,
        "hidden": group.hidden,
        "usedCount": used_letters,
        "modifiedBy": group.modified_by,
    }


def list_summary(choice_list):
    items = choice_list.items.all()
    return {
        "id": str(choice_list.pk),
        "name": choice_list.name,
        "kind": choice_list.kind,
        "description": choice_list.description,
        "itemNoun": choice_list.item_noun,
        "groupCount": choice_list.groups.count(),
        "itemCount": items.count(),
        "hiddenCount": items.filter(hidden=True).count(),
        "usedBy": _templates_using(choice_list),
        "modifiedBy": choice_list.modified_by,
    }


def list_detail(choice_list):
    items = choice_list.items.annotate(used_count=Count("letters", distinct=True))
    group_letters = {}
    if choice_list.kind == ChoiceList.Kind.RECIPIENTS:
        for group in choice_list.groups.all():
            group_letters[group.pk] = GeneratedLetter.objects.filter(request_details__purpose=group.code).count()
    return {
        **list_summary(choice_list),
        "groups": [group_dict(group, group_letters.get(group.pk, 0)) for group in choice_list.groups.all()],
        "items": [item_dict(item) for item in items],
    }


class ListProblem(Exception):
    """A change the office asked for that cannot be made; the message says why."""

    def __init__(self, message, field=None):
        super().__init__(message)
        self.field = field


def _unique_name(queryset, name, exclude=None, what="An entry"):
    clash = queryset.filter(name__iexact=name)
    if exclude is not None:
        clash = clash.exclude(pk=exclude.pk)
    if clash.exists():
        raise ListProblem(f"{what} called \"{name}\" is already in this list.", "name")


def clean_name(raw, limit=MAX_NAME, what="the name"):
    name = tidy(raw)
    if not name:
        raise ListProblem(f"Type {what}.", "name")
    if len(name) > limit:
        raise ListProblem(f"Keep {what} under {limit} characters.", "name")
    return name


def _address(data):
    address = {}
    for key, field in ADDRESS_FIELDS.items():
        if key in data:
            value = tidy(data.get(key))
            if len(value) > MAX_ADDRESS:
                raise ListProblem(f"Keep each address line under {MAX_ADDRESS} characters.", key)
            address[field] = value
    if address.get("country") and address["country"] not in COUNTRIES:
        raise ListProblem("Choose a country from the list.", "country")
    if address.get("state") and address["state"] not in MALAYSIAN_STATES:
        raise ListProblem("Choose a state from the list.", "state")
    if address.get("country") not in (None, "", MALAYSIA):
        address["state"] = ""
    return address


def create_list(data, actor):
    name = clean_name(data.get("name"), MAX_LIST_NAME, "the list's name")
    _unique_name(ChoiceList.objects.all(), name, what="A list")
    return ChoiceList.objects.create(
        name=name,
        kind=ChoiceList.Kind.SIMPLE,
        description=tidy(data.get("description"))[:300],
        item_noun=tidy(data.get("itemNoun"))[:MAX_NOUN] or "Item",
        modified_by=actor,
    )


def update_list(choice_list, data, actor):
    if "name" in data:
        name = clean_name(data.get("name"), MAX_LIST_NAME, "the list's name")
        _unique_name(ChoiceList.objects.all(), name, exclude=choice_list, what="A list")
        choice_list.name = name
    if "description" in data:
        choice_list.description = tidy(data.get("description"))[:300]
    if "itemNoun" in data:
        choice_list.item_noun = tidy(data.get("itemNoun"))[:MAX_NOUN] or "Item"
    choice_list.modified_by = actor
    choice_list.save()
    return choice_list


def delete_list(choice_list):
    if choice_list.kind == ChoiceList.Kind.RECIPIENTS:
        raise ListProblem("The recipients list is built in and cannot be deleted.")
    using = _templates_using(choice_list)
    if using:
        raise ListProblem(f"{', '.join(using)} still asks a question from this list. Change that question first.")
    if choice_list.items.filter(letters__isnull=False).exists():
        raise ListProblem("Letters already used entries from this list. Hide the entries instead.")
    choice_list.delete()


def _group_code(choice_list, name):
    base = re.sub(r"[^A-Z0-9]+", "_", name.upper()).strip("_")[:30] or "PURPOSE"
    code, n = base, 2
    while choice_list.groups.filter(code=code).exists():
        code, n = f"{base}_{n}", n + 1
    return code


def create_group(choice_list, data, actor):
    if choice_list.kind != ChoiceList.Kind.RECIPIENTS:
        raise ListProblem("Only the recipients list has purposes.")
    name = clean_name(data.get("name"), MAX_LIST_NAME, "the purpose")
    _unique_name(choice_list.groups.all(), name, what="A purpose")
    last = choice_list.groups.order_by("-order").first()
    return ChoiceGroup.objects.create(
        choice_list=choice_list,
        code=_group_code(choice_list, name),
        name=name,
        name_ms=tidy(data.get("nameMs"))[:MAX_LIST_NAME],
        item_noun=tidy(data.get("itemNoun"))[:MAX_NOUN] or "Organisation",
        allow_other=bool(data.get("allowOther", True)),
        order=(last.order + 1) if last else 0,
        modified_by=actor,
    )


def update_group(group, data, actor):
    if "name" in data:
        name = clean_name(data.get("name"), MAX_LIST_NAME, "the purpose")
        _unique_name(group.choice_list.groups.all(), name, exclude=group, what="A purpose")
        group.name = name
    if "nameMs" in data:
        group.name_ms = tidy(data.get("nameMs"))[:MAX_LIST_NAME]
    if "itemNoun" in data:
        group.item_noun = tidy(data.get("itemNoun"))[:MAX_NOUN] or "Organisation"
    if "allowOther" in data:
        group.allow_other = bool(data.get("allowOther"))
    if "hidden" in data:
        group.hidden = bool(data.get("hidden"))
    group.modified_by = actor
    group.save()
    return group


def delete_group(group):
    if GeneratedLetter.objects.filter(request_details__purpose=group.code).exists():
        raise ListProblem("Letters were already asked for with this purpose. Hide it instead.")
    if group.items.exists():
        raise ListProblem("Delete or move its entries first, or hide the purpose instead.")
    group.delete()


def _group_for(choice_list, group_id):
    if choice_list.kind != ChoiceList.Kind.RECIPIENTS:
        return None
    group = choice_list.groups.filter(pk=group_id).first() if str(group_id or "").isdigit() else None
    if group is None:
        raise ListProblem("Choose the purpose this entry belongs to.", "groupId")
    return group


def create_items(choice_list, data, actor):
    """Add one entry, or many pasted one per line. Returns ``(created, skipped)``,
    where skipped are names already in the list."""
    group = _group_for(choice_list, data.get("groupId"))
    siblings = choice_list.items.filter(group=group)
    if "names" in data:
        raw = data.get("names")
        lines = raw if isinstance(raw, list) else str(raw or "").splitlines()
        names = list(dict.fromkeys(tidy(line) for line in lines if tidy(line)))
        if not names:
            raise ListProblem("Paste at least one name, one per line.", "names")
        if len(names) > MAX_PASTE:
            raise ListProblem(f"Paste at most {MAX_PASTE} names at a time.", "names")
        too_long = next((name for name in names if len(name) > MAX_NAME), None)
        if too_long:
            raise ListProblem(f"Keep each name under {MAX_NAME} characters: \"{too_long[:40]}…\"", "names")
        entries = [{"name": name} for name in names]
    else:
        entries = [{**data, "name": clean_name(data.get("name"))}]
    existing = {name.casefold() for name in siblings.values_list("name", flat=True)}
    last = siblings.order_by("-order").first()
    order = (last.order + 1) if last else 0
    created, skipped = [], []
    for entry in entries:
        if entry["name"].casefold() in existing:
            skipped.append(entry["name"])
            continue
        created.append(
            ChoiceItem.objects.create(
                choice_list=choice_list,
                group=group,
                name=entry["name"],
                name_ms=tidy(entry.get("nameMs"))[:MAX_NAME],
                order=order,
                modified_by=actor,
                **(_address(entry) if choice_list.kind == ChoiceList.Kind.RECIPIENTS else {}),
            )
        )
        existing.add(entry["name"].casefold())
        order += 1
    if not created and "names" not in data:
        raise ListProblem(f"An entry called \"{entries[0]['name']}\" is already in this list.", "name")
    return created, skipped


def update_item(item, data, actor):
    if "groupId" in data and item.choice_list.kind == ChoiceList.Kind.RECIPIENTS:
        group = _group_for(item.choice_list, data.get("groupId"))
        if group != item.group:
            item.group = group
            last = item.choice_list.items.filter(group=group).order_by("-order").first()
            item.order = (last.order + 1) if last else 0
    if "name" in data:
        name = clean_name(data.get("name"))
        _unique_name(item.choice_list.items.filter(group=item.group), name, exclude=item)
        item.name = name
    if "nameMs" in data:
        item.name_ms = tidy(data.get("nameMs"))[:MAX_NAME]
    if "hidden" in data:
        item.hidden = bool(data.get("hidden"))
    if item.choice_list.kind == ChoiceList.Kind.RECIPIENTS:
        for field, value in _address(data).items():
            setattr(item, field, value)
    item.modified_by = actor
    item.save()
    return item


def delete_item(item):
    used = item.letters.count()
    if used:
        raise ListProblem(f"{used} letter{'s' if used != 1 else ''} used this entry. Hide it instead.")
    item.delete()


def reorder(choice_list, data):
    """Put groups, or the items of one group, in the order given by their ids."""
    if "groupIds" in data:
        rows = {str(group.pk): group for group in choice_list.groups.all()}
        ids = [str(i) for i in data.get("groupIds") or []]
    else:
        group = _group_for(choice_list, data.get("groupId")) if choice_list.kind == ChoiceList.Kind.RECIPIENTS else None
        rows = {str(item.pk): item for item in choice_list.items.filter(group=group)}
        ids = [str(i) for i in data.get("itemIds") or []]
    if sorted(ids) != sorted(rows):
        raise ListProblem("The list changed while you were ordering it. Refresh and try again.")
    for order, pk in enumerate(ids):
        row = rows[pk]
        if row.order != order:
            row.order = order
            row.save(update_fields=["order"])


def recipient_options(purposes=None):
    """The visible purposes, with their visible organisations and saved addresses,
    for a student's form. ``purposes`` keeps only those codes when given."""
    recipients = recipients_list()
    if recipients is None:
        return []
    groups = recipients.groups.filter(hidden=False)
    if purposes:
        groups = groups.filter(code__in=purposes)
    return [
        {
            "code": group.code,
            "label": group.name,
            "organisationLabel": group.item_noun,
            "allowOther": group.allow_other,
            "organisations": [
                {"id": str(item.pk), "name": item.name, **item.address()}
                for item in group.items.filter(hidden=False)
            ],
        }
        for group in groups
    ]


def simple_list_options(list_id):
    """The visible entries of a simple list, for a "Choose from a list" question."""
    choice_list = ChoiceList.objects.filter(pk=list_id, kind=ChoiceList.Kind.SIMPLE).first()
    if choice_list is None:
        return None
    return {
        "id": str(choice_list.pk),
        "name": choice_list.name,
        "itemNoun": choice_list.item_noun,
        "items": [{"id": str(item.pk), "name": item.name} for item in choice_list.items.filter(hidden=False)],
    }
