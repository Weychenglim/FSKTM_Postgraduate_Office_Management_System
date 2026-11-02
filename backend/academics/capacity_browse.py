"""Validated Office capacity list filters, applied before counting and paging."""

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers


class CapacityBrowseSerializer(serializers.Serializer):
    q = serializers.CharField(required=False, allow_blank=True, max_length=200)
    status = serializers.ChoiceField(required=False, choices=[
        "ALL", "DRAFT", "PUBLISHED", "SUPERSEDED", "DISCARDED",
        "CURRENT", "EFFECTIVE", "SCHEDULED", "ENDED", "CANCELLED",
    ])
    role = serializers.ChoiceField(required=False, choices=["ALL", "SUPERVISOR", "PANEL"])
    lecturerId = serializers.IntegerField(required=False, min_value=1)
    version = serializers.IntegerField(required=False, min_value=1)
    scope = serializers.ChoiceField(required=False, choices=["working"])
    pageResult = serializers.BooleanField(required=False, default=False)


def capacity_browse_filters(request, queryset, kind):
    serializer = CapacityBrowseSerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    query = data.get("q", "").strip()
    state = data.get("status", "ALL")
    if kind == "plans":
        if data.get("scope") == "working":
            queryset = queryset.filter(lifecycle_status__in=["DRAFT", "PUBLISHED"])
        if state != "ALL":
            if state not in ["DRAFT", "PUBLISHED", "SUPERSEDED", "DISCARDED"]:
                raise serializers.ValidationError({"status": "Choose a capacity version status."})
            queryset = queryset.filter(lifecycle_status=state)
        if query:
            match = Q(created_by__full_name__icontains=query) | Q(publication_reason__icontains=query)
            number = query.lower().removeprefix("version ").removeprefix("v")
            if number.isdecimal() and len(number) < 10:
                match |= Q(version=int(number))
            queryset = queryset.filter(match)
    elif kind == "availability":
        if query:
            queryset = queryset.filter(Q(lecturer__user__full_name__icontains=query) | Q(lecturer__staff_no__icontains=query))
        if data.get("lecturerId"):
            queryset = queryset.filter(lecturer_id=data["lecturerId"])
        if data.get("role", "ALL") != "ALL":
            queryset = queryset.filter(role=data["role"])
        today = timezone.localdate()
        states = {
            "CURRENT": Q(cancelled_at__isnull=True, ends_on__gte=today),
            "EFFECTIVE": Q(cancelled_at__isnull=True, starts_on__lte=today, ends_on__gte=today),
            "SCHEDULED": Q(cancelled_at__isnull=True, starts_on__gt=today),
            "ENDED": Q(cancelled_at__isnull=True, ends_on__lt=today),
            "CANCELLED": Q(cancelled_at__isnull=False),
        }
        if state != "ALL":
            if state not in states:
                raise serializers.ValidationError({"status": "Choose an availability status."})
            queryset = queryset.filter(states[state])
    else:
        if data.get("version"):
            queryset = queryset.filter(plan__version=data["version"])
        if query:
            queryset = queryset.filter(Q(actor__full_name__icontains=query) | Q(action__icontains=query.replace(" ", "_")) | Q(reason__icontains=query))
    return queryset
