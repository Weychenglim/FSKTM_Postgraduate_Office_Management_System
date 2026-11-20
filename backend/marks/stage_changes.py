"""Coordinator callback API. Registry authorises and saves in its own transaction.

The caller locks Student, then ProjectRegistration before invoking apply, and
validates its own registration version/current-semester rules. Marks takes the
same locks before task locks. This module never writes registration records.
"""
from django.db import connection
from django.utils.crypto import constant_time_compare

from accounts.models import ProjectRegistration, Student
from . import stage_corrections


class StageChangeStale(Exception):
    """Task evidence or the proposed stage change no longer matches the preview."""


def _validate_stages(old_stage, new_stage):
    if old_stage not in ('P1', 'P2', None) or new_stage not in ('P1', 'P2', None):
        raise ValueError('Stages must be P1, P2 or None.')


def _impact(student, academic_semester, old_stage, new_stage, tasks):
    # Do not fingerprint the live lookup: Registry may already have saved its new
    # stage before apply. The supplied transition and all task evidence are bound.
    return stage_corrections._preview_stage_change(student, academic_semester,
        new_stage, tasks=tasks, stage_context={'contract': 'coordinator-v1', 'oldStage': old_stage})


def preview_stage_change(*, student_id, academic_semester, old_stage, new_stage):
    """Return affected-work counts and an opaque token without changing records."""
    _validate_stages(old_stage, new_stage)
    student = Student.objects.get(pk=student_id)
    impact = _impact(student, academic_semester, old_stage, new_stage,
        stage_corrections.stage_tasks(student, academic_semester))
    return {key: impact[key] for key in ('notStarted', 'draft', 'submitted')} | {'token': impact['fingerprint']}


def apply_stage_change(*, student_id, academic_semester, old_stage, new_stage,
        token, actor, reason):
    """Revalidate under locks and apply; exceptions must escape Registry's atomic block."""
    if not connection.in_atomic_block:
        raise RuntimeError('Registry must wrap registration and Marks changes in one transaction.')
    _validate_stages(old_stage, new_stage)
    if not reason or not reason.strip():
        raise ValueError('A correction reason is required.')
    student = Student.objects.select_for_update().get(pk=student_id)
    record = ProjectRegistration.objects.select_for_update().filter(
        student=student, academic_semester=academic_semester).first()
    tasks = stage_corrections.stage_tasks(student, academic_semester, lock=True)
    impact = _impact(student, academic_semester, old_stage, new_stage, tasks)
    if not isinstance(token, str) or not token or not constant_time_compare(token, impact['fingerprint']):
        raise StageChangeStale('Marks work changed after preview. Reload and review it again.')
    return stage_corrections.apply_stage_change(student=student,
        academic_semester=academic_semester, actor=actor, reason=reason,
        impact=impact, tasks=tasks, revision=getattr(record, 'revision', None))
