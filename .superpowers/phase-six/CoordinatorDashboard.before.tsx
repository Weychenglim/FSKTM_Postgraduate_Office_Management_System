import {DashboardHeader} from './DashboardHeader';
import React, { useCallback, useEffect, useState } from 'react';
import { Award, BarChart3, ChevronRight, Clock3, ShieldAlert } from 'lucide-react';
import { getCoordinatorPanelWorkspace, getDashboardSummary } from '../services';
import { CoordinatorPanelWorkspace, DashboardSummary, DashboardTask } from '../types';
import { APP_ROUTES, sidebarItemForPath } from '../constants/routes';
import { resolveDashboardTaskRoute } from '../utils/workflowAgeing';
import { DashboardTimeline } from './DashboardTimeline';
import { MonitoringTasksCard } from './MonitoringTasksCard';
import { ErrorState, LoadingState } from './StateViews';
import { PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { ActiveSemesterContext } from './ActiveSemesterContext';
import { CoordinatorDelegations } from './CoordinatorDelegations';
import { coordinatorProgrammeNames } from '../utils/coordinatorDelegations';

interface CoordinatorDashboardProps {
  onNavigateToTab: (tabName: string) => void;
  onNavigateToRoute?: (route: string) => void;
}

interface CoordinatorCardProps {
  title: string;
  value: string;
  subtext: string;
  badge: string;
  badgeTone: 'success' | 'warning' | 'info' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  actionLabel: string;
  disabled?: boolean;
  onClick?: () => void;
}

const CoordinatorCard: React.FC<CoordinatorCardProps> = ({
  title,
  value,
  subtext,
  badge,
  badgeTone,
  icon: Icon,
  actionLabel,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`bg-white border rounded-2xl p-5 text-left shadow-3xs transition-all min-h-[150px] flex flex-col justify-between ${
      disabled
        ? 'border-slate-200 cursor-not-allowed opacity-75'
        : 'border-[#e2e8f0] hover:border-slate-300 cursor-pointer group'
    }`}
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="card-label text-slate-500 block">
          {title}
        </span>
        <span className="card-metric block mt-3">
          {value}
        </span>
      </div>
      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-500 shrink-0">
        <Icon className="w-4.5 h-4.5" />
      </div>
    </div>
    <div className="space-y-3 pt-4">
      <StatusBadge tone={badgeTone} className="text-[9px]">{badge}</StatusBadge>
      <p className="card-description">{subtext}</p>
      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${
        disabled ? 'text-slate-400' : 'text-blue-600 group-hover:text-blue-800'
      }`}>
        {actionLabel}
        {!disabled && <ChevronRight className="w-3.5 h-3.5" />}
      </span>
    </div>
  </button>
);

export const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({
  onNavigateToTab,
  onNavigateToRoute,
}) => {
  const [workspace, setWorkspace] = useState<CoordinatorPanelWorkspace | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadWorkspace = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getCoordinatorPanelWorkspace(), getDashboardSummary()])
      .then(([panelWorkspace, dashboardSummary]) => {
        setWorkspace(panelWorkspace);
        setSummary(dashboardSummary);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load coordinator approvals.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const programmes = coordinatorProgrammeNames(workspace);
  const programmeLabel = programmes.join(', ');
  const hasProgramme = programmes.length > 0;
  const navigateToAction = (task: DashboardTask) => {
    const route = resolveDashboardTaskRoute(task);
    if (onNavigateToRoute) {
      onNavigateToRoute(route);
      return;
    }
    onNavigateToTab(sidebarItemForPath(route));
  };

  return (
    <div id="coordinator-dashboard-container" className="space-y-8 animate-fade-in text-left font-sans text-xs pb-16">
      <PortalToast message={toastMessage} />
      <DashboardHeader context={<ActiveSemesterContext />}
          actions={(
            <PortalButton
              variant="secondary"
              icon={BarChart3}
              onClick={() => onNavigateToRoute?.(APP_ROUTES.dashboardReports)}
            >
              View Workflow Reports
            </PortalButton>
          )}
      />

      {!loading && !error && <CoordinatorDelegations regularProgramme={workspace?.programme} effectiveProgrammes={programmes} onRefreshScope={loadWorkspace} />}

      <DashboardTimeline
        showManageTimeline={false}
        onTimelineUpdate={triggerToast}
        visibleRoles={['LECTURER']}
      />

      {loading ? (
        <LoadingState message="Loading coordinator approval summary…" />
      ) : error ? (
        <ErrorState message={error} onRetry={loadWorkspace} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <CoordinatorCard
            title="Supervisor Approvals"
            value={hasProgramme ? String(summary?.pendingSupervisorApprovals ?? 0) : '0'}
            subtext={hasProgramme
              ? `Supervisor applications awaiting your final decision for ${programmeLabel}.`
              : 'No managed programme is assigned to this coordinator account.'}
            badge={hasProgramme ? 'Final approval queue' : 'No programme assigned'}
            badgeTone={hasProgramme && (summary?.pendingSupervisorApprovals ?? 0) > 0 ? 'warning' : 'info'}
            icon={ShieldAlert}
            actionLabel={hasProgramme ? 'Review supervisor requests' : 'Approval unavailable'}
            disabled={!hasProgramme}
            onClick={() => onNavigateToTab('Supervisor Appointments')}
          />
          <CoordinatorCard
            title="Panel Approvals"
            value={hasProgramme ? String(workspace?.pendingCount ?? 0) : '0'}
            subtext={hasProgramme
              ? `Panel recommendations awaiting your final decision for ${programmeLabel}.`
              : 'No managed programme is assigned to this coordinator account.'}
            badge={hasProgramme ? 'Final approval queue' : 'No programme assigned'}
            badgeTone={hasProgramme && (workspace?.pendingCount ?? 0) > 0 ? 'warning' : 'info'}
            icon={hasProgramme ? Award : Clock3}
            actionLabel={hasProgramme ? 'Review panel requests' : 'Approval unavailable'}
            disabled={!hasProgramme}
            onClick={() => onNavigateToTab('Panel Appointments')}
          />
        </div>
      )}

      <MonitoringTasksCard
        title="Coordinator Action Centre"
        onTaskClick={navigateToAction}
      />
    </div>
  );
};
