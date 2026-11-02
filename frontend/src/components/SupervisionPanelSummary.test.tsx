import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {SupervisionPanelSummary} from './SupervisoryTeamManagement';
import {SupervisoryTeamRouteContent} from './SupervisoryTeamManagement';
import type {SupervisionPanel} from '../types/coSupervision';

const current={member:{id:20,name:'Confirmed Panel'},email:'panel@example.test',department:'Computing',appointmentDate:'2026-10-13',requestId:9,canView:true};
const base:SupervisionPanel={current:null,pending:null,canRecommend:true,canReplace:false};
const show=(panel?:SupervisionPanel)=>render(<SupervisionPanelSummary panel={panel} busy={false} onRecommend={()=>{}} onViewRequest={()=>{}} />);
assert.match(show(base),/No Panel assigned|Recommend Panel/);
const active=show({...base,current,canRecommend:false,canReplace:true});
for(const text of ['Confirmed Panel','panel@example.test','Computing','13 Oct 2026','View Panel details','Replace Panel'])assert.ok(active.includes(text),text);
assert.doesNotMatch(active,/>Recommend Panel</);
const waiting=show({...base,canRecommend:false,pending:{id:10,status:'SUBMITTED_TO_PANEL',replacement:false,canView:true}});
assert.match(waiting,/Awaiting Panel review|View recommendation/);
assert.doesNotMatch(waiting,/Recommend Panel|Replace Panel|Confirmed Panel/);
const replacement=show({...base,current,canRecommend:false,pending:{id:10,status:'PENDING_COORDINATOR',replacement:true,canView:true}});
assert.match(replacement,/Confirmed Panel|Replacement pending|Awaiting Coordinator approval/);
assert.doesNotMatch(replacement,/aria-label="Replace Panel"|>Recommend Panel</);
const unknown=show();
assert.match(unknown,/Panel information unavailable/);
assert.doesNotMatch(unknown,/Recommend Panel|Replace Panel/);
const workspace={teams:[{studentId:1,matricNo:'PG1',studentName:'Student One',programme:'Computing',studentStatus:'ACTIVE',primarySupervisor:{id:1,name:'Supervisor'},primaryAppointmentId:2,research:{title:'Research',area:'Area',abstract:'Abstract'},appointments:[],nominations:[],canNominate:false,studentEmail:'student@example.test',panel:{...base,current,canRecommend:false,canReplace:true}}],appointments:[],nominations:[]};
const detail=(role:'Lecturer'|'Office Staff/Admin'|'Programme Coordinator')=>render(<SupervisoryTeamRouteContent workspace={workspace} role={role} view="detail" routeStudentId="PG1" busy={false} search="" page={1} onSearch={()=>{}} onPage={()=>{}} onNominate={()=>{}} onEnd={()=>{}} onReplace={()=>{}} onNominationAction={()=>{}} onNavigateToDossier={()=>{}} onNavigateToPanelRequest={()=>{}} onNavigateToPanelRecommendation={()=>{}}/>);
const lecturer=detail('Lecturer');
assert.ok(lecturer.indexOf('View student record')<lecturer.indexOf('>Programme<'),'Student-record navigation sits in the identity header');
assert.match(lecturer,/Student email<\/dt>[\s\S]*mailto:student@example.test/);
assert.doesNotMatch(lecturer,/Contact details/,'A single email is visible without a collapsed disclosure');
assert.match(lecturer,/Replace Panel/);
for(const role of ['Office Staff/Admin','Programme Coordinator'] as const){assert.match(detail(role),/Confirmed Panel|View Panel details/);assert.doesNotMatch(detail(role),/aria-label="Replace Panel"|>Recommend Panel</,'Passing a callback cannot grant staff nomination permission');}
console.log('Panel summary follows confirmed, pending, replacement and unavailable states');

for (const plain of [true,false]) {
  const pendingHtml=render(<SupervisionPanelSummary plain={plain} panel={{...base,canRecommend:false,pending:{id:10,status:'SUBMITTED_TO_PANEL',replacement:false,canView:true,member:{id:21,name:'Proposed Panel'}}}} busy={false} onViewRequest={()=>{}}/>);
  assert.match(pendingHtml,/Proposed Panel/);
  assert.match(pendingHtml,/Awaiting Panel/);
  assert.match(pendingHtml,/View recommendation/);
  assert.doesNotMatch(pendingHtml,/Panel not appointed|No Panel assigned|Not appointed/);
  const emptyHtml=render(<SupervisionPanelSummary plain={plain} panel={base} busy={false}/>);
  assert.equal((emptyHtml.match(/Panel not appointed/g)||[]).length,1);
  assert.doesNotMatch(emptyHtml,/No Panel assigned/);
}
console.log('Pending Panel nomination occupies the member section without contradictory empty states');
