import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from . import test_supervisor_workflow as workflow
from .research_intent_test_helpers import valid_research_intent_json
from .models import SupervisorApplication, SupervisorAppointment


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ApplicationCourseCodeTests(APITestCase):
    authenticate = workflow.SupervisorAppointmentWorkflowTests.authenticate
    accept_by_supervisor = workflow.SupervisorAppointmentWorkflowTests.accept_by_supervisor

    def setUp(self):
        workflow.SupervisorAppointmentWorkflowTests.setUp(self)
        media_root = tempfile.mkdtemp(prefix="application-course-codes-")
        self.media_settings = override_settings(MEDIA_ROOT=media_root)
        self.media_settings.enable()
        self.addCleanup(shutil.rmtree, media_root, True)
        self.addCleanup(self.media_settings.disable)

    def submit(self, **fields):
        self.authenticate(self.student_user)
        return self.client.post(
            "/api/appointments/supervisor/applications/",
            {
                "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
                "researchTitle": "Course-code evidence",
                "researchArea": "Software Engineering",
                "researchAbstract": "A synthetic application for course-code coverage.",
                "researchIntent": valid_research_intent_json(),
                "documents": [SimpleUploadedFile(
                    "proposal.pdf", b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF",
                    content_type="application/pdf",
                )],
                "requirementCodes": ["research-proposal"],
                **fields,
            },
            format="multipart",
        )

    def test_manual_codes_survive_role_views_and_existing_approval_chain(self):
        response = self.submit(projectCourseCodes="  ABC1234  ")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data.get("projectCourseCodes"), "ABC1234")
        application = SupervisorApplication.objects.get(pk=response.data["id"])
        self.assertEqual(application.project_course_codes, "ABC1234")
        detail_url = f"/api/appointments/supervisor/applications/{application.pk}/"
        for actor in (self.student_user, self.supervisor_user, self.coordinator):
            with self.subTest(role=actor.role):
                self.authenticate(actor)
                detail = self.client.get(detail_url)
                self.assertEqual(detail.status_code, 200)
                self.assertEqual(detail.data["projectCourseCodes"], "ABC1234")
        self.authenticate(self.office_admin)
        office_detail = self.client.get(
            f"/api/appointments/office-workspace/requests/primary/{application.pk}/"
        )
        self.assertEqual(office_detail.status_code, 200)
        self.assertEqual(office_detail.data["projectCourseCodes"], "ABC1234")
        office_records = self.client.get("/api/appointments/supervisor/")
        self.assertEqual(office_records.status_code, 200)
        self.assertEqual(office_records.data[0]["projectCourseCodes"], "ABC1234")
        accepted = self.accept_by_supervisor(application.pk)
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.data["status"], "PENDING_COORDINATOR")
        self.authenticate(self.coordinator)
        coordinator_detail = self.client.get(
            f"/api/appointments/coordinator-workspace/requests/primary/{application.pk}/"
        )
        self.assertEqual(coordinator_detail.status_code, 200)
        self.assertEqual(coordinator_detail.data["projectCourseCodes"], "ABC1234")
        approved = self.client.post(
            f"/api/appointments/supervisor/applications/{application.pk}/coordinator-approve/"
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.data["status"], "APPROVED")
        self.assertEqual(approved.data["projectCourseCodes"], "ABC1234")
        self.assertTrue(SupervisorAppointment.objects.filter(
            application=application, status="ACTIVE",
        ).exists())
        self.assertTrue(self.student_user.research_profile)

    def test_missing_course_code_is_rejected(self):
        response = self.submit()
        self.assertEqual(response.status_code, 400)
        self.assertIn("projectCourseCodes", response.data)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_whitespace_only_course_code_is_rejected(self):
        response = self.submit(projectCourseCodes="   ")
        self.assertEqual(response.status_code, 400)
        self.assertIn("projectCourseCodes", response.data)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_course_codes_accept_the_maximum_length(self):
        response = self.submit(projectCourseCodes="A" * 255)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data.get("projectCourseCodes"), "A" * 255)

    def test_oversized_course_codes_do_not_create_an_application(self):
        response = self.submit(projectCourseCodes="A" * 256)
        self.assertEqual(response.status_code, 400)
        self.assertIn("projectCourseCodes", response.data)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_course_codes_do_not_expand_record_permissions(self):
        response = self.submit(projectCourseCodes="ABC1234")
        self.assertEqual(response.status_code, 201)
        detail_url = f"/api/appointments/supervisor/applications/{response.data['id']}/"
        self.authenticate(self.other_supervisor)
        self.assertEqual(self.client.get(detail_url).status_code, 403)
        self.coordinator.lecturer.coordinator.programme_managed = "Outside programme"
        self.coordinator.lecturer.coordinator.save(update_fields=["programme_managed"])
        self.authenticate(self.coordinator)
        self.assertEqual(self.client.get(detail_url).status_code, 403)

    def test_multiple_course_codes_are_rejected(self):
        for value in ("ABC1234, XYZ9000", "ABC1234; XYZ9000", "ABC1234\nXYZ9000"):
            with self.subTest(value=value):
                response = self.submit(projectCourseCodes=value)
                self.assertEqual(response.status_code, 400)
                self.assertIn("projectCourseCodes", response.data)
                self.assertFalse(SupervisorApplication.objects.exists())
