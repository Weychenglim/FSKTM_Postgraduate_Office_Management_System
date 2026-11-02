/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CapacityState } from './lecturerCapacity';

// Supervisor & Panel Appointment domain models (UC10-UC23).

export interface AppointmentCapacityMetadata {
  activeLoad?: number;
  reservedLoad?: number;
  pendingRequests?: number;
  semesterId?: number | null;
  semesterCode?: string | null;
  capacityPlanId?: number | null;
  capacityPlanVersion?: number | null;
  capacityState?: CapacityState;
  workloadCount?: number;
  workloadLimit?: number;
  availableSlots?: number;
  selectable?: boolean;
  unavailableUntil?: string | null;
}

/** Effective policy for this request; never inferred from the active-semester dashboard. */
export interface SupervisorAcceptanceCapacity {
  activeLoad: number;
  reservedLoad: number;
  limit: number | null;
  availableSlots: number;
  pendingRequests: number;
  state: CapacityState;
}

export type WorkflowWaitingOn =
  | 'CO_SUPERVISOR'
  | 'SUPERVISOR'
  | 'SELECTED_PANEL'
  | 'PROGRAMME_COORDINATOR'
  | 'COORDINATOR'
  | 'SOURCE_COORDINATOR'
  | 'DESTINATION_COORDINATOR'
  | 'FACULTY_PROCESSING';

export interface WorkflowAgeingMetadata {
  semesterId?: number | null;
  semesterCode?: string | null;
  waitingSince?: string | null;
  waitingDays?: number | null;
  waitingOn?: WorkflowWaitingOn | null;
}

export type AppointmentEndOutcome = 'COMPLETED' | 'REPLACED' | 'WITHDRAWN' | 'OTHER';

export interface AppointmentLifecycleEvent {
  id: number;
  action: 'ACTIVATED' | 'ENDED' | 'REPLACED';
  actorName: string;
  actorRole: string;
  previousStatus: string;
  newStatus: string;
  outcome: AppointmentEndOutcome | null;
  reason: string | null;
  createdAt: string;
}

export interface AppointmentLifecycle {
  appointmentId: number;
  status: 'ACTIVE' | 'ENDED' | 'COMPLETED';
  endOutcome: AppointmentEndOutcome | null;
  endReason: string | null;
  endedAt: string | null;
  endedBy: string | null;
  supersedesAppointmentId: number | null;
  replacementAppointmentId: number | null;
  lifecycle?: AppointmentLifecycleEvent[];
}

export type SupervisorAppointmentStatus =
  | 'Approved'
  | 'Ended'
  | 'Pending'
  | 'No Supervisor'
  | 'Workload Alert'
  | 'Rejected'
  | 'Cancelled';

export interface SupervisorRecord extends WorkflowAgeingMetadata {
  acceptanceCapacity?: SupervisorAcceptanceCapacity | null;
  initiatedByOffice?: boolean;
  workflowStatus?: SupervisorApplicationWorkflowStatus;
  submittedAt?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  cancelledAt?: string | null;
  participantEligible?: boolean;
  participantLifecycleStatus?: string;
  projectCourseCodes?: string;
  applicationId?: number;
  studentId: string;
  studentName: string;
  programme: string;
  supervisor: string;
  status: SupervisorAppointmentStatus;
  updatedDate: string;
  email?: string;
  semester?: string;
  researchTopic?: string;
  researchArea?: string;
  abstract?: string;
  appointmentId?: number | string | null;
  workloadLimit?: string;
  approvedDate?: string;
  approvalRecordedAt?: string | null;
  releasedDate?: string;
  panelMemberName?: string;
  panelAssignedDate?: string;
  workflow?: SupervisorWorkflowEvent[];
  documents?: SupervisorApplicationDocument[];
  appointmentLifecycle?: AppointmentLifecycle | null;
  replacesAppointmentId?: number | null;
  replacementReason?: string | null;
}

export type PanelAppointmentStatus =
  | 'Approved'
  | 'Ended'
  | 'No Panel'
  | 'Pending'
  | 'Recommendation'
  | 'Rejected'
  | 'Cancelled';

export interface PanelRecord extends WorkflowAgeingMetadata {
  recommendation?: PanelRecommendationDraft;
  recordId: string;
  id: string; // student ID, e.g. "MEA2301184"
  studentName: string;
  programme: string;
  semester: string;
  supervisor: string;
  panelMember: string; // lecturer name, or "Pending" / "Not Assigned"
  status: PanelAppointmentStatus;
  updatedDate: string; // "23 Nov 2025" or "-"
  researchTitle?: string;
  researchArea?: string;
  abstract?: string;
  appointmentDate?: string;
  panelMemberId?: string;
  panelMemberDepartment?: string;
  panelMemberEmail?: string;
  recommendationSubmittedAt?: string | null;
  panelDecisionAt?: string | null;
  coordinatorDecisionAt?: string | null;
  appointmentConfirmedAt?: string | null;
  recommendationId?: number | string | null;
  rejectionStage?: 'Selected Panel' | 'Programme Coordinator' | null;
  rejectionReason?: string;
  cancelledAt?: string | null;
  cancellationReason?: string;
  workflow?: SupervisorWorkflowEvent[];
  appointmentLifecycle?: AppointmentLifecycle | null;
}

// Lecturer-facing supervisor appointment views (UC11-UC13)
// A pending supervisor appointment request shown to a lecturer to review.
export interface SupervisorRequest extends WorkflowAgeingMetadata {
  applicationId?: number;
  semester?: string;
  studentId: string;
  studentName: string;
  programme: string;
  proposedTopic: string;
  researchArea: string;
  submittedDate: string;
  receivedTime: string;
  status: string;
  participantLifecycleStatus?: string | null;
  participantEligible?: boolean;
  abstract?: string;
}

// A row in the lecturer's active supervisee roster.
export interface ActiveSuperviseeRow {
  appointmentId: number;
  studentId: string;
  studentName: string;
  programme: string;
  semester: string;
  email: string;
  researchTitle: string;
  researchArea: string;
  researchAbstract: string;
  supervisorName: string;
  appointmentDate: string;
  status: string;
}

export interface SupervisorWorkloadSummary extends AppointmentCapacityMetadata {
  currentStudents: number;
  workloadLimit: number;
  availableSlots: number;
}

export interface PanelWorkloadSummary extends AppointmentCapacityMetadata {
  currentStudents: number;
  confirmedAppointments: number;
  pendingNominations: number;
  workloadLimit: number;
  availableSlots: number;
}

export interface SupervisorWorkloadRecord extends AppointmentCapacityMetadata {
  lecturerId: string;
  lecturerName: string;
  department: string;
  currentStudents: number;
  workloadLimit: number;
  availability: 'Available' | 'Near Limit' | 'Full Load';
  email: string;
  supervisees: Array<{
    supervisionRole?: 'PRIMARY' | 'CO_SUPERVISOR';
    id: string;
    name: string;
    programme: string;
    status: string;
    topic: string;
    appointmentDate: string;
  }>;
}

// Lecturer-facing panel appointment views (UC20-UC23)
// A student assigned to a lecturer acting as panel member.
export interface AcademicTeamContact {name:string;email:string;department:string;appointmentDate:string|null}
export interface PanelAcademicTeam {primary:AcademicTeamContact|null;supporting:AcademicTeamContact[]}

export interface PanelAssignment extends WorkflowAgeingMetadata {
  academicTeam?: PanelAcademicTeam | null;
  recommendation?: PanelRecommendationDraft;
  appointmentLifecycle?: AppointmentLifecycle | null;
  panelMemberName?: string;
  panelMemberId?: string;
  appointmentId: number;
  studentId: string;
  studentName: string;
  researchTitle: string;
  supervisor: string;
  appointmentDate: string;
  status: 'ACTIVE' | 'PENDING' | 'ENDED' | 'COMPLETED';
  programme?: string;
  intake?: string;
  researchArea?: string;
  abstract?: string;
  initials?: string;
  supervisorDepartment?: string;
  supervisorEmail?: string;
  recommendationSubmittedAt?: string | null;
  panelDecisionAt?: string | null;
  coordinatorDecisionAt?: string | null;
  appointmentConfirmedAt?: string | null;
  endOutcome?: AppointmentEndOutcome | null;
  endReason?: string | null;
  endedAt?: string | null;
  supersedesAppointmentId?: number | null;
}

// Approval lifecycle for a supervisor's panel-member recommendation.
export type PanelRecommendationStatus =
  | 'SUBMITTED_TO_PANEL'
  | 'REJECTED_BY_PANEL'
  | 'PENDING_COORDINATOR'
  | 'REJECTED_BY_COORDINATOR'
  | 'APPROVED'
  | 'CANCELLED_BY_SUPERVISOR'
  | 'CANCELLED_CAPACITY_FULL'
  | 'CANCELLED_BY_OFFICE';

// A panel-member recommendation a lecturer drafts/submits for a supervisee.
export interface PanelRecommendationDraft extends WorkflowAgeingMetadata {
  acceptanceCapacity?: SupervisorAcceptanceCapacity | null;
  studentEmail?: string;
  supervisorEmail?: string;
  panelMemberEmail?: string;
  panelMemberDepartment?: string;
  replacedPanelMember?: string | null;
  replacedAppointmentStatus?: string | null;
  canReview?: boolean;
  appointmentDate?: string | null;
  canEndAppointment?: boolean;
  id?: number | string;
  studentId: string;
  studentName: string;
  participantLifecycleStatus?: string | null;
  participantEligible?: boolean;
  programme: string;
  semester?: string;
  proposedTopic: string;
  researchArea?: string;
  abstract?: string;
  recommendedMember: string;
  recommendedMemberId: string;
  supervisorName?: string;
  submittedDate: string;
  submittedAt?: string | null;
  panelDecisionAt?: string | null;
  coordinatorDecisionAt?: string | null;
  cancelledAt?: string | null;
  status: PanelRecommendationStatus;
  justification?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  updatedAt?: string | null;
  selectedPanelDecision?: 'ACCEPTED' | 'REJECTED' | null;
  workflow?: SupervisorWorkflowEvent[];
  replacesAppointmentId?: number | null;
  replacementReason?: string | null;
  appointmentLifecycle?: AppointmentLifecycle | null;
  unavailableUntil?: string | null;
}

export interface CoordinatorPanelWorkspace {
  programme: string;
  programmes?: string[];
  pendingCount: number;
  queue: PanelRecommendationDraft[];
  records: PanelRecommendationDraft[];
  message?: string;
}

export interface PanelRecommendationSupervisee {
  studentUserId?: number;
  studentId: string;
  studentName: string;
  programme: string;
  semester: string;
  proposedTopic: string;
  researchArea: string;
  abstract: string;
  supervisorName: string;
  supervisorId: string;
  supervisorAppointmentId: number;
  panelAppointmentId: number | null;
  currentPanelMember: string | null;
  currentPanelMemberId: string | null;
  currentPanelDepartment?: string | null;
  currentPanelEmail?: string | null;
  currentPanelAppointmentDate?: string | null;
  canRecommend: boolean;
}

export interface PanelCandidate extends AppointmentCapacityMetadata {
  staffId: string;
  name: string;
  department: string;
  workloadCount: number;
  workloadLimit: number;
  canSubmit: boolean;
  availability: 'Available' | 'Workload Full' | string;
  workloadHelpText: string;
}

export interface PanelWorkloadItem {
  type: 'Confirmed Appointment' | 'Pending Nomination';
  studentName: string;
  studentId: string;
  researchTitle: string;
  date: string;
}

export interface PanelWorkloadRecord extends AppointmentCapacityMetadata {
  id: string;
  name: string;
  department: string;
  currentStudents: number;
  workloadLimit: number;
  availability: 'Available' | 'Near Limit' | 'Full Load';
  initials: string;
  confirmedAppointments: number;
  pendingNominations: number;
  workloadItems: PanelWorkloadItem[];
}

export interface StudentResearchProfileSummary {
  title: string;
  programme: string;
  area: string;
  abstract: string;
}

export interface StudentPanelAppointmentView extends WorkflowAgeingMetadata {
  approvedRequest?: {id: number; nominatedBy: string; submittedAt: string | null; panelAcceptedAt: string | null; approvedAt: string | null} | null;
  status: 'PENDING' | 'CONFIRMED';
  readinessState:
    | 'SUPERVISOR_REQUIRED'
    | 'SUPERVISOR_APPROVAL_PENDING'
    | 'READY_FOR_PANEL_RECOMMENDATION'
    | 'FACULTY_PROCESSING'
    | 'CONFIRMED';
  studentName: string;
  studentId: string;
  programme: string;
  semester: string;
  researchTitle: string;
  researchProfile?: StudentResearchProfileSummary | null;
  supervisorName: string;
  panelMemberName: string | null;
  panelMemberId: string | null;
  panelMemberDepartment: string | null;
  panelMemberEmail: string | null;
  appointmentDate: string | null;
}

// A submitted panel recommendation record shown in the history list.
export interface SubmittedRecommendation extends WorkflowAgeingMetadata {
  recommendation?: PanelRecommendationDraft;
  id: string;
  recommendationId?: number | string;
  studentName: string;
  studentId: string;
  researchTitle: string;
  recommendedPanel: string;
  recommendedPanelId?: string;
  date: string;
  status: 'Approved' | 'Pending Approval' | 'Rejected' | 'Cancelled';
  workflowStatus?: PanelRecommendationStatus;
  semester: string;
  programme?: string;
  researchArea?: string;
  abstract?: string;
  justification?: string;
  rejectionReason?: string;
  submittedAt?: string | null;
  panelDecisionAt?: string | null;
  selectedPanelDecision?: 'ACCEPTED' | 'REJECTED' | null;
  coordinatorDecisionAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string;
  workflow?: SupervisorWorkflowEvent[];
}

// A past supervisor appointment request the lecturer already approved/rejected.
export interface SupervisorRequestHistoryRow extends WorkflowAgeingMetadata {
  requestId: string;
  applicationId?: number;
  status?: SupervisorApplicationWorkflowStatus;
  submittedAt?: string;
  supervisorDecisionAt?: string | null;
  coordinatorDecisionAt?: string | null;
  studentName: string;
  studentId: string;
  programme: string;
  researchTitle: string;
  submittedDate: string;
  decision: 'Approved' | 'Rejected' | 'Cancelled' | 'Pending Approval';
  semester: string;
  abstract: string;
  decisionReason?: string;
}

// Lecturer workload tracking (UC16, UC21).
export interface WorkloadStat {
  lecturerName: string;
  assigned: number;
  limit: number;
  status: 'AVAILABLE' | 'NEAR LIMIT' | 'FULL';
}

// Compact appointment summary used on dashboard cards.
export interface RecentAppointment {
  studentName: string;
  date: string;
  status: string;
}

// Student-facing supervisor appointment application workflow.
export type StudentSupervisorApplicationStatus =
  | 'PENDING REVIEW'
  | 'RETURNED'
  | 'CANCELLED'
  | 'APPROVED';

export interface StudentSupervisorApplication extends WorkflowAgeingMetadata {
  acceptanceCapacity?: SupervisorAcceptanceCapacity | null;
  initiatedByOffice?: boolean;
  studentId?: string;
  studentName?: string;
  programme?: string;
  semester?: string;
  researchAbstract?: string;
  submittedAt?: string;
  projectCourseCodes?: string;
  applicationId?: number;
  id: string;
  title: string;
  researchArea: string;
  supervisor: string;
  date: string;
  status: StudentSupervisorApplicationStatus;
  workflowStatus?: SupervisorApplicationWorkflowStatus;
  workflow?: SupervisorWorkflowEvent[];
  cancellationReason?: string;
  cancelledAt?: string | null;
  rejectionReason?: string;
  documents?: SupervisorApplicationDocument[];
  appointmentLifecycle?: AppointmentLifecycle | null;
  replacesAppointmentId?: number | null;
  replacementReason?: string | null;
  unavailableUntil?: string | null;
}

export type SupervisorApplicationWorkflowStatus =
  | 'SUBMITTED_TO_SUPERVISOR'
  | 'REJECTED_BY_SUPERVISOR'
  | 'PENDING_COORDINATOR'
  | 'REJECTED_BY_COORDINATOR'
  | 'CANCELLED_BY_STUDENT'
  | 'CANCELLED_BY_OFFICE'
  | 'CANCELLED_CAPACITY_FULL'
  | 'APPROVED';

export interface SupervisorWorkflowEvent {
  id: number;
  action: string;
  actorName: string;
  actorRole: string;
  previousStatus: string;
  newStatus: string;
  reason: string;
  createdAt: string;
}

export interface SupervisorApplicationRecord extends WorkflowAgeingMetadata {
  acceptanceCapacity?: SupervisorAcceptanceCapacity | null;
  initiatedByOffice?: boolean;
  projectCourseCodes?: string;
  id: number;
  studentId: string;
  studentName: string;
  participantLifecycleStatus?: string | null;
  participantEligible?: boolean;
  programme: string;
  semester: string;
  proposedSupervisor: string;
  proposedSupervisorId: string;
  researchTitle: string;
  researchArea: string;
  researchAbstract: string;
  researchProfileReady: boolean;
  status: SupervisorApplicationWorkflowStatus;
  rejectionReason: string;
  submittedAt: string;
  supervisorDecisionAt?: string | null;
  coordinatorDecisionAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string;
  documents?: SupervisorApplicationDocument[];
  workflow: SupervisorWorkflowEvent[];
  appointmentLifecycle?: AppointmentLifecycle | null;
  replacesAppointmentId?: number | null;
  replacementReason?: string | null;
  unavailableUntil?: string | null;
}

export interface SupervisorDocumentRequirement {
  id: number;
  code: string;
  label: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  isUsed: boolean;
}

export interface SupervisorApplicationDocument {
  id: number;
  requirementCode: string | null;
  requirementLabel: string;
  name: string;
  contentType:
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | null;
  size: number;
  checksum: string | null;
  availability: 'AVAILABLE' | 'LEGACY_METADATA';
  uploadedAt: string;
}

export interface SupervisorDocumentRequirementAudit {
  id: number;
  requirementId: number | null;
  requirementCode: string;
  requirementLabel: string;
  actorName: string;
  actorRole: string;
  action: 'CREATE' | 'UPDATE' | 'SETUP';
  reason: string;
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
  createdAt: string;
}

export interface SupervisorCandidate extends AppointmentCapacityMetadata {
  id: string;
  name: string;
  initials: string;
  filled: number;
  total: number;
  domain: string;
}
