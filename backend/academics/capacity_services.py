import hashlib
import json
import re

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from accounts.models import Lecturer, Panel, Supervisor

from .capacity import capacity_plan_workloads
from .models import (
    AcademicSemester,
    LecturerAvailabilityWindow,
    LecturerCapacityAudit,
    LecturerCapacityEntry,
    SemesterCapacityPlan,
)
from .services import lock_academic_semesters


class CapacityLifecycleConflict(Exception):
    """The requested capacity write conflicts with current persisted state."""


class CapacityPlanConflict(CapacityLifecycleConflict):
    """The requested plan write conflicts with current persisted content."""


class AvailabilityConflict(CapacityLifecycleConflict):
    """The requested availability write conflicts with current window state."""


PLAN_CREATED_REASON = "Blank capacity plan created."
ENTRY_UPDATED_REASON = "Draft capacity entry saved."
CONTENT_FINGERPRINT_PATTERN = re.compile(r"^[0-9a-f]{64}$")
WRITABLE_SEMESTER_LIFECYCLES = {
    AcademicSemester.Lifecycle.DRAFT,
    AcademicSemester.Lifecycle.ACTIVE,
}


def _require_reason(reason):
    normalized = str(reason or "").strip()
    if not normalized:
        raise ValidationError({"reason": "A reason is required."})
    return normalized


def _iso_or_none(value):
    return value.isoformat() if value is not None else None


def _entry_snapshot(entry):
    return {
        "entryId": entry.pk,
        "lecturerId": entry.lecturer_id,
        "staffNo": entry.lecturer.staff_no,
        "supervisorLimit": entry.supervisor_limit,
        "panelLimit": entry.panel_limit,
        "updatedById": entry.updated_by_id,
        "createdAt": _iso_or_none(entry.created_at),
        "updatedAt": _iso_or_none(entry.updated_at),
    }


def _capacity_plan_content_payload(plan, entries):
    return {
        "planId": plan.pk,
        "semesterId": plan.academic_semester_id,
        "version": plan.version,
        "lifecycleStatus": plan.lifecycle_status,
        "origin": plan.origin,
        "supersedesId": plan.supersedes_id,
        "entries": [
            {
                "entryId": entry.pk,
                "lecturerId": entry.lecturer_id,
                "supervisorLimit": entry.supervisor_limit,
                "panelLimit": entry.panel_limit,
                "updatedAt": _iso_or_none(entry.updated_at),
            }
            for entry in sorted(
                entries, key=lambda entry: (entry.lecturer_id, entry.pk)
            )
        ],
    }


def _capacity_plan_content_fingerprint(plan, entries):
    canonical = json.dumps(
        _capacity_plan_content_payload(plan, entries),
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def capacity_plan_content_fingerprint(plan, *, entries=None) -> str:
    if entries is None:
        entries = list(
            LecturerCapacityEntry.objects.filter(plan_id=plan.pk).order_by(
                "lecturer_id",
                "pk",
            )
        )
    return _capacity_plan_content_fingerprint(plan, entries)


def capacity_plan_snapshot(plan) -> dict:
    entries = list(
        LecturerCapacityEntry.objects.filter(plan_id=plan.pk)
        .select_related("lecturer")
        .order_by("lecturer__staff_no", "lecturer_id", "pk")
    )
    semester = plan.academic_semester
    return {
        "planId": plan.pk,
        "semesterId": plan.academic_semester_id,
        "semesterCode": semester.code,
        "version": plan.version,
        "lifecycleStatus": plan.lifecycle_status,
        "origin": plan.origin,
        "supersedesId": plan.supersedes_id,
        "createdById": plan.created_by_id,
        "createdAt": _iso_or_none(plan.created_at),
        "publishedById": plan.published_by_id,
        "publishedAt": _iso_or_none(plan.published_at),
        "publicationReason": plan.publication_reason,
        "contentFingerprint": _capacity_plan_content_fingerprint(plan, entries),
        "entries": [_entry_snapshot(entry) for entry in entries],
    }


def _availability_snapshot(window):
    return {
        "availabilityWindowId": window.pk,
        "semesterId": window.academic_semester_id,
        "lecturerId": window.lecturer_id,
        "role": window.role,
        "startsOn": _iso_or_none(window.starts_on),
        "endsOn": _iso_or_none(window.ends_on),
        "reason": window.reason,
        "createdById": window.created_by_id,
        "createdAt": _iso_or_none(window.created_at),
        "cancelledById": window.cancelled_by_id,
        "cancelledAt": _iso_or_none(window.cancelled_at),
        "cancellationReason": window.cancellation_reason,
    }


def _audit(
    *,
    semester,
    actor,
    action,
    reason,
    before,
    after,
    plan=None,
    lecturer=None,
    window=None,
):
    return LecturerCapacityAudit.objects.create(
        academic_semester=semester,
        plan=plan,
        lecturer=lecturer,
        availability_window=window,
        actor=actor,
        action=action,
        reason=reason,
        before_values=before,
        after_values=after,
    )


def _lock_semesters(semester_ids=None):
    requested_ids = (
        None
        if semester_ids is None
        else {semester_id for semester_id in semester_ids if semester_id}
    )
    semesters = lock_academic_semesters(requested_ids)
    if requested_ids is not None and set(semesters) != requested_ids:
        raise CapacityLifecycleConflict(
            "Academic semester changed concurrently; reload and retry."
        )
    return semesters


def _lock_plans_for_semesters(semester_ids):
    return list(
        SemesterCapacityPlan.objects.select_for_update()
        .filter(academic_semester_id__in=semester_ids)
        .order_by("academic_semester_id", "pk")
    )


def _lock_capacity_entries_for_plans(plan_ids):
    return list(
        LecturerCapacityEntry.objects.select_for_update()
        .filter(plan_id__in=plan_ids)
        .select_related("lecturer")
        .order_by("plan_id", "lecturer_id", "pk")
    )


def _require_writable_semester(semester):
    if semester.lifecycle_status not in WRITABLE_SEMESTER_LIFECYCLES:
        raise CapacityPlanConflict(
            "Capacity changes are only allowed for Draft or Active semesters."
        )


def _validate_expected_fingerprint(expected_fingerprint):
    if not isinstance(
        expected_fingerprint, str
    ) or not CONTENT_FINGERPRINT_PATTERN.fullmatch(expected_fingerprint):
        raise ValidationError(
            {
                "expected_fingerprint": (
                    "Expected fingerprint must be a 64-character lowercase "
                    "hexadecimal value."
                )
            }
        )
    return expected_fingerprint


def _assert_expected_fingerprint(plan, entries, expected_fingerprint):
    if _capacity_plan_content_fingerprint(plan, entries) != expected_fingerprint:
        raise CapacityPlanConflict(
            "Capacity plan content changed concurrently; reload and retry."
        )


def _assert_current_plan(passed, current):
    identity = (
        "academic_semester_id",
        "version",
        "lifecycle_status",
        "origin",
        "supersedes_id",
    )
    if current is None or any(
        getattr(passed, field) != getattr(current, field) for field in identity
    ):
        raise CapacityLifecycleConflict(
            "Capacity plan changed concurrently; reload and retry."
        )


def _current_eligible_lecturers(*, lock=False):
    eligible_ids = (
        Lecturer.objects.filter(
            lifecycle_status=Lecturer.Lifecycle.ACTIVE,
            user__is_active=True,
        )
        .filter(
            Q(pk__in=Supervisor.objects.values("lecturer_id"))
            | Q(pk__in=Panel.objects.values("lecturer_id"))
        )
        .values("pk")
    )
    if lock:
        locked_ids = list(
            Lecturer.objects.select_for_update()
            .filter(pk__in=eligible_ids)
            .order_by("staff_no", "pk")
            .values_list("pk", flat=True)
        )
        list(
            Supervisor.objects.select_for_update()
            .filter(lecturer_id__in=locked_ids)
            .order_by("lecturer_id")
        )
        list(
            Panel.objects.select_for_update()
            .filter(lecturer_id__in=locked_ids)
            .order_by("lecturer_id")
        )
        lecturers = Lecturer.objects.filter(pk__in=locked_ids)
    else:
        lecturers = Lecturer.objects.filter(pk__in=eligible_ids)
    return list(
        lecturers.select_related("supervisor", "panel").order_by("staff_no", "pk")
    )


def _has_supervisor_role(lecturer):
    return hasattr(lecturer, "supervisor")


def _has_panel_role(lecturer):
    return hasattr(lecturer, "panel")


def _copy_current_entries(*, source, target, actor):
    source_entries = {
        entry.lecturer_id: entry
        for entry in LecturerCapacityEntry.objects.select_for_update()
        .filter(plan_id=source.pk)
        .select_related("lecturer")
        .order_by("lecturer_id", "pk")
    }
    for lecturer in _current_eligible_lecturers(lock=True):
        source_entry = source_entries.get(lecturer.pk)
        if source_entry is None:
            continue
        has_supervisor = _has_supervisor_role(lecturer)
        has_panel = _has_panel_role(lecturer)
        if (
            has_supervisor
            and source_entry.supervisor_limit is None
            or has_panel
            and source_entry.panel_limit is None
        ):
            continue
        entry = LecturerCapacityEntry(
            plan=target,
            lecturer=lecturer,
            supervisor_limit=(
                source_entry.supervisor_limit if has_supervisor else None
            ),
            panel_limit=source_entry.panel_limit if has_panel else None,
            updated_by=actor,
        )
        entry.save(force_insert=True)


def _require_latest_prior_published_source(*, source, target_semester):
    source_semester = source.academic_semester
    if source_semester.ends_on >= target_semester.starts_on:
        raise CapacityPlanConflict(
            "Copied capacity plans must use a strictly prior semester."
        )
    latest_prior = (
        SemesterCapacityPlan.objects.filter(
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
            academic_semester__ends_on__lt=target_semester.starts_on,
        )
        .order_by(
            "-academic_semester__ends_on",
            "-academic_semester_id",
            "-pk",
        )
        .first()
    )
    if latest_prior is None or latest_prior.pk != source.pk:
        raise CapacityPlanConflict(
            "Copied capacity plans must use the latest prior Published semester plan."
        )


def _create_plan_locked(
    *,
    semester,
    actor,
    source=None,
    supersedes=None,
    allowed_source_lifecycles=None,
    require_latest_prior=False,
):
    plans = _lock_plans_for_semesters(
        {semester.pk, source.academic_semester_id if source else semester.pk}
    )
    if source is not None:
        current_source = next(
            (candidate for candidate in plans if candidate.pk == source.pk),
            None,
        )
        _assert_current_plan(source, current_source)
        if current_source.lifecycle_status not in allowed_source_lifecycles:
            raise CapacityLifecycleConflict(
                "The source capacity plan cannot be copied in its current lifecycle."
            )
        source = current_source
        if require_latest_prior:
            _require_latest_prior_published_source(
                source=source,
                target_semester=semester,
            )
        if supersedes is not None:
            supersedes = current_source

    target_versions = [
        candidate.version
        for candidate in plans
        if candidate.academic_semester_id == semester.pk
    ]
    plan = SemesterCapacityPlan(
        academic_semester=semester,
        version=max(target_versions, default=0) + 1,
        lifecycle_status=SemesterCapacityPlan.Lifecycle.DRAFT,
        origin=(
            SemesterCapacityPlan.Origin.COPIED_FORWARD
            if source
            else SemesterCapacityPlan.Origin.CREATED
        ),
        supersedes=supersedes,
        created_by=actor,
    )
    plan.full_clean(validate_unique=False, validate_constraints=False)
    plan.save(force_insert=True)
    if source is not None:
        _copy_current_entries(source=source, target=plan, actor=actor)
        action = LecturerCapacityAudit.Action.PLAN_COPY
        reason = f"Capacity plan copied from plan {source.pk}."
        before = capacity_plan_snapshot(source)
    else:
        action = LecturerCapacityAudit.Action.PLAN_CREATE
        reason = PLAN_CREATED_REASON
        before = {}
    _audit(
        semester=semester,
        plan=plan,
        actor=actor,
        action=action,
        reason=reason,
        before=before,
        after=capacity_plan_snapshot(plan),
    )
    return plan


def create_capacity_plan(*, semester, actor, copy_from=None):
    try:
        with transaction.atomic():
            semesters = (
                _lock_semesters()
                if copy_from is not None
                else _lock_semesters({semester.pk})
            )
            current_semester = semesters.get(semester.pk)
            if current_semester is None or (
                copy_from is not None
                and copy_from.academic_semester_id not in semesters
            ):
                raise CapacityPlanConflict(
                    "Academic semester changed concurrently; reload and retry."
                )
            _require_writable_semester(current_semester)
            if copy_from is not None and copy_from.academic_semester_id == semester.pk:
                raise CapacityPlanConflict(
                    "Use clone_capacity_plan for a same-semester version."
                )
            return _create_plan_locked(
                semester=current_semester,
                actor=actor,
                source=copy_from,
                supersedes=copy_from,
                allowed_source_lifecycles={
                    SemesterCapacityPlan.Lifecycle.PUBLISHED,
                },
                require_latest_prior=copy_from is not None,
            )
    except IntegrityError as exc:
        raise CapacityPlanConflict(
            "Capacity plan changed concurrently; reload and retry."
        ) from exc


def clone_capacity_plan(plan, *, actor):
    try:
        with transaction.atomic():
            semesters = _lock_semesters({plan.academic_semester_id})
            semester = semesters[plan.academic_semester_id]
            _require_writable_semester(semester)
            return _create_plan_locked(
                semester=semester,
                actor=actor,
                source=plan,
                supersedes=plan,
                allowed_source_lifecycles={
                    SemesterCapacityPlan.Lifecycle.PUBLISHED,
                    SemesterCapacityPlan.Lifecycle.SUPERSEDED,
                },
            )
    except IntegrityError as exc:
        raise CapacityPlanConflict(
            "Capacity plan changed concurrently; reload and retry."
        ) from exc


def _locked_current_plan(plan):
    semesters = _lock_semesters({plan.academic_semester_id})
    semester = semesters[plan.academic_semester_id]
    plans = _lock_plans_for_semesters({plan.academic_semester_id})
    current = next((candidate for candidate in plans if candidate.pk == plan.pk), None)
    _assert_current_plan(plan, current)
    return current, semester


def update_capacity_entry(
    plan,
    *,
    lecturer,
    actor,
    supervisor_limit,
    panel_limit,
    expected_fingerprint,
):
    expected_fingerprint = _validate_expected_fingerprint(expected_fingerprint)
    try:
        with transaction.atomic():
            current_plan, semester = _locked_current_plan(plan)
            _require_writable_semester(semester)
            if current_plan.lifecycle_status != SemesterCapacityPlan.Lifecycle.DRAFT:
                raise CapacityLifecycleConflict(
                    "Capacity entries can only be changed on Draft plans."
                )
            locked_entries = _lock_capacity_entries_for_plans({current_plan.pk})
            _assert_expected_fingerprint(
                current_plan,
                locked_entries,
                expected_fingerprint,
            )
            current_lecturer = (
                Lecturer.objects.select_for_update().filter(pk=lecturer.pk).first()
            )
            if current_lecturer is None:
                raise CapacityLifecycleConflict(
                    "Lecturer changed concurrently; reload and retry."
                )
            if current_lecturer.lifecycle_status != Lecturer.Lifecycle.ACTIVE:
                raise CapacityLifecycleConflict(
                    "Only lifecycle-Active Lecturers can have Draft capacity entries."
                )
            supervisor_rows = list(
                Supervisor.objects.select_for_update()
                .filter(lecturer_id=current_lecturer.pk)
                .order_by("lecturer_id")
            )
            panel_rows = list(
                Panel.objects.select_for_update()
                .filter(lecturer_id=current_lecturer.pk)
                .order_by("lecturer_id")
            )
            has_supervisor = bool(supervisor_rows)
            has_panel = bool(panel_rows)
            if not has_supervisor and not has_panel:
                raise CapacityLifecycleConflict(
                    "The Lecturer does not hold a capacity-managed role."
                )

            entry = next(
                (
                    candidate
                    for candidate in locked_entries
                    if candidate.lecturer_id == current_lecturer.pk
                ),
                None,
            )
            before = _entry_snapshot(entry) if entry is not None else None
            if entry is None:
                entry = LecturerCapacityEntry(
                    plan=current_plan,
                    lecturer=current_lecturer,
                    updated_by=actor,
                )
            entry.supervisor_limit = supervisor_limit
            entry.panel_limit = panel_limit
            entry.updated_by = actor
            entry.save()
            _audit(
                semester=semester,
                plan=current_plan,
                lecturer=current_lecturer,
                actor=actor,
                action=LecturerCapacityAudit.Action.ENTRY_UPDATE,
                reason=ENTRY_UPDATED_REASON,
                before={"entry": before},
                after={"entry": _entry_snapshot(entry)},
            )
            return entry
    except IntegrityError as exc:
        raise CapacityPlanConflict(
            "Capacity entry changed concurrently; reload and retry."
        ) from exc


def update_capacity_entries_bulk(plan, *, actor, entries, mode, expected_fingerprint):
    """Save explicit role patches as one draft revision, never a partial batch."""
    expected_fingerprint = _validate_expected_fingerprint(expected_fingerprint)
    ids = [row["lecturerId"] for row in entries]
    if not entries or len(ids) != len(set(ids)) or mode not in {"MISSING_ONLY", "REPLACE"}:
        raise ValidationError({"entries": "Provide unique lecturers and a valid update mode."})
    try:
        with transaction.atomic():
            current_plan, semester = _locked_current_plan(plan)
            _require_writable_semester(semester)
            if current_plan.lifecycle_status != SemesterCapacityPlan.Lifecycle.DRAFT:
                raise CapacityLifecycleConflict("Bulk changes can only be saved to Draft plans.")
            locked_entries = _lock_capacity_entries_for_plans({current_plan.pk})
            _assert_expected_fingerprint(current_plan, locked_entries, expected_fingerprint)
            lecturers = {row.pk: row for row in _current_eligible_lecturers(lock=True)}
            if set(ids) - lecturers.keys():
                raise CapacityLifecycleConflict("A selected lecturer is no longer eligible. Reload and review the selection.")
            saved = {row.lecturer_id: row for row in locked_entries}
            changes = []
            for patch in sorted(entries, key=lambda row: row["lecturerId"]):
                lecturer = lecturers[patch["lecturerId"]]
                entry = saved.get(lecturer.pk)
                before = _entry_snapshot(entry) if entry else None
                if entry is None:
                    entry = LecturerCapacityEntry(plan=current_plan, lecturer=lecturer, updated_by=actor)
                changed = False
                for field, attribute, held in [
                    ("supervisorLimit", "supervisor_limit", _has_supervisor_role(lecturer)),
                    ("panelLimit", "panel_limit", _has_panel_role(lecturer)),
                ]:
                    if field not in patch:
                        continue
                    if not held:
                        raise CapacityLifecycleConflict(f"{lecturer.staff_no}: lecturer no longer holds the requested role. Reload and review.")
                    value = patch[field]
                    if (mode == "REPLACE" or getattr(entry, attribute) is None) and getattr(entry, attribute) != value:
                        setattr(entry, attribute, value)
                        changed = True
                if not changed:
                    continue
                entry.updated_by = actor
                try:
                    entry.full_clean()
                except ValidationError as exc:
                    raise ValidationError({"entries": [f"{lecturer.staff_no}: {message}" for message in exc.messages]}) from exc
                changes.append((entry, lecturer, before))
            for entry, lecturer, before in changes:
                entry.save()
                _audit(semester=semester, plan=current_plan, lecturer=lecturer, actor=actor,
                       action=LecturerCapacityAudit.Action.ENTRY_UPDATE,
                       reason=f"Draft capacity limits saved in bulk ({mode}).",
                       before={"entry": before}, after={"entry": _entry_snapshot(entry)})
            return current_plan
    except IntegrityError as exc:
        raise CapacityPlanConflict("Capacity plan changed concurrently; reload and retry.") from exc


def _capacity_plan_readiness_errors(
    plan, *, entries=None, lecturers=None, workload_context=None,
):
    if entries is None:
        entries = list(
            LecturerCapacityEntry.objects.filter(plan_id=plan.pk)
            .select_related("lecturer")
            .order_by("lecturer__staff_no", "lecturer_id", "pk")
        )
    if lecturers is None:
        lecturers = _current_eligible_lecturers()

    eligible_by_id = {lecturer.pk: lecturer for lecturer in lecturers}
    entries_by_lecturer = {}
    for entry in entries:
        entries_by_lecturer.setdefault(entry.lecturer_id, []).append(entry)

    errors = []
    for lecturer in lecturers:
        lecturer_entries = entries_by_lecturer.get(lecturer.pk, [])
        if not lecturer_entries:
            errors.append(
                f"{lecturer.staff_no}: capacity entry is required for this Lecturer."
            )
            continue
        if len(lecturer_entries) != 1:
            errors.append(
                f"{lecturer.staff_no}: exactly one capacity entry is required."
            )
            continue
        entry = lecturer_entries[0]
        has_supervisor = _has_supervisor_role(lecturer)
        has_panel = _has_panel_role(lecturer)
        if has_supervisor and entry.supervisor_limit is None:
            errors.append(f"{lecturer.staff_no}: Supervisor limit is required.")
        if not has_supervisor and entry.supervisor_limit is not None:
            errors.append(f"{lecturer.staff_no}: Supervisor limit must be empty.")
        if has_panel and entry.panel_limit is None:
            errors.append(f"{lecturer.staff_no}: Panel limit is required.")
        if not has_panel and entry.panel_limit is not None:
            errors.append(f"{lecturer.staff_no}: Panel limit must be empty.")

    for entry in entries:
        if entry.lecturer_id not in eligible_by_id:
            errors.append(
                f"{entry.lecturer.staff_no}: entry Lecturer is not currently eligible."
            )
    # Published versions are immutable history. Only a new publication must
    # meet today's commitments; existing over-capacity policies remain readable.
    if plan.lifecycle_status == SemesterCapacityPlan.Lifecycle.DRAFT and entries:
        if workload_context is None:
            workload_context = capacity_plan_workloads(
                plan.academic_semester,
                (entry.lecturer.user_id for entry in entries),
            )
        for entry in entries:
            user_id = entry.lecturer.user_id
            supervisor_load = workload_context["supervisorLoad"].get(user_id, 0)
            supervisor_reserved = workload_context["supervisorReservations"].get(user_id, 0)
            panel_active = workload_context["panelLoad"].get(user_id, 0)
            panel_reserved = workload_context["panelReservations"].get(user_id, 0)
            for role, limit, active, reserved, forecast in (
                ("Supervisor", entry.supervisor_limit, supervisor_load, supervisor_reserved,
                 workload_context.get("supervisorRp2Releases", {}).get(user_id, 0)),
                ("Panel", entry.panel_limit, panel_active, panel_reserved,
                 workload_context.get("panelRp2Releases", {}).get(user_id, 0)),
            ):
                release = min(active, forecast)
                load = active - release + reserved
                if limit is not None and limit < load:
                    adjustment = f" - {release} expected RP2 releases" if release else ""
                    detail = f" ({active} active + {reserved} reserved{adjustment})"
                    errors.append(
                        f"{entry.lecturer.staff_no}: {role} limit {limit} is below "
                        f"committed workload {load}{detail} (minimum {load})."
                    )
    return errors


def validate_capacity_plan_ready(plan) -> list[str]:
    if plan.pk is None or not SemesterCapacityPlan.objects.filter(pk=plan.pk).exists():
        return ["Capacity plan does not exist."]
    return _capacity_plan_readiness_errors(plan)


def validate_published_capacity_ready(semester) -> list[str]:
    published_plans = list(
        SemesterCapacityPlan.objects.filter(
            academic_semester=semester,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED,
        ).order_by("pk")
    )
    if len(published_plans) != 1:
        return ["Exactly one Published capacity plan is required."]
    return _capacity_plan_readiness_errors(published_plans[0])


def capacity_eligible_lecturers():
    """Return the current Lecturer set required for capacity publication."""
    return _current_eligible_lecturers()


def capacity_plan_readiness_errors(
    plan, *, entries, lecturers=None, workload_context=None,
):
    """Derive readiness from caller-loaded entries for read-only API payloads."""
    return _capacity_plan_readiness_errors(
        plan,
        entries=entries,
        lecturers=lecturers,
        workload_context=workload_context,
    )


def _publish_capacity_plan_atomic(plan, *, actor, reason, expected_fingerprint):
    with transaction.atomic():
        semesters = _lock_semesters({plan.academic_semester_id})
        semester = semesters[plan.academic_semester_id]
        _require_writable_semester(semester)
        plans = _lock_plans_for_semesters({semester.pk})
        current_plan = next(
            (candidate for candidate in plans if candidate.pk == plan.pk),
            None,
        )
        _assert_current_plan(plan, current_plan)
        if current_plan.lifecycle_status != SemesterCapacityPlan.Lifecycle.DRAFT:
            raise CapacityLifecycleConflict(
                "Only a Draft capacity plan can be published."
            )

        locked_entries = _lock_capacity_entries_for_plans(
            [candidate.pk for candidate in plans]
        )
        entries = [
            entry for entry in locked_entries if entry.plan_id == current_plan.pk
        ]
        _assert_expected_fingerprint(
            current_plan,
            entries,
            expected_fingerprint,
        )
        lecturers = _current_eligible_lecturers(lock=True)
        readiness_errors = _capacity_plan_readiness_errors(
            current_plan,
            entries=entries,
            lecturers=lecturers,
        )
        if readiness_errors:
            raise CapacityLifecycleConflict("; ".join(readiness_errors))

        published_plans = [
            candidate
            for candidate in plans
            if candidate.lifecycle_status == SemesterCapacityPlan.Lifecycle.PUBLISHED
            and candidate.pk != current_plan.pk
        ]
        if len(published_plans) > 1:
            raise CapacityLifecycleConflict(
                "Multiple Published capacity plans exist; reload and reconcile."
            )

        now = timezone.now()
        if published_plans:
            published = published_plans[0]
            before = capacity_plan_snapshot(published)
            published.lifecycle_status = SemesterCapacityPlan.Lifecycle.SUPERSEDED
            published.save(update_fields=["lifecycle_status"])
            _audit(
                semester=semester,
                plan=published,
                actor=actor,
                action=LecturerCapacityAudit.Action.SUPERSEDE,
                reason=reason,
                before=before,
                after=capacity_plan_snapshot(published),
            )

        before = capacity_plan_snapshot(current_plan)
        current_plan.lifecycle_status = SemesterCapacityPlan.Lifecycle.PUBLISHED
        current_plan.published_by = actor
        current_plan.published_at = now
        current_plan.publication_reason = reason
        current_plan.save(
            update_fields=[
                "lifecycle_status",
                "published_by",
                "published_at",
                "publication_reason",
            ]
        )
        _audit(
            semester=semester,
            plan=current_plan,
            actor=actor,
            action=LecturerCapacityAudit.Action.PUBLISH,
            reason=reason,
            before=before,
            after=capacity_plan_snapshot(current_plan),
        )
        return current_plan


def publish_capacity_plan(plan, *, actor, reason, expected_fingerprint):
    reason = _require_reason(reason)
    expected_fingerprint = _validate_expected_fingerprint(expected_fingerprint)
    try:
        return _publish_capacity_plan_atomic(
            plan,
            actor=actor,
            reason=reason,
            expected_fingerprint=expected_fingerprint,
        )
    except IntegrityError as exc:
        raise CapacityPlanConflict(
            "Capacity plan was published concurrently; reload and retry."
        ) from exc


def discard_capacity_plan(plan, *, actor, reason, expected_fingerprint):
    """Retire an unpublished draft without deleting its entries or audit trail."""
    reason = _require_reason(reason)
    expected_fingerprint = _validate_expected_fingerprint(expected_fingerprint)
    try:
        with transaction.atomic():
            semesters = _lock_semesters({plan.academic_semester_id})
            semester = semesters[plan.academic_semester_id]
            _require_writable_semester(semester)
            plans = _lock_plans_for_semesters({semester.pk})
            current = next((row for row in plans if row.pk == plan.pk), None)
            _assert_current_plan(plan, current)
            if current.lifecycle_status != SemesterCapacityPlan.Lifecycle.DRAFT:
                raise CapacityLifecycleConflict("Only a Draft capacity plan can be discarded.")
            entries = _lock_capacity_entries_for_plans([current.pk])
            _assert_expected_fingerprint(current, entries, expected_fingerprint)
            before = capacity_plan_snapshot(current)
            current.lifecycle_status = SemesterCapacityPlan.Lifecycle.DISCARDED
            current.save(update_fields=["lifecycle_status"])
            _audit(
                semester=semester, plan=current, actor=actor,
                action=LecturerCapacityAudit.Action.PLAN_DISCARD, reason=reason,
                before=before, after=capacity_plan_snapshot(current),
            )
            return current
    except IntegrityError as exc:
        raise CapacityPlanConflict("Capacity plan changed concurrently; reload and retry.") from exc


def _clean_date(field_name, value):
    field = LecturerAvailabilityWindow._meta.get_field(field_name)
    return field.clean(value, None)


def create_availability_window(
    *,
    semester,
    lecturer,
    role,
    starts_on,
    ends_on,
    actor,
    reason,
):
    reason = _require_reason(reason)
    if role not in LecturerAvailabilityWindow.Role.values:
        raise ValidationError({"role": "Select a valid availability role."})
    starts_on = _clean_date("starts_on", starts_on)
    ends_on = _clean_date("ends_on", ends_on)

    with transaction.atomic():
        semesters = _lock_semesters({semester.pk})
        current_semester = semesters[semester.pk]
        _require_writable_semester(current_semester)
        current_lecturer = (
            Lecturer.objects.select_for_update().filter(pk=lecturer.pk).first()
        )
        if current_lecturer is None:
            raise CapacityLifecycleConflict(
                "Lecturer changed concurrently; reload and retry."
            )
        if current_lecturer.lifecycle_status != Lecturer.Lifecycle.ACTIVE:
            raise CapacityLifecycleConflict(
                "Availability can only be created for a lifecycle-Active Lecturer."
            )
        profile_model = (
            Supervisor if role == LecturerAvailabilityWindow.Role.SUPERVISOR else Panel
        )
        role_rows = list(
            profile_model.objects.select_for_update()
            .filter(lecturer_id=current_lecturer.pk)
            .order_by("pk")
        )
        if not role_rows:
            raise CapacityLifecycleConflict(
                "The Lecturer does not hold the requested availability role."
            )
        if ends_on < starts_on:
            raise ValidationError(
                {"ends_on": "End date must be on or after the start date."}
            )
        if starts_on < current_semester.starts_on:
            raise ValidationError(
                {"starts_on": "Availability must start within the academic semester."}
            )
        if ends_on > current_semester.ends_on:
            raise ValidationError(
                {"ends_on": "Availability must end within the academic semester."}
            )

        active_windows = list(
            LecturerAvailabilityWindow.objects.select_for_update()
            .filter(
                academic_semester=current_semester,
                lecturer=current_lecturer,
                role=role,
                cancelled_at__isnull=True,
            )
            .order_by("pk")
        )
        if any(
            window.starts_on <= ends_on and window.ends_on >= starts_on
            for window in active_windows
        ):
            raise AvailabilityConflict(
                "Availability overlaps an active window for this Lecturer and role."
            )

        window = LecturerAvailabilityWindow(
            academic_semester=current_semester,
            lecturer=current_lecturer,
            role=role,
            starts_on=starts_on,
            ends_on=ends_on,
            reason=reason,
            created_by=actor,
        )
        window.save(force_insert=True)
        _audit(
            semester=current_semester,
            lecturer=current_lecturer,
            window=window,
            actor=actor,
            action=LecturerCapacityAudit.Action.AVAILABILITY_CREATE,
            reason=reason,
            before={},
            after=_availability_snapshot(window),
        )
        return window


def _window_identity(window):
    return (
        window.academic_semester_id,
        window.lecturer_id,
        window.role,
        window.starts_on,
        window.ends_on,
        window.reason,
        window.cancelled_by_id,
        window.cancelled_at,
        window.cancellation_reason,
    )


def cancel_availability_window(window, *, actor, reason):
    reason = _require_reason(reason)
    with transaction.atomic():
        semesters = _lock_semesters({window.academic_semester_id})
        semester = semesters[window.academic_semester_id]
        current_window = (
            LecturerAvailabilityWindow.objects.select_for_update()
            .filter(pk=window.pk)
            .select_related("lecturer")
            .first()
        )
        if current_window is None or _window_identity(
            current_window
        ) != _window_identity(window):
            raise AvailabilityConflict(
                "Availability window changed concurrently; reload and retry."
            )
        if current_window.cancelled_at is not None:
            raise AvailabilityConflict("Availability window is already cancelled.")

        before = _availability_snapshot(current_window)
        current_window.cancelled_by = actor
        current_window.cancelled_at = timezone.now()
        current_window.cancellation_reason = reason
        current_window.save(
            update_fields=[
                "cancelled_by",
                "cancelled_at",
                "cancellation_reason",
            ]
        )
        _audit(
            semester=semester,
            lecturer=current_window.lecturer,
            window=current_window,
            actor=actor,
            action=LecturerCapacityAudit.Action.AVAILABILITY_CANCEL,
            reason=reason,
            before=before,
            after=_availability_snapshot(current_window),
        )
        return current_window
