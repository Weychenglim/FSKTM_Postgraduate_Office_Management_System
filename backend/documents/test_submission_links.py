"""A file is linked to the submission it was sent for, so staff are warned before archiving it (FR-50, UC27)."""
from datetime import timedelta

from .fixtures import TEST_MEDIA, pdf_bytes, upload
from .models import SubmissionEntry, SubmissionExtension
from .test_submissions import SubmissionBase, at


@TEST_MEDIA
class SubmissionLinkTests(SubmissionBase):
    def sent(self, **body):
        pk = self.made(**body)
        self.assertEqual(self.hand_in(self.bella, pk).status_code, 201)
        return pk, SubmissionEntry.objects.get(submission_id=pk, student=self.bella).document_id

    def links(self, user, document_id):
        self.client.force_authenticate(user)
        response = self.client.get(f"/api/documents/{document_id}/")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["submissions"]

    def test_staff_see_which_submission_a_file_was_sent_for(self):
        pk, document_id = self.sent()
        link = {"id": pk, "title": "RP2 final report", "dueAt": self.due.isoformat(), "open": True, "student": "Bella Tan"}
        self.assertEqual(self.links(self.coordinator, document_id), [{**link, "canOpen": True}])
        self.assertEqual(self.links(self.office, document_id), [{**link, "canOpen": True}])
        self.assertEqual(self.links(self.supervisor, document_id), [{**link, "canOpen": False}])

    def test_the_student_is_not_shown_the_links(self):
        _pk, document_id = self.sent()
        self.assertEqual(self.links(self.bella.user, document_id), [])

    def test_a_file_sent_outside_a_submission_has_no_link(self):
        self.client.force_authenticate(self.bella.user)
        uploaded = self.client.post("/api/documents/", {"type": "p1-research-report", "file": upload("p.pdf", pdf_bytes(2))}, format="multipart")
        self.assertEqual(uploaded.status_code, 201, uploaded.data)
        self.assertEqual(self.links(self.coordinator, uploaded.data["id"]), [])

    def test_closed_says_the_student_cannot_send_again_and_an_extension_reopens_it(self):
        pk, document_id = self.sent()
        after = self.due + timedelta(seconds=1)
        with at(after):
            self.assertFalse(self.links(self.coordinator, document_id)[0]["open"])
        later = self.due + timedelta(days=3)
        SubmissionExtension.objects.create(submission_id=pk, student=self.bella, due_at=later, reason="Medical", granted_by=self.coordinator)
        with at(after):
            link = self.links(self.coordinator, document_id)[0]
        self.assertTrue(link["open"])
        self.assertEqual(link["dueAt"], later.isoformat())

    def test_a_switched_off_submission_is_closed(self):
        pk, document_id = self.sent()
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.post(f"/api/documents/submissions/{pk}/open/", {"open": False}, format="json").status_code, 200)
        self.assertFalse(self.links(self.coordinator, document_id)[0]["open"])

    def archive(self, document_id, **extra):
        self.client.force_authenticate(self.coordinator)
        return self.client.post(f"/api/documents/{document_id}/archive/", {"reason": "Uploaded by mistake.", **extra}, format="json")

    def test_archiving_a_sent_file_asks_first(self):
        pk, document_id = self.sent()
        refused = self.archive(document_id)
        self.assertEqual(refused.status_code, 409, refused.data)
        self.assertEqual(refused.data["code"], "sent_for_submission")
        self.assertEqual(refused.data["submissions"][0]["id"], pk)
        self.assertEqual(self.archive(document_id, confirmed=True).status_code, 200)

    def test_archiving_the_file_keeps_the_sent_record(self):
        pk, document_id = self.sent()
        sent_at = self.row(pk, "DOC-S2")["sentAt"]
        archived = self.archive(document_id, confirmed=True)
        self.assertEqual(archived.status_code, 200, archived.data)
        row = self.row(pk, "DOC-S2")
        self.assertEqual((row["state"], row["sentAt"], row["fileArchived"]), ("ON_TIME", sent_at, True))
        card = self.card(self.bella, pk)
        self.assertEqual((card["state"], card["sentAt"], card["fileArchived"], card["documentId"]), ("ON_TIME", sent_at, True, None))
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.post(f"/api/documents/{document_id}/restore/", {}, format="json").status_code, 200)
        row = self.row(pk, "DOC-S2")
        self.assertEqual((row["state"], row["fileArchived"]), ("ON_TIME", False))

    def test_after_archiving_the_student_can_send_a_new_file_while_open(self):
        pk, document_id = self.sent()
        self.archive(document_id, confirmed=True)
        self.assertEqual(self.hand_in(self.bella, pk, pages=3).status_code, 201)
        row = self.row(pk, "DOC-S2")
        self.assertFalse(row["fileArchived"])
        self.assertNotEqual(row["documentId"], document_id)
