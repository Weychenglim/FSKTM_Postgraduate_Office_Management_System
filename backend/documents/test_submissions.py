from datetime import timedelta
from unittest import mock

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ProjectRegistration, Student, StudentCompletion, StudentSemester
from announcements.models import Notification

from .fixtures import CS, DS, TEST_MEDIA, DocumentPeople, pdf_bytes, upload
from .models import Document, DocumentType, Submission, SubmissionChange, SubmissionEntry
from .test_access import DocumentClient

BASE = "/api/documents/submissions/"


def at(when):
    return mock.patch("documents.submissions.now", return_value=when)


class SubmissionClient(DocumentClient):
    def make(self, user=None, **body):
        self.client.force_authenticate(user or self.coordinator)
        values = {
            "title": "RP2 final report",
            "type": "final-research-report",
            "programmes": [CS],
            "stage": "ALL",
            "dueAt": self.due.isoformat(),
            "afterDue": "CLOSE",
            **body,
        }
        return self.client.post(BASE, values, format="json")

    def made(self, **body):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.make(**body)
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def hand_in(self, student, pk, pages=1, content=None):
        self.client.force_authenticate(student.user)
        return self.client.post(f"{BASE}{pk}/send/", {"file": upload("report.pdf", content or pdf_bytes(pages))}, format="multipart")

    def card(self, student, pk):
        self.client.force_authenticate(student.user)
        return next(card for card in self.client.get(f"{BASE}mine/").data["submissions"] if card["id"] == pk)

    def detail(self, pk, user=None):
        self.client.force_authenticate(user or self.coordinator)
        response = self.client.get(f"{BASE}{pk}/")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def row(self, pk, matric, user=None):
        return next(row for row in self.detail(pk, user)["students"] if row["matric"] == matric)

    def edit(self, pk, **body):
        self.client.force_authenticate(self.coordinator)
        current = self.detail(pk)
        values = {
            "title": current["title"], "type": current["type"]["code"], "programmes": current["programmes"], "stage": current["stage"],
            "dueAt": current["dueAt"], "afterDue": current["afterDue"], "lateUntil": current["lateUntil"],
            "instructions": current["instructions"], "opensAt": current["opensAt"], **body,
        }
        return self.client.patch(f"{BASE}{pk}/", values, format="json")


class SubmissionBase(DocumentPeople, SubmissionClient, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.make_people()
        cls.make_checker()
        for student in (cls.ali, cls.bella, cls.chen, cls.deferred):
            StudentSemester.objects.create(student=student, session=cls.semester.academic_session, term=cls.semester.term)

    def setUp(self):
        cache.clear()
        self.due = (timezone.now() + timedelta(days=7)).replace(microsecond=0)


@TEST_MEDIA
class SetUpTests(SubmissionBase):
    def test_a_coordinator_sets_one_up_and_the_students_are_told(self):
        pk = self.made()
        self.assertTrue(Notification.objects.filter(recipient=self.bella.user, record_type="SUBMISSION", record_id=str(pk)).exists())
        self.assertFalse(Notification.objects.filter(recipient=self.ali.user, record_type="SUBMISSION").exists())
        data = self.detail(pk)
        self.assertEqual([(row["matric"], row["state"]) for row in data["students"]], [("DOC-S2", "NOT_SENT")])
        self.assertEqual((data["isOpen"], data["canManage"], data["counts"]["NOT_SENT"]), (True, True, 1))
        self.assertEqual(SubmissionChange.objects.get().action, "CREATED")

    def test_only_coordinators_set_them_up_for_their_own_programmes(self):
        self.assertEqual(self.make(self.office).status_code, 403)
        self.assertIn("programmes", self.make(programmes=[DS]).data)
        self.assertIn("dueAt", self.make(dueAt=(timezone.now() - timedelta(hours=1)).isoformat()).data)
        self.assertIn("lateUntil", self.make(afterDue="ACCEPT_LATE", lateUntil=(self.due - timedelta(days=1)).isoformat()).data)
        self.assertIn("type", self.make(type="staff-document").data)
        self.assertIn("title", self.make(title="  ").data)

    def test_the_office_sees_them_but_cannot_change_them(self):
        pk = self.made()
        self.client.force_authenticate(self.office)
        listed = self.client.get(BASE).data
        self.assertEqual([item["id"] for item in listed["submissions"]], [pk])
        self.assertFalse(listed["canCreate"])
        self.assertFalse(self.detail(pk, self.office)["canManage"])
        self.assertEqual(self.client.post(f"{BASE}{pk}/open/", {"open": False}, format="json").status_code, 403)

    def test_another_programme_coordinator_cannot_see_or_change_it(self):
        pk = self.made()
        self.client.force_authenticate(self.checker)
        self.assertEqual(self.client.get(BASE).data["submissions"], [])
        self.assertEqual(self.client.get(f"{BASE}{pk}/").status_code, 404)
        self.assertEqual(self.client.post(f"{BASE}{pk}/open/", {"open": False}, format="json").status_code, 404)

    def test_students_and_lecturers_cannot_open_the_staff_list(self):
        self.client.force_authenticate(self.bella.user)
        self.assertEqual(self.client.get(BASE).status_code, 403)
        self.client.force_authenticate(self.supervisor)
        self.assertEqual(self.client.get(BASE).status_code, 403)


@TEST_MEDIA
class WhoMustSendTests(SubmissionBase):
    def test_only_active_students_studying_this_semester_in_the_programme(self):
        self.client.force_authenticate(self.checker)
        response = self.client.post(BASE, {"title": "Proposal", "type": "final-research-report", "programmes": [DS], "dueAt": self.due.isoformat()}, format="json")
        pk = response.data["id"]
        self.assertEqual([row["matric"] for row in self.detail(pk, self.checker)["students"]], ["DOC-S1", "DOC-S3"])
        StudentSemester.objects.filter(student=self.chen).update(outcome="NOT_REGISTERED")
        StudentCompletion.objects.create(student=self.ali, last_session=self.semester.academic_session, last_term=self.semester.term)
        self.assertEqual(self.detail(pk, self.checker)["students"], [])

    def test_by_rp_stage(self):
        pk = self.made(stage="P2")
        self.assertEqual(self.detail(pk)["students"], [])
        ProjectRegistration.objects.create(student=self.bella, academic_semester=self.semester, stage="P2", source="COORDINATOR", confirmed_by=self.coordinator)
        self.assertEqual([row["matric"] for row in self.detail(pk)["students"]], ["DOC-S2"])

    def test_someone_who_sent_it_stays_listed_after_they_stop_being_expected(self):
        pk = self.made()
        self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        Student.objects.filter(pk=self.bella.pk).update(status=Student.Status.WITHDRAWN)
        row = self.row(pk, "DOC-S2")
        self.assertEqual((row["state"], row["expected"]), ("ON_TIME", False))

    def test_a_student_not_expected_cannot_send(self):
        pk = self.made()
        self.assertEqual(self.hand_in(self.ali, pk).status_code, 409)


@TEST_MEDIA
class DeadlineTests(SubmissionBase):
    def test_on_time_then_replaced_keeps_the_first_and_the_last_time(self):
        pk = self.made()
        first = self.due - timedelta(days=2)
        with at(first):
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        second = pdf_bytes(2)
        with at(self.due - timedelta(hours=1)):
            again = self.hand_in(self.bella, pk, content=second)
            self.assertEqual(again.status_code, 201, again.data)
            self.assertEqual(self.hand_in(self.bella, pk, content=second).status_code, 409)
        entry = SubmissionEntry.objects.get()
        self.assertEqual((entry.first_sent_at, entry.last_sent_at), (first, self.due - timedelta(hours=1)))
        self.assertEqual(entry.document.versions.count(), 2)
        self.assertEqual(self.row(pk, "DOC-S2")["state"], "ON_TIME")

    def test_exactly_at_the_due_time_is_on_time_and_one_second_later_is_closed(self):
        pk = self.made()
        with at(self.due):
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        with at(self.due + timedelta(seconds=1)):
            refused = self.hand_in(self.bella, pk, pages=2)
            self.assertEqual((refused.status_code, refused.data["detail"]), (409, "The deadline has passed."))
            card = self.card(self.bella, pk)
        self.assertEqual((card["state"], card["canSend"]), ("ON_TIME", False))

    def test_accept_late_records_exactly_how_late(self):
        pk = self.made(afterDue="ACCEPT_LATE")
        with at(self.due + timedelta(days=1, hours=3)):
            self.assertTrue(self.card(self.bella, pk)["lateIfSentNow"])
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        row = self.row(pk, "DOC-S2")
        self.assertEqual((row["state"], row["lateBySeconds"]), ("LATE", 97200))

    def test_a_last_day_for_late_work(self):
        pk = self.made(afterDue="ACCEPT_LATE", lateUntil=(self.due + timedelta(days=2)).isoformat())
        with at(self.due + timedelta(days=3)):
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 409)
        with at(self.due + timedelta(days=1)):
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)

    def test_switching_it_closed_and_open_again(self):
        pk = self.made()
        self.client.force_authenticate(self.coordinator)
        self.assertFalse(self.client.post(f"{BASE}{pk}/open/", {"open": False}, format="json").data["isOpen"])
        refused = self.hand_in(self.bella, pk)
        self.assertEqual((refused.status_code, refused.data["detail"]), (409, "This submission is closed."))
        self.client.force_authenticate(self.coordinator)
        self.client.post(f"{BASE}{pk}/open/", {"open": True}, format="json")
        self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        self.assertEqual([row.action for row in SubmissionChange.objects.order_by("id")], ["CREATED", "CLOSED", "OPENED"])

    def test_switching_late_work_on_and_off(self):
        pk = self.made()
        with at(self.due + timedelta(hours=2)):
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 409)
            self.assertEqual(self.edit(pk, afterDue="ACCEPT_LATE").status_code, 200)
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
            self.assertEqual(self.edit(pk, afterDue="CLOSE").status_code, 200)
            self.assertEqual(self.hand_in(self.bella, pk, pages=2).status_code, 409)
        self.assertEqual(self.row(pk, "DOC-S2")["state"], "LATE")

    def test_an_extension_moves_one_students_date(self):
        pk = self.made()
        self.client.force_authenticate(self.coordinator)
        too_early = self.client.post(f"{BASE}{pk}/extensions/", {"matric": "DOC-S2", "dueAt": (self.due - timedelta(hours=1)).isoformat(), "reason": "MEDICAL"}, format="json")
        self.assertEqual(too_early.status_code, 400)
        given = self.client.post(f"{BASE}{pk}/extensions/", {"matric": "doc-s2", "dueAt": (self.due + timedelta(days=2)).isoformat(), "reason": "MEDICAL"}, format="json")
        self.assertEqual(given.status_code, 200, given.data)
        with at(self.due + timedelta(days=1)):
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        row = self.row(pk, "DOC-S2")
        self.assertEqual((row["state"], row["extension"]["reason"]), ("ON_TIME", "Medical"))
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.delete(f"{BASE}{pk}/extensions/DOC-S2/").status_code, 200)
        self.assertEqual(self.row(pk, "DOC-S2")["state"], "LATE")
        self.assertEqual(self.client.delete(f"{BASE}{pk}/extensions/DOC-S2/").status_code, 404)

    def test_moving_the_due_date_earlier_asks_first(self):
        pk = self.made()
        with at(self.due - timedelta(days=1)):
            self.hand_in(self.bella, pk)
        earlier = (self.due - timedelta(days=2)).isoformat()
        asked = self.edit(pk, dueAt=earlier)
        self.assertEqual((asked.status_code, asked.data["code"], asked.data["count"]), (409, "would_become_late", 1))
        self.assertEqual(self.edit(pk, dueAt=earlier, confirm=True).status_code, 200)
        self.assertEqual(self.row(pk, "DOC-S2")["state"], "LATE")

    def test_the_file_type_is_fixed_once_files_are_sent(self):
        pk = self.made()
        self.hand_in(self.bella, pk)
        self.assertEqual(self.edit(pk, type="p1-research-report").status_code, 409)


@TEST_MEDIA
class FilePageTests(SubmissionBase):
    def test_a_new_version_on_the_file_page_keeps_to_the_deadline(self):
        pk = self.made()
        self.hand_in(self.bella, pk)
        document = SubmissionEntry.objects.get().document
        self.client.force_authenticate(self.bella.user)
        with at(self.due - timedelta(hours=1)):
            added = self.client.post(f"/api/documents/{document.pk}/versions/", {"file": upload("v2.pdf", pdf_bytes(2))}, format="multipart")
            self.assertEqual(added.status_code, 201, added.data)
        self.assertEqual(SubmissionEntry.objects.get().last_sent_at, self.due - timedelta(hours=1))
        with at(self.due + timedelta(hours=1)):
            refused = self.client.post(f"/api/documents/{document.pk}/versions/", {"file": upload("v3.pdf", pdf_bytes(3))}, format="multipart")
        self.assertEqual(refused.status_code, 409)
        self.assertEqual(document.versions.count(), 2)

    def test_a_sent_file_cannot_be_deleted_by_the_student(self):
        pk = self.made()
        self.hand_in(self.bella, pk)
        document = SubmissionEntry.objects.get().document
        self.client.force_authenticate(self.bella.user)
        self.assertFalse(self.client.get(f"/api/documents/{document.pk}/").data["permissions"]["canDelete"])
        self.assertEqual(self.client.delete(f"/api/documents/{document.pk}/").status_code, 403)
        self.assertTrue(Document.objects.filter(pk=document.pk).exists())

    def test_a_one_per_student_type_becomes_a_new_version_of_the_existing_file(self):
        existing = self.made_file()
        pk = self.made(type="p1-research-report")
        self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        entry = SubmissionEntry.objects.get()
        self.assertEqual((entry.document_id, entry.document.versions.count()), (existing, 2))

    def made_file(self):
        self.client.force_authenticate(self.bella.user)
        response = self.client.post("/api/documents/", {"type": "p1-research-report", "file": upload("p.pdf", pdf_bytes(4))}, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def test_the_student_to_do_counts_what_is_still_open(self):
        pk = self.made()
        self.client.force_authenticate(self.bella.user)
        before = self.client.get("/api/documents/summary/").data["toDo"]
        self.hand_in(self.bella, pk)
        self.client.force_authenticate(self.bella.user)
        self.assertEqual(self.client.get("/api/documents/summary/").data["toDo"], before - 1)


@TEST_MEDIA
class RemindAndHistoryTests(SubmissionBase):
    def test_remind_once_a_day_and_only_those_still_missing(self):
        pk = self.made()
        Notification.objects.all().delete()
        self.client.force_authenticate(self.coordinator)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.post(f"{BASE}{pk}/remind/").data["sent"], 1)
        self.assertEqual(Notification.objects.filter(recipient=self.bella.user).count(), 1)
        self.assertEqual(self.client.post(f"{BASE}{pk}/remind/").status_code, 409)
        self.assertTrue(self.detail(pk)["remindedToday"])

    def test_nobody_to_remind(self):
        pk = self.made()
        self.hand_in(self.bella, pk)
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.post(f"{BASE}{pk}/remind/").status_code, 409)

    def test_history_cannot_be_changed(self):
        self.made()
        change = SubmissionChange.objects.get()
        with self.assertRaises(Exception):
            change.save()
        with self.assertRaises(Exception):
            change.delete()

    def test_only_students_use_their_own_list(self):
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.get(f"{BASE}mine/").status_code, 403)
        pk = self.made()
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.post(f"{BASE}{pk}/send/", {"file": upload("r.pdf", pdf_bytes())}, format="multipart").status_code, 403)


@TEST_MEDIA
class UploadStageTests(SubmissionBase):
    def test_a_student_is_told_their_stage_so_their_documents_come_first(self):
        self.client.force_authenticate(self.bella.user)
        self.assertEqual(self.client.get("/api/documents/options/").data["me"]["stage"], "P1")
        ProjectRegistration.objects.create(student=self.bella, academic_semester=self.semester, stage="P2", source="COORDINATOR", confirmed_by=self.coordinator)
        self.assertEqual(self.client.get("/api/documents/options/").data["me"]["stage"], "P2")
        self.client.force_authenticate(self.chen.user)
        self.assertEqual(self.client.get("/api/documents/options/").data["me"]["stage"], "")


@TEST_MEDIA
class NewFileTypeTests(SubmissionBase):
    def labels(self, user):
        self.client.force_authenticate(user)
        if hasattr(user, "student"):
            return {row["label"]: row["custom"] for row in self.client.get("/api/documents/options/").data["types"]}
        return [row["label"] for row in self.client.get(BASE).data["options"]["types"]]

    def test_a_coordinator_adds_a_file_type_when_setting_up_a_submission(self):
        pk = self.made(type="", newType="  Ethics   approval form ")
        added = DocumentType.objects.get(label="Ethics approval form")
        self.assertEqual((added.custom, added.added_by, added.group, added.one_per_student), (True, self.coordinator, "SUPPORTING", False))
        self.assertEqual((added.share_supervisors, added.share_panel, added.share_coordinator), (True, False, True))
        self.assertEqual(self.detail(pk)["type"]["label"], "Ethics approval form")
        self.assertIn("Ethics approval form", self.labels(self.coordinator))
        self.assertTrue(self.labels(self.bella.user)["Ethics approval form"])
        self.assertFalse(self.labels(self.bella.user)["P1 Research Report"])
        self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        self.assertEqual(Document.objects.get(doc_type=added).title, "RP2 final report")

    def test_rp1_and_rp2_types_go_with_that_stage_and_the_panel_sees_them(self):
        self.made(type="", newType="Progress slides", stage="P1")
        self.made(type="", newType="Poster", stage="P2")
        self.assertEqual(
            list(DocumentType.objects.filter(custom=True).order_by("label").values_list("label", "group", "share_panel")),
            [("Poster", "RP2", True), ("Progress slides", "RP1", True)],
        )

    def test_the_same_name_in_any_case_is_the_same_type(self):
        self.made(type="", newType="Ethics form")
        self.made(type="", newType="ETHICS FORM")
        self.made(type="", newType="final research report")
        self.assertEqual(list(DocumentType.objects.filter(custom=True).values_list("label", flat=True)), ["Ethics form"])
        self.assertEqual(Submission.objects.filter(doc_type__code="final-research-report").count(), 1)

    def test_names_that_cannot_be_used(self):
        before = DocumentType.objects.count()
        self.assertIn("newType", self.make(type="", newType="Staff Document").data)
        self.assertIn("newType", self.make(type="", newType="x").data)
        self.assertIn("newType", self.make(type="", newType="a" * 81).data)
        DocumentType.objects.filter(code="turnitin-report").update(is_active=False)
        self.assertIn("newType", self.make(type="", newType="Turnitin report").data)
        self.assertEqual(DocumentType.objects.count(), before)

    def test_a_misspelt_type_leaves_the_lists_when_the_submission_is_corrected(self):
        pk = self.made(type="", newType="Ethcs form")
        self.assertEqual(self.edit(pk, type="", newType="Ethics form").status_code, 200)
        self.assertEqual(self.detail(pk)["type"]["label"], "Ethics form")
        self.assertFalse(DocumentType.objects.get(label="Ethcs form").is_active)
        self.assertNotIn("Ethcs form", self.labels(self.coordinator))
        self.assertNotIn("Ethcs form", self.labels(self.bella.user))
        self.made(type="", newType="ethcs form")
        self.assertTrue(DocumentType.objects.get(label="Ethcs form").is_active)
        self.assertEqual(DocumentType.objects.filter(label__iexact="ethcs form").count(), 1)

    def test_the_type_follows_who_must_send_it_until_files_arrive(self):
        pk = self.made(type="", newType="Progress slides", stage="P1")
        self.assertEqual(self.edit(pk, stage="ALL").status_code, 200)
        added = DocumentType.objects.get(label="Progress slides")
        self.assertEqual((added.group, added.share_panel), ("SUPPORTING", False))
        self.hand_in(self.bella, pk)
        self.assertEqual(self.edit(pk, stage="P1").status_code, 200)
        added.refresh_from_db()
        self.assertEqual((added.group, added.share_panel), ("SUPPORTING", False))

    def test_a_type_in_use_stays_when_one_submission_moves_away(self):
        first = self.made(type="", newType="Ethics form")
        self.made(type="", newType="Ethics form", title="Ethics form again")
        self.assertEqual(self.edit(first, type="p1-research-report").status_code, 200)
        self.assertTrue(DocumentType.objects.get(label="Ethics form").is_active)
        self.assertTrue(DocumentType.objects.get(code="p1-research-report").is_active)

    def test_nothing_is_added_when_the_change_is_refused(self):
        pk = self.made()
        self.hand_in(self.bella, pk)
        self.assertEqual(self.edit(pk, type="", newType="Another form").status_code, 409)
        self.assertFalse(DocumentType.objects.filter(label="Another form").exists())


@TEST_MEDIA
class InstructionsAndOpeningTests(SubmissionBase):
    def test_instructions_reach_the_student_and_the_email(self):
        text = "Use the faculty template.\nInclude the Turnitin report."
        with mock.patch("documents.submissions.email_users") as emailed:
            pk = self.made(instructions=f"  {text}  ")
        self.assertEqual(self.detail(pk)["instructions"], text)
        self.assertEqual(self.card(self.bella, pk)["instructions"], text)
        self.assertIn(text, emailed.call_args.args[3])

    def test_instructions_have_a_limit(self):
        self.assertIn("instructions", self.make(instructions="x" * 2001).data)

    def test_nobody_can_send_before_it_opens(self):
        opens = self.due - timedelta(days=3)
        pk = self.made(opensAt=opens.isoformat())
        with at(opens - timedelta(seconds=1)):
            card = self.card(self.bella, pk)
            self.assertEqual((card["canSend"], card["lateIfSentNow"]), (False, False))
            self.assertTrue(card["why"].startswith("Opens "))
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 409)
            self.assertTrue(self.detail(pk)["notOpenYet"])
        with at(opens):
            self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        self.assertEqual(self.row(pk, "DOC-S2")["state"], "ON_TIME")

    def test_the_students_are_told_when_it_opens(self):
        opens = timezone.now() + timedelta(days=2)
        pk = self.made(opensAt=opens.isoformat())
        message = Notification.objects.get(recipient=self.bella.user, record_id=str(pk)).message
        self.assertIn("opens on", message)

    def test_it_must_open_before_the_due_date(self):
        self.assertIn("opensAt", self.make(opensAt=self.due.isoformat()).data)
        self.assertIn("opensAt", self.make(opensAt="soon").data)

    def test_nothing_is_counted_or_reminded_before_it_opens(self):
        pk = self.made(opensAt=(timezone.now() + timedelta(days=2)).isoformat())
        self.client.force_authenticate(self.bella.user)
        self.assertEqual(self.client.get("/api/documents/summary/").data["toDo"], 0)
        self.client.force_authenticate(self.coordinator)
        refused = self.client.post(f"{BASE}{pk}/remind/")
        self.assertEqual(refused.status_code, 409)
        self.assertIn("not open yet", refused.data["detail"])

    def test_changing_the_opening_date_and_clearing_it(self):
        pk = self.made(opensAt=(timezone.now() + timedelta(days=2)).isoformat())
        self.assertEqual(self.edit(pk, opensAt=None, instructions="Name it Matric_RP2.pdf").status_code, 200)
        data = self.detail(pk)
        self.assertEqual((data["opensAt"], data["notOpenYet"], data["instructions"]), (None, False, "Name it Matric_RP2.pdf"))
        change = SubmissionChange.objects.filter(action="CHANGED").get()
        self.assertEqual(change.details["after"]["instructions"], "Name it Matric_RP2.pdf")
        self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
