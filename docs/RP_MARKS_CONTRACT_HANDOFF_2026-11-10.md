# Marks callback integration — 10 November 2026

The user's final joint plan replaces the earlier discussion with Xiang. Office policy approval remains pending. This handoff covers the Marks adapter only.

## Public interface

Import from `marks.stage_changes`:

```python
preview_stage_change(*, student_id, academic_semester, old_stage, new_stage)
# -> {"notStarted": int, "draft": int, "submitted": int, "token": str}

apply_stage_change(*, student_id, academic_semester, old_stage, new_stage,
                   token, actor, reason)
# -> list of affected task IDs/actions; raises StageChangeStale on mismatch
```

academic_semester is an AcademicSemester instance; stage values are P1, P2 or None. Counts describe affected work, not every task the student has. Existing paused drafts/unstarted work retain their pause evidence. Retired and unclassified legacy work retain the existing review behavior even though the compact public summary has only three count categories.

## Xiang's caller responsibilities

1. Authorise the coordinator/programme and enforce current-semester-only changes.
2. Preview and show the affected counts; retain token and the intended transition.
3. Inside one outer transaction, lock Student, then ProjectRegistration. Validate the registration version and effective old stage independently of the Marks token.
4. Save the registration and invoke apply with exactly the reviewed transition/token. Apply takes/reuses those locks before locking tasks. Saving may occur before or after apply in the same transaction.
5. Let exceptions escape that transaction so registration and cleanup both roll back. Translate StageChangeStale into refresh-and-preview feedback.
6. Exclude every student with existing tasks from bulk updates, as agreed; handle individually. This is Registry-owned and not implemented by this adapter.

The Marks token detects changed transition arguments, student/semester, task membership, lifecycle, marks and completion-window evidence. It intentionally ignores mutable registration metadata so saving the new registration does not invalidate the preview. It is not a registration-version or authorisation token.

## Existing behavior retained

Matching tasks stay unchanged; affected active unstarted tasks retire; drafts pause; submitted evidence remains intact with review holds. Cleanup does not create replacement tasks or automatically resume preserved work. Existing Registry routes continue using the legacy stage_corrections contract until Xiang switches his callers. Marks eligibility accepts ON_PROJECT and temporarily CONFIRMED, retaining all other eligibility checks.

## Remaining work

- Wire Xiang's coordinator flow to this adapter and jointly test registration revisions, permissions, past-semester rejection, bulk exclusion and rollback through his real endpoint.
- Verify student-answer/first-supervisor-approval flows cannot leave incompatible existing tasks; these flows do not invoke this coordinator callback.
- Complete the remaining five-module checklist. Progression, dashboard changes and Office academic decisions are outside this adapter step.

## Supervisor/Panel consumer review

The existing runtime behavior already supports appointment continuity across RP1/RP2. Added appointments.test_rp_stage_handoffs acceptance tests, without production workflow edits. These use the agreed lookup shape with real semester activation/generation and replacement endpoints. Both appointments persist through regular/Special semester transitions; stage correction preserves pending requests; RP2 replacement changes only the selected role and preserves prior submitted marks and registrations. Xiang's approval-triggered registration, first-approval selection, automatic progression and real lookup remain joint-integration checks when his code lands. No appointment-stage restrictions were added.

## Tracking consistency — 11 November 2026

Operational reports/exports, period monitoring and homepage Marks counts/actions now exclude stage-blocked or review-held unfinished work. Dossiers preserve it as Review Required. Submitted records remain factual history/counts and keep their review holds. Task editing, completion-window access and reminders cannot bypass an unresolved hold just because the stage matches again. Closure acknowledgement remains conservative and calendar audiences/layout are unchanged. This does not decide academic validity or implement Xiang's registration/progression flow.
