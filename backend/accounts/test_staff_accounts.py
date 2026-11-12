"""Staff and lecturer accounts (UC03), phase S1: list, create, edit, links and history."""
from unittest import mock

from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .account_emails import ACTIVATION_SUBJECT, EMAIL_CHANGED_SUBJECT, RESET_SUBJECT
from .delegations import today
from .models import (
    AccountChange,
    Coordinator,
    Lecturer,
    OfficeStaff,
    Panel,
    Student,
    Supervisor,
    User,
)
from .programmes import APPROVED_PROGRAMMES
from .staff_accounts import FACULTY_DEPARTMENTS
from .tokens import ACTIVATION, activation_token_generator, password_link_kind

STAFF = "/api/registry/staff/"
DS, CS, AI = APPROVED_PROGRAMMES


def detail(account):
    return f"{STAFF}{account.pk}/"


class StaffAccountsBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user(
            email="staff-office@example.test",
            password="pw-office-5501",
            full_name="Staff Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(user=self.office, staff_no="SMOKE-OFF-001", department="Postgraduate Office")
        self.client.force_authenticate(self.office)

    def lecturer(self, key, name, *, role=User.Role.LECTURER, staff_no=None, programme=None, password="pw-lect-5502"):
        user = User.objects.create_user(
            email=f"{key}@example.test", password=password, full_name=name, role=role
        )
        lecturer = Lecturer.objects.create(
            user=user, staff_no=staff_no or f"SMOKE-{key.upper()}", department="Software Engineering"
        )
        if programme:
            Coordinator.objects.create(lecturer=lecturer, programme_managed=programme)
        return user

    def create(self, **fields):
        body = {
            "role": User.Role.LECTURER,
            "name": "Dr. New Lecturer",
            "email": "new.lecturer@example.test",
            "staffId": "SMOKE-LEC-100",
            "department": "Software Engineering",
            "duties": ["Supervisor"],
        }
        body.update(fields)
        return self.client.post(STAFF, body, format="json")

    def history(self, user):
        return list(AccountChange.objects.filter(account=user).order_by("created_at", "id"))


class CreateAccountTests(StaffAccountsBase):
    def test_lecturer_gets_a_lecturer_profile_and_the_chosen_duties(self):
        response = self.create(duties=["Panel", "Supervisor"], title="Dr.", researchArea="Data Mining")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        user = User.objects.get(email="new.lecturer@example.test")
        self.assertEqual(user.role, User.Role.LECTURER)
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.is_staff)
        self.assertEqual(user.lecturer.staff_no, "SMOKE-LEC-100")
        self.assertEqual(user.lecturer.title, "Dr.")
        self.assertEqual(user.lecturer.specialization, "Data Mining")
        self.assertTrue(Supervisor.objects.filter(lecturer=user.lecturer).exists())
        self.assertTrue(Panel.objects.filter(lecturer=user.lecturer).exists())
        account = response.data["account"]
        self.assertEqual(account["duties"], ["Supervisor", "Panel"])
        self.assertEqual(account["status"], "NOT_ACTIVATED")
        self.assertEqual(account["lifecycle"], "ACTIVE")
        self.assertEqual(response.data["activation"], "sent")

    def test_lecturer_without_duties_has_neither_role_row(self):
        response = self.create(duties=[])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lecturer = Lecturer.objects.get(staff_no="SMOKE-LEC-100")
        self.assertFalse(Supervisor.objects.filter(lecturer=lecturer).exists())
        self.assertFalse(Panel.objects.filter(lecturer=lecturer).exists())

    def test_office_account_gets_the_office_powers(self):
        response = self.create(
            role=User.Role.OFFICE_ADMIN, staffId="SMOKE-OFF-200", department="", duties=[], position="Assistant Registrar"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        user = User.objects.get(email="new.lecturer@example.test")
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.office_staff.staff_no, "SMOKE-OFF-200")
        self.assertEqual(user.office_staff.position, "Assistant Registrar")
        self.assertTrue(user.has_perm("marks.change_markentry"))
        self.assertFalse(Lecturer.objects.filter(user=user).exists())

    def test_coordinator_gets_a_lecturer_profile_and_the_programme(self):
        response = self.create(role=User.Role.COORDINATOR, duties=[], programme=AI)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        coordinator = Coordinator.objects.get(lecturer__staff_no="SMOKE-LEC-100")
        self.assertEqual(coordinator.programme_managed, AI)
        self.assertEqual(coordinator.appointed_date, today())
        self.assertEqual(response.data["account"]["programme"], AI)
        self.assertEqual(response.data["account"]["duties"], [])

    def test_a_lecturer_can_be_given_a_programme(self):
        response = self.create(programme=DS)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Lecturer.objects.get(staff_no="SMOKE-LEC-100").programme, DS)
        self.assertEqual(response.data["account"]["programme"], DS)
        self.assertFalse(Coordinator.objects.filter(lecturer__staff_no="SMOKE-LEC-100").exists())
        plain = self.create(email="plain.lecturer@example.test", staffId="SMOKE-LEC-101")
        self.assertEqual(plain.status_code, status.HTTP_201_CREATED, plain.data)
        self.assertEqual(plain.data["account"]["programme"], "")

    def test_role_rules(self):
        cases = [
            ({"role": User.Role.COORDINATOR, "duties": []}, "programme"),
            ({"role": User.Role.OFFICE_ADMIN, "duties": [], "programme": DS}, "programme"),
            ({"role": User.Role.COORDINATOR, "programme": DS, "duties": ["Panel"]}, "duties"),
            ({"role": User.Role.OFFICE_ADMIN, "duties": ["Supervisor"]}, "duties"),
            ({"role": User.Role.OFFICE_ADMIN, "duties": [], "title": "Dr."}, "title"),
            ({"role": User.Role.LECTURER, "position": "Clerk"}, "position"),
            ({"role": User.Role.LECTURER, "department": ""}, "department"),
            ({"role": User.TECHNICAL_ADMIN}, "role"),
            ({"role": User.Role.STUDENT}, "role"),
            ({"staffId": "SMOKE 1/2"}, "staffId"),
            ({"phone": "=1+1"}, "phone"),
            ({"name": "  "}, "name"),
        ]
        for fields, field in cases:
            with self.subTest(fields=fields):
                response = self.create(**fields)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
        self.assertFalse(User.objects.filter(email="new.lecturer@example.test").exists())

    def test_duplicate_email_ignores_letter_case_and_links_the_holder(self):
        holder = self.lecturer("holder", "Existing Holder")
        response = self.create(email="HOLDER@Example.test")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["email"], ["Another account already uses this email."])
        self.assertEqual(
            response.data["existing"]["email"],
            {"kind": "staff", "id": str(holder.pk), "name": "Existing Holder", "role": User.Role.LECTURER},
        )

    def test_duplicate_staff_id_is_checked_across_office_and_lecturers(self):
        response = self.create(staffId="smoke-off-001")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["staffId"], ["Another account already uses this Staff ID."])
        self.assertEqual(response.data["existing"]["staffId"]["id"], str(self.office.pk))

        self.lecturer("taken", "Taken Lecturer", staff_no="SMOKE-TAKEN-1")
        response = self.create(role=User.Role.OFFICE_ADMIN, duties=[], staffId="Smoke-Taken-1")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("staffId", response.data)

    def test_staff_id_cannot_be_a_matric_number(self):
        student = User.objects.create_user(
            email="matric@example.test", password="pw-stu-5503", full_name="Some Student", role=User.Role.STUDENT
        )
        Student.objects.create(user=student, matric_no="SMOKE-WQD-0001")
        response = self.create(staffId="smoke-wqd-0001")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("matric number", response.data["staffId"][0])
        self.assertEqual(
            response.data["existing"]["staffId"],
            {"kind": "student", "id": "SMOKE-WQD-0001", "name": "Some Student"},
        )

    def test_a_programme_has_one_coordinator(self):
        holder = self.lecturer(
            "coord", "Current Coordinator", role=User.Role.COORDINATOR, programme=f" {DS.lower()} "
        )
        response = self.create(role=User.Role.COORDINATOR, duties=[], programme=DS)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["programme"], ["Current Coordinator already coordinates this programme."])
        self.assertEqual(response.data["existing"]["programme"]["id"], str(holder.pk))

        holder.is_active = False
        holder.save(update_fields=["is_active"])
        response = self.create(role=User.Role.COORDINATOR, duties=[], programme=DS)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_the_activation_email_is_sent_once(self):
        response = self.create()
        self.assertEqual(response.data["activation"], "sent")
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, ACTIVATION_SUBJECT)
        self.assertEqual(message.to, ["new.lecturer@example.test"])
        self.assertIn("/activate-account?uid=", message.body)
        self.assertIn("Staff ID: SMOKE-LEC-100", message.body)
        user = User.objects.get(email="new.lecturer@example.test")
        self.assertEqual(
            [(row.action, row.details) for row in self.history(user)],
            [
                (AccountChange.Action.CREATED, {"role": User.Role.LECTURER, "staffId": "SMOKE-LEC-100", "duties": ["Supervisor"]}),
                (AccountChange.Action.LINK_SENT, {"kind": "activation", "sent": True}),
            ],
        )
        self.assertEqual(self.history(user)[0].actor, self.office)
        self.assertEqual(self.history(user)[0].actor_name, "Staff Office")

    def test_send_later_holds_the_email(self):
        response = self.create(sendActivation=False)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["activation"], "held")
        self.assertEqual(len(mail.outbox), 0)
        user = User.objects.get(email="new.lecturer@example.test")
        self.assertEqual([row.action for row in self.history(user)], [AccountChange.Action.CREATED])

    def test_a_failed_email_keeps_the_account_and_says_so(self):
        with mock.patch("accounts.registry_views.send_mail", side_effect=OSError("smtp down")),                 self.assertLogs("accounts.registry_views", level="ERROR"):
            response = self.create()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["activation"], "failed")
        user = User.objects.get(email="new.lecturer@example.test")
        self.assertEqual(self.history(user)[-1].details, {"kind": "activation", "sent": False})

    def test_a_duplicate_that_slips_past_the_check_is_a_conflict(self):
        self.lecturer("race", "Race Winner")
        with mock.patch("accounts.staff_accounts._check_unique"):
            response = self.create(email="race@example.test")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("just taken", response.data["error"])
        self.assertFalse(Lecturer.objects.filter(staff_no="SMOKE-LEC-100").exists())
        self.assertFalse(AccountChange.objects.exists())


class AccessTests(StaffAccountsBase):
    def test_only_the_office_gets_in(self):
        target = self.lecturer("target", "Target Lecturer")
        coordinator = self.lecturer("coordx", "Some Coordinator", role=User.Role.COORDINATOR, programme=CS)
        lecturer = self.lecturer("lectx", "Some Lecturer")
        student = User.objects.create_user(
            email="stux@example.test", password="pw-stu-5504", full_name="Some Student", role=User.Role.STUDENT
        )
        technical = User.objects.create_superuser(email="tech@example.test", password="pw-tech-5505")
        calls = [
            ("get", STAFF),
            ("post", STAFF),
            ("get", f"{STAFF}options/"),
            ("get", detail(target)),
            ("patch", detail(target)),
            ("post", f"{detail(target)}send-link/"),
            ("post", f"{detail(target)}activation-link/"),
            ("get", f"{detail(target)}history/"),
        ]
        for user in (coordinator, lecturer, student, technical):
            self.client.force_authenticate(user)
            for method, url in calls:
                with self.subTest(user=user.role, url=url, method=method):
                    response = getattr(self.client, method)(url, {"name": "Changed"}, format="json")
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(STAFF).status_code, status.HTTP_401_UNAUTHORIZED)
        target.refresh_from_db()
        self.assertEqual(target.full_name, "Target Lecturer")
        self.assertEqual(len(mail.outbox), 0)

    def test_students_and_technical_accounts_are_not_staff_accounts(self):
        student = User.objects.create_user(
            email="stuy@example.test", password="pw-stu-5506", full_name="Hidden Student", role=User.Role.STUDENT
        )
        technical = User.objects.create_superuser(email="tech2@example.test", password="pw-tech-5507")
        names = [row["name"] for row in self.client.get(STAFF).data["results"]]
        self.assertNotIn("Hidden Student", names)
        self.assertNotIn("Administrator", names)
        for user in (student, technical):
            self.assertEqual(self.client.get(detail(user)).status_code, status.HTTP_404_NOT_FOUND)
            self.assertEqual(
                self.client.patch(detail(user), {"name": "X"}, format="json").status_code,
                status.HTTP_404_NOT_FOUND,
            )
            self.assertEqual(self.client.get(f"{detail(user)}history/").status_code, status.HTTP_404_NOT_FOUND)


class ListTests(StaffAccountsBase):
    def setUp(self):
        super().setUp()
        self.alpha = self.lecturer("alpha", "Alpha Lecturer", staff_no="SMOKE-A-1")
        self.coord = self.lecturer("beta", "Beta Coordinator", role=User.Role.COORDINATOR, staff_no="SMOKE-B-2", programme=CS)
        self.waiting = self.lecturer("gamma", "Gamma Waiting", staff_no="SMOKE-G-3")
        self.waiting.set_unusable_password()
        self.waiting.save()
        self.off = self.lecturer("delta", "Delta Signed Off", staff_no="SMOKE-D-4")
        self.off.is_active = False
        self.off.save()

    def names(self, query=""):
        response = self.client.get(f"{STAFF}{query}")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return [row["name"] for row in response.data["results"]]

    def test_list_is_sorted_by_name_with_the_read_shape(self):
        response = self.client.get(STAFF)
        self.assertEqual(response.data["count"], 5)
        self.assertEqual(
            [row["name"] for row in response.data["results"]],
            ["Alpha Lecturer", "Beta Coordinator", "Delta Signed Off", "Gamma Waiting", "Staff Office"],
        )
        office = response.data["results"][-1]
        self.assertEqual(office["staffId"], "SMOKE-OFF-001")
        self.assertEqual(office["department"], "Postgraduate Office")
        self.assertTrue(office["isYou"])
        self.assertIsNone(office["lifecycle"])
        coordinator = response.data["results"][1]
        self.assertEqual(coordinator["programme"], CS)
        self.assertEqual(coordinator["role"], User.Role.COORDINATOR)
        self.assertFalse(coordinator["isYou"])

    def test_status_follows_sign_in_and_activation(self):
        statuses = {row["name"]: row["status"] for row in self.client.get(STAFF).data["results"]}
        self.assertEqual(statuses["Alpha Lecturer"], "ACTIVE")
        self.assertEqual(statuses["Gamma Waiting"], "NOT_ACTIVATED")
        self.assertEqual(statuses["Delta Signed Off"], "SIGN_IN_OFF")

    def test_filters(self):
        self.assertEqual(self.names("?search=smoke-b"), ["Beta Coordinator"])
        self.assertEqual(self.names("?search=postgraduate"), ["Staff Office"])
        self.assertEqual(self.names("?search=GAMMA@"), ["Gamma Waiting"])
        self.assertEqual(self.names("?role=coordinator"), ["Beta Coordinator"])
        self.assertEqual(self.names("?role=OFFICE"), ["Staff Office"])
        self.assertEqual(self.names("?status=not_activated"), ["Gamma Waiting"])
        self.assertEqual(self.names("?status=SIGN_IN_OFF"), ["Delta Signed Off"])
        self.assertEqual(
            self.names("?status=ACTIVE&role=LECTURER"), ["Alpha Lecturer"]
        )

    def test_pages(self):
        response = self.client.get(f"{STAFF}?pageSize=2&page=2")
        self.assertEqual(response.data["count"], 5)
        self.assertEqual(response.data["page"], 2)
        self.assertEqual([row["name"] for row in response.data["results"]], ["Delta Signed Off", "Gamma Waiting"])
        self.assertEqual(self.client.get(f"{STAFF}?pageSize=500").data["pageSize"], 100)

    def test_bad_filters_are_refused(self):
        for query in ("?role=STUDENT", "?status=retired", "?page=0", "?pageSize=abc"):
            with self.subTest(query=query):
                self.assertEqual(self.client.get(f"{STAFF}{query}").status_code, status.HTTP_400_BAD_REQUEST)

    def test_options_list_departments_and_programme_coordinators(self):
        Lecturer.objects.filter(user=self.alpha).update(department=" Artificial Intelligence ")
        data = self.client.get(f"{STAFF}options/").data
        self.assertEqual(data["departments"], FACULTY_DEPARTMENTS)
        by_programme = {row["programme"]: row["coordinator"] for row in data["programmes"]}
        self.assertEqual(by_programme[CS], {"id": str(self.coord.pk), "name": "Beta Coordinator"})
        self.assertIsNone(by_programme[DS])


class EditAccountTests(StaffAccountsBase):
    def setUp(self):
        super().setUp()
        self.target = self.lecturer("edit.target", "Edit Target", staff_no="SMOKE-E-1")

    def patch(self, account=None, **fields):
        return self.client.patch(detail(account or self.target), fields, format="json")

    def test_details_are_saved_and_each_change_is_logged(self):
        response = self.patch(name="Dr. Edit Target", phone="03-7967 6300", title="Dr.", researchArea="NLP", department="Software Engineering")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["account"]["name"], "Dr. Edit Target")
        self.target.refresh_from_db()
        self.assertEqual(self.target.lecturer.specialization, "NLP")
        rows = self.history(self.target)
        self.assertEqual([row.action for row in rows], [AccountChange.Action.DETAILS_EDITED])
        self.assertEqual(
            rows[0].details["changes"],
            [
                {"field": "name", "from": "Edit Target", "to": "Dr. Edit Target"},
                {"field": "phone", "from": "", "to": "03-7967 6300"},
                {"field": "title", "from": "", "to": "Dr."},
                {"field": "researchArea", "from": "", "to": "NLP"},
            ],
        )

    def test_nothing_changed_writes_no_history(self):
        response = self.patch(name="Edit Target", department="Software Engineering")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.history(self.target), [])

    def test_staff_id_can_change_but_stays_unique(self):
        response = self.patch(staffId="smoke-off-001")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["existing"]["staffId"]["id"], str(self.office.pk))
        response = self.patch(staffId="SMOKE-E-2")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Lecturer.objects.get(user=self.target).staff_no, "SMOKE-E-2")
        self.assertEqual(self.patch(staffId="SMOKE-E-2").status_code, status.HTTP_200_OK)

    def test_role_duties_and_programme_are_changed_elsewhere(self):
        response = self.patch(role=User.Role.OFFICE_ADMIN, duties=["Panel"], programme=DS, is_staff=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role cannot be changed", response.data["role"][0])
        self.assertIn("Duties box", response.data["duties"][0])
        self.assertIn("Change programme", response.data["programme"][0])
        self.assertEqual(response.data["is_staff"], ["This field cannot be changed here."])
        self.target.refresh_from_db()
        self.assertEqual(self.target.role, User.Role.LECTURER)
        self.assertFalse(self.target.is_staff)

    def test_fields_must_fit_the_role(self):
        self.assertIn("position", self.patch(position="Clerk").data)
        self.assertIn("title", self.patch(account=self.office, title="Dr.").data)
        self.assertEqual(self.patch(department="").data["department"], ["Enter the department."])
        self.assertEqual(self.patch(account=self.office, department="").status_code, status.HTTP_200_OK)

    def test_email_change_tells_the_old_address_of_an_activated_account(self):
        response = self.patch(email="Edit.New@Example.test")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["oldAddressTold"])
        self.assertEqual(response.data["account"]["email"], "edit.new@example.test")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, EMAIL_CHANGED_SUBJECT)
        self.assertEqual(mail.outbox[0].to, ["edit.target@example.test"])
        self.assertIn("edit.new@example.test", mail.outbox[0].body)
        self.assertIn("Staff ID: SMOKE-E-1", mail.outbox[0].body)
        rows = self.history(self.target)
        self.assertEqual([row.action for row in rows], [AccountChange.Action.EMAIL_CHANGED])
        self.assertEqual(rows[0].details, {"from": "edit.target@example.test", "to": "edit.new@example.test"})
        self.assertEqual(rows[0].account_email, "edit.new@example.test")

    def test_email_change_on_an_unused_account_tells_no_one_and_voids_the_old_link(self):
        self.target.set_unusable_password()
        self.target.save()
        token = activation_token_generator.make_token(self.target)
        response = self.patch(email="edit.fixed@example.test")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["oldAddressTold"])
        self.assertEqual(len(mail.outbox), 0)
        self.target.refresh_from_db()
        self.assertIsNone(password_link_kind(self.target, token))

    def test_email_must_stay_unique(self):
        response = self.patch(email="STAFF-office@example.test")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["existing"]["email"]["id"], str(self.office.pk))

    def test_unknown_account_is_not_found(self):
        response = self.client.patch(f"{STAFF}999999/", {"name": "X"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


@override_settings(REGISTRY_ACCESS_LINK_THROTTLE_RATE="2/hour")
class LinkTests(StaffAccountsBase):
    def setUp(self):
        super().setUp()
        self.waiting = self.lecturer("link.waiting", "Link Waiting")
        self.waiting.set_unusable_password()
        self.waiting.save()
        self.active = self.lecturer("link.active", "Link Active")

    def send(self, account):
        return self.client.post(f"{detail(account)}send-link/")

    def test_not_activated_gets_the_activation_link(self):
        response = self.send(self.waiting)
        self.assertEqual(response.data, {"kind": "activation", "sent": True})
        self.assertEqual(mail.outbox[0].subject, ACTIVATION_SUBJECT)
        self.assertEqual(self.history(self.waiting)[-1].details, {"kind": "activation", "sent": True})

    def test_reset_link_only_after_activation(self):
        response = self.send(self.active)
        self.assertEqual(response.data, {"kind": "reset", "sent": True})
        self.assertEqual(mail.outbox[0].subject, RESET_SUBJECT)

    def test_sign_in_off_gets_no_link(self):
        self.active.is_active = False
        self.active.save()
        response = self.send(self.active)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(len(mail.outbox), 0)

    def test_links_are_throttled_per_account(self):
        for _ in range(2):
            self.assertEqual(self.send(self.waiting).status_code, status.HTTP_200_OK)
        self.assertEqual(self.send(self.waiting).status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(self.send(self.active).status_code, status.HTTP_200_OK)

    def test_the_activation_link_can_be_copied_until_activation(self):
        response = self.client.post(f"{detail(self.waiting)}activation-link/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data["link"].split("token=")[1]
        self.assertEqual(password_link_kind(self.waiting, token), ACTIVATION)
        self.assertEqual(self.history(self.waiting)[-1].action, AccountChange.Action.LINK_COPIED)
        self.assertEqual(len(mail.outbox), 0)

    def test_an_activated_account_has_no_link_to_copy(self):
        response = self.client.post(f"{detail(self.active)}activation-link/")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("password reset", response.data["error"])
        self.assertEqual(self.history(self.active), [])


class HistoryTests(StaffAccountsBase):
    def test_history_reads_newest_first(self):
        self.create(sendActivation=False)
        user = User.objects.get(email="new.lecturer@example.test")
        self.client.patch(detail(user), {"phone": "012-3456789"}, format="json")
        response = self.client.get(f"{detail(user)}history/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["action"] for row in response.data], ["DETAILS_EDITED", "CREATED"])
        self.assertEqual(response.data[0]["actor"], "Staff Office")

    def test_history_cannot_be_changed_or_deleted(self):
        self.create(sendActivation=False)
        row = AccountChange.objects.get()
        row.details = {"forged": True}
        with self.assertRaises(ValidationError):
            row.save()
        with self.assertRaises(ValidationError):
            row.delete()
        with self.assertRaises(ValidationError):
            AccountChange.objects.update(details={})
        with self.assertRaises(ValidationError):
            AccountChange.objects.all().delete()

    def test_history_outlives_a_deleted_account(self):
        self.create(sendActivation=False)
        user = User.objects.get(email="new.lecturer@example.test")
        user.delete()
        row = AccountChange.objects.get()
        self.assertIsNone(row.account)
        self.assertEqual((row.account_name, row.account_email), ("Dr. New Lecturer", "new.lecturer@example.test"))
