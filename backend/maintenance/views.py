"""Whether the portal is planned to go, or is, under maintenance. Anyone can ask,
signed in or not; the technical administrator changes it in Django admin."""
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from . import state


@require_GET
def status_view(request):
    response = JsonResponse(state.public_dict())
    response["Cache-Control"] = "no-store"
    return response
