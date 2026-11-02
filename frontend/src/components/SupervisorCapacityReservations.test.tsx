import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {LecturerPrimaryRequestActions} from './LecturerAppointmentRequests';
import {SupervisorCandidateOption,SupervisorSelectionSummary} from './SupervisorAppointmentApplicationPage';
import {toStudentSupervisorApplication} from '../services/appointmentsApi';
import {SupervisorRequestDetail,toStudentSupervisorRequestPresentation, toSupervisorRequestPresentation} from './SupervisorRequestDetail';
import {SupervisorWorkloadDetails} from './SupervisorWorkloadMonitoring';
import {CapacityRoleSummary} from './LecturerCapacityManagement';
import {WorkloadMonitoringSummary} from './WorkloadMonitoringSummary';
import {SupervisorAppointmentApplicationPage} from './SupervisorAppointmentApplicationPage';
import {OfficeAttentionTable} from './OfficeSupervisorAttention';
import {appointmentRequestStatusLabel, appointmentRequestStatusTone} from '../utils/appointmentRequestStatus';
import {buildSupervisorApprovalProcess} from '../utils/approvalProcess';
import {requestGroup} from '../utils/lecturerRequests';
import {partitionSupervisorApplications} from '../utils/supervisorWorkspace';
import type {SupervisorApplicationRecord} from '../types';

const capacity={activeLoad:4,reservedLoad:1,limit:5,availableSlots:0,pendingRequests:3,state:'FULL'};
const record={id:701,status:'SUBMITTED_TO_SUPERVISOR',studentId:'TEST-001',studentName:'Synthetic Student',programme:'Computing',semester:'S1',proposedSupervisor:'Synthetic Supervisor',proposedSupervisorId:'L1',researchTitle:'Synthetic research',researchArea:'Computing',researchAbstract:'Synthetic abstract',researchProfileReady:true,rejectionReason:'',submittedAt:'2026-10-27T00:00:00Z',workflow:[],acceptanceCapacity:capacity} as unknown as SupervisorApplicationRecord;

test('full authoritative request capacity blocks acceptance while preserving rejection',()=>{
  const html=render(<LecturerPrimaryRequestActions record={record} busy={false} onAction={()=>{}}/>);
  assert.match(html,/<button[^>]*disabled=""[^>]*>[\s\S]*?Accept request/);
  assert.match(html,/<button(?![^>]* disabled=)[^>]*>[\s\S]*?Reject request/);
  assert.match(html,/No places available/);
});
test('request detail omits capacity summaries for every policy state',()=>{
  for(const state of ['AVAILABLE','FULL','NOT_CONFIGURED','TEMPORARILY_UNAVAILABLE','INELIGIBLE'] as const){
    const request={...record,acceptanceCapacity:{...capacity,state}} as unknown as SupervisorApplicationRecord;
    const html=render(<SupervisorRequestDetail request={toSupervisorRequestPresentation(request)}/>);
    assert.doesNotMatch(html,/Current request capacity|supervision places available|held pending approval|4 active|1 reserved|Limit 5/);
  }
});

test('capacity fields survive Student and shared presentation adapters',()=>{
  const student=toStudentSupervisorApplication(record);
  assert.deepEqual((student as any).acceptanceCapacity,capacity);
  assert.deepEqual((toStudentSupervisorRequestPresentation(student) as any).acceptanceCapacity,capacity);
  assert.deepEqual((toSupervisorRequestPresentation(record) as any).acceptanceCapacity,capacity);
});
test('capacity closure maps to terminal history and neutral human wording',()=>{
  const student=toStudentSupervisorApplication({...record,status:'CANCELLED_CAPACITY_FULL'} as unknown as SupervisorApplicationRecord);
  assert.equal(student.status,'CANCELLED');
  assert.equal(appointmentRequestStatusLabel('CANCELLED_CAPACITY_FULL'),'Capacity full');
  assert.equal(appointmentRequestStatusTone('CANCELLED_CAPACITY_FULL'),'neutral');
  assert.equal(requestGroup('CANCELLED_CAPACITY_FULL',true),'history');
  assert.equal(partitionSupervisorApplications([student]).pending.length,0);
});
test('system closure keeps its recorded date and system attribution without rejected reviewer',()=>{
  const steps=buildSupervisorApprovalProcess({kind:'primary',status:'CANCELLED_CAPACITY_FULL',events:[{id:1,action:'SYSTEM_CLOSE_CAPACITY',actorName:'System',actorRole:'SYSTEM',previousStatus:'SUBMITTED_TO_SUPERVISOR',newStatus:'CANCELLED_CAPACITY_FULL',createdAt:'2026-10-27T03:00:00Z',reason:'Supervisor capacity is full.'}]});
  assert.equal(steps.at(-1)?.occurredAt,'2026-10-27T03:00:00Z');
  assert.equal(steps.at(-1)?.actorName,'System');
  assert.match(steps.at(-1)?.description??'',/automatically.*capacity/i);
  assert.ok(steps.every(step=>step.state!=='rejected'&&!step.label.includes('rejected')));
});
test('candidate options show remaining Supervisor places without a workload breakdown',()=>{
  const html=render(<SupervisorCandidateOption candidate={{id:'L1',name:'Synthetic Supervisor',initials:'SS',domain:'Computing',filled:5,total:6,selectable:true,activeLoad:4,reservedLoad:1,availableSlots:1} as any} selected={false} onToggle={()=>{}}/>);
  assert.match(html,/1 Supervisor place remaining/);assert.doesNotMatch(html,/4 active|1 reserved/);
});
test('Supervisor remaining-place fallback includes accepted reservations in both selection views',()=>{
  const candidate={id:'L1',name:'Synthetic Supervisor',initials:'SS',domain:'Computing',filled:4,total:6,activeLoad:4,reservedLoad:1,selectable:true};
  for(const html of [render(<SupervisorCandidateOption candidate={candidate} selected={false} onToggle={()=>{}}/>),render(<SupervisorSelectionSummary candidate={candidate} onClear={()=>{}}/>)]){
    assert.match(html,/1 Supervisor place remaining/);
    assert.doesNotMatch(html,/2 Supervisor places remaining/);
  }
});
test('shared request detail preserves supplied review actions without a capacity summary',()=>{
  const html=render(<SupervisorRequestDetail request={{...toSupervisorRequestPresentation(record),applicationId:undefined}} actions={<button>Review fixture</button>}/>);
  assert.match(html,/Review fixture/);
  assert.doesNotMatch(html,/Current request capacity/);
});

test('workload utilization includes reservations without inflating active students',()=>{
  const html=render(<SupervisorWorkloadDetails record={{lecturerName:'Synthetic Supervisor',lecturerId:'L1',department:'Computing',currentStudents:4,activeLoad:4,reservedLoad:1,workloadCount:5,workloadLimit:5,availableSlots:0,capacityState:'FULL',capacityPlanVersion:1,semesterCode:'S1',supervisees:[]} as any}/>);
  assert.match(html,/Capacity utilization: 100%/);assert.match(html,/Reserved places/);assert.match(html,/Active appointments/);
  assert.doesNotMatch(html,/Pending requests do not reserve capacity/);
});
test('Supervisor published capacity summary includes accepted reservations',()=>{
 const html=render(<CapacityRoleSummary entry={{supervisorLimit:5,supervisor:{...capacity,role:'SUPERVISOR'}} as any} role="SUPERVISOR"/>);
 assert.match(html,/4 active \+ 1 reserved/);
});
test('Supervisor aggregate keeps active appointment metric separate from reservation count',()=>{
 const html=render(<WorkloadMonitoringSummary kind="supervisor" records={[{currentStudents:4,reservedLoad:1,capacityState:'FULL',semesterCode:'S1',capacityPlanVersion:1} as any]}/>);
 assert.match(html,/1 reserved place awaiting Coordinator approval/);
 assert.doesNotMatch(html,/Pending requests do not reserve capacity/);
});
test('Supervisor selection explains that submission does not reserve capacity',()=>{
 const html=render(<SupervisorAppointmentApplicationPage onBack={()=>{}} onSuccess={()=>{}}/>);
 assert.match(html,/Submitting a request does not reserve a place/);
});
test('capacity never grants review eligibility or bypasses busy and blocked guards',()=>{
 for(const props of [{record:{...record,participantEligible:false},busy:false},{record,busy:false,blocked:true}]){
  const html=render(<LecturerPrimaryRequestActions {...props} onAction={()=>{}}/>);
  assert.doesNotMatch(html,/Accept request|Reject request/);
 }
 const html=render(<LecturerPrimaryRequestActions record={record} busy onAction={()=>{}}/>);
 const buttons=html.match(/<button[\s\S]*?<\/button>/g)??[];
 assert.equal(buttons.length,2);assert.ok(buttons.every(button=>button.includes(' disabled=""')));
});
test('Office workload concerns show reservations behind full capacity',()=>{
 const html=render(<OfficeAttentionTable category="workload" rows={[{id:1,lecturerName:'Synthetic Supervisor',lecturerId:'L1',department:'Computing',currentStudents:4,activeLoad:4,reservedLoad:1,workloadCount:5,workloadLimit:5,capacityState:'FULL',reason:'full'} as any]} onStudent={()=>{}} onRequest={()=>{}} onWorkload={()=>{}}/>);
 assert.match(html,/4 active/);assert.match(html,/1 reserved/);
});
test('unconfigured candidate capacity does not invent zero available places',()=>{
 for(const state of ['NOT_CONFIGURED','TEMPORARILY_UNAVAILABLE','INELIGIBLE'] as const){
  const html=render(<SupervisorCandidateOption candidate={{id:'L1',name:'Synthetic Supervisor',initials:'SS',domain:'Computing',filled:4,total:0,activeLoad:4,reservedLoad:0,availableSlots:0,capacityState:state,selectable:false}} selected={false} onToggle={()=>{}}/>);
  assert.match(html,state==='NOT_CONFIGURED'?/Availability not configured/:state==='TEMPORARILY_UNAVAILABLE'?/Temporarily unavailable/:/Unavailable for new requests/);assert.doesNotMatch(html,/0 available/);
 }
});
