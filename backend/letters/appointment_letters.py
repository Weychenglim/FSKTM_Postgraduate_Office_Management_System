"""Appointment letters (UC22).

When a coordinator approves a supervisor, panel or supporting supervisor
appointment, the appointment code saves a new active appointment. ``signals.py``
hears that and, once the approval is saved for good, calls
``make_letter_after_approval``. When an appointment ends or is replaced, its
letter is revoked by ``revoke_after_end``.

The letter comes from the office's active template for that kind of letter. It
is issued at once and sent to the student and the lecturers on it. If a value
the letter needs is blank, or the template has fields only the office can fill
in, the letter waits in the office's Requests instead. If there is no usable
template, the office is told, and the letter can be made later from Letter
Generation. A failed letter never undoes the approval.
"""
import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.timezone import localtime

from accounts.models import Student, User
from announcements.emails import LETTER, SIGN_OFF, email_users, portal_link
from announcements.models import Notification
from appointments.models import CoSupervisorAppointment, PanelAppointment, StudentResearchProfile, SupervisorAppointment

from .details import letter_details
from .issuing import issue_letter
from .models import GeneratedLetter, LetterPurpose, LetterTemplate
from .notices import send_notice
from .placeholders import letter_fields, placeholder_problems, value_problem

logger = logging.getLogger(__name__)

LETTER_RECORD = "APPOINTMENT_LETTER"
MISSING_RECORD = "APPOINTMENT_LETTERS_MISSING"
REQUEST_RECORD = "LETTER_REQUEST"
LIVE = (GeneratedLetter.Status.PENDING, GeneratedLetter.Status.ISSUED)
SUPERVISOR, PANEL, SUPPORTING = "supervisor", "panel", "supporting"
KINDS = {
    SUPERVISOR: (SupervisorAppointment, LetterPurpose.SUPERVISOR_APPOINTMENT, "supervisor_appointment"),
    PANEL: (PanelAppointment, LetterPurpose.PANEL_APPOINTMENT, "panel_appointment"),
    SUPPORTING: (CoSupervisorAppointment, LetterPurpose.CO_SUPERVISOR_APPOINTMENT, "co_supervisor_appointment"),
}
# How each kind is named: in a letter's name ("panel appointment letter") and
# for the person appointed ("panel member").
LETTER_WORDS = {SUPERVISOR: "supervisor", PANEL: "panel", SUPPORTING: "supporting supervisor"}
ROLE_WORDS = {SUPERVISOR: "supervisor", PANEL: "panel member", SUPPORTING: "supporting supervisor"}
LABELS = {kind: f"{word} appointment letter" for kind, word in LETTER_WORDS.items()}
STUDENT, SUPERVISOR_ROLE, PANEL_ROLE, SUPPORTING_ROLE = "Student", "Supervisor", "Panel member", "Supporting supervisor"
NOT_LINKED = "The research profile is not linked to a student account."


class LetterRefused(Exception):
    pass


class LetterValuesMissing(Exception):
    def __init__(self, errors):
        super().__init__("Fill in every value first.")
        self.errors = errors


def kind_of(appointment):
    return next(kind for kind, (model, _, _) in KINDS.items() if isinstance(appointment, model))


def kind_of_letter(letter):
    return next(kind for kind, (_, purpose, _) in KINDS.items() if letter.purpose == purpose)


def _day(value):
    if not value:
        return ""
    if hasattr(value, "hour"):
        value = localtime(value)
    return value.strftime("%d %B %Y")


def _department(user):
    lecturer = user._related_or_none("lecturer") if user else None
    return lecturer.department if lecturer else ""


def appointment_student(appointment):
    """The Student an appointment is about. A panel appointment's research
    profile names its student by account, or for older records only by matric
    number."""
    if isinstance(appointment, (SupervisorAppointment, CoSupervisorAppointment)):
        return appointment.student
    profile = appointment.profile
    if profile.student_id:
        return profile.student._related_or_none("student")
    matric = (profile.matric_no or "").strip()
    if not matric:
        return None
    return Student.objects.select_related("user").filter(matric_no__iexact=matric).first()


def _research_profile(student):
    linked = StudentResearchProfile.objects.filter(student=student.user).first()
    if linked:
        return linked
    return StudentResearchProfile.objects.filter(student__isnull=True, matric_no__iexact=student.matric_no).first()


def _primary_appointment(student):
    return (
        SupervisorAppointment.objects.filter(student=student, status=SupervisorAppointment.Status.ACTIVE)
        .select_related("application", "supervisor")
        .first()
    )


def _supervisor(appointment, student):
    """The supervisor named on the letter: the appointed one for a supervisor
    letter, the student's current primary supervisor for the others."""
    if isinstance(appointment, SupervisorAppointment):
        return appointment.supervisor
    primary = _primary_appointment(student)
    if primary:
        return primary.supervisor
    if isinstance(appointment, CoSupervisorAppointment):
        return appointment.nomination.primary_appointment.supervisor
    return appointment.supervisor


def appointment_values(appointment):
    """Every value an appointment letter can show, keyed like ``letter_details``."""
    student = appointment_student(appointment)
    values = letter_details(student)
    supervisor = _supervisor(appointment, student)
    profile = _research_profile(student)
    values.update(
        supervisorName=supervisor.full_name,
        supervisorDepartment=_department(supervisor),
        coordinatorName=appointment.approved_by.full_name,
        appointmentDate=_day(appointment.appointment_date),
    )
    if isinstance(appointment, SupervisorAppointment):
        application = appointment.application
        values.update(
            researchTitle=(profile.proposed_topic if profile else "") or application.research_title,
            researchArea=(profile.research_area if profile else "") or application.research_area,
            courseCodes=application.project_course_codes,
            supervisorAcceptedDate=_day(application.supervisor_decided_at),
            approvedDate=_day(application.coordinator_decided_at or appointment.created_at),
            semester=application.academic_semester.label if application.academic_semester_id else "",
        )
    elif isinstance(appointment, CoSupervisorAppointment):
        nomination = appointment.nomination
        primary = _primary_appointment(student) or nomination.primary_appointment
        values.update(
            researchTitle=(profile.proposed_topic if profile else "") or primary.application.research_title,
            researchArea=(profile.research_area if profile else "") or primary.application.research_area,
            courseCodes=primary.application.project_course_codes,
            coSupervisorName=appointment.supervisor.full_name,
            coSupervisorDepartment=_department(appointment.supervisor),
            coSupervisorAcceptedDate=_day(nomination.candidate_decided_at),
            approvedDate=_day(nomination.coordinator_decided_at or appointment.created_at),
            semester=nomination.academic_semester.label if nomination.academic_semester_id else "",
        )
    else:
        recommendation = appointment.recommendation
        primary = _primary_appointment(student)
        values.update(
            researchTitle=appointment.profile.proposed_topic,
            researchArea=appointment.profile.research_area,
            courseCodes=primary.application.project_course_codes if primary else "",
            panelName=appointment.panel_member.full_name,
            panelDepartment=_department(appointment.panel_member),
            panelAcceptedDate=_day(recommendation.panel_decided_at),
            approvedDate=_day(recommendation.coordinator_decided_at or appointment.created_at),
            semester=(
                recommendation.academic_semester.label
                if recommendation.academic_semester_id
                else appointment.profile.semester
            ),
        )
    return values


def recipients_for(appointment, student):
    people = [student.user]
    if isinstance(appointment, PanelAppointment):
        people.append(appointment.panel_member)
    if isinstance(appointment, CoSupervisorAppointment):
        people.append(appointment.supervisor)
    people.append(_supervisor(appointment, student))
    unique = {}
    for person in people:
        unique.setdefault(person.pk, person)
    return list(unique.values())


def relation(letter, user):
    """How ``user`` is named on ``letter``: Student, Supervisor, Panel member or
    Supporting supervisor."""
    if letter.student_id and letter.student.user_id == user.pk:
        return STUDENT
    if letter.panel_appointment_id and letter.panel_appointment.panel_member_id == user.pk:
        return PANEL_ROLE
    if letter.co_supervisor_appointment_id and letter.co_supervisor_appointment.supervisor_id == user.pk:
        return SUPPORTING_ROLE
    return SUPERVISOR_ROLE


ROLE_ORDER = {STUDENT: 0, PANEL_ROLE: 1, SUPPORTING_ROLE: 1, SUPERVISOR_ROLE: 2}


def recipient_rows(letter):
    rows = [{"name": user.full_name, "relation": relation(letter, user)} for user in letter.recipients.order_by("pk")]
    return sorted(rows, key=lambda row: ROLE_ORDER[row["relation"]])


def live_letter(appointment):
    field = KINDS[kind_of(appointment)][2]
    return GeneratedLetter.objects.filter(**{field: appointment}, status__in=LIVE).first()


def active_template(purpose):
    return LetterTemplate.objects.filter(purpose=purpose, status=LetterTemplate.Status.ACTIVE).first()


def template_problem(template, kind):
    if template is None:
        return f"There is no active {LABELS[kind]} template."
    unknown, malformed = placeholder_problems(template.content, template.custom_fields, template.purpose)
    if unknown or malformed or not (template.content or "").strip():
        return f"The active {LABELS[kind]} template has placeholder problems."
    return None


def student_problem(student):
    if student is None:
        return NOT_LINKED
    if student.status != Student.Status.ACTIVE:
        return f"The student's status is {student.status}. Letters are issued only to Active students."
    return None


# Notices


def _office_users():
    return User.objects.filter(role=User.Role.OFFICE_ADMIN, is_active=True)


def _wording(letter, role):
    data = letter.student_data or {}
    student = data.get("studentName") or "the student"
    reference = letter.reference_number
    kind = kind_of_letter(letter)
    letter_word, role_word = LETTER_WORDS[kind], ROLE_WORDS[kind]
    appointed = {PANEL: data.get("panelName"), SUPPORTING: data.get("coSupervisorName")}.get(kind) or data.get("supervisorName")
    if role == STUDENT:
        lead = (
            f"The appointment of {appointed} as your supervisor was approved."
            if kind == SUPERVISOR
            else f"{appointed} was appointed as your {role_word}."
        )
        return (
            f"Your {letter_word} appointment letter is ready",
            f"{lead} Your letter (reference {reference}) is ready to view and download.",
        )
    if role == SUPERVISOR_ROLE and kind != SUPERVISOR:
        return (
            f"Copy of {student}'s {letter_word} appointment letter",
            f"{appointed} was appointed as {student}'s {role_word}. As the supervisor, "
            f"you get a copy of the letter (reference {reference}).",
        )
    return (
        f"Appointment letter: {role_word} for {student}",
        f"You are now {student}'s {role_word}. Your copy of the appointment letter "
        f"(reference {reference}) is ready.",
    )


def notify_recipients(letter, *, replaces="", resend=0):
    """Tell everyone on an issued appointment letter, in the app and by email."""
    emails = []
    for user in letter.recipients.filter(is_active=True).order_by("pk"):
        title, message = _wording(letter, relation(letter, user))
        if replaces:
            title = f"Updated: {title}"
            message = f"{message} It replaces letter {replaces}."
        event_key = f"letters:appointment-letter:{letter.pk}"
        if resend:
            event_key = f"{event_key}:resend-{resend}"
        send_notice(
            user,
            event_key=event_key,
            title=title,
            summary=f"Reference {letter.reference_number}",
            message=message,
            record_type=LETTER_RECORD,
            record_id=letter.pk,
            reference=letter.reference_number,
        )
        emails.append((user, title, message))
    link = portal_link(f"/files/letters/{letter.pk}")

    def send():
        for user, title, message in emails:
            email_users(
                [user],
                LETTER,
                title,
                f"{message}\n\nOpen it in the portal: {link}\n\n"
                "You get this email because email alerts are on in your Settings.\n\n"
                f"{SIGN_OFF}",
            )

    transaction.on_commit(send)


def notify_revoked(letter, reason):
    """Tell the lecturers on a revoked appointment letter; ``revoke_appointment_letter``
    tells the student."""
    for user in letter.recipients.filter(is_active=True).exclude(pk=letter.student.user_id if letter.student_id else None):
        send_notice(
            user,
            event_key=f"letters:letter-revoked:{letter.pk}",
            title=f"Letter revoked: {letter.template_name}",
            summary=f"Reference {letter.reference_number}",
            message=(
                f"The {letter.template_name} for "
                f"{(letter.student_data or {}).get('studentName') or 'the student'} "
                f"({letter.reference_number}) is no longer valid. Reason: {reason}"
            ),
            record_type=LETTER_RECORD,
            record_id=letter.pk,
            reference=letter.reference_number,
            priority=Notification.Priority.HIGH,
        )


def revoke_appointment_letter(letter, *, actor, reason):
    """Revoke an issued appointment letter and tell everyone on it. The office's
    Revoke uses this, and so does an appointment that ends."""
    letter.status = GeneratedLetter.Status.REVOKED
    letter.revoked_at = timezone.now()
    letter.revoked_by = actor
    letter.revoke_reason = reason
    letter.save(update_fields=["status", "revoked_at", "revoked_by", "revoke_reason"])
    if letter.student is not None:
        send_notice(
            letter.student.user,
            event_key=f"letters:letter-revoked:{letter.pk}",
            title=f"Letter revoked: {letter.template_name}",
            summary=f"Reference {letter.reference_number}",
            message=f"Your {letter.template_name} ({letter.reference_number}) is no longer valid. Reason: {reason}",
            record_type=LETTER_RECORD,
            record_id=letter.pk,
            reference=letter.reference_number,
            priority=Notification.Priority.HIGH,
        )
    notify_revoked(letter, reason)


def notify_office_missing(appointment, problem):
    kind = kind_of(appointment)
    student = appointment_student(appointment)
    if student is not None:
        name = student.user.full_name
    elif kind == PANEL:
        name = appointment.profile.student_name or "A student"
    else:
        name = "A student"
    for user in _office_users():
        send_notice(
            user,
            event_key=f"letters:appointment-letter-missing:{kind}:{appointment.pk}",
            title="Appointment letter not made",
            summary=f"{name}, {LETTER_WORDS[kind]} appointment",
            message=(
                f"{name}'s {LETTER_WORDS[kind]} appointment was approved, but no letter was made. {problem} "
                "Fix this in Letter Generation, then press Create letters."
            ),
            record_type=MISSING_RECORD,
            record_id=appointment.pk,
        )


def notify_office_waiting(letter, needed):
    name = (letter.student_data or {}).get("studentName") or "A student"
    labels = ", ".join(field["label"] for field in needed)
    for user in _office_users():
        send_notice(
            user,
            event_key=f"letters:appointment-letter-waiting:{letter.pk}",
            title=f"Appointment letter to issue: {name}",
            summary=f"Fill in: {labels}",
            message=(
                f"{name}'s {LABELS[kind_of_letter(letter)]} is ready except for: {labels}. "
                "Fill these in, then issue it."
            ),
            record_type=REQUEST_RECORD,
            record_id=letter.pk,
        )


# Making letters


def create_appointment_letter(appointment, *, actor=None):
    """``(letter, problem)``: the appointment's letter, made now if it has none.

    ``problem`` explains why no letter could be made.
    """
    kind = kind_of(appointment)
    _, purpose, field = KINDS[kind]
    student = appointment_student(appointment)
    problem = student_problem(student)
    if problem:
        return None, problem
    existing = live_letter(appointment)
    if existing:
        return existing, None
    template = active_template(purpose)
    problem = template_problem(template, kind)
    if problem:
        return None, problem
    values = appointment_values(appointment)
    needed = [item for item in letter_fields(template.content, values, template.custom_fields) if item["needed"]]
    people = recipients_for(appointment, student)
    try:
        with transaction.atomic():
            letter = GeneratedLetter(
                student=student,
                template=template,
                template_name=template.name,
                letter_type=template.letter_type,
                purpose=purpose,
                student_data=values,
                **{field: appointment},
            )
            if needed:
                letter.status = GeneratedLetter.Status.PENDING
                letter.save()
                letter.recipients.set(people)
                notify_office_waiting(letter, needed)
            else:
                issue_letter(letter, template, values, {}, actor)
                letter.recipients.set(people)
                notify_recipients(letter)
    except IntegrityError:
        # Another worker made this appointment's letter first.
        return live_letter(appointment), None
    return letter, None


def make_letter_after_approval(model, appointment_id):
    """Run after an approval commits: make the letter, or tell the office why not."""
    appointment = None
    try:
        appointment = model.objects.get(pk=appointment_id)
        if appointment.status != model.Status.ACTIVE:
            return
        _, problem = create_appointment_letter(appointment)
        if problem:
            notify_office_missing(appointment, problem)
    except Exception:
        logger.exception("The appointment letter for %s %s was not made.", model.__name__, appointment_id)
        if appointment is not None:
            try:
                notify_office_missing(appointment, "Something went wrong while making it.")
            except Exception:
                logger.exception("The office was not told about the missing appointment letter.")


def _end_reason(appointment):
    """Why an ended appointment's letter no longer counts, in plain words."""
    kind = kind_of(appointment)
    when = _day(appointment.ended_at or timezone.now())
    if appointment.end_outcome == "REPLACED":
        try:
            replacement = appointment.replacement_appointment
        except ObjectDoesNotExist:
            replacement = None
        if replacement is not None:
            person = replacement.panel_member if kind == PANEL else replacement.supervisor
            return f"Replaced on {when}: {person.full_name} is now the {ROLE_WORDS[kind]}."
        return f"The {ROLE_WORDS[kind]} was replaced on {when}."
    return f"The {ROLE_WORDS[kind]} appointment ended on {when}."


def revoke_after_end(model, appointment_id):
    """Run after an appointment ends: its letter is revoked and the people on it
    are told. A letter still waiting for the office is withdrawn instead."""
    try:
        appointment = model.objects.get(pk=appointment_id)
        if appointment.status == model.Status.ACTIVE:
            return
        field = KINDS[kind_of(appointment)][2]
        reason = _end_reason(appointment)
        with transaction.atomic():
            for letter in GeneratedLetter.objects.select_for_update().filter(**{field: appointment}, status__in=LIVE):
                if letter.status == GeneratedLetter.Status.ISSUED:
                    revoke_appointment_letter(letter, actor=appointment.ended_by, reason=reason)
                else:
                    letter.status = GeneratedLetter.Status.WITHDRAWN
                    letter.withdrawn_at = timezone.now()
                    letter.save(update_fields=["status", "withdrawn_at"])
    except Exception:
        logger.exception("The letter for ended %s %s was not revoked.", model.__name__, appointment_id)


def missing_appointment_letters():
    """Active appointments with no letter yet, newest first, each with the
    reason it cannot be made right now (or None)."""
    rows = []
    for kind, (model, purpose, _) in KINDS.items():
        related = ("profile__student", "panel_member", "supervisor") if kind == PANEL else ("student__user", "supervisor")
        appointments = (
            model.objects.filter(status=model.Status.ACTIVE)
            .exclude(letters__status__in=LIVE)
            .select_related(*related)
        )
        template_issue = template_problem(active_template(purpose), kind)
        for appointment in appointments:
            student = appointment_student(appointment)
            if student is not None:
                name, matric = student.user.full_name, student.matric_no
            else:
                name, matric = appointment.profile.student_name, appointment.profile.matric_no
            lecturer = appointment.panel_member if kind == PANEL else appointment.supervisor
            rows.append(
                {
                    "kind": kind,
                    "appointmentId": str(appointment.pk),
                    "studentName": name,
                    "matricNumber": matric,
                    "lecturerName": lecturer.full_name,
                    "appointedOn": _day(appointment.appointment_date),
                    "problem": student_problem(student) or template_issue,
                    "_order": appointment.created_at,
                }
            )
    rows.sort(key=lambda row: row.pop("_order"), reverse=True)
    return rows


def create_letters(selection, actor):
    """Make the letters for ``selection``, a list of (kind, appointment id)."""
    results = []
    for kind, appointment_id in selection:
        model = KINDS[kind][0]
        appointment = model.objects.filter(pk=appointment_id, status=model.Status.ACTIVE).first()
        if appointment is None:
            letter, problem = None, "This appointment is no longer active."
        else:
            letter, problem = create_appointment_letter(appointment, actor=actor)
        results.append(
            {
                "kind": kind,
                "appointmentId": str(appointment_id),
                "letterId": str(letter.pk) if letter else None,
                "status": letter.status if letter else None,
                "problem": problem,
            }
        )
    return results


def letter_values(letter):
    """The values a pending letter is filled from when the office issues it."""
    if letter.is_automatic:
        appointment = letter.appointment
        if appointment is not None and appointment_student(appointment) is not None:
            return appointment_values(appointment)
        return dict(letter.student_data or {})
    return letter_details(letter.student) if letter.student else dict(letter.student_data or {})


def reissue_letter(letter_id, actor, typed_in=None):
    """Issue an appointment letter again with the current details. The old one
    is revoked as replaced, and everyone on the letter is told."""
    with transaction.atomic():
        old = GeneratedLetter.objects.select_for_update().get(pk=letter_id)
        if not old.is_automatic:
            raise LetterRefused("Only appointment letters can be reissued.")
        if old.status != GeneratedLetter.Status.ISSUED:
            raise LetterRefused("Only an issued letter can be reissued.")
        appointment = old.appointment
        if appointment is None:
            raise LetterRefused("The appointment for this letter no longer exists.")
        kind = kind_of(appointment)
        template = active_template(old.purpose)
        problem = template_problem(template, kind)
        student = appointment_student(appointment)
        problem = problem or student_problem(student)
        if problem:
            raise LetterRefused(problem)
        values = appointment_values(appointment)
        source = typed_in if typed_in is not None else (old.office_values or {})
        typed, errors = {}, {}
        for field in letter_fields(template.content, values, template.custom_fields):
            if not field["needed"]:
                continue
            value = str(source.get(field["name"]) or "").strip()
            issue = value_problem(value)
            if issue:
                errors[field["name"]] = issue
            else:
                typed[field["name"]] = value
        if errors:
            raise LetterValuesMissing(errors)
        old.status = GeneratedLetter.Status.REVOKED
        old.revoked_at = timezone.now()
        old.revoked_by = actor
        old.revoke_reason = "Replaced by a reissued letter."
        old.save(update_fields=["status", "revoked_at", "revoked_by", "revoke_reason"])
        new = GeneratedLetter(student=student, purpose=old.purpose, **{KINDS[kind][2]: appointment})
        issue_letter(new, template, values, typed, actor)
        new.recipients.set(recipients_for(appointment, student))
        old.replaced_by = new
        old.revoke_reason = f"Replaced by {new.reference_number}."
        old.save(update_fields=["replaced_by", "revoke_reason"])
        notify_recipients(new, replaces=old.reference_number)
    return new
