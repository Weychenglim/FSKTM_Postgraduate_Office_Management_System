import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { StudentPanelAppointmentOverview } from './StudentPanelAppointment';
import { SupervisorAppointmentGuidanceView } from './StudentAppointmentGuidance';
import type { StudentPanelAppointmentView, SupervisorDocumentRequirement } from '../types';

const panel: StudentPanelAppointmentView = {
  status:'CONFIRMED',readinessState:'CONFIRMED',studentName:'Student',studentId:'PG001',programme:'Current programme',semester:'Semester I',researchTitle:'Recorded title',supervisorName:'Dr Primary',
  panelMemberName:'Dr Panel',panelMemberId:'P001',panelMemberDepartment:'Department',panelMemberEmail:'panel@example.test',appointmentDate:'10 Oct 2026',
  researchProfile:{title:'Recorded title',programme:'Current programme',area:'Explainable AI',abstract:'Current saved abstract.\nSecond paragraph.'},
};
const renderPanel = (value: StudentPanelAppointmentView) => renderToStaticMarkup(<MemoryRouter><StudentPanelAppointmentOverview appointment={value} /></MemoryRouter>);
const confirmed = renderPanel(panel);
assert.match(confirmed, /aria-label="Research summary"/);
assert.match(confirmed, /Explainable AI|Current saved abstract/);
assert.equal((confirmed.match(/>Recorded title</g) ?? []).length, 1, 'The title belongs to the shared profile, without another title block');
assert.doesNotMatch(renderPanel({...panel,researchProfile:null}), /aria-label="Research summary"|Current saved abstract/, 'No approved profile is invented from a pending request title');
assert.match(confirmed, /My panel|Dr Panel|panel@example.test|10 Oct 2026|Recorded title/);
assert.match(confirmed, /aria-label="Appointment guidance"/);
assert.doesNotMatch(confirmed, /<details[^>]*>[\s\S]*Appointment guidance|What Happens Next|Something looks incorrect|Panel Appointment Progress/);
assert.match(confirmed, /primary supervisor|replacement/);
for (const state of ['SUPERVISOR_REQUIRED','SUPERVISOR_APPROVAL_PENDING','READY_FOR_PANEL_RECOMMENDATION','FACULTY_PROCESSING'] as const) {
  const pending = renderPanel({...panel,status:'PENDING',readinessState:state,waitingDays:3,waitingOn:'FACULTY_PROCESSING'});
  assert.doesNotMatch(pending, /Dr Panel|panel@example.test|P001|Department|10 Oct 2026/);
  assert.match(pending, /aria-label="Appointment guidance"/);
  if (state === 'SUPERVISOR_REQUIRED' || state === 'SUPERVISOR_APPROVAL_PENDING') assert.match(pending, /href="\/supervisor-appointments"/);
  if (state === 'FACULTY_PROCESSING') assert.match(pending, /faculty processing/i);
}
assert.doesNotMatch(renderPanel({...panel,readinessState:'FACULTY_PROCESSING'}), /Dr Panel|panel@example.test/);

const requirements: SupervisorDocumentRequirement[] = [{id:1,code:'PROPOSAL',label:'Research proposal',description:'Configured description',isRequired:true,isActive:true,displayOrder:1,isUsed:false}, {id:2,code:'CV',label:'Research CV',description:'',isRequired:false,isActive:true,displayOrder:2,isUsed:false}];
const guide = (hasSupervisor: boolean, values = requirements) => renderToStaticMarkup(<SupervisorAppointmentGuidanceView requirements={values} loading={false} error={null} hasSupervisor={hasSupervisor} onRetry={() => {}} />);
assert.match(guide(true), /What happens next|Changing your supervisor|Postgraduate Office/);
assert.doesNotMatch(guide(true), /Documents for a new application|Research proposal|Research CV|10 MB/);
assert.match(guide(false), /Research proposal|Required|Research CV|Optional|10 MB/);
assert.doesNotMatch(guide(true), /<details|Submission prerequisites|Approval process|Need Assistance|turnaround/);
assert.doesNotMatch(guide(false), /Changing your supervisor/);
assert.match(guide(false, []), /not configured|Postgraduate Office/);
const failed = renderToStaticMarkup(<SupervisorAppointmentGuidanceView requirements={[]} loading={false} error="Unavailable" hasSupervisor={false} onRetry={() => {}} />);
assert.match(failed, /Retry|Unavailable/);
console.log('Student appointment consistency, visible useful guidance and pending Panel privacy passed');
