# Marks publication safeguards implementation plan

**Goal:** Prevent rubric/role mismatches and duplicate P1/P2 evaluator coverage without changing historical marks.

**Approved design:** Explicit P1/P2 assessment identity per evaluation period; allowed Supervisor/Panel roles per rubric version, with Both deliberately selectable; same semester, assessment, overlapping programmes and role blocks publication regardless of names, dates or rubric. P1/P2 and disjoint programme/role evaluations remain valid. Locked rubrics require a clone to change roles. No general published-period editing, grade aggregation or Google Forms import.

**Architecture:** Django fields and a preservation-only migration, server-side validation under semester locking, existing DRF management endpoints, and existing React rubric/period forms and publish review. Legacy assessments remain unclassified; Office can classify them once with a reason without changing submissions. Unclassified live coverage blocks ambiguous new publication. Legacy rubric roles are marked unconfigured; new publication requires explicitly configured roles, with clone required for used versions. Existing publications keep functioning.

**Tech stack:** Django/DRF/PostgreSQL, React/TypeScript; existing dependencies only.

- [x] Backend: failing tests; fields/migration; payloads/serializers; rubric role validation and cloning; period assessment classification; duplicate checks under semester lock; regression tests.
- [x] Frontend: rubric role selection, P1/P2 period selection, legacy classification, compatible-role controls, clear publication review; mounted tests and API contract checks.
- [x] Integration: review publication/task-generation paths; backend regression tests, frontend mounted tests, typecheck/build, migration-state and whitespace checks; update all three project documents.

Work stays in the current working tree to preserve prior uncommitted calendar/export changes. Do not commit, deploy, or migrate the development database without a reviewed preservation check. Migration tests use an isolated test database.

Ruling: classification is identity-only, so it may record true historical duplicates without creating assignments. Publication alone enforces coverage. This avoids two unknown legacy periods blocking each other and avoids forcing an inaccurate P1/P2 label. Null-FK matching semester labels are conservative coverage blockers, without silently attaching them to a semester.

Reviewed issues addressed: legacy classification deadlock, closed/archived classification accessibility, null-FK coverage and invalid inserted punctuation encoding. All edited source/doc files decode UTF-8. The local schema update followed an ignored marks-table backup and exact original-column comparison; this default database had no marks rows. No commit/push/deployment.

Final verification: 216 marks tests, 28 calendar/export/linked integration checks (some overlap), 136 mounted browser checks, two utility/API scripts, production build, Django system/migration-state and whitespace checks passed. Two existing TypeScript errors and six period-browser scenario failures reproduced on HEAD remain documented in PROJECT_STATUS.md.
