# Office/admin separation review — 25 October 2026

Reviewed the current uncommitted permission-separation implementation against its design, including shared Office checks, explicit Marks grants, admin login/session gates, guarded seeding/conversion and retained account/profile maintenance. This is a direct source/HTTP-test review; no independent reviewer result is claimed.

## Resolution: fixed in source

**28 October local rollout:** The merged source is active, legacy Office flags are converted and actual Office/technical access has been verified. The 25 October activation limitation is historical. See [rollout evidence](OFFICE_ACCESS_ROLLOUT_2026-10-28.md).

The user authorized the correction after review. `ProfileOwnerAdmin` in `backend/accounts/admin.py` now locks the User link on existing Student, Lecturer and OfficeStaff profiles. It checks posted ownership values before Django binds its edit form and returns 403 for reassignment, invalid values or conflicting repeated values. Valid creation and normal permitted maintenance remain available.

Permanent coverage is in `backend/accounts/test_admin_profile_ownership.py`. Nine tests verify unchanged source/target rows and lifecycle audits for both reproduced lifecycle attacks, OfficeStaff identity preservation, read-only edit versus selectable Add controls, invalid/ambiguous POST rejection, valid maintenance (including unchanged owner values from older edit tabs), valid creation, duplicate-add preservation and User-page inline rejection.

Test-first evidence: eight initial tests exposed 15 failing assertions/subcases in 1.134 seconds. After the fix, 79 affected tests passed in 6.930 seconds. The final broader gate passed **394 tests in 86.566 seconds**: all accounts tests plus Academic, Appointment, Dashboard and Marks protected-admin suites. Django checks and migration drift pass; no schema/dependency/frontend change. Disposable databases and the temporary review launcher were removed. No live account/academic records or processes were changed during that review; the subsequent local rollout is recorded above and below.

## Historical P1 reproduction (before the fix)

Locations: `backend/accounts/admin.py`, `StudentAdmin.readonly_fields` (186–191) and `LecturerAdmin.readonly_fields` (150–155). The owning `user` relation is editable on both dedicated maintenance pages. It is also each profile's primary key (`backend/accounts/models.py`, Student 189–191 and Lecturer 322–324).

When editing one existing profile, assigning its User field to an account that already has another profile makes Django save the source object's values into the target's row. Read-only lifecycle fields are still part of that source object, so they overwrite the other person's lifecycle state and metadata even though the administrator never edited those fields directly. Other profile identifiers can also be overwritten. The source profile remains, while the target row changes without the required Office lifecycle service.

Two isolated PostgreSQL/real admin-POST probes reproduced this:

| Probe | Result |
| --- | --- |
| Edit Active Student A; select Deferred Student B's account and a fresh matric number | HTTP 302 success; B becomes Active, matric number changes, lifecycle actor/time/reason are cleared; audit count stays 1 |
| Edit Active Lecturer A; select Retired Lecturer B's account and a fresh staff number | HTTP 302 success; B becomes ACTIVE, staff number changes, lifecycle actor/time/reason are cleared; audit count stays 2 |

Both target states were established through the actual reasoned Office transition services before the admin POST. The probes assert that the target's complete profile row remains unchanged, and both fail. No development academic records were used or modified.

This is a **pre-existing maintenance-path defect**, not a regression introduced by the new shared Office checks. It fell within T04's retained-maintenance review boundary and motivated the correction above.

Review recommendation, now implemented: make the owning User immutable on existing Student/Lecturer profiles, enforce that boundary against crafted POSTs, and review the same shared-primary-key pattern for OfficeStaff maintenance. Retain ordinary permitted account/profile maintenance and proper new-profile creation. Add permanent regression tests for both target-row overwrite cases alongside the existing protected-admin tests. The review itself made no production correction; the user subsequently requested and received the source fix above.

## Historical review validation (before the fix)

The disposable review launcher ran 24 tests in 4.578 seconds: 22 existing shared-authorization and Marks-portal controls pass; the two newly added ownership-reassignment probes fail as described above. Test database `test_office_admin_review_20261025` was destroyed normally. The earlier 1,551-test full suite and 17 browser journeys did not cover this maintenance path; their recorded passes remain historical evidence, not proof that this newly exposed gap is fixed.

The ignored synthetic review launcher was retired after converting the cases to permanent regression tests. Run `accounts.test_admin_profile_ownership` with Django's test command to reproduce the enforced behavior on a disposable test database.

No additional defect was confirmed in the changed Office policy, explicit user/group Marks grant resolution or technical admin login/session checks. Requirements and architecture were checked: their existing workflow/audit preservation requirement already covers this defect, so no new business requirement or architecture change was added. Project Status records the unresolved finding.

## Separate rollout limitation (historical; resolved locally 28 October)

The previous local API restart was rejected by automatic approval review with only “blocked by policy.” This review did not retry the restart or change live flags. A separate 28 October startup subsequently activated the source; the authorized [local rollout](OFFICE_ACCESS_ROLLOUT_2026-10-28.md) then converted the one legacy Office flag and verified actual access. Production deployment remains separate.
