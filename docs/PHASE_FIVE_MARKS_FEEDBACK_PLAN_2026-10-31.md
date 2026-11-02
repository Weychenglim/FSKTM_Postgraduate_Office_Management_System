# Phase five: Marks feedback and draft protection

Approved scope: package five of `FIVE_MODULE_NOTIFICATION_CONFIRMATION_REVIEW_2026-10-29.md`, authorized by the user's “go on then” on 31 October 2026. Phases one through four remain in the current local feature checkout. This plan changes frontend interaction behavior only.

## Global constraints

- Preserve unrelated and prior-phase local changes. No commits, resets, stashes, pushes, live writes, database changes, new API contracts, dependencies or academic workflow changes.
- Reuse shared DecisionFeedback, DraftNavigationGuard/RecordDraft, PortalConfirmModal and DecisionDialog. Keep owners mounted through completion and pending route settlement. Quiet reads/filters/previews remain quiet; one truthful outcome per write.
- Compare drafts with their initialized baseline. Busy writes cannot be discarded. Failed writes retain drafts; confirmed writes retire only their own draft before any follow-up read. A failed refresh must never invite repeating a committed write.
- Preserve permissions, recipient preview authority, reasons, conditional signed closure acknowledgment, role/task identity, Malaysia dates, version checks and Marks idempotency.
- The authoritative audit action register is the requirements source. No publication reason or invented exact-count generation preview.
- Each task gets focused failing behavioral regression tests, implementation, focused verification and independent source/spec review. Controller performs integrated verification and updates all three mandatory project documents before finishing.

## Task 1: Isolate and protect rubric drafts

Files: `RubricsManagementView.tsx`, focused browser fixture/runner and minimal local helpers only if warranted.

- Track independent metadata and component baselines, including initialized new-component display order and edit/revert cases.
- Saving metadata preserves an unrelated component draft; saving/deactivating a component preserves unrelated unsaved metadata. Refresh/recovery must not silently replace either draft.
- Guard Back, route/browser/session exits, new-family/version selection, clone replacement, component edit replacement and cancel/reset. Ask only when the affected scope contains meaningful edits; Keep retains exact values. Use explicit discard before replacing unsaved work. Clone remains a routine write once replacement consent is resolved; component deactivation has one consequential final review.
- Keep busy state synchronous enough to prevent duplicate writes or local replacement during a pending mutation. Handle failed selections/recovery and stale asynchronous reads without overwriting newer context.
- Apply audit T11 to rubric commands: direct 403/409 responses block stale retries until a successful latest-record review. Get consent before replacing affected unsaved work; retain work/block on failed read, and preserve unrelated draft scope. Deactivation's existing shared conflict latch must have a working recovery path.
- Retire a committed component draft before refreshing; on failed refresh keep a truthful warning/recovery block while preserving unrelated metadata. Successful reload must not erase unrelated metadata. Prevent replaying a committed write.
- Replace local toast timer with shared feedback ownership; errors stay contextual. Verify clean/reverted exits, independent saves, failed writes/reads, recovery/discard, pending mutation, deactivation final cancel/confirm and feedback delivery.

## Task 2: Protect evaluation-period editing and align lifecycle review

Files: `MarkEntryPeriodConfig.tsx`, focused period browser fixture/runner; preserve shared ClosureReview compatibility.

- Guard the initialized period draft and any typed lifecycle reason across Back/list return, new/open/reload/selection and route/browser/session exits. Seeded semester/rubric defaults and clean/reverted values are quiet.
- Use one final shared review for publication and archive. Publication retains the existing fresh saved configuration and recipient preview check, scope and zero-recipient notice. Add no reason. Archive retains existing required reason. Close retains ClosureReview, required reason and only its existing conditional signed acknowledgment.
- Cancel final review preserves the visible draft/reason. Block local replacement and duplicate actions while a write is pending; isolate obsolete async responses.
- Apply audit T11 to period writes: a 403/409 blocks stale retries until successful latest-record review; failed recovery preserves draft/block and replacement of meaningful input requires consent.
- A confirmed save/transition installs returned state and clears only committed input before the refresh. Failed refresh is a truthful saved warning with explicit read recovery and no duplicate write. Successful completion leaves no false discard prompt.
- Use shared feedback owner; contextual form/action errors and failed read recovery remain visible. Test reachable `/marks/config` and context-linked behavior, archive visibility, recipient changes, failures, signed closure and pending route settlement.

## Task 3: Review generation and preserve existing Marks entry/backup behavior

Files: `EvaluationTaskAssignment.tsx`, focused generation browser fixture/runner; inspect existing `MarkEntryDetail`, `LecturerMarksEntry`, `SubmittedMarksActions`, common/personal deadline hosts for regressions and only fix defects within approved Marks scope.

- Generate missing tasks opens one shared final review naming the selected period and available saved scope/readiness. Recheck current period readiness before commit. Available task counts are estimates/current loaded state; exact created/no-change counts come only from the generation response. Preserve backend idempotent generation and existing assignments/marks.
- Cancel review is quiet. Failures are contextual, persistent and correctly toned. Confirmed result has one truthful created/no-change outcome; distinguish failed follow-up refresh and provide read-only recovery rather than repeating generation. Gate duplicate pending commits and stale period/context switching.
- Migrate the assignment page's local toast timer to stable shared feedback without duplicating DecisionDialog's existing backup outcome. Preserve phase-one backup completion allowance and failed draft retention.
- Inspect assigned Supervisor/Panel/Backup draft save, final submit, Office correction/reopening and deadline fallback. Preserve exact payload review, baseline reset, version/conflict/permission latch and receipt/idempotency behavior; record coverage and any deliberate later-phase boundary.
- Verify official/backup role identity, failed and successful writes, stale reads, generation review/change/no-change/failure/refresh recovery, backup completion and surrounding Marks suites.

## Task 4: Complete Marks final-payload and local draft review

Source audit in the phase workspace identified gaps in the existing assigned-Lecturer/Office/fallback flows, within the approved Marks action register. Files: `MarkEntryDetail.tsx`, `SubmittedMarksActions.tsx`, `MarksCompletionWindows.tsx`, minimal feedback ownership in their stable hosts if needed, focused browser fixture/runner.

- Lecturer final review displays the exact scores, component feedback, overall comments and total being locked, with student/task/role identity. Submit the reviewed snapshot; preserve same-payload retry reference and changed-payload new reference, version checks and failed draft retention.
- Office correction final review displays every changed score and changed overall comment before/after, including unchanged-total swaps and comments-only corrections. Keep existing reason, expected version, backend audit and submitted lock behavior.
- Inline Office Cancel protects meaningful correction/reopening work with shared discard/Keep choice. Final-review Cancel keeps the visible editor. Latest-record recovery must get replacement consent for affected draft and only install a clean baseline after successful read; a failed read retains work and conflict block. Do not permit stale replay after a conflict.
- Reachable personal completion-window fallback protects grant/revoke drafts and local replacements; exact selected task/student/evaluator/role/period or semester/window identity appears in final review. Preserve existing eligibility, Malaysia conversion, required reasons and API payloads. Confirmed writes clear only committed scope before secondary reads; read recovery cannot replay the write.
- Reuse stable shared guard/feedback ownership; replace LecturerMarksEntry's local toast timer with the shared owner/publisher so draft saves have the same delivery policy. Do not add a competing central deadline flow. Cover local clean/reverted/dirty Keep/discard, navigation, failed/successful writes, stale reads, pending requests, exact reviewed payload/identity and official/backup roles. Preserve existing entry and phase-one backup regressions.

## Completion checklist

- [x] Task 1 implemented and independently reviewed.
- [x] Task 2 implemented and independently reviewed.
- [x] Task 3 implemented and independently reviewed.
- [x] Task 4 implemented and independently reviewed.
- [x] Integrated source tests, TypeScript, production build and relevant browser regressions verified.
- [x] Broad final source/spec review completed; actionable findings resolved.
- [x] Audit and mandatory requirements/design/status documents updated with exact evidence and limits.

Full authenticated shell, real native unload and actual saved-file acceptance remain phase seven. Broader exports, participant/delegation and Supervisor requirement setup remain phase six.

## Final outcome (1 November 2026)

Complete; all task reviews and the scoped broad-review fix are approved. Final checks: 405 frontend source tests passed, TypeScript/build/scoped whitespace exit 0, 444 named browser scenarios across rubricDrafts (60), marksPeriodDrafts (54), marksGeneration (27), marksFeedback (38), decisionDialog (21), sharedExit (63), phaseOneDrafts (16), feedbackDelivery (45), and periodsWorkspace (120). Counts exclude retries and screenshot renders. Initial stale source-test/markup expectations and the pending-write navigation fixture were corrected meaningfully and rerun. Broad review's unrelated revocation-reason loss on history Retry was reproduced and fixed. Full commands, logs, failure dispositions and review records live in the ignored phase workspace integrated-verification.md/final-fix-review.md. All changes are local/uncommitted. Phase six includes remaining development; phase seven is full-shell/native acceptance.