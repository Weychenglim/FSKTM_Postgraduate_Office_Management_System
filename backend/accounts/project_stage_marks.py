"""What a project stage change does to Marks tasks.

Marks does the real work in ``marks.stage_changes``. Until that module exists,
Registry only counts the tasks a change would leave on the wrong stage.
"""
import hashlib
import importlib

COUNTS = ("notStarted", "draft", "submitted")


class MarksChanged(Exception):
    """Marks says its tasks changed after the coordinator looked."""


def _marks():
    try:
        return importlib.import_module("marks.stage_changes")
    except ModuleNotFoundError as exc:
        if exc.name == "marks.stage_changes":
            return None
        raise


def count_tasks(student, academic_semester, old_stage, new_stage):
    from marks.models import EvaluationTask, MarkEntry

    counts = dict.fromkeys(COUNTS, 0)
    if old_stage == new_stage:
        return {**counts, "token": ""}
    tasks = (
        EvaluationTask.objects.filter(
            profile__student_id=student.pk,
            period__academic_semester=academic_semester,
            period__assessment__in=("P1", "P2"),
        )
        .exclude(lifecycle_status=EvaluationTask.Lifecycle.RETIRED)
        .exclude(period__assessment=new_stage or "")
        .select_related("mark_entry")
        .order_by("pk")
    )
    seen = []
    for task in tasks:
        entry = getattr(task, "mark_entry", None)
        state = entry.status if entry else MarkEntry.Status.NOT_STARTED
        if state == MarkEntry.Status.SUBMITTED:
            counts["submitted"] += 1
        elif state == MarkEntry.Status.DRAFT:
            counts["draft"] += 1
        else:
            counts["notStarted"] += 1
        seen.append(f"{task.pk}:{state}:{entry.updated_at.isoformat() if entry else ''}")
    token = hashlib.sha256("|".join(seen).encode()).hexdigest()[:16] if seen else ""
    return {**counts, "token": token}


def preview_marks(student, academic_semester, old_stage, new_stage):
    module = _marks()
    if module is None:
        return count_tasks(student, academic_semester, old_stage, new_stage)
    return module.preview_stage_change(
        student_id=student.pk, academic_semester=academic_semester, old_stage=old_stage, new_stage=new_stage,
    )


def apply_marks(student, academic_semester, old_stage, new_stage, *, token, actor, reason):
    module = _marks()
    if module is None:
        return
    try:
        module.apply_stage_change(
            student_id=student.pk,
            academic_semester=academic_semester,
            old_stage=old_stage,
            new_stage=new_stage,
            token=token,
            actor=actor,
            reason=reason,
        )
    except Exception as exc:
        if type(exc).__name__ == "StageChangeStale":
            raise MarksChanged(str(exc)) from exc
        raise


def touches_marks(impact):
    return any(impact.get(key) for key in COUNTS)
