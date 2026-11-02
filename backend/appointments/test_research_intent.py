import json
import shutil
import tempfile
from unittest.mock import patch

from django.test import override_settings
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from accounts.models import Student, User
from . import test_supervisor_workflow as workflow
from .models import AppointmentWorkflowEvent, SupervisorApplication, SupervisorAppointment, SupervisorDocumentRequirement
from .research_intent_test_helpers import valid_research_intent
from .test_supervisor_documents import valid_pdf


DRAFT_URL = "/api/appointments/supervisor/application-draft/"
APPLICATION_URL = "/api/appointments/supervisor/applications/"


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SupervisorResearchIntentTests(APITestCase):
    authenticate = workflow.SupervisorAppointmentWorkflowTests.authenticate
    accept_by_supervisor = workflow.SupervisorAppointmentWorkflowTests.accept_by_supervisor

    def setUp(self):
        workflow.SupervisorAppointmentWorkflowTests.setUp(self)
        self.student = self.student_user.student
        media = tempfile.mkdtemp(prefix="research-intent-tests-")
        settings = override_settings(MEDIA_ROOT=media)
        settings.enable()
        self.addCleanup(shutil.rmtree, media, True)
        self.addCleanup(settings.disable)
        self.authenticate(self.student_user)

    def payload(self, **overrides):
        return {
            "proposedSupervisorId": self.supervisor_user.lecturer.staff_no,
            "projectCourseCodes": "WQD7002",
            "researchTitle": "Synthetic intent research", "researchArea": "Software Engineering",
            "researchAbstract": "Synthetic short abstract.", "researchIntent": valid_research_intent(),
            **overrides,
        }

    def submit(self, *, multipart=False, **overrides):
        data = self.payload(**overrides)
        if multipart:
            if isinstance(data.get("researchIntent"), dict):
                data["researchIntent"] = json.dumps(data["researchIntent"])
            data.update(documents=[valid_pdf()], requirementCodes=["research-proposal"])
        else:
            SupervisorDocumentRequirement.objects.update(is_required=False)
        return self.client.post(APPLICATION_URL, data, format="multipart" if multipart else "json")

    def exact(self, pk):
        return self.client.get(f"{APPLICATION_URL}{pk}/research-intent/")

    def draft(self, **overrides):
        return {
            "version": 1, "step": 2, "researchTitle": "", "projectCodeEntries": [""],
            "researchArea": "", "researchAbstract": "", "titleOrigin": "",
            "courseResults": [{"courseName": "", "courseCode": "", "semesterSession": "", "grade": ""}],
            "noCoursesTaken": False, "proposedSupervisorId": None,
            "researchIntent": valid_research_intent(**{key: "" for key in valid_research_intent() if key != "version"}),
            **overrides,
        }

    def test_every_new_student_application_requires_research_intent(self):
        SupervisorDocumentRequirement.objects.update(is_required=False)
        payload = self.payload()
        payload.pop("researchIntent")
        response = self.client.post(APPLICATION_URL, payload, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("researchIntent", response.data)
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_incomplete_draft_roundtrip_is_private_and_has_no_workflow_side_effects(self):
        response = self.client.get(DRAFT_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"draft": None, "updatedAt": None})
        draft = self.draft()
        response = self.client.put(DRAFT_URL, draft, format="json")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.assertEqual(response.data["draft"], draft)
        self.assertIsNotNone(parse_datetime(response.data["updatedAt"]))
        loaded = self.client.get(DRAFT_URL)
        self.assertEqual(loaded.data, response.data)
        for result in [response, loaded]:
            self.assertIn("no-store", result["Cache-Control"])
            self.assertIn("private", result["Cache-Control"])
        self.assertFalse(SupervisorApplication.objects.exists())
        self.assertFalse(SupervisorAppointment.objects.exists())
        self.assertFalse(AppointmentWorkflowEvent.objects.exists())

    def test_strict_intent_json_multipart_types_and_unknown_fields(self):
        invalid = [None, {}, [], True, 7, "", "{", "null", "[]", "true"]
        for field in valid_research_intent():
            partial = valid_research_intent()
            partial.pop(field)
            invalid.append(partial)
        invalid.extend([valid_research_intent(version=value) for value in [True, "1", 2]])
        invalid.append(valid_research_intent(forged="unknown"))
        for field in valid_research_intent():
            if field != "version":
                invalid.extend(valid_research_intent(**{field: value}) for value in [None, 1, True, {}, [], "  ", "x" * 10001])
        for intent in invalid:
            with self.subTest(intent=intent):
                response = self.submit(researchIntent=intent)
                self.assertEqual(response.status_code, 400, response.data)
                self.assertIn("researchIntent", response.data)
                self.assertFalse(SupervisorApplication.objects.exists())

    def test_trimmed_multiline_snapshot_accepts_limits_and_never_expands_list_payload(self):
        intent = valid_research_intent(introduction="  First line\nSecond line  ", timeline="x" * 10000)
        response = self.submit(multipart=True, researchIntent=intent)
        self.assertEqual(response.status_code, 201, response.data)
        pk = response.data["id"]
        expected = {**intent, "introduction": "First line\nSecond line"}
        self.assertEqual(self.exact(pk).data, {"researchIntent": expected})
        self.assertIn("no-store", self.exact(pk)["Cache-Control"])
        for payload in [response.data, self.client.get(APPLICATION_URL).data[0]]:
            self.assertNotIn("researchIntent", payload)
            self.assertNotIn("research_intent", payload)
        self.assertEqual(self.accept_by_supervisor(pk).status_code, 200)
        self.authenticate(self.coordinator)
        self.assertEqual(self.client.post(f"{APPLICATION_URL}{pk}/coordinator-approve/").status_code, 200)
        self.assertEqual(self.exact(pk).data, {"researchIntent": expected})
        for method in [self.client.put, self.client.patch, self.client.delete]:
            self.assertEqual(method(f"{APPLICATION_URL}{pk}/research-intent/", {}, format="json").status_code, 405)
        self.assertEqual(self.exact(pk).data, {"researchIntent": expected})

    def test_exact_read_reuses_all_application_access_boundaries_and_legacy_null(self):
        legacy = SupervisorApplication.objects.create(student=self.student, proposed_supervisor=self.supervisor_user,
            research_title="Legacy", research_abstract="Legacy abstract", research_area="Area")
        self.assertEqual(self.exact(legacy.pk).data, {"researchIntent": None})
        for user in [self.student_user, self.supervisor_user, self.coordinator, self.office_admin]:
            self.authenticate(user)
            self.assertEqual(self.exact(legacy.pk).status_code, 200)
        outsider = User.objects.create_user(email="intent-other@example.test", full_name="Other", role=User.Role.STUDENT)
        for user in [outsider, self.other_supervisor]:
            self.authenticate(user)
            self.assertEqual(self.exact(legacy.pk).status_code, 403)
        self.coordinator.lecturer.coordinator.programme_managed = "Other programme"
        self.coordinator.lecturer.coordinator.save(update_fields=["programme_managed"])
        self.authenticate(self.coordinator)
        self.assertEqual(self.exact(legacy.pk).status_code, 403)
        self.assertEqual(self.exact(999999).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertIn(self.exact(legacy.pk).status_code, [401, 403])

    def test_office_replacement_keeps_null_intent_and_original_snapshot(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        pk = response.data["id"]
        self.assertEqual(self.accept_by_supervisor(pk).status_code, 200)
        self.authenticate(self.coordinator)
        self.assertEqual(self.client.post(f"{APPLICATION_URL}{pk}/coordinator-approve/").status_code, 200)
        appointment = SupervisorAppointment.objects.get(application_id=pk)
        self.authenticate(self.office_admin)
        replacement = self.client.post(f"/api/appointments/supervisor/appointments/{appointment.pk}/replacement/", {
            "proposedSupervisorId": self.other_supervisor.lecturer.staff_no, "reason": "Synthetic replacement",
        }, format="json")
        self.assertEqual(replacement.status_code, 201, replacement.data)
        self.assertEqual(self.exact(replacement.data["id"]).data, {"researchIntent": None})
        self.assertEqual(self.exact(pk).data, {"researchIntent": valid_research_intent()})

    def test_malformed_multipart_intent_does_not_fall_back_to_legacy(self):
        for raw in ["", "{", "null", "{}", "true", "[]"]:
            with self.subTest(raw=raw):
                response = self.submit(multipart=True, researchIntent=raw)
                self.assertEqual(response.status_code, 400, response.data)
                self.assertFalse(SupervisorApplication.objects.exists())

    def test_draft_isolation_replacement_and_idempotent_delete(self):
        first = self.client.put(DRAFT_URL, self.draft(), format="json")
        self.assertEqual(first.status_code, 200)
        other = User.objects.create_user(email="draft-other@example.test", full_name="Other", role=User.Role.STUDENT)
        Student.objects.create(user=other, matric_no="DRAFT-OTHER", programme=self.student.programme)
        self.authenticate(other)
        self.assertEqual(self.client.get(DRAFT_URL).data, {"draft": None, "updatedAt": None})
        self.assertEqual(self.client.put(DRAFT_URL, self.draft(researchTitle="Other writing"), format="json").status_code, 200)
        self.authenticate(self.student_user)
        self.assertEqual(self.client.get(DRAFT_URL).data, first.data)
        changed = self.draft(researchTitle="Revised writing", step=4)
        self.assertEqual(self.client.put(DRAFT_URL, changed, format="json").data["draft"], changed)
        for _ in range(2):
            response = self.client.delete(DRAFT_URL)
            self.assertEqual(response.status_code, 204)
            self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(self.client.get(DRAFT_URL).data, {"draft": None, "updatedAt": None})
        self.authenticate(other)
        self.assertEqual(self.client.get(DRAFT_URL).data["draft"]["researchTitle"], "Other writing")

    def test_drafts_require_authenticated_eligible_student_on_every_method(self):
        self.client.force_authenticate(user=None)
        for method in [self.client.get, self.client.put, self.client.delete]:
            self.assertIn(method(DRAFT_URL).status_code, [401, 403])
        no_profile = User.objects.create_user(email="draft-no-profile@example.test", full_name="No profile", role=User.Role.STUDENT)
        for user in [no_profile, self.supervisor_user, self.coordinator, self.office_admin]:
            self.authenticate(user)
            for method in [self.client.get, self.client.put, self.client.delete]:
                self.assertEqual(method(DRAFT_URL).status_code, 403)
        self.student.status = Student.Status.DEFERRED
        self.student.save(update_fields=["status"])
        self.authenticate(self.student_user)
        for method in [self.client.get, self.client.put, self.client.delete]:
            self.assertEqual(method(DRAFT_URL).status_code, 403)

    def test_draft_exact_keys_types_and_bounds_reject_without_overwriting(self):
        original = self.client.put(DRAFT_URL, self.draft(), format="json")
        self.assertEqual(original.status_code, 200)
        invalid = [None, [], "text"]
        for key in self.draft():
            partial = self.draft()
            partial.pop(key)
            invalid.append(partial)
        variants = [
            {"version": True}, {"version": "1"}, {"version": 2}, {"step": True}, {"step": "2"}, {"step": 0}, {"step": 5},
            {"researchTitle": 3}, {"researchTitle": "x" * 501}, {"researchArea": "x" * 256}, {"researchAbstract": None},
            {"projectCodeEntries": "ABC"}, {"projectCodeEntries": [1]}, {"projectCodeEntries": [""] * 51},
            {"projectCodeEntries": ["x" * 256]}, {"titleOrigin": None}, {"titleOrigin": "OTHER"},
            {"noCoursesTaken": "false"}, {"proposedSupervisorId": 7}, {"proposedSupervisorId": "x" * 65},
            {"courseResults": {}}, {"courseResults": [{}]}, {"courseResults": [None]}, {"courseResults": self.draft()["courseResults"] * 51},
            {"researchIntent": valid_research_intent(introduction=7)}, {"researchIntent": valid_research_intent(aim="x" * 10001)},
        ]
        for key in ["studentId", "studentParticulars", "declarationAccepted", "documents", "status", "id"]:
            variants.append({key: "forged"})
        invalid.extend(self.draft(**variant) for variant in variants)
        for field, limit in [("courseName", 255), ("courseCode", 64), ("semesterSession", 64), ("grade", 32)]:
            for value in [7, None, "x" * (limit + 1)]:
                row = {**self.draft()["courseResults"][0], field: value}
                invalid.append(self.draft(courseResults=[row]))
        for draft in invalid:
            with self.subTest(draft=draft):
                response = self.client.put(DRAFT_URL, draft, format="json")
                self.assertEqual(response.status_code, 400, getattr(response, "data", None))
                self.assertEqual(self.client.get(DRAFT_URL).data, original.data)

    def test_draft_does_not_require_intake_capacity_or_current_supervisor_selection(self):
        self.academic_semester.lifecycle_status = "CLOSED"
        self.academic_semester.save(update_fields=["lifecycle_status"])
        response = self.client.put(DRAFT_URL, self.draft(proposedSupervisorId="obsolete-selection"), format="json")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.assertFalse(SupervisorApplication.objects.exists())

    def test_draft_abstract_is_bounded_without_changing_final_submission_abstract(self):
        draft = self.draft(researchAbstract="x" * 10001)
        response = self.client.put(DRAFT_URL, draft, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get(DRAFT_URL).data, {"draft": None, "updatedAt": None})
        response = self.submit(researchAbstract="x" * 10001)
        self.assertEqual(response.status_code, 201, response.data)

    def test_non_storable_text_is_rejected_before_database_write(self):
        self.client.raise_request_exception = False
        response = self.submit(researchIntent=valid_research_intent(aim="Bad\x00text"))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(SupervisorApplication.objects.exists())
        for value in ["Bad\x00text", "Bad\ud800text"]:
            variants = [
                {"researchTitle": value}, {"researchArea": value}, {"researchAbstract": value},
                {"projectCodeEntries": [value]}, {"proposedSupervisorId": value},
                {"researchIntent": valid_research_intent(aim=value)},
                {"courseResults": [{**self.draft()["courseResults"][0], "grade": value}]},
            ]
            for fields in variants:
                with self.subTest(fields=fields):
                    # JSON escapes allow exercising invalid Unicode at the API
                    # boundary without the test client's UTF-8 renderer failing.
                    response = self.client.put(DRAFT_URL, json.dumps(self.draft(**fields)), content_type="application/json")
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(self.client.get(DRAFT_URL).data, {"draft": None, "updatedAt": None})

    def test_failed_final_submission_retains_draft_and_success_clears_atomically(self):
        original = self.client.put(DRAFT_URL, self.draft(researchTitle="Keep my writing"), format="json")
        self.assertEqual(original.status_code, 200)
        invalid = self.submit(researchIntent=valid_research_intent(aim=""))
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.client.get(DRAFT_URL).data, original.data)
        # Exercise rollback after serializer.save(), including its draft deletion.
        with patch("appointments.views.record_workflow_event", side_effect=RuntimeError("Synthetic audit failure")):
            with self.assertRaises(RuntimeError):
                self.submit()
        self.assertFalse(SupervisorApplication.objects.exists())
        self.assertEqual(self.client.get(DRAFT_URL).data, original.data)
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.client.get(DRAFT_URL).data, {"draft": None, "updatedAt": None})
