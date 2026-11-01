## System-wide README (28 October 2026)

Replaced the five-owned-module introduction with a whole-system overview covering the combined team project: roles, all portal modules, the appointment-to-evaluation workflow, Registry, Letters, File Repository, Announcements/Notifications, FAQ/chatbot, and Settings. Expanded the stack and repository map, retained development/demo guidance, and documented backend-integrated frontend configuration, verification commands, and operational references. Module ownership boundaries remain separate. Requirements and architecture documents were reviewed; no product requirements, runtime architecture, or application code changed.

Verification: checked module descriptions against local routes/services and backend references; all 10 local documentation links and anchors resolve, Markdown fences are balanced, all 10 listed backend module directories exist, the four documented npm scripts and Node minimum match package.json, and all eight PowerShell examples parse without errors. A separate reader review found no actionable issues. Corrected the frontend test locations during the final source check. Whitespace checks pass. Application tests were not rerun for this documentation-only update; the pre-existing local-server status note is preserved.

## Branch integration and release (28 October 2026)

All pending session changes are recorded in separate appointment UI, Office authorization, carryover acceptance and documentation commits. Integrated origin/main at 423a2a4 into codex/portal-consistency-and-toast with a normal merge. Resolved both content conflicts by retaining main's redesigned letter-management and staff-account screens; preserved profile ownership guards, incoming AccountChange inspection and contextual marking routes. Updated obsolete alignment fixtures to current production workload components and removed two incoming trailing blank lines.

Pre-merge verification: all 1,587 backend tests passed in a disposable PostgreSQL database (983.288s), 374 frontend checks and seven affected browser suites passed. Merged-tree verification: all 382 frontend checks, eight affected browser suites, TypeScript and production build passed (17.58s; existing ExcelJS chunk advisory). The selected merged backend integration gate ran 756 tests in 128.974s with no failures and two skips, covering accounts, letters, FAQ, protected admin, Office browse/replacement and Marks corrections. Django system checks, migration drift, dependency consistency, whitespace checks and credential-pattern scanning passed. The initial backend merge run hit missing FAQ dependencies; installed main's declared fastembed dependency and the complete selected rerun passed. No live academic writes, account conversion or deployment performed.

## Office approved request supervisor change (28 October 2026)

- Added the missing Office **Request supervisor change** action to the approved request's **Manage appointment** section, using existing server eligibility and replacement workflow.
- Cancel returns to the same request; successful submission returns with confirmation and refreshes the record and availability. Pending/ended appointments do not expose another change action; failed reads have a retry.
- Validation: 51 request-detail browser viewport scenarios, 7 replacement recovery browser scenarios, 9 focused unit checks and TypeScript and production build passed (2490 modules; existing ExcelJS chunk-size advisory).
- No live replacement request was created. Changes remain uncommitted and unpushed.

## Panel nomination history action placement (28 October 2026)

Moved completed nomination history out of the current-action sidebar into a full-width section beneath Student Panel details. View request is attached to its row and right aligned on desktop; mobile entries stack with their own action below. No duplicate filters or new nomination controls added.

Verification: 12 focused checks passed; 88 browser viewport scenarios passed across assignment details and assignment/workspace navigation. The actual routed Lecturer student-detail test checks section placement/width, row action alignment, phone stacking, touch-target size, exact request opening and roster-filter return. Expanded desktop/phone fixture screenshots were visually reviewed. Final TypeScript and production build passed, with the existing ExcelJS bundle-size advisory. No commit, push or live data mutation included.

## Labelled appointment management controls (28 October 2026)

Completed the approved management-button refinement for shared compact Supervisor/Panel cards: initially collapsed Manage appointment; directly visible approved-application/marking shortcuts; explicit end labels; Request supervisor change wording. No permissions, workflow transitions, confirmation outcomes or mandatory reasons changed.

Validation: 18 focused checks passed; 162 viewport browser scenarios passed across Panel assignment details, supervision details, Panel requests and Supervisor requests. Tests cover collapsed/expanded management, read-only omission, role-specific actions, busy state, exact ending payload/reason guard, marking navigation and request routing. TypeScript and production build passed with the existing ExcelJS bundle advisory. No commit/push performed; stop for user comments.

## Staff appointment details and contextual marking (28 October 2026)

Implemented the approved rethink for staff supervision and Panel appointment/assignment details. Removed congested sidebar history, duplicate embedded approval and shared semester-date blocks. The remaining sidebar separates source navigation from permitted appointment management; Change supervisor uses the outlined secondary treatment on these detail pages. Full-width actual appointment changes remain collapsed below content, while pending supporting nominations stay compact beside the supervisory team.

Added parity for Lecturer marking shortcuts: exact student and Supervisor/Panel responsibility; state-specific labels; multiple-period list; no invented task/button; read-only handling; exact submitted-mark navigation; scope escape and retry. Office/Coordinator personal-task requests remain absent. Existing request review pages and Student appointment overviews retain their established behaviour.

Verification: 27 focused frontend checks passed. Five browser suites passed 188 viewport scenarios (48 Panel assignment/detail, 42 supervision detail, 45 Supervisor request, 27 Panel request, 26 Marks feedback). Final compact-nomination polish also passed a fresh 42-scenario supervision rerun. Coverage includes actual request hosts, marking destination/role/student identity, submitted and noneditable work, multiple periods, absent tasks, busy/role/privacy boundaries, lifecycle controls and responsive geometry. Desktop fixture screenshots were visually reviewed; synthetic data only. Final TypeScript and production build passed; only the existing ExcelJS bundle-size advisory remains. No live data mutation, commit or push performed. Stop for user comments after this phase.

## Request history simplification (28 October 2026)

Completed the approved follow-up: removed duplicate audit disclosures from Supervisor/Panel request details, preserved decision comments, and limited appointment-record history to changes after initial creation. Creation-only records have no empty history section; ending/replacement evidence remains available under Appointment changes.

Verification: 19 focused frontend checks and 72 request browser scenarios passed across desktop, tablet and phone widths. TypeScript passed. Production build passed with the existing ExcelJS bundle-size advisory. No live records were modified; no commit or push is included. Stop after this follow-up for user comments.

## Appointment sidebar consistency phase (28 October 2026)

Implemented this phase only: consistent request review cards; common compact appointment records; separate approval/appointment history; authorised source-request tracing; Supervisor semester dates below the workspace; approved Panel nominations retain request navigation. Also corrected the remaining larger lifecycle variant in the nomination-history host.

Verification: 34 focused frontend checks passed. Five browser suites passed: 39 Panel appointment, 42 supervision detail, 45 Supervisor request, 27 Panel request and 40 assignment/workspace scenarios (193 viewport scenarios total). Coverage includes the actual Office request-list host, exact Coordinator request host, read-only source navigation, approval identity mismatch/retry, sidebar gaps, desktop/tablet/phone layouts, Student privacy, existing lifecycle guards and return/filter behaviour. Production build passed with the existing ExcelJS bundle-size advisory. TypeScript passed. Desktop and phone fixture screenshots were visually reviewed, including the corrected gap between Supervisor sidebar cards. Browser screenshots are synthetic fixture data; no live records were changed.

The user requested stopping after this phase for comments. No following phase, commit or push is included.

## Supervisor capacity commit preparation (28 October 2026)

User requested commit and push after accepting the completed plan. Prepared a capacity-only change on `codex/portal-consistency-and-toast`, including feature code, migration, regressions, source-of-truth sections, verification reports and UI previews. Unrelated Office authorization/admin, Marks, carryover and concurrent appointment-layout changes are excluded, including unrelated hunks in shared files. The exact isolated index snapshot passed 350 backend tests (76.790s), 19 focused frontend checks, 28 desktop/phone browser scenarios, TypeScript and production build (12.43s). Approved-application navigation checks and seven adjacent Coordinator/Office/feedback checks also passed in that snapshot; the shared-checkout navigation regression is not included. Credential-pattern scanning and scoped whitespace checks passed. The existing baseline Panel typography check remains separately documented; these results do not claim a fully green whole-project suite.

## Supervisor capacity follow-up review (28 October 2026)

Reviewed current reservation/closure, locking, policy scope and role UI with an independent read-only reviewer. Fixed two reproduced UI issues: Office-managed replacement closure incorrectly invited Student self-application, and request details invented numerical availability for missing/restricted policy. Split an obsolete publication test into submitted/non-reserved and accepted/reserved stages without weakening validation. Fresh gates: 350 backend integration checks, 19 focused frontend checks, 28 capacity browser scenarios and 45 shared request browser scenarios passed. TypeScript, production build (21.63s), Django checks, migration drift and scoped whitespace passed. Independent re-review found no additional actionable issue in the scoped fixes.

Final whole-frontend result: 371/373 passed. Existing Panel typography-class assertion and approved-application navigation with a partial DTO remain failing outside the capacity changes; unrelated concurrent appointment-layout code was preserved. No live academic writes, migration, secrets/environment changes, commit or push during this review. Full evidence and exact remaining tests: `docs/SUPERVISOR_CAPACITY_REVIEW_2026-10-28.md`.

## Last-place warning clarity (28 October 2026)

Replaced the long plain-text acceptance warning with the existing amber AlertMessage, warning icon, bold Last available place title and concise reservation/closure copy. Clarified that already-full lecturer submissions are blocked; automatic closure follows final approval filling capacity for earlier unaccepted requests. No backend/policy changes. New visual/conciseness regression failed before implementation, then all 26 mounted desktop/phone scenarios and 17 focused component checks passed. The example now consistently contains two total requests and one other pending request, with singular-wording coverage. Updated screenshots saved under `output/supervisor-capacity-reservations-20261028/`; final TypeScript and production build passed (17.28s). Existing unrelated Panel typography assertion and ExcelJS bundle advisory remain. No academic writes, commit or push.

## Request appointment record positioning fix (27 October 2026)

Fixed detached full-width appointment lifecycle cards in shared Supervisor and Panel request layouts. Appointment records now sit below review in the same sidebar; request hosts use compact facts and existing controls/history. Verified 69 production-CSS browser scenarios across 1440/1024/390px and ten focused component checks. Production build passed; populated desktop and phone screenshots reviewed. Final TypeScript check passed after correcting test fixture typing. Existing ExcelJS bundle-size advisory remains. Concurrent capacity and authorization changes are preserved; no commit or push performed.


Follow-up: the initial fix missed CoordinatorSupervisorApprovals appending its lifecycle card outside the shared detail component. Moved that actual route render into the sidebar slot and removed the separate page-bottom render. The actual routed Coordinator component now has a permanent browser regression at desktop/tablet/phone widths; all 45 Supervisor browser scenarios and the focused Coordinator checks pass. Live Vite serves the updated Coordinator module. Final follow-up TypeScript and production build passed; actual routed Coordinator desktop fixture screenshot reviewed. Existing ExcelJS bundle advisory remains. No commit/push performed.

## Supervisor capacity reservations (completed 28 October 2026)

Implemented primary acceptance reservations, atomic conversion/release, system capacity-full closure scoped to each unaccepted request's effective policy, immutable audits/notifications, and consistent publication/Office/workload/dossier/reconciliation projections. UI distinguishes active/reserved/available counts, warns at the last place, uses request-specific confirmation and fetched Student identity, preserves rejection/cancellation, and offers eligible recovery after neutral Capacity full outcomes. Supporting nomination acceptance retains its original non-reserving semantics. Existing incumbents and accepted/archived/higher-limit/unconfigured requests are preserved.

Verification: 135 workflow integration tests and 213 capacity/history integration tests passed (overlapping gates); the primary agent independently reran all 18 new backend regressions in a disposable PostgreSQL database. Final focused frontend checks passed 18/18 and mounted capacity browser checks passed 26/26 at exact 1440/390px. The settled broad frontend run passed 362/363; the sole pre-existing PanelSpecializedTools line31 typography-class assertion was reproduced separately and left unchanged. Later scoped confirmation changes passed their focused/browser gates. Django checks/migration drift and scoped whitespace checks pass. Final TypeScript passed and production build completed in 18.48 seconds. Independent review's two P2 findings were fixed and rechecked; final small copy/identity fixes received direct review/regressions after the account limit blocked a further independent pass. Desktop/phone previews inspected and saved. Details: `docs/SUPERVISOR_CAPACITY_RESERVATIONS_2026-10-28.md`.

No academic records, secrets/environment files, commit, push or deployment changed. The primary agent inspected the migration plan (0019 only) and generated SQL (no-op), applied the status-choice migration to the local development database, and verified 0019 marked applied. This updates migration history without changing tables or academic data. Unrelated dirty checkout and concurrent request-layout work remain preserved. Existing ExcelJS bundle advisory and the unrelated Panel test failure remain.

## Coordinator dashboard scope cleanup (27 October 2026)

Implemented compact Your programme summary, conditional temporary cover and collapsed access history. Office delegation controls preserved. Verified: coordinator delegation rendering/date checks, programme-summary state coverage and API contract checks passed; TypeScript and production build passed. Existing ExcelJS bundle-size advisory remains. Included in the coordinator dashboard UI commit; unrelated shared-checkout work is excluded.

## Workload detail redesign (27 October 2026)

Implemented shared three-card hierarchy for Supervisor and Panel workload details, regular readable answers, prominent used/available totals, role-specific breakdowns and compact capacity explanations. Existing metadata and workload tables retained; no backend or academic-data changes. Verified: five focused workload checks, 12 production-CSS browser scenarios at 1440px/390px, TypeScript and production build passed. Populated desktop/mobile fixture screenshots visually inspected; research titles span the mobile record width. Independent review found no actionable issues. Existing ExcelJS bundle-size advisory remains. Development server is listening on port 3001. Included in the workload UI commit; unrelated shared-checkout work is excluded.

## Final appointment review and release verification (27 October 2026)

Completed static review of appointment navigation, contact projections and role privacy; no remaining actionable findings. Aligned Student supporting-supervisor public contacts using the shared member component. Fresh verification: all 350 frontend checks passed, six affected component checks passed after the adjustment, ten responsive browser suites passed (the two affected suites rerun after the adjustment), 36 backend tests passed in a disposable database, TypeScript and final production build passed. Desktop/mobile populated fixture screenshots inspected. Existing ExcelJS bundle-size advisory remains. An initial backend run used a nonexistent module name; the corrected complete command passed. Unrelated shared-checkout Office/admin, authorization and carryover changes are excluded from these commits. Programme-transfer relocation and Marks template work remain deferred.

## Supervisee roster header spacing (27 October 2026)

Adjusted the roster card to even padding and removed the generic header's reserved title width. The heading and Nomination records button share a centred wrapping row; the secondary action uses compact sentence-case text with its existing 44px hit area. No navigation or workflow changes; requirements and architecture reviewed with no changes needed. All 40 workspace browser scenarios passed at desktop/mobile widths; scoped diff checks passed.

## View student Panel detail redesign (27 October 2026)

Completed: separate detail-page title/Back placement; student overview; current Panel public contacts and actual appointment date; current research; prominent nominate/replace/pending-request controls; collapsed completed nomination history replacing the full filtered table. Mobile prioritises nomination controls. No internal staff number in this detail overview. Exact history/form return and roster filter retention verified. Validation: 40 workspace browser scenarios + 33 assignment/detail browser scenarios, 12 focused component checks, 8 backend projection tests in a disposable database, and TypeScript passed. Populated fixture screenshots at 1280px/390px visually reviewed. Backend restarted for new contact projection; no live academic data mutated.

## Nomination records consistency correction (27 October 2026)

Corrected nomination records consistency: Requests / History restored and More filters removed; all existing filters remain visible. Verified: 38 desktop/mobile browser scenarios, 5 focused component checks and TypeScript passed.

## Panel first-page navigation revision (27 October 2026)

Replaced the nested Students / My nominations switch with a focused supervisee roster and dedicated Nomination records page. Preserved the three module tabs on the workspace, record history for former supervisees, filters and exact request navigation. Removed repeated general guidance from My supervisees. Search/status remain visible on nomination records; secondary filters are disclosed. Verified 38 browser scenarios at 1280px/390px, including real Lecturer host integration, one visible record page, Back above title, former-student request open/return, retained roster/history state and browser Back. Seventeen focused component checks passed. Desktop/mobile records screenshots visually inspected. Final TypeScript validation passed.

## Panel supervisee list workspace (27 October 2026)

Implemented the first-page-only Lecturer My supervisees redesign: Students / My nominations switch, one visible filter panel and table, preserved former-supervisee history, and View student action. Existing module tabs and student detail layout remain. Browser verification passed 38 scenarios across 1280px and 390px, including filter/history retention, exact student/request callbacks and no horizontal overflow. Both responsive fixture screenshots were visually reviewed. Final TypeScript and 17 focused component checks passed.

## Lecturer Panel assignment academic team (27 October 2026)

Implemented the next Lecturer Panel assignment phase: Academic team replaces the self-focused Panel member card, visible student contact and consistent team spacing, no staff-number overview, and existing Marks/history sidebar. Added exact-record loading/retry and public-only current-team projection. Verification passed: all 350 frontend checks, 33 Panel browser scenarios plus 39 shared Supervisor layout scenarios at desktop/tablet/phone widths, seven backend projection/access tests and TypeScript. Desktop/phone screenshots inspected; backend restarted and confirmed listening on port 8000.

## Supervisor team contact hierarchy (27 October 2026)

Implementing the approved Supervisor card restructuring first. Added consistent contact metadata for current primary/supporting members, removed doubled section padding/dividers, grouped supervision and separated Panel evaluation. Existing Student overview and standalone Panel assignment layouts are retained. Verified: 350 frontend checks, 39 responsive layout scenarios at desktop/tablet/phone widths, six backend contact/access/privacy tests and TypeScript passed. Desktop/phone rendered layouts inspected; local backend restarted to serve new contact projections.

## Supervision team actions and nomination form (27 October 2026)

Moved supervision detail nomination and Panel actions to section headings; added icons and 44px targets. Reworked the co-supervisor form to match detail-page typography and spacing, retaining student context and existing validation/recovery. Verified: 39 browser layout scenarios at 1440/1024/390px, six mounted submission/recovery scenarios, six scoped component checks and TypeScript passed. Desktop and phone form screenshots were inspected.

## Stable appointment tab layouts (27 October 2026)

Audited Supervisor, Panel, research and Marks list/history structures across Student, Lecturer, Coordinator and Office. Fixed Lecturer Supervisor and Panel summary disappearance on History, retained Supervisor guidance in both views, and removed duplicate history count. Existing tabs, request partitioning, filters and source navigation are preserved. Browser regressions reproduced both summary failures before the fix; Verification passed: all 350 frontend checks, 36 mounted browser scenarios at 1280px/390px (including Student, Lecturer, Coordinator and Office filter stability/navigation), TypeScript and scoped diff whitespace checks.

## Supervisor request empty action divider (27 October 2026)

Removed empty Lecturer and Coordinator action slots on completed Supervisor requests. Approval progress and audit history are retained; pending decisions and ineligibility notices remain available.

# Project Status

## Panel overview button removed (27 October 2026)

Removed View approved nomination from the Student Panel appointment card. Updated affected component/browser checks to omit the removed action and exercise existing public record links directly. Seven scoped component checks pass; browser and TypeScript verification completed separately. No backend or academic data changes.

## Student Supervisor tabs restored (27 October 2026)

Restored the original My supervisors / Applications / Research changes navigation above the overview, matching the other workspace pages. Removed duplicate application/research links from inside the appointment card. The new public details, matching cards and approved-record header actions remain. The tab-presence regression failed before restoration and the three affected component checks pass afterward; all 42 browser scenarios and TypeScript also pass. No backend or academic-record changes; unrelated shared work preserved.

## Student appointment redesign correction (27 October 2026; complete)

Replaced the rejected floating-metadata layout with matching Supervisor/Panel appointment cards: source action in the header, name/status, identical department/email/appointment-date/semester/programme grid, existing current research and next-step aside. Added real Supervisor public contact/date/semester metadata through its Student projection. Removed Panel's unmatched manual refresh control; automatic focus reload/retry remains. Moved Supervisor application/history/research navigation inside its overview card and preserved supporting appointments/history. Added View approved nomination and an exact-ID public Student source page for the current approved Panel appointment, including recorded dates and nominating supervisor without private staff comments/audit/reasons. Missing/foreign references cannot substitute another record, and source loading/error preserves back/retry.

New source-projection and card regressions failed before implementation. All 350 frontend checks, 42 production-CSS browser scenarios at 1440/1024/390px, 20 backend tests in a unique disposable database, TypeScript and production build pass. Independent read-only review found no actionable issues and independently passed eight scoped checks. Restarted the existing no-reload backend; authenticated actual Student Supervisor/Panel pages captured at 1536/390px and visually compared without horizontal overflow. Live source buttons opened approved Supervisor application 6 and Panel nomination 15; the Student response still withholds the staff number and now supplies the approved public source. Root docs updated; unrelated shared edits preserved. Existing ExcelJS build-size advisory remains. No academic data changes, migration, dependency change, commit or push.

## Student Supervisor/Panel consistency and approved-application traceability (27 October 2026; complete)

Aligned Student overviews using shared compact academic context, appointed-member presentation, full current research and contextual What happens next aside/mobile stack. Removed the redundant Panel student-identity card and internal staff-number display. The student API now returns null for the legacy panelMemberId key; staff records retain identifiers. Supervisor guidance no longer loads or displays new-application requirements for confirmed/pending students. Preserved existing application/research navigation, supporting-supervisor history, active appointment continuity, dual-confirmation Panel privacy, prerequisites, FAQ and retry/refresh behaviour. The dark View approved application action remains beside the current supervisor and opens the active appointment's original request; a newer pending replacement and older ended approval cannot replace its destination. Missing legacy source requests do not generate a link. Main overview actions have 44px targets.

Privacy/contextual-guidance regressions failed before their fixes. Verification passed all 348 frontend checks, the final 15 affected frontend checks, 36 production-CSS browser scenarios at 1440/1024/390px, and 19 backend tests in a unique disposable database. TypeScript and production build passed; existing ExcelJS bundle-size advisory remains. Independent read-only review found no actionable issues and independently passed six scoped checks. Authenticated existing Student Supervisor/Panel pages were captured at 1536/390px and visually reviewed without overflow; the live approved-application action opened the student's approved request. The development backend used --noreload and was restarted to load the student projection change. Root documentation updated; unrelated shared work preserved. No academic records changed, migrations, dependencies, commit or push.

## Panel nomination form/list polish — Phase 4 (27 October 2026; complete)

Completed independent Student overview, nomination editor and on-demand current-research reference using shared typography and 28px desktop/mobile spacing. Removed redundant selection decoration and repeated warning/status panels; placed compact validation beside Submit. Candidate search now supports input-focused arrow/Enter/Escape/Tab interactions, skips unavailable candidates and exposes listbox/option selection semantics. Existing capacity revalidation, intake enforcement, required notes/replacement reasons, current appointment continuity, exact trimmed payload, busy guards, inline failure draft retention and dirty navigation confirmation remain. Common staff request/assignment/supervisee lists retain automatic shared filters, partitions, pagination, export and destinations, with exact named 44px record actions. Updated the existing feedback fixture from a fixed popup ID to semantic listbox selection and two prior typography assertions to the approved regular research/clear identity hierarchy.

The new keyboard/accessibility regressions failed before implementation. All 348 frontend checks, 27 new production-CSS nomination browser scenarios, 32 existing assignment/navigation scenarios and six adjacent feedback/recovery scenarios pass (65 browser scenarios total). TypeScript and production build pass. Independent read-only review found no actionable findings and independently passed five scoped component/workflow checks. Authenticated existing supervising Lecturer replacement form was captured and visually reviewed at 1536/390px without horizontal overflow; only normal session authentication and reads occurred, with no nomination submitted or academic record changed. Root requirements/design/status documents updated. Existing ExcelJS bundle-size advisory and unrelated shared checkout work preserved. No backend, API, permissions, schema or dependencies changed. No commit or push. The four approved Panel consistency phases are complete.

## Student Panel overview — Phase 3 (26 October 2026; complete)

Completed independent Student overview, confirmed Panel member, readable current research and compact contextual guidance using the approved shared spacing/typography and desktop aside/mobile stack. Pending supervisors are explicitly proposed; confirmed member fields retain the dual status/readiness gate. The existing public Student projection, current appointment continuity, prerequisite/FAQ navigation, missing-data honesty and loading/error/retry/focus reload remain. Connected the previously unused optional refresh callback to a named 44px control with a busy guard. No pending nomination identities, staff reasons, internal decisions or audits are exposed.

Three new regressions failed before their corresponding implementation; all five new checks and existing affected coverage pass. The full frontend suite passed 348 checks; 24 production-component browser scenarios passed at 1440/1024/390px, covering every readiness state, privacy, long content, navigation, callbacks, service failure/retry and refresh transitions. TypeScript and production build passed. Independent read-only review found no actionable issues and independently reran the five new checks. Captured and visually inspected authenticated existing Student pages at 1536/390px without horizontal overflow; no academic records changed. Root requirements/design/status documents updated. Existing ExcelJS bundle-size advisory and unrelated shared checkout changes preserved. No backend, API, schema, permission, dependency changes, commit or push. Phase 4 nomination form/list polish remains pending.

## Panel appointment detail consistency — Phase 2 (26 October 2026; complete)

Implemented the approved staff assignment/appointment composition: separate student overview, appointed member and readable current research, compact lifecycle sidebar/mobile stack, and on-demand nomination/review history. Preserved terminal dates/outcomes/reasons/actors, exact student/Marks callbacks, Office lifecycle confirmation, Coordinator capability gates and request-route defaults. Supervisor supervisee details show appointed and proposed replacement members in independent surfaces; Office attention overview shares the new hierarchy without inventing missing concurrent request data. Student overview/form/list redesigns remain later phases.

Seven new layout/capability regressions were exercised before their corresponding fixes. Fixed missing-lifecycle nomination-history retention and removed the unsupported No ongoing request claim from active Office overview payloads, which may omit a concurrent replacement. The full frontend suite passed 342 checks before the final overview wording regression; the final 16 affected checks and 30 appointment-detail browser scenarios passed afterward. Another 24 adjacent request-detail and 32 existing navigation scenarios passed, covering exact record targets, history, role controls, confirmation guards, long content and responsive layouts. Updated the navigation fixture to match the Current/Past switches and reset behaviour already present at HEAD; no product filter behaviour changed. TypeScript and production build passed. Independent read-only review confirmed the history fallback fix and found no remaining actionable issues.

Authenticated existing Office, Panel Lecturer, supervising Lecturer and Coordinator appointment/supervisee views were captured at 1536/390px without horizontal overflow; visually reviewed Office desktop, Panel Lecturer phone and Coordinator desktop/phone. No academic records were changed during these live checks. No backend, API, permission, schema, dependency changes or commit/push; unrelated shared checkout work preserved. The existing ExcelJS bundle-size advisory remains. Phase 3 is the Student Panel overview; nomination form/list polish remains a later phase.

## Panel request detail consistency — Phase 1 (26 October 2026; complete)

Implemented independent student overview, nomination details/justification, current research and review/outcome surfaces for the shared Lecturer/Coordinator/Office request renderer, matching the approved Supervisor spacing, typography and desktop sidebar/mobile stack. Shared accept/approve/reject buttons preserve role gates, dialogs, busy handling, exact callback targets, terminal reasons, replacement continuity and audit history. Student overview/form/list/assignment lifecycle redesigns remain later phases; no academic records, backend, permissions, APIs, schema or dependencies changed.

New layout/action regressions failed before implementation and pass afterward. Updated prior Panel label and justification-order assertions to match the approved design. Verification passed the full 336 frontend checks, nine final targeted checks, 24 production-component browser scenarios at 1440/1024/390px, final TypeScript and production build. Browser coverage includes exact selected-Panel and Coordinator confirmation callbacks, required rejection/cancellation reasons, busy/read-only/ineligible gates, replacement and terminal history, long content and all staff hosts. Preserved the legacy no-submission availability notice. Populated fixture screenshots and authenticated existing Office/Lecturer/Coordinator request pages at 1536/390px were captured; visually inspected actual Coordinator desktop and Office phone views without horizontal overflow. Independent read-only review found no remaining actionable issues. No academic writes, commit or push; unrelated shared checkout changes preserved. The existing ExcelJS bundle-size advisory remains. Phase 2 appointment/assignment details is next.

## Phase 3 research-change UI (26 October 2026; complete)

Completed the shared request detail across Student, Lecturer, Programme Coordinator and Office: independent overview, requested changes/reason and review/outcome cards, 28px separation and the existing desktop sidebar/mobile stack. Comparisons show only changed saved fields, with Before this request and Proposed/Approved labels; regular-weight answers, full paragraphs and immutable historical values remain distinct from the live profile. Review decisions reuse the shared dark approve/red reject controls and preserve caller capabilities, cancellation, recorded reasons, audit and transfer acknowledgement/privacy. The existing list remains compact with automatic filters; scoped Office actions now name the actual correction/transfer intent. Forms use the existing card/field styling with more space, a local optional preview, unchanged submission payloads and a disabled unchanged submission.

Independent review found a correction-to-transfer preview mismatch and a new abstract length cap; fixed both, preserved the correction draft across intent switching, removed the new cap, and added a browser regression that failed before the fix. No remaining actionable review findings. Updated older comparison-label assertions while retaining their safety/history checks.

Final verification passed all 333 frontend checks, 30 request browser scenarios at 1440/1024/390px, 24 adjacent profile browser scenarios, TypeScript and production build. Authenticated read-only populated request pages were captured for all four roles at 1536/390px; reviewed Office desktop and Student phone screenshots, with no horizontal overflow. No academic records, backend, API contracts, schema, permissions or dependencies changed; title/abstract-only amendment scope and separate Registry handoff remain intact. Root requirements/design/status documents updated. Existing ExcelJS bundle advisory and unrelated concurrent workspace changes preserved. No commit or push.

## Phase 2 research profile and Registry handoff (26 October 2026)

Prepared docs/PROGRAMME_TRANSFER_REGISTRY_HANDOFF_2026-10-26.md with current routes, Registry integrity guard, service contracts and cutover acceptance. No owner was messaged and relocation is not implemented.

Phase 2 is complete across Student, Lecturer, Programme Coordinator and Office profile pages: independent student overview, current research reading area and visible compact revision history with individually expandable saved comparisons. Removed nested profile boxes and repeated programme information, preserved full paragraphs and regular-weight answers, and displayed current-version date/actor only when revision number, student ID and saved values match. Independent review identified the missing-student-ID edge case; fixed it and added regression coverage. Existing capability gates govern Student requests and distinct Office correction/transfer actions. Explicit creation intent preserves selected student/query context; the temporary transfer entry still uses the existing audited workflow.

Verification passed all 330 frontend checks, 24 production-CSS mounted browser scenarios at 1440/1024/390px, final TypeScript and production build. Authenticated Office, Lecturer, Student and Coordinator profiles were captured at 1536/390px without horizontal overflow. Actual Office controls opened the CORRECTION and TRANSFER forms with the correct selected intent; no forms were submitted. Reviewed desktop Office and phone Student captures. Independent read-only review found no remaining actionable issues. No backend, schema, dependencies or academic data changed; no commit/push. Existing ExcelJS bundle advisory and concurrent workspace changes remain preserved. Phase 3 research-change request redesign remains pending.

## Record navigation buttons (26 October 2026)

Updated View approved application and View student record to the existing dark/white primary-button style across their shared and direct role/page callers. Student-record actions now include UserRound; approved applications consistently use FileText. Preserved callbacks, role capabilities, busy handling and mark-record accessible labels/touch targets. No backend, data, permission or global button changes.

Verification passed 20 targeted frontend checks, 75 production-component request/supervision browser scenarios at 1440/1024/390px, TypeScript and production build. Visually reviewed desktop request and phone supervision screenshots; controls wrap without overflow. Existing ExcelJS bundle advisory remains. No commit or push; unrelated concurrent work preserved.

## Approved application access from supervision (26 October 2026)

Added View approved application beside the student overview on Phase 1 staff details, with the same label for the Student's existing own-application action. Staff access uses a narrowly scoped server-provided ID from the active primary appointment and the existing application-read policy; supporting-supervisor team membership alone does not grant access. Current research remains separate from original submission evidence. Preserved role-specific URLs, query context and the return to Supervision details / My supervisors. Live verification caught and fixed the missing Lecturer request back-label binding. Seven final targeted navigation/layout checks passed after that fix.

Verification passed 59 affected backend tests in a uniquely named disposable database, all 326 frontend checks, 75 browser scenarios at 1440/1024/390px, TypeScript and production build. Authenticated Office, Lecturer, Student and Coordinator journeys opened their exact approved application and returned to the original path and query; desktop and phone captures show no overflow. Backend restarted locally to serve the new access field. No academic records, schema or dependencies changed; no commit or push. Existing ExcelJS bundle advisory and unrelated concurrent workspace changes remain preserved.

## Detail sidebar buttons (26 October 2026)

Improved request Accept/Reject and Phase 1 Change supervisor/End Appointment controls with matching full-width rows, 44px minimum heights, consistent spacing and readable labels. Shared request layout covers caller-owned Student/Lecturer/Coordinator/Office actions; compact appointment layout preserves existing staff capabilities. Lecturer decisions have distinct icons and rejection colour; Coordinator approval appears first. Preserved callbacks, busy/eligibility checks and confirmation dialogs; no API, data, dependency or global button change. Repaired one existing invalid Windows-encoded ellipsis encountered in the edited request renderer.

Verification passed 75 production-component browser scenarios at 1440/1024/390px (including action geometry), 10 targeted frontend checks, TypeScript and production build. Inspected rendered request controls plus authenticated Office Phase 1 captures at 1536/390px; no overflow. Existing ExcelJS bundle advisory remains. No academic mutations, commit or push. Other concurrent workspace changes remain preserved.

Follow-up role parity: corrected duplicated role-specific icons and shortened Coordinator labels by sharing the primary decision-button component. Supervisor uses Accept request, Coordinator uses Approve request, and both use Reject request with the same check/cross icons and markup. Removed the misleading Cancel trigger label beneath an open Coordinator rejection dialog. Two new regressions failed before extraction and pass afterward. Final follow-up verification: 12 targeted frontend checks, 75 browser scenarios using the real Coordinator action renderer and both decision callbacks, TypeScript and production build. Existing permission, eligibility, busy and confirmation behaviour is preserved.

## Phase 1 supervision details (26 October 2026; complete)

Implemented the approved first phase across shared Lecturer, Programme Coordinator and Office supervision details plus Student My supervisors. Student overview, team, readable current research and appointment/activity surfaces are separated, with a desktop side column and mobile stack. Compact current-appointment metadata preserves dates/history/actions while removing repeated identity rows. Existing historical summary defaults, the Panel overview profile, role capabilities, pending replacements and Student privacy remain preserved. Standalone research profile and research-change redesigns are still pending later phases.

The three new structural/privacy/lifecycle regressions failed before implementation, then passed. Final verification passed all 322 frontend checks, 36 supervision-detail browser scenarios at exact 1440/1024/390px, 39 preceding request-layout browser scenarios, TypeScript, the production build and scoped whitespace checks. A failed geometry regression and the existing equivalent-capability assertion exposed empty action strips for read-only Lecturer/Office metadata; both were fixed and rechecked. Eight authenticated desktop/phone screenshots across all four roles were captured and inspected using existing approved local records; Lecturer captures were refreshed after the final spacing fix. Independent review, including the final capability-slot adjustment, found no remaining actionable issues. Existing ExcelJS bundle advisory remains. No backend, schema, dependency or academic data changes, commit or push were performed; unrelated concurrent work remains preserved.

## Supervisor request detail spacing and persistent preview (26 October 2026)

Superseded the previous two-primary-card composition with a student overview and independent research, Research Intent, and supporting evidence cards. Review progress/actions occupy a desktop side column and stack on smaller screens. Removed a duplicated separator from the overview, kept regular answers and consistent labels, and preserved all four role callers, sensitive evidence hooks, historical gaps, retries, documents and capabilities.

Created exactly one persistent fictional development request through normal authenticated submission: #11, Aina Sofea Rahman (Demo), DEMO-UX-2026-001, awaiting Test Artificial Intelligence Lecturer 01. It includes a coherent explainable academic-support research proposal, all nine Research Intent fields, two declared course results, a saved declaration and downloadable proposal/timeline PDFs. A second seed invocation returned the same #11 without creating another request. Existing request #10 and other academic records were preserved. No backend source/schema/permission change was made; the new student/request/documents and normal in-app submission notification are intentional local data additions.

Authenticated Student and Office desktop/phone screenshots from the actual running portal were captured and visually inspected, including both rendered PDFs. Role-specific URLs: Student/Lecturer `/supervisor-appointments/11`; Office `/supervisor-appointments/request-11`. The fictional student uses the configured local demo student password, with no credential printed or committed. Final checks passed: all 319 frontend checks, 39 production-component browser scenarios at exact 1440/1024/390px widths, TypeScript and the production build. Both authenticated seeded-document downloads returned 200 and valid one-page PDFs; seed idempotence and unchanged request #10 status were checked. Actual Student/Office captures at 1536/390px were inspected. Existing ExcelJS bundle advisory remains. No commit or push requested/performed; unrelated concurrent work remains preserved.

## Supervisor request detail hierarchy (26 October 2026)

Implemented the approved shared layout for Student, Lecturer, Programme Coordinator and Office: compact request overview, grouped Application details and separate Review and outcome, regular-weight answers, consistent muted labels, relocated title ownership, grouped expandable Research Intent and collapsed secondary evidence. Preserved snapshot identity, exact-application reads, caller-owned actions, downloads, audit/history, historical fallbacks and Office replacement distinctions. No backend/data or permission change. Final verification passed all 319 frontend checks, 26 production-component browser scenarios at exact 1440/390px widths, 51 shared heading-alignment cases, TypeScript, production build and scoped whitespace checks. Browser scenarios cover all four role adapters/caller-owned actions, disclosure controls, full evidence, snapshot identity/provenance, missing records, Office replacements, retries, ignored stale responses, terminal outcomes, no-course declarations and failed downloads. These use isolated synthetic HTTP responses and do not replace backend authorization/full-shell acceptance. Desktop and phone screenshots were inspected. Independent review found two evidence/provenance details; both were reproduced with failing regressions, fixed and re-reviewed with no remaining actionable findings. All three root documents are maintained, and unrelated concurrent work and the preceding alignment fix remain preserved. Existing ExcelJS bundle advisory remains. No commit or push was performed.


## Icon heading alignment audit (26 October 2026)

Traced the appointment request summary offset to shared headers top-aligning 36px icons with shorter title line boxes. Audited icon/heading compositions across the frontend, corrected shared appointment and Office sections, and applied the same title-row layout to affected Marks setup, Registry import/registration, staff roles, settings, letter editor and student dossier headers. Preserved existing typography, colours, actions and workflow rules; the appointment page redesign remains a separate next step.

Browser regressions reproduced the original 4–8px shared-header offsets and additional settings/Registry/staff offsets before their fixes. Final verification passed 51 browser layout cases (17 patterns at exact 1440/768/390px widths), all 312 frontend checks, 10 final targeted regressions, TypeScript, production build and scoped whitespace checks. Reviewed the phone screenshot and confirmed the development server serves the new shared component. Browser measurements check icon/title centres within 1px, subtitle separation, wrapping and action/card overflow using isolated synthetic content and system fallback fonts; this is not a full authenticated crawl of every role and record. Existing ExcelJS bundle advisory remains. All three project documents are updated; unrelated concurrent changes are preserved. No backend/data changes, commit or push were performed.


## Admin profile ownership fix (25 October 2026; fixed in source)

Fixed the review's P1 with a shared ProfileOwnerAdmin base for Student, Lecturer and OfficeStaff. Existing owner links render read-only; changed, invalid or conflicting repeated User values are rejected with HTTP 403 before ModelForm binding. Rejected requests preserve complete source/target profile rows and lifecycle audits. Legitimate new creation, duplicate-add rejection, ordinary maintenance and unchanged-owner submissions remain available; the User-page inline also rejects ownership rebinding.

The first eight permanent regression tests reproduced 15 failing assertions/subcases before the fix. The initial affected gate passed 79 tests in 6.930 seconds. Final verification passed 394 tests in 86.566 seconds across all accounts tests plus Academic, Appointment, Dashboard and Marks protected-admin suites, including nine ownership regressions. Django checks/migration drift and whitespace/syntax checks pass; no schema/dependency/frontend change was required. All disposable test databases and the temporary review launcher are removed. Existing permission-separation/A04 work remains preserved. No live account/academic changes, process restart, commit or push occurred. Local activation and Office flag conversion still await the previously blocked restart. Review evidence: docs/OFFICE_ADMIN_SEPARATION_REVIEW_2026-10-25.md.


## Permission-separation review discovery (25 October 2026; historical, fixed above)

A fresh direct review found a pre-existing account-maintenance bypass left open by T04: StudentAdmin and LecturerAdmin allow editing the owning User, which is also the profile primary key. Real admin POSTs against a disposable PostgreSQL test database overwrite another participant's row, including protected lifecycle status/actor/time/reason, without an Office transition or new lifecycle audit. Probes changed a Deferred student and a Retired lecturer to Active. This was not a regression in the new authorization predicates; the maintenance boundary was subsequently closed by the ownership fix above.

The fresh review ran 24 tests in 4.578 seconds: 22 existing authorization/Marks controls pass; two new target-row-preservation probes fail. No production code or development academic records were changed. Recommended follow-up: immutable owner links for existing profiles, crafted-POST rejection and permanent Student/Lecturer regression coverage; review OfficeStaff's equivalent identity pattern. Requirements/design already require preservation of governed state and audits. Evidence: `docs/OFFICE_ADMIN_SEPARATION_REVIEW_2026-10-25.md`; the synthetic probes were subsequently replaced by permanent `accounts.test_admin_profile_ownership` coverage. The earlier full-suite/browser passes below do not cover this newly exposed path. Local API activation and Office flag conversion remain pending after the previously rejected restart.


## Office/admin permission separation (25 October 2026; source verified, local activation pending)

T01-T06 source implementation and direct critical review are complete. The final full suite passed 1,551 tests in 487.320 seconds across all eight backend apps (two workers, disposable PostgreSQL). Scoped gates passed 98 and 70 tests; 17 real browser journeys passed with non-admin Office fixtures (719 assertions), and a fresh final Marks browser rerun passed after explicit-grant resolution. Final admin acceptance follow-up passed 18 tests in 4.340 seconds after making its no-permission fixture explicit. TypeScript/build, Django checks/migration drift and changed Python/Node syntax pass. Task test databases/clones and the temporary launcher are removed; the private credential file remains ignored. A04 work is preserved.

With the user's authorization to choose the identity, provisioned `local.technical.admin@example.test` with a generated password in an ignored private credential file. Real Django authentication against the development database verified admin login and portal refusal. Existing credentials and business permissions are unchanged. Automatic approval review rejected the local API restart with only “blocked by policy”; its existing `--noreload` process is still healthy on port 8000 and running the old source. Office staff-flag conversion is intentionally pending until restart, to preserve old-process portal functions. No commit/push or demo reseeding occurred. Report: `docs/OFFICE_ADMIN_SEPARATION_2026-10-25.md`.

## Carryover and semester handover core acceptance (25 October 2026)

Completed scoped A04 production-component/real-HTTP journeys at exact 1440/390px widths: reasoned reassessment grant/replacement/revocation/stale recovery/consumption for primary, supporting and Panel requests, plus semester activation with a fresh preview and unfinished-work acknowledgement. Exact snapshots preserve original applications, submitted/draft Marks, tasks, windows and their audits; authority consumption records the actual Coordinator and Published policy. Handover closes the source semester/period, retains completion rights and blocks premature archival. No production defect or runtime/schema/dependency/live-clock change was needed.

The combined gate passed 63 tests in 76.819 seconds, including eight browser journeys and 214 browser/API assertions plus persisted checks. Direct review moved the activation layout assertion into the open review dialog; the final two activation journeys passed in 7.253 seconds. TypeScript/build, Django/migration, runner syntax and scoped whitespace pass; existing ExcelJS advisory remains. All runner databases/clones/browser artifacts were removed. Independent review remained unavailable due to the earlier account usage limit; direct scoped review completed. Report: `docs/CARRYOVER_HANDOVER_ACCEPTANCE_2026-10-25.md`; A04/E13 and all root documents updated. Compound/external clauses remain pending; next is A05 Dashboard/Timeline/report/export/dossier/reconciliation combinations. Earlier work committed by the other active chat is retained; new A04 work remains local and uncommitted.

## Verified release snapshot (25 October 2026)

Release scope includes lecturer Marks reliability and the completed supporting-supervision, research-transfer and acting-delegation acceptance work, grouped into separate commits with their evidence and shared documentation. Fresh verification passed all 1,551 backend tests, including nine real-browser journeys, all 312 frontend checks, 26 contextual-feedback browser scenarios, TypeScript, production build, Django checks, migration drift and whitespace checks. Test databases/clones were destroyed; no environment files or detected credential material are included. Existing ExcelJS bundle advisory remains.

New carryover/semester acceptance work started in another active chat after this release scope was captured. That ongoing work is retained separately; it is not certified by this release snapshot.


## Acting delegation core acceptance (25 October 2026)

Completed scoped A03 grant/revocation and controlled-clock scheduled/inclusive-end/expired journeys using production components and real HTTP at exact 1440/390px widths. Covered required reasons, overlap/role boundaries, regular-programme retention, delegated supporting approval, stale approval denial, queue focus refresh, personal history, reports/dossier privacy and Office-only reconciliation denial. Real parsed XLSX exports verify programme inclusion/exclusion and hidden Marks; exact snapshots preserve original academic/Marks rows and completed approval authority is retained in history. No production defect or runtime/schema/dependency change was needed.

The final combined gate passed 46 API/integration/concurrency/retirement/migration/report/dossier/browser tests in 219.809 seconds, including 202 browser/API assertions plus persisted-record and parsed-workbook checks. Databases/clones and temporary browser artifacts were removed. TypeScript, production build, Django/migration, runner syntax and scoped whitespace checks pass; existing ExcelJS advisory remains. Independent review was attempted but unavailable due to an account usage limit; direct scoped review completed without an actionable finding. Report: `docs/DELEGATION_ACCEPTANCE_2026-10-25.md`; E12 and pending-register A03 updated. Compound/external clauses remain pending; next is A04 carryover/semester handover. Existing uncommitted acceptance/Marks work is preserved; these additions remain uncommitted.

## Research amendment and programme transfer core acceptance (25 October 2026)

Completed the scoped A02 production-component/real-HTTP journey at exact 1440/390px widths. Covered Student reasons/cancellation, primary-Supervisor rejection and successful approval, stale-tab decision rejection/explicit recovery, Coordinator/supporting/unrelated access boundaries, Office transfer creation/cancellation, rejection at each Coordinator stage, separate source/destination approvals with independently enforced team acknowledgement, stale-stage replay, retained historical access and consistent programme/revision outcomes. Exact snapshots preserve original applications, primary/supporting/Panel membership, submitted Marks, a Panel draft, completion windows and associated task/window audits. No production defect or runtime/schema/dependency change was needed.

Fresh verification passed all 32 amendment API/lifecycle/concurrency/migration/browser tests in 53.315 seconds, including 74 browser/API assertions at each viewport (148 total) plus final persisted assertions. Disposable databases and clones were destroyed. TypeScript, production build, Django checks, migration drift, runner syntax and scoped whitespace checks pass; existing ExcelJS advisory remains. Independent scoped review found no actionable issues. All root documents, checklist E11, pending-register A02 and `docs/RESEARCH_TRANSFER_ACCEPTANCE_2026-10-25.md` record the evidence and limits. Compound/external clauses remain pending; next slice is A03 acting delegation. Existing uncommitted supporting-supervision/Marks work is preserved; this acceptance work remains uncommitted.

## Supporting supervision core acceptance (25 October 2026)

Completed the scoped A01 real HTTP/browser journey using production SupervisoryTeamManagement/services, real JWT authentication and disposable PostgreSQL records. Covered candidate/Coordinator rejection, primary cancellation, scoped approval, pending-incumbent retention, replacement lineage, Office reasoned closure, Student privacy, former-member access revocation/history and private-application/Marks denial. Exact post-browser snapshots retain all primary/Panel/research/submitted Marks and task-audit data; final supporting workflow/lifecycle counts and actors match expectations. No production defect or runtime/schema/dependency change was needed.

The combined 27-test supporting gate passed in 73.583 seconds, including 25 API/lifecycle/concurrency tests and two browser journeys. After adding exact iframe viewport assertions and the independent review's isolated whitespace-justification check, the final two journeys passed in 28.099 seconds: 63 real HTTP/browser assertions at each actual 1440/390px width (126 total), plus persisted assertions. Disposable databases/worker clones and temporary browser artifacts were removed. TypeScript, production build, Django checks and migration drift pass; the existing ExcelJS advisory remains. The reviewer confirmed the finding resolved with no further findings. Report: `docs/SUPPORTING_SUPERVISION_ACCEPTANCE_2026-10-25.md`; checklist E10 and pending register A01 updated. Compound/external clauses remain awaiting acceptance; next slice is A02 research amendments/programme transfers. Existing uncommitted Marks work is preserved; this acceptance work remains uncommitted.

## Lecturer write reliability (25 October 2026)

Implemented required draft versions, locked stale-write rejection, atomic reviewed-payload submission, immutable retry receipts and explicit conflict recovery. New backend and frontend regressions failed before implementation. PostgreSQL race checks cover two draft writers, duplicate identical submissions and distinct submissions from one version. Desktop/phone checks cover retained failed input, explicit reload, stable retry references and new references after edits. The real HTTP browser journey now verifies a newer draft from another tab and a gateway failure after a real submission commit, followed by successful receipt-based retry.

Verification passed: all 175 Marks backend tests including the 23-assertion real browser journey, all 312 frontend checks across 209 files, 56 mocked browser cases, TypeScript, production build, migration drift and whitespace checks. Disposable test databases were destroyed. Applied only migration marks.0011_lecturer_write_reliability to the local development database and reloaded the managed backend on port 8000. Before/after academic counts match (zero rubrics, periods, tasks and mark entries), and the new receipt table is empty. No live academic fixture or new dependency was added; existing ExcelJS bundle advisory remains. Public write callers must reload to obtain writeVersion and send the new reviewed-payload submission contract. These changes remain uncommitted.

## Complete Marks journey acceptance (25 October 2026)

Added an opt-in real HTTP/browser journey using a disposable Django test database. All 20 browser assertions passed through Office configuration APIs, mixed Supervisor/Panel queues, repeated draft saves, reopen/submit/lock, role-specific history, matching Office APIs and the rendered Office records workspace; final database assertions confirm exact totals and no marks for the other lecturer. JWT authentication is real; the login screen and complete application shell are not part of this component-level acceptance test. Found and reproduced the remaining Office-list UTC date mismatch at Malaysia midnight, then applied local-time formatting. No development records or schema changed.

Final verification passed: all 158 Marks backend tests including the real browser journey, all 311 frontend checks across 208 files, 50 mocked browser cases, 18 refreshed screenshot cases, TypeScript, production build and whitespace checks. Disposable test databases were destroyed. Desktop empty navigation and phone history previews were visually inspected after the badge refinement. Existing ExcelJS bundle advisory remains. Changes are grouped into separate local commits for history, lecturer UI, correctness fixes and acceptance evidence; the branch is preserved for review.

## Lecturer responsibility count polish (25 October 2026)

Replaced inline unfinished/submission count phrases with subtle numeric badges, shown only for positive known counts, and retained descriptive screen-reader text. Removed the noisy zero-count labels without changing task counts, filters or role behaviour. Updated the existing mixed-role browser assertion for the accessible wording. TypeScript, production build, 18 mocked responsive cases and a direct empty-navigation render check passed. Whitespace checks pass. Existing ExcelJS bundle advisory remains.

## Lecturer marking bug inspection (25 October 2026)

Reproduced and fixed stale compatibility aliases overriding edited rubric scores/feedback during draft save and submission, stale local form values surviving Review latest record, and queue/history submission-day differences around Malaysia midnight. New regressions failed before their corresponding fixes. The conflict reload replaces local values in place, preserving record-page navigation; failed saves/reloads retain input.

Verification passed: all 156 Marks backend tests, all 311 frontend checks across 208 files, 30 page/viewport cases and 20 contextual-feedback cases with fictional mocked HTTP, plus a final eight-file targeted rerun after refining reload handling. TypeScript, production build and whitespace checks pass. Existing ExcelJS bundle-size advisory remains. Backend tests used unique disposable databases that were destroyed afterwards. Reloaded the local backend to activate the shared timestamp fix. No live academic records, rubric configuration, permissions or schema changed; authenticated live end-to-end marking was not exercised.

## Lecturer submission history retention (25 October 2026)

Implemented a dedicated authenticated read-only lecturer history endpoint and independent frontend history read, including own submitted evaluations across assignment lifecycles and archived periods. Added real timestamp ordering, inclusive Malaysia submission-date filters, invalid-range feedback, role navigation (including historical backup work), period/rubric context, contextual retry and responsive phone rows. Normal handover/pause/retirement flows already preserve submitted marks; the former active-feed dependency excluded any legacy non-active submitted tasks. Existing lifecycle services, scoring, write guards and uncommitted lecturer workspace improvements remain intact. History-only navigation never calls task generation. No live rubric/period/task data or schema changed. Reopened drafts are absent until resubmitted.

Verification passed: all 155 Marks backend tests (including 8 new history regressions), all 310 frontend checks across 207 test files, 27 mocked page/viewport cases plus 18 contextual-feedback cases, 9 screenshot cases, TypeScript, production build, migration drift and whitespace checks. Backend tests used unique disposable databases with two workers and test-only fast password hashing; all test databases were destroyed. Desktop and phone history screenshots were visually inspected. Reloaded the managed local backend on port 8000 so the new endpoint is active; an unauthenticated request returns 401. The existing ExcelJS bundle advisory remains. Requirements and architecture were updated.

## Lecturer marking responsibility refinement (25 October 2026)

Implemented the approved separation into My supervisees / My panel students, with a conditional Backup marking workspace, visible unfinished counts, role/semester summaries and integrated automatic filters. The compact task table groups student identity and research/semester, prioritises unfinished work by deadline and uses explicit start/continue/view actions. Empty roles omit table headers, and phone task rows keep the marking action visible without horizontal scrolling. History keeps the selected role and distinguishes load failures from an empty history; editable, read-only and submitted records retain marking context. Draft save now stays in the editor and resets the unsaved-change baseline only on success. Existing backend eligibility, role permissions, scoring and submission guards are unchanged. Current local database inspection found no evaluation periods or tasks; test scenarios use fictional HTTP responses without academic writes.

Verification passed: all 308 frontend checks across 205 test files; 36 mocked page/viewport scenarios (1440, 390 and 320px) plus 18 contextual-feedback scenarios; TypeScript (`npm run lint`); production build; and whitespace checks. Six refreshed populated-layout screenshots passed their browser checks, and desktop/phone screenshots were visually inspected. An additional empty-state screenshot set is included. The browser harness now waits for settled lecturer reads, and the feedback runner accounts for the new restored-history failure scenario. The build retains the existing ExcelJS chunk-size advisory. The local `/marks` page responds on port 3001. Requirements and architecture documentation were updated. Historical note: this UI-only pass still used the active-task feed; the subsequent submission-history implementation above replaces that dependency.

## Release verification and commit grouping (25 October 2026)

Prepared separate commits for shared workspace UI/feedback, Office capacity/semester/dashboard workflows, appointment/research browsing and history, reconciliation evidence, Marks, documentation and visual review artifacts. Checked all pending paths and credential patterns; no environment files, private keys or database files are included. Refreshed five stale regression contracts to inspect current navigation/combobox behaviour and distinguish ordinary Marks browsing from dashboard lifecycle filtering. Restored the semester subtitle in the standalone timeline importer, retaining the embedded modal's existing context.

Fresh TypeScript, production build, all 307 frontend checks across 204 test files, 45 targeted mocked browser scenarios, migration drift and whitespace checks pass. The full 1,515-test backend suite passes with two isolated workers and fast password hashing limited to the disposable test process; its databases were destroyed afterwards. The first full backend run exposed one report fixture attempting publication below a live reservation and two UTC-date assumptions at the Malaysia calendar boundary. Corrected those test fixtures without changing production guards; all 37 focused report/timeline/publication tests and the final full suite pass. Production password settings and live academic records remain unchanged. Existing ExcelJS bundle advisory remains.

## Evaluation period empty state refined (24 October 2026)

Replaced the isolated blue notice with a neutral white PortalCard and shared EmptyState, matching the rubric page. The calendar icon, brief explanation and single New period action are grouped together; the redundant Evaluation periods heading and duplicate header action are omitted when there are no rows or archives. Existing archive-only access, creation guards and list/editor behaviour remain. Return focus now targets the named list region so it works without a visible list heading.

Fresh production build and TypeScript pass. All 35 targeted mocked browser scenarios pass: 21 period state/viewport cases and 14 module-feedback cases, including creation focus, list return focus, archive access, exact links and saved-read recovery. The empty-card regression failed before implementation. Desktop and mobile empty-state screenshots were inspected. All three mandatory documents updated. Existing ExcelJS bundle advisory remains; no backend, permission or live-record changes.

## Evaluation periods now start with the list (24 October 2026)

Separated browsing from configuration: the initial page shows one period list with explicit lifecycle badges; New period opens a blank draft, selecting a period opens its details, and Back to period list returns without saving. The editor retains existing save, publication, closure, archive and saved-read recovery controls. Exact period links open the requested configuration; semester-only links remain scoped list views. Archive inclusion appears only when the inclusive read finds archived rows in scope, adds them to the same list and preserves read-only inspection. An archived-only empty list explains the hidden historical records. Creation/selection/return move keyboard focus to the relevant field or heading, and recipient previews pause while browsing.

Fresh production build, TypeScript and three focused test files pass. All 163 mocked browser scenarios pass: 21 period page/viewport cases (seven states at 1440/390/320px), 16 existing Marks feedback cases, 14 module-feedback cases and 112 Periods workspace/context cases. Coverage includes initial empty/current/archived-only lists, lifecycle badges, archived read-only detail, new-draft focus/reset, direct period links, semester isolation, late selection/save responses and duplicate-write protection after failed saved-detail refresh. The initial list-only regression failed before implementation. A visual fixture readiness check now awaits the list/editor after a concurrent run exposed a render-timing race; the complete 21-case visual suite then passed. Desktop list and mobile creation/archive screenshots were inspected. All three mandatory documents updated. Existing ExcelJS bundle advisory remains. Fixtures use fictional mocked HTTP, not authenticated end-to-end sessions. No backend, permission, scoring, dependency or live-record changes; work remains local and uncommitted.

## Evaluation period archive control and New period feedback (24 October 2026)

Replaced the isolated Show archived strip with a compact Evaluation periods toolbar labelled Include archived periods, retaining the existing archive read-only note and query behaviour. New period now visibly resets/opens the draft and scrolls/focuses Period name, including when an empty draft was already displayed. Added mounted coverage for list-toolbar grouping, new-draft focus/reset after published-period inspection and archive query inclusion/reset. Fresh TypeScript, production build, three focused test files and 25 mocked browser scenarios pass (nine empty/populated/published period page-width cases and 16 contextual-feedback cases). Checks cover new-draft focus/reset after published selection, visible first field, archive inclusion/reset queries and read-only explanation, plus existing publication and save guards. Desktop/mobile layout screenshots were inspected; the original toolbar grouping regression failed before the fix. Existing ExcelJS bundle advisory remains. Requirements/design/status updated; no backend, permission, scoring or live academic-record changes.

## Marks module usability review (24 October 2026)

Completed a focused review of the Office overview, period configuration/recipient preview, rubrics, task generation/backup details, records/detail/actions and completion windows, plus Lecturer tasks, history, entry and submitted detail. Applied five critique points: repeated setup copy, excessive routine hints, technical wording, inconsistent lecturer filters and missing persistent field labels. Empty summaries are quieter, guidance follows the current state, and secondary monitoring follow-up/activity is available on demand. Important scope, missing setup, locking/publication, backup, correction/reopening and extra-time consequences remain accessible. Lecturer lists now use automatic shared filters, truthful counts and immediate history navigation; no inert pagination or destination-less student action. Rubric/feedback labels and table scrolling/semantics were improved. Existing typography and two-card assignment structure remain.

Fresh TypeScript, production build and eleven focused test files pass. All 119 browser scenarios pass: 93 page/viewport cases spanning 31 Marks states at 1440/390/320px, 16 contextual-feedback scenarios and ten dashboard monitoring navigation cases. Nine additional targeted reruns confirm immediate history entry/return, truthful error totals and completion table rendering after fixture refinements. Screenshots were inspected for the empty/populated overview and mobile rubric/lecturer pages; the final image review prompted a small summary-label wrapping adjustment, verified by a fresh build/TypeScript check, 18 affected overview/Lecturer page-width reruns and another phone screenshot inspection. A route assertion now awaits the observed React Router destination instead of relying on a fixed short delay. The first browser pass exposed the list/history transition waiting on Motion while state had already changed; removed the unnecessary exit-animation gate and verified navigation. A fixture-only widened string type was corrected before the final successful TypeScript check. Source comparisons confirm configuration, rubric, assignment, entry, record-detail and completion-window state/loaders/mutation logic and Lecturer save/reload/submit handlers remain unchanged. The existing ExcelJS bundle advisory remains. Browser fixtures use fictional mocked HTTP rather than authenticated end-to-end sessions. No backend, API, permission, dependency, scoring or live academic-record changes. All three mandatory documents updated; changes remain local and uncommitted.

## Marks automatic filtering and shared font sizing corrected (24 October 2026)

Removed Apply filters and its submission form/success toast from Mark Entry Records. Search, programme, semester and evaluator now filter directly from the visible field state and reset pagination immediately; status remains immediate. Retained legacy status restoration, authenticated-shell list memory, monitoring scope and record access. Excluded shared filter-panel descendants from broad Marks typography/minimum-height overrides, so both records and task panels inherit the standard portal label/value sizes without changing headings, score inputs or other forms. Regression checks cover no Apply control/form, automatic search/programme/semester/evaluator filtering, reset and shared computed font sizes. The initial regression failed before implementation. Fresh TypeScript, production build, four focused mark-record/monitoring/page-window/shared-filter test files and all 53 mocked browser scenarios pass. Browser checks cover computed 12px values/10px labels at 1440/390/320px, legacy status restoration, record navigation, pagination, task role/status filtering, generation/backup entry, existing contextual feedback and dashboard monitoring. Desktop/mobile screenshots inspected; no page overflow. All three mandatory documents updated. Existing ExcelJS advisory remains. No backend, dependency, permission, scoring or live-record changes; browser tests use fictional mocked HTTP, not authenticated end-to-end sessions. Changes remain local and uncommitted.

## Marks filters aligned with shared portal panels (24 October 2026)

Replaced the custom task role pills and records status pills/More filters disclosure with the existing WorkspaceFilterCard used by appointment modules. Both pages now use a light-grey panel, visible field labels, aligned grid and shared Clear filters footer. Task role/status remain immediate; records keeps immediate status selection and explicit Apply/Enter for search and programme/semester/evaluator changes. Counts remain in dropdown options and compact task submission text. Retained the two-card assignment structure, one records workspace, period/monitoring scope, legacy filter restoration, handlers and record access. Added scoped desktop spacing matching appointment panels without modifying the shared component or other modules. Corrected the records search wrapper so its control aligns with the Status field.

Fresh checks pass TypeScript, production build, six focused Marks/shared-filter test files and 53 mocked browser scenarios: nine assignment cases, 18 records cases, 16 existing contextual-feedback cases and ten dashboard monitoring navigation cases. Mounted checks assert the actual shared component, visible labels, 20px desktop/12px mobile panel padding, desktop search/status baseline, filtering/reset, restored legacy state, pagination, record access, generation gates, backup entry/cancel, deadline navigation and responsive overflow. The shared-panel regression failed before implementation. All records cases were rerun after the final alignment fix; desktop and mobile previews were inspected. Source comparisons confirm task state/loaders/handlers and backup/detail markup remain unchanged, together with the records loader/monitoring scope. Existing ExcelJS bundle advisory remains. All three mandatory documents updated; no backend, permission, dependency, scoring or live-record changes. Browser fixtures use fictional mocked HTTP rather than authenticated end-to-end sessions. Changes remain local and uncommitted.

## Mark records workspace refinement (24 October 2026)

Implemented one records workspace with counted status buttons, visible search/Apply/Clear, collapsed secondary filters, grouped table metadata and compact empty states. Removed five duplicated summary cards and the second status selector. Counts now match each status filter's loaded-record scope, including paused/retired records in ordinary browsing. Dashboard monitoring retains its narrower scope, explanatory notice and distinct scoped-empty guidance. Retained legacy applied status state, explicit search application and record/student callbacks. Pagination reuses the shared bounded page window and corrects an out-of-range restored page after successful reads. Desktop/mobile screenshot review prompted side-by-side Apply/Clear on narrow screens and wider student/research cells.

Fresh validation passes TypeScript, production build and the three focused mark-record/monitoring/page-window test files. All 18 records page/width cases pass at 1440/390/320px, covering search application, secondary filters/reset, status selection, legacy state, out-of-range restored pagination, error/retry, compact pagination, record/student navigation and scoped empty results. The 16 existing Marks feedback scenarios and ten dashboard monitoring navigation cases also pass. The initial hierarchy regression failed before implementation. One later fixture offset assertion was corrected to allow the existing dashboard notice. After a Chrome screenshot-capture timeout, all 18 records cases were rerun successfully with optional screenshot capture disabled and every browser assertion retained; previously captured desktop/mobile previews were visually inspected. Existing ExcelJS bundle advisory remains. All three mandatory documents checked/updated. No backend, dependency, permission, scoring or live-record changes; browser coverage uses fictional mocked HTTP rather than authenticated end-to-end sessions. Changes remain local and uncommitted.

## Evaluation task assignment shortened to two cards (24 October 2026)

Implemented the requested simplification after four critique/refinement points and the plan in `docs/superpowers/plans/2026-10-24-marks-assignment-simplification.md`. Combined period selection/generation into one compact card and task management into the second. Replaced four large summary cards with counted native role-filter buttons, collapsed period metadata/readiness, moved central deadline management to a header shortcut and embedded session activity inside task management. Shortened guidance and the task empty state. Retained a local completion-window fallback where central deadline navigation is not supplied.

Fresh validation passes TypeScript, production build, five focused Marks files and 25 mocked browser scenarios (nine assignment page/width combinations and 16 existing contextual-feedback scenarios). Coverage includes two main surfaces, reduced task-list offset, expandable readiness, counted role/status filters and reset, generation gates, task detail, backup entry/cancel, deadline navigation, keyboard-readable headings and overflow. The hierarchy regression failed before implementation; screenshot review additionally exposed a narrow vertical role-button stack on mobile, reproduced by a failing layout assertion and fixed by giving the group a full row. Desktop/mobile previews were inspected after the fix. Pre-change source comparison confirms state/filter derivation, loaders, generation/backup handlers and backup/detail workflow markup remain unchanged. Existing ExcelJS bundle advisory remains. All three mandatory documents updated. No backend, dependency, permission, scoring or live-record changes; browser tests use fictional mocked HTTP, not authenticated end-to-end sessions. Changes remain local and uncommitted.

## Evaluation task assignment hierarchy enhanced (24 October 2026)

Completed the requested brainstorm, six critique/refinement rounds and implementation plan in `docs/superpowers/plans/2026-10-24-marks-assignment-hierarchy.md`. Reorganised the page around period selection/context, comparable task counts, combined generation/readiness and a consolidated task-management surface. Moved backup entry and its exception explanation into the results card, grouped submission counts and filters, added a role/status reset that retains period scope, and combined student identity/evaluator metadata into readable table cells. Empty results now give appropriate guidance without a wide empty table. Deadline tools follow task management; session activity remains available in collapsed native details.

Fresh validation passes TypeScript, the production build, five focused Marks test files, nine assignment page/width combinations (empty, closed and published period at 1440/390/320px) and all 16 existing contextual-feedback scenarios. Mounted checks exercise generation enablement, role/status filtering/reset, task detail, backup entry/cancel, deadline navigation, heading readability and overflow. The initial hierarchy regression failed before implementation. A fixture initially looked for an explicit dialog role; corrected it to use the existing native dialog. Desktop populated/empty and mobile empty screenshots were inspected. A source comparison against the pre-change snapshot confirms loaders, state/filter derivation, generation/backup handlers and backup/detail workflow markup are unchanged. No backend, permission, dependency, scoring or live-record changes; browser coverage uses fictional mocked HTTP, not authenticated end-to-end sessions. All three mandatory documents updated; existing ExcelJS bundle advisory remains. Changes remain local and uncommitted.

## Empty rubric-library layout fixed (24 October 2026)

Replaced the empty two-column rubric layout with one full-width setup card and a direct “Create rubric family” action. Removed the nonexistent-rubric selection prompt and empty family sidebar from the initial state. First-family creation uses the full-width existing form and focuses its family-code field; populated rubric libraries retain the version list/editor layout and existing mutations, validation, locking and refresh safeguards.

A mounted regression reproduced the screenshot issue before the fix. Fresh checks pass TypeScript, production build, the Marks production-management test, nine mocked browser page/width combinations for empty/create/populated rubric states at 1440/390/320px, and all 16 existing contextual-feedback scenarios. Desktop empty-state and mobile creation screenshots were visually inspected. The existing ExcelJS bundle advisory remains. All three mandatory documents updated; no backend or live academic-record changes, and no authenticated end-to-end pass claimed. Changes remain local and uncommitted.

## Marks evaluation-check clarity follow-up (24 October 2026)

Renamed the Marks panel to “Evaluation checks”, including its loading/error heading, while keeping the dashboard's cross-module “Needs attention” unchanged. Added a keyboard-accessible router link to period configuration and specific first-step guidance when no non-archived period exists. Made the single-period summary and broader setup/check scopes explicit. Fixed checklist task/submission aggregation so archived periods cannot satisfy current setup or prevent current monitoring completion.

Verified the archived-task regression fails before the fix and passes afterward. Fresh validation passes four focused test files, TypeScript, the production build and nine mocked browser scenarios (empty, populated and metadata-error overview at 1440/390/320px). Browser checks include direct setup navigation, keyboard focus, scope wording, retained monitoring/record access and overflow; desktop/mobile screenshots were inspected. One initial test command used an incorrect `.tsx` extension; the corrected `.ts` command passes. The existing ExcelJS bundle advisory remains. All three mandatory documents updated; no backend or live-record writes, and no authenticated end-to-end pass claimed. Changes remain local and uncommitted.

## Marks module hierarchy and visual polish implemented (24 October 2026)

Implemented the approved no-tab layout after three additional critique rounds: three compact setup destinations, separate submission monitoring and contextual record access, meaningful attention/empty states, consistent icon summaries, headings, form labels and return links across Office and Lecturer Marks pages. Added usable input sizing and a readable calculated-total surface. Extracted overview reads from App with explicit loading/error/retry. Independent review identified metadata errors hiding otherwise working navigation; fixed this and added mounted coverage proving setup destinations and separately loaded monitoring remain usable. Follow-up review found no remaining actionable issue.

Fresh validation passes TypeScript, the production build, all 14 focused Marks test files, 16 existing mounted feedback scenarios and 42 page/width combinations covering the overview and related pages at 1440/390/320px. Screenshots in `output/marks-visual-polish-20261024/` were visually inspected. Initial verification exposed a CSS import incompatible with the existing Node-rendered tests, fixture setup/route mistakes and CSS layering/padding interfering with heading scale and search-icon clearance; these were corrected and covered by visible heading-size and field-clearance assertions, with the final checks passing. The existing ExcelJS bundle-size advisory remains. Browser fixtures use fictional mocked HTTP; no authenticated end-to-end, backend or live-database test pass is claimed. No backend, scoring, permission, dependency or live academic-record changes. All three mandatory documents updated; changes remain local and uncommitted.

## Marks module visual design proposal (24 October 2026)

Navigation follow-up: after the user rejected five tabs, researched official GOV.UK, NHS and USWDS navigation/task/card guidance. Revised the proposal to a task-based overview: three grouped setup links, contextual record access in monitoring, and consistent return links on subpages. The earlier tab-based HTML figure is superseded. No Marks application code or approved requirements/architecture changed.

Inspected the existing Office Marks overview, configuration, rubric, assignment, records and Lecturer entry structures against the portal's current Inter typography and shared UI primitives. Researched official design-system guidance and prepared `docs/MARKS_UI_PROPOSAL_2026-10-24.md`, including three approaches, exactly ten critique/refinement rounds, role-aware page hierarchy and an implementation/verification sequence. A separate illustrative layout shows the empty setup state. This is a proposal only: no Marks application code, scoring, access rules or academic data changed, and no application-test pass is claimed. Requirements and architecture checked; no changes to approved requirements or architecture at this stage.

## Local servers started (24 October 2026)

Started Vite at `http://127.0.0.1:3001` and Django at `http://127.0.0.1:8000` in managed terminal sessions using the existing configuration and repository virtual environment. Verified HTTP 200 for the dashboard, direct API health and API health through the Vite proxy. Requirements and architecture were checked and need no changes. No configuration, database or academic-record changes.

## Appointment history follow-up review (2026-10-24)

Review reproduced and fixed lost row focus after leaving a past supervision record and a record failing to reopen on browser Forward. The list stays mounted but hidden/inert during inspection; record selection follows the matching navigation marker without storing academic data in history. Same-query return refreshes preserve the row DOM, while query matching hides old actionable rows during changed filters/pagination. Added failing-then-passing browser assertions for each case. Independent review found no remaining actionable issue. Fresh backend validation passed 57 tests on isolated SQLite and the six own-history tests on an isolated PostgreSQL test database, which was destroyed afterward. All three mandatory documents updated. Fresh frontend validation passes 21 mounted StrictMode browser scenarios at 1440/390/320px, 10 focused frontend checks, the production build and scoped whitespace checks. The final whole-project TypeScript check is blocked by a concurrent change outside this review: AppointmentPrimitives.tsx:6 declares an icon tone map without the required brand member from BadgeTone. That unrelated file was left unchanged. Earlier browser attempts hit local Chrome timeouts; the final full responsive interaction run passes with isolated browser background services disabled and optional screenshot capture skipped. The existing ExcelJS build-size warning remains. No live academic records were written.

## Appointment lifecycle navigation and lecturer history (2026-10-23)

Implemented consistent compact Current / Past controls beside list headings across supervision and Panel views. Office Panel history is now visible without a dropdown; clearing filters retains Past. Added an own-lecturer paginated history endpoint and consolidated past primary/supporting supervisees with dates, roles, outcomes and read-only appointment summaries. No current-team/profile permission expansion, schema changes or live academic record writes. A mounted keyboard regression reproduced lost focus during supervision card replacement; the shared switch now consumes a parent-owned focus request to retain selection focus. All three mandatory documents updated. Fresh verification passes: 57 Django tests on an isolated in-memory SQLite database (including six new own-history tests), 18 mounted StrictMode browser scenarios at 1440/390/320px, 10 focused frontend checks, TypeScript, production build and scoped whitespace checks. Independent review, including the focus fix, found no actionable issues. Desktop/mobile screenshots in output/appointment-history-20261023/ were visually inspected. Browser tests use mocked HTTP; PostgreSQL was not exercised by the automated tests. The existing ExcelJS chunk-size warning remains. Restarted the backend and confirmed the frontend returns HTTP 200 and the new protected endpoint returns expected HTTP 401 both directly and through the frontend proxy.

## Local development server restart (2026-10-23)

Restarted the local frontend on http://127.0.0.1:3001 and the existing backend launcher on port 8000 in hidden processes. Confirmed the dashboard returns HTTP 200 and the protected draft endpoint returns the expected HTTP 401 directly and through the frontend proxy. Logs are in output/local-server-20261023/. Requirements and architecture reviewed; no changes needed. No application code, configuration or live academic records changed.

## Supervisor draft continuation follow-up review (2026-10-23)

Reviewed automatic initialization, silent step validation, normalized fingerprints, explicit restore/discard, request-generation guards, profile recovery, required uploads, declaration and intake/submission checks. Independent static review found no actionable defect; no production changes were needed. Added five mounted regressions covering failed student-particulars recovery without losing subsequent course edits, clean restoration of empty optional course-code arrays, a stale initial response after leaving/reopening the form, fresh required files/declaration after saving a reviewed draft, and closed-intake submission protection while draft saving remains available. The draft GET fixture now captures each response's own snapshot so stale-read coverage cannot accidentally return the newer draft. Fresh validation passes: 90 mounted browser scenarios under StrictMode at 1440/390/320px, 11 focused frontend checks, TypeScript and scoped diff checks. All three mandatory documents checked; requirements and architecture are unchanged. API behavior was inspected in source; browser tests use isolated mocked HTTP and do not write live academic records.

## Automatic Supervisor application draft continuation (2026-10-23)

Implemented automatic restoration of the student's account draft on opening the application, including normalized clean fingerprints and valid completion indicators. Initial loading disables editing until saved work and any required student particulars settle. Drafts reopen at the first unfinished writing step, with saved Review progress capped at Supervisor and documents for a fresh availability/upload check. Files/declaration remain unset; explicit saving, confirmed restore/discard, intake/capacity/server checks and failed-submit retention are preserved. Failed initial-load retries cannot overwrite subsequent writing. Automatic hydration reuses initial live-data reads and keeps the page context/restoration notice visible; ordinary step navigation retains its existing focus/scroll behavior. Added failing-then-passing interaction and visible-notice regressions. Validation passes: 75 mounted browser scenarios under StrictMode at 1440/390/320px, 11 focused frontend checks, TypeScript, production build and scoped diff checks. One intermediate browser run hit a local Chrome process timeout; the isolated rerun and final full run pass. Existing ExcelJS chunk-size warning remains. Screenshots in output/supervisor-auto-resume-20261023/ were visually reviewed at desktop/mobile widths. All three required project documents updated. No backend/schema/dependency changes or live academic writes.

## Capacity action button emphasis (2026-10-23)

Changed Compare versions (draft and read-only version views) and Set limits in bulk to the existing primary PortalButton variant, matching Review and publish with a dark background and white text. Existing layout, handlers and disabled states are retained. TypeScript and scoped diff checks pass. Requirements updated; architecture reviewed with no changes needed. No backend or live-record changes.

## Capacity editor hierarchy and toolbar (2026-10-23)

Combined draft context and lecturer editing into one card, removed the duplicate Draft badge and instructional sentence, kept Compare versions in the header, and moved readiness/Review and publish below the roster and pagination. Set limits in bulk now shares the roster toolbar with a contextual count and compact Select lecturers menu; current-page, all-matching and clear actions no longer occupy a separate row. Existing shared fonts/buttons/filters/table/modal behavior and business rules are preserved. Added a failing-then-passing mounted layout/selection regression. Keyboard testing also reproduced lost focus after a shared menu action; the menu now restores its trigger focus before invoking the action, with a failing-then-passing regression. Independent review identified no remaining actionable regression. Validation passes: nine focused frontend checks, 152 mounted browser scenarios at 1440/1280/390/320px, TypeScript, and the production build. The existing ExcelJS chunk-size warning remains. Visually inspected desktop/mobile editor, selected-toolbar and publication-footer screenshots in output/capacity-editor-hierarchy-20261023/. No backend/schema/dependency changes or live-record writes; frontend changes load through the existing development server.

## Bulk capacity follow-up review (2026-10-23)

Reviewed the batch service, strict API validation, model/transaction guards, cross-page selection, preview and dialog integration, with an independent static review. No additional application defect was identified. Added API coverage for the 1000/1001 batch-size boundary, zero and maximum integer limits, and unknown nested fields; added mounted coverage for filter-triggered selection resets and preserving the reviewed target/limits after a failed save and retry. An intermittent publication focus assertion ran before the modal close effect restored focus; the test now waits for that observable effect and still fails if focus is not restored. No production behavior changed. Fresh validation passes: 23 backend bulk/publication/concurrency tests, three frontend utility suites, TypeScript, and 148 mounted browser scenarios at 1440/1280/390/320px. Checked all three mandatory project documents; requirements and architecture remain unchanged. No live academic records were modified, and no server restart is required for these test/documentation changes.

## Bulk capacity draft setup (2026-10-23)

Implemented cross-page lecturer selection, current-page/all-matching selection, missing-only and explicit replacement modes, a paginated preview and one atomic draft save. Individual edits/copy starting points remain available. New strict Office-only batch endpoint validates current role eligibility and draft fingerprints, preserves required role configuration, and records per-lecturer audits. Added tests for more than 50 lecturers, rollback on validation/storage failures, zero preservation, role scope, stale drafts, authorization, immutable policies and concurrent edits. Frontend tests cover preview patches, selection across pages, replacement/unchanged roles, stale review, dirty cancellation, duplicate submission and busy closure. The 79-test capacity regression run and 12-test bulk suite pass, including a 52-lecturer batch and a competing individual edit. Nine focused frontend checks pass. Code review found a stale role-limit preview gap; the preview now flags obsolete saved values before submission, with a failing-then-passing regression. Final validation passes: 144 mounted browser scenarios at 1440/1280/390/320px, TypeScript and the production build. The existing ExcelJS chunk-size warning remains. Desktop/mobile setup and preview screenshots were visually inspected and saved in output/capacity-bulk-20261023/. Restarted the local backend; the page returns 200 and the new protected endpoint returns expected anonymous 401 directly and through the Vite proxy. No live academic data has been modified.


## Shared workflow report filters (2026-10-23)

Replaced the bespoke report toolbar and Apply/Reset actions with WorkspaceFilterCard, shared small controls and one Clear filters action. Valid selections refresh automatically; invalid date ranges keep inputs and show an inline error while blocking requests/downloads. Added stale-response protection and loaded-query checks for exports. Updated rendering/state regressions and added mounted coverage for automatic filtering across roles, date validation, reset, failed-read retry, out-of-order responses and export scope. Validation passes: six focused rendering/state/route/utility checks, TypeScript, 30 mounted browser scenarios at 1440px/390px and the production build. Desktop/mobile screenshots visually inspected and saved in output/workflow-report-filters-20261023/. Updated two stale reconciliation fixture button labels to match the existing review flow. The existing ExcelJS chunk-size warning remains. No backend, shared-style or live-record changes.


## Capacity publication modal (2026-10-23)

Replaced the full-page publication detour with the shared confirmation modal, concise semester/draft context, required reason and consent, and compact footer actions. Retained the draft roster behind the modal, dirty/cancel/escape/navigation/refresh protection, stale-review handling and version/fingerprint submission. Publication now treats refresh failure separately from a committed save. Added mounted regressions for modal context/focus, dirty cancellation/navigation, conflict review, duplicate/busy protection and committed-save refresh failure. All 128 mounted scenarios pass at 1440/1280/390/320px; seven focused frontend checks, TypeScript and the production build pass. The existing ExcelJS chunk-size warning remains. Desktop/mobile screenshots visually inspected in output/capacity-publication-modal-20261023/. No live academic records were altered.


## Capacity row wording (2026-10-23)

Replaced the technical missing-entry row message with "Capacity limits not set." This is a presentation-only copy change; existing capacity utility checks pass.


## Capacity editor hint and spacing cleanup (2026-10-23)

Moved Compare versions into the version card header and removed its detached action row. Collapsed readiness to the actionable issue count, preserving every blocker and fresh-draft recovery. Removed repeated draft/publication/unavailability paragraphs from the edit modal; retained draft identity, published limits, minimums and conditional workload warnings. Validation passes: 116 mounted browser scenarios at 1440/1280/390/320px, seven focused frontend checks, TypeScript and production build. Desktop editor and mobile modal screenshots were visually inspected and saved in output/capacity-editor-cleanup-20261023/. Existing build chunk-size warning remains. No backend, publication-policy or shared-style changes.


## Capacity publication workload minimum (2026-10-23)

Implemented rejection of new publications below live committed workload, preserving editable planning drafts and existing appointments/published history. Supervisor minimum includes active primary and supporting appointments; Panel minimum includes active appointments and both pending reservation stages, globally across semesters. The editor shows minimums and inline draft warnings; row readiness blocks publication. Added regression coverage for five-to-one reduction, combined supervision, Panel reservations, equality/zero, terminal and pending exclusions, atomic rejection, stale preview revalidation, API blockers and historical read-only policy. Validation passes: 200 backend tests (including publication/API query budgets, immutable history, availability, semester readiness and competing appointment approvals), seven focused frontend checks, 116 mounted browser scenarios at 1440/1280/390/320px, TypeScript and production build. Regression tests first reproduced missing rejection; final checks verify atomic publication failure and fresh workload checks even when the draft fingerprint is unchanged. Desktop/mobile edit dialogs were visually inspected. Corrected stale source-contract assertions to follow the existing paginated collection component. Production build retains the existing ExcelJS chunk-size warning. No migration, dependency or pending-Supervisor reservation change. Restarted the local backend to load the new rule. Frontend health returns 200; direct and proxied protected API routes return the expected anonymous 401. Edit-dialog screenshots are recorded in output/capacity-publication-20261023/edit-1440.png and edit-390.png. No live academic records were altered.


## Searchable research profile directory (2026-10-23)

Replaced the staff profile dropdown landing page with a server-paginated directory, name/matric/research-title search, programme filter, name/update sorting, 10/25/50 page sizes and explicit profile actions. Selected profiles show student identity and a Back to students action that preserves directory context. Student views, existing research history and correction/transfer permissions remain intact. Validation passes: 27 backend profile-directory/paging/amendment tests; 14 mounted directory scenarios at actual 1280px/390px frame widths; four existing profile-history scenarios; focused rendering, navigation, paging and API contract checks; TypeScript and production build. Tests verify scoped records/facets, wrong-role and unauthenticated denial, selected-only options, database LIMIT/OFFSET with three queries and no per-row queries, search beyond the current page, retained navigation context, empty/error/retry states and responsive long-title wrapping. Screenshots reviewed at output/research-profile-directory-20261023/directory-1280.png and directory-390.png. Build retains the existing ExcelJS chunk-size warning. Restarted the existing backend (automatic reload disabled); frontend responds 200 and the new endpoint responds with expected unauthenticated 401 both directly and through the Vite proxy. No schema migration or new dependency.

## Panel appointment header grouping (2026-10-23)

Grouped the My Panel students explanation under its title inside WorkspaceSectionHeader, alongside the Current/Past appointment switch. The full section gap now separates the complete header from the filters. Both current and past explanations and optional caller descriptions are retained. Validation: TypeScript check, production build, Panel workspace rendering checks and 32 mounted Panel assignment scenarios pass. Real-CSS browser verification at 1280px/390px confirms a 4px title/description gap, a 24px/20px complete-header/filter gap, grouped view controls, unchanged 20px side padding and no horizontal overflow for current and past views. Screenshots: output/appointment-spacing-20261023/panel-header-1280.png and panel-header-390.png.

## Office appointment table hierarchy (2026-10-23)

Implemented readable reviewer name/role cells and uniform dot-and-text application/nomination statuses in the Office Supervisor and Panel attention tables. Pending and no-request rows share the same layout; reviewer roles no longer appear as warning badges. Renamed the waiting columns to Current reviewer and Time at this stage. Candidate names appear as reviewers only for the matching Supervisor/supporting Supervisor/Panel stage. Card spacing is preserved. Validation: TypeScript check, production build, Office attention, Panel workspace and Supervisor workspace checks pass; existing mounted Panel assignment suite passes 32 scenarios at 1280px/390px. Real-CSS rendering verifies six consistent 12px sentence-case statuses, long reviewer names, missing-name and Coordinator fallbacks, unchanged 20px side padding, and no clipping or horizontal overflow at both widths. Screenshots: output/appointment-spacing-20261023/table-hierarchy-1280.png and table-hierarchy-390.png.

## Appointment status and horizontal spacing refinement (2026-10-23)

Removed the duplicate Application in progress text above review-stage badges in the Office Without supervisor table and renamed the column Application status. Reduced shared staff appointment-card side padding from 28px to 20px on desktop; vertical padding, section gaps, filter padding and mobile spacing are preserved. Validation: frontend TypeScript check, production build, Office attention, Panel workspace and Lecturer appointment consistency checks pass. Real-CSS browser verification at 1280px/390px confirms 20px side padding, preserved vertical/filter padding and no horizontal overflow; rendered pending rows contain one review-stage label each and no Application in progress text. Updated screenshots: output/appointment-spacing-20261023/status-refined-1280.png and status-refined-390.png.

## Local development server restart (2026-10-23)

Restarted the existing local Vite server at http://127.0.0.1:3001 and backend at http://127.0.0.1:8000 using their existing launch commands. Verified frontend HTTP 200 and authenticated /api/auth/me/ HTTP 401 both directly and through the Vite proxy (expected without a session). Restart logs are in output/server-restart-20261023/. No runtime configuration changes.

## Appointment workspace spacing (2026-10-23)

Implemented a shared responsive spacing class across Supervisor and Panel Appointments staff collection cards, including request/history lists, teams, assignments, Panel supervisees and Office attention tables. Desktop card/filter padding is 28px/20px with 24px section gaps; mobile spacing is preserved. Other modules and student layouts are outside this change. Validation: frontend TypeScript check and production build pass; Panel workspace, Lecturer appointment consistency and Supervisor workspace checks pass; existing mounted Panel assignment regressions pass all 32 scenarios at 1280px/390px. Real-CSS browser measurements confirm 28px/20px desktop card/filter padding, 24px section gaps, preserved mobile spacing and no horizontal overflow; an unscoped filter remains 12px. Screenshots: output/appointment-spacing-20261023/spacing-1280.png and spacing-390.png.

## Reconciliation acceptance modal placement (2026-10-23)

Moved the acceptance explanation, reason and acknowledgement from the recommendation card into the shared decision modal. Added a secondary lower-right footer action, with a mobile-width layout; source correction remains above it. Verified all 54 mounted scenarios at 1440/390/320px, eight focused frontend checks, TypeScript and scoped whitespace/UTF-8 checks. New coverage checks placement, no inline form, modal context/containment, cancellation and retained drafts, navigation guards, and the existing acceptance conflict/refresh safeguards. No backend or live academic record changes.

## Reconciliation acceptance and capacity noise removal (2026-10-23)

Removed legacy-profile capacity differences from the detector. Added Office-only, reasoned and confirmed acceptance for eligible historical semester-link/role-alignment warnings, an Accepted warnings view, reviewer/time/reason, exact-evidence reopening, immutable review audits and duplicate protection. Current/ongoing work, blocking issues and required repairs cannot be dismissed. Source status/identity now participates in reviewed evidence; a regression reproduced a reactivated timeline remaining hidden before the fix. Verified all 22 reconciliation/role-integrity backend tests, 51 mounted scenarios at 1440/390/320px, eight focused frontend checks, TypeScript, migration-state and scoped whitespace/UTF-8 checks. Reviewed desktop/mobile acceptance presentation. Applied the additive dashboard.0008 acceptance uniqueness constraint and restarted the local backend. The page responds HTTP 200 and direct/proxied API endpoints preserve the expected anonymous 401 after startup. No live records have been accepted or repaired.

## Reconciliation list density and plain-language guide (2026-10-23)

Removed the help text's 768px width cap and shortened its explanation. Common list issues now use short titles and actual differing limits; long programme context/full reasoning remain in the review page. Retained distinct student record references, lecturer/staff/semester/version context, shared responsive table/filter/pagination and existing repair safeguards. Added docs/WORKFLOW_RECONCILIATION_GUIDE.md with the trigger and purpose of all current issue types. Verified 39 mounted scenarios at 1440/390/320px, eight focused frontend checks, TypeScript and scoped whitespace checks. Coverage includes full-width concise help, short list labels with comparisons, distinct references for two issues belonging to the same student, programme details retained in review, and the existing repair/error/race guards. Desktop and mobile screenshots reviewed. No backend behavior or live academic records changed.

## Reconciliation follow-up review (2026-10-23)

Reproduced and corrected six defects: hidden repair target/copy source, coordinator issues labelled as capacity, obsolete rows flashing during page correction, outdated semester evidence accepted after a lock wait, UTC dates used for Malaysia semester matching, and Marks source links opening the dashboard instead of the owning period/task workspace. Added exact repair details to the form and confirmation, corrected module naming, retained loading during page correction, invalidated prior filter requests immediately, and added post-lock fingerprint revalidation. Verified all 19 reconciliation/role-integrity backend tests, 33 mounted scenarios at 1440/390/320px and eight focused frontend checks. The controlled lock-wait regression fails with post-lock revalidation disabled and passes with it enabled; the Malaysia boundary test covers Supervisor, Panel and evaluation periods. TypeScript and scoped whitespace checks pass. Restarted the local backend; the reconciliation page responds HTTP 200 and direct/proxied API endpoints preserve the expected anonymous 401. No live academic records have been repaired or edited.

## Workflow reconciliation clarity (2026-10-23)

Implemented shared list/filter/pagination presentation, an overall issue total and two next-step categories, lecturer/semester/version context, visible evidence comparisons, check explanations, explicit recheck/time and record-scoped lazy audit history. Missing semester links expose the matching evidence. Blocking issues are prioritized before paging. Repaired records show a saved outcome rather than reopening an issue that no longer exists; refresh failure cannot expose a second submit. Verified six focused frontend checks, 24 mounted browser scenarios at 1440/390/320px, all 17 reconciliation/role-integrity backend tests and TypeScript. Coverage includes stale searches, local retries, conflicts, required acknowledgement, successful repairs and refresh failure after a committed repair. Desktop/mobile screenshots reviewed; scoped whitespace and UTF-8 checks pass. Restarted the known local backend: the page serves HTTP 200 and backend/proxied API endpoints return the expected anonymous 401. No live repairs or academic data writes have been performed.

## Lecturer capacity organization and policy hierarchy (2026-10-23)

Implemented separate versions, availability and activity views; removed stacked histories and overview planning prose. Added a two-row published-policy/draft card, explicit multiple-draft selection, contextual preparation actions and an optional planning reference in preparation. Availability uses exact lecturer scoping, current/scheduled defaults and read-only details. Added bounded server collection paging/filtering while preserving legacy response compatibility and Office authorization. Overview roster filters/page and scroll are retained; history loading is deferred. Verified eight focused frontend checks, 108 mounted browser scenarios at 1440/1280/390/320px, 46 backend regressions plus the final seven-test browse suite (six overlapping and one additional activity-search case), and TypeScript. Reviewed desktop/mobile overview, versions, availability and modal screenshots. Scoped whitespace checks pass. Restarted the known local backend; the capacity page serves HTTP 200 and backend/proxied API endpoints return the expected anonymous 401. No live academic records were changed.

## Office monitoring destinations (2026-10-23)

Fixed the five generic Office dashboard Monitoring destinations with explicit scoped routes and matching record filters. Added a clear scope notice, fresh entry filters and preserved workload Dashboard return context. Verified 14 focused/frontend integration tests, 10 mounted navigation scenarios across 1440px/390px (real dashboard anchors through destination views, stale filters, clear scope and return context), the four workload summary scenarios, 34 Office/Coordinator backend tests, and TypeScript. Browser suites pass when run separately; one simultaneous cold-start run exhausted the headless startup budget before fixture completion. Restarted the known local backend because its process predated the filter change; backend and frontend API proxy respond with the expected anonymous 401, and the frontend serves HTTP 200. No live academic data was changed.

## Workload monitoring summaries (2026-10-23)

Added shared summary cards above Panel and Supervisor workload records. Cards track the complete filtered collection, distinguish Panel reservations, identify missing published capacity and avoid false totals during loading/failure. Focused count tests and existing workload regressions pass (7 tests). Mounted checks pass for both pages at 1440px and 390px, covering filters, empty results, loading, failures, retry and responsive containment. TypeScript passes. Reviewed desktop/mobile screenshots and kept all card values aligned. Fixed an existing unconditional 900px workload-table minimum width so mobile record cards fit the viewport; the desktop minimum remains.

## Consistent dashboard headers (2026-10-23)

Replaced separate role-specific heading definitions with DashboardHeader and made semester metadata responsive in one row. Added coverage that renders all four real dashboards and checks consistent title, description and semester context. All 24 mounted desktop/mobile scenarios and six focused dashboard checks pass. Desktop and mobile screenshots reviewed; scoped whitespace checks pass. TypeScript passes.

## Dashboard semester header context (2026-10-23)

Replaced the oversized semester summary card with borderless header context across all four dashboard roles. The semester name and status sit together above a muted date range. All 24 mounted desktop/mobile scenarios and five focused dashboard checks pass. Mobile layout reviewed; scoped whitespace checks pass. TypeScript passes.

## Dashboard semester summary layout (2026-10-23)

Reworked the cramped semester strip into one shared dashboard summary card: removed the icon, increased padding and type sizes, separated the dates and aligned the status at top right. All 24 mounted desktop/mobile checks pass, including computed typography, padding and containment. Reviewed the mobile layout; TypeScript and scoped whitespace checks pass.

## Dashboard semester dates (2026-10-23)

Updated dashboard semester summaries for students, lecturers, coordinators and office staff, and simplified the shared timeline heading. All 24 mounted desktop/mobile scenarios pass, including dates with and without a timeline; focused student/lecturer and Malaysia date checks pass. TypeScript and scoped whitespace checks pass. Reviewed the mobile summary and simplified timeline heading.

## Timeline edit modal (2026-10-22)

Converted Edit event to the shared modal and added mounted coverage for modal containment, dirty Escape confirmation, keeping/discarding edits, fresh reopening and nested extension cancellation. All 22 mounted desktop/mobile scenarios, focused record-surface checks and TypeScript pass. Reviewed the mobile modal layout; scoped whitespace checks pass.

## Timeline event creation and import (2026-10-22)

Implemented the approved single Add events entry point and shared creation/import dialog, replacing the rejected toolbar placement. Verified all 22 mounted scenarios at desktop/mobile widths, including method draft retention, file retention, dirty-close confirmation, fresh reopening, template error placement, import failure handling and viewport containment. TypeScript passes; creation screenshots reviewed at 1440px and 390px. Focused semester rendering and scoped whitespace checks pass. Reviewed the import layout and made replacement behavior prominent with the shared warning alert; supporting workbook guidance is expandable.

## Timeline action simplification (2026-10-22)

Simplified timeline rows to Edit event and quiet Delete; moved Extend the deadline to a separate editor section with unsaved-change protection. All 22 mounted desktop/mobile checks and TypeScript pass, including extension cancellation/editor retention and dirty-edit protection. Desktop layout reviewed; scoped whitespace checked.

## Timeline action consistency (2026-10-22)

Updated timeline actions and Tools dropdown to the shared portal patterns. Expanded mounted coverage for delete confirmation/cancellation, Tools menu visibility/Escape and template failure handling. All 22 mounted scenarios pass at desktop/mobile widths, along with shared Supervisor tools checks, TypeScript and scoped whitespace checks. Reviewed the desktop screenshot and adjusted status/action spacing.

## Timeline workspace consistency (2026-10-22)

Implemented the timeline consistency update: capacity-style semester selection, workspace tabs, shared responsive tables/filters/pagination, readable table text and deduplicated semester session. All 22 mounted timeline/workflow scenarios pass at 1440px and 390px, including immediate filtering/reset/pagination and existing edit/error paths. Focused semester rendering and TypeScript checks pass. Desktop/mobile screenshots reviewed; adjusted column padding and status width to prevent badge wrapping. Scoped whitespace checks pass.

## Semester list simplification (2026-10-22)

Removed the three operational count columns from the Academic Semesters list, separated start/end dates and reduced the table minimum width. Kept the current-semester summary and lifecycle workflows. Verified focused semester checks, TypeScript and scoped whitespace.

## Application step scroll correction (2026-10-22)

Follow-up reproduced the remaining issue: a real pointer click committed Continue-to-Submit button reuse before the browser default action, triggering declaration validation and scrolling down. Added distinct button keys and cancelled Continue default submission. The earlier programmatic-click test missed that timing; the strengthened regression fails before this fix and passes after it. All 60 wizard scenarios and TypeScript pass.

Fixed Step 3 to Step 4 retaining a lower scroll position. Added a failing mounted bottom-of-Step-3 regression, then verified all 60 wizard scenario runs at 1440/390/320px. Scoped whitespace and TypeScript checks pass. Draft resume behavior and submission rules are unchanged. Evidence: output/wizard-step-scroll-20261022.

## Requirement button alignment (2026-10-22)

Fixed the Add requirement icon/label alignment using the existing shared button API. Checked the component markup, scoped whitespace and TypeScript; no behavior or API changes.

## Evaluation-period empty layout correction (2026-10-22)

- Replaced the oversized centred empty region beside a narrow form with a compact shared notice above a full-width editor. Grouped name/semester, programme/roles and opening/closing controls; strengthened scoped label/value typography and clarified draft guidance.
- Verified existing contextual-feedback browser scenarios at desktop/mobile sizes, visually reviewed empty-state previews, and checked targeting/deadline regressions, TypeScript and production build. No backend or live academic records changed.

## Five-module feedback consistency (2026-10-22)

- Completed contextual feedback across Dashboard/Timeline, Supervisor, Panel, Marks and Workflow/Approval Tracking plus their semester/capacity/period dependencies. Shared notices now distinguish field validation, failed actions, read failures, business restrictions and information; owned routes use compact section-read errors. Default ErrorState presentation remains compatible outside the owned scope.
- Fixed exact-record/semester retry paths, invisible reconciliation-preview failures, nomination input/recovery handling, saved-component/period refresh ambiguity, and misleading save feedback. Read-only recovery remains available after nomination cancellation; successful writes are not repeated to recover reads. Existing academic, role, confirmation and signed-preview rules remain intact.
- Verification: 56 new mounted browser scenario runs pass across the four new suites (desktop/mobile where applicable). Existing capacity, 112 period-workspace scenarios, 48 semester-activation scenarios and 21 shared-dialog scenarios pass. Final focused form browser rerun passes 30 scenarios after review fixes. Final TypeScript and production build pass; scoped whitespace and UTF-8 checks pass. Existing ExcelJS chunk-size advisory remains.
- Broader frontend test run: 288/289 checks pass across 198 files. The one failure is the existing RegistryDropdowns source assertion requiring literal aria-haspopup="listbox"; HEAD already uses the conditional searchable/select-only form and SelectMenu was not changed by this task. It is documented rather than altering unrelated Registry work.
- Independent review identified two introduced recovery visibility issues; both were corrected and rechecked with no remaining material findings. Desktop/mobile semester error previews were visually inspected. Audit: docs/FIVE_MODULE_FEEDBACK_AUDIT_2026-10-22.md; evidence: output/five-module-feedback-20261022. No live academic writes, backend changes, migrations, commits or pushes in this feedback pass. Existing unrelated changes are preserved.

## Semester activation clarity (2026-10-21)

- Completed: separate Semester details and server-derived Activation readiness sections; explicit prevention of activation before the current active semester's inclusive end date has passed; a focused shared activation confirmation modal. Capacity guidance/navigation is beside its check, and empty evaluation reviews no longer show a zero-filled table.
- Existing signed Marks previews, unfinished-work acknowledgements, closure audits and capacity checks remain authoritative. Fresh review/confirmation checks, unsaved/busy protections, 403/409 blocking, mismatch detection, duplicate prevention and save-versus-refresh handling are covered.
- Verification: 42 Django tests, 48 mounted browser scenarios at 1440/390/320px, 6 focused frontend checks, TypeScript, production build and migration dry-run pass. Independent scoped review found no material findings; desktop/mobile previews were inspected. The existing ExcelJS chunk advisory remains.
- Restarted the local backend. A read-only Office check of a live Draft returned HTTP 200 with activation blocked by its future start, the still-running current semester and incomplete lecturer capacity. Direct/proxied anonymous reads correctly return 401; the semester frontend route returns 200. No live academic records were changed during verification.

## Academic Semester presentation polish (2026-10-21)

- Updated semester view navigation to the Supervisor workspace treatment; made End semester red and removed the redundant action heading.
- Improved draft/transition field spacing and entered/selected text readability. Lifecycle and closure safeguards are unchanged.
- Verification: 4 isolated browser previews pass at 1440px/390px, checking tab switching, red End styling, label spacing, value typography and horizontal overflow; desktop/mobile extension screenshots were inspected. All 3 focused semester test files, TypeScript and production build pass. The existing ExcelJS chunk-size advisory remains. No live lifecycle changes were submitted.

## Resumed Supervisor application progress correction (2026-10-21)

Reproduced the missing green Step 1 indicator with a failing mounted regression: resume explicitly cleared all completed steps. Resume now silently validates the saved snapshot using the existing step rules and restores valid earlier details/research-writing indicators and return links. Incomplete writing and supervisor/documents needing fresh checks remain uncompleted. Verification: all 57 mounted scenario runs (19 scenarios at 1440/390/320px), TypeScript and scoped whitespace checks pass; the resumed desktop preview visibly shows the green Step 1 tick. Logs/screenshots are in output/research-intent-layout-20261021. No draft schema or backend changes.

## Supervisor application draft controls polish (2026-10-21)

Replaced the inline successful-save paragraph with the existing success toast, removed the sticky draft toolbar outline, and grouped Last saved into a labelled timestamp block. Resume and Discard now use full-width primary and destructive buttons with icons. Existing confirmation, failure recovery and draft data behavior are preserved. Verification: all 54 mounted browser scenario runs (1440/390/320px), two focused toast/application checks, TypeScript and production build pass. Desktop/mobile draft-popup screenshots were inspected; artifacts and browser log are in output/research-intent-layout-20261021. Existing ExcelJS chunk-size advisory remains. No backend or shared primitive changes, live academic writes, commits or pushes.

## Supervisor application layout refinement (2026-10-21, implemented and verified)

Implemented the approved compact top-right sticky Save draft toolbar, on-demand draft help/resume/discard, connected desktop progress and compact mobile progress. Research intent now has five expanded cards with optional project course codes first and the short abstract last. Field, course, upload and declaration errors render below their controls with accessible associations; unrelated edits preserve outstanding errors. Footer contains only Back and Continue/Submit. Shared portal primitives, reviewer views, backend contracts and academic rules are preserved.

Added mounted regressions and confirmed the original four layout/validation failures before implementation. Final verification: all 54 mounted browser scenario runs pass (18 scenarios at 1440/390/320px), 25 focused frontend checks pass, TypeScript and the production build pass, and scoped whitespace checks pass. Desktop/mobile screenshots were visually inspected; artifacts and final logs are in output/research-intent-layout-20261021. Portal and proxied API health both return HTTP 200 on port 3001. The existing ExcelJS chunk-size advisory remains; the full frontend suite was not rerun for this scoped refinement (the pre-existing RegistryDropdowns source assertion is documented below). Tests use isolated HTTP fixtures; authenticated live writes and native keyboard Tab traversal were not exercised. No backend edits, migrations, academic data writes, commits or pushes in this refinement.

## Supervisor Research Intent integration (2026-10-21, implemented and verified)

User approved Research Intent as mandatory for all new student Supervisor applications across every programme/course, with a four-step form, saved text drafts and consistent authorised review. The approved spec and implementation checklist are under `docs/superpowers/specs/2026-10-21-supervisor-research-intent-design.md` and `docs/superpowers/plans/2026-10-21-supervisor-research-intent.md`.

Implemented all nine mandatory intent fields, the four-step form, owner-only server text drafts with explicit resume/discard, full-content review/declaration and a shared authorised submitted-intent view. Shared student/project/supervisor values are entered once. Final creation validates intent and deletes the student's draft in the existing atomic workflow transaction; failures retain it. Historical/Office replacement records remain null. Files and declaration are excluded from saved drafts and the interface explains reselection. Resume replaces current writing only after confirmation when dirty; deleting the saved draft keeps current writing. Hidden/inert steps preserve course/file editing state. JSONB-independent comparisons avoid false unsaved warnings after resume.

Observed red tests before implementation for missing intent, unavailable drafts, old form structure and order-sensitive draft comparison. Independent read-only integration review found no remaining material issue after nested intent error routing and invalid plain-text handling were corrected. Applied only additive appointments migration `0018_supervisor_research_intent_and_draft` locally after reviewing its plan; existing academic data was not edited or submitted. Updated creation fixtures, including negative policy cases, so new mandatory intent does not mask existing capacity/intake/document/role checks. The migration preservation test now compares every historical column and verifies null legacy intent and empty new models.

Final verification: all **444 backend tests** pass (`appointments` plus `academics.test_operational_periods`), using the separate runner-created `test_intent_root_20261021` database and fast password hashing only within the test process; the runner destroyed that test database afterwards. All **36 mounted browser scenarios** pass at 1440/390/320px with real components/CSS and isolated HTTP fixtures. Covered incomplete save/resume, failed/pending saves, late reads, resume/discard confirmation, full review, declaration reset, multipart submission, nested server field errors and legacy submitted views. TypeScript, production build, Django check/migration drift and scoped whitespace checks pass; existing ExcelJS chunk-size advisory remains.

Full frontend regression: **286 of 287 checks pass**. The sole failure is the pre-existing source-text assertion in `RegistryDropdowns.test.ts`, which expects literal `aria-haspopup="listbox"` while the previously modified searchable `SelectMenu` correctly chooses `dialog` or `listbox` dynamically. Neither component nor test was changed by this task. All affected Research Intent/Section A/shared detail/document scripts pass. Authenticated live-browser submission and native OS keyboard traversal were not exercised; no academic decisions were made.

Screenshots and logs: `output/research-intent-20261021/` (desktop/mobile intent, field groups, review and submitted detail; final backend/frontend/browser/build logs). Restarted the verified local backend with the existing launcher under the project Python environment after the original global environment lacked its existing ReportLab dependency; backend listener PID 14448, launcher PID 29520. Vite remains on port 3001. Direct/proxied `/api/health/` return 200 and the unauthenticated draft endpoint returns 401. Launcher logs are in system Temp/fkstm-research-intent-20261021. No dependencies, commits or pushes were added.

## Submission form structure correction (2026-10-21)

Replaced disconnected search/dropdown with a single event popup containing search and results. Removed the expanding import mini-form: Use these dates fills the actual schedule days and preserves times; missing times prevent saving and differing entered dates require confirmation. Reorganized the form into three sections, widened its shared modal to 880px, darkened/enlarged scoped typography and kept its header/footer visible with body-only scrolling. Reduced duplicate event details and routine warnings. No backend/data/shared default behaviour changes.

Verification: 112 mounted browser scenario runs pass at 1440/1280/390/320px, including first-match Enter selection, active-result visibility after scrolling upward, Escape, Tab without selection, required clock times, replacement cancellation and fixed header/footer. All 32 focused frontend/selector checks and TypeScript pass. Final review found no remaining material findings. Chrome completed the interaction checks but its separate screenshot process failed; the installed Edge browser completed the suite and captures. Production build passes with the existing ExcelJS chunk-size advisory. Final desktop/mobile creation, linked-date and popup previews were inspected and saved under output/submission-form-structure-20261021. Scoped whitespace and UTF-8 checks pass. Browser checks use isolated HTTP fixtures; authenticated live-browser and native OS Tab traversal were not exercised. No commits or pushes. Existing access rules, APIs and local academic data are unchanged; Vite hot reload serves the update without a backend restart.

## Linked window date clarity (2026-10-21)

Implemented searchable bounded event selection reused during creation and later linking, explicit calendar-day import with required Malaysia times and replacement confirmation, linking before dates, ongoing ownership copy and inline date-impact notices. Common extensions explain linked timeline changes and reopening of expired enforced intake; selected extra time explicitly preserves the common deadline and timeline. Publication copy reflects whether activity restrictions are already enabled. Timeline metadata and Office views now separate lifecycle, date status and enforcement. Existing access and extension policies are retained; no migrations or academic data writes.

Verification: all 108 mounted browser scenario runs pass at 1440/1280/390/320px, together with 67 backend tests and 27 focused frontend checks. TypeScript, production build, scoped whitespace and UTF-8 checks pass. The existing ExcelJS chunk-size advisory remains. Final read-only review found no actionable findings. Creation and expanded date-import previews inspected at desktop/mobile sizes and saved under output/linked-window-dates-20261021. Browser tests use isolated HTTP fixtures; authenticated live-browser interaction and native keyboard Tab traversal were not exercised. Restarted only the verified local backend using its existing launcher (launcher PID 35096; logs in system Temp/fkstm-linked-dates-20261021-180255). Direct and Vite-proxied API health and /dashboard/periods return HTTP 200. Vite remains on port 3001. No commits or pushes.

## Periods selector and divider polish (2026-10-21)

Centred the Active/status badge beside the semester dropdown and removed the footer-note border that duplicated the empty-state or table separator. Changes are limited to OfficePeriodsManagement and Office-scoped period CSS. All 92 mounted browser scenario runs pass at 1440/1280/390/320px, alongside four focused semester/workspace checks and scoped whitespace checks. Desktop/mobile previews inspected and saved under output/periods-layout-polish-20261021. No API, data or shared primitive changes.

## Submission window modal and creation-time timeline link (2026-10-21)

Implemented Add/Edit using the existing shared modal components, optional event selection during creation, atomic draft/link save with audits, visible row connection state and explicit unlinked recovery. Dirty/busy guards preserve form data; successful save and dismissal restore useful focus. Review caught same-semester navigation dismissal and conflict recovery after a failed calendar reload; mounted red-to-green cases cover both fixes. Final focused re-review found no remaining actionable findings. No migration, global shared primitive or protected participant/delegation changes.

Verification: 65 backend tests and all 92 mounted browser scenario runs pass at 1440/1280/390/320px; 23 focused frontend/API checks pass. TypeScript, production build, scoped whitespace and UTF-8 checks pass; the existing ExcelJS chunk-size advisory remains. Desktop/mobile creation modal screenshots inspected and saved under output/periods-submission-modal-20261021. Native keyboard Tab traversal and authenticated live-browser interaction were not exercised.

Appended two informational, unlinked events to the existing local demo timeline 12 (semester 1): event 110, Demo: Supervisor application window (22-29 October 2026), and event 111, Demo: Panel recommendation window (2-9 November 2026). Existing four events retained; no submission windows were created and enforcement was unchanged. Idempotent append script is saved in the same output directory. Restarted only the verified backend with its existing launcher (launcher PID 3352, listener 22972); Vite remains on 3001. Direct/proxied API health and /dashboard/periods return HTTP 200. Logs: system Temp/fkstm-submission-modal-20261021-150527. No commits or pushes.

## Periods and deadlines redesign (2026-10-21)

Implemented the approved submission overview, plain semester selector, clearer date-restriction wording, window records, programme-coverage confirmation, timeline setup/link/create guidance and scoped Marks configuration entry. Draft publication remains separate from date enforcement; pending approvals remain reviewable. Existing audited history/extensions, closed-semester Marks task recovery and backend authorisation retained. No backend/shared-primitive/protected-area changes or live academic writes.

Final verification: 23 focused frontend/API/presentation checks and all 64 mounted browser scenario runs pass at 1440/1280/390/320px, including 1000px desktop content. TypeScript, production build and scoped whitespace checks pass. Review identified stale managed controls, selected-form reset and late cross-semester selection/mutation responses; focused red-to-green regression cases cover the fixes. Final focused re-review found no remaining material findings. Desktop/mobile overview, window, calendar modal, coverage confirmation and Marks entry previews inspected; screenshots saved under output/periods-deadlines-20261021. Authenticated live-browser and native keyboard Tab traversal were not exercised. Existing ExcelJS chunk advisory remains.

## Capacity lecturer View/Edit modals (2026-10-21)

Implemented the approved shared modal interaction for roster View and Edit limits. The table remains mounted; dirty edits prompt before closing or routing away, saves block closing/navigation/duplicates, and errors retain inputs. Current limits accompany draft inputs. Preparation, comparisons and publication retain existing page flows. Final focused review found no actionable issues. All 84 mounted browser scenario runs pass at 1440/1280/390/320px, covering modal presence, first-field focus, filters/page/scroll restoration, clean Escape/backdrop dismissal, dirty Cancel/Escape/Back/route prompts, refresh protection, conflict retry and deferred-save guards. TypeScript, production build and scoped whitespace checks pass; existing ExcelJS chunk-size advisory remains. Desktop/mobile View/Edit fixture screenshots inspected and saved under output/capacity-lecturer-modals-20261021. Native keyboard tab trapping and authenticated live-browser interaction were not exercised. No backend, shared primitive, protected-area or live academic data changes.


## Capacity creator/date gap (2026-10-21)

Increased desktop Created on header/cell left padding to separate it more clearly from Created by, preserving the user's column widths and existing mobile layout. All 68 mounted browser scenario runs pass at 1440/1280/390/320px; desktop history screenshot inspected. The first run exposed an existing timing-sensitive highlight assertion during the shared color transition; the fixture now waits for the final color without changing its assertion or production highlighting. Scoped whitespace checks pass. No backend, shared component or protected-area changes.


## Compact capacity history actions (2026-10-21)

Changed Continue editing to Edit draft in version rows and moved the Action column slightly right through capacity-scoped column sizing. Existing Discard and mobile wrapping retained. All 68 mounted browser scenario runs pass at 1440/1280/390/320px, including opening a draft through the renamed action. Desktop/mobile version screenshots inspected and saved under output/capacity-compact-actions-20261021. TypeScript and scoped whitespace checks pass. No API, business-rule, shared-component or protected-area changes.


## Capacity attention filtering and direct discard (2026-10-21)

Implemented the approved concise warning, table-local Show filter, distinct lecturer result count and affected-row highlighting. Replaced the draft Tools menu with a direct shared Discard button beside Continue editing; preserved the existing reason/confirmation/retention flow. All 68 mounted browser scenario runs pass at 1440/1280/390/320px, including preserved search/role, multiple issues per lecturer, empty results and discard cancellation/failure/retry. TypeScript and scoped whitespace checks pass. Desktop/mobile editor and history fixture screenshots inspected and saved under output/capacity-attention-discard-20261021. Production build passes; existing ExcelJS chunk-size advisory remains. No backend, shared primitive, protected-area or live academic data changes.


## Local server restart (2026-10-21 11:58 MYT)

Restarted only the verified project Vite and Django processes using their existing commands/configuration. Frontend listens on 127.0.0.1:3001 (PID 24636), backend on 127.0.0.1:8000 (listener PID 13660; launcher 34252). Direct/proxied API health and Lecturer capacity page return HTTP 200. Logs: system Temp/fkstm-server-restart-20261021-115824. No application or data changes.


## Capacity duplicate back control (2026-10-21)

Removed the second back link from capacity draft/version/history views. One shared header control returns nested views to Lecturer capacity; the overview retains Dashboard/caller navigation. Existing comparison and revision actions remain. All 64 existing mounted browser scenario runs pass at 1440/1280/390/320px, including single back control and correct return destination checks for draft/history/version views. Desktop history fixture screenshot inspected; TypeScript checking passes. No backend, shared primitive or protected-area changes.


## Capacity preparation and draft discard (completed 2026-10-21)

Final focused review found no actionable correctness, security or UX regression in preparation, version history or audited discard.

Implemented the approved single-action preparation form: continue a selected existing draft, or create from current published limits, an eligible previous semester or blank. The responsive versions table has aligned metadata, status filtering, pagination and per-draft tools. Discard requires a reason and explicit confirmation naming the semester/version, retains the plan/entries and an immutable audit, removes the draft from active choices and leaves it read-only in history. Published limits and protected participant/delegation areas are unchanged.

Verification: 69 backend tests pass (new discard API/service cases plus existing capacity lifecycle, API and resolver checks); all 64 mounted capacity browser scenario runs pass at 1440/1280/390/320px, including source choices, cancellation, failed-write retry, committed-write/read-failure recovery, status filtering and discarded read-only inspection. Four focused capacity helper/summary scripts, TypeScript checking, production build and whitespace checks pass. Desktop/mobile preparation and history fixture screenshots were inspected. Existing ExcelJS chunk-size advisory remains. Choice-only migration 0005 applied; backend restarted using the existing configured launcher. Direct/proxied health and capacity page return 200, anonymous discard endpoint returns 401. Runtime logs: system Temp/fkstm-capacity-discard-20261021-104712. No live drafts were discarded, no academic records were changed and no commits or pushes were made.

## Capacity policy action placement (completed 2026-10-21)

Moved Versions and history from the draft-action row to the policy heading, using a compact shared icon button at the right on wider screens. Continue draft and Prepare limits remain together below, preserving their primary/secondary hierarchy. Narrow layouts wrap without horizontal overflow. All 40 existing capacity browser scenario runs and TypeScript checking pass; desktop and 320px fixture screenshots were inspected. No business-rule, API, shared primitive or protected-area changes.

## Capacity overview grouping (completed 2026-10-21)

Refined the approved top section of Lecturer capacity: standalone labelled semester dropdown with adjacent lifecycle badge and nearby dates; one shared policy card containing version status, grouped continuation/preparation/history actions, planning baseline and expandable policy issues. Existing draft continuation is primary. Stronger field contrast and page-scoped responsive spacing preserve the shared system design. Business rules, APIs, shared primitives and protected areas are unchanged.

Verification: all 40 existing capacity browser scenario runs pass at 1440/1280/390/320px, TypeScript checking and production build pass, and desktop/mobile isolated fixture screenshots were visually inspected. The existing ExcelJS chunk-size advisory remains. No live academic writes, commits or pushes.

## Lecturer capacity redesign and self-managed availability (completed 2026-10-21)

Implemented on codex/portal-consistency-and-toast. Office capacity now opens on student workload and published limits, with a portal-wide student-to-lecturer planning baseline, shared filter card/Clear filters, responsive paginated roster and lecturer details. Draft preparation exposes existing drafts before new creation, opens new drafts immediately, includes missing lecturer rows, keeps proposed values separate from live policy and provides affected-row filtering and recovery for obsolete/ineligible draft entries. Publication retains explicit review, reason, consent and fingerprint/version checks. Read-only versions, comparisons, audit and availability history remain accessible. Recorded role limits remain visible/filterable even after role removal; historical/ineligible lecturers and active work remain visible without permitting edits. Unlinked legacy Panel identities produce unavailable unique student totals rather than invented counts.

Lecturer Dashboard now links to /dashboard/my-availability. The lecturer-owned page uses shared guarded RecordPage, held-role/date/reason fields, paginated history and DecisionDialog consent before save or cancellation. New self endpoints enforce authenticated ownership and literal confirmation; existing audited services preserve role/date/overlap/assignment rules. No Office approval is introduced. Existing appointments remain active. RecordPage blocks local/sidebar/browser navigation for unsaved input and blocks navigation during saves. Confirmation closure preserves the form; a committed mutation followed by read failure cannot be submitted twice.

Verification: 40 backend tests passed (13 workspace, 13 self availability, 14 existing resolver); 152 mounted browser scenario runs passed (40 Office capacity at 1440/1280/390/320, 48 self availability at 1440/390/320, 64 existing Office Dashboard checks). Focused capacity/role summary/history/route scripts pass. Review findings were fixed with regressions; final review found no remaining actionable issue. Final TypeScript checking and production build passed after the last role-filter adjustment; the existing ExcelJS chunk-size advisory remains. Scoped whitespace checks pass. Four protected/shared-style file hashes match the task baseline. Isolated fixture screenshots were visually inspected; live browser inspection remained blocked by browser policy. Backend restarted using the existing configured launcher; both page URLs and API health/proxy return HTTP200, anonymous self endpoint returns401. Logs: system Temp/fkstm-capacity-servers-20261021-004542. No live academic writes, schema changes, commits or pushes.

## Appointment filter consistency across roles (2026-10-20)

Created the requested plan and two critiques, then implemented the shared WorkspaceFilterCard and always-visible Clear filters for existing Lecturer/Student filter lists, including search-only supervision and Panel supervisee browsing. Office/Coordinator appointment cards retain their compact design and useful fields, with one date cutoff. Removed bounds cannot silently restrict matching records or exports. Atomic Student/Lecturer URL resets preserve History, page size and source context; reset behaviour remains owned by each list. Student Panel stays a single-record overview. All 14 scoped component regression scripts and the query-reset helper check pass. All 32 mounted scenarios pass at 1280px/390px, exercising real Student/Lecturer request controllers, shared Clear filters, History/page-size/source preservation, staff date/sort/reset semantics, exact record returns and all-page Excel scope. The browser rerun includes stale removed upper-bound values in staff Panel memory. TypeScript, production build and scoped whitespace checks pass; desktop/mobile staff screenshots were visually inspected. Existing ExcelJS chunk-size advisory remains. API reads were mocked in browser tests; no live academic records, commits or pushes were made.

## Appointment filter simplification (2026-10-20, narrowed after user correction)

The initial implementation expanded the search, moved sorting/exports into a results toolbar and separated dates. The user rejected that visual redesign; those changes were removed. The final change preserves the original filter layout and removes only redundant current Panel status, ended Supervisor status and single-option Supervisor student sorting controls, including stale saved-value handling. All 11 focused frontend regression scripts, 26 mounted browser scenarios at 1280px/390px, TypeScript checking and production build pass. Browser checks cover request/history scope, sorting, search, dates, reset, lecturer/student/detail return and all-page Excel exports. Restored desktop layout was visually inspected. Existing ExcelJS chunk-size advisory remains. No academic records, commits or pushes were made.

## Needs attention filter card (2026-10-20)

Added the missing full border, rounded corners and responsive inset spacing to the Needs attention filter area. Headless Chrome checks using the served portal CSS confirm four 1px borders, 12px corner rounding, responsive 20px/16px margins and no horizontal overflow at desktop and narrow widths. TypeScript checking and all three Office Dashboard UX tests pass; documentation whitespace checks pass.

## Workload filter card borders (2026-10-20)

Removed the Office workload filter override that set left/right borders and corner radius to zero, restoring the existing full rounded border for both Supervisor and Panel workload filters. Headless Chrome computed-style verification with the Office stylesheet confirms all four borders are 1px and the corner radius is 12px (previously 0px side borders and radius). Management workload regression tests, TypeScript checking (`npm run lint`), and `git diff --check` pass.

## Project server restart and branch check (2026-10-20)

Confirmed this checkout is on codex/portal-consistency-and-toast; current changes remain local and uncommitted. Neither project port was listening, so started a fresh hidden frontend on 127.0.0.1:3001 and the existing configured backend launcher on 127.0.0.1:8000. Dashboard, backend health and health through the frontend API proxy each return HTTP 200. Logs: system Temp/fkstm-server-restart-1792498433. No source/configuration or academic data changes; requirements and architecture remain unchanged.

## Complete Office attention workspace (2026-10-20)

Completed the approved Office-only attention workspace and compact Dashboard category preview. Full totals are calculated before limiting the preview to four groups; category links open filtered records and View all attention opens the full inbox. Added shared filters, responsive records table and pagination, exact Office request/evaluation destinations, remembered URL/list state and attention-aware return labels. Protected participant/delegation implementations, shared primitives, global CSS, Reports and other-role Dashboard behavior remain unchanged.

Fresh verification: TypeScript and production build pass (existing ExcelJS chunk advisory remains); nine focused frontend checks and all 64 mounted scenarios pass at 1440/1280/390/320px, including paging beyond 20 and debounced search. Fourteen backend attention/co-supervision/legacy Dashboard checks pass, followed by a fresh seven-test attention run including SQL capture confirming GET issues no INSERT/UPDATE/DELETE/ALTER. The test harness now waits for React's first commit before checking loaded state, fixing an existing mount timing race.

Live read-only inspection confirmed full-list/category navigation, capacity return, exact Panel detail and restoration to page 2, desktop column sizing and phone viewport bounds. Independent review caught Office-specific destination mismatches and search request amplification; corrected both and re-reviewed with no significant findings remaining. Screenshots: output/office-tools-structure-20261020/attention-home-complete.png, attention-workspace.png and attention-workspace-phone.png. Restarted the project backend to load the endpoint; frontend remains on port 3001. No live academic data writes, migrations, commits or deployment.

## Monitoring aligned list (2026-10-20)

Raised Monitoring from 14px to 15px and Count from 12px to 13px at the user's request, keeping row typography and column tracks unchanged.

Follow-up size correction: Monitoring labels now share the exact Office tool-name typography rule; counts and View actions use 13px too. Live computed styles confirm all five labels match Academic semesters/calendar/periods in size (13px), weight (600), line-height (18.85px) and color (#0c1424); all three column positions remain identical across rows. Screenshot: output/office-tools-structure-20261020/monitoring-matched-type.png. CSS/documentation-only follow-up; existing row dimensions and navigation are unchanged.

Implemented the approved single-list design with darker labels, bold unboxed counts, explicit View actions and shared column widths for the heading and every row. All five links, metric calculations and read/retry states remain unchanged. Fresh TypeScript and all 48 existing mounted Dashboard scenarios pass. Live 1280px and 320px inspection confirmed identical column positions across all five rows and the Count heading, including wrapped phone labels; no whole-page overflow. Screenshots: output/office-tools-structure-20261020/monitoring-aligned-list.png and monitoring-aligned-list-phone.png. Protected/shared baseline hashes remain unchanged.

## Monitoring entry affordance (2026-10-20)

Removed the Monitoring disclosure and explanation at the user’s request. Added subtle row surfaces, count badges, chevrons and hover feedback. The fifth metric now opens Panel workload, so every Monitoring row is an entry point. Other Dashboard structure is unchanged. Fresh TypeScript, four focused checks and all 48 mounted Dashboard scenarios pass. Live desktop and 390px phone rows reviewed; all five are links, the disclosure is absent, and the phone page stays within the viewport. Screenshot: output/office-tools-structure-20261020/monitoring-entries.png.

## Office home monitoring clarity (2026-10-20)

Implemented the monitoring cleanup after the user requested three critiques followed by implementation. Kept the section within Office tools, replaced the inline underlined sentence with five aligned label/count rows, added a heading and expandable scope explanation, and preserved existing reads/retries/destinations. Updated an existing browser-fixture text wait for the sentence-case label. Fresh TypeScript, four focused checks and all 48 mounted Dashboard scenarios pass. Live desktop and 390px phone layouts and disclosure interaction were reviewed; phone page width stays within its viewport. Protected baseline hashes and scoped diff checks pass. Screenshots: output/office-tools-structure-20261020/monitoring-clean.png and monitoring-phone.png. No live academic writes, commits or deployment.

## Office tools cleanup after inspection pass (2026-10-20)

The preceding inspection pass also made local UI edits before the user expected implementation. Work stopped when the user objected. Changes still in the tree: reusable Office context/section/view composition; semester records and filters in one panel; capacity action placement, consolidated summary and expandable blockers; Calendar context/view controls; Periods activity presentation; Reconciliation labelled filters and records section; scoped workload filters and table width. No backend, API, permission or academic data changes were made.

The user subsequently explicitly requested removing secondary participant buttons and Related tools rows. Removed participant buttons from semester browse and record views, retained Dashboard home access, removed the Semesters/Calendar Related tools rows and unused CSS, and updated affected existing checks. Other prior edits remain local and uncommitted for review. Fresh verification: TypeScript passes; five focused checks and all 53 mounted browser scenarios pass. Live Semesters shows only New semester in the header and no Related tools row. The pre-inspection hashes still match for ParticipantLifecycleManagement, CoordinatorDelegations, App routing, PortalPrimitives and global index.css. Scoped diff checks pass. Screenshot: output/office-tools-structure-20261020/semesters-clean.png.

## Office timeline control spacing (2026-10-20)

Reduced Office home timeline control padding and separated the phase switch onto its own row below the title and Manage Timeline action. Narrow phones stack the management action as well. Uses Office-scoped CSS; shared timeline implementation, other roles and protected areas remain unchanged. All 48 mounted scenarios passed on rerun; desktop and 320px screenshots reviewed. Initial run hit the existing fixture mount/read timing race in the first attention assertion; rerun passed without source changes.


## Office reports entry placement (2026-10-20)

Removed the duplicate Workflow reports link from the Office tools directory at the user’s request. Reports remain accessible through the top-right View Workflow Reports button. Reconciliation and all protected shortcuts remain unchanged. The directory now contains seven tools.


## Shared Dashboard semester timeline (2026-10-20)

Replaced the separate Office timeline preview with the same DashboardTimeline used by Lecturer, Coordinator and Student. Removed the Office-only event cap, alternate header and phase-control styling. The narrower Office column and protected areas remain unchanged. TypeScript, four affected unit checks and all 48 mounted desktop/mobile scenarios passed. The shared calendar retains internal horizontal scrolling on phones.


## Office Dashboard system design consistency (2026-10-20)

Aligned Office Dashboard typography and action casing with the shared system; the home semester strip now follows Lecturer/Coordinator presentation. Approved attention/calendar/tools structure retained. Four affected unit checks passed. TypeScript passed. All 48 mounted scenarios passed at 1440, 1280, 390 and 320px, including direct comparisons of shared/Office heading, button, table-label and form-label computed typography. Protected component hashes match the frozen baseline; scoped diff checks passed.


## Office reports header shortcut (2026-10-20, verified)

Added View Workflow Reports beside the unchanged Manage Participants button using the existing secondary PortalButton and reports route. Retained the existing directory link and scoped wrapping to the Office home action row. Four affected unit checks, TypeScript and all 44 mounted Dashboard scenarios pass at desktop/phone widths. Live demo navigation confirms the new button opens Workflow reports. Requirements and architecture updated; no shared component, protected workflow, API or permission changes.

## Local server restart (2026-10-20)

Stopped the existing project frontend (3001), backend (8000) and isolated Dashboard preview (3318), then started one fresh frontend/backend pair in hidden background processes using the existing launch configuration. Dashboard responds HTTP 200; backend health and health through the frontend proxy both respond HTTP 200. Preview port 3318 is no longer listening. Unrelated applications and database services were left running. No code/configuration or academic data changes; requirements and architecture remain unchanged. Logs: system Temp/fkstm-servers-20261020-143403.

## Office Dashboard home correction (2026-10-20, implemented and verified)

The user authorised implementation after the isolated preview. Removed the rejected Dashboard navigation strip and dropdowns. Home retains the graphical Semester Timeline and P1/P2 selection, compact attention beside it at sufficient content width, and stacked attention/calendar on smaller layouts. Eight native tool links appear in three visible groups; current semester is inline in the header. Routine monitoring is a compact footer with accurate scope. Grouped attention separates Office review from waiting on others, keeps capacity role-entry counts distinct, retains returned categories and states exact deadline subsets. Periods/extensions remain outside Calendar. Existing child-tool improvements remain in place.

Fresh verification: 268 frontend tests pass across 185 test files; TypeScript (`npm.cmd run lint`) and production build pass. The existing ExcelJS chunk-size advisory remains. Mounted checks pass all 44 Office Dashboard scenarios at 1440px/1280px/390px/320px plus five management scenarios. Coverage includes wide/stacked shell layout, exact tool destinations, independent load/error/retry, honest preview units and ownership, empty state, protected/other-role exclusions and protected computed typography, period/Marks deep links, fail-closed semester handling, guarded forms and reports paging/remembered state. Desktop and phone screenshots were inspected. Live read-only Office checks verified all eight tool pages and Dashboard returns, semester detail/return, Reports → student dossier → Reports, and both timeline phases. Live screenshot: output/mockups/office-dashboard-home-implemented.png. Independent source review found three count/scope issues; all were corrected with regression coverage and re-reviewed with no remaining findings.

Frozen hash comparison against the fresh pre-correction baseline confirms unchanged App routing, global CSS, AppLayout, Sidebar, TopHeader, portal primitives/select/dialog, TimelineCalendar and the protected participant/delegation/lifecycle-summary components. Existing protected shortcuts and permissions remain. Updated all three governance documents and the correction plan. Changes remain uncommitted; no reset, stash, push, backend/API/schema/dependency edits or live academic writes.

Limits: native 200% browser zoom could not be verified through the available in-app browser controls. Responsive checks and the earlier CSS-scaling stress case are separate evidence, not a substitute claim for native zoom. The unchanged graphical calendar retains its own horizontal scrolling on phones; the whole page and attention panel do not overflow. Mounted fixtures use mocked APIs and do not mount the full authenticated routing tree; live navigation checks supplement them without policy publication, deadline changes, imports or repairs. The previous rejected design and research/preview sequence remain recorded in the linked plans; this section supersedes their presentation status.

## Office Dashboard UX restructure (2026-10-20, implemented and verified)

Completed the live/source audit and twelve critical proposal reviews, then implemented the authorised changes. Overview puts grouped attention first, moves routine monitoring below it and limits the calendar preview. Consistent local navigation connects Calendar, separate Periods & deadlines, Reports and grouped Administration tools. Semesters, capacity, workload, reconciliation, reports and Office dossier presentation were refined while retaining existing rules and service owners. Manage Participants remains visible in its existing location. Protected lifecycle/delegation components, shared primitives/global CSS and sidebar match the session baseline; their route permission branch is unchanged.

Verification: the full frontend run passed all 263 tests in 185 files. Eleven targeted tests also pass after the final Marks handoff correction, including the new regression preserving historical semester/period context and opening the Marks activity when none is selected. All 27 mounted cases across 1280px/390px/320px and five management mounted scenarios pass. Coverage includes grouped preview units, independent read failure/retry, protected/other-role exclusion and computed typography, period deep-link selection/focus and Marks fallback, invalid semester fail-closed behavior, guarded ordinary forms, all 23 report attention rows and remembered state, Calendar ownership/query loading, complete large capacity histories, historical cancellation guards and prior-policy copy preview. TypeScript and production build pass; the existing ExcelJS bundle-size advisory remains. Mounted tests use mocked read APIs and isolated browser profiles. Live local Office pages and desktop/mobile screenshots were inspected without submitting academic changes. Live Reports-to-dossier navigation was checked; the return label now names Reports. Final independent source review found the Marks context gap; its correction was re-reviewed with no remaining findings.

Limits: this UI task does not revalidate backend business rules through live writes, publish policies, extend real deadlines, import data or execute repairs. Automated component fixtures do not mount the full authenticated App. The audit/implementation plan records the detailed coverage. Existing concurrent work remains uncommitted and untouched outside the task; no commit or push was performed.

## Appointment filter layout mockup (2026-10-20, proposal only)

Created a separate interactive preview at output/mockups/appointment-filters-preview.html after the user's request to brainstorm and view a mockup. It compares Office/Coordinator Supervisor and Panel filters, retains visible fields and existing switch/dropdown choices, removes redundant lifecycle selectors and single-option sorting, and places sorting beside matching-result counts. Search, lecturer/student/detail navigation and return context use fictional local records; no API or academic data changes. Tools and Needs attention are outside this focused preview. Desktop and true 390px iframe checks cover eight preview scenarios each, with screenshots for Panel, Supervisor, requests, past appointments and mobile. This is a design proposal, not approval or implementation of production changes. Requirements and architecture were checked; the current implemented contract remains unchanged.

## Panel appointment filter and tools (2026-10-20)

Replaced the staff Panel Current/Past switch with an Appointments dropdown inside the filter grid for both roles, including lecturer drilldowns. Clear filters restores Current assignments. Removed the duplicate Office Panel Tools Manage capacity/Configuration entry, retaining Workload monitoring and Dashboard capacity management; existing workload-page capacity navigation and capacity rules remain. Supervisor controls are unchanged. This supersedes the Panel switch presentation recorded below.

Fresh verification: nine scoped frontend scripts pass, along with all 22 mounted scenarios across 1280px/390px, TypeScript and the production build. The existing ExcelJS chunk-size advisory remains. Scenarios verify both roles, current/past filtering/reset, exact historical appointment links, inherited search/return, counts, all-page export and monitoring-only Office Tools even when a capacity callback is supplied to the module host. Updated the old tools test's obsolete capacity expectation. Updated screenshots visually inspected: system Temp panel-assignments-{1280,390}.png. Mounted checks use mocked read APIs and disposable browser profiles; no live academic changes. Required governance documents updated; no dependency, migration, commit or push changes.

## Staff appointment workspace simplification (2026-10-20, verified)

Implemented the approved plan after critique: retain Current/Past switch buttons, remove Panel By lecturer/By student controls, ignore obsolete grouping memory and share the existing Supervisor switch presentation. Panel always starts with lecturers and opens their students and exact appointments. Supervisor retains its primary/supporting counts, current teams and existing flat past-appointment history. Main navigation, search, filters, role scope, paging, exports and record flows remain.

The structural regression first failed against the old student mode, then passed after removal. All 12 scoped frontend scripts, 22 mounted desktop/390px scenarios covering both staff roles and modules, TypeScript and production build pass. The existing ExcelJS chunk-size advisory remains. Screenshots were visually inspected and independent focused review found no actionable issues. Mounted tests use actual module hosts, real portal CSS and mocked read APIs; Supervisor View supervision is verified through its callback, not the downstream detail route. Browser profiles are isolated and cleaned up. Evidence: frontend/src/components/AppointmentWorkspaceStructure.test.tsx, frontend/tests/panelAssignments.browser.test.mjs, frontend/tests/panelAssignments.fixture.tsx and system Temp panel-assignments-{1280,390}.png. Plan: docs/superpowers/plans/2026-10-19-appointment-workspace-simplification.md. Requirements and architecture updated. No backend, dependency, migration, live academic data, commit or push changes.

## Office operating workflow and Registry clarification (2026-10-19)

Added `docs/OFFICE_DASHBOARD_OPERATING_WORKFLOW.md` at the user's request for a complete step-by-step Office journey, distinguishing semester setup, capacity publication, calendar/intake, activation, evaluation setup, daily monitoring, conditional exceptions, reports/dossiers and closure/handover. Clarified the Registry handoff: student status editing already reuses the lifecycle service; proposed consolidation concerns student-specific UI/ownership and links, with lecturer/delegation scope separate. No module relocation or runtime change was performed. Requirements and architecture were checked and remain unchanged; this is documentation of current behaviour/proposed ownership, with no browser/regression execution or live academic mutations for this task.

## Student Registry lifecycle teammate handoff (2026-10-19)

Prepared `docs/STUDENT_REGISTRY_LIFECYCLE_HANDOFF_2026-10-19.md` after the user identified student lifecycle as Registry-related and requested a teammate handoff. Current source inspection confirms Student Registry already exposes Change Academic Status and its PATCH endpoint delegates to `transition_student`; the handoff corrects the earlier chat's incomplete description of Dashboard-only placement. Documents existing integration, request contracts, connected lifecycle/Marks/appointment effects, ownership boundaries, proposed UX consolidation, acceptance checks and the related programme-transfer handoff.

This is documentation and an ownership/navigation recommendation, not approval or implementation of a move. Staff lifecycle and acting Coordinator delegation are adjacent scope requiring separate ownership agreement; existing Dashboard participant access remains. Requirements and architecture were checked; current authoritative route/design is unchanged. No application code, academic data, migrations, commits, external messages or regression/browser test runs were made for this handoff.

## Appointment workspace simplification preview (2026-10-19, rejected and superseded)

The user rejected this mockup and explicitly retained the Current/Past switch. The approved implementation and verification above supersede the dropdown proposal below; the preview is retained only as historical design evidence.

The user rejected the nested Current/Past and By lecturer/By student button rows, and questioned the need for a separate student-first view when student search already finds the relevant lecturer. Prepared an interactive proposal in output/mockups/appointment-workspace-preview.html covering Coordinator/Office Supervisor and Panel workspaces: one module-navigation row, lecturer-first browsing, a normal Current/Past appointment filter and the existing lecturer → students → details flow. Supervisor retains primary/supporting counts, Supervisory teams wording and Coordinator programme transfers. The mockup uses fictional data and no APIs; module/role switching, student search, drilldown/return, current/past and viewport fit were checked across 1024px/390px/320px. This is a proposal awaiting user review; no production component, permission or academic data changes were made for this preview. Earlier implementation/verification notes below describe the current code, not approval of the revised structure. Requirements and architecture were checked; implementation updates await the agreed design.

## Staff Panel assignment browsing (2026-10-19, verified)

Implemented the approved shared Panel assignments destination for Coordinator/Office with By lecturer/By student, confirmed current/past separation, lecturer → students → exact appointment drilldowns, inherited search/filter state, 10/25/50 pagination and full matching Excel export. Requests, Needs attention, workload tools and Lecturer/Student navigation retain their purpose. Pure regressions first reproduced absent grouping helpers and the ambiguous navigation label. All four grouping/filter regressions, 11 scoped frontend test scripts, final TypeScript, production build and scoped whitespace checks pass; the existing ExcelJS chunk-size advisory remains.

All 18 mounted desktop/390px checks pass using actual Office/Coordinator hosts, real portal CSS and mocked read APIs. Coverage includes unique counts, pending exclusion, inherited filters, individual appointment return context, two distinct past appointments for one student, lecturer/student and current/past switching, programme/date filters, pagination, unavailable identities, scoped Coordinator responses, failure/retry and a real XLSX download containing every matching page with formula-like text kept literal. Independent review found an inherited lecturer-only sort in the student drilldown; the new mounted regression failed before normalization and passes after it, with no remaining review finding. Desktop/mobile screenshots were visually inspected. The fixture mounts module hosts with a test router rather than full App; shared App source-label/return helpers also have targeted tests. Existing backend programme/delegation authorization is reused without new endpoints or broadened access, not revalidated through live academic submissions.

Evidence: frontend/src/utils/panelAssignments.test.ts, frontend/tests/panelAssignments.browser.test.mjs, frontend/tests/panelAssignments.fixture.tsx and system Temp panel-assignments-{1280,390}.png. Requirements, architecture and completed implementation plan updated. Isolated browser profiles are cleaned up. No dependency, migration, live academic data, commit, push or unrelated cleanup changes.

## Decision dialog header label emphasis (2026-10-19, verified)

Darkened Review decision and the equivalent confirmation label from slate-500 to slate-700 and increased weight from 600 to 700, retaining the 12px size. This makes the label slightly more prominent without competing with the dialog title. Requirements and architecture updated. Existing dialog rendering check and all 21 mounted browser scenarios pass; desktop/320px screenshots were visually inspected. No workflow or academic data changes.

## Workflow analytics filter footer (2026-10-19, verified)

Moved compact Reset/Apply buttons out of the shaded filter-field panel into a separate form footer with the applied-filter summary. Desktop actions sit on the right; mobile places the summary above the actions. This replaces the earlier placement beside the semester dropdown. Existing report rendering check, TypeScript and production build pass; the existing ExcelJS chunk advisory remains. Six isolated mounted checks passed for desktop/tablet/390px Lecturer and Office views, confirming separate actions below the shaded panel with at least 12px clearance, compact single-line buttons, Reset/Apply order, viewport bounds and usable actions. Desktop/mobile screenshots visually inspected. Evidence: system Temp workflow-filter-footer-build.log and workflow-filter-footer-*.png. Required documentation updated. No backend or academic data changes.

## Shared decision dialog presentation (2026-10-19, verified)

Completed the three requested critique passes and applied the focused shared refinement: guarded header X, Cancel default, decision-scoped label/input typography, long-content wrapping and contained scrolling. Existing workflow-specific labels, controller and decision semantics remain. Mounted browser regressions first reproduced the missing close control and typography mismatch against the original implementation. All 21 mounted checks pass across desktop/390px/320px viewports, including native cancel-event/backdrop handling, dirty dismissal, focus return, pending duplicate/dismissal protection, retained failure reasons, persistent 403/409 blocks and explicit secondary labels. Nine affected frontend test scripts, TypeScript, production build and scoped whitespace checks pass; the existing ExcelJS chunk-size advisory remains. Desktop/mobile screenshots were visually inspected, and independent review reported no actionable findings. Tests use real portal CSS and isolated headless browser profiles without live academic API calls; temporary profiles are cleaned up. Evidence: frontend/tests/decisionDialog.browser.test.mjs, frontend/tests/decisionDialog.fixture.tsx and system Temp decision-dialog-{1024,390,320}.png. Requirements and architecture updated. No backend, dependency, live academic data, commit or push changes.

## Workflow analytics compact filter buttons (2026-10-19, verified)

Reduced Dashboard Workflow Analytics Apply/Reset filter buttons to the shared small size and prevented multi-line labels. Replaced equal grid columns with wrapping flexible fields so actions retain natural widths. Existing report rendering check, TypeScript and production build pass; the existing ExcelJS chunk advisory remains. Six isolated mounted checks passed at desktop, tablet and 390px content widths for Lecturer/Office views: buttons remain below 36px high with single-line labels, controls remain within the viewport, and Apply/Reset remain usable. Desktop/mobile screenshots visually inspected. Evidence: system Temp workflow-filter-build.log and workflow-filter-visual-*.png. Requirements and architecture checked/updated. No backend or live academic records changed.

## Research profile history disclosure (2026-10-19, verified)

Separated saved history from the current Research profile card, collapsed history and individual revisions by default, and reset disclosure state when switching students. Added mounted browser regression scenarios for all four roles, newest-first independent disclosures, student switching, empty/missing/failed loads and request-list isolation. All four scenarios failed against the original layout and pass after the change. Fresh verification passed all 241 frontend checks, TypeScript and the production build; only the existing ExcelJS chunk-size advisory remains. Six additional mounted desktop/390px layout checks passed for closed history, expanded history and expanded revisions; desktop/mobile screenshots were visually inspected. Tests use isolated headless Chrome profiles and mocked read APIs, with temporary runtime folders cleaned up. Evidence: frontend/tests/researchProfileHistory.browser.test.mjs, system Temp research-history-frontend.log and research-history-visual-*.png. Requirements and architecture updated. No backend or live academic records changed.

## Student Panel dossier privacy (2026-10-19, verified)

The user approved result-only Student Panel visibility. Replaced the public dossier nomination-history projection with confirmed appointment results/history plus generic pending status, preserving an active incumbent during replacement review. Added a dedicated Student results card without staff fields, feedback or audit. Reproduced the previous exposure in failing API/rendering regressions before implementing the correction. All 241 frontend checks, 53 affected backend tests, TypeScript and the production build pass; only the existing ExcelJS chunk-size advisory remains. Eight mounted headless Chrome checks passed across desktop/390px content widths for confirmed-plus-pending, processing, history-only and staff views. Screenshots were visually inspected, and staff feedback/audit access remains intact. Tests used disposable PostgreSQL databases and mocked page APIs without live academic changes. Evidence: system Temp student-panel-dossier-red.log, student-panel-summary-red.log, student-panel-privacy-frontend.log, student-panel-privacy-backend.log, student-panel-privacy-build.log and student-panel-dossier-mounted.log. Requirements and architecture updated; no migrations.

## Student research profile placement (2026-10-19, verified)

Moved the Student current research profile out of the filtered request results into its own compact card above Research change requests. Preserved title, profile/new-request actions, pending guidance and portal typography. Requests/History and search remain together below. Five scoped research/navigation/Student workspace checks, TypeScript and production build pass; the existing ExcelJS chunk advisory remains. Isolated headless Chrome checks mounted the actual component with mocked read APIs and verified sibling ordering, view/search independence, action callbacks and desktop/390px content layout. Screenshots visually inspected: system Temp research-profile-layout-desktop.png and research-profile-layout-mobile.png. The normal browser tool failed initialization; no live academic records were changed. Requirements and architecture updated.

## Office Dashboard manual testing guide (2026-10-19)

Prepared `docs/OFFICE_DASHBOARD_MANUAL_TEST_GUIDE.md` from current requirements, architecture, status, Dashboard routing/components and relevant backend services/test scenarios. User-confirmed scope is Dashboard and linked tools: timeline/imports, operational periods/extensions, semesters, Lecturer capacity, both workload monitors, participant lifecycle/delegations, reconciliation, reports and student dossiers. Includes control-level expected results, a capacity/reservation arithmetic exercise, validation/privacy/persistence checks, fixture prerequisites and a result template.

Source observations to verify during UAT are recorded separately: generic Panel navigation from the Dashboard workload row, coupled summary/workload failure handling, absent prior-semester copy control, first-100 capacity-history loading, historical availability cancellation reachability, selected-version Current policy wording and missing dedicated capacity-summary rendering in Workflow Reports. These are source-inspection observations, not reproduced browser acceptance results or fixes. Manual scenarios and regression suites were not executed for this documentation-only task; this task changed no application code or academic data. Requirements and architecture documents were checked and require no policy/design changes for the guide.

## Office replacement recovery fixes (2026-10-19, verified)

The user authorized planning, challenging and then fixing SR-01, SR-02 and SR-03 one by one. Duplicate staff-ID ambiguity now returns a controlled conflict, blocked forms can recheck without losing drafts, and failed/unreadable POSTs reconcile context before permitting another submission. Failed reads retain the draft and offer Retry. Observed the new duplicate-ID regression and mounted stale-context scenarios fail before their fixes. Fresh verification passed all 235 frontend checks, 132 affected backend tests, seven mounted browser scenarios, TypeScript and production build; only the existing ExcelJS chunk-size advisory remains. Normal browser-tool initialization failed, so mounted checks used isolated headless Chrome, real React components and mocked APIs. Disposable database/profile resources were cleaned up, and no live academic records have been changed. The findings document now records the corrections: docs/SUPERVISOR_REPLACEMENT_REVIEW_2026-10-19.md. This completion supersedes the earlier deferred-fix state below.

Local development servers are running with the verified changes: frontend 127.0.0.1:3001 returns HTTP 200; backend 127.0.0.1:8000 serves the protected replacement route with expected unauthenticated HTTP 401. No existing server processes were terminated.

## Office replacement second review (2026-10-19, initial findings before authorized fixes)

Fresh baseline reruns passed all 235 frontend checks and 131 affected backend tests. Independent skeptical reviews reproduced three cases: SR-01 case-only duplicate lecturer IDs cause HTTP 500; SR-02 blocked forms cannot recheck availability without leaving/discarding drafts; SR-03 failed or unreadable submissions retain stale context and misleading retry controls. SR-02/SR-03 share one context-refresh weakness. The user explicitly requested recording all issues before fixing them one by one. Temporary production corrections and newly added checked-in regression expectations from this review were therefore reverted, preserving the earlier Office-only implementation and prominent button. No fixes are currently applied for these findings; temporary correction test runs are not current completion evidence. Detailed reproduction, impact, severity and proposed later fixes: docs/SUPERVISOR_REPLACEMENT_REVIEW_2026-10-19.md. No live academic records were changed; test databases and disposable UI fixture server/tab were cleaned up.

## Change supervisor action emphasis (2026-10-19)

Promoted the Office Change supervisor action to the existing filled primary PortalButton with a UserRoundPen icon. End appointment retains its danger treatment. Permissions and replacement behavior are unchanged. All five scoped checks and TypeScript pass. Live Office inspection confirms navy background, white text and visible icon. Screenshot: C:/Users/User/AppData/Local/Temp/change-supervisor-prominent-20261019.png. No academic mutation submitted.

## Office primary Supervisor replacement (2026-10-19, verified)

Implemented Office initiation from the exact View supervision Appointment record, Student replacement action/form removal, strict Office context/create API, immutable Office attribution and no fabricated Student declaration. Pending requests retain the incumbent and use the existing acceptance/Coordinator handover chain. The approved Office-only policy supersedes older Student replacement descriptions without rewriting historical records. Work remains in the existing dirty checkout; no commits/pushes or live academic requests are made.

Verification: all 235 frontend checks and 131 affected backend tests pass, including 22 new Office security/concurrency cases. New behavior tests were observed failing before their fixes. Backend tests used an isolated UUID PostgreSQL test database and a process-only fixture password-hasher override; the database was destroyed. TypeScript, production build, Django checks and migration-drift checks pass; the existing ExcelJS chunk advisory remains. Evidence: backend/.env.office-replacement-regression.log and system Temp office-replacement-frontend-final.log.

Independent review found and reproduced a legacy-profile casing defect; shared locked resolution now reuses the same owned profile and preserves its active Panel/history at approval. Office-origin requests also reject stale ended predecessors at acceptance/final approval while historical Student replacement behavior and successful-approval retries remain compatible. Regression tests cover both corrections and independent re-review is clean. No schema changes.

Live browser checks confirm no Student Change Supervisor button, the Office action beside End appointment in the exact Appointment record, independent replacement form, explicit candidate/reason, no Student declaration, retained draft after Keep editing, correct Back return and a 390px layout without horizontal overflow. Coordinator exact in-scope supervision has no Change supervisor action; out-of-programme access remains denied. No academic mutation was submitted; the demo Student account and normal viewport were restored. Screenshots in system Temp: office-supervisor-change-student-20261019.png, office-supervisor-change-action-20261019.png, office-supervisor-change-form-20261019.png and office-supervisor-change-mobile-20261019.png. Local backend restarted on 8000 and frontend remains on 3001. Implementation plan: docs/superpowers/plans/2026-10-19-office-supervisor-replacement.md.

## Local development servers restarted (2026-10-19)

Started the stopped project frontend at http://127.0.0.1:3001 and backend at http://127.0.0.1:8000 using the existing local development launcher/configuration. Verified HTTP 200 for the Applications page and healthy API responses both directly and through the frontend proxy. No configuration, requirements, architecture or database changes were needed.

## Shared submission availability (2026-10-19)

Replaced every use of the large Submission period card with one shared badge/date presentation. Removed the legacy card branch and Check period wording. Moved Student availability out of the records list to the New application action, excluding History; Panel recommendation/replacement forms now use Recommendations wording. Preserve blocked-state recovery, personal deadlines, existing eligibility and authoritative server checks. Office and Marks management cards remain configuration interfaces.

Verification: nine availability-state checks pass (eight failed against the previous component before implementation). All 24 affected frontend checks, TypeScript and production build pass; the existing ExcelJS chunk-size advisory remains. The final list-placement and Panel-label assertions also pass. Live desktop checks confirm the pictured Applications list no longer contains the card, History has no availability notice, the Supervisor form uses an Inter badge about 26px high, and the Panel form shows Recommendations open. Both forms at 390px fit without horizontal overflow; viewport override reset and the original demo account restored. No application, nomination, profile or period data was saved. Screenshots are in the system Temp directory: submission-availability-list-20261019.png, submission-availability-form-20261019.png, submission-availability-mobile-20261019.png and submission-availability-panel-mobile-20261019.png. Backend tests were not rerun for this frontend-only presentation change.

## Declaration checkbox alignment (2026-10-19)

Corrected the vertical offset between the declaration checkbox and its first text line using a standard 16px control, 2px offset and 20px line height. Existing five Section A rendering checks pass. Live checks at 1280px and 390px confirm zero vertical centre difference between the checkbox and first text line, including a three-line mobile declaration. Viewport reset. Acceptance wording and submission behavior are unchanged. Screenshot: C:/Users/User/AppData/Local/Temp/supervisor-declaration-aligned-20261019.png.

## Supervisor application clarity (2026-10-19, verified after visual correction)

Implemented individual optional project-code entries, completed-course Yes/No with reversible rows and visible Remove buttons, own phone/address editing, compact availability, concise review/Edit links, one exact declaration checkbox and inline errors. Preserved identity ownership, private uploads, approval rules, submitted snapshots and unrelated working-tree changes. No migrations, commits, pushes or academic submissions/decisions were made.

The user rejected the first compact navigation strip and independent text scale after seeing it. Removed the strip and its component, the requested footer paragraphs and the redundant submission-direction line. Six numbered section headings now guide the single page. Reused shared appointment typography and standard controls/buttons; removed every application-specific CSS font override. This supersedes the initial compact-selector/14px presentation and its screenshots.

Verification: all 221 frontend checks and all 68 affected backend tests passed before the final presentation correction. The latest correction changes frontend presentation only; all 22 affected frontend checks, TypeScript and production build pass. The existing 940 kB ExcelJS chunk advisory remains unchanged. Django system checks and migration-drift checks pass. Review identified blocked-intake refresh and duplicate upload errors; both were corrected, and the final scoped re-review found no further issues.

Live authenticated comparisons confirm exact Inter matches with the existing appointment research profile: headings 16px/600, labels 12px/600, detail values 12px/400. Application inputs exactly match the Settings phone control at 12px/700 and about 42px high; PortalButton retains the standard portal styling. Confirmed six numbered headings, absent navigation/footer, preserved Edit links, duplicate-code feedback, reversible course entries, declaration reset and invalid-phone rejection. Latest 390px viewport has document width 375px and no horizontal overflow; viewport override reset. No application was submitted and no profile data was saved during browser checks. Temporary preview files were removed.

Current screenshots in the system Temp directory: supervisor-form-revised-desktop-20261019.png, supervisor-form-revised-research-20261019.png and supervisor-form-revised-mobile-20261019.png. Earlier screenshots with the rejected strip/large type are superseded.

## Appointment workspace correction implementation (2026-10-18, verified)

Implemented incoming Panel queue/review-history membership, explicit decision/date display, shared Requests/History and lifecycle controls, visible filters, three lecturer landing cards, visible outgoing recommendations and relevant guidance. Preserved roster/current-vs-proposed identity, nomination guards and role-specific tab names. Corrected explicit incoming History precedence, incompatible Supervisor status transitions and Student source-aware request return without backend or Section A changes.

Observed regression failures before repairs. Final verification passed all 219 frontend checks across 168 file entries, npm run lint (TypeScript), and npm run build; the existing 940 kB ExcelJS chunk advisory remains. Independent review found two presentation gaps (explicit incoming decision facts and Requests-only card visibility); both were corrected and re-review passed with no additional confirmed defects. Final whitespace checks pass. Requirements, architecture, status, approved spec and completed plan were updated. No backend/schema/permission changes, academic decisions, commits or pushes performed.

### Live role and record evidence

- Lecturer Supervisor: Requests/History and five-supervisee roster load. A History Approved filter cleared when switching to Requests; ongoing/final grouping remains intact.
- Lecturer Panel (Demo Panel Lecturer): workload is 4/10 (3 active + 1 reserved), needs review 0, awaiting Coordinator 1. Incoming History contains seven records, including the accepted Test Student nomination still awaiting Coordinator. The decision/date is separate from workflow stage; cancelled-before-review says No decision recorded. Opening the accepted record is read-only and Back retains History. Cards disappear in History and return in Requests.
- Lecturer Panel (Demo Lecturer Supervisor): the five-student roster retains appointed member identities and pending-nomination guards. Submitted recommendations is visibly rendered below it, with the outgoing awaiting-Coordinator record still in Requests. Original account restored afterward.
- Coordinator: both modules retain scoped navigation and visible request controls; the pending Panel nomination remains ongoing with a review action. Confirmed Panel appointments show the actual Panel holder and start date.
- Office: both modules retain monitoring/navigation; Panel requests have View request, not academic review actions. Confirmed Panel rows retain member identity and lifecycle controls; export remains available.
- Student: both modules load. My supervisors -> exact request -> Back returns to overview. Applications History with q=Demo -> exact request -> Back retains the filtered Applications URL and search. Confirmed My panel remains a separate Student overview.
- A temporary 390px iframe inspected the actual authenticated Panel application: cards stack, History rows render readable mobile record cards, and Enter activates History. The inspection page and its temporary tab were removed. No academic records were changed.

Recorded screenshots: `C:/Users/User/AppData/Local/Temp/panel-landing-corrected-20261018.png`, `panel-accepted-history-corrected-20261018.png`, `panel-recommendations-corrected-20261018.png`, `panel-history-narrow-corrected-20261018.png` (all in that Temp directory). Ended-appointment outcomes, unavailable/unconfigured capacity and Office cancellation after an earlier acceptance are covered by renderer/domain fixtures where a matching live record was not used. No backend code changed, so no new backend database run was needed. Existing development servers remain on ports 3001/8000; the original lecturer session is left on Appointment requests.

## Earlier read-only inspection and correction proposal (2026-10-18, superseded by implementation above)

Completed read-only code/data-contract audits of Supervisor and Panel across Student, Lecturer, Programme Coordinator and Office, including two independent scoped audits. Confirmed incoming accepted Panel nominations awaiting Coordinator are returned by the review-history API but excluded from frontend History by whole-workflow partitioning. Reproduced requests=1/history=0 for a recorded acceptance; the same ongoing classification is appropriate for outgoing tracking, so a global pending-status change would be wrong. Reproduced an explicit History view losing to remembered Requests state. Confirmed the lecturer-only shared-layout fork, default-closed outgoing recommendations, missing landing summary row, incompatible Supervisor status retention, and Student overview request return-target mismatch.

Seven existing frontend checks across six test files passed during the audit despite the reproduced defects, demonstrating missing regression coverage rather than correctness. Backend contracts were inspected without database test execution. No implementation code, academic records, authentication, server configuration, or workflow state changed during this audit. Created the proposed correction spec and seven-task implementation plan under `docs/superpowers/` dated 2026-10-18. At the time of that audit all implementation boxes remained open; the user subsequently approved implementation. Earlier implemented roster/flat-filter notes below describe the current baseline, not a claim that this new correction is complete.

## Earlier navigation language clarification (2026-10-18, presentation superseded above)

User clarified that consistency means language style and clarity across roles and both appointment modules, rather than identical labels for different responsibilities. Restored the established lecturer Panel tab names Appointment requests / My supervisees / My Panel students and aligned the request/assignment headings and assignment return label. The clearer role descriptions, searchable roster, actual Panel identities, explicit student details and Show filters remain. Existing Supervisor, Office, Coordinator and Student names already follow the concise role-appropriate style and were checked without a blanket rename. Requirements and coding-design language policy updated. Nine targeted checks covering navigation, filters, record details and the Supervisor workspace pass, TypeScript passes, and the restored tab names were verified in the running portal.

## Earlier Lecturer Panel structure (2026-10-18, presentation superseded above)

Implemented the authorized redesign following three further critiques: one lecturer navigation row, Show filters instead of nested request/appointment switches, and a searchable/paginated supervisee roster displaying the actual appointed Panel name and staff ID. Explicit student details separate the current member from a pending proposed member/replacement, retain permission-aware nomination actions and scope request records to that student. All submitted recommendations, including former supervisees, remain accessible through a collapsed disclosure. Assignment history now displays recorded ending dates/outcomes and explains active versus ended responsibility independently of semester boundaries. No API/schema/data changes, commit or push.

Verification: all 213 frontend checks across 166 test file entries pass; TypeScript and production build pass (existing ExcelJS large-chunk advisory remains). New regressions were observed failing before implementation. Independent review caught a collision with App's nomination `student` query; details now use `panelStudent`, with regression coverage and no remaining actionable reviewer findings. Existing card/lifecycle tests now render the new detail component instead of asserting obsolete labels or exports.

Live checks on port 3001 confirmed the five-student roster, actual appointed Panel identities, matric search, nomination-status filtering, explicit detail selection without auto-opening a nomination, replacement opening only after its action, return/search retention, a pending nomination with no additional nomination action, and the assignment-history Show filter/explanation. The demo supervisor has no own Panel assignments, so populated ended-assignment dates/outcomes are verified by regression fixtures. Replacement submission was not performed; the selected student's eligible replacement list is empty in current demo data. All three mandatory project documents were checked and updated. The server remains running and the browser is left on the unfiltered supervisee roster.

## Server startup and independent Section A reinspection (2026-10-18)

Started the Django development backend on `http://127.0.0.1:8000` and this project's Vite frontend on `http://127.0.0.1:3001`. Port 3000 belongs to another Docker-served app titled Sapu; it was preserved. Both intended listeners and the frontend-to-backend proxy were verified (anonymous protected API requests correctly return 401). Django system checks and applied appointments migration 0017 are confirmed. The background launcher was rejected by automatic review; the backend was instead started successfully in a managed terminal session.

Fresh verification: all 96 affected backend tests pass on isolated `test_section_a_review_20261018`; all 15 targeted Section A/frontend detail checks and TypeScript pass. A separate read-only reviewer found no actionable defect in the scoped implementation, while correctly noting that static tests alone do not cover every mounted-effect race or navigation path. Live portal inspection confirmed Office historical request details show the explicit missing-Section-A explanation and visible Not recorded course codes.

Live Student inspection used the existing demo sign-in control and the Change Supervisor route: all six sections load through the real backend; particulars use the saved name/ID/programme/session/email and honestly show missing identity/contact/address; title origin and declaration begin unselected; the configured proposal remains Required; selecting no completed courses disables Add course; changing research title clears accepted declaration. The unsaved inspection draft was discarded through the normal navigation guard, returning to the unchanged Applications list. No application, upload, academic decision or capacity change was executed. All listed demo Supervisor candidates are full or not configured, so no live end-to-end submission is claimed; creation/approval/security remain verified using isolated test data. The capacity restriction was preserved. No code defect was found or code change needed during this reinspection; only this status entry was updated.

## Digital Supervisor Section A (2026-10-17, implemented and verified)

User authorized the expanded Section A after the form audit, five critiques and final critique. The new design and plan explicitly supersede the narrow historical course-code-only scope. Current work covers system-sourced particulars, server-owned submission record, course declarations, title-origin/proposal handling and review/declaration across the Student form and authorized exact reviewer details. Earlier portal/operational-period uncommitted changes are preserved in place on `codex/portal-consistency-and-toast`.

Implemented the additive version-1 Section A submission contract, Student-only prefill, authorized exact Section A endpoint, server-owned snapshot, conditional proposal handling, six-section Student form and shared reviewer display. Sensitive endpoints are non-cacheable and standard list DTOs remain unchanged. Existing records have explicit legacy wording. Confirmations reset after draft edits; failed submissions retain data. Course-code blanks are again visible as Not recorded.

Verification: tests first reproduced missing fields/endpoints, missing blank-code fallback, malformed multipart acceptance and private-cache behavior before fixes. All 96 affected backend tests pass on isolated `test_section_a_integration_20261017` (Section A, course codes, Supervisor workflow/documents/submission concurrency, lifecycle and research amendments). All 207 frontend checks pass across 164 test-file entries; TypeScript, production build, Django system check and migration dry-run pass. Existing large ExcelJS bundle warning remains. One broad legacy-history frontend assertion was narrowed to approval content because the required course-code fallback legitimately adds Not recorded outside approval history; the original no-fabricated-history guarantee remains tested.

Synthetic browser verification used an isolated intercepting harness, never live academic mutations: particulars/missing phone, explicit title origin, course rows/none, optional-to-required proposal state, full multipart Section A, failed-submit draft retention and confirmation reset after editing. The clean form has six sections and no page overflow at 390px (375px document width with scrollbar). This is not a claim of submitting real Student data or exercising every role in a live browser; exact permissions across roles/programmes are covered by API tests and the shared display by rendered tests. Helper usage limits prevented a separate final reviewer; the primary agent completed source/integration review. Temporary verification harness was removed after QA.

Applied only additive appointments migration 0017 locally. Application count remained 7 before/after, and all 7 historical applications retain null Section A. Existing application/approval data is preserved. No academic decisions, commits or pushes were performed. Design and completed acceptance checklist: `docs/superpowers/specs/2026-10-17-supervisor-section-a-design.md` and `docs/superpowers/plans/2026-10-17-supervisor-section-a.md`.

## Local server restart (2026-10-17)

Started the guarded Django development launcher on 127.0.0.1:8000 and Vite on 127.0.0.1:3001 in hidden windows after confirming neither port had a running listener. Direct API health, portal and proxied API health all return HTTP 200. Requirements and architecture remain unchanged; no application code, schema or academic records changed.

## Connected periods implementation and local rollout (2026-10-16)

Implemented the approved connected-period plan: Office Timeline Management now hosts appointment period setup/enforcement, normal and selected-case/task extensions, explicit calendar links and history; existing Marks services/windows remain authoritative. Supervisor/Panel intake has atomic period checks, and role-specific forms show authorised availability while preserving drafts. Reviews remain available after intake ends. Closed-semester Marks recovery remains reachable through the central hub; calendar and appointment writes stay locked. Template dates follow the selected semester. Programme choices include approved empty cohorts and legacy names. Actual timeline expiry now says Ended.

Uploads now preview without committing, require explicit warning acknowledgement and signed confirmation, protect existing links and reject stale file/actor/semester/period data. Linked dates/status feed calendars, dashboard and reports. Informational extensions retain reason and original/new dates. Added opening/closing/extension reminders, effective personal deadlines, deduplicated delivery and durable optional email retries. Current recipient eligibility is rechecked before sending; retained staff-only notices are excluded from Student notification APIs/digests.

Verification to date: 193 frontend checks pass; final full frontend rerun, TypeScript and production build pass (existing lazy ExcelJS chunk-size warning remains). The broad backend run executed 604 checks: 602 passed and two historical Marks migration tests errored because their graph state contradicted the actual rolled-back schema after the new FK dependency. Their historical state construction was corrected without weakening preservation assertions; all seven affected migration/invariant tests pass. Separate period, import, Marks configuration, real PostgreSQL lock and reminder/privacy suites pass; the latest combined notification/projection/extension run passed 94 checks. Final operational-period/cross-programme verification passes 34 checks, including programme identity normalization and duplicate/overlap guards. Django system checks, migration drift and whitespace checks pass. No browser checks or live academic submissions performed.

Backed up the local DB to C:/Users/User/AppData/Local/Temp/fkstm-before-connected-periods-20261016-221446.dump before successfully applying academics0004, announcements0006, dashboard0006 and dashboard0007. API restarted again after the final programme normalization fix; health and portal return HTTP200 and anonymous protected-period access returns401. Read-only Office API smoke returns200 with zero configured appointment periods, both enforcement flags false and unchanged live notification count. Installed FSKTM deadline reminders every15minutes in PREVIEW mode; the real runner's dry run reports24 calendar/0 appointment/0 Marks pending notices and sends none. Live delivery remains unactivated, and SMTP delivery is not certified. Work remains local, uncommitted and unpushed.

## Historical connected-period investigation (2026-10-16, superseded above)

Prepared docs/SEMESTER_PERIODS_IMPROVEMENT_PROPOSAL_2026-10-16.md at the user's request, including five design challenges, preservation of Marks extensions/completion windows, phased delivery, privacy, upload validation, reminders and migration/acceptance criteria. Status: proposed, awaiting design discussion; no application changes or enforcement activation. Investigation verified that the supplied past-dated template passes the current archive/row parser with both entries labelled Completed, and that Supervisor/Panel intake uses the effective semester without entry-specific date guards. Existing reminder commands cover timeline/ordinary Marks closing deadlines; no matching Windows scheduled task was found locally. Production scheduling/mail delivery was not tested. No notifications, live academic writes, commit or push.

## Verified cross-programme Supervisor and Panel appointments (2026-10-16)

Verified that Supervisor and Panel candidate APIs/serializers and both frontend candidate pickers impose no lecturer programme match; lecturer department/specialisation is descriptive. Added an end-to-end API regression where AI and Cyber Security students both obtain the same Supervisor and the Supervisor recommends the same Panel lecturer for both, completing acceptance and each student's own coordinator approval. Unrelated coordinators are rejected with HTTP 403 for both workflows.

All 18 selected backend checks pass, covering the new end-to-end scenario, Panel programme access guards, candidate capacity/availability, full candidate handling and final capacity rechecks. The dedicated scenario was rerun after fixture cleanup and passes. Django system checks and whitespace validation pass. Every run used a newly named isolated test database and temporary upload storage, both cleaned up; no live academic records were changed. No application rule changes or browser checks. The new regression and documentation remain local and uncommitted.

## Consistent Needs attention row destinations (2026-10-16)

After the final requested critique, implemented one View details action for every Office Without supervisor/Without Panel row. Both open a shared student appointment overview, with current appointment status, saved research, student-record navigation and a separate View request action only for an actual ongoing request. Waiting and workload tables keep their direct category-specific actions. Supervisor uses the existing authorised student team endpoint; Panel uses the existing stable profile-N endpoint. No API, permission, schema or academic mutation changes.

Regression checks reproduced the prior mixed row actions and now verify one action per row, stable Panel profile destinations, matching-student/exact-request selection, saved versus submitted research, missing/closed requests and newly active appointments. The complete frontend suite passed 184 checks. After adding Panel stale-response/loaded-identity protection, nine affected checks were rerun and pass, along with fresh TypeScript --noEmit, production build and whitespace checks. Nested request return targets and filters remain preserved. No browser check performed; no backend tests rerun because backend code is unchanged. Work remains local and uncommitted.

## Aligned appointment Action headings and buttons (2026-10-16)

Corrected the Coordinator Panel Review request offset: its heading used left alignment while its nested button group used justify-end. Shared CoordinatorDataTable Action cells now align nested groups with their left-aligned heading, and WorkspaceRecordTable uses the same alignment for Supervisor/request tables across roles. Five affected frontend checks, TypeScript --noEmit, production build and whitespace checks pass. Confirmed the production CSS includes the scoped justify-start rule. No browser check performed; no action, permission or API changes. Work remains local and uncommitted.

## Removed Office Administrative details card (2026-10-16)

Removed the extra Supervisor Office Administrative details disclosure containing student email, workload and ancillary Panel facts. Appointment record, ending controls and lifecycle history remain intact. Verified the Panel Office path already has no equivalent Administrative details card, so its UI required no change. Added populated-facts regression coverage and a Panel lifecycle guard; all four affected frontend checks, TypeScript --noEmit and whitespace checks pass. No browser check, API/data change, commit or push.

## Matched Office Supervisor and Panel Tools menus (2026-10-16)

Replaced Panel's remaining native details/plain-button Tools dropdown with the same shared renderer used by Supervisor. Both menus now share the trigger, icons, grouped rows, descriptions, typography, spacing, width and dismissal behaviour. Panel retains workload navigation and its optional capacity action; Supervisor retains research records, workload and document requirements. Tests cover the closed controlled disclosure, preserved action labels, unavailable capacity groups, viewport alignment and no eager data fetching. All 179 frontend checks, TypeScript --noEmit, production build and whitespace checks pass. No browser check performed. Changes remain local and uncommitted.

## Unified Supervisor and Panel Excel exports (2026-10-16)

Converted all CSV report paths in Supervisor and Panel appointments to genuine .xlsx workbooks, including Needs attention, request/history browsing, Panel appointments, both workload tools and legacy Supervisor reports. All use filled primary Export Excel buttons; existing server-generated supervision workbooks retain their multiple sheets. Filter scope, all-page collection, column values and permissions are preserved. Async generation exposes busy/failure feedback and prevents duplicate client downloads.

Verification: the existing paged export regression first failed when reopening renamed CSV as XLSX, then passed with real serialization. All 179 frontend checks pass, including full-page/empty/incomplete-envelope exports, typed literal cells, leading zeros, Unicode/paragraphs, worksheet/cell limits and failed-download cleanup. TypeScript --noEmit, production build, npm audit --audit-level=low (zero vulnerabilities) and whitespace checks pass. Independent openpyxl readback and the browser library writer executed under Node also pass. Vite reports a size warning for the separate lazy ExcelJS chunk (~940 KB minified / 271 KB gzip); it is requested only when exporting. No browser visual check or live academic mutation; no backend tests needed for this frontend-only change. Project docs updated; work remains local and uncommitted.

## Filled appointment export buttons (2026-10-16)

Applied the existing PortalButton primary blue/navy background and white text to all Supervisor/Panel CSV and Excel export controls, including Office attention and shared Office/Coordinator browse screens. File formats remain as before: supervision workbooks are multi-sheet Excel, other browse exports are CSV. TypeScript --noEmit, production build and whitespace checks pass; all five renderer call sites verified. No new tests or browser checks for this colour-only refinement. Changes remain local and uncommitted.

## Appointment export control consistency (2026-10-16)

Moved existing Office/Coordinator Supervisor and Panel list exports out of section headings into a shared filter footer opposite Clear filters, including Needs attention and current/past views. Requests/History navigation now stands alone. Replaced long export labels with Export CSV/Export Excel and download icons; removed the permanent Excel all-pages caption while retaining hover and accessible scope descriptions. Existing permissions, all-matching-page data, file formats and download feedback remain unchanged. Static rendering checks verify export separation for both staff roles and Panel browsing; all 176 frontend checks, TypeScript --noEmit, production build and whitespace validation pass. No browser check performed. Changes remain local and uncommitted.

## Research abstract readability refinement (2026-10-16)

Replaced narrow 12px abstracts with a shared full-width 14px reading area and 28px line spacing across Supervisor/Panel request details, supervisee research disclosures, Student appointment overviews, Panel nomination and research profile/revision comparisons. Supervisee research facts now use responsive columns above the full-width abstract. Complete text, paragraph breaks, long-term wrapping, saved source distinctions and existing authorisation remain intact. Regression coverage first failed for the missing shared area, then passed; all 176 frontend checks, TypeScript --noEmit, Vite production build and whitespace checks pass. No browser check performed at the user's earlier request, so real visual acceptance remains unverified. Documentation updated; work remains local and uncommitted.

## Shared appointment request presentation (2026-10-16)

Planned and critiqued three times at the user's request, then implemented the approved Separate research card layout through shared summary/research renderers for Supervisor and Panel request details. Staff Supervisor student navigation now sits at the summary top right; Panel secondary contacts are collapsed. Research source labels, full regular-weight abstracts, downloads, request-specific reasons, audit and lifecycle context are retained. Shared vocabulary uses Approved, reviewer-specific waiting/rejection/cancellation labels and evidence-aware timeline actions without Selected Panel wording. Existing API/permission identifiers remain unchanged. Regression tests first reproduced the old label/layout differences; focused checks and all 175 frontend checks now pass, along with TypeScript --noEmit, Vite production build and whitespace checks. Plan: docs/superpowers/plans/2026-10-16-appointment-request-presentation.md. No backend tests rerun for this frontend-only change. Real desktop/mobile appearance and pointer behaviour remain visually unverified because the user requested no browser checks. Work remains local and uncommitted; no live academic mutation, commit or push.

## Removed remaining Panel attention student action (2026-10-16)

Removed View student record from Office Needs attention student rows, correcting the earlier exception left in this separate table. Rows now have one View request or View Panel record action; authorised student navigation remains inside those details. Removed the unused attention callback from its component and host. Verified rendered rows with/without a nomination have exactly one action each, four affected Panel/navigation checks pass, TypeScript --noEmit and whitespace checks pass, and Vite serves the updated component with HTTP 200. No browser check, API change, commit or push.

## Local development servers started (2026-10-16)

Started the stopped Django API with the repository virtual environment and guarded local launcher on 127.0.0.1:8000, and Vite on 127.0.0.1:3001, both in hidden windows. Verified the portal returns HTTP 200 and direct/proxied /api/auth/me/ returns the expected anonymous HTTP 401. Requirements and architecture checked: no change needed. No application/configuration/schema changes.

## Shared dropdown menus (2026-10-16)

Migrated 86 native single-choice dropdowns across 34 component files to PortalSelect, reusing the existing SelectMenu for consistent open menus across all modules/roles. Removed duplicate arrow decorations and improved shared option styling, dialog placement, viewport fitting, reduced-motion handling and local list scrolling. Native form/change/validation semantics remain behind the visible combobox; errors focus the control and show an associated message. Updated FormSelect label/error associations and report-control coverage to inspect visible comboboxes. Verification: all 172 frontend checks, TypeScript --noEmit, Vite production build and whitespace checks pass. Automated coverage includes numeric/implicit/fragment values, form constraints, disabled/empty fields, correct wrapping-label control order and a source-wide native-dropdown migration guard. No browser check performed, so pointer/keyboard interaction across real role sessions remains visually unverified. No API/backend/dependency change; changes remain local/uncommitted.

## Appointment table presentation correction (2026-10-15)

Removed the redundant View student record action from Panel request/history/appointment rows, leaving one View request, Review request or View appointment button. Moved the existing host navigation into Panel review, submitted-recommendation and assignment details; Office details already expose it. Office attention student actions remain useful for students without a request. Added shared workflow status badges to Supervisor request/history tables across staff and Student roles, Office attention stages, past-appointment outcomes and carryover stages. Navigation/capability regressions updated. Verification: all 168 frontend checks pass; the four affected navigation/review/lifecycle scripts pass again after disabling detail navigation during saves. TypeScript --noEmit, Vite production build, whitespace and touched-file encoding checks pass. Backend tests were not rerun for this frontend-only presentation change. No backend change, live academic mutation, browser check, commit or push.

## Local development servers started (2026-10-15)

At the user's request, started the API with the repository .venv Python and the existing guarded local launcher, and Vite with the bundled Node runtime, both in hidden windows. Verified portal localhost:3001 returns HTTP 200 and direct/proxied /api/auth/me/ returns the expected anonymous HTTP 401. Requirements and architecture remain unchanged; no code, dependency, schema or academic-data changes.

## Panel consistency implementation (2026-10-15)

Implemented the approved design on codex/portal-consistency-and-toast. Office opens Needs attention with current eligible students without a Panel, waiting recommendations and capacity concerns. Office, Lecturer and Coordinator share Panel navigation, request/history and appointment browsing, factual record sections, approval progress, collapsed audit, lifecycle presentation and existing decision dialogs. Workload/form styling follows the same hierarchy. Existing programme/delegation/participant permissions, capacity validation, replacement continuity and Student pending-member privacy are retained.

Added Office-only paged attention reads and exact authorised record/assignment reads. Stable recommendation links survive approval. Review found and fixed query merging, legacy Coordinator review capability, replacement predecessor labels and appointment-date sorting, with regressions. The backend attention review and final scoped review reported no remaining findings. No schema/dependency change or live academic decision.

Final validation: all 168 frontend test checks pass, including production demo/CSP artifact guards. TypeScript --noEmit and the Vite production build pass. Django check, migration dry-run, applied-migration check, tracked/new-file whitespace and touched-file encoding checks pass. The full Appointments/Dashboard backend suite ran 417 tests: 416 pass and one known baseline failure remains in test_capacity_reassessment_migration, whose whole-row comparison spans the later project_course_codes schema addition. The test is unchanged. The focused Panel staff/workspace/programme suite passes all 33 tests. No new Panel regression failed.

Browser coverage: Office attention and exact pending recommendation were inspected locally. The user requested no further browser checks; cross-role desktop/mobile browser acceptance and new decision previews were not completed or claimed. Shared rendering, navigation, capability, privacy and outcome contracts have automated coverage. Temporary viewport override was reset. API restarted at 127.0.0.1:8000; portal remains localhost:3001. Implementation stays local and uncommitted; the earlier requested snapshot was already pushed separately.

## Portal Maintenance in Django Admin, and a To-Do Badge for Students (2026-11-01)

Plan: `docs/superpowers/plans/2026-10-30-portal-maintenance.md`. First built on 2026-10-30 with the switch in the office's Settings; redesigned on 2026-11-01 at Xiang's request, after research into Moodle, GitLab, Laravel, django-maintenance-mode and the UK government's Data Workspace.

- **The Technical Administrator switches it in Django admin** (Portal maintenance: Off, On now, or Planned with a start time; an expected end; a message). Maintenance history lists every change and who made it. Office staff have no switch.
- **While it is on, nobody can use the portal, office staff included.** Every address shows only the maintenance page with the message, the expected end and the office's email and phone; there is no sign-in form. It checks every minute and opens the portal again when maintenance ends. People who were signed in stay signed in. Django admin keeps working.
- **Before a planned start,** signed-in people and the sign-in page see a warning banner with the time window.
- **Scheduled commands** (`release_announcements`, `send_deadline_reminders`, `send_weekly_summary`) skip their runs while it is on; `python manage.py maintenance status|on|off` switches it from the command line.
- **How it works:** the `maintenance` app (`maintenance.0001`); a check before every signed-in `/api/` request answers `503` with code `portal_maintenance`, so it covers every module without changes to them. Session renewal, sign-out and reading one's own account stay open; sign-in and password links refuse everyone. The portal waits for the maintenance check before showing sign-in. The state is cached, so normal requests cost no extra query. A web server page for upgrades that stop Django is not built (needs Wey Cheng's `deploy/nginx`).
- **To-do badge (option B from the sample page):** a red number on File Submission in the student sidebar while required documents are not handed in or a file was returned, the same number as the To do tab, in place of the "you are here" dot; the menu button gets a red dot while the sidebar is hidden. It refreshes on every page change, after an upload or delete, and when the tab comes back into view. This touches Wey Cheng's `Sidebar.tsx` (one optional `badges` prop).
- **Checks:** 19 maintenance tests (nobody can use or sign in to the portal while it is on, office included; kept sign-ins; planned start; the Django admin page switches it on, plans, ends and cancels it and checks the times; only the technical administrator can open it; view-only history; password links; lost cache; no extra query; scheduled commands; command line), a to-do count test, and the full backend suite (1920 tests) pass. Frontend: 237 of 237 test files, the type check and the build pass. In a browser on a private copy of the database: the student's red number matched the To do tab, the phone menu button carried it, and handing in a document lowered it at once; the technical administrator planned maintenance in Django admin (banner for the student, notice on sign-in), switched it on (the student, the office and visitors at /login, /forgot-password, /activate-account and /files saw only the maintenance page, the sign-in API answered 503, Django admin kept working, no sideways scroll at 390 px) and off (the student was back without signing in about a minute later); the history listed each change. The copy was removed afterwards.
- **Required documents card (option A from the sample page):** it said "0 of 13 handed in" while one upload was waiting for a check, because only accepted files counted. Now a bar (green done, amber to check) with "1/13 handed in", where an upload waiting for a check counts as handed in, and three chips, Done, To check and Missing (a returned file counts as missing). Clicking a chip lists those students, in place of "Show names" and its filter buttons; a name only carries a label when its file was returned. No backend change. Checked in a browser on a private copy as the office and a coordinator: the counts add up on every card, each chip lists the right students, a chip with 0 is greyed out, no sideways scroll at 390 px.
- **Top bar:** the question mark button is removed at Xiang's request; it opened a contacts pop-up with placeholder details. The footer's Support Desk link still opens that pop-up. Frontend: 237 of 237 test files, the type check and the build pass.

## Sign-in: Each Browser Tab Keeps Its Own Account (2026-10-29)

Asked by Xiang while testing: a second tab signed in as another account took over the first tab. Both tabs shared one refresh cookie, so when tab 2 signed in, tab 1 renewed as tab 2's account on its next reload or after about 15 minutes, while its screen still showed the first account.

- **Each tab has its own sign-in.** The portal gives each tab a name (kept across reloads, not copied when a tab is duplicated) and sends it with every request; the tab's refresh cookie carries the name. Two tabs can now be signed in as two accounts, and each keeps its account through reloads and token renewals.
- **New tabs and Remember me work as before.** A sign-in also updates the browser's shared cookie, and a new tab opens with the latest sign-in. Remember me keeps the shared cookie; a tab's own cookie goes when the browser closes.
- **A tab never switches account by itself.** A signed-in tab only renews its own sign-in, and the portal ends a session if a renewal ever comes back as another account.
- **Signing out** signs that tab out and stops new tabs opening with that account; the account's sign-in in closed tabs is ended too. Other open tabs keep their own sign-in. A password change signs the account out everywhere, as before, without touching another account's tabs.
- **Checks:** 11 new backend tests (two tabs two accounts, new tab, no account switch, Remember me, sign-out keeps open tabs and ends closed ones, other accounts untouched, old tab cookies dropped, password change, requests without a tab name unchanged) and the accounts suite (466 tests) pass; new frontend tests for the tab name, the roll call of open tabs, the tab header and the account check; in a browser, student in tab 1 and office in tab 2 each kept their account through reloads and page changes, a new tab opened as office, and signing out of tab 1 left tab 2 signed in.

## Appointment Letters: Placeholder Wording and an All-Malay Malay Page (2026-10-29)

Asked by Xiang: a placeholder appointment confirmation letter built from what we have, until the PG office sends the real template, and the Malay page without English lines.

- **Checked first.** After the PR #23/#24 merge the three appointment letters still work end to end (letters 151 and appointments 447 tests pass; supervisor, panel and supporting supervisor approvals, reissue, ended appointments, template switched off and the office's Create letters, run on a private copy of the database and in the browser for each role).
- **Placeholder wording** (`letters.0014`). Modelled on the two real letters we have, the Maya Student Confirmation Letter (English and Malay) and the PG office's visa letter: addressed to the lecturer appointed, "Dear ..." / "Tuan/Puan,", a bold title, a details table, a line on the lecturer's role, "please contact the Postgraduate Office", "Thank you." / "Sekian, terima kasih.", signed by the Dean of the faculty (Dekan on the Malay page). Only samples still holding the first wording change; rolling back restores it.
- **Malay page in Malay.** Letter types have their own Malay signature lines (`signatoryNameMs`, `signatoryTitleMs`), edited under "Signature and status" when the letter has a Malay page; a blank one uses the English line, then a Malay default. The letterhead on the Malay page is in Malay too (Fakulti Sains Komputer & Teknologi Maklumat, Pejabat Hal Ehwal Akademik, Aras 4). The same applies on screen, in print and in the PDF. The Student Confirmation Letter now signs its Malay page "Dekan / Pengarah", as Maya does.
- **Checks:** letters 158, documents and announcements tests pass; frontend type check, 232 of 232 test files and the build pass; the migration rolled back and forward on a private copy; the three letters approved on that copy, read on screen as the student, supervisor and panel member at 1440 and 390 px (no scrollbars inside the page) and in the PDF; the office's editor shows the four signature boxes. The copy was removed afterwards.
- **Still to do when the real template arrives:** replace the wording in Letter Generation (Letter types), and the signature lines and letterhead if they differ.

## FAQ Chatbot: Office Screens Restructured (2026-10-29)

Plan: `docs/superpowers/plans/2026-10-29-faq-office-redesign.md`, approved by Xiang after the proposal page "FAQ Chatbot Office Redesign" (Intercom Fin, Zendesk AI agents and Tidio Lyro, with wireframes). Commits `e4c5449` (backend) and `e92a942`. The student chatbot is unchanged.

- **Landing.** Summary cards (live answers, to check, student questions waiting, answered this month with the helpful rate) and icon tabs, like Letter Generation and File Management. The header has "Test the chatbot" and "Add answer".
- **Answers** (was Entries). Opens on the live answers; To check (the 61 imported entries), Drafts and Archived are separate views. An "Asked this month" column (with how many said it didn't help), the filter card, and rows as cards on phones.
- **Answer page** (laid out again after Xiang's review, like help-centre article editors). One card holds the question, the answer and the other ways students ask it; the answer has Bold, Bullet points and Link buttons instead of formatting codes, grows with the text, and switches between Write and Preview as student. A side panel holds the status, this month's use, the topic, the optional portal button and the Publish / Save buttons, with the history below.
- **Student questions.** "Write an answer", "Add to an existing answer" and "Dismiss"; the figures moved to the summary cards.
- **Settings.** Common questions are picked from live answers, and one whose answer stops being live is no longer shown to students. The contact text is shown as students see it.
- **Test the chatbot** (replaces "Try it"). Its own page rather than a side panel, so nothing scrolls inside the page. The student chat, with a note under each reply naming the answer it came from (and the closest others), links to open them, and "Write an answer" when nothing matched. Nothing is saved or counted.
- **Reuse.** The student chat's pieces moved to `FaqChatParts` and serve the student page, the preview and the test page; File Management's summary card became `SummaryCardButton` for both modules.
- **Checks:** backend 93 FAQ tests pass; frontend type check, 232 of 232 test files and the build pass. In the browser as the office at 1440 and 390 px: every tab, the To check view, editing with the formatting buttons (bullet points and a link, not saved), Settings and the test page answering one question and not another; no scrollbars inside the page, nothing past the screen edge, no page errors.

## Appointment Confirmation Letters: Samples, Supporting Supervisors, Ended Appointments (2026-10-26)

Plan: `docs/superpowers/plans/2026-10-26-appointment-confirmation-letters.md`, approved by Xiang. Commits `f5b3c8a` (sample templates) and `b5ac50e` (the rest). Builds on UC22: nothing in `appointments/` changed.

- **Sample templates.** Supervisor, panel and supporting supervisor confirmation letters, each with an English and a Malay page, are added as Active when the office has no template for that kind (`letters.0010`, `letters.0012`), so a coordinator's approval issues the letter straight away. They use only details the system always has. Their description says "Sample wording set up by the system"; the office replaces the wording when the faculty's own letter is ready. Appointment, approval and acceptance dates print in Malay on the Malay page.
- **Supporting supervisors.** A third appointment letter (`CO_SUPERVISOR_APPOINTMENT`) goes to the student and the supporting supervisor, with the main supervisor in copy, each with a notice. New details for the wording: Supporting Supervisor, their department and the date they accepted. The office's "appointments without a letter" banner and Make letters cover it too.
- **Ended or replaced appointments.** The letter is revoked with the reason (for example "The supporting supervisor appointment ended on 26 October 2026.") and everyone on it is told; it stays in history. A letter still waiting for the office is withdrawn instead.
- **Lecturers.** File Management has an "Appointment letters" tab listing every confirmation letter sent to them, with search, a status filter, Open and Download. The letter page in Files now shows the Malay page and goes back to where it was opened from.
- **Fixed along the way:** the Malay footer of appointment letters said the student asked for the letter (screen, print and PDF); the menus in the letter editor and in Files (Add question, Insert detail, More actions, the student picker) opened a second scrollbar near the bottom of a page, and now float over the page like `SelectMenu` (`b71e7fc`).
- **Checks:**
  - Backend: 1832 tests; the letters, documents and every migration test pass after pointing `letters.0011` at the appointments migration that creates supporting supervisors (it first pointed at the latest one, which broke two appointments migration tests).
  - Frontend: type check, 217 of 217 test files, and the production build pass.
  - Browser, on a private copy of the database with email off: the coordinator approved two supervisors, a panel member and a supporting supervisor for TG-STU-01 and TG-STU-02 on the real approval screens (the requests before that step were made through the same API the screens use). Each letter was issued at once with both pages filled and the right people told. Ending the supporting appointment revoked its letter and told all three people. Also checked: the lecturer's tab at 1440 and 390 px (search, status filter, Open, Download PDF, back), the revoked notice on the letter page, the office's letter types and issued letters, and the student's letters. The private copy and servers were removed afterwards.

## File Submission Redesign: Automatic Tags And New File Screens (2026-10-26)

Plan: `docs/superpowers/plans/2026-10-26-file-submission-redesign.md`, approved by Xiang after the proposal page "File Submission Redesign" (research and wireframes). Screens follow Wey Cheng's workspace design, as Letter Generation does.

- **Nobody types tags.** Each file's tags are worked out from its record when it is shown: Category (the type's group), Required, Semester, From (student, lecturer, coordinator or PG office), and each student's Programme and Intake (a staff file's chosen programmes). They follow a student who changes programme. Every tag is a list filter (`group`, `required`, `semester`, `sender`, `programme`, `intake`). Typed tags were removed with their tables (`documents.0005`), the tag box on upload and edit, and the rename and merge tools. Search also finds programme, intake and category words.
- **Student File Submission.** Tabs To do, My files and Letters from the office; it opens on To do while anything is owed. Required documents are a checklist with a status on each and a progress bar; files the office returned are listed with the reason. My files shows tag chips and a category filter.
- **Upload page.** Students pick from type cards, the office's requests first with their status. Staff keep the type list and student picker. The type is suggested from the file name (the person confirms). A summary beside the form shows who will see the file by name, what happens next and the tags it will get; staff change sharing from there.
- **File page.** Tags under the title (staff click one to open the list filtered by it); the office check as progress steps (Uploaded, Office check, Accepted) with the reason when returned.
- **File Management list.** Summary cards to act on (to check, returned, students still to hand in a required document), icon tabs, the filter card with more filters, removable chips for filters in use, a table with tag chips and pages. Coordinators and lecturers get the same page for their own students.
- **File settings.** No Tags tab; Category is the second field of the type editor.
- **Checks:** backend 1820 tests OK (2 skipped); frontend type check clean, 217 test files pass (the production security policy test included), production build passes. Browser runs on private servers as student, office and lecturer at 1440 and 390 px: the checklist from To do to upload and back, the type suggested from the file name, a Faculty Form returned with a reason and shown in the student's To do, the office upload with names and tags in the summary, tag chips filtering the list, summary cards, File settings without Tags; no page errors and no sideways scroll. The check files were removed afterwards and Turnitin Report put back as it was.

## Letters: Lists, A Student Form Per Letter, And Both Sides Restructured (2026-10-25)

Plan: `docs/superpowers/plans/2026-10-25-letter-generation-redesign.md`, approved by Xiang after the research and wireframes. Screens follow Wey Cheng's module design (Supervisor Appointments, Marks): icon tabs, summary cards, the grey filter card, responsive tables, record pages, the numbered stepper and `ApprovalProcess`.

- **Lists the office edits** (Letter Generation, Lists tab). Purposes (Banking, Transportation…) and the organisations under each, with a Malay name and a saved address that is filled in for the student; whether students may type one that is not listed; simple lists for "Choose from a list" questions. Add, paste many (names already listed are skipped), edit, sort A to Z, move up or down, hide or show. An entry a letter used can only be hidden; unused ones can be deleted. Seeded from the old built-in lists (migration `letters.0009`).
- **A student form per letter type.** The editor's Student form tab: "Who is the letter for?" (with the purposes it offers and whether it asks for the address), "Additional information", and the office's own short text, date, list and yes-or-no questions, in order, with a live preview of the student's form. Answers go on the letter where the office places them (English and Malay; dates and yes or no in Malay on the Malay page) and show in the office review. Requests keep a copy of every answer, so later edits never change an issued letter. This replaces the on/off switch; letters that had it on got the question automatically.
- **Office screens.** Tabs in the order they are used, with icons: Requests, Issued letters, Letter types, Lists (`/letters`, `/letters/issued`, `/letters/types`, `/letters/lists`). Requests has summary cards that filter, the filter card (search, letter, status), a For column and paging; the review page adds "Approve and open next". The letter type editor is a record page with four tabs (Details, Student form, Letter, Issuing), one Insert menu grouped by where a detail comes from, a preview that can be filled in with a real student's record (by matric number), an error summary that points at the tab, and no tag names shown to staff.
- **Student screens.** Letter cards say what the form will ask and how long it usually takes. The form has two steps, "Letter details" (the Maya layout) and "Check and send" with Change links. My requests has Current and History, each request with its progress steps and dates, valid-until reminders, and Request again with last time's answers.
- **Letter type editor made simpler (2026-10-26, Xiang found it confusing).** The four tabs became numbered steps in the portal's stepper: About the letter, Student form (only for letters students ask for), Write the letter, Signature and status. A new letter type goes through them in order with Continue and is created at the end (then the list opens); an existing one opens at any step, with Save at the top. "When is this letter used?" is the first choice, as cards; the old "Letter type" dropdown is now Category; status is chosen once, in the last step. The wording shows details as [Student Name] instead of tags (saved as tags, so nothing else changes), is checked as it is typed, and has the printed letter previewed beside it. Office blanks are added from Insert detail and listed under the wording.
- **Address required (2026-10-26, Xiang).** When a letter asks for the address, Address Line 1, Postcode, City and State/Country must be filled in (checked on the form and by the server); Address Line 2 stays optional.
- **Fix:** issued letters now send `validUntil` as a date, so "valid until" shows properly (it read "Invalid date" since 2026-10-23).
- **Merged first:** origin/main (PR #21) as `d2095e4`; dev DB migrated after `db-backups/fsktm_pg_office_before_main_pr21_merge_2026-10-25.dump`, then to `letters.0009` after `db-backups/fsktm_pg_office_before_letter_lists_2026-10-25.dump`.
- **Checks:** backend 1816 tests OK (2 skipped); frontend type check clean, 217 test files pass, production build passes. Browser runs as office and student (TG accounts): lists editing and paste, a new letter type with four questions, the student form with required errors, saved address and Check and send, approve and open next, the preview with a real student, valid-until in My requests; no page errors and no sideways scroll on a phone.

## Letters: Student Confirmation Letter As In Maya (2026-10-23)

The supervisor asked for UM Maya's confirmation letter request to be part of the system.

- **The student says who the letter is for.**
  - They apply on a page laid out like Maya's "Letter Details Application Form" (`/letters/apply/<template id>`, added 2026-10-25): their ID and name on top, then one row per field with the label on the left and a hint on the right. Every letter now uses this page instead of a pop-up; a plain letter only has the programme, the date and a note.
  - They choose a purpose (Banking, Government agencies, Mobility, Non-government agencies, Sponsorship or Transportation), then the organisation from a built-in list they can search: 47 Malaysian banks, 27 agencies and embassies, sponsors, NGOs and transport companies. An organisation not listed can be typed in.
  - They type the address to print, and tick what else to show: minimum period of study, maximum period of study, current semester. Lines they do not tick are left out.
- **The letter** follows the Maya sample: the recipient block, a details table (name, IC/passport, matric number, programme, method of study, faculty, date valid, semesters left), and a Malay second page ("Surat Pengesahan Pelajar") with Malay dates, programme name and mode of study.
  - Date valid is the issue date plus the template's months (3 for this letter).
  - Semesters left are worked out from the registry when it can be read; otherwise the office types them in at approval.
- **The office** still approves each request. The review shows who the letter is for and previews both pages. A new letter replaces only the student's copy for the same organisation, so a Maybank letter and a KTMB letter can both be valid.
- **The office's switch decides it** (2026-10-25). "Students say who it is for" is an on/off switch on any letter students ask for. On: the student's form shows Purpose and Recipient (for Transportation: KTMB, AirAsia, Malaysia Airlines and more), the address and only the optional details the letter shows, and Recipient is added to the top of each page. Off: the plain form, and Recipient is taken out. A letter that asks but does not print the recipient cannot be saved. Checked in the browser with a throwaway letter, switched on and off, then deleted.
- **Template editor.** An English/Malay switch for writing, an "Asking for this letter" card ("Students say who it is for", "Valid for (months)"), a preview of both A4 pages, and `| Label | value |` lines for details tables. The PDF and the print view have the Malay page too.
- **Migrations** `letters.0006` (fields) and `letters.0007` (adds the Student Confirmation Letter and archives Confirmation of Enrolment). The dev DB was migrated after the backup `db-backups/fsktm_pg_office_before_confirmation_letters_2026-10-23.dump`.
- **Verification.**
  - The backend passes 1706 tests (20 new for confirmation letters).
  - All 203 frontend scripts pass, along with lint and the build.
  - In the browser, TG-STU-01 requested a letter for Maybank (searching "maybank" in the bank list), and TG-OFFICE-01 reviewed both pages, typed the missing semesters left and approved it (`UMF/PG/SCL/2026/0001`). The issued letter, its PDF (two pages) and the template editor were checked, with no page errors.

## Module-by-Module Check of Xiang's Modules (2026-10-17)

Each of Xiang's modules was tested in turn: the backend rules through the API, every button in the browser, and the layout at 1440, 1024, 768 and 390 px. The latest code was already on `Xiang` (GitHub's `main` and every teammate branch were merged in), so nothing was pulled. It ran on private servers (email printed to the console, never sent) with throwaway smoke accounts, all removed afterwards.

| Module | Checks run | Bugs fixed | Commit |
|---|---|---|---|
| Authentication and Settings | API 53/53, browser 64/64 | 4 | `3b422c6` |
| Announcements and notifications | API 61/61, browser 69/69 | 4 | `c6b7fbb` |
| Student Registry | import phases 1 to 9 (all green), browser 45/45 | 4 | `2ffea24` |
| Letter Generation | requests 26/26, appointment letters 33 + 16 + 20, new checks 24/24 | 2 | `c8cd895` |
| File Management | 7 existing runs (95 checks), new checks 17/17 | none | |
| FAQ chatbot | chat 29/29, phone, office 36/36, gaps 47/47 | none | |

- **Authentication and Settings:**
  - a quick double reload signed people out. A reload that cut off `/api/auth/refresh/` left the browser holding the cookie the server had just replaced. For 30 seconds that browser, proved by a new HttpOnly `fsktm_session_key` cookie set at sign-in, may renew with it. A copied refresh token alone is still refused (Wey Cheng's `test_refresh_rotates_cookie_and_rejects_previous_token` still passes), and sign-out or a password change ends it;
  - signing in from a portal link (for example an email) now opens that page, as does signing in again after a session ends. Signing out on purpose starts the next sign-in on its landing page;
  - Settings refused neither a phone number with letters or a formula nor the same password again, unlike the older endpoints. Problems now show under the field;
  - the header greeting follows the time of day in Malaysia (it always said Good Morning).
- **Announcements and notifications:**
  - the attached file covered the last lines of the message box;
  - the chosen priority is announced to screen readers;
  - in a notification, Reference lines up under its label like From and To;
  - on a phone the message scrolls and Close stays in view.
- **Student Registry:**
  - the office can correct a student's name and email. An email in use is refused, an activated student's old address is told, and an unactivated student's old activation link stops working;
  - the record warns before unsaved edits are lost, and a fixed field clears the last save problem;
  - the current semester was labelled Admission Intake. Intake now uses the same label style, and the last sign-in uses the portal's date format;
  - on a phone the summary cards sit two to a row, and the student table scrolls sideways instead of squeezing names.
- **Letter Generation:**
  - the office could no longer revoke an issued letter or resend its notification (`414ec2b` had left one View button per row). Both are back inside the letter's view, so each row still has one button;
  - a revoked request letter is now emailed to the student, like an approval or a rejection.
- **Seen, not changed (Wey Cheng's shared code):**
  - the sidebar does not react to a resize, so turning a tablet from landscape to portrait leaves it open over the page (`AppLayout`);
  - record pages move focus to the heading, so a box is drawn around it when a page is opened by its link.

**Verification:** backend 1453 tests, all pass apart from Wey Cheng's known appointments migration test (`project_course_codes`). Frontend type check, 150 of 150 script tests, the build and the production security checks pass. The dev database holds no smoke data afterwards.

## Remaining-Modules Plan: Full Check (2026-10-16)

A full check of everything the plan built (UC22 appointment letters, UC03 staff accounts, UC28/29 FAQ chatbot): the backend rules, every button in the browser, and the layout at 1440, 1024, 768 and 390 px. It ran on private servers (email printed to the console, never sent) with throwaway smoke accounts, all removed afterwards. The dev database is back to its real data: 117 FAQ entries, no saved questions, no documents, no smoke accounts.

- **Backend:** 1432 tests, all pass apart from Wey Cheng's known appointments migration test (`project_course_codes`). The real-model FAQ checks ran too (`FAQ_REAL_MODEL_TESTS=1`).
- **Frontend:** type check, 148 of 148 script tests, the build and the production security checks pass.
- **Buttons, in the browser:**

  | Module | Earlier runs, again | Buttons those runs did not press |
  |---|---|---|
  | UC22 letters | L2 33/33, L3 16/16 | 20/20: panel template with tags, bold and Check Placeholders; a second active panel template refused; register filters, Reset, View, Close; the student's View, Print and PDF; File Submission View and Download |
  | UC03 staff | S3 49/49 | 62/62: list pages, search, Role and Status filters, the registry tabs; office and coordinator accounts with send later; activation end to end (email, set password, sign in with Staff ID); an email change stopping the old link; reset link; telling the old address; sign-in off for real (signed out, can't sign in, back on); Turn off sign-in instead; No programme; Keep it and Delete; Open their account |
  | UC28/29 FAQ | C3 29/29, phone, C4 36/36, C5 14/14 | 47/47 knowledge base and chat: list pages, Show them, filters; an entry from Add to Delete (other ways of asking, Preview, Save draft, Publish, Save changes, Try it, Archive, Restore, leaving with changes); Mark as checked alone; Add as another way to ask with search and Cancel; Dismiss; common, related and portal buttons in the chat. 12/12 documents: a wrong file type refused, Download, Replace the file, Restore, Rename Cancel, a restored document quoted again |

  Every failure along the way was the check script itself (waiting too briefly, or a test word no entry contains), confirmed by hand each time.
- **Layout:** 24 pages, each at the four widths: no sideways page scroll, nothing past the screen edge, no buttons on top of each other.
- **Fixed:** on a phone, the Staff & Lecturers list and the FAQ entries list squeezed their first column to a few letters a line. Both tables now keep a minimum width and scroll sideways inside their box, like the app's other lists.
- **Seen, not changed (shared code, not from this plan):**
  - record pages move focus to the heading for screen readers, so Chrome draws a box around it when a page is opened by its link;
  - at 1024 px the footer's "Support Desk" link wraps to a second line.

## FAQ Chatbot, Phase C6: Evaluation; UC28 And UC29 Complete (2026-10-16)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part C. Commit `8eb2fed`. **This completes UC28 and UC29, and with them the whole remaining-modules plan (UC22, UC03, UC28, UC29).** Optional C7 (AI rewording) was not asked for and is not built.

- **The evaluation set** (`docs/faq/evaluation-set.json`): 122 questions written the way students write them, each labelled with the published entries that answer it:
  - 82 in English: 62 paraphrases, 9 short, 5 slang, 4 with typos and 2 exact terms;
  - 20 in Malay or mixed Malay and English;
  - 20 off-topic, which must get no answer.

  Where two entries answer the same thing (for example "Fees" and "How much is the total fee?"), either counts.
- **`python manage.py evaluate_faq`** runs the set through three versions of the search and reports:
  - top-1 and top-3;
  - answered right;
  - helped (answered right, or the right entry among the choices);
  - wrong answers;
  - off-topic refused;
  - time per question.

  It sweeps the two cut-offs. The results are kept in `docs/faq/evaluation-results.json`.
- **How the cut-offs were chosen:** answer as many questions right as possible, with at most 2 wrong answers (2%) and at least 90% of off-topic questions refused. A wrong answer misleads a student; a set of choices still helps.

**Results for the report (Testing chapter), 2026-10-16, on the 56 published entries:**

| Version | Cut-offs (strong / possible) | Top-1 | Top-3 | Answered right | Helped | Wrong answers | Off-topic refused | Time per question |
|---|---|---|---|---|---|---|---|---|
| Keywords only (BM25) | 0.61 / 0.22 | 65.7% | 75.5% | 39.2% | 67.6% | 2 | 90% | 3 ms |
| Meaning only (MiniLM) | 0.70 / 0.43 | 85.3% | 93.1% | 52.9% | 87.3% | 2 | 90% | 11 ms |
| **Combined (fusion), in use** | **0.69 / 0.42** | **91.2%** | **94.1%** | **64.7%** | **89.2%** | **2** | **90%** | **12 ms** |

- **Combined is best on every measure** at the same budget of wrong answers. This justifies the hybrid design (design decision D12 and the C2 notes).
- **By kind of question** (combined):

  | Kind | Answered right | Helped |
  |---|---|---|
  | Paraphrases | 72.6% | 95.2% |
  | Malay | 50% | 80% |
  | Short | 55.6% | 88.9% |
  | Slang | 60% | 80% |
  | Typos | 25% | 50% |
  | Exact terms | 100% | 100% |
- **Trade-off, for the report:** looser cut-offs (0.62 / 0.36) would answer 78.4% right and help 92.2%, but give 4 wrong answers and refuse only 80% of off-topic questions. The stricter pair was chosen.
- **Tried and dropped:** offering choices whenever the top two entries are nearly level. Margins of 0.02 to 0.08 made no difference, because the wrong answers' runners-up were never that close.
- **Keyword fallback** gets its own cut-offs (`FAQ_KEYWORD_STRONG_MATCH` 0.61, `FAQ_KEYWORD_POSSIBLE_MATCH` 0.22), since it scores on another scale. Borrowing the combined pair would have helped only 58% instead of 68%.
- **Regression tests** (`faq.test_evaluation`):
  - the set itself is sound: 122 questions, 20 Malay, 20 off-topic, every reference is a real FAQ row, no repeats;
  - the decision and the rule;
  - keyword search alone on the imported FAQ must keep top-3 at least 72%, helped at least 64%, at most 2 wrong answers and 90% of off-topic refused. This runs every time;
  - with `FAQ_REAL_MODEL_TESTS=1`, combined must keep top-1 at least 88%, top-3 at least 92%, answered right at least 60%, helped at least 86%, at most 2 wrong answers and 90% of off-topic refused (it passes).
- **Known limits found** (for the report):
  - **Typos:** a word like "aply" matches neither the keywords nor the model well.
  - **Malay:** half of the questions are answered outright, but 80% helped once choices are counted.
  - **Similar entries:** the two remaining wrong answers go to near entries ("when is course registration" gets the timetable entry; "berapa yuran permohonan" gets the total fee entry).
  - **What improves these:** the office adding other ways of asking from the Student questions tab, and its corrections to the 61 entries that still need checking.
  - **The document cut-off** (0.6) can't be measured until the office uploads its real handbook.
- **Optional student check** (5 students: did it help, was it easy) is left for Xiang to run for the report.

**Verification:**
- Backend: all pass apart from Wey Cheng's known test. The real-model checks also pass with `FAQ_REAL_MODEL_TESTS=1`.
- `check` and `makemigrations --check` are clean. No frontend change in this phase.

## FAQ Chatbot, Phase C5: Reference Documents (2026-10-16)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part C. Commit `0222ea7`.

- **New models** (migration `faq.0003`):
  - `FaqDocument`, the uploaded handbook or guide, kept in private storage;
  - `FaqPassage`, about 150 words with the page it came from;
  - saved questions and the history now also point at documents;
  - five new history actions: uploaded, replaced, renamed, archived, restored.
- **Uploads:**
  - the same safety checks as File Management (`check_upload`), PDF and Word only, 10 MB;
  - PDF text comes from PDFium and Word text from the file's own XML, so there is no new library;
  - passages end at a sentence where possible and never run across a page;
  - a scanned PDF has no text, so it is kept as "No text found" and never searched. No text recognition is done.
- **How documents answer:**
  - passages are searched only when no entry matches;
  - the reply is then "From <title>, page N", the passage, a note that it is "a passage from a document the PG Office uploaded, not a reviewed FAQ answer", **Open document** (a download), and "Did this help?";
  - the cut-off is `FAQ_DOCUMENT_MATCH`, 0.6 for now: the meaning score with the model, or, with keywords alone, at least two words must agree;
  - archived documents and those with no text are never quoted.
- **Who opens a document:** the office always. Students and coordinators only while it is ready and not archived. Lecturers are refused.
- **Office screen:** a new **Documents** tab (`/faq/documents`):
  - upload with an optional title (otherwise taken from the file name);
  - each document shows its file, size, pages, uploader and date, with "Ready, N passages", "No text found (scanned PDF?)" or "Archived";
  - the ⋯ menu holds Download, Rename, Replace the file, and Archive or Restore.
- **Dev database:** backed up first (`..._before_faq_documents_2026-10-16.dump`), then migrated to `faq.0003`.

**Browser check** (private servers, smoke accounts, the real model): 14 of 14 pass.
- **Office:** a text PDF is ready with its passages; a scanned PDF shows "No text found"; a title comes from the file name; renaming works.
- **Student:** asking "What time does the faculty library open on Saturday?" quotes "From Smoke Library Guide, page 1" with the extract label, and Open document downloads the PDF.
- **Archive:** after archiving, the same question no longer quotes it.
- **Layout:** the tab fits at 1440, 1024, 768 and 390 pixels. No console errors.
- **Afterwards:** the smoke documents, their files, questions, history and accounts were removed.
- **Small fixes from the screenshots:** small files now show in KB instead of "0 MB", and "1 page" is singular.

**Verification:**
- Backend: 1,426 pass, 1 skipped (the real model) and 1 fails, Wey Cheng's known test. The 13 new tests cover a text PDF (passages and pages), a scanned PDF, Word text, refusing other types and broken files, rename, replace (the old file deleted), archive and restore, office-only management, a passage answering with no entry, a clear entry winning, archived and unreadable documents never searched, a weak passage refused, keyword mode needing two words, who may open a file, and passages never crossing a page.
- Frontend: all 148 test scripts pass. `faqOffice.test.ts` now also checks the document wording and that every new history action has words; that guard caught five missing ones, which were added. TypeScript, the build and both production security checks pass.

## FAQ Chatbot, Phase C4: The Office's Knowledge Base Screens (2026-10-16)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part C. Commit `c24dacf`. The office's FAQ page ("FAQ Knowledge Base") replaces the Academic FAQ Editor mock. Its tabs are their own addresses: `/faq`, `/faq/questions`, `/faq/settings`, and entries at `/faq/entries/<id>` and `/faq/entries/new`.

- **Entries:**
  - a banner says how many imported entries need checking and how many are live, with **Show them** and **Download the review list**;
  - search, plus Category and Status dropdowns (with counts);
  - columns for Question (with its problem note, or how many other ways of asking and its portal button), Category, Status (a chip only when not Published) and Updated;
  - a notice appears if the server is on keyword search only.
- **Entry page:**
  - question, other ways students ask (chips), answer with a Preview, category, and portal button;
  - for an imported entry that needs checking, the PDF's text and its problem sit above the fields, with **Save changes**, **Mark as checked**, and **Mark as checked and publish**;
  - Save draft and Publish for drafts; Save changes once published; Restore when archived. The ⋯ menu holds Archive and Delete;
  - **Try it** shows the match (Strong, Possible or none) and the top entries with their scores, marks "This entry", and says when the entry isn't published yet. Nothing is saved;
  - History.
- **Student questions:**
  - four numbers: questions this month, answered, marked helpful, and to look at;
  - groups of questions with No match or "No", with how often and when they were asked, and what the chatbot did;
  - **Add as another way to ask**: the closest entries are suggested through Try it, with a search for others;
  - **Create entry**: opens a new entry with the question filled in, and settles the group once it is saved;
  - **Dismiss**.
- **Settings:** the contact text, and up to four common questions for the start screen.
- **Backend additions:**
  - `questions/` (`?only=stats` gives just the numbers, for the tab's count) and `questions/review/`;
  - `settings/`;
  - list rows carry their number of other ways of asking and the import note.
- **Grouping by meaning.** The first browser run showed that "where can i park my car at the faculty" and "faculty parking where" did not group, because only identical words did. Groups now also form when questions are close in meaning (0.75 with the model, measured: same-meaning pairs scored 0.80 to 0.89, unrelated about 0.08). Without the model, only the same words group.
- **The office's corrections:** `python manage.py import_faq_corrections <filled review list>` loads the correct answers, and questions where given. Each corrected entry is checked and published (`--draft` to hold them).
  - **Fixed on the way:** the workbook was left open, which locked the file on Windows.
  - **Waiting:** the office has not returned the list yet, so the 61 entries still need checking.

**Browser check** (private servers, smoke accounts, the real model): 36 of 36 pass.
- **Entries:** the banner and the review list download; checking an imported entry with the preview and another way of asking, then publishing it; Try it finding "This entry"; adding and publishing a new entry with a portal button.
- **Student questions:** grouping, adding a group to an entry, creating an entry from a group, and dismissing.
- **Settings and the ⋯ menu:** saving settings; archive and delete.
- **Layout and roles:** all four pages fit at 1440, 1024, 768 and 390 pixels; a coordinator who opens an entry address gets the chatbot instead.
- No console errors.
- Afterwards the smoke entries, questions and accounts were removed, and the settings were restored. Nothing was added to the real entries, and the dev database is back to 56 Published and 61 Needs checking.

**Verification:**
- Backend: 1,413 pass, 1 skipped (the real model) and 1 fails, Wey Cheng's known test. The 13 new office tests cover grouping (by words and by meaning), add, create and dismiss, the numbers, the settings, office-only access, and the corrections loader (publish, draft, blank rows, unknown entry numbers, missing columns, formula text). Tests never load the real model.
- Frontend: all 148 test scripts pass, including the new `utils/faqOffice.test.ts`. It checks that every backend status and history action has words. TypeScript, the build and both production security checks pass.

## FAQ Chatbot, Phase C3: The Chat Screen (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part C. Commit `55d961d`. The FAQ Chatbot page now answers from the office's FAQ instead of fixed replies.

- **Start:**
  - "Hi! I answer questions using the PG Office FAQ. I can't see your own records...";
  - the six topics as chips. A topic lists its questions;
  - four common questions above the question box until the first question.
- **Replies:**
  - **A clear match:**
    - the office's answer, with "Matched: ..." when the student asked in other words;
    - working links and the optional portal button;
    - the source line ("From the PG Office FAQ · topic");
    - up to three related questions;
    - "Did this help? Yes / No".
  - **A possible match:** "Which one did you mean?" with up to three choices, plus **None of these**.
  - **No match, "No" and "None of these":** the office's contact text, and "Your question has been passed to the office, without your name, so they can add an answer."
  - **Errors** show Try again. Too many questions in a minute shows "Please wait a moment".
- **Who sees it:** students, and now **programme coordinators**, who ask rather than edit (`App.tsx`, one condition). The office keeps the editor screen, which C4 rebuilds.
- **Safe answers** (`utils/faqText.ts`, `FaqText.tsx`):
  - **bold**, bullets and `[text](address)` links, plus web and email addresses written out;
  - only web, email and portal addresses are ever linked; anything else stays text;
  - no raw HTML is rendered;
  - outside links open in a new tab with `noopener noreferrer`.
- **Layout:** the question box stays pinned and lifts above the page footer as before. The conversation is a polite live region for screen readers.
- **Removed:** the fixed keyword replies, the fake typing delay and the "AI Assistant" labels.

**Browser check** (private servers 8002 and 3002, smoke accounts, the real model): 29 of 29 pass.
- **Start and answers:** topics and common questions; a topic's question answered; a typed paraphrase answered with "Matched:"; Yes thanked.
- **Links and No:** a web address answer linking safely; No showing the contact.
- **Choices and no match:** choices, picking one, and None of these; an off-topic question getting No match.
- **Errors:** a failed request retried.
- **Layout:** the footer links stay usable; the chat fits at 1440, 1024, 768 and 390 pixels, also opened straight on a phone.
- **Roles:** a coordinator gets answers.
- No unexpected console errors.
- The run's 9 saved questions and both smoke accounts were removed afterwards.

**Verification:**
- Frontend: all 147 test scripts pass, including the new `utils/faqText.test.ts`. It covers links, script links refused, raw HTML, bullets and "Matched:", the portal buttons matching the backend, and coordinators getting the chatbot. TypeScript, the build and both production security checks pass.
- Backend: no change in this phase.

## FAQ Chatbot, Phase C2: Search And Replies (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part C. Commit `62603fe`.

- **New dependency:** `fastembed` 0.9 (it brings `onnxruntime` 1.31 and `numpy` 2.5). It is in `requirements.txt` and installed in `backend/.venv`.
  - The model, `paraphrase-multilingual-MiniLM-L12-v2`, downloaded once into `backend/faq_model_cache/` (241 MB). The folder is git-ignored.
- **How an answer is found** (`faq/search.py`):
  - two searches run over every Published entry and its other ways of asking. A keyword search (BM25, with English and Malay stop words and simple plurals) catches exact terms; the meaning model catches paraphrases and Malay;
  - the two rankings are merged with reciprocal rank fusion;
  - the top entry's confidence decides: Strong shows the answer with up to three related questions, Possible offers up to three choices, and anything lower is No match with the office's contact text;
  - the starting cut-offs are 0.72 and 0.5 (`FAQ_STRONG_MATCH`, `FAQ_POSSIBLE_MATCH`). They are set properly from the evaluation in C6.
- **Speed and storage:**
  - the model loads once per process, lazily, never at import;
  - vectors are stored in `FaqVector`, keyed by model and a fingerprint of the text, so nothing is worked out twice;
  - the index rebuilds itself when entries, other ways of asking or category names change.
- **No model, still answers.** If the model can't be loaded, keyword search carries on alone, and `search-status/` tells the office. `FAQ_SEARCH=keywords` forces it.
- **API:**
  - `start/`, `ask/` (also for a picked choice or related question) and `feedback/`, for students and programme coordinators;
  - `try/` (saves nothing, shows the scores) and `search-status/`, for the office;
  - lecturers are refused, as they have no FAQ menu.
- **Saved questions** (`FaqQuestion`) keep the text, outcome, entry shown, score, search mode and "Did this help?", but no name or student ID. "Did this help?" needs the signed token from that answer.
  - `purge_faq_questions` deletes questions after 12 months.
  - At most 30 questions a minute per person.
- **New settings row** (`FaqSettings`): the contact text and the four common questions. The office edits them in C4; until then the start screen suggests one question per topic.
- **Dev database:** migrated to `faq.0002`.
  - **Slip:** the backup was taken just after this migration rather than before (`..._before_faq_search_after_0002_2026-10-15.dump`). The migration only adds three new empty tables, so nothing was at risk.
- **First run on the real FAQ** (Try it, nothing saved):
  - the first answer takes about 4 seconds (loading, and working out the 56 questions once); later ones take 10 to 30 ms;
  - "how to apply?" is a Strong match;
  - "where to buy nasi lemak" gets No match;
  - questions whose only entry still needs checking (PTPTN, weekend classes) correctly find nothing.
- **Docs:** `backend/README.md` covers asking, the search, the model and the commands (`rebuild_faq_index`, `purge_faq_questions`).

**Verification:**
- Backend: 1,400 pass, 1 skipped (the real-model check) and 1 fails, Wey Cheng's known test. The 28 new tests use a small fake encoder and cover:
  - a Malay question finding the English entry, and keywords rescuing an exact term the model misses;
  - choices, no match, and only Published entries ever found;
  - the index following changes, and vectors kept;
  - questions saved without identity, feedback tokens, and picking a choice;
  - who may ask, Try it saving nothing, the rate limit, keyword fallback and a model that won't load;
  - deleting after 12 months.
- With `FAQ_REAL_MODEL_TESTS=1`, the real model finds the English entry for a Malay question (it passes).
- `check` and `makemigrations --check` are clean.

## FAQ Chatbot, Phase C1: The Knowledge Base Backend (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part C. Commit `b4ec50e`.

- **New app `backend/faq/`** (migration `faq.0001`):
  - `FaqCategory`;
  - `FaqEntry`, with four statuses: Published, Draft, Needs checking and Archived, plus the PDF's own text for imported rows;
  - `FaqAltQuestion`, for other ways students ask;
  - `FaqChange`, the history, which cannot be edited or deleted.

  Only Published entries are ever searchable (`FaqEntry.objects.published()`).
- **API** at `/api/faq/`, for Office Staff/Admin only:
  - entries: list with search, category and status filters and counts per status; create; edit; delete;
  - status actions: publish, mark as checked, archive, restore;
  - categories: list, add, rename;
  - the review list as an Excel download.
- **Answers:** links must start with `https://`, `http://`, `mailto:` or `/`. A script link is refused.
- **Import** (`python manage.py import_faq`, from `docs/faq/faq-entries.json`):
  - **56 Published**: the clean category rows;
  - **61 Needs checking**: 37 damaged category rows, plus the 24 rows found only on the PDF's "ALL" sheet, placed in the category of the row before them;
  - **46 skipped**: "ALL" rows that repeat a categorised question exactly, so none of them added another way of asking;
  - the six categories get plain names, in PDF order. The spelling slips are fixed;
  - running it again adds nothing and never overwrites the office's edits.
- **Review list for the office** (`python manage.py export_faq_review`): one Excel sheet of the 61 entries to check, with the question and answer now, the PDF's text, what looks wrong, and empty columns for the corrections. Text that starts like a formula is made safe.
  - **To send to the office:** `Final Year Project/faq-review-2026-10-15.xlsx` (outside the repository).
- **Dev database:** backed up (`..._before_faq_app_2026-10-15.dump`), migrated to `faq.0001`, and the FAQ imported.
- **Docs:** `backend/README.md` has an FAQ knowledge base section.

**Verification:**
- Backend: 1,373 of 1,374 pass. The one failure is Wey Cheng's known test. The 32 new tests cover:
  - the import counts per status and categories;
  - running twice, and the office's edits kept;
  - Needs checking never searchable, the PDF text kept, and the nearest category for "ALL" rows;
  - the review list, and formula safety;
  - office-only access, safe links, other ways of asking, the status steps, delete with history, and the list filters.
- `check` and `makemigrations --check` are clean. No frontend change.

## Staff Accounts, Phase S3: The Screens; UC03 Complete (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part B. Commit `d97177f`. **This completes UC03.** Registry > Staff & Lecturers now runs on live data, and the office no longer needs Django admin to make staff accounts.

- **Pages** (office only; anyone else who opens them is sent back to `/registry`):
  - **`/registry/staff`, the list:**
    - search, plus Role and Status dropdowns;
    - columns for name and email, role with duties or programme underneath, status (a chip only when not Active) and last signed in;
    - pages of 25;
    - one main button, **Add account**. There are no summary cards.
  - **`/registry/staff/new`, Add account:**
    - pick one of three role cards first; only that role's fields then appear;
    - lecturers tick their duties, with a reminder about Lecturer capacity;
    - coordinators pick a programme, and programmes that already have a coordinator are greyed out with the coordinator's name;
    - the "Send the activation email now" tick is on by default;
    - a duplicate email or Staff ID names its holder, with an "Open their account" link;
    - leaving a filled form asks first.
  - **`/registry/staff/<id>`, the account page:**
    - Details, with Edit details in a dialog;
    - Duties as ticks. A duty with open work can't be unticked and lists that work;
    - a capacity line read from Lecturer capacity;
    - History;
    - an Access box with one fitting action: send activation email (or copy the link), send password reset link, or turn sign-in back on.

    The ⋯ menu holds "Turn off sign-in" and "Delete account". Each one opens a dialog that explains first when it can't go ahead: the open work for sign-in, or the reasons for delete. The same dialog offers "Turn off sign-in instead". Coordinators get Change programme, which shows what waits in each programme before moving.
- **Created accounts** open on their own page with the activation outcome. If the email failed, the page offers **Try again** and **Copy the link**.
- **The mock is gone.** `getStaff`, `MOCK_STAFF`, `MOCK_DEPARTMENTS` and the `StaffRecord` type are removed. They are replaced by `types/staffAccount.ts`, `services/staffAccountsApi.ts` and `utils/staffAccounts.ts`.
- **Code layout:**
  - `StaffLecturersRegistry.tsx` keeps its exported names.
  - The Students / Staff & Lecturers switcher moved to `RegistryModuleTabs.tsx` and now changes the address.
  - Shared files have additive changes only: `App.tsx` (one lazy route) and `constants/routes.ts`.
- **Fixed on the way: `SelectMenu` inside a dialog.** A modal dialog leaves the rest of the page inert and below it, so a dropdown list opened inside one could not be clicked. The list now opens inside the dialog. This also fixes the programme dropdown in File Management's "Who can see this file?" dialog.
- **Design decisions for the report:**
  - **D9.** One role per account. A lecturer's duties (Supervisor, Panel member) give several roles at once (FR-06), with no separate permission editor (UC03 "configure permissions").
  - **D10.** Used accounts are switched off, not deleted, so history and audits stay. Only an account added by mistake, never signed in and linked to nothing, can be deleted (UC03).

**Browser check** (private servers 8002 and 3002, smoke accounts only): 49 of 49 pass.
- **Accounts:** the list and filters, adding a lecturer with the email sent, editing, adding a duty, copying the link, and deleting the unused account.
- **Refusals:** a duplicate email and Staff ID refused with links; the leave-page warning.
- **Blocked actions:** an unremovable duty, and sign-in off and delete explained for a lecturer with a waiting request.
- **Sign-in and programme:** sign-in off and back on; a coordinator's programme move, with the taken programme greyed out; no risky actions on your own account.
- **Widths:** the list, account page and form fit at 1440, 1024, 768 and 390 pixels.
- **Other roles:** a coordinator and a lecturer are sent back from `/registry/staff`, see no tab, and get 403 from the API.
- No unexpected console errors.
- Emails went to the console only. Smoke data was removed afterwards: the dev database is back to 8 staff accounts, no history rows, and the demo coordinator unchanged.

**Verification:**
- Frontend: all 146 test scripts pass, including the new `utils/staffAccounts.test.ts`. It also checks that every backend work count and history action has words. TypeScript, the build and both production security checks pass.
- Backend: no change in this phase, so the S2 run stands (1,341 of 1,342, with only Wey Cheng's known test failing).

## Staff Accounts, Phase S2: The Rules (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part B. Commit `2eeb89a`. The backend for staff accounts is complete; the screens come in S3.

- **Duties** (`POST /api/registry/staff/<id>/duties/`):
  - only lecturer accounts have them;
  - a duty is added only while the lecturer is active and can sign in;
  - a duty is removed only when nothing open needs it, and the refusal lists that work:
    - Supervisor: active supervision or co-supervision, and supervisor requests or co-supervisor nominations still waiting;
    - Panel: active panel appointments and nominations still waiting.
- **Capacity line.** The account page reads Lecturer capacity through Wey Cheng's resolver, read-only.
  - A new duty shows "not configured" until the office adds a limit there.
  - A limit left behind for a removed duty is flagged.
- **Coordinator programme** (`programme/`):
  - can move to a programme no other active coordinator manages, or to none;
  - `check` counts the approvals waiting in the old and new programme first: supervisor requests, co-supervisor nominations, panel nominations and amendments.
- **Sign-in off and on** (`sign-in/`). Turning it off:
  - needs a reason and ends every session;
  - is refused for your own account and for the last office account;
  - is refused while `lecturer_blockers` (Wey Cheng's, read-only) shows open work, which is listed, and points to Participant lifecycle.

  Turning it back on is refused for a retired lecturer, and for a coordinator whose programme someone else now manages.
- **Delete.**
  - Only for an account that has never signed in and that no record points to.
  - The check goes through every table linked to the account or its lecturer profile, hidden links included (letters), apart from its own profile, duties, notices and history.
  - Otherwise the reasons come back and the office turns sign-in off instead.
- **The account page** now carries `capacity`, `activeWork` and `deletion`, so S3 can explain each action before it is tried.

**Verification:**
- Backend: 1,341 of 1,342 pass. The one failure is Wey Cheng's known `appointments.test_capacity_reassessment_migration`. The 32 new tests cover each blocker for duties and sign-in off, your own account, the last office account, sessions ending, delete refused for linked records (including a letter and a capacity entry), the programme clash, the approvals check, two quick conflicting changes, and office-only access.
- `check` and `makemigrations --check` are clean.
- No new migration. No frontend change in this phase.

## Staff Accounts, Phase S1: Backend (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part B. Commit `8efcbec`. The office can now add and look after staff accounts through the API; the screens come in S3.

- **New model:** `accounts.AccountChange` (migration `accounts.0014`), the account history.
  - Each row records who made the change, when, and what changed.
  - Rows cannot be edited or deleted, and they keep the name and email after an account is deleted.
- **API** at `/api/registry/staff/`, for Office Staff/Admin only:
  - list, with search, role, status and pages;
  - add;
  - options (departments in use, and each programme's coordinator);
  - details and edit;
  - send link and copy the activation link;
  - history.
- **Adding an account:**
  - no password is made; the activation link has no time limit, as for imported students;
  - lecturers get their ticked duties (Supervisor, Panel);
  - coordinators get their programme, and a programme that already has a coordinator who can sign in is refused;
  - office accounts also get `is_staff` and the marks permissions, as `seed_users` gives the demo office. Without them the office actions on participant lifecycle, delegations, capacity reassessment and marks refuse the account.
- **Duplicates:** the email (ignoring letter case) and the Staff ID (across office staff and lecturers, and never a student's matric number) are refused, and the refusal names the account that holds them.
- **Editing:**
  - the role, duties and programme are refused here (duties and programme come in S2);
  - an email change tells the old address, but only for an activated account. Old links stop working.
- **Links:**
  - "Send link" sends activation until a password is set, then the 30-minute reset link, and is limited per account;
  - only an activation link can be copied, so the office never gets into an account that has a password.
- **Docs:** `backend/README.md` has a Staff account endpoints section.

**Verification:**
- Backend: 1,309 of 1,310 pass. The one failure is Wey Cheng's known `appointments.test_capacity_reassessment_migration`. The 39 new tests cover each role's profile rows, duplicates across tables, the activation email sent once, send later, a failed email, a race, reset only after activation, office-only access, filters, and history.
- `check` and `makemigrations --check` are clean.
- The dev database was backed up (`..._before_staff_accounts_2026-10-15.dump`) and migrated to `accounts.0014`.
- No frontend change in this phase.

## Appointment Letters, Phase L3: Students And Lecturers; UC22 Complete (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part A. Commit `1040211`. **This completes UC22.**

- **The letter page.** It lives at `/files/letters/<id>`, in Files, because lecturers have no Letter Generation menu.
  - It shows the reference, the issue date, who the letter was sent to, the A4 letter with its own signatory and the office disclaimer, and **Download PDF**.
  - Back goes to the student's files for staff, and to File Submission for students.
  - Anyone the letter was not sent to sees "This letter isn't available to you."
- **Notices.**
  - `APPOINTMENT_LETTER` notices open the letter page.
  - The office's "appointment letter not made" notices open Issued Letters.
- **Lecturers.** On a student's files, the header lists "Your appointment letters" with links, from `GET /api/letters/appointment-letters/received/`.
- **Students.**
  - File Submission's "Letters from the office" now includes appointment letters, marked "issued".
  - My Requests labels them "Sent automatically".
  - A letter still waiting for the office stays hidden.
- **Docs:** `backend/README.md` has the appointment letter endpoints and rules.

**Browser check** (private servers 8002 and 3002, smoke accounts only): 16 of 16 pass.
- The supervisor opens the letter from the notice, downloads the PDF, reaches it from the student's files, and goes back.
- Another lecturer is refused.
- The student opens it from the notice at phone width and sees it in File Submission.
- A waiting letter stays hidden and cannot be opened.
- No console errors apart from the planned 404s.
- With "Email alerts" on, the supervisor's email (console backend) read "Appointment letter: supervisor for …" and linked to `/files/letters/<id>`.
- Smoke data was removed afterwards.

**Verification:**
- Frontend: all 145 test scripts pass, plus TypeScript, the build and both production security checks.
- Backend: L3 changed no backend code, so the L2 run stands (1,270 of 1,271, with only Wey Cheng's known test failing).

## Appointment Letters, Phase L2: Office Screens (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part A. Commit `54a6e97`.

**Template editor:**
- **Used For.** Three cards: Student requests, Supervisor appointment letter, Panel appointment letter. Choosing an appointment letter shows a note on who receives it.
- **Signatory.** "Signed by" name and title fields.
- **Placeholders.**
  - Tags are grouped into "Student record" and "Appointment". Appointment tags appear only for the letter kinds that can use them.
  - The placeholder check uses the same rules and hint wording as the server.
- **Library.** It marks templates that are sent automatically.
- **Preview.** It prints the template's own signatory and, for appointment letters, the office disclaimer.

**Issued Letters:**
- **Missing-letters banner.** It appears only when approved appointments have no letter. It shows how many can be made now, why the others cannot, and a "See which appointments" list, with **Create N letters** and **Set up template**.
- **Made by filter.** All, Student requests, or Sent automatically.
- **Letter view.** It says who the letter was sent to. For appointment letters, its footer offers **Reissue with current details** (rather than a menu clipped by the scrolling table).

**Requests:**
- A waiting appointment letter is labelled as made automatically and shows "Goes to".
- It has no Reject and no student note, and is issued with **Issue letter**.
- The preview shows who will sign it.

**Shared:**
- `LetterPages`, the print window and `letterDataFromIssued` use each letter's own closing lines (`letterClosing`).
- Every letter's API row now carries its signatory.

**Browser check** (private servers 8002 and 3002, smoke accounts only): 33 of 33 pass.
- Covered: the editor, the panel and supervisor tag rules, the banner and its button, the Made by filter, the letter view and reissue, and the Requests review and issue.
- Widths: 360, 390, 768 and 1440 px all fit, with no console errors.
- The banner's Create button was answered in the browser, so no letters were made for the dev database's real demo appointments.

**Found and fixed during the check:** the preview of a *waiting* letter showed the default signatory. A waiting letter has no signatory copy until issued, so the review data now carries the template's signatory, and a backend test covers it.

**Smoke data:** removed afterwards, including the "waiting" notices sent to the three real office accounts. The Files smoke cleanup now also removes appointment-letter notices, since its setup creates appointments.

**Verification:**
- Backend: 1,270 of 1,271 tests pass; the one failure is Wey Cheng's known migration test.
- Frontend: all 145 test scripts pass, plus TypeScript, the build and both production security checks.

## Appointment Letters, Phase L1: Backend (2026-10-15)

Plan: `docs/superpowers/plans/2026-10-15-remaining-modules.md`, Part A (UC22).

**Before building:**
- Wey Cheng's PR #19 (`ee8b3fb`) was fast-forwarded into `Xiang` after a walkthrough.
- The dev database was backed up and migrated to `appointments.0016` (course codes).
- One test fails on `main` itself and belongs to his file: `appointments.test_capacity_reassessment_migration` compares rows after migrating to the latest migration, and his new `project_course_codes` column adds a key. Xiang passes it on.

**What L1 adds (backend only):**
- **Template purpose.**
  - A template is used for *Student requests*, a *Supervisor appointment letter* or a *Panel appointment letter* (`LetterTemplate.purpose`).
  - Only one Active template per appointment letter kind; a database constraint covers races.
  - Students never see or request appointment templates.
  - A template's purpose cannot change while its letters wait for a decision.
- **Signatory.** Templates have an optional "Signed by" name and title. Each letter keeps its own copy, and the PDF prints it.
- **Appointment placeholders.** Twelve new tags, for example `{{RESEARCH_TITLE}}`, `{{COURSE_CODES}}` (from Wey Cheng's new field), `{{PANEL_NAME}}`, `{{COORDINATOR_NAME}}` and `{{SEMESTER}}`. Each works only in the letter kinds it fits, and the template check says which.
- **The hook.**
  - `letters/signals.py` hears a new active Supervisor or Panel appointment and makes the letter once the approval is saved (`transaction.on_commit`, robust).
  - No teammate file was changed.
  - A failed letter never undoes an approval.
- **Making the letter** (`letters/appointment_letters.py`):
  - Issued at once from the active template.
  - Recipients: the student and the supervisor; for panel letters, the panel member too, with the current primary supervisor in copy.
  - Each person gets an in-app notice and, when email alerts are on, an email linking to `/files/letters/<id>`.
  - If a value is blank or the template has office-filled fields, the letter waits in Requests for the office instead.
  - At most one live letter per appointment, guarded by the database.
- **When there is no usable template** (or the panel profile has no student), the office gets one notice per appointment. `GET /api/letters/appointment-letters/missing/` lists active appointments without letters, and `POST .../create/` makes them (chosen ones, or `all`).
- **Reissue.** `POST /api/letters/requests/<id>/reissue/` issues the letter again with current details, such as an amended research title. The old letter is revoked as "Replaced by <ref>." and everyone is told.
- **Access.**
  - Lecturers on a letter can open it and its PDF; `GET .../appointment-letters/received/` lists theirs.
  - Students see appointment letters only once issued, and cannot withdraw them.
  - The office's letter list filters by `madeBy=request|automatic`.
  - Rejecting a waiting appointment letter tells no student.
  - Revoking and resending reach everyone on the letter.
- **Migration:** `letters.0005` (dev DB backed up first, then migrated). The frontend placeholder and disclaimer mirrors (`letterDocument.ts`) and their tests were updated.

- **Migration dependency.** `letters.0005` depends on `appointments.0004`, where `SupervisorAppointment` was created, not on the newest appointments migration. Wey Cheng's migration tests roll appointments back to 0012 or 0014 while keeping every other app at its latest. A dependency on 0016 broke `test_amendment_migration`; 0004 keeps his tests as they were.

**Commit:** `df853d9`.

**Verification:**
- **Backend:** 1,269 of 1,270 tests pass, including 28 new ones in `letters/test_appointment_letters.py`.
  - One test goes through the real approval endpoints: apply, accept, approve, then panel recommend, accept, approve.
  - The one failure is the known teammate test above, which fails the same way on `main`.
- **Checks:** Django checks and the migration-drift check are clean. The dev DB is consistent (`migrate --check`).
- **Frontend:** all 144 test scripts pass, plus TypeScript, the production build and both production security guards.
- **Not yet:** a browser check, because L1 has no screens. That comes in L2 and L3.

## Current-change snapshot prepared for branch push (2026-10-15)

At the user's request, packaged all current tracked/untracked project changes on `codex/portal-consistency-and-toast` for commit and push; the user will create the PR. Included existing Supervisor/shared-decision/programme-access/workspace work, tests, handoffs and the proposed Panel design. Private environment/credential files and database backups remain excluded; staged filename/content checks found no recognised credential patterns. Removed whitespace only in two staged files. Requirements and architecture were checked and retain the current implemented/proposed boundaries. No new Panel redesign implementation.

Fresh pre-push validation: all 144 frontend scripts pass (161 reported test checks), TypeScript and production build pass, and staged whitespace checks pass. Broader appointments/dashboard regression run: 395 tests, 394 pass and one fails in `CapacityReassessmentMigrationTests.test_additive_schema_preserves_appointments_marks_and_completion_history`. It compares complete pre-0015 rows with latest-schema rows; SupervisorApplication now adds project_course_codes with an empty default in migration 0016, causing an extra dictionary key. The test failure is retained as a known PR issue; no test was removed, skipped or weakened. Backend run used the isolated test database with a process-only fast password hasher. No live academic decisions were made; safety stash remains available. Panel-plan critique/explanation follows in chat, with implementation still proposed.

## Latest main integrated; servers restarted; Panel design proposed (2026-10-15)

Fast-forwarded existing `codex/portal-consistency-and-toast` to latest main `f54bf72` (38 commits). Restored all 94 tracked local edits and 87 untracked files; only App/routes needed automatic code integration and PROJECT_STATUS had a content conflict resolved by retaining both histories. Verified other original edited files and all untracked contents against safety stash `eaf6ff783ae91a5c280908c74c8eb1f543188395`, which remains available. No application commit or push.

Installed the updated backend's declared PDF/image dependencies after startup checks identified missing reportlab. Backed up local fsktm_pg_office to `C:/Users/User/AppData/Local/Temp/fkstm-before-main-f54bf72-2026-10-15.dump` (513765 bytes) before applying documents.0001-0004 and letters.0004. Both development servers restarted with hidden windows. Portal localhost:3001 returns HTTP 200; direct API /api/auth/me/ and proxied /api/appointments/panel/ return expected JSON HTTP 401 without authentication. Django checks, migration-applied check, migration dry-run (no model changes), pip check, TypeScript, production build and nine focused existing frontend regression scripts pass. These are integration/runtime checks; no redesign browser verification or full backend test-suite claim.

Read the Panel/Supervisor handoffs and inspected current staff route/renderer/API contracts. Prepared `docs/superpowers/specs/2026-10-15-panel-appointments-consistency-design.md` with the proposed role navigation, Office attention categories, shared detail wireframe, component/API boundaries and verification criteria. Current Office no-panel rows omit profiles with any historical workflow, so they cannot establish the new current-attention category. Requirements/architecture updated to identify this request and proposal. Staff Panel redesign remains pending design approval; no new Panel implementation or live academic decision was made this session.

## Panel consistency handoff prepared (2026-10-15)

Created docs/PANEL_APPOINTMENTS_CONSISTENCY_HANDOFF_2026-10-15.md at the user's request for another session. It records the approved Supervisor hierarchy/typography/navigation, shared record/progress/audit/decision contracts, source-inspected Panel renderer/route/API inventory, role/programme/privacy boundaries, migration proposal and evidence/acceptance checklist. It distinguishes already shared Panel decisions/Student profile from staff detail/timeline work that remains unimplemented, preserves existing test-account capacity limitations and includes a pasteable next-session prompt. All 40 referenced local file links resolve; documentation coverage/format and whitespace checks pass. Existing Supervisor handoff links to it. Documentation-only: requirements/architecture were checked and need no further change; no application code, academic records, test-suite rerun, commit/push or new session creation.

## Student research profile presentation (2026-10-15, verified)

Replaced the nested Student Research profile disclosure with a shared visible section in My supervisors and Panel Appointment. Title/labels/body retain distinct existing weights; programme/area share a responsive row and abstract retains line breaks with a readable line length. Panel cards use the existing detailed appointment styles. Its authenticated API now includes the Student's saved profile or null, preserving pending Panel identity restrictions and the existing title field. Three backend regressions reproduced the missing projection before implementation; both affected rendering scripts also failed before the shared section was added. Updated the routed overview test that still expected the intentionally replaced disclosure; all 140 frontend scripts then passed. All 46 scoped Panel workflow/Student privacy backend tests, TypeScript, production build, Django checks, migration dry-run and whitespace checks pass. No schema/dependency change.

Live Demo Student My supervisors and Panel Appointment show identical saved profile content and all nine compared typography entries match (Inter; heading16/600, title14/600, labels12/600 and values/abstract12/400). Both fit at 320px: document width305, section left40.8/right264 and no overflowing fields; viewport restored. Backend restarted to load the serializer change at 127.0.0.1:8000 --noreload. Desktop/mobile proof files: C:/Users/User/AppData/Local/Temp/student-research-profile-{supervision,panel}-2026-10-15.png and matching -mobile-2026-10-15.png files. Pending/no-profile states use automated fixtures; no fabricated live records or academic changes, commit or push.

## Cross-programme local account set (2026-10-15)

Created 15 accounts as requested: six Students, six Lecturers with both Supervisor/Panel profiles and three Coordinators across Data Science, Cyber Security and Artificial Intelligence (two Students/two Lecturers/one Coordinator per programme). IDs use TEST-{DS,CS,AI}-{STU,LECT,COORD}-{01,02}; each programme has only COORD-01. Existing accounts/passwords and academic record counts were preserved; no invitation emails sent. All new accounts are active local test accounts. Credential roster/password is in the ignored backend/.env.cross-programme-test-accounts-2026-10-15.md file, not tracked documentation. All 15 password/profile/access checks pass; each Coordinator has exactly its own programme scope. Actual login and authenticated /me requests return HTTP 200 for representative DS Student, CS Lecturer and AI Coordinator accounts. Capacity resolution confirms all six new Lecturers are NOT_CONFIGURED for both roles and require Office semester capacity configuration/publication; no published policy was changed. No application code/schema change or commit/push; no application test suite rerun for this data-only task.

## Shared decision process and programme guard (2026-10-15, verified)

Implemented the user-approved plan and critique: one reusable review/user-confirmation dialog, explicit target/consequences/action labels, required reasons and existing acknowledgements, asynchronous duplicate/dismissal protection, retained error inputs, fresh review after 403/409 and one success/warning outcome. Reviewer decisions remain distinct from the acting user's own confirmation; no second-party approval stage was added to Marks, Timeline or Workflow actions. Migrated primary/supporting/research/transfer decisions, Office cancellation/capacity authorisation, selected Panel/Coordinator review, Student/Supervisor cancellation and appointment endings, Marks final/correction/reopening/completion windows/backup assignment, Timeline deletion and Workflow repair. Ordinary drafts/add/edit forms remain unchanged. Corrected stale Lecturer research guidance that still claimed a Coordinator research-review stage.

The confirmed Panel programme mismatch is resolved for approve/reject, queue/exact decision capabilities and Coordinator Panel closure using authoritative linked Student/profile agreement. Valid active official delegations remain; Office/assigned audit and legacy monitoring are preserved. No schema/dependency changes.

Fresh validation: 100 scoped backend tests pass, including 11 new programme/legacy/locked-recheck/lifecycle regressions; 140 frontend scripts pass. Final TypeScript, production build and 11 affected test scripts pass after removing duplicate JSX props. Independent review found two P2 gaps (closing/reopening clearing a conflict block; stale Office Marks actions after committed-save/reload failure); both were fixed and re-reviewed with no remaining finding in those deltas. Unit/rendering/source regressions cover duplicate prevention, save-vs-reload outcome, 403/409 latching and parent host stability. Django checks and migration dry-run pass with no changes; whitespace checks pass. Source Windows separator encoding was normalised only in task-edited files.

Live Coordinator Panel acceptance/rejection previews show the common dialog, required-reason gating, retained reason/Keep editing/discard, focus return and 320px fit (dialog left16/right288.8; document width305). Office appointment ending shows the same layout with Confirm your action, Student context, outcome and required reason; empty reason disables confirmation. Previews were closed without submitting. Lecturer has no current pending research requests, so its migrated review states are covered by rendering/controller tests rather than fabricated live academic records. Other migrated mutation outcomes are covered by tests/source review, not claimed as live end-to-end submissions. Proofs: C:/Users/User/AppData/Local/Temp/shared-decision-{approval,rejection,rejection-mobile,office-confirmation}-2026-10-15.png. API restarted at 127.0.0.1:8000 --noreload; app localhost:3001. No academic data changes, commit, push or cleanup.

## Decision-flow inspection and coordinator programme finding (2026-10-14, proposal only)

Inspected the five owned modules for decision UX. Current flows vary: immediate Coordinator primary approval; inline Lecturer primary/supporting and research decision forms; Panel acceptance modal with inline rejection; Marks submission/correction confirmations; Timeline deletion modal; Workflow repair preview plus inline reason/acknowledgement. Some dialogs close before the server outcome and success/navigation conventions vary. A reusable decision dialog/process built on the existing PortalModal/PortalConfirmModal is proposed, not implemented or approved. Preserve each workflow's business fields, reasons, acknowledgements, state/version checks and authorizations; ordinary draft saving should remain in-place.

Coordinator authorization verification: 21 isolated tests passed, including direct wrong-programme approve/reject attempts for primary, supporting and Panel requests, regular/delegated authority, delegation expiry/revocation and Supervisor-only research authority. An additional isolated programme-drift probe failed: when StudentResearchProfile.programme differs from the linked Student.programme, a Coordinator matching only the profile programme can approve a Panel recommendation (HTTP 200; expected 403). Panel access checks in appointments/views.py currently use the profile programme; primary/supporting decisions use the Student programme. This is a confirmed unresolved authorization/data-consistency edge case. Proposed correction: validate the linked Student's authoritative programme and fail closed on profile mismatch, including queue/detail/action paths, with intentional transfer-stage and legacy/unlinked handling specified separately. Active official coordinator delegations remain an existing explicit exception; do not remove them silently. No production academic decisions or application-code changes were made. Only this inspection/status note was added.

## Approved hierarchy restored and all role views checked (2026-10-14, verified)

After explicit user approval, restored semibold labels and emphasized person names while keeping ordinary values/narrative regular. Section/disclosure headings are larger than labels. The shared Lecturer/Coordinator/Office supervision layout and Student My supervisors use this hierarchy; existing role-authorized actions remain. The prior claim that reducing most weights was sufficient is superseded.

Fresh verification: all 133 frontend test scripts, TypeScript and production build pass. Live Lecturer, Coordinator and Office Staff viewed E2E-STUDENT-20261010; all 36 common text/style entries (font, size, weight, colour and line height) matched with zero mismatches. Office/Coordinator match all 37 visible entries including their shared history heading; expanded Office/Coordinator profiles match all 45 entries, and all 44 shared expanded Lecturer entries match with zero mismatches. Demo Student My supervisors also confirms 16px/600 section heading, 14px/600 Supervisor name, 12px/600 labels and 12px/400 values/narrative. Expanded Office and Student layouts fit at 320px (document width 305px; member/profile right edge 264px); viewport reset. Saved previews: C:/Users/User/AppData/Local/Temp/supervision-hierarchy-{lecturer,coordinator,office,student}-2026-10-14.png. These are live role checks, superseding the earlier Lecturer-only evidence. This change is presentation-only; no backend suite rerun, academic decisions, commit or push.

## Supervision detail spacing and font-weight correction (2026-10-14, verified)

The user rejected the previous compact Panel/context presentation; its visual-consistency claim is superseded here. Primary Supervisor and Panel now share the same member heading, status placement and typography. Student facts, Panel facts, research narrative and appointment-record values use regular weight; names/headings use semibold and labels medium. Increased outer/member padding and section gaps, moved supporting nomination into the action area, matched adjacent card heights and grouped generously spaced disclosure rows. All role hosts continue to render the shared detail components with existing permissions.

Validation: all 133 frontend test scripts passed, TypeScript and production build passed. Live Lecturer computed styles confirm matching Inter 14px/600 Supervisor and Panel names and 12px/400 Panel facts, expanded research narrative and appointment-record values. At 320px, both member cards remain inside the page (left 40.8/right 264; document width 305); viewport restored. Corrected desktop preview: C:/Users/User/AppData/Local/Temp/supervision-spacing-weight-corrected-2026-10-14.png. Office/Coordinator consistency is covered by shared rendering tests, not claimed as fresh live browser checks. No backend tests rerun for this visual-only correction, academic decisions, dependencies, commit or push.

## Staff supervision Panel/context improvements (2026-10-14, verified)

Implemented the approved plan after three critiques: move record navigation into the header, expose Student email directly and show current Panel information with backend-derived recommendation/replacement controls. Exact staff team responses add Panel/contact context, and shared rendering retains the current Panel during a pending replacement. Student projections stay unchanged; existing recommendation-detail authorization is shared by the new link capability. Detail and replacement-form Back navigation preserve supervision return context. Replacement forms identify the operation as Panel replacement rather than Recommendation needed.

Validation: 54 supervision/Office/Coordinator backend cases and 39 Panel workflow cases pass (93 scoped cases). All 133 frontend scripts passed; later Back-label/form refinements additionally pass affected navigation, Panel, record and candidate tests. Final TypeScript/build and whitespace checks pass; Django checks and migration dry-run pass with no schema changes. Regressions cover no Panel, confirmed, pending and replacement states, current/ended separation, staff payload equivalence, supporting/Student privacy and action placement. Live Demo Supervisor supervision shows the confirmed Panel, visible Student email, upper-right record action and Replace Panel with no Recommend Panel. Panel details and the replacement form both return to the same supervision record without submitting a nomination. At 320px the Panel block remains within the card (left 37/right 268; document width 305px); viewport reset. Desktop preview is C:/Users/User/AppData/Local/Temp/supervision-panel-lecturer-2026-10-14.png; a mobile screenshot capture failed, so responsive evidence is the live DOM/layout check. Office/Coordinator payloads/actions and pending-replacement cases were verified through fixtures, not claimed as live browser acceptance. API restarted at 127.0.0.1:8000; portal remains localhost:3001. No academic decisions, schema/dependency changes, commit or push.

## Student My supervisors research profile (2026-10-14, verified)

Removed the overview-only gate that hid the Student's already-fetched current research profile. My supervisors now keeps the current title visible and shows programme/area/abstract in a collapsed disclosure inside the same card, with shared field/body typography. A routed regression fails before the fix and verifies the profile, initial collapse and no invented empty profile or other-student content. Existing research pages/actions and privacy retained.

Validation: five affected frontend test scripts, TypeScript, production build and whitespace checks pass. Live Demo Student My supervisors starts with the profile collapsed; expanding shows the existing current programme, area and abstract. At 320px the expanded profile remains inside the card (left 37/right 268; document width 305px), with no horizontal overflow; viewport reset. Previews are C:/Users/User/AppData/Local/Temp/student-my-supervisors-research-profile-2026-10-14.png and the matching mobile file. No backend/schema/dependency change, academic decision, commit or push; a fresh full backend/frontend suite is not claimed for this presentation-only change.

## Lecturer dashboard backend counts (2026-10-14, verified)

The three cards already called Django but displayed pending requests/reviews under active-assignment headings. Added scoped active supervision/Panel counts and an assigned evaluation-task total to the existing summary API, corrected card metrics/wording, kept pending/incomplete badges, added loading/error/Retry and return-to-focus reload, and routed View supervisees to the roster. Regression tests reproduce absent API fields and cover active/ended appointments, supporting roles, evaluator isolation, submitted/inactive tasks and frontend loading/error/zero semantics. Existing work preserved.

Validation: all 12 dashboard backend tests and 132 frontend scripts pass; TypeScript, production build, Django checks and whitespace checks pass. Live Demo Supervisor dashboard matches read-only database counts: five supervisees, zero Panel assignments and zero Marks tasks. View supervisees opens the five-student roster; Panel and Marks links open matching empty assignment views, and returning reloads the summary. At 320px, all cards remain within the page (left 16/right 289; document width 305px); viewport reset. Preview: C:/Users/User/AppData/Local/Temp/lecturer-dashboard-backend-counts-2026-10-14.png and matching mobile preview. The local API was restarted at 127.0.0.1:8000 to load the changes; portal remains localhost:3001. No schema/dependency change or academic decisions, commit or push. Live error/Retry and nonzero Panel/Marks states are covered by rendering/backend fixtures, not claimed as browser acceptance.

## Supervisor detail feedback correction (2026-10-14, verified)

User screenshots showed that the earlier completion report overstated visual consistency. Removed crowded reference/copy metadata, raw audit enum codes, Not applied filler and repeated missing-history placeholders. Office and Coordinator now use one appointment-record renderer; Office/Coordinator/Lecturer use one exact-student supervision layout with role-authorized actions, contact and audit information. Primary and research-change cards share emphasized summary facts and regular-weight research narrative. View research profile is at the upper right inside the summary header and wraps on mobile. Fixed the live Lecturer Active status mismatch and validate the current appointment identity before using roster context. The preceding implementation report is superseded by this correction.

Final validation: all 131 frontend scripts, TypeScript, production build and whitespace checks pass after the final changes. Rendering regressions cover role equivalence, readable audit, missing history, typography, profile action placement/busy state and Lecturer active/context identity. Live read-only checks verify the same student in Office/Coordinator/Lecturer supervision; primary and research abstracts have identical computed Inter/12px/400 weight/19.5px line-height/colour. Lecturer and Office research cards show one upper-right profile action. A 320px check shows no horizontal overflow (document width 305px); viewport reset and Office session restored. No academic decision made, backend/schema/dependency change for this correction, commit/push or final independent clearance claimed.

Corrected previews are outside the repository in `C:/Users/User/AppData/Local/Temp/`: `supervisor-detail-corrected-research-2026-10-14.png`, `supervisor-detail-corrected-office-research-2026-10-14.png`, `supervisor-detail-corrected-mobile-2026-10-14.png`, `supervisor-corrected-primary-typography-2026-10-14.png` and the Office/Coordinator/Lecturer `supervisor-corrected-*-supervision-2026-10-14.png` files. Older previews below do not represent the corrected UI.

## Shared Supervisor record details (2026-10-14, initial implementation; superseded above)

Implemented shared header metadata, primary/replacement content, supporting request sections, immutable research comparisons, factual approval progress and collapsed audit. Same primary renderer now serves Student, Lecturer, Programme Coordinator and Office; research/transfer detail headings identify the actual kind. Authorized supporting/historical views share sections and audit, while appointment lifecycle/admin fields stay separate. Unknown historical stages/actors/times remain Not recorded, legacy research review is explicitly historical, and visible final actor/time is not repeated at Outcome. All Supervisor page/API families were reviewed and documented in the spec inventory; specialized forms, lists, team summaries and tools retain their existing purpose and permissions. Panel migration remains deferred.

Validation: all 130 frontend test scripts pass, TypeScript and production build pass, and whitespace checks pass. All 52 scoped Coordinator/Office workspace, Student cancellation-visibility and research amendment backend tests pass. Live read-only primary detail verified for all four roles; Office pending/approved research shows immutable comparisons and the appropriate current/historical stages. Copy-reference feedback, collapsed audit open/close, History return and 320px research layout verified; no horizontal overflow, viewport reset. Coordinator lifecycle is separate, with one student-record action and one metadata block. Supporting/history terminal states, capabilities, missing audit details, independent request/lifecycle statuses and cross-midnight Malaysia dates have automated coverage. Initial independent review found coarse Office stage inference and absent legacy ending-date fallback; both were reproduced and fixed. The independent reviewer hit the account usage limit before final clearance; integration review and verification were completed by the primary agent. No academic records were mutated; no dependency/schema/backend change for this refactor, commit or push.

Previews are saved outside the repository: `C:/Users/User/AppData/Local/Temp/supervisor-research-detail-2026-10-14.png` and `supervisor-research-mobile-2026-10-14.png` in the same directory. Spec and plan: `docs/superpowers/specs/2026-10-14-supervisor-shared-record-details.md` and its matching plan.

## Waiting-column final outcomes (2026-10-14, complete)

Replaced final-state dashes across all Waiting at this stage tables with explicit Completed/Cancelled/Rejected and corresponding lifecycle labels through a shared raw-status formatter. Ongoing calendar days, including zero, and missing timing semantics retained; stale final ages suppressed. Shared row adapters pass workflow status separately from Current stage text. Student history regression failed on the old dash behavior before implementation. All 12 affected utility/component scripts, TypeScript, production build and whitespace checks pass. Independent review confirms coverage of all tables with this column and no actionable issues. Live read-only Office history shows Completed for approved requests and Rejected for rejected requests; cancellation variants are covered by fixtures. No backend, dependency, schema or academic data changes, commits or pushes.

## Office Tools visual polish (2026-10-14, complete)

Refined only the Office Tools dropdown with subtle icons, aligned text, consistent row spacing, a quieter divider and a slightly wider viewport-clamped menu. Existing destinations and interactions retained. Requirements reviewed: no feature/business-rule changes. Existing OfficeSupervisorTools rendering/positioning test and TypeScript pass. Live desktop and 320px checks confirm readable rows and no horizontal overflow (305px page width, menu left 16/right 289); viewport reset and preview saved outside the repository. No dependencies, workflow changes, commits or pushes.

## Owned-module controls and supervision exports (2026-10-14, complete)

Implemented the contextual-tools approach approved after comparing three alternatives. Removed manual Refresh controls across all five owned modules/roles and secondary governed surfaces, retaining mutation reloads, error Retry and guarded return-to-focus loads. Office Tools separates described Monitoring and Configuration destinations; Capacity reassessments stays separate. Team and selected lecturer card headers export complete filtered XLSX lecturer assignments and full active student teams. Existing attention/request/history CSV exports remain.

Validation: all 124 frontend test scripts pass under bundled Node 24; TypeScript and production build pass. All 44 supervision-export and existing Office/Coordinator workspace backend tests pass, covering role/delegation guards, current primary/supporting teams, pending/ended exclusion, 28-record exports beyond UI pages, bounded queries, filtering and literal spreadsheet text. Django checks, migration dry-run (no changes) and whitespace checks pass. Independent review reproduced a lecturer-name search mismatch with semester/role/date/selected-supervisor filters; eight failing cases were fixed through shared filtered relationship eligibility and follow-up review is clear.

Live read-only Office checks verified grouped tools, full and lecturer-specific Excel downloads (five confirmed demo relationships), and programme-filtered download (three relationships/teams checked in both workbook sheets). At 320px the export button and described menu stay within the page width; temporary viewport reset. Preview screenshots saved outside the repository. Existing branch work preserved; no new dependency/schema migration, live academic decisions, commits or pushes. Development API restarted to load final backend changes at 127.0.0.1:8000; portal remains localhost:3001. Full backend suite and large-scale memory benchmarks are not claimed.

## Office Supervisor attention redesign (2026-10-13, complete)

Implemented the approved five-pass design after the final critical review: Office Needs attention is the landing page, with three distinct category counts/tables, a dedicated Appointment requests route and preserved Supervisory teams. New Office-only projections identify eligible students without active primary supervision (including never-applied students), pending primary/supporting/research/transfer requests by current reviewer and stage age, and current-semester capacity concerns. Secondary More tools replaces Records administration while retaining profiles, corrections/transfers, workload, requirements and the field-compatible full export. Category/request/history exports collect all matching pages. Capacity reassessments and other roles stay unchanged.

Validation: all 17 new backend attention cases pass; final affected Office/Coordinator/research browse suite passes 59 cases, with 116 broader workflow/read regressions passing before the final date/facet additions. All 18 affected frontend scripts pass under bundled Node 24, including CSV/export safety, navigation, role rendering, lazy routes and production security. TypeScript and production build pass; Django checks, migration dry-run (no changes) and whitespace checks pass. Independent review clear after reproducing and fixing a narrow-phone tools-menu clipping issue. Mixed request date/type-facet gaps, wrong endorsement wording and candidate/current-reviewer ambiguity were also resolved and covered by regressions.

Live read-only Office verification confirms real missing-supervisor and capacity records, global counts with distinct units, category tables/filters, dossier/research/workload return context, selected lecturer workload focus, dedicated requests and document-tool return, waiting date filtering/reset, and an actual matching-student CSV download. Mobile category/table layout and menu checked at 320/390px; 320px document scroll width equals viewport width, and menu is clamped within 16px margins. Temporary viewport reset. Multi-page, supporting, pending-primary and transfer cases use fixtures rather than live academic mutations. Large-scale benchmarks are not claimed. Development servers restarted at portal localhost:3001 / API127.0.0.1:8000 and preview saved outside repo. Root documents/handoff updated and earlier uncommitted work preserved. No live academic decisions, commits or pushes.

## Staff research navigation (2026-10-13)

Implemented interim Coordinator Programme transfers navigation with transfer-only Requests/History and normalized saved/Next filters. Office has two main tabs and a secondary Research records tool retaining monitoring, history, profiles, correction/transfer forms and originating return context. Student/Lecturer navigation and capacity behavior remain. Corrected stale primary Supervisor research-decision subtitle. Registry relocation and larger Office attention/Overview redesign remain deferred.

All nine affected frontend scripts pass, including saved-filter/Next-query and mixed research/transfer status regressions. TypeScript, production build and both production security scripts pass; 24 existing research paging/workflow backend regressions pass. Independent review identified the mixed status-facets issue, reproduced before fixing; follow-up review reports no remaining actionable issues. Live read-only Office checks confirm two main tabs, secondary Research records monitoring/history, exact-detail returns, profile/student selection and correction/transfer form access. Coordinator transfer Requests/History and Clear filters render correctly; demo has no populated transfer cases, which remain covered by automated tests. Preview saved outside the repo. Root requirements/design/status updated. No live academic decisions, commits or pushes.

## Supervisor Appointments continuation handoff (2026-10-13)

Prepared docs/SUPERVISOR_APPOINTMENTS_HANDOFF_2026-10-13.md with current branch/working-tree state, final shared navigation/table conventions, changes and permission differences for Student/Lecturer/Coordinator/Office, latest Supervisor-only research and manual course-code rules, source/API map, recorded validation, pending Registry transfer proposal and a next-session prompt. Inspection found a stale new-research subtitle describing Coordinator final approval; it is flagged for follow-up rather than changed by this documentation task. Prior test results are clearly identified as historical; no new runtime changes, academic mutations, commits or pushes were made.

## Programme-transfer handoff prepared (2026-10-13)

Prepared docs/PROGRAMME_TRANSFER_HANDOFF_2026-10-13.md for the recorded Registry owner, Xiang. Recommendation puts enrolment changes in Student Registry while preserving Supervisor-owned research changes and appointment integrations. Inspected the existing form, Registry integrity guard, backend authorization/atomic updates, API, routes and transfer regressions. The document includes the proposed journey, ownership boundary, implementation sequence, compatibility obligations, acceptance checks and a ready-to-share note. Ownership acceptance and implementation remain pending; no runtime code, database, server, commit/push or external message changes were made for this handoff.

## Latest main merged and development servers running (2026-10-13)

Fast-forwarded codex/portal-consistency-and-toast to latest main 93049a2 and restored all 72 previously modified/untracked files. All 67 files outside incoming main's changes retain their saved contents; the single PROJECT_STATUS.md conflict preserves both histories. An external backup and safety stash e5057e0d5ce5b4954c80fa738a181d8825757934 remain available. Independent integration review found no actionable defects or missing work. Updated one incoming rendering assertion from Endorse request to Approve request to match the approved Supervisor-only research decision.

Installed the declared python-docx dependency and successfully applied incoming accounts, announcements and letters migrations. All 172 backend integration tests and all 118 frontend test scripts pass. TypeScript, production build/security guards, Django system checks and pip dependency checks pass. Live read-only Office dashboard and Supervisor Appointments navigation work, the portal returns HTTP 200, and the proxied authentication endpoint returns the expected unauthenticated HTTP 401.

No existing FSKTM server processes were found. Both project servers are now running in managed terminal sessions: portal http://localhost:3001 and Django API http://127.0.0.1:8000. The unrelated Docker application on port 3000 remains running. Local work remains uncommitted and unpushed; no live academic decisions were submitted.

## Supervisor-only research changes (2026-10-13, complete)

Implemented primary Supervisor-only final approve/reject decisions for title/abstract research changes. Approval applies the profile revision atomically and preserves the original application; Coordinator decision queues exclude research requests. Legacy research PENDING_COORDINATOR storage/history remains intact while current review, filters, dashboard ageing and report status point to Supervisor. Real legacy endorsement preservation and raw expected-status mismatch are tested; no automatic approvals occur. Transfers retain both Coordinator stages. Review caught and resolved old Endorse confirmation wording and legacy Coordinator report labels; re-review has no remaining actionable findings. All 53 affected backend regressions pass, including concurrency, lifecycle, paging, reports and withdrawal visibility. All 106 frontend scripts pass, and the strengthened affected rendering test was rerun after the final wording fixes. Final TypeScript/build/security guards, Django checks/migration dry-run and whitespace checks pass. No schema migration or live academic decision was required; no local legacy research requests awaited Coordinator. Existing uncommitted work is preserved; no commits or pushes were made. Live browser acceptance is not claimed.


## Manual course-code implementation (2026-10-13, complete)

Completed five critical plan-review passes and implemented the optional Course code(s) field, API/multipart persistence, editable replacement prefill, course-only dirty-draft protection and exact Student/Supervisor/Coordinator/Office record display. No mappings, allowlists, new approval stages or evidence requirements were added. Six focused API regressions pass after reproducing missing persistence/validation; all 109 affected backend cases pass. All 106 frontend scripts pass; the strengthened Student conversion check was rerun successfully after the suite. TypeScript, production build/security guards, Django system/migration checks and whitespace checks pass. Migration appointments.0016 is applied locally; existing application count is unchanged and historical course values are blank. Independent review against a preserved pre-task baseline found no actionable defects. Live browser acceptance was not verified: initial automation timed out and the retry reached a different service at localhost:3000. Existing uncommitted work is preserved; no commits/pushes or live academic decisions were made.


## Supervisor appointment form inspection and plan (2026-10-13)

Inspected both pages of the received blank `TD(IT):FSK29` PDF using text extraction and visual rendering; compared Sections A/B/C with current models, submission/review pages, private-document validation, atomic approval/profile handoff and research-amendment history. Saved the review/design and staged implementation plan under `docs/superpowers/specs/2026-10-13-supervisor-appointment-form-review.md` and `docs/superpowers/plans/2026-10-13-supervisor-appointment-form-alignment.md`.

User confirmed the existing approval process is sufficient: retain Student -> Supervisor -> Programme Coordinator and exclude Dean sign-off and extra approval stages. Latest feedback simplifies course code(s) to Student-entered text without programme mappings and removes separate title-confirmation work and additional proposal/results evidence requirements. Existing acceptance, research amendments and configured uploads remain unchanged. Identity/contact snapshots, Office metadata and print output are optional later suggestions; the provisional form/layout remains unresolved. At the initial review stage, no application code, migrations, runtime policy, live academic records, commits or pushes were changed, and verification was limited to source/PDF and documentation review. The subsequent authorized implementation and verification are recorded above; existing uncommitted work remains preserved.

## Fresh local Student test account (2026-10-13)

Created one active synthetic Student account in the local development database for fresh workflow testing, using the current semester and Cyber Security coursework programme. No supervisor, research profile or requests were prepopulated. Verified successful login through the authentication endpoint and the Student role. Credentials are excluded from repository documentation. Existing requirements and architecture remain applicable; no application code changes were needed.

## Office Supervisor structure alignment (2026-10-13)

Implemented shared Coordinator-style Office request/history filters and tables, supervisor-first teams with student search and Past appointments, paged monitoring for appointment/research lists, separate capacity/admin tools and exact details. Retained Office capacity authority, supporting cancellation, lifecycle ending, workload, exports, no-supervisor records, requirements and research correction/transfer access. Targeted primary details preserve contact/workload/approval fields. Legacy notification keys remain supported; administration rows now open their exact application identity.

Review caught and resolved stale record actions on identity changes, an inaccessible profile creation launcher and nullable legacy Panel carryover serialization. Profile rendering and legacy Panel crash were reproduced before fixes; all 42 staff browse/research backend tests pass afterward, alongside 65 broader workflow/capacity/cancellation/delegation checks. All 106 frontend scripts pass; affected Office/role/lazy-route tests, TypeScript and production build were rerun after the final record-link refinement. Production security guards, Django checks, migration dry-run (no changes) and whitespace checks pass. Follow-up review found no remaining important issues.

Live Office checks cover history search/page-size return, exact details and lifecycle controls, student search through supervisor drilldown, workload/requirements returning to administration, enabled exports, separate capacity browse, upstream research monitoring with no approval button, correction/transfer form preserving the chosen Student, and desktop/mobile layouts. No horizontal overflow at 390px; temporary viewport reset and Office preview images saved outside the repo. Populated supporting/carryover/large-page cases use fixtures rather than live academic mutations. No commits or pushes.

## Coordinator browse presentation corrections (2026-10-13)

Removed More filters and focus selectors from Coordinator appointment/research lists, enforced decision-only service queries against stale All ongoing state, exposed filters in a consistent grid and aligned Clear filters. Renamed appointment lifecycle history to Past appointments. Following UI review, moved its light switch outside the card and removed the grouping dropdown; teams always group by supervisor, with student search retained through drilldown.

Focused Coordinator/render/API/queue/lazy-route and existing research/role tests pass. TypeScript and production build pass. Browser confirms visible shared request fields, appointment Clear filters resetting search/dates and student matric search carrying into View students. Live research Clear filters also resets URL/search/dates together. Final teams and research controls have no horizontal overflow at 390px; temporary viewport reset. Desktop preview saved outside the repository. Root docs and the active design updated. No commits, pushes or academic decisions.

## Coordinator Supervisor workspace efficiency (2026-10-13)

Implemented Coordinator-only server-paged appointment/research requests and history, shared filter controls, supervisor-first groups and paged student drilldown, By student alternative, separate ended appointment history and dedicated read-only capacity tool. Reused existing record/decision controls and fonts; preserved source filters/page selection, scope/delegations, Student withdrawal hiding and all other roles. Review refinements fixed relationship count/drilldown mismatches, history date inconsistencies, stale Next targets and incompatible research view filters. Live verification caught and fixed consecutive URL filter writes discarding focus changes.

Validation: 115 broader backend regressions passed before the final relationship/date refinements; all 34 Coordinator workspace/research regressions passed afterward, including two reproduced failing cases. All 105 frontend scripts, TypeScript, production build and production security checks passed again after the final shared-control refinement. Django check, migration dry-run (no changes) and whitespace check passed. Live read-only Coordinator checks confirm grouped supervisor/student browsing, detail return, history search and restored page size, secondary capacity navigation and research focus controls. Mobile 390px team layout has no horizontal overflow; temporary viewport reset and desktop/mobile previews saved outside the repository. Large multi-page, ended/supporting and research decision datasets are covered by fixtures rather than live demo records. No academic decisions, commits or pushes.

## Student cancellations in staff histories (2026-10-12)

Implemented shared backend exclusion of Student-withdrawn supervisor/research requests from routine staff histories, Office records, dossiers and reports/exports. Preserved Student history, Office/system cancellation outcomes, authorised audit detail and database events. Added failing-then-passing regressions for both workflows and all staff roles; expanded checks cover dossiers, workbook exports and counts. All 75 affected backend regressions pass; the focused two-workflow visibility suite was rerun after adding staff/Student supervisory-team activity checks and passes. Tests cover all staff roles, Student history, Office/system cancellation preservation, dossier/workbook/count consistency and unchanged audit scope. Django check, migration dry-run (no changes) and whitespace checks pass. No live workflow mutations or data deletions; changes remain uncommitted.

## Student research summary layout (2026-10-12)

Reworked the Student Current research profile summary to give the research title priority and group actions consistently. Wide screens align actions to the right; smaller screens place them below. Pending guidance stays with profile information. Existing research-view regressions, TypeScript and whitespace checks pass. Live Student verification at 1440px confirms actions beside the information; at 390px actions follow the text with no horizontal overflow. Pending submission restrictions preserved. Preview saved outside the repository and temporary viewport reset. Changes remain uncommitted.

## Panel review rejection field (2026-10-12)

Hidden rejection reason until Reject is selected; added Confirm rejection/Cancel and a brief acceptance confirmation. Initial neutral/read-only/busy rendering regression reproduced the premature field before the fix. Targeted neutral/read-only/busy regression, TypeScript and production build pass. Live Demo Panel Lecturer verification covered Reject revealing the required reason, valid text enabling confirmation, Cancel clearing the draft, reopening with an empty reason and Accept displaying a reason-free confirmation. All dialogs/drafts cancelled without submitting decisions; neutral preview saved outside the repository. All 102 frontend test scripts and both production security guards pass; this and the previous candidate selection change remain uncommitted.

## Panel candidate selection clarity (2026-10-12)

Removed implicit first-eligible selection; added explicit Selected panel member confirmation and Remove selection. Search remains separate from selection; notes survive removal; submission stays blocked without a valid candidate. Initial-state rendering regression reproduced auto-selection before the fix. Initial-state, panel workflow and record-page regressions, TypeScript, production build and whitespace checks pass. Live Lecturer verification covered empty initial state, explicit selection, notes enabling submission and removal retaining notes while blocking submission. Preview saved outside the repository; verification draft and selection cleared without submitting an academic recommendation. Changes remain uncommitted.

## File Management: All 8 Phases (2026-10-14 to 2026-10-15)

Following the supervisor's direction of 2026-10-14 (plan: `docs/superpowers/plans/2026-10-14-file-management-module.md`). Not built yet: supervisor application files in a student's view (waiting for Wey Cheng's agreement) and the optional links from a file to an appointment or letter.

- **Uploads (Phase 1, `379892c`).**
  - Students upload their own forms, thesis, letters and so on. The office, lecturers, panel members and coordinators upload files about their students, or staff files about no student.
  - Every upload is checked: PDF, Word, Excel, PowerPoint and image contents, macros, hidden extensions, 10 MB, and duplicates.
  - Files are tagged by student and by keyword, and found by student name, student ID, title, tag or reference.
  - Who sees a file follows real relationships: supervisors, panel members and programme coordinators, ticked per type and per file. Students see only their own uploads.
- **Screens (Phase 2, `dd6aa7e`).** Files for staff (All files, Staff files, one student's files), the file page, both upload screens, and File Submission for students with their approved letters.
- **Preview and ZIP (Phase 3, `0cec8ae`).** PDF pages and images are drawn on the server, so previews work under the production security policy. Several files download as one ZIP.
- **Checking (Phase 4, `f9f96ea`).**
  - For types the office checks, uploads wait in "To check". The office accepts, or returns with a reason.
  - The student sees the reason under To do, and uploads a corrected file as a new version. A second upload of a one-per-student type offers to become a new version.
  - Uploaders and the office edit the title, tags and note; every change is kept in the history.
  - Notices go out in the app, and by email when "Email alerts" is on.
- **File settings (Phase 5, `4a8df87`).**
  - The office opens Settings from Files. It changes, for each document type: who can upload it, who can see it, whether the office checks it, and whether it can still be chosen. It can also add new types.
  - New sharing reaches files students already uploaded, while what staff chose when uploading stays. The screen says how many files a change touches before saving.
  - A Tags tab renames, merges and removes tags. Renaming to an existing tag offers to merge.
  - On a file's page, the office or the staff uploader changes who can see it, and people who can newly see it are told.
  - Changes to types and tags are kept in a settings history.
- **Archive and history (Phase 6, `5bc3095`).**
  - The office archives a file with a reason (quick reasons offered) instead of deleting someone else's upload. Archived files disappear for everyone but the office, are listed under More filters (Show: Archived files), and can be restored.
  - File settings has a History tab: uploads, changes, checks, archiving, deleted files (with who they were about), opens and downloads, and settings changes, with one Show choice and a search box.
  - Each file page shows its own history to the office.
  - `manage.py check_document_storage` reports missing and left-over stored files; `--remove-orphans` deletes left-overs more than an hour old.
- **Required documents (Phase 7, `429a5c9`).**
  - In File settings the office turns on "Every student must hand it in" for a type, with an optional due note and, if needed, only chosen programmes (Xiang's choice on 2026-10-15). Only Active students count, and a required type must be one students can upload.
  - Students see what they still owe under To do, with an Upload button that opens the upload screen with the type chosen.
  - A Required documents tab in Files shows the office and programme coordinators (their programmes only) how many students have handed in, are waiting for a check, or still owe it; names on request, and a returned file counts as still owed.
  - The office presses Remind at most once a day per type: a notice in the app, and an email for students with "Deadline reminders" on.
  - A student's header in Files shows their required documents.
  - Migration `documents.0004`, after the backup `db-backups/fsktm_pg_office_before_required_documents_2026-10-15.dump`.
- **Wrap-up (Phase 8, `c09e257`).**
  - My Profile lists the files a student uploaded (type, status, date) instead of "Available when File Management is released".
  - A student's record in the Registry has a "View files" link to that student's files.
  - Notices open the right place: a file notice opens the file, a reminder opens the upload screen with the type chosen.
  - The backend README describes the File Management endpoints, access rules, upload checks and `check_document_storage`.
- **Migrations** `documents.0001` to `documents.0003`. The dev DB was migrated after the backups `db-backups/fsktm_pg_office_before_documents_2026-10-14.dump` and `db-backups/fsktm_pg_office_before_document_settings_2026-10-14.dump`.
- **Verification.**
  - The backend passes 1142 tests.
  - All 116 frontend scripts pass, along with lint, the build and the production security tests.
  - Browser checks on private servers:
    - screens, preview and ZIP: 23 of 23;
    - previews under the enforced security policy: 10 of 10;
    - checking and versions: 12 of 12;
    - file settings, sharing and tags, including a phone: 20 of 20;
    - archive, restore and history, including a phone: 11 of 11;
    - required documents, including a phone: 15 of 15. Remind was answered inside the browser, because the dev database has demo students in every programme; sending is covered by the backend tests;
    - My Profile files and the Registry link: 4 of 4.
  - All smoke accounts, files, notices, tags and types were removed afterwards.

## Letters: Requests Approved By The Office (2026-10-13)

Following the supervisor meeting (plan: `docs/superpowers/plans/2026-10-13-letter-requests-with-office-approval.md`).

- **Students request, the office decides.**
  - Students no longer get letters straight away, and never see a letter's wording before approval (the template API hides it from them).
  - A student chooses a letter by name and description, adds an optional note, and sends a request.
  - The office reviews it on its own page (`/letters/requests/<id>`, also opened from the bell). It fills in what the portal does not hold, checks a live A4 preview, then approves (which issues the reference number and date) or rejects with a reason.
  - The student is notified in the app, and by email when "Email alerts" is on.
  - Once approved, the student can view, print or download the letter.
  - After a rejection the student sees the reason and can request again. A pending request can be withdrawn.
- **Office-filled fields.**
  - Templates can define fields such as `{{ATTENDANCE}}` ("Attendance (%)"), added in the template editor's Office-Filled Fields panel.
  - The office types them in when approving.
  - Any record field the student's record leaves blank (for example a passport number) is also typed in at approval, for that letter only.
- **Rules.**
  - One pending request per letter per student, enforced by a database constraint.
  - Approval is refused once the student is no longer Active.
  - A template with pending requests cannot be deleted (archive it instead).
  - Only issued letters can be downloaded, resent or revoked.
- **Migration** `letters.0004` (dev DB migrated after the backup `db-backups/before-letter-requests-2026-10-13.dump`). Existing letters keep their status, number and wording.
- **Commits:** `a879c21` (data and templates), `ebf3dc1` (backend workflow), `facafed` (screens). The backend README describes the endpoints.
- **Verification.**
  - The backend passes 1057 tests.
  - All 113 frontend scripts pass, along with lint and the build.
  - The end-to-end browser check passed 26 of 26 on private servers:
    1. the office builds a template with an Attendance field;
    2. a student requests it;
    3. the office opens it from the bell, fills in the missing passport and the attendance, and approves;
    4. the student views it on A4 pages and downloads the PDF;
    5. a second request is rejected with a reason, requested again, then withdrawn.
  - Phone layouts were checked, and no console errors occurred.
  - All smoke data was removed, including the request notifications sent to other office accounts.

## Registry Import: Paste Rows Removed (2026-10-13)

- At Xiang's request the Bulk Import card is back to file upload only, as it was before `c49e6aa`: one File Upload card with the drag-and-drop box and the template buttons. The Upload/Paste toggle, the paste box and `pastedRowsFile` are gone, and the guideline reads "CSV or XLSX".
- Kept from `c49e6aa`: an uploaded file with no column-name row still works ("No column names" on the Match step, columns matched from their values). The backend is unchanged.
- Two sample files for trying the import live outside the repo in `Final Year Project/test-data/registry-import/`. Both hold 5 made-up students with `@example.com` emails, so nobody can receive their activation emails.
  - "Sample 1 - Excel template" is filled in the system's template and goes straight to the row check.
  - "Sample 2 - Office extract style" has title rows, Malay column names, extra columns, Student IDs ending in `/1` and programmes spelt several ways ("MDS", "Sarjana Keselamatan Siber"). It goes through Match columns and the programme choices.
- Lint, the build and all 112 frontend scripts pass. A browser check passed 7 of 7: the card, and both sample files previewing (nothing imported).

## Announcements List Redesign (2026-10-13)

- **Frontend only** (`00e115c`). The backend, the API calls and the composer are unchanged.
- **Layout.** It follows common web patterns (Stripe-style count tiles, a Mailchimp-style status filter, a Canvas-style search and newest-first list) built from the portal's own cards, badges, filter menus and pager.
  - Live, Scheduled, Drafts and Expired tiles show counts, and pressing one filters the list.
  - A search box plus Status, Audience and Priority filters, with Clear.
  - Each row shows a priority edge as in the recipients' feed, status and priority badges, a two-line preview, and the audience, timing, author and attachment.
- **Drafts** now appear in the list as well as under the composer.
- **Actions.** Edit and Remove use the same handlers as before. Remove still asks for confirmation, and Expired rows still offer Remove only.
- **Move to drafts removed** at Xiang's request, from the list and from the edit page.
  - It pulled a published announcement out of recipients' feeds, but emails already sent stayed, and publishing it again emailed everyone a second time.
  - Editing a published or scheduled announcement now offers only its save button (Save & Keep Published, Reschedule, Save Schedule or Publish Now). New announcements and drafts can still be saved as drafts.
  - To take an announcement down, Remove it. The backend still accepts a status change back to Draft; only the buttons are gone.
- **Expires At removed** at Xiang's request. Recipients kept expired announcements in their feed anyway, so the end time only relabelled the office's own list.
  - The composer has Publish At only. Saving, or publishing a draft from the composer's draft list, sends no end time and clears any end time set before.
  - The list has three tiles (Live, Scheduled, Drafts) and no Expired filter. An announcement that had already expired still lists under All with its Expired badge and Remove only.
  - `scheduleProblem` (the client-side expiry check) is gone. The backend is unchanged and still supports `expiresAt` for older rows.
  - Checked in a browser (42 of 42 checks): the field and tile are gone, and saving cleared a stored end time in the database while the announcement stayed live.
- **Verification.** Lint, the build and all 112 frontend scripts pass. A browser check on a private server passed 32 of 32 checks at 390, 768, 1280 and 1440 wide:
  - the tiles, filters, search, empty state and pager;
  - a real edit and save, and Remove;
  - no Move to drafts anywhere, while drafts and new announcements keep their draft buttons.
  The test announcements were aimed at a made-up intake so nobody received them, and they were deleted afterwards.

## Sign-In, Profile Menu, Settings And Letter Download Fixes (2026-10-12)

- **Remember me** (`3b9a753`). Sign-in has "Remember me on this device", off by default.
  - Ticked, the refresh cookie lasts 7 days and survives closing the browser.
  - Unticked, the cookie ends with the browser, and the server ends the session 12 hours after its last use (`JWT_SESSION_REFRESH_HOURS`).
  - The choice travels in the refresh token, so refreshes and password changes keep it. Before this, every sign-in lasted 7 days, and the checkbox on `main` was not connected to anything.
  - Checked in a browser by closing and reopening it: unticked returns to sign-in, ticked stays signed in.
- **Forgot password** verified end to end on a private test server:
  - the email arrives with its link, and the link sets a new password;
  - the old password stops working and the new one signs in;
  - the link works once only, and the reset signs out a device that was already signed in;
  - an unknown email gets the same answer and no email.
  No code change was needed.
- **Notification preference switches** (`3f25c49`). The switch knob now sits in its track, so on and off read correctly. Each switch is named by its row title (also clickable) instead of repeating it. Saving and reloading keeps every choice.
- **Profile menu** (`a14465f`):
  - "My Records" is now "My Profile" at `/my-profile`.
  - The menu's My Profile opens it for students and Settings for staff; it no longer opens the helpdesk dialog.
  - The menu's Settings item now works, and Settings is no longer in the sidebar.
- **Letters download as PDF** (`2de34dd`). `GET /api/letters/requests/<id>/pdf/` replaces the Word download. It is built with `reportlab` in the printed layout, and locked against editing while printing and copying text stay allowed. This replaces the Word half of design decision D5. Run `pip install -r requirements.txt` for `reportlab` and `pypdf`.
- **Verification.** The backend passes 1039 tests and all 112 frontend scripts pass, along with lint and the build. Browser checks for each item passed, and all test data was removed.

## Registry Import: Excel Template, And The Plan Complete (2026-10-12)

- Phase 9 of the registry import plan (commit `42b6a76`). All nine phases are now built.
- **Excel template.** `GET /api/registry/students/import/template/` (Office only) gives an `.xlsx`:
  - a Students sheet with the import columns and a frozen header row;
  - Student ID and Phone formatted as text, so Excel keeps leading zeros;
  - Programme as a dropdown of the approved programmes, from a hidden Programmes sheet;
  - a "How to fill in" sheet with one column per row, so it is never read as the student list.
- "Download Excel Template" is the main button and "CSV Template" the second. The import guidelines now say the office can upload its own spreadsheet as it is or paste rows.
- **Design decision D8** (for the report): bulk import accepts the office's own spreadsheet, and the template is optional. UC04's precondition about the required template format no longer applies.
- **Still open:** P1 (a sample of the real Maya extract) and P2 (Student ID or matric number). Phase 7 was built on the P2 assumption.
- **Verification.** Backend: 1023 tests pass, 4 of them new in `test_registry_template.py`; no migration. Frontend: all 94 scripts, lint, the build and both production guards pass. The live browser run passed 5/5: download through the button, fill in, upload, and import. All test data was removed.

## Registry Import: Paste Rows From A Spreadsheet (2026-10-12)

- Phase 8 of the registry import plan (commit `c49e6aa`).
- **Paste rows.** The upload card has a "Paste rows" switch. Cells copied from Excel or Google Sheets are sent as `pasted-rows.csv` and go through the same steps as a file. Blank lines are dropped, and the 1,000-row limit is checked before sending.
- **Column names or not.**
  - "The first row is column names" is on by default.
  - Without names, every row is a student. The columns are matched from their values: emails, approved programme names, phone numbers, Student IDs and names.
  - A field gets a column only when exactly one column fits. Running numbers and MyKad numbers are never taken for Student IDs.
  - The Match step's "Column names are on" menu has a "No column names" choice for any file (`options.hasHeader`).
- **Verification.**
  - Backend: 1019 tests pass, 6 of them new in `test_registry_paste.py`. No migration.
  - Frontend: all 94 scripts pass, with paste helper tests and source checks. Lint, the build and both production guards pass.
  - The live browser run passed 10/11. The one miss was a timing race in the script: it read the page while the Match step still showed the same name as a sample. The rows themselves imported, as the next step and the cleanup count showed.
  - The run covered a paste with known column names going straight to checking rows, and a paste without names matched from its values, then imported. The paste box fits at 390 px. All test data was removed.

## Registry Import: Missing Emails Filled From The Student ID (2026-10-12)

- Phase 7 of the registry import plan (commit `9c7f1cb`). It was built on the plan's P2 assumption: the registry keeps the lifelong Student ID. Recheck it when the office answers P2.
- **Filled emails.** A blank or missing email becomes the student's SiswaMail address, `<Student ID>@siswa.um.edu.my` in lower case.
  - The domain is the new setting `REGISTRY_STUDENT_EMAIL_DOMAIN`, listed in `.env.example`.
  - It is on by default and can be turned off on the Match step, in a new "Student Emails And IDs" card.
  - The Email column is then not required. Its row reads "Filled", with an example address.
- **Marked everywhere.**
  - Each filled email shows on its row ("Email from Student ID: ...") and in a count chip.
  - The result panel lists "Emails filled from the Student ID", and the import report adds the note to Details.
  - Recent Imports counts them ("3 emails filled from Student ID").
  - Filled emails still go through the repeated-row and already-registered checks.
- **Student ID rule.** "Drop the programme number after "/" in Student IDs" is off by default. It turns `23004955/1` into `23004955` for both the ID and the filled email.
  - The card counts the IDs in the file that have a programme number.
  - Changed rows show "In the file: 23004955/1".
  - Two programme numbers of one student become one student, and the second is listed as repeated.
- **Edited rows** go back with the file's own Student ID and a blank email, so both choices still apply and stay marked, unless the office typed over them.
- No migration. Files imported without options behave exactly as before.
- **Verification.**
  - Backend: 1013 tests pass, 13 of them new in `test_registry_emails.py`. `makemigrations --check` finds no changes.
  - Frontend: all 94 scripts pass, with new helper tests and source checks. TypeScript lint, the production build and both production guards pass.
  - The live browser run passed 20/20. For safety, the server ran with `REGISTRY_STUDENT_EMAIL_DOMAIN=example.test` and the activation emails were held, so no message could reach a real SiswaMail address; the log confirmed none was sent. The file was a Maya-style workbook with no email column and two suffixed IDs. The run covered:
    - the Match card, the example address and the suffix count;
    - the rows, chips and marks;
    - an edited row keeping both marks;
    - the import result, the report and the Recent Imports count.
  - The database held the corrected IDs and filled emails. The card fits at 768 and 390 px without sideways scrolling. All test data was removed, and the server was restarted with the default domain.

## Registry Import: Column Matches Remembered For The Same Layout (2026-10-12)

- Phase 6 of the registry import plan (commit `c6483bc`).
- **Remembered matches.** A real import saves the column matches it was made with, against a SHA-256 of the file's normalised column names.
  - The model is `RegistryImportProfile` (migration `accounts.0013_registry_import_profile`), shared by the whole office.
  - Only the hash is kept, never the column names, since a mistaken header row could hold a student's details.
- **The next file with the same columns** opens at Match Columns with the saved matches and "Matched the same way as your import on 12 Oct 2026. Check the matches below before you continue."
  - "Use Suggested Matches" sets the saved matches aside for that file, also when its sheet or header row is changed.
  - A changed column list, or saved matches pointing past the file's columns, falls back to the suggestions.
  - Saved matches always show the Match step, so the office sees them before rows are checked. Our own template is never remembered.
- **Edited rows still count.** The inspect step returns a signed `layoutToken`, and the import sends it with the confirmed matches (`rememberLayout`). The matches are saved even when edited rows go back as a reviewed file in our own layout. A stale or foreign token saves nothing and never stops the import.
- **Database.** The dev database was migrated after a backup: `db-backups/fsktm_pg_office_before_registry_import_profile_2026-10-12.dump`.
- **Verification.**
  - Backend: 1000 tests pass, 11 of them new in `test_registry_profiles.py`. `makemigrations --check` finds no changes.
  - Frontend: all 94 scripts pass, with new source checks for the saved matches. TypeScript lint, the production build and both production guards pass.
  - A live browser run used temporary `smoke.import.*` accounts and three Maya-style workbooks with the same columns, and passed 14/14. It covered:
    - the first import with Phone left out;
    - the second file opening with that choice and the dated note;
    - "Use Suggested Matches", which stayed set aside after re-reading the header row;
    - importing after an edited row;
    - the third file opening with the matches from that edited import.
  - The stored record held only the hash, sheet, header row and matches. The note fits at 768 and 390 px without sideways scrolling. All test data was removed.

## Registry Import: Programme Names Chosen Once Each, Or Skipped (2026-10-12)

- Phase 5 of the registry import plan (commit `ed8d0c5`).
- **Programme Names In This File.** The Check rows step lists each programme name in the file that is not an approved programme, with its row count.
  - The office chooses the programme each name means, or "Skip these rows" (for example PhD). One choice covers every row with that name, and the rows are checked again straight away.
  - Mapped rows show "In the file: MDS" under the programme. Skipped rows read "Skipped", with "you chose to skip the programme ...".
  - Names still without a choice are named. Their rows stay to fix and are left out of the import.
  - It works for our own template too, since the card is on the Check rows step.
- **Suggestions, never silent.** A name is pre-chosen only from the office's earlier choice ("Chosen on an earlier import") or when it differs from an approved name only in letter case, punctuation, spacing or "(Coursework)" ("The same name, spelt differently"). Each is shown and can be changed. "MDS", Malay names and "(Research)" programmes are never guessed.
- **Remembered office-wide.** New model `RegistryProgrammeAlias` (migration `accounts.0012_registry_programme_alias`) keeps each choice. It is saved on a real import only and suggested on the next one. Names compare without letter case, punctuation or spaces ("M.D.S" is "MDS").
- **Skipped rows** get the status "Programme Skipped". They are listed with the skipped rows in the preview, the result panel ("Programme skipped") and the report ("Skipped: you chose to skip this programme"). Recent Imports counts them ("2 skipped by programme"), and they never count as the first copy of a repeated student.
- **Also changed.** A blank programme cell now reads "programme is required" instead of `"" is not an approved programme`.
- **Database.** The dev database was migrated after a backup: `db-backups/fsktm_pg_office_before_registry_programme_alias_2026-10-12.dump`.
- **Verification.**
  - Backend: 989 tests pass, 11 of them new in `test_registry_programmes.py`. `makemigrations --check` finds no changes.
  - Frontend: all 94 scripts pass. `registryImport.test.ts` gained the programme helpers and source checks. TypeScript lint, the production build and both production guards pass.
  - A live browser run used temporary `smoke.import.*` accounts and passed 23/23. The file used our own template with "Master of Data Science", "MDS", "Sarjana Sains Data" and two "Doctor of Philosophy" rows. It covered:
    - the card, the similar-name suggestion, and nothing guessed for MDS;
    - one choice per name, and skipping the PhD rows;
    - editing a row, then changing the MDS choice, which still reached that row;
    - the import, with the result and Recent Imports counts;
    - a second file ("M.D.S", "SARJANA SAINS DATA") opening with every saved choice.
  - The database matched (MDS students in Cyber Security, the PhD rows not created, four saved choices). The card fits at 768 and 390 px without sideways scrolling. All test data was removed, including the saved choices.

## Registry Import: Settings For Every Row, And Activation Emails Later (2026-10-12)

- Phase 4 of the registry import plan (commit `b4f518d`).
- **For Every Row.** The Match step has a card for a programme (approved list), an intake and a current semester (suggesting the semesters already in the registry).
  - Each one fills blank cells, or a column the file does not have. A value in the file is never overwritten.
  - A programme set for every row stands in for a missing programme column.
  - A matched column with a setting says what fills its blank cells ("Blank cells: 2026/2027 Semester I"). A missing programme column points to the card.
- **Activation emails now or later.** "Send now / Send later" sits beside "Create N Ready Accounts" on the Check rows step, because our own template skips the Match step.
  - "Send later" creates the accounts and emails no one. The result panel says the emails are on hold, with "Send Activation Emails Now". Recent Imports shows "Emails on hold" with "Send now".
  - Both ask first: "Send activation emails to N students?"
  - The import report marks held rows "Created, activation email on hold", then "Created" or "Created, activation email not sent" once sent.
- **New endpoint.** `POST /api/registry/imports/<id>/send-invitations/` (Office only).
  - It emails only students from that import who are active and have not set a password, over one mail connection.
  - It returns the counts and each student's outcome with their file line.
  - A failed email is recorded on the import, as when an import sends straight away, and Recent Imports counts it ("1 email not sent").
  - A second send within two minutes is refused. It is throttled per import with `REGISTRY_BATCH_INVITE_THROTTLE_RATE` (default 3/hour, in `.env.example`).
- **Migration `accounts.0011_registry_import_invitations`.** `RegistryImportBatch` gains `created_students` (Student ID and file line), `invitations_held`, `invitations_sent_at` and `settings_used`. It was applied to the dev database after a backup: `db-backups/fsktm_pg_office_before_registry_import_invitations_2026-10-12.dump`.
- **Verification.**
  - Backend: 978 tests pass, 11 of them new in `test_registry_batch_settings.py`. `makemigrations --check` finds no changes.
  - Frontend: all 94 scripts pass. `registryImport.test.ts` gained the held-email helpers and source checks. TypeScript lint, the production build and both production guards pass.
  - A live browser run used temporary `smoke.import.*` accounts and a Malay-headed CSV without a programme column. It covered:
    - the programme set for every row, and an intake that filled only the blank cell (checked in the database);
    - "Send later" sending no email (checked in the backend log), with the held report and the Recent Imports mark;
    - "Send now" after confirming, emailing exactly the two imported students and clearing both marks;
    - sending from Recent Imports, where Cancel sends nothing.

    The first run passed 24/25. The failing check read an upper-case label before Recent Imports had reloaded; the corrected re-check passed 8/8.
  - The Match step and the import actions fit at 768 and 390 px without sideways scrolling. All test data was removed.

## Registry Import: Match Columns Step (2026-10-12)

- Phase 3 of the registry import plan (commit `95c222d`).
- **New flow.** A file is described first.
  - Our own template goes straight to checking rows.
  - Any other layout stops at **Match Columns**: each field (Student ID, Full name, Programme, Email, Phone, Intake, Current semester) gets a dropdown of the file's columns, with a sample value. The chosen column's first values are shown beside it.
  - The office can change the sheet and the row that holds the column names. The file is then read again, with fresh suggestions.
  - Columns that are not used are listed as "Not used, and not saved".
  - A required field without a column, or one column chosen twice, is named and blocks Check Rows. The server checks the same rules.
- **Progress.** A steps line shows Upload, Match columns, Check rows and Import. "Change column matches" goes back from the checked rows until a row is edited.
- **Edited rows** are sent back in our own layout, so the server finds the columns by name. An empty preview says where the rows will appear.
- **Verification.**
  - All 94 frontend scripts pass. `registryImport.test.ts` gained the matching helpers and source checks for the flow. TypeScript lint, the production build and both production guards pass. No backend file changed since phase 2 (967 tests).
  - A live browser run used temporary `smoke.import.*` accounts and the Maya-style workbook. It covered:
    - the Match step and every suggested match;
    - a missing required column blocking Check Rows;
    - changing the column-name row and back;
    - the checked rows, "Change column matches", and the import;
    - our template skipping the step.

    One check needed a corrected script: upper-case labels and sample values had fooled the first run. The re-check passed 4/4.
  - The Match step fits at 768 and 390 px without sideways scrolling. All test data was removed.

## Registry Import: The Office's Own Spreadsheet Layout Is Read (2026-10-12)

- Phase 2 of the registry import plan (commit `f465cfb`).
- **New inspect step.** `POST /api/registry/students/import/inspect/` (Office only) reports, for an uploaded CSV or XLSX:
  - the sheets, and the sheet holding the student list;
  - the row with the column names, skipping title rows above it;
  - every column with its letter and three sample values;
  - suggested matches from English and Malay column names, for example No. Matrik, Nama Pelajar, E-mel, No. Tel, Sesi Kemasukan.
  - It also reports columns that are not used (such as IC numbers or a running number) and whether the file is simply our template.
- **Options.**
  - Preview and import take an `options` field (sheet, header row, column mapping).
  - Bad mappings are refused with plain messages, such as "Column B is chosen for both Student ID and Full name" or "Choose a column for: Email".
  - Requests without options behave exactly as before.
- **What is read.**
  - CSV may use commas, semicolons or tabs.
  - Intake and current semester can now be imported (`IMPORT_HEADERS` and the CSV template gained both columns).
  - Columns the office does not match never appear in the returned rows and are not saved.
- **Pending P1.** The column names come from research and will be extended with the office's real ones. An old `.xls` file gets a "save it as .xlsx" message until the real extract shows whether a reader is needed.
- **Verification.**
  - 967 backend tests pass with `--parallel 2`, including 18 new ones in `accounts/test_registry_layouts.py`. They use a Maya-style workbook with a notes sheet, two title rows, Malay names, an IC column, and a running-number column.
  - All 94 frontend scripts, TypeScript lint, the production build and both production guards pass. Django checks and the migration-drift check are clean; there is no migration.
  - 12/12 live API checks against `runserver` used a workbook of that shape. They covered sheet choice, the column-name row, the matches, the unused columns, the preview (no IC number returned), the import, and the saved intake. The temporary `smoke.import.*` accounts were removed afterwards.

## Registry Import: Already-Registered Students Listed (2026-10-12)

- Phase 1 of `docs/superpowers/plans/2026-10-12-registry-import-from-office-spreadsheets.md` (commit `b9dbe75`). The plan makes bulk import accept the office's own Maya extract. Xiang said to build it now and amend it when the office answers the two open questions.
- **Who is skipped is shown, not just counted.**
  - Already-registered rows name the registry record they match (Student ID, name, programme, or the role when the email belongs to staff) and how they matched.
  - The row is flagged when the name, email or Student ID differs, which usually means a wrong ID.
  - Repeated rows point at the line that is imported instead.
- **A registered Student ID is reported first.** Missing emails and programme spellings come after it, so a re-uploaded extract does not ask the office to fix existing students.
- **Preview.**
  - Ready, already registered, repeated and to-fix counts, with a filter (All, Ready, Skipped, Need fixing).
  - Each row's explanation sits under the student's name.
  - The preview now takes the full width.
  - The note beside Create says who will be skipped, with a View link.
- **After an import.**
  - A result panel lists every created, skipped and failed row, plus any activation email that failed. A downloadable report has every row's outcome.
  - Only failed rows stay in the preview for fixing.
  - Batch records keep names and the registry match. Recent Imports shows "N already registered", including for batches from before this change.
- The bulk tab is now "Bulk Import (Excel or CSV)".
- **Verification.**
  - 949 backend tests pass with `--parallel 2`, including 9 new ones in `test_registry_import.py`. One of them shows the query count is the same for 5 and 50 rows.
  - All 94 frontend scripts pass, including the new `registryImport.test.ts`. TypeScript lint, the production build and both production guards pass. Django checks and the migration-drift check are clean; there is no migration.
  - A live browser run used temporary `smoke.import.*` accounts and a `smoke-` file, all removed afterwards. Its file held 2 new rows, 2 already registered (one under a different name), 1 repeated and 1 bad programme. Every check passed: counts, explanations, the warning, the View filter, the result panel, the report download and Recent Imports.
  - The preview layout was checked at 1440, 768 and 390 px: no sideways page scroll, and Student IDs stay on one line.

## Activation Links, Clearer Account Emails and Registry Dropdowns (2026-10-12)

- Requested by Xiang after reviewing the student activation email.
- **Activation links have no time limit (new design decision D7).**
  - They use their own signed token (`accounts/tokens.py`). The token works only while the account has never had a password.
  - It stops working as soon as a password is set, whether through the activation link, a reset link or Settings.
  - Every activation email already sent stays valid until the student activates; after that, all of them stop working.
  - Trade-off for the report: an activation email forwarded before use stays usable until the student activates. The office still sees "Not activated" in the Registry, and suspending the account blocks the link.
- **Reset links are unchanged.** They expire after 30 minutes, work once, and stop working when the password changes in any other way.
- **The link is checked before the form appears.** `POST /api/auth/password-reset/confirm/` with `dryRun: true` reports whether the link still works and which kind it is, and changes nothing.
  - This is a dry run of the existing endpoint, so the public API list pinned by `accounts/test_api_security.py` is unchanged.
  - Checks have their own limit (`AUTH_PASSWORD_LINK_CHECK_THROTTLE_RATE`, default 30/hour per address), so opening the page never uses up the attempts to set a password.
  - Saving a password re-checks the link under a row lock, so two tabs cannot both use one link.
  - A used, expired or broken link answers 400 with `code: "invalid_link"`.
- **Emails rewritten** (`accounts/account_emails.py`).
  - They follow the GOV.UK guidance for service emails: why the email was sent comes first, one idea per sentence, no contractions, and web addresses in full.
  - Both now tell the person how to sign in: email plus Student ID (matric number), or Staff ID for staff.
  - The activation email says the link does not expire and works once. The reset email keeps its 30-minute limit.
  - The reset subject is now "Reset your FSKTM Postgraduate Office password".
- **Link pages.**
  - Activation emails open `/activate-account`: "Activate Your Account", then "Account Activated".
  - Reset emails still open `/reset-password`.
  - A link that no longer works shows "Link No Longer Valid" before any typing. Activation links then offer Go to Sign In and Forgot Password?; reset links offer Request a New Link.
- **Registry dropdowns.**
  - Every native `<select>` in the Student Registry is now `SelectMenu`, a styled list built on the WAI-ARIA select-only combobox pattern (arrow keys, Home/End, type-ahead, Escape).
  - That covers the four list filters, the registration form's Programme field, and the record's Programme and new-status fields.
  - Programmes read "Data Science / Master · Coursework" with their colour icon.
  - The list is portalled, so the record dialog cannot clip it, and it stays on screen at phone width.
- **Teammate-written docs now out of date** (not edited; Xiang to pass them on).
  - `ARCHITECTURE_AND_CODING_DESIGN.md` lists the throttle scopes as login, reset request and reset confirmation. There is now also a link-check scope for `dryRun` requests.
  - `docs/WHOLE_SYSTEM_END_TO_END_TEST_GUIDE.md` still calls the Student Registry backend missing. It has been live at `/api/registry/` since PR #15.
- **Verification.**
  - All 940 backend tests pass with `--parallel 2`, including 19 new ones in `accounts/test_password_links.py`. Those include a link used 400 days after it was sent and two tabs submitting one link at the same moment.
  - All 93 frontend scripts pass, including the new `selectMenu.test.ts`, `RegistryDropdowns.test.ts` and `passwordLinkCopy.test.ts`. TypeScript lint, the production build and both production guards pass. Django checks and the migration-drift check are clean; there is no migration.
  - A live run against `runserver` (console email) and Chrome used temporary `smoke.links.*` accounts, removed afterwards.
    - It covered: register a student; activate from the emailed link; reopen the used link; sign in with the matric number; forgot password; reset; reopen the reset link; then the dropdowns at desktop and phone widths.
    - Every functional check passed. Chrome logged only the expected 400s for the reopened links (twice each, because React StrictMode repeats effects in development) and the existing 401 from the sign-in page's session check.

## Student My Records and Partly-Done Plan Completion (2026-10-11)

- Phase 9 of the partly-done plan (UC06), commit `39535ce`. **This completes the plan: phases 1 to 9 are done.**
- **My Records** (`/my-records`, students only; other roles are sent to the dashboard). Students open it from the profile menu, where the item now reads "My Records".
  - The profile is read-only, with "Change in Settings" for the phone number (D3).
  - Summary cards count Supervisor & Panel and Marks records (from the teammate's progress dossier, reused read-only), Letters (Phase 6) and Announcements (the student's notification feed). Files reads "Available when File Management is released".
  - Each category has a table with a "No records found" state. The Letters tab reuses My Letters, including reprint and Word download.
- **No sidebar entry.** One would mean editing the teammate's `navigation.ts` and `Sidebar.tsx`, and the "ALL modules" rule in `permissions.ts` that would also show it to office staff and coordinators. Add it later if the teammate agrees.
- **No backend changes** in this phase.
- **Phase 8 fix** (`a21198c`): at phone widths (360 and 390 px) the bell dropdown ran off the left edge of the screen. On small screens it now spans the width under the header; from tablet width up it stays anchored to the bell. Checked at 360, 390, 768 and 1440 px.
- **Teammate-written docs that are now out of date.** These were not edited; Xiang to pass them on.
  - `PROJECT_STATUS.md`, "Known Issues and Notes": the deferred announcement risks (cross-sender modification, draft and attachment visibility, attachment validation) were fixed in `f5777d2` on 2026-08-20. Only the author or Office can edit or delete, drafts and their attachments follow publish status, and attachments are checked for size, extension and magic bytes.
  - `ARCHITECTURE_AND_CODING_DESIGN.md`, the line saying announcement ownership, draft visibility and attachment authorization are deferred: fixed by the same commit.
  - `ARCHITECTURE_AND_CODING_DESIGN.md`, the Settings endpoint description: since Phase 8 the PATCH also accepts `emailNotifications`, `deadlineReminders` and `weeklySummary`, and the three capabilities are true.
- **Design differences from the use-case document** (for the FYP report; kept on purpose, see the plan):
  - **D1** New accounts get an activation link instead of an emailed temporary password (UC02, UC03, UC04). A password-change requirement set by an administrator is still enforced.
  - **D2** Login gives the same 401 for a disabled account as for a wrong password, and password reset answers the same way for unregistered emails, so neither reveals which accounts exist (UC01, UC02).
  - **D3** Students can change their phone number but not their email, because email is the login identifier (UC06).
  - **D4** Every student status change needs a reason, because the participant lifecycle service requires one (UC05 calls it optional).
  - **D5** Saved letters keep a filled copy and a reference number issued by the server. The PDF comes from the browser's print dialog using that copy; the Word file is built on the server (UC23).
  - **D6** There is no background worker. Scheduled work (announcement release, deadline reminders, weekly summary) runs as idempotent management commands scheduled with Windows Task Scheduler or cron, and announcement release also happens on read (UC30, UC33).
- **Still not started** (the next plan): UC03 Manage User Account (staff and lecturer accounts; the Staff & Lecturers tab is still mock), UC22 appointment confirmation letters (needs an approval hook agreed with the teammate), UC24-UC27 File Management, and UC28-UC29 FAQ chatbot.
- **Verification.**
  - All 921 backend tests pass with `--parallel 2`. Django checks and the migration-drift check are clean.
  - All 90 frontend scripts pass, including the new `myRecords.test.ts`. TypeScript lint, the production build and both production guards pass.
  - 13/13 browser checks passed with temporary `smoke.rec.*` accounts, removed afterwards. They covered the profile menu link, profile fields, counts, the empty state, the letters and announcements tabs, the Settings link, and redirecting office staff.

## Notifications: Bell Dropdown, Email Preferences, Reminders, Weekly Summary (2026-10-11)

- Phase 8 of the partly-done plan (UC33), commit `4403c8c`.
- **Settings switches (agreed with Xiang before changing the teammate's Settings).** Three switches sit under "Announcement alerts": Email alerts (off by default), Deadline reminders (on) and Weekly summary (off). They are new `User` fields (migration `accounts.0010`). `GET/PATCH /api/auth/settings/` reads and saves them, any subset at a time; an empty or unknown preference is still a 400. The three `capabilities` flags are now true. Nothing else in Settings changed. In the teammate's files, `test_settings.py` now expects the flags to be true, and `settingsApi.savePreferences` accepts a partial set so their existing test still compiles. Wey Cheng should be told.
- **Email that follows the switches** (`announcements/emails.py`). Announcement copies need Email alerts and Announcement alerts, reminders need Email alerts and Deadline reminders, and the summary needs Weekly summary. Mail goes through `send_mass_mail(fail_silently=True)`. Announcement delivery emails only people getting the notice for the first time, after the delivery commits, so edits and re-syncs never email twice.
- **Deadline reminders.** `send_deadline_reminders --days N` reminds the target roles of active-timeline entries due within N days (the dashboard's role mapping: STUDENT, LECTURER, OFFICE_STAFF) and evaluators with unsubmitted tasks in published Marks periods closing within N days. It sends one reminder per person per deadline, with a new one only if the deadline moves. People with Deadline reminders off get none. Reminders open the dashboard and Marks Entry.
- **Weekly summary.** `send_weekly_summary` emails opted-in users their unread notifications from the past seven days and skips anyone with nothing unread. `WeeklySummaryLog` (migration `announcements.0005`) keeps it to one email per person per week; a failed send frees the slot again.
- **Bell dropdown.** The bell opens the five newest notifications with "Mark all as read", "View all" and a "No new notifications" state. An item is marked read and opens its record. The routing rule now lives in `utils/notificationLinks.ts`, shared with the Notifications page; announcements open in that page's detail view.
- **Scheduling.** `backend/README.md` lists the three commands with Windows Task Scheduler and cron lines.
- **Verification.**
  - 921 backend tests pass with `--parallel 2`, including 10 new ones in `announcements/test_reminders.py` and 3 in `accounts/test_notification_preferences.py`.
  - All 89 frontend scripts pass, including the new `notificationLinks.test.ts`. TypeScript lint, the production build and both production guards pass. Django checks and the migration-drift check are clean.
  - The dev database was migrated to `accounts.0010` and `announcements.0005` after backup `db-backups/fsktm_pg_office_before_notification_preferences_2026-10-11.dump`.
  - Both commands ran twice against the dev database inside a rolled-back transaction, with mail kept in memory and a temporary timeline, entry and student. The first run sent 7 reminders and 1 summary, the second added nothing, and the database was unchanged afterwards. 18/18 browser checks passed on the dropdown (five newest, record links, announcement detail, mark all read, empty state) and on the new switches (defaults, save, kept after reload), using temporary `smoke.bell.*` accounts that were then removed.
  - The switches use the teammate's `ToggleSwitch`, whose knob position issue is already reported.

## Announcement Scheduling, Expiry and Registry Targeting (2026-10-11)

- Phase 7 of the partly-done plan (UC30), commit `ee4371d`.
- **Schedule.** Announcements have optional publish and expiry times (migration `announcements.0004`). Publishing with a future time saves the notice as Scheduled and delivers nothing. An expiry at or before the publish time, or one already past, is refused (UC30 exception 2). "Scheduled" and "Expired" are now real states instead of labels.
- **Release (D6).** `release_due_announcements()` publishes scheduled notices that are due and expires finished ones. A notice whose whole window passed unreleased expires undelivered. It claims rows with SKIP LOCKED and delivers through the existing `event_key`, so it never delivers twice. It runs at the start of the announcement and notification lists (one cheap query when nothing is due) and as the `release_announcements` command; `backend/README.md` shows how to schedule it.
- **Expiry keeps history.** Delivered notifications stay, and people who received the notice can still open it and its attachment after it expires. Before this, an expired attachment returned 404 to its own recipients.
- **Registry targeting.** "All Students" announcements can be narrowed to approved programmes and to intakes recorded in the registry. Only matching students receive them or can read them. Targeting any other audience returns 400, a deliberate simplification of the plan's "audience includes students". New `GET /api/announcements/audience-options/` and `GET /api/announcements/recipient-count/` serve the composer.
- **Composer.** Publish and expiry fields in Malaysia time (the teammate's `malaysiaDateTime` helpers), programme and intake chips, and a live recipient count. The main button reads Schedule, Reschedule or Save Schedule as the time requires. History shows Scheduled and Expired with their times, the targeting under the audience, and a Scheduled stat card.
- **Changed tests.** `test_review_fixes.py`: Scheduled now needs a publish time, and the notification feed is one due-check query plus the feed query, still constant in length.
- **Verification.**
  - 908 backend tests pass with `--parallel 2`, including 15 new ones in `announcements/test_scheduling.py`.
  - All 88 frontend scripts pass, including the new `announcementSchedule.test.ts`. TypeScript lint, the production build and both production guards pass. Django checks and the migration-drift check are clean.
  - The dev database was migrated to `announcements.0004` after backup `db-backups/fsktm_pg_office_before_announcement_schedule_2026-10-11.dump`.
  - Live checks ran against `runserver` with temporary `smoke.ann.*` accounts whose intakes no real account has, so nothing reached a real account (checked afterwards: 0 such notifications). 18/18 API checks passed, including a notice released and another expired in real time on the next list call. 13/13 browser checks passed on the composer and history. All temporary data was removed.

## Saved Letter Requests (2026-10-11)

- Phase 6 of the partly-done plan (UC23), commit `170aed3`.
- **Issued letters are records now.**
  - Generating a letter fills an Active template on the server from the same details as the preview (`letters/details.py`). It saves the filled wording and the details used (`GeneratedLetter`, migration `letters.0003`) and notifies the student once.
  - The server issues the reference number as `<prefix>/<year>/<NNNN>`, counted per prefix and year under a row lock (`LetterReferenceCounter`). A refused letter never uses a number. The browser's random `generateReferenceNumber()` is gone.
  - If the template needs a detail the student's record lacks, generation returns 400 `missingFields` and saves nothing. The screen names the missing fields first and disables the button.
- **Endpoints** under `/api/letters/requests/`: generate, list (students see their own; the office sees the register with search, date and status filters), detail, Word download (`python-docx`, added to `requirements.txt`), resend notification and revoke. Resend and revoke are office-only.
- **Beyond the plan.**
  - The office can revoke a letter issued in error, with a reason. The student keeps it in My Letters, marked revoked with the reason, and can no longer print or download it. The plan listed a Revoked status but no way to set it.
  - Reprints and Word downloads follow the Active-only rule from 2026-10-10, so a student who is no longer Active gets the same 403 as for generation. Office staff keep full access.
- **Screens.**
  - Student Letter Generation has New Letter and My Letters tabs (`/letters/my-letters`). Generate saves the letter, then prints the saved copy with its real reference. My Letters reprints and downloads the Word copy.
  - Office Letter Generation has Templates and Issued Letters tabs (`/letters/issued`), with search by student, matric or reference, date and status filters, reprint, Word, resend and revoke. Coordinators keep the Templates view only.
  - A "letter ready" notification opens My Letters.
- **Verification.**
  - 893 backend tests pass with `--parallel 2`, including 14 new ones in `letters/test_letter_requests.py` and 2 concurrency tests in `letters/test_letter_reference_concurrency.py`.
  - All 87 frontend scripts pass, including the new `issuedLetters.test.ts`, which also checks that the Word letterhead matches the printed one. TypeScript lint, the production build and both production guards pass. Django checks and the migration-drift check are clean.
  - The dev database was migrated to `letters.0003` after backup `db-backups/fsktm_pg_office_before_generated_letters_2026-10-11.dump`.
  - Live checks ran against `runserver` with temporary `smoke.ltr.*` accounts and a temporary template with its own prefix, all removed afterwards. 15/15 API checks and 17/17 browser checks passed, covering generation, My Letters, the Word download, the notification link, missing fields, the office register, resend and revoke. A sample Word file opened cleanly in Microsoft Word.

## Review Fixes: Xiang's Side (2026-10-10)

- A four-part review (backend code, frontend code, live API, browser UI) of `643512a` found bugs and gaps in Xiang's modules. They were fixed in seven commits, `2888fc9`..`0bff836`.
- **Accounts and sign-in.**
  - Case-insensitive unique emails and matric numbers.
  - A per-identifier login throttle.
  - `last_portal_login` is now recorded separately from `last_login`, so signing in no longer voids a reset link.
  - Passwords are kept exactly as typed.
  - Reset-email failures are logged instead of returning a 500.
  - The legacy `NotificationPreference` table, its endpoint and the `authApi` helpers were removed (migration `accounts.0009`).
  - Admin user forms validate passwords and lock role and permission fields for non-superusers.
  - New check `accounts.W001` flags superusers that still hold a portal role.
- **Registry.**
  - Coordinator scope.
  - Matric, staff-number, email and phone validation.
  - Unknown PATCH fields are rejected.
  - Invites are sent only when asked.
  - A programme change is blocked (409) once a research profile exists.
  - Suspending sign-in revokes refresh sessions.
  - Safer CSV/XLSX import: encoding, malformed files, size cap, "Invalid Field" rows, and the batch is recorded before emails.
  - Screen: filtered CSV export, paging, edit details, confirmed Suspend/Reinstate Sign-in, issues shown in the import preview, and a keyboard-usable drop zone.
- **Announcements and notifications.**
  - Reading follows the audience.
  - Delivery is re-synced on every edit (retarget, status, Urgent).
  - Attachment files are deleted when replaced, removed or deleted.
  - The feed is capped at 200 items in one query.
  - Screens: delete confirmation, edit and withdraw a published item, remove an attachment, honest counts, an accessible dialog, and the bell refreshes every minute and on focus.
- **Letters.**
  - Students get 404 for non-Active templates.
  - Single and triple braces are flagged the same way on the server and in the editor.
  - Editor: confirm before delete, warn on unsaved changes, keep typing made during a save, field-level errors, and new reference-prefix and description inputs.
  - The preview now matches the printout.
  - The stamp now reads "Computer-generated / Verify with the PG Office".
- **Sign-in and session (frontend).**
  - Logout no longer races a quick re-login.
  - A superseded 401 no longer ends the new session.
  - Signing out during the forced password change can't leave the user signed in.
  - A mid-session `technical_account` 403 signs the user out with the reason.
  - On portal pages, the startup refresh retries once so two tabs reloading together both stay signed in.
  - Nested DRF errors and 5xx are shown as readable messages.
  - Login: no unused "Remember me", no fake manual download, mobile layout, favicon.
  - Forgot password uses neutral copy and shows the resend result inline.
  - FAQ chatbot: no double send, no fake attach/download/"logged" claims, and the composer no longer covers the footer.
- **Not changed (teammate-owned, reported).**
  - `ToggleSwitch` knob position.
  - 500s for accounts without a profile in `appointments/views.py`.
  - Coordinator Marks Entry 403.
  - Workflow Reports duplicate key.
  - App-shell dead links.
  - Settings errors shown only as toasts, and phone format.
  - `authSession` treats a network blip during refresh as session expiry.
  - `PortalToast` live region.
  - Admin login throttling (T04) and the `FRONTEND_URL` production guard.
- **Verification.**
  - 873 backend tests pass with `--parallel 2`.
  - All 84 frontend scripts pass, including the new `sessionRaces.test.ts`.
  - TypeScript lint, the production build and both production guards pass.
  - The dev database was migrated to `accounts.0009` after backup `db-backups/fsktm_pg_office_before_review_fixes_2026-10-10.dump`.
  - Repeat live API and browser runs were started but stopped early on a usage limit, before any checks ran. They are not a verification result. Their temporary accounts and servers were removed.

## Technical Administrator Accounts: Xiang's Side (2026-10-09)

- Agreed with the teammate: one account, one role. Office staff work in the portal; Django admin is for separate Technical Administrator accounts (pending-work register T01-T06).
- **Account type.** `createsuperuser` now creates a Technical Administrator (`User.TECHNICAL_ADMIN`, migration `accounts.0008`). It is a valid `User.role` value but deliberately not part of `User.Role`, so `User.Role` stays the four portal roles and code or tests that loop over it are unaffected. A superuser cannot be created with a portal role, and `createsuperuser` no longer asks for a role.
- **Kept out of the portal.**
  - Login returns 403 `technical_account`. This happens after the password check, so a wrong password still gets the generic 401.
  - The default authentication class (`PasswordPolicyJWTAuthentication`) refuses their access tokens.
  - Refresh revokes their session instead of renewing it.
  - Password reset sends them nothing, and outstanding reset links fail.
- **Role, not flags.** Registry, Letters, Announcements and the access-link throttle no longer treat superuser status as Office. A portal account that still has the superuser flag acts only as its role. `seed_announcements` no longer falls back to a superuser author.
- **Announcements.** "All" no longer reaches Technical Administrator accounts.
- **Django admin.**
  - Letter templates, announcements and notifications are inspection-only (no add, change or delete). The private announcement attachment shows its file name instead of an unserved media link.
  - The user forms reject a portal account with superuser status, a Technical Administrator without staff and superuser status, and turning an account that has a portal profile into a Technical Administrator.
  - Technical Administrator pages show no profile sections.
- **Not changed (teammate's T02-T05).** Office accounts still need `is_staff` for Marks, participant lifecycle (including Registry status changes), research amendments, capacity reassessment and delegation until those checks move to the Office role. Admin login is not restricted yet, and `seed_users` is unchanged.
- **Verification.**
  - 831 backend tests pass with `--parallel 2`, including 20 new ones in `accounts/test_technical_admin.py`.
  - All 82 frontend scripts, TypeScript lint, the production build and both production guards pass. Django checks and the migration-drift check are clean.
  - The dev database was migrated to `accounts.0008` after backup `db-backups/fsktm_pg_office_before_technical_admin_2026-10-09.dump`.
  - A live check used a temporary `createsuperuser` account, deleted afterwards. The portal refused it with 403 `technical_account`. Django admin let it in, and the template, announcement and notification add pages returned 403. The demo Office account still opened the Registry, Letters and Announcements.
## Main merge conflict resolution (2026-10-12)

Merged origin/main into codex/portal-consistency-and-toast to resolve GitHub merge conflicts in the FAQ chatbot, Student Registry and letter templates. Main feature changes and branch record navigation/list-state/typography preserved. Integration verification passed: 122 backend regressions; frontend suite expanded to 100 scripts (registry conflict regression fixed and rerun with record-navigation checks); TypeScript, production build, production security guards and staged whitespace checks pass. No unresolved paths remain.

## Branch publication (2026-10-12)

User requested committing and pushing all accumulated navigation, Supervisor workspace, search and Student appointment visibility changes on codex/portal-consistency-and-toast. Publication checks include all 93 frontend scripts, TypeScript, Django system/migration checks and 59 affected backend regressions, all passing. Sensitive file-name and credential-pattern scans found no matches; private local environment files remain ignored. Historical entries below describe the state at each implementation checkpoint.

## Student supporting appointment visibility (2026-10-12)

Implemented Student appointment-result visibility and result-only in-app notifications; removed pending/terminal supporting nomination UI and dashboard tracking. Staff workflow and audit records remain intact. Failing-then-passing API privacy, legacy-notification and dashboard regressions added. All 16 co-supervision tests and 10 dashboard/announcement tests pass; the two privacy tests were rerun after strengthening nested projections and staff preservation checks. All 93 frontend scripts, TypeScript, production build and production security checks pass; notification destination regression passes. No live academic decisions were made. Changes remain uncommitted on codex/portal-consistency-and-toast.

## Office record navigation toast (2026-10-12, complete)

- Removed the "Returned to Appointment records" toast from the Office appointment Back action. The existing return callback, preserved list state and record guards remain intact; filter, download, lifecycle and error feedback is unchanged.
- Office hierarchy and global record navigation regressions pass; TypeScript passes. All three project documents updated. Changes remain uncommitted on codex/portal-consistency-and-toast.

## Office supervisor search verification (2026-10-12, complete)

- Live Office search verification reproduced duplicate React row identities leaving an unrelated row visible while pagination correctly counted matching records. Restored application-specific keys and added a failing-then-passing identity/stability regression. Repeated live searches now show 2 Student Test rows, 2 DEMO-STUDENT-001 rows, 6 shared-supervisor rows, zero unmatched rows and 6 rows after clearing.
- Research names/matric/numeric IDs worked; displayed change types and formatted references did not. Search now includes the shared change-type label and Research request/Research amendment/Request reference forms. Rendering regression reproduced the miss before the fix. Live Abstract change, Research request #2 and Research amendment #2 each match the ongoing record; unmatched terms return zero; clearing restores it. Research History remains independent, and Office Applications redirects to Appointment records as designed.
- All 93 frontend scripts, TypeScript, production build and both production security/artifact guards pass. No backend, schema, dependency or authorization changes; no live workflow mutations. Changes remain uncommitted on codex/portal-consistency-and-toast. Other existing local branches/worktrees were inspected read-only and were not changed.

## Supervisor hierarchy across roles (2026-10-12, complete)

- Implemented the approved role-specific Supervisor tabs and common list hierarchy for Student, Office and Coordinator; Lecturer presentation remains shared. Research ongoing/history partition and pagination now apply across roles. Student applications lead with supervisor identity, Coordinator primary/supporting queues use compact tables, and Office teams/research no longer precede appointment records. Administration tools and capability-specific workflows retained.
- Added scoped Coordinator terminal request history without changing the approved appointment endpoint. Dedicated tests cover terminal outcomes, roles/programme boundaries and acting scope. Review found incompatible Student status filters after view switches, September date parsing and Coordinator appointment/dossier identity loss. All were fixed with focused regressions; scoped follow-up found no remaining material findings.
- Verification: 93/93 frontend regression scripts and 33 affected backend tests pass. The four affected rendering scripts, TypeScript, production build and both production security/artifact guards passed again after final wording refinements. Django check and migration dry run pass with no migration changes. Git diff whitespace validation passes. No dependency or schema change; existing authorization/scoping preserved.
- Live acceptance covered all four roles: Lecturer baseline; Student Applications History/detail/return preserving size, research ongoing/history/detail/return; Office record filters/detail/return, teams detail with retained search, separate research History; Coordinator populated queue/detail/return, cancelled primary History, teams detail/return and separate research tab. At 390 px, Student research and Coordinator records have no document-level overflow and use stacked records. Normal viewport restored. The existing local backend server was reloaded to activate the new endpoint.
- Browser checks used available demo records and submitted no academic decisions, cancellations, corrections, transfers, lifecycle endings or uploads. Populated supporting nominations and Coordinator approved appointment/dossier roundtrip were not available live; fixtures and source review cover those paths. Saved Student/Office/Coordinator desktop and Student/Coordinator mobile previews outside the repository. All three root documents updated; changes remain uncommitted on codex/portal-consistency-and-toast, with no push or merge.
- Plan and evidence: docs/superpowers/plans/2026-10-12-supervisor-role-hierarchy.md; design: docs/superpowers/specs/2026-10-12-supervisor-role-hierarchy.md.

## Global navigation audit (2026-10-11, complete)

- Audited active App modules across Student, Lecturer, Programme Coordinator and Office Staff/Admin against the approved page/inline/modal standard. Fixed Coordinator request deep links, local Marks/file/announcement editors, staff research records/forms, record fallback headers and return context. Lists preserve UI controls across route/dossier remounts; substantial forms protect drafts and in-flight operations. Brief previews/confirmations and contextual configuration editors remain intentional exceptions.
- Read-only review identified cached Marks state being reset on mount, Panel pagination clamping before data loaded, abandoned Coordinator reasons persisting, and saved staff transfer forms staying open with stale dirty state. All are addressed; follow-up review found no remaining actionable issues. Live acceptance also reproduced research dashboard actions opening the module root; their resolver now opens the exact request and its regression passes.
- Final verification: all 89 frontend regression scripts, TypeScript, production build, both production security/artifact guards and git diff whitespace checks pass. No new dependency, backend, schema or authorization change was needed for this follow-up. Existing earlier backend work remains untouched.
- Representative desktop acceptance covered all four roles: Student research detail/return; Lecturer list/Marks empty state; Coordinator dashboard request/rejection draft discard/reopen; Office announcements and upload draft guards, supervisor/dossier return with retained search, staff research local/routed details, guarded request form and preserved student selection. Login help Escape/focus passed. No academic decisions, saves, uploads, publication or deletion were executed. Demo Lecturer Marks has no tasks, so populated scoring/submission and API-success/failure paths rely on tests/source review rather than live mutation checks. This is an active-code audit, not a claim to have browser-tested every data/permission/error state.
- Coverage and limitations: docs/superpowers/specs/2026-10-11-global-navigation-audit.md; completed plan: docs/superpowers/plans/2026-10-11-global-navigation-audit.md. All three root documents updated. Saved global Coordinator and staff research previews outside the repository and restored the Lecturer Supervisor Appointments workspace. Changes remain uncommitted on codex/portal-consistency-and-toast; no push or merge.


## Record navigation consistency (2026-10-11, complete)

- Implemented the approved independent record/form screen: one labelled return above one heading, no list title or module tabs on details; existing app shell, fonts and permitted workflow actions remain. Supervisor primary/supporting/research/supervision records, Panel review/history/nomination/workload, Registry profiles/forms, capacity/workload, reconciliation, Timeline forms/import, document requirements, request history, file upload and backup evaluator forms use this structure.
- Shared RecordPage host preserves mounted local list state; routed lists retain query filters, view, pagination and size. Validated return context tracks the actual originating history entry, including profile/dossier navigation. Local editors use an opaque transient history marker and reload to their owning list. Brief confirmation/help/notice/Timeline/task previews use native accessible dialogs.
- Review identified successful-save redirects being blocked, redundant URL updates losing roster filters, profile student selection losing source pagination, and StrictMode cleanup bypassing local guards. Fixed all four; read-only follow-up found no further actionable issues. Separate shared contexts keep the host and nested forms connected during development updates. Focus/history cleanup excludes StrictMode replay, and page refresh controls are disabled while a draft or mutation is active.
- All 87 frontend regression scripts passed. After the final context adjustment, the four affected regression scripts, TypeScript, production build and both production security/artifact guards passed again. Live Supervisor filter/size/detail/return, research dirty Back/browser Back/Escape, Panel nomination dirty browser Back and submitted history detail/return pass. No academic decisions, submissions or deletions were made. Office Timeline sidebar discard, Registry profile/registration return, and capacity availability form/default return pass. Research History → request → profile → changed student → Back restores the original view/search/page/size. Appointment direct reload passes; at 390 px the detail has one h1, no tabs and no document overflow. Saved record-appointment-desktop.png and record-appointment-mobile.png outside the repo and restored the Lecturer desktop view. Git diff whitespace check passes.
- Live acceptance used available demo records and did not execute real saves, repairs, publication or academic decisions. Supporting nominations and pending Panel reviews were not populated for live checks; their render/permission regressions remain covered by the test suite. Local editors are transient and reload to the owning list; they do not gain new bookmarkable record endpoints. Dormant, unused legacy drawer exports remain; active call sites use the new frames.
- Changes remain uncommitted on codex/portal-consistency-and-toast. This navigation follow-up adds no dependencies, backend/schema or authorization changes; earlier authorised uncommitted changes are preserved.

## Lecturer table typography correction (2026-10-11, complete)

- Replaced the new table's bespoke typography overrides with the portal's existing data-table/data-th/data-td/data-td-strong styles across all three Lecturer tabs. Headers and body cells now inherit the standard font family, sizes, weights and casing; responsive record layout is retained.
- TypeScript, the three affected rendering regressions and production build pass. Live computed-style inspection confirms Inter with 10 px / 800 / uppercase headings and 12 px / 600 body text. Saved table-font-corrected.png; updated requirements and architecture documentation. No workflow, dependency or backend changes; work remains uncommitted on the requested branch.

## Lecturer record table refinement (2026-10-11, complete)

- Reviewed the approved table design three times and separated Waiting at this stage from Current stage. Replaced Lecturer list cards with shared desktop tables and labelled mobile records, moved references/programme detail out of request lists, and added 10/25/50 row-size controls. My supervisees retains programme and shows the lecturer's recorded team role independently of mutable capabilities. Request references remain searchable and copyable in details.
- The regression reproduced the previous card layout before implementation. All 84 frontend regression scripts pass; the five affected scripts passed again after final responsive refinements and expanded row-size/terminal-wait assertions. Final TypeScript, production build and both production security/artifact guards pass. Whitespace checks pass. No new backend, schema, dependency or authorization changes for this refinement.
- Live desktop acceptance verified the three table layouts, row-size controls, appointment reference search/detail/copy feedback, research ongoing/final waiting values and detail navigation. At 390 px, all three lists have no document-level horizontal overflow; mobile research detail/return preserves the selected page size. Restored the normal viewport. No academic decisions were submitted.
- Saved table-appointments.png, table-supervisees.png, table-research.png and mobile previews outside the repository. All three project documents updated; changes remain uncommitted on codex/portal-consistency-and-toast. Existing APIs still fetch their authorised datasets, so server-side pagination remains a separate future scaling step. No push or merge.

## Lecturer workspace presentation consistency (2026-10-11, complete)

- Standardised section headers, combined filter bars, student-first summary cards, action placement and ten-record pagination across Appointment requests, My supervisees and Research changes. One page-level Refresh replaces duplicate Lecturer card refresh controls; Requests/History sits alongside request section headings and wraps below them on narrow screens.
- Aligned descriptions, submitted dates, waiting-time text, request status labels, Review request/View request actions, Recorded progress and Cancel wording. Current supervisees retain View supervision and all existing team detail actions; workflow capabilities and embedded Student/staff defaults remain intact.
- Rendering regressions reproduced the refresh, research card and roster inconsistencies before implementation. All 84 frontend regression scripts pass across the full run and corrected audit-wording rerun; the five affected scripts passed again after the final responsive refinement and roster pagination assertion. Final TypeScript, production build and both production security/artifact guards pass. No new backend, schema, dependency or authorization changes were needed for this follow-up.
- Live desktop/mobile acceptance covered shared controls, research Requests/History, search, Refresh, detail navigation, unsaved endorsement Cancel, and supervisee search/detail/return. Mobile research and supervisee lists have no document-level horizontal overflow. No academic decisions were submitted. Saved consistent-appointments.png, consistent-research.png, consistent-supervisees.png and mobile previews outside the repository; restored the normal browser viewport.
- Updated all three project documents. Changes remain uncommitted on codex/portal-consistency-and-toast for review; no push or merge.

## Lecturer request workspaces (2026-10-11, complete)

- Completed the approved Appointment requests / My supervisees / Research changes structure. Appointment and research areas have separate Requests/History controls; primary/supporting appointment requests share review panels; Coordinator-pending requests remain visible with recorded progress. Detail Back actions sit below the stable module navigation. Supervisory team details retain their own distinct section heading.
- Regressions reproduced accepted and Coordinator-rejected primary requests being labelled Approved, and semester filtering dropping pending primary rows. Corrected the API projections and consistent semester labels. Independent review also identified stale supporting permissions on Retry and missing applicant dossier access; both are fixed. Follow-up review found no remaining actionable issues.
- Verification passed all 84 frontend regression scripts, TypeScript, production build and both production security/artifact guards; the affected rendering regressions, TypeScript and build/guards passed again after final wording refinements. All 45 supervisor/co-supervision backend tests pass; Django check and migration dry run pass with no schema changes. No dependencies or authorization changes.
- Read-only desktop acceptance covered combined queue, semester filtering, Coordinator progress, primary deep link/close, final appointment History, research search/detail/profile/history/reload and contextual return, and supervisee roster/detail. At 390 px, research History and appointment queue have no horizontal overflow; the panel fits the screen and Escape returns focus. No working academic decisions were submitted. Supporting populated states are covered by backend/rendering tests; there were no live supporting nominations for a populated browser check.
- Saved appointment-workspace.png and mobile-request-progress.png previews outside the repository. Updated all three project documents and the implementation plan. Changes remain uncommitted on codex/portal-consistency-and-toast for review; no push or merge.

## Request history helper-card removal (2026-10-11)

- Removed the requested Supervision Policy and Need Assistance cards from Supervisor Request History, including the hard-coded capacity claim and assistance address. Request data, filters, pagination, details and supporting history remain intact. Requirements updated; architecture checked with no structural or API change required.
- TypeScript and the existing workspace rendering regression pass. Live Lecturer history reload confirms both cards are absent and request records remain visible; saved supervisor-history-helpers-removed.png. No workflow data changed.

## Supervisor nested page header correction (2026-10-11)

- Fixed the screenshot's double history heading and Back action below the module navigation. Lecturer Request History now has one page heading and Back to Requests above it. Student/Lecturer research detail, profile and form pages use the same hierarchy; standalone component headers and other staff defaults remain available.
- Added actual container-rendering assertions to the existing workspace regression; the history assertion reproduced two h1 headings before the correction. Final verification passes all 82 frontend test files, TypeScript, production build and both production security/artifact guards.
- Live desktop checks verify the Lecturer history header, Back navigation and research detail, plus Student research detail and Back navigation. History has no document-level overflow at the 1280 px viewport. Saved supervisor-history-header-fixed.png. Only navigation/authentication changed; no workflow mutation was submitted. No backend or permission changes were made; new mobile acceptance is not claimed.

## Supervisor workspace page separation (2026-10-10)

- Completed the approved page split: Student My supervisors / Applications / Research changes; Lecturer Requests / My supervisees / Research changes. Compact lists open individual application, supervision and research details. Current profile/revisions and the permitted research form have dedicated views; useful guidance stays visible in the relevant section. Staff record buttons now read View student record; Student evaluations remain absent.
- Added deep-link, active-navigation, pending/completed partition and routed team/research rendering coverage. Updated the existing waiting-time integration check to follow the extracted application component. Final verification passes all 82 frontend test files, TypeScript, production build and both production security/artifact guards on 2026-10-11. No backend code, API, schema or dependency change required a new backend test run.
- Independent review identified lost visibility of accepted supporting nominations awaiting Coordinator approval and obsolete Lecturer request loads reopening drawers after navigation. Fixed both; the strengthened nomination-history regression failed before the correction and passes after it. Follow-up review found no remaining actionable issues; the async drawer correction was source-reviewed rather than tested with browser network delays.
- Read-only 1280 px browser acceptance covers Lecturer roster search, supervision detail/record navigation and reload, research request comparison/endorsement-form availability, selected profile history, Student overview/application drawer/research list/detail/reload/profile/replacement and cancellation-form availability. Office/Coordinator retain embedded workspaces and redirect unsupported new detail routes to their existing root. Student shared typography and document bounds pass; no new mobile acceptance or exhaustive all-role visual audit is claimed.
- Saved student-supervisor-pages.png, lecturer-supervisees-page.png and research-change-detail-page.png previews. Browser checks changed authentication, navigation and unsaved form state only; no application, nomination, cancellation or decision was submitted. Existing pending development requests remain untouched. Work stays on codex/portal-consistency-and-toast for the user's later merge; no push or merge is performed.

## Report filter clarity and Lecturer usefulness (2026-10-10)

- Follow-up scope clarification: renamed the Lecturer total to Records involving you and added a description of authorised workflow records, shared milestones, record counts and waiting stages. Office/Coordinator wording and all backend permissions are retained. The existing focused reporting rendering test and TypeScript pass; live Lecturer inspection confirms the new label and scope paragraph. Saved lecturer-report-scope-clarified.png. This follow-up changes presentation only and introduces no new tests or backend changes.
- Found the screenshot's borderless controls used the undefined form-input class. The new rendering regression failed on that Lecturer filter before implementation. Migrated all remaining consumers across Reports, Capacity, Participant Lifecycle and Reconciliation to the defined shared controls.
- Reports now expose an explicit filter form, applied scope/draft-change notice and clearer actions. Lecturer action cards and attention records precede optional statistics/breakdowns, preserving original reporting and export features.
- Found pending research amendments counted as waiting but omitted from the actionable attention list. A role-scoped API regression reproduced the omission; included existing authorised amendment rows in the shared attention projection used by JSON/XLSX.
- Verification passes all 80 frontend test files, all 12 backend dashboard reporting tests, final targeted rendering regression, TypeScript, production build and both production security/artifact guards. Focused read-only review found no actionable introduced issues. The backend amendment regression uses an isolated disposable database.
- Live desktop checks cover Lecturer semester draft notices, Apply/Reset, waiting-table anchor, Marks navigation, preserved breakdown disclosure and viewport bounds; Coordinator/Office retain visible reporting statistics and role-specific filters. Capacity, participant lifecycle and reconciliation controls have shared classes and visible borders in the Office browser view. Native date automation did not commit edits, so no live date-validation or mobile acceptance is claimed; existing date validation/report tests remain passing. This is scoped verification of the changed controls, not an exhaustive visual audit of every portal page.
- Restarted the local backend; direct and proxied health checks pass. Saved lecturer-workflow-reports-improved.png as the preview. Browser verification changed only authentication and report/view filters; no application, cancellation, approval, capacity policy or participant record was changed. Changes remain on codex/portal-consistency-and-toast for the user's later merge; no push or merge is performed.

## Cancellation audit response correction (2026-10-10)

- Reproduced the reported cancelled Student request showing Audit History (1): the new cancellation event was persisted, but the API serialized the pre-mutation prefetched history. Extended the existing cancellation regression; it failed with only SUBMIT in the response instead of SUBMIT/STUDENT_CANCEL.
- Added targeted workflow-history cache invalidation to the shared Supervisor/Panel audit writer so successful mutation responses include the new event while preserving unrelated prefetched relations and the original returned event. Existing cancelled requests require no data repair; an already-open client can refresh once to discard its old response.
- Verification passes all 57 backend Supervisor/Panel workflow, role-integrity and document tests, plus a focused rerun of the strengthened immediate-response regression with actor, timestamp, reason, status transition and fresh-detail agreement assertions. Tests use an isolated disposable PostgreSQL database. Focused read-only code review found no introduced issues; whitespace checks pass. No frontend code, dependency or schema changes were needed.
- Restarted the local backend and verified direct/proxied health checks. Live Student inspection of existing cancelled SV-APP-00007 shows Audit History (2), Submit and Student cancel with the persisted reason and status transition. Saved supervisor-cancellation-audit.png as the preview. No new development cancellation/application/approval was performed, and the pending Coordinator request remains intact. Changes are saved on codex/portal-consistency-and-toast; no push or merge is performed.

## Student application clarity and duplicate-submit correction (2026-10-10)

- Replaced the misleading active-first indicator with three equal section links. Added an explicit Selected marker, accessible pressed state, selected Supervisor summary, toggle deselection and Clear selection. The footer now uses shared visible Appointment guidance with two necessary application rules.
- Added a same-form in-flight submit guard and a server pending-request recheck under the existing Student row lock. The PostgreSQL concurrency regression reproduced the prior unhandled duplicate-constraint error before the fix; afterward competing submissions return 201/400 and create exactly one request/document/event/notification, with no active appointment. Database uniqueness and the existing final-approval workflow remain intact.
- Verification passes 44 backend concurrency/workflow/role-integrity tests, all 79 frontend test files, the tightened rendering assertions, final TypeScript/production build and both production security/artifact guards. Authenticated 1280 px browser checks confirm equal section-link typography, section navigation, click/keyboard toggling, clear selection while filtered out, visible two-card guidance and no horizontal document overflow. No mobile live acceptance is claimed for this change.
- Restarted the local backend with the new lock recheck; direct and frontend-proxied health checks pass. Saved supervisor-application-selected.png and supervisor-application-selection-guidance.png as previews. Browser checks used only unsaved selection/search input; no application, cancellation or approval was submitted. Backend tests used an isolated disposable database and temporary media, preserving the current Student test request awaiting Coordinator review.
- Focused read-only code review found no critical or important introduced issues. The same-form in-flight ref guard has source review; concurrency is exercised by the server API test rather than a deferred frontend double-submit/retry test. Changes remain on codex/portal-consistency-and-toast for the user's later merge; no push or merge is performed.

## Shared toast correction and feature branch (2026-10-10)

- Moved the complete existing local working tree from main to codex/portal-consistency-and-toast and verified the tracked/untracked status was preserved by the branch switch. This includes the prior role typography, Student privacy/record changes, Student/Lecturer appointment layouts and the other tool's application-validation toast integration.
- Replaced the error X-in-a-circle with an exclamation status icon and retained one dismiss button. Shared toasts now use a restrained solid-white surface, smaller status treatment, supporting-text typography, bounded wrapping and keyboard-visible dismissal focus. Corrected notification lifecycle so a cleared/dismissed error can return, and cancelled obsolete application timers to prevent a newer message disappearing early.
- The new SSR regression first failed on the duplicate-looking error X and passes after the fix. All 78 frontend regression files, final TypeScript, production build and both production security/artifact checks pass. Live Student application checks pass for one close symbol, consistent 12 px/500 Inter text, viewport bounds, dismissal, identical repeated error and old/new timer deadlines. This is a desktop 1280 px browser check; narrower layouts use the explicit CSS bounds and source/regression evidence rather than a new mobile browser acceptance claim.
- The Student test account had already progressed to a request awaiting Coordinator review before these checks. Verification used only incomplete-form validation and unsaved input, with no request, cancellation or approval submitted. Saved portal-toast-improved.png as the visual preview. Existing development accounts/credentials and workflow data are retained; local database fixtures are independent of Git branch history. No push or merge is performed.

## Fresh Student manual-testing account (2026-10-10)

- Provisioned a separate local development Student, `student.e2e.20261010@example.test` / `E2E-STUDENT-20261010`, named Student Test 10 October, with an Active Cyber Security profile in Semester I 2026/2027. The existing Demo Programme Coordinator manages that programme; no delegation or authority change is needed. Fictional registry details support the existing letter-details endpoint. Existing Demo Student One and other accounts remain unchanged.
- The account starts without Supervisor requests, appointments or a research profile. Its generated password is hashed in Django and retained only in an ignored local credential file; no credentials are recorded in project documentation or tracked source. No request or approval was submitted during setup.
- Verified email and matric-number login through the running frontend proxy, empty request records, absent Student Marks, denied staff Marks and foreign Student dossier access, own letter details, an effective Active semester, existing Coordinator programme scope and the available Demo Lecturer Supervisor candidate. The supplied one-page fictional proposal passes the existing required-document validator and was rendered for visual inspection.
- The user receives the step-by-step testing instructions directly in chat. Letter generation currently needs an Office-created Active template (none exists); general Files and FAQ retain their documented integration limitations. Semester milestones remain the shared Office schedule and do not represent this new Student's individual research completion. Requirements and architecture were checked: provisioning uses existing models/authentication and introduces no business-rule, schema, API or implementation change.

## Lecturer expanded supervisory cards (2026-10-10)

- The user's expanded screenshot exposed density inside the team card and the redundant Appointment history → Timeline and progress disclosures. Implemented Student-style current primary/supporting cards, one expandable full research profile, retained supporting appointment histories/actions and structured appointment activity. Office-managed shared semester dates now have their own disclosure and explicit progress limitation.
- Traced data to existing co_supervision.serialize_team: primary/Panel application latest status and updated timestamp, supporting audit events, and current active Office semester timeline rows targeted at Students. The Demo milestones are the fictional records populated in the earlier preview; no new records were created. Existing Student and Office/Coordinator branches and authorization remain intact.
- Regression first reproduced the mixed-source/nested timeline before implementation; source separation and action-capability checks now pass. All 77 frontend regression files, TypeScript, production build and both security/artifact guards pass. Student and Office/Coordinator compatibility uses retained branches and rendering/source regressions; no backend changes required a new backend run.
- Live Demo Lecturer Supervisor acceptance passes for the default card, expanded full profile, four appointment rows separated from four semester dates, clear source explanation and the existing nomination form with ineligible candidate/submit disabled. Computed-style checks pass in all inspected states (up to 97 role elements), with no document-level overflow at the actual 1280 px viewport or browser warnings/errors. No nomination or decision was submitted. The earlier browser-resize limitation still applies; this pass does not claim new mobile acceptance.
- Saved lecturer-team-card-simplified.png and lecturer-team-activity.png, left the concise expanded team available in the browser and updated all three mandatory documents. Changes remain uncommitted.

## Lecturer Supervisor/Panel consistency and restructuring (2026-10-10)

- Implemented matching appointment sections, summary/member cards and visible useful guidance for both Lecturer modules. Supervisor now orders review work before active supervisees, research requests and teams. Panel orders selected-member reviews before supervisee nominations and assignments; compact selection replaces repeated cards/filler. Both rosters have real search fields.
- Lecturer research comparisons/history are compact and expandable with all recorded audit events and eligible actions retained. Active supervisees now use their linked current research profile; original application history remains intact. No stored demo data, schema, credentials or authorization changed.
- Independent review found that parent refresh could discard research/team selection and drafts. Corrected by keeping those sections mounted with separate data-refresh versions; follow-up review confirms the fix. Live UI-only regression preserves the selected student and unsent decision draft through refresh. No decision, nomination, cancellation or approval was submitted.
- Verification passes all 77 frontend regression files, 14 backend research-amendment tests in a unique disposable PostgreSQL database, TypeScript, production build and both production security/artifact guards. Final visual inspection compacted the empty pending card and corrected wrapped identity/date columns; all six populated roster action buttons now fit the desktop container. The full suite passed before that final table-only adjustment; focused Lecturer tests, TypeScript/build/security and live computed-style/layout checks pass afterward.
- Authenticated 1280 px checks cover Demo Lecturer Supervisor and Demo Panel Lecturer, visible two-card guidance, current research values, endorsement form/focus, initial/title history, Panel replacement form/required reason, both roster searches and the assignment detail route. Default/expanded research, Panel list and replacement/detail views have no typography mismatches or document overflow. Selected Panel review queues are empty in these local fixtures; populated review behavior uses existing regression/source coverage. Office/Coordinator compatibility is covered by existing tests and focused source review, not an exhaustive new live audit.
- Browser viewport controls returned successfully but repeatedly left both existing and fresh tabs at 1280 px; new 390 px acceptance is therefore unverified. Overrides were reset and the extra resize-test tab closed. An editing-time React hot-reload dependency-array warning did not reproduce in a fresh authenticated tab, which has no console warnings/errors.
- Updated all three mandatory project documents. Saved lecturer-supervisor-consistent.png and lecturer-panel-consistent.png in the task visualization directory; local backend restarted to load the current-profile API and Demo Lecturer Supervisor restored on the Supervisor page. Changes remain uncommitted.

## Student initial research history correction (2026-10-10)

- Implemented the approved initial-profile layout and consistent history cards. The live regression reproduced three unnecessary Previously boxes before the fix. No stored records or API permissions changed. All five focused frontend regression suites, TypeScript, the production build and both security/artifact guards pass. The live history regression now passes at 390 and 1280 px; computed typography checks all 50 visible role elements with no mismatches or horizontal document overflow. Staff full comparisons remain covered by the rendering regression. Browser console has no warnings/errors; temporary viewport overrides were reset. Saved student-research-history-cards.png and student-research-history-consistent.png in the visualization directory; retained the Student page for review. Changes remain uncommitted.

## Student research change form preview (2026-10-10)

- Rendered the existing ResearchAmendmentForm component with the synthetic Demo Student One profile into a standalone local preview at 127.0.0.1:3002. The preview has no API submission handler, displays the title/abstract/reason fields, and leaves the pending amendment unchanged. Saved research-change-form-preview.html and .png in the task visualization directory and opened the browser preview for the user.
- Requirements and architecture remain unchanged; no production code, permissions or database records were modified. The temporary render script was removed after creating the artifact.

## Student Supervisor/Panel consistency and visible guidance (2026-10-10)

- Implemented shared Student appointment section/member/guidance components. Panel now follows the compact Supervisor layout, preserving confirmed contact/appointment information and the public pending-state boundary. Both pages expose guidance without expansion and use the same refresh/FAQ controls.
- Supervisor guidance reads configured document labels/requiredness and existing upload limits, with the recorded replacement rule for assigned supervisors. Panel guidance is specific to its five readiness states. Removed generic process, repeated confirmation, lock placeholders and large help cards. No demo records or staff business workflows were changed.
- Verification passes all 76 frontend regression files, TypeScript, the final production build and both production security/artifact guards. The authenticated guidance regression failed before implementation and passes afterward. SSR checks cover all four pending Panel states with deliberately populated private fields, confirmation mismatch, configured required/optional documents and empty/error guidance.
- Live Demo Student One checks pass on both pages at 390 and 1280 px: visible guidance, refresh recovery, shared computed typography and no horizontal document overflow. The Supervisor refresh action reloads applications and remounts the team so View/Change actions, history and guidance use updated records. View appointment opens the current application 6. No submission, cancellation or approval was executed; pending states and guidance failures are covered by rendering tests rather than simulated live records.
- Mobile visual inspection exposed Previous applications text squeezed to 19 px by action controls. Rows now stack text above actions below sm; the width regression and visual inspection pass. Focused read-only review verified the refresh fix and found no material remaining issues. Staff compatibility uses the unchanged branch plus existing regression/source coverage, not a new exhaustive staff browser audit.
- Updated all three mandatory project documents. Saved student-supervisor-consistent.png and student-panel-consistent.png in the task visualization directory; reset temporary viewport overrides, retained the Panel preview and confirmed no browser warnings/errors. Changes remain uncommitted.

## Student Supervisor page simplification (2026-10-10)

- Implemented the approved three-section Student layout. Removed the erroneous self-selection dropdown and duplicate Student team timeline; compact research cards expand to show changed fields, reasons and recorded approval events. Previous applications use responsive rows with the existing workflow drawer. Supporting histories, research profile/revisions, guidance, cancellation and eligible submission remain accessible.
- Replaced the misleading current-title display from a historical Supervisor application with the current research profile title. Staff presentation and authorization retain their existing behavior; no demo records were changed in this task.
- Verification passes all 75 frontend regression files, TypeScript, production build, both production artifact/security guards, whitespace and UTF-8/CRLF checks. The new Student request regression failed before implementation and passes afterward. An existing case-sensitive Change Supervisor contract caught a changed label; the original label was restored and the full suite rerun successfully.
- Live Demo Student One checks pass at 390, 902 and 1536 px for the pending-request overview, closed comparisons, expanded abstract/title/profile histories, cancellation reason focus/validation and original application drawer. Computed typography passes in default and expanded states with no document-level horizontal overflow. No cancellation, submission or approval was executed.
- Live populated Lecturer compatibility checks retain the staff Student selector, full comparisons, Endorse/Reject controls and consistent typography (94 checked elements). Other staff compatibility is covered by shared-component regressions and explicit role wiring/source review; this is not a new exhaustive staff browser audit.
- Restored Demo Student One on Supervisor Appointments, with the viewport override reset and no browser warnings/errors. Preview: student-supervisor-simplified.png in the task visualization directory. Updated all three mandatory project documents. Changes remain uncommitted.

## All-role typography audit and correction (2026-10-10)

- Audited all 109 production portal components across Student, Lecturer, Programme Coordinator, Office Staff/Admin, shared controls and authentication. Corrected inherited and nested styles, responsive overrides, detail metadata, table/control text, shared semester fields and equivalent summary counts.
- Rendered checks pass for 53 role/page combinations and 67 page/state checks, including populated appointment details, expanded Student research/request histories, Office Panel audit history and representative mobile/wide widths. A computed-style regression caught and verified corrections for File Repository filters and populated Office Timeline/workload/Panel tables.
- Final verification passes all 75 frontend regression files, TypeScript, production build, both production artifact/security guards and whitespace checks. The complete evidence/limitations report is `docs/PORTAL_TYPOGRAPHY_ACCEPTANCE_2026-10-10.md`.
- Registry reads still return an existing backend 404; its controls/error states pass, while populated Registry data remains unverified in-browser. The scoped Coordinator queues and Lecturer Marks page are empty in these fixtures; corresponding populated forms remain source-reviewed and regression-covered. These are explicit limits, not claims of exhaustive browser acceptance.
- Preserved existing workflow/data/privacy changes, intentionally distinct document/identifier/badge/editor styles and credentials. Restored the browser to Demo Student One on My Academic Record. Changes remain uncommitted.

## Populated Supervisor typography correction (2026-10-09)

- The earlier explicit-heading/paragraph audit missed inherited `text-sm`, unstyled summaries and nested labels in populated Supervisory teams and Research amendments. The earlier claim of complete font consistency was too broad; the user's populated screenshot exposed the gap.
- Corrected shared team/research comparison, reason, timeline, request/revision/audit history and decision-form styles. Student and staff consumers share those components. Also corrected the same inherited pattern in staff carryover capacity cards and aligned Student Supervisor hero/application-detail metadata and table text with the existing roles. Controls, status colors, workflow behavior and authorization are retained.
- Live verification checks 115 computed text elements in the populated Student team/research view, including expanded histories: Inter with 14 px/800 compact headings, 12 px/600 labels, 12 px/700 values and 12 px/500 supporting text. Fifteen application-detail fields and the decision textarea also match their shared roles; normal metadata/title text no longer inherits uppercase/italic styling.
- Responsive inspection revealed that the supervisor hero squeezed its metadata to 40.8 px at the default 902 px viewport. Identity, metadata and actions now stack below 2xl. Verified full-width metadata at 390 px and 902 px, and a readable row at 1536 px, with no document-level horizontal overflow. Browser console has no warnings/errors. Captured the corrected populated page as `supervisor-typography-corrected.png` in the task's visualization directory.
- All seven focused frontend regression suites pass. Final TypeScript, production build and both production artifact/security checks pass after the breakpoint adjustment. Whitespace validation passes. Independent source reviews found no actionable issues in these four components or the breakpoint correction. Staff coverage in this correction uses shared components, capability regressions and source review; it is not exhaustive browser acceptance of every staff page. No database, API or dependency changes were required.

## Demo Student One populated preview (2026-10-09)

- At the user's request, populated local development account `DEMO-STUDENT-001` with two Supervisor requests (rejected and approved), one active primary Supervisor, two Panel nominations (rejected and approved), one active Panel appointment, and an approved research profile. Each Supervisor request includes a clearly marked fictional PDF proposal uploaded through the existing validated private-document endpoint.
- Added one approved research-title amendment and one pending abstract amendment using the existing amendment services. The Student Dashboard now has four persisted action items: the pending research request and three active/upcoming milestones. Student academic-record tabs remain Supervision, Panel and Milestones; the Student API still returns null Marks data and no Marks section.
- Added four explicitly labelled demo Student milestones to the current `2026-2027-S1` semester: one completed, one active and two upcoming. Timelines are semester-wide, so these entries also appear for other local Students in the active semester. The previous legacy timeline remains unchanged.
- Created a separate AI programme demo Coordinator profile to perform the required scoped approvals; the existing Cyber Security Coordinator scope is unchanged. The new demo Coordinator has an unusable password, and existing account credentials/permissions were not changed. Existing Supervisor/Panel capacity policies, normal authorization, approval services and audit generation were retained.
- Verification: authenticated endpoint reads, persisted public/internal dossier assertions and a repeated seed run pass; the second run creates no duplicates. Live Student browser checks show populated Supervision/research, Panel and Milestone records. No application code, schema or dependency changes were required; the three governance documents were checked and existing requirements/architecture remain applicable.

## Student evaluations belong to the central system (2026-10-09)

- Source review found older PDF FR-30/UC14 allowing evaluation-task information and UC06 mentioning linked Marks records. The Student dossier exposed redacted task periods/status/deadlines. The user's clarified boundary supersedes that older wording: students view evaluations/results in the university's central system, outside this portal.
- Completed: excluded Student Marks at the backend access boundary and in frontend PUBLIC tabs/rendering, preserved staff Marks access, removed evaluation wording from student copy, and updated the three source-of-truth documents plus acceptance checklist W033/W038. The earlier academic-record acceptance entry below describes the previous behavior; its Evaluations tab is superseded by this correction.
- Regression tests reproduced the old disclosure before the fix and now assert that populated and unprofiled Students receive no Marks section/status/attention and that stale PUBLIC section lists cannot render Marks. All 42 backend dossier/report/dashboard-timeline tests pass in 234.016 seconds using a uniquely named disposable PostgreSQL test database; four focused frontend tests, TypeScript, the final production build, both production artifact/security checks and whitespace validation pass. Review's remaining student empty-state copy finding is corrected. Live Student browser verification shows only Supervision, Panel and Milestones, with no console warnings/errors. Original academic PDFs await revision from editable sources; no schema, stored evaluation or staff workflow changes were made.

## Wider portal typography review (2026-10-09)

- Audited equivalent explicit card/section headings and supporting paragraphs across portal components. Replaced 346 matching styles across 70 components with shared heading/supporting roles; additionally aligned shared summary/audit/validation/workload cards and student Settings, appointment metadata and letter-template descriptions.
- Added compact caption and summary-metric roles, and loaded Inter 900 for existing black-weight emphasis. Kept identifiers, badges, controls and document previews distinct and preserved all workflow behavior and data.
- Verification: all 73 frontend regression test files, TypeScript checks, the production build, both production artifact checks and the whitespace check pass. Independent review found no actionable issues in the role/style changes, semantic colors or document-preview exclusions.
- Live Student Settings inspection confirms Inter with 12 px/600 labels, 12 px/700 values, 12 px/500 descriptions and 14 px/800 compact headings. Student Panel desktop/mobile inspection confirms readable metadata/guidance, retained light text on the dark card and no document-level horizontal overflow at 390 px. Browser checks sample the Student surfaces; the broader staff modules are covered by source review and existing regression checks rather than a claim of exhaustive visual acceptance.

## Student academic record and typography (2026-10-09)

- Updated the Student Dashboard link and student progress route to "View My Academic Record" / "My Academic Record". Student records open on supervision history rather than a duplicated overview, while staff dossiers retain their operational summaries and attention items.
- Moved public "Enrolment Status" into the identity card and hid the change-date row when no persisted change exists. Internal lifecycle reason, actor and audit history remain available; public privacy guards and Malaysia timestamps are retained.
- Added shared card text styles and applied them to affected student dashboard and academic-record metadata. Kept supervision, supporting-supervisor, research/programme changes, panel, evaluation and milestone records on their existing routes and APIs.
- Verification: regression tests first reproduced the misleading absent-date row and repeated student Overview, then passed after implementation. All 73 frontend test files, TypeScript checks, the production build and both production artifact checks pass. Independent diff review found no actionable regression.
- Live browser smoke on `127.0.0.1:3001` confirms Student Dashboard navigation, the first selected Supervision tab, absent-date suppression, and working Panel/Evaluations/Milestones tabs. Desktop and 390 px mobile layouts were inspected; mobile has no document-level horizontal overflow and the browser console has no warnings/errors. This demo student has no appointment/evaluation history, so populated record rendering was not newly exercised in the browser; existing regression suites remain the evidence for those paths. No backend or database changes were made.

## Owned-workflow integration completed (2026-10-09)

- User authorized pushing the accumulated changes, creating a PR and merging into `main`. [PR #13](https://github.com/Weychenglim/FSKTM_Postgraduate_Office_Mangement_System/pull/13) merged the 64-file release on 9 October Malaysia time, with commit `fc8265a3b22e15430be6349955f7a240b72c7bfa`. Its reviewed source commit is `2bc5ba9b3ecb17b1a1354acecc4d4087d2447410`, based on `9ee3bd4`; no upstream conflict required resolution. Local `main` was fast-forwarded to the merge and its backend/frontend tree verified identical to the tested source. Existing work is preserved; private environment files, credentials, runtime logs and synthetic databases remain excluded.
- Fresh verification passes **all 683 backend tests in 604.078 seconds** with two isolated test workers, all **75 frontend test scripts**, TypeScript and production build (6.05 seconds), Django checks, migration-drift, whitespace and documentation source/link checks. Independent integration review found no actionable issues. GitHub reported the PR mergeable with a clean merge state; there were no reported remote status checks. This release record changes documentation only after the application merge.
- This integration includes completed acceptance fixes and their documentation. Technical-only Django admin access and business/admin permission separation remain pending T01-T06; this PR does not implement that proposed shared change or complete deferred policy/production-host work.

## Main Sync: Teammate Settings Adopted (2026-10-08)

- Merged `origin/main` (`9ee3bd4`) into `Xiang`.
- **Settings.** Both branches had built Settings; the team kept the `main` version. The Settings screen uses `GET/PATCH /api/auth/settings/` and `POST /api/auth/settings/password/` (signs the user out after a change), and announcement alerts are stored on `User.announcement_alerts`.
- **Still used from `Xiang`.** `POST /api/auth/me/change-password/` for the forced first-login change (`ForcedPasswordChange`), and duplicate-proof announcement delivery (`event_key`), which now also skips recipients with announcement alerts off unless the announcement is Urgent.
- **No longer used by the frontend.** `PATCH /api/auth/me/` (phone), `/api/auth/me/notification-preferences/`, the `NotificationPreference` table and the matching `authApi` helpers. They are kept for now; remove them or fold them into `/api/auth/settings/` when Phase 8 adds email, deadline and weekly-summary preferences.
- Migration `accounts.0007` joins `0006_registry_import_batch` and `0006_user_announcement_alerts`.
- **Integration fixes.**
  - An account that must change its temporary password can now also use its own Settings (`GET/PATCH /api/auth/settings/` and `POST /api/auth/settings/password/`). Everything else stays blocked until the password is changed.
  - `apiClient` no longer clears an already-dropped token on a 401. Clearing it bumped the session version, so a password change that finished alongside a revoked request did not send the user back to sign in.
  - `types/auth.ts` had `phone` declared twice after the auto-merge; one copy was removed.
- **Verification.** 768 backend tests pass with `--parallel 2`. With `--parallel 4`, the PostgreSQL concurrency tests lost their connections on this machine, matching the teammate's earlier note. Django checks, migration-drift and whitespace checks pass.
## Consolidated pending work and decisions (2026-10-08)

- Start with [the pending-work register](docs/PENDING_WORK_REGISTER_2026-10-08.md). It preserves the user's technical-only Django admin direction and separates implementation tasks T01-T06, acceptance slices A01-A07, release/deployment work, teammate integration gaps and deferred policy decisions. Creating this document did not implement the access change.
- Latest source inspection confirms `is_staff` dependencies beyond Marks: participant lifecycle, research amendments/transfers, capacity reassessment and acting Coordinator delegation. Ordinary core Timeline/academic configuration and many workflow views already use role/scope checks. Permission separation must cover the shared dependencies; do not simply clear Office staff flags or expand their admin permissions.
- The next proposed implementation slice is T01-T06, before resuming supporting-supervision acceptance. Existing completed reports remain valid within their stated scope; the checklist still contains 406 source bullet clauses, 48 Passed and 358 Awaiting acceptance. Routine Registry/account management remains a separate incomplete integration, so technical account provisioning may still be needed until its owner completes it.

## Fresh local servers and tester guide (2026-10-08)

- Checked for prior project Django/Vite servers; none remained running at the start of the requested fresh restart. Started Django 8000 and portal 3001 from the current `main` working tree and existing `fsktm_pg_office` development database, with mocks/demo login disabled. Both return HTTP 200. Synthetic acceptance services remain stopped; their databases/evidence are retained. No reseeding, password reset or permission expansion was performed.
- Added the [simple end-to-end guide](docs/SIMPLE_END_TO_END_TEST_GUIDE.md): role-by-role happy path, rejection checks, remaining owned-module acceptance and teammate-owned Registry/File/FAQ integration gaps. Live permission inspection confirms the demo Office account is staff, not superuser, with model permissions only in Marks. Other admin apps are registered; this menu reflects account permissions, not absent data or a Marks-only system.
- Next human testing starts with Office setup, then Student → Supervisor → Coordinator → Panel → Coordinator → Marks → reports. Next development acceptance remains supporting supervision, amendments/transfers, delegation/carryover and remaining reporting/Timeline branches. Current changes are uncommitted/unpushed; this restart does not establish production readiness.

## Participant lifecycle acceptance (2026-10-08)

- Browser scenarios completed in isolated synthetic data: mandatory reasons; deferral; open/closed-period reactivation; withdrawal; blocked graduation, pending cancellation and successful graduation; Retiring, blocked final retirement, pending cancellation, appointment ending and Retired. Independent assertions confirm expected appointments/workflows, eight participant audits, eight task lifecycle audits, unchanged scores/comments/feedback/submission dates on all twelve entries, disabled retired login and blacklisted refresh session.
- Corrected demonstrated read races/outage authority in lifecycle management, omitted dossier lifecycle metadata, ended Supervisor labels and Office cancellation projections/attribution in Supervisor/Panel lists and assigned Lecturer histories. Browser regressions and internal/public dossier privacy checks pass. No migration, new dependency or account-permission change was required.
- Verification: 37 baseline backend tests passed before changes; final sequential verification passes **253 backend tests in 529.696 seconds**. After the final review corrections, **75 frontend test scripts**, TypeScript and the production build pass (build **21.31 seconds**); independent review has no remaining actionable findings. Django checks, migration-drift, whitespace and documentation checks pass. Two overlapping test runs invalidated their shared test database; those runs are discarded. A subsequent new history regression used the wrong reviewing actor, was corrected, and passes in the sequential rerun. This is scoped lifecycle acceptance, not whole-system or deployment certification.
- The checklist now contains **406 clauses: 48 Passed, 358 Awaiting acceptance**. Selected Panel history includes Office cancellations before a decision, with a Cancelled filter; timelines preserve prior Panel acceptance when cancellation occurs during Coordinator confirmation. Student Supervisor history also treats Office cancellation as terminal.
- [Acceptance report](docs/PARTICIPANT_LIFECYCLE_ACCEPTANCE_2026-10-08.md) and E9 checklist keep unexercised supporting-appointment, coordinator responsibility/delegation, audit-outage/concurrent-transition and original-appointment-ended combinations awaiting acceptance. Next development slice is supporting supervision membership/replacement, then amendments/transfers, delegation/carryover and remaining Dashboard/Timeline/report/export/reconciliation branches. Production-host checks and deferred faculty/coordinator identity decisions remain separate. Changes remain uncommitted/unpushed.

## Submitted Marks portal migration completed (2026-10-07 to 2026-10-08)

- Authorized Office Staff/Admin can correct submitted scores/comments or reopen for the assigned Lecturer through Marks Entry → View Mark Records → record detail. Existing staff/model-change permissions, required reasons, score bounds, submission locking, transactional audits and open-period reopening rules are preserved. Reviewed-state versions reject stale edits; history displays named before/after values. Mark Entry Django admin is inspection-only, including for superusers.
- Browser acceptance on 7 October uses a fresh synthetic database: missing reason/negative/no-op/cancel handling; 80→85 correction; newer 86 correction with stale second-tab rejection/reload; reasoned Draft reopening; assigned Lecturer revision/resubmission at 88; closed-period correction 80→82; inspection-only Office and admin views. Independent assertions confirm exactly four audits, expected actors/reasons/scores/comments, preserved closed submission date and new resubmission deadline snapshot, and unchanged unrelated Draft 46. See [portal Marks acceptance](docs/MARKS_PORTAL_ACTIONS_ACCEPTANCE_2026-10-07.md).
- Final 8 October rerun passes all **142 Marks backend tests** in **196.017 seconds**, including PostgreSQL simultaneous-correction and closure/reopening races. The 7 October run passed all **73 frontend test scripts**, TypeScript and production build; Django checks, migration-drift, whitespace and documentation checks pass. Independent scoped review found no actionable code issue. No schema/dependency changes were required. This is scoped Marks acceptance, not a fresh whole-backend or production-host certificate.
- All three source-of-truth documents and the whole-system manual guide now describe portal mutations and inspection-only admin. The checklist contains **403 clauses: 44 Passed, 359 Awaiting acceptance**, with E8 superseding E3's historical editable Marks-admin path. Next acceptance covers participant lifecycle, supporting supervision, research amendments/transfers, delegation and carryover, followed by Dashboard/Timeline/report/export/dossier/reconciliation combinations. Earlier browser limitations, production deployment checks and deferred faculty/coordinator identity decisions remain open.
- Changes remain uncommitted/unpushed; earlier unrelated work is preserved. Isolated 8013/3013 servers are stopped and their synthetic database/evidence retained. On 8 October both normal local services were restarted from the current `main` working tree and return HTTP 200: Django 8000 and portal 3001, using the existing development database with mock/demo login disabled. Existing account authority/passwords were not changed.

## Advanced Marks targeting, semester and completion-window acceptance (2026-10-07)

- Completed browser acceptance in a fresh synthetic database for AI Supervisor-only and Data Science both-role previews/publication/generation, reasoned Backup assignment, drawer scope changes, historical/current Lecturer semester filters, reviewed early closure, completion-window grant/renewal/revocation and actual-clock Panel expiry. Independent API probes confirm authority, duplicate/scope/identity rejection, archival blocking and unchanged state after failed writes. Details and evidence are recorded in [advanced Marks acceptance](docs/ADVANCED_MARKS_ACCEPTANCE_2026-10-07.md).
- Fixed three demonstrated defects: backup Student selection incorrectly excluded historical research-profile semesters; assignment options returned stale profile programme rather than authoritative linked Student programme; Office monitoring labelled multiple-semester totals as one active semester. Scoped regressions and browser rechecks pass. No migration/dependency or official appointment change was required.
- Final invariants pass: seven tasks, four unchanged active Supervisor and four active Panel appointments, one Backup override audit, six configuration audits, five windows and eight window audit events. Historical submissions remain 85/80; recovered Supervisor submission is 90 with its exact window/deadline snapshot; revoked Backup Draft is 46 and expired Panel Draft is 50. All periods remain CLOSED; failed writes preserve marks/comments/timestamps.
- All **126 Marks backend tests** pass in **152.338 seconds**; all **70 frontend test scripts**, TypeScript, production build, Django checks, migration-drift and whitespace checks pass. Independent scoped review found no critical or important issues. The **398-clause** checklist adds E7 and keeps unexercised semester-handover, participant/task lifecycle and report/export/dossier combinations awaiting acceptance. This is not a fresh whole-backend or whole-system acceptance claim.
- Next development acceptance covers participant lifecycle, co-supervisor membership/replacement, research amendments/programme transfers, acting-delegation revocation and carryover reassessment. Earlier E6 browser file-saving/native-alert/availability-date limitations remain separate; successful native date entry here applies to completion controls. Production shared-cache/host checks and deferred faculty/coordinator identity decisions remain open. Changes remain uncommitted/unpushed. Isolated 8012/3012 services are stopped after verification, with database/evidence retained and normal 8000/3001 services available.

## Appointment rejection, capacity and private-file acceptance (2026-10-07)

- Completed a fresh isolated negative-path slice: Supervisor and selected Panel rejection, subsequent attempts, Coordinator rejection, required reasons, disabled full candidates, missing/unsupported/oversized/malformed uploads, and final approval conflicts after capacity/availability change. Office details retain both Panel rejection stages, reasons and workflow timestamps. The late pending requests were API preconditions; effective October availability was corrected through audited Office APIs after browser date filling retained its September default.
- Live private-file HTTP checks passed for four authorized actors and rejected six unrelated actors, unknown file IDs and anonymous access. Independent public-response checks retain only the confirmed Student Panel identity, hide unavailable Panel candidates and exclude the internal Office availability reason.
- Final persisted checks retain two active incumbents, one unchanged research profile, four unchanged entries/totals (85, 80, 46 and 39), three valid private documents, fourteen workflow events and fourteen capacity audits including the fixture correction. Failed approvals create no appointment lifecycle, Marks handover or task-lifecycle audits; both pending requests remain pending.
- Browser acceptance exposed one frontend defect: Office Panel summary inferred AVAILABLE from seat occupancy despite backend temporary unavailability, and labelled an ineligible lecturer FULL LOAD. Corrected the summary to use authoritative capacity state/public end date. A rendered React regression reproduced the incorrect label before correction; the regression and browser recheck pass. Verification commands and final frontend results are recorded in `docs/APPOINTMENT_FAILURE_PATH_ACCEPTANCE_2026-10-07.md`.
- All **91 affected Appointments backend tests** pass in **478.759 seconds**. All **69 frontend test scripts**, TypeScript and the production build pass; Django checks, migration-drift and whitespace checks pass. Independent scoped review found no critical or important issues. This is not a new full-backend or whole-system acceptance claim. The **396-clause** checklist adds this evidence as E6 and keeps browser download saving, native-alert handling/date entry and unexercised compound requirements awaiting acceptance. Next development acceptance covers advanced Marks targeting/backups, historical-semester filters and completion windows, followed by remaining lifecycle branches. Faculty rules/coordinator identity and production-host checks remain separate. Changes are uncommitted/unpushed; isolated services are stopped after verification while normal 8000/3001 services remain available.

## Supervisor and Panel cancellation/replacement acceptance (2026-10-07)

- Completed synthetic browser cancellation and replacement through Student, incumbent/incoming Supervisor, incumbent/incoming Panel, scoped Programme Coordinator and Office views in a separate PostgreSQL database. Empty cancellation reasons reject; cancelled attempts remain in history; incumbents remain active until final approval; both successors activate with replacement lineage. Supervisor handover retains the current Panel and system-cancels the outgoing Supervisor's pending Panel nomination.
- Independent persisted checks retain one research profile, submitted scores/comments/totals of 85 and 80, and immutable retired draft snapshots of 46 and 39. Final state has eight tasks, four original entries, four clean successor tasks, four appointment lifecycle events, twelve workflow events and exactly two handover plus two task-lifecycle audits.
- Browser checks exposed and corrected three frontend defects: static Student Dashboard appointment status/name examples, distinct same-day cancelled Panel attempts being collapsed, and retired drafts inflating Office Marks monitoring. Browser rechecks confirm real current names, both cancelled attempts and operational monitoring of 2/6 submitted with zero active drafts. Mounted API-outage/Retry testing hides cards during failure/loading and restores both current appointments without a page reload.
- All **77 affected Appointments backend tests** pass in **163.028 seconds**. All **68 frontend test scripts**, TypeScript and the production build pass after the fixes; Django checks, migration-drift and whitespace checks pass. Independent read-only review found no critical or important issues. Details are in `docs/APPOINTMENT_REPLACEMENT_ACCEPTANCE_2026-10-07.md`; this is not a fresh full-backend-suite or whole-system acceptance claim.
- The five-module checklist now includes **395 individual in-scope clauses** and records this completed slice separately from still-unverified compound requirements. Next browser work covers rejection, private-file and capacity/availability failures, followed by advanced Marks and lifecycle branches. Faculty rules/coordinator identity remain deferred; production deployment checks remain separate. Changes remain uncommitted/unpushed. Normal loopback services on 8000/3001 remain available; isolated 8011/3011 services are stopped after verification and their synthetic database/evidence are retained.

## Django admin acceptance and five-module checklist (2026-10-06 to 2026-10-07)

- Real admin HTTP probes reproduced invalid Marks correction/closed-reopening server errors, unaudited evaluator and period-semester reassignment, draft comment edits, and deletable Marks audits. Further probes reproduced shared semester closure and capacity/availability writes outside the portal audit services.
- Corrected these admin boundaries while preserving the authorized, reasoned Marks correction/reopening services. Negative and non-finite correction input now rejects with form validation; governed configuration, assignments, drafts and immutable audits are inspection-only. Existing research-profile provisioning and account administration were not changed.
- Synthetic browser acceptance confirmed reason rejection, invalid-score rejection, correction from 80 to 85 with actor/reason/before-after audit, reopening to Draft, closed-period reopening rejection, and permitted post-closure correction to 86. Independent ORM assertions confirm preserved scores/status and exact audit counts. Lecturer resubmission and period closure were API preconditions for the closed-period admin checks, not additional portal-browser acceptance.
- Integrated shared Academic/Marks/admin regression verification passes **186 tests** in **178.565 seconds**. Two final permission/stale-form checks pass in **5.619 seconds** (**188 distinct affected tests** across those runs). A fresh 7 October admin-boundary recheck passes **29 tests** in **63.403 seconds**. Django system/migration-drift and whitespace checks pass; no schema or dependency change. Independent read-only review found no critical or important issues. Details and command scope are recorded in `docs/DJANGO_ADMIN_ACCEPTANCE_2026-10-06.md`; no fresh full-backend/frontend-suite claim is made.
- `docs/FIVE_MODULE_ACCEPTANCE_CHECKLIST.md` tracks **392 individual in-scope source clauses**, existing screens/API boundaries, regression candidates and remaining browser evidence. Preparing the checklist does not claim all advanced branches passed. Faculty rules/coordinator identity remain deferred and actual production deployment checks remain separate. Changes are currently uncommitted.
- On 7 October the normal loopback Django/Vite servers were restarted from the current working tree on ports 8000/3001; direct/proxied health and the existing Office account's restricted admin sign-in passed. Port 8010 acceptance services are stopped. Credentials, account permissions and development academic records were preserved; the new code has not been committed/pushed.

## Latest-main server and whole-system test handoff (2026-10-06)

- Confirmed the application fixes are on `main` and remote, then started loopback Django on port 8000 and Vite on port 3001 against `fsktm_pg_office`; mock/demo login is disabled. Docker's existing port 3000 was preserved. Django checks, migration state, direct/proxied health and real Office browser sign-in/dashboard were verified.
- Inventoried all eight development accounts and checked their configured passwords without changing accounts or access. The private account sheet/launchers/logs remain ignored. The Coordinator currently has Cyber Security scope; the human tester must grant acting AI scope through Office UI before the fresh Student's approval flow.
- Added `docs/WHOLE_SYSTEM_END_TO_END_TEST_GUIDE.md` covering all modules and advanced lifecycle branches. Registry, general Files and FAQ persistence remain incomplete; some positive replacement/transfer/supporting-supervision scenarios need additional actors. The guide records these prerequisites and integration gaps. Whole-system manual acceptance is not claimed complete by preparing this handoff.

## Full workflow browser integration (completed 2026-10-06)

- User authorized a complete Student request, Supervisor review, Coordinator approval, Panel appointment, Marks submission and semester-closure walkthrough across the five owned modules.
- The isolated synthetic browser chain reached semester closure: one approved primary appointment, one distinct confirmed Panel appointment, two submitted evaluations (85/100 and 80/100), a Closed evaluation period and a Closed semester. Persisted assertions passed after each transition; the Office reconciliation scan shows zero inconsistencies and submitted Marks remain read-only.
- Corrected the null optional Panel payload, stale Coordinator approval history/team data, stale semester-closure audit history and inconsistent UTC/Malaysia appointment dates. Separate-fixture browser rechecks confirm automatic approval refresh and audit Retry after a completed closure; exactly one closure audit remains. Independent scoped re-review reports no remaining important findings.
- All **222 Appointments tests** pass in **1902.342 seconds** using two PostgreSQL workers. All **66 frontend scripts**, lint, build and production guards pass; date checks pass under UTC, Malaysia and New York. Django checks, migration-drift checks and whitespace checks pass. No schema or dependency change is required. Existing development and prior acceptance data remain separate. Evidence and remaining production/policy limits are recorded in `docs/WORKFLOW_INTEGRATION_ACCEPTANCE_2026-10-06.md`; no additional full 623-test backend run is claimed.

## Shared cache and local release acceptance (completed 2026-10-05)

- The five owned-module fixes were committed and pushed to `main` as `30c63ba`.
- Added environment-selected PostgreSQL authentication cache, safe production default and rejection of process-local/unknown configuration. All **94 Accounts tests** passed in **397.647 seconds**, including four settings regressions and two independent-process HTTP probes for shared login/reset/confirmation budgets. Deployment requires `createcachetable`; provisioning, runtime permissions, monitoring and proxy checks are documented in `deploy/RELEASE_RUNBOOK.md`.
- Local browser acceptance used synthetic accounts in a newly created, isolated PostgreSQL database with loopback-only services and demo/mock modes disabled. Draft/Active Timeline writes and audits, Student replacement submission/candidate exclusion, stale Coordinator approval rejection, period-based Lecturer filtering, native negative-score rejection, valid drafts, locked history, four-role Settings persistence and governed admin details were verified. Persisted-data assertions confirmed the expected targets, scores and unchanged appointment state.
- Browser acceptance exposed and corrected a selected-semester calendar/summary mismatch and Timeline admin write/audit bypass. Review also found an initial semester-list Retry failure; browser reproduction confirmed it before correction and recovery without reload afterward. All **87 Dashboard/Timeline backend tests** pass in **124.899 seconds**, including two new admin tests. All **64 frontend scripts** passed; final affected tests, lint, build and both production guards pass after the Retry correction. Django system checks, migration-drift checks and whitespace checks pass. Independent read-only re-review found no remaining important findings.
- Evidence and exact acceptance limitations are recorded in `docs/BROWSER_ACCEPTANCE_2026-10-05.md`; logs/screenshots and synthetic fixture credentials remain outside Git. The earlier complete 623-test backend run predates this follow-up; affected Accounts and Dashboard suites were rerun, without claiming another full-suite run.
- No production host, domain, server or production database was supplied/provisioned. Real HTTPS/proxy, SMTP, backup/restore and faculty acceptance remain release gates. Successful browser password change/re-login requires human completion under the browser tool's credential-entry policy; negative form validation was verified and backend password-change/session tests passed. Faculty rules and coordinator identity policy remain deferred. No public deployment is claimed.

## Owned-module integrity fixes (completed 2026-10-04)

- Implemented reciprocal primary/Panel conflict checks at submission, final approval and shared activation (including Office reconciliation repairs), accepted the Add Entry `semesterId`, closed appointment/configuration admin writes, added nonnegative Marks input validation and corrected period-based task semesters/dynamic Lecturer filters. Existing appointments, drafts, history, initial profile provisioning and audited Marks correction remain covered.
- Regression tests reproduced the original defects before fixes. The full Accounts/Academics/Appointments/Dashboard/Marks suite passes **623 tests** in **519.465 seconds** using two PostgreSQL workers (**29 new tests** beyond the reviewed 594-test baseline). Initial 24-test, expanded 104-test and final 28-test focused runs also pass, including competing submissions, Office repair rollback and controlled missing-Student handling. Evidence is in the ignored `backend/final-fix-full.log`, `final-fix-focused.log`, `final-fix-affected.log` and `final-fix-review-green.log` files.
- All 63 frontend scripts, TypeScript lint, production build and both artifact guards pass. Django system checks, migration-drift checks and whitespace checks pass; no migration or dependency change is required. Independent read-only re-review reports no remaining important findings.
- The user authorized committing and pushing the verified fixes on 2026-10-04, followed by shared-cache configuration and browser acceptance. Hosting/faculty acceptance and coordinator identity policy remain release/deferred work; no public deployment is claimed.
- The listed owned-module browser scenarios were subsequently verified in the 2026-10-05 acceptance section above. The original 2026-10-03 review handoff remains preserved as historical evidence; its five findings are addressed by this slice.

## Final Owned-Module Review (2026-10-03)

- Reviewed only the five owned modules and their shared configuration dependencies at `main` / `256ee60`. No application code changed. The existing owned/backend regression suite passed **594 tests**, but targeted review uncovered gaps not covered by that suite.
- Confirmed development findings at review time (subsequently addressed in the completion section above): primary Supervisor replacement overlapping the student's active Panel role; frontend selected-semester Timeline creation rejection; Django-admin bypasses of governed appointment/configuration services; negative new Marks scores causing insertion failure; and incorrect Lecturer Marks task-semester data/hardcoded filters.
- Three isolated diagnostic probes confirmed role overlap, negative-score database failure and stale task-semester presentation. Direct serializer/admin-form inspection confirmed the Timeline rejection and editable administrative fields. Probe successes confirm bugs, not corrected behavior.
- Findings, evidence, limitations, production configuration dependencies and next-session instructions are recorded in `docs/HANDOFF_FINAL_OWNED_MODULE_REVIEW_2026-10-03.md`. Parallel reviewers stopped at a usage limit; the listed findings were subsequently verified directly. Browser acceptance remains pending. No fixes, commit, push or deployment were performed in this review.

## Main Branch Integration (2026-10-03)

- Settings persistence was committed as `98a173d`. The carryover/configuration branch, including the preceding coordinator-delegation, Marks recovery and research-amendment work, was integrated and pushed to `main` at `11e91ae`.
- Merging the remote main history introduced no file changes relative to the tested Settings commit. Existing verification results above remain applicable; no additional test run is claimed for this Git-only integration.
- Browser acceptance remains blocked by the recorded browser-tool initialization error. Coordinator identity policy remains deferred. No deployment was performed.

## Account Settings Persistence (completed 2026-10-02)

- Completed real own-account phone and announcement-preference persistence, validated password changes, session revocation and truthful unavailable-notification labels. The user confirmed that email remains Office-managed. No additional academic or coordinator authority is introduced.
- Backend verification: Accounts and Announcements suites passed **87 tests**; the final Settings/migration subset passed **14 tests**, including five added cases (**92 distinct affected tests** overall). Django checks and migration-drift checks pass. The additive migration preserves existing account credentials, contact data, account flags and linked Student details.
- Frontend verification: **62 scripts** passed, along with TypeScript lint, production build and artifact guards. Review identified expired-token recovery and delayed-response session races; fixes and regression checks pass. Final affected API/session/rendering tests, lint, build and artifact guards pass. Independent re-review found no further actionable issues. Browser interaction acceptance remains pending.
- Applied Accounts migration `0006_user_announcement_alerts` to the local development database. Before/after account row counts and content fingerprints match for all pre-existing fields; existing accounts retain enabled announcement delivery by default. Settings was committed as `98a173d` and integrated into `main`; the preceding carryover/configuration work was committed as `1e1894e`.
- Browser acceptance attempted on 2026-10-03: browser automation failed before opening the app (`failed to write kernel assets: The system cannot find the path specified`), including one retry after resetting the browser runtime. No UI acceptance pass is claimed. Remaining manual checks: on a synthetic account, save a phone number and announcement preference, reload and confirm persistence; verify a rejected password change shows an error without a success message; change the password successfully, confirm return to login, and sign in with the new password. Repeat Settings access for Student, Lecturer, Coordinator and Office roles. Confirm email is read-only and unsupported notification services are labelled unavailable.

## Logical Configuration Corrections (completed 2026-10-01)

- Implemented the three approved follow-up fixes: literal spreadsheet exports, fresh backup assignments after retirement, and consistent Malaysia deadline entry/display. Prior carryover changes remain preserved.
- Backup regressions reproduced the original failures before the service change; 24 focused backup/targeting/handover checks passed afterward. XLSX round-trip and CSV prefix tests also failed before their fixes and passed afterward. Final integrated verification passes **166 affected backend tests** across Marks, Dashboard and appointment lifecycle in **148.956 seconds**, including concurrent duplicate backup requests. All **60 frontend scripts**, TypeScript lint, production build and production artifact guards pass. The timezone tests also pass under UTC, Asia/Kuala_Lumpur and America/New_York. Django system checks, migration-drift checks and whitespace checks pass. Independent scoped review found no remaining actionable issues. No new migration is required; browser walkthroughs were not rerun.
- Coordinator account identity remains deferred. This slice and the carryover work were subsequently committed and pushed as `1e1894e` on `codex/carryover-capacity`; no deployment was performed. Settings persistence is tracked separately above.


## Follow-up Logical Configuration Review (2026-09-30)

- A bounded follow-up inspection found three additional issues: spreadsheet formula interpretation of user text, retired backup-task reuse on reassignment, and inconsistent browser-local versus Malaysia deadline entry. The first two were reproduced using an isolated Django test database; a timezone probe confirmed the third. These findings were subsequently fixed and verified in the 2026-10-01 correction slice above.
- Details and recommended controls are recorded in `docs/LOGICAL_CONFIGURATION_REVIEW_2026-09-30.md`. The earlier passing regression results do not cover these newly identified scenarios. No application code, development academic data, commits or pushes were changed by this review.
- Coordinator/lecturer cross-account identity remains the deferred item from the original edge-case list. Settings persistence was subsequently implemented in the slice above; faculty/staging acceptance remains pending. Completion of the original list is not a claim of production readiness.


## Carryover Capacity Reassessment (completed 2026-09-30)

- User approved reasoned Office reassessment of pending Closed-semester Supervisor, co-supervisor and Panel requests against the effective Active semester capacity policy. Original request history remains unchanged; no capacity bypass or automatic approval is introduced.
- Implemented the append-only capacity reassessment ledger, staff-scoped API, Office controls and coordinator history in existing Supervisor Appointment screens. Authorizations preserve the original request and recheck current policy at activation; archived manual decisions are locked. Latest-event tokens reject stale forms after revocation.
- Verification: all **573 backend regression tests passed** across Accounts, Academics, Appointments, Dashboard and Marks in **436.311 seconds** on two PostgreSQL workers. The final archive-guard regression and corrected real-deferral fixture both passed separately (**2 focused checks**, one additional distinct test). Coverage includes migration preservation, reassessment decisions, permissions, capacity exhaustion and PostgreSQL concurrency. All **58 frontend scripts**, TypeScript lint, production build and artifact guards passed; the final event-token change was rechecked with its affected tests, lint, build and guards. Final Django system and migration-drift checks pass.
- Applied `appointments.0015_capacity_reassessment` to the local development database. Before/after row counts and content fingerprints match across all **44 existing Accounts/Academics/Appointments/Marks models**; no existing academic data changed. Verification evidence is retained outside Git in the local temporary directory.
- Independent review findings for stale authorization after revocation and incomplete archived-decision guards were fixed; bounded re-review reports no remaining substantive findings. Browser initialization timed out, so browser acceptance remains unverified. Changes were subsequently committed and pushed as `1e1894e` on `codex/carryover-capacity`; no deployment was performed.


## Audited Research Amendments and Programme Transfers (2026-09-29)

- Implemented request/revision workflows, reasoned Office corrections, source/destination transfer approvals, existing-screen controls, lifecycle/nominations integration and scoped Dashboard/report/XLSX/dossier tracking. A repeated approval cannot advance a second stage implicitly, even when the same coordinator manages both programmes.
- Verification: 43 focused backend/reports tests passed, including concurrency, migration preservation and reconciliation; a further 13-test migration/lifecycle run passed after adding baseline-handover coverage and updating older migration test states (these runs overlap). All 56 frontend test scripts, TypeScript lint, production build, production artifact guards, Django checks and migration-drift checks passed.
- Full regression passed on 2026-09-28: **552 backend tests** in 903.371 seconds using `manage.py test accounts academics appointments dashboard marks --parallel 2 --noinput --verbosity 2`. The earlier PostgreSQL disk-full failure did not recur after storage headroom became available and concurrency was reduced; no unrelated files or databases were deleted. The local evidence is `backend/verification-final.log` (ignored by Git).
- Applied migrations `0013`/`0014` locally and verified unchanged fingerprints for 4 Students, 2 research profiles, 2 primary applications/appointments and 1 Panel appointment. Local Marks tables are empty; migration fixtures separately exercise preservation of assignments, drafts and submitted scores.
- Interactive browser acceptance completed in an isolated database copy: Student research submission, primary endorsement, coordinator final approval, Office meaning-preserving correction, Office transfer submission, source endorsement and destination approval with explicit team acknowledgements. Verified revision 3, synchronized programmes, destination access, outgoing history-only access, unchanged appointments/Marks and unchanged original academic records. Read-only Student/Lecturer/Coordinator/Office checks also passed. Faculty acceptance and additional staging scenarios remain release gates.
- Browser acceptance found an undefined coordinator waiting label. Added all three coordinator-stage labels and a failing-then-passing regression test. All 56 frontend scripts passed before this small fix; the affected test, lint, production build and artifact guards passed again afterwards. Dependency audit reports **zero vulnerabilities**. Final Django checks, migration-drift check and whitespace check passed. Independent bounded review found no critical or important amendment-workflow issues.
- Backup rehearsal restored a custom-format dump to a separate database and matched all **62 public tables** by row count and content fingerprint. Dumps and local acceptance data remain outside Git. No hosting server exists yet; `deploy/RELEASE_RUNBOOK.md` records provisioning decisions, configuration, backups, rollback and acceptance steps. No public deployment is claimed.
- User authorized committing and pushing the combined acting-coordinator, completion-window, research-amendment and release-preparation changes after verification.

## Letter Templates: Archive and Placeholder Validation (2026-09-27)

- **Archived status.** Letter templates gain an `Archived` status (migration `letters.0002_template_archived_status`). Archived templates keep their wording, never appear to students (hidden from the list, 403 by id), and can be restored to Draft or Active. The editor hides them behind a "Show archived templates" toggle, and the status field offers Archived.
- **Placeholder registry.** `letters/placeholders.py` lists all 16 supported placeholders with a label and the source of each value. `GET /api/letter-templates/placeholders/` exposes the list to signed-in users, and the editor's insert buttons now come from it, showing the source as a tooltip.
- **Validation.**
  - Creating a template, changing its content, or publishing it now rejects unknown tags (for example `{{STUDNET_NAME}}`) and malformed ones (`{{NAME}`, `{NAME}}`, `{{ name }}`). The response is 400 with `unknownPlaceholders` and `malformedPlaceholders`, and the message is shown under the content field.
  - A legacy template with a bad tag can still be archived, but cannot be published until it is fixed.
  - All four templates in the development database pass the new check.
- **Editor.**
  - The "Preview" buttons used to show a canned "validated successfully" message without checking anything. They are now "Check" actions that run the same rules as the server.
  - The live preview marks unknown tags in red.
- **Supervisor in letters.** `/api/auth/me/letter-details/` now fills `supervisorName` from the student's current primary supervisor instead of leaving it blank, so `{{SUPERVISOR_NAME}}` has a real source.
- **Parity.** A frontend test reads `letters/placeholders.py` and checks that `LETTER_PLACEHOLDERS` (tags and labels) matches it, that `substitutePlaceholders` fills every tag, and that the editor check agrees with the server rules.
- **Verification.**
  - **Backend:** **595 tests passed**, including 9 new letter-template tests and a letter-details supervisor test.
  - **Frontend:** all **55 test scripts** passed.
  - TypeScript lint, production build, production guards, Django system and migration-drift checks, and `git diff --check` pass. The migration was applied to the development database after a `pg_dump` backup.
- **Live smoke check** with temporary office and student accounts, all deleted afterwards:
  - A typo and a missing brace were each rejected with a clear message.
  - A valid template was created, archived (hidden from the student), and restored.
  - The placeholder endpoint listed all 16 tags and refused anonymous access.
  - Browser visual acceptance remains unverified.

## Registry Supervisor Data and Role-Scoped Read Access (2026-09-27)

- **Supervisor data.**
  - Registry records now carry `supervisor` and `supervisorStaffNo` from the student's active primary `SupervisorAppointment`. The data is only read from the appointments module, never written.
  - One prefetch loads it, and a test confirms the list's query count does not grow with the number of students.
  - `GET /api/registry/students/?supervisor=` matches a supervisor's name or staff number.
- **Read scope (UC05).**
  - Office Staff/Admin read every record.
  - Programme Coordinators read their managed programme, reusing `accounts.authorization.coordinator_programme`.
  - Coordinators and Lecturers also read the students they currently supervise or co-supervise.
  - A record outside the caller's scope returns 404, and every write, import, access-link, and import-history endpoint stays Office-only.
  - The two older tests that expected lecturers to be refused outright now expect a scoped, read-only registry.
- **Frontend.**
  - Lecturers now have the Registry module. Coordinators and lecturers see it read-only: no register, import, bulk verify, status change, access link or reinstate actions, and no staff and lecturer tab.
  - Added a Supervisor column and a supervisor filter (including "No supervisor yet"). Reset clears every filter, and an empty result reads "No matching students found".
  - The programme, semester, and status filters previously offered values no record could match ("PhD (CS)", "Master (SE)", fixed semester strings, and "Pending"/"Suspended" as academic statuses). They now use the approved programme list, the semesters present in the data, and the four real statuses.
- **Removed invented content.**
  - All five summary cards were fabricated (for example `1248 + (students.length - 6)` and a flat `145`). They are now computed from the loaded records: total, active, deferred, graduated or withdrawn, and awaiting activation. "New this intake" was replaced with "awaiting activation" because intake values are free text, with no reliable "latest intake".
  - The student panel's "verification milestones", including a hardcoded staff name, now show the account's real activation state, sign-in access, and last sign-in.
- **Verification.**
  - **Backend:** **585 tests passed**, including 7 new scope tests.
  - **Frontend:** all **54 test scripts** passed, including new summary-helper tests and a source guard against the fabricated values and unguarded write actions.
  - TypeScript lint, production build, production guards, Django system and migration-drift checks, and `git diff --check` pass. No migration was needed.
- **Live smoke check.** Temporary office, coordinator, lecturer, and student accounts plus a temporary Draft semester and appointment were used, then deleted.
  - Office saw all three test students with the supervisor details, and the filter matched.
  - The coordinator saw only the student in their programme, and the lecturer saw only their supervisee; each got 404 for the other student and 403 for writes.
  - The student got 403.
  - Browser visual acceptance remains unverified.

## Server-Side Student Import With Real History (2026-09-26)

- **Import endpoint.** `POST /api/registry/students/import/` (Office only) accepts CSV or XLSX up to 2 MB and 1,000 student rows. XLSX is opened read-only after a ZIP signature check.
  - It validates the header row and every row: required matric number and name, a valid email, an approved programme (any letter case), no duplicate matric number or email within the file, and none already registered. Rows are never auto-corrected.
  - `dryRun=true` returns per-row statuses without writing anything.
  - A commit creates each Ready row on its own through the same code path as single registration, skips duplicates, leaves other problem rows out, and sends activation emails.
- **History.** Each commit is recorded as a `RegistryImportBatch` (migration `accounts.0006_registry_import_batch`) with counts, the uploader's name, and the rows that need attention. `GET /api/registry/imports/?limit=` lists them.
- **Programme list.** `APPROVED_PROGRAMMES` moved to `accounts/programmes.py`, and a backend test fails if it drifts from `frontend/src/constants/programmes.ts`. A frontend test likewise checks that the template headers match the backend's `IMPORT_HEADERS`.
- **Registry import screen.**
  - Accepts XLSX as well as CSV and gets its preview from the server. Edited rows are sent back to the server to be checked again.
  - Rows are keyed by line, so duplicate IDs in a file no longer collide.
  - After an import, only the rows that were not created stay on screen for correction.
  - Recent Imports shows real batches, "View All" loads up to 50, and each batch's problem rows can be downloaded as CSV.
- **Removed invented content** from the import screen: the pre-filled file name, two fake import-history entries, "security scan" wording, the hardcoded 1,248/86 counts (now real registered and awaiting-activation counts), and column and guideline text that did not match the importer.
- The browser-side validation in `utils/csvImport.ts` was retired. Its test cases now run as backend tests, and the module keeps only the template and the CSV builder for reviewed rows.
- **Verification.** **578 backend tests passed** across all seven apps, including 15 new import tests, and all **53 frontend test scripts** passed. TypeScript lint, production build, production guards, Django system and migration-drift checks, and `git diff --check` also pass. The new migration was applied to the development database after a `pg_dump` backup.
- **Live smoke check** with SMTP disabled for the server process:
  - A CSV preview and commit created one row and left out one with a bad programme.
  - An XLSX preview and commit created one row and skipped a row already registered by the CSV run.
  - A `.txt` upload was refused, and Recent Imports listed both runs.
  - The temporary accounts, imported students, and batches were deleted afterwards. Browser visual acceptance remains unverified.

## Sign-In Safety: Session Expiry, Forced Password Change, Access Links (2026-09-26)

- **Session expiry (UC01).** When a signed-in session can no longer be refreshed, the login card now shows "Your session has expired. Please sign in again." A normal sign-out shows no message.
- **Forced password change (UC02).**
  - The user payload now includes `mustChangePassword`.
  - `accounts.password_policy.PasswordPolicyJWTAuthentication`, registered as the DRF default authentication class, answers flagged accounts with 403 and code `password_change_required` everywhere except `GET /api/auth/me/` and `POST /api/auth/me/change-password/`. Refresh and logout keep their own cookie authentication, so they still work.
  - The frontend holds flagged users on a full-screen change-password step before the app shell, and returns to it if any request reports `password_change_required`. The Settings password form is now a shared `PasswordChangeForm` component.
  - The Office marks dashboard preload waits until the password has been changed.
  - The flag is set by an administrator, for example in Django admin. New accounts still use activation links rather than temporary passwords.
- **Office-sent access links (UC02).**
  - `POST /api/registry/students/<matric>/send-access-link/` (Office only) resends the activation email to accounts that were never activated and sends a password-reset email otherwise. It refuses suspended accounts with 409 and reports whether the email was sent.
  - It is throttled per student account (`REGISTRY_ACCESS_LINK_THROTTLE_RATE`, default 3/hour); requests refused for non-office users do not count toward the limit.
  - The action sits in the Registry student panel rather than in the table row, so the office can see the account's state before sending.
  - `send_password_reset_email` now reports whether the email was sent; the anonymous reset endpoint still ignores that result.
- `backend/.env.example` now also documents `AUTH_CHANGE_PASSWORD_THROTTLE_RATE` and `REGISTRY_ACCESS_LINK_THROTTLE_RATE`.
- **Verification.**
  - **Backend:** **563 tests passed** across all seven apps on four PostgreSQL workers, including 12 new ones (5 for the forced password change, 7 for access links). With the default authentication class switched back to plain JWT, the enforcement test fails.
  - **Frontend:** all **52 test scripts** pass, including new render and wiring tests and an API-client test for the `password_change_required` event. TypeScript lint, production build, production guards, Django system and migration-drift checks, and `git diff --check` also pass.
- **Live smoke check** against the development database, using temporary accounts that were deleted afterwards and SMTP disabled for the server process:
  - The flagged login reports the flag, is refused elsewhere with `password_change_required`, changes the password, and then regains access with the flag cleared.
  - Access links return an activation link for a never-activated account and a reset link for an activated one, and a suspended account gets 409. Both emails were printed to the console, not sent.
  - Browser visual acceptance remains unverified.

## Registry Status Changes Use the Participant Lifecycle (2026-09-26)

- Fixed an integration bug between Registry Management and the participant lifecycle. The Registry update endpoint assigned `Student.status` directly, so withdrawing or graduating a student from the Registry left active appointments open, did not pause or retire Marks tasks, did not cancel pending work, and wrote no audit record.
- Any `academicStatus` change on `PATCH /api/registry/students/<matric>/` now goes through `transition_student` with a required `statusReason`. Lifecycle errors map to 400, 403, or 409 (409 includes blockers), and the transition and any other field edits in the same request succeed or fail together. Sending the current status needs no reason. Registration now only creates Active students.
- The Registry student panel has a "Change Academic Status" control. It offers only the lifecycle's allowed transitions, requires a reason, lists blockers when a transition is refused, and links to Participant Lifecycle to resolve them.
- Lifecycle transitions require an Office Staff/Admin account that also has Django `is_staff`. Registry editing does not, so an office account without `is_staff` can still correct Registry fields but receives 403 for status changes.
- Verification: **551 backend tests passed** across all seven apps on four PostgreSQL workers. They include 7 new Registry tests; 6 of them fail on the previous code, including a regression test proving that a Registry withdrawal now ends the active supervisor appointment. All **50 frontend test scripts** (including the new `registryStatus.test.ts`), TypeScript lint, production build, production guards, Django system and migration-drift checks, and `git diff --check` pass.
- Live smoke check against the development database: a missing reason returns 400, Active-only registration returns 400, reversing a Graduated status returns 409 with other fields unchanged, and a normal edit returns 200; the temporary accounts were deleted afterwards. The successful transition was verified by tests only, because lifecycle audit rows are protected from deletion by design and would have left permanent smoke data. Browser visual acceptance remains unverified.

## Settings, Student Registry, and Security Hardening (2026-09-26)

- Settings now persists through Django: phone number via `PATCH /api/auth/me/`, password change (current-password check, Django validators, its own throttle scope keyed on the account), and per-user notification preferences (`NotificationPreference`, migration `accounts.0004_notificationpreference`). Email, role, and ID fields stay office-controlled.
- Student Registry is served by `/api/registry/students/` for Office Staff/Admin only. Registration creates the account and profile in one transaction without a password (the student activates through a link). Bulk verify, CSV import, correction, and reinstatement persist through the API; CSV rows are validated against the approved programme list with in-file duplicate detection, and the template is generated from the importer's own header list.
- Authentication hardening: login hashes even for unknown identifiers, disabled accounts get the same generic 401, password reset rejects inactive accounts and validates against the resolved user, and reset mail failures no longer reveal registered addresses.
- Announcements and letters authorization: edit/delete restricted to the author (Office Staff/Admin may moderate), drafts visible only to their author including retrieval by id and attachment download, attachments validated for size (`ANNOUNCEMENT_MAX_ATTACHMENT_BYTES`, default 10 MB), extension allowlist, and magic bytes, idempotent delivery, and retraction withdraws delivered notifications. Draft letter templates are hidden from students and lecturers.
- Frontend services only fall back to mock data on a genuine transport failure; an HTTP error is shown as an error instead of rendering fixtures as real records. Letter generation is blocked when the student's record cannot be loaded.
- FAQ chatbot: design spec and phased plan recorded under `docs/superpowers/`; `scripts/parse_faq_pdf.py` extracts the office FAQ into `docs/faq/faq-entries.json`, with 48 of 163 rows flagged for manual review before loading. The chatbot itself is not implemented yet.
- Merged the latest `main` (PR #12) and adopted the refresh-cookie session. The session-expired event now fires when a request that had a session still receives 401 after the automatic refresh. `accounts.0005_merge_20260925_2258` joins the two `0004` migrations. Because `CHECK_REVOKE_TOKEN` invalidates every token on a password change, password change now blacklists outstanding refresh tokens and re-issues tokens for the current session instead of signing the user out on their next request. Existing login tests now post JSON.
- Applied all migrations to the local development database after taking a backup.
- Verification: **544 backend tests passed** across all seven apps on four PostgreSQL workers. All **49 frontend test scripts**, TypeScript lint, production build, production demo/CSP/artifact guards, Django system and migration-drift checks, and `git diff --check` pass. A live HTTP smoke test against the migrated development database passed 33/33 checks covering login/refresh/logout, Registry, letters, announcements, notifications, Settings including password change, Academics and Dashboard endpoints, and role restrictions; its temporary accounts were deleted afterwards. Frontend checks ran on Node 22.16.0, below the declared `>=22.22.0` (npm warns but everything passes). Browser visual acceptance remains unverified.
## Task-Specific Marks Completion Windows (2026-09-24)

- Implemented reasoned Office batch grants, replacement/renewal, revocation and immutable history for existing eligible unfinished tasks. Closed-period recovery keeps the period and semester closed; archives stay locked. Submission records its effective deadline/window, and lifecycle changes invalidate rather than transfer exceptional access.
- Added closure/handover previews, signed stale-state tokens, unfinished-work acknowledgement and archival blockers. Existing Office/evaluator screens, Dashboard actions/counts, reports/XLSX, dossiers and reconciliation use the effective task deadline without expanding role access.
- All **519 backend tests passed** in **308.913 seconds** across Accounts, Academics, Appointments, Dashboard and Marks on four PostgreSQL workers. After the final task-response status fix, all **37 focused backend tests passed** again in **22.629 seconds**, including PostgreSQL concurrency, migration preservation, immutable history, eligibility/permission boundaries, expiry/revocation, lifecycle handover, closure previews and Dashboard integration. All **54 frontend test scripts**, TypeScript lint, production build and production artifact/security guards passed. Corrected invalid UTF-8 separators in two evaluator components and reran affected rendering and production build successfully.
- Applied Marks migrations `0009` and `0010` locally. Existing primary/Panel appointments and research-profile fingerprints remain unchanged; this local database contains no periods, tasks or Marks. Migration regression fixtures separately confirm preservation of existing assignments, draft/submitted entries and scores.
- Verification reproduced and fixed a grant-versus-evaluator-handover deadlock, a consumed-window preview overcount, and a compatibility regression for ordinary open-period tasks lacking an appointment record. Task responses explicitly retain the effective period status during exceptional completion. Django system checks, migration-drift checks and final diff whitespace checks passed. Browser visual acceptance remains unverified.
- Preserving all uncommitted acting-coordinator changes. No commit or push is included.
- Implementation ruling: otherwise eligible unfinished tasks must not be automatically retired solely because their period closed; reconciliation will require an Office recovery decision so that late completion remains possible.

## Temporary Acting-Coordinator Delegation (2026-09-21)

- Implemented Office grants and reasoned revocation for existing active Coordinator accounts, inclusive Malaysia dates, immutable history, overlap protection, automatic expiry, and active/future retirement blockers. Regular coordinators retain their authority.
- Effective programme scope now covers Supervisor, Panel and supporting-supervisor queues, decisions and lifecycle actions, Dashboard actions/counts, dossiers, reports/XLSX, notifications and reconciliation. Final mutations lock and recheck delegated authority against revocation; historical actors and pending records remain unchanged.
- Office management is embedded in participant management. Coordinators can view their regular/effective scope and their own delegation history. Programme filters trim whitespace and ignore case.
- Verification completed: all **482 backend tests passed** across Accounts, Academics, Appointments, Dashboard and Marks in **309.911 seconds** on four PostgreSQL workers. The preceding **34 focused backend tests** also passed, covering delegation APIs, concurrent grants/revocation, retirement, migration preservation, appointment decisions/access and Dashboard/report integration. All **50 frontend test scripts**, TypeScript lint, production build and production security/artifact guards passed on Node **22.22.0**. Django system checks, migration-drift checks and diff whitespace checks passed. Browser visual acceptance remains unverified.
- Applied additive migration `accounts.0005_coordinatordelegation` to the local development database. Before/after fingerprints confirm unchanged regular coordinator, primary/Panel appointments, research profiles and workflow audits; the database has no supporting appointments, Marks or evaluation tasks. Changes remain uncommitted on `Lim_Branch`. Permanent coordinator replacement and cross-account identity/self-approval policy remain outside this feature.

## Programme-Scoped Marks Evaluation Periods (2026-09-16)

- Implemented ALL/SELECTED programme targeting and Supervisor/Panel role selection with legacy defaults, Draft-only edits, audited configuration, and read-only Django admin fields. Office can review current recipients, new/existing tasks, and missing eligible appointments before publishing; empty previews show a warning and late additions remain automatic through existing triggers.
- Preview, official task generation, and missing-task reconciliation share eligibility selection. Generation rechecks under period/student/lecturer locks, replacement tasks respect current targeting, and manual backups enforce programme and original-task boundaries. Existing tasks, drafts, and submitted results are retained on programme changes.
- Added migration `marks.0008_evaluation_period_targeting` and applied it to the local development database. Before/after snapshots confirm its existing 2 primary appointments, 1 Panel appointment, and 2 research profiles are unchanged; this database currently has no evaluation periods, tasks, or Marks. Historical-period and Marks preservation are additionally covered by migration regression fixtures.
- Verification completed: **408 affected backend tests passed** across Marks, Appointments, Dashboard, participant lifecycle, and Academics in 981.570 seconds on four PostgreSQL workers. The final **5 migration/admin/validation checks also passed**, including the strengthened draft/submitted Marks preservation fixture and new Django admin bypass regression. Targeting coverage includes read-only preview, programme/role boundaries, backups, late eligibility, lifecycle preservation, and concurrent generation. All **48 frontend scripts**, TypeScript lint, production build, and production artifact guards pass on Node 22.22.0. Django checks, migration-drift checks, and `git diff --check` pass.
- Verification exposed stale parallel test databases after adding a migration; recreated the test clones. Also corrected an existing reconciliation assertion to compare the local approval date, explicitly exercising the UTC/Malaysia calendar boundary rather than depending on the time the suite runs.
- Privacy and dependency-security changes remain preserved. Changes are prepared for delivery on `Lim_Branch`; browser visual acceptance remains unverified because of the previously recorded browser runtime issue.

## Student Panel Team Privacy Fix (2026-09-15)

- Reproduced and fixed internal Panel recommendation IDs, stages, and update timestamps appearing in Student supervisory-team timelines across team detail, workspace, and embedded dossier responses.
- Student timelines now show one public current state: undated Faculty processing for pending recommendations, or Confirmed with the active appointment's date. Active appointments take precedence during replacement; terminal history is omitted when no current record qualifies. Existing staff access and standalone Panel/dossier history policies are preserved.
- Shared Panel selection logic keeps the Student Panel page and team response consistent. Frontend timeline rendering supports null dates and readable status labels. No migration or new endpoint is required.
- Verification: **77 relevant backend tests passed**, including four new privacy regression tests covering all three response paths, terminal outcomes, confirmation/replacement precedence, staff visibility, and unrelated-user denial. **10 relevant frontend scripts passed**, including team rendering, co-supervision API, Panel utilities, dossier integration, and both production artifact guards. TypeScript lint, production build, Django system checks, migration-drift check, and `git diff --check` passed. Frontend checks used Node 22.22.0. The earlier full-suite totals below are historical; the full suite was not rerun for this focused fix.
- Browser visual acceptance remains unverified because of the previously recorded browser runtime issue. Changes are included with the programme-targeting delivery on `Lim_Branch`; dependency-security changes have been preserved. Evaluation configuration and coordinator policy improvements remain separate follow-up work.

## Post-Merge Dependency Security Maintenance (2026-09-15)

- Confirmed PR #11 merged co-supervisor commit `fb2c00d` into `main` at `ad520e0`. Fast-forwarded the local `Lim_Branch` to that merged state before beginning maintenance.
- Reproduced the two npm findings and Python audit findings affecting Django, DRF, pip, and sqlparse. Updated the frontend lockfile to Browserslist 4.28.9 and baseline-browser-mapping 2.11.23 with their browser-data dependencies. Installed Django 5.2.17, DRF 3.17.2, sqlparse 0.6.0, and pip 26.2; raised requirement floors and documented pip setup accordingly.
- Fresh npm and installed-environment pip-audit scans report **zero known vulnerabilities**; `pip check` reports no broken requirements. The complete Accounts/Academics/Appointments/Dashboard/Marks suite passes **437 tests** against Django 5.2.17 and DRF 3.17.2. All **46 frontend scripts**, TypeScript lint, production build/guards, Django checks, and migration-drift checks pass after the updates. No application code or database schema changes were required.
- Final frontend verification used an isolated npm-cached **Node 22.22.0** runtime, meeting the existing `>=22.22.0` requirement without modifying the system-wide Node 22.14 installation. Production environments must also meet the declared runtime requirement.
- Browser runtime initialization was retried and still fails with the missing kernel-assets path, so browser acceptance remains unverified. Production hosting configuration remains pending the hosting decision. These dependency and documentation updates are included with the programme-targeting delivery on `Lim_Branch`.

## Co-Supervisor and Supervisory Team Management (2026-09-13)

- Implemented dedicated co-supervisor nominations and appointments, with one primary and at most two supporting positions. Primary nomination, lecturer acceptance, programme-scoped coordinator decisions, reasoned cancellation, closure, and replacement are available in the existing Supervisor Appointment screens.
- Active co-supervisors consume shared supervision capacity; pending nominations occupy team positions without reserving lecturer workload. Student and lecturer row locks, final eligibility/capacity checks, database uniqueness constraints, and stale `409` responses protect activation and replacement.
- Primary handover retains approved co-supervisors and cancels outgoing unfinished nominations. Graduation/withdrawal and retirement blockers include supporting records. Co-supervisor changes never generate, transfer, or retire Marks tasks.
- Added restricted research/team/timeline reads, current-access revocation on closure, own historical records, immutable workflow/lifecycle audits, notifications, Dashboard actions, reports/XLSX, workload exports, authorized dossiers, and review-required reconciliation findings. Co-supervisor report links open the team workspace rather than an inaccessible internal dossier.
- Final verification: the complete Accounts/Academics/Appointments/Dashboard/Marks suite passes **435 tests** with four isolated PostgreSQL workers, and two subsequently added coordinator-rejection/temporary-unavailability tests pass separately: **437 distinct backend tests passed**. All **46 frontend test scripts**, TypeScript lint, production build, and production artifact guards pass. The final candidate-label adjustment was rechecked with the affected component/API tests, lint, build, and artifact guards. New Python files pass Black checks and the full diff passes whitespace checks.
- Live HTTP smoke through Vite and JWT authentication passes primary nomination, candidate acceptance, coordinator approval, Student viewing, Office closure, and former co-supervisor access revocation/history. PostgreSQL concurrency tests cover competing claims on the last team position and competing final approvals for one lecturer's remaining capacity. Migration round-trip coverage preserves submitted Marks and existing primary/Panel/research/audit records. Independent review confirmed the supporting report navigation fix; no remaining findings were reported for that fix.
- Applied `appointments.0012_co_supervisor_team` to the local development database. Before/after record-content fingerprints confirm unchanged primary appointments, Panel appointments, research profiles, Marks, and existing workflow/lifecycle audits. Django system checks and migration-drift checks pass.
- At the September 13 feature verification, npm reported two findings (moderate `baseline-browser-mapping`, high `browserslist`), and the installed Python environment reported advisories affecting Django, Django REST framework, pip, and sqlparse. The September 15 maintenance described above resolves these findings; earlier audit statements below are historical results.
- Browser smoke remains unverified because the computer-use browser runtime failed to initialize with a missing kernel-assets path. HTTP smoke and component rendering tests are not a substitute for a browser visual check.
- Official faculty templates and policy confirmation remain pending. Automatic promotion to primary supervisor is outside this version's scope. The feature was merged into `main` through PR #11 at `ad520e0`.

## Lecturer Capacity and Availability Management

- Consolidated `Lim_Branch` with the latest `origin/main` through an ancestry-only merge that produced no file-content changes. Post-merge verification passes all 409 Accounts/Academics/Appointments/Dashboard/Marks tests, Django system and migration-drift checks, all 44 frontend `.test.ts` scripts, dependency audit with zero findings, TypeScript lint, production build, and production demo/CSP/artifact guards.
- Approved a semester-specific, versioned capacity design for independent Supervisor and Panel limits, date-ranged role availability, fail-closed semester activation, and immutable operational audits.
- Existing appointments remain valid when capacity is reduced or availability changes. Over-capacity and unavailable Lecturers are blocked from new assignment activation without automatic workflow cancellation.
- New semesters can copy the previous published plan into Draft for Office review. Existing global limits seed documented cutover baselines only.
- Task 1 provides the four capacity-policy models, schema constraints and indexes, projected-state validation for partial entry and availability saves, authoritative validated individual entry saves, single-Draft-plan bulk creation with whole-batch prevalidation, duplicate-input rejection, sequential transactional saves, and caller-state restoration on failure, rejection of direct QuerySet/bulk updates and conflict mutation options, native instance-delete signal identity, exact locked-primary-key deletion across normal and raw QuerySet paths even when related-field predicates expand, serialized validated availability saves, stale-publication-safe admin forms, append-only audits including conflict-update rejection, and 64 focused model/admin tests in academics migration `0002`.
- Task 2 provides the shared read-only capacity resolver and assignment conflict guard with all six states, published-plan authority, persisted eligibility, role-specific availability, zero-limit and over-capacity handling, global Supervisor and Panel active-load counting, separate Panel reservations, public reason redaction, temporary-state-only availability dates, and semester-aware compatibility limit helpers. Fourteen focused resolver tests cover precedence redaction, effective/cancelled/expired/future windows, deterministic Kuala Lumpur date boundaries, and a portable query ceiling.
- Task 3 now provides transactional blank/copy/clone plan creation, Draft entry upsert, current-eligibility readiness validation, atomic publication/supersession, role-specific availability creation/cancellation, focused validation versus lifecycle conflict exceptions, and deterministic JSON-safe snapshots. Cross-semester copy retains `supersedes` lineage and is restricted to the latest strictly prior Published semester; all plan writes and new restrictions reject Closed/Archived targets. A canonical SHA-256 `contentFingerprint` is mandatory for entry edits and publication, with malformed-input versus stale-content conflict separation and no schema change. Publication locks all and only same-semester plan entries in deterministic plan/Lecturer/entry order before fingerprint/readiness validation. Historical cancellation remains available after role/lifecycle removal only for an unchanged persisted semester/Lecturer/role identity; new and identity-reassigned fully cancelled rows still require role eligibility, and cancelled windows cannot reactivate. Shared PK-ordered semester locking now covers both multi-semester copy and activation while preserving Marks handover. Database uniqueness guards, stale-object checks, mandatory reasons, rollback, current-role copy filtering, Published/Superseded historical cloning, zero-limit publication, active-appointment preservation, and immutable per-action audits are covered by 27 focused lifecycle tests.
- Task 3 hardening verification passes all 109 `academics.test_capacity` tests, including three focused historical-cancellation identity regressions and a PostgreSQL `TransactionTestCase` where two same-fingerprint updates produce exactly one commit and one conflict, plus all 11 semester lifecycle/API tests including reverse-ID lock-order handover. Django system/migration checks, `academics/capacity_services.py` Black validation, and `git diff --check` are rerun before commit.
- Task 4 provides the complete Office-only capacity management API surface for plan list/create/detail/edit/clone/publish, nested Lecturer-entry updates, availability list/create/cancel, and immutable audit retrieval. Exact camelCase serializers require version and fingerprint tokens on stale-sensitive writes; deterministic responses expose stable IDs, semester/version lineage, readiness, actors/timestamps, current shared-resolver loads, and Office-internal availability history. Domain and concurrent conflicts return `409`, malformed values `400`, unknown objects `404`, and every non-Office management request `403`. Nine focused API tests cover the contract, authorization, lifecycle/stale failures, internal-reason boundary, deterministic ordering, and a five-entry detail response bounded to 20 queries. All 118 capacity model, lifecycle, concurrency, resolver, and API tests pass together.
- Task 4 API hardening now rejects unknown/wrong-case/surplus body fields without side effects, validates an empty clone command, bounds plan/audit/availability histories with default-25/max-100 limits and offsets capped at 1,000,000, exposes array metadata through CORS-readable headers, shares one prefetched resolution/readiness context across listed plan versions, and enforces a reusable Office permission before all dispatch methods and object lookups. The focused API class includes scale, malformed and excessive pagination, multi-version query ceilings, and Student/Lecturer/Coordinator method-level denial coverage; all 18 API tests and all 127 capacity tests pass.
- Task 5 makes semester activation fail closed before any handover side effect unless the locked Draft target has exactly one complete Published plan. Historical migration `0003` creates idempotent `MIGRATED_BASELINE` policies only for the Active and unresolved-workflow semester set, preserves all identifiers and existing plan history, and copies role-specific legacy limits only for currently eligible Lecturers. Guarded demo seeding and owned capacity-sensitive fixtures now publish realistic plans through fingerprinted lifecycle services without replacing existing policy.
- Task 5 verification passes 32 focused activation, migration, helper, and guarded-seed tests; all 390 owned-backend tests across Accounts, Academics, Appointments, Dashboard, and Marks; and all 131 capacity/helper tests after aligning publication eligibility with the resolver's active-account rule. The sole fixture incompatibility was corrected by closing rather than deleting a semester with protected policy history. Django checks, migration drift, formatting, and diff integrity are rerun before commit.
- Task 6 makes Supervisor and Panel candidate directories, workload rows, submissions, final approvals, and replacement activation consume the same persisted semester policy. Ineligible and temporarily unavailable new selections are hidden; full, over-capacity, and unconfigured candidates remain visible but disabled. Existing selected identities stay visible with only a public availability end date, and private Office reasons are never serialized.
- Task 6 preserves assigned review work while rechecking capacity at final activation. Conflicts return `409` with pending state unchanged, target Lecturer row locking serializes competing assignment mutations, and replacement handover cannot end the old appointment before the incoming capacity check succeeds. Panel activation excludes its own reservation to convert the last available slot without double counting other nominations.
- Task 6 verification passes all 76 focused Supervisor workflow, Panel workflow, and appointment lifecycle tests, all 122 Appointments tests, all 14 capacity resolver tests, and all 9 reconciliation tests; the final combined 145-test gate passes against the exact commit tree. Coverage includes hidden temporary unavailability, full and over-capacity metadata, direct-ID rejection, public reason redaction, pending review continuation, final approval blocking and later success, exact-limit Panel reservation conversion, replacement enforcement, and capacity-safe historical handoff repair. Django system checks, migration dry-run, Black validation, and diff integrity pass with no migration required. Two historical test fixtures were corrected to persist the Supervisor/Panel roles their workflows already assumed before publishing capacity policy.
- Task 7 adds Office-only Supervisor/Panel capacity-state distributions to Workflow Reports, matching Dashboard attention actions, and current plan/version/state/load/limit/slot/public-availability metadata to report rows and XLSX exports. Coordinator and Lecturer reports do not expose the faculty capacity summary or Office-only reasons.
- Task 7 extends live reconciliation with missing/incomplete/multiple-plan, role-entry mismatch, active-window overlap, and Published-versus-legacy divergence detectors. Only a missing Draft plan with exactly one verified prior Published source offers transactional `COPY_CAPACITY_PLAN`; stale fingerprints return `409`, and successful copies preserve capacity lineage while recording an immutable reconciliation audit.
- Task 7 focused and full Dashboard verification passes 38 tests after adding capacity action, report/export, drift detector, Draft-copy, and stale-state coverage. Django system/migration and formatting checks are rerun before commit; no migration is required.
- Task 8 adds exact frontend capacity contracts, a backend-only Django API service for every management command, shared labels/validation/conflict/utilization helpers, capacity metadata on appointment/report types, and the known lazy `/dashboard/lecturer-capacity` route with non-Office redirect protection.
- Task 8 verification passes the focused Lecturer capacity utility test, route test, lazy-loading/role-guard source test, and full TypeScript lint check.
- Task 9 completes the Office capacity workspace with semester and plan-version selection, blank Draft creation, cloning, comparison, independent Supervisor/Panel limit editing, readiness blockers, confirmed publication, role/date availability configuration, reasoned cancellation, audit history, stale-conflict refresh, and loading/error/empty feedback. Closed and Archived semesters expose policy history without new mutations; current availability uses Kuala Lumpur calendar dates.
- Capacity management is now linked from Office Dashboard, Academic Semester Management, both workload monitors, and Workflow Reconciliation. Focused capacity, Dashboard integration, and lazy-route tests pass; TypeScript lint and a production Vite build pass after the final lifecycle/date guard changes.
- Task 10 completes public capacity presentation: Student and Lecturer candidate controls honor `selectable`, public labels replace legacy workload guesses, existing selections show only public resume dates, and native Student selection alerts are removed. Coordinator Supervisor and Panel conflict handlers display backend `409` messages, retain pending rows, and refresh from Django.
- Lecturer Dashboard, Supervisor Appointments, and Panel Appointments now show the authenticated Lecturer's Supervisor/Panel state, published plan version, load/limit, and public availability date. The new Lecturer-only Panel own-workload endpoint counts confirmed appointments and reservation nominations through the shared resolver; the former invented Panel limit of 10 is removed.
- Both Office workload exports now include semester code, plan version, capacity state, active/reserved load, available slots, and public unavailability dates without internal reasons. Utilization rejects malformed/zero limits and stays within 0-100.
- Task 10 verification passes all 123 Appointments tests, Django checks, migration dry-run, and Black validation. The three focused frontend scripts, full TypeScript lint, and production Vite build also pass.
- Task 11 verification passes all 409 backend tests across Accounts, Academics, Appointments, Dashboard, and Marks in 687.520 seconds, with clean Django system and migration-drift checks. All 44 frontend `.test.ts` scripts pass, the dependency audit reports zero vulnerabilities, TypeScript lint is clean, the production build succeeds, and the demo/CSP/source-map/artifact guards pass.
- Live local HTTP smoke on Django `8001` and Vite `5174` authenticates Office Staff/Admin, Lecturer, Programme Coordinator, and Student. Office can read the active semester, Published plan, audits, and both workload views; Lecturer can read both personal workload views and Panel candidates; Coordinator approval queues load; Student receives public Supervisor capacity state and Panel readiness. Lecturer, Coordinator, and Student capacity-management requests return `403`, the direct frontend route serves the lazy application shell, and an Office availability create/cancel cycle persists in history while a repeated stale cancellation returns `409`. Server logs contain only the expected authorization/conflict responses and no runtime exception.
- The desktop browser-control runtime could not initialize on this host, so no automated visual/click-through browser pass is claimed. The remaining manual check is limited to visual layout and interaction across the already verified role flows; it does not block the completed automated and live transport-level verification record.
- The approved specification is `docs/superpowers/specs/2026-08-19-lecturer-capacity-availability-design.md`.
- The reviewed task-by-task implementation plan is `docs/superpowers/plans/2026-08-19-lecturer-capacity-availability.md`.

## Workflow Data Quality and Reconciliation Centre

- Added an Office-only live scan across Coordinator authority, semesters, research-profile identity/Supervisor consistency, approved Supervisor/Panel handoffs, Marks task eligibility/generation, and appointment source/replacement lineage.
- Added stable IDs, SHA-256 fingerprints, severity/repairability classification, filtered pagination, preview, stale-state `409` handling, and protected list/preview/apply/audit APIs.
- Added transactional repairs for Coordinator profile/programme setup, exact-matric profile linking, Supervisor synchronization, uniquely evidenced semester assignment, approved handoff completion, and Marks task generation/pause/resume/retirement.
- Added immutable `WorkflowReconciliationAudit` persistence and one-task Marks lifecycle repair with draft/comment snapshots. Submitted Marks, workflow events, identifiers, legacy strings, and downstream history remain unchanged.
- Centralized Coordinator scope and replaced duplicated programme lookup across Appointments, Dashboard actions, Reports, Dossiers, and lifecycle services.
- Added `/dashboard/workflow-reconciliation` with summary counts, filters, pagination, preview, mandatory reason/confirmation, audit history, retry/conflict states, and review-only explanations. Linked it from Office Dashboard, Semesters, Participant Lifecycle, Reports, and action feeds.
- Verification passes all 253 Accounts/Academics/Appointments/Dashboard/Marks backend tests, all 43 frontend `.test.ts` files, Django system and migration checks, TypeScript lint, the production build, zero-vulnerability npm audit, and both production artifact/CSP guards.
- Browser smoke covered Office discovery, review-only preview, confirmed semester repair with stale-state protection, immutable audit creation, count refresh, and direct Student/Lecturer/Coordinator route rejection. The temporary repair fixture and audit were removed afterward, and the browser console remained clean.
- Ambiguous semesters, role/profile conflicts, downstream-used identity conflicts, and appointment lineage inconsistencies remain review-required. Bulk repair and history merging are intentionally excluded.

## Secure Supervisor Application Documents

- Added private, persisted PDF/DOCX files to Supervisor applications with requirement snapshots, validated MIME type, SHA-256 checksum, legacy metadata availability, server-generated storage names, and one-file-per-requirement integrity.
- Added Office Staff/Admin requirement configuration and immutable audits, including stable codes, active/inactive ordering, mandatory update reasons, no physical deletion, and guarded fictional seeding only when no requirements exist.
- Changed Student Supervisor application creation to atomic multipart submission with requirement completeness, five-file and 10 MB limits, duplicate-content rejection, PDF active-action checks, bounded DOCX package validation, and storage cleanup after transaction failure.
- Added private attachment downloads scoped to the owning Student, proposed Supervisor, managed-programme Coordinator, and Office Staff/Admin with indistinguishable not-found responses and safe attachment headers.
- Added the Office-only `/supervisor-appointments/requirements` workspace, requirement-driven drag-and-drop Student intake, combined-size and completeness feedback, shared authenticated document downloads, and legacy `Unavailable` rendering.
- Replaced fabricated supporting files, fallback research content, eligibility claims, timestamps, feedback, and appointment-letter controls in Student, Lecturer, Coordinator, and Office Supervisor surfaces with persisted fields and workflow audits.
- Reports and CSV remain metadata-only; Progress Dossiers continue linking to authorized Supervisor details. Official templates, CGPA policy, antivirus scanning, file replacement, Notifications/Announcements, and File Repository integration remain deferred.
- Verification passes all 164 Accounts/Appointments/Dashboard backend tests, the focused 29-test Supervisor document/workflow suite, all 39 frontend `.test.ts` files, Django system and migration checks, TypeScript lint, production build, zero-vulnerability npm audit, and both production artifact/CSP guards.
- Browser smoke covered Office required/optional configuration and private download, Student missing-required blocking and valid upload, Lecturer review/download, Coordinator cross-programme isolation and temporary managed-programme visibility, and error-free role rendering. Clearly named smoke records, files, notifications, requirements, and temporary programme alignment were removed afterward.

## Central Academic Semester Management

- Added the `academics` Django app with a faculty-wide `AcademicSemester`, immutable lifecycle audits, consecutive-session and date validation, non-overlap rules, effective-expiry handling, and database enforcement that permits at most one persisted Active semester.
- Added Office Staff/Admin-only semester configuration and audit APIs plus a minimal authenticated active-semester endpoint for every portal role. Activation, handover, extension, closure, and archival are transactional, reasoned, and return lifecycle conflicts without deleting historical records.
- Added nullable semester relationships to Supervisor applications, Panel recommendations, Timeline versions, and Marks evaluation periods. Existing identifiers and free-text history remain intact; records that cannot be linked safely display as `Legacy / Unassigned`.
- Bound new Supervisor and Panel workflows to the effective active semester on the server, retained prior-semester approval handling, scoped role dashboards to the active Timeline, and restricted Timeline preparation to Draft or Active semesters.
- Integrated Marks preparation, publishing, submission windows, task generation, and semester handover. Draft periods can target Draft or Active semesters, while publishing and generation require the effective active semester and windows contained within its dates.
- Added active/all/unassigned/stable-code semester filters to Workflow Reports and XLSX output while retaining complete authorized dossier histories and unresolved carryover actions.
- Added the Office-only `/dashboard/semesters` workspace, lifecycle controls with mandatory reasons, active-semester context on all role dashboards, and persisted semester selectors in Timeline, Marks, and Reports without adding a sixth sidebar module.
- Guarded development seeding now creates one fictional active semester only when no semester exists and never replaces developer-created configuration.
- Verification passes all 153 Academics/Appointments/Dashboard/Marks backend tests, the focused 10-test semester lifecycle and authorization suite, all 37 frontend `.test.ts` files, Django system and migration checks, TypeScript lint, production build, zero-vulnerability npm audit, and both production artifact/CSP guards.
- Browser smoke covered desktop and mobile semester management plus Office Staff/Admin, Lecturer, Programme Coordinator, and Student dashboard context, active report filtering, Timeline selection, and Marks setup. The local mixed-host smoke configuration produced refresh-cookie logout warnings; it did not affect authenticated application flows.
- Historical records remain intentionally unassigned unless a trustworthy relationship already exists. Announcements/Notifications, official templates, SLA rules, Registry persistence, and notification fan-out remain unchanged.

## Backend-Only Owned Module Cutover

- Removed all Supervisor, Panel, and Timeline mock branches, simulated mutations, owned mock imports, and module-specific backend flags. The five owned modules now call Django under every environment combination while global mock support remains available to unfinished or teammate-owned modules.
- Deleted the appointment and timeline mock datasets and added source and production-artifact guards against their exports, legacy switches, and fixture canaries.
- Replaced static Office supervisor workload records with an Office-only persisted workload endpoint and live loading, retry, filtering, pagination, detail, utilization, and CSV states.
- Added a Lecturer-only self-workload endpoint and enriched active-supervisee payload. The detail screen now renders persisted student, research, and appointment data instead of fabricated files, panel assignments, evaluation results, dates, and identities.
- Corrected Lecturer Supervisor acceptance so it reloads Django after the first-stage decision and does not invent an active appointment before Programme Coordinator approval.
- Removed panel recommendation fallback students/candidates, hidden fixture exclusions, invented history identifiers/semesters, and simulated drawer submission.
- Removed fixed Timeline semester/session/date defaults. Upload now requires explicit semester/session values and add/edit drawers use the current persisted timeline context.
- Added direct error-propagation coverage for `401`, `403`, `404`, `409`, `500`, and network failures without mock fallback, plus focused role/access and persisted workload contract tests.
- Verification passes all 149 Dashboard/Appointments/Marks backend tests, all 35 frontend `.test.ts` files, `python manage.py check`, migration dry-run, TypeScript lint, production build, zero-vulnerability npm audit, and both production artifact/CSP guards.
- Browser smoke confirms Office Staff/Admin persisted supervisor workload, Lecturer Supervisor/Panel views, Programme Coordinator Supervisor/Panel queues, and Student Supervisor/Panel status across direct routes. With Django deliberately stopped, the Student Supervisor candidate screen shows an inline `Couldn’t load data` state with Retry and no fabricated candidates or browser alert.

## Production Marks Management Completion

- Added persisted versioned rubric families with configurable targets, sequential cloning, immutable locking once used, readiness checks, component deactivation, and migration of existing rubrics to version 1 without identifier changes.
- Added faculty-wide evaluation-period lifecycle management for draft, publish, deadline extension, close, archive, archived filtering, timezone-derived display state, duplicate prevention, and immutable configuration audits.
- Enforced published/open submission windows with period-row locking against concurrent closure, row-locked submission and configuration transitions, backend-only total calculation, required/optional component integrity, stale optional-score removal, and `409` responses for workflow conflicts.
- Added the Office Staff/Admin-only persisted Mark Record Detail API with stable task/record identifiers, rubric scores, evaluator assignment, deadlines, lock state, override history, and correction/reopen audit history.
- Replaced local Marks periods, rubrics, overview attention counts, record detail mappings, and runtime mock switches with Django APIs. Removed fake PDFs/documents, notification dispatch, export placeholders, simulated sync state, and fixed 100-mark UI assumptions.
- Added focused model, migration, API, role-access, period-window, locking, score-integrity, submitted-comment audit, task-identity, and frontend production-source/artifact regression coverage.
- Verification passes all 145 Dashboard/Appointments/Marks backend tests, all 33 frontend `.test.ts` files, `python manage.py check`, migration dry-run, TypeScript lint, production build, zero-vulnerability npm audit, and both production artifact guards.
- Browser smoke confirms Office Staff/Admin can create and balance a rubric, create and publish a period, generate tasks, clone the locked rubric, and open the persisted Mark Record Detail. Lecturer Marks loads its role-scoped task surface, while Programme Coordinator and Student direct Marks-administration URLs redirect to Dashboard; the browser console remained clean.
- The configured demo Lecturer had no generated task assignment, so browser submission was not mutated in local fixtures; open-window save/submit, closed-window rejection, duplicate locking, and correction history remain covered by backend tests. Clearly named browser-smoke records were removed after verification.

## Completed

- Added a role-scoped, read-only Student Progress Dossier at `/dashboard/progress/:studentId` for authorized staff and `/dashboard/progress` for Student self-view.
- Added one persisted dossier aggregation service across Supervisor, Panel, Marks, active Student-targeted Timeline, and workflow audit data, including partial dossiers for students without research profiles.
- Enforced Office-wide, Coordinator programme, Lecturer assignment/relationship, and Student self-only access with indistinguishable `404` responses for unknown and unauthorized matric numbers.
- Added public Student redaction for internal Panel stages and identifiers, pending selected-panel identity, evaluator identity, mark values/comments, and staff workflow audit actors.
- Added current-before-history dossier ordering, derived attention priorities, status tabs, empty/error/not-found states, and existing-module deep links without adding dossier mutations or persistence.
- Added `View Dossier` entry actions to Office, Coordinator, and Lecturer Supervisor/Panel/Marks surfaces and report attention rows, plus `View My Progress` on the Student Dashboard.
- Added deterministic, migration-free workflow ageing for pending Supervisor and Panel stages, including workflow-event/update fallbacks, future-date clamping, and null terminal metadata.
- Added role-scoped Workflow Analytics at `/dashboard/reports` for Office Staff/Admin, Programme Coordinator, and Lecturer dashboards, with date/programme filtering, KPI and distribution summaries, workflow attention links, and Student route rejection.
- Added shared persisted reporting queries and matching JSON/XLSX endpoints across Supervisor, Panel, Marks, and Timeline. Workbook sheets are role-visible, generated in memory, and use the same authorization and filters as the on-screen report.
- Reporting intentionally presents current persisted state selected by each module's reporting date; historical snapshots and trend reconstruction remain outside the current scope.
- Added Marks deadline metadata from evaluation-period close dates and date-derived Timeline action metadata without introducing a Marks approval stage or recurring workflow audit events.
- Replaced hardcoded dashboard task content with a shared persisted action centre across Office Staff/Admin, Programme Coordinator, Lecturer, and Student dashboards, including role scoping, priority ordering, a 20-action cap, and exact module/record navigation.
- Added Waiting columns and longest-waiting ordering to Office Supervisor/Panel monitoring, oldest-first Lecturer/Coordinator approval queues, generic student wait labels, Marks deadline displays, and waiting metadata in existing Supervisor/Panel CSV exports.
- Kept student Panel processing declassified as `FACULTY_PROCESSING`; recommendation IDs, internal decision stages, and internal workflow timestamps remain absent from student payloads.
- Removed duplicate runtime Vite ownership, updated the development toolchain to Vite 6.4.3 and `tsx` 4.23.1 with nested `esbuild` 0.28.1, and added a low-threshold frontend security audit command.
- Added a same-origin Nginx production template with HTTPS redirect, Django API/Admin proxying, collected Admin static serving, the 12 MB body limit, staged HSTS, and frontend security headers.
- Added equivalent report-only and enforced CSP includes that keep scripts and connections same-origin, prohibit inline scripts and active embedding, and narrowly allowlist Google Fonts and Unsplash.
- Explicitly disabled Vite production source maps, expanded production artifact scanning, and removed inline scripting from generated letter documents while preserving print behavior through trusted bundle listeners.
- Replaced the eight-hour browser-stored access token with a 15-minute in-memory bearer token and a 7-day rotating HttpOnly refresh cookie.
- Added SimpleJWT outstanding-token/blacklist persistence, refresh replay rejection, authenticated logout revocation, password-reset invalidation, inactive-account blocking, and JSON-only login/refresh/logout requests.
- Added concurrency-safe frontend renewal with one authenticated-request retry and cookie-based session restoration without exposing refresh values to JavaScript.
- Added fail-closed production settings validation for secret-key strength, explicit allowed hosts, and HTTPS-only CORS origins while preserving local `DEBUG=True` HTTP defaults.
- Enabled production-only HTTPS redirect, staged HSTS, secure strict session/CSRF cookies, nosniff, same-origin referrer policy, frame denial, and explicit trusted-proxy opt-in.
- Added subprocess settings tests covering rejected production configurations, secure defaults, HSTS/proxy overrides, and development behavior.
- Isolated demo accounts behind explicit Django and Vite development flags while preserving local one-click role prefills.
- Replaced seeded identities with fictional `example.test` emails, `DEMO-*` IDs, and demonstration-only registry/profile data; removed passwords from committed Python and TypeScript fixtures.
- Added guarded, environment-driven role passwords, validated legacy-email mapping, no-mutation refusal tests, idempotent seed coverage, and a production bundle canary test.
- Implemented persistent Supervisor Appointment submission, document metadata, lecturer decisions, programme-scoped coordinator decisions, resubmission, workload validation, appointment records, and histories.
- Replaced the deferred coordinator supervisor page with a live approval queue and dashboard count.
- Renamed the stale coordinator supervisor approval frontend surface to `CoordinatorSupervisorApprovals` and wired it as the live Programme Coordinator final-approval queue.
- Replaced prompt-based supervisor approval rejection on the Programme Coordinator queue and lecturer supervisor detail screen with in-app mandatory rejection reason controls.
- Clarified the five-module ownership boundary so Workflow and Approval Tracking is separate from the Notifications/Announcements module.
- Added shared immutable workflow events for Supervisor and Panel submissions and decisions.
- Changed Panel workload validation to each lecturer's configurable `Panel.max_appointments`.
- Added the `marks` Django app with configurable rubrics, periods, tasks, drafts, validation, submission locking, office monitoring, and assignment generation.
- Extended Marks task assignment so active Supervisor Appointments and active Panel Appointments generate separate role-specific evaluator tasks, with automatic active-period safety generation if Office Staff/Admin forget to run assignment manually.
- Added audited backup/manual-override evaluation tasks for Office Staff/Admin exception handling without changing official appointment records.
- Replaced the prompt-based Marks Assignment flow with production Office Staff/Admin period selectors, readiness checks, role/status filters, and a validated backup evaluator drawer.
- Added Marks Assignment option endpoints for evaluation periods, eligible students, lecturers, and existing task options.
- Connected Marks Entry overview cards, Mark Submission Monitoring, and Mark Entry Records summaries to live marks period, dashboard, and record data.
- Added status-filtered navigation from dashboard/monitoring marks actions into Mark Entry Records.
- Updated Office Staff/Admin mark records to show unsubmitted closed-period tasks as Overdue without changing the database status model.
- Fixed the Lecturer fresh-login landing page so lecturers enter through Dashboard Overview instead of Marks Entry.
- Added a shared portal confirmation modal and replaced browser-native confirmation dialogs for panel cancellation, supervisor request cancellation, mark submission locking, and rubric component removal.
- Moved selected-panel Reviewed Requests into a separate Lecturer Panel Appointments page opened from a button above the Selected Panel Review Queue table.
- Simplified the Reviewed Requests navigation button to a text-only action for visual consistency with the portal table headers.
- Added audited Django Admin correction and reopening for submitted marks.
- Connected Lecturer Marks Entry to live APIs and dynamic backend-provided rubric components.
- Connected role-scoped live Supervisor, Panel, and Marks counts to dashboards.
- Removed the non-functional Panel Appointment policy-download action.
- Added regression tests for supervisor workflow, mark locking/corrections, dashboard summaries, workload limits, and date-relative timelines.
- Added supervisor-only panel recommendation cancellation while awaiting selected-panel review, including mandatory reasons, terminal cancellation status, immutable audit history, workload release, replacement recommendation support, and distinct read-only history across roles.
- Added the cancellation API, database fields/migration, supervisor confirmation UI, cancelled status summaries/timelines, and focused authorization/workload/replacement tests.
- Added student cancellation for pending Supervisor Appointment requests, including mandatory reasons, row locking, `CANCELLED_BY_STUDENT`, audit retention, queue removal, replacement submissions, and supervisor notification.
- Removed the unused Panel `ACCEPTED_BY_PANEL` state; selected-panel acceptance now has one supported transition directly to `PENDING_COORDINATOR`.
- Added protected Supervisor and Panel detail APIs, expandable audit logs, workflow notification metadata, stakeholder notification fan-out, and notification-to-record navigation.
- Added clean URL routing with React Router DOM for auth pages, sidebar modules, dashboard timeline, marks subviews, mark record detail, supervisor application deep links, panel recommendation deep links, unknown-route redirects, and notification-to-record navigation.
- Added page-level nested Supervisor Appointment routing for Office Staff/Admin record detail and workload monitoring, Student new application routing, Lecturer request history and supervisee detail pages, and role-specific fixed-route redirects while preserving `/supervisor-appointments/:applicationId` deep links.
- Added route-level code splitting for every authenticated routed module, including Notifications, and split React, React Router, Motion, and Lucide vendor code so the production entry chunk stays below Vite's default warning threshold.
- Added page-level nested Panel Appointment routing for Office Staff/Admin record detail and workload monitoring, Lecturer submitted/reviewed/assignment pages, Programme Coordinator recommendation drawer links, and Student nested-route redirects.
- Tightened Dashboard page-level routing so `/dashboard/timeline` remains the only Dashboard nested page, is Office Staff/Admin-only, and unsupported Dashboard nested paths redirect through the normal authenticated fallback.
- Added route scroll restoration so routed page transitions start at the top while hash-only URL changes are left alone.
- Applied local migrations through `appointments.0006` and `announcements.0003`.
- Moved shared portal toast feedback to the top-right viewport position with high overlay layering so it remains visible above the sticky header, drawers, and modals.

- Added a dedicated Programme Coordinator dashboard using the Lecturer timeline/next-action structure with real programme-scoped supervisor and panel approval counts.
- Added the Programme Coordinator Supervisor Appointments live final-approval queue without fabricated pending counts.
- Added a programme-scoped coordinator panel workspace API returning the managed programme, pending count, final-approval queue, and full recommendation lifecycle records.
- Enforced `Coordinator.programme_managed` on coordinator queue retrieval and final approve/reject actions, including protected empty behavior for coordinators without an assigned programme.
- Added a shared searchable, status-filtered, 10-row recommendation records table for Programme Coordinator programme oversight and selected-panel lecturer Reviewed Requests history.
- Added selected-panel review history persistence access, preserving each lecturer's accepted/rejected decision and later coordinator outcome in read-only detail views.
- Corrected the panel candidate current-user lookup to use `DemoUser.fullName`.
- Updated Office Staff/Admin Panel Appointment Records to retain separate historical recommendation attempts, including rejected attempts that precede a later approved appointment, while suppressing the duplicate approved recommendation represented by the final appointment.
- Added stable per-row panel `recordId` values and retained rejection stage, reason, recommended-member metadata, and lifecycle timestamps for historical detail views.
- Updated Panel Appointment Detail to distinguish selected-panel rejection from Programme Coordinator rejection and show the stored rejection reason.
- Added a tested shared frontend pagination utility and changed Panel Appointment Records plus Recent Timeline Updates to 10 rows per page with page ranges, numbered navigation, and safe page clamping after data refresh/filter changes.
- Reorganized the workspace into a standard full-stack structure with `frontend/`, `backend/`, and `docs/` at the project root while keeping the three mandatory governance documents at the root.
- Moved the Vite React application source, package files, and frontend configuration into `frontend/`.
- Moved the Django backend into root-level `backend/`.
- Moved supporting setup notes and PDF references into `docs/`.
- Moved Git metadata to the project root so the repository matches the new workspace entry point.
- Cleaned `frontend/.env.example` so it documents only public Vite frontend variables; frontend `.env` is optional because `apiClient` provides defaults.
- Installed project dependencies for the current frontend.
- Verified the existing Vite React app compiles with TypeScript.
- Verified the existing app builds for production.
- Added Dashboard Overview frontend code from `fsktmwithdashboard` into the current frontend.
- Wired `Dashboard Overview` to render the administration dashboard instead of the generic placeholder.
- Added dashboard timeline management as a dashboard sub-view.
- Set the authenticated office staff landing view to `Dashboard Overview`.
- Merged generated office-staff UI modules from `fsktm-postgraduate-administrative-portalofficestaffcompleted`.
- Added routes for Registry Management, File Management, FAQ Chatbot, Letter Generation, Announcements, Notifications & Announcements, and Forgot Password.
- Updated the sidebar and top header to expose the expanded office-staff navigation.
- Fixed the Panel Appointment Management desktop layout so the records table appears directly below the search/filter card instead of being pushed below the right-side widgets.
- Merged lecturer UI modules from `fsktmLecturerRole` into the current frontend without replacing the existing office-staff application shell.
- Added role-aware routing so lecturer users see lecturer Supervisor Appointments, Panel Appointments, and Marks Entry workflows while office staff keep the existing administrative workflows.
- Updated the portal header identity to display the active demo user's name and role.
- Added shared Tailwind theme tokens required by the generated lecturer module styles.
- Removed duplicate lecturer page footers so authenticated modules use the single global portal footer.
- Standardized lecturer module page headers, card radii, and card shadows to match the current office-staff visual system.
- Removed decorative blur-circle accents from summary/quick-action cards for a more consistent administrative interface.
- Merged student UI modules from `fsktmStudentRole` into the current formatted frontend without replacing the existing office-staff and lecturer application shell.
- Added role-aware student routing for FAQ Chatbot, Supervisor Appointments, Panel Appointments, File Submission, Letter Generation, and student Dashboard Overview.
- Updated the sidebar to filter visible module navigation by Office Staff/Admin, Lecturer, or Student role while preserving responsive drawer behavior.
- Standardized student module page headers, card radii, card shadows, and footer usage to match the current visual system.
- Standardized authenticated office-staff card radii, custom soft shadows, modal/drawer shadows, and repeated navy brand color utilities across the portal.
- Added a dedicated student Dashboard Overview with the shared semester timeline in read-only mode, student status cards, next-action guidance, semester progress, FAQ support, and profile status.
- Fixed the Mark Submission Monitoring `View All Mark Records` action so it routes to the mark records view.
- Added shared portal primitives for page headers, cards, buttons, status badges, and toast notifications.
- Added shared form-control and filter-toolbar CSS classes for repeated search/filter layouts.
- Migrated the administration dashboard, student dashboard, timeline management, quick actions, mark monitoring, mark records, FAQ editor, announcement management, file repository, lecturer role modules, and student support/file/letter modules toward shared primitives for more consistent formatting.
- Extended the consistency cleanup across the remaining repeated portal surfaces by centralizing role/module toast overlays, replacing raw generated table class strings with the shared `data-table` styling, applying shared filter/form controls to major search panels, and normalizing leftover portal-side custom shadows.
- Tightened backend-readiness UI consistency by updating shared form components, legacy action buttons, local status chips, FAQ/announcement/template editor controls, and timeline drawer controls to use shared portal primitives and CSS classes.
- Fixed the shared sign-in action button so the right-arrow icon stays inline with the button label.
- Added env-driven frontend API configuration for `VITE_API_BASE_URL`, `VITE_USE_MOCKS`, and `VITE_MOCK_LATENCY_MS`.
- Removed generated Gemini/AI Studio leftovers from env examples, metadata, dependency files, and stale generated project context.
- Moved key component-local backend-shaped demo data into shared mocks/types, including dashboard attention rows, student next actions, student letter templates, student supervisor applications, supervisor candidates, mark detail mappings, rubric rows, timeline import preview entries, panel related documents, departments, and announcement attachment options.
- Standardized the next layer of shared UI consistency by routing reusable status badges through a shared tone helper, aligning common table actions/pagination with `PortalButton`, and normalizing drawer/modal/upload action controls across high-traffic office-staff, lecturer, and student surfaces.
- Replaced additional local page headers and specialized controls with shared primitives, including student and lecturer module `PageHeader` usage, dashboard/announcement segmented controls, upload permission switches, removable tag chips, summary/status dots, and progress bars.
- Finished the remaining authenticated module header cleanup so local `page-title`, `page-subtitle`, and `back-link` usage now lives inside `PortalPrimitives`, and converted more reusable summary/status/progress indicators to `StatusBadge`, `StatusDot`, and `ProgressBar`.
- Adjusted Panel Appointment Management so the records table no longer depends on a horizontal scrollbar on desktop: the records area now uses a wider column, fixed table layout, compact cell spacing, and wrapped text.
- Resolved the `App.tsx` merge compile issue by restoring the missing mark-record mock import and cleaned duplicate dependency keys left in `package.json`.
- Added missing React TypeScript declaration packages and tightened exposed type issues in sidebar state, icon wrapper props, login manual download alert handling, and student supervisor detail records.
- Updated the existing lecturer Panel Appointments recommendation workflow so supervisor panel recommendations move from direct submission to selected panel acceptance or rejection, then Programme Coordinator confirmation or rejection.
- Added UI/mock enforcement for exactly one recommended panel lecturer per student recommendation and duplicate blocking until a previous recommendation is rejected by the selected panel or Programme Coordinator.
- Added a tested panel recommendation workflow helper covering lifecycle labels, duplicate blocking, selected-panel transitions, coordinator transitions, and required rejection reasons.
- Corrected the lecturer Panel Appointments supervisor view so the submitting supervisor can only track recommendation progress and cannot approve or reject as the selected panel member or Programme Coordinator.
- Added a panel recommendation review drawer pattern with approval controls and rejection reason fields placed inside the scrollable drawer content instead of a fixed drawer footer.
- Added a request progress timeline to the panel recommendation View Flow drawer for submitted, selected-panel review, Programme Coordinator review, and final appointment states.
- Fixed the lecturer Supervisor Appointment review drawer so the approve/reject controls and rejection reason field scroll with the request content instead of staying in a fixed bottom action area.
- Added the Django `appointments` app for lecturer-side panel appointment persistence.
- Added database models and migration for student research profiles, panel recommendations, and final panel appointments.
- Added role-gated panel recommendation APIs for supervisor submission/tracking, selected panel accept/reject, Programme Coordinator confirm/reject, final panel assignments, and panel records compatibility.
- Connected the lecturer Panel Appointments frontend workflow to the new backend endpoints while preserving `VITE_USE_MOCKS` mock mode.
- Routed Programme Coordinator users to the role-aware panel recommendation coordinator review queue instead of the office/admin panel monitoring screen.
- Extended `seed_users` with a selected panel lecturer account and an eligible supervised student research profile for panel recommendation testing.
- Resolved the `origin/main` merge conflicts on `Lim_Branch` by preserving the organized `frontend/` and `backend/` layout, retaining the richer panel recommendation workflow, and keeping incoming Django auth/reset-password wiring.
- Cleaned the frontend package after the merge so obsolete Node/Express server scripts and dependencies stay out of the Vite app.
- Built the announcement + notification backend (`announcements` app) and wired the frontend: announcement publish/draft/delete with file attachments, per-recipient notification fan-out on publish, and the in-app notification feed with mark read/unread and attachment download (backed by a shared `NotificationsContext` that also drives the header bell badge).
- Normalized the account model into a generalization/specialization (EER) hierarchy: `User` is the superclass; `Student`, `OfficeStaff`, and `Lecturer` are one-to-one subtype tables; `Coordinator`, `Supervisor`, and `Panel` are one-to-one specializations of `Lecturer`. Moved `department` / `student_id` / `staff_id` off `User` into the relevant profile tables; `User.to_public_dict()` still returns the same flat shape (`id, email, role, fullName, department, studentId, staffId`) the frontend expects, so the login API contract is unchanged.
- Updated the login lookup (matches email / matric no / staff no through the profile relations), the Django admin (profile inlines on the user page + a dedicated Lecturer admin with Coordinator/Supervisor/Panel inlines), the create/change forms, and `seed_users` (now also seeds the role profiles) for the new subtype tables. Migrated the existing demo accounts and superuser into their profile tables.
- Added an Entity-Relationship diagram for the user/role hierarchy at `docs/erd/01-user-roles.md`.
- Added a real Settings module (`SettingsView`) routed for every role: profile summary, editable contact details, password-change form with validation, and notification preference toggles, all using the shared portal primitives.
- Improved mobile responsiveness: narrower sidebar drawer on small screens, tightened top-header utility spacing, and a help button that collapses on the smallest viewports.
- Cleaned up the login screen: removed the demo "Enter Portal Direct" banner, the marketing feature cards (Secure Role-Based Access / Automated Letter Gen / FAQ Student Support), and the System Online / Updated Today / SSL Secured status badges.
- Split the notification bell view into **Announcements** and **Notifications** tabs (by the backend `isAnnouncement` flag). Announcements are live; the Notifications tab is reserved (currently empty) for upcoming supervisor-appointment and confirmation-letter events.
- Fixed the post-merge appointments API break caused by the account subtype-table refactor: panel candidate, eligible supervisee, recommendation, and student panel serializers now read staff numbers, departments, and matric numbers from role-profile tables instead of removed flat `User` fields.

## Current Testing Status

- Workflow ageing/deadline verification passes `python manage.py test appointments dashboard marks --keepdb` (104 tests), `python manage.py check`, and `python manage.py makemigrations --check --dry-run`; all 28 frontend `.test.ts` files, `npm run lint`, `npm run build`, and `npm run test:production-security` also pass.
- Remediated the three high-severity PostCSS and React Router findings by resolving PostCSS to 8.5.23, migrating browser imports from `react-router-dom` to `react-router` 8.3.0, and updating React/React DOM to 19.2.8. The package audit now reports zero vulnerabilities.
- Browser smoke testing on local Django/Vite (`8001`/`3001`) confirms Office Staff/Admin, Lecturer, Programme Coordinator, and Student dashboards/action centres render without console errors. Office Supervisor/Panel monitoring exposes Waiting and optional longest-waiting ordering, Lecturer/Coordinator Panel queues expose Waiting, Marks tables expose Deadline, and Student Panel processing remains generic without internal stage or recommendation identifiers.
- Focused route helper, role permission, and workflow notification route tests pass after adding clean URL routing.
- `npm run lint` passes after adding clean URL routing and the missing Overdue status label.
- `npm run build` passes after adding clean URL routing; the existing large bundle chunk warning remains.
- Supervisor panel cancellation verification passes: 3 focused Django API tests, the panel workflow frontend test, `npm run lint`, `npm run build`, and `makemigrations --check --dry-run`.
- Focused Programme Coordinator workspace, programme authorization, full lifecycle, and selected-panel review-history Django tests pass.
- Focused panel recommendation filtering and shared pagination frontend tests pass.
- `npm run lint` passes after adding the Programme Coordinator dashboard, scoped panel records, coordinator supervisor route surface, and lecturer reviewed history.
- Focused Django panel-record tests pass for standard office monitoring states and rejected-history retention after a later approval (2 tests, 0 failures).
- Focused frontend pagination and panel-summary tests pass.
- `npm run build` passes after the audit/panel record pagination change, with the existing non-blocking chunk-size warning.
- All frontend `.test.ts` scripts pass after adding page-level Panel Appointment nested routing.
- `npm run lint` passes after adding page-level Panel Appointment nested routing.
- `npm run build` passes after adding page-level Panel Appointment nested routing; the existing non-blocking chunk-size warning remains.
- All frontend `.test.ts` scripts, `npm run lint`, and `npm run build` pass after tightening Dashboard page-level nested routing; the existing non-blocking chunk-size warning remains.
- All frontend `.test.ts` scripts, `npm run lint`, and `npm run build` pass after adding top-of-page route scroll restoration; the existing non-blocking chunk-size warning remains.
- All frontend `.test.ts` scripts, `npm run lint`, and `npm run build` pass after adding page-level Supervisor Appointment routing; the existing non-blocking chunk-size warning remains.
- All frontend `.test.ts` scripts, `npm run lint`, and `npm run build` pass after route-level module code splitting and vendor chunking; Vite now emits multiple JS chunks without the default oversized chunk warning.
- Full `python manage.py test appointments -v 2 --keepdb` passes for the combined Supervisor, Panel, Workflow Audit, and Dashboard Timeline coverage; the previously documented appointment/timeline baseline failures are no longer present in the current run.
- Authentication regression tests, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, the canonical credential test, `npm run lint`, and `npm run build` pass after the account migration fix.
- Five-module verification passes for the current implementation slice: all frontend `.test.ts` scripts, `npm run lint`, `npm run build`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, focused Supervisor Workflow tests, Dashboard Timeline tests, Marks tests, Dashboard Summary tests, and full `appointments` tests all complete successfully. The Vite build still reports the documented non-blocking large chunk warning.
- Browser smoke testing against local Django/Vite confirms the five-module role routes render without console errors for Office Staff/Admin, Lecturer, Programme Coordinator, and Student. Current local data has no Office Staff/Admin supervisor records or lecturer active supervisees, so those routed detail checks exercise the intended not-found states; Panel Appointment detail opens successfully from the records table.
- `npm run lint` passes from `frontend/` after reorganizing the project structure.
- `npm run build` passes from `frontend/` after reorganizing the project structure, with the existing non-blocking chunk-size warning.
- `npm run lint` passes after cleaning `frontend/.env.example`.
- `npm run lint` passes after the dashboard integration.
- `npm run build` passes after the dashboard integration.
- `npm run lint` passes after the expanded office-staff module merge.
- `npm run build` passes after the expanded office-staff module merge.
- `npm run lint` passes after the Panel Appointment Management layout fix.
- `npm run build` passes after the Panel Appointment Management layout fix.
- `npm run lint` passes after the lecturer module merge.
- `npm run build` passes after the lecturer module merge.
- `npm run lint` passes after the cross-module design consistency cleanup.
- `npm run build` passes after the cross-module design consistency cleanup.
- `npm run lint` passes after the student role module merge.
- `npm run build` passes after the student role module merge.
- `npm run lint` passes after the authenticated portal surface/brand-token normalization.
- `npm run build` passes after the authenticated portal surface/brand-token normalization.
- `npm run lint` passes after the student Dashboard Overview timeline/cards update.
- `npm run build` passes after the student Dashboard Overview timeline/cards update.
- `npm run lint` passes after the mark records routing fix.
- `npm run build` passes after the mark records routing fix.
- `npm run lint` passes after the shared portal primitive and consistency refactor.
- `npm run build` passes after the shared portal primitive and consistency refactor.
- Vite dev server smoke probe returns HTTP 200 after the shared portal primitive and consistency refactor.
- `npm run lint` passes after the expanded shared table, toast, filter, and shadow consistency cleanup.
- `npm run build` passes after the expanded shared table, toast, filter, and shadow consistency cleanup.
- Vite dev server smoke probe returns HTTP 200 with the root element present after the expanded consistency cleanup.
- `npm run lint` passes after the backend-readiness form, button, status badge, and drawer-control cleanup.
- `npm run build` passes after the backend-readiness form, button, status badge, and drawer-control cleanup.
- Vite dev server smoke probe returns HTTP 200 with the root element present after the backend-readiness UI cleanup.
- `npm run lint` passes after adding env-driven API config and moving backend-shaped demo data into shared mocks/types.
- `npm run lint` passes after the status badge, table action, drawer/modal control, and upload action consistency cleanup.
- `npm run build` passes after the status badge, table action, drawer/modal control, and upload action consistency cleanup.
- Vite dev server smoke probe returns HTTP 200 with the root element present after the status badge, table action, drawer/modal control, and upload action consistency cleanup.
- `npm run lint` passes after the page-header and specialized-control primitive cleanup.
- `npm run build` passes after the page-header and specialized-control primitive cleanup.
- Vite dev server smoke probe returns HTTP 200 with the root element present after the page-header and specialized-control primitive cleanup.
- `npm run lint` passes after the remaining authenticated module header/status/progress primitive cleanup.
- `npm run build` passes after the remaining authenticated module header/status/progress primitive cleanup.
- Vite dev server smoke probe returns HTTP 200 with the root element present after the remaining authenticated module header/status/progress primitive cleanup.
- `npm run lint` passes after the Panel Appointment Management no-horizontal-scroll table layout fix.
- `npm run build` passes after the Panel Appointment Management no-horizontal-scroll table layout fix.
- Vite dev server smoke probe returns HTTP 200 with the root element present after the Panel Appointment Management table layout fix.
- `npm run lint` passes after resolving the `App.tsx` merge compile issue.
- `npm run build` passes after resolving the `App.tsx` merge compile issue and duplicate `package.json` dependency keys.
- `npm run lint` passes after adding React type declarations and fixing the stricter TypeScript issues they exposed.
- `npm run build` passes after adding React type declarations and fixing the stricter TypeScript issues they exposed.
- Vite foreground server check returns HTTP 200 for the app root.
- Vite source probe confirms the merged app includes Dashboard Overview, Registry Management, File Management, FAQ Chatbot, Letter Generation, Announcements, Notifications & Announcements, lecturer routes, and student routes.
- Browser smoke testing confirms `Dashboard Overview` renders the Administration Dashboard with no console errors.
- Browser interaction testing confirms `Manage Timeline` opens Timeline Management and shows the back navigation.
- Focused workflow test `node_modules\.bin\tsx.cmd src\utils\panelRecommendationWorkflow.test.ts` passes for the supervisor panel recommendation approval rules.
- `npm run lint` passes after implementing the supervisor panel recommendation approval flow.
- `npm run build` passes after implementing the supervisor panel recommendation approval flow, with the existing non-blocking chunk-size warning.
- Vite HTTP smoke probe returns HTTP 200 with the root element present after the supervisor panel recommendation approval flow.
- Focused workflow test covers the role-gated recommendation review rule that blocks supervisors from approving their own recommendation.
- Focused workflow test `node_modules\.bin\tsx.cmd src\utils\panelRecommendationWorkflow.test.ts` passes after fixing the approval drawer scroll behavior.
- `npm run lint` passes after fixing the supervisor appointment and panel recommendation approval drawer scroll behavior.
- `npm run build` passes after fixing the supervisor appointment and panel recommendation approval drawer scroll behavior, with the existing non-blocking chunk-size warning.
- `npm run lint` passes after resolving the `origin/main` merge conflicts on `Lim_Branch`.
- `npm run build` passes after resolving the `origin/main` merge conflicts on `Lim_Branch`, with the existing non-blocking chunk-size warning.
- `python manage.py test appointments` passes for panel recommendation creation, duplicate blocking, selected-panel decisions, Programme Coordinator approval, assignment output, and wrong-user denial.
- `python manage.py test` passes after adding the appointments backend workflow.
- `python manage.py check` reports no Django system issues after adding the appointments app.
- `python manage.py migrate` applied the appointments migration to the configured local PostgreSQL database.
- `python manage.py seed_users` refreshed demo accounts and created the panel recommendation demo profile.
- `npm run lint` passes after wiring the panel appointment workflow to backend services.
- `npm run build` passes after wiring the panel appointment workflow to backend services, with the existing non-blocking chunk-size warning.
- Fixed the panel recommendation refresh-loss issue by routing panel appointment service calls to the Django backend by default with `VITE_USE_PANEL_BACKEND=true`.
- `npm run lint`, focused panel workflow test, `python manage.py test appointments`, and `npm run build` pass after fixing the panel backend/mock routing issue.
- Fixed lecturer panel appointment UI data bugs: selected-panel-only accounts no longer see a fake supervisee recommendation card, the panel workload card now reflects actual assignment rows, and submitted recommendation history de-duplicates backend records.
- Removed the duplicate supervisor-side recommendation flow table from the lecturer Panel Appointments page so submitted recommendations are the single tracking surface.
- Rebuilt the submitted recommendation detail drawer to use real recommendation fields, remove hardcoded panel workload and screenshot-specific fallback data, and display the selected-panel/coordinator confirmation timeline with backend date-time fields.
- Removed the panel recommendation save-as-draft flow from the frontend and backend create API.
- Added backend panel workload validation and a candidate workload endpoint so reserved workload includes confirmed active panel appointments plus submitted/pending nominations before submission.
- Updated the recommend-panel drawer to explain reserved workload, show real candidate workload counts, disable full-workload candidates for submission, and keep only the direct submit action.
- Added a student-facing panel appointment backend endpoint that returns pending state before confirmation and confirmed active appointed-panel details after Programme Coordinator confirmation.
- Connected the student Panel Appointment page to the persisted panel appointment workflow, removed the manual Pending/Confirmed test toggle, and kept the FAQ/help action available.
- Updated the student panel endpoint so seeded student accounts without a linked research profile see the normal pending appointment state instead of a data-load error.
- Simplified the confirmed student Panel Appointment page into one appointed-panel summary plus a compact FAQ help row, removing staff ID, supervisor display, duplicate date/semester fields, and repeated student metadata.
- Connected the Office Staff/Admin Panel Appointment Management records and summary cards to persisted panel workflow data, including No Panel, Recommendation, Pending, Approved, and Rejected monitoring states.
- Finished the Office Staff/Admin panel monitoring integration by making cancelled recommendations a first-class persisted monitoring state, adding cancelled summary/tab/attention/detail support, exporting lifecycle metadata in CSV, and limiting the panel records endpoint to Office Staff/Admin users.
- Removed the stale Panel Appointment Management `Workload Alert` lifecycle tab; workload pressure remains in the dedicated persisted workload monitoring surface with clamped utilization displays.
- Reworked Office Staff/Admin Panel Appointment Detail to render backend record fields, dynamic `Session YYYY/YYYY` badges, and no-records placeholders for related files/evaluation instead of screenshot/demo data.
- Added the shared full panel workflow status timeline to Office Staff/Admin Panel Appointment Detail and removed the confidential administrative notice plus explanatory no-records copy.
- Added recorded date-time display to the Office Staff/Admin panel workflow timeline and enriched the related panel status card with staff ID, email, assigned date, and status context.
- Fixed the Office Staff/Admin Panel Appointment Management layout so the records table sits directly under the search/filter card while attention and workload widgets remain in the right column.
- Added an Office Staff/Admin panel workload backend endpoint and connected both the Panel Workload Snapshot and Panel Workload Monitoring page to real lecturer workload rows.
- Implemented real CSV downloads for Office Staff/Admin Panel Appointment Management and Panel Workload Monitoring using the currently filtered rows.
- Replaced the mock lecturer/student workload detail drawer with real confirmed appointment and pending nomination workload items from the backend.
- Reworked Lecturer Panel Assignment Detail to render backend assignment fields, dynamic `Session YYYY/YYYY` badges, and no-records placeholders for related documents/EE evaluation instead of screenshot/demo data.
- Added the shared full panel workflow status timeline to Lecturer Panel Assignment Detail and removed the explanatory no-records/footer copy.
- Added recorded date-time display to the Lecturer panel assignment workflow timeline using the backend recommendation and appointment lifecycle timestamps.
- Added the Django `dashboard` app for Office Staff/Admin semester timeline persistence.
- Added semester timeline database models for active timelines, P1/P2 timeline entries, and timeline audit logs.
- Added structured Excel `.xlsx` template generation and upload parsing with `openpyxl` for UC47 timeline imports.
- Added role-gated dashboard timeline APIs for active timeline retrieval, template download, timeline upload/replacement, timeline entry patching, and role-specific dashboard tasks.
- Connected the dashboard timeline frontend service and office-staff timeline management screen to the new dashboard timeline endpoints while preserving mock mode.
- Replaced the hardcoded dashboard timeline visualization with a backend-shaped P1/P2 timeline view that shows the required no-active-timeline message without hiding other dashboard sections.
- Refined the Administration Dashboard timeline UI to remove Month/Quarter/Year controls, use P1/P2 phase switching, keep P2 selectable with an empty-state message, remove `Export Report` and `New Entry`, and make `Manage Timeline` a direct navigation button.
- Updated Timeline Management to use the same P1/P2 calendar-style timeline surface, removed the overflow menu action, stopped the edit drawer from opening automatically, and simplified Add/Edit drawers so classification is P1/P2 only with status derived from dates.
- Reworked the shared P1/P2 timeline display from a list/table into a month-lane calendar-style view with month headers, timeline labels positioned by date range, and a click-to-view details modal.
- Adjusted the month-lane timeline so each event renders on its own row with a left event label and a date-range bar, reducing congestion when multiple entries fall near the same months.
- Corrected month-lane bar sizing so event bars are proportional to actual dates instead of filling whole month columns, removed the context column, removed inline date text from event bars, and allowed long event labels to wrap instead of truncating.
- Refined the Administration Dashboard calendar controls so Research Project 1/Research Project 2 sit beside Refresh, event chips use compact wrapping labels without the separate vertical marker, the P1 mock timeline includes six entries, and the old status legend plus `View Full Timeline` action are removed.
- Completed the Timeline Management persistence pass: Add Timeline Entry now creates database entries on the active timeline, Edit can move entries between P1/P2, Delete removes entries through the backend, Recent Timeline Updates reads real audit logs, summary cards read the active timeline, and Upload Timeline performs real backend validation/import instead of simulated validation.
- Removed user-facing Step and Status fields from the semester timeline upload contract and added Title: the official template now contains Level, Title, Detail, Action, Deadline Start, Deadline End, Week Label, and Target Roles, while internal ordering and status are derived by the system.
- Simplified the Administration Dashboard presentation scope by removing the four placeholder summary cards, removing the Records Needing Attention status column, keeping only relevant attention rows with unfinished dependency counts set to zero, and reducing Office Monitoring Tasks to timeline upload done plus three required-action setup tasks.
- Fixed role-scoped dashboard timeline visibility so student dashboards only show `STUDENT` timeline entries, while Office Staff/Admin keeps the full timeline view; the shared timeline component now supports lecturer scoping when a lecturer dashboard uses it.
- Limited semester timeline target roles to Student, Lecturer, and Office Staff, and updated schedule labels to use the new short Title field while keeping Detail as the click-through description.
- Simplified the Student Dashboard Overview by removing the Active Student summary card, keeping only Supervisor and Panel Appointment cards, removing Semester Progress, academic-guidelines, and Profile Status Complete panels, and replacing static next actions with reusable timeline-driven role actions.
- Added a dedicated Lecturer Dashboard Overview with a read-only lecturer-scoped semester timeline, no Manage Timeline button, no office-staff monitoring sections, two lecturer workspace cards, and the same reusable timeline-driven next actions.
- Updated the shared dashboard timeline heading for Office Staff/Admin, Student, and Lecturer dashboards to display `Session YYYY/YYYY` instead of `Semester II YYYY/YYYY`; Timeline Management now uses the same active session wording.
- Wired the Office Staff/Admin Dashboard `Lecturers near panel workload limit` row to real panel workload data from `getPanelWorkloads()`, counting lecturers marked Near Limit or Full Load instead of using a static mock count.
- Replaced browser-default alert popups in the dashboard/panel surfaces touched by this slice with portal toasts or inline validation.
- Removed the section-level status badge from `Panel Recommendations for My Supervisees` so mixed recommendation states are represented only by the individual student/recommendation status badges.
- `python manage.py test appointments`, `python manage.py makemigrations --check --dry-run`, `python manage.py check`, focused panel workflow test, `npm run lint`, and `npm run build` pass after removing panel recommendation drafts and adding workload validation.
- `python manage.py migrate` applied the no-draft and workload-validation support migrations to the local development database.
- `python manage.py test appointments`, `python manage.py check`, `npm run lint`, focused panel workflow test, and `npm run build` pass after the submitted recommendation drawer and timeline timestamp cleanup.
- `python manage.py test appointments --keepdb`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, focused panel workflow test, `npm run lint`, and `npm run build` pass after connecting the student Panel Appointment page to the persisted appointed-panel workflow.
- `python manage.py test appointments --keepdb` and `python manage.py check` pass after adding the pending fallback for valid student accounts without a research profile.
- `npm run lint` passes after simplifying the confirmed student Panel Appointment UI.
- `python manage.py test appointments --keepdb`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, focused frontend panel summary helper test, focused panel workflow test, `npm run lint`, and `npm run build` pass after connecting Office Staff/Admin panel monitoring records and fixing the filter/table layout.
- `python manage.py test appointments --keepdb`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, focused panel appointment/workload/workflow frontend tests, `npm run lint`, and `npm run build` pass after connecting Office Staff/Admin workload snapshot and workload monitoring to backend data.
- `npm run lint` and `npm run build` pass after implementing panel appointment and panel workload CSV downloads.
- `npm run lint`, `npm run build`, `python manage.py test appointments --keepdb`, and `python manage.py check` pass after connecting Office Staff/Admin and Lecturer panel detail pages to backend fields and dynamic session badges.
- `npm run lint` and `npm run build` pass after adding shared workflow timelines and trimming panel detail empty-state/footer copy.
- Focused dashboard timeline API tests pass for no-active-timeline payload, admin-only template/upload, valid Excel import, invalid template errors, duplicate/conflicting rows, active timeline replacement, entry patching, audit logs, and office-staff tasks.
- `npm run lint` passes after wiring the dashboard timeline frontend service and P1/P2 dashboard timeline view to the backend contract.
- `python manage.py test --keepdb`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, and `npm run build` pass after adding the dashboard timeline backend/database slice and frontend integration.
- `python manage.py migrate` applied `dashboard.0001_initial` to the local development database.
- `npm run lint` passes after refining the Administration Dashboard and Timeline Management P1/P2 timeline UI.
- `npm run lint` passes after converting the shared timeline display to a month-lane calendar-style view.
- `npm run lint` and `npm run build` pass after tightening the calendar labels, moving the Research Project phase buttons beside Refresh, expanding the P1 mock timeline to six entries, and removing the dashboard timeline footer controls.
- Focused dashboard timeline API tests pass after adding create-entry, delete-entry, level-move, and audit-log endpoints for Timeline Management.
- `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py test appointments.test_dashboard_timeline -v 2 --keepdb`, `npm run lint`, and `npm run build` pass after completing the Timeline Management persistence pass.
- `python manage.py migrate dashboard` applied `dashboard.0002_alter_timelineauditlog_action` to the local development database.
- `npm run lint` and `npm run build` pass after simplifying the Administration Dashboard presentation scope.
- `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py test appointments.test_dashboard_timeline -v 2 --keepdb`, `npm run lint`, and `npm run build` pass after adding timeline entry titles and limiting target roles to Student, Lecturer, and Office Staff.
- `python manage.py migrate dashboard` applied `dashboard.0003_semestertimelineentry_title` to the local development database.
- `npm run lint` and `npm run build` pass after simplifying the Student Dashboard Overview and adding the Lecturer Dashboard Overview.
- `npm run lint` and `npm run build` pass after wiring the dashboard lecturer workload attention count to panel workload data and replacing targeted dashboard/panel browser alerts.
- `npm run lint` passes after removing the misleading section-level panel recommendation status badge.
- `npm run lint`, `npm run build`, `python manage.py test appointments --keepdb`, and `python manage.py check` pass after adding panel workflow date-times, enriching the related panel status card, and changing dashboard timeline headings to `Session YYYY/YYYY`.
- Vite no longer reports the default production chunk-size warning after the route-level lazy-loading and vendor-chunking pass.
- `python manage.py check` passes after the account subtype-table refactor (0 issues).
- `makemigrations` + `migrate` apply the `accounts/0002` subtype-table migration cleanly; `seed_users` repopulates the demo accounts and their role profiles.
- Verified login by email and by matric number, and that `to_public_dict()` correctly resolves department / IDs from the new profile tables.
- `npm run lint` and `npm run build` pass after the Settings module, mobile responsiveness, login cleanup, and notification-tab split (with the existing non-blocking chunk-size warning).
- `python backend\manage.py test appointments -v 2 --keepdb` passes after updating appointments APIs and tests for the normalized role-profile tables.
- `python manage.py test -v 2 --keepdb` passes from `backend/` after the appointments/profile-table compatibility fix.
- `python manage.py test appointments --keepdb`, all frontend `.test.ts` scripts, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `npm run lint`, and `npm run build` pass after finishing Office Staff/Admin panel monitoring integration with cancelled records, Office Staff/Admin-only records access, lifecycle CSV fields, and clamped workload utilization.
- `npx.cmd tsx` over all frontend `.test.ts` scripts, `npm.cmd run lint`, `npm.cmd run build`, `python manage.py test appointments.test_supervisor_workflow appointments.tests dashboard.tests marks -v 2 --keepdb` split into focused runs, `python manage.py check`, and `python manage.py makemigrations --check --dry-run` pass after completing the Workflow and Approval Tracking naming/rejection-control slice.
- Browser smoke testing on local Django/Vite (`8001`/`3001`) confirms Office Staff/Admin, Lecturer, Programme Coordinator, and Student workflow routes render without app-visible errors or console errors after the Workflow and Approval Tracking slice.
- `python manage.py test accounts announcements appointments dashboard marks letters --keepdb` passes all 86 tests; `python manage.py check` reports no issues and `python manage.py makemigrations --check --dry-run` reports no changes after demo-account isolation.
- All 19 frontend `.test.ts` files pass, including the production canary-build guard; `npm run lint`, `npm run build`, tracked-source credential/PII scans, and normal production-output scans pass.
- Browser smoke testing confirms the development console logs in Office Staff/Admin, Lecturer, Programme Coordinator, and Student through their fictional `DEMO-*` identifiers. The production build retains manual login while rendering no demo console, stale console helper copy, or browser console errors.
- Added a shared frontend approved-programme list for dashboard/panel-facing flows and aligned panel appointment demo/API fallback data plus backend appointment seed/test data to the three coursework programmes.
- Reworked demo account refresh so an optional local JSON mapping renames legacy users in place, preserving protected workflow, timeline, and audit references.
- Added backend and frontend regression tests for seed guards, fictional fixture identity, configured passwords, protected-history migration, development gating, and production bundle isolation.

## Known Issues and Notes

- Supervisor and Panel waiting ages are informational calendar-day values only. No SLA, due-soon, or overdue classification will be added until the faculty supplies an approved turnaround policy.
- The enforced CSP must not replace the report-only include until every owned role flow is free of browser-console violations. Inline styles remain temporarily allowed for dynamic React layout, while inline scripts are prohibited.
- Production HSTS intentionally remains staged at one hour without `includeSubDomains` or preload until HTTPS is verified across every deployment subdomain.
- Production deployments behind TLS-terminating proxies must enable `DJANGO_TRUST_X_FORWARDED_PROTO` only after configuring the proxy to strip untrusted forwarded-protocol headers.
- DRF now defaults to authenticated access, logout requires authentication, and route-wide anonymous plus letter role-matrix tests cover the currently owned APIs. `python manage.py test accounts.test_api_security letters appointments dashboard marks --keepdb` passes all 82 tests.
- Login and password-reset endpoints now use separate environment-configurable per-IP throttle scopes with standard `429`/`Retry-After` responses; authentication forms show a shared retry-later message. All 13 focused authentication security/throttle tests, the frontend auth-error test, `npm run lint`, and `npm run build` pass.
- Timeline upload hardening now validates the 10 MB file limit and XLSX archive integrity, structure, encryption, paths, macros, entry count, and uncompressed size before spreadsheet parsing; the frontend applies the same size limit before submission. All 24 focused timeline API tests, the frontend upload-validation test, `npm run lint`, and `npm run build` pass.
- Final core-security verification passes all 112 Django tests across Accounts, Announcements, Appointments, Dashboard, Marks, and Letters; `python manage.py check` reports no issues, the migration dry run reports no changes, all 21 frontend `.test.ts` files pass, and frontend lint/build complete successfully.
- Fail-closed production settings verification passes all 6 focused subprocess tests and all 118 Django regression tests across Accounts, Announcements, Appointments, Dashboard, Marks, and Letters. `python manage.py check` and a strict production `python manage.py check --deploy` report no issues, and the migration dry run reports no changes.
- JWT session lifecycle verification passes all 126 Django tests across two serial groups (38 Accounts/Announcements and 88 Appointments/Dashboard/Marks/Letters), all 22 frontend `.test.ts` files, TypeScript lint, the production build, Django checks, migration dry run, and strict production deployment checks. Live HTTP cookie-session smoke passes login, bearer identity, two refresh rotations, restoration, logout, and post-logout rejection for Office Staff/Admin, Programme Coordinator, Lecturer, and Student. The in-app browser connector could not initialize, so no automated UI browser-smoke pass is claimed for this slice.
- Production CSP verification passes all 126 Django tests, all 23 frontend `.test.ts` files, TypeScript lint, the production build, Django checks, migration dry run, strict production deployment checks, and the Django `collectstatic` dry run. The production guard verifies policy parity, required Nginx routing and headers, `.map` denial, script-free letter output, and bundles without maps, source-map references, inline entry scripts, demo credentials, or testing-console content. Native Nginx is unavailable, Docker Desktop is stopped, and the browser connector could not initialize, so `nginx -t` and automated report-only/enforced UI smoke are not claimed.
- Frontend tooling remediation passes all 23 `.test.ts` files, the named production-security build guard, TypeScript lint, and the production build. `npm run audit:security` reports zero vulnerabilities, and `npm ls vite tsx esbuild --all` confirms Vite 6.4.3, `tsx` 4.23.1, nested `esbuild` 0.28.1, and direct/Vite `esbuild` 0.25.12 without invalid or duplicate tree errors.
- The current dependency advisory remediation passes all 28 frontend `.test.ts` files, the focused route suite, TypeScript lint, the production build, and both production artifact guards. `npm run audit:security` reports zero vulnerabilities; the resolved tree contains React Router 8.3.0, React/React DOM 19.2.8, and one overridden PostCSS 8.5.23 resolution.
- Workflow analytics verification passes all 111 Dashboard/Appointments/Marks backend tests plus all 7 focused reporting tests, Django checks, migration dry-run, all 30 frontend `.test.ts` files, TypeScript lint, production build, zero-vulnerability audit, and both production artifact guards.
- Browser smoke on local Django/Vite (`8001`/`3001`) confirms Office Staff/Admin programme filtering and XLSX response, managed-programme Coordinator reporting, assigned Lecturer reporting, Student report-route redirection, and a clean browser console. The smoke also exposed and verified a regression fix for workbooks whose role-visible sheets contain headers but no data rows.
- Student Progress Dossier verification passes all 118 Dashboard/Appointments/Marks backend tests, the 14 focused dossier/report tests, Django checks, migration dry-run, all 32 frontend `.test.ts` files, TypeScript lint, production build, zero-vulnerability audit, and both production artifact guards.
- Dossier browser smoke confirms the complete Office Staff/Admin view, assigned-section Lecturer filtering, Student self-view redaction, protected Coordinator out-of-programme not-found behavior, desktop layout, 390 px responsive layout, and a clean browser console. The configured demo Coordinator has no seeded student in its managed programme, so its authorized in-programme rendering remains covered by the backend programme-scope test rather than this local browser fixture.
- Browser smoke confirms Office Staff/Admin, Lecturer, Programme Coordinator, and Student can log in and navigate to role-appropriate routed modules under React Router 8 without console errors.
- A fresh headless browser smoke rerun remains incomplete because the temporary Chrome/Vite DevTools target did not attach to the app reliably. No browser-smoke pass is claimed; role routing, anonymous access, throttling, and valid/rejected timeline uploads remain covered by the automated suites, and the existing user-run development servers were not modified.
- Announcements/Notifications remain teammate-owned and behaviorally unchanged. Known deferred risks are cross-sender modification, draft/attachment visibility authorization, and missing authoritative announcement attachment size/content validation.
- Previously committed demo passwords and realistic fixture data remain in Git history until the repository is made private and a collaborator-coordinated `git filter-repo` rewrite is completed; rewritten branches and tags will require force-pushes and fresh clones.
- Git commands still report a Windows safe-directory ownership mismatch for the project root in this environment; configure the project as a safe directory locally before committing.
- A legacy generated metadata folder named `fsktm-postgraduate-administrative-portal1` remains at the root because the folder is locked by another process. It is not part of the runnable application after the reorganization.
- Unfinished or teammate-owned modules may remain mock-backed during development. Dashboard/Timeline, Supervisor, Panel, Marks, and Workflow/Approval Tracking are unconditionally Django-backed.
- Backend integration is still pending for broader registry, file, FAQ, and some notification workflows.
- Remaining component-local arrays are mostly UI control choices such as month labels, filter options, decorative step labels, file size units, avatar style options, and suggestion chips.
- The previous Vite default 500 kB chunk warning has been resolved through route-level lazy loading and vendor chunking.
- Git commands from this environment report a parent repository ownership mismatch, so git metadata may need local safe-directory configuration before commits can be made.

## Next Steps

- Obtain an approved faculty turnaround policy before introducing any Supervisor or Panel SLA thresholds or overdue labels.
- Upgrade local development and deployment Node.js runtimes to 22.22.0 or newer before the next clean install; the current workstation's Node 22.14.0 can build the application but is below React Router 8's supported engine floor.
- Complete browser acceptance for the persisted Settings module; keep email Office-managed and unavailable notification delivery services clearly labelled.
- Populate the Notifications tab once the supervisor-appointment and letter modules emit non-announcement notifications (`is_announcement=False`); they will appear automatically and feed the bell badge.
- Decide a single source of truth for Programme Coordinator (it currently exists both as a `User.role` value and as a `Coordinator` profile table).
- Keep current configurable demo defaults for rubrics, supervisor document requirements, mark components, and workload values until official office rules/templates are received; then seed the official values without changing the core five-module workflow code.

## Supervisor-to-Panel Handoff Completion

- Added required Research Area capture for new multipart Supervisor applications while preserving blank historical records.
- Moved final Programme Coordinator approval into an atomic service that provisions or safely reuses the research profile, creates the active Supervisor appointment, and records the approval event without partial state.
- Added conflict handling for ambiguous profiles and downstream-used profiles owned by another Supervisor; these cases return `409` and leave the application pending.
- Restricted Panel eligibility and recommendation creation to students with an active approved Supervisor appointment belonging to the authenticated Lecturer.
- Added public Student Panel readiness states, persisted Research Area rendering, profile-ready approval feedback, and an active-supervisee deep action into the existing Panel recommendation drawer.
- Updated guarded demo seeding with realistic approved Supervisor applications and appointments for seeded Panel profiles while preserving idempotency.
- Added migration coverage for primary-key-preserving legacy backfill and an end-to-end Supervisor approval to Panel approval to Marks task-generation regression.
- Verification: the full Accounts/Appointments/Dashboard/Marks suite passes 226 tests after the focused handoff, conflict, migration, eligibility, readiness, seed, downstream-history, and end-to-end tests. All 40 frontend `.test.ts` files, TypeScript lint, the production build, and both production artifact guards pass. Django checks and migration dry-run pass, and the development database has applied `appointments.0009`.
- A newly published transitive `nanoid <3.3.17` advisory appeared during verification. The lockfile now resolves `nanoid 3.3.18`; `npm run audit:security` reports zero vulnerabilities and the dependency-only lock update is kept in a separate security commit.
- The local Django and Vite servers started successfully at `127.0.0.1:8002` and `127.0.0.1:3000`. The in-app browser loaded the Vite document but did not execute its module bundle, so no automated UI browser-smoke pass is claimed for this slice.

## Appointment Closure and Reassignment

- Implemented persisted Supervisor/Panel closure, immutable lifecycle events, active uniqueness constraints, replacement lineage, direct Office/Coordinator closure, and atomic approval-chain handovers.
- Added Student Supervisor replacement with fresh documents and Lecturer Panel-member replacement through existing role queues.
- Added outgoing Panel-recommendation cancellation during Supervisor handover and immediate workload release after closure.
- Added Marks-task retirement, draft snapshot audits, clean replacement tasks, submitted-history preservation, active-query filtering, and authorized retired-task history/detail rendering.
- Extended monitoring, Coordinator records, CSV/report metadata, dossiers, and lifecycle detail views; removed fabricated Office Supervisor detail identifiers.
- Added focused backend and frontend lifecycle tests. The focused lifecycle suite passes 8 tests, including replacement after an earlier direct closure; the final lifecycle/report/dossier regression suite passes 23 tests.
- The complete Appointments/Dashboard/Marks backend suite passes 184 tests, and the affected lifecycle/report/dossier/Marks suite passes 74 tests. All 41 frontend `.test.ts` files, TypeScript lint, production build, dependency audit, production artifact guards, Django checks, migration dry-run, and diff checks pass. No browser-smoke result is claimed for this slice.
## Academic Participant Lifecycle Management (2026-08-18)

- Implemented authoritative Student and Lecturer lifecycle metadata, immutable participant audits, and three staged migrations across Accounts, Appointments, and Marks.
- Added Office-only participant list/detail/transition/pending-cancellation APIs and the lazy `/dashboard/participant-lifecycle` operational workspace.
- Implemented Deferred pause/reactivation behavior, Withdrawal cancellation/closure/retirement, Graduation blockers/completion, Retiring assignment exclusion, and terminal retirement with login disablement and refresh-session revocation.
- Added Paused evaluation tasks and immutable task lifecycle snapshots while preserving submitted Marks and all historical identifiers.
- Propagated lifecycle eligibility through Supervisor/Panel candidate lists, serializers, final approvals, Marks generation, backup assignment, Dashboard actions, Reports, and Progress Dossiers.
- Added Student read-only and Lecturer Retiring dashboard banners, Office report lifecycle counts/attention, internal dossier audit history, and public dossier redaction.
- Updated the FYP title and measurable owned-module outputs. Course registration, enrolment, credit accumulation, scheduling, and general coursework results remain explicitly out of scope.
- `docs/Functional Requirements.pdf` and `docs/Use Case Description.pdf` were not edited because editable source files are unavailable; their older title/confirmation-letter wording remains an academic-document follow-up.
- Verification: 10 focused lifecycle tests and all 244 Accounts/Appointments/Dashboard/Marks tests pass. All 42 frontend `.test.ts` files, TypeScript lint, production build, dependency audit, production demo/CSP artifact guards, Django checks, migration dry-run, and diff checks pass. Browser smoke confirms the Office lifecycle list/detail workspace loads without console errors and direct Student access redirects to the Student Dashboard.


## Appointment visual polish (24 October 2026)

- Fetched origin and fast-forwarded the current branch to latest `origin/main` (`deffefa`); preserved all existing uncommitted work.
- Completed researched design options, an implementation plan and six critique rounds, followed by restrained icons for appointment summaries, navigation, people cards, request/research headings and guidance across role experiences. Details: `docs/APPOINTMENT_VISUAL_POLISH_2026-10-24.md`.
- Validation: TypeScript and production build pass; 15 focused component files report 27 passing tests/checks; three mounted browser suites pass for appointment feedback, Office monitoring navigation and workload summaries. Independent source review found no actionable issues.
- Four role preview compositions pass overflow/decorative-icon checks at 1440, 390 and 320 px; desktop/mobile screenshots inspected and retained in `output/appointment-visual-polish-20261024/`. These use fictional fixture data and production components; authenticated end-to-end acceptance is not claimed.
- Existing ExcelJS build-size warning remains. Backend behavior, role permissions and data calculations were not changed by this visual slice.


### Appointment polish follow-up review (24 October 2026)

- Found and fixed tablet attention-card icon misalignment in both Office appointment modules. The Panel 768 px alignment assertion reproduces the 10 px offset before the fix and passes after explicit column layout.
- Expanded visual checks to inspect local clipping, icon-row alignment, missing role context, Office Panel attention, workload summaries, Student supervisor cards and long capacity badges. Requirements were checked and remain unchanged. Details and reproduction commands are in `docs/APPOINTMENT_VISUAL_POLISH_2026-10-24.md`.
- TypeScript, 27 focused checks and production build pass. Existing appointment feedback/workload browser suites pass. One combined Office monitoring run failed to return fixture results; the isolated rerun passed all ten desktop/mobile scenarios. Full authenticated app-shell acceptance remains unverified.


### Research request detail polish (24 October 2026)

- Closed the missed research-change request detail coverage: summary, requested changes and approval headings now use compact decorative icons and consistent detail heading typography. The profile action has a book icon, and staff transfer team details have a people icon. All consumers of the shared research card receive the update.
- Preserved original/requested snapshot content, status/approval calculations, audit disclosures and role-specific actions. The optional ApprovalProcess heading icon retains unchanged markup for other callers.
- Verification: TypeScript and production build passed; five focused component files reported eight passing tests/checks; the mounted research-profile-history suite passed four disclosure/navigation scenarios. Approved, pending and historical research record previews passed nine width/state combinations at 1440/768/390/320 px as applicable, with no document overflow or local clipping.
- Previews: `output/appointment-visual-polish-20261024/research-approved-1440.png` and related research screenshots. Reproduce in PowerShell with `$env:POLISH_RESEARCH='1'; node output/appointment-visual-polish-20261024/capture.mjs`. These mount production record components with fictional data; authenticated end-to-end acceptance is not claimed.


### Saved research profile/history polish (24 October 2026)

- Removed the secondary “Back to students” button from selected staff research profiles at user request; retained the page-level return link. TypeScript, both focused research/workspace component test files and whitespace checks passed after removal.
- Added book/history icon tiles and shared detail heading typography to saved research profiles and the research-history disclosure. The Student profile summary also gets the book icon; the Office correction/transfer button gets an edit icon. Shared components apply the change across authorised roles.
- Preserved native disclosures, collapsed defaults, newest-first revision order, selected-student reset behaviour and existing correction/transfer permissions.
- Verification: TypeScript, production build, three focused component files and both mounted profile-directory/history browser suites passed. Nine actual-workspace profile preview combinations passed at 1440/768/390/320 px as applicable, including Office history open/closed and Student views; no clipping or horizontal overflow.
- Visual previews use production workspace components and fictional read fixtures. Desktop/mobile screenshots: `output/appointment-visual-polish-20261024/profile-office-history-1440.png` and `profile-office-history-390.png`. Reproduce with `$env:POLISH_PROFILE='1'; node output/appointment-visual-polish-20261024/capture.mjs`.

### Office tools light visual polish (24 October 2026)

- Added muted decorative icons to dashboard tool groups, semester/calendar view controls and key sections in semesters, calendar, periods, lecturer capacity and reconciliation. Reconciliation summary cards reuse the existing appointment metric/icon treatment. No new dependencies, animation or workflow changes.
- Seven focused component test files passed all 16 checks. TypeScript and production build passed; the existing ExcelJS chunk-size advisory remains. Reconciliation browser checks passed at 1440/390/320 px. Semester activation and timeline/feedback suites initially timed out during a parallel run, then passed when rerun serially, including their responsive and permission/action checks.
- Actual Office workspace previews passed 24 page/view/width combinations at 1440/390/320 px, checking document overflow, heading/control clipping and the new decorative SVGs. Inspected desktop and narrow screenshots. Corrected a missing mock Panel-workload endpoint in the home preview and recaptured it; this was a fixture issue, not a production change.
- Reproduce with `$env:POLISH_TOOLS='1'; node output/appointment-visual-polish-20261024/capture.mjs`. Preview data is fictional and read-only; authenticated end-to-end testing is not claimed. Examples: `tools-semesters-1440.png`, `tools-calendar-entries-390.png` and `tools-reconciliation-1440.png` in that output folder. Required requirements/design documents were updated.
