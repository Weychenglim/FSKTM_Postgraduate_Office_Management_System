"""The office's history of files and settings, in plain words."""
from django.db.models import Q

from .models import Document, DocumentEvent, SettingsChange

Action = DocumentEvent.Action
OPENED = (Action.PREVIEWED, Action.DOWNLOADED)

SHOWS = {
    "all": None,
    "uploads": (Action.UPLOADED,),
    "changes": (Action.VERSION_ADDED, Action.DETAILS_CHANGED, Action.SHARING_CHANGED),
    "checks": (Action.ACCEPTED, Action.RETURNED),
    "archive": (Action.ARCHIVED, Action.RESTORED),
    "deleted": (Action.DELETED,),
    "opened": OPENED,
    "settings": None,
}

FIELD_WORDS = {
    "title": "title",
    "description": "note",
    "semester": "semester",
    "tags": "tags",
    "students": "students",
    "label": "name",
    "group": "group",
    "kind": "kind of file",
    "uploaders": "who can upload it",
    "share_supervisors": "who can see it",
    "share_panel": "who can see it",
    "share_coordinator": "who can see it",
    "needs_check": "coordinator checks",
    "one_per_student": "one file per student",
    "required": "whether every student must hand it in",
    "required_due_note": "the due note",
    "required_programmes": "the programmes that must hand it in",
    "is_active": "whether it can be chosen",
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


def settings_detail(change):
    details = change.details or {}
    if change.action == SettingsChange.Action.CHANGED:
        text = _changed_fields((details.get("changes") or {}).keys())
        updated = details.get("updatedFiles") or 0
        if updated:
            text += f"; {updated} student {'file now follows' if updated == 1 else 'files now follow'} the new sharing"
        return text
    if change.action == SettingsChange.Action.RENAMED:
        return f"From {details.get('before')}"
    if change.action == SettingsChange.Action.MERGED:
        return f"{details.get('from')} merged in, on {details.get('files', 0)} more {'file' if details.get('files') == 1 else 'files'}"
    if change.action == SettingsChange.Action.REMOVED:
        return f"Taken off {details.get('files', 0)} {'file' if details.get('files') == 1 else 'files'}"
    return ""


def settings_dict(change):
    return {
        "id": f"s{change.pk}",
        "action": f"{change.area}_{change.action}",
        "actionLabel": f"{change.get_area_display()} {change.get_action_display().lower()}",
        "reference": "",
        "title": change.label,
        "documentId": None,
        "actor": change.actor_name or "Someone",
        "reason": "",
        "detail": settings_detail(change),
        "at": change.created_at.isoformat(),
    }


def history_rows(show, text):
    """(queryset, row formatter) for one choice of what to show."""
    if show == "settings":
        rows = SettingsChange.objects.all()
        if text:
            rows = rows.filter(Q(label__icontains=text) | Q(actor_name__icontains=text))
        return rows, settings_dict
    rows = DocumentEvent.objects.all()
    actions = SHOWS[show]
    rows = rows.exclude(action__in=OPENED) if actions is None else rows.filter(action__in=actions)
    if text:
        rows = rows.filter(Q(reference__icontains=text) | Q(title__icontains=text) | Q(actor_name__icontains=text))
    return rows, event_dict


def file_history(document, limit=50):
    events = document.events.exclude(action__in=OPENED).order_by("-created_at", "-pk")[:limit]
    return [event_dict(event) for event in events]
