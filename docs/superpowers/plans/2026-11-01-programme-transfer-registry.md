# Programme Transfer in Student Registry

Date: 2026-11-01. Owner: Xiang (Registry). Backend owner: Wey Cheng (`appointments`).

**Removed on 2026-11-03: the Registry side of this plan was taken out, because UM (Master's Degree) Regulations 2024, regulation 16 does not allow a change of programme. Phase 8 no longer applies.**

**Status: approved on 2026-11-01 with all seven recommended decisions. Phases 1 to 7 are built; phase 8 (the cutover) is Wey Cheng's next step.**

Source: Wey Cheng's handoff notes `PROGRAMME_TRANSFER_HANDOFF_2026-10-13.md` and `PROGRAMME_TRANSFER_REGISTRY_HANDOFF_2026-10-26.md` (in `Final Year Project/HandOver from Weycheng/`). A sample page of the screens comes with this plan.

## The problem

- A programme transfer changes a student's record, but it lives inside Supervisor Appointments, on the research profile page. Office staff would not look there.
- In Registry, changing the programme of a student who has a research profile is refused with "use a programme-transfer amendment", which does not say where that is.
- Nobody is told when a transfer waits for them; coordinators only find it by opening the right tab.
- When nobody coordinates the student's current programme, the first approval can never happen. In the dev data, the only two students with a research profile are in Master of Artificial Intelligence, which has no coordinator.

## 1. What it looks like

Four screens in Registry Management, in the portal's current look.

| # | Screen | Who | What it does |
|---|---|---|---|
| 1 | Student Record | Office (coordinators read only) | The Programme field gets a "Request programme transfer" button when the student has a research profile. A transfer in progress shows as one line with a link. For these students the programme is no longer edited in Edit Details, so the 409 error never appears. |
| 2 | Request programme transfer | Office | Current programme, "Move to" (programmes with no coordinator are greyed out), a required reason, what stays the same, and who approves. One button: Send for approval. |
| 3 | Programme transfers tab | Office and coordinators | A third Registry tab. Office: Pending and Past. Coordinator: Waiting for you (with a count) and Past. Columns: student, from and to, waiting for, days. |
| 4 | A transfer | Office and the coordinators involved | From and to, the reason, the steps with names and dates, and what stays with the student. Coordinator: Approve (with a required tick) or Reject (reason required). Office: Cancel request (reason required). |

**Design rules:**
- One main button per screen.
- Plain words: "Waiting for Dr X (current programme)", "Transferred on 3 Nov 2026".
- Errors say what to do, for example "Ali has a pending supervisor nomination. Resolve it in Supervisor Appointments first."
- No second scrollbar inside the page; works at phone width.

## 2. Decisions

Recommended answers first. Items 2 and 6 need Wey Cheng's agreement because they touch his code or data.

| # | Question | Recommendation |
|---|---|---|
| 1 | Where coordinators review transfers | The new Registry "Programme transfers" tab. His Supervisor Appointments tab stays until the cutover. |
| 2 | Nobody coordinates the student's current programme | **A: skip the first approval.** The request goes straight to the new programme's coordinator, and its history says why. Other options: **B:** every coordinator can give the first approval, like the File Management cover rule (more changes in his code). **C:** refuse the request until the office assigns a coordinator. |
| 3 | Programmes listed under "Move to" | His list of known programmes (unchanged). Programmes with no coordinator are shown greyed out with "No coordinator yet", because his API refuses them anyway. |
| 4 | Students without a research profile | Unchanged: the office edits the programme directly in Edit Details. |
| 5 | Programme field for students with a research profile | Locked, with a note and the "Request programme transfer" button beside it. |
| 6 | Notices (none today) | The coordinator who must decide next gets a notice. The student and the office user who started it get one when it is approved, rejected or cancelled. Built in Registry by listening to his transfer history, without editing his files. |
| 7 | Old screens | Stay until our side passes the checks. Then Wey Cheng removes the old entry points and points his links to the new page. Old saved links keep working. |

## 3. How it works

**Reused as is (Wey Cheng's backend):** the transfer API `/api/appointments/research-amendments/`.
- **Stored records:** the same transfer records and their history.
- **Approval order:** two coordinator stages. A coordinator who runs both programmes still decides twice.
- **Approve:** needs the tick that keeps the team, and is refused if the request changed meanwhile.
- **Cancel:** the office only.
- **Final approval:** updates the student and the research profile together.
- **Blockers:** another pending request or nomination blocks a transfer.

The frontend calls it through the existing `researchAmendmentsApi.ts`.

**New in Registry (Xiang):**
- **Student record:**
  - adds `userId` (the transfer API needs it, not the matric number);
  - opens from `/registry?student=<matric>`, so Back from a transfer returns to the same record.
- **`GET /api/registry/students/<matric>/transfer/`:**
  - whether the student has a research profile, and whether a transfer can be requested (and if not, why);
  - the transfer in progress;
  - each possible destination with its coordinator names, and who approves each step;
  - the supervisors, panel members and unfinished evaluation tasks that stay with the student.
  - It calls his `programme_options()`, `team_snapshot()` and `programme_coordinators()` without changing them.
- **Pages:**
  - `/registry/transfers` (the tab);
  - `/registry/transfers/new?student=<matric>` (the form);
  - `/registry/transfers/<id>` (a transfer).
  - New components `ProgrammeTransfers.tsx`, `ProgrammeTransferForm.tsx` and `ProgrammeTransferPage.tsx`, kept apart from his mixed research screen.
- **Notices (decision 6):** a listener on new transfer history entries.
- **At the cutover:** the Registry 409 message points to the new button.

**After a transfer:** File Management follows the new programme on its own. Checks and required documents move to the new programme's coordinator.

## 4. Wey Cheng's part

- Agree decisions 2 and 6. For 2A, the change is in his `submit()`, plus tests. He can make it, or I can with his OK.
- After our checks pass (the cutover):
  - remove "Request programme transfer" from the research profile page;
  - remove the coordinators' "Programme transfers" tab in Supervisor Appointments;
  - point his "Needs attention" and dossier links to `/registry/transfers/<id>`;
  - update his transfer browser journey tests.

## 5. Phases

| Phase | What | Who | Status | Commit |
|---|---|---|---|---|
| 1 | Registry backend: `userId`, the transfer summary endpoint, tests | Xiang | Done | registry commit |
| 2 | A transfer page: steps, what stays, Approve with the tick, Reject, Cancel | Xiang | Done | registry commit |
| 3 | Programme transfers tab: office Pending and Past, coordinator Waiting for you and Past | Xiang | Done | registry commit |
| 4 | Start from the Student Record: button, form, transfer-in-progress line, locked programme field, record opens from a link | Xiang | Done | registry commit |
| 5 | Notices (decision 6) | Xiang | Done | registry commit |
| 6 | No-coordinator rule in his submit step (decision 2) | Xiang, for Wey Cheng to review | Done | appointments commit |
| 7 | Checks and docs (README, PROJECT_STATUS, this plan) | Xiang | Done | registry commit |
| 8 | Cutover: old entry points removed, links moved, Registry message updated | Wey Cheng and Xiang | Not started | |

## 6. Checks

- **Backend tests:**
  - the new endpoint for office, coordinator, lecturer and student;
  - with and without a research profile, with a transfer in progress, and destinations with and without a coordinator;
  - notices;
  - his suites still pass (`test_research_amendments`, `test_amendment_concurrency`, `test_research_paging`, `accounts.test_registry_hardening`).
- **Frontend:** helper tests, the type check, the build and all test files.
- **In a browser, on a private copy with disposable test accounts** (never the demo accounts, never real records):
  - the office starts a transfer from the Student Record;
  - the current programme's coordinator approves with the tick;
  - the new programme's coordinator approves;
  - Registry shows the new programme and the team is kept.
  - Also check:
    - rejection at each step, and an office cancel;
    - blocked cases (pending nomination, no coordinator);
    - an old `/supervisor-appointments/research-changes/<id>` link still opens;
    - 390 px phone width, with no second scrollbar.

## 7. Notes

- `StudentRegistry.tsx` is large and Wey Cheng has also edited it. Changes stay inside the Student Record panel.
- `App.tsx` gets only the new routes.
- To show the whole flow on the dev data, decision 2 is needed, or a coordinator must be assigned to Master of Artificial Intelligence.
