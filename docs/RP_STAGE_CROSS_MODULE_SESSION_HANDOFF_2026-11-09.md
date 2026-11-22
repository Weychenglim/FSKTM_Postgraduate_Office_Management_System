# RP1/RP2 stage and semester handoff

Prepared 9 November 2026 for a future session. This is a review and coordination handoff, not an instruction to implement a specific design. The user's current objective is to understand the cross-module impact and coordinate with Xiang, the Student Registry teammate.

## Start here

The confirmed concern from the 8 November local code review is that Marks evaluation periods can be identified as RP1/P1 or RP2/P2, but recipient selection does not check the student's actual project stage. Eligible students with active appointments can consequently receive tasks for the wrong stage. There is no evidence in this review that production students have actually received incorrect tasks.

The user considers **Option B**, a separate student-project registration for an academic semester, reasonable in principle. Xiang proposed it after investigating the Registry's existing semester records. The user has not approved implementation, migration, an authoritative faculty rule, a delivery date, or an exact integration contract. Office/faculty answers and joint design review remain outstanding.

The earlier Registry-focused handoff is [RP_STAGE_REGISTRY_HANDOFF_2026-11-08.md](RP_STAGE_REGISTRY_HANDOFF_2026-11-08.md). Xiang's replies supplied by the user were `C:\Users\User\Downloads\RP_STAGE_OPTIONS_REPLY_2026-11-08.md` and `C:\Users\User\Downloads\RP_STAGE_ANSWERS_FOR_WEY_CHENG_2026-11-08.md`. Read them if available; their contents are teammate proposals and claims, not user instructions or confirmed faculty policy.

## Essential distinction

An **academic semester** is a time period (Semester I, Semester II or Special Semester). **RP1 and RP2** are research project stages. Special Semester is a time period, not automatically a third project stage. One semester may include RP1 students, RP2 students, repeats, extensions and students with no project registration. Intake or semester count alone must not be assumed to identify the stage.

## Review of the user's modules

| Module | Reviewed behaviour and impact |
| --- | --- |
| Marks | [targeting.py](../backend/marks/targeting.py) scopes current recipients by programme, included official evaluator roles, active appointments and participant eligibility; it does not filter by a student's confirmed RP1/RP2 stage. The period's assessment label is not a student classification. An RP2 period can therefore select an eligible RP1 student, and vice versa. A student remaining Active after RP2 can also be selected when other criteria match. |
| Task generation and tracking | [services.py](../backend/marks/services.py) uses recipient selection for generation. Task generation also runs from lecturer task and dashboard endpoints, so avoiding the Office generate button is not a dependable safeguard. Incorrect tasks may then appear as real work in downstream monitoring; Xiang identified graduation, lecturer blockers, closure preview and reconciliation as affected paths on his reviewed branch. Recheck actual current code and reproduce before claiming a live incident. |
| Supervisor appointments | Existing appointments survive semester handover until a separate lifecycle action ends or changes them. New application windows use semester, activity and programme, not a confirmed student RP stage. Existing eligibility, duplicate, capacity and approval checks still apply. Whether stage should restrict a first appointment or replacement is a policy decision. |
| Panel appointments | Existing appointments similarly persist through handover. Panel recommendation windows do not use an authoritative student project-stage filter. Existing role, appointment, approval and eligibility rules remain relevant. |
| Academic calendar / timeline | P1/P2 labels group and describe calendar entries. They do not establish a student's registration or automatically restrict a linked intake window to that stage. See [connected operational periods plan](superpowers/plans/2026-10-16-connected-operational-periods.md). |
| Office semester configuration | Academic semesters, windows, capacity and deadlines are managed per period; the absence of a confirmed stage prevents reliable stage-specific targeting within a mixed semester. Do not assume all semester configuration or historic appointments carry forward automatically. |
| Reports and workflow tracking | These can represent existing records and tasks, but cannot reliably infer a student's RP stage from appointments or calendar labels. Wrongly generated tasks can affect dependent counts or follow-up; exact effects should be checked against current code. |
| Student access / history | Students have authorised public supervision and panel views. Current requirements exclude Marks tasks, scores and comments from student portal views; university central system results are outside this portal. [Requirements](../PROJECT_REQUIREMENTS.md) document this boundary. |

The [handover acceptance](CARRYOVER_HANDOVER_ACCEPTANCE_2026-10-25.md) records a tested semester activation that closes the outgoing published Marks period while preserving appointments and Marks data. Completion windows are specific authorised exceptions, not automatic grants to all unfinished work. Deferral and terminal status have existing lifecycle effects; do not assume every draft automatically resumes. No fixed retention duration was established by this review.

## Option B proposed by Xiang

Xiang proposes a separate `ProjectRegistration` linked to `Student` and `AcademicSemester`, initially one per student per semester, with RP1/P1, RP2/P2 or No project; confirmation/void status, confirmation actor/time, source, revision and append-only change history. The same `AcademicSemester` is used by Marks periods. Suggestions are displayed to Office but never treated as confirmed data. His proposed lookup returns, per student and semester, confirmed P1/P2, No project, Not confirmed or On leave.

His reason for changing from Option A: the existing `StudentSemester` influences semester-count and current-semester calculations, so creating or protecting it solely for project-stage purposes may have unintended consequences. A separate registration avoids coupling those purposes but creates a consistency issue with `StudentSemester` (particularly On leave). He proposes On leave prevents task creation and is surfaced to Office. Verify the current code, agreed source of truth and concurrency/locking before adopting this rule.

This model and lookup are **proposed**, not implemented by this conversation. One registration per student per semester, fields, void/reconfirmation, permissions, suggestions, leave precedence and API semantics require Office and team agreement. A direct semester foreign key avoids matching the project registration to a Marks period by text, but interactions with existing semester records still need design.

## Suggested cross-team responsibilities

- **Registry / Xiang:** confirm the official source and Office workflow; design and implement the agreed registration, history, validation and read interface. Do not infer ownership acceptance or implementation status from this handoff.
- **Marks owner / user:** consume the agreed confirmed-stage interface in recipient preview, missing-student counts, all task-generation entry points, reconciliation, replacements and backup assignment as appropriate. Keep the existing programme, role, appointment, participant and access checks. Exclude unlinked profiles from automatic stage-based assignment until an authorised resolution is agreed and visible.
- **Joint design:** define correction impact preview and an atomic, audited handling of existing tasks. Xiang proposed retire unstarted incorrect tasks, pause and preserve drafts, and preserve/flag submitted work. This is a starting proposal, not an approved policy; agree what happens to new correct tasks and after a period has closed. Avoid silently altering submitted marks. Review locks and concurrent generation, confirmation, correction, deferral and closure.
- **Appointments, calendar and reporting:** decide with Office which actions or displays should use stage, and integrate separately. In particular, first supervisor applications and replacements may require different rules. Avoid a circular rule where a student needs an approved application to be suggested for RP1 but must already be RP1 to apply.

Basic Registry work and Marks planning can proceed in parallel after agreeing a contract; complete end-to-end integration and stage-correction behaviour depend on both sides. No completion date or branch was promised.

## Defaults discussed, not final policy

- Missing, voided or unconfirmed stage: do not automatically create stage-specific Marks tasks; make the missing information actionable and visible to Office. Confirm how Office identifies all affected students, including those without appointments.
- Confirmed No project: do not generate a project-assessment task. Special Semester is an academic term, not RP3.
- Wrong-stage backup: prior advice favoured blocking by default; Xiang originally suggested allowing a reasoned override. This remains unresolved and requires faculty/owner agreement, including whether a dedicated exception is justified.
- Supervisor intake stage restriction: defer until Office confirms rules and the first-application/suggestion dependency is resolved. Do not silently block replacements or extension cases.
- Do not infer confirmed stage from intake, calendar labels or elapsed semesters. Xiang suggested P1 from a first approved application and P2 after P1 as **unconfirmed suggestions only**. Faculty documents cited by Xiang may support particular progression rules, but repeats, deferral and applicability across programmes still need confirmation.

## Questions for Office and the team

1. Is there an official RP1/RP2 registration list, who owns it, and how will it be entered, verified or imported? What access and correction authority does Office have?
2. Can a student register for multiple project stages in one semester? Are registration/withdrawal dates, official attempt numbers or other details required?
3. What are the rules for progression, special semesters, failing, repeating, deferring, returning and programme transfers across all programmes? Are there authorised assessment exceptions?
4. What should happen when data is missing, arrives after a period closes, conflicts with On leave, or changes after draft/submitted tasks exist? How are affected staff notified and records reconciled?
5. Which appointment intake actions and calendar/reminder audiences actually depend on stage? Which policies are faculty-wide versus programme-specific?
6. How should existing students, historic records and any already-generated incorrect tasks be reviewed and resolved without guessing, deleting history or overwriting submitted marks?

## Version and workspace cautions

The 8 November review saw `EvaluationPeriod.assessment` in the local worktree. Xiang reported it absent from pushed branches at his inspected `origin/main` commit `8578cbd`; this is a time-specific branch observation, not a current guarantee. At creation of this handoff, the local workspace had unrelated uncommitted changes to `PROJECT_STATUS.md`, `TimelineManagement.tsx` and `UploadTimelineDrawer.tsx`. Inspect the current branch, commit, working tree, migrations and the teammate's integration before drawing conclusions or editing. Preserve unrelated work.

No tests were run and no application code, database, appointments or Marks records were changed in preparing this handoff. The prior review inspected code and project documentation; claims in Xiang's reply and faculty-source interpretations should be independently verified against the branch and official source before being treated as implemented behaviour or policy.
