/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Announcement domain models (UC45).

export type AnnouncementTarget = 'All Students' | 'Lecturers' | 'Staff' | 'Coordinators' | 'All';
export type AnnouncementPriority = 'Urgent' | 'Info' | 'General';
export type AnnouncementStatus = 'Active' | 'Draft' | 'Scheduled' | 'Expired';

export interface AnnouncementItem {
  id: string;
  title: string;
  summary: string;
  target: AnnouncementTarget;
  /** Every group it goes to; `target` is the first of them. */
  audiences?: AnnouncementTarget[];
  priority: AnnouncementPriority;
  dateCreated: string;
  status: AnnouncementStatus;
  // Optional fields returned by the backend (absent in older mock rows).
  content?: string;
  createdBy?: string;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  /** Number of recipients reached, set on the create response when published. */
  deliveredTo?: number;
  /** Author's user id, and whether the caller may edit, publish or remove it. */
  createdById?: string | null;
  canManage?: boolean;
  /** When it publishes (null: when saved) and expires (null: never), with offsets. */
  publishAt?: string | null;
  expiresAt?: string | null;
  /** Registry targeting for student announcements; empty means every student. */
  targetProgrammes?: string[];
  targetIntakes?: string[];
  /** Set on a lecturer's notice: how many of their students it went to. */
  targetStudentCount?: number;
}

/**
 * Who the caller may send to. The office picks any group; a coordinator sends
 * to the students of their programmes; a lecturer to the students they supervise.
 */
export interface AnnouncementAudienceOptions {
  scope?: 'office' | 'programme' | 'supervisees';
  programmes: string[];
  intakes: string[];
  students?: number;
}
