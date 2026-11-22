import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter,useLocation,useNavigate} from 'react-router';
import {APP_ROUTES,routeForPanelRecommendation} from '../src/constants/routes';
import {researchProfileRecordReturn} from '../src/utils/recordNavigation';
import {PanelRecommendationDetail,PanelAppointmentRecordCard} from '../src/components/PanelRecordDetails';
import {PanelRecommendationReviewDrawer} from '../src/components/LecturerPanelAppointments';
import {PanelAppointmentDetail} from '../src/components/PanelAppointmentDetail';
import {RecommendationDetailsDrawer} from '../src/components/RecommendationDetailsDrawer';
import type {PanelRecommendationDraft,PanelRecord,SubmittedRecommendation} from '../src/types';

const container=document.getElementById('root')!;
const results:{name:string;error:string|null}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const until=async(predicate:()=>unknown)=>{for(let i=0;i<160;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error(`Timed out: ${container.textContent}`);};
let root:Root|null=null;
const record:PanelRecommendationDraft={id:71,studentId:'DEMO-PG-071',studentName:'Aina Sofea Rahman (Demo)',programme:'Master of Data Science (Coursework)',semester:'Semester I 2026/2027',supervisorName:'Dr Nadia Hassan',recommendedMember:'Dr Amir Hakim',recommendedMemberId:'DEMO-L071',panelMemberDepartment:'Artificial Intelligence',panelMemberEmail:'amir@example.test',studentEmail:'aina@example.test',supervisorEmail:'nadia@example.test',proposedTopic:'Explainable early-warning models for postgraduate academic support',researchArea:'Explainable artificial intelligence and educational data mining',abstract:'This study investigates explainable machine-learning support for identifying postgraduate students who may benefit from early academic assistance. Synthetic records of milestone completion and assessment trends are used to compare an interpretable baseline and a tree-based model.\n\nA supervisor-facing prototype will present risk factors and suggested discussion points. Two explanation layouts will be evaluated using scripted scenarios, focusing on comprehension and perceived usefulness. No real student records will be used.',status:'SUBMITTED_TO_PANEL',submittedAt:'2026-10-20T08:00:00Z',submittedDate:'20 Oct 2026',justification:'Dr Amir’s expertise in interpretable machine learning and educational analytics complements the project’s evaluation needs. His experience in usability studies will support assessment of the explanation layouts.',workflow:[{id:1,action:'SUBMIT',actorName:'Dr Nadia Hassan',actorRole:'Lecturer',previousStatus:'',newStatus:'SUBMITTED_TO_PANEL',reason:'',createdAt:'2026-10-20T08:00:00Z'}]};
const button=(text:string,scope:ParentNode=document)=>[...scope.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===text);
async function mount(element:React.ReactNode){root?.unmount();root=createRoot(container);root.render(element);await until(()=>!!container.textContent);await pause();}
async function click(text:string,scope:ParentNode=document){const target=button(text,scope);check(target,`Missing ${text}`);target!.click();await pause();}
async function value(element:HTMLTextAreaElement,text:string){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(element,text);element.dispatchEvent(new Event('input',{bubbles:true}));await pause();}
function geometry(){
  check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow');
  const columns=container.querySelector<HTMLElement>('[data-panel-request-columns]')!;
  if(columns.children.length===2){const main=columns.children[0].getBoundingClientRect(),aside=columns.children[1].getBoundingClientRect();if(innerWidth>=1280)check(aside.left-main.right>=27&&Math.abs(aside.top-main.top)<2,'Desktop aside alignment');else check(aside.top-main.bottom>=27,'Stacked review spacing');}
  for(const answer of container.querySelectorAll('dl dd')){check(getComputedStyle(answer).fontWeight==='400','Answers must have regular weight');check(parseFloat(getComputedStyle(answer).fontSize)>=14,'Answer text too small');}
  for(const b of container.querySelectorAll<HTMLButtonElement>('[data-detail-actions] button')){const box=b.getBoundingClientRect();check(box.height>=32&&box.width>=200,'Sidebar decision touch target');}
  for(const region of container.querySelectorAll<HTMLElement>('[role="region"]')){const box=region.getBoundingClientRect();check(box.left>=-1&&box.right<=innerWidth+1,'Card outside viewport');}
}
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name,error:null});}catch(error){results.push({name,error:String(error)});}}

await scenario('Reviewer and Coordinator use the same detail layout and stage-specific controls',async()=>{
  for(const coordinator of [false,true]){let opened='';const row={...record,status:coordinator?'PENDING_COORDINATOR' as const:record.status,canReview:true};
    await mount(<PanelRecommendationReviewDrawer isOpen routed recommendation={row} reviewerRole={coordinator?'PROGRAMME_COORDINATOR':'SELECTED_PANEL'} onClose={()=>{}} onOpenStudent={id=>opened=id}/>);
    for(const title of ['Nomination details','Research summary','Review and outcome'])check([...container.querySelectorAll('h2')].some(h=>h.textContent===title),title);
    check(button(coordinator?'Approve request':'Accept request')&&button('Reject request'),'Missing decisions');
    check(container.textContent!.indexOf(record.justification!)<container.textContent!.indexOf('Research summary'),'Wrong reading order');
    await click('View student record');check(opened===record.studentId,'Student target changed');geometry();
  }
});
await scenario('Research summary opens the authorised student profile and retains the exact Panel source',async()=>{
  const source = routeForPanelRecommendation(String(record.id))+'?panelSection=requests';
  let allowed = false;
  let lookup: URL | undefined;
  const originalFetch = window.fetch;
  window.fetch = async input => {
    lookup = new URL(String(input), location.origin);
    check(lookup.pathname.endsWith('/profile-link/'),'Unexpected research profile lookup');
    return Response.json({studentId:allowed ? 15 : null});
  };
  function Workspace() {
    const location = useLocation();
    const navigate = useNavigate();
    if (location.pathname === APP_ROUTES.supervisorResearchProfile) {
      const target = researchProfileRecordReturn(location.state?.researchProfileReturn, {path:APP_ROUTES.supervisorResearchChanges,label:'Research changes'});
      check(location.search === '?profileStudent=15','Wrong student profile');
      return <button onClick={() => navigate(target.path)}>Back to {target.label}</button>;
    }
    return <PanelRecommendationDetail record={record}/>;
  }
  const route = <MemoryRouter initialEntries={[source]}><Workspace/></MemoryRouter>;
  try {
    await mount(route);
    await until(()=>lookup?.searchParams.get('matricNo') === record.studentId);
    await pause();
    check(!button('View research profile'),'Panel-only lecturer received a full-profile link');
    const abstract = container.querySelector<HTMLDetailsElement>('[data-research-details] details')!;
    check(!abstract.open&&abstract.querySelector('summary')?.textContent?.includes('Read full abstract'),'Long abstract is not compact by default');
    abstract.querySelector('summary')!.click();
    check(abstract.open&&abstract.textContent?.includes(record.abstract!),'Panel-only lecturer lost the full abstract');
    allowed = true;
    await mount(route);
    await until(()=>button('View research profile'));
    await click('View research profile');
    await click('Back to Panel recommendation');
    await until(()=>container.textContent?.includes(record.justification!));
  } finally {
    window.fetch = originalFetch;
  }
});
await scenario('Review confirmation and rejection retain exact targets and required reasons',async()=>{
  const decisions:string[]=[];
  const available={...record,acceptanceCapacity:{state:'AVAILABLE' as const,activeLoad:1,reservedLoad:0,limit:4,availableSlots:3,pendingRequests:1}};
  await mount(<PanelRecommendationReviewDrawer isOpen routed recommendation={available} reviewerRole="SELECTED_PANEL" onClose={()=>{}} onAccept={async row=>{decisions.push(`${row.id}:accept`);return false as const;}} onReject={async(row,reason)=>{decisions.push(`${row.id}:${reason}`);return false as const;}}/>);
  await click('Accept request');await until(()=>!!document.querySelector('dialog[open]'));let dialog=document.querySelector('dialog[open]')!;
  check(dialog.textContent?.includes('Acceptance reserves a place while the Programme Coordinator makes the final decision.'),'Workflow copy changed');await click('Accept nomination',dialog);check(decisions.join()==='71:accept','Wrong acceptance callback');await click('Cancel',dialog);await until(()=>!document.querySelector('dialog[open]'));
  await click('Reject request');await until(()=>!!document.querySelector('dialog[open]'));dialog=document.querySelector('dialog[open]')!;check(button('Reject recommendation',dialog)?.disabled,'Missing required reason guard');
  await value(dialog.querySelector('textarea')!,' Unavailable this semester. ');await click('Reject recommendation',dialog);check(decisions.at(-1)==='71:Unavailable this semester.','Wrong rejection target or reason');
  await mount(<PanelRecommendationReviewDrawer isOpen routed recommendation={{...record,status:'PENDING_COORDINATOR',canReview:true}} reviewerRole="PROGRAMME_COORDINATOR" onClose={()=>{}} onAccept={async row=>{decisions.push(`${row.id}:approve`);return false as const;}}/>);
  await click('Approve request');await until(()=>!!document.querySelector('dialog[open]'));dialog=document.querySelector('dialog[open]')!;check(dialog.textContent?.includes('Approval creates the Panel appointment.'),'Coordinator workflow copy changed');await click('Approve recommendation',dialog);check(decisions.at(-1)==='71:approve','Wrong Coordinator target');
});
await scenario('Read-only and ineligible records omit decisions; busy controls cannot fire',async()=>{
  for(const extra of [{readOnly:true},{recommendation:{...record,canReview:false}},{recommendation:{...record,participantEligible:false}}]){await mount(<PanelRecommendationReviewDrawer isOpen recommendation={record} reviewerRole="SELECTED_PANEL" onClose={()=>{}} {...extra}/>);check(!button('Accept request')&&!button('Reject request'),'Unauthorised decision');geometry();}
  let fired=0;await mount(<PanelRecommendationReviewDrawer isOpen busy recommendation={record} reviewerRole="SELECTED_PANEL" onClose={()=>fired++} onOpenStudent={()=>fired++}/>);
  for(const b of container.querySelectorAll<HTMLButtonElement>('button')){check(b.disabled,'Busy action enabled');b.click();}check(fired===0,'Busy callback fired');geometry();
});
await scenario('Replacement distinguishes the active member and terminal historical member',async()=>{
  for(const pending of [true,false]){await mount(<PanelRecommendationDetail record={{...record,status:pending?'PENDING_COORDINATOR':'APPROVED',replacesAppointmentId:12,replacementReason:'Additional educational analytics expertise is required.',replacedPanelMember:'Dr Previous Member',replacedAppointmentStatus:pending?'ACTIVE':'ENDED'}}/>);
    check(container.textContent?.includes(pending?'Panel member being replaced':'Previous Panel member'),'Wrong member label');check(container.textContent?.includes('continues until this replacement is approved')===pending,'Wrong continuation message');check(container.textContent?.includes(record.recommendedMember),'Proposed member missing');geometry();}
});
await scenario('Terminal reasons remain visible without duplicate audit history',async()=>{
  for(const cancelled of [false,true]){const row={...record,status:cancelled?'CANCELLED_BY_SUPERVISOR' as const:'REJECTED_BY_COORDINATOR' as const,rejectionReason:cancelled?undefined:'The proposed member cannot meet the evaluation schedule.',cancellationReason:cancelled?'The nomination was withdrawn after discussion.':undefined};await mount(<PanelRecommendationDetail record={row}/>);
    const aside=container.querySelector('[data-panel-review]')!;check(aside.textContent?.includes(row.rejectionReason||row.cancellationReason!),'Decision explanation missing');check(!aside.textContent?.includes('Audit history'),'Request repeats the approval trail');check(!aside.querySelector('button'),'Terminal controls invented');geometry();}
});
await scenario('Office host shares the presentation and existing student navigation',async()=>{
  let student='';const office={id:record.studentId,studentName:record.studentName,programme:record.programme,semester:record.semester,supervisor:record.supervisorName,panelMember:record.recommendedMember,status:'Recommendation',recommendation:record} as PanelRecord;
  await mount(<PanelAppointmentDetail record={office} onBack={()=>{}} onOpenStudent={id=>student=id}/>);check(container.querySelector('[data-panel-review]'),'Office missing shared presentation');check(!button('Approve request')&&!button('Accept request'),'Office gained review authority');await click('View student record');check(student===record.studentId,'Office student navigation changed');geometry();
});
await scenario('Supervisor cancellation remains reasoned and keeps its exact recommendation',async()=>{
  let cancelled='';const submitted={id:'71',recommendationId:71,studentId:record.studentId,studentName:record.studentName,researchTitle:record.proposedTopic,recommendedPanel:record.recommendedMember,date:'20 Oct 2026',status:'Pending Approval',semester:record.semester,recommendation:record} as SubmittedRecommendation;
  window.fetch=async()=>Response.json(record);
  await mount(<RecommendationDetailsDrawer isOpen recommendation={submitted} onClose={()=>{}} onCancelRecommendation={(row,reason)=>{cancelled=`${row.recommendationId}:${reason}`;}}/>);
  await click('Cancel recommendation');await until(()=>!!document.querySelector('dialog[open]'));const dialog=document.querySelector('dialog[open]')!;check(button('Cancel recommendation',dialog)?.disabled,'Cancellation lacks reason guard');await value(dialog.querySelector('textarea')!,' Nomination no longer needed. ');await click('Cancel recommendation',dialog);check(cancelled==='71:Nomination no longer needed.','Cancellation target changed');
});
await scenario('Legacy, missing and long content remain honest and wrap fully',async()=>{
  await mount(<PanelRecommendationDetail record={{...record,status:'NOT_SUBMITTED',justification:undefined,workflow:[]}}/>);check(!container.querySelector('[data-panel-review]'),'Empty review card');geometry();
  const long={...record,status:'APPROVED' as const,studentName:'LongStudentName'.repeat(30),recommendedMember:'LongPanelMember'.repeat(20),proposedTopic:'ResearchTerm'.repeat(80),justification:'NominationReason'.repeat(80),abstract:'AbstractTerm'.repeat(150)+'\n\nComplete final paragraph.',workflow:[]};await mount(<PanelRecommendationDetail record={long}/>);check(container.textContent?.includes(long.abstract),'Abstract clipped');check(container.textContent?.includes('Detailed approval history is unavailable'),'Invented legacy history');check(!container.querySelector('[data-panel-review] details'),'Empty audit');geometry();
});

await scenario('Office and Coordinator keep approved appointment records below review in the same sidebar',async()=>{
  const appointed={...record,status:'APPROVED' as const,appointmentLifecycle:{appointmentId:992,status:'ACTIVE' as const,endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null},appointmentDate:'2026-10-20'};
  for(const role of ['Office','Coordinator']){
    const office={recordId:'appointment-992',updatedDate:'20 Oct 2026',id:record.studentId,studentName:record.studentName,programme:record.programme,semester:record.semester,supervisor:record.supervisorName,panelMember:record.recommendedMember,status:'Approved',recommendation:appointed,appointmentLifecycle:appointed.appointmentLifecycle} as PanelRecord;
    await mount(role==='Office'?<PanelAppointmentDetail record={office} onBack={()=>{}}/>:<PanelRecommendationReviewDrawer isOpen routed recommendation={appointed} reviewerRole="PROGRAMME_COORDINATOR" onClose={()=>{}}/>);
    const aside=container.querySelector<HTMLElement>('[data-panel-review]')!,card=aside?.querySelector<HTMLElement>('[data-panel-appointment-record]');check(card,`${role}: detached appointment record`);
    const first=aside.firstElementChild!.getBoundingClientRect(),box=card!.getBoundingClientRect();
    check(Math.abs(box.width-aside.getBoundingClientRect().width)<2,'Appointment and review widths differ');check(box.top-first.bottom>=27,'Appointment card crowds review');
    if(innerWidth>=1280)check(box.width<=321,'Appointment spans content width');
    check(!card!.textContent?.includes('Aina Sofea Rahman'),'Compact record repeats student summary');geometry();
  }
});
await mount(<PanelRecommendationReviewDrawer isOpen routed recommendation={{...record,status:"APPROVED",appointmentLifecycle:{appointmentId:992,status:"ACTIVE",endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null},appointmentDate:"2026-10-20"}} reviewerRole="PROGRAMME_COORDINATOR" onClose={()=>{}} onOpenStudent={()=>{}}/>);
parent.postMessage({type:'panel-request-results',width:innerWidth,results},location.origin);
