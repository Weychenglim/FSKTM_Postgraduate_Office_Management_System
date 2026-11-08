"""Publication fields preserve all historical configuration and marks."""
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class PublicationMigrationTests(TransactionTestCase):
    def test_legacy_rows_stay_unclassified_and_all_marks_are_unchanged(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        before = [node for node in latest if node[0] != "marks"] + [("marks", "0012_rubric_archived")]
        try:
            executor.migrate(before)
            executor = MigrationExecutor(connection)
            apps = executor.loader.project_state(list(executor.loader.applied_migrations)).apps
            Rubric = apps.get_model("marks", "Rubric")
            Period = apps.get_model("marks", "EvaluationPeriod")
            rubric = Rubric.objects.create(name="Legacy Supervisor Panel", code="legacy-sup-panel", family_code="legacy-sup-panel")
            periods = [Period.objects.create(name=state, semester="Historical", rubric=rubric, lifecycle_status=state)
                       for state in ("DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED")]
            User = apps.get_model("accounts", "User")
            Profile = apps.get_model("appointments", "StudentResearchProfile")
            Task = apps.get_model("marks", "EvaluationTask")
            Entry = apps.get_model("marks", "MarkEntry")
            Score = apps.get_model("marks", "MarkScore")
            Component = apps.get_model("marks", "RubricComponent")
            evaluator = User.objects.create(email="publication-migration@example.test", full_name="Evaluator", role="LECTURER", password="!")
            profile = Profile.objects.create(matric_no="PUB-MIGRATION", student_name="Student", programme="Computing", semester="Historical", proposed_topic="Research", supervisor=evaluator)
            component = Component.objects.create(rubric=rubric, code="total", name="Total", max_marks="100.00")
            for period, status in zip(periods[1:], ("DRAFT", "SUBMITTED", "SUBMITTED")):
                task = Task.objects.create(profile=profile, evaluator=evaluator, period=period, evaluator_role="PANEL")
                entry = Entry.objects.create(task=task, status=status, total_mark="87.00", comments="Preserved comments")
                Score.objects.create(entry=entry, component=component, marks_awarded="87.00", feedback="Preserved feedback")
            names = ("Rubric", "RubricComponent", "EvaluationPeriod", "EvaluationTask", "MarkEntry", "MarkScore")
            snapshots = {name:list(apps.get_model("marks", name).objects.order_by("pk").values()) for name in names}
            executor = MigrationExecutor(connection)
            executor.migrate(latest)
            executor = MigrationExecutor(connection)
            apps = executor.loader.project_state(list(executor.loader.applied_migrations)).apps
            for name, rows in snapshots.items():
                self.assertEqual(list(apps.get_model("marks", name).objects.order_by("pk").values(*rows[0])), rows)
            self.assertEqual(apps.get_model("marks", "Rubric").objects.get(pk=rubric.pk).allowed_evaluator_roles, [])
            self.assertEqual(list(apps.get_model("marks", "EvaluationPeriod").objects.filter(pk__in=[period.pk for period in periods]).values_list("assessment", flat=True)), ["", "", "", ""])
        finally:
            MigrationExecutor(connection).migrate(latest)
