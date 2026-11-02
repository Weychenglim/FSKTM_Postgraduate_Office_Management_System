import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ImportColumn, ImportField, ImportMapping, ImportPreviewRow, RegistryImportBatch } from '../types';
import {
  BATCH_PROBLEM_COLUMNS,
  IMPORT_REPORT_COLUMNS,
  batchSummary,
  columnLabel,
  derivedNotes,
  differenceWarning,
  filterImportRows,
  importOutcome,
  mappingProblems,
  unusedColumns,
  registryMatchText,
  repeatedText,
  rowExplanation,
  rowsAfterHeldSend,
  rowsForReview,
  SKIP_PROGRAMME,
  skipNotice,
  summariseImportRows,
  unchosenProgrammes,
  withSuggestedProgrammes,
} from './registryImport';
import { buildCsv } from './csvExport';

const row = (overrides: Partial<ImportPreviewRow>): ImportPreviewRow => ({
  line: 2,
  id: 'WGA260001',
  name: 'Aisyah Rahman',
  programme: 'MASTER OF DATA SCIENCE (COURSEWORK)',
  email: 'aisyah@example.test',
  phone: '',
  status: 'Ready',
  issue: '',
  ...overrides,
});

const registered = row({
  line: 3,
  status: 'Already Registered',
  issue: 'this matric number is already registered',
  matchedBy: 'studentId',
  existing: {
    id: 'WGA250001',
    name: 'Existing Student',
    email: 'existing@example.test',
    programme: 'MASTER OF DATA SCIENCE (COURSEWORK)',
    academicStatus: 'Active',
    role: 'Student',
  },
  differences: ['name'],
});
const repeated = row({ line: 4, status: 'Duplicate In File', issue: 'same student_id as line 2', duplicateOf: 2 });
const badProgramme = row({ line: 5, status: 'Bad Programme', issue: '"X" is not an approved programme' });
const rows = [row({}), registered, repeated, badProgramme];

// counts and groups
assert.deepEqual(summariseImportRows(rows), {
  total: 4,
  ready: 1,
  alreadyRegistered: 1,
  repeated: 1,
  programmeSkipped: 0,
  skipped: 2,
  fix: 1,
});
assert.deepEqual(filterImportRows(rows, 'skipped').map((r) => r.line), [3, 4]);
assert.deepEqual(filterImportRows(rows, 'fix').map((r) => r.line), [5]);
assert.equal(filterImportRows(rows, 'all').length, 4);

// the office is told who is skipped, and why
assert.equal(skipNotice(summariseImportRows(rows)), '1 already-registered student and 1 repeated row will be skipped.');
assert.equal(
  skipNotice(summariseImportRows([registered, registered, row({})])),
  '2 already-registered students will be skipped.',
);
assert.equal(skipNotice(summariseImportRows([row({})])), '');
assert.equal(registryMatchText(registered), 'In the registry as Existing Student (WGA250001), Data Science.');
assert.equal(differenceWarning(registered), 'Name differs from the registry: check this Student ID.');
assert.equal(
  differenceWarning({ differences: ['name', 'id'], matchedBy: 'email' }),
  'Name and Student ID differ from the registry: check this email.',
);
assert.equal(differenceWarning(row({})), '');
assert.equal(
  registryMatchText({
    existing: { ...registered.existing!, id: '', programme: '', role: 'Office Staff/Admin', name: 'Puan Office' },
  }),
  'This email belongs to Puan Office, an Office Staff/Admin account.',
);
assert.equal(
  registryMatchText({ existing: { ...registered.existing!, role: 'Lecturer', name: 'Dr Lee' } }),
  'This email belongs to Dr Lee, a Lecturer account.',
);
assert.equal(repeatedText(repeated), 'Same Student ID as line 2, which is imported instead.');
assert.equal(
  repeatedText({ duplicateOf: 2, issue: 'same email as line 2' }),
  'Same email as line 2, which is imported instead.',
);
assert.equal(rowExplanation(badProgramme), '"X" is not an approved programme');
assert.equal(rowExplanation(row({})), '');

// the report lists every row with its outcome
assert.equal(importOutcome({ ...row({}), result: 'created' }), 'Created');
assert.equal(importOutcome({ ...row({}), result: 'created', invitationSent: false }), 'Created, activation email not sent');
assert.equal(importOutcome({ ...registered, result: 'skipped' }), 'Skipped: already registered');
assert.equal(importOutcome({ ...repeated, result: 'skipped' }), 'Skipped: repeated in this file');
assert.equal(importOutcome({ ...badProgramme, result: 'failed' }), 'Not imported');
assert.equal(
  importOutcome({ ...row({}), result: 'created', invitationSent: false, invitationHeld: true }),
  'Created, activation email on hold',
);
const report = buildCsv([{ ...registered, result: 'skipped' as const }], IMPORT_REPORT_COLUMNS).split('\r\n');
assert.equal(report[0], 'Line,Student ID,Full name,Email,Programme,Outcome,Details');
assert.ok(report[1].includes('Skipped: already registered'));
assert.ok(report[1].includes('In the registry as Existing Student (WGA250001), Data Science.'));
assert.ok(report[1].includes('Name differs from the registry'));

// past batches, including ones recorded before names were kept
const batch: RegistryImportBatch = {
  id: 1,
  fileName: 'intake.xlsx',
  uploadedBy: 'Office',
  totalRows: 9,
  created: 3,
  skipped: 5,
  failed: 1,
  alreadyRegistered: 4,
  duplicateInFile: 1,
  invitationsFailed: 0,
  problems: [{ line: 3, id: 'WGA250001', result: 'skipped', issue: 'x', name: 'A', existingName: 'B' }],
  createdAt: '2026-10-12T10:00:00+08:00',
};
assert.equal(batchSummary(batch), '3 created · 4 already registered · 1 repeated · 1 not imported');
assert.equal(
  batchSummary({ ...batch, alreadyRegistered: undefined, duplicateInFile: undefined, skipped: 2, failed: 0 }),
  '3 created · 2 already registered',
);
assert.equal(
  batchSummary({ ...batch, invitationsFailed: 2 }),
  '3 created · 4 already registered · 1 repeated · 1 not imported · 2 emails not sent',
);
assert.equal(batchSummary({ ...batch, alreadyRegistered: 0, duplicateInFile: 0, failed: 0, invitationsFailed: 1 }), '3 created · 1 email not sent');
assert.equal(
  buildCsv(batch.problems, BATCH_PROBLEM_COLUMNS).split('\r\n')[0],
  'Line,Student ID,Full name,Result,Reason,In the registry as',
);
assert.equal(buildCsv([{ line: 3, id: 'X', result: 'skipped', issue: 'y' }], BATCH_PROBLEM_COLUMNS).split('\r\n')[1], '3,X,,skipped,y,');

// activation emails held at import time and sent later
const held = (line: number): ImportPreviewRow => ({
  ...row({ line }),
  result: 'created',
  invitationSent: false,
  invitationHeld: true,
});
const skippedRow: ImportPreviewRow = { ...registered, result: 'skipped' };
const afterSend = rowsAfterHeldSend(
  [held(2), held(3), held(4), held(5), skippedRow],
  [
    { id: 'WGA260002', line: 2, outcome: 'sent' },
    { id: 'WGA260003', line: 3, outcome: 'failed' },
    { id: 'WGA260004', line: 4, outcome: 'alreadyActivated' },
    { id: 'WGA260005', line: 5, outcome: 'suspended' },
  ],
);
assert.deepEqual(afterSend.map(importOutcome), [
  'Created',
  'Created, activation email not sent',
  'Created',
  'Created',
  'Skipped: already registered',
]);
assert.ok(afterSend.every((r) => !r.invitationHeld));
assert.equal(afterSend[4], skippedRow, 'rows that were not held are left as they are');

// matching the file's own columns
const fields: ImportField[] = [
  { key: 'student_id', label: 'Student ID', required: true },
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'programme', label: 'Programme', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'intake', label: 'Intake', required: false },
  { key: 'current_semester', label: 'Current semester', required: false },
];
const mapping: ImportMapping = {
  student_id: 1,
  full_name: 2,
  programme: 4,
  email: 5,
  phone: null,
  intake: null,
  current_semester: null,
};
assert.deepEqual(mappingProblems(mapping, fields), []);
assert.deepEqual(mappingProblems({ ...mapping, email: null, programme: null }, fields), [
  'Choose a column for: Programme, Email.',
]);
assert.deepEqual(mappingProblems({ ...mapping, programme: null }, fields, ['programme']), []);
assert.deepEqual(mappingProblems({ ...mapping, programme: null, email: null }, fields, ['programme']), [
  'Choose a column for: Email.',
]);
assert.deepEqual(mappingProblems({ ...mapping, phone: 2 }, fields), [
  'One column is chosen for both Full name and Phone.',
]);
const columns: ImportColumn[] = [
  { index: 0, letter: 'A', header: 'Bil', samples: ['1', '2'], suggestedField: null },
  { index: 1, letter: 'B', header: 'No. Matrik', samples: ['WQD1'], suggestedField: 'student_id' },
  { index: 2, letter: 'C', header: 'Nama', samples: ['Siti'], suggestedField: 'full_name' },
  { index: 3, letter: 'D', header: '', samples: ['990101-14-5678'], suggestedField: null },
  { index: 4, letter: 'E', header: 'Program', samples: [], suggestedField: 'programme' },
  { index: 5, letter: 'F', header: 'E-mel', samples: ['a@b.test'], suggestedField: 'email' },
  { index: 6, letter: 'G', header: '', samples: [], suggestedField: null },
];
assert.deepEqual(unusedColumns(columns, mapping), ['Bil', 'Column D']);
assert.equal(columnLabel(columns[3]), 'Column D');
assert.equal(columnLabel(columns[1]), 'No. Matrik');

// programme names in the file: one choice per name, or skip its rows
const programmeValues = [
  { key: 'masterofdatascience', value: 'Master of Data Science', rows: 2, suggestion: 'MASTER OF DATA SCIENCE (COURSEWORK)', source: 'similar' as const },
  { key: 'mds', value: 'MDS', rows: 1, suggestion: null, source: null },
  { key: 'phd', value: 'PhD', rows: 3, suggestion: SKIP_PROGRAMME, source: 'saved' as const },
];
assert.deepEqual(withSuggestedProgrammes(programmeValues, {}), {
  masterofdatascience: 'MASTER OF DATA SCIENCE (COURSEWORK)',
  phd: SKIP_PROGRAMME,
});
assert.deepEqual(
  withSuggestedProgrammes(programmeValues, { masterofdatascience: 'MASTER OF CYBER SECURITY (COURSEWORK)' }),
  { masterofdatascience: 'MASTER OF CYBER SECURITY (COURSEWORK)', phd: SKIP_PROGRAMME },
  "the office's own choice is never replaced by a suggestion",
);
assert.deepEqual(unchosenProgrammes(programmeValues, withSuggestedProgrammes(programmeValues, {})), ['MDS']);
const mapped = row({ line: 6, programme: 'MASTER OF DATA SCIENCE (COURSEWORK)', programmeInFile: 'MDS' });
assert.deepEqual(rowsForReview([mapped, row({})]).map((r) => r.programme), ['MDS', 'MASTER OF DATA SCIENCE (COURSEWORK)']);
const skippedProgramme = row({ line: 7, programme: 'PhD', status: 'Programme Skipped', issue: 'you chose to skip the programme "PhD"' });
const withSkipped = summariseImportRows([...rows, skippedProgramme]);
assert.equal(withSkipped.programmeSkipped, 1);
assert.equal(withSkipped.skipped, 3);
assert.equal(withSkipped.fix, 1, 'a skipped programme is not a row to fix');
assert.equal(
  skipNotice(withSkipped),
  '1 already-registered student, 1 repeated row and 1 row of a skipped programme will be skipped.',
);
assert.deepEqual(filterImportRows([...rows, skippedProgramme], 'skipped').map((r) => r.line), [3, 4, 7]);
assert.equal(rowExplanation(skippedProgramme), 'you chose to skip the programme "PhD"');
assert.equal(
  importOutcome({ ...skippedProgramme, result: 'skipped' }),
  'Skipped: you chose to skip this programme',
);
assert.equal(
  batchSummary({ ...batch, programmeSkipped: 6 }),
  '3 created · 4 already registered · 1 repeated · 6 skipped by programme · 1 not imported',
);

// emails filled from the Student ID, and the Student ID rule
const filledRow = row({
  line: 8,
  id: '23004955',
  idInFile: '23004955/1',
  email: '23004955@siswa.um.edu.my',
  emailFilled: true,
});
assert.deepEqual(derivedNotes(filledRow), [
  'Student ID in the file: 23004955/1.',
  'Email filled from the Student ID: 23004955@siswa.um.edu.my.',
]);
assert.deepEqual(derivedNotes(row({})), []);
const [reviewedFilled] = rowsForReview([filledRow]);
assert.deepEqual(
  [reviewedFilled.id, reviewedFilled.email],
  ['23004955/1', ''],
  'a reviewed file sends back what the file had, so the choices apply again',
);
assert.equal(rowsForReview([row({})])[0].email, 'aisyah@example.test');
assert.deepEqual(mappingProblems({ ...mapping, email: null }, fields, ['email']), []);
assert.ok(
  buildCsv([{ ...filledRow, result: 'created' as const }], IMPORT_REPORT_COLUMNS).includes(
    'Email filled from the Student ID: 23004955@siswa.um.edu.my.',
  ),
);
assert.equal(
  batchSummary({ ...batch, failed: 0, alreadyRegistered: 0, duplicateInFile: 0, emailsFilled: 2 }),
  '3 created · 2 emails filled from Student ID',
);

// the screen uses all of this
const registry = readFileSync(resolve('src/components/StudentRegistry.tsx'), 'utf8');
assert.match(registry, /inspectStudentImport\(file, first\)/, 'a new file is described before its rows are checked');
assert.match(registry, /if \(layout\.layoutRecognised\)/, 'our own template skips the Match step');
assert.match(registry, /<RegistryImportMatch\b/, 'other layouts stop at Match columns');
assert.match(registry, /previewWithChoices\(reviewedFile\(edited\), reviewedOptions\(\)\)/, 'edited rows are sent back in our own layout');
assert.match(
  registry,
  /commitStudentImport\(file, \{\s*\.\.\.\(editedSet \? reviewedOptions\(\) : importOptions\(\)\),\s*rememberLayout: layoutToRemember\(\),\s*\}\)/,
  'the confirmed matches go with every import, edited or not',
);
assert.match(registry, /useProfile: keepSavedMatches/, 'saved matches stay set aside once the office says so');
const matchStep = readFileSync(resolve('src/components/RegistryImportMatch.tsx'), 'utf8');
assert.match(matchStep, /Matched the same way as your import on \{formatMalaysiaDate\(layout\.profileAppliedAt\)\}/);
assert.match(registry, /Change column matches/);
assert.match(registry, /<RegistryImportResult\b/, 'the import result must be shown, not only a toast');
assert.match(registry, /setImportFilter\('skipped'\)/, 'the skip notice must open the skipped rows');
assert.match(registry, /bulk: 'Bulk Import \(Excel or CSV\)'/);
assert.match(registry, /sendInvites: sendInvitesNow/, 'the office chooses to send activation emails now or later');
assert.match(registry, /sendBatchInvitations\(heldBatchToSend\.id\)/, 'held emails are sent from the screen');
assert.match(registry, /rowsAfterHeldSend\(current\.rows, result\.students\)/, 'the report shows each held email');
assert.match(registry, /\{batch\.invitationsHeld && \(/, 'Recent Imports marks an import whose emails are on hold');
assert.match(registry, /<RegistryImportProgrammes\b/, 'programme names are chosen on the Check rows step');
assert.match(registry, /const response = await previewWithChoices\(file, options\)/, 'suggested choices are shown with their effect');
assert.match(registry, /rowsToCsv\(rowsForReview\(rows\)\)/, 'a reviewed file keeps the names the office mapped');
assert.match(registry, /programmeMap: programmeChoices/);
assert.match(registry, /fillEmail,\s*idRule: dropIdSuffix \? STUDENT_ID_RULE : null,/, 'both options go with every check and import');
assert.match(registry, /emailFilled: email === rec\.email \? rec\.emailFilled : undefined/, 'a typed email is no longer marked as filled');
assert.doesNotMatch(registry, /Bulk Import via CSV/);
assert.doesNotMatch(registry, /Paste Rows|pastedRowsFile/, 'the upload card takes files only');
assert.match(registry, /hasHeader: importHasHeader/, 'rows without column names stay that way');
assert.match(matchStep, /label: 'No column names'/);
assert.match(registry, /Download Excel Template/, 'the Excel template is the main template');
assert.doesNotMatch(registry, /The template has the exact layout/);

console.log('Registry import listing tests passed.');
