"""Versioned Section A input and server-owned submission evidence."""

import json

from django.utils import timezone
from rest_framework import serializers

from accounts.models import StudentRegistry, User

from .models import SupervisorDocumentRequirement


DECLARATION_TEXT = (
    "I declare that the information provided in this application is true and accurate "
    "to the best of my knowledge."
)
COURSE_FIELD_LIMITS = {"courseName": 255, "courseCode": 64, "semesterSession": 64, "grade": 32}


def proposal_requirement():
    return SupervisorDocumentRequirement.objects.filter(code="research-proposal", is_active=True).first()


def student_particulars(student, semester):
    # Query fresh authoritative values; the authenticated request user may be cached.
    user = User.objects.get(pk=student.user_id)
    registry = StudentRegistry.objects.filter(student_id=student.pk).first()
    ic_number = registry.ic_number if registry else ""
    passport_number = registry.passport_number if registry else ""
    return {
        "name": user.full_name or "", "studentId": student.matric_no or "",
        "programme": student.programme or "", "semester": semester.label if semester else "",
        "identityNumber": ic_number or passport_number,
        "identityType": "NRIC" if ic_number else "PASSPORT" if passport_number else "",
        "email": user.email or "", "phone": user.phone or "",
        "address": registry.address if registry else "",
    }


class SectionAField(serializers.Field):
    """Accept an exact v1 object, including a multipart JSON string, without coercion."""

    def get_value(self, dictionary):
        # DRF's HTML handling treats a provided empty optional field as omitted.
        # Only an actually absent Section A may take the legacy path.
        return dictionary.get(self.field_name, serializers.empty)

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (ValueError, RecursionError):
                raise serializers.ValidationError("Section A must contain valid JSON.")
        keys = {"version", "titleOrigin", "noCoursesTaken", "courseResults", "declarationAccepted"}
        if not isinstance(data, dict) or set(data) != keys:
            raise serializers.ValidationError("Provide exactly the version 1 Section A fields.")
        if type(data["version"]) is not int or data["version"] != 1:
            raise serializers.ValidationError("Section A version must be 1.")
        if data["titleOrigin"] not in ("STUDENT", "SUPERVISOR"):
            raise serializers.ValidationError("Select whether the student or supervisor proposed the title.")
        if type(data["noCoursesTaken"]) is not bool:
            raise serializers.ValidationError("The no-courses choice must be a boolean.")
        if data["declarationAccepted"] is not True:
            raise serializers.ValidationError("Accept the declaration before submitting.")
        rows = data["courseResults"]
        if not isinstance(rows, list) or len(rows) > 50:
            raise serializers.ValidationError("Course results must be a list of at most 50 rows.")
        if bool(rows) == data["noCoursesTaken"]:
            raise serializers.ValidationError("Provide course results or explicitly select no courses, never both.")
        cleaned = []
        for index, row in enumerate(rows, start=1):
            if not isinstance(row, dict) or set(row) != set(COURSE_FIELD_LIMITS):
                raise serializers.ValidationError(f"Course row {index} must contain all four course fields.")
            values = {}
            for key, limit in COURSE_FIELD_LIMITS.items():
                value = row[key]
                if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
                    raise serializers.ValidationError(
                        f"Course row {index}: {key} is required and must not exceed {limit} characters."
                    )
                values[key] = value.strip()
            cleaned.append(values)
        return {**data, "courseResults": cleaned}


def capture_section_a(section, *, student, semester, actor):
    if section is None:
        return None
    captured_at = timezone.now().isoformat()
    return {
        "version": 1, "studentParticulars": student_particulars(student, semester),
        "titleOrigin": section["titleOrigin"], "noCoursesTaken": section["noCoursesTaken"],
        "courseResults": section["courseResults"],
        "declaration": {"text": DECLARATION_TEXT, "acceptedAt": captured_at, "acceptedBy": actor.pk},
        "capturedAt": captured_at,
    }
