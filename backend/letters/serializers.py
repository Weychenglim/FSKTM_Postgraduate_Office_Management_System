"""DRF serializer for creating / updating letter templates.

Accepts the frontend field names (``type``, ``referencePrefix``,
``customFields``) and maps them to the model fields. Output is produced by
``LetterTemplate.to_public_dict`` in the views, so this serializer only
validates input.
"""
from rest_framework import serializers

from .models import LetterPurpose, LetterTemplate
from .placeholders import clean_custom_fields


class LetterTemplateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=128, required=False, allow_blank=True)
    purpose = serializers.ChoiceField(choices=LetterPurpose.choices, required=False)
    status = serializers.ChoiceField(choices=LetterTemplate.Status.choices, required=False)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)
    contentMs = serializers.CharField(required=False, allow_blank=True)
    asksRecipient = serializers.BooleanField(required=False)
    validMonths = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=60)
    readyInDays = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=60)
    # Checked in the views, which know the template's purpose and own fields.
    formQuestions = serializers.JSONField(required=False)
    referencePrefix = serializers.CharField(max_length=64, required=False, allow_blank=True)
    signatoryName = serializers.CharField(max_length=120, required=False, allow_blank=True)
    signatoryTitle = serializers.CharField(max_length=120, required=False, allow_blank=True)
    signatoryNameMs = serializers.CharField(max_length=120, required=False, allow_blank=True)
    signatoryTitleMs = serializers.CharField(max_length=120, required=False, allow_blank=True)
    customFields = serializers.JSONField(required=False)

    # Frontend name -> model field name.
    FIELD_MAP = {
        "type": "letter_type",
        "referencePrefix": "reference_prefix",
        "customFields": "custom_fields",
        "signatoryName": "signatory_name",
        "signatoryTitle": "signatory_title",
        "signatoryNameMs": "signatory_name_ms",
        "signatoryTitleMs": "signatory_title_ms",
        "contentMs": "content_ms",
        "asksRecipient": "asks_recipient",
        "validMonths": "valid_months",
        "readyInDays": "ready_in_days",
        "formQuestions": "form_questions",
    }

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Template name is required.")
        return value.strip()

    def validate_signatoryName(self, value):
        return value.strip()

    def validate_signatoryTitle(self, value):
        return value.strip()

    def validate_signatoryNameMs(self, value):
        return value.strip()

    def validate_signatoryTitleMs(self, value):
        return value.strip()

    def validate_customFields(self, value):
        fields, error = clean_custom_fields(value)
        if error:
            raise serializers.ValidationError(error)
        return fields

    def to_model_kwargs(self):
        """Return validated data keyed by model field names."""
        return {
            self.FIELD_MAP.get(key, key): value
            for key, value in self.validated_data.items()
        }
