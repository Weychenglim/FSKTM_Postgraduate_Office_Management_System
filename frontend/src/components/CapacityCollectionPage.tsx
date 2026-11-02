import React, { useEffect, useState } from 'react';
import {CalendarOff, History, ScrollText} from 'lucide-react';
import type { LecturerAvailabilityWindow, LecturerCapacityAudit, SemesterCapacityPlan } from '../types';
import { getCapacityPage, type CapacityCollection, type CapacityPage } from '../services/lecturerCapacityApi';
import { capacityConflictMessage, calendarDateInTimeZone } from '../utils/lecturerCapacity';
import { CoordinatorDataTable } from './CoordinatorBrowsePrimitives';
import { WorkspaceFilterCard, WorkspacePagination } from './RequestWorkspacePrimitives';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { PortalSelect } from './PortalSelect';
import { OfficeToolSection } from './OfficeToolPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import { CapacityLecturerDialog } from './CapacityLecturerDialog';

type Row = SemesterCapacityPlan | LecturerAvailabilityWindow | LecturerCapacityAudit;
const date = (value: string) => new Date(`${value.slice(0,10)}T00:00:00`).toLocaleDateString('en-MY', {day:'2-digit', month:'short', year:'numeric'});
const stamp = (value: string) => new Date(value).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'});
const actionLabel = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
export function availabilityStatus(item: LecturerAvailabilityWindow) {
  return item.isCancelled ? 'Cancelled' : item.isEffective ? 'Effective' : item.endsOn < calendarDateInTimeZone() ? 'Ended' : 'Scheduled';
}

/** Each destination owns one bounded server page; other histories stay unloaded. */
export function CapacityCollectionPage({collection, semesterId, revision, initialStatus, initialVersion, mutable, busy, lecturer, onClearLecturer, onPlan, onDiscard, onPrepare, onActivity}: {
  collection: CapacityCollection; semesterId: number; revision: number; initialStatus?: string; initialVersion?: number; mutable: boolean; busy: boolean;
  lecturer: {id: number; name: string} | null; onClearLecturer: () => void;
  onPlan: (plan: SemesterCapacityPlan) => void; onDiscard: (plan: SemesterCapacityPlan) => void; onPrepare: () => void; onActivity: (version?: number) => void;
}) {
  const plans = collection === 'capacity-plans', availability = collection === 'availability';
  const [search,setSearch] = useState(''), [status,setStatus] = useState(initialStatus ?? (availability ? 'CURRENT' : 'ALL')), [role,setRole] = useState('ALL');
  const [page,setPage] = useState(1), [size,setSize] = useState(10), [retry,setRetry] = useState(0);
  const [version,setVersion] = useState(initialVersion?.toString() ?? 'ALL');
  const [result,setResult] = useState<CapacityPage<Row> | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState<string | null>(null);
  const [detail,setDetail] = useState<LecturerAvailabilityWindow | null>(null);
  useReturnToFocusReload(() => setRetry(value => value + 1), !loading && !busy && detail === null);
  useEffect(() => {
    let active = true; setLoading(true); setError(null);
    // Debounce typing while keeping dropdowns and paging immediate.
    const timer = setTimeout(() => {
      getCapacityPage<Row>(semesterId, collection, {limit:size, offset:(page-1)*size, q:search.trim(), ...(plans || availability ? {status} : {}), ...(availability ? {role, lecturerId:lecturer?.id} : {}), ...(!plans&&!availability&&version!=='ALL' ? {version:Number(version)} : {})})
        .then(value => { if (active) { const last = Math.max(1, Math.ceil(value.total / size)); if (page > last) setPage(last); else setResult(value); } })
        .catch(reason => { if (active) setError(capacityConflictMessage(reason)); })
        .finally(() => { if (active) setLoading(false); });
    }, search.trim() ? 200 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [semesterId, collection, revision, page, size, search, status, role, lecturer?.id, retry, plans, availability, version]);
  const reset = () => { setSearch(''); setStatus(availability ? 'CURRENT' : 'ALL'); setRole('ALL'); setVersion('ALL'); setPage(1); onClearLecturer(); };
  const rows = result?.rows ?? [];
  const versions = [...new Set([...(result?.versions ?? []), ...(version!=='ALL'?[Number(version)]:[])])].sort((a,b)=>b-a);
  return <>
    <OfficeToolSection title={plans ? 'Capacity versions' : availability ? 'Availability restrictions' : 'Activity log'} icon={plans ? History : availability ? CalendarOff : ScrollText}
      description={availability ? 'Lecturers manage their own restrictions.' : undefined}
      actions={plans ? <><PortalButton size="sm" onClick={()=>onActivity()}>View activity log</PortalButton>{mutable && <PortalButton size="sm" variant="primary" disabled={busy} onClick={onPrepare}>Start new draft</PortalButton>}</> : undefined}>
      <div className="p-4 sm:p-5 space-y-4">
        <WorkspaceFilterCard fieldsClassName={`grid gap-3 ${availability ? 'sm:grid-cols-3' : 'sm:grid-cols-[2fr_1fr]'}`} onReset={reset}>
          <label className="form-label">{availability ? 'Find a lecturer' : plans ? 'Find a version' : 'Find an activity'}<input type="search" className="form-control form-control-sm mt-1" value={search} placeholder={availability ? 'Name or staff number' : plans ? 'Version, creator or publication reason' : 'Person, action or reason'} onChange={event => {setSearch(event.target.value);setPage(1);}} /></label>
          {availability && <label className="form-label">Role<PortalSelect className="form-control form-control-sm mt-1" value={role} onChange={event => {setRole(event.target.value);setPage(1);}}><option value="ALL">All roles</option><option value="SUPERVISOR">Supervisor</option><option value="PANEL">Panel</option></PortalSelect></label>}
          {!plans&&!availability && <label className="form-label">Version<PortalSelect id="capacity-activity-version" className="form-control form-control-sm mt-1" value={version} onChange={event=>{setVersion(event.target.value);setPage(1);}}><option value="ALL">All versions</option>{versions.map(value=><option key={value} value={value}>Version {value}</option>)}</PortalSelect></label>}
          {(plans || availability) && <label className="form-label">Status<PortalSelect id={plans ? 'capacity-history-status' : 'capacity-availability-status'} className="form-control form-control-sm mt-1" value={status} onChange={event => {setStatus(event.target.value);setPage(1);}}>
            {availability ? <><option value="CURRENT">Current and scheduled</option><option value="ALL">All restrictions</option><option value="EFFECTIVE">Effective</option><option value="SCHEDULED">Scheduled</option><option value="ENDED">Ended</option><option value="CANCELLED">Cancelled</option></> : <><option value="ALL">All versions</option><option value="DRAFT">Drafts</option><option value="PUBLISHED">Published</option><option value="SUPERSEDED">Superseded</option><option value="DISCARDED">Discarded</option></>}
          </PortalSelect></label>}
        </WorkspaceFilterCard>
        {availability && lecturer && <div className="flex flex-wrap items-center gap-3 text-sm" role="status"><strong>Lecturer: {lecturer.name}</strong><PortalButton size="sm" onClick={() => {onClearLecturer();setPage(1);}}>Clear lecturer filter</PortalButton></div>}
        {loading ? <LoadingState message="Loading records…" /> : error ? <ErrorState compact title="Couldn’t load records" message={error} onRetry={() => setRetry(value => value + 1)} /> : !rows.length ? <EmptyState title="No matching records" description="Adjust or clear the filters." /> : plans ?
          <CoordinatorDataTable label="Capacity versions" columns={['Version','Status','Created by','Created on','Action']} rows={(rows as SemesterCapacityPlan[]).map(plan => ({key:plan.id,cells:[
            <div><strong>Version {plan.version}</strong>{plan.publicationReason && <p className="mt-1 text-slate-600 break-words">{plan.publicationReason}</p>}</div>,
            <StatusBadge tone={plan.lifecycleStatus === 'PUBLISHED' ? 'success' : plan.lifecycleStatus === 'DRAFT' ? 'warning' : 'neutral'}>{plan.lifecycleStatus}</StatusBadge>, plan.createdBy.name, stamp(plan.createdAt),
            <div className="capacity-version-actions"><PortalButton size="sm" disabled={busy} onClick={() => onPlan(plan)}>{plan.lifecycleStatus === 'DRAFT' && mutable ? 'Edit draft' : 'View version'}</PortalButton><PortalButton size="sm" disabled={busy} aria-label={`View activity for version ${plan.version}`} onClick={()=>onActivity(plan.version)}>View activity</PortalButton>{plan.lifecycleStatus === 'DRAFT' && mutable && <PortalButton size="sm" variant="danger" aria-label={`Discard draft version ${plan.version}`} disabled={busy} onClick={() => onDiscard(plan)}>Discard</PortalButton>}</div>,
          ]}))} /> : availability ?
          <CoordinatorDataTable label="Lecturer availability" columns={['Lecturer','Role','Starts on','Ends on','Status','Action']} rows={(rows as LecturerAvailabilityWindow[]).map(item => ({key:item.id,cells:[
            <div><strong>{item.lecturerName}</strong><p className="mt-1 text-slate-600">{item.staffNo}</p></div>,item.role === 'SUPERVISOR' ? 'Supervisor' : 'Panel',date(item.startsOn),date(item.endsOn),
            <StatusBadge tone={item.isCancelled || availabilityStatus(item) === 'Ended' ? 'neutral' : item.isEffective ? 'warning' : 'info'}>{availabilityStatus(item)}</StatusBadge>,<PortalButton size="sm" onClick={() => setDetail(item)}>View details</PortalButton>,
          ]}))} /> :
          <CoordinatorDataTable label="Capacity activity log" columns={['When','Person','Version','Action','Reason']} rows={(rows as LecturerCapacityAudit[]).map(item => ({key:item.id,cells:[stamp(item.createdAt),item.actor.name,item.planVersion ? `Version ${item.planVersion}` : item.planId ? 'Version unavailable' : 'Semester-wide',item.action==='PLAN_COPY'&&typeof item.beforeValues?.version==='number' ? `Created from Version ${item.beforeValues.version}${item.beforeValues.semesterId!==item.semesterId?' (another semester)':''}` : actionLabel(item.action),item.reason || '—']}))} />}
        {!loading && !error && result && <WorkspacePagination total={result.total} page={page} pageCount={Math.max(1,Math.ceil(result.total/size))} pageSize={size} onPage={setPage} onPageSize={value => {setSize(value);setPage(1);}} noun={plans ? 'versions' : availability ? 'restrictions' : 'activities'} />}
      </div>
    </OfficeToolSection>
    {detail && <CapacityLecturerDialog title="Availability restriction" lecturerName={detail.lecturerName} staffNo={detail.staffNo} onClose={() => setDetail(null)} footer={close => <PortalButton onClick={close}>Close</PortalButton>}>
      <dl className="capacity-detail-counts"><div><dt>Role</dt><dd>{detail.role === 'SUPERVISOR' ? 'Supervisor' : 'Panel'}</dd></div><div><dt>Status</dt><dd>{availabilityStatus(detail)}</dd></div><div><dt>Starts on</dt><dd>{date(detail.startsOn)}</dd></div><div><dt>Ends on</dt><dd>{date(detail.endsOn)}</dd></div></dl>
      <section><h3 className="font-semibold text-brand-navy">Reason</h3><p className="mt-2 whitespace-pre-wrap break-words">{detail.reason}</p></section>
      <p>Recorded by {detail.createdBy.name} on {stamp(detail.createdAt)}</p>
      {detail.isCancelled && <section><h3 className="font-semibold text-brand-navy">Cancellation</h3><p className="mt-2 whitespace-pre-wrap break-words">{detail.cancellationReason}</p>{detail.cancelledAt && <p className="mt-2">{detail.cancelledBy?.name} · {stamp(detail.cancelledAt)}</p>}</section>}
    </CapacityLecturerDialog>}
  </>;
}
