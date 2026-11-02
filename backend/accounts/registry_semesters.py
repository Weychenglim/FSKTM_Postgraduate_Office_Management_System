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
from .semester_rules import record_semester, serialize_progress, sync_current
from .semesters import from_parts
from .semesters import read as read_semester

MAX_EXTENSION = 3


def _rule_values(rule):
    return {
        "minSemesters": rule.min_semesters,
        "maxSemesters": rule.max_semesters,
        "specialCounts": rule.special_counts,
    }


def _serialize_rule(programme, rule, students):
    changed = rule.updated_by if rule else None
    return {
        "programme": programme,
        "hasRule": rule is not None,
        "minSemesters": rule.min_semesters if rule else None,
        "maxSemesters": rule.max_semesters if rule else None,
        "specialCounts": rule.special_counts if rule else True,
        "source": rule.source if rule else "",
        "changedBy": changed.full_name if changed else "",
        "changedAt": rule.updated_at.isoformat() if changed else None,
        "activeStudents": students.get(programme_key(programme), 0),
    }


class ProgrammeRuleSerializer(serializers.Serializer):
    programme = serializers.ChoiceField(choices=APPROVED_PROGRAMMES)
    minSemesters = serializers.IntegerField(min_value=1, max_value=20)
    maxSemesters = serializers.IntegerField(min_value=1, max_value=20)
    specialCounts = serializers.BooleanField()

    def validate(self, attrs):
        if attrs["minSemesters"] > attrs["maxSemesters"]:
            raise serializers.ValidationError(
                {"minSemesters": ["The minimum cannot be more than the maximum."]}
            )
        return attrs


def _active_by_programme():
    counts = {}
    rows = Student.objects.filter(status=Student.Status.ACTIVE).values("programme").annotate(total=Count("pk"))
    for row in rows:
        key = programme_key(row["programme"])
        counts[key] = counts.get(key, 0) + row["total"]
    return counts


def _all_rules():
    students = _active_by_programme()
    rules = {programme_key(rule.programme): rule for rule in ProgrammeRule.objects.select_related("updated_by")}
    return [
        _serialize_rule(programme, rules.get(programme_key(programme)), students)
        for programme in APPROVED_PROGRAMMES
    ]


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def programme_rules_view(request):
    """Office: how long each approved programme takes."""
    _require_office_admin(request)
    if request.method == "GET":
        return Response({"rules": _all_rules()})
    serializer = ProgrammeRuleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    with transaction.atomic():
        rule = ProgrammeRule.objects.select_for_update().filter(programme=data["programme"]).first()
        before = _rule_values(rule) if rule else {}
        if rule is None:
            rule = ProgrammeRule(programme=data["programme"])
        rule.min_semesters = data["minSemesters"]
        rule.max_semesters = data["maxSemesters"]
        rule.special_counts = data["specialCounts"]
        rule.updated_by = request.user
        rule.save()
        after = _rule_values(rule)
        if before != after:
            ProgrammeRuleChange.objects.create(
                rule=rule,
                actor=request.user,
                actor_name=request.user.full_name,
                before_values=before,
                after_values=after,
            )
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
    _, created = record_semester(
        student, semester, actor=request.user, outcome=data["outcome"], note=data["note"].strip()
    )
    if not created:
        return Response(
            {"error": f"{semester.label} is already on this student's record."},
            status=status.HTTP_409_CONFLICT,
        )
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


def _on_semester(semester):
    return StudentSemester.objects.filter(session=semester.session, term=semester.term).values("student_id")


def _move_payload(portal, semester):
    waiting = Student.objects.filter(status=Student.Status.ACTIVE).exclude(pk__in=_on_semester(semester))
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
        "waiting": waiting.count(),
        "lastMove": {
            "by": last.moved_by.full_name if last.moved_by else "",
            "at": last.created_at.isoformat(),
            "moved": last.moved_count,
            "leftOut": last.left_out_count,
        } if last else None,
    }


def _move_rows(semester):
    students = (
        Student.objects.filter(status=Student.Status.ACTIVE)
        .exclude(pk__in=_on_semester(semester))
        .select_related("user", "registry")
        .order_by("user__full_name")
    )
    rows = []
    for student in students:
        registry = _registry_or_none(student)
        rows.append(
            {
                "matric": student.matric_no,
                "name": student.user.full_name,
                "programme": student.programme,
                "avatarText": _initials(student.user.full_name),
                "avatarBg": _avatar_bg(student.matric_no),
                "current": (registry.current_semester if registry else "") or student.intake_semester,
            }
        )
    return rows


def _usual_semester(rows):
    """The semester most of these students are on, shown as where they are moving from."""
    counts = Counter(read_semester(row["current"]) for row in rows)
    counts.pop(None, None)
    return counts.most_common(1)[0][0].label if counts else ""


class MoveStudentsSerializer(serializers.Serializer):
    semesterId = serializers.IntegerField()
    matrics = serializers.ListField(child=serializers.CharField(max_length=64), allow_empty=False, max_length=5000)


def _put_on_semester(students, semester, *, outcome, actor, note=""):
    """Add this semester to each student, and make it their current one."""
    StudentSemester.objects.bulk_create(
        [
            StudentSemester(
                student=student, session=semester.session, term=semester.term, outcome=outcome, note=note, created_by=actor,
            )
            for student in students
        ],
        ignore_conflicts=True,
    )
    registries = {row.student_id: row for row in StudentRegistry.objects.filter(student__in=students)}
    missing, changed = [], []
    for student in students:
        registry = registries.get(student.pk)
        if registry is None:
            missing.append(StudentRegistry(student=student, current_semester=semester.label))
        elif registry.current_semester != semester.label:
            registry.current_semester = semester.label
            changed.append(registry)
    StudentRegistry.objects.bulk_create(missing)
    StudentRegistry.objects.bulk_update(changed, ["current_semester"])


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def semester_move_view(request):
    """Office: move students into the active semester, all in one go.

    Only the active semester can be moved into, and a student has one row per
    semester, so running this twice changes nothing.
    """
    _require_office_admin(request)
    portal, semester = _active_semester()
    if semester is None:
        if request.method == "POST":
            return Response(
                {"error": "There is no active semester. Set one in Academic Semesters first."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({"semester": None, "waiting": 0, "lastMove": None})
    if request.method == "GET":
        payload = _move_payload(portal, semester)
        if request.query_params.get("summary") != "1":
            rows = _move_rows(semester)
            deferred = Student.objects.filter(status=Student.Status.DEFERRED).exclude(pk__in=_on_semester(semester))
            payload.update(
                students=rows,
                movingFrom=_usual_semester(rows),
                deferred=0 if semester.is_special else deferred.count(),
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
        on_it = set(_on_semester(semester).values_list("student_id", flat=True))
        active = list(Student.objects.filter(status=Student.Status.ACTIVE).select_for_update())
        moving = [student for student in active if student.matric_no.casefold() in wanted and student.pk not in on_it]
        known = {student.matric_no.casefold() for student in active}
        _put_on_semester(moving, semester, outcome=StudentSemester.Outcome.STUDIED, actor=request.user)
        if not semester.is_special:
            deferred = list(Student.objects.filter(status=Student.Status.DEFERRED).exclude(pk__in=on_it))
            _put_on_semester(
                deferred, semester, outcome=StudentSemester.Outcome.LEAVE, actor=request.user,
                note="Deferred when students moved to this semester",
            )
        left_out = len([student for student in active if student.pk not in on_it]) - len(moving)
        StudentSemesterMove.objects.create(
            session=semester.session, term=semester.term, moved_count=len(moving), left_out_count=left_out, moved_by=request.user,
        )
    return Response(
        {
            "semester": semester.label,
            "moved": len(moving),
            "leftOut": left_out,
            "notActive": [matric for key, matric in wanted.items() if key not in known],
        }
    )
