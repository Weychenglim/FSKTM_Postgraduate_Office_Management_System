# Office business permissions and technical admin separation

The user approved separate Office portal and Technical Administrator logins, with governed records in the five owned modules available for admin inspection only. This implements pending-work T01-T06; deployment account provisioning is recorded separately below.

## Profile-maintenance review follow-up

**28 October rollout update:** Local activation and Office flag conversion are complete. The updated API was already running; real technical credential login and Office admin-session denial were verified before conversion. One legacy Office flag was cleared, repeat apply changed nothing and final preview reports zero. Fresh verification passed 123 isolated tests, 29 included Marks browser/API assertions and 83 runtime assertions; 63 protected table fingerprints were unchanged. The historical activation blockers below are superseded. See [rollout evidence and limits](OFFICE_ACCESS_ROLLOUT_2026-10-28.md).

The subsequent review found and fixed a pre-existing owner-link bypass in technical profile maintenance. Existing Student, Lecturer and OfficeStaff profiles now keep their owning User immutable; crafted reassignment is rejected before ModelForm binding. Nine permanent ownership regressions cover both lifecycle overwrites, Office staff identity and preserved valid maintenance/creation. The final follow-up passed 394 accounts/protected-admin tests in 86.566 seconds; no schema or frontend change. See [review and resolution](OFFICE_ADMIN_SEPARATION_REVIEW_2026-10-25.md). The earlier full-suite/browser counts below describe permission-separation verification before this follow-up; local activation and conversion were subsequently completed on 28 October.

## Resulting policy

| Account | Portal authority | Django admin |
| --- | --- | --- |
| Active Office | Existing Office workflows, scope and eligibility rules; corrections/reopening require an explicit user/group `marks.change_markentry` assignment | Denied, including legacy staff/superuser flags and existing sessions |
| Student, Lecturer, Coordinator | Their existing role/programme/appointment authority | Denied |
| Active Technical Administrator with staff and superuser flags | Refused by existing portal authentication | Account/access maintenance and authorized record inspection |
| Inactive or anonymous account | No affected Office authority | Denied |

Shared `accounts.authorization.office_actor` checks active authenticated Office authority without admin flags. `can_correct_marks` resolves explicit Django user/group permission assignments rather than `has_perm`'s automatic superuser shortcut. The API, returned correction capabilities and direct correction/reopening services use the same policy. Other existing Office operations retain their role authority without requiring this correction permission.

The change covers participant lifecycle, acting delegation, research amendment/transfer Office actions, carryover reassessment, Office browse/attention/export projections, Marks configuration, correction/reopening, completion history/grant/revoke and period closure preview. Programme scope, dates, request versions, team acknowledgements, locks, transactional side effects and reasons/audits remain in their existing services.

`config.admin.TechnicalAdminConfig` selects a `TechnicalAdminSite` while retaining Django's model autodiscovery. Both the login form and every admin request require the dedicated technical account rule. Forms reject staff/superuser privilege combinations for portal accounts. The legacy admin Add Research Profile route is now closed: research profiles use the same inspection-only mixin as governed appointments.

## Account setup and existing installations

`seed_users` now creates non-staff/non-superuser Office demo accounts and assigns the explicit correction permission instead of every Marks model permission. Its existing guarded demo/password behavior remains; it is not an account-conversion tool.

Use the dedicated command for existing accounts:

```powershell
.venv/Scripts/python.exe backend/manage.py separate_office_admin_access
.venv/Scripts/python.exe backend/manage.py separate_office_admin_access --apply
```

The first command previews only. Apply runs transactionally, locks the relevant accounts, requires an active dedicated technical superuser with a usable password, refuses mixed-role superusers and clears only Office staff flags. Password hashes, role, activation, direct/group permissions and academic records are preserved. Repeating apply makes no additional changes.

If a technical login has not been provisioned, use `createsuperuser` with the intended maintainer's email and password. Do not convert an Office account or print credentials in tracked documentation. No new schema migration or permission group is required.

Initial local inspection found one legacy Office staff flag and no technical login. The user authorized choosing the account identity. Created `local.technical.admin@example.test` with a generated strong password held only in the ignored `backend/.env.technical-admin-account-2026-10-25.md`. A real Django authentication/client check against the development database verified admin login/index access and portal 403 `technical_account`. No existing account credentials/permissions were changed.

Historical 25 October activation limitation: automatic approval review rejected stopping/restarting the then-running local API with only “blocked by policy”; conversion was deferred to preserve its old portal checks. The separate 28 October startup activated the merged source, and the verified rollout linked above completed local conversion without reseeding or password resets.

## Test-first failures and critical review

- Eight initial contract tests reproduced non-admin Office 403 responses, accepted legacy admin login/form flags, and an inactive direct-service actor. These were expected failures before the implementation.
- Three Marks tests reproduced non-admin correction and configuration/window rejection. Explicit correction permission remains required; a service test also checks missing permission and inactive actors leave entries/scores/audits unchanged.
- The protected-admin suite reproduced the legacy research-profile Add exception, which was closed after its failing test.
- A targeted test showed `has_perm` grants a legacy Office superuser correction authority without an explicit assignment. Replaced it with direct/group grant resolution, including group-removal checks without stale permission caching.
- The first broad run executed 1,549 tests in 996.968 seconds and found four stale negative expectations: Registry lifecycle, Office attention, research directory and supervision export. All expected non-staff Office rejection; they were updated to accept authorized Office access and retain audit/inactive/wrong-role checks. Registry production code was not redesigned. The final file-based parallel run passed all 1,551 tests in 487.320 seconds. A stdin-launched parallel attempt hit Windows spawn errors and was stopped; its abandoned databases/clones were explicitly removed after verifying zero connections. No traceback helper dependency was installed.
- Inspection tests now use dedicated Technical Administrator fixtures. Crafted add/edit/delete and bulk-delete requests remain denied for governed records even to a technical superuser.

## Verification

Final full-suite verification passed **1,551 tests in 487.320 seconds** across accounts, academics, appointments, Marks, dashboard, letters, announcements and documents (two workers, disposable PostgreSQL). All test databases/clones were destroyed. The initial affected workflow gate passed 98 tests in 33.788 seconds; the review/permission/provisioning/legacy-expectation gate passed 70 tests in 49.365 seconds. All 17 opt-in browser journeys passed in 504.279 seconds (719 browser/API assertions), covering non-admin Office actions with retained audit/persistence checks. A fresh final Marks browser rerun after the explicit-grant change passed 1 test in 27.274 seconds with all 29 browser/API assertions. TypeScript and the production build passed, with the existing ExcelJS large-chunk advisory. Django system checks and migration drift passed. Final admin-fixture review explicitly clears the Office permission in the no-permission case; its 18-test admin acceptance suite passes in 4.340 seconds. All disposable task databases/clones and the ignored temporary test launcher are removed; the generated private credential file is retained.

The real Chrome/HTTP journeys use non-admin Office fixtures and disposable PostgreSQL databases, with no mocked academic API. Marks acceptance now includes actual production correction/reopening controls, reason validation, persisted audits and Lecturer resubmission. Supporting, research/transfer, delegation, and carryover/handover journeys cover desktop/phone widths as described in their earlier scoped reports; the Marks journey is desktop.

At the 25 October verification snapshot the API had not been restarted; the 28 October rollout supersedes that local activation limit. No complete browser login-shell certification, native download/file-saving acceptance, production deployment or completion of A05-A07 is inferred. No independent reviewer pass is claimed: the earlier review agent was unavailable due to account usage limits; direct review is recorded instead.

## Related documents

- Design: `docs/superpowers/specs/2026-10-25-office-business-authorization-design.md`.
- Plan: `docs/superpowers/plans/2026-10-25-office-business-authorization.md`.
- Pending register: `docs/PENDING_WORK_REGISTER_2026-10-08.md`.
- A04 acceptance and all unrelated working changes are preserved. No commit or push is part of this task.
