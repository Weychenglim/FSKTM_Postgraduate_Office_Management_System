from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework import serializers

from .completion_windows import task_access, task_due_at, lock_tasks, task_window_active
from .deadlines import mark_deadline_metadata
from .models import EvaluationPeriod, EvaluationTask, MarkEntry, MarkScore, MarkSubmissionReceipt
from .services import MarksStateConflict
from .write_versions import entry_version, submission_fingerprint


def initials(name):
    return "".join(part[0] for part in name.split()[:2]).upper()


def task_status(task):
    try:
        status = task.mark_entry.status
    except MarkEntry.DoesNotExist:
        status = MarkEntry.Status.NOT_STARTED
    return {
        MarkEntry.Status.NOT_STARTED: "NOT STARTED",
        MarkEntry.Status.DRAFT: "DRAFT SAVED",
        MarkEntry.Status.SUBMITTED: "SUBMITTED",
    }[status]


class RubricCreateSerializer(serializers.Serializer):
    allowedEvaluatorRoles = serializers.ListField(child=serializers.ChoiceField(choices=["SUPERVISOR", "PANEL"]), allow_empty=False)
    familyCode = serializers.SlugField(max_length=64)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    targetMark = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        min_value=1,
    )


class RubricUpdateSerializer(serializers.Serializer):
    allowedEvaluatorRoles = serializers.ListField(child=serializers.ChoiceField(choices=["SUPERVISOR", "PANEL"]), allow_empty=False, required=False)
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    targetMark = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        min_value=1,
        required=False,
    )
    isActive = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("At least one field is required.")
        return attrs


class RubricComponentInputSerializer(serializers.Serializer):
    code = serializers.SlugField(max_length=64, required=False)
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    maxMarks = serializers.DecimalField(
        max_digits=7,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
    )
    required = serializers.BooleanField(required=False)
    isActive = serializers.BooleanField(required=False)
    displayOrder = serializers.IntegerField(min_value=0, required=False)

    def validate(self, attrs):
        if self.context.get("create"):
            required_fields = {"code", "name", "maxMarks", "displayOrder"}
            missing = required_fields - set(attrs)
            if missing:
                raise serializers.ValidationError(
                    f"Missing required fields: {', '.join(sorted(missing))}."
                )
        elif not attrs:
            raise serializers.ValidationError("At least one field is required.")
        return attrs


class EvaluationPeriodCreateSerializer(serializers.Serializer):
    assessment = serializers.ChoiceField(choices=["P1", "P2"], allow_blank=True, required=False)
    programmeScope = serializers.ChoiceField(choices=["ALL", "SELECTED"], required=False)
    programmes = serializers.ListField(child=serializers.CharField(max_length=255, allow_blank=False), required=False)
    evaluatorRoles = serializers.ListField(child=serializers.ChoiceField(choices=["SUPERVISOR", "PANEL"]), allow_empty=False, required=False)
    name = serializers.CharField(max_length=255)
    semester = serializers.CharField(max_length=128, required=False)
    semesterId = serializers.IntegerField(min_value=1, required=False)
    rubricId = serializers.IntegerField(min_value=1)
    opensAt = serializers.DateTimeField(required=False, allow_null=True)
    closesAt = serializers.DateTimeField(required=False, allow_null=True)


class EvaluationPeriodUpdateSerializer(serializers.Serializer):
    assessment = serializers.ChoiceField(choices=["P1", "P2"], allow_blank=True, required=False)
    programmeScope = serializers.ChoiceField(choices=["ALL", "SELECTED"], required=False)
    programmes = serializers.ListField(child=serializers.CharField(max_length=255, allow_blank=False), required=False)
    evaluatorRoles = serializers.ListField(child=serializers.ChoiceField(choices=["SUPERVISOR", "PANEL"]), allow_empty=False, required=False)
    name = serializers.CharField(max_length=255, required=False)
    semester = serializers.CharField(max_length=128, required=False)
    semesterId = serializers.IntegerField(min_value=1, required=False)
    rubricId = serializers.IntegerField(min_value=1, required=False)
    opensAt = serializers.DateTimeField(required=False, allow_null=True)
    closesAt = serializers.DateTimeField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not set(attrs) - {"reason"}:
            raise serializers.ValidationError("At least one field is required.")
        return attrs


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("A reason is required.")
        return value


class EvaluationTaskSerializer(serializers.ModelSerializer):
    periodName = serializers.CharField(source="period.name", read_only=True)
    rubricName = serializers.CharField(source="period.rubric.name", read_only=True)
    rubricVersion = serializers.IntegerField(source="period.rubric.version", read_only=True)
    opensAt = serializers.DateTimeField(source="period.opens_at", read_only=True, allow_null=True)
    closesAt = serializers.DateTimeField(source="period.closes_at", read_only=True, allow_null=True)
    assignedAt = serializers.DateTimeField(source="assigned_at", read_only=True)
    studentId = serializers.CharField(source="profile.matric_no")
    studentName = serializers.CharField(source="profile.student_name")
    initials = serializers.SerializerMethodField()
    researchTitle = serializers.CharField(source="profile.proposed_topic")
    semester = serializers.CharField(source="period.semester")
    deadline = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    evaluatorRole = serializers.CharField(source="evaluator_role")
    evaluatorRoleLabel = serializers.CharField(source="get_evaluator_role_display")
    totalMark = serializers.SerializerMethodField()
    submittedDate = serializers.SerializerMethodField()
    submittedAt = serializers.DateTimeField(source="mark_entry.submitted_at", read_only=True, allow_null=True)
    writeVersion = serializers.SerializerMethodField()
    components = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    dueAt = serializers.SerializerMethodField()
    daysUntilDue = serializers.SerializerMethodField()
    deadlineState = serializers.SerializerMethodField()

    class Meta:
        model = EvaluationTask
        fields = [
            "id",
            "periodName", "rubricName", "rubricVersion", "opensAt", "closesAt", "assignedAt",
            "studentId",
            "studentName",
            "initials",
            "researchTitle",
            "semester",
            "deadline",
            "status",
            "evaluatorRole",
            "evaluatorRoleLabel",
            "totalMark",
            "submittedDate",
            "submittedAt",
            "writeVersion",
            "components",
            "comments",
            "dueAt",
            "daysUntilDue",
            "deadlineState",
        ]

    def to_representation(self, obj):
        return {**super().to_representation(obj), **task_access(obj)}

    def get_initials(self, obj):
        return initials(obj.profile.student_name)

    def get_writeVersion(self, obj):
        return entry_version(obj, getattr(obj, 'mark_entry', None))

    def get_deadline(self, obj):
        closes_at = task_due_at(obj)
        return closes_at.strftime("%d %b %Y") if closes_at else "-"

    def get_status(self, obj):
        return task_status(obj)

    def get_totalMark(self, obj):
        try:
            return f"{obj.mark_entry.total_mark:.2f}"
        except MarkEntry.DoesNotExist:
            return None

    def get_submittedDate(self, obj):
        try:
            submitted_at = obj.mark_entry.submitted_at
        except MarkEntry.DoesNotExist:
            return None
        return timezone.localtime(submitted_at).strftime("%d %b %Y") if submitted_at else None

    def get_comments(self, obj):
        try:
            return obj.mark_entry.comments
        except MarkEntry.DoesNotExist:
            return ""

    def get_deadline_metadata(self, obj):
        cache = getattr(self, "_deadline_metadata_cache", {})
        if obj.pk in cache:
            return cache[obj.pk]
        try:
            is_submitted = obj.mark_entry.status == MarkEntry.Status.SUBMITTED
        except MarkEntry.DoesNotExist:
            is_submitted = False
        cache[obj.pk] = mark_deadline_metadata(
            task_due_at(obj),
            is_submitted=is_submitted,
        )
        self._deadline_metadata_cache = cache
        return cache[obj.pk]

    def get_dueAt(self, obj):
        return self.get_deadline_metadata(obj)["dueAt"]

    def get_daysUntilDue(self, obj):
        return self.get_deadline_metadata(obj)["daysUntilDue"]

    def get_deadlineState(self, obj):
        return self.get_deadline_metadata(obj)["deadlineState"]

    def get_components(self, obj):
        try:
            score_map = {
                score.component_id: score
                for score in obj.mark_entry.scores.all()
            }
        except MarkEntry.DoesNotExist:
            score_map = {}
        return [
            {
                "id": component.pk,
                "code": component.code,
                "name": component.name,
                "description": component.description,
                "maxMarks": f"{component.max_marks:.2f}",
                "required": component.is_required,
                "marksAwarded": (
                    f"{score_map[component.pk].marks_awarded:.2f}"
                    if component.pk in score_map
                    else None
                ),
                "feedback": (
                    score_map[component.pk].feedback
                    if component.pk in score_map
                    else ""
                ),
            }
            for component in obj.period.rubric.components.all() if component.is_active
        ]


class SubmittedEvaluationSerializer(EvaluationTaskSerializer):
    taskLifecycleStatus = serializers.CharField(source="lifecycle_status")
    periodId = serializers.IntegerField(source="period_id")

    class Meta(EvaluationTaskSerializer.Meta):
        fields = EvaluationTaskSerializer.Meta.fields + [
            "taskLifecycleStatus", "periodId",
        ]

    def to_representation(self, obj):
        # History never evaluates editing or completion-window grant eligibility.
        return {
            **serializers.ModelSerializer.to_representation(self, obj),
            "canEdit": False, "canSubmit": False,
            "periodEffectiveStatus": obj.period.effective_status,
            "effectiveDueAt": task_due_at(obj),
        }


class ScoreInputSerializer(serializers.Serializer):
    componentId = serializers.IntegerField()
    marksAwarded = serializers.DecimalField(
        max_digits=7, decimal_places=2, min_value=Decimal("0.00")
    )
    feedback = serializers.CharField(required=False, allow_blank=True)


class SubmittedMarksReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=False, trim_whitespace=True)
    expectedVersion = serializers.CharField(allow_blank=False)

    def validate(self, attrs):
        if set(self.initial_data) - set(self.fields):
            raise serializers.ValidationError("Unexpected fields are not permitted for this operation.")
        return attrs


class SubmittedScoreCorrectionSerializer(serializers.Serializer):
    componentId = serializers.IntegerField(min_value=1)
    marksAwarded = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=Decimal("0.00"))

    def to_internal_value(self, data):
        if isinstance(data, dict) and set(data) - set(self.fields):
            raise serializers.ValidationError("Only component scores may be corrected here.")
        return super().to_internal_value(data)


class SubmittedMarksCorrectionSerializer(SubmittedMarksReasonSerializer):
    scores = SubmittedScoreCorrectionSerializer(many=True, required=False, default=list)
    comments = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        ids = [score['componentId'] for score in attrs['scores']]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Each component may appear only once.")
        if not ids and 'comments' not in attrs:
            raise serializers.ValidationError("Supply a score or overall-comment correction.")
        return attrs


class MarkDraftSerializer(serializers.Serializer):
    expectedVersion = serializers.CharField(min_length=64, max_length=64)
    scores = ScoreInputSerializer(many=True)
    comments = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        task = self.context["task"]
        components = {
            component.pk: component
            for component in task.period.rubric.components.filter(is_active=True)
        }
        submitted_ids = [score["componentId"] for score in attrs["scores"]]
        if len(submitted_ids) != len(set(submitted_ids)):
            raise serializers.ValidationError("Each rubric component may appear only once.")
        invalid = set(submitted_ids) - set(components)
        if invalid:
            raise serializers.ValidationError("One or more rubric components are invalid.")
        for score in attrs["scores"]:
            component = components[score["componentId"]]
            if score["marksAwarded"] > component.max_marks:
                raise serializers.ValidationError(
                    f"{component.name} cannot exceed {component.max_marks} marks."
                )
        attrs["components"] = components
        return attrs

    @transaction.atomic
    def save(self):
        task = lock_tasks([self.context['task'].pk])[0]
        assert_task_accepts_marks(task)
        entry = MarkEntry.objects.select_for_update().filter(task=task).first()
        if not constant_time_compare(entry_version(task, entry), self.validated_data['expectedVersion']):
            raise MarksStateConflict('This draft changed elsewhere. Load the latest record before saving or submitting.')
        return save_draft_locked(task, entry, self.validated_data)


def save_draft_locked(task, entry, data):
    if entry is None:
        entry = MarkEntry.objects.create(task=task)
    if entry.status == MarkEntry.Status.SUBMITTED:
        raise MarksStateConflict("Submitted marks are locked.")
    entry.status = MarkEntry.Status.DRAFT
    entry.comments = data.get("comments", "")
    entry.save(update_fields=["status", "comments", "updated_at"])
    submitted_ids = {
        score_data["componentId"]
        for score_data in data["scores"]
    }
    entry.scores.exclude(component_id__in=submitted_ids).delete()
    for score_data in data["scores"]:
        score, _ = MarkScore.objects.get_or_create(
            entry=entry,
            component=data["components"][
                score_data["componentId"]
            ],
            defaults={
                "marks_awarded": score_data["marksAwarded"],
                "feedback": score_data.get("feedback", ""),
            },
        )
        score.marks_awarded = score_data["marksAwarded"]
        score.feedback = score_data.get("feedback", "")
        try:
            score.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        score.save()
    entry.recalculate_total()
    return entry


class MarkSubmissionSerializer(MarkDraftSerializer):
    submissionId = serializers.UUIDField()

    @transaction.atomic
    def save(self):
        task = lock_tasks([self.context['task'].pk])[0]
        entry = MarkEntry.objects.select_for_update().filter(task=task).first()
        data = self.validated_data
        fingerprint = submission_fingerprint(data)
        receipt = MarkSubmissionReceipt.objects.filter(task=task, submission_id=data['submissionId']).first()
        if receipt is not None:
            if not constant_time_compare(receipt.request_hash, fingerprint):
                raise MarksStateConflict('This submission reference was already used for different marks. Review the latest record.')
            if entry is None or entry.status != MarkEntry.Status.SUBMITTED or not constant_time_compare(receipt.entry_version, entry_version(task, entry)):
                raise MarksStateConflict('This mark record changed after submission. Review the latest record.')
            return entry
        assert_task_accepts_marks(task)
        if not constant_time_compare(entry_version(task, entry), data['expectedVersion']):
            raise MarksStateConflict('This draft changed elsewhere. Load the latest record before saving or submitting.')
        entry = save_draft_locked(task, entry, data)
        entry = submit_entry_locked(task, entry)
        MarkSubmissionReceipt.objects.create(task=task, submission_id=data['submissionId'], request_hash=fingerprint, entry_version=entry_version(task, entry))
        return entry


def assert_task_accepts_marks(task):
    if not task_access(task)["canEdit"]:
        raise MarksStateConflict(
            "Marks can only be saved while the evaluation period is open."
        )


@transaction.atomic
def submit_entry(task):
    task = lock_tasks([task.pk])[0]
    try:
        entry = MarkEntry.objects.select_for_update().get(task=task)
    except MarkEntry.DoesNotExist as exc:
        raise serializers.ValidationError(
            "Save a complete draft before submission."
        ) from exc
    return submit_entry_locked(task, entry)


def submit_entry_locked(task, entry):
    assert_task_accepts_marks(task)
    if entry.status == MarkEntry.Status.SUBMITTED:
        raise MarksStateConflict("Marks have already been submitted.")
    required_ids = set(
        task.period.rubric.components.filter(
            is_active=True,
            is_required=True,
        ).values_list("id", flat=True)
    )
    entered_ids = set(entry.scores.values_list("component_id", flat=True))
    if not required_ids.issubset(entered_ids):
        raise serializers.ValidationError(
            "All required rubric components must be entered before submission."
        )
    entry.submitted_due_at = task_due_at(task)
    entry.submitted_completion_window = task_window_active(task)
    entry.submitted_due_recorded = True
    entry.status = MarkEntry.Status.SUBMITTED
    entry.submitted_at = timezone.now()
    entry.save(update_fields=["status", "submitted_at", "updated_at", "submitted_due_at", "submitted_completion_window", "submitted_due_recorded"])
    return entry
