# Semesters and Graduation

Date: 2026-11-02. Owner: Xiang (Registry). Wey Cheng reviews one small change in the student status service.

**Status: approved on 2026-11-02 with all nine recommended decisions. Move students uses Option A (summary page) and Graduate students uses Option A (step by step). Phases 1 to 9 are built.** Sample pages: [the plan's screens](https://claude.ai/artifact/P8DPFRLKZaa3YX6vfuSYNa) and [the chosen designs](https://claude.ai/artifact/PDbNiYHUekGyWYhdGzjZtS).

## The problem

- Office staff change each student's status one by one, and each student's current semester one by one. With a whole intake, that is not practical.
- Nothing lists which students still have something unfinished before they graduate.
- The portal does not know how long a programme takes. Staff could mark a student as Graduated after only 1 semester.
- A Special Semester leaves "semesters left" blank on the confirmation letter.
- A student's maximum semester can only be set in Django admin.
- A normal graduation marks the supervisor and panel letters as Revoked, which looks like something went wrong.
- Students get no notice when their status changes.

## 1. What UM's documents say

Scope: FSKTM Master by Coursework only. The portal's approved programmes are already exactly these three.

| Question | Answer | Source |
|---|---|---|
| Which coursework master's does FSKTM run? | Data Science, Cyber Security, Artificial Intelligence | FSKTM postgraduate page, Handbook 2026/2027 contents |
| Minimum length | 2 semesters + 1 Special Semester, so 3 | Handbook 2026/2027 p.68, p.82, p.95; FSKTM FAQ item 9 |
| Maximum length | 8 semesters | Same pages |
| Part time? | No official part-time mode, so one minimum and maximum per programme is enough | FSKTM FAQ, programme pages |
| Does a Special Semester count? | Yes, when the offer letter states it. These programmes state it in their duration | Regulation 20(2) |
| Does every student take it? | No. It is optional, used by students who want to finish in one year | Postgraduate Kit 2024/2025 |
| Can a student finish before the minimum? | Yes, one semester early, if all requirements are met | Regulation 20(3) |
| Can a student go past the maximum? | Up to 3 more semesters on appeal to the Dean, made in the last semester. After that the status is "Failed and Exit" | Regulation 55, Rule 12(2) |
| Semester leave | At most 2 normal semesters. It counts toward the maximum, except medical and mobility leave | Regulation 8(11) |
| Not registering | Recorded as Not Registered. Two normal semesters in a row without registering, then missing the next, ends candidature | Regulation 5(3), 5(5) |
| What is needed to graduate? | CGPA of at least 3.00, the required credits, programme and language requirements. Senate endorses the results | Regulation 60, FSKTM FAQ |
| Intakes | March (Semester II) and September/October (Semester I). Sources differ by programme | Programme pages |
| How does the office count the maximum? | Normal semesters from the intake. Its visa letter sample: intake Semester II 2022/2023, 12 semesters, maximum Semester I 2028/2029 | `SURAT VISA LATEST_2026.docx` |

**Two things the portal cannot check itself:** CGPA and credits live in Maya, not the portal. So the office works from the Senate's list, and the portal checks everything else.

**One conflict to raise (see section 6):** Regulation 16(1) says a candidate may not change programme, and must withdraw and apply again. Our programme transfer feature changes the programme directly.

## 2. What it looks like

Four changes in Registry Management. Office only, unless stated.

| # | Screen | What it does |
|---|---|---|
| 1 | **Programmes** tab | One row per programme: minimum, maximum, and whether a Special Semester counts. Starts filled in from the 2026/2027 handbook. The office can edit it |
| 2 | **Semesters** card on the Student Record | "Studied 3 semesters. Minimum 3. Maximum Semester II, 2029/2030", and the list of semesters. The office can correct a row, and record an extension. Coordinators can read it |
| 3 | **Move students** page | When a new semester starts, a banner on the Students tab links here. It shows the total and a box per programme. One button moves everyone except those left out |
| 4 | **Graduate students** page | Three steps: paste the Senate's list (with who is still unfinished beside it), see the three groups with what is unfinished for each, then confirm with a reason |

**Design rules:** one main button per screen, plain words, no second scrollbar, works at phone width.

### Moving students to a new semester

- It only moves students to the semester that is active in the portal.
- **Normal semester:** every Active student moves. The office searches for anyone who did not register and leaves them out.
- **Special Semester:** nobody is added at first, because only some students take it. The office adds them or pastes their matric numbers.
- Deferred students are not moved. The semester is recorded as leave.
- Running it twice is safe, because a student can only have one row per semester.
- The office can fix one student on their Semesters card.

### Graduating students

Students 2 or more semesters below the minimum are not listed, because they would fill the page. They are only counted, and if one is on a pasted list the portal stops them and says why.

Everyone else falls into one group:

| Group | Why | Can be graduated? |
|---|---|---|
| **Can't graduate yet** | Unfinished marks. A supervisor, supporting supervisor or panel request still waiting. No semester record | No. Each reason links to where to fix it |
| **Check first** | 1 semester below the minimum. Letter requests waiting. Documents owed. Files waiting for a check. A research change or transfer waiting, which would be cancelled. Past the maximum. No rule for the programme | Yes, if the office ticks them. One semester early also needs the box "Approved to finish one semester early" |
| **Nothing unfinished** | None of the above | Yes |

- Only the students on the pasted list are considered. "Nothing unfinished" does not prove a student passed, so the Senate's list is the proof.
- A reason is required, such as "Senate meeting, 12 March 2027". It is saved on each student's history.
- The confirm step says this cannot be undone and shows the number of students.
- Each student is checked again and graduated separately, so one problem does not stop the others. The result lists anyone skipped and why.

**The minimum is also enforced for one student at a time.** The same rule runs inside the status service, so Student Record and Dashboard Manage Participants cannot get around it. With a minimum of 3, a student who has studied 1 semester is refused.

### Counting

- **Semesters studied** counts rows marked Studied, including a Special Semester when the programme says it counts.
- **Maximum semester** is the intake plus the programme's maximum, counted in normal semesters, as the office's own letter does. Medical and mobility leave and approved extensions push it later. Personal leave does not.
- **Past the maximum** is only a warning. "Failed and Exit" is a faculty decision, so the portal never does it by itself.

### Confirmation letter

Example: intake Semester I 2026/2027, minimum 3, maximum 8.

| Student is in | Balance (minimum) | Balance (maximum) |
|---|---|---|
| Semester II 2026/2027 | 1 | 6 |
| Special Semester 2026/2027 | 0 | 6 |
| Semester I 2027/2028, after taking Special | 0 | 5 |

Today, any label with a Special Semester prints blank.

**Correction to what I said earlier:** I said a student past a Special Semester got a wrong maximum. The office's own letter counts the maximum in normal semesters, so that count looks right. The real bug is the blank. Decision 5 asks the office to confirm.

## 3. Decisions

Recommended answers first.

| # | Question | Recommendation |
|---|---|---|
| 1 | Starting numbers | Minimum 3, maximum 8, Special counts, for all three programmes. The office can change them on the Programmes tab |
| 2 | Finishing one semester early | Allowed with a tick and a reason, because Regulation 20(3) allows it. Two or more semesters early is refused |
| 3 | What blocks and what only warns | As in the table above. Letters and documents warn, because they should not hold up a Senate decision |
| 4 | Students with no semester record | Refused until the office adds their semesters |
| 5 | Maximum counted how | Normal semesters from the intake, as in the office's letter. **The office should confirm this for coursework** |
| 6 | Past the maximum | Warning only |
| 7 | Letters after a normal graduation | Stay valid. Letters are still revoked when a student withdraws or a supervisor is replaced |
| 8 | Sign-in after graduating | Stays on, so graduates can see their letters. The office can suspend an account |
| 9 | Undoing a graduation | Not possible, same as today. That is why it starts from the Senate's list and there is a confirm step |

## 4. How it works

**New tables (`accounts`):**
- `ProgrammeRule`: programme, minimum, Special counts, maximum, source, who and when. Filled in by a migration. `ProgrammeRuleChange` keeps the history of edits.
- `StudentSemester`: student, session, term (Semester I, Semester II, Special), outcome (Studied, Leave, Medical or mobility leave), note, who and when. One row per student per semester.
- `StudentRegistry` gets `extension_semesters` (0 to 3) and `extension_reason`.

**Existing students:** a migration creates their rows from their intake and current semester, one row per normal semester. It cannot know about past Special Semesters, so the office adds those by hand. New students get rows the same way when imported or registered.

**New backend files (`accounts`):**
- `semesters.py`: reads and writes semester labels, including Special. Import, moving and letters all share it.
- `semester_rules.py`: a student's semesters studied, minimum and maximum.
- `graduation.py`: the checks, and graduating many students. It calls `transition_student` once per student.
- `registry_semesters.py`: the views below.
- `lifecycle_notices.py`: tells the student when their status changes, by listening for new status history rows. Nothing else in the status service changes for this.

**New API (`/api/registry/`):**
- `programme-rules/`: read and edit.
- `students/<matric>/semesters/`: read, add, change, remove.
- `semester-move/`: list who would move, then move them.
- `graduation/`: list the groups, then graduate.

**Changed files:**
- `accounts/participant_lifecycle.py` (Wey Cheng's): minimum check when graduating; deferring marks the semester as leave. Its own commit, for review.
- `accounts/registry_import.py`, `accounts/registry_views.py`: create semester rows. Current semester becomes read-only in Edit Details, and is changed through the Semesters card.
- `letters/confirmation.py`, `letters/details.py`: use the counting above.
- `letters/appointment_letters.py`: a Completed appointment keeps its letter.
- Frontend: new `ProgrammeRules.tsx`, `MoveStudents.tsx`, `GraduateStudents.tsx`, `StudentSemestersCard.tsx`, `registrySemestersApi.ts`. `StudentRegistry.tsx` gets the card, the banner and two buttons. `RegistryModuleTabs.tsx`, `App.tsx` and `routes.ts` get the new pages.

## 5. Phases

| Phase | What | Status | Commit |
|---|---|---|---|
| 1 | Semester labels and Programmes tab | Done | 36adb9b |
| 2 | Semester record: table, existing students, import, Semesters card | Done | 36adb9b |
| 3 | Move students page and banner | Done | 015ed98 |
| 4 | Confirmation letter counts, Special Semester fixed | Done | 2a2f6a6 |
| 5 | Graduation checks and the minimum rule (Wey Cheng's file in its own commit) | Done | a20773a, c7cfe75 |
| 6 | Graduate students page; Student Record shows the same list | Done | 9c76072 |
| 7 | Letters stay valid after completion; notice when status changes | Done | 0d1ad33 |
| 8 | Maximum: shown on the record, extensions, "last semester or past maximum" notice | Done | 36adb9b, 0d1ad33 |
| 9 | Checks and docs | Done | this commit |

## 6. Needs other people

**Your supervisor or the office:**
1. **Programme transfers.** Regulation 16(1): "A candidate is not allowed to change his programme of study. The candidate has to withdraw from the original programme of study and submit a new application." Regulation 11 also bars changing field of study. Does FSKTM allow transfers in practice? If not, the transfer feature should not be used as it is. This plan does not change it. A transfer keeps the student's semesters and uses the new programme's rule.
2. **Maximum count (decision 5).** Does a Special Semester use up one of the 8?
3. **Missing Special Semesters.** Can the office list past Special Semesters, or will they add them when needed?

**Wey Cheng:**
- Review commit a20773a: the change in `accounts/participant_lifecycle.py`, and semester rows added to the tests that graduate a student (`accounts/test_participant_lifecycle.py`, `appointments/test_amendment_lifecycle.py`, `appointments/test_co_supervision_lifecycle.py`).
- A note for the semester screens: the 2026/2027 calendar has the Semester II break ending 25 Jul 2027, but the Special Semester starts 19 Jul 2027. The portal refuses overlapping dates, so Semester II must end by 18 Jul 2027 in the portal.

## 7. Checks

- **Backend tests:** rule editing and permissions; semester labels in every format the office uses; moving (including running it twice, Special, and Deferred students); each graduation group; the minimum on all three routes; letter counts; letters kept or revoked by outcome; notices. All backend suites still pass.
- **Frontend:** helper tests, the type check, the build and all test files.
- **In a browser, on a private copy with disposable test accounts** (never the demo accounts):
  - edit a programme rule;
  - move students into a normal semester and into a Special Semester;
  - graduate a group from a pasted list, with one student in each group;
  - try to graduate a 1-semester student from Student Record and from Manage Participants;
  - check the letter, the notice and the appointment letter afterwards;
  - check 390 px phone width with no second scrollbar.
- Back up the dev database before migrating.

## 8. Not in this plan

- CGPA, credits and language checks. Those stay in Maya.
- A "Failed and Exit" or "Terminated" status. For now the office uses Withdrawn with a reason.
- Warning about 2 semesters of leave, or 2 semesters not registered. Easy to add later.
- Mixed mode, research and PhD programmes.
- Graduating or withdrawing in bulk from Dashboard Manage Participants.
- Showing semesters and the maximum on the student's own pages.

## Sources

- [FSKTM postgraduate page](https://fsktm.um.edu.my/postgraduate) and [handbook list](https://fsktm.um.edu.my/postgraduate-handbook)
- [Postgraduate Handbook 2026/2027](https://drive.google.com/file/d/1Kb2fQ8v23qVoXbIcBiuCNJt8U0_oji0D/view?usp=drive_link): p.36 calendar, p.68 Data Science, p.82 Cyber Security, p.95 Artificial Intelligence
- [UM (Master's Degree) Regulations 2024](https://fsktm.um.edu.my/fsktm/doc/postgraduate/UM%20(Master's%20Degree)%20Regulations%202024_final_Senate%2026.09.24.pdf): Regulations 5, 8, 11, 16, 20, 46, 55, 60
- [UM (Master's Degree) Rules 2024](https://apium.um.edu.my/Postgraduate%20file/Rules%20and%20regulations/UM%20(Master's%20Degree)%20Rules%202024.pdf): definitions, Rule 12, Schedule 1
- [FSKTM FAQ](https://fsktm.um.edu.my/fsktm/doc/postgraduate/FAQ.pdf): item 9, Completion and Graduation
- [Postgraduate Kit 2024/2025](https://fsktm.um.edu.my/fsktm/doc/postgraduate/PGKIT/PG%20KIT%202024%202025%202.pdf): research project across semesters, finishing in one year
- [Master of Data Science](https://fsktm.um.edu.my/master-of-data-science-coursework), [Master of Cyber Security](https://fsktm.um.edu.my/master-of-cyber-security-coursework), [Master of Artificial Intelligence](https://fsktm.um.edu.my/master-of-artificial-intelligence-coursework)
- `SURAT VISA LATEST_2026.docx` (office letter sample, in the Final Year Project folder)
