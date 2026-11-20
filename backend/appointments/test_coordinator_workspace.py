from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordinatorDelegation, ProjectRegistration, Student, StudentSemester, User
from . import test_appointment_lifecycle as fixture
from .models import (CoSupervisorAppointment, CoSupervisorNomination, SupervisorApplication,
                     SupervisorAppointment, PanelRecommendation, CapacityReassessmentEvent)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CoordinatorWorkspaceTests(APITestCase):
    setUp = fixture.AppointmentLifecycleTests.setUp
    _lecturer = fixture.AppointmentLifecycleTests._lecturer
    base = "/api/appointments/coordinator-workspace/"

    def application_for(self, number, *, status="PENDING_COORDINATOR", programme=None):
        user = User.objects.create_user(email=f"browse-{number}@example.test", role=User.Role.STUDENT,
                                        full_name=f"Applicant {number:03d}")
        student = Student.objects.create(user=user, matric_no=f"BROWSE-{number:03d}",
                                        programme=programme or self.student.programme)
        return SupervisorApplication.objects.create(student=student, proposed_supervisor=self.supervisor,
            academic_semester=self.semester, status=status, research_title=f"Research {number}",
            research_abstract="Abstract", submitted_at=timezone.now() - timedelta(days=number),
            supervisor_decided_at=timezone.now() - timedelta(days=number))

    def nomination(self, candidate=None, status="PENDING_COORDINATOR"):
        return CoSupervisorNomination.objects.create(student=self.student, primary_appointment=self.supervisor_appointment,
            nominator=self.supervisor, candidate=candidate or self.new_supervisor, academic_semester=self.semester,
            status=status, justification="Supporting expertise", candidate_decided_at=timezone.now())

    def get(self, collection, **params):
        self.client.force_authenticate(self.coordinator)
        return self.client.get(self.base + collection + "/", params)

    def test_requests_page_counts_and_sort_are_authorized_before_paging(self):
        expected = [self.application_for(n) for n in range(1, 14)]
        self.application_for(90, programme="Outside")
        self.application_for(91, status="CANCELLED_BY_STUDENT")
        self.application_for(92, status="SUBMITTED_TO_SUPERVISOR")
        response = self.get("requests", size=10, page=2, sort="oldest")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 13)
        self.assertEqual(response.data["reviewCount"], 13)
        self.assertEqual(response.data["pageCount"], 2)
        self.assertEqual([row["id"] for row in response.data["results"]], [row.pk for row in reversed(expected[:3])])
        self.assertEqual(response.data["facets"]["programmes"], [self.student.programme])
        self.assertNotIn("workflow", response.data["results"][0])

    def test_review_count_ignores_search_and_supporting_candidate_decisions_are_preserved(self):
        self.application_for(1)
        nomination = self.nomination(self.coordinator, "SUBMITTED_TO_CO_SUPERVISOR")
        response = self.get("requests", q="Lifecycle", type="supporting")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["reviewCount"], 2)
        self.assertEqual(response.data["results"][0]["key"], f"supporting-{nomination.pk}")
        self.assertTrue(response.data["results"][0]["canDecide"])

    def test_history_hides_student_withdrawals_ignores_focus_and_filters_outcome_date(self):
        outcome = self.application_for(1, status="REJECTED_BY_COORDINATOR")
        outcome.coordinator_decided_at = timezone.now() - timedelta(days=5)
        outcome.save(update_fields=["coordinator_decided_at"])
        self.application_for(2, status="CANCELLED_BY_STUDENT")
        response = self.get("requests", view="history", focus="decision", q="Applicant",
                            **{"from": (timezone.localdate() - timedelta(days=6)).isoformat(),
                               "to": (timezone.localdate() - timedelta(days=4)).isoformat()})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data["results"]], [outcome.pk])

    def test_acting_scope_expiry_and_role_access(self):
        other = self.application_for(1, programme="Acting Programme")
        today = timezone.localdate()
        CoordinatorDelegation.objects.create(coordinator=self.coordinator, programme="Acting Programme",
            starts_on=today, ends_on=today, justification="Leave", granted_by=self.office)
        self.assertEqual(self.get("requests").data["results"][0]["id"], other.pk)
        with patch("accounts.delegations.today", return_value=today + timedelta(days=1)):
            self.assertEqual(self.get("requests").data["total"], 0)
        for actor in (self.office, self.supervisor, self.student_user):
            self.client.force_authenticate(actor)
            self.assertEqual(self.client.get(self.base + "teams/").status_code, 403)

    def test_team_supervisor_counts_search_student_identity_and_deduplicate_drilldown(self):
        nomination = self.nomination(self.supervisor, "APPROVED")
        CoSupervisorAppointment.objects.create(nomination=nomination, student=self.student,
            supervisor=self.supervisor, approved_by=self.coordinator)
        response = self.get("teams", q=self.student.matric_no)
        self.assertEqual(response.status_code, 200)
        row = response.data["results"][0]
        self.assertEqual((row["primaryCount"], row["supportingCount"]), (1, 1))
        drilldown = self.get("teams", supervisor=self.supervisor.pk)
        self.assertEqual(drilldown.data["total"], 1)
        self.assertEqual(drilldown.data["results"][0]["relationship"], "Primary supervisor")
        supporting_only = self.get("teams", supervisor=self.supervisor.pk, type="supporting")
        self.assertEqual(supporting_only.data["results"][0]["relationship"], "Supporting supervisor")
        self.assertEqual(self.get("teams", view="students", q="Lifecycle-safe").data["total"], 1)

    def test_current_team_stage_filters_scoped_groups_and_student_rows(self):
        outside = self.application_for(199, programme="Outside")
        SupervisorAppointment.objects.create(student=outside.student, supervisor=self.supervisor,
            application=outside, approved_by=self.coordinator)
        for student, stage in ((self.student, "P2"), (outside.student, "P1")):
            StudentSemester.objects.get_or_create(student=student,
                session=self.semester.academic_session, term=self.semester.term)
            ProjectRegistration.objects.update_or_create(student=student, academic_semester=self.semester, defaults={"stage": stage})
        self.assertEqual(self.get("teams", projectStage="P1").data["total"], 0)
        groups = self.get("teams", projectStage="P2").data
        self.assertEqual(groups["results"][0]["primaryCount"], 1)
        students = self.get("teams", projectStage="P2", supervisor=self.supervisor.pk).data
        self.assertEqual(students["results"][0]["projectStage"], "P2")
        self.assertEqual(students["projectSemester"], self.semester.label)
        self.assertEqual(self.get("teams", projectStage="unsupported").status_code, 400)

    def test_team_detail_is_singleton_and_primary_application_is_authorized(self):
        response = self.get(f"teams/{self.student.matric_no}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["teams"]), 1)
        self.assertEqual(response.data["primaryApplication"]["id"], self.application.pk)
        outside = self.application_for(1, programme="Outside")
        self.assertEqual(self.get(f"teams/{outside.student.pk}").status_code, 404)

    def test_history_has_ended_records_only_and_correct_primary_application_identity(self):
        self.supervisor_appointment.status = "ENDED"
        self.supervisor_appointment.end_outcome = "REPLACED"
        self.supervisor_appointment.ended_at = timezone.now()
        self.supervisor_appointment.save()
        nomination = self.nomination(status="APPROVED")
        supporting = CoSupervisorAppointment.objects.create(nomination=nomination, student=self.student,
            supervisor=self.new_supervisor, approved_by=self.coordinator, status="ENDED", ended_at=timezone.now())
        response = self.get("appointments")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        primary = next(row for row in response.data["results"] if row["kind"] == "primary")
        self.assertEqual(primary["applicationId"], self.application.pk)
        self.assertEqual(self.get(f"appointments/supporting/{supporting.pk}").data["id"], supporting.pk)

    def test_carryover_page_serializes_only_selected_scoped_requests(self):
        self.semester.lifecycle_status = "CLOSED"
        self.semester.save(update_fields=["lifecycle_status"])
        for number in range(1, 13):
            self.application_for(number)
        self.application_for(80, programme="Outside")
        self.application_for(81, status="CANCELLED_BY_STUDENT")
        from .capacity_reassessment import request_payload
        with patch("appointments.capacity_reassessment.request_payload", wraps=request_payload) as serializer:
            response = self.get("carryover", size=10)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 12)
        self.assertLessEqual(serializer.call_count, 10)
        self.assertNotIn("history", response.data["results"][0])
        first = response.data["results"][0]
        detail = self.get(f"carryover/{first['kind']}/{first['id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["record"]["id"], first["id"])

    def test_invalid_filters_and_sizes_return_400(self):
        for params in ({"size": 100}, {"page": 0}, {"from": "nonsense"}, {"sort": "random"}):
            with self.subTest(params=params):
                self.assertEqual(self.get("requests", **params).status_code, 400)

    def test_supporting_detail_is_targeted_and_outside_scope_is_hidden(self):
        nomination = self.nomination()
        self.assertEqual(self.get(f"requests/supporting/{nomination.pk}").status_code, 200)
        self.student.programme = "Outside"
        self.student.save(update_fields=["programme"])
        self.assertEqual(self.get(f"requests/supporting/{nomination.pk}").status_code, 404)

    def test_undecided_submission_does_not_claim_a_decision_date(self):
        application = self.application_for(1, status="SUBMITTED_TO_SUPERVISOR")
        application.supervisor_decided_at = None
        application.save(update_fields=["supervisor_decided_at"])
        response = self.get("requests", focus="all")
        self.assertEqual(response.data["results"][0]["decidedAt"], None)

    def test_team_title_search_includes_legacy_matric_linked_profiles(self):
        self.profile.student = None
        self.profile.save(update_fields=["student"])
        self.assertEqual(self.get("teams", view="students", q="Lifecycle-safe").data["total"], 1)

    def test_semester_filter_uses_display_label_and_combined_kind_pages(self):
        primary = self.application_for(1)
        supporting = self.nomination()
        response = self.get("requests", semester=self.semester.label, sort="oldest")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual({row["key"] for row in response.data["results"]}, {f"primary-{primary.pk}", f"supporting-{supporting.pk}"})
        self.assertEqual(response.data["facets"]["semesters"], [self.semester.label])
        self.assertEqual(self.get("requests", semester="Semester II 1900/1901").data["total"], 0)
        self.assertEqual(self.get("teams", semester=self.semester.label, sort="primary").data["total"], 1)

    def test_supervisor_identity_and_counts_are_limited_to_authorized_students(self):
        same_name = self._lecturer("same-name@example.test", "SAME-1", supervisor=True)
        same_name.full_name = self.supervisor.full_name
        same_name.save(update_fields=["full_name"])
        application = self.application_for(1, status="APPROVED")
        SupervisorAppointment.objects.create(application=application, student=application.student,
            supervisor=same_name, approved_by=self.coordinator)
        outside = self.application_for(2, status="APPROVED", programme="Outside")
        SupervisorAppointment.objects.create(application=outside, student=outside.student,
            supervisor=self.supervisor, approved_by=self.coordinator)
        response = self.get("teams", sort="supporting")
        self.assertEqual(response.data["total"], 2)
        self.assertEqual({row["id"] for row in response.data["results"]}, {same_name.pk, self.supervisor.pk})
        self.assertEqual([row["primaryCount"] for row in response.data["results"]], [1, 1])

    def test_numeric_matric_is_preferred_over_student_primary_key(self):
        application = self.application_for(1, status="APPROVED")
        application.student.matric_no = str(self.student.pk)
        application.student.save(update_fields=["matric_no"])
        response = self.get(f"teams/{self.student.pk}")
        self.assertEqual(response.data["teams"][0]["studentId"], application.student.pk)

    def test_primary_decisions_respect_student_eligibility_but_supporting_rejection_remains(self):
        application = self.application_for(1)
        application.student.status = Student.Status.DEFERRED
        application.student.save(update_fields=["status"])
        nomination = self.nomination()
        self.student.status = Student.Status.DEFERRED
        self.student.save(update_fields=["status"])
        response = self.get("requests")
        self.assertEqual(response.data["reviewCount"], 1)
        self.assertEqual([row["key"] for row in response.data["results"]], [f"supporting-{nomination.pk}"])

    def test_archived_pending_records_are_readable_but_have_no_available_decisions(self):
        self.application_for(1)
        self.nomination()
        self.semester.lifecycle_status = "ARCHIVED"
        self.semester.save(update_fields=["lifecycle_status"])
        decisions = self.get("requests")
        self.assertEqual(decisions.data["reviewCount"], 0)
        self.assertEqual(decisions.data["total"], 0)
        records = self.get("requests", focus="all")
        self.assertEqual(records.data["total"], 2)
        self.assertTrue(all(row["canDecide"] is False for row in records.data["results"]))

    def test_supervisor_name_search_does_not_match_other_supervisors_of_same_student(self):
        self.supervisor.full_name = "DrOne"
        self.supervisor.save(update_fields=["full_name"])
        self.new_supervisor.full_name = "DrTwo"
        self.new_supervisor.save(update_fields=["full_name"])
        nomination = self.nomination(status="APPROVED")
        CoSupervisorAppointment.objects.create(nomination=nomination, student=self.student,
            supervisor=self.new_supervisor, approved_by=self.coordinator)
        name_search = self.get("teams", q="DrOne")
        self.assertEqual([row["id"] for row in name_search.data["results"]], [self.supervisor.pk])
        student_search = self.get("teams", q=self.student.user.full_name)
        self.assertEqual({row["id"] for row in student_search.data["results"]}, {self.supervisor.pk, self.new_supervisor.pk})
        self.assertEqual(self.get("teams", view="students", q="DrOne").data["total"], 1)

    def test_carryover_record_queries_are_batched_for_the_selected_page(self):
        self.semester.lifecycle_status = "CLOSED"
        self.semester.save(update_fields=["lifecycle_status"])
        for number in range(1, 26):
            self.application_for(number)
        with CaptureQueriesContext(connection) as small_queries:
            small = self.get("carryover", size=10)
        with CaptureQueriesContext(connection) as larger_queries:
            larger = self.get("carryover", size=25)
        self.assertEqual(len(small.data["results"]), 10)
        self.assertEqual(len(larger.data["results"]), 25)
        self.assertLessEqual(len(larger_queries) - len(small_queries), 4)

    def test_carryover_panel_filter_is_specific_to_the_capacity_tool(self):
        self.semester.lifecycle_status = "CLOSED"
        self.semester.save(update_fields=["lifecycle_status"])
        self.application_for(1)
        self.nomination()
        panel = PanelRecommendation.objects.create(profile=self.profile, supervisor=self.supervisor,
            recommended_member=self.panel, academic_semester=self.semester, status="PENDING_COORDINATOR")
        response = self.get("carryover", type="panel")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([(row["kind"], row["id"]) for row in response.data["results"]], [("PANEL", panel.pk)])
        self.assertEqual(self.get("carryover").data["total"], 3)
        for collection in ("requests", "appointments"):
            self.assertEqual(self.get(collection, type="panel").status_code, 400)

    def test_terminal_carryover_keeps_consumed_authorization_and_audit_detail(self):
        application = self.application_for(1, status="APPROVED")
        common = dict(supervisor_application=application, target_semester=self.semester,
            actor=self.office, actor_role=self.office.role, actor_name=self.office.full_name,
            request_status="PENDING_COORDINATOR", reason="Recorded authority")
        grant = CapacityReassessmentEvent.objects.create(action="GRANTED", **common)
        CapacityReassessmentEvent.objects.create(action="CONSUMED", authorization=grant, **common)
        response = self.get("carryover")
        self.assertEqual(response.data["total"], 1)
        authorization = response.data["results"][0]["authorization"]
        self.assertEqual(authorization["id"], grant.pk)
        self.assertEqual(authorization["state"], "CONSUMED")
        detail = self.get(f"carryover/SUPERVISOR/{application.pk}")
        self.assertEqual(detail.data["record"]["authorization"]["state"], "CONSUMED")
        self.assertEqual(len(detail.data["record"]["history"]), 2)

    def test_carryover_student_withdrawal_is_hidden_from_list_but_keeps_scoped_audit_access(self):
        application = self.application_for(1, status="CANCELLED_BY_STUDENT")
        CapacityReassessmentEvent.objects.create(supervisor_application=application, target_semester=self.semester,
            actor=self.office, actor_role=self.office.role, actor_name=self.office.full_name,
            request_status="PENDING_COORDINATOR", reason="Earlier authority", action="GRANTED")
        self.assertEqual(self.get("carryover").data["total"], 0)
        self.assertEqual(self.get(f"carryover/SUPERVISOR/{application.pk}").status_code, 200)
        application.student.programme = "Outside"
        application.student.save(update_fields=["programme"])
        self.assertEqual(self.get(f"carryover/SUPERVISOR/{application.pk}").status_code, 404)

    def test_carryover_waiting_sort_uses_current_stage_age(self):
        self.semester.lifecycle_status = "CLOSED"
        self.semester.save(update_fields=["lifecycle_status"])
        older_submission = self.application_for(30)
        older_submission.supervisor_decided_at = timezone.now() - timedelta(days=1)
        older_submission.save(update_fields=["supervisor_decided_at"])
        older_stage = self.application_for(10)
        older_stage.supervisor_decided_at = timezone.now() - timedelta(days=5)
        older_stage.save(update_fields=["supervisor_decided_at"])
        response = self.get("carryover", sort="waiting")
        self.assertEqual([row["id"] for row in response.data["results"]], [older_stage.pk, older_submission.pk])
        response = self.get("carryover", sort="oldest")
        self.assertEqual([row["id"] for row in response.data["results"]], [older_submission.pk, older_stage.pk])

    def test_primary_detail_preserves_decision_capability_and_scoped_audit_access(self):
        application = self.application_for(1)
        response = self.get(f"requests/primary/{application.pk}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], application.pk)
        self.assertTrue(response.data["canDecide"])
        application.student.user.is_active = False
        application.student.user.save(update_fields=["is_active"])
        self.assertFalse(self.get(f"requests/primary/{application.pk}").data["canDecide"])
        self.assertEqual(self.get("requests").data["reviewCount"], 0)
        application.status = "CANCELLED_BY_STUDENT"
        application.save(update_fields=["status"])
        self.assertEqual(self.get(f"requests/primary/{application.pk}").status_code, 200)
        application.student.programme = "Outside"
        application.student.save(update_fields=["programme"])
        self.assertEqual(self.get(f"requests/primary/{application.pk}").status_code, 404)

    def test_team_group_relationship_filters_match_supervisor_drilldown(self):
        from academics.models import AcademicSemester
        today = timezone.localdate()
        second = AcademicSemester.objects.create(academic_session=self.semester.academic_session,
            term=AcademicSemester.Term.SEMESTER_II, starts_on=today + timedelta(days=150),
            ends_on=today + timedelta(days=240), created_by=self.office)
        self.supervisor_appointment.appointment_date = today - timedelta(days=30)
        self.supervisor_appointment.save(update_fields=["appointment_date"])
        nomination = self.nomination(status="APPROVED")
        nomination.academic_semester = second
        nomination.save(update_fields=["academic_semester"])
        CoSupervisorAppointment.objects.create(nomination=nomination, student=self.student,
            supervisor=self.new_supervisor, approved_by=self.coordinator, appointment_date=today - timedelta(days=2))
        cases = (({"semester": self.semester.label}, self.supervisor.pk, (1, 0)),
                 ({"semester": second.label}, self.new_supervisor.pk, (0, 1)),
                 ({"type": "primary"}, self.supervisor.pk, (1, 0)),
                 ({"type": "supporting"}, self.new_supervisor.pk, (0, 1)),
                 ({"from": (today - timedelta(days=5)).isoformat()}, self.new_supervisor.pk, (0, 1)),
                 ({"to": (today - timedelta(days=10)).isoformat()}, self.supervisor.pk, (1, 0)))
        for filters, expected_id, expected_counts in cases:
            with self.subTest(filters=filters):
                grouped = self.get("teams", **filters)
                self.assertEqual(grouped.data["total"], 1)
                row = grouped.data["results"][0]
                self.assertEqual(row["id"], expected_id)
                self.assertEqual((row["primaryCount"], row["supportingCount"]), expected_counts)
                for supervisor in (self.supervisor, self.new_supervisor):
                    drilldown = self.get("teams", supervisor=supervisor.pk, **filters)
                    self.assertEqual(drilldown.data["total"], int(supervisor.pk == expected_id))

    def test_legacy_history_exposes_the_same_effective_outcome_date_used_by_filters(self):
        application = self.application_for(40, status="REJECTED_BY_COORDINATOR")
        application.supervisor_decided_at = None
        application.coordinator_decided_at = None
        application.save(update_fields=["supervisor_decided_at", "coordinator_decided_at"])
        today = timezone.localdate().isoformat()
        response = self.get("requests", view="history", q=application.student.matric_no,
                            sort="newest", **{"from": today, "to": today})
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["results"][0]["decidedAt"], application.updated_at)
