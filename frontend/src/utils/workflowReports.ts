import type { UserRole, WorkflowReport, WorkflowReportAttentionItem, WorkflowReportFilters } from '../types';
import {
  APP_ROUTES,
  routeForDashboardTimeline,
  routeForWorkflowReconciliation,
  routeForPanelRecommendation,
  routeForSupervisorApplication,
  routeForSupervisorResearchRequest,
} from '../constants/routes';

export const buildWorkflowReportQuery = (filters: WorkflowReportFilters): string => {
  const params = new URLSearchParams();
  if (filters.startDate?.trim()) params.set('startDate', filters.startDate.trim());
  if (filters.endDate?.trim()) params.set('endDate', filters.endDate.trim());
  if (filters.programme?.trim()) params.set('programme', filters.programme.trim());
  if (filters.semester?.trim()) params.set('semester', filters.semester.trim());
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const formatReportMetric = (
  value: number | null | undefined,
  suffix = '',
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value}${suffix}`;
};

export function getLecturerReportMetrics(report: WorkflowReport) {
  const cards = [{
    id: 'waiting',
    label: 'Waiting requests',
    value: report.overview.pendingApprovals,
    description: 'Assigned workflows awaiting a decision, including other reviewers.',
  }];
  if (report.marks) {
    cards.push(
      {
        id: 'evaluations',
        label: 'Evaluations to complete',
        value: report.marks.records.filter(row => row.status !== 'SUBMITTED').length,
        description: 'Your assigned evaluations that have not been submitted.',
      },
      {
        id: 'overdue',
        label: 'Overdue evaluations',
        value: report.overview.overdueMarks,
        description: 'Assigned evaluations past their recorded deadline.',
      },
    );
  }
  return cards;
}

export const canAccessWorkflowReports = (role: UserRole): boolean =>
  role === 'Office Staff/Admin'
  || role === 'Programme Coordinator'
  || role === 'Lecturer';

export const canOpenReportDossier = (
  item: Pick<WorkflowReportAttentionItem, 'recordType' | 'studentId'>,
): boolean => Boolean(item.studentId) && !item.recordType.startsWith('CO_SUPERVISOR_') && item.recordType !== 'RESEARCH_AMENDMENT';

export const resolveWorkflowReportRecordRoute = (
  item: Pick<WorkflowReportAttentionItem, 'recordType' | 'recordId'>,
): string => {
  if (item.recordType === 'STUDENT_PARTICIPANT') return `${APP_ROUTES.registry}?student=${encodeURIComponent(item.recordId)}`;
  if (item.recordType === 'LECTURER_PARTICIPANT') return APP_ROUTES.registryStaff;
  if (item.recordType === 'RECONCILIATION_ISSUE') {
    return routeForWorkflowReconciliation();
  }
  if (item.recordType === 'SUPERVISOR_APPLICATION') {
    return routeForSupervisorApplication(item.recordId);
  }
  if (item.recordType === 'RESEARCH_AMENDMENT') {
    return routeForSupervisorResearchRequest(item.recordId);
  }
  if (item.recordType === 'CO_SUPERVISOR_NOMINATION' || item.recordType === 'CO_SUPERVISOR_APPOINTMENT') {
    return APP_ROUTES.supervisorAppointments;
  }
  if (item.recordType === 'PANEL_RECOMMENDATION') {
    return routeForPanelRecommendation(item.recordId);
  }
  if (item.recordType === 'TIMELINE_ENTRY') {
    return routeForDashboardTimeline();
  }
  return item.recordType === 'MARK_TASK' ? APP_ROUTES.marks : APP_ROUTES.dashboardReports;
};

export const reportLabel = (value: string): string =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
