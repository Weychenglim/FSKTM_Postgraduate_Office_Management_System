import { PortalSelect } from './PortalSelect';
import { DecisionDialog } from './DecisionDialog';
import { completeDecision } from '../utils/decisionSubmission';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import { RecordPage } from './RecordPage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  FileSearch,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

import type {
  ReconciliationAcceptance,
  ReconciliationAllowedResolution,
  ReconciliationFilters,
  ReconciliationIssue,
  ReconciliationListResponse,
  ReconciliationPreview,
} from '../types';
import {
  acceptReconciliationIssue,
  applyReconciliationIssue,
  getReconciliationIssues,
  previewReconciliationIssue,
} from '../services/workflowReconciliationApi';
import {
  reconciliationErrorMessage,
  reconciliationExplanation,
  reconciliationIdentity,
  reconciliationListSummary,
  reconciliationRepairDetails,
  reconciliationRecordRoute,
  resolutionPayload,
} from '../utils/workflowReconciliation';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { PageHeader, PortalButton, StatusBadge } from './PortalPrimitives';
import { APP_ROUTES } from '../constants/routes';
import { OfficeToolSection } from './OfficeToolPrimitives';
import { CoordinatorDataTable } from './CoordinatorBrowsePrimitives';
import { AppointmentViewSwitch, WorkspaceFilterCard, WorkspacePagination } from './RequestWorkspacePrimitives';
import { AppointmentSummaryCard } from './AppointmentPrimitives';
import { ReconciliationEvidence, ReconciliationAuditHistory, humanizeReconciliationLabel } from './ReconciliationEvidence';
export { humanizeReconciliationLabel } from './ReconciliationEvidence';

interface WorkflowReconciliationCentreProps {
  onBack: () => void;
  backLabel?: string;
  onNavigateToRoute: (route: string) => void;
  onOpenCapacity?: () => void;
}

const humanize = humanizeReconciliationLabel;

const capacityIssueTypes = new Set(['CAPACITY_PLAN_MISSING', 'CAPACITY_MULTIPLE_PUBLISHED', 'CAPACITY_PLAN_INCOMPLETE', 'CAPACITY_ENTRY_ROLE_MISMATCH', 'CAPACITY_LEGACY_LIMIT_DIVERGENCE', 'CAPACITY_AVAILABILITY_OVERLAP']);
export function reconciliationOwningRoute(issue: ReconciliationIssue) {
  if (capacityIssueTypes.has(issue.issueType)) {
    const semesterId = issue.currentState?.semesterId;
    return `${APP_ROUTES.dashboardLecturerCapacity}${typeof semesterId === 'number' && Number.isSafeInteger(semesterId) && semesterId > 0 ? `?semester=${semesterId}` : ''}`;
  }
  return reconciliationRecordRoute(issue.navigation.targetModule, issue.navigation.recordType, issue.navigation.recordId);
}

export const WorkflowReconciliationCentre: React.FC<WorkflowReconciliationCentreProps> = ({
  onBack,
  backLabel = 'Back to Office Dashboard',
  onNavigateToRoute,
  onOpenCapacity,
}) => {
  const [data, setData] = useState<ReconciliationListResponse | null>(null);
  const [filters, setFilters] = useState<ReconciliationFilters>({ page: 1, pageSize: 10 });
  const [preview, setPreview] = useState<ReconciliationPreview | null>(null);
  const [requestedIssue, setRequestedIssue] = useState<ReconciliationIssue | null>(null);
  const previewVersion = useRef(0);
  const listVersion = useRef(0);
  const [repairApplied, setRepairApplied] = useState(false);
  const [acceptedApplied, setAcceptedApplied] = useState<ReconciliationAcceptance | null>(null);
  const [decisionMode, setDecisionMode] = useState<'repair' | 'accept'>('repair');
  const [selectedResolution, setSelectedResolution] = useState<ReconciliationAllowedResolution | null>(null);
  const [programme, setProgramme] = useState('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const load = useCallback(async (propagateError = false) => {
    const version = ++listVersion.current;
    let correctingPage = false;
    setLoading(true);
    setError(null);
    try {
      const issues = await getReconciliationIssues(filters);
      if (version !== listVersion.current) return;
      const lastPage = Math.max(1, Math.ceil(issues.count / issues.pageSize));
      if (issues.page > lastPage) {
        correctingPage = true;
        setFilters(current => ({ ...current, page: lastPage }));
        return;
      }
      setData(issues);
    } catch (loadError) {
      if (version === listVersion.current) setError(reconciliationErrorMessage(loadError));
      if (propagateError) throw loadError;
    } finally {
      if (version === listVersion.current && !correctingPage) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => { window.clearTimeout(timer); listVersion.current += 1; };
  }, [load]);

  useReturnToFocusReload(() => void load(), !loading && !saving && !previewing && !requestedIssue && !reason.trim());
  const openIssue = async (issue: ReconciliationIssue, propagateError = false) => {
    const version = ++previewVersion.current;
    const sameIssue = requestedIssue?.issueId === issue.issueId;
    setRequestedIssue(issue);
    setPreviewing(true);
    setDrawerError(null);
    setConfirmed(false);
    if (!sameIssue) {
      setRepairApplied(false);
      setAcceptedApplied(null);
      setDecisionMode('repair');
      setPreview(null);
      setSelectedResolution(null);
      setReason('');
      setProgramme(issue.programme ?? '');
    }
    try {
      const response = await previewReconciliationIssue(issue.issueId);
      if (version !== previewVersion.current) return;
      setPreview(response);
      setSelectedResolution(current => (sameIssue && response.allowedResolutions.find(item => item.action === current?.action)) || response.allowedResolutions[0] || null);
    } catch (previewError) {
      if (version === previewVersion.current) setDrawerError(reconciliationErrorMessage(previewError));
      if (propagateError) throw previewError;
    } finally {
      if (version === previewVersion.current) setPreviewing(false);
    }
  };

  const closePreview = () => {
    previewVersion.current += 1;
    setRequestedIssue(null);
    setRepairApplied(false);
    setAcceptedApplied(null);
    setPreviewing(false);
    setPreview(null);
    setSelectedResolution(null);
    setReason('');
    setConfirmed(false);
    setDrawerError(null);
  };

  const applyRepair = async () => {
    if (repairApplied || !preview || !selectedResolution || !reason.trim() || !confirmed) return false;
    setSaving(true);
    try {
      return await completeDecision(async () => {
        await applyReconciliationIssue(preview.issue.issueId, {
          expectedFingerprint: preview.issue.fingerprint, reason: reason.trim(),
          resolution: resolutionPayload(selectedResolution, programme),
        });
        setRepairApplied(true); setReason(''); setConfirmed(false);
      }, () => load(true));
    } finally { setSaving(false); }
  };

  const acceptWarning = async () => {
    if (acceptedApplied || preview?.issue.acceptance || !preview?.canAccept || !reason.trim() || !confirmed) return false;
    setSaving(true);
    try {
      return await completeDecision(async () => {
        const response = await acceptReconciliationIssue(preview.issue.issueId, { expectedFingerprint: preview.issue.fingerprint, reason: reason.trim() });
        setAcceptedApplied(response.acceptance); setReason(''); setConfirmed(false);
      }, () => load(true));
    } finally { setSaving(false); }
  };

  const updateFilters = (next: React.SetStateAction<ReconciliationFilters>) => {
    listVersion.current += 1;
    setLoading(true);
    setFilters(next);
  };
  const setFilter = (key: keyof ReconciliationFilters, value: string) => updateFilters(current => ({ ...current, [key]: value || undefined, page: 1 }));

  const pageCount = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;
  const acceptance = acceptedApplied ?? preview?.issue.acceptance;
  const acceptedView = filters.reviewStatus === 'ACCEPTED';
  const canAccept = Boolean(!acceptedApplied && !preview?.issue.acceptance && !previewing && !drawerError && preview?.canAccept && reason.trim() && confirmed);
  const canApply = Boolean(
    !repairApplied && !acceptance && !previewing && !drawerError
    && preview?.issue.repairability === 'REPAIRABLE'
    && selectedResolution
    && reason.trim()
    && confirmed
    && (!selectedResolution?.requiresProgramme || programme),
  );
  const owningRoute = preview ? reconciliationOwningRoute(preview.issue) : null;
  const explanation = preview ? reconciliationExplanation(preview.issue) : null;
  const identity = preview ? reconciliationIdentity(preview.issue) : null;
  const repairDetails = preview ? reconciliationRepairDetails(preview.issue, selectedResolution, programme) : [];
  const changePage = (page: number) => updateFilters(current => ({ ...current, page }));
  const filterActive = Boolean(filters.search || filters.module || filters.severity || filters.repairability || filters.programme);
  const rows = data?.results.map(issue => {
    const identity = reconciliationIdentity(issue);
    const summary = reconciliationListSummary(issue);
    const context = issue.studentId ? `${humanize(issue.recordType)} #${issue.recordId}` : identity.context;
    return { key: issue.issueId, cells: [
      <><p className="card-value">{summary.title}</p>{summary.fact && <p className="card-description mt-1">{summary.fact}</p>}</>,
      <><p className="card-value">{identity.name}</p>{context && <p className="card-description mt-1">{context}</p>}{issue.module === 'WORKFLOW_TRACKING' && !capacityIssueTypes.has(issue.issueType) && <p className="card-description mt-1">{humanize(issue.module)}</p>}</>,
      <StatusBadge tone={issue.severity === 'BLOCKING' ? 'danger' : 'warning'}>{humanize(issue.severity)}</StatusBadge>,
      issue.acceptance ? <StatusBadge tone="neutral">Accepted</StatusBadge> : <p className="card-description">{issue.repairability === 'REPAIRABLE' ? 'Repair available' : 'Source review'}</p>,
      <PortalButton size="sm" onClick={() => void openIssue(issue)} aria-label={`Review ${issue.title} for ${identity.name}`}>Review issue</PortalButton>,
    ] };
  }) ?? [];

  return (
    <div className="reconciliation-workspace space-y-6 pb-16 text-left">
      <DecisionDialog isOpen={confirmOpen} kind="confirmation" decisionKey={`${preview?.issue.issueId}:${decisionMode}`}
        title={decisionMode === 'accept' ? 'Accept this warning as intentional?' : 'Apply this audited repair?'} context={<div><p>{preview?.issue.title}</p>{decisionMode === 'accept' && <p className="card-description mt-1">{identity?.name}</p>}</div>}
        message={decisionMode === 'accept' ? <><p>This records your review without correcting the underlying record. The warning returns if the evidence changes.</p></> : <><p>{selectedResolution?.label} will change this record and create permanent repair audit history.</p>
          <ReconciliationRepairSummary details={repairDetails} /><p>Reason: {reason}</p></>}
        confirmLabel={decisionMode === 'accept' ? 'Accept as intentional' : 'Apply audited repair'} successMessage={decisionMode === 'accept' ? 'Warning accepted and recorded in history.' : 'Repair completed and recorded in audit history.'}
        canConfirm={decisionMode === 'accept' ? canAccept : canApply} busy={saving} dirty={decisionMode === 'accept' && (!!reason.trim() || confirmed)} onConfirm={decisionMode === 'accept' ? acceptWarning : applyRepair} onClose={() => {
          setConfirmOpen(false);
          if (decisionMode === 'accept') { setReason(''); setConfirmed(false); }
        }}
        onReload={async () => { if (preview) await openIssue(preview.issue, true); }}>
        {decisionMode === 'accept' && <div className="space-y-5">
          <label className="form-label">Reason for acceptance<textarea className="form-control form-control-md mt-2 min-h-24" placeholder="Explain what you verified and why no correction is needed." value={reason} onChange={event => setReason(event.target.value)} /></label>
          <label className="card-description flex items-start gap-3"><input type="checkbox" className="mt-0.5 shrink-0" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the evidence and accept this warning as an intentional exception.</span></label>
        </div>}
      </DecisionDialog>
      <PageHeader className="office-tool-heading" title="Workflow reconciliation"
        subtitle="Review records that have missing links or conflicting workflow information."
        backLabel={backLabel} onBack={onBack}
        actions={<>
          {onOpenCapacity && <PortalButton size="sm" icon={Gauge} onClick={onOpenCapacity}>Lecturer capacity</PortalButton>}
          <PortalButton size="sm" icon={RefreshCw} onClick={() => void load()} disabled={loading}>Recheck records</PortalButton>
        </>} />
      <div className="space-y-3">
        {!loading && !error && data?.checkedAt && <p className="card-description">Checked {new Date(data.checkedAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })} (Malaysia time)</p>}
        <details className="reconciliation-check-help">
          <summary className="card-value cursor-pointer">How are issues flagged?</summary>
          <div className="reconciliation-check-copy card-description mt-3 space-y-2">
            <p><strong>When:</strong> checks run when you load, filter or recheck this page, and when you open an issue.</p>
            <p><strong>Meaning:</strong> warnings need review; blocking issues can hold up a workflow. Approved capacity increases are not issues.</p>
            <p><strong>Changes:</strong> reading never changes records. Repairs and acceptance require a reason and confirmation. Accepted warnings return if evidence changes.</p>
          </div>
        </details>
      </div>
      {!loading && !error && data && <section aria-label="Reconciliation summary" className="space-y-3">
        <p className="card-description">Across all modules. Filters narrow the issue list below.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <AppointmentSummaryCard title="Open issues" icon={ClipboardList} value={data.summary.total} description={`${data.summary.blocking} blocking; ${data.summary.warnings} warnings.`} />
          <AppointmentSummaryCard title="Repair available" icon={Wrench} value={data.summary.repairable} description="A verified repair can be reviewed here." />
          <AppointmentSummaryCard title="Source review" icon={FileSearch} value={data.summary.reviewRequired} description="Review in the owning module or with a system administrator." />
        </div>
      </section>}
      <OfficeToolSection title={acceptedView ? 'Accepted warnings' : 'Issues to review'} icon={acceptedView ? ShieldCheck : ClipboardList} actions={<AppointmentViewSwitch
        label="Reconciliation views" currentLabel="Open issues" pastLabel="Accepted warnings" view={acceptedView ? 'past' : 'current'}
        onChange={view => updateFilters(current => ({ ...current, reviewStatus: view === 'past' ? 'ACCEPTED' : 'OPEN', page: 1 }))} />}>
        <div className="space-y-5 p-5">
          <WorkspaceFilterCard onReset={() => updateFilters({ page: 1, pageSize: filters.pageSize, reviewStatus: filters.reviewStatus })}>
            <label className="form-label sm:col-span-2 xl:col-span-4">Find an issue
              <input type="search" className="form-control form-control-md mt-1" placeholder="Issue, lecturer, staff number, student or semester"
                value={filters.search ?? ''} onChange={event => setFilter('search', event.target.value)} />
            </label>
            <label className="form-label">Module<PortalSelect className="form-control form-control-md mt-1" value={filters.module ?? ''} onChange={event => setFilter('module', event.target.value)}>
              <option value="">All modules</option><option value="DASHBOARD">Dashboard / Timeline</option>
              <option value="SUPERVISOR_APPOINTMENTS">Supervisor appointments</option><option value="PANEL_APPOINTMENTS">Panel appointments</option>
              <option value="MARKS">Marks</option><option value="WORKFLOW_TRACKING">Workflow and capacity</option>
            </PortalSelect></label>
            <label className="form-label">Severity<PortalSelect className="form-control form-control-md mt-1" value={filters.severity ?? ''} onChange={event => setFilter('severity', event.target.value)}>
              <option value="">All severities</option><option value="BLOCKING">Blocking</option><option value="WARNING">Warning</option>
            </PortalSelect></label>
            <label className="form-label">Next step<PortalSelect className="form-control form-control-md mt-1" value={filters.repairability ?? ''} onChange={event => setFilter('repairability', event.target.value)}>
              <option value="">All next steps</option><option value="REPAIRABLE">Repair available</option><option value="REVIEW_REQUIRED">Source review</option>
            </PortalSelect></label>
            <label className="form-label">Programme<PortalSelect className="form-control form-control-md mt-1" value={filters.programme ?? ''} onChange={event => setFilter('programme', event.target.value)}>
              <option value="">All programmes</option>{data?.availableProgrammes.map(item => <option key={item} value={item}>{item}</option>)}
            </PortalSelect></label>
          </WorkspaceFilterCard>
          {loading ? <LoadingState message="Checking saved workflow records…" />
            : error ? <ErrorState message={error} onRetry={() => void load()} />
            : !data?.results.length ? <EmptyState title={filterActive ? 'No matching issues' : acceptedView ? 'No accepted warnings' : 'No issues found'} description={filterActive ? 'Try changing or clearing the filters.' : acceptedView ? 'Accepted warnings appear here while the reviewed evidence is unchanged.' : 'The current checks found no inconsistencies in the saved records.'} />
            : <>
              <p className="card-description">Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.count)} of {data.count} issues</p>
              <CoordinatorDataTable label="Reconciliation issues" columns={['Issue', 'Affected record', 'Severity', 'Next step', 'Action']} rows={rows} />
              <WorkspacePagination page={data.page} pageCount={pageCount} total={data.count} noun="issues" pageSize={data.pageSize}
                onPage={changePage} onPageSize={pageSize => updateFilters(current => ({ ...current, page: 1, pageSize }))} />
            </>}
        </div>
      </OfficeToolSection>
      {requestedIssue && <RecordPage title={preview?.issue.title ?? requestedIssue.title} backLabel="Back to Workflow Reconciliation" onBack={closePreview}
        pageKey="reconciliation-review" dirty={!!reason.trim() || confirmed} busy={saving}>
        {drawerError && <ErrorState compact title="Unable to validate this issue" message={drawerError} onRetry={() => void openIssue(requestedIssue)} />}
        {previewing && !preview ? <LoadingState message="Validating current issue state…" /> : preview && explanation && identity && <div className="reconciliation-review space-y-5">
          {!repairApplied && <OfficeToolSection title={identity.name} description={identity.context} actions={<StatusBadge tone={preview.issue.severity === 'BLOCKING' ? 'danger' : 'warning'} icon={AlertTriangle}>{humanize(preview.issue.severity)}</StatusBadge>}>
            <div className="space-y-6 p-5">
              <div className="space-y-2"><h3 className="section-heading">Why this was flagged</h3><p className="card-description text-slate-700">{explanation.why}</p></div>
              <div className="reconciliation-effect"><h3 className="card-value">What this affects</h3><p className="card-description mt-2">{explanation.effect}</p></div>
              <ReconciliationEvidence issue={preview.issue} />
            </div>
          </OfficeToolSection>}
          {repairApplied ? <OfficeToolSection title="Repair completed" description={`${identity.name}: the change has been saved and recorded in repair history.`} actions={<StatusBadge tone="success">Saved</StatusBadge>}>
            <div className="p-5"><PortalButton onClick={closePreview}>Return to issues</PortalButton></div>
          </OfficeToolSection> : acceptance ? <OfficeToolSection title="Accepted as intentional" actions={<StatusBadge tone="neutral">Accepted</StatusBadge>}>
            <div className="space-y-4 p-5">
              <p className="card-description">Reviewed by {acceptance.actor.name} on {new Date(acceptance.createdAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })} (Malaysia time).</p>
              <div><h3 className="card-value">Reason</h3><p className="card-description mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{acceptance.reason}</p></div>
              <p className="card-description">The underlying record was not changed. This warning returns to Open issues if the evidence changes.</p>
              <PortalButton onClick={closePreview}>Return to issues</PortalButton>
            </div>
          </OfficeToolSection> : <OfficeToolSection title={preview.issue.repairability === 'REPAIRABLE' ? 'Review the proposed repair' : 'Recommended next step'}>
            <div className="space-y-5 p-5">
              <p className="card-description">{explanation.next}</p>
              {preview.issue.dependencies.length > 0 && <ul className="card-description list-disc space-y-2 pl-5">{preview.issue.dependencies.map(item => <li key={item}>{item}</li>)}</ul>}
              {owningRoute && <PortalButton icon={ArrowUpRight} disabled={saving} onClick={() => onNavigateToRoute(owningRoute)}>{explanation.actionLabel}</PortalButton>}
              {preview.issue.repairability === 'REPAIRABLE' && preview.allowedResolutions.length > 0 ? <fieldset disabled={saving || previewing || !!drawerError} className="min-w-0 space-y-5 border-t border-slate-200 pt-5">
                <label className="form-label">Proposed change<PortalSelect className="form-control form-control-md mt-2" value={selectedResolution?.action ?? ''} onChange={event => setSelectedResolution(preview.allowedResolutions.find(item => item.action === event.target.value) ?? null)}>
                  {preview.allowedResolutions.map(item => <option key={item.action} value={item.action}>{item.label}</option>)}
                </PortalSelect></label>
                <ReconciliationRepairSummary details={repairDetails} />
                {selectedResolution?.requiresProgramme && <label className="form-label">Managed programme<PortalSelect className="form-control form-control-md mt-2" value={programme} onChange={event => setProgramme(event.target.value)}>
                  <option value="">Select managed programme</option>{data?.availableProgrammes.map(item => <option key={item} value={item}>{item}</option>)}
                </PortalSelect></label>}
                <label className="form-label">Reason for repair<textarea className="form-control form-control-md mt-2 min-h-24" placeholder="Explain what you verified and why this repair is appropriate." value={reason} onChange={event => setReason(event.target.value)} /></label>
                <label className="card-description flex items-start gap-3"><input type="checkbox" className="mt-0.5 shrink-0" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I confirm this individual repair after reviewing the current state and affected identifiers.</span></label>
                <PortalButton variant="primary" icon={Wrench} isLoading={saving} disabled={!canApply} onClick={() => { setDecisionMode('repair'); setConfirmOpen(true); }}>Review and confirm repair</PortalButton>
              </fieldset> : preview.canAccept ? <div className="flex justify-end border-t border-slate-200 pt-4">
                <PortalButton size="sm" icon={ShieldCheck} className="w-full sm:w-auto" disabled={saving || previewing || !!drawerError} onClick={() => { setDecisionMode('accept'); setConfirmOpen(true); }}>Accept as intentional</PortalButton>
              </div> : <p className="card-description flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />Review required. No automatic repair is offered for this check.</p>}
            </div>
          </OfficeToolSection>}
          <ReconciliationAuditHistory key={`${preview.issue.issueId}:${repairApplied}:${acceptance?.id ?? ''}`} issue={preview.issue} />
        </div>}
      </RecordPage>}
    </div>
  );
};

function ReconciliationRepairSummary({ details }: { details: { label: string; value: string }[] }) {
  return details.length ? <dl className="my-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
    {details.map(item => <div key={item.label} className="min-w-0"><dt className="card-description">{item.label}</dt><dd className="card-value mt-1 [overflow-wrap:anywhere]">{item.value}</dd></div>)}
  </dl> : null;
}
