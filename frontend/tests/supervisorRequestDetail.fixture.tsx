import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {SupervisorRequestDetail, toSupervisorRequestPresentation, toStudentSupervisorRequestPresentation} from '../src/components/SupervisorRequestDetail';
import {LecturerPrimaryRequestActions} from '../src/components/LecturerAppointmentRequests';
import {CoordinatorPrimaryRequestActions, CoordinatorApplicationLifecycle, CoordinatorSupervisorApprovals} from '../src/components/CoordinatorSupervisorApprovals';
import {officeRequestPresentation, OfficeAppointmentAdministration, SupervisorAppointmentManagement} from '../src/components/SupervisorAppointmentManagement';
import {officeApplicationRecord} from '../src/components/OfficeSupervisorWorkspace';
import {toStudentSupervisorApplication} from '../src/services/appointmentsApi';
import {canStudentCancelSupervisorApplication} from '../src/utils/workflowTracking';
import {PortalButton} from '../src/components/PortalPrimitives';
import {ViewStudentRecordAction} from '../src/components/RequestDetailPrimitives';
import {emptySupervisorResearchIntent} from '../src/utils/supervisorResearchIntent';
import type {SupervisorApplicationRecord} from '../src/types';
import type {SupervisorSectionASnapshot} from '../src/types/supervisorSectionA';

const snapshot: SupervisorSectionASnapshot={version:1,studentParticulars:{name:'Applicant at submission',studentId:'EXAMPLE-001',programme:'Original Computing Programme',semester:'Semester I 2026/2027',identityType:'PASSPORT',identityNumber:'SYNTHETIC-PASSPORT',email:'submitted@example.test',phone:'SYNTHETIC-PHONE',address:'Recorded address\nSecond line'},titleOrigin:'STUDENT',noCoursesTaken:false,courseResults:[{courseName:'Research methods',courseCode:'TEST7001',semesterSession:'Semester II 2025/2026',grade:'A-'}],declaration:{text:'I confirm these submitted particulars.\nThis is synthetic test evidence.',acceptedAt:'2026-10-17T02:30:00Z',acceptedBy:12},capturedAt:'2026-10-17T02:30:00Z'};
const intent={...emptySupervisorResearchIntent(),introduction:'Recorded introduction\nSecond paragraph.',aim:'Recorded aim',significance:'Recorded significance',researchQuestions:'Recorded question',researchObjectives:'Recorded objective',methodology:'Recorded methodology',expectedOutcomes:'Recorded outcomes',skillsNeeded:'Recorded skills',timeline:'Recorded timeline'};
const base: SupervisorApplicationRecord={id:701,studentId:'CURRENT-001',studentName:'Current profile name',programme:'Current programme',semester:'Current semester',proposedSupervisor:'Dr Example Supervisor',proposedSupervisorId:'L1',researchTitle:'Explainable recommendations for student research support',researchArea:'Data science',researchAbstract:'Submitted abstract.\n\nA second paragraph preserved in full.',projectCourseCodes:'TEST7002',researchProfileReady:true,status:'SUBMITTED_TO_SUPERVISOR',rejectionReason:'',submittedAt:'2026-10-17T02:30:00Z',workflow:[{id:1,action:'SUBMIT',actorName:'Applicant at submission',actorRole:'Student',previousStatus:'',newStatus:'SUBMITTED_TO_SUPERVISOR',reason:'',createdAt:'2026-10-17T02:30:00Z'}],documents:[{id:9,name:'research-proposal.pdf',requirementCode:'PROPOSAL',requirementLabel:'Research proposal',contentType:'application/pdf',size:2048,checksum:null,availability:'AVAILABLE',uploadedAt:'2026-10-17T02:30:00Z'}]};
let mode='', reads:string[]=[], actionCount=0, recovered=false;
const pending: (()=>void)[]=[];
window.fetch=async(input,init)=>{
  const path=new URL(String(input),location.origin).pathname;
  reads.push(path);
  if(path.endsWith('/appointments/991/replacement/')){
    if(init?.method==='POST'){const payload=JSON.parse(String(init.body));if(payload.proposedSupervisorId!=='L2'||payload.reason!=='Supervisor is taking extended leave.')throw Error('Incorrect replacement payload');mode='replacement-pending';return Response.json({...base,id:702,initiatedByOffice:true});}
    if(mode==='replacement-error'&&!recovered)return Response.json({detail:'Availability check unavailable'},{status:503});
    return Response.json({appointmentId:991,studentId:base.studentId,studentName:base.studentName,programme:base.programme,currentSupervisor:base.proposedSupervisor,researchTitle:base.researchTitle,researchArea:base.researchArea,researchAbstract:base.researchAbstract,projectCourseCodes:'TEST7002',canSubmit:mode!=='replacement-pending',blockedReason:mode==='replacement-pending'?'A replacement is already awaiting review.':null,pendingApplicationId:mode==='replacement-pending'?702:null,candidates:[{id:'L2',name:'Dr Replacement',filled:0,total:5,selectable:true}]});
  }
  if(init?.method && init.method!=='GET')throw Error('Presentation checks must not mutate data');
  if(path.endsWith('/requests/primary/701/'))return Response.json({...base,status:'APPROVED',canDecide:false,coordinatorDecisionAt:'2026-10-20T08:00:00Z',appointmentLifecycle:{appointmentId:991,status:'ACTIVE',endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null}});
  if(path.endsWith('/section-a/')){
    if(mode==='stale'&&path.includes('/701/'))await new Promise<void>(resolve=>pending.push(resolve));
    if(mode==='read-error'&&!recovered)return Response.json({detail:'Submitted particulars temporarily unavailable'},{status:503});
    return Response.json({sectionA:mode==='legacy'?null:{...snapshot,noCoursesTaken:mode==='no-courses',courseResults:mode==='no-courses'?[]:snapshot.courseResults,studentParticulars:{...snapshot.studentParticulars,name:path.includes('/702/')?'Second applicant':snapshot.studentParticulars.name}}});
  }
  if(path.endsWith('/research-intent/')){
    if(mode==='stale'&&path.includes('/701/'))await new Promise<void>(resolve=>pending.push(resolve));
    if(mode==='read-error'&&!recovered)return Response.json({detail:'Research Intent temporarily unavailable'},{status:503});
    return Response.json({researchIntent:mode==='legacy'?null:{...intent,introduction:path.includes('/702/')?'Second application introduction':intent.introduction}});
  }
  if(path.endsWith('/download/'))return Response.json({detail:'Document download temporarily unavailable'},{status:503});
  throw Error(`Unexpected test request: ${path}`);
};

let root=createRoot(document.getElementById('root')!);
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
async function until(check:()=>unknown){for(let i=0;i<150;i++){if(check())return;await tick();}throw Error('Timed out waiting for rendered state');}
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const text=()=>document.getElementById('root')!.textContent||'';
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.textContent?.trim()===label);
const disclosure=(title:string)=>[...document.querySelectorAll<HTMLDetailsElement>('details')].find(node=>node.querySelector('summary')?.textContent?.trim()===title);
async function click(label:string){const node=button(label);check(node,`Missing button ${label}`);node!.click();await tick();}

function render(role:string,record=base,showApproval=true){
  const dto=role==='Student'?toStudentSupervisorRequestPresentation(toStudentSupervisorApplication(record)):role==='Office'?officeRequestPresentation(officeApplicationRecord(record)):toSupervisorRequestPresentation(record);
  if(!showApproval)dto.applicationId=undefined;
  const actions=role==='Lecturer'?<LecturerPrimaryRequestActions record={record} busy={false} onAction={()=>actionCount++}/>:role==='Student'&&canStudentCancelSupervisorApplication(record.status,record.initiatedByOffice)?<PortalButton onClick={()=>actionCount++}>Cancel request</PortalButton>:role==='Coordinator'&&record.status==='PENDING_COORDINATOR'?<CoordinatorPrimaryRequestActions record={record} pending busy={false} isRejecting={false} onAction={()=>actionCount++}/>:undefined;
  flushSync(()=>root.render(<SupervisorRequestDetail request={dto} showApproval={showApproval} actions={actions} contextAction={role!=='Student'?<ViewStudentRecordAction studentId={dto.studentId} onOpen={()=>actionCount++}/>:undefined}/>));
}
async function mount(role:string,nextMode='',record=base,showApproval=true){
  flushSync(()=>root.unmount());root=createRoot(document.getElementById('root')!);mode=nextMode;reads=[];actionCount=0;recovered=false;render(role,record,showApproval);await tick();
  await until(()=>nextMode==='read-error'?text().includes('temporarily unavailable'):!text().includes('Loading submitted'));
}
function verifyActionButtons(){
  for(const group of document.querySelectorAll<HTMLElement>('[data-detail-actions]')){
    let previous:DOMRect|undefined;
    for(const node of group.querySelectorAll<HTMLButtonElement>('button')){
      if(!node.getClientRects().length)continue;
      const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
      check(Math.abs(rect.width-group.getBoundingClientRect().width)<2,'Sidebar action is not full width');
      check(rect.height>=32,'Sidebar action is too short');
      check(style.textTransform==='uppercase'&&['10px','11px'].includes(style.fontSize),'Sidebar action should use standard uppercase portal typography');
      if(previous)check(rect.top>=previous.bottom+8,'Sidebar actions are crowded or side by side');
      previous=rect;
    }
  }
}
function verifyLayout(){
  verifyActionButtons();
  const main=document.querySelector<HTMLElement>('.supervisor-request-detail')!;
  check(main.scrollWidth<=main.clientWidth+1,'Page overflows horizontally');
  for(const dd of main.querySelectorAll('dd')){
    if(!dd.getClientRects().length)continue;
    check(getComputedStyle(dd).fontWeight==='400','A field answer is unexpectedly bold');
  }
  for(const heading of main.querySelectorAll('h2')){
    const svg=heading.parentElement?.querySelector(':scope > [aria-hidden="true"] svg');if(!svg)continue;
    const icon=svg.parentElement!.getBoundingClientRect(),title=heading.getBoundingClientRect();
    check(Math.abs((icon.top+icon.bottom-title.top-title.bottom)/2)<=1,'Header icon is misaligned');
  }
  const columns=main.querySelector<HTMLElement>('[data-request-columns]')!;
  const review=[...columns.querySelectorAll<HTMLElement>('[role="region"]')].find(node=>node.textContent?.startsWith('Review and outcome'))!;
  const research=columns.querySelector<HTMLElement>('[role="region"]')!;
  check(main.querySelectorAll('[role="region"]').length>=5,'Evidence has not been split into independent surfaces');
  const a=research.getBoundingClientRect(),b=review.getBoundingClientRect();
  if(innerWidth>=1280){check(b.left>=a.right+24,'Desktop review column is crowded');check(Math.abs(b.top-a.top)<2,'Review column does not align with proposal');}
  else check(b.top>=a.bottom+24,'Mobile review should stack after evidence');
  const labels=['Student information','Research details','Supporting documents and declaration','Review and outcome'];
  const offsets=labels.map(label=>text().indexOf(label));check(offsets.every((value,index)=>value>=0&&(!index||value>offsets[index-1])),'Application section order is wrong');
}
const results:{name:string;error?:string}[]=[];
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name});}catch(error){results.push({name,error:String(error)});}}

for(const role of ['Student','Lecturer','Coordinator','Office'])await scenario(`${role} receives the shared layout and its own actions`,async()=>{
  await mount(role,'',{...base,status:role==='Coordinator'?'PENDING_COORDINATOR':base.status});
  if(role!=='Student'){const action=button('View student record')!;check(action.classList.contains('bg-brand-navy')&&getComputedStyle(action).color==='rgb(255, 255, 255)'&&action.querySelector('svg.lucide-user-round'),'Student record action must use the dark button and student icon');}
  verifyLayout();check(text().includes('Student details recorded at submission.'),'Snapshot source is not identified');check(text().includes('Applicant at submission')&&!text().includes('Current profile name'),'Summary uses current rather than submitted identity');
  check(text().includes('Student-proposed'),'Title origin is missing');
  check(!disclosure('Contact and identity details')!.open,'Contact details initially expanded');
  check(!disclosure('Course results · 1')!.open,'Course results initially expanded');
  check(!disclosure('View full declaration')!.open,'Declaration initially expanded');
  check(text().indexOf('Title proposed by')<text().indexOf('Research Intent'),'Title origin is misplaced');
  check(text().indexOf('Research Intent')<text().indexOf('Supporting documents and declaration'),'Intent appears after declaration');
  const expected=role==='Student'?'Cancel request':role==='Lecturer'?'Accept request':role==='Coordinator'?'Approve request':null;
  check(!button(role==='Student'?'Accept request':'Cancel request'),'Another role action leaked');
  if(expected){await click(expected);check(actionCount===1,'Role action callback no longer works');}
  else check(!button('Approve request')&&!button('Accept request')&&!button('Cancel request'),'Office inherited a review action');
  if(role==='Lecturer'||role==='Coordinator'){await click('Reject request');check(actionCount===2,'Rejection callback no longer works');}
  check(reads.filter(path=>path.endsWith('/section-a/')).length===1&&reads.filter(path=>path.endsWith('/research-intent/')).length===1,'Sensitive detail fetched repeatedly');
});
await scenario('Research Intent opens individually and expands/collapses all groups',async()=>{
  await mount('Lecturer');check(disclosure('Background and purpose')!.open,'First group should be readable');
  check(!disclosure('Research plan')!.open,'Secondary group should start collapsed');
  disclosure('Research plan')!.querySelector('summary')!.click();await until(()=>disclosure('Research plan')!.open);
  await click('Expand all');await until(()=>['Background and purpose','Questions and objectives','Research plan'].every(label=>disclosure(label)!.open));
  check(text().includes('Recorded timeline'),'Research content lost');
  await click('Collapse all');await until(()=>['Background and purpose','Questions and objectives','Research plan'].every(label=>!disclosure(label)!.open));
});
await scenario('Contact, course and declaration evidence remain accessible in full',async()=>{
  await mount('Student');
  for(const title of ['Contact and identity details','Course results · 1','View full declaration']){disclosure(title)!.querySelector('summary')!.click();await until(()=>disclosure(title)!.open);}
  for(const value of ['SYNTHETIC-PASSPORT','submitted@example.test','Recorded address','Research methods','TEST7001','A-','I confirm these submitted particulars.'])check(text().includes(value),`Missing evidence ${value}`);
  verifyLayout();
});
await scenario('Legacy missing records do not invent identity, title origin or declaration',async()=>{
  await mount('Office','legacy');check(text().includes('Current profile name'),'Honest profile fallback lost');
  check(text().includes('No submitted Section A')&&text().includes('No Research Intent was recorded'),'Historical gaps are hidden');
  check(!text().includes('Confirmed by')&&!text().includes('Student-proposed')&&!text().includes('Student details recorded at submission.'),'Missing evidence invented');
});
await scenario('Office replacements omit student-only evidence and its fetches',async()=>{
  await mount('Office','',{...base,initiatedByOffice:true});check(text().includes('Office-initiated replacement'),'Replacement context missing');
  check(!text().includes('Student declaration')&&!text().includes('Research Intent'),'Student evidence fabricated');check(reads.length===0,'Unnecessary student evidence request');
});
await scenario('Read failures stay explicit and both detail reads can retry',async()=>{
  await mount('Lecturer','read-error');check(document.querySelectorAll('[role="alert"]').length===2,'Read errors missing');
  check(!text().includes('No submitted Section A')&&!text().includes('No Research Intent was recorded'),'Failure presented as legacy absence');
  recovered=true;for(const node of [...document.querySelectorAll<HTMLButtonElement>('button')].filter(node=>node.textContent?.trim()==='Retry'))node.click();
  await until(()=>text().includes('Applicant at submission')&&button('Expand all'));check(!document.querySelector('[role="alert"]'),'Recovery left an error');
});
await scenario('Switching records ignores stale identity and Research Intent responses',async()=>{
  flushSync(()=>root.unmount());root=createRoot(document.getElementById('root')!);mode='stale';render('Lecturer');
  await until(()=>pending.length===2);render('Lecturer',{...base,id:702,studentName:'Second current name'});
  await until(()=>text().includes('Second applicant')&&text().includes('Second application introduction'));
  for(const resolve of pending.splice(0))resolve();await tick();await tick();
  check(!document.querySelector('[aria-label="Request overview"]')!.textContent!.includes('Applicant at submission')&&!text().includes('Recorded introduction'),'Stale application evidence leaked');
});
await scenario('Terminal outcomes retain recorded reasons without review actions',async()=>{
  for(const status of ['APPROVED','REJECTED_BY_SUPERVISOR','CANCELLED_BY_OFFICE'] as const){
    await mount('Lecturer','',{...base,status,rejectionReason:status==='REJECTED_BY_SUPERVISOR'?'Recorded rejection':'',cancellationReason:status==='CANCELLED_BY_OFFICE'?'Recorded cancellation':''});
    check(!button('Accept request')&&!button('Reject request'),'Terminal record gained review actions');
    if(status==='REJECTED_BY_SUPERVISOR')check(text().includes('Recorded rejection'),'Rejection reason lost');
    if(status==='CANCELLED_BY_OFFICE')check(text().includes('Recorded cancellation'),'Cancellation reason lost');
  }
});
await scenario('No-courses declaration and failed download remain understandable',async()=>{
  await mount('Lecturer','no-courses');check(text().includes('None declared')&&text().includes('No completed courses declared'),'No-course declaration lost');
  document.querySelector<HTMLButtonElement>('button[title="Download research-proposal.pdf"]')!.click();
  await until(()=>text().includes('Document download temporarily unavailable'));check(text().includes('research-proposal.pdf'),'Failed download removed file');
});
await scenario('A record without an application does not invent an approval process',async()=>{
  await mount('Office','',{...base,id:0,workflow:[]},false);
  check(!text().includes('Review and outcome')&&!text().includes('Approval progress'),'Application-less record invented reviews');
});

// Leave a representative production layout visible in the screenshot.
await mount('Lecturer');
await scenario('Office and Coordinator appointment records stay inside the review sidebar',async()=>{
  const approved:SupervisorApplicationRecord={...base,status:'APPROVED',coordinatorDecisionAt:'2026-10-20T08:00:00Z',appointmentLifecycle:{appointmentId:991,status:'ACTIVE',endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null}};
  for(const role of ['Office','Coordinator']){
    await mount(role,'',approved);
    const administration=role==='Office'?<OfficeAppointmentAdministration record={officeApplicationRecord(approved)} onEnd={async()=>{}}/>:<CoordinatorApplicationLifecycle record={approved} onEnd={async()=>{}}/>;
    flushSync(()=>root.render(<SupervisorRequestDetail request={toSupervisorRequestPresentation(approved)} administration={administration}/>));await tick();
    await until(()=>!text().includes('Loading submitted'));
    const aside=document.querySelector<HTMLElement>('[data-request-sidebar]')!;
    const card=aside?.querySelector<HTMLElement>('[data-supervisor-appointment-record]');check(card,`${role}: record detached from sidebar`);
    const region=aside.querySelector<HTMLElement>('[role="region"]')!.getBoundingClientRect(),box=card!.getBoundingClientRect();
    check(Math.abs(box.width-aside.getBoundingClientRect().width)<2,'Appointment and review widths differ');
    check(box.top-region.bottom>=27,'Appointment card crowds review');
    if(innerWidth>=1280)check(box.width<=321,'Appointment card spans content width');
    check(!card!.querySelector('.sm\\:grid-cols-2'),'Sidebar keeps wide two-column facts');
    check(!!button('End supervisor appointment'),'Existing lifecycle control missing');verifyLayout();
  }
});
await scenario('Actual routed Coordinator request puts exactly one lifecycle card inside its sidebar',async()=>{
  flushSync(()=>root.unmount());root=createRoot(document.getElementById('root')!);mode='';reads=[];
  flushSync(()=>root.render(<CoordinatorSupervisorApprovals initialApplicationId="701" backLabel="Back to history"/>));
  await until(()=>!!document.querySelector('[data-supervisor-appointment-record]'));
  await until(()=>!text().includes('Loading submitted'));
  const cards=document.querySelectorAll<HTMLElement>('[data-supervisor-appointment-record]');check(cards.length===1,'Routed host duplicates appointment record');
  const sidebar=cards[0].closest<HTMLElement>('[data-request-sidebar]');check(sidebar,'Actual route appends lifecycle outside the shared layout');
  check(Math.abs(cards[0].getBoundingClientRect().width-sidebar!.getBoundingClientRect().width)<2,'Routed record width differs');
  check(reads.some(path=>path.endsWith('/requests/primary/701/')),'Actual Coordinator API route was not exercised');verifyLayout();
});
await scenario('Office approved request opens the existing change form and returns to its request',async()=>{
  flushSync(()=>root.unmount());root=createRoot(document.getElementById('root')!);mode='';reads=[];
  const approved={...base,status:'APPROVED' as const,appointmentLifecycle:{appointmentId:991,status:'ACTIVE' as const,endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null}};
  let refreshes=0;
  flushSync(()=>root.render(<SupervisorAppointmentManagement routeView="detail" routeRecordId={base.studentId} providedRecord={officeApplicationRecord(approved)} onProvidedRecordRefresh={()=>{refreshes++;}}/>));
  await until(()=>button('Request supervisor change'));
  check(reads.some(path=>path.endsWith('/appointments/991/replacement/')),'Eligibility was not checked on the server');
  check(disclosure('Manage appointment')?.contains(button('Request supervisor change')!),'Change control is outside management');
  disclosure('Manage appointment')!.querySelector('summary')!.click();await click('Request supervisor change');
  await until(()=>document.querySelector('#replacement-supervisor'));
  await click('Back to appointment request');await until(()=>button('Request supervisor change'));
  disclosure('Manage appointment')!.querySelector('summary')!.click();await click('Request supervisor change');
  await until(()=>document.querySelector('#replacement-supervisor'));
  const select=document.querySelector<HTMLSelectElement>('select')!;
  select.value='L2';select.dispatchEvent(new Event('change',{bubbles:true}));
  const reason=document.querySelector<HTMLTextAreaElement>('#primary-replacement-reason')!;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(reason,'Supervisor is taking extended leave.');reason.dispatchEvent(new Event('input',{bubbles:true}));
  await until(()=>!button('Send for review')?.disabled);await click('Send for review');
  await until(()=>text().includes('Replacement requested. The proposed supervisor will review it next.'));
  await until(()=>text().includes('A replacement is already awaiting review.'));
  check(!button('Request supervisor change'),'Submitted replacement still offers another change');
  check(refreshes===1,'Source request was not refreshed after submission');
  check(!!document.querySelector('[data-request-sidebar]'),'Did not return to approved request');
});
await scenario('Office change action fails closed and can retry eligibility; pending and ended appointments stay protected',async()=>{
  const lifecycle={appointmentId:991,status:'ACTIVE' as const,endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null};
  const approved={...base,status:'APPROVED' as const,appointmentLifecycle:lifecycle};
  for(const nextMode of ['replacement-error','replacement-pending']){
    flushSync(()=>root.unmount());root=createRoot(document.getElementById('root')!);mode=nextMode;recovered=false;
    flushSync(()=>root.render(<OfficeAppointmentAdministration record={officeApplicationRecord(approved)} onChange={()=>{}} onEnd={async()=>{}}/>));
    await until(()=>nextMode==='replacement-error'?button('Retry availability check'):text().includes('A replacement is already awaiting review.'));
    check(!button('Request supervisor change'),'Unavailable appointment gained a change action');
    if(nextMode==='replacement-error'){recovered=true;await click('Retry availability check');await until(()=>button('Request supervisor change'));}
  }
  flushSync(()=>root.unmount());root=createRoot(document.getElementById('root')!);reads=[];
  flushSync(()=>root.render(<OfficeAppointmentAdministration record={officeApplicationRecord({...approved,appointmentLifecycle:{...lifecycle,status:'ENDED'}})} onChange={()=>{}} onEnd={async()=>{}}/>));await tick();
  check(!button('Request supervisor change')&&!reads.length,'Ended appointment checked or offered a replacement');
});
// Leave the Office request and its new management action visible for visual review.
flushSync(()=>root.unmount());root=createRoot(document.getElementById('root')!);mode='';
flushSync(()=>root.render(<SupervisorAppointmentManagement routeView="detail" routeRecordId={base.studentId} providedRecord={officeApplicationRecord({...base,status:'APPROVED',appointmentLifecycle:{appointmentId:991,status:'ACTIVE',endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null}})}/>));
await until(()=>button('Request supervisor change'));
disclosure('Manage appointment')!.querySelector('summary')!.click();await tick();
document.querySelector('[data-supervisor-appointment-record]')!.scrollIntoView({block:'center'});
parent.postMessage({type:'supervisor-detail-results',width:innerWidth,results},location.origin);
