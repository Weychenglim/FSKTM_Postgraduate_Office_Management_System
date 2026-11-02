import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {PanelAssignmentDetail} from './PanelAssignmentDetail';
import {PanelAppointmentDetail} from './PanelAppointmentDetail';
import {PanelAppointmentRecordCard} from './PanelRecordDetails';
import {PanelSuperviseeDetails} from './PanelSuperviseeRoster';
import {PanelRecommendationReviewDrawer} from './LecturerPanelAppointments';
import type {PanelAssignment,PanelRecommendationDraft,PanelRecommendationSupervisee,PanelRecord} from '../types';

const lifecycle={appointmentId:9,status:'ACTIVE' as const,endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null,lifecycle:[]};
const recommendation:PanelRecommendationDraft={id:71,studentId:'PG071',studentName:'Aina Sofea Rahman',programme:'Data Science',semester:'Semester I',supervisorName:'Dr Nadia',recommendedMember:'Dr Amir',recommendedMemberId:'L071',proposedTopic:'Current research title',researchArea:'Explainable AI',abstract:'First paragraph.\n\nSecond paragraph.',status:'APPROVED',submittedDate:'20 Oct 2026',justification:'Relevant subject expertise.',appointmentLifecycle:lifecycle,workflow:[]};
const assignment:PanelAssignment={academicTeam:null,appointmentId:9,studentId:'PG071',studentName:recommendation.studentName,researchTitle:recommendation.proposedTopic,supervisor:'Dr Nadia',appointmentDate:'2026-10-20',status:'ACTIVE',recommendation,appointmentLifecycle:lifecycle};
const student:PanelRecommendationSupervisee={studentId:'PG071',studentName:recommendation.studentName,programme:'Data Science',semester:'Semester I',proposedTopic:recommendation.proposedTopic,researchArea:'Explainable AI',abstract:recommendation.abstract!,supervisorName:'Dr Nadia',supervisorId:'L001',supervisorAppointmentId:2,panelAppointmentId:9,currentPanelMember:'Dr Appointed',currentPanelMemberId:'L009',canRecommend:true};

test('Assignments prioritise appointed member and current research with compact lifecycle beside content',()=>{
  const html=render(<PanelAssignmentDetail assignment={assignment} onBack={()=>{}} onOpenMarksEntry={()=>{}} onOpenStudent={()=>{}}/>);
  assert.match(html,/data-panel-assignment-columns/);
  for(const title of ['Academic team','Current research','Appointment record'])assert.ok(html.includes(`>${title}</h2>`),title);
  assert.match(html,/View approved application/);
  assert.doesNotMatch(html,/Approval progress/);
  assert.doesNotMatch(html,/Open Marks Entry/);
  assert.equal((html.match(/Aina Sofea Rahman/g)||[]).length,1,'No repeated student in compact lifecycle');
  assert.doesNotMatch(html,/>Nomination details<|>Review and outcome</);
});

test('Compact lifecycle preserves terminal outcome, actor and exact actions without duplicate identities',()=>{
  const html=render(<PanelAppointmentRecordCard compact record={{...recommendation,appointmentLifecycle:{...lifecycle,status:'ENDED',endOutcome:'WITHDRAWN',endReason:'Student withdrew from the project.',endedAt:'2026-10-23',endedBy:'Office'}}}/>);
  for(const text of ['Appointment record','Withdrawn','Student withdrew from the project.','Office','23 Oct 2026'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/Aina Sofea Rahman|Dr Amir|End Appointment/);
});

test('Supervisee details keep appointed and proposed members in independent surfaces and retain research',()=>{
  const html=render(<PanelSuperviseeDetails student={{...student,canRecommend:false}} pendingRequest={{...recommendation,status:'PENDING_COORDINATOR',recommendedMember:'Dr Proposed'}} onRecommend={()=>{}} onOpenRequest={()=>{}}/>);
  assert.match(html,/data-panel-supervisee-columns/);
  assert.match(html,/Current appointed panel member/);
  for(const text of ['Dr Appointed','Dr Proposed','Proposed replacement','Current research','First paragraph.','Second paragraph.','View pending request'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/>Request replacement<|>Nominate panel member</);
});

test('Coordinator assignment presentation cannot become a request review',()=>{
  const html=render(<PanelRecommendationReviewDrawer isOpen presentation="appointment" recommendation={{...recommendation,status:'PENDING_COORDINATOR',canReview:true}} reviewerRole="PROGRAMME_COORDINATOR" onClose={()=>{}}/>);
  assert.match(html,/data-panel-assignment-columns/);
  assert.doesNotMatch(html,/>Approve request<|>Reject request</);
});

test('Office explicit appointment view differs from its unchanged recommendation route',()=>{
  const record={recordId:'appointment-9',id:'PG071',studentName:recommendation.studentName,programme:'Data Science',semester:'Semester I',supervisor:'Dr Nadia',panelMember:'Dr Amir',status:'Approved',updatedDate:'20 Oct 2026',recommendation,appointmentLifecycle:lifecycle} as PanelRecord;
  assert.match(render(<PanelAppointmentDetail appointmentView record={record} onBack={()=>{}}/>),/data-panel-assignment-columns/);
  assert.match(render(<PanelAppointmentDetail record={record} onBack={()=>{}}/>),/data-panel-request-columns/);
});

test('Missing lifecycle stays honest while preserving available nomination evidence',()=>{
  const html=render(<PanelAssignmentDetail assignment={{...assignment,recommendation:{...recommendation,appointmentLifecycle:null}}} onBack={()=>{}} onOpenMarksEntry={()=>{}}/>);
  assert.match(html,/No appointment lifecycle record is available/);
  assert.match(html,/View approved application/);
  assert.doesNotMatch(html,/Approval progress/);
  assert.doesNotMatch(html,/Open Marks Entry|End Appointment/);
});

test('An active Office overview does not claim absence of requests its payload cannot enumerate',()=>{
  const record={recordId:'appointment-9',id:'PG071',studentName:recommendation.studentName,programme:'Data Science',semester:'Semester I',supervisor:'Dr Nadia',panelMember:'Dr Amir',status:'Approved',updatedDate:'20 Oct 2026',recommendation,appointmentLifecycle:lifecycle} as PanelRecord;
  const html=render(<PanelAppointmentDetail overview record={record} onBack={()=>{}}/>);
  assert.match(html,/Active Panel appointment/);
  assert.doesNotMatch(html,/No ongoing request/);
});

test('Panel assignment academic team separates primary and supporting supervisors consistently',()=>{
  const html=render(<PanelAssignmentDetail assignment={{...assignment,academicTeam:{primary:{name:'Dr Primary',email:'primary@example.test',department:'Computing',appointmentDate:'2026-10-20'},supporting:[{name:'Dr Supporting',email:'support@example.test',department:'Data Science',appointmentDate:'2026-10-21'}]}}} onBack={()=>{}}/>);
  assert.match(html,/aria-label="Supporting supervisors" class="min-w-0 space-y-5 border-t border-slate-200 pt-6"/);
  assert.ok(html.indexOf('Dr Primary')<html.indexOf('Supporting supervisors'));
  assert.ok(html.indexOf('Supporting supervisors')<html.indexOf('Dr Supporting'));
});
