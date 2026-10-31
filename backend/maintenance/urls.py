"""Portal maintenance route, mounted under /api/maintenance/."""
from django.urls import path

from . import views

urlpatterns = [
    path("", views.status_view, name="maintenance-status"),
]
