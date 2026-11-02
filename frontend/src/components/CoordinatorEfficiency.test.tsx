import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoordinatorFiltersBar } from './CoordinatorBrowsePrimitives';
import { CoordinatorRequestTable, CoordinatorSupervisorTable, CoordinatorAppointmentHistoryTable, CoordinatorTeamViewSwitch, CoordinatorTeamsToolbar } from './CoordinatorSupervisorWorkspace';
const noop = () => {};
const request = renderToStaticMarkup(<CoordinatorRequestTable rows={[{key:'primary-7',id:7,kind:'primary',studentName:'Student Seven',matricNo:'PG007',programme:'Computing',candidateName:'Dr Proposed',status:'PENDING_COORDINATOR',submittedAt:'2026-10-10',waitingDays:3,canDecide:true,carryover:true}]} history={false} onOpen={noop} onCarryover={noop} />);
assert.match(request, /Dr Proposed|Proposed supervisor/);
assert.match(request, /Current stage/);
assert.match(request, /Waiting at this stage/);
assert.match(request, /Carryover/);
assert.doesNotMatch(request, /SV-REQ-00007|<details|<textarea/);
const groups = renderToStaticMarkup(<CoordinatorSupervisorTable rows={[{id:7,name:'Dr Same Name',staffNo:'STAFF007',primaryCount:12,supportingCount:4},{id:8,name:'Dr Same Name',staffNo:'STAFF008',primaryCount:2,supportingCount:1}]} onOpen={noop} />);
assert.equal((groups.match(/View students/g) ?? []).length, 2, 'Same-name supervisors remain distinct groups');
assert.match(groups, /Primary students|Supporting students|STAFF007|STAFF008/);
const history = renderToStaticMarkup(<CoordinatorAppointmentHistoryTable rows={[{key:'supporting-2',id:2,kind:'supporting',studentName:'Former Student',matricNo:'PG009',programme:'Computing',supervisorName:'Former Supervisor',appointmentDate:'2025-10-01',endedAt:'2026-09-01',outcome:'REPLACED',applicationId:null,studentId:9}]} onOpen={noop} />);
assert.match(history, /Former Supervisor|Started|Ended|Replaced|View appointment/);
assert.doesNotMatch(history, /Approve|End appointment|<details/);
console.log('Coordinator compact request, distinct supervisor-group and ended-history tables pass');

const advancedFilters = renderToStaticMarkup(<CoordinatorFiltersBar history filters={{q:'',programme:'',semester:'',type:'all',status:'',from:'',to:'',sort:'newest',setPage:noop,setStatus:noop,setFrom:noop,setTo:noop,setSort:noop,change:callback=>callback,setQ:noop,setProgramme:noop,setSemester:noop,setType:noop,reset:noop}} facets={{programmes:[],semesters:[],statuses:['APPROVED']}}/>);
for (const label of ['All managed programmes','Semester','Sort by','Clear filters','Status','Outcome on or after','Outcome on or before']) assert.ok(advancedFilters.includes(label));
const outcomeHistory = renderToStaticMarkup(<CoordinatorRequestTable rows={[{key:'primary-9',id:9,kind:'primary',studentName:'Historical student',matricNo:'PG009',programme:'Computing',candidateName:'Dr Proposed',status:'REJECTED_BY_COORDINATOR',submittedAt:'2026-09-01',decidedAt:'2026-10-12',waitingDays:null,canDecide:false,carryover:false}]} history onOpen={noop} onCarryover={noop}/>);
assert.match(outcomeHistory,/Outcome recorded|12 Oct 2026/);
assert.doesNotMatch(outcomeHistory,/01 Sep 2026/);
assert.match(outcomeHistory,/<th[^>]*>Outcome<\/th>/);
assert.doesNotMatch(outcomeHistory,/Waiting at this stage/);
assert.doesNotMatch(outcomeHistory,/Not applicable|>—<\/td>/);

assert.doesNotMatch(advancedFilters,/More filters|Needs your decision|All ongoing/);
const {getCoordinatorRequests} = await import('../services/coordinatorWorkspaceApi');
let queriedFocus: string | null = null;
globalThis.fetch = async (input: any) => {queriedFocus = new URL(String(input),'http://localhost').searchParams.get('focus');return new Response(JSON.stringify({results:[],total:0,page:1,pageSize:10,pageCount:1,facets:{programmes:[],semesters:[],statuses:[]}}),{status:200,headers:{'Content-Type':'application/json'}});};
await getCoordinatorRequests({view:'requests',focus:'all'});
assert.equal(queriedFocus,'decision','Requests always reads only the Coordinator decision queue');

const teamSwitch = renderToStaticMarkup(<CoordinatorTeamViewSwitch view="history" onChange={noop}/>);
assert.match(teamSwitch,/Current teams|Past appointments|aria-pressed="true"/);
assert.doesNotMatch(teamSwitch,/Appointment history|bg-brand-navy text-white/);

const teamToolbar = renderToStaticMarkup(<CoordinatorTeamsToolbar view="requests" onChange={noop}/>);
assert.doesNotMatch(teamToolbar,/Group by|<select|By student/);
assert.equal((teamToolbar.match(/aria-label="Supervision views"/g) ?? []).length,1);
