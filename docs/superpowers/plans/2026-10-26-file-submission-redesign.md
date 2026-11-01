# File Submission Redesign (2026-10-26)

Approved by Xiang on 2026-10-26, after the proposal page "File Submission Redesign".
Nobody types tags any more: the system tags each file from what it already knows.
Screens follow Wey Cheng's module design, as Letter Generation now does: icon tabs,
summary cards, the grey filter card, tables with pages, `StatusBadge` and progress
steps.

## Decisions

| Question | Decision |
| --- | --- |
| Tags people already typed | Removed, with the tag box and the Settings Tags tab. |
| Labels beyond the automatic tags | None. Automatic tags only. |
| A student who changes programme | Their files follow the student's current programme and intake. |
| Suggest the type from the file name | Yes, for the person to confirm. |

## Automatic tags

Worked out each time a file is shown, so they never go out of date:

| Tag | From | Filter |
| --- | --- | --- |
| Category | the document type's group | `group` |
| Required | the type is a required document | `required=1` |
| Semester | the semester it was uploaded in | `semester` |
| From | the uploader's role: Student, Lecturer, Programme coordinator, PG office | `from` |
| Programme | each linked student's programme (a staff file's chosen programmes) | `programme` |
| Intake | each linked student's intake semester | `intake` |

The office check and Archived stay as status badges. Search also matches programme,
intake and category words.

## Phases

1. **Automatic tags.** Remove `Tag` and `DocumentTag`, the tag field on upload and
   edit, and the tag endpoints; `autoTags` on every file; `from`, `intake` and
   `required` filters, and a programme filter that also finds staff files; the
   summary counts students still to hand in a required document.
2. **Student File Submission.** Icon tabs (To do, My files, Letters from the
   office); required documents as a task list with statuses and progress; the
   upload page with type cards, the type suggested from the file name, and a side
   panel saying who will see it and how it is filed.
3. **Staff upload and the file page.** Sharing from the type with names and a Change
   link; tag chips; the office check as progress steps.
4. **File Management list.** Summary cards, icon tabs, the filter card with
   removable filter chips, a table with tag chips and pages, for the office,
   coordinators and lecturers.
5. **Settings tidy and full check.** No Tags tab; Category first in the type
   editor; every role in the browser at 1440 and 390 px, the preview security check,
   documents.

## Status

| Phase | Status | Commit |
| --- | --- | --- |
| 1 Automatic tags | Done | `1efe446` |
| 2 Student File Submission (and the upload page for every role) | Done | `fd4174b` |
| 3 The file page | Done | `84d57c7` |
| 4 File Management list | Done | `e5ba35d` |
| 5 Settings tidy and full check | Done | the commit that adds this row |

Built as planned, with two differences: the staff upload page was rebuilt in phase 2
with the student one (one component), and the "From" tag names the uploader's role
(Student, Lecturer, Programme coordinator, PG office) rather than supervisor or panel
member, since a lecturer's relationship to each student can change.
