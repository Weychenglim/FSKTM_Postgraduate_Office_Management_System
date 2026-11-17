"""Password rules on top of Django's own: not built from the person's own
details, and a mix of letters and numbers (UC02 step 9)."""
import re
from difflib import SequenceMatcher

from django.core.exceptions import ValidationError

MAX_SIMILARITY = 0.7
_LEFTOVERS = re.compile(r"[^a-z]+")


def _letters(text):
    return _LEFTOVERS.sub("", (text or "").lower())


def _personal_details(user):
    details = [user.full_name, (user.email or "").split("@")[0]]
    for profile, field in (("student", "matric_no"), ("office_staff", "staff_no"), ("lecturer", "staff_no")):
        record = user._related_or_none(profile) if hasattr(user, "_related_or_none") else getattr(user, profile, None)
        if record is not None:
            details.append(getattr(record, field, ""))
    return [detail for detail in details if detail]


class PersonalDetailsValidator:
    """Refuses a password made from the person's name, email name or ID."""

    def validate(self, password, user=None):
        if user is None:
            return
        typed = (password or "").lower()
        letters = _letters(password)
        for detail in _personal_details(user):
            lowered = detail.lower()
            whole = _letters(detail)
            parts = [part for part in re.split(r"[^a-z0-9]+", lowered) if len(part) >= 4]
            if lowered and lowered in typed:
                break
            if len(whole) >= 4 and (whole in letters or SequenceMatcher(a=letters, b=whole).ratio() >= MAX_SIMILARITY):
                break
            if any(part in typed and len(part) * 2 >= len(letters) for part in parts):
                break
        else:
            return
        raise ValidationError("Your password is too close to your name, email or ID.", code="password_too_personal")

    def get_help_text(self):
        return "Your password can't be close to your name, email or ID."


class LettersAndNumbersValidator:
    """Asks for at least one letter and one number."""

    def validate(self, password, user=None):
        text = password or ""
        if not (re.search(r"[A-Za-z]", text) and re.search(r"\d", text)):
            raise ValidationError("Use both letters and numbers.", code="password_needs_letters_and_numbers")

    def get_help_text(self):
        return "Use both letters and numbers."
