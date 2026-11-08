/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useId, useState } from 'react';
import type { ParticipantLifecycleRecord, ParticipantLifecycleStatus, ParticipantPendingWork, ParticipantType } from '../types';
import { ApiError } from '../services/apiClient';
import { cancelParticipantPendingWork, getParticipant, transitionParticipant } from '../services';
import { historyTime } from '../utils/documentDisplay';
import {
  allowedParticipantTransitions,
  lecturerAction,
  lecturerActionDone,
  lecturerActionPrompt,
  lecturerStatusLabel,
  lifecycleLabel,
  openWork,
  pendingWorkLabel,
  statusWords,
} from '../utils/participantLifecycle';
import { workLabel } from '../utils/staffAccounts';
import { DialogShell } from './DocumentDialogs';
import { PortalButton, StatusBadge } from './PortalPrimitives';
import { ErrorState } from './StateViews';

function explain(err: unknown): string[] {
  const message = err instanceof Error && err.message ? err.message : 'Could not save this.';
  const blockers = err instanceof ApiError && err.body && typeof err.body === 'object'
    ? (err.body as { blockers?: object }).blockers
    : undefined;
  return [message, ...(blockers ? openWork(blockers).map(workLabel) : [])];
}

function useParticipant(type: ParticipantType, identifier: string, version: unknown) {
  const [record, setRecord] = useState<ParticipantLifecycleRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    getParticipant(type, identifier)
      .then(found => { if (!cancelled) setRecord(found); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [type, identifier, version, reload]);
  const refresh = useCallback(() => setReload(value => value + 1), []);
  return { record, failed, refresh };
}

const ReasonDialog: React.FC<{
  title: string;
  note?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}> = ({ title, note, confirmLabel, cancelLabel, danger, onClose, onConfirm }) => {
  const titleId = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string[]>([]);

  const confirm = async () => {
    setBusy(true);
    setProblem([]);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setProblem(explain(err));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={title}
      titleId={titleId}
      isOpen
      busy={busy}
      onClose={onClose}
      footer={<>
        <PortalButton onClick={onClose} disabled={busy}>{cancelLabel}</PortalButton>
        <PortalButton variant={danger ? 'dangerSolid' : 'primary'} isLoading={busy} disabled={!reason.trim()} onClick={() => void confirm()}>{confirmLabel}</PortalButton>
      </>}
    >
      {note && <p className="text-[13.5px] text-slate-700">{note}</p>}
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">
        Reason (required)
        <textarea className="form-control min-h-20 px-3 py-2 text-[13.5px] font-medium" maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
      </label>
      {problem.length > 0 && (
        <div role="alert" className="space-y-1 text-[13px] font-semibold text-rose-700">
          <p>{problem[0]}</p>
          {problem.length > 1 && <ul className="list-disc space-y-0.5 pl-4">{problem.slice(1).map(line => <li key={line}>{line}</li>)}</ul>}
        </div>
      )}
    </DialogShell>
  );
};

interface CardStyle {
  card: string;
  title: string;
  text: string;
}

const STUDENT_STYLE: CardStyle = {
  card: 'p-4 bg-white rounded-xl border border-slate-200 space-y-3',
  title: 'text-[10px] uppercase font-black tracking-wider text-slate-450 block',
  text: 'text-[12px]',
};

const STAFF_STYLE: CardStyle = {
  card: 'app-card space-y-3 p-5',
  title: 'section-label',
  text: 'text-[13px]',
};

const WaitingRequests: React.FC<{
  type: ParticipantType;
  identifier: string;
  work: ParticipantPendingWork[];
  style: CardStyle;
  onChanged: (message: string) => void;
}> = ({ type, identifier, work, style, onChanged }) => {
  const [cancelling, setCancelling] = useState<ParticipantPendingWork | null>(null);
  if (work.length === 0) return null;
  return (
    <section aria-label="Waiting requests" className={style.card}>
      <h3 className={style.title}>Waiting requests</h3>
      <ul className="divide-y divide-slate-100">
        {work.map(item => (
          <li key={`${item.recordType}-${item.recordId}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
            <span className={`min-w-0 ${style.text}`}>
              <span className="block font-bold text-slate-800">{pendingWorkLabel(item.recordType)}</span>
              <span className="text-slate-500">{statusWords(item.status)}{item.studentId ? `, ${item.studentId}` : ''}</span>
            </span>
            <PortalButton size="sm" variant="danger" onClick={() => setCancelling(item)}>Cancel</PortalButton>
          </li>
        ))}
      </ul>
      {cancelling && (
        <ReasonDialog
          title={`Cancel this ${pendingWorkLabel(cancelling.recordType).toLowerCase()}?`}
          confirmLabel="Cancel request"
          cancelLabel="Keep request"
          danger
          onClose={() => setCancelling(null)}
          onConfirm={async reason => {
            await cancelParticipantPendingWork(type, identifier, cancelling.recordType, cancelling.recordId, reason);
            setCancelling(null);
            onChanged('Request cancelled.');
          }}
        />
      )}
    </section>
  );
};

const StatusHistory: React.FC<{ record: ParticipantLifecycleRecord; style: CardStyle }> = ({ record, style }) => {
  if (record.audits.length === 0) return null;
  const label = record.participantType === 'LECTURER' ? lecturerStatusLabel : lifecycleLabel;
  return (
    <section aria-label="Status history" className={style.card}>
      <h3 className={style.title}>Status history</h3>
      <ol className="space-y-3">
        {record.audits.map(audit => (
          <li key={audit.id} className={`border-l-2 border-slate-200 pl-3 ${style.text}`}>
            <span className="block font-bold text-slate-800">{label(audit.previousStatus)} to {label(audit.newStatus)}</span>
            <span className="block whitespace-pre-wrap text-slate-700">{audit.reason}</span>
            <span className="text-slate-500">{audit.actor}, {historyTime(audit.createdAt)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};

/** The Student Record's waiting requests, which the office can cancel, and status history. */
export const StudentStatusCards: React.FC<{ matric: string; version?: unknown; onChanged: (message: string) => void }> = ({ matric, version, onChanged }) => {
  const { record, failed, refresh } = useParticipant('STUDENT', matric, version);
  if (failed && !record) return <ErrorState message="Could not load the waiting requests." onRetry={refresh} />;
  if (!record) return null;
  const canCancel = record.lifecycleStatus === 'ACTIVE' || record.lifecycleStatus === 'DEFERRED';
  return (
    <>
      <WaitingRequests
        type="STUDENT"
        identifier={matric}
        work={canCancel ? record.pendingWork : []}
        style={STUDENT_STYLE}
        onChanged={message => { refresh(); onChanged(message); }}
      />
      <StatusHistory record={record} style={STUDENT_STYLE} />
    </>
  );
};

const STATUS_TONE: Partial<Record<ParticipantLifecycleStatus, 'success' | 'warning' | 'neutral'>> = {
  ACTIVE: 'success',
  RETIRING: 'warning',
};

/** A lecturer's account page: leaving, retired or resigned, and coming back. The profile is always kept. */
export const LecturerStatusCards: React.FC<{ staffId: string; name: string; onChanged: (message: string) => void }> = ({ staffId, name, onChanged }) => {
  const { record, failed, refresh } = useParticipant('LECTURER', staffId, 0);
  const [target, setTarget] = useState<ParticipantLifecycleStatus | null>(null);
  if (failed && !record) return <ErrorState message="Could not load the employment status." onRetry={refresh} />;
  if (!record) return null;
  const status = record.lifecycleStatus;
  const work = status === 'RETIRING' ? openWork(record.blockers) : [];
  const prompt = target ? lecturerActionPrompt(name, status, target) : null;
  return (
    <>
      <section aria-label="Employment" className={STAFF_STYLE.card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={STAFF_STYLE.title}>Employment</h2>
          <StatusBadge tone={STATUS_TONE[status] ?? 'neutral'}>{lecturerStatusLabel(status)}</StatusBadge>
        </div>
        {work.length > 0 && <p className="text-[13px] text-slate-600">Open work: {work.map(workLabel).join(', ')}</p>}
        <div className="flex flex-wrap gap-2">
          {allowedParticipantTransitions('LECTURER', status).map(next => (
            <PortalButton key={next} size="sm" onClick={() => setTarget(next)}>{lecturerAction(status, next)}</PortalButton>
          ))}
        </div>
      </section>
      <WaitingRequests
        type="LECTURER"
        identifier={staffId}
        work={status === 'RETIRING' ? record.pendingWork : []}
        style={STAFF_STYLE}
        onChanged={message => { refresh(); onChanged(message); }}
      />
      <StatusHistory record={record} style={STAFF_STYLE} />
      {target && prompt && (
        <ReasonDialog
          title={prompt.title}
          note={prompt.note}
          confirmLabel={lecturerAction(status, target)}
          cancelLabel="Cancel"
          danger={target === 'RETIRED' || target === 'RESIGNED'}
          onClose={() => setTarget(null)}
          onConfirm={async reason => {
            await transitionParticipant('LECTURER', staffId, { targetStatus: target, reason });
            setTarget(null);
            onChanged(lecturerActionDone(name, status, target));
          }}
        />
      )}
    </>
  );
};
