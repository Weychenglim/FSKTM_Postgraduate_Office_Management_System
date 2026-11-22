# RP1/RP2 five-module plan coverage review

10 November 2026. Review of planned scope, not implementation acceptance. Regression repairs passed according to the user; not rerun for this review. No application/database changes.

Scope names come from FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md. The accepted technical reply to Xiang is the primary planning reference; the older cross-module handoff is historical context.

## Coverage matrix

| Your module | Already covered by plan | Remaining planning gap / decision | Owner |
| --- | --- | --- | --- |
| Dashboard / Timeline | P1/P2 calendar labels do not prove registration; no inferred stage; semester handover preserves appointments/history; reminders are a separate integration. | Explicitly decide whether calendar visibility/reminder recipients are general or stage-specific; whether dashboard expected/missing counts should use registration. Keep published dates/window identity separate from student eligibility. | You define technical effects; Office decides audiences; Xiang supplies lookup. |
| Supervisor Appointments | Existing appointments survive stage/semester changes; new/replacement-generated Marks must pass the stage gate; first-application restriction deferred to avoid circular registration prerequisites. | Rules for first application, existing pending requests at stage correction, supporting nominations, replacements, extensions and research/programme changes need explicit allow/block/preserve outcomes. Stage correction must not implicitly terminate appointments. | You implement approved workflow rules; Office decides; Xiang owns registration changes. |
| Panel Appointments | Existing appointments preserved; Marks handoff stage-checked; general application restrictions deferred. | Separate first nomination from replacement/extension; settle timing relative to RP stage, pending approvals during correction and whether existing panels carry across RP1/RP2. Supervisor rules cannot automatically stand in for Panel rules. | You + Office; Xiang supplies stage source. |
| Marks | Detailed coverage: exact semester/stage, previews, missing/unlinked cases, all generation entry points, replacements/backups, draft/submit, completion windows, resume, correction/void/first/bulk, concurrency, audits, preserved submitted history and review holds. | Office decision on submitted academic validity/late registration/closed-period exceptions; authorised legacy unclassified-period resolution. Verify repeat/leave/transfer rules against Registry contract once Office settles them. | You own Marks; Office decides academic exceptions; Xiang owns Registry writes. |
| Workflow / Approval Tracking | Mismatches, audited corrections and reconciliation recovery are covered; historical evidence and Student Marks privacy retained. | Explicitly cover reports/exports, completion denominators, closure/graduation blockers and lecturer workload/blockers: distinguish eligible outstanding work from paused/retired/review-held history. Decide whether stage context/filtering is needed; preserve original submitted facts. Include pending appointment workflows when registration changes. | You own tracking in your modules; coordinate Registry-owned lifecycle/closure consumers with Xiang; Office settles meaning of exceptions. |

## Verdict

All five modules were mentioned, but only Marks has a detailed end-to-end RP plan. Other modules have boundaries and deferred questions rather than complete workflow rules. The plan is therefore not yet sufficient to claim complete five-module logical coverage.

This is not a requirement to add stage restrictions everywhere. A recorded decision of "stage has no effect; preserve current behavior" completes coverage for a workflow when agreed. Stage labels alone do not justify a new restriction or new display.

## Next planning work

1. Close the concrete gaps above with an action matrix: workflow, P1/P2/missing/no-project/not-studying, current versus historical semester, proposed behavior, owner and confirmation status. Include correction while an approval is pending.
2. Send Office only the policy questions: registration timing; first/replacement/extension rules separately for Supervisor and Panel; repeats/transfers/leave/Special Semester; audiences; submitted/closed-period exceptions. Do not make user approval a substitute for Office policy.
3. Agree tracking/count semantics and cross-owner closure/blocker consumers with Xiang. His registration/progression work remains his; your modules consume the confirmed interface.
4. Add mixed-stage end-to-end acceptance journeys across all five modules, including missing registration, correction with pending request/draft/submission, leave/return, replacement and closure. Existing broad tests do not by themselves prove this matrix.
5. Implement only agreed gaps, then jointly review populated registrations/mismatches and release readiness.

## Evidence inspected

- docs/RP_STAGE_REPLY_TO_XIANG_2026-11-09.md, sections 4–10: detailed Marks scope, ownership, separate/deferred integrations, Office questions and joint acceptance.
- docs/RP_STAGE_CROSS_MODULE_SESSION_HANDOFF_2026-11-09.md: initial cross-module impact review.
- docs/FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md: exact five modules and teammate ownership boundaries.
- backend/marks/{stage_eligibility,stage_corrections,services,targeting,completion_windows}.py and backend/dashboard/reconciliation.py: concrete stage integration paths corroborate Marks/reconciliation scope.
- backend/dashboard/reports.py: task-derived reporting and completion metrics warrant explicit planning decisions; this review does not establish a runtime defect.

Announcements, general Files/Letters/FAQ and Registry are teammate-owned. Stage-based announcement/document targeting is a separate dependency to coordinate only if Office requires it, not an extra module silently assigned to you.
