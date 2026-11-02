import assert from 'node:assert/strict';
import type { ResearchAmendment } from '../services/researchAmendmentsApi';
import { APP_ROUTES, routeForNewProgrammeTransfer, routeForNotificationTarget, routeForProgrammeTransfer } from '../constants/routes';
import {
  coordinatorDirectory,
  daysSince,
  daysText,
  namesText,
  shortProgramme,
  stageSince,
  transferOutcome,
  transferSteps,
  waitingForText,
} from './programmeTransfers';

const DS = 'MASTER OF DATA SCIENCE (COURSEWORK)';
const CS = 'MASTER OF CYBER SECURITY (COURSEWORK)';
const directory = coordinatorDirectory([
  { programme: DS, coordinators: ['Dr. Farah Lim'] },
  { programme: CS, coordinators: ['Prof. Hamid Yusof', 'Dr. Acting'] },
  { programme: 'MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)', coordinators: [] },
]);
const event = (action: string, previousStatus: string, newStatus: string, actorName: string, createdAt: string, reason = '') => ({
  id: createdAt.length, action, actorName, actorRole: '', previousStatus, newStatus, reason, retainTeam: action !== 'SUBMIT', createdAt,
});
const transfer = (overrides: Partial<ResearchAmendment>): ResearchAmendment => ({
  id: 14, kind: 'TRANSFER', status: 'PENDING_SOURCE_COORDINATOR', studentId: 7, studentName: 'Nur Aisyah', matricNo: 'S1',
  sourceProgramme: DS, destinationProgramme: CS, before: { title: '', abstract: '', programme: DS }, after: { title: '', abstract: '', programme: CS },
  reason: 'Asked to move', createdAt: '2026-10-30T02:00:00Z', updatedAt: '2026-10-30T02:00:00Z', stageLabel: '', canDecide: false, canCancel: true,
  requiresTeamAcknowledgement: true, teamSnapshot: { primary: null, coSupervisors: [], panel: [] }, unfinishedTaskCount: 0,
  events: [event('SUBMIT', '', 'PENDING_SOURCE_COORDINATOR', 'Siti Aminah', '2026-10-30T02:00:00Z', 'Asked to move')],
  ...overrides,
});
const states = (row: ResearchAmendment) => transferSteps(row, directory).map(step => `${step.key}:${step.state}`);

assert.equal(shortProgramme(DS), 'Data Science');
assert.equal(shortProgramme('Master of Computer Science (By Coursework)'), 'Computer Science');
assert.equal(shortProgramme('MASTER OF SCIENCE AND TECHNOLOGY'), 'Science and Technology');
assert.equal(namesText(['A']), 'A');
assert.equal(namesText(['A', 'B', 'C']), 'A, B or C');
assert.equal(daysText(daysSince('2026-10-30T02:00:00Z', Date.parse('2026-11-01T03:00:00Z'))), '2 days');
assert.equal(daysText(daysSince('2026-11-01T01:00:00Z', Date.parse('2026-11-01T03:00:00Z'))), 'Today');

const waiting = transfer({});
assert.deepEqual(states(waiting), ['requested:done', 'current:now', 'new:next', 'transferred:next']);
assert.equal(waitingForText(waiting, directory), 'Waiting for Dr. Farah Lim');
assert.equal(waitingForText({ ...waiting, canDecide: true }, directory), 'Waiting for you');
assert.equal(transferSteps(waiting, directory)[2].detail, 'Prof. Hamid Yusof or Dr. Acting');
assert.equal(transferOutcome(waiting), null);

const forwarded = transfer({
  status: 'PENDING_DESTINATION_COORDINATOR',
  events: [...waiting.events, event('ENDORSE', 'PENDING_SOURCE_COORDINATOR', 'PENDING_DESTINATION_COORDINATOR', 'Dr. Farah Lim', '2026-10-31T02:00:00Z', 'Fine by me')],
});
assert.deepEqual(states(forwarded), ['requested:done', 'current:done', 'new:now', 'transferred:next']);
assert.equal(transferSteps(forwarded, directory)[1].note, 'Fine by me');
assert.equal(stageSince(forwarded), '2026-10-31T02:00:00Z');
assert.equal(waitingForText(forwarded, directory), 'Waiting for Prof. Hamid Yusof or Dr. Acting');

const done = transfer({
  status: 'APPROVED',
  events: [...forwarded.events, event('APPROVE', 'PENDING_DESTINATION_COORDINATOR', 'APPROVED', 'Prof. Hamid Yusof', '2026-11-01T02:00:00Z')],
});
assert.deepEqual(states(done), ['requested:done', 'current:done', 'new:done', 'transferred:done']);
assert.equal(transferOutcome(done)?.label, 'Transferred');

const skipped = transfer({
  status: 'PENDING_DESTINATION_COORDINATOR', sourceProgramme: 'MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)', destinationProgramme: DS,
  events: [event('SUBMIT', '', 'PENDING_DESTINATION_COORDINATOR', 'Siti Aminah', '2026-10-27T02:00:00Z')],
});
assert.deepEqual(states(skipped), ['requested:done', 'current:skipped', 'new:now', 'transferred:next']);
assert.match(transferSteps(skipped, directory)[1].detail, /nobody coordinated Artificial Intelligence/);

const rejectedLater = transfer({
  status: 'REJECTED',
  events: [...forwarded.events, event('REJECT', 'PENDING_DESTINATION_COORDINATOR', 'REJECTED', 'Prof. Hamid Yusof', '2026-11-01T02:00:00Z', 'Programme full')],
});
assert.deepEqual(states(rejectedLater), ['requested:done', 'current:done', 'new:rejected', 'transferred:stopped']);
assert.deepEqual(transferOutcome(rejectedLater), { label: 'Rejected by Prof. Hamid Yusof', tone: 'danger', at: '2026-11-01T02:00:00Z', reason: 'Programme full' });

const rejectedFirst = transfer({
  status: 'REJECTED',
  events: [...waiting.events, event('REJECT', 'PENDING_SOURCE_COORDINATOR', 'REJECTED', 'Dr. Farah Lim', '2026-10-31T02:00:00Z', 'Not now')],
});
assert.deepEqual(states(rejectedFirst), ['requested:done', 'current:rejected', 'new:stopped', 'transferred:stopped']);

const cancelled = transfer({
  status: 'CANCELLED',
  events: [...waiting.events, event('CANCEL', 'PENDING_SOURCE_COORDINATOR', 'CANCELLED', 'Siti Aminah', '2026-10-31T02:00:00Z', 'Asked in error')],
});
assert.deepEqual(states(cancelled), ['requested:done', 'current:stopped', 'new:stopped', 'transferred:stopped']);
assert.equal(transferOutcome(cancelled)?.label, 'Cancelled by Siti Aminah');
assert.equal(transferSteps(cancelled, directory)[3].note, 'Asked in error');

assert.equal(routeForProgrammeTransfer(14), '/registry/transfers/14');
assert.equal(routeForNewProgrammeTransfer('S 1'), `${APP_ROUTES.registryTransferNew}?student=S%201`);
assert.equal(routeForNotificationTarget({ targetModule: 'REGISTRY', recordType: 'PROGRAMME_TRANSFER', recordId: '14' }), '/registry/transfers/14');
assert.equal(routeForNotificationTarget({ targetModule: 'REGISTRY' }), APP_ROUTES.registry);
