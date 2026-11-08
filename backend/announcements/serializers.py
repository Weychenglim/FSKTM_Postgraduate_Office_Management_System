"""DRF serializer for creating / updating announcements.

Validates the text fields, the schedule and the registry targeting. The file
attachment is read from ``request.FILES`` in the view (multipart upload).
"""
import json

from rest_framework import serializers

from accounts.programmes import normalise_programme

from .models import Announcement


class StringListField(serializers.Field):
    """A list of names: a JSON array, or a JSON-encoded string from a multipart form."""

    default_error_messages = {"invalid": "Send a list of names."}

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data) if data.strip() else []
            except ValueError:
                self.fail("invalid")
        if not isinstance(data, list) or not all(isinstance(item, str) for item in data):
            self.fail("invalid")
        return list(dict.fromkeys(item.strip() for item in data if item.strip()))

    def to_representation(self, value):
        return value


class AnnouncementSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    content = serializers.CharField(required=False, allow_blank=True, max_length=20000)
    target = serializers.ChoiceField(
        choices=[choice.value for choice in Announcement.Audience],
        required=False,
    )
    audiences = StringListField(required=False)
    priority = serializers.ChoiceField(
        choices=[choice.value for choice in Announcement.Priority],
        required=False,
    )
    status = serializers.ChoiceField(
        choices=[choice.value for choice in Announcement.Status],
        required=False,
    )
    publishAt = serializers.DateTimeField(required=False, allow_null=True)
    expiresAt = serializers.DateTimeField(required=False, allow_null=True)
    targetProgrammes = StringListField(required=False)
    targetIntakes = StringListField(required=False)

    # Frontend name -> model field name.
    FIELD_MAP = {
        "publishAt": "publish_at",
        "expiresAt": "expires_at",
        "targetProgrammes": "target_programmes",
        "targetIntakes": "target_intakes",
    }

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("A headline title is required.")
        return value.strip()

    def validate_audiences(self, value):
        known = [choice.value for choice in Announcement.Audience]
        for name in value:
            if name not in known:
                raise serializers.ValidationError(f"Unknown audience: {name}.")
        if not value or Announcement.Audience.ALL.value in value:
            return [Announcement.Audience.ALL.value]
        return [name for name in known if name in value]

    def validate_targetProgrammes(self, value):
        programmes = []
        for name in value:
            programme = normalise_programme(name)
            if programme is None:
                raise serializers.ValidationError(f"Unknown programme: {name}.")
            programmes.append(programme)
        return list(dict.fromkeys(programmes))

    def validate_targetIntakes(self, value):
        if len(value) > 20:
            raise serializers.ValidationError("Choose at most 20 intakes.")
        if any(len(intake) > 32 for intake in value):
            raise serializers.ValidationError("An intake name is at most 32 characters.")
        return value

    def to_model_kwargs(self):
        """Return validated data keyed by model field names."""
        kwargs = {
            self.FIELD_MAP.get(key, key): value
            for key, value in self.validated_data.items()
        }
        audiences = kwargs.pop("audiences", None)
        if audiences:
            kwargs["target"], kwargs["also_targets"] = audiences[0], audiences[1:]
        elif "target" in kwargs:
            kwargs["also_targets"] = []
        return kwargs
