"""Programme and official-role eligibility shared by preview and task creation."""

from dataclasses import dataclass

from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.utils import timezone

from accounts.eligibility import student_is_workflow_eligible, user_is_assignable_lecturer
from accounts.models import Student
from accounts.semester_rules import active_semester
from appointments.models import PanelAppointment, StudentResearchProfile, SupervisorAppointment
from .models import EvaluationTask
from .stage_eligibility import period_stage_eligibility


def normalize_targeting(scope, programmes, roles):
    if scope not in {"ALL", "SELECTED"}:
        raise ValidationError("Programme scope must be ALL or SELECTED.")
    if not isinstance(programmes, list) or any(
        not isinstance(value, str) or not value.strip() or len(value.strip()) > 255
        for value in programmes
    ):
        raise ValidationError("Programmes must be a list of nonblank programme names.")
    names = {}
    for value in programmes:
        names.setdefault(value.strip().casefold(), value.strip())
    if scope == "SELECTED" and not names:
        raise ValidationError("Select at least one programme.")
    if not isinstance(roles, list) or not roles or any(
        role not in ("SUPERVISOR", "PANEL") for role in roles
    ):
        raise ValidationError("Select Supervisor, Panel, or both evaluator roles.")
    return scope, list(names.values()) if scope == "SELECTED" else [], list(dict.fromkeys(roles))


def normalize_period_targeting(period):
    period.programme_scope, period.programmes, period.evaluator_roles = normalize_targeting(
        period.programme_scope, period.programmes, period.evaluator_roles,
    )


def programme_matches(period, programme):
    return period.programme_scope == "ALL" or programme.strip().casefold() in {
        name.strip().casefold() for name in period.programmes
    }


def profile_student(profile):
    if not profile.student_id:
        return None
    try:
        return profile.student.student
    except ObjectDoesNotExist:
        return None


def profile_programme(profile):
    student = profile_student(profile)
    if profile.student_id:
        return student.programme.strip() if student else ""
    return profile.programme.strip()


def profile_in_scope(period, profile, role=None):
    return programme_matches(period, profile_programme(profile)) and (
        role is None or role in period.evaluator_roles
    )


def programme_options():
    values = list(Student.objects.values_list("programme", flat=True))
    values.extend(StudentResearchProfile.objects.values_list("programme", flat=True))
    names = {}
    for value in sorted(values):
        if value.strip():
            names.setdefault(value.strip().casefold(), value.strip())
    return sorted(names.values(), key=str.casefold)


@dataclass
class Recipient:
    profile: StudentResearchProfile
    student: Student | None
    evaluator: object
    role: str

    @property
    def key(self):
        return self.profile.pk, self.evaluator.pk, self.role


def official_assignment_paused(period, profile, role):
    """A new evaluator must not bypass paused work for the same official role."""
    from .stage_corrections import assignment_stage_review_pending
    return EvaluationTask.objects.filter(
        period=period, profile=profile, evaluator_role=role, lifecycle_status='PAUSED',
    ).exists() or assignment_stage_review_pending(period, profile, role)


def period_recipients(period):
    """Read-only current eligibility; callers must lock and recheck before writes."""
    profiles = list(StudentResearchProfile.objects.select_related("student__student"))
    linked = {profile.student_id: profile for profile in profiles if profile.student_id}
    stages = period_stage_eligibility(period, linked)
    current_semester = active_semester()
    recipients = {}
    if "SUPERVISOR" in period.evaluator_roles:
        appointments = SupervisorAppointment.objects.filter(
            status=SupervisorAppointment.Status.ACTIVE,
            student__status=Student.Status.ACTIVE,
        ).select_related("student__user", "supervisor__lecturer")
        for appointment in appointments:
            student = appointment.student
            profile = linked.get(student.user_id)
            if (profile is None or not profile_in_scope(period, profile)
                    or not stages[student.pk].eligible or not student_is_workflow_eligible(student, current_semester=current_semester)
                    or not user_is_assignable_lecturer(appointment.supervisor)):
                continue
            recipient = Recipient(profile, student, appointment.supervisor, "SUPERVISOR")
            recipients[recipient.key] = recipient
    if "PANEL" in period.evaluator_roles:
        appointments = PanelAppointment.objects.filter(
            status=PanelAppointment.Status.ACTIVE,
        ).select_related("profile__student__student", "panel_member__lecturer")
        for appointment in appointments:
            profile = appointment.profile
            student = profile_student(profile)
            if (not student or not student_is_workflow_eligible(student, current_semester=current_semester)
                    or student.pk not in stages or not stages[student.pk].eligible):
                continue
            if not profile_in_scope(period, profile) or not user_is_assignable_lecturer(appointment.panel_member):
                continue
            recipient = Recipient(profile, student, appointment.panel_member, "PANEL")
            recipients[recipient.key] = recipient
    return sorted(recipients.values(), key=lambda row: (row.profile.matric_no, row.role, row.evaluator.pk))


def recipient_preview(period):
    recipients = period_recipients(period)
    existing = {
        (profile_id, evaluator_id, role): lifecycle
        for profile_id, evaluator_id, role, lifecycle in EvaluationTask.objects.filter(
            period=period, lifecycle_status__in=['ACTIVE', 'PAUSED'],
        ).values_list('profile_id', 'evaluator_id', 'evaluator_role', 'lifecycle_status')
    }
    paused_roles = {(profile_id, role) for (profile_id, _, role), state in existing.items() if state == 'PAUSED'}
    from .stage_corrections import stage_review_pending
    paused_roles.update((task.profile_id, task.evaluator_role) for task in
        EvaluationTask.objects.filter(period=period, lifecycle_audits__action='STAGE_REVIEW')
        .distinct().prefetch_related('lifecycle_audits') if stage_review_pending(task))
    rows = [{
        "studentId": row.student.pk if row.student else None,
        "matricNo": row.profile.matric_no,
        "studentName": row.student.user.full_name if row.student else row.profile.student_name,
        "programme": profile_programme(row.profile),
        "evaluatorId": row.evaluator.pk,
        "evaluatorName": row.evaluator.full_name,
        "evaluatorRole": row.role,
        "taskStatus": "PAUSED" if existing.get(row.key) == 'PAUSED' else "EXISTING" if row.key in existing
            else "BLOCKED" if (row.profile.pk, row.role) in paused_roles else "NEW",
    } for row in recipients]
    # Include eligible students without a research profile so the preview explains
    # why selecting their programme does not yet generate any evaluation tasks.
    profiles = list(StudentResearchProfile.objects.select_related("student__student"))
    candidates = {}
    for profile in profiles:
        student = profile_student(profile)
        if profile_in_scope(period, profile):
            key = ('student', student.pk) if student else ('profile', profile.pk)
            candidates[key] = (student, profile)
    for student in Student.objects.filter(status__in=[Student.Status.ACTIVE, Student.Status.DEFERRED]).select_related('user'):
        if programme_matches(period, student.programme):
            candidates.setdefault(('student', student.pk), (student, None))
    stages = period_stage_eligibility(period, [student.pk for student, _ in candidates.values() if student])
    current_semester = active_semester()
    expected_students, exclusions, reason_counts = set(), [], {}
    for key, (student, profile) in candidates.items():
        reason = stages[student.pk].reason if student else 'STUDENT_NOT_LINKED'
        if not reason and not student_is_workflow_eligible(student, current_semester=current_semester):
            reason = 'STUDENT_INELIGIBLE'
        if reason:
            exclusions.append({
                'studentId': student.pk if student else None,
                'matricNo': student.matric_no if student else profile.matric_no,
                'studentName': student.user.full_name if student else profile.student_name,
                'programme': student.programme if student else profile.programme,
                'reason': reason,
            })
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        else:
            expected_students.add(key)
    missing, missing_assignments = {}, []
    for role in ("SUPERVISOR", "PANEL"):
        covered = {
            ("student", row.student.pk)
            for row in recipients if row.role == role
        }
        missing[role.lower()] = len(expected_students - covered) if role in period.evaluator_roles else 0
        if role in period.evaluator_roles:
            for key in sorted(expected_students - covered):
                student, profile = candidates[key]
                missing_assignments.append({
                    'studentId': student.pk, 'matricNo': student.matric_no,
                    'studentName': student.user.full_name, 'programme': student.programme,
                    'reason': 'MISSING_RESEARCH_PROFILE' if profile is None else f'MISSING_{role}_APPOINTMENT',
                })
    return {
        "periodId": period.pk,
        "semesterId": period.academic_semester_id,
        "generatedAt": timezone.now().isoformat(),
        "recipients": rows,
        "totals": {
            "students": len({row.profile.pk for row in recipients}),
            "supervisor": sum(row.role == "SUPERVISOR" for row in recipients),
            "panel": sum(row.role == "PANEL" for row in recipients),
            "total": len(rows),
            "existing": sum(row["taskStatus"] in {"EXISTING", "PAUSED"} for row in rows),
            "new": sum(row["taskStatus"] == "NEW" for row in rows),
        },
        "missingAppointments": missing,
        "missingAssignments": list({(row['studentId'], row['reason']): row for row in missing_assignments}.values()),
        "eligibility": {"expectedStudents": len(expected_students), "excludedStudents": len(exclusions), "reasonCounts": reason_counts},
        "exclusions": sorted(exclusions, key=lambda row: row['matricNo']),
        "configurationIssues": (["PERIOD_SEMESTER_NOT_CONFIGURED"] if not period.academic_semester_id else [])
            + (["PERIOD_STAGE_NOT_CONFIGURED"] if period.assessment not in {'P1', 'P2'} else []),
    }
