import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { PanelBrowse, filterPanelBrowse } from './PanelBrowse';
import { ListState } from './ListState';
import type { PanelPresentation } from '../utils/panelPresentation';

const active: PanelPresentation = {
  id: 1, studentId: 'PG1', studentName: 'Student One', programme: 'Computing', proposedTopic: 'Research',
  recommendedMember: 'Dr Panel', recommendedMemberId: 'L1', status: 'APPROVED', submittedDate: '01 Oct 2026',
  appointmentDate: '2026-10-01', appointmentLifecycle: { appointmentId: 1, status: 'ACTIVE', endOutcome: null, endReason: null, endedAt: null, endedBy: null, supersedesAppointmentId: null, replacementAppointmentId: null },
};
const ended: PanelPresentation = { ...active, id: 2, studentName: 'Former Student', appointmentLifecycle: { ...active.appointmentLifecycle!, appointmentId: 2, status: 'ENDED', endOutcome: 'REPLACED', endedAt: '2026-10-18T04:00:00Z' } };

test('every Panel context retains explicit history controls and visible common filters', () => {
  for (const appointments of [false, true]) {
    const html = render(<PanelBrowse scope={`flat-${appointments}`} title="Panel records" records={[active, ended]} appointments={appointments} onOpen={() => {}} />);
    assert.match(html, appointments ? /aria-label="Appointment views"/ : /aria-label="Request views"/);
    assert.match(html, appointments ? />Past</ : />History/);
    assert.doesNotMatch(html, /More filters/);
    assert.match(html, /Semester/);
    if(appointments) assert.doesNotMatch(html,/All statuses/,'Active-only assignments do not need a status choice');
    else assert.ok(html.indexOf('Programme<') < html.indexOf('Status<'));
    assert.doesNotMatch(html,/You are the appointed Panel member/,'Shared staff views must not describe all programme appointments as the viewer’s own');
  }
});

test('assignment history shows ending date and outcome while active assignments stay out', () => {
  const memory = new Map<string, unknown>([['PanelBrowse:flat-history:view', 'history']]);
  const html = render(<ListState.Provider value={memory}><PanelBrowse scope="flat-history" title="My Panel students" records={[active, ended]} appointments onOpen={() => {}} /></ListState.Provider>);
  assert.match(html, /Former Student/);
  assert.doesNotMatch(html, /Student One/);
  assert.match(html, /18 Oct 2026/);
  assert.match(html, /Replaced/);
  assert.match(html, /Ended on/);
  assert.match(html, /These assignments have ended/);
  assert.equal(filterPanelBrowse([active, ended], { view: 'requests', appointments: true }).length, 1);
});

test('final Panel request history has one outcome table without a waiting column',()=>{
  const html=render(<PanelBrowse scope="final-outcomes" title="Panel requests" records={[active]} view="history" onOpen={()=>{}}/>);
  assert.equal((html.match(/<table/g)||[]).length,1);
  assert.match(html,/<th[^>]*>Outcome<\/th>/);
  assert.doesNotMatch(html,/Waiting at this stage|Current stage|Final request outcomes/);
});
test('Panel requests keep reviewable rows first within the default waiting sort',()=>{
  const tracking:PanelPresentation={...active,id:6,studentName:'Tracking request',status:'PENDING_COORDINATOR',waitingDays:20};
  const review:PanelPresentation={...active,id:7,studentName:'Reviewable request',status:'SUBMITTED_TO_PANEL',waitingDays:1};
  const html=render(<PanelBrowse scope="priority-requests" title="Panel requests" records={[tracking,review]} canReview={row=>row.status==='SUBMITTED_TO_PANEL'} onOpen={()=>{}}/>);
  assert.equal((html.match(/<table/g)||[]).length,1);
  assert.ok(html.indexOf('Reviewable request')<html.indexOf('Tracking request'));
  assert.match(html,/Review request/);
});
