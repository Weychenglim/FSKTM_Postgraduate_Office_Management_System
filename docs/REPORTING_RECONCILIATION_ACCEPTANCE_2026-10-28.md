# A05 reporting, dossier and reconciliation acceptance

28 October 2026. Source base: `codex/portal-consistency-and-toast` at `3070332`, with the earlier local Office rollout and unrelated working changes preserved. This report records the owned-module A05 pass and its explicit boundaries.

## Approach and critical review

The approved scope is acceptance of existing reports, exports, dossiers, reconciliation and related Dashboard/Timeline behavior. Reuse existing workflows, fix only reproduced defects, and use disposable PostgreSQL fixtures rather than live academic mutations.

The plan was to compare persisted results and exported contents, exercise real production screens over authenticated HTTP, reproduce any defect before changing source, then run neighboring regressions and update the source documents. A healthy response or a generated download name alone cannot establish privacy, workbook correctness or transaction safety. Historical semester attribution, current programme authorization and faculty-wide operational capacity are distinct projections; an entire 406-clause requirement inventory cannot be certified from this slice.

## Reproduced defect and fix

`StudentProgressDossier` accepted late success, error and completion callbacks after the selected student changed. A held real response for student A could replace an already rendered student B dossier. This was an incorrect displayed identity even though each individual API request was authorized.

The desktop regression failed before the production change at “Late previous-student response cannot replace the current dossier” (isolated red run: one failing test, 5.498 seconds). The fix adds a request generation guard, invalidation on effect cleanup/unmount, cleared prior dossier data and a loaded-student identity check. Obsolete success, error and completion callbacks cannot update the current record or dismiss a newer loading state. No API, database, authorization or dependency contract changed.

Permanent desktop/phone regressions additionally verify an old completion while the newer request is held, a late prior-student 404, correct newer identity and removal of the previous identity on unknown navigation.

## Persisted combinations

Nine new `dashboard.test_reporting_acceptance` cases verify:

1. Office, programme Coordinator, primary and supporting Lecturer report totals and ordered record IDs agree with actual parsed XLSX sheets. Coordinator workbooks omit Marks. Formula-leading fictional student names remain literal text, with no formula cells. Reads leave stored assignments, Marks and appointments unchanged.
2. Deferral through the lifecycle service preserves public status while Student dossiers exclude private lifecycle reasons, Marks and internal calendar rows. Foreign dossiers return 404 and Student reports/exports return 403.
3. Real supporting nomination/replacement/closure updates report lifecycle and successor fields; former supporting members retain their own history without current research or Marks rights. Student dossiers exclude the Office closure reason; stored Marks remain intact.
4. Two-stage programme transfer changes Student/research programme values together. Source-Coordinator current appointment/dossier access is removed, destination access is granted and the source actor retains their own transfer-decision history. Team, task, score and submitted-Mark rows remain identical.
5. Granting then revoking acting delegation changes current report, workbook and dossier scope immediately while keeping academic/Marks rows intact.
6. Real semester activation/handover leaves original-semester Marks visible in historical reports/dossiers while active-semester filters and dossier timeline context move to the new semester. Academic assignment and submitted-Mark rows remain intact.
7. Repair requires an Office reason and valid preview. Stale/replayed requests do not produce duplicate changes or audits. The exact record-scoped audit contains the real Office actor, reason and before/after semester values; non-Office list/audit access is denied and audit rewriting fails.
8. An injected audit-write database failure rolls back the entire repair; the request remains in the Unassigned report with no repair audit or unrelated academic changes.
9. An actual request-status change after preview changes its fingerprint and rejects the old preview. Student, Lecturer and Coordinator repair POSTs cannot apply even a fresh fingerprint.

## Production-component and real-HTTP journeys

`dashboard.reporting_browser_journey` launches the production React components against Django's live test server at exact **1440px and 390px** CSS widths. Every fixture rejects non-`test_` databases; the Node runner also refuses development-server ports. Real academic responses are used throughout. Transport failures and response ordering are deliberately controlled at the browser boundary for recovery/race tests.

| Journey | Assertions per width | Evidence |
| --- | ---: | --- |
| Reports, exports and dossiers | 40 | Office/Coordinator/primary/supporting role data, report totals, programme/semester selections, real export bytes, named blob handoff, retry/export disabling, public dossier privacy, foreign-record denial and exact Office Marks identity. |
| Reconciliation and calendar | 17 | Real legacy issue, mandatory reason/acknowledgement, stale rejection, confirmation, one committed repair/audit, immediate historical report correction, actual timeline CRUD, production management/history reads and read-error recovery. |
| Dossier response ordering | 9 | Old success/error/completion isolation, loading-state ownership, exact current student and unknown-record clearing. |

These are **six browser journeys and 132 browser/API assertions**. Python independently parses real authenticated XLSX responses after each journey and checks scope/formula safety. For read-only journeys, exact rows across accounts, academics, appointments, Marks and dashboard stay unchanged. The reconciliation journey permits only the intended legacy request's semester field, one reconciliation audit and three Office timeline audit rows; after temporary event deletion all original timeline-entry rows remain identical.

Native save-to-disk behavior is intentionally outside this test: the native anchor click is captured after the real authorized blob is fetched and its filename/URL prepared. Filesystem download acceptance stays A07. The timeline create/edit/delete operations use the production API contracts; management/history/retry views are mounted production UI. Existing mounted timeline tests separately cover create/edit failures and field retention. This does not claim a new real-HTTP modal submission journey for every timeline form.

## Verification and reproducibility

Run the opt-in core slice with the repository virtual environment and disposable PostgreSQL test database:

```powershell
.venv/Scripts/python.exe backend/manage.py test dashboard.test_reporting_acceptance dashboard.reporting_browser_journey --noinput
```

The browser runner requires the installed frontend dependencies, a current `frontend/dist` production CSS build and Chrome/Edge. It never points at the local development API. Node subprocess output contains assertion labels, not credentials or real academic data.

Fresh final verification:

- The final core gate passed **15 tests in 56.994 seconds**: nine persisted/API cases plus the six real-HTTP journeys and all 132 assertions. Database `test_a05_final_20261028` was destroyed normally.
- The broader gate passed **194 backend tests in 363.626 seconds**, covering `dashboard`, `appointments.test_supervision_export`, `accounts.test_delegations`, `accounts.test_participant_lifecycle`, `appointments.test_research_amendments`, `appointments.test_capacity_reassessment` and `accounts.test_office_authorization`. Database `test_a05_regression_20261028` was destroyed normally. These 194 include the same nine API tests; the counts are not additive.
- Seven related frontend utility/component scripts passed. Existing reconciliation and timeline/workflow browser suites passed separately: 54 and 30 viewport scenarios, using simulated service responses rather than real academic APIs.
- Final TypeScript passed. Production build passed in **16.37 seconds**, transforming 2514 modules, with the existing ExcelJS large-chunk advisory.
- Django system checks, migration drift, Python AST, Node syntax and whitespace checks passed. A final database query found no remaining `test_a05_*` databases. The earlier Office conversion remains intact: preview reports zero legacy staff flags.

Initial harness errors were corrected without changing business code: fixture lifecycle status casing/candidate eligibility, the timeline PATCH contract, hidden history versus current-row assertions and portal-rendered toast selection. The dossier response-ordering failure was the demonstrated production defect. The scoped runs distinguish backend/API evidence, real-HTTP component journeys and simulated-response browser evidence. Direct review completed; no whole-project certificate or independent reviewer pass is inferred.

During the initial export harness run, Chrome actually saved one Office workbook before the harness timed out waiting for its portal-rendered toast. Its generated date, Office role and unique A05 synthetic rows were verified with openpyxl; the artifact was moved from Downloads to ignored `backend/.env.a05-office-report-observed.xlsx`. Existing unrelated Downloads files were untouched. This single observed file does not certify all A07 native-download cases; repeatable journeys capture the native save boundary as described above.

## Remaining boundaries

The named A05 paths now have core persisted/browser evidence. Remaining supporting/transfer/delegation/carryover combinations involving terminal participant transitions, every historical-access/assignment-bypass variant and additional audit-outage/concurrency cases remain A06. Full application-shell login paths, native downloads, native alerts and remaining availability-date controls remain A07. Production deployment, external faculty rules/templates, Registry transfer relocation and deferred Marks template work remain separate.

No live academic records, passwords, account flags, backend process or deployment changed during this slice. Earlier local Office conversion remains intact. No commit or push is included. Historical checklist counts remain unchanged; E15 attaches evidence without promoting unexercised compound/external clauses.
