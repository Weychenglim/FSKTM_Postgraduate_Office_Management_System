"""Staff and lecturer accounts (UC03), phase S2: duties, programme, sign-in and delete."""
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from academics.models import AcademicSemester, LecturerCapacityEntry, SemesterCapacityPlan
from announcements.models import Announcement, Notification
from appointments.models import (
    PanelRecommendation,
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
)
from letters.models import GeneratedLetter

from .models import AccountChange, Coordinator, Lecturer, OfficeStaff, Panel, Student, Supervisor, User
from .programmes import APPROVED_PROGRAMMES

STAFF = "/api/registry/staff/"
PASSWORD = "pw-rules-6601"
DS, CS, AI = APPROVED_PROGRAMMES


def url(account, action=""):
    return f"{STAFF}{account.pk}/{action}"


class StaffRulesBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user(
            email="rules-office@example.test",
            password=PASSWORD,
            full_name="Rules Office",
            role=User.Role.OFFICE_ADMIN,
            is_staff=True,
        )
        OfficeStaff.objects.create(user=self.office, staff_no="RULES-OFF-1")
        self.client.force_authenticate(self.office)
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(
            code="RULES-SEMESTER",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=90),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        self.lecturer = self.make_lecturer("rules.lecturer", "Rules Lecturer", duties=("Supervisor", "Panel"))
        self.coordinator = self.make_lecturer("rules.coord", "Rules Coordinator", role=User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=self.coordinator.lecturer, programme_managed=DS)
        student_user = User.objects.create_user(
            email="rules.student@example.test", password=PASSWORD, full_name="Rules Student", role=User.Role.STUDENT
        )
        self.student = Student.objects.create(user=student_user, matric_no="RULES-S-1", programme=DS)

    @staticmethod
    def make_lecturer(key, name, *, role=User.Role.LECTURER, duties=(), password=PASSWORD):
        user = User.objects.create_user(
            email=f"{key}@example.test", password=password, full_name=name, role=role
        )
        lecturer = Lecturer.objects.create(user=user, staff_no=key.upper(), department="Software Engineering")
        if "Supervisor" in duties:
            Supervisor.objects.create(lecturer=lecturer)
        if "Panel" in duties:
            Panel.objects.create(lecturer=lecturer)
        return user

    def application(self, supervisor, state):
        return SupervisorApplication.objects.create(
            student=self.student,
            academic_semester=self.semester,
            proposed_supervisor=supervisor,
            research_title="Rules research",
            research_area="Data Mining",
            research_abstract="Fixture.",
            status=state,
        )

    def supervise(self, supervisor):
        application = self.application(supervisor, SupervisorApplication.Status.APPROVED)
        return SupervisorAppointment.objects.create(
            application=application, student=self.student, supervisor=supervisor, approved_by=self.coordinator
        )

    def nominate_panel(self, member, state=PanelRecommendation.Status.SUBMITTED_TO_PANEL):
        profile = StudentResearchProfile.objects.create(
            student=self.student.user,
            matric_no=self.student.matric_no,
            student_name="Rules Student",
            programme=DS,
            semester=self.semester.label,
            proposed_topic="Rules topic",
            research_area="Data Mining",
            supervisor=self.lecturer,
        )
        return PanelRecommendation.objects.create(
            profile=profile,
            academic_semester=self.semester,
            supervisor=self.lecturer,
            recommended_member=member,
            status=state,
            justification="Fixture",
        )

    def draft_plan(self):
        return SemesterCapacityPlan.objects.create(
            academic_semester=self.semester,
            version=1,
            lifecycle_status=SemesterCapacityPlan.Lifecycle.DRAFT,
            origin=SemesterCapacityPlan.Origin.CREATED,
            created_by=self.office,
        )

    def actions(self, user):
        return [row.action for row in AccountChange.objects.filter(account=user).order_by("created_at", "id")]


class DutiesTests(StaffRulesBase):
    def set(self, user, duties):
        return self.client.post(url(user, "duties/"), {"duties": duties}, format="json")

    def test_adding_a_duty_warns_until_it_is_in_the_capacity_plan(self):
        user = self.make_lecturer("rules.new", "New Lecturer")
        response = self.set(user, ["Supervisor"])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["duties"], ["Supervisor"])
        self.assertTrue(Supervisor.objects.filter(lecturer__user=user).exists())
        self.assertEqual(response.data["capacity"]["semester"], self.semester.label)
        self.assertEqual(response.data["capacity"]["duties"][0]["duty"], "Supervisor")
        self.assertEqual(response.data["capacity"]["duties"][0]["state"], "NOT_CONFIGURED")
        change = AccountChange.objects.get(account=user)
        self.assertEqual(change.action, AccountChange.Action.DUTIES_CHANGED)
        self.assertEqual(change.details, {"from": [], "to": ["Supervisor"]})

    def test_a_duty_without_open_work_can_be_removed(self):
        response = self.set(self.lecturer, ["Supervisor"])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(Panel.objects.filter(lecturer__user=self.lecturer).exists())
        self.assertTrue(Supervisor.objects.filter(lecturer__user=self.lecturer).exists())

    def test_supervisor_duty_stays_while_students_or_requests_need_it(self):
        cases = [
            (lambda: self.supervise(self.lecturer), "activeSupervisorAppointments"),
            (lambda: self.application(self.lecturer, SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR), "pendingSupervisorApplications"),
            (lambda: self.application(self.lecturer, SupervisorApplication.Status.PENDING_COORDINATOR), "pendingSupervisorApplications"),
        ]
        for make, key in cases:
            with self.subTest(key=key):
                row = make()
                response = self.set(self.lecturer, ["Panel"])
                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                self.assertEqual(response.data["blockers"], [{"key": key, "count": 1}])
                self.assertIn("Supervisor duty", response.data["error"])
                self.assertTrue(Supervisor.objects.filter(lecturer__user=self.lecturer).exists())
                if isinstance(row, SupervisorAppointment):
                    SupervisorAppointment.objects.filter(pk=row.pk).delete()
                    SupervisorApplication.objects.filter(pk=row.application_id).delete()
                else:
                    SupervisorApplication.objects.filter(pk=row.pk).delete()
        self.assertNotIn(AccountChange.Action.DUTIES_CHANGED, self.actions(self.lecturer))

    def test_panel_duty_stays_while_a_nomination_waits(self):
        self.nominate_panel(self.lecturer)
        response = self.set(self.lecturer, ["Supervisor"])
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["blockers"], [{"key": "pendingPanelRecommendations", "count": 1}])

    def test_work_for_a_kept_duty_does_not_block_another(self):
        self.supervise(self.lecturer)
        self.assertEqual(self.set(self.lecturer, ["Supervisor"]).status_code, status.HTTP_200_OK)

    def test_coordinators_have_no_duties(self):
        response = self.set(self.coordinator, ["Supervisor"])
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("separate lecturer account", response.data["error"])

    def test_duties_are_not_added_to_someone_who_cannot_sign_in(self):
        user = self.make_lecturer("rules.retired", "Retired Lecturer")
        Lecturer.objects.filter(user=user).update(lifecycle_status=Lecturer.Lifecycle.RETIRED)
        User.objects.filter(pk=user.pk).update(is_active=False)
        self.assertEqual(self.set(user, ["Panel"]).status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(Panel.objects.filter(lecturer__user=user).exists())

    def test_a_limit_left_for_a_removed_duty_is_flagged(self):
        plan = self.draft_plan()
        LecturerCapacityEntry.objects.create(
            plan=plan, lecturer=self.lecturer.lecturer, supervisor_limit=4, panel_limit=6, updated_by=self.office
        )
        response = self.set(self.lecturer, ["Supervisor"])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn({"duty": "Panel", "state": "LIMIT_WITHOUT_DUTY"}, response.data["capacity"]["duties"])

    def test_unknown_duties_are_refused(self):
        response = self.set(self.lecturer, ["Supervisor", "Dean"])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProgrammeTests(StaffRulesBase):
    def move(self, user, programme, check=False):
        return self.client.post(url(user, "programme/"), {"programme": programme, "check": check}, format="json")

    def test_programme_change_is_saved_and_logged(self):
        response = self.move(self.coordinator, AI)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["programme"], AI)
        change = AccountChange.objects.get(account=self.coordinator)
        self.assertEqual(change.details, {"from": DS, "to": AI})

    def test_check_counts_the_approvals_that_move_and_saves_nothing(self):
        self.application(self.lecturer, SupervisorApplication.Status.PENDING_COORDINATOR)
        self.nominate_panel(self.make_lecturer("rules.p2", "Panel Two", duties=("Panel",)), PanelRecommendation.Status.PENDING_COORDINATOR)
        response = self.move(self.coordinator, AI, check=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["from"]["programme"], DS)
        self.assertEqual(
            response.data["from"]["waiting"],
            {"supervisorRequests": 1, "coSupervisorNominations": 0, "panelNominations": 1, "amendments": 0, "total": 2},
        )
        self.assertEqual(response.data["to"]["waiting"]["total"], 0)
        self.assertEqual(Coordinator.objects.get(lecturer__user=self.coordinator).programme_managed, DS)
        self.assertEqual(self.actions(self.coordinator), [])

    def test_a_programme_with_a_coordinator_is_refused(self):
        other = self.make_lecturer("rules.coord2", "Second Coordinator", role=User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=other.lecturer, programme_managed=AI)
        first = self.move(self.coordinator, CS)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.move(other, CS)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second.data["existing"]["programme"]["id"], str(self.coordinator.pk))
        self.assertEqual(Coordinator.objects.get(lecturer__user=other).programme_managed, AI)

    def test_no_programme_is_allowed(self):
        response = self.move(self.coordinator, "")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["programme"], "")

    def test_only_lecturers_and_coordinators_have_a_programme(self):
        self.assertEqual(self.move(self.office, AI).status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(self.move(self.coordinator, "MASTER OF NOTHING").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.move(self.lecturer, "MASTER OF NOTHING").status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_lecturer_programme_is_saved_logged_and_can_be_cleared(self):
        other = self.make_lecturer("rules.second", "Second Lecturer")
        self.assertEqual(self.move(other, DS).status_code, status.HTTP_200_OK)
        response = self.move(self.lecturer, DS)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["programme"], DS)
        self.assertEqual(Lecturer.objects.get(user=self.lecturer).programme, DS)
        self.assertEqual(AccountChange.objects.get(account=self.lecturer).details, {"from": "", "to": DS})
        self.assertEqual(self.move(self.lecturer, DS).status_code, status.HTTP_200_OK)
        self.assertEqual(AccountChange.objects.filter(account=self.lecturer).count(), 1)
        cleared = self.move(self.lecturer, "")
        self.assertEqual(cleared.data["programme"], "")
        self.assertFalse(Coordinator.objects.filter(lecturer__user=self.lecturer).exists())


class SignInTests(StaffRulesBase):
    def switch(self, user, on, reason="Left the faculty"):
        return self.client.post(url(user, "sign-in/"), {"on": on, "reason": reason}, format="json")

    def test_turning_sign_in_off_ends_every_session(self):
        user = self.make_lecturer("rules.free", "Free Lecturer")
        refresh = RefreshToken.for_user(user)
        response = self.switch(user, False)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["status"], "SIGN_IN_OFF")
        token = OutstandingToken.objects.get(jti=refresh["jti"])
        self.assertTrue(BlacklistedToken.objects.filter(token=token).exists())
        self.client.force_authenticate(None)
        login = self.client.post(
            "/api/auth/login/", {"identifier": "rules.free@example.test", "password": PASSWORD}, format="json"
        )
        self.assertEqual(login.status_code, status.HTTP_401_UNAUTHORIZED)
        change = AccountChange.objects.get(account=user)
        self.assertEqual((change.action, change.details), (AccountChange.Action.SIGN_IN_OFF, {"reason": "Left the faculty"}))

    def test_a_reason_is_needed(self):
        response = self.switch(self.make_lecturer("rules.why", "Why Lecturer"), False, reason="  ")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["reason"], ["Give a reason."])

    def test_your_own_account_stays_on(self):
        response = self.switch(self.office, False)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("your own", response.data["error"])

    def test_the_last_office_account_stays_on(self):
        other = User.objects.create_user(
            email="rules-office2@example.test", password=PASSWORD, full_name="Second Office", role=User.Role.OFFICE_ADMIN
        )
        User.objects.filter(pk=self.office.pk).update(is_active=False)
        response = self.switch(other, False)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("last office account", response.data["error"])

    def test_active_work_blocks_and_is_listed(self):
        self.application(self.lecturer, SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR)
        response = self.switch(self.lecturer, False)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Participant lifecycle", response.data["error"])
        self.assertEqual(response.data["blockers"], [{"key": "pendingSupervisorApplications", "count": 1}])
        self.lecturer.refresh_from_db()
        self.assertTrue(self.lecturer.is_active)

    def test_a_coordinator_hands_over_the_programme_first(self):
        response = self.switch(self.coordinator, False)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["blockers"], [{"key": "managedProgrammes", "count": 1}])
        self.client.post(url(self.coordinator, "programme/"), {"programme": ""}, format="json")
        self.assertEqual(self.switch(self.coordinator, False).status_code, status.HTTP_200_OK)

    def test_two_quick_changes_do_not_both_apply(self):
        user = self.make_lecturer("rules.twice", "Twice Lecturer")
        self.assertEqual(self.switch(user, False).status_code, status.HTTP_200_OK)
        second = self.switch(user, False)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second.data["error"], "Sign-in is already off.")
        self.assertEqual(self.actions(user), [AccountChange.Action.SIGN_IN_OFF])

    def test_turning_sign_in_back_on(self):
        user = self.make_lecturer("rules.back", "Back Lecturer")
        self.switch(user, False)
        response = self.switch(user, True, reason="")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ACTIVE")
        self.assertEqual(self.actions(user), [AccountChange.Action.SIGN_IN_OFF, AccountChange.Action.SIGN_IN_ON])
        self.assertEqual(self.switch(user, True).status_code, status.HTTP_409_CONFLICT)

    def test_a_retired_lecturer_stays_off(self):
        user = self.make_lecturer("rules.gone", "Gone Lecturer")
        Lecturer.objects.filter(user=user).update(lifecycle_status=Lecturer.Lifecycle.RETIRED)
        User.objects.filter(pk=user.pk).update(is_active=False)
        response = self.switch(user, True)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Returned to work", response.data["error"])

    def test_a_coordinator_cannot_come_back_to_a_taken_programme(self):
        self.client.post(url(self.coordinator, "programme/"), {"programme": ""}, format="json")
        self.switch(self.coordinator, False)
        Coordinator.objects.filter(lecturer__user=self.coordinator).update(programme_managed=CS)
        other = self.make_lecturer("rules.cs", "Current CS Coordinator", role=User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=other.lecturer, programme_managed=CS)
        response = self.switch(self.coordinator, True)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["existing"]["programme"]["id"], str(other.pk))


class DeleteTests(StaffRulesBase):
    def test_an_unused_account_is_deleted_and_remembered(self):
        response = self.client.post(
            STAFF,
            {
                "role": User.Role.LECTURER,
                "name": "Mistaken Lecturer",
                "email": "mistake@example.test",
                "staffId": "RULES-MISTAKE",
                "department": "Software Engineering",
                "duties": ["Panel"],
                "sendActivation": False,
            },
            format="json",
        )
        user = User.objects.get(pk=response.data["account"]["id"])
        Notification.objects.create(recipient=user, title="Welcome")
        page = self.client.get(url(user))
        self.assertEqual(page.data["deletion"], {"allowed": True, "reasons": []})
        response = self.client.delete(url(user))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(email="mistake@example.test").exists())
        self.assertFalse(Lecturer.objects.filter(staff_no="RULES-MISTAKE").exists())
        rows = AccountChange.objects.filter(account_email="mistake@example.test").order_by("created_at", "id")
        self.assertEqual([row.action for row in rows], [AccountChange.Action.CREATED, AccountChange.Action.DELETED])
        self.assertTrue(all(row.account_id is None for row in rows))
        self.assertEqual(rows[1].details, {"role": User.Role.LECTURER, "staffId": "RULES-MISTAKE"})
        self.assertEqual(rows[1].account_name, "Mistaken Lecturer")

    def test_a_used_account_is_refused_with_the_reasons(self):
        user = self.make_lecturer("rules.used", "Used Lecturer")
        User.objects.filter(pk=user.pk).update(last_portal_login=timezone.now())
        self.application(user, SupervisorApplication.Status.SUBMITTED_TO_SUPERVISOR)
        response = self.client.delete(url(user))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Turn off sign-in instead", response.data["error"])
        texts = [item["text"] for item in response.data["blockers"]]
        self.assertEqual(texts[0], "It has been used to sign in.")
        self.assertIn("supervisor applications", texts[1])
        self.assertTrue(User.objects.filter(pk=user.pk).exists())
        self.assertFalse(self.client.get(url(user)).data["deletion"]["allowed"])

    def test_records_through_hidden_links_count(self):
        user = self.make_lecturer("rules.letter", "Letter Lecturer")
        user.set_unusable_password()
        user.save()
        letter = GeneratedLetter.objects.create(template_name="Fixture", student_data={})
        letter.recipients.add(user)
        response = self.client.delete(url(user))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("letter", response.data["blockers"][0]["text"])

    def test_capacity_entries_count(self):
        user = self.make_lecturer("rules.cap", "Capacity Lecturer", duties=("Panel",))
        LecturerCapacityEntry.objects.create(
            plan=self.draft_plan(), lecturer=user.lecturer, panel_limit=2, updated_by=self.office
        )
        response = self.client.delete(url(user))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("capacity", response.data["blockers"][0]["text"])

    def test_an_announcement_author_is_not_unused(self):
        user = User.objects.create_user(
            email="rules-office3@example.test", password=PASSWORD, full_name="Author Office", role=User.Role.OFFICE_ADMIN
        )
        Announcement.objects.create(title="Hello", content="Body", created_by=user)
        response = self.client.delete(url(user))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_your_own_account_cannot_be_deleted(self):
        response = self.client.delete(url(self.office))
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["blockers"][0]["text"], "This is your own account.")


class PageAndAccessTests(StaffRulesBase):
    def test_the_account_page_shows_open_work(self):
        self.supervise(self.lecturer)
        page = self.client.get(url(self.lecturer)).data
        self.assertEqual(page["activeWork"], [{"key": "activeSupervisorAppointments", "count": 1}])
        self.assertEqual([row["duty"] for row in page["capacity"]["duties"]], ["Supervisor", "Panel"])
        self.assertIsNone(self.client.get(url(self.coordinator)).data["capacity"])
        self.assertIsNone(self.client.get(url(self.office)).data["capacity"])

    def test_only_the_office_can_change_accounts(self):
        target = self.make_lecturer("rules.target", "Target Lecturer")
        calls = [
            ("post", url(target, "duties/"), {"duties": ["Panel"]}),
            ("post", url(self.coordinator, "programme/"), {"programme": AI}),
            ("post", url(target, "sign-in/"), {"on": False, "reason": "x"}),
            ("delete", url(target), None),
        ]
        for user in (self.coordinator, self.lecturer, self.student.user):
            self.client.force_authenticate(user)
            for method, path, body in calls:
                with self.subTest(user=user.role, path=path):
                    response = getattr(self.client, method)(path, body, format="json")
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.get(pk=target.pk).is_active)
        self.assertFalse(Panel.objects.filter(lecturer__user=target).exists())
        self.assertEqual(AccountChange.objects.count(), 0)
