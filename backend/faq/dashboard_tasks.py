"""Student questions the chatbot could not answer, as an office dashboard task."""
from django.contrib.auth import get_user_model

from .models import FaqQuestion
from .questions import NEEDS_A_LOOK

User = get_user_model()


def dashboard_tasks(user, now):
    if getattr(user, "role", None) != User.Role.OFFICE_ADMIN:
        return []
    count = FaqQuestion.objects.filter(NEEDS_A_LOOK, review=FaqQuestion.Review.WAITING).count()
    if not count:
        return []
    return [
        {
            "id": "faq_questions",
            "name": "Student questions to answer",
            "status": "pending",
            "statusText": f"{count} waiting",
            "target": "FAQ Chatbot",
            "targetModule": "FAQ",
            "recordType": "FAQ_QUESTIONS",
        }
    ]
