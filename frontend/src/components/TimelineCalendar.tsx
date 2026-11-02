import { PortalModal } from './PortalModal';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ListTodo, X } from 'lucide-react';
import { StatusBadge } from './PortalPrimitives';
import { TimelineSubmissionStatus } from './LinkedPeriodStatus';
import { SemesterTimelineEntry, TimelineLevel } from '../types';

export interface TimelineCalendarGroup {
  level: TimelineLevel;
  entries: SemesterTimelineEntry[];
}

interface TimelineCalendarProps {
  groups: TimelineCalendarGroup[];
  activeLevel?: TimelineLevel;
  onActiveLevelChange?: (level: TimelineLevel) => void;
  showPhaseTabs?: boolean;
}

const levelLabels: Record<TimelineLevel, string> = {
  P1: 'Research Project 1',
  P2: 'Research Project 2',
};

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseDate = (value: string) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDisplayDate = (value: string) => {
  const date = parseDate(value);
  if (!date) return value;
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return `${monthNames[month - 1]} ${year}`;
};

const statusTone = (status: SemesterTimelineEntry['status']) => {
  if (status === 'Active') return 'info';
  if (status === 'Ended') return 'neutral';
  if (status === 'Deadline') return 'danger';
  return 'warning';
};

const monthsBetween = (entries: SemesterTimelineEntry[]) => {
  const dates = entries.flatMap((entry) => [parseDate(entry.deadlineStart), parseDate(entry.deadlineEnd)])
    .filter((date): date is Date => Boolean(date));

  if (dates.length === 0) return [];

  const min = new Date(Math.min(...dates.map((date) => date.getTime())));
  const max = new Date(Math.max(...dates.map((date) => date.getTime())));
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  const last = new Date(max.getFullYear(), max.getMonth(), 1);
  const keys: string[] = [];

  while (cursor <= last) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
};

const startOfMonthFromKey = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const endOfMonthFromKey = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0);
};

const dayDiff = (start: Date, end: Date) => {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - startUtc) / 86400000));
};

export const TimelineCalendar: React.FC<TimelineCalendarProps> = ({
  groups,
  activeLevel,
  onActiveLevelChange,
  showPhaseTabs = true,
}) => {
  const entriesByLevel = useMemo(() => {
    const map: Record<TimelineLevel, SemesterTimelineEntry[]> = { P1: [], P2: [] };
    groups.forEach((group) => {
      map[group.level] = [...group.entries].sort((a, b) => a.step - b.step);
    });
    return map;
  }, [groups]);

  const [internalActiveLevel, setInternalActiveLevel] = useState<TimelineLevel>(entriesByLevel.P1.length > 0 ? 'P1' : 'P2');
  const [selectedEntry, setSelectedEntry] = useState<SemesterTimelineEntry | null>(null);
  const selectedLevel = activeLevel ?? internalActiveLevel;
  const setSelectedLevel = (level: TimelineLevel) => {
    onActiveLevelChange?.(level);
    if (activeLevel === undefined) {
      setInternalActiveLevel(level);
    }
  };
  const activeEntries = entriesByLevel[selectedLevel];
  const monthKeys = monthsBetween(activeEntries);
  const rangeStart = monthKeys[0] ? startOfMonthFromKey(monthKeys[0]) : null;
  const rangeEnd = monthKeys[monthKeys.length - 1] ? endOfMonthFromKey(monthKeys[monthKeys.length - 1]) : null;
  const totalDays = rangeStart && rangeEnd ? dayDiff(rangeStart, rangeEnd) + 1 : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {showPhaseTabs ? (
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
            {(['P1', 'P2'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSelectedLevel(level)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                  selectedLevel === level
                    ? 'bg-brand-navy text-white shadow-3xs'
                    : 'text-slate-500 hover:bg-white hover:text-brand-navy'
                }`}
              >
                {levelLabels[level]}
              </button>
            ))}
          </div>
        ) : (
          <span className="sr-only">{levelLabels[selectedLevel]}</span>
        )}
        <span className="card-label">
          {activeEntries.length} {activeEntries.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
        <div className="bg-slate-50 px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            <h4 className="section-label">{levelLabels[selectedLevel]}</h4>
          </div>
        </div>

        {activeEntries.length === 0 ? (
          <div className="px-5 py-10 text-center bg-white">
            <ListTodo className="w-6 h-6 mx-auto mb-3 text-slate-400" />
            <p className="card-value">
              {selectedLevel === 'P2' ? 'P2 timeline is not available yet' : 'P1 timeline is not available yet'}
            </p>
            <p className="card-description mt-1">
              {selectedLevel === 'P2'
                ? 'P1 starts first.'
                : 'Upload the active semester timeline to show the first project phase.'}
            </p>
          </div>
        ) : (
          <div className="p-4 overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(monthKeys.length, 1)}, minmax(180px, 1fr))`,
                }}
              >
                {monthKeys.map((key) => (
                  <div
                    key={key}
                    className="card-label px-3 pb-2 border-b border-l first:border-l-0 border-slate-200"
                  >
                    {monthLabel(key)}
                  </div>
                ))}
              </div>

              {activeEntries.map((entry) => {
                const start = parseDate(entry.deadlineStart);
                const end = parseDate(entry.deadlineEnd) || start;
                const offsetDays = rangeStart && start ? dayDiff(rangeStart, start) : 0;
                const durationDays = start && end ? dayDiff(start, end) + 1 : 1;
                const leftPercent = Math.min(100, Math.max(0, (offsetDays / totalDays) * 100));
                const widthPercent = Math.max(4, Math.min(100 - leftPercent, (durationDays / totalDays) * 100));

                return (
                  <div
                    key={entry.id}
                    className="relative min-h-[72px] rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/70 transition overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 grid"
                      style={{ gridTemplateColumns: `repeat(${Math.max(monthKeys.length, 1)}, minmax(180px, 1fr))` }}
                    >
                      {monthKeys.map((key) => (
                        <div key={key} className="border-l first:border-l-0 border-slate-100" />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedEntry(entry)}
                      className="absolute top-3 min-h-11 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-left hover:border-indigo-300 hover:bg-indigo-100 transition shadow-3xs"
                      style={{
                        left: `${leftPercent}%`,
                        width: `min(${100 - leftPercent}%, max(${widthPercent}%, 180px))`,
                      }}
                    >
                      <span className="block text-[11px] font-black text-brand-navy leading-snug whitespace-normal break-words">
                        {entry.title || entry.detail}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedEntry && <PortalModal isOpen onClose={() => setSelectedEntry(null)} labelledBy="timeline-preview-title" className="max-w-xl p-0">
        <TimelineEventDetails entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      </PortalModal>}
    </div>
  );
};


export function TimelineEventDetails({entry,onClose}:{entry:SemesterTimelineEntry;onClose:()=>void}) {
  const linked = entry.linkedPeriodStatus;
  const showStatus = linked ? linked.datesEnforced !== false : true;
  return <>
    <div className="flex items-start justify-between gap-5 border-b border-slate-100 px-6 py-5 sm:px-7 sm:py-6">
      <div className="min-w-0 space-y-3 text-left">
        <h3 id="timeline-preview-title" className="text-sm font-semibold leading-6 text-slate-900 [overflow-wrap:anywhere]">{entry.title || entry.detail}</h3>
        {showStatus ? <div>{linked ? <TimelineSubmissionStatus status={linked} marks={!!entry.marksPeriodId}/>
          : <StatusBadge tone={statusTone(entry.status)} dot>{entry.status}</StatusBadge>}</div> : null}
      </div>
      <button type="button" onClick={onClose} className="icon-button h-9 w-9 shrink-0" aria-label="Close timeline details"><X aria-hidden="true" className="h-4 w-4" /></button>
    </div>
    <div className="space-y-6 px-6 py-6 text-left sm:px-7">
      <dl className="grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-2"><dt className="text-xs leading-5 text-slate-500">Starts on</dt><dd className="text-sm font-medium leading-6 text-slate-800"><time dateTime={entry.deadlineStart}>{formatDisplayDate(entry.deadlineStart)}</time></dd></div>
        <div className="space-y-2"><dt className="text-xs leading-5 text-slate-500">Ends on</dt><dd className="text-sm font-medium leading-6 text-slate-800"><time dateTime={entry.deadlineEnd}>{formatDisplayDate(entry.deadlineEnd)}</time></dd></div>
      </dl>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        <div className="space-y-2"><dt className="text-xs leading-5 text-slate-500">Project phase</dt><dd className="text-xs font-normal leading-6 text-slate-800">{levelLabels[entry.level]}</dd></div>
        {entry.action ? <div className="space-y-2"><dt className="text-xs leading-5 text-slate-500">Responsible parties</dt><dd className="text-xs font-normal leading-6 text-slate-800 [overflow-wrap:anywhere]">{entry.action}</dd></div> : null}
      </dl>
      {entry.detail ? <section className="space-y-3 border-t border-slate-100 pt-5" aria-label="Event description"><h4 className="text-xs font-semibold leading-5 text-slate-800">Description</h4><p className="whitespace-pre-wrap text-xs font-normal leading-6 text-slate-600 [overflow-wrap:anywhere]">{entry.detail}</p></section> : null}
    </div>
  </>;
}
