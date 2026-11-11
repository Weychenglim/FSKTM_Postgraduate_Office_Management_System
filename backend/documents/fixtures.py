"""Shared test data: people with real relationships to students, and small
sample files of every kind."""
import io
import tempfile
import zipfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
import pypdfium2 as pdfium

from academics.models import AcademicSemester
from accounts.models import Coordinator, Lecturer, Student, User
from accounts.programmes import APPROVED_PROGRAMMES
from appointments.models import (
    CoSupervisorAppointment,
    CoSupervisorNomination,
    PanelAppointment,
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)

DS, CS, AI = APPROVED_PROGRAMMES
TEST_MEDIA = override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="fsktm-documents-test-"))

CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' \
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' \
    '<Default Extension="xml" ContentType="application/xml"/>' \
    '<Override PartName="/{part}" ContentType="{content_type}"/>{extra}</Types>'
ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' \
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="{part}"/>' \
    '</Relationships>'
MAIN = {
    "docx": ("word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
             '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>'),
    "xlsx": ("xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
             '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>'),
    "pptx": ("ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
             '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'),
}


def pdf_bytes(pages=1):
    pdf = pdfium.PdfDocument.new()
    for _ in range(pages):
        pdf.new_page(595, 842)
    buffer = io.BytesIO()
    pdf.save(buffer)
    pdf.close()
    return buffer.getvalue()


def image_bytes(fmt="PNG", size=(40, 30), exif=None):
    image = Image.new("RGB", size, (200, 30, 30))
    buffer = io.BytesIO()
    if exif is not None:
        image.save(buffer, format=fmt, exif=exif)
    else:
        image.save(buffer, format=fmt)
    return buffer.getvalue()


def office_bytes(ext="docx", *, extra_files=None, content_type=None, extra_types=""):
    part, main_type, body = MAIN[ext]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", CONTENT_TYPES.format(part=part, content_type=content_type or main_type, extra=extra_types))
        archive.writestr("_rels/.rels", ROOT_RELS.format(part=part))
        archive.writestr(part, body)
        for name, data in (extra_files or {}).items():
            archive.writestr(name, data)
    return buffer.getvalue()


def upload(name, content):
    return SimpleUploadedFile(name, content)


class DocumentPeople:
    """Office, coordinator of CS, a supervisor, a co-supervisor and a panel
    member of student ``ali`` (DS), plus unrelated people and students."""

    @classmethod
    def make_people(cls):
        cls.office = cls.user("doc-office@example.test", "Siti Office", User.Role.OFFICE_ADMIN)
        cls.coordinator = cls.lecturer("doc-coord@example.test", "DOC-C1", "Prof Coordinator", User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=cls.coordinator.lecturer, programme_managed=CS)
        cls.supervisor = cls.lecturer("doc-sup@example.test", "DOC-L1", "Dr Supervisor")
        cls.co_supervisor = cls.lecturer("doc-co@example.test", "DOC-L2", "Dr Co")
        cls.panel = cls.lecturer("doc-panel@example.test", "DOC-L3", "Dr Panel")
        cls.outsider = cls.lecturer("doc-out@example.test", "DOC-L4", "Dr Outsider")
        today = timezone.localdate()
        cls.semester = AcademicSemester.objects.create(
            code="DOC-SEMESTER",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SPECIAL,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=60),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=cls.office,
        )
        cls.ali = cls.student("DOC-S1", "Ali Hassan", DS)
        cls.bella = cls.student("DOC-S2", "Bella Tan", CS)
        cls.chen = cls.student("DOC-S3", "Chen Wei", DS)
        cls.deferred = cls.student("DOC-S4", "Dina Deferred", DS, Student.Status.DEFERRED)
        primary = cls.appoint(cls.ali, cls.supervisor)
        nomination = CoSupervisorNomination.objects.create(
            student=cls.ali, primary_appointment=primary, nominator=cls.supervisor,
            candidate=cls.co_supervisor, academic_semester=cls.semester, justification="Fixture",
        )
        CoSupervisorAppointment.objects.create(
            nomination=nomination, student=cls.ali, supervisor=cls.co_supervisor, approved_by=cls.coordinator,
        )
        cls.appoint(cls.bella, cls.supervisor)
        cls.give_panel(cls.ali, cls.panel)

    @classmethod
    def make_checker(cls):
        """The coordinator of Ali's programme, who archives his files."""
        cls.checker = cls.lecturer("doc-coord-ds@example.test", "DOC-C2", "Prof Checker", User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=cls.checker.lecturer, programme_managed=DS)

    @staticmethod
    def user(email, name, role):
        return User.objects.create_user(email=email, password="pw-documents-6601", full_name=name, role=role)

    @classmethod
    def lecturer(cls, email, staff_no, name, role=User.Role.LECTURER):
        user = cls.user(email, name, role)
        Lecturer.objects.create(user=user, staff_no=staff_no, department="Computer Science")
        return user

    @classmethod
    def student(cls, matric, name, programme, state=Student.Status.ACTIVE):
        user = cls.user(f"{matric.lower()}@example.test", name, User.Role.STUDENT)
        return Student.objects.create(user=user, matric_no=matric, programme=programme, status=state)

    @classmethod
    def appoint(cls, student, supervisor):
        application = SupervisorApplication.objects.create(
            student=student, academic_semester=cls.semester, proposed_supervisor=supervisor,
            research_title=f"Research for {student.matric_no}", research_area="Information Systems",
            research_abstract="Fixture.", status=SupervisorApplication.Status.APPROVED,
        )
        return SupervisorAppointment.objects.create(
            application=application, student=student, supervisor=supervisor, approved_by=cls.coordinator,
        )

    @classmethod
    def give_panel(cls, student, member, *, linked=True):
        profile = StudentResearchProfile.objects.create(
            student=student.user if linked else None,
            matric_no=student.matric_no,
            student_name=student.user.full_name,
            programme=student.programme,
            semester=cls.semester.label,
            proposed_topic=f"Topic {student.matric_no}",
            supervisor=cls.supervisor,
        )
        recommendation = PanelRecommendation.objects.create(
            profile=profile, academic_semester=cls.semester, supervisor=cls.supervisor,
            recommended_member=member, status=PanelRecommendation.Status.APPROVED, justification="Fixture",
        )
        return PanelAppointment.objects.create(
            recommendation=recommendation, profile=profile, supervisor=cls.supervisor,
            panel_member=member, approved_by=cls.coordinator,
        )
