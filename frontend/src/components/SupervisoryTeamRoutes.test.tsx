import { MemoryRouter } from 'react-router';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as supervision from './SupervisoryTeamManagement';
import type { CoSupervisorAppointment, CoSupervisorNomination, SupervisoryWorkspace } from '../types/coSupervision';

const appointment: CoSupervisorAppointment = { id: 1, studentId: 7, matricNo: 'PG007', studentName: 'Primary Student', supervisor: { id: 2, name: 'Supporting Lecturer' }, status: 'ACTIVE', appointmentDate: '2026-09-01', endOutcome: '', endReason: '', endedAt: null, supersedesId: null, canEnd: true, history: [] };
const previous = { ...appointment, id: 2, status: 'ENDED' as const, endReason: 'Current team ended appointment', canEnd: false };
const nomination: CoSupervisorNomination = { id: 3, studentId: 7, matricNo: 'PG007', studentName: 'Primary Student', candidate: { id: 3, name: 'Pending Candidate' }, nominator: { id: 4, name: 'Primary Lecturer' }, status: 'SUBMITTED_TO_CO_SUPERVISOR', justification: 'Actionable nomination justification', reason: '', submittedAt: '2026-09-01', replacesAppointmentId: null, allowedActions: ['accept', 'reject'], history: [] };
const closed = { ...nomination, id: 4, status: 'CANCELLED' as const, justification: 'Closed current team nomination', allowedActions: [] };
const workspace: SupervisoryWorkspace = {
  teams: [
    { studentId: 7, matricNo: 'PG007', studentName: 'Primary Student', programme: 'Computing MSc', studentStatus: 'Active', primarySupervisor: { id: 4, name: 'Primary Lecturer' }, primaryAppointmentId: 9, research: { title: 'Primary research title', area: 'Machine learning', abstract: 'Primary full abstract' }, appointments: [appointment, previous], nominations: [nomination, closed], canNominate: true, timeline: [{ id: 'timeline-1', title: 'Private semester date' }] },
    { studentId: 8, matricNo: 'PG008', studentName: 'Supporting Student', programme: 'Computing PhD', studentStatus: 'Active', primarySupervisor: { id: 5, name: 'Other Primary Lecturer' }, primaryAppointmentId: 10, research: { title: 'Supporting research title', area: 'Networks', abstract: 'Supporting full abstract' }, appointments: [{ ...appointment, id: 5, studentId: 8, matricNo: 'PG008', studentName: 'Supporting Student', supervisor: { id: 4, name: 'Primary Lecturer' }, canEnd: false }], nominations: [], canNominate: false },
  ],
  appointments: [appointment, previous, { ...previous, id: 6, studentId: 9, matricNo: 'PG009', studentName: 'Previous Student', endReason: 'Previous team ended appointment' }],
  nominations: [nomination, closed, { ...nomination, id: 7, studentId: 10, studentName: 'Prospective Student', matricNo: 'PG010', justification: 'Prospective nomination justification' }, { ...nomination, id: 8, status: 'PENDING_COORDINATOR', justification: 'Pending another reviewer', allowedActions: [] }],
};

assert.ok('SupervisoryTeamRouteContent' in supervision, 'Loaded supervisory content supports routed views');
const render = (view: string, overrides: Record<string, unknown> = {}) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement((supervision as any).SupervisoryTeamRouteContent, { workspace, view, busy: false, lecturerId: '4', search: '', page: 1, onSearch: () => {}, onPage: () => {}, onNavigateToStudent: () => {}, onNominate: () => {}, onEnd: () => {}, onReplace: () => {}, onNominationAction: () => {}, ...overrides })));

const roster = render('roster');
for (const text of ['Primary Student', 'PG007', 'Computing MSc', 'Primary supervisor', 'Supporting Student', 'PG008', 'Computing PhD', 'Supporting supervisor', 'View supervision']) assert.ok(roster.includes(text), `Roster missing ${text}`);
assert.equal((roster.match(/>View supervision</g) ?? []).length, 2);
assert.match(roster, /<table/, 'Supervisees use the shared responsive table');
assert.doesNotMatch(roster, /Primary research title|Supporting research title|Waiting at this stage/, 'The roster uses only relevant columns');
assert.match(render('roster', { workspace: { ...workspace, teams: [{ ...workspace.teams[0], canNominate: false }] } }), /Primary supervisor/, 'Read-only primary lecturers retain their recorded role');
const pagedWorkspace = { ...workspace, teams: Array.from({ length: 11 }, (_, index) => ({ ...workspace.teams[0], studentId: 100 + index, studentName: `Paged student ${index}`, matricNo: `PG${100 + index}` })) };
assert.equal((render('roster', { workspace: pagedWorkspace }).match(/>View supervision</g) ?? []).length, 10, 'Shared list pagination shows ten records');
const secondRosterPage = render('roster', { workspace: pagedWorkspace, page: 2 });
assert.equal((secondRosterPage.match(/>View supervision</g) ?? []).length, 1);
assert.equal((render('roster', { workspace: pagedWorkspace, pageSize: 25 }).match(/>View supervision</g) ?? []).length, 11, 'Rows per page applies before rendering');
assert.match(secondRosterPage, /Paged student 10/);
assert.doesNotMatch(secondRosterPage, /Paged student 0</);
assert.doesNotMatch(roster, /Primary full abstract|Supporting full abstract|Current team ended appointment|Actionable nomination justification|Closed current team nomination|Private semester date|Prospective Student|Previous Student|Audit history|<details|Nominate co-supervisor|End appointment|>Replace<|>Accept</);
assert.match(render('roster', { search: 'PG008' }), /Supporting Student/);
assert.doesNotMatch(render('roster', { search: 'PG008' }), /Primary Student/);
assert.match(render('roster', { search: 'primary research' }), /Primary Student/);
assert.match(render('roster', { search: 'unmatched' }), /No matching supervisees/);

const requests = render('requests');
for (const text of ['Actionable nomination justification', 'Prospective nomination justification', '>Accept<', '>Reject<']) assert.ok(requests.includes(text), `Requests missing ${text}`);
assert.doesNotMatch(requests, /Primary full abstract|Supporting full abstract|Closed current team nomination|Current team ended appointment|Pending another reviewer|Nominate co-supervisor/);
const history = render('history');
for (const text of ['Current team ended appointment', 'Previous team ended appointment', 'Closed current team nomination']) assert.ok(history.includes(text));
assert.equal((history.match(/Current team ended appointment/g) ?? []).length, 1, 'Flattened and per-team history records are deduplicated');
assert.match(history, /Pending another reviewer/, 'Accepted nominations remain readable while another reviewer decides');
assert.doesNotMatch(history, /Actionable nomination justification|Prospective nomination justification|>Accept<|>Reject<|End appointment|Nominate co-supervisor/);

const detail = render('detail', { routeStudentId: 'PG007' });
for (const text of ['Primary full abstract', 'View nomination request', 'End appointment']) assert.ok(detail.includes(text), `Detail missing ${text}`);
assert.doesNotMatch(detail, /Nominate co-supervisor|>Replace<|>Accept<|>Reject<|Supporting Student|Supporting full abstract|Prospective nomination justification|Previous team ended appointment/);
assert.match(detail, /<article/,'A shared student card lives inside the consistent detail layout');
assert.match(render('detail', { routeStudentId: 'PG008' }), /Supporting full abstract/);
assert.doesNotMatch(render('detail', { routeStudentId: 'PG008' }), /Nominate co-supervisor|>Replace<|End appointment|>Accept</);
assert.match(render('detail', { routeStudentId: 'PG999' }), /Supervision not found/);
assert.doesNotMatch(render('detail', { routeStudentId: 'PG999' }), /Primary full abstract|Supporting full abstract/);

const overview = render('studentOverview', { studentActions: <button>View appointment</button> });
for (const text of ['Primary Lecturer', 'Supporting Lecturer', 'Primary research title', 'View appointment']) assert.ok(overview.includes(text), `Overview missing ${text}`);
for (const text of ['Research profile','Research area','Primary full abstract','Computing MSc']) assert.ok(overview.includes(text),`Student overview research profile missing ${text}`);
assert.match(overview, /<section aria-label="Research profile"/,'Current research is visible in the shared profile section');
assert.doesNotMatch(overview, /<summary[^>]*>Research profile/,'The profile no longer has a nested disclosure');
assert.doesNotMatch(overview, /Current team ended appointment|Closed current team nomination|Supporting appointment history|Supporting full abstract/);
const noProfile = render('studentOverview',{workspace:{...workspace,teams:[{...workspace.teams[0],research:{title:'',area:'',abstract:''}}]}});
assert.doesNotMatch(noProfile,/Research profile|Primary full abstract/,'A Student without a saved profile must not see invented research');
assert.doesNotMatch(overview, /Actionable nomination justification|Pending Candidate|Supporting supervisor requests/);
assert.match(overview, /Previous supporting supervisors/);
assert.doesNotMatch(overview, />Accept<|>Reject</);
const studentHistory = render('studentHistory');
assert.equal(studentHistory, '', 'Student Applications does not include supporting nomination history');
assert.doesNotMatch(studentHistory, /Actionable nomination justification|Primary supervisor|Supporting supervisors|Primary research title|Primary full abstract|>Accept<|>Reject<|End appointment/);
console.log('Routed supervision roster, permissions, detail selection and history rendering passed');
