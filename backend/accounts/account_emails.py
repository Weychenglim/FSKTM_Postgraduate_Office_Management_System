"""Wording of the account activation and password reset emails.

Plain text, written to the GOV.UK guidance for service emails: say why the
email was sent first, one idea per sentence, no contractions, and web
addresses in full. Each email also reminds the person how to sign in.
"""
from django.conf import settings

from .coordinator_alias import is_coordinator_account

ACTIVATION_SUBJECT = "Activate your FSKTM Postgraduate Office account"
RESET_SUBJECT = "Reset your FSKTM Postgraduate Office password"
SIGN_OFF = "Regards,\nFSKTM Postgraduate Office"


def portal_url():
    return settings.FRONTEND_URL.rstrip("/")


def _programme_words(programme):
    words = []
    for word in programme.strip().lower().split():
        if word in ("of", "and", "in") and words:
            words.append(word)
        elif word.startswith("("):
            words.append("(" + word[1:].capitalize())
        else:
            words.append(word.capitalize())
    return " ".join(words)


def _for_programme(user):
    """`` for the <programme>`` for a +coordinator account, else None."""
    if not is_coordinator_account(user):
        return None
    programme = _programme_words(user.lecturer.coordinator.programme_managed)
    return f" for the {programme}" if programme else ""


def _coordinator_note(user):
    for_programme = _for_programme(user)
    if for_programme is None:
        return None
    return (
        f"This email is about your Programme Coordinator account{for_programme}. It is "
        f"separate from your lecturer account. Sign in to it with {user.email}."
    )


def _with_note(user, paragraphs):
    note = _coordinator_note(user)
    return [paragraphs[0], note, *paragraphs[1:]] if note else paragraphs


def sign_in_identifiers(user):
    """What the sign-in page accepts for ``user``, as (label, value) pairs."""
    identifiers = [("Email", user.email)]
    if is_coordinator_account(user):
        return identifiers
    student = user._related_or_none("student")
    staff = user._related_or_none("office_staff") or user._related_or_none("lecturer")
    if student:
        identifiers.append(("Student ID (matric number)", student.matric_no))
    elif staff:
        identifiers.append(("Staff ID", staff.staff_no))
    return identifiers


def _how_to_sign_in(user, opening, password):
    identifiers = sign_in_identifiers(user)
    if len(identifiers) == 1:
        return f"{opening} using your email, {user.email}, and {password}."
    listed = "\n".join(f"- {label}: {value}" for label, value in identifiers)
    return f"{opening} using {password} and either of the following:\n{listed}"


def activation_email(user, link):
    """Subject and body inviting a new account holder to set a first password."""
    for_programme = _for_programme(user)
    paragraphs = [
        f"Dear {user.full_name},",
        "The FSKTM Postgraduate Office has created an account for you. You will use it "
        "for services such as supervisor appointments, letters and office announcements."
        if for_programme is None
        else f"The FSKTM Postgraduate Office has created a Programme Coordinator account for "
        f"you{for_programme}. It is separate from your lecturer account, which you continue "
        "to use for your lecturer work.",
        f"To start using your account, please set your password with this link:\n{link}",
        "This link does not expire. It stops working once you have set your password.",
        _how_to_sign_in(
            user,
            f"After you have set your password, you can sign in at {portal_url()}",
            "your password",
        ),
        "If you have already set your password, this link will not work. Please sign in "
        "as usual. If you have forgotten your password, select \"Forgot Password?\" on "
        "the sign-in page.",
        "If you were not expecting this email, please contact the FSKTM Postgraduate Office.",
        SIGN_OFF,
    ]
    return ACTIVATION_SUBJECT, "\n\n".join(paragraphs)


def password_reset_email(user, link):
    """Subject and body for a requested password reset."""
    minutes = settings.PASSWORD_RESET_TIMEOUT // 60
    paragraphs = [
        f"Dear {user.full_name},",
        "We received a request to reset the password for your FSKTM Postgraduate Office account.",
        f"To choose a new password, use this link:\n{link}",
        f"This link expires in {minutes} minutes and works only once. If it has expired, "
        "you can request a new one by selecting \"Forgot Password?\" on the sign-in page.",
        _how_to_sign_in(
            user,
            f"After you have changed your password, you can sign in at {portal_url()}",
            "your new password",
        ),
        "If you did not ask to reset your password, you can ignore this email. Your "
        "password will not change. If you think someone else is trying to use your "
        "account, please contact the FSKTM Postgraduate Office.",
        SIGN_OFF,
    ]
    return RESET_SUBJECT, "\n\n".join(_with_note(user, paragraphs))


EMAIL_CHANGED_SUBJECT = "The email for your FSKTM Postgraduate Office account has changed"


def email_changed_email(user, old_email):
    """Subject and body telling the old address that the office changed the
    account's email, which is also its sign-in name."""
    paragraphs = [
        f"Dear {user.full_name},",
        "We are writing to tell you that the FSKTM Postgraduate Office has changed the "
        f"email address of your account from {old_email} to {user.email}.",
        "Your password has not changed. Emails from the portal will now go to the new address.",
        _how_to_sign_in(user, f"You can sign in at {portal_url()}", "your password"),
        "If you did not expect this change, please contact the FSKTM Postgraduate Office.",
        SIGN_OFF,
    ]
    return EMAIL_CHANGED_SUBJECT, "\n\n".join(_with_note(user, paragraphs))
