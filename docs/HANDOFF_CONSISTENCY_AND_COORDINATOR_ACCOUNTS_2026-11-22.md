# Handoff: portal consistency and coordinator accounts (22 November 2026)

From Xiang to Wey Cheng. Branch `Xiang-coordinator-consistency`, PR into `main`.

## What this is

1. **Portal consistency.** Your Codex review showed that the two halves of the portal look and behave differently. We agreed one set of rules (section 1). This PR applies them to Xiang's modules and to the shared files. Your modules need the same pass (section 4).
2. **Coordinator accounts.** Each account has one role, so a lecturer who is also a Programme Coordinator needs two accounts, but has only one real UM email for the activation link. This PR gives the coordinator account the lecturer's email with `+coordinator` added (section 2).

**What we need from you**

1. Merge this branch and run `python manage.py migrate` (new migration `accounts.0026`).
2. Go through section 3 and check whether these changes affect your modules. Where they do, amend your code to match.
3. Do your part in section 4.
4. If you disagree with a rule in section 1, tell Xiang before changing it.

## 1. Agreed rules

| Topic | Rule |
|---|---|
| Pop-up messages | One shared queue on signed-in screens (`useDecisionFeedback()` from `DecisionFeedback.tsx`). Green (`success`) when something worked, red (`danger`) when it failed or was refused, amber (`warning`) when something is blocked. Success closes after 4 seconds; warnings and errors stay until closed. Cancel, search and filters show no message. |
| Form errors | Do not grey out Save without a reason. When the user presses it, show the problem under the field, move focus to it and keep what was typed. |
| Button text | Every action button in CAPITALS, as `PortalButton` already does. Use `PortalButton` where it fits; otherwise `text-[11px] font-extrabold uppercase tracking-wider`. |
| Not in capitals | Links that open another page, items inside dropdown menus, list rows and cards, choice chips, icon-only buttons, dropdown and date boxes that show a chosen value, and links inside a sentence ("Forgot password?"). |
| Button colours | Navy for the main action, white for Cancel and Export, rose for Delete. |
| Icons | Plus for a new record, Upload for adding a file, Download for export. |
| Status colours | Green done, amber waiting, rose failed, blue information, grey inactive. |
| Dates | The portal `DateField` / `TimeField` everywhere, not the browser's own date box. |
| Form box text | 14 px where a size is set on a form box (`form-control ... text-[14px]`); no one-off 13.5 or 15 px. |
| Keyboard | "Skip to main content" link in the shell; arrow keys, Home and End on the shared tabs. |
| Shared files | Whoever changes a shared file asks the other person to review it. |
| Office contact | One address everywhere, read from `frontend/src/constants/office.ts` (`tdit_fsktm@um.edu.my`). |
| Tables | One table style for both halves. Decided later. |

## 2. What this PR changes

### Coordinator accounts

How it works for people:

- The lecturer account keeps the real email, for example `aisyahzulzaidi@um.edu.my`.
- The office makes a coordinator in Registry > Staff & Lecturers > Add account > Programme coordinator by picking the lecturer and the programme. Nothing is typed.
- The system creates `aisyahzulzaidi+coordinator@um.edu.my`. Every email to that address is delivered to the lecturer's real inbox, so UM's mail server does not need to understand `+`.
- Lecturer work: sign in with the real email. Coordinator work: sign in with the `+coordinator` email. Each account has its own password.
- Name, email, staff ID, department and title follow the lecturer account. The coordinator account cannot be edited on its own.
- When the coordinator role ends, only the coordinator account closes. When the lecturer is turned off, retires or resigns, both close.
- Appointing the same lecturer again switches the old coordinator account back on.

Code:

- `accounts/coordinator_alias.py` (new): alias email, real inbox and staff ID helpers.
- `accounts/mail_backend.py` (new): `RealInboxBackend` sends through `settings.REAL_EMAIL_BACKEND` after pointing `+coordinator` addresses at the real inbox.
- `accounts/models.py`: `Coordinator.lecturer_account`, a one-to-one link to the lecturer's own account. It is empty for existing coordinator accounts. Migration `accounts/0026_coordinator_lecturer_account`.
- `accounts/staff_accounts.py`: `create_coordinator_account` (made from a lecturer), edits that follow the lecturer, `close_coordinator_account`, and a delete check that names the linked account. A typed email containing `+coordinator` is refused for any role.
- `accounts/staff_views.py`: the create endpoint takes `{"role": "Programme Coordinator", "lecturerId", "programme"}` for coordinators. A coordinator account is stored with the staff ID plus `-PC`, and screens show it without `-PC`.
- `accounts/account_emails.py`: activation, reset and email-changed emails for a coordinator account say which account they are about and which email to sign in with.
- Frontend: `StaffAccountForm.tsx` (lecturer and programme dropdowns), `StaffAccountPage.tsx` (a "Lecturer account" card or a "Programme Coordinator account" card linking the two), `StaffAccountDialogs.tsx`, `types/staffAccount.ts`, `services/staffAccountsApi.ts`.
- Existing coordinator accounts keep working as they are. Role checks did not change.

### Consistency in Xiang's modules

- **Pop-up messages:** Student Letters, Student Registry, Letter Templates, Settings and My Profile now use the shared queue instead of their own 3.5-second timers. The letter components' `onMessage` takes an optional tone, and failures pass `'danger'`. The "Password updated" line on the sign-in page stays until the person signs in.
- **Announcements:** no more pop-ups for "Attached file", "Attachment removed", "will be removed when you save" or "Edit cancelled". The file box already shows these.
- **Message timing:** three more screens now close success messages after 4 seconds, like the shared queue: AcademicFAQEditor, FileRepository and StaffLecturersRegistry.
- **New Submission:** Create can be pressed. Missing fields are named under each field and focus moves to the first one. The one-off 13.5 and 12.5 px sizes are gone.
- **Form box sizes:** the one-off 13 and 15 px boxes are now 14 px.
- **Icons:** Upload file uses the Upload icon instead of Plus.
- **Buttons in capitals:** 28 action buttons in Xiang's files and the shared files, for example "Clear filters", "Try again", "Mark all as read", and "Today" and "Clear" in the date picker.
- **Support Desk pop-up** (`AppLayout.tsx`): the made-up rows are removed ("Academic Secretariat Desk", "Database Center System Ops" showing the user's own name, "Host Counter Ingress"). It now shows only the office email and phone from `constants/office.ts`.
- **Keyboard:** a skip link in `AppLayout.tsx`, and arrow keys, Home and End in `SegmentedControl` (`PortalPrimitives.tsx`). Only the chosen tab is in the Tab order.
- **RP Registration test:** `projectStages.test.ts` now matches the current dashboard line `{question && !stageAsking && stageCardNode}`.

## 3. Shared changes that may affect your modules: please check

| Where | What changed | What to check in your code |
|---|---|---|
| `config/settings.py`, `accounts/mail_backend.py` | `EMAIL_BACKEND` is now the wrapper. SMTP or console is in `REAL_EMAIL_BACKEND`. | If your code compares `settings.EMAIL_BACKEND` with the SMTP backend, look through the wrapper the way `_sends_by_smtp()` in `announcements/emails.py` does. Tests still use Django's test mail box. |
| `announcements/emails.py` | `email_users` sends one copy per real inbox. | Nothing, unless you send mail some other way. |
| `accounts/participant_lifecycle.py` | `lecturer_blockers` also counts the coordinator account's programme and delegations. `transition_lecturer` refuses a coordinator account's `-PC` staff ID, and closes the coordinator account when the lecturer retires or resigns. | Your lifecycle screens: a lecturer with a coordinator account cannot leave until that account has no programme. |
| `accounts/participant_views.py`, `dashboard/reports.py` (your file, the lecturer counts) | Lecturer lists and counts skip coordinator accounts' lecturer rows. | Any other lecturer list of yours that is not built from Supervisor or Panel duties needs `.exclude(coordinator__lecturer_account__isnull=False)`. Capacity, supervisor and panel lists already use duties, so coordinator accounts do not appear there. |
| `accounts/staff_accounts.py` | The `set_duties` message for coordinators now reads "Supervisor and panel work stays on the lecturer account." | Your screens that show this message. |
| Coordinator accounts in general | A new coordinator account has its own User, Lecturer and Coordinator rows, linked by `Coordinator.lecturer_account`. | Acting coordinators (`CoordinatorDelegation`) are unchanged. Anywhere you show a coordinator's staff ID from `lecturer.staff_no`, it ends with `-PC`; use `shown_staff_id()` from `accounts/coordinator_alias.py`. |
| `AppLayout.tsx` | Skip link, `tabIndex={-1}` on `<main>`, and the Support Desk pop-up. | Nothing else in the shell changed. |
| `PortalPrimitives.tsx` | `SegmentedControl` keyboard support. | None of your screens use `SegmentedControl`. |
| `TopHeader.tsx`, `DateFields.tsx` | "Mark all as read", "Today" and "Clear" are in capitals. | The date picker change shows on your screens once they use `DateField`. |

## 4. Your part

1. **Pop-up messages with their own timers.** Move these to `useDecisionFeedback()`:
   - `CoordinatorDashboard.tsx:108`
   - `LecturerDashboard.tsx:145`
   - `StudentDashboard.tsx:73`
   - `CoordinatorSupervisorApprovals.tsx:242`

   Their `setTimeout(() => setX(null), ...)` can cut off a newer message.
2. **Your other local pop-ups** (MarkEntryDetail, OperationalPeriodManagement, SupervisorAppointmentApplicationPage, DecisionDialog). Make success messages close after 4 seconds (`durationMs={toastDuration(tone)}`), or move them to the shared queue.
3. **Buttons in capitals.** These 33 files have plain `<button>`s not in capitals. Apply the rule and its exceptions from section 1:
   - AcademicSemesterManagement, AlertListCard, AlertMessage, CapacityLecturerDialog, ChecklistCard, EventDateImport
   - LecturerMarkingNavigation, LecturerSupervisorAppointments, MarkEntryRecords, MonitoringTasksCard
   - OfficeCapacityWorkspace, OfficePanelAttention, OfficeSupervisorAttention, OfficeToolPrimitives, OperationalIntakeFeedback
   - PanelRecommendationRecordsTable, PanelWorkspaceNavigation, PeriodActivityOverview, PeriodCalendarConnection, PeriodExtensions
   - RequestWorkspacePrimitives, RubricsManagementView, SubmissionWindowDialog, SubmittedMarksActions
   - SupervisorAppointmentApplicationPage, SupervisorDocumentRequirements, SupervisorRequestHistory, SupervisorResearchIntent, SupervisoryTeamManagement
   - TimelineCalendar, UploadTimelineDrawer, WorkflowAuditLog, WorkspaceToolsMenu
4. **Browser date boxes.** Move these 14 files to `DateField` / `TimeField`:
   - AcademicSemesterManagement, AddTimelineEntryDrawer, CoordinatorBrowsePrimitives, EditTimelineEntryDrawer
   - InformationalEventExtension, LecturerAvailabilityPage, MarkEntryPeriodConfig, MarksCompletionWindows
   - MarksEntryHistory, PanelBrowse, RequestWorkspacePrimitives, SubmissionScheduleField
   - SupervisorRequestHistory, WorkflowReports
5. **To decide:** your decision pop-ups show field labels in normal case (`.decision-dialog-fields .form-label` in `index.css`), while other form labels are in capitals.
6. **Footer:** "Privacy Policy" and "System Manual" in `AppLayout.tsx` have no action. Link them or remove them.
7. **Later, with the table style:** Marks Records is 980 px wide inside a sideways scroll box (`marksWorkspace.css:71`, `MarkEntryRecords.tsx`).
8. **From Xiang's QA (ISS-019):** the Acting coordinators wording and dates in `CoordinatorDelegations.tsx`.
9. **Tests that already fail on `main`** (not caused by this PR; they fail the same way on a clean copy of `main`):
   - `announcements.test_reminders.DeadlineReminderTests`: all 5 fail in `setUp` on the `one_published_timeline_per_semester` constraint.
   - `appointments.test_rp_stage_handoffs ... test_unregistered_special_keeps_rp2_appointments_until_next_studied_semester` (`True != False`).
   - `dashboard.test_completion_tracking ... test_closed_work_requires_review_instead_of_automatic_retirement` (`'REPAIRABLE' != 'REVIEW_REQUIRED'`).
   - `frontend/src/components/DashboardActionCentre.test.ts` expects 7 `onNavigateToRoute` links in `App.tsx`; there are 6.

## 5. How this was checked

- **Backend:** all 2,567 tests. The only failures are the 7 listed in section 4, which fail the same way on `main`.
  - New: `accounts/test_coordinator_accounts.py`, with 11 tests.
  - Updated: `accounts/test_staff_accounts.py`, which has 6 new coordinator tests.
- **Frontend:** TypeScript, the production build, and all 256 test files. Only `DashboardActionCentre.test.ts` fails, as on `main`.
- **Browser, on a copy of the database with email off:**
  - The office created a coordinator account from a lecturer through the form.
  - Both account pages link to each other, and the real staff ID is shown.
  - New Submission names the missing title and moves focus to it.
  - Arrow keys move between the Registry tabs and keep focus.
  - The first Tab reaches the skip link.
  - There were no page errors.
