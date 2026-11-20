import { WorkspaceFilterCard } from './RequestWorkspacePrimitives';
import { MarksHeading } from './MarksPrimitives';
import { Link, useSearchParams } from 'react-router';
import { APP_ROUTES } from '../constants/routes';
import { PortalSelect } from './PortalSelect';
import { DecisionDialog } from './DecisionDialog';
import { PortalModal } from './PortalModal';
import { MarksCompletionWindows } from './MarksCompletionWindows';
import {DecisionFeedbackProvider, useDecisionFeedback} from './DecisionFeedback';
import {DraftNavigationGuard} from './DraftNavigationGuard';
import {RecordDraft} from './RecordDraft';
import {ApiError} from '../services/apiClient';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, PortalButton, PortalCard, StatusBadge } from './PortalPrimitives';
import { LoadingState, ErrorState } from './StateViews';
import {
  EvaluationPeriodOption,
  EvaluationPreviewStatus,
  EvaluationPreviewTask,
  EvaluationTaskRole,
} from '../types';
import {
  generateEvaluationTasks,
  getEvaluationPeriods,
  getEvaluationPeriod,
  getEvaluationPreviewTasks,
  searchMarksAssignmentStudents,
} from '../services';
import {
  formatPeriodStatus,
  formatPeriodTargeting,
  marksMutationErrorMessage,
} from '../utils/marksProductionManagement';

interface EvaluationTaskAssignmentProps {
  onBack: () => void;
  onManageTimeline?: (period?:Pick<EvaluationPeriodOption,'id'|'semesterId'>) => void;
}

interface ActivityItem {
  id: string;
  date: string;
  action: string;
  details: string;
  performedBy: string;
}

const ALL_ROLES = 'ALL';
const ALL_STATUSES = 'ALL';

const roleLabel = (role?: EvaluationTaskRole, fallback?: string): string => {
  if (fallback) return fallback;
  if (role === 'SUPERVISOR') return 'Supervisor';
  return 'Panel';
};

const statusLabel = (status: EvaluationPreviewStatus): string => {
  const labels: Record<EvaluationPreviewStatus, string> = {
    GENERATED: 'Generated',
    PENDING: 'Pending',
    NOTIFIED: 'Notified',
    NOT_STARTED: 'Not Started',
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    OVERDUE: 'Overdue',
  };
  return labels[status] || status;
};

const formatDate = (value: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

export function MarksTaskDeadlineEntryPoint({tasks,onChanged,onManageTimeline,compact=false}: {
  tasks:EvaluationPreviewTask[];onChanged:()=>Promise<void>;onManageTimeline?:()=>void;compact?:boolean;
}) {
  if(!onManageTimeline)return <MarksCompletionWindows tasks={tasks} onChanged={onChanged}/>;
  if(compact)return <PortalButton size="sm" icon={Calendar} onClick={onManageTimeline} aria-label="Manage deadlines in Periods & deadlines">Manage deadlines</PortalButton>;
  return <PortalCard className="space-y-3"><h2 className="section-label">Deadlines and extra time</h2><p className="card-description">Manage common deadlines, selected task completion windows and their history in Periods &amp; deadlines.</p><PortalButton onClick={onManageTimeline}>Manage deadlines in Periods &amp; deadlines</PortalButton></PortalCard>;
}

const selectablePeriod = (period: EvaluationPeriodOption) => period.lifecycleStatus === 'PUBLISHED'
  && ['SCHEDULED', 'OPEN'].includes(period.effectiveStatus);

const generationReady = (period: EvaluationPeriodOption) => period.lifecycleStatus === 'PUBLISHED'
  && ['SCHEDULED', 'OPEN'].includes(period.effectiveStatus) && Boolean(period.rubricId && period.rubricName)
  && period.rubric?.isReady !== false;
const generationScope = (period: EvaluationPeriodOption) => JSON.stringify([
  period.id, period.name, period.semesterId, period.semester, period.rubricId, period.rubricName,
  period.programmeScope, [...period.programmes].sort(), [...period.evaluatorRoles].sort(),
  period.opensAt, period.closesAt, period.lifecycleStatus, period.effectiveStatus, period.rubric,
]);

export const EvaluationTaskAssignment: React.FC<EvaluationTaskAssignmentProps> = props =>
  <DecisionFeedbackProvider scopeKey="marks-assignment"><EvaluationTaskAssignmentContent {...props}/></DecisionFeedbackProvider>;

const EvaluationTaskAssignmentContent: React.FC<EvaluationTaskAssignmentProps> = ({ onBack, onManageTimeline }) => {
  const [searchParams] = useSearchParams();
  const publish = useDecisionFeedback();
  const [tasks, setTasks] = useState<EvaluationPreviewTask[]>([]);
  const [periods, setPeriods] = useState<EvaluationPeriodOption[]>([]);
  const [eligibleStudentCount, setEligibleStudentCount] = useState<number | null>(null);
  const [eligibleStudentCountError, setEligibleStudentCountError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState(() => searchParams.get('period') ?? '');
  const [roleFilter, setRoleFilter] = useState<typeof ALL_ROLES | EvaluationTaskRole>(ALL_ROLES);
  const [statusFilter, setStatusFilter] = useState<typeof ALL_STATUSES | EvaluationPreviewStatus>(ALL_STATUSES);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<EvaluationPreviewTask | null>(null);
  const [generating, setGenerating] = useState(false);
  const generationBusy = useRef(false);
  const [generationReview, setGenerationReview] = useState<EvaluationPeriodOption | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationBlocked, setGenerationBlocked] = useState(false);
  const [generationCommitted, setGenerationCommitted] = useState<string | null>(null);
  const [fallbackDrafts, setFallbackDrafts] = useState(new Map<symbol, {dirty:boolean;busy:boolean}>());
  const reportFallback = useCallback((key:symbol,state:{dirty:boolean;busy:boolean}|null) => setFallbackDrafts(current => {
    const previous=current.get(key);
    if(state ? previous?.dirty===state.dirty && previous?.busy===state.busy : !previous)return current;
    const next=new Map(current);if(state)next.set(key,state);else next.delete(key);return next;
  }),[]);
  const fallbackDirty=[...fallbackDrafts.values()].some(draft=>draft.dirty);
  const fallbackBusy=[...fallbackDrafts.values()].some(draft=>draft.busy);
  const loadWorkspace = useCallback(async (propagateError = false) => {
    setLoading(true);
    setError(null);
    try {
      const [loadedTasks, loadedPeriods] = await Promise.all([
        getEvaluationPreviewTasks(),
        getEvaluationPeriods(),
      ]);
      setTasks(loadedTasks);
      setPeriods(loadedPeriods);
      setWorkspaceLoaded(true);
      setSelectedPeriodId(current => {
        const available = loadedPeriods.filter(selectablePeriod);
        return available.some(period => String(period.id) === current) ? current : String(available[0]?.id ?? '');
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load evaluation assignment workspace.');
      if (propagateError) throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const availablePeriods = periods.filter(selectablePeriod);
  const selectedPeriod = availablePeriods.find(period => String(period.id) === selectedPeriodId);
  const periodTasks = useMemo(
    () => selectedPeriod ? tasks.filter(task => task.periodId === selectedPeriod.id) : [],
    [tasks, selectedPeriod],
  );
  const periodHasTasks = periodTasks.length > 0;
  const totals = selectedPeriod?.taskTotals;
  useEffect(() => {
    if (!selectedPeriod) {
      setEligibleStudentCount(null);
      setEligibleStudentCountError(false);
      return;
    }
    const controller = new AbortController();
    setEligibleStudentCount(null);
    setEligibleStudentCountError(false);
    searchMarksAssignmentStudents(selectedPeriod.id, '', 1, controller.signal)
      .then(result => setEligibleStudentCount(result.total))
      .catch(() => {
        if (!controller.signal.aborted) {
          setEligibleStudentCount(null);
          setEligibleStudentCountError(true);
        }
      });
    return () => controller.abort();
  }, [selectedPeriod]);

  const selectedPeriodAllowsGeneration = Boolean(
    selectedPeriod && generationReady(selectedPeriod),
  );

  const filteredTasks = useMemo(() => periodTasks.filter((task) => {
    const matchesRole = roleFilter === ALL_ROLES || (task.evaluatorRole || 'PANEL') === roleFilter;
    const matchesStatus = statusFilter === ALL_STATUSES || task.status === statusFilter;
    return matchesRole && matchesStatus;
  }), [periodTasks, roleFilter, statusFilter]);

  const installPeriod = (period:EvaluationPeriodOption) => setPeriods(current=>current.map(item=>item.id===period.id?period:item));
  const recoverGeneration = async () => {
    if(generationBusy.current)return;
    generationBusy.current=true;setGenerating(true);
    try {await loadWorkspace(true);setGenerationBlocked(false);setGenerationCommitted(null);setGenerationError(null);}
    catch(e){setGenerationError(`Couldn’t reload assignment workspace. ${marksMutationErrorMessage(e)}`);}
    finally {generationBusy.current=false;setGenerating(false);}
  };
  const handleGenerateTasks = async () => {
    if(generationBusy.current || generationBlocked || generationCommitted || !selectedPeriod || fallbackDirty || fallbackBusy)return;
    generationBusy.current=true;
    setGenerating(true);
    setGenerationError(null);
    try {
      const latest=await getEvaluationPeriod(selectedPeriod.id);installPeriod(latest);
      if(!generationReady(latest)){setGenerationError('Tasks can only be generated for a ready published period that has not ended.');return;}
      setGenerationReview(latest);
    } catch(e){setGenerationError(`Couldn’t review generation. ${marksMutationErrorMessage(e)}`);}
    finally{generationBusy.current=false;setGenerating(false);}
  };
  const commitGeneration = async () => {
    if(generationBusy.current || !generationReview || generationBlocked || generationCommitted)return;
    generationBusy.current=true;setGenerating(true);setGenerationError(null);
    const reviewed=generationReview;
    let outcome:string|null=null;
    try {
      const latest=await getEvaluationPeriod(reviewed.id);installPeriod(latest);
      if(generationScope(latest)!==generationScope(reviewed) || !generationReady(latest)){
        setGenerationReview(null);setGenerationError('The saved period changed. Review its current scope and readiness before generating tasks.');return;
      }
      const result = await generateEvaluationTasks(reviewed.id);
      outcome=result.createdCount===0 ? `No missing tasks were created. ${result.totalCount} total task(s) for ${reviewed.name}.`
        : `Generated ${result.createdCount} missing task(s) for ${reviewed.name}: ${result.supervisorCreatedCount} supervisor, ${result.panelCreatedCount} panel; ${result.totalCount} total.`;
      setGenerationCommitted(outcome);setGenerationReview(null);
      setActivities(prev => [{
        id: String(Date.now()),
        date: 'Today',
        action: 'Generated evaluation tasks',
        details: `${result.createdCount} created, ${result.totalCount} total for selected period`,
        performedBy: 'Office Staff/Admin',
      }, ...prev]);
      await loadWorkspace(true);
      setGenerationCommitted(null);
      publish?.(outcome, result.createdCount===0?'info':'success');
    } catch (e) {
      setGenerationReview(null);
      if(outcome){publish?.(`${outcome} The workspace could not be refreshed. Reload the workspace to review the saved result.`, 'warning');}
      else {setGenerationError(`Couldn’t generate tasks. ${e instanceof Error ? e.message : marksMutationErrorMessage(e)}`);if(e instanceof ApiError && [403,409].includes(e.status??0))setGenerationBlocked(true);}
    } finally {
      generationBusy.current=false;
      setGenerating(false);
    }
  };

  return (
    <div id="eval-assignment-workspace" className="marks-workspace space-y-6 relative text-left">
      <DraftNavigationGuard dirty={fallbackDirty} busy={generating || fallbackBusy}/>
      <DecisionDialog isOpen={!!generationReview} kind="confirmation" decisionKey={generationReview?.id}
        title="Generate evaluation tasks?" context={generationReview ? `${generationReview.name} · ${generationReview.semester}` : undefined}
        message="Review the saved evaluation settings before continuing." confirmLabel="Generate tasks"
        successMessage="Evaluation tasks generated." busy={generating}
        onClose={()=>{if(!generationBusy.current)setGenerationReview(null);}}
        onConfirm={async()=>{await commitGeneration();return false as const;}}>
        {generationReview && <div className="space-y-6">
          <dl className="grid gap-x-8 gap-y-6 rounded-lg border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-xs text-slate-500">Programme and evaluator</dt><dd className="mt-1 break-words text-sm font-medium text-brand-navy">{formatPeriodTargeting(generationReview)}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-slate-500">Rubric</dt><dd className="mt-1 break-words text-sm font-medium text-brand-navy">{generationReview.rubricName}</dd></div>
            <div><dt className="text-xs text-slate-500">Evaluation window</dt><dd className="mt-1 text-sm font-medium text-brand-navy">{formatDate(generationReview.opensAt)} – {formatDate(generationReview.closesAt)}</dd></div>
            <div><dt className="text-xs text-slate-500">Window status</dt><dd className="mt-1 text-sm font-medium text-brand-navy">{formatPeriodStatus(generationReview.effectiveStatus)}</dd></div>
          </dl>
          <div className="border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-brand-navy">{generationReview.taskTotals.total} existing {generationReview.taskTotals.total === 1 ? 'task' : 'tasks'}</p>
            <p className="mt-2">Missing tasks will be created. Existing tasks and marks will remain unchanged.</p>
          </div>
        </div>}
      </DecisionDialog>
      {generationCommitted ? <div role="status" className="space-y-2"><p>{generationCommitted} Workspace refresh required.</p><PortalButton disabled={generating} onClick={recoverGeneration}>Reload workspace</PortalButton></div> : null}
      {generationError ? <div role="alert" className="text-red-700"><p>{generationError}</p>{generationBlocked ? <PortalButton disabled={generating} onClick={recoverGeneration}>Review latest workspace</PortalButton> : null}</div> : null}
      <PageHeader
        title="Evaluation Task Assignment"
        subtitle="Create assignments and review evaluation tasks."
        backLabel="Back to Marks overview"
        onBack={()=>{if(!generationBusy.current && !generationReview && !fallbackBusy)onBack();}}
        backDisabled={generating || !!generationReview || fallbackBusy}
        subtitleClassName="leading-relaxed"
      />

      {loading && !workspaceLoaded ? (
        <LoadingState message="Loading evaluation assignment workspace…" />
      ) : error && !workspaceLoaded ? (
        <ErrorState message={error} onRetry={generationCommitted || generationBlocked ? recoverGeneration : loadWorkspace} />
      ) : (
        <>
          {error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><p>Couldn’t refresh the assignment workspace. The loaded data remains visible.</p><PortalButton onClick={generationCommitted || generationBlocked ? recoverGeneration : () => loadWorkspace()} disabled={generating}>Reload workspace</PortalButton></div> : null}
          <PortalCard id="assignment-period-card" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MarksHeading icon={Calendar}>Evaluation period</MarksHeading>
              {selectedPeriod ? <StatusBadge className="marks-state" tone={selectedPeriodAllowsGeneration ? 'info' : 'neutral'}>{formatPeriodStatus(selectedPeriod.effectiveStatus)}</StatusBadge> : null}
            </div>
            <div id="assignment-controls" className="space-y-3">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor="assignment-period">Select evaluation period</label>
                  <PortalSelect id="assignment-period" disabled={availablePeriods.length === 0 || generating || !!generationReview || fallbackDirty || fallbackBusy} aria-label="Evaluation period" className="form-control form-control-md w-full" value={selectedPeriod ? selectedPeriodId : ''}
                    onChange={event => {
                      setSelectedPeriodId(event.target.value);
                    }}>
                    <option value="" disabled hidden={!!selectedPeriod}>{availablePeriods.length > 0 ? 'Select an evaluation period' : 'No open or scheduled periods'}</option>
                    {availablePeriods.map(period => <option key={period.id} value={period.id}>{period.name} — {period.evaluatorRoles.map(role => roleLabel(role)).join(" / ")}</option>)}
                  </PortalSelect>
                </div>
                <PortalButton className="min-h-11 shrink-0" variant="primary" icon={Check} disabled={!selectedPeriodAllowsGeneration || generating || generationBlocked || !!generationCommitted || fallbackDirty || fallbackBusy} isLoading={generating} onClick={handleGenerateTasks}>
                  {generating ? 'Generating…' : 'Generate evaluation tasks'}
                </PortalButton>
              </div>
              {!selectedPeriodAllowsGeneration ? <p id="generation-help" className="card-description">{availablePeriods.length === 0 ? <>No open or scheduled evaluation periods. <Link to={APP_ROUTES.marksConfig} className="inline-flex min-h-11 items-center rounded font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Configure evaluation period</Link></> : !selectedPeriod ? 'Select a published period to generate evaluation tasks.' : 'Generation requires a ready rubric and a published period that is scheduled or open.'}</p> : null}
              <details className="border-t border-slate-100 pt-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-semibold text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
                  <span>Period details and readiness</span>
                  <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium">{[Boolean(selectedPeriod), selectedPeriodAllowsGeneration, Boolean(selectedPeriod?.rubricName), eligibleStudentCount !== null && eligibleStudentCount > 0].filter(Boolean).length}/4 checks<ChevronDown aria-hidden="true" className="h-4 w-4" /></span>
                </summary>
                <div className="grid min-w-0 gap-5 pt-3 lg:grid-cols-2">
                  {selectedPeriod ? <dl className="min-w-0 space-y-3">
                    <div><dt className="text-xs font-semibold text-slate-700">Marking rubric</dt><dd className="mt-1 text-xs font-normal leading-5 text-slate-600 break-words">{selectedPeriod.rubricName || 'Not configured'}</dd></div>
                    <div><dt className="text-xs font-semibold text-slate-700">Entry window</dt><dd className="mt-1 text-xs font-normal leading-5 text-slate-600">{formatDate(selectedPeriod.opensAt || null)} – {formatDate(selectedPeriod.closesAt || null)}</dd></div>
                    <div><dt className="text-xs font-semibold text-slate-700">Evaluation scope</dt><dd className="mt-1 text-xs font-normal leading-5 text-slate-600 break-words">{formatPeriodTargeting(selectedPeriod)}</dd></div>
                  </dl> : <p className="card-description">Select a period to view its rubric, dates and evaluation scope.</p>}
                  <section aria-label="Generation readiness" className="min-w-0">
                    <h3 className="text-sm font-semibold text-brand-navy">Readiness checks</h3>
                    <ul className="mt-2 divide-y divide-slate-100">
                      {[
                        { label: 'Evaluation period selected', passed: Boolean(selectedPeriod) },
                        { label: 'Period published and not ended', passed: selectedPeriodAllowsGeneration },
                        { label: 'Rubric configured', passed: Boolean(selectedPeriod?.rubricName) },
                        { label: 'Eligible students available', passed: eligibleStudentCountError ? false : eligibleStudentCount === null ? null : eligibleStudentCount > 0 },
                      ].map(({ label, passed }) => <li key={label} className="flex items-start justify-between gap-3 py-2">
                        <span className="card-description min-w-0">{label}</span>
                        <span title={label === 'Eligible students available' && eligibleStudentCountError ? 'Could not check student availability. Change the selected period to retry.' : undefined} className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${passed ? 'text-emerald-700' : passed === null || eligibleStudentCountError && label === 'Eligible students available' ? 'text-slate-500' : selectedPeriod ? 'text-amber-800' : 'text-slate-500'}`}>
                          {passed === true ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : passed === false ? <AlertCircle aria-hidden="true" className="h-4 w-4" /> : null}
                          {eligibleStudentCountError && label === 'Eligible students available' ? 'Unavailable' : passed === true ? 'Ready' : passed === null ? 'Checking' : selectedPeriod ? 'Review' : 'Not ready'}
                        </span>
                      </li>)}
                    </ul>
                  </section>
                </div>
              </details>
            </div>
          </PortalCard>

          <PortalCard id="evaluation-preview-card" className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <MarksHeading icon={ClipboardList}>Evaluation tasks</MarksHeading>
              </div>
            </div>
            {periodHasTasks && totals ? <WorkspaceFilterCard onReset={() => { setRoleFilter(ALL_ROLES); setStatusFilter(ALL_STATUSES); }}
              fieldsClassName="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
              <label className="form-label min-w-0">Evaluator role
                <PortalSelect aria-label="Evaluator role" className="form-control form-control-sm mt-1" value={roleFilter}
                  onChange={event => setRoleFilter(event.target.value as typeof ALL_ROLES | EvaluationTaskRole)}>
                  <option value={ALL_ROLES}>All roles ({totals.total})</option>
                  <option value="SUPERVISOR">Supervisor ({totals.supervisor})</option>
                  <option value="PANEL">Panel ({totals.panel})</option>
                </PortalSelect>
              </label>
              <label className="form-label min-w-0">Task status
                <PortalSelect aria-label="Task status" className="form-control form-control-sm mt-1" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof ALL_STATUSES | EvaluationPreviewStatus)}>
                  <option value={ALL_STATUSES}>All statuses</option><option value="NOT_STARTED">Not started</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Submitted</option>
                </PortalSelect>
              </label>
            </WorkspaceFilterCard> : null}
            {periodHasTasks && totals ? <div className="flex flex-wrap items-center justify-between gap-3">
              <dl aria-label="Submission counts" className="flex flex-wrap gap-x-5 gap-y-2">
                {[
                  ['Submitted', totals.submitted], ['Incomplete', totals.incomplete], ['Overdue', totals.overdue],
                ].map(([label, value]) => <div key={String(label)} className="flex items-baseline gap-1.5"><dt className="card-description">{label}</dt><dd className="text-sm font-semibold tabular-nums text-brand-navy">{value}</dd></div>)}
              </dl>
              <p role="status" className="card-description">{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} shown</p>
            </div> : null}
            {!selectedPeriod ? <div className="rounded-xl bg-slate-50 px-4 py-6">
              <h3 className="text-sm font-semibold text-brand-navy">{availablePeriods.length > 0 ? 'Select a period to view its tasks' : 'No open or scheduled evaluation periods'}</h3>
              <Link to={APP_ROUTES.marksRecords} className="card-description inline-flex min-h-11 items-center rounded font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View Mark Entry Records</Link>
            </div> : filteredTasks.length === 0 ? <div className="rounded-xl bg-slate-50 px-4 py-6">
              <h3 className="text-sm font-semibold text-brand-navy">{periodHasTasks ? 'No tasks match these filters' : 'No tasks for this period yet'}</h3>
              <p className="card-description mt-2 max-w-prose">{periodHasTasks ? 'Change or clear the role and status filters to see tasks for this period.' : 'Generate evaluation tasks for this period using the button above.'}</p>
            </div> : <div role="region" aria-label="Evaluation task results" tabIndex={0} className="overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <table className="data-table min-w-[760px]">
                <caption className="sr-only">Evaluation assignments for the current period scope and filters</caption>
                <thead><tr className="data-thead">
                  <th scope="col" className="data-th">Student</th><th scope="col" className="data-th">Research title</th><th scope="col" className="data-th">Evaluator</th><th scope="col" className="data-th">Semester</th><th scope="col" className="data-th">Status</th><th scope="col" className="data-th text-left">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map(task => <tr key={task.taskId ?? task.id} className="hover:bg-slate-50/50">
                    <td className="data-td"><p className="font-semibold text-brand-navy">{task.studentName}</p><p className="card-caption mt-1">{task.studentId}</p></td>
                    <td className="data-td max-w-[240px]"><p className="line-clamp-2" title={task.researchTitle}>{task.researchTitle}</p></td>
                    <td className="data-td"><p>{task.panelMember}</p><p className="mt-1 text-xs text-slate-500">{roleLabel(task.evaluatorRole, task.evaluatorRoleLabel)}</p></td>
                    <td className="data-td">{task.semester}</td>
                    <td className="data-td"><StatusBadge className="marks-state whitespace-nowrap" tone={task.status === 'SUBMITTED' ? 'success' : task.status === 'OVERDUE' ? 'danger' : 'neutral'}>{statusLabel(task.status)}</StatusBadge></td>
                    <td className="data-td text-left"><PortalButton onClick={() => setSelectedTask(task)} aria-label={`View task for ${task.studentName}, ${roleLabel(task.evaluatorRole, task.evaluatorRoleLabel)}`}>View</PortalButton></td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
            {!onManageTimeline && selectedPeriod ? <RecordDraft.Provider value={reportFallback}><fieldset disabled={generating || !!generationReview}><MarksTaskDeadlineEntryPoint key={selectedPeriod.id} tasks={periodTasks} onChanged={async () => {
              const [taskRows, periodRows] = await Promise.all([getEvaluationPreviewTasks(), getEvaluationPeriods()]);
              setTasks(taskRows); setPeriods(periodRows);
            }} /></fieldset></RecordDraft.Provider> : null}

          </PortalCard>
          {activities.length > 0 ? <PortalCard className="mt-6">
          <details id="recent-assignment-activity-panel">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold text-slate-600">Recent assignment actions</span>
              <span className="inline-flex items-center gap-2 text-xs text-slate-500">{activities.length} {activities.length === 1 ? 'action' : 'actions'}<ChevronDown aria-hidden="true" className="h-4 w-4" /></span>
            </summary>
            <div className="pt-2">
              <p className="card-description">Actions from this visit only. This list resets when you reload the page.</p>
              {activities.length ? <div className="mt-4 overflow-x-auto"><table className="data-table min-w-[650px]">
                <thead><tr className="data-thead"><th scope="col" className="data-th">Date</th><th scope="col" className="data-th">Action</th><th scope="col" className="data-th">Details</th><th scope="col" className="data-th">Performed by</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{activities.map(act => <tr key={act.id}><td className="data-td">{act.date}</td><td className="data-td">{act.action}</td><td className="data-td">{act.details}</td><td className="data-td">{act.performedBy}</td></tr>)}</tbody>
              </table></div> : null}
            </div>
          </details>
          </PortalCard> : null}
        </>
      )}

      {selectedTask ? <PortalModal isOpen onClose={() => setSelectedTask(null)} labelledBy="evaluation-task-preview-title"><h2 id="evaluation-task-preview-title" className="section-label mb-4">Evaluation task details</h2>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="card-label block mb-1">Student</span>
                    <span className="card-value text-blue-900 block">
                      {selectedTask.studentName} ({selectedTask.studentId})
                    </span>
                  </div>
                  <div>
                    <span className="card-label block mb-1">Research Title</span>
                    <p className="card-description">{selectedTask.researchTitle}</p>
                  </div>
                  <div>
                    <span className="card-label block mb-1">Assigned Evaluator</span>
                    <span className="card-value block">{selectedTask.panelMember}</span>
                    <span className="inline-flex mt-2 px-2.5 py-1 rounded-full bg-slate-50 text-xs font-extrabold tracking-wider text-slate-600 uppercase border border-slate-200">
                      {roleLabel(selectedTask.evaluatorRole, selectedTask.evaluatorRoleLabel)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                    <div>
                      <span className="card-label block mb-1">Semester</span>
                      <span className="card-value">{selectedTask.semester}</span>
                    </div>
                    <div>
                      <span className="card-label block mb-1">Status</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-extrabold tracking-wide uppercase rounded">
                        {statusLabel(selectedTask.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="w-full py-3 bg-brand-navy hover:bg-slate-850 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest mt-6"
                >
                  Close
                </button>
              </PortalModal> : null}
    </div>
  );
};
