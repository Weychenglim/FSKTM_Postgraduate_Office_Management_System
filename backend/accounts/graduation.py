"""Graduating in two steps: the office marks who has finished, then records what the Senate approved.

CGPA and credits live in Maya, so the Senate's decision is the proof a student passed.
Unfinished work is checked when a student is marked as finished, where someone can
still fix it. Some of it stops a student. The rest only warns.
"""
import csv
import io
import re

from django.db import transaction
from django.utils import timezone

from academics.services import current_effective_semester
from appointments.models import ResearchAmendment
from letters.models import AUTOMATIC_PURPOSES, GeneratedLetter

from .models import (
    ParticipantLifecycleAudit,
    SenateDecision,
    Student,
    StudentCompletion,
    StudentRegistry,
)
from .participant_lifecycle import ParticipantLifecycleConflict, _set_student_status, student_blockers, transition_student
from .project_stages import P2, project_stages, semesters_before
from .registry_views import _avatar_bg, _initials
from .semester_rules import (
    STUDIED,
    active_semester,
    intake_label,
    is_waiting,
    progress_of,
    rows_of,
    rules_by_programme,
    starts_later,
    sync_current,
    waiting_ids,
)
from .semesters import from_parts

READY, CHECK, STOP = "ready", "check", "stop"
GRADUATED = "GRADUATED"
WAITING = "WAITING_FOR_SENATE"
MAX_LIST_BYTES = 5 * 1024 * 1024
_MATRIC_LIKE = re.compile(r"[A-Za-z]*\d{5,}[A-Za-z0-9]*")


class _Skip(Exception):
    pass


def _plural(count, word):
    return f"{count} {word}{'' if count == 1 else 's'}"


def _item(level, code, text, fix="", record_id=None):
    return {"level": level, "code": code, "text": text, "fix": fix, "recordId": record_id}


def _semester_items(progress):
    """What the semesters studied say about finishing."""
    if progress.rule is None:
        return [_item(CHECK, "NO_RULE", "No semester rule for this programme.")]
    if not progress.has_record:
        return [_item(STOP, "NO_RECORD", "No semester record.", "record")]
    short = progress.short_of_minimum
    if short >= 2:
        return [_item(STOP, "TOO_EARLY", f"Only {_plural(progress.studied, 'semester')} studied. The minimum is {progress.minimum}.", "record")]
    items = []
    if short == 1:
        items.append(_item(CHECK, "ONE_BELOW", f"{_plural(progress.studied, 'semester')} studied, 1 below the minimum.", "record"))
    if progress.past_maximum:
        items.append(_item(CHECK, "PAST_MAXIMUM", "Past the maximum semester.", "record"))
    for semester in progress.before_intake:
        items.append(_item(CHECK, "BEFORE_INTAKE", f"{semester.label} is before their intake.", "record"))
    return items


def _workflow_items(student):
    """The same pending work the status service refuses to graduate with."""
    blockers = student_blockers(student)
    items = []
    if blockers["unfinishedMarksTasks"]:
        items.append(_item(STOP, "MARKS", f"{_plural(blockers['unfinishedMarksTasks'], 'unfinished mark')}.", "marks"))
    if blockers["pendingSupervisorApplications"]:
        items.append(_item(STOP, "SUPERVISOR", "Supervisor request still waiting.", "supervisor"))
    if blockers["pendingCoSupervisorNominations"]:
        items.append(_item(STOP, "SUPPORTING", "Supporting supervisor request still waiting.", "supervisor"))
    if blockers["pendingPanelRecommendations"]:
        items.append(_item(STOP, "PANEL", "Panel request still waiting.", "panel"))
    return items


def _warning_items(student):
    """Worth a look first. None of these stops a Senate decision."""
    items = []
    letters = GeneratedLetter.objects.filter(student=student, status=GeneratedLetter.Status.PENDING).exclude(
        purpose__in=AUTOMATIC_PURPOSES
    ).count()
    if letters:
        items.append(_item(CHECK, "LETTERS", f"{_plural(letters, 'letter request')} waiting. They can only be rejected after graduating.", "letters"))
    for row in ResearchAmendment.objects.filter(student_id=student.pk, status__in=ResearchAmendment.PENDING_STATUSES):
        if row.kind == "TRANSFER":
            items.append(_item(CHECK, "TRANSFER", "A programme transfer is waiting. It would be cancelled.", "transfer", row.pk))
        else:
            items.append(_item(CHECK, "RESEARCH", "A research change is waiting. It would be cancelled.", "research"))
    return items


def _person(student):
    return {
        "matric": student.matric_no,
        "name": student.user.full_name,
        "programme": student.programme,
        "intake": intake_label(student.intake_semester),
        "avatarText": _initials(student.user.full_name),
        "avatarBg": _avatar_bg(student.matric_no),
    }


def _summary(student, progress, items):
    levels = {item["level"] for item in items}
    codes = {item["code"] for item in items}
    return {
        **_person(student),
        "studied": progress.studied,
        "minimum": progress.minimum,
        "group": STOP if STOP in levels else CHECK if CHECK in levels else READY,
        "tooEarly": "TOO_EARLY" in codes,
        "early": "ONE_BELOW" in codes,
        "items": items,
    }


def check_student(student, rules=None, progress=None, active=...):
    """One student's check. Too few semesters says enough, so nothing else is looked up."""
    progress = progress_of(student, rules) if progress is None else progress
    active = active_semester() if active is ... else active
    if starts_later(student, active):
        return _summary(student, progress, [_item(STOP, "NOT_STARTED", f"Starts in {intake_label(student.intake_semester)}.")])
    items = _semester_items(progress)
    if not any(item["code"] == "TOO_EARLY" for item in items):
        items = [*_workflow_items(student), *items, *_warning_items(student)]
    return _summary(student, progress, items)


def _with_progress(students):
    rules = rules_by_programme()
    registries = {row.student_id: row for row in StudentRegistry.objects.filter(student__in=students)}
    for student in students:
        yield student, progress_of(student, rules, rows_of(student), registries.get(student.pk))


def _students():
    return Student.objects.select_related("user", "completion").prefetch_related("semesters").order_by("user__full_name")


def last_semesters():
    """The semester a student may have finished on: the active one, or one before it when they are marked late."""
    portal = current_effective_semester()
    return [portal, *semesters_before(portal)] if portal else []


def _on_p2(students):
    ids = [student.pk for student in students]
    on_p2 = set()
    for semester in last_semesters():
        on_p2 |= {pk for pk, answer in project_stages(semester, ids).items() if answer.stage == P2}
    return on_p2


def overview():
    """Every Active student near or past the minimum, by group, for marking as finished.
    Students well below it, or who have not started yet, are only counted."""
    groups = {READY: [], CHECK: [], STOP: []}
    too_early = 0
    active = active_semester()
    students = list(_students().filter(status=Student.Status.ACTIVE).exclude(pk__in=waiting_ids()))
    on_p2 = _on_p2(students)
    for student, progress in _with_progress(students):
        if starts_later(student, active) or (progress.rule is not None and progress.has_record and progress.short_of_minimum >= 2):
            too_early += 1
            continue
        result = {**check_student(student, progress=progress, active=active), "onP2": student.pk in on_p2}
        groups[result["group"]].append(result)
    return {**groups, "tooEarly": too_early}


def waiting_list():
    """Students who have finished and are waiting for the Senate, with anything that would still stop them."""
    rows = []
    for student in _students().filter(status=Student.Status.ACTIVE, pk__in=waiting_ids()):
        last = from_parts(student.completion.last_session, student.completion.last_term)
        rows.append({
            **_person(student),
            "lastSemester": last.label if last else "",
            "early": student.completion.early_approved,
            "items": _workflow_items(student),
        })
    return rows


def _matched(matrics):
    """(students found, the numbers nobody has), keeping each number once."""
    wanted = {}
    for matric in matrics:
        text = str(matric).strip()
        if text:
            wanted.setdefault(text.casefold(), text)
    found = [student for student in _students() if student.matric_no.casefold() in wanted]
    known = {student.matric_no.casefold() for student in found}
    return found, [text for key, text in wanted.items() if key not in known]


def _not_found(matric):
    return {"matric": matric, "name": "", "why": "Not found in the portal."}


def _finish_one(student_id, last, actor, early_approved):
    student = Student.objects.select_for_update().select_related("user").get(pk=student_id)
    rows = rows_of(student)
    semesters = [(row, from_parts(row.session, row.term)) for row in rows]
    if not any(semester == last for _, semester in semesters):
        raise _Skip(f"Not on {last.label}.")
    later = [row for row, semester in semesters if semester and semester.key > last.key]
    if any(row.outcome != STUDIED for row in later):
        raise _Skip("Has a later semester on record.")
    removed = [row.pk for row in later]
    for row in later:
        row.delete()
    sync_current(student)
    student = Student.objects.select_related("user").get(pk=student_id)
    check = check_student(student)
    stopped = [item["text"] for item in check["items"] if item["level"] == STOP]
    if stopped:
        raise _Skip(stopped[0])
    if check["early"] and not early_approved:
        raise _Skip("Finishing one semester early needs approval.")
    StudentCompletion.objects.update_or_create(
        student=student,
        defaults={
            "last_session": last.session,
            "last_term": last.term,
            "early_approved": check["early"],
            "marked_by": actor,
            "marked_at": timezone.now(),
            "senate_decision": None,
        },
    )
    ParticipantLifecycleAudit.objects.create(
        student=student,
        actor=actor,
        previous_status="ACTIVE",
        new_status=WAITING,
        reason=f"Finished studies. Last semester: {last.label}.",
        affected_records={"removedSemesters": removed},
    )


def mark_finished(matrics, *, last, actor, early_approved=()):
    """Mark each student as finished separately, so one problem does not stop the others."""
    approved = {str(matric).strip().casefold() for matric in early_approved}
    found, missing = _matched(matrics)
    finished, skipped = [], [_not_found(matric) for matric in missing]
    for student in found:
        name = student.user.full_name
        if student.status != Student.Status.ACTIVE:
            skipped.append({"matric": student.matric_no, "name": name, "why": f"Their status is {student.get_status_display()}."})
            continue
        if is_waiting(student):
            skipped.append({"matric": student.matric_no, "name": name, "why": "Already waiting for the Senate."})
            continue
        try:
            with transaction.atomic():
                _finish_one(student.pk, last, actor, student.matric_no.casefold() in approved)
        except _Skip as exc:
            skipped.append({"matric": student.matric_no, "name": name, "why": str(exc)})
        else:
            finished.append({"matric": student.matric_no, "name": name})
    return {"finished": finished, "skipped": skipped}


def senate_reason(decided_on, reference):
    day = f"{decided_on.day} {decided_on:%B %Y}"
    return f"Senate meeting, {day} ({reference})" if reference else f"Senate meeting, {day}"


def record_senate_decision(matrics, *, decided_on, reference, actor):
    """Graduate who the Senate approved. Everyone is checked again, and one problem does not stop the others."""
    found, missing = _matched(matrics)
    graduated, skipped = [], [_not_found(matric) for matric in missing]
    decision = SenateDecision.objects.create(decided_on=decided_on, reference=reference, recorded_by=actor)
    reason = senate_reason(decided_on, reference)
    for student in found:
        name = student.user.full_name
        if not is_waiting(student):
            skipped.append({"matric": student.matric_no, "name": name, "why": "Not waiting for the Senate."})
            continue
        try:
            with transaction.atomic():
                transition_student(
                    matric_no=student.matric_no,
                    actor=actor,
                    target_status=GRADUATED,
                    reason=reason,
                    early_approved=student.completion.early_approved,
                )
                StudentCompletion.objects.filter(pk=student.pk).update(senate_decision=decision)
        except (ParticipantLifecycleConflict, ValueError) as exc:
            skipped.append({"matric": student.matric_no, "name": name, "why": str(exc)})
        else:
            graduated.append({"matric": student.matric_no, "name": name})
    if not graduated:
        decision.delete()
    return {"graduated": graduated, "skipped": skipped}


def return_to_active(matrics, *, actor, reason):
    """The Senate did not approve, or the results failed: they carry on studying."""
    found, missing = _matched(matrics)
    returned, skipped = [], [_not_found(matric) for matric in missing]
    for student in found:
        name = student.user.full_name
        if not is_waiting(student):
            skipped.append({"matric": student.matric_no, "name": name, "why": "Not waiting for the Senate."})
            continue
        with transaction.atomic():
            StudentCompletion.objects.filter(pk=student.pk).delete()
            ParticipantLifecycleAudit.objects.create(
                student=student, actor=actor, previous_status=WAITING, new_status="ACTIVE", reason=reason,
            )
        returned.append({"matric": student.matric_no, "name": name})
    return {"returned": returned, "skipped": skipped}


@transaction.atomic
def correct_graduation(matric, *, actor, reason):
    """Undo a wrong entry: back to waiting for the Senate. Closed appointments stay closed."""
    student = Student.objects.select_for_update().select_related("user").get(matric_no__iexact=matric)
    if student.status != Student.Status.GRADUATED:
        raise ParticipantLifecycleConflict("Only a graduated student can be corrected.", {})
    latest = rows_of(student)[-1:] or [None]
    completion = StudentCompletion.objects.filter(pk=student.pk).first()
    defaults = {"senate_decision": None}
    if completion is None:
        if latest[0] is None:
            raise ParticipantLifecycleConflict("Add this student's semesters first.", {})
        defaults.update(last_session=latest[0].session, last_term=latest[0].term, marked_by=actor)
    StudentCompletion.objects.update_or_create(student=student, defaults=defaults)
    _set_student_status(student, target=Student.Status.ACTIVE, actor=actor, reason=reason, affected={"correction": True})
    student.refresh_from_db()
    return student


def _table(uploaded):
    name = (uploaded.name or "").lower()
    if name.endswith(".csv"):
        return list(csv.reader(io.StringIO(uploaded.read().decode("utf-8-sig", errors="replace"))))
    if name.endswith(".xlsx"):
        from openpyxl import load_workbook

        book = load_workbook(uploaded, read_only=True, data_only=True)
        try:
            return [["" if cell is None else str(cell) for cell in row] for sheet in book.worksheets for row in sheet.iter_rows(values_only=True)]
        finally:
            book.close()
    if name.endswith(".pdf"):
        from pypdf import PdfReader

        text = "\n".join(page.extract_text() or "" for page in PdfReader(uploaded).pages)
        return [[token] for token in _MATRIC_LIKE.findall(text)]
    raise ValueError("Upload an Excel, CSV or PDF file.")


def match_senate_list(uploaded):
    """Which waiting students are on the office's copy of the Senate's list. The file is read and not kept."""
    if uploaded.size > MAX_LIST_BYTES:
        raise ValueError("The file is too large. The limit is 5 MB.")
    try:
        rows = _table(uploaded)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("This file could not be read.") from exc
    students = {student.matric_no.casefold(): student for student in Student.objects.select_related("user")}
    waiting = set(waiting_ids().filter(student__status=Student.Status.ACTIVE).values_list("student_id", flat=True))
    columns = {}
    for row in rows:
        for index, cell in enumerate(row):
            if str(cell).strip().casefold() in students:
                columns[index] = columns.get(index, 0) + 1
    matric_column = max(columns, key=columns.get) if columns else None
    matched, not_waiting, not_found = [], [], []
    for row in rows:
        if matric_column is None or matric_column >= len(row):
            continue
        text = str(row[matric_column]).strip()
        student = students.get(text.casefold())
        if student is None:
            if any(char.isdigit() for char in text):
                not_found.append(text)
        elif student.pk in waiting:
            matched.append(student.matric_no)
        else:
            not_waiting.append({"matric": student.matric_no, "name": student.user.full_name, "status": student.get_status_display()})
    return {
        "matched": sorted(set(matched)),
        "notWaiting": list({row["matric"]: row for row in not_waiting}.values()),
        "notFound": sorted(set(not_found)) if not (uploaded.name or "").lower().endswith(".pdf") else [],
    }
