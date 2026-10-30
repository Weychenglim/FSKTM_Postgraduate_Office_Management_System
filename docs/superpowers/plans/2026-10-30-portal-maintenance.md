# Portal Maintenance (2026-10-30)

Approved by Xiang on 2026-10-30. The PG office can put the portal into maintenance:
while it is on, nobody but office staff can sign in or use the portal. Based on how
Moodle, GitLab, Laravel and django-maintenance-mode do it, and on how universities
announce Canvas and Blackboard downtime.

## Decisions

| Question | Decision |
| --- | --- |
| Who can switch it on and off | Every Office Staff/Admin account. |
| Who can still use the portal | Office staff only. The technical admin keeps the Django admin site. |
| People signed in when it starts | Blocked at their next request, but their sign-in is kept, so they carry on when it ends. |
| How it ends | The office ends it by hand. The expected end is only shown to people; once it passes they see "taking longer than planned". |
| Scheduled emails | Deadline reminders and the weekly summary skip their runs while it is on. Scheduled announcements wait too. |
| Advance notice | A banner for everyone once it is planned, on the sign-in page too. |
| Read-only mode | Not built. |

## How it works

- One saved setting: when it starts (now or later), the expected end, a message,
  and who set it. A history records each plan, start, change, end and cancel.
- The portal is "on" from the start time until the office ends it.
- A check runs on every `/api/` request before any module's code. While maintenance
  is on, everyone but office staff gets `503` with code `portal_maintenance`, the
  message, the expected end and a `Retry-After` header.
- Always open: the health check, the maintenance status, sign-in, session renewal,
  sign-out and reading one's own account, so a signed-in person keeps their
  sign-in and sees the maintenance page. Sign-in turns away anyone who is not
  office staff.
- The state is kept in the cache and read from the database only when the cache is
  empty, so a normal request costs no extra query.
- Emergency command for the technical admin: `manage.py maintenance status|on|off`.
- This works only while the portal server runs. A server upgrade that stops Django
  needs a page at the web server (`deploy/nginx`), which is out of scope.

## Screens

- Settings, office only: a Portal maintenance card with the state and a button to
  plan, change, start now, cancel or end it.
- Everyone signed in, once planned: a yellow banner with the time window.
- Office, while on: a red banner on every page with End maintenance.
- Everyone else, while on: a full page with the message, the expected end and the
  office contact. It checks again every minute and returns them when it ends.
- Sign-in page, while on: a notice that only PG office staff can sign in.

## Phases

1. **Backend.** The setting and its history, the request check, sign-in and renewal
   rules, the status and office endpoints, the emergency command, tests.
2. **Frontend.** The maintenance page, banners, sign-in notice, the Settings card
   and its form, the API client spotting `portal_maintenance`, tests.
3. **Wrap-up.** Scheduled commands skip runs while it is on; README and
   PROJECT_STATUS; a two-tab browser check (office and a student).

## Status

| Phase | Status | Commit |
| --- | --- | --- |
| 1 Backend | Done | `9a6d89f` |
| 2 Frontend | Done | `6a85974` |
| 3 Wrap-up (scheduled commands in `9a6d89f`; docs; two-tab browser check) | Done | docs commit |
