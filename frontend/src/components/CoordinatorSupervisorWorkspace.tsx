import { RequestStatusBadge } from './RequestStatusBadge';
import { OfficeMonitoringNotice, useOfficeMonitoring } from './OfficeMonitoringContext';
import {useStaffSupervisorBrowse} from './StaffSupervisorBrowseContext';
import {CapacityReassessments} from './CapacityReassessments';
import React, { useEffect, useRef, useState } from 'react';
import { CoordinatorSupervisorApprovals } from './CoordinatorSupervisorApprovals';
import { RecordPage } from './RecordPage';
import { PageHeader, PortalButton, StatusBadge } from './PortalPrimitives';
import { OfficeWorkspaceExport } from './OfficeWorkspaceExport';
import { SupervisionWorkbookExport } from './SupervisionWorkbookExport';
import { SupervisorWorkspaceNavigation } from './SupervisorWorkspaceNavigation';
import { AppointmentViewSwitch, RequestViewSwitch, WorkspaceSectionHeader } from './RequestWorkspacePrimitives';
import { useListState } from './ListState';
import { LoadingState, ErrorState } from './StateViews';
import { requestStatusLabel } from '../utils/lecturerRequests';
import { formatRequestStageWaiting } from '../utils/requestStageWaiting';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { CoSupervisorAppointmentCard, supportingAppointmentMetadata } from './SupervisoryTeamManagement';
import { RequestMetadata } from './RequestDetailPrimitives';
import { CapacityReassessmentCard } from './CapacityReassessments';
import { CoordinatorDataTable, CoordinatorFiltersBar, CoordinatorPageFooter, useCoordinatorFilters, useCoordinatorPage } from './CoordinatorBrowsePrimitives';
import { getCoordinatorRequests, getCoordinatorTeams, getCoordinatorAppointments, getCoordinatorCarryover, getCoordinatorCarryoverRecord, getCoordinatorSupportingAppointment, type CoordinatorRequestRow, type SupervisorGroup, type CoordinatorStudentRow, type CoordinatorAppointmentRow, type BrowseParams } from '../services/coordinatorWorkspaceApi';
import type { CoSupervisorAppointment } from '../types/coSupervision';
import type { CapacityRequestKind, CapacityReassessment, CapacitySemester } from '../types/capacityReassessment';

type Props = React.ComponentProps<typeof CoordinatorSupervisorApprovals>;
type CapacityTarget = {kind:CapacityRequestKind;id:number};
const identity = (name:string, id:string) => <><p>{name}</p><p className="card-caption mt-1">{id}</p></>;
const outcome = (value:string) => value.replaceAll('_',' ').toLowerCase().replace(/^./, c=>c.toUpperCase());
export function CoordinatorRequestTable({rows,history,onOpen,onCarryover}: {rows:CoordinatorRequestRow[];history:boolean;onOpen:(id:number,kind:'primary'|'supporting')=>void;onCarryover:(target:CapacityTarget)=>void}) {
 return <CoordinatorDataTable label="Appointment request records" columns={['Student','Request type','Proposed supervisor',history?'Outcome recorded':'Submitted',history?'Outcome':'Current stage',...(!history?['Waiting at this stage']:[]),'Action']} rows={rows.map(row=>({key:row.key,cells:[identity(row.studentName,row.matricNo),row.kind==='primary'?'Primary supervisor':'Supporting supervisor',row.candidateName,history ? row.decidedAt ? formatMalaysiaDate(row.decidedAt) : 'Not recorded' : formatMalaysiaDate(row.submittedAt),<RequestStatusBadge status={row.status} canDecide={row.canDecide}/>,...(!history?[formatRequestStageWaiting(row.status,row.waitingDays,true)]:[]),<div className="flex flex-wrap justify-end gap-2"><PortalButton size="sm" variant={row.canDecide?'primary':'secondary'} onClick={()=>onOpen(row.id,row.kind)}>{row.canDecide?'Review request':'View request'}</PortalButton>{row.carryover ? <PortalButton size="sm" onClick={()=>onCarryover({kind:row.kind==='primary'?'SUPERVISOR':'CO_SUPERVISOR',id:row.id})}>Carryover</PortalButton>:null}</div>]}))} />;
}
export function CoordinatorSupervisorTable({rows,onOpen}: {rows:SupervisorGroup[];onOpen:(row:SupervisorGroup)=>void}) {
 return <CoordinatorDataTable label="Supervisors and their students" columns={['Supervisor','Primary students','Supporting students','Action']} rows={rows.map(row=>({key:row.id,cells:[identity(row.name,row.staffNo),row.primaryCount,row.supportingCount,<PortalButton size="sm" onClick={()=>onOpen(row)}>View students</PortalButton>]}))} />;
}
export function CoordinatorAppointmentHistoryTable({rows,onOpen}: {rows:CoordinatorAppointmentRow[];onOpen:(row:CoordinatorAppointmentRow)=>void}) {
 return <CoordinatorDataTable label="Past appointments" columns={['Student','Supervisor','Role','Started','Ended','Outcome','Action']} rows={rows.map(row=>({key:row.key,cells:[identity(row.studentName,row.matricNo),row.supervisorName,row.kind==='primary'?'Primary supervisor':'Supporting supervisor',formatMalaysiaDate(row.appointmentDate),row.endedAt?formatMalaysiaDate(row.endedAt):'Not recorded',<RequestStatusBadge status={row.outcome} label={outcome(row.outcome)}/>,<PortalButton size="sm" onClick={()=>onOpen(row)}>View appointment</PortalButton>]}))} />;
}
function PageState({loading,error,reload,empty,emptyMessage="No matching records. Adjust the filters to see more results."}: {loading:boolean;error:string|null;reload:()=>void;empty:boolean;emptyMessage?:string}) {
 return loading ? <LoadingState message="Loading records…" /> : error ? <ErrorState message={error} onRetry={reload} /> : empty ? <p role="status" className="card-description py-6 text-center">{emptyMessage}</p> : null;
}
export function CoordinatorRequestsBrowse({refreshVersion,onOpen,onCarryover}: {refreshVersion:number;onOpen:(id:number,kind:'primary'|'supporting')=>void;onCarryover:(target:CapacityTarget)=>void}) {
 const {office,scopeKey,api}=useStaffSupervisorBrowse();
 const monitoring = useOfficeMonitoring();
 const pendingSupervisors = office && monitoring?.view === 'supervisor-pending';
 const [view,setView]=useListState<'requests'|'history'>(`${scopeKey}-supervisor`,'view','requests');const f=useCoordinatorFilters(`${scopeKey}-supervisor`,view==='history'?'newest':'waiting',{},true);
 const result=useCoordinatorPage(api.requests,{...f.params,view:pendingSupervisors?'requests':view,focus:office?"all":"decision",monitor:pendingSupervisors?'supervisor-pending':undefined},refreshVersion);
 const history=!pendingSupervisors&&view==='history';
 return <section className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white"><OfficeMonitoringNotice/><WorkspaceSectionHeader title="Appointment requests" description={office?"Monitor ongoing primary and supporting requests, or view final request outcomes.":"Decide on primary and supporting requests awaiting your approval, or view final request outcomes."} actions={<>{!pendingSupervisors&&<RequestViewSwitch view={view} reviewCount={result.data?.reviewCount??0} onChange={value=>{setView(value);f.setSort(value==='history'?'newest':'waiting');f.setStatus('');f.setFrom('');f.setTo('');f.setPage(1);}} />}</>} />
 <CoordinatorFiltersBar filters={f} facets={result.data?.facets} includeEndDate={false} requests history={history} typeOptions={[["all","All types"],["primary","Primary supervisor"],["supporting","Supporting supervisor"]]} actions={office?<OfficeWorkspaceExport filename={`supervisor_requests_${view}.xlsx`} loader={api.requests} params={{...f.params,view:pendingSupervisors?'requests':view,focus:'all',monitor:pendingSupervisors?'supervisor-pending':undefined}} disabled={result.loading||!!result.error} columns={[
 {header:'Student',value:row=>row.studentName},{header:'Matric number',value:row=>row.matricNo},{header:'Programme',value:row=>row.programme},{header:'Request type',value:row=>row.kind},{header:'Proposed supervisor',value:row=>row.candidateName},{header:'Submitted',value:row=>row.submittedAt},{header:'Outcome recorded',value:row=>row.decidedAt},{header:'Current stage',value:row=>requestStatusLabel(row.status)},{header:'Waiting days',value:row=>row.waitingDays},
 ]}/>:null} />
 <PageState {...result} empty={!result.data?.results.length} emptyMessage={history?"No matching request outcomes.":office?"No ongoing appointment requests match the filters.":"No appointment requests awaiting your decision match the filters."} />
 {!result.loading&&!result.error&&result.data?.results.length ? <CoordinatorRequestTable rows={result.data.results} history={history} onOpen={onOpen} onCarryover={onCarryover}/>:null}
 {!result.loading&&!result.error?<CoordinatorPageFooter data={result.data} filters={f} noun="requests"/>:null}</section>;
}
const supervisorLoader = (params:BrowseParams)=>getCoordinatorTeams<SupervisorGroup>(params);
const studentLoader = (params:BrowseParams)=>getCoordinatorTeams<CoordinatorStudentRow>(params);
export function CoordinatorTeamViewSwitch({view,onChange,focusRequest}: {view:'requests'|'history';onChange:(value:'requests'|'history')=>void;focusRequest?:React.RefObject<boolean>}) {
 return <AppointmentViewSwitch focusRequest={focusRequest} label="Supervision views" view={view==='history'?'past':'current'} currentLabel="Current" pastLabel="Past" onChange={value=>onChange(value==='past'?'history':'requests')}/>;
}
export function CoordinatorTeamsToolbar({view,onChange,focusRequest}: {view:'requests'|'history';onChange:(value:'requests'|'history')=>void;focusRequest?:React.RefObject<boolean>}) {
 return <div className="flex items-center"><CoordinatorTeamViewSwitch focusRequest={focusRequest} view={view} onChange={onChange}/></div>;
}
export function CoordinatorStudentBrowse({group,source,refreshVersion,onOpen}: {group?:SupervisorGroup;source?:BrowseParams;refreshVersion:number;onOpen:(matric:string)=>void}) {
 const {scopeKey,api,office,role}=useStaffSupervisorBrowse();
 const f=useCoordinatorFilters(group?`${scopeKey}-students:${group.id}:${source?.q??''}:${source?.programme??''}:${source?.semester??''}`:`${scopeKey}-team-students`,'name',source);
 const result=useCoordinatorPage(api.students,{...f.params,sort:'name',view:'students',supervisor:group?.id},refreshVersion);
 return <section className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white"><WorkspaceSectionHeader title={group?'Students under supervision':'Current teams'} description={group?(office?'Primary and supporting relationships across programmes. Each matching student appears once.':'Primary and supporting relationships in your managed programmes. Each matching student appears once.'):'Find a student and open their supervisory team.'} />
 <CoordinatorFiltersBar filters={{...f,sort:'name'}} facets={result.data?.facets} includeStatusAndDates={false} searchLabel="Find a student or supervisor" sortOptions={[["name","Student name"]]} actions={<SupervisionWorkbookExport role={role} params={{...f.params,sort:'name',supervisor:group?.id}} lecturer={!!group} disabled={result.loading||!!result.error}/>} />
 <PageState {...result} empty={!result.data?.results.length}/>
 {!result.loading&&!result.error&&result.data?.results.length?<CoordinatorDataTable label="Current supervisory teams" columns={['Student','Programme',group?'Relationship':'Primary supervisor','Action']} rows={result.data.results.map(row=>({key:row.id,cells:[identity(row.studentName,row.matricNo),row.programme,group?row.relationship:row.primarySupervisor?.name??'Not appointed',<PortalButton size="sm" onClick={()=>onOpen(row.matricNo)}>View supervision</PortalButton>]}))}/>:null}
 {!result.loading&&!result.error?<CoordinatorPageFooter data={result.data} filters={f} noun="students"/>:null}</section>;
}
export function CoordinatorSupervisorBrowse({refreshVersion,onOpen,viewActions}: {viewActions?:React.ReactNode;refreshVersion:number;onOpen:(group:SupervisorGroup,source:BrowseParams)=>void}) {
 const {scopeKey,api,office,role}=useStaffSupervisorBrowse();
 const f=useCoordinatorFilters(`${scopeKey}-team-supervisors`,'name');const result=useCoordinatorPage(api.supervisors,{...f.params,view:'supervisors'},refreshVersion);
 return <section className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white"><WorkspaceSectionHeader title="Current teams" actions={viewActions} description={office?"Browse supervisors and their students across programmes.":"Browse supervisors and their students in your managed programmes."}/>
 <CoordinatorFiltersBar filters={f} facets={result.data?.facets} includeStatusAndDates={false} searchLabel="Find a student or supervisor" sortOptions={[["name","Supervisor name"],["primary","Most primary students"],["supporting","Most supporting students"]]} actions={<SupervisionWorkbookExport role={role} params={f.params} disabled={result.loading||!!result.error}/>} />
 <PageState {...result} empty={!result.data?.results.length}/>
 {!result.loading&&!result.error&&result.data?.results.length?<CoordinatorSupervisorTable rows={result.data.results} onOpen={group=>onOpen(group,f.params)}/>:null}
 {!result.loading&&!result.error?<CoordinatorPageFooter data={result.data} filters={f} noun="supervisors"/>:null}</section>;
}
export function CoordinatorAppointmentHistory({refreshVersion,onOpen,viewActions}: {viewActions?:React.ReactNode;refreshVersion:number;onOpen:(row:CoordinatorAppointmentRow)=>void}) {
 const {scopeKey,api,office}=useStaffSupervisorBrowse();
 const f=useCoordinatorFilters(`${scopeKey}-appointment-history`,'newest',{},true);const result=useCoordinatorPage(api.appointments,{...f.params,status:'',view:'history'},refreshVersion);
 return <section className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white"><WorkspaceSectionHeader title="Past appointments" actions={viewActions} description="Ended primary and supporting appointments."/>
 <CoordinatorFiltersBar filters={{...f,status:''}} facets={result.data?.facets} includeEndDate={false} showStatus={false} history dateLabel="Ended" typeLabel="Supervisor role" searchLabel="Find an appointment" typeOptions={[["all","All roles"],["primary","Primary supervisor"],["supporting","Supporting supervisor"]]} sortOptions={[["newest","Recently ended"],["oldest","Oldest endings first"]]} actions={office?<OfficeWorkspaceExport filename="supervisor_past_appointments.xlsx" loader={api.appointments} params={{...f.params,status:'',view:'history'}} disabled={result.loading||!!result.error} columns={[
 {header:'Student',value:row=>row.studentName},{header:'Matric number',value:row=>row.matricNo},{header:'Supervisor',value:row=>row.supervisorName},{header:'Role',value:row=>row.kind},{header:'Started',value:row=>row.appointmentDate},{header:'Ended',value:row=>row.endedAt},{header:'Outcome',value:row=>row.outcome},{header:'Application ID',value:row=>row.applicationId},
 ]}/>:undefined} />
 <PageState {...result} empty={!result.data?.results.length}/>
 {!result.loading&&!result.error&&result.data?.results.length?<CoordinatorAppointmentHistoryTable rows={result.data.results} onOpen={onOpen}/>:null}
 {!result.loading&&!result.error?<CoordinatorPageFooter data={result.data} filters={f} noun="appointments"/>:null}</section>;
}
export function SupportingAppointmentRecord({id,onBack}: {id:number;onBack:()=>void}) {
 const {api}=useStaffSupervisorBrowse();
 const [record,setRecord]=useState<CoSupervisorAppointment|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{let active=true;setRecord(null);setError(null);api.supportingAppointment(id).then(row=>{if(active)setRecord(row);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Appointment could not be loaded.');});return()=>{active=false;};},[id,api]);
 const selected = record?.id === id && !error ? record : null;
 return <RecordPage pageKey={`coordinator-supporting-appointment:${id}`} title="Supporting supervisor appointment" metadata={selected?<RequestMetadata {...supportingAppointmentMetadata(selected)}/>:undefined} backLabel="Back to Past appointments" onBack={onBack}>{error?<p role="alert" className="card-description">{error}</p>:selected?<CoSupervisorAppointmentCard detail appointment={{...selected,canEnd:false}} busy={false} canReplace={false} onEnd={()=>{}} onReplace={()=>{}}/>:<LoadingState message="Loading appointment…"/>}</RecordPage>;
}
function CoordinatorCapacityRecord({target,onBack,backLabel}: {target:CapacityTarget;onBack:()=>void;backLabel:string}) {
 const {api,office}=useStaffSupervisorBrowse();const [busy,setBusy]=useState(false);
 const [data,setData]=useState<{record:CapacityReassessment;activeSemester:CapacitySemester|null}|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(office)return;let active=true;api.carryoverRecord(target.kind,target.id).then(row=>{if(active)setData(row);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Reassessment could not be loaded.');});return()=>{active=false;};},[target.id,target.kind,api,office]);
 if(office)return <RecordPage pageKey={`office-capacity-record:${target.kind}:${target.id}`} title="Capacity reassessment" backLabel={backLabel} onBack={onBack} busy={busy}><CapacityReassessments role="Office Staff/Admin" target={target} showRefresh={false} onBusyChange={setBusy}/></RecordPage>;
 return <RecordPage pageKey={`coordinator-capacity-record:${target.kind}:${target.id}`} title="Capacity reassessment" backLabel={backLabel} onBack={onBack}><p className="card-description">Office manages capacity authorisation. This record is read-only for Programme Coordinator.</p>{error?<p role="alert" className="card-description">{error}</p>:data?<CapacityReassessmentCard row={data.record} activeSemester={data.activeSemester} office={false} busy={false} onAction={()=>{}}/>:<LoadingState message="Loading reassessment…"/>}</RecordPage>;
}
export function CoordinatorCapacityBrowse({initialTarget,onClose,refreshVersion}: {initialTarget:CapacityTarget|null;onClose:()=>void;refreshVersion:number}) {
 const {scopeKey,api,office}=useStaffSupervisorBrowse();
 const f=useCoordinatorFilters(`${scopeKey}-capacity`,'newest');const [target,setTarget]=useState<CapacityTarget|null>(initialTarget);const result=useCoordinatorPage(api.carryover,f.params,refreshVersion,!target);
 if(target)return <CoordinatorCapacityRecord target={target} backLabel={initialTarget?'Back to Appointment requests':'Back to Capacity reassessments'} onBack={()=>initialTarget?onClose():setTarget(null)}/>;
 return <RecordPage pageKey="coordinator-capacity-list" title="Capacity reassessments" backLabel="Back to Supervisor Appointments" onBack={onClose}><section className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white"><p className="card-description">{office?'Manage carryover capacity authorisations across programmes.':'Review carryover capacity information and Office authorisation history in your managed programmes.'} This does not approve appointments or add capacity.</p><CoordinatorFiltersBar filters={f} facets={result.data?.facets} searchLabel="Find a carryover request" includeStatusAndDates={false} typeOptions={[["all","All types"],["primary","Primary supervisor"],["supporting","Supporting supervisor"],["panel","Panel"]]}/><PageState {...result} empty={!result.data?.results.length}/>
 {!result.loading&&!result.error&&result.data?.results.length?<CoordinatorDataTable label="Capacity reassessment records" columns={['Student','Request type','Candidate','Original semester','Current stage','Authorisation','Action']} rows={result.data.results.map(row=>({key:`${row.kind}-${row.id}`,cells:[identity(row.student.name,row.student.matricNo),row.kind==='SUPERVISOR'?'Primary supervisor':row.kind==='CO_SUPERVISOR'?'Supporting supervisor':'Panel',row.candidate.name,row.originalSemester?.label??'Not recorded',<RequestStatusBadge status={row.status}/>,row.authorization?outcome(row.authorization.state):'Not authorised',<PortalButton size="sm" onClick={()=>setTarget({kind:row.kind,id:row.id})}>View reassessment</PortalButton>]}))}/>:null}
 {!result.loading&&!result.error?<CoordinatorPageFooter data={result.data} filters={f} noun="records"/>:null}</section></RecordPage>;
}
export function CoordinatorSupervisorWorkspace(props:Props) {
 const focusRequest=useRef(false);
 const [tool,setTool]=useState(false),[capacityTarget,setCapacityTarget]=useState<CapacityTarget|null>(null),[supportingAppointment,setSupportingAppointment]=useState<number|null>(null);
 const [teamView,setTeamView]=useListState<'requests'|'history'>('coordinator-supervision','view','requests');
 const [selectedGroup,setSelectedGroup]=useListState<{group:SupervisorGroup;source:BrowseParams}|null>('coordinator-supervision','supervisor',null);
 const version=props.refreshVersion??0;
 if(props.initialApplicationId||props.initialSupportingId||props.routeTeamStudentId)return <CoordinatorSupervisorApprovals {...props}/>;
 if(tool)return <CoordinatorCapacityBrowse initialTarget={capacityTarget} onClose={()=>{setTool(false);setCapacityTarget(null);}} refreshVersion={version}/>;
 if(supportingAppointment!==null)return <SupportingAppointmentRecord id={supportingAppointment} onBack={()=>setSupportingAppointment(null)}/>;
 if(props.workspaceView==='teams'&&selectedGroup&&teamView==='requests')return <RecordPage pageKey={`coordinator-supervisor-students:${selectedGroup.group.id}`} title={selectedGroup.group.name} subtitle="Students under supervision in your managed programmes" backLabel="Back to Supervisory teams" onBack={()=>setSelectedGroup(null)}><CoordinatorStudentBrowse key={`${selectedGroup.group.id}:${selectedGroup.source.q}:${selectedGroup.source.programme}:${selectedGroup.source.semester}`} group={selectedGroup.group} source={selectedGroup.source} refreshVersion={version} onOpen={id=>props.onNavigateToTeam?.(id)}/></RecordPage>;
 return <div className="space-y-6 text-left font-sans"><PageHeader title="Supervisor Appointments" subtitle="Review appointment requests and manage supervision in your programmes." actions={<PortalButton size="sm" onClick={()=>{setCapacityTarget(null);setTool(true);}}>Capacity reassessments</PortalButton>}/><SupervisorWorkspaceNavigation role="Programme Coordinator"/>
 {props.workspaceView==='teams'?<>{teamView==='history'?<CoordinatorAppointmentHistory viewActions={<CoordinatorTeamsToolbar focusRequest={focusRequest} view={teamView} onChange={setTeamView}/>} refreshVersion={version} onOpen={row=>row.kind==='primary'&&row.applicationId?props.onNavigateToApplication?.(String(row.applicationId)):setSupportingAppointment(row.id)}/>:<CoordinatorSupervisorBrowse viewActions={<CoordinatorTeamsToolbar focusRequest={focusRequest} view={teamView} onChange={setTeamView}/>} refreshVersion={version} onOpen={(group,source)=>setSelectedGroup({group,source})}/>}</>:<CoordinatorRequestsBrowse refreshVersion={version} onOpen={(id,kind)=>kind==='primary'?props.onNavigateToApplication?.(String(id)):props.onNavigateToSupportingRequest?.(String(id))} onCarryover={target=>{setCapacityTarget(target);setTool(true);}}/>}
 </div>;
}
