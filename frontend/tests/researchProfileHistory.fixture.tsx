import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {ResearchAmendments} from '../src/components/ResearchAmendments';
import type {UserRole} from '../src/types/auth';
import type {ResearchAmendment, ResearchRevision} from '../src/services/researchAmendmentsApi';

const container=document.getElementById('root')!;
const results:{name:string;error:string|null}[]=[];
const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const until=async(predicate:()=>unknown)=>{for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error(`Timed out: ${container.textContent}`);};
const snapshot={programme:'Computing',title:'Explainable recommendations for postgraduate academic support',abstract:'First saved paragraph explaining the research purpose.\n\nA second complete paragraph describing the approved methods and scope.'};
const longMethodology='DetailedMethodology'.repeat(100);
const plan={aim:'Improve student support',researchQuestions:'What information do students need?',researchObjectives:'Evaluate answer quality',methodology:longMethodology,timeline:'May to August'};
const revisions:ResearchRevision[]=[
  {id:1,studentId:7,revision:0,kind:'BASELINE',before:{programme:'',title:'',abstract:''},after:{...snapshot,title:'Original title'},actorName:'Office',createdAt:'2026-10-01T08:00:00Z',reason:'',requestId:null},
  {id:2,studentId:7,revision:2,kind:'RESEARCH',before:{...snapshot,title:'Original title'},after:snapshot,actorName:'Dr Reviewer',createdAt:'2026-10-18T08:00:00Z',reason:'Approved scope clarification',requestId:5},
  {id:3,studentId:7,revision:3,kind:'RESEARCH',before:{...snapshot,methodology:'Interview students',timeline:'June to August'},after:{...snapshot,methodology:plan.methodology,timeline:plan.timeline},actorName:'Dr Reviewer',createdAt:'2026-10-20T08:00:00Z',reason:'Updated evaluation',requestId:6},
];
let root:Root|null=null,savedRevisions=revisions,missingProfile=false,failRead=false,longContent=false,actionsEnabled=true;
let requests:ResearchAmendment[]=[];
let calls:string[]=[];
function render(role:UserRole='Lecturer',studentId=7,routeView:'profile'|'list'='profile'){
  root!.render(<ResearchAmendments role={role} hideHeader showRefresh={false} routeView={routeView} studentFilter={studentId} onStudentFilter={()=>{}} onNavigateToNew={kind=>calls.push(kind??'default')} onNavigateToRequest={id=>calls.push(id)}/>);
}
async function mount(role:UserRole='Lecturer',rows=revisions,missing=false,failed=false,routeView:'profile'|'list'='profile'){
  root?.unmount();savedRevisions=rows;missingProfile=missing;failRead=failed;calls=[];
  window.fetch=async(input,init)=>{
    check(!init?.method||init.method==='GET','Only reads are permitted');
    const url=new URL(String(input),location.origin);check(url.pathname.startsWith('/api/appointments/research-amendments/'),'Unexpected API route');
    if(failRead)return Response.json({detail:'Fixture read failed'},{status:500});
    const studentId=Number(url.searchParams.get('studentId')||7);
    const intentRequested=url.searchParams.get('includeResearchIntent')==='true';
    return Response.json(url.pathname.endsWith('/options/')?{
      students:[{id:studentId,name:longContent?'LongStudentName'.repeat(25):`Student ${studentId}`,matricNo:`PG-00${studentId}`,programme:snapshot.programme}],programmes:['Computing','Cybersecurity'],
      profile:missingProfile?null:{...snapshot,...(intentRequested?{researchArea:'Information systems',currentIntent:plan}:{}),...(longContent?{title:'ResearchTerm'.repeat(80),abstract:'AbstractTerm'.repeat(150)}:{}),studentId,revision:3},
      canSubmitResearch:actionsEnabled&&role==='Student',canCorrect:actionsEnabled&&role==='Office Staff/Admin',canTransfer:false,
    }:{requests,revisions:savedRevisions});
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
  for(const dd of container.querySelectorAll('[data-research-profile-detail] dd:not(.font-semibold)'))check(getComputedStyle(dd).fontWeight==='400','Current research answers should have regular weight');
  for(const region of container.querySelectorAll('[data-research-profile-detail] > [role="region"], [data-current-research] > [role="region"]'))check(!region.querySelector('.bg-white.rounded-2xl'),'Current profile contains a nested white card');
}
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name,error:null});}catch(error){results.push({name,error:String(error)});}}

await scenario('Every role gets separate overview, readable research and visible history',async()=>{
  for(const role of ['Student','Lecturer','Programme Coordinator','Office Staff/Admin'] as const){
    await mount(role);const current=container.querySelector('section[aria-label="Current research profile"]'),card=history();
    check(current&&card&&current.nextElementSibling===card,'History is separate from current content');
    check(container.querySelector('[aria-label="Student overview"]')&&container.querySelector('[data-current-research]'),'Reading surfaces missing');
    for(const value of ['Information systems','Current research plan',...Object.values(plan)])check(current!.textContent?.includes(value),`${role} missing ${value}`);
    const planSection = button('Expand all')!.closest('section')!;
    const headerButton = button('Expand all')!.getBoundingClientRect();
    const firstGroup = planSection.querySelector('summary')!.getBoundingClientRect();
    check(firstGroup.top - headerButton.bottom >= 23, `${role} research plan header is too close to the first group`);
    check(card!.querySelector('summary')!.textContent?.includes('Methodology and timeline updated'),'History summaries must be visible');
    check(card!.querySelectorAll('summary').length===3,'Two changes and the initial record required');
    const latest = card!.querySelector<HTMLDetailsElement>('details')!;
    check(!latest.open,`${role} history must start collapsed`);
    latest.querySelector('summary')!.click();
    check(latest.open&&latest.textContent?.includes(longMethodology),`${role} cannot read the full recorded change`);
    check(!current!.textContent?.includes('Dr Reviewer'),'Revision metadata belongs in history');
    check(!container.querySelector('[data-current-research]')!.textContent?.includes('Original title'),'Historical title leaked into current research');geometry();
  }
});
await scenario('Newest-first individual disclosures preserve saved comparisons and reasons',async()=>{
  await mount();const entries=history()!.querySelectorAll<HTMLDetailsElement>('details');check(entries.length===3,'Two changes and the initial record required');
  check(entries[0].querySelector('summary')?.textContent?.includes('Revision 3'),'Newest revision must be first');
  check([...entries].every(entry=>!entry.open),'Individual comparisons must begin collapsed');
  entries[0].querySelector('summary')!.click();check(entries[0].open,'Revision did not expand');
  for(const value of ['Interview students',longMethodology,'June to August','May to August','Updated evaluation','Recorded before this revision','Recorded after revision'])check(entries[0].textContent?.includes(value),value);
  check(!entries[0].textContent?.includes(snapshot.title)&&!entries[0].textContent?.includes('First saved paragraph'),'Unchanged content repeated');
  entries[2].querySelector('summary')!.click();check(entries[2].open&&entries[2].textContent?.includes('Original title'),'Baseline missing');
  check(revisions[0].revision===0,'Input revision order was mutated');geometry();
});
await scenario('Student selection resets expanded version details',async()=>{
  await mount();history()!.querySelector('summary')!.click();render('Lecturer',8);
  await until(()=>container.querySelector('[aria-label="Student overview"]')?.textContent?.includes('Student 8'));
  check([...history()!.querySelectorAll<HTMLDetailsElement>('details')].every(row=>!row.open),'Another student inherited expanded evidence');geometry();
});
await scenario('Empty, unavailable, failed and list views stay honest',async()=>{
  await mount('Student',[]);check(history()?.textContent?.includes('No research changes recorded yet'),'Empty history needs a clear message');
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
await scenario('Pending student review has a clear status and opens the matching request',async()=>{
  const pending:ResearchAmendment={
    id:19,kind:'RESEARCH',status:'PENDING_SUPERVISOR',studentId:7,studentName:'Student 7',matricNo:'PG-007',
    sourceProgramme:'Computing',destinationProgramme:'',before:snapshot,after:{...snapshot,title:'Proposed title'},
    reason:'Clarify the scope',createdAt:'2026-10-21T08:00:00Z',updatedAt:'2026-10-21T08:00:00Z',stageLabel:'Awaiting supervisor review',
    canDecide:false,canCancel:true,requiresTeamAcknowledgement:false,teamSnapshot:{primary:null,coSupervisors:[],panel:[]},
    unfinishedTaskCount:null,events:[],
  };
  actionsEnabled=false;
  try {
    requests=[{...pending,id:18,studentId:8},pending];
    await mount('Student');
    const overview=container.querySelector('[aria-label="Student overview"]');
    check(overview?.textContent?.includes('Awaiting supervisor review')&&overview.textContent.includes('approves the request'),'Pending review status or approval guidance missing');
    check(container.querySelector('[data-current-research]')?.textContent?.includes(snapshot.title)&&!container.textContent?.includes('Proposed title'),'Pending changes replaced approved research');
    button('View request')!.click();check(calls.join(',')==='19','Pending request action opened the wrong request');geometry();
    await mount('Lecturer');check(!button('View request'),'Student status action leaked to the lecturer profile');
    requests=[{...pending,status:'APPROVED'}];
    await mount('Student');check(!button('View request')&&!container.textContent?.includes('Awaiting supervisor review'),'Completed request still shows a pending notice');
  } finally {
    requests=[];
    actionsEnabled=true;
  }
});
await scenario('An initial record and no-op revision do not count as changes',async()=>{
  await mount('Student',[revisions[0],{...revisions[1],before:revisions[1].after}]);
  check(history()?.textContent?.includes('No research changes recorded yet'),'A record without changed fields counted as a change');
  check(history()?.querySelector('summary')?.textContent==='View initial record','The initial record needs its own disclosure');
});
await scenario('Long research terms and identity wrap without truncation or overflow',async()=>{
  longContent=true;await mount('Office Staff/Admin');geometry();check(container.textContent?.includes('ResearchTerm'.repeat(80)),'Title was truncated');longContent=false;
});
await scenario('Failed profile reads can retry without creating academic changes',async()=>{
  await mount('Office Staff/Admin',revisions,false,true);failRead=false;button('Retry')!.click();await until(()=>container.querySelector('[data-research-profile-detail]'));check(history(),'Recovered profile lost history');geometry();
});
await mount('Office Staff/Admin');
parent.postMessage({type:'research-profile-results',width:innerWidth,results},location.origin);
