import type {AppointmentMarkingTarget} from '../utils/appointmentMarking';
import { useReturnToFocusReload } from '../utils/returnToFocus';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  UserRound,
  Users,
  Clock, 
  CheckCircle, 
  ChevronRight, 
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
  CheckSquare,
  Award,
  LayoutDashboard,
  Filter,
  Check,
  Building
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, PortalButton, PortalToast, StatusBadge } from './PortalPrimitives';
import { EmptyState, LoadingState, ErrorState } from './StateViews';
import { SupervisorRequestHistory } from './SupervisorRequestHistory';
import { supervisorResearchPage } from '../utils/supervisorWorkspace';
import { SupervisorWorkspaceNavigation } from './SupervisorWorkspaceNavigation';
import { WorkflowAuditLog } from './WorkflowAuditLog';
import { SupervisorDocumentsList } from './SupervisorDocumentsList';
import { SupervisorRequest, ActiveSuperviseeRow, SupervisorWorkloadSummary } from '../types';
import {
  acceptSupervisorApplication,
  formatSupervisorWaiting,
  getSupervisorApplication,
  getSupervisorRequests,
  getActiveSupervisees,
  getOwnSupervisorWorkload,
  orderSupervisorQueueOldestFirst,
  rejectSupervisorApplication,
} from '../services';
import { capacityStateLabel } from '../utils/lecturerCapacity';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { SupervisoryTeamManagement } from './SupervisoryTeamManagement';
import { LecturerResearchWorkspace } from './LecturerResearchWorkspace';
import { LecturerAppointmentRequests } from './LecturerAppointmentRequests';
import { AppointmentSection, AppointmentMemberCard, AppointmentSummaryCard } from './AppointmentPrimitives';
import { LecturerAppointmentGuidance } from './LecturerAppointmentGuidance';
import { RecordPage } from './RecordPage';
import { LecturerSuperviseesWorkspace } from './LecturerSuperviseesWorkspace';

// ==================== REUSABLE DEFINITIONS & MOTIFS ====================

interface SummaryCardProps {
  title: string;
  value: string;
  subtext: string;
  badge?: string;
  badgeType?: 'success' | 'warning' | 'info';
  progress?: {
    current: number;
    max: number;
  };
}

/**
 * Standard counter info block with subtle drop shadow and sleek tracking.
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, subtext, badge, badgeType = 'success', progress }) => (
  <AppointmentSummaryCard title={title} value={value} description={subtext} badge={badge} tone={badgeType} progress={progress} />
);

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  icon?: LucideIcon;
  children: React.ReactNode;
}

/**
 * Standard action button matching visual state tokens.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'primary',
  icon: Icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantMap = {
    primary: 'primary',
    secondary: 'secondary',
    outline: 'secondary',
    danger: 'danger'
  } as const;

  return (
    <PortalButton
      variant={variantMap[variant]}
      size="md"
      icon={Icon}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </PortalButton>
  );
};

interface StatusChipProps {
  status: 'Pending' | 'Active' | 'No Supervisor' | 'Approved' | 'Rejected' | string;
}

/**
 * Highlights status records with professional rounded badges.
 */
export const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const normalized = status.toLowerCase();
  const tone =
    normalized.includes('approved') ? 'success' :
    normalized.includes('active') ? 'info' :
    normalized.includes('rejected') ? 'danger' :
    normalized.includes('no ') ? 'neutral' :
    'warning';

  return <StatusBadge tone={tone} dot pulse={normalized.includes('pending') || normalized.includes('active')}>{status}</StatusBadge>;
};

// ==================== SPECIFIC DRAWER REUSABLE COMPONENT PATTERNS ====================

interface StudentProfileHeaderProps {
  studentName: string;
  programme: string;
  submittedDate: string;
}

export const StudentProfileHeader: React.FC<StudentProfileHeaderProps> = ({
  studentName,
  programme,
  submittedDate
}) => {
  const initials = studentName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex gap-4 items-center py-4 border-b border-slate-100 select-none">
      <div className="w-14 h-14 bg-slate-100 text-slate-500 font-black text-sm rounded-full flex items-center justify-center tracking-widest shrink-0 border border-slate-205">
        {initials}
      </div>
      <div className="text-left">
        <h4 className="section-label leading-snug">
          {studentName}
        </h4>
        <p className="card-description mt-0.5">
          {programme}
        </p>
        <p className="card-description mt-1">
          Submitted: {submittedDate}
        </p>
      </div>
    </div>
  );
};

interface InfoCardProps {
  label: string;
  className?: string;
  children: React.ReactNode;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  label,
  className = "",
  children
}) => {
  return (
    <div className={`space-y-2 text-left ${className}`}>
      <span className="card-label text-slate-400 block leading-none">
        {label}
      </span>
      {children}
    </div>
  );
};

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  id,
  className = "",
  ...props
}) => {
  return (
    <div className="space-y-1.5 text-left w-full">
      <span className="form-label block">
        {label}
      </span>
      <textarea
        id={id}
        className={`form-control form-control-md ${className}`}
        style={{ minHeight: '100px' }}
        {...props}
      />
    </div>
  );
};

export const NoticeText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <p className="card-description mt-1 select-none text-left">
      {children}
    </p>
  );
};

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

export const RightDrawer: React.FC<RightDrawerProps> = ({
  isOpen,
  onClose,
  request,
  onApprove,
  onReject
}) => {
  const [rejectReason, setRejectReason] = useState('');

  if (!isOpen || !request) return null;
  const canAct =
    request.participantEligible !== false
    && (
      request.status === 'SUBMITTED_TO_SUPERVISOR'
      || request.status === 'Pending Review'
    );

  const handleRejectClick = () => {
    if (!rejectReason.trim()) {
      alert("A reason is required before rejecting this supervisor appointment request.");
      return;
    }
    onReject(request.studentId, rejectReason);
    setRejectReason('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Dimmed backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-[1px] transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex">
        {/* Sliding Panel container */}
        <div className="w-screen max-w-md bg-white shadow-sm flex flex-col overflow-hidden z-50 border-l border-slate-100">

          {/* Header block with close icon */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white select-none shrink-0">
            <h3 className="section-label">
              Supervisor Request Review
            </h3>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100/80 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-5 h-5 stroke-[2]" />
            </button>
          </div>

          {/* Drawer content and review controls scroll together. */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Student Profile Header */}
            <StudentProfileHeader 
              studentName={request.studentName}
              programme={`${request.programme} (Research)`}
              submittedDate={request.submittedDate}
            />

            {/* Research Abstract */}
            <InfoCard label="RESEARCH ABSTRACT">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl card-description text-slate-600 text-left">
                {request.abstract || 'No research abstract was provided with this application.'}
              </div>
            </InfoCard>

            <InfoCard label="RESEARCH AREA">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl card-description text-slate-600 text-left">
                {request.researchArea || 'Not recorded'}
              </div>
            </InfoCard>

            {/* Supporting Documents Section */}
            <SupervisorDocumentsList
              applicationId={request.id}
              documents={request.documents}
              compact
            />

            <WorkflowAuditLog events={request.workflow} />

            {request.participantEligible === false && (
              <p className="card-description rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                This Student is {request.participantLifecycleStatus?.toLowerCase()}; the request remains visible but is non-actionable until eligible.
              </p>
            )}

            {canAct ? (
            <div className="pt-5 border-t border-slate-100 space-y-4">
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => onApprove(request.studentId)}
                  className="w-full py-4 bg-brand-navy hover:bg-slate-900 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition cursor-pointer text-center"
                >
                  Approve as Supervisor
                </button>

                <button
                  type="button"
                  onClick={handleRejectClick}
                  className="w-full py-3.5 border border-rose-200 hover:bg-rose-50 text-rose-600 font-extrabold text-xs uppercase tracking-widest rounded-xl transition cursor-pointer text-center"
                >
                  Reject Request
                </button>
              </div>

              <FormTextarea 
                label="REASON FOR REJECTION" 
                placeholder="Enter reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <NoticeText>
                A reason is required before rejecting this supervisor appointment request.
              </NoticeText>
            </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 card-description text-slate-600">
                This workflow record is read-only because the request is no longer awaiting your decision.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

// ==================== SPECIFIC PORTAL COMPONENT PARTS ====================

interface RequestCardProps {
  request: SupervisorRequest;
  onOpen: () => void;
  onViewDossier: () => void;
}

/**
 * Clean container matching high fidelity request designs exactly.
 */
export const RequestCard: React.FC<RequestCardProps> = ({ request, onOpen, onViewDossier }) => (
  <div id={`request-card-${request.studentId}`}>
    <AppointmentMemberCard label="Applicant" name={request.studentName} status={request.status} tone="warning" actions={<>
      <PortalButton variant="primary" icon={UserRound} size="sm" onClick={onViewDossier}>View student record</PortalButton>
      <PortalButton size="sm" variant="primary" onClick={onOpen}>Open Request</PortalButton>
    </>}>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="card-label">Student ID</dt><dd className="card-value break-words">{request.studentId}</dd></div>
        <div><dt className="card-label">Programme</dt><dd className="card-value break-words">{request.programme}</dd></div>
        <div><dt className="card-label">Submitted</dt><dd className="card-value">{request.submittedDate}</dd></div>
        <div><dt className="card-label">Waiting</dt><dd className="card-description">{formatSupervisorWaiting(request)}</dd></div>
      </dl>
      <div className="space-y-1 pt-2"><p className="card-label">Proposed research title</p><p className="card-value break-words">{request.proposedTopic}</p></div>
    </AppointmentMemberCard>
  </div>
);

export const EmptyStateCard: React.FC = () => <p className="card-description rounded-xl bg-slate-50 p-4">No pending supervisor requests.</p>;

// ActiveSuperviseeRow now lives in src/types.

interface DataTableProps {
  data: ActiveSuperviseeRow[];
  onOpenRow: (row: ActiveSuperviseeRow) => void;
  onViewDossier: (studentId: string) => void;
}

/**
 * Clean high performance lists for direct active records review.
 */
export const DataTable: React.FC<DataTableProps> = ({
  data,
  onOpenRow,
  onViewDossier
}) => {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visibleRows = data.filter(row => `${row.studentId} ${row.studentName} ${row.researchTitle}`.toLowerCase().includes(query));
  return (
    <AppointmentSection id="supervisees-table-block" title="Active Supervisees" description="Your active primary supervision appointments.">
      {data.length > 1 ? <label className="form-label block max-w-lg">Find a supervisee<input type="search" className="form-control form-control-sm mt-1" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, student ID or research title" /></label> : null}
      {/* Main database layout listing */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0]/80 overflow-hidden shadow-3xs">
        <div className="overflow-x-auto">
          <table className="data-table table-fixed min-w-[850px] text-xs">
            <colgroup>{[16,22,26,12,10,14].map(width => <col key={width} style={{width:`${width}%`}} />)}</colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                <th className="data-th whitespace-nowrap py-4.5 px-3">STUDENT ID</th>
                <th className="data-th whitespace-nowrap py-4.5 px-3">STUDENT NAME</th>
                <th className="data-th whitespace-nowrap py-4.5 px-3">RESEARCH TITLE</th>
                <th className="data-th whitespace-nowrap py-4.5 px-3">APPT. DATE</th>
                <th className="data-th whitespace-nowrap py-4.5 px-3">STATUS</th>
                <th className="data-th whitespace-nowrap py-4.5 px-3 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-brand-navy">
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="card-description py-12 text-center text-slate-400">
                    {query ? 'No matching supervisees.' : 'No active supervisees assigned yet.'}
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => {
                return (
                  <tr key={row.studentId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-3 whitespace-nowrap font-mono font-bold text-slate-505 text-slate-500">
                      {row.studentId}
                    </td>
                    <td className="data-td py-4 px-3">
                      <span className="card-value whitespace-nowrap text-brand-navy">{row.studentName}</span>
                    </td>
                    <td className="data-td py-4 px-3 text-slate-500 whitespace-normal break-words" title={row.researchTitle}>
                      {row.researchTitle}
                    </td>
                    <td className="data-td-strong whitespace-nowrap py-4 px-3 text-slate-450 text-slate-400 font-sans">
                      {row.appointmentDate}
                    </td>
                    <td className="data-td py-4 px-3">
                      <StatusBadge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>{row.status}</StatusBadge>
                    </td>
                    <td className="data-td py-4 px-3 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <PortalButton variant="primary" icon={UserRound} size="sm"
                          onClick={() => onViewDossier(row.studentId)}
                        >View student record</PortalButton>
                        <button
                          onClick={() => onOpenRow(row)}
                        className="px-3.5 py-2 bg-brand-navy hover:bg-slate-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs"
                        >
                          View supervision
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppointmentSection>
  );
};

// ==================== MAIN SCREEN WORKFLOW CONTAINER ====================

interface LecturerSupervisorAppointmentsProps {
  lecturerId?: string;
  onBack?: () => void;
  initialApplicationId?: string;
  initialSupportingId?: string;
  onNavigateToRequest?: (id: string, kind: 'primary' | 'supporting') => void;
  requestBackLabel?: string;
  routeView?: 'list' | 'supervisees' | 'research' | 'history' | 'superviseeDetail';
  routeSuperviseeStudentId?: string;
  onNavigateToList?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToSupervisee?: (studentId: string) => void;
  onNavigateToDossier?: (studentId: string) => void;
  onNavigateToPanelRequest?: (id: string,recordKey?:string) => void;
  onNavigateToPanelRecommendation?: (studentId: string) => void;
  onNavigateToSupervisees?: () => void;
  onNavigateToMarks?:(target?:AppointmentMarkingTarget)=>void;
  researchView?: 'list' | 'detail' | 'profile' | 'new';
  researchRequestId?: string;
  researchBackLabel?: string;
  onNavigateToResearchRequest?: (id: string) => void;
  onNavigateToResearchList?: () => void;
  onNavigateToResearchProfile?: () => void;
}

export const LecturerSupervisorAppointments: React.FC<LecturerSupervisorAppointmentsProps> = ({
  lecturerId,
  initialApplicationId, initialSupportingId, onNavigateToRequest, requestBackLabel, routeView = 'list', routeSuperviseeStudentId,
  onNavigateToList, onNavigateToSupervisee, onNavigateToDossier,
  onNavigateToPanelRequest, onNavigateToPanelRecommendation, onNavigateToSupervisees, onNavigateToMarks,
  researchView = 'list', researchRequestId, researchBackLabel, onNavigateToResearchRequest, onNavigateToResearchList, onNavigateToResearchProfile,
}) => {
  const [capacity, setCapacity] = useState<SupervisorWorkloadSummary | null>(null);
  const [requestsList, setRequestsList] = useState<SupervisorRequest[]>([]);
  const [supervisees, setSupervisees] = useState<ActiveSuperviseeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [researchMetadata, setResearchMetadata] = useState<React.ReactNode>(null);
  const [researchDetailTitle, setResearchDetailTitle] = useState<string | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchRefresh, setResearchRefresh] = useState(0);
  const [teamRefresh, setTeamRefresh] = useState(0);
  const loadVersion = useRef(0);
  const loadData = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true); setError(null);
    try {
      const [requests, active, workload] = await Promise.all([getSupervisorRequests(), getActiveSupervisees(), getOwnSupervisorWorkload()]);
      if (version === loadVersion.current) {
        setRequestsList(orderSupervisorQueueOldestFirst(requests)); setSupervisees(active); setCapacity(workload);
      }
    } catch (failure) { if (version === loadVersion.current) { setError(failure instanceof Error ? failure.message : 'Supervisor appointments could not be loaded.'); setRequestsList([]); setSupervisees([]); setCapacity(null); } }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, []);
  useEffect(() => { void loadData(); return () => { loadVersion.current += 1; }; }, [loadData]);
  const selectedSupervisee = supervisees.find(row => row.studentId === routeSuperviseeStudentId);
  const researchPage = routeView === 'research' && researchView !== 'list' ? supervisorResearchPage(researchView) : null;
  const isSupervisionDetail = routeView === 'superviseeDetail';
  useReturnToFocusReload(() => void loadData(), !loading && !workspaceBusy && !initialApplicationId && !initialSupportingId && !isSupervisionDetail && routeView !== 'research');
  const refresh = () => { void loadData(); setResearchRefresh(value => value + 1); setTeamRefresh(value => value + 1); };
  if (initialApplicationId || initialSupportingId) return <LecturerAppointmentRequests primaryRequests={requestsList} primaryLoading={loading} primaryError={error} refreshVersion={teamRefresh}
    onChanged={loadData} initialApplicationId={initialApplicationId} initialSupportingId={initialSupportingId} onCloseRoute={onNavigateToList} backLabel={requestBackLabel} onNavigateToDossier={onNavigateToDossier} />;
  if (researchPage) return <RecordPage metadata={researchMetadata} title={researchView === 'detail' ? researchDetailTitle ?? researchPage.title : researchPage.title} subtitle={researchPage.subtitle} backLabel={researchBackLabel ?? 'Back to research changes'} onBack={onNavigateToResearchList ?? (() => {})}>
    <LecturerResearchWorkspace onDetailMetadata={setResearchMetadata} onDetailTitle={setResearchDetailTitle} hideHeader showRefresh={false} onBusyChange={setWorkspaceBusy} routeView={researchView} routeRequestId={researchRequestId}
      onNavigateToRequest={onNavigateToResearchRequest} onNavigateToList={onNavigateToResearchList} onNavigateToProfile={onNavigateToResearchProfile}
      refreshVersion={researchRefresh} onChanged={() => { void loadData(); setTeamRefresh(value => value + 1); }} />
  </RecordPage>;
  if (isSupervisionDetail) return <RecordPage title="Supervision details" backLabel="Back to My supervisees" onBack={onNavigateToSupervisees ?? (() => {})}>
    {loading ? <LoadingState message="Loading supervision details…" /> : error ? <ErrorState message={error} onRetry={loadData} /> : <>
      <SupervisoryTeamManagement key={routeSuperviseeStudentId} role="Lecturer" view="detail" routeStudentId={routeSuperviseeStudentId} detailContext={selectedSupervisee} onNavigateToApplication={onNavigateToRequest?id=>onNavigateToRequest(id,'primary'):undefined} onNavigateToDossier={onNavigateToDossier} onNavigateToPanelRequest={onNavigateToPanelRequest} onNavigateToPanelRecommendation={onNavigateToPanelRecommendation} onNavigateToMarks={onNavigateToMarks} showResearchChanges={false} showRefresh={false} onBusyChange={setWorkspaceBusy} refreshVersion={teamRefresh} onChanged={refresh} />
    </>}
  </RecordPage>;
  return <div id="lecturer-portal-workspace" className="space-y-6 text-left font-sans pb-12">
    <PageHeader title="Supervisor Appointments" subtitle="Review appointment requests, manage your supervisees and follow research changes."
       />
    <SupervisorWorkspaceNavigation role="Lecturer" />
    {(routeView === 'list' || routeView === 'history') && <div className="space-y-5">
      <LecturerAppointmentRequests primaryRequests={requestsList} primaryLoading={loading} primaryError={error} refreshVersion={teamRefresh} historyRoute={routeView === 'history'} onChanged={loadData} onNavigateToRequest={onNavigateToRequest} workload={capacity} onNavigateToDossier={onNavigateToDossier} onBusyChange={setWorkspaceBusy} />
      <LecturerAppointmentGuidance module="supervisor" section="requests" />
    </div>}
    {routeView === 'supervisees' && <LecturerSuperviseesWorkspace key="roster" role="Lecturer" lecturerId={lecturerId} view="roster" showResearchChanges={false} showRefresh={false} onBusyChange={setWorkspaceBusy} refreshVersion={teamRefresh} onNavigateToStudent={onNavigateToSupervisee} />}
    {routeView === 'research' && <LecturerResearchWorkspace hideHeader={false} showRefresh={false} onBusyChange={setWorkspaceBusy} routeView={researchView} routeRequestId={researchRequestId}
      onNavigateToRequest={onNavigateToResearchRequest} onNavigateToList={onNavigateToResearchList} onNavigateToProfile={onNavigateToResearchProfile}
      refreshVersion={researchRefresh} onChanged={() => { void loadData(); setTeamRefresh(value => value + 1); }} />}
    {routeView === 'research' && <LecturerAppointmentGuidance module="supervisor" section="research" />}

  </div>;
};
