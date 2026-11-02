from . import coordinator_workspace_views, panel_workspace
from django.urls import include, path

from . import views, co_supervision_views, section_a_views, supervisor_replacement_views, research_intent_views

urlpatterns = [
    path("coordinator-workspace/", include("appointments.coordinator_workspace_views")),
    path("office-workspace/", include((coordinator_workspace_views.office_urlpatterns, "office_workspace"))),
    path("capacity-reassessments/", include("appointments.capacity_reassessment_urls")),
    path("research-amendments/", include("appointments.amendment_urls")),
    path("co-supervisor/", co_supervision_views.workspace_view),
    path("co-supervisor/students/<int:student_id>/", co_supervision_views.team_view),
    path(
        "co-supervisor/students/<int:student_id>/candidates/",
        co_supervision_views.candidates_view,
    ),
    path("co-supervisor/nominations/", co_supervision_views.nominations_view),
    path(
        "co-supervisor/nominations/<int:pk>/<str:action>/",
        co_supervision_views.decision_view,
    ),
    path("co-supervisor/appointments/<int:pk>/end/", co_supervision_views.end_view),
    path("supervisor/", views.supervisor_records_view),
    path("supervisor/my-appointments/history/", co_supervision_views.own_appointment_history_view),
    path("supervisor/workload/", views.supervisor_workload_view),
    path(
        "supervisor/my-workload/",
        views.own_supervisor_workload_view,
    ),
    path("supervisor/candidates/", views.supervisor_candidates_view),
    path("supervisor/document-requirements/setup/", views.supervisor_document_setup_view),
    path("supervisor/appointments/<int:pk>/replacement/", supervisor_replacement_views.replacement_view),
    path(
        "supervisor/document-requirements/active/",
        views.active_supervisor_document_requirements_view,
    ),
    path(
        "supervisor/document-requirements/audits/",
        views.supervisor_document_requirement_audits_view,
    ),
    path(
        "supervisor/document-requirements/",
        views.supervisor_document_requirements_view,
    ),
    path(
        "supervisor/document-requirements/<int:pk>/",
        views.supervisor_document_requirement_detail_view,
    ),
    path("supervisor/applications/", views.supervisor_applications_view),
    path("supervisor/application-prefill/", section_a_views.application_prefill_view),
    path("supervisor/application-contact/", section_a_views.application_contact_view),
    path("supervisor/application-draft/", research_intent_views.application_draft_view),
    path("supervisor/applications/<int:pk>/research-intent/", research_intent_views.application_research_intent_view),
    path("supervisor/applications/<int:pk>/section-a/", section_a_views.application_section_a_view),
    path(
        "supervisor/appointments/<int:pk>/end/",
        views.end_supervisor_appointment_view,
    ),
    path(
        "supervisor/applications/<int:pk>/",
        views.supervisor_application_detail_view,
    ),
    path(
        "supervisor/applications/<int:pk>/documents/<int:document_pk>/download/",
        views.supervisor_application_document_download_view,
    ),
    path(
        "supervisor/applications/<int:pk>/cancel/",
        views.cancel_supervisor_application_view,
    ),
    path("supervisor/requests/", views.supervisor_requests_view),
    path("supervisor/supervisees/", views.active_supervisees_view),
    path("supervisor/request-history/", views.supervisor_request_history_view),
    path("supervisor/coordinator-queue/", views.supervisor_coordinator_queue_view),
    path("supervisor/coordinator-history/", views.supervisor_coordinator_history_view),
    path("supervisor/coordinator-records/", views.supervisor_coordinator_records_view),
    path(
        "supervisor/applications/<int:pk>/supervisor-accept/",
        views.supervisor_accept_view,
    ),
    path(
        "supervisor/applications/<int:pk>/supervisor-reject/",
        views.supervisor_reject_view,
    ),
    path(
        "supervisor/applications/<int:pk>/coordinator-approve/",
        views.supervisor_coordinator_approve_view,
    ),
    path(
        "supervisor/applications/<int:pk>/coordinator-reject/",
        views.supervisor_coordinator_reject_view,
    ),
    path("panel/", views.panel_records_view),
    path("panel/records/<str:record_id>/", views.panel_record_detail_view),
    path("panel/attention/summary/", panel_workspace.summary_view),
    path("panel/attention/", panel_workspace.attention_view),
    path(
        "panel/appointments/<int:pk>/end/",
        views.end_panel_appointment_view,
    ),
    path("panel/appointments/<int:pk>/", views.panel_appointment_detail_view),
    path("panel/workload/", views.panel_workload_view),
    path("panel/my-workload/", views.own_panel_workload_view),
    path("panel/eligible-supervisees/", views.eligible_supervisees_view),
    path("panel/candidates/", views.panel_candidates_view),
    path("panel/student/", views.student_panel_appointment_view),
    path("panel/recommendations/", views.recommendations_view),
    path(
        "panel/recommendations/<int:pk>/",
        views.panel_recommendation_detail_view,
    ),
    path("panel/review-queue/", views.review_queue_view),
    path("panel/coordinator-queue/", views.coordinator_queue_view),
    path("panel/coordinator-workspace/", views.coordinator_workspace_view),
    path("panel/review-history/", views.review_history_view),
    path("panel/recommendations/<int:pk>/panel-accept/", views.panel_accept_view),
    path("panel/recommendations/<int:pk>/panel-reject/", views.panel_reject_view),
    path(
        "panel/recommendations/<int:pk>/cancel/",
        views.cancel_panel_recommendation_view,
    ),
    path(
        "panel/recommendations/<int:pk>/coordinator-approve/",
        views.coordinator_approve_view,
    ),
    path(
        "panel/recommendations/<int:pk>/coordinator-reject/",
        views.coordinator_reject_view,
    ),
    path("panel/assignments/", views.assignments_view),
]
