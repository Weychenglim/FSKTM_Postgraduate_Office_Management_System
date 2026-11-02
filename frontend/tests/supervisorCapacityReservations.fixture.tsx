import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {MemoryRouter} from 'react-router';
import {LecturerAppointmentRequests} from '../src/components/LecturerAppointmentRequests';
import {StudentSupervisorAppointment} from '../src/components/StudentSupervisorAppointment';
import {SupervisorRequestDetail,toSupervisorRequestPresentation} from '../src/components/SupervisorRequestDetail';
import {officeRequestPresentation} from '../src/components/SupervisorAppointmentManagement';
import {officeApplicationRecord} from '../src/components/OfficeSupervisorWorkspace';
import {CoordinatorPrimaryRequestActions} from '../src/components/CoordinatorSupervisorApprovals';
import {SupervisorCandidateOption,SupervisorSelectionSummary} from '../src/components/SupervisorAppointmentApplicationPage';
import {StudentSupervisorApplications} from '../src/components/StudentSupervisorApplications';
import {toStudentSupervisorApplication} from '../src/services/appointmentsApi';
import type {SupervisorApplicationRecord,SupervisorAcceptanceCapacity,SupervisorWorkloadSummary,SupervisorRequest} from '../src/types';

const available:SupervisorAcceptanceCapacity={activeLoad:4,reservedLoad:0,limit:5,availableSlots:1,pendingRequests:2,state:'AVAILABLE'};
let record:SupervisorApplicationRecord={id:701,studentId:'TEST-001',studentName:'Synthetic Student',programme:'Computing',semester:'S1',proposedSupervisor:'Synthetic Supervisor',proposedSupervisorId:'L1',researchTitle:'Research capacity fixture',researchArea:'Computing',researchAbstract:'Synthetic proposal',researchProfileReady:true,rejectionReason:'',submittedAt:'2026-10-27T00:00:00Z',workflow:[],status:'SUBMITTED_TO_SUPERVISOR',acceptanceCapacity:available};
const base={...record};
const full={...available,reservedLoad:1,availableSlots:0,state:'FULL'} as const;
const lastPlaceWorkload:SupervisorWorkloadSummary={currentStudents:4,activeLoad:4,reservedLoad:0,workloadCount:4,workloadLimit:5,availableSlots:1,pendingRequests:2,capacityState:'AVAILABLE',selectable:true,semesterCode:'S1',capacityPlanVersion:1};
const pendingRows:SupervisorRequest[]=[701,702].map(id=>({applicationId:id,studentId:`TEST-${id}`,studentName:id===701?'Synthetic Student':'Second Synthetic Student',programme:'Computing',semester:'S1',proposedTopic:'Research capacity fixture',researchArea:'Computing',submittedDate:'27 Oct 2026',receivedTime:'2026-10-27T00:00:00Z',status:'SUBMITTED_TO_SUPERVISOR'}));
let mutations=0,navigations=0,actions=0,supportingMode=false;
let incumbent:SupervisorApplicationRecord|null=null;
window.fetch=async(input,init)=>{
 const path=new URL(String(input),location.origin).pathname;
 if(init?.method&&init.method!=='GET'){mutations++;throw Error('Capacity presentation must never write live records');}
 if(path.endsWith('/request-history/'))return Response.json([]);
 if(path.endsWith('/co-supervisor/'))return Response.json({teams:[],nominations:supportingMode?[{id:801,studentId:1,matricNo:'TEST-SUPPORT',studentName:'Supporting Student',programme:'Computing',semester:'S1',candidate:{id:2,name:'Supporting Supervisor'},nominator:{id:3,name:'Primary Supervisor'},status:'SUBMITTED_TO_CO_SUPERVISOR',justification:'Complementary expertise',reason:'',submittedAt:'2026-10-27T00:00:00Z',replacesAppointmentId:null,allowedActions:['accept','reject'],history:[]}]:[],appointments:[]});
 if(path.endsWith('/applications/701/'))return Response.json(record);
 if(path.endsWith('/applications/'))return Response.json(incumbent?[incumbent,record]:[record]);
 if(path.endsWith('/section-a/'))return Response.json({sectionA:null});
 if(path.endsWith('/research-intent/'))return Response.json({researchIntent:null});
 throw Error(`Unexpected fixture read ${path}`);
};
const host=document.getElementById('root')!;
let root=createRoot(host);
const text=()=>host.textContent??'';
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(row=>row.textContent?.trim()===label);
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function until(check:()=>unknown){for(let i=0;i<150;i++){if(check())return;await tick();}throw Error(`Timed out: ${text()}`);}
function check(value:unknown,message:string){if(!value)throw Error(message);}
async function mount(node:React.ReactNode){flushSync(()=>root.unmount());root=createRoot(host);flushSync(()=>root.render(<MemoryRouter>{node}</MemoryRouter>));await tick();}
async function lecturer(detail=true,load?:SupervisorWorkloadSummary){await mount(<LecturerAppointmentRequests primaryRequests={pendingRows} primaryLoading={false} primaryError={null} refreshVersion={0} onChanged={async()=>{}} initialApplicationId={detail?'701':undefined} workload={load??{currentStudents:4,activeLoad:4,reservedLoad:1,workloadCount:5,workloadLimit:5,availableSlots:0,capacityState:'FULL',selectable:false,semesterCode:'S1',capacityPlanVersion:1}}/>);await until(()=>detail?button('Accept request'):text().includes('Supervisory load'));}
async function student(){await mount(<StudentSupervisorAppointment initialApplicationId="701" routeView="applications" onNavigateToNewApplication={()=>navigations++}/>);await until(()=>text().includes('Research capacity fixture'));}
const closed=():SupervisorApplicationRecord=>({...base,status:'CANCELLED_CAPACITY_FULL',acceptanceCapacity:null,cancelledAt:'2026-10-27T03:00:00Z',cancellationReason:'Supervisor capacity is full.',workflow:[{id:1,action:'SYSTEM_CLOSE_CAPACITY',actorName:'System',actorRole:'SYSTEM',previousStatus:'SUBMITTED_TO_SUPERVISOR',newStatus:'CANCELLED_CAPACITY_FULL',reason:'Supervisor capacity is full.',createdAt:'2026-10-27T03:00:00Z'}]});
const results:{name:string;error?:string}[]=[];
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name});}catch(error){results.push({name,error:String(error)});}}

await scenario('request capacity drives last-place confirmation despite full dashboard',async()=>{
 record={...base};await lecturer();check(!button('Accept request')!.disabled,'Dashboard capacity incorrectly blocks effective request policy');button('Accept request')!.click();await until(()=>document.querySelector('dialog[open]'));
 const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!;check(dialog.textContent?.toLowerCase().includes('last available place'),'Final place warning missing');check(dialog.textContent?.includes('reserve')&&dialog.textContent?.includes('Coordinator'),'Reservation and final approval explanation missing');check(dialog.textContent?.includes('1 other pending request may close'),'Other waiting request count or singular wording is incorrect');
 const warning=dialog.querySelector<HTMLElement>('[role="status"]');check(warning?.textContent?.includes('Last available place'),'Last-place warning is not visually separated from ordinary dialog copy');
 check(getComputedStyle(warning!).backgroundColor!==getComputedStyle(dialog).backgroundColor,'Last-place warning has no distinct background');check((warning!.textContent??'').trim().split(/\s+/).length<=36,'Last-place warning is too wordy');
 check(dialog.scrollWidth<=dialog.clientWidth+1,'Decision dialog overflows');check(dialog.contains(document.activeElement),'Decision dialog has no keyboard focus');
 dialog.dispatchEvent(new Event('cancel',{cancelable:true}));await until(()=>!document.querySelector('dialog[open]'));check(mutations===0,'Opening or dismissing confirmation mutated data');
});
await scenario('direct request URL confirms the fetched Student identity',async()=>{
 record={...base};await mount(<LecturerAppointmentRequests primaryRequests={[]} primaryLoading={false} primaryError={null} refreshVersion={0} onChanged={async()=>{}} initialApplicationId="701"/>);await until(()=>button('Accept request'));button('Accept request')!.click();await until(()=>document.querySelector('dialog[open]'));const content=document.querySelector('dialog[open]')?.textContent;check(content?.includes('Synthetic Student')&&content.includes('TEST-001')&&content.includes('Computing'),'Confirmation loses fetched Student identity on a direct URL');
});
await scenario('supporting acceptance does not promise a primary capacity reservation',async()=>{
 supportingMode=true;
 try{
  await mount(<LecturerAppointmentRequests primaryRequests={[]} primaryLoading={false} primaryError={null} refreshVersion={0} onChanged={async()=>{}} initialSupportingId="801"/>);
  await until(()=>button('Accept'));button('Accept')!.click();await until(()=>document.querySelector('dialog[open]'));
  const dialog=document.querySelector('dialog[open]')!;
  check(!dialog.textContent?.includes('reserves a place')&&!dialog.textContent?.includes('reserve your last'),'Supporting acceptance incorrectly promises a primary capacity reservation');
  check(dialog.textContent?.includes('Coordinator'),'Supporting acceptance loses final approval explanation');
  check(!button('Accept request')?.disabled,'Supporting nomination is blocked by unrelated primary request policy');
 }finally{supportingMode=false;}
});
await scenario('full request disables only acceptance and keeps rejection operable',async()=>{
 record={...base,acceptanceCapacity:full};await lecturer();check(button('Accept request')!.disabled,'Full request permits acceptance');check(!button('Reject request')!.disabled,'Full request blocks rejection');check(!document.querySelector('[aria-label="Current request capacity"]'),'Redundant request capacity summary remains');button('Reject request')!.click();await until(()=>document.querySelector('dialog[open] textarea'));check(document.querySelector('dialog[open]')?.textContent?.includes('Reject request'),'Reject dialog unavailable');
});
await scenario('existing Supervisory load distinguishes active reserved and available',async()=>{
 await lecturer(false);const card=document.querySelector('[aria-label="Supervisory load"]')!;check(card.textContent?.includes('awaiting approval')&&!card.querySelector('dl'),'Workload card should have one compact capacity line');
});
await scenario('one remaining place warns in the existing load card before review',async()=>{
 await lecturer(false,lastPlaceWorkload);const card=document.querySelector('[aria-label="Supervisory load"]')!;check(card.textContent?.includes('1 place remaining'),'Last place is indistinguishable from ordinary availability');check(card.querySelector('.text-amber-700,.text-amber-800'),'Last place has no warning emphasis');
});
await scenario('Student retains cancellation when another acceptance reserves the final place',async()=>{
 record={...base,acceptanceCapacity:full};await student();check(text().includes('final place is reserved'),'Student cannot understand blocked request');check(text().includes('apply elsewhere'),'Student recovery guidance missing');check(!button('Cancel request')!.disabled,'Student cannot cancel unaccepted request');button('Cancel request')!.click();await until(()=>document.querySelector('dialog[open] textarea'));check(document.querySelector('dialog[open]')?.textContent?.includes('Cancellation reason'),'Cancellation flow no longer opens');
 record={...base,acceptanceCapacity:{...full,activeLoad:5,state:'OVER_CAPACITY'}};await student();check(text().includes('no available places')&&!text().includes('final place is reserved'),'Already full active workload is incorrectly attributed to a reservation');check(button('Cancel request'),'Over-capacity request loses ordinary cancellation');
});
await scenario('unconfigured capacity does not tell Student that places are full',async()=>{
 for(const state of ['NOT_CONFIGURED','TEMPORARILY_UNAVAILABLE','INELIGIBLE','FULL'] as const){record={...base,acceptanceCapacity:{...full,limit:state==='TEMPORARILY_UNAVAILABLE'||state==='INELIGIBLE'?5:null,state}};await student();check(!text().includes('no available places')&&!text().includes('final place is reserved'),`${state}: restriction or missing policy presented as full capacity`);check(button('Cancel request'),'Missing policy removes ordinary cancellation');}
});
await scenario('capacity closure has neutral outcome and existing new application route',async()=>{
 record=closed();await student();check(text().includes('Capacity full'),'Closure status is unclear');check(text().includes('Closed automatically'),'Automatic closure explanation missing');check(!text().includes('Supervisor rejected')&&!button('Cancel request'),'Closure invents reviewer or pending action');check(button('New application'),'Closure lacks recovery action');button('New application')!.click();check(navigations===1,'Recovery bypassed existing application route');
});
await scenario('closed Office replacement directs Student to Office and preserves incumbent',async()=>{
 record={...closed(),initiatedByOffice:true,replacesAppointmentId:10};
 incumbent={...base,id:700,status:'APPROVED',appointmentLifecycle:{appointmentId:10,status:'ACTIVE',endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null}};
 try{await student();check(!text().includes('You can choose another eligible Supervisor'),'Office replacement incorrectly tells Student to self-apply');check(text().includes('Postgraduate Office'),'Office replacement lacks correct recovery contact');check(!button('New application'),'Office replacement allows Student to initiate replacement');incumbent=null;await student();check(!button('New application'),'Missing incumbent projection allows Student to initiate an Office replacement');}
 finally{incumbent=null;}
});
await scenario('Coordinator and Office retain neutral system closure detail',async()=>{
 for(const role of ['Coordinator','Office']){const presentation=role==='Office'?officeRequestPresentation(officeApplicationRecord(record)):toSupervisorRequestPresentation(record);await mount(<SupervisorRequestDetail request={presentation} actions={role==='Coordinator'?<CoordinatorPrimaryRequestActions record={record} pending={false} busy={false} isRejecting={false} onAction={()=>actions++}/>:undefined}/>);await until(()=>text().includes('Closed automatically'));check(!button('Approve request')&&!button('Reject request'),'Terminal outcome gained Coordinator actions');check(!text().includes('Supervisor rejected'),'System outcome looks like rejection');}
});
await scenario('mobile and desktop review surfaces fit the viewport',async()=>{
 record={...base,acceptanceCapacity:full};await lecturer();check(document.documentElement.scrollWidth<=innerWidth+1,'Page overflows viewport');for(const group of document.querySelectorAll<HTMLElement>('[data-detail-actions]'))for(const node of group.querySelectorAll<HTMLButtonElement>('button'))check(node.getBoundingClientRect().height>=44,'Review action touch target too short');
});
await scenario('capacity-full requests appear in Student history with neutral wording',async()=>{
 let viewed='';await mount(<StudentSupervisorApplications applications={[toStudentSupervisorApplication(closed())]} onViewApplication={id=>viewed=id}/>);check(text().includes('No ongoing supervisor requests'),'Capacity closure appears ongoing');button('History')!.click();await until(()=>document.querySelector('tbody'));check(document.querySelector('tbody')?.textContent?.includes('Capacity full'),'History hides closure outcome');check(!document.querySelector('tbody')?.textContent?.includes('Rejected'),'History invents rejection');button('View request')!.click();check(viewed==='701','History loses request navigation');
});
await scenario('candidate choice shows remaining places and selected summary explains reservations',async()=>{
 const candidate={id:'L1',name:'Synthetic Supervisor',initials:'SS',domain:'Computing',filled:5,total:6,activeLoad:4,reservedLoad:1,availableSlots:1,capacityState:'AVAILABLE' as const,selectable:true};
 let toggles=0;await mount(<SupervisorCandidateOption candidate={candidate} selected={false} onToggle={()=>toggles++}/>);
 check(text().includes('1 Supervisor place remaining'),'Candidate does not show its remaining place');host.querySelector('button')!.click();check(toggles===1,'Available candidate cannot be selected');check(document.documentElement.scrollWidth<=innerWidth+1,'Candidate card overflows');
 await mount(<SupervisorSelectionSummary candidate={candidate} busy={false} onClear={()=>{}}/>);
 check(text().includes('4 active supervisees')&&text().includes('1 place held pending approval')&&!text().includes('Limit 6'),`Selected supervisor does not explain active and reserved capacity: ${text()}`);
 check(text().includes('1 Supervisor place remaining')&&document.documentElement.scrollWidth<=innerWidth+1,'Selected supervisor availability or layout is misleading');
});
const preview=new URLSearchParams(location.search).get('preview');
if(preview==='last-place'){record={...base};await lecturer();button('Accept request')!.click();await until(()=>document.querySelector('dialog[open]'));}
else if(preview==='student-closed'){record=closed();await student();if(innerWidth<700)document.querySelector('[data-request-sidebar]')?.scrollIntoView({block:'start'});}
else if(preview==='student-reserved'){record={...base,acceptanceCapacity:full};await student();if(innerWidth<700)button('Cancel request')?.scrollIntoView({block:'end'});}
else if(preview==='candidate'){await mount(<SupervisorCandidateOption candidate={{id:'L1',name:'Synthetic Supervisor',initials:'SS',domain:'Computing',filled:5,total:6,activeLoad:4,reservedLoad:1,availableSlots:1,capacityState:'AVAILABLE',selectable:true}} selected onToggle={()=>{}}/>);}
else if(preview==='load')await lecturer(false,lastPlaceWorkload);
else {record={...base,acceptanceCapacity:full};await lecturer();if(innerWidth<700)button('Reject request')?.scrollIntoView({block:'end'});}
await tick();
parent.postMessage({type:'capacity-reservation-results',width:innerWidth,results},location.origin);
