from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import override_settings
from rest_framework.test import APITransactionTestCase

from marks import test_completion_windows as fixture


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class AmendmentMigrationTests(APITransactionTestCase):
    setUp = fixture.CompletionWindowTests.setUp
    user = fixture.CompletionWindowTests.user
    lecturer = fixture.CompletionWindowTests.lecturer
    profile = fixture.CompletionWindowTests.profile
    payload = fixture.CompletionWindowTests.payload
    period = fixture.CompletionWindowTests.period
    publish = fixture.CompletionWindowTests.publish

    def test_additive_migration_preserves_academic_records_and_seeds_only_baselines(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        target = [node for node in latest if node[0] != 'appointments'] + [('appointments', '0012_co_supervisor_team')]
        try:
            executor.migrate(target)
            apps = executor.loader.project_state(target).apps
            Task = apps.get_model('marks', 'EvaluationTask')
            Entry = apps.get_model('marks', 'MarkEntry')
            Score = apps.get_model('marks', 'MarkScore')
            submitted = Entry.objects.create(task_id=self.task.pk, status='SUBMITTED', total_mark=81)
            panel_task = Task.objects.create(period_id=self.period_obj.pk, evaluator_id=self.panel.pk,
                                        profile_id=self.student_profile.pk, evaluator_role='PANEL')
            draft = Entry.objects.create(task=panel_task, status='DRAFT', total_mark=72)
            for entry, score in ((submitted, 81), (draft, 72)):
                Score.objects.create(entry=entry, component_id=self.rubric.components.get().pk,
                                     marks_awarded=score, feedback='Preserved feedback')
            labels = ('accounts.Student', 'appointments.SupervisorApplication',
                      'appointments.SupervisorAppointment', 'appointments.PanelAppointment',
                      'appointments.StudentResearchProfile', 'marks.EvaluationTask', 'marks.MarkEntry', 'marks.MarkScore')
            before = {label: list(apps.get_model(label).objects.order_by('pk').values()) for label in labels}
            executor = MigrationExecutor(connection)
            executor.migrate(latest)
            apps = executor.loader.project_state(latest).apps
            for label, rows in before.items():
                if rows:
                    self.assertEqual(list(apps.get_model(label).objects.order_by('pk').values(*rows[0])), rows)
            profiles = apps.get_model('appointments', 'StudentResearchProfile')
            revisions = apps.get_model('appointments', 'ResearchProfileRevision')
            self.assertEqual(revisions.objects.count(), profiles.objects.count())
            self.assertFalse(revisions.objects.exclude(kind='BASELINE', revision=0, actor=None).exists())
            self.assertFalse(apps.get_model('appointments', 'ResearchAmendment').objects.exists())
        finally:
            MigrationExecutor(connection).migrate(latest)
