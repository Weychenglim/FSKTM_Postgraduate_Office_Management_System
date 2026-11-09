"""Student Registry and staff account routes, mounted under /api/registry/ by the project URLconf."""
from django.urls import path

from . import registry_actions, registry_graduation, registry_project_stages, registry_semesters, registry_views, retention, staff_views

urlpatterns = [
    path("students/", registry_views.student_records_view, name="registry-students"),
    path("programme-rules/", registry_semesters.programme_rules_view, name="registry-programme-rules"),
    path("programme-rules/<int:rule_id>/", registry_semesters.programme_rule_detail_view, name="registry-programme-rule-detail"),
    path("semester-move/", registry_semesters.semester_move_view, name="registry-semester-move"),
    path("graduation/", registry_graduation.graduation_view, name="registry-graduation"),
    path("graduation/finish/", registry_graduation.graduation_finish_view, name="registry-graduation-finish"),
    path("graduation/senate/", registry_graduation.graduation_senate_view, name="registry-graduation-senate"),
    path("graduation/return/", registry_graduation.graduation_return_view, name="registry-graduation-return"),
    path("graduation/correct/", registry_graduation.graduation_correct_view, name="registry-graduation-correct"),
    path("graduation/match-list/", registry_graduation.graduation_match_list_view, name="registry-graduation-match-list"),
    path("project-stages/", registry_project_stages.project_stages_view, name="registry-project-stages"),
    path("project-stages/impact/", registry_project_stages.project_stage_impact_view, name="registry-project-stage-impact"),
    path("project-stages/correct/", registry_project_stages.project_stage_correct_view, name="registry-project-stage-correct"),
    path("retention/", retention.retention_view, name="registry-retention"),
    path(
        "students/import/",
        registry_views.student_import_view,
        name="registry-student-import",
    ),
    path(
        "students/import/inspect/",
        registry_views.student_import_inspect_view,
        name="registry-student-import-inspect",
    ),
    path(
        "students/import/template/",
        registry_views.student_import_template_view,
        name="registry-student-import-template",
    ),
    path(
        "students/<str:matric_no>/",
        registry_views.student_record_detail_view,
        name="registry-student-detail",
    ),
    path(
        "students/<str:matric_no>/semesters/",
        registry_semesters.student_semesters_view,
        name="registry-student-semesters",
    ),
    path(
        "students/<str:matric_no>/semesters/<int:row_id>/",
        registry_semesters.student_semester_detail_view,
        name="registry-student-semester",
    ),
    path(
        "students/<str:matric_no>/status-action/",
        registry_actions.student_status_action_view,
        name="registry-student-status-action",
    ),
    path(
        "students/<str:matric_no>/graduation-check/",
        registry_graduation.student_graduation_check_view,
        name="registry-student-graduation-check",
    ),
    path(
        "students/<str:matric_no>/semester-extension/",
        registry_semesters.student_extension_view,
        name="registry-student-extension",
    ),
    path(
        "students/<str:matric_no>/send-access-link/",
        registry_views.student_access_link_view,
        name="registry-student-access-link",
    ),
    path("staff/", staff_views.staff_accounts_view, name="registry-staff"),
    path("staff/options/", staff_views.staff_options_view, name="registry-staff-options"),
    path(
        "staff/<int:account_id>/",
        staff_views.staff_account_detail_view,
        name="registry-staff-detail",
    ),
    path(
        "staff/<int:account_id>/send-link/",
        staff_views.staff_send_link_view,
        name="registry-staff-send-link",
    ),
    path(
        "staff/<int:account_id>/activation-link/",
        staff_views.staff_activation_link_view,
        name="registry-staff-activation-link",
    ),
    path(
        "staff/<int:account_id>/duties/",
        staff_views.staff_duties_view,
        name="registry-staff-duties",
    ),
    path(
        "staff/<int:account_id>/programme/",
        staff_views.staff_programme_view,
        name="registry-staff-programme",
    ),
    path(
        "staff/<int:account_id>/sign-in/",
        staff_views.staff_sign_in_view,
        name="registry-staff-sign-in",
    ),
    path(
        "staff/<int:account_id>/history/",
        staff_views.staff_history_view,
        name="registry-staff-history",
    ),
    path("imports/", registry_views.import_batches_view, name="registry-imports"),
    path(
        "imports/<int:batch_id>/send-invitations/",
        registry_views.import_batch_invitations_view,
        name="registry-import-invitations",
    ),
]
