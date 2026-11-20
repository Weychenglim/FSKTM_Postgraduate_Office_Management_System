from django.db import migrations, models


def remove_backup_tasks(apps, schema_editor):
    database = schema_editor.connection.alias

    def rows(name):
        return apps.get_model("marks", name).objects.using(database)

    tasks = rows("EvaluationTask").filter(evaluator_role="BACKUP").order_by()
    task_ids = tasks.values("pk")
    entries = rows("MarkEntry").filter(task_id__in=task_ids)
    windows = rows("TaskCompletionWindow").filter(task_id__in=task_ids)
    window_ids = windows.order_by().values("pk")

    rows("EvaluationTaskOverrideAudit").all().delete()
    rows("EvaluationTaskLifecycleAudit").filter(task_id__in=task_ids).delete()
    rows("EvaluationTaskHandoverAudit").filter(task_id__in=task_ids).delete()
    rows("EvaluationTaskHandoverAudit").filter(replacement_task_id__in=task_ids).update(
        replacement_task=None,
    )
    rows("MarkSubmissionReceipt").filter(task_id__in=task_ids).delete()
    rows("MarkCorrectionAudit").filter(entry_id__in=entries.order_by().values("pk")).delete()
    entries.delete()
    rows("TaskCompletionWindowAudit").filter(window_id__in=window_ids).delete()
    windows.update(supersedes=None)
    windows.delete()
    tasks.delete()
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("SET CONSTRAINTS ALL IMMEDIATE")


class Migration(migrations.Migration):
    dependencies = [("marks", "0014_stage_review_audit_action")]

    operations = [
        migrations.RunPython(remove_backup_tasks, migrations.RunPython.noop),
        migrations.DeleteModel(name="EvaluationTaskOverrideAudit"),
        migrations.AlterField(
            model_name="evaluationtask",
            name="evaluator_role",
            field=models.CharField(
                choices=[("SUPERVISOR", "Supervisor"), ("PANEL", "Panel")],
                db_index=True,
                default="PANEL",
                max_length=16,
            ),
        ),
        migrations.AddConstraint(
            model_name="evaluationtask",
            constraint=models.CheckConstraint(
                condition=models.Q(evaluator_role__in=["SUPERVISOR", "PANEL"]),
                name="evaluation_task_official_role",
            ),
        ),
    ]
