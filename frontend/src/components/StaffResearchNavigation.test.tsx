import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {StaffResearchWorkspace} from './StaffResearchWorkspace';
import {SupervisorWorkspaceNavigation} from './SupervisorWorkspaceNavigation';
import {CoordinatorResearchFilters} from './ResearchAmendments';
import {getResearchAmendmentsPage,coordinatorTransferQuery} from '../services/researchAmendmentsApi';

const currentLinkText = (html: string) => (html.match(/<a\b[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '').replace(/<[^>]*>/g, '').trim();

const route='/supervisor-appointments/research-changes';
const render=(role:'Programme Coordinator'|'Office Staff/Admin',view:'list'|'detail'='list')=>renderToStaticMarkup(
  <MemoryRouter initialEntries={[route+'?type=RESEARCH&status=PENDING_COORDINATOR']}><StaffResearchWorkspace role={role} routeView={view} onNavigateToProfile={()=>{}}/></MemoryRouter>);
const coordinator=render('Programme Coordinator');
assert.equal(currentLinkText(coordinator), '');
assert.match(coordinator, /Loading programme transfers/);
assert.doesNotMatch(coordinator, /Title change|Abstract change|Research changes/);
const office = render('Office Staff/Admin');
assert.match(office, /Research records/);
assert.match(office, /<button[^>]*bg-brand-navy[^>]*min-h-11[^>]*><svg[\s\S]*?<span>Research profiles<\/span><\/button>/);
assert.doesNotMatch(coordinator, /Research profiles/);
assert.match(render('Office Staff/Admin','detail'), /Back to Research records/);
assert.doesNotMatch(render('Office Staff/Admin','detail'), /Research profiles/);
for(const role of ['Student','Lecturer'] as const) {
  const nav=renderToStaticMarkup(<MemoryRouter initialEntries={[route]}><SupervisorWorkspaceNavigation role={role}/></MemoryRouter>);
  assert.equal(currentLinkText(nav),'Research changes');
}
const filters=renderToStaticMarkup(<CoordinatorResearchFilters query={{type:'TRANSFER'}} transferOnly pagination={{total:0,page:1,pageSize:10,pageCount:1,reviewCount:0,facets:{programmes:[],semesters:[],statuses:['PENDING_SUPERVISOR','PENDING_COORDINATOR','PENDING_SOURCE_COORDINATOR','PENDING_DESTINATION_COORDINATOR']}}} onFilter={()=>{}}/>);
assert.doesNotMatch(filters,/Title change|Abstract change|Request type/);
assert.doesNotMatch(filters,/Awaiting Supervisor review|value="PENDING_SUPERVISOR"|value="PENDING_COORDINATOR"/);
assert.match(filters,/value="PENDING_SOURCE_COORDINATOR"/);
for(const status of ['PENDING_SUPERVISOR','PENDING_COORDINATOR']) assert.equal(coordinatorTransferQuery({status,type:'RESEARCH'}).status,'');
assert.equal(coordinatorTransferQuery({status:'PENDING_DESTINATION_COORDINATOR'}).status,'PENDING_DESTINATION_COORDINATOR');
const urls:string[]=[];
globalThis.fetch=async(input:any)=>{
  urls.push(String(input));
  return new Response(JSON.stringify({requests:[],revisions:[]}),{status:200,headers:{'Content-Type':'application/json'}});
};
for(const view of ['requests','history'] as const) {
  await getResearchAmendmentsPage({type:'RESEARCH',focus:'all',view,q:'M123',page:2,size:25});
  const params=new URL(urls.at(-1)!,'http://localhost').searchParams;
  assert.equal(params.get('type'),'TRANSFER','Old research filters cannot broaden the transfer workspace');
  assert.equal(params.get('focus'),'decision');
  assert.equal(params.get('q'),'M123');
  assert.equal(params.get('page'),'2');
  assert.equal(params.get('view'),view);
}
await getResearchAmendmentsPage({type:'RESEARCH'},true);
assert.equal(new URL(urls.at(-1)!,'http://localhost').searchParams.get('type'),'RESEARCH','Office retains research monitoring');
console.log('Staff research navigation and transfer-only paging pass');
