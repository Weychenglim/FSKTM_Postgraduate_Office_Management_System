import { DecisionDialog } from './DecisionDialog';
import {DecisionFeedbackProvider} from './DecisionFeedback';
import { completeDecision } from '../utils/decisionSubmission';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import {officeSupervisorApi} from '../services/staffSupervisorWorkspaceApi';
import type {CapacityRequestKind} from '../types/capacityReassessment';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { UserRole } from '../types/auth';
import type { CapacityPolicy, CapacityReassessment, CapacityReassessmentWorkspace, CapacitySemester } from '../types/capacityReassessment';
import { authorizeCapacityReassessment, getCapacityReassessments, revokeCapacityReassessment } from '../services/capacityReassessmentsApi';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';

const words = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
const date = (value: string) => new Date(value).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const kinds = { SUPERVISOR: 'Supervisor', CO_SUPERVISOR: 'Co-supervisor', PANEL: 'Panel' };
type Action = 'authorize' | 'revoke';

function Policy({ policy }: { policy: CapacityPolicy | null }) {
  if (!policy) return <p className="card-description">Capacity policy unavailable</p>;
  return <div className="card-description space-y-1">
    <p>{policy.planId === null ? 'No published plan' : `Plan #${policy.planId} · version ${policy.planVersion ?? 'not recorded'}`}</p>
    <p>{policy.activeLoad} active · {policy.reservedLoad} reserved · limit {policy.limit ?? 'unconfigured'}</p>
    <p>{words(policy.state)}{policy.unavailableUntil ? ` until ${policy.unavailableUntil}` : ''}</p>
  </div>;
}

export function CapacityReassessmentCard({ row, activeSemester, office, busy, onAction }: {
  row: CapacityReassessment; activeSemester: CapacitySemester | null; office: boolean; busy: boolean; onAction: (row: CapacityReassessment, action: Action) => void;
}) {
  return <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="section-label">{kinds[row.kind]} #{row.id} · {row.candidate.name}</h4><p className="card-description">{row.student.name} · {row.student.matricNo} · {row.student.programme}</p></div><StatusBadge tone="neutral">{words(row.status)}</StatusBadge></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 rounded-lg bg-slate-50 p-3"><h5 className="card-value">Original semester</h5><p className="card-description">{row.originalSemester ? `${row.originalSemester.label} · ${words(row.originalSemester.lifecycleStatus)}` : 'Not recorded'}</p><Policy policy={row.originalCapacity} /></div>
      <div className="space-y-1 rounded-lg bg-slate-50 p-3"><h5 className="card-value">Current active semester</h5><p className="card-description">{activeSemester?.label ?? 'No active semester'}</p><Policy policy={row.currentCapacity} /></div>
    </div>
    {row.authorization ? <div className="card-description space-y-1"><p><span className="card-label">Authorization:</span> {words(row.authorization.state)} · {row.authorization.targetSemester.label}</p><p className="card-description whitespace-pre-wrap">{row.authorization.reason}</p>{row.authorization.state === 'STALE' ? <p className="rounded-lg bg-amber-50 p-2 text-amber-900">This authorization is no longer usable. Only pending requests from closed semesters can receive a new authorization for the current active semester.</p> : null}</div> : <p className="card-description">No capacity reassessment authorization.</p>}
    {office ? <div className="flex flex-wrap gap-2">{row.canAuthorize ? <PortalButton size="sm" disabled={busy || !activeSemester} onClick={() => onAction(row, 'authorize')}>Authorize reassessment</PortalButton> : null}{row.canRevoke ? <PortalButton size="sm" variant="danger" disabled={busy} onClick={() => onAction(row, 'revoke')}>Revoke authorization</PortalButton> : null}</div> : null}
    {row.history.length ? <details className="card-description"><summary className="card-value cursor-pointer">Authorization history ({row.history.length})</summary><ol className="mt-3 space-y-3 border-l border-slate-200 pl-3">{row.history.map(event => <li key={event.id} className="space-y-1"><p className="card-value">{words(event.action)} · {event.actorName} · {words(event.actorRole)} · {date(event.createdAt)}</p><p>Target semester: {event.targetSemester?.label ?? 'Not recorded'}</p><p className="card-description whitespace-pre-wrap">{event.reason}</p><Policy policy={event.policy} /></li>)}</ol></details> : null}
  </article>;
}

export function CapacityReassessments({ role, onChanged, showRefresh = true, refreshVersion = 0, onBusyChange, target }: { target?:{kind:CapacityRequestKind;id:number};role?: UserRole; onChanged?: () => void; showRefresh?: boolean; refreshVersion?: number; onBusyChange?: (busy: boolean) => void }) {
  // Do not mount the data-loading workspace for roles outside the staff scope.
  if (role !== 'Office Staff/Admin' && role !== 'Programme Coordinator') return null;
  return <DecisionFeedbackProvider scopeKey="capacity-reassessments"><CapacityReassessmentWorkspaceView office={role === 'Office Staff/Admin'} onChanged={onChanged} showRefresh={showRefresh} refreshVersion={refreshVersion} onBusyChange={onBusyChange} target={target}/></DecisionFeedbackProvider>;
}

function CapacityReassessmentWorkspaceView({ office, onChanged, showRefresh, refreshVersion, onBusyChange, target }: { target?:{kind:CapacityRequestKind;id:number};office: boolean; onChanged?: () => void; showRefresh: boolean; refreshVersion: number; onBusyChange?: (busy: boolean) => void }) {
  const [workspace, setWorkspace] = useState<CapacityReassessmentWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ row: CapacityReassessment; action: Action; semester: CapacitySemester | null } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const version = useRef(0);
  const mutating = useRef(false);
  const load = useCallback(async (strict = false, background = false) => {
    const token = ++version.current;
    if (!background) { setLoading(true); setError(null); }
    try { const result = target ? await officeSupervisorApi.carryoverRecord(target.kind,target.id).then(data=>({activeSemester:data.activeSemester,requests:[data.record]})) : await getCapacityReassessments(); if (version.current === token) setWorkspace(result); }
    catch (failure) { if (!background && version.current === token) { setWorkspace(null); setError(failure instanceof Error ? failure.message : 'Capacity reassessments could not be loaded.'); } if (strict) throw failure; }
    finally { if (!background && version.current === token) setLoading(false); }
  }, [target?.kind,target?.id]);
  useEffect(() => { void load(); return () => { version.current += 1; }; }, [load, refreshVersion]);
  useReturnToFocusReload(() => void load(), !loading && !busy && !edit && !target);
  const save = async () => {
    if (!office || !edit || !reason.trim() || mutating.current) return false;
    const { row, action, semester } = edit;
    if (action === 'authorize' && (!row.canAuthorize || !semester || workspace?.activeSemester?.id !== semester.id) || action === 'revoke' && (!row.canRevoke || !row.authorization)) return false;
    mutating.current = true; setBusy(true);
    try { return await completeDecision(async () => { const updated = await (action === 'authorize'
      ? authorizeCapacityReassessment(row.kind, row.id, { reason: reason.trim(), expectedStatus: row.status, expectedActiveSemesterId: semester!.id, expectedAuthorizationId: row.authorization?.id ?? null, expectedEventId: row.latestEventId })
      : revokeCapacityReassessment(row.kind, row.id, { reason: reason.trim(), expectedStatus: row.status, expectedAuthorizationId: row.authorization!.id, expectedEventId: row.latestEventId })); if (updated) setWorkspace(current => current ? {...current, requests:current.requests.map(request => request.kind === row.kind && request.id === row.id ? updated : request)} : current); }, async () => { await load(true, true); onChanged?.(); }); }
    finally { mutating.current = false; setBusy(false); }
  };
  useEffect(() => { onBusyChange?.(loading || busy); }, [onBusyChange, loading, busy]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const query = search.trim().toLowerCase();
  const rows = workspace?.requests.filter(row => `${row.student.name} ${row.student.matricNo} ${row.student.programme} ${row.candidate.name}`.toLowerCase().includes(query)) ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const currentPage = Math.min(page, pageCount);
  return <section className="space-y-3 border-t border-slate-200 pt-5" aria-label="Carryover capacity reassessment">
    <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="section-label">Carryover capacity reassessment</h3></div>
    <p className="card-description">Office may authorize pending requests from closed semesters to use the current active semester’s capacity policy. This does not approve an appointment or add capacity. The original semester and approval stage remain unchanged; eligibility and workload limits are checked again at approval.</p>
    {!office ? <p className="card-description">Read-only history for students in your authorized programme scope.</p> : null}
    <DecisionDialog isOpen={!!edit} standaloneGuard decisionKey={`${edit?.row.kind}:${edit?.row.id}`} title={edit?.action === 'authorize' ? 'Authorize capacity reassessment' : 'Revoke capacity authorization'} confirmLabel={edit?.action === 'authorize' ? 'Authorize reassessment' : 'Revoke authorization'} kind="confirmation" tone={edit?.action === 'revoke' ? 'danger' : 'warning'}
      context={<p>{edit?.row.student.name} &middot; {edit?.row.student.matricNo} &middot; {edit?.row.student.programme}<br/>{edit ? kinds[edit.row.kind] : ''}: {edit?.row.candidate.name}<br/>Original semester: {edit?.row.originalSemester?.label ?? 'Not recorded'}. Current active semester: {workspace?.activeSemester?.label ?? 'No active semester'}.</p>}
      message={edit?.action === 'authorize' ? `This pending carryover request will use ${edit.semester?.label ?? 'the active semester'} capacity policy at its existing approval stage. This does not approve the appointment or add capacity.` : `Authorization to use ${edit?.row.authorization?.targetSemester.label ?? 'the recorded semester'} capacity policy will be revoked.`}
      busy={busy} dirty={!!reason.trim()} canConfirm={office&&!!edit&&!!reason.trim()&&!loading&&!error&&(edit.action === 'authorize' ? edit.row.canAuthorize&&!!edit.semester&&workspace?.activeSemester?.id === edit.semester.id : edit.row.canRevoke&&!!edit.row.authorization)}
      successMessage={edit?.action === 'authorize' ? 'Capacity reassessment authorized. The appointment remains at its existing approval stage.' : 'Capacity reassessment authorization revoked.'}
      onClose={()=>{setEdit(null);setReason('');}} onConfirm={save} onReload={()=>load(true,true)}>
      <label className="form-label block">Reason (required)<textarea required rows={3} disabled={busy} value={reason} onChange={event=>setReason(event.target.value)} className="form-control mt-2"/></label>
    </DecisionDialog>
    {loading ? <LoadingState message="Loading capacity reassessments…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : workspace ? <>
      {!workspace.activeSemester ? <p className="card-description text-amber-900">No effective active semester is available. New authorizations cannot be granted.</p> : null}
      {workspace.requests.length > 1 ? <label className="form-label block">Find a carryover request<input type="search" value={search} placeholder="Student, matric number, programme or candidate" onChange={event => { setSearch(event.target.value); setPage(1); }} className="form-control form-control-sm mt-1" /></label> : null}
      {rows.slice((currentPage - 1) * 8, currentPage * 8).map(row => <CapacityReassessmentCard key={`${row.kind}-${row.id}`} row={row} activeSemester={workspace.activeSemester} office={office} busy={busy} onAction={(row, action) => { setEdit({ row, action, semester: workspace.activeSemester }); setReason(''); }} />)}
      {!rows.length ? <EmptyState title={query ? 'No matching carryover requests' : 'No carryover requests'} description="Eligible pending requests and recorded authorization history will appear here." /> : null}
      {rows.length > 8 ? <div className="card-description flex items-center justify-between"><PortalButton size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</PortalButton><span>Page {currentPage} of {pageCount}</span><PortalButton size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</PortalButton></div> : null}
    </> : null}
  </section>;
}
