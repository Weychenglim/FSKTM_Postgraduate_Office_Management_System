import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {PortalToast} from './PortalPrimitives';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'danger';
export type PublishDecisionFeedback = (message: string, tone: FeedbackTone, operationId?: string) => void;
const DecisionFeedback = createContext<PublishDecisionFeedback | null>(null);
type Notice = {eventId: number; message: string; tone: FeedbackTone};

/** The native top layer makes body portals inert. Wait until their output is usable. */
function useFeedbackSuspended() {
  const [suspended, setSuspended] = useState(false);
  useEffect(() => {
    const inspect = () => setSuspended(document.body.inert || document.documentElement.inert || !!document.querySelector('dialog:modal'));
    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'inert']});
    return () => observer.disconnect();
  }, []);
  return suspended;
}

/** A keyed owner gives each authenticated session its own queue and callback lifetime. */
function FeedbackOwner({children}: {children: React.ReactNode}) {
  const [queue, setQueue] = useState<Notice[]>([]);
  const mounted = useRef(true);
  const nextEvent = useRef(0);
  const operations = useRef(new Set<string>());
  const suspended = useFeedbackSuspended();
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const publish = useMemo<PublishDecisionFeedback>(() => (message, tone, operationId) => {
    if (!mounted.current || !message) return;
    if (operationId !== undefined) {
      if (operations.current.has(operationId)) return;
      operations.current.add(operationId);
    }
    const notice = {eventId: ++nextEvent.current, message, tone};
    setQueue(current => [...current, notice]);
  }, []);
  const notice = queue[0];
  return <DecisionFeedback.Provider value={publish}>
    {children}
    {notice && !suspended && <PortalToast eventId={notice.eventId} message={notice.message} tone={notice.tone}
      durationMs={notice.tone === 'success' || notice.tone === 'info' ? 4000 : undefined}
      onClose={() => setQueue(current => current[0]?.eventId === notice.eventId ? current.slice(1) : current)}/>}
  </DecisionFeedback.Provider>;
}

/** Outcomes survive routes, while nested page providers reuse the shell's single owner. */
export function DecisionFeedbackProvider({scopeKey, children}: {scopeKey: string; children: React.ReactNode}) {
  const ancestor = useContext(DecisionFeedback);
  return ancestor ? <>{children}</> : <FeedbackOwner key={scopeKey}>{children}</FeedbackOwner>;
}

export const useDecisionFeedback = () => useContext(DecisionFeedback);
