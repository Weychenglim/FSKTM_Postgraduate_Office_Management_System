import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {CoSupervisorNominationForm,SupervisoryTeamRouteContent} from '../src/components/SupervisoryTeamManagement';
import {SupervisorAppointmentRecordCard} from '../src/components/SupervisorAppointmentRecordCard';
import type {SupervisoryWorkspace,SupervisoryTeam,CoSupervisorAppointment,CoSupervisorNomination} from '../src/types/coSupervision';
import type {SupervisorApplicationRecord} from '../src/types';
import type {UserRole} from '../src/types/auth';

const supporting:CoSupervisorAppointment={id:2,studentId:7,matricNo:'PREVIEW-007',studentName:'Example postgraduate',supervisor:{id:10,name:'Dr Supporting',email:'supporting@example.test',department:'Supporting research department'},status:'ACTIVE',appointmentDate:'2026-10-02',endOutcome:'',endReason:'',endedAt:null,supersedesId:null,canEnd:false,history:[]};
const ended:CoSupervisorAppointment={...supporting,id:3,status:'ENDED',endOutcome:'WITHDRAWN',endReason:'Private recorded reason',endedAt:'2026-10-01',supervisor:{id:11,name:'Dr Previous'}};
const nomination:CoSupervisorNomination={id:4,studentId:7,studentName:'Example postgraduate',matricNo:'PREVIEW-007',candidate:{id:12,name:'Private proposed candidate'},nominator:{id:9,name:'Dr Primary'},status:'PENDING_COORDINATOR',justification:'Private saved justification',reason:'',submittedAt:'2026-10-01T01:00:00Z',replacesAppointmentId:null,allowedActions:[],history:[]};
const team:SupervisoryTeam={studentId:7,matricNo:'PREVIEW-007',studentName:'Example postgraduate',studentEmail:'student@example.test',programme:'Computing',studentStatus:'Active',primarySupervisor:{id:9,name:'Dr Primary'},primaryAppointmentId:1,primaryAppointmentDetails:{email:'primary@example.test',department:'Primary research department',appointmentDate:'2026-10-01',semester:'Semester I'},approvedApplicationId:1,canChangePrimarySupervisor:false,research:{title:'Explainable recommendations for postgraduate academic support',area:'Explainable AI',abstract:'First saved paragraph.\n\nA complete second paragraph explaining the recorded research scope.'},appointments:[supporting,ended],nominations:[nomination],canNominate:false,timeline:[{id:'primary-1',title:'Supervisor application approved',date:'2026-10-01',status:'APPROVED'},{id:'timeline-1',title:'Semester milestone',date:'2026-11-01',status:'UPCOMING'}],panel:{current:{member:{id:13,name:'Dr Current Panel'},email:'panel@example.test',department:'Computing',appointmentDate:'2026-10-01',requestId:5,recordKey:'panel-5',canView:true},pending:null,canRecommend:false,canReplace:false}};
const primary:SupervisorApplicationRecord={id:1,studentId:'PREVIEW-007',studentName:'Example postgraduate',programme:'Computing',semester:'Semester I 2026/2027',proposedSupervisor:'Dr Primary',proposedSupervisorId:'L9',researchTitle:team.research.title,researchArea:team.research.area,researchAbstract:team.research.abstract,researchProfileReady:true,status:'APPROVED',rejectionReason:'',submittedAt:'2026-10-01T01:00:00Z',coordinatorDecisionAt:'2026-10-01T02:00:00Z',workflow:[],appointmentLifecycle:{appointmentId:1,status:'ACTIVE',endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null,lifecycle:[]}};
const root=createRoot(document.getElementById('root')!);
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const text=()=>document.getElementById('root')!.textContent||'';
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(node=>(node.getAttribute('aria-label')||node.textContent?.trim())===label);
const details=(title:string)=>[...document.querySelectorAll<HTMLDetailsElement>('details')].find(node=>node.querySelector('summary')?.textContent?.trim()===title);
let calls:string[]=[];
window.fetch=async()=>{throw Error('Pure layout checks must not call any live API');};

async function mount(role:UserRole,nextTeam=team,busy=false,withMarks=false){
  calls=[];
  const lecturer=role==='Lecturer',office=role==='Office Staff/Admin';
  const visible={...nextTeam,canNominate:lecturer,canChangePrimarySupervisor:office,panel:nextTeam.panel?{...nextTeam.panel,canReplace:lecturer}:undefined,appointments:nextTeam.appointments.map(row=>({...row,canEnd:lecturer&&row.status==='ACTIVE'}))};
  const workspace:SupervisoryWorkspace={teams:[visible],appointments:visible.appointments,nominations:visible.nominations,primaryApplication:primary};
  flushSync(()=>root.render(<SupervisoryTeamRouteContent key={`${role}:${visible.matricNo}`} workspace={workspace} role={role} view={role==='Student'?'studentOverview':'detail'} routeStudentId={visible.matricNo} busy={busy} search="" page={1} onSearch={()=>{}} onPage={()=>{}} studentActions={<button onClick={()=>calls.push('own-request')}>View request</button>}
    onNavigateToMarks={withMarks?target=>calls.push(`marks:${target?.studentId}:${target?.role}:${target?.taskId}`):undefined} onNavigateToApplication={id=>calls.push(`application:${id}`)} onNavigateToDossier={id=>calls.push(`student:${id}`)} onNavigateToPanelRequest={(id,key)=>calls.push(`panel:${id}:${key}`)} onNavigateToPanelRecommendation={id=>calls.push(`recommend:${id}`)} onChangePrimarySupervisor={id=>calls.push(`change:${id}`)} onEndPrimary={async()=>{}}
    onNominate={row=>calls.push(`nominate:${row.matricNo}`)} onEnd={row=>calls.push(`end:${row.id}`)} onReplace={(_,row)=>calls.push(`replace:${row.id}`)} onNominationAction={(row,action)=>calls.push(`nomination:${row.id}:${action}`)}/>));
  await tick();
}
function verifyActionButtons(){
  for(const group of document.querySelectorAll<HTMLElement>('[data-detail-actions]')){
    let previous:DOMRect|undefined;
    for(const node of group.querySelectorAll<HTMLButtonElement>('button')){
      if(!node.getClientRects().length)continue;
      const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
      check(Math.abs(rect.width-group.getBoundingClientRect().width)<2,'Sidebar action is not full width');
      check(rect.height>=44,'Sidebar action is too short');
      check(style.textTransform==='none'&&style.fontSize==='12px','Sidebar action uses toolbar typography');
      if(previous)check(rect.top>=previous.bottom+8,'Sidebar actions are crowded or side by side');
      previous=rect;
    }
  }
}
function geometry(){
  verifyActionButtons();
  const root=document.getElementById('root')!;
  check(root.scrollWidth<=root.clientWidth+1,'Page overflows horizontally');
  for(const dd of root.querySelectorAll('[aria-label="Student overview"] dd, [aria-label="Research profile"] dd, [aria-label="Panel member"] dd, [data-supervisor-appointment-record] dd')){
    if(!dd.getClientRects().length)continue;
    if(dd.querySelector('span[class*="uppercase"]'))continue;
    check(getComputedStyle(dd).fontWeight==='400',`A field answer is unexpectedly bold: ${dd.textContent} (${dd.className}, ${getComputedStyle(dd).fontWeight})`);
  }
  for(const h of root.querySelectorAll('h2')){
    const svg=h.parentElement?.querySelector(':scope > [aria-hidden="true"] svg');if(!svg)continue;
    const a=svg.parentElement!.getBoundingClientRect(),b=h.getBoundingClientRect();
    check(Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<=1,'Icon and title are misaligned');
  }
  const columns=root.querySelector<HTMLElement>('[data-supervision-columns]');
  if(columns?.querySelector('aside')){
    const a=columns.children[0].getBoundingClientRect(),b=columns.querySelector('aside')!.getBoundingClientRect();
    check(innerWidth>=1280?b.left>=a.right+24&&Math.abs(a.top-b.top)<=1:b.top>=a.bottom+24,'Appointment information is not arranged correctly');
  }
  const appointmentCard=root.querySelector('[data-supervisor-appointment-record]'),historyCard=root.querySelector('[data-appointment-history]');
  if(historyCard)check(!historyCard.closest('aside'),'Appointment history belongs below the workspace');
  check(!root.querySelector('[data-supervision-research] details'),'Current research is hidden behind a disclosure');
}
const results:{name:string,error?:string}[]=[];
async function scenario(name:string,fn:()=>Promise<void>){try{await fn();results.push({name});}catch(error){results.push({name,error:String(error)});}}

for(const role of ['Lecturer','Programme Coordinator','Office Staff/Admin'] as const)await scenario(`${role} gets separated surfaces and its own controls`,async()=>{
  await mount(role);geometry();
  for(const label of ['View approved application','View student record']){const action=button(label)!;check(action.classList.contains('bg-brand-navy')&&getComputedStyle(action).color==='rgb(255, 255, 255)'&&action.querySelector('svg'),'Overview navigation must use dark buttons with icons');}
  for(const expected of ['Supervisory team','Research profile','Appointment record','Appointment changes','First saved paragraph.','A complete second paragraph'])check(text().includes(expected),expected);
  check(!document.querySelector('[data-supervisor-appointment-record]')!.textContent!.includes('Example postgraduate'),'Student identity is repeated in appointment metadata');
  check(!document.querySelector('[data-supervisor-appointment-record]')!.textContent!.includes('Dr Primary'),'Primary supervisor is repeated in appointment metadata');
  check(!!button('Nominate co-supervisor')===(role==='Lecturer'),'Supporting nomination capability changed');
  check(!!button('Request supervisor change')===(role==='Office Staff/Admin'),'Primary change capability changed');
  button('View approved application')!.click();check(calls.includes('application:1'),'Approved application target changed');
  check(!!button('Replace Panel')===(role==='Lecturer'),'Panel recommendation capability changed');
  const panel=document.querySelector('[aria-label="Panel member"]')!;
  check(panel.querySelector('[data-panel-actions]')?.contains(button('View Panel details')!),'Panel actions must follow its contact details');
  if(role==='Lecturer'){
    const supporting=document.querySelector('[aria-label="Supporting supervisors"]')!;
    for(const value of ['primary@example.test','Primary research department','supporting@example.test','Supporting research department'])check(text().includes(value),'Missing supervisor contact: '+value);
    check(!getComputedStyle(supporting).borderTopWidth || getComputedStyle(supporting).borderTopWidth==='0px','Supporting supervisors should stay in the supervision group');
    check(supporting.querySelector('[data-supporting-heading-actions]')?.contains(button('Nominate co-supervisor')!),'Nomination must belong to the supporting heading');
    for(const label of ['Nominate co-supervisor','View Panel details','Replace Panel']){
      const action=button(label)!;check(action.getBoundingClientRect().height>=44,'Team action is too short');check(!!action.querySelector('svg'),'Team action needs an icon');check(getComputedStyle(action).textTransform==='none','Team action must use readable normal-case text');
    }
  }

  check(!!button('End supervisor appointment')===(role!=='Lecturer'),'Primary ending capability changed');
  button('View student record')!.click();button('View Panel details')!.click();
  check(calls.includes('student:PREVIEW-007')&&calls.includes('panel:5:panel-5'),'Navigation targets changed');
  const management=[...document.querySelectorAll<HTMLDetailsElement>('[data-supervisor-appointment-record] details')].find(node=>node.querySelector('summary')?.textContent?.trim()==='Manage appointment');
  check(!!management===(role!=='Lecturer'),'Management visibility does not match capability');
  if(management){check(!management.open,'Management should start collapsed');management.querySelector('summary')!.click();await tick();check(management.open,'Management cannot be expanded');geometry();}
  if(role==='Lecturer'){const record=document.querySelector('[data-supervisor-appointment-record]')!;check(record.querySelector('[data-detail-actions]')?.textContent?.includes('View approved application'),'Read-only appointment source link missing');check(!record.textContent?.includes('End supervisor appointment'),'Read-only source link gained management controls');}
  if(role==='Lecturer'){button('Nominate co-supervisor')!.click();button('Replace')!.click();button('Replace Panel')!.click();check(calls.includes('nominate:PREVIEW-007')&&calls.includes('replace:2')&&calls.includes('recommend:PREVIEW-007'),'Mutation-intent callbacks changed');}
});
await scenario('Student sees own current team and research without private staff details',async()=>{
  await mount('Student');geometry();
  for(const expected of ['My supervisors','Dr Primary','Dr Supporting','Previous supporting supervisors'])check(text().includes(expected),expected);
  for(const forbidden of ['Private proposed candidate','Private saved justification','Private recorded reason','Semester milestone','Appointment record','Dr Current Panel'])check(!text().includes(forbidden),`Private detail leaked: ${forbidden}`);
  button('View request')!.click();check(calls.includes('own-request'),'Own request navigation lost');
});
await scenario('Long names, addresses and research terms wrap at the actual viewport width',async()=>{
  await mount('Lecturer',{...team,studentName:'LongApplicantName'.repeat(18),studentEmail:'longemail'.repeat(18)+'@example.test',programme:'Programme '.repeat(20),primarySupervisor:{id:9,name:'LongSupervisorName'.repeat(18)},research:{...team.research,title:'LongResearchTerm'.repeat(30),abstract:'LongAbstractTerm'.repeat(80)}});geometry();
  check(text().includes('LongResearchTerm'.repeat(30)),'Research title was truncated');
});
await scenario('Pending supporting and Panel replacements retain current appointments and suppress duplicate actions',async()=>{
  await mount('Lecturer',{...team,nominations:[{...nomination,replacesAppointmentId:2}],panel:{...team.panel!,pending:{id:6,status:'PENDING_COORDINATOR',replacement:true,canView:true,recordKey:'request-6'}}});
  check(!button('Replace')&&!button('Replace Panel'),'Duplicate replacement action offered');
  check(text().includes('Dr Current Panel')&&text().includes('Replacement pending'),'Confirmed Panel or replacement state lost');
  button('View recommendation')!.click();check(calls.includes('panel:6:request-6'),'Pending recommendation target changed');geometry();
});
await scenario('Busy state disables navigation and all supplied mutation controls',async()=>{
  await mount('Lecturer',team,true);
  for(const label of ['View approved application','View student record','View Panel details','Nominate co-supervisor','Replace Panel','Replace'])check(button(label)?.matches(':disabled'),`Busy action active: ${label}`);
  await mount('Office Staff/Admin',team,true);check(button('End supervisor appointment')?.matches(':disabled')&&button('Request supervisor change')?.matches(':disabled'),`Office controls active during saving: ${[...document.querySelectorAll('button')].map(node=>node.textContent+':'+node.matches(':disabled')).join(', ')}`);
});
await scenario('Only real historical changes appear below the workspace; pending nominations stay beside the team',async()=>{
  await mount('Office Staff/Admin');
  const history=document.querySelector('[data-appointment-history]')!;check(history&& !history.closest('aside'),'History is still squeezed into the sidebar');
  check(!text().includes('Semester milestone')&&!text().includes('Semester dates')&&!text().includes('Appointment activity'),'Shared dates or summary activity remained');
  const node=details('Supporting appointment history (1)')!;check(node&&!node.open,'Missing or expanded past supporting history');node.querySelector('summary')!.click();await tick();check(text().includes('Private recorded reason'),'Recorded ending was lost');
  check(document.querySelector('[data-supervision-members]')?.textContent?.includes('Private proposed candidate'),'Pending nomination was hidden in history');geometry();
});
await scenario('Student without a saved profile or appointments gets honest empty content',async()=>{
  calls=[];flushSync(()=>root.render(<SupervisoryTeamRouteContent workspace={{teams:[],appointments:[],nominations:[]}} role="Student" view="studentOverview" busy={false} search="" page={1} onSearch={()=>{}} onPage={()=>{}} onNominate={()=>{}} onEnd={()=>{}} onReplace={()=>{}} onNominationAction={()=>{}}/>));await tick();
  check(text().includes('Supervisor not appointed')&&!text().includes('Research profile'),'Unassigned Student got an invented profile');geometry();
});
await scenario('Unavailable Panel and blank research remain explicit without fabricated actions',async()=>{
  await mount('Programme Coordinator',{...team,approvedApplicationId:null,panel:undefined,research:{title:'',area:'',abstract:''}});
  check(text().includes('Panel information unavailable.')&&text().includes('No current research profile is available.'),'Missing records are misrepresented');
  check(!button('View approved application')&&!button('View Panel details')&&!button('Recommend Panel'),'Unavailable capabilities granted actions');geometry();
});
await scenario('Historical appointment presentation keeps its identity and saved outcome',async()=>{
  flushSync(()=>root.render(<SupervisorAppointmentRecordCard record={{studentName:'Historical Student',studentId:'HISTORY-1',supervisor:'Historical Supervisor',status:'ENDED',approvedAt:'2026-09-01',endedAt:'2026-10-01',endReason:'Completed research',endOutcome:'COMPLETED',events:[]}}/>));await tick();
  for(const expected of ['Historical Student','Historical Supervisor','Completed research','Ended on'])check(text().includes(expected),expected);
  check(!button('End supervisor appointment'),'Ended historical record gained controls');
});
await scenario('A current team with no appointment metadata or activity has no empty sidebar',async()=>{
  await mount('Programme Coordinator',{...team,primaryAppointmentId:99,timeline:[],nominations:[],appointments:[]});
  check(!document.querySelector('aside')&&!text().includes('Appointment record')&&!text().includes('Activity and dates'),'An empty management column was added');geometry();
});
await scenario('Co-supervisor form retains student context and readable fields',async()=>{
  window.fetch=async input=>String(input).includes('/candidates/')?Response.json([{id:8,name:'Dr Supporting',selectable:true,reason:'',capacityState:'AVAILABLE',activeLoad:1,limit:3}]):Response.json({teams:[{...team,canNominate:true}],appointments:[],nominations:[]});
  let cancelled=false;
  flushSync(()=>root.render(<CoSupervisorNominationForm team={{...team,canNominate:true}} replacement={null} busy={false} onSubmit={()=>{throw Error('Visual checks must not submit');}} onCancel={()=>{cancelled=true;}}/>));
  for(let i=0;i<100&&!document.querySelector('form select');i++)await tick();
  const form=document.querySelector<HTMLFormElement>('form[aria-label="Co-supervisor nomination"]')!;
  check(!!form,'Nomination form is missing');
  check(form.textContent?.includes(team.studentName)&&form.textContent.includes(team.matricNo),'Form lost the student context');
  check(getComputedStyle(form).backgroundColor==='rgb(255, 255, 255)','Form uses an alert background');
  check(form.querySelector('textarea')!.getBoundingClientRect().height>=140,'Justification is cramped');
  for(const label of form.querySelectorAll('label'))check(getComputedStyle(label).textTransform==='none','Field label is uppercase');
  for(const label of ['Cancel','Submit nomination'])check(button(label)!.getBoundingClientRect().height>=44,'Form action is too short');
  geometry();
  button('Cancel')!.click();check(cancelled,'Cancel callback did not run');
});
await scenario('Lecturer supervisee details open the assigned Supervisor task; staff never fetch personal tasks',async()=>{
  let reads=0;
  const task={id:811,studentId:team.matricNo,studentName:team.studentName,initials:'EP',researchTitle:team.research.title,semester:'S1',deadline:'',status:'NOT STARTED',evaluatorRole:'SUPERVISOR',canEdit:true,taskLifecycleStatus:'ACTIVE'};
  window.fetch=async input=>{reads++;return Response.json(String(input).endsWith('/my-submitted-evaluations/')?[]:[task,{...task,id:812,evaluatorRole:'PANEL'}]);};
  await mount('Lecturer',team,false,true);for(let i=0;i<100&&!button('Enter marks');i++)await tick();
  check(!!button('Enter marks'),'Supervisor shortcut missing');button('Enter marks')!.click();check(calls.includes(`marks:${team.matricNo}:SUPERVISOR:811`),'Wrong supervisee marking target');
  reads=0;await mount('Office Staff/Admin',team,false,true);await tick();check(reads===0&&!button('Enter marks'),'Office fetched Lecturer tasks or gained marking');
  window.fetch=async()=>{throw Error('Unexpected HTTP request');};
});
await mount('Lecturer');
parent.postMessage({type:'supervision-layout-results',width:innerWidth,results},location.origin);
