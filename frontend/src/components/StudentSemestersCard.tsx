/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import type { SemesterOutcome, SemesterTerm, StudentSemesterRow, StudentSemesters } from '../services/registrySemestersApi';
import {
  addStudentSemester,
  changeStudentSemester,
  getStudentSemesters,
  removeStudentSemester,
  saveStudentExtension,
} from '../services/registrySemestersApi';
import {
  intakeNotice,
  type SemesterNotice,
  maximumNotice,
  OUTCOME_OPTIONS,
  OUTCOME_TONE,
  semesterCount,
  TERM_OPTIONS,
  validSession,
} from '../utils/registrySemesters';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { SelectMenu } from './SelectMenu';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

type Dialog = { kind: 'add' } | { kind: 'change'; row: StudentSemesterRow } | { kind: 'extension' } | null;

const OUTCOMES = OUTCOME_OPTIONS.map(option => ({ value: option.value, label: option.label, description: option.description }));

/** How far along a student is. The office corrects a semester here; the record's current semester follows. */
export const StudentSemestersCard: React.FC<{ matric: string; readOnly: boolean; onChanged: () => void }> = ({ matric, readOnly, onChanged }) => {
  const titleId = useId();
  const [progress, setProgress] = useState<StudentSemesters | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [session, setSession] = useState('');
  const [term, setTerm] = useState<SemesterTerm>('SEMESTER_I');
  const [outcome, setOutcome] = useState<SemesterOutcome>('STUDIED');
  const [extension, setExtension] = useState('0');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProgress(null);
    setLoadError(null);
    getStudentSemesters(matric)
      .then(found => { if (!cancelled) setProgress(found); })
      .catch(err => { if (!cancelled) setLoadError(errorText(err, 'Could not load the semesters.')); });
    return () => { cancelled = true; };
  }, [matric]);

  const open = (next: Dialog) => {
    setProblem(null);
    if (next?.kind === 'add') {
      setSession('');
      setTerm('SEMESTER_I');
      setOutcome('STUDIED');
    }
    if (next?.kind === 'change') setOutcome(next.row.outcome);
    if (next?.kind === 'extension') {
      setExtension(String(progress?.extensionSemesters ?? 0));
      setReason(progress?.extensionReason ?? '');
    }
    setDialog(next);
  };

  const run = async (action: () => Promise<StudentSemesters>) => {
    setBusy(true);
    setProblem(null);
    try {
      setProgress(await action());
      setDialog(null);
      onChanged();
    } catch (err) {
      setProblem(errorText(err, 'Could not save this.'));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (dialog?.kind === 'add') {
      if (!validSession(session)) {
        setProblem('Write the session like 2026/2027.');
        return;
      }
      void run(() => addStudentSemester(matric, { session: session.trim(), term, outcome }));
    }
    if (dialog?.kind === 'change') {
      const { row } = dialog;
      void run(() => changeStudentSemester(matric, row.id, { outcome }));
    }
    if (dialog?.kind === 'extension') {
      const semesters = Number(extension);
      if (semesters > 0 && !reason.trim()) {
        setProblem('Say why the extension was given.');
        return;
      }
      void run(() => saveStudentExtension(matric, { semesters, reason: reason.trim() }));
    }
  };

  if (loadError) return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-bold text-rose-700">{loadError}</p>;
  if (!progress) return <p className="rounded-xl border border-slate-200 bg-white p-4 text-[12px] font-semibold text-slate-500">Loading the semesters...</p>;

  const warnings: SemesterNotice[] = (progress.warnings ?? []).map(warning => ({ tone: warning.level === 'stop' ? 'rose' : 'amber', text: warning.text }));
  const notices = [maximumNotice(progress), intakeNotice(progress), ...warnings].filter(Boolean) as SemesterNotice[];
  return (
    <section aria-label="Semesters" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="section-label">Semesters</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="card-label">Studied</p>
          <p className="mt-0.5 text-[15px] font-extrabold text-brand-navy">{semesterCount(progress.studied)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="card-label">Minimum</p>
          {progress.hasRule ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[15px] font-extrabold text-brand-navy">
              {progress.minimum}
              {progress.shortOfMinimum === 0
                ? <StatusBadge tone="success">Reached</StatusBadge>
                : <StatusBadge tone="neutral">{progress.shortOfMinimum} to go</StatusBadge>}
            </p>
          ) : <p className="mt-0.5 text-[13px] font-semibold text-slate-500">No rule for this programme</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="card-label">Maximum</p>
          <p className="mt-0.5 text-[13.5px] font-extrabold text-brand-navy">{progress.maximumSemester.replace(' Session', '') || '-'}</p>
          {progress.extensionSemesters > 0 && (
            <p className="mt-0.5 text-[11.5px] font-medium text-slate-500" title={progress.extensionReason}>
              Includes an extension of {semesterCount(progress.extensionSemesters)}
            </p>
          )}
        </div>
      </div>
      {notices.map(notice => (
        <p key={notice.text} role="status" className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${notice.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {notice.text}
        </p>
      ))}
      {progress.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-[12.5px] font-semibold text-slate-600">
          No semesters on record.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {progress.rows.map(row => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="text-[13px] font-semibold text-slate-800">{row.label.replace(' Session', '')}</span>
              <span className="flex items-center gap-3">
                <StatusBadge tone={OUTCOME_TONE[row.outcome]}>{row.outcomeLabel}</StatusBadge>
                {!readOnly && (
                  <button type="button" className="text-[12.5px] font-bold text-blue-700 hover:text-blue-900" aria-label={`Change ${row.label}`} onClick={() => open({ kind: 'change', row })}>
                    Change
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          {progress.hasRule && <PortalButton size="sm" onClick={() => open({ kind: 'extension' })}>{progress.extensionSemesters ? 'Change extension' : 'Add extension'}</PortalButton>}
          <PortalButton size="sm" onClick={() => open({ kind: 'add' })}>Add semester</PortalButton>
        </div>
      )}

      <DialogShell
        title={dialog?.kind === 'add' ? 'Add a semester' : dialog?.kind === 'change' ? dialog.row.label.replace(' Session', '') : 'Extension past the maximum'}
        titleId={titleId}
        isOpen={dialog !== null}
        busy={busy}
        onClose={() => setDialog(null)}
        footer={<>
          {dialog?.kind === 'change' && (
            <PortalButton variant="danger" className="mr-auto" disabled={busy} onClick={() => { const { row } = dialog; void run(() => removeStudentSemester(matric, row.id)); }}>
              Remove
            </PortalButton>
          )}
          <PortalButton onClick={() => setDialog(null)} disabled={busy}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} onClick={save}>Save</PortalButton>
        </>}
      >
        {dialog?.kind === 'add' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
              Session
              <input className="form-control form-control-md" value={session} disabled={busy} maxLength={9} placeholder="2026/2027" onChange={event => setSession(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
              Semester
              <SelectMenu<SemesterTerm> value={term} options={TERM_OPTIONS} onChange={setTerm} disabled={busy} aria-label="Semester" />
            </label>
          </div>
        )}
        {dialog?.kind !== 'extension' && dialog !== null && (
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
            What happened that semester
            <SelectMenu<SemesterOutcome> value={outcome} options={OUTCOMES} onChange={setOutcome} disabled={busy} aria-label="What happened that semester" />
          </label>
        )}
        {dialog?.kind === 'extension' && (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
              Extra semesters
              <input className="form-control form-control-md" type="number" min={0} max={3} value={extension} disabled={busy} onChange={event => setExtension(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
              Reason
              <input className="form-control form-control-md" value={reason} disabled={busy} maxLength={255} placeholder="Dean's approval, 12 March 2027" onChange={event => setReason(event.target.value)} />
            </label>
          </>
        )}
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
    </section>
  );
};
