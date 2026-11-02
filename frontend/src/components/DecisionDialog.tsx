import {DraftNavigationGuard} from './DraftNavigationGuard';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {PortalModal, useModalTitle} from './PortalModal';
import {PortalButton, PortalToast, PortalConfirmModal} from './PortalPrimitives';
import {useRecordDraft} from './RecordDraft';
import {useDecisionFeedback} from './DecisionFeedback';
import {AlertMessage} from './AlertMessage';
import {createDecisionSubmission, decisionFailure, type DecisionOutcome} from '../utils/decisionSubmission';

export interface DecisionDialogProps {
  isOpen: boolean;
  size?: 'default' | 'wide';
  decisionKey?: string | number;
  title: string;
  context?: React.ReactNode;
  message: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  kind?: 'review' | 'confirmation';
  tone?: 'info' | 'warning' | 'danger';
  canConfirm?: boolean;
  busy?: boolean;
  dirty?: boolean;
  /** External editor input replaced by a successful latest-record read. */
  recoveryDirty?: boolean;
  standaloneGuard?: boolean;
  successMessage: string;
  onClose: () => void;
  /** Optional owner callbacks keep successful completion and draft disposal distinct. */
  onComplete?: () => void;
  onDiscard?: () => void;
  onConfirm: () => Promise<void | false | DecisionOutcome> | void;
  onReload?: () => Promise<unknown>;
}

/** Keep this host mounted after closure so the single outcome toast stays visible. */
export function DecisionDialog({isOpen, size='default', decisionKey, title, context, message, children, confirmLabel,
  cancelLabel='Cancel', kind='review', tone='info', canConfirm=true, busy=false, dirty=false, recoveryDirty=dirty, standaloneGuard=false,
  successMessage, onClose, onComplete, onDiscard, onConfirm, onReload}: DecisionDialogProps) {
  const titleId = useModalTitle();
  const messageId = useModalTitle();
  const feedback = useDecisionFeedback();
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [replace, setReplace] = useState(false);
  const [notice, setNotice] = useState<{message: string; tone: 'success' | 'warning'} | null>(null);
  const mounted = useRef(true);
  const lastIdentity = useRef(decisionKey ?? title);
  const identity = isOpen ? decisionKey ?? title : lastIdentity.current;
  lastIdentity.current = identity;
  const session = useRef({identity, open: isOpen, generation: 0});
  if (session.current.identity !== identity || (isOpen && !session.current.open)) {
    session.current = {identity, open: isOpen, generation: session.current.generation + 1};
  } else session.current.open = isOpen;
  const submission = useMemo(createDecisionSubmission, [identity]);
  const latestSubmission = useRef(submission); latestSubmission.current = submission;
  const operationSession = `${identity}:${session.current.generation}`;
  const scope = `${isOpen}:${operationSession}`;
  const latestScope = useRef(scope); latestScope.current = scope;
  const latestSession = useRef(operationSession); latestSession.current = operationSession;
  const saving = savingScope === operationSession;
  const pending = busy || saving || submission.isBusy();
  useRecordDraft(!standaloneGuard && isOpen && dirty, !standaloneGuard && isOpen && pending);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; }; }, []);
  useEffect(() => {
    setError(''); setBlocked(false); setDiscard(false); setReplace(false); submission.clearBlock();
  }, [identity, submission]);
  useEffect(() => {setDiscard(false); setReplace(false); if(isOpen)setNotice(null);}, [isOpen]);

  const requestClose = () => {
    if (pending || submission.isBusy()) return;
    setReplace(false);
    if (dirty) setDiscard(true); else onClose();
  };
  const confirm = async () => {
    if (!isOpen || pending || submission.isBusy() || submission.isBlocked() || blocked || discard || replace || !canConfirm) return;
    const operationScope = scope;
    const startedSession = operationSession;
    setSavingScope(startedSession); setError('');
    try {
      const result = await submission.run(async () => onConfirm());
      if (!result.started || result.value === false) return;
      if (mounted.current && latestSession.current !== startedSession) return;
      const refreshFailed = result.value && result.value.refreshFailed;
      const savedMessage = (result.value && result.value.successMessage) || successMessage;
      const outcome = {tone: refreshFailed ? 'warning' as const : 'success' as const, message: refreshFailed
        ? `${savedMessage} The latest record could not be loaded. Reload it before another action.` : savedMessage};
      if (feedback) feedback(outcome.message, outcome.tone);
      else if (mounted.current && latestScope.current === operationScope) setNotice(outcome);
      if (mounted.current && latestScope.current === operationScope) (onComplete ?? onClose)();
    } catch (failure) {
      const outcome = decisionFailure(failure);
      // A record-level stale/permission latch survives reopening this same action.
      // Make that latch visible even if its original dialog session was replaced.
      if (mounted.current && (latestScope.current === operationScope || (outcome.blocked && latestSubmission.current === submission))) {
        setError(outcome.message); setBlocked(outcome.blocked);
      }
    } finally { if (mounted.current) setSavingScope(current => current === startedSession ? null : current); }
  };
  const reload = async () => {
    if (!onReload || pending || submission.isBusy()) return;
    const operationScope = scope, startedSession = operationSession;
    setReplace(false);
    setSavingScope(startedSession);
    try { await onReload(); if (mounted.current && latestScope.current === operationScope) {submission.clearBlock(); setBlocked(false); setError(''); onClose();} }
    catch (failure) { if (mounted.current && latestScope.current === operationScope) setError(decisionFailure(failure).message); }
    finally { if (mounted.current) setSavingScope(current => current === startedSession ? null : current); }
  };

  return <>
    {standaloneGuard && <DraftNavigationGuard dirty={isOpen && dirty} busy={isOpen && pending} onDiscard={onDiscard ?? onClose}/>}
    <PortalToast message={notice?.message ?? null} tone={notice?.tone} onClose={() => setNotice(null)}/>
    <PortalModal isOpen={isOpen} onClose={requestClose} busy={pending} labelledBy={titleId} describedBy={messageId} className={`${size==='wide'?'max-w-3xl':'max-w-lg'} overscroll-contain p-6 md:p-8`}>
      <form onSubmit={event => {event.preventDefault(); void confirm();}} className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
            <p className="text-xs font-bold text-slate-700">{kind==='review' ? 'Review decision' : 'Confirm your action'}</p>
            <h2 id={titleId} className="text-lg font-semibold leading-snug text-brand-navy">{title}</h2>
            {context ? <div className="text-sm font-semibold leading-relaxed text-brand-navy">{context}</div> : null}
          </div>
          <button type="button" onClick={requestClose} disabled={pending} aria-label="Close dialog"
            className="icon-button h-9 w-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-50">
            <X className="h-4 w-4" aria-hidden="true"/>
          </button>
        </div>
        <div id={messageId} className="text-xs font-normal leading-relaxed text-slate-700 [overflow-wrap:anywhere]">{message}</div>
        {children ? <fieldset disabled={pending || blocked} className="decision-dialog-fields min-w-0 space-y-4">{children}</fieldset> : null}
        {error ? <AlertMessage type="error" title={blocked?'Record needs review':'Action wasn’t completed'} message={error}>
          {blocked ? <p>Review the latest record and your access before making another decision.</p> : null}
        </AlertMessage> : null}
        {replace ? <div role="alert" className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-normal leading-relaxed text-amber-900">Replace the information entered in this dialog after loading the latest record?</p>
          <div className="flex flex-wrap justify-end gap-3"><PortalButton type="button" autoFocus onClick={() => setReplace(false)}>Keep editing</PortalButton><PortalButton type="button" onClick={() => void reload()}>Replace and review</PortalButton></div>
        </div> : <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <PortalButton type="button" disabled={pending} onClick={requestClose}>{cancelLabel}</PortalButton>
          {blocked ? onReload ? <PortalButton type="button" isLoading={saving} disabled={busy} onClick={() => {if(recoveryDirty)setReplace(true);else void reload();}}>Review latest record</PortalButton> : null
            : <PortalButton type="submit" variant={tone==='danger' ? 'dangerSolid' : 'primary'} isLoading={pending} disabled={!canConfirm || pending}>{confirmLabel}</PortalButton>}
        </div>}
      </form>
    </PortalModal>
    <PortalConfirmModal isOpen={isOpen && discard} title="Discard unsaved changes?"
      message="The information entered in this dialog has not been saved."
      confirmLabel="Discard changes" cancelLabel="Keep editing" isLoading={pending}
      onCancel={() => setDiscard(false)} onConfirm={() => {if(!pending){setDiscard(false);(onDiscard ?? onClose)();}}}/>
  </>;
}
