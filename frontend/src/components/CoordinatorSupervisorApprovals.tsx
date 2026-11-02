import { DecisionDialog } from './DecisionDialog';
import { completeDecision } from '../utils/decisionSubmission';
import { RecordPage } from './RecordPage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UserRound, CheckCircle2 } from 'lucide-react';
import {
  ApiError,
  approveSupervisorApplicationByCoordinator,
  getCoordinatorSupervisorRecords,
  getCoordinatorSupervisorHistory,
  getSupervisorApplication,
  getCoordinatorSupervisorQueue,
  orderSupervisorQueueOldestFirst,
  rejectSupervisorApplicationByCoordinator,
  endSupervisorAppointment,
} from '../services';
import { type AppointmentEndOutcome, type SupervisorApplicationRecord } from '../types';
import { PageHeader, PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { ErrorState, LoadingState } from './StateViews';
import { SupervisorRequestDetail, supervisorRequestMetadata, toSupervisorRequestPresentation } from './SupervisorRequestDetail';
import { PrimaryRequestDecisionButtons, RequestMetadata, ViewStudentRecordAction, readableRecordStatus } from './RequestDetailPrimitives';
import { SupervisorAppointmentRecordCard, toCoordinatorAppointmentPresentation } from './SupervisorAppointmentRecordCard';
import { AppointmentEndControl } from './AppointmentEndControl';
import { CoSupervisorNominationCard, supportingRequestMetadata, SupervisoryTeamManagement } from './SupervisoryTeamManagement';
import { decideCoSupervisor, getSupervisoryWorkspace } from '../services/coSupervisionApi';
import type { CoSupervisorAction, CoSupervisorNomination } from '../types/coSupervision';
import { requestGroup, requestStatusLabel, requestWaitingDays } from '../utils/lecturerRequests';
import { RequestViewSwitch, RequestFilters, WorkspaceSectionHeader, WorkspaceRecordTable, WorkspacePagination, workspacePageSize, type RequestListView } from './RequestWorkspacePrimitives';
import { SupervisorWorkspaceNavigation } from './SupervisorWorkspaceNavigation';
import { useListState } from './ListState';
import { CapacityReassessments } from './CapacityReassessments';
import { nextCoordinatorRequest, type NextCoordinatorRequest } from '../utils/coordinatorQueue';
import { getCoordinatorTeam, getCoordinatorSupportingRequest, getCoordinatorPrimaryRequest, getCoordinatorRequests, type CoordinatorRequestRow as CoordinatorBrowseRequestRow } from '../services/coordinatorWorkspaceApi';

type CoordinatorRequestRow = { key: string; id: number; kind: 'primary' | 'supporting'; studentName: string; matricNo: string; status: string; submittedAt: string; waitingDays: number | null; canDecide: boolean; searchText: string };
function coordinatorRequestRows(queue: SupervisorApplicationRecord[], history: SupervisorApplicationRecord[], nominations: CoSupervisorNomination[]): CoordinatorRequestRow[] {
  return [...new Map<string, CoordinatorRequestRow>([
    ...[...queue, ...history].map(record => [`primary-${record.id}`, {
      key: `primary-${record.id}`, id: record.id, kind: 'primary' as const, studentName: record.studentName, matricNo: record.studentId,
      status: record.status, submittedAt: record.submittedAt, waitingDays: record.waitingDays ?? requestWaitingDays(record.waitingSince || record.supervisorDecisionAt || record.submittedAt),
      canDecide: record.status === 'PENDING_COORDINATOR' && record.participantEligible !== false,
      searchText: `${record.studentName} ${record.studentId} ${record.proposedSupervisor} ${record.researchTitle} ${record.id} SV-REQ-${String(record.id).padStart(5, '0')}`,
    }] as const),
    ...nominations.map(record => [`supporting-${record.id}`, {
      key: `supporting-${record.id}`, id: record.id, kind: 'supporting' as const, studentName: record.studentName, matricNo: record.matricNo,
      status: record.status, submittedAt: record.submittedAt, waitingDays: record.waitingDays ?? requestWaitingDays(record.waitingSince || record.submittedAt),
      canDecide: record.allowedActions.some(action => action !== 'cancel'),
      searchText: `${record.studentName} ${record.matricNo} ${record.candidate.name} ${record.nominator.name} ${record.justification} ${record.id}`,
    }] as const),
  ]).values()].sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
}

export function CoordinatorPrimaryRequestActions({ record, pending, busy, isRejecting, onAction }: {
  record: SupervisorApplicationRecord; pending: boolean; busy: boolean; isRejecting: boolean;
  onAction: (action: 'approve' | 'reject') => void;
}) {
  return <div className="space-y-4">
    {pending ? <PrimaryRequestDecisionButtons positiveLabel="Approve request" disabled={busy || record.participantEligible === false}
      positiveDisabled={isRejecting}
      onPositive={()=>onAction('approve')} onReject={()=>onAction('reject')}/> : null}
    {record.participantEligible === false ? <p className="card-description mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
      This Student is {record.participantLifecycleStatus?.toLowerCase()}; the approval remains visible but is non-actionable until eligible.
    </p> : null}
  </div>;
}

export function CoordinatorAppointmentRequestList({ queue, history, nominations, view, search = '', type = 'all', status = '', page = 1, pageSize: requestedSize = 10, onOpen,
  onView = () => {}, onSearch = () => {}, onType = () => {}, onStatus = () => {}, onPage = () => {}, onPageSize = () => {}, disabled = false,
}: {
  queue: SupervisorApplicationRecord[]; history: SupervisorApplicationRecord[]; nominations: CoSupervisorNomination[];
  view: RequestListView; search?: string; type?: string; status?: string; page?: number; pageSize?: number; disabled?: boolean;
  onOpen: (id: number, kind: 'primary' | 'supporting') => void; onView?: (view: RequestListView) => void; onSearch?: (value: string) => void;
  onType?: (value: string) => void; onStatus?: (value: string) => void; onPage?: (value: number) => void; onPageSize?: (value: number) => void;
}) {
  const all = coordinatorRequestRows(queue, history, nominations);
  const partition = all.filter(row => (requestGroup(row.status, row.canDecide) === 'history') === (view === 'history'));
  const visible = partition.filter(row => (type === 'all' || row.kind === type) && (!status || row.status === status) && row.searchText.toLowerCase().includes(search.trim().toLowerCase()));
  if (view === 'history') visible.reverse();
  else visible.sort((a, b) => Number(b.canDecide) - Number(a.canDecide));
  const size = workspacePageSize(requestedSize), pageCount = Math.max(1, Math.ceil(visible.length / size));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  return <section className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white">
    <WorkspaceSectionHeader title="Appointment requests" description="Review primary and supporting requests in your managed programmes, or view their final outcomes."
      actions={<RequestViewSwitch view={view} reviewCount={all.filter(row => row.canDecide).length} onChange={onView} />} />
    <RequestFilters search={search} onSearch={onSearch} type={type} onType={onType} status={status} onStatus={onStatus} statuses={[...new Set(partition.map(row => row.status))]} />
    {visible.length ? <WorkspaceRecordTable history={view === 'history'} label="Coordinator appointment request records" rows={visible.slice((currentPage - 1) * size, currentPage * size).map(row => ({
      key: row.key, studentName: row.studentName, matricNo: row.matricNo, kind: row.kind === 'primary' ? 'Primary supervisor' : 'Supporting supervisor',
      submittedAt: row.submittedAt, status: requestStatusLabel(row.status, row.canDecide), workflowStatus: row.status, waitingDays: row.waitingDays, waitingApplicable: view !== 'history',
      actionLabel: row.canDecide ? 'Review request' : 'View request', onOpen: () => onOpen(row.id, row.kind), disabled,
      actionAriaLabel: `${row.canDecide ? 'Review' : 'View'} ${row.kind} request for ${row.studentName}`,
    }))} /> : <p className="card-description py-6 text-center">{search || status || type !== 'all' ? 'No matching requests.' : view === 'history' ? 'No final request outcomes are recorded.' : 'No ongoing appointment requests.'}</p>}
    <WorkspacePagination page={currentPage} pageCount={pageCount} total={visible.length} noun="requests" pageSize={size} onPage={onPage} onPageSize={onPageSize} />
  </section>;
}

export function CoordinatorAppointmentLifecycleRecords({records,detail=false,onOpen,onNavigateToDossier,onEnd}: {
  records:SupervisorApplicationRecord[];detail?:boolean;onOpen:(id:number)=>void;onNavigateToDossier?:(matricNo:string)=>void;
  onEnd:(record:SupervisorApplicationRecord,outcome:Exclude<AppointmentEndOutcome,'REPLACED'>,reason:string)=>ReturnType<NonNullable<React.ComponentProps<typeof SupervisorAppointmentRecordCard>['onEnd']>>;
}) {
  if(detail)return <div className="space-y-4">{records.map(record=><SupervisorAppointmentRecordCard key={record.id} record={toCoordinatorAppointmentPresentation(record)}
    onEnd={record.appointmentLifecycle?.status==='ACTIVE'?(outcome,reason)=>onEnd(record,outcome,reason):undefined}
    actions={onNavigateToDossier?<ViewStudentRecordAction studentId={record.studentId} onOpen={onNavigateToDossier}/>:undefined}/>)}</div>;
  return <section className="space-y-4"><WorkspaceSectionHeader title="Programme Appointment Records" description="Active and ended Supervisor appointments in your managed programme."/>
    {records.length?<div className="space-y-3">{records.map(record=><div key={record.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><div className="flex items-center gap-2 flex-wrap"><p className="card-value text-brand-navy">{record.studentName}</p><StatusBadge tone={record.appointmentLifecycle?.status==='ACTIVE'?'success':'neutral'}>{record.appointmentLifecycle?.status==='ACTIVE'?'Active':readableRecordStatus(record.appointmentLifecycle?.endOutcome||'ENDED')}</StatusBadge></div>
        <p className="card-description mt-1">{record.studentId} · {record.proposedSupervisor}</p>{record.appointmentLifecycle?.endReason?<p className="card-description mt-2">{record.appointmentLifecycle.endReason}</p>:null}</div>
      <PortalButton onClick={()=>onOpen(record.id)}>View appointment</PortalButton>
    </div>)}</div>:<p className="card-description rounded-xl border border-slate-200 bg-white p-6">No approved Supervisor appointments are recorded for this programme.</p>}
  </section>;
}

export function CoordinatorApplicationLifecycle({record,onNavigateToDossier,onEnd}: {
  record:SupervisorApplicationRecord;onNavigateToDossier?:(matricNo:string)=>void;onEnd:React.ComponentProps<typeof CoordinatorAppointmentLifecycleRecords>['onEnd'];
}) {
  return record.status==='APPROVED'&&record.appointmentLifecycle?<SupervisorAppointmentRecordCard compact record={toCoordinatorAppointmentPresentation(record)}
    onEnd={record.appointmentLifecycle.status==='ACTIVE'?(outcome,reason)=>onEnd(record,outcome,reason):undefined}
    actions={onNavigateToDossier?<ViewStudentRecordAction studentId={record.studentId} onOpen={onNavigateToDossier}/>:undefined}/>:null;
}

interface CoordinatorSupervisorApprovalsProps {
  initialApplicationId?: string;
  initialSupportingId?: string;
  workspaceView?: 'requests' | 'teams';
  refreshVersion?: number;
  showHeader?: boolean;
  onBusyChange?: (busy: boolean) => void;
  routeTeamStudentId?: string;
  onNavigateToTeam?: (matricNo: string) => void;
  onNavigateToSupportingRequest?: (id: string) => void;
  onNavigateToList?: () => void;
  onNavigateToApplication?: (id: string) => void;
  onNavigateToDossier?: (studentId: string) => void;
  onNavigateToPanelRequest?: (id:string,recordKey?:string)=>void;
  backLabel?: string;
}

export const CoordinatorSupervisorApprovals: React.FC<CoordinatorSupervisorApprovalsProps> = ({
  initialApplicationId,
  initialSupportingId,
  workspaceView = 'requests',
  refreshVersion = 0,
  showHeader = true,
  onBusyChange,
  routeTeamStudentId,
  onNavigateToTeam,
  onNavigateToSupportingRequest,
  onNavigateToList = () => {},
  onNavigateToApplication,
  onNavigateToDossier, onNavigateToPanelRequest,
  backLabel = 'Back to Appointment requests',
}) => {
  const [records, setRecords] = useState<SupervisorApplicationRecord[]>([]);
  const [appointmentRecords, setAppointmentRecords] = useState<SupervisorApplicationRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<SupervisorApplicationRecord[]>([]);
  const [nominations, setNominations] = useState<CoSupervisorNomination[]>([]);
  const [localApplicationId, setLocalApplicationId] = useState<string>();
  const [localSupportingId, setLocalSupportingId] = useState<string>();
  const [localAppointmentId, setLocalAppointmentId] = useState<number>();
  const applicationId = initialApplicationId ?? localApplicationId;
  const supportingId = initialSupportingId ?? localSupportingId;
  const [supportingAction, setSupportingAction] = useState<CoSupervisorAction | null>(null);
  const [supportingReason, setSupportingReason] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);
  const [capacityBusy, setCapacityBusy] = useState(false);
  const [view, setView] = useListState<RequestListView>('coordinator-supervisor', 'view', 'requests');
  const [search, setSearch] = useListState('coordinator-supervisor', 'search', '');
  const [type, setType] = useListState('coordinator-supervisor', 'type', 'all');
  const [status, setStatus] = useListState('coordinator-supervisor', 'status', '');
  const [page, setPage] = useListState('coordinator-supervisor', 'page', 1);
  const [pageSize, setPageSize] = useListState('coordinator-supervisor', 'size', 10);
  const [nextRequest, setNextRequest] = useState<NextCoordinatorRequest | null>(null);
  const retainedNext = useRef<NextCoordinatorRequest | null>(null);
  const focus = 'decision';
  const [programme] = useListState('coordinator-supervisor', 'programme', '');
  const [semester] = useListState('coordinator-supervisor', 'semester', '');
  const [from] = useListState('coordinator-supervisor', 'from', '');
  const [to] = useListState('coordinator-supervisor', 'to', '');
  const [sort] = useListState('coordinator-supervisor', 'sort', 'waiting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rejectingRecordId, setRejectingRecordId] = useState<number | string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [primaryDecision, setPrimaryDecision] = useState<{record: SupervisorApplicationRecord; action: 'approve' | 'reject'} | null>(null);
  const [selected, setSelected] = useState<SupervisorApplicationRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [teamRefreshVersion, setTeamRefreshVersion] = useState(0);
  const recordsVersion = useRef(0);

  const loadRecords = useCallback(async (strict = false, background = false) => {
    const version = ++recordsVersion.current;
    if (!background) { setLoading(true); setError(null); }
    try {
      if (applicationId || supportingId) {
        const params = {view, q:search, type, status, page, size:pageSize, focus, programme, semester, from, to, sort};
        const currentKey = `${supportingId ? 'supporting' : 'primary'}-${supportingId || applicationId}`;
        const [detail, nomination, following] = await Promise.all([
          applicationId ? getCoordinatorPrimaryRequest(applicationId) : Promise.resolve(null),
          supportingId ? getCoordinatorSupportingRequest(supportingId) : Promise.resolve(null),
          backLabel === 'Back to Appointment requests' ? nextCoordinatorRequest(params,currentKey).catch(() => null) : Promise.resolve(null),
        ]);
        let next = following;
        if (!next && retainedNext.current && backLabel === 'Back to Appointment requests') {
          const snapshot = await getCoordinatorRequests(params).catch(() => null);
          const successor = snapshot?.results.find(row => row.key === retainedNext.current?.key);
          next = successor && snapshot ? {...successor,queuePage:snapshot.page} : null;
        }
        if (version === recordsVersion.current) { setSelected(detail);setRecords(detail?.canDecide ? [detail] : []);setNominations(nomination ? [nomination] : []);setNextRequest(next); }
      } else if (routeTeamStudentId) {
        const workspace = await getCoordinatorTeam(routeTeamStudentId);
        if (version === recordsVersion.current) { setAppointmentRecords(workspace.primaryApplication?.appointmentLifecycle ? [workspace.primaryApplication] : []); setSelected(null); }
      } else {
        // Compatibility for embedded callers; routed Coordinator browse uses paginated APIs.
        const [queue, appointments, history, workspace] = await Promise.all([
          getCoordinatorSupervisorQueue(), getCoordinatorSupervisorRecords(), getCoordinatorSupervisorHistory(), getSupervisoryWorkspace(),
        ]);
        if (version === recordsVersion.current) {setRecords(orderSupervisorQueueOldestFirst(queue));setAppointmentRecords(appointments);setHistoryRecords(history);setNominations(workspace.nominations);setSelected(null);}
      }
    } catch (reason) {
      if (!background && version === recordsVersion.current) setError(
        reason instanceof Error ? reason.message : 'Failed to load supervisor approvals.',
      );
      if (strict) throw reason;
    } finally {
      if (!background && version === recordsVersion.current) setLoading(false);
    }
  }, [applicationId, supportingId, routeTeamStudentId, view, search, type, status, page, pageSize, focus, programme, semester, from, to, sort, backLabel]);

  useEffect(() => {
    void loadRecords();
    return () => { recordsVersion.current += 1; };
  }, [loadRecords, refreshVersion, supportingId, workspaceView, routeTeamStudentId]);

  useEffect(() => { retainedNext.current = null; setRejectingRecordId(null); setRejectionReason(''); setSupportingAction(null); setSupportingReason(''); setPrimaryDecision(null); }, [applicationId, supportingId]);
  const workspaceBusy = loading || busy || teamBusy || capacityBusy || !!rejectionReason.trim() || !!supportingReason.trim();
  useEffect(() => { onBusyChange?.(workspaceBusy); }, [onBusyChange, workspaceBusy]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  const supporting = nominations.find(row => String(row.id) === supportingId);
  const decidePrimary = async () => {
    if (!primaryDecision || busyRef.current || (primaryDecision.action === 'reject' && !rejectionReason.trim())) return false;
    busyRef.current = true; setBusy(true);
    const { record, action } = primaryDecision;
    try {
      let approved:SupervisorApplicationRecord|undefined;
      const outcome=await completeDecision(async()=>{
        if(action==='approve')approved=await approveSupervisorApplicationByCoordinator(record.id);
        else await rejectSupervisorApplicationByCoordinator(record.id,rejectionReason.trim());
      },async()=>{retainedNext.current=nextRequest;await loadRecords(true);setTeamRefreshVersion(current=>current+1);});
      return {...outcome,successMessage:action==='reject'?'Supervisor appointment request rejected.':approved?.researchProfileReady?'Supervisor appointment approved. The research profile is ready for Panel recommendation.':'Supervisor appointment approved.'};
    }
    finally { busyRef.current = false; setBusy(false); }
  };
  const decideSupporting = async () => {
    if (!supporting || !supportingAction || !supporting.allowedActions.includes(supportingAction) || busyRef.current || (!['approve', 'accept'].includes(supportingAction) && !supportingReason.trim())) return false;
    busyRef.current = true; setBusy(true);
    try { return await completeDecision(() => decideCoSupervisor(supporting.id, supportingAction, supportingReason.trim()), async () => { retainedNext.current = nextRequest; await loadRecords(true); setTeamRefreshVersion(current => current + 1); }); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const primaryLabel = primaryDecision?.action === 'approve' ? 'Approve supervisor appointment' : 'Reject supervisor appointment';
  const supportingLabel = supportingAction === 'approve' ? 'Approve supporting appointment' : supportingAction === 'accept' ? 'Accept supporting request' : supportingAction === 'cancel' ? 'Cancel supporting nomination' : 'Reject supporting request';
  const decisionDialogs = <>
    <DecisionDialog isOpen={!!primaryDecision} decisionKey={primaryDecision?.record.id} title={primaryLabel} confirmLabel={primaryLabel} tone={primaryDecision?.action==='reject'?'danger':'info'}
      context={<p>{primaryDecision?.record.studentName} · {primaryDecision?.record.studentId} · {primaryDecision?.record.programme}</p>}
      message={primaryDecision?.action === 'approve' ? 'Approval confirms the primary supervisor appointment and prepares the research profile for Panel recommendation.' : 'The appointment request will be rejected and your reason recorded.'}
      busy={busy} dirty={!!rejectionReason.trim()} canConfirm={primaryDecision?.action === 'approve' || !!rejectionReason.trim()} successMessage="Supervisor appointment decision recorded."
      onClose={() => { setPrimaryDecision(null); setRejectingRecordId(null); setRejectionReason(''); }} onConfirm={decidePrimary} onReload={() => loadRecords(true)}>
      {primaryDecision?.action === 'reject' ? <label className="form-label block">Rejection reason (required)<textarea required className="form-control mt-2" value={rejectionReason} disabled={busy} onChange={event => setRejectionReason(event.target.value)} /></label> : null}
    </DecisionDialog>
    <DecisionDialog isOpen={!!supportingAction} decisionKey={supporting?.id} title={supportingLabel} confirmLabel={supportingLabel} kind={supportingAction==='cancel'?'confirmation':'review'} tone={supportingAction&&['accept','approve'].includes(supportingAction)?'info':'danger'}
      context={<p>{supporting?.studentName} · {supporting?.matricNo} · {supporting?.programme}</p>}
      message={supportingAction === 'accept' ? 'Acceptance forwards this request to the Programme Coordinator.' : supportingAction === 'approve' ? 'Approval confirms the supporting appointment after eligibility and capacity checks.' : supportingAction === 'cancel' ? 'This nomination will be cancelled.' : 'This supporting request will be rejected with your reason recorded.'}
      busy={busy} dirty={!!supportingReason.trim()} canConfirm={!!supporting && !!supportingAction && supporting.allowedActions.includes(supportingAction) && (['approve', 'accept'].includes(supportingAction) || !!supportingReason.trim())}
      successMessage="Supporting request decision recorded." onClose={() => { setSupportingAction(null); setSupportingReason(''); }} onConfirm={decideSupporting} onReload={() => loadRecords(true)}>
      {supportingAction && !['approve', 'accept'].includes(supportingAction) ? <label className="form-label block">Reason (required)<textarea required rows={3} className="form-control mt-2" value={supportingReason} disabled={busy} onChange={event => setSupportingReason(event.target.value)} /></label> : null}
    </DecisionDialog>
  </>;
  const closeRecord = () => { setRejectingRecordId(null); setRejectionReason(''); setSupportingAction(null); setSupportingReason(''); setLocalApplicationId(undefined); setLocalSupportingId(undefined); onNavigateToList(); };
  const visibleRecords = selected ? [selected] : [];
  const requestContent = <>      {loading ? (
        <LoadingState message="Loading supervisor approvals…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadRecords()} />
      ) : visibleRecords.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-3" />
          <h2 className="section-label">No pending supervisor approvals</h2>
          <p className="card-description mt-2">
            Accepted lecturer requests will appear here for final confirmation.
          </p>
        </div>
      ) : (
        <fieldset disabled={busy} className="space-y-4">
          {visibleRecords.map((record) => {
            const pending = records.some(item => String(item.id) === String(record.id));
            const isRejecting = String(rejectingRecordId) === String(record.id);

            return <SupervisorRequestDetail key={record.id} request={toSupervisorRequestPresentation(record)} administration={<CoordinatorApplicationLifecycle record={record} onEnd={(row,outcome,reason)=>endPrimaryAppointment(row,outcome,reason)} />} contextAction={<ViewStudentRecordAction studentId={record.studentId} onOpen={onNavigateToDossier} disabled={busy}/>} actions={pending || record.participantEligible === false ? <CoordinatorPrimaryRequestActions record={record} pending={pending} busy={busy} isRejecting={isRejecting} onAction={action=>{
              if(action==='reject')setRejectingRecordId(record.id);
              setPrimaryDecision({record,action});setRejectionReason('');
            }}/> : null} />;
          })}
        </fieldset>
      )}
</>;
  const endPrimaryAppointment: React.ComponentProps<typeof CoordinatorAppointmentLifecycleRecords>['onEnd'] = async (record, outcome, reason) => {
    if (busyRef.current) throw new Error('Another decision is being saved.');
    busyRef.current = true; setBusy(true);
    try { return await completeDecision(() => endSupervisorAppointment(record.appointmentLifecycle!.appointmentId, outcome, reason), async () => {
      await loadRecords(true, true); setTeamRefreshVersion(current => current + 1);
    }); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const nextAction = nextRequest && onNavigateToApplication && onNavigateToSupportingRequest ? <PortalButton size="sm" disabled={loading || busy || rejectingRecordId !== null || supportingAction !== null || primaryDecision !== null} onClick={() => {
    if (!nextRequest || busy || rejectingRecordId !== null || supportingAction !== null || primaryDecision !== null) return;
    setPage(nextRequest.queuePage);
    if (nextRequest.kind === 'supporting') onNavigateToSupportingRequest(String(nextRequest.id)); else onNavigateToApplication(String(nextRequest.id));
  }}>Next request</PortalButton> : undefined;
  const lifecycleContent = loading ? <LoadingState message="Loading primary appointment records…" /> : error ? <ErrorState message={error} onRetry={() => void loadRecords()} /> : <CoordinatorAppointmentLifecycleRecords
    records={appointmentRecords.filter(record => localAppointmentId ? record.id === localAppointmentId : !routeTeamStudentId || record.studentId === routeTeamStudentId)}
    detail={!!localAppointmentId || !!routeTeamStudentId} onOpen={id => { if (onNavigateToApplication) onNavigateToApplication(String(id)); else setLocalAppointmentId(id); }} onNavigateToDossier={onNavigateToDossier}
    onEnd={endPrimaryAppointment} />;
  if (applicationId) return <>{decisionDialogs}<RecordPage pageKey={!initialApplicationId ? `coordinator-primary-${applicationId}` : undefined} title="Appointment request" metadata={!loading && !error && selected ? <RequestMetadata {...supervisorRequestMetadata(toSupervisorRequestPresentation(selected))} /> : undefined} actions={nextAction} backLabel={backLabel} onBack={closeRecord} dirty={!!rejectionReason.trim()} busy={busy}>
    <PortalToast message={toast} />
    {!loading && !error && !selected ? <p className="card-description">This request is unavailable or outside your authorised scope.</p> : requestContent}
  </RecordPage></>;
  if (supportingId) return <>{decisionDialogs}<RecordPage pageKey={!initialSupportingId ? `coordinator-supporting-${supportingId}` : undefined} title="Supporting supervisor request" metadata={!loading && !error && supporting ? <RequestMetadata {...supportingRequestMetadata(supporting)} /> : undefined} actions={nextAction} backLabel={backLabel} onBack={closeRecord} dirty={!!supportingReason.trim()} busy={busy}>
    <PortalToast message={toast} />
    {loading ? <LoadingState message="Loading supporting supervisor request…" /> : error ? <ErrorState message={error} onRetry={() => void loadRecords()} /> : supporting ? <>
      <CoSupervisorNominationCard nomination={supporting} hideMetadata busy={busy} onAction={(_, action) => { setSupportingAction(action); setSupportingReason(''); }} actions={<>
        <PortalButton variant="primary" icon={UserRound} size="sm" onClick={() => onNavigateToDossier?.(supporting.matricNo)}>View student record</PortalButton>
      </>} />
    </> : <p className="card-description">This request is unavailable or outside your authorised scope.</p>}
  </RecordPage></>;
  if (localAppointmentId) return <RecordPage pageKey={`coordinator-appointment-${localAppointmentId}`} title="Supervisor appointment record" backLabel="Back to Supervisory teams" onBack={() => setLocalAppointmentId(undefined)}><PortalToast message={toast} />{lifecycleContent}</RecordPage>;
  const teamContent = <><SupervisoryTeamManagement role="Programme Coordinator" refreshVersion={refreshVersion + teamRefreshVersion}
    view={routeTeamStudentId ? 'detail' : 'roster'} routeStudentId={routeTeamStudentId} onNavigateToApplication={onNavigateToApplication} onNavigateToStudent={onNavigateToTeam}
    showResearchChanges={false} showRefresh={false} onNavigateToDossier={onNavigateToDossier} onNavigateToPanelRequest={onNavigateToPanelRequest} onBusyChange={setTeamBusy} onChanged={() => void loadRecords(false, true)} />{!routeTeamStudentId?lifecycleContent:null}
    {!routeTeamStudentId ? <CapacityReassessments role="Programme Coordinator" showRefresh={false} refreshVersion={refreshVersion + teamRefreshVersion} onBusyChange={setCapacityBusy} /> : null}</>;
  if (routeTeamStudentId) return <RecordPage title="Supervision details" backLabel="Back to Supervisory teams" onBack={onNavigateToList} busy={busy}><PortalToast message={toast} />{teamContent}</RecordPage>;
  return <div id="coordinator-supervisor-approvals" className="space-y-6 animate-fade-in text-left font-sans">
    <PortalToast message={toast} />
    {showHeader ? <><PageHeader title="Supervisor Appointments" subtitle="Review appointment requests and manage supervision in your programmes."
       />
      <SupervisorWorkspaceNavigation role="Programme Coordinator" /></> : null}
    {workspaceView === 'teams' ? teamContent : loading ? <LoadingState message="Loading appointment requests…" /> : error ? <ErrorState message={error} onRetry={() => void loadRecords()} /> :
      <CoordinatorAppointmentRequestList queue={records} history={historyRecords} nominations={nominations} view={view} search={search} type={type} status={status} page={page} pageSize={pageSize} disabled={busy}
        onView={value => { setView(value); setStatus(''); setPage(1); }} onSearch={value => { setSearch(value); setPage(1); }}
        onType={value => { setType(value); setPage(1); }} onStatus={value => { setStatus(value); setPage(1); }} onPage={setPage} onPageSize={value => { setPageSize(value); setPage(1); }}
        onOpen={(id, kind) => { if (kind === 'supporting') { if (onNavigateToSupportingRequest) onNavigateToSupportingRequest(String(id)); else setLocalSupportingId(String(id)); }
          else if (onNavigateToApplication) onNavigateToApplication(String(id)); else setLocalApplicationId(String(id)); }} />}
  </div>;
};
