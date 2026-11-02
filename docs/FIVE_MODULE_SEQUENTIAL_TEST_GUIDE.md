# Five-module testing guide: one semester, from setup to completion

**30 October fresh manual run:** At the user's request, the isolated sandbox was backed up and cleared of academic/workflow records. All 31 original accounts, passwords, roles, duty profiles and Office Marks grants were restored. Start at A01: there should be no semester or active semester before you create one. Sign out and sign in again to refresh the portal. The [29 October A07 evidence](FULL_PORTAL_NATIVE_ACCEPTANCE_2026-10-29.md) is historical; its records are in the private backup, not the current sandbox. Record new manual results independently; the 162-case plan is not blanket Passed. Subsequent ordinary preparation/start commands still preserve your new records.

Prepared 28 October 2026 for `codex/portal-consistency-and-toast`, HEAD `c062330`, including the pending working-tree acceptance fixes present when this guide was prepared. This is a new manual test plan, not a report that these tests have passed. The local sandbox records its preparation time and source fingerprint privately.

Your five modules are **Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks, and Workflow/Approval Tracking**. Semester capacity, document requirements, research changes, participant status and temporary coordinator cover are included because these workflows depend on them. Registry, general Files, Letters, FAQ and Announcements are teammate-owned; test their handoffs where needed, without treating their full acceptance as yours.

## 1. Start here

Use the separate local sandbox, not your usual development portal:

- **Portal:** http://127.0.0.1:3003
- **Backend health:** http://127.0.0.1:8003/api/health/
- **Private passwords:** `backend/.env.five-module-uat/ACCOUNTS.md`.
- **Sample files:** `backend/.env.five-module-uat/inputs/`.
- All names, addresses and academic content are fictional. All participants initially have Active status.
- Accounts are ready; **no semester, capacity plan, appointment, research profile, rubric, evaluation task or acting delegation is pre-created**. Office must prepare them below.

If the sandbox is not running, from the repository root:

```powershell
.\.venv\Scripts\python.exe scripts/prepare_five_module_uat.py --start
```

To check the initial accounts without changing them:

```powershell
.\.venv\Scripts\python.exe scripts/prepare_five_module_uat.py --check
```

The check will report differences after you intentionally change passwords, retire a lecturer, or disable an account. That is expected: it checks the starting fixture. Running the preparation command again preserves the existing sandbox; it never resets your results. A fresh machine needs configured local PostgreSQL, installed backend/frontend dependencies, and the preparation command without flags first. Connection credentials are read from ignored `backend/.env`; the helper changes neither that file nor the development database.

Use separate browser profiles/browsers for simultaneous actors. Tabs in one profile share login cookies. Sign out before changing roles in one browser. UAT uses its own refresh-cookie name and local files, but separate profiles also prevent normal portal session interference. Do not enable demo prefills: use the UAT account sheet.

Every test below starts **Not run**. For each ID, record **Pass / Fail / Blocked**, what you saw, the record ID, and screenshot/download evidence. Mark Pass only after the expected result is observed. If a prerequisite fails, mark dependent cases Blocked and record that case ID; do not edit the database to force the main journey forward.

## 2. Which account to use

All portal logins follow `uat.<key>@example.test`. The private account sheet contains a distinct generated password for each. These are new accounts, not your existing demo accounts.

| Key | Role / use |
| --- | --- |
| `office` | Office with the explicit submitted-Marks correction permission. No Django admin access. |
| `office-view` | Office without that permission; otherwise normal Office business access. |
| `coord-ai` | Coordinator for Artificial Intelligence (AI). |
| `coord-ds` | Coordinator for Data Science (DS). |
| `coord-cyber` | Coordinator for Cyber Security; unrelated actor and temporary-cover candidate. |
| `primary` | Main primary Supervisor; also eligible for Panel duties for other students. |
| `replacement` | New primary Supervisor / backup evaluator. |
| `support`, `support-new` | Supporting Supervisor and replacement supporting Supervisor. Both also have Panel duties. |
| `panel`, `panel-new` | Current/new Panel lecturer; Panel duties only. |
| `outsider` | Unrelated lecturer; both duties, but no initial student relationship. |
| `capacity` | Dedicated one-place Supervisor for capacity tests. No Panel duties. |
| `retire` | Dedicated lecturer for retirement and responsibility-resolution tests. Both duties. |
| `technical` | Technical Administrator, Django Admin only. Its account-sheet ID is a label, not a portal alternative login. |

There are **31 accounts: 2 Office, 3 Coordinators, 9 Lecturers, 16 Students and 1 Technical Administrator**. The following students keep incompatible cases apart:

| Student ID / key | Programme | Use |
| --- | --- | --- |
| `UAT-S01` / `student-main` | AI | Main journey; keep this student Active and keep the first submitted marks. |
| `UAT-S02` / `student-reject` | AI | Drafts, cancellation, rejection and resubmission. |
| `UAT-S03` / `student-replace` | AI | Primary/Panel replacement and direct closure. |
| `UAT-S04` / `student-support` | AI | Two supporting positions, replacement and access history. |
| `UAT-S05` / `student-research` | AI | Research changes, Office correction and programme transfer. |
| `UAT-S06` / `student-window` | AI | Closed-period draft recovery and personal extra time. |
| `UAT-S07` / `student-defer` | AI | Deferral and return. |
| `UAT-S08` / `student-withdraw` | AI | Withdrawal; never use as the main student. |
| `UAT-S09` / `student-graduate` | AI | Graduation blockers and completion. |
| `UAT-S10` / `student-capacity-a` | AI | First request for the one-place Supervisor. |
| `UAT-S11` / `student-capacity-b` | AI | Competing request submitted before that place fills. |
| `UAT-S12` / `student-carryover` | AI | Original-semester pending requests and reassessment. |
| `UAT-S13` / `student-retire` | AI | Dedicated retiring lecturer's responsibilities. |
| `UAT-S14` / `student-foreign` | DS | Different-programme scope/privacy and DS approvals. |
| `UAT-S15` / `student-unrelated` | Cyber Security | Another student's direct-URL and third-programme tests. |
| `UAT-S16` / `student-capacity-c` | AI | Extra last-place/supporting-capacity competition. |

In programme selectors use the full labels: **MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)**, **MASTER OF DATA SCIENCE (COURSEWORK)** and **MASTER OF CYBER SECURITY (COURSEWORK)**.

## 3. Working order and shared test values

1. Run **A–H in order**, using only S01 for successful appointments. At the first Marks checkpoint, exactly two official tasks are expected.
2. Take the core report/export evidence in H before preparing the extra students.
3. Run the side journeys **I–N** using their named students. To prepare a branch student, repeat the complete Supervisor and Panel steps C/D, changing only that student's account/title and the named lecturer. If a branch needs only primary supervision, stop after C. This is real workflow setup, not a pre-approved fixture.
4. Run **O–Q last**. These close periods, end appointments or change participant/semester status. They can legitimately make earlier edit screens unavailable.
5. Repeat essential interactions at desktop and **390-pixel content viewport** width in the real login/sidebar application. Resizing an outer window is not proof of the content viewport width.

Use prefix **UAT-20261028** in names/reasons. Record the created IDs next to their test IDs. Use Malaysia time (UTC+08:00).

- Semester: session **2026/2027**, Semester I; start **21 October 2026**, end **26 January 2027** for this run. If testing later, select nonoverlapping dates containing the actual test day. Never alter the computer clock.
- Supervisor/Panel windows: open before the current Malaysia time and close at least seven days after it, within semester dates.
- Main evaluation: `UAT-20261028 Main`, AI only, both official evaluator roles; opens before now, closes seven days later within semester dates.
- Rubric: target **100**, required components **Problem definition 40**, **Methodology 60**. Codes and display positions must be distinct.
- Main primary submission: **35/40 + 50/60 = 85/100**. Main Panel submission: **30/40 + 50/60 = 80/100**. These are two independent results; do not invent a combined final grade or classification.
- Main research: title `UAT-20261028 S01 — Comparing synthetic workflow reminders`; area `Software Engineering`; abstract: `This fictional project compares two reminder approaches using synthetic postgraduate workflow records. It measures the number of completed steps, time spent waiting and missed actions without using real personal or academic data. The findings are for software testing only.`

For each Supervisor application, use **Student-proposed title**, **No completed courses to declare**, the valid `research-proposal.pdf`, and accept the declaration at final review. Enter one required project course code. Title origin does not change which configured documents are required. If testing course rows, fill course name, course code, semester/session and grade together.

The Research intent step requires **all nine answers**, not just the abstract. Use these fictional answers and adjust the student number in the title:

| Field | Sample answer |
| --- | --- |
| Introduction | This test project examines reminders in a fictional postgraduate workflow using synthetic records. |
| Statement of aim | Compare two reminder approaches and identify which helps users complete the intended steps. |
| Significance | The comparison helps explain where an administrative workflow needs clearer guidance. |
| Research questions | Which reminder approach results in fewer missed actions in the synthetic workflow? |
| Research objectives | Build two reminder examples, run the same synthetic cases, and compare completion and waiting time. |
| Methodology | Use synthetic cases, apply both approaches, record results, and compare the measurements. |
| Expected outcomes | A reproducible comparison and a small set of findings based only on synthetic records. |
| Skills needed | Web development, database queries, software testing, and basic analysis. |
| Timeline | Prepare cases in week one, run comparisons in week two, and review the findings in week three. |

## A. Office prepares the semester

Use `office`. Checkpoints in this chapter must succeed before a student applies.

| ID | What to do | What should happen |
| --- | --- | --- |
| A01 | Sign in; open Dashboard, then Academic Semesters (`/dashboard/semesters`). | Correct Office identity; no active semester initially. Empty configuration is explained, not a fabricated active semester. |
| A02 | New semester → enter the shared session/term/dates → Create draft. | One Draft semester. Creating it does not activate it. Record its ID/code. |
| A03 | Try an invalid session, reversed dates, duplicate session/term and overlapping nonarchived semester in separate cancelled attempts. | Useful validation; no extra saved semester from a failed attempt. |
| A04 | Review activation before configuring capacity. | Activation is blocked with a clear route to lecturer capacity; no partial activation. |
| A05 | Open Lecturer Capacity; select this Draft; create a new Draft plan. | Blank plan belongs to this exact semester. It is not a previous-semester copy. |
| A06 | Fill every eligible lecturer row: Supervisor **20**, Panel **20** for each duty held, except `capacity` has Supervisor **1**. Panel-only lecturers have only Panel **20**. | All nine eligible lecturers covered. No missing required limits; no invented Supervisor duty for Panel-only actors. These are synthetic test limits, not faculty policy. |
| A07 | Try negative/missing limits. Save valid limits; review and publish with reason and confirmation. | Invalid values reject. One Published plan; audit names Office and reason. Draft edits alone never govern assignments. |
| A08 | Reopen Published plan; compare/clone it without publishing the clone. | Published version cannot be edited. Clone is a separate Draft; the original remains authoritative. Leave the clone unpublished. |
| A09 | Return to the semester; Review activation → reason → Activate semester. | Semester becomes effectively Active because today is inside its dates and capacity is complete. All role dashboards use this same semester. |
| A10 | Sign in as Student, Lecturer and Coordinator and paste the semester/capacity management URLs. | They cannot perform Office configuration by guessing URLs. A lecturer's permitted personal availability workspace remains separate. |

**Checkpoint:** one effectively Active semester, one complete Published capacity policy, no appointment or evaluation records.

## B. Office prepares calendar, intake and required documents

Use Calendar (`/dashboard/timeline`) and Periods & deadlines (`/dashboard/periods`). The calendar communicates dates. Published submission windows govern intake only after date restrictions are separately enabled.

| ID | What to do | What should happen |
| --- | --- | --- |
| B01 | Calendar → Add events → Create one event. Add a Student/Lecturer event, a Lecturer-only event, and an Office-only event with distinct names. | Correct selected semester and audiences; entries persist after reload. |
| B02 | Edit the public event's description; inspect Entries, Calendar and History. | Same record updated once; actor/time/history match. An event ending is a date state, not proof of student completion. |
| B03 | Start an event; switch between Create one event and Import from Excel; try closing with unsaved work. | Input is retained when switching; closing requires Keep editing/Discard changes. Cancel does not create an event. |
| B04 | Download the current template; fill a harmless two-row schedule; Preview import only. | Selected semester, dates, audiences and replacement warning are readable; preview changes no entries. |
| B05 | Confirm the reviewed import. | It replaces that semester's calendar, not appends to it. Re-create the three audience events if the two-row file replaced them. Record before/after counts. |
| B06 | Try non-XLSX, oversized, missing headers, bad date/audience and out-of-semester imports. | Each failure leaves the existing calendar intact and supports retry. Do not confirm an unreviewed replacement. |
| B07 | Periods & deadlines → add Supervisor submission window, AI/DS/Cyber scope, dates open now; create Draft, review and publish. Repeat for Panel recommendations. | Two separate Published windows. Draft publication/history and cohort are correct. |
| B08 | Review date-restriction state, coverage and enablement; give reason and confirm restrictions for both activities. | Restrictions are explicitly enabled with complete intended coverage. Publication alone did not enable them. |
| B09 | Link a current unowned calendar event to a window; inspect linked dates. Try editing the linked event as an independent event. | Period owns the dates; Manage period is offered. Linking cannot claim another semester's or already-owned event. |
| B10 | Try reversed/out-of-semester dates, empty Selected programmes, and overlapping published coverage for the same activity/cohort. | Clear blockers; no partial extra window/link. A stale save requires reloading. |
| B11 | Supervisor Appointments → Tools → Document requirements. Create an active, required document labelled **Research Proposal**. | It receives code `research-proposal`. Its configured Required setting applies to both Student- and Supervisor-proposed titles; no special proposal mapping is needed. No more than five requirements are active. |
| B12 | Log in as S01, primary, coord-ai and office; compare dashboards/calendar. | Student sees intended public entries, Lecturer sees their entries, Office sees Office-only entries. Restricted users have no calendar mutation controls. |

**Checkpoint:** open enforced Supervisor and Panel intake for the tested programmes, configured proposal requirement, correct shared calendar/audience.

## C. Student applies; Supervisor accepts; Coordinator approves

Only `student-main`, `primary`, `coord-ai` and `office` are needed. Keep this first run successful; negative decisions come later with S02.

| ID | What to do | What should happen |
| --- | --- | --- |
| C01 | S01 → Supervisor Appointments → Applications → new application. Complete Your details and Research intent using the shared values. | Identity is the signed-in student's; all nine intent answers are required. Next step is reachable with valid inputs. |
| C02 | Select `primary`; attach valid proposal; review exact student, title, Supervisor and declaration → Submit application. | One submitted request appears for S01 and `primary`. No active appointment or reserved primary place yet. |
| C03 | S01 refreshes, signs out/in and opens the request. Try submitting another ordinary application. | Original persists; duplicate pending application is blocked without duplicate record. |
| C04 | `primary` → Appointment requests → Review request. Read the full intent, declared courses and proposal; download and open the actual saved PDF. | Exact student's content and readable file. Download success means a saved usable file, not merely a toast. |
| C05 | `primary` → Accept request; review and confirm. | Awaiting Coordinator; **active 0, reserved 1** for this lecturer at this point. No active appointment yet. S01 is not invited to cancel after lecturer action. |
| C06 | `coord-ai` → Appointment requests → exact request → Approve request. | One active primary appointment and matching research profile. Reservation converts to active: **active 1, reserved 0**. No double count. |
| C07 | S01 → My supervisors; primary → My supervisees; Coordinator/Office → Supervisory teams. | Same active primary/contact/research; S01 retains My supervisors / Applications / Research changes tabs. |
| C08 | S01 → View approved application; Office opens the approved request from its request list. | Exact source application opens. Request page remains a request; approval timeline shown once. No fabricated duplicate audit panel. |
| C09 | Open appointment details and expand Manage appointment / Appointment changes where available. | Occasional management is collapsed initially; read-only users have no management controls. No duplicate initial ACTIVATED change. |
| C10 | `outsider`, `coord-ds`, S15 try the exact private request/file URL. | No foreign content, download or decision access. Missing buttons alone are not sufficient evidence. |

**Checkpoint:** S01 has exactly one active primary; proposal/research saved; no Panel yet; no official Marks tasks yet.

## D. Supervisor nominates Panel; selected lecturer accepts; Coordinator approves

| ID | What to do | What should happen |
| --- | --- | --- |
| D01 | `primary` → Panel Appointments → My supervisees → S01 View student. | Independent Student Panel details with Back to My supervisees, research and nomination action. |
| D02 | Open Recommend Panel; select a candidate with keyboard and pointer; exercise Enter selection while the form is still open. | Enter selects the candidate without accidentally submitting the whole nomination. |
| D03 | Finish selecting `panel`, enter Recommendation notes → Submit to Panel. | One nomination; Panel place is reserved at submission. No active Panel appointment yet. |
| D04 | S01 opens Panel overview while pending. | Generic Faculty processing; no pending identity, staff ID, notes, decision reasons, internal stage or raw audit. |
| D05 | `panel` → Appointment requests → Accept request → confirm Accept nomination. | Awaiting Coordinator; still no confirmed Student-facing Panel appointment. |
| D06 | `coord-ai` approves the exact nomination. | One active Panel assignment to `panel`; reservation becomes active without double count. |
| D07 | S01 views confirmed Panel; panel → My Panel students → assignment detail; Office/Coordinator → Panel assignments. | Correct public member/contact/date. Before E there are no Marks tasks, so no invented marking action. No Student View approved nomination button; its removal is intentional. |
| D08 | `primary` opens Nomination records and S01 completed nomination history. | Separate Requests/History; completed student history collapsed below content, paginated when enough records exist; each row opens its own request. |
| D09 | Try primary/supporting-as-Panel, a duplicate current nomination and wrong-lecturer acceptance. | Conflict/role checks reject; no second active assignment or capacity leak. |

**Checkpoint:** S01 has one active primary and one distinct active Panel, with two separate approval histories.

## E. Office prepares and publishes the evaluation

Run this before preparing other students' appointments. An open Published period may generate tasks during normal service reads; do not assume only a manual click can generate them.

| ID | What to do | What should happen |
| --- | --- | --- |
| E01 | Marks Entry → Rubric Version Management → Create family. Add the required 40/60 components. | Target 100, component total 100, ready/balanced rubric. |
| E02 | Try negative maxima, duplicate code/order and total 90 before restoring 100. | Validation/readiness explains the problem; an unready rubric cannot publish a period. |
| E03 | Mark Entry Periods → New period; use the named Active semester, ready rubric, AI only, Supervisor + Panel, and shared open/close times → Create draft. | Draft persists with exact role/programme scope. |
| E04 | Save and open Recipient preview. Inspect S01 and missing-appointment counts for other AI students. | Exactly **S01/primary/Supervisor** and **S01/panel/Panel** are eligible pairs. Unsupplied students are not silently assigned. Preview itself creates nothing. |
| E05 | Review → Confirm and publish. | Correct period Published and currently open. Its rubric/identity/targeting become locked. |
| E06 | Evaluation Task Assignment → select this period → Generate missing tasks. Repeat. | Exactly two official tasks total for this checkpoint; repeat creates no duplicates or new mark values. Automatic generation may already have created the same two. |
| E07 | Inspect Office task lists and both lecturers' tasks. | Correct student, evaluator, role, period, rubric version and deadline everywhere. Student/Coordinator have no evaluator editor. |
| E08 | Clone the locked rubric to a new version, without changing the original. | New editable version; the Published period and its tasks retain the original. |

## F. Lecturers save drafts and submit marks

| ID | What to do | What should happen |
| --- | --- | --- |
| F01 | `primary` → Marks Entry → My supervisees → S01 task. Enter 35 and 50; Save draft; leave and reopen. | Stored values and total **85** restore with exact student/role/period. |
| F02 | Try negative, over-maximum, missing required and unsupported-precision scores. Restore valid values. | Server rejects invalid submission; valid persisted draft survives. No locked result is created by failure. |
| F03 | Open matching supervision detail → Enter marks/Continue marking; return to all tasks. | Context opens exact S01 Supervisor task; Show all tasks exits that scope. No unrelated task fallback. |
| F04 | Submit marks → review student/role/scores → cancel once; reopen and confirm Submit and lock marks. | Cancel keeps draft. Confirm produces one Submitted/read-only result, total 85. |
| F05 | `panel` uses My panel students or Panel detail marking action; save then submit 30 and 50. | Independent Panel result **80**. It never overwrites the Supervisor result. |
| F06 | Reload both submitted records; try editor deep links and repeat submission. | Submitted values stay locked. One recorded submission per completed task; no ordinary edit bypass. |
| F07 | View submission history; filter semester/date and open each submission. | Correct immutable evaluator/student/period/rubric details; Malaysia dates; bad date range explained. |
| F08 | `outsider`, S01 and Coordinator try exact task/editor URLs. | No unauthorised score access or mutation. The supporting role alone will not grant the primary task. |
| F09 | Office filters the Main period in Mark Entry Records. | Exactly **2/2 submitted, 0 unfinished** at this checkpoint, with 85 and 80 as separate records. |

## G. Office corrects and reopens through the portal

Use the S01 **Panel** result for change tests and retain the first Supervisor submission unchanged. Record its initial85/80 evidence first.

| ID | What to do | What should happen |
| --- | --- | --- |
| G01 | `office-view` opens both submitted records and direct correction/reopen targets. | May inspect normal Office records; cannot correct/reopen without explicit permission, even through a forged request. |
| G02 | `office` → Panel result → Correct submitted marks; try blank reason, invalid score, no-op and Cancel. | No mutation/audit from invalid or cancelled work; clear validation. |
| G03 | Change Panel score30→32, keep50; reason `UAT correction` → Review correction → Save correction. | Total82, still Submitted. History shows30→32,80→82, actual Office, reason/time; original submission evidence retained. |
| G04 | Open two Office tabs before another correction. Save in one; attempt stale save in the other. | Stale save rejects; no silent overwrite or extra correction audit. Explicitly load/review the latest record. |
| G05 | While Main is open, Reopen for Lecturer → reason → review → confirm. | Panel result becomes Draft with retained scores; original submission metadata is handled by the recorded reopening, not an unaudited erase. |
| G06 | `panel` reloads, changes to 34 + 50 and resubmits. | New Submitted total 84; correction/reopening/resubmission history remains understandable. |
| G07 | `technical` tries portal login; Office tries Django Admin. Technical inspects governed Marks in Admin. | Technical portal login rejects; Office Admin access rejects. Governed Marks cannot be altered through Django Admin. |

## H. Verify dashboards, tracking, reports, exports and dossiers

Record current counts after G; if G04 deliberately made another valid correction, use its actual latest audit before G05/G06. Main primary remains85; Panel ends84 if G06 was followed exactly.

| ID | What to do | What should happen |
| --- | --- | --- |
| H01 | Compare Dashboard actions with each role's request and Marks queues throughout C–G. | Responsibility moves to the next actor; completed actions disappear; counts match real records. Elapsed approval waiting is not an invented overdue/SLA breach. |
| H02 | Office Workflow reports: selected semester, AI, date filters; clear them. | Counts and rows follow current scope. Clear filters restores the documented active-semester defaults. Invalid date range disables export. |
| H03 | Follow attention/report links and Back. | Exact record/student opens; named monitoring scope and return filters preserved; Clear scope can leave that narrowed view. |
| H04 | Download XLSX, save it to disk, open it in Excel/compatible reader. | Usable workbook, correct filters/time/role, expected row IDs/status/totals. Compare full rows, not just summary headings. Keep file as evidence. |
| H05 | Repeat reports/export as coord-ai, coord-ds, primary and outsider. | Programme/relationship scope enforced. Coordinator workbook has no Marks sheet. Lecturer sees only authorised own evaluation rows. Foreign scope is not exposed by URL parameters. |
| H06 | Open S01 progress dossier as Office, coord-ai, primary, Panel and S01. | Appropriate public/internal sections; Coordinator and Student have no Marks. Lecturers see only permitted own marking. S01 sees confirmed team and own public information. |
| H07 | S15/outsider/coord-ds open S01 dossier URL. Open S15's own empty dossier. | Foreign reads unavailable; own no-profile case handled without borrowing S01's details. |
| H08 | Office quickly switches between S01 and another student while using slow network; repeat with an earlier failed request. | Old student's success/error does not replace the new selection or dismiss its loading state. Previous private content is hidden during the switch. |
| H09 | Reconciliation → Recheck records; inspect summaries/filters and any issue previews, without applying a repair. | Reads/preview change nothing. Healthy records need no invented repair; no issue is not a failure. |
| H10 | Check exact source request timeline, lifecycle history, actors, reasons and timestamps. | Each action recorded once under the actual actor. Distinct requests remain distinct even when their visible names/dates match. |

**Core journey complete only when A–H have observed results.** The remaining chapters extend coverage; they are not implied to pass by this checkpoint.

## I. Supervisor drafts, validation, cancellation and rejection

Use S02. Its successful final approval can then serve as another late-eligibility task-generation test. Before testing duplicate file content, Office adds an active optional **UAT Extra** document requirement; attach the same valid PDF for that and Research Proposal, then deactivate UAT Extra with a reason after the failed attempt. This supplies two legitimate upload slots, so the test reaches duplicate-content validation rather than failing on an unknown requirement.

| ID | What to do | What should happen |
| --- | --- | --- |
| I01 | Begin application, fill several steps, Save draft; leave/relogin/resume. | Writing/step progress returns; reselect file and reconfirm declaration as required. No submitted request/appointment/capacity reservation yet. |
| I02 | Omit each required intent answer, title/area/abstract, title origin, course declaration and final declaration in turn. | Clear relevant validation; no unintended final submission. Optional project codes remain optional. |
| I03 | Use empty/renamed PDF, unsupported TXT, oversized file, duplicate content and missing proposal. On a separate attempt before I04, also try a genuine DOCX proposal and cancel that request before lecturer action. Prepare that DOCX with synthetic text in Word if needed; the supplied valid sample is PDF. | Bad files reject without partial acceptance; genuine PDF and DOCX can submit through the full form. Maximum five files and 10 MB combined. Record each format/limit subcase separately. |
| I04 | Submit validly to primary; S02 cancels before lecturer decision with a reason, then resubmits. | Cancelled record/history retained; fresh request has its own ID; no reserved place leaked. |
| I05 | Primary rejects with reason; S02 reads reason and submits again. | No active appointment; original rejection preserved; another attempt allowed when eligible. |
| I06 | Primary accepts; coord-ai rejects with reason. | Reservation released; no active appointment/research handoff. Student sees correct outcome. |
| I07 | Resubmit → accept → approve; generate/read Main tasks. | S02 becomes active and gets only its missing Supervisor task; no Panel task until a Panel is approved. S01's existing marks remain untouched. |
| I08 | Retry a completed decision and a double-click decision. | Only one transition/appointment/audit; stale page offers review/reload. No false success. |

## J. Panel alternative decisions and history

Use S02 after I07. Run each failed attempt before the final successful one.

| ID | What to do | What should happen |
| --- | --- | --- |
| J01 | Primary nominates panel; primary cancels before Panel action with reason. | Terminal nomination remains in history; pending reserved Panel place releases. |
| J02 | Nominate again; panel rejects with reason. | No appointment; reason/history correct; new nomination allowed. |
| J03 | Nominate again; panel accepts; coord-ai rejects with reason. | No appointment; reserved place releases; selected Panel acceptance is not final appointment. |
| J04 | Nominate again → accept. Open the pending Coordinator decision in two tabs before approval; approve in the first. Inspect roster, current assignment and all completed nomination rows. | One active member; four distinct attempt records; newest first. Former requests open their own records. Keep the second tab for J05. |
| J05 | In the second Coordinator tab opened during J04, attempt the now-stale decision. For cancellation/rejection variants, likewise open a second view before J01/J02's terminal action and collect that evidence then. | Server rejects stale decision and leaves terminal history/active appointment unchanged. Do not create an ordinary new nomination after J04's confirmed assignment. |
| J06 | Reuse no-task evidence from D07 and one-task evidence from F03. For multiple tasks, Office creates/publishes a second separately named open AI Panel-only period with the ready rubric; inspect S02 Panel detail after generation. | Multiple matching tasks offer a filtered choice of the correct student/role. Office/Coordinator do not request personal Lecturer tasks. Do not expect a no-task state after Main has generated S02 tasks. |

## K. Supporting supervisors and primary/Panel replacement

Prepare S04 through C/D with primary and panel. Prepare S03 through C/D, then save an unfinished old-Supervisor draft and an unfinished old-Panel draft **before K07**. Record their task IDs/values and the current team. Leave these drafts unsubmitted for the retirement checks. Main S01 is not consumed.

| ID | What to do | What should happen |
| --- | --- | --- |
| K01 | Primary → S04 supervision → Supporting supervisors → Nominate co-supervisor: support, justification. Candidate accepts; coord-ai approves. | One supporting appointment. Acceptance alone reserves no supervision place; final approval checks current capacity. No extra ordinary Marks task. |
| K02 | Nominate support-new into second position; test candidate rejection, primary cancellation and Coordinator rejection on separate attempts; then approve. | Reasons/history retained; pending positions release; two active supporting positions maximum. |
| K03 | Try third supporting position, duplicate candidate, current primary/Panel conflict, and nomination by Student or supporting-only member. | Rejected without role overlap, over-allocation or extra position. |
| K04 | Supporting-only actor reads allowed team/research, then tries private primary proposal, internal dossier and primary Marks URL. | Restricted public/current team access only; no private file, primary task or internal decision access. |
| K05 | Replace one S04 supporting member with outsider. On separate attempts reject/cancel once, then nominate/accept/approve successfully. | Incumbent stays active/public until final approval. Rejection/cancellation preserves incumbent. Approval changes one position and keeps history. |
| K06 | Office ends an S04 supporting appointment with permitted outcome and required reason. Check former member. | Capacity releases; former member loses current access/controls, retains own ended appointment history. Other team members unchanged. |
| K07 | For S03, Office opens approved primary request → Appointment record → Manage appointment → Request supervisor change. Choose replacement and reason. | Office initiates; Student cannot initiate/cancel this Office replacement. Incumbent stays active during review. Cancel form returns to the exact source request. |
| K08 | Proposed replacement accepts; coord-ai approves; compare research/team/Marks before and after. | One new active primary; old primary ends atomically. Active supporting/Panel remain. Outgoing primary's unfinished nominations/research requests resolve according to handover rules; submitted Marks retain old evaluator. |
| K09 | S03 current primary → Panel details → Replace Panel: panel-new, notes/replacement reason → accept → approve. | Incumbent Panel survives until final approval. One new active Panel after approval; history/capacity correct. |
| K10 | Inspect the S03 old drafts recorded before K07, after primary/Panel replacement and task generation. | Old tasks retire with their exact draft snapshots; new official evaluators get clean tasks, not copied scores. Previously submitted work on separate retained cases remains submitted under original actor. |
| K11 | Open another replacement while one is pending or after appointment ended; replay final approval from old tab. | Duplicate/stale/ineligible initiation rejects; no second replacement or damage to incumbent/history. |
| K12 | End S03 active primary/Panel through Office or scoped Coordinator with reason. | Unfinished corresponding tasks retire; active workload releases; ended appointment/Marks history survives. Repeat closure does not duplicate changes. |

## L. Capacity reservations and lecturer availability

Use capacity lecturer and S10/S11/S16; do not use these students for unrelated work first. Supervisor limit must still be1 in the Published plan.

| ID | What to do | What should happen |
| --- | --- | --- |
| L01 | S10 and S11 both submit valid primary applications to capacity **before either is accepted**. | Two submitted requests, active0/reserved0/available1. Submitting does not reserve a primary place. |
| L02 | Capacity accepts S10, reviewing the Last available place warning. | Active0/reserved1/available0. Warning explains reservation until Coordinator decision and possible closure of other requests after final approval. |
| L03 | Try accepting S11 while S10 reserved the last place. | Blocked; Reject and eligible Student cancellation remain usable. No reservation/task/appointment leak. |
| L04 | Coordinator rejects S10 once; verify release; S10 submits again and capacity accepts. | Reservation releases on rejection; new accepted attempt can reserve it. Keep S11 submitted. |
| L05 | Coordinator approves S10. | Active1/reserved0/available0. S11 automatically becomes **Capacity full**, with neutral system reason/time/audit and notice; it is not shown as a human rejection. |
| L06 | S11 reads outcome and applies to another available eligible Supervisor. | Ordinary new-application recovery works; history remains. A full candidate cannot receive a new request merely to reproduce automatic closure. |
| L07 | While commitment exists, try publishing a clone with capacity limit0. Cancel the unsuccessful change. | Publication cannot erase active/accepted commitments. Current valid plan stays authoritative. |
| L08 | Use a separate eligible lecturer's My availability to create current/future unavailability with a reason; inspect candidates and workloads. | Effective availability is respected at the correct dates; restore/revoke the test window afterward so later cases can proceed. Date controls work with keyboard and pointer. |
| L09 | Coordinator opens a candidate request; eligibility changes before final approval (unavailability, capacity or lifecycle) on dedicated records. | Final decision rechecks current rules. Failed approval preserves pending request, incumbent and all marks. |
| L10 | Technical-assisted competition: accepted primary reservation versus supporting final approval for that same last place; two simultaneous acceptance/approval attempts. | Supporting approval cannot steal reserved primary capacity. One valid winner; losing transaction leaves no partial audit/appointment. See assisted prerequisites in R. |

## M. Research changes, audited correction and programme transfer

Prepare S05 with primary, supporting member and Panel; save one primary submitted result and one Panel draft before transfer. Record task IDs, scores, profile revision and appointments first.

| ID | What to do | What should happen |
| --- | --- | --- |
| M01 | S05 → Research changes → Request research change; enter title/abstract and reason, preview, submit. | Current profile stays unchanged while pending; one pending request allowed. Research area/Research Intent expansion is not an implemented amendment requirement. |
| M02 | Cancel before decision, submit/reject, then submit/approve through current primary. | Separate reasons/history; rejection/cancel preserve current profile. **Primary Supervisor final approval** saves new revision; no Coordinator stage for research-only change. |
| M03 | Primary approves from a stale tab after profile/current-primary change. | Reject stale evidence; no revision overwrite or partial approval. |
| M04 | Office → Supervisor Tools → Research records → exact profile → Typographical correction; reason and meaning-unchanged attestation. | Audited typo correction only; no silent research or programme rewrite. Original application remains historical. |
| M05 | Clear pending nominations/amendments, then Office starts Programme transfer AI→DS in the existing research workspace. | Source/destination and reason clear; transfer pending, authoritative programme still AI. Registry relocation is not required for this branch. |
| M06 | coord-ds tries destination approval first; coord-cyber tries unrelated access; submit another nomination while transfer pending. | Stage/scope/conflict checks reject. Pending team nominations likewise block starting transfer. |
| M07 | coord-ai acknowledges team/tasks and approves source stage; coord-ds separately acknowledges and approves destination stage. | Only final destination approval changes Student/profile programme to DS. Two explicit decisions, even if temporary cover makes one actor cover both. |
| M08 | Compare recorded before/after team, tasks, drafts, submitted scores, completion windows, workload and revisions. | Same required appointments/task IDs and saved work; no invented capacity allocation. New programme governs future authority/targeting. Original source decisions/history preserved. |
| M09 | Check dossiers/reports/exports as both Coordinators and former primary relationship actors. | Current scope follows saved programme; source Coordinator retains only authorised exact historical evidence, no current decision controls. Coordinator still gets no Marks. |

## N. Temporary coordinator cover and scope

Use coord-cyber to cover AI; keep coord-ai as permanent AI Coordinator. Use S14/S15 for clearly foreign data. Prepare S16's ordinary application to primary through Lecturer acceptance, then **stop before Coordinator approval** to supply the pending AI decision for N03/N04. If S16 was consumed by an assisted capacity variant, use a fresh isolated variant instead. These tests must not silently grant every programme to one actor at setup.

| ID | What to do | What should happen |
| --- | --- | --- |
| N01 | Office → Manage Participants → Acting coordinator delegations → Grant acting access; AI, coord-cyber, today through a future date, justification. | Reasoned grant; regular Cyber authority retained; AI added only while effective. Permanent AI Coordinator remains authorised. |
| N02 | Try self-regular programme, invalid range and overlapping AI cover for either the same or another recipient. Test an inactive candidate with a separate assisted fixture, since all initial candidates are Active. | Appropriate rejection; no overlapping acting cover for the programme. |
| N03 | Re-login/focus coord-cyber; open S16's pending AI request **without deciding yet**; inspect reports/dossier/XLSX and a DS foreign URL. | AI work available, DS excluded; no Office-only reconciliation/configuration and no Coordinator Marks exposure. |
| N04 | Keep an AI decision open; Office revokes with reason; act from the stale page and return focus. | Stale write rejects; queue/current access refreshes away; previous committed decisions/history retained. |
| N05 | Create future-start cover; verify it grants nothing today. Scheduled/inclusive-end/expiry tests use controlled dates as described in R. | Future cover read-only as scheduled; no early authority. Inclusive last day grants access; following day removes it when separately tested. |
| N06 | First revoke N05's scheduled AI grant with reason, so it cannot overlap. Regrant currently effective AI cover; acting coord-cyber approves S16; revoke cover and inspect history. | Actual acting Coordinator remains recorded; permanent coord-ai still has regular authority. Revoking cover does not undo the completed appointment or its evidence. |

## O. Evaluation targeting, backup, deadlines and personal recovery

Prepare S06 through C/D. Create separately named periods for each branch so closing one does not block Main. Never expect a shared AI period's task count to stay2 after more AI appointments exist.

| ID | What to do | What should happen |
| --- | --- | --- |
| O01 | Draft Supervisor-only, Panel-only and Selected-programme periods; inspect preview before publishing selected cases. | Exact matching role/student pairs; empty roles/programmes and invalid dates reject. Student's authoritative current programme governs, not obsolete profile text/intake semester. |
| O02 | Assign backup evaluator replacement for S06 with period, Student, original task, reason and confirmation. Change period while form open. | Dependent selections reset; backup cohort follows drawer period. One audited backup task; official appointment unchanged. Wrong role/cohort/duplicate/ineligible choice rejects. |
| O03 | Save S06 draft in its branch period; close that period with reason and reviewed unfinished-work acknowledgement. | Ordinary editing stops, draft retained; no lost scores. Do not close Main just for this case. |
| O04 | Periods & deadlines → Marks evaluations → branch period → Extend deadline → Selected cases/tasks; grant S06's exact unfinished task extra time. | Only that eligible task reopens for completion; common deadline/calendar unchanged; actor/reason/end time recorded. |
| O05 | Renew that personal window, then revoke it with reason while branch period is closed. | History retains superseded/revoked windows. Draft becomes read-only again and remains stored. |
| O06 | Grant fresh valid extra time; evaluator submits while valid; inspect receipt/history. | Submission uses effective personal deadline/window; task submitted and exception completed. No continuing edit right. |
| O07 | Now test submitted/unopened/ineligible cases and reopening a closed-period submitted result. Return after P/Q for paused, retired and archived cases, or use separate assisted fixtures. | Forbidden recovery paths reject; mark each subcase separately. Active completion window does not permit Office reopening of a closed-period submission. Reasoned correction remains separate. |
| O08 | In an open branch period extend the common deadline; inspect linked calendar and unaffected personal windows; revoke selected extra time where ordinary period is still open. | Common extension follows owning period; revocation removes exception but does not remove ordinary open-period rights. |
| O09 | Two lecturer tabs edit same draft. First saves; second tries stale save/submit; use Load latest draft explicitly. | No silent overwrite; failed local edits preserved until explicit load/review. Latest saved values win only through version checks. |
| O10 | Technical-assisted lost response after committed submission, closure-vs-reopening race and task-window expiry boundary. | One submission receipt; no duplicate marks/audit; closed-period reopening loses safely; exact deadline/expiry enforced. R explains why ordinary Offline mode alone does not prove these cases. |

## P. Participant lifecycle and retained history

Prepare the named branch students first. For each, capture current appointments, pending requests, submitted work and an unfinished draft before the status change.

| ID | What to do | What should happen |
| --- | --- | --- |
| P01 | Office defers S07 with reason; inspect Student, Supervisor, Panel, Marks, Dashboard and dossier. | New participation blocked/read-only as appropriate; unfinished tasks pause, submitted work retained; no silent appointment reassignment. |
| P02 | Return S07 to Active while appointments still eligible; repeat with a dedicated task whose original appointment ended during deferral. | Only still-eligible tasks resume. Ended appointment must not regain rights or a stale task simply from reactivation. |
| P03 | Withdraw S08 with required review/reason. | Pending work resolves, active appointments close, unfinished tasks retire; saved submissions/audits remain. No new application/nomination/edit bypass. |
| P04 | Attempt graduation of S09 with blockers, inspect reasons, resolve them through normal workflows, then graduate. | Blockers authoritative; successful terminal status preserves historical work. Never disable validation to complete test. |
| P05 | Prepare S13 under retire; mark lecturer Retiring. Try new assignment and retire completely with active responsibilities. | New eligibility excluded; existing permitted work and responsibility blockers explained. Resolve/reassign responsibility before terminal retirement. |
| P06 | Complete retirement and revisit existing access/session. | Sign-in/refresh rights revoked as required; historic lecturer/Marks IDs and records survive. No deletion of submitted evaluation history. |
| P07 | Combine supporting nomination/membership and active coordinator delegation with lifecycle in isolated variants. | Correct cancellation/closure/responsibility handling; no remaining delegated or supporting path that bypasses lifecycle. These are additional cases, not proven by primary-only P01–P06. |
| P08 | Recheck all affected lists, monitoring denominators, historical dossiers and exports. | Retired/paused tasks classified correctly and excluded from active obligations as applicable; submitted history retained under exact original actors. |

## Q. Semester end, carryover and next-semester handover

Run after earlier tests. This chapter has real date prerequisites. Backend will not activate a replacement while the current Active semester has not ended. A future target and an expired-source handover are different tests.

| ID | What to do | What should happen |
| --- | --- | --- |
| Q01 | Create a nonoverlapping future Draft semester and complete its own new Published capacity plan. Try activating before its start or while current semester still running. | Clear block; current semester/periods/tasks untouched. A completed plan alone does not bypass dates. |
| Q02 | Use S12 to leave primary/Panel/supporting requests pending in the source semester before closing/ending it. | Record original semester/request IDs before any carryover action. One student cannot have incompatible primary states simultaneously: prepare each request-kind variant separately. |
| Q03 | On a separate **expired-source** fixture, review target activation, unfinished tasks/windows and reason; acknowledge and activate once target dates include today. | Old semester and its Published Marks periods close atomically; target becomes effectively Active; old marks/drafts/windows stay on their original records. Do not falsify host time or edit live rows to manufacture this. |
| Q04 | Only after Q03, on an eligible pending request from the now-Closed source, Office grants/replaces/revokes carryover capacity reassessment into the current effectively Active target, with reason and fresh preview. | No appointment, workload or reservation created just by grant. Original request semester retained; revocation/stale grant blocks exceptional final approval. A future Draft target is insufficient. |
| Q05 | Actual eligible Coordinator approves using current Published target capacity and fresh reassessment. Repeat separately for primary, Panel and supporting request kinds. | Grant consumed once; actual actor/policy evidence saved; repeat/stale approval rejects. Current eligibility/capacity failures preserve incumbent and request. Reuse of S12 requires separate resettable variants, not simultaneous incompatible primary states. |
| Q06 | Office End semester / Extend end date on dedicated valid cases. | Reason/history/fresh preview required. Extending semester does not silently extend Marks deadlines or reopen intake. |
| Q07 | Try archiving with unfinished recoverable work/window; later archive only when blockers resolved. | Protection holds; historical records remain readable with correct scope. Closed/Archived calendar read-only; archive does not erase academic work. |
| Q08 | Filter old semester reports/Marks after handover; compare original XLSX/dossier history. | Original semester, tasks, submissions and actual actors preserved; active dashboards use target, without migrating historical results. |

Successful Q03–Q05 need a separate timed/expired-source fixture or the actual natural handover date. They are **Blocked by fixture/time** until those prerequisites exist; the initial accounts-only sandbox deliberately does not pre-create an expired Active semester or bypass your Office setup. Q01 is the same-day future-target rejection test, not evidence of successful handover/carryover.

## R. Technical-assisted cases and final cross-checks

These extend the manual journey. A developer can help prepare isolated fixtures or run existing regression harnesses. Do not mutate your working development data, bypass portal guards, or treat historical automated evidence as today's manual result.

| ID | Needed setup / test | Expected result / evidence |
| --- | --- | --- |
| R01 | Reconciliation: separate legacy/unassigned request with exactly one valid semester match; capture before values; preview → reason → acknowledgement → confirm once. | Exact intended repair plus one permanent audit; stale/replayed preview rejects; reports move only that record out of Unassigned. Healthy account-only starting data need not have this issue. |
| R02 | Separate review-only warning eligible for Accept as intentional; later change its underlying evidence. | Acceptance adds reasoned review history without academic mutation; changed evidence reopens issue. Ordinary Published/profile-limit differences are not invented defects. |
| R03 | Controlled audit-write failure during decision/closure/repair, plus concurrent decisions and lifecycle changes. | Whole transaction rolls back: no partial appointment, capacity, marks, request or misleading success. An ordinary network outage is not an audit database failure. |
| R04 | Cut only the response **after** server commits a submission; retry unchanged submission. | One committed result/receipt, no duplicate audit. Browser Offline before send tests a different failure. |
| R05 | Exact opening/closing boundary, personal expiry, scheduled/inclusive-end/expired delegation, expired-source handover. | Compare trusted server Malaysia time with effective rights. Use separately controlled test fixture/clock in automated process, never the workstation/system clock. Ordinary fresh sandbox has no historical states seeded. |
| R06 | Workbook strings beginning `=`, `+`, `-`, `@`; leading-zero ID, Unicode, multiline text using dedicated synthetic fixture. Save and open actual workbook. | Text stays literal, no executable formulas; IDs/content preserved; row scope agrees with report. No requirement to rename real users. |
| R07 | All assignment routes: ordinary primary, Office primary replacement, supporting approval, Panel approval, backup, task generation, carryover and reconciliation, with zero/full/missing policy/ineligible participants. | Same authoritative constraints across every route; no alternate route allocates forbidden work. Missing/restricted policy must not be displayed as numeric available capacity. |
| R08 | Main screens: slow reads, one failed read then Retry, failed save with typed input, double click/busy guard, focus return and stale open decision. | No false zero/empty/success, preserved edits where supported, one mutation, explicit latest-record review. Stop only the sandbox server if needed; leave normal servers alone. |
| R09 | Real app at 1440/390 px; keyboard-only tabbing/Enter/Escape; long text; confirmation/date inputs; page Back and clear scope. | Usable controls, readable validation, correct focus, no clipped action, no accidental submit; exact viewport recorded. Native alert dismissal and file-save dialog tested directly where present. |
| R10 | Session/privacy: wrong password/unknown ID, alternative Student/staff ID, refresh, sign-out, deep links and two roles in separate profiles. | Correct role restored; logout removes access; rejected access does not reveal foreign data. Keep actual authentication throttles; wait rather than disabling them. |

**Closing review:** compare request, appointment, workload, dashboard, Marks, report, saved workbook and dossier for the same named students. Record discrepancies as defects with steps, expected/actual, role, student/request/task IDs, server time and evidence. A successful toast or one screen's count is not enough to certify the linked workflow.

## 4. Result sheet and coverage map

Copy this into an ignored local run note and repeat a row per case ID:

| Case ID | Result | Actor / student | Request / task / semester ID | Expected vs observed | Evidence file / defect |
| --- | --- | --- | --- | --- | --- |
| Example: A01 | Not run | | | | |

Do not paste passwords, tokens or real student data into results/screenshots. Keep account changes made during lifecycle/password cases in the run note rather than resetting those accounts without recording it.

| Owned area / shared dependency | Chapters | Existing detailed traceability |
| --- | --- | --- |
| Dashboard/Timeline | A, B, H, O, Q, R | Checklist D and C families; timeline/period/activation source |
| Supervisor | C, I, K, L, M, P, Q | Checklist S, U, T and L families |
| Panel | D, J, K, L, P, Q | Checklist P, U and L families |
| Marks | E, F, G, O, P, Q | Checklist M and admin-boundary A families |
| Workflow/Approval Tracking | C, D, G, H, M, N, Q, R | Checklist W plus shared audit/privacy requirements |

Use [FIVE_MODULE_ACCEPTANCE_CHECKLIST.md](FIVE_MODULE_ACCEPTANCE_CHECKLIST.md) for the existing 406-clause inventory, [PROJECT_REQUIREMENTS.md](../PROJECT_REQUIREMENTS.md), [ARCHITECTURE_AND_CODING_DESIGN.md](../ARCHITECTURE_AND_CODING_DESIGN.md), and [PROJECT_STATUS.md](../PROJECT_STATUS.md) for current rules and evidence. Later superseding rules and current implementation take priority over older append-only paragraphs/PDFs.

The [brainstorm, roast and review record](FIVE_MODULE_TEST_PLAN_REVIEW_2026-10-28.md) explains the sequence and corrections to older guides. Existing A01–A05 acceptance reports are scoped historical evidence. A06 compound lifecycle/concurrency and A07 full-shell/native/environment cases remain separately accountable; this new plan does not mark them passed.

### Same-department and cross-department UAT accounts
- Artificial Intelligence: UAT Primary, UAT Support, UAT Capacity.
- Data Science: UAT Replacement, UAT Support New, UAT Panel.
- Cyber Security: UAT Outsider, UAT Panel New, UAT Retire.
- Coordinators match their named programme departments. All department names are fictional UAT labels.
- Use Primary + Support for same-department testing; Primary + Outsider (supervision) or Primary + Panel (Panel recommendation) for cross-department testing. Check current capacity and role conflicts before submitting. Approval belongs to the student programme Coordinator, regardless of lecturer department.
