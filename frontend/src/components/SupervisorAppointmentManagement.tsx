import { PortalSelect } from './PortalSelect';
import { RequestStatusBadge } from './RequestStatusBadge';
import {completeDecision} from '../utils/decisionSubmission';
import { useListState } from './ListState';
import { RecordPage } from './RecordPage';
import {DecisionFeedbackProvider, useDecisionFeedback} from './DecisionFeedback';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  UserRound,
  UserRoundPen,
  Users,
  UserX,
  FileText,
  AlertTriangle,
  CheckCircle,
  Search,
  SlidersHorizontal,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Info,
  Mail,
  User,
  Calendar,
  Eye,
  AlertCircle
} from 'lucide-react';
import { PageHeader, PortalButton, StatusBadge, StatusDot } from './PortalPrimitives';
import { EmptyState, LoadingState, ErrorState } from './StateViews';
import { SupervisorWorkloadMonitoring } from './SupervisorWorkloadMonitoring';
import { SupervisorDocumentsList } from './SupervisorDocumentsList';
import { SupervisorRecord } from '../types';
import {
  formatSupervisorWaiting,
  getSupervisorAppointments,
  getSupervisorRecordSummary,
  orderSupervisorQueueOldestFirst,
  endSupervisorAppointment,
} from '../services';
import { AppointmentEndControl } from './AppointmentEndControl';
import { findSupervisorRecordByRouteKey, supervisorRecordRouteKey } from '../utils/supervisorAppointmentRoutes';
import { useExcelExport } from '../utils/useExcelExport';
import { SupervisoryTeamManagement } from './SupervisoryTeamManagement';
import { SupervisorWorkspaceNavigation } from './SupervisorWorkspaceNavigation';
import { AppointmentSummaryCard } from './AppointmentPrimitives';
import { WorkspaceSectionHeader, RequestFilters, WorkspacePagination } from './RequestWorkspacePrimitives';
import { CapacityReassessments } from './CapacityReassessments';
import { requestStatusLabel } from '../utils/lecturerRequests';
import { formatRequestStageWaiting } from '../utils/requestStageWaiting';
import { RequestMetadata, ViewStudentRecordAction } from './RequestDetailPrimitives';
import { SupervisorRequestDetail, supervisorRequestMetadata, type SupervisorRequestPresentation } from './SupervisorRequestDetail';
import {OfficeSupervisorReplacementForm} from './OfficeSupervisorReplacementForm';
import {getOfficeSupervisorReplacement, type OfficeSupervisorReplacementContext} from '../services/officeSupervisorReplacementApi';
import { SupervisorAppointmentRecordCard, toOfficeAppointmentPresentation } from './SupervisorAppointmentRecordCard';

export function officeRequestPresentation(record: SupervisorRecord): SupervisorRequestPresentation {
  const events=record.workflow??[];
  const submitted=events.find(event=>['SUBMIT','SUBMITTED'].includes(event.action.toUpperCase()));
  const status=record.workflowStatus??(record.status==='Pending'
    ? events.at(-1)?.newStatus || (['PROGRAMME_COORDINATOR','COORDINATOR'].includes(record.waitingOn??'')?'PENDING_COORDINATOR':record.waitingOn==='SUPERVISOR'?'SUBMITTED_TO_SUPERVISOR':'UNKNOWN')
    : record.status==='Ended'?events.at(-1)?.newStatus||'UNKNOWN':record.status.toUpperCase());
  return {applicationId:record.applicationId,reference:record.applicationId!=null?'SV-REQ-'+String(record.applicationId).padStart(5,'0'):undefined,
    status,acceptanceCapacity:record.acceptanceCapacity,submittedAt:record.submittedAt||submitted?.createdAt,submittedBy:submitted?.actorName,
    initiatedByOffice:record.initiatedByOffice??(!!record.replacesAppointmentId&&submitted?.actorRole==='Office Staff/Admin'),
    studentName:record.studentName,studentId:record.studentId,programme:record.programme,semester:record.semester,
    proposedSupervisor:record.supervisor,researchTitle:record.researchTopic,researchArea:record.researchArea,
    researchAbstract:record.abstract,projectCourseCodes:record.projectCourseCodes,replacementReason:record.replacementReason,
    rejectionReason:record.rejectionReason,cancellationReason:record.cancellationReason,
    waitingDays:record.waitingDays,waitingOn:record.waitingOn,events,documents:record.documents};
}

function OfficeRequestReplacementAction({appointmentId,studentId,onChange}:{appointmentId:number;studentId:string;onChange:()=>void}) {
  const [context,setContext]=useState<OfficeSupervisorReplacementContext|null>(null);
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    setContext(null);setFailed(false);
    getOfficeSupervisorReplacement(appointmentId).then(result=>{
      if(result.appointmentId!==appointmentId||result.studentId!==studentId)throw new Error('Replacement context does not match this appointment.');
      if(!cancelled)setContext(result);
    }).catch(()=>{if(!cancelled)setFailed(true);});
    return()=>{cancelled=true;};
  },[appointmentId,studentId,attempt]);
  if(failed)return <div role="alert" className="space-y-2"><p className="card-description">Supervisor change availability could not be checked.</p><PortalButton onClick={()=>setAttempt(value=>value+1)}>Retry availability check</PortalButton></div>;
  if(!context||context.appointmentId!==appointmentId||context.studentId!==studentId)return null;
  if(!context.canSubmit||context.pendingApplicationId)return context.blockedReason?<p role="status" className="card-description">{context.blockedReason}</p>:null;
  return <PortalButton icon={UserRoundPen} onClick={onChange}>Request supervisor change</PortalButton>;
}

export function OfficeAppointmentAdministration({record:r,onEnd,onChange,refreshVersion=0}:{record:SupervisorRecord;onEnd:React.ComponentProps<typeof AppointmentEndControl>['onSubmit'];onChange?:()=>void;refreshVersion?:number}) {
  const hasAppointment=!!r.appointmentLifecycle||!!r.appointmentId;
  const active=r.appointmentLifecycle?.status==='ACTIVE';
  const appointmentId=r.appointmentLifecycle?.appointmentId;
  return hasAppointment?<SupervisorAppointmentRecordCard compact record={toOfficeAppointmentPresentation(r)} onEnd={active?onEnd:undefined}
    actions={active&&appointmentId&&onChange?<OfficeRequestReplacementAction key={`${appointmentId}:${r.studentId}:${refreshVersion}`} appointmentId={appointmentId} studentId={r.studentId} onChange={onChange}/>:undefined}/>:null;
}

export function filterOfficeSupervisorRecords(records: SupervisorRecord[], filters: { search: string; programme: string; semester: string; status: string }) {
  const query = filters.search.trim().toLowerCase();
  return records.filter(row => (!query || `${row.studentName} ${row.studentId} ${row.supervisor} ${row.programme} ${row.researchTopic ?? ''}`.toLowerCase().includes(query))
    && (filters.programme === 'All Programmes' || row.programme === filters.programme)
    && (filters.semester === 'All Semesters' || row.semester === filters.semester)
    && (filters.status === 'All Records' || row.status === filters.status));
}
export function OfficeSupervisorRecordTable({ records, onOpen, onDossier }: { records: SupervisorRecord[]; onOpen: (row: SupervisorRecord) => void; onDossier: (row: SupervisorRecord) => void }) {
  const columns = ['Student','Programme','Supervisor','Current stage','Waiting at this stage','Updated','Action'];
  const stage = (row: SupervisorRecord) => row.status === 'Ended' ? 'Ended' : row.workflow?.length ? requestStatusLabel(row.workflow[row.workflow.length - 1].newStatus) : row.status === 'Pending' ? row.waitingOn === 'PROGRAMME_COORDINATOR' || row.waitingOn === 'COORDINATOR' ? 'Awaiting Coordinator approval' : 'Awaiting Supervisor review' : row.status;
  return <table className="data-table block lg:table" aria-label="Appointment records"><thead className="hidden lg:table-header-group"><tr className="data-thead bg-slate-50">{columns.map(value => <th key={value} scope="col" className="data-th">{value}</th>)}</tr></thead><tbody className="block space-y-3 lg:table-row-group lg:space-y-0">{records.map(row => <tr key={row.applicationId != null ? `application-${row.applicationId}` : supervisorRecordRouteKey(row)} className="data-row grid grid-cols-2 rounded-xl border border-slate-200 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0">{[
    <><p>{row.studentName}</p><p className="card-caption mt-1">{row.studentId}</p></>, row.programme, row.supervisor || 'Not assigned', <RequestStatusBadge status={row.status === 'Ended' ? 'ENDED' : row.workflowStatus ?? row.workflow?.at(-1)?.newStatus ?? row.status} label={stage(row)}/>,
    formatRequestStageWaiting(row.status === 'Ended' ? row.status : row.workflow?.at(-1)?.newStatus ?? row.status, row.waitingDays, row.status === 'Pending'), row.updatedDate,
    <div className="flex flex-wrap justify-end gap-2"><PortalButton variant="primary" icon={UserRound} size="sm" onClick={() => onDossier(row)}>View student record</PortalButton><PortalButton size="sm" onClick={() => onOpen(row)}>{row.status === 'Approved' || row.status === 'Ended' ? 'View supervision' : row.status === 'No Supervisor' ? 'View record' : 'View request'}</PortalButton></div>
  ].map((cell,index) => <td key={columns[index]} className={`${index === 0 ? 'data-td-strong' : 'data-td'} block min-w-0 break-words lg:table-cell ${index === 0 || index === 6 ? 'col-span-2' : ''}`}>
    {index > 0 && index < 6 ? <span className="card-label block lg:hidden">{columns[index]}</span> : null}{cell}</td>)}</tr>)}</tbody></table>;
}

// SupervisorRecord now lives in src/types.

interface SupervisorAppointmentManagementProps {
  providedRecord?:SupervisorRecord;
  onProvidedRecordRefresh?:()=>Promise<unknown>|void;
  administrationMode?:boolean;
  backLabel?:string;
  routeView?: 'list' | 'detail' | 'workload' | 'teams' | 'teamDetail';
  routeRecordId?: string;
  routeTeamStudentId?: string;
  onNavigateToTeam?: (studentId: string) => void;
  onNavigateToTeams?: () => void;
  onNavigateToList?: () => void;
  onNavigateToWorkload?: () => void;
  onNavigateToRecord?: (recordId: string) => void;
  onNavigateToDossier?: (studentId: string) => void;
  onNavigateToPanelRequest?: (id:string,recordKey?:string)=>void;
  onNavigateToRequirements?: () => void;
  onOpenCapacity?: () => void;
}

export const SupervisorAppointmentManagement: React.FC<SupervisorAppointmentManagementProps> = props => (
  <DecisionFeedbackProvider scopeKey="supervisor-management"><SupervisorAppointmentManagementContent {...props}/></DecisionFeedbackProvider>
);

const SupervisorAppointmentManagementContent: React.FC<SupervisorAppointmentManagementProps> = ({
  routeView = 'list',providedRecord,onProvidedRecordRefresh,administrationMode=false,backLabel='Back to Appointment requests',
  routeRecordId, routeTeamStudentId, onNavigateToTeam, onNavigateToTeams,
  onNavigateToList,
  onNavigateToWorkload,
  onNavigateToRecord,
  onNavigateToDossier, onNavigateToPanelRequest,
  onNavigateToRequirements,
  onOpenCapacity,
}) => {
  const publishFeedback = useDecisionFeedback()!;
  const [primaryReplacement,setPrimaryReplacement]=useState<{appointmentId:number;studentId:string}|null>(null);
  const [replacementNotice,setReplacementNotice]=useState<string|null>(null);
  useEffect(()=>{setPrimaryReplacement(null);setReplacementNotice(null);},[routeTeamStudentId,routeView,routeRecordId,providedRecord?.studentId]);

  // Supervisor appointment records are loaded from the persisted Django API.
  const [records, setRecords] = useState<SupervisorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback((strict=false) => {
    if(routeView==='teamDetail'||routeView==='teams'||routeView==='workload'){setLoading(false);return;}
    if(providedRecord){setRecords([providedRecord]);setLoading(false);return;}
    if(!strict){setLoading(true);setError(null);}
    return getSupervisorAppointments()
      .then(setRecords)
      .catch((e)=>{if(strict)throw e;setError(e instanceof Error?e.message:'Failed to load supervisor appointments.');})
      .finally(() => setLoading(false));
  }, [providedRecord,routeView]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Filters State
  const [searchQuery, setSearchQuery] = useListState('SupervisorAppointmentManagement', 'searchQuery', '');
  const [programmeFilter, setProgrammeFilter] = useListState('SupervisorAppointmentManagement', 'programmeFilter', 'All Programmes');
  const [semesterFilter, setSemesterFilter] = useListState('SupervisorAppointmentManagement', 'semesterFilter', 'All Semesters');

  // Tab/status filter state
  const [activeTab, setActiveTab] = useListState<'All Records' | 'No Supervisor' | 'Pending' | 'Approved' | 'Ended' | 'Rejected' | 'Cancelled' | 'Workload Alert'>('SupervisorAppointmentManagement', 'activeTab', 'All Records');

  // Applied filter state
  const [appliedSearch, setAppliedSearch] = useListState('SupervisorAppointmentManagement', 'appliedSearch', '');
  const [appliedProg, setAppliedProg] = useListState('SupervisorAppointmentManagement', 'appliedProg', 'All Programmes');
  const [appliedSem, setAppliedSem] = useListState('SupervisorAppointmentManagement', 'appliedSem', 'All Semesters');
  const [sortOrder, setSortOrder] = useListState<'default' | 'longestWaiting'>('SupervisorAppointmentManagement', 'sortOrder', 'default');

  // Pagination State
  const [currentPage, setCurrentPage] = useListState('SupervisorAppointmentManagement', 'currentPage', 1);
  const [itemsPerPage, setItemsPerPage] = useListState('SupervisorAppointmentManagement', 'size', 10);
  const [teamRefresh, setTeamRefresh] = useState(0);
  const [teamBusy, setTeamBusy] = useState(false);
  const [carryBusy, setCarryBusy] = useState(false);
  const refresh = () => { if (routeView !== 'teams') loadRecords(); setTeamRefresh(value => value + 1); };

  const handleApplyFilters = () => {
    setAppliedSearch(searchQuery);
    setAppliedProg(programmeFilter);
    setAppliedSem(semesterFilter);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setProgrammeFilter('All Programmes');
    setSemesterFilter('All Semesters');
    setAppliedSearch('');
    setAppliedProg('All Programmes');
    setAppliedSem('All Semesters');
    setActiveTab('All Records');
    setSortOrder('default');
    setCurrentPage(1);
  };

  // Process filters
  const filteredRecords = useMemo(() => filterOfficeSupervisorRecords(records, { search: appliedSearch, programme: appliedProg, semester: appliedSem, status: activeTab }), [records, appliedSearch, appliedProg, appliedSem, activeTab]);

  const orderedFilteredRecords = useMemo(
    () => sortOrder === 'longestWaiting'
      ? orderSupervisorQueueOldestFirst(filteredRecords)
      : filteredRecords,
    [filteredRecords, sortOrder],
  );

  // Paginated records helper
  const paginatedRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return orderedFilteredRecords.slice(startIdx, startIdx + itemsPerPage);
  }, [orderedFilteredRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  useEffect(() => { if (!loading && !error) setCurrentPage(current => Math.min(current, totalPages)); }, [totalPages, loading, error, setCurrentPage]);
  const recordSummary = useMemo(() => getSupervisorRecordSummary(records), [records]);
  const longestWaitingText = recordSummary.longestWaiting
    ? formatSupervisorWaiting(recordSummary.longestWaiting)
    : '-';
  const selectedRouteRecord = useMemo(
    () => findSupervisorRecordByRouteKey(records, routeRecordId),
    [records, routeRecordId],
  );
  const navigateToList = onNavigateToList ?? (() => undefined);

  // Handles export interaction
  const excel = useExcelExport();
  const handleExportData = async () => {
    if (!orderedFilteredRecords.length) {
      publishFeedback('No supervisor appointment records match the current filters.', 'info');
      return;
    }
    const exported = await excel.download('supervisor_appointments_report.xlsx', orderedFilteredRecords, [
      { header: 'Student ID', value: (record) => record.studentId },
      { header: 'Student Name', value: (record) => record.studentName },
      { header: 'Programme', value: (record) => record.programme },
      { header: 'Supervisor', value: (record) => record.supervisor },
      { header: 'Status', value: (record) => record.status },
      { header: 'Waiting Since', value: (record) => record.waitingSince || '' },
      { header: 'Waiting Days', value: (record) => record.waitingDays ?? '' },
      { header: 'Waiting On', value: (record) => record.waitingOn || '' },
      { header: 'Appointment Status', value: (record) => record.appointmentLifecycle?.status || '' },
      { header: 'End Outcome', value: (record) => record.appointmentLifecycle?.endOutcome || '' },
      { header: 'End Reason', value: (record) => record.appointmentLifecycle?.endReason || '' },
      { header: 'Ended At', value: (record) => record.appointmentLifecycle?.endedAt || '' },
      { header: 'Ended By', value: (record) => record.appointmentLifecycle?.endedBy || '' },
      { header: 'Supersedes Appointment ID', value: (record) => record.appointmentLifecycle?.supersedesAppointmentId ?? '' },
      { header: 'Replacement Appointment ID', value: (record) => record.appointmentLifecycle?.replacementAppointmentId ?? '' },
      { header: 'Requested Replacement Appointment ID', value: (record) => record.replacesAppointmentId ?? '' },
      { header: 'Replacement Reason', value: (record) => record.replacementReason || '' },
      { header: 'Updated Date', value: (record) => record.updatedDate },
    ]);
    if (!exported) return;
    publishFeedback(`supervisor_appointments_report.xlsx prepared with ${orderedFilteredRecords.length} records. Check your browser downloads.`, 'info');
  };

  if (routeView === 'workload') {
    return (
      <SupervisorWorkloadMonitoring backLabel={backLabel} onBack={navigateToList} onOpenCapacity={onOpenCapacity} />
    );
  }

  if (routeView === 'detail') {
    if (loading) {
      return <RecordPage title={providedRecord?"Appointment request":"Appointment record"} backLabel={backLabel} onBack={navigateToList}><LoadingState message="Loading supervisor appointment record…" /></RecordPage>;
    }

    if (error) {
      return <RecordPage title={providedRecord?"Appointment request":"Appointment record"} backLabel={backLabel} onBack={navigateToList}><ErrorState message={error} onRetry={loadRecords} /></RecordPage>;
    }

    if (!selectedRouteRecord) {
      return (
        <RecordPage title={providedRecord?"Appointment request":"Appointment record"} backLabel={backLabel} onBack={navigateToList}><EmptyState
          title="Supervisor appointment record not found"
          description="The requested supervisor appointment record does not exist or is no longer available."
        /></RecordPage>
      );
    }

    const r = selectedRouteRecord;
    if(primaryReplacement?.studentId===r.studentId&&primaryReplacement.appointmentId===r.appointmentLifecycle?.appointmentId)return <OfficeSupervisorReplacementForm
      appointmentId={primaryReplacement.appointmentId} backLabel="Back to appointment request" onBack={()=>setPrimaryReplacement(null)}
      onSubmitted={()=>{
        setPrimaryReplacement(null);setReplacementNotice('Replacement requested. The proposed supervisor will review it next.');setTeamRefresh(value=>value+1);
        Promise.resolve(providedRecord?onProvidedRecordRefresh?.():loadRecords(true)).catch(()=>publishFeedback('Replacement requested, but the record could not be refreshed. Reload to check its status.', 'warning'));
      }}/>;
    const request=officeRequestPresentation(r);
    const hasRequest=r.applicationId!=null||!!r.workflow?.length;
    const ended=r.status==='Ended'||r.appointmentLifecycle?.status==='ENDED';
    const administration=<OfficeAppointmentAdministration record={r} refreshVersion={teamRefresh}
      onChange={r.appointmentLifecycle?.status==='ACTIVE'?()=>{setReplacementNotice(null);setPrimaryReplacement({appointmentId:r.appointmentLifecycle!.appointmentId,studentId:r.studentId});}:undefined} onEnd={async(outcome,reason)=>{
      return await completeDecision(()=>endSupervisorAppointment(r.appointmentLifecycle!.appointmentId,outcome,reason),async()=>{
        if(providedRecord)await onProvidedRecordRefresh?.();else await loadRecords(true);
      });
    }}/>;
    return <RecordPage title={ended?'Supervisor appointment record':hasRequest?'Appointment request':'Supervision record'}
      metadata={<RequestMetadata {...supervisorRequestMetadata(request)} statusLabel={ended?'Appointment ended':hasRequest?supervisorRequestMetadata(request).statusLabel:r.status} statusTone={ended||!hasRequest?'neutral':supervisorRequestMetadata(request).statusTone}/>}
      backLabel={backLabel} onBack={navigateToList}>
      {replacementNotice?<p role="status" className="card-description rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{replacementNotice}</p>:null}
      <SupervisorRequestDetail request={request} showApproval={hasRequest} contextAction={onNavigateToDossier?<ViewStudentRecordAction studentId={r.studentId} onOpen={onNavigateToDossier}/>:undefined} administration={administration}/>
    </RecordPage>;
  }

  if (routeView === 'teamDetail' && primaryReplacement?.studentId===routeTeamStudentId) return <OfficeSupervisorReplacementForm appointmentId={primaryReplacement.appointmentId} onBack={()=>setPrimaryReplacement(null)} onSubmitted={()=>{setPrimaryReplacement(null);setReplacementNotice('Replacement requested. The proposed supervisor will review it next.');setTeamRefresh(value=>value+1);}}/>;
  if (routeView === 'teamDetail') return <RecordPage title="Supervision details" backLabel="Back to Supervisory teams" onBack={onNavigateToTeams ?? navigateToList}>
    {replacementNotice?<p role="status" className="card-description rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{replacementNotice}</p>:null}
    <SupervisoryTeamManagement role="Office Staff/Admin" view="detail" routeStudentId={routeTeamStudentId} onNavigateToApplication={onNavigateToRecord?id=>onNavigateToRecord(`request-${id}`):undefined} onNavigateToDossier={onNavigateToDossier} onNavigateToPanelRequest={onNavigateToPanelRequest} showResearchChanges={false} showRefresh={false} refreshVersion={teamRefresh}
      onChangePrimarySupervisor={routeTeamStudentId?appointmentId=>{setReplacementNotice(null);setPrimaryReplacement({appointmentId,studentId:routeTeamStudentId});}:undefined}/>
  </RecordPage>;
  const programmes = [...new Set(records.map(row => row.programme).filter(Boolean))];
  const semesters = [...new Set(records.map(row => row.semester).filter((value): value is string => !!value))];
  return <div id="supervisor-mgmt-viewport" className="space-y-6 text-left font-sans pb-12">
    {!administrationMode?<PageHeader title="Supervisor Appointments" subtitle="Monitor appointment records, manage supervisory teams and follow research changes."  />:null}
    {!administrationMode?<SupervisorWorkspaceNavigation role="Office Staff/Admin" />:null}
    {routeView === 'teams' ? <SupervisoryTeamManagement role="Office Staff/Admin" view="roster" showResearchChanges={false} showRefresh={false} refreshVersion={teamRefresh} onBusyChange={setTeamBusy} onNavigateToStudent={onNavigateToTeam} /> : <>
      {!loading && !error ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AppointmentSummaryCard icon={UserX} title="Without supervisor" value={recordSummary.withoutSupervisor} description="Students without an approved supervisor." />
        <AppointmentSummaryCard icon={FileText} title="Pending records" value={recordSummary.pending} description="Appointments awaiting a recorded decision." />
        <AppointmentSummaryCard icon={CheckCircle} title="Approved supervisors" value={recordSummary.approved} description="Active approved appointments." />
        <AppointmentSummaryCard icon={AlertTriangle} title="Workload alerts" value={recordSummary.workloadAlerts} description="Lecturers near their supervision limit." />
      </div> : null}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Appointment records">
        {excel.error ? <p role="alert" className="card-description text-rose-700">{excel.error}</p> : null}
        <WorkspaceSectionHeader title="Appointment records" description="View appointment records across students and lecturers." actions={<><PortalButton size="sm" disabled={loading || !!error} variant="primary" isLoading={excel.busy} onClick={()=>void handleExportData()}>Export Excel</PortalButton><PortalButton size="sm" onClick={onNavigateToRequirements}>Document requirements</PortalButton><PortalButton size="sm" onClick={onNavigateToWorkload}>View workload</PortalButton></>} />
        <RequestFilters onReset={handleResetFilters} search={searchQuery} onSearch={setSearchQuery} searchLabel="Find a record" searchPlaceholder="Student name, matric number, supervisor or research title">
          <label className="form-label">Programme<PortalSelect className="form-control form-control-sm mt-1" value={programmeFilter} onChange={event => setProgrammeFilter(event.target.value)}><option>All Programmes</option>{programmes.map(value => <option key={value}>{value}</option>)}</PortalSelect></label>
          <label className="form-label">Semester<PortalSelect className="form-control form-control-sm mt-1" value={semesterFilter} onChange={event => setSemesterFilter(event.target.value)}><option>All Semesters</option>{semesters.map(value => <option key={value}>{value}</option>)}</PortalSelect></label>
          <label className="form-label">Status<PortalSelect className="form-control form-control-sm mt-1" value={activeTab} onChange={event => { setActiveTab(event.target.value as typeof activeTab); setCurrentPage(1); }}>{(['All Records','No Supervisor','Pending','Approved','Ended','Rejected','Cancelled','Workload Alert'] as const).map(value => <option key={value}>{value}</option>)}</PortalSelect></label>
          <label className="form-label">Sort<PortalSelect className="form-control form-control-sm mt-1" value={sortOrder} onChange={event => { setSortOrder(event.target.value as typeof sortOrder); setCurrentPage(1); }}><option value="default">Default order</option><option value="longestWaiting">Longest waiting</option></PortalSelect></label>
          <div className="flex items-end gap-2"><PortalButton size="sm" variant="primary" onClick={handleApplyFilters}>Apply filters</PortalButton></div>
        </RequestFilters>
        {loading ? <LoadingState message="Loading appointment records…" /> : error ? <ErrorState message={error} onRetry={loadRecords} /> : <>
          {paginatedRecords.length ? <OfficeSupervisorRecordTable records={paginatedRecords} onOpen={record => onNavigateToRecord?.(record.applicationId!=null?`request-${record.applicationId}`:supervisorRecordRouteKey(record))} onDossier={record => onNavigateToDossier?.(record.studentId)} /> : <EmptyState title="No matching records" description="Adjust the filters to see more records." />}
          <WorkspacePagination page={currentPage} pageCount={totalPages} total={filteredRecords.length} noun="records" pageSize={itemsPerPage} onPage={setCurrentPage} onPageSize={value => { setItemsPerPage(value); setCurrentPage(1); }} />
        </>}
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Records needing attention"><WorkspaceSectionHeader title="Records needing attention" description={`Longest waiting: ${longestWaitingText}`} /><div className="flex flex-wrap gap-2">{(['No Supervisor','Pending','Workload Alert'] as const).map(value => <PortalButton key={value} size="sm" onClick={() => { setActiveTab(value); setCurrentPage(1); }}>{value === 'No Supervisor' ? 'View students without supervisor' : value === 'Pending' ? 'View pending records' : 'View workload alerts'}</PortalButton>)}</div></section>
      {!administrationMode?<CapacityReassessments role="Office Staff/Admin" showRefresh={false} refreshVersion={teamRefresh} onBusyChange={setCarryBusy} onChanged={loadRecords} />:null}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><WorkspaceSectionHeader title="Appointment guidance" /><p className="card-description">Submission document requirements are configured centrally and recorded when each application is created.</p><PortalButton size="sm" onClick={onNavigateToRequirements}>Manage document requirements</PortalButton></section>
    </>}
  </div>;
};
