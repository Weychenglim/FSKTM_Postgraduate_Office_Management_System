# Phase two: shared feedback and exit contracts

Approved continuation of delivery package 2 in `FIVE_MODULE_NOTIFICATION_CONFIRMATION_REVIEW_2026-10-29.md`. Phase one is complete. Preserve all existing working-tree changes; no commit, deployment, dependency, API or academic-rule change is included.

## Scope and design

Use the existing shared decision feedback owner for migrated outcomes. Queue distinct operations one at a time, identify delivery independently of text, and prevent a timer or late session callback from clearing/publishing another outcome. Routine success/info notices last four seconds with hover/focus pauses; warning/error outcomes remain dismissible. Existing form/section errors remain persistent. Reuse the current toast presentation and native dialog; outcomes wait while a modal makes the body inert, then receive their full visible lifetime. Nested feedback providers must not create overlapping hosts. Keep teammate-owned local toast presentation unchanged. Legacy page emitters migrate in later packages; this phase supplies their opt-in shared interface.

Retain the existing RecordPage draft aggregation. Register its active dirty/busy scope with a shell exit coordinator for deliberate logout, without delaying forced session expiry. Pending router exits resolve after saving: clean/completed work may proceed; failed dirty work remains protected. Fresh edits after a clean saved baseline regain protection. A decision's stale async completion/reload cannot close or alter a different decision session. Private dismissal and final-review dismissal keep their distinct owner callbacks.

## Task 1: shared outcome delivery

- [x] Reproduce missing expiry, repeated text, distinct queued publishers, duplicate operation IDs, stale timers/session callbacks, modal suspension and nested providers in mounted production-component tests.
- [x] Implement compatible `useDecisionFeedback()(message, tone, operationId?)` with info/success/warning/danger tones and one provider host; existing two-argument calls stay valid.
- [x] Add explicit toast event identity/lifetime support and preserve standalone fallback rendering/SSR and existing accessible dismiss semantics.
- [x] Verify real native dialog visibility/focus, four-second timer, hover/focus pause, route survival and session clearing at desktop/390/320 widths.

## Task 2: decision and navigation lifecycle

- [x] Add failing mounted tests for late reload/save after decision identity/session changes, clean/failure settlement of a pending router exit, saved-then-new edits, nested draft cleanup and StrictMode.
- [x] Isolate async decision sessions; preserve existing 403/409 latch across same-record reopen and clear only after successful latest-record review.
- [x] Resolve pending RecordPage route guards deliberately and reset completed allowances for fresh edits without global bypasses or a second router blocker.

## Task 3: voluntary session exit and integration

- [x] Reproduce dirty/busy deliberate logout before session mutation; clean logout is immediate and forced expiry remains immediate.
- [x] Add a shell exit coordinator that consumes registered RecordPage scopes, provides one discard/stay decision, blocks in-flight dismissal and scopes callbacks to the authenticated session.
- [x] Integrate logout and account-based feedback identity in App/AppLayout; preserve existing auth calls and forced-expiry handling.
- [x] Run focused browser suites and relevant frontend regression tests, TypeScript, production build and whitespace check; request independent review and fix actionable findings.
- [x] Update the audit and all three mandatory project documents with exact implemented scope, test evidence and remaining later-package work. Native full-portal acceptance remains separately identified.

## Interface and conflict review

| Tasks | Shared interface | Resolution |
| --- | --- | --- |
| 1 and 2 | DecisionDialog publishes through useDecisionFeedback | Preserve two-argument compatibility; supply an operation identity for each submission when useful. Task 1 does not edit DecisionDialog. |
| 2 and 3 | RecordPage protection state | One shell registry observes aggregated scopes; the existing RecordPage owns router/native protection. Logout is a shell command, not a second router blocker. |
| 1 and 3 | Provider scope identity | Account/session key comes from AppLayout; nested providers reuse the nearest owner. Old callbacks cannot publish after unmount or scope change. |
| All | Existing dirty tree and later audit packages | Keep prior capacity and phase-one edits. Do not migrate all page emitters or implement missing standalone guards assigned to later packages. |
