/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowAgeingMetadata } from './appointment';
import type { DeadlineMetadata } from './marks';

export interface DashboardAttentionRow {
  id: string;
  type: string;
  count: string;
  targetTab: string;
  detail: string;
  markStatusTab?: import('../utils/markRecords').MarkRecordStatusTab;
}

export type StudentActionIconKey = 'upload' | 'award' | 'mail';

export interface StudentNextAction {
  title: string;
  meta: string;
  due: string;
  target: string;
  iconKey: StudentActionIconKey;
}

export type DashboardTaskTargetModule =
  | 'DASHBOARD'
  | 'SUPERVISOR_APPOINTMENTS'
  | 'PANEL_APPOINTMENTS'
  | 'MARKS';

export interface DashboardTaskTargetMetadata {
  targetModule?: DashboardTaskTargetModule | null;
  recordType?: string | null;
  recordId?: string | null;
}

export interface DashboardTask
  extends WorkflowAgeingMetadata, DeadlineMetadata, DashboardTaskTargetMetadata {
  id: string;
  name: string;
  status: string;
  statusText: string;
  target: string;
}

export interface DashboardSummary {
  activeSupervisees?: number;
  activePanelAssignments?: number;
  assignedMarkTasks?: number;
  pendingSupervisorRequests: number;
  pendingSupervisorApprovals: number;
  pendingPanelReviews: number;
  pendingPanelApprovals: number;
  incompleteMarkEntries: number;
  overdueMarkEntries: number;
  supervisorMarkTasks?: number;
  panelMarkTasks?: number;
  submittedMarkEntries?: number;
  reconciliationIssues?: number;
  reconciliationBlocking?: number;
}
