# Special Semester moves students automatically

Date: 2026-11-16. Owner: Xiang (Registry). No change to Wey Cheng's files: `academics.services.activate_semester` already calls the move for every semester.

**Status: approved on 2026-11-16 with the recommended choices (leave ends at the Special Semester without moving the student; past Special Semesters are filled in when a student is added). RP1 in Semester II then RP2 in Semester I, with the Special Semester skipped, is allowed.**

## Why

The portal is for Master by coursework in Artificial Intelligence, Data Science and Cyber Security. All three plan Semester I, Semester II, then Semester III (Special) for a one-year finish, so most students take the Special Semester. Ticking them one by one is the wrong default.

| Question | Answer | Source |
|---|---|---|
| Is the Special Semester in the plan? | Yes, for all three: Semester I, Semester II, Semester III (Special) | FSKTM Postgraduate Kit 2025/2026, course plans |
| Does it count toward the minimum? | Yes, when the offer letter says so; minimum 3 including 1 short semester | Regulation 20(2), FSKTM FAQ item 9 |
| RP pairs allowed | Sem II + Special, Special + Sem I, Sem I + Sem II, in consecutive semesters | Kit 2025/2026, timetables Sem I and Sem II 2025/2026 |
| Can a student skip it? | Yes, recorded as Not Registered. Only 2 normal semesters not registered ends candidature | Regulation 5(3), 5(5) |
| Maximum | Counted in normal semesters (office visa letter sample) | 2026-11-02 plan, section 1 |

## Rules after this change

1. **Activating a Special Semester moves students, like a normal semester.** Every Active student who has started and is not waiting for the Senate gets a Registered row. The move is logged as automatic.
2. **Leave ends but the student is not moved.** A student on leave in Semester II goes back to Active when the Special Semester starts, without a Special Semester row. A student who already has a row for the Special Semester (for example leave recorded ahead) is left alone. If one did register, the office adds them on the Current semester page.
3. **Not registered for a Special Semester** does not count as studied, does not move the maximum and gives no warning (unchanged).
4. **RP stage: unchanged.** A Special Semester the student studied is a step. A skipped one is not a break, so RP1 in Semester II then RP2 in Semester I is fine.
5. **Expected completion** steps through the Special Semester when the programme counts it: after Semester II comes the Special Semester, then Semester I.
6. **Adding or importing a student** fills in past Special Semesters between the intake and the current semester, as Registered. Migration `accounts.0016` keeps its old behaviour.
7. **Maximum: unchanged.** Still the nth normal semester from the intake, plus medical and mobility leave and extensions.

## Screens

- **Current semester page:** the Special Semester uses the same page as a normal semester: count, programme tiles, Mark not registered, Didn't register search, Needs a decision. The "Who is taking the Special Semester?" page goes.
  - Students not on it (back from leave, late arrivals, returned from Senate) are listed under "Not on this semester" with ticks and one Update button, because most of them did not take it. A normal semester keeps its "Update all" button.
  - If the automatic move never ran, the page offers "Update all", as for a normal semester.
- **Students tab banner:** the same notice as a normal semester ("N moved to Special Semester 2026/2027."). It does not keep asking about students not on a Special Semester once the move has run.

## Edge cases checked

| Case | What happens |
|---|---|
| Student finished in Semester II, not yet marked finished | Moved onto the Special Semester. Marking them finished with Semester II as the last semester removes that row (existing graduation rule). |
| Waiting for Senate | Not moved (unchanged). |
| Intake later than the Special Semester | Not moved, counted as "on a later intake" (unchanged). |
| On leave, leave already recorded for the Special Semester | Stays on leave (unchanged rule: a row for the new semester keeps leave). |
| On leave in Semester II, no Special Semester row | Back to Active, not moved. Marks tasks resume (same as at Semester I). |
| Recording leave during the Special Semester for a student with no row | Refused: "This student is not taking the Special Semester." (unchanged). |
| Move fails | The semester stays active; the Current semester page offers "Update all" (unchanged path). |
| Activation runs twice | One row per student per semester; nothing changes (unchanged). |
| Graduated, Withdrawn, Terminated, Passed away | Not moved (unchanged). |
| Student skipped the Special Semester | Office marks Not registered. Until then they count one more semester and an RP1 student shows RP2, as with a normal semester. The Graduation page checks again before anyone finishes. |

## Files

- `backend/accounts/semesters.py`: `following()`; `seeded_semesters(..., with_special=False)`.
- `backend/accounts/semester_rules.py`: `end_leaves` returns who came back; `move_everyone_on` handles a Special Semester; `expected_completion`; `seed_student` uses `with_special=True`.
- `backend/accounts/registry_semesters.py`: list who is on a Special Semester; end leave on the first manual update of a Special Semester too.
- `frontend/src/components/UpdateCurrentSemester.tsx`, `frontend/src/components/StudentRegistry.tsx`, `frontend/src/utils/registrySemesters.ts`.
- Tests: `backend/accounts/test_registry_semesters.py`, `frontend/src/utils/registrySemesters.test.ts`.
- Docs: `backend/README.md`, `PROJECT_STATUS.md`.

No migration. No dev DB change.
