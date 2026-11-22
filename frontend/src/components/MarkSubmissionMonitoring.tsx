import React, { useEffect, useId, useMemo, useState } from 'react';
import { ChartNoAxesCombined, Search } from 'lucide-react';
import type { EvaluationPeriodOption } from '../types';
import type { MarkRecordStatusTab } from '../utils/markRecords';
import { monitoringPeriods, monitoringTaskStatus } from '../utils/marksOverview';
import { getEvaluationRecipientPreview } from '../services/marksApi';
import { formatPeriodStatus } from '../utils/marksProductionManagement';
import { shortAssessmentLabel } from '../utils/assessment';
import { PortalButton, PortalCard, StatusBadge, getStatusBadgeTone } from './PortalPrimitives';
import { MarksHeading } from './MarksPrimitives';

const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric',
}) : 'Not configured';

export function MarkSubmissionMonitoring({ periods = [], onViewRecords, onGenerateTasks }: {
  periods?: EvaluationPeriodOption[];
  onViewRecords?: (status?: MarkRecordStatusTab, periodId?: number) => void;
  onGenerateTasks?: (periodId: number) => void;
}) {
  const [status, setStatus] = useState<'current' | 'CLOSED'>(() =>
    monitoringPeriods(periods, 'current').length === 0 && monitoringPeriods(periods, 'CLOSED').length > 0 ? 'CLOSED' : 'current');
  const [page, setPage] = useState(1);
  const tabsId = useId();
  const statusOptions = [
    {value: 'current' as const, label: `Open & scheduled (${monitoringPeriods(periods, 'current').length})`},
    {value: 'CLOSED' as const, label: `Closed (${monitoringPeriods(periods, 'CLOSED').length})`},
  ];
  const rows = useMemo(() => monitoringPeriods(periods, status), [periods, status]);
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pages);
  const visiblePeriods = useMemo(() => rows.slice((currentPage - 1) * 10, currentPage * 10), [rows, currentPage]);
  const [readiness, setReadiness] = useState<Record<number, number | 'error'>>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setReadiness({});
    const eligiblePeriods = visiblePeriods.filter(period => ['OPEN', 'SCHEDULED'].includes(period.effectiveStatus));
    void Promise.allSettled(eligiblePeriods.map(period => getEvaluationRecipientPreview(period.id))).then(results => {
      if (cancelled) return;
      setReadiness(Object.fromEntries(results.map((result, index) => [eligiblePeriods[index].id,
        result.status === 'fulfilled' ? result.value.totals.new : 'error'])));
    });
    return () => { cancelled = true; };
  }, [visiblePeriods, attempt]);
  return <PortalCard id="monitoring-card" padding="none" className="min-w-0 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 p-6">
      <MarksHeading icon={ChartNoAxesCombined}>Submission monitoring</MarksHeading>
      {onViewRecords && <PortalButton icon={Search} onClick={() => onViewRecords()}>View mark records</PortalButton>}
    </div>
    <div className="px-6">
      <div role="tablist" aria-label="Period status" className="flex gap-6">
        {statusOptions.map((option, index) => <button key={option.value} id={`${tabsId}-${option.value}`} type="button" role="tab"
          aria-selected={status === option.value} aria-controls={`${tabsId}-panel`} tabIndex={status === option.value ? 0 : -1}
          onClick={() => {setStatus(option.value); setPage(1);}}
          onKeyDown={event => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? statusOptions.length - 1 : event.key === 'ArrowRight' ? (index + 1) % statusOptions.length : event.key === 'ArrowLeft' ? (index + statusOptions.length - 1) % statusOptions.length : null;
            if (next === null) return;
            event.preventDefault(); setStatus(statusOptions[next].value); setPage(1); document.getElementById(`${tabsId}-${statusOptions[next].value}`)?.focus();
          }}
          className={`card-value border-b-2 px-1 pb-3 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${status === option.value ? 'border-brand-navy text-brand-navy' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
          {option.label}
        </button>)}
      </div>
    </div>
    <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${status}`}>
    {rows.length ? <div role="region" aria-label="Submission progress by period" tabIndex={0} className="mt-4 overflow-x-auto">
      <table className="data-table min-w-[820px] [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-4 [&_tr>:first-child]:pl-6 [&_tr>:last-child]:pr-6 [&_tbody_tr:not(:last-child)]:border-b [&_tbody_tr:not(:last-child)]:border-slate-100">
        <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Mark entry period', 'Assessment', 'Marking window', 'Submissions', 'Task status', 'Action'].map(label => <th key={label} scope="col" className="data-th whitespace-nowrap">{label}</th>)}</tr></thead>
        <tbody>{visiblePeriods.map(period => {
          const total = period.taskTotals?.total ?? 0;
          const submitted = period.taskTotals?.submitted ?? 0;
          const missing = readiness[period.id];
          const taskStatus = monitoringTaskStatus(period, typeof missing === 'number' ? missing : undefined);
          return <tr key={period.id}>
            <td className="data-td"><p className="card-value">{period.name}</p><p className="card-description mt-1">{period.evaluatorRoles.map(role => role === 'SUPERVISOR' ? 'Supervisor' : 'Panel').join(' and ')}</p></td>
            <td className="data-td font-medium">{shortAssessmentLabel(period.assessment)}</td>
            <td className="data-td"><p className="card-description whitespace-nowrap">{date(period.opensAt)} – {date(period.closesAt)}</p>{status === 'current' && <div className="mt-1.5"><StatusBadge tone={getStatusBadgeTone(period.effectiveStatus)}>{formatPeriodStatus(period.effectiveStatus)}</StatusBadge></div>}</td>
            <td className="data-td whitespace-nowrap tabular-nums">{total ? `${submitted} of ${total} submitted` : <span aria-label="No evaluation tasks">—</span>}</td>
            <td className="data-td"><div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={missing === 'error' ? 'neutral' : taskStatus.tone}>{missing === 'error' ? 'Status unavailable' : taskStatus.label}</StatusBadge>
                {missing === 'error' ? <PortalButton size="sm" onClick={() => setAttempt(value => value + 1)}>Retry status</PortalButton> : taskStatus.canGenerate && onGenerateTasks ? <PortalButton size="sm" onClick={() => onGenerateTasks(period.id)}>Generate tasks</PortalButton> : null}
            </div></td>
            <td className="data-td whitespace-nowrap">{onViewRecords ? <PortalButton size="sm" aria-label={`View records for ${period.name}`} onClick={() => onViewRecords('All Records', period.id)}>View records</PortalButton> : '—'}</td>
          </tr>;
        })}</tbody>
      </table>
    </div> : <div className="px-6 py-8"><p className="text-sm text-slate-600">No {status === 'current' ? 'open or scheduled' : 'closed'} periods.</p></div>}
    {pages > 1 && <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4"><span className="card-description">Page {currentPage} of {pages} · {rows.length} periods</span><div className="flex gap-2"><PortalButton disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</PortalButton><PortalButton disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</PortalButton></div></footer>}
    </div>
  </PortalCard>;
}
