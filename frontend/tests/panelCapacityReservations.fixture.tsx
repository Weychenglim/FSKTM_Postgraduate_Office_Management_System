import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {MemoryRouter} from 'react-router';
import {PanelRecommendationReviewDrawer} from '../src/components/LecturerPanelAppointments';
import {PanelLecturerSummaryCards} from '../src/components/PanelLecturerSummaryCards';
import type {PanelRecommendationDraft} from '../src/types';

const host=document.getElementById('root')!;
let root=createRoot(host),accepted=0,rejected=0;
const capacity={activeLoad:4,reservedLoad:0,limit:5,availableSlots:1,pendingRequests:2,state:'AVAILABLE' as const};
const base:PanelRecommendationDraft={id:91,studentId:'TEST-91',studentName:'Synthetic Student',programme:'Computing',semester:'Synthetic semester',proposedTopic:'Synthetic capacity research',abstract:'Synthetic research description.',recommendedMember:'Dr Panel',recommendedMemberId:'L1',supervisorName:'Dr Supervisor',submittedDate:'29 Oct 2026',status:'SUBMITTED_TO_PANEL',canReview:true,acceptanceCapacity:capacity};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const text=()=>host.textContent??'';
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label);
function check(value:unknown,message:string){if(!value)throw Error(message);}
async function until(check:()=>unknown){for(let i=0;i<150;i++){if(check())return;await tick();}throw Error(`Timed out: ${text()}`);}
async function mount(row:PanelRecommendationDraft=base,role:'SELECTED_PANEL'|'PROGRAMME_COORDINATOR'='SELECTED_PANEL'){
  flushSync(()=>root.unmount());root=createRoot(host);
  flushSync(()=>root.render(<MemoryRouter><PanelRecommendationReviewDrawer isOpen recommendation={row} reviewerRole={role} onClose={()=>{}} onAccept={()=>{accepted++;}} onReject={()=>{rejected++;}}/></MemoryRouter>));
  await tick();
}
const results:{name:string;error?:string}[]=[];
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name});}catch(error){results.push({name,error:String(error)});}}

await scenario('last-place warning appears before acceptance and acceptance occurs only on confirmation',async()=>{
  await mount();check(!button('Accept request')!.disabled,'Last place must be acceptable');button('Accept request')!.click();await until(()=>document.querySelector('dialog[open]'));
  const dialog=document.querySelector('dialog[open]')!;
  check(dialog.textContent?.includes('Synthetic Student · Computing'),'Student context punctuation is corrupted');
  check(dialog.querySelector('[role="status"]')?.textContent?.includes('Last available place'),'Prominent warning missing');
  check(dialog.textContent?.includes('Accepting reserves this place until Coordinator approval.'),'Reservation timing missing');
  check(dialog.textContent?.includes('1 other pending nomination may close after final approval.'),'Other nomination count wrong');
  check(accepted===0,'Decision submitted before confirmation');button('Accept nomination')!.click();await until(()=>accepted===1);
});
await scenario('full request policy blocks acceptance and keeps rejection usable',async()=>{
  await mount({...base,acceptanceCapacity:{...capacity,availableSlots:0,reservedLoad:1,state:'FULL'}});
  check(button('Accept request')!.disabled,'Full capacity accepted');check(!button('Reject request')!.disabled,'Rejection blocked');
  button('Reject request')!.click();await until(()=>document.querySelector('dialog[open]'));check(!!document.querySelector('textarea'),'Rejection reason missing');
});
await scenario('missing policy fails closed without invented available places',async()=>{
  await mount({...base,acceptanceCapacity:null});
  check(button('Accept request')!.disabled&&text().includes('Refresh to check availability'),'Missing metadata silently enables acceptance or hides recovery');
  await mount({...base,acceptanceCapacity:{...capacity,limit:null,availableSlots:0,state:'NOT_CONFIGURED'}});
  check(button('Accept request')!.disabled,'Unconfigured capacity accepted');check(text().includes('Availability not configured'),'Missing policy hidden');
});
await scenario('temporary unavailability blocks only acceptance',async()=>{
  await mount({...base,acceptanceCapacity:{...capacity,state:'TEMPORARILY_UNAVAILABLE'}});
  check(button('Accept request')!.disabled&&!button('Reject request')!.disabled,'Restriction bypassed or rejection blocked');
  check(text().includes('Unavailable for new requests'),'Restriction hidden');
});
await scenario('Coordinator can convert own reservation at full capacity',async()=>{
  await mount({...base,status:'PENDING_COORDINATOR',acceptanceCapacity:{...capacity,availableSlots:0,reservedLoad:1,state:'FULL'}},'PROGRAMME_COORDINATOR');
  check(!button('Approve request')!.disabled,'Own reservation incorrectly blocks approval');button('Approve request')!.click();await until(()=>document.querySelector('dialog[open]'));
  check(!document.querySelector('dialog')?.textContent?.includes('Last available place'),'Acceptance warning wrongly shown at approval');
});
await scenario('capacity closure is shown as a System outcome without decision buttons',async()=>{
  await mount({...base,status:'CANCELLED_CAPACITY_FULL',acceptanceCapacity:null,cancellationReason:'Panel capacity is full.',workflow:[{id:1,actorName:'System',actorRole:'SYSTEM',action:'SYSTEM_CLOSE_CAPACITY',previousStatus:'SUBMITTED_TO_PANEL',newStatus:'CANCELLED_CAPACITY_FULL',reason:'Panel capacity is full.',createdAt:'2026-10-29T00:00:00Z'}]});
  check(text().includes('Capacity full')&&text().includes('System'),'Closure misrepresented');check(!button('Accept request')&&!button('Reject request'),'Closed request is actionable');
});
await scenario('last-place dialog fits viewport and separates active from reserved',async()=>{
  await mount();check(text().includes('4 active')&&text().includes('0 reserved'),'Counts conflated');button('Accept request')!.click();await until(()=>document.querySelector('dialog[open]'));
  const bounds=document.querySelector('dialog')!.getBoundingClientRect();check(bounds.left>=0&&bounds.right<=innerWidth+1,'Dialog overflows');check(document.documentElement.scrollWidth<=innerWidth+1,'Page overflows');
});
await scenario('workload card highlights the last remaining place',async()=>{
  flushSync(()=>root.unmount());root=createRoot(host);flushSync(()=>root.render(<PanelLecturerSummaryCards workload={{currentStudents:4,workloadCount:4,confirmedAppointments:4,pendingNominations:0,workloadLimit:5,availableSlots:1,capacityState:'AVAILABLE',selectable:true}} reviewCount={2} awaitingCoordinatorCount={0}/>));await tick();
  check(text().includes('1 place remaining')&&text().includes('4 active appointments'),'Workload alert missing');check(document.documentElement.scrollWidth<=innerWidth+1,'Workload overflows');
});
await mount();button('Accept request')!.click();await until(()=>document.querySelector('dialog[open]'));
parent.postMessage({type:'capacity-reservation-results',width:innerWidth,results},location.origin);
