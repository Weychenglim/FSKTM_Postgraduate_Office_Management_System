from collections.abc import Mapping

from django.utils import timezone
from rest_framework import serializers

from .capacity import CapacityRole, capacity_workload_counts, derive_capacity_resolution
from .capacity_services import (
    capacity_eligible_lecturers,
    capacity_plan_content_fingerprint,
    capacity_plan_readiness_errors,
)
from .models import (
    AcademicSemester,
    AcademicSemesterAudit,
    LecturerAvailabilityWindow,
    LecturerCapacityEntry,
    SemesterCapacityPlan,
)

MAX_CAPACITY_HISTORY_OFFSET = 1_000_000


class AcademicSemesterWriteSerializer(serializers.Serializer):
    academicSession = serializers.CharField(max_length=9)
    term = serializers.ChoiceField(choices=AcademicSemester.Term.choices)
    startsOn = serializers.DateField()
    endsOn = serializers.DateField()

    def service_values(self):
        data = self.validated_data
        return {
            "academic_session": data["academicSession"],
            "term": data["term"],
            "starts_on": data["startsOn"],
            "ends_on": data["endsOn"],
        }


class AcademicSemesterUpdateSerializer(serializers.Serializer):
    academicSession = serializers.CharField(max_length=9, required=False)
    term = serializers.ChoiceField(
        choices=AcademicSemester.Term.choices,
        required=False,
    )
    startsOn = serializers.DateField(required=False)
    endsOn = serializers.DateField(required=False)

    def service_values(self):
        names = {
            "academicSession": "academic_session",
            "term": "term",
            "startsOn": "starts_on",
            "endsOn": "ends_on",
        }
        return {names[key]: value for key, value in self.validated_data.items()}


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField()


class ClosureTransitionSerializer(ReasonSerializer):
    previewToken = serializers.CharField(required=False, allow_blank=True)
    acknowledgeUnfinished = serializers.BooleanField(required=False, default=False)


class ExtendSerializer(ReasonSerializer):
    endsOn = serializers.DateField()


class StrictCapacitySerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            unknown_fields = sorted(set(data.keys()) - set(self.fields.keys()))
            if unknown_fields:
                raise serializers.ValidationError(
                    {field_name: ["Unknown field."] for field_name in unknown_fields}
                )
        return super().to_internal_value(data)


class CapacityPlanCreateSerializer(StrictCapacitySerializer):
    copyFromPlanId = serializers.IntegerField(
        min_value=1,
        allow_null=True,
        required=False,
        default=None,
    )


class CapacityEntryWriteSerializer(StrictCapacitySerializer):
    supervisorLimit = serializers.IntegerField(min_value=0, allow_null=True)
    panelLimit = serializers.IntegerField(min_value=0, allow_null=True)
    expectedVersion = serializers.IntegerField(min_value=1)
    expectedFingerprint = serializers.RegexField(r"^[0-9a-f]{64}$")


class CapacityPlanPatchSerializer(CapacityEntryWriteSerializer):
    lecturerId = serializers.IntegerField(min_value=1)


class CapacityBulkEntrySerializer(StrictCapacitySerializer):
    lecturerId = serializers.IntegerField(min_value=1)
    supervisorLimit = serializers.IntegerField(min_value=0, max_value=2147483647, required=False)
    panelLimit = serializers.IntegerField(min_value=0, max_value=2147483647, required=False)

    def validate(self, values):
        if not {"supervisorLimit", "panelLimit"}.intersection(values):
            raise serializers.ValidationError("Provide at least one role limit.")
        return values


class CapacityBulkWriteSerializer(StrictCapacitySerializer):
    entries = CapacityBulkEntrySerializer(many=True, allow_empty=False, max_length=1000)
    mode = serializers.ChoiceField(choices=["MISSING_ONLY", "REPLACE"])
    expectedVersion = serializers.IntegerField(min_value=1)
    expectedFingerprint = serializers.RegexField(r"^[0-9a-f]{64}$")

    def validate_entries(self, entries):
        ids = [entry["lecturerId"] for entry in entries]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Each lecturer must appear only once.")
        return entries


class CapacityPlanCommandSerializer(StrictCapacitySerializer):
    reason = serializers.CharField(allow_blank=False)
    expectedVersion = serializers.IntegerField(min_value=1)
    expectedFingerprint = serializers.RegexField(r"^[0-9a-f]{64}$")


class CapacityPlanDiscardSerializer(CapacityPlanCommandSerializer):
    confirmed = serializers.BooleanField()

    def validate_confirmed(self, value):
        if self.initial_data.get("confirmed") is not True:
            raise serializers.ValidationError("Explicit confirmation is required.")
        return value


class AvailabilityWriteSerializer(StrictCapacitySerializer):
    lecturerId = serializers.IntegerField(min_value=1)
    role = serializers.ChoiceField(
        choices=(
            LecturerAvailabilityWindow.Role.SUPERVISOR,
            LecturerAvailabilityWindow.Role.PANEL,
        )
    )
    startsOn = serializers.DateField()
    endsOn = serializers.DateField()
    reason = serializers.CharField(allow_blank=False)


class CapacityReasonSerializer(StrictCapacitySerializer):
    reason = serializers.CharField(allow_blank=False)


class EmptyCapacityCommandSerializer(StrictCapacitySerializer):
    pass


class CapacityLimitOffsetSerializer(serializers.Serializer):
    limit = serializers.IntegerField(
        min_value=1,
        max_value=100,
        required=False,
        default=25,
    )
    offset = serializers.IntegerField(
        min_value=0,
        max_value=MAX_CAPACITY_HISTORY_OFFSET,
        required=False,
        default=0,
    )


def semester_payload(semester, *, include_counts=False):
    payload = {
        "id": semester.pk,
        "code": semester.code,
        "academicSession": semester.academic_session,
        "term": semester.term,
        "label": semester.label,
        "startsOn": semester.starts_on.isoformat(),
        "endsOn": semester.ends_on.isoformat(),
        "lifecycleStatus": semester.lifecycle_status,
        "effectiveStatus": semester.effective_status,
        "isActive": semester.is_active,
        "activatedAt": semester.activated_at,
        "closedAt": semester.closed_at,
        "archivedAt": semester.archived_at,
    }
    if include_counts:
        timelines = getattr(semester, "timelines", None)
        periods = getattr(semester, "evaluation_periods", None)
        period_rows = list(periods.all()) if periods is not None else []
        payload.update(
            {
                "timelineCount": timelines.count() if timelines is not None else 0,
                "marksPeriodCount": len(period_rows),
                "marksTaskCount": sum(period.tasks.count() for period in period_rows),
            }
        )
    return payload


def audit_payload(audit):
    return {
        "id": audit.pk,
        "action": audit.action,
        "reason": audit.reason,
        "actor": audit.actor.full_name,
        "beforeValues": audit.before_values,
        "afterValues": audit.after_values,
        "createdAt": audit.created_at,
    }


def _user_reference(user):
    if user is None:
        return None
    return {
        "id": user.pk,
        "name": user.full_name,
    }


def _capacity_resolution_payload(result):
    return {
        "semesterId": result.semester_id,
        "planId": result.plan_id,
        "planVersion": result.plan_version,
        "role": str(result.role),
        "limit": result.limit,
        "activeLoad": result.active_load,
        "reservedLoad": result.reserved_load,
        "pendingRequests": result.pending_requests,
        "availableSlots": result.available_slots,
        "state": str(result.state),
        "unavailableUntil": (
            result.unavailable_until.isoformat()
            if result.unavailable_until is not None
            else None
        ),
    }


def _capacity_resolution_context(semester, entries):
    lecturer_ids = {entry.lecturer_id for entry in entries}
    user_ids = {entry.lecturer.user_id for entry in entries}
    published_plan = (
        SemesterCapacityPlan.objects.filter(
            academic_semester=semester,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        )
        .only("pk", "version")
        .first()
    )
    published_limits = {}
    if published_plan is not None:
        published_limits = {
            row["lecturer_id"]: row
            for row in LecturerCapacityEntry.objects.filter(
                plan=published_plan,
                lecturer_id__in=lecturer_ids,
            ).values("lecturer_id", "supervisor_limit", "panel_limit")
        }

    today = timezone.localdate()
    unavailable_until = {}
    windows = (
        LecturerAvailabilityWindow.objects.filter(
            academic_semester=semester,
            lecturer_id__in=lecturer_ids,
            cancelled_at__isnull=True,
            starts_on__lte=today,
            ends_on__gte=today,
        )
        .values("lecturer_id", "role", "ends_on")
        .order_by("lecturer_id", "role", "-ends_on", "-pk")
    )
    for window in windows:
        unavailable_until.setdefault(
            (window["lecturer_id"], window["role"]),
            window["ends_on"],
        )

    return {
        "semesterId": semester.pk,
        "publishedPlan": published_plan,
        "publishedLimits": published_limits,
        "unavailableUntil": unavailable_until,
        **capacity_workload_counts(user_ids),
    }


def _entry_capacity_resolution(entry, role, context):
    lecturer = entry.lecturer
    user = lecturer.user
    published_plan = context["publishedPlan"]
    limit_values = context["publishedLimits"].get(lecturer.pk, {})
    if role == CapacityRole.SUPERVISOR:
        limit = limit_values.get("supervisor_limit")
        active_load = context["supervisorLoad"].get(user.pk, 0)
        reserved_load = context["supervisorReservations"].get(user.pk, 0)
    else:
        limit = limit_values.get("panel_limit")
        active_load = context["panelLoad"].get(user.pk, 0)
        reserved_load = context["panelReservations"].get(user.pk, 0)
    return derive_capacity_resolution(
        semester_id=context["semesterId"],
        plan_id=published_plan.pk if published_plan is not None else None,
        plan_version=published_plan.version if published_plan is not None else None,
        role=role,
        limit=limit,
        active_load=active_load,
        reserved_load=reserved_load,
        pending_requests=context["supervisorPendingRequests"].get(user.pk, 0) if role == CapacityRole.SUPERVISOR else 0,
        eligible=(
            user.is_active and lecturer.lifecycle_status == lecturer.Lifecycle.ACTIVE
        ),
        unavailable_until=context["unavailableUntil"].get((lecturer.pk, role.value)),
    )


def _capacity_entry_payload(entry, context):
    lecturer = entry.lecturer
    supervisor = None
    panel = None
    if hasattr(lecturer, "supervisor"):
        supervisor = _capacity_resolution_payload(
            _entry_capacity_resolution(entry, CapacityRole.SUPERVISOR, context)
        )
    if hasattr(lecturer, "panel"):
        panel = _capacity_resolution_payload(
            _entry_capacity_resolution(entry, CapacityRole.PANEL, context)
        )
    return {
        "id": entry.pk,
        "lecturerId": lecturer.pk,
        "staffNo": lecturer.staff_no,
        "lecturerName": lecturer.user.full_name,
        "participantLifecycle": lecturer.lifecycle_status,
        "supervisorLimit": entry.supervisor_limit,
        "panelLimit": entry.panel_limit,
        "supervisor": supervisor,
        "panel": panel,
        "updatedBy": _user_reference(entry.updated_by),
        "createdAt": entry.created_at,
        "updatedAt": entry.updated_at,
    }


def _render_capacity_plan_payload(
    plan,
    *,
    entries,
    resolution_context,
    readiness_lecturers,
    successor_ids,
):
    semester = plan.academic_semester
    readiness_errors = capacity_plan_readiness_errors(
        plan,
        entries=entries,
        lecturers=readiness_lecturers,
        workload_context=resolution_context,
    )
    return {
        "id": plan.pk,
        "semesterId": semester.pk,
        "semesterCode": semester.code,
        "semesterLabel": semester.label,
        "version": plan.version,
        "lifecycleStatus": plan.lifecycle_status,
        "origin": plan.origin,
        "supersedesId": plan.supersedes_id,
        "successorIds": successor_ids,
        "isComplete": not readiness_errors,
        "readinessErrors": readiness_errors,
        "isCurrentPublished": (plan.lifecycle_status == plan.Lifecycle.PUBLISHED),
        "contentFingerprint": capacity_plan_content_fingerprint(
            plan,
            entries=entries,
        ),
        "entries": [
            _capacity_entry_payload(entry, resolution_context) for entry in entries
        ],
        "createdBy": _user_reference(plan.created_by),
        "createdAt": plan.created_at,
        "publishedBy": _user_reference(plan.published_by),
        "publishedAt": plan.published_at,
        "publicationReason": plan.publication_reason or None,
    }


def capacity_plan_payload(plan):
    semester = plan.academic_semester
    entries = list(
        plan.entries.select_related(
            "lecturer__user",
            "lecturer__supervisor",
            "lecturer__panel",
            "updated_by",
        ).order_by("lecturer__staff_no", "lecturer_id", "pk")
    )
    resolution_context = (
        _capacity_resolution_context(semester, entries) if entries else None
    )
    return _render_capacity_plan_payload(
        plan,
        entries=entries,
        resolution_context=resolution_context,
        readiness_lecturers=capacity_eligible_lecturers(),
        successor_ids=list(
            plan.successor_plans.order_by("version", "pk").values_list("pk", flat=True)
        ),
    )


def capacity_plan_payloads(plans):
    plans = list(plans)
    if not plans:
        return []
    all_entries = [entry for plan in plans for entry in plan.capacity_payload_entries]
    resolution_context = (
        _capacity_resolution_context(plans[0].academic_semester, all_entries)
        if all_entries
        else None
    )
    readiness_lecturers = capacity_eligible_lecturers()
    return [
        _render_capacity_plan_payload(
            plan,
            entries=plan.capacity_payload_entries,
            resolution_context=resolution_context,
            readiness_lecturers=readiness_lecturers,
            successor_ids=[
                successor.pk for successor in plan.capacity_payload_successors
            ],
        )
        for plan in plans
    ]


def availability_payload(window):
    today = timezone.localdate()
    return {
        "id": window.pk,
        "semesterId": window.academic_semester_id,
        "semesterCode": window.academic_semester.code,
        "lecturerId": window.lecturer_id,
        "staffNo": window.lecturer.staff_no,
        "lecturerName": window.lecturer.user.full_name,
        "role": window.role,
        "startsOn": window.starts_on.isoformat(),
        "endsOn": window.ends_on.isoformat(),
        "reason": window.reason,
        "isEffective": (
            window.cancelled_at is None and window.starts_on <= today <= window.ends_on
        ),
        "isCancelled": window.cancelled_at is not None,
        "createdBy": _user_reference(window.created_by),
        "createdAt": window.created_at,
        "cancelledBy": _user_reference(window.cancelled_by),
        "cancelledAt": window.cancelled_at,
        "cancellationReason": window.cancellation_reason or None,
    }


def capacity_audit_payload(audit):
    return {
        "id": audit.pk,
        "semesterId": audit.academic_semester_id,
        "planId": audit.plan_id,
        "planVersion": audit.plan.version if audit.plan_id else None,
        "lecturerId": audit.lecturer_id,
        "availabilityWindowId": audit.availability_window_id,
        "action": audit.action,
        "reason": audit.reason,
        "actor": _user_reference(audit.actor),
        "beforeValues": audit.before_values,
        "afterValues": audit.after_values,
        "createdAt": audit.created_at,
    }
