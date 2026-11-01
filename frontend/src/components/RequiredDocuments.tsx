/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { BellRing } from 'lucide-react';
import type { RequiredOverview, RequiredShow, RequiredStudent, RequiredTypeProgress } from '../types';
import { getRequiredOverview, getRequiredStudents, remindRequired } from '../services/filesApi';
import { APP_ROUTES, routeForDocument } from '../constants/routes';
import { handedIn, historyTime, requiredGroups, stillToHandIn } from '../utils/documentDisplay';
import { PortalButton, PortalConfirmModal, PortalToast } from './PortalPrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** The office's and coordinators' view of documents every student must hand in. */
export const RequiredDocuments: React.FC<{ isOffice: boolean }> = ({ isOffice }) => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<RequiredOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<{ id: number; show: RequiredShow } | null>(null);
  const [reminding, setReminding] = useState<RequiredTypeProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getRequiredOverview()
      .then(found => !cancelled && setOverview(found))
      .catch(err => !cancelled && setError(errorText(err, 'Could not load the required documents.')));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const remind = async () => {
    if (!reminding) return;
    setBusy(true);
    try {
      const result = await remindRequired(reminding.id);
      setToast({ message: `Reminded ${result.sent === 1 ? '1 student' : `${result.sent} students`} about the ${reminding.label}.`, tone: 'success' });
    } catch (err) {
      setToast({ message: errorText(err, 'Could not send the reminder.'), tone: 'danger' });
    } finally {
      setBusy(false);
      setReminding(null);
      setReload(value => value + 1);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />;
  if (!overview) return <LoadingState message="Loading required documents..." />;
  if (!overview.types.length) {
    return (
      <section className="app-card">
        <EmptyState
          title="No required documents yet."
          description={isOffice ? 'In Settings, turn on "Every student must hand it in" for a document type.' : 'The PG office decides which documents every student must hand in.'}
          actionLabel={isOffice ? 'Open Settings' : undefined}
          onAction={isOffice ? () => navigate(APP_ROUTES.filesSettings) : undefined}
        />
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {overview.types.map(item => {
        const owed = stillToHandIn(item);
        const shown = open?.id === item.id ? open.show : null;
        return (
          <section key={item.id} aria-label={item.label} className="app-card">
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div className="min-w-0">
                <h2 className="text-[16px] font-extrabold text-brand-navy">{item.label}</h2>
                <p className="text-[13px] text-slate-500">
                  {[item.dueNote, item.programmes.length ? item.programmes.join(', ') : 'Every programme'].filter(Boolean).join(' · ')}
                </p>
              </div>
              {overview.canRemind && (
                <PortalButton size="sm" icon={BellRing} disabled={item.remindedToday || !owed} onClick={() => setReminding(item)}>
                  {item.remindedToday ? 'Reminded today' : 'Remind'}
                </PortalButton>
              )}
            </div>
            <div className="space-y-3 px-5 pb-5">
              {item.students > 0 ? (
                <>
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-emerald-500" style={{ width: `${(item.done / item.students) * 100}%` }} />
                      <div className="h-full bg-amber-500" style={{ width: `${(item.waiting / item.students) * 100}%` }} />
                    </div>
                    <span className="whitespace-nowrap text-[13px] font-bold tabular-nums text-slate-900">{handedIn(item)}/{item.students} handed in</span>
                  </div>
                  <div role="group" aria-label={`Students for the ${item.label}`} className="flex flex-wrap gap-2">
                    {requiredGroups(item).map(group => (
                      <button
                        key={group.show}
                        type="button"
                        aria-pressed={shown === group.show}
                        disabled={!group.count}
                        onClick={() => setOpen(shown === group.show ? null : { id: item.id, show: group.show })}
                        className={`inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[13px] font-semibold tabular-nums text-slate-700 transition disabled:cursor-default disabled:opacity-50 ${shown === group.show ? 'border-brand-navy ring-1 ring-brand-navy' : 'border-slate-200 hover:bg-slate-50 disabled:hover:bg-white'}`}
                      >
                        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${group.dot}`} />
                        <span className="font-extrabold text-slate-900">{group.count}</span> {group.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-slate-700">No Active student has to hand it in yet.</p>
              )}
              {item.lastReminder && (
                <p className="text-[12px] text-slate-500">
                  Last reminded {historyTime(item.lastReminder.at)} by {item.lastReminder.by}, {item.lastReminder.students === 1 ? '1 student' : `${item.lastReminder.students} students`}.
                </p>
              )}
              {shown && <RequiredNames item={item} show={shown} />}
            </div>
          </section>
        );
      })}
      <PortalConfirmModal
        isOpen={reminding !== null}
        title={`Remind students about the ${reminding?.label ?? ''}?`}
        message={`${reminding ? stillToHandIn(reminding) : 0} students still have to hand it in. They get a notice in the portal, and an email if they have deadline reminders on. You can remind them once a day.`}
        confirmLabel="Send reminder"
        cancelLabel="Not now"
        tone="info"
        icon={BellRing}
        isLoading={busy}
        onConfirm={() => void remind()}
        onCancel={() => setReminding(null)}
      />
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </div>
  );
};

const RequiredNames: React.FC<{ item: RequiredTypeProgress; show: RequiredShow }> = ({ item, show }) => {
  const location = useLocation();
  const [rows, setRows] = useState<RequiredStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const from = `${location.pathname}${location.search}`;

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    getRequiredStudents(item.id, show)
      .then(found => !cancelled && setRows(found))
      .catch(err => !cancelled && setError(errorText(err, 'Could not load the names.')));
    return () => {
      cancelled = true;
    };
  }, [item.id, show, reload]);

  return (
    <div className="border-t border-slate-100 pt-2">
      {error ? (
        <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />
      ) : !rows ? (
        <LoadingState message="Loading names..." />
      ) : !rows.length ? (
        <p className="text-[13px] text-slate-600">Nobody here.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map(row => (
            <li key={row.matric} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <Link to={`${APP_ROUTES.files}?student=${encodeURIComponent(row.matric)}`} className="text-[14px] font-bold text-brand-navy hover:underline">{row.name}</Link>
                <p className="text-[12px] text-slate-500">{row.matric}{row.programme ? ` · ${row.programme}` : ''}</p>
              </div>
              <span className="flex items-center gap-3">
                {row.state === 'RETURNED' && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">Returned</span>}
                {row.documentId && <Link to={routeForDocument(row.documentId)} state={{ from }} className="text-[13px] font-bold text-blue-700 hover:text-blue-900">Open file</Link>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
