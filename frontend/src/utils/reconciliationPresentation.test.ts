import assert from 'node:assert/strict';
import test from 'node:test';
import * as presentation from './workflowReconciliation';
import type { ReconciliationIssue } from '../types';
import { APP_ROUTES } from '../constants/routes';
import { reconciliationOwningRoute } from '../components/WorkflowReconciliationCentre';

const issue = (overrides: Partial<ReconciliationIssue> = {}): ReconciliationIssue => ({
  issueId: 'capacity.3', module: 'WORKFLOW_TRACKING', issueType: 'CAPACITY_LEGACY_LIMIT_DIVERGENCE',
  severity: 'WARNING', repairability: 'REVIEW_REQUIRED', title: 'Semester capacity differs from the legacy profile limit',
  summary: 'The semester policy is authoritative.', recordType: 'CAPACITY_ENTRY', recordId: '3',
  studentId: null, programme: null, currentState: {
    lecturerName: 'Dr Lee', staffNo: 'L001', semesterLabel: 'Semester I 2026/2027', planVersion: 5,
    supervisorLimit: 1, legacySupervisorLimit: 5, panelLimit: 10, legacyPanelLimit: 10,
  }, suggestion: {}, dependencies: [], navigation: {}, fingerprint: 'a'.repeat(64), ...overrides,
});

test('legacy differences explain authority without claiming capacity is invalid', () => {
  assert.equal(typeof presentation.reconciliationExplanation, 'function');
  const result = presentation.reconciliationExplanation(issue());
  assert.match(result.why, /Supervisor: 1.*5/);
  assert.doesNotMatch(result.why, /Panel:/);
  assert.match(result.effect, /semester.*remain.*in force/i);
  assert.match(result.next, /intentional/i);
  assert.equal(result.actionLabel, 'Review capacity limits');
  assert.deepEqual(presentation.reconciliationIdentity(issue()), {
    name: 'Dr Lee', context: 'L001 · Semester I 2026/2027 · Version 5',
  });
});

test('missing semester explains why automatic assignment is withheld', () => {
  const result = presentation.reconciliationExplanation(issue({
    issueType: 'SEMESTER_UNASSIGNED', currentState: { academicSemesterId: null, matchingSemesterCount: 0 },
  }));
  assert.match(result.why, /not linked/i);
  assert.match(result.next, /no single.*match/i);
  assert.doesNotMatch(result.effect, /blocked/i);
  assert.deepEqual(presentation.reconciliationIdentity(issue({
    issueType: 'SEMESTER_UNASSIGNED', recordType: 'SEMESTER_TIMELINE',
    currentState: { recordedSemester: 'Semester I 2024/2025' },
  })), { name: 'Semester I 2024/2025', context: 'Semester timeline #3' });
});

test('missing capacity repair describes a draft copy rather than publishing', () => {
  const result = presentation.reconciliationExplanation(issue({
    issueType: 'CAPACITY_PLAN_MISSING', repairability: 'REPAIRABLE',
    currentState: { semesterLabel: 'Semester I 2027/2028', lifecycleStatus: 'DRAFT' },
  }));
  assert.match(result.next, /draft.*review.*publish/i);
  assert.match(result.effect, /activation/i);
});

test('unknown checks preserve server explanation and do not invent a repair', () => {
  const result = presentation.reconciliationExplanation(issue({ issueType: 'FUTURE_CHECK', summary: 'Verified server evidence.' }));
  assert.equal(result.why, 'Verified server evidence.');
  assert.match(result.next, /system administrator/i);
  assert.deepEqual(presentation.reconciliationIdentity(issue({ currentState: {}, studentId: 'S001' })), {
    name: 'S001', context: 'Capacity entry #3',
  });
});

test('repair details identify exact semester, source version and managed programme', () => {
  assert.deepEqual(presentation.reconciliationRepairDetails(issue({
    suggestion: { semesterLabel: 'Semester II 2026/2027', semesterCode: '2026-2027-S2' },
  }), { action: 'ASSIGN_SEMESTER', semesterId: 2, label: 'Assign semester' }), [
    { label: 'Assign to semester', value: 'Semester II 2026/2027 · 2026-2027-S2' },
  ]);
  assert.deepEqual(presentation.reconciliationRepairDetails(issue({
    currentState: { semesterLabel: 'Semester I 2027/2028' },
    suggestion: { sourcePlanId: 5, sourcePlanVersion: 3, sourceSemesterLabel: 'Semester I 2026/2027' },
  }), { action: 'COPY_CAPACITY_PLAN', label: 'Copy policy' }), [
    { label: 'Create draft for', value: 'Semester I 2027/2028' },
    { label: 'Copy from', value: 'Semester I 2026/2027 · Version 3' },
  ]);
  assert.deepEqual(presentation.reconciliationRepairDetails(issue(), { action: 'ASSIGN_COORDINATOR_PROGRAMME', label: 'Assign programme', requiresProgramme: true }, 'Master of AI'), [
    { label: 'Managed programme', value: 'Master of AI' },
  ]);
});

test('marks source links open the owning configuration or task workspace', () => {
  assert.equal(presentation.reconciliationRecordRoute('MARKS', 'EVALUATION_PERIOD', '7'), APP_ROUTES.marksConfig);
  assert.equal(presentation.reconciliationRecordRoute('MARKS', 'MARKS_TASK', '8'), APP_ROUTES.marksTasks);
});

test('eligible ended evaluation links to an individual grant for its own task', () => {
  const recovery = issue({
    issueType: 'MARKS_TASK_INCONSISTENT', module: 'MARKS', recordId: '8',
    currentState: { periodId: 7, semesterId: 2, closedWithUnfinishedWork: true, canGrantCompletionWindow: true },
  });
  assert.equal(reconciliationOwningRoute(recovery), '/dashboard/periods?semester=2&manage=window&task=8#marks-period-7');
  assert.equal(presentation.reconciliationExplanation(recovery).actionLabel, 'Grant individual extra time');
  const blocked = { ...recovery, currentState: { ...recovery.currentState, canGrantCompletionWindow: false } };
  assert.equal(reconciliationOwningRoute(blocked), '/marks/records/MRK-00008');
  assert.equal(presentation.reconciliationExplanation(blocked).actionLabel, 'View Marks record');
});

test('known reviews lead to their owning records and give a concrete next step', () => {
  const cases = [
    ['MARKS_STAGE_REVIEW', 'MARKS', 'EVALUATION_TASK', '/marks/records/MRK-00003', /registration/i],
    ['RESEARCH_AMENDMENT_STALE', 'SUPERVISOR_APPOINTMENTS', 'RESEARCH_AMENDMENT', '/supervisor-appointments/research-changes/3', /cancel request/i],
    ['APPOINTMENT_LINEAGE_INCONSISTENT', 'PANEL_APPOINTMENTS', 'PANEL_APPOINTMENT', '/panel-appointments/records/appointment-3', /system administrator/i],
    ['SUPERVISOR_HANDOFF_INCOMPLETE', 'SUPERVISOR_APPOINTMENTS', 'SUPERVISOR_APPLICATION', '/supervisor-appointments/request-3', /check the blocker/i],
    ['PANEL_HANDOFF_INCOMPLETE', 'PANEL_APPOINTMENTS', 'PANEL_RECOMMENDATION', '/panel-appointments/records/recommendation-3', /check the blocker/i],
  ] as const;
  for (const [issueType, module, recordType, route, instruction] of cases) {
    const finding = issue({ issueType, module, recordType, navigation: { targetModule: module, recordType, recordId: '3' } });
    assert.equal(reconciliationOwningRoute(finding), route, issueType);
    assert.match(presentation.reconciliationExplanation(finding).next, instruction);
    assert.notEqual(presentation.reconciliationExplanation(finding).actionLabel, 'Open source record');
  }
});

test('capacity overlap opens semester availability with the affected lecturer filter', () => {
  const finding = issue({ issueType: 'CAPACITY_AVAILABILITY_OVERLAP', currentState: { semesterId: 2, staffNo: 'L 001' } });
  assert.equal(reconciliationOwningRoute(finding), '/dashboard/lecturer-capacity?semester=2&view=availability&lecturer=L+001');
  assert.equal(presentation.reconciliationExplanation(finding).actionLabel, 'Review lecturer availability');
});
