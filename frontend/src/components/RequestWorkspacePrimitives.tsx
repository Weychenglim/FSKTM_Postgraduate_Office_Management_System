import { PortalSelect } from './PortalSelect';
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PortalButton } from './PortalPrimitives';
import { requestStatusLabel } from '../utils/lecturerRequests';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { formatRequestStageWaiting } from '../utils/requestStageWaiting';
import { RequestStatusBadge } from './RequestStatusBadge';

export function WorkspaceSectionHeader({ title, description, actions }: { title?: string; description?: string; actions?: React.ReactNode }) {
  return <header className="flex flex-wrap items-center justify-between gap-3">
    {title ? <div className="min-w-0 basis-64 flex-1"><h2 className="section-label">{title}</h2>{description ? <p className="card-description mt-1">{description}</p> : null}</div> : null}
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </header>;
}

export type RequestListView = 'requests' | 'history';
export function AppointmentViewSwitch({view, onChange, focusRequest, label = 'Appointment views', currentLabel = 'Current appointments', pastLabel = 'Past appointments'}: {
  view: 'current' | 'past'; onChange: (value: 'current' | 'past') => void; focusRequest?: React.RefObject<boolean>; label?: string; currentLabel?: string; pastLabel?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!focusRequest?.current) return;
    group.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({preventScroll: true});
    focusRequest.current = false;
  }, [view, focusRequest]);
  return <div ref={group} role="group" aria-label={label} className="flex w-fit flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
    {([['current', currentLabel], ['past', pastLabel]] as const).map(([value, text]) => <button type="button" key={value} aria-pressed={view === value} onClick={event => {
      if (value === view) return;
      if (focusRequest) focusRequest.current = document.activeElement === event.currentTarget;
      onChange(value);
    }}
      className={`card-value rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${view === value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}>{text}</button>)}
  </div>;
}
export function WorkspaceFilterActions({ onReset, children }: { onReset: () => void; children?: React.ReactNode }) {
  return <div className={`mt-4 flex flex-wrap items-start gap-3 border-t border-slate-200 pt-3 ${children ? 'justify-between' : 'justify-end'}`}>
    <PortalButton size="sm" onClick={onReset}>Clear filters</PortalButton>
    {children ? <div className="flex min-w-0 flex-wrap items-start gap-2">{children}</div> : null}
  </div>;
}
export function WorkspaceFilterCard({ children, onReset, actions, fieldsClassName = 'grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4' }: {
  children: React.ReactNode; onReset: () => void; actions?: React.ReactNode; fieldsClassName?: string;
}) {
  return <div data-workspace-filter-card className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className={fieldsClassName}>{children}</div>
    <WorkspaceFilterActions onReset={onReset}>{actions}</WorkspaceFilterActions>
  </div>;
}
export const WORKSPACE_PAGE_SIZE = 10;
export function workspacePageSize(value: unknown) { return [10, 25, 50].includes(Number(value)) ? Number(value) : WORKSPACE_PAGE_SIZE; }
export function WorkspacePagination({ page, pageCount, total, noun, onPage, pageSize = WORKSPACE_PAGE_SIZE, onPageSize }: { page: number; pageCount: number; total: number; noun: string; onPage: (page: number) => void; pageSize?: number; onPageSize?: (size: number) => void }) {
  return total > 0 && (pageCount > 1 || onPageSize) ? <div className="flex flex-wrap items-center justify-between gap-3">
    {onPageSize ? <label className="card-description flex items-center gap-2">Rows per page<PortalSelect className="form-control form-control-sm w-20" value={pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</PortalSelect></label> : null}
    <p className="card-description">Page {page} of {pageCount} · {total} {total === 1 && noun.endsWith('s') ? noun.slice(0, -1) : noun}</p>
    {pageCount > 1 ? <div className="flex gap-2"><PortalButton size="sm" disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</PortalButton><PortalButton size="sm" disabled={page === pageCount} onClick={() => onPage(page + 1)}>Next</PortalButton></div> : null}
  </div> : null;
}

export type WorkspaceRecord = { key: string | number; studentName: string; matricNo: string; kind?: string; submittedAt?: string; status?: string; workflowStatus?: string; waitingDays?: number | null; waitingApplicable?: boolean; programme?: string; role?: string; actionLabel: string; onOpen?: () => void; disabled?: boolean; actionAriaLabel?: string };
export function WorkspaceRecordTable({ rows, label, roster = false, identityLabel = 'Student', roleLabel = 'Your role', hideRequestType = false, dateLabel = 'Submitted', history = false }: { rows: WorkspaceRecord[]; label: string; roster?: boolean; identityLabel?: string; roleLabel?: string; hideRequestType?: boolean; dateLabel?: string; history?: boolean }) {
  const columns = roster ? [identityLabel, 'Programme', roleLabel, 'Action'] : [identityLabel, ...(!hideRequestType ? ['Request type'] : []), dateLabel, history ? 'Outcome' : 'Current stage', ...(!history ? ['Waiting at this stage'] : []), 'Action'];
  return <table aria-label={label} role="table" className="data-table block table-fixed lg:table">
    <colgroup className="hidden lg:table-column-group">{(roster ? [28, 33, 17, 22] : history ? hideRequestType ? [36, 20, 24, 20] : [28, 18, 16, 20, 18] : hideRequestType ? [28, 16, 24, 14, 18] : [24, 14, 12, 20, 12, 18]).map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
    <thead role="rowgroup" className="hidden lg:table-header-group"><tr role="row" className="data-thead bg-slate-50">{columns.map(column => <th key={column} scope="col" role="columnheader" className="data-th">{column}</th>)}</tr></thead>
    <tbody role="rowgroup" className="block space-y-3 lg:table-row-group lg:space-y-0">{rows.map(row => {
      const cells: React.ReactNode[] = [<><p className="[overflow-wrap:anywhere]">{row.studentName}</p>{row.matricNo ? <p className="card-caption mt-1 [overflow-wrap:anywhere]">{row.matricNo}</p> : null}</>];
      if (roster) cells.push(row.programme || 'Not recorded', row.role || 'Not recorded');
      else cells.push(...(!hideRequestType ? [row.kind] : []), row.submittedAt ? formatMalaysiaDate(row.submittedAt) : 'Not recorded', row.status ? <RequestStatusBadge status={row.workflowStatus ?? row.status} label={row.status}/> : null, ...(!history ? [formatRequestStageWaiting(row.workflowStatus ?? row.status, row.waitingDays, row.waitingApplicable)] : []));
      cells.push(<PortalButton size="sm" className="whitespace-nowrap" variant={row.actionLabel === 'Review request' ? 'primary' : 'secondary'} disabled={row.disabled} aria-label={row.actionAriaLabel} onClick={row.onOpen}>{row.actionLabel}</PortalButton>);
      return <tr key={row.key} role="row" className="data-row grid grid-cols-2 rounded-xl border border-slate-200 py-2 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:py-0">{cells.map((cell, index) => <td key={columns[index]} role="cell" className={`${index === 0 ? 'data-td-strong' : 'data-td'} block min-w-0 px-3 py-2 align-middle [overflow-wrap:anywhere] lg:table-cell lg:px-5 lg:py-4 ${index === 0 || index === cells.length - 1 || roster ? 'col-span-2' : ''} ${index === cells.length - 1 ? 'text-left' : ''}`}>
        {index > 0 && index < cells.length - 1 ? <span className="card-label mb-1 block lg:hidden">{columns[index]}</span> : null}{cell}
      </td>)}</tr>;
    })}</tbody>
  </table>;
}

export function WorkspaceRequestReference({ reference }: { reference: string }) {
  const [notice, setNotice] = useState('');
  return <div className="space-y-2"><p className="card-description">Request reference: <span className="font-semibold text-slate-700">{reference}</span></p><PortalButton size="sm" onClick={async () => { try { await navigator.clipboard.writeText(reference); setNotice('Reference copied.'); } catch { setNotice('Copy unavailable. Select the reference above to copy it.'); } }}>Copy reference</PortalButton>{notice ? <p role="status" className="card-description">{notice}</p> : null}</div>;
}
export function RequestViewSwitch({ view, reviewCount, onChange }: { view: RequestListView; reviewCount: number; onChange: (view: RequestListView) => void }) {
  return <div role="group" aria-label="Request views" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 w-fit">
    {(['requests', 'history'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => onChange(value)}
      className={`card-value rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${view === value ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}>
      {value === 'requests' ? 'Requests' : 'History'}{value === 'requests' && reviewCount > 0 ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">{reviewCount} to review</span> : null}
    </button>)}
  </div>;
}

export function RequestFilters({ search, onSearch, type, onType, status = '', onStatus, statuses = [], semester = '', semesters = [], onSemester, from = '', onFrom, onReset, searchLabel = 'Find a request', searchPlaceholder = 'Student name, matric number or request', children }: {
  search: string; onSearch: (value: string) => void; type?: string; onType?: (value: string) => void;
  status?: string; onStatus?: (value: string) => void; statuses?: string[];
  semester?: string; semesters?: string[]; onSemester?: (value: string) => void; from?: string; onFrom?: (value: string) => void;
  onReset?: () => void; searchLabel?: string; searchPlaceholder?: string; children?: React.ReactNode;
}) {
  return <WorkspaceFilterCard fieldsClassName="flex flex-wrap items-end gap-3" onReset={onReset ?? (()=>{onSearch('');onType?.('all');onStatus?.('');onSemester?.('');onFrom?.('');})}>
    <label className="form-label min-w-48 flex-1">{searchLabel}<input className="form-control form-control-sm mt-1" type="search" value={search} placeholder={searchPlaceholder} onChange={event => onSearch(event.target.value)} /></label>
    {children}
    {onType ? <label className="form-label">Request type<PortalSelect className="form-control form-control-sm mt-1" value={type} onChange={event => onType(event.target.value)}><option value="all">All types</option><option value="primary">Primary supervisor</option><option value="supporting">Supporting supervisor</option></PortalSelect></label> : null}
    {onStatus ? <label className="form-label">Status<PortalSelect className="form-control form-control-sm mt-1" value={status} onChange={event => onStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{requestStatusLabel(value)}</option>)}</PortalSelect></label> : null}
    {onSemester ? <label className="form-label">Semester<PortalSelect className="form-control form-control-sm mt-1" value={semester} onChange={event => onSemester(event.target.value)}><option value="">All semesters</option>{semesters.map(value => <option key={value}>{value}</option>)}</PortalSelect></label> : null}
    {onFrom ? <label className="form-label">Submitted on or after<input className="form-control form-control-sm mt-1" type="date" value={from} onChange={event => onFrom(event.target.value)} /></label> : null}
  </WorkspaceFilterCard>;
}

export function RequestReviewPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); focused?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); closeRef.current(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-xl border-0 bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/40">
    <div className="flex h-full flex-col"><div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5"><h2 id={titleId} className="section-label">{title}</h2><PortalButton size="icon" icon={X} aria-label="Close request" onClick={onClose} /></div><div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">{children}</div></div>
  </dialog>;
}
