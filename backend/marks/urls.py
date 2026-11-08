from django.urls import path

from . import views


urlpatterns = [
    path('export/', views.export_mark_records_view),
    path("periods/<int:pk>/closure-preview/", views.period_closure_preview_view),
    path("tasks/<int:pk>/completion-windows/", views.completion_window_history_view),
    path("completion-windows/", views.completion_window_grant_view),
    path("completion-windows/<int:pk>/revoke/", views.completion_window_revoke_view),
    path("", views.mark_records_view),
    path("records/<str:record_id>/", views.mark_record_detail_view),
    path("records/<str:record_id>/correct/", views.correct_mark_record_view),
    path("records/<str:record_id>/reopen/", views.reopen_mark_record_view),
    path("periods/", views.evaluation_periods_view),
    path("programme-options/", views.evaluation_programme_options_view),
    path("periods/<int:pk>/recipient-preview/", views.evaluation_recipient_preview_view),
    path("periods/<int:pk>/", views.evaluation_period_detail_view),
    path(
        "periods/<int:pk>/publish/",
        views.publish_evaluation_period_view,
    ),
    path("periods/<int:pk>/close/", views.close_evaluation_period_view),
    path("periods/<int:pk>/archive/", views.archive_evaluation_period_view),
    path("rubrics/", views.rubrics_view),
    path("rubrics/<int:pk>/", views.rubric_detail_view),
    path("rubrics/<int:pk>/archive/", views.rubric_family_archive_view),
    path("rubrics/<int:pk>/clone/", views.clone_rubric_view),
    path(
        "rubrics/<int:pk>/components/",
        views.create_rubric_component_view,
    ),
    path(
        "rubrics/<int:pk>/components/<int:component_pk>/",
        views.rubric_component_detail_view,
    ),
    path("assignment-options/", views.assignment_options_view),
    path("rubric-components/", views.rubric_components_view),
    path("evaluation-tasks/", views.evaluation_preview_tasks_view),
    path("my-evaluation-tasks/", views.my_evaluation_tasks_view),
    path("my-submitted-evaluations/", views.my_submitted_evaluations_view),
    path("periods/<int:pk>/generate-tasks/", views.generate_period_tasks_view),
    path("periods/<int:pk>/manual-overrides/", views.manual_override_task_view),
    path("tasks/<int:pk>/draft/", views.save_draft_view),
    path("tasks/<int:pk>/submit/", views.submit_marks_view),
]
