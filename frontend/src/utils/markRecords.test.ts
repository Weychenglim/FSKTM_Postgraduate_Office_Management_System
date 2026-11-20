import type { MarkRecord, MarkRecordPeriod } from '../types';
import assert from 'node:assert/strict';
import { buildLecturerMarkProgress, lecturerTaskCounts } from './markLecturerProgress';
import { filterMarkRecordsByStatusTab, getMarkRecordSummary, getOperationalMarkRecords, getMarkMonitoringSemesterLabel } from './markRecords';

const records: MarkRecord[] = [
  {
    id: 'MRK-00001',
    studentId: 'S001',
    studentName: 'Submitted Student',
    studentInitials: 'SS',
    researchTitle: 'Submitted research',
    panelMember: 'Dr. Marker',
    semester: 'Sem 1 2025/2026',
    programme: 'MASTER OF COMPUTER SCIENCE (COURSEWORK)',
    totalMark: 88,
    status: 'Submitted',
    submittedDate: '10 Jun 2026',
  },
  {
    id: 'MRK-00002',
    studentId: 'S002',
    studentName: 'Draft Student',
    studentInitials: 'DS',
    researchTitle: 'Draft research',
    panelMember: 'Dr. Marker',
    semester: 'Sem 1 2025/2026',
    programme: 'MASTER OF COMPUTER SCIENCE (COURSEWORK)',
    totalMark: 'Draft',
    status: 'Draft',
    submittedDate: '-',
  },
  {
    id: 'MRK-00003',
    studentId: 'S003',
    studentName: 'Pending Student',
    studentInitials: 'PS',
    researchTitle: 'Pending research',
    panelMember: 'Dr. Marker',
    semester: 'Sem 1 2025/2026',
    programme: 'MASTER OF COMPUTER SCIENCE (COURSEWORK)',
    totalMark: null,
    status: 'Not Started',
    submittedDate: '-',
  },
  {
    id: 'MRK-00004',
    studentId: 'S004',
    studentName: 'Overdue Student',
    studentInitials: 'OS',
    researchTitle: 'Overdue research',
    panelMember: 'Dr. Marker',
    semester: 'Sem 1 2025/2026',
    programme: 'MASTER OF COMPUTER SCIENCE (COURSEWORK)',
    totalMark: null,
    status: 'Overdue',
    submittedDate: '-',
  },
];

const summary = getMarkRecordSummary(records);

assert.equal(getMarkMonitoringSemesterLabel(records), 'Sem 1 2025/2026');
assert.equal(getMarkMonitoringSemesterLabel([...records, { ...records[0], semester: 'Semester I 2026/2027' }]), 'Multiple semesters (2)');
assert.equal(getMarkMonitoringSemesterLabel([]), 'No active evaluation tasks');
assert.equal(getMarkMonitoringSemesterLabel([...records, { ...records[0], semester: 'Historical', taskLifecycleStatus: 'RETIRED' }]), 'Sem 1 2025/2026');

if (summary.total !== 4) throw new Error(`Expected total 4, got ${summary.total}`);
if (summary.submitted !== 1) throw new Error(`Expected submitted 1, got ${summary.submitted}`);
if (summary.draft !== 1) throw new Error(`Expected draft 1, got ${summary.draft}`);
if (summary.notStarted !== 1) throw new Error(`Expected notStarted 1, got ${summary.notStarted}`);
if (summary.overdue !== 1) throw new Error(`Expected overdue 1, got ${summary.overdue}`);
if (summary.incomplete !== 3) throw new Error(`Expected incomplete 3, got ${summary.incomplete}`);

const draftRecords = filterMarkRecordsByStatusTab(records, 'Draft Saved');
if (draftRecords.length !== 1 || draftRecords[0].id !== 'MRK-00002') {
  throw new Error('Draft Saved tab should include only Draft records.');
}

const allRecords = filterMarkRecordsByStatusTab(records, 'All Records');
if (allRecords.length !== records.length) {
  throw new Error('All Records tab should not filter records.');
}

console.log('markRecords tests passed');

const historical = [
  { ...records[1], id: 'RETIRED-DRAFT', taskLifecycleStatus: 'RETIRED' as const },
  { ...records[3], id: 'PAUSED-OVERDUE', taskLifecycleStatus: 'PAUSED' as const },
];
assert.deepEqual(getMarkRecordSummary([...records, ...historical]), summary,
  'Retired drafts and paused overdue tasks must not increase operational totals or completion denominators.');
assert.equal(filterMarkRecordsByStatusTab([...records,...historical], 'All Records').length, 6,
  'Authorized history must still retain retired and paused rows.');
assert.deepEqual(getOperationalMarkRecords([...historical,...records]), records,
  'Operational previews exclude history rows even when those rows are most recent.');
assert.deepEqual(getOperationalMarkRecords(historical), []);
const explicitActive = { ...records[0], taskLifecycleStatus: 'ACTIVE' as const };
assert.deepEqual(getOperationalMarkRecords([...historical, explicitActive]), [explicitActive],
  'Explicitly active submitted records remain in operational monitoring.');
assert.deepEqual(getMarkRecordSummary(historical), { total: 0, submitted: 0, draft: 0, notStarted: 0, overdue: 0, incomplete: 0 });
assert.deepEqual(filterMarkRecordsByStatusTab([...records, ...historical], 'Overdue'), [records[3]]);
const heldSubmission = { ...explicitActive, stageReviewRequired: true };
assert.deepEqual(filterMarkRecordsByStatusTab([heldSubmission, records[1]], 'Review Required'), [heldSubmission]);
assert.deepEqual(filterMarkRecordsByStatusTab([heldSubmission], 'Submitted'), [heldSubmission]);
console.log('Retired and paused Marks operational exclusion passed');

const period: MarkRecordPeriod = { id: 1, name: 'RP1 marking', semester: records[0].semester,
  assessment: 'P1', lifecycleStatus: 'CLOSED', effectiveStatus: 'CLOSED' };
const lecturerTasks = buildLecturerMarkProgress([period], [
  { ...heldSubmission, periodId: period.id },
  { ...historical[0], periodId: period.id, stageReviewRequired: false },
], [])[0].periods.get(period.id)!.tasks;
assert.deepEqual([...lecturerTasks.values()].map(task => [task.recordId, task.status]), [
  [heldSubmission.id, 'Stage review'], [historical[0].id, 'Retired'],
]);
assert.equal(lecturerTaskCounts([...lecturerTasks.values()]).review, 1);
assert.equal(lecturerTaskCounts([...lecturerTasks.values()]).total, 1);
