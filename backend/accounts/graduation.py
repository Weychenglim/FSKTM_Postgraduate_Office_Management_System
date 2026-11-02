"""Who can graduate, what is still unfinished for each student, and graduating many at once.

CGPA and credits live in Maya, so the Senate's list is the proof a student passed.
These checks cover everything else the portal knows. Some stop a student
graduating. Others only warn: the office decides, because they should not hold up
a Senate decision.
"""
from appointments.models import ResearchAmendment
from documents.models import Document, DocumentStudent
from documents.required import STILL_TO_HAND_IN, mine
from letters.models import AUTOMATIC_PURPOSES, GeneratedLetter

from .models import Student, StudentRegistry
from .participant_lifecycle import ParticipantLifecycleConflict, student_blockers, transition_student
from .registry_views import _avatar_bg, _initials
from .semester_rules import progress_of, rows_of, rules_by_programme

READY, CHECK, STOP = "ready", "check", "stop"
GRADUATED = "GRADUATED"


def _plural(count, word):
    return f"{count} {word}{'' if count == 1 else 's'}"


def _item(level, code, text, fix="", record_id=None):
    return {"level": level, "code": code, "text": text, "fix": fix, "recordId": record_id}


def _semester_items(progress):
    """What the semesters studied say about graduating."""
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
    owed = sum(1 for _, state, _ in mine(student) if state in STILL_TO_HAND_IN)
    if owed:
        items.append(_item(CHECK, "DOCUMENTS", f"{_plural(owed, 'required document')} still owed.", "documents"))
    waiting = DocumentStudent.objects.filter(
        student=student, document__check_status=Document.CheckStatus.WAITING, document__archived_at__isnull=True,
    ).count()
    if waiting:
        items.append(_item(CHECK, "FILES", f"{_plural(waiting, 'file')} waiting for a check.", "documents"))
    for row in ResearchAmendment.objects.filter(student_id=student.pk, status__in=ResearchAmendment.PENDING_STATUSES):
        if row.kind == "TRANSFER":
            items.append(_item(CHECK, "TRANSFER", "A programme transfer is waiting. It would be cancelled.", "transfer", row.pk))
        else:
            items.append(_item(CHECK, "RESEARCH", "A research change is waiting. It would be cancelled.", "research"))
    return items


def _summary(student, progress, items):
    levels = {item["level"] for item in items}
    codes = {item["code"] for item in items}
    return {
        "matric": student.matric_no,
        "name": student.user.full_name,
        "programme": student.programme,
        "avatarText": _initials(student.user.full_name),
        "avatarBg": _avatar_bg(student.matric_no),
        "studied": progress.studied,
        "minimum": progress.minimum,
        "group": STOP if STOP in levels else CHECK if CHECK in levels else READY,
        "tooEarly": "TOO_EARLY" in codes,
        "early": "ONE_BELOW" in codes,
        "items": items,
    }


def check_student(student, rules=None, progress=None):
    """One student's graduation check. Too few semesters says enough, so nothing else is looked up."""
    progress = progress_of(student, rules) if progress is None else progress
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
    return Student.objects.select_related("user").prefetch_related("semesters").order_by("user__full_name")


def overview():
    """Every Active student near or past the minimum, by group. Students well below it are only counted."""
    groups = {READY: [], CHECK: [], STOP: []}
    too_early = 0
    for student, progress in _with_progress(list(_students().filter(status=Student.Status.ACTIVE))):
        if progress.rule is not None and progress.has_record and progress.short_of_minimum >= 2:
            too_early += 1
            continue
        result = check_student(student, progress=progress)
        groups[result["group"]].append(result)
    return {**groups, "tooEarly": too_early}


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


def check_list(matrics):
    """What the portal says about the students on a pasted list."""
    found, missing = _matched(matrics)
    groups = {READY: [], CHECK: [], STOP: []}
    not_active = []
    active = [student for student in found if student.status == Student.Status.ACTIVE]
    for student in found:
        if student.status != Student.Status.ACTIVE:
            not_active.append({"matric": student.matric_no, "name": student.user.full_name, "status": student.status})
    for student, progress in _with_progress(active):
        result = check_student(student, progress=progress)
        groups[result["group"]].append(result)
    return {**groups, "notFound": missing, "notActive": not_active}


def graduate_many(matrics, *, actor, reason, early_approved=()):
    """Graduate each student separately, so one problem does not stop the others.
    Everything is checked again here, because the page may be out of date."""
    approved = {str(matric).strip().casefold() for matric in early_approved}
    found, missing = _matched(matrics)
    rules = rules_by_programme()
    graduated, skipped = [], [{"matric": matric, "name": "", "why": "Not found in the portal."} for matric in missing]
    for student in found:
        name = student.user.full_name
        if student.status != Student.Status.ACTIVE:
            skipped.append({"matric": student.matric_no, "name": name, "why": f"Their status is {student.status}."})
            continue
        check = check_student(student, rules)
        stopped = [item["text"] for item in check["items"] if item["level"] == STOP]
        if stopped:
            skipped.append({"matric": student.matric_no, "name": name, "why": stopped[0]})
            continue
        early = student.matric_no.casefold() in approved
        if check["early"] and not early:
            skipped.append({"matric": student.matric_no, "name": name, "why": "Finishing one semester early needs approval."})
            continue
        try:
            transition_student(
                matric_no=student.matric_no, actor=actor, target_status=GRADUATED, reason=reason, early_approved=early,
            )
        except (ParticipantLifecycleConflict, ValueError) as exc:
            skipped.append({"matric": student.matric_no, "name": name, "why": str(exc)})
        else:
            graduated.append({"matric": student.matric_no, "name": name})
    return {"graduated": graduated, "skipped": skipped}
