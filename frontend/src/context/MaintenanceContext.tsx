/**
 * Whether the portal is under maintenance. Asked when the app opens, every
 * minute, when the page comes back into view and whenever the server turns a
 * request away for maintenance.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PortalMaintenance } from '../types';
import { MAINTENANCE_EVENT } from '../services/apiClient';
import { getMaintenance } from '../services/maintenanceApi';
import { nextCheckDelay } from '../utils/maintenance';

interface MaintenanceWatch {
  maintenance: PortalMaintenance | null;
  refresh: () => void;
}

export const MaintenanceContext = createContext<MaintenanceWatch>({ maintenance: null, refresh: () => undefined });

export const useMaintenance = () => useContext(MaintenanceContext);

const isMaintenance = (value: unknown): value is PortalMaintenance =>
  typeof value === 'object' && value !== null && ['off', 'planned', 'on'].includes((value as PortalMaintenance).status);

export function useMaintenanceWatch(): MaintenanceWatch {
  const [maintenance, setMaintenance] = useState<PortalMaintenance | null>(null);
  const [checks, setChecks] = useState(0);
  const refresh = useCallback(() => setChecks((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    getMaintenance()
      .then((found) => {
        if (!cancelled && isMaintenance(found)) setMaintenance(found);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [checks]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, nextCheckDelay(maintenance));
    return () => window.clearTimeout(timer);
  }, [maintenance, checks, refresh]);

  useEffect(() => {
    const turnedAway = (event: Event) => {
      const found = (event as CustomEvent<unknown>).detail;
      if (isMaintenance(found)) setMaintenance(found);
    };
    const backInView = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(MAINTENANCE_EVENT, turnedAway);
    document.addEventListener('visibilitychange', backInView);
    return () => {
      window.removeEventListener(MAINTENANCE_EVENT, turnedAway);
      document.removeEventListener('visibilitychange', backInView);
    };
  }, [refresh]);

  return useMemo(() => ({ maintenance, refresh }), [maintenance, refresh]);
}
