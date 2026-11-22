import React from 'react';
import {createRoot} from 'react-dom/client';
import {createMemoryRouter, RouterProvider, useLocation, useNavigate} from 'react-router';
import {StudentSupervisorApplications} from '../src/components/StudentSupervisorApplications';
import {LecturerAppointmentRequests} from '../src/components/LecturerAppointmentRequests';
import {PanelSuperviseeRoster} from '../src/components/PanelSuperviseeRoster';
import {ListState} from '../src/components/ListState';
import {RecordPageProvider} from '../src/components/RecordPage';
import {PanelAppointmentManagement} from '../src/components/PanelAppointmentManagement';
import {LecturerPanelAppointments} from '../src/components/LecturerPanelAppointments';
import {OfficeSupervisorWorkspace} from '../src/components/OfficeSupervisorWorkspace';
import {CoordinatorSupervisorWorkspace} from '../src/components/CoordinatorSupervisorWorkspace';
import type {PanelRecord, PanelRecommendationDraft} from '../src/types';
import {recordSourceLabel} from '../src/utils/recordNavigation';

const results: {name: string; error: string | null}[] = [];
const check = (value: unknown, message: string) => {if (!value) throw new Error(message);};
const until = async (predicate: () => unknown) => {
  for (let attempt=0; attempt<300; attempt++) {if (predicate()) return; await new Promise(resolve=>setTimeout(resolve,10));}
  throw new Error(`Timed out: ${document.getElementById('root')?.textContent?.slice(-700)}`);
};
const active: PanelRecommendationDraft = {id:1,studentId:'PG001',studentName:'Aisha',programme:'Cyber Security',semester:'S1',
  proposedTopic:'Research security',recommendedMember:'Dr Aisha Panel',recommendedMemberId:'L001',status:'APPROVED',submittedDate:'',
  supervisorName:'Dr Supervisor',appointmentDate:'2026-10-02',coordinatorDecisionAt:'2026-10-02T08:00:00Z',
  appointmentLifecycle:{appointmentId:11,status:'ACTIVE',endOutcome:null,endReason:null,endedAt:null,endedBy:null,supersedesAppointmentId:null,replacementAppointmentId:null}};
const second: PanelRecommendationDraft = {...active,id:2,studentId:'PG002',studentName:'Ben',appointmentLifecycle:{...active.appointmentLifecycle!,appointmentId:12}};
const past: PanelRecommendationDraft = {...active,id:3,studentName:'Former student',studentId:'PG003',appointmentLifecycle:{...active.appointmentLifecycle!,appointmentId:13,status:'ENDED',endOutcome:'REPLACED',endedAt:'2026-10-18T08:00:00Z'}};
const earlierPast: PanelRecommendationDraft = {...past,id:5,appointmentLifecycle:{...past.appointmentLifecycle!,appointmentId:14,endedAt:'2026-10-12T08:00:00Z',endReason:'Earlier historical appointment'}};
const pending: PanelRecommendationDraft = {...active,id:4,studentName:'Pending student',studentId:'PG004',status:'PENDING_COORDINATOR',appointmentLifecycle:null};
const rows = [active,second,past,earlierPast,pending,...Array.from({length:11},(_,index):PanelRecommendationDraft=>({...active,id:10+index,
  studentName:index===0?'=Formula-like student':`Student ${index}`,studentId:`PG${100+index}`,programme:'Data Science',
  recommendedMember:`Dr Lecturer ${String(index).padStart(2,'0')}`,recommendedMemberId:`L${100+index}`,
  appointmentLifecycle:{...active.appointmentLifecycle!,appointmentId:100+index}}))];
const officeRecord = (row: PanelRecommendationDraft): PanelRecord => ({recordId:`appointment-${row.appointmentLifecycle?.appointmentId??row.id}`,
  id:row.studentId,studentName:row.studentName,programme:row.programme,semester:row.semester||'',supervisor:'Dr Supervisor',
  panelMember:row.recommendedMember,status:row.status==='APPROVED'?'Approved':'Pending',updatedDate:'',recommendation:row,
  appointmentLifecycle:row.appointmentLifecycle});
let root = createRoot(document.getElementById('root')!);
let router: ReturnType<typeof createMemoryRouter>;
let failedRead = false;
let activeModule: 'panel' | 'supervisor' = 'panel';
let openedSupervision = '';
const calls: string[] = [];
const requestQueries: URLSearchParams[] = [];
window.fetch = async (input,init) => {
  check(!init?.method||init.method==='GET','No academic mutations are permitted');
  const url=new URL(String(input),location.origin),path=url.pathname; calls.push(path);
  if(failedRead)return Response.json({error:'Fixture unavailable'},{status:500});
  if(path==='/api/appointments/panel/my-workload/') return Response.json({workloadCount:1,workloadLimit:3,currentStudents:1,confirmedAppointments:1,pendingNominations:0,capacityState:'AVAILABLE',selectable:true,records:[]});
  if(path==='/api/appointments/panel/eligible-supervisees/') return Response.json([{
    studentId:'PG001',studentName:'Aisha',programme:'Cyber Security',semester:'S1',proposedTopic:'Research security',researchArea:'Security',abstract:'Research abstract',
    supervisorName:'Dr Supervisor',supervisorId:'SUP001',supervisorAppointmentId:1,panelAppointmentId:11,currentPanelMember:'Dr Aisha Panel',currentPanelMemberId:'L001',canRecommend:true,currentPanelDepartment:'Computing',currentPanelEmail:'panel@example.test',currentPanelAppointmentDate:'2026-10-02',
  }]);
  if(path==='/api/appointments/panel/recommendations/') return Response.json([pending,past,{...active,id:21}]);
  if(path==='/api/appointments/panel/recommendations/21/') return Response.json({...active,id:21});
  if(path==='/api/appointments/panel/recommendations/3/') return Response.json(past);
  if(path.startsWith('/api/appointments/panel/') && path!=='/api/appointments/panel/' && !path.endsWith('/coordinator-workspace/') && !path.includes('/records/')) return Response.json([]);
  if(path==='/api/appointments/supervisor/request-history/') return Response.json([]);
  if(path==='/api/appointments/co-supervisor/') return Response.json({teams:[],nominations:[],appointments:[]});
  if (/\/appointments\/(office|coordinator)-workspace\/requests\/$/.test(path)) {
    requestQueries.push(url.searchParams);
    const history=url.searchParams.get('view')==='history';
    const results=[{key:'primary-1',id:1,kind:'primary',studentName:'Request Student',matricNo:'PG001',programme:'Cyber Security',candidateName:'Dr Supervisor',status:history?'APPROVED':'PENDING_COORDINATOR',submittedAt:'2026-10-10T00:00:00Z',decidedAt:history?'2026-10-12T00:00:00Z':null,waitingDays:3,canDecide:!history&&path.includes('coordinator'),carryover:false}];
    return Response.json({results,total:1,page:1,pageSize:10,pageCount:1,reviewCount:0,facets:{programmes:['Cyber Security'],semesters:['S1'],statuses:[history?'APPROVED':'PENDING_COORDINATOR']}});
  }
  if (/\/appointments\/(office|coordinator)-workspace\/(teams|appointments)\/$/.test(path)) {
    const history=path.endsWith('/appointments/'),students=url.searchParams.get('view')==='students';
    const results=history?[{key:'primary-9',id:9,kind:'primary',studentName:'Former supervisee',matricNo:'PG009',programme:'Cyber Security',supervisorName:'Dr Supervisor',appointmentDate:'2025-10-01',endedAt:'2026-10-12',outcome:'REPLACED',applicationId:9,studentId:9}]
      :students?[{id:2,matricNo:'PG002',studentName:'Ben',programme:'Cyber Security',primarySupervisor:{id:7,name:'Dr Supervisor'},relationship:'Primary supervisor'}]
      :[{id:7,name:'Dr Supervisor',staffNo:'SUP007',primaryCount:2,supportingCount:1}];
    return Response.json({results,total:results.length,page:1,pageSize:10,pageCount:1,reviewCount:0,facets:{programmes:['Cyber Security'],semesters:['S1'],statuses:history?['REPLACED']:[]}});
  }
  if(path==='/api/appointments/panel/coordinator-workspace/') return Response.json({programme:'Cyber Security',programmes:['Cyber Security'],queue:[],pendingCount:0,records:rows.filter(row=>row.programme==='Cyber Security')});
  if(path==='/api/appointments/panel/')return Response.json(rows.map(officeRecord));
  const appointment=path.match(/\/panel\/records\/appointment-(\d+)\//);
  if(appointment)return Response.json(officeRecord(rows.find(row=>row.appointmentLifecycle?.appointmentId===Number(appointment[1]))!));
  throw new Error(`Unexpected API call: ${path}`);
};
function Host({role}: {role:'office'|'coordinator'}) {
  const current=useLocation(), navigate=useNavigate();
  if(current.pathname==='/personal-student') return <StudentSupervisorApplications applications={[]}/>;
  if(current.pathname==='/personal-lecturer') return <LecturerAppointmentRequests primaryRequests={[]} primaryLoading={false} primaryError={null} refreshVersion={0} onChanged={async()=>{}} workload={{currentStudents:1,workloadLimit:3,availableSlots:2,selectable:true,capacityState:'AVAILABLE'}}/>;
  if(current.pathname==='/personal-panel') return <LecturerPanelAppointments currentUser={{id:'L1',staffId:'L1',role:'Lecturer',fullName:'Lecturer',email:'lecturer@example.test',department:'Computing'}} routeView={current.search.includes('view=history')?'reviewed':'list'} onNavigateToReviewed={()=>navigate('/personal-panel?view=history')} onNavigateToList={()=>navigate('/personal-panel?view=requests')}/>;
  if(current.pathname==='/personal-roster') return <PanelSuperviseeRoster students={[]} recommendations={[]} onOpen={()=>{}}/>;
  const supervisorView=current.pathname.endsWith('/requests')?'requests':'teams';
  if(activeModule==='supervisor')return role==='office'
    ? <OfficeSupervisorWorkspace routeView={supervisorView==='requests'?'list':'teams'} requestsView={supervisorView==='requests'} onNavigateToTeam={id=>{openedSupervision=id;}}/>
    : <CoordinatorSupervisorWorkspace workspaceView={supervisorView} onNavigateToTeam={id=>{openedSupervision=id;}}/>;
  if(role==='coordinator')return <LecturerPanelAppointments currentUser={{id:'C1',role:'Programme Coordinator',fullName:'Coordinator',email:'coordinator@example.test',department:'Computing'}}/>;
  const record=current.pathname.match(/\/records\/(.+)$/)?.[1];
  return <PanelAppointmentManagement routeView={record?'detail':'list'} routeRecordId={record}
    onOpenCapacity={()=>{throw new Error('Capacity configuration belongs to Dashboard');}}
    detailBackLabel={`Back to ${current.state?.sourceLabel||'Panel assignments'}`}
    onNavigateToRecord={id=>navigate(`/panel-appointments/records/${id}${current.search}`,{state:{source:current.pathname+current.search,sourceLabel:recordSourceLabel(current.pathname,current.search)}})}
    onNavigateToList={()=>navigate(current.state?.source||'/panel-appointments?panelSection=appointments',{replace:true})}/>;
}
const visible = <T extends Element>(selector:string) => [...document.querySelectorAll<T>(selector)].filter(node=>!node.closest('[hidden]'));
const button = (label:string) => visible<HTMLButtonElement>('button').find(node=>node.textContent?.trim()===label)!;
const table = (label:string) => visible<HTMLTableElement>('table').find(node=>node.getAttribute('aria-label')===label);
const search = () => visible<HTMLInputElement>('input[type="search"]')[0];
async function selectAppointments(label: 'Current assignments' | 'Past assignments') {
  const text=label==='Past assignments'?'Past':'Current';
  const control=visible<HTMLButtonElement>('[role="group"][aria-label="Appointment views"] button').find(node=>node.textContent?.trim()===text)!;
  check(!!control,'Missing appointment view switch');
  control.click();await until(()=>control.getAttribute('aria-pressed')==='true');
}
async function typeSearch(value:string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search(),value);
  search().dispatchEvent(new Event('input',{bubbles:true})); await new Promise(resolve=>setTimeout(resolve,30));
}
async function mount(role:'office'|'coordinator',entry='/panel-appointments?panelSection=appointments',module:'panel'|'supervisor'='panel') {
  root.unmount();router?.dispose();root=createRoot(document.getElementById('root')!); calls.length=0;requestQueries.length=0;failedRead=false;
  activeModule=module;openedSupervision='';
  const memory=new Map<string,unknown>([[`PanelAssignments:${role}:grouping`,'student'],[`PanelAssignments:${role}:to`,'2020-01-01']]);
  router=createMemoryRouter([{path:'*',element:<ListState.Provider value={memory}><RecordPageProvider><Host role={role}/></RecordPageProvider></ListState.Provider>}],{initialEntries:[entry]});
  root.render(<RouterProvider router={router}/>);
  await until(()=>!!table(module==='supervisor'?entry.endsWith('/requests')?'Appointment request records':'Supervisors and their students':'Panel lecturers and their students')||document.body.textContent?.includes('Panel lecturer unavailable'));
}
async function scenario(name:string,run:()=>Promise<void>) {
  try {await run();results.push({name,error:null});} catch(error) {results.push({name,error:error instanceof Error?error.message:String(error)});}
}
for(const role of ['office','coordinator'] as const) {
  await scenario(`${role}: lecturer counts and student search lead to the exact appointment and back`,async()=>{
    await mount(role);
    check(button('Panel assignments'),'Staff assignment tab missing');
    const filterCard=search().closest('.bg-slate-50')!;
    check(!filterCard.textContent?.includes('Status'),'Current assignments have a redundant status filter');
    check(filterCard.textContent?.includes('Sort by'),'Original sorting placement changed');
    check(!filterCard.querySelector('details'),'Filters must stay visible');
    check(filterCard.querySelectorAll('input[type="date"]').length===1,'Only the start cutoff should remain');
    check(!button('By lecturer')&&!button('By student'),'Redundant browsing-mode buttons returned');
    check(!visible('[role="group"][aria-label="Assignment period"]').length,'Obsolete Current/Past switch remains');
    check(visible('[role="group"][aria-label="Appointment views"]').length===1&&button('Current').getAttribute('aria-pressed')==='true','Expected one current/past switch');
    if(role==='office') {
      button('Tools').click();await until(()=>visible('[aria-label="Office Panel tools"]').length===1);
      const tools=visible('[aria-label="Office Panel tools"]')[0];
      check(tools.textContent?.includes('Workload monitoring')&&!tools.textContent?.includes('Manage capacity')&&!tools.textContent?.includes('Configuration'),'Panel tools should contain monitoring only');
      button('Tools').click();
    }
    const first=table('Panel lecturers and their students')!.querySelector('tbody tr')!;
    check(first.textContent?.includes('Dr Aisha Panel')&&first.querySelectorAll('td')[1].textContent?.endsWith('2'),'Pending request inflated active count');
    check(!table('Panel lecturers and their students')!.textContent?.includes('Pending student'),'Pending nomination became an assignment');
    await typeSearch('PG002'); check(table('Panel lecturers and their students')!.querySelectorAll('tbody tr').length===1,'Search did not filter groups');
    button('View students').click(); await until(()=>!!table('Panel student assignments'));
    check(search().value==='PG002','Search was not carried to lecturer students');
    check(table('Panel student assignments')!.textContent?.includes('Ben')&&!table('Panel student assignments')!.textContent?.includes('PG001'),'Wrong filtered students');
    button('View appointment').click(); await until(()=>visible('[data-panel-appointment-record]').length===1);
    check(visible('[data-panel-assignment-detail]')[0].textContent?.includes('Ben'),'Wrong appointment opened');
    check(visible('[data-record-page]').length===1,'Nested record hosts compete for the page');
    button('Back to Panel students').click(); await until(()=>!!table('Panel student assignments'));
    check(search().value==='PG002','Appointment return lost student filter');
    button('Back to Panel assignments').click();await until(()=>!!table('Panel lecturers and their students'));
    check(search().value==='PG002','Lecturer return lost list filter');
    check(!calls.some(path=>path.includes('workload')),'Assignment browsing fetched Office capacity data');
  });
  await scenario(`${role}: Current/Past filter retains lecturer-first browsing, reset and exact historical details`,async()=>{
    await mount(role);
    check(!table('Panel student assignments'),'Current students must be inside a selected lecturer');
    await selectAppointments('Past assignments');await until(()=>table('Panel lecturers and their students')?.querySelectorAll('tbody tr').length===1);
    button('Clear filters').click();await until(()=>button('Past').getAttribute('aria-pressed')==='true');
    check(table('Panel lecturers and their students')!.textContent?.includes('Past assignments'),'Clear filters lost the selected past-assignment view');
    await selectAppointments('Past assignments');await until(()=>table('Panel lecturers and their students')?.querySelectorAll('tbody tr').length===1);
    const cells=table('Panel lecturers and their students')!.querySelector('tbody tr')!.querySelectorAll('td');
    check(cells[1].textContent?.endsWith('1')&&cells[2].textContent?.endsWith('2'),'Past student and appointment counts became conflated');
    button('View students').click();await until(()=>!!table('Panel student assignments'));
    check(table('Panel student assignments')!.textContent?.includes('Former student'),'Past drilldown switched to current assignments');
    check(table('Panel student assignments')!.querySelectorAll('tbody tr').length===2,'Request history leaked into past assignments or a confirmed historical appointment was lost');
    check(table('Panel student assignments')!.textContent?.includes('18 Oct 2026'),'Ending date missing');
    const openHistorical=async(index:number,date:string)=>{
      visible<HTMLButtonElement>('button').filter(node=>node.textContent?.trim()==='View appointment')[index].click();
      await until(()=>visible('[data-panel-appointment-record]').length===1);
      check(visible('[data-panel-appointment-record]')[0].textContent?.includes(date),'Opened the wrong historical appointment for the same student');
      button('Back to Panel students').click();await until(()=>!!table('Panel student assignments'));
    };
    await openHistorical(0,'18 Oct 2026');await openHistorical(1,'12 Oct 2026');
  });
  await scenario(`${role}: request filters stay visible and sorting/history retain query semantics`,async()=>{
    await mount(role,'/supervisor-appointments/requests','supervisor');
    const filters=search().closest('.bg-slate-50')!;
    check(filters.textContent?.includes('Status')&&filters.textContent?.includes('Request type'),'Useful request choices lost');
    check(filters.querySelectorAll('input[type="date"]').length===1,'Visible dates lost');
    const sort=visible<HTMLButtonElement>('[role="combobox"]').find(node=>node.getAttribute('aria-label')==='Sort by')!;
    sort.click();await until(()=>visible('[role="option"]').some(node=>node.textContent?.trim()==='Newest first'));
    visible<HTMLElement>('[role="option"]').find(node=>node.textContent?.trim()==='Newest first')!.click();
    await until(()=>requestQueries.at(-1)?.get('sort')==='newest');
    check(requestQueries.at(-1)?.get('focus')===(role==='office'?'all':'decision'),'Role scope changed');
    const filterTop=search().getBoundingClientRect().top;
    button('History').click();await until(()=>search().closest('.bg-slate-50')?.textContent?.includes('Outcome on or after'));
    check(Math.abs(search().getBoundingClientRect().top-filterTop)<2,'History moved the shared request filters');
    check(document.documentElement.scrollWidth<=innerWidth,'Request filters exceed viewport');
  });
  await scenario(`${role}: Supervisor retains its switch, relationship counts and student drilldown`,async()=>{
    await mount(role,'/supervisor-appointments/supervisees','supervisor');
    check(button('Current').getAttribute('aria-pressed')==='true','Supervisor default current state changed');
    check(!button('By lecturer')&&!button('By student'),'Supervisor gained a redundant mode');
    const counts=table('Supervisors and their students')!.querySelector('tbody tr')!.querySelectorAll('td');
    check(counts[1].textContent?.endsWith('2')&&counts[2].textContent?.endsWith('1'),'Primary/supporting counts changed');
    button('Past').click();await until(()=>!!table('Past appointments'));
    check(button('Past').getAttribute('aria-pressed')==='true','Supervisor past switch did not update');
    check(!search().closest('.bg-slate-50')?.textContent?.includes('Status'),'Ended lifecycle is redundant');
    check(search().closest('.bg-slate-50')?.textContent?.includes('Ended on or after'),'Ending-date meaning lost');
    check(table('Past appointments')!.textContent?.includes('Former supervisee'),'Supervisor ended history disappeared');
    button('Current').click();await until(()=>!!table('Supervisors and their students'));
    await typeSearch('PG002');await until(()=>!!table('Supervisors and their students'));
    button('View students').click();await until(()=>!!table('Current supervisory teams'));
    check(!search().closest('.bg-slate-50')?.textContent?.includes('Sort by'),'Single-choice student sort remains');
    check(search().value==='PG002'&&table('Current supervisory teams')!.textContent?.includes('Ben'),'Supervisor search was not carried to students');
    button('View supervision').click();check(openedSupervision==='PG002','Supervisor row did not target the selected student');
    button('Back to Supervisory teams').click();await until(()=>!!table('Supervisors and their students'));
    check(search().value==='PG002','Supervisor return lost the list search');
  });
}
await scenario('Office pagination, Excel scope and literal strings cover all matching assignments',async()=>{
  await mount('office');
  check(table('Panel lecturers and their students')!.querySelectorAll('tbody tr').length===10,'Default pagination missing');
  button('Next').click();await until(()=>table('Panel lecturers and their students')!.querySelectorAll('tbody tr').length===2);
  let blob:Blob|undefined;
  const create=URL.createObjectURL, click=HTMLAnchorElement.prototype.click;
  URL.createObjectURL=value=>{blob=value as Blob;return create(value);};
  HTMLAnchorElement.prototype.click=function(){if(!this.download)click.call(this);};
  try {
    button('Export Excel').click();await until(()=>!!blob);
    const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob!.arrayBuffer());const sheet=workbook.worksheets[0];
    check(sheet.rowCount===14,'Export was limited to the visible page or included unconfirmed records');
    check(sheet.getColumn(1).values.includes('=Formula-like student'),'Formula-like text was not preserved literally');
    const formulaCell=[...sheet.getColumn(1).values].findIndex(value=>value==='=Formula-like student');
    check(sheet.getCell(formulaCell,1).type===ExcelJS.ValueType.String,'Untrusted text became a formula');
  } finally {URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}
});
await scenario('Coordinator scope, unavailable lecturer and browser return remain safe',async()=>{
  await mount('coordinator');check(table('Panel lecturers and their students')!.querySelectorAll('tbody tr').length===1,'Out-of-programme lecturer leaked');
  button('View students').click();await until(()=>!!table('Panel student assignments'));
  await router.navigate(-1);await until(()=>!!table('Panel lecturers and their students'));
  await mount('coordinator','/panel-appointments?panelSection=appointments&panelLecturer=staff:L999');
  check(!table('Panel student assignments'),'Unknown lecturer displayed other assignments');
});
await scenario('lecturer-only sorting becomes a valid student sort in the drilldown',async()=>{
  await mount('office');
  const sort=visible<HTMLButtonElement>('[role="combobox"]').find(node=>node.getAttribute('aria-label')==='Sort by')!;
  sort.click();await until(()=>!!visible('[role="option"]').find(node=>node.textContent?.includes('Most students')));
  (visible<HTMLElement>('[role="option"]').find(node=>node.textContent?.includes('Most students'))!).click();
  await until(()=>sort.textContent?.includes('Most students'));
  button('View students').click();await until(()=>!!table('Panel student assignments'));
  const studentSort=visible<HTMLButtonElement>('[role="combobox"]').find(node=>node.getAttribute('aria-label')==='Sort by')!;
  check(studentSort.textContent?.includes('Student name'),'Lecturer-only sort left the student sort control empty');
});
await scenario('programme and start-date controls filter the mounted lecturer view',async()=>{
  await mount('office');
  const programme=visible<HTMLButtonElement>('[role="combobox"]').find(node=>node.getAttribute('aria-label')==='Programme')!;
  programme.click();await until(()=>visible('[role="option"]').length>0);
  visible<HTMLElement>('[role="option"]').find(node=>node.textContent?.trim()==='Cyber Security')!.click();
  await until(()=>table('Panel lecturers and their students')?.querySelectorAll('tbody tr').length===1);
  const date=visible<HTMLInputElement>('input[type="date"]')[0];
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(date,'2026-10-03');
  date.dispatchEvent(new Event('input',{bubbles:true}));
  await until(()=>visible('[role="status"]').some(node=>node.textContent?.includes('No matching assignments')));
  check(!table('Panel lecturers and their students'),'Date filter did not clear the group');
  button('Clear filters').click();await until(()=>!!table('Panel lecturers and their students'));
  check(table('Panel lecturers and their students')!.querySelectorAll('tbody tr').length===10,'Clear filters did not restore the unfiltered page');
});
await scenario('failed reload shows an error and retry restores the assignments view',async()=>{
  await mount('office');failedRead=true;
  await router.navigate('/panel-appointments?panelSection=requests');await until(()=>!!button('Retry'));
  check(!table('Panel lecturers and their students'),'Failure retained a stale assignment table');
  failedRead=false;button('Retry').click();await until(()=>!!table('Appointment requests'));
});
for(const kind of ['student','lecturer','roster'] as const) {
  await scenario(`${kind}: shared card always clears all fields while preserving view and page size`,async()=>{
    root.unmount();router?.dispose();root=createRoot(document.getElementById('root')!);failedRead=false;
    router=createMemoryRouter([{path:'*',element:<ListState.Provider value={new Map()}><RecordPageProvider><Host role="office"/></RecordPageProvider></ListState.Provider>}],{initialEntries:[`/personal-${kind}?view=history&size=25&q=hidden&type=supporting&status=APPROVED&semester=S1&from=2026-01-01&to=2020-01-01&page=2&source=inbox`]});
    root.render(<RouterProvider router={router}/>);
    await until(()=>!!button('Clear filters'));
    check(!!document.querySelector('[data-workspace-filter-card]'),'Personal filters do not use the shared card');
    button('Clear filters').click();
    if(kind!=='roster') {
      await until(()=>!router.state.location.search.includes('q='));
      const query=new URLSearchParams(router.state.location.search);
      for(const field of ['q','type','status','semester','from','to','page']) check(!query.has(field),`Clear missed ${field}`);
      check(query.get('view')==='history'&&query.get('size')==='25'&&query.get('source')==='inbox','Clear changed browsing context');
    }
    check(button('Clear filters'),'Clear filters disappears on an unfiltered list');
    if(kind==='student'){
      const top=search().getBoundingClientRect().top;
      button('Requests').click();await until(()=>router.state.location.search.includes('view=requests'));
      check(Math.abs(search().getBoundingClientRect().top-top)<2,'Student requests/history moved the shared filters');
    }
    check(document.documentElement.scrollWidth<=innerWidth,'Personal filter exceeds viewport');
  });
}
for(const kind of ['lecturer','panel']) {
  await scenario(`${kind} requests/history preserve summary and filter positions`,async()=>{
    root.unmount();root=createRoot(document.getElementById('root')!);
    router=createMemoryRouter([{path:'*',element:<ListState.Provider value={new Map()}><RecordPageProvider><Host role="office"/></RecordPageProvider></ListState.Provider>}],{initialEntries:[`/personal-${kind}?view=requests`]});
    root.render(<RouterProvider router={router}/>);
    await until(()=>!!button('History')&&!!search()&&document.body.textContent?.includes(kind==='lecturer'?'Supervisory load':'Awaiting Coordinator'));
    const positions=()=>({history:button('History').getBoundingClientRect().top,search:search().getBoundingClientRect().top});
    const before=positions();
    button('History').click();await until(()=>router.state.location.search.includes('view=history'));
    await new Promise(resolve=>setTimeout(resolve,30));
    const after=positions();
    check(document.body.textContent?.includes(kind==='lecturer'?'Supervisory load':'Awaiting Coordinator'),'Summary disappeared on History');
    check(Math.abs(before.history-after.history)<2,'Tab switch moved vertically');
    check(Math.abs(before.search-after.search)<2,'Filters moved vertically');
    button('Requests').click();await until(()=>router.state.location.search.includes('view=requests'));
    check(document.documentElement.scrollWidth<=innerWidth,'Workspace exceeds viewport');
  });
}
await mount('office');
check(document.documentElement.scrollWidth<=innerWidth,'Assignment workspace exceeds viewport');
await scenario('supervisees: dedicated nomination records retain history, filters and exact return navigation',async()=>{
  root.unmount();router?.dispose();root=createRoot(document.getElementById('root')!);
  router=createMemoryRouter([{path:'*',element:<ListState.Provider value={new Map()}><RecordPageProvider><Host role="office"/></RecordPageProvider></ListState.Provider>}],{initialEntries:['/personal-panel?panelSection=supervisees']});
  root.render(<RouterProvider router={router}/>);
  await until(()=>!!table('Supervisees and their Panel members'));
  check(!button('Students')&&!button('My nominations')&&!button('History'),'Nested navigation remains');
  check(!document.body.textContent?.includes('Appointment guidance'),'Guidance competes with roster');
  await typeSearch('Aisha');
  button('Nomination records').click();await until(()=>visible('[data-record-page]').length===1&&!!table('Your nominations'));
  check(!visible('[aria-label="Panel workspace"]').length,'Module tabs visible inside record page');
  check(visible('[data-record-page] h1')[0].textContent==='Nomination records','Dedicated title missing');
  check(button('Back to My supervisees').getBoundingClientRect().top<visible('[data-record-page] h1')[0].getBoundingClientRect().top,'Back link is below title');
  check(button('Requests').getAttribute('aria-pressed')==='true','Standard Requests switch missing');
  check(!button('Ongoing'),'Inconsistent Ongoing label remains');
  const filters=visible('[data-workspace-filter-card]')[0];
  check(!filters.querySelector('details'),'Filters must remain visible');
  check(filters.textContent?.includes('Programme')&&filters.textContent?.includes('Semester')&&filters.textContent?.includes('Sort by'),'Standard filter fields missing');
  button('History').click();await until(()=>table('Your nominations')?.textContent?.includes('Former student'));
  button('View request').click();await until(()=>!!button('Back to Nomination records'));
  check(visible('[data-record-page]').length===1,'Nested record pages compete');
  check(visible('[data-record-page]')[0].textContent?.includes('Former student'),'Wrong request opened');
  button('Back to Nomination records').click();await until(()=>!!table('Your nominations')&&!!button('History'));
  check(button('History').getAttribute('aria-pressed')==='true','History selection lost after request');
  button('Back to My supervisees').click();await until(()=>!!table('Supervisees and their Panel members'));
  check(search().value==='Aisha','Roster filter lost');
  button('Nomination records').click();await until(()=>!!table('Your nominations'));
  check(button('History').getAttribute('aria-pressed')==='true','History lost after revisiting records');
  await router.navigate(-1);await until(()=>!!table('Supervisees and their Panel members'));
  check(search().value==='Aisha','Browser Back lost the roster filter');
  button('Nomination records').click();await until(()=>!!table('Your nominations'));
  check(document.documentElement.scrollWidth<=innerWidth,'Workspace exceeds viewport');
});
await scenario('student Panel details keep contact fields and the nomination action on a distinct page',async()=>{
  root.unmount();router?.dispose();root=createRoot(document.getElementById('root')!);
  router=createMemoryRouter([{path:'*',element:<ListState.Provider value={new Map()}><RecordPageProvider><Host role="office"/></RecordPageProvider></ListState.Provider>}],{initialEntries:['/personal-panel?panelSection=supervisees']});
  root.render(<RouterProvider router={router}/>);
  await until(()=>!!button('View student'));await typeSearch('Aisha');
  button('View student').click();await until(()=>visible('[data-record-page] h1')[0]?.textContent==='Student Panel details');
  check(!visible('[aria-label="Panel workspace"]').length,'List tabs remain on detail page');
  check(button('Back to My supervisees').getBoundingClientRect().top<visible('[data-record-page] h1')[0].getBoundingClientRect().top,'Back must precede title');
  const page=visible('[data-record-page]')[0];
  check(page.textContent?.includes('Computing')&&page.textContent?.includes('panel@example.test')&&page.textContent?.includes('02 Oct 2026'),'Current contact details missing');
  check(!page.textContent?.includes('Staff number')&&!visible('[data-workspace-filter-card]').length,'Detail page retains staff IDs or request filters');
  const action=button('Request replacement');const actionStyle=getComputedStyle(action);
  check(actionStyle.fontSize==='11px' && actionStyle.textTransform==='uppercase' && action.getBoundingClientRect().height>=36,'Nomination action differs from the standard button');
  const sidebar=visible('aside[aria-label="Panel nomination"]')[0];
  if(innerWidth<1280)check(sidebar.getBoundingClientRect().top<visible('[data-research-details]')[0].getBoundingClientRect().top,'Nomination action buried below research on mobile');
  action.click();await until(()=>!!button('Back to student Panel details'));
  check(visible('[data-record-page]').length===1,'Nomination form competes with student detail');
  button('Back to student Panel details').click();await until(()=>visible('[data-record-page] h1')[0]?.textContent==='Student Panel details');
  check(!visible('[data-panel-nomination-history]').length,'Nomination history belongs in the separate records view');
  button('Back to My supervisees').click();await until(()=>!!table('Supervisees and their Panel members'));
  check(search().value==='Aisha','Detail return lost roster filter');
  button('View student').click();await until(()=>visible('[data-record-page] h1')[0]?.textContent==='Student Panel details');
  check(document.documentElement.scrollWidth<=innerWidth,'Student details overflow viewport');
});
parent.postMessage({type:'panel-assignment-results',width:innerWidth,results},location.origin);
