# Phase four: calendar and academic setup

Approved continuation of package four in `FIVE_MODULE_NOTIFICATION_CONFIRMATION_REVIEW_2026-10-29.md`. Preserve earlier phase changes and unrelated capacity/reporting work. Work locally without committing, pushing, backend changes, dependencies or live academic writes.

## Rules

Use one effective router/unload/logout guard per reachable editor, reporting to an existing RecordPage when nested. Dirty means deviation from the initialized baseline. Pending writes cannot be dismissed; successful writes clear only the committed draft before refreshing. A failed write keeps input. A committed write followed by a failed read must be described honestly and cannot be repeated accidentally. Preserve current authorization, optimistic versions, signed previews, closure acknowledgments and audit requirements. Browsing and previews remain quiet. Routine outcomes use the shared retained feedback owner; failures and recovery remain contextual.

## Task 1: Calendar ownership and both-method retention

- [x] Add reusable standalone draft guard fallback using the existing RecordDraft and SessionExit contracts, with no duplicate blocker under a RecordPage. Reuse it for Add/Edit calendar editors.
- [x] Protect local Cancel/X/Escape/backdrop, actual router navigation, browser Back and native unload, including pending work. Clean/reverted editors leave quietly. Native warning is protected in code and synthetic-event tested; actual browser-dialog acceptance remains phase seven.
- [x] Create/import switching retains both drafts. Committing one method must not silently destroy writing in the other; clear only the committed method and keep the other available. An entirely completed editor closes cleanly.
- [x] Keep import preview token/acknowledgment and atomic write intact. Preview is quiet, template preparation feedback honest. Shared completion survives editor closure. Read failure after commit is distinct from failed mutation. Follow-up fixes separate template feedback and request/session identity from import validation/file selection; mounted retry and pending-response regressions pass.
- [x] Mounted behavioral regressions, failing first; success/failure/pending, both-method retention, standalone and nested ownership.

## Task 2: Semester transitions and private availability draft

- [x] Protect local semester transition Cancel/X and action replacement, initialized extension defaults and pending dismissal. Keep existing signed activation/handover and closure review authoritative, with one final review.
- [x] Preserve form/transition input after failure; clear successful baseline before reload. Use retained shared routine feedback and honest committed-refresh warning. Further writes stay blocked until a successful latest-list read; unresolved local disposal/replacement choices block the original submit path.
- [x] Include lecturer cancellation reason in page and dialog dirtiness, clear it on explicit discard or completion, retain it after failure. Preserve visible create draft and intentional semester-switch behavior.
- [x] Mounted regressions for create/edit, extend/end/archive and signed handover boundaries; cancellation Keep/discard/failure/success with unrelated create draft retained.

## Task 3: Capacity and operational-period guard ownership

- [x] Reuse fallback guard for capacity single/bulk/publication/discard and operational overview decisions/extensions. Existing nested RecordPages own their guard; do not register a competing blocker.
- [x] Capacity discard reason is protected on router/unload/logout as well as local dismissal. Pending navigation resolves after commit without a false discard prompt, failed writes stay protected.
- [x] Ensure shared feedback remains mounted for single/bulk/prepare/publication/discard outcomes, preserve versions/fingerprints and aggregate bulk review.
- [x] Inspect all operational period kinds and calendar connection/date import; protect overview enforcement and common/personal deadline drafts; keep initialized defaults clean and existing final consequence reviews.
- [x] Mounted regressions for real hosts and nested ownership; rerun relevant existing period/capacity/calendar suites. Optional RecordPage settlement covers data/non-data routers and preserves explicit completed-owner allowance.

## Completion

- [x] Independent task reviews and final integration review; resolve actionable issues. Source reviews and scoped re-reviews report no remaining actionable code findings; final evidence reconciliation retained below.
- [x] TypeScript, production build, frontend source tests and relevant browser suites. Record actual passing case counts and limitations, distinguishing synthetic unload events from native browser acceptance.
- [x] Update audit and all three mandatory project documents. Packages five through seven remain separate.

## Action coverage register

All three tasks and follow-up fixes passed independent source review. Initial failing runs, scoped review fixes and final manifest appear below. Reports/logs are retained in ignored `.superpowers/sdd/phase-four-setup/`; historical duplicated cases, partial failures and screenshot previews are excluded from final coverage totals. This is component-level evidence, not promotion of unrun manual acceptance cases.

These entries identify the real controls in scope. Final evidence is recorded per task; an entry here is not a test-pass claim.

| Area / role | Action | Owner / preservation contract |
|---|---|---|
| Calendar / Office | Open Create; edit fields; switch method | Add modal; each method retains its draft |
| Calendar / Office | Select or clear workbook | Import method; selection is local, no success toast |
| Calendar / Office | Preview workbook | Quiet read; signed preview and warnings retained |
| Calendar / Office | Confirm import/replacement | One existing final review; clear imported method only |
| Calendar / Office | Save manual event | Clear created method only; retain unsaved import |
| Calendar / Office | Download template | Honest preparation outcome and contextual failure |
| Calendar / Office | Edit/save event | Initialized event baseline; one retained outcome |
| Calendar / Office | Delete event | Existing consequential DecisionDialog and linked-window restrictions |
| Calendar / Office | Extend informational event | Exact event/date/reason; protected private decision draft |
| Calendar / Office | Close Add/Edit by Cancel/X/Escape/backdrop | Clean leaves quietly; dirty requires disposal consent |
| Semester / Office | Create draft | Save returned identity/baseline before read |
| Semester / Office | Edit draft | Save returned baseline; failure retains input |
| Semester / Office | Refresh readiness | Quiet read; current signed review remains authoritative |
| Semester / Office | Activate and hand over | Existing outgoing-semester token and conditional acknowledgment |
| Semester / Office | Extend end date | Initialized date is clean; retain reason/date after failure |
| Semester / Office | End semester | Existing signed closure review; protect reason and acknowledgment |
| Semester / Office | Archive draft or closed semester | Existing consequence and reason; truthful completion |
| Semester / Office | Cancel/X/switch transition | Explicit disposal of changed transition only; busy blocks replacement |
| Availability / Lecturer | Save restriction | Existing exact role/date/reason review and one write |
| Availability / Lecturer | Cancel restriction | Private cancellation reason protected independently from create form |
| Availability / Lecturer | Switch semester/history page | Existing visible draft retention and scoped reads |
| Capacity / Office | Continue existing draft | Quiet navigation; published policy unchanged |
| Capacity / Office | Prepare blank draft | Distinguish committed create from failed refresh |
| Capacity / Office | Copy previous semester | Preserve validated eligible source and returned draft |
| Capacity / Office | Clone published revision | Preserve returned revision and prevent accidental repeated create |
| Capacity / Office | Edit/save one lecturer | Exact initialized limits; expected version/fingerprint |
| Capacity / Office | Select bulk scope/preview | Quiet preparation; reviewed aggregate remains exact |
| Capacity / Office | Save bulk limits | One atomic save/outcome; draft settings protected |
| Capacity / Office | Review/publish | Existing reason/acknowledgment/fingerprint; persistent owner |
| Capacity / Office | Discard saved draft | Reason protected on local/router/unload/logout; published limits retained |
| Capacity / authorized Office | Authorize/revoke carryover reassessment | Same private-reason protection standalone/nested; active-semester/event/status checks retained |
| Capacity / authorized staff | Compare/history/filter/availability views | Quiet reads; no invented Office availability mutation |
| Periods / Office | Create/edit Supervisor submission window | Exact initialized schedule/programmes/reason and existing revision |
| Periods / Office | Create/edit Panel submission window | Same priority and protection as Supervisor |
| Periods / Office | Publish/close/archive submission window | One existing consequential review and expected revision |
| Periods / Office | Enable/disable enforcement from overview | Protected standalone reason/acknowledgment; affected scope retained |
| Periods / Office | Extend common appointment deadline | Exact period/date/reason; common timeline impact retained |
| Periods / Office | Grant/revoke appointment personal extra time | Exact candidate/revision; stale read blocks action |
| Periods / Office | Extend common Marks deadline | Existing central deadline flow; no Marks lifecycle redesign |
| Periods / Office | Grant/revoke Marks completion window | Exact eligible task; closed-semester selected-only baseline clean |
| Periods / Office | Link existing calendar event | Explicit selected event and replacement consequence |
| Periods / Office | Create linked event | One atomic write; title/phase/audience retained after failure |
| Periods / Office | Use event dates | Existing overwrite consent; entered clock times preserved |
| All scoped editors | Router/sidebar/browser Back | One effective owner; keep/discard or pending wait |
| All scoped editors | Refresh/tab close | Native unload protection; synthetic-event tests distinguished from browser acceptance |
| All scoped editors | Voluntary logout | Shared SessionExit registry; busy waits, failure retains, clean completion exits |

## Route, policy and evidence index

The individual controls above use the approved audit's Q/S/W/C/B/O/X priority rules. These shared entry-point mappings identify their source handlers and owners; policy follows each action's consequence, not an actor-specific toast preference.

| Entry / role | Source controls and policy | Effective owner / outcome | Evidence |
|---|---|---|---|
| `/dashboard/timeline` / Office | TimelineManagement add/edit save S, delete/extension C, import B, template X, filters/method switch Q, local overwrite/discard O | Stable Add/Edit guards, nested RecordPage reuse, retained feedback and inline modal context | Calendar69; timeline/workflow30; shared-exit63 |
| `/dashboard/semesters` / Office | AcademicSemesterManagement create/edit S, chooseTransition/runTransition C; SemesterActivationSection.confirm B and ClosureReview signed final commit | Actual semester RecordPage, private local modal choices, retained outcome and recovery latch | Semester39; activation48; source contracts |
| `/dashboard/my-availability` / Lecturer | openCreate/confirm restriction and cancellation C; semester/history reads Q | RecordPage aggregates visible create and private cancellation scopes; stable feedback owner | Availability57; shared-exit63 |
| `/dashboard/lecturer-capacity` / Office | create/revise/saveEntry S; bulk preview Q and save B; publish B; saved-draft discard C; compare/filter/history Q | Stable aggregate guard for conditional dialogs; preparation RecordPage with owned settlement callback; shared queue | Capacity184; shared-exit63 |
| Supervisor capacity reassessment entry / authorized Office; Coordinator read-only | CapacityReassessments.save authorize/revoke C; existing kind/status/event/semester authority | DecisionDialog standalone guard or owning capacity RecordPage; reason is dirty, not pending | Capacity184 includes actual nested reason callback; source authority review |
| `/dashboard/periods` / Office | savePeriodForm S; confirmAction lifecycle/enforcement/revocation C; common/selected extension C; calendar link/create S; EventDateImport O | Managed-record context for nested decisions, standalone overview/form fallback; retained feedback | Periods120; shared contracts; calendar connection/date import cases |
| Existing prior-phase callers / permitted module roles | Default RecordPage/DecisionDialog compatibility, explicit completion allowance, scoped private drafts | Existing owners preserved; no global bypass | Shared-exit63, decision21, delivery45, phase-one20, Panel51, Marks26 |

## Final verification record — 30 October 2026

Root full frontend source run passed393 tests,0 failures/skips (`source-final.log`,72.237s). `npm run lint` exited0 (`lint-final.log`). `npm run build` exited0 (`build-final.log`,2519 modules,23.38s); the existing ExcelJS chunk-size advisory remains. Scoped and integrated source reviews are `task-1-review.md`, `task-1-template-review.md`, `task-2-review.md`, `task-3-review.md` and `final-review.md` in the ignored workspace.

| Mounted suite | Scenarios | Viewports | Final passing executions |
|---|---:|---:|---:|
| calendarDrafts | 23 | 3 | 69 |
| capacityWorkspace | 46 | 4 | 184 |
| decisionDialog | 7 | 3 | 21 |
| feedbackDelivery | 15 | 3 | 45 |
| lecturerAvailability | 19 | 3 | 57 |
| marksFeedback | 13 | 2 | 26 |
| panelNomination | 17 | 3 | 51 |
| periodsWorkspace | 30 | 4 | 120 |
| phaseOneDrafts | 10 | 2 | 20 |
| semesterActivation | 16 | 3 | 48 |
| semesterDrafts | 13 | 3 | 39 |
| sharedExit | 21 | 3 | 63 |
| timelineWorkflowFeedback | 15 | 2 | 30 |
| **Total across13 suites** | | | **773** |

The root serial batch `browser-final.log` passed12 suites; calendar's390px Chrome process timed out with updater IPC errors after its1440px23 cases passed. No application assertion failed in that calendar run. Unchanged isolated retry `calendar-final-retry.log` exited0 and passed all69 calendar checks in6.610s. The773 total uses the12 successful batch suites plus this retry; it excludes the failed batch's partial23 calendar rows and all other reruns. Do not describe the original13-suite command as fully green. Earlier capacity preview timeout, stopped pause-time runs and copied activation cases remain historical evidence only.

Failing-first cases cover method/draft loss, standalone exits, inline retained completion, local transition disposal, private cancellation, read-failure write gating, unresolved choice submission, dirty reassessment classification, pending preparation/window route loss, missing non-data-router settlement, explicit completion allowance preservation and template retry/request identity. Some supplementary lifecycle cases were added during green coverage; reports distinguish those from observed red runs. Final integrated source review reports no remaining actionable code findings.

Evidence uses actual components with synthetic HTTP and cancelable unload events. The calendar/shared interaction fixtures do not establish full production CSS acceptance. Template feedback runs the real blob/handoff helper but does not certify the browser saved a workbook. Native refresh/tab-close warning, authenticated full-shell/role/logout acceptance, live academic writes and final manual matrix reconciliation remain package seven. Packages five/six retain Marks and broader workflow/export/shared dependency scope. This feedback package adds no backend/API/schema/dependency or academic-rule changes; unrelated pause-time capacity pagination/selectors and prior reporting artifacts are preserved. Work remains local/uncommitted, with no push, merge, deployment or reset.
