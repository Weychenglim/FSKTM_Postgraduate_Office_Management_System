"""Project URL configuration."""
from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse


def health(_request):
    return JsonResponse({"status": "ok", "service": "fsktm-pg-office-api"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/registry/", include("accounts.registry_urls")),
    path("api/accounts/coordinator-delegations/", include("accounts.delegation_urls")),
    path("api/accounts/participants/", include("accounts.participant_urls")),
    path("api/academics/", include("academics.urls")),
    path("api/appointments/", include("appointments.urls")),
    path("api/dashboard/", include("dashboard.urls")),
    path("api/marks/", include("marks.urls")),
    path("api/letter-templates/", include("letters.urls")),
    path("api/letters/", include("letters.request_urls")),
    path("api/documents/", include("documents.urls")),
    path("api/faq/", include("faq.urls")),
    path("api/maintenance/", include("maintenance.urls")),
    path("api/", include("announcements.urls")),
]
