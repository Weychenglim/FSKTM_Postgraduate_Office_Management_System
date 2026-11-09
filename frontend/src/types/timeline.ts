/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Semester timeline models (UC46-UC48).

export type TimelineCategory =
  | 'Supervisor Appointment'
  | 'Panel Appointment'
  | 'Document Submission'
  | 'Announcements'
  | 'Marks & Evaluation'
  | 'Research Project (P1)'
  | 'Research Project (P2)';

export type TimelineStatus = 'Ended' | 'Active' | 'Deadline' | 'Upcoming';
export type TimelineRole = 'STUDENT' | 'LECTURER' | 'OFFICE_STAFF';
export type TimelineLevel = 'P1' | 'P2';

export interface LinkedPeriodStatus {
  lifecycleStatus: string;
  scheduleStatus: 'UPCOMING' | 'OPEN' | 'ENDED';
  /** Null for Marks, whose evaluation rules are independent. */
  datesEnforced: boolean | null;
}

export interface TimelineEntry {
  id: string;
  event: string;
  description?: string;
  action?: string;
  category: TimelineCategory;
  startDate: string;
  endDate: string;
  targetRole: TimelineRole[];
  status: TimelineStatus;
  operationalPeriodId?: number | null;
  marksPeriodId?: number | null;
  linkedPeriodStatus?: LinkedPeriodStatus | null;
}

export interface SemesterTimelineEntry {
  id: number;
  level: TimelineLevel;
  step: number;
  title: string;
  detail: string;
  action: string;
  deadlineStart: string;
  deadlineEnd: string;
  weekLabel: string;
  targetRoles: TimelineRole[];
  status: TimelineStatus;
  operationalPeriodId?: number | null;
  marksPeriodId?: number | null;
  linkedPeriodStatus?: LinkedPeriodStatus | null;
  displayOrder: number;
}

export interface SemesterTimelineLevelGroup {
  level: TimelineLevel;
  entries: SemesterTimelineEntry[];
}

export interface ActiveSemesterTimeline {
  publication?: {publishedAt: string | null; publishedCount: number; hasUnpublishedChanges: boolean; reviewToken: string};
  available: boolean;
  id?: number;
  semesterId?: number | null;
  semesterCode?: string | null;
  semester?: string;
  session?: string;
  sourceFilename?: string;
  uploadedAt?: string;
  message?: string;
  levels: SemesterTimelineLevelGroup[];
}

export interface TimelinePreviewRow {
  level: TimelineLevel;
  step: number;
  title: string;
  detail: string;
  action: string;
  deadlineStart: string;
  deadlineEnd: string;
  targetRoles: TimelineRole[];
}

export interface TimelineUploadPreview {
  mode: 'ADD' | 'REPLACE';
  existingCount: number;
  resultingCount: number;
  previewToken: string;
  warnings: string[];
  rows: TimelinePreviewRow[];
  importedCount: number;
  requiresAcknowledgement: boolean;
}

export interface TimelineUploadResult {
  importedCount: number;
  timeline: ActiveSemesterTimeline;
}

export interface TimelineAuditLog {
  id: number;
  actorName: string;
  action: 'UPLOAD' | 'REPLACE' | 'ADD_ENTRY' | 'EDIT_ENTRY' | 'DELETE_ENTRY' | 'EXTEND' | 'PUBLISH';
  summary: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
  entryId: number | null;
  timelineId: number;
}
