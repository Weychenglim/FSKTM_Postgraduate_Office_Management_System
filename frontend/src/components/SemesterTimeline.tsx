/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ActiveSemesterTimeline } from '../types';
import { ErrorState, LoadingState } from './StateViews';
import { TimelineCalendar } from './TimelineCalendar';

interface SemesterTimelineProps {
  timeline: ActiveSemesterTimeline | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  actions?: React.ReactNode;
}

export const SemesterTimeline: React.FC<SemesterTimelineProps> = ({ timeline, loading, error, onRetry, actions }) => {
  return (
    <div
      id="semester-master-schedule-timeline-container"
      className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs text-left font-sans space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h3 id="semester-master-schedule-header" className="section-label">
            Semester schedule
          </h3>
          <p className="card-description mt-1">
            Manage the selected semester timeline by project phase.
          </p>
        </div>
        {actions ?? (!loading && !error && timeline?.available && (
          <span className="card-description">
            {timeline.semester.includes(timeline.session) ? timeline.semester : `${timeline.semester} ${timeline.session}`}
          </span>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Loading semester master schedule..." />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !timeline?.available ? (
        <div className="rounded-2xl border border-dashed border-slate-250 bg-slate-50/60 px-5 py-8 text-center">
          <p className="card-value text-brand-navy">
            {timeline?.message || 'No timeline available at now'}
          </p>
          <p className="card-description mt-1">
            Create one event or import the Excel template to start this semester's timeline.
          </p>
        </div>
      ) : (
        <TimelineCalendar groups={timeline.levels} />
      )}
    </div>
  );
};
