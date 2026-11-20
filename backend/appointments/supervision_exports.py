"""Export current, scoped supervision without serialising workflow histories."""
from collections import defaultdict
from io import BytesIO

from django.db.models import Q
from openpyxl import Workbook

from dashboard.reports import _append_sheet
from .attention_project_stages import attention_stages
from .coordinator_workspace import filter_team_relationship, team_selection
from .models import CoSupervisorAppointment, SupervisorAppointment


def supervision_workbook(actor, params):
    opts, view, students, direct_students = team_selection(actor, params)
    students = list(students.order_by("user__full_name", "matric_no", "pk").values(
        "pk", "user__full_name", "matric_no", "programme"))
    student_by_id = {student["pk"]: student for student in students}
    semester = opts["project_semester"]
    stages = opts["project_stages"]
    if stages is None:
        stages = attention_stages(semester, student_by_id)
    labels = {"P1": "RP1", "P2": "RP2", "NOT_CONFIRMED": "Unconfirmed",
              "NOT_STARTED": "Not started", "NOT_STUDYING": "Not studying", "COMPLETED": "Completed"}

    def project_columns(student_id):
        return {"projectStage": labels.get(stages.get(student_id), "Unavailable"),
                "projectSemester": semester.label if semester else ""}

    relationships = []
    teams = defaultdict(lambda: {"primary": [], "supporting": []})
    # Fixed batched reads keep query count independent of the number of students.
    for model, kind, relation in ((SupervisorAppointment, "primary", "application"),
                                  (CoSupervisorAppointment, "supporting", "nomination")):
        active = model.objects.filter(status="ACTIVE", student_id__in=student_by_id)
        matched = filter_team_relationship(active, opts, kind, relation)
        if view == "supervisors" and not opts["supervisor"] and direct_students is not None:
            matched = matched.filter(Q(supervisor__full_name__icontains=opts["q"]) |
                                     Q(student__in=direct_students))
        matched_ids = set(matched.values_list("pk", flat=True))
        for appointment in active.order_by("supervisor__full_name", "supervisor_id", "pk").values(
            "pk", "student_id", "supervisor_id", "supervisor__full_name", "supervisor__lecturer__staff_no"):
            teams[appointment["student_id"]][kind].append(appointment)
            if appointment["pk"] not in matched_ids:
                continue
            student = student_by_id[appointment["student_id"]]
            relationships.append({
                "lecturer": appointment["supervisor__full_name"],
                "staff": appointment["supervisor__lecturer__staff_no"] or "",
                "student": student["user__full_name"], "matric": student["matric_no"],
                "programme": student["programme"], **project_columns(student["pk"]),
                "role": "Primary supervisor" if kind == "primary" else "Supporting supervisor",
                "lecturerId": appointment["supervisor_id"], "studentId": student["pk"],
            })
    relationships.sort(key=lambda row: (row["lecturer"], row["lecturerId"], row["student"],
                                        row["matric"], row["studentId"], row["role"]))
    student_rows = []
    for student in students:
        team = teams[student["pk"]]
        primary = team["primary"][0] if team["primary"] else None
        student_rows.append({
            "student": student["user__full_name"], "matric": student["matric_no"],
            "programme": student["programme"], **project_columns(student["pk"]),
            "primary": primary["supervisor__full_name"] if primary else "",
            "primaryStaff": (primary["supervisor__lecturer__staff_no"] or "") if primary else "",
            "supporting": "; ".join(row["supervisor__full_name"] for row in team["supporting"]),
            "supportingStaff": "; ".join(row["supervisor__lecturer__staff_no"] or "" for row in team["supporting"]),
        })
    workbook = Workbook()
    workbook.remove(workbook.active)
    # The report sheet helper writes every string as a literal cell, including '=' text.
    _append_sheet(workbook, "Students by lecturer", [
        ("lecturer", "Lecturer name"), ("staff", "Staff number"),
        ("student", "Student name"), ("matric", "Matric number"),
        ("programme", "Programme"), ("role", "Role"),
        ("projectStage", "Project stage"), ("projectSemester", "Project semester"),
    ], relationships)
    _append_sheet(workbook, "Supervisors by student", [
        ("student", "Student name"), ("matric", "Matric number"), ("programme", "Programme"),
        ("primary", "Active primary supervisor"), ("primaryStaff", "Primary staff number"),
        ("supporting", "All active supporting supervisors"), ("supportingStaff", "Supporting staff numbers"),
        ("projectStage", "Project stage"), ("projectSemester", "Project semester"),
    ], student_rows)
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()
