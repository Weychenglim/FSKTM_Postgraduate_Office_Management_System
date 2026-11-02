# Panel capacity review — 29 October 2026

## Result

No new blocking defect or actionable regression was found in the Panel capacity changes. Fresh independent backend/frontend reviews agreed with the main review. No production code changed during this review.

## Inspected behaviour

- Actual Panel list, detail and Coordinator routes serialize request-specific capacity metadata. The browser fixtures alone are not treated as proof of API integration.
- Submitted nominations do not reserve; acceptance reserves globally under policy/Student/request/Lecturer locks. A real PostgreSQL competing-acceptance test confirms only one of two requests can obtain the final place.
- Submission remains blocked when full. Rejection remains possible under existing eligibility guards. Final approval excludes its own reservation and converts it into an active appointment.
- Waiting workflow queues, duplicate prevention, role conflicts, lifecycle safeguards and Office reassessment retain both ongoing statuses; only accepted nominations consume reserved workload.
- Automatic closure checks each unaccepted nomination's effective policy after active workload fills it. It preserves accepted requests, archived/missing/stale policies and incumbent replacement appointments. Closure events display System and notifications are deduplicated.
- Production status adapters show Capacity full as a neutral outcome and allow the nominator to start a new eligible nomination. No Panel rejection or acceptance is invented.
- The amber last-place warning and active/reserved counts were inspected on desktop/mobile. Mounted scenarios verify confirmation timing, restricted/missing capacity, rejection availability, Coordinator conversion and viewport fit.

## Fresh verification

| Check | Result |
| --- | --- |
| Backend: appointments, academics, dashboard reconciliation/co-supervision tracking, staff accounts | **790 passed**, 246.143 seconds |
| Entire frontend source test selection | **385 passed**, 58.141 seconds |
| Related frontend selection | **73 passed** |
| Panel mounted browser scenarios at 1440px/390px | **16 passed** |
| Supervisor mounted browser regressions at 1440px/390px | **28 passed** |
| TypeScript | Passed |
| Production build | Passed; existing bundle-size advisory |
| Django system check | No issues |
| Migration drift check | No changes detected |
| Migration 0020 | Already applied locally |
| Git whitespace check | Passed |

Backend verification used an isolated `test_panel_capacity_review_20261029` PostgreSQL database, destroyed by the runner afterward. MD5 password hashing was enabled only in the test process to shorten fixture setup. Production settings were not changed.

The full backend rerun closes the earlier verification gap: the prior broad run had outdated reservation fixtures, followed by a narrower correction run. The complete current selection now passes.

## Limitation identified by this review — subsequently fixed

`backend/dashboard/reconciliation.py`, in `_apply_panel_handoff`, checks the current-semester `panel_workload_limit` before `activate_replacement` checks the approved request's effective policy. If the current limit is lower, an approved historical-policy request whose appointment handoff needs Office repair can be blocked even when its own policy would allow activation. This check predates the Panel capacity changes. Normal Panel acceptance/Coordinator approval uses the effective request policy and is unaffected. This review originally recorded the limitation without changing the repair policy. The user subsequently authorized a fix; Office handoff detection and application now use the shared request-policy guard, and approved requests retain their consumed reassessment target. See OFFICE_HANDOFF_CAPACITY_FIX_2026-10-29.md for the follow-up implementation and verification.

This is a code/API/automated-browser review, not a claim that every authenticated production journey or deployment has been exercised. Requirements and architecture documentation were checked; no requirement or architecture change was needed. PROJECT_STATUS.md records the new verification evidence. No commit or push occurred in this review; subsequent user-authorized publication is recorded in PROJECT_STATUS.md.
