/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { BellRing, CalendarClock, Download, Plus } from 'lucide-react';
import type { AfterDue, SubmissionDetail, SubmissionInput, SubmissionOptions, SubmissionStage, SubmissionState, SubmissionStudent, SubmissionSummary } from '../services/submissionsApi';
import { changeSubmission, createSubmission, getSubmission, getSubmissions, giveExtension, remindSubmission, removeExtension, setSubmissionOpen } from '../services/submissionsApi';
import { ApiError } from '../services/apiClient';
import { routeForDocument } from '../constants/routes';
import { historyTime } from '../utils/documentDisplay';
import { shortProgramme, studentCount } from '../utils/registrySemesters';
import { AFTER_DUE_OPTIONS, STAGE_LABEL, STATE_LABEL, STATE_TONE, afterDueText, csvName, defaultDueDate, fromMalaysia, malaysiaParts, sentText, submissionCsv } from '../utils/submissions';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { SelectMenu } from './SelectMenu';
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

interface Draft {
  title: string;
  type: string;
  programmes: string[];
  stage: SubmissionStage;
  dueDate: string;
  dueTime: string;
  afterDue: AfterDue;
  limitLate: boolean;
  lateDate: string;
  lateTime: string;
}

const blankDraft = (options: SubmissionOptions): Draft => ({
  title: '',
  type: options.types[0]?.code ?? '',
  programmes: [...options.programmes],
  stage: 'ALL',
  dueDate: defaultDueDate(Date.now()),
  dueTime: '23:59',
  afterDue: 'CLOSE',
  limitLate: false,
  lateDate: '',
  lateTime: '23:59',
});

const draftOf = (item: SubmissionSummary): Draft => {
  const due = malaysiaParts(item.dueAt);
  const late = malaysiaParts(item.lateUntil);
  return {
    title: item.title,
    type: item.type.code,
    programmes: [...item.programmes],
    stage: item.stage,
    dueDate: due.date,
    dueTime: due.time,
    afterDue: item.afterDue,
    limitLate: Boolean(item.lateUntil),
    lateDate: late.date,
    lateTime: late.time,
  };
};

const inputOf = (draft: Draft, confirm = false): SubmissionInput => ({
  title: draft.title.trim(),
  type: draft.type,
  programmes: draft.programmes,
  stage: draft.stage,
  dueAt: fromMalaysia(draft.dueDate, draft.dueTime),
  afterDue: draft.afterDue,
  lateUntil: draft.afterDue === 'ACCEPT_LATE' && draft.limitLate && draft.lateDate ? fromMalaysia(draft.lateDate, draft.lateTime) : null,
  ...(confirm ? { confirm: true } : {}),
});

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
  const titleId = useId();
  const [items, setItems] = useState<SubmissionSummary[] | null>(null);
  const [options, setOptions] = useState<SubmissionOptions | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ item: SubmissionSummary | null; draft: Draft } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmCount, setConfirmCount] = useState(0);
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
    if (!options) return;
    setProblem(null);
    setConfirmCount(0);
    setEditing({ item: null, draft: blankDraft(options) });
  };

  const startEdit = (item: SubmissionSummary) => {
    setProblem(null);
    setConfirmCount(0);
    setEditing({ item, draft: draftOf(item) });
  };

  const patch = (change: Partial<Draft>) => setEditing(current => (current ? { ...current, draft: { ...current.draft, ...change } } : current));

  const save = async (confirm = false) => {
    if (!editing) return;
    setBusy(true);
    setProblem(null);
    try {
      if (editing.item) await changeSubmission(editing.item.id, inputOf(editing.draft, confirm));
      else await createSubmission(inputOf(editing.draft));
      setToast({ message: editing.item ? 'Saved.' : 'Submission set up. The students have been told.', tone: 'success' });
      setEditing(null);
      setReload(value => value + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && (err.body as { code?: string } | null)?.code === 'would_become_late') {
        setConfirmCount(Number((err.body as { count?: number }).count) || 1);
      } else {
        setProblem(firstProblem(err, 'Could not save this.'));
      }
    } finally {
      setBusy(false);
    }
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

  const draft = editing?.draft;
  const canSave = Boolean(draft && draft.title.trim() && draft.type && draft.programmes.length && draft.dueDate && (draft.afterDue === 'CLOSE' || !draft.limitLate || draft.lateDate));

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
                <p className="text-[13px] font-semibold text-slate-700">Due {historyTime(item.dueAt)} · {afterDueText(item)}</p>
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

      <DialogShell
        title={editing?.item ? 'Change submission' : 'New submission'}
        titleId={titleId}
        isOpen={editing !== null}
        busy={busy}
        onClose={() => setEditing(null)}
        footer={confirmCount ? (
          <>
            <PortalButton disabled={busy} onClick={() => setConfirmCount(0)}>Back</PortalButton>
            <PortalButton variant="primary" isLoading={busy} onClick={() => void save(true)}>Save anyway</PortalButton>
          </>
        ) : (
          <>
            <PortalButton disabled={busy} onClick={() => setEditing(null)}>Cancel</PortalButton>
            <PortalButton variant="primary" isLoading={busy} disabled={!canSave} onClick={() => void save()}>Save</PortalButton>
          </>
        )}
      >
        {draft && (confirmCount ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-900">
            {confirmCount === 1 ? '1 file sent on time would become late.' : `${confirmCount} files sent on time would become late.`}
          </p>
        ) : (
          <div className="space-y-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
              Title
              <input className="form-control form-control-md" maxLength={120} value={draft.title} placeholder="RP2 final report" disabled={busy} onChange={event => patch({ title: event.target.value })} />
            </label>
            <div className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
              <span id={`${titleId}-type`}>File type</span>
              <SelectMenu aria-labelledby={`${titleId}-type`} value={draft.type} options={options.types.map(type => ({ value: type.code, label: type.label }))} disabled={busy} onChange={value => patch({ type: value })} />
            </div>
            {options.programmes.length > 1 && (
              <fieldset className="space-y-1.5">
                <legend className="text-[13px] font-bold text-slate-700">Programmes</legend>
                {options.programmes.map(programme => (
                  <label key={programme} className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-700">
                    <input type="checkbox" className="h-4 w-4" checked={draft.programmes.includes(programme)} disabled={busy} onChange={event => patch({ programmes: event.target.checked ? [...draft.programmes, programme] : draft.programmes.filter(value => value !== programme) })} />
                    {shortProgramme(programme)}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="space-y-1.5">
              <p className="text-[13px] font-bold text-slate-700">Who must send it</p>
              <div role="group" aria-label="Who must send it" className="flex flex-wrap gap-2">
                {options.stages.map(stage => (
                  <button key={stage.value} type="button" aria-pressed={draft.stage === stage.value} disabled={busy} onClick={() => patch({ stage: stage.value })} className={pill(draft.stage === stage.value)}>{stage.label}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
                Due date
                <DateField value={draft.dueDate} disabled={busy} onChange={value => patch({ dueDate: value })} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
                Time
                <TimeField value={draft.dueTime} disabled={busy} onChange={value => patch({ dueTime: value })} />
              </label>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] font-bold text-slate-700">After the due date</legend>
              {AFTER_DUE_OPTIONS.map(option => (
                <label key={option.value} className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-700">
                  <input type="radio" name={`${titleId}-after`} className="h-4 w-4" checked={draft.afterDue === option.value} disabled={busy} onChange={() => patch({ afterDue: option.value })} />
                  {option.label}
                </label>
              ))}
            </fieldset>
            {draft.afterDue === 'ACCEPT_LATE' && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <label className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-700">
                  <input type="checkbox" className="h-4 w-4" checked={draft.limitLate} disabled={busy} onChange={event => patch({ limitLate: event.target.checked, lateDate: draft.lateDate || draft.dueDate })} />
                  Stop late work after a date
                </label>
                {draft.limitLate && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
                      Last day
                      <DateField value={draft.lateDate} min={draft.dueDate || undefined} disabled={busy} onChange={value => patch({ lateDate: value })} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
                      Time
                      <TimeField value={draft.lateTime} disabled={busy} onChange={value => patch({ lateTime: value })} />
                    </label>
                  </div>
                )}
              </div>
            )}
            {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
          </div>
        ))}
      </DialogShell>
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
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
            <PortalButton size="sm" icon={BellRing} isLoading={busy} disabled={detail.remindedToday || !detail.counts.NOT_SENT} onClick={() => void remind()}>
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
                <p className={`text-[12.5px] font-semibold ${row.state === 'LATE' ? 'text-amber-800' : 'text-slate-600'}`}>{sentText(row.sentAt, row.lateBySeconds)}</p>
                {row.extension && <p className="text-[12.5px] font-semibold text-blue-800">Extension to {historyTime(row.extension.dueAt)} · {row.extension.reason}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <StatusBadge tone={STATE_TONE[row.state]} dot>{STATE_LABEL[row.state]}</StatusBadge>
                {row.documentId && <Link to={routeForDocument(row.documentId)} state={{ from }} className="text-[13px] font-bold text-blue-700 hover:text-blue-900">Open file</Link>}
                {detail.canManage && <button type="button" className="text-[13px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer" onClick={() => openExtension(row)}>Extension</button>}
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
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
            New due date
            <DateField value={extDate} disabled={busy} onChange={setExtDate} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
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
