import {DashboardHeader} from './DashboardHeader';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Award, BarChart3, CheckSquare, ChevronRight, UsersRound } from 'lucide-react';
import { DashboardTimeline } from './DashboardTimeline';
import { MonitoringTasksCard } from './MonitoringTasksCard';
import { PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { getDashboardSummary, getOwnPanelWorkload, getOwnSupervisorWorkload } from '../services';
import { DashboardSummary, DashboardTask, PanelWorkloadSummary, SupervisorWorkloadSummary } from '../types';
import { APP_ROUTES, sidebarItemForPath } from '../constants/routes';
import { resolveDashboardTaskRoute } from '../utils/workflowAgeing';
import { ActiveSemesterContext } from './ActiveSemesterContext';
import { capacityStateLabel, capacityUtilization } from '../utils/lecturerCapacity';
import { ErrorState, LoadingState } from './StateViews';
import { useReturnToFocusReload } from '../utils/returnToFocus';

interface LecturerDashboardProps {
  lifecycleStatus?: string | null;
  onNavigateToTab: (tabName: string) => void;
  onNavigateToRoute?: (route: string) => void;
}

interface LecturerSummaryCardProps {
  title: string;
  value: string;
  subtext: string;
  badge: string;
  badgeTone: 'success' | 'warning' | 'info' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  actionLabel: string;
  onClick: () => void;
}

const LecturerSummaryCard: React.FC<LecturerSummaryCardProps> = ({
  title,
  value,
  subtext,
  badge,
  badgeTone,
  icon: Icon,
  actionLabel,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-white border border-[#e2e8f0] rounded-2xl p-5 text-left shadow-3xs hover:border-slate-300 transition-all cursor-pointer group min-h-[150px] flex flex-col justify-between"
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
      <p className="card-description">
        {subtext}
      </p>
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600 group-hover:text-blue-800">
        {actionLabel}
        <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </div>
  </button>
);

export function LecturerDashboardSummaryCards({ summary, loading, error, onRetry, onNavigateToTab, onNavigateToRoute }: {
  summary: DashboardSummary | null; loading: boolean; error: string | null; onRetry: () => void;
  onNavigateToTab: LecturerDashboardProps['onNavigateToTab']; onNavigateToRoute?: LecturerDashboardProps['onNavigateToRoute'];
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading || !summary) return <LoadingState message="Loading your Lecturer dashboard counts…" />;
  const navigate = (route: string, tab: string) => onNavigateToRoute ? onNavigateToRoute(route) : onNavigateToTab(tab);
  return <section aria-label="Your assignments" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
    <LecturerSummaryCard title="Students Under Supervision" value={summary.activeSupervisees == null ? 'Unavailable' : String(summary.activeSupervisees)}
      subtext="Students with an active primary or supporting supervision appointment with you."
      badge={`${summary.pendingSupervisorRequests} pending ${summary.pendingSupervisorRequests === 1 ? 'request' : 'requests'}`}
      badgeTone={summary.pendingSupervisorRequests > 0 ? 'warning' : 'success'} icon={UsersRound}
      actionLabel="View supervisees" onClick={() => navigate(APP_ROUTES.supervisorAppointmentSupervisees, 'Supervisor Appointments')} />
    <LecturerSummaryCard title="My Panel Assignments" value={summary.activePanelAssignments == null ? 'Unavailable' : String(summary.activePanelAssignments)}
      subtext="Students with a confirmed active Panel appointment assigned to you."
      badge={`${summary.pendingPanelReviews} pending ${summary.pendingPanelReviews === 1 ? 'review' : 'reviews'}`}
      badgeTone={summary.pendingPanelReviews > 0 ? 'warning' : 'success'} icon={Award}
      actionLabel="View panels" onClick={() => navigate(APP_ROUTES.panelAppointments, 'Panel Appointments')} />
    <LecturerSummaryCard title="Assigned Marks Tasks" value={String(summary.assignedMarkTasks ?? ((summary.supervisorMarkTasks ?? 0) + (summary.panelMarkTasks ?? 0) + (summary.backupMarkTasks ?? 0)))}
      subtext={`${summary.supervisorMarkTasks ?? 0} supervisor, ${summary.panelMarkTasks ?? 0} panel, ${summary.backupMarkTasks ?? 0} backup task(s).`}
      badge={`${summary.incompleteMarkEntries} incomplete`} badgeTone={summary.incompleteMarkEntries > 0 ? 'warning' : 'success'}
      icon={CheckSquare} actionLabel="Open marks" onClick={() => navigate(APP_ROUTES.marks, 'Marks Entry')} />
  </section>;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({
  lifecycleStatus,
  onNavigateToTab,
  onNavigateToRoute,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summaryVersion = useRef(0);
  const [supervisorCapacity, setSupervisorCapacity] = useState<SupervisorWorkloadSummary | null>(null);
  const [panelCapacity, setPanelCapacity] = useState<PanelWorkloadSummary | null>(null);

  const loadSummary = useCallback(async () => {
    const version = ++summaryVersion.current;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getDashboardSummary();
      if (summaryVersion.current === version) setSummary(data);
    } catch (reason) {
      if (summaryVersion.current === version) setSummaryError(reason instanceof Error ? reason.message : 'Failed to load Lecturer dashboard counts.');
    } finally {
      if (summaryVersion.current === version) setSummaryLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadSummary();
    return () => { summaryVersion.current += 1; };
  }, [loadSummary]);
  useReturnToFocusReload(() => { void loadSummary(); }, !summaryLoading);

  useEffect(() => {
    getOwnSupervisorWorkload().then(setSupervisorCapacity).catch(() => setSupervisorCapacity(null));
    getOwnPanelWorkload().then(setPanelCapacity).catch(() => setPanelCapacity(null));
  }, []);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const navigateToAction = (task: DashboardTask) => {
    const route = resolveDashboardTaskRoute(task);
    if (onNavigateToRoute) {
      onNavigateToRoute(route);
      return;
    }
    onNavigateToTab(sidebarItemForPath(route));
  };

  return (
    <div id="lecturer-dashboard-container" className="space-y-8 animate-fade-in text-left font-sans text-xs pb-16">
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

      {lifecycleStatus === 'RETIRING' && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <strong className="card-value block text-amber-900">Retirement transition in progress</strong>
            <p className="card-description mt-1 text-amber-900">You may resolve existing decisions, but new Supervisor, Panel, and Marks assignments are unavailable.</p>
          </div>
        </div>
      )}


      <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-heading">Your capacity and availability</h2><PortalButton size="sm" onClick={()=>onNavigateToRoute?.(APP_ROUTES.dashboardMyAvailability)}>Manage availability</PortalButton></div>
      <section className="grid gap-3 md:grid-cols-2" aria-label="Your semester capacity">
        {[
          { label: 'Supervisor capacity', value: supervisorCapacity },
          { label: 'Panel capacity', value: panelCapacity },
        ].map(({ label, value }) => (
          <div key={label} className="border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="card-label text-slate-400">{label}</p>
                <p className="card-metric mt-2">
                  {value ? `${value.workloadCount ?? value.currentStudents} / ${value.workloadLimit}` : 'Unavailable'}
                </p>
              </div>
              {value?.capacityState && <StatusBadge tone={value.selectable ? 'success' : 'warning'}>{capacityStateLabel(value.capacityState)}</StatusBadge>}
            </div>
            {value && (
              <>
                <div className="mt-3 h-2 overflow-hidden bg-slate-100">
                  <div className="h-full bg-brand-navy" style={{ width: `${capacityUtilization(value.workloadCount ?? value.currentStudents, value.workloadLimit)}%` }} />
                </div>
                <p className="card-description mt-2">
                  {value.semesterCode ?? 'No active semester'} · {value.capacityPlanVersion ? `Plan v${value.capacityPlanVersion}` : 'Plan not configured'}
                  {value.unavailableUntil ? ` · Unavailable until ${value.unavailableUntil}` : ''}
                </p>
              </>
            )}
          </div>
        ))}
      </section>
      </div>

      <DashboardTimeline
        showManageTimeline={false}
        onTimelineUpdate={triggerToast}
        visibleRoles={['LECTURER']}
      />

      <LecturerDashboardSummaryCards summary={summary} loading={summaryLoading} error={summaryError}
        onRetry={() => { void loadSummary(); }} onNavigateToTab={onNavigateToTab} onNavigateToRoute={onNavigateToRoute} />

      <MonitoringTasksCard
        title="Lecturer Action Centre"
        onTaskClick={navigateToAction}
      />
    </div>
  );
};
