import {filterMonitoringMarks} from './officeMonitoring';
import type {MarkRecord} from '../types';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allowedParticipantTransitions,
  lifecycleLabel,
  lecturerAction,
  lecturerActionDone,
  lecturerActionPrompt,
  lecturerStatusLabel,
  openWork,
  participantConflictMessage,
  pendingWorkLabel,
  statusWords,
} from './participantLifecycle';

assert.deepEqual(allowedParticipantTransitions('STUDENT', 'ACTIVE'), [
  'DEFERRED',
  'GRADUATED',
  'WITHDRAWN',
]);
assert.deepEqual(allowedParticipantTransitions('STUDENT', 'DEFERRED'), ['ACTIVE', 'WITHDRAWN']);
assert.deepEqual(allowedParticipantTransitions('LECTURER', 'RETIRING'), ['RETIRED', 'RESIGNED', 'ACTIVE']);
assert.deepEqual(allowedParticipantTransitions('LECTURER', 'RETIRED'), ['ACTIVE']);
assert.deepEqual(allowedParticipantTransitions('LECTURER', 'RESIGNED'), ['ACTIVE']);
assert.equal(lecturerStatusLabel('RETIRING'), 'Leaving');
assert.equal(lecturerStatusLabel('RESIGNED'), 'Resigned');
assert.equal(lecturerAction('ACTIVE', 'RETIRING'), 'Mark as leaving');
assert.equal(lecturerAction('RETIRING', 'RESIGNED'), 'Mark as resigned');
assert.equal(lecturerActionDone('Aina', 'RETIRING', 'RESIGNED'), 'Aina marked as resigned.');
assert.equal(lecturerActionDone('Aina', 'RESIGNED', 'ACTIVE'), 'Aina returned to work.');
assert.equal(lecturerActionDone('Aina', 'RETIRING', 'ACTIVE'), 'Aina is back to active.');
assert.equal(lecturerAction('RETIRING', 'ACTIVE'), 'Back to active');
assert.equal(lecturerAction('RESIGNED', 'ACTIVE'), 'Returned to work');
assert.equal(lecturerActionPrompt('Aina', 'RETIRING', 'RESIGNED').title, 'Mark Aina as resigned?');
assert.equal(lecturerActionPrompt('Aina', 'RETIRED', 'ACTIVE').note, 'Sign-in turns back on.');
assert.equal(lecturerActionPrompt('Aina', 'RETIRING', 'ACTIVE').note, undefined);
assert.equal(statusWords('SUBMITTED_TO_SUPERVISOR'), 'Submitted to supervisor');
assert.equal(pendingWorkLabel('PANEL_RECOMMENDATION'), 'Panel request');
assert.deepEqual(openWork({ activePanelAppointments: 2, managedProgrammes: 0 }), [{ key: 'activePanelAppointments', count: 2 }]);
assert.equal(lifecycleLabel('RETIRING'), 'Retiring');
assert.equal(participantConflictMessage(new Error('Resolve assigned work')), 'Resolve assigned work');

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../components/ParticipantStatusCards.tsx', import.meta.url), 'utf8');
const studentSupervisor = readFileSync(new URL('../components/StudentSupervisorAppointment.tsx', import.meta.url), 'utf8');
const coordinatorSupervisor = readFileSync(new URL('../components/CoordinatorSupervisorApprovals.tsx', import.meta.url), 'utf8');
const lecturerPanel = readFileSync(new URL('../components/LecturerPanelAppointments.tsx', import.meta.url), 'utf8');
const markRecords = readFileSync(new URL('../components/MarkEntryRecords.tsx', import.meta.url), 'utf8');
const markDetail = readFileSync(new URL('../components/MarkEntryRecordDetail.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(app, /ParticipantLifecycleManagement/);
assert.match(app, /ActingCoordinators/);
assert.match(app, /currentUser\.role !== 'Office Staff\/Admin'/);
assert.match(workspace, /pendingWork/);
assert.match(workspace, /transitionParticipant/);
assert.match(workspace, /cancelParticipantPendingWork/);
assert.match(workspace, /Status history/);
assert.match(studentSupervisor, /workflowEligible/);
assert.match(coordinatorSupervisor, /participantEligible === false/);
assert.match(lecturerPanel, /recommendation\.participantEligible !== false/);
assert.match(markRecords, /filterMonitoringMarks/);
const lifecycleRecords = ['ACTIVE', 'PAUSED', 'RETIRED'].map((taskLifecycleStatus, index) => ({id: `LIFECYCLE-${index}`, status: 'Not Started', taskLifecycleStatus})) as MarkRecord[];
assert.deepEqual(filterMonitoringMarks(lifecycleRecords, null).map(row => row.taskLifecycleStatus), ['ACTIVE', 'PAUSED', 'RETIRED'], 'ordinary browsing preserves all lifecycle records');
assert.deepEqual(filterMonitoringMarks(lifecycleRecords, 'incomplete').map(row => row.taskLifecycleStatus), ['ACTIVE'], 'dashboard incomplete monitoring includes active tasks only');
assert.match(markDetail, /Paused evaluation task/);
