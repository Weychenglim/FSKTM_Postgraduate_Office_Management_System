from decimal import Decimal
import json

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_slug
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from academics.models import AcademicSemester
from accounts.models import Lecturer, Student
from accounts.authorization import office_actor, can_correct_marks
from appointments.models import (
    PanelAppointment,
    StudentResearchProfile,
    SupervisorAppointment,
)

from .completion_windows import invalidate_task_windows, lock_tasks
from .models import (
    EvaluationPeriod,
    EvaluationTask,
    EvaluationTaskHandoverAudit,
    EvaluationTaskLifecycleAudit,
    EvaluationTaskOverrideAudit,
    MarkCorrectionAudit,
    MarkEntry,
    MarkScore,
    MarksConfigurationAudit,
    Rubric,
    RubricComponent,
)
from .targeting import normalize_period_targeting, period_recipients, profile_in_scope


User = get_user_model()


class MarksStateConflict(Exception):
    pass


def _assert_period_allows_task_creation(period):
    if (
        period.lifecycle_status != EvaluationPeriod.Lifecycle.PUBLISHED
        or (period.closes_at and period.closes_at < timezone.now())
        or period.academic_semester_id is None
        or not period.academic_semester.is_active
    ):
        raise MarksStateConflict(
            "Evaluation tasks can only be created for a published period "
            "that has not ended."
        )


def _assert_office_admin(actor):
    if not office_actor(actor):
        raise ValidationError("Only authorized Office Staff/Admin may modify submitted marks.")


def _active_periods():
    now = timezone.now()
    return EvaluationPeriod.objects.filter(
        lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
        academic_semester__lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
        academic_semester__starts_on__lte=timezone.localdate(),
        academic_semester__ends_on__gte=timezone.localdate(),
    ).filter(
        Q(opens_at__isnull=True) | Q(opens_at__lte=now),
        Q(closes_at__isnull=True) | Q(closes_at__gte=now),
    )


def _rubric_snapshot(rubric):
    return {
        "id": rubric.pk,
        "familyCode": rubric.family_code,
        "code": rubric.code,
        "name": rubric.name,
        "description": rubric.description,
        "version": rubric.version,
        "targetMark": f"{rubric.target_mark:.2f}",
        "componentTotal": f"{rubric.component_total:.2f}",
        "isActive": rubric.is_active,
        "isArchived": rubric.is_archived,
        "components": [
            {
                "id": component.pk,
                "code": component.code,
                "name": component.name,
                "description": component.description,
                "maxMarks": f"{component.max_marks:.2f}",
                "required": component.is_required,
                "isActive": component.is_active,
                "displayOrder": component.display_order,
            }
            for component in rubric.components.order_by("display_order", "id")
        ],
    }


def _period_snapshot(period):
    return {
        "id": period.pk,
        "name": period.name,
        "semester": period.semester,
        "semesterId": period.academic_semester_id,
        "semesterCode": (
            period.academic_semester.code
            if period.academic_semester_id
            else None
        ),
        "rubricId": period.rubric_id,
        "programmeScope": period.programme_scope,
        "programmes": period.programmes,
        "evaluatorRoles": period.evaluator_roles,
        "opensAt": period.opens_at.isoformat() if period.opens_at else None,
        "closesAt": period.closes_at.isoformat() if period.closes_at else None,
        "lifecycleStatus": period.lifecycle_status,
        "effectiveStatus": period.effective_status,
    }


def _configuration_audit(
    *,
    entity_type,
    entity_id,
    action,
    actor,
    before_values=None,
    after_values=None,
    reason="",
):
    return MarksConfigurationAudit.objects.create(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor=actor,
        reason=str(reason).strip(),
        before_values=before_values or {},
        after_values=after_values or {},
    )


@transaction.atomic
def clone_rubric_version(*, rubric, actor):
    _assert_office_admin(actor)
    family = list(Rubric.objects.select_for_update().filter(family_code=rubric.family_code).order_by("pk"))
    rubric = next(version for version in family if version.pk == rubric.pk)
    if rubric.is_archived:
        raise ValidationError("Restore this rubric family before creating a new version.")
    source_snapshot = _rubric_snapshot(rubric)
    latest_version = (
        Rubric.objects.filter(family_code=rubric.family_code)
        .order_by("-version")
        .values_list("version", flat=True)
        .first()
        or 0
    )
    new_version = latest_version + 1
    cloned = Rubric.objects.create(
        family_code=rubric.family_code,
        code=f"{rubric.family_code}-v{new_version}",
        name=rubric.name,
        description=rubric.description,
        version=new_version,
        target_mark=rubric.target_mark,
        supersedes=rubric,
        is_active=True,
    )
    RubricComponent.objects.bulk_create(
        [
            RubricComponent(
                rubric=cloned,
                code=component.code,
                name=component.name,
                description=component.description,
                max_marks=component.max_marks,
                is_required=component.is_required,
                is_active=component.is_active,
                display_order=component.display_order,
            )
            for component in rubric.components.order_by("display_order", "id")
        ]
    )
    Rubric.objects.filter(
        family_code=rubric.family_code,
        is_active=True,
    ).exclude(pk=cloned.pk).update(is_active=False)
    rubric.refresh_from_db()
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.RUBRIC,
        entity_id=cloned.pk,
        action="CLONE",
        actor=actor,
        before_values=source_snapshot,
        after_values=_rubric_snapshot(cloned),
    )
    return cloned


@transaction.atomic
def create_rubric(*, actor, family_code, name, description, target_mark):
    _assert_office_admin(actor)
    family_code = str(family_code).strip()[:64]
    if not family_code:
        raise ValidationError("Rubric family code is required.")
    validate_slug(family_code)
    if Rubric.objects.filter(family_code__iexact=family_code).exists():
        raise ValidationError("Rubric family code is already in use.")
    rubric = Rubric.objects.create(
        family_code=family_code,
        code=f"{family_code}-v1",
        name=str(name).strip(),
        description=str(description).strip(),
        version=1,
        target_mark=target_mark,
        is_active=True,
    )
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.RUBRIC,
        entity_id=rubric.pk,
        action="CREATE",
        actor=actor,
        after_values=_rubric_snapshot(rubric),
    )
    return rubric


@transaction.atomic
def update_rubric(*, rubric, actor, values):
    _assert_office_admin(actor)
    rubric = Rubric.objects.select_for_update().get(pk=rubric.pk)
    if rubric.is_archived:
        raise MarksStateConflict("Restore this rubric family before editing.")
    if rubric.is_locked:
        raise MarksStateConflict(
            "Locked rubric versions must be cloned before editing."
        )
    before = _rubric_snapshot(rubric)
    for field in ("name", "description", "target_mark", "is_active"):
        if field in values:
            setattr(rubric, field, values[field])
    rubric.full_clean()
    rubric.save()
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.RUBRIC,
        entity_id=rubric.pk,
        action="UPDATE",
        actor=actor,
        before_values=before,
        after_values=_rubric_snapshot(rubric),
    )
    return rubric


@transaction.atomic
def set_rubric_family_archived(*, rubric, actor, archived):
    _assert_office_admin(actor)
    versions = list(Rubric.objects.select_for_update().filter(
        family_code=rubric.family_code).order_by("pk"))
    for version in versions:
        if version.is_archived == archived:
            continue
        before = _rubric_snapshot(version)
        version.is_archived = archived
        version.save(update_fields=["is_archived", "updated_at"])
        _configuration_audit(
            entity_type=MarksConfigurationAudit.EntityType.RUBRIC,
            entity_id=version.pk, action="ARCHIVE" if archived else "RESTORE",
            actor=actor, before_values=before, after_values=_rubric_snapshot(version),
        )
    return next(version for version in versions if version.pk == rubric.pk)


def _validate_component_order(rubric, display_order, *, exclude_id=None):
    duplicate = rubric.components.filter(
        is_active=True,
        display_order=display_order,
    )
    if exclude_id:
        duplicate = duplicate.exclude(pk=exclude_id)
    if duplicate.exists():
        raise ValidationError("Display order must be unique within the rubric.")


def _validate_period_dates(academic_semester, opens_at, closes_at):
    for value, label in (
        (opens_at, "Opening timestamp"),
        (closes_at, "Closing timestamp"),
    ):
        if value is None:
            continue
        local_date = (
            timezone.localtime(value).date()
            if timezone.is_aware(value)
            else value.date()
        )
        if (
            local_date < academic_semester.starts_on
            or local_date > academic_semester.ends_on
        ):
            raise ValidationError(
                f"{label} must fall within the academic semester dates."
            )


@transaction.atomic
def create_rubric_component(*, rubric, actor, values):
    _assert_office_admin(actor)
    rubric = Rubric.objects.select_for_update().get(pk=rubric.pk)
    if rubric.is_archived:
        raise MarksStateConflict("Restore this rubric family before editing.")
    if rubric.is_locked:
        raise MarksStateConflict(
            "Locked rubric versions must be cloned before editing."
        )
    if values.get("is_active", True):
        _validate_component_order(rubric, values["display_order"])
    component = RubricComponent(rubric=rubric, **values)
    component.full_clean()
    component.save()
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.RUBRIC,
        entity_id=rubric.pk,
        action="ADD_COMPONENT",
        actor=actor,
        before_values={},
        after_values=_rubric_snapshot(rubric),
    )
    return component


@transaction.atomic
def update_rubric_component(*, component, actor, values):
    _assert_office_admin(actor)
    Rubric.objects.select_for_update().get(pk=component.rubric_id)
    component = (
        RubricComponent.objects.select_for_update()
        .select_related("rubric")
        .get(pk=component.pk)
    )
    rubric = component.rubric
    if rubric.is_archived:
        raise MarksStateConflict("Restore this rubric family before editing.")
    if rubric.is_locked:
        raise MarksStateConflict(
            "Locked rubric versions must be cloned before editing."
        )
    before = _rubric_snapshot(rubric)
    next_order = values.get("display_order", component.display_order)
    next_active = values.get("is_active", component.is_active)
    if next_active:
        _validate_component_order(
            rubric,
            next_order,
            exclude_id=component.pk,
        )
    for field in (
        "code",
        "name",
        "description",
        "max_marks",
        "is_required",
        "is_active",
        "display_order",
    ):
        if field in values:
            setattr(component, field, values[field])
    component.full_clean()
    component.save()
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.RUBRIC,
        entity_id=rubric.pk,
        action="UPDATE_COMPONENT",
        actor=actor,
        before_values=before,
        after_values=_rubric_snapshot(rubric),
    )
    return component


@transaction.atomic
def create_evaluation_period(
    *,
    actor,
    name,
    academic_semester,
    rubric,
    opens_at,
    closes_at,
    programme_scope="ALL",
    programmes=None,
    evaluator_roles=None,
):
    _assert_office_admin(actor)
    if opens_at and closes_at and opens_at >= closes_at:
        raise ValidationError("Opening timestamp must be before closing timestamp.")
    if academic_semester.lifecycle_status not in {
        AcademicSemester.Lifecycle.DRAFT,
        AcademicSemester.Lifecycle.ACTIVE,
    }:
        raise MarksStateConflict(
            "Evaluation periods can only be prepared for Draft or Active semesters."
        )
    rubric = Rubric.objects.select_for_update().get(pk=rubric.pk)
    if rubric.is_archived or not rubric.is_active:
        raise MarksStateConflict("Select a current, unarchived rubric version.")
    _validate_period_dates(academic_semester, opens_at, closes_at)
    period = EvaluationPeriod(
        name=str(name).strip(),
        semester=academic_semester.label,
        academic_semester=academic_semester,
        rubric=rubric,
        opens_at=opens_at,
        closes_at=closes_at,
        lifecycle_status=EvaluationPeriod.Lifecycle.DRAFT,
        programme_scope=programme_scope,
        programmes=[] if programmes is None else programmes,
        evaluator_roles=["SUPERVISOR", "PANEL"] if evaluator_roles is None else evaluator_roles,
    )
    normalize_period_targeting(period)
    period.save()
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.PERIOD,
        entity_id=period.pk,
        action="CREATE",
        actor=actor,
        after_values=_period_snapshot(period),
    )
    return period


@transaction.atomic
def update_evaluation_period(*, period, actor, values, reason=""):
    _assert_office_admin(actor)
    source_semester_id = period.academic_semester_id
    requested_semester = values.get("academic_semester")
    destination_semester_id = (
        requested_semester.pk if requested_semester is not None else source_semester_id
    )
    # Timeline links and semester closure take parent locks before period locks.
    # A move needs both parents; deterministic order also serializes opposite moves.
    semester_ids = {source_semester_id, destination_semester_id} - {None}
    locked_semesters = {
        semester.pk: semester for semester in AcademicSemester.objects.select_for_update()
        .filter(pk__in=semester_ids).order_by("pk")
    }
    if requested_semester is not None:
        if destination_semester_id not in locked_semesters:
            raise MarksStateConflict("The selected semester no longer exists. Reload and retry.")
        # The API may have resolved this object before a concurrent closure.
        values = {**values, "academic_semester": locked_semesters[destination_semester_id]}
    period = (
        EvaluationPeriod.objects.select_for_update()
        .select_related("rubric")
        .get(pk=period.pk)
    )
    if period.academic_semester_id != source_semester_id:
        raise MarksStateConflict("The evaluation period changed semesters. Reload and retry.")
    before = _period_snapshot(period)
    if period.lifecycle_status == EvaluationPeriod.Lifecycle.DRAFT:
        if (
            "academic_semester" in values
            and getattr(values["academic_semester"], "pk", None) != period.academic_semester_id
            and period.timeline_entries.exists()
        ):
            raise MarksStateConflict(
                "This evaluation period is linked to a semester timeline. "
                "Resolve its timeline links before moving it to another semester."
            )
        if "rubric" in values and values["rubric"].pk != period.rubric_id:
            candidate = Rubric.objects.select_for_update().get(pk=values["rubric"].pk)
            if candidate.is_archived or not candidate.is_active:
                raise MarksStateConflict("Select a current, unarchived rubric version.")
            values = {**values, "rubric": candidate}
        for field in (
            "name",
            "academic_semester",
            "rubric",
            "opens_at",
            "closes_at",
            "programme_scope",
            "programmes",
            "evaluator_roles",
        ):
            if field in values:
                setattr(period, field, values[field])
        if period.academic_semester_id is None:
            raise MarksStateConflict(
                "Select a Draft or Active academic semester."
            )
        if period.academic_semester.lifecycle_status not in {
            AcademicSemester.Lifecycle.DRAFT,
            AcademicSemester.Lifecycle.ACTIVE,
        }:
            raise MarksStateConflict(
                "Evaluation periods can only use Draft or Active semesters."
            )
        period.semester = period.academic_semester.label
        _validate_period_dates(
            period.academic_semester,
            period.opens_at,
            period.closes_at,
        )
        if (
            period.opens_at
            and period.closes_at
            and period.opens_at >= period.closes_at
        ):
            raise ValidationError(
                "Opening timestamp must be before closing timestamp."
            )
        normalize_period_targeting(period)
        action = "UPDATE"
    elif period.lifecycle_status == EvaluationPeriod.Lifecycle.PUBLISHED:
        if set(values) != {"closes_at"}:
            raise MarksStateConflict(
                "Published periods only permit a closing-time extension."
            )
        reason = str(reason).strip()
        if not reason:
            raise ValidationError("A deadline extension reason is required.")
        closes_at = values["closes_at"]
        if (
            closes_at is None
            or (period.closes_at and closes_at <= period.closes_at)
            or closes_at <= timezone.now()
        ):
            raise ValidationError(
                "The new closing timestamp must extend the current deadline."
            )
        period.closes_at = closes_at
        _validate_period_dates(
            period.academic_semester,
            period.opens_at,
            period.closes_at,
        )
        action = "EXTEND"
    else:
        raise MarksStateConflict("Closed or archived periods cannot be edited.")
    period.save()
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.PERIOD,
        entity_id=period.pk,
        action=action,
        actor=actor,
        reason=reason,
        before_values=before,
        after_values=_period_snapshot(period),
    )
    return period


@transaction.atomic
def publish_evaluation_period(*, period, actor):
    _assert_office_admin(actor)
    period = (
        EvaluationPeriod.objects.select_for_update()
        .select_related("rubric")
        .get(pk=period.pk)
    )
    if period.lifecycle_status != EvaluationPeriod.Lifecycle.DRAFT:
        raise ValidationError("Only draft evaluation periods can be published.")
    normalize_period_targeting(period)
    if period.academic_semester_id is None or not period.academic_semester.is_active:
        raise MarksStateConflict(
            "Evaluation periods can only be published for the active academic semester."
        )
    if not period.opens_at or not period.closes_at:
        raise ValidationError("Opening and closing timestamps are required.")
    if period.opens_at >= period.closes_at:
        raise ValidationError("Opening timestamp must be before closing timestamp.")
    if not period.rubric.is_ready:
        raise ValidationError(
            "Rubric components must match the configured target mark."
        )
    duplicate = EvaluationPeriod.objects.exclude(pk=period.pk).filter(
        name__iexact=period.name,
        semester__iexact=period.semester,
    ).exclude(lifecycle_status=EvaluationPeriod.Lifecycle.ARCHIVED)
    if duplicate.exists():
        raise ValidationError(
            "A non-archived evaluation period already uses this name and semester."
        )
    before = _period_snapshot(period)
    period.lifecycle_status = EvaluationPeriod.Lifecycle.PUBLISHED
    period.published_at = timezone.now()
    period.save(
        update_fields=[
            "lifecycle_status",
            "published_at",
            "is_open",
            "updated_at",
        ]
    )
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.PERIOD,
        entity_id=period.pk,
        action="PUBLISH",
        actor=actor,
        before_values=before,
        after_values=_period_snapshot(period),
    )
    return period


@transaction.atomic
def close_evaluation_period(*, period, actor, reason, preview_token=None, acknowledge_unfinished=False):
    _assert_office_admin(actor)
    reason = str(reason).strip()
    if not reason:
        raise ValidationError("A closing reason is required.")
    from academics.models import AcademicSemester
    from academics.services import SemesterConflict
    from .closure_preview import validate_period_closure, assert_period_archive_allowed
    if period.academic_semester_id:
        AcademicSemester.objects.select_for_update().get(pk=period.academic_semester_id)
    period = EvaluationPeriod.objects.select_for_update(no_key=True).get(pk=period.pk)
    if period.lifecycle_status != EvaluationPeriod.Lifecycle.PUBLISHED:
        raise MarksStateConflict("Only published periods can be closed.")
    try:
        validate_period_closure(period, preview_token=preview_token, acknowledge_unfinished=acknowledge_unfinished)
    except SemesterConflict as exc:
        raise MarksStateConflict(str(exc)) from exc
    before = _period_snapshot(period)
    period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
    period.closed_at = timezone.now()
    period.save(
        update_fields=[
            "lifecycle_status",
            "closed_at",
            "is_open",
            "updated_at",
        ]
    )
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.PERIOD,
        entity_id=period.pk,
        action="CLOSE",
        actor=actor,
        reason=reason,
        before_values=before,
        after_values=_period_snapshot(period),
    )
    return period


@transaction.atomic
def archive_evaluation_period(*, period, actor, reason):
    _assert_office_admin(actor)
    reason = str(reason).strip()
    if not reason:
        raise ValidationError("An archival reason is required.")
    from academics.models import AcademicSemester
    from academics.services import SemesterConflict
    from .closure_preview import validate_period_closure, assert_period_archive_allowed
    if period.academic_semester_id:
        AcademicSemester.objects.select_for_update().get(pk=period.academic_semester_id)
    period = EvaluationPeriod.objects.select_for_update(no_key=True).get(pk=period.pk)
    if period.lifecycle_status != EvaluationPeriod.Lifecycle.CLOSED:
        raise MarksStateConflict("Only closed periods can be archived.")
    try:
        assert_period_archive_allowed(period)
    except SemesterConflict as exc:
        raise MarksStateConflict(str(exc)) from exc
    before = _period_snapshot(period)
    period.lifecycle_status = EvaluationPeriod.Lifecycle.ARCHIVED
    period.archived_at = timezone.now()
    period.save(
        update_fields=[
            "lifecycle_status",
            "archived_at",
            "is_open",
            "updated_at",
        ]
    )
    _configuration_audit(
        entity_type=MarksConfigurationAudit.EntityType.PERIOD,
        entity_id=period.pk,
        action="ARCHIVE",
        actor=actor,
        reason=reason,
        before_values=before,
        after_values=_period_snapshot(period),
    )
    return period


@transaction.atomic
def ensure_period_tasks(period, *, actor=None):
    # Replacement holds a Student lock while inserting a task with this period
    # FK. Allow that insert to finish while generation waits for the Student.
    period = EvaluationPeriod.objects.select_for_update(no_key=True).get(pk=period.pk)
    _assert_period_allows_task_creation(period)
    created = {
        "supervisor": 0,
        "panel": 0,
    }
    initial = period_recipients(period)
    initial_keys = {row.key for row in initial}
    # Lock students before lecturers, in stable order, as appointment services do.
    list(Student.objects.select_for_update().filter(
        pk__in={row.student.pk for row in initial if row.student},
    ).order_by("pk"))
    list(Lecturer.objects.select_for_update().filter(
        pk__in={row.evaluator.pk for row in initial},
    ).order_by("pk"))
    for row in period_recipients(period):
        if row.key not in initial_keys:
            # A new candidate outside this lock set is picked up on the next run.
            continue
        _, was_created = EvaluationTask.objects.get_or_create(
            profile=row.profile,
            evaluator=row.evaluator,
            period=period,
            evaluator_role=row.role,
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
            defaults={"assigned_by": actor},
        )
        created[row.role.lower()] += int(was_created)

    created["total"] = created["supervisor"] + created["panel"]
    created["period_total"] = EvaluationTask.objects.filter(
        period=period,
        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
    ).count()
    return created


def ensure_active_period_tasks():
    for period in _active_periods():
        ensure_period_tasks(period)


@transaction.atomic
def create_backup_evaluation_task(
    *,
    period,
    profile,
    evaluator,
    actor,
    reason,
    original_task=None,
):
    _assert_office_admin(actor)
    period = EvaluationPeriod.objects.select_for_update(no_key=True).get(pk=period.pk)
    _assert_period_allows_task_creation(period)
    reason = str(reason).strip()
    if not reason:
        raise ValidationError("A manual override reason is required.")
    if evaluator.role != User.Role.LECTURER:
        raise ValidationError("Backup evaluator must be a lecturer.")
    from accounts.eligibility import (
        profile_student_is_workflow_eligible,
        user_is_assignable_lecturer,
    )
    if not user_is_assignable_lecturer(evaluator):
        raise ValidationError("Backup evaluator is not available for new assignments.")
    if not profile_student_is_workflow_eligible(profile):
        raise ValidationError(
            "The student's lifecycle status does not permit a new evaluation task."
        )
    if profile.student_id:
        student = Student.objects.select_for_update().get(pk=profile.student_id)
        if student.status != Student.Status.ACTIVE:
            raise ValidationError(
                "The student's lifecycle status does not permit a new evaluation task."
            )
    profile = StudentResearchProfile.objects.select_related("student__student").get(pk=profile.pk)
    if not profile_in_scope(period, profile):
        raise ValidationError("Student is outside the evaluation period's selected programmes.")
    if original_task and (
        original_task.period_id != period.pk
        or original_task.profile_id != profile.pk
        or original_task.evaluator_role not in period.evaluator_roles
        or original_task.evaluator_role not in {"SUPERVISOR", "PANEL"}
    ):
        raise ValidationError("Original task must match this period, student, and an included official evaluator role.")
    lecturer = Lecturer.objects.select_for_update().get(pk=evaluator.pk)
    if lecturer.lifecycle_status != Lecturer.Lifecycle.ACTIVE:
        raise ValidationError("Backup evaluator is no longer available.")
    # Historical assignments are retained, but must never be returned as a new
    # usable assignment. Period/Student/Lecturer locks serialize this decision.
    existing = EvaluationTask.objects.filter(
        profile=profile,
        evaluator=evaluator,
        period=period,
        evaluator_role=EvaluationTask.EvaluatorRole.BACKUP,
    ).exclude(lifecycle_status=EvaluationTask.Lifecycle.RETIRED)
    if existing.exists():
        raise MarksStateConflict(
            "This evaluator already has a backup assignment for this student and period. "
            "Review the existing task instead of assigning it again."
        )
    task = EvaluationTask.objects.create(
        profile=profile,
        evaluator=evaluator,
        period=period,
        evaluator_role=EvaluationTask.EvaluatorRole.BACKUP,
        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
        assigned_by=actor,
    )
    EvaluationTaskOverrideAudit.objects.create(
        task=task,
        actor=actor,
        original_evaluator=original_task.evaluator if original_task else None,
        new_evaluator=evaluator,
        reason=reason,
    )
    return task


def _draft_snapshot(task):
    try:
        entry = task.mark_entry
    except MarkEntry.DoesNotExist:
        return {}
    if entry.status == MarkEntry.Status.SUBMITTED:
        return {}
    return entry_snapshot(entry)


@transaction.atomic
def retire_official_evaluation_tasks(
    *,
    profile,
    evaluator,
    evaluator_role,
    actor,
    reason,
    replacement_evaluator=None,
):
    tasks = (
        EvaluationTask.objects.select_for_update(of=("self",))
        .filter(
            profile=profile,
            evaluator=evaluator,
            evaluator_role=evaluator_role,
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
            period__lifecycle_status__in=[EvaluationPeriod.Lifecycle.PUBLISHED, EvaluationPeriod.Lifecycle.CLOSED],
        )
        .select_related("period", "mark_entry")
    )
    retired = []
    for task in tasks:
        try:
            entry = task.mark_entry
        except MarkEntry.DoesNotExist:
            entry = None
        if entry and entry.status == MarkEntry.Status.SUBMITTED:
            continue
        snapshot = _draft_snapshot(task)
        invalidate_task_windows(task, actor, reason)
        task.lifecycle_status = EvaluationTask.Lifecycle.RETIRED
        task.retired_at = timezone.now()
        task.retired_by = actor
        task.retirement_reason = reason
        task.save(
            update_fields=[
                "lifecycle_status",
                "retired_at",
                "retired_by",
                "retirement_reason",
            ]
        )
        replacement_task = None
        if replacement_evaluator is not None and task.period.accepts_submissions and profile_in_scope(task.period, profile, evaluator_role):
            replacement_task, _ = EvaluationTask.objects.get_or_create(
                profile=profile,
                evaluator=replacement_evaluator,
                period=task.period,
                evaluator_role=evaluator_role,
                lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
                defaults={"assigned_by": actor},
            )
        EvaluationTaskHandoverAudit.objects.create(
            task=task,
            replacement_task=replacement_task,
            actor=actor,
            reason=reason,
            draft_snapshot=snapshot,
        )
        EvaluationTaskLifecycleAudit.objects.create(
            task=task,
            actor=actor,
            action=EvaluationTaskLifecycleAudit.Action.RETIRED,
            reason=reason,
            entry_snapshot=snapshot,
        )
        retired.append(task)
    return retired


def ensure_replacement_evaluation_tasks(
    *, old_appointment, replacement_appointment, actor, reason
):
    from appointments.models import SupervisorAppointment

    if isinstance(old_appointment, SupervisorAppointment):
        profile = old_appointment.student.user.research_profile
        evaluator = old_appointment.supervisor
        replacement_evaluator = replacement_appointment.supervisor
        evaluator_role = EvaluationTask.EvaluatorRole.SUPERVISOR
    else:
        profile = old_appointment.profile
        evaluator = old_appointment.panel_member
        replacement_evaluator = replacement_appointment.panel_member
        evaluator_role = EvaluationTask.EvaluatorRole.PANEL
    retired = retire_official_evaluation_tasks(
        profile=profile,
        evaluator=evaluator,
        evaluator_role=evaluator_role,
        actor=actor,
        reason=reason,
        replacement_evaluator=replacement_evaluator,
    )
    eligible_tasks = (
        EvaluationTask.objects.filter(
            profile=profile,
            evaluator=evaluator,
            evaluator_role=evaluator_role,
            period__lifecycle_status__in=[EvaluationPeriod.Lifecycle.PUBLISHED, EvaluationPeriod.Lifecycle.CLOSED],
        )
        .select_related("period", "mark_entry")
        .order_by("period_id", "pk")
    )
    for old_task in eligible_tasks:
        try:
            old_entry = old_task.mark_entry
        except MarkEntry.DoesNotExist:
            old_entry = None
        if old_entry and old_entry.status == MarkEntry.Status.SUBMITTED:
            continue
        if old_task.period.status_at() not in {"SCHEDULED", "OPEN"}:
            continue
        if not profile_in_scope(old_task.period, profile, evaluator_role):
            continue
        replacement_task, created = EvaluationTask.objects.get_or_create(
            profile=profile,
            evaluator=replacement_evaluator,
            period=old_task.period,
            evaluator_role=evaluator_role,
            lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
            defaults={"assigned_by": actor},
        )
        if created or not old_task.handover_audits.filter(
            replacement_task=replacement_task
        ).exists():
            EvaluationTaskHandoverAudit.objects.create(
                task=old_task,
                replacement_task=replacement_task,
                actor=actor,
                reason=reason,
                draft_snapshot=(
                    _draft_snapshot(old_task)
                    if old_task.lifecycle_status == EvaluationTask.Lifecycle.ACTIVE
                    else {}
                ),
            )
    return retired


def entry_snapshot(entry):
    entry.refresh_from_db()
    scores = entry.scores.select_related("component").order_by(
        "component__display_order", "component_id"
    )
    return {
        "status": entry.status,
        "totalMark": f"{entry.total_mark:.2f}",
        "comments": entry.comments,
        "scores": {
            str(score.component_id): f"{score.marks_awarded:.2f}"
            for score in scores
        },
    }


def _task_entry_snapshot(task):
    try:
        entry = task.mark_entry
    except MarkEntry.DoesNotExist:
        return {}
    return entry_snapshot(entry)


def _task_is_submitted(task):
    try:
        return task.mark_entry.status == MarkEntry.Status.SUBMITTED
    except MarkEntry.DoesNotExist:
        return False


@transaction.atomic
def pause_student_evaluation_tasks(*, profile, actor, reason):
    tasks = EvaluationTask.objects.select_for_update(of=("self",)).filter(
        profile=profile,
        lifecycle_status=EvaluationTask.Lifecycle.ACTIVE,
    ).select_related("mark_entry")
    paused = []
    for task in tasks:
        if _task_is_submitted(task):
            continue
        snapshot = _task_entry_snapshot(task)
        invalidate_task_windows(task, actor, reason)
        task.lifecycle_status = EvaluationTask.Lifecycle.PAUSED
        task.paused_at = timezone.now()
        task.paused_by = actor
        task.pause_reason = reason
        task.save(
            update_fields=[
                "lifecycle_status",
                "paused_at",
                "paused_by",
                "pause_reason",
            ]
        )
        EvaluationTaskLifecycleAudit.objects.create(
            task=task,
            actor=actor,
            action=EvaluationTaskLifecycleAudit.Action.PAUSED,
            reason=reason,
            entry_snapshot=snapshot,
        )
        paused.append(task)
    return paused


def _task_appointment_is_active(task):
    if task.evaluator_role == EvaluationTask.EvaluatorRole.SUPERVISOR:
        return SupervisorAppointment.objects.filter(
            student__matric_no=task.profile.matric_no,
            supervisor=task.evaluator,
            status=SupervisorAppointment.Status.ACTIVE,
        ).exists()
    if task.evaluator_role == EvaluationTask.EvaluatorRole.PANEL:
        return PanelAppointment.objects.filter(
            profile=task.profile,
            panel_member=task.evaluator,
            status=PanelAppointment.Status.ACTIVE,
        ).exists()
    lecturer = getattr(task.evaluator, "lecturer", None)
    return bool(
        task.evaluator.is_active
        and lecturer
        and lecturer.lifecycle_status == lecturer.Lifecycle.ACTIVE
    )


@transaction.atomic
def resume_student_evaluation_tasks(*, profile, actor, reason):
    tasks = EvaluationTask.objects.select_for_update(of=("self",)).filter(
        profile=profile,
        lifecycle_status=EvaluationTask.Lifecycle.PAUSED,
    ).select_related("period", "mark_entry", "evaluator__lecturer")
    resumed = []
    retired = []
    for task in tasks:
        snapshot = _task_entry_snapshot(task)
        if task.period.accepts_submissions and _task_appointment_is_active(task):
            task.lifecycle_status = EvaluationTask.Lifecycle.ACTIVE
            action = EvaluationTaskLifecycleAudit.Action.RESUMED
            task.paused_at = None
            task.paused_by = None
            task.pause_reason = ""
            task.save(
                update_fields=[
                    "lifecycle_status",
                    "paused_at",
                    "paused_by",
                    "pause_reason",
                ]
            )
            resumed.append(task)
        else:
            invalidate_task_windows(task, actor, reason)
            task.lifecycle_status = EvaluationTask.Lifecycle.RETIRED
            action = EvaluationTaskLifecycleAudit.Action.RETIRED
            task.retired_at = timezone.now()
            task.retired_by = actor
            task.retirement_reason = (
                "Student returned after the evaluation period or appointment ended. "
                + reason
            )
            task.save(
                update_fields=[
                    "lifecycle_status",
                    "retired_at",
                    "retired_by",
                    "retirement_reason",
                ]
            )
            retired.append(task)
        EvaluationTaskLifecycleAudit.objects.create(
            task=task,
            actor=actor,
            action=action,
            reason=reason,
            entry_snapshot=snapshot,
        )
    return {"resumed": resumed, "retired": retired}


@transaction.atomic
def retire_participant_evaluation_tasks(*, tasks, actor, reason):
    locked = EvaluationTask.objects.select_for_update(of=("self",)).filter(
        pk__in=tasks.values_list("pk", flat=True),
        lifecycle_status__in=[
            EvaluationTask.Lifecycle.ACTIVE,
            EvaluationTask.Lifecycle.PAUSED,
        ],
    ).select_related("mark_entry")
    retired = []
    for task in locked:
        if _task_is_submitted(task):
            continue
        snapshot = _task_entry_snapshot(task)
        invalidate_task_windows(task, actor, reason)
        task.lifecycle_status = EvaluationTask.Lifecycle.RETIRED
        task.retired_at = timezone.now()
        task.retired_by = actor
        task.retirement_reason = reason
        task.save(
            update_fields=[
                "lifecycle_status",
                "retired_at",
                "retired_by",
                "retirement_reason",
            ]
        )
        EvaluationTaskLifecycleAudit.objects.create(
            task=task,
            actor=actor,
            action=EvaluationTaskLifecycleAudit.Action.RETIRED,
            reason=reason,
            entry_snapshot=snapshot,
        )
        retired.append(task)
    return retired


@transaction.atomic
def reconcile_evaluation_task(*, task_id, action, actor, reason):
    """Apply one audited repair without widening it to other profile tasks."""
    task = (
        EvaluationTask.objects.select_for_update(of=("self",))
        .select_related("profile", "profile__student", "period", "mark_entry")
        .get(pk=task_id)
    )
    if _task_is_submitted(task):
        raise MarksStateConflict("Submitted Marks are immutable and cannot be reconciled.")
    snapshot = _task_entry_snapshot(task)
    if action == EvaluationTaskLifecycleAudit.Action.RETIRED:
        if task.lifecycle_status not in {
            EvaluationTask.Lifecycle.ACTIVE,
            EvaluationTask.Lifecycle.PAUSED,
        }:
            raise MarksStateConflict("The evaluation task is no longer active or paused.")
        invalidate_task_windows(task, actor, reason)
        task.lifecycle_status = EvaluationTask.Lifecycle.RETIRED
        task.retired_at = timezone.now()
        task.retired_by = actor
        task.retirement_reason = reason
        update_fields = [
            "lifecycle_status",
            "retired_at",
            "retired_by",
            "retirement_reason",
        ]
    elif action == EvaluationTaskLifecycleAudit.Action.PAUSED:
        if task.lifecycle_status != EvaluationTask.Lifecycle.ACTIVE:
            raise MarksStateConflict("Only an active evaluation task can be paused.")
        invalidate_task_windows(task, actor, reason)
        task.lifecycle_status = EvaluationTask.Lifecycle.PAUSED
        task.paused_at = timezone.now()
        task.paused_by = actor
        task.pause_reason = reason
        update_fields = [
            "lifecycle_status",
            "paused_at",
            "paused_by",
            "pause_reason",
        ]
    elif action == EvaluationTaskLifecycleAudit.Action.RESUMED:
        if task.lifecycle_status != EvaluationTask.Lifecycle.PAUSED:
            raise MarksStateConflict("Only a paused evaluation task can be resumed.")
        from accounts.eligibility import profile_student_is_workflow_eligible

        if (
            not profile_student_is_workflow_eligible(task.profile)
            or not task.period.accepts_submissions
            or not _task_appointment_is_active(task)
        ):
            raise MarksStateConflict(
                "The participant, appointment, evaluator, or period is no longer eligible."
            )
        task.lifecycle_status = EvaluationTask.Lifecycle.ACTIVE
        task.paused_at = None
        task.paused_by = None
        task.pause_reason = ""
        update_fields = [
            "lifecycle_status",
            "paused_at",
            "paused_by",
            "pause_reason",
        ]
    else:
        raise MarksStateConflict("Unsupported evaluation-task reconciliation action.")
    task.save(update_fields=update_fields)
    EvaluationTaskLifecycleAudit.objects.create(
        task=task,
        actor=actor,
        action=action,
        reason=reason,
        entry_snapshot=snapshot,
    )
    return task


def submitted_marks_version(entry):
    """Bind a reviewed form to its exact entry state without exposing audit data."""
    values = {
        "entryId": entry.pk,
        "status": entry.status,
        "updatedAt": entry.updated_at.isoformat(),
        "submittedAt": entry.submitted_at.isoformat() if entry.submitted_at else None,
        "totalMark": str(entry.total_mark),
        "comments": entry.comments,
        "scores": {str(score.component_id): str(score.marks_awarded) for score in entry.scores.all()},
    }
    return salted_hmac("marks.submitted-edit", json.dumps(values, sort_keys=True), algorithm="sha256").hexdigest()


def _lock_reviewed_mark_entry(entry, expected_version):
    # Match closure/submission lock ordering so reopening cannot race period closure.
    lock_tasks([entry.task_id])
    entry = MarkEntry.objects.select_for_update(of=("self",)).select_related("task__period__academic_semester").get(pk=entry.pk)
    if expected_version is not None and not constant_time_compare(submitted_marks_version(entry), expected_version):
        raise MarksStateConflict("This mark record changed. Reload it and review the latest values.")
    return entry


@transaction.atomic
def correct_submitted_marks(
    *,
    entry,
    actor,
    score_values,
    reason,
    comments=None,
    expected_version=None,
):
    if not can_correct_marks(actor):
        raise ValidationError("Only authorized Office Staff/Admin may modify submitted marks.")
    reason = str(reason).strip()
    if not reason:
        raise ValidationError("A correction reason is required.")
    entry = _lock_reviewed_mark_entry(entry, expected_version)
    if entry.status != MarkEntry.Status.SUBMITTED:
        raise ValidationError("Only submitted marks can be corrected.")
    before = entry_snapshot(entry)
    scores = {
        score.component_id: score
        for score in entry.scores.select_related("component")
    }
    if expected_version is not None and not (
        any(component_id not in scores or scores[component_id].marks_awarded != Decimal(value) for component_id, value in score_values.items())
        or (comments is not None and entry.comments != str(comments))
    ):
        raise ValidationError("Change at least one score or the overall comments before saving a correction.")
    for component_id, value in score_values.items():
        if component_id not in scores:
            raise ValidationError("The selected rubric component is not part of this entry.")
        score = scores[component_id]
        score.marks_awarded = Decimal(value)
        score.full_clean()
        score.save(update_fields=["marks_awarded"])
    if comments is not None:
        entry.comments = str(comments)
        entry.save(update_fields=["comments", "updated_at"])
    entry.recalculate_total()
    after = entry_snapshot(entry)
    MarkCorrectionAudit.objects.create(
        entry=entry,
        actor=actor,
        action=MarkCorrectionAudit.Action.CORRECT,
        reason=reason,
        before_values=before,
        after_values=after,
    )
    return entry


@transaction.atomic
def reopen_submitted_marks(*, entry, actor, reason, expected_version=None):
    if not can_correct_marks(actor):
        raise ValidationError("Only authorized Office Staff/Admin may modify submitted marks.")
    reason = str(reason).strip()
    if not reason:
        raise ValidationError("A reopening reason is required.")
    entry = _lock_reviewed_mark_entry(entry, expected_version)
    if entry.status != MarkEntry.Status.SUBMITTED:
        raise ValidationError("Only submitted marks can be reopened.")
    if not entry.task.period.accepts_submissions:
        raise ValidationError(
            "Marks may only be reopened while the evaluation period is open."
        )
    before = entry_snapshot(entry)
    entry.status = MarkEntry.Status.DRAFT
    entry.submitted_at = None
    entry.save(update_fields=["status", "submitted_at", "updated_at"])
    after = entry_snapshot(entry)
    MarkCorrectionAudit.objects.create(
        entry=entry,
        actor=actor,
        action=MarkCorrectionAudit.Action.REOPEN,
        reason=reason,
        before_values=before,
        after_values=after,
    )
    return entry
