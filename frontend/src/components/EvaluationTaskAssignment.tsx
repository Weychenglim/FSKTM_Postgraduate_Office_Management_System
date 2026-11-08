import { WorkspaceFilterCard } from './RequestWorkspacePrimitives';
import { MarksHeading } from './MarksPrimitives';
import { Link, useSearchParams } from 'react-router';
import { APP_ROUTES } from '../constants/routes';
import { PortalSelect } from './PortalSelect';
import { SelectMenu } from './SelectMenu';
import { DecisionDialog } from './DecisionDialog';
import { completeDecision } from '../utils/decisionSubmission';
import { RecordPage } from './RecordPage';
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
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, PortalConfirmModal, PortalButton, PortalCard, StatusBadge } from './PortalPrimitives';
import { LoadingState, ErrorState } from './StateViews';
import {
  EvaluationPeriodOption,
  EvaluationPreviewStatus,
  EvaluationPreviewTask,
  EvaluationTaskRole,
  MarksAssignmentLecturerOption,
  MarksAssignmentSearchResults,
  MarksAssignmentStudentOption,
} from '../types';
import {
  createBackupEvaluationTask,
  generateEvaluationTasks,
  getEvaluationPeriods,
  getEvaluationPeriod,
  getEvaluationPreviewTasks,
  searchMarksAssignmentLecturers,
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

type AssignmentLookupState<T> = MarksAssignmentSearchResults<T> & {
  loading: boolean;
  error: string | null;
};

interface BackupFormState {
  periodId: string;
  studentId: string;
  evaluatorId: string;
  originalTaskId: string;
  reason: string;
  confirmed: boolean;
}

const ALL_ROLES = 'ALL';
const ALL_STATUSES = 'ALL';

const roleLabel = (role?: EvaluationTaskRole, fallback?: string): string => {
  if (fallback) return fallback;
  if (role === 'SUPERVISOR') return 'Supervisor';
  if (role === 'BACKUP') return 'Backup / Manual Override';
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

const taskMatchesPeriod = (task: EvaluationPreviewTask, periodId: string): boolean =>
  !periodId || !task.periodId || String(task.periodId) === periodId;

const deriveTotals = (
  tasks: EvaluationPreviewTask[],
  period?: EvaluationPeriodOption,
) => {
  if (period) return period.taskTotals;
  const submitted = tasks.filter((task) => task.status === 'SUBMITTED').length;
  return {
    total: tasks.length,
    supervisor: tasks.filter((task) => task.evaluatorRole === 'SUPERVISOR').length,
    panel: tasks.filter((task) => (task.evaluatorRole || 'PANEL') === 'PANEL').length,
    backup: tasks.filter((task) => task.evaluatorRole === 'BACKUP').length,
    submitted,
    incomplete: tasks.length - submitted,
    overdue: 0,
  };
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
  const [backupStudentLookup, setBackupStudentLookup] = useState<AssignmentLookupState<MarksAssignmentStudentOption>>({ results: [], total: 0, limit: 50, loading: false, error: null });
  const [backupLecturerLookup, setBackupLecturerLookup] = useState<AssignmentLookupState<MarksAssignmentLecturerOption>>({ results: [], total: 0, limit: 50, loading: false, error: null });
  const [selectedBackupStudent, setSelectedBackupStudent] = useState<MarksAssignmentStudentOption | null>(null);
  const [selectedBackupLecturer, setSelectedBackupLecturer] = useState<MarksAssignmentLecturerOption | null>(null);
  const [backupStudentSearch, setBackupStudentSearch] = useState('');
  const [backupLecturerSearch, setBackupLecturerSearch] = useState('');
  const [eligibleStudentCount, setEligibleStudentCount] = useState<number | null>(null);
  const [eligibleStudentCountError, setEligibleStudentCountError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState(() => searchParams.get('period') ?? '');
  const [roleFilter, setRoleFilter] = useState<typeof ALL_ROLES | EvaluationTaskRole>(ALL_ROLES);
  const [statusFilter, setStatusFilter] = useState<typeof ALL_STATUSES | EvaluationPreviewStatus>(ALL_STATUSES);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [confirmBackup, setConfirmBackup] = useState(false);
  const [selectedTask, setSelectedTask] = useState<EvaluationPreviewTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submittingBackup, setSubmittingBackup] = useState(false);
  const backupCommitted = useRef(false);
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
  const [formError, setFormError] = useState<string | null>(null);
  const [backupForm, setBackupForm] = useState<BackupFormState>({
    periodId: '',
    studentId: '',
    evaluatorId: '',
    originalTaskId: '',
    reason: '',
    confirmed: false,
  });

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
      setBackupForm((current) => ({
        ...current,
        periodId: current.periodId || (loadedPeriods[0] ? String(loadedPeriods[0].id) : ''),
      }));
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
  const backupPeriodOptions = availablePeriods.filter(period => String(period.id) === selectedPeriodId);
  const periodHasTasks = tasks.some(task => taskMatchesPeriod(task, selectedPeriodId));

  const selectedPeriod = useMemo(
    () => periods.find((period) => String(period.id) === selectedPeriodId),
    [periods, selectedPeriodId],
  );
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

  useEffect(() => {
    if (!drawerOpen || !backupForm.periodId) return;
    const controller = new AbortController();
    setBackupStudentLookup(current => ({ ...current, loading: true, error: null }));
    const timer = window.setTimeout(() => {
      searchMarksAssignmentStudents(Number(backupForm.periodId), backupStudentSearch, 50, controller.signal)
        .then(result => setBackupStudentLookup({ ...result, loading: false, error: null }))
        .catch(error => {
          if (!controller.signal.aborted) setBackupStudentLookup(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Could not search students.' }));
        });
    }, backupStudentSearch ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [drawerOpen, backupForm.periodId, backupStudentSearch]);

  useEffect(() => {
    if (!drawerOpen) return;
    const controller = new AbortController();
    setBackupLecturerLookup(current => ({ ...current, loading: true, error: null }));
    const timer = window.setTimeout(() => {
      searchMarksAssignmentLecturers(backupLecturerSearch, 50, controller.signal)
        .then(result => setBackupLecturerLookup({ ...result, loading: false, error: null }))
        .catch(error => {
          if (!controller.signal.aborted) setBackupLecturerLookup(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Could not search lecturers.' }));
        });
    }, backupLecturerSearch ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [drawerOpen, backupLecturerSearch]);

  const selectedPeriodAllowsGeneration = Boolean(
    selectedPeriod && generationReady(selectedPeriod),
  );

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesPeriod = taskMatchesPeriod(task, selectedPeriodId);
    const matchesRole = roleFilter === ALL_ROLES || (task.evaluatorRole || 'PANEL') === roleFilter;
    const matchesStatus = statusFilter === ALL_STATUSES || task.status === statusFilter;
    return matchesPeriod && matchesRole && matchesStatus;
  }), [tasks, selectedPeriodId, roleFilter, statusFilter]);

  const totals = useMemo(
    () => deriveTotals(tasks.filter((task) => taskMatchesPeriod(task, selectedPeriodId)), selectedPeriod),
    [tasks, selectedPeriod, selectedPeriodId],
  );

  const originalTaskOptions = useMemo(() => tasks.filter((task) => (
    (!backupForm.periodId || !task.periodId || String(task.periodId) === backupForm.periodId)
    && (!backupForm.studentId || task.studentId === backupForm.studentId)
    && task.evaluatorRole !== 'BACKUP'
  )), [backupForm.periodId, backupForm.studentId, tasks]);
  const selectedBackupPeriod = periods.find((period) => String(period.id) === backupForm.periodId);

  const backupStudentChoices = useMemo(() => {
    const candidates = selectedBackupStudent
      ? [selectedBackupStudent, ...backupStudentLookup.results.filter(item => item.studentId !== selectedBackupStudent.studentId)]
      : backupStudentLookup.results;
    return candidates.map(student => ({
      value: student.studentId,
      label: student.studentName,
      description: `${student.studentId} · ${student.programme || 'Programme not recorded'} · ${student.semester}`,
    }));
  }, [backupStudentLookup.results, selectedBackupStudent]);
  const backupLecturerChoices = useMemo(() => {
    const candidates = selectedBackupLecturer
      ? [selectedBackupLecturer, ...backupLecturerLookup.results.filter(item => item.userId !== selectedBackupLecturer.userId)]
      : backupLecturerLookup.results;
    return candidates.map(lecturer => ({
      value: String(lecturer.userId),
      label: lecturer.fullName,
      description: [lecturer.staffId, lecturer.email, lecturer.department].filter(Boolean).join(' · '),
    }));
  }, [backupLecturerLookup.results, selectedBackupLecturer]);
  const backupOriginalTaskChoices = useMemo(() => [
    { value: '', label: 'No specific official task', description: 'Create a general backup assignment' },
    ...originalTaskOptions.map(task => ({
      value: String(task.taskId ?? task.id),
      label: `${roleLabel(task.evaluatorRole, task.evaluatorRoleLabel)} task`,
      description: `${task.panelMember}${task.taskId ? ` · Task #${task.taskId}` : ''}`,
    })),
  ], [originalTaskOptions]);

  const installPeriod = (period:EvaluationPeriodOption) => setPeriods(current=>current.map(item=>item.id===period.id?period:item));
  const recoverGeneration = async () => {
    if(generationBusy.current)return;
    generationBusy.current=true;setGenerating(true);
    try {await loadWorkspace(true);setGenerationBlocked(false);setGenerationCommitted(null);setGenerationError(null);}
    catch(e){setGenerationError(`Couldn’t reload assignment workspace. ${marksMutationErrorMessage(e)}`);}
    finally {generationBusy.current=false;setGenerating(false);}
  };
  const handleGenerateTasks = async () => {
    if(generationBusy.current || generationBlocked || generationCommitted || !selectedPeriod || fallbackDirty || fallbackBusy || drawerOpen)return;
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

  const openBackupDrawer = () => {
    if(generationBusy.current || generationReview || fallbackBusy)return;
    backupCommitted.current = false;
    setFormError(null);
    setBackupForm({
      periodId: backupPeriodOptions[0] ? String(backupPeriodOptions[0].id) : '',
      studentId: '',
      evaluatorId: '',
      originalTaskId: '',
      reason: '',
      confirmed: false,
    });
    setSelectedBackupStudent(null);
    setSelectedBackupLecturer(null);
    setBackupStudentSearch('');
    setBackupLecturerSearch('');
    setBackupStudentLookup({ results: [], total: 0, limit: 50, loading: true, error: null });
    setBackupLecturerLookup({ results: [], total: 0, limit: 50, loading: true, error: null });
    setDrawerOpen(true);
  };

  const validateBackupForm = (): string | null => {
    if (!backupForm.periodId) return 'Evaluation period is required.';
    if (!backupForm.studentId) return 'Student is required.';
    if (!backupForm.evaluatorId) return 'Backup lecturer is required.';
    if (!backupForm.reason.trim()) return 'Backup assignment reason is required.';
    if (!backupForm.confirmed) return 'Confirm that this is an exception assignment before submitting.';
    return null;
  };

  const reviewBackup = () => {
    const validation = validateBackupForm(); setFormError(validation);
    if (!validation) setConfirmBackup(true);
  };
  const handleBackupSubmit = async () => {
    if (validateBackupForm()) return false;
    setSubmittingBackup(true);
    try {
      return await completeDecision(async () => { const task = await createBackupEvaluationTask(Number(backupForm.periodId), {
        studentId: backupForm.studentId, evaluatorId: Number(backupForm.evaluatorId),
        reason: backupForm.reason.trim(),
        originalTaskId: backupForm.originalTaskId ? Number(backupForm.originalTaskId) : undefined,
      });
        backupCommitted.current = true;
        setActivities(prev => [{id: String(Date.now()), date: 'Today', action: 'Backup evaluator assigned',
          details: `${task.studentId} assigned as ${task.evaluatorRoleLabel || 'Backup / Manual Override'}`,
          performedBy: 'Office Staff/Admin'}, ...prev]);
      }, () => loadWorkspace(true));
    } finally { setSubmittingBackup(false); }
  };

  return (
    <div id="eval-assignment-workspace" className="marks-workspace space-y-6 relative text-left">
      {!drawerOpen ? <DraftNavigationGuard dirty={fallbackDirty} busy={generating || fallbackBusy}/> : null}
      <PortalConfirmModal isOpen={!!generationReview} title="Generate evaluation tasks?" tone="warning"
        message={generationReview ? <div className="space-y-3"><p>{generationReview.name} · {generationReview.semester}</p><p>Saved scope: {formatPeriodTargeting(generationReview)}. Roles: {generationReview.evaluatorRoles.join(', ')}.</p><p>Rubric: {generationReview.rubricName}. Readiness: {formatPeriodStatus(generationReview.effectiveStatus)}.</p><p>Saved window: {formatDate(generationReview.opensAt)} – {formatDate(generationReview.closesAt)}.</p><p>Currently loaded tasks: {generationReview.taskTotals.total}. This is not an exact missing-task preview. The server determines final created and total counts. Existing assignments and marks are preserved.</p></div> : null}
        confirmLabel="Generate tasks" isLoading={generating} onConfirm={commitGeneration} onCancel={()=>{if(!generationBusy.current)setGenerationReview(null);}}/>
      {generationCommitted ? <div role="status" className="space-y-2"><p>{generationCommitted} Workspace refresh required.</p><PortalButton disabled={generating} onClick={recoverGeneration}>Reload workspace</PortalButton></div> : null}
      {generationError ? <div role="alert" className="text-red-700"><p>{generationError}</p>{generationBlocked ? <PortalButton disabled={generating} onClick={recoverGeneration}>Review latest workspace</PortalButton> : null}</div> : null}
      <DecisionDialog isOpen={confirmBackup} kind="confirmation" decisionKey={`${backupForm.studentId}:${backupForm.evaluatorId}`}
        title="Assign this backup evaluator?" context={<p>{selectedBackupStudent?.studentName} · {backupForm.studentId} · {selectedBackupLecturer?.fullName} · {selectedBackupPeriod?.name}</p>}
        message={<><p>This creates an exception evaluation task and leaves official Supervisor and Panel appointments unchanged.</p><p>Reason: {backupForm.reason}</p></>}
        confirmLabel="Assign backup evaluator" successMessage="Backup evaluator task created."
        busy={submittingBackup} canConfirm={!backupCommitted.current && !validateBackupForm()} onConfirm={handleBackupSubmit}
        onClose={() => {
          setConfirmBackup(false);
          if (backupCommitted.current) {
            setDrawerOpen(false);
            setBackupForm(current => ({ ...current, studentId: '', evaluatorId: '', originalTaskId: '', reason: '', confirmed: false }));
          }
        }} onReload={() => loadWorkspace(true)} />

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
                  <PortalSelect id="assignment-period" disabled={generating || !!generationReview || fallbackDirty || fallbackBusy} aria-label="Evaluation period" className="form-control form-control-md w-full" value={selectedPeriodId}
                    onChange={event => {
                      setSelectedPeriodId(event.target.value);
                      setBackupForm(current => ({ ...current, periodId: event.target.value }));
                    }}>
                    <option value="" disabled hidden={availablePeriods.length > 0}>No open or scheduled periods</option>
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
                  <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium">{[Boolean(selectedPeriodId), selectedPeriodAllowsGeneration, Boolean(selectedPeriod?.rubricName), eligibleStudentCount !== null && eligibleStudentCount > 0].filter(Boolean).length}/4 checks<ChevronDown aria-hidden="true" className="h-4 w-4" /></span>
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
                        { label: 'Evaluation period selected', passed: Boolean(selectedPeriodId) },
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
              <PortalButton icon={ShieldAlert} disabled={generating || !!generationReview || fallbackBusy || backupPeriodOptions.length === 0} onClick={openBackupDrawer}>Assign backup evaluator</PortalButton>
            </div>
            {periodHasTasks ? <WorkspaceFilterCard onReset={() => { setRoleFilter(ALL_ROLES); setStatusFilter(ALL_STATUSES); }}
              fieldsClassName="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
              <label className="form-label min-w-0">Evaluator role
                <PortalSelect aria-label="Evaluator role" className="form-control form-control-sm mt-1" value={roleFilter}
                  onChange={event => setRoleFilter(event.target.value as typeof ALL_ROLES | EvaluationTaskRole)}>
                  <option value={ALL_ROLES}>All roles ({totals.total})</option>
                  <option value="SUPERVISOR">Supervisor ({totals.supervisor})</option>
                  <option value="PANEL">Panel ({totals.panel})</option>
                  <option value="BACKUP">Backup ({totals.backup})</option>
                </PortalSelect>
              </label>
              <label className="form-label min-w-0">Task status
                <PortalSelect aria-label="Task status" className="form-control form-control-sm mt-1" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof ALL_STATUSES | EvaluationPreviewStatus)}>
                  <option value={ALL_STATUSES}>All statuses</option><option value="NOT_STARTED">Not started</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Submitted</option>
                </PortalSelect>
              </label>
            </WorkspaceFilterCard> : null}
            {periodHasTasks ? <div className="flex flex-wrap items-center justify-between gap-3">
              <dl aria-label="Submission counts" className="flex flex-wrap gap-x-5 gap-y-2">
                {[
                  ['Submitted', totals.submitted], ['Incomplete', totals.incomplete], ['Overdue', totals.overdue],
                ].map(([label, value]) => <div key={String(label)} className="flex items-baseline gap-1.5"><dt className="card-description">{label}</dt><dd className="text-sm font-semibold tabular-nums text-brand-navy">{value}</dd></div>)}
              </dl>
              <p role="status" className="card-description">{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} shown</p>
            </div> : null}
            {filteredTasks.length === 0 ? <div className="rounded-xl bg-slate-50 px-4 py-6">
              <h3 className="text-sm font-semibold text-brand-navy">{tasks.some(task => taskMatchesPeriod(task, selectedPeriodId)) ? 'No tasks match these filters' : 'No evaluation tasks yet'}</h3>
              <p className="card-description mt-2 max-w-prose">{tasks.some(task => taskMatchesPeriod(task, selectedPeriodId)) ? 'Change the role or status, or clear the filters to see all tasks in this period scope.' : !selectedPeriod ? 'Configure and select an evaluation period, then generate its assignments above.' : 'Generate evaluation tasks for this period using the button above.'}</p>
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
                    <td className="data-td"><p>{task.panelMember}</p><p className={`mt-1 text-xs ${task.evaluatorRole === 'BACKUP' ? 'text-amber-800' : 'text-slate-500'}`}>{roleLabel(task.evaluatorRole, task.evaluatorRoleLabel)}</p></td>
                    <td className="data-td">{task.semester}</td>
                    <td className="data-td"><StatusBadge className="marks-state whitespace-nowrap" tone={task.status === 'SUBMITTED' ? 'success' : task.status === 'OVERDUE' ? 'danger' : 'neutral'}>{statusLabel(task.status)}</StatusBadge></td>
                    <td className="data-td text-left"><PortalButton onClick={() => setSelectedTask(task)} aria-label={`View task for ${task.studentName}, ${roleLabel(task.evaluatorRole, task.evaluatorRoleLabel)}`}>View</PortalButton></td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
            {!onManageTimeline ? <RecordDraft.Provider value={reportFallback}><fieldset disabled={generating || !!generationReview}><MarksTaskDeadlineEntryPoint tasks={tasks} onChanged={async () => {
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

      {drawerOpen ? <RecordPage title="Assign Backup Evaluator" subtitle="Create an exception task and record why it is needed." backLabel="Back to Evaluation Task Assignment" onBack={() => setDrawerOpen(false)} pageKey="marks-backup-evaluator" navigationComplete={backupCommitted} dirty={!backupCommitted.current && (!!backupForm.studentId || !!backupForm.evaluatorId || !!backupForm.originalTaskId || !!backupForm.reason.trim() || backupForm.confirmed)} busy={submittingBackup}>{requestBack => <section className="space-y-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">

                <div className="space-y-7">
                  <div className="space-y-5">
                    <label htmlFor="backup-assignment-period" className="form-label block space-y-2">
                      Assignment period
                      <PortalSelect
                        id="backup-assignment-period"
                        className="form-control form-control-md"
                        value={backupForm.periodId}
                        onChange={(event) => {
                          setBackupForm((current) => ({
                            ...current,
                            periodId: event.target.value,
                            studentId: '',
                            originalTaskId: '',
                          }));
                          setSelectedBackupStudent(null);
                          setBackupStudentSearch('');
                          setBackupLecturerSearch('');
                          setBackupStudentLookup({ results: [], total: 0, limit: 50, loading: true, error: null });
                        }}
                      >
                        {backupPeriodOptions.map((period) => (
                          <option key={period.id} value={period.id}>{period.name} · {period.semester} · {formatPeriodTargeting(period)}</option>
                        ))}
                      </PortalSelect>
                    </label>
                    <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                      <div className="min-w-0 space-y-2">
                        <label htmlFor="backup-student-picker" className="form-label block">Student <span className="text-rose-600" aria-hidden="true">*</span></label>
                        <SelectMenu
                          id="backup-student-picker"
                          aria-label="Student"
                          value={backupForm.studentId}
                          options={backupStudentChoices}
                          searchPlaceholder="Search student name, ID or programme"
                          searchMode="inline"
                          searchResultCount={backupStudentLookup.total}
                          searchResultsLoading={backupStudentLookup.loading}
                          searchResultsError={backupStudentLookup.error}
                          onSearchChange={setBackupStudentSearch}
                          placeholder={backupForm.periodId ? 'Choose a student' : 'Select a period first'}
                          disabled={!backupForm.periodId || submittingBackup}
                          onChange={studentId => {
                            setSelectedBackupStudent(
                              backupStudentLookup.results.find(student => student.studentId === studentId)
                                ?? (selectedBackupStudent?.studentId === studentId ? selectedBackupStudent : null),
                            );
                            setBackupForm(current => ({ ...current, studentId, originalTaskId: '' }));
                          }}
                        />
                        {backupStudentLookup.error ? <p role="alert" className="text-xs leading-5 text-rose-700">{backupStudentLookup.error}</p> : null}
                        {!backupStudentLookup.loading && !backupStudentLookup.error && !backupStudentLookup.total && backupForm.periodId ? <p className="card-description">No eligible students are available in this period.</p> : null}
                      </div>

                      <div className="min-w-0 space-y-2">
                        <label htmlFor="backup-lecturer-picker" className="form-label block">Backup lecturer <span className="text-rose-600" aria-hidden="true">*</span></label>
                        <SelectMenu
                          id="backup-lecturer-picker"
                          aria-label="Backup lecturer"
                          value={backupForm.evaluatorId}
                          options={backupLecturerChoices}
                          searchPlaceholder="Search lecturer name, staff ID or department"
                          searchMode="inline"
                          searchResultCount={backupLecturerLookup.total}
                          searchResultsLoading={backupLecturerLookup.loading}
                          searchResultsError={backupLecturerLookup.error}
                          onSearchChange={setBackupLecturerSearch}
                          placeholder="Choose a backup lecturer"
                          disabled={submittingBackup}
                          onChange={evaluatorId => {
                            setSelectedBackupLecturer(
                              backupLecturerLookup.results.find(lecturer => String(lecturer.userId) === evaluatorId)
                                ?? (String(selectedBackupLecturer?.userId) === evaluatorId ? selectedBackupLecturer : null),
                            );
                            setBackupForm(current => ({ ...current, evaluatorId }));
                          }}
                        />
                        {backupLecturerLookup.error ? <p role="alert" className="text-xs leading-5 text-rose-700">{backupLecturerLookup.error}</p> : null}
                        {!backupLecturerLookup.loading && !backupLecturerLookup.error && !backupLecturerLookup.total ? <p className="card-description">No eligible lecturers are available.</p> : null}
                      </div>
                    </div>

                    {backupForm.studentId ? <div className="space-y-2 border-t border-slate-100 pt-5">
                      <label htmlFor="backup-original-task-picker" className="form-label block">Official task this backup covers <span className="font-normal normal-case tracking-normal text-slate-500">(optional)</span></label>
                      <p id="backup-original-task-help" className="card-description leading-6">Link this backup to the student’s Supervisor or Panel task. Leave it unlinked for a general backup assignment.</p>
                      <SelectMenu
                        id="backup-original-task-picker"
                        aria-label="Official task this backup covers, optional"
                        aria-describedby="backup-original-task-help"
                        value={backupForm.originalTaskId}
                        options={backupOriginalTaskChoices}
                        searchPlaceholder="Search official task or evaluator"
                        searchMode="inline"
                        maxSearchResults={50}
                        placeholder="No specific official task"
                        disabled={submittingBackup}
                        onChange={originalTaskId => setBackupForm(current => ({ ...current, originalTaskId }))}
                      />
                      {!originalTaskOptions.length ? <p className="card-description">No official Supervisor or Panel task is available for this student in the selected period. You can still create a general backup assignment.</p> : null}
                    </div> : null}
                  </div>

                  <div className="space-y-5 border-t border-slate-100 pt-6">
                    <label className="form-label block space-y-2">
                      Reason for this exception <span className="text-rose-600" aria-hidden="true">*</span>
                    <textarea
                      aria-label="Reason for this exception"
                      className="form-control form-control-md min-h-[120px]"
                      value={backupForm.reason}
                      onChange={(event) => setBackupForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))}
                      placeholder="Example: Appointed evaluator is unavailable due to medical leave."
                    />
                    </label>

                  <label className="card-description flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={backupForm.confirmed}
                      onChange={(event) => setBackupForm((current) => ({
                        ...current,
                        confirmed: event.target.checked,
                      }))}
                    />
                    <span className="font-bold leading-relaxed">
                      I confirm this is an exception assignment. It does not change the official supervisor or panel appointment.
                    </span>
                  </label>
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-100 pt-5">
                  {formError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{formError}</div> : null}
                  <div className="flex flex-wrap justify-end gap-3">
                    <PortalButton size="sm" onClick={requestBack}>Cancel</PortalButton>
                    <PortalButton size="sm" variant="primary" disabled={submittingBackup} isLoading={submittingBackup} onClick={reviewBackup}>
                      {submittingBackup ? 'Assigning…' : 'Assign backup'}
                    </PortalButton>
                  </div>
                </div>
              </section>}</RecordPage> : null}

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
