import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {LecturerPanelAppointments} from '../src/components/LecturerPanelAppointments';
import {SupervisoryTeamManagement} from '../src/components/SupervisoryTeamManagement';

const container=document.getElementById('root')!;
const results:{name:string;error:string|null}[]=[];
let root:Root|null=null;
const check=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const until=async(predicate:()=>unknown)=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error(`Timed out: ${container.textContent}`);};
const button=(label:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(row=>row.textContent?.trim()===label);
const change=(field:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,value:string)=>{
  const prototype=field instanceof HTMLSelectElement?HTMLSelectElement.prototype:field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(field,value);
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement?'change':'input',{bubbles:true}));
};
async function mount(element:React.ReactNode){root?.unmount();root=createRoot(container);root.render(<MemoryRouter>{element}</MemoryRouter>);}
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name,error:null});}catch(error){results.push({name,error:error instanceof Error?error.message:String(error)});}}
const user={id:'C1',role:'Programme Coordinator',fullName:'Coordinator',email:'coordinator@example.test',department:'Computing'} as const;

await scenario('Panel detail Retry repeats the failed exact record GET',async()=>{
  let exactGets=0;
  window.fetch=async input=>{
    const path=new URL(String(input),location.origin).pathname;
    if(path.endsWith('/coordinator-workspace/'))return Response.json({programme:'Computing',programmes:['Computing'],queue:[],records:[],pendingCount:0});
    if(path.endsWith('/recommendations/77/')){exactGets++;return exactGets===1?Response.json({detail:'Exact recommendation unavailable'},{status:503}):Response.json({id:77,studentId:'PG007',studentName:'Exact Student',programme:'Computing',proposedTopic:'Research',recommendedMember:'Dr Panel',recommendedMemberId:'P1',submittedDate:'2026-10-01',status:'APPROVED',workflow:[]});}
    throw new Error(`Unexpected route ${path}`);
  };
  await mount(<LecturerPanelAppointments currentUser={user} initialRecommendationId="77"/>);
  await until(()=>!!button('Retry')&&container.textContent?.includes('Exact recommendation unavailable'));
  button('Retry')!.click();
  await until(()=>container.textContent?.includes('Exact Student'));
  check(exactGets===2,'Retry must repeat the exact recommendation GET once');
});

await scenario('Failed Panel nomination keeps its selected member and notes with an inline error',async()=>{
  let posts=0;
  window.fetch=async(input,options)=>{
    const path=new URL(String(input),location.origin).pathname;
    if(path.endsWith('/recommendations/')&&options?.method==='POST'){posts++;return Response.json({detail:'Panel nomination could not be saved'},{status:500});}
    if(path.endsWith('/eligible-supervisees/'))return Response.json([{studentId:'PG007',studentName:'Fixture Student',programme:'Computing',semester:'S1',proposedTopic:'Research',researchArea:'Networks',abstract:'Abstract',supervisorName:'Dr Primary',supervisorId:'SV1',supervisorAppointmentId:4,panelAppointmentId:null,currentPanelMember:null,currentPanelMemberId:null,canRecommend:true}]);
    if(path.endsWith('/candidates/'))return Response.json([{staffId:'P1',name:'Dr Panel',department:'Computing',workloadCount:1,workloadLimit:3,canSubmit:true,availability:'Available',workloadHelpText:'',selectable:true,capacityState:'AVAILABLE'}]);
    if(path.endsWith('/my-workload/'))return Response.json({workloadCount:1,workloadLimit:3,currentStudents:1,confirmedAppointments:1,pendingNominations:0,capacityState:'AVAILABLE',selectable:true,records:[]});
    return Response.json([]);
  };
  await mount(<LecturerPanelAppointments currentUser={{...user,role:'Lecturer',staffId:'SV1'}} initialSuperviseeId="PG007"/>);
  await until(()=>!!container.querySelector('#recommendation-notes-textarea'));
  container.querySelector<HTMLInputElement>('#panel-candidate-search')!.click();
  await until(()=>!!container.querySelector('[role="listbox"][aria-label="Panel candidates"] [role="option"]'));
  container.querySelector<HTMLButtonElement>('[role="listbox"][aria-label="Panel candidates"] [role="option"]')!.click();
  change(container.querySelector<HTMLTextAreaElement>('#recommendation-notes-textarea')!,'Keep my Panel recommendation notes');
  await until(()=>!container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.disabled);
  container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.click();
  await until(()=>posts===1&&container.querySelector('form [role="alert"]')?.textContent?.includes('Panel nomination could not be saved'));
  check(container.querySelector<HTMLTextAreaElement>('#recommendation-notes-textarea')!.value==='Keep my Panel recommendation notes','Failure discarded Panel notes');
  check(container.querySelector('form')?.textContent?.includes('Proposed Panel member')&&!!button('Remove selection'),'Failure discarded selected Panel member');
  check(posts===1,'Submission failure must not automatically repeat the POST');
});

const team={studentId:7,matricNo:'PG007',studentName:'Fixture Student',programme:'Computing',studentStatus:'Active',primarySupervisor:{id:9,name:'Dr Primary'},primaryAppointmentId:4,research:{title:'Current title',area:'Networks',abstract:'Abstract'},appointments:[],nominations:[],canNominate:true,timeline:[]};
async function supporting(conflict:boolean|403,saved=false,cancelBeforeRecovery=false){
  let reads=0,posts=0;
  window.fetch=async(input,options)=>{
    const path=new URL(String(input),location.origin).pathname;
    if(path.endsWith('/nominations/')&&options?.method==='POST'){posts++;return saved?Response.json({id:21},{status:201}):Response.json({detail:conflict?'Nomination eligibility changed':'Nomination could not be saved'},{status:conflict===403?403:conflict?409:500});}
    if(path.endsWith('/candidates/'))return Response.json([{id:8,name:'Dr Supporting',selectable:true,reason:'',capacityState:'AVAILABLE',activeLoad:1,limit:3}]);
    if(path.endsWith('/co-supervisor/')){reads++;return reads===2?Response.json({detail:'Workspace refresh unavailable'},{status:503}):Response.json({teams:[team],appointments:[],nominations:[]});}
    throw new Error(`Unexpected route ${path}`);
  };
  await mount(<SupervisoryTeamManagement role="Lecturer"/>);
  await until(()=>!!button('Nominate co-supervisor'));button('Nominate co-supervisor')!.click();
  await until(()=>!!container.querySelector('select'));
  change(container.querySelector('select')!,'8');change(container.querySelector('textarea')!,'Keep this nomination justification');
  await until(()=>!button('Submit nomination')!.disabled);button('Submit nomination')!.click();
  if(saved){
    await until(()=>posts===1&&container.textContent?.includes('Your nomination was saved.'));
    check(!button('Submit nomination'),'Committed nomination must close its form');
    button('Nominate co-supervisor')?.click();
    await new Promise(resolve=>setTimeout(resolve,20));
    check(!button('Submit nomination'),'Failed refresh must not allow a new nomination from stale eligibility');
    check(button('Reload supervisory team'),'Saved result needs a read-only recovery action');
    button('Reload supervisory team')!.click();await until(()=>reads===3);
    check(posts===1,'Saved-result recovery must not repeat the write');return;
  }
  await until(()=>posts===1&&container.querySelector('form [role="alert"]')?.textContent?.includes(conflict?'Nomination eligibility changed':'Nomination could not be saved')&&(!conflict||container.textContent?.includes('Workspace refresh unavailable')));
  const form=button('Submit nomination')!.closest('form')!;
  check(form.querySelector('[role="alert"]')?.textContent?.includes(conflict?'Nomination eligibility changed':'Nomination could not be saved'),'Write failure must be an inline error in its form');
  check(form.querySelector<HTMLTextAreaElement>('textarea')!.value==='Keep this nomination justification','Failure discarded justification');
  check(form.querySelector<HTMLSelectElement>('select')!.value==='8','Failure discarded candidate');
  if(conflict){
    check(button('Submit nomination')!.disabled,'Unreconciled eligibility must prevent a repeat write');
    check(button('Reload nomination availability'),'Recovery read needs a contextual action');
    if(cancelBeforeRecovery){button('Cancel')!.click();await until(()=>button('Discard changes'));button('Discard changes')!.click();await until(()=>!button('Submit nomination'));check(button('Reload supervisory team'),'Cancel hid the only recovery action');button('Reload supervisory team')!.click();await until(()=>reads===3);check(posts===1,'Cancelled recovery repeated write');return;}
    button('Reload nomination availability')!.click();
    await until(()=>reads===3&&!button('Submit nomination')!.disabled);
    check(form.querySelector<HTMLTextAreaElement>('textarea')!.value==='Keep this nomination justification','Read retry discarded justification');
    check(posts===1,'Read retry must never repeat nomination');
  }
}
await scenario('Failed supporting nomination keeps inputs and displays an inline error',()=>supporting(false));
await scenario('Conflicting nomination and failed recovery read preserve input and block duplicate writes',()=>supporting(true));
await scenario('Forbidden supporting nomination and failed recovery retain input and block writes',()=>supporting(403));
await scenario('Saved supporting nomination survives refresh failure without another write',()=>supporting(false,true));
await scenario('Cancelling conflicted nomination keeps recovery available',()=>supporting(true,false,true));
root?.unmount();document.getElementById('test-results')!.textContent=JSON.stringify(results);
