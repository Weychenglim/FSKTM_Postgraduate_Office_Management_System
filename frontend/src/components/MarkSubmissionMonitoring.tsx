import React, { useState } from 'react';
import { ChartNoAxesCombined, Search } from 'lucide-react';
import type { EvaluationPeriodOption } from '../types';
import type { MarkRecordStatusTab } from '../utils/markRecords';
import { monitoringPeriods } from '../utils/marksOverview';
import { formatPeriodStatus } from '../utils/marksProductionManagement';
import { PortalButton, PortalCard, ProgressBar, StatusBadge, getStatusBadgeTone } from './PortalPrimitives';
import { PortalSelect } from './PortalSelect';
import { MarksHeading } from './MarksPrimitives';

const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric',
}) : 'Not configured';

export function MarkSubmissionMonitoring({ periods = [], onViewRecords }: {
  periods?: EvaluationPeriodOption[];
  onViewRecords?: (status?: MarkRecordStatusTab, periodId?: number) => void;
}) {
  const [status, setStatus] = useState('current');
  const [page, setPage] = useState(1);
  const rows = monitoringPeriods(periods, status);
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pages);
  return <PortalCard id="monitoring-card" padding="none" className="min-w-0 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 p-6">
      <MarksHeading icon={ChartNoAxesCombined}>Submission monitoring</MarksHeading>
      {onViewRecords && <PortalButton icon={Search} onClick={() => onViewRecords()}>View mark records</PortalButton>}
    </div>
    <div className="border-y border-slate-100 px-6 py-4">
      <label className="form-label block max-w-xs">Period status
        <PortalSelect className="form-control form-control-md mt-2" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
          <option value="current">Open and scheduled</option><option value="OPEN">Open</option>
          <option value="SCHEDULED">Scheduled</option><option value="CLOSED">Closed</option>
        </PortalSelect>
      </label>
    </div>
    {rows.length ? <div role="region" aria-label="Submission progress by period" tabIndex={0} className="overflow-x-auto">
      <table className="data-table min-w-[720px] [&_th]:px-6 [&_th]:py-4 [&_td]:px-6 [&_td]:py-5">
        <colgroup><col style={{width:'36%'}}/><col style={{width:'27%'}}/><col style={{width:'15%'}}/><col style={{width:'22%'}}/></colgroup>
        <thead><tr>{['Period / evaluator role', 'Schedule', 'Submitted', 'Progress'].map(label => <th key={label} className="data-th" style={{ fontSize: '0.875rem' }}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice((currentPage - 1) * 10, currentPage * 10).map(period => {
          const total = period.taskTotals?.total ?? 0;
          const submitted = period.taskTotals?.submitted ?? 0;
          return <tr key={period.id}>
            <td className="data-td"><p className="card-value">{period.name}</p><p className="card-description mt-2">{period.evaluatorRoles.map(role => role === 'SUPERVISOR' ? 'Supervisor' : 'Panel').join(' and ')}</p></td>
            <td className="data-td"><p className="card-description mb-2">{date(period.opensAt)} – {date(period.closesAt)}</p><StatusBadge tone={getStatusBadgeTone(period.effectiveStatus)}>{formatPeriodStatus(period.effectiveStatus)}</StatusBadge></td>
            <td className="data-td"><button type="button" disabled={!onViewRecords} className="rounded px-2 py-2 text-sm font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 disabled:text-slate-600 disabled:no-underline" aria-label={`View records for ${period.name}`} onClick={() => onViewRecords?.('All Records', period.id)}>{submitted} / {total}</button></td>
            <td className="data-td">{total ? <div className="space-y-2"><ProgressBar value={submitted} max={total} tone="brand"/><p className="card-description">{Math.round(submitted / total * 100)}% submitted</p></div> : <span className="card-description">No tasks yet</span>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div> : <div className="px-6 py-8"><p className="text-sm font-semibold text-brand-navy">No {status === 'current' ? 'open or scheduled' : status.toLowerCase()} periods</p></div>}
    {pages > 1 && <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4"><span className="card-description">Page {currentPage} of {pages} · {rows.length} periods</span><div className="flex gap-2"><PortalButton disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</PortalButton><PortalButton disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</PortalButton></div></footer>}
  </PortalCard>;
}
