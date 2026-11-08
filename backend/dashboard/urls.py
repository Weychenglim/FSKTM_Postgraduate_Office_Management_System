from django.urls import path

from . import views
from .timeline_extensions import extend_timeline_entry_view
from .office_attention import office_attention_view


urlpatterns = [
    path('timeline/entries/<int:pk>/extend/', extend_timeline_entry_view),
    path("timeline/active/", views.active_timeline_view),
    path("timeline/publish/", views.publish_timeline_view),
    path("timeline/template/", views.template_view),
    path("timeline/upload/preview/", views.preview_timeline_upload_view),
    path("timeline/upload/", views.upload_timeline_view),
    path("timeline/audit-logs/", views.timeline_audit_logs_view),
    path("timeline/entries/", views.timeline_entry_list_view),
    path("timeline/entries/<int:pk>/", views.timeline_entry_detail_view),
    path("tasks/", views.dashboard_tasks_view),
    path("attention/", office_attention_view),
    path("summary/", views.dashboard_summary_view),
    path("reports/", views.workflow_report_view),
    path("reports/export/", views.workflow_report_export_view),
    path("reconciliation/", views.workflow_reconciliation_view),
    path("reconciliation/issues/<str:issue_id>/accept/", views.workflow_reconciliation_accept_view),
    path(
        "reconciliation/issues/<str:issue_id>/preview/",
        views.workflow_reconciliation_preview_view,
    ),
    path(
        "reconciliation/issues/<str:issue_id>/apply/",
        views.workflow_reconciliation_apply_view,
    ),
    path("reconciliation/audits/", views.workflow_reconciliation_audits_view),
    path(
        "progress/<str:student_id>/",
        views.student_progress_dossier_view,
    ),
]
