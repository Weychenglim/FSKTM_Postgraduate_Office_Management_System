from appointments.request_visibility import routine_supervisor_requests
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import Http404
from django.utils import timezone

from academics.services import current_effective_semester
from accounts.authorization import coordinator_manages_programme
from accounts.models import Student
from appointments.ageing import (
    panel_waiting_metadata,
    supervisor_waiting_metadata,
)
from appointments.models import (
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)
from appointments.serializers import AppointmentWorkflowEventSerializer
from marks.deadlines import mark_deadline_metadata
from marks.models import EvaluationTask, MarkEntry

from .models import SemesterTimeline


User = get_user_model()
SECTION_SUPERVISOR = "SUPERVISOR"
SECTION_PANEL = "PANEL"
SECTION_MARKS = "MARKS"
SECTION_TIMELINE = "TIMELINE"


def _research_profile(student):
    return (
        StudentResearchProfile.objects.select_related("supervisor")
        .filter(
            Q(student=student.user) | Q(matric_no__iexact=student.matric_no)
        )
        .first()
    )


def _lecturer_relationships(user, student, profile):
    supervisor_related = (
        SupervisorApplication.objects.filter(
            student=student,
            proposed_supervisor=user,
        ).exists()
        or SupervisorAppointment.objects.filter(
            student=student,
            supervisor=user,
        ).exists()
        or bool(profile and profile.supervisor_id == user.pk)
    )
    panel_related = bool(
        profile
        and (
            PanelRecommendation.objects.filter(profile=profile)
            .filter(Q(supervisor=user) | Q(recommended_member=user))
            .exists()
            or PanelAppointment.objects.filter(profile=profile)
            .filter(Q(supervisor=user) | Q(panel_member=user))
            .exists()
        )
    )
    marks_related = bool(
        profile
        and EvaluationTask.objects.filter(
            profile=profile,
            evaluator=user,
        ).exists()
    )
    return {
        SECTION_SUPERVISOR: supervisor_related,
        SECTION_PANEL: panel_related,
        SECTION_MARKS: marks_related,
    }


def _resolve_access(user, student, profile):
    if user.role == User.Role.OFFICE_ADMIN:
        return "INTERNAL", {
            SECTION_SUPERVISOR,
            SECTION_PANEL,
            SECTION_MARKS,
            SECTION_TIMELINE,
        }
    if user.role == User.Role.COORDINATOR:
        if not coordinator_manages_programme(user, student.programme):
            raise Http404
        return "INTERNAL", {
            SECTION_SUPERVISOR,
            SECTION_PANEL,
            SECTION_TIMELINE,
        }
    if user.role == User.Role.LECTURER:
        relationships = _lecturer_relationships(user, student, profile)
        visible = {
            section for section, is_related in relationships.items() if is_related
        }
        if not visible:
            raise Http404
        visible.add(SECTION_TIMELINE)
        return "INTERNAL", visible
    if user.role == User.Role.STUDENT and student.user_id == user.pk:
        return "PUBLIC", {
            SECTION_SUPERVISOR,
            SECTION_PANEL,
            SECTION_TIMELINE,
        }
    raise Http404


def _iso(value):
    return value.isoformat() if value is not None else None


def _workflow(events):
    return AppointmentWorkflowEventSerializer(events, many=True).data


def _semester_metadata(semester):
    return {
        "semester": semester.label if semester else "Legacy / Unassigned",
        "semesterId": semester.pk if semester else None,
        "semesterCode": semester.code if semester else None,
    }


def _supervisor_records(student, user, visibility, now):
    applications_query = (
        SupervisorApplication.objects.filter(student=student)
        .select_related(
            "proposed_supervisor",
            "appointment",
            "academic_semester",
        )
        .prefetch_related("workflow_events__actor")
        .order_by("-updated_at", "-created_at", "-id")
    )
    applications_query = routine_supervisor_requests(applications_query, user)
    if user.role == User.Role.LECTURER:
        applications_query = applications_query.filter(proposed_supervisor=user)
    applications = sorted(
        applications_query,
        key=lambda application: (
            application.status in SupervisorApplication.ACTIVE_STATUSES,
            application.updated_at,
            application.pk,
        ),
        reverse=True,
    )

    records = []
    for application in applications:
        waiting = supervisor_waiting_metadata(application, now=now)
        record = {
            "recordId": str(application.pk),
            "status": application.status,
            "researchTitle": application.research_title,
            "researchArea": application.research_area,
            "proposedSupervisor": application.proposed_supervisor.full_name,
            "submittedAt": _iso(application.submitted_at),
            "supervisorDecisionAt": _iso(application.supervisor_decided_at),
            "coordinatorDecisionAt": _iso(application.coordinator_decided_at),
            "cancelledAt": _iso(application.cancelled_at),
            "rejectionReason": application.rejection_reason or None,
            "cancellationReason": application.cancellation_reason or None,
            "waitingSince": _iso(waiting["waitingSince"]),
            "waitingDays": waiting["waitingDays"],
            "waitingOn": waiting["waitingOn"],
            "targetModule": "SUPERVISOR_APPOINTMENTS",
            "recordType": "SUPERVISOR_APPLICATION",
            "appointment": None,
            **_semester_metadata(application.academic_semester),
        }
        if visibility == "PUBLIC" and any(
            event.action == "OFFICE_CANCEL_PARTICIPANT_LIFECYCLE"
            for event in application.workflow_events.all()
        ):
            record["cancellationReason"] = None
        try:
            appointment = application.appointment
        except SupervisorAppointment.DoesNotExist:
            appointment = None
        if appointment:
            record["appointment"] = {
                "appointmentDate": appointment.appointment_date.isoformat(),
                "status": appointment.status,
                "supervisor": appointment.supervisor.full_name,
                "endOutcome": appointment.end_outcome or None,
                "endedAt": _iso(appointment.ended_at),
            }
        if visibility == "INTERNAL":
            record["workflow"] = _workflow(application.workflow_events.all())
            if appointment:
                record["appointment"].update(
                    {
                        "appointmentId": appointment.pk,
                        "endReason": appointment.end_reason or None,
                        "endedBy": (
                            appointment.ended_by.full_name
                            if appointment.ended_by_id
                            else None
                        ),
                        "supersedesAppointmentId": appointment.supersedes_id,
                    }
                )
                record["appointment"]["lifecycle"] = [
                    {
                        "id": event.pk,
                        "action": event.action,
                        "actorName": event.actor.full_name,
                        "actorRole": event.actor_role,
                        "previousStatus": event.previous_status,
                        "newStatus": event.new_status,
                        "outcome": event.outcome or None,
                        "reason": event.reason or None,
                        "createdAt": _iso(event.created_at),
                    }
                    for event in appointment.lifecycle_events.select_related("actor")
                ]
        records.append(record)

    current = next(
        (
            record
            for record in records
            if record["status"] in SupervisorApplication.ACTIVE_STATUSES
        ),
        records[0] if records else None,
    )
    return {
        "currentRecordId": current["recordId"] if current else None,
        "records": records,
    }


def _student_panel_records(profile):
    """Publish appointment results, never the faculty's nomination attempts."""
    from appointments.student_panel import current_student_panel_records

    current, pending = current_student_panel_records(profile)
    base = {
        "waitingSince": None, "waitingDays": None,
        "targetModule": "PANEL_APPOINTMENTS", "recordType": "PANEL_APPOINTMENT",
    }

    def appointment_record(appointment):
        return {
            **base,
            "status": "CONFIRMED" if appointment.status == PanelAppointment.Status.ACTIVE else appointment.status,
            "appointment": {
                "appointmentDate": appointment.appointment_date.isoformat(),
                "status": appointment.status,
                "panelMember": appointment.panel_member.full_name,
                "endedAt": _iso(appointment.ended_at),
            },
        }

    records = [appointment_record(current)] if current else []
    if not current and pending:
        records.append({**base, "status": "FACULTY_PROCESSING", "appointment": None})
    history = PanelAppointment.objects.filter(profile=profile).exclude(
        status=PanelAppointment.Status.ACTIVE,
    ).select_related("panel_member").order_by("-appointment_date", "-pk")
    records.extend(appointment_record(appointment) for appointment in history)
    return {"records": records}


def _panel_records(profile, user, visibility, now):
    if profile is None:
        return {"currentRecordId": None, "records": []}
    if visibility == "PUBLIC":
        return _student_panel_records(profile)
    recommendations_query = (
        PanelRecommendation.objects.filter(profile=profile)
        .select_related(
            "supervisor",
            "recommended_member",
            "panel_appointment",
            "academic_semester",
        )
        .prefetch_related("workflow_events__actor")
        .order_by("-updated_at", "-created_at", "-id")
    )
    if user.role == User.Role.LECTURER:
        recommendations_query = recommendations_query.filter(
            Q(supervisor=user) | Q(recommended_member=user)
        )
    recommendations = sorted(
        recommendations_query,
        key=lambda recommendation: (
            recommendation.status in PanelRecommendation.ACTIVE_STATUSES,
            recommendation.updated_at,
            recommendation.pk,
        ),
        reverse=True,
    )

    records = []
    for recommendation in recommendations:
        waiting = panel_waiting_metadata(
            recommendation,
            now=now,
            public=False,
        )
        record = {
            "recordId": str(recommendation.pk),
            "status": recommendation.status,
            "supervisor": recommendation.supervisor.full_name,
            "recommendedMember": recommendation.recommended_member.full_name,
            "submittedAt": _iso(recommendation.submitted_at),
            "panelDecisionAt": _iso(recommendation.panel_decided_at),
            "coordinatorDecisionAt": _iso(recommendation.coordinator_decided_at),
            "cancelledAt": _iso(recommendation.cancelled_at),
            "rejectionReason": recommendation.display_rejection_reason or None,
            "cancellationReason": recommendation.cancellation_reason or None,
            "waitingSince": _iso(waiting["waitingSince"]),
            "waitingDays": waiting["waitingDays"],
            "waitingOn": waiting["waitingOn"],
            "targetModule": "PANEL_APPOINTMENTS",
            "recordType": "PANEL_RECOMMENDATION",
            "workflow": _workflow(recommendation.workflow_events.all()),
            **_semester_metadata(recommendation.academic_semester),
        }
        try:
            appointment = recommendation.panel_appointment
        except PanelAppointment.DoesNotExist:
            appointment = None
        if appointment and recommendation.status == PanelRecommendation.Status.APPROVED:
            record["appointment"] = {
                "appointmentDate": appointment.appointment_date.isoformat(),
                "status": appointment.status,
                "panelMember": appointment.panel_member.full_name,
                "endOutcome": appointment.end_outcome or None,
                "endReason": appointment.end_reason or None,
                "endedAt": _iso(appointment.ended_at),
            }
            if visibility == "INTERNAL":
                record["appointment"].update(
                    {
                        "appointmentId": appointment.pk,
                        "endedBy": (
                            appointment.ended_by.full_name
                            if appointment.ended_by_id
                            else None
                        ),
                        "supersedesAppointmentId": appointment.supersedes_id,
                    }
                )
                record["appointment"]["lifecycle"] = [
                    {
                        "id": event.pk,
                        "action": event.action,
                        "actorName": event.actor.full_name,
                        "actorRole": event.actor_role,
                        "previousStatus": event.previous_status,
                        "newStatus": event.new_status,
                        "outcome": event.outcome or None,
                        "reason": event.reason or None,
                        "createdAt": _iso(event.created_at),
                    }
                    for event in appointment.lifecycle_events.select_related("actor")
                ]
        else:
            record["appointment"] = None
        records.append(record)

    current_index = next(
        (
            index
            for index, recommendation in enumerate(recommendations)
            if recommendation.status in PanelRecommendation.ACTIVE_STATUSES
        ),
        0 if records else None,
    )
    result = {"records": records}
    if visibility == "INTERNAL":
        result["currentRecordId"] = (
            records[current_index]["recordId"] if current_index is not None else None
        )
    return result


def _task_status(entry, deadline_state):
    if entry and entry.status == MarkEntry.Status.SUBMITTED:
        return "SUBMITTED"
    if deadline_state == "OVERDUE":
        return "OVERDUE"
    if entry and entry.status == MarkEntry.Status.DRAFT:
        return "DRAFT"
    return "NOT_STARTED"


def _marks_records(profile, user, visibility, now):
    if profile is None:
        return {"summaryStatus": None, "completionRate": None, "tasks": []}
    tasks = (
        EvaluationTask.objects.filter(
            profile=profile,
        )
        .select_related(
            "evaluator__lecturer",
            "profile__student__student",
            "period",
            "period__academic_semester",
            "mark_entry",
        )
        .order_by("-period__closes_at", "-assigned_at", "-id")
        .prefetch_related("completion_windows__granted_by")
    )
    if user.role == User.Role.LECTURER:
        tasks = tasks.filter(evaluator=user)

    rows = []
    for task in tasks:
        from marks.completion_windows import task_due_at

        try:
            entry = task.mark_entry
        except MarkEntry.DoesNotExist:
            entry = None
        deadline = mark_deadline_metadata(
            task_due_at(task, now=now),
            is_submitted=bool(entry and entry.status == MarkEntry.Status.SUBMITTED),
            now=now,
        )
        status = _task_status(entry, deadline["deadlineState"])
        if task.lifecycle_status == EvaluationTask.Lifecycle.RETIRED:
            status = "RETIRED"
        elif task.lifecycle_status == EvaluationTask.Lifecycle.PAUSED:
            status = "PAUSED"
        if visibility == "PUBLIC":
            row = {
                "status": status,
                "period": task.period.name,
                "semester": task.period.semester,
                "semesterId": task.period.academic_semester_id,
                "semesterCode": (
                    task.period.academic_semester.code
                    if task.period.academic_semester_id
                    else None
                ),
                "dueAt": _iso(deadline["dueAt"]),
                "daysUntilDue": deadline["daysUntilDue"],
                "deadlineState": deadline["deadlineState"],
                "targetModule": "MARKS",
                "recordType": "MARK_TASK",
                "taskLifecycleStatus": task.lifecycle_status,
            }
        else:
            row = {
                "taskId": str(task.pk),
                "status": status,
                "period": task.period.name,
                "semester": task.period.semester,
                "semesterId": task.period.academic_semester_id,
                "semesterCode": (
                    task.period.academic_semester.code
                    if task.period.academic_semester_id
                    else None
                ),
                "evaluator": task.evaluator.full_name,
                "evaluatorRole": task.evaluator_role,
                "dueAt": _iso(deadline["dueAt"]),
                "daysUntilDue": deadline["daysUntilDue"],
                "deadlineState": deadline["deadlineState"],
                "targetModule": "MARKS",
                "recordType": "MARK_TASK",
                "taskLifecycleStatus": task.lifecycle_status,
                "retiredAt": _iso(task.retired_at),
                "retirementReason": task.retirement_reason or None,
            }
        rows.append(row)

    active_rows = [
        row for row in rows if row["taskLifecycleStatus"] == EvaluationTask.Lifecycle.ACTIVE
    ]
    submitted = sum(row["status"] == "SUBMITTED" for row in active_rows)
    statuses = {row["status"] for row in active_rows}
    if "OVERDUE" in statuses:
        summary_status = "OVERDUE"
    elif "DRAFT" in statuses:
        summary_status = "DRAFT"
    elif "NOT_STARTED" in statuses:
        summary_status = "NOT_STARTED"
    elif active_rows:
        summary_status = "SUBMITTED"
    else:
        summary_status = None
    return {
        "summaryStatus": summary_status,
        "completionRate": (
            round((submitted / len(active_rows)) * 100, 1) if active_rows else None
        ),
        "tasks": rows,
    }


def _timeline_status(entry, today):
    if today < entry.deadline_start:
        return "UPCOMING"
    if today > entry.deadline_end:
        return "COMPLETED"
    if entry.deadline_start == entry.deadline_end:
        return "DEADLINE"
    return "ACTIVE"


def _timeline_section(today):
    academic_semester = current_effective_semester()
    if academic_semester is None:
        return {
            "semester": None,
            "session": None,
            "semesterId": None,
            "semesterCode": None,
            "entries": [],
        }
    timeline = (
        SemesterTimeline.objects.filter(
            is_active=True,
            academic_semester=academic_semester,
        )
        .prefetch_related("entries")
        .first()
    )
    if timeline is None:
        return {
            "semester": None,
            "session": None,
            "semesterId": academic_semester.pk,
            "semesterCode": academic_semester.code,
            "entries": [],
        }
    entries = [
        {
            "recordId": str(entry.pk),
            "title": entry.title or entry.detail,
            "detail": entry.detail,
            "level": entry.level,
            "status": _timeline_status(entry, today),
            "deadlineStart": entry.deadline_start.isoformat(),
            "deadlineEnd": entry.deadline_end.isoformat(),
            "targetModule": "DASHBOARD",
            "recordType": "TIMELINE_ENTRY",
        }
        for entry in timeline.entries.all()
        if "STUDENT" in entry.target_roles
    ]
    return {
        "semester": timeline.semester,
        "session": timeline.session,
        "semesterId": timeline.academic_semester_id,
        "semesterCode": timeline.academic_semester.code,
        "entries": entries,
    }


def _attention(supervisor, panel, marks, timeline, visibility):
    items = []
    for task in marks["tasks"] if marks else []:
        if task["taskLifecycleStatus"] != EvaluationTask.Lifecycle.ACTIVE:
            continue
        if task["deadlineState"] == "OVERDUE":
            items.append(
                {
                    "kind": "MARKS_DEADLINE",
                    "label": f'{task["period"]} marks are overdue',
                    "waitingDays": None,
                    "dueAt": task["dueAt"],
                    "targetModule": "MARKS",
                    "recordType": "MARK_TASK",
                    "recordId": task.get("taskId"),
                }
            )
    for section, module in (
        (supervisor, "SUPERVISOR_APPOINTMENTS"),
        (panel, "PANEL_APPOINTMENTS"),
    ):
        if section is None:
            continue
        for record in section["records"]:
            if record["waitingDays"] is None:
                continue
            item = {
                "kind": "WORKFLOW_WAIT",
                "label": f'{record["status"].replace("_", " ").title()}',
                "waitingDays": record["waitingDays"],
                "dueAt": None,
                "targetModule": module,
                "recordType": record["recordType"],
                "recordId": record.get("recordId"),
            }
            if visibility == "INTERNAL":
                item["waitingOn"] = record.get("waitingOn")
            else:
                item["waitingOn"] = (
                    "FACULTY_PROCESSING"
                    if module == "PANEL_APPOINTMENTS"
                    else record.get("waitingOn")
                )
            items.append(item)
    for entry in timeline["entries"] if timeline else []:
        if entry["status"] not in {"ACTIVE", "DEADLINE", "UPCOMING"}:
            continue
        items.append(
            {
                "kind": "TIMELINE_MILESTONE",
                "label": entry["title"],
                "waitingDays": None,
                "dueAt": entry["deadlineEnd"],
                "targetModule": "DASHBOARD",
                "recordType": "TIMELINE_ENTRY",
                "recordId": entry["recordId"],
            }
        )
    priority = {
        "MARKS_DEADLINE": 0,
        "WORKFLOW_WAIT": 1,
        "TIMELINE_MILESTONE": 2,
    }
    return sorted(
        items,
        key=lambda item: (
            priority[item["kind"]],
            -(item["waitingDays"] or 0),
            item["dueAt"] or "",
            item["label"],
        ),
    )


def build_student_progress_dossier(user, student_id, now=None):
    try:
        student = Student.objects.select_related("user").get(
            matric_no__iexact=student_id
        )
    except Student.DoesNotExist as exc:
        raise Http404 from exc

    now = now or timezone.now()
    profile = _research_profile(student)
    visibility, visible_set = _resolve_access(user, student, profile)
    from appointments.co_supervision import can_read_team, serialize_team
    from .amendment_tracking import amendment_dossier

    supervisory_team = (
        serialize_team(student, user) if can_read_team(user, student) else None
    )
    ordered_sections = [
        section
        for section in (
            SECTION_SUPERVISOR,
            SECTION_PANEL,
            SECTION_MARKS,
            SECTION_TIMELINE,
        )
        if section in visible_set
    ]

    supervisor = (
        _supervisor_records(student, user, visibility, now)
        if SECTION_SUPERVISOR in visible_set
        else None
    )
    panel = (
        _panel_records(profile, user, visibility, now)
        if SECTION_PANEL in visible_set
        else None
    )
    marks = (
        _marks_records(profile, user, visibility, now)
        if SECTION_MARKS in visible_set
        else None
    )
    timeline = (
        _timeline_section(timezone.localdate(now))
        if SECTION_TIMELINE in visible_set
        else None
    )
    attention = _attention(
        supervisor,
        panel,
        marks,
        timeline,
        visibility,
    )

    supervisor_current = None
    if supervisor and supervisor["currentRecordId"]:
        supervisor_current = next(
            (
                row
                for row in supervisor["records"]
                if row["recordId"] == supervisor["currentRecordId"]
            ),
            None,
        )
    panel_current = None
    if panel and panel.get("records"):
        if visibility == "PUBLIC":
            panel_current = next((row for row in panel["records"]
                                  if row["status"] in {"CONFIRMED", "FACULTY_PROCESSING"}), None)
        elif panel.get("currentRecordId"):
            panel_current = next(
                (
                    row
                    for row in panel["records"]
                    if row["recordId"] == panel["currentRecordId"]
                ),
                None,
            )

    return {
        "generatedAt": now.isoformat(),
        "visibility": visibility,
        "student": {
            "studentId": student.matric_no,
            "studentName": student.user.full_name,
            "programme": student.programme,
            "status": student.status,
            "intakeSemester": student.intake_semester,
            "lifecycle": {
                "status": student.status.upper(),
                "effectiveAt": _iso(student.status_changed_at),
                **(
                    {
                        "reason": student.status_reason or None,
                        "changedBy": (
                            student.status_changed_by.full_name
                            if student.status_changed_by_id
                            else None
                        ),
                        "audits": [
                            {
                                "previousStatus": audit.previous_status,
                                "newStatus": audit.new_status,
                                "reason": audit.reason,
                                "actor": audit.actor.full_name,
                                "createdAt": _iso(audit.created_at),
                            }
                            for audit in student.lifecycle_audits.select_related(
                                "actor"
                            )
                        ],
                    }
                    if visibility == "INTERNAL"
                    else {}
                ),
            },
            "research": (
                {
                    "semester": profile.semester,
                    "title": profile.proposed_topic,
                    "researchArea": profile.research_area,
                    "supervisor": profile.supervisor.full_name,
                }
                if profile
                else None
            ),
        },
        "visibleSections": ordered_sections,
        "supervisoryTeam": supervisory_team,
        "researchAmendments": amendment_dossier(user, student, now),
        "overview": {
            "supervisorStatus": (
                supervisor_current["status"] if supervisor_current else None
            ),
            "panelStatus": panel_current["status"] if panel_current else None,
            "marksStatus": marks["summaryStatus"] if marks else None,
            "activeTimelineEntries": sum(
                entry["status"] in {"ACTIVE", "DEADLINE"}
                for entry in timeline["entries"]
                if timeline
            ),
            "attentionCount": len(attention),
        },
        "supervisor": supervisor,
        "panel": panel,
        "marks": marks,
        "timeline": timeline,
        "attention": attention,
    }
