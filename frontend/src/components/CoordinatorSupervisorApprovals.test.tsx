import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import * as coordinator from './CoordinatorSupervisorApprovals';
import type { SupervisorApplicationRecord } from '../types';
import type { CoSupervisorNomination } from '../types/coSupervision';

assert.equal(typeof coordinator.CoordinatorAppointmentRequestList, 'function', 'Coordinator list must render loaded requests independently of its API loader');
const base: SupervisorApplicationRecord = {
  id: 1, studentId: 'P001', studentName: 'Primary applicant', programme: 'Computing', semester: 'Semester I',
  proposedSupervisor: 'Dr Candidate', proposedSupervisorId: 'SV001', researchTitle: 'Research details',
  researchArea: 'Computing', researchAbstract: 'Full abstract belongs in details', researchProfileReady: false,
  status: 'PENDING_COORDINATOR', rejectionReason: '', submittedAt: '2026-10-10T10:00:00Z', waitingDays: 2, workflow: [],
};
const nomination: CoSupervisorNomination = {
  id: 21, studentId: 30, matricNo: 'P030', studentName: 'Supporting applicant', candidate: { id: 40, name: 'Supporting Lecturer' },
  nominator: { id: 50, name: 'Primary Lecturer' }, status: 'PENDING_COORDINATOR', justification: 'Expertise justification',
  reason: '', submittedAt: '2026-10-09T10:00:00Z', waitingDays: 3, replacesAppointmentId: null,
  allowedActions: ['approve', 'coordinator-reject'], history: [],
};
const history: SupervisorApplicationRecord[] = [
  { ...base, id: 2, studentName: 'Rejected applicant', status: 'REJECTED_BY_COORDINATOR', rejectionReason: 'Recorded decision' },
  { ...base, id: 3, studentName: 'Cancelled applicant', status: 'CANCELLED_BY_STUDENT' },
  { ...base, id: 4, studentName: 'Approved applicant', status: 'APPROVED' },
];
const props = { queue: [base], history, nominations: [nomination, { ...nomination, id: 22, studentName: 'Ended supporting request', status: 'APPROVED' as const, allowedActions: [] }], onOpen: () => {} };
const render = (extra: Partial<React.ComponentProps<typeof coordinator.CoordinatorAppointmentRequestList>> = {}) => renderToStaticMarkup(<coordinator.CoordinatorAppointmentRequestList {...props} view="requests" {...extra} />);
const current = render();
assert.match(current, /<table/);
assert.match(current, /Primary applicant/);
assert.match(current, /Supporting applicant/);
assert.equal((current.match(/>Review request</g) ?? []).length, 2, 'Only one Review action per actionable primary/supporting request');
assert.match(current, /<th[^>]*>Waiting at this stage<\/th>/);
assert.doesNotMatch(current, /Rejected applicant|Cancelled applicant|Approved applicant|Ended supporting request/);
assert.doesNotMatch(current, />Approve<|>Reject<|Full abstract|Expertise justification|Supervisor appointment|Research details/);
const closed = render({ view: 'history' });
for (const name of ['Rejected applicant', 'Cancelled applicant', 'Approved applicant', 'Ended supporting request']) assert.ok(closed.includes(name));
assert.doesNotMatch(closed, /Primary applicant|Supporting applicant|>Review request</);
assert.match(closed, /<th[^>]*>Outcome<\/th>/);
assert.doesNotMatch(closed, /Waiting at this stage|Current stage/);
assert.equal((current.match(/<table/g)||[]).length,1);
assert.equal((closed.match(/<table/g)||[]).length,1);
assert.doesNotMatch(closed, /aria-label="Not applicable"/);
assert.match(render({ type: 'supporting' }), /Supporting applicant/);
assert.doesNotMatch(render({ type: 'supporting' }), /Primary applicant/);
assert.doesNotMatch(render({ view: 'history', status: 'CANCELLED_BY_STUDENT' }), /Rejected applicant|Approved applicant|Ended supporting request/);
assert.match(render({ search: 'SV-REQ-00001' }), /Primary applicant/, 'Primary references stay searchable without becoming row headlines');
assert.doesNotMatch(render({ search: 'SV-REQ-00001' }), /Supporting applicant/);
const many = Array.from({ length: 26 }, (_, index) => ({ ...base, id: index + 100, studentName: `Paged applicant ${index + 1}` }));
const firstPage = render({ queue: many, nominations: [] });
assert.equal((firstPage.match(/>Review request</g) ?? []).length, 10);
assert.match(firstPage, /Page 1 of 3/);
const secondPage = render({ queue: many, nominations: [], page: 2 });
assert.doesNotMatch(secondPage, />Paged applicant 1</);
assert.match(secondPage, />Paged applicant 11</);
assert.equal((render({ queue: many, nominations: [], pageSize: 25 }).match(/>Review request</g) ?? []).length, 25);
assert.equal((render({ queue: many, nominations: [], pageSize: 50 }).match(/>Review request</g) ?? []).length, 26);
assert.doesNotMatch(render({ queue: [{ ...base, participantEligible: false }], nominations: [] }), />Review request</, 'Ineligible students have a view-only compact action');
assert.match(render({ queue: [], nominations: [{ ...nomination, status: 'SUBMITTED_TO_CO_SUPERVISOR', allowedActions: ['accept', 'reject'] }] }), />Review request</, 'Candidate-specific decision capabilities remain reachable for Coordinator accounts');
for (const props of [{ initialApplicationId: '1' }, { initialSupportingId: '21' }, { routeTeamStudentId: 'P001' }]) {
  const shell = renderToStaticMarkup(<MemoryRouter><coordinator.CoordinatorSupervisorApprovals {...props} /></MemoryRouter>);
  assert.equal((shell.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(shell, /<nav|Request views|>Refresh</, 'Dedicated Coordinator records have no workspace controls');
}
assert.equal(typeof coordinator.CoordinatorAppointmentLifecycleRecords, 'function', 'Primary appointment lifecycle records must remain reachable through a guarded detail');
const active: SupervisorApplicationRecord = { ...base, status: 'APPROVED', appointmentLifecycle: { appointmentId: 91, status: 'ACTIVE', endOutcome: null, endReason: null, endedAt: null, endedBy: null, supersedesAppointmentId: null, replacementAppointmentId: null } };
const ended: SupervisorApplicationRecord = { ...active, id: 2, studentName: 'Ended appointment student', appointmentLifecycle: { ...active.appointmentLifecycle!, appointmentId: 92, status: 'ENDED', endReason: 'Research completed', endOutcome: 'COMPLETED' } };
const lifecycle = (detail: boolean) => renderToStaticMarkup(<coordinator.CoordinatorAppointmentLifecycleRecords records={[active, ended]} detail={detail} onOpen={() => {}} onNavigateToDossier={() => {}} onEnd={async () => {}} />);
assert.equal((lifecycle(false).match(/>View appointment</g) ?? []).length, 2);
assert.doesNotMatch(lifecycle(false), />End Appointment</, 'End forms live under their owning record guard');
assert.equal((lifecycle(true).match(/>End Appointment</g) ?? []).length, 1, 'Only active appointments can be ended');
assert.match(lifecycle(true), /Research completed/);
assert.doesNotMatch(lifecycle(true),/Appointment history/,'Records with no events do not display an empty audit disclosure');
assert.match(lifecycle(true), /Approved on/);
assert.equal(typeof coordinator.CoordinatorApplicationLifecycle, 'function', 'An approved application detail must include its own lifecycle controls');
const selectedLifecycle = (record: SupervisorApplicationRecord) => renderToStaticMarkup(<coordinator.CoordinatorApplicationLifecycle record={record} onEnd={async () => {}} />);
assert.match(selectedLifecycle(active), />End supervisor appointment</);
assert.doesNotMatch(selectedLifecycle(active), /Ended appointment student|Research completed/, 'A selected application cannot expose unrelated lifecycle records');
assert.doesNotMatch(selectedLifecycle(active), /View student record|Programme Appointment Records/, 'Embedded lifecycle omits duplicate navigation and workspace framing');
assert.match(selectedLifecycle(ended), /Research completed/);
assert.doesNotMatch(selectedLifecycle(ended), />End supervisor appointment</);
assert.equal(selectedLifecycle(base), '', 'Pending requests do not receive appointment controls');
const labelledReturn = renderToStaticMarkup(<MemoryRouter><coordinator.CoordinatorSupervisorApprovals initialApplicationId="1" backLabel="Back to Supervisory teams" /></MemoryRouter>);
assert.match(labelledReturn, /Back to Supervisory teams/);
console.log('Coordinator compact primary/supporting queue, terminal history, filters and 10/25/50 pagination passed');
