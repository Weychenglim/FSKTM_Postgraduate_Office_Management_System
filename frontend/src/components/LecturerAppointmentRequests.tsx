import { UsersRound, ClipboardCheck, Clock3 } from 'lucide-react';
import {clearAppointmentFilterParams} from '../utils/appointmentFilters';
import { DecisionDialog } from './DecisionDialog';
import { AlertMessage } from './AlertMessage';
import { completeDecision } from '../utils/decisionSubmission';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { getSupervisorApplication, getSupervisorRequestHistory, acceptSupervisorApplication, rejectSupervisorApplication } from '../services/appointmentsApi';
import { getSupervisoryWorkspace, decideCoSupervisor } from '../services/coSupervisionApi';
import type { SupervisorRequest, SupervisorRequestHistoryRow, SupervisorApplicationRecord, SupervisorWorkloadSummary } from '../types';
import type { SupervisoryWorkspace, CoSupervisorAction } from '../types/coSupervision';
import { appointmentRequestRows, requestCalendarDay, requestGroup, requestStatusLabel, type LecturerAppointmentRow } from '../utils/lecturerRequests';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { PortalButton } from './PortalPrimitives';
import { LoadingState, ErrorState } from './StateViews';
import { RequestViewSwitch, RequestFilters, WorkspaceSectionHeader, WorkspaceRecordTable, WorkspacePagination, workspacePageSize, type RequestListView } from './RequestWorkspacePrimitives';
import { RecordPage } from './RecordPage';
import { SupervisorRequestDetail, supervisorRequestMetadata, toSupervisorRequestPresentation } from './SupervisorRequestDetail';
import { PrimaryRequestDecisionButtons, RequestMetadata, ViewStudentRecordAction } from './RequestDetailPrimitives';
import { CoSupervisorAppointmentCard, CoSupervisorNominationCard, supportingRequestMetadata } from './SupervisoryTeamManagement';
import { AppointmentSummaryCard, AppointmentWorkloadDetails } from './AppointmentPrimitives';
import { capacityStateLabel } from '../utils/lecturerCapacity';

const EMPTY_WORKSPACE: SupervisoryWorkspace = { teams: [], nominations: [], appointments: [] };

export function lecturerRequestViewRows(rows: LecturerAppointmentRow[], view: RequestListView): LecturerAppointmentRow[] {
  return rows.filter(row => (requestGroup(row.status, row.canDecide) === 'history') === (view === 'history'))
    .sort((a, b) => view === 'requests' ? Number(b.canDecide) - Number(a.canDecide) : 0);
}

export function lecturerRequestViewParams(current: URLSearchParams, view: RequestListView, rows: LecturerAppointmentRow[]): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set('view', view);
  next.delete('page');
  const status = next.get('status');
  if (status && !lecturerRequestViewRows(rows, view).some(row => row.status === status)) next.delete('status');
  return next;
}

export function LecturerPrimaryRequestActions({ record, blocked = false, busy, onAction, children }: {
  record: SupervisorApplicationRecord; blocked?: boolean; busy: boolean; onAction: (action: 'accept' | 'reject') => void;
  children?: React.ReactNode;
}) {
  const canReview = record.status === 'SUBMITTED_TO_SUPERVISOR' && record.participantEligible !== false && !blocked;
  const capacity = record.acceptanceCapacity;
  const capacityBlocked = !!capacity && (capacity.state !== 'AVAILABLE' || capacity.availableSlots <= 0);
  return <div className="space-y-4">
    {record.participantEligible === false ? <p className="card-description">This Student is currently ineligible for a decision.</p> : null}
    {canReview && capacityBlocked ? <p className="card-description text-amber-800">{capacity!.availableSlots <= 0 && ['FULL','OVER_CAPACITY'].includes(capacity!.state) ? 'No places available. Active appointments and accepted requests use the available capacity. You can still reject this request.' : 'Acceptance is unavailable under this request’s current capacity policy. You can still reject this request.'}</p> : null}
    {canReview ? <PrimaryRequestDecisionButtons positiveLabel="Accept request" disabled={busy} positiveDisabled={capacityBlocked} onPositive={()=>{if(!capacityBlocked)onAction('accept');}} onReject={()=>onAction('reject')}/> : null}
    {children}
  </div>;
}

export function LecturerAppointmentRequestList({ rows, history, onOpen }: { rows: LecturerAppointmentRow[]; history: boolean; onOpen: (row: LecturerAppointmentRow) => void }) {
  const selected = lecturerRequestViewRows(rows, history ? 'history' : 'requests');
  if (!selected.length) return null;
  return <WorkspaceRecordTable history={history} label="Appointment request records" rows={selected.map(row => ({
      key: row.key, studentName: row.studentName, matricNo: row.matricNo,
      kind: row.kind === 'primary' ? 'Primary supervisor' : 'Supporting supervisor', submittedAt: row.submittedAt,
      status: requestStatusLabel(row.status, row.canDecide), workflowStatus: row.status, waitingDays: row.waitingDays, waitingApplicable: !history,
      actionLabel: !history && row.canDecide ? 'Review request' : 'View request', onOpen: () => onOpen(row),
    }))} />;
}

export function LecturerAppointmentRequests({ primaryRequests, primaryLoading, primaryError, refreshVersion, historyRoute = false, onChanged, initialApplicationId, initialSupportingId, onCloseRoute, onNavigateToRequest, backLabel = 'Back to Appointment requests', workload = null, onNavigateToDossier, onBusyChange }: {
  primaryRequests: SupervisorRequest[]; primaryLoading: boolean; primaryError: string | null; refreshVersion: number; historyRoute?: boolean; onChanged: () => Promise<unknown>;
  initialApplicationId?: string; initialSupportingId?: string; onCloseRoute?: () => void;
  onNavigateToRequest?: (id: string, kind: 'primary' | 'supporting') => void; backLabel?: string;
  workload?: SupervisorWorkloadSummary | null;
  onNavigateToDossier?: (studentId: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const view = params.get('view') === 'history' || (historyRoute && !params.has('view')) ? 'history' : 'requests';
  const search = params.get('q') ?? '';
  const type = params.get('type') ?? 'all';
  const status = params.get('status') ?? '';
  const semester = params.get('semester') ?? '';
  const from = params.get('from') ?? '';
  const pageSize = workspacePageSize(params.get('size'));
  const setFilter = (key: string, value: string, replace = true) => setParams(current => {
    const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); next.delete('page'); return next;
  }, { replace });
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE);
  const [history, setHistory] = useState<SupervisorRequestHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LecturerAppointmentRow | null>(null);
  const [detail, setDetail] = useState<SupervisorApplicationRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [action, setAction] = useState<CoSupervisorAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(loading || primaryLoading || busy); }, [onBusyChange, loading, primaryLoading, busy]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const [notice, setNotice] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const detailVersion = useRef(0);
  const openedRoute = useRef('');
  const mutation = useRef(false);
  const decisionSaved = useRef(false);
  const navigationComplete = useRef(false);
  const mounted = useRef(false);
  const scope = `${location.pathname}:${location.search}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const load = useCallback(async (strict = false) => {
    const token = ++loadVersion.current; setLoading(true); setError(null);
    try { const [records, teams] = await Promise.all([getSupervisorRequestHistory(), getSupervisoryWorkspace()]); if (token === loadVersion.current) { setHistory(records); setWorkspace(teams); } }
    catch (failure) { if (token === loadVersion.current) { setError(failure instanceof Error ? failure.message : 'Requests could not be loaded.'); setHistory([]); setWorkspace(EMPTY_WORKSPACE); } if (strict) throw failure; }
    finally { if (token === loadVersion.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; detailVersion.current += 1; }; }, []);
  useEffect(() => { void load(); return () => { loadVersion.current += 1; }; }, [load, refreshVersion]);
  const close = () => { detailVersion.current += 1; setSelected(null); setDetail(null); setAction(null); setReason(''); };
  const closePanel = () => { close(); if (initialApplicationId || initialSupportingId) onCloseRoute?.(); };
  useEffect(() => { close(); }, [scope]);
  const open = useCallback(async (row: LecturerAppointmentRow, preserveDecision = false, strict = false) => {
    const token = ++detailVersion.current; const openedScope = scopeRef.current;
    navigationComplete.current = false;
    if (!preserveDecision) decisionSaved.current = false;
    setSelected(row); setDetail(null); setDetailError(null); if (!preserveDecision) { setAction(null); setReason(''); }
    setDetailLoading(true);
    try {
      if (row.kind === 'supporting') {
        const teams = await getSupervisoryWorkspace();
        const current = appointmentRequestRows([], [], teams).find(record => record.key === row.key);
        if (!current) throw new Error('This request is no longer available. Return to the request list.');
        if (token === detailVersion.current && openedScope === scopeRef.current) { setSelected(current); setWorkspace(teams); }
      } else {
        const record = await getSupervisorApplication(row.id);
        if (token === detailVersion.current && openedScope === scopeRef.current) setDetail(record);
      }
    }
    catch (failure) { if (token === detailVersion.current && openedScope === scopeRef.current) setDetailError(failure instanceof Error ? failure.message : 'Request details could not be loaded.'); if (strict) throw failure; }
    finally { if (token === detailVersion.current) setDetailLoading(false); }
  }, []);
  const decide = async () => {
    if (!selected || !action || mutation.current || (!['accept', 'approve'].includes(action) && !reason.trim())) return false;
    mutation.current = true; setBusy(true);
    const operationScope = scopeRef.current;
    const operationToken = detailVersion.current;
    try {
      return await completeDecision(async () => {
        if (selected.kind === 'primary') { if (action === 'accept') await acceptSupervisorApplication(selected.id); else await rejectSupervisorApplication(selected.id, reason.trim()); }
        else await decideCoSupervisor(Number(selected.id), action, reason.trim());
        decisionSaved.current = true;
      }, async () => {
        await Promise.all([load(true), onChanged()]);
        if (mounted.current && scopeRef.current === operationScope && detailVersion.current === operationToken) await open(selected, true, true);
      });
    } finally { mutation.current = false; if (mounted.current) setBusy(false); }
  };
  const rows = appointmentRequestRows(primaryRequests, history, workspace);
  useEffect(() => {
    const id = initialApplicationId ?? initialSupportingId;
    const kind = initialSupportingId ? 'supporting' : 'primary';
    const routeKey = `${kind}:${id}:${scope}`;
    if (!id || loading || primaryLoading || openedRoute.current === routeKey) return;
    openedRoute.current = routeKey;
    const row = appointmentRequestRows(primaryRequests, history, workspace).find(record => record.kind === kind && String(record.id) === id)
      ?? { key: `${kind}-${id}`, kind, id, studentName: 'Request details', matricNo: '', status: '', submittedAt: '', programme: '', semester: '', title: '', canDecide: false };
    void open(row);
  }, [initialApplicationId, initialSupportingId, loading, primaryLoading, primaryRequests, history, workspace, open, scope]);
  const reviewCount = rows.filter(row => requestGroup(row.status, row.canDecide) === 'review').length;
  const coordinatorCount = rows.filter(row => requestGroup(row.status, row.canDecide) === 'coordinator').length;
  const viewRows = lecturerRequestViewRows(rows, view);
  const visible = viewRows.filter(row => (type === 'all' || row.kind === type) && (!status || row.status === status) && (!semester || row.semester === semester)
    && (!from || requestCalendarDay(row.submittedAt) >= from)
    && `${row.studentName} ${row.matricNo} ${row.title} ${row.id} SV-REQ-${String(row.id).padStart(5, '0')} ${row.nomination?.candidate.name ?? ''} ${row.nomination?.nominator.name ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  if (view === 'history') visible.reverse();
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const requestedPage = Number(params.get('page'));
  const page = Math.min(pageCount, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  const appointments = [...new Map([...workspace.appointments, ...workspace.teams.flatMap(team => team.appointments)].filter(row => row.status === 'ENDED').map(row => [row.id, row])).values()];
  const panelRow = selected?.nomination;
  const loadError = primaryError ?? error;
  const decisionLabel = action === 'accept' ? 'Accept request' : action === 'approve' ? 'Approve supporting appointment' : action === 'cancel' ? 'Cancel nomination' : 'Reject request';
  const acceptanceCapacity = selected?.kind === 'primary' ? detail?.acceptanceCapacity : null;
  const acceptanceBlocked = !!acceptanceCapacity && (acceptanceCapacity.state !== 'AVAILABLE' || acceptanceCapacity.availableSlots <= 0);
  const otherPendingRequests = Math.max(0,(acceptanceCapacity?.pendingRequests ?? 0)-1);
  const lastPlaceAcceptance = selected?.kind === 'primary' && acceptanceCapacity?.availableSlots === 1;
  const acceptanceMessage = lastPlaceAcceptance
    ? <AlertMessage type="warning" title="Last available place" message={<>
        <p>Accepting reserves this place until Coordinator approval.</p>
        {otherPendingRequests > 0 ? <p className="mt-2">{otherPendingRequests} other pending {otherPendingRequests === 1 ? 'request' : 'requests'} may close after final approval.</p> : null}
      </>}/>
    : selected?.kind === 'primary'
      ? 'Acceptance reserves a place while the Programme Coordinator makes the final decision.'
      : 'Acceptance forwards this nomination to the Programme Coordinator for final approval. Capacity is checked at final approval.';
  const decisionDialog = <DecisionDialog isOpen={!!action} decisionKey={selected?.key} title={decisionLabel} confirmLabel={decisionLabel} kind={action==='cancel'?'confirmation':'review'} tone={action==='accept'&&lastPlaceAcceptance?'warning':action&&['accept','approve'].includes(action)?'info':'danger'}
    context={<p>{(selected?.kind === 'primary' && detail ? [detail.studentName, detail.studentId, detail.programme] : [selected?.studentName, selected?.matricNo, selected?.programme]).filter(Boolean).join(' · ')}</p>}
    message={action === 'accept' ? acceptanceMessage : action === 'approve' ? 'Approval confirms the supporting appointment after eligibility and capacity checks.' : action === 'cancel' ? 'This nomination will be cancelled.' : 'This request will be rejected with your reason recorded.'}
    busy={busy} dirty={!!reason.trim()} canConfirm={!!selected && !!action && !(action === 'accept' && acceptanceBlocked) && (['accept', 'approve'].includes(action) || !!reason.trim())}
    successMessage={action === 'accept' ? 'Request accepted and forwarded to the Programme Coordinator.' : action === 'approve' ? 'Supporting appointment approved.' : action === 'cancel' ? 'Nomination cancelled.' : 'Request rejected.'}
    onClose={() => { setAction(null); setReason(''); }} onConfirm={decide} onReload={async () => { if (selected) await open(selected, true, true); }}>
    {action && !['accept', 'approve'].includes(action) ? <label className="form-label block">Reason (required)<textarea required rows={3} className="form-control form-control-md mt-2 min-h-24 resize-y text-sm font-normal" value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label> : null}
  </DecisionDialog>;
  const primaryActions = detail && (detail.participantEligible === false || (detail.status === 'SUBMITTED_TO_SUPERVISOR' && !detailError && !decisionSaved.current)) ? <LecturerPrimaryRequestActions record={detail} blocked={!!detailError || decisionSaved.current} busy={busy}
    onAction={value => { setAction(value); setReason(''); }} /> : null;
  if (initialApplicationId || initialSupportingId || selected) return <>{decisionDialog}<RecordPage navigationComplete={navigationComplete} title="Appointment request" backLabel={backLabel} onBack={closePanel}
    metadata={!detailLoading && !detailError ? detail ? <RequestMetadata {...supervisorRequestMetadata(toSupervisorRequestPresentation(detail))} /> : panelRow ? <RequestMetadata {...supportingRequestMetadata(panelRow)} /> : undefined : undefined}
    pageKey={initialApplicationId || initialSupportingId ? undefined : `supervisor-request:${selected?.key}`}
    dirty={!!action && !!reason.trim()} busy={busy}>
    {selected ? detailLoading ? <LoadingState message="Loading request details…" /> : <>
      {detailError ? <ErrorState message={detailError} onRetry={() => void open(selected)} /> : null}
      {detail ? <SupervisorRequestDetail request={toSupervisorRequestPresentation(detail)} contextAction={<ViewStudentRecordAction studentId={detail.studentId} onOpen={onNavigateToDossier} disabled={busy}/>} actions={primaryActions} /> : panelRow ? <CoSupervisorNominationCard detailView nomination={decisionSaved.current ? { ...panelRow, allowedActions: [] } : panelRow} hideMetadata busy={busy || !!detailError}
        onAction={(_, value) => { if (!detailError) { setAction(value); setReason(''); } }}  /> : null}
    </> : loadError ? <ErrorState message={loadError} onRetry={() => { void load(); void onChanged(); }} /> : <LoadingState message="Loading request details…" />}
  </RecordPage></>;
  return <>{decisionDialog}<div className="space-y-5">
    {!loading && !primaryLoading && !loadError && workload ? <div className="grid gap-4 md:grid-cols-3">
      <AppointmentSummaryCard icon={UsersRound} title="Supervisory load" value="" supportingContent={<AppointmentWorkloadDetails active={workload.activeLoad ?? workload.currentStudents} reserved={workload.reservedLoad ?? 0} available={workload.capacityState==='NOT_CONFIGURED'?undefined:workload.availableSlots} unavailable={workload.capacityState === 'TEMPORARILY_UNAVAILABLE' && workload.unavailableUntil ? `Unavailable until ${formatMalaysiaDate(workload.unavailableUntil)}` : undefined}/>} badge={workload.capacityState === 'AVAILABLE' && workload.availableSlots === 1 ? '1 place remaining' : workload.capacityState ? capacityStateLabel(workload.capacityState) : 'Not configured'} tone={workload.selectable && workload.availableSlots !== 1 ? 'success' : 'warning'} progress={{ current: workload.workloadCount ?? (workload.activeLoad ?? workload.currentStudents) + (workload.reservedLoad ?? 0), max: workload.workloadLimit }} />
      <AppointmentSummaryCard icon={ClipboardCheck} title="Needs your review" value={String(reviewCount)} description="Primary and supporting requests needing your decision." tone={reviewCount ? 'warning' : 'success'} />
      <AppointmentSummaryCard icon={Clock3} title="Awaiting Coordinator" value={String(coordinatorCount)} description="Ongoing requests you can follow while final approval is pending." tone="info" />
    </div> : null}
    <section aria-label="Appointment requests" className="appointment-workspace-card rounded-2xl border border-slate-200 bg-white shadow-sm">
    <WorkspaceSectionHeader title="Appointment requests" description="Review supervision requests and follow their recorded progress and outcomes." actions={<RequestViewSwitch view={view} reviewCount={loading || primaryLoading || loadError ? 0 : reviewCount} onChange={value => setParams(current => lecturerRequestViewParams(current, value, rows), { replace: false })} />} />
    {notice ? <p role="status" className="card-description rounded-lg bg-slate-50 p-3">{notice}</p> : null}
    {loading || primaryLoading ? <LoadingState message="Loading appointment requests…" /> : loadError ? <ErrorState message={loadError} onRetry={() => { void load(); void onChanged(); }} /> : <>
      <RequestFilters onReset={()=>setParams(current=>clearAppointmentFilterParams(current),{replace:true,state:location.state})} search={search} onSearch={value => setFilter('q', value)} type={type} onType={value => setFilter('type', value)} status={status} statuses={[...new Set(viewRows.map(row => row.status))]} onStatus={value => setFilter('status', value)} semester={semester} semesters={[...new Set(rows.map(row => row.semester).filter(Boolean))]} onSemester={value => setFilter('semester', value)} from={from} onFrom={value => setFilter('from', value)} />
      {visible.length ? <LecturerAppointmentRequestList rows={visible.slice((page - 1) * pageSize, page * pageSize)} history={view === 'history'} onOpen={row => onNavigateToRequest ? onNavigateToRequest(String(row.id), row.kind) : void open(row)} /> : <p className="card-description rounded-lg bg-slate-50 p-4">{search || type !== 'all' || status || semester || from ? 'No matching requests. Adjust the filters to see more records.' : view === 'history' ? 'No final request outcomes yet.' : 'No ongoing appointment requests.'}</p>}
      <WorkspacePagination page={page} pageCount={pageCount} total={visible.length} noun="requests" pageSize={pageSize} onPageSize={value => setFilter('size', String(value))} onPage={value => setParams(current => { const next = new URLSearchParams(current); next.set('page', String(value)); return next; })} />
      {view === 'history' && appointments.length ? <details className="border-t border-slate-200 pt-4"><summary className="card-value cursor-pointer">Supporting appointment activity ({appointments.length})</summary><p className="card-description mt-2">Recorded appointment endings and replacements, separate from request decisions.</p><div className="mt-3 space-y-3">{appointments.map(row => <CoSupervisorAppointmentCard key={row.id} appointment={{ ...row, canEnd: false }} busy={false} canReplace={false} onEnd={() => {}} onReplace={() => {}} />)}</div></details> : null}
    </>}

  </section></div></>;
}
