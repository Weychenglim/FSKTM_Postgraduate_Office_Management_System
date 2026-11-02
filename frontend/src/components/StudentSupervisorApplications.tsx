import {clearAppointmentFilterParams} from '../utils/appointmentFilters';
import { PortalSelect } from './PortalSelect';
import React from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { Eye } from 'lucide-react';
import type { StudentSupervisorApplication } from '../types';
import { formatSupervisorWaiting } from '../services';
import { AppointmentSection } from './AppointmentPrimitives';
import { PortalButton, StatusBadge, getStatusBadgeTone } from './PortalPrimitives';
import { partitionSupervisorApplications } from '../utils/supervisorWorkspace';
import { requestCalendarDay, requestStatusLabel, requestWaitingDays } from '../utils/lecturerRequests';
import { recordFilterParams } from '../utils/recordNavigation';
import { RequestFilters, RequestViewSwitch, WorkspacePagination, WorkspaceRecordTable, WorkspaceSectionHeader, workspacePageSize, type RequestListView } from './RequestWorkspacePrimitives';

type StudentApplicationListProps = {
  applications: StudentSupervisorApplication[];
  onViewApplication?: (id: string) => void;
  compact?: boolean;
};

export function studentApplicationViewParams(current: URLSearchParams, view: RequestListView) {
  const next = recordFilterParams(current, 'view', view);
  next.delete('status');
  return next;
}

// The Student DTO already contains a Malaysia display date. Convert it to a
// date-only value for the shared table without interpreting it in device time.
function applicationDate(value: string) {
  const display = /^(\d{2}) ([A-Z][a-z]{2}|Sept) (\d{4})$/.exec(value);
  if (!display) return value;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(display[2].slice(0, 3)) + 1;
  return month ? `${display[3]}-${String(month).padStart(2, '0')}-${display[1]}` : '';
}

function StudentApplicationWorkspace({ applications, onViewApplication }: StudentApplicationListProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const view = params.get('view') === 'history' ? 'history' : 'requests';
  const search = params.get('q') ?? '';
  const type = params.get('type') ?? 'all';
  const status = params.get('status') ?? '';
  const from = params.get('from') ?? '';
  const pageSize = workspacePageSize(params.get('size'));
  const setFilter = (key: string, value: string, replace = true) => setParams(current => recordFilterParams(current, key, value), { replace, state: location.state });
  const { pending, completed } = partitionSupervisorApplications(applications);
  const rows = view === 'history' ? completed : pending;
  const query = search.trim().toLowerCase();
  const visible = rows.filter(app => `${app.supervisor} ${app.id} ${app.title} ${app.researchArea}`.toLowerCase().includes(query)
    && (type === 'all' || (type === 'replacement' ? !!app.replacesAppointmentId : !app.replacesAppointmentId))
    && (!status || (app.workflowStatus ?? app.status) === status)
    && (!from || requestCalendarDay(applicationDate(app.date)) >= from));
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const requestedPage = Number(params.get('page'));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const statuses = [...new Set(rows.map(app => app.workflowStatus ?? app.status))];
  const filtered = !!query || type !== 'all' || !!status || !!from;
  return <section aria-label="Supervisor applications" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <WorkspaceSectionHeader title="Applications" description="Follow your supervisor requests and review their recorded outcomes." actions={<RequestViewSwitch view={view} reviewCount={0} onChange={value => setParams(current => studentApplicationViewParams(current, value), { state: location.state })} />} />
    <RequestFilters onReset={()=>setParams(current=>clearAppointmentFilterParams(current),{replace:true,state:location.state})} search={search} onSearch={value => setFilter('q', value)} searchPlaceholder="Supervisor name, research title or request reference" status={status} statuses={statuses} onStatus={value => setFilter('status', value)} from={from} onFrom={value => setFilter('from', value)}>
      <label className="form-label">Request type<PortalSelect className="form-control form-control-sm mt-1" value={type} onChange={event => setFilter('type', event.target.value)}><option value="all">All types</option><option value="primary">Primary supervisor</option><option value="replacement">Replacement supervisor</option></PortalSelect></label>
    </RequestFilters>
    {visible.length ? <WorkspaceRecordTable history={view === 'history'} identityLabel="Supervisor" label="Supervisor application records" rows={visible.slice((page - 1) * pageSize, page * pageSize).map(app => ({
      key: app.id, studentName: app.supervisor,
      matricNo: app.unavailableUntil ? `Unavailable for new appointments until ${app.unavailableUntil}` : '',
      kind: app.replacesAppointmentId ? 'Replacement supervisor' : 'Primary supervisor', submittedAt: applicationDate(app.date),
      status: requestStatusLabel(app.workflowStatus ?? app.status), workflowStatus: app.workflowStatus ?? app.status, waitingDays: app.waitingDays ?? requestWaitingDays(app.waitingSince ?? ''), waitingApplicable: view !== 'history',
      actionLabel: 'View request', disabled: app.applicationId === undefined || !onViewApplication,
      onOpen: () => app.applicationId !== undefined && onViewApplication?.(String(app.applicationId)),
    }))} /> : <p className="card-description rounded-lg bg-slate-50 p-4">{filtered ? 'No matching requests. Adjust the filters to see more records.' : view === 'history' ? 'No final request outcomes yet.' : 'No ongoing supervisor requests.'}</p>}
    <WorkspacePagination page={page} pageCount={pageCount} total={visible.length} noun="requests" pageSize={pageSize} onPageSize={value => setFilter('size', String(value))} onPage={value => setFilter('page', String(value), false)} />
  </section>;
}

export function StudentSupervisorApplications({ applications, onViewApplication, compact = false }: StudentApplicationListProps) {
  if (!compact) return <StudentApplicationWorkspace applications={applications} onViewApplication={onViewApplication} />;
  const { pending } = partitionSupervisorApplications(applications);
  return <AppointmentSection title="Current request">
    {pending.length ? <div className="divide-y divide-slate-100">{pending.map(app => <article key={app.id} className="flex flex-col items-start justify-between gap-3 py-3 sm:flex-row">
      <div className="min-w-0 space-y-1">
        <h3 className="card-value break-words">{app.supervisor}</h3>
        <p className="card-description">{app.replacesAppointmentId ? 'Replacement supervisor' : 'Primary supervisor'} · Submitted {app.date}</p>
        {formatSupervisorWaiting(app) !== '-' && <p className="card-description">{formatSupervisorWaiting(app)}</p>}
        {app.unavailableUntil && <p className="card-description text-amber-700">Unavailable for new appointments until {app.unavailableUntil}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <StatusBadge tone={getStatusBadgeTone(app.status)} dot>{requestStatusLabel(app.workflowStatus ?? app.status)}</StatusBadge>
        <PortalButton size="sm" className="min-h-11" icon={Eye} disabled={app.applicationId === undefined || !onViewApplication} onClick={() => app.applicationId !== undefined && onViewApplication?.(String(app.applicationId))}>View request</PortalButton>
      </div>
    </article>)}</div> : <p className="card-description">No ongoing supervisor request.</p>}
  </AppointmentSection>;
}
