"""Preference-driven email, deadline reminders and the weekly summary (UC33)."""

import itertools
from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from academics.models import AcademicSemester
from accounts.models import Lecturer, Student
from appointments.models import StudentResearchProfile
from dashboard.models import SemesterTimeline, SemesterTimelineEntry
from marks.models import EvaluationPeriod, EvaluationTask, MarkEntry, Rubric

from .emails import ANNOUNCEMENT, DEADLINE, SUMMARY, email_users
from .models import Notification, WeeklySummaryLog
from .reminders import send_deadline_reminders, send_weekly_summaries

User = get_user_model()
PASSWORD = "Reminder-pass-4410!"


def make_user(email, role=User.Role.STUDENT, **prefs):
    return User.objects.create_user(email=email, password=PASSWORD, full_name=email.split("@")[0], role=role, **prefs)


def inbox():
    return sorted(address for message in mail.outbox for address in message.to)


class EmailPreferenceTests(TestCase):
    def test_every_switch_combination_is_respected(self):
        users = []
        for index, (email_on, alerts, deadlines, summary) in enumerate(itertools.product([True, False], repeat=4)):
            users.append(
                make_user(
                    f"combo{index}@example.test",
                    email_notifications=email_on,
                    announcement_alerts=alerts,
                    deadline_reminders=deadlines,
                    weekly_summary=summary,
                )
            )
        rules = {
            ANNOUNCEMENT: lambda u: u.email_notifications and u.announcement_alerts,
            DEADLINE: lambda u: u.email_notifications and u.deadline_reminders,
            SUMMARY: lambda u: u.weekly_summary,
        }
        for kind, rule in rules.items():
            with self.subTest(kind=kind):
                mail.outbox = []
                sent = email_users(users, kind, "Subject", "Body")
                expected = sorted(u.email for u in users if rule(u))
                self.assertEqual(inbox(), expected)
                self.assertEqual(sent, len(expected))

    def test_inactive_accounts_get_nothing(self):
        user = make_user("gone@example.test", email_notifications=True, weekly_summary=True, is_active=False)
        self.assertEqual(email_users([user], SUMMARY, "Subject", "Body"), 0)
        self.assertEqual(mail.outbox, [])


class AnnouncementEmailTests(APITestCase):
    def setUp(self):
        self.office = make_user("office.mail@example.test", User.Role.OFFICE_ADMIN, email_notifications=False)
        self.emailed = make_user("emailed@example.test", email_notifications=True)
        self.feed_only = make_user("feedonly@example.test", email_notifications=False)
        self.alerts_off = make_user("quiet@example.test", email_notifications=True, announcement_alerts=False)
        self.lecturer = make_user("lect.mail@example.test", User.Role.LECTURER, email_notifications=True)
        self.client.force_authenticate(self.office)

    def publish(self, **fields):
        body = {"title": "Viva week", "content": "Room changes", "target": "All Students", "status": "Active"}
        body.update(fields)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post("/api/announcements/", body, format="json").data

    def test_only_opted_in_recipients_are_emailed_once(self):
        notice = self.publish()
        self.assertEqual(inbox(), ["emailed@example.test"])
        self.assertIn("Room changes", mail.outbox[0].body)
        self.assertIn("/notifications", mail.outbox[0].body)

        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(f"/api/announcements/{notice['id']}/", {"content": "Room changes v2"}, format="json")
        self.assertEqual(len(mail.outbox), 1)

        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(f"/api/announcements/{notice['id']}/", {"target": "All"}, format="json")
        self.assertEqual(inbox(), ["emailed@example.test", "lect.mail@example.test"])

    def test_urgent_notices_still_follow_the_email_switches(self):
        self.publish(priority="Urgent", title="Fire drill")
        self.assertEqual(inbox(), ["emailed@example.test"])
        self.assertTrue(mail.outbox[0].subject.startswith("Urgent: "))
        self.assertTrue(Notification.objects.filter(recipient=self.alerts_off, title="Fire drill").exists())

    def test_a_scheduled_notice_is_emailed_when_released_not_when_saved(self):
        from .views import release_due_announcements

        publish_at = (timezone.now() + timedelta(hours=1)).isoformat()
        notice = self.publish(publishAt=publish_at)
        self.assertEqual(mail.outbox, [])
        from .models import Announcement

        Announcement.objects.filter(pk=notice["id"]).update(publish_at=timezone.now() - timedelta(minutes=1))
        with self.captureOnCommitCallbacks(execute=True):
            release_due_announcements()
        self.assertEqual(inbox(), ["emailed@example.test"])


class DeadlineReminderTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.today = timezone.localdate(self.now)
        self.office = make_user("office.rem@example.test", User.Role.OFFICE_ADMIN, email_notifications=False)
        self.student = make_user("student.rem@example.test", email_notifications=True)
        self.quiet_student = make_user("student.quiet.rem@example.test", deadline_reminders=False)
        self.lecturer = make_user("lect.rem@example.test", User.Role.LECTURER, email_notifications=False)
        self.coordinator = make_user("coord.rem@example.test", User.Role.COORDINATOR, email_notifications=False)
        for user, staff_no in ((self.lecturer, "REM-L1"), (self.coordinator, "REM-C1")):
            Lecturer.objects.create(user=user, staff_no=staff_no)
        self.semester = AcademicSemester.objects.create(
            code=f"{self.today.year}-{self.today.year + 1}-S1",
            academic_session=f"{self.today.year}/{self.today.year + 1}",
            term=AcademicSemester.Term.SEMESTER_I,
            starts_on=self.today - timedelta(days=30),
            ends_on=self.today + timedelta(days=120),
            lifecycle_status=AcademicSemester.Lifecycle.ACTIVE,
            created_by=self.office,
            activated_at=self.now,
        )
        self.timeline = SemesterTimeline.objects.create(
            semester="Semester 1", session="2026/2027", academic_semester=self.semester,
            is_active=True, uploaded_by=self.office,
        )

    def entry(self, step, title, days_left, roles):
        return SemesterTimelineEntry.objects.create(
            timeline=self.timeline, level=SemesterTimelineEntry.Level.P1, step=step, title=title,
            detail=f"{title} details.", action_owner="Owner", deadline_start=self.today - timedelta(days=5),
            deadline_end=self.today + timedelta(days=days_left), target_roles=roles,
        )

    def reminders(self, user):
        return list(Notification.objects.filter(recipient=user, module_label="Deadline Reminder").values_list("title", flat=True))

    def test_timeline_reminders_reach_the_target_roles_once(self):
        self.entry(1, "Proposal submission", 2, ["STUDENT"])
        self.entry(2, "Review proposals", 0, ["LECTURER", "OFFICE_STAFF"])
        self.entry(3, "Far away", 10, ["STUDENT"])

        self.assertEqual(send_deadline_reminders(days=3, now=self.now), (3, 0))
        self.assertEqual(self.reminders(self.student), ["Deadline in 2 days: Proposal submission"])
        self.assertEqual(self.reminders(self.lecturer), ["Deadline today: Review proposals"])
        self.assertEqual(self.reminders(self.office), ["Deadline today: Review proposals"])
        self.assertEqual(self.reminders(self.quiet_student), [])
        self.assertEqual(self.reminders(self.coordinator), [])
        self.assertEqual(inbox(), ["student.rem@example.test"])
        today_row = Notification.objects.get(recipient=self.lecturer)
        self.assertEqual((today_row.priority, today_row.target_module), (Notification.Priority.HIGH, "DASHBOARD"))

        self.assertEqual(send_deadline_reminders(days=3, now=self.now), (0, 0))
        self.assertEqual(len(mail.outbox), 1)

    def test_a_moved_deadline_is_reminded_again(self):
        entry = self.entry(1, "Proposal submission", 2, ["STUDENT"])
        send_deadline_reminders(days=3, now=self.now)
        SemesterTimelineEntry.objects.filter(pk=entry.pk).update(deadline_end=self.today + timedelta(days=1))
        self.assertEqual(send_deadline_reminders(days=3, now=self.now), (1, 0))
        self.assertEqual(len(self.reminders(self.student)), 2)

    def test_marks_reminders_go_to_evaluators_with_unsubmitted_tasks(self):
        rubric = Rubric.objects.create(name="Reminder Rubric", code="reminder-rubric")
        closing = EvaluationPeriod.objects.create(
            name="P1 Evaluation", semester="Semester 1", academic_semester=self.semester, rubric=rubric,
            closes_at=self.now + timedelta(days=1), lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
        )
        later = EvaluationPeriod.objects.create(
            name="P2 Evaluation", semester="Semester 1", academic_semester=self.semester, rubric=rubric,
            closes_at=self.now + timedelta(days=20), lifecycle_status=EvaluationPeriod.Lifecycle.PUBLISHED,
        )
        done_lecturer = make_user("lect.done@example.test", User.Role.LECTURER)
        Lecturer.objects.create(user=done_lecturer, staff_no="REM-L2")
        profiles = []
        for index in range(3):
            student = make_user(f"evaluated{index}@example.test")
            Student.objects.create(user=student, matric_no=f"REM-S{index}",
                                   programme="MASTER OF DATA SCIENCE (COURSEWORK)")
            profiles.append(
                StudentResearchProfile.objects.create(
                    student=student, matric_no=f"REM-S{index}", student_name=f"Student {index}",
                    programme="MASTER OF DATA SCIENCE (COURSEWORK)", semester="Semester 1",
                    proposed_topic="Topic", supervisor=self.coordinator,
                )
            )
        no_entry = EvaluationTask.objects.create(profile=profiles[0], evaluator=self.lecturer, period=closing)
        draft = EvaluationTask.objects.create(profile=profiles[1], evaluator=self.lecturer, period=closing)
        MarkEntry.objects.create(task=draft, status=MarkEntry.Status.DRAFT)
        submitted = EvaluationTask.objects.create(profile=profiles[2], evaluator=done_lecturer, period=closing)
        MarkEntry.objects.create(task=submitted, status=MarkEntry.Status.SUBMITTED, submitted_at=self.now)
        EvaluationTask.objects.create(profile=profiles[0], evaluator=done_lecturer, period=later)
        self.assertTrue(no_entry.pk)

        self.assertEqual(send_deadline_reminders(days=3, now=self.now), (0, 1))
        reminder = Notification.objects.get(recipient=self.lecturer)
        self.assertEqual(reminder.title, "Marks due tomorrow: P1 Evaluation")
        self.assertIn("2 evaluation tasks in P1 Evaluation", reminder.message)
        self.assertEqual(reminder.target_module, "MARKS")
        self.assertEqual(self.reminders(done_lecturer), [])
        self.assertEqual(send_deadline_reminders(days=3, now=self.now), (0, 0))

    def test_the_command_can_run_twice(self):
        self.entry(1, "Proposal submission", 1, ["STUDENT"])
        first, second = StringIO(), StringIO()
        call_command("send_deadline_reminders", "--days", "3", stdout=first)
        call_command("send_deadline_reminders", "--days", "3", stdout=second)
        self.assertIn("Sent 1 timeline reminder(s) and 0 Marks reminder(s).", first.getvalue())
        self.assertIn("Sent 0 timeline reminder(s) and 0 Marks reminder(s).", second.getvalue())


class WeeklySummaryTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.opted_in = make_user("weekly@example.test", weekly_summary=True)
        self.opted_out = make_user("noweekly@example.test")
        self.nothing_unread = make_user("allread@example.test", weekly_summary=True)
        for user in (self.opted_in, self.opted_out, self.nothing_unread):
            for title in ("Viva rooms", "Letter ready"):
                Notification.objects.create(recipient=user, title=title, is_read=user == self.nothing_unread)
        old = Notification.objects.create(recipient=self.opted_in, title="Last month")
        Notification.objects.filter(pk=old.pk).update(created_at=self.now - timedelta(days=30))

    def test_only_opted_in_users_with_unread_items_get_one_summary_a_week(self):
        self.assertEqual(send_weekly_summaries(now=self.now), 1)
        self.assertEqual(inbox(), ["weekly@example.test"])
        body = mail.outbox[0].body
        self.assertIn("2 unread notifications", body)
        self.assertIn("Viva rooms", body)
        self.assertNotIn("Last month", body)
        self.assertEqual(send_weekly_summaries(now=self.now), 0)
        self.assertEqual(WeeklySummaryLog.objects.get(user=self.opted_in).notification_count, 2)

        call_command("send_weekly_summary", stdout=StringIO())
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(send_weekly_summaries(now=self.now + timedelta(days=7)), 1)
