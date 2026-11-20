"""Scoped, compact Coordinator browse projections, paged in the database."""
from math import ceil

from django.db.models import (BooleanField, Case, CharField, Count, DateTimeField, Exists,
                             F, IntegerField, OuterRef, Q, Subquery, Value, When)
from django.db.models.functions import Coalesce, Concat
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from academics.models import AcademicSemester
from academics.services import current_effective_semester
from accounts.authorization import office_actor, coordinator_scope_q
from accounts.models import Student, User
from . import capacity_reassessment, co_supervision
from .ageing import elapsed_calendar_days
from .attention_project_stages import filter_attention_stages, project_stage_filter, stage_coverage_page
from .models import (AppointmentWorkflowEvent, CoSupervisorAppointment, CoSupervisorNomination,
                     StudentResearchProfile, SupervisorApplication, SupervisorAppointment)
from .request_visibility import routine_supervisor_requests


PENDING_PRIMARY = ("SUBMITTED_TO_SUPERVISOR", "PENDING_COORDINATOR")


def browse_scope_q(actor, path):
    return Q() if office_actor(actor) else coordinator_scope_q(actor, path)


def options(params, *, team=False, carryover=False):
    def integer(key, default):
        try:
            return int(params.get(key, default))
        except (TypeError, ValueError):
            raise ValidationError({key: "Use a positive integer."})
    result = {key: str(params.get(key, default)).strip() for key, default in (
        ("q", ""), ("view", "requests"), ("focus", "decision"), ("type", "all"),
        ("status", ""), ("programme", ""), ("semester", ""), ("sort", "name" if team else "waiting"),
        ("supervisor", ""))}
    result.update(page=integer("page", 1), size=integer("size", 10))
    if result["page"] < 1 or result["size"] not in (10, 25, 50):
        raise ValidationError("Page must be positive and size must be 10, 25, or 50.")
    for key, choices in (("sort", ("name", "primary", "supporting") if team else ("waiting", "oldest", "newest")),
                         ("focus", ("decision", "all")),
                         ("type", ("all", "primary", "supporting", "panel") if carryover else ("all", "primary", "supporting"))):
        if result[key] not in choices:
            raise ValidationError({key: "Unsupported filter value."})
    for key in ("from", "to"):
        raw = str(params.get(key, "")).strip()
        try:
            result[key] = parse_date(raw) if raw else None
        except ValueError:
            result[key] = None
        if raw and (result[key] is None or result[key].isoformat() != raw):
            raise ValidationError({key: "Use an ISO date (YYYY-MM-DD)."})
    if result["from"] and result["to"] and result["from"] > result["to"]:
        raise ValidationError("The start date must be before the end date.")
    if result["supervisor"]:
        try:
            result["supervisor"] = int(result["supervisor"])
        except ValueError:
            raise ValidationError({"supervisor": "Use a supervisor ID."})
    return result


def envelope(rows, opts, facets, *, serializer=lambda row: row, review_count=0):
    total = rows.count()
    count = ceil(total / opts["size"])
    page = min(opts["page"], max(1, count))
    start = (page - 1) * opts["size"]
    return {"results": [serializer(row) for row in rows[start:start + opts["size"]]],
            "total": total, "page": page, "pageSize": opts["size"], "pageCount": count,
            "reviewCount": review_count, "facets": facets}


def semester_label(path):
    """AcademicSemester.label is a display property, mirrored here for SQL filtering."""
    relation = path.removesuffix("__label")
    term = Case(*(When(**{f"{relation}__term": value}, then=Value(label))
                  for value, label in AcademicSemester.Term.choices), output_field=CharField())
    return Case(When(**{f"{relation}__isnull": True}, then=Value(None)),
                default=Concat(term, Value(" "), F(f"{relation}__academic_session")), output_field=CharField())


def facet_values(sources):
    result = {"programmes": set(), "semesters": set(), "statuses": set()}
    for rows, programme, semester in sources:
        if semester:
            rows = rows.annotate(facetSemester=semester_label(semester))
            semester = "facetSemester"
        for key, field in (("programmes", programme), ("semesters", semester), ("statuses", "status")):
            if field:
                result[key].update(value for value in rows.order_by().values_list(field, flat=True).distinct() if value)
    return {key: sorted(values) for key, values in result.items()}


def filters(rows, opts, *, programme="student__programme", semester="academic_semester__label",
            student="student", candidate="proposed_supervisor__full_name", title="research_title", date="submitted_at"):
    if opts["q"]:
        search = Q(**{f"{student}__user__full_name__icontains": opts["q"]}) | Q(**{f"{student}__matric_no__icontains": opts["q"]})
        if candidate:
            search |= Q(**{f"{candidate}__icontains": opts["q"]})
        if title:
            search |= Q(**{f"{title}__icontains": opts["q"]})
        rows = rows.filter(search)
    if opts["programme"]:
        rows = rows.filter(**{f"{programme}__trim__iexact": opts["programme"]})
    if opts["semester"] and semester:
        rows = rows.annotate(filterSemester=semester_label(semester)).filter(filterSemester=opts["semester"])
    if opts["status"]:
        rows = rows.filter(status=opts["status"])
    for option, lookup in (("from", "gte"), ("to", "lte")):
        if opts[option]:
            rows = rows.filter(**{f"{date}__date__{lookup}": opts[option]})
    return rows


def union_order(sources, opts):
    rows = sources[0].union(*sources[1:], all=True)
    ordering = "sortAt" if opts["sort"] in ("waiting", "oldest") else "-sortAt"
    return rows.order_by(F(ordering.lstrip("-")).desc(nulls_last=True) if ordering.startswith("-")
                         else F(ordering).asc(nulls_last=True), "kind", "rowId")


def request_bases(actor):
    scope = browse_scope_q(actor, "student__programme")
    primary = routine_supervisor_requests(SupervisorApplication.objects.filter(
        scope), actor)
    supporting = CoSupervisorNomination.objects.filter(scope)
    return primary, supporting


def decision_q(kind, actor):
    if actor.role != User.Role.COORDINATOR:
        return Q(pk__in=[])
    mutable = ~Q(academic_semester__lifecycle_status="ARCHIVED")
    if kind == "primary":
        return mutable & Q(status="PENDING_COORDINATOR", student__status=Student.Status.ACTIVE, student__user__is_active=True)
    return mutable & (Q(status="PENDING_COORDINATOR") | Q(status="SUBMITTED_TO_CO_SUPERVISOR", candidate_id=actor.pk))


def request_projection(rows, kind, actor, opts):
    primary = kind == "primary"
    candidate = "proposed_supervisor" if primary else "candidate"
    decision_field = "supervisor_decided_at" if primary else "candidate_decided_at"
    outcome = Coalesce("cancelled_at", "coordinator_decided_at", decision_field)
    # Old primary records use the workflow stage transition when its explicit timestamp is absent.
    transition = AppointmentWorkflowEvent.objects.filter(supervisor_application_id=OuterRef("pk"),
        new_status=OuterRef("status")).order_by("created_at", "pk").values("created_at")[:1]
    stage = Coalesce(decision_field, Subquery(transition), "updated_at") if primary else F(decision_field)
    waiting = Case(When(status="PENDING_COORDINATOR", then=stage),
        When(status=PENDING_PRIMARY[0] if primary else "SUBMITTED_TO_CO_SUPERVISOR", then=F("submitted_at")),
        default=Value(None), output_field=DateTimeField())
    rows = rows.annotate(outcomeAt=outcome, waitingAt=waiting, outcomeFilterAt=Coalesce(outcome, "updated_at"))
    rows = filters(rows, opts, candidate=f"{candidate}__full_name", title="research_title" if primary else None,
                   date="outcomeFilterAt" if opts["view"] == "history" else "submitted_at")
    carry = Q(academic_semester__lifecycle_status="CLOSED", status__in=PENDING_PRIMARY if primary else CoSupervisorNomination.PENDING_STATUSES)
    event_field = "supervisor_application" if primary else "co_supervisor_nomination"
    events = capacity_reassessment.CapacityReassessmentEvent.objects.filter(**{f"{event_field}_id": OuterRef("pk")})
    rows = rows.annotate(hasReassessment=Exists(events)).annotate(
        rowId=F("pk"), kind=Value(kind, output_field=CharField()), studentName=F("student__user__full_name"),
        matricNo=F("student__matric_no"), programme=F("student__programme"), candidateName=F(f"{candidate}__full_name"),
        submittedAt=F("submitted_at"), decidedAt=F("outcomeFilterAt" if opts["view"] == "history" else "outcomeAt"),
        canDecide=Case(When(decision_q(kind, actor), then=Value(True)), default=Value(False), output_field=BooleanField()),
        carryover=Case(When(carry | Q(hasReassessment=True), then=Value(True)), default=Value(False), output_field=BooleanField()),
        sortAt=F("outcomeFilterAt" if opts["view"] == "history" else "waitingAt" if opts["sort"] == "waiting" else "submitted_at"))
    return rows.order_by().values("rowId", "kind", "studentName", "matricNo", "programme", "candidateName", "status",
                                  "submittedAt", "decidedAt", "waitingAt", "canDecide", "carryover", "sortAt")


def requests_page(actor, params):
    opts = options(params)
    if actor.role == User.Role.OFFICE_ADMIN:
        opts["focus"] = "all"
    if opts["view"] not in ("requests", "history"):
        raise ValidationError({"view": "Use requests or history."})
    primary, supporting = request_bases(actor)
    if actor.role == User.Role.OFFICE_ADMIN and params.get("monitor") == "supervisor-pending":
        # Match the dashboard count across both supervision roles before paging/export.
        primary = primary.filter(status="SUBMITTED_TO_SUPERVISOR")
        supporting = supporting.filter(status="SUBMITTED_TO_CO_SUPERVISOR")
    review = primary.filter(decision_q("primary", actor)).count() + supporting.filter(decision_q("supporting", actor)).count()
    primary = primary.exclude(status__in=PENDING_PRIMARY) if opts["view"] == "history" else primary.filter(status__in=PENDING_PRIMARY)
    supporting = supporting.exclude(status__in=CoSupervisorNomination.PENDING_STATUSES) if opts["view"] == "history" else supporting.filter(status__in=CoSupervisorNomination.PENDING_STATUSES)
    facets = facet_values([(primary, "student__programme", "academic_semester__label"),
                          (supporting, "student__programme", "academic_semester__label")])
    if opts["view"] != "history" and opts["focus"] == "decision":
        primary = primary.filter(decision_q("primary", actor))
        supporting = supporting.filter(decision_q("supporting", actor))
    sources = [request_projection(rows, kind, actor, opts) for kind, rows in (("primary", primary), ("supporting", supporting))
               if opts["type"] in ("all", kind)]
    def compact(row):
        row.pop("sortAt")
        row["waitingDays"] = elapsed_calendar_days(row.pop("waitingAt"))
        row["id"] = row.pop("rowId")
        row["key"] = f"{row['kind']}-{row['id']}"
        return row
    return envelope(union_order(sources, opts), opts, facets, serializer=compact, review_count=review)


def appointment_bases(actor):
    scope = browse_scope_q(actor, "student__programme")
    return tuple(model.objects.filter(scope, status="ENDED")
                 for model in (SupervisorAppointment, CoSupervisorAppointment))


def appointments_page(actor, params, *, own=False):
    opts = options(params)
    if own:
        if actor.role != User.Role.LECTURER or not actor.is_active:
            raise co_supervision.CoSupervisionForbidden("Only lecturers can view their own appointment history.")
        bases = tuple(model.objects.filter(supervisor=actor, status="ENDED")
                      for model in (SupervisorAppointment, CoSupervisorAppointment))
    else:
        bases = appointment_bases(actor)
    facets = facet_values([(bases[0], "student__programme", "application__academic_semester__label"),
                          (bases[1], "student__programme", "nomination__academic_semester__label")])
    sources = []
    for kind, rows, relation in (("primary", bases[0], "application"), ("supporting", bases[1], "nomination")):
        if opts["type"] not in ("all", kind):
            continue
        rows = filters(rows, opts, semester=f"{relation}__academic_semester__label", candidate="supervisor__full_name",
                       title=f"{relation}__research_title" if kind == "primary" else None, date="ended_at")
        sources.append(rows.order_by().annotate(rowId=F("pk"), kind=Value(kind, output_field=CharField()),
            studentName=F("student__user__full_name"), matricNo=F("student__matric_no"), programme=F("student__programme"),
            supervisorName=F("supervisor__full_name"), appointmentDate=F("appointment_date"), endedAt=F("ended_at"),
            outcome=F("end_outcome"), applicationId=F("application_id") if kind == "primary" else Value(None, output_field=IntegerField()),
            studentId=F("student_id"), sortAt=Coalesce("ended_at", "updated_at")).values("rowId", "kind", "studentName", "matricNo",
            "programme", "supervisorName", "appointmentDate", "endedAt", "outcome", "applicationId", "studentId", "sortAt"))
    def compact(row):
        row.pop("sortAt")
        row["id"] = row.pop("rowId")
        row["key"] = f"{row['kind']}-{row['id']}"
        return row
    return envelope(union_order(sources, opts), opts, facets, serializer=compact)


def filter_team_relationship(rows, opts, kind, relation):
    if opts["semester"]:
        rows = rows.annotate(filterSemester=semester_label(f"{relation}__academic_semester__label")).filter(filterSemester=opts["semester"])
    for key, lookup in (("from", "gte"), ("to", "lte")):
        if opts[key]:
            rows = rows.filter(**{f"appointment_date__{lookup}": opts[key]})
    if opts["supervisor"]:
        rows = rows.filter(supervisor_id=opts["supervisor"])
    if opts["type"] not in ("all", kind):
        rows = rows.none()
    return rows


def team_selection(actor, params):
    """Unpaged authorised student membership shared by browse and export."""
    opts = options(params, team=True)
    view = params.get("view", "supervisors")
    if view not in ("supervisors", "students"):
        raise ValidationError({"view": "Use supervisors or students."})
    primary = SupervisorAppointment.objects.filter(status="ACTIVE", student_id=OuterRef("pk"))
    supporting = CoSupervisorAppointment.objects.filter(status="ACTIVE", student_id=OuterRef("pk"))
    students = co_supervision.visible_students(actor).annotate(hasPrimary=Exists(primary), hasSupporting=Exists(supporting))
    students = students.filter(Q(hasPrimary=True) | Q(hasSupporting=True))
    if opts["programme"]:
        students = students.filter(programme__trim__iexact=opts["programme"])
    if opts["status"] and opts["status"] != "ACTIVE":
        students = students.none()
    direct_students = None
    if opts["q"]:
        q = opts["q"]
        profiles = StudentResearchProfile.objects.filter(Q(student_id=OuterRef("user_id")) |
            Q(matric_no__iexact=OuterRef("matric_no")), proposed_topic__icontains=q)
        # A lecturer-name hit must belong to a relationship that survives the filters.
        primary_match = filter_team_relationship(primary, opts, "primary", "application")
        supporting_match = filter_team_relationship(supporting, opts, "supporting", "nomination")
        students = students.annotate(primaryMatch=Exists(primary_match.filter(supervisor__full_name__icontains=q)),
                                     supportingMatch=Exists(supporting_match.filter(supervisor__full_name__icontains=q)),
                                     researchMatch=Exists(profiles))
        direct = Q(user__full_name__icontains=q) | Q(matric_no__icontains=q) | Q(researchMatch=True)
        direct_students = students.filter(direct)
        students = students.filter(direct | Q(primaryMatch=True) | Q(supportingMatch=True))
    # Apply the same relationship filters to student membership and supervisor counts.
    for kind, relation in (("primary", "application"), ("supporting", "nomination")):
        rows = filter_team_relationship(primary if kind == "primary" else supporting, opts, kind, relation)
        students = students.annotate(**{f"{kind}Filtered": Exists(rows)})
    students = students.filter(Q(primaryFiltered=True) | Q(supportingFiltered=True))
    opts["project_semester"] = current_effective_semester()
    stage = project_stage_filter(params, "current_roster")
    opts["project_stages"] = None
    if stage:
        students, opts["project_stages"] = filter_attention_stages(students, opts["project_semester"], "pk", stage)
    return opts, view, students, direct_students


def teams_page(actor, params):
    opts, view, students, direct_students = team_selection(actor, params)
    visible = co_supervision.visible_students(actor)
    facets = facet_values([(SupervisorAppointment.objects.filter(status="ACTIVE", student__in=visible),
                           "student__programme", "application__academic_semester__label"),
                          (CoSupervisorAppointment.objects.filter(status="ACTIVE", student__in=visible),
                           "student__programme", "nomination__academic_semester__label")])
    if view == "students" or opts["supervisor"]:
        active = SupervisorAppointment.objects.filter(status="ACTIVE", student_id=OuterRef("pk"))
        students = students.annotate(primaryId=Subquery(active.values("supervisor_id")[:1]),
                                     primaryName=Subquery(active.values("supervisor__full_name")[:1])).order_by("user__full_name", "matric_no", "pk")
        def compact(student):
            relationship = None
            if opts["supervisor"]:
                relationship = "Primary supervisor" if student.primaryFiltered else "Supporting supervisor"
            return {"id": student.pk, "matricNo": student.matric_no, "studentName": student.user.full_name,
                    "programme": student.programme, "primarySupervisor": {"id": student.primaryId, "name": student.primaryName}
                    if student.primaryId else None, "relationship": relationship}
        data = envelope(students, opts, facets, serializer=compact)
        return stage_coverage_page(data, opts["project_semester"], opts["project_stages"])
    def count(model):
        rows = model.objects.filter(status="ACTIVE", student__in=students, supervisor_id=OuterRef("pk"))
        rows = filter_team_relationship(rows, opts, "primary" if model is SupervisorAppointment else "supporting",
                                       "application" if model is SupervisorAppointment else "nomination")
        if direct_students is not None:
            rows = rows.filter(Q(supervisor__full_name__icontains=opts["q"]) | Q(student__in=direct_students))
        return Subquery(rows
                        .order_by().values("supervisor_id").annotate(total=Count("student_id", distinct=True)).values("total")[:1])
    supervisors = User.objects.annotate(primaryCount=Coalesce(count(SupervisorAppointment), 0),
        supportingCount=Coalesce(count(CoSupervisorAppointment), 0)).filter(Q(primaryCount__gt=0) | Q(supportingCount__gt=0))
    ordering = ("full_name", "pk") if opts["sort"] == "name" else (f"-{opts['sort']}Count", "full_name", "pk")
    supervisors = supervisors.select_related("lecturer").order_by(*ordering)
    data = envelope(supervisors, opts, facets, serializer=lambda supervisor: {"id": supervisor.pk, "name": supervisor.full_name,
        "staffNo": getattr(getattr(supervisor, "lecturer", None), "staff_no", ""),
        "primaryCount": supervisor.primaryCount, "supportingCount": supervisor.supportingCount})
    data["projectSemester"] = opts["project_semester"].label if opts["project_semester"] else None
    return data


def carryover_bases(actor):
    result = []
    for kind, (model, _, pending) in capacity_reassessment.KINDS.items():
        student = "profile__student__student" if kind == "PANEL" else "student"
        rows = model.objects.filter(browse_scope_q(actor, f"{student}__programme")).filter(
            Q(academic_semester__lifecycle_status="CLOSED", status__in=pending) | Q(capacity_reassessments__isnull=False)).distinct()
        if kind == "PANEL":
            rows = rows.filter(profile__student__student__isnull=False)
        if kind == "SUPERVISOR":
            rows = routine_supervisor_requests(rows, actor)
        result.append((kind, rows, student))
    return result


def carryover_page(actor, params):
    opts = options(params, carryover=True)
    bases = carryover_bases(actor)
    facets = facet_values([(rows, f"{student}__programme", "academic_semester__label") for _, rows, student in bases])
    sources = []
    for kind, rows, student in bases:
        selected_kind = {"primary": "SUPERVISOR", "supporting": "CO_SUPERVISOR", "panel": "PANEL"}.get(opts["type"])
        if selected_kind and kind != selected_kind:
            continue
        candidate = "recommended_member" if kind == "PANEL" else "candidate" if kind == "CO_SUPERVISOR" else "proposed_supervisor"
        rows = filters(rows, opts, programme=f"{student}__programme", student=student, candidate=f"{candidate}__full_name",
            title="profile__proposed_topic" if kind == "PANEL" else "research_title" if kind == "SUPERVISOR" else None)
        event_field = capacity_reassessment.KINDS[kind][1]
        events = capacity_reassessment.CapacityReassessmentEvent.objects.filter(**{f"{event_field}_id": OuterRef("pk")}).order_by("-pk")
        decision_field = {"SUPERVISOR": "supervisor_decided_at", "CO_SUPERVISOR": "candidate_decided_at", "PANEL": "panel_decided_at"}[kind]
        stage = F(decision_field)
        if kind in ("SUPERVISOR", "PANEL"):
            transition = AppointmentWorkflowEvent.objects.filter(**{f"{event_field}_id": OuterRef("pk")},
                new_status=OuterRef("status")).order_by("created_at", "pk").values("created_at")[:1]
            stage = Coalesce(decision_field, Subquery(transition), "updated_at")
        sort_at = Case(When(status="PENDING_COORDINATOR", then=stage), default=Coalesce("submitted_at", "created_at"),
                       output_field=DateTimeField()) if opts["sort"] == "waiting" else Coalesce("submitted_at", "created_at")
        sources.append(rows.order_by().annotate(rowId=F("pk"), kind=Value(kind, output_field=CharField()),
            latestEventId=Subquery(events.values("pk")[:1]),
            grantEventId=Subquery(events.filter(action__in=("GRANTED", "REPLACED")).values("pk")[:1]),
            sortAt=sort_at).values("rowId", "kind", "sortAt", "latestEventId", "grantEventId"))
    result = envelope(union_order(sources, opts), opts, facets)
    keys = result["results"]
    records = {}
    # The database chooses the page first; load its rows and two relevant audit events in batches.
    for kind, (model, _, _) in capacity_reassessment.KINDS.items():
        ids = [key["rowId"] for key in keys if key["kind"] == kind]
        if not ids:
            continue
        related = ("profile__student__student__user", "recommended_member") if kind == "PANEL" else (
            "student__user", "candidate" if kind == "CO_SUPERVISOR" else "proposed_supervisor")
        records.update({(kind, row.pk): row for row in model.objects.filter(pk__in=ids).select_related("academic_semester", *related)})
    event_ids = {key[field] for key in keys for field in ("latestEventId", "grantEventId") if key[field]}
    events = {event.pk: event for event in capacity_reassessment.CapacityReassessmentEvent.objects.filter(
        pk__in=event_ids).select_related("target_semester")}
    active = current_effective_semester()
    def compact(key):
        row = records[(key["kind"], key["rowId"])]
        student = capacity_reassessment.student_of(row)
        candidate = capacity_reassessment.candidate_of(row)
        latest = events.get(key["latestEventId"])
        grant = events.get(key["grantEventId"])
        authorization = None
        if grant:
            state = {"REVOKED": "REVOKED", "CONSUMED": "CONSUMED"}.get(latest.action)
            state = state or ("ACTIVE" if row.status in capacity_reassessment.KINDS[key["kind"]][2]
                and row.academic_semester and row.academic_semester.lifecycle_status == "CLOSED"
                and active and active.pk == grant.target_semester_id else "STALE")
            authorization = {"id": grant.pk, "reason": grant.reason, "createdAt": grant.created_at.isoformat(),
                             "state": state, "targetSemester": capacity_reassessment.semester_payload(grant.target_semester)}
        return {"id": row.pk, "kind": key["kind"], "student": {"id": student.pk, "name": student.user.full_name,
            "matricNo": student.matric_no, "programme": student.programme}, "candidate": {"id": candidate.pk, "name": candidate.full_name},
            "status": row.status, "originalSemester": capacity_reassessment.semester_payload(row.academic_semester), "authorization": authorization}
    result["results"] = [compact(key) for key in keys]
    result["activeSemester"] = capacity_reassessment.semester_payload(active)
    return result
