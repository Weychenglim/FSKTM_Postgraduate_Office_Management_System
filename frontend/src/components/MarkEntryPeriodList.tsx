import {assessmentLabel} from '../utils/assessment';
import React from 'react';
import type {EvaluationPeriodOption} from '../types';
import {PortalButton, PortalCard, StatusBadge, getStatusBadgeTone} from './PortalPrimitives';
import {PortalSelect} from './PortalSelect';
import {EmptyState} from './StateViews';
import {formatPeriodStatus} from '../utils/marksProductionManagement';

type Filters = {search: string; status: string; page: number};

export function MarkEntryPeriodList({periods, filters, busy, onManage, onFiltersChange}: {
  periods: EvaluationPeriodOption[]; filters: Filters; busy: boolean;
  onManage: (period: EvaluationPeriodOption) => void;
  onFiltersChange: (filters: Filters) => void;
}) {
  const rows = periods.filter(period =>
    (filters.status === 'all' || (filters.status === 'archived' ? period.lifecycleStatus === 'ARCHIVED' : period.lifecycleStatus !== 'ARCHIVED')) &&
    `${period.name} ${assessmentLabel(period.assessment)} ${period.semester} ${period.rubricName}`.toLowerCase().includes(filters.search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const page = Math.min(filters.page, pages);
  return <PortalCard padding="none" className="overflow-hidden" data-period-list>
    <div className="grid gap-4 border-b border-slate-200 p-6 sm:grid-cols-[minmax(0,1fr)_200px]">
      <label className="form-label">Find a period<input id="evaluation-period-search" className="form-control form-control-md mt-2" placeholder="Period, semester or rubric" value={filters.search} onChange={event => onFiltersChange({...filters, search: event.target.value, page: 1})} /></label>
      <label className="form-label">Status<PortalSelect className="form-control form-control-md mt-2" value={filters.status} disabled={busy} onChange={event => onFiltersChange({...filters, status: event.target.value, page: 1})}><option value="current">Current periods</option><option value="archived">Archived periods</option><option value="all">Include archived periods</option></PortalSelect></label>
    </div>
    {rows.length ? <div className="overflow-x-auto" role="region" aria-label="Evaluation periods" tabIndex={0}>
      <table className="data-table min-w-[760px] [&_th]:px-6 [&_th]:py-4 [&_td]:px-6 [&_td]:py-5">
        <colgroup><col style={{width: '24%'}} /><col style={{width: '20%'}} /><col style={{width: '22%'}} /><col style={{width: '14%'}} /><col style={{width: '20%'}} /></colgroup>
        <thead><tr>{['Period', 'Academic semester', 'Rubric', 'Status', 'Action'].map(label => <th key={label} className="data-th">{label}</th>)}</tr></thead>
        <tbody>{rows.slice((page - 1) * 10, page * 10).map(period => <tr key={period.id}>
          <td className="data-td"><span className="card-value">{period.name}</span><span className="card-description block mt-1">{assessmentLabel(period.assessment)}</span></td>
          <td className="data-td">{period.semester}</td><td className="data-td">{period.rubricName}</td>
          <td className="data-td"><StatusBadge tone={getStatusBadgeTone(period.effectiveStatus)}>{formatPeriodStatus(period.lifecycleStatus === 'PUBLISHED' ? period.effectiveStatus : period.lifecycleStatus)}</StatusBadge></td>
          <td className="data-td"><div className="flex flex-col items-start gap-2" role="group" aria-label={`Actions for ${period.name}`}>
            <PortalButton className="shrink-0 whitespace-nowrap" disabled={busy} onClick={() => onManage(period)}>Manage period</PortalButton>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div> : <EmptyState title="No matching periods" description="Change the search or status filter." />}
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4"><span className="card-description">{rows.length} {rows.length === 1 ? 'period' : 'periods'} · Page {page} of {pages}</span><div className="flex gap-2"><PortalButton disabled={page <= 1} onClick={() => onFiltersChange({...filters, page: page - 1})}>Previous</PortalButton><PortalButton disabled={page >= pages} onClick={() => onFiltersChange({...filters, page: page + 1})}>Next</PortalButton></div></footer>
  </PortalCard>;
}
