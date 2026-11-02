import json
import shutil
import tempfile
from django.test import override_settings
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from accounts.models import Student, StudentRegistry, User

from . import test_supervisor_workflow as workflow
from .research_intent_test_helpers import valid_research_intent_json
from .models import SupervisorApplication, SupervisorAppointment, SupervisorDocumentRequirement
from .test_supervisor_documents import valid_pdf


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SupervisorSectionATests(APITestCase):
    authenticate = workflow.SupervisorAppointmentWorkflowTests.authenticate
    accept_by_supervisor = workflow.SupervisorAppointmentWorkflowTests.accept_by_supervisor

    def setUp(self):
        workflow.SupervisorAppointmentWorkflowTests.setUp(self)
        media_root = tempfile.mkdtemp(prefix="section-a-")
        media_settings = override_settings(MEDIA_ROOT=media_root)
        media_settings.enable()
        self.addCleanup(shutil.rmtree, media_root, True)
        self.addCleanup(media_settings.disable)
        self.student = self.student_user.student
        self.student_user.phone = "0123456789"
        self.student_user.save(update_fields=["phone"])
        self.registry = StudentRegistry.objects.create(
            student=self.student, ic_number="991122334455", address="Synthetic address",
            current_semester="Registry semester must not be used",
        )

    def section(self, **overrides):
        return {
            "version": 1, "titleOrigin": "STUDENT", "noCoursesTaken": False,
            "courseResults": [{"courseName": "  Research Methods  ", "courseCode": " ABC101 ",
                               "semesterSession": " 2026/2027 I ", "grade": " A "}],
            "declarationAccepted": True, **overrides,
        }

    def submit(self, section=None, *, raw=None, files=True, **fields):
        self.authenticate(self.student_user)
        data = {
            "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
            "researchTitle": "Section A research", "researchArea": "Software Engineering",
            "researchAbstract": "Synthetic research abstract.", "projectCourseCodes": "ABC9000",
            "researchIntent": valid_research_intent_json(),
        }
        if section is not None:
            data["sectionA"] = json.dumps(section)
        if raw is not None:
            data["sectionA"] = raw
        if files:
            data.update(documents=[valid_pdf()], requirementCodes=["research-proposal"])
        data.update(fields)
        return self.client.post("/api/appointments/supervisor/applications/", data, format="multipart")

    def exact(self, pk):
        return self.client.get(f"/api/appointments/supervisor/applications/{pk}/section-a/")

    def test_contact_edits_save_own_profile_and_return_fresh_prefill(self):
        self.authenticate(self.student_user)
        response = self.client.patch("/api/appointments/supervisor/application-contact/", {
            "phone": " +60 12-345 6789 ", "address": " Updated address\nMalaysia ",
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.student_user.refresh_from_db()
        self.registry.refresh_from_db()
        self.assertEqual(self.student_user.phone, "+60 12-345 6789")
        self.assertEqual(self.registry.address, "Updated address\nMalaysia")
        self.assertEqual(response.data["studentParticulars"]["address"], self.registry.address)
        self.assertIn("no-store", response["Cache-Control"])
        submitted = self.submit(self.section())
        self.assertEqual(submitted.status_code, 201, submitted.data)
        self.assertEqual(self.exact(submitted.data["id"]).data["sectionA"]["studentParticulars"]["phone"], self.student_user.phone)

    def test_contact_edits_reject_identity_fields_and_invalid_values_atomically(self):
        self.authenticate(self.student_user)
        for payload in [
            {"phone": "0122222222", "studentId": "someone-else"},
            {"phone": "0122222222", "email": "other@example.test"},
            {"phone": "not a number", "address": "Must not save"},
            {"phone": 123, "address": "Must not save"},
            {"phone": "0122222222", "address": "x" * 2001},
            {"phone": "0122222222", "address": None},
        ]:
            response = self.client.patch("/api/appointments/supervisor/application-contact/", payload, format="json")
            self.assertEqual(response.status_code, 400, response.data)
            self.student_user.refresh_from_db()
            self.registry.refresh_from_db()
            self.assertEqual(self.student_user.phone, "0123456789")
            self.assertEqual(self.registry.address, "Synthetic address")

    def test_contact_edits_create_only_own_missing_registry_and_preserve_identity(self):
        self.registry.delete()
        self.authenticate(self.student_user)
        response = self.client.patch("/api/appointments/supervisor/application-contact/", {"address": "New address"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        registry = StudentRegistry.objects.get(student=self.student)
        self.assertEqual(registry.address, "New address")
        self.assertEqual(registry.ic_number, "")
        self.assertEqual(response.data["studentParticulars"]["phone"], "0123456789")

    def test_contact_edits_require_authenticated_eligible_student(self):
        url = "/api/appointments/supervisor/application-contact/"
        self.assertIn(self.client.patch(url, {}, format="json").status_code, [401, 403])
        for user in [self.supervisor_user, self.coordinator, self.office_admin]:
            self.authenticate(user)
            self.assertEqual(self.client.patch(url, {}, format="json").status_code, 403)
        self.student.status = Student.Status.DEFERRED
        self.student.save(update_fields=["status"])
        self.authenticate(self.student_user)
        self.assertEqual(self.client.patch(url, {}, format="json").status_code, 403)

    def test_prefill_uses_own_authoritative_particulars_and_effective_semester(self):
        self.authenticate(self.student_user)
        response = self.client.get("/api/appointments/supervisor/application-prefill/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["studentParticulars"], {
            "name": "Student Applicant", "studentId": "MEA-SUP-001",
            "programme": "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            "semester": self.academic_semester.label, "identityNumber": "991122334455",
            "identityType": "NRIC", "email": "student-supervisor@example.com",
            "phone": "0123456789", "address": "Synthetic address",
        })
        self.assertEqual(response.data["proposalRequirementCode"], "research-proposal")
        self.assertTrue(response.data["declarationText"])

    def test_prefill_missing_registry_and_passport_are_honest(self):
        self.registry.delete()
        self.authenticate(self.student_user)
        url = "/api/appointments/supervisor/application-prefill/"
        particulars = self.client.get(url).data["studentParticulars"]
        for key in ["identityNumber", "identityType", "address"]:
            self.assertEqual(particulars[key], "")
        StudentRegistry.objects.create(student=self.student, passport_number="P000123")
        particulars = self.client.get(url).data["studentParticulars"]
        self.assertEqual(particulars["identityNumber"], "P000123")
        self.assertEqual(particulars["identityType"], "PASSPORT")

    def test_prefill_requires_authenticated_eligible_student(self):
        url = "/api/appointments/supervisor/application-prefill/"
        self.assertIn(self.client.get(url).status_code, [401, 403])
        for user in [self.supervisor_user, self.coordinator, self.office_admin]:
            self.authenticate(user)
            self.assertEqual(self.client.get(url).status_code, 403)
        self.student.status = Student.Status.DEFERRED
        self.student.save(update_fields=["status"])
        self.authenticate(self.student_user)
        self.assertEqual(self.client.get(url).status_code, 403)

    def test_snapshot_captures_at_save_and_stays_stable_through_approval(self):
        self.authenticate(self.student_user)
        prefill = self.client.get("/api/appointments/supervisor/application-prefill/")
        self.assertEqual(prefill.status_code, 200)
        User.objects.filter(pk=self.student_user.pk).update(full_name="Current at submission")
        response = self.submit(self.section())
        self.assertEqual(response.status_code, 201, response.data)
        application = SupervisorApplication.objects.get(pk=response.data["id"])
        snapshot = self.exact(application.pk).data["sectionA"]
        self.assertEqual(snapshot["studentParticulars"]["name"], "Current at submission")
        self.assertEqual(snapshot["courseResults"], [{"courseName": "Research Methods", "courseCode": "ABC101",
                         "semesterSession": "2026/2027 I", "grade": "A"}])
        self.assertEqual(snapshot["declaration"]["text"], prefill.data["declarationText"])
        self.assertEqual(snapshot["declaration"]["acceptedBy"], self.student_user.pk)
        self.assertIsNotNone(parse_datetime(snapshot["declaration"]["acceptedAt"]))
        self.assertEqual(snapshot["declaration"]["acceptedAt"], snapshot["capturedAt"])
        self.assertNotIn("researchTitle", snapshot)
        User.objects.filter(pk=self.student_user.pk).update(phone="Changed later")
        self.registry.address = "Later address"
        self.registry.save()
        self.assertEqual(self.accept_by_supervisor(application.pk).status_code, 200)
        self.authenticate(self.coordinator)
        approved = self.client.post(f"/api/appointments/supervisor/applications/{application.pk}/coordinator-approve/")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertTrue(SupervisorAppointment.objects.filter(application=application, status="ACTIVE").exists())
        self.assertEqual(self.exact(application.pk).data, {"sectionA": snapshot})

    def test_legacy_omission_retains_null_record_and_no_sensitive_list_expansion(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.exact(response.data["id"]).data, {"sectionA": None})
        for payload in [response.data, self.client.get("/api/appointments/supervisor/applications/").data[0]]:
            for key in ["sectionA", "studentParticulars", "identityNumber", "address"]:
                self.assertNotIn(key, payload)

    def test_snapshot_only_existing_exact_readers_can_access(self):
        response = self.submit(self.section())
        self.assertEqual(response.status_code, 201)
        for payload in [response.data, self.client.get("/api/appointments/supervisor/applications/").data[0]]:
            self.assertNotIn("sectionA", payload)
            self.assertNotIn("identityNumber", payload)
        pk = response.data["id"]
        for user in [self.student_user, self.supervisor_user, self.coordinator, self.office_admin]:
            self.authenticate(user)
            self.assertEqual(self.exact(pk).status_code, 200)
        for user in [self.other_supervisor, User.objects.create_user(
            email="other.student@example.test", password="test", full_name="Other", role=User.Role.STUDENT,
        )]:
            self.authenticate(user)
            self.assertEqual(self.exact(pk).status_code, 403)
        self.coordinator.lecturer.coordinator.programme_managed = "Outside programme"
        self.coordinator.lecturer.coordinator.save(update_fields=["programme_managed"])
        self.authenticate(self.coordinator)
        self.assertEqual(self.exact(pk).status_code, 403)
        self.assertEqual(self.exact(999999).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertIn(self.exact(pk).status_code, [401, 403])

    def test_private_particulars_are_not_cacheable(self):
        self.authenticate(self.student_user)
        prefill = self.client.get("/api/appointments/supervisor/application-prefill/")
        self.assertIn("no-store", prefill.get("Cache-Control", ""))
        response = self.submit(self.section())
        self.assertEqual(response.status_code, 201)
        self.assertIn("no-store", self.exact(response.data["id"]).get("Cache-Control", ""))

    def test_malformed_or_partial_section_cannot_fall_back_to_legacy(self):
        malformed = ["{", "null", "[]", "true", "", "{}"]
        for raw in malformed:
            with self.subTest(raw=raw):
                response = self.submit(raw=raw)
                self.assertEqual(response.status_code, 400, response.data)
                self.assertFalse(SupervisorApplication.objects.exists())

    def test_strict_types_unknown_keys_and_declaration_are_rejected(self):
        variants = [
            {"version": 2}, {"version": True}, {"version": "1"}, {"titleOrigin": "OTHER"},
            {"noCoursesTaken": "false"}, {"declarationAccepted": False}, {"declarationAccepted": "true"},
            {"courseResults": {}}, {"studentParticulars": {"name": "Forged"}},
            {"declaration": {"acceptedBy": 999}}, {"capturedAt": "forged"},
        ]
        for fields in variants:
            with self.subTest(fields=fields):
                self.assertEqual(self.submit(self.section(**fields)).status_code, 400)
                self.assertFalse(SupervisorApplication.objects.exists())

    def test_course_rows_are_complete_bounded_and_exclusive_with_none(self):
        row = self.section()["courseResults"][0]
        invalid = [[], [None], ["row"], [row] * 51]
        for key, bound in [("courseName", 255), ("courseCode", 64), ("semesterSession", 64), ("grade", 32)]:
            for value in ["  ", None, 7, "x" * (bound + 1)]:
                invalid.append([{**row, key: value}])
            partial = row.copy()
            partial.pop(key)
            invalid.append([partial])
        invalid.append([{**row, "verified": True}])
        for rows in invalid:
            with self.subTest(rows=rows):
                self.assertEqual(self.submit(self.section(courseResults=rows)).status_code, 400)
                self.assertFalse(SupervisorApplication.objects.exists())
        self.assertEqual(self.submit(self.section(noCoursesTaken=True)).status_code, 400)
        response = self.submit(self.section(noCoursesTaken=True, courseResults=[]))
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.exact(response.data["id"]).data["sectionA"]["courseResults"], [])

    def test_course_maximum_lengths_and_fifty_rows_are_accepted(self):
        row = {"courseName": "x" * 255, "courseCode": "x" * 64,
               "semesterSession": "x" * 64, "grade": "x" * 32}
        response = self.submit(self.section(courseResults=[row] * 50))
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(self.exact(response.data["id"]).data["sectionA"]["courseResults"]), 50)

    def test_optional_proposal_is_optional_for_both_title_origins(self):
        SupervisorDocumentRequirement.objects.update(is_required=False)
        for origin in ['STUDENT', 'SUPERVISOR']:
            with self.subTest(origin=origin):
                response = self.submit(self.section(titleOrigin=origin), files=False)
                self.assertEqual(response.status_code, 201, response.data)
                SupervisorApplication.objects.all().delete()

    def test_required_proposal_remains_required_for_both_title_origins(self):
        SupervisorDocumentRequirement.objects.update(is_required=True)
        for origin in ['STUDENT', 'SUPERVISOR']:
            with self.subTest(origin=origin):
                response = self.submit(self.section(titleOrigin=origin), files=False)
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_student_title_does_not_require_a_specific_document_code(self):
        SupervisorDocumentRequirement.objects.update(is_active=False)
        SupervisorDocumentRequirement.objects.create(code="other", label="Other", is_required=False)
        self.authenticate(self.student_user)
        self.assertIsNone(self.client.get("/api/appointments/supervisor/application-prefill/").data["proposalRequirementCode"])
        response = self.submit(self.section(), files=False)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(SupervisorDocumentRequirement.objects.get(code="research-proposal").is_active)

    def test_no_active_requirements_reports_general_configuration_error(self):
        SupervisorDocumentRequirement.objects.update(is_active=False)
        response = self.submit(self.section(), files=False)
        self.assertEqual(response.status_code, 409, response.data)
        self.assertNotIn("sectionA", response.data)

    def test_partial_section_missing_any_required_field_is_rejected(self):
        for key in self.section():
            section = self.section()
            section.pop(key)
            with self.subTest(missing=key):
                response = self.submit(section)
                self.assertEqual(response.status_code, 400, response.data)
                self.assertFalse(SupervisorApplication.objects.exists())

    def test_prefill_does_not_require_registry_or_active_semester_but_needs_profile(self):
        self.academic_semester.lifecycle_status = "CLOSED"
        self.academic_semester.save(update_fields=["lifecycle_status"])
        self.authenticate(self.student_user)
        response = self.client.get("/api/appointments/supervisor/application-prefill/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["studentParticulars"]["semester"], "")
        other = User.objects.create_user(email="no-profile@example.test", full_name="No profile", role=User.Role.STUDENT)
        self.authenticate(other)
        self.assertEqual(self.client.get("/api/appointments/supervisor/application-prefill/").status_code, 403)

    def test_supervisor_title_keeps_global_required_upload_rules(self):
        response = self.submit(self.section(titleOrigin="SUPERVISOR"), files=False)
        self.assertEqual(response.status_code, 400)
        SupervisorDocumentRequirement.objects.update(is_required=False)
        response = self.submit(self.section(titleOrigin="SUPERVISOR"), files=False)
        self.assertEqual(response.status_code, 201, response.data)

    def test_snapshot_works_without_registry_and_exact_endpoint_is_read_only(self):
        self.registry.delete()
        response = self.submit(self.section())
        self.assertEqual(response.status_code, 201, response.data)
        application = SupervisorApplication.objects.get(pk=response.data["id"])
        self.assertEqual(application.section_a["studentParticulars"]["address"], "")
        response = self.client.put(
            f"/api/appointments/supervisor/applications/{application.pk}/section-a/",
            {"sectionA": {"forged": True}}, format="json",
        )
        self.assertEqual(response.status_code, 405)
        application.refresh_from_db()
        self.assertNotIn("forged", application.section_a)

    def test_office_replacement_preserves_original_particulars_without_new_declaration(self):
        original = self.submit(self.section())
        self.assertEqual(original.status_code, 201)
        self.accept_by_supervisor(original.data["id"])
        self.authenticate(self.coordinator)
        approved = self.client.post(f"/api/appointments/supervisor/applications/{original.data['id']}/coordinator-approve/")
        self.assertEqual(approved.status_code, 200, approved.data)
        appointment = SupervisorAppointment.objects.get(application_id=original.data["id"])
        User.objects.filter(pk=self.student_user.pk).update(phone="Fresh phone")
        self.authenticate(self.office_admin)
        response = self.client.post(
            f"/api/appointments/supervisor/appointments/{appointment.pk}/replacement/",
            {"proposedSupervisorId": self.other_supervisor.lecturer.staff_no,
             "reason": "Synthetic replacement"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(self.exact(response.data["id"]).data["sectionA"])
        original_application = SupervisorApplication.objects.get(pk=original.data["id"])
        self.assertEqual(original_application.section_a["studentParticulars"]["phone"], "0123456789")
        self.assertEqual(SupervisorAppointment.objects.get(pk=appointment.pk).status, "ACTIVE")
