from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import Coordinator, Lecturer, OfficeStaff, Supervisor, User
from .staff_accounts import StaffAccountError, set_sign_in

PASSWORD = "Registry-pass-7731!"
PROGRAMME = "MASTER OF DATA SCIENCE (COURSEWORK)"


def make_lecturer(staff_no, role=User.Role.LECTURER):
    user = User.objects.create_user(
        email=f"{staff_no.lower()}@example.test", password=PASSWORD, full_name=f"Lecturer {staff_no}", role=role,
    )
    return Lecturer.objects.create(user=user, staff_no=staff_no, department="Computing")


class LecturerLeavingTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user(
            email="office.leave@example.test", password=PASSWORD, full_name="Office", role=User.Role.OFFICE_ADMIN, is_staff=True,
        )
        OfficeStaff.objects.create(user=self.office, staff_no="OFF-LEAVE-1")
        self.lecturer = make_lecturer("LEC-LEAVE-1")
        Supervisor.objects.create(lecturer=self.lecturer, max_supervisees=4)
        self.client.force_authenticate(self.office)

    def move(self, target, lecturer=None, reason="Told the office"):
        staff_no = (lecturer or self.lecturer).staff_no
        return self.client.post(
            f"/api/accounts/participants/lecturers/{staff_no}/transition/",
            {"targetStatus": target, "reason": reason},
            format="json",
        )

    def refresh(self, lecturer=None):
        row = lecturer or self.lecturer
        row.refresh_from_db()
        row.user.refresh_from_db()
        return row

    def leave(self, final, lecturer=None):
        self.assertEqual(self.move("RETIRING", lecturer).status_code, 200)
        response = self.move(final, lecturer)
        self.assertEqual(response.status_code, 200, response.data)

    def test_resigning_keeps_the_profile_and_turns_off_sign_in(self):
        self.leave("RESIGNED")
        row = self.refresh()
        self.assertEqual(row.lifecycle_status, Lecturer.Lifecycle.RESIGNED)
        self.assertFalse(row.user.is_active)
        self.assertEqual(Supervisor.objects.get(lecturer=row).max_supervisees, 4)
        detail = self.client.get(f"/api/accounts/participants/lecturers/{row.staff_no}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["accountAccess"], "DISABLED")
        self.assertEqual([audit["newStatus"] for audit in detail.data["audits"]], ["RESIGNED", "RETIRING"])
        summary = self.client.get("/api/accounts/participants/").data["summary"]
        self.assertEqual(summary["resignedLecturers"], 1)

    def test_they_must_be_marked_as_leaving_first(self):
        for final in ("RESIGNED", "RETIRED"):
            self.assertEqual(self.move(final).status_code, 409)
        self.assertEqual(self.refresh().lifecycle_status, Lecturer.Lifecycle.ACTIVE)

    def test_open_work_stops_a_resignation(self):
        coordinator = make_lecturer("LEC-LEAVE-2", role=User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=coordinator, programme_managed=PROGRAMME)
        self.assertEqual(self.move("RETIRING", coordinator).status_code, 200)
        blocked = self.move("RESIGNED", coordinator)
        self.assertEqual(blocked.status_code, 409)
        self.assertIn("Resignation is blocked", blocked.data["error"])
        self.assertEqual(blocked.data["blockers"]["managedProgrammes"], 1)
        self.assertTrue(self.refresh(coordinator).user.is_active)

    def test_resigned_and_retired_lecturers_can_return_to_work(self):
        for final in ("RESIGNED", "RETIRED"):
            with self.subTest(final=final):
                self.leave(final)
                self.assertFalse(self.refresh().user.is_active)
                self.assertEqual(self.move("ACTIVE").status_code, 200)
                row = self.refresh()
                self.assertEqual(row.lifecycle_status, Lecturer.Lifecycle.ACTIVE)
                self.assertTrue(row.user.is_active)
                self.assertEqual(Supervisor.objects.get(lecturer=row).max_supervisees, 4)
        self.client.force_authenticate(None)
        login = self.client.post(
            "/api/auth/login/", {"identifier": row.user.email, "password": PASSWORD}, format="json", REMOTE_ADDR="192.0.2.151",
        )
        self.assertEqual(login.status_code, 200)

    def test_returning_needs_a_reason(self):
        self.leave("RESIGNED")
        self.assertEqual(self.move("ACTIVE", reason="  ").status_code, 400)
        self.assertFalse(self.refresh().user.is_active)

    def test_sign_in_stays_off_until_they_return(self):
        self.leave("RESIGNED")
        with self.assertRaises(StaffAccountError) as caught:
            set_sign_in(actor=self.office, account_id=self.lecturer.user.pk, on=True)
        self.assertIn("Returned to work", str(caught.exception))
        self.assertFalse(self.refresh().user.is_active)

    def test_a_returning_coordinator_cannot_take_a_programme_someone_else_now_holds(self):
        returning = make_lecturer("LEC-LEAVE-3", role=User.Role.COORDINATOR)
        record = Coordinator.objects.create(lecturer=returning, programme_managed="")
        self.leave("RESIGNED", returning)
        record.programme_managed = PROGRAMME
        record.save(update_fields=["programme_managed"])
        holder = make_lecturer("LEC-LEAVE-4", role=User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=holder, programme_managed=PROGRAMME)
        blocked = self.move("ACTIVE", returning)
        self.assertEqual(blocked.status_code, 409)
        self.assertIn("now coordinates this programme", blocked.data["error"])
        row = self.refresh(returning)
        self.assertEqual(row.lifecycle_status, Lecturer.Lifecycle.RESIGNED)
        self.assertFalse(row.user.is_active)
