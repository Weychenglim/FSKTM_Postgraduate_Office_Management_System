from django.urls import path

from . import views

urlpatterns = [
    path("", views.documents_view, name="documents"),
    path("options/", views.options_view, name="document-options"),
    path("students/", views.student_search_view, name="document-students"),
    path("students/<str:matric>/", views.student_header_view, name="document-student"),
    path("summary/", views.summary_view, name="document-summary"),
    path("types/", views.types_view, name="document-types"),
    path("types/<int:pk>/", views.type_view, name="document-type"),
    path("download-zip/", views.download_zip_view, name="document-zip"),
    path("history/", views.history_view, name="document-history"),
    path("required/", views.required_view, name="document-required"),
    path("required/mine/", views.required_mine_view, name="document-required-mine"),
    path("required/<int:pk>/students/", views.required_students_view, name="document-required-students"),
    path("required/<int:pk>/remind/", views.required_remind_view, name="document-required-remind"),
    path("<int:pk>/", views.document_view, name="document-detail"),
    path("<int:pk>/download/", views.download_view, name="document-download"),
    path("<int:pk>/versions/", views.versions_view, name="document-versions"),
    path("<int:pk>/check/", views.check_view, name="document-check"),
    path("<int:pk>/sharing/", views.sharing_view, name="document-sharing"),
    path("<int:pk>/archive/", views.archive_view, name="document-archive"),
    path("<int:pk>/restore/", views.restore_view, name="document-restore"),
    path("<int:pk>/preview/", views.preview_view, name="document-preview"),
    path("<int:pk>/preview/pages/<int:number>/", views.preview_page_view, name="document-preview-page"),
]
