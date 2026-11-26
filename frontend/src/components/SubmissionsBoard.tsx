/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { BellRing, CalendarClock, Download, Plus } from 'lucide-react';
import type { SubmissionDetail, SubmissionOptions, SubmissionState, SubmissionStudent, SubmissionSummary } from '../services/submissionsApi';
import { getSubmission, getSubmissions, giveExtension, remindSubmission, removeExtension, setSubmissionOpen } from '../services/submissionsApi';
import { ApiError } from '../services/apiClient';
import { routeForDocument } from '../constants/routes';
import { historyTime } from '../utils/documentDisplay';
import { shortProgramme, studentCount } from '../utils/registrySemesters';
import { STAGE_LABEL, STATE_LABEL, STATE_TONE, afterDueText, csvName, fromMalaysia, malaysiaParts, sentText, submissionCsv } from '../utils/submissions';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { toastDuration } from '../utils/toastDuration';
import { SelectMenu } from './SelectMenu';
import { SubmissionFormPage } from './SubmissionFormPage';
import { DateField, TimeField } from './DateFields';
import { EmptyState, ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const pill = (on: boolean) => `inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition cursor-pointer ${on ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;

const Switch: React.FC<{ on: boolean; label: string; busy: boolean; onChange: (on: boolean) => void }> = ({ on, label, busy, onChange }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-[13px] font-bold text-slate-700 cursor-pointer disabled:opacity-60">
    <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </span>
    {on ? 'Open' : 'Closed'}
  </button>
);

const firstProblem = (err: unknown, fallback: string) => {
  if (err instanceof ApiError && err.body && typeof err.body === 'object') {
    const values = Object.values(err.body as Record<string, unknown>).flat();
    const text = values.find(value => typeof value === 'string');
    if (typeof text === 'string') return text;
  }
  return errorText(err, fallback);
};

/** File Management's Submissions: coordinators set dated hand-ins and follow them, the office looks. */
export const SubmissionsBoard: React.FC = () => {
  const [items, setItems] = useState<SubmissionSummary[] | null>(null);
  const [options, setOptions] = useState<SubmissionOptions | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ item: SubmissionSummary | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getSubmissions()
      .then(found => {
        if (cancelled) return;
        setItems(found.submissions);
        setOptions(found.options);
        setCanCreate(found.canCreate);
      })
      .catch(err => !cancelled && setError(errorText(err, 'Could not load the submissions.')));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const startNew = () => {
    if (options) setEditing({ item: null });
  };

  const startEdit = (item: SubmissionSummary) => setEditing({ item });

  const saved = (message: string) => {
    setToast({ message, tone: 'success' });
    setEditing(null);
    setReload(value => value + 1);
  };

  const toggle = async (item: SubmissionSummary, on: boolean) => {
    setBusy(true);
    try {
      await setSubmissionOpen(item.id, on);
      setToast({ message: on ? `${item.title} is open.` : `${item.title} is closed. Students can't send it now.`, tone: 'success' });
      setReload(value => value + 1);
    } catch (err) {
      setToast({ message: errorText(err, 'Could not change this.'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => setReload(value => value + 1)} />;
  if (!items || !options) return <LoadingState message="Loading submissions..." />;

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <PortalButton variant="primary" icon={Plus} onClick={startNew}>New submission</PortalButton>
        </div>
      )}
      {!items.length ? (
        <section className="app-card">
          <EmptyState icon={CalendarClock} title="No submissions yet." description={canCreate ? 'Set a due date for a file students must send.' : 'Programme coordinators set these up.'} actionLabel={canCreate ? 'New submission' : undefined} onAction={canCreate ? startNew : undefined} />
        </section>
      ) : (
        items.map(item => (
          <section key={item.id} aria-label={item.title} className="app-card">
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6">
              <div className="min-w-0 flex-[1_1_16rem] space-y-0.5">
                <h2 className="text-[16px] font-extrabold text-brand-navy [overflow-wrap:anywhere]">{item.title}</h2>
                <p className="text-[13px] text-slate-500">
                  {[item.type.label, item.programmes.map(shortProgramme).join(', '), item.stage !== 'ALL' ? STAGE_LABEL[item.stage] : '', item.isCurrent ? '' : item.semester].filter(Boolean).join(' · ')}
                </p>
                <p className="text-[13px] font-semibold text-slate-700">
                  {item.notOpenYet && item.opensAt ? `Opens ${historyTime(item.opensAt)} · ` : ''}Due {historyTime(item.dueAt)} · {afterDueText(item)}
                </p>
              </div>
              {item.canManage ? (
                <Switch on={item.isOpen} label={`${item.title} open`} busy={busy} onChange={on => void toggle(item, on)} />
              ) : (
                <StatusBadge tone={item.isOpen ? 'success' : 'neutral'} dot>{item.isOpen ? 'Open' : 'Closed'}</StatusBadge>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 sm:px-6">
              <div className="flex flex-wrap gap-2 text-[13px] font-semibold text-slate-700">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">{item.counts.ON_TIME} on time</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{item.counts.LATE} late</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{item.counts.NOT_SENT} not sent</span>
                {item.counts.extensions > 0 && <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">{item.counts.extensions} with extension</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <PortalButton size="sm" aria-expanded={openId === item.id} onClick={() => setOpenId(openId === item.id ? null : item.id)}>{openId === item.id ? 'Hide students' : 'Students'}</PortalButton>
                {item.canManage && <PortalButton size="sm" variant="ghost" onClick={() => startEdit(item)}>Edit</PortalButton>}
              </div>
            </div>
            {openId === item.id && <SubmissionStudents id={item.id} refreshKey={reload} onChanged={() => setReload(value => value + 1)} onToast={setToast} />}
          </section>
        ))
      )}

      {editing && <SubmissionFormPage options={options} item={editing.item} onClose={() => setEditing(null)} onSaved={saved} />}
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} durationMs={toastDuration(toast?.tone)} onClose={() => setToast(null)} />
    </div>
  );
};

type Show = 'ALL' | SubmissionState;
const SHOWS: Show[] = ['ALL', 'NOT_SENT', 'ON_TIME', 'LATE'];

const SubmissionStudents: React.FC<{ id: number; refreshKey: number; onChanged: () => void; onToast: (toast: { message: string; tone: 'success' | 'danger' }) => void }> = ({ id, refreshKey, onChanged, onToast }) => {
  const location = useLocation();
  const titleId = useId();
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [show, setShow] = useState<Show>('ALL');
  const [extending, setExtending] = useState<SubmissionStudent | null>(null);
  const [extDate, setExtDate] = useState('');
  const [extTime, setExtTime] = useState('23:59');
  const [extReason, setExtReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const from = `${location.pathname}${location.search}`;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getSubmission(id)
      .then(found => !cancelled && setDetail(found))
      .catch(err => !cancelled && setError(errorText(err, 'Could not load the students.')));
    return () => {
      cancelled = true;
    };
  }, [id, reload, refreshKey]);

  const refresh = (found: SubmissionDetail) => {
    setDetail(found);
    onChanged();
  };

  const openExtension = (row: SubmissionStudent) => {
    const current = malaysiaParts(row.extension?.dueAt ?? null);
    setExtDate(row.extension ? current.date : '');
    setExtTime(row.extension ? current.time : '23:59');
    setExtReason('');
    setProblem(null);
    setExtending(row);
  };

  const saveExtension = async () => {
    if (!extending) return;
    setBusy(true);
    setProblem(null);
    try {
      refresh(await giveExtension(id, { matric: extending.matric, dueAt: fromMalaysia(extDate, extTime), reason: extReason }));
      onToast({ message: `Extension saved for ${extending.name}.`, tone: 'success' });
      setExtending(null);
    } catch (err) {
      setProblem(firstProblem(err, 'Could not save the extension.'));
    } finally {
      setBusy(false);
    }
  };

  const dropExtension = async () => {
    if (!extending) return;
    setBusy(true);
    try {
      refresh(await removeExtension(id, extending.matric));
      onToast({ message: `Extension removed for ${extending.name}.`, tone: 'success' });
      setExtending(null);
    } catch (err) {
      setProblem(errorText(err, 'Could not remove the extension.'));
    } finally {
      setBusy(false);
    }
  };

  const remind = async () => {
    setBusy(true);
    try {
      const result = await remindSubmission(id);
      onToast({ message: `Reminded ${studentCount(result.sent)}.`, tone: 'success' });
      setReload(value => value + 1);
    } catch (err) {
      onToast({ message: errorText(err, 'Could not send the reminder.'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = () => {
    if (!detail) return;
    const url = URL.createObjectURL(new Blob([submissionCsv(detail)], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = csvName(detail.title);
    link.click();
    URL.revokeObjectURL(url);
  };

  if (error) return <div className="border-t border-slate-100 px-5 py-4 sm:px-6"><ErrorState message={error} onRetry={() => setReload(value => value + 1)} /></div>;
  if (!detail) return <div className="border-t border-slate-100 px-5 py-4 sm:px-6"><LoadingState message="Loading students..." /></div>;
  const rows = show === 'ALL' ? detail.students : detail.students.filter(row => row.state === show);
  const count = (value: Show) => (value === 'ALL' ? detail.students.length : detail.students.filter(row => row.state === value).length);

  return (
    <div className="space-y-3 border-t border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show students" className="flex flex-wrap gap-2">
          {SHOWS.map(value => (
            <button key={value} type="button" aria-pressed={show === value} onClick={() => setShow(value)} className={pill(show === value)}>
              {value === 'ALL' ? 'All' : STATE_LABEL[value]}
              <span className={show === value ? 'text-white/70' : 'text-slate-400'}>{count(value)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.canManage && (
            <PortalButton size="sm" icon={BellRing} isLoading={busy} disabled={detail.remindedToday || detail.notOpenYet || !detail.counts.NOT_SENT} onClick={() => void remind()}>
              {detail.remindedToday ? 'Reminded today' : 'Remind'}
            </PortalButton>
          )}
          <PortalButton size="sm" variant="ghost" icon={Download} disabled={!detail.students.length} onClick={downloadCsv}>CSV</PortalButton>
        </div>
      </div>
      {!rows.length ? (
        <p className="py-4 text-center text-[13px] font-semibold text-slate-400">Nobody here.</p>
      ) : (
        <ul aria-label="Students" className="divide-y divide-slate-100">
          {rows.map(row => (
            <li key={row.matric} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-[1_1_14rem]">
                <p className="text-[14px] font-bold text-slate-900 [overflow-wrap:anywhere]">{row.name}</p>
                <p className="text-[12.5px] text-slate-500">{row.matric} · {shortProgramme(row.programme)}{row.expected ? '' : ' · No longer expected'}</p>
                <p className={`text-[12.5px] font-semibold ${row.state === 'LATE' ? 'text-amber-800' : 'text-slate-600'}`}>{sentText(row.sentAt, row.lateBySeconds)}{row.fileArchived ? ' · File archived' : ''}</p>
                {row.extension && <p className="text-[12.5px] font-semibold text-blue-800">Extension to {historyTime(row.extension.dueAt)} · {row.extension.reason}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <StatusBadge tone={STATE_TONE[row.state]} dot>{STATE_LABEL[row.state]}</StatusBadge>
                {row.documentId && <Link to={routeForDocument(row.documentId)} state={{ from }} className="text-[13px] font-bold text-blue-700 hover:text-blue-900">Open file</Link>}
                {detail.canManage && <button type="button" className="text-blue-700 hover:text-blue-900 cursor-pointer text-[11px] font-extrabold uppercase tracking-wider" onClick={() => openExtension(row)}>Extension</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <DialogShell
        title={extending ? `Extension for ${extending.name}` : ''}
        titleId={titleId}
        isOpen={extending !== null}
        busy={busy}
        onClose={() => setExtending(null)}
        footer={<>
          {extending?.extension && <PortalButton variant="ghost" disabled={busy} onClick={() => void dropExtension()}>Remove extension</PortalButton>}
          <PortalButton disabled={busy} onClick={() => setExtending(null)}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} disabled={!extDate || !extReason} onClick={() => void saveExtension()}>Save</PortalButton>
        </>}
      >
        <p className="text-[13px] text-slate-600">Due for everyone: {historyTime(detail.dueAt)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 form-label mb-0">
            New due date
            <DateField value={extDate} disabled={busy} onChange={setExtDate} />
          </label>
          <label className="flex flex-col gap-1.5 form-label mb-0">
            Time
            <TimeField value={extTime} disabled={busy} onChange={setExtTime} />
          </label>
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
          <span id={`${titleId}-reason`}>Reason</span>
          <SelectMenu aria-labelledby={`${titleId}-reason`} value={extReason} placeholder="Choose a reason" options={detail.options.reasons} disabled={busy} onChange={setExtReason} />
        </div>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
    </div>
  );
};
