import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {StudentSupervisorAppointment} from '../src/components/StudentSupervisorAppointment';
import {RecommendPanelMemberDrawer} from '../src/components/RecommendPanelMemberDrawer';
import {MarkEntryDetail} from '../src/components/MarkEntryDetail';
import type {EvaluationTask} from '../src/types';
const container=document.getElementById('root')!;
let root:Root|null=null;
const results:{name:string;error:string|null}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const pause=()=>new Promise(resolve=>setTimeout(resolve,10));
async function until(predicate:()=>unknown){for(let i=0;i<150;i++){if(predicate())return;await pause();}throw Error('Timed out: '+container.textContent);}
const button=(text:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.textContent?.trim()===text || node.getAttribute('aria-label')===text);
async function mount(node:React.ReactNode){root?.unmount();root=createRoot(container);root.render(<MemoryRouter>{node}</MemoryRouter>);await pause();}
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name,error:null});}catch(error){results.push({name,error:String(error)});}}
const availability={enforcementEnabled:true,canSubmit:false,status:'UPCOMING',opensAt:'2026-11-01T07:49:00Z',closesAt:'2026-11-03T07:49:00Z',effectiveDueAt:null,message:'Not open yet'};
await scenario('Student launch rechecks availability and explains blocked access in a modal',async()=>{
 let allowed=false,failed=false,navigations=0,reads=0;
 window.fetch=async input=>{const path=String(input);if(path.includes('/availability/')){reads++;if(failed)return Response.json({detail:'Service unavailable'},{status:503});return Response.json({...availability,canSubmit:allowed,status:allowed?'OPEN':'UPCOMING'});}return Response.json([]);};
 await mount(<StudentSupervisorAppointment routeView="applications" onNavigateToNewApplication={()=>navigations++}/>);
 await until(()=>button('New application') && !button('New application')?.disabled);
 check(!container.textContent?.includes('Not open yet'),'Header must not show availability beside New application');
 check(!container.textContent?.includes('Opens 01'),'Header must not contain a date paragraph');
 button('New application')!.click();button('New application')!.click();
 await until(()=>!!document.querySelector('dialog[open]'));
 check(navigations===0&&reads===2,'Blocked or double click incorrectly navigated or rechecked twice');
 const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!;
 check(dialog.textContent?.includes('Applications not open yet')&&dialog.textContent.includes('01 Nov 2026'),'Missing reason or opening time');
 check(!!dialog.getAttribute('aria-describedby')&&!!dialog.querySelector('time'),'Modal must associate explanation and structured opening time');
 check(!!dialog.querySelector('[aria-label="Close availability dialog"]'),'Shared modal close control missing');
 dialog.querySelector<HTMLButtonElement>('[aria-label="Close availability dialog"]')!.click();
 await until(()=>!document.querySelector('dialog[open]'));
 await until(()=>document.activeElement===button('New application'));
 allowed=true;button('New application')!.click();await until(()=>navigations===1);
 check(reads===3&&!document.querySelector('dialog[open]'),'Open intake should navigate without a blocking dialog');
 allowed=false;button('New application')!.click();await until(()=>!!document.querySelector('dialog[open]'));
 allowed=true;[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(node=>node.textContent==='Check availability')!.click();await until(()=>navigations===2);
 check(!document.querySelector('dialog[open]'),'Recheck should close the dialog when applications open');
 failed=true;button('New application')!.click();await until(()=>!!document.querySelector('dialog[open]'));
 check(navigations===2&&document.querySelector('dialog')?.textContent?.includes('Availability could not be checked'),'Failed availability read must explain the failure without navigating');
 failed=false;[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(node=>node.textContent==='Check availability')!.click();await until(()=>navigations===3);

});
await scenario('Panel cannot submit while availability loads or is blocked; refresh preserves the nomination',async()=>{
 let resolve!:(value:Response)=>void,reads=0,submitted=0;
 window.fetch=async()=>{reads++;if(reads===1)return new Promise<Response>(done=>resolve=done);return Response.json({...availability,canSubmit:true,status:'OPEN'});};
 await mount(<RecommendPanelMemberDrawer isOpen student={{studentUserId:7,studentName:'Fixture Student',studentId:'PG007',programme:'Computing',intake:'Semester I',supervisor:'Dr Primary',initials:'FS',proposedTopic:'Research',area:'Computing',abstract:'Research abstract'}} candidates={[{staffId:'P1',name:'Dr Panel',department:'Computing',workloadCount:0,workloadLimit:3,canSubmit:true,selectable:true,availability:'Available',workloadHelpText:''}]} onClose={()=>{}} onSubmit={()=>submitted++}/>);
 const search=container.querySelector<HTMLInputElement>('#panel-candidate-search')!;search.click();await until(()=>!!container.querySelector('[role="option"]'));
 container.querySelector<HTMLButtonElement>('[role="option"]')!.click();
 const notes=container.querySelector<HTMLTextAreaElement>('#recommendation-notes-textarea')!;
 Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(notes,'Matching research expertise');notes.dispatchEvent(new Event('input',{bubbles:true}));await pause();
 check(button('Submit to Panel')?.disabled,'Panel submission must wait for availability');
 resolve(Response.json(availability));await until(()=>container.textContent?.includes('Recommendations not open yet'));
 button('Submit to Panel')!.click();check(submitted===0,'Closed Panel intake submitted');
 button('Check availability')!.click();await until(()=>!button('Submit to Panel')?.disabled);
 check(notes.value==='Matching research expertise','Rechecking discarded notes');button('Submit to Panel')!.click();await until(()=>submitted===1);
});
const base:EvaluationTask={id:9,studentId:'PG007',studentName:'Fixture Student',initials:'FS',researchTitle:'Research title',semester:'Semester I',deadline:'2026-11-03',status:'NOT STARTED',canEdit:false,canSubmit:false,components:[{id:1,code:'QUALITY',name:'Research quality',description:'Quality',maxMarks:'100',required:true,marksAwarded:null,feedback:''}]};
for(const state of ['SCHEDULED','CLOSED','EXTRA_TIME'])await scenario('Marks permissions and notice: '+state,async()=>{
 let saves=0;const extra=state==='EXTRA_TIME';
 await mount(<MarkEntryDetail task={{...base,periodEffectiveStatus:extra?'CLOSED':state,canEdit:extra,canSubmit:extra,...(extra?{completionWindow:{status:'ACTIVE',deadline:'2026-11-06T04:00:00Z'}}:{})} as EvaluationTask} onBack={()=>{}} onSave={()=>{saves++;}} onSubmit={()=>{saves++;}}/>);
 await until(()=>!!container.querySelector('[aria-label="Marking availability"]'));
 check(container.textContent?.includes(extra?'Extra time available':state==='SCHEDULED'?'Marking not open yet':'Marking closed'),'Wrong marking availability');
 check(!!button('Save draft')===extra,'Read-only task exposed a draft action');
 check(!!button('Submit marks')===extra,'Read-only task exposed a submit action');
 check(saves===0,'Viewing task caused a write');
});
if(new URLSearchParams(location.search).has('frame')){
 window.fetch=async input=>String(input).includes('/availability/')?Response.json(availability):Response.json([]);
 await mount(<StudentSupervisorAppointment routeView="applications" onNavigateToNewApplication={()=>{}}/>);
 await until(()=>button('New application') && !button('New application')?.disabled);
 button('New application')!.click();
 await until(()=>!!document.querySelector('dialog[open]'));
 const notice=document.querySelector('dialog[open]')!;
 check(notice.getBoundingClientRect().width<=innerWidth,'Modal overflows viewport');
 check(document.documentElement.scrollWidth<=innerWidth+1,'Workspace overflows viewport');
 parent.postMessage({type:'periods-workspace-results',results},location.origin);
}else{root?.unmount();document.getElementById('test-results')!.textContent=JSON.stringify(results);}
