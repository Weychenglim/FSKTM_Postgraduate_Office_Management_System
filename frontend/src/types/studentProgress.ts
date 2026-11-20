import type { AppointmentLifecycleEvent, SupervisorWorkflowEvent } from './appointment';

export type StudentProgressVisibility = 'INTERNAL' | 'PUBLIC';
export type StudentProgressSection = 'SUPERVISOR' | 'PANEL' | 'MARKS' | 'TIMELINE';
export type StudentProgressTab = StudentProgressSection;

export interface StudentProgressTarget {
  targetModule: string;
  recordType: string;
  recordId?: string | null;
}

export interface StudentProgressIdentity {
  studentId: string;
  studentName: string;
  programme: string;
  status: string;
  intakeSemester: string;
  projectStage?: string | null;
  projectSemester?: string | null;
  lifecycle: {
    status: string;
    effectiveAt: string | null;
    reason?: string | null;
    changedBy?: string | null;
    audits?: Array<{
      previousStatus: string;
      newStatus: string;
      reason: string;
      actor: string;
      createdAt: string;
    }>;
  };
  research: {
    semester: string;
    title: string;
    researchArea: string;
    supervisor: string;
  } | null;
}

export interface SupervisorDossierRecord extends StudentProgressTarget {
  recordId: string;
  status: string;
  researchTitle: string;
  researchArea: string;
  proposedSupervisor: string;
  submittedAt: string | null;
  supervisorDecisionAt: string | null;
  coordinatorDecisionAt: string | null;
  cancelledAt: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  waitingSince: string | null;
  waitingDays: number | null;
  waitingOn: string | null;
  appointment: {
    appointmentId?: number;
    appointmentDate: string;
    status: string;
    supervisor: string;
    endOutcome?: string | null;
    endReason?: string | null;
    endedAt?: string | null;
    endedBy?: string | null;
    supersedesAppointmentId?: number | null;
    lifecycle?: AppointmentLifecycleEvent[];
  } | null;
  workflow?: SupervisorWorkflowEvent[];
}

export interface SupervisorDossierSection {
  currentRecordId: string | null;
  records: SupervisorDossierRecord[];
}

export interface PanelDossierRecord extends StudentProgressTarget {
  recordId?: string;
  status: string;
  supervisor?: string;
  recommendedMember?: string;
  submittedAt?: string | null;
  panelDecisionAt?: string | null;
  coordinatorDecisionAt?: string | null;
  decisionAt?: string | null;
  cancelledAt?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  waitingSince: string | null;
  waitingDays: number | null;
  waitingOn?: string | null;
  appointment: {
    appointmentId?: number;
    appointmentDate: string;
    status: string;
    panelMember: string;
    endOutcome?: string | null;
    endReason?: string | null;
    endedAt?: string | null;
    endedBy?: string | null;
    supersedesAppointmentId?: number | null;
    lifecycle?: AppointmentLifecycleEvent[];
  } | null;
  workflow?: SupervisorWorkflowEvent[];
}

export interface PanelDossierSection {
  currentRecordId?: string | null;
  records: PanelDossierRecord[];
}

export interface MarksDossierTask extends StudentProgressTarget {
  taskId?: string;
  status: string;
  period: string;
  semester: string;
  evaluator?: string;
  evaluatorRole?: string;
  dueAt: string | null;
  daysUntilDue: number | null;
  deadlineState: string;
  taskLifecycleStatus: 'ACTIVE' | 'RETIRED';
  retiredAt?: string | null;
  retirementReason?: string | null;
}

export interface MarksDossierSection {
  summaryStatus: string | null;
  completionRate: number | null;
  tasks: MarksDossierTask[];
}

export interface TimelineDossierEntry extends StudentProgressTarget {
  recordId: string;
  title: string;
  detail: string;
  level: string;
  status: string;
  deadlineStart: string;
  deadlineEnd: string;
}

export interface TimelineDossierSection {
  semester: string | null;
  session: string | null;
  entries: TimelineDossierEntry[];
}

export interface StudentProgressAttentionItem extends StudentProgressTarget {
  kind: 'MARKS_DEADLINE' | 'WORKFLOW_WAIT' | 'TIMELINE_MILESTONE';
  label: string;
  waitingDays: number | null;
  waitingOn?: string | null;
  dueAt: string | null;
}

export interface StudentProgressDossier {
  researchAmendments?: import('../services/researchAmendmentsApi').ResearchAmendment[];
  supervisoryTeam?: import('./coSupervision').SupervisoryTeam | null;
  generatedAt: string;
  visibility: StudentProgressVisibility;
  student: StudentProgressIdentity;
  visibleSections: StudentProgressSection[];
  overview: {
    supervisorStatus: string | null;
    panelStatus: string | null;
    marksStatus: string | null;
    activeTimelineEntries: number;
    attentionCount: number;
  };
  supervisor: SupervisorDossierSection | null;
  panel: PanelDossierSection | null;
  marks: MarksDossierSection | null;
  timeline: TimelineDossierSection | null;
  attention: StudentProgressAttentionItem[];
}
