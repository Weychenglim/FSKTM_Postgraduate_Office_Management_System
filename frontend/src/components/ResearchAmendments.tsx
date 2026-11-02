import { PortalSelect } from './PortalSelect';
import { DecisionDialog } from './DecisionDialog';
import { useDecisionFeedback } from './DecisionFeedback';
import { completeDecision } from '../utils/decisionSubmission';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import { CoordinatorFiltersBar, type CoordinatorFilterControls } from './CoordinatorBrowsePrimitives';
import { useListState } from './ListState';
import { RecordPage } from './RecordPage';
import { useRecordDraft } from './RecordDraft';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, BookOpen, ChevronDown, FilePenLine, History } from 'lucide-react';
import { ApiError } from '../services/apiClient';
import { cancelResearchAmendment, correctResearchProfile, decideResearchAmendment, getNextResearchAmendment, loadResearchAmendmentWorkspace, submitResearchAmendment } from '../services/researchAmendmentsApi';
import type { ResearchAmendment, ResearchAmendmentOptions, ResearchRevision, ResearchPageQuery, ResearchPagination, ResearchNextTarget } from '../services/researchAmendmentsApi';
import { PortalButton, PortalConfirmModal } from './PortalPrimitives';
import {ResearchChangeRequestDetail} from './ResearchChangeRequestDetail';
import {AppointmentIcon} from './AppointmentPrimitives';
import {RequestMetadata, PrimaryRequestDecisionButtons} from './RequestDetailPrimitives';
import { RequestedChangesComparison } from './RequestedChangesComparison';
import {ResearchProfileDetail} from './ResearchProfileDetail';
import {SupervisionDetailSection} from './SupervisionDetailLayout';
import { buildSupervisorApprovalProcess } from '../utils/approvalProcess';
import { ErrorState, LoadingState } from './StateViews';
import type { UserRole } from '../types/auth';
import { requestGroup, requestStatusLabel, requestWaitingDays } from '../utils/lecturerRequests';
import { RequestViewSwitch, RequestFilters, WorkspaceSectionHeader, WorkspaceRecordTable, WorkspacePagination, workspacePageSize, type WorkspaceRecord, type RequestListView } from './RequestWorkspacePrimitives';

const inputClass = 'form-control form-control-sm mt-1';
const date = (value: string) => new Date(value).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const words = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
type Action = 'APPROVE' | 'REJECT' | 'CANCEL';

function researchChangeLabel(row: ResearchAmendment): string {
  const titleChanged = row.before.title !== row.after.title;
  const abstractChanged = row.before.abstract !== row.after.abstract;
  return row.kind === 'TRANSFER' ? 'Programme transfer' : titleChanged && abstractChanged ? 'Title and abstract change' : titleChanged ? 'Title change' : abstractChanged ? 'Abstract change' : 'Research change';
}

function researchReviewStatus(row: ResearchAmendment) {
  return row.kind === 'RESEARCH' && row.status === 'PENDING_COORDINATOR' ? 'PENDING_SUPERVISOR' : row.status;
}

function researchStatusLabel(row: ResearchAmendment) {
  const status = researchReviewStatus(row);
  return row.kind === 'RESEARCH' && status === 'PENDING_SUPERVISOR'
    ? 'Awaiting Supervisor review'
    : requestStatusLabel(status, row.canDecide);
}

function researchWorkspaceRecord(row: ResearchAmendment, busy: boolean, onOpen?: () => void): WorkspaceRecord {
  const stageEvent = [...row.events].reverse().find(event => event.newStatus === row.status && event.previousStatus !== event.newStatus);
  return { key: row.id, studentName: row.studentName, matricNo: row.matricNo,
    kind: researchChangeLabel(row),
    submittedAt: row.createdAt, status: researchStatusLabel(row), workflowStatus: researchReviewStatus(row),
    waitingDays: row.status.startsWith('PENDING') ? requestWaitingDays(stageEvent?.createdAt ?? row.createdAt) : null,
    waitingApplicable: requestGroup(researchReviewStatus(row), row.canDecide) !== 'history',
    actionLabel: requestGroup(researchReviewStatus(row), row.canDecide) === 'review' ? 'Review request' : 'View request', onOpen, disabled: busy };
}

function TransferTeamSnapshot({ row }: { row: ResearchAmendment }) {
  const team = row.teamSnapshot;
  return <>{row.kind === 'TRANSFER' ? <div className="card-description rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"><p className="card-value text-amber-900">Supervisory team retained on transfer</p><p>Primary supervisor: {team?.primary?.name ?? 'None recorded'}</p><p>Co-supervisors: {team?.coSupervisors?.map(member => member.name).join(', ') || 'None recorded'}</p><p>Panel: {team?.panel?.map(member => member.name).join(', ') || 'None recorded'}</p><p className="mt-2">Existing appointments keep their current workload slots; the transfer adds no new allocation.</p>{row.unfinishedTaskCount !== null ? <p>{row.unfinishedTaskCount} unfinished evaluation tasks remain assigned to their current evaluators.</p> : <p>Historical team snapshot. Current task counts are outside your access.</p>}</div> : null}</>;
}

export function researchRequestMetadata(row: ResearchAmendment): React.ComponentProps<typeof RequestMetadata> {
  const submission = row.events.find(event => ['SUBMIT', 'SUBMITTED'].includes(event.action));
  return {
    reference: `${row.kind === 'TRANSFER' ? 'Programme transfer' : 'Research request'} #${row.id}`,
    submittedAt: submission?.createdAt || row.createdAt,
    submittedBy: submission?.actorName ? `${submission.actorName}${submission.actorRole ? ` · ${submission.actorRole}` : ''}` : 'Not recorded',
    statusLabel: row.kind === 'RESEARCH' && researchReviewStatus(row) === 'PENDING_SUPERVISOR' ? 'Awaiting Supervisor review' : row.stageLabel || requestStatusLabel(row.status),
    statusTone: row.status === 'APPROVED' ? 'success' : row.status.startsWith('PENDING') ? 'warning' : row.status === 'REJECTED' ? 'danger' : 'neutral',
  };
}

export function ResearchAmendmentCard({ row, busy, onAction, studentView = false, lecturerView = false, presentation = 'embedded', onViewRequest, onViewProfile }: { row: ResearchAmendment; busy: boolean; onAction: (row: ResearchAmendment, action: Action) => void; studentView?: boolean; lecturerView?: boolean; presentation?: 'embedded' | 'list' | 'detail'; onViewRequest?: () => void; onViewProfile?:()=>void }) {
  if (presentation === 'list') {
    const record = researchWorkspaceRecord(row, busy, onViewRequest);
    return <WorkspaceRecordTable label="Research change request records" identityLabel={studentView ? 'Research change' : 'Student'} hideRequestType={studentView} rows={[studentView ? { ...record, studentName: record.kind ?? 'Research change', matricNo: '', actionLabel: 'View request' } : record]} />;
  }
  const stageEvent = [...row.events].reverse().find(event => event.newStatus === row.status && event.previousStatus !== event.newStatus);
  const steps = buildSupervisorApprovalProcess({ kind: row.kind === 'TRANSFER' ? 'transfer' : 'research', status: researchReviewStatus(row), submittedAt: row.createdAt, events: row.events, waitingDays: row.status.startsWith('PENDING') ? requestWaitingDays(stageEvent?.createdAt ?? row.createdAt) : null });
  const actions = (!studentView && row.canDecide) || row.canCancel ? <div className="space-y-3">
    {!studentView && row.canDecide ? <PrimaryRequestDecisionButtons positiveLabel="Approve request" disabled={busy} onPositive={()=>onAction(row,'APPROVE')} onReject={()=>onAction(row,'REJECT')}/> : null}
    {row.canCancel ? <PortalButton size="sm" disabled={busy} onClick={()=>onAction(row,'CANCEL')}>Cancel request</PortalButton> : null}
  </div> : undefined;
  const detail = <ResearchChangeRequestDetail row={row} changeLabel={researchChangeLabel(row)} steps={steps} actions={actions}
    profileAction={onViewProfile ? <PortalButton size="sm" icon={BookOpen} disabled={busy} onClick={onViewProfile}>View research profile</PortalButton> : undefined}
    transferTeam={!studentView && row.kind==='TRANSFER' ? <TransferTeamSnapshot row={row}/> : undefined}/>;
  return studentView || lecturerView ? presentation === 'detail' ? detail : <article className="space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="section-label">{researchChangeLabel(row)}</h3><details><summary className="card-value cursor-pointer text-blue-600">View details</summary><div className="mt-4">{detail}</div></details></article> : detail;
}

export type ResearchRouteView = 'list' | 'detail' | 'profile' | 'new';
export type ResearchCreationKind = 'RESEARCH' | 'CORRECTION' | 'TRANSFER';

type ResearchNavigationProps = {
  routeView?: ResearchRouteView;
  routeRequestId?: string;
  onNavigateToRequest?: (id: string) => void;
  onNavigateToList?: () => void;
  onNavigateToProfile?: (studentId?: number) => void;
  onNavigateToNew?: (kind?: ResearchCreationKind) => void;
  initialChangeType?: ResearchCreationKind;
  requestView?: RequestListView;
  requestSearch?: string;
  requestPage?: number;
  requestPageSize?: number;
  onRequestViewChange?: (view: RequestListView) => void;
  onRequestSearch?: (value: string) => void;
  onRequestReset?: () => void;
  onRequestPage?: (page: number) => void;
  onRequestPageSize?: (size: number) => void;
  studentFilter?: number;
  onStudentFilter?: (studentId: number | undefined) => void;
  researchFilters?: ResearchPageQuery;
  onResearchFilter?: (key: string, value: string) => void;
  pagination?: ResearchPagination;
  nextRequestQuery?: ResearchPageQuery;
  onNavigateToNextRequest?: (id: string, page: number) => void;
};

export function StudentResearchProfileCard({options,hasPending,onNavigateToProfile,onNavigateToNew}:{
  options:ResearchAmendmentOptions;hasPending:boolean;
  onNavigateToProfile?:ResearchNavigationProps['onNavigateToProfile'];onNavigateToNew?:()=>void;
}) {
  return <section aria-label="Current research profile" className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex items-center gap-3"><AppointmentIcon icon={BookOpen} tone="info" /><h2 className="card-label">Current research profile</h2></div>
      <p className="section-label [overflow-wrap:anywhere]">{options.profile?.title || 'Research title not recorded'}</p>
      {!options.canSubmitResearch && hasPending ? <p className="card-description">You have a research change awaiting a decision. You can submit another after it is resolved.</p> : null}
    </div>
    <div className="flex flex-wrap gap-2 lg:shrink-0">
      <PortalButton size="sm" onClick={() => onNavigateToProfile?.()}>View research profile</PortalButton>
      {options.canSubmitResearch && options.profile ? <PortalButton size="sm" variant="primary" onClick={()=>onNavigateToNew?.()}>Request research change</PortalButton> : null}
    </div>
  </section>;
}

export function ResearchAmendmentRouteContent({ routeView, routeRequestId, role, options, rows, revisions, busy, onAction, onNavigateToRequest, onNavigateToProfile, onNavigateToNew, requestForm, requestView = 'requests', requestSearch = '', requestPage = 1, requestPageSize, onRequestPage, onRequestPageSize, pagination, researchFilters }: ResearchNavigationProps & {
  role?: UserRole;
  options: ResearchAmendmentOptions;
  rows: ResearchAmendment[];
  revisions: ResearchRevision[];
  busy: boolean;
  onAction: (row: ResearchAmendment, action: Action) => void;
  requestForm: React.ReactNode;
}) {
  const studentView = role === 'Student';
  const lecturerView = role === 'Lecturer';
  const transferWorkspace = role === 'Programme Coordinator' && researchFilters?.type === 'TRANSFER';
  if (routeView === 'detail') {
    const row = rows.find(request => String(request.id) === routeRequestId);
    return row ? <ResearchAmendmentCard row={row} busy={busy} studentView={studentView} lecturerView={lecturerView} presentation="detail" onAction={onAction} onViewProfile={onNavigateToProfile?()=>onNavigateToProfile(row.studentId):undefined}/> : <p role="status" className="card-description">Request not found. It may no longer be available or you may not have access to it.</p>;
  }
  if (routeView === 'new') {
    if (options.profile && ((studentView && options.canSubmitResearch) || ((role === 'Programme Coordinator' || role === 'Office Staff/Admin') && (options.canCorrect || options.canTransfer)))) return <>{requestForm}</>;
    return <p className="card-description">{studentView && rows.some(row => row.status.startsWith('PENDING')) ? 'You have a request awaiting a decision. You can submit another after it is resolved.' : 'You cannot request a research change at this time.'}</p>;
  }
  if (routeView === 'profile') {
    if(!options.profile)return <p className="card-description">{(lecturerView||role==='Office Staff/Admin') && options.students.length ? 'Select a student to view their current research profile and saved revisions.' : 'No current research profile is available.'}</p>;
    const canNavigate=!!onNavigateToNew;
    const actions=canNavigate && role==='Office Staff/Admin' && (options.canCorrect||options.canTransfer) ? <>
      {options.canCorrect ? <PortalButton size="sm" variant="primary" icon={FilePenLine} disabled={busy} onClick={()=>onNavigateToNew('CORRECTION')}>Correct research text</PortalButton> : null}
      {options.canTransfer ? <PortalButton size="sm" icon={ArrowRightLeft} disabled={busy} onClick={()=>onNavigateToNew('TRANSFER')}>Request programme transfer</PortalButton> : null}
    </> : canNavigate && studentView && options.canSubmitResearch ? <PortalButton size="sm" variant="primary" icon={FilePenLine} disabled={busy} onClick={()=>onNavigateToNew('RESEARCH')}>Request research change</PortalButton> : undefined;
    return <ResearchProfileDetail options={options} revisions={revisions} actions={actions}/>;
  }
  const serverPaged = (role === 'Programme Coordinator'||role === 'Office Staff/Admin') && !!pagination;
  const visible = serverPaged ? rows : rows.filter(row => (requestGroup(researchReviewStatus(row), row.canDecide) === 'history') === (requestView === 'history')
    && `${row.studentName} ${row.matricNo} ${row.id} ${row.after.title} ${researchChangeLabel(row)} Research request #${row.id} Research amendment #${row.id} Request #${row.id}`.toLowerCase().includes(requestSearch.trim().toLowerCase()))
    .sort((a, b) => (requestView === 'requests' ? Number(b.canDecide) - Number(a.canDecide) : 0) || (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * (requestView === 'history' ? -1 : 1));
  const pageSize = pagination?.pageSize ?? workspacePageSize(requestPageSize);
  const pageCount = pagination?.pageCount ?? Math.max(1, Math.ceil(visible.length / pageSize));
  const page = pagination?.page ?? Math.min(pageCount, Math.max(1, Number.isFinite(requestPage) ? Math.floor(requestPage) : 1));
  const paged = serverPaged ? visible : visible.slice((page - 1) * pageSize, page * pageSize);
  const coordinatorHistory = (role === 'Programme Coordinator'||role === 'Office Staff/Admin'&&serverPaged) && requestView === 'history';
  const table = (selected: ResearchAmendment[]) => <WorkspaceRecordTable history={requestView === 'history'} label={transferWorkspace?'Programme transfer requests':'Research change request records'} identityLabel={studentView ? 'Research change' : 'Student'} hideRequestType={studentView||transferWorkspace} dateLabel={coordinatorHistory ? 'Outcome recorded' : 'Submitted'} rows={selected.map(row => {
    const record = {...researchWorkspaceRecord(row, busy, () => onNavigateToRequest?.(String(row.id))), submittedAt:coordinatorHistory ? row.updatedAt : row.createdAt};
    return studentView ? { ...record, studentName: record.kind ?? 'Research change', matricNo: '', actionLabel: 'View request' } : record;
  })} />;
  return <div className="space-y-6">
    {!studentView && !lecturerView && options.profile ? <div className="flex flex-wrap gap-3">
      {onNavigateToProfile ? <PortalButton icon={BookOpen} disabled={busy} onClick={()=>onNavigateToProfile()}>View research profile</PortalButton> : null}
      {onNavigateToNew && options.canCorrect ? <PortalButton icon={FilePenLine} disabled={busy} onClick={()=>onNavigateToNew('CORRECTION')}>Correct research text</PortalButton> : null}
      {onNavigateToNew && options.canTransfer ? <PortalButton icon={ArrowRightLeft} disabled={busy} onClick={()=>onNavigateToNew('TRANSFER')}>Request programme transfer</PortalButton> : null}
    </div> : null}
    {paged.length ? table(paged) : null}
    {!visible.length ? <p className="card-description rounded-lg bg-slate-50 p-4">{requestSearch ? 'No matching requests. Adjust the filters to see more records.' : requestView === 'history' ? 'No final request outcomes yet.' : transferWorkspace ? 'No programme transfers awaiting your decision.' : studentView ? 'No research change requests to display.' : serverPaged && role === 'Programme Coordinator' ? 'No research change requests awaiting your decision.' : 'No ongoing research change requests.'}</p> : null}
    <WorkspacePagination page={page} pageCount={pageCount} total={pagination?.total ?? visible.length} noun="requests" pageSize={pageSize} onPageSize={onRequestPageSize} onPage={value => onRequestPage?.(value)} />
  </div>;
}

export function CoordinatorResearchFilters({query, pagination, onFilter, transferOnly=false}: {query: ResearchPageQuery; pagination?: ResearchPagination; onFilter: (key: string, value: string) => void; transferOnly?:boolean}) {
  const setter = (key: string) => (value: string) => onFilter(key, value);
  const filters: CoordinatorFilterControls = {
    q:query.q ?? '',programme:query.programme ?? '',semester:query.semester ?? '',type:query.type ?? 'all',status:query.status ?? '',
    from:query.from ?? '',to:query.to ?? '',sort:query.sort ?? (query.view === 'history' ? 'newest' : 'waiting'),
    setQ:setter('q'),setProgramme:setter('programme'),setSemester:setter('semester'),setType:setter('type'),setStatus:setter('status'),
    setFrom:setter('from'),setTo:setter('to'),setSort:setter('sort'),setPage:()=>{},
    change:callback=>callback,reset:()=>onFilter('clear',''),
  };
  const facets = transferOnly && pagination ? {...pagination.facets, statuses:pagination.facets.statuses.filter(status=>!['PENDING_SUPERVISOR','PENDING_COORDINATOR'].includes(status))} : pagination?.facets;
  return <CoordinatorFiltersBar filters={filters} facets={facets} requests history={query.view === 'history'}
    statusLabel={status => status === 'PENDING_SUPERVISOR' || status === 'PENDING_COORDINATOR' ? 'Awaiting Supervisor review' : requestStatusLabel(status)}
    searchPlaceholder="Student name, matric number or request" typeOptions={transferOnly?undefined:[
      ['all','All types'],['RESEARCH','Research change'],['TRANSFER','Programme transfer'],['Title change','Title change'],
      ['Abstract change','Abstract change'],['Title and abstract change','Title and abstract change']
    ]} />;
}

export function ResearchNextRequestControl({nextId, loading = false, disabled = false, onNext, error}: {nextId: number | null; loading?: boolean; disabled?: boolean; onNext: () => void; error?: string | null}) {
  return <div className="flex flex-wrap items-center gap-3"><PortalButton size="sm" disabled={disabled || loading || nextId === null} onClick={onNext}>Next request</PortalButton>{error ? <p className="card-description">{error}</p> : null}</div>;
}

export function ResearchProfileHistoryCard({ revisions, studentView }: { revisions: ResearchRevision[]; studentView: boolean }) {
  const ordered = [...revisions].sort((a, b) => b.revision - a.revision);
  return <section aria-label="Revision history" className="mt-7">
    <SupervisionDetailSection title="Revision history" icon={History} actions={<p className="text-xs text-slate-600">{ordered.length} saved {ordered.length === 1 ? 'version' : 'versions'}</p>}>
      {ordered.length ? <div className="divide-y divide-slate-200">{ordered.map(revision => <ResearchRevisionCard key={revision.id} revision={revision} studentView={studentView} collapsible />)}</div> : <p className="card-description">No saved research revisions to display.</p>}
    </SupervisionDetailSection>
  </section>;
}

export function ResearchRevisionCard({ revision, studentView = false, collapsible = false }: { revision: ResearchRevision; studentView?: boolean; lecturerView?: boolean; collapsible?: boolean }) {
  const title = revision.kind === 'BASELINE' ? 'Initial record' : `Revision ${revision.revision} · ${words(revision.kind)}`;
  const metadata = `${revision.actorName} · ${date(revision.createdAt)} (Malaysia)`;
  const comparison = <>
    <RequestedChangesComparison before={revision.before} after={revision.after} revision initialRecord={revision.kind === 'BASELINE'} />
    {revision.reason ? <p className="card-description whitespace-pre-wrap">{revision.reason}</p> : null}
  </>;
  if (collapsible) return <details className="group/revision py-5 first:pt-0 last:pb-0">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 space-y-1 [overflow-wrap:anywhere]"><span className="text-sm font-medium leading-6 text-slate-900 block">{title}</span><span className="text-xs font-normal leading-6 text-slate-600 block">{metadata}</span></span>
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 group-open/revision:rotate-180" />
    </summary>
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">{comparison}</div>
  </details>;
  return <article className="space-y-3 rounded-xl border border-slate-200 p-4">
    <div className="space-y-1">
      <h3 className="section-label">{title}{!studentView && revision.studentName ? ` · ${revision.studentName}` : ''}</h3>
      <p className="card-description">{metadata}</p>
    </div>
    {comparison}
  </article>;
}

export function ResearchAmendmentForm({ options, busy, blocked = false, onSave, studentView = false, initialKind }: { options: ResearchAmendmentOptions; busy: boolean; blocked?: boolean; studentView?: boolean; initialKind?: ResearchCreationKind; onSave: (kind: 'RESEARCH' | 'TRANSFER' | 'CORRECTION', values: { title: string; abstract: string; destinationProgramme: string; reason: string }) => void }) {
  const defaultKind:ResearchCreationKind=options.canSubmitResearch ? 'RESEARCH' : options.canCorrect ? 'CORRECTION' : 'TRANSFER';
  const permittedInitial=initialKind==='RESEARCH'?options.canSubmitResearch:initialKind==='CORRECTION'?options.canCorrect:initialKind==='TRANSFER'?options.canTransfer:false;
  const startingKind=initialKind && permittedInitial ? initialKind : defaultKind;
  const [kind, setKind] = useState<ResearchCreationKind>(startingKind);
  const [title, setTitle] = useState(options.profile?.title ?? '');
  const [abstract, setAbstract] = useState(options.profile?.abstract ?? '');
  const [destinationProgramme, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [unchanged, setUnchanged] = useState(false);
  useRecordDraft(title !== (options.profile?.title ?? '') || abstract !== (options.profile?.abstract ?? '') || !!destinationProgramme || !!reason.trim() || unchanged || kind !== startingKind, busy);
  if (!options.profile || !(options.canSubmitResearch || options.canCorrect || options.canTransfer)) return null;
  const allowed = kind === 'RESEARCH' ? options.canSubmitResearch : kind === 'CORRECTION' ? options.canCorrect : options.canTransfer;
  const proposed=kind==='TRANSFER' ? {...options.profile,programme:destinationProgramme} : {...options.profile,title:title.trim(),abstract:abstract.trim()};
  const hasChanges=kind==='TRANSFER' ? !!destinationProgramme && destinationProgramme!==options.profile.programme : proposed.title!==options.profile.title || proposed.abstract!==options.profile.abstract;
  const valid = allowed && hasChanges && reason.trim() && (kind === 'TRANSFER' ? destinationProgramme : title.trim() && abstract.trim() && (kind !== 'CORRECTION' || unchanged));
  const formTitle=kind==='CORRECTION' ? 'Correct research text' : kind==='TRANSFER' ? 'Request programme transfer' : 'Request research change';
  return <form data-research-change-form onSubmit={event=>{event.preventDefault();if(valid&&!busy&&!blocked)onSave(kind,{title:title.trim(),abstract:abstract.trim(),destinationProgramme,reason:reason.trim()});}}>
    <SupervisionDetailSection title={formTitle} icon={FilePenLine}>
      <fieldset disabled={busy || blocked} className="min-w-0 space-y-6">
        <legend className="sr-only">Change details</legend>
        {!studentView ? <label className="block space-y-2 text-xs font-medium text-slate-600">Change type<PortalSelect className="form-control form-control-md" value={kind} onChange={event=>setKind(event.target.value as typeof kind)}>{options.canSubmitResearch ? <option value="RESEARCH">Research title / abstract amendment</option> : null}{options.canCorrect ? <option value="CORRECTION">Typographical correction</option> : null}{options.canTransfer ? <option value="TRANSFER">Programme transfer</option> : null}</PortalSelect></label> : null}
        {kind==='TRANSFER' ? <label className="block space-y-2 text-xs font-medium text-slate-600">Destination programme<PortalSelect required className="form-control form-control-md" value={destinationProgramme} onChange={event=>setDestination(event.target.value)}><option value="">Select destination programme</option>{options.programmes.filter(programme=>programme!==options.profile?.programme).map(programme=><option key={programme}>{programme}</option>)}</PortalSelect></label> : <>
          <label className="block space-y-2 text-xs font-medium text-slate-600">Research title<input required maxLength={500} className="form-control form-control-md" value={title} onChange={event=>setTitle(event.target.value)}/></label>
          <label className="block space-y-2 text-xs font-medium text-slate-600">Research abstract<textarea required rows={8} className="form-control form-control-md" value={abstract} onChange={event=>setAbstract(event.target.value)}/></label>
        </>}
        <div className="space-y-6 border-t border-slate-100 pt-6">
          <label className="block space-y-2 text-xs font-medium text-slate-600">Reason for change<textarea required rows={3} className="form-control form-control-md" value={reason} onChange={event=>setReason(event.target.value)}/></label>
          {kind==='CORRECTION' ? <label className="flex items-start gap-3 text-sm font-normal leading-6 text-slate-700"><input type="checkbox" required className="mt-1 shrink-0" checked={unchanged} onChange={event=>setUnchanged(event.target.checked)}/>I confirm this corrects typography only and does not change the research meaning.</label> : <p className="text-xs leading-6 text-slate-600">{kind==='RESEARCH' ? 'The primary supervisor makes the final decision on your research change request.' : 'The source programme coordinator reviews first, followed by the destination programme coordinator. Both must acknowledge the existing team and unfinished tasks.'}</p>}
        </div>
      </fieldset>
      {hasChanges ? <details className="border-t border-slate-100 pt-5" data-change-preview><summary className="w-fit cursor-pointer rounded text-sm font-medium leading-6 text-brand-navy focus-visible:outline-2 focus-visible:outline-blue-600">Preview changes</summary><div className="mt-6"><RequestedChangesComparison before={options.profile} after={proposed}/></div></details> : null}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6">
        <p className="text-xs leading-6 text-slate-600" role="status">{hasChanges ? kind==='TRANSFER' ? 'Programme change ready for review.' : `${[proposed.title!==options.profile.title?'Title':null,proposed.abstract!==options.profile.abstract?'Abstract':null].filter(Boolean).join(' and ')} changed.` : 'No changes yet.'}</p>
        <PortalButton type="submit" variant="primary" isLoading={busy} disabled={!valid || blocked}>{kind==='CORRECTION' ? 'Save audited correction' : 'Submit request'}</PortalButton>
      </div>
    </SupervisionDetailSection>
  </form>;
}

export function ResearchAmendments({ onChanged, role, refreshVersion = 0, hideHeader = false, showRefresh = true, onBusyChange, onDetailMetadata, onDetailTitle, routeView, routeRequestId, onNavigateToRequest, onNavigateToList, onNavigateToProfile, onNavigateToNew,
  requestView = 'requests', requestSearch = '', requestPage = 1, requestPageSize, onRequestViewChange, onRequestSearch, onRequestReset, onRequestPage, onRequestPageSize, studentFilter, onStudentFilter,
  researchFilters, onResearchFilter, nextRequestQuery, onNavigateToNextRequest, initialChangeType,
}: { onChanged?: () => void; role?: UserRole; refreshVersion?: number; hideHeader?: boolean; showRefresh?: boolean; onBusyChange?: (busy: boolean) => void; onDetailMetadata?: (metadata: React.ReactNode) => void; onDetailTitle?: (title: string | null) => void } & ResearchNavigationProps) {
  const studentView = role === 'Student';
  const lecturerView = role === 'Lecturer';
  const coordinatorView = role === 'Programme Coordinator';
  const transferWorkspace = coordinatorView && researchFilters?.type === 'TRANSFER';
  const staffPaged = coordinatorView || role === 'Office Staff/Admin';
  const compactView = studentView || lecturerView;
  const routedView = routeView;
  const [options, setOptions] = useState<ResearchAmendmentOptions | null>(null);
  const [rows, setRows] = useState<ResearchAmendment[]>([]);
  const [revisions, setRevisions] = useState<ResearchRevision[]>([]);
  const [pagination, setPagination] = useState<ResearchPagination>();
  const [nextRequest, setNextRequest] = useState<{scope: string; target: ResearchNextTarget | null; loading: boolean; error: string | null}>({scope:'',target:null,loading:false,error:null});
  const [localStudentId, setLocalStudentId] = useListState<number | undefined>(`research:${role}`, 'studentId', undefined);
  const studentId = onStudentFilter ? studentFilter : localStudentId;
  const setStudentId = onStudentFilter ?? setLocalStudentId;
  // Coordinator details resolve the exact authorised record independently of list filters.
  const requestStudentId = routedView === 'detail' || staffPaged && routedView === 'list' ? undefined : studentId;
  const pageQuery = staffPaged && routedView === 'list' ? JSON.stringify({...researchFilters, view:requestView, q:requestSearch, page:requestPage, size:workspacePageSize(requestPageSize)}) : '{}';
  const scope = `${role ?? ''}:${routedView ?? 'embedded'}:${routeRequestId ?? ''}:${requestStudentId ?? ''}:${refreshVersion}:${staffPaged && routedView === 'list' ? pageQuery : ''}`;
  // Workspace refreshes do not replace a creation draft. Only a new identity or
  // an explicitly accepted latest-record review establishes a new baseline.
  const [creationEpoch, setCreationEpoch] = useState(0);
  const creationIdentity = `${role ?? ''}:${routedView ?? 'embedded'}:${routeRequestId ?? ''}:${requestStudentId ?? ''}:${initialChangeType ?? ''}:${creationEpoch}`;
  const creationSession = useRef({identity: creationIdentity, generation: 0});
  if (creationSession.current.identity !== creationIdentity) creationSession.current = {identity: creationIdentity, generation: creationSession.current.generation + 1};
  const session = creationSession.current.generation;
  const [creation, setCreation] = useState<{session: number; options: ResearchAmendmentOptions; revision: number} | null>(null);
  const [blockedSession, setBlockedSession] = useState<number | null>(null);
  const [completedSession, setCompletedSession] = useState<number | null>(null);
  const [replaceSession, setReplaceSession] = useState<number | null>(null);
  const [recoveringSession, setRecoveringSession] = useState<number | null>(null);
  const recoveryPending = useRef<number | null>(null);
  const feedback = useDecisionFeedback();
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localDetail, setLocalDetail] = useState<number | null>(null);
  const [localNew, setLocalNew] = useState(false);
  const [edit, setEdit] = useState<{ row: ResearchAmendment; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [retainTeam, setRetainTeam] = useState(false);
  const version = useRef(0);
  const mutating = useRef(false);
  const mounted = useRef(false);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const load = useCallback(async (strict = false) => {
    const token = ++version.current;
    setLoading(true); setError(null);
    try { const data = await loadResearchAmendmentWorkspace({coordinator:coordinatorView,office:role==='Office Staff/Admin', routeView:routedView, requestId:routeRequestId, studentId:requestStudentId, pageQuery:JSON.parse(pageQuery)}); if (token === version.current && currentScope.current === scope) { setOptions(data.options); setRows(data.requests); setRevisions(data.revisions); setPagination(data.pagination); setLoadedScope(scope);
      if (creationSession.current.generation === session) setCreation(current => current?.session === session ? current : {session, options: data.options, revision: (current?.revision ?? 0) + 1});
    } else if (strict) throw new Error('The research record changed while it was loading. Review the current record again.'); }
    catch (failure) { if (token === version.current && currentScope.current === scope) { setLoadedScope(scope); setError(failure instanceof Error ? failure.message : 'Research changes could not be loaded.'); } if (strict) throw failure; }
    finally { if (token === version.current) setLoading(false); }
  }, [requestStudentId, scope, coordinatorView, routedView, routeRequestId, pageQuery, session]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setEdit(null); setReason(''); setRetainTeam(false); setNotice(null); }, [role, routedView, routeRequestId, requestStudentId, session]);
  useEffect(() => { void load(); return () => { version.current += 1; }; }, [load]);
  useReturnToFocusReload(() => void load(), routedView === 'list' && !loading && !busy && !edit && !localNew);
  const creationOptions = creation?.session === session ? creation.options : null;
  const blocked = blockedSession === session;
  const completed = completedSession === session;
  const recovering = recoveringSession === session;
  const run = async (operation: () => Promise<unknown>) => {
    if (mutating.current || recoveryPending.current !== null || blocked || completed) return;
    mutating.current = true; setBusy(true); setNotice(null);
    const operationSession = session;
    const current = () => mounted.current && creationSession.current.generation === operationSession;
    try {
      await operation();
      if (!current()) return;
      // The write is confirmed. Remove the completed draft before any refresh.
      setCompletedSession(operationSession); setLocalNew(false);
      const outcome = await completeDecision(async () => {}, () => load(true));
      if (!current()) return;
      const message = outcome.refreshFailed ? 'Research change recorded. The latest record could not be loaded. Reload it before another action.' : 'Research change recorded.';
      if (feedback) feedback(message, outcome.refreshFailed ? 'warning' : 'success');
      else setNotice(message);
      onChanged?.();
    } catch (failure) {
      if (current()) {
        setNotice(failure instanceof Error ? failure.message : 'The change could not be saved.');
        if (failure instanceof ApiError && (failure.status === 403 || failure.status === 409)) setBlockedSession(operationSession);
      }
    } finally { mutating.current = false; if (mounted.current) setBusy(false); }
  };
  const reviewLatest = async () => {
    if (mutating.current || recoveryPending.current !== null || !creationOptions?.profile) return;
    const operationSession = session;
    recoveryPending.current = operationSession; setRecoveringSession(operationSession); setReplaceSession(null);
    try {
      // Fetch separately so a rejected/late read never installs a new baseline.
      const data = await loadResearchAmendmentWorkspace({coordinator:coordinatorView, office:role==='Office Staff/Admin', routeView:routedView, requestId:routeRequestId, studentId:requestStudentId, pageQuery:JSON.parse(pageQuery)});
      if (!mounted.current || creationSession.current.generation !== operationSession) return;
      if (data.options.profile?.studentId !== creationOptions.profile.studentId) throw new Error('The selected research profile is no longer available. Your entered information has been kept.');
      version.current += 1;
      setOptions(data.options); setRows(data.requests); setRevisions(data.revisions); setPagination(data.pagination); setLoadedScope(currentScope.current); setLoading(false); setError(null);
      setCreation(previous => ({session: operationSession, options: data.options, revision: (previous?.revision ?? 0) + 1}));
      setBlockedSession(null); setNotice(null);
    } catch (failure) {
      if (mounted.current && creationSession.current.generation === operationSession) setNotice(failure instanceof Error ? failure.message : 'The latest research record could not be loaded.');
    } finally {
      if (recoveryPending.current === operationSession) recoveryPending.current = null;
      if (mounted.current) setRecoveringSession(value => value === operationSession ? null : value);
    }
  };
  const requestForm = creationOptions && !completed ? <>
    <ResearchAmendmentForm key={`${session}-${creation?.revision}`} initialKind={initialChangeType} options={creationOptions} busy={busy || recovering} blocked={blocked} studentView={studentView} onSave={(kind, values) => void run(() => kind === 'CORRECTION' ? correctResearchProfile({ studentId: creationOptions.profile!.studentId, title: values.title, abstract: values.abstract, reason: values.reason, meaningUnchanged: true, expectedRevision: creationOptions.profile!.revision }) : submitResearchAmendment({ kind, ...(kind === 'TRANSFER' ? { studentId: creationOptions.profile!.studentId, destinationProgramme: values.destinationProgramme } : { title: values.title, abstract: values.abstract }), reason: values.reason }))} />
    {blocked ? <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert"><p className="card-description">Your entered information has been kept. Review the latest record and your access before submitting again.</p><PortalButton disabled={busy || recovering} isLoading={recovering} onClick={() => setReplaceSession(session)}>Review latest record</PortalButton></div> : null}
  </> : completed ? <p className="card-description">This change is complete. Return to the research records to review it.</p> : null;
  const retainedCreation = !!creationOptions && !completed && (routedView === 'new' || localNew || !routedView && studentView);
  const replacementDialog = <PortalConfirmModal isOpen={replaceSession === session} title="Replace entered research information?"
    message="Loading the latest record will replace your entered title, abstract, destination, reason and correction acknowledgement. If loading fails, your entered information will be kept."
    confirmLabel="Replace and review" cancelLabel="Keep editing" isLoading={recovering}
    onCancel={() => setReplaceSession(null)} onConfirm={() => void reviewLatest()} />;
  useRecordDraft(!!edit && (!!reason.trim() || retainTeam), busy);
  const pageLoading = loading || loadedScope !== scope;
  const detailRow = !pageLoading && !error && routedView === 'detail' ? rows.find(row => String(row.id) === routeRequestId) : undefined;
  useEffect(() => { onDetailMetadata?.(detailRow ? <RequestMetadata {...researchRequestMetadata(detailRow)} /> : null); }, [detailRow, onDetailMetadata]);
  useEffect(() => () => onDetailMetadata?.(null), [onDetailMetadata]);
  useEffect(() => { onDetailTitle?.(detailRow ? detailRow.kind === 'TRANSFER' ? 'Programme transfer request' : 'Research change request' : null); }, [detailRow, onDetailTitle]);
  useEffect(() => () => onDetailTitle?.(null), [onDetailTitle]);
  const nextQueue = nextRequestQuery ? JSON.stringify(nextRequestQuery) : '';
  const nextScope = `${scope}:${nextQueue}:${rows.find(row => String(row.id) === routeRequestId)?.updatedAt ?? ''}`;
  useEffect(() => {
    let active = true;
    if (!coordinatorView || routedView !== 'detail' || !nextQueue || pageLoading || busy || edit || !rows.some(row => String(row.id) === routeRequestId)) return;
    setNextRequest({scope:nextScope,target:null,loading:true,error:null});
    void getNextResearchAmendment(JSON.parse(nextQueue), Number(routeRequestId)).then(target => {
      if (active && currentScope.current === scope) setNextRequest({scope:nextScope,target,loading:false,error:null});
    }).catch(() => {
      if (active && currentScope.current === scope) setNextRequest({scope:nextScope,target:null,loading:false,error:'Next request could not be loaded.'});
    });
    return () => { active = false; };
  }, [coordinatorView,routedView,nextQueue,nextScope,pageLoading,busy,edit,rows,routeRequestId,scope]);
  useEffect(() => { onBusyChange?.(pageLoading || busy); }, [onBusyChange, pageLoading, busy]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const heading = routedView === 'detail' ? 'Research change request' : routedView === 'profile' ? 'Research profile' : routedView === 'new' ? 'Request research change' : routedView === 'list' ? transferWorkspace?'Programme transfers':'Research change requests' : compactView ? 'Research change requests' : 'Research amendments and programme transfers';
  const selectAction = (selected: ResearchAmendment, action: Action) => { setEdit({ row: selected, action }); setReason(''); setRetainTeam(false); setNotice(null); };
  const lecturerList = routedView === 'list' && !!onRequestViewChange;
  const studentSelector = !studentView && !(staffPaged && routedView === 'list') && (!routedView || routedView === 'list') && options && options.students.length > 0 && !options.canSubmitResearch ? <label className="form-label min-w-48 flex-1">Student<PortalSelect className={inputClass} value={studentId ?? ''} disabled={busy} onChange={event => { setStudentId(event.target.value ? Number(event.target.value) : undefined); setEdit(null); }}><option value="">{lecturerList ? 'All students' : 'Select a student to view their profile and history'}</option>{options.students.map(student => <option key={student.id} value={student.id}>{student.name} · {student.matricNo} · {student.programme}</option>)}</PortalSelect></label> : null;
  const decide = async () => {
    if (!edit || mutating.current || (edit.action !== 'APPROVE' && !reason.trim()) || (edit.action === 'APPROVE' && edit.row.requiresTeamAcknowledgement && !retainTeam)) return false;
    mutating.current = true; setBusy(true);
    try { return await completeDecision(() => edit.action === 'CANCEL' ? cancelResearchAmendment(edit.row.id, reason.trim()) : decideResearchAmendment(edit.row.id, { decision: edit.action, expectedStatus: edit.row.status, reason: reason.trim(), ...(retainTeam ? { retainTeam: true } : {}) }), async () => { await load(true); onChanged?.(); }); }
    finally { mutating.current = false; if (mounted.current) setBusy(false); }
  };
  const decisionLabel = edit?.action === 'CANCEL' ? 'Cancel request' : `${words(edit?.action ?? 'APPROVE')} ${edit?.row.kind === 'TRANSFER' ? edit.row.status === 'PENDING_DESTINATION_COORDINATOR' ? 'destination programme transfer' : 'source programme transfer' : 'research change'}`;
  const decisionDialog = <DecisionDialog isOpen={!!edit} decisionKey={edit?.row.id} title={decisionLabel} confirmLabel={decisionLabel} tone={edit?.action==='APPROVE'?'info':'danger'}
    kind={edit?.action === 'CANCEL' ? 'confirmation' : 'review'} context={<p>{edit?.row.studentName} · {edit?.row.matricNo} · {edit?.row.sourceProgramme}{edit?.row.kind === 'TRANSFER' ? ` to ${edit.row.destinationProgramme}` : ''}</p>}
    message={edit?.action === 'APPROVE' ? edit.row.kind === 'TRANSFER' ? edit.row.status === 'PENDING_DESTINATION_COORDINATOR' ? 'Approval completes the transfer to the destination programme while retaining the acknowledged team and unfinished tasks.' : 'Approval forwards this transfer to the destination Programme Coordinator for final review.' : 'Approval updates the research profile and records this request in its history.' : edit?.action === 'CANCEL' ? 'This pending request will be cancelled.' : 'This request will be rejected with your reason recorded.'}
    busy={busy} dirty={!!reason.trim() || retainTeam} canConfirm={!!edit && (edit.action === 'APPROVE' || !!reason.trim()) && !(edit.action === 'APPROVE' && edit.row.requiresTeamAcknowledgement && !retainTeam)}
    successMessage="Research change decision recorded." onClose={() => { setEdit(null); setReason(''); setRetainTeam(false); }} onConfirm={decide} onReload={() => load(true)}>
    <label className="form-label block">{edit?.action === 'APPROVE' ? 'Decision note (optional)' : 'Reason (required)'}<textarea className={inputClass} required={edit?.action !== 'APPROVE'} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
    {edit?.action === 'APPROVE' && edit.row.requiresTeamAcknowledgement ? <label className="card-description flex items-start gap-2"><input required type="checkbox" checked={retainTeam} disabled={busy} onChange={event => setRetainTeam(event.target.checked)} />I acknowledge retention of the existing primary supervisor, co-supervisors, panel and {edit.row.unfinishedTaskCount} unfinished evaluation tasks shown in this request.</label> : null}
  </DecisionDialog>;
  const localRecord = rows.find(row => row.id === localDetail);
  return <>{decisionDialog}{replacementDialog}
  {studentView && routedView === 'list' && !pageLoading && !error && options ? <StudentResearchProfileCard options={options} hasPending={rows.some(row=>row.status.startsWith('PENDING'))} onNavigateToProfile={onNavigateToProfile} onNavigateToNew={onNavigateToNew}/> : null}
  <section className={routedView === 'profile' ? 'space-y-7' : routedView === 'detail' || routedView === 'new' ? 'space-y-7' : compactView || routedView ? 'space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' : 'mt-6 space-y-4 border-t border-slate-200 pt-5'} aria-label={routedView === 'profile' ? 'Current research profile' : transferWorkspace && routedView === 'list' ? 'Programme transfer requests' : compactView || routedView ? 'Research change requests' : 'Research amendments and programme transfers'}>
    {!hideHeader && routedView && routedView !== 'list' ? <PortalButton size="sm" onClick={onNavigateToList}>Back to research changes</PortalButton> : null}
    {!hideHeader ? <WorkspaceSectionHeader title={hideHeader ? undefined : heading} description={compactView || routedView ? routedView === 'profile' ? 'View the current research record and saved revisions.' : routedView === 'new' ? 'The primary supervisor makes the final decision on research changes.' : routedView === 'detail' ? 'Compare changed fields and follow the recorded submissions and decisions for this request.' : studentView ? 'Track requests to update your research title or abstract. Open a request to see what changed and who reviewed it.' : transferWorkspace ? 'Review programme transfers awaiting your decision, or view final transfer outcomes.' : 'Review research changes and follow their recorded progress and outcomes.' : undefined}
      actions={<>{lecturerList && onRequestViewChange ? <RequestViewSwitch view={requestView} reviewCount={pageLoading || error ? 0 : (pagination?.reviewCount ?? rows.filter(row => requestGroup(researchReviewStatus(row), row.canDecide) === 'review').length)} onChange={onRequestViewChange} /> : null}</>} /> : null}
    {notice ? <p role="status" className="card-description rounded-lg bg-slate-50 p-3">{notice}</p> : null}
    {staffPaged && routedView === 'list' && onResearchFilter ? <CoordinatorResearchFilters query={JSON.parse(pageQuery)} pagination={pagination} onFilter={onResearchFilter} transferOnly={transferWorkspace} /> : null}
    {error && retainedCreation ? <ErrorState message={error} onRetry={() => void load()} /> : null}
    {pageLoading && !retainedCreation ? <LoadingState message={transferWorkspace?'Loading programme transfers…':'Loading research changes…'} /> : error && !retainedCreation ? <ErrorState message={error} onRetry={() => void load()} /> : options ? <>
      {!staffPaged && lecturerList && onRequestSearch ? <RequestFilters onReset={onRequestReset ?? (()=>{onRequestSearch('');setStudentId(undefined);onRequestPage?.(1);setEdit(null);})} search={requestSearch} onSearch={onRequestSearch}>{studentSelector}{studentId ? <PortalButton size="sm" onClick={() => onNavigateToProfile?.()}>View research profile</PortalButton> : null}</RequestFilters> : studentSelector ? <div className="flex flex-wrap items-end gap-3">{studentSelector}</div> : null}
      {!routedView ? studentView ? creationOptions?.canSubmitResearch ? <details><summary className="card-value cursor-pointer text-blue-600">Request a research change</summary><div className="mt-3">{requestForm}</div></details> : rows.some(row => row.status.startsWith('PENDING')) ? <p className="card-description rounded-lg bg-slate-50 p-3">You have a request awaiting a decision. You can submit another after it is resolved.</p> : null : (options.canCorrect || options.canTransfer || options.canSubmitResearch) ? <PortalButton disabled={busy} onClick={() => { setCreationEpoch(value => value + 1); setLocalNew(true); }}>Request research change</PortalButton> : null : null}
      {coordinatorView && routedView === 'detail' && nextQueue && onNavigateToNextRequest ? <ResearchNextRequestControl nextId={nextRequest.scope === nextScope ? nextRequest.target?.id ?? null : null} loading={nextRequest.loading} disabled={pageLoading || busy || !!edit} error={nextRequest.scope === nextScope ? nextRequest.error : null} onNext={() => { if (!busy && !edit && !pageLoading && nextRequest.scope === nextScope && !nextRequest.loading && nextRequest.target) onNavigateToNextRequest(String(nextRequest.target.id),nextRequest.target.page); }} /> : null}
      {routedView ? <ResearchAmendmentRouteContent routeView={routedView} routeRequestId={routeRequestId} role={role} options={routedView === 'new' && creationOptions ? creationOptions : options} rows={rows} revisions={revisions} busy={busy} onAction={selectAction} requestForm={requestForm} onNavigateToRequest={onNavigateToRequest} onNavigateToProfile={onNavigateToProfile} onNavigateToNew={onNavigateToNew} requestView={requestView} requestSearch={requestSearch} requestPage={requestPage} requestPageSize={requestPageSize} onRequestPage={onRequestPage} onRequestPageSize={onRequestPageSize} pagination={pagination} researchFilters={researchFilters} /> : <>
        {compactView ? rows.map(row => <ResearchAmendmentCard key={row.id} row={row} studentView={studentView} lecturerView={lecturerView} busy={busy} onAction={selectAction} />) : <WorkspaceRecordTable label="Research change request records" rows={rows.map(row => researchWorkspaceRecord(row, busy, () => setLocalDetail(row.id)))} />}
        {!rows.length ? <p className="card-description">No research amendment or transfer requests to display.</p> : null}
        {revisions.length ? <details><summary className="card-value cursor-pointer">{compactView ? 'Research profile history' : 'Research revision history'} ({revisions.length})</summary>{studentView ? <p className="card-description mt-2">Saved research profiles, including your initial record and approved changes.</p> : null}<div className="mt-3 space-y-3">{revisions.map(revision => <ResearchRevisionCard key={revision.id} revision={revision} studentView={studentView} lecturerView={lecturerView} />)}</div></details> : null}
      </>}
    </> : null}
  </section>
  {routedView === 'profile' && !pageLoading && !error && options?.profile ? <ResearchProfileHistoryCard key={`${role}:${options.profile.studentId}`} revisions={revisions} studentView={studentView} /> : null}
  {!compactView && localDetail !== null ? <RecordPage title={localRecord?.kind === 'TRANSFER' ? 'Programme transfer request' : 'Research change request'} backLabel="Back to Supervisor Appointments" onBack={() => { setLocalDetail(null); setEdit(null); setReason(''); setRetainTeam(false); }} pageKey={`staff-research:${localDetail}`} metadata={!pageLoading && !error && localRecord ? <RequestMetadata {...researchRequestMetadata(localRecord)} /> : undefined} dirty={!!edit && (!!reason.trim() || retainTeam)} busy={busy}>
    {notice ? <p role="status" className="card-description">{notice}</p> : null}
    {pageLoading ? <LoadingState message="Loading research changes…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : localRecord ? <><ResearchAmendmentCard row={localRecord} busy={busy} onAction={selectAction} presentation="detail" /></> : <p className="card-description">This request is unavailable or outside your authorised scope.</p>}
  </RecordPage> : null}
  {!compactView && localNew ? <RecordPage title="Request research change" backLabel="Back to Supervisor Appointments" onBack={() => setLocalNew(false)} pageKey="staff-research-new" busy={busy}>{requestForm}{notice ? <p role="status" className="card-description">{notice}</p> : null}</RecordPage> : null}
  </>;
}
