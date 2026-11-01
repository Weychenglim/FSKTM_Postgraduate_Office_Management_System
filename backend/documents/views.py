"""File Management API (UC24 to UC27)."""
import copy
import tempfile
import zipfile
from datetime import date

from django.db.models import Q
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import AcademicSemester
from academics.services import current_effective_semester
from accounts.authorization import programme_coordinators
from accounts.models import Student, User
from accounts.programmes import APPROVED_PROGRAMMES, normalise_programme
from accounts.throttles import SettingsRateThrottle
from letters.models import GeneratedLetter

from .access import (
    Scope,
    is_staff_member,
    panel_student_ids,
    people_reached,
    permissions,
    programme_key,
    supervisors_of,
    taggable_students,
    visible_documents,
)
from .history import SHOWS, history_rows
from .models import Document, DocumentEvent, DocumentStudent, DocumentType
from .office_settings import (
    KIND_UPLOADERS,
    add_type,
    change_type,
    type_settings_dict,
    types_with_counts,
)
from .previews import PreviewMissing, docx_text, image_png, pdf_page_png
from .required import (
    DONE,
    MISSING,
    RANK,
    RETURNED,
    STILL_TO_HAND_IN,
    WAITING,
    AlreadyReminded,
    NobodyToRemind,
    mine,
    programme_filter,
    progress,
    reminded_today,
    remind,
    required_types,
)
from .serializers import SENDERS, detail_dict, document_dict, with_details
from .services import (
    add_version,
    archive_document,
    change_sharing,
    check_document,
    create_document,
    delete_document,
    record_event,
    restore_document,
    sharing_of,
    update_details,
)
from .validation import UploadRejected, check_upload, max_upload_bytes, title_from_name

INACTIVE_STUDENT_CODE = "documents_need_active_status"
NOT_AVAILABLE = "This file isn't available to you."
MAX_STUDENTS = 50
MAX_TITLE = 200
MAX_DESCRIPTION = 1000
MAX_SEARCH = 100
TRUE_VALUES = {"1", "true", "yes", "on"}
SENDER_ROLES = {value: role for role, value in SENDERS.items()}


class DocumentUploadThrottle(SettingsRateThrottle):
    scope = "documents_upload"
    setting_name = "DOCUMENT_UPLOAD_THROTTLE_RATE"

    def get_cache_key(self, request, view):
        if request.method != "POST" or not request.user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


def _scope_or_refuse(request):
    user = request.user
    scope = Scope.for_user(user)
    if scope.office or is_staff_member(user) or (user.is_active and user.role == User.Role.STUDENT):
        return scope, None
    return scope, Response(
        {"detail": "File Management is not available for this account.", "code": "documents_role"},
        status=status.HTTP_403_FORBIDDEN,
    )


def _flag(value, default=False):
    if value is None or value == "":
        return default
    return str(value).strip().lower() in TRUE_VALUES


def _list(data, key):
    values = data.getlist(key) if hasattr(data, "getlist") else data.get(key) or []
    if isinstance(values, str):
        values = [values]
    items = []
    for value in values:
        items.extend(part.strip() for part in str(value).split(",") if part.strip())
    return items


def _bounded_int(raw, default, low, high):
    if raw in (None, ""):
        return default, None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, "must be a whole number"
    if value < low or value > high:
        return None, f"must be between {low} and {high}"
    return value, None


def _date(raw):
    try:
        return date.fromisoformat(raw)
    except (TypeError, ValueError):
        return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def options_view(request):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    user = request.user
    student_view = user.role == User.Role.STUDENT
    types = [
        doc_type
        for doc_type in DocumentType.objects.filter(is_active=True)
        if not student_view or (doc_type.for_students and "STUDENT" in (doc_type.uploaders or []))
    ]
    current = current_effective_semester()
    payload = {
        "types": [doc_type.to_public_dict() for doc_type in types],
        "groups": [{"value": value, "label": label} for value, label in DocumentType.Group.choices],
        "currentSemester": {"id": current.pk, "label": current.label} if current else None,
        "maxBytes": max_upload_bytes(),
        "isOffice": scope.office,
        "canUploadStaffFiles": scope.office or is_staff_member(user),
        "canSeeRequired": scope.office or bool(scope.coordinated),
    }
    if not student_view:
        payload["semesters"] = [
            {"id": semester.pk, "label": semester.label}
            for semester in AcademicSemester.objects.exclude(
                lifecycle_status=AcademicSemester.Lifecycle.ARCHIVED
            ).order_by("-starts_on")
        ]
        payload["programmes"] = list(APPROVED_PROGRAMMES)
        payload["intakes"] = sorted(
            set(taggable_students(user, scope).exclude(intake_semester="").values_list("intake_semester", flat=True)),
            reverse=True,
        )
        payload["audiences"] = [{"value": value, "label": label} for value, label in Document.Audience.choices]
    else:
        student = Student.objects.filter(user=user).first()
        if student is not None:
            ids = {student.user_id}
            names = dict(User.objects.filter(
                pk__in={lecturer for _, lecturer in supervisors_of(ids)} | {member for _, member in panel_student_ids(student_ids=ids)}
            ).values_list("pk", "full_name"))
            payload["me"] = {
                "programme": student.programme,
                "intake": student.intake_semester,
                "supervisors": [names[lecturer] for _, lecturer in supervisors_of(ids)],
                "panel": [names[member] for _, member in panel_student_ids(student_ids=ids)],
                "coordinators": [person.full_name for person in programme_coordinators(student.programme)] if student.programme else [],
            }
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_search_view(request):
    """Students the caller may tag on a file, with who a file about them reaches."""
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    if not (scope.office or is_staff_member(request.user)):
        return Response({"detail": "Only staff can tag students.", "code": "documents_role"}, status=status.HTTP_403_FORBIDDEN)
    text = (request.query_params.get("search") or "").strip()[:MAX_SEARCH]
    students = taggable_students(request.user, scope)
    if text:
        students = students.filter(Q(user__full_name__icontains=text) | Q(matric_no__icontains=text))
    students = list(students.order_by("user__full_name")[:20])
    ids = {student.user_id for student in students}
    me = request.user.pk
    supervisor_pairs = supervisors_of(ids)
    panel_pairs = panel_student_ids(student_ids=ids)
    names = dict(User.objects.filter(
        pk__in={lecturer for _, lecturer in supervisor_pairs + panel_pairs}
    ).values_list("pk", "full_name"))
    supervisors, panels = {}, {}
    for student_id, lecturer in supervisor_pairs:
        if lecturer != me:
            supervisors.setdefault(student_id, []).append(names[lecturer])
    for student_id, member in panel_pairs:
        if member != me:
            panels.setdefault(student_id, []).append(names[member])
    coordinators = {
        programme: [user.full_name for user in programme_coordinators(programme) if user.pk != me]
        for programme in {student.programme for student in students if student.programme}
    }
    return Response([
        {
            "matric": student.matric_no,
            "name": student.user.full_name,
            "programme": student.programme,
            "intake": student.intake_semester,
            "status": student.status,
            "relation": scope.relation_label(student),
            "roles": sorted(scope.relationships(student)),
            "supervisors": supervisors.get(student.user_id, []),
            "panel": panels.get(student.user_id, []),
            "coordinators": coordinators.get(student.programme, []),
        }
        for student in students
    ])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_header_view(request, matric):
    """The header above one student's files: who they are and who looks after them."""
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    student = None
    if scope.office or is_staff_member(request.user):
        student = taggable_students(request.user, scope).filter(matric_no__iexact=matric.strip()).first()
    if student is None:
        return Response({"detail": "This student isn't available to you."}, status=status.HTTP_404_NOT_FOUND)
    ids = {student.user_id}
    names = dict(User.objects.filter(
        pk__in={lecturer for _, lecturer in supervisors_of(ids)} | {member for _, member in panel_student_ids(student_ids=ids)}
    ).values_list("pk", "full_name"))
    letters = None
    if scope.office:
        letters = GeneratedLetter.objects.filter(student=student, status=GeneratedLetter.Status.ISSUED).count()
    required = None
    if scope.office or programme_key(student.programme) in scope.coordinated:
        required = [{"label": doc_type.label, "state": state} for doc_type, state, _ in mine(student)]
    return Response({
        "matric": student.matric_no,
        "name": student.user.full_name,
        "programme": student.programme,
        "status": student.status,
        "supervisors": [names[lecturer] for _, lecturer in supervisors_of(ids)],
        "panel": [names[member] for _, member in panel_student_ids(student_ids=ids)],
        "letters": letters,
        "required": required,
    })


def _filtered(request, scope):
    params = request.query_params
    documents = visible_documents(request.user, scope)
    errors = {}
    if scope.office:
        documents = documents.filter(archived_at__isnull=not _flag(params.get("archived")))
    view = params.get("view") or "all"
    if view == "check":
        documents = documents.filter(check_status=Document.CheckStatus.WAITING)
    elif view == "staff":
        documents = documents.filter(is_staff_file=True)
    elif view == "mine":
        documents = documents.filter(uploaded_by=request.user)
    elif view != "all":
        errors["view"] = ["Use all, check, staff or mine."]
    text = (params.get("q") or "").strip()[:MAX_SEARCH]
    if text:
        groups = [value for value, label in DocumentType.Group.choices if text.casefold() in label.casefold()]
        documents = documents.filter(
            Q(reference__icontains=text)
            | Q(title__icontains=text)
            | Q(description__icontains=text)
            | Q(doc_type__label__icontains=text)
            | Q(doc_type__group__in=groups)
            | Q(current_version__original_name__icontains=text)
            | Q(uploaded_by__full_name__icontains=text)
            | Q(staff_programmes__icontains=text)
            | Q(pk__in=DocumentStudent.objects.filter(
                Q(student__user__full_name__icontains=text)
                | Q(student__matric_no__icontains=text)
                | Q(student__programme__icontains=text)
                | Q(student__intake_semester__icontains=text)
            ).values("document_id"))
        )
    if params.get("type"):
        documents = documents.filter(doc_type__code=params["type"])
    if params.get("group"):
        documents = documents.filter(doc_type__group=params["group"])
    semester = params.get("semester")
    if semester == "none":
        documents = documents.filter(semester__isnull=True)
    elif semester:
        value, problem = _bounded_int(semester, None, 1, 10**9)
        if problem:
            errors["semester"] = [f"Semester {problem}."]
        else:
            documents = documents.filter(semester_id=value)
    if params.get("student"):
        documents = documents.filter(
            pk__in=DocumentStudent.objects.filter(student__matric_no__iexact=params["student"].strip()).values("document_id")
        )
    if params.get("programme") and not request.user.role == User.Role.STUDENT:
        programme = params["programme"].strip()
        documents = documents.filter(
            Q(pk__in=DocumentStudent.objects.filter(student__programme__trim__iexact=programme).values("document_id"))
            | Q(is_staff_file=True, staff_programmes__contains=[normalise_programme(programme) or programme])
        )
    if params.get("intake") and not request.user.role == User.Role.STUDENT:
        documents = documents.filter(
            pk__in=DocumentStudent.objects.filter(student__intake_semester__iexact=params["intake"].strip()).values("document_id")
        )
    if params.get("sender"):
        role = SENDER_ROLES.get(params["sender"])
        if role is None:
            errors["sender"] = ["Use student, lecturer, coordinator or office."]
        else:
            documents = documents.filter(uploader_role=role)
    if _flag(params.get("required")):
        documents = documents.filter(doc_type__required=True)
    uploader = params.get("uploader")
    if uploader == "me":
        documents = documents.filter(uploaded_by=request.user)
    elif uploader == "students":
        documents = documents.filter(uploader_role=User.Role.STUDENT)
    elif uploader == "staff":
        documents = documents.exclude(uploader_role=User.Role.STUDENT)
    elif uploader:
        errors["uploader"] = ["Use me, students or staff."]
    if params.get("status"):
        if params["status"] not in Document.CheckStatus.values:
            errors["status"] = ["Unknown status."]
        else:
            documents = documents.filter(check_status=params["status"])
    if params.get("kind"):
        documents = documents.filter(current_version__kind=params["kind"].upper())
    for key, lookup in (("from", "created_at__date__gte"), ("to", "created_at__date__lte")):
        if params.get(key):
            day = _date(params[key])
            if day is None:
                errors[key] = ["Use the date format YYYY-MM-DD."]
            else:
                documents = documents.filter(**{lookup: day})
    ordering = {
        "-createdAt": ("-created_at", "-pk"),
        "createdAt": ("created_at", "pk"),
        "title": ("title", "pk"),
    }.get(params.get("ordering") or "-createdAt")
    if ordering is None:
        errors["ordering"] = ["Use -createdAt, createdAt or title."]
    else:
        documents = documents.order_by(*ordering)
    return documents, errors


def _upload(request, scope):
    user = request.user
    data = request.data
    errors = {}
    doc_type = DocumentType.objects.filter(code=str(data.get("type") or ""), is_active=True).first()
    if doc_type is None:
        return Response({"type": ["Choose what this file is."]}, status=status.HTTP_400_BAD_REQUEST)

    student_upload = user.role == User.Role.STUDENT
    staff_file = False
    if student_upload:
        student = user._related_or_none("student")
        if student is None:
            return Response({"detail": "Your student record is missing. Contact the PG office.", "code": "documents_role"}, status=status.HTTP_403_FORBIDDEN)
        if student.status != Student.Status.ACTIVE:
            return Response(
                {
                    "detail": f"You can upload files while your status is Active. Your status is {student.status}; contact the PG office if you need to send a document.",
                    "code": INACTIVE_STUDENT_CODE,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if not doc_type.for_students or "STUDENT" not in (doc_type.uploaders or []):
            return Response({"type": ["Students cannot upload this type."]}, status=status.HTTP_400_BAD_REQUEST)
        students = [student]
    else:
        matrics = list(dict.fromkeys(_list(data, "students")))
        students = []
        if not matrics:
            if doc_type.for_staff:
                staff_file = True
            else:
                errors["students"] = ["Add at least one student, or upload it as a staff file."]
        elif not doc_type.for_students:
            errors["students"] = [f"{doc_type.label} is for staff files, which are not about a student."]
        elif len(matrics) > MAX_STUDENTS:
            errors["students"] = [f"A file can be about at most {MAX_STUDENTS} students."]
        else:
            found = {s.matric_no.casefold(): s for s in taggable_students(user, scope).filter(
                Q(*[Q(matric_no__iexact=m) for m in matrics], _connector=Q.OR)
            )}
            missing = [m for m in matrics if m.casefold() not in found]
            if missing:
                errors["students"] = [f"You cannot add these students: {', '.join(missing)}."]
            else:
                students = [found[m.casefold()] for m in matrics]
                if not scope.office:
                    allowed = set(doc_type.uploaders or [])
                    refused = [s.matric_no for s in students if not (scope.relationships(s) & allowed)]
                    if refused:
                        errors["students"] = [f"You cannot upload a {doc_type.label} for: {', '.join(refused)}."]
        if staff_file and not scope.office:
            allowed = set(doc_type.uploaders or [])
            if not ({"LECTURER"} if user.role == User.Role.LECTURER else {"COORDINATOR", "LECTURER"}) & allowed:
                errors["type"] = ["You cannot upload this type as a staff file."]

    audience, programmes = "", []
    if student_upload:
        share = {
            "supervisors": doc_type.share_supervisors,
            "panel": doc_type.share_panel,
            "coordinator": doc_type.share_coordinator,
        }
    elif staff_file:
        share = {"supervisors": False, "panel": False, "coordinator": False}
        audience = str(data.get("audience") or Document.Audience.ACADEMIC)
        if audience not in Document.Audience.values:
            errors["audience"] = ["Choose who can see this staff file."]
        for value in _list(data, "programmes"):
            programme = normalise_programme(value)
            if programme is None:
                errors["programmes"] = [f"Unknown programme: {value}."]
            elif programme not in programmes:
                programmes.append(programme)
    else:
        share = {
            "supervisors": _flag(data.get("shareSupervisors"), doc_type.share_supervisors),
            "panel": _flag(data.get("sharePanel"), doc_type.share_panel),
            "coordinator": _flag(data.get("shareCoordinator"), doc_type.share_coordinator),
        }

    semester = current_effective_semester()
    raw_semester = str(data.get("semester") or "").strip()
    if not student_upload and raw_semester:
        if raw_semester == "none":
            semester = None
        else:
            semester = AcademicSemester.objects.filter(pk=raw_semester if raw_semester.isdigit() else 0).first()
            if semester is None:
                errors["semester"] = ["Choose a semester from the list."]

    description = str(data.get("description") or "").strip()
    if len(description) > MAX_DESCRIPTION:
        errors["description"] = [f"Keep the note to {MAX_DESCRIPTION} characters."]

    try:
        checked = check_upload(request.FILES.get("file"), doc_type=doc_type, staff=not student_upload)
    except UploadRejected as problem:
        errors["file"] = [str(problem)]
        checked = None
    title = str(data.get("title") or "").strip() or (title_from_name(checked.original_name) if checked else "")
    if len(title) > MAX_TITLE:
        errors["title"] = [f"Keep the title to {MAX_TITLE} characters."]
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    if student_upload and doc_type.one_per_student:
        existing = Document.objects.filter(doc_type=doc_type, uploaded_by=user, archived_at__isnull=True).first()
        if existing:
            return Response(
                {
                    "detail": f"You already have a {doc_type.label}. Upload this as a new version of it instead.",
                    "code": "already_have_one",
                    "existingDocumentId": existing.pk,
                },
                status=status.HTTP_409_CONFLICT,
            )
    if not _flag(data.get("acknowledgeWarnings")):
        wanted = sorted(student.pk for student in students)
        for twin in Document.objects.filter(
            uploaded_by=user, archived_at__isnull=True, current_version__sha256=checked.sha256
        ).prefetch_related("student_links"):
            if sorted(link.student_id for link in twin.student_links.all()) == wanted:
                return Response(
                    {
                        "detail": "You already uploaded this exact file.",
                        "warnings": [f"The same file is already in {twin.reference}: {twin.title}."],
                        "requiresAcknowledgement": True,
                        "existingDocumentId": twin.pk,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

    needs_check = doc_type.needs_check and not scope.office
    document = create_document(
        actor=user,
        uploader_role=user.role,
        doc_type=doc_type,
        checked=checked,
        title=title,
        description=description,
        semester=semester,
        students=students,
        is_staff_file=staff_file,
        share=share,
        follows_type=student_upload,
        audience=audience,
        programmes=programmes,
        check_status=Document.CheckStatus.WAITING if needs_check else Document.CheckStatus.NONE,
    )
    document = with_details(Document.objects.filter(pk=document.pk)).get()
    return Response(detail_dict(document, user, scope), status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([DocumentUploadThrottle])
def documents_view(request):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    if request.method == "POST":
        return _upload(request, scope)
    documents, errors = _filtered(request, scope)
    limit, limit_problem = _bounded_int(request.query_params.get("limit"), 25, 1, 100)
    offset, offset_problem = _bounded_int(request.query_params.get("offset"), 0, 0, 1_000_000)
    if limit_problem:
        errors["limit"] = [f"Limit {limit_problem}."]
    if offset_problem:
        errors["offset"] = [f"Offset {offset_problem}."]
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    count = documents.count()
    page = with_details(documents)[offset: offset + limit]
    return Response({
        "count": count,
        "limit": limit,
        "offset": offset,
        "results": [document_dict(document, request.user, scope) for document in page],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def summary_view(request):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    visible = visible_documents(request.user, scope)
    current = visible.filter(archived_at__isnull=True)
    payload = {
        "all": current.count(),
        "staffFiles": current.filter(is_staff_file=True).count(),
        "mine": current.filter(uploaded_by=request.user).count(),
    }
    if scope.office:
        payload["toCheck"] = current.filter(check_status=Document.CheckStatus.WAITING).count()
        payload["returned"] = current.filter(check_status=Document.CheckStatus.RETURNED).count()
        payload["archived"] = visible.filter(archived_at__isnull=False).count()
    if scope.office or scope.coordinated:
        students, _ = _required_students(scope)
        behind = set()
        for doc_type in required_types():
            rows, _ = progress(doc_type, students)
            behind.update(student.pk for student, state, _ in rows if state in STILL_TO_HAND_IN)
        payload["studentsStillToHandIn"] = len(behind)
    return Response(payload)


def _visible_or_none(request, scope, pk):
    return with_details(visible_documents(request.user, scope).filter(pk=pk)).first()


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def document_view(request, pk):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    document = _visible_or_none(request, scope, pk)
    if document is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "PATCH":
        return _edit(request, scope, document)
    if request.method == "DELETE":
        if document.uploaded_by_id != request.user.pk:
            return Response(
                {"detail": "Only the person who uploaded a file can delete it.", "code": "documents_not_uploader"},
                status=status.HTTP_403_FORBIDDEN,
            )
        delete_document(document, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(detail_dict(document, request.user, scope))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_view(request, pk):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    document = _visible_or_none(request, scope, pk)
    if document is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    version = document.current_version
    number = request.query_params.get("version")
    if number:
        version = document.versions.filter(number=number if str(number).isdigit() else 0).first()
    if version is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    try:
        handle = version.file.open("rb")
    except (FileNotFoundError, OSError, ValueError):
        return Response(
            {"detail": "File not found. Please tell the PG office.", "code": "file_missing"},
            status=status.HTTP_404_NOT_FOUND,
        )
    record_event(document, DocumentEvent.Action.DOWNLOADED, request.user, version_number=version.number)
    response = FileResponse(handle, as_attachment=True, filename=version.original_name, content_type=version.content_type)
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


PREVIEW_KINDS = {"PDF", "IMAGE", "DOCX"}
MAX_ZIP_FILES = 50
MAX_ZIP_BYTES = 100 * 1024 * 1024
FILE_MISSING = {"detail": "File not found. Please tell the PG office.", "code": "file_missing"}


def _version_of(request, document):
    number = request.query_params.get("version")
    if not number:
        return document.current_version
    return document.versions.filter(number=number if str(number).isdigit() else 0).first()


def _read(version):
    try:
        with version.file.open("rb") as handle:
            return handle.read()
    except (FileNotFoundError, OSError, ValueError):
        return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def preview_view(request, pk):
    """What the preview can show: page pictures (PDF, images), text (Word) or nothing."""
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    document = _visible_or_none(request, scope, pk)
    version = _version_of(request, document) if document else None
    if version is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    payload = {
        "kind": version.kind,
        "version": version.number,
        "available": version.kind in PREVIEW_KINDS,
        "pageCount": 0,
        "text": "",
        "truncated": False,
        "reason": "",
    }
    if version.kind == "PDF":
        payload["pageCount"] = version.page_count or 0
    elif version.kind == "IMAGE":
        payload["pageCount"] = 1
    elif version.kind == "DOCX":
        content = _read(version)
        if content is None:
            return Response(FILE_MISSING, status=status.HTTP_404_NOT_FOUND)
        payload["text"], payload["truncated"] = docx_text(content)
    else:
        payload["reason"] = "Preview isn't available for this file type. Download it to open."
    record_event(document, DocumentEvent.Action.PREVIEWED, request.user, version_number=version.number)
    response = Response(payload)
    response["Cache-Control"] = "private, no-store"
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def preview_page_view(request, pk, number):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    document = _visible_or_none(request, scope, pk)
    version = _version_of(request, document) if document else None
    if version is None or version.kind not in ("PDF", "IMAGE"):
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    content = _read(version)
    if content is None:
        return Response(FILE_MISSING, status=status.HTTP_404_NOT_FOUND)
    try:
        if version.kind == "PDF":
            picture = pdf_page_png(content, number)
        elif number == 1:
            picture = image_png(content)
        else:
            raise PreviewMissing()
    except PreviewMissing:
        return Response({"detail": "That page does not exist."}, status=status.HTTP_404_NOT_FOUND)
    response = HttpResponse(picture, content_type="image/png")
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def _zip_name(document, version, used):
    first = next(iter(link.student.matric_no for link in document.student_links.all()), "STAFF")
    name = f"{first}/{document.doc_type.code}/{document.reference} {version.original_name}"
    base, counter = name, 2
    while name in used:
        stem, dot, extension = base.rpartition(".")
        name = f"{stem} ({counter}).{extension}" if dot else f"{base} ({counter})"
        counter += 1
    used.add(name)
    return name


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def download_zip_view(request):
    """Several files as one ZIP. All or nothing: a file the caller may not see
    fails the whole request without saying which."""
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    raw = request.data.get("ids") if hasattr(request.data, "get") else None
    if not isinstance(raw, list) or not raw or len(raw) > MAX_ZIP_FILES:
        return Response({"ids": [f"Choose 1 to {MAX_ZIP_FILES} files."]}, status=status.HTTP_400_BAD_REQUEST)
    try:
        ids = list(dict.fromkeys(int(value) for value in raw))
    except (TypeError, ValueError):
        return Response({"ids": ["Choose files from the list."]}, status=status.HTTP_400_BAD_REQUEST)
    documents = list(with_details(visible_documents(request.user, scope).filter(pk__in=ids)))
    if len(documents) != len(ids) or any(document.current_version is None for document in documents):
        return Response({"detail": "Some selected files are not available."}, status=status.HTTP_404_NOT_FOUND)
    if sum(document.current_version.size for document in documents) > MAX_ZIP_BYTES:
        return Response({"ids": ["These files add up to more than 100 MB. Choose fewer files."]}, status=status.HTTP_400_BAD_REQUEST)
    spool = tempfile.SpooledTemporaryFile(max_size=16 * 1024 * 1024)
    used = set()
    with zipfile.ZipFile(spool, "w", zipfile.ZIP_DEFLATED) as archive:
        for document in sorted(documents, key=lambda item: ids.index(item.pk)):
            content = _read(document.current_version)
            if content is None:
                spool.close()
                return Response(FILE_MISSING, status=status.HTTP_404_NOT_FOUND)
            archive.writestr(_zip_name(document, document.current_version, used), content)
    for document in documents:
        record_event(
            document, DocumentEvent.Action.DOWNLOADED, request.user,
            version_number=document.current_version.number, details={"bulk": True},
        )
    spool.seek(0)
    response = FileResponse(
        spool, as_attachment=True, filename=f"documents-{timezone.localtime():%Y%m%d-%H%M}.zip",
        content_type="application/zip",
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def _edit(request, scope, document):
    """Title, note and semester; staff uploaders and the office may also change
    which students the file is about. Tags are the system's, never typed."""
    user = request.user
    uploader = document.uploaded_by_id == user.pk
    if not (uploader or scope.office) or document.archived_at:
        return Response({"detail": "Only the uploader or the PG office can change this file.", "code": "documents_not_uploader"}, status=status.HTTP_403_FORBIDDEN)
    data = request.data
    errors, changes = {}, {}
    if "title" in data:
        title = str(data.get("title") or "").strip()
        if not title or len(title) > MAX_TITLE:
            errors["title"] = [f"Give the file a title of up to {MAX_TITLE} characters."]
        changes["title"] = title
    if "description" in data:
        description = str(data.get("description") or "").strip()
        if len(description) > MAX_DESCRIPTION:
            errors["description"] = [f"Keep the note to {MAX_DESCRIPTION} characters."]
        changes["description"] = description
    if "semester" in data and user.role != User.Role.STUDENT:
        raw = str(data.get("semester") or "").strip()
        semester = None if raw in ("", "none") else AcademicSemester.objects.filter(pk=raw if raw.isdigit() else 0).first()
        if raw not in ("", "none") and semester is None:
            errors["semester"] = ["Choose a semester from the list."]
        changes["semester"] = semester
    students = None
    if "students" in data and not document.is_staff_file and user.role != User.Role.STUDENT:
        matrics = list(dict.fromkeys(_list(data, "students") if not isinstance(data.get("students"), list) else data.get("students")))
        if not matrics or len(matrics) > MAX_STUDENTS:
            errors["students"] = [f"A file is about 1 to {MAX_STUDENTS} students."]
        else:
            found = {s.matric_no.casefold(): s for s in taggable_students(user, scope).filter(
                Q(*[Q(matric_no__iexact=m) for m in matrics], _connector=Q.OR)
            )}
            missing = [m for m in matrics if m.casefold() not in found]
            if missing:
                errors["students"] = [f"You cannot add these students: {', '.join(missing)}."]
            else:
                students = [found[m.casefold()] for m in matrics]
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    update_details(document, actor=user, changes=changes, students=students)
    document = _visible_or_none(request, scope, document.pk)
    if document is None:
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(detail_dict(document, user, scope))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([DocumentUploadThrottle])
def versions_view(request, pk):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    document = _visible_or_none(request, scope, pk)
    if document is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    user = request.user
    if not (document.uploaded_by_id == user.pk or scope.office) or document.archived_at:
        return Response({"detail": "Only the uploader or the PG office can add a version.", "code": "documents_not_uploader"}, status=status.HTTP_403_FORBIDDEN)
    if user.role == User.Role.STUDENT:
        student = user._related_or_none("student")
        if student is None or student.status != Student.Status.ACTIVE:
            return Response({"detail": "You can upload files while your status is Active.", "code": INACTIVE_STUDENT_CODE}, status=status.HTTP_403_FORBIDDEN)
    note = str(request.data.get("note") or "").strip()
    if len(note) > 300:
        return Response({"note": ["Keep the note to 300 characters."]}, status=status.HTTP_400_BAD_REQUEST)
    try:
        checked = check_upload(request.FILES.get("file"), doc_type=document.doc_type, staff=user.role != User.Role.STUDENT)
    except UploadRejected as problem:
        return Response({"file": [str(problem)]}, status=status.HTTP_400_BAD_REQUEST)
    if document.current_version and document.current_version.sha256 == checked.sha256:
        return Response({"file": ["This is the same file as the current version."]}, status=status.HTTP_400_BAD_REQUEST)
    add_version(document, actor=user, checked=checked, note=note, is_office=scope.office)
    document = _visible_or_none(request, scope, document.pk)
    return Response(detail_dict(document, user, scope), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_view(request, pk):
    """The office accepts a waiting file, or returns it with a reason."""
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    if not scope.office:
        return Response({"detail": "Only the PG office checks files.", "code": "documents_office_only"}, status=status.HTTP_403_FORBIDDEN)
    document = _visible_or_none(request, scope, pk)
    if document is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    decision = str(request.data.get("decision") or "").upper()
    reason = str(request.data.get("reason") or "").strip()
    if decision not in ("ACCEPT", "RETURN"):
        return Response({"decision": ["Choose Accept or Return."]}, status=status.HTTP_400_BAD_REQUEST)
    if decision == "RETURN" and not reason:
        return Response({"reason": ["Say what the student should fix."]}, status=status.HTTP_400_BAD_REQUEST)
    if len(reason) > 1000:
        return Response({"reason": ["Keep the reason to 1,000 characters."]}, status=status.HTTP_400_BAD_REQUEST)
    if document.check_status != Document.CheckStatus.WAITING:
        return Response({"detail": "This file is not waiting for a check any more.", "code": "not_waiting"}, status=status.HTTP_409_CONFLICT)
    expected = request.data.get("expectedVersion")
    current = document.current_version.number if document.current_version else None
    if expected is not None and str(expected) != str(current):
        return Response({"detail": "A newer version arrived while you were checking. Look at it first.", "code": "stale_version"}, status=status.HTTP_409_CONFLICT)
    check_document(document, actor=request.user, accept=decision == "ACCEPT", reason=reason)
    document = _visible_or_none(request, scope, document.pk)
    return Response(detail_dict(document, request.user, scope))


def _office_only(request):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return scope, refused
    if not scope.office:
        return scope, Response(
            {"detail": "Only the PG office manages File Management settings.", "code": "documents_office_only"},
            status=status.HTTP_403_FORBIDDEN,
        )
    return scope, None


TYPE_FLAGS = (
    ("share_supervisors", "shareSupervisors"),
    ("share_panel", "sharePanel"),
    ("share_coordinator", "shareCoordinator"),
    ("needs_check", "needsCheck"),
    ("one_per_student", "onePerStudent"),
    ("required", "required"),
    ("is_active", "isActive"),
)


def _type_values(data, doc_type=None):
    errors, values = {}, {}
    if doc_type is None or "label" in data:
        label = " ".join(str(data.get("label") or "").split())
        same = DocumentType.objects.filter(label__iexact=label)
        if doc_type is not None:
            same = same.exclude(pk=doc_type.pk)
        if not label or len(label) > 120:
            errors["label"] = ["Give the type a name of up to 120 characters."]
        elif same.exists():
            errors["label"] = [f"There is already a type called {label}."]
        values["label"] = label
    if "description" in data:
        description = " ".join(str(data.get("description") or "").split())
        if len(description) > 300:
            errors["description"] = ["Keep the description to 300 characters."]
        values["description"] = description
    if doc_type is None or "group" in data:
        group = str(data.get("group") or DocumentType.Group.OTHER)
        if group not in DocumentType.Group.values:
            errors["group"] = ["Choose a group from the list."]
        values["group"] = group
    kind = doc_type.kind if doc_type else DocumentType.Kind.STUDENT
    if doc_type is None or "kind" in data:
        wanted = str(data.get("kind") or kind)
        if wanted not in DocumentType.Kind.values:
            errors["kind"] = ["Choose student files or staff files."]
        elif doc_type is not None and wanted != doc_type.kind and doc_type.documents.exists():
            errors["kind"] = ["Files already use this type, so it cannot switch between student and staff files. Add a new type instead."]
        else:
            kind = wanted
            values["kind"] = kind
    allowed = KIND_UPLOADERS[kind]
    if doc_type is None or "uploaders" in data:
        raw = data.get("uploaders") or []
        if not isinstance(raw, list) or any(value not in allowed for value in raw):
            errors["uploaders"] = ["Choose who can upload from the list."]
        else:
            values["uploaders"] = [value for value in allowed if value in raw]
    elif "kind" in values:
        values["uploaders"] = [value for value in allowed if value in (doc_type.uploaders or [])]
    for field, key in TYPE_FLAGS:
        if key in data:
            values[field] = _flag(data.get(key))
        elif doc_type is None:
            values[field] = field == "is_active"
    if "requiredDueNote" in data:
        due = " ".join(str(data.get("requiredDueNote") or "").split())
        if len(due) > 120:
            errors["requiredDueNote"] = ["Keep the due note to 120 characters."]
        values["required_due_note"] = due
    elif doc_type is None:
        values["required_due_note"] = ""
    if "requiredProgrammes" in data:
        raw = data.get("requiredProgrammes")
        programmes = []
        for value in raw if isinstance(raw, list) else []:
            programme = normalise_programme(str(value))
            if programme is None:
                errors["requiredProgrammes"] = [f"Unknown programme: {value}."]
            elif programme not in programmes:
                programmes.append(programme)
        values["required_programmes"] = programmes
    elif doc_type is None:
        values["required_programmes"] = []
    if kind == DocumentType.Kind.STAFF:
        values.update(share_supervisors=False, share_panel=False, share_coordinator=False, one_per_student=False, required=False)
    uploaders = values.get("uploaders", doc_type.uploaders if doc_type else [])
    required = values.get("required", doc_type.required if doc_type else False)
    if required and "STUDENT" not in (uploaders or []) and "uploaders" not in errors:
        errors["required"] = ["Students must be able to upload a document they have to hand in."]
    return values, errors


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def types_view(request):
    """Every document type, switched off ones included, for the office."""
    _, refused = _office_only(request)
    if refused:
        return refused
    if request.method == "POST":
        values, errors = _type_values(request.data)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        doc_type = add_type(actor=request.user, values=values)
        return Response(type_settings_dict(types_with_counts().get(pk=doc_type.pk)), status=status.HTTP_201_CREATED)
    return Response({
        "types": [type_settings_dict(doc_type) for doc_type in types_with_counts()],
        "groups": [{"value": value, "label": label} for value, label in DocumentType.Group.choices],
        "kindUploaders": {kind.value: list(uploaders) for kind, uploaders in KIND_UPLOADERS.items()},
        "programmes": list(APPROVED_PROGRAMMES),
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def type_view(request, pk):
    _, refused = _office_only(request)
    if refused:
        return refused
    doc_type = DocumentType.objects.filter(pk=pk).first()
    if doc_type is None:
        return Response({"detail": "This document type does not exist."}, status=status.HTTP_404_NOT_FOUND)
    values, errors = _type_values(request.data, doc_type)
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    doc_type, updated = change_type(doc_type, actor=request.user, values=values)
    payload = type_settings_dict(types_with_counts().get(pk=doc_type.pk))
    payload["updatedFiles"] = updated
    return Response(payload)


def _reach_by_group(document, students):
    """Who each sharing tick would reach, ticked or not."""
    probe = copy.copy(document)
    probe.share_supervisors = probe.share_panel = probe.share_coordinator = True
    groups = {"supervisors": [], "panel": [], "coordinator": []}
    for user, label in people_reached(probe, students):
        key = {"panel member": "panel", "programme coordinator": "coordinator"}.get(label, "supervisors")
        groups[key].append({"name": user.full_name, "role": label})
    return groups


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def sharing_view(request, pk):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    document = _visible_or_none(request, scope, pk)
    if document is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    if not permissions(request.user, document, scope)["canChangeSharing"]:
        return Response(
            {"detail": "Only the PG office or the staff member who uploaded it can change who sees this file.", "code": "documents_not_uploader"},
            status=status.HTTP_403_FORBIDDEN,
        )
    if request.method == "GET":
        if document.is_staff_file:
            return Response({
                "isStaffFile": True,
                **sharing_of(document),
                "audiences": [{"value": value, "label": label} for value, label in Document.Audience.choices],
                "allProgrammes": list(APPROVED_PROGRAMMES),
            })
        students = [link.student for link in document.student_links.all()]
        return Response({
            "isStaffFile": False,
            "share": sharing_of(document),
            "followsType": document.follows_type,
            "people": _reach_by_group(document, students),
        })
    data = request.data
    if document.is_staff_file:
        errors, programmes = {}, []
        audience = str(data.get("audience") or "")
        if audience not in Document.Audience.values:
            errors["audience"] = ["Choose who can see this staff file."]
        raw = data.get("programmes") if isinstance(data.get("programmes"), list) else _list(data, "programmes")
        for value in raw:
            programme = normalise_programme(str(value))
            if programme is None:
                errors["programmes"] = [f"Unknown programme: {value}."]
            elif programme not in programmes:
                programmes.append(programme)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        sharing = {"audience": audience, "programmes": [] if audience == Document.Audience.OFFICE else programmes}
    else:
        sharing = {key: _flag(data.get(key)) for key in ("supervisors", "panel", "coordinator")}
    change_sharing(document, actor=request.user, sharing=sharing)
    document = _visible_or_none(request, scope, document.pk)
    return Response(detail_dict(document, request.user, scope))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def archive_view(request, pk):
    """The office archives a file instead of deleting it (UC27)."""
    scope, refused = _office_only(request)
    if refused:
        return refused
    document = _visible_or_none(request, scope, pk)
    if document is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    if document.archived_at:
        return Response({"detail": "This file is already archived.", "code": "already_archived"}, status=status.HTTP_409_CONFLICT)
    reason = " ".join(str(request.data.get("reason") or "").split())
    if not reason:
        return Response({"reason": ["Say why it is archived."]}, status=status.HTTP_400_BAD_REQUEST)
    if len(reason) > 500:
        return Response({"reason": ["Keep the reason to 500 characters."]}, status=status.HTTP_400_BAD_REQUEST)
    archive_document(document, actor=request.user, reason=reason)
    document = _visible_or_none(request, scope, document.pk)
    return Response(detail_dict(document, request.user, scope))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def restore_view(request, pk):
    scope, refused = _office_only(request)
    if refused:
        return refused
    document = _visible_or_none(request, scope, pk)
    if document is None:
        return Response({"detail": NOT_AVAILABLE}, status=status.HTTP_404_NOT_FOUND)
    if not document.archived_at:
        return Response({"detail": "This file is not archived.", "code": "not_archived"}, status=status.HTTP_409_CONFLICT)
    restore_document(document, actor=request.user)
    document = _visible_or_none(request, scope, document.pk)
    return Response(detail_dict(document, request.user, scope))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def history_view(request):
    """Everything that happened to files, deleted ones included, and to the settings."""
    _, refused = _office_only(request)
    if refused:
        return refused
    params = request.query_params
    show = params.get("show") or "all"
    if show not in SHOWS:
        return Response({"show": [f"Use one of: {', '.join(SHOWS)}."]}, status=status.HTTP_400_BAD_REQUEST)
    limit, limit_problem = _bounded_int(params.get("limit"), 30, 1, 100)
    offset, offset_problem = _bounded_int(params.get("offset"), 0, 0, 1_000_000)
    if limit_problem or offset_problem:
        return Response({"limit": ["Use a limit from 1 to 100 and an offset of 0 or more."]}, status=status.HTTP_400_BAD_REQUEST)
    rows, as_dict = history_rows(show, (params.get("q") or "").strip()[:MAX_SEARCH])
    return Response({
        "count": rows.count(),
        "limit": limit,
        "offset": offset,
        "results": [as_dict(row) for row in rows.order_by("-created_at", "-pk")[offset: offset + limit]],
    })


def _required_students(scope):
    """The students whose required documents this person may follow."""
    if scope.office:
        return Student.objects.all(), None
    if scope.coordinated:
        return Student.objects.filter(programme_filter(scope.coordinated)), None
    return None, Response(
        {"detail": "Only the PG office and programme coordinators follow required documents.", "code": "documents_required_role"},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def required_view(request):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    students, refused = _required_students(scope)
    if refused:
        return refused
    items = []
    for doc_type in required_types():
        rows, counts = progress(doc_type, students)
        last = doc_type.reminders.first()
        items.append({
            "id": doc_type.pk,
            "code": doc_type.code,
            "label": doc_type.label,
            "dueNote": doc_type.required_due_note,
            "programmes": list(doc_type.required_programmes or []),
            "students": len(rows),
            "done": counts[DONE],
            "waiting": counts[WAITING],
            "returned": counts[RETURNED],
            "missing": counts[MISSING],
            "lastReminder": {"at": last.sent_at.isoformat(), "by": last.sent_by_name, "students": last.students} if last else None,
            "remindedToday": reminded_today(doc_type) is not None,
        })
    return Response({"types": items, "canRemind": scope.office})


REQUIRED_FILTERS = {"todo": STILL_TO_HAND_IN, "waiting": (WAITING,), "done": (DONE,)}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def required_students_view(request, pk):
    scope, refused = _scope_or_refuse(request)
    if refused:
        return refused
    students, refused = _required_students(scope)
    if refused:
        return refused
    doc_type = required_types().filter(pk=pk).first()
    if doc_type is None:
        return Response({"detail": "This type is not required."}, status=status.HTTP_404_NOT_FOUND)
    show = request.query_params.get("show") or ""
    if show and show not in REQUIRED_FILTERS:
        return Response({"show": ["Use todo, waiting or done."]}, status=status.HTTP_400_BAD_REQUEST)
    rows, _ = progress(doc_type, students)
    if show:
        rows = [row for row in rows if row[1] in REQUIRED_FILTERS[show]]
    documents = [document_id for _, _, document_id in rows if document_id]
    visible = set(visible_documents(request.user, scope).filter(pk__in=documents).values_list("pk", flat=True))
    rows.sort(key=lambda row: (RANK[row[1]], row[0].user.full_name.casefold()))
    return Response([
        {
            "matric": student.matric_no,
            "name": student.user.full_name,
            "programme": student.programme,
            "state": state,
            "documentId": document_id if document_id in visible else None,
        }
        for student, state, document_id in rows
    ])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def required_remind_view(request, pk):
    _, refused = _office_only(request)
    if refused:
        return refused
    doc_type = required_types().filter(pk=pk).first()
    if doc_type is None:
        return Response({"detail": "This type is not required."}, status=status.HTTP_404_NOT_FOUND)
    try:
        sent = remind(doc_type, actor=request.user, students=Student.objects.all())
    except AlreadyReminded:
        return Response(
            {"detail": "Students were already reminded about this today. You can remind them again tomorrow.", "code": "reminded_today"},
            status=status.HTTP_409_CONFLICT,
        )
    except NobodyToRemind:
        return Response({"detail": "Every student has handed it in or is waiting for a check.", "code": "nobody_to_remind"}, status=status.HTTP_409_CONFLICT)
    return Response({"sent": sent})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def required_mine_view(request):
    """A student's own required documents, for their to-do list."""
    user = request.user
    if user.role != User.Role.STUDENT:
        return Response({"detail": "Only students have required documents.", "code": "documents_role"}, status=status.HTTP_403_FORBIDDEN)
    student = user._related_or_none("student")
    return Response([
        {
            "code": doc_type.code,
            "label": doc_type.label,
            "dueNote": doc_type.required_due_note,
            "state": state,
            "documentId": document_id,
        }
        for doc_type, state, document_id in (mine(student) if student else [])
    ])
