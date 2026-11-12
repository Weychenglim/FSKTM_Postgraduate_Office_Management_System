/**
 * How many RP correction requests wait for a coordinator, for the sidebar badge.
 * Asked again on every page change, when the tab comes back into view and after
 * the coordinator changes stages or keeps answers.
 */
import { useEffect, useState } from 'react';
import { getProjectStageWaiting, STAGES_CHANGED_EVENT } from '../services/registrySemestersApi';

export const correctionLabel = (count: number): string => `${count} correction ${count === 1 ? 'request' : 'requests'}`;

export function useStageCorrections(enabled: boolean, pathname: string): number {
  const [count, setCount] = useState(0);
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;
    getProjectStageWaiting()
      .then((waiting) => {
        if (!cancelled) setCount(waiting ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname, checks]);

  useEffect(() => {
    if (!enabled) return;
    const again = () => setChecks((value) => value + 1);
    const backInView = () => {
      if (document.visibilityState === 'visible') again();
    };
    window.addEventListener(STAGES_CHANGED_EVENT, again);
    document.addEventListener('visibilitychange', backInView);
    return () => {
      window.removeEventListener(STAGES_CHANGED_EVENT, again);
      document.removeEventListener('visibilitychange', backInView);
    };
  }, [enabled]);

  return count;
}
