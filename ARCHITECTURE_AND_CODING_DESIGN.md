## Phase six feedback integration (1 November 2026)

Existing DecisionFeedbackProvider ownership now covers requirement configuration, participant/delegation commands, Workflow exports, appointment letters, notification updates and the remaining Panel recommendation success emitter. A small useDraftDiscard hook reuses PortalConfirmModal for local replacement consent; DraftNavigationGuard retains route/session/unload ownership. Participant management aggregates delegation drafts through RecordDraft so there is one route blocker. Confirmed local Back clears owned drafts before navigation to avoid a second discard prompt. Synchronous refs prevent duplicate writes/exports; post-commit reads cannot turn a successful command into a failed save. Conflicted delegation/participant editors remain blocked and preserve their draft when latest reads fail. No API/schema/dependency or security-rule changes.

## Phase five Marks interaction design (1 November 2026)

Marks pages reuse DecisionFeedbackProvider and nested-aware DraftNavigationGuard/RecordDraft ownership. Rubric forms keep independent initialized baselines; scoped replacement and conflict recovery preserve unrelated work. Period reviews bind to context and period identity, invalidate obsolete recipient previews, and distinguish a committed write from failed reads. Generation checks current saved scope without adding an exact-count preview API, retains loaded fallback content during refresh, and aggregates fallback reports through one assignment guard; backup RecordPage retains its completion allowance. Lecturer final submission uses its captured reviewed snapshot and existing payload-keyed submission reference. Office latest-read recovery clears stale inputs only after successful replacement. DecisionDialog's optional recoveryDirty defaults to dirty and separates external-editor replacement consent from cancelling final review. Completion-window drafts report to an inherited owner or stand alone; the fallback receives all loaded tasks so presentation filters do not silently change grant identity. No backend/API/schema/dependency change belongs to this phase. Final checks and any remaining limits are in PROJECT_STATUS.md.
## Phase five Marks interaction design (31 October–1 November 2026)

Implementation is tracked in `docs/PHASE_FIVE_MARKS_FEEDBACK_PLAN_2026-10-31.md`. `RubricsManagementView` owns independent initialized metadata and component baselines, merges latest-record reads by affected scope, and blocks stale retries after direct 403/409 until a successful read. `MarkEntryPeriodConfig` owns period/reason draft state and uses the existing `ClosureReview` for signed close; publish/archive each use one shared final review. `EvaluationTaskAssignment` reviews saved generation readiness, re-reads the selected period before POST, and derives authoritative counts only from the generation response. The assignment host retains loaded content during secondary reads and owns nested fallback draft state through `RecordDraft.Provider` and one `DraftNavigationGuard`.

`MarkEntryDetail` submits a captured final payload snapshot and keeps the existing payload-keyed receipt and version behavior. `SubmittedMarksActions` shows complete changed score/comment deltas; an opt-in `DecisionDialog.recoveryDirty` separates consent for latest-record replacement from quiet dismissal of the final review, leaving other callers' default behavior intact. `MarksCompletionWindows` registers grant/revoke draft and busy state with its nested owner, uses full loaded task scope independently of presentation filters, and clears committed input before follow-up reads. These paths use stable `DecisionFeedback` ownership, preserve contextual errors and read-only recovery after committed-write refresh failure, and add no API, schema, authorization or academic rule. Integrated verification and broad review remain tracked separately in the phase workspace.
## Calendar and setup guard ownership — phase four (30 October 2026)

Package four extends the existing RecordDraft, RecordPage, SessionExit and DecisionFeedback contracts to missing setup entry points. DraftNavigationGuard delegates to an existing RecordPage where present and supplies router/unload/logout ownership only when absent. Its host remains mounted across completion so a blocked exit can proceed after the draft becomes clean; inactive siblings release their router guard. DecisionDialog opts into this fallback explicitly, retaining default compatibility. Calendar methods keep independent baselines and clear only the committed method. Retained modal drafts receive inline completion context while the shared queue waits for usable delivery; academic mutation and subsequent read outcomes remain separate. Template feedback has its own state and request/session generation: workbook selection cannot cancel a pending template request, newer requests take precedence, and disposed sessions cannot publish old outcomes. Prepared wording describes browser handoff, not a saved file. See `docs/PHASE_FOUR_SETUP_FEEDBACK_PLAN_2026-10-30.md`.

Semester transitions use the shared confirmation modal for local disposal/replacement, initialized end-date comparisons and a synchronous write lock. ClosureReview exposes optional label/acknowledgment/block callbacks while preserving other callers' defaults and signed preview behavior. Transition views remain mounted across History navigation. Direct403/409 transitions require latest-record recovery; a committed save with failed list refresh retains its returned baseline and blocks further writes until a successful reload. Internal saved-baseline installation remains distinct from entering a stale list record. Lecturer availability cancellation reason reports as its own private draft alongside the visible create form; discarding/completing it clears only that scope. Stable feedback owners reuse the shell queue.

Capacity decisions use a stable aggregate guard; conditional single/bulk/publication/discard editors report to it, while preparation retains its own RecordPage. Carryover reassessment reports typed reason as dirty rather than pending, so nested navigation remains discardable. Create/clone retain the returned committed plan when refresh fails and block accidental repeated creation. The optional RecordPage/RightDrawer `onNavigationSettled` handoff keeps successful preparation mounted until its own blocked route has proceeded; it also settles clean/idle standalone and MemoryRouter owners. Existing explicit completion allowance still releases a blocked route when a saved owner's old dirty report lingers. The local settlement callback requires genuine clean/unblocked state and adds no global navigation bypass.

Operational decisions/extensions render under the managed RecordPage when one exists and use standalone guarding on the overview. Submission-window forms have a stable owner across conditional closure, including same-semester anchor navigation. Existing period kinds, candidate/task identity, dates, expected revisions, capacity fingerprints/status/event checks, signed preview and authorization remain authoritative. Final fixtures cover production components with synthetic HTTP; native unload prompts, authenticated full-shell/logout and saved-workbook acceptance remain phase seven. This feedback package adds no backend/API/schema/dependency or academic-rule change; unrelated concurrent capacity pagination and semester-selector changes are preserved separately.

## Appointment feedback migration (30 October 2026)

The Student Supervisor workspace and appointment/workload report hosts supply a local DecisionFeedbackProvider that reuses an existing shell provider. Supervisor application success is published before completion navigation, so the retained owner displays it once after the editor closes. Its direct-form fallback uses PortalToast delivery identity and visible-duration handling. Contact and supporting nomination forms own their local discard confirmation and continue reporting child dirty/busy state through RecordDraft; closing a child never grants a parent-wide completion allowance.

Research creation retains an options/baseline snapshot independently of workspace loading. Role/route/student/action and local editor generation identify its session; incidental refresh versions do not replace entered values. Forbidden/conflicting creation blocks resubmission and keeps the form mounted. Explicit Replace and review installs a new baseline only after a successful same-student/session read, preserving the draft after failed or stale reads. Monotonic session identity rejects A-B-A callbacks; current-scope acknowledgment prevents completed recovery remaining busy after incidental refresh. Confirmed creation retires its draft before refreshing and uses completeDecision/shared feedback for one truthful outcome; direct standalone research hosts retain an inline fallback. Approval/cancellation DecisionDialog and existing version payloads remain authoritative.

Appointment Apply/Clear actions update visible results without notifications. Report preparation/no-results outcomes use the shared queue; useExcelExport owns generation exclusion and contextual persistent errors. Existing role-scoped rows/columns and file-generation code are preserved. Focused mounted fixtures use synthetic HTTP; export-feedback fixtures replace only the generation boundary and do not certify a browser-saved workbook. The child-draft/export interaction fixtures do not load production CSS; viewport interaction evidence is separate from visual acceptance. Research Intent screenshot output and its Vite cache now stay within each runner's isolated temporary directory.

## FYP testing artefact traceability (29 October 2026)

The testing report draft and workbook in `outputs/fyp-testing-01a18227/` reuse the existing guide IDs and add report IDs. One primary module is assigned per scenario for nonduplicated counts; technique tags and compound variants are not additional parent cases. Current manual results start blank/Not run; historical A07 observations and participant UAT remain separate records. Summary formulas derive from the result register with explicit missing-evidence checks and no fabricated pass-rate denominator. Source extraction/build/render intermediates remain ignored local artefacts; application/runtime architecture and schemas are unchanged. Method and limitations: `docs/FYP_TESTING_REPORT_PREPARATION_2026-10-29.md`.

## Shared outcome and session-exit infrastructure (29 October 2026)

DecisionFeedback owns an ordered per-session outcome queue and accepts optional operation identities; nested providers reuse the nearest host. PortalToast exposes optional delivery identity/lifetime while preserving legacy calls. Shared delivery suspends for actual native modals or inert body/document ancestors, then restarts its visible lifetime; unrelated inert list siblings remain irrelevant. App supplies account/role feedback identity instead of mutable display names. Legacy page emitters migrate separately.

DecisionDialog tracks open-session generations separately from decision identity, isolates asynchronous save/reload completion and provides optional onComplete/onDiscard callbacks alongside compatible onClose. RecordPage retains one draft aggregate/router guard, restores protection on a new clean-to-dirty transition and resolves clean pending navigation after writes settle. SessionExit observes those aggregate scopes through a context registry and coordinates voluntary logout before the auth callback, without adding a router blocker or changing forced-expiry handling. The session owner remounts across account boundaries so pending exit callbacks cannot cross them. New isolated browser fixtures exercise real production components/native dialogs under StrictMode; no API, database, dependency or academic-authority change is introduced.

## Phase-one draft lifecycle corrections (29 October 2026)

EvaluationTaskAssignment records a successful backup commit synchronously before its secondary refresh. That ref scopes RecordPage completion/dirty protection and disables another confirmation; the mounted DecisionDialog publishes the existing single success/refresh-warning outcome before its close callback disposes the completed editor. Failed mutation and cancelled review leave the form intact. Workflow reconciliation marks only acceptance-dialog private inputs dirty and clears that scope on closure; repair final-review cancellation retains the visible repair input. OperationalPeriodManagement captures its initialized extension scope and converted deadline once at opening, compares current values to that baseline and includes candidate/task selections in dirty tracking. Panel nomination draft disposal is isolated from the owning RecordPage/history lifecycle and keyed to student/replacement identity. No API/schema/dependency or authorization change is required. Mounted synthetic-HTTP regressions cover completion, abandonment, retained failures, initialized defaults and reverted edits; full-shell live academic acceptance remains separate.

## Report lifecycle summary layout (29 October 2026)

Both participant-lifecycle summary render paths in WorkflowReports use a container-sized CSS grid with auto-fit and a 9rem minimum track capped at 100% for narrow containers. Cards may shrink and labels may wrap; camel-case metric keys are split into words locally before existing report label formatting. Global report formatting, APIs, counts, exports and permissions are unchanged. Verification uses the production component and built CSS in temporary headless Chrome fixtures, with synthetic responses and exact iframe widths; desktop fixtures reserve sidebar space. No permanent test harness or application dependency is added. Evidence and boundaries are recorded in the A07 report's layout follow-up.

## Initial manual calendar creation (29 October 2026)

The timeline entry POST locks the selected semester and rechecks Draft/Active status. When no current timeline exists, it constructs an unsaved semester-linked calendar for serializer/link validation, saves it only after valid input, then writes the event and audit in the existing atomic request. This serializes first-event creation with imports and other calendar mutations and preserves rollback. No schema/dependency change. Timeline creation regressions cover first/repeated entry, invalid input, audit outage, Student denial and a semester closed after an earlier read. A07 observations use the separate manual UAT environment; downloaded files are inspected independently of toasts/blob creation.

The empty calendar explains both manual creation and Excel import. Full-shell A07 evidence uses real login/logout and persisted portal workflows; native Chrome verifies beforeunload separately from in-app browser behavior. A read-only database/file manifest and screenshots remain in the ignored UAT evidence directory. See `docs/FULL_PORTAL_NATIVE_ACCEPTANCE_2026-10-29.md` for exact coverage and limits.

## Public lifecycle projections and A06 acceptance (28 October 2026)

SupervisorApplicationSerializer receives request context at every API call site, selects a public lifecycle payload for Student/missing actors, and removes the Office participant-lifecycle cancellation reason/event from public request representations. Dossier construction applies the same cancellation boundary and adds primary end reasons only to internal records. Existing ordinary request decision evidence and internal lifecycle serialization remain intact. StudentProgressDossier gates workflow audits and primary/Panel/supporting closure text on internal visibility, supplementing API redaction without replacing record authorization. Stored audit/event/appointment models and business transitions are unchanged; no migration or dependency is added.

`accounts.test_compound_lifecycle_acceptance` adds guarded disposable PostgreSQL fixtures, exact multi-model rollback snapshots and separate-connection concurrency tests for lifecycle/Marks combinations. Two opt-in TerminalLifecycleBrowserJourney tests reuse the real-HTTP reporting harness at 1440/390px; unmodified API privacy is checked separately from deliberately contaminated supplied data used to test the UI guard. Native/full-shell and shared Registry responsibility handover remain separate acceptance. Evidence: `docs/COMPOUND_LIFECYCLE_MARKS_ACCEPTANCE_2026-10-28.md`.

## Isolated manual UAT preparation (28 October 2026)

`scripts/prepare_five_module_uat.py` prepares a uniquely named local PostgreSQL database and 31 fictional account/profile rows without pre-creating semester, appointment, research or evaluation workflows. It refuses ordinary/remote database targets, never resets a configured sandbox, and writes generated credentials/media/logs only under Git-ignored `backend/.env.five-module-uat/`. Standard migrations and existing account models/explicit Marks permissions are reused. Standalone tests cover isolation and actor prerequisites. Optional servers use `127.0.0.1:3003/8003`, separate secret/auth cookies (including rotation-grace key), console email and real backend services without changing normal `.env` or weakening permissions/throttles. These are development test helpers; production workflow code is unchanged. Guide/critique/evidence boundaries are in `docs/FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md` and `docs/FIVE_MODULE_TEST_PLAN_REVIEW_2026-10-28.md`.

## Dossier request identity and A05 verification (28 October 2026)

StudentProgressDossier tracks request generation and the student identity resolved by the latest request. Success, error and completion callbacks update state only for that generation; effect cleanup invalidates prior reads. Starting a read clears the previous dossier, and a loaded-identity mismatch renders loading immediately during route changes. Existing services, API scope and schemas remain unchanged.

`dashboard.acceptance_fixtures` supplies guarded synthetic actors, appointments, supporting membership, submitted Marks, calendar entries and an unassigned legacy request. Nine API/persisted tests cover reports/XLSX, lifecycle privacy, supporting replacement/closure, transfers, delegation revocation, handover and reconciliation including audit-outage rollback. Six opt-in browser journeys mount production reports/dossier/reconciliation/calendar components over real isolated HTTP at 1440/390px. They delay actual responses and inject transport failures; parsed workbooks and exact stored rows independently verify outcomes. The native download save boundary is captured rather than certified. Existing timeline/reconciliation simulated-response browser suites remain separately identified. No new application dependency or migration. Evidence: `docs/REPORTING_RECONCILIATION_ACCEPTANCE_2026-10-28.md`.

## Office account conversion operation (28 October 2026)

The existing transactional conversion command has been applied locally after verifying the listening API's technical-only admin gate and real recovery credentials. Only the legacy Office `is_staff` field changed; 63 protected model/through-table fingerprints remained identical. Existing/fresh Office portal sessions and dedicated technical admin login were verified; repeat conversion is idempotent. No authentication design, schema, dependency or application-code changes were needed. See `docs/OFFICE_ACCESS_ROLLOUT_2026-10-28.md` for the 123-test gate, 83 runtime assertions and evidence boundaries.

## Branch integration and release (28 October 2026)

Use a normal merge of origin/main into the current feature branch. Keep appointment source navigation available when a partial supervisory DTO has an approved application ID but lacks lifecycle details; omit fabricated lifecycle controls and facts. Workload tests assert the current accessible section hierarchy and lecturer heading rather than obsolete typography tokens. Retain Office/Technical Administrator separation and incoming main features together. The two content conflicts keep main's redesigned letter-management and staff-account screens; obsolete staff-component alignment fixtures now exercise the shared production workload headings. The automatic account-admin merge preserves immutable profile owners alongside main's read-only AccountChange registration.

## Office approved request supervisor change (28 October 2026)

- `OfficeAppointmentAdministration` accepts an optional replacement callback and refresh version. Its active-appointment action reads the existing replacement context, validates appointment/student identity, ignores obsolete responses, and requires server `canSubmit` with no pending application before exposing the action.
- `SupervisorAppointmentManagement` opens `OfficeSupervisorReplacementForm` locally from request details and refreshes source data and eligibility after submission. The form accepts an optional back label; its existing draft protection, POST validation and recovery behavior are preserved.
- No API, database or authorization changes. Browser fixtures exercise form opening, return, submission payload, source refresh, pending-request suppression, availability retry and ended-record protection.

## Panel nomination history action placement (28 October 2026)

PanelSuperviseeDetails renders terminal nomination records outside data-panel-supervisee-columns in a named PortalCard using the existing SupervisorRequestDisclosure. Its responsive semantic table has explicit table/row/cell roles and mobile field labels; desktop action cells use end alignment. The existing onOpenRequest(row) callback and WorkspacePagination are retained. No API or permission changes. History is omitted when no terminal records exist, rather than adding an empty sidebar disclosure.

## Labelled appointment management controls (28 October 2026)

AppointmentRecordSection wraps supplied management actions in the existing native SupervisorRequestDisclosure, providing consistent keyboard interaction and one divider without introducing a menu dependency. Source/marking slots remain outside this disclosure. AppointmentEndControl accepts an optional buttonLabel while retaining its original dialog/submit contract; compact Supervisor and staff Panel hosts supply role-specific appointment wording. SupervisorAppointmentRecordCard suppresses ending controls on inactive records before constructing the management slot. PrimarySupervisorReplacementActions uses the accurate Request supervisor change label.

## Staff appointment details and contextual marking (28 October 2026)

AppointmentRecordSection is reused by Supervisor/Panel record renderers, with distinct source-navigation, marking and management slots. PanelAssignmentDetails and noncollapsible SupervisoryStudentDetailCard place only the record in their sidebar; AppointmentHistoryCard now renders Appointment changes below the columns when real changes exist. Pending supporting nominations use a compact disclosure beside supporting members; historical supporting evidence stays below. The earlier inline SupervisorApprovalHistory component was removed because approval belongs in the linked request.

AppointmentMarkingAction reads the existing signed-in Lecturer assigned/submitted-task endpoints, merges task IDs and selects exact student plus SUPERVISOR/PANEL role. It cancels stale responses on identity/unmount changes, hides genuinely absent tasks, and offers a retry on read failure. It only mounts in Lecturer active-appointment hosts when marking navigation is supplied.

appointmentMarking.ts defines tested task-state labels and encoded/validated student-role-task targets. App passes these targets through /marks query parameters. LecturerMarksEntry validates and resolves the target from fresh authorised tasks, opens a single exact task (including historical submitted work), or lists matching periods. Submitted details stay read-only; explicit Show all tasks restores normal browsing. Target context resets stale saved filters and does not weaken existing save/submit guards. No new endpoint, dependency, database migration or permission change.

## Request history simplification (28 October 2026)

SupervisorRequestDetail and PanelRecommendationDetail omit their duplicate RequestAuditHistory rendering. ApprovalProcess retains decision comments; Panel approval-step presentation now includes recorded review reasons while avoiding repetition of separately displayed terminal reasons. SupervisorAppointmentRecordCard and PanelAppointmentRecordCard filter ACTIVATED only for their displayed lifecycle changes, retaining creation dates and all stored evidence. These presentation changes require no API, database or authorization changes.

## Appointment sidebar consistency phase (28 October 2026)

- AppointmentSidebar.tsx provides the common compact AppointmentRecordSection and AppointmentHistoryCard. SupervisorAppointmentRecordCard and PanelAppointmentRecordCard reuse the frame; staff assignment hosts move their audit to History via showHistory=false. Request hosts retain lifecycle audit inside their compact record.
- Supervisor and Panel request review cards share SupervisionDetailSection. RequestAuditHistory has an opt-in sidebar disclosure variant; its default rendering and event semantics remain intact.
- panelBrowseRecordKey preserves recommendation IDs in the Office request list and appointment IDs in the appointment workspace, with honest fallback for imported appointments lacking a source nomination. Office source links navigate to the exact request; Lecturer and Coordinator assignment hosts offer read-only source details with a return to the appointment.
- SupervisorApprovalHistory uses supplied matching Office/Coordinator evidence or lazily reads the existing authorised Supervisor application endpoint for Lecturer details. It verifies application/student/appointment identity, cancels stale reads and supports retry without blocking current team content. No new endpoint, migration or permission changes are required.
- A real fieldset box preserves the disabled-state boundary while allowing the shared 28px gap between management and history. Semester dates are outside the appointment columns.

## Request lifecycle sidebar repair (27 October 2026)

SupervisorRequestDetail and PanelRecommendationDetail render their administration slot inside the review sidebar instead of after the content grid. A sidebar can still render for a lifecycle-only record without an invented approval process. Office/Coordinator request hosts use the existing compact appointment card variants, including shared Panel reviewer hosts. No API, permission, capacity or lifecycle-service changes. CoordinatorSupervisorApprovals passes CoordinatorApplicationLifecycle through SupervisorRequestDetail.administration, retaining the same reasoned ending callback and busy guard. Regression coverage mounts the actual Coordinator route with an isolated detail API response rather than only composing the shared components.

## Supervisor capacity reservation design (27 October 2026)

28 October follow-up review: StudentSupervisorAppointment derives Office-managed replacement identity from both Office provenance and predecessor linkage, separately gates ordinary recovery, and keeps backend authorization unchanged. SupervisorRequestDetail maps null/missing policy and restricted states to explicit availability labels while retaining actual workload counts. The publication regression suite distinguishes unaccepted submission from accepted primary reservations rather than preserving the superseded rule. Fresh review evidence: `docs/SUPERVISOR_CAPACITY_REVIEW_2026-10-28.md`.

28 October warning refinement: LecturerAppointmentRequests passes the existing warning AlertMessage as the last-place DecisionDialog message, with a title, icon and two short paragraphs rather than a long plain-text explanation. Dynamic other-request count and request-specific capacity remain authoritative. Shared dialog behaviour, supporting nomination copy and backend enforcement are unchanged. The mounted browser regression checks distinct warning treatment and a concise text budget at desktop/phone widths.

Implemented 28 October. Shared capacity counts also govern reconciliation preview/activation; automatic closure is part of its activation transaction. The resolver preserves its original bounded query count using joined role eligibility and UNION ALL for active primary/supporting row counts. Closure caches resolutions by effective policy semester while holding the existing locks. Missing active-semester projections retain global reservations and NOT_CONFIGURED rather than fabricated availability. Primary confirmation uses the fetched Student identity; supporting confirmation retains its distinct non-reserving semantics. Verification: `docs/SUPERVISOR_CAPACITY_RESERVATIONS_2026-10-28.md`.

Extend the shared authoritative capacity resolver and batched publication projections to count primary Supervisor applications in PENDING_COORDINATOR as reservations. Keep active primary/supporting counts separate. Acceptance and final approval use the existing semester-policy, Student/request and Lecturer locking order, with own-reservation exclusion only for the request being converted. Existing accepted requests participate immediately; no bulk status rewrite or appointment removal.

The agreed primary request API adds optional acceptanceCapacity with activeLoad, reservedLoad, limit, availableSlots, pendingRequests and state using that request's effective semester/reassessment policy. Candidate/workload capacity metadata exposes separate active and reserved counts. A dedicated terminal CANCELLED_CAPACITY_FULL status reuses cancellation reason/time and records SYSTEM_CLOSE_CAPACITY with the real triggering approver and explicit system attribution. Closure runs in the final activation transaction, checks each remaining unaccepted request's policy against active workload, preserves accepted/higher-limit/archived/unconfigured requests and emits deduplicated workflow notifications. Frontend adaptations reuse the existing decision dialog, request detail, status/history and cancellation flows; no new navigation or dependencies. Implementation and verification are tracked in the 27 October reservation plan and PROJECT_STATUS.

## Coordinator dashboard access presentation (27 October 2026)

CoordinatorDelegations retains its existing data loading, refresh and Office management behavior. A separate read-only CoordinatorProgrammeSummary renders regular programme context, conditional active/scheduled cover and collapsed expired/revoked history. Additional effective access remains visible if grant metadata is unavailable; no authorization or API changes.

## Shared workload detail presentation (27 October 2026)

WorkloadDetailLayout provides shared section, lecturer metadata, fact and capacity presentation for SupervisorWorkloadDetails and PanelWorkloadDetails. Existing records, configured checks and utilization helpers remain authoritative; Panel reservations and Supervisor primary/supporting counts stay distinct. Missing plans do not render fabricated availability or utilization. Existing list filters, exports, API reads and RecordPage navigation are unchanged. Production-CSS browser verification covers populated/empty/missing/zero-capacity/long-content states at desktop and phone widths.

## Final appointment consistency review (27 October 2026)

StudentSupervisorsOverview reuses SupervisionPerson for active supporting appointments, consuming the existing public contact projection. No endpoint, dependency or permission changes in this final adjustment. Appointment presentation and scoped projection changes are committed separately from unrelated Office/admin and carryover work in the shared checkout.

## Supervisee Panel detail presentation (27 October 2026)

LecturerPanelAppointments hosts a selected supervisee in RecordPage independently of the module list/tabs. The student host is unmounted while the nomination form or exact submitted request occupies the record surface. PanelSuperviseeDetails reuses PanelStudentOverview, PanelResearchDetails and SupervisionPerson, with a consistent nomination aside and five-record completed-history pages. Pending requests appear once in the nomination aside, not in completed history. Existing shared authenticated list state preserves roster filters on return. StudentResearchProfileSerializer adds currentPanelDepartment, currentPanelEmail and currentPanelAppointmentDate from its already-cached active Panel appointment, using existing eager-loaded relations. Ended appointments return null for those fields; the eligible-supervisees authorization and active-primary-supervisor scope are unchanged. No database migration.

## Nomination records consistency correction (27 October 2026)

Removed the nomination-only compactFilters and ongoingLabel extensions. PanelNominationRecords uses the standard PanelBrowse filters and RequestViewSwitch without a disclosure or custom terminology.

## Dedicated Lecturer nomination records (27 October 2026)

PanelSuperviseesWorkspace now renders only the roster and a records navigation callback. LecturerPanelAppointments uses panelRecords=1 within the supervisees section to host PanelNominationRecords through RecordPage, hiding the workspace navigation while retaining authenticated ListState. Existing submitted routes open this page too. The records host is unmounted while a selected request occupies RecordPage, avoiding competing record pages; the request Back label identifies Nomination records. Loading/error/retry remain explicit. PanelBrowse's opt-in compactFilters and ongoingLabel preserve all standalone consumers' defaults. Compact filters retain active secondary controls and expose them in a disclosure. No backend or authorization changes.

## Panel supervisee list workspace (27 October 2026)

PanelSuperviseesWorkspace composes the existing roster and nomination browser in one card. Optional embedded presentation on PanelSuperviseeRoster and PanelBrowse avoids nested card shells without changing standalone consumers. The authenticated ListState context retains the selected view and each browser's filters/history/pagination when its sibling is displayed. No API, permissions or nomination workflow changes.

## Lecturer Panel assignment academic team (27 October 2026)

The exact authorised Panel appointment endpoint optionally serialises academicTeam with only current primary/supporting name, email, department and appointment date. List payloads remain unchanged and incur no new team queries. PanelAssignmentDetail fetches the exact appointment when list data lacks the projection, guards identity and stale responses, and preserves Retry/Back. It reuses SupervisionPerson/ContactDetails; shared staff recommendation and appointment hosts retain their current presentation. Historical Panel status is distinct from current supervisor context.

## Supervisor team contact hierarchy (27 October 2026)

SupervisionPerson and SupervisionContactDetails provide shared role/member and contact layouts inside the existing staff supervisory-team card. Primary/supporting members share an undivided group; Panel evaluation uses a single 24px-spaced boundary and an action row after its details. The authorised team response now includes primaryAppointmentDetails for staff as well as Students; supporting appointment supervisor projections include only public email and department in addition to existing identity. Related lecturer/semester data is selected with the parent query. No access checks, staff identifiers, workflow payloads or database schema changed.

## Supervision team actions and nomination form (27 October 2026)

SupervisionMember renders supplied actions beside its section label. Supporting nomination uses the same heading/action arrangement. The shared co-supervisor form uses a white surface, student/primary-supervisor context, normal-case field labels, larger justification and an explicit Cancel/Submit footer. Existing state, API payloads, draft protection and eligibility checks are unchanged.

## Stable appointment tab layouts (27 October 2026)

Lecturer Supervisor and Panel request summaries are independent of the Requests/History selection. Supervisor request/research guidance stays outside the view partition. Removed the history-only duplicate outcome count above Supervisor filters. Existing Student, Office and Coordinator list shells, research filters and separate Marks history navigation are retained. Mounted browser regressions compare filter/tab coordinates across Requests/History at desktop and phone widths.

## Supervisor request empty action divider (27 October 2026)

Lecturer and Coordinator request callers pass no action node when neither a decision nor an eligibility notice is available. This prevents the shared review card from reserving a bordered empty action section.

# Architecture and Coding Design

## Panel overview action removal (27 October 2026)

StudentPanelAppointmentOverview no longer accepts or renders an approved-nomination action; remove its host callback. Existing saved public record links remain readable with their existing access and exact-record guards. No backend changes.

## Student Supervisor navigation correction (27 October 2026)

Restore SupervisorWorkspaceNavigation in the shared Student page header on overview, applications and research-list routes. Keep exact request/form/detail navigation behaviour unchanged. Remove the replacement relatedLinks node and prop from StudentSupervisorsOverview; preserve the shared appointment card, public metadata and header source actions. Regression checks assert all three tabs remain across workspace views and that the overview tabs precede the card without duplication.

## Revised shared Student appointment card and safe source projection (27 October 2026)

StudentAppointmentLayout now controls only the shared content/aside composition; it no longer renders floating academic context or actions. StudentAppointmentCard reuses SupervisionDetailSection/SupervisionMember for both overview cards with the same header action and department/email/date/semester/programme grid. StudentSupervisorsOverview consumes optional primaryAppointmentDetails; backend serialize_team adds this whitelisted field only for Student callers and derives it from the active primary appointment. Existing staff DTOs and authorization remain unchanged. Related application/research links move into the overview card; navigation on other Supervisor pages is preserved. Panel removes the manual-refresh control while keeping useReturnToFocusReload, loading, error and retry.

StudentPanelAppointmentSerializer adds an explicitly typed approvedRequest projection containing only id, nominatedBy, submittedAt, panelAcceptedAt and approvedAt. It is populated only from the current active appointment's approved recommendation; pending/no-appointment responses return null. The Student component opens ?panelRequest=<id> through RecordPage, checks exact ID plus dual confirmation, and preserves other query state on open/back. Invalid/obsolete references show an unavailable state, and loading/failure retain the record header/back/retry. It never calls staff nomination endpoints or exposes justification, reasons, private workflow or staff numbers. Dates are genuine recorded values with honest missing-data presentation; no historical research snapshot is fabricated. Optional frontend types maintain compatibility with absent legacy metadata. No schema or dependency changes.

## Shared Student appointment overview and source-request navigation (27 October 2026)

StudentAppointmentLayout supplies a compact Academic context section, a main reading column and a 20rem next-step aside at xl, stacking with 28px gaps on smaller screens. StudentAppointmentNextStep reuses SupervisionDetailSection and the established 12px labels/14px regular answers/16px section headings; both overviews use SupervisionMember and the existing full current-research reader. StudentSupervisorsOverview receives optional pending-request/FAQ content through the existing workspace host, keeps supporting appointments/history and places the existing approved-request action next to the primary supervisor. The approved source remains selected by APPROVED plus ACTIVE appointment lifecycle; existing exact-record routing and return navigation are preserved. Panel retains dual confirmation, prerequisite links and refresh/error recovery. Supervisor guidance skips requirement API reads once appointed or awaiting a decision. Compact current-request, approved-application and New application actions use 44px minimum targets.

Only the student_panel_appointment_payload projection changes in the backend: panelMemberId is always null, preserving response shape while withholding the internal staff number. Staff serializers, authorization, models and migrations remain unchanged. Regression coverage includes real student API privacy, existing authorization/waiting/link checks, full production-component browser navigation against controlled HTTP responses, all readiness states, replacement/legacy source requests and responsive geometry. Browser fixtures use actual components and production CSS; no live academic writes are required.

## Panel nomination presentation/accessibility — Phase 4 (27 October 2026)

RecommendPanelMemberDrawer remains the existing RecordPage-backed form and uses PortalCard, SupervisionDetailSection, PanelDetailFact, ResearchAbstract, PortalButton and StatusBadge. The form separates student identity from editable nomination details and a 20rem current-research aside at xl; smaller screens stack with 28px gaps. The full abstract is initially collapsed. Existing candidate/notes/replacement and operational-intake state/guards retain their payload contract. The input-focused combobox exposes a generated listbox/option ID pair, active descendant and selected/disabled state; arrow keys cycle selectable candidates, Enter chooses without submitting while expanded, Escape/Tab/outside click close, and Remove selection returns focus. Selected candidates refresh from authoritative props. Removed redundant candidate decoration/status panels and local motion without changing dependencies. PanelBrowse, PanelAssignmentsWorkspace and PanelSuperviseeRoster keep shared filter/list architecture and add exact named/touch-sized record actions; no global styling, API, backend or schema changes. Production-CSS mounted regressions cover real form events, public HTTP boundaries and responsive layout; existing feedback fixture uses semantic listbox selection instead of the former fixed popup ID.

## Student Panel overview presentation — Phase 3 (26 October 2026)

StudentPanelAppointmentOverview composes existing PortalCard, SupervisionDetailSection, PanelDetailFact and standalone StudentResearchProfileSection primitives. The public StudentPanelAppointmentView remains the only data contract; both CONFIRMED status and readiness are required before rendering member/contact/date fields. The page uses the shared 28px gap and xl main-plus-20rem guidance aside, regular 14px answers and 18px research title. Explicit fact rendering avoids spreading staff data into the Student view. The existing API loader, retry and focus reload remain; Refresh appointment now connects the existing optional callback and respects its busy prop. No backend, schema, API, dependencies, staff presentation or global styles change. Scoped mounted browser checks cover every readiness state, exact callbacks/navigation, loading/retry/refresh, missing data, full long research, geometry and private-field suppression.

## Panel appointment detail presentation — Phase 2 (26 October 2026)

PanelDetailLayout.tsx supplies small presentation-only student overview, member, research and fact components using existing PortalCard/SupervisionDetailSection typography. PanelAssignmentDetails.tsx composes these into an xl main-plus-20rem lifecycle aside and mobile stack, retaining nomination/review evidence in a disclosure. PanelAppointmentRecordCard adds an opt-in compact branch; its default request attachment remains unchanged. Lecturer PanelAssignmentDetail uses the appointment composition and existing Marks callback. Office selects it only for explicit appointment-* routes; recommendation-* stays on Phase 1, and profile-* uses the refreshed attention overview. Coordinator assignment-section records opt into the appointment presentation in the existing scoped review host, with request decisions disabled there. Supervisor PanelSuperviseeDetails reuses overview/member/research surfaces with a separate pending nomination aside; roster/list/query behaviour is preserved. No backend, schema, API, dependency or shared global-style change.

## Panel request detail presentation — Phase 1 (26 October 2026)

PanelRecommendationDetail in PanelRecordDetails.tsx now composes the existing PortalCard, SupervisionDetailSection/typography, ResearchAbstract, ApprovalProcess, RequestDetailActions and RequestAuditHistory primitives. Caller-owned context/decision/administration slots and existing presentation adapters remain unchanged. Nomination/replacement evidence precedes current profile research; review uses the same xl main-plus-20rem column and mobile stack as Supervisor details. PanelRecommendationReviewDrawer reuses PrimaryRequestDecisionButtons with Accept request / Approve request and Reject request, retaining its existing capability predicates and DecisionDialog callbacks. Read-only records do not render an empty decision strip. PanelAppointmentRecordCard is unchanged; its sibling attachment remains separate. No backend/API/schema/dependency or global typography changes. Regression coverage adds shared layout/role tests and production-CSS mounted browser scenarios for all staff callers, dialogs, replacement and historical states, long content and responsiveness.

## Phase 3 research-change presentation (26 October 2026)

ResearchChangeRequestDetail is a pure shared renderer fed saved ResearchAmendment evidence, derived approval steps and caller-owned actions/navigation. It reuses SupervisionDetailSection and existing sidebar decision primitives. RequestedChangesComparison distinguishes request proposals/approved snapshots while preserving revision-history labels. ResearchAmendmentForm retains API payloads/capabilities and uses an optional local preview; no backend/schema/dependency changes.

## Phase 2 research profile and Registry handoff (26 October 2026)

ResearchProfileDetail.tsx renders only current profile values using existing options/revisions, independent PortalCard surfaces, the Phase 1 section/typography primitives and unboxed ResearchAbstract text. Student identity is selected by the current profile student ID; programme appears once. Current-update metadata requires exact revision number, explicit matching student ID and matching saved programme/title/abstract; missing or unrelated metadata is omitted. ResearchProfileHistoryCard remains separate and exposes compact newest-first revision summaries, while individual ResearchRevisionCard disclosures preserve the existing immutable RequestedChangesComparison content. The profile host loses its outer catch-all card and duplicate identity row; other route presentations stay unchanged.

ResearchCreationKind and a validated changeType query parameter select existing correction/transfer/research form intent. Office links preserve the selected Student User ID and query/state context; form initialization only accepts a permitted kind and includes intent in the reset key/draft baseline. No new authorization or mutation service is added. Existing old URLs/default creation continue working. Registry relocation is documented in docs/PROGRAMME_TRANSFER_REGISTRY_HANDOFF_2026-10-26.md and remains a later integration. Production-CSS browser fixtures exercise all four roles, responsive geometry, explicit action callbacks, saved disclosures, selection changes, metadata gaps, read failures/retry and long content.

## Record navigation button presentation (26 October 2026)

Reuse PortalButton's existing primary variant rather than adding a global style. ViewStudentRecordAction supplies the UserRound icon and small dark button for shared detail pages. Remaining direct student-record actions in Supervisor, supporting request, Panel, Marks and report surfaces use the same primary variant/icon, preserving caller-owned navigation, accessible labels and existing 44px mark-record touch targets. Staff and Student approved-application actions use the FileText icon. Existing production-component browser fixtures now exercise the real shared student action and check dark background classes, white computed text and icons across roles and responsive widths.

## Supervision-to-application navigation (26 October 2026)

Detailed staff team projections add an optional nullable approvedApplicationId, derived from the active primary appointment's approved application and existing application-read permission. Student-safe and roster projections do not gain private application evidence. The unchanged can_view_supervisor_application policy moves from views.py into request_visibility.py and is reused by the detail endpoint and navigation projection. No schema change is needed.

SupervisoryTeamRouteContent renders the document action only when the projection grants it and navigation is available. The callback passes through the existing Lecturer, Coordinator and Office hosts; Office uses its request-ID route prefix. App.tsx records the exact supervision page, query and history index as the return target and supplies the Lecturer request back label. The Student overview retains its existing own-application lookup and navigation, with the clearer shared action label. No submitted evidence is duplicated or substituted for current research.

Tests cover exact approved-record selection, pending replacements, supporting-supervisor privacy, ended/nonapproved/missing cases, current-student matching, busy actions and callback IDs. Authenticated browser checks exercise all four roles opening the application and returning to their original URL with query context.

## Shared detail sidebar actions (26 October 2026)

`RequestDetailActions` in `RequestDetailPrimitives.tsx` scopes full-width, 44px minimum-height, 12px normal-case button presentation and vertical action grouping to detail sidebars. `SupervisorRequestDetail` wraps caller-owned review actions; `SupervisorAppointmentRecordCard` opts in only for its compact Phase 1 presentation. The global `PortalButton`, default historical appointment layout, role gates and decision dialogs remain unchanged. Lecturer decisions gain check/cross icons and a danger rejection treatment; Coordinator approval precedes rejection with the appropriate approval icon. `PrimaryRequestDecisionButtons` owns the identical primary/danger pair for Lecturer and Coordinator. `CoordinatorPrimaryRequestActions` preserves caller-provided pending, eligibility and busy rules and delegates unchanged decision callbacks. Rejection keeps its accurate Reject request label while its dialog is open. Existing browser fixtures now measure action width, height, typography, spacing and overflow at desktop, tablet and phone widths, using actual action renderers for both roles rather than placeholder Coordinator buttons. A static render-parity regression allows only Accept request/Approve request wording to differ.

## Phase 1 supervision detail composition (26 October 2026)

`SupervisionDetailLayout.tsx` supplies presentational section, overview, team-member row and research-card components. Full staff detail in `SupervisoryStudentDetailCard` composes these with its existing capability-gated supporting/Panel controls and a desktop xl side column for appointment metadata and activity. The legacy collapsible team presentation remains supported. `SupervisoryTeamRouteContent` supplies the existing appointment renderer through a management slot and opts into its new `compact` presentation; default historical records retain identity and lifecycle facts. Primary replacement controls are only supplied when the existing Office/active/pending-replacement-or-change-capability conditions yield visible content. This prevents empty action strips and keeps equivalent-capability cards identical across staff roles.

`StudentSupervisorsOverview` uses shared team/research surfaces and exposes only the existing sanitized own-team/past-supporting summary. Its previous catch-all outer section is removed to avoid cards inside cards. `StudentResearchProfileSection` gains an opt-in standalone card presentation; its default Panel overview path is unchanged. The `plain` supporting-member/Panel presentation flags affect layout only. Hooks, APIs, server capabilities, dialogs, workflow and data ownership remain unchanged; no dependencies or schema changes are introduced.

Tests cover pure role-controlled layouts, preserved lifecycle details, Student privacy, desktop/mobile geometry, pending replacements, busy controls, saved histories, missing profiles/Panel records and long content. Authenticated local Chrome captures exercise the actual running portal for all four roles with existing approved demo records; no new academic record or decision is created for Phase 1.

## Supervisor request detail surfaces and local preview (26 October 2026)

`SupervisorRequestDetail` remains the shared renderer for all four role callers. A full-width student overview precedes a responsive grid: the main column contains separate research, grouped Research Intent, and documents/declaration cards; the other column contains Review and outcome. The grid switches to one column below the existing xl breakpoint. No catch-all Application details wrapper, global typography change, new dependency, API contract or permission change is introduced. Muted 12px labels and regular 14px answers remain; the research title receives its own regular 18px reading line.

Submitted Research Intent accepts an optional semantic heading level so the separated card has an h2 while other consumers retain their defaults. Existing exact-application hooks, immutable submission identity/provenance, historical/error/retry states, Office replacement distinctions and caller-owned actions remain. Browser geometry checks now cover 1440/1024/390px, including the side column, stacked layout, no overflow, heading alignment, and all four role adapters.

The explicitly requested persistent preview is local data rather than a runtime fixture or production seed feature: request #11, fictional Aina Sofea Rahman (Demo), DEMO-UX-2026-001. A guarded temporary script used the configured demo student password, normal JWT sign-in and the existing multipart submission endpoint/validation; there was no forced authentication, direct status override, security relaxation or existing-record rewrite. Two ReportLab PDFs were validated with pypdf and visually rendered with Poppler. An isolated Chrome profile used normal Student/Office sign-in to capture the running Vite/Django portal at 1536/390px; these sessions were logged out afterward. No credentials are written into repository files. Office detail links use `/supervisor-appointments/request-11`; Student/Lecturer use `/supervisor-appointments/11` under the existing route contract.

## Shared Supervisor request detail composition (26 October 2026)

SupervisorRequestDetail remains the single presentation used by StudentSupervisorAppointment, LecturerAppointmentRequests, CoordinatorSupervisorApprovals and SupervisorAppointmentManagement. Its overview resolves identity from the existing exact-application Section A snapshot when present and explicitly labels the submission-time source; NRIC and passport labels retain the saved identity type. Two primary PortalCards contain application evidence and review/outcome; caller-owned context, decision and administration slots retain authority. SupervisorRequestFields provides scoped read-only field and native disclosure styles. Submitted Section A courses and declaration are separate composable renderers so title ownership belongs with research rather than course evidence. Existing exact-application hooks, fallback provenance, read failures/retries and stale-response guards remain authoritative.

SupervisorResearchIntentSection supports an embedded mode without an extra card, with three independently expandable groups and an expand/collapse-all action; the existing editor and flat review renderer retain their defaults. ApprovalProcess accepts a heading level for correct nested review/step semantics. No schema, API, permission, global typography or dependency change is required. Isolated production-component browser checks cover four role adapters, snapshot fidelity, disclosures, state/retry/stale-response cases and desktop/phone geometry; they do not replace backend authorization or full-shell acceptance.


## Shared icon heading layout (26 October 2026)

`frontend/src/components/IconHeading.tsx` provides a two-column CSS grid: decorative icon and semantic heading in row one, optional description in row two beneath the heading. It accepts the existing heading tag/id and typography classes, and handles icon-free headings without a spare column. RequestSection, AppointmentSection and OfficeToolSection use it, as do affected Registry import/registration, staff role, settings, letter editor, student dossier and Marks setup headers. Already centred single-row headers keep their existing composition. No global SVG offsets, font changes, dependencies or backend changes are introduced.

A dedicated isolated browser harness bundles the production React components and compiles the production Tailwind styles, measures title/icon centres and checks subtitle/overflow/action placement at exact iframe widths. It uses synthetic content, static settings header rendering (no account API effects), an ephemeral loopback server and temporary Chrome profiles. Google font loading is omitted in this isolated test to use the declared system fallback deterministically; production fonts are unchanged.


## Admin profile ownership protection (25 October 2026)

The shared ProfileOwnerAdmin base serves Student, Lecturer and OfficeStaff: the owning User is read-only on existing records and posted ownership changes are checked before Django binds/saves its ModelForm. This prevents changing a shared primary key from overwriting another profile's protected lifecycle metadata. Add remains owner-selectable and ordinary permitted fields remain editable. Real admin HTTP regressions cover both lifecycle overwrite cases, Office staff identity, crafted/ambiguous ownership POSTs, valid maintenance, valid creation, duplicate-add preservation and parent-bound User-page inline rejection. Nine permanent ownership regressions run alongside existing account/admin boundary tests. No model schema or portal workflow redesign is required.


## Office business authorization separation (25 October 2026)

Shared `accounts.authorization.office_actor` now replaces staff coupling in participant lifecycle, delegation, research/transfer, reassessment, Office browse/attention/export and Marks configuration/completion/closure checks. `can_correct_marks` resolves explicit user/group grants and gates both API capabilities and direct submitted-Marks services. `config.admin.TechnicalAdminConfig` selects `TechnicalAdminSite` without losing registered models; its login form and request gate enforce the same technical account rule. Research profile Add is removed through the existing read-only workflow mixin.

Portal account forms reject admin flags. Guarded demo setup creates non-admin Office accounts with the explicit correction permission. `separate_office_admin_access` previews by default and applies only after verifying technical recovery access and rejecting mixed-role superusers, preserving passwords/permissions under account locks. No schema/dependency/UI relocation was added. See `docs/OFFICE_ADMIN_SEPARATION_2026-10-25.md` for tests and the blocked local restart/conversion sequence.

## Carryover and semester handover real HTTP acceptance (25 October 2026)

The opt-in `appointments.carryover_browser_journey` uses disposable LiveServerTestCase fixtures and exact 1440/390px iframe viewports. Production CapacityReassessments and SemesterActivationSection components/services use authenticated ephemeral Django HTTP. Separate fixtures exercise all three reassessment request kinds and an expired outgoing semester with a submitted entry, Panel draft and completion window. Database assertions compare retained original application and Marks/task/window/audit rows, record reassessment consumption actors/policy, and verify semester/period transition audits. No runtime, schema, dependency or live-clock changes; browser bundles/profiles and runner databases are disposable.

## Acting delegation real HTTP acceptance (25 October 2026)

The opt-in `accounts.delegation_browser_journey` follows the existing isolated LiveServerTestCase/production-component pattern. Exact 1440/390px iframe journeys cover Office management, effective scope, supporting approval, stale revocation and queue focus refresh. Scheduled/end-date/expired reads patch only the delegation calendar-date function in the disposable test process. Final database snapshots preserve original academic/Marks rows; workflow actors and unchanged grant history are asserted separately. Real authenticated XLSX responses are parsed to verify regular/delegated/unrelated record inclusion and absence of Marks sheets. Test JWTs stay in memory, browser artifacts are removed from verified temporary paths and Django destroys test databases/clones. No runtime, schema or dependency change; see `docs/DELEGATION_ACCEPTANCE_2026-10-25.md` for evidence and limits.

## Research and transfer real HTTP acceptance (25 October 2026)

The opt-in `appointments.research_browser_journey` LiveServerTestCase uses the established supporting-journey isolation pattern with synthetic primary/supporting/Panel relationships, submitted and draft Marks, and an approved completion window. The production ResearchAmendments component and services execute cancellation/rejection/approval, sequential transfer acknowledgements and stale-tab recovery against real ephemeral Django HTTP. The runner asserts exact 1440/390px iframe widths; test JWTs remain in memory and temporary browser artifacts are cleaned up. Final row snapshots verify unchanged applications, appointments, Marks/windows/audits alongside exact research/transfer outcomes, revision counts and decision actors. Existing API/lifecycle/concurrency/migration regressions remain separately identified evidence. No runtime, schema or dependency change; see `docs/RESEARCH_TRANSFER_ACCEPTANCE_2026-10-25.md`.

## Supporting supervision real HTTP acceptance (25 October 2026)

The opt-in `appointments.supporting_browser_journey` module follows the existing Marks LiveServerTestCase approach. It refuses fixture setup outside a `test_` database, reuses synthetic lifecycle fixtures, provisions candidate eligibility before publishing immutable capacity policy and snapshots primary/Panel/research/Marks tables. The Node runner bundles production SupervisoryTeamManagement/services with esbuild, proxies only to an ephemeral loopback Django server and uses exact 1440/390px iframe viewports with explicit innerWidth assertions. Short-lived test JWTs remain in memory; bundles/browser profiles are removed from verified temporary paths. Post-browser database assertions check nomination/appointment actors, states, audit counts, replacement lineage and complete retained-record equality. Existing API/lifecycle/concurrency suites run separately alongside this journey. See `docs/SUPPORTING_SUPERVISION_ACCEPTANCE_2026-10-25.md` for the scope and remaining combinations. No runtime, schema or dependency change.

## Lecturer write versions and atomic submission (25 October 2026)

EvaluationTaskSerializer exposes an opaque writeVersion derived from the task identity and the entry status, timestamps, total, comments, scores and component feedback. Public PUT draft and POST submit payloads require expectedVersion. Existing task/semester/period lock ordering is retained; compare fresh entry state under lock before any mutation. Missing versions return 400, stale versions return 409. Internal submit_entry remains available for existing locked domain operations; the public submission endpoint now uses MarkSubmissionSerializer to validate and atomically save/lock its complete payload.

MarkSubmissionReceipt stores a task-scoped submission UUID, canonical request HMAC and resulting entry-version HMAC. A unique task/UUID constraint and task lock serialize repeats. An exact receipt returns the already committed entry; mismatched payloads, corrected/reopened entries and outdated submissions cannot write. Receipt model/queryset guards prohibit updates, overwrites and deletion. Migration 0011 adds only the receipt table. There are no new dependencies or retained raw payload snapshots.

marksApi sends expectedVersion and performs one POST for submission. MarkEntryDetail retains a UUID in memory for each unchanged reviewed payload across a failed response, creating a new reference after edits/version changes. Draft conflicts preserve input, disable Save/Submit and offer an explicit latest-record load with a replacement explanation. Reload failures keep the local values. Existing confirmation, dirty navigation and read-only record behaviour remain. Existing API test fixtures now explicitly supply current versions/full submission payloads, retaining their prior business assertions. PostgreSQL concurrency tests cover draft races, distinct submissions and duplicate identical submissions. The real HTTP browser proxy injects one gateway failure after the backend commits to verify safe retry end to end.

## Real HTTP Marks acceptance journey (25 October 2026)

The opt-in `marks.browser_journey` LiveServerTestCase creates only fictional users/appointments in Django's disposable test database. Its Node runner builds the acceptance fixture and proxies actual authenticated API calls to an ephemeral loopback Django server; production LecturerMarksEntry, MarkEntryDetail, history and Office records components perform the marking journey. JWTs for disposable users are passed through standard input and kept in memory, without fetch mocks or development-DB writes. The runner rejects development ports and removes its temporary browser profile/bundle. Normal test discovery does not require the optional browser runtime. Office list submission dates now use timezone.localtime, matching lecturer date labels. Reproduction and test boundaries: `docs/MARKS_JOURNEY_VERIFICATION_2026-10-25.md`.

LecturerMarkingNavigation renders a subtle numeric badge only when a known count is positive, with a visually hidden descriptive count. Queue and history count calculations and role navigation are unchanged.

## Lecturer marking bug review (25 October 2026)

`marksApi` builds write payloads exclusively from the rubric editor's canonical components. Legacy score/feedback aliases remain response projections for compatibility and never override edited values. Successful explicit conflict reload returns the refreshed task to MarkEntryDetail, which replaces its scores/comments and dirty baseline in place; preserving the mounted record page also preserves its transient browser-history entry. Ordinary draft saves retain the editor's local input. The common EvaluationTaskSerializer exposes the raw submittedAt instant and formats the older submittedDate label in the configured Malaysia timezone, so queue and history details use the same date source. Regression tests exercise real API normalisation followed by edits/saves/submission, browser conflict recovery and the UTC/Malaysia midnight boundary. No schema or authorization changes.

## Read-only lecturer submission history (25 October 2026)

GET /api/marks/my-submitted-evaluations/ filters submitted entries by the authenticated lecturer across assignment lifecycles; it performs no task generation. SubmittedEvaluationSerializer retains the existing score/comment payload and adds an ISO submittedAt, assignment lifecycle, evaluation-period and rubric identity. It explicitly returns canEdit=false and canSubmit=false without running editable-task/completion-window eligibility logic. Queries select/prefetch related records and order by submitted timestamp descending with nulls last and stable task-ID ties. The active task API and write guards remain unchanged; no schema migration or dependencies. Normal handover/pause/retirement services already preserve submitted tasks. The dedicated history query also covers legacy non-active submitted records and removes the active-feed dependency; it does not alter those lifecycle services. Scores and comments come from the retained entry, with identity/research labels from the retained profile; this change does not create immutable profile snapshots.

MarksEntryHistory owns its authenticated history read and loading/retry state instead of receiving the active queue. It reuses role navigation, including historical backup marking, and shared automatic filters. Filter/sort helpers compare actual timestamps and inclusive Malaysia dates, keeping unknown dates last and excluding them only when a date constraint is active. A record opens the existing SubmittedMarkDetail in read-only mode. History-only navigation never calls the active-task generation API. Phone rows keep View submission visible; selected role and filters survive detail return. Backend tests cover ownership, lifecycle retention, GET-only/no-write behaviour and unchanged retired-task write guards; frontend/browser tests cover independent reads, role/date filters, ordering, failures and responsive record return.

## Lecturer role-scoped marking workspace (25 October 2026)

LecturerMarksEntry derives role-scoped tasks from the existing authenticated task response using lecturerMarking helpers. The markingRole selection uses authenticated-shell useListState; primary role navigation reuses the Supervisor/Panel presentation without nested status tabs. Both official roles remain available, with a conditional backup view and a first-load preference for an assigned role. Legacy payloads without evaluatorRole retain the established Panel interpretation. Summaries use role plus semester, while navigation unfinished counts cover each complete loaded role queue. Filters apply immediately inside PortalCard; stable task IDs retain separate period assessments. A nonmutating sort puts unfinished tasks first and orders each group by actual deadline, retaining original order on ties. Loading and read errors never manufacture zero totals.

Submission history receives only the selected role's task collection and an explicit role context. Its filters and results share a card. This does not change the existing active-task API or extend historical backend coverage. MarkEntryDetail and SubmittedMarkDetail display role context; draft save success updates the local task, keeps the mounted editor and resets its local dirty baseline after the awaited save succeeds. Errors preserve input and dirty tracking; navigation and submission confirmation guards remain authoritative. Phone task rows reuse the portal responsive table pattern, stacking identity/research and keeping due, status and the action visible without horizontal scrolling; desktop retains the table. Restored history views render loading/error recovery before showing empty or submitted results. No backend/schema/global typography/dependency changes. Mocked browser coverage checks mixed roles, conditional backup, panel/backup-only first loads, empty roles, scope/counts, immediate filters, history return, successful/failed draft saves and narrow layouts.

## Evaluation period list and editor views (24 October 2026)

The empty list composes PortalCard and the existing EmptyState, matching the rubric workspace instead of rendering an informational alert. A derived emptyList flag moves the existing New period action from the header to the empty card and hides a heading with no rows or archive control. The same creation guard governs both placements. Return navigation focuses the named list region, which also exists when the decorative list heading is omitted. Shared components and global styles remain unchanged.

MarkEntryPeriodConfig uses local editorOpen state to switch between the existing period list and full-width configuration card; initial browsing and semester-only context show the list, while exact period context loads its saved configuration directly. New period, successful selection and saved-record replacement open the editor. Back to period list hides the editor without a mutation, retaining current local form state until another explicit selection or new-draft reset. Recipient preview runs only while the editor is open. Ref-based focus requests move to Period name for creation, the editor heading for selection and the list heading on return.

The existing getEvaluationPeriods(includeArchived || exactPeriodContext) list read remains authoritative. When that read excludes archives, a parallel inclusive read discovers archive availability; reuse inclusive list rows when already requested. Availability and visible list rows respect the incoming semester scope, and archives stay hidden until included even when an exact-link lookup needed inclusive reads. A failed workspace read uses the existing error/retry flow. No backend/API changes or new dependencies. Existing request-generation/context guards, saved-read recovery, locking, publication/closure/archive actions and validation remain authoritative. Fixtures cover list/editor navigation, archive availability/inclusion/read-only inspection, empty and archived-only states, lifecycle labels, direct links, keyboard focus and responsive layout, alongside existing semester navigation and save-recovery checks.

## Marks usability review (24 October 2026)

`LecturerMarksEntry` filters directly from its existing authenticated-shell search/semester/status fields using `filterMarkTasks`; obsolete separate applied-filter fields are no longer consumed. It and `MarksEntryHistory` reuse `WorkspaceFilterCard` and `PortalSelect`, inheriting the existing shared 10px labels and 12px values. Clear filters resets only list fields; view state and task record handling remain unchanged. List/history switching renders immediately without a Motion exit-animation gate; summary totals are hidden while lecturer assignments load or fail. The lecturer task list displays its actual shown/loaded count without nonfunctional page controls and renders dossier navigation only when its callback exists.

Marks overview, setup, checks, monitoring and subpages use shorter, state-specific guidance. Summary headers keep the decorative icon beside a wrapping label on narrow screens. Secondary monitoring follow-up/activity uses a native collapsed details element while counts, progress, record access and the record preview remain visible. Missing-ready-rubric and unavailable-submission explanations sit beside their blocked controls. Publication preview still identifies estimated recipients, automatic later eligibility, missing appointments and zero-recipient consequences. Locked-rubric guidance points to the existing clone action. Explicit field labels, table captions, column scopes and named focusable local scroll regions improve keyboard and screen-reader access without modifying shared primitives or global fonts. Office corrections/reopening, closure, backup, completion-window, save/submit and API guards remain authoritative. Browser fixtures cover empty/error/locked/read-only states, immediate lecturer filtering, reset/history navigation, score recalculation and cancelled submission. All reads and writes in those fixtures are fictional HTTP mocks, not authenticated end-to-end validation.

## Marks presentation composition (24 October 2026)

`MarkEntryRecords` groups its search, counted Status dropdown and visible programme/semester/evaluator fields in the existing `WorkspaceFilterCard` from `RequestWorkspacePrimitives`. Clear filters uses the shared action footer with no Apply action or submission form. The filter panel and results remain in one surface. It reuses `filterMarkRecordsByStatusTab`, existing local search/filter predicates, `useListState` and dashboard monitoring context. A restored legacy applied dropdown status is reflected in the single visible status selection until reset or another status is chosen. Counts use the same loaded-record scope as each status filter rather than the former active-only summary. Search, programme, semester, evaluator and status selection filter immediately from authenticated-shell field state and reset pagination. The former applied-filter object is read only as a legacy status fallback; its separate draft/apply state and success toast are removed. Clear resets list filters while retaining monitoring scope. Loading/errors display unknown counts. Student/record identity and status/submission metadata share cells in an eight-column table inside a named focusable scroll region. Empty states bypass table/pagination. Pagination reuses `pageWindow` and clamps restored page state after a successful load. Service reads, permissions, lifecycle badges and academic mutations are unchanged; no new dependencies or global styles.

`EvaluationTaskAssignment` uses two main `PortalCard` surfaces: combined period/generation and task management. Native `details` progressively reveals period metadata/readiness; session activity is a second disclosure inside the task card. The existing `WorkspaceFilterCard` contains visibly labelled Evaluator role and Task status `PortalSelect` controls, reusing the existing role/status state and immediate filtering. Role counts remain in dropdown options; submission counts remain compact text below. Clear filters uses the shared action footer and retains period scope. The grid stacks on mobile. The populated table combines student identity and evaluator role into their respective cells without discarding fields and scrolls in a named, focusable region. Empty results use a compact text block instead of wide table scaffolding. The backup assignment editor reuses two separate searchable `SelectMenu` fields, one for students and one for active lecturers, backed by the Office-only assignment-options endpoint's optional search mode; each returns up to 50 matches and a total count. Student results remain filtered by period programme scope. The fields sit side by side at desktop widths and stack on narrow screens; the shared picker portal keeps their menus from overlapping. The optional official-task link uses the already loaded task list. The editor separates assignment fields from reason/exception confirmation and uses the shared small-button style. The legacy endpoint response, generation/backup handlers, period targeting and authorization remain authoritative; no schema or dependency changes.

`RubricsManagementView` branches after loading/error handling: an empty library without an active creation form renders the shared `PortalCard`/`EmptyState` with `beginFamily`; the editor grid adds its family sidebar and desktop second column only when family groups exist. First-family creation reuses the existing form and mutations with focus moved to its family-code field. No service or rubric validation changes.

`buildMarksSetupChecklist` filters non-archived periods before aggregating generated/submitted task totals, matching the existing period-readiness and attention scope. Historical records remain available through existing record routes. `AlertListCard` presents “Evaluation checks” with a native router link to period configuration when no non-archived period exists. Overview summary selection is unchanged; single-period summary and broader setup/check scopes are explicitly labelled.

`MarksOverview.tsx` owns the Office overview's existing dashboard-summary, evaluation-period and rubric reads, formerly embedded in `App.tsx`. These independent reads run together when the overview mounts, with cancellation guards and explicit loading/error/retry. Static setup destinations and `MarkSubmissionMonitoring` remain mounted independently of metadata success; failed metadata shows neutral unknown statuses rather than fabricated empty totals. Existing selected/fallback period, active-rubric and operational-record scopes remain unchanged and are labelled separately.

`MarksPrimitives.tsx` supplies decorative Lucide icon tiles, semantic section headings and restrained summary cards. Clickable summaries use native buttons whose accessible names include their values. `SummaryCard` and the Lecturer summary adapter reuse this composition. The Office overview consolidates duplicate Quick Actions into three existing setup destinations and contextual record links, without adding tabs or changing routes.

`marksWorkspace.css` is imported after Tailwind through `index.css`, scoped to Marks roots and primarily placed in the components layer so explicit field utilities retain precedence and the portal base/component layer order stays intact. It aligns heading/label weights, form readability and control sizing without restyling other modules. Marks-specific form-label/control typography selectors explicitly exclude descendants of shared workspace filter panels, so those panels inherit the standard portal 10px labels and 12px field values at desktop and mobile widths. Shared filter panels use the same desktop padding, field gaps and action-footer spacing as appointment filter cards. The calculated total uses explicit readable dark text on the default PortalCard surface. Office and Lecturer editors, histories, submitted details, completion windows and record actions retain their existing handlers and guards.

Mounted fictional-HTTP fixtures in `marksVisualPolish` cover overview navigation, keyboard focusability, metadata failure recovery with independent monitoring, truthful empty states and responsive layouts, including input height, visible totals and icon/text clearance. Records cases additionally exercise automatic search/secondary filtering, status/reset, legacy filter memory, page clamping/bounded pagination, record/student navigation, retry and empty monitoring scope. `MARKS_SCREENSHOTS=0` skips optional Chrome screenshot capture while retaining every layout and interaction assertion. Existing Marks feedback fixtures exercise failed saves, retained input, refresh failures and retry boundaries. They do not constitute authenticated end-to-end or live-database validation.

## Past supervision record navigation review (2026-10-24)

LecturerSupervisionHistory keeps its list DOM mounted under a hidden/inert wrapper while the read-only RecordPage is shown, preserving the originating row for the shared record focus restoration. A local last-viewed reference follows the matching portalRecordPage history marker when browser Forward returns; academic payloads are not placed in router history. The existing list request remains paused during detail inspection. useCoordinatorPage now returns dataQuery alongside successful data. Cached rows stay mounted during same-query return refreshes, while changed search/filter/sort/page queries show loading until their own results arrive; stale-response generation guards are retained. This metadata is optional to consumers and does not change existing staff browse behaviour.

Mounted tests reproduce Back row-focus restoration, browser Back/Forward with retained filters, and delayed filters hiding obsolete actionable rows. The browser runner supports skipping optional screenshot capture while retaining all responsive interaction assertions, and disables browser background services in its isolated test profiles. No backend, API, schema or permission changes were needed for this review.

## Appointment lifecycle browse consistency (2026-10-23)

AppointmentViewSwitch is reused in the section headers of Office/Coordinator supervision, Office/Coordinator Panel assignments, Lecturer Panel assignments and Lecturer supervision. Existing lifecycle/view state and grouping remain authoritative. Its optional parent-owned focus request carries keyboard focus across current/past child remounts; the destination consumes it once without scrolling. SupervisoryTeamManagement accepts optional headerActions; other roles and detail views retain their existing composition. CoordinatorFiltersBar permits an optional all-programmes label for reuse outside Coordinator scope.

GET /api/appointments/supervisor/my-appointments/history/ is authenticated, Lecturer-only and read-only. It reuses the database-paged appointments_page projection with explicit own mode, filtering both SupervisorAppointment and CoSupervisorAppointment by supervisor=request.user and status=ENDED before facets, search, union and pagination. Existing staff history scopes and can_read_team are unchanged. No migration or model changes. LecturerSuperviseesWorkspace selects Past with the appointments=past query parameter. LecturerSupervisionHistory loads only while needed through the existing stale-response-protected browse hook, remembers account-scoped filters, and renders a read-only RecordPage summary from the authorised row without querying current teams/profiles.

Regression coverage includes isolated Django database tests for ownership, role/method boundaries, lifecycle/semester separation, pending nominations, role/date/semester filtering and bounded pagination; mounted StrictMode browser tests cover shared switch placement, Panel drilldown, filter reset, both supervision roles, read-only detail/return, failure recovery, stale responses, keyboard focus and narrow screens.

## Supervisor draft initialization (2026-10-23)

SupervisorAppointmentApplicationPage initializes saved work once per mount using its existing request-generation guard and account-scoped draft GET. The application fieldset and navigation/submission handlers are gated until initialization settles. Automatic hydration waits for student particulars when a saved draft exists, then shares resume logic with the explicit action. The existing silent step validator selects the first incomplete prior writing step and restores only valid prior completion markers; resume never skips the fresh Supervisor/documents step. Fingerprints normalize empty project-code entries and keep restored text clean. An initial read error completes initialization without applying a draft, so subsequent retries cannot hydrate over new work. Explicit restore/discard confirmations, no-store services and final live candidate/server checks remain unchanged. Automatic hydration reuses the parallel initial candidate/document reads rather than duplicating them, and changes the active step without scrolling past the page heading, restoration notice or progress. User-triggered step navigation retains its existing focus and scroll behavior. No backend, schema, API, dependency or global CSS changes. Mounted browser coverage runs real components under StrictMode with isolated HTTP responses at 1440/390/320px, including delayed draft/particulars, failed-read retry, clean navigation, incomplete steps and unavailable saved candidates.

## Capacity editor composition (2026-10-23)

OfficeCapacityWorkspace composes a single OfficeToolSection for editable drafts: version/comparison header, shared filters, scoped roster toolbar, existing responsive table/pagination, then a publication footer containing the existing readiness details and guarded publication trigger. Read-only version inspection retains its existing composition. Capacity-only CSS controls wrapping, spacing and visible menu overflow. The shared OverflowMenu accepts optional triggerLabel/disabled props; existing consumers retain their icon trigger, while capacity uses a named PortalButton with its standard chevron slot. Menu selection restores trigger focus before invoking the action, keeping keyboard position and modal return focus intact. Selection state, API commands, authorization, fingerprint checks, workload validation and publication behavior are unchanged. Mounted browser coverage checks grouping, publication order, current-page/all-matching/clear selection, menu bounds, keyboard focus and existing editing/confirmation flows.

## Bulk capacity draft command (2026-10-23)

PATCH /api/academics/capacity-plans/<id>/entries/bulk/ accepts strict explicit lecturer role patches, MISSING_ONLY/REPLACE mode and expected version/fingerprint. The service takes the existing semester/plan/entry/eligible-lecturer/role locks, validates all entries, then saves and audits only changed entries in one transaction using existing model validation. Invalid/ineligible/stale requests or storage failures cannot partially save; role changes and published/closed policies remain protected. CapacityBulkDialog uses DecisionDialog, CapacityDialogNavigationGuard and shared table/pagination/select controls for configuration and a paginated preview. capacityBulk.ts computes explicit patches, skips unchanged/unsupported roles, checks complete role configuration, flags obsolete saved limits for roles no longer held, and warns on publication minimums. OfficeCapacityWorkspace owns selection and updates the returned draft without altering published workload data. A scoped feedback provider keeps the outcome visible after modal closure. No schema, dependency or shared-style changes.


## Shared workflow report filters (2026-10-23)

WorkflowReports uses WorkspaceFilterCard and form-control-sm rather than the bespoke toolbar. One role-scoped filter state drives controls and requests; there is no separate unapplied filter draft. Office filters remain in ListState. Date validation is derived from selections and prevents invalid requests. A request generation guard ignores superseded/unmounted success/error/finally callbacks. The loaded query identifies report scope, blocks stale exports, and avoids displaying prior results while refreshing. Existing API contracts, role permissions and workbook generation are unchanged.


## Capacity publication modal (2026-10-23)

OfficeCapacityWorkspace uses DecisionDialog for publication instead of a RightDrawer/RecordPage. Publication uses completeDecision to separate a committed mutation from a failed refresh; a committed save cannot be retried as an unsaved action. Existing expected version/fingerprint and backend readiness checks remain authoritative. Each review session resets confirmation/error state. CapacityDialogNavigationGuard shares the existing capacity dialog route/beforeunload protection between lecturer editing and publication. Preparation and comparison keep their existing record-page flows; no backend, schema, dependency or global-style changes.


## Capacity row wording (2026-10-23)

capacityRowIssues translates the existing missing-entry API message into "Capacity limits not set." for row display; other readiness messages and backend validation remain unchanged.


## Compact capacity version and edit views (2026-10-23)

OfficeCapacityWorkspace places Compare versions and historical revision actions in OfficeToolSection.actions beside the status badge. Draft readiness uses one initially collapsed native details element with the existing issue count, full issue list and fresh-draft recovery; the publication action shares its body row. The row editor keeps only a short draft identifier and per-role Published/Minimum values, plus the existing conditional workload warning. Shared section/modal primitives, global styles, backend readiness and concurrency/dirty guards are unchanged.


## Capacity publication workload validation (2026-10-23)

capacity_workload_counts batches global active primary/supporting Supervisor loads, active Panel appointments and reserved Panel nominations in four grouped queries. Draft readiness compares role-aligned entries with these counts; publication recomputes them after the existing semester, plan, entry and eligible-Lecturer locks, before supersession or publication audits. The existing 409 conflict contract carries lecturer staff number, role, proposed limit and minimum. No schema or authorization changes. Published/historical readiness retains structural validation without retroactively invalidating immutable versions. Plan serializers share the batched workload context across versions, including supporting supervision previously absent from their operational resolution. The Office editor derives a per-role minimum from the live roster, allows saving a lower draft with a warning, and uses backend readiness to block publication. Temporary unavailability and pending Supervisor reservation behavior are unchanged.


## Searchable research profile directory (2026-10-23)

ResearchProfileDirectory is mounted by LecturerResearchWorkspace for staff profile routes without a selected student, avoiding the legacy full options/request/history load. GET /api/appointments/research-amendments/profiles/ reuses research_amendments.current_profiles for permission scoping, validates search/programme/sort/page/size, and slices the queryset before serializing student identity, programme and research title. Programme facets use the same permitted scope; alphabetical sorting has a primary-key tie breaker. The directory uses shared filter/pagination primitives, desktop table columns and labelled mobile rows. URL parameters profileQ/profileProgramme/profileSort/profilePage/profileSize isolate directory state from request queue filters. Debounced searches cancel stale result application; loading/errors hide stale actions while retaining controls. Role changes remount the directory. Selected profile options opt into selectedOnly=true, returning just the authorised selected identity instead of the full student roster; legacy API responses stay compatible. No schema migration or new dependency is required.

## Panel appointment header grouping (2026-10-23)

PanelBrowse composes its optional description and current/past appointment explanation into the WorkspaceSectionHeader description. Removing the standalone explanation paragraph avoids applying the card section gap between a heading and its own description. The existing shared header handles action alignment and responsive wrapping; global header/card styles and browse behavior remain unchanged.

## Office appointment table hierarchy (2026-10-23)

AppointmentTableCells.tsx provides AppointmentReviewerCell and AppointmentStatusCell, used only by OfficeSupervisorAttention and OfficePanelAttention. Reviewer names/roles use readable 12px typography; role-only fallbacks avoid inventing Coordinator identities from candidateName. Status labels/tones reuse the existing appointment status helpers; decorative dots are aria-hidden, and wrapping labels align beneath their text. Shared RequestStatusBadge, global table styles, card padding, API data, export schemas, filters, sorting and permissions are unchanged.

## Appointment status and horizontal spacing refinement (2026-10-23)

OfficeAttentionTable renders RequestStatusBadge directly for pending student applications and studentReason only for the no-application fallback. The column is labelled Application status. Aggregate progress filters and exported progress/current-stage fields retain their existing semantics. The shared appointment-workspace-card uses p-5 with sm:py-7, keeping horizontal padding at 20px across Supervisor and Panel staff views while preserving vertical spacing. No backend/status/permission changes.

## Appointment workspace spacing (2026-10-23)

The shared appointment-workspace-card class in frontend/src/index.css owns responsive padding and section gaps for staff collection cards. LecturerAppointmentRequests, CoordinatorSupervisorWorkspace/Approvals, PanelBrowse, PanelSuperviseeRoster, PanelAssignmentsWorkspace, staff SupervisoryTeamManagement collection views and OfficeSupervisorAttention/OfficePanelAttention opt in. Nested data-workspace-filter-card panels receive scoped desktop padding, field gaps and action separation; the two local Office workload concern filters expose that same marker. Shared RequestWorkspacePrimitives and CoordinatorFiltersBar defaults are unchanged, so Timeline, Capacity, Research Amendments and Reconciliation filters outside these cards retain their spacing. Borders, typography, table styles, permissions and behavior are unchanged.

## Reconciliation acceptance modal (2026-10-23)

WorkflowReconciliationCentre renders acceptance inputs through the existing DecisionDialog children instead of an inline fieldset. The eligible-warning footer button opens that dialog independently of form completeness; the final modal action still requires reason and acknowledgement. Parent state retains cancelled drafts, while RecordPage continues to guard navigation. Existing DecisionDialog busy, duplicate, stale-evidence and committed-refresh handling is reused. Source correction and exception acceptance have separate visual rows. No shared-component or backend/API changes.

## Audited reconciliation acceptance (2026-10-23)

The capacity detector no longer compares published policy limits with legacy profile limits. can_accept_issue is a server-side allowlist restricted by severity, repairability, record type and historical status. accept_reconciliation_issue is Office-only, checks the latest fingerprint and appends ACCEPT_INTENTIONAL to WorkflowReconciliationAudit with identical before/after academic values and a saved issue snapshot. Migration dashboard/0008 adds a conditional unique constraint on issue type, entity type/ID and fingerprint for acceptance actions, so competing requests cannot create duplicate decisions. Existing audits remain immutable.

accepted_issue_audits matches only currently eligible warnings with exact evidence. detect_reconciliation_issues excludes accepted warnings by default for existing dashboard/report consumers; include_accepted=True supports review/list partitioning. GET reconciliation accepts reviewStatus=OPEN|ACCEPTED, keeps open summary counts and adds accepted count. Preview includes canAccept and optional acceptance metadata. POST issues/<issue_id>/accept/ requires a reason and fingerprint; it returns accepted rather than resolved. Fingerprints also include student/programme identity, and missing-semester evidence includes source status, current-timeline flag and profile identity where applicable. Changed or newly ineligible evidence is never suppressed.

The frontend reuses AppointmentViewSwitch, RecordPage, DecisionDialog and the existing committed-mutation/refresh separation. Accepted warnings show reviewer/time/reason in a read-only view; acceptance requires a reason/checkbox/confirmation and cannot be repeated after a committed decision, including refresh failure. Shared audit history now describes reviews and repairs. Filters, page correction, source routing and dirty/busy guards are preserved.

## Reconciliation list density (2026-10-23)

reconciliationListSummary provides presentation-only short titles and numeric comparisons for the three common issue types, retaining the server title as fallback. WorkflowReconciliationCentre keeps full titles, programme context, evidence and reasoning in RecordPage, while student list rows use record type/ID to distinguish multiple issues for the same student. Scoped desktop table padding/column widths give affected identities more room; the shared responsive table is unchanged. Removed the help copy's max-w-3xl cap and replaced long prose with three short statements. No detector, fingerprint, API, permission or repair behavior changes. docs/WORKFLOW_RECONCILIATION_GUIDE.md documents triggers and implications across the three existing detector modules.

## Reconciliation review corrections (2026-10-23)

reconciliationRepairDetails supplies the same proposed target/source values to the review form and DecisionDialog confirmation. Capacity-copy suggestions include the verified source semester label and plan version, covered by the issue fingerprint. Module labels distinguish capacity issue types from other WORKFLOW_TRACKING checks. List request generations are invalidated synchronously on filter changes; corrective page requests retain loading state through their follow-up fetch. reconciliationRecordRoute maps EVALUATION_PERIOD to marksConfig and MARKS_TASK/EVALUATION_TASK to marksTasks, preserving mark-record detail routing.

Submission and evaluation timestamps use timezone.localdate with the configured Asia/Kuala_Lumpur timezone before semester matching. Semester assignment and capacity-copy handlers rerun issue/fingerprint validation after locking source/target rows and before writing. The transaction rolls back on conflict. Regression tests exercise a controlled update between the initial fingerprint check and lock acquisition, plus the Malaysia midnight boundary across three record types. No authorization or repair-eligibility rules are relaxed.

## Workflow reconciliation evidence and presentation (2026-10-23)

WorkflowReconciliationCentre composes the existing RecordPage/DecisionDialog with shared AppointmentSummaryCard, CoordinatorDataTable, WorkspaceFilterCard and WorkspacePagination. workflowReconciliation presentation helpers explain existing checks without determining eligibility. ReconciliationEvidence exposes business facts and capacity comparisons; identifiers are secondary. ReconciliationAuditHistory loads record-scoped history only when expanded, with local failure/retry and explicit truncation count when needed. List/preview generations reject stale responses. Successful mutation state is separate from list refresh and prevents resubmission; resolved issues are not previewed again after saving.

The Office reconciliation API adds checkedAt and explanatory context within currentState (lecturer, semester, policy version, missing-link signals and overlap ranges). Context participates in the existing fingerprint. Search includes lecturer/staff/semester context. Filtered issues are stably prioritized by severity and repairability before paging. Audit GET accepts optional entityType/entityId filters applied before its existing latest-200 limit, and adds count; legacy callers remain supported. Existing detectors, repair eligibility and write services are unchanged. No schema migration or permission change.

## Lecturer capacity collections and policy composition (2026-10-23)

OfficeCapacityWorkspace composes CapacityPolicySummary and CapacityCollectionPage. Its existing internal view state now distinguishes overview, versions, availability and activity without tabs or changing route authorization. View transitions restore overview page/scroll and retain semester/search/role; lecturer availability shortcuts carry a separate exact lecturer ID. Modal restoration checks the originating capacity view so leaving a lecturer dialog cannot scroll the destination back down.

The overview fetches the roster and working plans (DRAFT/PUBLISHED); availability and audit histories are not downloaded on entry. The roster adds compact current/scheduled restriction counts without private reasons. Collection views fetch one server page on demand with cancellation-safe effects, filtered totals, local retry and focus refresh. Explicit version comparison and prior-semester copying still traverse bounded legacy plan pages when needed.

Existing Office GET collection endpoints accept validated q/status/role/lecturerId filters, working plan scope and optional pageResult=true. Filters run before count/limit/offset. Opt-in responses contain rows/total/limit/offset; legacy array bodies and X-Total-Count/X-Limit/X-Offset headers remain supported. No schema migrations, permission changes or write-service changes. The shared table, filters, pagination, buttons and dialogs provide presentation consistency. CapacityPreparationForm holds the optional reference average and defaults to new-draft intent when entered through preparation actions.

## Office monitoring destinations (2026-10-23)

The officeMonitoring utility maps a whitelisted monitor query to its exact canonical pathname and supplies the active-task Marks predicates. OfficeMonitoringProvider, enabled only for Office users in App, provides the validated scope and isolates useListState memory for explicit monitoring entries. A location-keyed subtree prevents stale filters/status tabs from hiding linked results. OfficeMonitoringNotice uses the shared info alert and clears only monitor while preserving navigation state. Marks, Panel request browse and Panel workload apply their scoped datasets before normal filtering/paging/export; Supervisor requests pass monitor through both browse and export. The Office Supervisor API filters primary/supporting bases by their respective awaiting-review statuses before pagination. Authorisation and decision permissions are unchanged. officeWorkloadNavigationState recognises workload paths with query strings.

## Workload monitoring summaries (2026-10-23)

WorkloadMonitoringSummary reuses AppointmentSummaryCard for both monitoring pages with a discriminated Panel/Supervisor records prop. Each page supplies browse.filtered before pagination and mounts the summary only after a successful load. Counts use currentStudents and authoritative capacityState with published semester/version metadata; no capacity or availability is inferred from missing configuration. The shared responsive grid stacks on mobile, uses two columns at sm and four at xl. Existing distribution details, filters, export, lecturer details and backend contracts remain unchanged. The workload table minimum width is restricted to the lg table breakpoint so the shared mobile record-card layout can fit the viewport.

## Consistent dashboard headers (2026-10-23)

DashboardHeader composes the shared PageHeader with one title/description and a context slot. StudentDashboard, LecturerDashboard, CoordinatorDashboard and AdministrationDashboard provide their existing ActiveSemesterContext/OfficeSemesterContext and role-specific actions. DashboardSemesterSummary arranges metadata horizontally at sm and above with a subtle date separator; dates wrap below on smaller screens. This replaces per-role heading copy without changing APIs or permissions.

## Dashboard semester header context (2026-10-23)

DashboardSemesterSummary renders borderless header metadata. StudentDashboard, LecturerDashboard, CoordinatorDashboard and AdministrationDashboard group their existing page heading and semester context with consistent spacing. Shared fetch/state handling, authoritative academic dates, lifecycle badges and role permissions are preserved.

## Dashboard semester summary layout (2026-10-23)

DashboardSemesterSummary owns the shared dashboard card hierarchy. ActiveSemesterContext and the compact OfficeSemesterContext retain their existing data loading and actions while delegating presentation to it. SemesterDateRange uses explicit readable typography and spacing rather than inheriting tiny card-caption styles.

## Dashboard semester dates (2026-10-23)

ActiveSemesterContext and both OfficeSemesterContext variants reuse SemesterDateRange, which formats academic startsOn/endsOn using the existing Malaysia date formatter and semantic time elements. DashboardTimeline retains role-scoped event filtering but no longer renders uploadedAt or a separate session heading. No API or lifecycle behavior changes.

## Timeline edit modal (2026-10-22)

EditTimelineEntryDrawer uses PortalModal with the same width/header/padding as TimelineAddEventsModal, replacing RecordPage. PortalConfirmModal handles dirty dismissal, useRecordDraft reports pending edits, and beforeunload protects reloads while dirty or busy. Existing save callbacks, validation and InformationalEventExtension remain unchanged. The date grid stacks on mobile.

## Timeline event creation and import (2026-10-22)

Standalone UploadTimelineDrawer passes semesterLabel into RecordPage's subtitle; embedded import inherits the same semester context from TimelineAddEventsModal's header.

TimelineAddEventsModal composes PortalModal, OfficeToolViews, PortalButton and the existing add/import components in embedded mode. Both methods stay mounted to retain drafts; dirty and busy callbacks protect closure, navigation and method switching. Existing RecordPage consumers remain supported. SemesterTimeline accepts optional content-header actions. TimelineManagement removes its Tools menu and owns the single dialog. Import preview tokens, warning acknowledgements, semester access checks and API contracts are unchanged. Shared dropdown text wrapping remains available to other modules.

## Timeline action simplification (2026-10-22)

EditTimelineEntryDrawer receives an optional onExtendDeadline callback from TimelineManagement. The existing InformationalEventExtension/DecisionDialog workflow remains authoritative for extension validation, reason and audit handling. The editor disables extension while dirty or busy; successful extension reload closes the editor to avoid saving stale dates afterward. Row Delete uses the shared ghost button and existing confirmation.

## Timeline action consistency (2026-10-22)

TimelineManagement reuses WorkspaceToolsMenu for template download and upload, and PortalButton for Edit, Extend date and Delete. WorkspaceToolGroup items accept an optional disabled flag so existing semester edit restrictions remain enforced in the menu. Timeline-only column styles reserve action space without changing other tables.

## Timeline workspace consistency (2026-10-22)

TimelineManagement composes OfficeToolViews (workspace appearance), CoordinatorDataTable, WorkspaceFilterCard and WorkspacePagination. It follows the capacity semester selector layout. Filtering derives directly from controlled inputs; local filtering resets entry pagination without API reads or mutations. Timeline table text and desktop action alignment are locally scoped. SemesterTimeline appends session only when absent from the semester label.

## Semester list simplification (2026-10-22)

AcademicSemesterManagement renders a five-column semester list with separate start/end dates and a reduced 640px table minimum width. Only list presentation changes; backend count fields and activation/closure consumers are preserved.

## Application step scroll correction (2026-10-22)

Continue and Submit use distinct React keys; Continue explicitly cancels the click default before advancing. This prevents a discrete click from changing the reused DOM button into a submit control before the browser runs its default action. The mounted regression flushes the click update before that default action to reproduce real pointer timing.

SupervisorAppointmentApplicationPage records explicit step navigation in a ref and performs scrollIntoView plus focus({preventScroll:true}) in useLayoutEffect after the step commit. A heading scroll margin accommodates fixed navigation. Validation/edit-target navigation retains its existing specific destinations.

## Requirement button alignment (2026-10-22)

SupervisorDocumentRequirements uses PortalButton icon={Plus} instead of nesting the icon inside its children/text wrapper; local no-wrap/shrink protection keeps the action aligned.

## Evaluation-period empty layout correction (2026-10-22)

MarkEntryPeriodConfig now stacks the shared AlertMessage and PortalCard editor when its period list is empty. Existing populated list/detail behavior remains. Editor-scoped styles in index.css use container queries so identity, recipient targeting and date groups form two columns only when the editor itself has enough space; narrow editors and mobile stack. Shared primitives and API/state contracts are unchanged.

## Contextual feedback across the five owned modules (2026-10-22)

Extend the existing AlertMessage with a title, warning tone, supporting content and contextual actions; information uses an information icon. FormFeedback and FieldError share this presentation and accessible field associations. The pure formFeedback helper maps explicit API field keys for validation responses (including academic 409 validation), retains independent errors during correction and focuses the appropriate enabled control after save completion. It never guesses field targets from message text.

ModuleFeedbackScope opts the four owned route families (Dashboard including Workflow, Supervisor, Panel and Marks) into compact section-read ErrorState presentation. Registry, Files, FAQ, Letters, Announcements and participant lifecycle keep the existing default ErrorState layout. Separate read, selection, form and action error state at configuration boundaries. Exact-record retries repeat the exact failed GET; saved-but-refresh-failed workflows retain committed identity, disable stale writes and provide read-only recovery. Shared decision submission and signed closure previews retain their existing safeguards. All changes are frontend-only; no API or database migration is introduced by this feedback pass.

## Semester activation readiness and review (2026-10-21)

An Office-only activation-readiness read and the activation mutation share server rule derivation under deterministic semester locks, reusing the existing Published capacity validation. The readiness response includes its Malaysia check date, current-semester identity and individual check results; it does not grant activation authority. The frontend separates draft editing, readiness and a shared DecisionDialog review, retaining server-issued closure preview tokens, unfinished-work acknowledgement and stale/conflict handling. Existing lifecycle APIs and transition audits remain authoritative. No database migration is required.

## Academic Semester presentation polish (2026-10-21)

AcademicSemesterManagement opts into a workspace appearance on shared OfficeToolViews, matching Supervisor workspace navigation classes while preserving the compact default for other consumers. End semester retains the existing close transition and ClosureReview safeguards through PortalButton's danger variant. Local academic-semester-fields styling provides stacked labels, 8px spacing and 14px semibold values for draft/transition inputs and PortalSelect triggers, without changing global controls or APIs.

## Supervisor application draft controls polish (2026-10-21)

The application reuses its existing PortalToast success tone and four-second dismissal timer for successful saves. Persistent contextual and failure guidance retains the existing draftMessage path. The local sticky toolbar has no card border; its native details popup groups a semantic time element and label in a tinted metadata block, followed by full-width existing PortalButton primary/danger variants with resume/delete icons. Shared primitives, draft state, APIs, concurrency guards and confirmation dialogs remain unchanged. Existing mounted regression coverage checks toast placement/dismissal, timestamp semantics and responsive popup behavior.

## Supervisor application layout refinement (2026-10-21)

The student application owns a compact sticky draft toolbar and native details disclosure (Escape/outside-pointer dismissal, explicit dirty-resume/discard confirmation retained), without changing RecordPage or global primitives. Connected progress records steps successfully continued in the current editing session; earlier completed steps are return links, upcoming steps cannot bypass validation. Mobile uses a current-step label and segmented progress. Resume restores valid earlier details/research-writing steps by silently reusing the same step validator against the saved snapshot, rather than clearing all progress or trusting the saved step number alone. Availability/uploads require a fresh check; validation feedback and current inputs are not mutated by this completion check.

Research Intent editor renders three separately labelled cards between Project details and the final Research summary card, retaining all nine plain-text controls and their stable IDs. Validation follows the visible field order. Application errors carry an optional control ID; field errors render below the control with aria-invalid/aria-describedby, while general service failures remain section-level. Form change capture clears only the edited control's error (or its radio group), not unrelated errors. Course rows, title source and declaration accept optional error props; per-file errors appear below the upload control. First-invalid focus scrolls to the actual control, including the abstract now at the end. Contact editing, draft contracts, multipart submission, authorisation and server validation are unchanged.

Mounted browser regressions exercise the real components/CSS with isolated HTTP fixtures at desktop and narrow-mobile widths, including draft disclosure size/dismissal, ordered cards, field error placement/persistence and the existing draft/submission workflow.

## Supervisor Research Intent and drafts (2026-10-21)

Supervisor applications retain their existing shared research title, area and abstract fields and add a nullable immutable `research_intent` JSON snapshot. New student creation requires the strict version 1 schema with nine trimmed nonempty strings (10,000 characters each). Historical applications and Office-initiated replacements remain null. An exact-application `/research-intent/` endpoint reuses the existing reader authorisation boundary; queues, exports and profile serializers do not gain the long text.

`SupervisorApplicationDraft` is a separate one-to-one Student record with validated incomplete text/selection JSON. Student-only owner-derived GET/PUT/DELETE `/supervisor/application-draft/` responses use no-store caching. Draft writes and successful application cleanup share the Student transaction lock. Drafts never enter workflows or reserve capacity; final submission reruns existing intake, eligibility, role-separation, capacity and upload checks. Profile particulars, declarations and files are excluded from drafts. Draft abstract text is bounded to 10,000 characters; existing shared field bounds and course limits apply.

The student form uses four steps with semantic progress, current-step validation and final full validation. Existing step content remains mounted but inactive steps are hidden and inert to preserve course/file editing state. Native form validation is bypassed in favour of explicit step-aware errors and focus. Typed Research Intent/draft contracts and services are separate from Section A and list DTOs. The shared exact-request component loads an authorised Research Intent section with key-safe loading/retry/legacy states. Explicit save/discard and automatic initial restoration preserve the existing dirty/busy navigation protections; manual replacement of edits still requires confirmation, and all resumes require fresh declaration and file selection.

## Submission form composition correction (2026-10-21)

SelectMenu has an opt-in searchPlaceholder mode: its bounded popup contains a focused search combobox and scrollable results; select-only consumers retain existing behaviour. showSelectedDescription defaults true; the event picker disables it because the form already presents one selected-event summary. The list establishes a relative positioning context so keyboard scroll offsets remain local to the results list.

SubmissionWindowDialog composes the existing PortalModal with an 880px maximum width, non-scrolling flex header/footer and one internally scrolling body. Scoped Office typography applies only to this dialog. SubmissionScheduleField presents required Date and Time inputs for one Malaysia wall-time value; partial values remain dirty but cannot be saved. EventDateImport now copies calendar days into those fields, preserves entered times and reuses PortalConfirmModal before replacing dates. No temporary import fields or additional Apply step remain. No API, migration or access-policy change.

## Linked window date clarity (2026-10-21)

TimelineEventPicker uses the existing bounded SelectMenu with opt-in popup search, retaining selected events across searches. It is reused by creation and later linking; no global primitive changes. EventDateImport fills the schedule calendar days and preserves clock times; SubmissionScheduleField provides the only required date/time inputs. The shared PortalConfirmModal confirms replacement. OperationalPeriodManagement places linking before dates and shows inline linked-date and scope-specific extension impact inside existing dialogs. Published enforcement is read from the activity response, not inferred from dates.

TimelineEntrySerializer adds read-only linkedPeriodStatus metadata (lifecycleStatus, scheduleStatus, nullable datesEnforced). Activity enforcement reads are cached per semester/activity during serialization. Marks returns null enforcement because evaluation rules remain independent. Legacy status values and access policies are unchanged. The typed projection carries metadata into Office timeline rows and calendar event detail through LinkedPeriodStatus. Common period dates remain authoritative and dynamically projected; personal exceptions never update those dates.

Regression coverage includes bounded 80-event selection, explicit time import, replacement cancel/confirm, linked draft save impact and common/personal extension distinction across four viewport widths, plus serializer lifecycle/enforcement and frontend presentation checks.

## Periods selector alignment and dividers (2026-10-21)

OfficePeriodsManagement places the explicitly associated semester label above a centred flex row containing the shared PortalSelect and StatusBadge. The dropdown shrinks on narrow screens while retaining the badge beside it. Office-scoped period-review-note omits its top border; the preceding empty state or records table supplies the single separator. Shared primitives and business rules are unchanged.

## Submission window modal and atomic creation link (2026-10-21)

SubmissionWindowDialog composes unchanged PortalModal and PortalConfirmModal with Office typography, responsive date fields, dirty/busy dismissal, data-router navigation blocking, beforeunload protection and same-URL focus/scroll restoration after native dialog cleanup. OperationalPeriodManagement owns form values, revision/reason validation, errors and the optional timeline event selector. Calendar state is independent of period state. A link conflict retains all inputs; a creation-only HTTP 409 recovery action outside the disabled fieldset removes the link and clears the retry block without requiring calendar availability. Forbidden requests remain blocked. Manage window retains RecordPage for history and lifecycle controls.

POST /api/academics/operational-periods/ accepts optional nullable timelineEntryId. create_period locks the semester and selected event, verifies active-timeline/same-semester/unowned constraints, then creates the draft, event ownership/date snapshots and both audits in one transaction. Existing event title, phase and audience remain unchanged. Invalid ownership or stale events return 409; rollback prevents orphan drafts. PATCH does not accept this field. No database migration or shared primitive change is required. PostgreSQL concurrency coverage verifies that two users choosing the same event produce one success and one conflict. Browser fixtures use production components/CSS with isolated mocked HTTP and no live writes.

## Periods workspace composition and context (2026-10-21)

PeriodActivityOverview composes OfficeToolSection, CoordinatorDataTable and StatusBadge without modifying shared primitives. OperationalPeriodManagement retains authoritative services and uses RecordPage for window details and SubmissionWindowDialog for Add/Edit forms; DecisionDialog handles publication, date restrictions, extra time and revocation. programmeWindowCoverage evaluates published programme scopes case-insensitively and shows gaps before restriction activation. A failed record refresh presents a visible Reload window control and disables stale actions. OfficePeriodsManagement tracks calendar availability separately from entries so an empty existing calendar differs from a missing/unavailable calendar.

PeriodCalendarConnection owns guarded link/create interactions for saved windows. createPeriodCalendarEvent posts an explicit semester, owning operational/Marks period, phase, audience and Malaysia-derived dates in one existing timeline request; existing backend locking, same-semester validation, projected dates and audit remain authoritative. Missing timelines route to existing Academic calendar setup. Marks calendar audience excludes Students, consistent with existing backend visibility. Existing saved-window calendar APIs are unchanged; optional linking during draft creation uses the operational-period API described above.

periodPresentation builds and validates Marks query context. App passes contextSearch to MarkEntryPeriodConfig; scoped lists and forms retain the exact semester/period, reject invalid/mismatched requests and preserve ordinary unscoped behaviour. Request generations and context identity guard late loads, selections, saves and transitions; refreshing a list preserves an in-scope selected form. Existing shared components and protected participant/delegation code remain unchanged.

## Capacity lecturer modal composition (2026-10-21)

CapacityLecturerDialog composes unchanged PortalModal and PortalConfirmModal with a labelled header, shared footer controls, dirty/busy close handling, data-router useBlocker, beforeunload protection and same-URL focus/scroll restoration. OfficeCapacityWorkspace retains all values, API commands and errors; entry/details use this local modal composition, while preparation/comparison/publication retain RightDrawer/RecordPage. Portalled modal content carries its own Office presentation scope. Browser fixtures cover native dismissal, state retention, navigation, conflict retry and deferred writes without live academic mutations. No shared primitive, backend, permission or protected-area changes.


## Capacity creator/date separation (2026-10-21)

Desktop-only capacity-versions-table CSS applies 48px left padding to both header and body cells in column four. The user's current 22% date and 25% action widths remain unchanged. No shared table styles or mobile card spacing change. The existing highlight browser assertion finishes the shared row color transition before checking its final computed color, avoiding headless animation timing dependence.


## Capacity version action spacing (2026-10-21)

OfficeCapacityWorkspace shortens the history edit label to Edit draft without changing its handler. Scoped desktop capacity-version column width decreases from 32% to 28%, moving the column start right and returning space to metadata. Shared table/button components remain unchanged.


## Capacity table feedback and row actions (2026-10-21)

OfficeCapacityWorkspace keeps attention selection in the shared WorkspaceFilterCard, adds a live result summary from shown/visible rows and uses scoped CSS to highlight rows containing existing capacity-row-issue text. The warning retains full issue details and fresh-draft recovery. Shared PortalButton danger styling replaces the one-item WorkspaceToolsMenu for discard; the existing DecisionDialog and mutation service remain unchanged. Capacity-only table column sizing accommodates both row actions. No shared primitives, APIs, business rules or protected areas change.


## Capacity contextual back navigation (2026-10-21)

OfficeCapacityWorkspace supplies PageHeader with the existing caller label/handler in overview and a local overview transition in nested views, clearing affected-row filtering on return. The duplicate content-level back control is removed; comparison/revision actions retain their existing handlers. No shared primitive, route, API or permission changes.


## Capacity draft preparation and audited discard (2026-10-21)

CapacityPreparationForm owns the preparation mode and selection UI; OfficeCapacityWorkspace retains read/mutation orchestration and existing source validation. Capacity versions compose CoordinatorDataTable, PortalSelect, pagination and WorkspaceToolsMenu; DecisionDialog confirms discarding. A committed discard followed by failed refresh uses completeDecision to prevent offering a repeated write.

POST /api/academics/capacity-plans/<id>/discard/ accepts reason, expectedVersion, expectedFingerprint and literal confirmed:true. Office authentication, strict command validation and existing writable-semester rules apply. discard_capacity_plan locks semester, plans and entries in existing lock order, verifies Draft lifecycle and fingerprint, sets DISCARDED and atomically records PLAN_DISCARD with snapshots. No rows are deleted or version numbers reused. Existing draft-only edit/publish and published/superseded-only clone checks keep discarded plans read-only. Migration 0005 records the additional choices; sqlmigrate confirms no database DDL is needed. Shared components, protected implementations and assignment rules are unchanged.

## Capacity overview layout refinement (2026-10-21)

The policy heading aligns current-version information with a shared small PortalButton using the History icon. A separate action row holds continuation and preparation. Scoped flex wrapping handles narrow screens without altering shared button styles or navigation handlers.

OfficeCapacityWorkspace uses a labelled PortalSelect outside the former context card, with an explicitly associated date description and separate StatusBadge. A shared PortalCard groups current policy actions, the planning baseline and a native details/summary disclosure containing all published readiness errors. Page-local capacity CSS aligns controls and stacks content on narrow screens. Existing draft continuation receives the primary button treatment; preparation remains accessible. No shared component, route, API, business-rule or protected-area changes.

## Capacity workspace projection and self-service availability (2026-10-20)

LecturerCapacityManagement is a compatibility facade retaining CapacityRoleSummary and exporting OfficeCapacityWorkspace. The Office workspace composes existing PageHeader, PortalCard, OfficeToolSection, CoordinatorDataTable (table/mobile cards), PortalSelect, WorkspacePagination and guarded RecordPage through RightDrawer. Overview, explicit draft preparation/editor, version inspection and history replace the former button-group sections. capacityWorkspace helpers merge saved draft values with current operational resolution without fabricating missing values or historical counts; comparison covers both versions. A stable local record-page key preserves nested preparation/copy navigation. Mutations reuse existing fingerprint/version-checked services.

GET /api/academics/semesters/<id>/capacity-workspace/ is Office-only and read-only. Batched queries return all current eligible lecturers plus any lecturer with selected-semester plan entries or active primary/supporting/Panel work, current published resolutions, distinct student sets and canConfigure/userEnabled flags. Primary plus supporting appointment counts feed capacity resolution; reserved Panel nominations remain separate. Unknown legacy Panel student links set workloadIdentityIncomplete and null unique totals while retaining actual assignment load. The portal-wide planning baseline denominator counts current eligible lecturers only. No new model, migration or stored recommendation field.

GET/POST /api/academics/my-availability/ and POST /api/academics/my-availability/<id>/cancel/ derive lecturer ownership from the authenticated Lecturer account and reject foreign identity fields, unsupported roles and missing/nonliteral confirmed:true. GET supplies semesters, held roles, canManage and bounded history pagination. Creation/cancellation reuse audited availability services and validation. LecturerAvailabilityPage uses shared form controls, RecordPage navigation guards, DecisionDialog and single-outcome feedback. No request occurs before explicit confirmation; closing review retains the form; a successful write followed by refresh failure cannot resubmit the write. App lazy-loads /dashboard/my-availability for Lecturer only, entered beside the Lecturer Dashboard capacity summaries. Existing Office routes and shared primitives remain unchanged.

## Shared appointment filter container and reset ownership (2026-10-20)

WorkspaceFilterCard in RequestWorkspacePrimitives owns the established rounded border/background/padding, caller-supplied field arrangement and WorkspaceFilterActions footer. RequestFilters, CoordinatorFiltersBar, PanelBrowse and PanelSuperviseeRoster compose it; the Rubrics-specific FilterCard is unrelated and unchanged. clearAppointmentFilterParams copies URLSearchParams and removes list-filter/page keys atomically while retaining view/size/source and selected-record context. Student/Lecturer request controllers use one URL setter; the Research wrapper additionally clears its student list filter. Existing search-only and legacy controllers retain their state owners. useCoordinatorFilters accepts an opt-in singleDate projection; appointment request/history and Panel assignment hosts suppress the upper-bound control and pass an empty upper bound to reads/exports/drilldown. PanelBrowse likewise ignores saved upper bounds. Generic research/tool consumers retain their existing range capability. No backend/API/permission/schema/dependency changes.

## Appointment filters — redundant controls only (2026-10-20)

CoordinatorFiltersBar retains its original layout and independently controls status visibility while keeping date fields. Omit a sort selector with fewer than two options. Supervisor past appointment reads/exports ignore saved redundant status; single-sort student reads/exports use name order. Staff Panel assignments and Lecturer PanelBrowse current appointments ignore saved status when their active-only view has no status selector. Existing shared state, authorised collections, request stages, APIs, pagination, detail navigation and exports are retained. No new toolbar, styling system, dependency or backend change.

## Needs attention filter card (2026-10-20)

`OfficeAttentionPage` applies the existing rounded border utilities and responsive 16px/20px outer spacing to its filter container. Shared Office filter styles, grid breakpoints and filter actions remain unchanged.

## Workload filter card borders (2026-10-20)

Workload filters use their existing `rounded-xl border border-slate-200` utilities. The Office dashboard stylesheet must not remove their side borders or corner radius; shared Office filter spacing and background styles remain in place.

## Complete Office attention workspace (2026-10-20)

GET /api/dashboard/attention/ is authenticated and Office-only, accepts q/category/responsibility/programme/page/size, and returns filtered results, pagination, programme facets and full category summaries. It uses the existing action builder with an explicit uncapped limit; the legacy builder/endpoint still default to 20 actions. Exclude completed actions and informational timeline events, retain calendar setup, and count capacity role entries separately. Batch programme enrichment and filter before paging; summary totals cover the complete eligible source. No migrations or academic writes.

The Office-only /dashboard/attention route lazily loads OfficeAttentionPage. It composes PageHeader, OfficeToolSection, PortalSelect, CoordinatorDataTable, WorkspacePagination, PortalButton, StatusBadge and shared state views. URL filters and authenticated ListState retain browse context; generation-checked reads prevent stale responses. AdministrationDashboard uses the same feed for four category summaries and exact totals. Existing workspace return props gain optional labels for attention-origin navigation; defaults and protected branches remain unchanged.

Search updates the field/URL immediately and debounces only the API search by 200ms; pending searches hide obsolete records. Canonical request parameters ignore the all-view sentinel. Office primary requests use request-ID routes, Panel requests use records/recommendation-ID, and evaluations use exact MRK-padded IDs; supporting and research requests retain their existing detail routes. Return targets are validated and preserve the original query/page. Capacity/calendar items are faculty-wide; programme-specific records without a recorded programme are labelled Not recorded.

## Monitoring aligned list (2026-10-20)

Office-scoped heading sizes are 15px for Monitoring and 13px for Count; no shared heading styles or grid tracks change.

AdministrationDashboard keeps each metric as one native anchor with three children: label, count and View/chevron. Office-scoped CSS applies identical grid tracks to the heading and all rows: a flexible label plus fixed count/action widths, narrowed at the existing 680px container breakpoint. Counts are centered below Count and actions align right; wrapped labels leave the other columns in place. Monitoring labels share the existing Office tool-name typography rule (13px, weight 600, line-height 1.45, #0c1424), with counts and actions also at 13px. Reuses the system font, adds visible keyboard focus and preserves reads, routing, shared components and protected workflows.

## Monitoring entry affordance (2026-10-20)

AdministrationDashboard renders all five Monitoring items as native anchors. The existing four destinations remain; the Panel threshold metric links to panelAppointmentWorkload. Counts and read/error/retry behavior remain unchanged. Office-scoped CSS adds subtle row boundaries, count badges and chevrons, retaining the responsive two-column/single-column layout. Removed the disclosure and its unused CSS. Shared components and protected workflows are untouched.

## Office home monitoring clarity (2026-10-20)

AdministrationDashboard composes the existing summary and Panel workload reads into quiet metric rows. Existing native anchor destinations and modified-click behavior remain; the Panel threshold count remains informational and still includes FULL/OVER_CAPACITY only. Office-scoped home-monitoring CSS uses two columns, one below 680px container width, tabular counts and muted zeros. Native details holds the unchanged scope explanation. No shared primitives, APIs or business rules change.

## Office tools composition and navigation cleanup (2026-10-20)

The preceding local presentation pass added OfficeToolPrimitives (OfficeToolContext, OfficeToolSection and OfficeToolViews), composed from existing PortalCard and PortalButton components. Office-only CSS scopes layout to data-office-dashboard. Semesters, Calendar, Capacity and Periods reuse this composition; Reconciliation gains labelled filters and a records section; workload lists gain scoped filter/table layout. Shared primitives, global CSS, routing and business logic remain unchanged.

The requested cleanup removes the semester list/detail participant buttons and all Related tools rows (Semesters and Calendar), plus the unused row CSS. Existing callback props remain accepted for routing compatibility. Dashboard home retains its original participant button and destination. Task-specific prerequisite navigation such as reviewing capacity before draft activation remains available. Protected participant and delegation implementations are unchanged.

## Office timeline control spacing (2026-10-20)

Reduced Office home timeline control padding and separated the phase switch onto its own row below the title and Manage Timeline action. Narrow phones stack the management action as well. Uses Office-scoped CSS; shared timeline implementation, other roles and protected areas remain unchanged.


## Office reports entry placement (2026-10-20)

Removed the duplicate Workflow reports link from the Office tools directory at the user’s request. Reports remain accessible through the top-right View Workflow Reports button. Reconciliation and all protected shortcuts remain unchanged. The directory now contains seven tools.


## Shared Dashboard semester timeline (2026-10-20)

OfficeCalendarPreview now hosts the existing DashboardTimeline unchanged inside the Office home grid region. This reuses its read/reload lifecycle, session/upload metadata, phase selector, full TimelineCalendar and event dialogs. Office supplies its management navigation callback and no role filter, retaining Office visibility. Removed obsolete custom calendar CSS. Shared timeline components and other role dashboards were not modified.


## Office Dashboard system design consistency (2026-10-20)

Office Dashboard uses shared PageHeader, PortalButton, PortalCard, StatusBadge and section-heading styles. Removed Office CSS overrides of shared type roles and button casing across eligible Dashboard pages. Home semester context matches ActiveSemesterContext markup/classes while retaining the Office read-error/retry handling. Global styles and shared primitive implementations remain unchanged.


## Office reports header shortcut (2026-10-20)

AdministrationDashboard reuses PortalButton with BarChart3 and the existing Dashboard reports navigation callback. A home-scoped flex-wrap action container keeps reports beside the unchanged Manage Participants button and wraps at narrow widths. No shared components, routes, APIs or permissions change.

## Office Dashboard home correction (2026-10-20, implemented)

OfficeDashboardLayout retains its role/route predicate, opt-in CSS boundary and nested RecordPageProvider, with the rejected navigation strip and dropdowns removed. AdministrationDashboard composes independent attention, monitoring and workload reads; OfficeCalendarPreview retains its separate timeline read and unchanged TimelineCalendar. OfficeSemesterContext adds an opt-in compact header presentation while preserving its default rendering.

Home uses container queries against actual available content width: at 1040px or above, a flexible timeline column sits beside a 304px attention column; below that, attention precedes the calendar. All eight tool destinations are visible native anchors, with ordinary clicks routed through the existing callbacks to preserve Dashboard workload origin and deep-link context. Monitoring counts retain their cross-semester/carryover explanations. Pure officeHomeAttention grouping coalesces returned categories and duplicate records, preserves owner/deadline severity, and reports distinct role-entry/deadline-subset units without changing APIs or claiming complete backend totals.

New home styling is scoped to office-home within officeDashboard.css. App routing, global CSS, AppLayout, Sidebar, TopHeader, portal primitives, TimelineCalendar and protected lifecycle/delegation components match the fresh pre-correction baseline. No backend, schema, dependency or permission changes. Existing linked-tool presentation and source-aware returns remain intact. The isolated frontend/tests/officeDashboardHomePreview files remain a fictional design reference; the implemented Dashboard uses existing application services. Plan: `docs/superpowers/plans/2026-10-20-office-dashboard-home-layout-correction.md`.

## Office Dashboard UX restructure (2026-10-20, implemented)

The initial restructure added OfficeDashboardLayout with a nested RecordPageProvider and opt-in officeDashboard.css; its local navigation was subsequently removed by the approved home correction above. Preserved participant subtrees are explicitly excluded. Shared primitives, global CSS, the Office sidebar and protected participant/delegation components match the session baseline. `/dashboard/periods` is an Office-only semester-scoped operational-period/extension host using existing academics and Marks services. Legacy Calendar period anchors retain their destination. Calendar keeps informational dates and audited informational extensions, with Calendar/Entries/History views; it waits for semester lifecycle context before reading query-selected entries.

Overview uses independently retriable reads and pure typed attention grouping; the backend-capped task feed is explicitly a preview. Semester/capacity/workload pages retain service owners and existing guards, with complete bounded capacity-history reads and local pagination. Office Reports uses remembered sections/filters and paged attention; dossiers retain source-aware return and preserve protected lifecycle subtrees. Other role branches retain existing presentation. No backend/API/schema/dependency changes were introduced by this task. Plan: `docs/superpowers/plans/2026-10-20-office-dashboard-ux.md`; verification and limits are recorded in PROJECT_STATUS.

## Panel appointment filter and tools (2026-10-20)

CoordinatorFiltersBar accepts an optional extraFilters node inside its existing responsive field grid. PanelAssignmentsWorkspace supplies a labelled PortalSelect for its existing current/past ListState, reuses changeView for status/date/page resets and wraps Clear filters to restore current. Lifecycle selection, lecturer grouping, export, authorised host arrays and detail/return controllers are unchanged. AppointmentViewSwitch remains used by Supervisor only. OfficePanelTools now accepts only onWorkload; PanelAppointmentManagement retains onOpenCapacity for the existing dedicated workload page, and Dashboard retains the capacity entry. No API, permissions, schema, dependencies or capacity rules change. This supersedes the earlier shared-switch use by Panel below.

## Staff appointment switch and single browse path (2026-10-19)

AppointmentViewSwitch in RequestWorkspacePrimitives provides Supervisor's native-button/aria-pressed Current/Past presentation. CoordinatorTeamViewSwitch adapts existing Supervisor requests/history values; PanelAssignmentsWorkspace retains its current/past state directly through the filter described above. Panel no longer reads grouping preferences and groups by lecturer unless a lecturer is selected; its student table remains the drilldown. Existing record selection, authorised arrays, lifecycle filtering, source filters, pagination, export and detail/return controllers are retained. No API, permission, database or dependency changes. The prior mockup remains rejected; the explicit 20 October Panel filter correction is implemented independently.

## Staff Panel assignment browsing (2026-10-19)

PanelAssignmentsWorkspace composes shared Coordinator tables/filters, RecordPage, ListState, PortalButton/PortalSelect, pagination and safe Excel exports. The existing Office and Coordinator hosts supply their already-authorised full record arrays; no Office-only capacity API is exposed to Coordinator. panelAssignments helpers select confirmed active versus ended/completed lifecycles, deduplicate immutable appointment IDs, filter before grouping and group by staff identity. Missing staff identity falls back to appointment identity, never name-only merging. Unique student counts and historical appointment counts are distinct. Lecturer selection lives in panelLecturer query state; role-scoped shell memory retains list/filter state and drilldown source filters; obsolete grouping preferences are no longer read. Coordinator temporarily suspends the lecturer RecordPage while its existing appointment-detail host is open, avoiding concurrent record hosts. Existing exact appointment callbacks and source labels are reused. Coordinator filter initialisation now accepts supplied status/start-date values for inherited drilldown filters; other callers retain empty defaults. No API, permission, database, dependency or Student/Lecturer workflow changes.

## Shared decision dialog presentation (2026-10-19)

The shared header label uses text-xs/font-bold/text-slate-700 for modestly stronger emphasis; title sizing and modal behaviour remain unchanged.

DecisionDialog continues composing PortalModal and PortalButton with its existing submission controller, RecordDraft and feedback provider. Its responsive header uses the portal icon-button style and Lucide X with an accessible label, explicit non-submit type and pending-state disabling; dismissal calls requestClose, sharing the existing draft/save guards. Default secondary text is Cancel while workflow overrides remain intact. The header and message wrap long content, and dialog scrolling is contained. The decision-dialog-fields scope adjusts existing form-label/form-control typography only inside its fieldset; unrelated portal forms retain their styles. No API, authorisation, persistence or dependency changes. Mounted native-dialog regressions exercise real portal CSS, dismissal guards, pending saves, failure retention, stale blocks, custom labels and desktop/390px/320px layouts in isolated browser profiles.

## Workflow analytics filter layout (2026-10-19)

`WorkflowReports` keeps flexible fields in a wrapping shaded toolbar inside the filter form. A sibling footer within that form places the applied-filter summary on the left and small shared Reset/Apply PortalButtons on the right, separated from the fields by vertical spacing. The footer stacks on mobile; action labels stay on one line. This change is local to Dashboard Workflow Analytics and does not alter shared button styles or filter/API behaviour.

## Research profile history disclosure (2026-10-19)

The routed Research profile view renders its current record inside the main section and `ResearchProfileHistoryCard` as a sibling below it. Native details/summary elements provide keyboard-operable, initially collapsed history and per-revision disclosures. The history component is keyed by role and profile student ID, resetting native expansion when the selected identity changes; loading/error states do not retain the old history. Revisions are sorted by descending revision number using a copied array. `ResearchRevisionCard` retains its existing expanded rendering for other consumers and accepts a collapsible variant for this profile history. Existing portal type classes and disclosure chevrons are reused. No API, authorisation or persistence changes.

## Student dossier Panel visibility (2026-10-19)

The dossier PUBLIC branch uses a separate `_student_panel_records` projection. Shared `current_student_panel_records` selects the active appointment ahead of a pending replacement; actual PanelAppointment rows provide confirmed history. The response whitelists public appointment facts, uses CONFIRMED/FACULTY_PROCESSING for current state, omits nomination identifiers/reasons/workflow metadata and returns null waiting metadata. Overview status resolves only a confirmed current appointment or generic processing, so past appointments cannot become current. The INTERNAL branch preserves staff nomination records, decisions, audit/lifecycle events and programme/assignment authorization. No schema changes.

StudentProgressDossier uses StudentPanelAppointmentSummary for PUBLIC Panel results, with a separate current result and previous-confirmed-appointments section. It reads only public fields, omits staff placeholders/actions/reasons/audit and suppresses terminal nomination attempts in stale responses. Active appointments override processing in the UI as well as the API. Backend privacy, ordering, replacement and staff-scope regressions plus component rendering tests cover this contract.

## Student research profile card placement (2026-10-19)

ResearchAmendments renders StudentResearchProfileCard as a sibling before the requests section for the loaded Student list route. ResearchAmendmentRouteContent now contains request results/pagination without the current-profile summary. The card uses the same authoritative options/rows and navigation callbacks, existing portal type/button styles, responsive wrapping and pending-request capability checks. It is independent of Requests/History and search state, and omitted while loading or on a failed read. Staff lists and dedicated detail/profile/new routes keep their existing layout; no API or workflow changes.

## Office primary Supervisor replacement (2026-10-19)

Replacement candidate lookup catches User.MultipleObjectsReturned and returns ReplacementConflict (HTTP 409), retaining the transaction rollback and existing identifier storage. The form reuses its generation-guarded context loader for a contextual blocked-state Check availability action and awaits that loader after failed/unreadable POSTs. Selected candidate/reason stay in independent state. Loading and submitting both protect navigation; failed reads clear context and expose Retry. Keep the original submission error visible during read recovery. Successful POSTs retain their existing single-completion path. Permanent coverage includes duplicate-ID atomicity and seven mounted recovery/success scenarios in frontend/tests/officeSupervisorReplacement.browser.test.mjs, using installed Chrome/Edge with an isolated temporary profile, real React components and mocked HTTP responses, without new dependencies or live API writes.

PrimarySupervisorReplacementActions uses PortalButton variant="primary" with the existing Lucide UserRoundPen icon. The shared button supplies system typography, spacing and keyboard focus; no custom CSS or authorization changes are introduced.

The dedicated Office-only GET/POST `/api/appointments/supervisor/appointments/<id>/replacement/` loads authoritative predecessor/student/research/candidate context and accepts only JSON proposedSupervisorId/reason. Creation locks existing semester policy, Student, predecessor and incoming Lecturer state; revalidates eligibility, intake (using the Student participant), pending transfers/requests, predecessor continuity, role separation and capacity; creates the existing SupervisorApplication replacement and an Office SUBMIT workflow event. Use immutable SUBMIT actor_role plus the replacement link for initiatedByOffice provenance, without schema changes. Student creation and prefill reject an active incumbent; Student cancellation rejects Office-origin replacements. Existing Supervisor/Coordinator decisions and lifecycle handover remain authoritative. Current research profile values survive final replacement approval, including edits made while review was pending.

Exact team responses expose server-authorized canChangePrimarySupervisor and pendingPrimaryReplacement. SupervisorAppointmentManagement owns the Office form as an independent RecordPage replacing its supervision detail; SupervisoryTeamManagement only supplies the authorized Appointment record action. OfficeSupervisorReplacementForm uses the existing API client, PortalSelect/PortalButton/card typography, required reason, explicit eligible selection, busy/in-flight prevention and draft navigation guard. Successful creation closes the form before reloading supervision, preventing a failed read from inviting another creation. Student replacement state is removed. Shared request adapters retain initiatedByOffice and suppress unavailable Student Section A/declaration explanations for those requests. Office-origin acceptance/final approval lock and recheck the exact active predecessor. Initiation/final handoff share case-insensitive, ownership/conflict-checked profile resolution so legacy unlinked records and active Panel/history remain attached to the same profile. Historical Student replacement semantics and successful final-approval retries are preserved. No global styling, dependency, upload-security or migration changes.

## Shared submission availability (2026-10-19)

OperationalIntakeFeedback now has one compact presentation; the former default card and opt-in compact prop are removed. An activity prop selects Applications or Recommendations wording. Reuse StatusBadge, PortalButton and formatMalaysiaDateTime; render only the effective deadline (or future opening time) with semantic time markup. Unrestricted intake has no deadline. Loading/error states suppress stale availability; unavailable states retain a reason when needed and a refresh action. The advisory useOperationalIntake hook, enforcement guard and backend creation validation are unchanged.

StudentSupervisorAppointment owns the advisory read beside New application; enable it only for eligible creation entry points after application loading succeeds, excluding History, request detail, research and the separate form route. StudentSupervisorApplications is solely a records list. SupervisorAppointmentApplicationPage and RecommendPanelMemberDrawer use the same feedback component, with the latter explicitly passing PANEL_RECOMMENDATION. No global stylesheet, dependencies, API or schema changes. This supersedes the earlier page-only compact opt-in description below.

## Supervisor application clarity (2026-10-19, final presentation correction)

Declaration alignment uses the standard 16px checkbox with a 2px top offset inside an explicit 20px text line, centring the control on the first line while preserving top alignment for wrapped text.

`SupervisorAppointmentApplicationPage` keeps RecordPage and the existing Section A contracts. Reuse `appointmentDetailTypography` for numbered headings and particulars labels/body values, standard `form-control form-control-md` for padded inputs, and the existing PortalButton styles. No application-specific font overrides or global stylesheet changes remain. The earlier SupervisorApplicationNavigation component was removed following visual feedback. All six underlying section IDs and review Edit actions remain; the 2026-10-21 Research Intent extension above now composes them into four sequential steps with step-aware Edit actions.

`ProjectCourseCodeEntries` and its helpers parse historical comma-separated text into individual controlled entries, trim/serialize back to the bounded text API, and reject case-insensitive duplicates, comma lists within an entry and combined values over 255 characters. The course component keeps excluded rows only in local memory for restoration; backend Section A exclusivity/bounds remain unchanged. The concise review preserves exact server declaration wording/actor/time and fresh acceptance.

The disabled outer fieldset retains section spacing while freezing edits during submission. Inline section/file errors supplement required-field validation and uploads remain keyboard accessible. Compact OperationalIntakeFeedback is opt-in on this page; other consumers retain their presentation. Blocked results retain a recheck action and the server remains authoritative for eligibility.

`PATCH /api/appointments/supervisor/application-contact/` accepts only optional string phone/address fields for the authenticated eligible Student; unknown, identity and target fields are rejected. Shared phone validation, 32-character phone and 2,000-character address limits run before an atomic update. Lock the owning User, update only phone and the owning StudentRegistry address (creating the specialization if absent), then return freshly resolved particulars with no-store caching. No schema, sensitive queue payload or historical-snapshot mutation is introduced.

`SupervisorApplicationContactEditor` uses existing request/error helpers and RecordDraft dirty/busy handling. A successful save refreshes displayed particulars and clears declaration acceptance; submission while editing is blocked. Regression checks cover contact permissions/validation/atomicity/snapshot capture, code-entry compatibility/bounds, numbered section/review rendering, removed navigation/footer, shared typography and blocked-availability recovery. Live font measurements are compared against Settings inputs and the existing appointment research profile rather than assuming consistency from class names.

## Shared appointment workspace correction (2026-10-18)

`buildPanelReviewWorkspace` combines authenticated incoming queue/history by persisted recommendation ID, with history membership taking precedence. It supplies unfiltered actionable/awaiting-Coordinator counts and a request-view classifier. `PanelBrowse.requestViewForRecord` optionally uses that classifier; its default workflow partition remains unchanged for outgoing recommendations and Office/Coordinator. Confirmed appointments always use lifecycle status. Incoming History displays explicit selectedPanelDecision and panelDecisionAt; cancellation does not imply a decision.

The lecturer-only flatViews presentation has been removed. All Panel consumers reuse RequestViewSwitch, WorkspaceSectionHeader, visible filters, lifecycle dates and shared button/select primitives. Optional controlled view/onViewChange makes incoming route state authoritative over ListState memory; incompatible retained status cannot hide that route's records. PanelLecturerSummaryCards reuses three AppointmentSummaryCard instances, uses own workload data (never assignment-history length), and renders only on Requests after successful loading. PanelSubmittedRecommendations is a visible ordinary list beneath the roster. LecturerAppointmentGuidance accepts a typed Panel context for review, nomination and appointment guidance.

Supervisor request view transitions retain applicable filters, clear incompatible status and reset page without changing existing final-outcome semantics. Student request navigation captures only the overview/Applications browse source and continues to use existing recordReturn validation and history indices. No API, database, access, state-storage migration or dependencies changed. Affected shared consumers include lecturer incoming/outgoing/student-scoped records and lecturer/Coordinator/Office confirmed appointments. Design and evidence are in the 2026-10-18 correction spec/plan.

## Lecturer Panel roster and shared record browsing (2026-10-18)

Navigation language uses short, descriptive labels with role-appropriate scope across Supervisor and Panel workspaces. Shared concepts retain established terms such as Appointment requests; role-specific destinations such as My supervisees and Supervisory teams need not have identical names. Lecturer Panel navigation retains Appointment requests / My supervisees / My Panel students, with matching request/assignment headings and return labels. Scope explanations stay in descriptions rather than lengthening tab labels. This wording policy does not alter routes, access or workflow.

`PanelSuperviseeRoster` consumes the existing eligible-supervisees and recommendation APIs without new endpoints or schema changes. It searches student and appointed Panel identities, derives pending nomination stages before active/no-appointment stages, and retains search/status/page in authenticated-shell ListState. `PanelSuperviseeDetails` presents API-sourced current member identity separately from an ongoing proposed member, and gates nomination controls with both `canRecommend` and absence of a pending request.

`LecturerPanelAppointments` uses the `panelStudent` query for explicit roster detail selection; `panelSuperviseeDetailParams` removes App's reserved `student` parameter, which continues to mean start a nomination from supervision details. There is no automatic first-student selection. Closing a locally started nomination returns to its student detail; existing explicit nomination deep links retain their original return target. Student request history is scoped by matric number and ListState key; the visible recommendation section retains all submitted recommendations, including former supervisees.

Shared browsing preserves Panel member identity for staff monitoring and start/end/outcome facts for confirmed records. Regression checks cover roster search/stage derivation, permission-aware replacement presentation, distinct nomination/detail query contracts, incoming versus outgoing history semantics, explicit route precedence and recorded lifecycle fields. The earlier lecturer-only Show/disclosure presentation has been superseded by the shared correction above.

## Digital Supervisor Section A architecture (2026-10-17)

The appointment module owns a nullable `SupervisorApplication.section_a` JSON submission record. New multipart `sectionA` input is a strict version-1 structure containing title origin, bounded student-declared course rows or explicit none and declaration acceptance. Identity/contact data, declaration text, actor and timestamps are server-owned. Existing research fields remain authoritative application fields. Missing Section A is an explicit compatibility path for older clients and historical records; no historical values are reconstructed from current profiles.

The Student-only `/api/appointments/supervisor/application-prefill/` resolves account/profile/registry particulars and the effective application semester. Exact `/api/appointments/supervisor/applications/<id>/section-a/` uses the existing application permission check and returns only the authorized submitted record. Both sensitive endpoints use no-store cache headers. Standard queue/list/candidate/export DTOs remain unchanged. Private uploads are validated against Office-configured document requirements independently of title origin; file security and creation/approval transactions stay intact.

The existing Student application retains particulars/research/results/supervisor/documents/review sections, now composed into the four steps described in the 2026-10-21 Research Intent extension above. Shared exact request details load Section A separately, use submitted identity/programme/session in their summary, and display results/declaration with explicit loading/retry/missing/legacy states. Dirty-draft protections include new inputs. Office replacements retain their separately documented Office workflow. The implementation uses existing React/DRF/portal conventions without new dependencies. Design, compatibility decisions and verification contract: `docs/superpowers/specs/2026-10-17-supervisor-section-a-design.md`.

## Connected operational period architecture (2026-10-16)

Programme cohort identity uses whitespace trimming and Unicode case folding consistently for matching, catalogue validation, overlap rejection and duplicate validation; stored display names are preserved.

academics/operational_period_models.py and operational_periods.py own appointment periods, per-semester/activity enforcement flags, bound participant/student exceptions and immutable period audits. Office APIs live under /api/academics/operational-periods/. Both serializer validation and transaction-locked creation recheck intake; semester locks serialize period/closure changes with creation, while review paths keep existing rules. Programme identity is resolved independently from lecturer department. Initial enforcement is opt-in; no historical workflow is retroactively gated.

Dashboard timeline entries have mutually exclusive nullable PROTECT links to OperationalPeriod or existing Marks EvaluationPeriod. Owning dates/status project into serializers, dashboard actions, reports and team calendars. Timeline link mutations serialize against period rows; linked Marks drafts cannot move semesters. Signed 15-minute upload previews bind actor, file digest, semester and fingerprints of current timelines/entries/periods. Confirmation refreshes locks and validates warnings before atomic replacement; linked histories are preserved or replacement is rejected. Informational event extensions record reason and original/new facts. Calendar-only expiry is Ended.

OperationalPeriodManagement is the Office extension hub in Timeline Management. Shared forms route appointment changes to academics, Marks changes to existing Marks period/completion-window services, and informational extensions to the timeline endpoint. Closed-semester read/recovery remains available with other mutation controls disabled. Existing Marks configuration retains draft/rubric/targeting/lifecycle work and delegates live deadline changes to the hub. OperationalIntakeFeedback fetches authorised contextual availability without clearing drafts; creation endpoints remain authoritative on races/read failures.

announcements/connected_reminders.py derives opening, phase-specific closing and extension events from current committed period/task/audit facts. Existing calendar-only entries use separate audience/date events; linked entries do not duplicate notifications. DeadlineEmailDelivery persists optional email retries; delivery rechecks recipient/event membership, current work/role eligibility and current deadline content. Invalid queue rows do not consume the send-attempt limit. Student feed, direct notification access and weekly summaries suppress retained staff-only Marks/Panel notices. DeadlineReminderRun records actual-job status/counts; --dry-run performs no writes or deliveries. A PostgreSQL advisory lock prevents overlapping actual jobs. Windows scripts use the repository venv, explicit working directory, hidden execution and preview-by-default registration; real delivery needs explicit activation and configured mail infrastructure.

## Historical ownership/link proposal (2026-10-16, superseded by implementation above)

docs/SEMESTER_PERIODS_IMPROVEMENT_PROPOSAL_2026-10-16.md proposes keeping Marks EvaluationPeriod/TaskCompletionWindow records and audited services authoritative, adding scoped Supervisor/Panel operational periods and projecting owning dates through a shared availability interface. Linked timeline entries would delegate changes to governed module services; informational entries retain standalone dates. Proposed upload preview/confirm, action mapping, exceptions, notification events and safe opt-in migration remain design work. No application architecture, schema or runtime behaviour changed in this planning task.

## Cross-programme appointment regression coverage (2026-10-16)

test_cross_programme_appointments exercises the existing Supervisor and Panel candidate APIs and complete submit/accept/approve workflow for AI and Cyber Security students using the same Supervisor and Panel lecturer. It asserts both programmes receive active appointments while each unrelated programme coordinator receives HTTP 403 for both approval types. Existing production candidate queries, serializers and client search filters impose no lecturer programme match. This is verification of existing behaviour; no application or schema changes. The test reuses fixture setup without inheriting its test methods, isolates uploaded documents in temporary storage and runs through Django's separate test database. Related capacity and programme-scope regressions remain unchanged.

## Shared Office attention student overviews (2026-10-16)

AppointmentAttentionOverview composes the existing summary/research cards, badges and student-record action into a read-only overview with separate current appointment and ongoing-request sections. RequestSummaryCard accepts an optional title and semester visibility without changing existing request defaults. OfficeSupervisorStudentOverview loads the existing authorised single-student team endpoint, uses only the matching student's pending primary application, and retains current saved research rather than substituting a submitted snapshot. OfficeSupervisorWorkspace reserves student-MATRIC within the existing record route for this overview; request-N remains the exact request route. Nested request navigation records the overview as its return target.

OfficePanelAttention always opens profile-N for Without Panel rows. The existing exact profile endpoint resolves the latest pending recommendation or current appointment. PanelAppointmentDetail renders the shared overview for profile routes and preserves full recommendation/appointment details for exact request/appointment routes. Panel loaders track request version and loaded identity so navigation between overview and request cannot display an older record response. Both loaders expose retry; the Supervisor overview also refreshes on window focus. recordSourceLabel identifies overview return targets; existing route validation and permissions remain authoritative. No backend, schema, dependency or academic mutation changes.

## Shared table action alignment (2026-10-16)

CoordinatorDataTable explicitly left-aligns Action headers/cells and overrides direct action-group wrappers to justify-start, preventing caller-level justify-end groups from drifting away from their heading. The selector applies only to columns labelled Action, so non-action final columns remain unaffected. WorkspaceRecordTable also left-aligns its final action cell to match its heading. No column widths, handlers, capability checks or data changes.

## Office lifecycle-only administration section (2026-10-16)

OfficeAppointmentAdministration now renders only SupervisorAppointmentRecordCard when a persisted appointment exists. Removed its auxiliary email/workload/Panel detail disclosure and unused PortalCard import. The Office Panel detail path already renders its shared appointment record without an Administrative details card; no Panel UI change was necessary. Lifecycle permissions, ending callbacks, history and underlying DTO fields remain unchanged.

## Shared workspace Tools disclosure (2026-10-16)

WorkspaceToolsMenu extracts the existing OfficeSupervisorTools renderer and its viewport positioning, outside-pointer dismissal, Escape/focus return, controlled closed disclosure, grouped icon rows and descriptions into a configurable group/item component. OfficeSupervisorTools supplies its existing three actions and re-exports the original officeToolsMenuLeft name for compatibility. OfficePanelTools supplies workload and optional capacity entries; empty groups are omitted. PanelAppointmentManagement replaces its separate native details/plain-button Tools markup with this wrapper. Existing navigation callbacks and capacity gates remain unchanged. No API, permission or dependency change.

## Shared appointment XLSX generation (2026-10-16)

excelExport builds real .xlsx workbooks in the browser using lazy-loaded ExcelJS 4.4.0, following its [browser writer and cell value documentation](https://github.com/exceljs/exceljs/blob/master/README.md). Existing CSV-compatible scalar column adapters remain reusable. The shared writer adds a frozen styled header, column filters, wrapped values and bounded column widths; strings are assigned directly as string cells without formula objects. Worksheet/cell limits fail explicitly. Download URLs and anchors are cleaned up on success/failure. useExcelExport shares pending/error handling for client-side Panel/legacy/workload paths; existing Office controls retain their asynchronous feedback.

officeSupervisorExports retains its complete-page envelope validation and existing columns, then awaits the XLSX writer. Existing server-generated multi-sheet supervision workbooks remain in place. Every Supervisor/Panel client export and label now uses Excel; unrelated import/review CSV workflows are unchanged. ExcelJS loads only on export, producing a separate ~271 KB gzip chunk. Its uuid dependency is overridden to compatible CommonJS 11.x for the existing v4 call; the lockfile also updates source-map-js to its patched 1.2.2 version. Dependency audit is clean. No backend/API/schema or permission changes.

## Appointment filter footer exports (2026-10-16)

All five export renderers (OfficeWorkspaceExport, SupervisionWorkbookExport, PanelBrowse and the two Office attention views) select PortalButton's existing primary variant for its blue/navy background, white text and shared hover/focus/disabled behaviour.

WorkspaceFilterActions provides a wrapping filter footer with Clear filters and an optional separate action area. CoordinatorFiltersBar accepts an optional actions slot. Supervisor requests/history and supervision group/student lists pass their existing CSV/Excel controls into that slot; Office Supervisor/Panel attention and PanelBrowse reuse the same footer. Section headings retain only view navigation. Existing OfficeWorkspaceExport and SupervisionWorkbookExport keep their data/download logic and status/error feedback, with shorter format labels, download icons, hover titles and aria-description scope text. No permission, API, export schema or dependency changes.

## Shared research abstract reading area (2026-10-16)

ResearchAbstract is a presentational component shared by ResearchDetailsCard, StudentResearchProfileSection, SupervisoryTeamManagement, ActiveSuperviseeDetail, RecommendPanelMemberDrawer and RequestedChangesComparison. It uses full available width, text-sm/font-normal/leading-7, whitespace preservation and overflow-wrap:anywhere, with a subtle inset surface by default. Comparisons suppress the extra surface inside their existing original/requested snapshot containers. Empty values remain Not recorded. Supervisory research disclosure metadata uses a responsive grid with the abstract spanning both columns. This supersedes the earlier max-w-prose abstract treatment; compact labels and facts retain appointmentDetailTypography. No data, permission, dependency or API changes.

## Shared appointment request sections and status vocabulary (2026-10-16)

AppointmentRequestSections exports RequestSummaryCard, RequestSummaryField and ResearchDetailsCard. SupervisorRequestDetail and PanelRecommendationDetail use them for common identity/participant presentation and a separate research card. Both use existing appointment typography and PortalCard large padding. Full abstracts preserve paragraphs in a lightly shaded reading area; submitted Supervisor documents retain their application-specific download identity. Secondary authorised Panel contact facts are collapsed, while nomination/replacement/rejection/cancellation reasons render before approval progress in the review card. Administration/lifecycle remains separate. RequestDetailCard supports absent content without an empty leading section. Staff Supervisor hosts pass dossier navigation into a new contextAction slot with existing busy guards, matching Panel.

appointmentRequestStatus supplies role-independent labels/tones and evidence-aware timeline action labels. Existing lecturerRequests, Panel workflow/presentation helpers, badges, status filters, list exports and audit readers reuse it. Supervisor and Panel approval builders retain state/event/actor/date logic, with common submission/reviewer/coordinator wording. UI and legacy Panel helper terminology use approval instead of confirmation for request decisions. SELECTED_PANEL and the legacy rejectionStage discriminator remain internal API identifiers. Panel appointment dates/lifecycle remain separate from request status. No API, schema, dependency or permission changes.

## Office Panel attention navigation correction (2026-10-16)

OfficePanelAttention no longer accepts a student-navigation callback. Its student rows open the existing exact recommendation-N or profile-N route with one non-wrapping action. PanelAppointmentManagement continues passing dossier navigation to PanelAppointmentDetail, where the existing contextual action is retained. No route, API or permission change.

## Shared dropdown presentation (2026-10-16)

Existing native single-choice controls now use PortalSelect, a compatibility adapter around the existing SelectMenu. It converts option children (including fragments, implicit values and disabled groups) into styled menu options, while retaining an inaccessible, visually clipped native select for actual React change events, browser constraints and FormData. The visible combobox precedes the native control so wrapping labels activate the correct element; required validation focuses it and displays an associated inline message. Numeric values remain native string values. Uncontrolled form resets synchronize the visible selection. Shared FormSelect propagates its label/error associations.

SelectMenu retains arrow/Home/End/Page/typing navigation and selected checkmarks. It ports lists into the nearest open native dialog when applicable, otherwise body, repositions on scroll/resize, bounds menu height to available space, scrolls only its own list and respects reduced motion. Opening selects an enabled option; disabled clicks cannot close/commit the list, and Escape is contained within the open menu. The same menu styling serves previously migrated registries and all 86 newly migrated controls across 34 components. No API, schema or dependency change.

## Shared request status badges and Panel record navigation (2026-10-15)

RequestStatusBadge composes the existing StatusBadge with workflow-aware tones and existing readable stage labels. WorkspaceRecordTable serves Lecturer, Student and fallback Coordinator requests; CoordinatorRequestTable serves Office/Coordinator browsing. Office attention, legacy Office records, past-appointment outcomes and carryover stage cells reuse the badge. Tables without a status field retain their existing columns. PanelBrowse renders one non-wrapping record action. Existing ViewStudentRecordAction is passed into review, submitted recommendation and assignment detail context headers; hosts retain the same student-navigation callbacks and backend access controls. No API, database or academic workflow change.

## Panel consistency implementation (2026-10-15)

Panel-specific factual DTO adapters feed the common PanelRecommendationDetail, PanelAppointmentRecordCard and metadata helpers. These reuse Supervisor-neutral RecordPage, request sections, typography, ApprovalProcess, collapsed audit and DecisionDialog primitives. Staff recommendation, Office record and assignment projections share the recommendation serializer; Student projections remain separate. Actual recorded actors/dates drive progress, and unavailable legacy facts stay explicitly unknown. Replacement predecessors are labelled separately from current appointments. Backend-derived review/end capabilities preserve participant, programme and delegation guards.

PanelWorkspaceNavigation and PanelBrowse provide role sections, request/history and current/past views, saved filters, 10/25/50 pagination and matching CSV export. Office opens OfficePanelAttention; its new read-only panel_workspace service computes current eligible students without an active Panel, stage-aged pending requests and current-semester capacity concerns. SQL paging and global facets precede filter application; capacity uses the existing published-policy resolver. Existing array endpoints remain compatible. Exact Office record and authorised staff assignment endpoints preserve stable request links after approval. Record query merging preserves exact appointment identity and return context. Workload and nomination forms use the same shared presentation without changing their validation contract.

No new schema, dependency or academic mutation rule. The approved design and implementation plan are in docs/superpowers/specs/2026-10-15-panel-appointments-consistency-design.md and docs/superpowers/plans/2026-10-15-panel-appointments-consistency.md. Verification and limits are recorded in PROJECT_STATUS.md.

For the authorised latest-main restart, the current branch now includes `f54bf72`, existing local edits are restored and both project status histories are retained. Installed main's already-declared reportlab/pypdfium2/Pillow/pypdf dependencies and applied documents.0001-0004 plus letters.0004 to the existing local development database after a custom-format backup outside the repository. Existing guarded development launcher serves API 127.0.0.1:8000; Vite serves 127.0.0.1:3001. No dependency manifest edits were needed.

## Shared Student research profile section (2026-10-15)

`StudentResearchProfileSection` is a presentational section used by StudentSupervisorsOverview and StudentPanelAppointmentOverview, reusing `appointmentDetailTypography`. It shows one title, a responsive two-column facts row and a prose-width abstract without nested disclosure/card borders; semantic definition lists preserve label/value hierarchy. Panel overview opts into the existing detailed section/member styles to match Student supervision spacing and weights. The existing GET /api/appointments/panel/student/ adds an allowlisted nullable `researchProfile` object (title/programme/area/abstract), serialized from the authenticated Student's saved StudentResearchProfile. The no-profile payload returns null; the existing researchTitle field remains for compatibility. No schema, dependency, approval or pending Panel privacy change. Existing scoped API/rendering tests cover this extension.

## Cross-programme test data provisioning (2026-10-15)

Created the approved local-only account set through the existing Django UserManager (`create_user` hashes the generated password), role profile models and model validation in one database transaction, guarded by DEBUG/demo mode and a local database host. Students have StudentRegistry rows; Lecturers have Supervisor/Panel profiles; Coordinators have Lecturer/Coordinator profiles. No runtime code, schema, authentication, authorization or capacity-plan change. Login accepts their existing email/matric/staff identifier mechanism. The credential roster is `backend/.env.cross-programme-test-accounts-2026-10-15.md`, covered by the existing `.env*` ignore rule; no password is stored in tracked documentation. Published semester capacity remains authoritative, so new Lecturer profile limits do not themselves enable appointments.

## Shared decision process implementation (2026-10-15)

`DecisionDialog.tsx` composes the existing native `PortalModal`, shared buttons, RecordDraft and outcome feedback. It distinguishes `review` from `confirmation`, supports contextual fields and explicit consequences, holds asynchronous saving/error state and one synchronous duplicate-submit latch, preserves typed fields on failure, and uses an in-dialog discard prompt. The last open immutable record identity persists through closing/reopening; 403/409 submission blocks clear only after explicit successful latest-record reload or a different record identity. `decisionSubmission.ts` provides `completeDecision` (save errors propagate; reload errors return `refreshFailed`) and the tested submission latch. `DecisionOutcome.successMessage` can carry a result-specific handoff message such as research-profile readiness.

`DecisionFeedbackProvider` in the authenticated AppLayout retains one success/warning toast when a saved record leaves its host; publishing is limited to the current layout/session/role scope. Stable detail hosts and strict background refresh preserve dialogs, explicit latest-record review and the distinction between failed save and failed reload. Office Marks additionally disables further correction/reopening until a strict reload succeeds after a saved-but-refresh-failed outcome. Module callbacks keep business APIs, exact role/action capability checks, versions, expected stages, required reasons and transfer acknowledgements. Existing confirmation sites in Supervisor/research/supporting, Panel review/cancellation/lifecycle, Marks/completion/backup, Timeline deletion, Workflow repair and existing capacity authorisation use this shared layer; ordinary drafts retain their existing forms.

Backend `appointments/panel_access.py` centralises linked-Student/programme agreement for Coordinator object and SQL queue scope. Recommendation mutations and Panel ending recheck authoritative access after workflow locks; profile changes and invalid/unlinked Student identities fail closed. Active delegation rules remain in accounts.authorization. Office/assigned audit and legacy list monitoring remain. No migration or added dependency.

## Approved supervision hierarchy refinement (2026-10-14)

`appointmentDetailTypography` now separates name (14px/600), heading (16px/600), label (12px/600) and body (12px/400); disclosure headings use 14px/600. All use the portal's Inter family. Primary/Panel detail cards and the shared appointment record reuse those styles. `RequestSection` accepts an optional heading class without changing its default. `AppointmentSection` accepts an opt-in detail presentation used by Student My supervisors; its person cards and expanded research fields use the same typography. Existing staff layout, spacing, contracts, backend decisions and authorization are retained; no global CSS change.

## Shared supervision typography and spacing correction (2026-10-14)

`AppointmentPrimitives` exposes scoped `appointmentDetailTypography` and an opt-in detail presentation for `AppointmentMemberCard`. Primary Supervisor and Panel use that same name/status structure; the Panel name is no longer a small bold field value. The shared staff student-detail card uses 32px desktop outer padding, 24px member padding, regular facts, semibold headings, footer actions and grouped disclosure rows. Active supporting rows opt into the same lighter typography without nested card borders. `SupervisorAppointmentRecordCard` reuses detail typography and large padding; `RequestDetailCard` forwards an optional existing PortalCard padding setting, preserving its default elsewhere. Nested history emphasis is reduced within these detail cards. No global CSS, backend, authorization or workflow changes.

## Exact supervision Panel projection (2026-10-14)

Extend existing exact team serialization with staff-only studentEmail and panel: current active appointment, ongoing reserved-status nomination/replacement and server-derived start capabilities. Only exact staff team endpoints request include_details; routine roster projections and Student payloads do not gain pending identities/contact data. Shared panel_access preserves the existing recommendation-detail authorization for API and UI link capabilities. Lecturer detail resolves the authorized roster Student ID, then fetches the exact team response with identity/version guards. SupervisionPanelSummary renders state-aware controls in the shared card; host callbacks retain role-specific Panel routes and validated return context. Header actions and visible email use existing portal styling, with no dependency/schema/new endpoint or decision-rule change.

## Student overview profile disclosure (2026-10-14)

StudentSupervisorsOverview renders a bordered Research profile disclosure beneath the visible current title using existing SupervisoryWorkspace team research data and shared RequestField typography. Remove the obsolete overviewOnly suppression from the Student route. No additional request, API/backend/schema/dependency change; current profile persistence, scoped team loading, Student privacy and existing research routes remain unchanged.

## Lecturer dashboard summary integration (2026-10-14)

Extend the existing authenticated GET /api/dashboard/summary/ with activeSupervisees, activePanelAssignments and assignedMarkTasks. The Lecturer branch reuses visible_students for distinct active primary/supporting roster scope and filters PanelAppointment by panel_member and ACTIVE status. Task totals retain the existing evaluator/lifecycle scope and submitted/incomplete split; other roles retain existing counters. No client-supplied Lecturer identity, new endpoint, schema or dependency. LecturerDashboardSummaryCards renders counts and separate review/incomplete badges; its owner loads the existing service with explicit loading/error/Retry and request-version guards, reloads on mount and return to focus, and navigates View supervisees directly to the roster. Capacity requests remain independent so their failure does not hide a successful summary.

## Supervisor detail correction (2026-10-14)

The first shared-detail implementation retained divergent Office lifecycle and Lecturer supervision blocks. Replace those with SupervisorAppointmentRecordCard and SupervisoryStudentDetailCard, normalized from existing scoped payloads. Place View student record consistently through ViewStudentRecordAction. Keep immutable IDs/events internally; translate audit labels for display. Compact missing-history presentation and request metadata; no visible reference/copy controls. Student visibility, existing endpoint authorization, action/draft guards and document identities stay intact. Preserve Lecturer contact/semester/date context and Panel recommendation in shared sections; staff primary endings use the existing guarded endpoint. Office-only administrative data appears separately when present.

RequestSection supports an optional header action slot for profile navigation. RequestField separates summary facts from narrative text; requestBodyTextClass is shared by primary submitted research and immutable change comparisons. Existing portal fonts and unrelated modules remain unchanged. Normalize Lecturer roster status Active into ACTIVE at the appointment presentation boundary and validate both student and current appointment identity before using roster context. Exact staff DTOs retain their recorded lifecycle audit; Lecturer date-only context does not fabricate one.

## Shared Supervisor request presentation (2026-10-14, implemented)

Introduce neutral metadata/card/section/audit and approval-step presentation, plus workflow adapters for primary, supporting, research and transfer records. Extend RecordPage with a metadata slot outside the content card without altering guards. Existing scoped endpoints remain; role hosts normalize permitted payloads and supply permitted action slots. Requested changes remain separate from live profiles and lifecycle endings. Detailed spec/plan: docs/superpowers/specs/2026-10-14-supervisor-shared-record-details.md and matching plan.

`approvalProcess.ts` derives steps from persisted status and immutable events; `ApprovalProcess` only renders those steps. Account role does not determine acting workflow stage. Historical research review is identified from the stored transition and labelled as belonging to the earlier process; current research has no additional Coordinator approval. Unknown coarse Office statuses do not fabricate a reviewer. Outcomes omit repeated actor/time visually when already shown at the deciding stage; event data remains available in the full collapsed audit.

`SupervisorRequestDetail` normalizes primary detail content across four role hosts, with exact document identity and caller-owned actions. `RequestedChangesComparison` displays changed immutable request/revision fields, keeping live profiles distinct. Supporting exact records reuse the same metadata/section/process/audit primitives; historical supporting details validate the selected record identity before displaying it. Primary lifecycle/admin details and supporting appointment endings retain dates/reasons and lifecycle audit without inventing request approval stages. No new API, schema or dependency for this refactor.

## Shared stage-waiting presentation (2026-10-14)

formatRequestStageWaiting centralizes terminal labels and valid ongoing calendar-day formatting. WorkspaceRecordTable accepts a raw workflowStatus separate from the human-readable Current stage; Student, Lecturer, Coordinator and research/transfer row adapters supply it. Paged staff requests, legacy Office records and Office waiting attention tables reuse the same formatter. Terminal outcomes take precedence over stale age values; inactive history without a recognized outcome falls back to No longer waiting. No API, timestamp, schema or ageing calculation changes.

## Office Tools visual polish (2026-10-14)

OfficeSupervisorTools uses aligned decorative Lucide icons, consistent title/description spacing and a quieter inset divider between Monitoring and Configuration. The menu is 288px where space permits and still clamps to 16px viewport insets. Visible keyboard focus, Escape/outside dismissal and existing navigation remain unchanged; no dependency or behavior change.

## Contextual supervision exports and automatic reload (2026-10-14)

The guarded Office/Coordinator supervision-export endpoints reuse scoped team membership/filter semantics and existing XLSX support, independently of UI pagination. Workbook rows come from persisted ACTIVE SupervisorAppointment and CoSupervisorAppointment; matched student teams are fetched in bounded queries, with text cells protected from spreadsheet formulas. SupervisionWorkbookExport uses the authenticated requestBlob path through supervisionExportApi, retaining filters while dropping page/size/view. It handles busy/error/success states beside team records rather than in OfficeSupervisorTools. Tools retains its viewport-clamped accessible disclosure with described Monitoring and Configuration groups. Manual refresh controls are removed while loaders, mutation callbacks, error recovery and conservative draft-safe return-to-focus updates remain.

Shared team_selection/filter_team_relationship helpers keep search eligibility, paged team browse and workbook membership aligned; lecturer-name Exists expressions use filtered active appointments. The student sheet deliberately includes the complete active team after eligibility, even for a selected lecturer/semester. listenForReturnToFocus deduplicates visibility/focus events, skips initial focus, cleans up subscriptions and uses current enabled/draft guards. MarkEntryPeriodConfig keeps saved-config checks and request generations while loading recipient previews automatically; ClosureReview invalidates old approval state, resets acknowledgements and reloads a 409 preview before another confirmation. Existing server concurrency checks remain authoritative.

## Office attention projections and navigation (2026-10-13, implemented)

Add Office-only attention-summary and attention endpoints under the existing office-workspace namespace, requiring active Office role plus is_staff. Student absence uses enabled Active Student and Exists(active primary) rather than application statuses. Compact waiting rows union current pending primary/supporting/research/transfer records and preserve effective legacy research stages. Capacity projection uses published current-semester policy and total active primary/supporting load, distinguishing missing configuration from full load. Count/filter/sort before paging.

OfficeSupervisorAttention reuses portal table/filter/footer components and separate ListState category scopes. The Office root is Needs attention; /supervisor-appointments/requests retains requests/history without parsing requests as an application ID. OfficeSupervisorTools supplies secondary tools and on-demand legacy full CSV; matching-page exports collect all filtered pages before download and reject incomplete/changing envelopes. Exact record/dossier/workload links carry return context; tools and capacity remain separate. Shared filters accept an optional Intake semester label while their defaults stay unchanged. The tools menu clamps to the viewport on open/resize. No dependency, model/schema or academic decision changes were made.

## Staff research navigation (2026-10-13)

supervisorWorkspaceLinks supplies two Office main sections and a Coordinator Programme transfers section using the existing research-changes route. supervisorResearchLabel supplies role-specific source/Back labels. OfficeSupervisorWorkspace opens Research records with its originating appointment/team context; StaffResearchWorkspace renders the Office tool through RecordPage with profile/refresh actions and existing paged request/history views. Coordinator keeps the shared tabbed module shell. LecturerResearchWorkspace normalizes Coordinator list/Next queries with coordinatorTransferQuery; the paged API client repeats the normalization to enforce TRANSFER and decision focus, clearing research-only pending statuses. Transfer-only filters hide request type and research-only status facets. Exact authorized detail requests remain independent of list filters. Existing backend scope, decisions, immutable events, transfer guards, routes, schema and dependencies are unchanged. The shared new-research subtitle now describes final primary Supervisor review.

## Programme-transfer handoff design (2026-10-13, proposed)

The proposed first increment moves transfer presentation/navigation to Registry while reusing the existing appointments amendment API, tables, immutable events and atomic programme/profile update. Preserve pending-transfer nomination guards, scoped Coordinator decisions, legacy request links and workflow/report consumers. Model/table extraction and transfer approval for students without research profiles are outside the proposed move. The handoff records file ownership, contracts and cutover checks; no runtime changes are implemented.

## Main integration and development runtime (2026-10-13)

The working branch fast-forwarded to origin/main commit 93049a242259ca6b7256d4caf53318b8743fa491, then restored its existing local changes. PROJECT_STATUS.md was the only conflicting file; both histories were retained. The declared python-docx dependency is installed locally, and incoming accounts, announcements and letters migrations are applied. No additional schema changes were authored for the merge.

Development runs Django at 127.0.0.1:8000 and Vite at 127.0.0.1:3001 using bundled Node 24.19.0. Process-scoped FRONTEND_URL=http://localhost:3001, API_PORT=8000 and VITE_API_BASE_URL=/api connect the portal through the existing Vite proxy. Port 3000 belongs to an unrelated Docker application. These runtime overrides do not modify committed environment configuration.

## Supervisor-only research review (2026-10-13, implementation)

Research amendment approval applies the profile revision and terminal APPROVED event atomically at primary Supervisor review. can_decide separates RESEARCH primary-assignment authorization from TRANSFER programme-Coordinator authorization; research_paging decision scope includes only transfers. review_status maps legacy research PENDING_COORDINATOR to the effective Supervisor review stage for labels/ageing/UI and report distributions while retaining raw detail/stored status for stale-decision guards and historical audit. Labels/grouping/filter wording reflect final Supervisor review. No schema migration, role expansion, automatic approvals or transfer-process changes.


## Manual course-code implementation (2026-10-13, complete)

SupervisorApplication.project_course_codes and migration appointments.0016 add a blank-default CharField(255). DRF exposes optional projectCourseCodes with server trimming; existing multipart submission and Student conversion carry the value. Student form state includes replacement prefill and dirty-draft protection. Student/Supervisor/Coordinator/Office detail views render the value with a Not recorded legacy fallback. Shared exact staff projections already reuse the serializer. No new dependencies, endpoints, approval states or document policies.


## Proposed appointment-form alignment (2026-10-13, planning only)

Retain the current SupervisorApplication state machine and atomic final Coordinator approval/handoff. Revised primary proposal adds project_course_codes as a bounded text field on SupervisorApplication, transmitted as projectCourseCodes through the existing multipart API and exact-record views. No programme mapping, course catalogue, separate title-confirmation record or changed upload policy is proposed. Legacy values remain blank rather than guessed. Optional identity/contact snapshots and audited non-gating Office metadata are later suggestions, with sensitive data restricted to authorized exact views. Dean roles/sign-off and new academic approval states remain excluded.

Reuse private immutable uploads, current exact record pages and ResearchAmendment/ResearchProfileRevision for later title changes; an optional print view would use original application/review data and omit Dean sign-off. The earlier review proposed no runtime changes; the manual course-code increment is now implemented as described above. Updated contracts, deferred scope and tests: `docs/superpowers/plans/2026-10-13-supervisor-appointment-form-alignment.md`.

## Shared staff Supervisor browse projection (2026-10-13)

The Coordinator projection is reused through a separate office-workspace namespace requiring active Office role plus is_staff; Coordinator endpoints retain their Coordinator-only guards and programme/delegation scope. browse_scope_q provides Office's existing all-programme read scope, with decision_q false for Office and all ongoing monitoring regardless of saved focus. Compact page/detail APIs preserve routine withdrawal hiding and audit access; Office exact primary detail includes existing contact/workload fields. Research pagination/minimal options are opt-in for Office and Coordinator, preserving unpaged legacy contracts.

StaffSupervisorBrowseContext and staffSupervisorWorkspaceApi supply role-specific loaders and scope labels to the same browse components. OfficeSupervisorWorkspace handles monitoring, shared supervisor drilldown/past appointments, separate capacity/admin tools and exact primary/supporting detail. Legacy notification keys remain supported; new primary routes use request-<id> to distinguish application from appointment identity. Existing Office detail/lifecycle controls receive a mapped exact record, with targeted refresh after changes. CapacityReassessments can load one target while preserving existing reason/conflict/authorise/revoke handling. Research profiles is a separate entry for Office corrections/transfers. Return labels identify administration and past appointment sources. No schema or dependency changes.

## Coordinator browse controls simplification (2026-10-13)

CoordinatorFiltersBar uses a responsive one/two/four-column grid with always-visible status/date controls when applicable and a right-aligned Clear filters action row. Focus and More filters UI state were removed. Coordinator request and paged research service reads normalise focus=decision, including saved Next queues, while exact detail and legacy role APIs remain intact. CoordinatorTeamsToolbar places the light view switch outside cards; supervisor grouping is fixed. Past appointment labels and ended-date filters distinguish lifecycle records from request outcomes. Existing fonts, scope, paging and scoped student search are preserved.

## Scoped Coordinator browse projections (2026-10-13)

appointments.coordinator_workspace and coordinator_workspace_views add Coordinator-only GET page/detail endpoints. SQL scope, routine cancellation exclusions, relationship filters, stable sorting, counts and slicing precede compact row serialization. Supervisor groups use User identity and distinct Student relationship counts; group and drilldown filters match. Exact primary/supporting/team/appointment/carryover details reuse authoritative serializers and active participant decision checks. No migrations or dependencies.

Research collection pagination is opt-in for Coordinator via research_paging; legacy envelopes remain unchanged. Paged list options avoid whole-profile/student/revision loads; details load the exact request independently of list filters. CoordinatorSupervisorWorkspace uses shared CoordinatorFiltersBar, existing Portal/table typography, debounced guarded page reads and authenticated ListState. LecturerResearchWorkspace retains URL filters and performs each filter change atomically, including Clear filters. RecordPage handles dedicated drilldowns/secondary tools and browser Back; source context and bounded queue page positions are retained. Missing or stale queue successors do not wrap or synthesize targets. History display dates match query dates, with the recorded update timestamp for legacy requests lacking a decision timestamp.

## Routine request visibility projections (2026-10-12)

appointments.request_visibility centralises routine staff exclusion for SupervisorApplication CANCELLED_BY_STUDENT and ResearchAmendment CANCELLED with an immutable CANCEL event whose actor_role is Student. Supervisor Lecturer/Coordinator histories, Office records, workflow report scopes, dossier collections and staff supervisory-team activity use the shared projection. Research scoped_requests defaults to routine filtering, automatically covering lists, report/export summaries and dossiers; detail explicitly uses routine=False after the same role/programme/relationship scope to preserve authorised audit access. Student projections remain intact. No data deletion, permission widening, migration or dependency changes.

## Research profile summary layout (2026-10-12)

ResearchAmendmentRouteContent Student list uses a responsive flex summary: card-label for context, section-label for the wrapping title, a separate flex-wrap action group and existing PortalButton styles. lg places actions beside the title; smaller widths place them below. The summary is an accessible labelled section. No new typography, API, dependency or eligibility logic.

## Panel review decision state (2026-10-12)

PanelRecommendationReviewDrawer uses explicit rejection-editing and acceptance-confirmation state. Recommendation identity/status and open-state changes reset decision drafts. Inline rejection entry reuses PortalButton, preserves reasons after API failures and clears them on Cancel; all decision controls respect busy state. Acceptance uses PortalConfirmModal and existing mutation callbacks; no backend workflow or permission changes.

## Panel candidate selection state (2026-10-12)

RecommendPanelMemberDrawer starts with a null candidate and separate search text; candidate refresh reconciles an existing selection without choosing a default. Selection clears search to show all options when reopened. Remove selection clears candidate/search/dropdown/attempt state, retains notes and respects busy state. Candidate card and option expose explicit selection cues; form guidance distinguishes selection and missing notes. Existing eligibility checks and submit payload remain authoritative.

## Main integration conflict resolution (2026-10-12)

Resolved concurrent edits in StudentFAQChatbot, StudentRegistry and LetterTemplateManagement by preserving main functionality and branch navigation/typography conventions. Registry retains dynamic column spans, real import history/counts, activation wording and read-only registration guards; supervisor filtering uses useListState with existing filters. Template validation callbacks, accessibility invalid state and expanded status type retain shared editor typography.

## Student supporting appointment projection (2026-10-12)

co_supervision workspace and team serializers return empty Student nominations and redact supporting appointment staff reasons, nomination IDs and lifecycle audit. Direct nomination serialization denies Student access. Dashboard scoped_nominations returns none for Students. Staff nomination notifications retain existing recipients except Student; approval publishes an appointment-result notification and lifecycle endings use a factual Student message. Notification feeds and direct-read queries exclude legacy Student nomination notices; appointment notification serialization sanitises legacy reasons. Student My supervisors renders factual former appointments without the staff appointment-card projection; Applications no longer mounts supporting history. No schema or dependency changes.

## Office record return feedback (2026-10-12)

The Office appointment RecordPage invokes the existing navigateToList callback directly on Back. It does not set toast state for navigation; return context and record draft/busy guards remain unchanged.

## Supervisor search row identity (2026-10-12)

Office table row keys use applicationId when available, with the existing legacy route key as fallback. A student/appointment route key cannot identify distinct primary application rows; using it caused React to retain unrelated rows during filtering. Row identity remains stable across decisions. Research search shares the change-type projection with its table and indexes displayed research reference forms; authorised data loading and role/history scope remain unchanged.

## Supervisor role hierarchy (2026-10-12)

SupervisorWorkspaceNavigation supports all four role labels on existing routes. Student application and Coordinator primary/supporting projections use RequestWorkspacePrimitives; Office record tables retain administration columns and shared table typography with stacked mobile cells. The controlled research wrapper supports role-specific capabilities and common URL-backed view/search/student/page/size controls. Staff research lists share the Supervisor module heading/navigation; forms/details retain RecordPage. Supervisory team rosters display the primary supervisor for staff and the recorded relationship for lecturers.

The new coordinator-history GET endpoint selects explicit terminal primary application statuses within coordinator_scope_q, including acting delegations. coordinator-records remains the approved appointment endpoint. No migration or dependency change. Office filters use actual loaded programme/semester values, and semester now applies to results. Selected-tab refresh is forwarded to team/research/carryover loaders; child refresh actions are suppressed and busy/draft state disables the owning action. Existing detail guards and return-context helpers remain authoritative.

## Global record navigation follow-up (2026-10-11)

App dispatch uses StaffResearchWorkspace for permitted Coordinator/Office research routes and existing authorised research endpoints. Dashboard research action targets use the same record route as notifications/reports. Coordinator supervisor deep links use getSupervisorApplication alongside its authorised queue/history, with decision availability still derived from queue membership and participant eligibility. Staff supervisor/panel/marks records and local Marks/upload/announcement forms share RecordPage; nested lifecycle/correction controls report drafts and busy state. Local staff research creation closes only after successful API completion in the original mounted scope, before refreshed capabilities can hide the form; API failures retain the draft.

ListState is a Map provided by the authenticated AppLayout. useListState caches only module-scoped UI list controls across route remounts; it never stores records, credentials or draft form contents in browser persistence. Logout unmounts the provider. Local source lists remain mounted where practical so focus and controls survive detail pages. Explicit route status changes reset staff Marks controls; ordinary returns retain them. Panel pagination clamps after loading settles. Login help uses PortalModal.

Inventory: docs/superpowers/specs/2026-10-11-global-navigation-audit.md. Existing route/authentication/business workflow architecture and backend schema are unchanged.


## Record page navigation (2026-10-11)

- AppLayout hosts RecordPageProvider inside its existing main element. Local record/form pages render into a sibling host; the mounted originating list becomes hidden and inert, preserving its local state. RecordPage reuses PageHeader and shared typography, with optional dirty/busy navigation guards and focus/scroll restoration.
- The root uses the existing React Router data-router API for draft navigation blockers. Local page history contains only a view key; routed records retain authorised API loaders and existing record URLs. recordNavigation validates same-module internal return paths before use, retains the originating history index, and supplies atomic filter updates. Successful routed mutations set an explicit completion ref before redirecting; local teardown removes its marker only after a deferred generation check excludes StrictMode replay. RecordHost and RecordDraft contexts are separate from the component module, and nested forms report dirty/busy state to their owning frame. Header actions are disabled while dirty/busy; deferred focus restoration excludes effect replay and newly opened record pages. Local editor reload returns to the owning list; existing routed records retain deep-link loading.
- PortalModal uses native dialog focus containment, Escape/backdrop handling and focus return. PortalConfirmModal retains its existing visual/action contract through that primitive. This supersedes the older blanket local-drawer guidance for substantial records/forms; brief previews and inline controls remain contextual.

## Responsive Lecturer record tables (2026-10-11)

- Table typography comes directly from the existing shared data-table/data-thead/data-th/data-row/data-td/data-td-strong classes in index.css. Responsive utilities adjust layout and compact mobile spacing without replacing those text styles.

- WorkspaceRecordTable replaces WorkspaceSummaryCard for the Lecturer lists. One semantic table uses responsive row/cell styling to become labelled stacked records below the desktop breakpoint; it never duplicates action controls. Request and roster projections supply only their relevant columns. Native table headers retain column scope and explicit table roles preserve semantics when CSS changes display modes.
- WorkspacePagination shares validated 10/25/50 row sizes. Appointment/research sizes use existing query-parameter state; routed roster uses query parameters with an atomic page reset. Existing services still fetch their authorised workspace datasets; pagination is client-side and does not claim to reduce API payloads.
- The App passes the authenticated lecturer identity through the existing container to the roster. Role labels compare that identity with the recorded primary supervisor and active supporting appointments, rather than deriving role from mutable capabilities. WorkspaceRequestReference provides detail-only reference copying and accessible success/failure feedback. No backend, dependency, schema or authority changes.

## Shared Lecturer workspace presentation (2026-10-11)

- WorkspaceSectionHeader, WorkspaceSummaryCard, RequestFilters and WorkspacePagination provide one presentation pattern across the three Lecturer destinations. Research and appointment summaries share student-first content, faculty date formatting, status labels and action wording. Routed supervisees use responsive summary cards with the same pagination rather than a wide table.
- The Lecturer container owns the single Refresh action and existing refresh-version signals reload the active workspace. Optional showRefresh/onBusyChange props let shared children suppress their local refresh controls and disable the page action while loading or mutating; standalone/Student/embedded defaults retain their refresh actions. Existing API calls, authorisation and mutation guards remain authoritative.

## Lecturer ongoing/history request workspaces (2026-10-11)

- LecturerAppointmentRequests combines the existing authorised primary queue/history and co-supervisor workspace using a typed, deduplicated request projection. RequestWorkspacePrimitives provides compact view controls, filters, workflow groups and a native modal review panel with focus containment/Escape/return focus. Existing service mutation endpoints remain authoritative; duplicate-submit and request-version/scope guards cover the new container.
- The assigned-Lecturer primary history projection adds application ID, actual workflow status, recorded timestamps and waiting metadata, and distinguishes Coordinator-pending/rejected requests from final approval. Existing legacy fields remain available. Pending primary requests and supporting nominations expose semester labels for consistent combined filtering. Supporting detail/retry fetches the current authorised nomination before exposing its actions; primary details retain the student-record link. No schema/dependency/permission change is required.
- LecturerResearchWorkspace stores view/search/page/student context in React Router query parameters. Shared ResearchAmendments accepts optional controlled Lecturer presentation props, partitions ongoing/final records and retains its default Student/Office/Coordinator rendering and mutation boundaries. Research details resolve all authorised rows independently of the previous student filter; profile viewing resolves the request's student without overwriting the queue filter.
- Lecturer module headings/navigation stay stable across nested routes. Detail Back and secondary headings live below navigation; appointment History is a local view. Existing history and application deep links remain supported. Faculty date filters and derived research waiting ages use Asia/Kuala_Lumpur calendar days.

## Routed Supervisor workspace composition (2026-10-10)

- Extend existing Supervisor routes with applications, supervisees list and research list/detail/profile/new views. Shared module navigation reflects the route, while existing authorised service handlers remain the mutation boundary. Office/Coordinator routes retain their current composition.
- Student and Lecturer pages render only the selected workspace responsibility. Shared research/team components accept optional routed presentation props; existing embedded consumers retain default behavior. No API, schema, dependency or authority change is required.
- Application lists share pending/completed partitioning and waiting-time formatting. Research request links from reports, notifications and student records use the detail route; Office/Coordinator fall back to their existing embedded workspace. Lecturer research selection persists between list and profile; detail requests ignore that filter and resolve from authorised results.
- Routed team views preserve current primary/supporting rosters, individual team actions and read-only nomination/appointment history, including accepted nominations awaiting Coordinator approval. Research scope/load guards and Lecturer request-detail version/scope checks prevent obsolete responses opening a prior page's details after navigation.
- Supervisor containers own nested page headings and parent navigation. A shared research-page descriptor keeps Student/Lecturer titles and supporting copy aligned; optional hideHeader props suppress embedded history/research headers while preserving standalone and Office/Coordinator defaults.

## Shared reporting controls and Lecturer action summaries (2026-10-10)

- The shared total KPI varies its label by role: Lecturer sees Records involving you; other staff retain Records in scope. Lecturer breakdown supporting text explains the existing scope and counting semantics. This is presentation-only; no permission, query or export changes.
- Reports now consume the existing filter-toolbar and form-control/form-control-md CSS, PortalCard and PortalButton. FilterCard is a rubric-specific legacy widget with hard-coded semester/stage options, so its domain data is not reused as a general reporting filter. The other remaining form-input consumers (capacity, participant lifecycle and reconciliation) migrate to the same defined controls.
- LecturerReportSummary uses getLecturerReportMetrics with the existing role-scoped report: pendingApprovals remains all waiting workflow stages, incomplete evaluation counts exclude SUBMITTED records, and overdue counts use authoritative overview metadata. Actions anchor to the attention table or navigate through the existing Marks route. Original distributions/statistics remain in the same shared report component, collapsed only for Lecturer users.
- Draft and applied filters remain separate. Apply submits the labelled toolbar, Reset restores the active semester and export uses applied filters; a draft-change notice prevents ambiguous exports. Existing role/programme/semester authority and reporting-date semantics remain unchanged.
- The reporting service feeds its already-scoped amendment rows into the existing attention projection. Previously they contributed to pendingApprovals but were absent from the attention table. JSON/XLSX use the same service; this adds no records, schema or authority. The regression verifies an assigned Supervisor sees their pending amendment while an unrelated Student's amendment stays excluded.

## Audit history cache coherence after mutation (2026-10-10)

- The Student cancellation view prefetches workflow_events before recording STUDENT_CANCEL. Creating the event through AppointmentWorkflowEvent.objects does not invalidate Django's cached reverse relation, so serializing that same instance previously returned pre-cancellation history.
- The shared record_workflow_event helper now removes only workflow_events from the owning Supervisor application or Panel recommendation's prefetch cache after a successful insert. The serializer therefore reads current immutable events while unrelated prefetched relations remain intact. No schema, API shape, authority or frontend workaround changes.
- The cancellation API regression checks the immediate response contains SUBMIT and STUDENT_CANCEL, including the recorded cancellation reason and final status, rather than merely checking that the database event exists.

## Supervisor application section navigation and submission serialization (2026-10-10)

- SupervisorAppointmentApplicationPage replaces the hard-coded active first indicator with equally styled anchor navigation. Small candidate/selection-summary components expose aria-pressed, the Selected marker and a clear action; the page owns the single selected ID and toggle behavior. AppointmentGuidance supplies the same visible layout as the overview with application-specific rules.
- A synchronous ref guards an in-flight submit before React's state update disables the button, and resets on settlement so a rejected request can be retried.
- SupervisorApplicationCreateSerializer.create rechecks pending applications after acquiring the existing Student row lock within the view transaction. Competing requests that passed initial validation are serialized before document creation, workflow events and notifications; the loser returns the existing DRF validation error (400). Existing partial unique constraints remain the final guard for one pending request and one active primary appointment. Final-approval idempotency is unchanged; there is no new submission idempotency-key contract, migration or dependency.
- A PostgreSQL APITransactionTestCase synchronizes two requests after initial validation, posts to different eligible Supervisors and checks 201/400 plus exactly one application/document/SUBMIT event/notification and no appointment. Rendering and authenticated browser checks cover section navigation, selection/cancellation and useful shared guidance.

## Shared toast presentation and lifetime (2026-10-10)

- PortalToast retains its existing message/tone/className interface and the optional onClose callback introduced by the parallel local changes. A keyed inner notification owns dismissal state; clearing or changing the message/tone mounts a fresh notification. It continues to render through a body portal so clipping/transformed ancestors do not capture its viewport placement.
- Tone-specific icons use exclamation for errors, triangle for warnings, check for success and information for informational feedback. The shared supporting-text role, bounded width, wrapping, solid surface and keyboard-visible dismiss control replace the translucent surface, heavy shadow and duplicate-looking error X.
- SupervisorAppointmentApplicationPage owns one browser timer ref. A new notification cancels the previous timer; manual close clears message/timer; unmount clears remaining timer work. Existing frontend/server validation and request creation remain unchanged. SSR regressions cover all tones, escaping, one close symbol, announcement roles and viewport bounds; browser regressions cover repeated errors, dismissal and replacement timer behavior.
- No dependency, backend, authentication or database change is introduced. The combined previously uncommitted portal changes and this fix are isolated on codex/portal-consistency-and-toast for later integration.

## Lecturer team contents and activity provenance (2026-10-10)

- LecturerSupervisoryTeamCard consumes existing SupervisoryTeam data and shared AppointmentMemberCard. It separates current active supporting appointments from ended appointments/nomination history, preserves all nomination/replace/end callbacks and backend capability flags, and uses expandable research metadata.
- SupervisoryTeamTimeline retains legacy default presentation for other staff consumers. Its optional appointments/semester presentation filters the existing stable serialized identifiers: timeline-* entries are shared SemesterTimelineEntry records; primary-workflow-* and panel-workflow-* are application latest-status snapshots; co-* entries come from supporting appointment/nomination audit history. Structured list rendering has no nested disclosure.
- Backend co_supervision.serialize_team remains unchanged: it combines persisted application updated_at/status, supporting history timestamps/status, and current active Office semester entries targeted at STUDENT. Semester schedule status is stored configuration rather than per-student measured progress. The prior preview milestones are fictional seeded records documented in Project Status.
- No API, schema, data, authorization or dependency changes. Rendering regressions verify mixed-source separation, existing Student/staff compatibility, complete profile/history data and Lecturer management-action capabilities; live inspection verifies expanded card readability and typography.

## Shared Lecturer and Student appointment presentation (2026-10-10)

- AppointmentPrimitives centralizes section, member, guidance and summary components. StudentAppointmentPrimitives reexports compatible names. Lecturer Supervisor/Panel lists consume the same primitives and LecturerAppointmentGuidance supplies two source-backed module rules; existing route-controlled drawers, histories and workflow services remain in place.
- ResearchAmendments selects compact presentation for Student and Lecturer, preserving Lecturer student selection, capability-gated decisions, actor/status/date/reason audit data and transfer team/task acknowledgement. Office/Coordinator full comparisons are retained. Initial profile cards render a recorded definition list; later compact revisions compare only changed fields.
- Lecturer Supervisor research/team sections stay mounted during overview refresh, preserving selection, drafts and notices. Separate refresh versions update dependent scoped data after mutations and manual refresh. Team profiles and appointment history use native details, and research decision forms scroll/focus when opened.
- Active-supervisees API eagerly joins the student's research profile and reads current research only when its supervisor matches the active appointment. Missing or unrelated profiles fall back to the original application. Historical application values, API shape and authorization are unchanged; no schema/dependency changes are required.
- Lecturer SSR capability/history/guidance regressions, authenticated browser sequence/computed-style checks and backend current-profile/fallback regressions cover this adaptation. Coordinator/Office compatibility additionally uses existing tests and source review.

## Student initial profile and revision cards (2026-10-10)

- ResearchRevisionCard centralizes history card headers and metadata. Comparison receives initialRecord only for Student BASELINE revisions, rendering a single definition list from the recorded snapshot. Other Student revisions retain changed-field comparisons; staff retains full before/after comparisons. SSR regressions cover baseline uniqueness, absent false comparisons, real missing values, changed-field rendering, consistent outer cards and staff compatibility. The authenticated browser regression checks the populated initial/title history.

## Shared Student appointment presentation (2026-10-10)

- StudentAppointmentPrimitives provides StudentAppointmentSection, StudentAppointmentMemberCard and StudentAppointmentGuidance. Student SupervisoryTeamManagement and StudentPanelAppointment use the same presentation primitives; the staff branch retains its existing workspace.
- Student appointment refresh delegates to the parent application loader before remounting the team workspace, so active appointment actions, history and replacement guidance share refreshed records. Staff refresh is unchanged. Supervisor/Panel page headers remain present during loading and errors. Application history stacks text above actions on small screens.
- StudentAppointmentGuidance independently reads the existing authenticated active Supervisor document-requirements endpoint. Loading, retryable errors and unconfigured requirements remain inside the guidance section and do not block appointments. A cleanup flag prevents stale/unmounted requirement reads from updating state. Upload constraints come from the existing supervisorDocuments constants.
- StudentPanelAppointmentOverview renders public appointment metadata and one readiness-specific guidance item, using existing Supervisor routes for actionable links. Confirmation requires matching confirmed status/readiness before showing Panel member metadata. Both pages preserve the shared FAQ callback; guidance is an ordinary visible section, while detailed research comparisons/histories remain expandable.
- StudentAppointmentConsistency.test.tsx covers confirmed/pending Panel privacy, readiness actions, configured/optional/empty/error requirements and visible guidance. The old ageing test assertion for the removed generic turnaround paragraph now verifies persisted waiting formatting and absence of invented deadlines. Authenticated CUA visibility and computed-style assertions supplement these regressions. No backend, data, authorization, credential or dependency changes are introduced.

## Student Supervisor presentation (2026-10-10)

- Shared SupervisoryTeamManagement and ResearchAmendments receive the explicit authenticated role. Student selection is determined by role rather than canSubmitResearch, which also becomes false while a request is pending. Backend self-scoping and mutation authorization remain authoritative.
- StudentSupervisorsOverview uses the existing scoped team workspace for primary/supporting appointments and current research profile. StudentSupervisorAppointment renders research requests separately, supplies existing application navigation/change actions, and refreshes the team after a research mutation. Original application metadata and workflow drawer remain available from compact history rows.
- Student research cards use native closed details for changed-field comparisons and stored approval events; abstracts stack vertically for readable paragraphs. Native details also preserve full research profiles, revisions and supporting histories. Appointment guidance is now visible by default, as specified above. Staff cards, selectors, correction/transfer forms and decisions retain their existing behavior.
- Regression coverage includes Student/staff card capabilities, changed-field rendering, empty/active/ended supervision, eligible research forms, and the authenticated pending-request layout assertion in frontend/tests/studentSupervisorLayout.browser.test.mjs. No API, database, credential or dependency changes are required.

## Rendered typography regression checks (2026-10-10)

- Card label/value/description/caption and form-control roles explicitly reset inherited font family/style/case/spacing. Module JSX consumes existing heading/table/control roles and preserves semantic accent colors and layout utilities.
- `frontend/tests/portalTypography.browser.test.mjs` exports an authenticated CUA assertion over rendered computed styles and document width. It catches local Tailwind size/weight overrides and checks mobile/wide breakpoints; records are loaded before assertions.
- The FAQ answer editor carries `data-typography="formatted-content"`, so deliberate bold/italic formatting remains available while size/family/uppercase checks continue. This marker does not affect application state or persistence.
- Source inventory, role/page coverage, corrected findings and current fixture/integration limits are recorded in `docs/PORTAL_TYPOGRAPHY_ACCEPTANCE_2026-10-10.md`. No new API, database, authorization or dependency change is needed for this pass.

## Student evaluation access correction (2026-10-09)

- Dossier access resolution excludes MARKS for Student self-access. Marks queries, summaries and overdue attention are therefore not built for PUBLIC responses; null `marks` and `overview.marksStatus` preserve the response shape without disclosing evaluation metadata. Staff authorization and evaluation persistence are unchanged.
- `visibleProgressTabs` filters MARKS from PUBLIC sections defensively, even for stale responses, and the Marks renderer requires INTERNAL visibility. Student copy describes supervision, panel, milestones and research changes only.
- Evaluation viewing by students belongs to the university's central system. No external integration, invented URL, database migration or change to staff Marks workflows is introduced. Existing API privacy and frontend tab-selection tests enforce the boundary with populated and unprofiled Student records and authorised staff access.

## Shared portal typography roles (2026-10-09)

- `index.css` owns typography roles via `section-label`, `section-heading`, `card-label`, `card-value`, `card-description`, `card-caption` and `card-metric`. JSX headings, paragraphs, nested labels and collapsible summaries consume these roles rather than duplicating ad hoc sizes and weights; parent containers apply supporting-text roles where child text inherits them. Layout, responsive sizing, semantic accent colors and badge/input/navigation styles remain separate.
- Shared Summary, Workload, Audit, Recent Updates and Validation Rules cards consume the same roles as student appointment/status, Settings and record views. Plain explanatory text uses Inter; code/record identifiers may use the existing mono family. The Google Fonts request includes Inter 900 so existing `font-black` utilities do not depend on synthesized weight.
- Typography edits are confined to JSX classes and the font/style definitions. Letter preview/export formatting is excluded from generic replacements; only template-selection descriptions outside the Student letter preview adopt supporting-text styles. There are no API, state, dependency or database changes.
- Supervisory team/research amendment components share the roles across Student and staff consumers; carryover capacity cards use the same inherited supporting-text styles. Decision forms reuse the existing form label/control classes. Student Supervisor metadata uses label/value roles without inherited uppercase or italic styling. The populated supervisor hero stacks identity, metadata and actions below the 2xl breakpoint to avoid squeezing its research fields.
- Verification uses the existing frontend behavior/privacy suites, TypeScript, production build/artifact guards and representative desktop/mobile browser checks. Browser checks include populated comparisons and expanded histories and assert computed font family, size and weight rather than relying on source-class inspection alone. Styling changes do not introduce tests that assert source class spelling.

## Student academic record presentation (2026-10-09)

- `StudentProgressDossier` remains the shared read-only component on the existing progress routes. PUBLIC dossiers render the compact identity/enrolment summary and non-evaluation history tabs; INTERNAL dossiers retain the overview, status summaries and operational attention list. API authorization and backend redaction remain authoritative, with Student Marks excluded under the clarified access boundary.
- `visibleProgressTabs` accepts the dossier visibility, defaults to INTERNAL for existing consumers and omits OVERVIEW and MARKS for PUBLIC data. The loaded dossier selects its first authorised tab; an empty section list receives an empty state. Student labels are Supervision, Panel and Milestones without changing API section identifiers.
- `StudentLifecycleSummary` shares the enrolment label and Malaysia timestamp formatting across public/internal views, renders a date only when present and guards all private lifecycle metadata behind `internal`. Its public rendering sits inside the profile card; internal audit history remains a separate card.
- Shared `card-label`, `card-value` and `card-description` CSS classes complement `section-label` and the existing Inter font. Dashboard appointment descriptions, Action Centre heading and academic-record metadata consume these styles. No dependencies, schema, authentication or deployment changes are required.
- Existing rendered lifecycle/privacy tests cover absent dates and private-data redaction. Tab-selection tests cover PUBLIC/INTERNAL visibility and restricted or empty section sets; the existing integration/browser acceptance expectations use the revised labels.

## Pending technical admin separation (2026-10-08)

The [pending-work register](docs/PENDING_WORK_REGISTER_2026-10-08.md) consolidates the target, dependency matrix, design decisions and implementation/acceptance gates. Current Office role authority and Django admin flags are partially coupled: Marks correction/completion controls, participant lifecycle, research amendments, carryover capacity reassessment and acting delegation still use `is_staff`. The target is shared business authorization independent of technical admin login, with existing action permissions, actor/programme scope, validation and audits retained. Technical-only admin access has not been implemented. Initial superuser-only access is a recommendation pending scoped design; editable account/template/announcement/notification maintenance also needs review. No new business role, generic permission UI or automatic authority expansion is implied.

## Local testing access clarification (2026-10-08)

- Portal role authorization is separate from Django model permissions. The demo Office seed grants staff access and Marks model permissions only; other registered admin models require their own permissions. This explains the Marks-only admin menu without changing account authority. Daily governed mutations use portal services; admin inspection remains a technical support surface.
- The [simple tester guide](docs/SIMPLE_END_TO_END_TEST_GUIDE.md) complements the detailed whole-system guide. Fresh loopback Django 8000/Vite 3001 services use the existing development database and current uncommitted `main` working tree, with API proxying and mocks/demo login disabled. No database/credential reseeding is part of a server restart.

## Participant lifecycle acceptance design (2026-10-08)

- Participant list/detail reads use separate request generations and unmount guards. Refresh clears selection/confirmation state; failed reads remove stale mutation authority. Filters, reviews and lifecycle forms are disabled during an in-flight mutation. A failed post-mutation list refresh cannot restore old detail controls.
- Existing appointment projections and shared frontend status contracts recognize `CANCELLED_BY_OFFICE` in Office lists, assigned Lecturer histories and Student Supervisor history, including cancellation before any Lecturer decision. Panel history filters cancellations separately; timelines retain recorded Panel acceptance and place subsequent cancellation at Coordinator/final stages. Supervisor rows use persisted attempt identity as their React key and distinguish Ended from Rejected; cancellation chips use the actor-neutral Cancelled label. Domain transitions, permissions and database schema are unchanged.
- `StudentLifecycleSummary` renders the existing dossier lifecycle payload. It gates reason/actor/audits on internal visibility and uses the shared Malaysia timestamp formatter for both public effective dates and internal audit times. A rendered privacy/date regression deliberately supplies private fields to a public view. Reusable browser regressions in `frontend/tests/participantLifecycle.browser.test.mjs` exercise mounted request races, outages and record/dossier projections through CUA against synthetic prerequisites.
- Acceptance uses a fresh isolated PostgreSQL database and loopback 8014/3014 services with a separate signing key. Ignored fixture, server, read-outage controls and assertion scripts are local evidence tooling, not application middleware or committed credentials. See [lifecycle acceptance](docs/PARTICIPANT_LIFECYCLE_ACCEPTANCE_2026-10-08.md) for exact evidence and limits.

## Submitted Marks portal migration (2026-10-07)

- Existing Marks record-detail APIs expose fail-closed Office action capabilities and an opaque state version. `records/{recordId}/correct/` and `records/{recordId}/reopen/` require Office role, staff status and `marks.change_markentry`; strict serializers reject unknown fields, malformed decimals and duplicated components. Mutations reuse `correct_submitted_marks` / `reopen_submitted_marks` rather than ordinary model saves.
- Services lock semester, period, task and entry in the same order as closure/submission. The reviewed version binds entry identity, timestamp, status, submission date, scores, total and comments using a server HMAC; comparison after locking rejects obsolete forms. Existing service callers remain compatible. Audits and mutation roll back together. No schema or dependency change is required.
- `MarkEntryAdmin` inherits the existing inspection-only admin boundary and its writable correction form is removed. Former admin mutation acceptance tests now assert rejection; correction/reopening behavior moves to portal API, UI and audit acceptance. Historical admin reports retain evidence of the earlier implementation.

## Advanced Marks acceptance design (2026-10-07)

- Assignment options reuse `profile_programme` and eagerly load `student__student`, matching recipient-preview/task-generation authority without changing research-semester metadata. `getMarksAssignmentStudents` filters by normalized programme targets; main readiness and backup drawer use their respective selected periods. The drawer clears student/original-task selection when its period changes. API and frontend regressions reproduce stale programme and cross-semester omissions before correction.
- Office monitoring retains its existing collection of operational tasks across evaluation periods. Shared `getMarkMonitoringSemesterLabel` derives the displayed scope from that same collection, including single-semester, multiple-semester and empty cases; copy describes active tasks rather than asserting that their period/semester is currently active. Counts and historical access remain unchanged.
- Advanced Marks acceptance runs against an isolated synthetic PostgreSQL database and separate loopback services. Native accessibility date-field setting is checked against the controlled DOM value before granting windows; no DOM injection is used. Browser period previews/publication, drafts, closure, recovery grants, renewal and revocation are cross-checked with persisted audits and submission deadline/window snapshots. No migration or dependency change is required.

## Appointment failure-path acceptance design (2026-10-07)

- `PanelWorkloadSnapshotRow` renders the existing Office Panel summary using shared `capacityStateLabel`, authoritative state-specific colours and the public unavailability end date. Occupancy/utilization remain separate; the legacy availability label is used only when capacity metadata is absent. A rendered React regression reproduces the incorrect available label and covers authoritative unavailable, full, over-capacity, unconfigured, ineligible and available states plus legacy fallback.
- Acceptance uses a fresh synthetic PostgreSQL database and separate loopback services. Browser rejection/resubmission and final-approval conflicts are checked against independent persisted appointment, research, document, Marks and audit assertions. Live authenticated HTTP downloads verify owner/reviewer/Office access, unrelated-user denial, unknown-file handling and exact bytes without exposing credentials. API-created late-review preconditions and the audited availability fixture correction are identified separately from browser-created actions.
- No schema, backend API or dependency change is required. Native-alert dismissal, browser download saving and controlled native-date entry remain explicit browser acceptance limitations; backend permission/validation evidence does not replace those visual checks.

## Replacement acceptance correction design (2026-10-07)

- `StudentAppointmentStatusCards` replaces static Dashboard appointment examples with parallel reads from the existing Supervisor application and public student Panel APIs. Active appointment lifecycle metadata takes precedence over pending replacement requests. Effect cleanup discards obsolete responses; Retry clears stale records and reloads both APIs. The student privacy boundary remains the public Panel view and readiness copy.
- `mergeSubmittedPanelHistory` merges Lecturer recommendation collections by persisted recommendation ID rather than formatted date/status. Distinct attempts survive while repeated representations of one recommendation still deduplicate.
- `getOperationalMarkRecords` excludes explicit `PAUSED` and `RETIRED` lifecycle states and preserves compatibility with records without lifecycle metadata. Marks monitoring consistently uses that collection for summary, filters, previews, semester display and recent activity; authorized history filtering remains separate.
- Regression coverage includes Dashboard rendering/privacy/loading/error cases, identity-based history merging and operational Marks totals/history preservation. Isolated browser checks verify the full cancellation/replacement chain, persisted task snapshots and a mounted Dashboard API-outage/Retry recovery. No schema, backend API or dependency change is required.

## Django admin service boundaries (2026-10-06)

- Marks and shared Academic configuration ModelAdmins now deny governed add/change/delete actions and derive inspection fields from the model. Semester/capacity/availability and Marks configuration/assignment changes continue through their existing transactional, audited portal services. Existing model-level capacity locking remains intact.
- Mark Entry portal action permission requires the Office role, staff status, Django model permission and a submitted record. Draft and other-role views expose no correction controls. Mark Entry admin, its score inline and immutable correction/configuration/task audits are inspection-only, with no add/change/delete actions, including for superusers.
- The 7 October portal migration supersedes the earlier admin correction form. Strict portal serializers validate decimals/reasons and reviewed versions, and the existing transactional correction/reopening services retain atomic audits. Ordinary admin POSTs are denied rather than rebound to an editable correction form. Historical admin acceptance documents describe the earlier boundary only.
- Acceptance uses real Django admin HTTP requests and an isolated PostgreSQL database for synthetic browser records. Existing development credentials, permissions and academic records are unchanged; normal sign-in may update session/login metadata. There is no schema migration or new dependency. The requirement checklist maps individual in-scope clauses to screens/API surfaces and candidate regression evidence, keeping unverified branches explicit.

## Local whole-system testing setup (2026-10-06)

- The latest-main manual testing server uses the existing development database, loopback Django port 8000 and Vite port 3001, with `/api` proxying, matching frontend/CORS origin and mock/demo-login flags disabled. Docker retains its existing port 3000. No schema or application behavior changed for this setup.
- Private launchers, logs and verified local account credentials use ignored `.env.*` files. The committed whole-system guide records actual persistence boundaries and additional actor requirements; missing Registry/general Files/FAQ integrations are not obscured by mock acceptance.

## Full workflow acceptance correction design (2026-10-06)

- The Panel service normalizes a null/absent optional replacement reason to omission at the JSON boundary. Backend replacement validation remains authoritative.
- Coordinator decisions reload queue/history and increment an explicit supervisory-team refresh version after primary appointment changes. Coordinator and team loaders discard obsolete responses; Coordinator cleanup also prevents updates after unmount.
- Semester audit loading follows the selected semester object, including lifecycle refreshes. Effect cleanup rejects stale responses; read failures have their own Retry and cannot turn a completed lifecycle write into a reported mutation failure.
- Appointments' existing backend date formatter converts aware datetimes to Asia/Kuala_Lumpur before extracting the date. Frontend timestamp presentation shares the Malaysia date helper; date-only appointment values remain unchanged. Verification includes UTC-midnight boundary regressions and real browser workflow transitions. No dependency or schema change is required.

## Timeline acceptance correction design (2026-10-05)

- `TimelineManagement` owns the selected-semester payload and passes it to the presentational `SemesterTimeline`. Its stable refresh callback reads the latest selection; version guards discard obsolete responses, and loading clears calendar, entry and audit data together. A guarded semester-list loader supports Retry before any semester is selected and ignores responses after unmount.
- Dashboard admin uses a focused read-only mixin for `SemesterTimeline`, its entry inline and `TimelineAuditLog`. Django view permissions remain effective; even superuser POSTs cannot add, change or delete governed Timeline records. Office API mutation and audit services are unchanged.
- Verification combines selected-calendar rendering regressions, real admin POST/inline boundaries, and isolated browser checks of rapid selection, failed selection, initial semester bootstrap and Retry recovery. No schema or dependency change is required.

## Owned-module integrity correction design (2026-10-03)

- Reciprocal primary/Panel role checks share a focused Appointments helper. Serializers revalidate during creation under the existing Student/lecturer locks, and final approvals check before profile handover, closure, capacity consumption or workflow events. Shared appointment activation also enforces these checks for Office reconciliation handoff repairs, whose outer transaction rolls back profile resolution on conflict. Student-account and legacy matric-number links identify conflicting Panel records.
- Timeline creation explicitly accepts the optional selected-semester input and retains the existing authoritative Draft/Active resolver. The selection never supplies derived entry status, ordering or ownership.
- Governed appointment/configuration ModelAdmins deny add/change/delete permissions and expose every persisted field as read-only. Existing research profiles are inspection-only while initial provisioning remains possible. Marks correction services remain unchanged.
- Nested score input enforces a decimal minimum of zero before any insert, retaining the database nonnegative constraint. Evaluation task serialization reads `period.semester`; the Lecturer screen derives distinct options and combined filters from its existing assignment response.
- Regression coverage includes real API payloads, late role conflicts between validation and save, final-approval rollback, admin forms and POST boundaries, draft/submission preservation, retained-profile semesters and current/historical frontend filters. No schema migration or new dependency is intended.

## Account Settings Architecture (2026-10-01)

- `GET/PATCH /api/auth/settings/` returns the caller's public account, notification preferences and delivery capabilities. PATCH accepts only phone and strictly boolean `preferences.announcementAlerts`; protected or unknown fields are rejected. Existing `User.phone` persists contact information; additive Accounts migration `0006_user_announcement_alerts` defaults current and future accounts to receiving announcements.
- `POST /api/auth/settings/password/` locks the caller's user row, rechecks account eligibility/current password, applies user-aware Django validators, clears the temporary-password flag, and blacklists outstanding refresh tokens. Existing password-hash JWT revocation invalidates prior access tokens. Responses clear the refresh cookie; a per-user throttle permits five attempts per hour.
- Announcement fan-out filters opt-outs for nonurgent announcements only. It does not delete historical notifications, change attachment authorization, or suppress workflow events.
- Typed Settings API calls are always backend-backed. The existing Settings component disables writes during load, load failure and save; App synchronizes returned contact data. Password changes use authenticated refresh/retry and route back to login with feedback. An authentication session version guards delayed password-change and refresh responses against replacing or clearing a newer login.
- Verification includes authenticated permission/validation tests, token invalidation, preference delivery/history checks, migration preservation, frontend API/session-race tests and Settings rendering checks.

## Release verification and operations (2026-09-29)

- `deploy/RELEASE_RUNBOOK.md` documents the existing Nginx/Django/PostgreSQL deployment pattern, environment settings, verification commands, backup/restore rehearsal, acceptance and rollback. Hosting and the production WSGI runtime remain deployment decisions; no public server was provisioned.
- Acceptance uses a separate restored PostgreSQL database and dedicated local Django/Vite ports. Row counts and content fingerprints verify restoration and preservation using identical connection timezones; session timezone differences otherwise change timestamp JSON rendering without changing stored data.
- Shared frontend workflow-ageing contracts and labels now cover `COORDINATOR`, `SOURCE_COORDINATOR` and `DESTINATION_COORDINATOR`, with a regression test for the undefined-label issue discovered in browser acceptance.

## Research Amendment Architecture (2026-09-26)

- Appointments owns amendment requests, immutable events and research-profile revisions. Services serialize writes on the Student and profile records, validate optimistic revisions and reviewed appointment membership, and reuse regular/acting coordinator authorization.
- Dedicated Appointments amendment APIs and typed frontend contracts extend the existing supervisory-team interface. Direct Office corrections require meaning-unchanged attestation; transfers synchronize Student/profile programme values in one transaction and leave Marks generation to existing eligibility triggers.
- Lifecycle and nomination paths enforce pending-transfer barriers and cancel invalidated research requests. Admin forms protect governed fields; supervisor handoff preserves amended research values. Dashboard/report/dossier integrations reuse scoped amendment data; reconciliation only flags integrity problems for review.
- Endpoints under `/api/appointments/research-amendments/` provide collection/detail, `options/`, `corrections/`, per-request `decision/` and `cancel/`. Decisions require `expectedStatus`, preventing a replay from advancing both stages when one coordinator has both authorities. Corrections require `expectedRevision`; transfer approvals require `retainTeam`.
- Additive migrations `0013` and `0014` introduce the request/event/revision records and capture baseline revisions for existing profiles without inferring past approvals. New profiles receive an observed baseline on their first amendment. Historical coordinator responses expose request snapshots and their decision history without live student options, revision access or current task counts after programme authority is lost.
- Supervisor handoff treats any recorded revision, including baseline zero, as protected downstream history. Reconciliation compares the latest revision snapshot with the live profile as well as checking revision continuity. Migration preservation tests restore the latest migration graph after exercising older schemas; Marks migration tests include unchanged applications in their historical model state so model fields match the actual database schema.

## Task-Specific Marks Completion Windows (2026-09-22)

- Marks owns task-linked completion-window history and the shared effective-deadline/submission-access resolver. Window grants and revocations, task lifecycle changes and submission revalidate under consistent transactional locks; windows do not change period or semester lifecycle state.
- Office-only batch grant, per-task history and reasoned revocation APIs extend the existing Marks API. Task responses add effective deadlines, completion-window state and editing/submission capabilities while retaining truthful period-level status. Submission snapshots retain historical deadline/window evidence.
- Closure previews are read-only and scoped to the relevant period or outgoing semester. Transition commands validate the preview token and unfinished-work acknowledgement under locks before changing any lifecycle state. Archival rejects unfinished tasks with active windows.
- Dashboard, report/export, dossier and reconciliation integrations consume task-level deadline and eligibility rules. Closed-period work eligible for recovery is review-required; participant or appointment failures retain their existing lifecycle controls. Existing student/coordinator/supporting-supervisor disclosure boundaries remain enforced.
- Marks migrations `0009` and `0010` add completion windows, immutable audit events and submission deadline/window snapshots. A separate recorded flag distinguishes a newly recorded unlimited deadline from historical entries without a snapshot. Model/queryset mutation guards protect history; Django admin exposes submission snapshots read-only.
- `POST /api/marks/completion-windows/` accepts `taskIds`, `deadline` and `reason`; per-task `completion-windows/` reads history, and per-window `revoke/` records withdrawal. Semester APIs expose `closure-preview/` and `handover-preview/`, and Marks periods expose `closure-preview/`. Closure commands accept `previewToken` and `acknowledgeUnfinished`; tokens bind record identities/state and expire after 30 minutes. Zero-unfinished transitions retain compatibility without a token.
- Period locks use PostgreSQL `FOR NO KEY UPDATE` in completion and closure paths so an already-running evaluator handover can finish its replacement foreign-key insertion. Closure snapshots re-read task membership after acquiring task locks to include those replacements. This avoids the reproduced grant-versus-handover deadlock and prevents undercounting unfinished work.

## Acting-Coordinator Authority (2026-09-20)

- Accounts owns immutable delegation grants, reasoned revocation audits, Office administration and recipient history. Programme identities are drawn from existing Coordinator, Student and research-profile records and compared after trimming whitespace and ignoring case.
- Authorization resolves regular plus active delegated programmes. Existing single-programme response fields continue to describe the regular programme; effective programme arrays make supporting authority explicit. Appointment queries, mutation guards, Dashboard/report/dossier scopes and notification recipients consume this shared authority boundary.
- Delegation dates are inclusive in Asia/Kuala_Lumpur. Effective status is evaluated on access, so future, expired or revoked grants cannot authorize reads or writes. Final workflow decisions lock and revalidate the authorizing grant within their transaction; revocation uses the same row lock. Grant creation serializes overlapping programme claims transactionally.
- Office controls live within participant management; Coordinators see their own scope and assignment history. The delegation API is mounted under `/api/accounts/coordinator-delegations/`. Historical grants cannot be edited or deleted through application or Django admin controls.
- Migration `accounts.0005_coordinatordelegation` adds the grant table, protected actor references, valid-date and complete-revocation constraints without changing existing coordinator or appointment records. Grant creation uses a transaction-scoped PostgreSQL advisory lock on the normalized programme to cover concurrent first grants; decisions and revocation serialize on the authorizing grant row. Active/future grants are included in participant retirement blockers.
- The API provides list/create at the collection, Office-only `options/`, and reasoned `<id>/revoke/`. Invalid inputs return `400`, unauthorized access `403`, and overlapping grants or stale revocations `409`. The frontend refreshes history after conflicts. Accounts session responses add effective programmes and the recipient's delegation history while existing regular-programme fields remain compatible.

## Evaluation Period Targeting (2026-09-16)

- Marks migration `0008_evaluation_period_targeting` adds `programme_scope`, programme-name JSON selections, and evaluator-role JSON selections to EvaluationPeriod with ALL/both-role defaults. It preserves existing periods, appointments, tasks, and Marks. API fields are `programmeScope`, `programmes`, and `evaluatorRoles`; omitted create fields retain legacy defaults.
- `marks/targeting.py` centralizes validation, normalized programme matching, current official recipients, programme options, and recipient preview. Linked Student programme values take precedence; unlinked research profiles retain legacy lookup. Draft configuration changes record targeting in immutable configuration-audit snapshots; published targeting cannot be edited. Django admin exposes targeting read-only to preserve the audited Office mutation path.
- Office-only GET `/api/marks/programme-options/` returns distinct nonblank programme options from existing Student/research data. GET `/api/marks/periods/<id>/recipient-preview/` returns current recipients, generated timestamp, role/student/task totals, and missing eligible appointments without generating tasks. Preview supports Draft configuration, and empty results do not prohibit publication.
- Task generation locks the period, then candidate students and lecturers in primary-key order, and repeats shared eligibility selection before writes. Candidates outside the original lock set wait for the next existing generation trigger. Reconciliation consumes the same selector. Replacement creation applies current programme/role scope while retaining existing lifecycle audits and submitted Marks; backup creation validates programme and original-task boundaries.
- The Office period form captures scope and roles explicitly, retains saved programme options, and requires saved unchanged configuration plus a refreshed preview before publication. Edits, period changes, saves, and workspace reloads invalidate previews; pending responses use request counters to avoid restoring stale approval state. Period lists and assignment selectors display targeting summaries. No new top-level module or publication-token API is introduced.
- Verification covers API/service scope, preview side effects, lifecycle preservation, legacy migration, concurrency, UI validation and rendering, broader affected-module regressions, and production build guards. Recreate parallel PostgreSQL test clones after schema changes; `--keepdb` may leave existing clones at an older schema.

## Student Panel Team Projection (2026-09-15)

- `appointments/student_panel.py` shares current appointment/recommendation selection between the existing Student Panel payload and the restricted team timeline. Active appointments take precedence; otherwise only pending workload-reserved recommendations qualify.
- `serialize_team` applies the public projection for Student actors before returning team detail, workspace, or embedded dossier responses. The entry is allowlisted to `id`, `title`, `date`, and `status`; its constant key is `panel-current-status`, its pending date is null, and confirmation uses the appointment's ISO date. Staff retain existing internal workflow entries.
- The shared frontend timeline renderer displays readable statuses and omits absent dates; the TypeScript contract explicitly allows null dates. No endpoint or database migration is introduced.
- Regression coverage exercises the three response paths through pending, terminal, confirmed, and replacement states, preserves staff access, and tests undated and confirmed frontend rendering.

## Tech Stack

- React 19 with TypeScript
- React type declarations through `@types/react` and `@types/react-dom` for editor and `tsc` support.
- React Router DOM for clean URL routing in the frontend portal.
- Vite for development and production builds
- Tailwind CSS utility classes
- Lucide React icons
- Motion for animated drawer transitions
- `openpyxl` for Django-side structured `.xlsx` semester timeline template generation and upload parsing.

## Repository Layout

- Project root is the workspace entry point and contains the three mandatory governance documents.
- `frontend/` contains the Vite React application, including `src/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `metadata.json`, and the frontend `.env.example`.
- `frontend/.env.example` documents only public `VITE_` variables. A frontend `.env` file is optional unless local overrides are needed.
- `backend/` contains the Django backend, including `manage.py`, `config/`, `accounts/`, `appointments/`, `letters/`, `requirements.txt`, `README.md`, and the backend `.env.example`.
- `backend/dashboard/` contains dashboard-owned backend persistence and APIs for active semester timelines, timeline entries, Excel import/export, dashboard tasks, and timeline audit logs.
- `docs/` contains supporting documents such as `DATABASE_SETUP.md`, requirements PDFs, use-case PDFs, and implementation specs/plans.
- `docs/legacy/` is reserved only for preserved generated metadata that is not part of the runnable application.
- Generated local folders such as `frontend/node_modules`, `frontend/dist`, and `.venv` are ignored and should not be treated as source modules.

## Application Structure

Frontend paths in this section are relative to `frontend/`.

- `src/main.tsx` mounts the React app inside `BrowserRouter`.
- `src/App.tsx` owns the current demo authentication state and derives top-level module routing from the current URL. Auth, layout, route constants, session utilities, and small marks-overview primitives stay eager, while routed module screens are loaded through `React.lazy` named-export wrappers behind a shared authenticated `Suspense` fallback.
- `vite.config.ts` defines Rollup manual chunks for React, React Router, Motion, and Lucide so shared vendor code stays separate from the app shell and route-level chunks.
- `src/constants/routes.ts` centralizes clean URL paths, sidebar-to-route mapping, route-to-sidebar active-state mapping, known-route detection, and workflow notification deep-link targets.
- `src/components/AppLayout.tsx` provides the authenticated portal layout.
- `src/components/Sidebar.tsx` defines the office staff sidebar navigation labels.
- `src/components/AdministrationDashboard.tsx` implements the Dashboard Overview module.
- `src/components/AdministrationDashboard.tsx` intentionally hides unfinished-module summary cards in the FYP presentation slice and keeps lower dashboard records/actions as lightweight navigation surfaces; its lecturer panel workload attention count is derived from `getPanelWorkloads()` rather than a hardcoded mock count.
- `src/components/StudentDashboard.tsx` implements the student Dashboard Overview with a read-only role-scoped semester timeline, two appointment-focused status cards, and the shared persisted action centre.
- `src/components/LecturerDashboard.tsx` implements the lecturer Dashboard Overview with a read-only role-scoped semester timeline, two lecturer workspace cards, and the shared persisted action centre instead of office-staff monitoring sections.
- `src/components/CoordinatorDashboard.tsx` reuses the Lecturer dashboard composition for Programme Coordinators, loads live programme-scoped supervisor and panel approval counts, and limits its persisted action centre to managed-programme approvals.
- `src/components/CoordinatorSupervisorApprovals.tsx` is the Programme Coordinator supervisor final-approval queue. It loads `/api/appointments/supervisor/coordinator-queue/`, approves or rejects through the persisted coordinator decision endpoints, captures rejection reasons inline instead of using browser prompts, and renders the shared workflow audit log for each pending request.
- `src/components/DashboardTimeline.tsx` implements the shared semester timeline and accepts `showManageTimeline` so office staff can manage timelines while students see a read-only dashboard timeline. The Administration Dashboard controls the active project phase from the timeline header beside Refresh, and the shared header derives `Session YYYY/YYYY` from the active timeline session for every role dashboard.
- `src/components/DashboardTimeline.tsx` accepts optional `visibleRoles` for role-scoped dashboard display. Student/Lecturer dashboards pass role filters, while Office Staff/Admin omits the prop to retain the full timeline.
- `src/components/MonitoringTasksCard.tsx` is the shared Dashboard Action Centre. It loads `/api/dashboard/tasks/`, renders loading, error/retry, and empty states, formats waiting/deadline metadata, and delegates exact route navigation through `src/utils/workflowAgeing.ts`.
- `src/utils/workflowAgeing.ts` centralizes null-safe waiting/deadline labels, longest-waiting sorting, and action-target route resolution.
- `src/components/TimelineCalendar.tsx` provides the shared P1/P2 month-lane calendar-style timeline display used by Administration Dashboard and Timeline Management, including one row per event, day-proportional date bars across month columns, compact wrapping event title labels without inline date text or separate marker lines, an empty P2 state when P2 entries are not uploaded yet, and a details modal that shows the entry detail/description when a timeline label is clicked.
- `src/components/PortalPrimitives.tsx` provides shared portal primitives for page headers, cards, buttons, status badges, segmented controls, removable tags, progress bars, status dots, confirmation modals, and toast notifications. `PortalToast` and `PortalConfirmModal` render through `document.body` with high z-index layering so feedback and confirmations remain above sticky headers, drawers, and modals.
- Dashboard, supervisor, and panel appointment flows use `PortalToast` or inline field validation for user feedback instead of browser-default prompts/alerts for workflow decisions.
- `src/components/PortalPrimitives.tsx` also centralizes common status-to-badge tone mapping through `getStatusBadgeTone`, so tables, workload views, upload panels, lecturer cards, and shared status chips avoid duplicated color logic.
- `src/components/PanelWorkflowTimeline.tsx` provides the shared full panel workflow status timeline used by Office Staff/Admin panel appointment detail and Lecturer panel assignment detail, including recorded workflow date-times when backend timestamp fields are available.
- `src/utils/csvExport.ts` provides a small shared CSV builder/downloader used by Office Staff/Admin panel appointment and panel workload exports.
- `src/utils/landingPage.ts` centralizes the default authenticated landing module so every role enters through Dashboard Overview after a normal login.
- `src/constants/programmes.ts` centralizes the approved system programme labels used by dashboard and panel-facing UI/data paths.
- `src/components/TimelineManagement.tsx` implements the dashboard timeline management sub-view.
- `src/components/SettingsView.tsx` implements the Settings module (profile summary, contact details, password change, and notification preferences) and is routed for every role.
- `src/components/NotificationsAnnouncements.tsx` is the notification-bell view, split into Announcements and Notifications tabs (the feed is split by the backend `isAnnouncement` flag).
- `src/context/NotificationsContext.tsx` is the shared notifications store; it feeds both the bell badge and the bell view.
- `src/config/demoLogin.ts` owns fictional demo identifiers and the development-only credential assembly. It requires Vite development mode, an explicit enable flag, and all four role passwords before exporting a usable prefiller configuration; production dead-code elimination removes the console branch and password values.
- Timeline add/edit drawers keep timeline classification limited to P1/P2 and do not submit status; the backend derives the displayed status from the selected date range.
- `src/services/timelineApi.ts` connects the dashboard timeline UI directly to `/api/dashboard/timeline/active/`, `/api/dashboard/timeline/template/`, `/api/dashboard/timeline/upload/`, `/api/dashboard/timeline/entries/`, `/api/dashboard/timeline/entries/<id>/`, `/api/dashboard/timeline/audit-logs/`, and `/api/dashboard/tasks/`. It has no mock branch or backend-selection flag.
- Existing appointment and marks-entry modules remain in their own component files under `src/components`.

## Backend Data Model

- `accounts.User` is the login superclass (email, role discriminator, phone, flags). Role-specific data lives in one-to-one subtype "profile" tables that share the user's primary key: `Student`, `OfficeStaff`, and `Lecturer`. `Coordinator`, `Supervisor`, and `Panel` are one-to-one specializations of `Lecturer` (overlapping: a lecturer may hold several).
- `accounts.management.commands.seed_users` is a guarded development fixture command. It checks `DEBUG`, `ENABLE_DEMO_ACCOUNTS`, and four environment-supplied role passwords before any mutation, validates optional JSON legacy-email mappings, migrates mapped users in place, and reuses profile-number conflicts so protected timeline, audit, and appointment references retain their primary keys.
- Demo environment flow is deliberately split: ignored `backend/.env` supplies seed passwords, ignored `frontend/.env.development.local` supplies development prefills, and tracked `.env.example` files keep the feature disabled with blank placeholders. The production canary-build test scans emitted HTML and JavaScript for passwords and console markers.
- `User.to_public_dict()` reassembles the flat shape the frontend `DemoUser` expects from these profile tables, so the auth API contract is unchanged.
- The `letters` and `announcements` apps own the letter-template, announcement, and per-recipient notification tables.
- The full user/role ER diagram lives at `docs/erd/01-user-roles.md`; `docs/erd/` is the home for further ER diagrams as more modules are modeled.
- `src/components/LecturerPanelAppointments.tsx` is role-aware: Lecturer users see supervisor recommendation, selected-panel review queue, a separate reviewed-request history page launched from the queue header, and confirmed panel assignments; Programme Coordinator users see a programme-scoped confirmation queue and full-lifecycle records.
- `src/components/PanelRecommendationRecordsTable.tsx` provides the shared searchable, status-filtered, 10-row paginated read-only table used for coordinator programme records and lecturer reviewed history.
- `src/utils/panelRecommendationRecords.ts` centralizes recommendation lifecycle grouping and records filtering.
- `src/components/PanelAppointmentManagement.tsx` is the Office Staff/Admin panel monitoring surface; it loads records through `getPanelAppointments()`, loads workload snapshot rows through `getPanelWorkloads()`, derives summary counts and lifecycle-tab filtering with `src/utils/panelAppointmentRecords.ts`, supports optional longest-waiting ordering, exports persisted lifecycle and waiting fields, paginates filtered history at 10 rows per page, and keeps the filter card and records table in the same left-column stack.
- `src/components/PanelAppointmentDetail.tsx` renders the selected backend panel record directly, derives the header session badge from the academic-year portion of the backend semester string, shows the shared full panel workflow status timeline from backend lifecycle timestamps, distinguishes selected-panel rejection from Programme Coordinator rejection, displays stored rejection or cancellation reasons, enriches the related panel status card with staff/contact/assignment context, and uses concise no-records states for related files and evaluation data until those modules are connected.
- `src/utils/pagination.ts` provides shared pure helpers for 1-based page clamping, array slicing, total-page calculation, and displayed record ranges; Panel Appointment Management and Timeline Management use it with a page size of 10.
- `src/components/PanelWorkloadMonitoring.tsx` is the Office Staff/Admin read-only workload page; it loads lecturer workload rows through `getPanelWorkloads()`, derives summary counts and clamped utilization percentages with `src/utils/panelWorkloadRecords.ts`, exports the currently filtered workload records as CSV, and displays real workload detail items in the drawer.
- `src/components/PanelAssignmentDetail.tsx` renders the lecturer's backend panel assignment directly, derives the header session badge from the backend intake string, shows the shared full panel workflow status timeline from backend lifecycle timestamps, and uses concise no-records states for related documents and EE evaluation until those modules are connected.
- `src/components/SubmittedRecommendationsPage.tsx` and `src/components/RecommendationDetailsDrawer.tsx` are the supervisor-facing panel recommendation tracking surface; the drawer renders the same confirmation route as the review drawer, uses backend workflow timestamps when available, and exposes cancellation only for the submitting supervisor while the workflow is `SUBMITTED_TO_PANEL`.
- `src/components/StudentPanelAppointment.tsx` loads the authenticated student's panel appointment view and renders either generic faculty-processing age or confirmed appointed-panel details; it never names the internal selected-panel/coordinator stage while processing is pending.
- `src/services/appointmentsApi.ts` connects every Supervisor and Panel workflow directly to Django regardless of the global mock setting.
- Appointment services include Office supervisor workload at `/api/appointments/supervisor/workload/` and Lecturer self-workload at `/api/appointments/supervisor/my-workload/`; both are role-gated by Django.
- `src/services/appointmentsApi.ts` exposes `getStudentPanelAppointment()` for the student panel view, with mock fallback available when panel backend mocks are enabled.
- Backend `appointments` app owns `StudentResearchProfile`, `PanelRecommendation`, and `PanelAppointment` persistence plus role-gated DRF endpoints under `/api/appointments/panel/`.
- `/api/appointments/panel/coordinator-workspace/` resolves `request.user.lecturer.coordinator.programme_managed` as the authoritative scope and returns the programme, pending count, final-approval queue, and newest-first full recommendation lifecycle records. Blank programme assignments return an empty protected workspace.
- `/api/appointments/panel/review-history/` returns recommendations where the authenticated selected panel lecturer has recorded a panel decision plus recommendations cancelled before that lecturer acted, preserving downstream coordinator status and read-only cancellation history.
- `POST /api/appointments/panel/recommendations/<id>/cancel/` locks the recommendation row, verifies ownership and exact `SUBMITTED_TO_PANEL` status, requires a reason, stores `cancelled_at` and `cancellation_reason`, and records an immutable `SUPERVISOR_CANCEL` workflow event.
- Coordinator queue retrieval and approve/reject endpoints enforce the same managed-programme boundary server-side; frontend filtering is not treated as authorization.
- The office monitoring endpoint `/api/appointments/panel/` is Office Staff/Admin-only and returns one row per meaningful workflow attempt. Each appointment is returned once, its underlying approved recommendation is omitted to prevent duplication, all other recommendation attempts remain visible, and a profile is returned as `No Panel` only when it has no appointment or recommendation. Every row has a stable `recordId` (`appointment-*`, `recommendation-*`, or `profile-*`), while `id` remains the student matric number. Rejected and cancelled rows retain the recommended member, workflow reason, lifecycle timestamps, recommendation ID, and audit events used by the Office Staff/Admin detail page.
- The office workload endpoint `/api/appointments/panel/workload/` returns lecturer workload rows for Office Staff/Admin users, counting active confirmed panel appointments plus active pending nominations and including the underlying workload items for read-only drill-down.
- Appointment serializers and validators resolve public `staffId`, `studentId`, and `department` fields through the normalized `Lecturer`, `Student`, and `OfficeStaff` profile relations rather than flat columns on `User`.
- Backend `dashboard` app owns `SemesterTimeline`, `SemesterTimelineEntry`, and `TimelineAuditLog` persistence plus role-gated DRF endpoints under `/api/dashboard/`.
- Dashboard timeline upload uses a structured Excel workbook parsed with `openpyxl`; upload replacement deactivates the previous active timeline, creates the new active timeline and entries in one transaction, derives internal step order and status from row order/date ranges, and records an audit log.
- `dashboard.upload_security` validates the 10 MB upload limit and the XLSX ZIP package before `openpyxl` parsing. It bounds entry count and total expansion, rejects encryption, traversal paths, macros, missing workbook parts, and failed CRC checks, then rewinds the stream for normal spreadsheet validation.
- Production reverse proxies must cap timeline upload request bodies at 12 MB, leaving multipart overhead above the application-level 10 MB file limit while rejecting larger bodies before Django workers process them.
- Dashboard timeline entries store both `title` and `detail`; `title` is the short schedule/table label and `detail` is the longer description shown in the details modal.
- Dashboard timeline target roles are limited to `STUDENT`, `LECTURER`, and `OFFICE_STAFF`; lecturer responsibilities are not split into panel/supervisor target-role values.
- Dashboard timeline entry patching is Office Staff/Admin-only and records an audit log for each saved entry change.
- Dashboard timeline entry creation, level moves, and deletion are Office Staff/Admin-only; new entries are attached to the active timeline, assigned internal ordering within their P1/P2 level, derive status from dates, and are recorded in `TimelineAuditLog`.
- Dashboard timeline audit logs are exposed through a management endpoint so Timeline Management can render real upload, replace, add, edit, and delete history instead of local mock rows; the newest loaded records are paginated locally at 10 rows per page.
- Active timeline retrieval is available to every authenticated role and returns a stable empty payload with `No timeline available at now` when no active timeline exists.
- `dashboard.actions.build_dashboard_tasks()` assembles at most 20 role-scoped actions from persisted Supervisor, Panel, Marks, and Timeline records. Its sort key prioritizes overdue and due-today deadlines, then oldest waiting approvals, active timeline entries, and nearest upcoming deadlines.
- `dashboard.reports` is the shared read-only reporting boundary for `/api/dashboard/reports/` and `/api/dashboard/reports/export/`. It parses date filters once, applies role/programme/object scope before aggregation, and supplies the same filtered data to JSON serialization and in-memory XLSX generation.
- Reporting dates are explicit per module: Supervisor submission, Panel submission with creation fallback, Marks evaluation-period close with task-assignment fallback, and Timeline deadline start. Aggregates describe the current persisted lifecycle/deadline state rather than reconstructing historical snapshots.
- Office Staff/Admin reporting can optionally narrow to one programme; Programme Coordinator reporting is forced to the managed programme and includes Supervisor/Panel only; Lecturer reporting includes only assigned Supervisor, selected-panel, Marks, and Lecturer-targeted Timeline records. Students are rejected by the API.
- XLSX workbooks are generated with `openpyxl` without persistent export records. Role-visible sheets use fixed headers, ISO timestamps, frozen header rows, filters, and bounded column widths.
- `dashboard.dossiers.build_student_progress_dossier()` is the single aggregation and authorization boundary for `/api/dashboard/progress/<matric_no>/`. It resolves the canonical `accounts.Student` identity first, then applies role and section scope before querying or serializing module records.
- Dossier joins use `Student` for Supervisor history and `StudentResearchProfile` for Panel and Marks history. A missing research profile is a valid partial dossier, not an API error.
- Office Staff/Admin receives all sections; Programme Coordinators are constrained to `Coordinator.programme_managed` and omit Marks; Lecturers qualify through a supervision, panel, or Marks relationship and receive records filtered to their own assignments; Students receive a public self-only representation.
- Public dossier access excludes the entire Marks section and serialization removes internal Panel workflow stages and identifiers, pending panel identity and workflow audit events. Both unknown and unauthorized matric numbers fail with `Http404`.
- Dossier current-state ordering prioritizes active workflow records and otherwise uses newest persisted records. Existing `appointments.ageing` and `marks.deadlines` helpers derive waiting and deadline metadata without adding snapshots or recurring audit writes.
- `StudentProgressDossier.tsx` is a lazy-loaded read-only tab workspace. Backend-provided `visibleSections` controls tab rendering, while existing `targetModule`, `recordType`, and `recordId` values resolve staff deep links without backend-generated URLs.
- The `PanelRecommendation` database model enforces the one-active-recommendation-per-student rule with a conditional unique constraint, mirrors the frontend lifecycle status contract, and records submission, selected-panel decision, and Programme Coordinator decision timestamps for timeline display.
- Panel workload validation is centralized in the appointments domain: reserved workload is confirmed active panel appointments plus submitted/pending nominations, exposed through `/api/appointments/panel/candidates/`, and enforced again during recommendation creation.
- `CANCELLED_BY_SUPERVISOR` is terminal and is intentionally excluded from active recommendation and reserved-workload status sets, allowing a new recommendation for the same student without deleting the cancelled attempt.
- The student-facing endpoint `/api/appointments/panel/student/` is authenticated and role-gated to `Student`; it resolves the `StudentResearchProfile` for `request.user` and returns either pending state data or confirmed active `PanelAppointment` details, falling back to a pending state for valid student accounts without a linked research profile.

## Navigation Pattern

The app uses React Router clean URLs for top-level modules and high-value workflow detail links.

- Auth routes are `/login`, `/forgot-password`, and `/reset-password?uid=...&token=...`.
- Authenticated module routes include `/dashboard`, `/dashboard/timeline`, `/registry`, `/faq`, `/files`, `/supervisor-appointments`, `/letters`, `/announcements`, `/marks`, `/panel-appointments`, `/notifications`, and `/settings`.
- Dashboard page-level routing supports `/dashboard`, Office Staff/Admin-only `/dashboard/timeline`, role-gated `/dashboard/reports`, staff dossier links at `/dashboard/progress/:studentId`, and the Student self-view at `/dashboard/progress`; drawer, modal, filter, pagination, and selected-entry state inside Timeline Management stays component-local.
- `WorkflowReports.tsx` is lazy-loaded and consumes `workflowReportsApi`. It keeps date/programme filters local, renders compact CSS distributions without a charting dependency, hides unauthorized module sections, resolves attention rows through existing route helpers, and downloads the filtered workbook as a transient browser file.
- Dossier entry actions are passed as navigation callbacks into existing Office, Coordinator, and Lecturer Supervisor/Panel/Marks surfaces. The dossier remains outside the sidebar and exposes no mutation or export controls.
- Supervisor Appointment page routes include `/supervisor-appointments/workload`, `/supervisor-appointments/new`, `/supervisor-appointments/history`, `/supervisor-appointments/supervisees/:studentId`, and the existing compatibility application route `/supervisor-appointments/:applicationId`.
- Marks sub-routes include `/marks/config`, `/marks/rubrics`, `/marks/tasks`, `/marks/records`, and `/marks/records/:recordId`.
- Panel Appointment page routes include `/panel-appointments/workload`, `/panel-appointments/records/:recordId`, `/panel-appointments/submitted`, `/panel-appointments/reviewed`, `/panel-appointments/assignments/:studentId`, and the compatibility recommendation route `/panel-appointments/recommendations/:recommendationId`.
- Workflow deep links include `/supervisor-appointments/:applicationId`, panel appointment record and assignment routes, and `/panel-appointments/recommendations/:recommendationId`.
- `App.tsx` derives the active sidebar item from `location.pathname`; sidebar clicks and dashboard shortcuts call `navigate(route)`.
- `RouteScrollRestoration` is mounted under `BrowserRouter` and resets the window to the top when `pathname` or `search` changes, while ignoring hash-only changes.
- Supervisor Appointment page-level state is route-derived in `App.tsx` and passed into role-specific supervisor components, while review drawers, student detail overlays, confirmation modals, filters, pagination, and toasts remain component-local.
- Panel Appointment page-level state is route-derived in `App.tsx` and passed into role-specific panel components, while drawers, dialogs, filters, pagination, tabs, and toasts remain component-local.
- Component-local UI state remains local for drawers, dialogs, filters, and non-shareable edit/create modes.
- `currentUser.role` controls whether shared sidebar entries render office-staff, lecturer, coordinator, or student workflows. Programme Coordinators route to their dedicated dashboard, live supervisor final-approval queue, and programme-scoped panel workspace. Lecturer and student routing remains role-specific as described above.
- All authenticated roles land on `Dashboard Overview` after normal login, direct visits to auth routes redirect to the dashboard, unauthorized module routes redirect to the dashboard, and unknown authenticated paths redirect to the dashboard.
- `Sidebar` filters visible navigation items by active role while preserving the responsive drawer behavior from the current app shell.
- Production hosts must serve `index.html` for unknown frontend paths so direct refresh works with clean URLs.

## Supervisor-to-Panel Handoff Design

- `appointments.supervisor_handoff.approve_supervisor_application()` owns final Supervisor approval. It runs in one database transaction, locks the application row, rechecks coordinator programme scope, pending state, and Supervisor workload, then resolves the research profile before creating the appointment and immutable workflow event.
- Profile resolution queries both the linked Student user and exact matric number under row locks. Two different matches are a fail-closed conflict. A single legacy matric match is linked in place so its primary key and downstream foreign keys remain stable.
- A profile is considered downstream-used when it has Panel recommendations, Panel appointments, or Marks evaluation tasks. Used profiles preserve populated historical content; assigning one to a different Supervisor is rejected rather than rewritten.
- The `appointments.0009_supervisorapplication_research_area` migration adds the legacy-compatible field and backfills only approved applications that already have confirmed Supervisor appointments. Ambiguous legacy matches remain untouched for operational resolution.
- `GET /api/appointments/panel/eligible-supervisees/` scopes profiles through active `SupervisorAppointment` rows and annotates the appointment identifier. The Panel recommendation serializer repeats that check during creation, so frontend query state cannot grant eligibility.
- Student Panel readiness is derived server-side from the authenticated student's Supervisor application, research profile, Panel recommendation, and active Panel appointment. The response deliberately collapses internal pending stages into `FACULTY_PROCESSING`.
- The frontend route helper encodes the student matric number as `/panel-appointments?student=...`. `App.tsx` passes that identifier to the existing Lecturer Panel workspace, which selects the authorized supervisee and opens the recommendation drawer only when the backend says a new recommendation is allowed.
- Reports and progress dossiers expose persisted Research Area text within their existing role scopes. No profile mutation is available from either read-only aggregation surface.

## Coding Conventions

- Components are functional React components.
- UI state is local to the owning component unless shared navigation is required.
- Shared navigation callbacks are passed down as props.
- Styling follows the existing Tailwind-heavy component pattern.
- New dashboard components are imported into the current app rather than replacing the whole frontend folder.
- Panel recommendation backend permissions are endpoint-enforced: supervisors can create/list their own recommendations, selected panel lecturers can accept/reject only assigned recommendations, and Programme Coordinators can confirm/reject only pending coordinator recommendations.
- Student panel appointment permissions are endpoint-enforced: only authenticated Student users can call the student panel endpoint, and the backend only returns the profile and appointed panel linked to the logged-in user.
- Semester timeline backend permissions are endpoint-enforced: all authenticated users can read the active timeline, while only Office Staff/Admin users can download templates, upload replacements, or patch timeline entries.
- DRF uses `IsAuthenticated` as its default permission. Login, password-reset request, and password-reset confirmation explicitly opt into `AllowAny`; logout requires authentication, while `/api/health/` stays outside DRF as a minimal public probe.
- A route-discovery security test walks every mounted `/api/` DRF view and exercises every declared method anonymously. It allows only the three recovery/login endpoints and verifies announcement routes return `401` without changing announcement behavior.
- Accounts, Supervisor, Panel, Dashboard, Marks, and Letters enforce role and object/programme scope in backend queries and decision handlers. Frontend route visibility is never treated as authorization.
- Announcement/Notification ownership, draft visibility, and attachment authorization remain deferred to the teammate-owned module and require a dedicated review before production.
- `accounts.throttles` provides separate settings-backed, per-client-IP scopes for login, password-reset request, and password-reset confirmation. `DRF_NUM_PROXIES=0` makes `REMOTE_ADDR` authoritative until a known proxy chain is configured.
- `DJANGO_CACHE_BACKEND` accepts `database` or development-only `locmem`. Blank selects local memory with DEBUG enabled and Django's PostgreSQL `DatabaseCache` with DEBUG disabled; production rejects local memory and all unsupported values. All workers use the same configured database and dedicated `fsktm_api_cache` table, with a 10,000-entry cache capacity. Run `createcachetable` in the target environment before starting workers; no dependency or model migration is added.
- Independent-process HTTP regression probes consume login, reset and confirmation budgets against one isolated PostgreSQL test database and assert HTTP 429 with `Retry-After` from a subsequent process. DRF's non-atomic cache history updates still permit some overrun under simultaneous requests. Cache culling/clearing resets histories; monitor capacity and do not clear the table during routine worker restarts.
- Frontend authentication forms centralize `429` handling in `src/utils/authErrorMessage.ts` and retain endpoint-provided messages for other API errors.
- `config.production_security.validate_production_environment` runs during settings import when `DEBUG=False`, before Django application initialization. It raises `ImproperlyConfigured` for unsafe secret keys, missing or wildcard hosts, and missing, malformed, or non-HTTPS CORS origins.
- Production settings enable HTTPS redirection, secure strict cookies, nosniff, same-origin referrers, frame denial, and a staged HSTS policy. Development keeps local HTTP defaults and does not enable those production transport controls.
- HSTS is environment-controlled with a 3,600-second initial duration and disabled subdomain/preload flags. Deployment may move to one year, subdomain coverage, and preload only after HTTPS validation for the full domain tree.
- `SECURE_PROXY_SSL_HEADER` is configured only when `DJANGO_TRUST_X_FORWARDED_PROTO=True`. The terminating proxy must discard inbound client `X-Forwarded-Proto` values and set an authoritative value before this opt-in is safe.
- SimpleJWT issues 15-minute access tokens for normal bearer-header authentication and 7-day refresh tokens tracked by its `token_blacklist` app. Refresh values are never serialized to frontend JavaScript; `accounts.session_tokens` sets them in an HttpOnly, strict, `/api/auth/` cookie and records explicit password-reset revocations.
- `accounts.authentication.RefreshCookieAuthentication` is limited to refresh and logout. It validates expiry, blacklist state, active-user state, and SimpleJWT's password-hash revocation claim before those endpoints rotate or revoke a session.
- `frontend/src/services/authSession.ts` owns the in-memory access token, one shared refresh promise, credentialed cookie exchange, and one-time `401` retry. JSON, multipart, and blob helpers all use this boundary; application startup refreshes before requesting `/auth/me/`.
- Login, refresh, and logout reject non-JSON requests. JSON content type forces cross-origin browser callers through the explicit CORS policy, while the strict cookie adds a second request-origin boundary. Application APIs do not accept the refresh cookie as authorization.
- `deploy/nginx` defines the supported same-origin production boundary: Nginx serves the Vite build, proxies `/api/` and `/admin/`, serves collected Django Admin assets, overwrites forwarded protocol headers, rejects unknown hosts, and applies the 12 MB request limit plus frontend security headers. Nginx owns public HSTS and suppresses Django's upstream HSTS header on proxied responses.
- Report-only and enforced Nginx includes carry identical CSP directives. The policy keeps executable scripts and network connections same-origin, blocks script attributes and active embedding, and narrowly allowlists Google Fonts and Unsplash while current React style attributes retain `unsafe-inline` style compatibility.
- Vite explicitly sets `build.sourcemap=false`; the existing production canary build also rejects map files, source-map references, inline entry scripts, demo credentials, and testing-console content. Nginx returns `404` for `.map` requests so third-party maps collected with Django static packages are not published.
- Vite is a development-only dependency pinned to the patched 6.x line. The frontend keeps `tsx` and its nested `esbuild` patched independently from the compatible direct `esbuild` 0.25.x build dependency, avoiding an unnecessary Vite major-version change.
- Browser routing uses the consolidated `react-router` 8 package; `react-router-dom` is no longer installed. Router 8 requires React/React DOM 19.2.7 or newer and establishes Node.js 22.22.0 as the frontend development and deployment runtime floor.
- The package-level npm override keeps the Vite and Autoprefixer dependency paths on PostCSS 8.5.18 or newer, preventing vulnerable transitive resolutions on clean installs.
- Letter printing no longer emits an inline script. The trusted application bundle registers load, print, and close handlers on the generated same-origin document so `script-src 'self'` remains enforceable.
- Production uses `STATIC_ROOT=backend/staticfiles` for Nginx-served Django Admin assets. The deployment runs `collectstatic`, uses relative `VITE_API_BASE_URL=/api`, and sets forwarded-proxy trust and DRF proxy counts to the actual proxy chain.

## Supervisor, Workflow Audit, Marks, and Dashboard Completion

- The `appointments` app owns supervisor applications, private document persistence and requirements, final appointments, and shared `AppointmentWorkflowEvent` audit records.
- Supervisor applications follow `SUBMITTED_TO_SUPERVISOR -> PENDING_COORDINATOR -> APPROVED`, with rejection states at either decision stage and conditional uniqueness for active student applications.
- Supervisor and Panel state-changing endpoints write immutable workflow events referencing exactly one workflow record.

### Private Supervisor Application Documents

- `SupervisorDocumentRequirement` is the Office-configured intake checklist. Its stable code is server-generated and immutable, requirements are deactivated rather than deleted, and `SupervisorDocumentRequirementAudit` stores immutable actor, action, reason, before, after, and timestamp values.
- `SupervisorApplicationDocument` stores a private `FileField`, validated content type, byte size, SHA-256 checksum, requirement relationship, and immutable code/label snapshots. The nullable file and requirement fields preserve pre-cutover metadata rows as non-downloadable `LEGACY_METADATA`.
- Student creation uses one atomic multipart request. `appointments.supervisor_documents` validates all active requirements and all files before model or storage persistence, caps intake at five files and 10 MB combined, derives MIME types from validated PDF/DOCX structure, and removes saved storage objects if the surrounding transaction fails.
- DOCX validation bounds archive entries and expansion, checks required Open Packaging Convention parts and CRC integrity, and rejects encryption, traversal or drive paths, symbolic links, and macro payloads. PDF validation rejects malformed boundaries and active JavaScript, launch, or embedded-file actions.
- Files use server-generated storage names under an application-specific private prefix. No serializer returns a media URL. `/api/appointments/supervisor/applications/<applicationId>/documents/<documentId>/download/` streams an attachment with `nosniff` only after object-level Student, Supervisor, Coordinator-programme, or Office authorization; denied and missing records share `404` behavior.
- `frontend/src/utils/supervisorDocuments.ts` owns browser convenience checks and multipart construction. Django remains authoritative. `SupervisorDocumentsList` centralizes authenticated Blob downloads and legacy availability labels across all role surfaces.
- `/supervisor-appointments/requirements` is an Office-only nested workspace rather than a sidebar module. The wider File Repository and Notifications/Announcements retain their existing ownership and behavior.
- Supervisor requests support terminal student cancellation from `SUBMITTED_TO_SUPERVISOR` through `/api/appointments/supervisor/applications/<id>/cancel/`, with row locking, mandatory reason, timestamp, audit event, and replacement eligibility.
- Protected Supervisor and Panel detail endpoints return complete workflow events only to involved users, programme-scoped coordinators, and Office Staff/Admin. Student users do not receive internal Panel recommendation history.
- Workflow and Approval Tracking owns persisted audit events, role-gated queues, dashboard counts, and stable module/record identifiers. Notification-center fan-out is a separate integration concern; appointment transitions expose the metadata needed for that module without making Notifications/Announcements part of this module's UI scope.
- `appointments.ageing` is a pure derivation layer with optional `now` injection. It maps pending Supervisor and Panel states to their current waiting owner, uses stage timestamp/workflow-transition/update fallbacks, clamps future timestamps to zero days, and returns null metadata for terminal records.
- Panel acceptance transitions directly to `PENDING_COORDINATOR`; `ACCEPTED_BY_PANEL` has been removed from the current model and uniqueness constraint.
- Workload limits come from `Supervisor.max_supervisees` and `Panel.max_appointments`.
- The `marks` app owns versioned rubric families/components, faculty-wide evaluation periods/tasks, mark entries/scores, immutable configuration audits, assignment overrides, and submitted-mark correction audits.
- `Rubric.family_code`, `version`, `target_mark`, and `supersedes` form the version family. `Rubric.is_locked` is derived from published/closed/archived period references or task references; locked versions are cloned rather than edited.
- `EvaluationPeriod.lifecycle_status` persists `DRAFT`, `PUBLISHED`, `CLOSED`, or `ARCHIVED`. `status_at()` derives the displayed scheduled/open/closed state from timezone-aware timestamps while the retained `is_open` field is synchronized only for compatibility.
- Migration `marks.0003` assigns existing rubrics to version 1, uses their active-component total as target, normalizes active display order, and maps existing periods without changing configuration, task, entry, score, or foreign-key identifiers.
- `marks.services` is the transactional configuration boundary. It uses row locks for version cloning, period transitions, and task creation, while draft/submission writes reload and lock the referenced period before validating its window so a concurrent close cannot race a lecturer write. Configuration mutations write immutable `MarksConfigurationAudit` snapshots.
- Marks APIs support lecturer-scoped draft saving and immediate submission locking, plus Office monitoring and task generation from active Supervisor and Panel appointments. Domain-state conflicts are represented by `MarksStateConflict` and returned as HTTP `409`.
- Office Staff/Admin Marks Assignment uses `/api/marks/periods/` and `/api/marks/assignment-options/` to populate production forms for task generation and backup evaluator assignment; raw database ID prompts are not part of the finished workflow.
- The shared `SelectMenu` supports an inline search mode where the field itself is the combobox and the filtered list opens beneath it. Marks backup assignment uses separate Student, Backup Lecturer, and optional official-task controls in this mode; remote person searches remain debounced and limited to 50 results. Its interactive period selector contains only the current workspace period when published and non-ended, remains visible for the single option, and has no blank placeholder. Staff change workspace scope before creating a backup for another period; the entry action is disabled for an ineligible current period.
- Office Staff/Admin Marks overview combines `/api/marks/periods/`, `/api/marks/`, and `/api/dashboard/summary/` so period cards, submission monitoring, and Mark Entry Records use the same live task/record data.
- Mark Entry Records accepts an initial status tab for dashboard and monitoring deep links; shared `src/utils/markRecords.ts` owns mark record summaries and status-tab filtering.
- `/api/marks/` derives display status from task period timing, returning `Overdue` for unsubmitted tasks after `EvaluationPeriod.closes_at` without adding a database status.
- `marks.deadlines` derives `dueAt`, `daysUntilDue`, and `deadlineState` from `EvaluationPeriod.closes_at`; submitted entries return `COMPLETE`, and the Marks workflow remains tracking-only.
- `EvaluationTask.evaluator_role` distinguishes `SUPERVISOR`, `PANEL`, and `BACKUP` tasks; duplicate prevention includes the evaluator role so the same student/period can have separate supervisor and panel marks.
- `marks.services.ensure_period_tasks()` is the shared generation path for manual Office Staff/Admin generation and active-period safety generation. It and backup/manual overrides require a published, non-ended period; backup assignments are audited by `EvaluationTaskOverrideAudit`.
- Privileged mark correction/reopening lives in `marks.services` and is used by authorized Office portal endpoints with mandatory reasons, reviewed record versions and before/after snapshots. Submitted comments follow the same audited correction path as submitted component scores; Django admin provides inspection only.
- Office configuration APIs are rooted at `/api/marks/rubrics/` and `/api/marks/periods/`; stable record details are loaded from `/api/marks/records/<recordId>/`. Configuration endpoints are Office Staff/Admin-only and expose archived periods only with `includeArchived=true`.
- `canAccessMarksAdministration()` guards `/marks/config`, `/marks/rubrics`, `/marks/tasks`, `/marks/records`, and record-detail routes before mounting an Office screen. Django authorization remains authoritative and independently returns `403`.
- The Marks frontend is backend-only. `marksApi.ts` has no mock switch, runtime mock imports, or committed period/rubric state; live API metadata drives lifecycle commands, readiness, overview attention, task totals, lecturer component forms, and Office record details.
- Production artifact tests reject Marks mock canaries and legacy backend-switch content. Unsupported PDFs, mark sheets, simulated sync, fake documents, and notification commands remain absent until authoritative relationships and templates exist.
- `/api/dashboard/summary/` aggregates role-scoped live Supervisor, Panel, and Marks counts, including mark-task counts split by evaluator role.
- `/api/dashboard/tasks/` is the role-scoped action feed. Student Panel actions are deliberately declassified to `FACULTY_PROCESSING` with null record identifiers, while Office Staff/Admin, Lecturer, and Programme Coordinator actions retain only identifiers authorized for their existing module routes.
- Supervisor, Panel, and Timeline retain their existing service boundaries. Marks no longer uses `VITE_USE_MARKS_BACKEND`; its production service always calls Django.

## Testing Strategy

- Run `npm run lint` for TypeScript compilation checks.
- Run `npm run build` for production build verification.
- Run `npm run audit:security` to fail on any npm advisory at low severity or higher. Inspect `npm ls vite tsx esbuild --all` for build-tool changes and `npm ls postcss react react-dom react-router --all` for routing/security updates to catch invalid, vulnerable, or duplicated dependency trees.
- Production security tests must compare report-only and enforced CSP directives, reject permissive script sources, and inspect emitted artifacts for source maps and inline entry scripts.
- Route-level code-splitting changes must keep all routed module screens lazy-loaded from `App.tsx`, avoid raising `chunkSizeWarningLimit`, and preserve the split vendor chunks in `vite.config.ts`.
- Run focused frontend route helper tests with `npx tsx src/constants/routes.test.ts` and `npx tsx src/utils/workflowTracking.test.ts` when navigation behavior changes.
- Run `python manage.py test` for backend workflow and permission checks.
- Start the Vite dev server and smoke-test Dashboard Overview plus each newly routed office-staff module after UI changes.
## Backend-Only Owned Module Boundary

- Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks, and Workflow/Approval Tracking form the production data boundary. Their frontend services import `request`/`requestBlob` only and never import mock datasets, inspect `USE_MOCKS`, or invoke `mockResponse`.
- Global `VITE_USE_MOCKS` and mock latency remain in `apiClient.ts` solely for unfinished or teammate-owned services. The removed module-specific switches cannot override the owned boundary.
- `appointmentsApi.ts` and `timelineApi.ts` preserve their Promise-based component contracts while propagating `ApiError` and network failures to screen-level loading/error/retry states.
- Office supervisor workload is aggregated from active `SupervisorAppointment` rows and `Supervisor.max_supervisees`. Lecturer self-workload and enriched active-supervisee rows provide persisted capacity, identity, research, and appointment detail without local enrichment.
- Supervisor acceptance reloads the backend queue and workload. The active appointment appears only after Programme Coordinator approval creates the persisted `SupervisorAppointment`.
- Timeline upload and entry creation submit a persisted `semesterId`; term and session labels are derived by Django. Add/edit drawers display the selected Draft or Active timeline context and never accept free-text semester identity.
- Source guards inspect owned services and key workflow components; the production artifact guard builds with global mock mode and removed switches deliberately supplied, then rejects legacy exports, switches, fixture canaries, source maps, and demo-console content.

## Central Academic Semester Architecture

- The `academics` Django app owns `AcademicSemester`, immutable `AcademicSemesterAudit`, validation, lifecycle transitions, and the `/api/academics/semesters/` API boundary. Its service layer is the only writer for lifecycle changes.
- Database constraints enforce unique session-term combinations, valid date ordering, and at most one persisted `ACTIVE` row. Service validation additionally rejects overlapping non-archived ranges and invalid Kuala Lumpur effective dates.
- Activation uses a transaction and row locks. When another semester is active, the service closes that semester, closes its published Marks periods, activates the replacement, and records both semester audits before commit.
- Nullable foreign keys connect `SupervisorApplication`, `PanelRecommendation`, `SemesterTimeline`, and `EvaluationPeriod` to the authority. Appointment and Marks descendants inherit the semester through their source workflow or period instead of duplicating mutable relationships.
- Legacy semester text remains intentionally separate from the nullable relationship. Migration does not infer links from student intake or research-profile fields; serializers expose null IDs and `Legacy / Unassigned` labels when the relationship is absent.
- `current_effective_semester()` is the shared write guard. New appointment workflows, Marks publishing, and Marks task generation require an `ACTIVE` row whose dates include the Kuala Lumpur local date; existing decisions continue through their source record.
- Timeline version uniqueness is scoped by academic semester. Dashboard timeline reads resolve only the effective active semester, while Office management can query a selected Draft or Active semester by stable ID.
- Marks periods persist the academic-semester foreign key and validate opening/closing timestamps against its date range. Semester handover closes old published periods; extension deliberately leaves their deadlines unchanged.
- Dashboard action feeds retain unresolved carryover Supervisor and Panel items while Timeline and Marks actions are active-semester scoped. Reports resolve `active`, `all`, `unassigned`, or stable code selectors before applying role/programme authorization.
- The React `academicSemestersApi` is the central client. `/dashboard/semesters` is lazy-loaded and Office-only, while `ActiveSemesterContext` supplies a minimal read-only band to every role dashboard. Timeline and Marks configuration use server-provided semester options rather than local labels.

## Appointment Lifecycle and Reassignment Architecture

- `SupervisorAppointment` and `PanelAppointment` own normalized lifecycle state and closure metadata. Conditional unique constraints enforce one active appointment per Student/profile, while nullable self `supersedes` links preserve handover lineage.
- `AppointmentLifecycleEvent` is append-only and references exactly one appointment through a database check constraint. Approval events remain in `AppointmentWorkflowEvent`; lifecycle activation/closure events are a separate audit stream.
- `appointments.appointment_lifecycle` is the transaction boundary for direct closure and approved handover. It locks referenced and active appointment rows, validates actor scope and lineage, retires dependent Marks tasks, applies transitions, and converts uniqueness races into `409` conflicts.
- Supervisor final approval continues through `supervisor_handoff.approve_supervisor_application`. That transaction provisions the research profile, invokes lifecycle handover, cancels outgoing in-flight Panel recommendations, and appends the approval event as one unit.
- Panel final approval locks the recommendation and invokes the same handover service. Replacement serializers validate ownership, incumbent IDs, different evaluators, reasons, active workflow uniqueness, workload, and semester availability.
- `EvaluationTask` has an active/retired lifecycle and active-only uniqueness constraint. Immutable `EvaluationTaskHandoverAudit` rows store outgoing draft snapshots and optional replacement tasks while preserving historical evaluator attribution.
- Operational Marks, dashboard-action, report, workload, and completion queries filter active appointments/tasks. Office Marks records and authorized dossiers include retired history explicitly.
- Role UI reuses `AppointmentEndControl`, existing Supervisor application forms, and the Panel recommendation drawer. Coordinator Supervisor history has a dedicated programme-scoped endpoint instead of broadening Office monitoring.
- Migrations `appointments.0010` and `marks.0005`/`0006` add lifecycle state, lineage, audits, and conditional constraints without fabricating legacy closure dates or reasons.

## Academic Participant Lifecycle Architecture

- `accounts.Student` retains its existing business states and adds authoritative transition timestamp, Office actor, and reason. `accounts.Lecturer` adds `ACTIVE`, `RETIRING`, and `RETIRED` plus equivalent transition metadata.
- `ParticipantLifecycleAudit` is append-only, references exactly one Student or Lecturer through a database constraint, and stores previous/new state, actor, reason, affected record identifiers, and server time.
- `accounts.participant_lifecycle` is the transactional orchestration boundary. It row-locks participants, calculates blockers, delegates appointment closure to `appointments.appointment_lifecycle`, delegates task pause/resume/retirement to `marks.services`, writes workflow/lifecycle audits, and disables/revokes retired Lecturer sessions before commit.
- `accounts.eligibility` is a dependency-light shared policy used by appointment serializers/views and Marks generation. Candidate query filtering is paired with mutation-time validation so stale clients and crafted participant IDs cannot widen eligibility.
- `EvaluationTask` adds `PAUSED`; `EvaluationTaskLifecycleAudit` stores immutable pause/resume/retirement reasons and draft score/comment snapshots. Active-only operational queries naturally omit Paused and Retired history, while Office records and dossiers continue to query every lifecycle state.
- `/api/accounts/participants/` is Office-only and returns summary counts, filtered Student/Lecturer rows, blocker counts, actionable pending record IDs, account access, and immutable audits. Transition conflicts return `409`; unknown records return `404`; malformed transitions return `400`.
- `/dashboard/participant-lifecycle` is a lazy-loaded Office workspace under Dashboard routing. It provides filters, summary counts, blocker inspection, mandatory-reason transitions, individual pending-work cancellation, conflict/retry states, and audit history without a sidebar item.
- The authenticated `/auth/me/` payload exposes only the current participant lifecycle status and account-access class needed for read-only Student and Retiring Lecturer dashboard banners. Backend authorization remains authoritative.
- Workflow Reports append current participant lifecycle counts and attention records only for Office scope. Dossiers serialize reason, actor, and audits only for internal viewers; the public Student representation contains status and effective date only.
- Ordinary Django Admin lifecycle fields are read-only to prevent bypassing transactional side effects. Audit models are registered as immutable inspection surfaces.

## Workflow Reconciliation Architecture

- `dashboard.reconciliation` is a live query/service boundary over Accounts, Academics, Appointments, Dashboard/Timeline, and Marks. Detectors return ephemeral issues; only successful repair audits are persisted.
- Stable issue IDs combine detector, entity type, and entity ID. SHA-256 fingerprints cover current state and suggestion, providing preview/apply optimistic concurrency without mutable issue rows.
- `/api/dashboard/reconciliation/` supports module, severity, repairability, programme, search, and pagination filters. Preview/apply rescan current state; audits are Office-only and append-only.
- `accounts.authorization.coordinator_programme()` centralizes programme scope. User role is the portal gate and `Coordinator.programme_managed` is the sole authority used by Appointments, Dashboard actions, Reports, Dossiers, lifecycle services, and reconciliation.
- Repairs use `transaction.atomic`, `select_for_update`, current eligibility/workload checks, and existing appointment/Marks services. Semester assignment preserves legacy strings; approved handoff repair retains original Coordinator attribution and decision date.
- `marks.services.reconcile_evaluation_task()` performs one-task pause, resume, or retirement with submitted-entry rejection and immutable draft/comment snapshots. Missing tasks continue through idempotent `ensure_period_tasks()`.
- `WorkflowReconciliationAudit` stores issue/entity/action, Office actor, mandatory reason, fingerprint, before/after JSON, affected identifiers, and timestamp. Updates and deletes are rejected.
- The lazy Office-only React route uses typed list, preview, apply, and audit services with filters, pagination, current-state inspection, deep links, explicit confirmation, stale-conflict recovery, and no Apply control for review-required issues.
- Dashboard tasks and Workflow Report attention rows link to reconciliation. Announcements/Notifications and unsafe history merges remain outside this boundary.

## Lecturer Capacity Architecture

- `SemesterCapacityPlan` versions belong to `AcademicSemester`; only one Published version is authoritative per semester. `academics.services.lock_academic_semesters()` is the shared `select_for_update()` primitive for PK-ordered semester locking. Activation locks and re-resolves the target and current Active semester before preserving the existing Marks handover, while capacity copy uses the same order across semester boundaries. `academics.capacity_services` creates blank or copied Drafts only for Draft/Active targets, sequences versions under deterministic semester/plan locks, and records the locked source in `supersedes` for both cross-semester copies and same-semester clones. Cross-semester copy locks the semester set before requiring the latest strictly prior Published source by `(ends_on, stable ID)`. COPY audit before/after snapshots retain the source and resulting lineage IDs. Model uniqueness/constraint checks are skipped only for the internally allocated plan version, leaving database uniqueness as the final concurrent authority while retaining field validation and framework-neutral conflicts.
- Draft entry edits and publication require a lowercase SHA-256 `expected_fingerprint`. `capacity_plan_content_fingerprint()` hashes canonical JSON containing stable plan identity/lifecycle fields plus entries ordered by Lecturer/entry ID with role limits and ISO update timestamps. The snapshot exposes this as `contentFingerprint`; display strings, audit data, and the fingerprint itself are excluded. Both write paths lock the current plan and relevant entries before recomputing, reject malformed tokens as validation errors and mismatches as `CapacityPlanConflict`, and mutate/audit only after a match. Publication locks every entry belonging to the locked same-semester plan set in `(plan_id, lecturer_id, pk)` order before fingerprint/readiness validation and atomic supersession/publication; entries from other semesters are outside that lock scope. API serializers map exact camelCase `expectedFingerprint` and `expectedVersion` fields into this domain contract; no migration is required.
- `LecturerCapacityEntry` snapshots independent Supervisor and Panel limits. Validated individual model saves are the authoritative mutation path; direct QuerySet and bulk updates, conflict upserts, conflict ignores, and unsupported bulk-create options are disabled. Ordinary conflict-free bulk creation is limited to one Draft plan per batch: it deterministically locks that plan, prevalidates every entry and in-batch plan/Lecturer uniqueness before the first save, then saves sequentially in one transaction. Each validated model save may safely reissue the same plan lock. Any failure restores every caller object's original primary key and Django persistence state before re-raising the original exception. Instance deletion locks and validates the exact persisted entry and Draft plan before delegating to Django's model deletion so signal instance and origin semantics remain native. QuerySet deletion captures the exact locked and validated entry primary keys, then runs cascaded or raw deletion through a fresh primary-key-only queryset so mutable related-field predicates are never re-evaluated.
- `LecturerAvailabilityWindow` stores role-specific, semester-bounded operational restrictions without deleting or rewriting history. Creation is limited to Draft/Active semesters and locks the semester, current lifecycle-Active Lecturer/profile, and active same-role windows before overlap validation. Cancellation remains available for historical semesters and after Lecturer role/lifecycle removal, follows the same semester-first lock order, rejects stale/already-cancelled state, and changes only complete cancellation metadata. Projected-state model validation exempts a removed profile only for a persisted row whose locked original `(semester_id, lecturer_id, role)` identity is unchanged; new fully cancelled rows and identity-reassigned cancelled rows perform normal role validation. Cancelled windows cannot become active again, while unsafe bulk mutation and physical deletion paths remain disabled.
- `LecturerCapacityAudit` is append-only across instance, QuerySet, bulk-update, deletion, and conflict-update paths. Task 3 services emit one audit per affected action using the existing stable action values, dedicated entity foreign keys, actor/reason, and primitive/ISO before/after snapshots. `capacity_plan_snapshot()` orders entries by stable Lecturer identity, includes the canonical content fingerprint, and remains deterministic and JSON-safe.
- Draft readiness is derived from current persisted lifecycle and Supervisor/Panel profiles. Every eligible Lecturer needs exactly one entry, required-role limits must be non-null, absent-role limits must be null, and zero remains valid. Copying drops ineligible historical rows, adapts removed roles to null, skips source rows whose newly required limit is unknown, and never copies availability windows.
- `academics.capacity` is the shared read-only semester/role resolver. It reads only the published plan, current persisted account/lifecycle and role eligibility, active same-role availability windows, and global workload rows. State precedence is `INELIGIBLE`, `NOT_CONFIGURED`, `TEMPORARILY_UNAVAILABLE`, `OVER_CAPACITY`, `FULL`, then `AVAILABLE`; zero limits and non-negative arithmetic are handled explicitly. Its frozen result exposes an applicable availability end date only when the final state is `TEMPORARILY_UNAVAILABLE`; every other state returns null, and neither the result nor public conflict messages expose the internal reason.
- Workload semantics: active primary/supporting appointments and accepted primary reservations consume Supervisor capacity; active Panel appointments and accepted recommendations awaiting Coordinator approval are reported separately as active and reserved load. Unanswered requests consume neither role’s capacity. Existing no-semester workload-limit callers continue reading legacy profile values; semester-aware compatibility calls delegate to the resolver and fail closed to zero for missing policy or ineligible Lecturers.
- `academics.views` exposes Office-only capacity-plan list/create/detail/compatibility-edit/clone/publish, nested Lecturer-entry update, semester availability list/create, availability cancellation, and capacity-audit list endpoints. Views authenticate and authorize before object resolution, validate camelCase serializers, enforce client version identity, and delegate every mutation to `academics.capacity_services`. Base `CapacityLifecycleConflict` and resolver `CapacityConflict` map to `409`; malformed domain values map to `400`, unknown objects to `404`, and database races to a stable `409` response.
- Capacity plan payloads include semester identity, version/origin/supersession lineage, current-published and readiness state, canonical `contentFingerprint`, actor/timestamp metadata, and entries ordered by staff number and stable IDs. Entry payloads retain Draft limits while exposing current shared-resolver load/state metadata for held roles. Caller-loaded entries are reused for readiness and fingerprinting, and a focused query ceiling guards the detail response. Availability/audit payloads are deterministic; internal availability and cancellation reasons exist only behind Office management authorization.
- `StrictCapacitySerializer` rejects every request-body key outside each capacity command's declared camelCase fields. The empty clone serializer prevents ignored data from producing plan/audit side effects, while a dedicated strict reason serializer protects availability cancellation without changing the shared Semester `ReasonSerializer`.
- Capacity plan, audit, and availability histories use the reusable validated `CapacityLimitOffsetSerializer` with a 25-row default, 100-row maximum limit, and zero-based offset capped at 1,000,000. The serializer rejects larger offsets before queryset slicing so unsafe database offsets cannot reach PostgreSQL. Views slice ordered querysets and retain array bodies, then attach `X-Total-Count`, `X-Limit`, and `X-Offset`; `config.settings.CORS_EXPOSE_HEADERS` makes these metadata headers readable by the frontend.
- Plan-history pages prefetch page entries with Lecturer/profile/actor relations and successor lineage. `capacity_plan_payloads()` collects unique Lecturers, loads one published-policy/workload/availability context, and reuses one current-eligibility set across every listed version. Detail serialization retains the same payload contract through the same pure capacity-state derivation.
- `IsOfficeStaffAdmin` is combined with `IsAuthenticated` on every capacity management function-based API view. DRF dispatch therefore rejects non-Office `OPTIONS`, `HEAD`, unsupported methods, and normal commands before metadata handling, object lookup, serializers, or service calls; the existing body guard remains defense in depth.
- `academics.services.activate_semester()` locks and re-resolves all semesters in stable primary-key order, validates the target Draft/date state, then calls `validate_published_capacity_ready()` before deriving or mutating the current Active semester. Missing, multiple, or incomplete Published policy raises `SemesterConflict`; prior-semester closure, Marks-period closure, and all handover audits therefore remain untouched on failure. Successful handover behavior is unchanged after the gate.
- Data migration `academics.0003_seed_capacity_baselines` uses only historical models. It targets the current Active semester and semester foreign keys on unresolved Supervisor/Panel workflows, skips every semester with an existing Published plan, assigns the next unused version without superseding history, and snapshots legacy Supervisor/Panel limits only for lifecycle-Active Lecturers with active accounts and corresponding role profiles. The operation is idempotent; reverse is intentionally a conservative no-op because later plans or audits may depend on the baseline.
- `academics.test_capacity_helpers.publish_test_capacity_plan()` builds complete realistic fixture policy through the same fingerprinted lifecycle services. A suitable Published plan is reused; any other pre-existing policy fails the fixture instead of being silently replaced. Guarded `seed_users` follows the same service flow before first demo-semester activation and never changes existing capacity history.
- Appointment candidate endpoints resolve the current effective semester once, derive each eligible Lecturer's role-specific state through `academics.capacity`, omit ineligible and temporarily unavailable new selections, and pass immutable resolutions into serializers. Candidate and Office/Lecturer workload payloads share the same semester/plan/version, load, limit, slot, state, selectability, and public availability-date contract; compatibility fields remain available for existing frontend consumers.
- Supervisor and Panel submissions perform an early resolver check and repeat it after Student/Lecturer row locking before persistence. Final Coordinator approvals lock the source workflow, participant, and target Lecturer, then recheck the workflow's persisted `academic_semester`; the only capacity-semester substitution is an explicit Office carryover reassessment authorization, while the workflow semester itself remains unchanged. `CapacityConflict` is translated to `409`, and the surrounding transaction preserves the pending workflow and all downstream records.
- `activate_replacement()` is the final shared assignment boundary for ordinary and replacement activations. It locks the incoming Lecturer and repeats the role-specific source-semester guard before ending an old appointment. Panel activation excludes only its own recommendation reservation, preventing double counting while preserving all unrelated reservations. Supervisor and selected-Panel acceptance rechecks capacity under locks before reserving a place; rejection remains available under existing eligibility guards.
- Persisted Supervisor applications and Panel recommendations derive only `unavailableUntil` for their already-selected Lecturer. The shared resolver returns that date only for the final `TEMPORARILY_UNAVAILABLE` state, so Student-facing payloads never expose Office reasons or internal capacity policy details.
- `dashboard.reports` resolves current Supervisor and Panel capacity through the same semester policy used by appointment mutations. Office reports receive complete role-state distributions and capacity attention; Coordinator and Lecturer report payloads set the faculty capacity section to null. Existing workflow rows and XLSX sheets carry plan/version, state, limit, load, slots, and public availability dates without exposing internal reasons.
- `dashboard.actions` adds Office-only `LECTURER_CAPACITY` actions for over-capacity, temporary-unavailability, and active-semester unconfigured states. They participate in the existing deterministic 20-item action limit and navigate through Dashboard metadata rather than creating a separate workflow record.
- `dashboard.reconciliation` derives current capacity-policy issues alongside its existing cross-module scan. Missing plans are considered only for Draft/Active semesters; incomplete publication, current role mismatch, overlapping active windows, defensive multiple-publication detection, and Published-versus-legacy divergence are review-only. A missing Draft plan is repairable only from exactly one prior Published source, and `COPY_CAPACITY_PLAN` revalidates its fingerprint under transaction locks before using the capacity lifecycle service and recording a separate immutable reconciliation audit.
- `frontend/src/types/lecturerCapacity.ts` mirrors the persisted plan, entry, resolver, availability, and audit response contracts. Appointment and Workflow Report types reuse the same `CapacityState` vocabulary, keeping plan/version/load metadata consistent across configuration and operational screens.
- `frontend/src/services/lecturerCapacityApi.ts` is backend-only and delegates every capacity read/write to the authenticated shared API client. Commands retain exact camelCase version/fingerprint/reason fields and bounded history query parameters; no global mock switch or mock response is inspected.
- `frontend/src/utils/lecturerCapacity.ts` centralizes state labels, safe utilization, role-limit completeness, semester-contained date validation, Kuala Lumpur calendar-date derivation, mutable-semester checks, and stale conflict messaging. `APP_ROUTES.dashboardLecturerCapacity` is known-path protected, lazy-loaded, Office-only, and outside sidebar mapping.
- `LecturerCapacityManagement` is the Office operational workspace. It loads bounded plan, availability, and audit histories together for the selected semester, derives role loads through shared utilities, and keeps all writes behind focused drawers. Draft edits send version/fingerprint concurrency tokens; publication and cancellation require reason plus confirmation; a stale `409` preserves the drawer context while refreshing persisted state. Closed and Archived semesters retain read-only policy history, but previously persisted availability can still use the backend's reasoned historical-cancellation path.
- Capacity entry callbacks are threaded through existing Office Dashboard, Semester, Supervisor workload, Panel workload, and Reconciliation surfaces. This keeps the feature discoverable without a sidebar addition and leaves Lecturer/Student/Coordinator route guards authoritative.
- `capacity_workload_payload()` now carries the effective semester code with the existing plan/version/resolution metadata. Office workload rows and Lecturer own-workload responses therefore share one server-derived export and display contract. `/api/appointments/panel/my-workload/` mirrors the existing Supervisor own-workload authorization and returns the authenticated Lecturer's confirmed Panel appointments, pending reservation nominations, total load, and current shared-resolver state.
- Student and Lecturer candidate controls consume `selectable` rather than recalculating eligibility in React. `panelRecommendationWorkflow` retains legacy count fallback for backward compatibility but gives persisted capacity state/selectability precedence and formats only the public `unavailableUntil` date. Final-approval `409` handlers preserve local queue rows and refresh them from Django.
- Lecturer Dashboard and appointment workspaces consume both own-workload endpoints. Office workload monitors use the same metadata for state chips, detail context, bounded utilization, and CSV columns; Supervisor reserved load is zero under the current policy, while Panel active and reserved columns map to confirmed appointments and pending nominations.
- The approved detailed design is recorded in `docs/superpowers/specs/2026-08-19-lecturer-capacity-availability-design.md`. Tasks 1-10 cover the complete backend policy boundary, enforcement, reporting/reconciliation, Office workspace, and role-scoped presentation. Final integration verification uses the full owned-module backend suite, every frontend test and production guard, and a live four-role HTTP matrix; browser-only visual interaction remains a distinct smoke surface and is never inferred from transport-level success.
## Dependency Security Maintenance: September 2026

- Backend requirements now exclude the audited vulnerable Django, REST framework, and sqlparse releases while retaining Django 5.2 LTS and bounding DRF to 3.17. The explicit sqlparse floor constrains Django's transitive dependency on fresh installations. Pip is environment tooling, so its upgrade is documented in setup commands rather than added as an application dependency.
- The frontend lockfile updates Browserslist, baseline-browser-mapping, and their browser-data dependencies within the existing dependency graph. No application APIs, database schema, or direct frontend dependency ranges change.
- Upgrade references: [Django 5.2.17](https://docs.djangoproject.com/en/5.2/releases/5.2.17/) and [DRF 3.17.2](https://www.django-rest-framework.org/community/release-notes/#3172). Verification consists of installed-environment and npm audits, dependency consistency, existing backend/frontend regressions, Django checks, and the production build/guards.

## Co-Supervisor Implementation: September 2026

The approved extension introduces dedicated supporting nomination and appointment records in Appointments, preserving the primary SupervisorAppointment and StudentResearchProfile supervisor relationship. Co-supervision uses the shared semester capacity resolver, programme-scoped approval, transactional student/lecturer locks, and immutable audits. Supporting appointments never generate Marks tasks. Dedicated restricted team API responses separate supporting read access from application documents, evaluation drafts, scores, and internal dossiers. Existing Supervisor screens host team management; Dashboard tracking, reports, lifecycle and reconciliation consume supporting records.

- `appointments.0012_co_supervisor_team` adds nomination/appointment tables and optional supporting-record foreign keys to existing immutable audits. Updated exactly-one-record audit constraints preserve primary and Panel events. Partial unique constraints protect pending candidate nominations, pending replacements, and active student/lecturer membership; the domain service enforces the two-position aggregate limit under a Student row lock.
- `appointments/co_supervision.py` owns transactional nomination, decisions, closure, replacement, authorization, and restricted projections. Writes lock the student before relevant lecturer rows in primary-key order. Final approval rechecks the persisted nomination semester's shared supervision capacity (or an explicitly authorized active-semester reassessment) and all role conflicts before ending a predecessor or activating an appointment. Rejected/cancelled attempts remain historical; repeat attempts create new rows.
- `/api/appointments/co-supervisor/` returns the role-scoped team workspace and personal history. Student detail and candidate reads are nested under `students/<id>/`; `nominations/` creates requests, `nominations/<id>/<action>/` accepts/approves/rejects/cancels, and `appointments/<id>/end/` performs reasoned Office/Coordinator closure. Responses use explicit camelCase projections and allowed-action flags. Validation, permission, missing-record, and stale-state failures use `400`, `403`, `404`, and `409` respectively.
- Primary and Panel submission/final-approval services enforce supporting-role conflicts under the shared student lock. Primary lifecycle hooks cancel originating unfinished co-supervisor nominations while retaining approved co-supervisors. Participant lifecycle services include supporting work in blockers and closure; no supporting mutation calls Marks task handover or retirement.
- `SupervisoryTeamManagement.tsx` is embedded in existing Student, Lecturer, Coordinator, and Office Supervisor screens. Typed backend-only API methods serve team search/pagination, review/history, nomination/replacement, and lifecycle controls. Reason forms prevent duplicate submissions and refresh stale `409` state. Lecturer mutations refresh the parent's shared workload view.
- `dashboard/co_supervision_tracking.py` supplies scoped actions and read-only integrity findings. Reports append explicit co-supervisor rows; XLSX appends role/type columns without moving existing columns. Workload CSV includes primary/co counts and role labels. Dossiers add team membership only where the existing dossier authorization and dedicated team authorization both permit it. Supporting-only lecturers navigate to the restricted team workspace; ended appointments retain personal historical records without current research access.
- Verification includes transaction races for team positions and shared capacity, additive migration round-trip preservation of primary/Panel/research/Marks/audit records, lifecycle and restricted-access regressions, frontend API/error contracts and role rendering, and live JWT-authenticated HTTP flows through Vite. Browser visual smoke remains a separate check when its runtime is available.

## Carryover Capacity Reassessment (2026-09-29)

- Appointments owns the reasoned capacity authorization and immutable event history. A shared resolver selects the source policy by default and the authorized target policy only while that semester remains effective and Active; approval records the policy actually used.
- Office grant/revoke endpoints and scoped staff reads live under the existing Appointments API. Optimistic status, target-semester, authorization and latest-event identifiers reject stale user actions, including a grant form submitted after another user revokes it. Transactional decision paths recheck eligibility and capacity before appointment mutation.
- Existing Supervisor and Panel activation guards and co-supervisor acceptance/approval use the same reassessment decision. Global workload accounting, Panel self-reservation exclusion and supporting-position limits remain intact.
- A reusable section inside the supervisory-team workspace provides Office controls and coordinator history without introducing another top-level module. Backend authorization remains authoritative.
- Additive schema changes preserve workflow foreign keys and original semesters. Focused regression coverage verifies policy choice, permissions, audit immutability, stale actions and unchanged source history. Verification results are recorded in PROJECT_STATUS.md.

- Carryover decisions acquire semester `FOR NO KEY UPDATE` locks before Student/request/Lecturer locks. These serialize policy and lifecycle writes while permitting unrelated foreign-key inserts. Reconciliation handoff repair follows the same order; semester assignment locks the semester before the record. Marks generation and backup creation use non-key period locks so an in-flight appointment replacement can commit its new task while generation waits on the Student. PostgreSQL race tests retain controls that reproduce the previous lock conflict.
- Migration `appointments.0015_capacity_reassessment` adds an append-only `CapacityReassessmentEvent` ledger with exactly one workflow foreign key per event. Grant/replacement, revocation and consumption preserve actor identity, reason, stage, target semester and the capacity snapshot; no inferred historical grants are seeded.

## Report, Backup Assignment and Timezone Corrections (2026-09-30)

- The workflow XLSX writer creates literal string cells for report text on every sheet, including Summary. The shared CSV utility neutralizes formula-leading string values before delimiter escaping without altering numeric values. Regression tests save and reload the real workbook and exercise CSV prefixes/quoting.
- Manual backup creation uses its existing period/Student/Lecturer locks to reject non-retired duplicates and insert a new ACTIVE task when only historical rows exist. No schema change or historical-task update is needed. Fresh assignment alone creates an override audit. Concurrency coverage checks that duplicate submissions create one task and one audit.
- A shared Malaysia-time utility parses datetime-local input with an explicit UTC+08:00 offset and provides device-independent edit/display formatting. Period configuration and completion-window controls reuse it; tests cover UTC, Malaysia and New York device timezones.


## Appointment icon presentation (24 October 2026)

- `AppointmentPrimitives.tsx` exports `AppointmentIcon`, a static 36 px icon tile with an 18 px Lucide SVG, explicit tones and decorative accessibility attributes. Shared summary/section components accept optional icon props; member and guidance cards provide appropriate defaults.
- Supervisor/Panel navigation maps section identifiers to recognizable icons. Appointment request/research sections, Lecturer summaries, Office attention categories and workload monitoring reuse existing presentation components and tokens. No new dependency, API, data calculation or workflow is introduced.
- Existing selected-link coverage now extracts the selected anchor text independently of decorative markup. Production-component fixture previews at 1440/390/320 px complement existing component and mounted browser suites; source and screenshots live in `output/appointment-visual-polish-20261024/`.


### Appointment visual follow-up review (24 October 2026)

- Office Supervisor and Panel attention buttons use explicit column layout with stretched children, keeping icon rows top-aligned when description lengths differ. Button semantics, selection state and callbacks are unchanged.
- The isolated preview runner checks local card/navigation/heading clipping and equal icon-row positions. Expanded scenarios cover Panel attention, workload summaries, Student supervisor cards, long capacity-state badges and intermediate widths; Office previews use the Office browse context. This complements existing mounted regressions without claiming authenticated full-page coverage.


### Research request detail presentation (24 October 2026)

- `ResearchAmendmentCard` supplies explicit icons and the shared appointment detail heading typography to its own summary/comparison/team sections. Profile navigation reuses the existing button icon prop.
- `ApprovalProcess` accepts an optional decorative heading icon, used by research requests in all normal and historical branches. Calls without an icon retain their original heading markup. Approval-state calculations, role capabilities and snapshot comparisons are unchanged.
- The existing research header assertion checks the semantic summary section and its disabled profile action independently of decorative SVG markup. Preview mode `POLISH_RESEARCH=1` mounts the actual record page/card for approved, pending and historical research requests.


### Saved research profile presentation (24 October 2026)

- `LecturerResearchWorkspace` renders the selected profile without a secondary directory-return button; the enclosing record page provides return navigation.
- Shared `ResearchAmendmentRouteContent`, `StudentResearchProfileCard` and `ResearchProfileHistoryCard` reuse `AppointmentIcon` for book/history headings. Detail and history headings use existing appointment detail typography. The Office correction/transfer action uses its existing optional button-icon prop.
- Native history/revision details, closed defaults, student-switch resets, sorting and role capability checks remain intact. The profile preview mode mounts the real `LecturerResearchWorkspace` inside `RecordPage`, with Office/Student read fixtures and collapsed/expanded history checks.

### Office tools icon composition (24 October 2026)

- `OfficeToolSection` and `OfficeToolViews` accept explicit optional Lucide icon props. `OfficeToolHeading` supplies the existing heading typography with a decorative tile for standalone calendar/capacity headings. Reuse `AppointmentIcon` and its muted palette rather than introduce another icon system or change global page headers.
- Semester/calendar navigation retains text and pressed-state semantics. Semester records, submission overview, capacity policy/workload/version collections and reconciliation summary/list headings receive task-specific icons. Dashboard tool-group icons use the same neutral tile.
- No API, authorization, data, persistence, dependency or workflow changes. `POLISH_TOOLS=1` in the existing visual capture script mounts actual Office workspaces against fictional read-only fixtures at desktop and narrow widths.


## Panel acceptance reservations — 29 October 2026

`PanelRecommendation.PENDING_STATUSES` covers both ongoing review states; `WORKLOAD_RESERVED_STATUSES` covers only `PENDING_COORDINATOR`. Capacity totals/publication/workspace use reservations; workflow and integrity consumers use pending statuses. Historical migrations retain their historical semantics. No existing request statuses are rewritten.

Panel acceptance follows the existing policy-semester → Student/request → Lecturer lock order, rechecks effective request capacity and atomically changes status. Final approval excludes its own reservation. The activation and reconciliation paths close only other unaccepted nominations whose own effective policy is filled by ACTIVE appointments. Closure stores cancellation metadata, a System workflow event and deduplicated in-app notifications within the same transaction. Migration `0020_panel_capacity_full` adds the terminal choice without altering stored records.

The existing nomination serializer supplies `acceptanceCapacity` (active, reserved, limit, available places, pending requests and state) for ongoing nominations. The panel detail and acceptance dialog use that request policy; the dashboard remains a current-semester summary. Existing AlertMessage/DecisionDialog components render the concise warning; acceptance fails closed if capacity metadata is missing.

Validation includes real PostgreSQL competing acceptances, request/closure/recovery API tests, capacity publication/workflow regressions, SSR checks and mounted desktop/mobile browser scenarios.


## Approved handoff repair policy resolution — 29 October 2026

`dashboard.reconciliation._request_capacity_available()` uses the shared `assert_request_capacity()` guard for both Supervisor and Panel handoff detection. Panel repair repeats that guard after policy/Student/request/Lecturer locking; `activate_replacement()` retains its final guard. Removed the separate current-semester Panel workload/legacy-limit precheck.

`capacity_reassessment.capacity_semester()` resolves an APPROVED request with a latest CONSUMED event to that event's recorded target semester. This is approval evidence, not a new grant: Closed targets remain usable for recovery while archived sources/targets are blocked. Requests without consumed approval evidence retain original-policy or existing current-Active reassessment freshness rules. Repairs do not consume the authorization again, change the request semester or rewrite approval history. No schema or frontend changes.

Regression tests use real Office list/apply endpoints and the locked repair handler, cover differing current/source limits, consumed carryover, archived/missing/restricted/full policies, reservations, stale unconsumed grants, changes after preview and preserved approval attribution/audits.

## Candidate capacity presentation (29 October 2026)

`CandidateCapacity` and `CandidateCapacityBreakdown` share read-only availability presentation across Supervisor application and Panel nomination selectors. They use server capacity state/remaining counts, with existing legacy total/load fallback only for display. The Panel candidate API adds `activeLoad` and `reservedLoad` from its existing cached capacity resolution; no new workload queries, database schema or reservation rules. Selection, busy/intake guards and server capacity enforcement remain in their existing owners.

## Capacity audit version browsing (30 October 2026)

Capacity audit payloads add nullable planVersion from the protected plan relation, eagerly loaded with actor to avoid per-row queries. Audit browsing accepts a positive integer version filter before counting/pagination. Only paginated audit envelopes add a descending versions list scoped to the selected semester; existing array consumers remain compatible. The Office collection owns the immediate filter and receives optional initialVersion from version shortcuts. Copy-source descriptions use immutable beforeValues snapshots; events without a linked plan remain semester-wide. No database migration or mutation/audit behavior changes.

## Capacity semester selection refresh (30 October 2026)

The Office capacity workspace retains the full semester catalogue for historical copy-source resolution but derives non-archived working options separately. Semester resolution validates URL/current selection before loading capacity collections. A separate generation counter suppresses stale catalogue reads; return-to-focus refresh revalidates lifecycle before refreshing the selected workspace, clears invalid cached plans/roster, and disables readiness during refresh. Existing server lifecycle guards remain authoritative. No backend API/schema changes were required.

## Shared Office semester control (30 October 2026)

OfficeAcademicSemesterSelect composes the existing PortalSelect and StatusBadge with the established capacity-semester CSS classes, common Malaysia date formatting and getStatusBadgeTone. Calendar, capacity and periods supply eligible options, selected ID, disabled state and their existing change handlers. Effective status takes precedence over lifecycle for display, while lifecycle continues to control permissions. The PortalSelect adapter now omits hidden native options from its custom menu, retaining native form/validation markup. Shared badge mapping covers Published/Open/Upcoming; managed submission-window details use the same mapping. No backend contracts, lifecycle rules or data changes.

### Shared semester transition modal (31 October 2026)
- AcademicSemesterManagement renders every lifecycle transition through SemesterTransitionSurface using PortalModal; the archive-only modal branch and inline-card fallback are removed. Existing transition state, dirty-discard dialogs, busy guards and signed closure review remain unchanged.

### Calendar linked-window navigation (31 October 2026)
- Calendar links retain semester and period anchors and add manage=window. OfficePeriodsManagement passes this explicit intent into OperationalPeriodManagement, which validates the owning activity and window before opening its existing RecordPage. Ordinary anchor links retain row-focus behavior. Timeline entry spacing and minimum desktop width are scoped to the Entries table; small-screen cards remain intact.


### Calendar event editing consistency — 31 October 2026

Timeline entry PATCH accepts extensionReason and expectedDeadlineEnd. An unlinked later end date requires a reason and passes semester/date validation; metadata and date changes commit atomically with one EXTEND audit containing before/after dates. Linked metadata PATCH omits dates and retains existing owning-period validation. Calendar Entries always opens the editor; its linked date section provides the direct window management link.

### Calendar import review presentation — 31 October 2026

UploadTimelineDrawer paginates validated previews locally in batches of ten without changing the signed token or import payload. Clearing, selecting or re-previewing a file resets pagination. Table overflow remains horizontal on narrow screens; the modal retains bounded scrolling.

### Guided Calendar workbook generation — 31 October 2026

The existing openpyxl template generator preserves import header names and adds supported Activity Code/Period ID columns, header comments, list validation, explicit date formats, frozen headers, wrapped examples and an Instructions sheet. The parser selects the named Timeline sheet regardless of the last active tab, falling back to the active sheet for legacy workbooks. Backend import and period-link rules remain authoritative and unchanged.

Calendar template Instructions freezes only its title row (A2), leaving the field guide scrollable on short displays; introductory guidance is not pinned.

### Simplified calendar import contract — 31 October 2026

Template headers are Level, Title, Detail, Action, Deadline Start, Deadline End and Target Roles. Week Label is no longer required or generated (legacy files remain readable). Populated legacy mapping columns are rejected with direction to Periods & deadlines. Existing exact matching links are preserved on replacement, including their legacy week metadata; replacement cannot drop linked records. Preview projection omits link IDs and the UI removes the link guidance and schedule-source column. Instructions has no freeze/split pane and 85% default zoom.

### Calendar responsibility editor mapping — 31 October 2026

TimelineEntry retains optional action through timelineEntryToLegacy. Create/Edit bind a required 255-character Responsible parties input, include it in dirty state and send it as the existing API action field. Omitted action in older create callers retains the previous audience fallback; omitted update action preserves stored responsibility. No schema or permission change.


## Submission-window overview cleanup — 31 October 2026

OperationalPeriodManagement uses separate Window and Programmes columns for appointment and Marks window lists. Calendar linkage remains in the managed record. Existing backend publication overlap validation is unchanged.


## Window-table alignment correction — 31 October 2026

Replaced obsolete five-column widths with scoped six-column sizing for appointment and Marks windows. Desktop tables scroll inside their container if needed; mobile retains labelled cards. Opens and Closes use identical two-line date/time presentation with explicit MYT. Status and action retain separate space. Validation: TypeScript passed; focused mounted browser checks passed at 1440, 1280, 390 and 320px for both appointment and Marks tables, including column separation, date structure and page overflow.


## Submission-window overview cleanup — 31 October 2026

OperationalPeriodManagement uses separate Window and Programmes columns for appointment and Marks window lists. Calendar linkage remains in the managed record. Existing backend publication overlap validation is unchanged.


## Submission-window overview cleanup — 31 October 2026

OperationalPeriodManagement uses separate Window and Programmes columns for appointment and Marks window lists. Calendar linkage remains in the managed record. Existing backend publication overlap validation is unchanged.

### Submission window detail cleanup - 31 October 2026
- OperationalPeriodManagement uses separate window, calendar and native details/summary history cards for appointment and Marks windows. History retains lazy extra-time loading and revoke controls; presentation maps audit actions to plain-language titles. PeriodCalendarConnection suppresses additional linking when a connection exists; server contracts are unchanged.

### Submission schedule and readable history revision - 31 October 2026
- Window details reuse SupervisorRequestDisclosure for history. OperationalHistory follows RequestAuditHistory row conventions (action/date, actor, actual changes and reason). Date changes compare formatted Malaysia values so equivalent offset/precision representations do not create false changes; name, programme scope and evaluator-role changes are also represented. The compact WindowDateTime renderer remains exclusive to overview tables. Existing lazy extra-time retrieval and revoke controls remain available.


### Linked calendar schedule warning — 31 October 2026
OperationalPeriodManagement uses the shared warning AlertMessage above schedule inputs for linked events (including a selected event during creation). No focus-triggered popup or schedule mutation behavior was added. Unknown calendar connection states retain a visible caution.


### Compact linked calendar notice - 31 October 2026
Linked schedule impact now uses one sentence with a small Info icon and subtle blue background, without a heading or separate event-name row. The unknown-connection warning remains unchanged.


### Window table status clarity - 31 October 2026
Shared WindowScheduleStatus uses lifecycle for non-published windows and effective schedule status for published windows; ENDED is presented as Closed. Appointment and Marks tables use the same renderer and existing badge tones. Detail-page lifecycle and enforcement controls are unchanged.


### Window status spacing - 31 October 2026
Desktop window tables allocate 15% to Closes and 12% to Status, moving Status left while keeping Action in place. Mobile layout is unchanged.


### Date restriction review layout and discard - 31 October 2026
ProgrammeCoverageReview groups coverage by window ID while preserving programme membership and uncovered programmes. Restriction review opts into the shared DecisionDialog wide size. DecisionDialog uses PortalConfirmModal for unsaved dismissal, preserving dirty guards, owner callbacks and native focus trapping; replacement review remains unchanged.


### Submission access labels - 31 October 2026
WindowSubmissionAccess combines lifecycle, effective schedule and activity enforcement for appointment overview rows. Marks schedule status remains unchanged. Status column widened to 18%, reducing preceding column widths.

### Shared submission availability feedback - 31 October 2026
- OperationalIntakeFeedback composes SubmissionAvailabilityNotice for consistent responsive icon/title/detail/action layout. MarkEntryDetail reuses the notice without conflating Marks task permissions with operational intake enforcement.
- Student workspace entry actions and handlers use useOperationalIntake loading/blocked state; Supervisor and Panel final-submit handlers also wait for reads. Pending enabled reads are reported during the initial effect transition. Existing server-side intake validation remains authoritative.
- MarkEntryDetail guards draft and final writes using canEdit/canSubmit as well as existing UI controls. Only ACTIVE completion-window metadata is presented as available extra time.
- Isolated mounted browser fixtures cover blocked/open transitions, retained Panel input and Marks scheduled/closed/extra-time permissions; responsive fixtures exercise production CSS at 1440, 1280, 390 and 320px.

### Dashboard timeline preview presentation - 1 November 2026
- TimelineCalendar composes TimelineEventDetails and TimelineSubmissionStatus for dashboard-facing presentation; LinkedPeriodStatus remains unchanged for Office management tables.
- Unrestricted operational links render no status container. Shared calendar consumers inherit the same preview layout; role audience filtering and backend period permissions are unchanged.
- Focused static rendering tests cover lifecycle/schedule wording and unrestricted suppression; mounted browser tests cover the actual modal and date/detail structure at desktop and phone widths.

### Office attention empty preview - 1 November 2026
- AdministrationDashboard uses a scoped home-attention-empty state instead of the general full-page EmptyState. Styling is isolated to Office home; shared async states are unchanged.
- The existing Office dashboard browser fixture supports a focused empty-preview run while preserving its full default scenario suite.

### Compact application availability - 1 November 2026
- OperationalIntakeFeedback supports an opt-in compact header presentation. Student Supervisor groups it with New application; form and Marks notices retain their existing layout. Permission checks are unchanged.

### Supervisor application availability modal - 1 November 2026
- StudentSupervisorAppointment guards launch with a synchronous in-flight ref and refreshed operational availability. ApplicationAvailabilityModal uses shared PortalModal, labelled title, standard close control and check/close actions. Closing restores launch focus. This phase changes Supervisor launch only; Panel, Marks and final-submit API permissions remain unchanged. The superseded compact header presentation was removed.

### Supervisor availability presentation refinement - 1 November 2026
- ApplicationAvailabilityModal uses a single padded layout with a contextual icon/title, associated explanation, date/time inset and an unsegmented action row. Removed the Supervisor header status and its obsolete query-param dependency; launch recheck and permissions remain intact.

### Supervisor application progress layout - 1 November 2026
- SupervisorAppointmentApplicationPage suppresses its local OperationalIntakeFeedback notice when canSubmit is true. The shared notice component, intake hook, launch check and submit guards are unchanged.
- Desktop progress uses three flexible intervals followed by a marker-width final column. Intermediate labels center beneath their markers; the final label aligns inward from the card edge. Completed-step navigation and the existing mobile progress strip are retained.
- The step-heading row owns the draft controls; the disclosure popover anchors to the controls container instead of a fixed negative horizontal offset. The phone controls container spans the available width.
- Draft feedback stores text and an optional inDetails presentation flag. Restore/resume context appears in the disclosure and an sr-only live status, while save/discard failures remain inline. Draft persistence and permission checks are unchanged.

### Concise draft details - 1 November 2026
The draft disclosure shows a brief file reminder, an unboxed saved timestamp, existing actions and conditional loading/unsaved/empty feedback. Restore announcements remain accessible outside the disclosure.

Added two short instructional sentences to the existing draft disclosure; draft state and actions are unchanged.

### Single required project course code - 1 November 2026
- Keep the projectCourseCodes text API/model and projectCodeEntries draft array for compatibility. Render one required input, preserving legacy multi-code draft text visibly for correction. Validate one nonblank code on wizard continuation and API creation; reject comma, semicolon or line-separated lists. No historical data migration or draft completeness constraint.


### Document requirement modal — 1 November 2026
- SupervisorDocumentRequirements reuses SegmentedControl (larger tabs variant) and PortalModal rather than mounting a RecordPage editor.
- useDraftDiscard handles local Cancel, X, Escape and backdrop dismissal; DraftNavigationGuard retains route/unload protection. PortalModal provides accessible naming, native focus containment and trigger focus restoration. Create/update service contracts are unchanged.


### Title-origin document decoupling — 1 November 2026
- Removed the conditional Section A proposal validator from the submission API and conditional frontend required-document projection. Title-origin fields and utility validation no longer consume proposal configuration.
- Application prefill retains proposalRequirementCode for response compatibility; it no longer controls upload validation. The general unconfigured-setup 409 and normal configured upload validation remain enforced; explicit no-documents setup is described below.


### Office document setup attention projection — 1 November 2026
- build_office_attention_tasks adds a read-only SUPERVISOR_DOCUMENT_REQUIREMENTS setup item using the shared document setup-status check; the legacy capped dashboard task builder is unchanged.
- A documents category keeps configuration separate from supervision requests, with blocking priority because missing setup prevents application submission. Both summary and record navigation resolve directly to the existing document requirements route. No persisted notification or migration is needed.


### Document setup attention presentation — 1 November 2026
- OfficeAttentionPage gives the documents setup category a concise reason and warning-tone Setup required badge. Backend blocking priority remains unchanged because setup still blocks submissions. Other attention categories keep their existing presentation.


### Explicit Supervisor document setup — 1 November 2026
- Migration appointments.0021 adds the faculty-wide SupervisorDocumentSetup singleton (default false); no row or false with no active items means unconfigured. No policy is automatically enabled by migration.
- Authenticated GET /appointments/supervisor/document-requirements/setup/ returns noDocumentsRequired/configured. Office-only PATCH requires the boolean and a reason. Changes use the existing immutable requirement audit with SETUP action and nullable requirement reference.
- Setup writes and checklist writes share a transaction/row lock, preventing simultaneous no-documents mode and active checklist items. Existing active requirements and legacy active-list API remain compatible. Submission still rejects unknown/inactive uploads and applies normal file security; empty uploads succeed only with active optional-only items or explicit no-documents setup.
- Student guidance/form load the explicit setup alongside checklist data; failed reads remain errors. Office attention uses the same setup-status service without writes. Existing modal/discard/save feedback patterns apply to the Office setting.


### Document requirements workspace presentation — 1 November 2026
- SupervisorDocumentRequirements groups the policy summary and checklist; Add requirement belongs to the checklist header. A shared PortalModal uses draft radio state independent of persisted policy and existing discard protection.
- Configuration history uses native details/summary and shared WorkspacePagination, slicing the existing newest-first audit response into 10-entry pages. Pagination is client-side; the existing Office-only audit endpoint and stored history are unchanged. Refresh resets to page one.


### Document requirements local tab presentation — 1 November 2026
- Replaced the page-local pill switch with counted underline tabs, connected tab/panel IDs, roving tab focus and Arrow/Home/End keyboard navigation. Shared page-level tab styling is unchanged. Policy and checklist share one unbanded header area; existing modal, persistence and history pagination are retained.


### Appointment workload summary presentation — 1 November 2026
- AppointmentSummaryCard accepts optional supportingContent. Shared AppointmentWorkloadDetails renders one short supporting sentence: nonzero held places, otherwise available places; policy restrictions override numerical availability. Supervisor and Panel request landing summaries and My Panel students share this compact presentation. Semester/version metadata stays in capacity management; capacity calculations remain in existing adapters.

- Workload supporting text now explains utilization with active appointments and nonzero awaiting-approval counts in one line across Supervisor requests, Panel requests and My Panel students. Policy restrictions retain priority.

Removed only the introductory paragraphs in OfficeSupervisorAttention and OfficePanelAttention; category selection, counts and filtering are unchanged.

- Supervisor application required labels share ApplicationRequiredMark (visual asterisk with screen-reader text). Research Intent textareas expose native required and aria-required; submission validation remains in existing step validators and API contracts.

- Lecturer dashboard Supervisor and Panel capacity cards also reuse AppointmentWorkloadDetails, mapping authoritative active and reserved fields separately from occupied totals.

- Panel nomination selection hides successful intake feedback locally; OperationalIntakeFeedback remains available for loading, errors and blocked intake. Candidate capacity presentation remains separate from unchanged submission enforcement.

### UAT department fixtures
- `scripts/prepare_five_module_uat.py` assigns explicit fictional AI, Data Science and Cyber Security departments to lecturer/Coordinator account specifications. Department is profile metadata; candidate eligibility and student-programme approval routing are unchanged. Existing UAT profiles were updated by matched staff ID and email without re-running sandbox preparation.

### Co-supervisor nomination modal
- `CoSupervisorNominationForm` owns a labelled `PortalModal` with the shared rectangular close control, compact student context, scrollable form body and fixed footer. Close, Escape and backdrop dismissal use the existing dirty-draft guard. The separate shared confirmation modal handles discards. Removed the obsolete inline-editor scrolling/focus effect; modal focus management is provided by `PortalModal`. API contracts and role/capacity checks are unchanged.

- Co-supervisor modal derives visible candidates by primary-supervisor user ID; selection validation and empty-state checks use that same filtered list. Backend eligibility checks remain authoritative.

- Co-supervisor nomination uses one editable combobox inside `PortalModal`, following the Panel nomination picker: name/staff/department search in the field itself, a directly attached result list, `CandidateCapacity` badges and a selected checkmark. The same field displays the selected name when closed. Keyboard navigation skips disabled options; Escape closes the list before the modal. Co-supervisor candidate responses include staffId/department; frontend capacity metadata uses the shared CapacityState type. Justification uses explicit padding and line height.


### Pending co-supervisor nomination guard — 2026-11-01
Co-supervisor creation checks for any pending nomination under the existing student transaction lock. Team canNominate projections reflect this guard, and the shared detail card also gates stale capability flags. Existing request decisions remain available, including legacy concurrent nominations. Compact pending summaries use the existing supporting-request route.

Pending co-supervisor summary action: align View nomination request to the right using a wrapping flex row; workflow rules remain unchanged (2026-11-01).


### Integrated pending team members — 2026-11-01
Pending co-supervisor requests appear directly under Supporting supervisors, without a separate Pending nominations heading or a contradictory unassigned message. Panel summaries similarly show the proposed member and review-stage badge while pending, and avoid duplicate empty-state sentences. Pending Panel names are projected only when the actor may view that recommendation. Existing active members remain visible during replacement.


### Unified request tables — 2026-11-02
WorkspaceRecordTable accepts an explicit history mode with matching responsive columns/cells and column widths. Lecturer appointment and research-change lists render a single combined table. Student and Coordinator request histories use the shared history mode; CoordinatorRequestTable and PanelBrowse match final-history semantics. Request grouping remains in workflow utilities for partitioning and counts, while visual group sections have been removed. Server-paged research ordering and pagination remain server-owned.

### Supporting supervision detail presentation — 2026-11-02
- The shared non-collapsible SupervisoryStudentDetailCard applies a section divider and action footer across role-specific detail routes, retaining capability checks.
- Completed nominations render as linked summaries in Supporting appointment history rather than embedding CoSupervisorNominationCard approval/audit dossiers. Primary lifecycle changes retain their separate Appointment changes surface.
- Active supporting members omit ACTIVATED events from their local changes disclosure; raw history and standalone request views are preserved.

- 2026-11-02: The shared supervision detail sidebar stacks appointment management and supporting history; it stacks below the main content on smaller screens. History links use the primary navy/white action styling.

- 2026-11-02: The shared non-collapsible supervision details no longer render completed supporting nomination or former appointment history cards. Current team management, pending request links and primary appointment changes remain unchanged.

- 2026-11-02: Removed PanelCapacityNotice from shared PanelRecommendationDetail. Acceptance capacity guards remain in the review controller, with a conditional blocked-action explanation; confirmation reservation messages remain unchanged.

- 2026-11-02: Removed sentence-case and normal tracking overrides from shared request action containers and Panel/supervision action buttons so PortalButton typography applies consistently. Navigation-link actions in pending supporting summaries also use uppercase styling.

- 2026-11-02: RequestDetailActions now owns layout only (width, stacking, spacing) and delegates typography and shape to PortalButton. Removed local button text-size/height overrides from supervision actions and Panel nomination controls. The supporting request navigation link matches standard secondary button tokens.

- 2026-11-02: CoSupervisorNominationForm filters candidate.selectable before search and selection, retaining server validation. Panel replacement keeps its specific accessible name while using Replace as the visible label.

- 2026-11-02: Aligned Supporting supervisors section borders and spacing in shared PanelAssignmentDetails and StudentSupervisorsOverview with SupervisoryStudentDetailCard. Panel assignment routes inherit this presentation without adding management controls.

- 2026-11-02: Removed the completed nomination history surface and its local pagination state from PanelSuperviseeDetails; retained the recommendations prop contract for callers and the separate nomination records route.


### 2026-11-02 — Rubric family creation modal

RubricsManagementView shares its metadata editor between inline version editing and a PortalModal creation flow. Modal cancellation restores the previous selection after explicit discard where needed. Mutation conflict recovery is rendered inside the creation modal so it remains actionable.


### 2026-11-02 — Rubric input contrast

Rubric inputs explicitly set dark value text and muted placeholders to avoid inheriting muted label colour. The rubric creation portal carries the marks-workspace class to retain module typography outside its original DOM ancestor.


### 2026-11-02 — Assessment component workspace

RubricsManagementView now tracks separate metadata and component modal visibility while retaining existing API mutations, baselines, conflict recovery and navigation guards. PortalSelect replaces the family sidebar. Component forms use two columns on larger screens and one on phones; the component table scrolls within its card. Committed component mutations close the editor before refreshing so a failed read cannot expose a repeat submission.


### 2026-11-02 — Rubric hierarchy and row actions
RubricsManagementView groups version selection with the read-only rubric summary; readiness is grouped with the marks total rather than creation actions. Scoped marksWorkspace styles provide 12px table headers, 14px row values and middle alignment. Shared PortalButtons retain component deactivation semantics and confirmation.


### 2026-11-02 — Rubric placement and column widths
Rubric summary uses a title/action row followed by a left-aligned selector. Assessment table uses an explicit colgroup (8/30/13/12/13/24 percent) and contained horizontal scrolling below 960px.

### Rubric family workspace — 2026-11-02
- `RubricFamilyList.tsx` groups versions into one family row, handles local search/status filtering and pagination, and renders bounded version history. `RubricsManagementView` owns selection, detail reads, modal edits, mutation recovery and archive confirmation.
- `Rubric.is_archived` (marks migration 0012) is independent of `is_active`, which continues to identify the current version. Office-only POST `/api/marks/rubrics/<id>/archive/` accepts a boolean `archived` and updates/audits every family version transactionally. It never deletes marks or changes period rubric references.
- Archive and clone lock family versions in stable primary-key order. Criteria changes reject archived versions. New period creation and rubric reassignment validate current, unarchived versions on the server; new-period choices exclude archives while existing assignments remain visible.
- Rubric payloads include version-specific evaluation-period usage (name, semester, lifecycle). Marks overview shows its actual period rubric, without falling back to an arbitrary active family.

### Rubric version clarity — 2026-11-02
The rubric workspace reuses the existing clone service for NEW VERSION on locked and unlocked versions, with shared confirmation and existing write/conflict guards. Version identity appears once beside its Current/Previous badge; target totals remain in Assessment components.

### Rubric action spacing — 2026-11-02
Moved version creation to PageHeader actions with the same busy, refresh and conflict guards. Summary footer separates family lifecycle controls from metadata editing; existing confirmation flows are unchanged.

Summary actions contain metadata and family lifecycle buttons; version creation stays in PageHeader. Removed the lifecycle footer introduced in this round.


### Mark Entry Periods entrance — 2026-11-02
MarkEntryPeriodList presents the entrance table using shared PortalCard, PortalSelect, PortalButton and StatusBadge. Parent-owned filters/page survive detail navigation; existing period selection, draft guards, context scoping and lifecycle APIs are retained. Pagination is ten rows with horizontal scrolling on narrow screens.


### Period editor spacing and navigation — 2026-11-02
Period-editor styling is scoped in marksWorkspace.css. Shared PortalSelect controls use standard form-control classes, with disabled placeholder options hidden after selection. Existing returnToList draft protection now serves the PageHeader back link; lifecycle APIs and archival eligibility remain unchanged.


### Period preview and history — 2026-11-02
MarkEntryPeriodConfig uses the shared PortalModal for its read-only recipient estimate, gated by current preview eligibility. Audit events render in a separate native details card with bounded scrolling; publication validation is unchanged.


### Rubric reactivation and code case — 2026-11-02
Component activation/deactivation share the guarded update and confirmation flow. Rubric family creation validates slug characters without lowercasing and checks existing family codes case-insensitively. Existing stored codes remain unchanged.

### Period configuration layout refinement — 2026-11-02
Period configuration uses a scoped flex workspace with a 1.75rem card gap, a responsive preview/write footer and newest-first activity rows with human-readable actions, author, timestamp and optional reason. History remains bounded and scrollable.

Draft evaluation periods expose the shared danger action in the MarkEntryPeriodList Action column below the single-line Manage period button. The shared confirmation dialog is owned by MarkEntryPeriodConfig and handles deletion from the selected list row.

### Scalable recipient preview — 2026-11-02
Extracted MarkEntryRecipientPreview into a stateful component; filtering and pagination are local and read-only. The dialog uses max-w-6xl. Programme appears only for multiple programmes. Exclusion counts remain role-based because the API does not supply excluded identities or exact reasons.

### Recipient preview pagination visibility — 2026-11-02
Recipient preview renders page navigation only when the filtered page count exceeds one. Search and role filtering continue to reset the current page.

### Period publication confirmation clarity — 2026-11-02
Period publication uses the shared PortalConfirmModal with info tone and CheckCircle2 icon. A structured summary replaces joined paragraphs; archive retains danger styling and existing final-review guards remain unchanged.

### Period closure workflow and reuse review — 2026-11-02
Period configuration scopes the closure modal to period ID and route context. ClosureReview accepts optional children to place the reason after the signed unfinished-task preview and before confirmation. Existing closure tokens, conflict handling and draft guards are preserved. Publication currently rejects duplicate name/semester only; reuse of rubric and evaluator role remains allowed across periods, with tasks unique per period. No new cross-period business rule introduced.

### Published period footer navigation — 2026-11-02
The published-period footer reuses onManageTimeline with selected period context through the existing guarded leaveTo navigation.


### Marks overview and period monitoring — 2026-11-02
MarksOverview shares loaded evaluation periods with MarkSubmissionMonitoring; semester totals exclude draft/archived periods. Monitoring defaults to open/scheduled, supports closed periods and ten-row pagination. Record responses expose periodId, periodName and periodLifecycleStatus; URL scope filters active records and survives detail navigation. Existing authenticated-shell list state retains refinements. No eligibility or publication rules change.

Marks overview semester context (2026-11-02): Show the selected academic semester's start/end dates beneath its selector, with 24px separation before summary cards. Dates use the existing academic semester API and Malaysia date formatter; unavailable date metadata does not block marks content.



### Evaluation task workspace — 2026-11-02
EvaluationTaskAssignment filters generation-period choices independently of loaded task/backup data. Empty scopes suppress filters and count summaries; temporary assignment activity renders in a separate conditional collapsible card.

### Atomic retirement on explicit period closure — 2026-11-03
close_evaluation_period invokes the existing retire_participant_evaluation_tasks service within its closure transaction after signed-preview validation. Retirement skips submitted entries, invalidates live task completion windows, and records actor/reason with entry snapshots. ClosureSummary receives a period-only retirement presentation flag; semester/handover messaging remains unchanged. No schema or endpoint changes.

### Shared marking editor presentation — 2026-11-03
- MarkEntryDetail contains student context, component scoring, comments and the total/action footer within one PortalCard. Component headings and score fields share a responsive row; feedback spans its width. Existing permissions, draft recovery, validation and submission confirmation are preserved.

- MarkEntryDetail draft failures render through PortalToast; submission errors remain in DecisionDialog and conflict recovery remains in the editor.


Office MarkEntryRecordDetail presents component results as reading sections. SubmittedMarksActions launches its existing guarded correction/reopening workflow in PortalModal, retaining confirmation and discard checks.

Office mark details refinement: removed the repeated four-column summary and sidebar cards. One full-width overview contains period metadata and a right-aligned action footer; results use the available width and correction history collapses below. Labels are 14px semibold and answers 13px regular.

Office mark record layout now uses a top student overview and responsive results/evaluation-detail columns. Component feedback uses a separate spanning table row. Existing Office action modals sit in the evaluation-detail footer; nonempty correction history stays beneath results.

Office evaluation sidebar simplified: role sits under evaluator; dates and assignment metadata share one collapsed Dates and activity section. Correction and reopening buttons use pencil and reopen icons.

Office dates disclosure now separates the entry schedule from a chronological activity timeline. Missing activity timestamps are omitted, and last-update duplicates of assignment/submission are suppressed.

- `SubmittedMarkDetail` aligns with the Office record layout: full-width student overview, three-column score table with full-width feedback rows, and compact evaluation sidebar. Submission activity displays only the submission timestamp supplied by the lecturer task API; assignment/opening dates are not invented. Long feedback uses native keyboard-accessible disclosure.

- EvaluationTaskSerializer now supplies periodName, rubricName, rubricVersion, opensAt, closesAt and assignedAt as read-only metadata on task list and history responses. SubmittedEvaluationSerializer inherits these fields. Lecturer evaluation details mirror Office schedule and activity layout without Office controls.

- Both mark record detail views use formatMalaysiaDateTimeCompact, which explicitly formats Asia/Kuala_Lumpur timestamps. The existing full formatter retains its timezone suffix for other callers. This removes the Office device-time dependency and repeated Lecturer timezone suffixes.

- Office marks correction/reopening dialogs: added matching rounded-square close controls with unsaved-change protection; score and comment fields use explicit padding and heights because portalled dialogs do not inherit workspace styles. Component feedback remains preserved and read-only in the correction workflow.

- MarkEntryPeriodConfig keeps saving/pendingWrite active through the post-write read; savedReadBlocked is set only after a committed write fails to refresh, preserving recovery controls without flashing a false warning.

- Monitoring checks existing recipient-preview eligibility for up to ten visible open/scheduled periods, handles per-period errors/retry and ignores stale responses on filter changes/unmount. A pure status resolver separates readiness from dates. Assignment navigation accepts a period query parameter; generation retains existing confirmation/authorization. Overdue totals respect personal completion deadlines.

- Monitoring uses a nonwrapping flex row with a 12px gap for status/actions inside the horizontally scrollable table.

- EvaluationTaskAssignment uses shared PortalButton for row viewing, retaining the task-specific accessible label and detail handler.

- Session activity labels successful generation as Generated evaluation tasks; generation behavior and counts are unchanged.

### Coordinator Marks Entry access - 3 November 2026
The shared ROLE_ALLOWED_MODULES list excludes Marks Entry for Programme Coordinators. Sidebar filtering and the existing App module guard use this same rule, including direct Marks URLs; backend permissions are unchanged.

- LecturerMarksEntry derives view/task identity from React Router instead of local view selection. App keys it by pathname and search. Exact tasks are resolved only from authenticated Lecturer assignment/submission collections; missing/malformed URLs never fall back to another task. Legacy task query links replace into canonical task routes. Routed detail pages retain RecordPage dirty/busy guards without synthetic local history entries; local consumers retain their existing pageKey behavior. Lecturer-specific routes are blocked for other roles; Office /marks/tasks and /marks/records remain unchanged.

- Lecturer marking task fallback UI: standard detail heading and back navigation above a compact state card; loading, unavailable and error states share the layout. Task access and routing rules are unchanged.

### Correction history text overflow — 2026-11-04
`MarkCorrectionHistoryView` keeps status, total and component values in a fixed-layout comparison table. Overall comments render in separate before/after panels with arbitrary text wrapping, while each audit event groups actor, role and timestamp in its header and presents its reason in a labeled block. The layout uses the existing card typography and does not require a horizontal scroller.

Correction history timestamps use the compact Malaysia formatter without repeating its timezone suffix. Events retain the subtle left accent and use larger vertical spacing instead of nested cards.

Correction and reopening event titles use compact semibold navy emphasis over the accompanying actor, timestamp and reason metadata.

Marks deadline shortcuts with a known semester and period use the period anchor plus `manage=window`, allowing the shared Periods & deadlines route to open the selected window editor directly. General shortcuts without a selected period continue to open the Marks activity list.

The Marks deadline-extension flow reuses `DecisionDialog` in extra-wide mode (`max-w-4xl`) with larger form spacing. Its eligible-task picker uses a fixed-layout table with spacious rows, filters in memory, paginates 10 tasks per page using the established recipient-preview controls, and retains selected task IDs across search and page changes. A concise informational impact note sits directly below the scope selector. Empty DecisionDialog messages are omitted from both rendering and the accessible description relationship.
Supporting-supervisor request detail pages reuse `CoSupervisorNominationCard`, `SupervisionDetailSection`, `ApprovalProcess`, `PrimaryRequestDecisionButtons` and `DecisionDialog`. The detail-page variant uses vertically stacked Request summary and Review and outcome cards with icons, shared section typography and a right-aligned action footer. It omits the separate audit disclosure while retaining history events as inputs to the workflow timeline. List and team contexts keep their existing audit and compact-action presentation.
Request summary labels and values use `supervisionDetailLabel` and `supervisionDetailBody`; student identifiers use the compact secondary text scale. This keeps record content readable and visually distinct from section headings without changing shared global card typography.
# Draft evaluation period deletion (7 November 2026)

The existing evaluation-period detail endpoint accepts `DELETE` for authorized Office Staff/Admin. A transactional service locks the semester and draft period, enforces draft-only deletion, rejects periods with evaluation tasks or linked timeline entries, and records a configuration audit snapshot before deletion. The frontend Mark Entry period editor uses the shared `PortalButton` and `PortalConfirmModal`; a successful deletion returns to the filtered period list and removes the deleted period anchor from the URL while retaining semester scope. Protected foreign-key references are translated into a conflict response rather than an unhandled server error.
