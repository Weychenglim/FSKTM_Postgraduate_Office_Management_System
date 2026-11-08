"""Notification email that follows each person's Settings switches.

- announcement: needs "Email alerts" and "Announcement alerts"
- deadline: needs "Email alerts" and "Deadline reminders"
- summary: needs "Weekly summary"
- letter: needs "Email alerts" (a decision on the person's own letter request)
- document: needs "Email alerts" (the office accepted or returned the person's file)

Sending never raises: a mail outage must not undo the in-app notification.
Pages pass ``wait=False`` so a real mail server sends in the background and
the person who clicked doesn't wait for every email.
"""
import threading

from django.conf import settings
from django.core.mail import send_mass_mail

SMTP_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

ANNOUNCEMENT = "announcement"
DEADLINE = "deadline"
SUMMARY = "summary"
LETTER = "letter"
DOCUMENT = "document"

SIGN_OFF = "Regards,\nFSKTM Postgraduate Office"


def allows(user, kind):
    if kind == ANNOUNCEMENT:
        return user.email_notifications and user.announcement_alerts
    if kind == DEADLINE:
        return user.email_notifications and user.deadline_reminders
    if kind == SUMMARY:
        return user.weekly_summary
    if kind in (LETTER, DOCUMENT):
        return user.email_notifications
    raise ValueError(f"Unknown email kind: {kind}")


def portal_link(path):
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _send(messages):
    return send_mass_mail(messages, fail_silently=True)


def email_users(users, kind, subject, message, *, wait=True):
    """Email every active user whose switches allow ``kind``. Returns how many
    were sent, or how many were handed to the background send."""
    allowed = [user for user in users if user.is_active and user.email and allows(user, kind)]
    if not allowed:
        return 0
    messages = [(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email]) for user in allowed]
    if wait or settings.EMAIL_BACKEND != SMTP_BACKEND:
        return _send(messages)
    threading.Thread(target=_send, args=(messages,), daemon=True).start()
    return len(messages)
