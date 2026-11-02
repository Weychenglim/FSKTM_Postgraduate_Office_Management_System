# Local Office access conversion and verification

Completed 28 October 2026 on `codex/portal-consistency-and-toast`, source HEAD `3070332`. This is local development rollout evidence, not production deployment or completion of A05-A07.

## Reviewed approach and plan

Use the existing transactional `separate_office_admin_access` command. Its preview is read-only; apply locks affected accounts, refuses mixed-role superusers and requires a dedicated active technical superuser with a usable password. It changes only legacy Office `is_staff` values.

1. Inspect the current source, running local API and account flags; verify actual technical credentials and explicit Office correction authority.
2. Run focused authorization, technical-account, profile-ownership, lifecycle, delegation, research, reassessment, Marks and completion-window tests, including the real Marks browser journey, in a disposable database.
3. Prove the running API denies an authenticated legacy Office admin session, permits technical admin login and accepts Office portal reads before conversion.
4. Snapshot account rows and protected tables in memory; preview and apply; compare the exact resulting rows.
5. Verify existing/fresh Office portal sessions and technical recovery; repeat apply and preview; update the current documentation.

The user explicitly authorized brainstorming, planning, critical review and execution. No new permission editor, reseeding, password reset, application-code change or production deployment is required.

## Critical review

- Health alone cannot establish that the updated admin policy is loaded. Before conversion, the actual listening API rejected a valid authenticated Office admin session even while its legacy staff flag remained set.
- A technical account row alone does not establish recovery access. Real credential login reached the actual admin index before and after conversion. Technical credentials and a technical bearer token were refused by the portal.
- Clearing the flag must not remove business permissions. The Office account retained its explicit Marks correction grant, password hash, role, activation and group/direct-permission associations.
- Avoid live academic mutations during access checks. Successful workflow mutations and negative authorization cases use synthetic disposable fixtures; local runtime checks read existing business records.
- Stale sessions and repeat operations matter. The pre-conversion Office portal session remained usable after conversion; a fresh credential login also succeeded. An authenticated Office admin session and a CSRF-valid admin Add request were denied. Repeated apply changed no account rows.
- A historical restart rejection is not a present blocker. The separate 28 October startup had already activated the merged source; this rollout required no restart.

## Results

- Initial local database: `fsktm_pg_office`, one active legacy staff-flagged Office account, explicit Marks correction authority, one usable dedicated technical recovery account, no mixed-role superusers.
- Preview initially reported one legacy Office flag. Apply cleared it; the exact before/after account comparison differed only at that Office account's `is_staff` field. It now has both `is_staff=False` and `is_superuser=False`.
- Final preview reports **zero** legacy Office staff flags. A second apply made no account changes.
- **83 runtime assertions passed** against the real API at `127.0.0.1:8000`.
- Real Office password login and `/api/auth/me/` succeeded. The pre-conversion portal session and a fresh post-conversion session retained participant lifecycle reads, delegation/options, research amendments/options, capacity reassessment, Office and Panel attention, Marks rubric/period configuration reads, workflow reports and reconciliation access.
- Technical admin credential login/index succeeded; technical portal credential login and bearer-token access both returned 403 `technical_account`.
- Authenticated Office admin index and CSRF-valid account Add requests redirected to admin login, before and after conversion.
- A separate final real Office credential attempt at admin login was also rejected; no authenticated admin session was issued.
- In-memory row-count/digest comparisons across **63 protected model/through tables** in accounts, auth, academics, appointments, Marks and dashboard remained identical throughout. This covers academic records, profile/lifecycle rows, audits, permission definitions and group/direct-permission associations. No private rows, credentials, hashes or tokens are written into this report.
- Normal authentication bookkeeping changes are expected: portal/admin login timestamps and refresh/session records. Verification portal sessions were logged out and created admin sessions removed. No passwords were changed.

## Fresh automated verification

The serial Django gate passed **123 tests in 102.850 seconds** using disposable PostgreSQL database `test_office_rollout_20261028`, which the runner destroyed normally:

```text
accounts.test_office_authorization
accounts.test_technical_admin
accounts.test_admin_profile_ownership
accounts.test_participant_lifecycle
accounts.test_delegations
appointments.test_research_amendments
appointments.test_capacity_reassessment
marks.test_admin_acceptance
marks.test_completion_windows
marks.browser_journey
```

The included real Chrome/HTTP Marks journey passed all **29 browser/API assertions**, including non-admin Office correction, reopening, required reasons, immutable audit evidence, preserved scores and Lecturer resubmission. Tests also verify conversion safeguards/idempotency, wrong-role/inactive actors and protected admin/ownership boundaries. Browser evidence uses production components and real isolated APIs, rather than the full portal login shell.

`manage.py check` reports no issues; `makemigrations --check --dry-run` reports no changes. No frontend/application source changed, so a new frontend build is not required for this operational step.

## Limits and remaining work

The local database contained no evaluation tasks or periods, so live submitted-Mark capabilities, completion history and closure preview could not be exercised against existing local rows. Their behavior is covered by the isolated focused tests and the real Marks journey; no live fixtures were seeded to manufacture evidence. This rollout does not certify every production account, full-shell browser path or remaining compound acceptance clause.

T01-T06 local source activation/account conversion and scoped access verification are complete. Production provisioning/rollout and A05-A07 remain separate. Earlier 25 October restart-blocked notes are historical and superseded by the 28 October startup and this report. The historical 406-clause checklist counts are unchanged.
