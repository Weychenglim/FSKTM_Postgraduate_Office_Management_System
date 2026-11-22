from django.urls import path
from . import amendment_views as views

urlpatterns = [
    path('', views.collection),
    path('options/', views.options),
    path('profiles/', views.profiles),
    path('profile-link/', views.profile_link),
    path('corrections/', views.corrections),
    path('<int:pk>/', views.detail),
    path('<int:pk>/decision/', views.decision),
    path('<int:pk>/cancel/', views.cancel),
]
