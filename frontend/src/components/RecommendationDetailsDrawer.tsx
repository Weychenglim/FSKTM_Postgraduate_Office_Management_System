import {PanelRecommendationDetail,PanelAppointmentRecordCard,panelRecordMetadata} from './PanelRecordDetails';
import {RequestMetadata,ViewStudentRecordAction} from './RequestDetailPrimitives';
import {toSubmittedPanelPresentation} from '../utils/panelPresentation';
import {PANEL_RECOMMENDATION_STATUS_LABELS} from '../utils/panelRecommendationWorkflow';
import {getPanelRecommendation} from '../services';
import type {PanelRecommendationDraft} from '../types';
import { RecordPage } from './RecordPage';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PanelRecommendationStatus, SubmittedRecommendation } from '../types';
import {PortalButton} from './PortalPrimitives';
import {DecisionDialog} from './DecisionDialog';
import type {DecisionOutcome} from '../utils/decisionSubmission';
import { WorkflowAuditLog } from './WorkflowAuditLog';

interface RecommendationDetailsDrawerProps {
  backLabel?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenStudent?: (id: string) => void;
  recommendation: SubmittedRecommendation | null;
  onCancelRecommendation?: (recommendation: SubmittedRecommendation, reason: string) => Promise<void | DecisionOutcome> | void;
}

type TimelineItemState = 'completed' | 'active' | 'pending' | 'rejected' | 'cancelled';

interface TimelineItem {
  id: string;
  label: string;
  detail: string;
  state: TimelineItemState;
}

const STATUS_LABELS = PANEL_RECOMMENDATION_STATUS_LABELS;

const getInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const inferWorkflowStatus = (recommendation: SubmittedRecommendation): PanelRecommendationStatus => {
  if (recommendation.workflowStatus) return recommendation.workflowStatus;
  if (recommendation.status === 'Approved') return 'APPROVED';
  if (recommendation.status === 'Rejected') return 'REJECTED_BY_COORDINATOR';
  if (recommendation.status === 'Cancelled') return 'CANCELLED_BY_SUPERVISOR';
  return 'SUBMITTED_TO_PANEL';
};

export const buildTimeline = (recommendation: SubmittedRecommendation): TimelineItem[] => {
  const status = inferWorkflowStatus(recommendation);
  const submittedAt = formatDateTime(recommendation.submittedAt) || recommendation.date;
  const panelDecisionAt = formatDateTime(recommendation.panelDecisionAt);
  const coordinatorDecisionAt = formatDateTime(recommendation.coordinatorDecisionAt);
  const panelAccepted =
    recommendation.selectedPanelDecision === 'ACCEPTED' ||
    status === 'PENDING_COORDINATOR' ||
    status === 'APPROVED' ||
    status === 'REJECTED_BY_COORDINATOR';
  const panelRejected = status === 'REJECTED_BY_PANEL';
  const coordinatorActive = status === 'PENDING_COORDINATOR';
  const coordinatorRejected = status === 'REJECTED_BY_COORDINATOR';
  const cancelled = status === 'CANCELLED_BY_SUPERVISOR' || status === 'CANCELLED_BY_OFFICE';
  const cancelledAt = formatDateTime(recommendation.cancelledAt);

  return [
    {
      id: 'submitted',
      label: 'Request submitted',
      detail: submittedAt,
      state: 'completed',
    },
    {
      id: 'panel',
      label: cancelled && !panelAccepted ? STATUS_LABELS[status] : 'Panel Review',
      detail: cancelled && !panelAccepted
        ? cancelledAt || recommendation.cancellationReason || 'Cancelled before the Panel took action'
        : panelRejected
        ? panelDecisionAt || recommendation.rejectionReason || 'Rejected by Panel member'
        : panelAccepted
        ? panelDecisionAt || 'Panel member accepted'
        : 'Awaiting Panel member decision',
      state: panelAccepted ? 'completed' : cancelled ? 'cancelled' : panelRejected ? 'rejected' : status === 'SUBMITTED_TO_PANEL' ? 'active' : 'pending',
    },
    {
      id: 'coordinator',
      label: 'Coordinator approval',
      detail: cancelled
        ? panelAccepted ? 'Recommendation cancelled before Coordinator approval' : 'Not reached because the recommendation was cancelled'
        : coordinatorRejected
        ? coordinatorDecisionAt || recommendation.rejectionReason || 'Rejected by Programme Coordinator'
        : status === 'APPROVED'
        ? coordinatorDecisionAt || 'Approved by Coordinator'
        : coordinatorActive
        ? 'Awaiting Coordinator approval'
        : 'Awaiting Panel review',
      state: cancelled && panelAccepted
        ? 'cancelled'
        : coordinatorRejected
        ? 'rejected'
        : status === 'APPROVED'
        ? 'completed'
        : coordinatorActive
        ? 'active'
        : 'pending',
    },
    {
      id: 'final',
      label: cancelled ? 'Recommendation Closed' : status === 'APPROVED' ? 'Request approved' : 'Appointed Panel',
      detail:
        cancelled
          ? recommendation.cancellationReason || STATUS_LABELS[status]
          : status === 'APPROVED'
          ? coordinatorDecisionAt || 'Appointment record created'
          : panelRejected || coordinatorRejected
          ? 'Recommendation closed'
          : 'Awaiting Coordinator approval',
      state: status === 'APPROVED' ? 'completed' : cancelled ? 'cancelled' : panelRejected || coordinatorRejected ? 'rejected' : 'pending',
    },
  ];
};

const getStatusBadgeClass = (status: SubmittedRecommendation['status']) => {
  if (status === 'Approved') return 'bg-[#e6fbf2] text-[#00a15c] border-[#bef5db]';
  if (status === 'Rejected') return 'bg-rose-50 text-rose-600 border-rose-100';
  if (status === 'Cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-[#eff6ff] text-blue-600 border-blue-100';
};

const TimelineMarker: React.FC<{ state: TimelineItemState }> = ({ state }) => {
  const className =
    state === 'completed'
      ? 'bg-[#00a15c] text-white border-[#00a15c]'
      : state === 'active'
      ? 'bg-brand-navy text-white border-brand-navy ring-4 ring-slate-100'
      : state === 'rejected'
      ? 'bg-rose-50 text-rose-600 border-rose-200'
      : state === 'cancelled'
      ? 'bg-slate-100 text-slate-600 border-slate-300'
      : 'bg-white text-slate-300 border-slate-200';

  return (
    <div className={`z-10 w-5 h-5 rounded-full border flex items-center justify-center ${className}`}>
      {state === 'completed' ? (
        <Check className="w-3 h-3 stroke-[3.5]" />
      ) : state === 'active' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-white block" />
      ) : state === 'rejected' || state === 'cancelled' ? (
        <X className="w-3 h-3 stroke-[3]" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block" />
      )}
    </div>
  );
};

export const RecommendationDetailsDrawer: React.FC<RecommendationDetailsDrawerProps> = ({isOpen,onClose,recommendation,onCancelRecommendation,onOpenStudent,backLabel="Back to Submitted recommendations"}) => {
  const [cancellationReason,setCancellationReason]=useState('');
  const [isCancelling,setIsCancelling]=useState(false);
  const [isCancelConfirmOpen,setIsCancelConfirmOpen]=useState(false);
  const [fresh,setFresh]=useState<PanelRecommendationDraft|null>(null);
  useEffect(()=>{setFresh(null);setCancellationReason('');setIsCancelConfirmOpen(false);},[recommendation]);
  if(!isOpen||!recommendation)return null;
  const record=fresh??toSubmittedPanelPresentation(recommendation);
  const reload=async()=>{if(recommendation.recommendationId==null)throw new Error('Exact recommendation identity is unavailable.');setFresh(await getPanelRecommendation(recommendation.recommendationId));};
  const canCancel=!!onCancelRecommendation&&record.status==='SUBMITTED_TO_PANEL';
  return <RecordPage title="Panel recommendation" metadata={<RequestMetadata {...panelRecordMetadata(record)}/>} backLabel={backLabel} onBack={onClose} pageKey={`panel-history:${recommendation.id}`} dirty={!!cancellationReason.trim()} busy={isCancelling}>
    <PanelRecommendationDetail record={record} contextAction={<ViewStudentRecordAction studentId={record.studentId} onOpen={onOpenStudent} disabled={isCancelling}/>} actions={canCancel?<PortalButton variant="danger" disabled={isCancelling} onClick={()=>setIsCancelConfirmOpen(true)}>Cancel recommendation</PortalButton>:undefined} administration={<PanelAppointmentRecordCard compact record={record}/>}/>
    <DecisionDialog isOpen={isCancelConfirmOpen} decisionKey={recommendation.id} title="Cancel Panel recommendation?" context={<>{record.studentName} · {record.programme}</>} kind="confirmation" tone="danger" message="This closes the pending recommendation. Its history remains available." confirmLabel="Cancel recommendation" cancelLabel="Keep recommendation" busy={isCancelling} dirty={!!cancellationReason.trim()} canConfirm={canCancel&&!!cancellationReason.trim()} successMessage="Panel recommendation cancelled." onReload={reload} onConfirm={async()=>{if(!onCancelRecommendation||!canCancel||!cancellationReason.trim())return false;setIsCancelling(true);try{return await onCancelRecommendation(recommendation,cancellationReason.trim());}finally{setIsCancelling(false);}}} onClose={()=>{setIsCancelConfirmOpen(false);setCancellationReason('');}}>
      <label className="form-label block">Cancellation reason<textarea required className="form-control form-control-md mt-2 min-h-28" value={cancellationReason} onChange={event=>setCancellationReason(event.target.value)}/></label>
    </DecisionDialog>
  </RecordPage>;
};
