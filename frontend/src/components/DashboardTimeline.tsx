import { useReturnToFocusReload } from '../utils/returnToFocus';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CalendarCog, ListTodo } from 'lucide-react';
import { getActiveTimeline } from '../services';
import { ActiveSemesterTimeline, TimelineLevel, TimelineRole } from '../types';
import { PortalButton } from './PortalPrimitives';
import { ErrorState, LoadingState } from './StateViews';
import { TimelineCalendar } from './TimelineCalendar';
import type { StudentProjectStatus } from '../services/registrySemestersApi';
import { todayInMalaysia } from '../utils/dateFields';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';

interface DashboardTimelineProps {
  onTimelineUpdate?: (message: string) => void;
  onManageTimeline?: () => void;
  showManageTimeline?: boolean;
  visibleRoles?: TimelineRole[];
  studentProject?: StudentProjectStatus | null;
}

export const DashboardTimeline: React.FC<DashboardTimelineProps> = ({
  onManageTimeline,
  showManageTimeline = true,
  visibleRoles,
  studentProject,
}) => {
  const [timeline, setTimeline] = useState<ActiveSemesterTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<TimelineLevel | null>(null);
  const activeLevel = selectedLevel ?? studentProject?.stage ?? 'P1';

  const loadTimeline = () => {
    setLoading(true);
    setError(null);
    getActiveTimeline()
      .then(setTimeline)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load semester timeline.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTimeline();
  }, []);

  useReturnToFocusReload(loadTimeline, !loading);

  const scopedTimeline = timeline?.available && visibleRoles
    ? {
        ...timeline,
        levels: timeline.levels
          .map((group) => ({
            ...group,
            entries: group.entries.filter((entry) =>
              visibleRoles.some((role) => entry.targetRoles.includes(role))
            ),
          }))
          .filter((group) => group.entries.length > 0),
      }
    : timeline;

  const projectStage = studentProject?.stage;
  const today = todayInMalaysia();
  const nextDeadline = projectStage && scopedTimeline?.available && scopedTimeline.semesterId === studentProject.semesterId
    ? scopedTimeline.levels.find(group => group.level === projectStage)?.entries
        .filter(entry => entry.deadlineEnd >= today && entry.status !== 'Ended' && !entry.marksPeriodId)
        .sort((a, b) => a.deadlineEnd.localeCompare(b.deadlineEnd))[0]
    : undefined;

  return (
    <div
      id="dashboard-semester-timeline-container"
      className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm text-left font-sans space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1f5f9] pb-4">
        <div id="timeline-title-meta" className="space-y-1 text-left">
          <h3 className="section-heading text-brand-navy">Semester timeline</h3>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {scopedTimeline?.available && (
            <div
              role="group"
              className="inline-flex max-w-full flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1"
              aria-label="Select research project timeline phase"
            >
              {([
                { level: 'P1', label: 'Research Project 1' },
                { level: 'P2', label: 'Research Project 2' },
              ] as const).map((option) => (
                <button
                  key={option.level}
                  type="button"
                  aria-pressed={activeLevel === option.level}
                  onClick={() => setSelectedLevel(option.level)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap ${
                    activeLevel === option.level
                      ? 'bg-brand-navy text-white shadow-3xs'
                      : 'text-slate-500 hover:bg-white hover:text-brand-navy'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {showManageTimeline && (
            <PortalButton
              onClick={onManageTimeline}
              variant="primary"
              size="md"
              icon={CalendarCog}
            >
              Manage Timeline
            </PortalButton>
          )}
        </div>
      </div>

      {nextDeadline && !loading && !error && (
        <div role="group" aria-label="Next deadline" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm leading-5">
          <span className="text-xs font-medium text-slate-600">Next {projectStage === 'P1' ? 'RP1' : 'RP2'} deadline</span>
          <span className="min-w-0 break-words font-semibold text-slate-800">{nextDeadline.title || nextDeadline.detail}</span>
          <time className="whitespace-nowrap text-xs text-slate-600" dateTime={nextDeadline.deadlineEnd}>
            {formatMalaysiaDate(nextDeadline.deadlineEnd)}
          </time>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading active semester timeline..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadTimeline} />
      ) : !scopedTimeline?.available ? (
        <div className="rounded-2xl border border-dashed border-slate-250 bg-slate-50/60 px-5 py-8 text-center">
          <ListTodo className="w-6 h-6 text-slate-400 mx-auto mb-3" />
          <p className="card-value text-brand-navy">
            {scopedTimeline?.message || 'No timeline available at now'}
          </p>
        </div>
      ) : scopedTimeline.levels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-250 bg-slate-50/60 px-5 py-8 text-center">
          <ListTodo className="w-6 h-6 text-slate-400 mx-auto mb-3" />
          <p className="card-value text-brand-navy">
            {visibleRoles
              ? 'No timeline events are available for your role this semester.'
              : 'No events published for this semester.'}
          </p>
        </div>
      ) : (
        <TimelineCalendar
          groups={scopedTimeline.levels}
          activeLevel={activeLevel}
          onActiveLevelChange={setSelectedLevel}
          showPhaseTabs={false}
        />
      )}

    </div>
  );
};
