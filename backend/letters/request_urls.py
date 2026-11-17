"""Letter request routes, mounted under /api/letters/ by the project URLconf."""
from django.urls import path

from . import list_views
from . import request_views as views

urlpatterns = [
    path("requests/", views.letter_requests, name="letter-requests"),
    path("requests/counts/", views.request_counts, name="letter-request-counts"),
    path("requests/recipient-options/", views.recipient_options_view, name="letter-recipient-options"),
    path("requests/form/<int:template_id>/", views.letter_form, name="letter-request-form"),
    path("requests/<int:pk>/", views.letter_detail, name="letter-request-detail"),
    path("requests/<int:pk>/withdraw/", views.withdraw_request, name="letter-request-withdraw"),
    path("requests/<int:pk>/approve/", views.approve_request, name="letter-request-approve"),
    path("requests/<int:pk>/reject/", views.reject_request, name="letter-request-reject"),
    path("requests/<int:pk>/pdf/", views.letter_pdf, name="letter-request-pdf"),
    path("requests/<int:pk>/word/", views.letter_word, name="letter-request-word"),
    path(
        "requests/<int:pk>/resend-notification/",
        views.resend_notification,
        name="letter-request-resend-notification",
    ),
    path("requests/<int:pk>/revoke/", views.revoke_letter, name="letter-request-revoke"),
    path("requests/<int:pk>/reissue/", views.reissue, name="letter-request-reissue"),
    path("appointment-letters/missing/", views.missing_letters, name="appointment-letters-missing"),
    path("appointment-letters/create/", views.create_missing_letters, name="appointment-letters-create"),
    path("appointment-letters/received/", views.received_letters, name="appointment-letters-received"),
    path("lists/", list_views.lists_view, name="letter-lists"),
    path("lists/<int:pk>/", list_views.list_detail_view, name="letter-list-detail"),
    path("lists/<int:pk>/groups/", list_views.list_groups_view, name="letter-list-groups"),
    path("lists/<int:pk>/items/", list_views.list_items_view, name="letter-list-items"),
    path("lists/<int:pk>/order/", list_views.list_order_view, name="letter-list-order"),
    path("list-groups/<int:pk>/", list_views.group_detail_view, name="letter-list-group-detail"),
    path("list-items/<int:pk>/", list_views.item_detail_view, name="letter-list-item-detail"),
]
