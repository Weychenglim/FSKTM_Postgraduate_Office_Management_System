/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import type { ResearchAmendment, ResearchPagination } from '../services/researchAmendmentsApi';
import { getResearchAmendmentsPage } from '../services/researchAmendmentsApi';
import { getProgrammeCoordinators } from '../services/programmeTransfersApi';
import { routeForProgrammeTransfer } from '../constants/routes';
import { historyTime } from '../utils/documentDisplay';
import {
  coordinatorDirectory,
  daysSince,
  daysText,
  shortProgramme,
  stageSince,
  stageText,
  transferOutcome,
  waitingForText,
  type CoordinatorDirectory,
} from '../utils/programmeTransfers';
import { PageHeader, PortalButton, SegmentedControl, StatusBadge } from './PortalPrimitives';
import { RegistryModuleTabs } from './RegistryModuleTabs';
import { ErrorState, LoadingState } from './StateViews';

type View = 'requests' | 'history';
const PAGE_SIZE = 10;

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** Registry's Programme transfers tab: the office follows every transfer, a coordinator sees the ones waiting for them. */
export const ProgrammeTransfers: React.FC<{ office: boolean }> = ({ office }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'history' ? 'history' : 'requests';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = params.get('q') ?? '';
  const [search, setSearch] = useState(query);
  const [rows, setRows] = useState<ResearchAmendment[] | null>(null);
  const [pagination, setPagination] = useState<ResearchPagination | null>(null);
  const [directory, setDirectory] = useState<CoordinatorDirectory>({});
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const update = (changes: Record<string, string>) => setParams(current => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return next;
  }, { replace: true });

  useEffect(() => {
    getProgrammeCoordinators().then(found => setDirectory(coordinatorDirectory(found))).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() !== query) update({ q: search.trim(), page: '' });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    getResearchAmendmentsPage({ type: 'TRANSFER', view, q: query, page, size: PAGE_SIZE }, office)
      .then(found => {
        if (cancelled) return;
        setRows(found.requests);
        setPagination(found.pagination ?? null);
      })
      .catch(err => !cancelled && setError(errorText(err, 'Could not load the programme transfers.')));
    return () => {
      cancelled = true;
    };
  }, [view, query, page, office, reload]);

  const from = `${location.pathname}${location.search}`;
  const openTransfer = (row: ResearchAmendment) => navigate(routeForProgrammeTransfer(row.id), { state: { recordReturn: { path: from, label: 'Programme transfers' } } });
  const waitingLabel = office ? 'Pending' : `Waiting for you${pagination ? ` (${pagination.reviewCount})` : ''}`;
  const empty = query
    ? 'No transfers match your search.'
    : view === 'history' ? 'No finished transfers yet.' : office ? 'No transfers are waiting. Start one from a Student Record.' : 'Nothing is waiting for you.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programme Transfers"
        subtitle={office
          ? 'Students moving to another programme. The coordinators of both programmes approve each one.'
          : 'Transfers that need your approval, and the ones already finished.'}
      />
      <RegistryModuleTabs active="transfers" office={office} />

      <section aria-label="Programme transfers" className="app-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
          <SegmentedControl<View>
            options={['requests', 'history']}
            value={view}
            labels={{ requests: waitingLabel, history: 'Past' }}
            onChange={value => update({ view: value === 'history' ? 'history' : '', page: '' })}
          />
          <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" aria-label="Search transfers" className="form-control form-control-md pl-10 text-[14px]" placeholder="Student name or matric number"
              value={search} onChange={event => setSearch(event.target.value)} />
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
        ) : !rows ? (
          <LoadingState message="Loading programme transfers..." />
        ) : !rows.length ? (
          <p className="border-t border-slate-100 px-5 py-8 text-[14px] text-slate-600 sm:px-6">{empty}</p>
        ) : (
          <>
            <div aria-hidden="true" className="hidden border-t border-slate-100 px-6 pb-2 pt-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_5.5rem_6rem] md:gap-4">
              <span>Student</span><span>From and to</span><span>{view === 'history' ? 'Outcome' : 'Status'}</span><span>{view === 'history' ? '' : 'Waiting'}</span><span />
            </div>
            <ul>
              {rows.map(row => {
                const outcome = transferOutcome(row);
                return (
                  <li key={row.id} className="grid gap-x-4 gap-y-2 border-t border-slate-100 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_5.5rem_6rem] md:items-center">
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-brand-navy">{row.studentName}</p>
                      <p className="font-mono text-[12px] text-slate-500">{row.matricNo}</p>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-800" title={`${row.sourceProgramme} to ${row.destinationProgramme}`}>
                      {shortProgramme(row.sourceProgramme)} <span className="px-1 text-slate-400" aria-label="to">&rarr;</span> {shortProgramme(row.destinationProgramme)}
                    </p>
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      {outcome ? <StatusBadge tone={outcome.tone} dot>{outcome.label}</StatusBadge> : <StatusBadge tone="warning" dot>{waitingForText(row, directory)}</StatusBadge>}
                      <span className="text-[12px] text-slate-500">{outcome ? historyTime(outcome.at) : stageText(row)}</span>
                    </div>
                    <p className="text-[13px] font-bold tabular-nums text-slate-800">{outcome ? '' : daysText(daysSince(stageSince(row)))}</p>
                    <div className="md:text-right">
                      <PortalButton size="sm" variant={row.canDecide ? 'primary' : 'secondary'} onClick={() => openTransfer(row)}>{row.canDecide ? 'Review' : 'View'}</PortalButton>
                    </div>
                  </li>
                );
              })}
            </ul>
            {pagination && pagination.pageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
                <span className="text-[13px] text-slate-500">Page {pagination.page} of {pagination.pageCount} · {pagination.total} transfers</span>
                <div className="flex gap-2">
                  <PortalButton size="sm" disabled={pagination.page <= 1} onClick={() => update({ page: String(pagination.page - 1) })}>Previous</PortalButton>
                  <PortalButton size="sm" disabled={pagination.page >= pagination.pageCount} onClick={() => update({ page: String(pagination.page + 1) })}>Next</PortalButton>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
