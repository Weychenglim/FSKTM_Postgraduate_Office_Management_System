import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {StudentPanelAppointmentOverview} from './StudentPanelAppointment';
import type {StudentPanelAppointmentView} from '../types';

const appointment:StudentPanelAppointmentView={
  status:'CONFIRMED',readinessState:'CONFIRMED',studentName:'Nur Aina Rahman',studentId:'PG2026001',programme:'Master of Data Science',semester:'Semester I 2026/2027',supervisorName:'Dr Primary',researchTitle:'Outdated request title',
  panelMemberName:'Dr Confirmed',panelMemberId:'L071',panelMemberDepartment:'Computing',panelMemberEmail:'confirmed@example.test',appointmentDate:'20 Oct 2026',
  researchProfile:{title:'Current approved research',programme:'Master of Data Science',area:'Explainable AI',abstract:'First complete paragraph.\n\nFinal complete paragraph.'},
};
const render=(value:StudentPanelAppointmentView)=>renderToStaticMarkup(<MemoryRouter><StudentPanelAppointmentOverview appointment={value}/></MemoryRouter>);

test('Current project stage sits beside Programme in both Panel states',()=>{
  const confirmed=render({...appointment,projectStage:'P2',projectSemester:'Semester II 2026/2027'});
  assert.match(confirmed, /Programme<\/dt>.*Your project stage<\/dt><dd[^>]*>RP2<span[^>]*>Semester II 2026\/2027<\/span>/);
  const pending=render({...appointment,status:'PENDING',readinessState:'FACULTY_PROCESSING',projectStage:'P1',projectSemester:appointment.semester});
  assert.match(pending, /Programme<\/dt>.*Your project stage<\/dt><dd[^>]*>RP1<\/dd>/);
  assert.doesNotMatch(pending, /Current project stage/);
});

test('Student overview separates current identity, confirmed member and saved research',()=>{
  const html=render(appointment);
  assert.doesNotMatch(html,/aria-label="Academic context"/);
  for(const text of ['Master of Data Science','Semester I 2026/2027','Dr Primary','Dr Confirmed','20 Oct 2026','Current approved research','Final complete paragraph.'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/Staff number|L071/,'Internal staff numbers are not student-facing facts');
  assert.match(html,/href="mailto:confirmed@example.test"/);
  assert.doesNotMatch(html,/Outdated request title|Request summary|Review and outcome/);
  assert.equal((html.match(/>Current approved research</g)||[]).length,1);
});

test('pending supervisor stays proposed and private Panel fields never become a current member',()=>{
  const html=render({...appointment,status:'PENDING',readinessState:'SUPERVISOR_APPROVAL_PENDING',researchProfile:null});
  assert.match(html,/>Proposed supervisor</);
  assert.match(html,/Dr Primary|href="\/supervisor-appointments"/);
  assert.doesNotMatch(html,/Dr Confirmed|confirmed@example.test|L071|Computing|20 Oct 2026|Outdated request title|>Primary supervisor</);
});

test('faculty processing is generic and renders no accidental internal nomination properties',()=>{
  const html=render({...appointment,status:'PENDING',readinessState:'FACULTY_PROCESSING',waitingDays:3,waitingOn:'FACULTY_PROCESSING',
    recommendedMember:'Private candidate',rejectionReason:'Private reason',workflow:[{reason:'Private audit'}],
  } as StudentPanelAppointmentView);
  assert.match(html,/faculty processing/i);
  assert.match(html,/3 days/);
  assert.doesNotMatch(html,/Private|Dr Confirmed|confirmed@example.test|L071|20 Oct 2026|Approve|Reject|Audit history/);
});

test('absent confirmed data is honest and a mismatched readiness never releases member fields',()=>{
  const missing=render({...appointment,panelMemberName:null,panelMemberId:null,panelMemberDepartment:null,panelMemberEmail:null,appointmentDate:null,researchProfile:null});
  assert.match(missing,/Panel member not recorded/);
  assert.doesNotMatch(missing,/mailto:|Outdated request title|aria-label="Research profile"/);
  const mismatch=render({...appointment,readinessState:'FACULTY_PROCESSING'});
  assert.doesNotMatch(mismatch,/Dr Confirmed|confirmed@example.test|L071|20 Oct 2026/);
});

test('FAQ remains available without an unmatched manual refresh button',()=>{
  const html=renderToStaticMarkup(<MemoryRouter><StudentPanelAppointmentOverview appointment={appointment} onShowFAQChatbot={()=>{}}/></MemoryRouter>);
  assert.doesNotMatch(html,/Refresh appointment/);
  assert.match(html,/>Appointment FAQ</);
});
