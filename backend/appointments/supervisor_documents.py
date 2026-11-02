import hashlib
import io
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.text import get_valid_filename, slugify

from .models import (
    SupervisorDocumentRequirement,
    SupervisorDocumentSetup,
    SupervisorDocumentRequirementAudit,
)


MAX_DOCUMENTS = 5
MAX_TOTAL_BYTES = 10 * 1024 * 1024
MAX_DOCX_ENTRIES = 1000
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
PDF_CONTENT_TYPE = "application/pdf"
DOCX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


class DocumentRequirementsNotConfigured(Exception):
    pass


@dataclass(frozen=True)
class ValidatedSupervisorDocument:
    requirement: SupervisorDocumentRequirement
    original_name: str
    content_type: str
    content: bytes
    checksum: str

    @property
    def size(self):
        return len(self.content)


def requirement_snapshot(requirement):
    return {
        "code": requirement.code,
        "label": requirement.label,
        "description": requirement.description,
        "isRequired": requirement.is_required,
        "isActive": requirement.is_active,
        "displayOrder": requirement.display_order,
    }


def _audit_requirement(requirement, *, actor, action, reason="", before=None):
    SupervisorDocumentRequirementAudit.objects.create(
        requirement=requirement,
        actor=actor,
        action=action,
        reason=str(reason or "").strip(),
        before_values=before or {},
        after_values=requirement_snapshot(requirement),
    )


def document_setup_status():
    no_documents = SupervisorDocumentSetup.objects.filter(pk=1, no_documents_required=True).exists()
    return {"noDocumentsRequired": no_documents,
            "configured": no_documents or SupervisorDocumentRequirement.objects.filter(is_active=True).exists()}


def _lock_document_setup():
    SupervisorDocumentSetup.objects.get_or_create(pk=1)
    return SupervisorDocumentSetup.objects.select_for_update().get(pk=1)


@transaction.atomic
def set_document_setup(*, actor, no_documents_required, reason):
    if not str(reason or "").strip():
        raise ValidationError("A reason is required to change document setup.")
    setup = _lock_document_setup()
    if no_documents_required and SupervisorDocumentRequirement.objects.filter(is_active=True).exists():
        raise ValidationError("Deactivate active checklist items before choosing no documents required.")
    if setup.no_documents_required != no_documents_required:
        before = {"noDocumentsRequired": setup.no_documents_required}
        setup.no_documents_required = no_documents_required
        setup.save(update_fields=["no_documents_required"])
        SupervisorDocumentRequirementAudit.objects.create(
            actor=actor, action=SupervisorDocumentRequirementAudit.Action.SETUP,
            reason=reason.strip(), before_values=before,
            after_values={"noDocumentsRequired": no_documents_required},
        )
    return document_setup_status()


def _validate_document_mode(activating):
    setup = _lock_document_setup()
    if activating and setup.no_documents_required:
        raise ValidationError("Turn off no documents required before activating a checklist item.")


def _next_requirement_code(label):
    base = slugify(label)[:54] or "document-requirement"
    candidate = base
    suffix = 2
    while SupervisorDocumentRequirement.objects.filter(code=candidate).exists():
        candidate = f"{base[: 63 - len(str(suffix))]}-{suffix}"
        suffix += 1
    return candidate


def _validate_active_limit(*, activating=False, excluding=None):
    if not activating:
        return
    active = SupervisorDocumentRequirement.objects.filter(is_active=True)
    if excluding is not None:
        active = active.exclude(pk=excluding.pk)
    if active.count() >= MAX_DOCUMENTS:
        raise ValidationError(
            f"At most {MAX_DOCUMENTS} document requirements may be active."
        )


@transaction.atomic
def create_requirement(*, actor, values):
    _validate_document_mode(values.get("is_active", True))
    _validate_active_limit(activating=values.get("is_active", True))
    requirement = SupervisorDocumentRequirement(
        code=_next_requirement_code(values["label"]),
        label=values["label"],
        description=values.get("description", ""),
        is_required=values.get("is_required", True),
        is_active=values.get("is_active", True),
        display_order=values.get("display_order", 0),
    )
    requirement.full_clean()
    requirement.save()
    _audit_requirement(
        requirement,
        actor=actor,
        action=SupervisorDocumentRequirementAudit.Action.CREATE,
    )
    return requirement


@transaction.atomic
def update_requirement(requirement, *, actor, values, reason):
    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError("A reason is required to change a document requirement.")
    _validate_document_mode(values.get("is_active", requirement.is_active))
    requirement = SupervisorDocumentRequirement.objects.select_for_update().get(
        pk=requirement.pk
    )
    if values.get("is_active") and not requirement.is_active:
        _validate_active_limit(activating=True, excluding=requirement)
    before = requirement_snapshot(requirement)
    for field, value in values.items():
        setattr(requirement, field, value)
    requirement.full_clean()
    requirement.save()
    _audit_requirement(
        requirement,
        actor=actor,
        action=SupervisorDocumentRequirementAudit.Action.UPDATE,
        reason=reason,
        before=before,
    )
    return requirement


def _safe_original_name(upload):
    name = str(upload.name or "").strip()
    if not name or "/" in name or "\\" in name or name in {".", ".."}:
        raise ValidationError("Document filename is invalid.")
    if len(name) > 255:
        raise ValidationError("Document filename must not exceed 255 characters.")
    sanitized = get_valid_filename(name)
    if not sanitized or len(sanitized) > 255:
        raise ValidationError("Document filename is invalid.")
    return sanitized


def _validate_pdf(content):
    if not content.startswith(b"%PDF-") or not content.rstrip().endswith(b"%%EOF"):
        raise ValidationError("PDF file structure is invalid.")
    lowered = content.lower()
    unsafe_markers = (b"/javascript", b"/js", b"/launch", b"/embeddedfile")
    if any(marker in lowered for marker in unsafe_markers):
        raise ValidationError("PDF contains an unsafe active or embedded action.")


def _validate_docx(content):
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_DOCX_ENTRIES:
                raise ValidationError("DOCX archive contains too many entries.")
            total_size = 0
            names = set()
            for entry in entries:
                if entry.flag_bits & 0x1:
                    raise ValidationError("Encrypted DOCX entries are not accepted.")
                normalized = entry.filename.replace("\\", "/")
                path = PurePosixPath(normalized)
                unix_mode = entry.external_attr >> 16
                if (
                    path.is_absolute()
                    or ".." in path.parts
                    or entry.filename != normalized
                    or (path.parts and ":" in path.parts[0])
                    or (unix_mode & 0o170000) == 0o120000
                ):
                    raise ValidationError("DOCX archive contains an unsafe path.")
                total_size += entry.file_size
                if total_size > MAX_DOCX_UNCOMPRESSED_BYTES:
                    raise ValidationError("DOCX uncompressed content is too large.")
                names.add(normalized.lower())
            required = {
                "[content_types].xml",
                "_rels/.rels",
                "word/document.xml",
            }
            if not required.issubset(names):
                raise ValidationError("DOCX package structure is incomplete.")
            if any(name.endswith("vbaproject.bin") for name in names):
                raise ValidationError("Macro-enabled DOCX files are not accepted.")
            content_types = archive.read("[Content_Types].xml").lower()
            if b"macroenabled" in content_types or b"vbaproject" in content_types:
                raise ValidationError("Macro-enabled DOCX files are not accepted.")
            if archive.testzip() is not None:
                raise ValidationError("DOCX archive integrity check failed.")
    except zipfile.BadZipFile as exc:
        raise ValidationError("DOCX archive is malformed.") from exc


def validate_application_documents(files, requirement_codes):
    active_requirements = list(
        SupervisorDocumentRequirement.objects.filter(is_active=True)
    )
    if not active_requirements and not document_setup_status()["noDocumentsRequired"]:
        raise DocumentRequirementsNotConfigured(
            "Supervisor document requirements have not been configured."
        )
    if len(files) != len(requirement_codes):
        raise ValidationError("Each uploaded document must identify one requirement.")
    if len(files) > MAX_DOCUMENTS:
        raise ValidationError(f"At most {MAX_DOCUMENTS} documents may be uploaded.")
    if sum(upload.size for upload in files) > MAX_TOTAL_BYTES:
        raise ValidationError("Supervisor application documents exceed 10 MB combined.")

    requirements_by_code = {item.code: item for item in active_requirements}
    supplied_codes = [str(code).strip() for code in requirement_codes]
    if len(set(supplied_codes)) != len(supplied_codes):
        raise ValidationError("Only one document may be uploaded per requirement.")
    unknown = [code for code in supplied_codes if code not in requirements_by_code]
    if unknown:
        raise ValidationError("An uploaded document uses an inactive or unknown requirement.")
    missing_labels = [
        requirement.label
        for requirement in active_requirements
        if requirement.is_required and requirement.code not in supplied_codes
    ]
    if missing_labels:
        raise ValidationError(
            f"Required document is missing: {', '.join(missing_labels)}."
        )

    validated = []
    checksums = set()
    for upload, code in zip(files, supplied_codes):
        name = _safe_original_name(upload)
        extension = PurePosixPath(name).suffix.lower()
        content = upload.read()
        upload.seek(0)
        if len(content) != upload.size:
            raise ValidationError(f"Could not read the complete document: {name}.")
        if extension == ".pdf":
            _validate_pdf(content)
            content_type = PDF_CONTENT_TYPE
        elif extension == ".docx":
            _validate_docx(content)
            content_type = DOCX_CONTENT_TYPE
        else:
            raise ValidationError("Only PDF and DOCX documents are accepted.")
        checksum = hashlib.sha256(content).hexdigest()
        if checksum in checksums:
            raise ValidationError("Duplicate document content is not accepted.")
        checksums.add(checksum)
        validated.append(
            ValidatedSupervisorDocument(
                requirement=requirements_by_code[code],
                original_name=name,
                content_type=content_type,
                content=content,
                checksum=checksum,
            )
        )
    return validated
