# Reply to Xiang: RP1/RP2 lookup and Marks integration

Prepared 9 November 2026 for Wey Cheng to review and send, in response to `RP_STAGE_LOOKUP_FOR_WEY_CHENG_2026-11-09.md`.

**Status update, 10 November 2026:** Wey Cheng reported that he sent this reply and Xiang accepted it, and authorised Stage 3 implementation. The technical direction below is accepted on that basis. Office decisions remain outstanding; this acceptance does not establish faculty policy or a delivery date. The original proposal text below records the agreed scope and ownership.

## 1. Direction and current baseline

Thanks for the handoff. Option B and the shared semester-specific lookup are a suitable foundation for the Marks integration. We can develop against the interface now while keeping the outstanding Office assumptions explicit.

The latest fetched `origin/main` is `227a3b28893b001be813e3e45aa36b83767fd697` (PR #30). My local HEAD is already at that commit. `EvaluationPeriod.assessment` is present on main, so you no longer need a separate push or branch from me for that field.

The lookup's `NOT_STUDYING` state with `ON_LEAVE`, `NOT_REGISTERED` or `FINISHED` reasons is acceptable. Marks must use the answer for the evaluation period's `AcademicSemester`, rather than infer stage from the active semester, intake, elapsed semesters, appointment, or calendar label. Existing participant, programme, evaluator-role, appointment and access checks remain necessary alongside it.

One registration per student per semester remains a provisional model assumption pending Office confirmation. If multiple stages are permitted, we must review the lookup, uniqueness rules, previews and correction behaviour together; changing the database constraint alone would not complete that change.

## 2. Answer: who needs Office attention?

Yes: use an active primary supervisor, supporting supervisor or panel appointment to prioritise urgent `NOT_CONFIRMED` cases. This avoids treating every student who has not reached the project as an urgent Marks problem.

Please preserve these distinctions:

- The Registry attention list is a semester-wide registration-maintenance view. The Marks preview is scoped to the period's programme and included official evaluator roles. Their counts may differ, and the labels should explain their scope.
- Count unique students, not appointments or evaluator tasks. Supporting-supervisor appointments can trigger Registry attention without making the supporting supervisor an official Marks evaluator.
- Office must still have a discoverable way to find and confirm students without appointments, including students with no suggestion. A `noActivity` count alone does not let Office resolve an individual record. This can be an existing authorised Registry route; a new page is not required if that route is sufficient.
- Students with a confirmed matching stage but no eligible appointment belong in missing-appointment reporting. They must not disappear because urgent missing-registration attention is appointment-based.
- `NO_PROJECT` and `NOT_STUDYING` are exclusions, not missing-registration cases. Show their explanations separately where needed.

## 3. Proposed Marks rules

| Lookup / record condition | New stage-specific Marks work |
| --- | --- |
| `CONFIRMED`, stage matches the period's P1/P2 assessment | Allowed only when every existing eligibility check also passes |
| `CONFIRMED`, stage differs | Block |
| `NOT_CONFIRMED`, including missing, suggested-only or voided registration | Block; show the missing information to authorised Office staff |
| `NO_PROJECT` | Block; exclude from missing-registration and expected-appointment counts |
| `NOT_STUDYING` | Block; use the returned reason and preserve historical-semester semantics |
| No linked Student account | Exclude from automatic stage-based assignment; show an actionable linking issue |
| Period has no academic-semester link or a blank/invalid assessment | Block new task creation; surface the configuration problem without guessing |

Manual backup tasks should follow the same stage check. The existing override reason authorises a backup assignment; it should not also authorise bypassing academic registration. A dedicated wrong-stage exception would require a separately agreed policy and implementation.

Do not guess a historical period's stage from its name or rubric. Existing records and submitted marks remain preserved. This integration does not restore the historical assessment-classification UI that was previously removed; unresolved legacy periods require a separately authorised resolution.

## 4. Marks implementation scope

My proposed scope covers:

1. Shared, batched stage eligibility in `period_recipients`, keeping the existing checks.
2. Recipient preview, expected-student and missing-appointment calculations, plus missing-registration and unlinked-profile explanations.
3. Manual and automatic generation, including lecturer task/dashboard entry points and reconciliation generation.
4. Backup assignments and both direct appointment-replacement task-creation paths. These do not all pass through `period_recipients` today.
5. Student-return resume and reconciliation resume. A wrong-stage task must not become active again through a repair path.
6. Completion-window eligibility and submission enforcement where necessary so a paused or ineligible task cannot become usable through an extra-time grant or stale page. Existing authorised completion of historical work must be reviewed against the relevant semester and preserved where valid.
7. Existing-task mismatch detection, correction impact/apply functions, audit and reconciliation presentation.
8. Backend and frontend regression coverage, including concurrent registration changes and assignment operations, plus updates to the three project documentation files.

The work must handle linked profiles consistently. A legacy profile matched only by matric must not silently acquire the authority of a linked account; unresolved profiles need explicit review/linking.

## 5. Corrections and existing Marks tasks

The proposed handling is:

| Existing task state | Proposed response when it becomes ineligible |
| --- | --- |
| Not started | Retire with the reason and lifecycle audit |
| Draft | Pause and retain scores, comments and history; invalidate conflicting completion access |
| Already paused | Preserve the draft and existing pause evidence; record the stage issue without automatically resuming it |
| Submitted | Preserve scores, submission and original task evidence; add an Office review issue |
| Retired | Preserve as history; do not revive automatically |

These are technical recommendations for joint agreement, not a faculty decision about whether an assessment is academically valid. Existing authorised submitted-mark correction procedures remain separate; registration correction must not invoke them automatically.

Two additions are needed to the current Registry implementation:

**Check every affected existing task for the student and semester.** The current `marks_impact` only checks the previous confirmed stage and returns no impact for first confirmation. That misses wrong tasks created before registration existed, as well as some void/reconfirmation cases. The proposed post-change eligibility should determine which tasks become ineligible, while matching tasks remain unchanged. A blank legacy assessment should be exposed for review, not treated as a guessed stage.

**Apply task handling in the same transaction as the registration write.** The current acknowledgement and history do not themselves resolve any Marks task. The preview must distinguish affected tasks from historical evidence and from work that remains valid.

Initial confirmation and reconfirmation after voiding need the same impact review whenever existing tasks are affected. Bulk first-confirmation must not silently bypass this. If bulk impact review is not ready, affected rows should be refused and directed to an individual reviewed flow, while safe rows can follow the documented bulk transaction behaviour.

If a later correction makes a paused or retired task eligible again, do not automatically resume or duplicate it. Report it for an explicit audited resolution. Agree the uniqueness/generation rule so generation cannot create a fresh active task around a paused draft awaiting review.

Correct new tasks may be generated through the normal eligible generation flow when the period permits it, subject to that existing-task review. A stage confirmation must not automatically reopen a closed period, extend a deadline, grant extra time or alter an appointment. After closure, report the impact and use an existing authorised recovery route only where its rules permit it.

## 6. Integration contract and ownership

**Registry / Xiang:** owns registration data, Office permissions, confirmation/correction/void/reconfirmation entry points, revision checks and append-only registration history. Registry should call the Marks functions for all relevant writes, including bulk confirmation, and preserve the existing read lookup.

**Marks / Wey Cheng:** owns stage enforcement in Marks, task impact classification, task lifecycle changes, submitted-work review issues, relevant access/deadline guards and Marks audits.

**Joint contract to settle before wiring the write flows:**

- A read-only preview function accepts the student, semester and proposed registration state/stage, and returns affected task identities and counts, grouped by period and task state. Include unresolved legacy evidence separately. Registry should not duplicate Marks task-state rules.
- An apply function accepts the same change context, actor and reason and operates within Registry's enclosing transaction. It returns the actual outcome for registration history. Final function names and the serialisable response schema can be agreed in the implementation plan.
- The save must detect changes since the reviewed preview. Registration revision alone does not detect a draft being submitted or a new task appearing. Recompute under locks and reject a stale impact acknowledgement rather than applying an unreviewed change.
- Agree one compatible lock order across registration writes, generation, replacements, draft save/submission, completion access and task repairs. A Student lock alone is not evidence that every competing task write is serialised; test the actual paths on PostgreSQL.
- Failure in either registration or task handling rolls back the whole operation. No post-commit cleanup for corrections. Preserve task snapshots, actor, reason, registration revision and the reviewed/applied impact in appropriate audits.
- Repeated requests must not duplicate tasks, repeatedly retire the same work or overwrite another pause reason.

There are no agreed callback names, payload version or delivery date yet. Please acknowledge the intended behaviour above, then we can settle the exact API and implement both sides against it.

## 7. Appointment applications and other modules

Keep existing appointment-application rules for this slice. Do not introduce a confirmed-P1 prerequisite for first supervisor applications yet: the current suggestion uses an approved first application to suggest P1, so a prerequisite could create a circular dependency. Office must confirm when stage registration happens relative to the application.

RP2 replacements, extensions, repeats and supervisor/panel differences also need explicit rules. This does not prevent Marks tasks created by an appointment or replacement from being stage-checked immediately.

Stage-based calendar reminders, announcement audiences and required-document targeting are separate integrations. They should not be silently added to this Marks fix. All consumers should eventually use the same confirmed source if their approved scope requires stage targeting.

## 8. Review, local setup and reported failures

The review verified the lookup and inspected the semester-activation integration and related eligibility/task paths. The activation move is an after-commit operation; successful activation therefore does not guarantee every Registry move succeeded. Special-semester participation remains separate from project-stage registration. No project-stage progression should be inferred from an automatic semester move.

This is not blanket acceptance of every lifecycle/reporting change in PR #30. In particular, existing `withdrawnStudents` aggregates now include other terminal statuses; visible labels and consumers should be checked so they do not present Terminated/Passed away as literal withdrawals.

Verification on my current checkout:

- All 75 tests in `accounts.test_student_lifecycle`, `marks.test_period_targeting` and `marks.test_backup_reassignment` passed using a separate temporary PostgreSQL test database. This is a baseline, not end-to-end stage integration acceptance.
- `npm run lint` reproduced the missing `AlertTriangle` import and the obsolete `onHelpdeskTrigger` prop. It also found a type mismatch in my untracked `periodHistory.fixture.tsx`. I will handle these local frontend issues separately; they have not been fixed by this reply.
- Your other reported failures have not been rerun or attributed to a cause by this review. I will own reproducing and triaging the list and send you the results. I will fix issues in my modules; for Registry/other-owner failures I will provide the reproduction and coordinate the fix with the relevant owner. This is not a claim that the whole list is caused by PR #30 or a promise to fix unrelated modules without review.
- My configured database has additional pending migrations before accounts.0020/0021 and faq.0005, including semester data seeding. I have not applied migrations to it. I will review the complete plan and the existing data before running the upgrade; test-database migration success does not replace that review.

The local branch is `codex/portal-consistency-and-toast`, with existing uncommitted period/calendar work. No separate integration branch or delivery date is promised here. We should isolate and review the Marks slice and agree its merge arrangement before delivery. No application files or student records were changed for this reply, and it has not been sent automatically.

## 9. Office decisions still needed

Please confirm these with Office and share the answers before we treat them as faculty rules:

1. Is one RP stage per student per academic semester always sufficient, including repeats, transfers and special cases?
2. What is the authoritative P1/P2 source, who can confirm/correct it, and can Maya export a usable list?
3. Are effective registration/withdrawal dates or official attempt numbers required?
4. What progression, repeat and return-from-leave rules apply across all three programmes, including Special Semester?
5. When is stage confirmed relative to first supervisor/panel applications, and which replacement/extension actions depend on it?
6. Who decides the academic treatment of wrong-stage submitted assessments, late registrations and cases discovered after closure? Are any assessment exceptions authorised?

We can develop the technical guards and integration tests without inventing answers to these questions. Operational rollout still needs a confirmed-registration population, explicit handling of existing mismatches and agreement on the applicable Office rules.

## 10. Joint acceptance checks

- Mixed P1/P2 students in one semester receive only matching tasks; retain programme, evaluator, participant and appointment restrictions.
- Missing/suggested/voided, no-project, leave, not-registered, waiting-for-Senate, special-semester and historical-semester cases return the intended result without guesses.
- Cover preview, automatic/manual generation, replacements, backup, resume/repair and relevant completion/submission paths.
- Cover first confirmation over pre-existing wrong tasks, P1/P2 correction, void/reconfirmation, bulk confirmation, paused drafts and submitted results.
- Preserve submitted marks and unrelated periods, appointments, pause evidence and audit history; no hidden regeneration around a paused draft.
- Reject stale preview/revision and concurrent write races atomically; no duplicates or partial correction.
- Make excluded/unlinked/missing cases actionable for Office, while keeping Marks tasks, scores and comments out of Student portal views.

Please confirm the technical direction and flag any Registry-side changes needed, especially the attention-list discoverability, first-confirmation impact handling and transactional callbacks. Office answers and exact delivery coordination remain separate follow-ups.
