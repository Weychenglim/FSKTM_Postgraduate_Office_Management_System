from rest_framework import serializers
from django.utils import timezone
from zoneinfo import ZoneInfo

from .models import SemesterTimelineEntry


def derive_entry_status(deadline_start, deadline_end):
    today = timezone.localdate(timezone=ZoneInfo("Asia/Kuala_Lumpur"))
    if today < deadline_start:
        return SemesterTimelineEntry.Status.UPCOMING
    if today > deadline_end:
        return SemesterTimelineEntry.Status.ENDED
    if deadline_start == deadline_end:
        return SemesterTimelineEntry.Status.DEADLINE
    return SemesterTimelineEntry.Status.ACTIVE


class RejectUnknownFieldsMixin:
    def to_internal_value(self, data):
        unknown_fields = set(data) - set(self.fields)
        if unknown_fields:
            raise serializers.ValidationError({
                field: ["This field is system-derived and cannot be provided."]
                for field in sorted(unknown_fields)
            })
        return super().to_internal_value(data)


class TimelineEntrySerializer(serializers.ModelSerializer):
    action = serializers.CharField(source="action_owner")
    deadlineStart = serializers.SerializerMethodField()
    deadlineEnd = serializers.SerializerMethodField()
    operationalPeriodId = serializers.IntegerField(source="operational_period_id", allow_null=True)
    marksPeriodId = serializers.IntegerField(source="marks_period_id", allow_null=True)
    weekLabel = serializers.CharField(source="week_label", allow_blank=True)
    targetRoles = serializers.JSONField(source="target_roles")
    displayOrder = serializers.IntegerField(source="display_order")
    status = serializers.SerializerMethodField()
    linkedPeriodStatus = serializers.SerializerMethodField()

    class Meta:
        model = SemesterTimelineEntry
        fields = [
            "id",
            "level",
            "step",
            "title",
            "detail",
            "action",
            "deadlineStart",
            "deadlineEnd",
            "weekLabel",
            "targetRoles",
            "status",
            "displayOrder",
            "operationalPeriodId",
            "marksPeriodId",
            "linkedPeriodStatus",
        ]

    def get_deadlineStart(self, obj):
        return obj.projected_dates[0].isoformat()

    def get_deadlineEnd(self, obj):
        return obj.projected_dates[1].isoformat()

    def get_linkedPeriodStatus(self, obj):
        period = obj.linked_period
        if not period:
            return None
        now = timezone.now()
        schedule = 'UPCOMING' if period.opens_at and now < period.opens_at else (
            'ENDED' if period.closes_at and now > period.closes_at else 'OPEN')
        enforced = None
        if obj.operational_period_id:
            from academics.models import OperationalEnforcement
            # Many linked events may share an activity: read its enforcement once.
            cache = self.context.setdefault('timeline_enforcement', {})
            key = (period.academic_semester_id, period.activity)
            if key not in cache:
                cache[key] = OperationalEnforcement.objects.filter(
                    academic_semester_id=key[0], activity=key[1], enabled=True).exists()
            enforced = cache[key]
        return {'lifecycleStatus':period.lifecycle_status,
                'scheduleStatus':schedule, 'datesEnforced':enforced}

    def get_status(self, obj):
        period = obj.linked_period
        if period:
            if period.lifecycle_status in {"CLOSED", "ARCHIVED"}:
                return SemesterTimelineEntry.Status.ENDED
            if period.lifecycle_status == "DRAFT" or (period.opens_at and timezone.now() < period.opens_at):
                return SemesterTimelineEntry.Status.UPCOMING
            if period.closes_at and timezone.now() > period.closes_at:
                return SemesterTimelineEntry.Status.ENDED
            return SemesterTimelineEntry.Status.ACTIVE
        return derive_entry_status(*obj.projected_dates)


class TimelinePeriodLinkMixin:
    def validate_period_links(self, attrs):
        from academics.models import OperationalPeriod
        from marks.models import EvaluationPeriod
        entry = self.context.get("entry")
        timeline = self.context.get("timeline") or (entry.timeline if entry else None)
        periods = {}
        for api_key, model_key, model in (
            ("operationalPeriodId", "operational_period", OperationalPeriod),
            ("marksPeriodId", "marks_period", EvaluationPeriod),
        ):
            supplied = api_key in attrs
            period_id = attrs.pop(api_key) if supplied else (
                getattr(entry, f"{model_key}_id") if entry else None
            )
            try:
                # The view already holds the owning semester lock. Re-fetch even
                # existing links so cached relations cannot bypass a period move.
                period = model.objects.select_for_update().get(pk=period_id) if period_id else None
            except model.DoesNotExist:
                raise serializers.ValidationError({api_key: "Period was not found."})
            if supplied:
                attrs[model_key] = period
            periods[model_key] = period
        linked = [period for period in periods.values() if period]
        if len(linked) > 1:
            raise serializers.ValidationError("Select only one owning period.")
        if linked:
            period = linked[0]
            if not timeline or period.academic_semester_id != timeline.academic_semester_id:
                raise serializers.ValidationError("The period must belong to the timeline semester.")
            if not period.opens_at or not period.closes_at:
                raise serializers.ValidationError("The owning period needs configured dates.")
            start = period.opens_at.astimezone(ZoneInfo("Asia/Kuala_Lumpur")).date()
            end = period.closes_at.astimezone(ZoneInfo("Asia/Kuala_Lumpur")).date()
            semester = timeline.academic_semester
            if start < semester.starts_on or end > semester.ends_on:
                raise serializers.ValidationError("Linked period dates must be within the semester.")
            for key, value in (("deadlineStart", start), ("deadlineEnd", end)):
                if key in attrs and attrs[key] != value:
                    raise serializers.ValidationError({key: "Update the owning period through its module to change linked dates."})
            # Stored values are informational snapshots; the response always projects live dates.
            attrs["deadlineStart"], attrs["deadlineEnd"] = start, end
        return attrs


class TimelineEntryUpdateSerializer(TimelinePeriodLinkMixin, RejectUnknownFieldsMixin, serializers.Serializer):
    extensionReason = serializers.CharField(required=False, max_length=2000, allow_blank=False, trim_whitespace=True)
    expectedDeadlineEnd = serializers.DateField(required=False)
    operationalPeriodId = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    marksPeriodId = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    level = serializers.ChoiceField(choices=SemesterTimelineEntry.Level.choices, required=False)
    title = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True)
    detail = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True)
    action = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True)
    deadlineStart = serializers.DateField(required=False)
    deadlineEnd = serializers.DateField(required=False)
    weekLabel = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    targetRoles = serializers.ListField(
        child=serializers.CharField(trim_whitespace=True),
        required=False,
        allow_empty=False,
    )

    def validate_targetRoles(self, value):
        normalized = [role.upper() for role in value]
        invalid = [role for role in normalized if role not in SemesterTimelineEntry.VALID_TARGET_ROLES]
        if invalid:
            raise serializers.ValidationError(f"Invalid target role(s): {', '.join(invalid)}")
        return normalized

    def validate(self, attrs):
        entry = self.context["entry"]
        attrs = self.validate_period_links(attrs)
        start = attrs.get("deadlineStart", entry.deadline_start)
        end = attrs.get("deadlineEnd", entry.deadline_end)
        if end < start:
            raise serializers.ValidationError("Deadline End cannot be before Deadline Start.")
        linked = attrs.get("operational_period", entry.operational_period_id) or attrs.get("marks_period", entry.marks_period_id)
        extending = not linked and end > entry.deadline_end
        if "expectedDeadlineEnd" in attrs and attrs["expectedDeadlineEnd"] != entry.deadline_end:
            raise serializers.ValidationError("The end date changed. Reload the event before saving.")
        if extending:
            if not attrs.get("extensionReason"):
                raise serializers.ValidationError({"extensionReason": "A reason is required when extending the end date."})
            semester = entry.timeline.academic_semester
            if end < timezone.localdate() or end > semester.ends_on or start < semester.starts_on:
                raise serializers.ValidationError("The extension must be within the semester and cannot end in the past.")
        elif "extensionReason" in attrs:
            raise serializers.ValidationError({"extensionReason": "An extension reason is only used when moving an unlinked end date later."})
        return attrs


class TimelineEntryCreateSerializer(TimelinePeriodLinkMixin, RejectUnknownFieldsMixin, serializers.Serializer):
    operationalPeriodId = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    marksPeriodId = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    semesterId = serializers.IntegerField(min_value=1, required=False)
    level = serializers.ChoiceField(choices=SemesterTimelineEntry.Level.choices)
    title = serializers.CharField(allow_blank=False, trim_whitespace=True)
    detail = serializers.CharField(allow_blank=False, trim_whitespace=True)
    action = serializers.CharField(allow_blank=False, trim_whitespace=True)
    deadlineStart = serializers.DateField()
    deadlineEnd = serializers.DateField()
    weekLabel = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    targetRoles = serializers.ListField(
        child=serializers.CharField(trim_whitespace=True),
        allow_empty=False,
    )

    def validate_targetRoles(self, value):
        normalized = [role.upper() for role in value]
        invalid = [role for role in normalized if role not in SemesterTimelineEntry.VALID_TARGET_ROLES]
        if invalid:
            raise serializers.ValidationError(f"Invalid target role(s): {', '.join(invalid)}")
        return normalized

    def validate(self, attrs):
        attrs = self.validate_period_links(attrs)
        if attrs["deadlineEnd"] < attrs["deadlineStart"]:
            raise serializers.ValidationError("Deadline End cannot be before Deadline Start.")
        return attrs


class TimelineAuditLogSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    actorName = serializers.SerializerMethodField()
    action = serializers.CharField()
    summary = serializers.CharField()
    reason = serializers.CharField()
    before = serializers.JSONField(source='before_values')
    after = serializers.JSONField(source='after_values')
    createdAt = serializers.DateTimeField(source="created_at")
    entryId = serializers.IntegerField(source="entry_id", allow_null=True)
    timelineId = serializers.IntegerField(source="timeline_id")

    def get_actorName(self, obj):
        return getattr(obj.actor, "full_name", "") or obj.actor.email


def active_timeline_payload(timeline, user=None, management=False):
    entries = list(timeline.entries.select_related("operational_period", "marks_period"))
    if user is not None and user.role == user.Role.STUDENT:
        entries = [entry for entry in entries if not entry.marks_period_id]
    if user is not None and not management:
        role = {user.Role.STUDENT: 'STUDENT', user.Role.LECTURER: 'LECTURER',
                user.Role.COORDINATOR: 'LECTURER', user.Role.OFFICE_ADMIN: 'OFFICE_STAFF'}.get(user.role)
        entries = [entry for entry in entries if role in entry.target_roles]
    grouped = []
    for level in ["P1", "P2"]:
        level_entries = [entry for entry in entries if entry.level == level]
        if level_entries:
            grouped.append(
                {
                    "level": level,
                    "entries": TimelineEntrySerializer(level_entries, many=True).data,
                }
            )
    return {
        "available": True,
        "id": timeline.id,
        "semester": timeline.semester,
        "session": timeline.session,
        "semesterId": timeline.academic_semester_id,
        "semesterCode": (
            timeline.academic_semester.code
            if timeline.academic_semester_id
            else None
        ),
        "sourceFilename": timeline.source_filename,
        "uploadedAt": timeline.uploaded_at,
        "levels": grouped,
    }
