import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createMemoryRouter, RouterProvider} from 'react-router';
import {EvaluationTaskAssignment} from '../src/components/EvaluationTaskAssignment';
import {WorkflowReconciliationCentre} from '../src/components/WorkflowReconciliationCentre';
import {OperationalPeriodManagement} from '../src/components/OperationalPeriodManagement';
import {DecisionFeedbackProvider} from '../src/components/DecisionFeedback';

const results: {name: string; error?: string}[] = [];
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 20));
const until = async (predicate: () => unknown) => { for (let i=0;i<150;i++) { if (predicate()) return; await pause(); } throw Error('Timeout: '+document.body.textContent?.slice(-800)); };
const button = (label: string, scope: ParentNode = document) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find(node => node.getClientRects().length && (node.textContent?.trim() === label || node.getAttribute('aria-label') === label));
const click = async (label: string, scope: ParentNode = document) => { const node=button(label,scope); check(node,'Missing button '+label); node!.click(); await pause(); };
const enter = async (node: HTMLInputElement | HTMLTextAreaElement, value: string) => { Object.getOwnPropertyDescriptor(node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value')!.set!.call(node,value); node.dispatchEvent(new Event('input',{bubbles:true})); await pause(); };
const select = async (label: string, value: string) => {
  const wrapper=[...document.querySelectorAll('label')].find(node=>node.querySelector('select') && node.textContent?.trim().startsWith(label));
  const native=wrapper?.querySelector('select'); check(native,'Missing select '+label);
  native!.value=value; native!.dispatchEvent(new Event('change',{bubbles:true})); await pause();
};
const scenario=async(name:string,run:()=>Promise<void>)=>{try{await run();results.push({name});}catch(error){results.push({name,error:String(error)});}};
const period={id:4,name:'Review evaluation',semester:'Semester I',semesterId:9,semesterCode:'2026-S1',programmeScope:'ALL',programmes:[],evaluatorRoles:['SUPERVISOR','PANEL'],lifecycleStatus:'PUBLISHED',effectiveStatus:'OPEN',opensAt:'2026-10-01T00:00:00Z',closesAt:'2026-10-20T09:00:00Z',taskTotals:{total:0,supervisor:0,panel:0,backup:0,submitted:0,incomplete:0,overdue:0},auditEvents:[]};
const issue={issueId:'programme-2',fingerprint:'fresh-fingerprint',module:'SUPERVISOR_APPOINTMENTS',issueType:'PROGRAMME_MISMATCH',severity:'WARNING',repairability:'REPAIRABLE',title:'Programme mismatch',summary:'Review the programme.',recordType:'SUPERVISOR_APPLICATION',recordId:'2',programme:'Computer Science',studentId:'S2',currentState:{},dependencies:[],navigation:{},suggestion:{}};
let root:Root|null=null, router:ReturnType<typeof createMemoryRouter>|null=null;
let writes:{path:string;body:any}[]=[], failSave=false, failRefresh=false, committed=false, releaseSave:(()=>void)|null=null, holdSave=false, acceptanceMode=false;
const response=(value:unknown,status=200)=>Response.json(value,{status});
window.fetch=async(input,init)=>{
  const path=new URL(String(input),location.origin).pathname, method=init?.method??'GET';
  if(method!=='GET'){
    writes.push({path,body:JSON.parse(String(init?.body??'{}'))});
    if(holdSave)await new Promise<void>(resolve=>{releaseSave=resolve;});
    if(failSave)return response({error:'Synthetic save unavailable'},503);
    committed=true;
    if(path.endsWith('/manual-overrides/'))return response({id:77,studentId:'S2',studentName:'Synthetic student',evaluatorRole:'BACKUP',evaluatorRoleLabel:'Backup',components:[]},201);
    if(path.endsWith('/accept/'))return response({accepted:true,issueId:issue.issueId,acceptance:{id:1,reason:'Verified intentional exception',createdAt:'2026-10-29T00:00:00Z',actor:{id:1,name:'Office'}}});
    throw Error('Unexpected write '+path);
  }
  if(committed&&failRefresh&&(path==='/api/marks/evaluation-tasks/'||path==='/api/dashboard/reconciliation/'))return response({error:'Synthetic latest read unavailable'},503);
  if(path==='/api/marks/evaluation-tasks/')return response([{id:'44',taskId:44,periodId:4,studentId:'S2',studentName:'Synthetic student',researchTitle:'Research',panelMember:'Synthetic lecturer',semester:'Semester I',status:'PENDING',canGrantCompletionWindow:true,evaluatorRole:'PANEL'}]);
  if(path==='/api/marks/periods/')return response([period]);
  if(path==='/api/marks/assignment-options/')return response({students:[{studentId:'S2',studentName:'Synthetic student',programme:'Computer Science',researchTitle:'Research',supervisorName:'Supervisor'}],lecturers:[{userId:3,fullName:'Synthetic lecturer',staffId:'L3',email:'fictional@example.test',department:'Computing'}],tasks:[]});
  if(path==='/api/academics/operational-periods/')return response({periods:[],enforcement:{SUPERVISOR_APPLICATION:false,PANEL_RECOMMENDATION:false}});
  if(path==='/api/marks/programme-options/')return response(['Computer Science']);
  if(path==='/api/dashboard/reconciliation/')return response({summary:{total:1,blocking:0,warnings:1,repairable:1,reviewRequired:0},count:1,page:1,pageSize:10,availableProgrammes:['Computer Science'],results:[issue]});
  if(path.endsWith('/reconciliation/audits/'))return response({results:[]});
  if(path.endsWith('/preview/'))return response({issue:acceptanceMode?{...issue,repairability:'REVIEW_REQUIRED'}:issue,canAccept:true,allowedResolutions:acceptanceMode?[]:[{action:'SET_PROGRAMME',label:'Set managed programme',requiresProgramme:true}]});
  throw Error('Unexpected read '+path);
};
async function mount(component:React.ReactNode){
  root?.unmount(); router?.dispose(); await pause();
  writes=[];failSave=false;failRefresh=false;committed=false;releaseSave=null;holdSave=false;acceptanceMode=false;
  router=createMemoryRouter([{path:'/workspace',element:<DecisionFeedbackProvider scopeKey="phase-one">{component}</DecisionFeedbackProvider>},{path:'/other',element:<h1>Other workspace</h1>}],{initialEntries:['/workspace']});
  root=createRoot(document.getElementById('root')!); root.render(<RouterProvider router={router}/>); await until(()=>!!document.getElementById('root')?.textContent);
}
async function backup(){
  await mount(<EvaluationTaskAssignment onBack={()=>{}} onManageTimeline={()=>{}}/>);
  await until(()=>button('Assign backup evaluator')); await click('Assign backup evaluator'); await until(()=>document.querySelector('[data-record-page] textarea'));
  await select('Student','S2'); await select('Backup Lecturer','3'); await enter(document.querySelector('[data-record-page] textarea')!,'Verified backup cover');
  document.querySelector<HTMLInputElement>('[data-record-page] input[type="checkbox"]')!.click(); await pause(); await click('Assign Backup'); await until(()=>document.querySelector('dialog[open]'));
}
async function reviewIssue(accept=false){await mount(<WorkflowReconciliationCentre onBack={()=>{}} onNavigateToRoute={()=>{}}/>);acceptanceMode=accept;await until(()=>button('Review issue'));await click('Review issue');await until(()=>accept?button('Accept as intentional'):document.querySelector('[data-record-page] textarea'));}
async function acceptance(){await reviewIssue(true);await click('Accept as intentional');await until(()=>document.querySelector('dialog[open] textarea'));await enter(document.querySelector('dialog textarea')!,'Verified intentional exception');document.querySelector<HTMLInputElement>('dialog input[type="checkbox"]')!.click();await pause();}

await scenario('backup success retires completed draft before returning and does not duplicate writes',async()=>{
  await backup();await click('Assign backup evaluator',document.querySelector('dialog[open]')!);await until(()=>committed&&!document.querySelector('dialog[open]'));
  check([...document.querySelectorAll('[role="status"]')].filter(node=>node.textContent==='Backup evaluator task created.').length===1,'Expected exactly one saved outcome');
  if(document.querySelector('[data-record-page]'))await click('Back to Evaluation Task Assignment');
  await until(()=>!document.querySelector('[data-record-page]'));check(!document.querySelector('dialog[open]'),'Successful backup still asks to discard');check(writes.length===1,'Backup created more than once');
  await click('Assign backup evaluator');await until(()=>document.querySelector('[data-record-page] textarea'));
  check(document.querySelector<HTMLTextAreaElement>('[data-record-page] textarea')!.value==='','Completed reason returned');
  await enter(document.querySelector('[data-record-page] textarea')!,'A new unsaved assignment');await click('Back to Evaluation Task Assignment');await until(()=>document.body.textContent?.includes('Discard unsaved changes?'));check(writes.length===1,'Reopening replayed completed assignment');
});
await scenario('backup committed refresh failure leaves no completed dirty draft or repeat-save recovery',async()=>{
  await backup();failRefresh=true;await click('Assign backup evaluator',document.querySelector('dialog[open]')!);await until(()=>committed&&!document.querySelector('dialog[open]'));
  check([...document.querySelectorAll('[role="status"]')].filter(node=>node.textContent?.startsWith('Backup evaluator task created. The latest record could not be loaded.')).length===1,'Expected exactly one committed refresh warning');
  if(document.querySelector('[data-record-page]'))await click('Back to Evaluation Task Assignment');
  await until(()=>!document.querySelector('[data-record-page]'));check(!document.querySelector('dialog[open]')&&writes.length===1,'Committed backup still dirty or resubmitted');
});
await scenario('backup failure and review cancellation retain the visible editable draft',async()=>{
  await backup();await click('Cancel',document.querySelector('dialog[open]')!);check(document.querySelector<HTMLTextAreaElement>('[data-record-page] textarea')!.value==='Verified backup cover','Review cancellation erased draft');
  await click('Assign Backup');failSave=true;await click('Assign backup evaluator',document.querySelector('dialog[open]')!);await until(()=>document.querySelector('dialog[open]')?.textContent?.includes('Synthetic save unavailable'));
  await click('Cancel',document.querySelector('dialog[open]')!);check(document.querySelector<HTMLTextAreaElement>('[data-record-page] textarea')!.value==='Verified backup cover','Failed save erased draft');
  await click('Back to Evaluation Task Assignment');await until(()=>document.body.textContent?.includes('Discard unsaved changes?'));check(writes.length===1,'Failed save retried automatically');
});
await scenario('pending backup blocks dismissal and duplicate submission until its result',async()=>{
  await backup();holdSave=true;await click('Assign backup evaluator',document.querySelector('dialog[open]')!);await until(()=>!!releaseSave);const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!;
  check(button('Cancel',dialog)?.disabled,'Pending review can close');dialog.dispatchEvent(new Event('cancel',{cancelable:true}));dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await pause();check(writes.length===1&&dialog.open,'Pending action duplicated or dismissed');releaseSave!();await until(()=>!document.querySelector('dialog[open]'));
});
await scenario('acceptance private input is protected and discard removes hidden dirty state',async()=>{
  await acceptance();await click('Cancel',document.querySelector('dialog[open]')!);await until(()=>document.body.textContent?.includes('Discard unsaved changes?'));
  await click('Keep editing',[...document.querySelectorAll('dialog[open]')].at(-1)!);check(document.querySelector<HTMLTextAreaElement>('dialog textarea')!.value==='Verified intentional exception','Keep editing lost acceptance reason');
  await click('Cancel',document.querySelector('dialog[open]')!);await click('Discard changes',[...document.querySelectorAll('dialog[open]')].at(-1)!);await until(()=>!document.querySelector('dialog[open]'));
  await click('Back to Workflow Reconciliation');await until(()=>!document.querySelector('[data-record-page]'));check(!document.querySelector('dialog[open]')&&writes.length===0,'Abandoned acceptance left invisible dirty input or saved');
});
await scenario('repair review cancellation keeps its visible reason and acknowledgement',async()=>{
  await reviewIssue();await enter(document.querySelector('[data-record-page] textarea')!,'Verified repair details');document.querySelector<HTMLInputElement>('[data-record-page] input[type="checkbox"]')!.click();await pause();await click('Review and confirm repair');await click('Cancel',document.querySelector('dialog[open]')!);
  check(document.querySelector<HTMLTextAreaElement>('[data-record-page] textarea')!.value==='Verified repair details','Repair review cancellation erased visible reason');check(document.querySelector<HTMLInputElement>('[data-record-page] input[type="checkbox"]')!.checked,'Repair acknowledgement lost');check(writes.length===0,'Review cancellation wrote data');
});
await scenario('acceptance success and refresh failure both clear committed private input',async()=>{
  for(const failedRead of [false,true]){await acceptance();failRefresh=failedRead;await click('Accept as intentional',document.querySelector('dialog[open]')!);await until(()=>committed&&!document.querySelector('dialog[open]'));await click('Back to Workflow Reconciliation');await until(()=>!document.querySelector('[data-record-page]'));check(!document.querySelector('dialog[open]')&&writes.length===1,'Completed acceptance left dirty state');}
});
await scenario('untouched selected-only deadline scope closes cleanly but edited reason is protected',async()=>{
  await mount(<OperationalPeriodManagement semesterId={9} semesterLifecycle="CLOSED" entries={[]} onTimelineRefresh={()=>{}}/>);await until(()=>button('View Marks evaluations'));await click('View Marks evaluations');await until(()=>button('Manage window'));await click('Manage window');await click('Extend deadline');await until(()=>document.querySelector('dialog[open]'));
  check(document.querySelector('dialog')?.textContent?.includes('Selected cases / tasks'),'Expected selected-only default');await click('Cancel',document.querySelector('dialog[open]')!);check(!document.querySelector('dialog[open]'),'Untouched default caused discard prompt');
  await click('Extend deadline');await enter(document.querySelector('dialog textarea')!,'New exception explanation');await click('Cancel',document.querySelector('dialog[open]')!);await until(()=>document.body.textContent?.includes('Discard unsaved changes?'));await click('Keep editing',[...document.querySelectorAll('dialog[open]')].at(-1)!);check(document.querySelector<HTMLTextAreaElement>('dialog textarea')!.value==='New exception explanation','Real extension edit lost');check(writes.length===0,'Cancellation submitted extension');
});
await scenario('deadline and scope edits become clean again when restored to their initialized values',async()=>{
  await mount(<OperationalPeriodManagement semesterId={9} semesterLifecycle="ACTIVE" entries={[]} onTimelineRefresh={()=>{}}/>);await until(()=>button('View Marks evaluations'));await click('View Marks evaluations');await click('Manage window');await click('Extend deadline');await until(()=>document.querySelector('dialog[open]'));
  const date=document.querySelector<HTMLInputElement>('dialog input[type="datetime-local"]')!, original=date.value;
  await enter(date,'2026-11-01T17:00');await click('Cancel',document.querySelector('dialog[open]')!);await until(()=>button('Keep editing'));await click('Keep editing');await enter(date,original);
  await select('Apply to','selected');await click('Cancel',document.querySelector('dialog[open]')!);await until(()=>button('Keep editing'));await click('Keep editing');document.querySelector<HTMLInputElement>('dialog input[type="checkbox"]')!.click();await pause();await select('Apply to','everyone');
  await click('Cancel',document.querySelector('dialog[open]')!);check(!document.querySelector('dialog[open]')&&writes.length===0,'Restored scope/deadline still counted dirty');
});
await scenario('selected task edits are protected and deselecting restores the clean deadline baseline',async()=>{
  await mount(<OperationalPeriodManagement semesterId={9} semesterLifecycle="CLOSED" entries={[]} onTimelineRefresh={()=>{}}/>);await until(()=>button('View Marks evaluations'));await click('View Marks evaluations');await click('Manage window');await click('Extend deadline');await until(()=>document.querySelector('dialog[open] input[type="checkbox"]'));
  const task=document.querySelector<HTMLInputElement>('dialog[open] input[type="checkbox"]')!;task.click();await pause();await click('Cancel',document.querySelector('dialog[open]')!);await until(()=>button('Keep editing'));await click('Keep editing');check(task.checked,'Keep editing lost selected task');task.click();await pause();await click('Cancel',document.querySelector('dialog[open]')!);check(!document.querySelector('dialog[open]')&&writes.length===0,'Deselected task left a false dirty state');
});
parent.postMessage({type:'phase-one-drafts-results',width:innerWidth,results},location.origin);
