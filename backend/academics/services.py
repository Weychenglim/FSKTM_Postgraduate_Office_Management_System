from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import AcademicSemester, AcademicSemesterAudit


class SemesterConflict(Exception):
    pass


def lock_academic_semesters(semester_ids=None):
    """Lock the requested semesters in the shared deterministic order."""
    queryset = AcademicSemester.objects.select_for_update().order_by("pk")
    if semester_ids is not None:
        requested_ids = {
            semester_id for semester_id in semester_ids if semester_id is not None
        }
        queryset = queryset.filter(pk__in=requested_ids)
    return {semester.pk: semester for semester in queryset}


def semester_snapshot(semester):
    return {
        "code": semester.code,
        "academicSession": semester.academic_session,
        "term": semester.term,
        "startsOn": semester.starts_on.isoformat(),
        "endsOn": semester.ends_on.isoformat(),
        "lifecycleStatus": semester.lifecycle_status,
        "activatedAt": (
            semester.activated_at.isoformat() if semester.activated_at else None
        ),
        "closedAt": (semester.closed_at.isoformat() if semester.closed_at else None),
        "archivedAt": (
            semester.archived_at.isoformat() if semester.archived_at else None
        ),
    }


def _audit(semester, actor, action, reason="", before=None):
    AcademicSemesterAudit.objects.create(
        semester=semester,
        actor=actor,
        action=action,
        reason=reason,
        before_values=before or {},
        after_values=semester_snapshot(semester),
    )


def current_effective_semester():
    semester = AcademicSemester.objects.filter(
        lifecycle_status=AcademicSemester.Lifecycle.ACTIVE
    ).first()
    if semester is None or not semester.is_active:
        return None
    return semester


def create_semester(*, actor, **values):
    semester = AcademicSemester(created_by=actor, **values)
    semester.full_clean()
    semester.save()
    _audit(semester, actor, AcademicSemesterAudit.Action.CREATE)
    return semester


@transaction.atomic
def update_draft_semester(semester, *, actor, values):
    semester = AcademicSemester.objects.select_for_update().get(pk=semester.pk)
    if semester.lifecycle_status != AcademicSemester.Lifecycle.DRAFT:
        raise SemesterConflict("Only draft semesters can be edited.")
    before = semester_snapshot(semester)
    for field, value in values.items():
        setattr(semester, field, value)
    semester.full_clean()
    semester.save()
    _audit(semester, actor, AcademicSemesterAudit.Action.UPDATE, before=before)
    return semester


def _require_reason(reason):
    normalized = str(reason or "").strip()
    if not normalized:
        raise ValidationError({"reason": "A reason is required."})
    return normalized


def _close_marks_periods(semester, actor, now):
    from marks.models import EvaluationPeriod, MarksConfigurationAudit

    periods = EvaluationPeriod.objects.select_for_update().filter(
        academic_semester=semester,
        lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
    )
    for period in periods:
        before = {
            "lifecycleStatus": period.lifecycle_status,
            "isOpen": period.is_open,
        }
        period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        period.is_open = False
        period.closed_at = now
        period.save(
            update_fields=[
                "lifecycle_status",
                "is_open",
                "closed_at",
                "updated_at",
            ]
        )
        MarksConfigurationAudit.objects.create(
            entity_type=MarksConfigurationAudit.EntityType.PERIOD,
            entity_id=period.pk,
            action="SEMESTER_CLOSE",
            actor=actor,
            reason=f"Academic semester {semester.label} closed.",
            before_values=before,
            after_values={
                "lifecycleStatus": period.lifecycle_status,
                "isOpen": period.is_open,
            },
        )


def _activation_checks(semester, current, today):
    """Same rules for the read-only checklist and locked activation command."""
    from .capacity_services import validate_published_capacity_ready

    capacity_errors = validate_published_capacity_ready(semester)
    return [
        {"key": "draft", "label": "Semester status", "ready": semester.lifecycle_status == AcademicSemester.Lifecycle.DRAFT,
         "message": "Draft semester ready for preparation." if semester.lifecycle_status == AcademicSemester.Lifecycle.DRAFT else "Only a draft semester can be activated."},
        {"key": "dates", "label": "Activation date", "ready": semester.starts_on <= today <= semester.ends_on,
         "message": f"Available from {semester.starts_on.strftime('%d %b %Y')}." if today < semester.starts_on else "The semester date range has ended." if today > semester.ends_on else "Today is within this semester's dates."},
        {"key": "current", "label": "Current semester", "ready": current is None or today > current.ends_on,
         "message": "No current active semester to close." if current is None else f"The current semester, {current.label}, ends on {current.ends_on.strftime('%d %b %Y')}. Activation is available after that date." if today <= current.ends_on else f"{current.label} has ended and will be closed on activation."},
        {"key": "capacity", "label": "Lecturer limits", "ready": not capacity_errors,
         "message": "A complete lecturer limits version is published." if not capacity_errors else "Publish a complete lecturer limits version for this semester.",
         "issueCount": len(capacity_errors)},
    ], capacity_errors


def _other_active_semester(semester, locked_semesters):
    return next((candidate for candidate in locked_semesters.values()
                 if candidate.lifecycle_status == AcademicSemester.Lifecycle.ACTIVE and candidate.pk != semester.pk), None)


@transaction.atomic
def semester_activation_readiness(semester):
    locked = lock_academic_semesters()
    semester = locked.get(semester.pk)
    if semester is None:
        raise SemesterConflict("Academic semester changed concurrently; reload and retry.")
    current = _other_active_semester(semester, locked)
    today = timezone.localdate()
    checks, _ = _activation_checks(semester, current, today)
    return {"semesterId": semester.pk, "checkedOn": today.isoformat(),
            "canActivate": all(check["ready"] for check in checks), "checks": checks,
            "currentSemester": {"id": current.pk, "label": current.label, "endsOn": current.ends_on.isoformat()} if current else None}


@transaction.atomic
def activate_semester(semester, *, actor, reason, preview_token=None, acknowledge_unfinished=False):
    reason = _require_reason(reason)
    locked_semesters = lock_academic_semesters()
    semester = locked_semesters.get(semester.pk)
    if semester is None:
        raise SemesterConflict(
            "Academic semester changed concurrently; reload and retry."
        )
    if semester.lifecycle_status != AcademicSemester.Lifecycle.DRAFT:
        raise SemesterConflict("Only a draft semester can be activated.")
    today = timezone.localdate()
    if today < semester.starts_on or today > semester.ends_on:
        raise SemesterConflict(
            "Semester can only be activated within its configured date range."
        )

    current = _other_active_semester(semester, locked_semesters)
    checks, capacity_errors = _activation_checks(semester, current, today)
    if capacity_errors:
        raise SemesterConflict(
            "Semester activation requires a complete published capacity plan: "
            + "; ".join(capacity_errors)
        )
    current_check = next(check for check in checks if check["key"] == "current")
    if not current_check["ready"]:
        raise SemesterConflict(current_check["message"])

    now = timezone.now()
    from marks.closure_preview import validate_semester_closure

    validate_semester_closure(current, target_semester=semester, preview_token=preview_token, acknowledge_unfinished=acknowledge_unfinished)
    if current:
        before = semester_snapshot(current)
        current.lifecycle_status = AcademicSemester.Lifecycle.CLOSED
        current.closed_at = now
        current.save(update_fields=["lifecycle_status", "closed_at", "updated_at"])
        _close_marks_periods(current, actor, now)
        _audit(
            current,
            actor,
            AcademicSemesterAudit.Action.HANDOVER_CLOSE,
            reason,
            before,
        )

    before = semester_snapshot(semester)
    semester.lifecycle_status = AcademicSemester.Lifecycle.ACTIVE
    semester.activated_at = now
    semester.save(update_fields=["lifecycle_status", "activated_at", "updated_at"])
    _audit(
        semester,
        actor,
        AcademicSemesterAudit.Action.ACTIVATE,
        reason,
        before,
    )
    from accounts.semester_rules import move_everyone_on

    # Runs after the commit so a failed move leaves the semester active. Registry still offers it.
    transaction.on_commit(lambda: move_everyone_on(semester, actor), robust=True)
    return semester


@transaction.atomic
def close_semester(semester, *, actor, reason, preview_token=None, acknowledge_unfinished=False):
    reason = _require_reason(reason)
    semester = AcademicSemester.objects.select_for_update().get(pk=semester.pk)
    if semester.lifecycle_status != AcademicSemester.Lifecycle.ACTIVE:
        raise SemesterConflict("Only an active semester can be closed.")
    from marks.closure_preview import validate_semester_closure

    validate_semester_closure(semester, preview_token=preview_token, acknowledge_unfinished=acknowledge_unfinished)
    before = semester_snapshot(semester)
    now = timezone.now()
    semester.lifecycle_status = AcademicSemester.Lifecycle.CLOSED
    semester.closed_at = now
    semester.save(update_fields=["lifecycle_status", "closed_at", "updated_at"])
    _close_marks_periods(semester, actor, now)
    _audit(
        semester,
        actor,
        AcademicSemesterAudit.Action.CLOSE,
        reason,
        before,
    )
    return semester


@transaction.atomic
def extend_semester(semester, *, actor, ends_on, reason):
    reason = _require_reason(reason)
    semester = AcademicSemester.objects.select_for_update().get(pk=semester.pk)
    if semester.lifecycle_status != AcademicSemester.Lifecycle.ACTIVE:
        raise SemesterConflict("Only an active semester can be extended.")
    if ends_on <= semester.ends_on:
        raise SemesterConflict("The new end date must be later than the current date.")
    before = semester_snapshot(semester)
    semester.ends_on = ends_on
    semester.full_clean()
    semester.save(update_fields=["ends_on", "updated_at"])
    _audit(
        semester,
        actor,
        AcademicSemesterAudit.Action.EXTEND,
        reason,
        before,
    )
    return semester


@transaction.atomic
def archive_semester(semester, *, actor, reason):
    reason = _require_reason(reason)
    semester = AcademicSemester.objects.select_for_update().get(pk=semester.pk)
    if semester.lifecycle_status not in {
        AcademicSemester.Lifecycle.DRAFT,
        AcademicSemester.Lifecycle.CLOSED,
    }:
        raise SemesterConflict("Only draft or closed semesters can be archived.")
    from marks.closure_preview import assert_semester_archive_allowed

    assert_semester_archive_allowed(semester)
    before = semester_snapshot(semester)
    semester.lifecycle_status = AcademicSemester.Lifecycle.ARCHIVED
    semester.archived_at = timezone.now()
    semester.save(update_fields=["lifecycle_status", "archived_at", "updated_at"])
    _audit(
        semester,
        actor,
        AcademicSemesterAudit.Action.ARCHIVE,
        reason,
        before,
    )
    return semester
