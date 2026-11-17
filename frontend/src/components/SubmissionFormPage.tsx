/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useMemo, useState } from 'react';
import { BookOpen, CalendarClock, Check, FileUp, GraduationCap, Hourglass, Lock, Plus, Users, Zap } from 'lucide-react';
import type { AfterDue, SubmissionInput, SubmissionOptions, SubmissionSummary } from '../services/submissionsApi';
import { changeSubmission, createSubmission } from '../services/submissionsApi';
import { ApiError } from '../services/apiClient';
import { historyTime } from '../utils/documentDisplay';
import { shortProgramme } from '../utils/registrySemesters';
import { defaultDueDate, fromMalaysia, malaysiaParts } from '../utils/submissions';
import { RecordPage } from './RecordPage';
import { PortalButton, PortalConfirmModal } from './PortalPrimitives';
import { SelectMenu } from './SelectMenu';
import { DateField, TimeField } from './DateFields';

const NEW_TYPE = '_new';
const INSTRUCTIONS_LIMIT = 2000;
const LABEL = 'text-[13px] font-semibold text-slate-800';

interface Draft {
  title: string;
  type: string;
  newType: string;
  instructions: string;
  programmes: string[];
  stage: SubmissionInput['stage'];
  opensLater: boolean;
  opensDate: string;
  opensTime: string;
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
  newType: '',
  instructions: '',
  programmes: [...options.programmes],
  stage: 'ALL',
  opensLater: false,
  opensDate: defaultDueDate(Date.now(), 1),
  opensTime: '08:00',
  dueDate: defaultDueDate(Date.now()),
  dueTime: '23:59',
  afterDue: 'CLOSE',
  limitLate: false,
  lateDate: '',
  lateTime: '23:59',
});

const draftOf = (item: SubmissionSummary): Draft => {
  const opens = malaysiaParts(item.opensAt);
  const due = malaysiaParts(item.dueAt);
  const late = malaysiaParts(item.lateUntil);
  return {
    title: item.title,
    type: item.type.code,
    newType: '',
    instructions: item.instructions,
    programmes: [...item.programmes],
    stage: item.stage,
    opensLater: Boolean(item.opensAt),
    opensDate: opens.date,
    opensTime: item.opensAt ? opens.time : '08:00',
    dueDate: due.date,
    dueTime: due.time,
    afterDue: item.afterDue,
    limitLate: Boolean(item.lateUntil),
    lateDate: late.date,
    lateTime: late.time,
  };
};

const opensAtOf = (draft: Draft) => (draft.opensLater && draft.opensDate ? fromMalaysia(draft.opensDate, draft.opensTime) : null);

const inputOf = (draft: Draft, confirm = false): SubmissionInput => ({
  title: draft.title.trim(),
  type: draft.type === NEW_TYPE ? '' : draft.type,
  ...(draft.type === NEW_TYPE ? { newType: draft.newType.trim() } : {}),
  instructions: draft.instructions.trim(),
  programmes: draft.programmes,
  stage: draft.stage,
  opensAt: opensAtOf(draft),
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
  return err instanceof Error && err.message ? err.message : fallback;
};

const Choices = <T extends string>({ label, value, options, disabled, onChange }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon: React.ElementType }>;
  disabled: boolean;
  onChange: (value: T) => void;
}) => {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-3 ${options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {options.map(option => {
        const on = option.value === value;
        const Icon = option.icon;
        return (
          <label
            key={option.value}
            className={`relative flex items-center gap-3 rounded-xl border bg-white px-4 py-3.5 transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${on ? 'border-brand-navy ring-1 ring-brand-navy' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-navy/30`}
          >
            <input type="radio" name={name} className="sr-only" checked={on} disabled={disabled} onChange={() => onChange(option.value)} />
            <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-500'}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className={`min-w-0 flex-1 text-[13.5px] font-semibold ${on ? 'text-brand-navy' : 'text-slate-700'}`}>{option.label}</span>
            <span aria-hidden="true" className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-brand-navy' : 'border-slate-300'}`}>
              {on && <span className="h-2 w-2 rounded-full bg-brand-navy" />}
            </span>
          </label>
        );
      })}
    </div>
  );
};

const STAGE_CHOICES = [
  { value: 'ALL' as const, label: 'All students', icon: Users },
  { value: 'P1' as const, label: 'RP1 students', icon: BookOpen },
  { value: 'P2' as const, label: 'RP2 students', icon: GraduationCap },
];
const OPEN_CHOICES = [
  { value: 'NOW' as const, label: 'Immediately', icon: Zap },
  { value: 'LATER' as const, label: 'Scheduled', icon: CalendarClock },
];
const AFTER_DUE_CHOICES = [
  { value: 'CLOSE' as const, label: 'Close submissions', icon: Lock },
  { value: 'ACCEPT_LATE' as const, label: 'Accept late submissions', icon: Hourglass },
];

const Toggle: React.FC<{ label: string; on: boolean; disabled: boolean; onChange: (on: boolean) => void }> = ({ label, on, disabled, onChange }) => (
  <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 text-left cursor-pointer disabled:cursor-not-allowed">
    <span className="text-[13.5px] font-semibold text-slate-700">{label}</span>
    <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-brand-navy' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </span>
  </button>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-5 px-5 py-6 sm:px-7">
    <h2 className="section-label">{title}</h2>
    {children}
  </section>
);

const When: React.FC<{ label: string; date: string; time: string; min?: string; disabled: boolean; invalid?: boolean; onDate: (value: string) => void; onTime: (value: string) => void }> = ({ label, date, time, min, disabled, invalid, onDate, onTime }) => (
  <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <DateField aria-label={`${label} date`} aria-invalid={invalid || undefined} value={date} min={min} disabled={disabled} onChange={onDate} />
    <TimeField aria-label={`${label} time`} value={time} disabled={disabled} onChange={onTime} />
  </div>
);

interface SubmissionFormPageProps {
  options: SubmissionOptions;
  item: SubmissionSummary | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** A coordinator sets up or changes a submission on its own page, with what students will see beside it. */
export const SubmissionFormPage: React.FC<SubmissionFormPageProps> = ({ options, item, onClose, onSaved }) => {
  const id = useId();
  const start = useMemo(() => (item ? draftOf(item) : blankDraft(options)), [item, options]);
  const [draft, setDraft] = useState<Draft>(start);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmCount, setConfirmCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const patch = (change: Partial<Draft>) => setDraft(current => ({ ...current, ...change }));

  const typeOptions = [
    ...options.types.map(type => ({ value: type.code, label: type.label })),
    { value: NEW_TYPE, label: 'New file type', leading: <Plus aria-hidden="true" className="h-4 w-4 text-slate-400" /> },
  ];
  const typeLabel = draft.type === NEW_TYPE ? draft.newType.trim() : options.types.find(type => type.code === draft.type)?.label ?? item?.type.label ?? '';
  const opensAt = opensAtOf(draft);
  const dueAt = draft.dueDate ? fromMalaysia(draft.dueDate, draft.dueTime) : '';
  const opensTooLate = Boolean(opensAt && dueAt && new Date(opensAt).getTime() >= new Date(dueAt).getTime());
  const dirty = JSON.stringify(draft) !== JSON.stringify(start);
  const canSave = Boolean(
    draft.title.trim()
    && (draft.type === NEW_TYPE ? draft.newType.trim().length > 1 : draft.type)
    && draft.programmes.length
    && draft.dueDate
    && (!draft.opensLater || (draft.opensDate && !opensTooLate))
    && (draft.afterDue === 'CLOSE' || !draft.limitLate || draft.lateDate),
  );

  const save = async (confirm = false) => {
    setBusy(true);
    setProblem(null);
    try {
      if (item) await changeSubmission(item.id, inputOf(draft, confirm));
      else await createSubmission(inputOf(draft));
      onSaved(item ? 'Saved.' : 'Submission created. The students have been notified.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && (err.body as { code?: string } | null)?.code === 'would_become_late') {
        setConfirmCount(Number((err.body as { count?: number }).count) || 1);
      } else {
        setConfirmCount(0);
        setProblem(firstProblem(err, 'Could not save this.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <RecordPage
      title={item ? 'Edit submission' : 'New submission'}
      backLabel="Back to Submissions"
      onBack={onClose}
      pageKey={`submission:${item?.id ?? 'new'}`}
      dirty={dirty}
      busy={busy}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <form className="app-card divide-y divide-slate-100" onSubmit={event => event.preventDefault()}>
          <Section title="Details">
            <label className={`flex flex-col gap-1.5 ${LABEL}`}>
              Title
              <input className="form-control form-control-md text-[13.5px]" maxLength={120} value={draft.title} placeholder="RP2 final report" disabled={busy} onChange={event => patch({ title: event.target.value })} />
            </label>
            <div className={`flex flex-col gap-1.5 ${LABEL}`}>
              <span id={`${id}-type`}>File type</span>
              <SelectMenu aria-labelledby={`${id}-type`} value={draft.type} options={typeOptions} disabled={busy || Boolean(item && item.counts.ON_TIME + item.counts.LATE > 0)} onChange={value => patch({ type: value })} />
              {draft.type === NEW_TYPE && (
                <input aria-label="Name of the new file type" className="form-control form-control-md text-[13.5px]" maxLength={80} autoFocus value={draft.newType} placeholder="Ethics approval form" disabled={busy} onChange={event => patch({ newType: event.target.value })} />
              )}
            </div>
            <label className={`flex flex-col gap-1.5 ${LABEL}`}>
              <span className="flex items-baseline justify-between gap-3">
                <span>Instructions <span className="font-semibold text-slate-400">(optional)</span></span>
                {draft.instructions.length > INSTRUCTIONS_LIMIT - 200 && (
                  <span className="text-[12px] font-semibold text-slate-500">{draft.instructions.length} / {INSTRUCTIONS_LIMIT}</span>
                )}
              </span>
              <textarea
                className="form-control form-control-md min-h-36 resize-y text-[13.5px] font-medium leading-relaxed"
                maxLength={INSTRUCTIONS_LIMIT}
                rows={6}
                value={draft.instructions}
                placeholder={'Use the faculty report template.\nInclude the Turnitin similarity report.'}
                disabled={busy}
                onChange={event => patch({ instructions: event.target.value })}
              />
            </label>
          </Section>

          <Section title="Who must send it">
            {options.programmes.length > 1 && (
              <div className="space-y-2.5">
                <p id={`${id}-programmes`} className={LABEL}>Programmes</p>
                <div role="group" aria-labelledby={`${id}-programmes`} className="grid gap-3 sm:grid-cols-2">
                  {options.programmes.map(programme => {
                    const on = draft.programmes.includes(programme);
                    return (
                      <label key={programme} className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3.5 transition cursor-pointer ${on ? 'border-brand-navy ring-1 ring-brand-navy' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-navy/30`}>
                        <input type="checkbox" className="sr-only" checked={on} disabled={busy} onChange={() => patch({ programmes: on ? draft.programmes.filter(value => value !== programme) : [...draft.programmes, programme] })} />
                        <span aria-hidden="true" className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-300'}`}>
                          {on && <Check className="h-3 w-3" strokeWidth={3.5} />}
                        </span>
                        <span className={`text-[13.5px] font-semibold ${on ? 'text-brand-navy' : 'text-slate-700'}`}>{shortProgramme(programme)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-2.5">
              {options.programmes.length > 1 && <p className={LABEL}>Students</p>}
              <Choices label="Students" value={draft.stage} options={STAGE_CHOICES} disabled={busy} onChange={stage => patch({ stage })} />
            </div>
          </Section>

          <Section title="Schedule">
            <div className="space-y-2.5">
              <p className={LABEL}>Submission opens</p>
              <Choices
                label="Submission opens"
                value={draft.opensLater ? 'LATER' : 'NOW'}
                options={OPEN_CHOICES}
                disabled={busy}
                onChange={value => patch({ opensLater: value === 'LATER' })}
              />
              {draft.opensLater && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[13.5px] font-semibold text-slate-700">Opening date and time</p>
                  <When label="Opening" date={draft.opensDate} time={draft.opensTime} disabled={busy} invalid={opensTooLate} onDate={value => patch({ opensDate: value })} onTime={value => patch({ opensTime: value })} />
                  {opensTooLate && <p role="alert" className="text-[12.5px] font-semibold text-rose-700">The opening date must be before the due date.</p>}
                </div>
              )}
            </div>
            <div className="space-y-2.5">
              <p className={LABEL}>Due date</p>
              <When label="Due" date={draft.dueDate} time={draft.dueTime} disabled={busy} onDate={value => patch({ dueDate: value })} onTime={value => patch({ dueTime: value })} />
            </div>
            <div className="space-y-2.5">
              <p className={LABEL}>After the due date</p>
              <Choices
                label="After the due date"
                value={draft.afterDue}
                options={AFTER_DUE_CHOICES}
                disabled={busy}
                onChange={afterDue => patch({ afterDue })}
              />
              {draft.afterDue === 'ACCEPT_LATE' && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <Toggle label="Set a final cut-off" on={draft.limitLate} disabled={busy} onChange={on => patch({ limitLate: on, lateDate: draft.lateDate || draft.dueDate })} />
                  {draft.limitLate && (
                    <When label="Final cut-off" date={draft.lateDate} time={draft.lateTime} min={draft.dueDate || undefined} disabled={busy} onDate={value => patch({ lateDate: value })} onTime={value => patch({ lateTime: value })} />
                  )}
                </div>
              )}
            </div>
          </Section>

          <div className="space-y-3 px-5 py-4 sm:px-7">
            {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <PortalButton disabled={busy} onClick={onClose}>Cancel</PortalButton>
              <PortalButton variant="primary" isLoading={busy} disabled={!canSave || (item !== null && !dirty)} onClick={() => void save()}>
                {item ? 'Save changes' : 'Create submission'}
              </PortalButton>
            </div>
          </div>
        </form>

        <aside aria-labelledby={`${id}-preview`} className="app-card space-y-4 p-5 lg:sticky lg:top-6">
          <h2 id={`${id}-preview`} className="section-label">What students see</h2>
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <FileUp className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className={`text-[14.5px] font-bold [overflow-wrap:anywhere] ${draft.title.trim() ? 'text-brand-navy' : 'text-slate-400'}`}>{draft.title.trim() || 'Title'}</p>
                {typeLabel && <p className="text-[12.5px] text-slate-500 [overflow-wrap:anywhere]">{typeLabel}</p>}
              </div>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[12.5px]">
              <dt className="text-slate-500">Opens</dt>
              <dd className="font-semibold text-slate-800">{opensAt ? historyTime(opensAt) : 'Immediately'}</dd>
              <dt className="text-slate-500">Due</dt>
              <dd className="font-semibold text-slate-800">{dueAt ? historyTime(dueAt) : '-'}</dd>
            </dl>
            {draft.instructions.trim() && (
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <p className="text-[12.5px] font-bold text-slate-700">Instructions</p>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700 [overflow-wrap:anywhere]">{draft.instructions.trim()}</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <PortalConfirmModal
        isOpen={confirmCount > 0}
        title="Some files will become late"
        message={confirmCount === 1 ? '1 file sent on time will be marked late with the new due date.' : `${confirmCount} files sent on time will be marked late with the new due date.`}
        confirmLabel="Save anyway"
        cancelLabel="Back"
        tone="warning"
        isLoading={busy}
        onConfirm={() => void save(true)}
        onCancel={() => setConfirmCount(0)}
      />
    </RecordPage>
  );
};
