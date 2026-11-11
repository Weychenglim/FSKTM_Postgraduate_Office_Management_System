/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search } from 'lucide-react';
import type { HistoryEntry, HistoryShow } from '../types';
import { getDocumentHistory } from '../services/filesApi';
import { APP_ROUTES, routeForDocument } from '../constants/routes';
import { historyTime } from '../utils/documentDisplay';
import { PortalButton } from './PortalPrimitives';
import { RecordPage } from './RecordPage';
import { SelectMenu } from './SelectMenu';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const SHOW_OPTIONS: Array<{ value: HistoryShow; label: string }> = [
  { value: 'all', label: 'All changes' },
  { value: 'uploads', label: 'Uploads' },
  { value: 'changes', label: 'New versions, edits and sharing' },
  { value: 'archive', label: 'Archived and restored' },
  { value: 'deleted', label: 'Deleted files' },
  { value: 'opened', label: 'Opened and downloaded' },
];

/** The office's record of everything that happened to files. */
export const FileHistory: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [show, setShow] = useState<HistoryShow>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    setMoreError(false);
    getDocumentHistory(show, query)
      .then(page => {
        if (cancelled) return;
        setRows(page.results);
        setCount(page.count);
      })
      .catch(err => !cancelled && setError(errorText(err, 'Could not load the history.')));
    return () => {
      cancelled = true;
    };
  }, [show, query, reload]);

  const loadMore = async () => {
    if (!rows) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await getDocumentHistory(show, query, rows.length);
      setRows(current => [...(current ?? []), ...page.results]);
      setCount(page.count);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <RecordPage
      title="File history"
      backLabel="Back to Files"
      onBack={onBack}
    >
      <section aria-label="History" className="app-card">
        <div className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-5 sm:px-6">
          <SelectMenu<HistoryShow> variant="filter" size="sm" prefix="Show" aria-label="Show" value={show} options={SHOW_OPTIONS} onChange={setShow} />
          <div className="relative min-w-0 flex-1 basis-56">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" aria-label="Search the history" className="form-control form-control-md pl-10 text-[14px]" placeholder="Search by file, reference or person" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
        </div>
        {error ? (
          <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
        ) : !rows ? (
          <LoadingState message="Loading the history..." />
        ) : !rows.length ? (
          <p className="border-t border-slate-100 px-5 py-6 text-[13px] text-slate-600 sm:px-6">{query ? 'No matching entries found.' : 'Nothing here yet.'}</p>
        ) : (
          <>
            <ol>
              {rows.map(entry => (
                <li key={entry.id} className="flex flex-col gap-1 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-brand-navy">
                      {entry.documentId ? (
                        <Link to={routeForDocument(entry.documentId)} state={{ from: APP_ROUTES.filesHistory }} className="hover:underline">{entry.title}</Link>
                      ) : entry.title}
                      {entry.reference && <span className="ml-2 text-[12px] font-semibold text-slate-500">{entry.reference}</span>}
                    </p>
                    <p className="text-[13px] text-slate-700"><span className="font-semibold">{entry.actionLabel}</span>{entry.detail ? `: ${entry.detail}` : ''}</p>
                    {entry.reason && <p className="text-[13px] text-slate-600">"{entry.reason}"</p>}
                  </div>
                  <p className="shrink-0 text-[12px] text-slate-500 sm:text-right">
                    {entry.actor}
                    <span className="sm:hidden">, </span>
                    <span className="sm:block">{historyTime(entry.at)}</span>
                  </p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
              <span className="text-[13px] text-slate-500">Showing {rows.length} of {count}{moreError ? '. Could not load more.' : ''}</span>
              {rows.length < count && <PortalButton size="sm" isLoading={loadingMore} onClick={() => void loadMore()}>{moreError ? 'Try again' : 'Load more'}</PortalButton>}
            </div>
          </>
        )}
      </section>
    </RecordPage>
  );
};
