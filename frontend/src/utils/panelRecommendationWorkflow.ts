/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CapacityState, PanelRecommendationStatus, SubmittedRecommendation } from '../types';
import { appointmentRequestStatusLabel } from './appointmentRequestStatus';

export const mergeSubmittedPanelHistory = (
  current: SubmittedRecommendation[],
  history: SubmittedRecommendation[],
): SubmittedRecommendation[] => {
  const seen = new Set<string>();
  return [...current, ...history].filter(record => {
    // Separate attempts can have identical people, dates and terminal statuses.
    const key = record.recommendationId != null ? `recommendation:${record.recommendationId}` : `record:${record.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export type PanelRecommendationAction =
  | 'panelAccept'
  | 'panelReject'
  | 'coordinatorApprove'
  | 'coordinatorReject';

export type PanelRecommendationReviewerRole =
  | 'SUPERVISOR'
  | 'SELECTED_PANEL'
  | 'PROGRAMME_COORDINATOR';

export interface PanelRecommendationStatusRecord {
  studentId: string;
  status: PanelRecommendationStatus;
}

export const PANEL_RECOMMENDATION_STATUS_LABELS: Record<PanelRecommendationStatus, string> = {
  SUBMITTED_TO_PANEL: appointmentRequestStatusLabel('SUBMITTED_TO_PANEL'),
  REJECTED_BY_PANEL: appointmentRequestStatusLabel('REJECTED_BY_PANEL'),
  PENDING_COORDINATOR: appointmentRequestStatusLabel('PENDING_COORDINATOR'),
  REJECTED_BY_COORDINATOR: appointmentRequestStatusLabel('REJECTED_BY_COORDINATOR'),
  CANCELLED_BY_SUPERVISOR: appointmentRequestStatusLabel('CANCELLED_BY_SUPERVISOR'),
  CANCELLED_BY_OFFICE: appointmentRequestStatusLabel('CANCELLED_BY_OFFICE'),
  CANCELLED_CAPACITY_FULL: appointmentRequestStatusLabel('CANCELLED_CAPACITY_FULL'),
  APPROVED: appointmentRequestStatusLabel('APPROVED'),
};

const REJECTED_STATUSES: PanelRecommendationStatus[] = [
  'REJECTED_BY_PANEL',
  'REJECTED_BY_COORDINATOR',
  'CANCELLED_BY_SUPERVISOR',
  'CANCELLED_BY_OFFICE',
  'CANCELLED_CAPACITY_FULL',
];

export const isRejectedPanelRecommendationStatus = (status: PanelRecommendationStatus): boolean =>
  REJECTED_STATUSES.includes(status);

export const canCreatePanelRecommendation = (
  recommendations: PanelRecommendationStatusRecord[],
  studentId: string,
): boolean => {
  return !recommendations.some(
    (recommendation) =>
      recommendation.studentId === studentId &&
      !isRejectedPanelRecommendationStatus(recommendation.status),
  );
};

export const getNextPanelRecommendationStatus = (
  currentStatus: PanelRecommendationStatus,
  action: PanelRecommendationAction,
): PanelRecommendationStatus => {
  if (currentStatus === 'SUBMITTED_TO_PANEL') {
    if (action === 'panelAccept') return 'PENDING_COORDINATOR';
    if (action === 'panelReject') return 'REJECTED_BY_PANEL';
  }

  if (currentStatus === 'PENDING_COORDINATOR') {
    if (action === 'coordinatorApprove') return 'APPROVED';
    if (action === 'coordinatorReject') return 'REJECTED_BY_COORDINATOR';
  }

  return currentStatus;
};

export const canReviewPanelRecommendation = (
  status: PanelRecommendationStatus,
  reviewerRole: PanelRecommendationReviewerRole,
): boolean => {
  if (reviewerRole === 'SELECTED_PANEL') return status === 'SUBMITTED_TO_PANEL';
  if (reviewerRole === 'PROGRAMME_COORDINATOR') return status === 'PENDING_COORDINATOR';
  return false;
};

export const requiresPanelRejectionReason = (
  action: PanelRecommendationAction,
  reason: string,
): boolean => action === 'panelReject' && reason.trim().length === 0;

interface PanelCandidateValidationInput {
  workloadCount?: number;
  workloadLimit?: number;
  capacityState?: CapacityState;
  selectable?: boolean;
  unavailableUntil?: string | null;
  isSupervisor: boolean;
  hasNotes?: boolean;
}

export const canSubmitPanelCandidate = ({
  workloadCount,
  workloadLimit,
  capacityState,
  selectable,
  isSupervisor,
  hasNotes = true,
}: PanelCandidateValidationInput): boolean => {
  const capacityAllowsSelection = selectable ?? (
    capacityState
      ? capacityState === 'AVAILABLE'
      : Number.isFinite(workloadCount)
        && Number.isFinite(workloadLimit)
        && (workloadCount ?? 0) < (workloadLimit ?? 0)
  );
  return !isSupervisor && hasNotes && capacityAllowsSelection;
};

const formatUnavailableUntil = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const getPanelCandidateValidationMessage = ({
  workloadCount,
  workloadLimit,
  capacityState,
  selectable,
  unavailableUntil,
  isSupervisor,
  hasNotes = true,
}: PanelCandidateValidationInput): string => {
  if (isSupervisor) return 'The proposed Panel member cannot be the student supervisor.';
  if (capacityState === 'TEMPORARILY_UNAVAILABLE') {
    const resumeDate = formatUnavailableUntil(unavailableUntil);
    return resumeDate
      ? `This lecturer is temporarily unavailable until ${resumeDate}.`
      : 'This lecturer is temporarily unavailable for new panel assignments.';
  }
  if (capacityState === 'NOT_CONFIGURED') {
    return 'Panel capacity is not configured for this lecturer in the active semester.';
  }
  if (capacityState === 'INELIGIBLE') {
    return 'This lecturer is not eligible for a new panel assignment.';
  }
  if (
    capacityState === 'FULL'
    || capacityState === 'OVER_CAPACITY'
    || selectable === false
    || (
      Number.isFinite(workloadCount)
      && Number.isFinite(workloadLimit)
      && (workloadCount ?? 0) >= (workloadLimit ?? 0)
    )
  ) {
    return 'This lecturer has reached the panel workload limit. Please choose another panel member.';
  }
  if (!hasNotes) return 'Add justification notes before submitting to the Panel member.';
  return 'This recommendation is ready to be submitted to the Panel member for acceptance.';
};
