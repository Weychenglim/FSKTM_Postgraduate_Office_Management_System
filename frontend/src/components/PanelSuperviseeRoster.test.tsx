import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import type { PanelRecommendationSupervisee, PanelRecommendationDraft } from '../types';

const module = await import('./PanelSuperviseeRoster').catch(() => null);
assert.ok(module, 'Supervisees need a visible roster and appointed Panel identity');
const { PanelSuperviseeRoster, PanelSuperviseeDetails, filterPanelSupervisees } = module;
const student: PanelRecommendationSupervisee = {
  studentId: 'PG001', studentName: 'Student One', programme: 'Computing', semester: 'Semester I',
  proposedTopic: 'Research title', researchArea: 'Computing', abstract: 'Abstract',
  supervisorName: 'Dr Supervisor', supervisorId: 'L001', supervisorAppointmentId: 1,
  panelAppointmentId: 8, currentPanelMember: 'Dr Appointed', currentPanelMemberId: 'L008', canRecommend: true,
};
const request: PanelRecommendationDraft = {
  id: 10, studentId: 'PG001', studentName: 'Student One', programme: 'Computing',
  proposedTopic: 'Research title', recommendedMember: 'Dr Proposed', recommendedMemberId: 'L009',
  status: 'PENDING_COORDINATOR', submittedDate: '18 Oct 2026',
};

test('roster searches appointed Panel identities and filters needs independently from replacement requests', () => {
  const unappointed = { ...student, studentId: 'PG002', studentName: 'Student Two', panelAppointmentId: null, currentPanelMember: null, currentPanelMemberId: null };
  const pending = { ...student, canRecommend: false };
  assert.deepEqual(filterPanelSupervisees([pending, unappointed], [request], 'l008', '').map(s => s.studentId), ['PG001']);
  assert.deepEqual(filterPanelSupervisees([pending, unappointed], [request], '', 'needs-nomination').map(s => s.studentId), ['PG002']);
  assert.deepEqual(filterPanelSupervisees([pending, unappointed], [request], '', 'awaiting-coordinator').map(s => s.studentId), ['PG001']);
  assert.equal(filterPanelSupervisees([pending], [request], '', 'active').length, 0);
});

test('roster shows the current Panel alongside a pending nomination without auto-opening a student', () => {
  const html = render(<PanelSuperviseeRoster students={[{ ...student, canRecommend: false }]} recommendations={[request]} onOpen={() => {}} />);
  for (const text of ['Student One', 'PG001', 'Dr Appointed', 'L008', 'Awaiting Coordinator approval', 'View student']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Select supervisee|Replace Panel Member/);
});

test('student detail separates the appointed member from a pending replacement and prevents another nomination', () => {
  const html = render(<PanelSuperviseeDetails student={{ ...student, canRecommend: false }} pendingRequest={request} onRecommend={() => {}} onOpenRequest={() => {}} />);
  for (const text of ['Current appointed panel member', 'Dr Appointed', 'Proposed replacement', 'Dr Proposed', 'remains appointed until final approval', 'View pending request']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, />Request replacement<|>Nominate panel member<|Staff number|L008/);
});

test('unappointed and missing-name records are displayed honestly with permission-aware actions', () => {
  const unappointed = render(<PanelSuperviseeDetails student={{ ...student, panelAppointmentId: null, currentPanelMember: null, currentPanelMemberId: null }} onRecommend={() => {}} onOpenRequest={() => {}} />);
  assert.match(unappointed, /Not appointed/);
  assert.match(unappointed, /Nominate panel member/);
  const missing = render(<PanelSuperviseeDetails student={{ ...student, currentPanelMember: null }} onRecommend={() => {}} onOpenRequest={() => {}} />);
  assert.match(missing, /Not recorded/);
  assert.match(missing, /Request replacement/);
});

test('student detail omits completed nomination history while preserving current actions',()=>{
  const html=render(<PanelSuperviseeDetails student={student} recommendations={[{...request,status:'APPROVED'},{...request,id:11,studentId:'OTHER',recommendedMember:'Unrelated member'}]} onRecommend={()=>{}} onOpenRequest={()=>{}}/>);
  assert.doesNotMatch(html,/Nomination history|data-panel-nomination-history|Completed Panel nominations|Unrelated member/);
  assert.match(html,/Current appointed panel member|Current research/);
});
