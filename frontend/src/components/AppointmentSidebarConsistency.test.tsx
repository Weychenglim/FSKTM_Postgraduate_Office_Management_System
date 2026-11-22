import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {PanelAssignmentDetails} from './PanelAssignmentDetails';
import {SupervisoryStudentDetailCard} from './SupervisoryTeamManagement';
import {panelBrowseRecordKey} from '../utils/panelPresentation';
import type {PanelPresentation} from '../utils/panelPresentation';
import type {SupervisoryTeam} from '../types/coSupervision';

const lifecycle={appointmentId:9,status:'ACTIVE' as const,endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null,lifecycle:[{id:1,action:'ACTIVATED' as const,actorName:'Recorded coordinator',actorRole:'Programme Coordinator',previousStatus:'',newStatus:'ACTIVE',outcome:null,reason:null,createdAt:'2026-10-20T08:00:00Z'}]};
const panel:PanelPresentation={id:71,studentId:'PG071',studentName:'Example student',programme:'Computing',recommendedMember:'Dr Panel',recommendedMemberId:'LP1',submittedDate:'20 Oct 2026',proposedTopic:'Research title',status:'APPROVED',appointmentLifecycle:lifecycle,workflow:[]};

test('Approved nominations remain requests when opened from the request list',()=>{
  assert.equal(panelBrowseRecordKey(panel,'requests'),'recommendation-71');
  assert.equal(panelBrowseRecordKey(panel,'appointments'),'appointment-9');
  assert.equal(panelBrowseRecordKey({...panel,id:undefined},'requests'),'appointment-9','An imported appointment without a request must not acquire a fabricated request');
});

test('Panel appointment history is separate from management and its source request is accessible',()=>{
  const html=render(<PanelAssignmentDetails record={panel} onViewRequest={()=>{}} actions={<button>Authorized management</button>}/>);
  const record=html.slice(html.indexOf('data-panel-appointment-record'),html.indexOf('data-appointment-history'));
  assert.match(record,/Authorized management/);
  assert.match(record,/View approved application/);
  assert.doesNotMatch(record,/Approval history|Appointment changes|Approval progress/);
  assert.doesNotMatch(html,/data-appointment-history|Approval history|Recorded coordinator/,'Creation-only appointments refer to their source request');
});

test('Panel assignment puts the stage in student details and the appointment semester in its record',()=>{
  const html=render(<PanelAssignmentDetails record={{...panel,semester:'Semester I',projectStage:'P2',projectSemester:'Semester II'}}/>);
  const [studentAndTeam,appointment]=html.split('data-panel-appointment-record');
  assert.match(studentAndTeam,/<dt[^>]*>Project stage<\/dt><dd[^>]*>RP2<span[^>]*>Semester II<\/span><\/dd>/);
  assert.doesNotMatch(studentAndTeam,/Semester I<\/dd>/);
  assert.match(appointment,/Appointment semester<.*>Semester I</);

  const sameSemester=render(<PanelAssignmentDetails record={{...panel,semester:'Semester II',projectStage:'P2',projectSemester:'Semester II'}} academicTeam={null}/>);
  assert.match(sameSemester,/<dt[^>]*>Project stage<\/dt><dd[^>]*>RP2<\/dd>/);
  assert.equal((sameSemester.match(/Semester II/g)??[]).length,1);
});

test('Supervision separates history from the shared academic schedule',()=>{
  const team:SupervisoryTeam={studentId:7,matricNo:'PG007',studentName:'Example student',programme:'Computing',studentStatus:'ACTIVE',primarySupervisor:{id:9,name:'Dr Primary'},primaryAppointmentId:4,research:{title:'Research',area:'AI',abstract:'Abstract'},appointments:[],nominations:[],canNominate:false,timeline:[{id:'primary-1',title:'Recorded appointment event',status:'APPROVED'},{id:'timeline-1',title:'Shared semester date',status:'UPCOMING'}]};
  const noop=()=>{};
  const html=render(<SupervisoryStudentDetailCard team={team} busy={false} collapsible={false} onNominate={noop} onEnd={noop} onReplace={noop} onNominationAction={noop}/>);
  assert.doesNotMatch(html,/data-appointment-history|Approval history/);
  assert.doesNotMatch(html,/Activity and dates/);
  assert.doesNotMatch(html,/data-semester-schedule|Shared semester date/,'Shared calendar dates belong in the dashboard');
});
