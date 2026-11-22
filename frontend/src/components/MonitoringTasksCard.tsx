/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ListChecks,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardTask } from '../types';
import {
  formatDeadlineText,
  formatWaitingText,
} from '../utils/workflowAgeing';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { StatusBadge, getStatusBadgeTone } from './PortalPrimitives';

interface MonitoringTasksCardProps {
  title?: string;
  onTaskClick?: (task: DashboardTask) => void;
  className?: string;
}

interface MonitoringTasksCardContainerProps extends MonitoringTasksCardProps {
  projectStage?: string | null;
}

interface MonitoringTasksCardViewProps extends MonitoringTasksCardProps {
  tasks: DashboardTask[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const loadDashboardTasks = async (): Promise<{ tasks: DashboardTask[] }> => {
  const { getDashboardTasks } = await import('../services/timelineApi');
  return getDashboardTasks();
};

const iconForTask = (task: DashboardTask): LucideIcon => {
  if (task.targetModule === 'SUPERVISOR_APPOINTMENTS') return UserCheck;
  if (task.targetModule === 'PANEL_APPOINTMENTS') return Award;
  if (task.targetModule === 'MARKS') return ClipboardCheck;
  if (task.targetModule === 'DASHBOARD') return CalendarDays;
  return ListChecks;
};

const taskMetadataText = (task: DashboardTask): string => {
  if (
    task.waitingOn
    || task.waitingSince
    || (task.waitingDays !== null && task.waitingDays !== undefined)
  ) {
    return formatWaitingText(task);
  }

  if (task.deadlineState) {
    return formatDeadlineText(task);
  }

  return task.statusText;
};

export const MonitoringTasksCardView: React.FC<MonitoringTasksCardViewProps> = ({
  title = 'Action Centre',
  tasks,
  loading,
  error,
  onRetry,
  onTaskClick,
  className = '',
}) => (
  <section
    id="dashboard-action-centre"
    aria-labelledby="dashboard-action-centre-title"
    className={`bg-white border border-slate-200 rounded-lg p-5 shadow-sm text-left font-sans ${className}`}
  >
    <div className="flex items-center justify-between gap-3">
      <h2
        id="dashboard-action-centre-title"
        className="section-label"
      >
        {title}
      </h2>
      {!loading && !error && (
        <StatusBadge tone="neutral" className="shrink-0">
          {tasks.length} {tasks.length === 1 ? 'item' : 'items'}
        </StatusBadge>
      )}
    </div>

    {loading ? (
      <LoadingState message="Loading action centre..." className="py-10" />
    ) : error ? (
      <ErrorState message={error} onRetry={onRetry} className="py-10" />
    ) : tasks.length === 0 ? (
      <EmptyState
        icon={ListChecks}
        title="No actions waiting"
        className="py-10"
      />
    ) : (
      <div className="divide-y divide-slate-100 pt-2">
        {tasks.map((task) => {
          const Icon = iconForTask(task);
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onTaskClick?.(task)}
              className="w-full py-4 px-1 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="card-value block leading-snug">
                    {task.name}
                  </span>
                  <StatusBadge
                    tone={getStatusBadgeTone(task.status)}
                    className="mt-1.5 max-w-full normal-case"
                  >
                    {taskMetadataText(task)}
                  </StatusBadge>
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          );
        })}
      </div>
    )}
  </section>
);

export const MonitoringTasksCard: React.FC<MonitoringTasksCardContainerProps> = ({ projectStage, ...props }) => {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);

    loadDashboardTasks()
      .then((result) => {
        if (active) setTasks(result.tasks);
      })
      .catch((reason) => {
        if (!active) return;
        setTasks([]);
        setError(
          reason instanceof Error
            ? reason.message
            : 'Failed to load dashboard actions.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => loadTasks(), [loadTasks, projectStage]);

  return (
    <MonitoringTasksCardView
      {...props}
      tasks={tasks}
      loading={loading}
      error={error}
      onRetry={loadTasks}
    />
  );
};
