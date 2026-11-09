"""Programme rules and each student's semesters, as Student Registry edits them."""
from collections import Counter

from django.db import transaction
from django.db.models import Count
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    ProgrammeRule,
    ProgrammeRuleChange,
    Student,
    StudentRegistry,
    StudentSemester,
    StudentSemesterMove,
)
from .programmes import APPROVED_PROGRAMMES
from .registry_programmes import programme_key
from .registry_views import (
    _avatar_bg,
    _find_student,
    _initials,
    _registry_or_none,
    _require_office_admin,
    _require_registry_reader,
)
from .participant_lifecycle import ParticipantLifecycleConflict
from .semester_rules import (
    LEAVE_OUTCOMES,
    end_leaves,
    intake_label,
    limit_warnings,
    not_on_semester,
    on_semester,
    progress_of,
    put_on_semester,
    record_semester,
    rows_of,
    rule_for,
    rules_by_programme,
    serialize_progress,
    start_of,
    starts_later,
    status_follows_row,
    sync_current,
    waiting_ids,
)
from .semesters import SEMESTER_I, SEMESTER_II, from_parts
from .semesters import read as read_semester

MAX_EXTENSION = 3
ON_THE_LIST = [StudentSemester.Outcome.STUDIED, StudentSemester.Outcome.NOT_REGISTERED]


def _rule_from(rule):
    start = from_parts(rule.from_session, rule.from_term)
    return start.label if start else ""


def _rule_values(rule):
    return {
        "programme": rule.programme,
        "appliesFrom": _rule_from(rule),
        "minSemesters": rule.min_semesters,
        "maxSemesters": rule.max_semesters,
        "specialCounts": rule.special_counts,
    }


def _changed(rule):
    changed = rule.updated_by if rule else None
    return {
        "changedBy": changed.full_name if changed else "",
        "changedAt": rule.updated_at.isoformat() if changed else None,
    }


def _serialize_later_rule(rule, counts):
    return {
        "id": rule.pk,
        "fromLabel": _rule_from(rule),
        "minSemesters": rule.min_semesters,
        "maxSemesters": rule.max_semesters,
        "specialCounts": rule.special_counts,
        "activeStudents": counts.get(rule.pk, 0),
        **_changed(rule),
    }


def _serialize_rule(programme, group, counts, students):
    rule = group[0] if group else None
    return {
        "programme": programme,
        "hasRule": rule is not None,
        "minSemesters": rule.min_semesters if rule else None,
        "maxSemesters": rule.max_semesters if rule else None,
        "specialCounts": rule.special_counts if rule else True,
        "source": rule.source if rule else "",
        "activeStudents": counts.get(rule.pk, 0) if rule else students.get(programme_key(programme), 0),
        "laterRules": [_serialize_later_rule(later, counts) for later in group[1:]],
        **_changed(rule),
    }


class ProgrammeRuleSerializer(serializers.Serializer):
    programme = serializers.ChoiceField(choices=APPROVED_PROGRAMMES)
    minSemesters = serializers.IntegerField(min_value=1, max_value=20)
    maxSemesters = serializers.IntegerField(min_value=1, max_value=20)
    specialCounts = serializers.BooleanField()
    fromSession = serializers.CharField(max_length=9, allow_blank=True, required=False, default="")
    fromTerm = serializers.ChoiceField(choices=[SEMESTER_I, SEMESTER_II], allow_blank=True, required=False, default="")

    def validate(self, attrs):
        if attrs["minSemesters"] > attrs["maxSemesters"]:
            raise serializers.ValidationError(
                {"minSemesters": ["The minimum cannot be more than the maximum."]}
            )
        attrs["fromSession"] = attrs["fromSession"].strip()
        if bool(attrs["fromSession"]) != bool(attrs["fromTerm"]) or (
            attrs["fromSession"] and from_parts(attrs["fromSession"], attrs["fromTerm"]) is None
        ):
            raise serializers.ValidationError({"fromSession": ["Choose the first intake this rule covers."]})
        return attrs


def _all_rules():
    rules = rules_by_programme()
    counts, students = {}, {}
    active = Student.objects.filter(status=Student.Status.ACTIVE).prefetch_related("semesters")
    for student in active:
        key = programme_key(student.programme)
        students[key] = students.get(key, 0) + 1
        rule = rule_for(student.programme, rules, start_of(student, rows_of(student)))
        if rule:
            counts[rule.pk] = counts.get(rule.pk, 0) + 1
    return [
        _serialize_rule(programme, rules.get(programme_key(programme), []), counts, students)
        for programme in APPROVED_PROGRAMMES
    ]


def _record_rule_change(actor, rule, before, after):
    ProgrammeRuleChange.objects.create(
        rule=rule, actor=actor, actor_name=actor.full_name, before_values=before, after_values=after,
    )


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def programme_rules_view(request):
    """Office: how long each approved programme takes, for each intake a rule covers."""
    _require_office_admin(request)
    if request.method == "GET":
        return Response({"rules": _all_rules()})
    serializer = ProgrammeRuleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    with transaction.atomic():
        same_programme = ProgrammeRule.objects.select_for_update().filter(programme=data["programme"])
        if data["fromSession"] and not same_programme.filter(from_session="").exists():
            return Response(
                {"error": "Set this programme's rule before adding one for new intakes."},
                status=status.HTTP_409_CONFLICT,
            )
        rule = same_programme.filter(from_session=data["fromSession"], from_term=data["fromTerm"]).first()
        before = _rule_values(rule) if rule else {}
        if rule is None:
            rule = ProgrammeRule(programme=data["programme"], from_session=data["fromSession"], from_term=data["fromTerm"])
        rule.min_semesters = data["minSemesters"]
        rule.max_semesters = data["maxSemesters"]
        rule.special_counts = data["specialCounts"]
        rule.updated_by = request.user
        rule.save()
        after = _rule_values(rule)
        if before != after:
            _record_rule_change(request.user, rule, before, after)
    return Response({"rules": _all_rules()})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def programme_rule_detail_view(request, rule_id):
    """Office: remove a rule for new intakes. Those students go back to the rule before it."""
    _require_office_admin(request)
    with transaction.atomic():
        rule = ProgrammeRule.objects.select_for_update().filter(pk=rule_id).first()
        if rule is None:
            return Response({"error": "That rule has already gone."}, status=status.HTTP_404_NOT_FOUND)
        if not rule.from_session:
            return Response({"error": "A programme always keeps its first rule."}, status=status.HTTP_409_CONFLICT)
        _record_rule_change(request.user, rule, _rule_values(rule), {})
        rule.delete()
    return Response({"rules": _all_rules()})


class AddSemesterSerializer(serializers.Serializer):
    session = serializers.CharField(max_length=9)
    term = serializers.ChoiceField(choices=StudentSemester.Term.choices)
    outcome = serializers.ChoiceField(
        choices=StudentSemester.Outcome.choices, default=StudentSemester.Outcome.STUDIED
    )
    note = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")


class ChangeSemesterSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=StudentSemester.Outcome.choices, required=False)
    note = serializers.CharField(max_length=255, allow_blank=True, required=False)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def student_semesters_view(request, matric_no):
    """A student's semesters and how far along they are. Only the office adds to them."""
    if request.method == "GET":
        student, error = _find_student(matric_no, _require_registry_reader(request))
        if error:
            return error
        return Response(serialize_progress(student))
    _require_office_admin(request)
    student, error = _find_student(matric_no)
    if error:
        return error
    serializer = AddSemesterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    semester = from_parts(data["session"], data["term"])
    if semester is None:
        return Response(
            {"session": ["Use a session with consecutive years, like 2026/2027."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if starts_later(student, semester):
        return Response(
            {"error": f"{semester.label} is before this student's intake."},
            status=status.HTTP_409_CONFLICT,
        )
    try:
        with transaction.atomic():
            _, created = record_semester(
                student, semester, actor=request.user, outcome=data["outcome"], note=data["note"].strip()
            )
            if created:
                status_follows_row(student, request.user, semester.session, semester.term)
    except ParticipantLifecycleConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
    if not created:
        return Response(
            {"error": f"{semester.label} is already on this student's record."},
            status=status.HTTP_409_CONFLICT,
        )
    student.refresh_from_db()
    return Response(serialize_progress(student), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def student_semester_detail_view(request, matric_no, row_id):
    """Office: correct or remove one semester on a student's record."""
    _require_office_admin(request)
    student, error = _find_student(matric_no)
    if error:
        return error
    row = student.semesters.filter(pk=row_id).first()
    if row is None:
        return Response({"error": "That semester is no longer on this record."}, status=status.HTTP_404_NOT_FOUND)
    try:
        with transaction.atomic():
            if request.method == "DELETE":
                row.delete()
            else:
                serializer = ChangeSemesterSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                for field, value in serializer.validated_data.items():
                    setattr(row, field, value.strip() if field == "note" else value)
                row.save()
            sync_current(student)
            status_follows_row(student, request.user, row.session, row.term)
    except ParticipantLifecycleConflict as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
    student.refresh_from_db()
    return Response(serialize_progress(student))


class ExtensionSerializer(serializers.Serializer):
    semesters = serializers.IntegerField(min_value=0, max_value=MAX_EXTENSION)
    reason = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")

    def validate(self, attrs):
        attrs["reason"] = attrs["reason"].strip()
        if attrs["semesters"] and not attrs["reason"]:
            raise serializers.ValidationError({"reason": ["Say why the extension was given."]})
        return attrs


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def student_extension_view(request, matric_no):
    """Office: semesters the Dean added past the maximum (three at most)."""
    _require_office_admin(request)
    student, error = _find_student(matric_no)
    if error:
        return error
    serializer = ExtensionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    registry, _ = StudentRegistry.objects.get_or_create(student=student)
    registry.extension_semesters = serializer.validated_data["semesters"]
    registry.extension_reason = serializer.validated_data["reason"] if registry.extension_semesters else ""
    registry.save(update_fields=["extension_semesters", "extension_reason", "updated_at"])
    return Response(serialize_progress(student))


def _active_semester():
    from academics.services import current_effective_semester

    portal = current_effective_semester()
    if portal is None:
        return None, None
    return portal, from_parts(portal.academic_session, portal.term)


def _move_payload(portal, semester):
    waiting, not_started = not_on_semester(semester)
    last = (
        StudentSemesterMove.objects.filter(session=semester.session, term=semester.term)
        .select_related("moved_by")
        .first()
    )
    return {
        "semester": {
            "id": portal.pk,
            "label": semester.label,
            "session": semester.session,
            "term": semester.term,
            "isSpecial": semester.is_special,
        },
        "waiting": len(waiting),
        "notStarted": not_started,
        "lastMove": {
            "by": last.moved_by.full_name if last.moved_by else "",
            "at": last.created_at.isoformat(),
            "moved": last.moved_count,
            "leftOut": last.left_out_count,
            "backFromLeave": last.back_from_leave_count,
            "automatic": last.automatic,
        } if last else None,
    }


def _on_semester_rows(semester):
    rows = (
        StudentSemester.objects.filter(
            session=semester.session,
            term=semester.term,
            outcome__in=ON_THE_LIST,
            student__status=Student.Status.ACTIVE,
        )
        .select_related("student__user")
        .order_by("student__user__full_name")
    )
    return [
        {
            "rowId": row.pk,
            "matric": row.student.matric_no,
            "name": row.student.user.full_name,
            "programme": row.student.programme,
            "intake": intake_label(row.student.intake_semester),
            "avatarText": _initials(row.student.user.full_name),
            "avatarBg": _avatar_bg(row.student.matric_no),
            "outcome": row.outcome,
        }
        for row in rows
    ]


def _move_rows(semester):
    rows = []
    for student in not_on_semester(semester)[0]:
        registry = _registry_or_none(student)
        rows.append(
            {
                "matric": student.matric_no,
                "name": student.user.full_name,
                "programme": student.programme,
                "intake": intake_label(student.intake_semester),
                "avatarText": _initials(student.user.full_name),
                "avatarBg": _avatar_bg(student.matric_no),
                "current": (registry.current_semester if registry else "") or student.intake_semester,
            }
        )
    return rows


def _attention():
    """Students who have reached one of UM's limits. The Faculty or the Senate decides what happens."""
    rules = rules_by_programme()
    students = (
        Student.objects.filter(status__in=[Student.Status.ACTIVE, Student.Status.DEFERRED])
        .exclude(pk__in=waiting_ids())
        .select_related("user", "registry")
        .prefetch_related("semesters")
        .order_by("user__full_name")
    )
    rows = []
    for student in students:
        warnings = limit_warnings(progress_of(student, rules, rows_of(student), _registry_or_none(student)))
        if warnings:
            rows.append({
                "matric": student.matric_no,
                "name": student.user.full_name,
                "programme": student.programme,
                "intake": intake_label(student.intake_semester),
                "avatarText": _initials(student.user.full_name),
                "avatarBg": _avatar_bg(student.matric_no),
                "warnings": warnings,
            })
    return rows


def _usual_semester(rows):
    """The semester most of these students are on, shown as where they are moving from."""
    counts = Counter(read_semester(row["current"]) for row in rows)
    counts.pop(None, None)
    return counts.most_common(1)[0][0].label if counts else ""


class MoveStudentsSerializer(serializers.Serializer):
    semesterId = serializers.IntegerField()
    matrics = serializers.ListField(child=serializers.CharField(max_length=64), allow_empty=False, max_length=5000)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def semester_move_view(request):
    """Office: who is on the active semester, and put on anyone who isn't yet.

    Activating a normal semester already moves everyone. This is for a Special
    Semester and for anyone who arrived after that. Only the active semester can
    be used, and a student has one row per semester, so running this twice changes
    nothing. Anyone whose intake is later is skipped.
    """
    _require_office_admin(request)
    portal, semester = _active_semester()
    if semester is None:
        if request.method == "POST":
            return Response(
                {"error": "There is no active semester. Set one in Academic Semesters first."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({"semester": None, "waiting": 0, "notStarted": 0, "lastMove": None})
    if request.method == "GET":
        payload = _move_payload(portal, semester)
        if request.query_params.get("summary") != "1":
            rows = _move_rows(semester)
            payload.update(
                students=rows,
                movingFrom=_usual_semester(rows),
                onSemester=[] if semester.is_special else _on_semester_rows(semester),
                onLeave=StudentSemester.objects.filter(
                    session=semester.session, term=semester.term, outcome__in=LEAVE_OUTCOMES,
                ).count(),
                attention=_attention(),
            )
        return Response(payload)

    serializer = MoveStudentsSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if data["semesterId"] != portal.pk:
        return Response(
            {"error": f"The active semester is now {semester.label}. Reload the page and check the list again."},
            status=status.HTTP_409_CONFLICT,
        )
    wanted = {matric.strip().casefold(): matric.strip() for matric in data["matrics"] if matric.strip()}
    with transaction.atomic():
        first_update = not StudentSemesterMove.objects.filter(session=semester.session, term=semester.term).exists()
        back = end_leaves(semester, actor=request.user) if first_update and not semester.is_special else 0
        on_it = set(on_semester(semester).values_list("student_id", flat=True))
        active = list(Student.objects.filter(status=Student.Status.ACTIVE).exclude(pk__in=waiting_ids()).select_for_update())
        waiting = [student for student in active if student.pk not in on_it and not starts_later(student, semester)]
        moving = [student for student in waiting if student.matric_no.casefold() in wanted]
        known = {student.matric_no.casefold() for student in active}
        put_on_semester(moving, semester, outcome=StudentSemester.Outcome.STUDIED, actor=request.user)
        left_out = len(waiting) - len(moving)
        StudentSemesterMove.objects.create(
            session=semester.session,
            term=semester.term,
            moved_count=len(moving),
            left_out_count=left_out,
            back_from_leave_count=back,
            moved_by=request.user,
        )
    return Response(
        {
            "semester": semester.label,
            "moved": len(moving),
            "leftOut": left_out,
            "notActive": [matric for key, matric in wanted.items() if key not in known],
        }
    )
