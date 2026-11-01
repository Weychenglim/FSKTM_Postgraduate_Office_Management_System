# Appointment Confirmation Letters (2026-10-26)

Approved by Xiang on 2026-10-26. When a coordinator confirms a supervisor, panel
member or supporting supervisor for a student, the people involved are told and a
confirmation letter is made for them by itself.

## What already exists

Since 2026-10-15 (UC22) a coordinator's approval of a supervisor or panel
appointment makes the letter from the office's active template for that kind of
letter, issues it and tells the student and the lecturers on it (`letters/
appointment_letters.py`, `letters/signals.py`). The system had no template for
either kind, so every approval only told the office "Appointment letter not made".

## Decisions

| Question | Decision |
| --- | --- |
| Supporting supervisors | Included: a third letter, sent to the student and the supporting supervisor, with the main supervisor in copy. |
| A replaced or ended appointment | Its letter is revoked with the reason, the people on it are told, and it stays in history. |
| Sample template languages | English and Malay; dates print in Malay on the Malay page. |
| Lecturers | An "Appointment letters" tab in File Management lists every letter they received. |

Reuse: the existing appointment letter code (kinds, values, recipients, notices,
reissue, missing letters), the office's revoke, the letter page and output hooks,
and Wey Cheng's workspace components. Nothing in `appointments/` changes; the
receivers live in `letters/signals.py`.

## Phases

1. **Sample templates.** A data migration adds an active sample template for the
   supervisor and panel letters when none exists for that kind, with English and
   Malay pages that use only details the system always has, so the letter is
   issued at once. Malay dates for appointment, approval and acceptance dates.
2. **Supporting supervisors and ended appointments.** A third kind of appointment
   letter (purpose, link to the supporting supervisor appointment, details, sample
   template); a letter is revoked when its appointment ends or is replaced, through
   the same revoke the office uses.
3. **Lecturer letters tab.** File Management's "Appointment letters" tab for
   lecturers.
4. **Full check.** Backend and frontend tests; the three approvals run in the
   browser with the TG accounts on private servers with email off; test data
   removed.

## Status

| Phase | Status | Commit |
| --- | --- | --- |
| 1 Sample templates | Done | `f5b3c8a` |
| 2 Supporting supervisors and ended appointments | Done | `b5ac50e` |
| 3 Lecturer letters tab | Done | `b5ac50e` |
| 4 Full check | Done | see `PROJECT_STATUS.md` |
