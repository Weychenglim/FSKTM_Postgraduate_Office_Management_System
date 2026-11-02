# Pending work and decisions register

Updated 8 October 2026, Malaysia. Start here when resuming development. This document consolidates our discussion; creating it does not implement the pending access changes or certify the whole system.

Release update, 9 October: [PR #13](https://github.com/Weychenglim/FSKTM_Postgraduate_Office_Mangement_System/pull/13) merged the accumulated application/documentation changes into `main` at `fc8265a3b22e15430be6349955f7a240b72c7bfa`. R01 is complete for this release. Fresh verification passes all 683 backend tests, 75 frontend scripts, TypeScript/build and configuration/documentation checks; local `main` application files match the tested source. See the newest [Project Status](../PROJECT_STATUS.md) section for exact evidence. T01-T06 remain pending.

## Current permission separation status (28 October 2026)

T01-T06 are complete for the local merged source and scoped rollout. The API was restarted on 28 October; the one legacy Office staff flag has now been removed using the guarded command. Final preview reports zero; repeat apply is a no-op. Fresh verification passed 123 isolated tests (including 29 real Marks browser/API assertions) and 83 runtime assertions with unchanged snapshots across 63 protected tables. Existing/fresh Office portal sessions work, Office admin access is denied, and real technical admin recovery works. See [local rollout evidence and limitations](OFFICE_ACCESS_ROLLOUT_2026-10-28.md). Production verification and A05-A07 remain separate. Historical restart-blocked and account-configuration statements below are superseded by this update.

## Historical permission separation update (25 October 2026)

T01-T06 source implementation and scoped verification are recorded in [Office/admin separation](OFFICE_ADMIN_SEPARATION_2026-10-25.md). Active Office business authority is independent of admin flags; submitted Marks correction/reopening requires explicit user/group permission. Technical-only admin login/session checks and inspection-only governed records are implemented. The existing local API has `--noreload` and has not activated this source: automatic approval review rejected its restart with “blocked by policy”. A separate local technical login is provisioned and verified. Preserve the remaining Office staff flag until the updated API is running, then use the preview/apply conversion command. No demo reseeding or credential reset is required.

Profile-maintenance follow-up, 25 October: the review's P1 is fixed in source. Existing Student/Lecturer/OfficeStaff owner links are read-only and crafted reassignment is rejected before writes; valid creation/maintenance are preserved. Nine permanent ownership tests and the broader 394-test account/protected-admin gate pass. See [review resolution](OFFICE_ADMIN_SEPARATION_REVIEW_2026-10-25.md). This does not complete the still-blocked local API restart or Office flag conversion.

## Direction to retain

Acceptance update, 25 October 2026: at the user's request, resumed A01–A04 ahead of the still-pending technical-admin separation. Core journeys and regression evidence are recorded in [supporting acceptance](SUPPORTING_SUPERVISION_ACCEPTANCE_2026-10-25.md), [research/transfer acceptance](RESEARCH_TRANSFER_ACCEPTANCE_2026-10-25.md), [delegation acceptance](DELEGATION_ACCEPTANCE_2026-10-25.md), [carryover/handover acceptance](CARRYOVER_HANDOVER_ACCEPTANCE_2026-10-25.md), checklist E10–E13 and the newest root status. This is scoped acceptance, not completion of every compound/external clause or T01-T06. Next browser slice is A05 Dashboard/Timeline/report/export/dossier/reconciliation combinations.

- Office Staff/Admin is one business role. Django superuser/admin access is a separate technical privilege; Django's `is_staff` means admin-site eligibility, not someone's employment category.
- Office users should use the main portal for daily work. Django admin should be used by technical administrators only when maintenance or investigation is needed.
- Governed decisions, Marks mutations and configuration changes must use validated, transactional, audited workflow services. Technical admin access must not provide another route around those services.
- Apply the permission separation across all five owned modules and their shared dependencies, not just Marks. Existing portal controls should be preserved rather than duplicated in new configuration screens.
- Scope remains Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks, and Workflow/Approval Tracking. Registry, general Files, FAQ, Letters and Announcements remain separate ownership/integration work.
- A general permission editor in the main portal is not required by this discussion. Django already provides technical Users/Groups/model-permission configuration. Faculty rules and coordinator identity policy remain deferred.

## Current facts: implemented versus pending

| Item | Current state |
| --- | --- |
| Office admin menu | Local Office is non-staff/non-superuser and cannot enter admin. Explicit business permissions are retained; dedicated technical accounts provide maintenance access. |
| Governed admin screens | Marks, appointment workflows, timeline and academic configuration have protected inspection screens. This does not mean every admin model is read-only. |
| Other admin editing | Technical accounts with sufficient permissions can still edit accounts/profiles, letter templates, announcements and notifications. Review their intended maintenance boundary before changing them. |
| Marks daily work | Correction/reopening moved into the Office portal; reasons, reviewed-state conflicts and before/after audits are implemented. Marks admin is inspection-only. |
| Permission configuration | Django Users/Groups/model permissions exist. Portal role/scope rules exist. No general portal permission-management screen is implemented. |
| Technical-only admin login | **Implemented, active and verified locally on 28 October.** Real technical login works; Office admin sessions are denied. |
| Business authority independent of admin flags | **Implemented, active and converted locally on 28 October.** Zero legacy Office flags remain; existing/fresh portal sessions retain authorized access. |
| Local services | Latest checked startup: Django 8000, portal 3001, existing `fsktm_pg_office` database, mocks/demo login disabled. Check live health when resuming; this is a snapshot, not a promise services remain running. |
| Git/release | The accumulated release is committed, pushed and merged into `main` through PR #13. Earlier restart snapshots did not publish it; the 9 October release update above supersedes their uncommitted/unpushed state. |

## Priority 1: separate technical admin access from Office workflow authority

The following table retains the original task definitions. Source implementation, local activation, conversion and scoped access verification are complete as of 28 October; production deployment remains separate.

| ID | Task | Status | Done when |
| --- | --- | --- | --- |
| T01 | Define the technical admin access rule and authorized account set. Dedicated active Technical Administrator superusers; no delegated technical group. | Implemented in source | The rule identifies who may enter `/admin/`, who manages permissions and how recovery access is retained. Do not promote a routine Office account merely to show more menus. |
| T02 | Establish shared business authorization for affected Office actions. Keep role, active-account/lifecycle eligibility, programme scope and explicit action permissions where required. | Implemented and scoped tests pass | Service and API checks agree; an Office role label alone cannot silently grant privileged corrections or maintenance authority. |
| T03 | Replace affected `is_staff` dependencies with the agreed business checks, including API capabilities shown to the frontend. | Implemented and scoped tests pass | Every dependency in the matrix below works for authorized Office accounts without requiring Django admin access; unauthorized actors remain rejected. |
| T04 | Restrict Django admin login to the technical access rule. Retain read-only governed records and review editable maintenance sections. | Implemented/tested and active locally, 28 October | Ordinary Office users cannot enter admin; designated technical users can; protected models still reject direct writes, including by superusers. |
| T05 | Update seed/bootstrap and existing-account permission configuration consistently. Use explicit, repeatable setup; preserve credentials and intended authority. | Local conversion complete; zero legacy Office flags, 28 October | Existing authorized Office users retain their portal functions; future accounts receive the intended business permissions; no automatic superuser promotion or credential reseeding occurs. |
| T06 | Verify access separation and update all source documents, guides and checklist evidence. | Local scoped rollout verified: fresh 123 tests and 83 runtime assertions | Portal actions succeed for authorized non-admin Office users; wrong-role/unprivileged/inactive actors reject; technical admin access works; audit/validation/concurrency behavior remains intact. |

### Confirmed dependency matrix

This historical dependency matrix identifies the pre-change coupling. The 25 October report records the replacements, including additional Office browse/attention/export checks and direct-service Marks permission enforcement.

| Module/dependency | Existing portal functionality | Remaining admin-flag coupling / source |
| --- | --- | --- |
| Marks | Correction/reopening, completion windows and closure preview | `is_staff` in [views](../backend/marks/views.py), [services](../backend/marks/services.py) and [completion windows](../backend/marks/completion_windows.py). Correction/reopening also requires `marks.change_markentry`; preserve that explicit authority or an equivalently reviewed business permission. |
| Dashboard participant lifecycle | Deferral/reactivation, withdrawal/graduation and Lecturer retirement | [participant lifecycle service](../backend/accounts/participant_lifecycle.py) requires Office role plus `is_staff`. Core timeline authorization is already role based. |
| Supervisor research amendments/transfers | Audited profile changes and approval chains | [research amendments](../backend/appointments/research_amendments.py) uses active Office plus `is_staff` for Office authority. |
| Supervisor/Panel carryover capacity reassessment | Reasoned capacity policy/reassessment | [capacity reassessment](../backend/appointments/capacity_reassessment.py) uses active Office plus `is_staff`. Ordinary candidate capacity management has role-based checks. |
| Workflow approval scope / acting delegation | Programme-bound delegation grant/revocation and audits | [delegations](../backend/accounts/delegations.py) uses active Office plus `is_staff`. Core decisions/reports still retain their separate actor/programme rules. |
| Other modules: regression boundary only | Letters and Announcements have existing authority checks | Their code also references staff/superuser flags. Check for regressions from shared access changes; do not silently redesign teammate-owned workflows or treat them as newly owned modules. |

Suggested T06 test cases: authorized Office with no admin access can correct/reopen Marks, grant/revoke completion windows, manage participant lifecycle, perform authorized research changes/reassessment and manage delegation; direct admin entry fails; equivalent unauthorized requests fail without data/audit changes; technical users inspect governed models but cannot bypass workflows. Browser and automated evidence must be recorded separately.

### Django admin after this slice

The target is an occasional technical tool offering record search/inspection, audit investigation, authorized account/access administration and explicitly retained maintenance functions. Routine Office users should have no need to open it. Exactly which non-governed maintenance edits remain available is a T04 review decision, not a claim that all editing will disappear.

## Priority 2: finish owned-module acceptance

29 October A07 update: [full portal/native acceptance](FULL_PORTAL_NATIVE_ACCEPTANCE_2026-10-29.md) completes the named core A07 slice with real role/login approval-to-Marks journeys, files saved to disk and independently inspected, native availability/reload controls, mobile privacy and route restrictions. First-event creation in an empty semester is fixed and retested. E17 preserves precise boundaries: remaining work is unrun sequential manual combinations, shared integrations/external policy and deployment acceptance, not an unimplemented core portal journey.

Closed on 29 October 2026: the E17 participant-lifecycle report-label follow-up now uses container-sized columns and spaced, wrapping labels. Temporary headless Chrome production-component checks reproduce the original overflow and verify all seven labels/counts at Office widths 320/390/768/1024/1280/1440px, plus the second summary render path at 390/1280px. Screenshot inspected; TypeScript, production build and three existing report checks passed. This synthetic layout evidence does not extend full-shell authorization or remaining manual acceptance. See the layout follow-up in `FULL_PORTAL_NATIVE_ACCEPTANCE_2026-10-29.md`.

28 October A06 update: [compound lifecycle/Marks acceptance](COMPOUND_LIFECYCLE_MARKS_ACCEPTANCE_2026-10-28.md) adds 20 persisted/API/concurrency cases and two targeted real-HTTP/browser journeys (24 assertions), including reproduced/fixed private lifecycle reason leaks through Student closure/cancellation projections. E16 records core technical evidence without promoting every manual compound clause. Next is A07 and the sequential manual guide; shared Registry responsibility handover and external/deployment conditions remain separate.

28 October A05 update: the [reporting/reconciliation pass](REPORTING_RECONCILIATION_ACCEPTANCE_2026-10-28.md) adds nine persisted/API combinations and six real-HTTP production-component journeys (132 assertions), with parsed XLSX and exact academic/Marks preservation. A cross-student late-response bug in the dossier is fixed with a failing-before/passing-after browser regression. E15 records the evidence and boundaries. The next acceptance focus is A06; full-shell/native/environment cases remain A07. This does not certify unexercised compound/external clauses.

Most features below already exist. Their status means complete browser/persisted evidence is still missing, not that every feature needs to be built from scratch. Fix only demonstrated defects and add relevant regressions.

| ID | Slice | Status | Acceptance work |
| --- | --- | --- | --- |
| A01 | Supporting supervision | Core journey verified; remaining combinations | E10: candidate/Coordinator rejection, primary cancellation, approval, incumbent-safe replacement, Office closure, current-access revocation/own history, Student privacy and unchanged primary/Panel/research/Marks. Fresh API/lifecycle/concurrency evidence supplements the browser journey; other role combinations, compound lifecycle/report/export/dossier/reconciliation and faculty conditions remain scoped pending work. See the 25 October supporting acceptance report. |
| A02 | Research amendments/programme transfers | Core journey verified; remaining combinations | E11: 32 API/lifecycle/concurrency/migration/browser tests, including 148 real HTTP/browser assertions for required reasons, research decisions/recovery, sequential transfer acknowledgement/approval/rejection, role/privacy/history boundaries and exact retained applications/team/Marks/windows. Remaining delegation/semester/cross-screen/report/export/dossier/reconciliation and audit-outage combinations remain scoped pending work. |
| A03 | Acting delegation | Core journey verified; remaining combinations | E12: 46 API/integration/concurrency/retirement/migration/report/dossier/browser tests; 202 real HTTP/browser assertions cover Office reasons/overlap, scope, stale revocation, focus refresh and isolated-clock scheduled/inclusive-end/expiry states. Parsed XLSX scope/privacy and retained academic/Marks/actor/history assertions pass. Independent review unavailable due to account usage limit; direct review completed. Full-shell, research/semester/carryover, complete responsibility/retirement and audit-outage combinations remain pending. This business delegation differs from deferred cross-account identity policy. |
| A04 | Carryover and semester handover | Core journeys verified; remaining combinations | E13: 63 API/integration/concurrency/migration/activation/closure/window/browser tests, eight real HTTP/component journeys and 214 assertions at 1440/390px. All three request kinds cover reasoned grant/replacement/revocation/stale recovery/consumption with original semester, actual policy/actor and retained Marks; activation preserves draft/window rights and blocks archival. Final open-dialog layout recheck passes. Full-shell and research/delegation/lifecycle/report/export/reconciliation combinations remain pending. Independent review unavailable; direct review completed. |
| A05 | Dashboard/Timeline/reports/exports/dossiers/reconciliation | Core A05 pass verified; remaining compound/native boundaries in A06/A07 | E15: role/semester/programme reports and parsed XLSX scope, totals, formula safety, Student privacy, supporting/transfer/delegation/handover projections, reconciliation reason/stale/replay/audit/rollback, calendar CRUD/history/read recovery and dossier response identity. Nine new persisted/API cases and six real-HTTP component journeys (132 assertions); see the 28 October report and latest root status. Earlier evidence is retained; no blanket compound-clause certification. |
| A06 | Remaining compound lifecycle/Marks cases | Core technical pass verified; manual/shared boundaries remain | E16: supporting/team terminal closure and nomination resolution, Coordinator responsibility/delegation retirement, audit-outage rollback, concurrent terminal/Marks writes, reactivation after ended appointments, direct primary/Panel/supporting/backup/window/write bypasses and scoped historical reads/JSON/XLSX. Twenty persisted/API/concurrency cases and two real-HTTP browser journeys (24 assertions). This does not certify every manual screen/export combination or shared Registry responsibility handover; see the 28 October report. |
| A07 | Outstanding browser/environment cases | Core full-portal/native pass verified; remaining manual/environment boundaries | E17: actual role/login approval chains and locked evaluations, PDF/template/XLSX saved to disk, parsed role scope, native reload Cancel/Reload, native availability picker/date validation/cancellation, mobile Student privacy and route denial, Technical portal refusal, and fixed first manual calendar event. Other editors/date controls, browsers and unrun sequential combinations need specific evidence; see the 29 October report. |

The [406-clause checklist](FIVE_MODULE_ACCEPTANCE_CHECKLIST.md) is the detailed evidence inventory: **48 Passed, 358 Awaiting acceptance** at this snapshot. These are clause-level acceptance statuses, not a development-completion percentage. A passed test candidate is not automatic proof of every compound requirement.

## Completed work to preserve

Do not reopen these as unfixed defects without a new reproduction. Each report limits its own evidence.

| Work | Evidence / limitation |
| --- | --- |
| Original five review fixes: role overlap, Timeline request contract, admin bypasses, negative Marks validation, Marks semester projection/filter | Current requirements/status supersede the [3 October historical handoff](HANDOFF_FINAL_OWNED_MODULE_REVIEW_2026-10-03.md), which described the defects before fixes. Later browser slices and regressions are recorded in the checklist. |
| Protected Django admin boundaries | [Admin acceptance](DJANGO_ADMIN_ACCEPTANCE_2026-10-06.md). Its earlier editable submitted-Marks path is superseded by portal migration; do not instruct Office users to correct Marks through current admin. |
| Appointment cancellation/replacement | [Replacement acceptance](APPOINTMENT_REPLACEMENT_ACCEPTANCE_2026-10-07.md). |
| Appointment rejection/capacity/private-file paths | [Failure-path acceptance](APPOINTMENT_FAILURE_PATH_ACCEPTANCE_2026-10-07.md). |
| Advanced Marks scope/backup/semester/completion windows | [Advanced Marks acceptance](ADVANCED_MARKS_ACCEPTANCE_2026-10-07.md). |
| Submitted Marks portal migration | [Portal Marks acceptance](MARKS_PORTAL_ACTIONS_ACCEPTANCE_2026-10-07.md); 142 Marks backend tests passed on 8 October. |
| Core participant lifecycle and display/privacy fixes | [Lifecycle acceptance](PARTICIPANT_LIFECYCLE_ACCEPTANCE_2026-10-08.md); final 253 scoped backend tests, 75 frontend scripts, TypeScript and production build passed. This is not a new full-backend or production certificate. |

## Separate queues: release, deployment, teammate work and deferred policy

| ID | Work | Status / boundary | Done when |
| --- | --- | --- | --- |
| R01 | Review, commit and integrate accumulated changes | Completed for this release, 9 October | PR #13 is merged, local `main` application files match the tested source, and Project Status records verification/review/merge evidence. Future T/A slices require their own review and integration. |
| P01 | Actual production-host configuration | Pending deployment verification | Provision/check the shared PostgreSQL authentication cache across workers; verify host/proxy/HTTPS/cookies/CORS, static/media/private documents, SMTP, database migrations, backup/restore and rollback on the intended host. Shared-cache code exists; production provisioning and multi-worker proof remain. |
| P02 | Final acceptance on deployment-like environment | Pending after remaining development | Repeat critical role workflows and authorization checks on the real configuration; record observed results and remaining limitations. |
| X01 | Student/staff Registry and routine account management in the portal | Teammate/shared scope; integration missing | The responsible owner implements the missing backend/persisted creation/import/edit/account flow. Until then, technical account provisioning may still need Django admin. This is additional work beyond T01-T06. |
| X02 | General file repository/student submissions and FAQ | Teammate scope; integration gaps | Real persistence and authorized upload/download or FAQ backend are supplied and tested. Supervisor application documents are already a separate live feature. |
| X03 | Announcements/notifications and Letters | Teammate acceptance / existing limits | Complete recipient/attachment/unread/deep-link acceptance and template/details/print checks; clarify the absent issued-letter ledger if required. Do not infer a new ledger requirement from this register. |
| D01 | Faculty rules | Deferred external decision | Obtain faculty-confirmed rules before implementation; do not invent results/classification policy. |
| D02 | Coordinator identity policy | Deferred external decision | Resolve cross-account identity/conflict policy separately. Existing same-account Supervisor/Panel separation remains enforced. |

## How to resume and keep this current

1. Read this register, then the newest sections of [requirements](../PROJECT_REQUIREMENTS.md), [design](../ARCHITECTURE_AND_CODING_DESIGN.md) and [status](../PROJECT_STATUS.md). Historical handoffs are evidence, not the latest state.
2. Check branch/diff, running project services and database identity. Preserve accumulated changes and synthetic evidence. Never reseed normal accounts or reset credentials just to start a server.
3. Check T01-T06 against the completed local rollout above; repeat conversion only for a separately verified target environment. Do not treat the historical restart/flag blocker as current.
4. Continue the unrun sequential manual combinations and release/deployment checks, retaining the precise A01-A07 evidence boundaries. Use synthetic controlled records for terminal lifecycle/closure tests; shared Registry and external/deployment decisions remain separate.
5. After each slice, update its stable IDs here, all affected source documents and the checklist evidence. Mark Completed only with a report/check reference; keep proposed design, implemented code and accepted behavior distinct.
6. For human testing, use the [simple guide](SIMPLE_END_TO_END_TEST_GUIDE.md); use the [detailed whole-system guide](WHOLE_SYSTEM_END_TO_END_TEST_GUIDE.md) for variants. Login passwords remain in the private ignored local account sheet, never in this register or Git.

Suggested continuation instruction: **“Read the newest pending-work register and root source documents. Read E17 first, then continue unrun sequential manual combinations and any remaining editor/browser or deployment checks using the isolated manual test environment. Preserve existing accounts, synthetic evidence and uncommitted work; keep unexercised manual/shared/external cases explicitly pending.”**
