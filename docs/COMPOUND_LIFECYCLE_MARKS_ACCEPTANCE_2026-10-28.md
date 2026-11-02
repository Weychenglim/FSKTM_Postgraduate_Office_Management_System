# Compound lifecycle and Marks acceptance — 28 October 2026

## Scope and approach

A06 continues the five owned modules on `codex/portal-consistency-and-toast`, starting at `c062330`. Existing A05 source, Office rollout evidence and the separate manual UAT preparation were preserved. This pass exercises existing business services and API contracts in synthetic PostgreSQL test databases; it does not manufacture live academic outcomes or introduce a new workflow.

The chosen approach is persisted/API acceptance plus targeted production-component browser checks. Rebuilding lifecycle features would add unnecessary risk; a broad green test count alone would also miss privacy across nested projections. Assertions therefore check exact retained Marks, linked appointment outcomes, immutable audit counts, rejected writes and complete rollback, followed by role-specific reads.

## Confirmed defects and corrections

1. Withdrawal/graduation copies the private participant reason into ended appointment records. The Student dossier included the primary appointment's `endReason`; Student Supervisor request list/detail APIs also returned the staff closure reason, actor and lifecycle audit. Public projections now omit the dossier reason and return an empty private lifecycle projection from the application serializer. Every application response supplies its request context; context-free serialization defaults to the public projection. Authorized staff keep their recorded reasons and audits.
2. Withdrawal cancels a pending primary replacement using the same private participant reason. Student application list/detail and dossier cancellation fields exposed it, and the application workflow exposed the lifecycle event. Public projections redact that specific lifecycle cancellation reason/event while preserving the cancelled status/date and ordinary application decisions/reasons. Stored data and staff history remain complete.
3. The dossier UI rendered supplied closure fields and workflow audits without an internal-visibility guard. Primary/Panel workflow and closure rendering and supporting closure text now require internal visibility. The browser regression deliberately contaminates an otherwise real public response to verify the UI guard independently of API redaction.

Failing-before evidence: the initial terminal dossier privacy assertion failed with the stored reason in the nested appointment. A separate request-history reproduction failed for list and detail (one test, two failed subtests, 0.400s). Pending replacement privacy failed at all three read surfaces. With API redaction already applied, removing only the new UI closure guards reproduced a browser failure (4.607s); adding a supplied workflow audit independently reproduced the missing audit guard (6.374s). These are application privacy defects. Initial harness corrections for Student tab labels, expected rejection status codes and operational report exclusion of retired drafts were test mistakes, not additional product bugs.

## New persisted and concurrency coverage

`backend/accounts/test_compound_lifecycle_acceptance.py` supplies guarded synthetic primary, Panel and supporting appointments, a submitted score of 85, a draft score of 46 and optional completion windows/pending work. Office has neither staff nor superuser flags.

| Combination | Persisted/API evidence |
| --- | --- |
| Withdrawal with a complete team, pending support, amendment, draft and extension | All three appointments end with Withdrawn; pending nomination/amendment cancel; draft retires and window invalidates; scores/comments/submitted entry remain exact. |
| Graduation with pending supporting nomination | Conflict has no writes; reasoned Office cancellation resolves the blocker; the team completes; submitted Marks remain; terminal reactivation rejects. |
| Graduation with unfinished Marks | Conflict leaves every snapshotted row unchanged, including active supporting membership. |
| Deferral/return after the Panel appointment ends | Paused draft retires on return, old extension stays invalidated, generation cannot revive the ended assignment and direct draft writes reject. |
| Deferral/return with current appointments | Task resumes within the ordinary open period; the old extension remains invalidated; Marks remain exact. |
| Participant audit-write failure during withdrawal | Appointment closures, nomination/amendment cancellation, task/window changes and all snapshotted audit/notification/token state roll back; a later real retry succeeds. |
| Marks lifecycle audit-write failure during deferral | Student/task/window and audit state roll back together. |
| Coordinator responsibility/delegation retirement | Managed programme and active delegation independently block retirement; Retiring loses effective scope; revocation plus an already completed responsibility handover allows retirement without changing Marks. Responsibility handover is a controlled fixture, not a newly certified Registry UI flow. |
| Lecturer retirement audit-write failure | Draft/window changes, login disablement and refresh-token blacklist roll back; successful retry retires the task, disables the account and blacklists its token. |
| Pending supporting candidate retirement | Pending work blocks retirement; reasoned cancellation resolves it; stale acceptance cannot revive it. |
| Deferred Student assignment bypasses | Direct supporting, Panel, primary replacement, backup and completion-window requests and Marks submission reject; generation creates nothing; snapshots remain unchanged. |
| Retiring Lecturer assignment bypasses | Direct primary replacement, Panel, supporting and backup identifiers reject without side effects. |
| Terminal historical access | Student sees public status/team results without private reasons or Marks; supporting member keeps own appointment history but gains no Marks or dossier access; primary keeps submitted history; Office retains retired record detail. Operational JSON/XLSX excludes retired drafts and preserves submitted rows. |
| Primary request privacy | Student list/detail/dossier exclude private terminal and cancellation reasons; staff detail retains them; context-free serialization fails closed. |
| Competing terminal outcomes | Exactly one graduation/withdrawal transition succeeds; one conflict, one participant audit and one closure per appointment. |
| Duplicate withdrawal/deferral | Pending work/task/window effects and participant audits occur once; Marks remain exact. |
| Marks submission competing with withdrawal | Both valid serial outcomes are checked: a committed submission remains immutable, or withdrawal retires the untouched draft and the write rejects. No duplicate submission receipt or editable terminal task. |

## Browser evidence

`dashboard.reporting_browser_journey.TerminalLifecycleBrowserJourney` adds two opt-in journeys at exact 1440px and 390px, separate from the historical six A05 journeys. Each uses production dossier components, authenticated real HTTP and real terminal state, and checks 12 assertions: public status/Marks exclusion, API list/detail/dossier privacy, ended supporting history, independent contaminated-response UI guards, retained Office reason/audit and viewport containment. The reused harness checks that browser reads change no owned academic rows and parses actual role-scoped XLSX responses.

Only the contaminated-response assertion injects extra fields; it is explicitly a UI defense check. Normal API/privacy assertions use unmodified responses. This is not full login-shell, native download saving or deployment acceptance.

## Verification

The final scoped gate passed **22 tests in 45.772s** (20 persisted/API/concurrency cases and two browser journeys with 24 assertions), including the submission/withdrawal race and the independent audit-rendering guard. The wider gate passed **793 tests in 325.738s**, covering all Appointments, Marks and Dashboard suites plus focused participant lifecycle, compound, delegation and Office authorization suites. Fast MD5 password hashing was set only in that test process; production authentication settings were unchanged. The final source integration recheck passed **59 tests in 75.385s**: all 20 new cases, Office primary replacement, workflow ageing and the eight A05/A06 browser journeys with 156 assertions. TypeScript and nine frontend checks passed; the production build passed with 2514 modules in 25.10s and the existing ExcelJS chunk-size advisory. Django checks, migration drift, Python/Node syntax and whitespace checks passed. All `test_a06_*` databases were destroyed and their absence verified. Counts from overlapping gates must not be added.

Reproduce the scoped gate with a normal disposable Django test database:

```powershell
.\.venv\Scripts\python.exe backend/manage.py test accounts.test_compound_lifecycle_acceptance dashboard.reporting_browser_journey.TerminalLifecycleBrowserJourney --noinput
```

The browser harness requires the existing Node dependencies, Chrome/Edge and a frontend production build. Fixture guards reject a database name without `test_`. Audit-outage injection replaces only the failing database write; business transitions and their other effects remain real. Concurrent tests use separate PostgreSQL connections and bounded lock waits.

## Boundaries and next work

This establishes core A06 technical acceptance, with two targeted browser journeys. It does not certify every manual compound clause or every historical screen/export combination. Full-shell human role changes, native file saving/alerts and remaining date controls remain A07 and the sequential manual guide. Actual Coordinator responsibility transfer through the shared Registry, external faculty/template rules, cross-account Coordinator identity policy and production-host acceptance retain their existing boundaries. Prior A01–A05 reports remain scoped evidence; historical checklist totals are unchanged.

No live account/academic writes, password reset, schema migration, dependency addition, process restart, deployment, commit or push is part of this pass. Existing UAT servers and data were preserved. Direct source review is used; no independent reviewer result is claimed.
