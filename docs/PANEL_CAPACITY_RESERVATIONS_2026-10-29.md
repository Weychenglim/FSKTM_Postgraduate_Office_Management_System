# Panel capacity reservations and alerts

The user approved making Panel nominations consistent with Supervisor applications: a lecturer promises capacity by accepting a request.

## Behaviour

| Stage | Capacity effect |
| --- | --- |
| Supervisor submits nomination | No reservation; submission still requires an available published place |
| Panel member accepts | Reserve one place while awaiting Coordinator approval |
| Coordinator approves | Convert the existing reservation into one active appointment |
| Rejection or cancellation | Release any reservation |
| Confirmed active workload fills a waiting nomination's effective limit | Close that unaccepted nomination as Capacity full |

Reservations alone never close another nomination. Existing accepted nominations retain their places. Closure examines each waiting nomination's original or Office-authorized effective policy; archived, missing and stale policies are preserved. A closed replacement nomination leaves the incumbent appointment active. A new nomination can be made to another eligible Panel member through the existing route.

## Design review

1. Reserving on submission allowed someone else to occupy a lecturer's place before consent.
2. Unanswered nominations could make a lecturer appear full.
3. A shared pending/reserved status list mixed workflow progress with capacity promises.
4. Warning that acceptance reserves a place was incorrect under the old rules.
5. Dashboard-only warnings would miss request-specific policies and concurrent acceptances.

The implementation separates `PENDING_STATUSES` (both review stages) from `WORKLOAD_RESERVED_STATUSES` (accepted and awaiting Coordinator). Duplicate prevention, role conflicts, Student projections, Office queues, lifecycle checks and reassessment continue to consider both ongoing stages. Capacity/publication/workload projections count active appointments plus accepted reservations only. Historical migrations are unchanged.

Panel acceptance follows policy-semester → Student/request → Lecturer locks and rechecks capacity before committing its reservation. Final approval excludes its own reservation. The reconciliation activation path locks the Lecturer and invokes closure. Its initial current-policy precheck was subsequently replaced with the shared request-policy guard by the Office handoff fix; consumed reassessment targets are retained for approved recovery. Closure records the triggering actor with role System, neutral cancellation metadata and deduplicated notifications to the nominator, Panel member and linked Student.

## UI

- Workload cards highlight **1 place remaining**.
- Request details distinguish active appointments, reservations and availability.
- The acceptance dialog shows an amber **Last available place** warning: “Accepting reserves this place until Coordinator approval.” It also gives the count of other pending nominations that may close after final approval.
- Full, restricted, unconfigured or missing capacity metadata disables acceptance. Rejection remains available under the existing eligibility/busy guards. Coordinator conversion is checked by the server against its own reservation.
- Submission explains that a place is reserved only when the Panel member accepts. Cancelling an unanswered nomination no longer claims to release a reservation.
- Capacity closure appears as a neutral System outcome, never a Panel rejection.

## Verification

Failing-first API and rendered-component tests demonstrated the missing reservation timing, competing acceptance protection, closure and UI guards. A broad backend run of 788 tests passed 779 and identified nine expectations/fixtures requiring the changed contract; those were corrected rather than weakening production checks. The final affected-workflow rerun passed all 114 tests, including thirteen new Panel API/concurrency cases. A subsequent fresh review ran the complete current selection and all 790 backend tests passed.

Seventy-three related frontend checks, sixteen Panel browser scenarios and twenty-eight Supervisor browser regressions passed. Browser scenarios use actual components with production CSS at 1440px and 390px, including warning confirmation, full/restricted/missing policies, Coordinator conversion, neutral closure and overflow checks. TypeScript and the production build passed. Independent code review found misleading cancellation text and encoding issues, both corrected. Follow-up review found no remaining actionable regressions. Nine final affected component checks also passed after the last copy/fallback changes. The subsequent review ran the entire frontend source test selection: all 385 passed. Fresh review details are recorded in PANEL_CAPACITY_REVIEW_2026-10-29.md. The historical-policy Office repair limitation identified there was subsequently fixed at the user’s request; see OFFICE_HANDOFF_CAPACITY_FIX_2026-10-29.md.

Migration `0020_panel_capacity_full` adds the terminal status choice. Its generated SQL is a no-op; it does not rewrite request or appointment records. It was the only pending local migration and was applied successfully; Django showmigrations confirms it is registered.

Screenshots: [desktop](../output/panel-capacity-reservations-20261029/panel-last-place-1440.png), [mobile](../output/panel-capacity-reservations-20261029/panel-last-place-390.png).

No follow-up commit/push was performed during implementation; subsequent user-authorized publication is recorded in PROJECT_STATUS.md. Unrelated pre-existing Office/reporting/timeline changes remain untouched.
