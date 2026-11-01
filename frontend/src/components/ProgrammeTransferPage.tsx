/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import type { ResearchAmendment } from '../services/researchAmendmentsApi';
import { cancelResearchAmendment, decideResearchAmendment, getResearchAmendment } from '../services/researchAmendmentsApi';
import { getProgrammeCoordinators } from '../services/programmeTransfersApi';
import { ApiError } from '../services/apiClient';
import { APP_ROUTES, routeForSupervisorResearchRequest } from '../constants/routes';
import { historyTime } from '../utils/documentDisplay';
import { recordReturn } from '../utils/recordNavigation';
import {
  coordinatorDirectory,
  coordinatorsOf,
  namesText,
  transferOutcome,
  transferSteps,
  waitingForText,
  type CoordinatorDirectory,
} from '../utils/programmeTransfers';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { ProgrammePill, StaysWithStudent, TransferStepList } from './ProgrammeTransferParts';
import { RecordPage } from './RecordPage';
import { ErrorState, LoadingState } from './StateViews';

type Dialog = 'approve' | 'reject' | 'cancel' | null;

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

function savedMessage(dialog: Exclude<Dialog, null>, row: ResearchAmendment, directory: CoordinatorDirectory): string {
  if (dialog === 'cancel') return 'Transfer cancelled. The student is told.';
  if (dialog === 'reject') return 'Transfer rejected. The office and the student are told your reason.';
  if (row.status === 'APPROVED') return `Transfer complete. ${row.studentName} is now in ${row.destinationProgramme}.`;
  const names = coordinatorsOf(directory, row.destinationProgramme);
  return `Approved. It now waits for ${names.length ? namesText(names) : 'the new programme coordinator'}.`;
}

/** One programme transfer: its steps, what stays with the student, and the decision for whoever acts next. */
export const ProgrammeTransferPage: React.FC<{ transferId: string }> = ({ transferId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const source = recordReturn(location.state?.recordReturn, { path: APP_ROUTES.registryTransfers, label: 'Programme transfers' }, APP_ROUTES.registry);
  const [row, setRow] = useState<ResearchAmendment | null>(null);
  const [directory, setDirectory] = useState<CoordinatorDirectory>({});
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tick, setTick] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);
  const titleId = useId();

  useEffect(() => {
    let cancelled = false;
    const id = Number(transferId);
    setError(null);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError('This transfer does not exist.');
      return;
    }
    Promise.all([getResearchAmendment(id), getProgrammeCoordinators().catch(() => [])])
      .then(([found, programmes]) => {
        if (cancelled) return;
        setRow(found);
        setDirectory(coordinatorDirectory(programmes));
      })
      .catch(err => !cancelled && setError(err instanceof ApiError && err.status === 404 ? 'This transfer is not available to you.' : errorText(err, 'Could not open this transfer.')));
    return () => {
      cancelled = true;
    };
  }, [transferId, reload]);

  const back = () => navigate(source.path);
  const open = (next: Dialog) => {
    setDialog(next);
    setTick(false);
    setText('');
    setProblem(null);
  };
  const close = () => !busy && setDialog(null);

  const confirm = async () => {
    if (!row || !dialog) return;
    const current = dialog;
    setBusy(true);
    setProblem(null);
    try {
      const updated = current === 'cancel'
        ? await cancelResearchAmendment(row.id, text.trim())
        : await decideResearchAmendment(row.id, {
          decision: current === 'approve' ? 'APPROVE' : 'REJECT',
          expectedStatus: row.status,
          reason: text.trim(),
          ...(current === 'approve' ? { retainTeam: true as const } : {}),
        });
      setRow(updated);
      setDialog(null);
      setToast({ message: savedMessage(current, updated, directory), tone: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDialog(null);
        setToast({ message: errorText(err, 'This transfer changed. It has been reloaded.'), tone: 'danger' });
        setReload(value => value + 1);
      } else {
        setProblem(errorText(err, 'Could not save this.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode, subtitle?: string, metadata?: React.ReactNode) => (
    <RecordPage title="Programme transfer" subtitle={subtitle} backLabel={`Back to ${source.label}`} onBack={back} metadata={metadata}
      dirty={dialog !== null && (Boolean(text.trim()) || tick)} busy={busy}>
      {children}
    </RecordPage>
  );

  if (error) return shell(<ErrorState message={error} onRetry={() => setReload(value => value + 1)} />);
  if (!row) return shell(<LoadingState message="Loading the transfer..." />);
  if (row.kind !== 'TRANSFER') {
    return shell(
      <section className="app-card space-y-3 p-6">
        <p className="text-[14px] text-slate-700">This is a research title or abstract change, not a programme transfer.</p>
        <PortalButton onClick={() => navigate(routeForSupervisorResearchRequest(String(row.id)))}>Open it in Supervisor Appointments</PortalButton>
      </section>,
    );
  }

  const outcome = transferOutcome(row);
  const requester = row.events.find(event => event.action === 'SUBMIT');
  const tasks = row.unfinishedTaskCount;
  const firstStep = row.status === 'PENDING_SOURCE_COORDINATOR';
  const nextNames = coordinatorsOf(directory, row.destinationProgramme);
  const metadata = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-slate-500">
      <span>Transfer #{row.id}</span>
      <span>Requested {historyTime(row.createdAt)}{requester ? ` by ${requester.actorName}` : ''}</span>
      {outcome ? <StatusBadge tone={outcome.tone} dot>{outcome.label}</StatusBadge> : <StatusBadge tone="warning" dot>{waitingForText(row, directory)}</StatusBadge>}
    </div>
  );
  const canConfirm = dialog === 'approve' ? tick : Boolean(text.trim());

  return shell(
    <>
      {outcome && (
        <div className={`rounded-2xl border px-5 py-4 text-[14px] ${outcome.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : outcome.tone === 'danger' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
          <p className="font-extrabold">
            {row.status === 'APPROVED' ? `Transferred on ${historyTime(outcome.at)}. Student Registry now shows ${row.destinationProgramme}.` : `${outcome.label}, ${historyTime(outcome.at)}. The programme did not change.`}
          </p>
          {outcome.reason && <p className="mt-1">"{outcome.reason}"</p>}
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="Transfer" className="app-card space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ProgrammePill programme={row.sourceProgramme} muted />
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-label="to" />
            <ProgrammePill programme={row.destinationProgramme} />
          </div>
          <div className="space-y-1">
            <h2 className="card-label">Reason</h2>
            <p className="whitespace-pre-wrap text-[14px] text-slate-800 [overflow-wrap:anywhere]">{row.reason}</p>
          </div>
          <div className="space-y-3">
            <h2 className="card-label">Steps</h2>
            <TransferStepList steps={transferSteps(row, directory)} />
          </div>
          {(row.canDecide || row.canCancel) && (
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
              {row.canCancel && <PortalButton onClick={() => open('cancel')}>Cancel request</PortalButton>}
              {row.canDecide && <PortalButton variant="danger" onClick={() => open('reject')}>Reject</PortalButton>}
              {row.canDecide && <PortalButton variant="primary" icon={Check} onClick={() => open('approve')}>Approve</PortalButton>}
            </div>
          )}
        </section>
        <StaysWithStudent
          primary={row.teamSnapshot?.primary?.name ?? ''}
          coSupervisors={(row.teamSnapshot?.coSupervisors ?? []).map(member => member.name)}
          panel={(row.teamSnapshot?.panel ?? []).map(member => member.name)}
          unfinished={tasks}
        />
      </div>

      <DialogShell
        title={dialog === 'approve' ? 'Approve this transfer?' : dialog === 'reject' ? 'Reject this transfer?' : 'Cancel this transfer?'}
        titleId={titleId}
        isOpen={dialog !== null}
        busy={busy}
        onClose={close}
        footer={<>
          <PortalButton onClick={close} disabled={busy}>Back</PortalButton>
          <PortalButton variant={dialog === 'approve' ? 'primary' : 'danger'} isLoading={busy} disabled={!canConfirm} onClick={() => void confirm()}>
            {dialog === 'approve' ? 'Approve' : dialog === 'reject' ? 'Reject' : 'Cancel request'}
          </PortalButton>
        </>}
      >
        {dialog === 'approve' ? (
          <>
            <p className="text-[14px] text-slate-700">
              {firstStep
                ? `It then goes to ${nextNames.length ? namesText(nextNames) : 'the coordinator'} of ${row.destinationProgramme}.`
                : `This completes the transfer. Student Registry and the research profile change to ${row.destinationProgramme}.`}
            </p>
            <label className="flex cursor-pointer items-start gap-3 text-[14px] font-semibold text-slate-800">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-navy" checked={tick} onChange={event => setTick(event.target.checked)} />
              <span>{row.studentName} keeps the supervisors and panel members{tasks ? ` and the ${tasks === 1 ? 'unfinished evaluation task' : `${tasks} unfinished evaluation tasks`}` : ''} shown here.</span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-bold text-slate-700">Note (optional)</span>
              <textarea className="form-control min-h-20 px-3.5 py-3 text-[14px]" maxLength={1000} value={text} onChange={event => setText(event.target.value)} />
            </label>
          </>
        ) : (
          <>
            <p className="text-[14px] text-slate-700">
              {dialog === 'reject'
                ? `${row.studentName} stays in ${row.sourceProgramme}. The office and the student see your reason.`
                : 'Nothing changes for the student. The student is told.'}
            </p>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-bold text-slate-700">Reason (required)</span>
              <textarea className="form-control min-h-20 px-3.5 py-3 text-[14px]" maxLength={1000} value={text} onChange={event => setText(event.target.value)} />
            </label>
          </>
        )}
        {problem && <p role="alert" className="text-[13px] font-semibold text-rose-700">{problem}</p>}
      </DialogShell>
      <PortalToast message={toast?.message ?? null} tone={toast?.tone ?? 'success'} onClose={() => setToast(null)} />
    </>,
    `${row.studentName} (${row.matricNo})`,
    metadata,
  );
};
