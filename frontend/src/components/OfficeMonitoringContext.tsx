import React, { createContext, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { officeMonitoringView, type OfficeMonitoringView } from '../utils/officeMonitoring';
import { ListState } from './ListState';
import { AlertMessage } from './AlertMessage';
import { PortalButton } from './PortalPrimitives';

const Context = createContext<{ view: OfficeMonitoringView; clear: () => void } | null>(null);
export const useOfficeMonitoring = () => useContext(Context);

/** Explicit dashboard links get fresh filters; ordinary browsing retains its list state. */
export function OfficeMonitoringProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const memory = useContext(ListState);
  const view = enabled ? officeMonitoringView(location.pathname, location.search) : null;
  const clear = () => {
    const query = new URLSearchParams(location.search);
    query.delete('monitor');
    navigate({ pathname: location.pathname, search: query.toString() ? `?${query}` : '' }, { state: location.state });
  };
  return <Context.Provider value={view ? { view, clear } : null}>
    <ListState.Provider value={view ? null : memory}>
      <React.Fragment key={view ? location.key : 'browse'}>{children}</React.Fragment>
    </ListState.Provider>
  </Context.Provider>;
}

const descriptions: Record<OfficeMonitoringView, string> = {
  'supervisor-pending': 'Primary and supporting requests awaiting Supervisor review.',
  'panel-pending': 'Panel recommendations awaiting Coordinator approval.',
  incomplete: 'Active evaluation tasks with no submitted marks.',
  'panel-capacity': 'Panel lecturers whose configured capacity is full or exceeded.',
};
export function OfficeMonitoringNotice() {
  const monitoring = useOfficeMonitoring();
  return monitoring ? <AlertMessage type="info" title="Dashboard monitoring" message={descriptions[monitoring.view]}
    actions={<PortalButton size="sm" onClick={monitoring.clear}>Clear monitoring view</PortalButton>} /> : null;
}
