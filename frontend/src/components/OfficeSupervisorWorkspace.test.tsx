import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {OfficeSupervisorWorkspace,officeApplicationRecord} from './OfficeSupervisorWorkspace';
import {StaffSupervisorBrowseContext} from './StaffSupervisorBrowseContext';
import {CoordinatorRequestsBrowse} from './CoordinatorSupervisorWorkspace';
import {officeSupervisorApi} from '../services/staffSupervisorWorkspaceApi';
import {loadResearchAmendmentWorkspace} from '../services/researchAmendmentsApi';
import {ResearchAmendmentRouteContent} from './ResearchAmendments';
const noop=()=>{};
const page=renderToStaticMarkup(<MemoryRouter><OfficeSupervisorWorkspace routeView="list" requestsView/></MemoryRouter>);
for(const label of ['Needs attention','Appointment requests','Supervisory teams','Tools','Requests','History','All programmes','Clear filters','Capacity reassessments'])assert.ok(page.includes(label),label);
assert.doesNotMatch(page,/Needs your decision|All ongoing|More filters|Apply filters|Workload alerts|Records needing attention/);
assert.doesNotMatch(page,/Records administration/);
const landing=renderToStaticMarkup(<MemoryRouter><OfficeSupervisorWorkspace routeView="list"/></MemoryRouter>);
assert.match(landing,/Records needing attention|Without supervisor|Waiting requests|Workload concerns/);
assert.doesNotMatch(landing,/>History<|Records administration/);
const teams=renderToStaticMarkup(<MemoryRouter><OfficeSupervisorWorkspace routeView="teams"/></MemoryRouter>);
assert.match(teams,/Current teams|Past appointments/);
assert.doesNotMatch(teams,/Group by|Appointment history|By student/);
const urls:string[]=[];
globalThis.fetch=async(input:any)=>{urls.push(String(input));return new Response(JSON.stringify(String(input).includes('options')?{students:[],programmes:[],profile:null,canCorrect:false,canTransfer:false}: {results:[],requests:[],revisions:[],pagination:{total:0,page:1,pageSize:10,pageCount:1,reviewCount:0,facets:{programmes:[],semesters:[],statuses:[]}}}),{status:200,headers:{'Content-Type':'application/json'}});};
await officeSupervisorApi.requests({focus:'decision',q:'matric',page:2,size:25});
assert.ok(urls[0].includes('office-workspace/requests/'));
assert.equal(new URL(urls[0],'http://localhost').searchParams.get('focus'),'all');
urls.length=0;
await loadResearchAmendmentWorkspace({coordinator:false,office:true,routeView:'list',pageQuery:{page:2,q:'Abstract change'}});
assert.ok(urls.some(url=>url.includes('minimal=true')));
const query=new URL(urls.find(url=>url.includes('page=2'))!,'http://localhost').searchParams;
assert.equal(query.get('focus'),'all');assert.equal(query.get('q'),'Abstract change');
const row:any={id:1,studentId:'M1',studentName:'Student',programme:'Programme',status:'APPROVED',proposedSupervisor:'Supervisor',researchTitle:'Title',submittedAt:'2026-10-01',coordinatorDecisionAt:'2026-10-10',workflow:[],appointmentLifecycle:{appointmentId:9,status:'ENDED'}};
const converted=officeApplicationRecord(row);assert.equal(converted.status,'Ended');assert.equal(converted.applicationId,1);assert.equal(converted.appointmentId,9);assert.equal(converted.researchTopic,'Title');
const paged=renderToStaticMarkup(<StaffSupervisorBrowseContext.Provider value="Office Staff/Admin"><ResearchAmendmentRouteContent role="Office Staff/Admin" routeView="list" requestView="requests" options={{students:[],programmes:[],profile:null,canSubmitResearch:false,canCorrect:false,canTransfer:false}} rows={[{id:1,kind:'RESEARCH',status:'PENDING_SUPERVISOR',studentName:'Target',matricNo:'M1',before:{title:'Title',abstract:'Old',programme:'Programme'},after:{title:'Title',abstract:'New',programme:'Programme'},createdAt:'2026-10-01',updatedAt:'2026-10-02',canDecide:false,events:[]} as any]} revisions={[]} busy={false} onAction={noop} requestForm={null} requestSearch="already server filtered" requestPage={2} pagination={{total:12,page:2,pageSize:10,pageCount:2,reviewCount:0,facets:{programmes:[],semesters:[],statuses:[]}}}/></StaffSupervisorBrowseContext.Provider>);
assert.match(paged,/Target/);assert.match(paged,/Page 2 of 2 .* 12 requests/);assert.doesNotMatch(paged,/Approve request/);
console.log('Office shared structure, all-stage paged monitoring and lifecycle record handoff pass');

const profileTools=renderToStaticMarkup(<ResearchAmendmentRouteContent role="Office Staff/Admin" routeView="profile" options={{students:[],programmes:['Programme B'],profile:{studentId:7,title:'Title',abstract:'Abstract',programme:'Programme A',revision:1},canSubmitResearch:false,canCorrect:true,canTransfer:true}} rows={[]} revisions={[]} busy={false} onAction={noop} onNavigateToNew={noop} requestForm={null}/>);
assert.match(profileTools,/Correct research text/);
assert.doesNotMatch(profileTools,/Request programme transfer/);

const {officeResearchCreationParams}=await import('./LecturerResearchWorkspace');
const creation=officeResearchCreationParams(new URLSearchParams('profileStudent=7&q=kept&page=2'),7);
assert.equal(creation.get('student'),'7');assert.equal(creation.has('profileStudent'),false);assert.equal(creation.get('q'),'kept');

for(const kind of ['CORRECTION','TRANSFER'] as const){
  const target=officeResearchCreationParams(new URLSearchParams('profileStudent=7&q=kept&page=2&changeType=RESEARCH'),7,kind);
  assert.equal(target.get('changeType'),kind);assert.equal(target.get('student'),'7');assert.equal(target.get('q'),'kept');assert.equal(target.get('page'),'2');assert.equal(target.has('profileStudent'),false);
}
assert.equal(officeResearchCreationParams(new URLSearchParams('changeType=TRANSFER'),7).has('changeType'),false,'Legacy default creation cannot inherit a stale intent');
