# Start here: testing your five modules

**30 October fresh manual run:** At the user's request, the isolated sandbox was backed up and cleared of academic/workflow records. All 31 original accounts, passwords, roles, duty profiles and Office Marks grants were restored. Start at A01: there should be no semester or active semester before you create one. Sign out and sign in again to refresh the portal. The [29 October A07 evidence](FULL_PORTAL_NATIVE_ACCEPTANCE_2026-10-29.md) is historical; its records are in the private backup, not the current sandbox. Record new manual results independently; the 162-case plan is not blanket Passed. Subsequent ordinary preparation/start commands still preserve your new records.

Use **http://127.0.0.1:3003**, the separate local test portal. Your normal development database is not the test fixture.

Open `backend/.env.five-module-uat/ACCOUNTS.md` for the **31 prepared accounts and passwords**. The account sheet is private and ignored by Git. Upload examples are in its neighbouring `inputs/` folder.

The [complete guide](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md) has **162 numbered test cases**, with actions and expected results. All manual cases start **Not run**. Preparing accounts and checking login does not mean the workflows passed.

## First run: follow this order

| Order | Sign in as | What you are testing | Finish with |
| --- | --- | --- | --- |
| 1 | Office | [A: Semester and lecturer capacity](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md#a-office-prepares-the-semester) | Active semester and one complete Published capacity policy. |
| 2 | Office | [B: Calendar, intake and proposal requirements](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md#b-office-prepares-calendar-intake-and-required-documents) | Both submission windows open and enforced; required proposal configured. |
| 3 | S01 → primary → coord-ai | [C: Supervisor application and approval](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md#c-student-applies-supervisor-accepts-coordinator-approves) | One active primary Supervisor and saved research profile. |
| 4 | primary → panel → coord-ai | [D: Panel nomination and approval](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md#d-supervisor-nominates-panel-selected-lecturer-accepts-coordinator-approves) | One distinct active Panel member. |
| 5 | Office | [E: Rubric and evaluation period](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md#e-office-prepares-and-publishes-the-evaluation) | Exactly two official S01 tasks at this checkpoint. |
| 6 | primary → panel | [F: Save drafts and submit marks](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md#f-lecturers-save-drafts-and-submit-marks) | Supervisor 85 and Panel 80 as separate locked submissions. |
| 7 | Office → panel | [G: Correction and reopening](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md#g-office-corrects-and-reopens-through-the-portal) | Recorded corrections/reopening/resubmission; no admin bypass. |
| 8 | All relevant roles | [H: Dashboard, reports, exports and progress](FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md#h-verify-dashboards-tracking-reports-exports-and-dossiers) | Matching records, usable saved workbook and correct privacy. |

Keep S01's first Supervisor result. Use the spare students for the remaining tests. Later AI appointments can add tasks to an open AI period; **two is the first-run checkpoint, not a permanent total**.

## Second run: alternative paths

| Chapters | Use | What to test |
| --- | --- | --- |
| I–J | S02 | Saved application draft, missing fields/files, cancellation, both rejection stages, resubmission and nomination history. |
| K | S03/S04 | Supporting members, role conflicts, primary/Panel replacement, old-draft snapshots and ended appointment access. |
| L | S10/S11/S16 and capacity lecturer | Last place, accepted primary reservation, competing earlier requests, automatic Capacity full outcome and availability. |
| M | S05 | Research-only approval, Office typo correction, sequential AI→DS transfer and retained work. |
| N | S16 and coord-cyber | Scheduled/current/revoked temporary AI cover and stale access. |
| O | S06 and separately named periods | Targeted tasks, backup, draft conflicts, common/personal deadlines and closed-period recovery. |

The complete guide says how to prepare each spare student's appointments. Their accounts alone do not include approved workflow records.

## Last run: cases that change eligibility or need technical help

- **P:** defer S07, withdraw S08, graduate S09, retire the dedicated lecturer using S13. These preserve history but can remove current editing rights.
- **Q:** semester closure, natural handover and carryover. Successful handover/reassessment needs an expired/Closed source and current Active target. Until that timing or separate fixture exists, record the relevant cases **Blocked**, not Failed or Passed.
- **R:** controlled failures, simultaneous decisions, exact date boundaries, reconciliation legacy records, saved-workbook formula safety, mobile/keyboard usability and session checks. Some require a separately prepared technical fixture; do not damage ordinary records to create one.

Use separate browser profiles for simultaneous users. Keep real throttles enabled. Record case ID, role, Student/request/task ID, expected/actual result and screenshot/download. Report failures as defects; leave dependent cases Blocked.

## Starting again

From the repository root, if the test servers are stopped:

```powershell
.\.venv\Scripts\python.exe scripts/prepare_five_module_uat.py --start
```

It refuses occupied ports rather than stopping another server. Logs and recorded process IDs are in `backend/.env.five-module-uat/`. Do not start your normal frontend against this test backend accidentally. If you need to stop UAT, identify the current listener on 3003/8003 and confirm it belongs to the recorded UAT process before stopping it; PIDs can be reused.

Running the preparation command again keeps existing accounts and results; it does not reset them. Review [the design and critique record](FIVE_MODULE_TEST_PLAN_REVIEW_2026-10-28.md) for why the guide uses this order and which older instructions it supersedes.
