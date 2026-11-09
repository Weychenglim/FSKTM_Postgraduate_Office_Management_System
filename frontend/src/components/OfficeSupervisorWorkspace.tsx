import {OfficeSupervisorStudentOverview} from './OfficeSupervisorStudentOverview';
import { DecisionDialog } from './DecisionDialog';
import { completeDecision } from '../utils/decisionSubmission';
import React,{useEffect,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router';
import {APP_ROUTES,routeForSupervisorApplication} from '../constants/routes';
import {OfficeSupervisorAttention} from './OfficeSupervisorAttention';
import {OfficeSupervisorTools} from './OfficeSupervisorTools';
import {SupervisorWorkloadMonitoring} from './SupervisorWorkloadMonitoring';
import {StaffSupervisorBrowseContext} from './StaffSupervisorBrowseContext';
import {SupervisorAppointmentManagement} from './SupervisorAppointmentManagement';
import {CoordinatorRequestsBrowse,CoordinatorSupervisorBrowse,CoordinatorStudentBrowse,CoordinatorAppointmentHistory,CoordinatorTeamsToolbar,CoordinatorCapacityBrowse,SupportingAppointmentRecord} from './CoordinatorSupervisorWorkspace';
import {PageHeader,PortalButton} from './PortalPrimitives';
import {SupervisorWorkspaceNavigation} from './SupervisorWorkspaceNavigation';
import {RecordPage} from './RecordPage';
import {LoadingState,ErrorState} from './StateViews';
import {CoSupervisorNominationCard,supportingRequestMetadata} from './SupervisoryTeamManagement';
import {RequestMetadata} from './RequestDetailPrimitives';
import {useListState} from './ListState';
import {officeSupervisorApi} from '../services/staffSupervisorWorkspaceApi';
import {decideCoSupervisor} from '../services/coSupervisionApi';
import type {SupervisorApplicationRecord,SupervisorRecord} from '../types';
import type {CoSupervisorNomination} from '../types/coSupervision';
import type {SupervisorGroup,BrowseParams} from '../services/coordinatorWorkspaceApi';
import type {CapacityRequestKind} from '../types/capacityReassessment';
import {formatMalaysiaDate} from '../utils/malaysiaDateTime';

type Props=React.ComponentProps<typeof SupervisorAppointmentManagement>&{requestsView?:boolean;supportingRequestId?:string;onNavigateToSupporting?:(id:string)=>void;onNavigateToAdministrationRecord?:(id:string)=>void;onNavigateToPastRecord?:(id:string)=>void};
export function officeApplicationRecord(row:SupervisorApplicationRecord&{email?:string;workloadLimit?:string}):SupervisorRecord {
 const status:SupervisorRecord['status']=row.appointmentLifecycle?.status==='ENDED'?'Ended':row.status==='APPROVED'?'Approved':row.status.startsWith('REJECTED')?'Rejected':row.status.startsWith('CANCELLED')?'Cancelled':'Pending';
 return {...row,applicationId:row.id,studentId:row.studentId,supervisor:row.proposedSupervisor,status,workflowStatus:row.status,
  appointmentId:row.appointmentLifecycle?.appointmentId,researchTopic:row.researchTitle,abstract:row.researchAbstract,
  email:row.email,workloadLimit:row.workloadLimit,approvalRecordedAt:row.coordinatorDecisionAt,approvedDate:row.coordinatorDecisionAt?formatMalaysiaDate(row.coordinatorDecisionAt):undefined,
  releasedDate:row.appointmentLifecycle?.endedAt?formatMalaysiaDate(row.appointmentLifecycle.endedAt):undefined,
  updatedDate:formatMalaysiaDate(row.cancelledAt||row.coordinatorDecisionAt||row.supervisorDecisionAt||row.submittedAt)};
}
function OfficePrimaryRecord({id,...props}:Props&{id:string}) {
 const [loadedId,setLoadedId]=useState<string|null>(null);
 const [record,setRecord]=useState<SupervisorRecord|null>(null),[error,setError]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
 const identity=useRef(id);identity.current=id;
 const version=useRef(0);
 useEffect(()=>{const token=++version.current;officeSupervisorApi.primary(id).then(row=>{if(token===version.current&&identity.current===id){setRecord(officeApplicationRecord(row));setLoadedId(id);setError(null);}}).catch(e=>{if(token===version.current&&identity.current===id)setError(e instanceof Error?e.message:'Request could not be loaded.');});return()=>{version.current++;};},[id,refresh]);
 useEffect(()=>{setLoadedId(null);setRecord(null);setError(null);},[id]);
 const reload=async()=>{const target=id,token=++version.current;const row=await officeSupervisorApi.primary(target);if(identity.current===target&&version.current===token){setRecord(officeApplicationRecord(row));setLoadedId(target);setError(null);}};
 if(!record||loadedId!==id)return <RecordPage pageKey={`office-primary-${id}`} title="Appointment request" backLabel={props.backLabel??'Back to Appointment requests'} onBack={props.onNavigateToList??(()=>{})}>{error?<ErrorState message={error} onRetry={()=>setRefresh(value=>value+1)}/>:<LoadingState message="Loading appointment request..."/>}</RecordPage>;
 return <SupervisorAppointmentManagement {...props} routeView="detail" routeRecordId={record.studentId} providedRecord={record} onProvidedRecordRefresh={reload}/>;
}
function OfficeSupportingRecord({id,onBack,backLabel}: {id:string;onBack:()=>void;backLabel:string}) {
 const [loadedId,setLoadedId]=useState<string|null>(null);
 const [record,setRecord]=useState<CoSupervisorNomination|null>(null),[error,setError]=useState<string|null>(null),[editing,setEditing]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const identity=useRef(id);identity.current=id;
 const version=useRef(0),mutation=useRef(false);
 useEffect(()=>{const token=++version.current;officeSupervisorApi.supporting(id).then(row=>{if(token===version.current&&identity.current===id){setRecord(row);setLoadedId(id);setError(null);}}).catch(e=>{if(token===version.current&&identity.current===id)setError(e instanceof Error?e.message:'Request could not be loaded.');});return()=>{version.current++;};},[id,refresh]);
 useEffect(()=>{setLoadedId(null);setRecord(null);setError(null);setEditing(false);setReason('');},[id]);
 const reload=async()=>{const target=id,token=++version.current;const row=await officeSupervisorApi.supporting(target);if(identity.current===target&&version.current===token){setRecord(row);setLoadedId(target);setError(null);}};
 const cancel=async()=>{if(loadedId!==id||!record||!reason.trim()||mutation.current||!record.allowedActions.includes('cancel'))return false;mutation.current=true;setBusy(true);try{return await completeDecision(async()=>{const updated=await decideCoSupervisor(record.id,'cancel',reason.trim());if(identity.current===id)setRecord(updated);},reload);}finally{mutation.current=false;setBusy(false);}};
 return <><DecisionDialog isOpen={loadedId===id&&editing} decisionKey={`office-supporting-${id}`} title="Cancel supporting nomination" confirmLabel="Cancel nomination" kind="confirmation" tone="danger"
   context={<p>{record?.studentName} &middot; {record?.matricNo} &middot; {record?.programme}</p>} message="This pending supporting-supervisor nomination will be cancelled and your reason recorded."
   busy={busy} dirty={!!reason.trim()} canConfirm={!!record?.allowedActions.includes('cancel')&&!!reason.trim()} successMessage="Supporting nomination cancelled."
   onClose={()=>{setEditing(false);setReason('');}} onConfirm={cancel} onReload={reload}>
   <label className="form-label block">Cancellation reason (required)<textarea required rows={3} className="form-control form-control-md mt-2 min-h-24 resize-y text-sm font-normal" value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
 </DecisionDialog><RecordPage pageKey={`office-supporting-${id}`} title="Supporting supervisor request" metadata={loadedId===id&&record?<RequestMetadata {...supportingRequestMetadata(record)}/>:undefined} backLabel={backLabel} onBack={onBack} busy={busy} dirty={editing&&!!reason.trim()}>{error?<ErrorState message={error} onRetry={()=>setRefresh(value=>value+1)}/>:null}{loadedId===id&&record?<CoSupervisorNominationCard detailView hideMetadata nomination={record} busy={busy} onAction={(_,action)=>{if(action==='cancel'){setEditing(true);setReason('');}}}/>:<LoadingState message="Loading supporting request..."/>}</RecordPage></>;
}
function OfficeSupervisorBody(props:Props) {
 const focusRequest=useRef(false);
 const navigate=useNavigate(),location=useLocation();
 const [refresh,setRefresh]=useState(0),[capacityTarget,setCapacityTarget]=useState<{kind:CapacityRequestKind;id:number}|null>(null),[supportingAppointment,setSupportingAppointment]=useState<number|null>(null);
 const [tool,setTool]=useListState<'capacity'|null>('office-supervisor','tool',null);
 const [teamView,setTeamView]=useListState<'requests'|'history'>('office-supervision','view','requests');
 const [group,setGroup]=useListState<{group:SupervisorGroup;source:BrowseParams}|null>('office-supervision','supervisor',null);
 if(props.supportingRequestId)return <OfficeSupportingRecord id={props.supportingRequestId} onBack={props.onNavigateToList??(()=>{})} backLabel={props.backLabel??'Back to Appointment requests'}/>;
 if(props.routeView==='detail'&&props.routeRecordId?.startsWith('student-'))return <OfficeSupervisorStudentOverview identity={props.routeRecordId.slice(8)} onBack={props.onNavigateToList??(()=>{})} backLabel={props.backLabel??'Back to Needs attention'} onOpenStudent={props.onNavigateToDossier} onOpenRequest={id=>navigate(routeForSupervisorApplication(`request-${id}`)+location.search,{state:{recordReturn:{path:location.pathname+location.search,label:'Supervisor appointment overview',historyIndex:window.history.state?.idx}}})} onOpenAppointment={props.onNavigateToTeam}/>;
 if(props.routeView==='detail'&&props.routeRecordId?.startsWith('request-'))return <OfficePrimaryRecord {...props} id={props.routeRecordId.slice(8)}/>;
 if(props.routeView==='workload')return <SupervisorWorkloadMonitoring backLabel={props.backLabel} onBack={props.onNavigateToList??(()=>{})} onOpenCapacity={props.onOpenCapacity} initialLecturerId={new URLSearchParams(location.search).get('lecturer')??undefined}/>;
 if(['detail','teamDetail'].includes(props.routeView??''))return <SupervisorAppointmentManagement {...props}/>;
 if(tool==='capacity')return <CoordinatorCapacityBrowse initialTarget={capacityTarget} refreshVersion={refresh} onClose={()=>{setTool(null);setCapacityTarget(null);}}/>;
 if(supportingAppointment!==null)return <SupportingAppointmentRecord id={supportingAppointment} onBack={()=>setSupportingAppointment(null)}/>;
 if(props.routeView==='teams'&&group&&teamView==='requests')return <RecordPage pageKey={`office-supervisor-students:${group.group.id}`} title={group.group.name} subtitle="Students under supervision" backLabel="Back to Supervisory teams" onBack={()=>setGroup(null)}><CoordinatorStudentBrowse group={group.group} source={group.source} refreshVersion={refresh} onOpen={id=>props.onNavigateToTeam?.(id)}/></RecordPage>;
 const sourceLabel=props.routeView==='teams'?'Supervisory teams':props.requestsView?'Appointment requests':'Needs attention';
 const researchRecords=()=>navigate(APP_ROUTES.supervisorResearchChanges,{state:{recordReturn:{path:location.pathname+location.search,label:sourceLabel,historyIndex:window.history.state?.idx}}});
 const openAttentionRequest=(row:import('../services/staffSupervisorWorkspaceApi').OfficeAttentionRequest)=>{
  if(row.kind==='primary')props.onNavigateToRecord?.(`request-${row.id}`);
  else if(row.kind==='supporting')props.onNavigateToSupporting?.(String(row.id));
  else navigate(`${APP_ROUTES.supervisorResearchChanges}/${row.id}`,{state:{recordReturn:{path:location.pathname+location.search,label:'Needs attention',historyIndex:window.history.state?.idx}}});
 };
 const openWorkload=(lecturer:string)=>{
  const query=new URLSearchParams();query.set('lecturer',lecturer);
  navigate(`${APP_ROUTES.supervisorAppointmentWorkload}?${query}`,{state:{recordReturn:{path:location.pathname+location.search,label:'Needs attention',historyIndex:window.history.state?.idx}}});
 };
 return <div className="space-y-6"><PageHeader title="Supervisor Appointments" subtitle="Identify records needing follow-up, monitor requests and manage supervisory teams." actions={<div className="flex flex-wrap gap-2"><PortalButton size="sm" onClick={()=>{setCapacityTarget(null);setTool('capacity');}}>Capacity reassessments</PortalButton><OfficeSupervisorTools onResearchRecords={researchRecords} onWorkload={props.onNavigateToWorkload??(()=>{})} onRequirements={props.onNavigateToRequirements??(()=>{})}/></div>}/><SupervisorWorkspaceNavigation role="Office Staff/Admin"/>{props.routeView==='teams'?<>{teamView==='history'?<CoordinatorAppointmentHistory viewActions={<CoordinatorTeamsToolbar focusRequest={focusRequest} view={teamView} onChange={setTeamView}/>} refreshVersion={refresh} onOpen={row=>row.kind==='primary'&&row.applicationId?(props.onNavigateToPastRecord??props.onNavigateToRecord)?.(`request-${row.applicationId}`):setSupportingAppointment(row.id)}/>:<CoordinatorSupervisorBrowse viewActions={<CoordinatorTeamsToolbar focusRequest={focusRequest} view={teamView} onChange={setTeamView}/>} refreshVersion={refresh} onOpen={(group,source)=>setGroup({group,source})}/>}</>:props.requestsView?<CoordinatorRequestsBrowse refreshVersion={refresh} onOpen={(id,kind)=>kind==='primary'?props.onNavigateToRecord?.(`request-${id}`):props.onNavigateToSupporting?.(String(id))} onCarryover={target=>{setCapacityTarget(target);setTool('capacity');}}/>:<OfficeSupervisorAttention refreshVersion={refresh} onStudent={id=>props.onNavigateToRecord?.(`student-${id}`)} onRequest={openAttentionRequest} onWorkload={openWorkload}/>}</div>;
}
export function OfficeSupervisorWorkspace(props:Props) {return <StaffSupervisorBrowseContext.Provider value="Office Staff/Admin"><OfficeSupervisorBody {...props}/></StaffSupervisorBrowseContext.Provider>;}
