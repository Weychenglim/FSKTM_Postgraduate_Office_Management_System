import { PortalSelect } from './PortalSelect';
import { AlertMessage } from './AlertMessage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UserRound,
  Clock3,
  Download,
  FileSpreadsheet,
  ShieldAlert,
} from 'lucide-react';

import type {
  ReportModuleSummary,
  UserRole,
  WorkflowReport,
  WorkflowReportFilters,
  WorkflowReportAttentionItem,
} from '../types';
import { downloadWorkflowReport, getWorkflowReport } from '../services';
import {
  formatReportMetric,
  buildWorkflowReportQuery,
  getLecturerReportMetrics,
  canOpenReportDossier,
  reportLabel,
  resolveWorkflowReportRecordRoute,
} from '../utils/workflowReports';
import { APP_ROUTES, routeForStudentProgress } from '../constants/routes';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { useListState } from './ListState';
import { WorkspaceFilterCard } from './RequestWorkspacePrimitives';
import {
  PageHeader,
  PortalButton,
  PortalCard,
  PortalToast,
  StatusBadge,
} from './PortalPrimitives';

interface WorkflowReportsProps {
  currentUserRole: UserRole;
  onBack: () => void;
  onNavigateToRoute: (route: string) => void;
  onOpenReconciliation?: () => void;
  onOpenDossier?: (studentId: string) => void;
}

export function ReportAttentionState({ item }: { item: WorkflowReportAttentionItem }) {
  if (item.kind === 'LECTURER_CAPACITY') return <>{reportLabel(item.capacityState ?? 'Capacity review')}{item.capacityRole ? ` · ${reportLabel(item.capacityRole)}` : ''}</>;
  if (item.kind === 'WAITING') return <>{item.waitingDays ?? 0} days - {reportLabel(item.waitingOn ?? 'Waiting')}</>;
  if (item.kind === 'PARTICIPANT_LIFECYCLE') return <>{reportLabel(item.participantStatus ?? 'Lifecycle review')}</>;
  if (item.kind === 'RECONCILIATION') return <>Blocking data inconsistency</>;
  return <>{item.dueAt && item.deadlineState === 'OVERDUE' ? `Overdue - ${item.dueAt}` : item.dueAt ? `${reportLabel(item.deadlineState ?? 'Deadline')} - ${item.dueAt}` : 'Deadline not recorded'}</>;
}

function useReportViewState<T>(office: boolean, field: string, initial: T) {
  const stored = useListState('OfficeWorkflowReports', field, initial);
  const local = useState(initial);
  return office ? stored : local;
}

export function getOfficeReportAttentionPage(items: WorkflowReportAttentionItem[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / 10));
  const page = Math.min(pageCount, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  return { page, pageCount, rows: items.slice((page - 1) * 10, page * 10) };
}

export function OfficeReportBreakdown({ report, section, onNavigate }: { report: WorkflowReport; section: string; onNavigate: (route: string) => void }) {
  if (section === 'attention') return null;
  if (section === 'appointments') return <section aria-label="Appointment workflow breakdowns" className="space-y-5">
    {report.supervisor && <WorkflowSection title="Supervisor appointments" summary={report.supervisor} />}
    {report.panel && <WorkflowSection title="Panel appointments" summary={report.panel} />}
    {report.researchAmendments && <WorkflowSection title="Research amendments and transfers" summary={report.researchAmendments} />}
    {!report.supervisor && !report.panel && !report.researchAmendments && <EmptyState title="No appointment breakdowns" description="No authorised appointment summaries are available for these filters." />}
  </section>;
  if (section === 'evaluations') return report.marks ? <PortalCard padding="md">
    <h2 className="section-label mb-4">Evaluations</h2>
    <p className="card-description mb-5">{report.marks.total} tasks · {report.overview.overdueMarks} overdue against recorded deadlines.</p>
    <div className="grid gap-6 lg:grid-cols-3"><Distribution title="Task status" values={report.marks.statusCounts} total={report.marks.total} /><Distribution title="Deadline state" values={report.marks.deadlineStateCounts} total={report.marks.total} /><Distribution title="Evaluator role" values={report.marks.evaluatorRoleCounts} total={report.marks.total} /></div>
  </PortalCard> : <EmptyState title="No evaluations in scope" description="No evaluation summary is available for the applied filters." />;
  if (section === 'calendar') return report.timeline ? <PortalCard padding="md">
    <h2 className="section-label mb-4">Calendar entries</h2><p className="card-description mb-5">Current calendar state; an ended event does not confirm completion of student work.</p>
    <div className="grid gap-6 lg:grid-cols-3"><Distribution title="Calendar status" values={Object.fromEntries(Object.entries(report.timeline.statusCounts).map(([key, value]) => [key === 'COMPLETED' ? 'ENDED' : key, value]))} total={report.timeline.total} /><Distribution title="Research project" values={report.timeline.levelCounts} total={report.timeline.total} /><Distribution title="Audience" values={report.timeline.targetRoleCounts} total={report.timeline.total} /></div>
  </PortalCard> : <EmptyState title="No calendar entries in scope" description="No calendar summary is available for the applied filters." />;
  return <PortalCard padding="md" className="space-y-5">
    <h2 className="section-label">Office capacity</h2>
    {report.capacity ? <>
      <p className="card-description">Faculty-wide lecturer role entries for {report.capacity.semesterCode}. Programme and report date filters do not narrow this capacity summary. A lecturer with both roles appears in each role count. Workload occupation spans semesters.</p>
      <div className="grid gap-6 lg:grid-cols-2"><Distribution title="Supervisor role entries" values={report.capacity.supervisor} total={Object.values(report.capacity.supervisor).reduce((sum, count) => sum + count, 0)} /><Distribution title="Panel role entries" values={report.capacity.panel} total={Object.values(report.capacity.panel).reduce((sum, count) => sum + count, 0)} /></div>
      <PortalButton size="sm" onClick={() => onNavigate(`${APP_ROUTES.dashboardLecturerCapacity}?semester=${report.capacity?.semesterId}`)}>Review capacity</PortalButton>
    </> : <p className="card-description">Choose a specific semester or the active semester to see the available faculty capacity summary.</p>}
  </PortalCard>;
}

const Distribution: React.FC<{
  title: string;
  values: Record<string, number>;
  total: number;
}> = ({ title, values, total }) => (
  <div className="space-y-3">
    <h4 className="section-label">{title}</h4>
    {Object.keys(values).length === 0 ? (
      <p className="card-description">No records in this range.</p>
    ) : (
      Object.entries(values).map(([label, count]) => {
        const width = total > 0 ? Math.min(100, Math.max(0, (count / total) * 100)) : 0;
        return (
          <div key={label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="card-value">{reportLabel(label)}</span>
              <span className="card-value">{count}</span>
            </div>
            <div className="h-2 rounded bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-600 rounded" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })
    )}
  </div>
);

const WorkflowSection: React.FC<{
  title: string;
  summary: ReportModuleSummary;
}> = ({ title, summary }) => (
  <PortalCard padding="md" className="rounded-lg">
    <div className="flex items-center justify-between gap-4 mb-5">
      <div>
        <h3 className="section-label">{title}</h3>
        <p className="card-description mt-1">
          Current persisted lifecycle records
        </p>
      </div>
      <StatusBadge tone="info">{summary.total} records</StatusBadge>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Distribution title="Lifecycle status" values={summary.statusCounts} total={summary.total} />
      <Distribution title="Waiting owner" values={summary.waitingOwnerCounts} total={summary.total} />
      <Distribution title="Age bands (calendar days)" values={summary.ageBands} total={summary.total} />
    </div>
  </PortalCard>
);

export function LecturerReportSummary({ report, onNavigateToRoute }: {
  report: WorkflowReport;
  onNavigateToRoute: (route: string) => void;
}) {
  return (
    <section aria-label="Your workflow actions" className="grid gap-4 md:grid-cols-3">
      {getLecturerReportMetrics(report).map(card => (
        <PortalCard key={card.id} className="space-y-3">
          <h2 className="card-label">{card.label}</h2>
          <p className="card-metric">{card.value}</p>
          <p className="card-description">{card.description}</p>
          {card.id === 'waiting' ? (
            <a href="#workflow-attention" className="card-value inline-block rounded text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy">
              View waiting records
            </a>
          ) : (
            <PortalButton size="sm" onClick={() => onNavigateToRoute(APP_ROUTES.marks)}>
              Open Marks Entry
            </PortalButton>
          )}
        </PortalCard>
      ))}
    </section>
  );
}

export const WorkflowReports: React.FC<WorkflowReportsProps> = ({
  currentUserRole,
  onBack,
  onNavigateToRoute,
  onOpenReconciliation,
  onOpenDossier,
}) => {
  const office = currentUserRole === 'Office Staff/Admin';
  const [report, setReport] = useState<WorkflowReport | null>(null);
  const [filters, setFilters] = useReportViewState<WorkflowReportFilters>(office, 'filters', { semester: 'active' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const validationError = filters.startDate && filters.endDate && filters.startDate > filters.endDate
    ? 'End date must be on or after start date.' : null;
  const requestGeneration = useRef(0);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const reportQuery = buildWorkflowReportQuery(filters);
  const reportPending = loading || (!validationError && !error && loadedQuery !== reportQuery);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');
  const [attentionPage, setAttentionPage] = useReportViewState(office, 'attentionPage', 1);
  const [officeSection, setOfficeSection] = useReportViewState(office, 'section', 'attention');
  const attentionView = getOfficeReportAttentionPage(report?.attention ?? [], attentionPage);
  const attentionPageCount = attentionView.pageCount;
  const visibleAttentionPage = attentionView.page;
  const attentionItems = office ? attentionView.rows : report?.attention ?? [];

  const loadReport = useCallback(() => {
    const generation = ++requestGeneration.current;
    setError(null);
    if (validationError) { setLoading(false); return; }
    setLoading(true);
    getWorkflowReport(filters)
      .then(result => {
        if (generation !== requestGeneration.current) return;
        setReport(result);
        setLoadedQuery(buildWorkflowReportQuery(filters));
      })
      .catch(reason => {
        if (generation === requestGeneration.current) setError(reason instanceof Error ? reason.message : 'Unable to load workflow reports.');
      })
      .finally(() => { if (generation === requestGeneration.current) setLoading(false); });
  }, [filters, validationError]);

  useEffect(() => {
    loadReport();
    return () => { requestGeneration.current++; };
  }, [loadReport]);

  const updateFilters = (patch: Partial<WorkflowReportFilters>) => {
    setAttentionPage(1);
    setFilters(current => ({ ...current, ...patch }));
  };
  const resetFilters = () => {
    setAttentionPage(1);
    setFilters({ semester: 'active' });
  };

  const exportWorkbook = async () => {
    if (!report || reportPending || validationError || error || exporting) return;
    setExporting(true);
    try {
      await downloadWorkflowReport(filters);
      setToastTone('success');
      setToast('Downloaded workflow_analytics_report.xlsx');
      window.setTimeout(() => setToast(null), 3200);
    } catch (reason) {
      setToastTone('danger');
      setToast(reason instanceof Error ? reason.message : 'Unable to download the workbook.');
      window.setTimeout(() => setToast(null), 3200);
    } finally {
      setExporting(false);
    }
  };

  const kpis = useMemo(() => report ? [
    { label: currentUserRole === 'Lecturer' ? 'Records involving you' : 'Records in scope', value: formatReportMetric(report.overview.totalRecords) },
    { label: 'Pending approvals', value: formatReportMetric(report.overview.pendingApprovals) },
    { label: 'Average waiting', value: report.overview.averageWaitingDays === null ? '-' : `${report.overview.averageWaitingDays} days` },
    { label: 'Longest waiting', value: report.overview.longestWaitingDays === null ? '-' : `${report.overview.longestWaitingDays} days` },
    { label: 'Marks completion', value: formatReportMetric(report.overview.marksCompletionRate, '%') },
    { label: 'Active milestones', value: formatReportMetric(report.overview.activeTimelineEntries) },
  ] : [], [report, currentUserRole]);

  const statisticCards = (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpis.map((kpi) => (
              <PortalCard key={kpi.label} padding="sm" className="rounded-lg min-h-[92px]">
                <p className="card-label">{kpi.label}</p>
                <p className="card-metric mt-3">{kpi.value}</p>
              </PortalCard>
            ))}
          </div>
  );
  const breakdowns = report ? (<>

          {report.overview.totalRecords === 0 ? (
            <EmptyState
              title="No records in this range"
              description="Adjust the report dates or programme filter to include persisted records."
              icon={FileSpreadsheet}
            />
          ) : (
            <div className="space-y-5">
              {report.supervisor && <WorkflowSection title="Supervisor Appointments" summary={report.supervisor} />}
              {report.researchAmendments && <WorkflowSection title="Research Amendments and Transfers" summary={report.researchAmendments} />}
              {report.panel && <WorkflowSection title="Panel Appointments" summary={report.panel} />}

              {report.marks && (
                <PortalCard padding="md" className="rounded-lg">
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <h3 className="section-label">Marks Tracking</h3>
                    <StatusBadge tone={report.overview.overdueMarks > 0 ? 'warning' : 'success'}>
                      {report.overview.overdueMarks} overdue
                    </StatusBadge>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Distribution title="Task status" values={report.marks.statusCounts} total={report.marks.total} />
                    <Distribution title="Deadline state" values={report.marks.deadlineStateCounts} total={report.marks.total} />
                    <Distribution title="Evaluator role" values={report.marks.evaluatorRoleCounts} total={report.marks.total} />
                  </div>
                </PortalCard>
              )}

              {report.timeline && (
                <PortalCard padding="md" className="rounded-lg">
                  <h3 className="section-label mb-5">Timeline Milestones</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Distribution title="Current status" values={report.timeline.statusCounts} total={report.timeline.total} />
                    <Distribution title="Research project" values={report.timeline.levelCounts} total={report.timeline.total} />
                    <Distribution title="Target role" values={report.timeline.targetRoleCounts} total={report.timeline.total} />
                  </div>
                </PortalCard>
              )}
            </div>
          )}

          {report.participantLifecycle && (
            <PortalCard data-office-preserve padding="md" className="rounded-lg">
              <h3 className="section-label mb-5">Participant Lifecycle</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
                {Object.entries(report.participantLifecycle).map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-md bg-slate-50 p-3">
                    <span className="card-label block [overflow-wrap:anywhere]">{reportLabel(label.replace(/([a-z])([A-Z])/g, '$1 $2'))}</span>
                    <strong className="card-value mt-1 block">{value}</strong>
                  </div>
                ))}
              </div>
            </PortalCard>
          )}

</>) : null;

  return (
    <div id="workflow-reports-workspace" className="space-y-6 pb-16 text-left">
      <PortalToast message={toast} tone={toastTone} />
      <PageHeader
        title={office ? 'Workflow reports' : 'Workflow Analytics'}
        subtitle={currentUserRole === 'Lecturer' ? 'Review waiting requests and assigned evaluation work, then explore workflow outcomes.' : 'Current persisted state across authorised workflow, marks, and timeline records.'}
        backLabel="Back to Dashboard"
        onBack={onBack}
        actions={(
          <>
            {currentUserRole === 'Office Staff/Admin' && onOpenReconciliation && (
              <PortalButton icon={ShieldAlert} onClick={onOpenReconciliation}>
                Reconcile Workflows
              </PortalButton>
            )}
            <PortalButton
              variant="primary"
              icon={Download}
              onClick={exportWorkbook}
              isLoading={exporting}
              disabled={!report || reportPending || !!validationError || !!error}
            >
              Download XLSX
            </PortalButton>
          </>
        )}
      />

      <PortalCard padding="md" role="region" aria-label="Report filters">
        <h2 className="section-label mb-4">Report filters</h2>
        <WorkspaceFilterCard onReset={resetFilters} fieldsClassName={`grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 ${office ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            <label className="form-label min-w-0">
              <span className="block mb-1">Start date</span>
              <input
                type="date"
                value={filters.startDate ?? ''}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? 'report-date-error' : undefined}
                onChange={(event) => updateFilters({ startDate: event.target.value })}
                className="form-control form-control-sm"
              />
            </label>
            <label className="form-label min-w-0">
              <span className="block mb-1">End date</span>
              <input
                type="date"
                value={filters.endDate ?? ''}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? 'report-date-error' : undefined}
                onChange={(event) => updateFilters({ endDate: event.target.value })}
                className="form-control form-control-sm"
              />
            </label>
            <label className="form-label min-w-0">
              <span className="block mb-1">Academic semester</span>
              <PortalSelect
                value={filters.semester ?? 'active'}
                onChange={(event) => updateFilters({ semester: event.target.value })}
                className="form-control form-control-sm"
              >
                <option value="active">Active semester</option>
                <option value="all">All semesters</option>
                <option value="unassigned">Legacy / Unassigned</option>
                {report?.filters.availableSemesters.map((semester) => (
                  <option key={semester.semesterCode} value={semester.semesterCode}>
                    {semester.semester}
                  </option>
                ))}
              </PortalSelect>
            </label>
            {currentUserRole === 'Office Staff/Admin' && (
              <label className="form-label min-w-0">
                <span className="block mb-1">Programme</span>
                <PortalSelect
                  value={filters.programme ?? ''}
                  onChange={(event) => updateFilters({ programme: event.target.value })}
                  className="form-control form-control-sm"
                >
                  <option value="">All authorised programmes</option>
                  {report?.filters.availableProgrammes.map((programme) => (
                    <option key={programme} value={programme}>{programme}</option>
                  ))}
                </PortalSelect>
              </label>
            )}
        </WorkspaceFilterCard>
        {!reportPending && !validationError && !error && report && <p className="card-description mt-3" aria-live="polite">Showing: {report.filters.selectedSemester && filters.semester === report.filters.semester ? report.filters.selectedSemester.semester : filters.semester === 'all' ? 'All semesters' : filters.semester === 'unassigned' ? 'Legacy / Unassigned' : filters.semester === 'active' ? 'Active semester' : filters.semester}; {filters.startDate || 'Any start date'} to {filters.endDate || 'any end date'}{filters.programme ? `; ${filters.programme}` : ''}.</p>}
        {validationError && (
          <div id="report-date-error" className="mt-3"><AlertMessage type="error" title="Check the report dates" message={validationError} /></div>
        )}
      </PortalCard>

      {validationError ? null : reportPending ? (
        <LoadingState message="Loading workflow analytics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadReport} />
      ) : !report ? null : (
        <>
          {currentUserRole === 'Lecturer' ? <LecturerReportSummary report={report} onNavigateToRoute={onNavigateToRoute} /> : statisticCards}
          {office && <nav aria-label="Report sections" className="flex flex-wrap gap-2">
            {Object.entries({ attention: 'Attention', appointments: 'Appointment workflows', evaluations: 'Evaluations', calendar: 'Calendar', capacity: 'Office capacity' }).map(([key, label]) => (
              <PortalButton key={key} size="sm" aria-pressed={officeSection === key} variant={officeSection === key ? 'primary' : 'secondary'} onClick={() => setOfficeSection(key)}>{label}</PortalButton>
            ))}
          </nav>}
          {(!office || officeSection === 'attention') && <>
          <PortalCard id="workflow-attention" role="region" aria-label="Records requiring attention" padding="none" className="rounded-lg overflow-hidden scroll-mt-24">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-amber-600" />
              <h3 className="section-label">Records Requiring Attention</h3>
            </div>
            {report.attention.length === 0 ? (
              <EmptyState
                title="No waiting or overdue records"
                description="No authorised records currently require attention."
                className="py-10"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr className="data-thead">
                      <th className="data-th text-left">Record</th>
                      <th className="data-th text-left">Programme</th>
                      <th className="data-th text-left">State</th>
                      <th className="data-th text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentionItems.map((item) => (
                      <tr key={`${item.recordType}-${item.recordId}`} className="data-row">
                        <td className="data-td-strong">{item.label}</td>
                        <td className="data-td">{item.programme}</td>
                        <td className="data-td">
                          {office ? <ReportAttentionState item={item} /> : item.kind === 'WAITING'
                            ? `${item.waitingDays ?? 0} days - ${reportLabel(item.waitingOn ?? 'Waiting')}`
                            : item.kind === 'PARTICIPANT_LIFECYCLE'
                              ? reportLabel(item.participantStatus ?? 'Lifecycle review')
                              : item.kind === 'RECONCILIATION'
                                ? 'Blocking data inconsistency'
                              : `Overdue - ${item.dueAt ?? 'No date'}`}
                        </td>
                        <td className="data-td text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {canOpenReportDossier(item) && (
                              <PortalButton variant="primary" icon={UserRound}
                                size="sm"
                                onClick={() => office && onOpenDossier && item.studentId ? onOpenDossier(item.studentId) : onNavigateToRoute(routeForStudentProgress(item.studentId ?? undefined))}
                              >View student record</PortalButton>
                            )}
                            <PortalButton
                              size="sm"
                              variant="ghost"
                              onClick={() => onNavigateToRoute(office && item.kind === 'LECTURER_CAPACITY' ? `${APP_ROUTES.dashboardLecturerCapacity}?${new URLSearchParams({ ...(report.capacity ? { semester: String(report.capacity.semesterId) } : {}), lecturer: item.recordId }).toString()}` : resolveWorkflowReportRecordRoute(item))}
                            >
                              {item.recordType.startsWith('CO_SUPERVISOR_') ? 'View team' : 'Open'}
                            </PortalButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PortalCard>
          {office && report.attention.length > 10 && <div className="flex flex-wrap items-center justify-between gap-3" aria-label="Attention pagination">
            <p className="card-description">{(visibleAttentionPage - 1) * 10 + 1}–{Math.min(visibleAttentionPage * 10, report.attention.length)} of {report.attention.length} attention records · Page {visibleAttentionPage} of {attentionPageCount}</p>
            <div className="flex gap-2"><PortalButton size="sm" disabled={visibleAttentionPage === 1} onClick={() => setAttentionPage(visibleAttentionPage - 1)}>Previous</PortalButton><PortalButton size="sm" disabled={visibleAttentionPage === attentionPageCount} onClick={() => setAttentionPage(visibleAttentionPage + 1)}>Next</PortalButton></div>
          </div>}
          </>}
          {currentUserRole === 'Lecturer' ? <details className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
            <summary className="section-label cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy">Workflow breakdowns and summary statistics</summary>
            <p className="card-description">Within the applied filters, this includes Supervisor requests and co-supervisor nominations involving you, Panel recommendations naming you, research changes for students you currently supervise, your assigned evaluations and shared Lecturer milestones. Counts are records, not students; waiting times include other reviewers.</p>
            {statisticCards}{breakdowns}
          </details> : office ? <OfficeReportBreakdown report={report} section={officeSection} onNavigate={onNavigateToRoute} /> : breakdowns}
          {office && report.participantLifecycle && <PortalCard data-office-preserve padding="md" className="rounded-lg">
            <h3 className="section-label mb-5">Participant Lifecycle</h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
              {Object.entries(report.participantLifecycle).map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-md bg-slate-50 p-3">
                  <span className="card-label block [overflow-wrap:anywhere]">{reportLabel(label.replace(/([a-z])([A-Z])/g, '$1 $2'))}</span>
                  <strong className="card-value mt-1 block">{value}</strong>
                </div>
              ))}
            </div>
          </PortalCard>}
        </>
      )}
    </div>
  );
};
