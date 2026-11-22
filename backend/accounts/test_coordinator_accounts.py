"""Coordinator accounts made from a lecturer: the +coordinator sign-in email,
mail delivered to the lecturer's own inbox, and the two accounts kept together."""
from types import SimpleNamespace

from django.core import mail
from django.core.cache import cache
from django.core.mail import EmailMessage
from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from announcements.emails import ANNOUNCEMENT, email_users

from .account_emails import ACTIVATION_SUBJECT, EMAIL_CHANGED_SUBJECT
from .coordinator_alias import alias_email, real_address
from .models import AccountChange, Lecturer, OfficeStaff, User
from .participant_lifecycle import ParticipantLifecycleConflict, transition_lecturer
from .programmes import APPROVED_PROGRAMMES

STAFF = "/api/registry/staff/"
DS, CS, AI = APPROVED_PROGRAMMES
REAL_INBOX = override_settings(
    EMAIL_BACKEND="accounts.mail_backend.RealInboxBackend",
    REAL_EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)


def detail(account, tail=""):
    return f"{STAFF}{account.pk}/{tail}"


class AliasAddressTests(SimpleTestCase):
    def test_the_alias_and_its_real_inbox(self):
        self.assertEqual(alias_email("AisyahZulzaidi@UM.edu.my"), "aisyahzulzaidi+coordinator@um.edu.my")
        self.assertEqual(real_address("aisyahzulzaidi+coordinator@um.edu.my"), "aisyahzulzaidi@um.edu.my")
        self.assertEqual(real_address("Dr Aisyah <aisyah+coordinator@um.edu.my>"), "Dr Aisyah <aisyah@um.edu.my>")
        self.assertEqual(real_address("ali@um.edu.my"), "ali@um.edu.my")
        self.assertEqual(real_address("ali+news@um.edu.my"), "ali+news@um.edu.my")

    @REAL_INBOX
    def test_mail_to_an_alias_reaches_the_real_inbox_once(self):
        EmailMessage(
            "Hello",
            "Body",
            "office@example.test",
            ["ali+coordinator@um.edu.my", "ali@um.edu.my"],
            cc=["ALI@um.edu.my", "siti@um.edu.my"],
        ).send()
        self.assertEqual(mail.outbox[0].to, ["ali@um.edu.my"])
        self.assertEqual(mail.outbox[0].cc, ["siti@um.edu.my"])

    @REAL_INBOX
    def test_an_announcement_goes_to_each_inbox_once(self):
        def person(email):
            return SimpleNamespace(is_active=True, email=email, email_notifications=True, announcement_alerts=True)

        people = [person("ali@um.edu.my"), person("ali+coordinator@um.edu.my"), person("siti@um.edu.my")]
        self.assertEqual(email_users(people, ANNOUNCEMENT, "News", "Body"), 2)
        self.assertEqual(sorted(message.to[0] for message in mail.outbox), ["ali@um.edu.my", "siti@um.edu.my"])


class CoordinatorAccountTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user(
            email="alias-office@example.test",
            password="pw-office-5601",
            full_name="Alias Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(user=self.office, staff_no="SMOKE-AOFF-1", department="Postgraduate Office")
        self.owner = User.objects.create_user(
            email="ali@um.edu.my", password="pw-lect-5602", full_name="Dr. Ali", role=User.Role.LECTURER
        )
        Lecturer.objects.create(
            user=self.owner, staff_no="SMOKE-ALI-1", department="Department of Software Engineering", title="Dr."
        )
        self.client.force_authenticate(self.office)

    def make_coordinator(self, programme=DS):
        response = self.client.post(
            STAFF,
            {"role": User.Role.COORDINATOR, "lecturerId": str(self.owner.pk), "programme": programme},
            format="json",
        )
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), response.data)
        return User.objects.get(pk=response.data["account"]["id"])

    def actions(self, user):
        return list(AccountChange.objects.filter(account=user).order_by("created_at", "id"))

    @REAL_INBOX
    def test_the_activation_email_goes_to_the_real_inbox_and_names_the_account(self):
        alias = self.make_coordinator()
        self.assertEqual(alias.email, "ali+coordinator@um.edu.my")
        message = mail.outbox[0]
        self.assertEqual(message.subject, ACTIVATION_SUBJECT)
        self.assertEqual(message.to, ["ali@um.edu.my"])
        self.assertIn("Programme Coordinator account for you for the Master of Data Science (Coursework)", message.body)
        self.assertIn("separate from your lecturer account", message.body)
        self.assertIn("ali+coordinator@um.edu.my", message.body)
        self.assertNotIn("Staff ID", message.body)

    def test_each_account_signs_in_on_its_own(self):
        alias = self.make_coordinator()
        alias.set_password("pw-coord-5603")
        alias.save()
        client = APIClient()
        coordinator = client.post(
            "/api/auth/login/", {"identifier": "ali+coordinator@um.edu.my", "password": "pw-coord-5603"}, format="json"
        )
        self.assertEqual(coordinator.status_code, status.HTTP_200_OK, coordinator.data)
        self.assertEqual(coordinator.data["user"]["role"], User.Role.COORDINATOR)
        self.assertEqual(coordinator.data["user"]["staffId"], "SMOKE-ALI-1")
        lecturer = APIClient().post(
            "/api/auth/login/", {"identifier": "SMOKE-ALI-1", "password": "pw-lect-5602"}, format="json"
        )
        self.assertEqual(lecturer.status_code, status.HTTP_200_OK, lecturer.data)
        self.assertEqual(lecturer.data["user"]["role"], User.Role.LECTURER)

    @REAL_INBOX
    def test_the_coordinator_account_follows_the_lecturer(self):
        alias = self.make_coordinator()
        alias.set_password("pw-coord-5604")
        alias.save()
        mail.outbox.clear()
        response = self.client.patch(
            detail(self.owner),
            {
                "name": "Dr. Ali Hassan",
                "email": "ali.hassan@um.edu.my",
                "staffId": "SMOKE-ALI-2",
                "department": "Department of Information Systems",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        alias.refresh_from_db()
        self.assertEqual(alias.email, "ali.hassan+coordinator@um.edu.my")
        self.assertEqual(alias.full_name, "Dr. Ali Hassan")
        self.assertEqual(alias.lecturer.staff_no, "SMOKE-ALI-2-PC")
        self.assertEqual(alias.lecturer.department, "Department of Information Systems")
        self.assertEqual(
            [row.action for row in self.actions(alias)][-2:],
            [AccountChange.Action.DETAILS_EDITED, AccountChange.Action.EMAIL_CHANGED],
        )
        notices = [message for message in mail.outbox if message.subject == EMAIL_CHANGED_SUBJECT]
        self.assertEqual(len(notices), 2)
        self.assertEqual({message.to[0] for message in notices}, {"ali@um.edu.my"})
        self.assertTrue(any("Programme Coordinator account" in message.body for message in notices))

    def test_the_coordinator_account_is_not_edited_on_its_own(self):
        alias = self.make_coordinator()
        response = self.client.patch(detail(alias), {"name": "Someone Else"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("lecturer account", response.data["error"])
        duties = self.client.post(detail(alias, "duties/"), {"duties": ["Supervisor"]}, format="json")
        self.assertEqual(duties.status_code, status.HTTP_409_CONFLICT)

    def test_turning_off_the_lecturer_waits_for_the_programme_then_closes_both(self):
        alias = self.make_coordinator()
        blocked = self.client.post(detail(self.owner, "sign-in/"), {"on": False, "reason": "On leave."}, format="json")
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("managedProgrammes", [item["key"] for item in blocked.data["blockers"]])

        self.client.post(detail(alias, "programme/"), {"programme": ""}, format="json")
        done = self.client.post(detail(self.owner, "sign-in/"), {"on": False, "reason": "On leave."}, format="json")
        self.assertEqual(done.status_code, status.HTTP_200_OK, done.data)
        alias.refresh_from_db()
        self.assertFalse(alias.is_active)
        self.assertEqual(self.actions(alias)[-1].details["reason"], "The lecturer account was turned off: On leave.")

        again = self.client.post(detail(alias, "sign-in/"), {"on": True}, format="json")
        self.assertEqual(again.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("lecturer account first", again.data["error"])

    def test_retirement_waits_for_the_programme_then_closes_the_coordinator_account(self):
        alias = self.make_coordinator()
        transition_lecturer(staff_no="SMOKE-ALI-1", actor=self.office, target_status=Lecturer.Lifecycle.RETIRING, reason="Leaving soon.")
        with self.assertRaises(ParticipantLifecycleConflict):
            transition_lecturer(staff_no="SMOKE-ALI-1", actor=self.office, target_status=Lecturer.Lifecycle.RETIRED, reason="Retired.")
        with self.assertRaises(ValueError):
            transition_lecturer(staff_no="SMOKE-ALI-1-PC", actor=self.office, target_status=Lecturer.Lifecycle.RETIRING, reason="No.")

        self.client.post(detail(alias, "programme/"), {"programme": ""}, format="json")
        transition_lecturer(staff_no="SMOKE-ALI-1", actor=self.office, target_status=Lecturer.Lifecycle.RETIRED, reason="Retired.")
        self.owner.refresh_from_db()
        alias.refresh_from_db()
        self.assertFalse(self.owner.is_active)
        self.assertFalse(alias.is_active)
        self.assertEqual(self.actions(alias)[-1].details["reason"], "The lecturer has retired.")

    def test_lecturer_lists_and_the_picker(self):
        names = [row["name"] for row in self.client.get(f"{STAFF}options/").data["lecturers"]]
        self.assertEqual(names, ["Dr. Ali"])
        alias = self.make_coordinator()
        self.assertEqual(self.client.get(f"{STAFF}options/").data["lecturers"], [])

        records = self.client.get("/api/accounts/participants/?type=LECTURER").data
        staff_nos = [row.get("staffNo") or row.get("staffId") or row.get("id") for row in records["records"]]
        self.assertEqual(len(records["records"]), 1, staff_nos)
        self.assertEqual(records["summary"]["activeLecturers"], 1)

        self.client.post(detail(alias, "programme/"), {"programme": ""}, format="json")
        self.client.post(detail(alias, "sign-in/"), {"on": False, "reason": "Term ended."}, format="json")
        picker = self.client.get(f"{STAFF}options/").data["lecturers"]
        self.assertEqual([(row["name"], row["reopens"]) for row in picker], [("Dr. Ali", True)])

    def test_the_lecturer_is_deleted_only_after_the_coordinator_account(self):
        alias = self.make_coordinator()
        page = self.client.get(detail(self.owner)).data
        self.assertFalse(page["deletion"]["allowed"])
        self.assertIn("It has a Programme Coordinator account. Delete that account first.", page["deletion"]["reasons"])
        self.assertEqual(self.client.delete(detail(alias)).status_code, status.HTTP_204_NO_CONTENT)
        reasons = self.client.get(detail(self.owner)).data["deletion"]["reasons"]
        self.assertNotIn("It has a Programme Coordinator account. Delete that account first.", reasons)
