/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Semester timeline API (UC46-UC48).

import {
  ActiveSemesterTimeline,
  DashboardTask,
  DashboardSummary,
  TimelineAuditLog,
  SemesterTimelineEntry,
  TimelineEntry,
  TimelineUploadResult,
  TimelineUploadPreview,
} from '../types';
import { request, requestBlob } from './apiClient';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDisplayDate(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
  }
  return value;
}

function toIsoDate(value: string): string {
  if (!value) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parts = value.split(' ');
  if (parts.length === 3) {
    const month = monthNames.findIndex((name) => name.toLowerCase() === parts[1].slice(0, 3).toLowerCase()) + 1;
    if (month > 0) {
      return `${parts[2]}-${String(month).padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return value;
}

function legacyCategory(entry: SemesterTimelineEntry): TimelineEntry['category'] {
  return entry.level === 'P1' ? 'Research Project (P1)' : 'Research Project (P2)';
}

function legacyLevel(entry: Pick<TimelineEntry, 'category'>): SemesterTimelineEntry['level'] {
  return entry.category === 'Research Project (P2)' ? 'P2' : 'P1';
}

export function timelineEntryToLegacy(entry: SemesterTimelineEntry): TimelineEntry {
  return {
    id: String(entry.id),
    event: entry.title || entry.detail,
    description: entry.detail,
    action: entry.action,
    category: legacyCategory(entry),
    startDate: formatDisplayDate(entry.deadlineStart),
    endDate: formatDisplayDate(entry.deadlineEnd),
    targetRole: entry.targetRoles,
    status: entry.status,
    operationalPeriodId: entry.operationalPeriodId,
    marksPeriodId: entry.marksPeriodId,
    linkedPeriodStatus: entry.linkedPeriodStatus,
  };
}

export async function getTimelineEntries(): Promise<TimelineEntry[]> {
  const timeline = await getActiveTimeline();
  return timeline.levels.flatMap((group) => group.entries.map(timelineEntryToLegacy));
}

export async function getActiveTimeline(semesterId?: number): Promise<ActiveSemesterTimeline> {
  const query = semesterId ? `?semesterId=${semesterId}` : '';
  return request<ActiveSemesterTimeline>(`/dashboard/timeline/active/${query}`);
}

export async function previewTimelineFile(file: File, semesterId: number): Promise<TimelineUploadPreview> {
  const body = new FormData();
  body.append('semesterId', String(semesterId));
  body.append('file', file);
  return request<TimelineUploadPreview>('/dashboard/timeline/upload/preview/', { method: 'POST', body });
}

export async function uploadTimelineFile(
  file: File,
  semesterId: number,
  previewToken: string,
  acknowledgeWarnings: boolean,
): Promise<TimelineUploadResult> {
  const body = new FormData();
  body.append('semesterId', String(semesterId));
  body.append('file', file);
  body.append('previewToken', previewToken);
  body.append('acknowledgeWarnings', String(acknowledgeWarnings));
  return request<TimelineUploadResult>('/dashboard/timeline/upload/', { method: 'POST', body });
}

export async function createTimelineEntry(
  entry: Omit<TimelineEntry, 'id' | 'status'>,
  semesterId?: number,
): Promise<SemesterTimelineEntry> {
  return request<SemesterTimelineEntry>('/dashboard/timeline/entries/', {
    method: 'POST',
    body: JSON.stringify({
      level: legacyLevel(entry),
      title: entry.event,
      detail: entry.description || entry.event,
      action: entry.action ?? entry.targetRole.join(' / '),
      deadlineStart: toIsoDate(entry.startDate),
      deadlineEnd: toIsoDate(entry.endDate),
      targetRoles: entry.targetRole,
      ...(semesterId ? { semesterId } : {}),
    }),
  });
}

export async function updateTimelineEntry(
  id: string,
  entry: Pick<TimelineEntry, 'event' | 'description' | 'category' | 'startDate' | 'endDate' | 'targetRole'> & { action?: string; weekLabel?: string; extensionReason?: string; expectedDeadlineEnd?: string },
  linkedDates = false,
): Promise<SemesterTimelineEntry> {
  return request<SemesterTimelineEntry>(`/dashboard/timeline/entries/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      level: legacyLevel(entry),
      title: entry.event,
      detail: entry.description || entry.event,
      ...(!linkedDates ? { deadlineStart: toIsoDate(entry.startDate), deadlineEnd: toIsoDate(entry.endDate) } : {}),
      ...(entry.extensionReason ? { extensionReason: entry.extensionReason, expectedDeadlineEnd: entry.expectedDeadlineEnd } : {}),
      targetRoles: entry.targetRole,
      ...(entry.action !== undefined ? { action: entry.action } : {}),
      ...(entry.weekLabel !== undefined ? { weekLabel: entry.weekLabel } : {}),
    }),
  });
}

export async function deleteTimelineEntry(id: string): Promise<void> {
  return request<void>(`/dashboard/timeline/entries/${id}/`, {
    method: 'DELETE',
  });
}

export async function getTimelineAuditLogs(semesterId?: number): Promise<TimelineAuditLog[]> {
  const query = semesterId ? `?semesterId=${semesterId}` : '';
  const result = await request<{ logs: TimelineAuditLog[] }>(`/dashboard/timeline/audit-logs/${query}`);
  return result.logs;
}

export async function downloadTimelineTemplate(semesterId?: number): Promise<Blob> {
  return requestBlob(`/dashboard/timeline/template/${semesterId ? `?semesterId=${semesterId}` : ''}`);
}

export async function getDashboardTasks(): Promise<{ tasks: DashboardTask[] }> {
  return request<{ tasks: DashboardTask[] }>('/dashboard/tasks/');
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>('/dashboard/summary/');
}

export function saveBlob(blob: Blob, filename: string): void {
  const element = document.createElement('a');
  element.href = URL.createObjectURL(blob);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(element.href);
}
