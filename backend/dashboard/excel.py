from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook, load_workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

from .models import SemesterTimelineEntry


REQUIRED_HEADERS = [
    "Level",
    "Title",
    "Detail",
    "Action",
    "Deadline Start",
    "Deadline End",
    "Target Roles",
]


def normalize_header(value):
    return str(value or "").strip()


def parse_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError("Invalid date format.")


def parse_target_roles(value):
    raw = str(value or "").replace("/", ",")
    roles = [role.strip().upper().replace(" ", "_") for role in raw.split(",") if role.strip()]
    invalid = [role for role in roles if role not in SemesterTimelineEntry.VALID_TARGET_ROLES]
    if invalid:
        raise ValueError(f"Invalid target role(s): {', '.join(invalid)}")
    if not roles:
        raise ValueError("At least one target role is required.")
    return roles


def derive_status(deadline_start, deadline_end):
    today = timezone.localdate(timezone=ZoneInfo("Asia/Kuala_Lumpur"))
    if today < deadline_start:
        return SemesterTimelineEntry.Status.UPCOMING
    if today > deadline_end:
        return SemesterTimelineEntry.Status.ENDED
    if deadline_start == deadline_end:
        return SemesterTimelineEntry.Status.DEADLINE
    return SemesterTimelineEntry.Status.ACTIVE


def parse_timeline_workbook(uploaded_file):
    errors = []
    parsed_rows = []
    try:
        workbook = load_workbook(uploaded_file, data_only=True)
    except Exception as exc:
        return [], [f"Could not read Excel workbook: {exc}"]

    sheet = workbook["Timeline"] if "Timeline" in workbook.sheetnames else workbook.active
    headers = [normalize_header(cell.value) for cell in sheet[1]]
    missing = [header for header in REQUIRED_HEADERS if header not in headers]
    if missing:
        return [], [f"Missing required columns: {', '.join(missing)}"]

    column_index = {header: index for index, header in enumerate(headers)}
    next_step_by_level = {"P1": 0, "P2": 0}

    for row_number, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        if not any(value not in (None, "") for value in row):
            continue

        def get(header):
            index = column_index.get(header)
            return row[index] if index is not None and index < len(row) else None

        row_errors = []
        level = str(get("Level") or "").strip().upper()
        if level not in {"P1", "P2"}:
            row_errors.append("Level must be P1 or P2.")

        title = str(get("Title") or "").strip()
        if not title:
            row_errors.append("Title is required.")

        detail = str(get("Detail") or "").strip()
        if not detail:
            row_errors.append("Detail is required.")

        action = str(get("Action") or "").strip()
        if not action:
            row_errors.append("Action is required.")

        try:
            deadline_start = parse_date(get("Deadline Start"))
        except ValueError:
            deadline_start = None
            row_errors.append("Deadline Start must be a valid date.")

        try:
            deadline_end = parse_date(get("Deadline End"))
        except ValueError:
            deadline_end = None
            row_errors.append("Deadline End must be a valid date.")

        if deadline_start and deadline_end and deadline_end < deadline_start:
            row_errors.append("Deadline End cannot be before Deadline Start.")

        week_label = str(get("Week Label") or "").strip()

        try:
            target_roles = parse_target_roles(get("Target Roles"))
        except ValueError as exc:
            target_roles = []
            row_errors.append(str(exc))

        if row_errors:
            errors.extend([f"Row {row_number}: {error}" for error in row_errors])
            continue

        next_step_by_level[level] += 1
        parsed_rows.append(
            {
                "level": level,
                "step": next_step_by_level[level],
                "title": title,
                "detail": detail,
                "action_owner": action,
                "deadline_start": deadline_start,
                "deadline_end": deadline_end,
                "week_label": week_label,
                "target_roles": target_roles,
                "status": derive_status(deadline_start, deadline_end),
                "display_order": len(parsed_rows) + 1,
                "activity_code": str(get("Activity Code") or "").strip().upper(),
                "period_id": str(get("Period ID") or "").strip(),
            }
        )

    if not parsed_rows and not errors:
        errors.append("Timeline workbook does not contain any timeline rows.")

    return parsed_rows, errors


TEMPLATE_HEADERS = REQUIRED_HEADERS.copy()


def build_template_workbook(semester=None):
    start = semester.starts_on if semester else timezone.localdate(timezone=ZoneInfo("Asia/Kuala_Lumpur"))
    end = semester.ends_on if semester else start + timedelta(days=30)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Timeline"
    sheet.append(TEMPLATE_HEADERS)
    sheet.append([
        "P1", "Supervisor appointment request",
        "Students submit their supervisor appointment application.",
        "Student / Supervisor", start, min(start + timedelta(days=4), end),
        "STUDENT,LECTURER",
    ])
    sheet.append([
        "P2", "Final presentation", "Students present their research to the Panel.",
        "Student / Supervisor / Panel", max(start, end - timedelta(days=7)), end,
        "STUDENT,LECTURER",
    ])
    sheet.append([
        "P1", "Review appointment records",
        "Office staff check approved appointment records for completeness.",
        "Office Staff", start, min(start + timedelta(days=4), end),
        "OFFICE_STAFF",
    ])
    rules = [
        ("Level", "Required", "P1 = Research Project 1; P2 = Research Project 2. Choose one per event.", "P1"),
        ("Title", "Required", "Short event name, up to 255 characters. Replace the example titles.", "Final presentation"),
        ("Detail", "Required", "Explain what happens or what the audience needs to do.", "Students present their research to the Panel."),
        ("Action", "Required", "Who is responsible. Shown as Responsible parties in Create/Edit and as Action in calendar event details. Free text, up to 255 characters; this does not control visibility.", "Student / Supervisor / Panel or Office Staff"),
        ("Deadline Start", "Required", "Excel date or YYYY-MM-DD (recommended). DD/MM/YYYY is also accepted.", start.isoformat()),
        ("Deadline End", "Required", "Same date formats as Start; must be on or after Start. For a one-day event, use the same date.", end.isoformat()),
        ("Target Roles", "Required", "Who sees the event: STUDENT, LECTURER, OFFICE_STAFF. Choose a dropdown combination or separate codes with commas. Panel and Supervisor both use LECTURER; do not type PANEL or SUPERVISOR here.", "STUDENT,LECTURER"),
    ]
    navy, muted, blue = "0F172A", "475569", "EFF6FF"
    for cell, (_, required, rule, _) in zip(sheet[1], rules):
        cell.font = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
        cell.fill = PatternFill("solid", fgColor=navy)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.comment = Comment(f"{required}. {rule}", "FSKTM Portal")
    sheet.row_dimensions[1].height = 32
    for row in sheet.iter_rows(min_row=2, max_row=4):
        sheet.row_dimensions[row[0].row].height = 64
        for cell in row:
            cell.font = Font(name="Calibri", size=11, color=navy)
            cell.fill = PatternFill("solid", fgColor=blue)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        for cell in (row[4], row[5]):
            cell.number_format = "yyyy-mm-dd"
    widths = {"A": 13, "B": 34, "C": 48, "D": 34, "E": 19, "F": 19, "G": 36}
    for column, width in widths.items():
        sheet.column_dimensions[column].width = width
    sheet.freeze_panes = "C2"
    sheet.auto_filter.ref = "A1:G4"
    sheet.sheet_view.showGridLines = True
    sheet.sheet_properties.tabColor = navy

    # Excel assists entry; server validation remains authoritative after paste/upload.
    choices = {
        "A": ("P1,P2", False),
        "G": ("STUDENT,LECTURER,OFFICE_STAFF,STUDENT/LECTURER,STUDENT/OFFICE_STAFF,LECTURER/OFFICE_STAFF,STUDENT/LECTURER/OFFICE_STAFF", False),
    }
    for column, (values, optional) in choices.items():
        validation = DataValidation(type="list", formula1=f'"{values}"', allow_blank=optional)
        validation.showErrorMessage = validation.showInputMessage = True
        validation.errorTitle = "Check the allowed values"
        validation.error = "Use one of the listed choices. See Instructions for the rules."
        validation.promptTitle = "Allowed values"
        validation.prompt = "Choose one option. See Instructions for full field guidance."
        # Comma-separated audiences are valid too; do not reject those typed values.
        if column == "G":
            validation.showErrorMessage = False
            validation.prompt = "Choose a combination or type comma-separated role codes."
        sheet.add_data_validation(validation)
        validation.add(f"{column}2:{column}5000")

    guide = workbook.create_sheet("Instructions")
    guide.append(["Semester calendar import guide"])
    guide.merge_cells("A1:D1")
    guide.append(["Selected semester", str(semester) if semester else "Use the semester selected in the portal", "Dates", f"{start.isoformat()} to {end.isoformat()}"])
    notes = [
        "1. Edit the Timeline sheet. Keep its name and row 1 headers unchanged; use one event per row. Instructions are not imported.",
        "2. The three Timeline rows are examples, not approved events. Edit or delete them before importing; do not upload an untouched template.",
        "3. Import REPLACES the selected semester's current calendar; it does not append. Include every event you want to keep, then preview and check the full list before confirming.",
        "4. Save as .xlsx (maximum 10 MB). Completely blank rows are ignored. Event order follows row order within P1 and P2. Do not add Step or Status columns; the portal calculates them.",
        "5. Keep event dates within the semester shown above. Past dates and out-of-semester calendar-only dates trigger preview warnings; review these before confirming.",
        "6. Import adds calendar information only. Link events and manage submission dates in Periods & deadlines, not in this workbook.",
        "7. Replacement cannot remove an existing linked event. Keep its event details and dates unchanged, or manage its link in Periods & deadlines before importing.",
        "8. Saving/importing for the current active semester makes events available to the selected audiences on their next dashboard refresh; there is no separate Publish step. A draft semester's timeline is prepared for later use.",
    ]
    for note in notes:
        guide.append([note])
        guide.merge_cells(start_row=guide.max_row, start_column=1, end_row=guide.max_row, end_column=4)
        guide.row_dimensions[guide.max_row].height = 45
    guide.append(["Column", "Required?", "What to type / rules", "Example"])
    heading_row = guide.max_row
    for rule in rules:
        guide.append(rule)
        guide.row_dimensions[guide.max_row].height = 90
    for row in guide:
        for cell in row:
            cell.font = Font(name="Calibri", size=11, color=muted)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
    for row_number in (1, heading_row):
        for cell in guide[row_number]:
            cell.font = Font(name="Calibri", size=12, bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=navy)
        guide.row_dimensions[row_number].height = 30
    guide.row_dimensions[2].height = 45
    for column, width in {"A": 24, "B": 19, "C": 76, "D": 40}.items():
        guide.column_dimensions[column].width = width
    guide.sheet_view.showGridLines = False
    # Keep all instructions scrollable, including on short displays.
    guide.freeze_panes = None
    guide.sheet_view.zoomScale = 85
    guide.sheet_properties.tabColor = "2563EB"
    guide.sheet_properties.pageSetUpPr.fitToPage = True
    guide.page_setup.orientation = "landscape"
    guide.page_setup.paperSize = guide.PAPERSIZE_A3
    guide.page_setup.fitToWidth = 1
    guide.page_setup.fitToHeight = 0
    guide.print_title_rows = f"{heading_row}:{heading_row}"
    workbook.active = 0
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()
