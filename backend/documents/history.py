"""The office's history of files, in plain words."""
from django.db.models import Q

from .models import Document, DocumentEvent

Action = DocumentEvent.Action
OPENED = (Action.PREVIEWED, Action.DOWNLOADED)

SHOWS = {
    "all": None,
    "uploads": (Action.UPLOADED,),
    "changes": (Action.VERSION_ADDED, Action.DETAILS_CHANGED, Action.SHARING_CHANGED),
    "archive": (Action.ARCHIVED, Action.RESTORED),
    "deleted": (Action.DELETED,),
    "opened": OPENED,
}

FIELD_WORDS = {
    "title": "title",
    "description": "note",
    "semester": "semester",
    "tags": "tags",
    "students": "students",
}
SHARE_WORDS = {"supervisors": "supervisors", "panel": "panel member", "coordinator": "programme coordinator"}


def _changed_fields(fields):
    fields = list(fields)
    ordered = [field for field in FIELD_WORDS if field in fields] + [field for field in fields if field not in FIELD_WORDS]
    words = list(dict.fromkeys(FIELD_WORDS.get(field, field) for field in ordered))
    if not words:
        return ""
    return "Changed " + (words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1])


def _sharing_words(sharing):
    if "audience" in sharing:
        audience = Document.Audience(sharing["audience"]).label if sharing.get("audience") in Document.Audience.values else ""
        programmes = sharing.get("programmes") or []
        return f"{audience}{' in ' + ', '.join(programmes) if programmes else ''}"
    picked = [SHARE_WORDS[key] for key in SHARE_WORDS if sharing.get(key)]
    return ", ".join(picked) if picked else "the PG office only"


def event_detail(event):
    details = event.details or {}
    if event.action == Action.DELETED:
        students = ", ".join(f"{s.get('name')} ({s.get('matric')})" for s in details.get("students") or [])
        parts = [details.get("type") or "", students, f"uploaded by {details['uploadedBy']}" if details.get("uploadedBy") else ""]
        return " · ".join(part for part in parts if part)
    if event.action == Action.DETAILS_CHANGED:
        return _changed_fields(details.keys())
    if event.action == Action.SHARING_CHANGED and isinstance(details.get("after"), dict):
        return f"Now shared with {_sharing_words(details['after'])}"
    if event.action in (Action.VERSION_ADDED, Action.PREVIEWED, Action.DOWNLOADED) and event.version_number:
        return f"Version {event.version_number}"
    return ""


def event_dict(event):
    return {
        "id": f"d{event.pk}",
        "action": event.action,
        "actionLabel": event.get_action_display(),
        "reference": event.reference,
        "title": event.title,
        "documentId": event.document_id,
        "actor": event.actor_name or "Someone",
        "reason": event.reason,
        "detail": event_detail(event),
        "at": event.created_at.isoformat(),
    }


def history_rows(show, text):
    """(queryset, row formatter) for one choice of what to show."""
    rows = DocumentEvent.objects.all()
    actions = SHOWS[show]
    rows = rows.exclude(action__in=OPENED) if actions is None else rows.filter(action__in=actions)
    if text:
        rows = rows.filter(Q(reference__icontains=text) | Q(title__icontains=text) | Q(actor_name__icontains=text))
    return rows, event_dict


def file_history(document, limit=50):
    events = document.events.exclude(action__in=OPENED).order_by("-created_at", "-pk")[:limit]
    return [event_dict(event) for event in events]
