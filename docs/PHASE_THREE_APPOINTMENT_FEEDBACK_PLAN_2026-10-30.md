# Phase three: appointment feedback and draft protection

Approved continuation of delivery package 3 in `FIVE_MODULE_NOTIFICATION_CONFIRMATION_REVIEW_2026-10-29.md`. Reuse the phase-two foundation and preserve the phase-one Panel cleanup.

## Constraints

- Continue in the existing `codex/portal-consistency-and-toast` checkout: earlier phases and independent capacity work are uncommitted here. Preserve that work, outputs and unrelated documents. No commits, branch changes, dependency changes, live API writes or backend changes.
- Preserve permissions, capacity reservations, privacy, optimistic concurrency and existing academic approval stages.
- Success must survive the editor closing. Ordinary browsing stays quiet. Errors remain visible; confirmed commits must never invite another creation merely because a refresh failed.
- Changes to parent/child draft scopes must not clear unrelated work. Use shared dialogs and existing draft/navigation primitives; no generic action framework.

## Task 1: submission feedback and local cancellation

- [x] Reproduce lost Supervisor submission feedback across real editor unmount/navigation; publish the confirmed outcome through a retained shared owner. Preserve standalone behavior with an appropriate owner boundary, avoiding duplicate hosts/messages.
- [x] Contact editor Cancel protects meaningful changes with Keep editing / Discard. Clean/reverted cancellation stays quiet; pending save cannot be dismissed; explicit discard resets child fields/errors only. Successful contact persistence leaves unrelated application work intact.
- [x] Supporting nomination/replacement Cancel applies the same protection to candidate/justification changes; pending submission cannot be dismissed. Keep existing failure/403/409 reload retention and completed-form cleanup.
- [x] Extend production-component browser fixtures with failing-first evidence, relevant route/draft integration, failure and busy cases; keep existing tests meaningful.

## Task 2: research conflict preservation

- [x] Reproduce research creation/correction/transfer 403/409 reload losing draft state in the mounted production component.
- [x] Keep entered title, abstract, destination, reason and correction acknowledgment visible after a conflict or forbidden response. Block stale resubmission until an explicit successful latest-record review. A failed reload keeps draft and recovery latch.
- [x] Use explicit replacement consent before replacing local values with latest data; preserve identity and reject late results from previous student/action/session. Avoid loading/error UI unmounting the retained draft.
- [x] Separate confirmed mutation success from failed workspace refresh; completed drafts are clean and do not allow duplicate creation. Publish one truthful outcome. Preserve decision-dialog behavior and scope boundaries.
- [x] Add failing-first behavioral coverage for all three creation kinds, reload failure/success, consent cancellation, identity changes and committed-refresh failure.

## Task 3: quiet browsing and honest exports

- [x] Remove Apply/reset success toasts in Supervisor appointment records. Preserve visible filter results and failures.
- [x] Migrate this page's export feedback to the shared queue with a deliberate fallback. Report prepared files honestly, distinguish no matching records and errors with correct tones. Keep role-scoped export columns and download behavior.
- [x] Inspect related appointment export entry points for the same issue; change only directly applicable appointment surfaces. Marks generation and broad portal export sweep remain later packages.
- [x] Add behavioral coverage for quiet filters, successful export, zero results and failed export.

## Verification and completion

- [x] Independent task review and final integration review; fix actionable findings.
- [x] Run changed-host fixtures, shared decision/navigation/feedback fixtures and appointment/Panel regression suites. Run frontend source tests, TypeScript and production build; record exact evidence and limitations.
- [x] Update the audit and all three mandatory project documents. Preserve distinction between isolated browser evidence and full-shell/native-unload acceptance (phase seven).

## Completion record

Implemented and independently reviewed on 30 October 2026. No remaining actionable code findings in the reviewed package. All work remains local and uncommitted.

Final source gate: 389 tests passed, zero failures/skips (79.580s). TypeScript passed after final fixture maintenance. Production build passed after final production edits (2517 modules, 14.00s), with the existing ExcelJS size advisory. Diff whitespace check passed.

The following manifest counts the final passing run of each suite/viewport once. It excludes repeated development/review runs and all earlier-phase evidence.

| Browser suite | Scenario executions |
| --- | ---: |
| appointmentDrafts: 9 at 1440/390/320 | 27 |
| appointmentExports: 10 at 1440/390/320 | 30 |
| appointmentFeedback: 7 | 7 |
| researchIntentWizard: 32 at 1440/390/320 | 96 |
| researchConflict: 28 | 28 |
| decisionDialog: 7 at 1024/390/320 | 21 |
| sharedExit: 15 at 1440/390/320 | 45 |
| feedbackDelivery: 15 at 1024/390/320 | 45 |
| panelNomination: 17 at 1440/1024/390 | 51 |
| workloadMonitoringSummary: 2 at 1440/390 | 4 |
| workloadDetail: 6 at 1440/390 | 12 |
| researchChangeDetail: 10 at 1440/1024/390 | 30 |
| researchProfileHistory: 8 at 1440/1024/390 | 24 |
| supervisorRequestDetail: 17 at 1440/1024/390 | 51 |
| officeSupervisorReplacement: 7 | 7 |
| supervisorCapacityReservations: 14 at 1440/390 | 28 |
| Total: 16 suites | 506 |

Failing-first evidence: lost shared and standalone submission feedback, four local Cancel cases, supporting 403 recovery, eight export/filter cases, 15 initial research recovery/outcome cases, background-read retention and concurrent refresh/review busy state. The initial wider appointment batch had five passing runners and one failing capacity runner; its old assertion expected detailed counts inside the choice, although the pre-existing implementation had moved them to the selected summary. The updated fixture retains selection/overflow coverage and checks the actual badge and detailed summary. Its subsequent 28-case run passed. The failed original batch remains a failed run, not retroactively marked passing.

Reviewers independently ran 28 research cases, seven appointment-feedback cases and 30 export cases; task-one cancellation checks also received independent execution. The standalone owner gap found in review was reproduced and fixed before approval. Existing permission, approval, version and capacity boundaries were inspected against actual callers.

Limits: synthetic HTTP and isolated production-component fixtures; export feedback substitutes only the generation boundary. Child-draft/export fixtures establish interactions at their iframe widths without application CSS, rather than visual acceptance. Research conflict testing is a single browser viewport. No newly accepted full-shell/native unload, saved-file, backend mutation or production journey is claimed. Such acceptance remains package seven. Requirement setup F13, Marks generation and remaining legacy quiet/export migrations remain their original later packages. Mandatory requirements/design/status and the audit were updated; unrelated capacity source and testing-report outputs were preserved.
