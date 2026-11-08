## Assessment display names (8 November 2026)

Assessment options, period lists/search and publication review display Research Project 1 and Research Project 2. Shared assessmentLabel maps existing P1/P2 identifiers without rewriting data or resetting test records; no reseed or migration is needed.

## Historical assessment classification removed (8 November 2026)

Classification UI and non-draft assessment update exception removed at user request, superseding previous classification documentation. Four unclassified UAT test periods were backed up privately and backfilled as P1 with audit reasons. Existing marks remain unchanged. New periods still require assessment; duplicate publication guards remain enforced.

## Compact calendar publication control (8 November 2026)

Calendar publishing sits in the page title's action area, wrapping below the title on narrow screens, consistently across Calendar, Entries and History. Place a small rectangular Unpublished status tag beside the Calendar title, with a soft lavender background, dark indigo 11px text, a small matching status dot, semibold weight, 6px corners and vertical centre alignment with the title. Use the standard primary PortalButton styling, matching Add events, with medium sizing, uppercase PUBLISH CALENDAR, a paper-plane icon and a 40px minimum height. Hide it once published and show a subtly green Published tag beside the title; restore it after another saved change. Publishing shows a spinner and prevents repeat clicks. Keep the semester Active badge beside its selector and publication counts in the review dialog.

## Marks publication safeguards (8 November 2026)

Each rubric version explicitly permits Supervisor, Panel or Both; components inherit this setting. Used versions remain immutable and must be cloned for changes. Evaluation periods identify Project I (P1) or Project II (P2). Publication rejects incompatible roles and duplicate coverage for the same academic semester, assessment, overlapping programme scope and evaluator role, regardless of period names, dates or rubric versions. Distinct P1/P2 assessments and disjoint programmes/roles remain valid. Legacy assessments and rubric compatibility are not guessed from names. Office may classify an unclassified historical period once with an audit reason; existing marks and assignment settings remain unchanged. Ambiguous legacy coverage blocks new overlapping publication until classified. Existing published periods continue operating; general editing or automated replacement of submitted work is outside this change.

Historical classification records identity without creating work, including genuine legacy duplicates. Publication remains blocked by that coverage. Closed periods and archived periods containing tasks reserve coverage; unused archived periods can be replaced. Excel results explicitly identify P1/P2 or unclassified legacy records.

## Office marks Excel export (8 November 2026)

The export control matches Supervisor requests: compact navy Export Excel button with an inline download icon.

Office downloads all marks records matching current search, programme, semester, evaluator, status, period and monitoring filters across every page. Tabs: Summary, Data Science, Cyber Security, Artificial Intelligence and Outstanding. Programme tabs contain submitted evaluator results only, with student/record IDs, research title, semester, period, evaluator role, assignment/period lifecycle, rubric/version, numeric component marks, total/maximum and submission/update timestamps. No combined grade or draft scores/feedback. Summary checks all active assignments for each matching student and period independently of filters; students without matching assignments are not listed. Outstanding respects filters and labels historical assignments. Unknown legacy programmes retain submitted results in an additional Other programmes tab. Exports identify filters, matching count and Malaysia export time, with frozen headings and filters. Google Form-only history and importing it are outside scope.

## Downloadable calendar template guidance (8 November 2026)

The Excel Instructions sheet explains Add events as the default (no duplicate merging), Replace calendar as replacement of the entire draft, existing/incoming/resulting count review and replacement acknowledgement. It explicitly distinguishes saving a draft from Publish calendar, preserves audience and semester visibility rules, and keeps submission-window controls separate. Linked-event preservation guidance applies specifically to replacement and includes the event's position within its P1/P2 group.

## Calendar draft publication and explicit imports (8 November 2026)

Office edits, creates, deletes and imports semester calendar events into an editable draft. Import offers Add events (default) and Replace calendar. Preview shows existing, incoming and resulting counts; replacement requires fresh acknowledgement for that workbook. Signed confirmation binds the mode, actor, file, semester and reviewed calendar/period state.

Publish calendar reviews the whole selected semester draft and replaces its published calendar atomically. Later calendar edits remain private until another publication. Selected audiences see only their published events on reload/focus refresh; dashboard tasks, reminders, student tracking, dossiers and calendar reports use published calendars. Draft-semester publication does not make that semester the current dashboard. Publishing never opens, publishes or closes an operational/marks submission window. Linked events continue projecting their owning period's authoritative dates/status; window changes remain controlled by Periods & deadlines.

Existing visible and historical calendars are preserved during migration; existing Draft semesters remain unpublished. Empty drafts can be published to remove all public events. No approval workflow, automatic duplicate merging or real-time push is added.

## Phase six feedback scope (1 November 2026)

Requirement saves publish one shared outcome and distinguish a committed write from a failed refresh. Participant and coordinator-delegation drafts require discard consent before replacement or exit; conflict/permission failures retain input and block stale resubmission until successful latest-record review. Seeded delegation dates are clean. Report, appointment-letter and announcement-attachment exports describe a prepared browser handoff; explicit notification read updates are quiet on success and expose failures. Existing permissions, academic transitions, reasons and Malaysia date rules remain authoritative.

## Phase five Marks interaction scope (implemented, 1 November 2026)

Rubric metadata and component drafts are independent and protected by affected scope. Evaluation-period editing protects initialized baselines, lifecycle reasons and conditional closure acknowledgment; publish/archive use one final shared review and close keeps the signed closure review. Generation reviews current saved scope/readiness and reports authoritative response counts. Lecturer submission reviews the exact score/feedback/comment snapshot. Office correction reviews its audited delta and protects Cancel/latest-read replacement. Completion-window grant/revoke drafts retain exact task identity and independent scope through failures and filtering. Confirmed writes clear only committed input before secondary reads; read recovery never repeats the write. Permissions, reasons, version checks, idempotency, Malaysia dates and the central deadline route remain authoritative. Final verification is recorded in PROJECT_STATUS.md; phase six still contains remaining development and phase seven contains full-shell/native acceptance.
## Phase five Marks interaction requirements (31 October–1 November 2026)

Approved implementation scope is package five of the five-module notification/confirmation audit. Rubric metadata and component drafts must be independent, period drafts/reasons must survive cancelled navigation or final review, and consequential period/component actions require one existing-policy final review. Missing-task generation must review the current selected period/scope/readiness; only its response supplies authoritative created counts. Completed writes clear only committed draft input before read recovery, with one truthful shared outcome. Existing permissions, reasons, recipient/closure review, role identities and Marks concurrency/idempotency remain authoritative. Full-shell native acceptance remains phase seven.

The existing Marks action register also requires exact final review of Lecturer submission scores, component feedback, overall comments and total; Office correction review must show every changed score and overall comment even when the total is unchanged. Meaningful local correction/reopening and personal completion-window grant/revoke drafts require Keep or explicit discard before replacement. A conflict requires successful latest-record review and consent before replacing affected work. Completion-window review identifies the selected task, student, evaluator, role, academic scope and deadline. These are interaction requirements within the approved Marks package; server authorization, eligibility, reasons, version checks and submission receipts remain authoritative. Broader workflow/export migration belongs to phase six.
## Calendar and setup consistency — phase four (30 October 2026)

Approved package four protects calendar, semester, lecturer availability, capacity and operational-period drafts across applicable local dismissal, router navigation, refresh and voluntary logout. Nested editors report to one owner. Untouched or reverted defaults leave quietly; pending writes cannot be discarded. Saving one calendar method must preserve unsaved work in the other. Private transition and cancellation reasons require consent before disposal. Confirmed saves clear their own baseline before refresh and distinguish failed reads from failed writes. Existing signed handover, closure acknowledgment, version/fingerprint, role and audit requirements stay authoritative. Implementation and evidence are tracked in `docs/PHASE_FOUR_SETUP_FEEDBACK_PLAN_2026-10-30.md`.

Template preparation must show current, honest feedback inside an open import modal without clearing unrelated preview errors or cancelling when the selected workbook changes. Failed-refresh recovery must block further setup writes until the latest record loads successfully. Successful capacity preparation must resolve the user's pending destination, including supported standalone/non-data-router hosts; an explicit completed-owner allowance retains its existing scoped behavior. No extra academic approval stage or persisted-file success claim is introduced.

## Appointment feedback and retained drafts (30 October 2026)

Supervisor application submission must publish one outcome that survives closing the application editor, including the standalone Student workspace. Contact and supporting nomination/replacement cancellation must protect changed values, allow Keep editing, and discard only the intended child editor after consent. Untouched/reverted editors stay quiet; saving remains protected and unrelated application work remains dirty.

Research creation, audited correction and programme-transfer drafts must remain visible after forbidden/conflicting writes. Stale submission stays blocked until successful latest-record review with explicit consent before replacing local values. Failed recovery keeps input and the recovery action. Confirmed commits and subsequent failed reads must be reported separately without inviting duplicate creation. Existing authorization, revision, capacity and approval rules remain authoritative.

Appointment record filters remain quiet. Appointment and Supervisor/Panel workload exports use honest prepared/no-results notices; empty results do not generate a file, and generation failure remains a persistent contextual error with safe retry. Browser file persistence is separate acceptance evidence. Scope: delivery package three in the five-module feedback audit; broader setup, Marks and workflow migration remain pending.

## FYP testing report preparation (29 October 2026)

Provide an editable academic testing chapter and a results register that map the 162 owned-module manual scenario groups to report sections without inventing outcomes. Preserve case IDs, preconditions, expected/actual distinction, actor/date/build/evidence and defect/retest history. Separate historical technical observations, new manual runs, automated unit/integration evidence and actual stakeholder UAT; no participant scores or performance thresholds are assumed. The supplied senior report guides structure only. Product workflow requirements are unchanged. See `docs/FYP_TESTING_REPORT_PREPARATION_2026-10-29.md`.

## Shared feedback and session-exit foundation (29 October 2026)

Migrated shared outcomes must queue without overlap, deliver new operations even when their text is identical, and deduplicate only a repeated explicit operation identity. Routine info/success notices receive four visible seconds with hover/focus pauses; warning/error outcomes remain dismissible. Native-modal or document inertness must defer body-level delivery, while unrelated inert retained workspaces must not suppress usable feedback. Outcomes survive descendant navigation but never an authenticated account/session boundary. Existing standalone/teammate toast calls retain their current behaviour until their separately scoped migration.

Completed save navigation must resolve pending exit protection, while failures and fresh edits retain it. Late save/reload callbacks must not close or change a newer decision session. Completion, dismissal and confirmed discard have distinct owner callbacks; replacing private decision input during latest-record review requires consent. Voluntary logout must resolve registered page drafts before invoking authentication logout; in-flight writes cannot be discarded. Forced expiry remains immediate. Missing standalone editor registrations are covered by later audit packages, not implicitly certified by this foundation.

## Phase-one completion and discarded drafts (29 October 2026)

Successful backup-evaluator creation must retire its completed draft before refresh/navigation, acknowledge the committed result once and close through the existing shared decision outcome; a failed refresh must not require another creation. Failed saves and cancelling the final review retain the visible editor. Closing/discarding or completing a Panel nomination must dispose its candidate/notes/replacement reason; reopening is clean and drafts cannot carry across students or replacement appointments. Reconciliation acceptance protects private reason/acknowledgment and clears them on confirmed abandonment, while cancelling repair review retains its visible underlying draft. Deadline extensions compare edits with their initialized scope/date/selection baseline, so untouched selected-only recovery and reverted inputs do not cause discard warnings. Existing academic rules and role permissions remain authoritative. This implements the first four-defect phase; broader toast/guard migrations remain pending.

## Report summary readability (29 October 2026)

Participant lifecycle summary cards must fit their available report container, including when the desktop sidebar reduces content width. All seven labels must remain readable with normal word spacing and wrapping; counts retain their existing values and scope. This is presentation cleanup of the existing report, with no new workflow or access rule.

## First calendar event and A07 acceptance (29 October 2026)

Office may create the first manual event for a Draft or Active semester without first uploading a workbook. A valid event initializes that semester's current calendar; later events reuse it. Invalid data, unauthorized requests, locked/missing semesters and failed audit writes must leave no partial calendar or event. Semester locking must recheck lifecycle before creating anything. Existing import replacement, linked-period, role and audit rules remain. A07 uses actual portal sign-in/navigation and files saved by the browser; component/API evidence alone does not certify full-shell, native warning or date-entry behavior.

The empty calendar must describe both supported creation options. The named core A07 observations are recorded in `docs/FULL_PORTAL_NATIVE_ACCEPTANCE_2026-10-29.md`; unrun manual combinations, shared ownership and deployment acceptance retain their separate scope.

## Compound lifecycle privacy acceptance (28 October 2026)

Private Office participant lifecycle explanations must remain internal when copied into appointment closure or automatic primary-request cancellation. Student Supervisor application list/detail and academic dossiers retain public status/outcome/dates but omit private closure actors/audits/reasons and the specific Office lifecycle-cancellation reason/event. Ordinary application decision and cancellation reasons retain their existing visibility. Authorized staff retain complete recorded history. Dossier UI must independently suppress supplied staff closure/audit fields in public view. Context-free application serialization defaults to public lifecycle data. No workflow, stored audit or academic record is removed. See `docs/COMPOUND_LIFECYCLE_MARKS_ACCEPTANCE_2026-10-28.md` for scoped lifecycle/Marks/assignment/concurrency evidence and remaining manual/native boundaries.

## Five-module sequential manual testing (28 October 2026)

Provide simple, chronological guidance for Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks and Workflow/Approval Tracking. Start with Office semester/capacity/calendar/intake/document setup, follow Student/Lecturer/Coordinator decisions through evaluation/reporting, then use distinct participants for alternative and terminal cases. Each case states prerequisites, actions and expected outcome; unrun/fixture-blocked cases are not accepted evidence. Prepare fictional accounts in a separate local test database, with credentials only in ignored local files. This is testing preparation, not a change to product workflow rules. See `docs/FIVE_MODULE_TESTING_START_HERE.md` and the full sequential guide.

## Reporting and dossier acceptance corrections (28 October 2026)

Student Progress Dossier must display the currently selected student. A late response, error or completion from an earlier selection must not replace that record, hide it with an obsolete error, or dismiss a newer loading state. Hide previous-student data while resolving the new identity; retain existing role/record authorization and privacy rules. A05 acceptance compares persisted reports and XLSX content, public/private dossiers, transfer/delegation/handover projections, audited repairs and read-error recovery using disposable data. See `docs/REPORTING_RECONCILIATION_ACCEPTANCE_2026-10-28.md` for the precise coverage and A06/A07 boundaries; no new reporting workflow or academic policy is introduced.

## Office access rollout acceptance (28 October 2026)

The authorized local Office flag conversion and scoped access acceptance are complete; the existing business authorization and technical-only admin requirements are unchanged. Office portal authority remains independent of staff flags, and submitted-Marks mutation still requires an explicit permission. Local operational evidence and its limits are recorded in `docs/OFFICE_ACCESS_ROLLOUT_2026-10-28.md`; production rollout and remaining compound acceptance remain separate.

## Branch integration and release (28 October 2026)

Commit all pending session changes in reviewable groups, merge the latest origin/main into codex/portal-consistency-and-toast, preserve both branches' features and permission boundaries, verify the integrated result and push without rewriting remote history. No production deployment or account conversion is included.

## Office approved request supervisor change (28 October 2026)

- Eligible active primary supervisor appointments expose **Request supervisor change** under **Appointment record → Manage appointment** on the Office approved request page, as well as supervision details.
- Eligibility comes from the existing Office replacement endpoint. Pending replacements and ended appointments must not allow another request; failed eligibility reads must offer retry.
- Reuse the existing replacement form and approval workflow, returning to the source request after cancellation or successful submission. Coordinator permissions remain unchanged.

## Panel nomination history action placement (28 October 2026)

Student Panel details in the Lecturer supervisee workspace keep current nomination/replacement controls in the sidebar. Completed nomination history appears in a separate full-width, initially collapsed section below the content when records exist. Each request has its Panel member, outcome, submitted date and its own View request action aligned to the row end on desktop and below its information on phones. Exact student scoping, terminal-request filtering, newest-first order, five-record pagination and existing return navigation are preserved.

## Labelled appointment management controls (28 October 2026)

Compact Supervisor and Panel appointment cards put occasional management controls in a clearly labelled Manage appointment disclosure, collapsed initially. Source application and Lecturer marking navigation remain directly visible. No management disclosure appears when the host supplies no management controls. Supervisor-change initiation is labelled Request supervisor change; compact end controls explicitly name the Supervisor or Panel appointment. Existing confirmation, required reasons, busy state and role permissions are preserved.

## Staff appointment details and contextual marking (28 October 2026)

- Supervision and Panel assignment detail pages have one concise Appointment record sidebar. Student-record navigation remains in the overview, source-application navigation in the record, and permitted management actions in a separated footer. Team-specific nominations/replacement controls stay with the affected member; pending supporting nominations are compact and expandable.
- Approval timelines/audits are reached through the existing source request, not repeated in appointment sidebars. Shared semester/calendar dates and summary application-status activity are omitted from these detail pages. Real post-creation lifecycle changes and previous supporting appointments remain available in a full-width, initially collapsed section below the main content.
- Lecturer details provide equivalent contextual marking for Supervisor and Panel responsibilities. A matching editable task offers Enter marks or Continue marking; submitted work offers View submitted marks; a noneditable task offers View marking task. Multiple matching tasks offer a filtered list; no matching task produces no marking button. Office/Coordinator detail hosts do not fetch personal Lecturer tasks.
- Marking navigation preserves exact student/evaluator-role/task identity. Existing period, rubric, edit/submit and write-conflict permissions remain authoritative. Unavailable targets cannot open unrelated tasks, and the Marks page offers Show all tasks to leave the contextual scope. Student appointment overview privacy/tabs remain unchanged.

## Request history simplification (28 October 2026)

Supervisor and Panel request pages show the approval timeline once, with recorded decision reasons. They do not repeat it in a separate Audit history disclosure. Appointment record history excludes the initial ACTIVATED event, which duplicates approval; subsequent changes remain available as Appointment changes. Persisted workflow/audit data, role permissions and required-reason controls are unchanged.

## Appointment sidebar consistency phase (28 October 2026)

- Supervisor and Panel requests retain a visible Review and outcome card with approval progress, permitted decisions and audit. Opening an approved nomination from the Office request list must retain the request view, rather than silently open the resulting appointment.
- Staff appointment details use consistent Appointment record and History cards. Appointment status, recorded dates and permitted management/source-request actions belong in the first card; approval evidence and appointment changes belong in History. Supporting-supervisor history remains available where relevant.
- Supervisor semester dates are shared academic schedule information and appear separately below the appointment workspace. Student appointment tabs, privacy and the explicitly removed Student Panel source button remain unchanged.
- Approval evidence must match the source application, student and appointment. Missing or inaccessible historical evidence must not be reconstructed from summary activity. End/replacement permissions and reason validation remain unchanged.

## Request appointment record placement (27 October 2026)

Supervisor and Panel appointment request pages keep any existing appointment lifecycle record directly beneath Review and outcome within the shared desktop sidebar. Use compact single-column facts, equal sidebar widths and consistent spacing; stack the sidebar after request content on smaller screens. Preserve role-specific lifecycle controls, dates, history and request content. Routed Coordinator pages must pass their lifecycle record through the shared sidebar slot exactly once, without a second page-level render.

## Supervisor accepted-request reservations (27 October 2026)

28 October review corrections: capacity-closed Office replacements direct Students to the Postgraduate Office and never invite a Student-initiated replacement. Ordinary new-application recovery remains subject to lifecycle eligibility, active appointment and pending-request checks. Request detail must retain factual active/reserved counts without presenting a missing or restricted policy as numerical availability.

28 October warning refinement: the last-place acceptance confirmation uses a prominent amber warning with an icon and concise copy. State that acceptance reserves the place until Coordinator approval and that other pending requests may close after final approval. Already-full candidates remain blocked at submission; automatic capacity closure concerns earlier unaccepted requests when confirmed workload later fills their applicable limit.

Implemented and verified on 28 October; evidence and integration limits are recorded in `docs/SUPERVISOR_CAPACITY_RESERVATIONS_2026-10-28.md`. This reservation promise applies to primary requests. Supporting nomination acceptance continues to forward the nomination without reserving a place; its final approval respects existing primary reservations.

Primary Supervisor requests reserve one place when accepted and awaiting Coordinator approval. Submitted requests do not reserve places. Active primary/supporting appointments and accepted primary reservations share the Lecturer's capacity; final approval converts its own reservation without double counting, while rejection/cancellation releases it. Capacity policy publication and all assignment paths must honor these commitments. Show active, reserved and available places distinctly, and explain the final-place consequence before acceptance. A full-capacity block must preserve rejection and eligible Student cancellation.

After final primary/supporting approval fills a request's effective published limit, automatically close other unaccepted primary requests with the neutral system outcome Capacity full, reason, timestamp, immutable audit and notification. Keep accepted requests, higher-limit policies, archived records and unconfigured policies untouched; preserve existing replacement incumbents. A Student must be able to understand the capacity outcome and apply elsewhere when eligible. This supersedes earlier descriptions that accepted primary requests never reserve capacity and that final approval always leaves competing unaccepted requests pending. Detailed agreed scope: `docs/superpowers/specs/2026-10-27-supervisor-capacity-reservations.md`.

## Coordinator dashboard programme context (27 October 2026)

Replace the technical coordinator scope panel with a compact regular-programme summary. Show assigned active/scheduled temporary programme cover with dates and keep past access in a collapsed Access history disclosure. Avoid duplicate programme labels and empty delegation messaging; preserve Office management and authorization.

## Workload detail reading hierarchy (27 October 2026)

Supervisor and Panel workload detail pages use three distinct reading areas: Lecturer overview, Capacity usage and the existing workload records. Use consistent 28px card gaps, readable labels/values and an explicit empty state. Preserve capacity rules, authoritative counts, availability states, source navigation and Manage capacity. No new tabs or summary-card row.

## Final appointment consistency review (27 October 2026)

Student supporting supervisors expose the same public department, email and appointment date as other appointed members. Existing module tabs, request/history partitions, permissions and nomination workflows remain intact. Registry programme-transfer relocation and Marks template work remain deferred.

## Supervisee Panel student detail (27 October 2026)

View student opens an independent Student Panel details page, with Back to My supervisees above the title. The page separates student overview, current Panel contact details, current research and a prominent nomination action/status section. Mobile places nomination controls before the Panel/research content. Existing nomination and replacement eligibility remain unchanged. Student-specific completed nomination history is collapsed and paginated; it has no list filters. Staff identifiers are not shown in this overview.

## Nomination records consistency correction (27 October 2026)

Nomination records must use the established Requests / History wording and keep all filters visible, matching the other appointment workspaces.

## Panel supervisee list and nomination records (27 October 2026)

Supersedes the earlier Students / My nominations switch. Lecturer My supervisees shows one roster with search, nomination status, pagination and View student actions. A secondary Nomination records button opens a dedicated page, retaining former-supervisee submissions and Ongoing / History. Its Back link appears above the title; module tabs remain on the workspace. Search/status remain visible while programme, semester, submitted date and sorting are under More filters. No repeated general guidance card on this workspace. Student detail redesign remains a separate phase.

## Panel supervisee list workspace (27 October 2026)

The Lecturer My supervisees page presents Students and My nominations as mutually exclusive views inside one workspace. Existing module tabs remain. Students retain search, nomination status and pagination; My nominations retains ongoing requests, final history and records for former supervisees. The roster action is labelled View student. Student detail redesign is a separate phase.

## Lecturer Panel assignment academic team (27 October 2026)

The Lecturer My Panel students assignment detail shares the Supervisor detail hierarchy: student overview, academic team, research and assignment sidebar. Show current primary/supporting public contacts and the member recorded for this Panel assignment. Omit internal staff numbers and supervision management controls. Retain lifecycle, nomination evidence, Marks navigation, Back and read/retry behaviour.

## Supervisor team contact hierarchy (27 October 2026)

Supervisor detail must treat primary and supporting supervisors as one supervision group, with equal public department/email/appointment-date fields. Panel evaluation is a separate subsection with one balanced divider. Preserve nomination, replacement, end-appointment and history capabilities for each authorised role. The standalone Panel assignment redesign remains a later phase.

## Supervision team actions and nomination form (27 October 2026)

Supervision detail actions belong beside their supporting-supervisor or Panel heading, with consistent icons and touch targets. Co-supervisor nomination must retain student context and readable form spacing while preserving validation, eligibility, recovery and workflow controls.

## Stable appointment tab layouts (27 October 2026)

Within appointment request workspaces, Requests/History must retain the same shared summaries, navigation, filter placement and guidance. Tabs continue to select different records and lifecycle information; list height may vary naturally. Preserve all existing role-specific navigation and capabilities.

## Supervisor request empty action divider (27 October 2026)

Completed Supervisor appointment requests must not display an empty decision section between approval progress and audit history. Preserve pending decisions and eligibility notices.

# Project Requirements

## Panel overview action removal (27 October 2026)

Remove View approved nomination from the Student Panel appointment overview, as requested. Preserve the Supervisor approved-application action and existing appointment details.

## Student Supervisor tabs preserved (27 October 2026)

Retain My supervisors, Applications and Research changes as the existing workspace tabs above the content on every Student Supervisor workspace page. Appointment-card visual consistency must not remove or relocate these navigation tabs. Do not duplicate the tabs as links inside the overview card.

## Revised Student appointment cards and approved Panel source (27 October 2026)

Supersedes the earlier floating academic-context arrangement. Both Student appointment overviews use the same appointed-member card structure: header source action, name/status, department, email, appointment date, semester and programme. Keep metadata inside the card, remove the unmatched Panel refresh button and preserve automatic return-to-focus reload/retry. Supervisor must provide actual public contact/date/semester details from the active appointment rather than show only a name. Its application/history and research links remain available inside the card instead of a separate overview tab strip. Supporting supervisors and previous appointments remain available. Panel provides a View approved nomination action in the equivalent card-header position. The Student-only approved record exposes the current approved nomination reference, nominating supervisor and recorded submission/acceptance/approval dates; staff comments, reasons, pending identities and raw audit history remain private. A foreign or obsolete reference must not silently open another record. Source details retain back/retry controls on loading/failure and mobile presentation. Internal staff numbers remain withheld.

## Student appointment overview consistency and application traceability (27 October 2026)

Student Supervisor and Panel overviews must share academic-context, appointed-member, current-research and contextual next-step presentation, with consistent typography, spacing, accessible actions and responsive reading order. Retain Supervisor applications/research navigation, supporting-supervisor history and Panel prerequisite/FAQ navigation. Students must not receive the Panel member's internal staff number; the legacy student response key remains null while staff-facing records retain their existing identifiers. Only dual-confirmed Panel status/readiness releases the confirmed member's public information. Keep the current appointment visible during replacement review and preserve generic faculty-processing privacy. Place View approved application beside the current primary supervisor; it opens the active appointment's approved request even if a newer replacement is pending or older approvals exist. Do not invent an application link for legacy records without a source request. New-application document guidance belongs to students still preparing an application; pending students see progress guidance and appointed students see exceptional-change guidance. Display existing data without inventing absent Supervisor contact/semester metadata.

## Panel nomination form/list consistency — Phase 4 (27 October 2026)

Use the approved shared Student overview, nomination and research hierarchy for new/replacement Panel nominations, with readable regular-weight answers and optional full abstract. Clearly distinguish the current appointed member from a proposed replacement. Candidate selection must support pointer and keyboard use, expose associated option/selection semantics, skip unavailable candidates and never accidentally submit when Enter selects an option. Preserve authoritative capacity/eligibility, required notes/replacement reason, intake enforcement, exact payloads, busy guards, inline failure feedback and dirty-navigation confirmation. Common staff lists retain the shared automatic filter panel, request/history/current/past partitions, pagination, export and exact record destinations. Name repeated record actions accessibly and provide 44px action targets. No new academic fields, backend changes or permission expansion.

## Student Panel overview consistency — Phase 3 (26 October 2026)

Separate the Student Panel overview, confirmed member and current saved research into readable surfaces consistent with staff/Supervisor details. Keep a compact relevant next step beside the content on desktop and stack on smaller screens. Distinguish an unapproved proposed supervisor from an appointed primary supervisor. Pending Panel member identities and internal nomination/review/audit fields remain private; preserve the public readiness states, current-appointment continuity, existing prerequisite navigation, loading/error/retry and return-to-focus reload. Refresh and FAQ controls must retain clear accessible names and usable touch targets. Do not invent missing research from an application title or introduce new backend fields.

## Panel appointment detail consistency — Phase 2 (26 October 2026)

Staff Panel appointment/assignment pages must prioritise the appointed member and current research, with one student overview and a compact lifecycle side card. Preserve appointment status/date, ending date/outcome/reason/actor, existing lifecycle and nomination audits, and scoped Marks/ending/navigation controls. Nomination justification and review evidence remain available in a collapsed disclosure, including for legacy records lacking lifecycle metadata. Supervisor supervisee details separate the active member from any proposed replacement; existing nomination/replacement capability checks and continuity messaging remain. Office attention overviews distinguish current appointment status from an ongoing nomination using only the API-supplied state; an active appointment response alone must not claim that no concurrent request exists. Keep recommendation routes on the Phase 1 presentation; Coordinator assignment details must not offer request decisions. Student view, form and list redesigns remain later phases; no new data fields or role permissions.

## Panel request detail consistency — Phase 1 (26 October 2026)

Panel recommendation detail pages must follow the approved Supervisor visual hierarchy: independent student overview, nomination details/justification, current research reading area, and review/outcome. Keep 28px separation, muted 12px labels, regular answers of at least 14px, a desktop review side column and a phone stack. Reuse shared icon headings, dark positive/red rejection controls and the existing student-record action. The selected Panel member accepts, the scoped Coordinator approves, and Office/supervising Lecturer readers retain their existing capabilities; no new authority is introduced. Preserve replacement continuity, terminal reasons, cancellation confirmation, audit history, busy state, and current-profile provenance. Student privacy and title/abstract amendment scope remain unchanged. Assignment lifecycle redesign, Student Panel overview, nomination form and list polishing remain subsequent phases.

## Phase 3 research-change UI (26 October 2026)

Keep the existing title/abstract amendment scope and approval permissions. Present request overview, saved before/after comparison and review/outcome as independent surfaces across all existing roles. Preserve original snapshots, transfer retention evidence and recorded reasons. Tidy the existing form with clearer sections and an optional preview; retain automatic list filters. Research area/Research Intent amendment expansion and Registry transfer relocation remain separate pending work.

## Phase 2 research profile and Registry handoff (26 October 2026)

Phase 2 research profiles must separate student identity/programme, readable current title/abstract and visible compact saved-version history. Only exact current-version metadata may describe the current record. Preserve role capabilities, immutable revision comparisons, missing-data honesty and existing URLs. Programme transfer belongs in Registry; the current entry stays reachable until the replacement passes cutover acceptance. See docs/PROGRAMME_TRANSFER_REGISTRY_HANDOFF_2026-10-26.md.

## Record navigation button consistency (26 October 2026)

View approved application and View student record use the existing dark primary button with white text wherever those actions are available. Application navigation uses the document icon; student-record navigation uses the student icon. Keep existing role visibility, destinations, disabled states and responsive wrapping.

## Approved application access from supervision (26 October 2026)

Keep current supervision details concise while providing a clear View approved application action in the student overview for authorised staff. Target the approved application attached to the active primary appointment, never a newer pending replacement or another student's record. Application evidence retains its existing access rules: a supporting supervisor's team access alone does not grant access to the primary application. The Student counterpart uses its existing own active approved application with the same action label. Preserve the current research profile separately from the submitted snapshot and return to the originating supervision page with its query context.

## Detail sidebar action polish (26 October 2026)

Request review and Phase 1 compact appointment sidebars use equal-width, vertically stacked actions with a minimum 44px height, readable 12px semibold labels and consistent spacing. Positive decisions appear first with primary styling; rejection and ending retain a restrained danger treatment. Apply the shared layout to existing caller-supplied actions for all roles without adding permissions or changing confirmation, busy, eligibility or historical behaviour. Other portal buttons retain their existing presentation. Supervisor and Coordinator primary request decisions must use identical button markup, check/cross icons and complete request labels; only the positive workflow term differs (Accept request versus Approve request).

## Phase 1 supervision detail layout (26 October 2026)

Staff supervision details for Lecturer, Programme Coordinator and Office must separate the student overview, supervisory team and visible current research from appointment management and historical activity. Use the approved request-detail spacing, aligned section icons, muted 12px labels, regular 14px answers and a readable 18px research title. Appointment metadata belongs alongside the main content on desktop and follows it on smaller screens; it must retain approval/end dates, saved outcomes, history and authorized controls without duplicating student/supervisor identity rows. Research must remain readable without opening a disclosure. Histories and shared semester dates remain expandable and separately labelled.

The Student My supervisors counterpart uses separate own-team and research cards with only Student-safe current members and historical summaries. Preserve all role/capability gates, pending replacements, read/error/retry handling, source data and historical-access boundaries. Default historical appointment summaries and the Panel overview profile retain their current presentation. Standalone research profile and research-change page redesigns are later phases.

## Supervisor request detail spacing revision (26 October 2026)

Replace the catch-all Application details card with independent student overview, research details, submitted Research Intent, and supporting documents/declaration surfaces. At desktop widths, put Review and outcome beside the research content; stack it after the evidence on smaller screens. Keep clear label/answer hierarchy, visible section spacing, all saved text and documents, secondary evidence disclosures, and role-owned capabilities for Student, Lecturer, Programme Coordinator and Office. This supersedes the earlier two-primary-card layout requirement below.

The user also requested one persistent local development request with realistic fictional content for visual review. It must use the normal submission contract and configured local demo authentication, preserve existing records, include saved Section A/Research Intent and usable supporting PDFs, and remain clearly distinguishable from real student information.

## Supervisor request detail reading order (26 October 2026)

Student, Lecturer, Programme Coordinator and Office views of the primary Supervisor request must share a compact identity/semester/proposed-Supervisor overview, an Application details card and a Review and outcome card when request history or actions exist. Group submitted student evidence, research/project details and Research Intent, then supporting documents/declaration. Show title ownership beside the research title. Distinguish muted 12px labels from regular-weight 14px answers; reserve stronger weight for headings. Contact/identity, course results, declaration text and audit history expand on demand; Research Intent follows the form's three groups with individual and expand/collapse-all controls. Preserve full submitted text, historical gaps, retry states, document actions and existing role capabilities. Office replacements must not invent student-submitted evidence.


## Consistent icon heading alignment (26 October 2026)

Decorative header icons must share the vertical centre of their title, with supporting text beneath the title rather than shifting the icon. Preserve existing typography, colours, actions, heading semantics and role/workflow rules. Long titles must wrap without horizontal overflow at desktop, tablet and phone widths. This pass corrects alignment before any appointment request redesign.


## Existing profile ownership protection (25 October 2026)

Existing Student, Lecturer and OfficeStaff profiles must retain their owning User during Django admin maintenance. Owner reassignment, including crafted or ambiguous POST values, must be rejected before any profile or audit writes. Both the edited and other participant records must remain unchanged on rejection. Legitimate new-profile creation and permitted ordinary maintenance remain available; lifecycle changes continue through the reasoned Office services.


## Office business authorization separation (25 October 2026)

Approved policy: active authenticated Office users retain the five owned modules' business actions independently of Django admin flags. Submitted Marks correction/reopening additionally requires an explicit user/group `marks.change_markentry` assignment; a superuser flag does not substitute. Technical admin entry requires a separate active Technical Administrator with staff/superuser flags. Governed academic records, including research profiles, remain inspection-only. Account conversion must preserve credentials, existing permissions, scope, validation and audits. Implementation and rollout evidence: `docs/OFFICE_ADMIN_SEPARATION_2026-10-25.md`.

## Carryover and semester handover acceptance boundary (25 October 2026)

Verify Office reassessment grant, replacement, revocation, stale-decision recovery and final consumption separately for primary Supervisor, supporting Supervisor and Panel requests. Retain original semester and approval stage; authorizations add no workload or capacity, and final approval must record the policy actually checked. Verify semester activation with a fresh unfinished-Marks preview, reason and acknowledgement, closure of the outgoing Published period, preserved submitted/draft Marks and active completion rights, and blocked premature archival. Use isolated synthetic records and distinguish component/HTTP evidence from full-shell and remaining compound acceptance. This testing work adds no runtime policy or workflow.

## Acting delegation acceptance boundary (25 October 2026)

Verify reasoned Office grant/revocation, programme-bound effective authority, regular-programme retention, stale decision denial, mounted queue refresh, personal history and dependent report/export/dossier privacy with isolated synthetic records. Verify scheduled, inclusive-end-date and expired states with an isolated test clock; retain grant history and completed academic work. Distinguish production-component/HTTP evidence, parsed XLSX content and backend retirement/concurrency/migration regressions from full-shell/login, compound lifecycle and external policy acceptance. This work introduces no academic policy, cross-account identity rule or technical-admin permission change.

## Research and transfer acceptance boundary (25 October 2026)

Acceptance must distinguish primary-Supervisor final decisions on Student research changes from separate source/destination Coordinator decisions on Office programme transfers. Verify reason validation, cancellation/rejection, successful UI approval, stale-decision recovery, one-pending-request conflicts, per-stage team acknowledgement, unauthorized access, retained history and consistent programme/revision outcomes with isolated synthetic records. Compare original applications, primary/supporting/Panel membership, submitted/draft Marks and completion windows before/after. Preserve remaining compound lifecycle/report/export/reconciliation and faculty-policy boundaries; this acceptance work adds no academic approval, Registry ownership change or runtime workflow.

## Supporting supervision acceptance boundary (25 October 2026)

Verify supporting nomination, candidate/Coordinator rejection, reasoned cancellation, approval, replacement and closure through existing role-scoped screens and real authenticated HTTP using isolated synthetic records. Check Student redaction, private-application/Marks denial, incumbent retention, former-member history/access revocation and exact preservation of primary/Panel/research/submitted Marks. Distinguish component-level browser evidence from full-shell/login, concurrency, remaining compound lifecycle/report/export/dossier/reconciliation cases and external faculty-policy/template decisions. This acceptance work introduces no new workflow or academic policy.

## Lecturer draft and submission reliability (25 October 2026)

Public lecturer draft and submission writes require the version of the record that was reviewed. Reject stale writes without changing newer scores, feedback or comments. A submission carries the full reviewed rubric payload and a task-scoped UUID; save and lock atomically. Repeating an identical committed attempt returns its result without a second write, including after the evaluation period closes. Reusing a reference for different input, or replaying after an Office correction/reopening, requires reviewing the latest record. Ownership, task lifecycle, eligibility, deadlines and required-component checks remain authoritative. Failed requests retain local entries; replacing them with saved values requires explicit loading. No automatic submission retries or browser persistence of academic draft data.

Marks acceptance verification must cover Office rubric/period setup, one lecturer's separate Supervisor/Panel assignments, revised draft persistence, submission locking, own read-only history and matching Office results using isolated test data. Submission-day labels in Office records also use Malaysia time consistently with lecturer views.

Lecturer marking responsibility navigation uses compact numeric badges for nonzero pending-task counts (or submitted counts in history), omits zero-count text, and preserves descriptive counts for assistive technology.

## Lecturer marking bug-review clarifications (25 October 2026)

Saving or submitting must persist the latest rubric-component scores and feedback, including cleared scores and feedback, without restoring older compatibility values. Explicitly reviewing the latest record after a conflict replaces stale form values and resets the unsaved-change baseline. Submission dates must use Malaysia time consistently from both the task queue and submission history. These clarify existing marking correctness requirements; no new workflow or permissions are introduced.

## Lecturer submission history retention (25 October 2026)

Lecturers can read their own currently submitted evaluations independently of the active assignment list, including paused/retired assignments and closed/archived evaluation periods. History reads must never generate tasks, grant editing access or expose another evaluator's marks. Retain role separation, identify evaluation periods, sort actual submission timestamps newest first and apply inclusive submission-date filters in Malaysia time. History has independent loading/error/retry states, automatic search/semester/date filters, role-specific empty states and readable phone rows. View submission is read-only. Existing save, submit, correction and reopening authority is unchanged; reopened draft entries reappear only after resubmission.

## Lecturer marking responsibilities (25 October 2026)

Lecturer Marks Entry separates My supervisees and My panel students using the existing portal workspace navigation style. Keep both choices visible and show unfinished task counts; expose Backup marking only when assigned. On first load prefer an assigned responsibility and retain explicit selections through filtering, record navigation and submission history. Summary cards cover the selected role and semester before search/status filtering. Count evaluation tasks, including separate periods for one student, rather than presenting them as student counts. Integrate automatic search/semester/status filters and Clear filters inside the task card. Group identity and research/semester metadata, use Start marking / Continue marking / View submission actions, and omit empty table scaffolding. On phones stack task rows so marking actions remain visible without horizontal scrolling. Distinguish a failed history read from an empty history. Keep the marking responsibility visible in editable, read-only and submitted records. Successful draft saves stay in the editor, acknowledge saving and reset unsaved-change tracking; subsequent edits restore the unsaved state. Preserve backend assignment, scoring, eligibility and submission authority.

## Evaluation period browsing and editing (24 October 2026)

An empty period workspace uses the shared neutral white card with a calendar icon, a short explanation and one New period action within the card. Omit the redundant list heading and duplicate header action when there are no rows. Keep archive controls available for an archived-only list and preserve creation restrictions for read-only semesters.

Start Mark Entry Periods with a single period list and visible Draft, Published (with current date status), Closed and Archived lifecycle badges. Show the configuration editor only after New period, a period selection or an exact incoming period link. Back to period list returns to browsing without saving. New period resets the draft, scrolls/focuses Period name and preserves configured defaults and existing eligibility guards. Show Include archived periods only when archived records are available within the selected semester scope; inclusion adds historical rows to the same list and never reopens marks entry. Distinguish an entirely empty list from a list containing only hidden archives. Retain read-only archives, existing query semantics, context isolation and save/publication safeguards.

## Marks usability and necessary guidance (24 October 2026)

Keep Marks guidance brief and relevant to the current state. Remove repeated setup instructions from empty summary cards and routine explanatory copy; retain period/monitoring scope, meaningful empty/error recovery, publish/lock consequences, backup exceptions and extra-time rules. Show a direct rubric setup link when no ready rubric is available and a local explanation when an editable task cannot be submitted. Lecturer tasks and submitted history reuse the portal filter panel with visible labels, immediate filtering and Clear filters, preserving remembered visible selections. Secondary monitoring follow-up/activity stays available in a collapsed disclosure. Show accurate result counts rather than inert pagination; only expose student navigation with a supplied destination. Rubric component and mark-feedback fields have persistent associated labels; wide tables remain readable and keyboard-scrollable. Preserve scoring, eligibility, role authority, audit and confirmation behaviour.

## Mark records workspace refinement (24 October 2026)

Present Mark Entry Records as one compact workspace consistent with evaluation task assignment. Reuse the shared WorkspaceFilterCard from appointment modules: a light-grey panel, visible labels, aligned field grid and standard Clear filters footer. Combine status counts into one Status dropdown instead of five summary cards or duplicate status controls. Keep search, programme, semester and evaluator filters visible in the same panel. Every field filters immediately and resets pagination; show only the standard Clear filters action, without Apply or filter-success notifications. Shared filter labels and values must inherit the portal typography instead of larger Marks-specific form overrides. Preserve authenticated-shell list memory, incoming status filters, dashboard monitoring scope, record/student navigation and existing status/lifecycle rules. Count all loaded records within the current monitoring scope before search filters, including paused/retired assignments, and explain that scope. Group record ID with student identity and submission date with status without removing information. Distinguish an empty registry from unmatched filters; omit empty table scaffolding and pagination. Keep table scrolling local and pagination bounded as records grow.

## Marks workspace hierarchy and visual consistency (24 October 2026)

Evaluation task assignment uses two main cards: combined period selection/generation, then task management. Replace separate summary cards and role-filter pills with a labelled Evaluator role dropdown containing All/Supervisor/Panel/Backup counts. Place it beside Task status in the same shared WorkspaceFilterCard used by other modules, with standard Clear filters placement. Period metadata and informative readiness remain available in a collapsed disclosure; show essential generation guidance without expanding it. Keep submission counts, status filtering, filter reset and secondary backup assignment together with results. Clear filters resets role/status while retaining the period. Distinguish unconfigured periods, no generated assignments and filtered empty results. Provide central deadline management as a header shortcut, retain local completion-window access when that shortcut is unavailable, and embed collapsed session activity within task management. Preserve all existing task/backup generation eligibility, targeting, confirmation, scoring and record access.

An empty rubric library shows one full-width setup card with a direct “Create rubric family” action. Do not show an empty family sidebar or ask users to select a nonexistent rubric. The first-family form uses the full work surface and receives keyboard focus; populated libraries retain the existing family/version list and editor.

The Marks-specific attention panel is labelled “Evaluation checks”, distinct from the dashboard's cross-module “Needs attention”. Explain that summary cards describe one named period while setup readiness and evaluation checks cover non-archived periods and active rubrics. Exclude archived task totals from setup/monitoring readiness. When no non-archived period exists, provide a clear first step and direct link to period configuration.

Office Marks uses a task-based overview without a new module tab bar: compact period, rubric and task summaries; three grouped evaluation setup destinations; actionable attention items; and separate submission monitoring with record access. Keep the current Inter font and portal card/icon conventions. Use readable section/form labels, semantic headings, usable mobile fields and consistent return links across Office configuration, rubrics, assignment and records, and Lecturer entry/history/details. Retain all existing routes and role access.

Keep missing setup, no tasks, filtered empty results and read failures distinct. Do not show a completion percentage when there are no tasks or invent urgency for zero overdue tasks. An overview metadata failure must not hide working setup destinations, records or independently loaded monitoring; display unknown setup statuses and a retry action. Preserve existing data scopes, readiness rules, generation checks, score validation, draft retention, submission locking and correction/audit safeguards.

## Current and past appointment navigation (2026-10-23)

Office and Lecturer supervision/Panel assignment lists expose the same compact Current / Past switch beside the section heading, with Current as the initial view. Current means active appointment status, regardless of its originating semester. Past means an ended appointment (or a completed Panel assignment); request decision history remains separate. Preserve role-specific grouping, existing record access, filters and exports. Clearing filters must retain the selected appointment view.

Lecturers can browse their own ended primary and supporting supervision appointments together, with search, role/programme/semester/end-date filters and pagination. Show student identity, their former role, start/end dates and recorded outcome, and offer a read-only appointment summary. Historical appointment ownership must not grant access to the student's current supervisory team or live research profile. Keep keyboard focus on the selected switch when changing views and retain list context on returning from a record. Returning from a past supervision record must restore focus to its originating row, and browser Forward must reopen the appointment just viewed. While changed filters or pagination are loading, hide results belonging to the previous query.

## Automatic Supervisor application draft continuation (2026-10-23)

Opening the student Supervisor appointment application automatically restores the owner-account saved draft once its initial read and any required student-particulars load settle. Keep the form disabled during initialization so delayed responses cannot overwrite new writing. Restore saved text and choices without an automatic save or submission, and keep the restored snapshot clean for navigation. Return to the first incomplete earlier writing step, or the saved step capped at Supervisor and documents; saved Review progress must recheck current availability and files. Files and declaration are never restored. After an initial load failure, editing may continue and later retries must not overwrite the current form; manual Resume retains dirty-replacement confirmation. Keep explicit Save draft, confirmed Discard, existing validation/permissions/intake/capacity rules, and a brief restoration notice. This supersedes the earlier requirement to explicitly resume every time the form opens.

## Capacity editor action hierarchy (2026-10-23)

Compare versions and Set limits in bulk use the shared primary button variant, matching Review and publish with a dark background and white text.

Present an editable capacity draft as one work surface. Keep its version title and Compare versions in the header without a duplicate Draft badge. Place selection scope and Set limits in bulk together directly above the lecturer roster. Use a compact Select lecturers menu for the current page, all matching lecturers and clearing selection; show selected count only when selection exists. Place publication readiness and Review and publish after the roster and pagination. Preserve shared fonts, controls, individual editing, cross-page selection, filters, modal safeguards and all existing publication rules. Adapt the toolbar and publication footer to narrow screens without overflow.

## Bulk capacity draft editing (2026-10-23)

Office can select eligible lecturers across roster pages, select the current page or all matching lecturers, and set common Supervisor/Panel limits through a bulk modal. Filters/semester/version changes clear selection; paging preserves it. The default fills missing limits only, preserving zero and existing values. Replacement is explicit; blank inputs leave that role unchanged and roles not held are skipped. Preview exact old/new values and affected count before one transactional save. New entries still require all held-role limits. Drafts may fall below committed workload with warnings, but publication minimums remain enforced. Preserve individual edits, copying plans, published policies, availability, audit history, dirty/busy protection and stale-review safeguards. Batches are limited to 1000 lecturers.


## Shared workflow report filters (2026-10-23)

Workflow reports use the shared filter card, label/control sizes and Clear filters action. Valid date, semester and Office-only programme selections refresh reports automatically without Apply filters. Clear restores the active semester and removes date/programme restrictions. Preserve role scope, selected filters on return, inline invalid-range validation, retry and report/export consistency. Downloads require a successfully loaded report for the selected valid filters; superseded responses cannot replace the latest results.


## Capacity publication modal (2026-10-23)

Review and publish opens a shared confirmation modal over the draft editor. Show semester/version identity, a brief publication consequence, required reason and explicit review consent. Preserve editor context on cancellation, warn before discarding entered text or navigating away, block duplicate submissions and busy closure, and require a fresh review after a stale-record conflict. Preserve server-side workload minimums, authorization and concurrency validation.


## Capacity row wording (2026-10-23)

Capacity rows describe missing configuration as "Capacity limits not set." rather than exposing internal entry terminology.


## Capacity editor information hierarchy (2026-10-23)

Version actions belong in the selected version card header, alongside its title and lifecycle status. Do not allocate a separate page row to Compare versions. Draft readiness starts with a collapsed issue count and retains specific blockers and recovery actions on expansion. The limit editor shows draft identity, inputs, published values and publication minimums; show workload warnings only when a proposed value violates its minimum. Remove repeated policy tutorials and generic reminders from these views. Preserve publication rules, reasons, safeguards, history and availability behavior.


## Capacity publication workload minimum (2026-10-23)

Office may save planning drafts with lower limits, but a new publication must not set any role limit below live committed workload. Supervisor commitments are active primary plus active supporting appointments across semesters. Panel commitments are active appointments plus nominations in Submitted to Panel or Pending Coordinator, across semesters. Pending Supervisor requests do not reserve capacity under this change. Equality is valid; zero is publishable only with no commitments for that role. Recheck workload after taking the existing publication locks and reject conflicts before supersession or audit changes. Show per-role minimums, row blockers and clear publication errors. Older published versions remain immutable/readable and existing appointments are preserved. Temporary unavailability independently blocks new assignments during its dates; it does not change limits, end appointments or pause evaluations. This supersedes the earlier rule permitting publication below current workload.


## Searchable research profile directory (2026-10-23)

Staff research profile browsing uses a paginated student directory instead of an unbounded student dropdown. Office, Programme Coordinator and Lecturer users can search by student name, matric number or research title, filter by programme, sort by student name or most recently updated profile, and select 10/25/50 rows per page. Each row identifies the student, programme and research title with an explicit View profile action. Opening a profile shows the selected student's identity and retains the current profile, saved history and permitted correction/transfer actions. Back to students restores the directory filters and page. Existing role-based profile visibility and the Student's own profile experience are preserved. Only students with saved profiles within the actor's scope appear; empty and failed reads provide clear recovery actions.

## Panel appointment header grouping (2026-10-23)

My Panel students keeps its title and current/past appointment explanation together above the filters. The view switch sits beside that complete header on desktop and wraps on smaller screens. Current/past explanatory content is preserved, with no changes to card padding or appointment filtering.

## Office appointment table hierarchy (2026-10-23)

Office Supervisor and Panel attention tables distinguish reviewer identity from request state. Current reviewer cells show the actual reviewer name prominently with a plain role beneath, or the role alone when no matching reviewer name is available. Supervisor/Panel candidates must never be shown as the Coordinator reviewer. Time at this stage retains calendar-day wording. Application/nomination status columns use uniform sentence-case dot-and-text indicators for both no ongoing request (grey) and pending review (amber), without pills or duplicate progress text. Existing card spacing is preserved.

## Appointment status and horizontal spacing refinement (2026-10-23)

Office Supervisor Appointments > Without supervisor shows one application status per student: the specific review-stage badge when an application is pending, otherwise No ongoing application. Remove the redundant Application in progress line from table rows. Staff appointment cards use 20px horizontal padding at all sizes, preserving 28px vertical padding and 24px section gaps from 640px. Filter padding and mobile spacing are unchanged.

## Appointment workspace spacing (2026-10-23)

Supervisor and Panel Appointments staff collection cards use consistent, more spacious desktop layouts for Lecturer (including Supervisor/Panel responsibilities), Programme Coordinator and Office Staff/Admin. Requests/history, supervisory teams, Panel assignments/supervisee lists and Office attention tables use 28px outer padding, 24px section spacing and 20px filter padding from the small breakpoint (640px). Mobile retains 20px outer padding, 20px section spacing and 12px filter padding. Other modules and student layouts retain their existing spacing.

## Acceptance modal placement (2026-10-23)

Eligible reconciliation warnings show a secondary Accept as intentional button in the lower action row of Recommended next step, right-aligned on desktop and fitted to mobile. The source-record action stays beside the correction guidance. Acceptance explanation, affected record, reason, acknowledgement and final confirmation appear only in the shared modal. Cancelling retains the draft for reopening; leaving the issue still invokes the existing unsaved-changes guard. Eligibility, audits and repair behavior remain unchanged.

## Reconciliation exceptions and meaningful capacity checks (2026-10-23)

An approved semester capacity limit differing from an old lecturer-profile limit is expected policy variation and must not create a reconciliation issue. Required-policy, role-alignment, publication-conflict and availability checks remain. Office can accept an intentional exception only for review-only warning records: unmatched semester links on inactive timelines or rejected/cancelled Supervisor/Panel requests, and capacity role-alignment warnings. Current timelines, ongoing requests, evaluation periods, blocking issues, missing required plans and verified repairs cannot be dismissed.

Acceptance requires a reason, acknowledgement and confirmation. It records the reviewer, time and exact evidence without changing academic data or labelling the record repaired. Open issues and Accepted warnings have separate shared collection views; open counts in dashboard/reports exclude currently accepted warnings. Changed evidence, participant identity, record status or eligibility returns the warning to Open issues, while immutable review history remains. Repairs continue to correct underlying data and disappear when their detector condition no longer holds.

## Compact reconciliation list and check explanations (2026-10-23)

The reconciliation list uses short labels for missing capacity plans, missing semester links and old/current capacity differences. Rows retain lecturer/semester/version context, distinct record references and actual differing limits; repeated explanations, programme names and redundant module labels move to the existing review detail. The expanded check help uses the available width and concise text while preserving when checks run, warning/blocking meaning, published-policy authority and explicit repair confirmation. A plain-language guide explains each detector's trigger and purpose, including when a warning may represent an intentional or unfinished state.

## Reconciliation review safeguards (2026-10-23)

Before confirming a repair, Office sees the exact target semester, the source capacity policy semester/version for a copy, and any selected managed programme. Semester matching uses Malaysia calendar dates for submissions and evaluation period ranges. Semester assignment and capacity-copy repairs must reject changed evidence after acquiring their affected row locks. Workflow/coordinator issues retain their module identity rather than being labelled Lecturer capacity. Rechecking an out-of-range result page keeps loading visible until the replacement page arrives; filter changes immediately invalidate prior requests. Marks source actions open evaluation period configuration or task assignments according to the affected record type.

## Workflow reconciliation clarity (2026-10-23)

Reconciliation explains why saved records are flagged, the workflow impact and the available next step. Capacity issues identify the lecturer/staff number, academic semester and policy version. Published semester limits are authoritative; differences from older lecturer profile limits are valid policy variation and do not create reconciliation issues. Missing semester links show the recorded label/date signals and matching-semester count; a repair is offered only when the existing server checks verify it.

The list uses shared summary cards, immediate filters, responsive tables and pagination. Summary totals cover all modules; filters narrow the list. Blocking issues take priority before pagination, followed by verified repairs. Recheck records explicitly reruns checks and displays a server check timestamp. Evidence is visible before secondary record references. Repair history is requested for the selected record on expansion. Existing Office-only access, reasons, confirmation, live validation, fingerprints and immutable audits remain mandatory. A committed repair cannot be repeated if subsequent refresh fails.

## Lecturer capacity navigation and policy summary (2026-10-23)

Lecturer capacity keeps its workload overview without tabs. Capacity versions, Lecturer availability and Capacity activity log are separate internal views with one collection and pagination control each. The selected semester and overview roster filters/page are retained when returning. Availability opens to current and scheduled restrictions, supports immediate lecturer/name/staff-number, role and status filters, and is read-only for Office. A lecturer-details shortcut scopes the destination to that lecturer before pagination and offers a visible clear action. Reasons and cancellation information appear in a details modal.

The policy card separates Published limits from draft work, including older drafts. One draft offers Continue editing; multiple drafts require explicit selection through Review drafts. Published-only policies offer Prepare revision; initial setup offers Prepare limits. Starting another draft remains available from Capacity versions. Closed semesters retain read-only access. Planning averages and their calculation move to preparation as optional reference details; actual readiness warnings remain visible. Availability ownership, assignment eligibility, publication requirements, draft concurrency checks and discard retention are unchanged.

## Office monitoring destinations (2026-10-23)

Each Office dashboard Monitoring link opens the records behind its count: pending primary/supporting Supervisor review requests, Panel recommendations awaiting Coordinator approval, active incomplete evaluation tasks, active Backup evaluator assignments (including submitted tasks), or Panel lecturers at/above their configured capacity. Explicit monitoring links start with fresh local filters, identify the active scope, and allow clearing that scope. Ordinary workspace filters remain remembered. Native link URLs support opening in a new tab, and workload navigation retains Dashboard return context.

## Workload monitoring summaries (2026-10-23)

Panel and Supervisor Workload Monitoring show four summary cards above their records: lecturers in view (including missing published capacity), active Supervisor appointments or occupied Panel seats, available lecturers, and lecturers at/over capacity. Summaries follow all current filters across result pages and remain within the authorised API scope. Panel occupied seats include active appointments plus pending reservations; pending Supervisor requests do not reserve capacity. Loading/error states do not display numerical summaries as valid results.

## Consistent dashboard headers (2026-10-23)

All four role dashboards use the same Dashboard title, the same concise description and the same semester metadata layout. Role-specific navigation/actions and workflow content remain distinct. Semester name/status/dates form one compact row on desktop and wrap cleanly on mobile.

## Dashboard semester header context (2026-10-23)

Dashboard semester information appears directly below the dashboard heading without a separate card, background, border, icon or repeated label. The semester name is 14px semibold with the lifecycle badge beside it; authoritative dates appear beneath in muted 13px text. The status can wrap on narrow screens.

## Dashboard semester summary layout (2026-10-23)

Dashboard semester summaries use a shared padded card with a clear label, larger semester name, separate readable date line and top-right lifecycle badge. The compact icon/text strip is replaced consistently for all roles.

## Dashboard semester dates (2026-10-23)

Dashboards for every role display the academic semester label, authoritative start/end dates and lifecycle badge in the semester summary. Dates remain independent of timeline upload availability. The timeline heading omits file upload metadata and duplicated session text.

## Timeline edit modal (2026-10-22)

Edit event opens in the shared modal, matching Add events. The selected semester appears in its header. Cancel, close, Escape and backdrop dismissal protect unsaved edits; saving failures retain input. Audited deadline extension remains accessible from the editor and requires clean edits.

## Timeline event creation and import (2026-10-22)

The import workflow identifies its target semester in both standalone and embedded presentations before the user previews or confirms replacement.

Calendar and Entries expose one Add events action beside their content heading. It opens a shared dialog with Create one event and Import from Excel methods; History has no creation action. Switching methods retains entered details and the selected file. Closing unsaved work requires confirmation. Import explains that confirmation replaces the semester timeline, and keeps template download beside upload and existing preview/acknowledgement safeguards.

## Timeline action simplification (2026-10-22)

Timeline rows expose Edit event and a quiet text-labelled Delete action. Audited deadline extension is available inside the event editor, with its purpose explained beside the action. Unsaved editor changes must be saved before opening the extension flow; cancellation preserves the editor.

## Timeline action consistency (2026-10-22)

Timeline row actions use the shared outlined buttons, with explicit Delete text and confirmation. Actions align to the left of their column with room to wrap. Timeline template/import tools use the same Tools dropdown as Supervisor Appointments.

## Timeline workspace consistency (2026-10-22)

The semester timeline uses the established workspace tabs, an unboxed semester selector with separate status and dates, shared responsive entry/history tables and immediate search/category/status/audience filters with Clear filters. Semester session text appears once. Both lists support shared pagination.

## Semester list simplification (2026-10-22)

The Academic Semesters list shows Semester, Starts on, Ends on, Status and Action. Timeline version, evaluation-period and evaluation-task counts are omitted from this overview; lifecycle readiness and closure reviews remain in their relevant workflows.

## Application step scroll correction (2026-10-22)

Continue must only advance the wizard; entering Review must not validate its declaration or submit the application.

Supervisor application step navigation must position the new step heading below the fixed header, including Continue from Supervisor and documents to Review and submit; keep keyboard focus on that heading.

## Requirement button alignment (2026-10-22)

The Supervisor document requirements Add requirement action keeps its icon and label on one line.

## Evaluation-period empty layout correction (2026-10-22)

When there are no evaluation periods, show a compact explanatory notice above a full-width draft editor. Keep related fields aligned, readable and responsive. Preserve creation, targeting, recipient review, publication and deadline rules.

## Five-module feedback consistency (2026-10-22)

Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks and Workflow/Approval Tracking, including shared semester/capacity/submission-window dependencies, use consistent contextual feedback. Field validation belongs below the associated control; form/action failures belong inside the affected form/dialog; read failures replace only the affected section with a retry of that read. Business restrictions explain the missing requirement beside the action. Helpful information stays beside the relevant setting; successful writes produce one success outcome. Preserve entered values after failure, distinguish saved changes from a failed refresh, and never invite a duplicate write to recover a failed read. Keep long details expandable and messages readable on narrow screens. No changes to academic rules, permissions, existing confirmation requirements or teammate-owned workflows.

## Semester activation clarity (2026-10-21)

Draft semester details and activation readiness are separate sections. Readiness must use server checks for Draft status, Malaysia activation dates, completion of the current active semester's inclusive end date and a complete Published lecturer capacity plan. Direct activation must recheck these rules under locks. A future semester can be prepared but cannot activate early. The final shared review modal identifies the incoming/outgoing semester, explains closure consequences, requires a reason and retains the signed unfinished-Marks acknowledgement. Empty evaluation summaries should not render zero-filled tables. Capacity navigation belongs to its readiness row; unsaved details block activation/navigation until saved.

## Academic Semester presentation polish (2026-10-21)

Semester Overview/History navigation follows the sentence-case Supervisor workspace treatment. The End semester action uses the shared red danger styling; omit the redundant Lifecycle actions heading. Semester creation/editing and transition forms place labels above controls with clear spacing and darker, heavier entered/selected text. Existing lifecycle permissions, confirmation requirements and deadline rules remain unchanged.

## Supervisor application draft controls polish (2026-10-21)

Confirm successful draft saves through the existing dismissible success toast, without adding a save-confirmation paragraph to the form. Keep the sticky intake/Save draft toolbar borderless. In Draft details, distinguish the labelled last-saved timestamp from help text and use full-width primary Resume and destructive Discard buttons. Preserve explicit resume/discard safeguards and inline failure guidance.

## Supervisor application layout refinement (2026-10-21)

When resuming a draft, restore completion indicators and return navigation for valid earlier details/research-writing steps. Do not infer completion from the saved step number alone; incomplete answers remain uncompleted, and current supervisor availability/uploads require checking again.

Keep four sequential steps and the existing academic rules. Place Save draft at the top right in a compact sticky toolbar; move draft help, saved timestamp and resume/discard actions into an accessible disclosure. Show current draft state accurately without suggesting that an unresumed server draft is already applied. Use connected numbered desktop steps with completion ticks and return navigation to completed earlier steps; use compact current-step progress on mobile.

Within Research intent, use five expanded cards: Project details (optional project course codes, research area, research title, title source); Background and purpose; Questions and objectives; Research plan; Research summary (short abstract). Place errors directly below the associated field, choice, upload or declaration and associate them accessibly. Preserve unrelated field errors during editing, focus the first invalid control and retain incomplete save/resume and safe final submission. Bottom navigation contains Back and Continue/Submit only. Preserve shared portal primitives, reviewer views, APIs and data contracts.

## Supervisor application Research Intent (2026-10-21)

All new student Supervisor applications, across all programmes and courses, require structured Research Intent: Introduction, Statement of aim, Research questions, Research objectives, Significance of the research, Methodology, Expected outcomes, Skills needed and Timeline. Reuse authoritative student particulars and shared research title, area, short abstract and proposed Supervisor; never ask students to enter them again in a second document form. Keep proposal uploads as a separate existing requirement.

Use four sequential steps: Your details; Research intent; Supervisor and documents; Review and submit. Validate each step, show the actual written content before the declaration and preserve entered content after failures. Support explicit account-based saving and automatic restoration of incomplete text and selections when opening the application; drafts have no workflow status, capacity reservation or declaration. Clearly state that files must be selected again after resuming. Submission requires all nine nonempty text sections (10,000 characters each maximum), enforced by the server. Authorised exact request readers see the submitted snapshot; historical applications remain readable with an explicit missing-intent explanation. Existing approval, Office replacement, intake, capacity and private upload rules remain intact.

## Submission form structure correction (2026-10-21)

Use a single timeline selector whose popup contains both search and matching results; show no disconnected search field. Selecting an event must not alter the schedule. Use these dates copies only calendar days directly into the main Opens/Closes date fields, preserving entered times and requiring missing times before save. Confirm before replacing different entered dates. Do not show a second import form or duplicate schedule controls.

Use an approximately 880px desktop modal, clear Window details / Semester timeline / Submission schedule sections, readable darker labels and paired fields that stack on mobile. Keep the title and save/cancel footer visible while only the body scrolls. Display event details once and reserve an amber warning for actual date replacement. Preserve date ownership, dirty/busy protections, revision checks and all access policies.

## Linked window date ownership and impact (2026-10-21)

- Event selection must remain bounded and searchable by title, phase or dates, with readable dates in results and explicit unlinked creation.
- Selecting an event does not overwrite form dates. Offer Use these dates before the schedule; fill calendar days directly into its main date inputs, preserve entered clock times and require missing times before save. Confirm replacement of different entered dates.
- Explain: “After linking, manage dates through this submission window. The timeline follows automatically.” Show the affected event and date-change impact before draft saves and common extensions. Personal extra time leaves common dates and timeline unchanged.
- Distinguish Draft/Published/Closed/Archived lifecycle from Upcoming/Open/Ended date status and activity date enforcement. A draft never controls intake. Publishing while restrictions are enabled must explain its access impact. A valid common extension that reopens an expired enforced window must say so before confirmation.
- Preserve existing backend authority, eligibility, revision/audit rules, atomic creation/linking and review of existing requests after submission deadlines.

## Periods layout polish (2026-10-21)

Centre the semester lifecycle badge vertically beside the selection control, with its label above the control row. Use a single divider between the empty submission-window guidance and the reviewability note.

## Submission window modal and linking during creation (2026-10-21)

Office Add/Edit submission window uses the shared modal while retaining the activity overview behind it. Creation optionally selects an existing unlinked event from the same semester's active timeline before saving. Save the draft and link atomically; reject stale, replaced, foreign-semester or already-owned events without leaving a draft. Linked event dates follow the window, retaining its title, phase and audience. An absent or unavailable timeline must not prevent explicitly unlinked creation. Preserve entered details on failure and allow an explicit unlinked retry after a link conflict, even if calendar reload fails. Publishing and enabling date restrictions remain separate actions. Retain audit reasons/revision checks for edits, dirty-change confirmation, busy guards and focus restoration. Show each saved window's timeline connection in its row. Append clearly labelled demo application/recommendation events to the existing local demo timeline without replacing existing events or creating/publishing submission windows.

## Periods and deadlines clarity (2026-10-21)

Office reviews Supervisor applications, Panel recommendations and Marks evaluations in a shared activity overview. A plain semester dropdown scopes the page. Use Add submission window for application/recommendation intake; these are not meeting slots. Clearly distinguish publishing a schedule from enabling date restrictions. Existing requests remain reviewable after submission deadlines. Enabling restrictions requires reason and explicit acknowledgement of published dates and programme gaps. Each window has one Manage window entry for dates, scope, lifecycle controls, calendar connection and history. Show missing timeline setup, explicit existing-event linking and atomic linked-event creation when an editable timeline exists. Marks configuration remains in Marks Entry with explanatory context and exact semester/optional period navigation; invalid context must not fall back. Preserve audited extensions, Closed-semester selected-task recovery and current authorisation rules.

## Capacity lecturer row modals (2026-10-21)

Lecturer roster View and Edit limits open centred shared modals while retaining the table, filters, pagination, scroll and useful focus on return. View shows workload, limits and read-only availability. Edit shows draft context, published reference limits and held-role input fields with Cancel and Save limits. Unsaved edits require confirmation before dismissal or route navigation; saving blocks dismissal, navigation and duplicate submission. Existing validation and concurrency rules remain.


## Capacity version metadata spacing (2026-10-21)

Created by and Created on need a larger visual gap on desktop, with headings aligned to values. Retain the current column widths and mobile card layout.


## Compact capacity version action (2026-10-21)

Use Edit draft for the editable version-row action. Move its Action column slightly right while retaining direct Discard, aligned row controls and responsive wrapping.


## Capacity attention filtering and direct discard (2026-10-21)

Draft publication warnings explain issues and point to highlighted table rows without applying filters. A labelled Show dropdown alongside search and role selects All lecturers or Lecturers needing attention without clearing either field. A result summary counts lecturers, including the page size, independently of publication issue totals. Draft version rows expose a direct Discard action beside Edit draft; existing confirmation, reason, permissions and retained history apply.


## Capacity back navigation (2026-10-21)

Lecturer capacity shows one back control in the shared page header. The overview returns to Dashboard (or its existing caller); draft editing, version inspection, history and availability views return to the capacity overview. Remove the duplicate link below semester selection.


## Capacity preparation and draft discard (2026-10-21)

Preparation is one form with a Continue existing / Start new radio choice, one applicable shared dropdown and one primary action. Existing drafts show creation information and remaining readiness issues. New drafts can start from current published limits, the eligible previous published semester or blank. Validate any previous source before enabling creation; creating a draft opens it for editing.

Versions use consistent Version, Status, Created by, Created on and Action columns, with status filtering and pagination. Drafts can be continued or discarded by Office only within writable semesters. Discard requires a confirmation identifying the semester/version, a reason and explicit consent. Retain the discarded plan, entries, version number and immutable before/after audit; exclude it from active draft choices and reject editing, publishing, cloning or repeated discard. Preserve published policy, concurrency guards and protected participant/delegation areas.

## Capacity overview grouping (2026-10-21)

Keep Versions and history with the current-version heading as a separate compact history control. Draft continuation and preparation form their own action row below; history must not appear as a third draft action.

Present Academic semester as a clearly labelled standalone shared dropdown, with lifecycle status alongside and dates directly below. Group current policy/version, draft preparation and continuation, history, planning baseline and expandable policy issues in one section. Prioritise continuing an existing draft. Preserve semester scope, calculations, readiness details, mutation guards and all protected participant/delegation areas.

## Lecturer capacity overview and lecturer-owned availability (2026-10-20)

Office capacity opens on a readable workload overview, with distinct active student totals and primary/supporting/Panel breakdowns. Pending Panel recommendations reserve capacity but are separate from active students. Retain lecturers with policy history or ongoing work even when retired/disabled; such rows cannot configure limits. Unlinked legacy Panel identities make unique student totals unavailable, not an invented zero or one. Show the recommended planning baseline as enabled lifecycle-active students divided by enabled lifecycle-active lecturers holding a Supervisor or Panel role across all faculties/programmes recorded in the portal. Show source counts and a decimal, handle zero lecturers explicitly, and never use this guidance as an enforced limit.

Office prepares/revises/copies/publishes semester limits through an explicit draft flow. Creating a draft opens it immediately; existing drafts are visible before creating another. Missing lecturer entries remain configurable, zero remains valid, published values stay authoritative until publication, and all readiness errors remain accessible with affected-row filtering and a fresh-draft recovery for ineligible saved rows. History and comparisons remain read-only. Lecturer availability is self-managed in My availability, with held-role choices, inclusive dates, mandatory reason and an explicit confirmation of consequences before creation or cancellation. Confirmation saves without Office approval; future dates schedule effect. Existing appointments remain active. Preserve role/date/overlap rules, audited history, identity-scoped permissions, unsaved-draft navigation guards and all participant/delegation implementations. Office availability history is read-only; existing Office API contracts remain for compatibility.

## Shared appointment filter cards and useful role filters (2026-10-20)

Supervisor and Panel appointment lists use a shared filter-card container and Clear filters footer across Office, Coordinator, Lecturer and Student wherever a filter list exists. Retain the existing compact layout, field sizes and export position. Office/Coordinator retain authorised programme, semester, meaningful status/sort choices and Supervisor request type. Appointment lists use one accurately labelled lower-bound date; removed upper-bound values must not filter reads, exports or lecturer drilldown. Lecturer/Student retain smaller role-specific fields, with always-visible Clear filters. Clear resets applicable filters, sorting and page, retaining list view, page size and route/source context; Panel staff reset retains the established Current assignments default. Student Panel remains a single-record overview without invented filters. This extends the earlier redundant-control-only scope after the explicit follow-up.

## Appointment filter simplification — minimal scope (2026-10-20)

Preserve the existing Supervisor and Panel filter card grid, field widths, spacing, sorting position and Clear filters/export footer. Remove only redundant dropdowns: current Panel lifecycle status, ended Supervisor lifecycle status and single-option Supervisor student sorting. Retain useful request filters and visible dates without collapse. This supersedes the earlier proposal to move sorting and enlarge/rearrange the filter area, which the user rejected during implementation.

## Needs attention filter card (2026-10-20)

The Needs attention filters must appear as an inset card with a visible border on every side and rounded corners, matching the workload filter cards at desktop and phone widths.

## Workload filter card borders (2026-10-20)

Supervisor and Panel Workload Monitoring filter cards must retain visible borders on all four sides and rounded corners, consistent with the other filter cards.

## Complete Office attention workspace (2026-10-20)

Provide an Office-only Needs attention page with search, responsibility/category/programme filters and server pagination. Dashboard shows at most four category summaries, with accurate totals calculated before limiting, and View all attention opens the full list. Category entries open the corresponding filtered list; records open existing workspaces. Use existing Office headers, records sections, controls, tables, badges, state views and pagination. Preserve filters/page on return, existing eligibility and semester/carryover rules. Keep Reports and other-role dashboards unchanged. Participant lifecycle and Acting Coordinator Delegations remain protected.

## Monitoring aligned list (2026-10-20)

The Monitoring heading is 15px and Count heading is 13px, slightly larger than their previous sizes; entry typography and aligned columns remain unchanged.

Replace the five shaded Monitoring entries with one list using subtle dividers, dark semibold labels, bold unboxed counts and a visible View action. Following the user's size correction, labels must match Academic semesters and the other Office tool names exactly: 13px, weight 600, line-height 1.45 and the same dark color. Counts and View actions also use 13px text. Keep label, Count and View columns aligned across every row and the heading, including wrapped phone labels. Retain all five metric definitions, destinations and independent loading/error/retry behavior. This supersedes the two-column badge presentation below; About these counts remains removed.

## Monitoring entry affordance (2026-10-20)

Remove About these counts and its explanation from Office home Monitoring. Each metric should clearly read as data and an entry point: subtle row surface, separate count badge, chevron and hover/focus feedback. Preserve all metric definitions and existing destinations; the Panel-limit metric opens Panel workload.

## Office home monitoring clarity (2026-10-20)

Office home monitoring presents its five existing counts as aligned label/value rows in a compact responsive grid within Office tools. Provide a Monitoring heading and an expandable About these counts explanation. Preserve all existing metric definitions, destinations, independent read/error/retry states and protected areas; zero counts do not imply an all-clear state.

## Office tools navigation cleanup (2026-10-20)

Manage Participants is available from Dashboard home only; remove its duplicate buttons from the Academic Semesters list and record views. Remove the Related tools rows introduced in the Office tools pages. This explicit user request supersedes the earlier requirement to retain these secondary shortcuts. The participant management workspace, routes, backend, permissions and data, and Acting Coordinator Delegations remain unchanged. No further page redesign is authorised by this cleanup request.

The preceding local presentation pass introduced consistent semester context panels, section headings, filters attached to records, compact view controls, grouped capacity actions and expandable publication blockers across the Office tools. Those edits remain local pending user review.

## Office timeline control spacing (2026-10-20)

Reduced Office home timeline control padding and separated the phase switch onto its own row below the title and Manage Timeline action. Narrow phones stack the management action as well. Uses Office-scoped CSS; shared timeline implementation, other roles and protected areas remain unchanged.


## Office reports entry placement (2026-10-20)

Removed the duplicate Workflow reports link from the Office tools directory at the user’s request. Reports remain accessible through the top-right View Workflow Reports button. Reconciliation and all protected shortcuts remain unchanged. The directory now contains seven tools.


## Shared Dashboard semester timeline (2026-10-20)

Office home Semester Timeline must use the same timeline component and presentation as Lecturer, Coordinator and Student dashboards, adapting to the narrower column. Display all applicable phase events rather than an Office-only three-event preview; retain role-specific visibility rules.


## Office Dashboard system design consistency (2026-10-20)

Office Dashboard must follow the existing Lecturer/Coordinator design system for typography, uppercase action buttons, table/form labels and semester context. Preserve the approved home structure and all protected participant/delegation areas.


## Office reports header shortcut (2026-10-20)

Provide View Workflow Reports at the top right of the Office Dashboard, beside the existing Manage Participants button, using the Lecturer/Coordinator secondary-button style and existing reports destination. Preserve Manage Participants and the existing tool-directory link.

## Office Dashboard home correction (2026-10-20, approved and implemented)

After reviewing the isolated visual preview, the user authorised implementation. The graphical Semester Timeline stays on Dashboard home, with compact Needs attention beside it when actual content width permits. Narrow layouts stack attention before the timeline. Keep Research Project 1/2 selection inside the calendar and full-calendar access; remove Dashboard-level tabs, page-switch dropdowns and the hidden Administration menu.

Expose eight existing tool destinations in three visible groups below the main row: Semester and dates, Capacity and workload, Reports and checks. Operational periods/extensions remain separate from Calendar. Keep routine monitoring as compact counts with accurate semester/carryover scope, rather than a competing card. Attention groups must distinguish Office review from waiting on others, retain every returned category, label capped-preview units honestly and keep Supervisor/Panel capacity entries separate. Show real deadline subset counts without inventing urgency or unique-person totals.

Manage Participants/lifecycle management and Acting Coordinator Delegations retain their UI, shortcuts, placement, routes, permissions, APIs and data. Preserve shared defaults, sidebar, linked-tool business rules and source-aware return paths. This correction supersedes the earlier Dashboard navigation/agenda-only presentation described below. Plan and five critique passes: `docs/superpowers/plans/2026-10-20-office-dashboard-home-layout-correction.md`.

## Office Dashboard structure and protected boundaries (2026-10-20, approved)

Office Dashboard must prioritise actionable attention above a compact calendar preview, group repeated warnings without inventing totals or SLA deadlines, and use consistent permitted-page navigation and typography. Operational periods and extensions have a standalone Office-only home outside Calendar. Preserve semester/capacity/deadline/approval rules, audit history, role-scoped reporting and all existing linked tools. Manage Participants/lifecycle management and Acting Coordinator Delegations remain unchanged in UI, placement, routes, APIs, permissions and data; preserve their existing shortcuts and shared defaults. The Office sidebar and unrelated concurrent work remain outside scope. Proposal and twelve critique passes: `docs/OFFICE_DASHBOARD_UX_ENHANCEMENT_PLAN_2026-10-20.md`; implementation authorised in chat after the review.

## Panel appointment filter and tools (2026-10-20, approved correction)

Replace the staff Panel Current/Past switch with an Appointments dropdown inside the existing filter area, offering Current assignments and Past assignments. Apply this to Coordinator and Office lists and lecturer drilldowns, retain remembered selection and exact history/return context, and reset to Current assignments with Clear filters. Remove the duplicate Manage capacity/Configuration entry from the Office Panel Tools menu; retain Workload monitoring, Dashboard Lecturer Capacity and existing capacity enforcement/workload navigation. Supervisor controls remain unchanged. This supersedes the Panel switch requirement below.

## Staff appointment workspace simplification (2026-10-19, approved correction)

Supervisor retains the Current/Past switch below the main module navigation; Panel uses the Appointments dropdown specified above. Remove Panel By lecturer/By student controls and use lecturer grouping whenever no lecturer is selected, including when obsolete shell memory contains grouping=student. Search still finds students or lecturers; View students → View appointment retains inherited filters and exact return context. Retain existing primary/supporting counts and lifecycle/history semantics. Existing filters, 10/25/50 pagination, Excel exports, programme/delegation access, Needs attention and request decisions remain. Student/Lecturer navigation is unchanged. This supersedes the earlier Panel student-first mode; the rejected mockup remains historical, with the later explicit Panel dropdown correction authoritative.

## Staff Panel assignment browsing (2026-10-19, revised by approved correction above)

Coordinator and Office Staff Panel navigation uses Panel assignments beside Appointment requests, with Office Needs attention retained. Browse lecturers with unique active-student counts and View students → View appointment; no separate student browsing mode is provided. Separate Current assignments from Past assignments using confirmed appointment lifecycle, not request outcomes or semester changes. Pending nominations remain in Appointment requests and do not inflate assigned-student counts. Search by student/matric or lecturer/staff identifier, filter by authorised programme, semester, appointment status and start dates, paginate 10/25/50 and export every matching assignment to Excel. Preserve lecturer selection, filters and list return context while opening exact appointments. Coordinator uses only existing authorised programme/delegation records; Office retains its existing scope. Lecturer/Student navigation, decisions, Needs attention and dedicated capacity/workload tools retain their purpose.

## Shared decision dialog presentation (2026-10-19, approved)

The Review decision/Confirm your action header label uses dark slate 12px/700 text so it is slightly more prominent while remaining secondary to the dialog title.

Keep approval/rejection and user-confirmation dialogs independent from ordinary forms while using the existing portal modal surface, padding, Inter family and shared action buttons. Provide a top-right accessible X and default Cancel action; preserve explicit secondary labels supplied by each workflow. X, Cancel, Escape and backdrop dismissal share the existing dirty-draft guard and cannot dismiss during saving. Decision headings use 18px/600, target context 14px/600, field labels 12px/600 in sentence case and explanatory text/entered reasons 12px/400. Scope field typography to decision dialogs. Preserve required reasons, role-specific consequences, duplicate prevention, failure input retention, stale-record blocking and single outcome feedback.

## Workflow analytics filter sizing (2026-10-19)

Dashboard → View workflow analytics uses compact filter buttons with single-line labels. Keep fields in the shaded panel and place actions in a separate footer below it: applied-filter summary on the left, Reset then Apply on the right. On mobile the summary precedes the actions. Preserve filter behaviour.

## Research profile history disclosure (2026-10-19, approved)

On the Research profile page, keep the current profile visible and place saved history in a separate card below it. History starts collapsed with a revision count. On expansion, list the newest revisions first; each revision initially shows only its type, actor and date, with its saved comparison/reason available on expansion. Switching students resets expanded history and revisions. Preserve all existing records and role permissions; history is not part of the request list.

## Student Panel appointment results only (2026-10-19, approved)

The Student academic record shows confirmed Panel appointment results and previous confirmed appointments, without faculty nomination attempts. Before confirmation, expose only generic processing when a real pending nomination exists; otherwise show no current appointment. An active incumbent remains visible while replacement review is pending. Rejected/cancelled attempts, reviewer feedback, nomination identifiers, internal workflow dates/ages, audit actors and staff closure explanations must not be sent to Students or rendered as history. Show only appointed member, public appointment status, appointment date and applicable end date. Previous appointments must not be labelled current. Authorised staff retain complete nomination/decision/lifecycle history and existing access rules. This supersedes earlier Student dossier exposure of terminal nomination attempts/reasons; distinct-attempt history remains a staff feature.

## Student research profile placement (2026-10-19)

On the Student Research changes list, show the current research profile in a separate compact card below the page tabs and above the Research change requests card. Keep the research title, View research profile and permitted Request research change action together. Requests/History, search and results belong inside the requests card; switching views or searching must not move or filter the profile. Keep full profile details on the existing profile page and preserve existing submission capabilities/pending-request guidance and portal typography.

## Office-initiated primary Supervisor replacement (2026-10-19, approved)

Recovery requirements from SR-01–SR-03: ambiguous case-insensitive lecturer staff IDs must produce an actionable conflict without partial changes. A blocked Office replacement form must support a draft-preserving availability recheck. After failed or unreadable submissions, reload authoritative eligibility before allowing another submission; if that read fails, remove stale submission controls and offer Retry while retaining the draft. Rechecking must never itself create a replacement.

The Office Change supervisor entry uses the existing filled primary button style and a supervisor-edit icon so it is visually prominent beside the separate danger-styled End appointment action.

Students submit ordinary first Supervisor applications and track decisions; they cannot initiate a replacement of an active primary Supervisor or cancel a replacement initiated by Office. Remove the Student Change Supervisor action, replacement form state and instructions inviting Student replacement submission. Direct API submissions and direct new-form prefill must enforce the same rule. Historical Student replacement requests and submitted evidence remain unchanged.

Office Staff/Admin initiates exceptional primary Supervisor changes from Supervisory teams -> View supervision -> Appointment record -> Change supervisor. Require a different eligible proposed Supervisor and a reason. Carry current research details forward from server-owned records; record the Office submission actor and reason in immutable workflow history without fabricating a Student declaration, new Section A or reusing immutable document evidence. The proposed Supervisor accepts before Programme Coordinator final approval. The incumbent stays active through pending/rejected/cancelled requests; only final approval performs the atomic handover. Preserve current research revisions, active Panel appointments, supporting supervision and submitted Marks/history.

Keep existing active-semester/intake, personal-deadline, lifecycle, pending-transfer, duplicate, role-separation, capacity and stale-predecessor checks. Office initiation does not bypass closed windows or final approval. A pending replacement replaces the creation action with its reviewer stage. End appointment remains a distinct immediate closure action. This supersedes the earlier Student-initiated replacement requirement in Appointment Closure and Reassignment and related historical acceptance notes.

## Submission availability presentation (2026-10-19)

Replace the large Submission period card everywhere it is used with the shared portal status badge and only the relevant date. Supervisor forms use Applications wording; Panel recommendation/replacement forms use Recommendations. Open periods show the closing time, upcoming periods the opening time, and expired periods a past-tense deadline. A personal extension replaces the general deadline. Unrestricted intake shows no invented deadline. Preserve a short reason and recheck action for unavailable states, and a concise Retry notice for failed checks.

Remove current availability from the Student Applications records list and History. Show it beside New application when that action is present in My supervisors/Applications outside History. Existing requests, permissions, eligibility, approval and server-side period enforcement remain unchanged. Reuse existing Inter typography, StatusBadge and PortalButton styles. Office period management and Marks period configuration remain full management interfaces.

## Supervisor application clarity (2026-10-19, revised after visual feedback)

The declaration checkbox must align with the first text line on desktop and when its wording wraps on mobile.

The Student application remains one scrollable page. Latest user feedback rejects the compact section-link strip and its separate font scale: remove the navigation strip entirely, keep six clearly numbered section headings and review Edit links, and reuse existing appointment typography and standard portal form controls/buttons. Remove the footer paragraphs about one pending request, the approval sequence and cancellation; do not replace them with another guidance card. Existing business rules remain enforced by the backend.

Replace the routine submission-period card with compact factual availability/deadline information, retaining blocked/error notices and a way to recheck blocked availability without losing the draft. Keep comfortable input padding, contextual errors and an actual abstract word count; no unsupported minimum/maximum word instructions. The latest font correction supersedes the earlier proposed form-wide 14px overrides: use Inter, existing 16px/600 appointment headings, 12px/600 labels, 12px/400 detail values and the standard form/button styles.

Project course codes remain optional manual Add/Remove entries, with case-insensitive duplicate detection and the existing combined 255-character text limit. Preserve legacy replacement values/API storage; no catalogue is introduced. Completed courses use an explicit Yes/No choice, bounded complete rows and visible Remove actions. Switching to No keeps local rows for Restore/Discard until leaving/submission; submit results or explicit none, never both. Keep free-text grades.

Students may save their own phone/address within particulars. This supersedes the earlier instruction to leave the form for contact corrections; academic/identity fields and login email stay protected. Use shared phone validation and a 2,000-character address limit; save authoritative account/registry values before a subsequent application snapshot. Unsaved contact edits block submission and use the existing navigation guard.

Keep title-source choice, conditional proposal/private-upload requirements, the concise review and exact server declaration wording beside one required checkbox. Draft or saved-particular changes clear acceptance. Preserve Student -> Supervisor -> Programme Coordinator approval, replacement rules and immutable submitted evidence.

## Appointment workspace correction (2026-10-18, implemented)

Incoming lecturer Panel Requests use the authenticated selected-Panel queue; History uses the authenticated review-history membership, including accepted nominations still awaiting Coordinator approval. Show the recorded Panel decision/date separately from current workflow stage, with No decision recorded for cancellation before review. Outgoing submitted recommendations remain a visible section under My supervisees and retain their own ongoing/final workflow grouping. Confirmed appointment current/past views follow lifecycle status, with ending dates/outcomes for past appointments.

All Panel list consumers use visible shared Requests/History or Current appointments/Past appointments controls and common filters. Lecturer Requests has three summary cards using authoritative active-plus-reserved workload and unfiltered incoming counts; loading/errors do not fabricate zeros. Preserve existing role-specific tab wording, roster/current member identities, pending nomination guards, Student privacy and existing Supervisor final-outcome grouping. Explicit incoming History routes override remembered view state. Supervisor view changes clear incompatible statuses; Student exact requests return to their actual overview or Applications source using validated navigation state.

Approved design and execution evidence: `docs/superpowers/specs/2026-10-18-appointment-workspace-correction.md` and `docs/superpowers/plans/2026-10-18-appointment-workspace-correction.md`. No backend workflow, permission, schema or Section A changes are part of this correction.

## Lecturer Panel workspace structure (2026-10-18, authorized)

Provide one lecturer navigation row: Appointment requests, My supervisees, and My Panel students. Use a consistent, concise language style across both appointment modules and all roles, while choosing clear labels for each role's actual task; identical wording across different responsibilities is not required. Use descriptions to explain ownership and scope. Replace the supervisee dropdown and automatic student selection with a searchable, paginated roster showing each student's current appointed Panel name/staff ID and nomination status. Opening a student shows their research context, appointed member, separately identified proposed member/replacement, permitted nomination action and student-specific recommendation records. Retain access to recommendations for former supervisees.

Use the shared visible Requests/History controls for request lists and Current appointments/Past appointments for confirmed records, as specified by the approved correction above. Active assignments mean the lecturer currently serves as the student's Panel member, independent of semester boundaries. Assignment history includes recorded start/end dates and ending outcome. Pending nominations never become appointments before final approval; replacements leave the current member appointed until approval, and in-progress requests prevent additional nominations. Preserve Office/coordinator navigation, existing permissions and approval/capacity rules.

## Digital Supervisor application Section A (2026-10-17, authorized)

The Research Intent requirement dated 2026-10-21 above extends this scope. Section A compatibility for older clients does not waive mandatory Research Intent on new student applications; historical stored requests remain readable.

The user requested a final critical review and immediate implementation after the reference-form audit and five critiques. This expands the historical 13 October course-code-only scope: the Student reviews system-sourced particulars, enters research details and title origin, declares completed course results or explicitly none, chooses a Supervisor, supplies existing configured private documents and confirms a declaration. Title origin records who proposed the title and does not change document requirements; Office-configured required documents apply equally to both origins. Course results are student declarations, separate from project-assessment Marks. Course codes remain manual; no course catalogue, grade scale or Dean/Office approval gate is introduced.

Resolve name/email/phone from User, ID/programme from Student, NRIC/passport/address from StudentRegistry and semester/session from the effective application semester. Missing data is shown honestly; the appointment form does not become an identity-editing route or claim a live Maya integration. New portal submissions retain server-owned particulars and declaration actor/time as part of an immutable submitted Section A. Exact authorized Student/Supervisor/Coordinator/Office views show that record; ordinary lists/exports do not gain sensitive particulars. Historical applications and older clients omitting the additive Section A contract remain explicitly legacy, without invented snapshots, results or declarations. Existing approval, lifecycle, capacity, replacements, cancellation and private-download protections remain authoritative.

Design and field-by-field scope: `docs/superpowers/specs/2026-10-17-supervisor-section-a-design.md`; implementation/verification: `docs/superpowers/plans/2026-10-17-supervisor-section-a.md`. A declaration acknowledges the authenticated submission; this does not claim that the faculty has accepted it as a replacement for its paper signature. Printing remains outside this increment.

## Connected operational periods approved and implemented (2026-10-16)

The user approved implementation of docs/superpowers/plans/2026-10-16-connected-operational-periods.md and clarified that Office should use one main extension entry point in Timeline Management. This supersedes the pending proposal below. Timeline Management configures scoped Supervisor/Panel intake periods, explicitly enables their date rules per semester/activity, links calendar events and extends normal or selected-case/task deadlines through shared controls. Existing Marks period configuration, publication rules, rubric/targeting settings and completion windows remain authoritative; existing Marks screens route deadline management into the shared hub and open the selected Marks window directly when a period is known. Closed semesters retain selected Marks recovery access without reopening calendar edits or appointment intake.

Only intake creation gains date guards; submitted requests remain reviewable under existing authority, lifecycle, capacity and conflict rules. Programme scope follows the student; cross-programme lecturer eligibility remains intact. Project stage is not inferred from calendar P1/P2 labels. Existing semesters retain disabled appointment enforcement until Office configures and explicitly enables it. Personal grants preserve expiry, renewal/supersession, revocation, ownership checks and audit history.

Timeline uploads require a non-mutating signed preview, explicit warning acknowledgement and confirmation of the same file, actor, semester and current record versions. Past informational schedules may be acknowledged; linked operational dates must match their owning same-semester periods, with no silent publication or deadline overwrite. Calendar date expiry means Ended rather than proof of completion. Opening, closing and extension reminders target outstanding authorised actions and effective personal deadlines, with deduplication, email retry and student privacy. Scheduled live delivery is a separate activation step; the installed local job currently previews only and contacts nobody.

## Historical connected-period proposal (2026-10-16, superseded by implementation above)

The user requested a plan connecting timeline periods, appointment intake, Marks periods, extensions and reminders. See docs/SEMESTER_PERIODS_IMPROVEMENT_PROPOSAL_2026-10-16.md for the proposed scope and five design challenges. Recommended direction: authoritative module periods projected into calendars/tracking; backend Supervisor/Panel intake controls; preservation of existing Marks period extensions and task completion windows; reasoned scope-wide versus selected-case extra time; non-mutating upload preview and semester/date checks; relevant, deduplicated scheduled reminders with existing privacy rules. These are proposed changes, not implemented requirements or activated policy.

## Cross-programme Supervisor and Panel eligibility verification (2026-10-16)

Students may request an eligible Supervisor across programmes, and their active primary supervisor may recommend an eligible Panel member across programmes. Lecturers have faculty-wide academic profiles rather than a restrictive programme assignment; department/specialisation text does not determine programme eligibility. Existing active-account, appointment-role separation, published semester capacity and workflow guards still apply. Final approval remains with the student's programme coordinator or an authorised acting coordinator, irrespective of the lecturer's department or other supervisees.

## Predictable Office Needs attention actions (2026-10-16)

Every row in Without supervisor and Without Panel must offer exactly one View details action, regardless of whether a request is pending. It opens a student appointment overview with current appointment state and saved research; an ongoing request has its own View request action inside. Full student-record navigation belongs inside the overview. Waiting request/recommendation rows retain View request; workload/capacity rows retain View workload. Keep these category rules identical across Supervisor and Panel. Pending requests must not imply an active appointment, and closed/other-student requests must not be presented as ongoing. Preserve permissions, filters and labelled return navigation. This supersedes earlier row-state-dependent actions in Without categories.

## Appointment table Action column alignment (2026-10-16)

In shared Supervisor and Panel browse tables, action buttons must start on the same vertical line as the Action heading. Keep the same cell padding and left alignment for the heading and actions, including nested action groups. Preserve responsive rows, navigation and decision availability.

## Office appointment detail simplification (2026-10-16)

Office Supervisor and Panel record pages must not add a separate Administrative details card beneath appointment records. Retain appointment state, authorised ending controls and lifecycle history. Removing this optional presentation must not remove stored contact, workload or Panel data from their existing owning modules.

## Consistent Office appointment Tools menus (2026-10-16)

Office Supervisor and Panel appointment Tools disclosures must share the same trigger, menu width, typography, icons, descriptions and Monitoring/Configuration grouping. Retain each module's relevant actions: Supervisor research records, workload and document requirements; Panel workload and capacity management. Preserve the existing capacity action availability. Opening/rendering the menus must not fetch full datasets or navigate.

## One appointment export format (2026-10-16)

Standardise Supervisor and Panel report downloads to real Excel (.xlsx) files, including Office/Coordinator requests, history, Needs attention, supervision lists, Panel appointment browsing, workload tools and legacy Supervisor exports. Keep filled blue/navy Export Excel buttons with white text. Preserve existing report columns, authorised data scope, active filters and every matching page. Keep numeric/boolean cell types, leading-zero identifiers, Unicode and line breaks; treat all untrusted strings as literal text. Reject incomplete page collections or Excel limit violations instead of downloading partial or truncated data. This supersedes earlier CSV/Excel distinctions within these two modules.

## Appointment list export placement (2026-10-16)

Export controls use the existing filled primary blue/navy button with white text consistently across CSV and Excel downloads.

Office and Coordinator Supervisor/Panel browse views must separate export actions from request/history or current/past navigation. Place existing exports in the filter footer opposite Clear filters. Use short Export CSV or Export Excel labels with a download icon and accessible descriptions of all-page filtered scope; omit the permanent Excel scope caption. Preserve existing export availability, file formats, columns, filtering, pagination traversal and download feedback.

## Readable research abstracts across appointments (2026-10-16)

Supervisor and Panel request details, supervisee research profiles, Student appointment overviews, Panel nomination research and saved research comparisons must use a consistent read-only abstract presentation. Use regular-weight 14px text, generous line spacing and the available content width rather than a narrow prose column within a wide tinted box. Preserve complete saved paragraphs and line breaks, wrap long terms, and avoid clipping or nested scrolling. Research facts remain distinct from the abstract; supervisee research metadata uses responsive columns above a full-width abstract. Submitted snapshots and current profiles keep their existing data sources and access rules.

## Shared appointment request design and vocabulary (2026-10-16)

Supervisor and Panel request detail pages across authorised roles share actual summary/research components, typography, responsive field grids and card padding. View student record belongs at the summary header's top right. Research has a separate card with prominent title, area, complete shaded abstract and actual supporting documents where available. Supervisor application research remains its submitted data; Panel research is labelled as the current saved profile. Nomination/replacement/decision reasons stay outside research; secondary Panel contact/department/staff facts remain available in a collapsed disclosure.

Successful requests display Approved consistently in details, tables and filters. Pending labels name the reviewer, rejected/cancelled labels name the recorded actor category, and unknown history remains explicit. Capability affects review actions rather than renaming the same status for different viewers. Timelines use Request submitted, Supervisor/Panel accepted and Coordinator approved when supported by recorded decisions; pending steps name the awaited review/approval. Remove Selected from Panel reviewer labels. Request approval stays distinct from Active/Ended appointments and their outcomes. Preserve all access, privacy, audit, lifecycle and download behaviour.

## Panel attention row action correction (2026-10-16)

The one-record-action rule also applies to Office Needs attention student rows. Show View request for an existing recommendation, otherwise View Panel record. Student dossier navigation belongs inside the authorised details page, including profiles without a nomination.

## Consistent dropdown menus across roles (2026-10-16)

All single-choice dropdowns in every role and module use the shared styled menu, including forms, filters and page-size controls. Open menus use the portal's typography, soft borders/shadows, readable spacing, hover/focus highlights and a selected-option checkmark. Preserve existing values/change handlers, disabled choices, required-field validation, form submission/reset, labels and keyboard selection. Menus must remain usable within drawers/dialogs and fit the viewport.

## Appointment table actions and badges (2026-10-15)

Panel request/history/appointment tables have one role-appropriate record action per row. View student record belongs inside the authorised record details, following the Supervisor request pattern. Supervisor tables with workflow statuses/outcomes use the same existing coloured pill presentation as Panel across Office, Lecturer, Coordinator and Student; existing stage wording and permissions remain authoritative.

## Panel consistency design approved (2026-10-15)

The user approved implementation of the reviewed Panel consistency plan. Office opens Needs attention; staff roles share record/list presentation with distinct responsibilities. Follow docs/superpowers/plans/2026-10-15-panel-appointments-consistency.md and its approved design. Implementation status and actual evidence are recorded in PROJECT_STATUS.md.

## Panel Appointments consistency requirements (2026-10-15, approved)

The user requests Supervisor-style structure, typography, spacing and reusable table/card/progress/decision components across Office Staff, Lecturer (nominating Supervisor and selected Panel) and Programme Coordinator Panel Appointments. Office must open on records needing attention. Align every permitted list/detail/history/assignment/form and workload page while retaining role-specific actions, programme/delegation access, current capacity policy, replacement continuity and Student pending-Panel privacy. Use shared renderers for common staff content. The reviewable design and role/page/action matrix are in `docs/superpowers/specs/2026-10-15-panel-appointments-consistency-design.md`; implementation and verification evidence are recorded in PROJECT_STATUS.md.

## Student research profile in both appointment overviews (2026-10-15)

Student My supervisors and Panel Appointment display the same visible Research profile section: emphasized current research title, Programme/Research area facts and a readable, regular-weight abstract. Replace the nested grey Research profile disclosure with clear spacing and the existing appointment typography. Preserve line breaks and fit narrow screens. The Panel view uses the authenticated Student's current saved research profile; without one, do not present a pending application as a saved profile. Keep pending Panel identities/contact details hidden until confirmation. This supersedes the earlier collapsed Student profile presentation; staff views and research-change workflows retain their current behavior.

## Cross-programme local test accounts (2026-10-15)

Provide the user-approved 15 fresh local test accounts across the three approved Coursework programmes (Data Science, Cyber Security and Artificial Intelligence): two Students, two Lecturers and one Programme Coordinator per programme. Each Lecturer has Supervisor and Panel profiles; programme-themed Lecturer names/departments do not introduce programme restrictions. Coordinators manage only their assigned programme without new delegations. Students start without academic applications/appointments/research/Marks records. Preserve existing accounts, passwords and academic records. Keep generated test credentials only in an ignored local file. Semester capacity publication remains an explicit Office configuration step, not an implicit effect of account creation.

## Shared decisions and user confirmations (2026-10-15, approved)

Reviewer approvals/rejections and an authorised user's own confirmations share one dialog/process across Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks and Workflow/Approval Tracking. They remain distinct: Marks submission/correction/reopening, completion windows, Timeline deletion, workflow repair, backup exception assignment and appointment ending do not acquire another reviewer. Normal drafts and ordinary add/edit forms remain direct forms. Each final dialog identifies its target and consequence, uses an explicit action label, retains existing required reasons/transfer acknowledgements, blocks duplicate submission/dismissal during saving, retains inputs on failure, and reports one confirmed outcome. Permission/conflict failures require fresh review even after closing/reopening; a committed save with a failed reload is reported as saved and cannot invite duplicate Office Marks correction/reopening. Existing role permissions, Student privacy and Supervisor-only final research decisions remain.

Coordinator Panel decisions and Panel closure require an authoritative linked Student programme that agrees with the research profile. Mismatched/unlinked records cannot grant Coordinator decisions; legitimate active official delegations still apply. Office/assigned Lecturer audit and permitted legacy monitoring remain. Programme transfers retain explicit source/destination stages. This resolves the programme mismatch found during inspection; no new approval workflow stage, capacity policy or database schema is introduced.

## Approved supervision text hierarchy across roles (2026-10-14)

The user approved restoring a clear label/value hierarchy after the preceding font-weight reduction made content too uniform. Equivalent supervision content across Student, Lecturer, Coordinator and Office Staff uses semibold muted 12px labels, regular dark 12px values/narrative, emphasized semibold 14px person names and larger semibold section headings. Lecturer/Coordinator/Office keep one shared exact-student layout; Student My supervisors adopts the same hierarchy for its own permitted content. Role-specific actions and privacy remain intact. This supersedes the preceding medium-label/regular-person-value styling.

## Supervision detail visual hierarchy correction (2026-10-14)

Staff supervision details must use matching Supervisor/Panel member headings and a consistent weight hierarchy: semibold names and section headings, medium muted labels, regular facts and research narrative. Give identity facts, member cards, actions and disclosure rows enough spacing to scan comfortably. Use the same presentation for Lecturer, Coordinator and Office Staff; action availability remains role-authorized. This corrects the preceding compact, overly bold presentation.

## Staff supervision details and Panel state (2026-10-14)

Office/Coordinator/Lecturer exact Student supervision shares a header with View student record at the upper right, visible Student email with the key facts, and a compact current Panel section alongside supervision/research information. Confirmed Panel details include name, status, department, email and appointment date. Recommend Panel is available only to an eligible current primary Supervisor without an active Panel or pending nomination; Replace Panel is a secondary action for an eligible primary Supervisor with an active Panel and no pending replacement. Pending nominations show the reviewer stage and authorized request link; pending replacements retain the current Panel until confirmation and block duplicates. Loading/unavailable data must not imply no Panel or enable recommendations. Panel links return to originating supervision details. Student pending-identity restrictions and existing academic decision rules remain unchanged.

## Student supervision overview research profile (2026-10-14)

Student My supervisors shows the current saved research profile in the same card as the current supervisory team: title stays visible, while an expandable Research profile contains programme, research area and abstract. Use current scoped profile data, not pending request snapshots; pending changes do not replace the approved profile. Existing Research changes pages/actions/history remain available. Do not invent profile data when no profile exists or expose staff nominations/evaluations.

## Lecturer dashboard assignment counts (2026-10-14)

The three Lecturer dashboard cards must use persisted counts scoped to the signed-in Lecturer. Students Under Supervision counts distinct students with active primary/supporting appointments, matching My supervisees. My Panel Assignments counts confirmed active appointments where the Lecturer is the Panel member, excluding pending recommendations and ended appointments. Assigned Marks Tasks counts the Lecturer's active evaluation assignments, including submitted work, with a separate incomplete badge and consistent Supervisor/Panel/Backup totals. Pending request/review counts remain separate badges. Loading or failed requests must not masquerade as zero; errors offer Retry and returning to the dashboard/focus reloads counts. Student/Coordinator/Office data access and workflows remain unchanged.

## Supervisor detail corrections (2026-10-14, approved feedback)

Remove visible request and appointment reference numbers and Copy reference from Supervisor detail views; IDs remain internal. Header metadata must be concise and omit unknown submitters. Audit entries use readable actions/statuses and relevant details, without raw enum codes or unrelated research transfer acknowledgements. Requested changes show Original/Requested field labels without implementation explanations or Not applied filler. Missing historical review details use one concise explanation instead of repeated actor/time placeholders or a fabricated full timeline. Office and Coordinator use one appointment-record component, and Office/Coordinator/Lecturer student supervision uses one shared layout with role-authorized actions and information. This supersedes the previous visible-reference requirement.

Primary and research-change detail cards share typography: emphasized summary facts, consistent muted labels and regular-weight research narrative. View research profile belongs at the upper right inside the research request summary header for each authorized role, wrapping within the card on narrow screens. Decision and cancellation controls remain near the approval progress.

## Shared Supervisor record details (2026-10-14, implemented)

Use consistent record detail structure across authorized primary/replacement, supporting, research/transfer and team/history views. Request metadata belongs below the page title outside the content card. Research changes compare Recorded before this request with Requested change, using immutable snapshots and actual submitter attribution. Visible approval progress summarizes recorded workflow; detailed audit remains collapsed on the same page and decision reasons remain visible. Role permissions/data visibility, current Supervisor-only research approval, primary/supporting Coordinator stages, transfer stages, legacy decisions, document access and draft/return guards remain. Shared UI is reusable for future modules; Panel remains outside this first implementation.

Confirmed and ended relationships show appointment dates/outcomes and lifecycle audit separately from request decisions. Missing historical actors, dates or stages explicitly remain Not recorded. Research and transfer headings identify the actual request kind across role hosts. Same-page presentation retains each role's permitted information and actions; Student supporting-nomination privacy remains unchanged.

## Waiting-column final outcomes (2026-10-14)

Every table with Waiting at this stage explains terminal request outcomes rather than showing a dash: approved/completed requests show Completed, cancellations show Cancelled and rejections show Rejected. Ended/withdrawn/expired records retain their corresponding labels where applicable. Ongoing requests retain current-stage calendar days (including zero); absent or invalid timing shows Not recorded. These labels describe request review, not graduation or total historical processing time. Existing status, waiting timestamps and workflow decisions remain unchanged.

## Owned-module controls and supervision exports (2026-10-14, implemented)

Remove manual Refresh controls across Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks and Workflow/Approval Tracking for every role, including secondary governed surfaces. Preserve automatic loading after navigation/filtering/saves, draft protection and error Retry; conservatively reload read-only views on return to focus. Office Tools groups described monitoring destinations separately from Document requirements configuration; Capacity reassessments remains separate. Current supervisory team lists and selected lecturer student lists export every matching record to Excel, respecting current filters and existing role scopes. Students by lecturer lists confirmed ACTIVE primary/supporting relationships; Supervisors by student shows each matched student's complete current primary/supporting team. Pending and ended appointments are excluded. Existing attention/request/history CSV exports remain contextual. This supersedes the general appointment-record export in the Office tools menu.

Lecturer-name searches must match a relationship that satisfies the semester, supervision-role, appointment-date and selected-lecturer filters. Direct student/matric/research searches retain complete teams for matching students. Removing refresh controls does not remove fresh-recipient review or closure acknowledgements: saved draft recipients load automatically and stale closure previews regenerate after conflicts before a new confirmation.

## Office Supervisor Needs attention workspace (2026-10-13, implemented)

Office Supervisor Appointments opens Needs attention, followed by Appointment requests and Supervisory teams. Identify active enabled students without an active primary supervisor (including students with no application), distinguish ongoing primary applications, monitor mixed ongoing requests by current-stage waiting and show authoritative current-semester capacity concerns. Counts keep student/request/lecturer units separate and cover all eligible records; category filters apply to the selected table. Do not invent deadlines or approval powers. Preserve capacity reassessments, existing exact records/lifecycle controls, research monitoring/history/profiles/corrections/transfers, full CSV export, workload and document requirements. Secondary tools replace the duplicate Records administration destination. Student/Lecturer/Coordinator behavior and proposed Registry transfer relocation are unchanged.

## Staff research navigation (2026-10-13, approved)

Replace the Coordinator Research changes main tab with interim Programme transfers. Its Requests and History browse only transfers; research-only saved filters cannot widen the list. Preserve source/destination Coordinator approvals and authorized exact legacy request access. Remove Office Research changes from main tabs; provide a secondary Research records tool for monitoring, request history, profiles and existing permitted corrections/transfer initiation. Student/Lecturer Research changes tabs remain. This supersedes the earlier three-section Office hierarchy; the Office Overview/attention redesign and Registry transfer relocation remain deferred. Capacity reassessments remains unchanged.

## Proposed programme-transfer ownership handoff (2026-10-13)

Recommend Student Registry as the owner/home for programme-transfer initiation, history and Coordinator review navigation. Keep primary Supervisor-only research title/abstract changes in Supervisor Appointments and retain appointment/team integration guards. This is a prepared handoff, not an implemented relocation or accepted teammate assignment; existing transfer approvals and eligibility remain unchanged. Details: docs/PROGRAMME_TRANSFER_HANDOFF_2026-10-13.md.

## Latest main integration (2026-10-13)

Integrate main while preserving the approved optional manual course codes, primary Supervisor-only research-change decisions and existing Office/Coordinator workspace behavior. Retain incoming account activation, Technical Administrator, registry import, My Records, scheduled announcements and letter export features. This integration adds no academic approval or evidence requirements; programme transfers keep their existing Coordinator review path.

## Supervisor-only research change decisions (2026-10-13)

Student research title/abstract changes require only the active primary Supervisor's final approve/reject decision. Approval immediately applies an audited profile revision, preserving the original appointment application. Programme Coordinator management alone grants no research-change decision authority or decision-queue entry. Programme transfers retain source/destination Coordinator reviews. Legacy research rows stored as PENDING_COORDINATOR await primary Supervisor review, without automatic approval or rewriting historical events. This requirement supersedes earlier two-review research-change descriptions; appointment approval is unchanged.


## Manual Supervisor application course codes (2026-10-13, approved primary scope)

Implemented after five critical review passes: an optional Student-entered Course code(s) field: free text, 255 characters, outer whitespace trimmed, no programme mapping or allowlist. Preserve existing approval and supporting-document policy; omitted/blank values and historical records remain valid. Show submitted course text in authorized exact application views and allow editable prefill for Supervisor replacements. Identity snapshots, Office notes and printing remain deferred.


## Provisional Supervisor appointment form review (2026-10-13)

The received `TD(IT):FSK29` appointment/title form is a provisional reference. User direction retains Student submission -> Supervisor review -> final Programme Coordinator review, with no Dean/Deputy Dean sign-off or extra Office approval gate. Existing approval, activation and Supervisor-to-Panel handoff requirements remain authoritative.

Revised primary proposal: a Student-entered Course code(s) text field with basic trimming/length validation and no programme mapping, catalogue or allowlist. User feedback removes separate research-title confirmation work and new proposal/results/transcript requirements; existing Supervisor acceptance, research amendments and supporting-document policy remain unchanged. Identity/contact prefill or historical snapshots, non-gating Office receipt metadata and an adapted print record are optional later suggestions. The provisional form does not introduce new mandatory data or evidence policies. This historical review entry records the provisional form analysis; the implemented primary scope is described above and does not assert approved faculty requirements. See `docs/superpowers/specs/2026-10-13-supervisor-appointment-form-review.md` and `docs/superpowers/plans/2026-10-13-supervisor-appointment-form-alignment.md`.

## Office Supervisor workspace structure (2026-10-13)

Office Staff use the same Appointment requests / Supervisory teams / Research changes hierarchy and shared filter/table wording as Coordinator. Office Requests monitor all ongoing primary/supporting stages; History holds final request outcomes. Office cannot approve Coordinator decisions. Supervisory teams groups by supervisor, carries student search into paged drilldowns and separates ended/replaced records under Past appointments with a light switch outside the card.

Routine Office appointment/research browsing is filtered, counted and paged on the server with 10/25/50-row pages, separate stage/waiting columns, visible status/date filters and aligned Clear filters. Capacity reassessments is a separate paged tool retaining Office authorise/revoke controls. Records administration retains exports, students without supervisors, workload and document requirements. Research profiles retains profile correction and programme transfer capabilities. Existing authorised lifecycle/cancellation actions, notification detail routes, source list state and Student withdrawal exclusions remain intact.

## Coordinator list simplification (2026-10-13)

Coordinator Appointment requests and Research changes Requests show only records awaiting the current Coordinator's permitted decision. Remove Needs your decision/All ongoing selectors; old saved focus values cannot broaden these lists or their Next queues. Keep status and date filters directly visible in the shared aligned filter grid, with Clear filters at the lower right. History remains final request outcomes.

Supervisory teams uses a light Current teams/Past appointments switch outside the record card, below module navigation. Past appointments means ended/replaced appointments and is distinct from request History. Current teams always groups by supervisor; no grouping dropdown. Student name/matric search finds the relevant supervisor groups and carries into View students. The card header contains only its title and brief description.

## Coordinator Supervisor workspace efficiency (2026-10-13)

Coordinator Appointment requests and Research changes retain Requests/History and default to Needs your decision, with All ongoing for tracking. Both use the same filter controls and wording, server-side search, programme/semester/type/status/date filtering, stable sorting and 10/25/50-row pagination. Ongoing date filters use submission dates; history uses the recorded outcome date. Stage and waiting days remain separate. View changes clear incompatible status/date filters.

Supervisory teams defaults to By supervisor, showing scoped primary/supporting student counts and a paged student drilldown; By student remains available. Current teams and ended/replaced Appointment history are separate views. Capacity reassessments is a secondary dedicated read-only Coordinator tool, with per-request Carryover links. Existing Office authorisation and lifecycle actions remain intact. Record pages preserve the source view, filters and pagination; Next request requires a known filtered queue position and is disabled during decision drafts or busy work. Other roles retain their existing capabilities and browse paths.

## Student withdrawal visibility (2026-10-12)

Supervisor applications and research changes cancelled by the Student are omitted from routine Lecturer, Programme Coordinator and Office lists, histories, dossiers, report counts and exports. Student own history retains withdrawn requests. Office and system cancellations remain visible; cancellation ownership is based on the cancellation event rather than the original requester. Audit rows and existing authorised detail access are retained; approved appointments and research profiles remain unaffected. Students cannot cancel panel/supporting nominations, so those workflows retain their existing visibility.

## Student research summary hierarchy (2026-10-12)

The Student research list leads its profile summary with the current research title. Existing View research profile and Request research change actions share an aligned group on wide screens and follow the title on smaller screens. Pending request guidance stays with the profile information; existing submission eligibility is unchanged.

## Panel review decision disclosure (2026-10-12)

Panel reviewers initially see neutral Accept/Reject choices. Reject reveals a required reason with Confirm rejection and Cancel; Cancel clears the rejection draft and returns to neutral choices. Acceptance has a brief confirmation without a reason. Existing role, stage and participant eligibility restrictions remain unchanged.

## Explicit panel candidate selection (2026-10-12)

Panel recommendations and replacements require an explicit candidate choice. Selection is visibly labelled separately from availability. Remove selection clears the chosen candidate and search, retains recommendation/replacement notes, and disables submission until a valid candidate is chosen again. Searching must not silently change the selected candidate.

## Main integration preservation (2026-10-12)

When integrating main, retain the FAQ chat-assistant layout, registry import/activation and read-only role controls, and letter-template validation/archive behavior alongside portal typography, RecordPage draft guards and preserved list filters.

## Student supporting appointment visibility (2026-10-12)

Students see confirmed current and former supporting appointments under My supervisors, with supervisor identity and appointment/end dates. They do not see supporting nominations, candidate justifications, staff decision reasons, workflow history or pending nomination dashboard tasks. Applications History contains only Student-submitted applications. In-app notifications alert Students when supporting appointments are confirmed or end and link to My supervisors; nomination activity remains within authorised staff workflow. Existing legacy nomination notices are excluded from Student feeds and direct read responses; legacy appointment notice bodies are sanitised.

## Office navigation feedback (2026-10-12)

Returning from an Office Supervisor appointment record uses the existing labelled Back action without a navigation-success toast. Completed actions and errors retain their feedback.

## Supervisor search verification (2026-10-12)

Office Appointment records search applies with Apply filters and matches loaded student names, matric numbers, supervisors, programmes and research titles case-insensitively with trimmed input. Research request search filters immediately within the selected ongoing/history view and student scope, and recognises displayed change types plus numeric/formatted research references as well as student identity and research title. Clearing search restores the remaining filtered records. Office Applications continues to redirect to Appointment records; the Student Applications route is unchanged.

## Supervisor hierarchy across roles (2026-10-12)

Supervisor lists share the module heading/Refresh, role navigation, relevant summaries, section heading with Requests/History where applicable, filters, responsive table and 10/25/50 pagination. Student retains My supervisors/Applications/Research changes and identifies proposed supervisors in application rows. Office uses Appointment records/Supervisory teams/Research changes. Coordinator uses Appointment requests/Supervisory teams/Research changes. Lecturer keeps its existing three tabs. Current Student supervisors remain member cards; record details retain the independent page standard.

Research requests separate ongoing records from final outcomes for every role; profile revisions remain separate. Coordinator request history includes scoped approved/rejected applications and Office cancellations through a separate read-only endpoint, without changing approved appointment records. Preserve all existing permissions, lifecycle controls, supporting nominations, administrative filters, exports, workload, requirements, carryover actions and notification links. Students see only confirmed current/former supporting appointments in My supervisors; supporting nominations remain within staff workflow, as specified above.

Design: docs/superpowers/specs/2026-10-12-supervisor-role-hierarchy.md.

This shared hierarchy supersedes older role-specific embedded-list presentation descriptions below. Existing workflow and capability requirements remain authoritative.

## Global navigation coverage (2026-10-11)

The approved record/list/brief-modal/contextual-inline standard applies to all active modules and supported roles. Coordinator and staff notification, report and dashboard action targets must resolve the selected authorised record. Lists retain their UI controls when returning from records or dossiers; drafts and in-flight saves on dedicated forms are protected. Successful local research creation returns to the list without a stale discard warning, while failed creation retains the form. Announcement creation/editing has Announcements as its owning list; saved draft actions remain available. Authentication keeps its own shell and uses shared brief guidance dialogs.

The active-module inventory and intentional contextual exceptions are recorded in docs/superpowers/specs/2026-10-11-global-navigation-audit.md. This requirement does not change workflow permissions or turn every inline setting/preview into a full page.


## Record navigation consistency (2026-10-11)

- Substantial records, reviews, comparisons and forms use an independent main-content page with one labelled Back link above its record/form heading. The originating module heading, tab bar, summary and filters appear on lists only. Use existing portal typography; no breadcrumbs.
- Review/View share a detail layout and retain API-authorised actions, documents and recorded progress. Return preserves the originating list context; existing notification/deep links remain supported. Local editors keep their owning workspace mounted but inaccessible while open and use a transient history entry without storing record payloads.
- Brief previews/confirmations use the shared accessible modal. Changed drafts require discard confirmation; in-flight mutations prevent navigation. Header refresh actions are unavailable while a draft or mutation is active. Successful saves may return immediately without a discard prompt. This policy supersedes older requirements prescribing drawers/modals for full record review and large forms. See docs/superpowers/specs/2026-10-11-record-navigation-design.md for migration scope.

## Lecturer record lists (2026-10-11)

- All three record tables use the portal's existing table typography and shared data-table/data-th/data-td/data-td-strong styles; no separate font-size, weight or heading casing rules are introduced.

- Supersedes the summary-card list presentation below: Appointment requests and Research changes use aligned desktop tables with Student, Request type, Submitted, Current stage, Waiting at this stage and Action columns. Waiting time is recorded calendar days at the current stage; final outcomes display a dash and unavailable waiting data displays Not recorded.
- My supervisees uses the same responsive table presentation with Student, Programme, Your role and Action. The role is determined from the signed-in lecturer's recorded active team membership, independently of decision/nomination capabilities. Research titles remain searchable and available in supervision details.
- Narrow screens show stacked records with explicit field labels and one action per record. Request lists omit programme names and request references; these remain available in details with a Copy reference action. Appointment references remain searchable.
- All three lists offer 10, 25 or 50 rows per page, defaulting to 10 and returning to the first page when the size changes. Appointment/research page sizes persist with their existing URL filter context. Existing workflow grouping, filters and authorised actions remain intact. This change does not introduce server-side pagination or change API permissions.

## Lecturer workspace presentation consistency (2026-10-11)

- Appointment requests, My supervisees and Research changes share one page-level Refresh action. Requests/History switches sit beside the section title and description; all filters share one bar below that header.
- Summary cards lead with the student name and matric/programme details, followed by the request type, submitted date/reference and recorded status/age where relevant. Actions align on the right and wrap on narrow screens. Use Review request for authorised decisions, View request for tracking/history, and View supervision for supervisees.
- Use consistent Malaysia dates, calendar-day waiting wording, Recorded progress headings, profile links and confirmation controls. All three lists use ten records per page with the same pagination layout. Domain-specific actions and permissions remain intact.

## Lecturer request workspace restructuring (2026-10-11)

- Lecturer Supervisor navigation uses Appointment requests, My supervisees and Research changes. Appointment requests combines primary and supporting records in one searchable list with type, actual-status, semester/date filters and local Requests/History views. Research changes has its own independent Requests/History views and student/search filters.
- Requests retains all ongoing records, grouped by Needs your review, Awaiting Coordinator approval and other ongoing work. Only permitted decisions count toward review badges; cancel-only nominations and ineligible participants do not inflate them. Staff History contains final approved/rejected outcomes and non-Student cancellations; Student own History retains their withdrawals. Supporting appointment endings/replacements remain a separately identified activity section.
- Lecturer acceptance/endorsement is distinct from final approval. Lecturers can follow their authorised requests while Coordinator approval is pending, with recorded stages, dates, reasons and informational calendar-day waiting ages. No estimates, progress percentages or additional approval authority are introduced.
- Both appointment types open review panels with their existing permitted actions, documents and audit information. Lecturer research/supervision details retain dedicated routes, a stable module heading and contextual Back below module navigation. This supersedes the older Lecturer Back-above-navigation requirement; Student and embedded Office/Coordinator conventions remain unchanged.
- View, search, filters, pagination and research student selection survive detail/return navigation and reload through URL state. Current research profiles and saved revisions remain separate from request outcome history.

## Separate Supervisor workspace pages (2026-10-10)

- Student Supervisor navigation separates My supervisors, Applications and Research changes; pending applications are separate from completed history. The overview retains current members, a compact pending-request status and useful visible guidance.
- Lecturer navigation separates Requests, My supervisees and Research changes. Individual supervision details retain team actions/history; request queues retain primary/supporting reviews and reviewed history.
- Research lists open individual request comparisons/audit details. Current profile and change form have dedicated views. Preserve permissions, cancellation/review/replacement actions and existing Office/Coordinator behavior.
- Staff dossier links read View student record; Student My Academic Record remains a read-only consolidated record with no evaluations. Page-level navigation supports direct links, refresh and browser Back.
- Nested workspace pages have one page heading and one parent Back action above the module navigation. History and research detail/profile/form views must not repeat full page headers beneath that navigation.
- Supervisor Request History omits generic policy and assistance cards; it retains request records, filters, pagination, details and supporting appointment history.

## Recognisable report filters and useful Lecturer reporting (2026-10-10)

- Lecturer breakdowns label the total as Records involving you and explain its authorised record types, shared Lecturer milestones and record-versus-student counting. Office/Coordinator wording and backend scope remain unchanged.
- Reports use shared visible form controls, a labelled filter toolbar, explicit Apply filters/Reset filters actions, the applied semester/date/programme scope and a notice when draft changes have not been applied. Downloads use applied filters and are unavailable while report results load or fail.
- Lecturer reports prioritise waiting records and assigned evaluation work with navigation to the existing records/Marks workspace. Waiting counts include other reviewers and must not be labelled as requests requiring the Lecturer's own approval. Preserve the original statistics, lifecycle/waiting distributions and export behind an optional Lecturer breakdown section. Office/Coordinator summary statistics retain their reporting purpose.
- Capacity, participant-lifecycle and reconciliation controls reuse the same shared form-control styles; remove undefined form-input usage without changing their workflows or permissions.
- Pending authorised research amendments appear in the report attention list as well as the waiting count, with the same scoping and filters in JSON and XLSX exports.

## Immediate cancellation audit visibility (2026-10-10)

- A successful Supervisor cancellation response must include the newly persisted cancellation audit entry with actor, timestamp, reason and status transition. The Student drawer must receive the complete history immediately without requiring a page reload.
- The shared Supervisor/Panel audit writer must invalidate previously prefetched history on its owning record; persisted events, historical records and role permissions remain unchanged.

## Student Supervisor application clarity and concurrent submission (2026-10-10)

- The three application sections are available together. Their numbered navigation links use equal styling and jump to the matching section rather than implying a first-step-only wizard.
- Supervisor selection exposes an explicit Selected marker, pressed state and selected-person summary. Students can toggle the candidate off or clear selection, including when search hides the selected row. Backend candidate selectability remains authoritative.
- The new-application form uses the same visible Appointment guidance layout as the appointment overview, with only relevant pending-request and approval/replacement rules. Content may differ before submission; repeated generic help and prerequisites cards are removed.
- A Student may have only one pending primary Supervisor application and one active primary Supervisor appointment. Same-form repeat submission is blocked while a request is in flight; simultaneous server submissions return one creation and a controlled duplicate rejection. Historical applications and normal replacements remain supported. Submission does not promise replay of the original response through an idempotency key.

## Shared toast clarity and validation feedback (2026-10-10)

- Shared portal notifications use one clearly identifiable dismiss button. Error status uses an exclamation icon, while success, warning and information retain distinct status icons; status icons must not resemble a second close control.
- Notifications use solid white surfaces, restrained borders/shadows, shared supporting-text typography, keyboard-visible dismissal focus and viewport-constrained wrapping. Errors announce as alerts; other notifications announce as status updates.
- Student Supervisor application validation remains in the shared toast. Dismissed or expired errors can appear again on a later attempt, and replacing a notification restarts its dismissal timer without an earlier timer hiding the newer message. Preserve existing validation, document limits and submission authority.

## Lecturer supervisory team card contents (2026-10-10)

- Expanded Lecturer teams use the same primary/supporting supervisor presentation as Student cards. The default view contains current supervisors, relevant management actions and current research title; programme, enrolment status, area and abstract belong to the expandable research profile.
- Supporting appointment histories remain accessible with capability-gated actions. Appointment activity opens directly as dated rows with status badges, without nested history/timeline disclosures. Application rows represent latest recorded statuses; supporting rows represent audit events.
- Office-managed semester dates are separated from appointment activity and identified as a shared semester schedule. Completed/active/upcoming schedule statuses must not imply measured individual research progress. Preserve existing records, staff access and Student evaluation restrictions.

## Lecturer appointment consistency and sequence (2026-10-10)

- Extend Student section, summary, member-card typography, spacing and visible useful guidance to Lecturer Supervisor and Panel pages. Keep Lecturer review authority, multi-student selection and all recorded histories; Student evaluation restrictions remain intact.
- Supervisor list order: workload summary, pending requests, active supervisees, research change requests, supervisory teams and guidance. Panel list order: workload/review summary, selected Panel review queue, nominations for supervisees, Panel assignments and guidance. Remove repeated selection cards and filler placeholders; searches filter the actual rosters.
- Lecturer research requests show changed fields and full reasons/approval history on demand, with eligible decisions retained. Initial profiles display recorded fields once; later revisions compare changed fields. Current active-supervisee research information follows the linked current profile, while historical requests retain submitted values.
- Guidance stays visible and explains only consequential module rules: supervision handover/research endorsement and Panel eligibility/replacement. Existing candidate eligibility, workload checks, replacement reasons, primary/supporting permissions and Coordinator final approval remain authoritative.

## Student research profile history presentation (2026-10-10)

- Student initial research history displays the original programme, title and abstract once, without empty previous-value comparison boxes. Later revisions compare only changed fields. Initial and revision cards share header typography, spacing and field styling; stored attribution, dates and reasons remain visible. Staff comparisons and workflow permissions remain unchanged.

## Student appointment consistency and useful guidance (2026-10-10)

- Student Supervisor and Panel pages share section/card spacing, member-name typography, status badges, refresh controls, page-header treatment and a visible-by-default Appointment guidance section.
- Guidance contains only actionable, module-specific information: configured Supervisor document labels and upload limits, incumbent/replacement rules when a supervisor is assigned, and the appropriate next step or replacement route for each public Panel readiness state. Remove generic process/turnaround, repeated confirmation and large help cards; retain the FAQ action without its own filler card.
- Panel member identity, contact details, department and appointment date remain hidden until both public status and readiness state indicate confirmation. Supervisor/research/history features and staff workflows are preserved. This change is scoped to the two Student pages; it does not invent Student Panel histories or expose evaluation data.

## Student Supervisor page structure (2026-10-10)

- The Student Supervisor page presents My supervisors, Research change requests and Previous applications. Students automatically view their own scoped record; pending requests must never expose a Student selector.
- Research requests initially show the changed field type, recorded stage and submission date. View details reveals only changed fields, the full reason and recorded approval events; eligible cancellation and research submission remain available. Research profile and supporting appointment histories remain accessible on demand.
- Academic semester milestones stay on the Dashboard and My Academic Record. Current research information comes from the research profile, while previous applications keep their historical submitted titles. Student views exclude staff approval controls and transfer evaluation-task notes; existing staff workflows are preserved.

## All-role typography coverage (2026-10-10)

- Typography consistency applies to every Student, Lecturer, Programme Coordinator and Office Staff/Admin module, including populated tables, nested cards, form labels/values, drawers, expanded histories, error/loading states and shared authentication/shell components.
- Table cells use the existing 12 px/600 role or 12 px/700 emphasized role; local conflicting sizes/weights must not override these roles. Equivalent summary counts use 24 px/800. Ordinary card and control text must not inherit unintended mono, italic, uppercase or tracking styles.
- Verification must distinguish source review from rendered populated, empty and error-state checks. Preserve deliberate document, identifier, badge, action and rich-text formatting roles.

## Student evaluation visibility boundary (2026-10-09)

- Students view evaluations and results through the university's central system, outside this portal. Student-facing screens and API responses must not expose evaluation tasks, periods, deadlines, submission status, completion rates, scores or comments.
- The Student academic record contains Supervision, Panel and Milestones only. Its dossier must exclude MARKS from visible sections, return null Marks data/status and omit Marks attention items. Office Staff/Admin and assigned Lecturer Marks access remains subject to existing authorization; Programme Coordinators retain their current restricted dossier sections.
- This user-confirmed scope supersedes the older student Marks/evaluation wording in Functional Requirements FR-14/FR-30 and Use Cases UC06/UC14. The reference PDFs remain unchanged pending revision from editable academic sources. Do not add a central-system link or integration without its authoritative URL/interface.

## Portal typography consistency (2026-10-09)

- Populated records, comparison fields, collapsible summaries, expanded histories and decision forms must follow the same typography roles as empty/summary views. Verification must inspect inherited parent styles and nested labels, not only explicit paragraph classes.
- Equivalent card/section headings and supporting paragraphs across student and staff modules must use the shared typography roles. Compact section headings use 14 px/800; larger section headings retain 18 px/800; card labels use 12 px/600, values 12 px/700 and supporting text 12 px/500. Summary metrics retain a distinct 24 px/800 role and compact secondary captions use 10 px/500.
- Ordinary explanatory text must not switch to monospace or inconsistent 10–11.5 px bold treatments. Identifiers, tabular metadata, badges, navigation, form controls and official document previews retain their appropriate distinct treatments.
- The Inter font request must include all requested UI weights, including 900 for existing black-weight emphasis. Typography corrections must preserve all workflow data, controls, authorization, validation and document output.

## Student academic record clarity (2026-10-09)

- Student Dashboard remains the starting point for current appointment summaries, upcoming deadlines and required actions. Its record link is labelled "View My Academic Record".
- Student self-view at `/dashboard/progress` is labelled "My Academic Record" and opens on the first authorised history section, without duplicating the Dashboard's overview, attention count or summary cards. Supervision, Panel and Milestones retain the existing authorised history and status data; staff dossiers retain their operational Overview and authorised Marks sections.
- Student enrolment metadata is labelled "Enrolment Status" and appears compactly in the identity card. "Status changed on" appears only when a persisted change date exists, in Malaysia time. Private actor, reason and audit metadata remain limited to internal dossiers.
- Student cards and record metadata use the existing Inter family with shared heading, label, value and supporting-text styles. UI wording changes do not introduce course registration, credit tracking or general coursework results.

## Participant lifecycle acceptance corrections (2026-10-08)

- The participant lifecycle workspace must hide stale records and mutation controls during refresh or detail loading and after read failure. Only the latest list/detail request may update the displayed participant; an in-flight mutation prevents competing selection, filter and form actions.
- Office Supervisor and Panel records must label Office-cancelled requests as Cancelled and ended appointments as Ended. Cancellation labels must not attribute an Office action to a Student or Supervisor. Assigned Lecturer review history must retain Office cancellations even when no Lecturer decision preceded them.
- Progress dossiers render academic lifecycle status and its effective date in Malaysia time. Internal views render the persisted reason, actor and immutable lifecycle history; Student self-view shows only public status and effective date, even if private metadata is mistakenly included in a supplied frontend object.

## Submitted Marks portal actions (2026-10-07)

- Authorized Office Staff/Admin correct submitted component scores and overall comments, or reopen a submission for its assigned Lecturer, from the existing Marks record detail screen. The Office role, staff status and existing `marks.change_markentry` permission are required; other actors and inspection-only Office accounts receive no editing controls.
- Correction and reopening require a reason and the reviewed record version. Scores must be finite, nonnegative, within the persisted component maximum and limited to two decimal places. Unknown/duplicate components, forged fields, unchanged corrections and stale/replayed requests must leave Marks and audits unchanged.
- Reopening is a separate operation permitted only while the evaluation period and semester accept ordinary submissions. It preserves component scores/comments, returns the entry to Draft and records its audit. A completion window does not permit reopening submitted Marks after closure. Reasoned correction retains the existing submitted status/date/deadline snapshot and remains available after period closure under the existing policy.
- Every successful operation uses the existing transactional workflow service and records actor, reason, timestamp and before/after values. The portal refreshes the record and displays those values in correction history; failures must not show success or retain stale editing authority.
- Django admin exposes Mark Entries and component scores for inspection only, including for superusers. Correction/reopening, ordinary model saves, inline editing and deletion cannot provide a second mutation path.

## Advanced Marks acceptance correction (2026-10-07)

- Marks backup student selection must follow the selected period's programme scope without excluding current-period tasks whose research profiles retain an earlier semester. Assignment options must use authoritative linked Student programme data, including blanks, and fall back to the profile programme only for unlinked legacy profiles. Changing the backup period clears the selected student and original task.
- Office Marks monitoring must label the semester scope of its operational totals accurately. Totals across multiple semesters must not be described as belonging to the first record's semester or one active period; paused/retired records remain excluded.

## Appointment failure-path acceptance correction (2026-10-07)

- The Office Panel Appointment Management workload snapshot uses the backend capacity state when supplied, including temporary unavailability and ineligibility, rather than inferring availability only from occupied seats. A temporarily unavailable member may show the public end date; internal availability reasons remain confined to the authorized Office capacity workspace.

## Replacement acceptance corrections (2026-10-07)

- Student Dashboard appointment cards use persisted Supervisor applications and the public student Panel view. They retain the active incumbent during replacement review, show the successor after final approval, release the Panel identity only when confirmed, and hide appointment cards during loading or retryable read errors.
- Distinct Panel recommendation attempts remain visible in authorised staff history even when the student, candidate, displayed date and status match. Deduplication uses persisted recommendation identity, with record identity as the legacy fallback. Student academic records expose confirmed appointments only, as specified above.
- Marks submission monitoring excludes paused and retired tasks from completion denominators, follow-up counts, previews and recent activity. Authorized history retains their original draft values and handover audits.

## Owned-workflow Django admin acceptance (2026-10-06)

Direction agreed on 8 October: routine Office users should perform their work in the main portal; Django admin should be restricted to designated technical administrators for occasional maintenance/investigation. Business authorization must be separated from admin-site eligibility across the five owned modules and their dependencies, retaining required role, action permissions, scope, validation and audits. This separation is pending implementation. The technical account rule and retained maintenance edits require the scoped design review recorded as T01-T06 in [the pending-work register](docs/PENDING_WORK_REGISTER_2026-10-08.md); a generic portal permission editor and teammate-owned Registry integration are not silently added to this scope.

- Django admin must expose governed semester, capacity, availability, rubric, evaluation-period, evaluation-task and audit records for inspection without add/change/delete or bulk-delete bypasses. Their mutations remain in the existing audited portal workflows.
- Submitted Mark Entry correction/reopening now uses the authorized Office portal and existing services; Mark Entry admin is inspection-only. Draft editing remains in the assigned Lecturer workflow; entries and correction audits cannot be deleted through admin.
- Submitted Marks portal corrections reject negative/non-finite/over-maximum scores, unknown components and closed-period reopening with validation responses and no partial changes or new correction audits. Admin mutation attempts are denied. Valid portal correction retains submission locking and recalculates the total; valid reopening requires the period still to accept submissions. An audited correction remains permitted after closure.
- Acceptance evidence must distinguish automated HTTP checks, browser checks and requirements still awaiting acceptance. Scope remains the five owned modules; production hosting checks, faculty confirmation and coordinator identity policy are separate.

## Whole-system manual acceptance coverage (2026-10-06)

- The testing handoff covers every sidebar module plus authentication, settings, academic/configuration lifecycle, reporting, delegation, research amendments, supporting supervision, replacement and late-completion branches.
- Live persistence, local prototypes and missing backend integrations must be identified explicitly; a prototype interaction must not count as full end-to-end acceptance. Test actor/scope prerequisites and current database state must be recorded without committing credentials.

## Full workflow acceptance corrections (2026-10-06)

- A first Panel nomination must omit an absent replacement reason; genuine replacement nominations still require the validated reason.
- Coordinator decisions must refresh their pending queue, appointment history and supervisory teams. Semester lifecycle changes must refresh the selected semester's audit history, with failed reads shown as retryable errors.
- Appointment timestamp dates and semester audit times use Asia/Kuala_Lumpur, consistently with the faculty's existing Malaysia deadlines. Date-only appointment values retain their calendar date.
- Verify the owned Student request → Supervisor acceptance → Coordinator approval → Panel appointment → both Marks submissions → semester closure workflow with synthetic, isolated data and persisted audit assertions.

## Shared production authentication cache (2026-10-04)

- All API workers must share authentication throttle history through the same PostgreSQL database cache. Production startup rejects process-local or unsupported cache configuration; local single-process development retains its existing default.
- Cache-table provisioning and cross-worker verification are deployment gates. Shared history does not promise exact limits for simultaneous requests; the existing DRF throttles remain approximate under concurrency.

## Timeline acceptance corrections (2026-10-05)

- Office Timeline Management must show the selected semester consistently in its summary, calendar, entries and audit history. Loading or failed selections must suppress previously loaded records; Retry must recover both initial semester-list failures and selected Timeline failures.
- Django admin may inspect Timeline headers, inline entries and audit logs. Add, edit, delete and bulk-delete actions must be unavailable there, preserving the validated and audited Office workflow.

## Owned-module integrity corrections (2026-10-03)

- A lecturer cannot hold an active or pending primary Supervisor and Panel role for the same student. Submission and final approval must recheck both directions, including replacements and retained/unlinked matric-number profiles; rejection preserves existing appointments and history.
- Add Timeline Entry accepts the Office form's selected `semesterId`. The backend resolves the timeline and permits changes only for Draft or Active semesters; status, ordering and timeline identifiers remain system-derived.
- Django admin provides inspection of governed appointment requests, appointments, document requirements and audit history. Academic/configuration writes use the existing audited workflows. Initial research-profile provisioning remains supported; audited Marks correction/reopening uses the Office portal.
- Marks scores must be nonnegative and within the component maximum. Invalid drafts return validation errors without changing persisted scores, comments or submission state.
- Lecturer task semesters come from each evaluation period, including historical assignments after profile handover. Semester filter options come from returned assignments rather than fixed academic-year labels.

## Account Settings Persistence (2026-10-01)

- Authenticated users can update their own phone number and nonurgent in-app announcement preference. Email remains Office-managed; self-service Settings cannot change account identity, role, programme or another user's data.
- Password changes require the current password and the configured Django password validation rules. Successful changes end existing access/refresh sessions and require sign-in again; passwords retain intentional whitespace.
- Announcement preferences apply to future nonurgent announcement notifications. Urgent announcements, academic workflow notifications, existing notification history and authorized attachment access remain available. Email notifications, scheduled deadline reminders and weekly digests remain unavailable and must not appear to be configurable working services.
- Settings must load persisted values, expose loading/failure states, prevent duplicate saves, and report success only after the backend accepts a write. A delayed request from an older login must not terminate a newer session.

## Release preparation (2026-09-29)

- Complete regression verification and isolated role-based acceptance before releasing the acting-coordinator, Marks completion-window and research-amendment changes.
- Verify database backup restoration without changing working academic records. Prepare deployment, private-media backup, rollback and faculty acceptance instructions while hosting remains undecided.
- Research workflow actions must display readable programme, source and destination coordinator stage labels.

## Audited Research Amendments and Programme Transfers (2026-09-26)

- Students request substantive title/abstract changes through primary-supervisor endorsement and coordinator approval. Office may apply minor corrections with a reason and an explicit declaration that research meaning is unchanged.
- Office initiates programme transfers through source-coordinator endorsement and destination-coordinator approval. Both explicitly review retention of the current supervisory team and Panel. Transfers atomically update Student and research-profile programmes without changing appointments, workload, existing Marks, drafts or completion windows.
- One amendment may be pending per student. Transfers require resolved appointment nominations and block new nominations while pending. Proposals are immutable; corrections require cancellation and a new request. Decisions recheck eligibility, current authority, profile revision and the reviewed team.
- Immutable before/after revisions and decision history preserve original applications. Primary handover cancels pending research requests; graduation/withdrawal cancel pending amendments. Deferred students cannot receive decisions. Unlinked legacy profiles remain outside this workflow.
- Existing screens and tracking expose scoped amendment history, stages and outcomes without granting supporting supervisors administrative-note access. Academic decisions are never automatically repaired by reconciliation.
- Supervisor handover preserves recorded research baselines and approved revisions; replacement application wording cannot silently rewrite recorded research history.

## Task-Specific Marks Completion Windows (2026-09-22)

- Office may grant selected existing, active, unsubmitted and eligible evaluation tasks an immediate, reasoned completion deadline, either extending a Published period's effective deadline or allowing recovery after period/semester closure. Supervisor, Panel and existing Backup tasks are supported; windows create no assignments and never reopen submitted Marks.
- Draft or unopened periods, archived periods/semesters, paused/retired tasks and ineligible participants or required appointments cannot receive effective windows. Expiry and reasoned revocation remove exceptional access while ordinary submission rules remain available where applicable.
- Windows retain immutable grant, replacement and revocation history, survive semester handover, and never transfer to a replacement evaluator. Task pause or retirement permanently ends their authority. Submission preserves the deadline and window used.
- Office previews unfinished work before period closure, semester closure or handover and acknowledges it using a current server-issued preview token. Archived records remain locked; active windows on unfinished tasks block archival.
- Existing screens, Dashboard actions/counts, reports/exports, dossiers and reconciliation share task-level deadline rules without expanding role-based access. Otherwise eligible closed-period work remains available for an Office recovery decision instead of automatic retirement solely due to closure.
- Existing assigned tasks retain their ordinary open-period submission access; exceptional completion grants additionally require the current eligible appointment. Published periods without a finite deadline do not need an individual extension. Submitted results retain the deadline used even if it was unlimited.
- When granting selected-task completion windows, Office can search eligible tasks in a compact table and page through 10 results at a time. Selection persists while searching and paging, and the interface shows the selected count before saving.

## Temporary Acting-Coordinator Delegation (2026-09-20)

- Office may grant an active existing Coordinator account temporary full coordinator access to an additional recognised programme. Its regular coordinator retains authority. Only one non-revoked acting assignment may overlap a programme's inclusive Malaysia start/end dates, including concurrent requests.
- Grants require justification and a start date today or later; grant fields are immutable. Corrections require reasoned revocation and a new grant. A coordinator may cover multiple additional programmes, but cannot be delegated their own regular programme.
- Active grants cover existing pending Supervisor, Panel, and co-supervisor requests and the same programme-scoped lifecycle, Dashboard, dossier, report/export and notification access. Programme records stay in place and historical decision actors remain unchanged. Every request rechecks effective authority; final decisions serialize against revocation.
- Expiry and revocation remove delegated record access without a background job. Office retains all delegation history; recipients retain their own assignment history. Active and future grants block retirement until revoked, and inactive accounts never retain effective delegated access.
- Delegations belong to programmes and survive regular-coordinator changes until expiry or revocation. Permanent coordinator replacement, Lecturer-account access, identity linking and new self-approval policies remain deferred.

## Programme-Scoped Evaluation Periods (2026-09-16)

- Office configures each Marks period for all programmes or selected programmes, and Supervisor, Panel, or both official evaluator roles. Selected scope requires at least one nonblank programme and every period requires at least one official role. One rubric remains attached to each period; co-supervisors never receive official evaluator tasks through their supporting role.
- Programme matching trims whitespace and ignores case. Linked Student programme data is authoritative, including a blank value; only unlinked legacy profiles use their stored programme. Existing periods and API requests omitting targeting retain all programmes and both roles.
- Targeting is editable only in Draft and appears in configuration audits. Office reviews a refreshed, read-only recipient preview before UI publication, including current student/evaluator pairs, new/existing task counts, and missing eligible appointments. Empty periods may be published with a warning. Preview is an estimate; later eligible appointments receive tasks through existing generation triggers.
- Preview, generation, and missing-task reconciliation use the same official-role selection. New task creation rechecks eligibility under transaction locks. Programme changes preserve existing tasks and Marks history but govern new assignments, including replacement tasks.
- Manual backup assignments must stay within the period's programme scope. A linked original task must belong to the same period and student and use an included official role; standalone backups retain existing reasoned audit behavior within scope.
- The Office backup-assignment form provides server-searched student and lecturer selectors, returning at most 50 matches with the total count and prompting users to refine broad searches. Student matches are restricted to the selected period's programme scope. After choosing a student, Office can optionally link the backup to that student's official Supervisor or Panel task; an unlinked backup remains a general exception assignment.
- Individual rosters, cohorts/stages, separate role rubrics, and coordinator-role redesign remain outside this slice.

## Student Panel Privacy in Supervisory Teams (2026-09-15)

- Student team detail, workspace, and embedded dossier timelines expose only the current public Panel state. Pending recommendations show `FACULTY_PROCESSING` without recommendation identifiers or internal timestamps; confirmed active appointments show `CONFIRMED` and the public appointment date.
- A confirmed active appointment takes precedence while a replacement is pending. With no active appointment or pending recommendation, the team timeline omits the Panel entry; rejected, cancelled, and ended attempts do not create student team history entries.
- The public timeline uses a stable key unrelated to internal records. Existing staff visibility, team authorization, and standalone Panel/dossier history policies remain unchanged.

## Product Scope

The application is **A Web-Based Postgraduate Administrative Workflow, Appointment, and Project Evaluation Management System for FSKTM Coursework Programmes**.

The owned product boundary covers Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks, and Workflow/Approval Tracking. Measurable outputs are persisted role-scoped workflow status; elapsed waiting duration and responsible stage; authoritative deadlines and Marks completion; immutable decision, appointment, and participant lifecycle audits; lifecycle eligibility enforcement; and role-scoped analytics and exports. Course registration, enrolment, credit accumulation, course scheduling, and general coursework results are explicitly outside this boundary.

The five owned completion modules are Dashboard/Timeline, Supervisor Appointment, Panel Appointment, Marks Entry, and Workflow and Approval Tracking. Notifications/Announcements is a separate integration module owned outside this slice; these workflows may expose audit and routing metadata for it, but this module does not own notification-center behavior.

## Programme Scope

- The system programme list is limited to `MASTER OF DATA SCIENCE (COURSEWORK)`, `MASTER OF CYBER SECURITY (COURSEWORK)`, and `MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)`.

## Repository Organization Requirements

- The backend security baseline requires Django `>=5.2.17,<5.3`, Django REST framework `>=3.17.2,<3.18`, and sqlparse `>=0.6.0,<0.7`. Environment setup must upgrade pip to `>=26.2,<27`; frontend installations must use the reviewed lockfile and the existing Node.js `>=22.22.0` requirement.
- The project root must remain the workspace entry point.
- `PROJECT_REQUIREMENTS.md`, `ARCHITECTURE_AND_CODING_DESIGN.md`, and `PROJECT_STATUS.md` must stay at the project root.
- Frontend source, configuration, package files, and frontend runtime assets must live under `frontend/`.
- Frontend environment examples must include only public `VITE_` variables; a frontend `.env` file is optional unless local overrides are needed.
- Django backend source, configuration, requirements, and backend environment example files must live under `backend/`.
- Supporting PDFs, setup notes, specs, plans, and reference material must live under `docs/`.
- Generated local artifacts such as `node_modules`, `dist`, `.venv`, logs, and local `.env` files must be ignored and kept out of source-controlled project structure.

## Main Roles

- Office Staff/Admin
- Student
- Lecturer, including supervisor and panel responsibilities
- Programme Coordinator, as a separate authenticated role for panel appointment confirmation

## Current Frontend Scope

- Office staff/admin portal shell with authentication demo state.
- Sidebar navigation for dashboard overview, supervisor appointments, panel appointments, marks entry, and related administrative modules.
- Dashboard overview for office staff to monitor postgraduate administrative status, semester timeline, workload-related attention records, and quick module navigation.
- Registry management UI for student records and staff/lecturer account management.
- File management UI for repository browsing, document preview, upload flow, metadata, and document status handling.
- FAQ chatbot administration UI for maintaining academic FAQ entries.
- Letter generation UI for managing letter templates and template editing workflows.
- Announcement management UI for composing, filtering, and managing announcements.
- Notification center UI for office staff alerts and announcements.
- Forgot-password UI for unauthenticated account recovery guidance.
- Clean URL routing for authenticated portal modules and selected workflow detail links, so refresh, bookmarks, browser history, and notification deep links preserve the intended screen.
- Routed page transitions must reset the window scroll position to the top while keeping hash-only navigation available for future anchor behavior.
- Production builds must keep authenticated route-level module screens code-split and shared vendors chunked so Vite does not emit its default oversized JavaScript chunk warning.
- Marks and evaluation management UI for mark entry period configuration, rubric management, evaluation task assignment, submission monitoring, and mark records.
- Supervisor and panel appointment management UI for appointment status and workload monitoring.
- Lecturer workspace UI for supervisor appointment requests, active supervisees, panel assignment details, recommendation submission, assigned mark-entry tasks, mark-entry forms, and submitted-mark review.
- Student workspace UI for FAQ support, supervisor appointment viewing/application, panel appointment viewing, file submission, letter generation, and student dashboard shortcuts.
- Panel appointment records must appear directly below the search/filter controls on desktop layouts, with attention and workload widgets remaining in the right-side column.
- Panel appointment records should fit the desktop records card without requiring a horizontal scrollbar by using a wider records column, fixed table layout, and wrapped cell content.
- Office Staff/Admin Panel Appointment Management must load monitoring records from the persisted appointments backend when panel backend mode is enabled.
- Office Staff/Admin Panel Appointment records must be available only to Office Staff/Admin users; other authenticated roles must receive a forbidden response from the backend monitoring endpoint.
- Office Staff/Admin Panel Appointment summary cards must be calculated from the loaded panel records instead of hardcoded mock counts.
- Office Staff/Admin Panel Appointment records must include confirmed appointed panels, in-progress recommendations, rejected recommendations, cancelled recommendations, and eligible student research profiles with no panel workflow yet.
- Office Staff/Admin Panel Appointment records must preserve each historical recommendation attempt, so an earlier rejected recommendation remains visible as a separate record after a later recommendation is approved; the approved recommendation and its resulting appointment must not appear as duplicate rows.
- Office Staff/Admin Panel Appointment records must retain the recommended panel member, rejection stage, rejection reason, and available workflow timestamps for rejected attempts.
- Office Staff/Admin Panel Appointment records must treat cancelled supervisor recommendations as a separate visible lifecycle state with stable record IDs, cancellation reason, cancellation timestamp, recommendation ID, and workflow audit history.
- Office Staff/Admin Panel Appointment Records must paginate the filtered historical dataset at 10 records per page while summary cards and CSV export continue to use all matching records.
- Office Staff/Admin Panel Appointment status tabs must represent persisted lifecycle states only: All Records, No Panel, Pending, Approved, Rejected, and Cancelled. Workload alerts must remain in the dedicated workload monitoring surface.
- Office Staff/Admin Panel Appointment Detail must render selected backend panel record fields rather than screenshot/demo placeholders, show the academic year as `Session YYYY/YYYY`, show the complete panel workflow status timeline with recorded date-times when available, show richer related panel status information, and show related files/evaluation as concise no-records states until those modules are connected.
- Office Staff/Admin Panel Appointment record detail and workload monitoring must be page-level routed at `/panel-appointments/records/<recordId>` and `/panel-appointments/workload`, with back actions returning to `/panel-appointments` and unknown records showing a clear not-found state.
- Office Staff/Admin Panel Workload Snapshot and Panel Workload Monitoring must load lecturer workload from the persisted appointments backend instead of hardcoded lecturer rows.
- Office Staff/Admin Panel Appointment Management and Panel Workload Monitoring must export the currently filtered records as downloadable CSV files, including persisted lifecycle identifiers, timestamps, rejection metadata, and cancellation metadata for panel appointment records.
- Panel workload monitoring must count confirmed active panel appointments plus active pending nominations, show confirmed and pending counts separately, and classify lecturers as Available, Near Limit, or Full Load.
- Panel workload utilization displays must clamp progress values to a valid 0-100% range even if persisted workload limits are zero or inconsistent.
- Panel workload monitoring must be read-only for Office Staff/Admin users.

## Dashboard Requirements

- `Dashboard Overview` must render a real administration dashboard instead of a placeholder.
- The office-staff dashboard must show semester timeline status, selected records needing attention, monitoring tasks, and dashboard actions.
- For the FYP presentation slice, Administration Dashboard must keep the focus on the working semester timeline and selected monitoring lists; dependent summary cards for unfinished modules can be hidden to avoid implying unavailable integrations.
- Office staff must be able to open timeline management from the dashboard and return to the dashboard.
- Dashboard actions must route to existing modules such as Supervisor Appointments, Panel Appointments, and Marks Entry without breaking those modules.
- Administration Dashboard must display semester timeline entries in a month-lane calendar-style P1/P2 phase view instead of Month/Quarter/Year timeline controls.
- Dashboard semester timeline headings for Office Staff/Admin, Student, and Lecturer must display the academic period as `Session YYYY/YYYY` rather than a semester label.
- Each timeline event in the month-lane calendar must render on its own row so overlapping or adjacent events remain readable.
- Month-lane timeline bars must be positioned proportionally by actual day within the displayed month range, so short ranges ending early in a month do not fill the entire month column.
- Timeline event bars must show the timeline `Title` without inline date text, wrap long labels onto additional lines, and leave exact dates/details to the click-through modal.
- Timeline event bars must avoid separate vertical marker decorations and use compact readable labels so short events do not visually dominate a whole month column.
- Timeline labels in the calendar-style view must be clickable and open a detail modal with phase, start date, end date, action/status context, and `Detail` as the description.
- The P2 phase must remain selectable and show an appropriate empty state when P2 entries are not available yet.
- Administration Dashboard phase controls must use the full labels `Research Project 1` and `Research Project 2`, placed beside the Refresh action.
- Administration Dashboard must not show dashboard-level `Export Report` or `New Entry` actions.
- Administration Dashboard must not show the old status legend or `View Full Timeline` action below the semester timeline calendar.
- Administration Dashboard must not show the four placeholder summary cards for students without supervisor, supervisor records, panel records, and mark entry setup.
- Records Needing Attention must remove the redundant Status column, show zero impact for unfinished dependency rows, omit mark-entry task generation rows for now, and calculate the lecturer panel workload impact count from the persisted panel workload data.
- The shared Dashboard Action Centre must load persisted, role-scoped actions from `/api/dashboard/tasks/`; it must provide loading, error/retry, and empty states and navigate using the returned module, record type, and record ID.
- `Manage Timeline` must behave as a direct button that navigates to Timeline Management.
- Dashboard page-level routing must support only `/dashboard` and Office Staff/Admin-only `/dashboard/timeline`; unsupported Dashboard nested URLs must redirect authenticated users back to `/dashboard`.
- All authenticated users must be able to retrieve the active semester timeline for Dashboard Overview.
- Student and Lecturer dashboard timeline views must only display entries targeted to their role; Office Staff/Admin dashboard and management views may display all timeline entries.
- Student and Lecturer dashboards must retain their role-scoped semester timeline visualization and use the shared persisted Dashboard Action Centre for workflow, Marks, and timeline actions.
- If no active semester timeline is available, the dashboard must display `No timeline available at now` while keeping the rest of the dashboard available.
- Office Staff/Admin users must be able to download the official structured Excel timeline template, upload a completed `.xlsx` timeline, replace the active semester timeline, edit individual timeline entries, and trigger audit logging.
- Office Staff/Admin users must be able to add individual timeline entries to the active timeline, move entries between Research Project 1 and Research Project 2, delete obsolete entries, and see those changes reflected in the schedule, entries table, dashboards, and audit log.
- Timeline Management must use persisted backend data for summary cards, active semester schedule, timeline entries, upload results, add/edit/delete actions, and recent timeline updates/audit log when timeline backend mode is enabled.
- Timeline Management Recent Timeline Updates must display the newest audit records in pages of 10 without removing or merging audit history.
- Timeline Management must use the same P1/P2 calendar-style timeline presentation as Administration Dashboard and must not show an overflow menu action.
- Add/Edit timeline entry drawers must restrict classification to Research Project (P1) and Research Project (P2), and must not expose or submit manual status-state selection because status is derived from the entry date range.
- Semester timeline upload validation must reject missing required columns, missing required fields, invalid P1/P2 levels, invalid dates, invalid target roles, and deadline end dates before start dates.
- Semester timeline uploads must be `.xlsx` files no larger than 10 MB. Before parsing, the backend must reject malformed or corrupt ZIP containers, missing workbook structure, encrypted entries, unsafe archive paths, macro payloads, archives with more than 1,000 entries, and archives expanding beyond 50 MB.
- Timeline upload validation failures must retain the API contract `400 {"errors": ["reason"]}`, and the frontend must reject files over 10 MB before submission.
- The supported timeline upload template must use structured rows with `Level`, `Title`, `Detail`, `Action`, `Deadline Start`, `Deadline End`, `Week Label`, and `Target Roles`. `Title` is shown on the schedule label, `Detail` is shown as the description when the user opens the entry, and `Target Roles` accepts only `STUDENT`, `LECTURER`, and `OFFICE_STAFF`. `Step` and `Status` are not user-entered template columns.

## Office Staff Module Requirements

- Sidebar navigation must expose Dashboard Overview, Registry Management, FAQ Chatbot, File Management, Supervisor Appointments, Letter Generation, Announcements, Marks Entry, Panel Appointments, and Settings.
- Header notifications must route to `/notifications`, and workflow notifications must deep-link authorized users to the relevant Supervisor Appointment, Panel Appointment recommendation, or Marks record route when a record identifier is available.
- Existing Dashboard Overview behavior must remain the default authenticated landing view for every role after a normal login.
- Login, forgot-password, and reset-password flows must remain available at `/login`, `/forgot-password`, and `/reset-password?uid=...&token=...` after logout without blocking direct office-staff UI review during development.
- Production frontend hosting for clean URLs must fall back unknown frontend paths to `index.html` so direct refresh works on routes such as `/marks/records/<recordId>`.
- Office Staff/Admin Supervisor Appointment record detail and workload monitoring must be page-level routed at `/supervisor-appointments/<applicationIdOrStudentId>` and `/supervisor-appointments/workload`, with back actions returning to `/supervisor-appointments` and unknown records showing a clear not-found state.

## Lecturer Module Requirements

- When an authenticated demo user has the `Lecturer` role, Supervisor Appointments, Panel Appointments, and Marks Entry must render lecturer-focused workflows rather than office-staff administrative workflows.
- Lecturer users must land on Lecturer Dashboard Overview after login; Marks Entry remains accessible from the sidebar rather than being the automatic landing module.
- Lecturer Dashboard Overview must render a lecturer-focused dashboard instead of the office-staff administration dashboard.
- Lecturer Dashboard Overview must show the role-scoped read-only semester timeline without the office-staff Manage Timeline action.
- Lecturer Dashboard Overview must not show office-staff Records Needing Attention or Office Monitoring Tasks.
- Lecturer Dashboard Overview must show two dashboard cards: Students Under Supervision and Panel Appointment for Students.
- Lecturer Dashboard Overview must reuse the shared persisted Dashboard Action Centre for assigned Supervisor requests, selected-panel reviews, Marks tasks, and Lecturer-targeted timeline actions.
- Lecturer Supervisor Appointments must support pending supervisor request review, active supervisee detail review, and supervisor request history.
- Lecturer Supervisor Appointments must expose request history and active supervisee detail as page-level routes at `/supervisor-appointments/history` and `/supervisor-appointments/supervisees/<studentId>`, while keeping review drawers, filters, pagination, and toasts local to the component.
- Lecturer Supervisor Appointment review drawers must keep approve/reject controls and rejection reason inputs inside the scrollable drawer body so long request details do not leave decision controls fixed outside the scroll region.
- Lecturer Panel Appointments must support assigned panel task review, supervisor panel recommendation submission, and submitted recommendation review.
- Lecturer Panel Appointments must expose submitted recommendations, reviewed requests, and assignment detail as page-level routes at `/panel-appointments/submitted`, `/panel-appointments/reviewed`, and `/panel-appointments/assignments/<studentId>`, while keeping drawers, filters, pagination, and toasts local to the component.
- Selected panel lecturers must retain a read-only Reviewed Requests history containing recommendations they personally accepted or rejected, including the later Programme Coordinator outcome when available.
- Selected-panel Reviewed Requests must open as a separate page from a text-only button positioned above the Selected Panel Review Queue table.
- Lecturer Panel Assignment Detail must render backend assignment fields rather than screenshot/demo placeholders, show the academic year as `Session YYYY/YYYY`, show the complete panel workflow status timeline with recorded date-times when available, and show related documents/EE evaluation as concise no-records states until those modules are connected.
- Supervisor panel recommendation is separate from the student supervisor appointment workflow and applies only after a student already has an approved supervisor.
- A supervisor panel recommendation must contain exactly one recommended panel lecturer for the student.
- A supervisor cannot create another panel recommendation for the same student while a recommendation is Submitted to Panel, Pending Coordinator, or Approved/Confirmed.
- Panel acceptance moves directly from `SUBMITTED_TO_PANEL` to `PENDING_COORDINATOR`; the unused `ACCEPTED_BY_PANEL` state is not part of the supported workflow.
- The submitting supervisor may cancel a panel recommendation only while its status is `SUBMITTED_TO_PANEL`; cancellation requires a non-empty reason, is immediate, and creates the terminal status `CANCELLED_BY_SUPERVISOR`.
- A cancelled panel recommendation must remain in supervisor, selected-panel, Programme Coordinator, and Office Staff/Admin history as `Cancelled by Supervisor`, must leave the selected panel's active queue, must release its reserved workload, and must permit a replacement recommendation for the same student.
- Cancellation controls must never be available to the selected panel member, Programme Coordinator, Office Staff/Admin, or student, and cancellation must be rejected after any selected-panel or coordinator decision.
- A student may cancel their Supervisor Appointment request only while it is `SUBMITTED_TO_SUPERVISOR`. Cancellation requires a reason, creates terminal `CANCELLED_BY_STUDENT`, removes the request from the supervisor queue, preserves audit history, and permits a replacement request.
- Supervisor and Panel transitions must create immutable audit events containing actor, role, previous status, new status, reason, and timestamp.
- Workflow and Approval Tracking must maintain persisted audit events and stable module/record identifiers that the separate Notifications module can consume for deep links. Office Staff/Admin monitor workflows through read-only records rather than receiving every transition as part of this module.
- A supervisor may create a new recommendation for the same student only after the selected panel member rejects it or the Programme Coordinator rejects it.
- Submitted panel recommendations must route first to the selected panel member for acceptance or rejection; selected panel rejection requires a rejection reason.
- Programme Coordinator confirmation or rejection must occur only after the selected panel member accepts the recommendation.
- The supervisor who submitted a panel recommendation must see only tracking/status information for that recommendation and must not be able to approve or reject it as the selected panel member or Programme Coordinator.
- Panel recommendation review actions must be role-gated: selected panel members may decide only recommendations submitted to them, and Programme Coordinators may decide only recommendations that have passed selected-panel acceptance.
- Panel recommendation role-gating must be enforced by the backend API and database workflow, not only by frontend button visibility.
- Programme Coordinator panel appointment confirmation must use the existing separate `Programme Coordinator` login role.
- Programme Coordinators must have a dedicated dashboard using the Lecturer dashboard structure, a read-only Lecturer-scoped semester timeline, and a persisted action centre limited to Supervisor and Panel approvals in the managed programme.
- Programme Coordinator dashboard cards must show live supervisor and panel approval counts from persisted backend workflow state, scoped to the coordinator's managed programme.
- Programme Coordinator panel queues, records, dashboard counts, and decision permissions must be restricted to `Coordinator.programme_managed`.
- A Programme Coordinator without an assigned managed programme must see an explicit no-programme state, no protected panel records, and no approval actions.
- Programme Coordinator Panel Appointments must show the final-approval queue plus a searchable, status-filtered, read-only full-lifecycle records table for the managed programme, paginated at 10 rows per page.
- Programme Coordinator Panel Appointments must continue to support `/panel-appointments/recommendations/<recommendationId>` as a direct recommendation drawer link while redirecting lecturer-only panel subpages back to `/panel-appointments`.
- Programme Coordinator approve/reject actions must remain available only from the pending final-approval queue; completed and non-actionable lifecycle records must open in read-only detail mode.
- Programme Coordinators do not require a separate decision-history page because their programme-wide lifecycle table is the audit surface.
- Programme Coordinator Supervisor Appointments must show the live final-approval queue for accepted supervisor applications in the coordinator's managed programme, including approve/reject actions, mandatory in-app rejection reasons, persisted workflow audit history, loading/error states, and a clear no-pending-approvals state.
- The backend must persist student research profiles, supervisor panel recommendations, and final approved panel appointments for the lecturer-side panel workflow.
- Panel recommendation decision drawers must keep confirm/reject controls and rejection reason inputs inside the scrollable drawer body so long research details do not leave decision controls fixed outside the scroll region.
- Submitted panel recommendation detail drawers must be the supervisor tracking surface and show a request progress timeline covering recommendation submission, selected panel review, Programme Coordinator confirmation, and appointed panel status.
- Panel recommendation timelines must display recorded submission and confirmation/rejection date-times when those timestamps are available from the backend.
- Panel recommendations must not support a save-as-draft flow; supervisors submit directly to the selected panel lecturer.
- Panel workload validation must count confirmed active panel appointments plus submitted/pending nominations, and the UI must explain that this reserved workload is used before submission.
- Panel appointment APIs must keep the frontend response contract stable while resolving lecturer staff numbers, departments, and student matric numbers from the normalized role-profile tables.
- Lecturer Marks Entry must support mark-entry task review, mark-entry form access, history review, and submitted mark detail review.

## Workflow Ageing and Deadline Requirements

- Pending Supervisor and Panel approvals must expose derived `waitingSince`, `waitingDays`, and `waitingOn` metadata without storing recurring ageing records or changing immutable workflow audit events.
- Supervisor submissions wait on `SUPERVISOR` from submission; accepted Supervisor applications wait on `PROGRAMME_COORDINATOR` from the Supervisor decision.
- Panel submissions wait on `SELECTED_PANEL` from submission; accepted nominations wait on `PROGRAMME_COORDINATOR` from the selected-panel decision.
- Historical records missing a stage timestamp must fall back to the matching workflow transition and then the record update timestamp. Future or malformed waiting timestamps must display zero elapsed calendar days.
- Approved, rejected, cancelled, completed, and otherwise terminal workflow records must return null waiting metadata. Approval ageing is informational and must not be described as an SLA, due-soon state, or overdue state.
- Marks tasks and monitoring records must derive `dueAt`, `daysUntilDue`, and `deadlineState` from `EvaluationPeriod.closes_at`. The supported states are `NO_DEADLINE`, `UPCOMING`, `DUE_TODAY`, `OVERDUE`, and `COMPLETE`; submitted Marks remain locked and do not gain an approval stage.
- Timeline action metadata must be derived from persisted entry start/end dates without changing timeline persistence or audit behavior.
- `/api/dashboard/tasks/` must return at most 20 role-scoped actions while retaining its existing fields. Priority order is overdue deadlines, due-today deadlines, oldest waiting approvals, active timeline entries, then upcoming deadlines nearest first.
- Office Staff/Admin may see actions across all five owned modules. Programme Coordinators may see only managed-programme Supervisor and Panel approvals. Lecturers may see only assigned Supervisor requests, selected-panel reviews, their Marks tasks, and Lecturer timeline entries. Students may see only their own Supervisor wait, generic faculty Panel processing, and Student timeline entries.
- Student Panel payloads and actions must use `FACULTY_PROCESSING` and must not expose the selected panel, coordinator stage, recommendation ID, or internal workflow timestamps. Students without an active recommendation receive null Panel ageing metadata.
- Office Supervisor and Panel monitoring lists must provide an optional Longest waiting order while retaining their normal default order. Lecturer and Programme Coordinator approval queues default to oldest waiting first.
- Existing Supervisor and Panel CSV exports must include waiting metadata. Marks records and Lecturer Marks tasks must display persisted deadline metadata; no separate reporting subsystem is introduced.

## Workflow Analytics and Reporting Requirements

- Authenticated Office Staff/Admin, Programme Coordinator, and Lecturer users must have a read-only workflow analytics workspace at `/dashboard/reports`; Students must not receive this administrative reporting surface.
- Reports must aggregate only records already authorized for the requesting role. Office Staff/Admin may report across all programmes or one selected programme, Programme Coordinators remain restricted to their managed programme, and Lecturers remain restricted to assigned Supervisor, selected-panel, Marks, and Lecturer-targeted Timeline records.
- Optional `startDate` and `endDate` filters must use ISO dates and reject malformed or reversed ranges. Supervisor uses submission date, Panel uses submission date with creation fallback, Marks uses evaluation-period closing date with assignment fallback, and Timeline uses deadline start date.
- Supervisor and Panel reporting must include lifecycle, waiting-owner, informational age-band, and longest-waiting summaries. Age bands are descriptive calendar-day groupings and must not be presented as service levels, due-soon states, or overdue states.
- Marks reporting must retain its tracking-only model and summarize task status, deadline state, evaluator role, completion, and authorized overdue tasks. Timeline reporting must summarize current status, P1/P2 level, and target role.
- JSON reports and XLSX exports must use the same role-scoped reporting service and active filters. Export workbooks must contain only sections the requesting role can access and must not persist generated files or database records.
- Reports show the current persisted state of records selected by their reporting date; they do not reconstruct historical point-in-time snapshots or trend lines.

## Student Progress Dossier Requirements

- The system must provide a read-only progress dossier that aggregates persisted Supervisor, Panel, Marks, active Student-targeted Timeline, and workflow-audit data without creating dossier records or changing workflow state.
- Office Staff/Admin may view every student and all dossier sections. Programme Coordinators may view managed-programme students with Supervisor, Panel, and Timeline sections only. Lecturers may view only connected students, and each Supervisor, Panel, or Marks section must contain only records assigned to that lecturer.
- Students may open only their own dossier. Unauthorized and nonexistent matric numbers must return the same `404` response so the endpoint does not disclose whether another student exists.
- Student dossier payloads must exclude the entire Marks/evaluation section, including task periods, deadlines, status and completion metadata, as well as internal Panel stages, recommendation identifiers, pending selected-panel identity and staff audit actors. Pending Panel work is represented only as `FACULTY_PROCESSING`.
- Dossiers must show current records before newest-first lifecycle history, reuse existing waiting/deadline derivations, and return null waiting metadata for terminal workflows.
- Dossier attention must order overdue authorized Marks tasks first, active workflow waits by longest age second, and active/upcoming Student Timeline milestones third.
- Dossier navigation metadata must use existing module, record type, and record identifier fields. Approval, rejection, cancellation, submission, printing, and export remain in their owning modules.
- Staff dossier routes use `/dashboard/progress/:studentId`; the Student self-view uses `/dashboard/progress`. The workspace remains outside the sidebar and is opened from existing workflow tables, report attention rows, and the Student Dashboard.
- Students without a research profile must still receive available Supervisor and Timeline information with an empty Panel section and no Marks section.
- Lecturer screens must reuse the current portal shell, sidebar, top header, typography scale, card surfaces, and shared Tailwind theme tokens so the experience remains visually consistent with the office-staff modules.
- Authenticated module pages must use the global portal footer only, avoiding duplicate page-level institutional footers inside individual modules.
- Administrative pages should avoid decorative blur-orb backgrounds and use restrained card surfaces suitable for repeated office workflows.
- Authenticated role workspaces must use consistent `rounded-2xl` card surfaces, subdued shadows, and shared brand color tokens.
- Repeated portal UI patterns such as page headers, action buttons, cards, status badges, toast notifications, tables, forms, and filter controls should use shared primitives or shared CSS classes where practical.
- Toast notifications should appear at the top-right of the viewport, below the sticky top header, and remain above app overlays.
- Irreversible confirmations such as cancellation, deletion, and final mark submission must use the shared portal confirmation modal instead of browser-native `window.confirm()` dialogs.
- Dashboard and panel appointment actions must use in-app portal toasts or inline validation instead of browser-default `alert()` popups.
- Frontend API base configuration must be driven by Vite environment variables. Global mock mode may remain only for unfinished or teammate-owned modules.
- Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks, and Workflow/Approval Tracking must always use Django. Their services and screens must not inspect global mock mode, use module-specific backend switches, or substitute demo records after an API error.
- Owned workflow screens must expose their existing loading, retry, and authorization states when Django is unavailable or rejects a request.
- Demo data for unfinished modules must remain outside owned-module services and runtime components.
- Generated Gemini or AI Studio environment requirements are out of scope for this portal frontend and must not be required to run the app.
- Demo accounts must use clearly fictional `example.test` emails, `DEMO-*` identifiers, and demonstration-only profile data with no national identity-number patterns.
- Django demo seeding must require `DEBUG=True`, an explicit `ENABLE_DEMO_ACCOUNTS=true` opt-in, and non-blank per-role passwords supplied only through an ignored local environment file.
- Frontend demo-login controls must appear only in Vite development mode when `VITE_ENABLE_DEMO_LOGIN=true` and all per-role local passwords are configured; normal manual login must remain available otherwise.
- Production frontend builds must not contain demo passwords, testing-console markup, or testing-console copy even when demo environment variables are supplied to the build process.
- Refreshing or renaming local demo accounts must preserve existing account identities and their audit, timeline, and appointment history through an optional validated legacy-email mapping.
- Django REST APIs must require authenticated access by default. Only login, password-reset request, and password-reset confirmation may explicitly allow anonymous DRF requests; `/api/health/` remains a minimal public Django health check.
- Logout must require a valid authenticated refresh session, blacklist that refresh token, and delete its cookie.
- Backend role and record scoping is authoritative: students may access only their own records, lecturers only assigned workflow records, Programme Coordinators only their managed programme, and Office Staff/Admin-only monitoring must reject every other role.
- Letter templates are readable by every authenticated role and writable only by Office Staff/Admin or Programme Coordinator users.
- Announcements and Notifications are teammate-owned and excluded from behavioral security changes in the current core-API hardening slice.
- Login must be limited to 10 attempts per minute per client IP, password-reset requests to 5 per hour per client IP, and password-reset confirmations to 10 per hour per client IP, with environment-configurable rates.
- Authentication throttles must return HTTP `429` with `Retry-After`, and authentication screens must show a clear retry-later message.
- When `DEBUG=False`, Django startup must fail closed unless `DJANGO_SECRET_KEY` is non-placeholder, at least 50 characters long, and contains at least 5 unique characters; `DJANGO_ALLOWED_HOSTS` must be explicit and non-wildcard; and `CORS_ALLOWED_ORIGINS` must contain at least one valid HTTPS origin.
- Production requests must use HTTPS redirection, secure HttpOnly `SameSite=Strict` session and CSRF cookies, content-type sniffing protection, a same-origin referrer policy, and frame denial. Local `DEBUG=True` HTTP hosts, CORS origins, and the development secret fallback must remain available.
- Production HSTS must begin with a staged one-hour duration without subdomain coverage or preload. Raising it to one year and enabling `includeSubDomains` or preload requires verified HTTPS coverage across all subdomains.
- Forwarded-protocol trust must remain disabled by default and may be enabled only when a trusted reverse proxy strips untrusted client forwarding headers and sets `X-Forwarded-Proto` itself.
- Access tokens must default to 15 minutes, remain only in frontend memory, and authenticate normal APIs through the bearer header. They must never be stored in browser storage, URLs, or logs.
- Refresh tokens must default to 7 days, rotate on every renewal, blacklist the replaced token, and remain only in an HttpOnly `SameSite=Strict` cookie scoped to `/api/auth/`; production refresh cookies must be Secure.
- Login, refresh, and logout must require JSON requests; refresh and logout additionally require a valid refresh cookie. Missing, malformed, expired, replayed, password-invalidated, or inactive-user refresh sessions must return `401` without exposing refresh-token values.
- Password resets and account deactivation must invalidate existing access and refresh sessions. Application startup and a single authenticated `401` retry may renew through the refresh cookie without converting normal APIs to cookie authentication.
- Production must serve the React application and Django routes from one HTTPS origin through the tracked Nginx template, with `/api/` and `/admin/` proxied to Django and collected Admin assets served from `/static/`. Unknown hosts must be rejected, canonical redirects must not reflect the request Host header, and Nginx must emit the sole public HSTS header.
- Production documents must receive a CSP that permits scripts and API connections from the same origin only, prohibits inline scripts, objects, frames, workers, and media, and allowlists only Google Fonts and Unsplash images as external resources.
- CSP rollout must begin with the report-only include and move to the equivalent enforced include only after all owned role workflows complete without browser-console violations. No unauthenticated CSP collection endpoint is required in this slice.
- Production Vite builds must explicitly disable source maps and fail their security guard if emitted files contain `.map`, `sourceMappingURL`, inline executable entry scripts, demo credentials, or testing-console content. Nginx must return `404` for all `.map` paths, including maps present in collected third-party static packages.
- Inline styles remain temporarily permitted for current React dynamic layout behavior, but generated letter documents must register print behavior from the trusted application bundle instead of embedding inline scripts.
- Frontend build tooling must keep Vite in `devDependencies` only on the patched 6.x line, keep `tsx` and its transitive `esbuild` on advisory-free versions, and provide an `npm run audit:security` command that fails on any known low-or-higher vulnerability.
- Frontend routing must use patched `react-router` 8.3.0 or newer with React/React DOM 19.2.7 or newer and Node.js 22.22.0 or newer. The removed `react-router-dom` compatibility package must not be reintroduced.
- All frontend dependency paths must resolve PostCSS to 8.5.18 or newer through the package-level npm override.

## Student Module Requirements

- When an authenticated demo user has the `Student` role, shared sidebar entries must render student-focused workflows rather than office-staff administrative workflows.
- Student users must be able to access FAQ Chatbot, Supervisor Appointments, Panel Appointments, File Submission, Letter Generation, Dashboard Overview, and Settings from the sidebar.
- Student Supervisor Appointments must support viewing current supervisor details and submitting supervisor appointment applications.
- Student Supervisor Appointments must expose the new application form as `/supervisor-appointments/new` and continue opening submitted application detail from `/supervisor-appointments/<applicationId>`.
- Student Panel Appointments must support viewing pending and confirmed panel appointment states.
- Student Panel Appointments must remain rooted at `/panel-appointments`; nested panel appointment URLs that do not apply to students must redirect back to `/panel-appointments`.
- Student Panel Appointments must load panel appointment status from the persisted backend panel workflow instead of a manual test toggle.
- Student users must see a pending state until Programme Coordinator confirmation creates an active appointed panel record.
- Student users without a linked research profile must also see the pending panel appointment state instead of a hard loading error.
- After Programme Coordinator confirmation, the student Panel Appointment page must show the appointed panel member, programme, semester, research title, appointment date, and panel contact email when available.
- The confirmed student Panel Appointment view should avoid staff ID and repeated supervisor/student metadata so the module stays focused on the appointed panel.
- Student panel visibility starts immediately after Programme Coordinator confirmation; no separate Office Staff/Admin release step is required for this slice.
- Student panel appointment data must be scoped to the authenticated student so a student cannot view another student's appointed panel.
- Student File Submission must support selecting a submission category and uploading/viewing submitted research documents.
- Student Letter Generation must support selecting a letter template, previewing content, and triggering generate/print actions.
- Student Dashboard Overview must show the shared semester timeline in a read-only student context without the office-staff Manage Timeline action.
- Student Dashboard Overview must not show the top-right Active Student summary card.
- Student Dashboard Overview must keep only two status/action cards below the timeline: Supervisor and Panel Appointment.
- Student Dashboard Overview must remove Semester Progress, academic-guidelines, and Profile Status Complete panels from the dashboard.
- Student Dashboard Overview must reuse the shared semester-timeline next-actions list for timeline events targeted to Student.
- Dashboard and panel-facing demo/profile data must use only the approved programme list.
- Student screens must reuse the current portal shell, global footer, typography scale, card surfaces, and shared Tailwind theme tokens.
- Student-facing toasts, status labels, action cards, and dashboard cards must follow the same shared portal primitives used by office staff and lecturer screens.
- Cross-role table actions, pagination controls, drawer close controls, modal actions, upload actions, page headers, sub-view back headers, segmented selectors, removable tag chips, progress bars, status dots, and reusable status badges should use shared portal primitives unless the control is a highly layout-specific visual element.

## Five-Module Completion Requirements

- Supervisor Appointment applications must persist project details, proposed supervisor, private supporting-document files and immutable metadata snapshots, decisions, reasons, and timestamps.
- A student may have only one active supervisor application; rejected applications may be followed by a new application.
- The requested supervisor decides first, followed by final Programme Coordinator approval scoped to the managed programme.
- Supervisor and Panel decisions must enforce each lecturer's configured workload limit.
- Supervisor and Panel workflows must audit actor, role, action, previous status, new status, reason, and timestamp.
- Supervisor document requirements, workload limits, rubrics, and mark components must remain configurable until official rules are received.
- Office Staff/Admin must configure Supervisor application document requirements without physical deletion. Requirement codes are immutable; activation, deactivation, ordering, and content changes require audited configuration records, while each submitted application retains the code and label used at submission time.
- New Supervisor applications must fail closed when no active document requirements exist and must atomically submit multipart research data with at most one file per selected requirement, five files total, and 10 MB combined.
- Supervisor application documents accept PDF and DOCX only. Django must validate file signatures and package integrity, reject unsafe PDF actions and encrypted, traversing, macro-enabled, oversized, or malformed DOCX content, and prevent duplicate file content within one application.
- Private Supervisor files must never expose storage URLs. Authenticated attachment downloads are limited to the owning Student, proposed Supervisor, managed-programme Coordinator, and Office Staff/Admin; unauthorized and unknown files return the same not-found response.
- Historical document metadata without stored content must remain visible as `Legacy Metadata` without a download action. Rejected and cancelled applications retain their immutable documents and workflow history.
- Student, Lecturer, Coordinator, and Office Supervisor views must render only persisted application fields and documents. They must not fabricate eligibility decisions, supporting files, research content, timestamps, feedback, or appointment letters.
- Official faculty templates, academic eligibility thresholds, antivirus scanning, post-submission file replacement, Notifications/Announcements, and File Repository integration remain outside Supervisor intake until authoritative rules or teammate-owned interfaces are available.
- Evaluation task generation must create role-specific mark-entry tasks for both active Supervisor Appointments and active Panel Appointments.
- Marks Assignment must provide production Office Staff/Admin controls for selecting eligible evaluation periods, generating missing tasks, filtering tasks by role/status, and assigning backup evaluators without raw ID prompts. Backup assignment provides an interactive selector containing only the current eligible workspace period, even when it is the sole option; draft and ended periods are excluded, and no blank placeholder option is shown. To target another period, staff change the workspace period first. The assignment action is unavailable when the current period is ineligible. Student and backup lecturer selection must each use one searchable combobox field with its result list opening directly beneath it; do not stack a separate search input inside the dropdown.
- Office Staff/Admin may add a backup/manual-override evaluator only for exception cases, with a mandatory reason and audit trail; this must not change the official supervisor or panel appointment.
- If a mark entry period is active and tasks were not manually generated, the backend must safely generate missing tasks without duplicating or overwriting existing/submitted entries.
- Marks Entry overview and monitoring must use live mark periods, task totals, and mark records rather than hardcoded submission counts.
- Dashboard and Marks Entry monitoring actions must open Mark Entry Records with the relevant status filter selected.
- Office Staff/Admin mark records must show unsubmitted tasks as `Overdue` after the evaluation period close date while preserving submitted records as `Submitted`.
- Marks Entry uses only `Not Started`, `Draft`, and `Submitted`; it has no approval workflow.
- Lecturer submission immediately locks marks.
- Authorized Office Staff/Admin users may correct or reopen submitted marks through the existing Office portal with a mandatory reason, reviewed record version and before/after audit values.
- Mark totals must be recalculated by the backend and component marks must not exceed configured maximums.
- Dashboard summaries must use live Supervisor, Panel, and Marks data with role and programme scoping.

## Production Marks Management

- Marks configuration is faculty-wide and persisted. Office Staff/Admin is the only portal role allowed to create or change rubric versions, rubric components, and evaluation periods.
- Every rubric belongs to a stable version family, has a sequential version number and configurable target mark, and may reference the version it supersedes. A published-period or task-referenced version is immutable and must be cloned before further changes.
- A rubric version is ready for publication only when it has active components and their maximum marks total exactly the configured target. Components are deactivated rather than physically deleted.
- Evaluation periods follow `DRAFT`, `PUBLISHED`, `CLOSED`, and `ARCHIVED` lifecycle states. The UI derives `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, or `ARCHIVED` from lifecycle state and Kuala Lumpur timestamps.
- Draft periods permit configuration changes. Published periods lock their name, semester, and rubric; only a closing-time extension with a mandatory reason is permitted. Closed periods may be archived and archived periods are hidden by default.
- Publishing requires a ready rubric, a valid opening/closing range, and a unique non-archived faculty-wide name and semester. Evaluation and backup tasks may be created only for published periods that have not ended.
- Every configuration mutation records an immutable actor, action, entity, reason, before value, after value, and timestamp audit.
- Lecturer drafts and submissions are accepted only while a period is published and open. Submitted entries remain locked, duplicate submissions conflict, and authoritative totals are recalculated only from persisted component scores.
- Draft updates remove persisted optional scores omitted from the request. Submission rejects duplicate, unknown, negative, over-maximum, or missing required component scores.
- State conflicts, locked configuration, duplicate submission, and illegal lifecycle transitions return `409`; malformed input and score validation return `400`.
- Office Staff/Admin Mark Record Detail must load one persisted record by stable record ID and show assignment, student/research summary, deadline, rubric version, component scores, comments, total, lock state, overrides, and read-only correction history.
- Correction history must keep reason, actor and timestamp easy to scan; before/after comparison must remain readable with long overall comments without creating horizontal page scrolling.
- Office Marks administration routes must fail closed in the frontend for Programme Coordinator, Lecturer, and Student users in addition to backend endpoint authorization.
- Submitted-mark reopening and direct score or comment corrections use authorized, audited Office portal actions; Django admin is inspection-only. Reopening is permitted only while the period still accepts submissions; an audited correction with a mandatory reason and before/after values may be made after closure.
- Marks production screens must not ship mock records, browser-local period/rubric mutations, simulated sync controls, unsupported mark-sheet/PDF downloads, fake supporting documents, or notification dispatch behavior.
- Marks remains tracking-only with `Not Started`, `Draft`, and `Submitted`; no approval or grade-classification stage is introduced.

## Backend-Only Owned Workflow Boundary

- Appointment and Timeline service functions must call their Django endpoints directly under every Vite environment combination.
- Supervisor workload monitoring must be derived from active persisted appointments and configured supervisor limits. A Lecturer's own workload must use an authenticated, role-scoped endpoint.
- Lecturer acceptance of a Supervisor application must remain pending Programme Coordinator approval and must not create or display an active appointment until the backend creates one.
- Active-supervisee detail, panel candidates, recommendation histories, timeline semester/session metadata, and timeline dates must come from persisted API responses or explicit user input; the UI must not invent fallback identities, records, dates, or files.

## Central Academic Semester Requirements

- Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks, and Workflow/Approval Tracking must share one faculty-wide academic-semester authority. At most one semester may have the persisted `ACTIVE` lifecycle at a time.
- Academic sessions use consecutive-year values such as `2026/2027`; terms are limited to Semester I, Semester II, or Special Semester. Non-archived semester date ranges must not overlap.
- Office Staff/Admin alone may create, edit, activate, extend, close, archive, or audit semesters. Every authenticated role may read the minimal active-semester context displayed on its dashboard.
- Semester lifecycle transitions are one-way: Draft may become Active or Archived, Active may become Closed, and Closed may become Archived. Activation, handover, extension, closure, and archival require immutable audit records and mandatory operational reasons.
- Activating a replacement semester must atomically close the previous active semester and its published Marks periods. An active semester past its end date is effectively expired and blocks new Supervisor, Panel, and Marks workflows until Office Staff closes or replaces it.
- New Supervisor applications and Panel recommendations bind to the effective active semester on the server. Clients cannot select or override this relationship; unresolved prior-semester approvals and cancellations remain actionable and are labelled as carryover records.
- Timeline versions belong to a persisted semester. Office Staff may prepare the current Timeline version for a Draft or Active semester; Closed and Archived semester Timelines are read-only. Role dashboards render only the effective active semester's current Timeline.
- Marks draft periods may be prepared for Draft or Active semesters. Publishing and task generation require the effective active semester, and the evaluation window must remain within its dates. Extending a semester never changes Marks deadlines automatically.
- Workflow Reports default to the active semester and permit authorized `all`, `unassigned`, or stable semester-code history filters. Progress dossiers retain authorized complete history.
- Historical workflow strings remain available for display, but records that cannot be linked without guessing must keep a null semester relationship and display `Legacy / Unassigned`.
- Appointment and Timeline mock datasets and legacy `VITE_USE_SUPERVISOR_BACKEND`, `VITE_USE_PANEL_BACKEND`, and `VITE_USE_TIMELINE_BACKEND` controls must not be present in source or production artifacts.

## Supervisor-to-Panel Research Profile Handoff

- New Supervisor applications require a persisted free-text Research Area in addition to the research title and abstract. Historical applications may retain a blank legacy value.
- Final Programme Coordinator approval is the authoritative point at which the system must atomically create or connect the student's research profile and create the active Supervisor appointment.
- Research profiles provisioned by approval use the Student account's matric number, name, and programme; the approved application's title, abstract, Research Area, and academic-semester label; and the approved Supervisor appointment.
- Matching unassigned legacy profiles must retain their primary keys. Unused profiles may be refreshed from the approved application, while profiles with Panel or Marks history must not have populated historical research data silently overwritten.
- Separate user-linked and matric-linked profiles, or downstream-used profiles assigned to a different Supervisor, must fail final approval with `409 Conflict` and no partial appointment, profile, approval event, or state transition.
- Panel-eligible supervisees require an active approved Supervisor appointment for the authenticated Lecturer. Panel recommendation submission must revalidate that relationship server-side and reject crafted student identifiers.
- Student Panel status must expose only public readiness states: Supervisor required, Supervisor approval pending, ready for Panel recommendation, faculty processing, or confirmed. Pending internal Panel actors and stages remain private.
- Marks task generation must resolve the profile created by Supervisor approval and continue producing separate Supervisor and Panel evaluator tasks after the respective appointments become active.
- Active-supervisee detail must provide a deep action into the existing Panel recommendation workspace with the eligible student preselected; no additional sidebar module is introduced.

## Supervisor and Panel Appointment Closure and Reassignment

- Supervisor and Panel appointments have a persisted active/ended lifecycle, controlled closure outcomes, mandatory reasons, server timestamps, actors, predecessor/successor links, and immutable lifecycle events.
- The database permits at most one active Supervisor appointment per Student and one active Panel appointment per research profile. Approved applications and recommendations remain historical approval records after an appointment ends.
- Office Staff/Admin may end any active appointment. Programme Coordinators may end only appointments in their managed programme. Direct closure supports `COMPLETED`, `WITHDRAWN`, and `OTHER`; `REPLACED` is reserved for approved handovers.
- Office Staff/Admin initiates exceptional primary Supervisor replacement from View supervision, with a mandatory reason and Office-attributed submission; Students cannot initiate it. See the approved 2026-10-19 rule above. Current Supervisors request Panel replacement through the existing recommendation and approval chain.
- The incumbent remains active during review. Final Coordinator approval atomically ends it as `REPLACED`, activates the successor, updates the research-profile Supervisor when applicable, and records lifecycle events.
- Supervisor replacement preserves active Panel appointments and system-cancels the outgoing Supervisor's in-flight Panel recommendations with immutable workflow events.
- Closure retires unfinished official Marks tasks in scheduled/open periods. Draft values are retained in an immutable handover audit, submitted entries remain unchanged, and approved handovers create clean tasks for replacement evaluators.
- Retired Marks tasks remain visible in authorized history but are excluded from lecturer queues, active totals, overdue totals, reports, dashboard actions, and completion denominators.
- Monitoring, CSV, Workflow Reports, and Progress Dossiers expose authorized lifecycle metadata. Student Panel views remain redacted, and Notifications/Announcements behavior is unchanged.

## Academic Participant Lifecycle Management

- Office Staff/Admin must manage Student and Lecturer academic lifecycle through the nested `/dashboard/participant-lifecycle` workspace; no sixth sidebar module is introduced.
- Student lifecycle states are Active, Deferred, Graduated, and Withdrawn. Lecturer lifecycle states are Active, Retiring, and Retired. Every transition requires a reason, server timestamp, Office actor, immutable audit, and transactional side effects.
- Deferred Students retain active appointments and read-only historical access, cannot start or advance Supervisor/Panel workflows, and have unfinished Marks tasks paused and excluded from operational queues, reports, overdue counts, and completion denominators.
- Reactivation resumes paused Marks tasks only when their original period still accepts submissions and the relevant appointment remains active; otherwise those tasks are retired with immutable draft/comment snapshots.
- Withdrawal atomically cancels pending workflows, ends active appointments as Withdrawn, retires unfinished Marks tasks, and preserves submitted Marks and all history. Graduation is blocked by unresolved approvals or unfinished operational Marks tasks, then completes remaining active appointments and preserves read-only access.
- Retiring Lecturers remain able to resolve existing decisions but are excluded from all new Supervisor, Panel, backup-evaluator, and Marks-task assignments in both candidate queries and direct-ID validation.
- Final Lecturer retirement requires no active appointments, assigned pending decisions, or managed Programme Coordinator responsibility. It retires remaining unfinished tasks, disables login, revokes refresh sessions, and is terminal in the portal.
- Student and Lecturer lifecycle fields cannot be edited through ordinary Django Admin forms because that would bypass domain side effects. Immutable lifecycle and task audits remain readable in Django Admin.
- Office Workflow Reports include participant lifecycle counts and Deferred/Retiring attention records. Internal dossiers include full lifecycle reason/actor/audit data; Student self-view exposes only public status and effective date.
- `docs/Functional Requirements.pdf` and `docs/Use Case Description.pdf` are unchanged binaries. Their confirmation-letter content and older scope wording require later revision from editable academic source files.
- Co-supervisor support follows the agreed implementation policy: one primary and up to two supporting co-supervisors; primary nomination, candidate acceptance, and programme coordinator approval. Each active supporting appointment consumes one supervision capacity slot. Panel nomination and supervisor Marks remain primary responsibilities. Supporting lecturers have read-only research, team, timeline, and workflow access without application documents or Marks. Active supporting appointments survive primary handover; overlapping Panel membership is prohibited. Official faculty policy confirmation and document templates remain pending.
- Supporting nominations require a justification, an active Student and primary supervisor, an eligible candidate, and no duplicate or pending/active Panel conflict. Active appointments and pending requests share the fixed two-position limit; a pending replacement shares its predecessor's position, retaining the outgoing appointment until final approval. Pending requests do not reserve lecturer workload; final activation rechecks capacity and eligibility atomically.
- Candidates and programme-scoped coordinators may reject requests. The nominating primary supervisor or Office may cancel unfinished requests with a reason. Office and programme-scoped coordinators may close appointments with a reason. Rejected, cancelled, ended, and replaced records remain historical; another attempt creates a new nomination. Stale decisions must fail without partial state changes.
- Primary handover/closure cancels unfinished requests from the outgoing primary with an audit while preserving approved supporting appointments. Deferred Students retain appointments but cannot receive new ones. Graduation/withdrawal closure and lecturer retirement checks include supporting appointments and unfinished requests. Ending supporting membership removes current Student-detail access while preserving the lecturer's own history.
- Supporting workflow stages, waiting age, team membership, and lifecycle outcomes appear in existing Supervisor screens, Dashboard actions/timelines, reports/XLSX, workload exports, and authorized dossiers. Reconciliation findings for missing/inconsistent records, duplicates, team overflow, and Panel overlap require review; no automatic supporting-record repair is enabled. No new top-level module, document-upload/template requirement, or automatic promotion to primary supervisor is introduced.

## Workflow Data Quality and Reconciliation Centre

- Office Staff/Admin must have a live scan of persisted Dashboard/Timeline, Supervisor, Panel, Marks, and Workflow Tracking relationships at `/dashboard/workflow-reconciliation`; no issue-status table or sixth sidebar module is introduced.
- Each issue has a stable identifier, current-state fingerprint, module, severity (`BLOCKING` or `WARNING`), repairability (`REPAIRABLE` or `REVIEW_REQUIRED`), affected identifiers, dependencies, and navigation metadata.
- Every repair requires a fresh preview, matching fingerprint, explicit reason, individual confirmation, current-state validation, row locking, and one immutable audit containing actor, action, before/after values, fingerprint, and affected records. Changed or resolved issues return `409 Conflict`.
- Coordinator scope comes only from `Coordinator.programme_managed` after the Coordinator role gate. A missing profile or blank programme may be repaired only for an existing Lecturer account with Coordinator access and a programme represented by persisted Students.
- Legacy semester relationships may be assigned only when persisted labels and dates identify one non-conflicting semester. Historical free-text values remain unchanged; ambiguous records stay `Legacy / Unassigned`.
- Exact-matric unassigned research profiles may be linked only without competing profiles or downstream Panel/Marks history. Profile Supervisor synchronization requires exactly one authoritative active Supervisor appointment.
- Missing approved Supervisor or Panel handoffs require persisted Coordinator actor/date metadata and valid current identity, programme, semester, participant, workload, appointment, and uniqueness checks. Original approval attribution and date are retained while the present repair is audited separately.
- Unfinished Marks tasks may be paused, resumed, retired with snapshots, or generated idempotently. Submitted Marks, evaluator attribution, immutable workflow events, and downstream histories must never be rewritten.
- Role/profile mismatches, downstream-used identity conflicts, and appointment source/replacement-lineage inconsistencies are review-required and expose no Apply action.
- Office Dashboard and Workflow Reports expose reconciliation counts and blocking attention links. Coordinator, Lecturer, and Student users cannot access reconciliation list, preview, apply, or audit endpoints.

## Lecturer Capacity and Availability Management

- Supervisor and Panel capacity must become semester-specific, versioned, role-specific, and Office-configurable through a workspace outside the sidebar.
- A semester cannot activate until one complete capacity plan is published for every lifecycle-Active Lecturer who holds a Supervisor or Panel role.
- Published plans are immutable. Active-semester changes require a new Draft version and atomic publication/supersession with a mandatory reason and immutable audit.
- Office may record separate Supervisor and Panel unavailability windows within semester dates. Existing appointments remain active; new submissions and final activation must respect effective availability.
- Publishing capacity below committed workload is rejected. Draft planning values may be lower; existing appointments and published history remain unchanged. Older policies may still expose `OVER_CAPACITY` until corrected through a new version.
- The shared read-only resolver must apply deterministic `INELIGIBLE`, `NOT_CONFIGURED`, `TEMPORARILY_UNAVAILABLE`, `OVER_CAPACITY`, `FULL`, and `AVAILABLE` precedence. Supervisor load counts active primary/supporting appointments plus accepted primary reservations globally; Panel load separately counts global active appointments and accepted nominations awaiting Coordinator approval. Zero is a valid limit, and resolution never changes existing workflow or appointment state.
- Candidate queries and final mutation endpoints must use this same authoritative capacity resolver. Students receive only public selectability and, when the final state is `TEMPORARILY_UNAVAILABLE`, the applicable availability end date. Every other state returns a null public availability date, and internal availability reasons must not appear in resolutions or conflict messages.
- New semesters may copy only the latest strictly prior semester's Published plan, ordered by semester end date and stable ID, into Draft for Office review. Same-semester, overlapping, future-to-past, and arbitrarily older copies are conflicts. Legacy global limits seed only documented migration baselines and are not authoritative for new semester-bound workflows.
- Capacity plan services create blank Drafts, copy only currently eligible source entries from the allowed prior Published plan, and clone a current Published or Superseded same-semester source into the next version. Every copied or cloned plan records that source through `supersedes`, including cross-semester copies, and exposes the source ID in snapshots and COPY audits. Newly eligible Lecturers and newly acquired roles remain explicit publication blockers instead of receiving guessed limits; ineligible historical source entries and availability windows are not copied. Creation, cloning, entry editing, publication, and new availability restrictions are limited to Draft or Active target semesters; Closed and Archived capacity history is read-only, while historical cancellation remains permitted.
- Draft entry editing and publication require the caller's current capacity-plan content fingerprint. The fingerprint is derived from canonical plan identity/lifecycle data and ordered entry identities, role limits, and update timestamps. Malformed fingerprints are validation errors; stale fingerprints are lifecycle conflicts detected after row locking and before mutation or audit. API write commands accept exact camelCase `expectedFingerprint` and `expectedVersion` fields; this adds no database column or migration.
- Publication requires a non-blank reason and complete role-aligned coverage for every lifecycle-Active Lecturer with a Supervisor or Panel profile. After locking the semester and all same-semester plans, publication locks all entries for those plans in deterministic plan/Lecturer/entry order before fingerprint/readiness validation and supersession; cross-semester entries are excluded. It atomically supersedes any current Published plan, publishes the target Draft, and rolls back every lifecycle and audit change if validation or persistence fails. Zero limits require no commitments for that role. Reductions below live committed workload cannot be published and never alter appointments or workflows.
- Availability services require a Draft or Active target semester, a lifecycle-Active Lecturer with the requested role, ordered semester-contained dates, a non-blank reason, and no overlapping active same-role window. Supervisor and Panel windows remain independent. Cancellation is append-only, requires its own reason, preserves the original dates/reason, rejects stale or repeated cancellation, remains available after semester closure or role/lifecycle removal only for the same persisted semester/Lecturer/role identity, and cannot reactivate a cancelled window. New fully cancelled rows and cancelled-row identity reassignments still require normal role eligibility.
- Every plan creation/copy, Draft entry save, publication/supersession, and availability creation/cancellation records an immutable actor-attributed audit with deterministic JSON-safe before/after snapshots and affected plan, semester, Lecturer, and window identifiers.
- Capacity-plan, entry, availability, cancellation, and capacity-audit management APIs are Office Staff/Admin-only. They expose stable plan/entry/window IDs, semester and version lineage, actors and timestamps, readiness errors, current-published state, current role-specific load/resolution metadata, and internal availability reasons. Other roles receive `403` and never receive these management payloads.
- Capacity management APIs return `400` for malformed camelCase values, `404` for unknown or unauthorized objects, and `409` for stale versions/fingerprints, invalid lifecycle transitions, overlap, publication/readiness conflicts, and concurrent capacity changes. Plans, entries, windows, and audits have no physical-delete API.
- Every capacity-management request body uses an exact field allowlist. Unknown, misspelled, wrong-case, snake_case, and surplus keys return `400` before any mutation or audit; clone accepts only an empty object. This strictness is capacity-specific and does not change existing Academic Semester API compatibility.
- Capacity-plan, capacity-audit, and availability-history lists retain array response bodies but require bounded `limit`/`offset` pagination. The default limit is 25, the maximum limit is 100, offset defaults to zero, and the maximum offset is 1,000,000; malformed, zero/negative limits, negative offsets, or excessive values return `400`. Successful list responses expose `X-Total-Count`, `X-Limit`, and `X-Offset`, including through configured CORS response-header exposure.
- The Office-only DRF permission is authoritative for every capacity management method. Authenticated Student, Lecturer, and Programme Coordinator requests receive `403` before object lookup or metadata dispatch, including `OPTIONS`, `HEAD`, and unsupported methods.
- Semester activation must fail closed with `409` unless the locked target Draft semester has exactly one complete Published capacity plan. The shared capacity-readiness rules are authoritative, and the gate runs before closing a prior semester, closing Marks periods, or writing semester/Marks audits.
- Capacity cutover creates a `MIGRATED_BASELINE` Published plan only for the current Active semester and semesters referenced by unresolved Supervisor or Panel workflows when no Published policy already exists. It preserves prior plan versions, workflow identifiers, relationships, and legacy semester labels; eligible active Lecturer role limits are copied independently and inactive accounts or Lecturers are excluded.
- Guarded fictional demo seeding publishes a complete policy before activating a newly created demo semester. Reruns are idempotent and neither demo seeding nor shared test fixtures may replace or supersede developer-created capacity plans.
- Supervisor applications and Panel recommendations must enforce the published policy for the workflow's persisted academic semester during both validated submission and the locked database mutation, except for an explicit Office carryover reassessment authorization at decision time as defined below. Direct Lecturer identifiers, replacement requests, and stale candidate screens cannot bypass this guard; capacity conflicts return `409` and create no workflow, document, appointment, profile, or audit side effect.
- Existing selected Lecturers remain visible on persisted applications and recommendations after capacity or availability changes. Rejection remains available under existing eligibility guards. Supervisor and selected-Panel acceptance rechecks capacity before reserving a place; final Programme Coordinator approval rechecks the source semester (or explicitly authorized active-semester capacity policy) and leaves the workflow in `PENDING_COORDINATOR` when activation is blocked.
- Supervisor and Panel candidate directories omit `INELIGIBLE` and `TEMPORARILY_UNAVAILABLE` Lecturers. `FULL`, `OVER_CAPACITY`, and `NOT_CONFIGURED` Lecturers remain visible but non-selectable. Candidate and workload rows expose semester, plan/version, state, load, limit, available slots, selectability, and the public availability end date.
- Panel final approval converts the recommendation's existing reservation into an active appointment. The recommendation being approved is excluded from the activation check so its reserved slot is not counted twice, while every other accepted nomination awaiting Coordinator approval remains part of global Panel load.
- Office Workflow Reports and Dashboard actions must expose role-specific capacity-state counts and attention for over-capacity, temporary-unavailability, and active-semester unconfigured policy states. Non-Office reports must not expose the faculty capacity summary or internal availability reasons.
- Existing Supervisor and Panel report/export rows must include the authorized semester, capacity plan/version, state, limit, current load, available slots, and public availability end date. Capacity reporting remains current-state operational reporting rather than historical reconstruction.
- Reconciliation must detect missing or incomplete current capacity plans, role/entry drift, multiple Published plans, overlapping active availability windows, and divergence between authoritative Published limits and legacy profile compatibility values. Only a Draft semester with no policy history and exactly one verified prior Published plan may offer `COPY_CAPACITY_PLAN`; every other capacity issue is review-required.
- Capacity reconciliation repairs must reuse preview fingerprints, mandatory Office reasons, transactional locks, and immutable `WorkflowReconciliationAudit` records. Closed and Archived semesters are historical policy, not missing-plan operational issues.
- The frontend capacity boundary must use typed, backend-only Django services for plan history, plan creation/copy/clone/publication, Lecturer entry updates, availability creation/cancellation, and immutable audits. No mock or silent fallback may be used for capacity configuration.
- `/dashboard/lecturer-capacity` is a lazy-loaded Office Staff/Admin route outside the sidebar. Authenticated non-Office users must be redirected to Dashboard before capacity management content is rendered.
- Shared frontend helpers must provide deterministic capacity labels, zero-safe and 0-100-clamped utilization, role-aware Draft entry validation, semester-bounded availability validation, and clear stale `409` guidance.
- The Office workspace must expose semester selection, complete plan/version history, blank and copied Draft creation, same-semester cloning, version comparison, role-specific limit editing, readiness blockers, reasoned publication, date-ranged availability, reasoned cancellation, and immutable audit history. Mutating plan and new-availability controls are unavailable for Closed and Archived semesters, while valid historical availability cancellation remains supported.
- The workspace must use Kuala Lumpur calendar dates for current/upcoming availability, retain an open command drawer when a stale `409` occurs, reload the latest policy, and require explicit reasons and confirmation for publication and cancellation.
- Office users must be able to reach capacity management from Dashboard, Academic Semester Management, Supervisor Workload Monitoring, Panel Workload Monitoring, and Workflow Reconciliation without adding a sidebar module.
- Student Supervisor selection and Lecturer Panel nomination must treat backend `selectable` as authoritative. Full, Over Capacity, and Not Configured candidates remain visible but disabled where returned; temporary unavailability may be shown only as a public resume date on an already persisted selection, never with the Office reason.
- Lecturer Dashboard, Supervisor Appointments, and Panel Appointments must show the authenticated Lecturer's current published-plan version, capacity state, load/limit, and public unavailability date. Panel capacity must include confirmed appointments plus pending nominations and must not use a fabricated fallback limit.
- A final Supervisor or Panel approval `409` must leave the persisted pending record visible, display the backend conflict, and reload the relevant approval queue. The client must remove a row only after a successful transition.
- Supervisor and Panel workload CSV exports must include Semester Code, Plan Version, Capacity State, Active Load, Reserved Load, Available Slots, and Unavailable Until. Utilization is null-safe and clamped to 0-100, and internal availability reasons are excluded.
- Release verification for this feature must cover all owned backend modules, every frontend TypeScript test, dependency audit, lint, production build and artifact guards, plus live role-scoped checks for Office, Lecturer, Programme Coordinator, and Student access. A browser-only visual pass must be recorded separately when the desktop browser runtime is unavailable rather than inferred from API or source-test results.

## Carryover Capacity Reassessment (2026-09-29)

- Office Staff/Admin may authorize a pending Supervisor application, co-supervisor nomination or Panel recommendation from a Closed semester to be assessed against the effective Active semester's Published capacity policy. The original semester, application documents and approval chain remain unchanged.
- Authorization requires a reason and preserves immutable grant, replacement, revocation and usage history. It does not approve the request, add capacity or reserve new workload. Final approval still enforces current workload, availability, participant eligibility, replacement rules and role conflicts.
- Each authorization is tied to one target semester. If it ceases to be the effective Active semester, Office must reassess again. Archived source records cannot use this route. Without an authorization, existing source-semester capacity rules continue.
- Office may revoke an unused authorization with a reason. Concurrent or stale decisions must fail without partial changes. Final usage records the policy version actually checked, rather than assuming the policy at grant remains current.
- The existing Supervisor Appointment/team workspace exposes original/current capacity and authorized staff history. Office controls mutations; programme-scoped regular and acting coordinators can read relevant records. Students and unrelated users cannot read internal reassessment history.
- Reassessment changes no Marks tasks, drafts, submitted results or completion windows. Normal appointment activation continues to use its existing Marks lifecycle behavior.

## Logical Configuration Corrections (2026-09-30)

- Spreadsheet reports must preserve untrusted text as literal XLSX text and neutralize formula-leading CSV strings, including leading whitespace/control prefixes. Real numeric cells remain numeric.
- Backup reassignment may create a new active task when only retired assignments exist. Retired tasks, drafts and audits remain unchanged. An existing non-retired backup assignment for the same student, evaluator and period returns a conflict without another assignment audit; this includes paused and submitted assignments.
- Marks period opening/closing configuration and task completion windows use explicit Malaysia time (UTC+08:00) for entry, editing and display regardless of device timezone. Invalid calendar dates must not silently normalize.


## Appointment visual polish (24 October 2026)

- Supervisor and Panel appointment views use restrained, consistently mapped Lucide icons across Student, Lecturer, Programme Coordinator and Office Staff/Admin experiences.
- Summary counts, people cards, key headings and navigation retain visible labels; decorative icons are hidden from assistive technology. Existing workflows, status semantics, permissions and Student privacy remain authoritative.
- Preserve readable responsive layouts at desktop and narrow mobile widths without adding a UI dependency. Design rationale and six critique rounds: `docs/APPOINTMENT_VISUAL_POLISH_2026-10-24.md`.


### Research request detail visual coverage (24 October 2026)

- Include research-change and programme-transfer request details in the appointment visual treatment for all roles that can view those records: labelled summary, comparison and approval headings with restrained decorative icons and consistent detail typography. Keep original/requested snapshot labels, audit history and role-specific actions intact.


### Saved research profile and history visual coverage (24 October 2026)

- Extend the same labelled, decorative icon treatment to current research profiles, the Student profile summary and the research-history disclosure. Preserve saved content, revision order, independent disclosures and Office-only correction/transfer capabilities.
- Remove the secondary “Back to students” button from selected research profiles; retain the page-level return link.

### Restrained Office tools visual polish (24 October 2026)

- Extend the existing compact icon treatment to Office dashboard tool groups and key sections in Academic semesters, Calendar, Periods and deadlines, Lecturer capacity and Reconciliation. Keep visible text labels and use icons as decorative aids. Existing workload pages retain their appointment styling.
- Preserve the current page layouts, forms, filters, table content, status meanings, permissions and workflow actions. Use existing dependencies and visual tokens, with no new animation or decorative charts.


## Panel capacity consistency — 29 October 2026

- A submitted Panel nomination is an unanswered request and reserves no place. Acceptance reserves one place until Coordinator approval; rejection/cancellation releases it, and approval converts it to an active appointment without double counting.
- Submission remains blocked when the effective published policy has no available capacity. Multiple unanswered nominations may compete for one place; server acceptance checks decide which can reserve it.
- Pending workflow checks continue to include submitted and accepted nominations for duplicate prevention, participant safeguards, role conflicts, Office reassessment, dashboards and Student projections.
- Panel members see active/reserved/available counts and a short amber last-place warning on acceptance. Full/unconfigured/restricted capacity blocks acceptance while leaving rejection available. Coordinator conversion uses the request's own reservation.
- When confirmed active Panel appointments fill a waiting nomination's effective policy limit, automatically close that unaccepted nomination as Capacity full with System history and notifications to the nominator, Panel member and linked Student. Preserve accepted nominations, archived/missing/stale policies and incumbent replacement appointments.


## Office handoff repair capacity policy — 29 October 2026

- Office repair of an approved Panel request with a missing appointment must use the request's applicable semester policy, rather than the current semester's capacity limit. Detection, available repair actions and activation must agree.
- If Office reassessment was consumed by the approval, retain that recorded target semester for repair even after the target closes; do not revert to the original semester or substitute a newer Active semester. Unconsumed grants still require a current, valid Active target.
- Repair must continue to reject archived source/target semesters, missing or restricted policy, and capacity filled by active appointments or other accepted reservations. Recheck under transaction locks. Preserve original approval actor/date, request semester, reassessment history, idempotence and existing Office authorization.

## Candidate capacity clarity (29 October 2026)

Student Supervisor selection and Lecturer Panel nomination show role-specific remaining places before selection, with an amber last-place indicator. The selected lecturer summary distinguishes active appointments from accepted requests awaiting Coordinator approval. Submitted requests do not reserve places; acceptance reserves a place. Restricted, unconfigured and full candidates retain existing eligibility guards.

## Capacity activity version context (30 October 2026)

The Office capacity activity log remains a newest-first timeline within the selected semester. Each plan-related event identifies its capacity version; availability events are labelled Semester-wide. An immediately applied Version filter defaults to All versions and resets with Clear filters. Copy events identify their source version and distinguish cross-semester copies. Version lists and read-only version details provide shortcuts to that version's activity. Preserve audit reasons, authorization, chronological ordering and server-side pagination.

## Archived semester working-selection boundary (30 October 2026)

Office Lecturer capacity must exclude archived semesters from working choices and defaults, reject archived semester deep links without loading their capacity workspace, and invalidate a selected semester archived elsewhere when returning to the page. Retain archived semesters internally as eligible historical copy sources. Calendar, Periods & deadlines and Marks setup continue their existing lifecycle restrictions. Academic semester history and read-only reports may retain archived records; archived data must not become a working configuration target.

## Consistent Office semester and status presentation (30 October 2026)

Calendar, Lecturer capacity and Periods & deadlines must share the same working-semester selector presentation: sentence-case Academic semester label, dropdown sizing, selected-only menu options once chosen, date-range placement and effective-status badge colours. Keep caller lifecycle eligibility, archived exclusion and busy/navigation guards unchanged. Matching portal statuses use matching semantic tones: Active/Published/Open green, Draft amber, Upcoming blue, Closed/Archived neutral. Preserve historical read-only views and legitimate disabled choices.

### Semester lifecycle confirmation surfaces (31 October 2026)
- Extend end date, End semester and Archive use modal confirmation dialogs, retaining existing reasons, validation and closure acknowledgement requirements.

### Calendar entry usability (31 October 2026)
- Preserve every timeline entry column, provide clear destructive buttons and readable linked-window context, and open the exact linked submission/evaluation window from Manage period.


### Calendar event editing consistency — 31 October 2026

Calendar event editing remains available after linking to a submission window. Linked dates are controlled by that window; unlinked end-date extensions require a reason through the normal event editor.

### Calendar import review usability — 31 October 2026

Excel imports show full project category and schedule-source labels, spaced file actions and ten preview events per page. A successful preview replaces Preview import with a single event-count import action. Existing replacement warnings and acknowledgement remain required.

### Guided Calendar Excel template — 31 October 2026

Office staff receive a readable Timeline sheet and field-by-field Instructions covering required fields, P1/P2, audience codes, dates, replacement behavior and optional existing-period links. Examples use Panel terminology. Action responsibility text remains distinct from Target Roles visibility.

### Simplified calendar-only Excel import — 31 October 2026

Supersedes prior workbook link/Week Label guidance: generated templates contain seven calendar fields only, with no Week Label, Activity Code or Period ID. Import cannot create period links; linking belongs in Periods & deadlines. Preview omits schedule-source/link labels. Replacement must continue protecting existing linked events. Instructions must scroll freely.

### Editable calendar responsibility — 31 October 2026

Create and Edit event expose Responsible parties as responsibility text independent from Target Roles. Imported Action values must remain visible and editable. Include an Office Staff responsibility/audience example in the downloadable template.


## Submission-window overview cleanup — 31 October 2026

Submission-window overview separates window names from programme scope. Timeline-link details stay in Manage window; submission-rule copy is concise. Multiple draft windows remain supported; publication rejects overlapping dates for the same activity and programme scope.


## Window-table alignment correction — 31 October 2026

Replaced obsolete five-column widths with scoped six-column sizing for appointment and Marks windows. Desktop tables scroll inside their container if needed; mobile retains labelled cards. Opens and Closes use identical two-line date/time presentation with explicit MYT. Status and action retain separate space. Validation: TypeScript passed; focused mounted browser checks passed at 1440, 1280, 390 and 320px for both appointment and Marks tables, including column separation, date structure and page overflow.


## Submission-window overview cleanup — 31 October 2026

Submission-window overview separates window names from programme scope. Timeline-link details stay in Manage window; submission-rule copy is concise. Multiple draft windows remain supported; publication rejects overlapping dates for the same activity and programme scope.


## Submission-window overview cleanup — 31 October 2026

Submission-window overview separates window names from programme scope. Timeline-link details stay in Manage window; submission-rule copy is concise. Multiple draft windows remain supported; publication rejects overlapping dates for the same activity and programme scope.

### Submission window detail cleanup - 31 October 2026
- Window details separate settings, calendar connection and expandable history. Once linked, hide link/create controls; retain existing connections. Archive uses the solid red destructive button.

### Submission schedule and readable history revision - 31 October 2026
- Submission-window details use one lifecycle badge, a readable opening/closing schedule with a shared Malaysia-time label, and the same expandable history pattern as appointment records. History reports actual field changes and omits empty personal-extra-time notices.


### Linked calendar schedule warning — 31 October 2026
Linked submission-window schedule editors must show a persistent warning before the date/time fields explaining that saving also updates linked calendar event dates, with the affected event names.


### Compact linked calendar notice - 31 October 2026
Refinement: linked schedule impact must remain visible as a compact, calm information note rather than a prominent warning card.


### Window table status clarity - 31 October 2026
Window overview tables show one schedule status: Draft, Upcoming, Open, Closed or Archived. Publication and scheduling are not stacked as separate status messages.


### Window status spacing - 31 October 2026
Window status and action columns need clear visual separation.


### Date restriction review layout and discard - 31 October 2026
Date restriction review must show shared published windows once with their covered programmes, clearly labelled schedules and visible coverage gaps. Acknowledgement aligns with its text; dirty dialog dismissal uses a separate discard modal.


### Submission access labels - 31 October 2026
Appointment window tables describe submission access rather than schedule alone; published windows with restrictions off show Dates unrestricted.

### Submission availability and entry actions - 31 October 2026
- Student New application actions wait for the availability check and are disabled when the enforced Supervisor window blocks submissions, including retry after capacity cancellation. Existing saved drafts remain accessible; final submission follows the same check.
- Panel recommendations wait for their student-specific availability check before submission. Personal extra time and unrestricted dates continue to follow server permissions.
- Supervisor, Panel and Marks use a quiet availability notice with a readable title and relevant date or explanation; the student workspace notice sits below its heading rather than inside the heading actions.
- Marks with no edit permission remain read only; approved active completion windows continue to allow marking.

### Dashboard timeline event details - 1 November 2026
- Dashboard event previews omit submission status entirely when linked operational dates are unrestricted.
- Restricted linked events use one plain-language schedule status, without publication or enforcement administration labels. Marks uses marking wording without asserting personal task eligibility.
- Event details show dates first, followed by the full project phase name, responsible parties and description, with consistent spacing across role dashboards.

### Office attention empty preview - 1 November 2026
- The Needs attention card uses a compact left-aligned empty message and decorative check icon when no preview items exist. No unrelated Office-tools hint or empty-list footer action is shown. Populated previews retain all attention navigation.

### Compact application availability - 1 November 2026
- Student Supervisor availability should sit with New application, without a separate banner above workspace tabs. Keep the opening time and recheck accessible.

### Supervisor application availability modal - 1 November 2026
- Student Supervisor New application remains clickable when dates block intake. Show a brief Not open yet/Closed label beside it; clicking rechecks current access and either opens the application or explains the restriction in a modal. A failed check offers retry without navigating.

### Supervisor availability presentation refinement - 1 November 2026
- Do not show availability text beside student New application. Explain restricted intake only in the click-triggered modal.

### Supervisor application progress layout - 1 November 2026
- Omit the routine Applications open notice from the application editor toolbar. Keep loading, failed-check and restricted-intake guidance, and existing submission guards.
- Align the desktop progress indicator's first and last markers with the outer edges of the form cards. Keep labels readable and the compact phone progress display.
- Put Draft details and Save draft beside the current step heading above the cards, with wrapping on phones, rather than in a separate row above progress.
- Keep restoration/reselection guidance inside Draft details without a separate visible reminder row; retain accessible restoration announcements and visible actionable errors.

### Concise draft details - 1 November 2026
Draft details uses one short file reminder and last-saved time; omit repeated restoration and saved-state explanations.

Draft details briefly explains automatic reopening and explicit saving before the file reattachment reminder.

### Single required project course code - 1 November 2026
- A new student Supervisor application requires exactly one project course code. Remove the optional label and course-code Add/Remove controls. Incomplete drafts remain saveable; existing records retain their stored codes.


### Document requirement controls — 1 November 2026
- Supervisor document requirements use a larger, clearly selected Active / Inactive / All switch consistent with existing portal controls.
- Add and Edit requirement open a shared modal over the checklist, with unsaved-change confirmation and saving protection. Existing validation and future-submission scope remain unchanged.


### Title origin independent of uploads — 1 November 2026
- Removed the conditional proposal upload and proposal-configuration warning for student-proposed titles. Office-configured required/optional documents apply equally to Student and Supervisor title origins.
- Existing requirement setup, upload security and declaration validation remain enforced.


### Office document setup reminder — 1 November 2026
- Office dashboard Needs attention shows one faculty-wide Configure supervisor document requirements action when no active requirement exists and Office has not explicitly chosen No documents required. It links directly to configuration and disappears for either valid setup.
- Inactive-only configuration without an explicit no-documents choice remains incomplete; students, lecturers and Coordinators do not receive this Office setup reminder.


### Document setup attention row clarity — 1 November 2026
- Show the setup title once, a distinct missing-configuration reason and a Setup required badge. Faculty-wide belongs in the Programme column rather than duplicated beneath the record.


### Explicit no-documents setup — 1 November 2026
- Office may explicitly choose No documents required, with a reason, for future Supervisor applications. This is a valid setup and permits submission without uploads for either title origin.
- Unconfigured setup still blocks submission. Any active checklist item also constitutes valid setup; its required/optional rule remains enforced. No-documents mode and active items are mutually exclusive.
- Students see No supporting documents required in guidance and the application form. The Office setup reminder disappears for either valid setup and returns if neither remains configured. Existing submissions and documents are unchanged.


### Document requirements workspace — 1 November 2026
- Office manages document policy and checklist within one card. Policy changes require an explicit selection, reason and save; existing setup and active-item safeguards remain.
- Configuration history is collapsed by default with 10 changes per page and access to every recorded entry.


### Document requirements visual hierarchy — 1 November 2026
- Use one workspace heading with a compact policy summary and Change policy action. Active/Inactive/All use underline tabs with counts and contextual empty states.

Office Supervisor and Panel attention pages omit the explanatory paragraph above their category cards.

### UAT department coverage
- Manual appointment testing must include same-department and cross-department fictional lecturers; department diversity must not change programme-based Coordinator authority or capacity rules.

### Co-supervisor nomination interaction
- Co-supervisor nomination and replacement open in the shared modal, retaining supervision-page context. Closing an edited form requires discard confirmation; submission remains blocked while busy or ineligible.

- Co-supervisor selection omits the student's current primary supervisor instead of presenting an unusable option.

- Co-supervisor selection supports search by lecturer name, staff number and department, shows availability and marks the selected lecturer in the list. The selected name remains in the field without a duplicate summary card.

- The co-supervisor picker uses a single editable field for both search and the selected lecturer, matching the appointment candidate selection pattern; no nested search field.


### Pending co-supervisor nomination guard — 2026-11-01
Co-supervisor nominations are sequential per student: while any new/replacement nomination awaits co-supervisor or Coordinator review, another cannot be submitted. The existing two-active-co-supervisor limit remains. Pending staff summaries link to the full nomination request instead of embedding its details.

Pending co-supervisor summary action: align View nomination request to the right using a wrapping flex row; workflow rules remain unchanged (2026-11-01).


### Integrated pending team members — 2026-11-01
Pending co-supervisor requests appear directly under Supporting supervisors, without a separate Pending nominations heading or a contradictory unassigned message. Panel summaries similarly show the proposed member and review-stage badge while pending, and avoid duplicate empty-state sentences. Pending Panel names are projected only when the actor may view that recommendation. Existing active members remain visible during replacement.


### Unified request tables — 2026-11-02
Supervisor, Panel and research-change request lists use one table per Requests/History view for all applicable roles. Remove stage-group result headings; review permissions remain role-specific. Requests needing a decision take priority by default before pagination, without overriding explicit Panel sort choices. Final History shows Outcome and omits waiting time; a Panel lecturer’s personal review history retains current stage because acceptance may still await final approval.

### Supporting supervision detail clarity — 2026-11-02
- Separate primary and supporting supervisors with a clear divider; supporting appointment management actions have their own footer.
- Team details show compact completed nomination records linking to the existing request page, where approval progress and audit history remain available.
- Do not repeat activation-only audit history beneath active supporting supervisors; retain subsequent lifecycle changes.

- 2026-11-02: Supporting appointment history belongs below Appointment record in the detail sidebar, with a black and white View nomination request action.

- 2026-11-02: Supersedes the sidebar history placement: omit the Supporting appointment history card from supervision details. Preserve pending nomination access and standalone history/request routes.

- 2026-11-02: Panel review sidebars omit routine capacity count summaries, matching Supervisor review. Show a concise explanation only when acceptance is blocked.

- 2026-11-02: Appointment detail action buttons use the established uppercase labels consistently, including pending request access, Panel recommendations and review decisions.

- 2026-11-02: Related appointment review and nomination actions use shared button font weight, font size, padding and shape as well as uppercase casing.

- 2026-11-02: The co-supervisor candidate picker hides non-selectable lecturers. Supporting and Panel replacement controls show the same Replace label and standard secondary styling.

- 2026-11-02: Primary and supporting supervisors use a visible divider and consistent section spacing across Panel assignment details, supervision details and the Student supervisor overview.

- 2026-11-02: Panel student details show the current appointment and pending nomination without an embedded completed nomination history card. Historical requests remain available through Nomination records → History.


### 2026-11-02 — Rubric family creation modal

Rubric family creation uses one persistent + New rubric family action in the page header, including the empty state. Creation opens a shared modal with cancel and unsaved-change protection; saving selects the new family for component configuration.


### 2026-11-02 — Assessment component workspace

Rubric management prioritises assessment components in a full-width workspace. A compact family/version selector and saved rubric summary replace the sidebar and permanent metadata form. Edit details and Add/Edit component use shared modals; locked versions retain clone-only editing rules. Empty component lists show guidance instead of unused table headings.


### 2026-11-02 — Rubric hierarchy and row actions
Rubric selection must show the selected name once, with compact family/version selection. Assessment marks/readiness belong with the component heading, and row actions must be clearly labelled Edit and Deactivate.


### 2026-11-02 — Rubric placement and column widths
Rubric selection sits below the rubric identity, while Edit details aligns with the title. The component name column receives more width than secondary numeric/state columns.

### Rubric families and archive — 2026-11-02
- Office enters rubric management through a searchable, paginated family table, then opens one family workspace. Family and version selection are no longer combined in a picker.
- Distinguish the current version within each family from actual evaluation-period usage. Multiple families may be available at once; each evaluation period keeps its assigned version.
- Office can archive/restore an entire family with confirmation, including locked versions. Archived families cannot be selected for new evaluation setup or edited/cloned; existing periods, tasks, criteria and marks are retained.
- A Status dropdown (Available / Archived / All), rather than another tab switch, provides access to archived families.

### Rubric version clarity — 2026-11-02
Unarchived rubric versions offer NEW VERSION whether locked or editable. Confirmation explains copying criteria, selecting the new current version and retaining existing evaluation references.

### Rubric action spacing — 2026-11-02
Rubric actions are separated by purpose: NEW VERSION in the page header, EDIT DETAILS in the summary header, ARCHIVE/RESTORE FAMILY in the summary footer.

Placement correction: ARCHIVE/RESTORE FAMILY stays beside EDIT DETAILS in the summary header; NEW VERSION remains separate in the page header.


### Mark Entry Periods entrance — 2026-11-02
Mark Entry Periods entrance follows the rubric-family list structure: page-header New period action, search, current/archived status filter, paginated table and Manage period action. Remove the Manage semesters shortcut. Deeper period configuration remains unchanged.


### Period editor spacing and navigation — 2026-11-02
Period editor uses distinct details, recipients and schedule sections with shared dropdown dimensions. New period appears only on the entrance; editor navigation is a single back link above the title. Existing archive remains restricted to closed periods with its required reason and confirmation.


### Period preview and history — 2026-11-02
Recipient estimates open on demand in a modal; period configuration history is a separate collapsed card.


### Rubric total feedback — 2026-11-02
Rubric total badges distinguish below-target, over-target and ready totals.


### Rubric reactivation and code case — 2026-11-02
Inactive editable rubric components expose Reactivate with confirmation. Newly entered family codes retain capitalisation; case-only duplicate family codes are rejected.

### Period configuration layout refinement — 2026-11-02
Period configuration keeps recipient settings in the Recipients section, separates recipient preview from save/publish actions, and provides a distinct collapsible configuration history.

### Scalable recipient preview — 2026-11-02
Recipient preview supports search, evaluator-role filtering and ten tasks per page, with compact totals and optional exclusion counts.

### Recipient preview pagination visibility — 2026-11-02
Recipient preview hides pagination controls when filtered results fit on one page; the result count remains visible.

### Period publication confirmation clarity — 2026-11-02
Publication confirmation separates period identity, programme scope, evaluator roles and recipient estimate. Counts use singular/plural labels and publishing uses an informational confirmation.

### Period closure workflow and reuse review — 2026-11-02
Published mark entry periods show an explicit Close period early action. Reason, unfinished-task review and acknowledgement are shown together in a modal only after opening the action; discarding entered details requires confirmation. Remove the deadline shortcut from the configuration schedule.

### Published period footer navigation — 2026-11-02
Published period footer places Manage periods & deadlines immediately before Close period early.


### Marks overview and period monitoring — 2026-11-02
Marks overview uses an explicit academic semester scope, aggregated open-period/task/submitted/overdue metrics, and a paginated comparison of period progress with evaluator roles. Student records remain on the dedicated records page. Overview links preserve semester, period and status filters.

Marks overview semester context (2026-11-02): Show the selected academic semester's start/end dates beneath its selector, with 24px separation before summary cards. Dates use the existing academic semester API and Malaysia date formatter; unavailable date metadata does not block marks content.



### Evaluation task workspace — 2026-11-02
Evaluation task generation offers published Open/Scheduled periods with concise name and evaluator-role labels; closed and archived records remain accessible in Mark Records.

### Explicit mark-entry period closure — 2026-11-03
Closing a mark-entry evaluation period retires all its unfinished active or paused tasks and ends their completion windows. Submitted marks, saved drafts and audit history remain preserved. Office must review the current signed preview, acknowledge retirement when unfinished work exists, and provide a closure reason. This supersedes the keep-for-completion behaviour for explicit period closure; semester closure and natural deadline expiry are unchanged.

### Lecturer mark entry layout — 2026-11-03
- Supervisor, Panel and backup marking use the same full-width editor, aligned score fields, full-width feedback and a contained total/action footer.


Office mark records use bold field labels and regular-weight answers, with full-width component feedback and modal correction/reopening forms.

Office assessment review uses a compact student overview, comparable component scores and full-width feedback. Long feedback is expandable without losing access to its full text.

- Lecturer submitted mark records use the same student overview and assessment-results hierarchy as Office records, with bold field labels, smaller regular answers and expandable long feedback. Lecturer submissions remain read-only.

- Lecturer submitted mark details show consistent period/rubric context and dates/activity from both the task list and submission history. Missing optional data is omitted.

- Office and Lecturer mark record dates use the same compact date/time presentation, with Malaysia timezone identified once per dates/activity section.

- Office marks correction/reopening dialogs: added matching rounded-square close controls with unsaved-change protection; score and comment fields use explicit padding and heights because portalled dialogs do not inherit workspace styles. Component feedback remains preserved and read-only in the correction workflow.

- Successful evaluation-period saves must show the success notification without a transient refresh-failure warning.

- Submission monitoring distinguishes task readiness from schedule: Tasks needed, No eligible recipients, Awaiting submissions, In progress, Complete and Overdue. Generate tasks opens the matching period for review; empty totals are not clickable.

- Monitoring task-status badges and their actions share one compact horizontal row.

- Evaluation task table actions use the standard View button and align with the Action heading.

- Assignment activity uses evaluation-task terminology consistently with the generation button.

### Coordinator Marks Entry access - 3 November 2026
Programme Coordinators must not see or open the Marks Entry module. Office and Lecturer access is retained.

- Operational Marks period details present evaluation configuration as the primary button and deadline extension as a secondary action, grouped at the card's lower right with distinct icons.
- Published Supervisor and Panel submission windows group deadline extension and early closure actions at the card's lower right, with distinct calendar icons and danger styling for early closure.

- Lecturer marking task details use /marks/tasks/:taskId and submission history uses /marks/history. Refresh, direct links, browser Back/Forward and marking-role URLs preserve task identity and draft-leave protection. Existing appointment shortcuts remain valid; other module routing is deferred.

- Lecturer marking task fallback UI: standard detail heading and back navigation above a compact state card; loading, unavailable and error states share the layout. Task access and routing rules are unchanged.
- Supporting-supervisor request details use two vertically stacked appointment-style cards: Request summary, then Review and outcome. Each card has a relevant icon and the existing section typography hierarchy. Role-appropriate actions sit at the lower right of Review and outcome without an Available actions heading; reviewer accept/reject actions use the shared appointment-workflow controls. The detail view does not add a separate audit-history section.
- Supporting-supervisor request summary fields distinguish their labels, primary values and secondary student identifier using the shared appointment-detail type scale; body values remain comfortably readable and visually subordinate to card headings.
# Draft evaluation period cleanup (7 November 2026)

Office Staff/Admin can permanently delete an unpublished evaluation-period draft from its configuration page. Deletion requires explicit confirmation, discards any unsaved edits, and is rejected when the draft has evaluation tasks or a linked semester timeline entry. Published and closed periods retain their existing lifecycle and archival rules.

From the Mark Entry Periods list, each draft row exposes Delete draft in its Action column below Manage period. Manage period stays on one line; non-draft rows show only Manage period.


Draft deletion is available inside the period configuration footer. Closed periods place Archive in the same footer position and use the same danger button treatment.

- Published evaluation periods past their deadline offer Close period; those still within their schedule offer Close period early. Formal closure retains the unfinished-work review.

- Rubric editing labels evaluator role selection “Rubric for” and identifies existing unset roles as not configured; a role selection remains required before saving.

- Unconfigured rubric roles use a prompt rather than a selectable dropdown option; selecting a role remains required.
