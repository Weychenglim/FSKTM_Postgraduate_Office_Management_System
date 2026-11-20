"""Additional Marks stage gate; never replaces workflow, scope or role checks."""

from collections import defaultdict
from dataclasses import dataclass

from accounts.project_stages import ON_PROJECT, project_stages


@dataclass(frozen=True)
class StageEligibility:
    eligible: bool
    reason: str = ""


def profile_stage_eligibility(period, profile):
    """Convenience gate for a single existing profile; never infer a matric link."""
    return period_stage_eligibility(period, [profile.student_id])[profile.student_id]


def period_stage_eligibility(period, student_ids):
    """Read-only decisions keyed by Student PK (None means an unlinked profile).

    Uses the effective Registry stage for the period's exact academic semester.
    Callers must retain existing eligibility checks and lock/recheck before writes;
    these decisions are snapshots, not permission to create or submit a task.
    """
    ids = set(student_ids)
    if not ids:
        return {}
    if not period.academic_semester_id:
        return {pk: StageEligibility(False, "PERIOD_SEMESTER_NOT_CONFIGURED") for pk in ids}
    if period.assessment not in {"P1", "P2"}:
        return {pk: StageEligibility(False, "PERIOD_STAGE_NOT_CONFIGURED") for pk in ids}
    linked_ids = ids - {None}
    stages = project_stages(period.academic_semester, linked_ids) if linked_ids else {}
    decisions = {}
    for pk in ids:
        if pk is None:
            decisions[pk] = StageEligibility(False, "STUDENT_NOT_LINKED")
            continue
        stage = stages[pk]
        if stage.state != ON_PROJECT:
            decisions[pk] = StageEligibility(False, stage.reason or stage.state)
        elif stage.stage != period.assessment:
            decisions[pk] = StageEligibility(False, "STAGE_MISMATCH")
        else:
            decisions[pk] = StageEligibility(True)
    return decisions


def stage_monitoring_tasks(tasks):
    """Keep eligible unfinished work and submitted facts for operational totals.

    Callers retain lifecycle/role/semester filters. Submitted facts remain during
    review; inclusion does not establish academic validity. Prefetch task entries
    and lifecycle audits to avoid per-task evidence queries.
    """
    from .stage_corrections import stage_review_pending

    tasks = list(tasks)
    allowed, groups = set(), defaultdict(list)
    for task in tasks:
        entry = getattr(task, 'mark_entry', None)
        if entry and entry.status == 'SUBMITTED':
            allowed.add(task.pk)
        else:
            groups[task.period_id].append(task)
    for group in groups.values():
        decisions = period_stage_eligibility(group[0].period,
            [task.profile.student_id for task in group])
        for task in group:
            if decisions[task.profile.student_id].eligible and not stage_review_pending(task):
                allowed.add(task.pk)
    return [task for task in tasks if task.pk in allowed]
