"""Coordinators send to their programme's students, lecturers to the students
they supervise, and students who have left get nothing new."""

from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from accounts.models import Coordinator, Lecturer, Student, User
from accounts.programmes import APPROVED_PROGRAMMES
from appointments.models import SupervisorApplication, SupervisorAppointment

from .models import Announcement, Notification

DS, CS, AI = APPROVED_PROGRAMMES
PASSWORD = "Scope-pass-4411!"


class SenderScopeTests(APITestCase):
    def setUp(self):
        self.office = self.user("office.scope@example.test", User.Role.OFFICE_ADMIN)
        self.supervisor = self.lecturer("sup.scope@example.test", "SC-L1")
        self.idle = self.lecturer("idle.scope@example.test", "SC-L2")
        self.coordinator = self.lecturer("coord.scope@example.test", "SC-C1", User.Role.COORDINATOR)
        Coordinator.objects.create(lecturer=self.coordinator.lecturer, programme_managed=CS)
        today = timezone.localdate()
        self.semester = AcademicSemester.objects.create(
            code="SC-SEM",
            academic_session=f"{today.year}/{today.year + 1}",
            term=AcademicSemester.Term.SPECIAL,
            starts_on=today - timedelta(days=30),
            ends_on=today + timedelta(days=60),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
        )
        self.mine = self.student("SC-S1", DS)
        self.mine_cs = self.student("SC-S2", CS)
        self.other_cs = self.student("SC-S3", CS)
        self.other_ds = self.student("SC-S4", DS)
        self.graduated_cs = self.student("SC-S5", CS, Student.Status.GRADUATED)
        self.withdrawn_ds = self.student("SC-S6", DS, Student.Status.WITHDRAWN)
        self.deferred_ds = self.student("SC-S7", DS, Student.Status.DEFERRED)
        self.appoint(self.mine, self.supervisor)
        self.appoint(self.mine_cs, self.supervisor)

    def user(self, email, role):
        return User.objects.create_user(email=email, password=PASSWORD, full_name=email, role=role)

    def lecturer(self, email, staff_no, role=User.Role.LECTURER):
        user = self.user(email, role)
        Lecturer.objects.create(user=user, staff_no=staff_no, department="Computer Science")
        return user

    def student(self, matric, programme, state=Student.Status.ACTIVE):
        user = self.user(f"{matric.lower()}@example.test", User.Role.STUDENT)
        return Student.objects.create(user=user, matric_no=matric, programme=programme, status=state)

    def appoint(self, student, supervisor):
        application = SupervisorApplication.objects.create(
            student=student,
            academic_semester=self.semester,
            proposed_supervisor=supervisor,
            research_title=f"Research for {student.matric_no}",
            research_area="Information Systems",
            research_abstract="Announcement scope fixture.",
            status=SupervisorApplication.Status.APPROVED,
        )
        SupervisorAppointment.objects.create(
            application=application, student=student, supervisor=supervisor, approved_by=self.coordinator
        )

    def post(self, actor, **fields):
        body = {"title": "Notice", "content": "Body", "priority": "Urgent", "status": "Active"}
        body.update(fields)
        self.client.force_authenticate(actor)
        return self.client.post("/api/announcements/", body, format="json")

    def recipients(self, response):
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        notice = Announcement.objects.get(pk=response.data["id"])
        return set(Notification.objects.filter(announcement=notice).values_list("recipient_id", flat=True))

    def count(self, actor, **params):
        self.client.force_authenticate(actor)
        return self.client.get("/api/announcements/recipient-count/", {"priority": "Urgent", **params})

    def bell(self, user):
        self.client.force_authenticate(user)
        return {row["title"] for row in self.client.get("/api/notifications/").data}

    def test_everyone_leaves_out_graduated_and_withdrawn_students(self):
        reached = self.recipients(self.post(self.office, audiences=["All"]))
        self.assertNotIn(self.graduated_cs.user_id, reached)
        self.assertNotIn(self.withdrawn_ds.user_id, reached)
        self.assertIn(self.deferred_ds.user_id, reached)
        self.assertIn(self.idle.pk, reached)

    def test_a_student_who_left_gets_nothing_on_the_next_bell_refresh(self):
        self.post(self.office, title="For students", audiences=["All Students"])
        self.assertNotIn("For students", self.bell(self.graduated_cs.user))
        self.assertIn("For students", self.bell(self.deferred_ds.user))

    def test_a_coordinator_reaches_only_their_programme(self):
        response = self.post(self.coordinator, audiences=["All Students"])
        self.assertEqual(self.recipients(response), {self.mine_cs.user_id, self.other_cs.user_id})
        self.assertEqual(response.data["targetProgrammes"], [CS])
        self.assertEqual(self.count(self.coordinator, audiences="All Students").data["recipients"], 2)

    def test_a_coordinator_cannot_reach_other_groups_or_programmes(self):
        for fields in ({"audiences": ["All"]}, {"audiences": ["Lecturers"]},
                       {"audiences": ["All Students", "Lecturers"]},
                       {"audiences": ["All Students"], "targetProgrammes": [DS]}):
            with self.subTest(fields=fields):
                self.assertEqual(self.post(self.coordinator, **fields).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Announcement.objects.exists())

    def test_a_lecturer_reaches_only_the_students_they_supervise(self):
        response = self.post(self.supervisor, title="Drafts due Friday", audiences=["All Students"])
        self.assertEqual(self.recipients(response), {self.mine.user_id, self.mine_cs.user_id})
        self.assertEqual(response.data["targetStudentCount"], 2)
        self.assertEqual(self.count(self.supervisor, audiences="All Students").data["recipients"], 2)
        for outsider in (self.other_ds.user, self.other_cs.user, self.deferred_ds.user):
            with self.subTest(outsider=outsider.email):
                self.assertNotIn("Drafts due Friday", self.bell(outsider))
                self.client.force_authenticate(outsider)
                self.assertEqual(
                    self.client.get(f"/api/announcements/{response.data['id']}/").status_code,
                    status.HTTP_404_NOT_FOUND,
                )
        self.assertIn("Drafts due Friday", self.bell(self.mine.user))

    def test_a_lecturer_cannot_reach_anyone_else(self):
        for fields in ({"audiences": ["All"]}, {"audiences": ["Lecturers"]},
                       {"audiences": ["All Students"], "targetProgrammes": [DS]}):
            with self.subTest(fields=fields):
                self.assertEqual(self.post(self.supervisor, **fields).status_code, status.HTTP_400_BAD_REQUEST)
        response = self.post(self.idle, audiences=["All Students"])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("audiences", response.data)
        self.assertEqual(self.count(self.supervisor, audiences="Lecturers").status_code, status.HTTP_400_BAD_REQUEST)

    def test_publishing_a_lecturers_draft_rechecks_who_it_reaches(self):
        self.client.force_authenticate(self.supervisor)
        draft = self.post(self.supervisor, audiences=["All Students"], status="Draft").data
        Announcement.objects.filter(pk=draft["id"]).update(target="All", target_students=[])
        response = self.client.patch(f"/api/announcements/{draft['id']}/", {"status": "Active"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_audience_options_follow_the_sender(self):
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.get("/api/announcements/audience-options/").data["scope"], "office")
        self.client.force_authenticate(self.coordinator)
        options = self.client.get("/api/announcements/audience-options/").data
        self.assertEqual((options["scope"], options["programmes"]), ("programme", [CS]))
        self.client.force_authenticate(self.supervisor)
        options = self.client.get("/api/announcements/audience-options/").data
        self.assertEqual((options["scope"], options["students"]), ("supervisees", 2))
