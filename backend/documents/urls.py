from django.urls import path

from . import submission_views, views

urlpatterns = [
    path("submissions/", submission_views.submissions_view, name="document-submissions"),
    path("submissions/mine/", submission_views.my_submissions_view, name="document-submissions-mine"),
    path("submissions/<int:pk>/", submission_views.submission_view, name="document-submission"),
    path("submissions/<int:pk>/open/", submission_views.submission_open_view, name="document-submission-open"),
    path("submissions/<int:pk>/send/", submission_views.submission_send_view, name="document-submission-send"),
    path("submissions/<int:pk>/remind/", submission_views.submission_remind_view, name="document-submission-remind"),
    path("submissions/<int:pk>/extensions/", submission_views.submission_extensions_view, name="document-submission-extensions"),
    path("submissions/<int:pk>/extensions/<str:matric>/", submission_views.submission_extension_view, name="document-submission-extension"),
    path("", views.documents_view, name="documents"),
    path("options/", views.options_view, name="document-options"),
    path("students/", views.student_search_view, name="document-students"),
    path("students/<str:matric>/", views.student_header_view, name="document-student"),
    path("summary/", views.summary_view, name="document-summary"),
    path("download-zip/", views.download_zip_view, name="document-zip"),
    path("history/", views.history_view, name="document-history"),
    path("<int:pk>/", views.document_view, name="document-detail"),
    path("<int:pk>/download/", views.download_view, name="document-download"),
    path("<int:pk>/versions/", views.versions_view, name="document-versions"),
    path("<int:pk>/sharing/", views.sharing_view, name="document-sharing"),
    path("<int:pk>/archive/", views.archive_view, name="document-archive"),
    path("<int:pk>/restore/", views.restore_view, name="document-restore"),
    path("<int:pk>/preview/", views.preview_view, name="document-preview"),
    path("<int:pk>/preview/pages/<int:number>/", views.preview_page_view, name="document-preview-page"),
]
