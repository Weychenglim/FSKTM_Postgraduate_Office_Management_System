# Using manual tests in the FYP report

Yes. The manual testing guide supplies the procedures and expected outcomes. Your observed results, dates, exact records and retained evidence supply the report findings. You can record each test once and reuse that same evidence in the FYP chapter.

## Prepared files

- [Editable testing chapter](../outputs/fyp-testing-01a18227/FYP_Testing_Chapter_Draft.docx): scope, method, environment, five representative module case tables, integration/system/validation plans, blank participant UAT guidance, prior evidence and results-summary structure.
- [Manual results workbook](../outputs/fyp-testing-01a18227/FYP_Manual_Test_Results.xlsx): all 162 source scenario groups, original IDs, report IDs, prerequisites, steps, data and expected results, plus current-run result entry and summary.

The senior reference was inspected as a 172-page extract. Its module-case, integration, system, validation and acceptance structure is useful, especially the fields for preconditions, steps, test data, expected result and actual result. Its completed outcomes, scores, example passwords and GIS/Firebase assumptions are not evidence for this system. The editable chapter uses its general table structure and adds evidence, date, actor, result and defect/retest fields.

## While you test

1. Open **Summary** and enter a run ID, tester, date and environment. Record the actual build when it differs from the preparation baseline.
2. Follow the existing chronological guide. In **Results**, find the same case ID, such as A02. Read the full procedure/prerequisites in **Test catalog** before acting.
3. In the yellow cells record what actually happened, date, tester, exact semester/request/task IDs and the screenshot or saved-file reference. Then choose the result.
4. Use **Run log** for individual variants and retests, preserving the original failure. A compound parent case passes only when all applicable named checks have been observed; record individual variants such as A03-v01 separately.
5. Use **Defects** for observed deviations and their linked fixes/retests. A failed prerequisite blocks an attempted dependent case. A case you have not attempted remains **Not run**. A justified exclusion is **Not applicable**, with a reason.

The workbook checks whether a marked Pass/Fail record has observation/date/tester/record/evidence fields. **Fields complete** means those fields are filled, not that the claim was independently verified. Status counts remain visible; resolve missing-evidence flags before reporting them as supported findings.

Do not copy the Expected result into Actual result without observing it. A screenshot of a success message alone cannot establish a saved record, authorisation boundary or a usable exported workbook. Capture the evidence needed by that specific expected outcome. Keep passwords and tokens out of screenshots and the report.

## Moving the results into the chapter

Copy the observed result and its evidence reference from the workbook into the corresponding Word case table. The original case ID remains the link between procedure, screenshot, defect and report table. The five detailed Word cases are representative templates; the workbook retains the complete catalogue for an appendix or additional report tables.

Use the live Summary for parent-scenario totals. At preparation the new register has 162 Not run entries, zero decided outcomes, a 0% execution rate and an unavailable pass rate. This is the baseline of the new reporting register, not a claim that earlier project verification never occurred.

- Pass rate = Pass / (Pass + Fail), unavailable when that denominator is zero.
- Execution rate = decided parent cases / (planned parent cases - justified Not applicable).
- Primary module totals are Dashboard/Timeline 30, Supervisor 47, Panel 16, Marks 35 and Workflow/Approval Tracking 34, totalling 162 once.
- Validation/integration/quality tags can overlap. Their totals must not be added as new unique tests or combined with automated assertions and participant ratings.

Finalise the conclusion only after reviewing actual outcomes, blocked fixtures, unresolved defects and retest results. Successful earlier browser or API evidence does not certify every current-source workflow after later changes.

## Correct testing terminology

| What you do | How to report it |
| --- | --- |
| Manually operate a form, request page or workflow | Functional or system testing, with the precise scope and evidence. |
| Check data moving between appointments, Marks, reports or lifecycle | Integration testing; compare exact saved records before/after. |
| Run an isolated automated function/component test | Unit testing; retain the actual test name, command, build/date and output. API/service integration tests are not automatically unit tests. |
| Try empty/invalid/limit/conflicting inputs | Validation techniques within the relevant functional/integration tests. |
| Ask actual intended users or identified role representatives to perform tasks | Stakeholder UAT, with actual participant count/roles, applicable task outcomes and optional ratings. Developer operation of test accounts is technical verification. |

No new performance threshold is copied from the senior's GIS project. Record actual device/browser/load/time measurements if performance testing is conducted and relate the conclusion to an agreed system requirement.

## Prior evidence and UAT

The **Prior evidence** sheet contains eleven dated observations from `FULL_PORTAL_NATIVE_ACCEPTANCE_2026-10-29.md`, under namespace HIST-A07-01 to HIST-A07-11. These are distinct from manual guide A07 and are not imported as current-run Pass results. Several observations overlap only part of a compound guide row.

The earlier report records Supervisor 85 and Panel 80. It does not establish the later planned G03-G06 correction/reopening sequence to 82 and 84. The sandbox already has prior core records; preserve them and check prerequisites before repeating creation steps. Do not reset the database to simulate the original empty state.

The **UAT form** is blank for an actual participant. Copy that sheet for each respondent, use an anonymous participant code and record the real role/date/task outcomes. Optional numeric ratings use 1 strongly disagree to 5 strongly agree. Leave inapplicable/unattempted ratings blank. There is no reported UAT mean, sample size or acceptance finding until responses exist. Obtain the participation/consent record required by your faculty process.

## Preparation and verification

Baseline: `codex/portal-consistency-and-toast`, HEAD `7cb17bd` plus the current working changes, prepared 29 October 2026. The source catalogue is `FIVE_MODULE_SEQUENTIAL_TEST_GUIDE.md`; source-of-truth requirements/design/status and the prior acceptance report were read. A separate evidence review checked classifications, compound-case counting and provenance boundaries. Source, screenshots and generated results from the senior reference were not used as new system results.

The chapter was rendered for page inspection, and the workbook was rendered and independently read back. The builder tested a temporary Pass input, verified summary recalculation and missing-evidence detection, then restored the delivered register to 162 Not run rows with blank Actual values. The seven sheets separate current observations, catalogue, individual runs, defects, UAT and prior evidence. No application code, database, account, test-session result or report-source PDF was changed for this task. Authoring intermediates are private local files under ignored `backend/.env.fyp-report-work/`.
