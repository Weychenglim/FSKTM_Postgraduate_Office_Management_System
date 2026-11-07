import {LecturerMarksEntry} from '../src/components/LecturerMarksEntry';
import {AppointmentMarkingAction} from '../src/components/AppointmentMarkingAction';
import {appointmentMarkingRoute} from '../src/utils/appointmentMarking';
import {createMemoryRouter,RouterProvider,MemoryRouter} from 'react-router';
import {PanelAppointmentManagement} from '../src/components/PanelAppointmentManagement';
import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {PanelAssignmentDetail} from '../src/components/PanelAssignmentDetail';
import {PanelAppointmentDetail} from '../src/components/PanelAppointmentDetail';
import {PanelRecommendationReviewDrawer} from '../src/components/LecturerPanelAppointments';
import {PanelSuperviseeDetails} from '../src/components/PanelSuperviseeRoster';
import type {PanelAssignment,PanelRecommendationDraft,PanelRecommendationSupervisee,PanelRecord,AppointmentLifecycle} from '../src/types';

const container=document.getElementById('root')!;
const results:{name:string;error:string|null}[]=[];
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const pause=()=>new Promise(r=>setTimeout(r,0));
const until=async(predicate:()=>unknown)=>{for(let i=0;i<160;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error(`Timed out: ${container.textContent}`);};
let root:Root|null=null;
const lifecycle:AppointmentLifecycle={appointmentId:9,status:'ACTIVE',endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null,lifecycle:[{id:1,action:'ACTIVATED',actorName:'Programme Coordinator',actorRole:'Programme Coordinator',previousStatus:'',newStatus:'ACTIVE',outcome:null,reason:null,createdAt:'2026-10-20T08:00:00Z'}]};
const recommendation:PanelRecommendationDraft={id:71,studentId:'DEMO-PG-071',studentName:'Aina Sofea Rahman (Demo)',programme:'Master of Data Science (Coursework)',semester:'Semester I 2026/2027',supervisorName:'Dr Nadia Hassan',supervisorEmail:'nadia@example.test',studentEmail:'aina@example.test',recommendedMember:'Dr Amir Hakim',recommendedMemberId:'DEMO-L071',panelMemberEmail:'amir@example.test',panelMemberDepartment:'Artificial Intelligence',proposedTopic:'Explainable early-warning models for postgraduate academic support',researchArea:'Explainable artificial intelligence and educational data mining',abstract:'This study investigates explainable machine-learning support for identifying postgraduate students who may benefit from early academic assistance. Synthetic records are used to compare an interpretable baseline and a tree-based model.\n\nTwo explanation layouts will be evaluated using scripted scenarios, focusing on comprehension and perceived usefulness. No real student records will be used.',status:'APPROVED',submittedAt:'2026-10-18T08:00:00Z',submittedDate:'18 Oct 2026',coordinatorDecisionAt:'2026-10-20T08:00:00Z',justification:'Dr Amir’s expertise in interpretable machine learning and educational analytics complements the project’s evaluation needs.',appointmentLifecycle:lifecycle,workflow:[{id:1,action:'SUBMIT',actorName:'Dr Nadia Hassan',actorRole:'Lecturer',previousStatus:'',newStatus:'SUBMITTED_TO_PANEL',reason:'',createdAt:'2026-10-18T08:00:00Z'}]};
const assignment:PanelAssignment={academicTeam:{primary:{name:"Dr Current Primary",email:"primary@example.test",department:"Computing",appointmentDate:"2026-10-01"},supporting:[{name:"Dr Supporting",email:"supporting@example.test",department:"Data Science",appointmentDate:"2026-10-02"}]},appointmentId:9,studentId:recommendation.studentId,studentName:recommendation.studentName,researchTitle:recommendation.proposedTopic,supervisor:'Dr Nadia Hassan',appointmentDate:'2026-10-20',status:'ACTIVE',recommendation,appointmentLifecycle:lifecycle};
const student:PanelRecommendationSupervisee={studentId:recommendation.studentId,studentName:recommendation.studentName,programme:recommendation.programme,semester:recommendation.semester!,proposedTopic:recommendation.proposedTopic,researchArea:recommendation.researchArea!,abstract:recommendation.abstract!,supervisorName:'Dr Nadia Hassan',supervisorId:'L001',supervisorAppointmentId:2,panelAppointmentId:9,currentPanelMember:'Dr Amir Hakim',currentPanelMemberId:'DEMO-L071',canRecommend:true};
const office=(row=recommendation):PanelRecord=>({recordId:'appointment-9',id:row.studentId,studentName:row.studentName,programme:row.programme,semester:row.semester!,supervisor:row.supervisorName!,panelMember:row.recommendedMember,status:row.appointmentLifecycle?.status==='ACTIVE'?'Approved':'Ended',updatedDate:'20 Oct 2026',recommendation:row,appointmentLifecycle:row.appointmentLifecycle});
const button=(text:string,scope:ParentNode=document)=>[...scope.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim().toLowerCase()===text.toLowerCase());
async function mount(element:React.ReactNode){root?.unmount();root=createRoot(container);root.render(React.isValidElement<{contextSearch?:string}>(element)&&element.type===LecturerMarksEntry?<MemoryRouter initialEntries={['/marks?'+(element.props.contextSearch??'').replace(/^\?/, '')]}>{element}</MemoryRouter>:element);await until(()=>!!container.textContent);await pause();}
async function click(text:string,scope:ParentNode=document){const b=button(text,scope);check(b,`Missing ${text}`);b!.click();await pause();}
async function setValue(element:HTMLTextAreaElement|HTMLSelectElement,text:string){const proto=element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,text);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await pause();}
function geometry(){
  check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow');
  const cols=container.querySelector('[data-panel-assignment-columns],[data-panel-supervisee-columns]')!;
  if(cols.children.length===2){const main=cols.children[0].getBoundingClientRect(),aside=cols.children[1].getBoundingClientRect();if(innerWidth>=1280)check(aside.left-main.right>=27&&Math.abs(aside.top-main.top)<2,'Desktop aside alignment');else if(cols.hasAttribute('data-panel-supervisee-columns'))check(main.top-aside.bottom>=27,'Mobile nomination-first spacing');else check(aside.top-main.bottom>=27,'Mobile spacing');}
  for(const dd of container.querySelectorAll('dl dd')){check(getComputedStyle(dd).fontWeight==='400','Bold answer');check(parseFloat(getComputedStyle(dd).fontSize)>=14,'Small answer');}
  for(const region of container.querySelectorAll<HTMLElement>('[role="region"]')){const r=region.getBoundingClientRect();check(r.left>=-1&&r.right<=innerWidth+1,'Card overflow');}
  for(const b of container.querySelectorAll<HTMLButtonElement>('[data-detail-actions] button'))check(b.getBoundingClientRect().height>=44,'Small lifecycle action');
}
async function scenario(name:string,run:()=>Promise<void>){try{await run();results.push({name,error:null});}catch(error){results.push({name,error:String(error)});}}
const markingTask={id:801,studentId:recommendation.studentId,studentName:recommendation.studentName,initials:'AS',researchTitle:recommendation.proposedTopic,semester:'S1',deadline:'',status:'DRAFT SAVED' as const,evaluatorRole:'PANEL' as const,canEdit:true,taskLifecycleStatus:'ACTIVE' as const,components:[]};
const defaultFetch:typeof fetch=async input=>{const path=String(input);if(path.endsWith('/marks/my-evaluation-tasks/'))return Response.json([markingTask]);if(path.endsWith('/marks/my-submitted-evaluations/'))return Response.json([]);throw Error('Unexpected HTTP request: '+path);};
window.fetch=defaultFetch;

await scenario('Lecturer assignment presents appointment surfaces and exact student/Marks navigation',async()=>{
  let opened='',marks=0,back=0;await mount(<PanelAssignmentDetail assignment={assignment} onBack={()=>back++} onOpenStudent={id=>opened=id} onOpenMarksEntry={()=>marks++}/>);
  check(container.querySelectorAll('[role="region"]').length===4,'Creation-only assignment needs no history surface');
  check(container.querySelectorAll('[data-panel-assignment-detail] h2')[1]?.textContent==='Academic team','Wrong appointment focus');
  for(const value of ['Dr Current Primary','primary@example.test','Dr Supporting','supporting@example.test','Panel member for this assignment','20 Oct 2026'])check(container.textContent?.includes(value),'Missing academic team detail: '+value);
  check(!container.textContent?.includes('Staff number')&&!container.textContent?.includes('DEMO-L071'),'Internal staff identifier in assignment overview');
  check(!button('Nominate co-supervisor')&&!button('Replace Panel'),'Panel reader gained management controls');
  check(!container.querySelector('[data-panel-request-columns]'),'Still using request layout');check(container.textContent?.split(recommendation.studentName).length===2,'Repeated student');
  await click('View student record');await until(()=>!!button('Continue marking'));await click('Continue marking');check(opened===recommendation.studentId&&marks===1,'Navigation changed');geometry();await click('Back to My Panel students');check(back===1,'Back callback changed');
});
await scenario('Lecturer exact assignment read retries safely and supplies academic-team contacts',async()=>{
  let reads=0;
  window.fetch=async input=>{
    check(String(input).endsWith('/appointments/panel/appointments/9/'),'Unexpected assignment endpoint');
    reads++;
    return reads===1?Response.json({detail:'Assignment temporarily unavailable'},{status:503}):Response.json(assignment);
  };
  await mount(<PanelAssignmentDetail assignment={{...assignment,academicTeam:undefined}} onBack={()=>{}}/>);
  await until(()=>!!button('Retry'));await click('Retry');
  await until(()=>container.textContent?.includes('primary@example.test'));
  check(reads===2,'Retry must repeat the exact read once');geometry();
  window.fetch=defaultFetch;
});
await scenario('Coordinator appointment presentation preserves read-only and lifecycle capabilities',async()=>{
  for(const ended of [false,true]){const row={...recommendation,status:'PENDING_COORDINATOR' as const,canReview:true,canEndAppointment:true,appointmentLifecycle:{...lifecycle,status:ended?'ENDED' as const:'ACTIVE' as const}};
    await mount(<PanelRecommendationReviewDrawer isOpen presentation="appointment" recommendation={row} reviewerRole="PROGRAMME_COORDINATOR" onClose={()=>{}}/>);
    check(!button('Approve request')&&!button('Reject request'),'Appointment became actionable request');check(!!button('End panel appointment')===!ended,'Lifecycle capability changed');geometry();}
});
await scenario('Office lifecycle confirmation keeps reason/outcome guards and exact appointment endpoint',async()=>{
  let saved='',refreshes=0;window.fetch=async(input,init)=>{const path=new URL(String(input),location.origin).pathname;check(path==='/api/appointments/panel/appointments/9/end/'&&init?.method==='POST','Wrong lifecycle endpoint');saved=String(init.body);return Response.json({...lifecycle,status:'ENDED'});};
  await mount(<PanelAppointmentDetail appointmentView record={office()} onBack={()=>{}} onLifecycleChanged={()=>{refreshes++;}}/>);
  const management=[...container.querySelectorAll<HTMLDetailsElement>('details')].find(node=>node.querySelector('summary')?.textContent?.trim()==='Manage appointment')!;check(management&&!management.open,'Management should start collapsed');management.querySelector('summary')!.click();await pause();await click('End panel appointment');await until(()=>!!document.querySelector('dialog[open]'));const dialog=document.querySelector('dialog[open]')!;check(button('End appointment',dialog)?.disabled,'Reason not required');check(dialog.textContent?.includes('retires unfinished official Marks tasks'),'Consequences hidden');
  const select=dialog.querySelector<HTMLSelectElement>('select')!;await setValue(select,'WITHDRAWN');await setValue(dialog.querySelector('textarea')!,' Student withdrew from the project. ');await click('End appointment',dialog);await until(()=>refreshes===1);
  check(saved===JSON.stringify({outcome:'WITHDRAWN',reason:'Student withdrew from the project.'}),'Payload changed');await until(()=>!document.querySelector('dialog[open]'));geometry();window.fetch=defaultFetch;
});
await scenario('Ended appointment retains exact dates/outcome/actor and omits ending controls',async()=>{
  const row={...recommendation,appointmentLifecycle:{...lifecycle,status:'ENDED' as const,endOutcome:'REPLACED' as const,endReason:'Specialist expertise requested.',endedAt:'2026-10-23T08:00:00Z',endedBy:'Office administrator'}};
  await mount(<PanelAppointmentDetail appointmentView record={office(row)} onBack={()=>{}}/>);
  const lifecycleCard=container.querySelector('[data-panel-appointment-record]')!;for(const text of ['23 Oct 2026','Replaced','Specialist expertise requested.','Office administrator'])check(lifecycleCard.textContent?.includes(text),text);
  check(!button('End panel appointment'),'Ended appointment can end again');check(!lifecycleCard.textContent?.includes(recommendation.studentName),'Repeated student');geometry();
});
await scenario('Approval evidence stays in the source request and creation-only appointments have no history card',async()=>{
  await mount(<PanelAssignmentDetail assignment={assignment} onBack={()=>{}}/>);
  check(!container.querySelector('[data-appointment-history]')&&!container.textContent?.includes('Approval history'),'Approval was repeated in the appointment workspace');
  await click('View approved application');check(container.textContent?.includes(recommendation.justification!)&&!!container.querySelector('[data-panel-request-columns]'),'Source request evidence missing');
  await click('Back to Panel assignment');geometry();
});
await scenario('Supervisor pending replacement is distinct from current member and opens exact nomination',async()=>{
  let opened='',nominated=0;const pending={...recommendation,id:72,status:'PENDING_COORDINATOR' as const,recommendedMember:'Dr Proposed Replacement'};
  await mount(<PanelSuperviseeDetails student={{...student,canRecommend:false}} pendingRequest={pending} onRecommend={()=>nominated++} onOpenRequest={row=>opened=String(row.id)}/>);
  check(container.querySelector('[aria-label="Panel nomination"]')?.textContent?.includes('Dr Proposed Replacement'),'Pending member missing');check(container.textContent?.includes('Dr Amir Hakim')&&container.textContent.includes('remains appointed until final approval'),'Current member replaced prematurely');
  check(!button('Request replacement')&&!button('Nominate panel member'),'Duplicate nomination allowed');await click('View pending request');check(opened==='72'&&nominated===0,'Wrong request');geometry();
});
await scenario('Supervisor unappointed and missing member states retain nomination capabilities',async()=>{
  for(const appointed of [false,true]){let nominated=0;await mount(<PanelSuperviseeDetails student={{...student,panelAppointmentId:appointed?9:null,currentPanelMember:null,currentPanelMemberId:null}} onRecommend={()=>nominated++} onOpenRequest={()=>{}}/>);
    check(container.textContent?.includes(appointed?'Not recorded':'Not appointed'),'Invented member');check(container.querySelector('[aria-label="Panel nomination"]')?.textContent?.includes(appointed?'Request replacement':'Nominate panel member'),'Nomination action missing from sidebar');await click(appointed?'Request replacement':'Nominate panel member');check(nominated===1,'Nomination callback missing');check(container.textContent?.includes(recommendation.abstract!),'Research omitted');geometry();}
});
await scenario('Office attention overview links exact current appointment or pending request',async()=>{
  let opened=0,request='';await mount(<PanelAppointmentDetail overview record={office()} onBack={()=>{}} onViewAppointment={id=>opened=id}/>);await click('View appointment');check(opened===9&&!button('End panel appointment'),'Overview gained ending authority');check(!container.textContent?.includes('No ongoing request'),'Active-only payload claimed there are no requests');geometry();
  const pending={...recommendation,id:72,status:'PENDING_COORDINATOR' as const,appointmentLifecycle:null,recommendedMember:'Dr Proposed Replacement'};await mount(<PanelAppointmentDetail overview record={office(pending)} onBack={()=>{}} onViewRequest={id=>request=id}/>);
  check(container.textContent?.includes('No active Panel appointment'),'Nomination became current');await click('View request');check(request==='72'&&!button('View appointment'),'Wrong pending request target');geometry();
});
await scenario('Long current research and historical reasons wrap fully',async()=>{
  const row={...recommendation,studentName:'LongStudent'.repeat(35),recommendedMember:'LongPanelMember'.repeat(30),proposedTopic:'ResearchTerm'.repeat(80),abstract:'LongAbstract'.repeat(200)+'\n\nComplete final paragraph.',appointmentLifecycle:{...lifecycle,status:'ENDED' as const,endReason:'RecordedReason'.repeat(100),endedAt:'2026-10-23'}};
  await mount(<PanelAssignmentDetail assignment={{...assignment,recommendation:row}} onBack={()=>{}}/>);check(container.textContent?.includes(row.abstract),'Abstract truncated');geometry();
});
await scenario('Missing lifecycle and unchanged recommendation presentation remain honest',async()=>{
  await mount(<PanelAssignmentDetail assignment={{...assignment,recommendation:{...recommendation,appointmentLifecycle:null}}} onBack={()=>{}} onOpenMarksEntry={()=>{}}/>);check(container.textContent?.includes('No appointment lifecycle record is available.')&&!button('Open Marks Entry'),'Missing lifecycle gained control');await click('View approved application');check(container.textContent?.includes(recommendation.justification!),'Source evidence lost');await click('Back to Panel assignment');geometry();
  await mount(<PanelAppointmentDetail record={office()} onBack={()=>{}}/>);check(container.querySelector('[data-panel-request-columns]')&&!container.querySelector('[data-panel-assignment-columns]'),'Recommendation route changed');
});

await scenario('Actual Office request history opens an approved nomination rather than its appointment',async()=>{
  let opened='';
  window.fetch=async input=>{check(String(input).endsWith('/appointments/panel/'),'Unexpected request list endpoint');return Response.json([office()]);};
  const router=createMemoryRouter([{path:'*',element:<PanelAppointmentManagement onNavigateToRecord={id=>opened=id}/>}],{initialEntries:['/panel-appointments?panelSection=requests']});
  await mount(<RouterProvider router={router}/>);await until(()=>!!button('History'));
  await click('History');await until(()=>!!button('View request'));await click('View request');check(opened==='recommendation-71','Approved request jumped to an appointment');
  root?.unmount();root=null;router.dispose();window.fetch=async()=>{throw Error('Unexpected read');};
});
await scenario('Lecturer and Coordinator can trace the approved source without gaining decisions',async()=>{
  await mount(<PanelAssignmentDetail assignment={assignment} onBack={()=>{}}/>);await click('View approved application');
  check(!!container.querySelector('[data-panel-request-columns]')&&!button('Approve request')&&!button('Accept request'),'Source request gained decisions');await click('Back to Panel assignment');check(!!container.querySelector('[data-panel-assignment-columns]'),'Source back lost appointment');
  await mount(<PanelRecommendationReviewDrawer isOpen presentation="appointment" recommendation={recommendation} reviewerRole="PROGRAMME_COORDINATOR" onClose={()=>{}}/>);await click('View approved application');
  check(!!container.querySelector('[data-panel-request-columns]')&&!button('Approve request'),'Coordinator source gained review controls');await click('Back to Panel appointment');check(!!container.querySelector('[data-panel-assignment-columns]'),'Coordinator source back lost appointment');geometry();
});

await scenario('Marking shortcuts match the exact student, role and task state',async()=>{
  const supervisor={...markingTask,id:802,evaluatorRole:'SUPERVISOR' as const,status:'NOT STARTED' as const};
  window.fetch=async input=>String(input).endsWith('/my-submitted-evaluations/')?Response.json([]):Response.json([markingTask,supervisor,{...markingTask,id:803,studentId:'OTHER'}]);
  let destination='';await mount(<AppointmentMarkingAction studentId={markingTask.studentId} role="SUPERVISOR" onOpen={target=>destination=appointmentMarkingRoute(target)}/>);
  await until(()=>!!button('Enter marks'));await click('Enter marks');check(destination.includes('role=SUPERVISOR')&&destination.includes('task=802'),'Wrong Supervisor task');
  await mount(<div>Marking context<AppointmentMarkingAction studentId="NO-TASK" role="PANEL" onOpen={()=>{throw Error('Invented marking task');}}/></div>);await pause();check(!container.querySelector('button'),'Student without a task got a shortcut');
  window.fetch=async input=>String(input).endsWith('/my-submitted-evaluations/')?Response.json([]):Response.json([{...markingTask,canEdit:false}]);
  await mount(<AppointmentMarkingAction studentId={markingTask.studentId} role="PANEL" onOpen={()=>{}}/>);await until(()=>!!button('View marking task'));check(!button('Continue marking'),'Closed task offered editing');window.fetch=defaultFetch;
});
await scenario('Marks destination opens only the exact role/student task and retains access to all tasks',async()=>{
  const submitted={...markingTask,id:804,evaluatorRole:'SUPERVISOR' as const,status:'SUBMITTED' as const,canEdit:false,totalMark:'80',submittedDate:'20 Oct 2026'};
  window.fetch=async input=>String(input).endsWith('/my-submitted-evaluations/')?Response.json([submitted]):Response.json([markingTask,{...markingTask,id:805,studentId:'OTHER'}]);
  await mount(<LecturerMarksEntry contextSearch={`?student=${encodeURIComponent(markingTask.studentId)}&role=SUPERVISOR&task=804`}/>);
  await until(()=>container.textContent?.includes('Submitted Mark Detail'));check(!container.textContent?.includes('The selected marking task is no longer available.'),'Submitted target lost');
  await click('Back to Marks Entry');check(!container.querySelector('[aria-label="Supervisee marking tasks"]')?.textContent?.includes('OTHER'),'Different student leaked into exact list');
  await click('Show all tasks');await until(()=>!container.textContent?.includes('Marking tasks for '));window.fetch=defaultFetch;
});
await scenario('Multiple evaluations open a filtered list rather than selecting an arbitrary period',async()=>{
  window.fetch=async input=>String(input).endsWith('/my-submitted-evaluations/')?Response.json([]):Response.json([markingTask,{...markingTask,id:806}]);
  let target='';await mount(<AppointmentMarkingAction studentId={markingTask.studentId} role="PANEL" onOpen={value=>target=appointmentMarkingRoute(value)}/>);await until(()=>!!button('View marking tasks'));await click('View marking tasks');check(!target.includes('task='),'Multiple periods selected one task');
  await mount(<LecturerMarksEntry contextSearch={target.split('?')[1]}/>);await until(()=>!!container.querySelector('[aria-label="Panel marking tasks"]'));check(!container.textContent?.includes('Submitted Mark Detail'),'Multiple tasks opened a form');window.fetch=defaultFetch;
});

await mount(<PanelAssignmentDetail assignment={assignment} onBack={()=>{}} onOpenMarksEntry={()=>{}} onOpenStudent={()=>{}}/>);
parent.postMessage({type:'panel-assignment-detail-results',width:innerWidth,results},location.origin);
