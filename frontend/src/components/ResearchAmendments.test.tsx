import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as research from './ResearchAmendments';
const { ResearchAmendmentCard, ResearchAmendmentForm, ResearchRevisionCard } = research;
const row: any = { createdAt: '2026-10-09T08:00:00Z', id: 1, kind: 'TRANSFER', status: 'PENDING_SOURCE_COORDINATOR', studentName: 'Student One', matricNo: 'M123', sourceProgramme: 'Old programme', destinationProgramme: 'New programme', before: {title:'Old title',abstract:'Old abstract',programme:'Old programme'}, after: {title:'New title',abstract:'New abstract',programme:'New programme'}, reason:'Changed research focus', stageLabel:'Source coordinator review', canDecide:false, canCancel:false, teamSnapshot:{primary:{appointmentId:1,userId:21,name:'Saved Primary Supervisor'},coSupervisors:[{appointmentId:2,userId:22,name:'Saved Co-supervisor'}],panel:[{appointmentId:3,userId:23,name:'Saved Panel Member'}]}, unfinishedTaskCount:2, events:[] };
const render = (value: any) => renderToStaticMarkup(<ResearchAmendmentCard row={value} busy={false} onAction={() => {}} />);
const readonly = render(row);
for (const name of ['Saved Primary Supervisor','Saved Co-supervisor','Saved Panel Member']) assert.ok(readonly.includes(name),'Staff transfer details retain the immutable team snapshot');
assert.match(readonly, /Old title/);
assert.match(readonly, /New title/);
assert.match(readonly, /Source [Cc]oordinator/);
assert.match(readonly, /2 unfinished/);
assert.doesNotMatch(readonly, />Approve request</);
assert.doesNotMatch(readonly, />Cancel request</);
assert.match(render({...row,canDecide:true}), />Approve request</);
assert.match(render({...row,canCancel:true}), />Cancel request</);
console.log('Research amendment capability rendering passed');

for (const roleProps of [{studentView:true},{lecturerView:true},{}]) {
  const detail = renderToStaticMarkup(<ResearchAmendmentCard row={row} {...roleProps} presentation="detail" busy onAction={()=>{}} onViewProfile={()=>{}} />);
  assert.equal(detail.split('View research profile').length-1,1,'Each role gets one profile navigation action');
  const overview = detail.split('Requested changes')[0];
  assert.match(overview, /<h2[^>]*>Request overview<\/h2>/);
  assert.match(overview, /<button[^>]*disabled[^>]*>[\s\S]*?View research profile[\s\S]*?<\/button>/, 'Profile navigation remains in the overview and respects busy state');
}

const studentRow = { ...row, kind: 'RESEARCH', createdAt: '2026-10-09T08:00:00Z', before: {title:'Same title',abstract:'Old abstract',programme:'Same programme'}, after: {title:'Same title',abstract:'New abstract',programme:'Same programme'}, canDecide:true, canCancel:true };
const student = renderToStaticMarkup(<ResearchAmendmentCard row={studentRow} busy={false} studentView onAction={() => {}} />);
assert.match(student, /Abstract change/);
assert.match(student, /<details><summary[^>]*>View details<\/summary>/);
assert.match(student, /Old abstract/);
assert.match(student, /New abstract/);
assert.doesNotMatch(student, /Same title|>Approve request<|>Reject request<|unfinished evaluation/);
assert.match(student, />Cancel request</);
const studentTransfer = renderToStaticMarkup(<ResearchAmendmentCard row={{...row, createdAt: studentRow.createdAt}} busy={false} studentView onAction={() => {}} />);
assert.doesNotMatch(studentTransfer, /unfinished evaluation|>Approve</);
console.log('Student research requests show changed fields and preserve cancellation without staff controls');

const historyRow = {...studentRow, canCancel:false, events:[{id:3,action:'SUBMITTED',actorName:'Student One',actorRole:'Student',previousStatus:'',newStatus:'PENDING_SUPERVISOR',retainTeam:false,createdAt:studentRow.createdAt,reason:'Submitted explanation'}]};
assert.match(renderToStaticMarkup(<ResearchAmendmentCard row={historyRow} studentView busy={false} onAction={() => {}} />), /Approval progress|Submitted explanation|Student One/);
assert.doesNotMatch(renderToStaticMarkup(<ResearchAmendmentCard row={historyRow} studentView busy={false} onAction={() => {}} />), />Cancel request</);
const formOptions = { students:[],programmes:[],profile:{studentId:7,revision:1,title:'Current title',abstract:'Current abstract',programme:'Current programme'},canSubmitResearch:true,canCorrect:false,canTransfer:false };
const studentForm = renderToStaticMarkup(<ResearchAmendmentForm options={formOptions} busy={false} studentView onSave={() => {}} />);
assert.match(studentForm, /Research title|Research abstract|Submit request/);
assert.doesNotMatch(studentForm, /<select|Change type/);
assert.match(studentForm, /primary supervisor makes the final decision/i);
assert.doesNotMatch(studentForm, /programme coordinator makes the final decision/i);
assert.match(renderToStaticMarkup(<ResearchAmendmentForm options={formOptions} busy={false} onSave={() => {}} />), /<select|Change type/);
assert.equal(renderToStaticMarkup(<ResearchAmendmentForm options={{...formOptions,canSubmitResearch:false}} busy={false} studentView onSave={() => {}} />), '');
console.log('Student research form respects submission capability and omits the single-option selector');

const initialRevision = { id: 1, revision: 0, kind: 'BASELINE' as const, before: {programme:'',title:'',abstract:''}, after: {programme:'Original programme',title:'Original title',abstract:'Original abstract'}, actorName:'Initial record',createdAt:'2026-10-09T08:00:00Z',reason:'',requestId:null };
const renderRevision = (revision: typeof initialRevision | (Omit<typeof initialRevision, 'kind'> & {kind:'RESEARCH'}), studentView = true) => renderToStaticMarkup(<ResearchRevisionCard revision={revision} studentView={studentView} />);
const initialHistory = renderRevision(initialRevision);
assert.match(initialHistory, /Initial record|Programme|Title|Abstract|Malaysia/);
assert.doesNotMatch(initialHistory, /Previously|Recorded|Not recorded/);
for (const value of ['Original programme','Original title','Original abstract']) assert.equal(initialHistory.split(value).length - 1, 1);
const revisedHistory = renderRevision({...initialRevision,id:2,revision:1,kind:'RESEARCH',before:initialRevision.after,after:{...initialRevision.after,title:'Approved title'},actorName:'Coordinator',reason:'Clarify scope',requestId:1});
assert.match(revisedHistory, /Revision 1|Recorded before this revision|Recorded after revision|Original title|Approved title|Coordinator|Clarify scope/);
assert.doesNotMatch(revisedHistory, /Original programme|Original abstract/);
assert.equal(initialHistory.match(/<article class="([^"]+)"/)?.[1],revisedHistory.match(/<article class="([^"]+)"/)?.[1]);
assert.match(renderRevision(initialRevision,false), /Initial record|Original title/);
assert.doesNotMatch(renderRevision(initialRevision,false), /Proposed|before this revision/);
assert.match(renderRevision({...initialRevision,after:{...initialRevision.after,abstract:''}}), /Not recorded/);
console.log('Initial Student profile appears once; later revisions compare changed fields with consistent cards and preserved staff history');

// A routed list must omit the comparison and audit data entirely, including hidden details.
for (const role of ['Student', 'Lecturer'] as const) {
  const props = { row: historyRow, busy: false, studentView: role === 'Student', lecturerView: role === 'Lecturer', onAction: () => {} };
  const list = renderToStaticMarkup(<ResearchAmendmentCard {...props} presentation="list" onViewRequest={() => {}} />);
  assert.match(list, role === 'Lecturer' && historyRow.canDecide ? /Review request/ : /View request/);
  assert.doesNotMatch(list, /Old abstract|New abstract|Changed research focus|Submitted explanation|Approval history|<details|Cancel request|>Approve</);
  const detail = renderToStaticMarkup(<ResearchAmendmentCard {...props} presentation="detail" />);
  for (const value of ['Old abstract', 'New abstract', 'Changed research focus', 'Submitted explanation', 'Approval progress']) assert.ok(detail.includes(value), `Detail includes ${value}`);
  assert.doesNotMatch(detail, /<summary[^>]*>View details/);
}
console.log('Routed research lists omit comparison and audit content; details render it directly');

const staffList = renderToStaticMarkup(<ResearchAmendmentCard row={historyRow} busy={false} presentation="list" onAction={() => {}} onViewRequest={() => {}} />);
assert.match(staffList, /View request|Review request/);
assert.doesNotMatch(staffList, /Old abstract|New abstract|Submitted explanation/, 'Staff research summaries also keep comparisons in the dedicated record');

const lecturerCard = renderToStaticMarkup(<ResearchAmendmentCard row={{...studentRow, status:'PENDING_SUPERVISOR', canDecide:true}} lecturerView busy={false} presentation="list" onAction={() => {}} onViewRequest={() => {}} />);
const lecturerDetail = renderToStaticMarkup(<ResearchAmendmentCard row={{...studentRow, status:'PENDING_SUPERVISOR', canDecide:true}} lecturerView busy={false} presentation="detail" onAction={() => {}} />);
assert.match(lecturerDetail, />Approve request</);
assert.doesNotMatch(lecturerDetail, />Endorse request</);
assert.ok(lecturerCard.indexOf('Student One') < lecturerCard.indexOf('Abstract change'), 'Research summaries lead with the student, then the request type');
assert.match(lecturerCard, /09 Oct 2026/);
assert.match(lecturerCard, /Awaiting Supervisor review/);
assert.match(lecturerCard, /Review request/);
assert.doesNotMatch(lecturerCard, /Waiting at this stage:/);

assert.ok('ResearchAmendmentRouteContent' in research, 'Routed research content can render loaded requests and profiles');
const renderRoute = (overrides: Partial<React.ComponentProps<typeof research.ResearchAmendmentRouteContent>> = {}) => renderToStaticMarkup(React.createElement(research.ResearchAmendmentRouteContent, {
  routeView: 'list', role: 'Student', options: formOptions, rows: [historyRow, { ...historyRow, id: 2, reason: 'Other request reason' }], revisions: [initialRevision], busy: false, onAction: () => {}, onNavigateToRequest: () => {}, onNavigateToProfile: () => {}, onNavigateToNew: () => {}, requestForm: <p>Permitted request form</p>, ...overrides,
}));
assert.doesNotMatch(renderRoute(), /Current research profile|Current title|View research profile|Request research change/, 'Request results exclude the separate current-profile card');
const profileCard=renderToStaticMarkup(<research.StudentResearchProfileCard options={formOptions} hasPending={false} onNavigateToProfile={()=>{}} onNavigateToNew={()=>{}}/>);
for (const value of ['Current title','View research profile','Request research change']) assert.ok(profileCard.includes(value),`Separate profile retains ${value}`);
assert.doesNotMatch(profileCard,/Current abstract|Find a request|No research change requests/);
const pendingProfileCard=renderToStaticMarkup(<research.StudentResearchProfileCard options={{...formOptions,canSubmitResearch:false}} hasPending/>);
assert.match(pendingProfileCard,/research change awaiting a decision/);
assert.doesNotMatch(pendingProfileCard,/>Request research change</);
assert.doesNotMatch(renderRoute(), /Current abstract|Original abstract|Old abstract|New abstract|Submitted explanation/);
const requestDetail = renderRoute({ routeView: 'detail', routeRequestId: '1' });
for (const value of ['Old abstract', 'New abstract', 'Approval progress', 'Submitted explanation']) assert.ok(requestDetail.includes(value), `Request detail includes ${value}`);
assert.doesNotMatch(requestDetail, /Other request reason|>Original abstract<\/dd>|Request research change/);
assert.match(renderRoute({ routeView: 'detail', routeRequestId: '999' }), /Request not found/);
assert.ok(renderRoute({ routeView: 'profile' }).includes('Current abstract'), 'Current profile remains visible');
assert.doesNotMatch(renderRoute({ routeView: 'profile' }), /Original abstract|Research profile history/, 'History is separate from the current-profile content');
assert.doesNotMatch(renderRoute({ routeView: 'profile' }), /Submitted explanation|Other request reason/);
assert.match(renderRoute({ routeView: 'new' }), /Permitted request form/);
assert.doesNotMatch(renderRoute({ routeView: 'new', options: { ...formOptions, canSubmitResearch: false } }), /Permitted request form/);
assert.doesNotMatch(renderRoute({ routeView: 'new', role: 'Lecturer' }), /Permitted request form/);
assert.match(renderRoute({ routeView: 'profile', role: 'Lecturer', options: { ...formOptions, profile: null, students: [{ id: 7, name: 'Student One', matricNo: 'M123', programme: 'Current programme' }] } }), /Select a student/);
assert.match(renderRoute({ rows: [] }), /No research change requests/);
console.log('Routed research views isolate request detail, current profile history and permitted Student form');

const researchQueue = [
  { ...historyRow, id: 10, studentName: 'Awaiting Lecturer Student', status: 'PENDING_SUPERVISOR', canDecide: true },
  { ...historyRow, id: 11, studentName: 'Awaiting Coordinator Student', status: 'PENDING_COORDINATOR', canDecide: false },
  { ...historyRow, id: 12, studentName: 'Final Outcome Student', status: 'APPROVED', canDecide: false },
];
const lecturerRequests = renderRoute({ role: 'Lecturer', rows: researchQueue, requestView: 'requests' });
assert.match(lecturerRequests, /<table/);
assert.match(lecturerRequests, /<th[^>]*>Waiting at this stage<\/th>/);
assert.doesNotMatch(lecturerRequests, /Research request #| · Waiting/, 'Research request lists omit references and separate stage from age');
assert.equal((lecturerRequests.match(/<table/g)||[]).length,1);
assert.doesNotMatch(lecturerRequests, /Other ongoing requests|<h3[^>]*>Needs your review/);
assert.doesNotMatch(lecturerRequests, />Awaiting Coordinator approval</, 'Legacy research requests await the primary Supervisor');
const researchFilters = renderToStaticMarkup(<research.CoordinatorResearchFilters
  query={{}} onFilter={() => {}}
  pagination={{ total: 1, page: 1, pageSize: 10, pageCount: 1, reviewCount: 0,
    facets: { programmes: [], semesters: [], statuses: ['PENDING_SUPERVISOR', 'PENDING_COORDINATOR'] } }}
/>);
assert.doesNotMatch(researchFilters, /Awaiting Coordinator approval|supervisor endorsement/);
assert.match(researchFilters, /Awaiting Supervisor review/);
assert.match(lecturerRequests, /Awaiting Lecturer Student|Awaiting Coordinator Student/);
assert.doesNotMatch(lecturerRequests, /Final Outcome Student/);
assert.doesNotMatch(lecturerRequests, /Current research profile/, 'Profiles do not displace the Lecturer review queue');
const lecturerHistory = renderRoute({ role: 'Lecturer', rows: researchQueue, requestView: 'history' });
assert.match(lecturerHistory, /Final Outcome Student/);
assert.doesNotMatch(lecturerHistory, /Awaiting Lecturer Student|Awaiting Coordinator Student/);
assert.match(lecturerHistory, /<th[^>]*>Outcome<\/th>/);
assert.doesNotMatch(lecturerHistory, /Waiting at this stage|Final request outcomes/);
const manyResearchRows = Array.from({ length: 26 }, (_, index) => ({ ...researchQueue[0], id: 100 + index, studentName: `Paged research student ${index}` }));
assert.equal((renderRoute({ role: 'Lecturer', rows: manyResearchRows, requestPageSize: 25 }).match(/>Review request</g) ?? []).length, 25);
const lastResearchPage = renderRoute({ role: 'Lecturer', rows: manyResearchRows, requestPageSize: 25, requestPage: 2 });
assert.equal((lastResearchPage.match(/>Review request</g) ?? []).length, 1);
assert.match(lastResearchPage, /Paged research student 25/);
assert.doesNotMatch(lastResearchPage, /Paged research student 0</);

for (const [routeView, title] of [['detail', 'Research change request'], ['profile', 'Research profile'], ['new', 'Request research change']] as const) {
  const shell = renderToStaticMarkup(<research.ResearchAmendments role="Student" routeView={routeView} routeRequestId="1" onNavigateToList={() => {}} />);
  assert.match(shell, new RegExp(`<h2[^>]*>${title}</h2>`));
  assert.match(shell, /Back to research changes/);
}
const staffShell = renderToStaticMarkup(<research.ResearchAmendments role="Office Staff/Admin" />);
assert.match(staffShell, /Research amendments and programme transfers/);
assert.doesNotMatch(staffShell, /Back to research changes/);
for (const role of ['Office Staff/Admin', 'Programme Coordinator'] as const) {
  const shell = renderToStaticMarkup(<research.ResearchAmendments role={role} routeView="detail" routeRequestId="1" />);
  assert.match(shell, /<h2[^>]*>Research change request<\/h2>/);
  assert.match(shell, /Back to research changes/);
  assert.doesNotMatch(shell, /Research amendments and programme transfers<\/h2>/);
  const detail = renderRoute({ role, routeView: 'detail', routeRequestId: '1' });
  assert.match(detail, /Old abstract|New abstract|Submitted explanation/);
  assert.doesNotMatch(detail, /Other request reason/);
  assert.doesNotMatch(renderRoute({ role, routeView: 'new' }), /Permitted request form/, 'Staff cannot create through Student submission capability');
  assert.match(renderRoute({ role, routeView: 'new', options: { ...formOptions, canSubmitResearch: false, canTransfer: true } }), /Permitted request form/);
}
console.log('Routed research shells isolate staff records and preserve role-specific creation capabilities; default staff remains embedded');
for (const query of ['Abstract change', 'Research request #10', 'Research amendment #10', 'Request #10']) {
  const result = renderRoute({ role: 'Office Staff/Admin', rows: researchQueue, requestSearch: query });
  assert.match(result, /Awaiting Lecturer Student/, `Office search recognises the displayed type/reference: ${query}`);
}
assert.doesNotMatch(renderRoute({ role: 'Office Staff/Admin', rows: researchQueue, requestSearch: 'No matching synthetic person' }), /Awaiting Lecturer Student|Awaiting Coordinator Student/);

// The live profile must never replace either immutable request snapshot.
const snapshotRequest = {...historyRow, canDecide:false, canCancel:false, status:'APPROVED', before:{programme:'Same programme',title:'Saved original title',abstract:'Saved original abstract'},after:{programme:'Same programme',title:'Saved requested title',abstract:'Saved requested abstract'},events:[{...historyRow.events[0],action:'SUBMIT',actorName:'Office Transfer Initiator',actorRole:'Office Staff/Admin'}, {id:4,action:'APPROVE',actorName:'Primary Supervisor',actorRole:'Lecturer',previousStatus:'PENDING_SUPERVISOR',newStatus:'APPROVED',createdAt:'2026-10-10T08:00:00Z',reason:'Approval decision note',retainTeam:false}]};
const approvedSnapshot = renderRoute({routeView:'detail',routeRequestId:'1',rows:[snapshotRequest],options:{...formOptions,profile:{...formOptions.profile,title:'Later live profile title'}}});
for (const text of ['Saved original title','Saved requested title','Before this request','Approved title','Applied on approval','Approval decision note']) assert.ok(approvedSnapshot.includes(text));
assert.equal(approvedSnapshot.split('<details')[0].split('Approval decision note').length - 1,1,'The approval note appears once in visible progress, with its complete audit copy collapsed');
assert.doesNotMatch(approvedSnapshot,/Later live profile title|>Approved<|>Proposed</);
for (const status of ['PENDING_SUPERVISOR','REJECTED','CANCELLED'] as const) {
  const html=renderRoute({routeView:'detail',routeRequestId:'1',rows:[{...snapshotRequest,status,events:[snapshotRequest.events[0],...(status.startsWith('PENDING')?[]:[{...snapshotRequest.events[1],action:status==='REJECTED'?'REJECT':'CANCEL',newStatus:status,reason:`${status} decision reason`}])]}]});
  assert.doesNotMatch(html,/Not applied|Saved values from this request/);
  assert.doesNotMatch(html,/Approved and applied/);
  assert.match(html,/Saved original title|Saved requested title/);
  assert.doesNotMatch(html,/>Approve request<|>Reject request<|>Cancel request</,'Presentation preserves server capabilities for read-only records');
  if (!status.startsWith('PENDING')) {
    assert.ok(html.indexOf(`${status} decision reason`) < html.indexOf('<details'), 'Terminal reason remains visible before the collapsed audit');
    assert.equal(html.split('<details')[0].split(`${status} decision reason`).length - 1,1,'A rejection or cancellation reason appears once in visible progress');
  }
}
assert.deepEqual(research.researchRequestMetadata(snapshotRequest),{reference:'Research request #1',submittedAt:'2026-10-09T08:00:00Z',submittedBy:'Office Transfer Initiator · Office Staff/Admin',statusLabel:historyRow.stageLabel,statusTone:'success'});
assert.equal(research.researchRequestMetadata({...snapshotRequest,events:[]}).submittedBy,'Not recorded','A missing submission event does not falsely attribute an Office request to the student');
assert.equal(research.researchRequestMetadata(historyRow).submittedBy,'Student One · Student','Historical SUBMITTED events retain attribution');
assert.equal(research.researchRequestMetadata({...snapshotRequest,kind:'TRANSFER'}).reference,'Programme transfer #1','Transfer metadata identifies the actual request kind');

const legacyResearch = renderRoute({role:'Lecturer',routeView:'detail',routeRequestId:'1',rows:[{...snapshotRequest,status:'REJECTED',events:[snapshotRequest.events[0],{id:8,action:'ENDORSE',actorName:'Earlier Supervisor',actorRole:'Lecturer',previousStatus:'PENDING_SUPERVISOR',newStatus:'PENDING_COORDINATOR',reason:'Earlier endorsement',createdAt:'2026-10-10T08:00:00Z',retainTeam:false},{id:9,action:'REJECT',actorName:'Legacy Coordinator',actorRole:'Programme Coordinator',previousStatus:'PENDING_COORDINATOR',newStatus:'REJECTED',reason:'Legacy rejection reason',createdAt:'2026-10-11T08:00:00Z',retainTeam:false}]}]});
assert.match(legacyResearch,/Historical recorded review/,'Legacy research decisions preserve the stored review without inferring authority from account role');
assert.match(legacyResearch,/Legacy Coordinator · Programme Coordinator/);
assert.ok(legacyResearch.indexOf('Legacy rejection reason')<legacyResearch.indexOf('<details'));

const correction=renderToStaticMarkup(<ResearchRevisionCard revision={{...initialRevision,id:9,revision:2,kind:'CORRECTION',before:initialRevision.after,after:{...initialRevision.after,title:'Typographical correction'},actorName:'Office Editor',reason:'Meaning unchanged'}} />);
assert.match(correction,/Correction|Recorded before this revision|Recorded after revision|Office Editor|Typographical correction/);
assert.doesNotMatch(correction,/Requested change|Approval progress|Approved and applied|Not applied/,'A saved typographical correction is a revision, not an approval request');
console.log('Research snapshots retain actual submitter and application outcome; profile corrections remain revisions');
