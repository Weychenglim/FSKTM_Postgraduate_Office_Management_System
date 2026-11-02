import React, {useContext, useEffect, useRef, useState} from 'react';
import {UNSAFE_DataRouterContext, useBlocker} from 'react-router';
import {RecordDraft, useRecordDraft} from './RecordDraft';
import {useSessionExitDraft} from './SessionExit';
import {PortalConfirmModal} from './PortalPrimitives';

type Props = {dirty: boolean; busy?: boolean; onDiscard?: () => void};

function RouterGuard({dirty, busy = false, onDiscard, onSettled}: Props & {onSettled: () => void}) {
  const blocker = useBlocker(dirty || busy);
  useEffect(() => {
    if (dirty || busy) return;
    if (blocker.state === 'blocked') blocker.proceed();
    else if (blocker.state === 'unblocked') onSettled();
  }, [blocker, dirty, busy, onSettled]);
  return <PortalConfirmModal isOpen={blocker.state === 'blocked'} title={busy ? 'Saving changes' : 'Discard unsaved changes?'}
    message={busy ? 'Please wait for the current operation to finish.' : 'Your changes have not been saved. Leave this page and discard them?'}
    confirmLabel="Discard changes" cancelLabel="Stay on this page" isLoading={busy}
    onCancel={() => {if (!busy && blocker.state === 'blocked') blocker.reset();}}
    onConfirm={() => {if (!busy && blocker.state === 'blocked') {const proceed = blocker.proceed; onDiscard?.(); proceed();}}}/>;
}

function StandaloneGuard({dirty, busy = false, onDiscard}: Props) {
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const allow = useRef(false);
  // SessionExit may grant permission only for its final exit. A later draft is new work.
  useEffect(() => {allow.current = false;}, [dirty, busy]);
  useSessionExitDraft(dirty, busy, allow);
  const [retained, setRetained] = useState(false);
  useEffect(() => {if (dirty || busy) setRetained(true);}, [dirty, busy]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  // Keep a blocked route alive through the clean render following completion.
  // Inactive siblings must not register competing React Router blockers.
  return dataRouter && (dirty || busy || retained) ? <RouterGuard dirty={dirty} busy={busy} onDiscard={onDiscard} onSettled={() => setRetained(false)}/> : null;
}

/** Keep mounted across closure/completion. Nested editors report to their RecordPage only. */
export function DraftNavigationGuard({dirty, busy = false, onDiscard}: Props) {
  const owner = useContext(RecordDraft);
  useRecordDraft(dirty, busy);
  return owner ? null : <StandaloneGuard dirty={dirty} busy={busy} onDiscard={onDiscard}/>;
}
