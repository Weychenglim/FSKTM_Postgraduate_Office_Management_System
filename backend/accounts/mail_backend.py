"""Mail goes out through ``settings.REAL_EMAIL_BACKEND`` after each coordinator
account address is pointed at the lecturer's own inbox, so UM's mail server
never has to understand ``+coordinator``."""
from email.utils import parseaddr

from django.conf import settings
from django.core.mail import get_connection
from django.core.mail.backends.base import BaseEmailBackend

from .coordinator_alias import real_address


def _inboxes(addresses, seen):
    kept = []
    for address in addresses or []:
        real = real_address(address)
        key = parseaddr(real)[1].lower()
        if key in seen:
            continue
        seen.add(key)
        kept.append(real)
    return kept


class RealInboxBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently)
        self.inner = get_connection(settings.REAL_EMAIL_BACKEND, fail_silently=fail_silently, **kwargs)

    def open(self):
        return self.inner.open()

    def close(self):
        return self.inner.close()

    def send_messages(self, email_messages):
        for message in email_messages:
            seen = set()
            message.to = _inboxes(message.to, seen)
            message.cc = _inboxes(message.cc, seen)
            message.bcc = _inboxes(message.bcc, seen)
        return self.inner.send_messages(email_messages)
