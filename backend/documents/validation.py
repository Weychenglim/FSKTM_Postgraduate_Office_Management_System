"""Upload checks: name, size, kind, then a content check for each kind.

Follows the OWASP file upload guidance: an allow-list of kinds, real
signatures, server-chosen storage names, size and expansion caps, re-encoded
images, and no scripts or macros inside documents.
"""
import hashlib
import io
import re
import unicodedata
from dataclasses import dataclass
from pathlib import PurePosixPath

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError

from announcements.upload_security import DANGEROUS_EXTENSIONS

from .office_files import OfficeFileProblem, check_office_file
from .pdfium import PdfProblem, inspect_pdf

KIND_BY_EXTENSION = {
    ".pdf": "PDF",
    ".docx": "DOCX",
    ".jpg": "IMAGE",
    ".jpeg": "IMAGE",
    ".png": "IMAGE",
    ".xlsx": "XLSX",
    ".pptx": "PPTX",
}
CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
KIND_NAMES = {
    "PDF": "PDF",
    "DOCX": "Word (.docx)",
    "IMAGE": "JPG or PNG",
    "XLSX": "Excel (.xlsx)",
    "PPTX": "PowerPoint (.pptx)",
}
STAFF_ONLY_KINDS = {"XLSX", "PPTX"}
MAX_NAME_LENGTH = 150
MAX_IMAGE_PIXELS = 40_000_000
UNSAFE_PDF_NAMES = re.compile(rb"/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA)(?![A-Za-z0-9])")
# Compressed stream bodies are binary and would match by chance; only the
# object structure around them is scanned.
STREAM_BODIES = re.compile(rb"stream\r?\n.*?endstream", re.S)
NAME_REPLACEMENTS = re.compile(r'[<>:"/\\|?*]')


class UploadRejected(Exception):
    pass


@dataclass(frozen=True)
class CheckedFile:
    original_name: str
    extension: str
    kind: str
    content_type: str
    content: bytes
    sha256: str
    page_count: int | None

    @property
    def size(self):
        return len(self.content)


def max_upload_bytes():
    return settings.DOCUMENT_MAX_UPLOAD_BYTES


def megabytes(size):
    value = size / (1024 * 1024)
    return f"{value:.1f}".rstrip("0").rstrip(".") + " MB"


def clean_name(raw):
    name = PurePosixPath(str(raw or "").replace("\\", "/")).name
    name = "".join(ch for ch in name if unicodedata.category(ch)[0] != "C")
    name = re.sub(r"\s+", " ", NAME_REPLACEMENTS.sub("_", name)).strip()
    if len(name) > MAX_NAME_LENGTH:
        suffix = PurePosixPath(name).suffix[:10]
        name = name[: MAX_NAME_LENGTH - len(suffix)].rstrip() + suffix
    return name


def kinds_sentence(kinds):
    names = [KIND_NAMES[kind] for kind in kinds if kind in KIND_NAMES]
    if not names:
        return "no files"
    if len(names) == 1:
        return names[0]
    return ", ".join(names[:-1]) + " or " + names[-1]


def accepted_kinds(doc_type, *, staff):
    kinds = [kind for kind in (doc_type.allowed_kinds or []) if kind in KIND_NAMES]
    return kinds if staff else [kind for kind in kinds if kind not in STAFF_ONLY_KINDS]


def _check_pdf(content):
    if not content.startswith(b"%PDF-") or b"%%EOF" not in content[-2048:]:
        raise UploadRejected("This file is not a valid PDF. Save it again as a PDF and upload that copy.")
    if UNSAFE_PDF_NAMES.search(STREAM_BODIES.sub(b"stream endstream", content)):
        raise UploadRejected(
            "This PDF contains scripts or attachments. Use Print, then Save as PDF, and upload that copy."
        )
    try:
        return inspect_pdf(content)
    except PdfProblem as problem:
        raise UploadRejected(str(problem))


def _reencode_image(content, extension):
    expected = "PNG" if extension == ".png" else "JPEG"
    try:
        with Image.open(io.BytesIO(content)) as probe:
            if probe.format != expected:
                raise UploadRejected(
                    f"This image is not really a {extension.lstrip('.').upper()} file. Save it as {expected} and upload it again."
                )
            width, height = probe.size
            if width * height > MAX_IMAGE_PIXELS:
                raise UploadRejected("This image is too large. Make it smaller and upload it again.")
            probe.verify()
        with Image.open(io.BytesIO(content)) as image:
            image = ImageOps.exif_transpose(image)
            output = io.BytesIO()
            if expected == "JPEG":
                image.convert("RGB").save(output, format="JPEG", quality=90)
            else:
                if image.mode not in ("RGB", "RGBA", "L", "LA", "P"):
                    image = image.convert("RGBA")
                image.save(output, format="PNG")
            return output.getvalue()
    except UploadRejected:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise UploadRejected("This image could not be opened. Save it again and upload that copy.")


def check_upload(upload, *, doc_type, staff):
    """Return a CheckedFile for ``upload`` or raise UploadRejected with a
    message that says how to fix the file."""
    if upload is None:
        raise UploadRejected("Choose a file to upload.")
    name = clean_name(getattr(upload, "name", ""))
    suffixes = [suffix.lower() for suffix in PurePosixPath(name).suffixes]
    if not name or not suffixes or name.startswith("."):
        raise UploadRejected("The file needs a name ending in its type, such as report.pdf.")
    if any(suffix in DANGEROUS_EXTENSIONS for suffix in suffixes[:-1]):
        raise UploadRejected("The file name hides another file type. Rename it and upload it again.")

    size = getattr(upload, "size", 0) or 0
    limit = max_upload_bytes()
    if size <= 0:
        raise UploadRejected("This file is empty.")
    if size > limit:
        raise UploadRejected(f"File is {megabytes(size)}. The maximum is {megabytes(limit)}.")

    extension = suffixes[-1]
    kind = KIND_BY_EXTENSION.get(extension)
    allowed = accepted_kinds(doc_type, staff=staff)
    if kind is None or kind not in allowed:
        raise UploadRejected(f"Unsupported file type. {doc_type.label} accepts {kinds_sentence(allowed)}.")

    upload.seek(0)
    content = upload.read(limit + 1)
    if len(content) > limit:
        raise UploadRejected(f"File is over {megabytes(limit)}. The maximum is {megabytes(limit)}.")
    if not content:
        raise UploadRejected("This file is empty.")

    page_count = None
    if kind == "PDF":
        page_count = _check_pdf(content)
    elif kind == "IMAGE":
        content = _reencode_image(content, extension)
    else:
        try:
            check_office_file(content, kind)
        except OfficeFileProblem as problem:
            raise UploadRejected(str(problem))

    return CheckedFile(
        original_name=name,
        extension=".jpg" if extension == ".jpeg" else extension,
        kind=kind,
        content_type=CONTENT_TYPES[extension],
        content=content,
        sha256=hashlib.sha256(content).hexdigest(),
        page_count=page_count,
    )


def title_from_name(name):
    stem = PurePosixPath(name).stem
    title = re.sub(r"[_\s]+", " ", re.sub(r"(?<!\d)-|-(?!\d)", " ", stem)).strip()[:200]
    return title[:1].upper() + title[1:] if title else "Untitled"
