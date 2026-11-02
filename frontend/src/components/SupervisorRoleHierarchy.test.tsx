import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { SupervisorWorkspaceNavigation } from './SupervisorWorkspaceNavigation';
import { WorkspaceRecordTable } from './RequestWorkspacePrimitives';
import { ResearchAmendmentRouteContent } from './ResearchAmendments';

const currentLinkText = (html: string) => (html.match(/<a\b[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '').replace(/<[^>]*>/g, '').trim();

for (const role of ['Office Staff/Admin', 'Programme Coordinator'] as const) {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/supervisor-appointments/supervisees']}><SupervisorWorkspaceNavigation role={role} /></MemoryRouter>);
  assert.equal(currentLinkText(html), 'Supervisory teams');
  assert.match(html, /Appointment requests/);
  assert.doesNotMatch(html, /Research changes/);
  if (role === 'Programme Coordinator') assert.match(html, /Programme transfers/);
  else assert.doesNotMatch(html, /Research records|Programme transfers/);
  assert.doesNotMatch(html, /My supervisees/);
}
const studentTable = renderToStaticMarkup(<WorkspaceRecordTable identityLabel="Supervisor" label="Applications" rows={[{ key:1, studentName:'Dr Example', matricNo:'', status:'Awaiting Supervisor review', waitingDays:2, actionLabel:'View request' }]} />);
assert.match(studentTable, /<th[^>]*>Supervisor<\/th>/);
assert.match(studentTable, /Dr Example/);
assert.match(studentTable, /Waiting at this stage/);

const options:any = {students:[],profile:{title:'Current title',abstract:'Current abstract',programme:'Programme',revision:1},canSubmitResearch:false,canCorrect:false,canTransfer:false};
const row:any = {id:1,kind:'RESEARCH',status:'PENDING_SUPERVISOR',studentName:'Ongoing student',matricNo:'M1',createdAt:'2026-10-10T00:00:00Z',before:{title:'Title',abstract:'Old',programme:'Programme'},after:{title:'Title',abstract:'New',programme:'Programme'},canDecide:false,canCancel:false,events:[]};
for (const role of ['Student','Office Staff/Admin','Programme Coordinator'] as const) {
  const render=(requestView:'requests'|'history')=>renderToStaticMarkup(<ResearchAmendmentRouteContent role={role} routeView="list" options={options} rows={[row,{...row,id:2,status:'REJECTED_BY_COORDINATOR',studentName:'Final student'}]} revisions={[]} busy={false} requestView={requestView} requestPageSize={10} onRequestPageSize={()=>{}} requestForm={null} onAction={()=>{}} />);
  assert.equal((render('requests').match(/<table/g)||[]).length,1);
  assert.equal((render('history').match(/<table/g)||[]).length,1);
  assert.doesNotMatch(render('requests'), /Other ongoing requests|<h3[^>]*>Needs your review/);
  assert.doesNotMatch(render('requests'), /Final student/);
  assert.doesNotMatch(render('history'), /Ongoing student/);
  assert.match(render('history'), /<th[^>]*>Outcome<\/th>/);
  assert.doesNotMatch(render('history'), /Waiting at this stage/);
  assert.doesNotMatch(render('requests'), /Old|>New<|>Approve</);
}
console.log('All roles share navigation, request tables and terminal research history without comparisons in lists');

const sharedDetail = {...row,reason:'Recorded submission reason',events:[{id:1,action:'SUBMITTED',actorName:'Office Initiator',actorRole:'Office Staff/Admin',previousStatus:'',newStatus:'PENDING_SUPERVISOR',createdAt:row.createdAt,reason:'Recorded submission reason'}]};
for (const role of ['Student','Lecturer','Office Staff/Admin','Programme Coordinator'] as const) {
  const html=renderToStaticMarkup(<ResearchAmendmentRouteContent role={role} routeView="detail" routeRequestId="1" options={options} rows={[sharedDetail]} revisions={[]} busy={false} requestForm={null} onAction={()=>{}} />);
  for (const text of ['Request overview','Requested changes','Before this request','Proposed abstract','Review and outcome','Approval progress','Audit history']) assert.ok(html.includes(text),`${role} uses shared research detail: ${text}`);
  assert.doesNotMatch(html,/Not applied|PENDING_SUPERVISOR|Copy reference/);
  assert.doesNotMatch(html,/Request #1|Research request #1/, 'The request reference belongs in the page metadata');
  assert.match(html,/Office Initiator/, 'The submitter is the recorded Office actor, not the student');
  assert.doesNotMatch(html,/Proposed \/ recorded after|>Previously<|>Proposed</);
}
console.log('Authorized research details share snapshot labels, progress and audit across roles');
