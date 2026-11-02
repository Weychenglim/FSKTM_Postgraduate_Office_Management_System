/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Send } from 'lucide-react';
import { submitResearchAmendment } from '../services/researchAmendmentsApi';
import { getStudentTransfer, type StudentTransferSummary } from '../services/programmeTransfersApi';
import { APP_ROUTES, routeForProgrammeTransfer } from '../constants/routes';
import { recordReturn } from '../utils/recordNavigation';
import { namesText } from '../utils/programmeTransfers';
import { PortalButton } from './PortalPrimitives';
import { ProgrammePill, StaysWithStudent } from './ProgrammeTransferParts';
import { RecordPage } from './RecordPage';
import { ErrorState, LoadingState } from './StateViews';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** The office asks to move a student with a research profile to another programme. */
export const ProgrammeTransferForm: React.FC<{ matric: string }> = ({ matric }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const source = recordReturn(location.state?.recordReturn, { path: `${APP_ROUTES.registry}?student=${encodeURIComponent(matric)}`, label: 'Student Record' }, APP_ROUTES.registry);
  const [summary, setSummary] = useState<StudentTransferSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!matric) {
      setError('Open a Student Record first, then choose Request programme transfer.');
      return;
    }
    getStudentTransfer(matric)
      .then(found => !cancelled && setSummary(found))
      .catch(err => !cancelled && setError(errorText(err, 'Could not load this student.')));
    return () => {
      cancelled = true;
    };
  }, [matric, reload]);

  const send = async () => {
    if (!summary || !destination || !reason.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const row = await submitResearchAmendment({ kind: 'TRANSFER', studentId: summary.studentId, destinationProgramme: destination, reason: reason.trim() });
      sent.current = true;
      navigate(routeForProgrammeTransfer(row.id), { replace: true, state: { recordReturn: source } });
    } catch (err) {
      setProblem(errorText(err, 'Could not send the transfer.'));
    } finally {
      setBusy(false);
    }
  };

  const page = (children: React.ReactNode) => (
    <RecordPage title="Request programme transfer" backLabel={`Back to ${source.label}`}
      onBack={() => navigate(source.path)} dirty={Boolean(destination || reason.trim())} busy={busy} navigationComplete={sent}>
      {children}
    </RecordPage>
  );

  if (error) return page(<ErrorState message={error} onRetry={() => setReload(value => value + 1)} />);
  if (!summary) return page(<LoadingState message="Loading the student..." />);

  const student = (
    <section aria-label="Student" className="app-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div className="min-w-0">
        <p className="text-[16px] font-extrabold text-brand-navy">{summary.name}</p>
        <p className="font-mono text-[12px] text-slate-500">{summary.matric}</p>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
        <span className="card-label">Current programme</span>
        <ProgrammePill programme={summary.programme} />
      </div>
    </section>
  );

  if (!summary.hasResearchProfile) {
    return page(<>
      {student}
      <p className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-[14px] text-slate-700">
        {summary.name} has no research profile, so the programme is changed directly in Edit Details on the Student Record.
      </p>
    </>);
  }
  if (summary.pending) {
    const pending = summary.pending;
    return page(<>
      {student}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-900">
        <span>A transfer to {pending.destination} is already in progress.</span>
        <PortalButton size="sm" onClick={() => navigate(routeForProgrammeTransfer(pending.id), { state: { recordReturn: source } })}>View transfer</PortalButton>
      </div>
    </>);
  }

  const blockers = summary.blockers ?? [];
  const current = summary.currentCoordinators ?? [];
  const choice = (summary.destinations ?? []).find(row => row.programme === destination);
  const team = summary.team ?? { primary: '', coSupervisors: [], panel: [] };

  return page(<>
    {student}
    {blockers.length > 0 && (
      <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-900">
        <p className="font-extrabold">This transfer cannot start yet.</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">{blockers.map(text => <li key={text}>{text}</li>)}</ul>
      </div>
    )}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-label="Transfer details" className="app-card space-y-5 p-5 sm:p-6">
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="mb-2 text-[15px] font-extrabold text-brand-navy">Move to</legend>
          <div role="radiogroup" aria-label="Move to" className="overflow-hidden rounded-xl border border-slate-200">
            {(summary.destinations ?? []).map(row => {
              const available = row.coordinators.length > 0;
              const picked = destination === row.programme;
              return (
                <button key={row.programme} type="button" role="radio" aria-checked={picked} disabled={!available}
                  onClick={() => setDestination(row.programme)}
                  className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-3 text-left first:border-t-0 ${picked ? 'bg-indigo-50' : available ? 'bg-white hover:bg-slate-50' : 'cursor-not-allowed bg-slate-50'}`}>
                  <span className={`text-[13px] font-bold [overflow-wrap:anywhere] ${available ? 'text-slate-900' : 'text-slate-400'}`}>{row.programme}</span>
                  <span className={`text-[12px] ${available ? 'text-slate-500' : 'font-bold text-slate-400'}`}>{available ? `Coordinator: ${namesText(row.coordinators)}` : 'No coordinator yet'}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="block space-y-1.5">
          <span className="text-[15px] font-extrabold text-brand-navy">Reason (required)</span>
          <textarea className="form-control min-h-24 px-3.5 py-3 text-[14px]" maxLength={1000} value={reason} disabled={busy}
            placeholder="For example: the student asked to move from Semester II, letter dated 28 Oct 2026"
            onChange={event => setReason(event.target.value)} />
        </label>
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <PortalButton variant="primary" icon={Send} isLoading={busy} disabled={!summary.canRequest || !destination || !reason.trim()} onClick={() => void send()}>
            Send for approval
          </PortalButton>
        </div>
      </section>
      <div className="space-y-5">
        <section aria-label="Who approves" className="app-card space-y-3 p-5 sm:p-6">
          <h2 className="section-label">Who approves, in order</h2>
          <ol className="space-y-3 text-[13px]">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">1</span>
              <span>
                <span className="block font-bold text-slate-900">{current.length ? namesText(current) : 'Skipped'}</span>
                <span className="text-slate-500">{current.length ? 'Coordinator of the current programme' : `Nobody coordinates ${summary.programme}, so this step is skipped`}</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">2</span>
              <span>
                <span className="block font-bold text-slate-900">{choice ? namesText(choice.coordinators) : 'Pick a programme'}</span>
                <span className="text-slate-500">Coordinator of the new programme</span>
              </span>
            </li>
          </ol>
        </section>
        <StaysWithStudent primary={team.primary} coSupervisors={team.coSupervisors} panel={team.panel} unfinished={summary.unfinishedTasks ?? 0} />
      </div>
    </div>
  </>);
};
