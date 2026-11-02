/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Persisted Supervisor and Panel Appointment API (UC10-UC23).

import {
  SupervisorRecord,
  PanelRecord,
  SupervisorRequest,
  SupervisorWorkloadRecord,
  SupervisorWorkloadSummary,
  ActiveSuperviseeRow,
  PanelAssignment,
  PanelCandidate,
  CoordinatorPanelWorkspace,
  PanelRecommendationDraft,
  PanelRecommendationSupervisee,
  PanelWorkloadRecord,
  PanelWorkloadSummary,
  StudentPanelAppointmentView,
  StudentSupervisorApplication,
  SubmittedRecommendation,
  SupervisorApplicationRecord,
  SupervisorApplicationDocument,
  SupervisorCandidate,
  SupervisorDocumentRequirement,
  SupervisorDocumentRequirementAudit,
  SupervisorRequestHistoryRow,
  WorkflowAgeingMetadata,
  AppointmentEndOutcome,
  AppointmentLifecycle,
} from '../types';
import { compareLongestWaiting, formatWaitingText } from '../utils/workflowAgeing';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { request, requestBlob, requestMultipart } from './apiClient';

const ACTIVE_SUPERVISOR_WAITING_STATUSES = new Set([
  'Pending',
  'Pending Review',
  'PENDING REVIEW',
  'SUBMITTED_TO_SUPERVISOR',
  'PENDING_COORDINATOR',
]);

type SupervisorWaitingRecord = WorkflowAgeingMetadata & { status: string };

export function formatSupervisorWaiting(record: SupervisorWaitingRecord): string {
  const hasWaitingMetadata =
    record.waitingDays !== null && record.waitingDays !== undefined
    || Boolean(record.waitingSince)
    || Boolean(record.waitingOn);

  if (!ACTIVE_SUPERVISOR_WAITING_STATUSES.has(record.status) || !hasWaitingMetadata) {
    return '-';
  }

  return formatWaitingText(record);
}

export function orderSupervisorQueueOldestFirst<
  T extends Pick<WorkflowAgeingMetadata, 'waitingDays'>,
>(records: readonly T[]): T[] {
  return [...records].sort(compareLongestWaiting);
}

export function getSupervisorRecordSummary(records: readonly SupervisorRecord[]) {
  const pendingRecords = records.filter((record) => record.status === 'Pending');

  return {
    withoutSupervisor: records.filter((record) => record.status === 'No Supervisor').length,
    pending: pendingRecords.length,
    approved: records.filter((record) => record.status === 'Approved').length,
    ended: records.filter((record) => record.status === 'Ended').length,
    workloadAlerts: records.filter((record) => record.status === 'Workload Alert').length,
    longestWaiting: orderSupervisorQueueOldestFirst(pendingRecords)[0] ?? null,
  };
}

export async function getSupervisorAppointments(): Promise<SupervisorRecord[]> {
  return request<SupervisorRecord[]>('/appointments/supervisor/');
}

export async function getSupervisorWorkloads(): Promise<SupervisorWorkloadRecord[]> {
  return request<SupervisorWorkloadRecord[]>('/appointments/supervisor/workload/');
}

export async function getOwnSupervisorWorkload(): Promise<SupervisorWorkloadSummary> {
  return request<SupervisorWorkloadSummary>('/appointments/supervisor/my-workload/');
}

export async function getPanelAppointments(): Promise<PanelRecord[]> {
  return request<PanelRecord[]>('/appointments/panel/');
}

export async function endSupervisorAppointment(
  appointmentId: number,
  outcome: Exclude<AppointmentEndOutcome, 'REPLACED'>,
  reason: string,
): Promise<AppointmentLifecycle> {
  return request<AppointmentLifecycle>(
    `/appointments/supervisor/appointments/${appointmentId}/end/`,
    { method: 'POST', body: JSON.stringify({ outcome, reason }) },
  );
}

export async function endPanelAppointment(
  appointmentId: number,
  outcome: Exclude<AppointmentEndOutcome, 'REPLACED'>,
  reason: string,
): Promise<AppointmentLifecycle> {
  return request<AppointmentLifecycle>(
    `/appointments/panel/appointments/${appointmentId}/end/`,
    { method: 'POST', body: JSON.stringify({ outcome, reason }) },
  );
}

// Lecturer-facing: pending supervisor requests awaiting the lecturer's review.
export async function getSupervisorRequests(): Promise<SupervisorRequest[]> {
  return request<SupervisorRequest[]>('/appointments/supervisor/requests/');
}

// Lecturer-facing: the lecturer's active supervisee roster.
export async function getActiveSupervisees(): Promise<ActiveSuperviseeRow[]> {
  return request<ActiveSuperviseeRow[]>('/appointments/supervisor/supervisees/');
}

// Lecturer-facing: students assigned to this lecturer as panel member.
export async function getPanelAssignment(appointmentId: number): Promise<PanelAssignment> {
  return request<PanelAssignment>(`/appointments/panel/appointments/${appointmentId}/`);
}

export async function getPanelAssignments(): Promise<PanelAssignment[]> {
  return request<PanelAssignment[]>('/appointments/panel/assignments/');
}

export async function getEligiblePanelSupervisees(): Promise<PanelRecommendationSupervisee[]> {
  return request<PanelRecommendationSupervisee[]>('/appointments/panel/eligible-supervisees/');
}

export async function getPanelCandidates(): Promise<PanelCandidate[]> {
  return request<PanelCandidate[]>('/appointments/panel/candidates/');
}

export async function getPanelWorkloads(): Promise<PanelWorkloadRecord[]> {
  return request<PanelWorkloadRecord[]>('/appointments/panel/workload/');
}

export async function getOwnPanelWorkload(): Promise<PanelWorkloadSummary> {
  return request<PanelWorkloadSummary>('/appointments/panel/my-workload/');
}

export async function getStudentPanelAppointment(): Promise<StudentPanelAppointmentView> {
  return request<StudentPanelAppointmentView>('/appointments/panel/student/');
}

// Lecturer-facing: panel recommendations this lecturer has submitted.
export async function getPanelRecommendationDrafts(): Promise<PanelRecommendationDraft[]> {
  return request<PanelRecommendationDraft[]>('/appointments/panel/recommendations/');
}

// Submitted panel recommendation history shown in SubmittedRecommendationsPage.
export async function getPanelRecommendations(): Promise<SubmittedRecommendation[]> {
  const recommendations = await request<PanelRecommendationDraft[]>('/appointments/panel/recommendations/');
  return recommendations.map((r) => ({
    id: r.id !== undefined ? `REC-${String(r.id).padStart(4, '0')}` : String(r.studentId),
    recommendationId: r.id,
    recommendation: r,
    studentName: r.studentName,
    studentId: r.studentId,
    researchTitle: r.proposedTopic,
    recommendedPanel: r.recommendedMember,
    recommendedPanelId: r.recommendedMemberId,
    date: r.submittedDate,
    status: r.status === 'APPROVED'
      ? 'Approved'
      : r.status === 'CANCELLED_BY_SUPERVISOR' || r.status === 'CANCELLED_BY_OFFICE' || r.status === 'CANCELLED_CAPACITY_FULL'
      ? 'Cancelled'
      : r.status === 'REJECTED_BY_PANEL' || r.status === 'REJECTED_BY_COORDINATOR'
      ? 'Rejected'
      : 'Pending Approval',
    workflowStatus: r.status,
    semester: r.semester || '',
    programme: r.programme,
    researchArea: r.researchArea,
    abstract: r.abstract,
    justification: r.justification,
    rejectionReason: r.rejectionReason,
    submittedAt: r.submittedAt,
    panelDecisionAt: r.panelDecisionAt,
    selectedPanelDecision: r.selectedPanelDecision,
    coordinatorDecisionAt: r.coordinatorDecisionAt,
    cancelledAt: r.cancelledAt,
    cancellationReason: r.cancellationReason,
    workflow: r.workflow,
    waitingSince: r.waitingSince,
    waitingDays: r.waitingDays,
    waitingOn: r.waitingOn,
    replacesAppointmentId: r.replacesAppointmentId,
    replacementReason: r.replacementReason,
  }));
}

export async function createPanelRecommendation(
  payload: {
    studentId: string;
    recommendedMemberId: string;
    justification: string;
    status: PanelRecommendationDraft['status'];
    replacesAppointmentId?: number | null;
    replacementReason?: string | null;
  },
): Promise<PanelRecommendationDraft> {
  return request<PanelRecommendationDraft>('/appointments/panel/recommendations/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, replacementReason: payload.replacementReason ?? undefined }),
  });
}

export async function getPanelReviewQueue(): Promise<PanelRecommendationDraft[]> {
  return request<PanelRecommendationDraft[]>('/appointments/panel/review-queue/');
}

export async function getCoordinatorPanelReviewQueue(): Promise<PanelRecommendationDraft[]> {
  return request<PanelRecommendationDraft[]>('/appointments/panel/coordinator-queue/');
}

export async function getCoordinatorPanelWorkspace(): Promise<CoordinatorPanelWorkspace> {
  return request<CoordinatorPanelWorkspace>('/appointments/panel/coordinator-workspace/');
}

export async function getPanelReviewHistory(): Promise<PanelRecommendationDraft[]> {
  return request<PanelRecommendationDraft[]>('/appointments/panel/review-history/');
}

export async function acceptPanelRecommendation(id: number | string): Promise<PanelRecommendationDraft> {
  return request<PanelRecommendationDraft>(`/appointments/panel/recommendations/${id}/panel-accept/`, {
    method: 'POST',
  });
}

export async function rejectPanelRecommendation(
  id: number | string,
  reason: string,
): Promise<PanelRecommendationDraft> {
  return request<PanelRecommendationDraft>(`/appointments/panel/recommendations/${id}/panel-reject/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function approvePanelRecommendationByCoordinator(
  id: number | string,
): Promise<PanelRecommendationDraft> {
  return request<PanelRecommendationDraft>(`/appointments/panel/recommendations/${id}/coordinator-approve/`, {
    method: 'POST',
  });
}

export async function rejectPanelRecommendationByCoordinator(
  id: number | string,
  reason: string,
): Promise<PanelRecommendationDraft> {
  return request<PanelRecommendationDraft>(`/appointments/panel/recommendations/${id}/coordinator-reject/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// Lecturer-facing: supervisor appointment requests the lecturer has decided on.
export async function getSupervisorRequestHistory(): Promise<SupervisorRequestHistoryRow[]> {
  return request<SupervisorRequestHistoryRow[]>('/appointments/supervisor/request-history/');
}

export async function cancelPanelRecommendation(
  id: number | string,
  reason: string,
): Promise<PanelRecommendationDraft> {
  return request<PanelRecommendationDraft>(`/appointments/panel/recommendations/${id}/cancel/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function getSupervisorCandidates(): Promise<SupervisorCandidate[]> {
  return request<SupervisorCandidate[]>('/appointments/supervisor/candidates/');
}

export async function getMySupervisorApplications(): Promise<SupervisorApplicationRecord[]> {
  return request<SupervisorApplicationRecord[]>('/appointments/supervisor/applications/');
}

export async function getSupervisorApplication(
  id: number | string,
): Promise<SupervisorApplicationRecord> {
  return request<SupervisorApplicationRecord>(
    `/appointments/supervisor/applications/${id}/`,
  );
}

export async function createSupervisorApplication(
  payload: FormData,
): Promise<SupervisorApplicationRecord> {
  return requestMultipart<SupervisorApplicationRecord>(
    '/appointments/supervisor/applications/',
    payload,
  );
}

export interface SupervisorDocumentSetup {
  noDocumentsRequired: boolean;
  configured: boolean;
}

export async function getSupervisorDocumentSetup(): Promise<SupervisorDocumentSetup> {
  return request<SupervisorDocumentSetup>('/appointments/supervisor/document-requirements/setup/');
}

export async function updateSupervisorDocumentSetup(noDocumentsRequired: boolean, reason: string): Promise<SupervisorDocumentSetup> {
  return request<SupervisorDocumentSetup>('/appointments/supervisor/document-requirements/setup/', {
    method: 'PATCH', body: JSON.stringify({ noDocumentsRequired, reason }),
  });
}

export async function getActiveSupervisorDocumentRequirements(): Promise<SupervisorDocumentRequirement[]> {
  return request<SupervisorDocumentRequirement[]>(
    '/appointments/supervisor/document-requirements/active/',
  );
}

export async function getSupervisorDocumentRequirements(): Promise<SupervisorDocumentRequirement[]> {
  return request<SupervisorDocumentRequirement[]>(
    '/appointments/supervisor/document-requirements/',
  );
}

export async function createSupervisorDocumentRequirement(payload: {
  label: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}): Promise<SupervisorDocumentRequirement> {
  return request<SupervisorDocumentRequirement>(
    '/appointments/supervisor/document-requirements/',
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export async function updateSupervisorDocumentRequirement(
  id: number,
  payload: Partial<Pick<SupervisorDocumentRequirement, 'label' | 'description' | 'isRequired' | 'isActive' | 'displayOrder'>> & { reason: string },
): Promise<SupervisorDocumentRequirement> {
  return request<SupervisorDocumentRequirement>(
    `/appointments/supervisor/document-requirements/${id}/`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export async function getSupervisorDocumentRequirementAudits(): Promise<SupervisorDocumentRequirementAudit[]> {
  return request<SupervisorDocumentRequirementAudit[]>(
    '/appointments/supervisor/document-requirements/audits/',
  );
}

export async function downloadSupervisorApplicationDocument(
  applicationId: number | string,
  document: Pick<SupervisorApplicationDocument, 'id'>,
): Promise<Blob> {
  return requestBlob(
    `/appointments/supervisor/applications/${applicationId}/documents/${document.id}/download/`,
  );
}

export async function cancelSupervisorApplication(
  id: number | string,
  reason: string,
): Promise<SupervisorApplicationRecord> {
  return request<SupervisorApplicationRecord>(
    `/appointments/supervisor/applications/${id}/cancel/`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

export async function getPanelRecommendation(
  id: number | string,
): Promise<PanelRecommendationDraft> {
  return request<PanelRecommendationDraft>(
    `/appointments/panel/recommendations/${id}/`,
  );
}

export async function acceptSupervisorApplication(
  id: number | string,
): Promise<SupervisorApplicationRecord> {
  return request<SupervisorApplicationRecord>(
    `/appointments/supervisor/applications/${id}/supervisor-accept/`,
    { method: 'POST' },
  );
}

export async function rejectSupervisorApplication(
  id: number | string,
  reason: string,
): Promise<SupervisorApplicationRecord> {
  return request<SupervisorApplicationRecord>(
    `/appointments/supervisor/applications/${id}/supervisor-reject/`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export async function getCoordinatorSupervisorQueue(): Promise<SupervisorApplicationRecord[]> {
  return request<SupervisorApplicationRecord[]>('/appointments/supervisor/coordinator-queue/');
}

export async function getCoordinatorSupervisorRecords(): Promise<SupervisorApplicationRecord[]> {
  return request<SupervisorApplicationRecord[]>('/appointments/supervisor/coordinator-records/');
}

export async function getCoordinatorSupervisorHistory(): Promise<SupervisorApplicationRecord[]> {
  return request<SupervisorApplicationRecord[]>('/appointments/supervisor/coordinator-history/');
}

export async function approveSupervisorApplicationByCoordinator(
  id: number | string,
): Promise<SupervisorApplicationRecord> {
  return request<SupervisorApplicationRecord>(
    `/appointments/supervisor/applications/${id}/coordinator-approve/`,
    { method: 'POST' },
  );
}

export async function rejectSupervisorApplicationByCoordinator(
  id: number | string,
  reason: string,
): Promise<SupervisorApplicationRecord> {
  return request<SupervisorApplicationRecord>(
    `/appointments/supervisor/applications/${id}/coordinator-reject/`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export function toStudentSupervisorApplication(
  record: SupervisorApplicationRecord,
): StudentSupervisorApplication {
  const status: StudentSupervisorApplication['status'] =
    record.status === 'APPROVED'
      ? 'APPROVED'
      : record.status === 'CANCELLED_BY_STUDENT' || record.status === 'CANCELLED_BY_OFFICE' || record.status === 'CANCELLED_CAPACITY_FULL'
      ? 'CANCELLED'
      : record.status === 'REJECTED_BY_SUPERVISOR' || record.status === 'REJECTED_BY_COORDINATOR'
      ? 'RETURNED'
      : 'PENDING REVIEW';
  return {
    applicationId: record.id,
    acceptanceCapacity: record.acceptanceCapacity,
    initiatedByOffice: record.initiatedByOffice,
    id: `SV-APP-${String(record.id).padStart(5, '0')}`,
    studentId: record.studentId,
    studentName: record.studentName,
    programme: record.programme,
    semester: record.semester,
    researchAbstract: record.researchAbstract,
    submittedAt: record.submittedAt,
    title: record.researchTitle,
    projectCourseCodes: record.projectCourseCodes,
    researchArea: record.researchArea,
    supervisor: record.proposedSupervisor,
    date: formatMalaysiaDate(record.submittedAt),
    status,
    workflowStatus: record.status,
    workflow: record.workflow,
    cancellationReason: record.cancellationReason,
    cancelledAt: record.cancelledAt,
    rejectionReason: record.rejectionReason,
    documents: record.documents ?? [],
    appointmentLifecycle: record.appointmentLifecycle,
    replacesAppointmentId: record.replacesAppointmentId,
    replacementReason: record.replacementReason,
    unavailableUntil: record.unavailableUntil,
    waitingSince: record.waitingSince,
    waitingDays: record.waitingDays,
    waitingOn: record.waitingOn,
  };
}
