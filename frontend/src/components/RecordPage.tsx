import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UNSAFE_DataRouterContext, useBlocker, useInRouterContext, useLocation, useNavigate } from 'react-router';
import { PageHeader, PortalConfirmModal } from './PortalPrimitives';
import { shouldBlockRecordNavigation } from '../utils/recordNavigation';
import { RecordDraft, RecordHost } from './RecordDraft';
import {useSessionExitDraft} from './SessionExit';
/** Keep list state alive while its record/form occupies the main page. */
export function RecordPageProvider({ children }: { children: React.ReactNode }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [active, activate] = useState<symbol | null>(null);
  return <RecordHost.Provider value={{ element, activate }}>
    <div hidden={active !== null} inert={active !== null ? true : undefined}>{children}</div>
    <div ref={setElement} />
  </RecordHost.Provider>;
}

export type RecordPageProps = {
  title: string; subtitle?: string; backLabel: string; onBack: () => void; children: React.ReactNode | ((requestBack: () => void) => React.ReactNode);
  actions?: React.ReactNode; metadata?: React.ReactNode; pageKey?: string; dirty?: boolean; busy?: boolean;
  /** Set synchronously only after a successful mutation, before its redirect. */
  navigationComplete?: React.RefObject<boolean>;
  /** After a completed write, close the local page only when no blocked route remains. */
  onNavigationSettled?: () => void;
};

function NavigationGuard({ dirty, busy, allow, pageKey, onNavigationSettled }: { dirty: boolean; busy: boolean; allow: React.RefObject<boolean>; pageKey?: string; onNavigationSettled?: () => void }) {
  const blocker = useBlocker(({ nextLocation }) => shouldBlockRecordNavigation(dirty, busy, allow.current, pageKey, nextLocation.state?.portalRecordPage));
  useEffect(() => {
    if (blocker.state === 'blocked' && !busy && (!dirty || allow.current)) blocker.proceed();
    else if (blocker.state === 'unblocked' && !dirty && !busy) onNavigationSettled?.();
  }, [blocker, busy, dirty, allow, onNavigationSettled]);
  return <PortalConfirmModal isOpen={blocker.state === 'blocked'} title={busy ? 'Saving changes' : 'Discard unsaved changes?'}
    message={busy ? 'Please wait for the current operation to finish.' : 'Your changes have not been saved. Leave this page and discard them?'}
    confirmLabel="Discard changes" cancelLabel="Stay on this page" isLoading={busy}
    onCancel={() => { if (!busy && blocker.state === 'blocked') blocker.reset(); }}
    onConfirm={() => { if (!busy && blocker.state === 'blocked') blocker.proceed(); }} />;
}

function RecordPageContent({ title, subtitle, backLabel, onBack, children, actions, metadata, pageKey, navigationComplete, onNavigationSettled, dirty: ownDirty = false, busy: ownBusy = false }: RecordPageProps) {
  const host = useContext(RecordHost);
  const page = useRef<HTMLDivElement>(null);
  const origin = useRef<{ focused: HTMLElement | null; top: number } | null>(null);
  const focusLifecycle = useRef(0);
  if (!origin.current && typeof document !== 'undefined') origin.current = { focused: document.activeElement as HTMLElement | null, top: window.scrollY };
  const key = useRef(Symbol('record-page'));
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const localAllow = useRef(false);
  const allow = navigationComplete ?? localAllow;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [drafts, setDrafts] = useState(new Map<symbol, { dirty: boolean; busy: boolean }>());
  const reportDraft = useCallback((key: symbol, state: { dirty: boolean; busy: boolean } | null) => setDrafts(current => {
    const old = current.get(key);
    if (state ? old?.dirty === state.dirty && old?.busy === state.busy : !old) return current;
    const next = new Map(current); if (state) next.set(key, state); else next.delete(key); return next;
  }), []);
  const dirty = ownDirty || [...drafts.values()].some(draft => draft.dirty);
  const busy = ownBusy || [...drafts.values()].some(draft => draft.busy);
  const previouslyDirty = useRef(false);
  useLayoutEffect(() => {
    // Permission for a completed transition does not cover later edits.
    if (dirty && !previouslyDirty.current) allow.current = false;
    previouslyDirty.current = dirty;
  }, [dirty, allow]);
  useEffect(() => {
    if (!dataRouter && !dirty && !busy) onNavigationSettled?.();
  }, [dataRouter, dirty, busy, onNavigationSettled]);
  useSessionExitDraft(dirty, busy, allow);
  useLayoutEffect(() => { host?.activate(key.current); return () => host?.activate(null); }, [host?.activate]);
  useEffect(() => {
    const generation = ++focusLifecycle.current;
    if (host && !host.element) return;
    const { focused, top } = origin.current ?? { focused: null, top: 0 };
    page.current?.querySelector<HTMLElement>('h1')?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
    return () => { requestAnimationFrame(() => { if (focusLifecycle.current !== generation || document.querySelector('[data-record-page]')) return; if (focused?.isConnected) focused.focus({ preventScroll: true }); window.scrollTo({ top, behavior: 'instant' }); }); };
  }, [host?.element, title, pageKey]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  const leave = () => { allow.current = true; onBack(); };
  const requestBack = () => { if (busy) return; if (dirty) setConfirmLeave(true); else leave(); };
  const content = <div ref={page} data-record-page className="space-y-6 pb-12 text-left font-sans">
    <PageHeader title={title} subtitle={subtitle} backLabel={backLabel} onBack={requestBack} backDisabled={busy} actions={actions ? <fieldset disabled={dirty || busy} className="contents">{actions}</fieldset> : undefined} />
    {metadata ? <div data-record-metadata>{metadata}</div> : null}
    <RecordDraft.Provider value={reportDraft}><div className="space-y-5">{typeof children === 'function' ? children(requestBack) : children}</div></RecordDraft.Provider>
    {dataRouter ? <NavigationGuard dirty={dirty} busy={busy} allow={allow} pageKey={pageKey} onNavigationSettled={onNavigationSettled} /> : null}
    <PortalConfirmModal isOpen={confirmLeave} title="Discard unsaved changes?" message="Your changes have not been saved. Return to the list and discard them?"
      confirmLabel="Discard changes" cancelLabel="Keep editing" onConfirm={leave} onCancel={() => setConfirmLeave(false)} />
  </div>;
  return host?.element ? createPortal(content, host.element) : content;
}

/** Local editors get a transient history entry, without storing academic data. */
function LocalRecordPage(props: RecordPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const entered = useRef(false);
  const started = useRef(false);
  const completed = useRef(false);
  const allow = props.navigationComplete ?? completed;
  const lifecycle = useRef(0);
  const onBack = useRef(props.onBack); onBack.current = props.onBack;
  const pageKey = props.pageKey!;
  const url = `${location.pathname}${location.search}${location.hash}`;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (location.state?.portalRecordPage === pageKey) { entered.current = true; return; }
    navigate(url, { state: { ...location.state, portalRecordPage: pageKey } });
  }, []);
  useEffect(() => {
    if (location.state?.portalRecordPage === pageKey) entered.current = true;
    else if (entered.current) { entered.current = false; onBack.current(); }
  }, [location.key, pageKey]);
  useEffect(() => {
    const generation = ++lifecycle.current;
    return () => { queueMicrotask(() => {
      // Successful save/cancel can close through the owning component. Remove only
      // this transient entry; never navigate away from a subsequently opened route.
      // StrictMode replays setup/cleanup. Only a real unmount removes history.
      if (lifecycle.current !== generation) return;
      if (entered.current && window.history.state?.usr?.portalRecordPage === pageKey) { allow.current = true; navigate(-1); }
    }); };
  }, []);
  return <RecordPageContent {...props} navigationComplete={allow} onBack={() => {
    if (entered.current && location.state?.portalRecordPage === pageKey) navigate(-1);
    else onBack.current();
  }} />;
}

export function RecordPage(props: RecordPageProps) {
  const routed = useInRouterContext();
  return props.pageKey && routed ? <LocalRecordPage {...props} /> : <RecordPageContent {...props} />;
}
