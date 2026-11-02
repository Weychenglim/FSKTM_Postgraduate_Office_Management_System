# Five-module test plan: brainstorm, roast and review

Prepared 28 October 2026. Deliverables: [start here](FIVE_MODULE_TESTING_START_HERE.md), [162-case sequential guide](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md), and the local-only [account preparation helper](../scripts/prepare_five_module_uat.py).

## Inspected starting point

- Branch `codex/portal-consistency-and-toast`, HEAD `c062330`, matched its remote when inspected. Origin was fetched; newer `origin/main` was not merged for this task.
- Pending Office rollout/A05 acceptance documents, new reporting harnesses and the Student Progress Dossier response-identity fix were read where relevant and preserved. The guide describes this working source, not a clean release snapshot.
- Sources: the three root governance documents, existing five-module clause checklist, pending-work register, Office operating guide, recent appointment/research/delegation/capacity/Marks/A05 reports, and current backend/frontend source.
- The user selected a separate local test database. Existing development accounts/passwords/academic records were not converted or reset.
- Original private preparation metadata records HEAD and the **tracked unstaged diff** hash, not a complete archive of staged/untracked source. The final private verification manifest separately records relevant current file hashes; pending work is not presented as a reproducible Git commit.

## Brainstorm

| Approach | Benefit | Problem |
| --- | --- | --- |
| Five separate module lists | Easy to divide by module | Hides dependencies; evaluation may precede appointments and early closure may block later cases. |
| Seed complete approvals/marks and inspect screens | Fast screenshots | Skips the actual approval chain; fixture presence can be mistaken for successful user work. |
| **One chronological core, then separate side cases** | Tests dependencies with clear checkpoints | Needs additional actors and honest prerequisites for exceptional states. Chosen approach. |

The account-only sandbox lets Office prepare everything first. S01 then completes the two appointment chains, evaluation, correction/reopening and reporting. Spare students handle failures/replacement/transfer/lifecycle. Terminal actions are last. The guide supplies nine Research Intent answers and actual actor/record checkpoints rather than a generic list of buttons.

## Roast: rejected assumptions and corrections

| Assumption / review finding | Correction | Current source |
| --- | --- | --- |
| A saved semester label permits applications. | Effective dates, Active status, Published capacity, lifecycle and intake rules all matter. | [Semester services](../backend/academics/services.py), [capacity services](../backend/academics/capacity_services.py) |
| Calendar import appends; all dates enforce work. | Import replaces selected timeline; preview is read-only. Informational calendar, opt-in appointment restrictions and Marks periods are distinct. | [Timeline views](../backend/dashboard/views.py), [operational periods](../backend/academics/operational_period_models.py) |
| Ordinary demo accounts cover everything. | 31 actors: three Coordinator programmes, two Office permission variants, spare evaluators and dedicated terminal/capacity students. | [Helper](../scripts/prepare_five_module_uat.py), [authorization](../backend/accounts/authorization.py) |
| Abstract alone satisfies Supervisor application. | Nine intent answers, title origin, course declaration, mapped proposal and final declaration included. | [Intent fields](../frontend/src/utils/supervisorResearchIntent.ts), [Section A](../frontend/src/utils/supervisorSectionA.ts) |
| A proposal-mapping selector exists. | Exact Research Proposal label generates `research-proposal`, the code this branch uses; no extra selector. | [Backend Section A](../backend/appointments/section_a.py) |
| Primary acceptance reserves nothing. | Submitted primary reserves zero, accepted primary reserves one, approval converts it. Supporting acceptance still reserves zero; Panel nomination reserves at submission. | [Reservation specification](superpowers/specs/2026-10-27-supervisor-capacity-reservations.md), [capacity](../backend/academics/capacity.py) |
| Submit to a full lecturer to test automatic closure. | Competing requests must be submitted before the place fills. | [Capacity closure](../backend/appointments/capacity_closure.py) |
| Student starts primary replacement; Coordinator finishes research-only changes. | Office initiates primary replacement; primary Supervisor finishes research-only amendment. | [Replacement](../backend/appointments/supervisor_replacement.py), [amendments](../backend/appointments/research_amendments.py) |
| Candidate acceptance creates an appointment; support automatically marks. | Final Coordinator approval creates appointment; supporting membership alone creates no official primary task. | [Supporting service](../backend/appointments/co_supervision.py), [Marks services](../backend/marks/services.py) |
| Two tasks is always the right total. | Two is S01's first checkpoint; later eligible appointments can automatically add tasks. | [Marks views](../backend/marks/views.py) |
| Test candidate selection after submission. | Keyboard/pointer selection moved before final Submit. | Guide D02/D03 |
| Prepare old drafts after replacement. | Old S03 drafts recorded before K07; inspect retired snapshots after handover. | Guide K setup/K10; [Marks services](../backend/marks/services.py) |
| Expect no-task shortcuts after tasks already generated. | No-task evidence before E; one-task and multiple-task cases have separate setup. | Guide D07/F03/J06 |
| Delegation will have a pending decision ready. | S16 explicitly stopped before Coordinator action; second tab retained for stale/revoked decision tests. | Guide N setup/N03/N04 |
| Regrant current cover over the scheduled cover just tested. | Revoke scheduled grant first; test programme overlap across recipients. | Guide N02/N06; [delegations](../backend/accounts/delegations.py) |
| Future Draft target is enough for carryover. | Expired-source handover first; reassessment requires Closed source/current effective Active target. Q03–Q05 are fixture/time-blocked until valid. | [Reassessment](../backend/appointments/capacity_reassessment.py) |
| Office correction needs staff/superuser flags. | Active Office plus explicit `marks.change_markentry`. Correction/reopening in portal; governed Marks inspection-only in Admin. | [Authorization](../backend/accounts/authorization.py) |
| Toast/blob/old report certifies acceptance. | Save/open actual files; test full shell; record fresh observations separately from historical component/API evidence. | [Checklist](FIVE_MODULE_ACCEPTANCE_CHECKLIST.md), [pending register](PENDING_WORK_REGISTER_2026-10-08.md) |
| Offline mode proves post-commit retry/audit rollback. | Controlled response-loss and database-audit failure cases are separate assisted tests. | Guide R03/R04 |

## Review outcome

Separate source audits covered appointments/privacy and Dashboard/Timeline/Marks/reporting. A skeptical reviewer raised five sequencing/prerequisite issues, then two further stale-tab/delegation-order issues. All were corrected; final reread found no remaining blockers and confirmed **162 unique case IDs** and agreement with the short entry guide. This reviews the plan; it does not execute manual cases.

Chapters map to the existing 406-clause inventory. There is no claim of one case per clause, automatic promotion of historical compound statuses, or blanket A06/A07 certification. Low-level race/adversarial assertions still need controlled evidence alongside UI observations.

## Actual preparation and verification

- Fresh local PostgreSQL database `fsktm_uat_20261028_5bfb97`, with migrations applied. Normal development database unchanged.
- Loopback-only portal/API at `127.0.0.1:3003` / `127.0.0.1:8003`. Other servers were not stopped. PIDs/logs remain private local artifacts.
- All 31 generated passwords/hashes, role/active states, portal/technical flags and Office explicit-permission variants verified. Credentials stay under ignored `backend/.env.five-module-uat/`.
- Starting business state: zero semesters, primary/Panel appointments and evaluation tasks; no research/rubric/delegation approvals pre-created.
- Separate media, secret and authentication cookies, including rotation-grace session key. Console email, real backend services, no demo login/mock fallback; normal permissions/throttles remain enabled.
- Sample inputs: genuine small PDF, empty PDF, renamed-text PDF, unsupported TXT and oversized PDF; synthetic content only.
- Three offline safeguard tests failed before implementation, then passed. They reject ordinary/remote database names and nonignored credential destinations and check distinct programme/permission/sacrificial actor requirements. Initial PostgreSQL creation used a transaction wrapper; corrected to create outside a transaction before successful provisioning.
- Actual proxied HTTP smoke: Office, Office-without-Marks-grant, Coordinator, primary Lecturer, Panel Lecturer and Student login/identity/UAT cookies/logout passed. Technical portal login returned 403; Office semester read returned 200; Student semester mutation returned 403. Frontend, direct API health and proxied API health each returned 200.

```powershell
.\.venv\Scripts\python.exe scripts/test_prepare_five_module_uat.py
.\.venv\Scripts\python.exe scripts/prepare_five_module_uat.py --check
```

No full regression suite or A–R manual workflow certification is claimed. No production deployment, existing-account/password changes, source merge, commit or push was performed for this task.

## Remaining prerequisites

- Successful expired-source handover/carryover and exact-time expiry need a separate timed fixture or natural transition.
- Legacy reconciliation/intentional warnings need controlled legacy data, not damaged ordinary records.
- Audit-write outage, simultaneous transactions, post-commit response loss and specialised mismatched/export-string data need isolated technical fixtures or relevant regressions.
- An account can exist before a case's appointment/task/state exists. The guide names setup or records Blocked; the account sheet proves no workflow outcome.
- If a prerequisite fails, record a defect and block dependent cases; never change validation to force completion.
