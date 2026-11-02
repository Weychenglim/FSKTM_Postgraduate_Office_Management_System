import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {createMemoryRouter,RouterProvider,useLocation} from 'react-router';
import {OfficePeriodsManagement} from '../src/components/OfficePeriodsManagement';
import {OfficeDashboardLayout} from '../src/components/OfficeDashboardLayout';
import {MarkEntryPeriodConfig} from '../src/components/MarkEntryPeriodConfig';
import {PROGRAMME_OPTIONS} from '../src/constants/programmes';
import type {OperationalPeriod} from '../src/types/operationalPeriods';
import type {SemesterTimelineEntry} from '../src/types/timeline';

const results:{name:string;error?:string}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const visible=(node:Element)=>!node.closest('[hidden]');
const text=()=>[...document.querySelectorAll('h1,h2,h3,p,button,label,td,a')].filter(visible).map(node=>node.textContent).join(' ');
const until=async(predicate:()=>unknown)=>{for(let i=0;i<400;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error(`Timed out: ${text().slice(-900)}`);};
const buttons=()=>[...document.querySelectorAll<HTMLButtonElement>('button')].filter(visible);
const click=async(label:string)=>{const matches=buttons().filter(node=>node.textContent?.trim()===label||node.getAttribute('aria-label')===label);const node=matches.find(node=>node.closest('dialog[open]'))??matches[0];check(node,`Missing ${label}`);node!.click();await new Promise(resolve=>setTimeout(resolve,20));};
const choose=async(id:string,label:string)=>{if(document.getElementById(id)!.getAttribute('aria-expanded')!=='true')document.getElementById(id)!.click();await until(()=>document.querySelector('[role="listbox"]'));const option=[...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node=>node.textContent?.trim().startsWith(label));check(option,`Missing ${label}`);option!.click();await new Promise(resolve=>setTimeout(resolve,20));};
const input=(node:HTMLInputElement|HTMLTextAreaElement,value:string)=>{Object.getOwnPropertyDescriptor(node instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));};
const fillSchedule=async(opens:string,closes:string)=>{
 for(const [id,value] of [['submission-opens-date',opens.split('T')[0]],['submission-opens-time',opens.split('T')[1]],['submission-closes-date',closes.split('T')[0]],['submission-closes-time',closes.split('T')[1]]]){input(document.getElementById(id) as HTMLInputElement,value);await new Promise(resolve=>setTimeout(resolve,10));}
};
const scenario=async(name:string,work:()=>Promise<void>)=>{try{await work();results.push({name});}catch(error){results.push({name,error:String(error)});}};
const semester={id:9,label:'Semester I 2026/2027',code:'2026-S1',startsOn:'2026-09-01',endsOn:'2027-02-28',lifecycleStatus:'ACTIVE',effectiveStatus:'ACTIVE',isActive:true};
const semesters=[semester,{...semester,id:8,label:'Semester II 2025/2026',code:'2025-S2',lifecycleStatus:'CLOSED',effectiveStatus:'CLOSED',isActive:false},{...semester,id:10,label:'Semester II 2026/2027',code:'2026-S2',lifecycleStatus:'DRAFT',effectiveStatus:'DRAFT',isActive:false}];
const base:OperationalPeriod={id:1,semesterId:9,activity:'SUPERVISOR_APPLICATION',name:'Main Supervisor intake',programmeScope:'SELECTED',programmes:[PROGRAMME_OPTIONS[0]],opensAt:'2026-10-01T00:00:00Z',closesAt:'2026-10-20T09:00:00Z',lifecycleStatus:'PUBLISHED',effectiveStatus:'ENDED',revision:1,history:[]};
const marksBase={id:4,name:'Semester evaluation',semesterId:9,semesterCode:'2026-S1',semester:semester.label,rubricId:1,rubricName:'Standard rubric',programmeScope:'ALL',programmes:[],evaluatorRoles:['SUPERVISOR','PANEL'],opensAt:'2026-10-01T00:00:00Z',closesAt:'2026-10-20T09:00:00Z',isOpen:true,lifecycleStatus:'PUBLISHED',effectiveStatus:'OPEN',taskTotals:{total:2,submitted:0,draft:0,pending:2},auditEvents:[]};
const entry:SemesterTimelineEntry={id:12,level:'P1',step:1,title:'Existing calendar event',detail:'A semester milestone',action:'Student',deadlineStart:'2026-10-01',deadlineEnd:'2026-10-20',targetRoles:['STUDENT'],status:'Upcoming',displayOrder:1,weekLabel:''};
let periods:OperationalPeriod[]=[],enforcement={SUPERVISOR_APPLICATION:false,PANEL_RECOMMENDATION:false},entries:SemesterTimelineEntry[]=[],hasTimeline=true,calendarFailure=false,failAfterWrite=false,writes:{path:string;body:any;method:string}[]=[],root:Root|null=null,router:ReturnType<typeof createMemoryRouter>|null=null;
let marksPeriods:any[]=[],periodFailure=false,failPeriodAfterWrite=false,holdMarksDetail=false,releaseMarksDetail:(()=>void)|null=null,holdMarksWrite=false,releaseMarksWrite:(()=>void)|null=null,failCreationLink=false,holdWindowWrite=false,releaseWindowWrite:(()=>void)|null=null;
window.fetch=async(inputValue,init)=>{
 const url=new URL(String(inputValue),location.origin),path=url.pathname;
 if(init?.method&&init.method!=='GET'){
  const body=JSON.parse(String(init.body||'{}'));writes.push({path,body,method:init.method});
  if(path.endsWith('/operational-periods/enforcement/')){enforcement={...enforcement,[body.activity]:body.enabled};return Response.json({enforcement});}
  if(path==='/api/academics/operational-periods/'){if(holdWindowWrite)await new Promise<void>(resolve=>{releaseWindowWrite=resolve;});if(failCreationLink&&body.timelineEntryId){entries=entries.map(entry=>entry.id===body.timelineEntryId?{...entry,operationalPeriodId:99}:entry);return Response.json({error:'Selected event is already linked'},{status:409});}const saved={...base,...body,id:3,lifecycleStatus:'DRAFT',effectiveStatus:'DRAFT'};periods.push(saved);if(body.timelineEntryId)entries=entries.map(entry=>entry.id===body.timelineEntryId?{...entry,operationalPeriodId:saved.id}:entry);return Response.json(saved,{status:201});}
  const periodEdit=path.match(/^\/api\/academics\/operational-periods\/(\d+)\/$/);if(periodEdit&&init.method==='PATCH'){periods=periods.map(period=>period.id===Number(periodEdit[1])?{...period,...body,revision:period.revision+1}:period);return Response.json(periods.find(period=>period.id===Number(periodEdit[1])));}
  if(path.endsWith('/publish/')){const id=Number(path.split('/').at(-3));periods=periods.map(row=>row.id===id?{...row,lifecycleStatus:'PUBLISHED',effectiveStatus:'UPCOMING',revision:row.revision+1}:row);if(failPeriodAfterWrite)periodFailure=true;return Response.json(periods.find(row=>row.id===id));}
  if(path==='/api/dashboard/timeline/entries/'){const saved={...entry,...body,id:13};entries.push(saved);if(failAfterWrite)calendarFailure=true;return Response.json(saved,{status:201});}
  if(path==='/api/dashboard/timeline/entries/12/'){entries=entries.map(row=>row.id===12?{...row,...body}:row);return Response.json(entries[0]);}
  const marksWrite=path.match(/^\/api\/marks\/periods\/(\d+)\/$/);if(marksWrite){if(holdMarksWrite)await new Promise<void>(resolve=>{releaseMarksWrite=resolve;});marksPeriods=marksPeriods.map(row=>row.id===Number(marksWrite[1])?{...row,...body}:row);return Response.json(marksPeriods.find(row=>row.id===Number(marksWrite[1])));}
  throw new Error(`Unexpected write ${path}`);
 }
 if(path==='/api/academics/semesters/')return Response.json(semesters);
 if(path==='/api/academics/operational-periods/')return periodFailure?Response.json({error:'Synthetic period read failed'},{status:503}):Response.json({periods:periods.filter(row=>row.semesterId===Number(url.searchParams.get('semesterId'))),enforcement});
 if(path.includes('/exception-candidates/'))return Response.json({candidates:[{studentId:11,participantId:12,studentName:'Eligible Student',participantName:'Eligible Lecturer'}]});
 if(path.includes('/exceptions/'))return Response.json({exceptions:[]});
 if(path==='/api/dashboard/timeline/active/')return calendarFailure?Response.json({error:'Synthetic calendar unavailable'},{status:503}):Response.json({available:hasTimeline,semesterId:9,levels:[{level:'P1',entries}]});
 if(path==='/api/marks/periods/')return Response.json(marksPeriods);
 const match=path.match(/^\/api\/marks\/periods\/(\d+)\/$/);if(match){if(holdMarksDetail)await new Promise<void>(resolve=>{releaseMarksDetail=resolve;});return Response.json(marksPeriods.find(row=>row.id===Number(match[1])));}
 if(path==='/api/marks/evaluation-tasks/')return Response.json([{taskId:44,periodId:6,studentName:'Synthetic Student',panelMember:'Synthetic Lecturer',status:'PENDING',canGrantCompletionWindow:true,evaluatorRole:'PANEL'}]);
 if(path==='/api/marks/programme-options/')return Response.json(PROGRAMME_OPTIONS);
 if(path==='/api/marks/rubrics/')return Response.json([{id:1,name:'Standard rubric',isActive:true,isReady:true,components:[]}]);
 throw new Error(`Unexpected read ${path}`);
};
function MarksContext(){const location=useLocation();return <MarkEntryPeriodConfig contextSearch={location.search} onBack={()=>{}} onManageSemesters={()=>{}}/>;}
const mount=async(path='/dashboard/periods?semester=9',options:{empty?:boolean;missing?:boolean;closed?:boolean;draft?:boolean;draftMarks?:boolean;many?:boolean;linked?:boolean;linkedMarks?:boolean;enforced?:boolean}={})=>{
 root?.unmount();router?.dispose();document.getElementById('root')!.innerHTML='';
 periods=options.empty?[]:[{...base,...(options.draft?{lifecycleStatus:'DRAFT' as const,effectiveStatus:'DRAFT'}:{})},...(options.closed?[{...base,id:8,semesterId:8,lifecycleStatus:'CLOSED' as const,effectiveStatus:'CLOSED'}]:[])];enforcement={SUPERVISOR_APPLICATION:!!options.enforced,PANEL_RECOMMENDATION:false};entries=options.many?Array.from({length:80},(_,index)=>({...entry,id:12+index,title:`Semester event ${index+1}`})):[{...entry,...(options.linked?{operationalPeriodId:1}:options.linkedMarks?{marksPeriodId:4}:{})}];hasTimeline=!options.missing;calendarFailure=false;failAfterWrite=false;periodFailure=false;failPeriodAfterWrite=false;holdMarksDetail=false;releaseMarksDetail=null;holdMarksWrite=false;releaseMarksWrite=null;failCreationLink=false;holdWindowWrite=false;releaseWindowWrite=null;writes=[];
 marksPeriods=[{...marksBase,...(options.draftMarks?{lifecycleStatus:'DRAFT',effectiveStatus:'DRAFT'}:{})},{...marksBase,id:5,name:'Other semester evaluation',semesterId:10},...(options.closed?[{...marksBase,id:6,name:'Closed semester evaluation',semesterId:8,lifecycleStatus:'CLOSED',effectiveStatus:'CLOSED'}]:[])];
 root=createRoot(document.getElementById('root')!);router=createMemoryRouter([{path:'/dashboard/periods',element:<OfficeDashboardLayout enabled><OfficePeriodsManagement onBack={()=>{}} onManageSemesters={()=>{}}/></OfficeDashboardLayout>},{path:'/marks/config',element:<MarksContext/>}],{initialEntries:[path]});root.render(<RouterProvider router={router}/>);await until(()=>document.querySelector('h1'));await until(()=>!text().includes('Loading submission windows')&&!text().includes('Loading academic semesters')&&!text().includes('Loading evaluation periods'));
};
const preview=new URL(parent.location.href).searchParams.get('preview');
if(!preview){
await scenario('overview replaces tabs and explains actual submission rules',async()=>{
 await mount();await until(()=>document.querySelector('[aria-label="Submission activity overview"]'));
 check(!document.querySelector('[role="tablist"]'),'Button tabs remain');check(document.querySelectorAll('[aria-label="Submission activity overview"] tbody tr').length===3,'Need all three activities');
 check([...document.querySelectorAll('[aria-label="Supervisor applications windows"] th')].map(node=>node.textContent).join('|')==='Window|Programmes|Opens|Closes|Submission access|Action','Window and programme hierarchy unclear');check(document.querySelector('.period-rules')!.querySelectorAll('p').length===1,'Rules repeat hints');check(!document.querySelector('[id="operational-period-1"]')?.textContent?.includes('Timeline:'),'Timeline summary crowds window name');check(!document.querySelector('.office-tool-context'),'Semester selection is still a card');check(text().includes('Dates are unrestricted'),'Disabled rules unclear');check(text().includes('approval or rejection after'),'Pending decisions not explained');
 await click('View Marks evaluations');await until(()=>document.querySelector('#period-panel-MARKS'));
 check(!buttons().some(node=>node.textContent?.trim()==='Add submission window'),'Appointment action leaked into Marks');
 check(document.querySelector<HTMLAnchorElement>('a[href="/marks/config?semester=9"]'),'Marks loses selected semester');check(document.documentElement.scrollWidth<=innerWidth+1,'Page overflows');
});
await scenario('restriction confirmation lists gaps and requires acknowledgement and reason',async()=>{
 await mount();await click('Review and enable');await until(()=>document.querySelector('dialog[open]'));
 check(text().includes('No published window. New submissions will be blocked.'),'Coverage gaps hidden');
 const confirm=buttons().find(node=>node.textContent?.trim()==='Confirm change')!;check(confirm.disabled,'Restriction enabled without review');
 const reason=document.querySelector<HTMLTextAreaElement>('dialog textarea')!;input(reason,'Reviewed programme coverage');await new Promise(resolve=>setTimeout(resolve,20));check(confirm.disabled,'Reason bypassed acknowledgement');
 document.querySelector<HTMLInputElement>('dialog input[type="checkbox"]')!.click();await new Promise(resolve=>setTimeout(resolve,20));await click('Confirm change');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));
 check(writes[0].body.enabled===true&&writes[0].body.reason==='Reviewed programme coverage','Existing enforcement contract changed');await until(()=>text().includes('Dates enforced'));
});
await scenario('empty state and draft form make publication separate from restrictions',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true});check(text().includes('No submission windows yet'),'Missing setup guidance');await click('Add submission window');await until(()=>document.querySelector('dialog[open]'));
 check(!document.querySelector('[data-record-page]'),'Small creation form still replaces the page');check(document.querySelector('dialog')!.scrollWidth<=document.querySelector('dialog')!.clientWidth+1,'Modal overflows horizontally');check(text().includes('enable date restrictions separately'),'Draft consequence missing');
 const form=document.querySelector<HTMLFormElement>('dialog[open] form')!;input(form.querySelector<HTMLInputElement>('input:not([type="datetime-local"])')!,'New intake');await fillSchedule('2026-10-01T08:00','2026-10-20T17:00');await new Promise(resolve=>setTimeout(resolve,20));await click('Create draft');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));
 check(writes[0].body.opensAt==='2026-10-01T00:00:00.000Z','Malaysia time changed');check(!enforcement.SUPERVISOR_APPLICATION,'Creating a draft enabled restrictions');await until(()=>document.activeElement?.id==='add-submission-window');
});
await scenario('window management keeps dates timeline and audited history together',async()=>{
 await mount();await click('Manage window');await until(()=>document.querySelector('[data-record-page]'));check(text().includes('Main Supervisor intake'),'Window identity lost');check(text().includes('Dates are not enforced'),'Published mistaken for enforced');
 document.querySelector<HTMLDetailsElement>('[data-record-page] details')!.open=true;await until(()=>document.querySelector('[aria-label="Window history"]'));check(!text().includes('No personal extra time granted.'),'Empty extra time hint remains');
 await click('Back to periods & deadlines');await until(()=>!document.querySelector('[data-record-page]'));check(!document.querySelector('[aria-label="Window history"]'),'Record history leaked into overview');
});
await scenario('missing timeline offers setup while period access remains available',async()=>{
 await mount('/dashboard/periods?semester=9',{missing:true});await click('Manage window');await until(()=>text().includes('No semester timeline exists yet'));
 check(document.querySelector('a[href="/dashboard/timeline?semester=9"]'),'Timeline setup loses semester');check(!buttons().some(node=>node.textContent?.trim()==='Create linked event'),'Creation offered without timeline');check(buttons().some(node=>node.textContent?.trim()==='Extend deadline'),'No timeline blocks period controls');
});
await scenario('existing event linking is explicit and updates the displayed connection',async()=>{
 await mount();await click('Manage window');await click('Link existing event');await until(()=>document.querySelector('dialog[open]'));await choose('period-calendar-event','Existing calendar event');await click('Link event');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));await until(()=>text().includes('Linked: Existing calendar event'));
 check(writes[0].body.operationalPeriodId===1&&writes[0].method==='PATCH','Wrong link owner');
});
await scenario('new linked event is one atomic write and retains research phase and audience',async()=>{
 await mount();await click('Manage window');await click('Create linked event');await until(()=>document.querySelector('dialog[open]'));await choose('period-calendar-phase','Research Project 2');await click('Create linked event');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));
 check(writes[0].path==='/api/dashboard/timeline/entries/','Wrong endpoint');check(writes[0].body.operationalPeriodId===1&&writes[0].body.semesterId===9&&writes[0].body.level==='P2','Wrong ownership or scope');check(writes[0].body.targetRoles.includes('STUDENT'),'Audience lost');await until(()=>text().includes('Linked: Main Supervisor intake'));
});
await scenario('committed linked event with failed refresh cannot be resubmitted',async()=>{
 await mount();await click('Manage window');failAfterWrite=true;await click('Create linked event');await until(()=>document.querySelector('dialog[open]'));await click('Create linked event');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));await until(()=>text().includes('latest record could not be loaded')||text().includes('Timeline connection could not be checked'));
 check(!buttons().some(node=>node.textContent?.trim()==='Create linked event'),'Failed read offers duplicate creation');check(writes.length===1,'Event saved more than once');
});
await scenario('period anchors still reveal the owning activity',async()=>{
 await mount('/dashboard/periods?semester=9#marks-period-4');await until(()=>document.querySelector('#marks-period-4'));check(document.querySelector('#period-panel-MARKS'),'Marks anchor selected wrong activity');
 await mount('/dashboard/periods?semester=9#operational-period-1');await until(()=>document.activeElement?.id==='operational-period-1');
 await mount('/dashboard/periods?semester=9&manage=window#operational-period-1');await until(()=>document.querySelector('[data-record-page]'));check(buttons().some(node=>node.textContent?.trim()==='Back to periods & deadlines'),'Linked appointment window not opened');
 await mount('/dashboard/periods?semester=9&manage=window#marks-period-4');await until(()=>document.querySelector('[data-record-page]'));check(buttons().some(node=>node.textContent?.trim()==='Back to periods & deadlines'),'Linked Marks window not opened');
});
await scenario('closed semester keeps appointment edits disabled and Marks recovery available',async()=>{
 await mount('/dashboard/periods?semester=8',{closed:true});check(buttons().find(node=>node.textContent?.trim()==='Add submission window')?.disabled,'Closed semester editable');await click('Manage window');await until(()=>document.querySelector('[data-record-page]'));check(buttons().find(node=>node.textContent?.trim()==='Archive window')?.disabled,'Closed archive enabled');check(!buttons().some(node=>node.textContent?.trim()==='Create linked event'),'Closed calendar editable');await click('Back to periods & deadlines');await until(()=>!document.querySelector('[data-record-page]'));await click('View Marks evaluations');await click('Manage window');await click('Extend deadline');await until(()=>document.querySelector('dialog[open]'));check(text().includes('Selected cases / tasks'),'Closed Marks has no selected-task recovery');check(text().includes('Synthetic Student'),'Eligible unfinished task missing');const everyone=[...document.querySelectorAll<HTMLOptionElement>('dialog option')].find(node=>node.value==='everyone');check(everyone?.disabled,'Closed semester permits blanket extension');
});
await scenario('Marks destination selects exact period and locks semester context',async()=>{
 await mount('/marks/config?semester=9&period=4');await until(()=>text().includes('Period configuration'));
 check(!text().includes('Other semester evaluation'),'Other-semester list leaked');const name=document.querySelector<HTMLInputElement>('input[required]')!;check(name.value==='Semester evaluation','Requested period not selected');
 const selects=[...document.querySelectorAll<HTMLButtonElement>('[role="combobox"]')];check(selects.some(node=>node.textContent?.includes(semester.label)&&node.disabled),'Semester can silently change');check(writes.length===0,'Context navigation mutated Marks');
});
await scenario('invalid or mismatched Marks context fails without fallback',async()=>{
 await mount('/marks/config?semester=9&period=5');await until(()=>text().includes('does not belong'));check(!document.querySelector('form'),'Mismatched context shows editable form');
 await mount('/marks/config?semester=bad');await until(()=>text().includes('context is invalid'));check(!document.querySelector('form'),'Invalid context fell back');
});
await scenario('managed window blocks stale actions and offers visible reload after committed publication',async()=>{
 await mount('/dashboard/periods?semester=9',{draft:true});
 await click('Manage window');failPeriodAfterWrite=true;await click('Review and publish');await until(()=>document.querySelector('dialog[open]'));await click('Confirm change');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));
 check(text().includes('Synthetic period read failed'),'Read error hidden behind record');check(buttons().find(node=>node.textContent?.trim()==='Review and publish')?.matches(':disabled'),'Stale draft can publish again');check(!buttons().some(node=>node.textContent?.trim()==='Create linked event'),'Stale window can create calendar event');
 periodFailure=false;await click('Reload window');await until(()=>buttons().some(node=>node.textContent?.trim()==='Extend deadline'));check(writes.length===1,'Read failure caused duplicate publication');
});
await scenario('Marks semester-only context opens details and returns to its scoped list',async()=>{
 await mount('/marks/config?semester=9');check(!document.querySelector('form'),'Browsing unexpectedly opens editor');
 buttons().find(node=>node.textContent?.includes('Semester evaluation'))!.click();await until(()=>text().includes('Period configuration'));
 check(document.querySelector<HTMLInputElement>('input[required]')?.value==='Semester evaluation','Selection lost fields');
 await click('Back to period list');await until(()=>document.querySelector('[aria-label="Configured evaluation periods"]'));
 check(!document.querySelector('form')&&!text().includes('Other semester evaluation'),'Returning leaked editor or another semester');
 buttons().find(node=>node.textContent?.includes('Semester evaluation'))!.click();await until(()=>text().includes('Period configuration'));
 check(document.querySelector<HTMLInputElement>('input[required]')?.value==='Semester evaluation','Reopening lost identity');
});
await scenario('late Marks selection cannot overwrite a newly selected semester context',async()=>{
 await mount('/marks/config?semester=9');holdMarksDetail=true;buttons().find(node=>node.textContent?.includes('Semester evaluation'))!.click();await until(()=>releaseMarksDetail!==null);await router!.navigate('/marks/config?semester=10');await until(()=>[...document.querySelectorAll('p.card-value')].some(node=>node.textContent==='Semester II 2026/2027'));await until(()=>!text().includes('Loading evaluation periods'));
 holdMarksDetail=false;releaseMarksDetail!();await new Promise(resolve=>setTimeout(resolve,40));check(!text().includes('Period configuration'),`Old detail replaced new context: ${text().slice(-1800)}`);check(!document.querySelector('form'),'Old period editor leaked');
});
await scenario('late Marks save cannot insert an old record into a new semester context',async()=>{
 await mount('/marks/config?semester=9',{draftMarks:true});buttons().find(node=>node.textContent?.includes('Semester evaluation'))!.click();await until(()=>text().includes('Period configuration'));
 input(document.querySelector<HTMLInputElement>('input[required]')!,'Updated prior semester');await new Promise(resolve=>setTimeout(resolve,20));holdMarksWrite=true;await click('Save changes');await until(()=>releaseMarksWrite!==null);
 void router!.navigate('/marks/config?semester=10');await until(()=>text().includes('Saving changes'));check(router!.state.location.search==='?semester=9','Pending save allowed context replacement');
 holdMarksWrite=false;releaseMarksWrite!();await until(()=>[...document.querySelectorAll('p.card-value')].some(node=>node.textContent==='Semester II 2026/2027'));await until(()=>!text().includes('Loading evaluation periods'));check(!text().includes('Updated prior semester'),'Old save inserted into new list');check(!document.querySelector('form'),'Old save reopened editor');
});
await scenario('creation modal links an existing event in the same draft request',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true});await click('Add submission window');await until(()=>document.querySelector('dialog[open]'));await choose('submission-window-calendar-event','Existing calendar event');
 check(text().includes('Saving these dates also updates the calendar'),'Date ownership consequence hidden');const form=document.querySelector<HTMLFormElement>('dialog form')!;input(form.querySelector<HTMLInputElement>('input:not([type="datetime-local"])')!,'Linked intake');await fillSchedule('2026-10-01T08:00','2026-10-20T17:00');await new Promise(resolve=>setTimeout(resolve,20));await click('Create draft');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));
 check(writes[0].body.timelineEntryId===12,'Event missing from atomic creation');check(writes[0].path==='/api/academics/operational-periods/','Extra link write used');await click('Manage window');await until(()=>text().includes('Linked: Existing calendar event'));check(!enforcement.SUPERVISOR_APPLICATION,'Linking enabled date restrictions');
});
await scenario('creation modal guards dirty dismissal and missing timeline remains optional',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true,missing:true});const trigger=buttons().find(node=>node.textContent?.trim()==='Add submission window')!;trigger.focus();trigger.click();await until(()=>document.querySelector('dialog[open]'));check(text().includes('No semester timeline exists'),'Missing timeline unexplained');
 input(document.querySelector<HTMLInputElement>('dialog input:not([type="datetime-local"])')!,'Unsaved intake');await new Promise(resolve=>setTimeout(resolve,20));await click('Cancel');await until(()=>text().includes('Discard unsaved changes?'));await click('Keep editing');await until(()=>document.querySelectorAll('dialog[open]').length===1);check(document.querySelector<HTMLInputElement>('dialog input:not([type="datetime-local"])')?.value==='Unsaved intake','Dismissal lost fields');
 document.querySelector('dialog[open]')!.dispatchEvent(new Event('cancel',{cancelable:true}));await until(()=>text().includes('Discard unsaved changes?'));await click('Discard changes');await until(()=>!document.querySelector('dialog[open]'));check(writes.length===0,'Discard wrote data');await until(()=>document.activeElement===trigger);
});
await scenario('event conflict preserves form values and allows explicit unlinked recovery',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true});await click('Add submission window');await until(()=>document.querySelector('dialog[open]'));await choose('submission-window-calendar-event','Existing calendar event');const form=document.querySelector<HTMLFormElement>('dialog form')!;
 input(form.querySelector<HTMLInputElement>('input:not([type="datetime-local"])')!,'Recoverable intake');await fillSchedule('2026-10-01T08:00','2026-10-20T17:00');failCreationLink=true;await new Promise(resolve=>setTimeout(resolve,20));await click('Create draft');await until(()=>text().includes('Selected event is already linked'));check(periods.length===0,'Failed atomic creation left a draft');await click('Reload calendar events');await until(()=>!form.querySelector('fieldset')?.matches(':disabled'));
 check(form.querySelector<HTMLInputElement>('input:not([type="datetime-local"])')?.value==='Recoverable intake','Conflict lost inputs');await choose('submission-window-calendar-event','Do not link now');failCreationLink=false;await click('Create draft');await until(()=>writes.length===2&&!document.querySelector('dialog[open]'));check(!writes[1].body.timelineEntryId,'Recovery silently retained link');check(periods.length===1,'Recovery duplicated draft');
});
await scenario('event conflict can recover without a link when calendar refresh fails',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true});await click('Add submission window');await choose('submission-window-calendar-event','Existing calendar event');const form=document.querySelector<HTMLFormElement>('dialog form')!;
 input(form.querySelector<HTMLInputElement>('input:not([type="datetime-local"])')!,'Offline calendar recovery');await fillSchedule('2026-10-01T08:00','2026-10-20T17:00');failCreationLink=true;await new Promise(resolve=>setTimeout(resolve,20));await click('Create draft');await until(()=>text().includes('Selected event is already linked'));calendarFailure=true;await click('Reload calendar events');await until(()=>text().includes('Synthetic calendar unavailable'));await click('Continue without timeline link');await until(()=>!form.querySelector('fieldset')?.matches(':disabled'));
 check(form.querySelector<HTMLInputElement>('input:not([type="datetime-local"])')?.value==='Offline calendar recovery','Recovery lost inputs');await click('Create draft');await until(()=>writes.length===2&&!document.querySelector('dialog[open]'));check(!writes[1].body.timelineEntryId,'Unlinked recovery sent a stale link');check(periods.length===1,'Recovery duplicated draft');
});
await scenario('pending modal save blocks dismissal and duplicate submission',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true});await click('Add submission window');const form=document.querySelector<HTMLFormElement>('dialog form')!;input(form.querySelector<HTMLInputElement>('input:not([type="datetime-local"])')!,'Pending intake');await fillSchedule('2026-10-01T08:00','2026-10-20T17:00');holdWindowWrite=true;await new Promise(resolve=>setTimeout(resolve,20));await click('Create draft');await until(()=>releaseWindowWrite!==null);
 check(form.querySelector('input')?.matches(':disabled'),'Fields editable during save');check(buttons().find(node=>node.getAttribute('aria-label')==='Close submission window')?.disabled,'Close allowed during save');document.querySelector('dialog[open]')!.dispatchEvent(new Event('cancel',{cancelable:true}));await click('Cancel');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));check(writes.length===1,'Duplicate request sent');check(document.querySelector('dialog[open]'),'Saving modal dismissed');holdWindowWrite=false;releaseWindowWrite!();await until(()=>!document.querySelector('dialog[open]'));check(writes.length===1,'Save repeated');
});
await scenario('draft editing uses the modal and retains the existing revision contract',async()=>{
 await mount('/dashboard/periods?semester=9',{draft:true});await click('Manage window');await click('Edit draft');await until(()=>document.querySelector('dialog[open]'));check(!document.querySelector('[data-record-page]'),'Editor still replaces page');const form=document.querySelector<HTMLFormElement>('dialog form')!;input(form.querySelector<HTMLInputElement>('input:not([type="datetime-local"])')!,'Revised intake');await new Promise(resolve=>setTimeout(resolve,20));check(buttons().find(node=>node.textContent?.trim()==='Save draft')?.disabled,'Audit reason optional');input(form.querySelector<HTMLTextAreaElement>('textarea')!,'Corrected draft title');await new Promise(resolve=>setTimeout(resolve,20));await click('Save draft');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));check(writes[0].method==='PATCH'&&writes[0].body.expectedRevision===1,'Edit lost concurrency guard');check(writes[0].body.reason==='Corrected draft title','Audit reason missing');
});
await scenario('confirmed dirty navigation closes the modal even for same-semester anchors',async()=>{
 await mount('/dashboard/periods?semester=9');await click('Add submission window');input(document.querySelector<HTMLInputElement>('dialog input:not([type="datetime-local"])')!,'Discard for navigation');await new Promise(resolve=>setTimeout(resolve,20));await router!.navigate('/dashboard/periods?semester=9#marks-period-4');await until(()=>text().includes('Discard unsaved changes?'));await click('Discard changes');await until(()=>!document.querySelector('dialog[open]'));await until(()=>document.querySelector('#period-panel-MARKS'));check(writes.length===0,'Navigation saved draft');
});

await scenario('event search and results share one bounded popup with keyboard dismissal',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true,many:true});await click('Add submission window');await until(()=>document.querySelector('dialog[open]'));
 check(!document.querySelector('[data-submission-window-body] input[type="search"]'),'Disconnected search field remains');document.getElementById('submission-window-calendar-event')!.click();await until(()=>document.querySelector('input[role="combobox"]'));
 let search=document.querySelector<HTMLInputElement>('input[role="combobox"]')!;check(search.closest('[role="dialog"]')?.querySelector('[role="listbox"]'),'Search and results are separate');check(document.activeElement===search,'Popup search did not receive focus');input(search,'Semester event 79');await new Promise(resolve=>setTimeout(resolve,20));await choose('submission-window-calendar-event','Semester event 79');
 check(!document.querySelector('input[role="combobox"]'),'Popup did not close after selection');check(!(document.getElementById('submission-opens-date') as HTMLInputElement).value,'Selection silently filled dates');document.getElementById('submission-window-calendar-event')!.click();await until(()=>document.querySelector('input[role="combobox"]'));search=document.querySelector<HTMLInputElement>('input[role="combobox"]')!;input(search,'Semester event 80');await new Promise(resolve=>setTimeout(resolve,20));search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await until(()=>!document.querySelector('input[role="combobox"]'));check(document.getElementById('submission-window-calendar-event')?.textContent?.includes('Semester event 80'),'Enter did not choose the matching event');document.getElementById('submission-window-calendar-event')!.click();await until(()=>document.querySelector('input[role="combobox"]'));search=document.querySelector<HTMLInputElement>('input[role="combobox"]')!;input(search,'no match exists');await until(()=>text().includes('No events match'));search.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await until(()=>!document.querySelector('input[role="combobox"]'));check(document.querySelector('dialog[open]'),'Escape closed the form');check(document.getElementById('submission-window-calendar-event')?.textContent?.includes('Semester event 80'),'Search lost selection');
 document.getElementById('submission-window-calendar-event')!.click();await until(()=>document.querySelector('[role="listbox"]'));const list=document.querySelector<HTMLElement>('[role="listbox"]')!;check(list.getBoundingClientRect().height<=289,'Event list grew without bound');check(list.scrollHeight>list.clientHeight,'Long event list is not scrollable');search=document.querySelector<HTMLInputElement>('input[role="combobox"]')!;for(let i=0;i<20;i++){search.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,2));}for(let i=0;i<16;i++){search.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,2));}const active=document.getElementById(search.getAttribute('aria-activedescendant')!)!.getBoundingClientRect(),bounds=list.getBoundingClientRect();check(active.top>=bounds.top-1&&active.bottom<=bounds.bottom+1,'Keyboard active result scrolled out of view');search.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));await until(()=>!document.querySelector('input[role="combobox"]'));check(document.getElementById('submission-window-calendar-event')?.textContent?.includes('Semester event 80'),'Tab silently changed selection');check(document.activeElement?.textContent==='Use these dates','Tab did not continue from event field');
});
await scenario('event days fill only the real schedule and confirm before replacing entered dates',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true});await click('Add submission window');await choose('submission-window-calendar-event','Existing calendar event');await click('Use these dates');
 const date=document.getElementById('submission-opens-date') as HTMLInputElement,time=document.getElementById('submission-opens-time') as HTMLInputElement;
 check(date.value==='2026-10-01','Opening calendar day missing');check((document.getElementById('submission-closes-date') as HTMLInputElement).value==='2026-10-20','Closing calendar day missing');check(!time.value,'Import invented a time');check(buttons().find(node=>node.textContent?.trim()==='Create draft')?.disabled,'Missing time accepted');check(document.querySelectorAll('dialog input[type="time"]').length===2,'Duplicate time fields remain');check(!text().includes('Apply event dates'),'Import mini-form remains');
 await fillSchedule('2026-10-02T09:00','2026-10-21T17:00');await click('Use these dates');await until(()=>text().includes('Replace entered dates?'));await click('Cancel');check(date.value==='2026-10-02','Cancel replaced date');await click('Use these dates');await click('Replace dates');await until(()=>date.value==='2026-10-01');check(time.value==='09:00','Import replaced entered time');check(writes.length===0,'Import wrote data');
});
await scenario('modal keeps header and footer visible while only its body scrolls',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true});await click('Add submission window');await choose('submission-window-calendar-event','Existing calendar event');const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!,body=dialog.querySelector<HTMLElement>('[data-submission-window-body]')!,header=dialog.querySelector('header')!,footer=dialog.querySelector('footer')!;
 const before=[header.getBoundingClientRect().top,footer.getBoundingClientRect().bottom];body.scrollTop=body.scrollHeight;await new Promise(resolve=>setTimeout(resolve,20));check(Math.abs(header.getBoundingClientRect().top-before[0])<1&&Math.abs(footer.getBoundingClientRect().bottom-before[1])<1,'Shell moved with body scroll');check(footer.getBoundingClientRect().bottom<=window.innerHeight,'Footer outside viewport');check(dialog.scrollWidth<=dialog.clientWidth+1,'Modal overflows horizontally');check(dialog.scrollHeight<=dialog.clientHeight+1,'Outer dialog has a second scrollbar');check(parseFloat(getComputedStyle(dialog.querySelector('.form-label')!).fontSize)>=13,'Labels too small');
});
await scenario('linked draft editing explains timeline impact and keeps restrictions separate',async()=>{
 await mount('/dashboard/periods?semester=9',{draft:true,linked:true});await click('Manage window');await until(()=>text().includes('Publish this draft before its dates can control submissions.'));await click('Edit draft');await until(()=>document.querySelector('dialog[open]'));check(text().includes('calendar event: Existing calendar event'),'Linked edit target missing');check(text().includes('Saving these dates also updates'),'Linked edit impact missing');
});
await scenario('extension confirms common timeline changes and personal extra time separately',async()=>{
 await mount('/dashboard/periods?semester=9',{linked:true,enforced:true});await click('Manage window');await click('Extend deadline');await until(()=>document.querySelector('dialog[open]'));const date=document.querySelector<HTMLInputElement>('dialog input[type="datetime-local"]')!;const future=new Date(Date.now()+86400000).toISOString().slice(0,16);input(date,future);await until(()=>text().includes('reopen submissions'));check(text().includes('Saving will also update the displayed event dates'),'Common extension hides timeline effect');const combo=document.querySelector<HTMLButtonElement>('dialog button[role="combobox"]')!;combo.click();await until(()=>document.querySelector('[role="listbox"]'));const selected=[...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node=>node.textContent?.includes('Selected cases'))!;selected.click();await until(()=>text().includes('general deadline and linked timeline remain unchanged'));check(!document.querySelector('[aria-label="Extension impact"]')?.textContent?.includes('reopen submissions'),'Personal extra time claims to reopen common window');
});
await scenario('overview enforcement reason protects route navigation and preserves Keep editing',async()=>{
 await mount('/dashboard/periods?semester=9',{enforced:true});await click('Turn off date restrictions');await until(()=>document.querySelector('dialog[open] textarea'));const field=document.querySelector<HTMLTextAreaElement>('dialog[open] textarea')!;input(field,'Keep my rationale');await new Promise(resolve=>setTimeout(resolve,20));await router!.navigate('/marks/config?semester=9');await until(()=>text().includes('Discard unsaved changes?'));check(field.value==='Keep my rationale','Route prompt lost reason');await click('Stay on this page');check(router!.state.location.pathname==='/dashboard/periods','Keep editing allowed navigation');check(field.value==='Keep my rationale','Keep editing discarded reason');
});
await scenario('pending window save continues requested route after commit',async()=>{
 await mount('/dashboard/periods?semester=9',{empty:true});await click('Add submission window');input(document.querySelector<HTMLInputElement>('dialog input:not([type="datetime-local"])')!,'Pending intake');await fillSchedule('2026-10-01T08:00','2026-10-20T17:00');holdWindowWrite=true;await click('Create draft');await until(()=>releaseWindowWrite);void router!.navigate('/marks/config?semester=9');await until(()=>text().includes('Saving changes')||text().includes('Saving submission window'));releaseWindowWrite!();releaseWindowWrite=null;await until(()=>router!.state.location.pathname==='/marks/config');check(periods.length===1,'Pending route lost committed window');
});

window.parent.postMessage({type:'periods-workspace-results',results},location.origin);
} else {
 await mount();
 if(preview==='restriction-review') {
  await scenario('shared window is readable once and discard uses a nested modal',async()=>{
   const prior={scope:base.programmeScope,programmes:base.programmes};base.programmeScope='ALL';base.programmes=[];
   await mount();base.programmeScope=prior.scope;base.programmes=prior.programmes;
   await click('Review and enable');await until(()=>document.querySelector('dialog[open]'));
   const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!;
   const review=dialog.querySelector<HTMLElement>('[aria-label="Programme coverage review"]')!;
   check(review.querySelectorAll('article').length===1,'Shared window repeated for each programme');
   check(review.querySelectorAll('article ul li').length===PROGRAMME_OPTIONS.length,'Programme coverage lost');
   check(review.querySelectorAll('dl time').length===2,'Opening/closing schedule not separated');
   check(dialog.scrollWidth<=dialog.clientWidth+1,'Review overflows horizontally');
   if(innerWidth>=1024)check(dialog.getBoundingClientRect().width>=700,'Review modal is still too narrow');
   const checkbox=dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
   const checkboxBounds=checkbox.getBoundingClientRect(),labelBounds=checkbox.nextElementSibling!.getBoundingClientRect();
   check(Math.abs(checkboxBounds.top-labelBounds.top)<=6,'Acknowledgement checkbox misaligned');
   checkbox.click();const reason=dialog.querySelector<HTMLTextAreaElement>('textarea')!;input(reason,'Preserve my review');await new Promise(resolve=>setTimeout(resolve,20));
   await click('Close dialog');await until(()=>document.querySelectorAll('dialog[open]').length===2);
   const prompt=[...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1)!;
   check(prompt.textContent?.includes('Discard unsaved changes?'),'Discard is not a separate modal');
   check(!dialog.querySelector('[role="alert"]'),'Inline discard box remains');
   check(prompt.contains(document.activeElement),'Discard modal does not trap focus');
   await click('Keep editing');await until(()=>document.querySelectorAll('dialog[open]').length===1);
   check(reason.value==='Preserve my review'&&checkbox.checked,'Keep editing lost input');
   await click('Close dialog');await until(()=>document.querySelectorAll('dialog[open]').length===2);
   await click('Discard changes');await until(()=>!document.querySelector('dialog[open]'));
   check(writes.length===0,'Discard mutated restrictions');
  });
  await scenario('coverage gaps remain visible and acknowledgement still gates submission',async()=>{
   await mount();await click('Review and enable');await until(()=>document.querySelector('dialog[open]'));
   check(text().includes('No published window. New submissions will be blocked.'),'Coverage gaps hidden');
   const dialog=document.querySelector<HTMLDialogElement>('dialog[open]')!;
   check(dialog.scrollWidth<=dialog.clientWidth+1,'Coverage gaps overflow');
   const confirm=buttons().find(node=>node.textContent?.trim()==='Confirm change')!;
   input(dialog.querySelector<HTMLTextAreaElement>('textarea')!,'Reviewed programme coverage');await new Promise(resolve=>setTimeout(resolve,20));
   check(confirm.disabled,'Reason bypassed acknowledgement');dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();await new Promise(resolve=>setTimeout(resolve,20));
   await click('Confirm change');await until(()=>writes.length===1&&!document.querySelector('dialog[open]'));
   check(writes[0].body.enabled===true&&writes[0].body.reason==='Reviewed programme coverage','Restriction request changed');
  });
  // Leave the populated review visible for the browser runner's screenshot.
  await mount();await click('Review and enable');await until(()=>document.querySelector('dialog[open]'));
  window.parent.postMessage({type:'periods-workspace-results',results},location.origin);
 }
 if(preview==='window-detail') {
  await scenario('linked draft has separated cards, clear archive action and expandable history',async()=>{
   base.history=[{id:1,action:'CREATE',actorName:'Office reviewer',createdAt:'2026-10-01T00:00:00Z',reason:'',before:{},after:{closesAt:base.closesAt}}];
   await mount('/dashboard/periods?semester=9',{draft:true,linked:true});base.history=[];
   await click('Manage window');await until(()=>document.querySelector('[data-record-page]'));
   check(!buttons().some(node=>['Link existing event','Create linked event','Close history'].includes(node.textContent?.trim()??'')),'Redundant link or close controls remain');
   const record=document.querySelector('[data-record-page]')!;
   const archive=buttons().find(node=>node.textContent?.trim()==='Archive window')!;
   check(archive.classList.contains('bg-rose-600')&&archive.classList.contains('text-white'),'Archive is not solid red');
   check(record.querySelectorAll('dl time').length===2,'Opening/closing dates are missing');
   check(record.querySelectorAll('dl time > span').length===0,'Schedule still splits date and time into tiny lines');
   check(record.querySelectorAll('[aria-label="Submission schedule status"] > span').length===1,'Window has duplicate status badges');
   check(record.textContent?.includes('Malaysia time (UTC+08:00)'),'Schedule timezone missing');
   const history=record.querySelector<HTMLDetailsElement>('details')!;
   check(!history.open,'History starts expanded');history.open=true;
   await until(()=>text().includes('Window created'));
   check(!text().includes('New deadline:'),'Creation repeats current deadline');
   check(!text().includes('CREATE ·'),'Raw audit action exposed');
   history.open=false;await new Promise(resolve=>setTimeout(resolve,30));check(!history.open,'History cannot collapse');
   await click('Edit draft');await until(()=>document.querySelector('dialog[open]'));
   const impact=document.querySelector<HTMLElement>('[aria-label="Linked date impact"]')!;
   check(impact.textContent?.includes('Saving these dates also updates the calendar')&&impact.textContent?.includes('Existing calendar event'),'Linked schedule warning missing');
   check(!!impact.querySelector('svg')&&impact.classList.contains('bg-blue-50'),'Compact information styling and icon missing');
   check(!!(impact.compareDocumentPosition(document.getElementById('submission-opens-date')||document.querySelector('dialog input[type="date"]')!)&Node.DOCUMENT_POSITION_FOLLOWING),'Warning must precede schedule inputs');
   check(document.querySelector('dialog[open]')!.scrollWidth<=document.querySelector('dialog[open]')!.clientWidth+1,'Warning causes modal overflow');
   await click('Cancel');await until(()=>!document.querySelector('dialog[open]'));
   await click('Manage window');await until(()=>document.querySelector('[data-record-page]'));
   await click('Archive window');await until(()=>document.querySelector('dialog[open]'));
   check(writes.length===0,'Opening archive confirmation mutated data');
   check(document.documentElement.scrollWidth<=innerWidth+1,'Page overflows');
  });
  await scenario('Marks windows use the same connection and history sections',async()=>{
   await mount('/dashboard/periods?semester=9',{linkedMarks:true});await click('View Marks evaluations');await click('Manage window');
   await until(()=>document.querySelector('[data-record-page]'));
   check(!buttons().some(node=>['Link existing event','Create linked event'].includes(node.textContent?.trim()??'')),'Marks offers another link');
   const history=document.querySelector<HTMLDetailsElement>('[data-record-page] details')!;history.open=true;
   await until(()=>text().includes('No window changes recorded.'));
   check(!buttons().some(node=>node.textContent?.trim()==='Close history'),'Marks retains Close history');
  });
  window.parent.postMessage({type:'periods-workspace-results',results},location.origin);
 }
 if(preview==='window-layout') {
  await scenario('window dates and status/action columns remain distinct',async()=>{
   for(const label of ['Supervisor applications windows','Marks evaluation windows']) {
    if(label==='Marks evaluation windows')await click('View Marks evaluations');
    const table=document.querySelector<HTMLTableElement>(`table[aria-label="${label}"]`)!;
    check(table,'Window table missing');
    const row=table.querySelector('tbody tr')!;
    const cells=row.querySelectorAll('td');
    check(cells.length===6,'Six columns required');
    check(cells[4].children.length===2&&!cells[4].querySelector('p'),'Status must be one badge without a second line');
    check(cells[4].lastElementChild?.textContent?.trim()===(label==='Supervisor applications windows'?'Dates unrestricted':'OPEN'),'Window status should describe its schedule');
    for(const index of [2,3]) {
     check(cells[index].querySelectorAll('time > span').length===2,'Date/time line structure inconsistent');
     check(cells[index].textContent?.includes('MYT'),'Timezone missing');
    }
    if(innerWidth>=1024) {
     const status=cells[4].getBoundingClientRect(),action=cells[5].getBoundingClientRect();
     check(status.width>=85&&action.width>=120,'Status/action columns collapsed');
     check(status.right<=action.left+1,'Status overlaps action');
     const badge=cells[4].querySelector('span')!.getBoundingClientRect();
     check(badge.right<=action.left,'Status badge overlaps action');
    }
    check(document.documentElement.scrollWidth<=innerWidth+1,'Whole page overflows');
   }
  });
  window.parent.postMessage({type:'periods-workspace-results',results},location.origin);
 }
 if(preview==='marks')await click('View Marks evaluations');
 if(preview==='window'||preview==='calendar')await click('Manage window');
 if(preview==='calendar')await click('Create linked event');
 if(preview==='restrictions')await click('Review and enable');
 if(preview==='create'||preview==='linked-create'||preview==='event-picker')await click('Add submission window');
 if(preview==='event-picker')document.getElementById('submission-window-calendar-event')!.click();
 if(preview==='linked-create'){await choose('submission-window-calendar-event','Existing calendar event');await click('Use these dates');}
}
