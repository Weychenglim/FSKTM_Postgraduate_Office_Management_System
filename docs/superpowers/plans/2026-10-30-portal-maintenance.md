# Portal Maintenance (2026-10-30, redesigned 2026-11-01)

Approved by Xiang on 2026-10-30, then redesigned on 2026-11-01: maintenance is a
technical task, so the switch moved from the office's Settings to Django admin,
and while it is on nobody sees the sign-in page. Based on how Moodle, GitLab,
Laravel, django-maintenance-mode and the UK government's Data Workspace (a Django
admin "Maintenance" tick box) do it, and on how universities announce Canvas and
Blackboard downtime.

## Decisions

| Question | Decision |
| --- | --- |
| Who switches it | The Technical Administrator, in Django admin (`/admin/`). Office staff cannot sign in there. |
| Who can still use the portal | Nobody, office staff included. Django admin keeps working. |
| What people see while it is on | Only the maintenance page, on every address, sign-in included. |
| People signed in when it starts | Blocked at their next request, but their sign-in is kept, so they carry on when it ends. |
| How it ends | The technical administrator switches it off. The expected end is only shown to people; once it passes they see "taking longer than planned". |
| Planned maintenance | A start time in Django admin; signed-in people and the sign-in page see a warning banner until it starts. |
| Scheduled emails | Deadline reminders and the weekly summary skip their runs while it is on. Scheduled announcements wait too. |
| Preview link to check the portal before reopening | Not built. |
| Web server page for upgrades that stop Django | Later; it is in `deploy/nginx`, which needs Wey Cheng. |

## How it works

- One saved setting: when it starts (now or later), the expected end, a message,
  and who set it. A history records each plan, start, change, end and cancel.
- Django admin has a Portal maintenance page (Off, On now, Planned) with a
  read-only summary and the recent changes, and a view-only Maintenance history.
- The portal is "on" from the start time until it is switched off.
- A check runs on every signed-in `/api/` request before any module's code. While
  maintenance is on, it gets `503` with code `portal_maintenance`, the message,
  the expected end and a `Retry-After` header.
- Always open: the health check, the maintenance status, session renewal,
  sign-out and reading one's own account, so a signed-in person keeps their
  sign-in. Sign-in and the password link views refuse everyone while it is on.
- The frontend waits for the maintenance check before showing sign-in or the
  portal, and checks again every minute, when the tab comes back into view and
  when a request is turned away.
- The state is kept in the cache and read from the database only when the cache is
  empty, so a normal request costs no extra query.
- Command line: `manage.py maintenance status|on|off`.

## Status

| Phase | Status | Commit |
| --- | --- | --- |
| 1 Backend (first design: office switch) | Done | `9a6d89f` |
| 2 Frontend (first design) | Done | `6a85974` |
| 3 Wrap-up (first design) | Done | `1f27056` |
| 4 Redesign: Django admin switch, maintenance page for everyone | Done | redesign commit |
