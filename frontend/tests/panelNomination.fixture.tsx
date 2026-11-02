import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {createBrowserRouter,RouterProvider} from 'react-router';
import {RecommendPanelMemberDrawer,type StudentData} from '../src/components/RecommendPanelMemberDrawer';
import {SupervisorCandidateOption,SupervisorSelectionSummary} from '../src/components/SupervisorAppointmentApplicationPage';
import {PanelBrowse} from '../src/components/PanelBrowse';
import type {PanelCandidate} from '../src/types';
import type {PanelPresentation} from '../src/utils/panelPresentation';

const container=document.getElementById('root')!;
let root:Root|null=null;
let router:ReturnType<typeof createBrowserRouter>|null=null;
const results:{name:string;error:string|null}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const pause=()=>new Promise(r=>setTimeout(r,0));
async function until(predicate:()=>unknown){for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out: '+container.textContent);}
async function mount(node:React.ReactNode){root?.unmount();await pause();router?.dispose();router=null;root=createRoot(container);root.render(node);await until(()=>!!container.textContent);await pause();}
async function mountRouted(outcome:'success'|'failure'='success'){
  root?.unmount();await pause();router?.dispose();
  history.replaceState(null,'','/panel-nomination-test?frame');
  router=createBrowserRouter([{path:'*',element:<NominationLifecycle outcome={outcome}/>}]);
  root=createRoot(container);root.render(<RouterProvider router={router}/>);
  await until(()=>!!combo()&&!!router?.state.location.state?.portalRecordPage);await pause();
}
const settleHistory=()=>new Promise(resolve=>setTimeout(resolve,40));
async function value(input:HTMLInputElement|HTMLTextAreaElement,text:string){const prototype=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));await pause();}
const button=(text:string,scope:ParentNode=container)=>[...scope.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===text);
const combo=()=>container.querySelector<HTMLInputElement>('#panel-candidate-search')!;
async function key(key:string){combo().dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));await pause();}
async function choose(){combo().focus();await key('ArrowDown');await key('Enter');}
async function notes(text='  Expertise in interpretable learning matches this project.  '){await value(container.querySelector<HTMLTextAreaElement>('#recommendation-notes-textarea')!,text);}
const student:StudentData={studentName:'Aina Sofea Rahman (Demo)',studentId:'DEMO-PG-071',programme:'Master of Data Science (Coursework)',intake:'Semester I 2026/2027',supervisor:'Dr Nadia Hassan',initials:'AR',proposedTopic:'Explainable early-warning models for postgraduate academic support',area:'Explainable artificial intelligence and educational data mining',abstract:'This study compares interpretable models for postgraduate academic support using synthetic student records.\n\nTwo explanation layouts will be evaluated for comprehension. No real student records are used.'};
const eligible:PanelCandidate={staffId:'L071',name:'Dr Amir Hakim',department:'Artificial Intelligence',workloadCount:2,workloadLimit:5,activeLoad:1,reservedLoad:1,availableSlots:3,selectable:true,canSubmit:true,capacityState:'AVAILABLE',availability:'Available',workloadHelpText:''};
const full:PanelCandidate={...eligible,staffId:'L099',name:'Dr Full Capacity',workloadCount:5,availableSlots:0,selectable:false,canSubmit:false,capacityState:'FULL'};
const render=(props:Partial<React.ComponentProps<typeof RecommendPanelMemberDrawer>>={})=><RecommendPanelMemberDrawer isOpen student={student} candidates={[full,eligible]} onClose={()=>{}} onSubmit={()=>{}} {...props}/>;
// Keep the drawer mounted when hidden, matching LecturerPanelAppointments.
function NominationLifecycle({outcome='success'}:{outcome?:'success'|'failure'}){
  const [open,setOpen]=React.useState(true);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState<string|null>(null);
  const [studentId,setStudentId]=React.useState(student.studentId);
  const [appointmentId,setAppointmentId]=React.useState<number|null>(301);
  const [studentName,setStudentName]=React.useState(student.studentName);
  return <><button onClick={()=>setOpen(true)}>Reopen nomination</button>
    <button onClick={()=>setStudentId('DEMO-PG-072')}>Switch student</button>
    <button onClick={()=>setStudentName('Updated student name')}>Refresh student details</button>
    <button onClick={()=>setAppointmentId(302)}>Switch replacement appointment</button>
    <button onClick={()=>setAppointmentId(null)}>Switch to new nomination</button>
    <RecommendPanelMemberDrawer isOpen={open} busy={busy} submitError={error}
      student={{...student,studentId,studentName}} candidates={[full,eligible]}
      replacementMember={appointmentId===null?null:'Dr Current Panel'} replacementAppointmentId={appointmentId}
      onClose={()=>setOpen(false)} onSubmit={()=>{
        setBusy(true);setError(null);
        setTimeout(()=>{setBusy(false);if(outcome==='success')setOpen(false);else setError('Capacity changed; choose another member.');},0);
      }}/></>;
}
const draftNotes=()=>container.querySelector<HTMLTextAreaElement>('#recommendation-notes-textarea')!;
const draftReason=()=>container.querySelector<HTMLTextAreaElement>('#panel-replacement-reason')!;
async function completeReplacement(){await choose();await notes('Draft recommendation');await value(draftReason(),'Draft replacement reason');}
function checkDraftRetained(){check(container.querySelector('#candidate-name')?.textContent==='Dr Amir Hakim'&&draftNotes().value==='Draft recommendation'&&draftReason().value==='Draft replacement reason','Draft edits were lost');}
function checkDraftEmpty(){check(!container.querySelector('#candidate-highlight-card')&&draftNotes().value===''&&(!draftReason()||draftReason().value==='')&&combo().value==='','Discarded or completed draft was resurrected');check(container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.disabled,'Empty draft can submit');}
function geometry(){check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow');for(const dd of container.querySelectorAll('dd')){check(getComputedStyle(dd).fontWeight==='400','Bold answer');check(parseFloat(getComputedStyle(dd).fontSize)>=14,'Small answer');}const cols=container.querySelector('[data-panel-nomination-columns]');if(cols){const a=cols.children[0].getBoundingClientRect(),b=cols.children[1].getBoundingClientRect();check(innerWidth>=1280?b.left-a.right>=27:b.top-a.bottom>=27,'Form section spacing');}for(const b of container.querySelectorAll<HTMLButtonElement>('#submit-recommendation-btn,#candidate-highlight-card button,[data-panel-record-action]'))check(b.getBoundingClientRect().height>=44,'Small action');}
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name,error:null});}catch(error){results.push({name,error:String(error)});}}
window.fetch=async()=>{throw Error('Unexpected HTTP request');};

await scenario('Keyboard picker skips unavailable candidates and Enter selects without submitting',async()=>{
  let submitted=0;await mount(render({onSubmit:()=>submitted++}));combo().focus();await key('ArrowDown');const active=combo().getAttribute('aria-activedescendant');check(active&&document.getElementById(active)?.textContent?.includes('Dr Amir Hakim'),'Available keyboard option not active');
  check(container.querySelector('[role="listbox"]'),'Missing listbox');check(container.querySelector('[role="listbox"]')?.textContent?.includes('3 Panel places remaining'),'Missing capacity before selection');await key('Enter');check(container.querySelector('#candidate-name')?.textContent==='Dr Amir Hakim','Keyboard selection failed');check(submitted===0&&combo().getAttribute('aria-expanded')==='false','Enter submitted or left popup open');check(container.querySelector('#candidate-highlight-card')?.textContent?.includes('1 awaiting Coordinator approval'),'Missing accepted capacity breakdown');geometry();
});
await scenario('Search, option semantics, Escape and removal keep focus and selection predictable',async()=>{
  await mount(render());await value(combo(),'L071');check(container.querySelectorAll('[role="option"]').length===1,'Staff ID search failed');await key('ArrowDown');await key('Enter');
  await value(combo(),'Artificial');check(container.querySelector('[role="option"][aria-selected="true"]'),'Selected option not announced');await key('Escape');check(combo().getAttribute('aria-expanded')==='false','Escape failed');
  button('Remove selection')!.click();await pause();check(!container.querySelector('#candidate-highlight-card')&&document.activeElement===combo(),'Removal lost focus or kept candidate');
  await value(combo(),'Not a candidate');check(container.textContent?.includes('No matching lecturers'),'No-match state absent');await key('Enter');check(!container.querySelector('#candidate-highlight-card'),'No-match Enter chose candidate');
});
await scenario('Replacement submission requires both reasons and submits the exact trimmed candidate payload',async()=>{
  let saved:unknown;await mount(render({replacementMember:'Dr Current Panel',onSubmit:(...args)=>{saved=args;}}));await choose();await notes();check(container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.disabled,'Missing replacement reason allowed');
  await value(container.querySelector<HTMLTextAreaElement>('#panel-replacement-reason')!,'  Specialist project expertise is required.  ');check(container.textContent?.includes('Dr Current Panel')&&container.textContent?.includes('remains active until final coordinator approval'),'Continuity missing');
  container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.click();await pause();check(JSON.stringify(saved)===JSON.stringify(['Expertise in interpretable learning matches this project.','L071','Specialist project expertise is required.']),'Submission payload changed');geometry();
});
await scenario('Busy and refreshed unavailable candidates cannot submit or change the selected member',async()=>{
  let saved=0;const props={onSubmit:()=>saved++};await mount(render(props));await choose();await notes();root!.render(render({...props,busy:true}));await pause();check(combo().disabled&&container.querySelector<HTMLTextAreaElement>('#recommendation-notes-textarea')!.disabled,'Busy edits allowed');container.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await pause();check(saved===0,'Busy submit ran');
  root!.render(render({...props,candidates:[{...eligible,selectable:false,canSubmit:false,capacityState:'FULL'}]}));await until(()=>container.textContent?.includes('workload limit'));check(container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.disabled,'Refreshed unavailable candidate can submit');
});
await scenario('Supervisor and unavailable capacity states preserve eligibility guards',async()=>{
  for(const candidate of [{...eligible,name:student.supervisor},{...eligible,selectable:false,canSubmit:false,capacityState:'NOT_CONFIGURED' as const}]){await mount(render({candidates:[candidate]}));await choose();await notes();check(container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.disabled,'Ineligible candidate submit enabled');}
});
await scenario('Operational closure blocks submission and server errors retain the draft',async()=>{
  window.fetch=async(input,init)=>{check(String(input).includes('/operational-periods/availability/')&&(!init?.method||init.method==='GET'),'Unexpected academic write');return Response.json({canSubmit:false,enforcementEnabled:true,state:'CLOSED',message:'Recommendations are closed.',period:null,exception:null});};
  await mount(render({student:{...student,studentUserId:71}}));await until(()=>container.textContent?.includes('Recommendations are closed.'));await choose();await notes();check(container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.disabled,'Closed intake submit allowed');
  await mount(render({submitError:'Capacity changed; choose another member.'}));await choose();await notes();check(container.querySelector('[role="alert"]')?.textContent?.includes('Capacity changed'),'Server error absent');check(container.querySelector<HTMLTextAreaElement>('#recommendation-notes-textarea')!.value.includes('Expertise'),'Server error lost draft');window.fetch=async()=>{throw Error('Unexpected HTTP request');};
});
await scenario('Keep editing retains a replacement draft and discard reopens the same student empty',async()=>{
  await mount(<NominationLifecycle/>);await completeReplacement();button('Back to Panel Appointments')!.click();await until(()=>!!document.querySelector('dialog[open]'));check(container.querySelector('[data-record-page]'),'Dirty form closed without confirmation');button('Keep editing',document.querySelector('dialog[open]')!)!.click();await pause();checkDraftRetained();
  button('Back to Panel Appointments')!.click();await until(()=>!!document.querySelector('dialog[open]'));button('Discard changes',document.querySelector('dialog[open]')!)!.click();await until(()=>!container.querySelector('[data-record-page]'));button('Reopen nomination')!.click();await until(()=>!!combo());checkDraftEmpty();
});
await scenario('Successful submission disposes the completed draft before the same student reopens',async()=>{
  await mount(<NominationLifecycle/>);await completeReplacement();container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.click();await until(()=>!container.querySelector('[data-record-page]'));button('Reopen nomination')!.click();await until(()=>!!combo());checkDraftEmpty();
});
await scenario('Failed submission retains candidate notes and replacement reason for retry',async()=>{
  await mount(<NominationLifecycle outcome="failure"/>);await completeReplacement();container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.click();await until(()=>container.querySelector('[role="alert"]')?.textContent?.includes('Capacity changed'));checkDraftRetained();check(!container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.disabled,'Failed draft cannot retry');
});
await scenario('Student identity changes dispose drafts while refreshed details retain them',async()=>{
  await mount(<NominationLifecycle/>);await completeReplacement();button('Refresh student details')!.click();await until(()=>container.querySelector('#summary-student-name')?.textContent==='Updated student name');checkDraftRetained();button('Switch student')!.click();await until(()=>container.querySelector('#summary-student-id')?.textContent==='DEMO-PG-072');checkDraftEmpty();
});
await scenario('Replacement appointment identity and new nomination mode never share a draft',async()=>{
  await mount(<NominationLifecycle/>);await completeReplacement();button('Switch replacement appointment')!.click();await pause();checkDraftEmpty();await completeReplacement();button('Switch to new nomination')!.click();await until(()=>!draftReason());checkDraftEmpty();
});
await scenario('Routed replacement new nomination and student switches reset only fields and retain the open page',async()=>{
  await mountRouted();const entryKey=router!.state.location.key;const entryCount=history.length;
  await completeReplacement();button('Switch replacement appointment')!.click();await settleHistory();check(combo(),'Replacement switch closed the new form');checkDraftEmpty();
  await completeReplacement();button('Switch to new nomination')!.click();await settleHistory();check(combo(),'New nomination switch closed the new form');checkDraftEmpty();
  await choose();await notes('Another draft');button('Switch student')!.click();await settleHistory();check(combo(),'Student switch closed the new form');check(container.querySelector('#summary-student-id')?.textContent==='DEMO-PG-072','Wrong student after identity switch');checkDraftEmpty();
  check(router!.state.location.key===entryKey&&history.length===entryCount,'Identity switch replaced the owning history entry');
});
await scenario('Routed discard closes its history entry and reopens the same student with a clean draft',async()=>{
  await mountRouted();await completeReplacement();button('Back to Panel Appointments')!.click();await until(()=>!!document.querySelector('dialog[open]'));button('Keep editing',document.querySelector('dialog[open]')!)!.click();await pause();checkDraftRetained();
  button('Back to Panel Appointments')!.click();await until(()=>!!document.querySelector('dialog[open]'));button('Discard changes',document.querySelector('dialog[open]')!)!.click();await until(()=>!combo()&&!router!.state.location.state?.portalRecordPage);
  button('Reopen nomination')!.click();await until(()=>!!combo()&&!!router!.state.location.state?.portalRecordPage);await settleHistory();check(combo(),'Old discard cleanup closed the reopened form');checkDraftEmpty();
});
await scenario('Routed successful submission retires its history entry before a clean reopen',async()=>{
  await mountRouted();await completeReplacement();container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.click();await until(()=>!combo()&&!router!.state.location.state?.portalRecordPage);check(!document.querySelector('dialog[open]'),'Successful submission opened discard confirmation');
  button('Reopen nomination')!.click();await until(()=>!!combo()&&!!router!.state.location.state?.portalRecordPage);await settleHistory();check(combo(),'Old success cleanup closed the reopened form');checkDraftEmpty();
});
await scenario('Routed failed submission keeps the editable draft and navigation protection',async()=>{
  await mountRouted('failure');
  await completeReplacement();container.querySelector<HTMLButtonElement>('#submit-recommendation-btn')!.click();await until(()=>container.querySelector('[role="alert"]')?.textContent?.includes('Capacity changed'));checkDraftRetained();button('Back to Panel Appointments')!.click();await until(()=>!!document.querySelector('dialog[open]'));button('Keep editing',document.querySelector('dialog[open]')!)!.click();await pause();checkDraftRetained();
});
await scenario('Shared request lists filter instantly, retain views and open the exact named record',async()=>{
  const row:PanelPresentation={id:71,studentId:'PG071',studentName:'Aina Rahman',programme:'Data Science',semester:'S1',recommendedMember:'Dr Amir',recommendedMemberId:'L071',proposedTopic:'Explainable models',status:'PENDING_COORDINATOR',submittedDate:'20 Oct 2026',waitingDays:3};let opened='';
  await mount(<PanelBrowse scope="nomination-polish" title="Appointment requests" records={[row,{...row,id:72,studentName:'Historical Student',status:'REJECTED_BY_COORDINATOR'}]} onOpen={r=>{opened=String(r.id);}}/>);
  check(container.querySelector('[data-workspace-filter-card]')&&!button('Apply filters'),'Shared automatic filters changed');await value(container.querySelector<HTMLInputElement>('input[type="search"]')!,'No student');check(!container.querySelector('tbody tr'),'Search not immediate');button('Clear filters')!.click();await pause();const action=container.querySelector<HTMLButtonElement>('button[aria-label="View request for Aina Rahman"]');check(action,'Record action is not named');action!.click();check(opened==='71','Wrong record opened');button('History')!.click();await pause();check(container.textContent?.includes('Historical Student')&&!container.textContent?.includes('Aina Rahman'),'History partition changed');button('Clear filters')!.click();await pause();check(container.querySelector('button[aria-pressed="true"]')?.textContent?.trim()==='History','Clear reset view');geometry();
});
await scenario('Long student and research content remain available with responsive form sections',async()=>{
  await mount(render({student:{...student,studentName:'StudentName'.repeat(25),programme:'Programme'.repeat(30),proposedTopic:'ResearchTitle'.repeat(70),abstract:student.abstract+'\n\n'+'LongResearchTerm'.repeat(180)}}));
  const disclosure=container.querySelector<HTMLDetailsElement>('[data-panel-research-preview]');check(disclosure&&!disclosure.open,'Research abstract not available on demand');disclosure!.querySelector('summary')!.click();check(disclosure!.textContent?.includes('LongResearchTerm'.repeat(180)),'Research truncated');geometry();
  const supervisor={id:'S1',name:'Dr Supervisor',initials:'DS',domain:'Computing',filled:4,total:5,activeLoad:3,reservedLoad:1,availableSlots:1,selectable:true,capacityState:'AVAILABLE' as const};let chosen=false;await mount(<><SupervisorCandidateOption candidate={supervisor} selected={false} onToggle={()=>{chosen=true;}}/><SupervisorSelectionSummary candidate={supervisor} onClear={()=>{}}/></>);check(container.textContent?.includes('1 Supervisor place remaining')&&container.textContent?.includes('1 awaiting Coordinator approval'),'Supervisor capacity missing');container.querySelector<HTMLButtonElement>('button')!.click();check(chosen,'Supervisor choice failed');geometry();
});
await mount(render({replacementMember:'Dr Current Panel'}));await choose();
parent.postMessage({type:'panel-nomination-results',width:innerWidth,results},location.origin);
