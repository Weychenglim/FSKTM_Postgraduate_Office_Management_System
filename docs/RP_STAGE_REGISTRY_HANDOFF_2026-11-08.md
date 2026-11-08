# Handoff: student RP1/RP2 classification and semester registration

Prepared 8 November 2026 for the teammate responsible for Student Registry.

**Request:** Please review whether Registry should own or display an authoritative record of which research project stage a student is registered for in each academic semester, and agree on a shared interface with the Marks and appointments owners. Registry is a natural home for student-specific academic information, but ownership and the official source must be confirmed; this handoff does not assign work unilaterally or approve implementation.

**Status:** Source-review and coordination handoff. No implementation, migration, policy change, data update, or teammate acceptance is implied. The findings reflect the local workspace, including uncommitted changes, on the date above. Recheck the current branch before implementation.

## Why this matters

The programme normally takes two semesters, with a possible special semester or longer extension. In one university semester, some students may be taking Research Project 1 (RP1), while others take Research Project 2 (RP2), repeat a stage, return after deferral, or continue in an extension. An academic semester is a time period; RP1/RP2 is the student's project stage. A special semester is not automatically a third project stage.

Today an evaluation period can be labelled RP1 or RP2, but task selection does not check the student's project stage. An RP2 period can therefore select an eligible RP1 student's supervisor or panel, if other targeting rules match. The reverse is also possible. This is a concrete Marks targeting gap, not proof that incorrect production marks have already been entered.

## What the code currently provides

- `accounts.Student` has `intake_semester` and an academic status (Active, Deferred, Graduated, Withdrawn). `StudentRegistry.current_semester` is free text, used in registry/letter information. The registry API updates that field, but it is not an authoritative RP1/RP2 registration used by Marks. See [student models](../backend/accounts/models.py) and [registry API](../backend/accounts/registry_views.py).
- `StudentResearchProfile.semester` is also text, not an authoritative current-stage registration. See [appointment models](../backend/appointments/models.py).
- `EvaluationPeriod.assessment` records P1/P2 on the period. Publication checks assessment and overlapping coverage, but [recipient selection](../backend/marks/targeting.py) selects using programme, evaluator role, active appointments and participant eligibility, without filtering students by project stage. [Task generation](../backend/marks/services.py) uses that selection. Active-period generation can also occur when lecturers load assignments, so avoiding the manual generate button alone is not a reliable control.
- Appointment intake periods are scoped by semester, activity and programme, not student stage. Calendar P1/P2 labels are descriptive; they do not establish a student's registration. See [connected operational periods plan](superpowers/plans/2026-10-16-connected-operational-periods.md) and [project requirements](../PROJECT_REQUIREMENTS.md).
- Academic semester handover preserves existing appointments and closes the old published Marks period; it does not classify students for the next project stage. See [handover acceptance](CARRYOVER_HANDOVER_ACCEPTANCE_2026-10-25.md).

## Suggested responsibility split

| Responsibility | Proposed owner / coordination |
| --- | --- |
| Determine the official source and maintain or expose a student's project registration for an academic semester | Registry owner, in agreement with Office and the owner of the official registration source. It may be an import/integration rather than manual Registry entry. |
| Establish academic policy and resolve exceptions | Faculty/Office: which stages, attempts, periods and transitions are valid. |
| Apply registration to evaluation recipient preview, generation, replacement and backup flows | Marks owner, using the agreed authoritative interface. Registry changes alone do not fix Marks targeting. |
| Decide whether and how appointment intake windows should use stage | Appointment and Office configuration owners, with faculty policy. First appointments and exceptional replacements may need different rules. |
| Display relevant calendar information and reporting | Dashboard/reporting owners, using the same agreed source where appropriate and respecting permissions. |

## Proposed information and behaviour for discussion

Consider a historical, semester-specific record connecting **student, academic semester and RP1/RP2 registration**, with an appropriate registration status and a traceable source. Decide whether attempts, effective dates, reasons, actor and audit/history are needed. Agree an interface that consumers can query for the particular semester and stage; do not rely on a mutable single current-stage field, intake arithmetic or the calendar label to reconstruct historical enrolment.

| Academic semester | Student | Illustrative registration |
| --- | --- | --- |
| Semester I | A | RP1, first attempt |
| Semester II | A | RP2 |
| Semester II | B | RP1, delayed start |
| Special Semester | C | RP2, extension or repeat if policy permits |

These are examples, not approved academic rules. Consider how to represent no project registration, deferred study, a repeat, a corrected entry, transfer, special semester and unknown/unverified data. Avoid silently assuming everyone advances, and avoid presenting a missing registration as a confirmed stage. A registration correction must not silently rewrite historical submitted marks or appointments; the affected module owners should agree on how existing tasks and records are reviewed and reconciled.

## Decisions needed before implementation

1. What is the official source of RP1/RP2 enrolment, and who is authorised to create, import, verify and correct it? Is the system intended to own registrations or only mirror a university system? General course registration is currently outside the stated project boundary.
2. Does each semester permit at most one RP stage per student? What registration statuses, repeat/attempt details and effective dates are needed?
3. What rules govern progression, failures, repeats, deferral, withdrawal, programme transfer, special semesters and extensions? Is an assessment allowed without current registration under an approved exception?
4. What happens when authoritative data is missing, arrives late or changes after tasks have been created or submitted? Who resolves the discrepancy, and how are history, audits and permissions protected?
5. Which appointment actions actually depend on RP stage? Should exceptional replacements remain available in RP2 or an extension?
6. How will existing students and historical semesters be verified and backfilled without guessing or overwriting existing academic records?

## Integration and acceptance discussion

Once policy and ownership are agreed, coordinate tests across modules. At minimum:

- In the same semester and programme, register one student for RP1 and another for RP2. An RP2 recipient preview and task generation include only the eligible RP2 student; an RP1 period includes only the eligible RP1 student. Keep existing evaluator, programme, appointment and participant checks.
- Cover an extension/special semester, repeat, deferred and returning student, and a student with missing or unverified registration. Check the agreed exception and missing-data rules.
- Check all creation paths, including automatic generation, late appointments, replacements and backup assignments, as well as preview and reconciliation; avoid fixing only the visible preview.
- Verify stage changes and corrections preserve submitted results, historical evidence and current appointments; specify and test what happens to existing unsubmitted tasks. Enforce access control, audit and concurrency under the agreed design.
- Verify semester handover does not silently advance every student or delete previous registration, appointment or Marks history. Keep student Marks privacy and existing lifecycle restrictions.

## Message to the Registry teammate

> We found that Marks periods can be labelled RP1 or RP2, but the system currently has no authoritative per-student project stage used in task targeting. This can select the wrong stage when RP1 and RP2 students are active in the same semester. Could you review whether Student Registry should maintain or expose the official student-by-semester RP1/RP2 registration, including repeats and extensions, and discuss the source and interface with us? The Marks and appointment modules would still need their own integration changes. Please confirm ownership and faculty rules before implementing or migrating data.
