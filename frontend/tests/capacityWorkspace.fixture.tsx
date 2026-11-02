import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {LecturerCapacityManagement} from '../src/components/LecturerCapacityManagement';
import {OfficeDashboardLayout} from '../src/components/OfficeDashboardLayout';
import {RecordPageProvider} from '../src/components/RecordPage';
import {RecordPage} from '../src/components/RecordPage';
import {CapacityReassessments} from '../src/components/CapacityReassessments';
import {createMemoryRouter,RouterProvider} from 'react-router';

const results:{name:string;error?:string}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const text=()=>document.body.textContent||'';
const until=async(predicate:()=>unknown)=>{for(let i=0;i<400;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error(`Timed out: ${text().slice(-700)}`);};
const buttons=()=>[...document.querySelectorAll<HTMLButtonElement>('button')].filter(node=>!node.closest('[hidden]'));
const click=async(label:string)=>{
 const draft=label.match(/^Continue draft v(\d+)$/);
 if(draft){
  const direct=buttons().find(button=>button.textContent?.trim()==='Continue editing');
  if(direct){direct.click();await new Promise(resolve=>setTimeout(resolve,20));return;}
  await click('Capacity versions');await until(()=>document.querySelector('[aria-label="Capacity versions"]'));
  const row=[...document.querySelectorAll('tbody tr')].find(node=>node.querySelector('strong')?.textContent===`Version ${draft[1]}`);
  check(row,`Missing draft ${draft[1]}`);row!.querySelector<HTMLButtonElement>('button')!.click();await new Promise(resolve=>setTimeout(resolve,20));return;
 }
 if(label==='Prepare limits'&&!buttons().some(node=>node.textContent?.trim()===label)){
  if(document.querySelector('h1')?.textContent!=='Capacity versions')await click('Capacity versions');
  await until(()=>buttons().some(node=>node.textContent?.trim()==='Start new draft'));label='Start new draft';
 }
 const node=buttons().find(button=>button.closest('dialog[open]')&&button.textContent?.trim()===label)??buttons().find(button=>button.textContent?.trim()===label);check(node,`Missing ${label}`);node!.click();await new Promise(resolve=>setTimeout(resolve,25));
};
const choose=async(id:string,label:string)=>{document.getElementById(id)!.click();await until(()=>document.querySelector('[role="listbox"]'));const option=[...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node=>node.textContent?.trim()===label);check(option,`Missing option ${label}`);option!.click();await new Promise(resolve=>setTimeout(resolve,20));};
const newDraft=async(source:string)=>{document.querySelector<HTMLInputElement>('input[name="capacity-preparation-mode"][value="new"]')!.click();await new Promise(resolve=>setTimeout(resolve,20));await choose('capacity-draft-source',source);};
const input=(node:HTMLInputElement,value:string)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));};
const scenario=async(name:string,work:()=>Promise<void>)=>{try{await work();results.push({name});}catch(error){results.push({name,error:String(error)});}};
const semester={id:9,label:'Semester I 2026/2027',code:'2026-S1',startsOn:'2026-09-01',endsOn:'2027-02-28',lifecycleStatus:'ACTIVE',isActive:true};
const archivedSemester={...semester,id:77,label:'Archived semester',code:'2028-S1',startsOn:'2028-09-01',endsOn:'2029-02-28',lifecycleStatus:'ARCHIVED',isActive:false};
let archiveCurrentSemester=false;
const role={semesterId:9,planId:1,planVersion:1,limit:5,activeLoad:2,reservedLoad:0,availableSlots:3,state:'AVAILABLE',unavailableUntil:null};
const roster=Array.from({length:27},(_,index)=>({id:index+1,lecturerId:index+1,staffNo:`STAFF-${String(index+1).padStart(2,'0')}`,lecturerName:`Synthetic Lecturer ${String(index+1).padStart(2,'0')}`,participantLifecycle:'ACTIVE',supervisorLimit:5,panelLimit:5,supervisor:role,panel:{...role,activeLoad:1,reservedLoad:1},activeStudentCount:3,primaryStudentCount:1,supportingStudentCount:1,panelStudentCount:1}));
const reassessment={id:7,kind:'SUPERVISOR',status:'PENDING_OFFICE',latestEventId:3,student:{id:8,name:'Student One',matricNo:'PG001',programme:'Computing'},candidate:{id:9,name:'Dr Candidate'},originalSemester:{id:1,label:'Previous semester',lifecycleStatus:'CLOSED'},originalCapacity:null,currentCapacity:null,authorization:null,history:[],canAuthorize:true,canRevoke:false};
function NestedReassessment(){const [busy,setBusy]=React.useState(false);return <RecordPage pageKey="office-capacity-record:SUPERVISOR:7" title="Capacity reassessment" backLabel="Back to capacity" onBack={()=>{}} busy={busy}><CapacityReassessments role="Office Staff/Admin" onBusyChange={setBusy}/></RecordPage>;}
const makePlan=(id:number,status:string,entries:typeof roster)=>({id,semesterId:9,semesterLabel:semester.label,semesterCode:semester.code,version:id,lifecycleStatus:status,isCurrentPublished:status==='PUBLISHED',origin:'CREATED',supersedesId:id>1?1:null,isComplete:entries.length===27,readinessErrors:roster.filter(row=>!entries.some(entry=>entry.lecturerId===row.lecturerId)).map(row=>`${row.staffNo}: capacity entry is required for this Lecturer.`),contentFingerprint:`fingerprint-${id}`,entries,createdAt:'2026-10-01T10:00:00Z',createdBy:{id:99,name:'Synthetic Office'},publicationReason:null});
let reads:URL[]=[];
let failAvailability=false;
const today=new Date().toISOString().slice(0,10);
const restrictions=Array.from({length:13},(_,index)=>({id:index+1,semesterId:9,lecturerId:index===12?2:1,lecturerName:index===12?'Synthetic Lecturer 02':'Synthetic Lecturer 01',staffNo:index===12?'STAFF-02':'STAFF-01',role:'SUPERVISOR',startsOn:today,endsOn:today,isEffective:true,isCancelled:false,reason:'Private research leave reason',createdBy:{id:99,name:'Synthetic Office'},createdAt:'2026-10-01T10:00:00Z',cancelledBy:null,cancelledAt:null,cancellationReason:null}));
restrictions.push({...restrictions[0],id:99,isEffective:false,isCancelled:true,reason:'Cancelled private reason'});
let holdEntryWrites=false,releaseEntryWrite:(()=>void)|null=null,entryFailure=0;
let holdBulk=false,releaseBulk:(()=>void)|null=null,bulkFailure=0;
let holdPublish=false,releasePublish:(()=>void)|null=null,publishFailure=0,failAfterPublish=false;
let holdCreate=false,releaseCreate:(()=>void)|null=null,failAfterCreate=false;
let holdClone=false,releaseClone:(()=>void)|null=null;
let plans=[makePlan(2,'DRAFT',roster.slice(0,1)),makePlan(1,'PUBLISHED',roster)],writes:{path:string;body:any}[]=[],failRoster=false,failDiscard=0,failAfterDiscard=false,root:Root|null=null,router:ReturnType<typeof createMemoryRouter>|null=null;
window.fetch=async(inputValue,init)=>{
  const url=new URL(String(inputValue),location.origin),path=url.pathname;
  if(init?.method&&init.method!=='GET'){
    const body=JSON.parse(String(init.body||'{}'));writes.push({path,body});
    if(path.endsWith('/capacity-plans/')){if(holdCreate)await new Promise<void>(resolve=>{releaseCreate=resolve;});const plan=makePlan(Math.max(...plans.map(row=>row.id))+1,'DRAFT',[]);plans=[plan,...plans];if(failAfterCreate)failRoster=true;return Response.json(plan,{status:201});}
    const cloneMatch=path.match(/capacity-plans\/(\d+)\/clone\//);
    if(cloneMatch){if(holdClone)await new Promise<void>(resolve=>{releaseClone=resolve;});const source=plans.find(row=>row.id===Number(cloneMatch[1]))!;const plan=makePlan(Math.max(...plans.map(row=>row.id))+1,'DRAFT',source.entries);plans=[plan,...plans];return Response.json(plan,{status:201});}
    const discardMatch=path.match(/capacity-plans\/(\d+)\/discard\//);
    if(discardMatch){if(failDiscard)return Response.json({error:'Synthetic discard failed'},{status:failDiscard});const plan=plans.find(row=>row.id===Number(discardMatch[1]))!;plans=plans.map(row=>row.id===plan.id?{...row,lifecycleStatus:'DISCARDED'}:row);if(failAfterDiscard)failRoster=true;return Response.json(plans.find(row=>row.id===plan.id));}
    const publishMatch=path.match(/capacity-plans\/(\d+)\/publish\//);
    if(publishMatch){if(holdPublish)await new Promise<void>(resolve=>{releasePublish=resolve;});if(publishFailure)return Response.json({error:'Synthetic publication conflict'},{status:publishFailure});if(failAfterPublish)failRoster=true;const plan=plans.find(row=>row.id===Number(publishMatch[1]))!;plans=plans.map(row=>row.id===plan.id?{...row,lifecycleStatus:'PUBLISHED',isCurrentPublished:true,publicationReason:body.reason}:row.lifecycleStatus==='PUBLISHED'?{...row,lifecycleStatus:'SUPERSEDED',isCurrentPublished:false}:row);return Response.json(plans.find(row=>row.id===plan.id));}
    const bulkMatch=path.match(/capacity-plans\/(\d+)\/entries\/bulk\//);
    if(bulkMatch){if(holdBulk)await new Promise<void>(resolve=>{releaseBulk=resolve;});if(bulkFailure)return Response.json({error:'Synthetic bulk conflict'},{status:bulkFailure});const plan=plans.find(row=>row.id===Number(bulkMatch[1]))!;
      for(const patch of body.entries){const lecturer=roster.find(row=>row.lecturerId===patch.lecturerId)!;const existing=plan.entries.find(row=>row.lecturerId===patch.lecturerId);const entry=existing??{...lecturer,supervisorLimit:null,panelLimit:null};for(const field of ['supervisorLimit','panelLimit'] as const)if(field in patch&&(body.mode==='REPLACE'||entry[field]===null))entry[field]=patch[field];plan.entries=[...plan.entries.filter(row=>row.lecturerId!==entry.lecturerId),entry];}
      plan.readinessErrors=roster.filter(row=>!plan.entries.some(entry=>entry.lecturerId===row.lecturerId)).map(row=>`${row.staffNo}: capacity entry is required for this Lecturer.`);plan.isComplete=plan.entries.length===27;return Response.json(plan);}
    const match=path.match(/capacity-plans\/(\d+)\/lecturers\/(\d+)\//);
    if(match){if(holdEntryWrites)await new Promise<void>(resolve=>{releaseEntryWrite=resolve;});if(entryFailure)return Response.json({error:'Synthetic entry conflict'},{status:entryFailure});const plan=plans.find(row=>row.id===Number(match[1]))!;const lecturer=roster.find(row=>row.lecturerId===Number(match[2]))!;plan.entries=[...plan.entries.filter(row=>row.lecturerId!==lecturer.lecturerId),{...lecturer,supervisorLimit:body.supervisorLimit,panelLimit:body.panelLimit}];plan.readinessErrors=plan.readinessErrors.filter(message=>!message.startsWith(`${lecturer.staffNo}:`));return Response.json(plan);}
    throw new Error(`Unexpected write ${path}`);
  }
  reads.push(url);
  if(path==='/api/appointments/capacity-reassessments/')return Response.json({activeSemester:{id:9,label:semester.label,lifecycleStatus:'ACTIVE'},requests:[reassessment]});
  if(path==='/api/academics/semesters/')return Response.json([{...semester,...(archiveCurrentSemester?{lifecycleStatus:'ARCHIVED',isActive:false}:{})},archivedSemester]);
  if(path.endsWith('/capacity-workspace/'))return failRoster?Response.json({error:'Synthetic roster unavailable'},{status:503}):Response.json({lecturers:roster,baseline:{activeStudents:54,eligibleLecturers:27,studentsPerLecturer:2}});
  const collection=path.endsWith('/capacity-plans/')?'plans':path.endsWith('/availability/')?'availability':path.endsWith('/capacity-audits/')?'audits':null;
  if(collection){
   if(collection==='availability'&&failAvailability)return Response.json({error:'Synthetic availability failure'},{status:503});
   let rows:any[]=collection==='plans'?[...plans]:collection==='availability'?[...restrictions]:[{id:1,semesterId:9,planId:2,planVersion:2,actor:{id:99,name:'Synthetic Office'},action:'PLAN_COPY',beforeValues:{version:1,semesterId:9},reason:'Research planning',createdAt:'2026-10-01T10:00:00Z'},{id:2,semesterId:9,planId:null,planVersion:null,actor:{id:99,name:'Synthetic Office'},action:'AVAILABILITY_CREATE',beforeValues:{},reason:'Availability updated',createdAt:'2026-10-01T09:00:00Z'}];
   const state=url.searchParams.get('status'),q=url.searchParams.get('q')?.toLowerCase();
   if(url.searchParams.get('scope')==='working')rows=rows.filter(row=>['PUBLISHED','DRAFT'].includes(row.lifecycleStatus));
   if(collection==='plans'&&state&&state!=='ALL')rows=rows.filter(row=>row.lifecycleStatus===state);
   if(collection==='audits'&&url.searchParams.has('version'))rows=rows.filter(row=>row.planVersion===Number(url.searchParams.get('version')));
   if(collection==='availability'){
    if(state==='CURRENT')rows=rows.filter(row=>!row.isCancelled);
    if(state==='CANCELLED')rows=rows.filter(row=>row.isCancelled);
    if(url.searchParams.has('lecturerId'))rows=rows.filter(row=>row.lecturerId===Number(url.searchParams.get('lecturerId')));
    const role=url.searchParams.get('role');if(role&&role!=='ALL')rows=rows.filter(row=>row.role===role);
   }
   if(q)rows=rows.filter(row=>JSON.stringify(row).toLowerCase().includes(q));
   const total=rows.length,limit=Number(url.searchParams.get('limit')??25),offset=Number(url.searchParams.get('offset')??0);rows=rows.slice(offset,offset+limit);
   return Response.json(url.searchParams.get('pageResult')==='true'?{rows,total,limit,offset,...(collection==='audits'?{versions:plans.map(row=>row.version)}:{})}:rows);
  }
  throw new Error(`Unexpected read ${path}`);
};
const mount=async()=>{root?.unmount();router?.dispose();document.getElementById('root')!.innerHTML='';root=createRoot(document.getElementById('root')!);router=createMemoryRouter([{path:'/dashboard/lecturer-capacity',element:<OfficeDashboardLayout enabled><LecturerCapacityManagement onBack={()=>{}}/></OfficeDashboardLayout>},{path:'/reassessment',element:<RecordPageProvider><NestedReassessment/></RecordPageProvider>},{path:'/elsewhere',element:<p>Other workspace</p>}],{initialEntries:['/elsewhere','/dashboard/lecturer-capacity']});root.render(<RouterProvider router={router}/>);await until(()=>document.querySelector('h1'));await until(()=>!text().includes('Loading Lecturer capacity'));};

const preview = new URL(parent.location.href).searchParams.get('preview');
if (!preview) {
await scenario('archived semesters are excluded from capacity working choices',async()=>{
 await mount();document.getElementById('capacity-academic-semester')!.click();await until(()=>document.querySelector('[role="listbox"]'));
 check(![...document.querySelectorAll('[role="option"]')].some(node=>node.textContent?.includes('Archived semester')),'Archived semester is selectable');
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
});
await scenario('archived semester deep links do not load capacity data',async()=>{
 const original=location.href;const target=new URL(original);target.searchParams.set('semester','77');history.replaceState(null,'',target);const before=reads.length;
 try {await mount();await until(()=>text().includes('This semester has been archived'));check(!reads.slice(before).some(url=>url.pathname.includes('/semesters/77/')),'Archived deep link loaded a working collection');check(!text().includes('Synthetic Lecturer 01'),'Archived workspace remains visible');}
 finally {history.replaceState(null,'',original);}
});
await scenario('returning after semester archival removes stale capacity context',async()=>{
 await mount();await until(()=>text().includes('Synthetic Lecturer 01'));archiveCurrentSemester=true;
 try {window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));await until(()=>text().includes('This semester has been archived'));check(!text().includes('Synthetic Lecturer 01'),'Archived lecturer workspace remains visible');check((document.getElementById('capacity-academic-semester') as HTMLButtonElement).disabled,'All-archived semester selector is enabled');check(!buttons().some(button=>button.textContent?.trim()==='Start new draft'),'Archived semester still offers draft creation');}
 finally {archiveCurrentSemester=false;}
});
await scenario('overview shows published workload, baseline and responsive paginated roster',async()=>{
 await mount();await until(()=>text().includes('Synthetic Lecturer 01'));
 check(document.querySelector('h1')?.textContent==='Lecturer capacity','Missing workload-first page');
 check(document.querySelectorAll('.back-link').length===1&&document.querySelector('.back-link')?.textContent?.includes('Back to Dashboard'),'Overview must have one Dashboard back link');
 check(!text().includes('students per lecturer'),'Planning guidance clutters overview');check(document.querySelector('.capacity-policy-published')?.textContent?.includes('Version 1'),'Published policy not separated');check(document.querySelector('.capacity-policy-draft')?.textContent?.includes('Version 2'),'Draft not separated');
 check(document.querySelectorAll('tbody tr').length===10,'Roster must be paginated');check(!text().includes('Version being viewed'),'Old version selector remains');
 check(!buttons().some(button=>button.textContent?.trim()==='Add availability restriction'),'Office still owns lecturer restriction creation');
 check(!document.querySelector('[aria-label="Capacity sections"]'),'Button-style tabs remain');
 const filter=document.querySelector<HTMLInputElement>('input[type="search"]')!;input(filter,'Lecturer 27');await until(()=>document.querySelectorAll('tbody tr').length===1);await click('Clear filters');await until(()=>document.querySelectorAll('tbody tr').length===10);
 check(document.documentElement.scrollWidth<=innerWidth+1,'Page overflows viewport');
 await click('Next');await until(()=>text().includes('Synthetic Lecturer 11'));
});
await scenario('continue draft opens explicit editing view and missing rows remain configurable',async()=>{
 await mount();await until(()=>text().includes('Draft available'));await click('Continue draft v2');await until(()=>text().includes('Editing draft v2'));
 check(text().includes('26 issues prevent publication'),'Readiness summary missing');check(text().includes('Synthetic Lecturer 02'),'Missing draft entries have no edit row');
 const compare=buttons().find(node=>node.textContent?.trim()==='Compare versions')!;
 check(compare.closest('.office-tool-section-heading')?.textContent?.includes('Editing draft v2'),'Comparison action is detached from the version header');
 const blockers=document.querySelector<HTMLDetailsElement>('details.capacity-readiness');check(blockers&&!blockers.open,'Issue details should start collapsed');
 check(!text().includes('Workload and current limits are live reference values')&&!text().includes('The original draft and its history are retained'),'Repeated policy hints remain');
 check(document.querySelectorAll('.back-link').length===1&&!text().includes('Back to Dashboard')&&!text().includes('Back to capacity overview'),'Draft has duplicate back navigation');check(document.querySelector('.back-link')?.textContent?.includes('Back to Lecturer capacity'),'Draft back destination unclear');check(text().includes('Proposed limits'),'Draft values not labelled');await choose('capacity-roster-show','Lecturers needing attention');await until(()=>!document.querySelector('tbody tr')?.textContent?.includes('Synthetic Lecturer 01'));await click('Back to Lecturer capacity');await until(()=>text().includes('Capacity limits'));check(document.querySelector('.back-link')?.textContent?.includes('Back to Dashboard'),'Overview back destination not restored');
});
await scenario('missing draft entry accepts zero without changing published limits',async()=>{
 await mount();await click('Continue draft v2');await until(()=>text().includes('Editing draft v2'));await choose('capacity-roster-show','Lecturers needing attention');await click('Edit limits');
 check(document.querySelector('dialog[open] input[type="number"]'),'Edit limits must use a shared modal');check(!document.querySelector('[data-record-page]'),'Edit limits replaced the table');
 await until(()=>document.querySelector('input[type="number"]'));const fields=[...document.querySelectorAll<HTMLInputElement>('input[type="number"]')];input(fields[0],'0');input(fields[1],'4');await new Promise(resolve=>setTimeout(resolve,15));const before=writes.length;check(document.activeElement===fields[0],'Editor did not focus first limit');await click('Save limits');await until(()=>writes.length===before+1);
 check(writes.at(-1)?.body.supervisorLimit===0,'Zero became missing');check(writes.at(-1)?.body.panelLimit===4,'Panel limit wrong');check(writes.at(-1)?.body.expectedFingerprint,'Concurrency fingerprint missing');
 await until(()=>!document.querySelector('input[type="number"]'));check(roster[1].supervisor.limit===5,'Draft edit changed live resolution');
});
await scenario('table attention filter preserves search and role and counts lecturers separately from issues',async()=>{
 const draft=plans.find(plan=>plan.id===2)!;const original=[...draft.readinessErrors];draft.readinessErrors.push('STAFF-03: Panel limit also needs review.');
 try {
  await mount();await click('Continue draft v2');await until(()=>text().includes('Editing draft v2'));
  check(text().includes('26 issues prevent publication'),'Issue count missing');check(!buttons().some(node=>node.textContent?.trim()==='Show affected lecturers'),'Detached warning action remains');
  await choose('capacity-roster-show','Lecturers needing attention');check(document.querySelector('.capacity-result-summary')?.textContent==='Showing 10 of 25 lecturers needing attention','Issue count mistaken for lecturer count');
  const search=document.querySelector<HTMLInputElement>('input[type="search"]')!;input(search,'Lecturer 03');await choose('capacity-roster-role','Panel');
  await until(()=>document.querySelector('.capacity-result-summary')?.textContent==='Showing 1 of 1 lecturer needing attention matching your filters');
  const row=document.querySelector('tbody tr')!;check(row.querySelectorAll('.capacity-row-issue').length===2,'Multiple issues not attached to lecturer');getComputedStyle(row).backgroundColor;row.getAnimations().forEach(animation=>animation.finish());check(getComputedStyle(row).backgroundColor==='rgb(255, 251, 235)','Affected row not highlighted');
  await choose('capacity-roster-show','All lecturers');check(search.value==='Lecturer 03','Show filter cleared search');check(document.getElementById('capacity-roster-role')?.textContent?.includes('Panel'),'Show filter reset role');
  await choose('capacity-roster-show','Lecturers needing attention');input(search,'No matching lecturer');await until(()=>text().includes('No matching lecturers'));check(document.querySelector('.capacity-result-summary')?.textContent==='Showing 0 of 0 lecturers needing attention matching your filters','Empty count unclear');
  await click('Clear filters');await until(()=>document.querySelector('.capacity-result-summary')?.textContent==='Showing 10 of 27 lecturers');
 } finally {draft.readinessErrors=original;}
});
await scenario('preparation uses a draft selector and one action instead of a button list',async()=>{
 await mount();await click('Prepare limits');await until(()=>text().includes('What would you like to do?'));
 check(text().includes('Planning reference')&&text().includes('54 active students'),'Planning reference missing from preparation');
 check(document.querySelectorAll('.capacity-preparation-form button[type="submit"]').length===1,'Preparation must have one main action');
 check(!buttons().some(node=>node.textContent?.trim()==='Start with a blank draft'),'Button wall remains');
 document.querySelector<HTMLInputElement>('input[name="capacity-preparation-mode"][value="continue"]')!.click();await new Promise(resolve=>setTimeout(resolve,20));await click('Continue editing');await until(()=>text().includes('Editing draft v2'));
});
await scenario('blank draft creation opens the created draft immediately',async()=>{
 await mount();await click('Prepare limits');await until(()=>text().includes('What would you like to do?'));await newDraft('Blank draft');const before=writes.length;await click('Create draft');await until(()=>writes.length===before+1);await until(()=>text().includes('Editing draft v3'));check(document.querySelectorAll('tbody tr').length===10,'Blank draft roster missing');
});
await scenario('previous semester source is validated before allowing creation',async()=>{
 await mount();await click('Prepare limits');await until(()=>text().includes('What would you like to do?'));await newDraft('Previous semester');await until(()=>text().includes('No eligible previous published plan'));check(buttons().find(node=>node.textContent?.trim()==='Create draft')?.disabled,'Missing previous source allowed creation');check(document.querySelector('[data-record-page]')?.textContent?.includes('Prepare capacity limits'),'Source choice lost its record page');
});
await scenario('Office lecturer details show counts and read-only availability',async()=>{
 await mount();await until(()=>text().includes('Synthetic Lecturer 01'));await click('View');await until(()=>text().includes('Lecturer details'));
 check(document.querySelector('dialog[open]'),'View must use a shared modal');check(!document.querySelector('[data-record-page]'),'View replaced the table');
 check(text().includes('Supporting supervision'),'Supporting student breakdown missing');check(text().includes('Lecturers manage their own availability'),'Ownership explanation missing');check(!buttons().some(button=>button.textContent?.trim()==='Record Availability'),'Office mutation still present');await click('View availability');await until(()=>text().includes('Availability restrictions'));check(text().includes('Lecturer: Synthetic Lecturer 01'),'Lecturer availability scope lost');check(!document.querySelector('dialog[open]'),'Availability history left modal open');await until(()=>scrollY===0);
});
await scenario('lecturer view modal preserves filters page scroll and trigger focus',async()=>{
 await mount();const search=document.querySelector<HTMLInputElement>('input[type="search"]')!;input(search,'Lecturer');await choose('capacity-roster-role','Panel');await click('Next');await until(()=>document.querySelector('tbody tr')?.textContent?.includes('Lecturer 11'));
 const trigger=buttons().find(node=>node.textContent?.trim()==='View')!;trigger.focus();const top=scrollY;const before=writes.length;await click('View');await until(()=>document.querySelector('dialog[open]'));
 check(document.querySelector('[aria-label="Lecturer capacity roster"]')?.isConnected,'Table unmounted');const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!;check(dialog.scrollWidth<=dialog.clientWidth+1,'Modal overflows');dialog.dispatchEvent(new Event('cancel',{cancelable:true}));await until(()=>!document.querySelector('dialog[open]'));await until(()=>document.activeElement===trigger);
 check(search.value==='Lecturer','View cleared search');check(document.getElementById('capacity-roster-role')?.textContent?.includes('Panel'),'View reset role');check(document.querySelector('tbody tr')?.textContent?.includes('Lecturer 11'),'View reset page');check(Math.abs(scrollY-top)<=1,'View lost scroll');check(writes.length===before,'Read-only view wrote data');
 await click('View');await until(()=>document.querySelector('dialog[open]'));document.querySelector('dialog[open]')!.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:0,clientY:0}));await until(()=>!document.querySelector('dialog[open]'));
});
await scenario('dirty edit modal protects cancel escape navigation and browser refresh',async()=>{
 await mount();await click('Continue draft v3');await until(()=>text().includes('Editing draft v3'));await click('Edit limits');await until(()=>document.querySelector('dialog[open] input[type="number"]'));const field=document.querySelector<HTMLInputElement>('dialog input[type="number"]')!;input(field,'7');await new Promise(resolve=>setTimeout(resolve,20));const before=writes.length;
 const unload=new Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);check(unload.defaultPrevented,'Dirty edits lack refresh protection');await click('Cancel');await until(()=>document.querySelectorAll('dialog[open]').length===2);await click('Keep editing');await until(()=>document.querySelectorAll('dialog[open]').length===1);check(field.value==='7','Closing confirmation lost edits');
 void router!.navigate(-1);await until(()=>document.querySelectorAll('dialog[open]').length===2);check(router!.state.location.pathname==='/dashboard/lecturer-capacity','Dirty Back navigation escaped guard');await click('Stay on this page');await until(()=>document.querySelectorAll('dialog[open]').length===1);
 document.querySelector('dialog[open]')!.dispatchEvent(new Event('cancel',{cancelable:true}));await until(()=>document.querySelectorAll('dialog[open]').length===2);await click('Discard changes');await until(()=>!document.querySelector('dialog[open]'));check(writes.length===before,'Discarding unsaved inputs wrote data');
 await click('Edit limits');await until(()=>document.querySelector('dialog[open] input'));input(document.querySelector<HTMLInputElement>('dialog input[type="number"]')!,'9');await new Promise(resolve=>setTimeout(resolve,20));void router!.navigate('/elsewhere');await until(()=>document.querySelectorAll('dialog[open]').length===2);await click('Discard changes');await until(()=>text().includes('Other workspace'));check(writes.length===before,'Navigation wrote discarded input');
});
await scenario('edit modal retains input and error after conflict and retries safely',async()=>{
 await mount();await click('Continue draft v3');await until(()=>text().includes('Editing draft v3'));await click('Edit limits');await until(()=>document.querySelector('dialog[open] input[type="number"]'));const fields=[...document.querySelectorAll<HTMLInputElement>('dialog input[type="number"]')];input(fields[0],'6');input(fields[1],'7');await new Promise(resolve=>setTimeout(resolve,20));const before=writes.length;
 try {entryFailure=409;await click('Save limits');await until(()=>document.querySelector('dialog[open] [role="alert"]'));await until(()=>!buttons().find(node=>node.textContent?.trim()==='Save limits')?.disabled);check(fields[0].value==='6'&&fields[1].value==='7','Conflict lost inputs');entryFailure=0;await click('Save limits');await until(()=>!document.querySelector('dialog[open]'));check(writes.length===before+2,'Retry request duplicated');check(writes.at(-1)?.body.supervisorLimit===6&&writes.at(-1)?.body.panelLimit===7,'Retry wrote other limits');}
 finally {entryFailure=0;}
});
await scenario('saving edit modal blocks duplicate submission closing and navigation',async()=>{
 await mount();await click('Continue draft v3');await until(()=>text().includes('Editing draft v3'));await click('Edit limits');await until(()=>document.querySelector('dialog[open] input[type="number"]'));const field=document.querySelector<HTMLInputElement>('dialog input[type="number"]')!;input(field,'8');await new Promise(resolve=>setTimeout(resolve,20));const before=writes.length;
 try {holdEntryWrites=true;await click('Save limits');await until(()=>releaseEntryWrite);check(field.matches(':disabled'),'Inputs editable during save');check(document.querySelector<HTMLButtonElement>('[aria-label="Close lecturer dialog"]')?.disabled,'Close available during save');await click('Save limits');await click('Cancel');document.querySelector('dialog[open]')!.dispatchEvent(new Event('cancel',{cancelable:true}));check(document.querySelector('[data-capacity-lecturer-dialog]'),'Save dismissed dialog');check(writes.length===before+1,'Duplicate save request');void router!.navigate('/elsewhere');await until(()=>document.querySelectorAll('dialog[open]').length===2);check(router!.state.location.pathname==='/dashboard/lecturer-capacity','Busy navigation escaped');releaseEntryWrite!();releaseEntryWrite=null;await until(()=>!document.querySelector('dialog[open]'));check(writes.length===before+1,'Guard resubmitted save');}
 finally {holdEntryWrites=false;releaseEntryWrite?.();releaseEntryWrite=null;}
});
await scenario('versions and history retain read-only version inspection',async()=>{
 await mount();await click('Capacity versions');await until(()=>text().includes('Capacity versions'));check(document.querySelectorAll('.back-link').length===1&&!text().includes('Back to Dashboard')&&!text().includes('Back to capacity overview'),'History has duplicate back navigation');check(!buttons().some(node=>node.textContent?.trim()==='Tools'),'Tools menu remains');const publishedRow=[...document.querySelectorAll('tbody tr')].find(row=>row.textContent?.includes('PUBLISHED'))!;check(!publishedRow.querySelector('[aria-label^="Discard draft version"]'),'Published version exposes discard');await click('View version');await until(()=>text().includes('Viewing version'));
 check(!buttons().some(button=>button.textContent?.trim()==='Save limits'),'History unexpectedly editable');check(text().includes('Published limits remain in force'),'History/operational distinction missing');check(document.querySelectorAll('.back-link').length===1,'Version has duplicate back navigation');await click('Back to Lecturer capacity');await until(()=>text().includes('Capacity limits'));
 await click('Capacity versions');await until(()=>text().includes('Capacity versions'));check(!buttons().some(node=>node.textContent?.trim()==='Continue editing'),'Long history action label remains');await click('Edit draft');await until(()=>text().includes('Editing draft v3'));check(document.querySelector('.capacity-editor [aria-label="Lecturer capacity roster"]'),'Edit draft did not open editor');
});
await scenario('limit editor explains the live publication minimum without blocking draft saves',async()=>{
 await mount();await click('Continue draft v3');await until(()=>text().includes('Editing draft v3'));await click('Edit limits');await until(()=>document.querySelector('dialog[open] input[type="number"]'));
 check(document.querySelector('dialog[open]')?.textContent?.includes('Minimum: 2'),'Live publication minimum is missing');
 const fields=[...document.querySelectorAll<HTMLInputElement>('dialog input[type="number"]')];input(fields[0],'1');await until(()=>document.querySelector('dialog[open]')?.textContent?.includes('Supervisor limit 1 is below committed workload 2'));
 check(!buttons().find(node=>node.textContent?.trim()==='Save limits')?.disabled,'Planning draft edits should remain available');
 check(!document.querySelector('dialog[open]')?.textContent?.includes('temporary unavailability')&&!document.querySelector('dialog[open]')?.textContent?.includes('Drafts can be saved below this minimum'),'Edit modal still contains the policy manual');
 await click('Cancel');await until(()=>document.querySelectorAll('dialog[open]').length===2);await click('Discard changes');await until(()=>!document.querySelector('dialog[open]'));
});
await scenario('workload blockers identify the lecturer and prevent publication review',async()=>{
 const draft=makePlan(90,'DRAFT',roster.map(row=>({...row})));draft.entries[0].supervisorLimit=1;draft.isComplete=false;draft.readinessErrors=['STAFF-01: Supervisor limit 1 is below committed workload 2 (minimum 2).'];plans=[draft,...plans];
 try {await mount();await click('Continue draft v90');await until(()=>text().includes('Editing draft v90'));
  check(text().includes('Supervisor limit 1 is below committed workload 2'),'Row workload blocker missing');
  check(buttons().find(node=>node.textContent?.trim()==='Review and publish')?.disabled,'Undersized policy can open publication');
  check(document.documentElement.scrollWidth<=innerWidth+1,'Workload explanation overflows');
 }finally{plans=plans.filter(row=>row.id!==90);}
});
const publicationReason=()=>{const field=document.querySelector<HTMLTextAreaElement>('dialog[open] textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,'Reviewed staffing plan');field.dispatchEvent(new Event('input',{bubbles:true}));};
const openPublication=async()=>{await click('Continue draft v88');await until(()=>text().includes('Editing draft v88'));buttons().find(node=>node.textContent?.trim()==='Review and publish')!.focus();await click('Review and publish');await until(()=>document.querySelector('dialog[open] textarea'));};
await scenario('publication modal preserves editor context and protects dirty cancellation and navigation',async()=>{
 plans=[makePlan(88,'DRAFT',roster),...plans];try{await mount();await openPublication();
 check(!document.querySelector('[data-record-page]'),'Publication still replaces the page');check(document.querySelector('[aria-label="Lecturer capacity roster"]')?.isConnected,'Publication unmounted roster');check(document.querySelector('dialog[open]')?.textContent?.includes(semester.label),'Publication lacks semester');
 const before=writes.length;const trigger=buttons().find(node=>node.textContent?.trim()==='Review and publish')!;await click('Cancel');await until(()=>!document.querySelector('dialog[open]'));await until(()=>document.activeElement===trigger);check(document.activeElement===trigger,'Cancel lost trigger focus');
 await click('Review and publish');await until(()=>document.querySelector('dialog[open] textarea'));publicationReason();await new Promise(resolve=>setTimeout(resolve,20));const unload=new Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);check(unload.defaultPrevented,'Publication lacks refresh protection');
 await click('Cancel');await until(()=>text().includes('Discard unsaved changes?'));await click('Keep editing');check(document.querySelector<HTMLTextAreaElement>('dialog textarea')?.value==='Reviewed staffing plan','Cancel lost reason');
 void router!.navigate(-1);await until(()=>document.querySelectorAll('dialog[open]').length===2);check(router!.state.location.pathname==='/dashboard/lecturer-capacity','Publication navigation escaped guard');await click('Stay on this page');await until(()=>document.querySelectorAll('dialog[open]').length===1);
 document.querySelector('dialog[open]')!.dispatchEvent(new Event('cancel',{cancelable:true}));await until(()=>text().includes('Discard unsaved changes?'));await click('Discard changes');await until(()=>!document.querySelector('dialog[open]'));check(writes.length===before,'Cancel published limits');
 }finally{plans=plans.filter(row=>row.id!==88);}
});
await scenario('publication conflict preserves reason and requires reviewing latest draft',async()=>{
 plans=[makePlan(88,'DRAFT',roster),...plans];try{await mount();await openPublication();publicationReason();document.querySelector<HTMLInputElement>('dialog input[type="checkbox"]')!.click();await new Promise(resolve=>setTimeout(resolve,20));publishFailure=409;const before=writes.length;await click('Publish limits');await until(()=>text().includes('Synthetic publication conflict'));
 check(document.querySelector<HTMLTextAreaElement>('dialog textarea')?.value==='Reviewed staffing plan','Conflict lost reason');check(!buttons().some(node=>node.textContent?.trim()==='Publish limits'),'Conflict allows stale retry');check(writes.length===before+1,'Conflict duplicated publication');
 await click('Review latest record');await until(()=>text().includes('Replace the information entered'));check(document.querySelector<HTMLTextAreaElement>('dialog textarea')?.value==='Reviewed staffing plan','Review prompt erased reason');await click('Keep editing');check(document.querySelector<HTMLTextAreaElement>('dialog textarea')?.value==='Reviewed staffing plan','Keep editing erased reason');await click('Review latest record');await click('Replace and review');await until(()=>!document.querySelector('dialog[open]'));await click('Review and publish');await until(()=>document.querySelector('dialog[open] textarea'));check(!document.querySelector<HTMLInputElement>('dialog input[type="checkbox"]')?.checked,'Stale review kept consent');check(buttons().find(node=>node.textContent?.trim()==='Publish limits')?.disabled,'Fresh review bypassed confirmation');
 }finally{publishFailure=0;plans=plans.filter(row=>row.id!==88);}
});
await scenario('publication blocks duplicates and closes safely after committed save with failed refresh',async()=>{
 plans=[makePlan(88,'DRAFT',roster),...plans];try{await mount();await openPublication();publicationReason();document.querySelector<HTMLInputElement>('dialog input[type="checkbox"]')!.click();await new Promise(resolve=>setTimeout(resolve,20));holdPublish=true;failAfterPublish=true;const before=writes.length;await click('Publish limits');await until(()=>releasePublish);
 check(document.querySelector<HTMLTextAreaElement>('dialog textarea')?.matches(':disabled'),'Publication inputs enabled while saving');await click('Publish limits');await click('Cancel');document.querySelector('dialog[open]')!.dispatchEvent(new Event('cancel',{cancelable:true}));check(document.querySelector('dialog[open]'),'Busy publication closed');check(writes.length===before+1,'Publication duplicated');
 releasePublish!();releasePublish=null;await until(()=>!document.querySelector('dialog[open]'));check(text().includes('could not be loaded'),'Committed publication refresh failure omitted');check(plans.find(row=>row.id===88)?.lifecycleStatus==='PUBLISHED','Publication not committed');check(writes.length===before+1,'Refresh failure resubmitted publication');
 }finally{holdPublish=false;releasePublish?.();releasePublish=null;failAfterPublish=false;failRoster=false;plans=plans.filter(row=>row.id!==88);plans=plans.map(row=>row.id===1?{...row,lifecycleStatus:'PUBLISHED',isCurrentPublished:true}:row);}
});
await scenario('publication requires explicit review, reason and consent, then returns to current policy',async()=>{
 plans=[makePlan(4,'DRAFT',roster),...plans];await mount();await click('Continue draft v4');await until(()=>text().includes('Editing draft v4'));const before=writes.length;await click('Review and publish');await until(()=>document.querySelector('textarea'));check(document.querySelector('dialog[open] textarea'),'Publication is not a modal');check(writes.length===before,'Review published without confirmation');
 const publishButton=buttons().find(node=>node.textContent?.trim()==='Publish limits')!;check(publishButton.disabled,'Publish enabled without reason and consent');const field=document.querySelector<HTMLTextAreaElement>('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,'Reviewed staffing plan');field.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector<HTMLInputElement>('dialog[open] input[type="checkbox"]')!.click();await until(()=>!publishButton.disabled);await click('Publish limits');await until(()=>document.querySelector('.capacity-policy-published')?.textContent?.includes('Version 4'));check(writes.at(-1)?.body.reason==='Reviewed staffing plan','Publication reason not saved');check(writes.at(-1)?.body.expectedFingerprint==='fingerprint-4','Publication concurrency guard missing');
});
await scenario('ineligible draft blockers offer a fresh-draft recovery without deleting history',async()=>{
 const stale=makePlan(5,'DRAFT',roster.slice(0,1));stale.readinessErrors=['STAFF-01: entry Lecturer is not currently eligible.'];plans=[stale,...plans];const row=roster[0] as typeof roster[0]&{canConfigure:boolean};row.canConfigure=false;row.participantLifecycle='RETIRED';try{await mount();await click('Continue draft v5');await until(()=>text().includes('Editing draft v5'));await choose('capacity-roster-show','Lecturers needing attention');const edit=buttons().find(node=>node.textContent?.trim()==='Edit limits')!;check(edit.disabled,'Ineligible draft row became editable');await click('Prepare a fresh draft');await until(()=>text().includes('What would you like to do?'));check(plans.some(plan=>plan.id===5),'Recovery removed old draft');}finally{row.canConfigure=true;row.participantLifecycle='ACTIVE';}
});
await scenario('failed roster read has retry and never exposes mutation controls',async()=>{
 failRoster=true;await mount();await until(()=>text().includes('Synthetic roster unavailable'));check(!buttons().some(button=>button.textContent?.trim()==='Edit limits'),'Failed read exposed editing');failRoster=false;await click('Retry');await until(()=>text().includes('Synthetic Lecturer 01'));
});
await scenario('current published starting point clones the policy and opens its draft',async()=>{
 await mount();await click('Prepare limits');await until(()=>text().includes('What would you like to do?'));await newDraft('Current published limits');const before=writes.length;await click('Create draft');await until(()=>writes.length===before+1);check(writes.at(-1)?.path.endsWith('/4/clone/'),'Published source did not use clone');await until(()=>text().includes('Editing draft v6'));
});
const openDiscard=async()=>{await click('Capacity versions');await until(()=>document.querySelector('[aria-label="Capacity versions"]'));check(!buttons().some(node=>node.textContent?.trim()==='Tools'),'Discard is still hidden in Tools');await click('Discard');await until(()=>document.querySelector('dialog[open]'));};
const reason=()=>{const field=document.querySelector<HTMLTextAreaElement>('dialog[open] textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,'Duplicate planning draft');field.dispatchEvent(new Event('input',{bubbles:true}));};
await scenario('discard needs confirmation and reason, retains history and removes active draft',async()=>{
 await mount();const before=writes.length;await openDiscard();check(text().includes(semester.label),'Semester missing from confirmation');check(writes.length===before,'Opening discard wrote data');check(buttons().find(node=>node.textContent?.trim()==='Discard draft')!.disabled,'Discard lacks reason validation');await click('Cancel');await until(()=>!document.querySelector('dialog[open]'));check(writes.length===before,'Cancel wrote data');
 await click('Discard');await until(()=>document.querySelector('textarea'));reason();await new Promise(resolve=>setTimeout(resolve,20));await click('Discard draft');await until(()=>!document.querySelector('dialog[open]'));check(writes.length===before+1,'Discard duplicated request');check(writes.at(-1)?.body.confirmed===true&&writes.at(-1)?.body.expectedFingerprint==='fingerprint-6','Missing consent or concurrency guard');check(plans.find(row=>row.id===6)?.lifecycleStatus==='DISCARDED','Draft was deleted or not discarded');
 const discarded=[...document.querySelectorAll('tbody tr')].find(row=>row.textContent?.includes('Version 6'))!;check(!discarded.textContent?.includes('Edit draft'),'Discarded draft editable');check(!discarded.querySelector('[aria-label^="Discard draft version"]'),'Discarded version exposes discard');await click('Back to Lecturer capacity');await click('Prepare limits');await until(()=>text().includes('What would you like to do?'));check(!document.querySelector('#capacity-existing-draft')?.textContent?.includes('Version 6'),'Discarded draft remained active');
});
await scenario('discard failure is visible and retry does not discard another version',async()=>{
 await mount();await openDiscard();reason();await new Promise(resolve=>setTimeout(resolve,20));failDiscard=503;await click('Discard draft');await until(()=>text().includes('Synthetic discard failed'));check(plans.find(row=>row.id===5)?.lifecycleStatus==='DRAFT','Failed discard changed status');failDiscard=0;await click('Discard draft');await until(()=>!document.querySelector('dialog[open]'));check(plans.find(row=>row.id===5)?.lifecycleStatus==='DISCARDED','Retry did not discard selected version');
});
await scenario('saved discard followed by reload failure cannot be submitted twice',async()=>{
 await mount();await openDiscard();reason();await new Promise(resolve=>setTimeout(resolve,20));const before=writes.length;failAfterDiscard=true;await click('Discard draft');await until(()=>!document.querySelector('dialog[open]'));check(writes.length===before+1,'Saved discard resubmitted after refresh failure');check(text().includes('could not be loaded'),'Refresh failure omitted');failAfterDiscard=false;failRoster=false;await click('Retry');await until(()=>document.querySelector('[aria-label="Capacity versions"]'));check(document.documentElement.scrollWidth<=innerWidth+1,'History overflows viewport');
});
await scenario('discarded version remains viewable without edit publish or revision controls',async()=>{
 await mount();await click('Capacity versions');await until(()=>document.querySelector('[aria-label="Capacity versions"]'));await choose('capacity-history-status','Discarded');check([...document.querySelectorAll('tbody tr')].every(row=>row.textContent?.includes('DISCARDED')),'Discarded status filter includes active policies');const row=[...document.querySelectorAll('tbody tr')].find(node=>node.textContent?.includes('Version 6'))!;row.querySelector<HTMLButtonElement>('button')!.click();await until(()=>text().includes('Viewing version 6'));check(!buttons().some(node=>['Continue editing this draft','Review and publish','Prepare a revision','Save limits'].includes(node.textContent?.trim()||'')),'Discarded version exposes mutation');
});
await scenario('availability is separate lazy paginated and filterable with read-only details',async()=>{
 reads=[];await mount();await until(()=>document.querySelector('[aria-label="Lecturer capacity roster"]'));
 check(!reads.some(url=>url.pathname.endsWith('/availability/')||url.pathname.endsWith('/capacity-audits/')),'Overview downloads historical collections');
 const search=document.querySelector<HTMLInputElement>('input[type="search"]')!;input(search,'Lecturer');await click('Next');await until(()=>document.querySelector('tbody tr')?.textContent?.includes('Lecturer 11'));
 await click('View availability');await until(()=>document.querySelector('[aria-label="Lecturer availability"]'));
 check(document.querySelector('h1')?.textContent==='Lecturer availability','Destination heading unchanged');
 check(document.querySelectorAll('tbody tr').length===10,'Restrictions not paginated');check(!text().includes('Private research leave reason'),'Long reasons clutter list');
 await click('Next');await until(()=>document.querySelectorAll('tbody tr').length===3);
 await click('View details');await until(()=>document.querySelector('dialog[open]'));check(text().includes('Private research leave reason'),'Reason missing from details');await click('Close');await until(()=>!document.querySelector('dialog[open]'));
 await choose('capacity-availability-status','Cancelled');await until(()=>document.querySelectorAll('tbody tr').length===1);await click('View details');await until(()=>text().includes('Cancelled private reason'));await click('Close');
 await click('Back to Lecturer capacity');await until(()=>document.querySelector('[aria-label="Lecturer capacity roster"]'));check(document.querySelector<HTMLInputElement>('input[type="search"]')?.value==='Lecturer','Back lost roster search');check(document.querySelector('tbody tr')?.textContent?.includes('Lecturer 11'),'Back lost roster page');
});
await scenario('lecturer availability shortcut scopes before paging and can clear its scope',async()=>{
 await mount();await click('View');await until(()=>document.querySelector('dialog[open]'));await click('View availability');await until(()=>document.querySelector('[aria-label="Lecturer availability"]'));
 check(text().includes('Lecturer: Synthetic Lecturer 01'),'Shortcut lacks lecturer scope');check(!text().includes('Synthetic Lecturer 02'),'Another lecturer leaked into scope');
 const last=reads.filter(url=>url.pathname.endsWith('/availability/')).at(-1)!;check(last.searchParams.get('lecturerId')==='1','Lecturer filter applied only after paging');
 await click('Clear lecturer filter');await until(()=>!text().includes('Lecturer:'));await click('Next');await until(()=>text().includes('Synthetic Lecturer 02'));
});
await scenario('versions and activity are separate collections and filters update without apply',async()=>{
 await mount();await click('Capacity versions');await until(()=>document.querySelector('[aria-label="Capacity versions"]'));
 check(!text().includes('Availability restrictions')&&!text().includes('Audit history'),'Versions still stacks other collections');
 check(!buttons().some(button=>button.textContent?.includes('Apply')),'Apply button introduced');
 await click('View activity log');await until(()=>document.querySelector('[aria-label="Capacity activity log"]'));
 check(document.querySelector('h1')?.textContent==='Capacity activity log','Activity heading missing');check(!document.querySelector('[aria-label="Capacity versions"]'),'Versions remains stacked');check(text().includes('Research planning'),'Audit reason missing');
 check(text().includes('Created from Version 1')&&text().includes('Semester-wide'),'Version/source labels missing');
 await choose('capacity-activity-version','Version 2');await until(()=>reads.filter(url=>url.pathname.endsWith('/capacity-audits/')).at(-1)?.searchParams.get('version')==='2'&&!text().includes('Semester-wide'));
 check(text().includes('Research planning'),'Version filter removed the matching event');
 await click('Clear filters');await until(()=>text().includes('Semester-wide'));
 await click('Back to Lecturer capacity');await click('Capacity versions');await until(()=>document.querySelector('[aria-label="Capacity versions"]'));
 buttons().find(button=>button.getAttribute('aria-label')==='View activity for version 2')!.click();await until(()=>document.querySelector('#capacity-activity-version')?.textContent?.trim()==='Version 2'&&!!document.querySelector('[aria-label="Capacity activity log"]'));
 check(!text().includes('Semester-wide'),'Version shortcut did not filter the audit list');
});
await scenario('availability failure is local and retry reloads only its page',async()=>{
 await mount();failAvailability=true;await click('View availability');await until(()=>text().includes('Synthetic availability failure'));check(!document.querySelector('[aria-label="Lecturer availability"]'),'Stale rows shown after failed load');failAvailability=false;await click('Retry');await until(()=>document.querySelector('[aria-label="Lecturer availability"]'));check(document.documentElement.scrollWidth<=innerWidth+1,'Availability overflows viewport');
});

await scenario('multiple drafts use explicit selection and preparation opens new-draft intent',async()=>{
 const before=plans;plans=[makePlan(21,'DRAFT',roster),makePlan(20,'DRAFT',roster),...plans];try {await mount();const review=buttons().find(node=>node.textContent?.trim().startsWith('Review drafts'))!;check(review,'Multiple drafts lack review action');review.click();await until(()=>document.querySelector('[aria-label="Capacity versions"]'));
 check([...document.querySelectorAll('tbody tr')].every(row=>row.textContent?.includes('DRAFT')),'Review drafts includes other policies');
 await click('Start new draft');await until(()=>text().includes('What would you like to do?'));check(document.querySelector<HTMLInputElement>('input[name="capacity-preparation-mode"][value="new"]')?.checked,'Start new draft defaults to continuing a draft');}finally{plans=before;}
});
const openBulk=async()=>{await click('Set limits in bulk');await until(()=>document.querySelector('dialog[open] input[type="number"]'));};
const bulkValues=async(supervisor:string,panel:string)=>{const fields=document.querySelectorAll<HTMLInputElement>('dialog[open] input[type="number"]');input(fields[0],supervisor);input(fields[1],panel);await new Promise(resolve=>setTimeout(resolve,20));};
await scenario('draft editor groups selection with editing and puts publication after the roster',async()=>{
 const old=plans;plans=[makePlan(97,'DRAFT',[]),...plans];try{
  await mount();await click('Continue draft v97');await until(()=>text().includes('Editing draft v97'));
  const editor=document.querySelector('.capacity-editor')!;check(editor,'Draft is not one editor surface');
  const rosterTable=editor.querySelector('[aria-label="Lecturer capacity roster"]')!;
  const footer=editor.querySelector('.capacity-publication-footer')!;check(footer&&!!(rosterTable.compareDocumentPosition(footer)&Node.DOCUMENT_POSITION_FOLLOWING),'Publication is not after lecturer editing');
  const heading=editor.querySelector('.office-tool-section-heading')!;check(heading.textContent?.includes('Compare versions')&&!heading.textContent?.includes('DRAFT'),'Header repeats draft state or detaches comparison');
  const toolbar=editor.querySelector('.capacity-roster-toolbar')!;check(toolbar?.textContent?.includes('Set limits in bulk'),'Bulk action is detached from roster selection');
  check(!toolbar.querySelector('input[type="checkbox"]')&&!toolbar.textContent?.includes('Clear selection'),'Expanded selection controls clutter the idle toolbar');
  await click('Select lecturers');await until(()=>document.querySelector('[role="menu"]'));const menu=document.querySelector<HTMLElement>('[role="menu"]')!;
  check(menu.getBoundingClientRect().left>=0&&menu.getBoundingClientRect().right<=innerWidth+1,'Selection menu overflows');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await until(()=>!document.querySelector('[role="menu"]'));check(document.activeElement?.getAttribute('aria-label')==='Select lecturers','Escape lost selection trigger focus');
  await click('Select lecturers');document.querySelector<HTMLElement>('[role="menuitem"]')!.focus();await click('Select this page (10)');await until(()=>text().includes('10 lecturers selected'));check(document.activeElement?.getAttribute('aria-label')==='Select lecturers','Selection action lost keyboard focus');
  await click('Select lecturers');await click('Select all 27 matching');await until(()=>text().includes('27 lecturers selected'));
  await click('Select lecturers');await click('Clear selection');await until(()=>!document.querySelector('.capacity-selection-count'));
  await openBulk();check(document.querySelector('dialog[open]')?.textContent?.includes('All matching lecturers (27)'),'Bulk scope lost after clearing selection');await click('Cancel');
  check(document.documentElement.scrollWidth<=innerWidth+1,'Editor overflows');
 }finally{plans=old;}
});
await scenario('bulk selection spans pages and previews before one atomic draft save',async()=>{
 const old=plans,publishedBefore=JSON.stringify(plans.filter(row=>row.lifecycleStatus==='PUBLISHED'));plans=[makePlan(92,'DRAFT',[]),...plans];try{await mount();await click('Continue draft v92');await until(()=>text().includes('Editing draft v92'));const before=writes.length;
 await click('Select lecturers');await click('Select this page (10)');await click('Next');await until(()=>text().includes('Lecturer 11'));document.querySelector<HTMLInputElement>('[aria-label="Select STAFF-11"]')!.click();await until(()=>text().includes('11 lecturers selected'));await openBulk();await bulkValues('6','9');await click('Preview changes');await until(()=>document.querySelector('[aria-label="Bulk capacity preview"]'));const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!;check(dialog.scrollWidth<=dialog.clientWidth+1,'Bulk preview overflows');check(writes.length===before,'Preview wrote limits');check(text().includes('11 lecturers will change'),'Preview excludes hidden-page selections');await click('Next');await click('Next');check(document.querySelector('dialog[open]')?.textContent?.includes('STAFF-11'),'Preview does not page all selected changes');await click('Save draft limits');await until(()=>!document.querySelector('dialog[open]'));check(writes.length===before+1,'Bulk save is not a single request');check(writes.at(-1)?.body.entries.length===11&&writes.at(-1)?.body.expectedFingerprint==='fingerprint-92','Bulk scope or concurrency guard wrong');check(plans.find(row=>row.id===92)?.entries.length===11,'Wrong lecturers saved');check(text().includes('Draft limits saved for 11 lecturers.'),'Saved batch feedback disappeared');check(JSON.stringify(plans.filter(row=>row.lifecycleStatus==='PUBLISHED'))===publishedBefore,'Bulk changed published policy');
 }finally{plans=old;}
});
await scenario('bulk defaults preserve existing limits and explicit replacement changes only supplied roles',async()=>{
 const old=plans;plans=[makePlan(93,'DRAFT',roster.map(row=>({...row}))),...plans];try{await mount();await click('Continue draft v93');await until(()=>text().includes('Editing draft v93'));await openBulk();await bulkValues('7','');check(document.querySelector('dialog[open]')?.textContent?.includes('Fill missing limits only'),'Unsafe default mode');check(buttons().find(node=>node.textContent?.trim()==='Preview changes')?.disabled,'Missing-only overwrites configured entries');await choose('capacity-bulk-mode','Replace draft limits');await click('Preview changes');await until(()=>text().includes('27 lecturers will change'));check(document.querySelector('dialog[open]')?.textContent?.includes('Supervisor: 5 → 7'),'Preview lacks old and new values');await click('Save draft limits');await until(()=>!document.querySelector('dialog[open]'));const body=writes.at(-1)!.body;check(body.mode==='REPLACE'&&body.entries.every((row:any)=>row.supervisorLimit===7&&!('panelLimit'in row)),'Leave unchanged overwrote Panel');check(plans.find(row=>row.id===93)?.entries.every(row=>row.panelLimit===5),'Panel changed');
 }finally{plans=old;}
});
await scenario('bulk dirty cancellation conflict and busy guards protect the reviewed draft',async()=>{
 const old=plans;plans=[makePlan(94,'DRAFT',[]),...plans];try{await mount();await click('Continue draft v94');await until(()=>text().includes('Editing draft v94'));await openBulk();await bulkValues('6','9');const before=writes.length;await click('Cancel');await until(()=>text().includes('Discard unsaved changes?'));await click('Keep editing');check(document.querySelector<HTMLInputElement>('dialog[open] input[type="number"]')?.value==='6','Dirty cancel erased bulk values');await click('Preview changes');bulkFailure=409;await click('Save draft limits');await until(()=>text().includes('Synthetic bulk conflict'));check(!buttons().some(node=>node.textContent?.trim()==='Save draft limits'),'Stale batch can retry without review');await click('Review latest record');await until(()=>text().includes('Replace the information entered'));check(document.querySelector('[aria-label="Bulk capacity preview"]')?.textContent?.includes('Not set → 6'),'Review prompt erased bulk preview');await click('Keep editing');check(document.querySelector('[aria-label="Bulk capacity preview"]')?.textContent?.includes('Not set → 6'),'Keep editing erased bulk preview');await click('Review latest record');await click('Replace and review');await until(()=>!document.querySelector('dialog[open]'));bulkFailure=0;
 await openBulk();await bulkValues('6','9');await click('Preview changes');holdBulk=true;await click('Save draft limits');await until(()=>releaseBulk);await click('Save draft limits');await click('Cancel');document.querySelector('dialog[open]')!.dispatchEvent(new Event('cancel',{cancelable:true}));check(document.querySelector('dialog[open]'),'Busy bulk dismissed');check(writes.length===before+2,'Bulk submitted twice');releaseBulk!();releaseBulk=null;await until(()=>!document.querySelector('dialog[open]'));check(plans.find(row=>row.id===94)?.entries.length===27,'Matching selection stopped at current page');
 }finally{bulkFailure=0;holdBulk=false;releaseBulk?.();releaseBulk=null;plans=old;}
});
await scenario('bulk preview flags obsolete role limits before any batch can be saved',async()=>{
 const old=plans,original=roster[0];roster[0]={...original,panel:null} as any;plans=[makePlan(95,'DRAFT',roster.map(row=>({...row}))),...plans];try{await mount();await click('Continue draft v95');await until(()=>text().includes('Editing draft v95'));await openBulk();await choose('capacity-bulk-mode','Replace draft limits');await bulkValues('7','');check(document.querySelector('dialog[open]')?.textContent?.includes('Use Edit limits to clear the saved Panel limit'),'Obsolete role value has no recovery guidance');check(buttons().find(node=>node.textContent?.trim()==='Preview changes')?.disabled,'Invalid role limit can enter batch preview');}finally{plans=old;roster[0]=original;}
});
await scenario('bulk filter changes clear prior selection and a failed save retains the reviewed scope',async()=>{
 const old=plans;plans=[makePlan(96,'DRAFT',[]),...plans];try{
  await mount();await click('Continue draft v96');await until(()=>text().includes('Editing draft v96'));
  document.querySelector<HTMLInputElement>('[aria-label="Select STAFF-01"]')!.click();await until(()=>text().includes('1 lecturer selected'));
  input(document.querySelector<HTMLInputElement>('input[type="search"]')!,'STAFF-02');await until(()=>!document.querySelector('.capacity-selection-count'));
  check(!document.querySelector('[aria-label="Select STAFF-01"]'),'Prior selection remains in filtered roster');await openBulk();await bulkValues('6','9');await click('Preview changes');
  await until(()=>document.querySelector('[aria-label="Bulk capacity preview"]'));check(document.querySelector('dialog[open]')?.textContent?.includes('STAFF-02'),'Filtered target missing');check(!document.querySelector('dialog[open]')?.textContent?.includes('STAFF-01'),'Hidden prior selection leaked into batch');
  bulkFailure=500;await click('Save draft limits');await until(()=>text().includes('Synthetic bulk conflict'));check(plans.find(row=>row.id===96)?.entries.length===0,'Failed batch changed draft');
  check(document.querySelector('[aria-label="Bulk capacity preview"]'),'Failure discarded reviewed changes');bulkFailure=0;await click('Save draft limits');await until(()=>!document.querySelector('dialog[open]'));
  const saved=plans.find(row=>row.id===96)!.entries;check(saved.length===1&&saved[0].lecturerId===2&&saved[0].supervisorLimit===6&&saved[0].panelLimit===9,'Retry changed the reviewed target or limits');
  document.querySelector<HTMLInputElement>('[aria-label="Select STAFF-02"]')!.click();await until(()=>text().includes('1 lecturer selected'));await choose('capacity-roster-role','Supervisor');await until(()=>!document.querySelector('.capacity-selection-count'));
 }finally{bulkFailure=0;plans=old;}
});
await scenario('lecturer availability navigation starts at top and historical comparison remains available',async()=>{
 await mount();window.scrollTo({top:300,behavior:'instant'});await click('View');await until(()=>document.querySelector('dialog[open]'));await click('View availability');await until(()=>document.querySelector('[aria-label="Lecturer availability"]'));await until(()=>scrollY===0);
 await click('Back to Lecturer capacity');await click('Capacity versions');await until(()=>document.querySelector('[aria-label="Capacity versions"]'));await click('View version');await until(()=>text().includes('Viewing version'));const before=writes.length;await click('Compare versions');await until(()=>text().includes('Capacity version comparison')||document.querySelector('[aria-label="Capacity version comparison"]'));check(writes.length===before,'Comparison wrote data');
});
await scenario('dirty lecturer edit protects route navigation and keeps entered limits',async()=>{
 await mount();await click('Continue draft v2');await click('Edit limits');await until(()=>document.querySelector('dialog[open] input[type="number"]'));const field=document.querySelector<HTMLInputElement>('dialog[open] input[type="number"]')!;input(field,'8');await new Promise(resolve=>setTimeout(resolve,20));await router!.navigate('/elsewhere');await until(()=>text().includes('Discard unsaved changes?'));check(field.value==='8','Navigation prompt lost edit');await click('Stay on this page');check(router!.state.location.pathname==='/dashboard/lecturer-capacity','Keep editing allowed route');check(field.value==='8','Keep editing lost input');
});
await scenario('nested reassessment reason is discardable instead of reported as a write',async()=>{
 await mount();await router!.navigate('/reassessment');await until(()=>buttons().some(node=>node.textContent?.trim()==='Authorize reassessment'));await click('Authorize reassessment');await until(()=>document.querySelector('dialog[open] textarea'));const field=document.querySelector<HTMLTextAreaElement>('dialog[open] textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,'Evaluate carryover');field.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,20));await router!.navigate('/elsewhere');await until(()=>text().includes('Discard unsaved changes?')||text().includes('Saving changes'));check(text().includes('Discard unsaved changes?'),'Typed reason was misclassified as a pending write');check(!buttons().find(node=>node.textContent?.trim()==='Discard changes')?.disabled,'Dirty nested reason cannot be discarded');await click('Stay on this page');check(router!.state.location.pathname==='/reassessment','Keep editing allowed route');check(field.value==='Evaluate carryover','Keep editing lost reason');
});
await scenario('pending draft creation continues requested route after committed save',async()=>{
 const old=plans;try{await mount();await click('Prepare limits');await until(()=>text().includes('What would you like to do?'));await newDraft('Blank draft');holdCreate=true;await click('Create draft');await until(()=>releaseCreate);void router!.navigate('/elsewhere');await until(()=>text().includes('Saving changes'));releaseCreate!();releaseCreate=null;await until(()=>router!.state.location.pathname==='/elsewhere');check(plans.length===old.length+1,'Pending route lost committed draft');}finally{holdCreate=false;releaseCreate?.();releaseCreate=null;plans=old;}
});
await scenario('committed draft creation with failed refresh remains selected and prevents duplicate creation',async()=>{
 const old=plans;try{await mount();await click('Prepare limits');await newDraft('Blank draft');failAfterCreate=true;const before=writes.length;await click('Create draft');await until(()=>text().includes('Draft created; refresh needed'));check(writes.length===before+1,'Failed refresh duplicated creation');check(text().includes('Editing draft v'),'Committed draft was lost');check(buttons().find(node=>node.textContent?.trim()==='Review and publish')?.disabled,'Unrefreshed draft allows another action');failRoster=false;await click('Reload limits');await until(()=>!text().includes('Draft created; refresh needed'));}finally{failAfterCreate=false;failRoster=false;plans=old;}
});
await scenario('pending published-plan clone continues requested route after committed save',async()=>{
 const old=plans;try{await mount();await click('Prepare limits');await newDraft('Current published limits');holdClone=true;await click('Create draft');await until(()=>releaseClone);void router!.navigate('/elsewhere');await until(()=>text().includes('Saving changes'));releaseClone!();releaseClone=null;await until(()=>router!.state.location.pathname==='/elsewhere');check(plans.length===old.length+1,'Pending route lost cloned draft');}finally{holdClone=false;releaseClone?.();releaseClone=null;plans=old;}
});

}
await mount();
if(preview==='details') { await click('View'); await until(()=>document.querySelector('dialog[open]')); }
else if(preview==='bulk'||preview==='bulk-settings') { await click('Continue draft v2'); await until(()=>text().includes('Editing draft v2')); await click('Set limits in bulk'); await until(()=>document.querySelector('dialog[open] input[type="number"]')); const fields=document.querySelectorAll<HTMLInputElement>('dialog[open] input[type="number"]');input(fields[0],'5');input(fields[1],'8');await new Promise(resolve=>setTimeout(resolve,20));if(preview==='bulk')await click('Preview changes'); }
else if(preview==='publish') { plans=[makePlan(88,'DRAFT',roster),...plans]; await mount(); await click('Continue draft v88'); await until(()=>text().includes('Editing draft v88')); await click('Review and publish'); await until(()=>document.querySelector('dialog[open] textarea')); }
else if(preview==='edit') { await click('Continue draft v2'); await until(()=>text().includes('Editing draft v2')); await click('Edit limits'); await until(()=>document.querySelector('dialog[open]')); }
else if(preview==='editor'||preview==='editor-selected'||preview==='editor-footer') {
 await click('Continue draft v2'); await until(()=>text().includes('Editing draft v2'));
 if(preview==='editor-selected'){await click('Select lecturers');await click('Select this page (10)');}
 if(preview==='editor-footer')document.querySelector('.capacity-publication-footer')!.scrollIntoView({block:'end'});
}
else if(preview==='history') { await click('Capacity versions'); await until(()=>document.querySelector('[aria-label="Capacity versions"]')); }
else if(preview==='overview') {}
else if(preview==='availability') {await click('View availability');await until(()=>document.querySelector('[aria-label="Lecturer availability"]'));}
else { await click('Prepare limits'); await until(()=>text().includes('What would you like to do?')); }
parent.postMessage({type:'capacity-workspace-results',results},location.origin);
