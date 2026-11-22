import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {StudentPanelAppointmentOverview} from './StudentPanelAppointment';
import {StudentSupervisorsOverview} from './SupervisoryTeamManagement';
import type {StudentPanelAppointmentView} from '../types';

test('Supervisor puts the source action in its card header and shows useful appointment details',()=>{
  const team={studentId:1,matricNo:'PG1',studentName:'Student',programme:'Computing',studentStatus:'ACTIVE',primarySupervisor:{id:2,name:'Dr Primary'},primaryAppointmentId:3,
    primaryAppointmentDetails:{email:'primary@example.test',department:'Computing department',appointmentDate:'2026-10-01',semester:'Semester I'},
    research:{title:'Saved title',area:'AI',abstract:'Saved abstract'},appointments:[],nominations:[],canNominate:false};
  const html=renderToStaticMarkup(<StudentSupervisorsOverview workspace={{teams:[team],appointments:[],nominations:[]}} actions={<button>View approved application</button>}
    content={{researchActions:<button>View research profile</button>}}/>);
  for(const value of ['primary@example.test','Computing department','Semester I','01 Oct 2026'])assert.ok(html.includes(value),value);
  assert.ok(html.indexOf('View approved application')<html.indexOf('Primary supervisor'),'Source action belongs in the appointment card header');
  assert.ok(html.indexOf('data-supervision-research') < html.indexOf('View research profile')
    && html.indexOf('View research profile') < html.indexOf('Current research title'),'Profile action belongs in the research card header');
  assert.doesNotMatch(html,/aria-label="Academic context"/,'Metadata must be inside the card');
});

test('Panel overview has no approved-nomination button or floating controls',()=>{
  const appointment:StudentPanelAppointmentView={status:'CONFIRMED',readinessState:'CONFIRMED',studentName:'Student',studentId:'PG1',programme:'Computing',semester:'Semester I',researchTitle:'Title',researchProfile:null,supervisorName:'Dr Primary',panelMemberName:'Dr Panel',panelMemberId:null,panelMemberDepartment:'Computing',panelMemberEmail:'panel@example.test',appointmentDate:'01 Oct 2026',
    ...{approvedRequest:{id:7,nominatedBy:'Dr Primary',submittedAt:'2026-09-01',approvedAt:'2026-10-01',panelAcceptedAt:'2026-09-10'}}};
  const html=renderToStaticMarkup(<MemoryRouter><StudentPanelAppointmentOverview appointment={appointment}/></MemoryRouter>);
  assert.doesNotMatch(html,/View approved nomination/);
  assert.doesNotMatch(html,/aria-label="Academic context"|Refresh appointment/);
});
