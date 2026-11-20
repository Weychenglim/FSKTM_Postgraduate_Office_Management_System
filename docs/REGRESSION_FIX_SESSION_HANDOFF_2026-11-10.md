# Regression repair handoff — 10 November 2026

## Next session request

Fix the full-regression failures below, verify the causes with focused tests, then run the complete regression suite. Keep replies short. No Office confirmation is needed for test repair or demonstrated implementation bugs within the agreed scope. Do not weaken assertions or remove safeguards to get green results.

## Workspace and boundaries

- Repository: `C:/Users/User/Documents/FKSTM_Postgraduate_Management_System`.
- Branch: `codex/portal-consistency-and-toast`. Many tracked and untracked changes already exist, including unrelated work. Inspect status/diffs and preserve them; do not reset or discard.
- Read AGENTS.md and maintain PROJECT_REQUIREMENTS.md, ARCHITECTURE_AND_CODING_DESIGN.md and PROJECT_STATUS.md as relevant.
- Stages 1–3 RP1/RP2 integration is implemented locally. Xiang accepted the technical direction according to the user; this is not Office policy approval.
- Stage restrictions on appointment applications, stage population and academic treatment of wrong-stage submitted marks remain Office-dependent. Do not infer registrations from dates, intake or appointments.
- No commits or pushes have been made for this work.

## Completed cleanup and real database state

All three TypeScript errors were fixed: missing AlertTriangle import in MarkEntryDetail.tsx; explicit OperationalHistoryEvent[] state type in periodHistory.fixture.tsx; obsolete onHelpdeskTrigger prop removed from phaseSixFeedback.fixture.tsx. Frontend lint and production build passed.

All pending migrations, including marks.0014, were actually applied to local PostgreSQL `localhost:5432/fsktm_pg_office`, after backup and successful restore/migration rehearsal. Do not trust earlier historical PROJECT_STATUS paragraphs saying they are pending.

- Backup: `C:/Users/User/Documents/FKSTM_Database_Backups/fsktm_before_upgrade_20261110_015758.dump` (custom pg_dump archive, 863417 bytes).
- Backup metadata: `C:/Users/User/Documents/FKSTM_Database_Backups/latest_upgrade_backup.json`.
- Rehearsal database was dropped. All 13 students remain; migrations seeded 16 StudentSemester records; ProjectRegistration count is zero. Existing migrations also enabled email preferences and updated FAQ/template data; empty legacy tag tables were removed.
- Django check and migrate --check passed. Never use the real database for regression tests.

## Regression evidence

Full backend run: 2358 tests in 1376.386 seconds; 2335 passed, 9 failures, 12 errors, 2 skipped. Unique temporary PostgreSQL test database was destroyed afterward. Failure traces:

`C:/Users/User/Documents/FKSTM_Database_Backups/full_regression_20261110.log`

Frontend periodHistory and projectStages browser runners passed. phaseSixFeedback failed scenario count: expected 32, fixture reports/defines 23. No assertions have been weakened.

## Cause investigation — read code, not yet repaired/retested

These conclusions come from tracing the report against source. Confirm with focused runs; do not assume every failing test needs only a fixture change.

1. **15 backend cases hit new stage guards.** Older fixtures create EvaluationPeriod without assessment P1/P2 and/or omit confirmed ProjectRegistration. Helpers include `appointments/test_co_supervision_lifecycle.py:submitted_marks`, `appointments/test_appointment_lifecycle.py`, `appointments/test_amendment_lifecycle.py`, and `appointments/test_supervisor_workflow.py`. Completion-window eligibility calls profile_stage_eligibility; generation/replacement also fail closed. This explains 12 errors (completion grants, missing replacement tasks, co-supervision generation), two compound lifecycle HTTP 409-vs-400 failures and the supervisor Marks handoff 409-vs-201 failure. Give fixtures valid exact-semester stage data, retaining negative-test intent and existing assertions.
2. **Four reminder failures:** `announcements/test_reminders.py:DeadlineReminderTests`. Timeline fixture sets is_active but not is_published; `announcements/reminders.py:timeline_notices` now reads published timelines only. Marks reminder fixtures also lack stage configuration/confirmation; connected_reminders uses task_access. Use genuine publication fixtures/patterns; check additional reminder expectations after setup is corrected.
3. **One nomination concurrency failure:** `appointments/test_co_supervision_concurrency.py:test_competing_nominations_cannot_claim_same_last_team_position` first creates a pending nomination, then expects one more concurrent nomination to commit. `appointments/co_supervision.py:_check_candidate` explicitly rejects any new nomination while one is already pending, so both conflict. Rework setup to test the current rule/race meaningfully; verify intended policy from existing requirements/tests before changing expectations. Do not remove the guard.
4. **One lifecycle concurrency failure:** `accounts/test_compound_lifecycle_acceptance.py:CompoundLifecycleFixture.draft` creates MarkEntry with comments/scores but no explicit status. Model default is NOT_STARTED, while race assertion expects DRAFT after withdrawal. Explicitly build a real draft and rerun both race outcomes. Stage fixture gaps also affect this class.
5. **Browser coverage mismatch:** `frontend/tests/phaseSixFeedback.browser.test.mjs` expects 32, but phaseSixFeedback.fixture.tsx contains 23 await run calls. Investigate history/intended coverage and restore missing scenarios if needed; do not simply lower 32. The count assertion executes before individual results are printed, so individual scenario success is not established.

## Suggested execution

1. Inspect current diffs and relevant fixtures; use systematic debugging/TDD as applicable. Preserve production safeguards and unrelated edits.
2. Repair minimal fixture gaps and rerun affected modules/classes in an isolated PostgreSQL test database: accounts.test_compound_lifecycle_acceptance; appointments.test_amendment_lifecycle; appointments.test_appointment_lifecycle; appointments.test_co_supervision_lifecycle; appointments.test_supervisor_workflow; appointments.test_co_supervision_concurrency; announcements.test_reminders.
3. Investigate browser coverage and run `node --test tests/phaseSixFeedback.browser.test.mjs` from frontend. Include periodHistory and projectStages runners for final verification.
4. Run full backend suite after focused passes; earlier run took about 23 minutes. Use unique test database name and fast MD5 hasher only inside test process. Django's test runner must destroy its test database.
5. Run frontend lint/build and git diff --check. Update status with exact results. Historical status paragraphs currently contain superseded pending/TypeScript statements; make the latest state unambiguous.

Previously used full-suite command from backend (PowerShell here-string piped to `..\.venv\Scripts\python.exe`):

```python
import os, uuid
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.conf import settings
settings.DATABASES['default']['TEST']['NAME'] = 'test_full_' + uuid.uuid4().hex[:8]
settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
from django.core.management import call_command
call_command('test', verbosity=1, interactive=False)
```

Prior scope references: docs/RP_STAGE_CROSS_MODULE_SESSION_HANDOFF_2026-11-09.md and docs/RP_STAGE_REPLY_TO_XIANG_2026-11-09.md. These are context, not new authorization to implement Office-dependent policy.
