import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SupervisoryStudentDetailCard, StudentSupervisorsOverview} from './SupervisoryTeamManagement';
import {SupervisorAppointmentRecordCard} from './SupervisorAppointmentRecordCard';
import {SupervisionOverview} from './SupervisionDetailLayout';
import type {SupervisoryTeam} from '../types/coSupervision';

const team:SupervisoryTeam={studentId:7,matricNo:'PREVIEW-007',studentName:'Example postgraduate',programme:'Computing',studentStatus:'Active',studentEmail:'example@example.test',primarySupervisor:{id:9,name:'Dr Primary'},primaryAppointmentId:4,research:{title:'A complete research title',area:'Explainable AI',abstract:'First saved paragraph.\n\nSecond saved paragraph.'},appointments:[],nominations:[],canNominate:false,timeline:[{id:'primary-1',title:'Application approved',date:'2026-10-01',status:'APPROVED'},{id:'timeline-1',title:'Semester milestone',date:'2026-11-01',status:'UPCOMING'}]};
const noop=()=>{};

test('Staff supervision detail separates overview, team, visible research and appointment activity',()=>{
  const html=renderToStaticMarkup(<SupervisoryStudentDetailCard team={{...team,projectStage:'P2',projectSemester:'Semester II'}} busy={false} collapsible={false} context={{semester:'Semester I'}} actions={<button>View student record</button>} management={<SupervisorAppointmentRecordCard compact appointmentSemester="Semester I" record={{studentName:team.studentName,studentId:team.matricNo,supervisor:'Dr Primary',status:'ACTIVE',approvedAt:'2026-10-01',events:[]}}/>} onNominate={noop} onEnd={noop} onReplace={noop} onNominationAction={noop}/>);
  assert.match(html,/data-supervision-layout/);
  for(const title of ['Supervisory team','Research profile','Appointment record'])assert.ok(html.includes(title),title);
  assert.doesNotMatch(html,/<summary[^>]*>Research profile<\/summary>/,'Current research is readable without opening a disclosure');
  assert.equal((html.match(/Example postgraduate/g)??[]).length,1,'Appointment metadata does not repeat student identity');
  assert.equal((html.match(/Dr Primary/g)??[]).length,1,'Primary supervisor is not repeated in management metadata');
  assert.match(html,/First saved paragraph\.\n\nSecond saved paragraph\./);
  assert.match(html,/Enrolment status/);assert.match(html,/example@example.test/);
  assert.match(html,/<dt[^>]*>Project stage<\/dt><dd[^>]*>RP2<span[^>]*>Semester II<\/span><\/dd>/);
  assert.match(html,/data-supervisor-appointment-record.*Appointment semester<.*>Semester I</);
  assert.doesNotMatch(html.split('data-supervisor-appointment-record')[0], /Appointment semester/);
  assert.doesNotMatch(html,/>Approve<|>End appointment<|>Replace<|>Nominate co-supervisor</,'Layout does not create capabilities');
});

test('Supervision overview avoids repeating the semester when the stage and appointment share it',()=>{
  const html=renderToStaticMarkup(<SupervisionOverview team={{...team,projectStage:'P2',projectSemester:'Semester I'}} context={{semester:'Semester I'}}/>);
  assert.match(html,/<dt[^>]*>Project stage<\/dt><dd[^>]*>RP2<\/dd>/);
  assert.doesNotMatch(html,/Semester I/);
});

test('Compact appointment presentation preserves lifecycle facts and authorized controls',()=>{
  const html=renderToStaticMarkup(<SupervisorAppointmentRecordCard compact record={{studentName:'Hidden duplicate',studentId:'DUP',supervisor:'Hidden supervisor',status:'ENDED',approvedAt:'2026-10-01',endedAt:'2026-10-20',endOutcome:'COMPLETED',endReason:'Saved outcome reason',endedBy:'Office actor',events:[{id:1,action:'ENDED',newStatus:'ENDED',actorName:'Office actor',createdAt:'2026-10-20'}]}} actions={<button>Authorized action</button>}/>);
  for(const label of ['Approved on','Ended on','Saved outcome reason','Office actor','Appointment changes','Authorized action'])assert.ok(html.includes(label),label);
  assert.doesNotMatch(html,/Hidden duplicate|Hidden supervisor|>DUP</);
  const historical=renderToStaticMarkup(<SupervisorAppointmentRecordCard record={{studentName:'Historical student',studentId:'OLD',supervisor:'Historical supervisor',status:'ENDED',events:[]}}/>);
  assert.match(historical,/Historical student/);assert.match(historical,/Historical supervisor/);
});

test('Student overview separates own team from the research reading surface and keeps private staff content out',()=>{
  const html=renderToStaticMarkup(<StudentSupervisorsOverview workspace={{teams:[{...team,projectStage:'P1',projectSemester:'Semester I',primaryAppointmentDetails:{email:'',department:'',appointmentDate:'',semester:'Semester I'}}],appointments:[],nominations:[]}} actions={<button>View request</button>}/>);
  assert.match(html,/data-student-supervision-overview/);
  assert.match(html,/<h2[^>]*>My supervisors<\/h2>/);
  assert.match(html,/Programme<\/dt>.*Your project stage<\/dt><dd[^>]*>RP1<\/dd>/);
  assert.match(html,/aria-label="Research profile"/);
  assert.match(html,/data-supervision-research/);
  assert.match(html,/View request/);
  assert.doesNotMatch(html,/Activity and dates|Semester milestone|Nominate co-supervisor|End appointment|Supporting appointment history/);
});
