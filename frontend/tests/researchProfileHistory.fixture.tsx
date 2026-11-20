import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {ResearchAmendments} from '../src/components/ResearchAmendments';
import type {UserRole} from '../src/types/auth';
import type {ResearchRevision} from '../src/services/researchAmendmentsApi';

const container=document.getElementById('root')!;
const results:{name:string;error:string|null}[]=[];
const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const until=async(predicate:()=>unknown)=>{for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error(`Timed out: ${container.textContent}`);};
const snapshot={programme:'Computing',title:'Explainable recommendations for postgraduate academic support',abstract:'First saved paragraph explaining the research purpose.\n\nA second complete paragraph describing the approved methods and scope.'};
const revisions:ResearchRevision[]=[
  {id:1,studentId:7,revision:0,kind:'BASELINE',before:{programme:'',title:'',abstract:''},after:{...snapshot,title:'Original title'},actorName:'Office',createdAt:'2026-10-01T08:00:00Z',reason:'',requestId:null},
  {id:2,studentId:7,revision:2,kind:'RESEARCH',before:{...snapshot,title:'Original title'},after:snapshot,actorName:'Dr Reviewer',createdAt:'2026-10-18T08:00:00Z',reason:'Approved scope clarification',requestId:5},
];
let root:Root|null=null,savedRevisions=revisions,missingProfile=false,failRead=false,longContent=false,actionsEnabled=true;
let calls:string[]=[];
function render(role:UserRole='Lecturer',studentId=7,routeView:'profile'|'list'='profile'){
  root!.render(<ResearchAmendments role={role} hideHeader showRefresh={false} routeView={routeView} studentFilter={studentId} onStudentFilter={()=>{}} onNavigateToNew={kind=>calls.push(kind??'default')}/>);
}
async function mount(role:UserRole='Lecturer',rows=revisions,missing=false,failed=false,routeView:'profile'|'list'='profile'){
  root?.unmount();savedRevisions=rows;missingProfile=missing;failRead=failed;calls=[];
  window.fetch=async(input,init)=>{
    check(!init?.method||init.method==='GET','Only reads are permitted');
    const url=new URL(String(input),location.origin);check(url.pathname.startsWith('/api/appointments/research-amendments/'),'Unexpected API route');
    if(failRead)return Response.json({detail:'Fixture read failed'},{status:500});
    const studentId=Number(url.searchParams.get('studentId')||7);
    return Response.json(url.pathname.endsWith('/options/')?{
      students:[{id:studentId,name:longContent?'LongStudentName'.repeat(25):`Student ${studentId}`,matricNo:`PG-00${studentId}`,programme:snapshot.programme}],programmes:['Computing','Cybersecurity'],
      profile:missingProfile?null:{...snapshot,...(longContent?{title:'ResearchTerm'.repeat(80),abstract:'AbstractTerm'.repeat(150)}:{}),studentId,revision:2},
      canSubmitResearch:actionsEnabled&&role==='Student',canCorrect:actionsEnabled&&role==='Office Staff/Admin',canTransfer:false,
    }:{requests:[],revisions:savedRevisions});
  };
  root=createRoot(container);render(role,7,routeView);
  await until(()=>!container.textContent?.includes('Loading research changes')&&!!container.textContent);
}
const history=()=>container.querySelector<HTMLElement>('section[aria-label="Revision history"]');
const button=(label:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(row=>row.textContent?.trim()===label);
function geometry(){
  check(document.documentElement.scrollWidth<=innerWidth,'Page overflows the viewport');
  for(const element of container.querySelectorAll<HTMLElement>('[data-research-profile-detail], [data-current-research], [aria-label="Revision history"], button')){
    const r=element.getBoundingClientRect();if(r.width)check(r.left>=0&&r.right<=innerWidth+1,'Profile surface or button overflows');
  }
  for(const dd of container.querySelectorAll('[data-research-profile-detail] dd'))check(getComputedStyle(dd).fontWeight==='400','Current research answers should have regular weight');
  for(const region of container.querySelectorAll('[data-research-profile-detail] > [role="region"], [data-current-research] > [role="region"]'))check(!region.querySelector('.bg-white.rounded-2xl'),'Current profile contains a nested white card');
}
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name,error:null});}catch(error){results.push({name,error:String(error)});}}

await scenario('Every role gets separate overview, readable research and visible history',async()=>{
  for(const role of ['Student','Lecturer','Programme Coordinator','Office Staff/Admin'] as const){
    await mount(role);const current=container.querySelector('section[aria-label="Current research profile"]'),card=history();
    check(current&&card&&current.nextElementSibling===card,'History is separate from current content');
    check(container.querySelector('[aria-label="Student overview"]')&&container.querySelector('[data-current-research]'),'Reading surfaces missing');
    check(card!.textContent?.includes('2 saved versions')&&card!.querySelectorAll('summary').length===2,'History summaries must be visible');
    check(container.querySelector('[data-current-research]')!.textContent?.includes('Dr Reviewer'),'Current revision metadata missing');
    check(!container.querySelector('[data-current-research]')!.textContent?.includes('Original title'),'Historical title leaked into current research');geometry();
  }
});
await scenario('Newest-first individual disclosures preserve saved comparisons and reasons',async()=>{
  await mount();const entries=history()!.querySelectorAll<HTMLDetailsElement>('details');check(entries.length===2,'Both saved versions required');
  check(entries[0].querySelector('summary')?.textContent?.includes('Revision 2'),'Newest revision must be first');
  check(!entries[0].open&&!entries[1].open,'Individual comparisons must begin collapsed');
  entries[0].querySelector('summary')!.click();check(entries[0].open,'Revision did not expand');
  for(const value of ['Original title','Approved scope clarification','Recorded before this revision','Recorded after revision'])check(entries[0].textContent?.includes(value),value);
  entries[1].querySelector('summary')!.click();check(entries[1].textContent?.includes('Initial record'),'Baseline missing');
  check(revisions[0].revision===0,'Input revision order was mutated');geometry();
});
await scenario('Student selection resets expanded version details',async()=>{
  await mount();history()!.querySelector('summary')!.click();render('Lecturer',8);
  await until(()=>container.querySelector('[aria-label="Student overview"]')?.textContent?.includes('Student 8'));
  check([...history()!.querySelectorAll<HTMLDetailsElement>('details')].every(row=>!row.open),'Another student inherited expanded evidence');geometry();
});
await scenario('Empty, unavailable, failed and list views stay honest',async()=>{
  await mount('Student',[]);check(history()?.textContent?.includes('No saved research revisions'),'Empty history needs a clear message');
  await mount('Lecturer',revisions,true);check(!history()&&!container.querySelector('[data-research-profile-detail]'),'Missing profile has stale reading/history');
  await mount('Lecturer',revisions,false,true);check(!history(),'Failed load has stale history');
  await mount('Student',revisions,false,false,'list');check(!history(),'Request list contains profile history');
});
await scenario('Role-specific actions offer Office correction and student research requests',async()=>{
  await mount('Office Staff/Admin');check(!button('Request programme transfer'),'Disabled transfer action rendered');button('Correct research text')!.click();check(calls.join(',')==='CORRECTION','Office action intent lost');
  await mount('Student');check(!button('Correct research text')&&!button('Request programme transfer'),'Staff actions leaked to Student');button('Request research change')!.click();check(calls[0]==='RESEARCH','Student amendment intent lost');
  for(const role of ['Lecturer','Programme Coordinator'] as const){await mount(role);check(!button('Correct research text')&&!button('Request programme transfer')&&!button('Request research change'),'Read-only role gained mutation actions');}
  actionsEnabled=false;await mount('Office Staff/Admin');check(!button('Correct research text')&&!button('Request programme transfer'),'Unavailable capabilities still show controls');actionsEnabled=true;
});
await scenario('Non-current or mismatched revisions cannot supply current-update metadata',async()=>{
  await mount('Lecturer',[{...revisions[1],revision:3}]);check(!container.querySelector('[data-current-research]')!.textContent?.includes('Dr Reviewer'),'A later saved version supplied current metadata');
  await mount('Lecturer',[{...revisions[1],studentId:8}]);check(!container.querySelector('[data-current-research]')!.textContent?.includes('Dr Reviewer'),'Another student supplied current metadata');
});
await scenario('Long research terms and identity wrap without truncation or overflow',async()=>{
  longContent=true;await mount('Office Staff/Admin');geometry();check(container.textContent?.includes('ResearchTerm'.repeat(80)),'Title was truncated');longContent=false;
});
await scenario('Failed profile reads can retry without creating academic changes',async()=>{
  await mount('Office Staff/Admin',revisions,false,true);failRead=false;button('Retry')!.click();await until(()=>container.querySelector('[data-research-profile-detail]'));check(history(),'Recovered profile lost history');geometry();
});
await mount('Office Staff/Admin');
parent.postMessage({type:'research-profile-results',width:innerWidth,results},location.origin);
