from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import override_settings
from rest_framework.test import APITransactionTestCase

from . import test_completion_windows as fixtures


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class BackupRemovalMigrationTests(APITransactionTestCase):
    setUp = fixtures.CompletionWindowTests.setUp
    user = fixtures.CompletionWindowTests.user
    lecturer = fixtures.CompletionWindowTests.lecturer
    profile = fixtures.CompletionWindowTests.profile
    payload = fixtures.CompletionWindowTests.payload
    period = fixtures.CompletionWindowTests.period
    publish = fixtures.CompletionWindowTests.publish

    def test_removes_backup_work_and_preserves_official_marks(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        previous = [node for node in latest if node[0] != "marks"] + [
            ("marks", "0014_stage_review_audit_action"),
        ]
        try:
            executor.migrate(previous)
            apps = executor.loader.project_state(previous).apps
            Task = apps.get_model("marks", "EvaluationTask")
            Entry = apps.get_model("marks", "MarkEntry")
            Window = apps.get_model("marks", "TaskCompletionWindow")
            backup = Task.objects.create(
                period_id=self.period_obj.pk, profile_id=self.student_profile.pk,
                evaluator_id=self.panel.pk, evaluator_role="BACKUP",
            )
            deadline = self.period_obj.closes_at
            first_window = Window.objects.create(
                task=backup, deadline=deadline, ended_at=deadline, granted_by_id=self.office.pk,
            )
            next_window = Window.objects.create(
                task=backup, deadline=deadline, supersedes=first_window, granted_by_id=self.office.pk,
            )
            apps.get_model("marks", "TaskCompletionWindowAudit").objects.create(
                window=next_window, action="GRANTED", actor_id=self.office.pk,
            )
            backup_entry = Entry.objects.create(
                task=backup, status="SUBMITTED", total_mark=75,
                submitted_completion_window=next_window,
            )
            apps.get_model("marks", "MarkCorrectionAudit").objects.create(
                entry=backup_entry, actor_id=self.office.pk, reason="Backup correction",
                before_values={}, after_values={},
            )
            apps.get_model("marks", "EvaluationTaskOverrideAudit").objects.create(
                task=backup, actor_id=self.office.pk, new_evaluator_id=self.panel.pk,
            )
            official = Entry.objects.create(task_id=self.task.pk, status="SUBMITTED", total_mark=81)
            official_window = Window.objects.create(
                task_id=self.task.pk, deadline=deadline, granted_by_id=self.office.pk,
            )

            executor = MigrationExecutor(connection)
            executor.migrate(latest)
            migrated = executor.loader.project_state(latest).apps
            self.assertFalse(migrated.get_model("marks", "EvaluationTask").objects.filter(pk=backup.pk).exists())
            self.assertFalse(migrated.get_model("marks", "MarkEntry").objects.filter(pk=backup_entry.pk).exists())
            self.assertFalse(migrated.get_model("marks", "TaskCompletionWindow").objects.filter(pk=next_window.pk).exists())
            self.assertEqual(migrated.get_model("marks", "MarkEntry").objects.get(pk=official.pk).total_mark, 81)
            self.assertTrue(migrated.get_model("marks", "TaskCompletionWindow").objects.filter(pk=official_window.pk).exists())
            self.assertNotIn("marks_evaluationtaskoverrideaudit", connection.introspection.table_names())
        finally:
            MigrationExecutor(connection).migrate(latest)
