"""Programme rules and each student's semesters, as Student Registry edits them."""
from django.db import transaction
from django.db.models import Count
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ProgrammeRule, ProgrammeRuleChange, Student, StudentRegistry, StudentSemester
from .programmes import APPROVED_PROGRAMMES
from .registry_programmes import programme_key
from .registry_views import _find_student, _require_office_admin, _require_registry_reader
from .semester_rules import record_semester, serialize_progress, sync_current
from .semesters import from_parts

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
