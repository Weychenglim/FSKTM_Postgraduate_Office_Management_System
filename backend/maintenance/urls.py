"""Portal maintenance routes, mounted under /api/maintenance/."""
from django.urls import path

from . import views

urlpatterns = [
    path("", views.status_view, name="maintenance-status"),
    path("manage/", views.manage_view, name="maintenance-manage"),
    path("manage/end/", views.end_view, name="maintenance-end"),
]
