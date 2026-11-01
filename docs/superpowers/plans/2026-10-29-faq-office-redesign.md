# FAQ Chatbot: Office Screens Redesign (2026-10-29)

Approved by Xiang on 2026-10-29 after the proposal page "FAQ Chatbot Office
Redesign" (research on Intercom Fin, Zendesk AI agents and Tidio Lyro, with
wireframes). Only the office's screens change; the student chatbot stays as it is.

## Decisions

| Question | Decision |
| --- | --- |
| "Try it" | Replaced by "Test the chatbot", a page of its own (a side panel would scroll inside the page). Each reply says which answer it came from and links to it. |
| "Entries" | Renamed "Answers". |
| Common questions | Picked from live answers; one whose answer is no longer live is not shown to students. |

Reuse: Wey Cheng's icon tabs, summary card style, filter card, record pages and
pagination, SelectMenu, the floating menu, and the student chatbot's message
parts for the previews and the test page.

## Phases

1. **Page shell and Answers list.** Header with "Test the chatbot" and "Add answer",
   summary cards (live, to check, student questions, answered this month), icon
   tabs; Live / To check / Drafts / Archived views, an "Asked this month" column,
   phone rows as cards.
2. **Answer page.** Formatting buttons instead of codes, an answer box that grows,
   "How students see it" beside the form, status, use and history at the side;
   "Try it" removed.
3. **Student questions and Settings.** "Write an answer", "Add to an existing
   answer", "Dismiss"; common questions picked from live answers; the contact
   text shown as students see it.
4. **Test the chatbot.** The student chat on its own page, with the answer used.
5. **Full check.** Tests, then the office screens in the browser at 1440 and 390 px
   with no scrollbars inside the page.

## Status

| Phase | Status | Commit |
| --- | --- | --- |
| 1 Page shell and Answers list | Done | `e4c5449` (backend), `e92a942` |
| 2 Answer page | Done | `e92a942` |
| 3 Student questions and Settings | Done | `e92a942` |
| 4 Test the chatbot | Done | `e92a942` |
| 5 Full check | Done | see `PROJECT_STATUS.md` |
