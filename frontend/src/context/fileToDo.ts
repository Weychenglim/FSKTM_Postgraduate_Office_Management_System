/**
 * How many documents a student still has to hand in, for the sidebar badge.
 * Asked again on every page change, when the tab comes back into view and after
 * the student uploads, replaces or deletes a file.
 */
import { useEffect, useState } from 'react';
import { FILES_CHANGED_EVENT, getDocumentSummary } from '../services/filesApi';

export const toDoLabel = (count: number): string => `${count} ${count === 1 ? 'document' : 'documents'} to hand in`;

export function useFileToDo(enabled: boolean, pathname: string): number {
  const [count, setCount] = useState(0);
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;
    getDocumentSummary()
      .then((summary) => {
        if (!cancelled) setCount(summary.toDo ?? 0);
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
    window.addEventListener(FILES_CHANGED_EVENT, again);
    document.addEventListener('visibilitychange', backInView);
    return () => {
      window.removeEventListener(FILES_CHANGED_EVENT, again);
      document.removeEventListener('visibilitychange', backInView);
    };
  }, [enabled]);

  return count;
}
