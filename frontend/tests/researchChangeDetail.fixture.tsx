import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {ResearchAmendments,ResearchAmendmentCard,ResearchAmendmentForm,ResearchAmendmentRouteContent} from '../src/components/ResearchAmendments';
import type {ResearchAmendment,ResearchAmendmentOptions} from '../src/services/researchAmendmentsApi';
import type {UserRole} from '../src/types/auth';

const container=document.getElementById('root')!;
const results:{name:string;error:string|null}[]=[];
const check=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
const until=async(predicate:()=>unknown)=>{for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error(`Timed out: ${container.textContent}`);};
const before={programme:'Master of Data Science (Coursework)',title:'Early-warning models for postgraduate academic support',abstract:'This study examines machine-learning approaches to identifying postgraduate students who may benefit from early academic support.\n\nSynthetic records are used to evaluate a baseline model and a tree-based model.'};
const request:ResearchAmendment={id:12,kind:'RESEARCH',status:'PENDING_SUPERVISOR',studentId:7,studentName:'Aina Sofea Rahman (Demo)',matricNo:'DEMO-UX-007',sourceProgramme:before.programme,destinationProgramme:'',before,
  after:{...before,title:'Explainable early-warning models for postgraduate academic support',abstract:before.abstract+'\n\nThe revised study also compares two explanation layouts to assess how clearly supervisors understand the recommendations.'},reason:'Clarify the explainability focus and include a comparison of explanation layouts in the study scope.',createdAt:'2026-10-20T08:00:00Z',updatedAt:'2026-10-20T08:00:00Z',stageLabel:'Awaiting Supervisor review',canDecide:false,canCancel:false,requiresTeamAcknowledgement:false,teamSnapshot:{primary:{appointmentId:4,userId:21,name:'Dr Nadia Hassan'},coSupervisors:[],panel:[]},unfinishedTaskCount:null,
  events:[{id:1,action:'SUBMIT',actorName:'Aina Sofea Rahman (Demo)',actorRole:'Student',previousStatus:'',newStatus:'PENDING_SUPERVISOR',reason:'',retainTeam:false,createdAt:'2026-10-20T08:00:00Z'}]};
const options:ResearchAmendmentOptions={students:[{id:7,name:request.studentName,matricNo:request.matricNo,programme:before.programme}],programmes:[before.programme,'Cybersecurity'],profile:{...before,studentId:7,revision:1,currentIntent:{methodology:'Conduct interviews.',timeline:'Complete interviews in May.'}},canSubmitResearch:true,canCorrect:false,canTransfer:false};
let root:Root|null=null,failRead=false;
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(row=>row.textContent?.trim()===label);
const click=async(label:string)=>{const target=button(label);check(target,`Missing button: ${label}`);target!.click();await new Promise(r=>setTimeout(r,0));};
async function direct(element:React.ReactNode){root?.unmount();root=createRoot(container);root.render(element);await until(()=>!!container.textContent);}
async function mount(role:UserRole='Lecturer',row=request){
  root?.unmount();root=createRoot(container);
  window.fetch=async(input,init)=>{
    check(!init?.method||init.method==='GET','No academic writes are permitted');
    const url=new URL(String(input),location.origin);check(url.pathname.startsWith('/api/appointments/research-amendments/'),'Unexpected route');
    if(failRead)return Response.json({detail:'Fixture read failed'},{status:500});
    const scoped={...row,canDecide:role==='Lecturer'&&row.kind==='RESEARCH'||role==='Programme Coordinator'&&row.kind==='TRANSFER',canCancel:role==='Student'&&row.kind==='RESEARCH'&&row.status.startsWith('PENDING')};
    if(!row.status.startsWith('PENDING'))scoped.canDecide=false;
    return Response.json(url.pathname.endsWith('/options/')?{...options,profile:{...options.profile,title:'Later live profile title'},canSubmitResearch:role==='Student'}:/\/12\/$/.test(url.pathname)?scoped:{requests:[scoped],revisions:[]});
  };
  root.render(<ResearchAmendments role={role} hideHeader showRefresh={false} routeView="detail" routeRequestId="12" onNavigateToProfile={()=>{}}/>);
  await until(()=>!container.textContent?.includes('Loading research changes')&&!!container.textContent);
}
function geometry(){
  check(document.documentElement.scrollWidth<=innerWidth,'Viewport has horizontal overflow');
  for(const element of container.querySelectorAll<HTMLElement>('[data-research-request-detail] [role="region"], [data-research-change-form], button')){
    const r=element.getBoundingClientRect();if(r.width)check(r.left>=0&&r.right<=innerWidth+1,'Surface or control overflows');
  }
  const columns=container.querySelector<HTMLElement>('[data-research-request-columns]');
  if(columns){const comparison=columns.children[0].getBoundingClientRect(),review=columns.children[1].getBoundingClientRect();
    if(innerWidth>=1280)check(review.left-comparison.right>=27&&Math.abs(review.top-comparison.top)<2,'Desktop review is not spaced beside comparison');
    else check(review.top-comparison.bottom>=27,'Stacked cards lack breathing room');
  }
  for(const answer of container.querySelectorAll('[data-request-comparison] dd'))check(getComputedStyle(answer).fontWeight==='400','Comparison answers must have regular weight');
}
async function setValue(element:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,value:string){
  const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await new Promise(r=>setTimeout(r,0));
}
const field=(text:string)=>[...container.querySelectorAll('label')].filter(label=>label.textContent?.trim().startsWith(text))
  .map(label=>label.control).find(control=>control?.matches('input:not([type="checkbox"]),textarea,select')) as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|undefined;
const toggle=async(text:string)=>{
  const input=[...container.querySelectorAll('label')].find(label=>label.textContent?.trim()===text&&label.control?.matches('input[type="checkbox"]'))?.control as HTMLInputElement|undefined;
  check(input,`Missing field choice: ${text}`);input!.click();await new Promise(r=>setTimeout(r,0));
};
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name,error:null});}catch(error){results.push({name,error:String(error)});}}

await scenario('Every role reads separate request surfaces with saved evidence',async()=>{
  for(const role of ['Student','Lecturer','Programme Coordinator','Office Staff/Admin'] as const){await mount(role);
    check(container.querySelectorAll('[data-research-request-detail] [role="region"]').length===3,'Expected three independent cards');
    for(const text of [request.before.title,request.after.title,request.reason,'Before this request','Proposed abstract'])check(container.textContent?.includes(text),text);
    check(!container.textContent?.includes('Later live profile title'),'Live profile replaced submitted evidence');
    const comparisons=[...container.querySelectorAll<HTMLDetailsElement>('[data-request-comparison] details')];
    check(comparisons.length===2&&comparisons.every(field=>field.open),'Two request comparisons should start open');
    check(comparisons[0].innerText.includes(request.after.title),'Proposed title was not revealed');
    comparisons[0].querySelector('summary')!.click();
    check(!comparisons[0].open&&comparisons[1].open,'Closing one comparison must leave the second open');
    check(!!button('Approve request')===(role==='Lecturer'),'Review capability changed');check(!!button('Cancel request')===(role==='Student'),'Student cancellation capability changed');geometry();
  }
});
await scenario('Terminal comparisons and visible decision notes remain accurate',async()=>{
  for(const status of ['APPROVED','REJECTED','CANCELLED'] as const){await mount('Office Staff/Admin',{...request,status,after:{...request.after,title:request.before.title},events:[...request.events,{id:2,action:status==='APPROVED'?'APPROVE':status==='REJECTED'?'REJECT':'CANCEL',actorName:'Dr Nadia Hassan',actorRole:'Lecturer',previousStatus:'PENDING_SUPERVISOR',newStatus:status,reason:'Recorded decision explanation',retainTeam:false,createdAt:'2026-10-21T08:00:00Z'}]});
    check(container.querySelectorAll('[data-request-comparison] details').length===1&&container.querySelector('[data-request-comparison] details[open]'),'A single changed field should start open');
    check(container.textContent?.includes(status==='APPROVED'?'Approved abstract':'Proposed abstract'),'Wrong outcome comparison label');
    check(!button('Approve request')&&!button('Cancel request'),'Terminal record has mutation actions');
    const audit=container.querySelector<HTMLDetailsElement>('aside details')!;check(!audit.open,'Audit must start collapsed');
    check([...container.querySelectorAll('p')].some(p=>p.textContent?.includes('Recorded decision explanation')&&!p.closest('details')),'Decision reason is hidden');audit.querySelector('summary')!.click();check(audit.open,'Audit failed to expand');geometry();
  }
});
await scenario('Decision callbacks and busy state retain their original targets',async()=>{
  const actions:string[]=[];let profile=0;
  const render=(busy=false)=><ResearchAmendmentCard row={{...request,canDecide:true}} presentation="detail" busy={busy} onAction={(row,action)=>actions.push(`${row.id}:${action}`)} onViewProfile={()=>profile++}/>;
  await direct(render());await click('Approve request');await click('Reject request');await click('View research profile');check(actions.join(',')==='12:APPROVE,12:REJECT'&&profile===1,'Wrong callback target');
  await direct(render(true));check([...container.querySelectorAll('button')].every(button=>button.disabled),'Busy buttons remain enabled');
  for(const button of container.querySelectorAll('button'))button.click();check(actions.length===2&&profile===1,'Busy callback fired');geometry();
});
await scenario('Transfer decisions preserve team evidence and acknowledgement protection',async()=>{
  const transfer={...request,kind:'TRANSFER' as const,status:'PENDING_SOURCE_COORDINATOR' as const,after:{...request.before,programme:'Cybersecurity'},destinationProgramme:'Cybersecurity',requiresTeamAcknowledgement:true,unfinishedTaskCount:2};
  await mount('Programme Coordinator',transfer);check(container.textContent?.includes('Dr Nadia Hassan')&&container.textContent.includes('2 unfinished'),'Saved retention evidence missing');
  await click('Approve request');await until(()=>!!document.querySelector('dialog[open]'));
  const dialog=document.querySelector('dialog[open]')!;const confirm=[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.includes('Approve source programme transfer'))!;
  check(confirm?.disabled,'Transfer approval lacks acknowledgement guard');const checkbox=dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;checkbox.click();await until(()=>!confirm.disabled);
  checkbox.click();await until(()=>confirm.disabled);await click('Cancel');await until(()=>!document.querySelector('dialog[open]'));
  await mount('Student',transfer);check(!container.textContent?.includes('unfinished evaluation tasks')&&!container.textContent?.includes('Dr Nadia Hassan'),'Student gained staff transfer snapshot');geometry();
});
await scenario('Long identities and complete abstracts wrap without truncation',async()=>{
  const row={...request,studentName:'LongStudentName'.repeat(35),reason:'LongReason'.repeat(80),after:{...request.after,title:'ResearchTerm'.repeat(90),abstract:'AbstractTerm'.repeat(140)+'\n\nComplete second paragraph.',methodology:'Compare survey answers.'}};
  await mount('Lecturer',row);
  const comparisonPanels=[...container.querySelectorAll<HTMLDetailsElement>('[data-request-comparison] details')];
  check(comparisonPanels.length===3&&comparisonPanels.every(panel=>!panel.open),'Three changed fields should start collapsed');
  const abstract=comparisonPanels.find(field=>field.querySelector('summary')?.textContent?.trim()==='Research abstract');
  comparisonPanels[0].querySelector('summary')!.click();
  abstract?.querySelector('summary')?.click();
  check(abstract?.open&&!comparisonPanels[0].open&&abstract.innerText.includes('Complete second paragraph.'),'Opening the abstract should close the previous field and reveal the full text');geometry();
});
await scenario('Student form submits only selected, changed values and one reason',async()=>{
  const saves:unknown[]=[];await direct(<ResearchAmendmentForm options={options} studentView busy={false} onSave={(kind,values)=>saves.push({kind,values})}/>);
  const proposedMethodology='Survey postgraduate students.\n\n'+'Describe the full sampling and analysis procedure.\n\n'.repeat(25)+'Keep the complete final paragraph.';
  check(button('Submit request')?.disabled&&!container.querySelector('[data-change-preview]'),'Unchanged form can submit');
  check(!field('Research title')&&!field('Methodology'),'Unselected editors are visible');
  await setValue(field('Reason for change')!,' Clarify the research title. ');check(button('Submit request')?.disabled,'Reason alone enabled submission');
  await toggle('Research title');await toggle('Methodology');await toggle('Research timeline');await toggle('Research abstract');
  check(field('Methodology')?.value==='Conduct interviews.','Methodology did not load from the current plan');
  await setValue(field('Research title')!,' Revised title ');
  await setValue(field('Methodology')!,` ${proposedMethodology} `);
  await setValue(field('Research timeline')!,'');check(button('Submit request')?.disabled,'Selected blank field can submit');
  await setValue(field('Research timeline')!,'Finish surveys in June.');await toggle('Research timeline');
  check(!field('Research timeline')&&!button('Submit request')?.disabled,'Deselecting should omit the editor');
  await toggle('Research timeline');check(field('Research timeline')?.value==='Finish surveys in June.','Reselecting lost the draft');
  const preview=container.querySelector<HTMLElement>('[data-change-preview]')!;
  const fields=[...preview.querySelectorAll<HTMLDetailsElement>('details')];
  check(fields.length===3&&fields.every(field=>!field.open),'Preview should list changed fields with comparisons collapsed');
  const method=fields.find(field=>field.querySelector('summary')?.textContent?.trim()==='Methodology')!;
  method.querySelector('summary')!.click();
  check(method.open&&method.innerText.includes('Conduct interviews.')&&method.innerText.includes('Keep the complete final paragraph.'),'Full comparison failed');
  const timeline=fields.find(field=>field.querySelector('summary')?.textContent?.trim()==='Research timeline')!;
  timeline.querySelector('summary')!.click();
  check(timeline.open&&!method.open,'Opening another comparison should collapse the previous one');
  check(!preview.textContent?.includes('Proposed abstract'),'Unchanged abstract in preview');
  await toggle('Research timeline');
  await click('Submit request');check(JSON.stringify(saves)===JSON.stringify([{kind:'RESEARCH',values:{title:'Revised title',planChanges:{methodology:proposedMethodology},reason:'Clarify the research title.'}}]),'Payload includes unselected or unchanged fields');geometry();
});
await scenario('Audited correction requires confirmation and omits transfer creation',async()=>{
  const staff={...options,canSubmitResearch:false,canCorrect:true,canTransfer:true};let saved='';
  await direct(<ResearchAmendmentForm options={staff} initialKind="CORRECTION" busy={false} onSave={kind=>saved=kind}/>);
  await setValue(field('Research title')!,'Corrected title');await setValue(field('Reason for change')!,'Correct spelling only.');check(button('Save audited correction')?.disabled,'Correction bypassed meaning confirmation');
  container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();await until(()=>!button('Save audited correction')?.disabled);await click('Save audited correction');check(saved==='CORRECTION','Wrong correction kind');
  check(!container.querySelector('option[value="TRANSFER"]')&&!field('Destination programme'),'Legacy transfer capability exposes a creation form');geometry();
});
await scenario('Busy form prevents editing and duplicate submissions',async()=>{
  await direct(<ResearchAmendmentForm options={options} studentView busy onSave={()=>{throw Error('Busy submission fired');}}/>);
  check(container.querySelector('fieldset')?.disabled&&button('Submit request')?.disabled,'Busy form not disabled');button('Submit request')!.click();geometry();
});
await scenario('Request list remains compact and responds directly to search',async()=>{
  let opened='';const render=(search:string)=><ResearchAmendmentRouteContent routeView="list" role="Lecturer" options={options} rows={[{...request,canDecide:true}]} revisions={[]} busy={false} onAction={()=>{}} requestForm={null} requestSearch={search} onNavigateToRequest={id=>opened=id}/>;
  await direct(render('explainable'));check(button('Review request'),'Matching request missing');check(!container.querySelector('[data-request-comparison]')&&!container.textContent?.includes(request.reason),'List contains detailed evidence');await click('Review request');check(opened==='12','Wrong list record');
  await direct(render('No matching student'));check(!button('Review request')&&container.textContent?.includes('No matching requests'),'Search did not filter immediately');geometry();
});
await scenario('Failed reads retry without exposing stale request content',async()=>{
  failRead=true;await mount();check(!container.querySelector('[data-research-request-detail]'),'Failed read retained evidence');failRead=false;await click('Retry');await until(()=>container.querySelector('[data-research-request-detail]'));geometry();
});

await mount('Lecturer');
parent.postMessage({type:'research-change-results',width:innerWidth,results},location.origin);
