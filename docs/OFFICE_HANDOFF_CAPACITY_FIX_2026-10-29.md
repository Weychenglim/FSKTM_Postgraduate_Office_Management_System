# Office approved handoff capacity repair

The user approved fixing the historical-policy limitation identified during the Panel capacity review.

## Decision

Repairing an approved request must use its applicable semester capacity policy. Using today's limit can block a valid older request; using only the old legacy profile limit can also incorrectly offer a repair when that request's actual policy is full or restricted.

The focused fix replaces both Panel repair prechecks (issue detection and locked application) with the shared `assert_request_capacity()` guard. Final `activate_replacement()` still repeats that guard. The detection helper is renamed `_request_capacity_available` because Supervisor and Panel repair now share it.

Inspection also found that an approved Office-reassessed request lost its target when the reassessment was consumed. `capacity_semester()` now retains the latest CONSUMED event's target for APPROVED records. A Closed consumed target remains usable for recovery; archived sources and targets remain blocked. Unconsumed grants retain their existing current-Active target freshness check. The resolver still uses the applicable semester's published policy and current global active/reserved workload; this does not freeze or bypass capacity checks.

No request semester, approval attribution/date, or reassessment history is rewritten. A repair does not consume the authorization again. Existing role, Student lifecycle, Office permission, uniqueness, audit, transaction and idempotence guards remain in place. No schema, migration, frontend or dependency changes are required.

## Verification

Five initial real-API regression tests failed against the original implementation and passed after the fix. Additional cases cover:

- A valid older policy when today's policy is full.
- A full older policy when today's policy has room.
- Archived sources, archived consumed targets and missing policy.
- Source-policy availability restrictions and other accepted reservations.
- Consumed Office reassessment after its target closes and a newer semester becomes Active.
- A stale unconsumed reassessment and workload added after approval.
- Capacity changes after preview and a separate recheck in the locked handler, without partial appointment/audit writes.
- Original Coordinator attribution/date, immutable consumption history, unchanged request semester, and repeated repair refusal.
- The shared consumed-policy resolution on Supervisor handoff repair.

The affected backend run passed 79 tests (repair, reconciliation, reassessment, appointment lifecycle, Panel reservations/concurrency and capacity publication). The final repair-only suite passed all 13 tests in 12.938s, including the additional shared Supervisor recovery case. Django check, migration drift and whitespace checks passed. Independent read-only code review found no actionable issue.

These tests use an isolated PostgreSQL test database and synthetic records. No real Office repair was executed against user records. Unrelated working-tree changes are preserved. No commit or push was performed during implementation; subsequent user-authorized publication is recorded in PROJECT_STATUS.md.
