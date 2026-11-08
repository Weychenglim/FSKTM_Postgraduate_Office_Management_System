import type { CapacityRole, CapacityState } from './lecturerCapacity';

export type WorkflowReportRole = 'OFFICE_ADMIN' | 'COORDINATOR' | 'LECTURER';

export interface WorkflowReportFilters {
  startDate?: string;
  endDate?: string;
  programme?: string;
  semester?: string;
}

export interface WorkflowReportRecord {
  recordType: string;
  recordId: string;
  studentId?: string;
  studentName?: string;
  programme?: string;
  assignee?: string;
  status: string;
  reportDate: string;
  semesterId?: number | null;
  semesterCode?: string | null;
  semester?: string;
  waitingSince?: string | null;
  waitingDays?: number | null;
  waitingOn?: string | null;
  ageBand?: string | null;
  evaluatorRole?: string;
  dueAt?: string | null;
  daysUntilDue?: number | null;
  deadlineState?: string;
  title?: string;
  level?: string;
  targetRoles?: string[];
  capacityPlanId?: number | null;
  capacityPlanVersion?: number | null;
  capacityState?: CapacityState;
  capacityLimit?: number;
  capacityLoad?: number;
  availableSlots?: number;
  unavailableUntil?: string | null;
}

export interface ReportModuleSummary {
  total: number;
  statusCounts: Record<string, number>;
  waitingOwnerCounts: Record<string, number>;
  ageBands: Record<string, number>;
  records: WorkflowReportRecord[];
}

export interface MarksReportSummary {
  total: number;
  statusCounts: Record<string, number>;
  deadlineStateCounts: Record<string, number>;
  evaluatorRoleCounts: Record<string, number>;
  completionRate: number | null;
  records: WorkflowReportRecord[];
}

export interface TimelineReportSummary {
  total: number;
  statusCounts: Record<string, number>;
  levelCounts: Record<string, number>;
  targetRoleCounts: Record<string, number>;
  records: WorkflowReportRecord[];
}

export interface WorkflowReportAttentionItem {
  kind:
    | 'WAITING'
    | 'DEADLINE'
    | 'PARTICIPANT_LIFECYCLE'
    | 'RECONCILIATION'
    | 'LECTURER_CAPACITY';
  recordType: string;
  recordId: string;
  studentId: string | null;
  label: string;
  programme: string;
  waitingDays: number | null;
  waitingOn: string | null;
  deadlineState: string | null;
  dueAt: string | null;
  participantStatus?: string;
  targetModule?: string;
  capacityRole?: CapacityRole;
  capacityState?: CapacityState;
  unavailableUntil?: string | null;
}

export interface WorkflowCapacitySummary {
  semesterId: number;
  semesterCode: string;
  supervisor: Record<CapacityState, number>;
  panel: Record<CapacityState, number>;
}

export interface WorkflowReport {
  researchAmendments?: ReportModuleSummary;
  generatedAt: string;
  scope: {
    role: WorkflowReportRole;
    programme: string | null;
  };
  filters: {
    startDate: string | null;
    endDate: string | null;
    programme: string | null;
    availableProgrammes: string[];
    semester: string;
    selectedSemester: {
      semesterId: number;
      semesterCode: string;
      semester: string;
    } | null;
    availableSemesters: Array<{
      semesterId: number;
      semesterCode: string;
      semester: string;
      lifecycleStatus: string;
      effectiveStatus: string;
    }>;
  };
  overview: {
    totalRecords: number;
    pendingApprovals: number;
    averageWaitingDays: number | null;
    longestWaitingDays: number | null;
    marksCompletionRate: number | null;
    overdueMarks: number;
    activeTimelineEntries: number;
  };
  supervisor: ReportModuleSummary | null;
  panel: ReportModuleSummary | null;
  marks: MarksReportSummary | null;
  timeline: TimelineReportSummary | null;
  participantLifecycle: {
    activeStudents: number;
    deferredStudents: number;
    graduatedStudents: number;
    withdrawnStudents: number;
    activeLecturers: number;
    retiringLecturers: number;
    retiredLecturers: number;
    resignedLecturers: number;
  } | null;
  capacity: WorkflowCapacitySummary | null;
  reconciliation: {
    total: number;
    blocking: number;
    warnings: number;
    repairable: number;
    reviewRequired: number;
  } | null;
  attention: WorkflowReportAttentionItem[];
}
