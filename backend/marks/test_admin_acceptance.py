"""HTTP acceptance: Marks admin is inspection-only after portal migration."""
from .test_write_helpers import submission_payload

from django.contrib.auth.models import Permission
from django.test import Client
from django.urls import reverse
from rest_framework.test import APITestCase

from . import tests as fixture
from .models import (
    EvaluationPeriod, EvaluationTask,
    MarkCorrectionAudit, MarkEntry, MarksConfigurationAudit, Rubric,
)


class MarksAdminAcceptanceTests(APITestCase):
    setUp = fixture.MarkEntryWorkflowTests.setUp
    score_payload = fixture.MarkEntryWorkflowTests.score_payload

    def submitted_entry(self):
        self.client.force_authenticate(user=self.lecturer)
        self.assertEqual(self.client.put(
            f"/api/marks/tasks/{self.task.pk}/draft/", self.score_payload(),
            format="json",
        ).status_code, 200)
        self.assertEqual(self.client.post(
            f"/api/marks/tasks/{self.task.pk}/submit/", submission_payload(self.task), format='json',
        ).status_code, 200)
        return MarkEntry.objects.get(task=self.task)

    def admin_client(self, user=None, *, superuser=False):
        if user is None:
            from accounts.models import User
            user, _ = User.objects.get_or_create(email='marks.admin.inspect@example.test', defaults={
                'role': User.TECHNICAL_ADMIN, 'is_staff': True, 'is_superuser': True,
            })
            superuser = True
        user.is_staff = True
        user.is_superuser = superuser
        user.save(update_fields=["is_staff", "is_superuser"])
        user.user_permissions.add(*Permission.objects.filter(
            content_type__app_label="marks",
        ))
        client = Client(raise_request_exception=False)
        client.force_login(user)
        return client

    def change_url(self, record):
        opts = record._meta
        return reverse(f"admin:{opts.app_label}_{opts.model_name}_change", args=[record.pk])

    def correction_data(self, entry, **changes):
        data = {
            "comments": entry.comments,
            "correction_reason": "Acceptance transcription correction",
            "corrected_scores": "",
            "scores-TOTAL_FORMS": "2", "scores-INITIAL_FORMS": "2",
            "scores-MIN_NUM_FORMS": "0", "scores-MAX_NUM_FORMS": "1000",
            "_save": "Save",
        }
        for index, score in enumerate(entry.scores.order_by("pk")):
            data[f"scores-{index}-id"] = str(score.pk)
            data[f"scores-{index}-entry"] = str(entry.pk)
        return data | changes

    def snapshot(self, entry):
        return (MarkEntry.objects.values().get(pk=entry.pk),
                list(entry.scores.order_by("pk").values()),
                list(MarkCorrectionAudit.objects.order_by("pk").values()))

    def test_admin_denies_missing_reason_is_a_form_error_with_no_changes(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, comments="Unaudited comment", correction_reason="",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_denies_forged_status_total_and_inline_score_fields_cannot_bypass_correction(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, status="DRAFT", total_mark="1", **{"scores-0-marks_awarded":"1", "scores-0-DELETE":"on"},
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_denies_reopening_cannot_be_combined_with_score_or_comment_changes(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, reopen_for_lecturer="on", corrected_scores=f"{self.problem.pk}=35",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_draft_and_non_office_views_expose_no_correction_controls(self):
        entry = self.submitted_entry()
        client = self.admin_client(self.lecturer)
        response = client.get(self.change_url(entry))
        self.assertEqual(response.status_code, 302)
        entry.status = MarkEntry.Status.DRAFT
        entry.save(update_fields=["status"])
        response = self.admin_client().get(self.change_url(entry))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="corrected_scores"')
        self.assertNotContains(response, 'name="comments"')
        self.assertNotContains(response, 'name="_save"')

    def test_admin_denies_invalid_scores_render_validation_and_roll_back_all_scores(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, corrected_scores=f"{self.problem.pk}=35,{self.method.pk}=-1",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_denies_unknown_component_is_a_form_error_with_no_changes(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, corrected_scores="999999=5",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_denies_office_correction_recalculates_and_preserves_submission_with_audit(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, corrected_scores=f"{self.problem.pk}=35", comments="Corrected narrative",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_denies_open_period_reopens_once_with_audit(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, reopen_for_lecturer="on",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_denies_closed_period_reopening_is_a_form_error_without_mutation(self):
        entry = self.submitted_entry()
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period.save(update_fields=["lifecycle_status"])
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, reopen_for_lecturer="on",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_denies_closed_period_still_allows_audited_correction(self):
        entry = self.submitted_entry()
        self.period.lifecycle_status = EvaluationPeriod.Lifecycle.CLOSED
        self.period.save(update_fields=["lifecycle_status"])
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, corrected_scores=f"{self.problem.pk}=35",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_staff_lecturer_with_model_permissions_cannot_correct(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client(self.lecturer).post(
            self.change_url(entry), self.correction_data(entry, comments="Forbidden correction"),
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.snapshot(entry), before)

    def test_office_without_model_change_permission_cannot_correct(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        self.office_admin.user_permissions.clear()
        client = Client(raise_request_exception=False)
        client.force_login(self.office_admin)
        response = client.post(self.change_url(entry), self.correction_data(
            entry, corrected_scores=f"{self.problem.pk}=35",
        ))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_denies_stale_correction_post_after_reopening_cannot_change_the_draft(self):
        entry = self.submitted_entry()
        before = self.snapshot(entry)
        response = self.admin_client().post(self.change_url(entry), self.correction_data(
            entry, reopen_for_lecturer="on", comments="Stale edit",
        ))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_draft_comments_cannot_be_edited_outside_lecturer_workflow(self):
        entry = self.submitted_entry()
        entry.status = MarkEntry.Status.DRAFT
        entry.save(update_fields=["status"])
        before = self.snapshot(entry)
        response = self.admin_client().post(
            self.change_url(entry), self.correction_data(entry, comments="Unaudited draft edit"),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.snapshot(entry), before)

    def test_admin_cannot_reassign_evaluator(self):
        before = EvaluationTask.objects.values().get(pk=self.task.pk)
        response = self.admin_client(superuser=True).post(self.change_url(self.task), {
            "profile": self.profile.pk, "evaluator": self.other_lecturer.pk,
            "period": self.period.pk, "evaluator_role": "PANEL", "_save": "Save",
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(EvaluationTask.objects.values().get(pk=self.task.pk), before)

    def test_admin_cannot_change_period_semester_outside_configuration_service(self):
        before = EvaluationPeriod.objects.values().get(pk=self.period.pk)
        response = self.admin_client(superuser=True).post(self.change_url(self.period), {
            "academic_semester": "", "_save": "Save",
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(EvaluationPeriod.objects.values().get(pk=self.period.pk), before)
        self.assertFalse(MarksConfigurationAudit.objects.exists())

    def test_submitted_entries_and_audits_cannot_be_deleted_individually_or_in_bulk(self):
        entry = self.submitted_entry()
        audit = MarkCorrectionAudit.objects.create(
            entry=entry, actor=self.office_admin, action="CORRECT", reason="Retain evidence",
            before_values={"totalMark": "80.00"}, after_values={"totalMark": "80.00"},
        )
        client = self.admin_client(superuser=True)
        before = self.snapshot(entry)
        for record in (audit, entry):
            opts = record._meta
            route = f"admin:{opts.app_label}_{opts.model_name}"
            with self.subTest(model=opts.model_name):
                response = client.post(reverse(f"{route}_delete", args=[record.pk]), {"post": "yes"})
                self.assertEqual(response.status_code, 403)
                client.post(reverse(f"{route}_changelist"), {
                    "action": "delete_selected", "_selected_action": [record.pk], "post": "yes",
                })
                self.assertEqual(self.snapshot(entry), before)

    def test_governed_marks_admin_does_not_offer_creation(self):
        client = self.admin_client(superuser=True)
        for model in (Rubric, EvaluationPeriod, EvaluationTask, MarkEntry, MarkCorrectionAudit):
            with self.subTest(model=model.__name__):
                opts = model._meta
                response = client.post(reverse(f"admin:{opts.app_label}_{opts.model_name}_add"), {})
                self.assertEqual(response.status_code, 403)
