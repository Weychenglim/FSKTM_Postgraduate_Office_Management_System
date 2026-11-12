/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import type { StudentRecord } from '../types';
import type { GraduationCheck, LeaveOutcome } from '../services/registrySemestersApi';
import { correctGraduation, finishStudents, getStudentGraduationCheck, recordSenateDecision, returnToActive, studentStatusAction } from '../services/registrySemestersApi';
import { getStudentById } from '../services/studentsApi';
import { EXIT_REASON_OPTIONS, LEAVE_OPTIONS, shortSemester } from '../utils/registrySemesters';
import { shownStatus } from '../utils/registryStatus';
import { DialogShell } from './DocumentDialogs';
import { OverflowMenu } from './DocumentParts';
import { PortalButton } from './PortalPrimitives';
import { SelectMenu } from './SelectMenu';
import { DateField } from './DateFields';

type Kind = 'LEAVE' | 'END_LEAVE' | 'WITHDRAW' | 'TERMINATE' | 'DECEASED' | 'REINSTATE' | 'FINISH' | 'SENATE' | 'RETURN' | 'CORRECT';

const LABELS: Record<Kind, string> = {
  LEAVE: 'Record semester leave',
  END_LEAVE: 'End leave',
  WITHDRAW: 'Record withdrawal',
  TERMINATE: 'Record termination',
  DECEASED: 'Student passed away',
  REINSTATE: 'Reinstate',
  FINISH: 'Finished studies',
  SENATE: 'Record Senate decision',
  RETURN: 'Back to Active',
  CORRECT: 'Correct a mistake',
};

const OPTIONS: Record<string, { main: Kind[]; more: Kind[] }> = {
  Active: { main: ['LEAVE', 'FINISH'], more: ['WITHDRAW', 'TERMINATE', 'DECEASED'] },
  'Not started': { main: [], more: ['WITHDRAW', 'DECEASED'] },
  'On semester leave': { main: ['END_LEAVE'], more: ['WITHDRAW', 'TERMINATE', 'DECEASED'] },
  'Waiting for Senate': { main: ['SENATE', 'RETURN'], more: ['WITHDRAW', 'TERMINATE', 'DECEASED'] },
  Graduated: { main: ['CORRECT'], more: [] },
  Terminated: { main: ['REINSTATE'], more: [] },
  'Passed away': { main: ['REINSTATE'], more: [] },
};

const today = () => new Date().toLocaleDateString('en-CA');
const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const field = 'flex flex-col gap-1.5 text-[13px] font-bold text-slate-700';

export const StudentStatusActions: React.FC<{ student: StudentRecord; onChanged: (updated: StudentRecord, message: string) => void }> = ({ student, onChanged }) => {
  const titleId = useId();
  const status = shownStatus(student);
  const labelOf = (option: Kind) => (option === 'REINSTATE' && status === 'Passed away' ? 'Undo this record' : LABELS[option]);
  const [kind, setKind] = useState<Kind | null>(null);
  const [reason, setReason] = useState('');
  const [leave, setLeave] = useState<LeaveOutcome>('LEAVE');
  const [exitReason, setExitReason] = useState('');
  const [senateDate, setSenateDate] = useState('');
  const [reference, setReference] = useState('');
  const [check, setCheck] = useState<GraduationCheck | null>(null);
  const [lastSemester, setLastSemester] = useState('');
  const [early, setEarly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setCheck(null);
    if (kind !== 'FINISH') return undefined;
    let cancelled = false;
    getStudentGraduationCheck(student.id)
      .then(found => { if (!cancelled) { setCheck(found); setLastSemester(found.lastSemesters[0] ? `${found.lastSemesters[0].session}|${found.lastSemesters[0].term}` : ''); } })
      .catch(err => { if (!cancelled) setProblem(errorText(err, 'Could not check this student.')); });
    return () => { cancelled = true; };
  }, [kind, student.id]);

  const open = (next: Kind) => {
    setProblem(null);
    setReason('');
    setLeave('LEAVE');
    setExitReason('');
    setSenateDate('');
    setReference('');
    setEarly(false);
    setKind(next);
  };

  const finish = async (message: string) => {
    const updated = await getStudentById(student.id);
    if (updated) onChanged(updated, message);
    setKind(null);
  };

  const refused = (skipped: Array<{ why: string }>) => {
    if (skipped.length) throw new Error(skipped[0].why);
  };

  const save = async () => {
    if (!kind) return;
    setBusy(true);
    setProblem(null);
    try {
      if (kind === 'FINISH') {
        const [lastSession, lastTerm] = lastSemester.split('|');
        const result = await finishStudents({ matrics: [student.id], earlyApproved: early ? [student.id] : [], lastSession, lastTerm });
        refused(result.skipped);
        await finish(`${student.name} is waiting for the Senate.`);
      } else if (kind === 'SENATE') {
        const result = await recordSenateDecision({ matrics: [student.id], decidedOn: senateDate, reference: reference.trim() });
        refused(result.skipped);
        await finish(`${student.name} has graduated.`);
      } else if (kind === 'RETURN') {
        const result = await returnToActive({ matrics: [student.id], reason: reason.trim() });
        refused(result.skipped);
        await finish(`${student.name} is Active again.`);
      } else if (kind === 'CORRECT') {
        onChanged(await correctGraduation(student.id, reason.trim()), `${student.name} is waiting for the Senate again.`);
        setKind(null);
      } else {
        const updated = await studentStatusAction(student.id, { action: kind, reason: reason.trim(), ...(kind === 'LEAVE' ? { outcome: leave } : {}), ...(kind === 'TERMINATE' ? { exitReason } : {}) });
        onChanged(updated, `${student.name}: ${shownStatus(updated)}.`);
        setKind(null);
      }
    } catch (err) {
      setProblem(errorText(err, 'Could not save this.'));
    } finally {
      setBusy(false);
    }
  };

  const options = OPTIONS[status];
  const stopped = check?.items.filter(item => item.level === 'stop') ?? [];
  const warned = check?.items.filter(item => item.level === 'check') ?? [];
  const needsReason = kind !== null && kind !== 'FINISH' && kind !== 'SENATE';
  const ready = kind === 'FINISH'
    ? Boolean(check && stopped.length === 0 && lastSemester && (!check.early || early))
    : kind === 'SENATE'
      ? Boolean(senateDate)
      : Boolean(reason.trim() && (kind !== 'TERMINATE' || exitReason));
  const lastOptions = (check?.lastSemesters ?? []).map(row => ({ value: `${row.session}|${row.term}`, label: shortSemester(row.label) }));

  return (
    <section aria-label="Status actions" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="section-label">Status</h4>
      {status === 'Graduated' && student.senateDate && <p className="text-[12.5px] font-semibold text-slate-600">Senate decision: {new Date(`${student.senateDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
      {status === 'Terminated' && student.exitReasonLabel && <p className="text-[12.5px] font-semibold text-slate-600">{student.exitReasonLabel}</p>}
      {options ? (
        <div className="flex flex-wrap items-center gap-2">
          {options.main.map(option => <PortalButton key={option} size="sm" onClick={() => open(option)}>{labelOf(option)}</PortalButton>)}
          {options.more.length > 0 && <OverflowMenu label="More status actions" triggerLabel="More" triggerSize="sm" actions={options.more.map(option => ({ label: labelOf(option), onSelect: () => open(option) }))} />}
        </div>
      ) : <p className="text-[12.5px] font-semibold text-slate-500">Withdrawal is final.</p>}

      <DialogShell
        title={kind ? labelOf(kind) : ''}
        titleId={titleId}
        isOpen={kind !== null}
        busy={busy}
        onClose={() => setKind(null)}
        footer={<>
          <PortalButton disabled={busy} onClick={() => setKind(null)}>Cancel</PortalButton>
          <PortalButton variant="primary" isLoading={busy} disabled={!ready} onClick={() => void save()}>Save</PortalButton>
        </>}
      >
        {kind === 'LEAVE' && (
          <label className={field}>
            Type of leave
            <SelectMenu<LeaveOutcome> value={leave} options={LEAVE_OPTIONS} onChange={setLeave} disabled={busy} aria-label="Type of leave" />
          </label>
        )}
        {kind === 'TERMINATE' && (
          <label className={field}>
            Why candidature ended
            <SelectMenu value={exitReason} options={EXIT_REASON_OPTIONS} onChange={setExitReason} disabled={busy} placeholder="Choose a reason" aria-label="Why candidature ended" />
          </label>
        )}
        {kind === 'FINISH' && (
          check ? (
            <>
              {stopped.length > 0 && (
                <ul className="list-disc space-y-0.5 rounded-lg border border-rose-200 bg-rose-50 py-2.5 pl-7 pr-3 text-[12.5px] font-semibold text-rose-800">
                  {stopped.map(item => <li key={item.code}>{item.text}</li>)}
                </ul>
              )}
              {stopped.length === 0 && warned.length > 0 && (
                <ul className="list-disc space-y-0.5 rounded-lg border border-amber-200 bg-amber-50 py-2.5 pl-7 pr-3 text-[12.5px] font-semibold text-amber-900">
                  {warned.map(item => <li key={`${item.code}:${item.recordId ?? ''}`}>{item.text}</li>)}
                </ul>
              )}
              {stopped.length === 0 && (
                <label className={field}>
                  Last semester
                  <SelectMenu value={lastSemester} options={lastOptions} onChange={setLastSemester} disabled={busy} aria-label="Last semester" />
                </label>
              )}
              {check.early && stopped.length === 0 && (
                <label className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
                  <input type="checkbox" className="h-4 w-4" checked={early} onChange={event => setEarly(event.target.checked)} />
                  Approved to finish one semester early
                </label>
              )}
            </>
          ) : !problem && <p className="text-[13px] text-slate-500">Checking...</p>
        )}
        {kind === 'SENATE' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={field}>
              Senate date
              <DateField max={today()} value={senateDate} disabled={busy} onChange={setSenateDate} />
            </label>
            <label className={field}>
              Meeting reference
              <input className="form-control form-control-md" maxLength={120} value={reference} disabled={busy} onChange={event => setReference(event.target.value)} />
            </label>
          </div>
        )}
        {needsReason && (
          <label className={field}>
            Reason
            <input className="form-control form-control-md" maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
          </label>
        )}
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
    </section>
  );
};
