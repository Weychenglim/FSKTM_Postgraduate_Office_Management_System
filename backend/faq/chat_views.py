"""Chatbot API (UC28), mounted under ``/api/faq/``.

Students and programme coordinators ask; the office tries questions out
without saving them. Lecturers have no FAQ menu, so they are refused.
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import FileResponse
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from .chat import ChatRefused, ask, give_feedback, open_entry, start_screen, try_question
from .encoder import search_mode
from .models import FaqDocument, FaqEntry, FaqVector
from .views import require_office

User = get_user_model()
ASKERS = (User.Role.STUDENT,)


class FaqAskRateThrottle(SimpleRateThrottle):
    """Questions per person, so one account cannot flood the search."""

    scope = "faq_ask"

    def get_rate(self):
        return settings.FAQ_ASK_THROTTLE_RATE

    def get_cache_key(self, request, view):
        if getattr(request.user, "role", None) not in ASKERS:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


def require_asker(request):
    if getattr(request.user, "role", None) not in ASKERS:
        raise PermissionDenied("The FAQ chatbot is for students.")


class AskSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    entryId = serializers.CharField(max_length=20, required=False)
    questionId = serializers.CharField(max_length=20, required=False)
    token = serializers.CharField(max_length=300, required=False)


class FeedbackSerializer(serializers.Serializer):
    questionId = serializers.CharField(max_length=20)
    token = serializers.CharField(max_length=300)
    helpful = serializers.BooleanField()


def _refused(exc):
    return Response({"error": str(exc)}, status=exc.status)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def start_view(request):
    """Topics, common questions and the contact text for the start screen."""
    if getattr(request.user, "role", None) != User.Role.OFFICE_ADMIN:
        require_asker(request)
    return Response(start_screen())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([FaqAskRateThrottle])
def ask_view(request):
    """A typed question, or an entry the student picked from a choice."""
    require_asker(request)
    serializer = AskSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        if data.get("entryId"):
            return Response(open_entry(data["entryId"], question_id=data.get("questionId"), token=data.get("token")))
        return Response(
            ask(
                data.get("question", ""),
                question_id=data.get("questionId"),
                token=data.get("token"),
                student=request.user.pk,
            )
        )
    except ChatRefused as exc:
        return _refused(exc)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def feedback_view(request):
    """"Did this help?" for an answer the student was given."""
    require_asker(request)
    serializer = FeedbackSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        return Response(give_feedback(data["questionId"], data["token"], data["helpful"]))
    except ChatRefused as exc:
        return _refused(exc)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def try_view(request):
    """What a student would see for a question. Nothing is saved."""
    require_office(request)
    serializer = AskSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        return Response(try_question(serializer.validated_data.get("question", "")))
    except ChatRefused as exc:
        return _refused(exc)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_status_view(request):
    """Whether the meaning search is working, for the office screen."""
    require_office(request)
    mode = search_mode()
    return Response(
        {
            "mode": mode,
            "model": settings.FAQ_MODEL if mode == "hybrid" else "",
            "published": FaqEntry.objects.published().count(),
            "documents": FaqDocument.objects.filter(status=FaqDocument.Status.READY, archived=False).count(),
            "vectors": FaqVector.objects.filter(model_name=settings.FAQ_MODEL).count(),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def document_file_view(request, document_id):
    """A reference document, for the office, or for a student opening the
    document a passage came from (only while it is ready and not archived)."""
    documents = FaqDocument.objects.all()
    if getattr(request.user, "role", None) != User.Role.OFFICE_ADMIN:
        require_asker(request)
        documents = documents.filter(status=FaqDocument.Status.READY, archived=False)
    document = documents.filter(pk=document_id).first()
    if document is None:
        return Response({"error": "This document is not available."}, status=status.HTTP_404_NOT_FOUND)
    try:
        handle = document.file.open("rb")
    except (FileNotFoundError, OSError):
        return Response({"error": "File not found. Please tell the PG office."}, status=status.HTTP_404_NOT_FOUND)
    response = FileResponse(handle, as_attachment=True, filename=document.original_name, content_type=document.content_type)
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
