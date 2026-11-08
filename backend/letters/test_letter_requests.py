"""Letter requests with office approval (UC23).

A student asks for a letter; the office fills in what the record lacks and
approves it, which issues the reference number, or rejects it with a reason.
"""

import io
from datetime import date
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from pypdf import PdfReader
from pypdf.constants import UserAccessPermissions
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Student, StudentRegistry
from announcements.models import Notification

from . import request_views
from .models import GeneratedLetter, LetterReferenceCounter, LetterTemplate

User = get_user_model()
PASSWORD = "Letters-pass-7702!"
REQUESTS = "/api/letters/requests/"


def make_student(matric_no, *, student_status=Student.Status.ACTIVE, registry=True, email_alerts=False):
    user = User.objects.create_user(
        email=f"{matric_no.lower()}@example.test",
        password=PASSWORD,
        full_name=f"Student {matric_no}",
        role=User.Role.STUDENT,
        email_notifications=email_alerts,
    )
    student = Student.objects.create(
        user=user,
        matric_no=matric_no,
        programme="Master of Computer Science",
        status=student_status,
        intake_semester="Semester 1 2025/2026",
    )
    if registry:
        StudentRegistry.objects.create(
            student=student,
            passport_number="A1234567",
            nationality="Malaysia",
            current_semester="3",
            max_semester="8",
            expected_completion="2027",
        )
    return user


def make_user(email, role):
    return User.objects.create_user(email=email, password=PASSWORD, full_name=email, role=role)


class LetterRequestTestCase(APITestCase):
    def setUp(self):
        self.office = make_user("office.letters@example.test", User.Role.OFFICE_ADMIN)
        self.template = LetterTemplate.objects.create(
            name="Visa Support Letter",
            letter_type="Visa & Immigration",
            status=LetterTemplate.Status.ACTIVE,
            reference_prefix="UMF/PG/VISA",
            content=(
                "Dear Sir/Madam,\n\nThis is to confirm that **{{STUDENT_NAME}}** "
                "({{STUDENT_ID}}) is registered.\n\n- Passport: {{PASSPORT_NUMBER}}\n"
                "- Attendance: {{ATTENDANCE}}\n- Our ref: {{REFERENCE_NUMBER}} dated {{CURRENT_DATE}}"
            ),
            custom_fields=[{"name": "ATTENDANCE", "label": "Attendance (%)", "hint": "From the attendance system"}],
        )
        self.year = timezone.localdate().year

    def ask(self, user, template=None, note=""):
        self.client.force_authenticate(user)
        return self.client.post(
            REQUESTS, {"templateId": (template or self.template).pk, "note": note}, format="json"
        )

    def approve(self, request_id, values=None, user=None):
        self.client.force_authenticate(user or self.office)
        return self.client.post(f"{REQUESTS}{request_id}/approve/", {"values": values or {}}, format="json")

    def reject(self, request_id, reason="", user=None):
        self.client.force_authenticate(user or self.office)
        return self.client.post(f"{REQUESTS}{request_id}/reject/", {"reason": reason}, format="json")

    def issue(self, user, template=None):
        """Ask for a letter and approve it, filling the attendance."""
        request_id = self.ask(user, template).data["id"]
        return self.approve(request_id, {"ATTENDANCE": "92%"})


class AskingForALetterTests(LetterRequestTestCase):
    def test_a_request_waits_for_the_office_with_no_number_or_wording(self):
        other_office = make_user("office.two@example.test", User.Role.OFFICE_ADMIN)
        retired_office = make_user("office.gone@example.test", User.Role.OFFICE_ADMIN)
        User.objects.filter(pk=retired_office.pk).update(is_active=False)
        student = make_student("LTR001")

        response = self.ask(student, note="For my embassy appointment on 3 Nov")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "Pending")
        self.assertEqual(response.data["referenceNumber"], "")
        self.assertEqual(response.data["date"], "")
        self.assertEqual(response.data["note"], "For my embassy appointment on 3 Nov")
        self.assertNotIn("content", response.data)
        self.assertFalse(LetterReferenceCounter.objects.exists())
        notified = Notification.objects.filter(event_key=f"letters:request-new:{response.data['id']}")
        self.assertCountEqual([n.recipient for n in notified], [self.office, other_office])
        first = notified.first()
        self.assertEqual((first.target_module, first.record_type), ("LETTERS", "LETTER_REQUEST"))
        self.assertIn("embassy appointment", first.message)
        self.assertFalse(Notification.objects.filter(recipient=student).exists())

    def test_the_student_never_gets_the_wording_while_pending(self):
        student = make_student("LTR002")
        request_id = self.ask(student).data["id"]
        self.client.force_authenticate(student)
        self.assertNotIn("content", self.client.get(f"{REQUESTS}{request_id}/").data)
        self.assertNotIn("content", self.client.get(REQUESTS).data[0])
        self.assertNotIn("templateContent", self.client.get(f"{REQUESTS}{request_id}/").data)

    def test_one_pending_request_per_letter_until_it_is_settled(self):
        student = make_student("LTR003")
        first = self.ask(student).data["id"]
        again = self.ask(student)
        self.assertEqual(again.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(again.data["code"], "letter_request_pending")

        other = LetterTemplate.objects.create(
            name="Confirmation of Study", status=LetterTemplate.Status.ACTIVE, content="For {{STUDENT_NAME}}"
        )
        self.assertEqual(self.ask(student, other).status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(student)
        self.client.post(f"{REQUESTS}{first}/withdraw/")
        self.assertEqual(self.ask(student).status_code, status.HTTP_201_CREATED)

    def test_the_note_is_optional_and_short(self):
        student = make_student("LTR004")
        self.assertEqual(self.ask(student, note="x" * 501).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.ask(student).data["note"], "")

    def test_only_active_valid_templates_can_be_requested(self):
        student = make_student("LTR005")
        for template_status in (LetterTemplate.Status.DRAFT, LetterTemplate.Status.ARCHIVED):
            with self.subTest(status=template_status):
                hidden = LetterTemplate.objects.create(
                    name=f"{template_status} letter", status=template_status, content="For {{STUDENT_NAME}}"
                )
                self.assertEqual(self.ask(student, hidden).status_code, status.HTTP_404_NOT_FOUND)
        broken = LetterTemplate.objects.create(
            name="Old letter", status=LetterTemplate.Status.ACTIVE, content="Dear {{STUDNET_NAME}}"
        )
        self.assertEqual(self.ask(student, broken).status_code, status.HTTP_409_CONFLICT)
        self.client.force_authenticate(student)
        self.assertEqual(
            self.client.post(REQUESTS, {"templateId": 999999}, format="json").status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(
            self.client.post(REQUESTS, {"templateId": "abc"}, format="json").status_code, status.HTTP_400_BAD_REQUEST
        )
        self.assertFalse(GeneratedLetter.objects.exists())

    def test_only_active_students_can_ask(self):
        response = self.ask(make_student("LTR006", student_status=Student.Status.DEFERRED))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "letters_need_active_status")
        for role in (User.Role.OFFICE_ADMIN, User.Role.COORDINATOR, User.Role.LECTURER):
            with self.subTest(role=role):
                user = make_user(f"{role.split()[0].lower()}.ask@example.test", role)
                self.assertEqual(self.ask(user).status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(GeneratedLetter.objects.exists())

    def test_a_student_can_withdraw_only_their_own_pending_request(self):
        mine, theirs = make_student("LTR007"), make_student("LTR008")
        request_id = self.ask(mine).data["id"]
        path = f"{REQUESTS}{request_id}/withdraw/"

        self.client.force_authenticate(theirs)
        self.assertEqual(self.client.post(path).status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.post(path).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(mine)
        response = self.client.post(path)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "Withdrawn")
        self.assertIsNotNone(response.data["withdrawnAt"])
        self.assertEqual(self.client.post(path).status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.approve(request_id, {"ATTENDANCE": "90%"}).status_code, status.HTTP_409_CONFLICT)


class OfficeReviewTests(LetterRequestTestCase):
    def test_the_office_sees_every_value_the_letter_needs(self):
        request_id = self.ask(make_student("LTR010", registry=False)).data["id"]
        self.client.force_authenticate(self.office)
        data = self.client.get(f"{REQUESTS}{request_id}/").data

        self.assertIn("{{ATTENDANCE}}", data["templateContent"])
        self.assertIsNone(data["problem"])
        fields = {field["name"]: field for field in data["fields"]}
        self.assertEqual(list(fields), ["STUDENT_NAME", "STUDENT_ID", "PASSPORT_NUMBER", "ATTENDANCE"])
        self.assertEqual(
            (fields["STUDENT_NAME"]["value"], fields["STUDENT_NAME"]["needed"], fields["STUDENT_NAME"]["source"]),
            ("Student LTR010", False, "record"),
        )
        self.assertEqual((fields["PASSPORT_NUMBER"]["value"], fields["PASSPORT_NUMBER"]["needed"]), ("", True))
        self.assertEqual(
            (fields["ATTENDANCE"]["source"], fields["ATTENDANCE"]["needed"], fields["ATTENDANCE"]["label"]),
            ("office", True, "Attendance (%)"),
        )

    def test_approval_needs_every_missing_value_on_one_short_line(self):
        request_id = self.ask(make_student("LTR011", registry=False)).data["id"]

        response = self.approve(request_id, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(sorted(response.data["fieldErrors"]), ["ATTENDANCE", "PASSPORT_NUMBER"])
        response = self.approve(request_id, {"ATTENDANCE": "92%\nmore", "PASSPORT_NUMBER": "x" * 301})
        self.assertEqual(response.data["fieldErrors"]["ATTENDANCE"], "Keep it on one line.")
        self.assertIn("300", response.data["fieldErrors"]["PASSPORT_NUMBER"])
        self.assertFalse(LetterReferenceCounter.objects.exists())
        self.assertEqual(GeneratedLetter.objects.get().status, "Pending")

    def test_approving_issues_the_filled_letter_and_tells_the_student(self):
        student = make_student("LTR012", registry=False, email_alerts=True)
        request_id = self.ask(student).data["id"]

        with self.captureOnCommitCallbacks(execute=True):
            response = self.approve(request_id, {"ATTENDANCE": " 92% ", "PASSPORT_NUMBER": "K7654321"})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        reference = f"UMF/PG/VISA/{self.year}/0001"
        self.assertEqual(response.data["status"], "Issued")
        self.assertEqual(response.data["referenceNumber"], reference)
        self.assertEqual(response.data["decidedBy"], "office.letters@example.test")
        content = response.data["content"]
        for expected in ("**Student LTR012**", "(LTR012)", "Passport: K7654321", "Attendance: 92%", reference):
            self.assertIn(expected, content)
        self.assertNotIn("{{", content)
        letter = GeneratedLetter.objects.get()
        self.assertEqual(letter.office_values, {"PASSPORT_NUMBER": "K7654321", "ATTENDANCE": "92%"})
        self.assertEqual(letter.student_data["referenceNumber"], reference)
        self.assertEqual(letter.issued_on, timezone.localdate())

        notice = Notification.objects.get(recipient=student)
        self.assertEqual(notice.event_key, f"letters:request-approved:{request_id}")
        self.assertEqual((notice.target_module, notice.record_type, notice.record_id), ("LETTERS", "GENERATED_LETTER", request_id))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [student.email])
        self.assertIn(reference, mail.outbox[0].body)

        self.client.force_authenticate(student)
        self.assertIn("Attendance: 92%", self.client.get(f"{REQUESTS}{request_id}/").data["content"])

    def test_no_email_when_the_student_has_email_alerts_off(self):
        request_id = self.ask(make_student("LTR013")).data["id"]
        with self.captureOnCommitCallbacks(execute=True):
            self.approve(request_id, {"ATTENDANCE": "88%"})
        self.assertEqual(len(mail.outbox), 0)

    def test_approval_uses_the_record_and_wording_of_that_moment(self):
        student = make_student("LTR014")
        request_id = self.ask(student).data["id"]
        StudentRegistry.objects.filter(student__user=student).update(passport_number="NEW99999")
        LetterTemplate.objects.filter(pk=self.template.pk).update(
            content="Updated: {{STUDENT_NAME}}, {{PASSPORT_NUMBER}}, {{ATTENDANCE}}", status=LetterTemplate.Status.ARCHIVED
        )
        response = self.approve(request_id, {"ATTENDANCE": "95%"})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["content"], "Updated: Student LTR014, NEW99999, 95%")

    def test_rejecting_needs_a_reason_and_tells_the_student(self):
        student = make_student("LTR015", email_alerts=True)
        request_id = self.ask(student).data["id"]

        self.assertEqual(self.reject(request_id, "  ").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.reject(request_id, "x" * 501).status_code, status.HTTP_400_BAD_REQUEST)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.reject(request_id, "Your attendance is below 80%.")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "Rejected")
        self.assertEqual(response.data["rejectReason"], "Your attendance is below 80%.")
        self.assertFalse(LetterReferenceCounter.objects.exists())

        notice = Notification.objects.get(recipient=student, event_key=f"letters:request-rejected:{request_id}")
        self.assertIn("below 80%", notice.message)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("below 80%", mail.outbox[0].body)

        self.client.force_authenticate(student)
        detail = self.client.get(f"{REQUESTS}{request_id}/").data
        self.assertEqual(detail["rejectReason"], "Your attendance is below 80%.")
        self.assertNotIn("content", detail)
        self.assertEqual(self.client.get(f"{REQUESTS}{request_id}/pdf/").status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.ask(student).status_code, status.HTTP_201_CREATED, "they can ask again")

    def test_a_decided_request_cannot_be_decided_again(self):
        request_id = self.ask(make_student("LTR016")).data["id"]
        self.assertEqual(self.approve(request_id, {"ATTENDANCE": "90%"}).status_code, status.HTTP_200_OK)
        self.assertEqual(self.approve(request_id, {"ATTENDANCE": "91%"}).status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.reject(request_id, "Late").status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(LetterReferenceCounter.objects.get().last_number, 1)

    def test_only_office_staff_review(self):
        student = make_student("LTR017")
        request_id = self.ask(student).data["id"]
        for user in (student, make_user("coord.review@example.test", User.Role.COORDINATOR),
                     make_user("lect.review@example.test", User.Role.LECTURER)):
            with self.subTest(user=user.email):
                self.assertEqual(self.approve(request_id, {"ATTENDANCE": "9"}, user).status_code, status.HTTP_403_FORBIDDEN)
                self.assertEqual(self.reject(request_id, "No", user).status_code, status.HTTP_403_FORBIDDEN)

    def test_approval_is_refused_when_the_student_is_no_longer_active(self):
        student = make_student("LTR018")
        request_id = self.ask(student).data["id"]
        Student.objects.filter(user=student).update(status=Student.Status.DEFERRED)
        response = self.approve(request_id, {"ATTENDANCE": "90%"})
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Deferred", response.data["detail"])
        self.assertEqual(self.reject(request_id, "Deferred this semester.").status_code, status.HTTP_200_OK)

    def test_a_template_with_pending_requests_cannot_be_deleted(self):
        request_id = self.ask(make_student("LTR019")).data["id"]
        self.client.force_authenticate(self.office)
        response = self.client.delete(f"/api/letter-templates/{self.template.pk}/")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("1 request for this letter is waiting", response.data["detail"])
        self.reject(request_id, "Not needed")
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.delete(f"/api/letter-templates/{self.template.pk}/").status_code, 204)


class RegisterAndListTests(LetterRequestTestCase):
    def test_reference_numbers_are_sequential_per_prefix_and_year(self):
        first = self.issue(make_student("LTR020")).data["referenceNumber"]
        second = self.issue(make_student("LTR021")).data["referenceNumber"]
        other = LetterTemplate.objects.create(
            name="Enrolment", status=LetterTemplate.Status.ACTIVE, reference_prefix="UMF/PG/ENR",
            content="For {{STUDENT_NAME}}",
        )
        enrolment = self.approve(self.ask(make_student("LTR022"), other).data["id"]).data["referenceNumber"]
        LetterTemplate.objects.filter(pk=other.pk).update(reference_prefix="UMF/PG/VISA/")
        slashed = self.approve(self.ask(make_student("LTR023"), other).data["id"]).data["referenceNumber"]
        request_id = self.ask(make_student("LTR024")).data["id"]
        with mock.patch.object(request_views.timezone, "localdate", return_value=date(2031, 1, 2)):
            next_year = self.approve(request_id, {"ATTENDANCE": "90%"}).data["referenceNumber"]

        self.assertEqual(first, f"UMF/PG/VISA/{self.year}/0001")
        self.assertEqual(second, f"UMF/PG/VISA/{self.year}/0002")
        self.assertEqual(enrolment, f"UMF/PG/ENR/{self.year}/0001")
        self.assertEqual(slashed, f"UMF/PG/VISA/{self.year}/0003")
        self.assertEqual(next_year, "UMF/PG/VISA/2031/0001")

    def test_students_only_see_their_own_requests(self):
        mine, theirs = make_student("LTR030"), make_student("LTR031")
        own_id = self.ask(mine).data["id"]
        other_id = self.issue(theirs).data["id"]

        self.client.force_authenticate(mine)
        listed = self.client.get(REQUESTS).data
        self.assertEqual([row["id"] for row in listed], [own_id])
        for path in (f"{REQUESTS}{other_id}/", f"{REQUESTS}{other_id}/pdf/"):
            self.assertEqual(self.client.get(path).status_code, status.HTTP_404_NOT_FOUND, path)

    def test_office_filters_by_status_search_and_issue_date(self):
        issued = self.issue(make_student("LTR040")).data
        pending = self.ask(make_student("LTR041")).data
        rejected = self.ask(make_student("LTR042")).data
        self.reject(rejected["id"], "No")
        GeneratedLetter.objects.filter(pk=issued["id"]).update(issued_on=date(2025, 3, 1))

        self.client.force_authenticate(self.office)
        ids = lambda params: [row["id"] for row in self.client.get(REQUESTS, params).data]  # noqa: E731
        self.assertEqual(len(ids({})), 3)
        self.assertEqual(ids({"status": "pending"}), [pending["id"]])
        self.assertCountEqual(ids({"status": "Issued,Rejected"}), [issued["id"], rejected["id"]])
        self.assertEqual(ids({"search": "ltr041"}), [pending["id"]])
        self.assertEqual(ids({"search": issued["referenceNumber"]}), [issued["id"]])
        self.assertEqual(ids({"from": "2025-01-01", "to": "2025-12-31"}), [issued["id"]])
        self.assertEqual(self.client.get(REQUESTS, {"status": "Lost"}).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.get(REQUESTS, {"from": "01/03/2025"}).status_code, status.HTTP_400_BAD_REQUEST)

        counts = self.client.get(f"{REQUESTS}counts/").data
        self.assertEqual(counts, {"Pending": 1, "Issued": 1, "Rejected": 1, "Withdrawn": 0, "Revoked": 0})
        for role in (User.Role.COORDINATOR, User.Role.LECTURER, User.Role.STUDENT):
            with self.subTest(role=role):
                self.client.force_authenticate(make_user(f"{role.split()[0].lower()}.list@example.test", role))
                self.assertEqual(self.client.get(f"{REQUESTS}counts/").status_code, status.HTTP_403_FORBIDDEN)

    def test_the_pdf_is_only_for_issued_letters_and_locked(self):
        student = make_student("LTR050")
        pending_id = self.ask(student).data["id"]
        self.client.force_authenticate(student)
        self.assertEqual(self.client.get(f"{REQUESTS}{pending_id}/pdf/").status_code, status.HTTP_409_CONFLICT)

        letter = self.approve(pending_id, {"ATTENDANCE": "92%"}).data
        for user in (student, self.office):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user)
                response = self.client.get(f"{REQUESTS}{letter['id']}/pdf/")
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response["Content-Type"], "application/pdf")
                self.assertIn('filename="UM_Visa_Support_Letter_LTR050.pdf"', response["Content-Disposition"])
                reader = PdfReader(io.BytesIO(response.content))
                self.assertTrue(reader.is_encrypted)
                reader.decrypt("")
                text = "".join(page.extract_text() for page in reader.pages)
                self.assertIn(letter["referenceNumber"], text)
                self.assertIn("Attendance: 92%", text)
                self.assertNotIn("**", text)
                permissions = reader.user_access_permissions
                self.assertFalse(permissions & UserAccessPermissions.MODIFY, "it cannot be edited")
                self.assertTrue(permissions & UserAccessPermissions.PRINT, "it can be printed")

    def test_resend_and_revoke_are_office_only_and_for_issued_letters(self):
        student = make_student("LTR060")
        pending_id = self.ask(student).data["id"]
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.post(f"{REQUESTS}{pending_id}/resend-notification/").status_code, 409)
        self.assertEqual(self.client.post(f"{REQUESTS}{pending_id}/revoke/", {"reason": "x"}, format="json").status_code, 409)

        letter_id = self.approve(pending_id, {"ATTENDANCE": "90%"}).data["id"]
        resend = f"{REQUESTS}{letter_id}/resend-notification/"
        for user in (student, make_user("coord.resend@example.test", User.Role.COORDINATOR)):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post(resend).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.post(resend).status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(recipient=student).count(), 2)

        revoke = f"{REQUESTS}{letter_id}/revoke/"
        self.assertEqual(self.client.post(revoke, {"reason": " "}, format="json").status_code, 400)
        response = self.client.post(revoke, {"reason": "Issued with the wrong programme."}, format="json")
        self.assertEqual(response.data["status"], "Revoked")
        self.assertEqual(self.client.post(revoke, {"reason": "Again"}, format="json").status_code, 409)
        self.client.force_authenticate(student)
        detail = self.client.get(f"{REQUESTS}{letter_id}/").data
        self.assertEqual(detail["revokeReason"], "Issued with the wrong programme.")
        self.assertNotIn("content", detail)
        self.assertEqual(self.client.get(f"{REQUESTS}{letter_id}/pdf/").status_code, status.HTTP_409_CONFLICT)

    def test_letters_need_an_active_status_to_be_seen(self):
        student = make_student("LTR070")
        letter_id = self.issue(student).data["id"]
        Student.objects.filter(user=student).update(status=Student.Status.WITHDRAWN)
        student.refresh_from_db()

        self.client.force_authenticate(student)
        for path in (REQUESTS, f"{REQUESTS}{letter_id}/", f"{REQUESTS}{letter_id}/pdf/"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, path)
            self.assertEqual(response.data["code"], "letters_need_active_status")
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.get(f"{REQUESTS}{letter_id}/pdf/").status_code, status.HTTP_200_OK)

    def test_the_register_keeps_letters_when_an_account_is_removed(self):
        student = make_student("LTR080")
        letter_id = self.issue(student).data["id"]
        pending_id = self.ask(make_student("LTR081")).data["id"]
        student.delete()
        User.objects.get(email="ltr081@example.test").delete()

        self.client.force_authenticate(self.office)
        rows = {row["id"]: row for row in self.client.get(REQUESTS).data}
        self.assertEqual(rows[letter_id]["matricNumber"], "LTR080")
        self.assertEqual(self.client.post(f"{REQUESTS}{letter_id}/resend-notification/").status_code, 409)
        review = self.client.get(f"{REQUESTS}{pending_id}/").data
        self.assertEqual(review["problem"], "The student's account no longer exists.")
        self.assertEqual(self.approve(pending_id, {"ATTENDANCE": "90%"}).status_code, status.HTTP_409_CONFLICT)
