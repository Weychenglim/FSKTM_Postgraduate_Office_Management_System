"""Student Registry API (UC05-UC09), mounted under ``/api/registry/``.

Office Staff/Admin manage postgraduate student records here; Programme
Coordinators and Lecturers get read-only access to the students in their scope.
The read shape matches the frontend ``StudentRecord`` type.

The supervisor shown on a record is read, never written, from the student's
active primary ``SupervisorAppointment`` in the ``appointments`` app.
"""
import logging
from collections import Counter
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.core.mail import get_connection, send_mail
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Prefetch, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from appointments.models import (
    CoSupervisorAppointment,
    StudentResearchProfile,
    SupervisorAppointment,
)

from .account_emails import activation_email, email_changed_email
from .authorization import coordinator_scope_q
from .models import Lecturer, OfficeStaff, RegistryImportBatch, Student, StudentRegistry
from .participant_lifecycle import ParticipantLifecycleConflict, transition_student
from .programme_correction import ProgrammeCorrectionConflict, correct_programme
from .programmes import APPROVED_PROGRAMMES
from .registry_import import (
    ImportFileError,
    ImportOptionsError,
    inspect_import_file,
    parse_import_options,
    read_import_file,
    validate_import_rows,
)
from .registry_profiles import remember_layout
from .registry_template import TEMPLATE_FILE_NAME, XLSX_CONTENT_TYPE, build_template
from .registry_programmes import programme_values, remember_choices
from .semesters import read as read_semester
from .semester_rules import (
    active_semester,
    completion_of,
    intake_label,
    maximum_flag,
    record_semester,
    rules_by_programme,
    seed_student,
    shown_status,
)
from .semesters import read as read_semester
from .session_tokens import blacklist_user_refresh_tokens
from .throttles import AccessLinkRateThrottle, BatchInvitationRateThrottle
from .tokens import activation_link
from .validators import matric_problem, validate_phone
from .views import send_password_reset_email

User = get_user_model()
logger = logging.getLogger(__name__)

# Mirrors the palette the Registry Management screen already renders.
AVATAR_PALETTE = [
    "bg-blue-100 text-blue-850 border-blue-200",
    "bg-indigo-100 text-indigo-850 border-indigo-200",
    "bg-emerald-100 text-emerald-850 border-emerald-200",
    "bg-amber-100 text-amber-850 border-amber-200",
    "bg-rose-100 text-rose-850 border-rose-200",
    "bg-violet-100 text-violet-850 border-violet-200",
]


def _require_office_admin(request):
    if getattr(request.user, "role", None) == User.Role.OFFICE_ADMIN:
        return
    raise PermissionDenied("Only Office Staff/Admin may manage the student registry.")


def _initials(full_name: str) -> str:
    parts = [p for p in full_name.split() if p]
    return "".join(p[0].upper() for p in parts[:2]) or "ST"


def _avatar_bg(key: str) -> str:
    return AVATAR_PALETTE[sum(ord(c) for c in key) % len(AVATAR_PALETTE)]


def _registry_or_none(student):
    try:
        return student.registry
    except ObjectDoesNotExist:
        return None


def _registry_scope(user):
    """Students ``user`` may read, or ``None`` when they have no registry access.

    Office Staff/Admin read everything. Programme Coordinators read the
    programmes they currently manage (their own while eligible, plus active
    delegations), and Coordinators and Lecturers read the students they
    currently supervise or co-supervise.
    """
    if user.role == User.Role.OFFICE_ADMIN:
        return Student.objects.all()
    if user.role not in (User.Role.COORDINATOR, User.Role.LECTURER):
        return None
    scope = Q(
        supervisor_appointments__supervisor=user,
        supervisor_appointments__status=SupervisorAppointment.Status.ACTIVE,
    ) | Q(
        co_supervisor_appointments__supervisor=user,
        co_supervisor_appointments__status=CoSupervisorAppointment.Status.ACTIVE,
    )
    scope |= coordinator_scope_q(user)
    return Student.objects.filter(scope).distinct()


def _require_registry_reader(request):
    scope = _registry_scope(request.user)
    if scope is None:
        raise PermissionDenied("You do not have access to the student registry.")
    return scope


def _active_supervision():
    return Prefetch(
        "supervisor_appointments",
        queryset=SupervisorAppointment.objects.filter(
            status=SupervisorAppointment.Status.ACTIVE
        ).select_related("supervisor__lecturer"),
        to_attr="active_supervision",
    )


def _supervisor_of(student):
    supervision = getattr(student, "active_supervision", None)
    if supervision is None:
        supervision = list(
            student.supervisor_appointments.filter(
                status=SupervisorAppointment.Status.ACTIVE
            ).select_related("supervisor__lecturer")
        )
    return supervision[0].supervisor if supervision else None


def to_record(student, rules=None, active=...) -> dict:
    """Shape a Student (+ optional registry row) as the frontend expects."""
    user = student.user
    registry = _registry_or_none(student)
    completion = completion_of(student)
    senate = completion.senate_decision if completion else None
    supervisor = _supervisor_of(student)
    supervisor_profile = supervisor._related_or_none("lecturer") if supervisor else None
    return {
        "id": student.matric_no,
        "hasResearchProfile": user._related_or_none("research_profile") is not None,
        "name": user.full_name,
        "avatarText": _initials(user.full_name),
        "avatarBg": _avatar_bg(student.matric_no),
        "programme": student.programme,
        "academicStatus": student.status,
        "displayStatus": shown_status(student, active),
        "exitReason": student.exit_reason,
        "exitReasonLabel": student.get_exit_reason_display() if student.exit_reason else "",
        "senateDate": senate.decided_on.isoformat() if senate else None,
        "accountStatus": "Verified" if user.is_active else "Suspended",
        "semester": (registry.current_semester if registry else "")
        or student.intake_semester,
        "email": user.email,
        "phone": user.phone,
        "supervisor": supervisor.full_name if supervisor else "",
        "supervisorStaffNo": supervisor_profile.staff_no if supervisor_profile else "",
        "intakeDate": student.intake_semester,
        "intakeLabel": intake_label(student.intake_semester),
        "maximumFlag": maximum_flag(student, rules, registry),
        # Lets the office spot accounts that were registered but never
        # activated, e.g. because the invitation bounced.
        "activated": user.has_usable_password(),
        "lastLogin": (user.last_portal_login or user.last_login).isoformat()
        if (user.last_portal_login or user.last_login)
        else None,
    }


def _readable_semester(value):
    text = value.strip()
    if text and read_semester(text) is None:
        raise serializers.ValidationError("Choose a semester like 2026/2027 Semester I.")
    return text


class StudentRecordCreateSerializer(serializers.Serializer):
    """Office Staff registering a new postgraduate student."""

    id = serializers.CharField(max_length=64)
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField(max_length=254)
    programme = serializers.ChoiceField(choices=APPROVED_PROGRAMMES, required=False)
    phone = serializers.CharField(
        max_length=32, allow_blank=True, required=False, validators=[validate_phone]
    )
    semester = serializers.CharField(max_length=64, allow_blank=True, required=False)
    intakeDate = serializers.CharField(max_length=32, allow_blank=True, required=False)
    academicStatus = serializers.ChoiceField(
        choices=Student.Status.choices, required=False, default=Student.Status.ACTIVE
    )
    sendInvite = serializers.BooleanField(required=False, default=True)

    def validate_semester(self, value):
        return _readable_semester(value)

    def validate_intakeDate(self, value):
        return _readable_semester(value)

    def validate_id(self, value):
        matric = value.strip()
        if not matric:
            raise serializers.ValidationError("Matric number is required.")
        problem = matric_problem(matric)
        if problem:
            raise serializers.ValidationError(problem)
        # Sign-in accepts a matric or a staff number, so one value must not be both.
        if (
            OfficeStaff.objects.filter(staff_no__iexact=matric).exists()
            or Lecturer.objects.filter(staff_no__iexact=matric).exists()
        ):
            raise serializers.ValidationError(
                f"'{matric}' is already used as a staff number."
            )
        # Case-insensitive: matric_no is unique case-*sensitively* in Postgres,
        # and near-duplicates make the detail route ambiguous.
        if Student.objects.filter(matric_no__iexact=matric).exists():
            raise serializers.ValidationError(
                f"A student with matric number '{matric}' already exists."
            )
        return matric

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_academicStatus(self, value):
        if value != Student.Status.ACTIVE:
            raise serializers.ValidationError(
                "New students start as Active. Change the status afterwards with a reason."
            )
        return value


class StudentRecordUpdateSerializer(serializers.Serializer):
    """Fields Office Staff may correct from the Registry screen."""

    name = serializers.CharField(max_length=255, required=False)
    email = serializers.EmailField(max_length=254, required=False)
    programme = serializers.ChoiceField(choices=APPROVED_PROGRAMMES, required=False)
    academicStatus = serializers.ChoiceField(
        choices=Student.Status.choices, required=False
    )
    programmeReason = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    statusReason = serializers.CharField(
        max_length=1000, allow_blank=True, required=False
    )
    accountStatus = serializers.ChoiceField(
        choices=["Verified", "Suspended"], required=False
    )
    phone = serializers.CharField(
        max_length=32, allow_blank=True, required=False, validators=[validate_phone]
    )
    semester = serializers.CharField(max_length=64, allow_blank=True, required=False)
    intakeDate = serializers.CharField(max_length=32, allow_blank=True, required=False)

    def validate_semester(self, value):
        return _readable_semester(value)

    def validate_intakeDate(self, value):
        return _readable_semester(value)

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Enter the student's full name.")
        return name

    def validate_email(self, value):
        return value.strip().lower()

    def to_internal_value(self, data):
        # An ignored key read as "saved" to the office (e.g. a matric number
        # edit), so anything this form cannot change is refused outright.
        if hasattr(data, "keys"):
            unknown = sorted(set(data.keys()) - set(self.fields))
            if unknown:
                raise serializers.ValidationError(
                    {key: ["This field cannot be changed from the registry."] for key in unknown}
                )
        return super().to_internal_value(data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def student_records_view(request):
    """List the records the caller may read, or register a new student."""
    if request.method == "POST":
        _require_office_admin(request)
        return _create_student(request)

    queryset = _require_registry_reader(request).select_related(
        "user", "user__research_profile", "registry", "completion__senate_decision"
    ).prefetch_related(_active_supervision(), "semesters")
    search = (request.query_params.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(matric_no__icontains=search)
            | Q(user__full_name__icontains=search)
            | Q(user__email__icontains=search)
            | Q(programme__icontains=search)
        )
    academic_status = (request.query_params.get("status") or "").strip()
    if academic_status:
        queryset = queryset.filter(status__iexact=academic_status)
    programme = (request.query_params.get("programme") or "").strip()
    if programme:
        queryset = queryset.filter(programme__iexact=programme)
    supervisor = (request.query_params.get("supervisor") or "").strip()
    if supervisor:
        queryset = queryset.filter(
            Q(supervisor_appointments__status=SupervisorAppointment.Status.ACTIVE)
            & (
                Q(supervisor_appointments__supervisor__full_name__icontains=supervisor)
                | Q(supervisor_appointments__supervisor__lecturer__staff_no__iexact=supervisor)
            )
        ).distinct()

    rules = rules_by_programme()
    active = active_semester()
    return Response([to_record(student, rules, active) for student in queryset])


def send_activation_email(user, connection=None) -> bool:
    """Email the new student a link to choose their first password.

    The link has no time limit and stops working once a password is set (see
    ``accounts.tokens``), so no credential is ever generated or transmitted.
    Returns whether the send succeeded; the office needs to know when an
    address bounced.
    """
    subject, message = activation_email(user, activation_link(user))
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
            connection=connection,
        )
        return True
    except Exception:
        # Never fail the registration because mail is down; the office is told
        # in the response and can resend.
        logger.exception("Activation email to user %s could not be sent.", user.pk)
        return False


def tell_old_address(user, old_email):
    """Email the old address after the office changed an account's email.
    Returns whether it went."""
    subject, message = email_changed_email(user, old_email)
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [old_email], fail_silently=False)
        return True
    except Exception:
        logger.exception("Email-change notice for user %s could not be sent.", user.pk)
        return False


def _register_student(data):
    """Create the login account and the Student profile in one transaction.

    No password is set. The account starts with an unusable password and the
    student chooses their own through the activation link, so the office never
    handles or transmits a temporary credential.

    Returns the new ``Student``; raises ``IntegrityError`` if the matric number
    or email was taken after validation. The caller sends the invitation.
    """
    with transaction.atomic():
        user = User(
            email=data["email"],
            full_name=data["name"].strip(),
            role=User.Role.STUDENT,
            phone=data.get("phone", ""),
        )
        user.set_unusable_password()
        user.save()

        student = Student.objects.create(
            user=user,
            matric_no=data["id"],
            programme=data.get("programme", ""),
            status=data.get("academicStatus", Student.Status.ACTIVE),
            intake_semester=data.get("intakeDate", ""),
        )
        semester = data.get("semester", "")
        if semester:
            StudentRegistry.objects.create(student=student, current_semester=semester)
        seed_student(student)
    return student


def _create_student(request):
    serializer = StudentRecordCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        student = _register_student(serializer.validated_data)
    except IntegrityError:
        # The serializer's uniqueness checks leave a small window before the
        # insert; the database is the authority, so report the conflict rather
        # than letting it surface as a 500.
        return Response(
            {"error": "That matric number or email was just registered. Please reload."},
            status=status.HTTP_409_CONFLICT,
        )

    invitation_sent = (
        send_activation_email(student.user)
        if serializer.validated_data.get("sendInvite", True)
        else False
    )
    payload = to_record(student)
    payload["invitationSent"] = invitation_sent
    return Response(payload, status=status.HTTP_201_CREATED)


def _first_error(errors):
    for messages in errors.values():
        if messages:
            return str(messages[0])
    return "The record could not be created."


def _import_row(row):
    """Create one Ready row. Returns ``(result, student)``; student is None on failure."""
    serializer = StudentRecordCreateSerializer(
        data={
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "programme": row["programme"],
            "phone": row["phone"],
            "intakeDate": row.get("intake", ""),
            "semester": row.get("semester", ""),
        }
    )
    if not serializer.is_valid():
        return {**row, "result": "failed", "issue": _first_error(serializer.errors)}, None
    try:
        student = _register_student(serializer.validated_data)
    except IntegrityError:
        return {
            **row,
            "result": "failed",
            "issue": "this matric number or email was registered during the import",
        }, None
    except DatabaseError:
        logger.exception("Import row %s could not be saved.", row.get("line"))
        return {**row, "result": "failed", "issue": "the record could not be saved"}, None
    return {**row, "result": "created", "invitationSent": False}, student


def _send_activation_emails(users):
    """Email each user their activation link over one mail connection.
    Returns ``{user pk: sent}``."""
    if not users:
        return {}
    connection = get_connection()
    try:
        connection.open()
    except Exception:
        logger.exception("Could not open the mail connection for activation emails.")
    sent = {}
    try:
        for user in users:
            sent[user.pk] = send_activation_email(user, connection=connection)
    finally:
        try:
            connection.close()
        except Exception:
            pass
    return sent


EMAIL_NOT_SENT = "activation email could not be sent"


def _created_entry(result, student):
    """A created student as the import batch keeps them: Student ID, file line,
    and whether the email was filled from the Student ID."""
    entry = {"id": student.matric_no, "line": result["line"]}
    if result.get("emailFilled"):
        entry["emailFilled"] = True
    return entry


def _batch_entry(row, issue=None):
    """One row of an import batch's record: every row that was not simply
    created, plus created rows whose activation email failed."""
    entry = {
        "line": row["line"],
        "id": row["id"],
        "name": row["name"],
        "status": row["status"],
        "result": row["result"],
        "issue": row["issue"] if issue is None else issue,
    }
    if "existing" in row:
        entry["existingName"] = row["existing"]["name"]
        entry["differences"] = row["differences"]
    if "duplicateOf" in row:
        entry["duplicateOf"] = row["duplicateOf"]
    return entry


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def student_import_view(request):
    """Bulk-import students from a CSV or XLSX file (UC04).

    ``dryRun`` checks every row and writes nothing. Otherwise each Ready row is
    created on its own, duplicates and rows of a skipped programme are skipped,
    other problem rows are left out, and the run is recorded as a
    ``RegistryImportBatch``. The office's programme choices and column matches
    are remembered for the next import.
    """
    _require_office_admin(request)

    uploaded = request.FILES.get("file")
    if uploaded is None:
        return Response(
            {"error": "Choose a CSV or XLSX file to import."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        options = parse_import_options(request.data.get("options"))
        file_rows = read_import_file(uploaded, options)
        programme_map = (options or {}).get("programmeMap") or {}
        rows = validate_import_rows(file_rows, programme_map)
    except ImportOptionsError as exc:
        return Response(exc.errors, status=status.HTTP_400_BAD_REQUEST)
    except ImportFileError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    send_invites = options["sendInvites"] if options else True
    if str(request.data.get("dryRun", "")).lower() in {"1", "true", "yes"}:
        # Programme names that are not approved programmes, for the office to
        # map once each or skip.
        values, value_count = programme_values(file_rows)
        return Response(
            {
                "fileName": uploaded.name,
                "rows": rows,
                "programmeValues": values,
                "programmeValueCount": value_count,
            }
        )

    results = []
    new_students = []
    for row in rows:
        if row["status"] == "Ready":
            result, student = _import_row(row)
            results.append(result)
            if student is not None:
                new_students.append((result, student))
        elif row["status"] in {"Duplicate In File", "Already Registered", "Programme Skipped"}:
            results.append({**row, "result": "skipped"})
        else:
            results.append({**row, "result": "failed"})

    # Record the batch before any mail goes out, so a slow or interrupted send
    # never leaves created accounts without an import record.
    problems = [_batch_entry(r) for r in results if r["result"] != "created"]
    batch = RegistryImportBatch.objects.create(
        file_name=uploaded.name[:255],
        uploaded_by=request.user,
        uploaded_by_name=request.user.full_name,
        total_rows=len(results),
        created_count=len(new_students),
        skipped_count=sum(1 for r in results if r["result"] == "skipped"),
        failed_count=sum(1 for r in results if r["result"] == "failed"),
        problems=problems,
        created_students=[_created_entry(result, student) for result, student in new_students],
        invitations_held=not send_invites and bool(new_students),
        settings_used={
            "defaults": (options or {}).get("defaults") or {},
            "programmeMap": programme_map,
            "fillEmail": bool((options or {}).get("fillEmail")),
            "idRule": (options or {}).get("idRule"),
            "sendInvites": send_invites,
        },
    )
    remember_choices(file_rows, programme_map, request.user)
    remember_layout((options or {}).get("rememberLayout"), request.user)

    if not send_invites:
        # The office sends them later from Recent Imports.
        for result, _ in new_students:
            result["invitationHeld"] = True
        return Response(
            {"batch": batch.to_public_dict(), "rows": results},
            status=status.HTTP_201_CREATED,
        )

    sent = _send_activation_emails([student.user for _, student in new_students])
    for result, student in new_students:
        result["invitationSent"] = sent[student.user.pk]

    unsent = [r for r, _ in new_students if not r["invitationSent"]]
    if unsent:
        batch.invitations_failed = len(unsent)
        batch.problems = problems + [
            _batch_entry(r, issue=EMAIL_NOT_SENT) for r in unsent
        ]
        batch.save(update_fields=["invitations_failed", "problems"])
    return Response(
        {"batch": batch.to_public_dict(), "rows": results},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def student_import_inspect_view(request):
    """Describe an uploaded file's layout (sheets, column-name row, columns
    with sample values, suggested matches) so the office can confirm which
    column is which before any row is checked (UC04)."""
    _require_office_admin(request)
    uploaded = request.FILES.get("file")
    if uploaded is None:
        return Response(
            {"error": "Choose a CSV or XLSX file to import."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        return Response(inspect_import_file(uploaded, parse_import_options(request.data.get("options"))))
    except ImportOptionsError as exc:
        return Response(exc.errors, status=status.HTTP_400_BAD_REQUEST)
    except ImportFileError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


def _invitation_outcome(user, sent):
    """What a held activation email did for one student of the import."""
    if not user.is_active:
        return "suspended"
    if user.has_usable_password():
        return "alreadyActivated"
    return "sent" if sent[user.pk] else "failed"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_import_template_view(request):
    """The Excel template for typing a list (UC04). The office's own
    spreadsheet imports as it is, so the template is optional."""
    _require_office_admin(request)
    response = HttpResponse(build_template(), content_type=XLSX_CONTENT_TYPE)
    response["Content-Disposition"] = f'attachment; filename="{TEMPLATE_FILE_NAME}"'
    return response


# A second send of the same import within this time is refused, so a double
# click or two office staff cannot email every student twice.
INVITATION_REPEAT_WAIT = timedelta(minutes=2)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([BatchInvitationRateThrottle])
def import_batch_invitations_view(request, batch_id):
    """Send the activation emails an import held back, or send them again.

    Only students from that import who are still active and have not set a
    password are emailed, so it never reaches anyone who has activated.
    Each student's outcome comes back with its file line, and emails that
    could not be sent are recorded on the import, as when an import sends
    them straight away.
    """
    _require_office_admin(request)
    with transaction.atomic():
        batch = RegistryImportBatch.objects.select_for_update().filter(pk=batch_id).first()
        if batch is None:
            return Response({"error": "No such import."}, status=status.HTTP_404_NOT_FOUND)
        if batch.invitations_sent_at and timezone.now() - batch.invitations_sent_at < INVITATION_REPEAT_WAIT:
            return Response(
                {"error": "Activation emails for this import were sent a moment ago. Wait a few minutes before sending them again."},
                status=status.HTTP_409_CONFLICT,
            )
        lines = {entry["id"]: entry["line"] for entry in batch.created_students}
        students = sorted(
            Student.objects.select_related("user").filter(matric_no__in=list(lines)),
            key=lambda student: lines[student.matric_no],
        )
        waiting = [
            student.user
            for student in students
            if student.user.is_active and not student.user.has_usable_password()
        ]
        sent = _send_activation_emails(waiting)
        outcomes = [
            {
                "id": student.matric_no,
                "line": lines[student.matric_no],
                "name": student.user.full_name,
                "outcome": _invitation_outcome(student.user, sent),
            }
            for student in students
        ]
        # A student emailed now, or who has activated since, replaces any
        # earlier failure; suspended students keep theirs.
        settled = {entry["id"] for entry in outcomes if entry["outcome"] != "suspended"}
        batch.problems = [
            problem
            for problem in batch.problems
            if not (problem.get("issue") == EMAIL_NOT_SENT and problem.get("id") in settled)
        ] + [
            _batch_entry({**entry, "status": "Ready", "result": "created"}, issue=EMAIL_NOT_SENT)
            for entry in outcomes
            if entry["outcome"] == "failed"
        ]
        batch.invitations_held = False
        batch.invitations_sent_at = timezone.now()
        batch.invitations_failed = sum(1 for problem in batch.problems if problem.get("issue") == EMAIL_NOT_SENT)
        batch.save(
            update_fields=["invitations_held", "invitations_sent_at", "invitations_failed", "problems"]
        )
    counts = Counter(entry["outcome"] for entry in outcomes)
    return Response(
        {
            "sent": counts["sent"],
            "failed": counts["failed"],
            "alreadyActivated": counts["alreadyActivated"],
            "suspended": counts["suspended"],
            "notFound": len(lines) - len(students),
            "students": [
                {"id": entry["id"], "line": entry["line"], "outcome": entry["outcome"]}
                for entry in outcomes
            ],
            "batch": batch.to_public_dict(),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def import_batches_view(request):
    """Most recent bulk imports, newest first (``?limit=``, 1-50, default 5)."""
    _require_office_admin(request)
    try:
        limit = int(request.query_params.get("limit", 5))
    except ValueError:
        limit = 5
    limit = max(1, min(limit, 50))
    return Response(
        [batch.to_public_dict() for batch in RegistryImportBatch.objects.all()[:limit]]
    )


def _find_student(matric_no, queryset=None):
    """Return ``(student, None)`` or ``(None, error_response)``.

    Pass the caller's registry scope as ``queryset`` so a student outside it
    reads as not found rather than confirming the record exists.
    """
    queryset = Student.objects.all() if queryset is None else queryset
    matches = list(
        queryset.select_related("user", "registry").filter(
            matric_no__iexact=matric_no
        )[:2]
    )
    if not matches:
        return None, Response(
            {"error": f"No student found with matric number '{matric_no}'."},
            status=status.HTTP_404_NOT_FOUND,
        )
    if len(matches) > 1:
        # `matric_no` is unique but case-sensitively so, so `iexact` can match
        # more than one row. Picking one arbitrarily previously edited (and
        # suspended) the wrong student, so refuse instead of guessing.
        return None, Response(
            {
                "error": (
                    f"More than one student matches '{matric_no}' when case is "
                    "ignored. Correct the duplicate matric numbers first."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )
    return matches[0], None


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def student_record_detail_view(request, matric_no):
    """Retrieve one student's registry record, or correct it (Office only)."""
    if request.method == "GET":
        student, error = _find_student(matric_no, _require_registry_reader(request))
        if error:
            return error
        return Response(to_record(student))

    _require_office_admin(request)
    student, error = _find_student(matric_no)
    if error:
        return error

    serializer = StudentRecordUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    status_change = "academicStatus" in data and data["academicStatus"] != student.status
    if status_change and data["academicStatus"] == Student.Status.GRADUATED:
        return Response(
            {"error": "Graduations are recorded from the Graduation page."},
            status=status.HTTP_409_CONFLICT,
        )
    reason = data.get("statusReason", "").strip()
    if status_change and not reason:
        return Response(
            {"statusReason": ["A reason is required to change the academic status."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    old_email = student.user.email
    email_change = "email" in data and data["email"] != old_email.lower()
    if email_change and User.objects.filter(email__iexact=data["email"]).exclude(pk=student.user_id).exists():
        return Response(
            {"email": ["An account with this email already exists."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        if status_change:
            try:
                transition_student(
                    matric_no=student.matric_no,
                    actor=request.user,
                    target_status=data["academicStatus"].upper(),
                    reason=reason,
                )
            except PermissionError as exc:
                return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
            except ParticipantLifecycleConflict as exc:
                return Response(
                    {"error": str(exc), "blockers": exc.blockers},
                    status=status.HTTP_409_CONFLICT,
                )
            except ValueError as exc:
                return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            student.refresh_from_db()

        student_fields = []
        if "programme" in data and data["programme"] != student.programme:
            # The research profile carries its own programme, and the two must match.
            if StudentResearchProfile.objects.filter(student_id=student.user_id).exists():
                programme_reason = data.get("programmeReason", "").strip()
                if not programme_reason:
                    transaction.set_rollback(True)
                    return Response(
                        {"programmeReason": ["Give a reason for the correction."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                try:
                    correct_programme(student, data["programme"], actor=request.user, reason=programme_reason)
                except ProgrammeCorrectionConflict as exc:
                    transaction.set_rollback(True)
                    return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
            student.programme = data["programme"]
            student_fields.append("programme")
        if "intakeDate" in data:
            student.intake_semester = data["intakeDate"]
            student_fields.append("intake_semester")
        if student_fields:
            student.save(update_fields=student_fields)

        user_fields = []
        if "name" in data and data["name"] != student.user.full_name:
            student.user.full_name = data["name"]
            user_fields.append("full_name")
        if email_change:
            # The email is also the sign-in name, and changing it ends any
            # activation or reset link sent to the old address.
            student.user.email = data["email"]
            user_fields.append("email")
        if "phone" in data:
            student.user.phone = data["phone"]
            user_fields.append("phone")
        if "accountStatus" in data:
            # Suspending yourself invalidates your own session mid-request, and
            # suspending a superuser locks the system's own escape hatch.
            if student.user_id == request.user.pk:
                raise PermissionDenied("You cannot change your own account status.")
            if student.user.is_superuser:
                raise PermissionDenied("You cannot change a superuser's account status.")
            student.user.is_active = data["accountStatus"] == "Verified"
            user_fields.append("is_active")
        if user_fields:
            student.user.save(update_fields=user_fields)
        if data.get("accountStatus") == "Suspended":
            # Without this, reinstating the account within seven days revived
            # every refresh session issued before the suspension.
            blacklist_user_refresh_tokens(student.user)

        if "semester" in data:
            typed = read_semester(data["semester"])
            if typed:
                record_semester(student, typed, actor=request.user)
            registry, _ = StudentRegistry.objects.get_or_create(student=student)
            registry.current_semester = data["semester"]
            registry.save(update_fields=["current_semester", "updated_at"])
        seed_student(student, actor=request.user)

    student.refresh_from_db()
    payload = to_record(student)
    if email_change:
        # As for staff: only someone who has signed in used the old address,
        # so only they are told; an unactivated account needs a new link.
        payload["oldAddressTold"] = (
            tell_old_address(student.user, old_email) if student.user.has_usable_password() else None
        )
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([AccessLinkRateThrottle])
def student_access_link_view(request, matric_no):
    """Email a student a way back in: the activation link if they never set a
    password, otherwise a password-reset link."""
    _require_office_admin(request)

    student, error = _find_student(matric_no)
    if error:
        return error
    user = student.user
    if not user.is_active:
        return Response(
            {"error": "Reinstate this account before sending an access link."},
            status=status.HTTP_409_CONFLICT,
        )

    if user.has_usable_password():
        return Response({"kind": "reset", "sent": send_password_reset_email(user)})
    return Response({"kind": "activation", "sent": send_activation_email(user)})
