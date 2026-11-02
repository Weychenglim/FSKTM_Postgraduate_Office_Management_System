import io
import shutil
import tempfile
import zipfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from academics.test_capacity_helpers import publish_test_capacity_plan
from accounts.models import Coordinator, Lecturer, OfficeStaff, Student, Supervisor

from .research_intent_test_helpers import valid_research_intent_json
from .models import (
    SupervisorApplication,
    SupervisorApplicationDocument,
    SupervisorDocumentRequirement,
    SupervisorDocumentRequirementAudit,
)

User = get_user_model()


def valid_pdf(name="proposal.pdf", content=b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


def docx_file(name="proposal.docx", *, extra_entries=None):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
        )
        archive.writestr("_rels/.rels", b"<Relationships/>")
        archive.writestr("word/document.xml", b"<w:document/>")
        for entry_name, content in extra_entries or []:
            archive.writestr(entry_name, content)
    return SimpleUploadedFile(
        name,
        stream.getvalue(),
        content_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
    )


class SupervisorDocumentTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp(prefix="supervisor-documents-")
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(shutil.rmtree, self.media_root, True)

        self.student_user = User.objects.create_user(
            email="document.student@example.test",
            password="password123",
            full_name="Document Student",
            role=User.Role.STUDENT,
        )
        self.student = Student.objects.create(
            user=self.student_user,
            matric_no="DEMO-DOC-001",
            programme="MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            intake_semester="Semester I 2026/2027",
        )
        self.supervisor_user = User.objects.create_user(
            email="document.supervisor@example.test",
            password="password123",
            full_name="Document Supervisor",
            role=User.Role.LECTURER,
        )
        Lecturer.objects.create(
            user=self.supervisor_user,
            staff_no="DEMO-DOC-SV",
            department="Artificial Intelligence",
        )
        Supervisor.objects.create(
            lecturer=self.supervisor_user.lecturer,
            max_supervisees=5,
        )
        self.coordinator_user = User.objects.create_user(
            email="document.coordinator@example.test",
            password="password123",
            full_name="Document Coordinator",
            role=User.Role.COORDINATOR,
        )
        Lecturer.objects.create(
            user=self.coordinator_user,
            staff_no="DEMO-DOC-COORD",
            department="Artificial Intelligence",
        )
        Coordinator.objects.create(
            lecturer=self.coordinator_user.lecturer,
            programme_managed=self.student.programme,
        )
        self.unrelated_coordinator = User.objects.create_user(
            email="document.other.coordinator@example.test",
            password="password123",
            full_name="Other Coordinator",
            role=User.Role.COORDINATOR,
        )
        Lecturer.objects.create(
            user=self.unrelated_coordinator,
            staff_no="DEMO-DOC-OTHER",
            department="Software Engineering",
        )
        Coordinator.objects.create(
            lecturer=self.unrelated_coordinator.lecturer,
            programme_managed="MASTER OF SOFTWARE ENGINEERING (COURSEWORK)",
        )
        self.office_user = User.objects.create_user(
            email="document.office@example.test",
            password="password123",
            full_name="Document Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(
            user=self.office_user,
            staff_no="DEMO-DOC-OFFICE",
            department="Postgraduate Office",
        )
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(
            code=f"{today.year}-{today.year + 1}-S1",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=120),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office_user,
            activated_at=timezone.now(),
        )
        publish_test_capacity_plan(self.semester, self.office_user)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_requirement(self, **overrides):
        values = {
            "code": "research-proposal",
            "label": "Research Proposal",
            "description": "Upload the current research proposal.",
            "is_required": True,
            "is_active": True,
            "display_order": 1,
        }
        values.update(overrides)
        return SupervisorDocumentRequirement.objects.create(**values)

    def submit_application(self, *, file=None, code="research-proposal"):
        self.authenticate(self.student_user)
        data = {
            "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
            "projectCourseCodes": "WQD7002",
            "researchTitle": "Secure postgraduate document workflows",
            "researchArea": "Secure Software Engineering",
            "researchAbstract": "A persisted and permission-checked document workflow.",
            "researchIntent": valid_research_intent_json(),
        }
        if file is not None:
            data["documents"] = [file]
            data["requirementCodes"] = [code]
        return self.client.post(
            "/api/appointments/supervisor/applications/",
            data,
            format="multipart",
        )

    def test_office_can_create_requirement_and_student_reads_active_contract(self):
        self.authenticate(self.office_user)
        created = self.client.post(
            "/api/appointments/supervisor/document-requirements/",
            {
                "label": "Research Proposal",
                "description": "Upload the current research proposal.",
                "isRequired": True,
                "isActive": True,
                "displayOrder": 1,
            },
            format="json",
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["code"], "research-proposal")
        self.assertFalse(created.data["isUsed"])

        self.authenticate(self.student_user)
        active = self.client.get(
            "/api/appointments/supervisor/document-requirements/active/"
        )
        self.assertEqual(active.status_code, status.HTTP_200_OK)
        self.assertEqual(active.data, [created.data])

    def test_non_office_cannot_manage_requirements(self):
        self.authenticate(self.student_user)
        response = self.client.post(
            "/api/appointments/supervisor/document-requirements/",
            {"label": "Proposal", "isRequired": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_submission_fails_closed_when_requirements_are_not_configured(self):
        response = self.submit_application(file=valid_pdf())

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_valid_pdf_is_persisted_with_requirement_snapshot_and_checksum(self):
        self.create_requirement()

        response = self.submit_application(file=valid_pdf())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["documents"][0]["availability"], "AVAILABLE")
        self.assertEqual(
            response.data["documents"][0]["requirementCode"],
            "research-proposal",
        )
        self.assertEqual(
            response.data["documents"][0]["requirementLabel"],
            "Research Proposal",
        )
        self.assertEqual(len(response.data["documents"][0]["checksum"]), 64)

    def test_required_document_is_enforced(self):
        self.create_requirement()

        response = self.submit_application()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Research Proposal", str(response.data))
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_authorized_roles_download_private_file_and_unrelated_role_gets_404(self):
        self.create_requirement()
        submitted = self.submit_application(file=valid_pdf())
        application_id = submitted.data["id"]
        document_id = submitted.data["documents"][0]["id"]
        url = (
            f"/api/appointments/supervisor/applications/{application_id}/"
            f"documents/{document_id}/download/"
        )

        for user in (
            self.student_user,
            self.supervisor_user,
            self.coordinator_user,
            self.office_user,
        ):
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response["X-Content-Type-Options"], "nosniff")
                self.assertIn("attachment", response["Content-Disposition"])

        self.authenticate(self.unrelated_coordinator)
        denied = self.client.get(url)
        unknown = self.client.get(
            f"/api/appointments/supervisor/applications/{application_id}/"
            "documents/999999/download/"
        )
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(unknown.status_code, status.HTTP_404_NOT_FOUND)

    def test_requirement_updates_require_reason_keep_code_and_write_immutable_audit(
        self,
    ):
        self.authenticate(self.office_user)
        created = self.client.post(
            "/api/appointments/supervisor/document-requirements/",
            {"label": "Research Proposal", "isRequired": True},
            format="json",
        )
        requirement_id = created.data["id"]

        missing_reason = self.client.patch(
            f"/api/appointments/supervisor/document-requirements/{requirement_id}/",
            {"label": "Updated Proposal"},
            format="json",
        )
        updated = self.client.patch(
            f"/api/appointments/supervisor/document-requirements/{requirement_id}/",
            {
                "code": "attempted-code-change",
                "label": "Updated Proposal",
                "isActive": False,
                "reason": "Faculty intake checklist was revised.",
            },
            format="json",
        )
        audits = self.client.get(
            "/api/appointments/supervisor/document-requirements/audits/"
        )

        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["code"], "research-proposal")
        self.assertFalse(updated.data["isActive"])
        self.assertEqual(audits.status_code, status.HTTP_200_OK)
        self.assertEqual([row["action"] for row in audits.data], ["UPDATE", "CREATE"])
        audit = SupervisorDocumentRequirementAudit.objects.first()
        audit.reason = "Attempted mutation"
        with self.assertRaisesMessage(Exception, "immutable"):
            audit.save()

    def test_valid_docx_is_accepted(self):
        self.create_requirement()

        response = self.submit_application(file=docx_file())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["documents"][0]["contentType"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    def test_renamed_malformed_macro_traversal_and_unsafe_pdf_files_are_rejected(self):
        unsafe_files = (
            valid_pdf(name="renamed.docx"),
            SimpleUploadedFile(
                "malformed.pdf", b"not-a-pdf", content_type="application/pdf"
            ),
            docx_file(extra_entries=[("word/vbaProject.bin", b"macro")]),
            docx_file(extra_entries=[("../outside.xml", b"unsafe")]),
            valid_pdf(
                name="active.pdf",
                content=b"%PDF-1.7\n/JavaScript /Launch\n%%EOF",
            ),
        )

        for unsafe_file in unsafe_files:
            with self.subTest(filename=unsafe_file.name):
                self.create_requirement()
                response = self.submit_application(file=unsafe_file)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertFalse(SupervisorApplication.objects.exists())
                SupervisorDocumentRequirement.objects.all().delete()

    def test_duplicate_content_and_total_size_limit_are_rejected(self):
        self.create_requirement()
        self.create_requirement(
            code="supporting-evidence",
            label="Supporting Evidence",
            is_required=False,
            display_order=2,
        )
        duplicate_one = valid_pdf("proposal.pdf")
        duplicate_two = valid_pdf("evidence.pdf")
        self.authenticate(self.student_user)
        duplicate = self.client.post(
            "/api/appointments/supervisor/applications/",
            {
                "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
                "projectCourseCodes": "WQD7002",
                "researchTitle": "Duplicate content",
                "researchArea": "Secure Software Engineering",
                "researchAbstract": "Duplicate content must be rejected.",
                "researchIntent": valid_research_intent_json(),
                "documents": [duplicate_one, duplicate_two],
                "requirementCodes": ["research-proposal", "supporting-evidence"],
            },
            format="multipart",
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

        oversized_content = b"%PDF-1.7\n" + (b"0" * (10 * 1024 * 1024)) + b"\n%%EOF"
        oversized = self.submit_application(
            file=valid_pdf("oversized.pdf", oversized_content)
        )
        self.assertEqual(oversized.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_failed_transaction_removes_private_file(self):
        self.create_requirement()

        with patch(
            "appointments.views.record_workflow_event",
            side_effect=RuntimeError("forced workflow failure"),
        ), self.assertRaisesRegex(RuntimeError, "forced workflow failure"):
            self.submit_application(file=valid_pdf())

        self.assertFalse(SupervisorApplication.objects.exists())
        self.assertEqual(
            [path for path in Path(self.media_root).rglob("*") if path.is_file()],
            [],
        )

    def test_legacy_metadata_is_visible_without_download(self):
        application = SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=self.supervisor_user,
            research_title="Historical application",
            research_abstract="Created before private document persistence.",
        )
        document = SupervisorApplicationDocument.objects.create(
            application=application,
            name="legacy-proposal.pdf",
            category="RESEARCH_PROPOSAL",
            content_type="application/pdf",
            size=512,
        )
        self.authenticate(self.student_user)

        detail = self.client.get(
            f"/api/appointments/supervisor/applications/{application.pk}/"
        )
        download = self.client.get(
            f"/api/appointments/supervisor/applications/{application.pk}/"
            f"documents/{document.pk}/download/"
        )

        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["documents"][0]["availability"], "LEGACY_METADATA")
        self.assertIsNone(detail.data["documents"][0]["contentType"])
        self.assertEqual(download.status_code, status.HTTP_404_NOT_FOUND)

    def test_requirements_and_submitted_documents_are_immutable(self):
        requirement = self.create_requirement()
        submitted = self.submit_application(file=valid_pdf())
        self.assertEqual(submitted.status_code, status.HTTP_201_CREATED)
        document = SupervisorApplicationDocument.objects.get()

        requirement.code = "changed-code"
        with self.assertRaisesMessage(ValidationError, "codes are immutable"):
            requirement.save()
        with self.assertRaisesMessage(ValidationError, "cannot be deleted"):
            requirement.delete()

        document.name = "changed.pdf"
        with self.assertRaisesMessage(ValidationError, "documents are immutable"):
            document.save()
        with self.assertRaisesMessage(ValidationError, "documents are immutable"):
            document.delete()

    def test_cancelled_application_retains_private_document(self):
        self.create_requirement()
        submitted = self.submit_application(file=valid_pdf())
        document = SupervisorApplicationDocument.objects.get()
        stored_name = document.file.name
        self.authenticate(self.student_user)

        cancelled = self.client.post(
            f"/api/appointments/supervisor/applications/{submitted.data['id']}/cancel/",
            {"reason": "The wrong supervisor was selected."},
            format="json",
        )

        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertTrue(default_storage.exists(stored_name))


class DocumentSetupTests(APITestCase):
    setUp = SupervisorDocumentTests.setUp
    authenticate = SupervisorDocumentTests.authenticate
    create_requirement = SupervisorDocumentTests.create_requirement
    submit_application = SupervisorDocumentTests.submit_application
    setup_url = "/api/appointments/supervisor/document-requirements/setup/"

    def set_mode(self, enabled, reason="Office reviewed upload policy"):
        self.authenticate(self.office_user)
        return self.client.patch(self.setup_url, {"noDocumentsRequired": enabled, "reason": reason}, format="json")

    def test_explicit_no_documents_allows_submission_and_is_audited(self):
        response = self.set_mode(True)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["noDocumentsRequired"])
        self.assertTrue(response.data["configured"])
        audit = SupervisorDocumentRequirementAudit.objects.get(action="SETUP")
        self.assertIsNone(audit.requirement_id)
        history = self.client.get("/api/appointments/supervisor/document-requirements/audits/")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data[0]["requirementLabel"], "Document setup")
        self.assertEqual(audit.after_values, {"noDocumentsRequired": True})
        submitted = self.submit_application()
        self.assertEqual(submitted.status_code, 201, submitted.data)

    def test_unconfigured_still_blocks_and_disabling_restores_block(self):
        self.assertEqual(self.submit_application().status_code, 409)
        self.assertEqual(self.set_mode(True).status_code, 200)
        self.assertEqual(self.set_mode(False).status_code, 200)
        self.assertEqual(self.submit_application().status_code, 409)

    def test_active_requirement_and_no_documents_are_mutually_exclusive(self):
        requirement = self.create_requirement()
        self.assertEqual(self.set_mode(True).status_code, 400)
        requirement.is_active = False
        requirement.save()
        self.assertEqual(self.set_mode(True).status_code, 200)
        response = self.client.patch(f"/api/appointments/supervisor/document-requirements/{requirement.pk}/", {"isActive": True, "reason": "Reactivate"}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post("/api/appointments/supervisor/document-requirements/", {"label": "Transcript", "isActive": True}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_only_office_can_change_setup_and_reason_required(self):
        for user in [self.student_user, self.supervisor_user, self.coordinator_user]:
            self.authenticate(user)
            self.assertEqual(self.client.patch(self.setup_url, {"noDocumentsRequired": True, "reason": "Change"}, format="json").status_code, 403)
            read = self.client.get(self.setup_url)
            self.assertEqual(read.status_code, 200)
            self.assertFalse(read.data["configured"])
        self.assertEqual(self.set_mode(True, "").status_code, 400)

    def test_no_documents_rejects_unexpected_uploads(self):
        self.set_mode(True)
        response = self.submit_application(file=valid_pdf())
        self.assertEqual(response.status_code, 400)
