import {PanelAcceptanceMessage} from './PanelCapacityNotice';
import type {AppointmentMarkingTarget} from '../utils/appointmentMarking';
import {PanelSuperviseesWorkspace,PanelNominationRecords} from "./PanelSuperviseesWorkspace";
import { PortalSelect } from './PortalSelect';
import {PanelBrowse} from './PanelBrowse';
import {PanelLecturerSummaryCards} from './PanelLecturerSummaryCards';
import {buildPanelReviewWorkspace} from '../utils/panelReviewWorkspace';
import { PanelSuperviseeDetails, pendingPanelRequest } from './PanelSuperviseeRoster';
import {PanelWorkspaceNavigation,panelWorkspaceSection,panelSuperviseeDetailParams} from './PanelWorkspaceNavigation';
import {RecommendationDetailsDrawer} from './RecommendationDetailsDrawer';
import {toAssignmentPanelPresentation,panelRequestPending,canActOnPanelRecord,type PanelPresentation} from '../utils/panelPresentation';
import {PanelRecommendationDetail,PanelAppointmentRecordCard,panelRecordMetadata} from './PanelRecordDetails';
import {RequestMetadata,ViewStudentRecordAction,PrimaryRequestDecisionButtons} from './RequestDetailPrimitives';
import { DecisionDialog } from './DecisionDialog';
import { PanelAssignmentsWorkspace } from './PanelAssignmentsWorkspace';
import { completeDecision, type DecisionOutcome } from '../utils/decisionSubmission';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import { RecordPage } from './RecordPage';
import { useSearchParams } from 'react-router';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { coordinatorProgrammeNames } from '../utils/coordinatorDelegations';
import {
  Users, 
  Clock, 
  CheckCircle, 
  ChevronRight, 
  FileText, 
  SlidersHorizontal,
  Mail, 
  Phone,
  Bookmark,
  ArrowLeft,
  X,
  Bell,
  HelpCircle,
  LogOut,
  Settings as SettingsIcon,
  Search,
  MessageSquareCode,
  FolderMinus,
  MailOpen,
  Megaphone,
  Award,
  Filter,
  Check,
  Building,
  Download,
  Eye,
  Info,
  Calendar,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, PortalButton, PortalToast, ProgressBar, StatusBadge } from './PortalPrimitives';
import { EmptyState, LoadingState, ErrorState } from './StateViews';
import { AppointmentSection, AppointmentSummaryCard, AppointmentMemberCard } from './AppointmentPrimitives';
import { LecturerAppointmentGuidance } from './LecturerAppointmentGuidance';
import { RecommendPanelMemberDrawer } from './RecommendPanelMemberDrawer';
import { SubmittedRecommendationsPage } from './SubmittedRecommendationsPage';
import { PanelAssignmentDetail } from './PanelAssignmentDetail';
import {PanelAssignmentDetails} from './PanelAssignmentDetails';
import {
  DemoUser,
  CoordinatorPanelWorkspace,
  PanelAssignment,
  PanelCandidate,
  PanelRecommendationDraft,
  PanelRecommendationSupervisee,
  PanelWorkloadSummary,
  SubmittedRecommendation,
} from '../types';
import {
  ApiError,
  acceptPanelRecommendation,
  approvePanelRecommendationByCoordinator,
  cancelPanelRecommendation,
  createPanelRecommendation as createPanelRecommendationApi,
  getCoordinatorPanelWorkspace,
  getEligiblePanelSupervisees,
  getPanelCandidates,
  getPanelAssignments,
  getPanelRecommendation,
  getPanelRecommendationDrafts,
  getPanelRecommendations,
  getPanelReviewQueue,
  getPanelReviewHistory,
  getOwnPanelWorkload,
  rejectPanelRecommendation,
  rejectPanelRecommendationByCoordinator,
  endPanelAppointment,
} from '../services';
import {
  PANEL_RECOMMENDATION_STATUS_LABELS,
  PanelRecommendationReviewerRole,
  canReviewPanelRecommendation,
  canCreatePanelRecommendation,
  mergeSubmittedPanelHistory,
} from '../utils/panelRecommendationWorkflow';
import { PanelRecommendationRecordsTable } from './PanelRecommendationRecordsTable';
import { WorkflowAuditLog } from './WorkflowAuditLog';
import { compareLongestWaiting, formatWaitingText } from '../utils/workflowAgeing';
import { AppointmentEndControl } from './AppointmentEndControl';
import { capacityStateLabel } from '../utils/lecturerCapacity';

// ==================== SUB-COMPONENTS & TYPES ====================

// PanelAssignment, PanelRecommendationDraft and SubmittedRecommendation now
// live in src/types.

interface RecommendationStudent {
  studentUserId?: number;
  studentId: string;
  studentName: string;
  programme: string;
  intake: string;
  supervisor: string;
  initials: string;
  proposedTopic: string;
  area: string;
  abstract: string;
}

const toRecommendationStudent = (student: PanelRecommendationSupervisee): RecommendationStudent => ({
  studentUserId: student.studentUserId,
  studentId: student.studentId,
  studentName: student.studentName,
  programme: student.programme,
  intake: student.semester,
  supervisor: student.supervisorName,
  initials: getInitials(student.studentName),
  proposedTopic: student.proposedTopic,
  area: student.researchArea,
  abstract: student.abstract,
});

const getInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const isPendingPanelRecommendation = (recommendation: PanelRecommendationDraft) =>
  recommendation.status === 'SUBMITTED_TO_PANEL' ||
  recommendation.status === 'PENDING_COORDINATOR';

const getRecommendationTone = (status: PanelRecommendationDraft['status']) => {
  if (status === 'APPROVED') return 'success' as const;
  if (status === 'REJECTED_BY_PANEL' || status === 'REJECTED_BY_COORDINATOR') return 'danger' as const;
  if (status === 'CANCELLED_BY_SUPERVISOR' || status === 'CANCELLED_BY_OFFICE' || status === 'CANCELLED_CAPACITY_FULL') return 'neutral' as const;
  return 'info' as const;
};

type PanelProgressItemStatus = 'completed' | 'active' | 'pending' | 'rejected' | 'cancelled';

interface PanelProgressItem {
  id: string;
  label: string;
  subtext?: string;
  status: PanelProgressItemStatus;
}

export const getPanelRecommendationProgressItems = (
  recommendation: PanelRecommendationDraft,
): PanelProgressItem[] => {
  const status = recommendation.status;
  const panelAccepted =
    recommendation.selectedPanelDecision === 'ACCEPTED' ||
    status === 'PENDING_COORDINATOR' ||
    status === 'APPROVED' ||
    status === 'REJECTED_BY_COORDINATOR';
  const panelRejected = status === 'REJECTED_BY_PANEL';
  const cancelled = status === 'CANCELLED_BY_SUPERVISOR' || status === 'CANCELLED_BY_OFFICE' || status === 'CANCELLED_CAPACITY_FULL';
  const coordinatorActive = status === 'PENDING_COORDINATOR';
  const coordinatorCompleted = status === 'APPROVED';
  const coordinatorRejected = status === 'REJECTED_BY_COORDINATOR';

  return [
    {
      id: 'submitted',
      label: 'Request submitted',
      subtext: recommendation.submittedDate,
      status: 'completed',
    },
    {
      id: 'panel',
      label: 'Panel Review',
      subtext: cancelled && !panelAccepted
        ? recommendation.cancellationReason || PANEL_RECOMMENDATION_STATUS_LABELS[status]
        : panelRejected
        ? 'Panel rejected this recommendation'
        : panelAccepted
        ? 'Panel accepted'
        : 'Awaiting Panel decision',
      status: panelAccepted ? 'completed' : cancelled ? 'cancelled' : panelRejected ? 'rejected' : status === 'SUBMITTED_TO_PANEL' ? 'active' : 'pending',
    },
    {
      id: 'coordinator',
      label: 'Coordinator approval',
      subtext: cancelled
        ? 'Recommendation cancelled before final approval'
        : coordinatorRejected
        ? 'Programme Coordinator rejected this recommendation'
        : coordinatorCompleted
        ? 'Coordinator approved'
        : coordinatorActive
        ? 'Awaiting Coordinator approval'
        : 'Awaiting Panel review',
      status: cancelled && panelAccepted
        ? 'cancelled'
        : coordinatorRejected
        ? 'rejected'
        : coordinatorCompleted
        ? 'completed'
        : coordinatorActive
        ? 'active'
        : 'pending',
    },
    {
      id: 'final',
      label: cancelled ? 'Recommendation Cancelled' : status === 'APPROVED' ? 'Request approved' : 'Appointed Panel',
      subtext:
        cancelled
          ? recommendation.cancellationReason || PANEL_RECOMMENDATION_STATUS_LABELS[status]
          : status === 'APPROVED'
          ? 'Recommendation completed'
          : panelRejected || coordinatorRejected
          ? 'Recommendation closed'
          : 'Awaiting Coordinator approval',
      status: status === 'APPROVED' ? 'completed' : cancelled ? 'cancelled' : panelRejected || coordinatorRejected ? 'rejected' : 'pending',
    },
  ];
};

const PanelRecommendationProgressTimeline: React.FC<{ items: PanelProgressItem[] }> = ({ items }) => (
  <div className="space-y-4">
    {items.map((item, index) => {
      const isLast = index === items.length - 1;
      const toneClass =
        item.status === 'completed'
          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
          : item.status === 'active'
          ? 'bg-brand-navy text-white border-brand-navy ring-4 ring-slate-100'
          : item.status === 'rejected'
          ? 'bg-rose-50 text-rose-600 border-rose-200'
          : item.status === 'cancelled'
          ? 'bg-slate-100 text-slate-600 border-slate-300'
          : 'bg-white text-slate-300 border-slate-200';
      const lineClass =
        item.status === 'completed'
          ? 'bg-emerald-100'
          : item.status === 'rejected'
          ? 'bg-rose-100'
          : 'bg-slate-100';

      return (
        <div key={item.id} className="relative flex gap-4 text-left group">
          <div className="flex flex-col items-center shrink-0">
            <div className={`z-10 w-6 h-6 rounded-full flex items-center justify-center border font-sans text-[10px] font-bold ${toneClass}`}>
              {item.status === 'completed' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3.5]" />
              ) : item.status === 'active' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-white block animate-pulse" />
              ) : item.status === 'rejected' ? (
                <X className="w-3.5 h-3.5 text-rose-600 stroke-[3]" />
              ) : item.status === 'cancelled' ? (
                <X className="w-3.5 h-3.5 text-slate-600 stroke-[3]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block" />
              )}
            </div>
            {!isLast && <div className={`w-[2px] h-10 -mb-4 mt-1 grow ${lineClass}`} />}
          </div>

          <div className="pt-0.5 space-y-0.5 select-none">
            <h5 className={`section-label ${item.status === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>
              {item.label}
            </h5>
            {item.subtext && (
              <p className={`card-caption ${item.status === 'pending' ? 'text-slate-350' : 'text-slate-400'}`}>
                {item.subtext}
              </p>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

interface PanelRecommendationReviewDrawerProps {
  presentation?: 'request' | 'appointment';
  backLabel?: string;
  isOpen: boolean;
  onClose: () => void;
  recommendation: PanelRecommendationDraft | null;
  reviewerRole: PanelRecommendationReviewerRole;
  onAccept?: (recommendation: PanelRecommendationDraft) => Promise<void | false | DecisionOutcome> | void;
  onReject?: (recommendation: PanelRecommendationDraft, reason: string) => Promise<void | false | DecisionOutcome> | void;
  readOnly?: boolean;
  routed?: boolean;
  busy?: boolean;
  onOpenStudent?: (id: string) => void;
  onAppointmentEnded?: () => Promise<unknown>;
  onReload?: () => Promise<unknown>;
}

export const PanelRecommendationReviewDrawer: React.FC<PanelRecommendationReviewDrawerProps> = ({
  isOpen,
  onClose,
  recommendation,
  reviewerRole,
  onAccept,
  onReject,
  readOnly = false,
  routed = false,
  busy = false,
  onOpenStudent, onAppointmentEnded, onReload, backLabel = 'Back to Panel Appointments',
  presentation = 'request',
}) => {
  const [sourceRequest,setSourceRequest]=useState(false);
  const appointmentView=presentation==='appointment'&&!sourceRequest;
  const [rejecting, setRejecting] = useState(false);
  const [confirmingAcceptance, setConfirmingAcceptance] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  useEffect(() => {
    setSourceRequest(false);
    setRejecting(false);
    setConfirmingAcceptance(false);
    setRejectionReason('');
    setRejectionError(null);
  }, [recommendation?.id, isOpen]);

  if (!isOpen || !recommendation) return null;

  const canAct = presentation!=='appointment' && !readOnly
    && recommendation.participantEligible !== false
    && canActOnPanelRecord(recommendation, reviewerRole);
  const capacity = recommendation.acceptanceCapacity;
  const capacityBlocked = reviewerRole==='SELECTED_PANEL' && (!capacity || capacity.state!=='AVAILABLE' || capacity.availableSlots<=0);
  const lastPlace = reviewerRole==='SELECTED_PANEL' && capacity?.state==='AVAILABLE' && capacity.availableSlots===1;
  const lifecycle = recommendation.appointmentLifecycle;
  const lifecycleActions = recommendation.canEndAppointment && lifecycle?.status === 'ACTIVE'
    ? <AppointmentEndControl buttonLabel="End panel appointment" label="Panel appointment" context={<>{recommendation.studentName} · {recommendation.programme}</>} decisionKey={lifecycle.appointmentId} onReload={onAppointmentEnded} onSubmit={(outcome, reason) => completeDecision(() => endPanelAppointment(lifecycle.appointmentId, outcome, reason), onAppointmentEnded)}/>
    : undefined;
  return <RecordPage title={appointmentView?'Panel appointment':'Panel recommendation'} metadata={appointmentView?undefined:<RequestMetadata {...panelRecordMetadata(recommendation)}/>} backLabel={sourceRequest?'Back to Panel appointment':backLabel} onBack={sourceRequest?()=>setSourceRequest(false):onClose} pageKey={routed ? undefined : `panel-review:${recommendation.id}`} dirty={!!rejectionReason.trim()} busy={busy}>
    {appointmentView?<PanelAssignmentDetails busy={busy} onViewRequest={()=>setSourceRequest(true)} record={recommendation} contextAction={<ViewStudentRecordAction studentId={recommendation.studentId} onOpen={onOpenStudent} disabled={busy}/>} actions={lifecycleActions}/>:<PanelRecommendationDetail record={recommendation} contextAction={<ViewStudentRecordAction studentId={recommendation.studentId} onOpen={onOpenStudent} disabled={busy}/>} actions={canAct||recommendation.participantEligible===false?<>
      {recommendation.participantEligible===false?<p className="card-description text-amber-800">This Student is {recommendation.participantLifecycleStatus?.toLowerCase()}; decisions require an eligible Student.</p>:null}
      {canAct?<PrimaryRequestDecisionButtons positiveLabel={reviewerRole==='SELECTED_PANEL'?'Accept request':'Approve request'} disabled={busy} positiveDisabled={capacityBlocked} onPositive={()=>setConfirmingAcceptance(true)} onReject={()=>setRejecting(true)}/>:null}
    </>:undefined} administration={<PanelAppointmentRecordCard compact record={recommendation} actions={lifecycleActions}/>}/>}
            <DecisionDialog isOpen={rejecting || confirmingAcceptance} decisionKey={recommendation.id}
              title={rejecting ? 'Reject Panel recommendation?' : reviewerRole === 'SELECTED_PANEL' ? 'Accept Panel nomination?' : 'Approve Panel recommendation?'}
        context={<>{recommendation.studentName} · {recommendation.programme}</>}
              message={rejecting ? 'This recommendation will be rejected. The recorded reason remains in its history.' : reviewerRole === 'SELECTED_PANEL' ? <PanelAcceptanceMessage capacity={capacity}/> : 'Approval creates the Panel appointment.'}
              confirmLabel={rejecting ? 'Reject recommendation' : reviewerRole === 'SELECTED_PANEL' ? 'Accept nomination' : 'Approve recommendation'}
              tone={rejecting ? 'danger' : lastPlace ? 'warning' : 'info'} busy={busy} dirty={!!rejectionReason.trim()}
              canConfirm={rejecting ? !!rejectionReason.trim() && !!onReject : !!onAccept && !capacityBlocked}
              successMessage={rejecting ? 'Panel recommendation rejected.' : reviewerRole === 'SELECTED_PANEL' ? 'Panel nomination accepted and sent to the Programme Coordinator.' : 'Panel recommendation approved.'}
              onClose={() => {setRejecting(false); setConfirmingAcceptance(false); setRejectionReason(''); setRejectionError(null);}}
              onReload={onReload}
              onConfirm={async () => {
                if (busy) return false;
                if (rejecting) { if (!onReject || !rejectionReason.trim()) return false; return await onReject(recommendation, rejectionReason.trim()); }
                if (!onAccept) return false;
                return await onAccept(recommendation);
              }}>
              {rejecting ? <label className="form-label block">Reason for rejection<textarea required className="form-control form-control-md mt-2 min-h-28" value={rejectionReason} onChange={event => setRejectionReason(event.target.value)}/></label> : null}
            </DecisionDialog>
  </RecordPage>;
};

export function PanelSubmittedRecommendations({records,onOpen}:{records:PanelRecommendationDraft[];onOpen:(row:PanelPresentation)=>void}) {
  return <PanelBrowse scope="supervisor-nominations" title="Submitted recommendations" description="Track nominations you submitted, including those for former supervisees. History shows final request outcomes." records={records} onOpen={onOpen}/>;
}

interface LecturerPanelAppointmentsProps {
  detailBackLabel?: string;
  currentUser?: DemoUser | null;
  initialRecommendationId?: string;
  initialSuperviseeId?: string;
  routeView?: 'list' | 'submitted' | 'reviewed' | 'assignmentDetail';
  routeAssignmentStudentId?: string;
  onNavigateToList?: () => void;
  onNavigateToSubmitted?: () => void;
  onNavigateToReviewed?: () => void;
  onNavigateToAssignment?: (studentId: string, appointmentId?:number) => void;
  onNavigateToMarks?:(target?:AppointmentMarkingTarget)=>void;
  onNavigateToDossier?: (studentId: string) => void;
}

export const LecturerPanelAppointments: React.FC<LecturerPanelAppointmentsProps> = ({
  currentUser,
  detailBackLabel = 'Back to Panel Appointments',
  initialRecommendationId,
  initialSuperviseeId,
  routeView = 'list',
  routeAssignmentStudentId,
  onNavigateToList,
  onNavigateToSubmitted,
  onNavigateToReviewed,
  onNavigateToAssignment,
  onNavigateToDossier, onNavigateToMarks,
}) => {
  // Right Drawer state
  const [isRecommendDrawerOpen, setIsRecommendDrawerOpen] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const mutation = useRef(false);
  const openedInitialSupervisee = useRef<string | null>(null);

  const [selectedRecommendation, setSelectedRecommendation] = useState<PanelRecommendationDraft | null>(null);
  const [selectedReviewerRole, setSelectedReviewerRole] = useState<PanelRecommendationReviewerRole>('SUPERVISOR');
  const [selectedRecommendationReadOnly, setSelectedRecommendationReadOnly] = useState(false);
  const previousRoutedRecommendation = useRef(initialRecommendationId);
  useEffect(() => {
    if (previousRoutedRecommendation.current && !initialRecommendationId) { setSelectedRecommendation(null); setSelectedRecommendationReadOnly(false); }
    previousRoutedRecommendation.current = initialRecommendationId;
  }, [initialRecommendationId]);
  const isCoordinator = currentUser?.role === 'Programme Coordinator';

  // Toast Notification
  const [toastText, setToastText] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText(null);
    }, 4500);
  };

  // Panel assignments, recommendation drafts, and the submitted-recommendation
  // History is loaded from the persisted appointment API.
  const [assignments, setAssignments] = useState<PanelAssignment[]>([]);
  const [submittedRecs, setSubmittedRecs] = useState<PanelRecommendationDraft[]>([]);
  const [panelReviewQueue, setPanelReviewQueue] = useState<PanelRecommendationDraft[]>([]);
  const [coordinatorReviewQueue, setCoordinatorReviewQueue] = useState<PanelRecommendationDraft[]>([]);
  const [coordinatorWorkspace, setCoordinatorWorkspace] = useState<CoordinatorPanelWorkspace | null>(null);
  const coordinatorProgrammeLabel = coordinatorProgrammeNames(coordinatorWorkspace).join(', ');
  const [reviewedRequests, setReviewedRequests] = useState<PanelRecommendationDraft[]>([]);
  const [panelRecommendations, setPanelRecommendations] = useState<SubmittedRecommendation[]>([]);
  const [panelCandidates, setPanelCandidates] = useState<PanelCandidate[]>([]);
  const [ownPanelCapacity, setOwnPanelCapacity] = useState<PanelWorkloadSummary | null>(null);
  const [eligibleSupervisees, setEligibleSupervisees] = useState<PanelRecommendationSupervisee[]>([]);
  const [listParams, setListParams] = useSearchParams();
  const selectedSuperviseeId = initialSuperviseeId ?? listParams.get('panelStudent');
  const workspaceRole=isCoordinator?'coordinator':'lecturer';
  const section=panelWorkspaceSection(workspaceRole,initialSuperviseeId&&!isCoordinator?'supervisees':listParams.get('panelSection'),routeView);
  const [selectedSubmittedId,setSelectedSubmittedId]=useState<string|null>(null);
  const changeSection=(value:string)=>setListParams(current=>{const next=new URLSearchParams(current);next.set('panelSection',value);next.delete('student');next.delete('panelStudent');next.delete('panelLecturer');return next;},{replace:true});
  const nominationRecordsOpen=!isCoordinator&&section==='supervisees'&&!selectedSuperviseeId&&(listParams.get('panelRecords')==='1'||routeView==='submitted');
  const openNominationRecords=()=>setListParams(current=>{const next=new URLSearchParams(current);next.set('panelRecords','1');return next;});
  const closeNominationRecords=()=>{if(routeView==='submitted'){onNavigateToList?.();return;}setListParams(current=>{const next=new URLSearchParams(current);next.delete('panelRecords');return next;},{replace:true});};
  const openSupervisee=(studentId:string)=>setListParams(current=>panelSuperviseeDetailParams(current,studentId));
  const returnToSupervisees=()=>initialSuperviseeId?navigateToList():changeSection('supervisees');

  const assignmentSearch = listParams.get('q') ?? '';
  const setAssignmentSearch = (value: string) => setListParams(current => { const next = new URLSearchParams(current); if (value) next.set('q', value); else next.delete('q'); return next; }, { replace: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(!!initialRecommendationId);
  const [createError, setCreateError] = useState<string | null>(null);
  const recommendationVersion = useRef(0);

  const loadData = useCallback((strict = false) => {
    setLoading(true);
    setError(null);
    const load = isCoordinator
      ? Promise.all([getCoordinatorPanelWorkspace()])
      : Promise.all([
          getPanelAssignments(),
          getPanelRecommendationDrafts(),
          getPanelRecommendations(),
          getPanelReviewQueue(),
          getPanelReviewHistory(),
          getEligiblePanelSupervisees(),
          getPanelCandidates(),
          getOwnPanelWorkload(),
        ]);

    return load
      .then((result) => {
        if (isCoordinator) {
          const [workspace] = result as [CoordinatorPanelWorkspace];
          setAssignments([]);
          setSubmittedRecs([]);
          setPanelRecommendations([]);
          setPanelCandidates([]);
          setOwnPanelCapacity(null);
          setEligibleSupervisees([]);
          setPanelReviewQueue([]);
          setReviewedRequests([]);
          setCoordinatorWorkspace(workspace);
          setCoordinatorReviewQueue(workspace.queue);
          return;
        }

        const [asg, drafts, recs, panelQueue, history, eligibleSupervisees, candidates, workload] = result as [
          PanelAssignment[],
          PanelRecommendationDraft[],
          SubmittedRecommendation[],
          PanelRecommendationDraft[],
          PanelRecommendationDraft[],
          Awaited<ReturnType<typeof getEligiblePanelSupervisees>>,
          PanelCandidate[],
          PanelWorkloadSummary,
        ];
        setAssignments(asg);
        setSubmittedRecs(drafts);
        setPanelRecommendations(recs);
        setPanelCandidates(candidates);
        setOwnPanelCapacity(workload);
        setPanelReviewQueue(panelQueue);
        setCoordinatorReviewQueue([]);
        setCoordinatorWorkspace(null);
        setReviewedRequests(history);
        setEligibleSupervisees(eligibleSupervisees);
      })
      .catch((e) => {setError(e instanceof Error ? e.message : 'Failed to load panel appointments.'); if (strict) throw e;})
      .finally(() => setLoading(false));
  }, [initialSuperviseeId, isCoordinator]);

  useReturnToFocusReload(loadData, !loading && !mutationBusy && !isRecommendDrawerOpen && !selectedRecommendation && !initialRecommendationId && !initialSuperviseeId && routeView !== 'assignmentDetail');

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!initialRecommendationId) return;
    const recommendation = [
      ...submittedRecs,
      ...panelReviewQueue,
      ...coordinatorReviewQueue,
      ...reviewedRequests,
      ...(coordinatorWorkspace?.records ?? []),
    ].find((item) => String(item.id) === String(initialRecommendationId));
    if (!recommendation) return;
    setSelectedRecommendation(recommendation);
    const isSelectedPanel =
      recommendation.recommendedMemberId === currentUser?.staffId;
    const role: PanelRecommendationReviewerRole = isCoordinator
      ? 'PROGRAMME_COORDINATOR'
      : isSelectedPanel
      ? 'SELECTED_PANEL'
      : 'SUPERVISOR';
    setSelectedReviewerRole(role);
    setSelectedRecommendationReadOnly(
      !canActOnPanelRecord(recommendation, role),
    );
  }, [
    initialRecommendationId,
    submittedRecs,
    panelReviewQueue,
    coordinatorReviewQueue,
    reviewedRequests,
    coordinatorWorkspace,
    isCoordinator,
    currentUser?.staffId,
  ]);

  const loadRecommendation = useCallback(async () => {
    if(!initialRecommendationId)return;
    const version=++recommendationVersion.current;
    setRecommendationLoading(true);setRecommendationError(null);
    try {
      const row=await getPanelRecommendation(initialRecommendationId);
      if(version!==recommendationVersion.current)return;
      const role:PanelRecommendationReviewerRole=isCoordinator?'PROGRAMME_COORDINATOR':row.recommendedMemberId===currentUser?.staffId?'SELECTED_PANEL':'SUPERVISOR';
      setSelectedRecommendation(row);setSelectedReviewerRole(role);setSelectedRecommendationReadOnly(!canActOnPanelRecord(row,role));
    } catch(reason) {
      if(version===recommendationVersion.current)setRecommendationError(reason instanceof Error?reason.message:'Recommendation could not be loaded.');
    } finally {if(version===recommendationVersion.current)setRecommendationLoading(false);}
  },[initialRecommendationId,isCoordinator,currentUser?.staffId]);
  useEffect(()=>{
    void loadRecommendation();
    return()=>{recommendationVersion.current+=1;};
  },[loadRecommendation]);

  useEffect(()=>{setCreateError(null);},[isRecommendDrawerOpen,selectedSuperviseeId]);

  const selectedSupervisee = useMemo(
    () => eligibleSupervisees.find((student) => student.studentId === selectedSuperviseeId) ?? null,
    [eligibleSupervisees, selectedSuperviseeId],
  );

  const recommendationStudent = useMemo(
    () => selectedSupervisee ? toRecommendationStudent(selectedSupervisee) : null,
    [selectedSupervisee],
  );
  const replacementAssignment = selectedSupervisee?.panelAppointmentId
    ? selectedSupervisee
    : null;

  // Merge the lecturer's own drafts with the submitted-recommendation history so
  // newly recommended items appear immediately at the top of the table.
  const combinedRecommendations = useMemo(() => {
    const customList = submittedRecs
      .map((r) => ({
        id: r.id !== undefined
          ? `REC-${String(r.id).padStart(4, '0')}`
          : `STUDENT-${r.studentId}`,
        recommendationId: r.id,
        recommendation: r,
        studentName: r.studentName,
        studentId: r.studentId,
        researchTitle: r.proposedTopic,
        recommendedPanel: r.recommendedMember,
        recommendedPanelId: r.recommendedMemberId,
        date: r.submittedDate,
        status: (r.status === 'APPROVED'
          ? 'Approved'
          : r.status === 'CANCELLED_BY_SUPERVISOR' || r.status === 'CANCELLED_BY_OFFICE' || r.status === 'CANCELLED_CAPACITY_FULL'
          ? 'Cancelled'
          : r.status === 'REJECTED_BY_PANEL' || r.status === 'REJECTED_BY_COORDINATOR'
          ? 'Rejected'
          : 'Pending Approval') as SubmittedRecommendation['status'],
        workflowStatus: r.status,
        semester: r.semester || '',
        programme: r.programme,
        researchArea: r.researchArea,
        abstract: r.abstract ?? '',
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
      }));

    return mergeSubmittedPanelHistory(customList, panelRecommendations);
  }, [submittedRecs, panelRecommendations]);

  const currentRecommendation = useMemo(
    () => recommendationStudent
      ? pendingPanelRequest(submittedRecs, recommendationStudent.studentId) ?? null
      : null,
    [submittedRecs, recommendationStudent],
  );

  const selectedAssignment = useMemo(
    () => routeAssignmentStudentId
      ? assignments.find((assignment) => String(assignment.studentId) === String(routeAssignmentStudentId) && (!listParams.get("appointment") || String(assignment.appointmentId)===listParams.get("appointment"))) ?? null
      : null,
    [assignments, routeAssignmentStudentId, listParams],
  );

  const navigateToList = onNavigateToList ?? (() => undefined);

  const canRecommendForStudent = Boolean(
    recommendationStudent && selectedSupervisee?.canRecommend && !currentRecommendation,
  );

  useEffect(() => {
    if (
      routeView !== 'list'
      || !initialSuperviseeId
      || recommendationStudent?.studentId !== initialSuperviseeId
      || !canRecommendForStudent
      || openedInitialSupervisee.current === initialSuperviseeId
    ) return;
    openedInitialSupervisee.current = initialSuperviseeId;
    setIsRecommendDrawerOpen(true);
  }, [
    canRecommendForStudent,
    initialSuperviseeId,
    recommendationStudent?.studentId,
    routeView,
  ]);

  const createRecommendation = async (
    notes: string,
    candidateId: string,
    replacementReason: string,
  ) => {
    if (!recommendationStudent) {
      setCreateError('No supervisee is available for panel recommendation.');
      return;
    }

    if (!canRecommendForStudent) {
      setCreateError(`A ${currentRecommendation ? PANEL_RECOMMENDATION_STATUS_LABELS[currentRecommendation.status] : 'current'} recommendation already exists for ${recommendationStudent.studentName}.`);
      return;
    }

    if (mutation.current) return;
    mutation.current = true; setMutationBusy(true);setCreateError(null);
    try {
      const newRec = await createPanelRecommendationApi({
        studentId: recommendationStudent.studentId,
        recommendedMemberId: candidateId,
        justification: notes,
        status: 'SUBMITTED_TO_PANEL',
        replacesAppointmentId: replacementAssignment?.panelAppointmentId ?? null,
        replacementReason: replacementAssignment ? replacementReason : null,
      });

      setSubmittedRecs([newRec, ...submittedRecs]);
      setIsRecommendDrawerOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      triggerToast(`Recommendation submitted to Panel member ${newRec.recommendedMember}.`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to save panel recommendation.');
    } finally { mutation.current = false; setMutationBusy(false); }
  };

  const activeRecommendationsCount = submittedRecs.filter(isPendingPanelRecommendation).length;
  const visibleAssignments = assignments.filter(assignment => [assignment.studentId, assignment.studentName, assignment.researchTitle, assignment.supervisor].join(' ').toLowerCase().includes(assignmentSearch.trim().toLowerCase()));
  const incomingReviews = buildPanelReviewWorkspace(panelReviewQueue,reviewedRequests);
  const activeAssignmentsCount = ownPanelCapacity?.workloadCount ?? ownPanelCapacity?.currentStudents ?? 0;
  const workloadLimit = ownPanelCapacity?.workloadLimit ?? 0;
  const activeReviewQueue = useMemo(
    () => [...(isCoordinator ? coordinatorReviewQueue : panelReviewQueue)]
      .sort(compareLongestWaiting),
    [coordinatorReviewQueue, isCoordinator, panelReviewQueue],
  );
  const activeReviewRole: PanelRecommendationReviewerRole = isCoordinator
    ? 'PROGRAMME_COORDINATOR'
    : 'SELECTED_PANEL';

  const recordPanelDecision = async (recommendation: PanelRecommendationDraft, reason?: string) => {
    if (recommendation.id === undefined) throw new Error('This recommendation is unavailable. Reload the record.');
    if (mutation.current) return false;
    mutation.current = true; setMutationBusy(true);
    try {
      return await completeDecision(async () => {
        const updated = reason !== undefined
          ? selectedReviewerRole === 'PROGRAMME_COORDINATOR'
            ? await rejectPanelRecommendationByCoordinator(recommendation.id!, reason)
            : await rejectPanelRecommendation(recommendation.id!, reason)
          : selectedReviewerRole === 'PROGRAMME_COORDINATOR'
            ? await approvePanelRecommendationByCoordinator(recommendation.id!)
            : await acceptPanelRecommendation(recommendation.id!);
        setSubmittedRecs(items => items.map(item => item.id === updated.id ? updated : item));
        setPanelReviewQueue(items => items.filter(item => item.id !== updated.id));
        setCoordinatorReviewQueue(items => items.filter(item => item.id !== updated.id));
        setSelectedRecommendation(updated);
        setSelectedRecommendationReadOnly(true);
      }, () => loadData(true));
    } finally { mutation.current = false; setMutationBusy(false); }
  };
  const handleReviewAccept = (recommendation: PanelRecommendationDraft) => recordPanelDecision(recommendation);
  const handleReviewReject = (recommendation: PanelRecommendationDraft, reason: string) => recordPanelDecision(recommendation, reason);

  const handleCancelRecommendation = async (
    recommendation: SubmittedRecommendation,
    reason: string,
  ) => {
    if (recommendation.recommendationId === undefined) {
      throw new Error('This recommendation cannot be cancelled because it has no backend ID.');
    }

    return await completeDecision(async()=>{
    const updated = await cancelPanelRecommendation(recommendation.recommendationId, reason);
    setSubmittedRecs((items) => items.map((item) => item.id === updated.id ? updated : item));
    setPanelRecommendations((items) => items.map((item) =>
      item.recommendationId === updated.id
        ? {
            ...item,
            recommendation: updated,
            status: 'Cancelled',
            workflowStatus: updated.status,
            cancelledAt: updated.cancelledAt,
            cancellationReason: updated.cancellationReason,
          }
        : item,
    ));
    },()=>loadData(true));
  };

  if (initialRecommendationId && (!selectedRecommendation || String(selectedRecommendation.id)!==String(initialRecommendationId))) return <RecordPage title="Panel recommendation" backLabel={detailBackLabel} onBack={navigateToList}>
    {recommendationLoading ? <LoadingState message="Loading Panel recommendation..."/> : recommendationError ? <ErrorState title="Panel recommendation could not be loaded" message={recommendationError} onRetry={()=>void loadRecommendation()}/> : <EmptyState title="Panel recommendation not found" description="The requested recommendation does not exist or is outside your access."/>}
  </RecordPage>;

  return (
    <div id="lecturer-panel-module-container" className="space-y-6 text-left pb-12">

      <PortalToast message={toastText} />

      {selectedSuperviseeId&&!isCoordinator ? selectedSubmittedId!==null||isRecommendDrawerOpen ? null : <RecordPage title="Student Panel details" backLabel="Back to My supervisees" onBack={returnToSupervisees}>
        {loading ? <LoadingState message="Loading student Panel details…"/> : error ? <ErrorState message={error} onRetry={()=>void loadData()}/> : selectedSupervisee ?
          <PanelSuperviseeDetails key={selectedSupervisee.studentId} student={selectedSupervisee} pendingRequest={currentRecommendation??undefined} recommendations={submittedRecs} onRecommend={()=>setIsRecommendDrawerOpen(true)} onOpenRequest={row=>setSelectedSubmittedId(String(row.id))}/>
          : <EmptyState title="Supervisee unavailable" description="This student is no longer available in your active primary supervisees."/>}
      </RecordPage> : nominationRecordsOpen ? selectedSubmittedId===null?<PanelNominationRecords loading={loading} error={error} onRetry={()=>void loadData()} recommendations={submittedRecs} onBack={closeNominationRecords} onOpenRequest={row=>setSelectedSubmittedId(String(row.id))}/>:null : routeView!=='assignmentDetail'?<div id="main-panel-listing-view" className="space-y-6">
        <PageHeader title="Panel Appointments" subtitle={isCoordinator?(coordinatorProgrammeLabel?`Review and monitor Panel appointments for ${coordinatorProgrammeLabel}.`:'No managed programme is assigned to this account.'):'Manage nominations for your supervisees and view your own Panel assignments.'}/>
        <PanelWorkspaceNavigation role={workspaceRole} section={section} onChange={changeSection}/>
        {loading?<LoadingState message="Loading Panel appointments…"/>:error?<ErrorState message={error} onRetry={loadData}/>:<>
          {section==='requests'&&!isCoordinator&&ownPanelCapacity?<PanelLecturerSummaryCards workload={ownPanelCapacity} reviewCount={incomingReviews.reviewCount} awaitingCoordinatorCount={incomingReviews.awaitingCoordinatorCount}/>:null}
          {section==='requests'?<PanelBrowse scope={isCoordinator?'coordinator-requests':'lecturer-reviews'} title="Appointment requests" description={isCoordinator?'Approve eligible nominations after Panel acceptance. Other ongoing programme requests remain available for monitoring.':'Review nominations asking you to serve as a Panel member. History includes your recorded reviews and cancelled requests, including accepted nominations awaiting Coordinator approval.'} records={isCoordinator?coordinatorWorkspace?.records??[]:incomingReviews.records} initialHistory={routeView==='reviewed'} view={isCoordinator?undefined:routeView==='reviewed'?'history':'requests'} onViewChange={isCoordinator?undefined:value=>{if(value==='history')onNavigateToReviewed?.();else onNavigateToList?.();}} requestViewForRecord={isCoordinator?undefined:incomingReviews.requestViewForRecord} canReview={row=>canActOnPanelRecord(row,activeReviewRole)} onOpen={row=>{setSelectedReviewerRole(activeReviewRole);setSelectedRecommendationReadOnly(!canActOnPanelRecord(row,activeReviewRole));setSelectedRecommendation(row as PanelRecommendationDraft);}}/>:null}
          {section==='supervisees'&&!isCoordinator?<>
            <PanelSuperviseesWorkspace students={eligibleSupervisees} recommendations={submittedRecs} onOpenStudent={openSupervisee} onOpenRecords={openNominationRecords}/>
          </>:null}
          {section==='appointments'?<>
            {!isCoordinator?<AppointmentSummaryCard icon={Users} title="Panel workload" value={activeAssignmentsCount} progress={ownPanelCapacity?.capacityState!=='NOT_CONFIGURED'&&workloadLimit>0?{current:activeAssignmentsCount,max:workloadLimit}:undefined} badge={ownPanelCapacity?.capacityState==='AVAILABLE'&&ownPanelCapacity.availableSlots===1?'1 place remaining':ownPanelCapacity?.capacityState?capacityStateLabel(ownPanelCapacity.capacityState):'Not configured'} tone={ownPanelCapacity?.selectable&&ownPanelCapacity.availableSlots!==1?'success':'warning'} description={`${ownPanelCapacity?.semesterCode??'No active semester'} · Includes active assignments and reserved nominations.`}/>:null}
            {isCoordinator?<PanelAssignmentsWorkspace role="coordinator" records={coordinatorWorkspace?.records??[]} suspended={!!selectedRecommendation}
              onOpen={row=>{setSelectedReviewerRole('PROGRAMME_COORDINATOR');setSelectedRecommendationReadOnly(true);setSelectedRecommendation(row as PanelRecommendationDraft);}}/>
              :<PanelBrowse scope="lecturer-appointments" title="My Panel students" appointments records={assignments.map(toAssignmentPanelPresentation)} onOpen={row=>onNavigateToAssignment?.(row.studentId,row.appointmentLifecycle?.appointmentId)}/>}
          </>:null}
        </>}
        {!isCoordinator&&section!=='supervisees'?<LecturerAppointmentGuidance module="panel" panelContext={section==='requests'?'reviews':'appointments'}/>:null}
      </div>:loading?<RecordPage title="Panel assignment" backLabel={detailBackLabel} onBack={navigateToList}><LoadingState message="Loading Panel assignment…"/></RecordPage>:error?<RecordPage title="Panel assignment" backLabel={detailBackLabel} onBack={navigateToList}><ErrorState message={error} onRetry={loadData}/></RecordPage>:selectedAssignment?<PanelAssignmentDetail assignment={selectedAssignment} onBack={navigateToList} onOpenMarksEntry={onNavigateToMarks} onOpenStudent={onNavigateToDossier}/>:<RecordPage title="Panel assignment" backLabel={detailBackLabel} onBack={navigateToList}><EmptyState title="Panel assignment not found" description="The requested appointment does not exist or is outside your access."/></RecordPage>}
      <RecommendationDetailsDrawer backLabel={selectedSuperviseeId?'Back to student Panel details':nominationRecordsOpen?'Back to Nomination records':undefined} isOpen={selectedSubmittedId!==null} onClose={()=>setSelectedSubmittedId(null)} recommendation={combinedRecommendations.find(r=>String(r.recommendationId)===selectedSubmittedId)??null} onCancelRecommendation={handleCancelRecommendation} onOpenStudent={onNavigateToDossier}/>

      {/* RIGHT SLIDING DRAWER: RECOMMEND PANEL MEMBER DRAWER */}
      {recommendationStudent && (
        <RecommendPanelMemberDrawer
          backLabel={initialSuperviseeId?detailBackLabel:'Back to student Panel details'}
          isOpen={isRecommendDrawerOpen}
          busy={mutationBusy}
          submitError={createError}
          onClose={() => { setIsRecommendDrawerOpen(false); if (initialSuperviseeId) navigateToList(); }}
          student={recommendationStudent}
          candidates={panelCandidates.filter(
            (candidate) => candidate.staffId !== replacementAssignment?.currentPanelMemberId,
          )}
          replacementMember={replacementAssignment?.currentPanelMember}
          replacementAppointmentId={replacementAssignment?.panelAppointmentId}
          onSubmit={(notes, candidateId, replacementReason) => {
            createRecommendation(notes, candidateId, replacementReason);
          }}
        />
      )}

      <PanelRecommendationReviewDrawer backLabel={!initialRecommendationId&&isCoordinator&&section==='appointments'?(listParams.has('panelLecturer')?'Back to Panel students':'Back to Panel assignments'):detailBackLabel} onOpenStudent={onNavigateToDossier}
        presentation={!initialRecommendationId&&isCoordinator&&section==='appointments'?'appointment':'request'}
        isOpen={selectedRecommendation !== null}
        routed={!!initialRecommendationId}
        busy={mutationBusy}
        onClose={() => {
          setSelectedRecommendation(null);
          setSelectedRecommendationReadOnly(false);
          if (initialRecommendationId) navigateToList();
        }}
        recommendation={selectedRecommendation}
        reviewerRole={selectedReviewerRole}
        onAccept={handleReviewAccept}
        onReject={handleReviewReject}
        onReload={async () => {await loadData(true); if (selectedRecommendation?.id !== undefined) {const fresh=await getPanelRecommendation(selectedRecommendation.id); setSelectedRecommendation(fresh); setSelectedRecommendationReadOnly(!canActOnPanelRecord(fresh, selectedReviewerRole));}}}
        readOnly={selectedRecommendationReadOnly}
        onAppointmentEnded={async () => {
          await loadData(true);
          if (selectedRecommendation?.id !== undefined) setSelectedRecommendation(await getPanelRecommendation(selectedRecommendation.id));
          setSelectedRecommendationReadOnly(true);
        }}
      />

    </div>
  );
};
