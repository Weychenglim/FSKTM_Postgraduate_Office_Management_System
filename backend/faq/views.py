"""FAQ knowledge base API (UC29), mounted under ``/api/faq/``.

Managing entries and categories is for Office Staff/Admin only. The read
shape matches the frontend ``FaqEntry`` type.
"""
from datetime import date

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .entries import (
    TRANSITIONS,
    FaqRefused,
    change_status,
    create_entry,
    delete_entry,
    edit_entry,
    entry_dict,
)
from .models import FaqCategory, FaqDocument, FaqEntry, FaqSettings
from .questions import month_start, question_stats, review_questions, waiting_groups
from .references import add_document, document_dict, rename_document, replace_document, set_archived
from .review_export import review_workbook

User = get_user_model()

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def require_office(request):
    if getattr(request.user, "role", None) != User.Role.OFFICE_ADMIN:
        raise PermissionDenied("Only Office Staff/Admin may manage the FAQ.")


def refused(exc):
    body = {key: message if key == "error" else [message] for key, message in exc.errors.items()}
    return Response(body, status=exc.status)


class EntryInputSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=500, allow_blank=True, required=False)
    answer = serializers.CharField(max_length=5000, allow_blank=True, required=False, trim_whitespace=False)
    category = serializers.CharField(max_length=20, required=False)
    portalLink = serializers.ChoiceField(choices=["", *FaqEntry.PortalLink.values], required=False)
    altQuestions = serializers.ListField(
        child=serializers.CharField(max_length=500, allow_blank=True), required=False, max_length=50
    )

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            unknown = sorted(set(data.keys()) - set(self.fields))
            if unknown:
                raise serializers.ValidationError(
                    {key: ["Use Publish, Archive or Restore to change this." if key == "status" else "This field cannot be changed here."] for key in unknown}
                )
        return super().to_internal_value(data)


class EntryCreateSerializer(EntryInputSerializer):
    publish = serializers.BooleanField(required=False, default=False)


def _page_number(value, default, upper=None):
    number = int(value) if value not in (None, "") else default
    if number < 1:
        raise ValueError
    return min(number, upper) if upper else number


def _entries(params):
    this_month = Q(asked__asked_at__gte=month_start())
    entries = FaqEntry.objects.select_related("category", "updated_by").annotate(
        alt_count=Count("alt_questions", distinct=True),
        asked_this_month=Count("asked", filter=this_month, distinct=True),
        not_helpful_this_month=Count("asked", filter=this_month & Q(asked__helpful=False), distinct=True),
    )
    search = (params.get("search") or "").strip()
    if search:
        entries = entries.filter(
            Q(question__icontains=search) | Q(answer__icontains=search) | Q(alt_questions__text__icontains=search)
        ).distinct()
    category = (params.get("category") or "").strip()
    if category:
        entries = entries.filter(category_id=category if category.isdigit() else 0)
    return entries


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def entries_view(request):
    """The office's list of entries, or a new entry."""
    require_office(request)
    if request.method == "POST":
        serializer = EntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        publish = data.pop("publish")
        try:
            entry = create_entry(actor=request.user, data=data, publish=publish)
        except FaqRefused as exc:
            return refused(exc)
        return Response(entry_dict(entry, detail=True), status=status.HTTP_201_CREATED)

    entry_status = (request.query_params.get("status") or "").strip().upper()
    if entry_status and entry_status not in FaqEntry.Status.values:
        return Response({"error": "Choose Published, Draft, Needs checking or Archived."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        page = _page_number(request.query_params.get("page"), 1)
        page_size = _page_number(request.query_params.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    except ValueError:
        return Response({"error": "Page and page size must be whole numbers from 1."}, status=status.HTTP_400_BAD_REQUEST)

    matching = _entries(request.query_params)
    counts = {value: 0 for value in FaqEntry.Status.values}
    for row in matching.order_by().values("status").annotate(total=Count("pk", distinct=True)):
        counts[row["status"]] = row["total"]
    if entry_status:
        matching = matching.filter(status=entry_status)
    start = (page - 1) * page_size
    return Response(
        {
            "count": matching.count(),
            "page": page,
            "pageSize": page_size,
            "statusCounts": counts,
            "results": [entry_dict(entry) for entry in matching[start : start + page_size]],
        }
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def entry_detail_view(request, entry_id):
    require_office(request)
    try:
        if request.method == "GET":
            entry = (
                FaqEntry.objects.select_related("category", "updated_by", "checked_by")
                .prefetch_related("alt_questions", "changes")
                .filter(pk=entry_id)
                .first()
            )
            if entry is None:
                return Response({"error": "No such entry."}, status=status.HTTP_404_NOT_FOUND)
            return Response(entry_dict(entry, detail=True))
        if request.method == "DELETE":
            delete_entry(actor=request.user, entry_id=entry_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = EntryInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        entry = edit_entry(actor=request.user, entry_id=entry_id, data=serializer.validated_data)
    except FaqRefused as exc:
        return refused(exc)
    return Response(entry_dict(FaqEntry.objects.get(pk=entry.pk), detail=True))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def entry_step_view(request, entry_id, step):
    """Publish, mark as checked, archive or restore an entry."""
    require_office(request)
    if step not in TRANSITIONS:
        return Response({"error": "No such action."}, status=status.HTTP_404_NOT_FOUND)
    try:
        entry = change_status(actor=request.user, entry_id=entry_id, step=step)
    except FaqRefused as exc:
        return refused(exc)
    return Response(entry_dict(FaqEntry.objects.get(pk=entry.pk), detail=True))


def category_dict(category, counts=None):
    data = {"id": str(category.pk), "name": category.name, "position": category.position}
    if counts is not None:
        data["entries"] = counts
    return data


class CategorySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    position = serializers.IntegerField(min_value=0, required=False)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def categories_view(request):
    require_office(request)
    if request.method == "POST":
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"].strip()
        if FaqCategory.objects.filter(name__iexact=name).exists():
            return Response({"name": ["There is already a category with this name."]}, status=status.HTTP_400_BAD_REQUEST)
        last = FaqCategory.objects.order_by("-position").values_list("position", flat=True).first() or 0
        try:
            with transaction.atomic():
                category = FaqCategory.objects.create(name=name, position=serializer.validated_data.get("position", last + 1))
        except IntegrityError:
            return Response({"name": ["There is already a category with this name."]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(category_dict(category, {}), status=status.HTTP_201_CREATED)
    totals = {}
    for row in FaqEntry.objects.values("category_id", "status").annotate(total=Count("pk")):
        totals.setdefault(row["category_id"], {})[row["status"]] = row["total"]
    return Response([category_dict(category, totals.get(category.pk, {})) for category in FaqCategory.objects.all()])


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def category_detail_view(request, category_id):
    require_office(request)
    category = FaqCategory.objects.filter(pk=category_id).first()
    if category is None:
        return Response({"error": "No such category."}, status=status.HTTP_404_NOT_FOUND)
    serializer = CategorySerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    name = serializer.validated_data.get("name", category.name).strip()
    if FaqCategory.objects.filter(name__iexact=name).exclude(pk=category.pk).exists():
        return Response({"name": ["There is already a category with this name."]}, status=status.HTTP_400_BAD_REQUEST)
    category.name = name
    category.position = serializer.validated_data.get("position", category.position)
    category.save()
    return Response(category_dict(category))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def review_list_view(request):
    """The entries that need checking, as an Excel file for the office."""
    require_office(request)
    content, _ = review_workbook(include_all=request.query_params.get("all") == "1")
    response = HttpResponse(content, content_type=XLSX)
    response["Content-Disposition"] = f'attachment; filename="faq-review-{date.today().isoformat()}.xlsx"'
    return response


class ReviewSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.CharField(max_length=20), min_length=1, max_length=500)
    action = serializers.ChoiceField(choices=["add", "create", "dismiss"])
    entryId = serializers.CharField(max_length=20, required=False)
    text = serializers.CharField(max_length=300, required=False, allow_blank=True)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def questions_view(request):
    """Questions the chatbot could not answer, or that did not help, grouped."""
    require_office(request)
    if request.query_params.get("only") == "stats":
        return Response({"stats": question_stats()})
    return Response({"stats": question_stats(), "groups": waiting_groups()})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def questions_review_view(request):
    require_office(request)
    serializer = ReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        settled = review_questions(
            actor=request.user, ids=data["ids"], action=data["action"], entry_id=data.get("entryId"), text=data.get("text", "")
        )
    except FaqRefused as exc:
        return refused(exc)
    return Response({"settled": settled, "stats": question_stats()})


class SettingsSerializer(serializers.Serializer):
    contactText = serializers.CharField(max_length=1000, required=False)
    commonQuestions = serializers.ListField(
        child=serializers.CharField(max_length=300, allow_blank=True), required=False, max_length=4
    )


def settings_dict(chatbot):
    return {
        "contactText": chatbot.contact_text,
        "commonQuestions": chatbot.common_questions,
        "updatedBy": chatbot.updated_by.full_name if chatbot.updated_by else "",
        "updatedAt": chatbot.updated_at.isoformat(),
    }


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def chatbot_settings_view(request):
    """The contact text shown on no match, and the common questions on the start screen."""
    require_office(request)
    chatbot = FaqSettings.load()
    if request.method == "PATCH":
        serializer = SettingsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "contactText" in data:
            chatbot.contact_text = data["contactText"].strip()
        if "commonQuestions" in data:
            chatbot.common_questions = [" ".join(text.split()) for text in data["commonQuestions"] if text.strip()]
        chatbot.updated_by = request.user
        chatbot.save()
    return Response(settings_dict(chatbot))


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def documents_view(request):
    """The office's reference documents, or a new one (multipart: file, title)."""
    require_office(request)
    if request.method == "POST":
        try:
            document = add_document(actor=request.user, upload=request.FILES.get("file"), title=request.data.get("title", ""))
        except FaqRefused as exc:
            return refused(exc)
        return Response(document_dict(document), status=status.HTTP_201_CREATED)
    documents = FaqDocument.objects.annotate(passage_total=Count("passages"))
    return Response([document_dict(document, document.passage_total) for document in documents])


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def document_detail_view(request, document_id):
    require_office(request)
    try:
        document = rename_document(actor=request.user, document_id=document_id, title=request.data.get("title", ""))
    except FaqRefused as exc:
        return refused(exc)
    return Response(document_dict(document))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def document_step_view(request, document_id, step):
    """Archive or restore a document, or replace its file."""
    require_office(request)
    try:
        if step == "replace":
            document = replace_document(actor=request.user, document_id=document_id, upload=request.FILES.get("file"))
        elif step in ("archive", "restore"):
            document = set_archived(actor=request.user, document_id=document_id, archived=step == "archive")
        else:
            return Response({"error": "No such action."}, status=status.HTTP_404_NOT_FOUND)
    except FaqRefused as exc:
        return refused(exc)
    return Response(document_dict(document))
