# A07: full portal journeys, saved files and native controls

Verified on 29 October 2026 on `codex/portal-consistency-and-toast`, HEAD `c062330` plus the preserved working tree. This report covers Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks and Workflow/Approval Tracking. It supplements A01–A06; it is not a certificate for every clause or all 162 sequential manual cases.

## Environment and method

Used the existing isolated PostgreSQL database `fsktm_uat_20261028_5bfb97`, portal `127.0.0.1:3003` and API `127.0.0.1:8003`. All academic content and accounts are fictional. Ordinary portal login/logout, forms, confirmations, upload chooser and browser download actions created the evidence. No academic records were inserted through a fixture or direct database write to advance this journey. Independent database verification was read-only.

The sandbox initially had no semesters, appointments or Marks tasks. It now contains the observed results below; running the preparation helper again preserves them. Credentials, uploaded inputs, process metadata, screenshots and the final `a07-evidence/verified-manifest.json` stay in ignored `backend/.env.five-module-uat/`. Normal development data and servers on 8000/3001 were preserved. Only the verified isolated API listener was refreshed to load current source. UAT remains running for follow-up testing.

## Observed acceptance

| ID | Actual full-portal journey and result |
| --- | --- |
| A07-01 | Office without staff/superuser flags created Semester I 2026/2027, 21 October–26 January; configured all nine Lecturer limits, retained UAT-CAPACITY's one-place Supervisor limit, published the plan and activated after readiness review. |
| A07-02 | Downloaded the real semester template, selected that saved workbook through the upload chooser, previewed two rows, acknowledged the past-date warning and imported. Edited a public milestone to 29 October–4 November, kept editing after Cancel, then saved. Added an Office-only event. Student dashboard excludes the private event. |
| A07-03 | Student S01 logged in and submitted the four-step application with nine Research Intent answers and an actual proposal PDF. Primary Lecturer logged in, reviewed the research and downloaded the private PDF, accepted; AI Coordinator logged in and approved. Application 1 is APPROVED; one primary appointment is ACTIVE. Tracking shows the actual actors and stages. |
| A07-04 | Primary nominated the distinct UAT Panel for S01 with justification. Panel Lecturer logged in and accepted; AI Coordinator logged in and approved. Recommendation 1 is APPROVED; one Panel appointment is ACTIVE. |
| A07-05 | Office created a balanced 40/60 rubric and AI-only evaluation period, entered Malaysia-time dates, previewed two assignments and published. Primary saved 35+50, reloaded and resumed the exact draft, then submitted and locked 85. Panel saved/submitted 30+50=80. Submitted fields are disabled. Independent reads confirm exactly two tasks, two SUBMITTED entries and two submission receipts. |
| A07-06 | Panel availability at 390×844: opened the actual native calendar and selected 31 October with keyboard navigation. End 30 October produced the expected error and disabled Save. Correcting to 2 November allowed reasoned confirmation; exact dates survived reload. Reasoned cancellation retained original dates, actor and cancellation history. No horizontal overflow. |
| A07-07 | Actual XLSX downloads from complete report pages: Panel Lecturer gets one own Marks row; AI Coordinator's applied 29 October–5 November report has no Marks sheet; Office gets both submitted Marks rows. Independent parsing of files on disk confirms scope, row counts and no formula cells. Office monitoring shows two complete submissions and zero overdue tasks. |
| A07-08 | Student's dashboard and phone academic record show their approved primary and Panel, public milestones and no Marks tab. Panel history excludes staff justification/review detail. A direct Office Marks configuration URL redirects to the dashboard; another student's dossier URL redirects to the signed-in Student's own record. |
| A07-09 | Actual native Chrome reload warning: changed an event title without saving, pressed Ctrl+R and observed “Reload site?” / unsaved-change text. Cancel retained the exact unsaved title. A second reload, confirmed without disabling future dialogs, restored the saved calendar/title. Read-only DB checks confirm no UNSAVED event was stored. Created test Chrome windows were closed after logout; the user's existing draw.io window was preserved. |
| A07-10 | Technical Administrator's actual portal login is refused with “This is a technical account. Sign in through the admin site instead.” Ordinary Office, Student, primary Lecturer, Panel Lecturer and AI Coordinator login/logout journeys succeeded. |
| A07-11 | After the first-use fix, Office created a separate Semester II Draft, 27 January–28 May, selected its empty calendar and created its first event directly, without Excel: 1–5 February 2027. Reload retained the event. Read-only checks confirm one linked timeline/event/ADD_ENTRY audit, no source filename and the original active semester's three events and submitted Marks preserved. The Draft was not activated. |

Main synthetic title: **A07 S01 Comparing synthetic workflow reminders**. Semester I ID 1; future Draft ID 2; Supervisor application/recommendation IDs 1; Panel task ID 1, Supervisor task ID 2. Native date-picker selection above is separate evidence from ordinary date-field entry in semester, calendar, report and period forms.

## Files actually saved

These files were saved through the browser into `C:\Users\User\Downloads`, then opened independently. A success toast or fetched response alone was not counted as saving.

| File | Bytes | Verified content |
| --- | ---: | --- |
| `FSKTM_Semester_Timeline_Template (3).xlsx` | 5,241 | Timeline sheet, eight expected headers and two semester-bounded rows; same file used for actual import. |
| `research-proposal.pdf` | 1,452 | Exact byte match to uploaded fictional PDF; SHA256 `14b6d2ce9c8ab61a5c39ad9a4e6f5df545334a0dafe8abf0d2eefba80b8490d6`. |
| `workflow_analytics_report (2).xlsx` | 10,550 | Panel Lecturer; one own Marks row, no primary evaluator row. |
| `workflow_analytics_report (3).xlsx` | 8,956 | AI Coordinator; Supervisor/Panel rows, no Marks sheet. |
| `workflow_analytics_report (4).xlsx` | 11,184 | Office; both submitted Marks rows. |

SHA256 hashes and workbook sheet names are retained in the private evidence manifest. Existing unrelated Downloads files were preserved.

Screenshots: `office-evaluations.png`, `availability-mobile.png`, `student-record-mobile.png`, `first-manual-draft-event.png`, `native-beforeunload-screenshot-0.png` and `native-beforeunload-screenshot-1.png`, under the ignored A07 evidence folder. The first native screenshot includes page context; the second is the browser dialog region.

## Defect and bounded fix

Before the fix, **Add events → Create one event** was available for an empty semester, but submission returned 409 requiring an Excel upload first. That contradicted the existing manual-create action and guide B01.

`dashboard.views.timeline_entry_list_view` now locks the selected semester, rechecks that it is Draft/Active, validates against an unsaved timeline and creates that timeline only for valid input. Calendar, entry and audit commit together. Invalid input, unauthorised Student access, a semester closed after the initial read, and audit-write failure cannot leave a partial calendar. The existing timeline is reused on subsequent creation. Empty-state guidance now mentions manual creation and Excel import. No schema, dependency or authorization expansion was needed.

Five new regression cases extend `dashboard.test_timeline_creation` from four to nine. The initial eight-case red run failed three cases before implementation; the locked-lifecycle case was added before final verification. The affected Dashboard/appointment-timeline gate passed **152 tests in 24.950s** after the final guard. The first-event runtime retest above used the refreshed fixed API. The final release rerun also passed all **152 tests in 648.234s**, with system checks clean and no migration changes. Counts overlap; do not add them. All `test_a07_*` databases are absent after cleanup.

Frontend selected-semester rendering check, TypeScript and production build passed; build transformed 2,514 modules in 18.27s with the existing ExcelJS large-chunk advisory. Django system checks and migration-drift checks passed. A read-only final manifest check confirmed persisted appointments, exact totals/receipts, canceled availability, first Draft event/audit and downloaded file scope/bytes. One verification script initially referenced `task__role`; corrected to the model's `task__evaluator_role` before its successful complete run. This was a verification-script error, not a product defect.

Reproduce the affected backend gate in a normal disposable Django test database:

```powershell
.\.venv\Scripts\python.exe backend/manage.py test dashboard appointments.test_dashboard_timeline --noinput
```

From `frontend`, run `npx tsx src/components/SemesterTimeline.test.tsx`, `npm run lint`, and `npm run build`. These commands verify source behavior; they do not recreate the observed full-portal/native journey or reset the UAT database.

## Boundaries and remaining work

This completes the named **core A07 full-portal/native slice**. It does not mark all 162 sequential cases, every compound combination, all browsers/operating systems or every date field as passed. Historical 406-clause totals remain unchanged. The sequential guide remains a plan; only the specific observations here are accepted evidence.

The in-app browser did not expose the native beforeunload warning, so that check was completed in native Chrome. Legacy `alert()` calls in the unused exported Supervisor RightDrawer have no active workflow consumer; they are not claimed as a reachable alert journey. Normal review confirmations and Keep editing were exercised in current portal flows. Other editor-specific beforeunload handlers and environment variants need their own checks when included in release acceptance.

Supporting/replacement/research/delegation/carryover/terminal combinations retain their precise A01–A06 automated/component evidence and any unrun full-shell manual cases. Shared Registry responsibility handover, teammate-owned Files/FAQ/Letters/Announcements acceptance, faculty/template decisions, cross-account Coordinator identity policy, production-host configuration and deployment acceptance remain separate. The proposal upload and document requirement used here do not certify the general Files module.

Visual observation at the initial A07 pass: participant-lifecycle summary labels looked crowded in the saved Office report screenshot. The values remained visible. This follow-up is now resolved by the focused layout cleanup below.

No live academic/account mutations, password resets, production deployment, commit or push were performed. Direct review is recorded; no independent reviewer result is claimed.

## Report-label layout follow-up (29 October 2026)

The old layout forced seven columns at the desktop breakpoint even when the sidebar reduced the report container width. Metric keys also appeared as joined words, such as Graduatedstudents. Both existing summary render paths now use container-sized auto-fit columns (9rem minimum, capped at container width), shrinking cards, wrapping labels and local camel-case word separation. Counts, global label formatting, exports, API scope and permissions are unchanged.

Temporary headless Chrome inspection mounted the production WorkflowReports component with synthetic responses and the newly built production CSS. Exact-width iframes covered Office 320, 390, 768, 1024, 1280 and 1440px, with sidebar space reserved at desktop widths. Supplied Coordinator summaries exercised the second render path at 390/1280px; this does not assert that real Coordinator API responses include lifecycle summaries. A separately bundled reconstruction of the original layout reproduced overflow: seven labels at 320/1024px and three at 1280px. After the fix, all eight viewport/role cases retained the exact seven fixture values and readable labels, with no card/label/grid overflow. The saved 1024px screenshot was visually inspected.

Fresh checks passed: `npm run lint` (TypeScript), `npm run build` (2514 modules, 34.69s; existing ExcelJS chunk advisory), `WorkflowReportClarity.test.tsx`, `WorkflowReportsIntegration.test.ts` and `workflowReports.test.ts`. No backend change or fresh backend-suite claim. Browser-control initialization failed twice, so this follow-up uses the repository's headless Chrome inspection approach rather than a new interactive full-shell login pass. Existing A07 evidence and outstanding advanced manual/shared/deployment boundaries remain unchanged.

The temporary inspection script, bundled before/after fixtures, numeric results and `report-labels-after.png` remain under ignored `backend/.env.five-module-uat/a07-evidence/`. No new tracked test harness, dependency or database write; all accumulated work remains uncommitted.
