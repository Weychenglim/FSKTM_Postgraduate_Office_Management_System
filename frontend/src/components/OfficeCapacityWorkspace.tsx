import {AlertMessage} from './AlertMessage';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Eye, Gauge, History, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { cloneSemesterCapacityPlan, createSemesterCapacityPlan, discardSemesterCapacityPlan, getSemesterCapacityPlans, getWorkingCapacityPlans, publishSemesterCapacityPlan, updateLecturerCapacityEntry, updateLecturerCapacityEntriesBulk } from '../services/lecturerCapacityApi';
import { getAcademicSemesters as readSemesters } from '../services/academicSemestersApi';
import { getCapacityWorkspace, type CapacityWorkspace, type CapacityWorkspaceLecturer } from '../services/capacityWorkspaceApi';
import type { AcademicSemester, CapacityRole, SemesterCapacityPlan } from '../types';
import { canMutateSemesterCapacity, capacityConflictMessage, capacityStateLabel, validateCapacityDraftEntry } from '../utils/lecturerCapacity';
import { capacityRowIssues, capacityWorkspaceRows, capacityComparisonRows, capacityHasRole, committedCapacityLoad } from '../utils/capacityWorkspace';
import { findEligiblePriorCapacitySource, publishedOperationalPolicy, readCompleteCapacityHistory } from './officeCapacityManagement';
import { PageHeader, PortalButton, StatusBadge } from './PortalPrimitives';
import { PortalSelect } from './PortalSelect';
import { OverflowMenu } from './DocumentParts';
import { OfficeToolSection } from './OfficeToolPrimitives';
import { CoordinatorDataTable } from './CoordinatorBrowsePrimitives';
import { WorkspacePagination, WorkspaceFilterCard } from './RequestWorkspacePrimitives';
import { EmptyState, ErrorState, LoadingState } from './StateViews';
import { CapacityPolicySummary } from './CapacityPolicySummary';
import {CapacityBulkDialog} from './CapacityBulkDialog';
import {canBulkConfigure} from '../utils/capacityBulk';
import type {CapacityBulkCommand} from '../types/lecturerCapacity';
import { CapacityCollectionPage } from './CapacityCollectionPage';
import { CapacityPreparationForm } from './CapacityPreparationForm';
import { CapacityLecturerDialog } from './CapacityLecturerDialog';
import {DecisionFeedbackProvider, useDecisionFeedback} from './DecisionFeedback';
import {DraftNavigationGuard} from './DraftNavigationGuard';
import { DecisionDialog } from './DecisionDialog';
import { completeDecision } from '../utils/decisionSubmission';
import { RightDrawer } from './RightDrawer';
import { useReturnToFocusReload } from '../utils/returnToFocus';
import {OfficeAcademicSemesterSelect} from './OfficeAcademicSemesterSelect';

type View = 'overview' | 'editor' | 'version' | 'history' | 'availability' | 'activity';
type Drawer = 'prepare' | 'entry' | 'details' | 'compare' | 'publish' | 'bulk' | null;
const date = (value: string | null | undefined) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';
const stamp = (value: string) => new Date(value).toLocaleString('en-MY');
const display = (value: number | null | undefined) => value == null ? 'Unavailable' : value;

export function OfficeCapacityWorkspace({ onBack, backLabel = 'Back to Dashboard' }: { onBack: () => void; backLabel?: string }) {
  return <DecisionFeedbackProvider scopeKey="office-capacity-workspace"><OfficeCapacityWorkspaceContent onBack={onBack} backLabel={backLabel}/></DecisionFeedbackProvider>;
}

function OfficeCapacityWorkspaceContent({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  const [semesters, setSemesters] = useState<AcademicSemester[]>([]), [semesterId, setSemesterId] = useState<number | null>(null);
  const [plans, setPlans] = useState<SemesterCapacityPlan[]>([]), [workspace, setWorkspace] = useState<CapacityWorkspace | null>(null);
  const [revision, setRevision] = useState(0);
  const [activityVersion, setActivityVersion] = useState<number | undefined>();
  const [availabilityLecturer, setAvailabilityLecturer] = useState<{id:number;name:string} | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null), [view, setView] = useState<View>('overview');
  const [drawer, setDrawer] = useState<Drawer>(null), [entry, setEntry] = useState<CapacityWorkspaceLecturer | null>(null);
  const [selectedLecturers, setSelectedLecturers] = useState<number[]>([]);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('lecturer') ?? '');
  const [role, setRole] = useState<'ALL' | CapacityRole>('ALL'), [needsSetup, setNeedsSetup] = useState(false);
  const [page, setPage] = useState(1), [size, setSize] = useState(10);
  const [supervisorLimit, setSupervisorLimit] = useState(''), [panelLimit, setPanelLimit] = useState('');
  const [publishSession, setPublishSession] = useState(0);
  const [publishReason, setPublishReason] = useState(''), [publishConfirmed, setPublishConfirmed] = useState(false);
  const [compareLoading,setCompareLoading] = useState(false);
  const [copySource, setCopySource] = useState<SemesterCapacityPlan | null>(null), [copyLoading, setCopyLoading] = useState(false), [comparePlanId, setComparePlanId] = useState<number | null>(null);
  const [discardPlan, setDiscardPlan] = useState<SemesterCapacityPlan | null>(null), [discardReason, setDiscardReason] = useState('');
  const [loading, setLoading] = useState(true), [ready, setReady] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null), [drawerError, setDrawerError] = useState<string | null>(null);
  const [bulkDirty, setBulkDirty] = useState(false), [committedRefreshFailed, setCommittedRefreshFailed] = useState(false);
  const [pendingPreparationClose, setPendingPreparationClose] = useState(false);
  const feedback = useDecisionFeedback();
  const generation = useRef(0), copyGeneration = useRef(0), writing = useRef(false);
  const semesterGeneration = useRef(0), selectedSemesterId = useRef(semesterId);
  selectedSemesterId.current = semesterId;
  const availableSemesters = semesters.filter(row => row.lifecycleStatus !== 'ARCHIVED');
  const semester = semesters.find(row => row.id === semesterId) ?? null;
  const published = publishedOperationalPolicy(plans), selected = plans.find(row => row.id === selectedPlanId) ?? null;
  const editing = view === 'editor' && selected?.lifecycleStatus === 'DRAFT';
  const inspecting = view === 'editor' || view === 'version';
  const mutable = !!semester && canMutateSemesterCapacity(semester.lifecycleStatus);
  const drafts = plans.filter(row => row.lifecycleStatus === 'DRAFT');
  const rows = useMemo(() => capacityWorkspaceRows(workspace?.lecturers ?? [], inspecting ? selected : null), [workspace, selected, inspecting]);
  const visible = useMemo(() => rows.filter(row => (!search.trim() || `${row.lecturerName} ${row.staffNo}`.toLowerCase().includes(search.trim().toLowerCase())) && (role === 'ALL' || capacityHasRole(row,role,inspecting)) && (!needsSetup || capacityRowIssues(row, selected).length > 0)), [rows, search, role, needsSetup, selected, inspecting]);
  const pages = Math.max(1, Math.ceil(visible.length / size)), shown = visible.slice((Math.min(page, pages) - 1) * size, Math.min(page, pages) * size);
  const eligibleMatching = visible.filter(canBulkConfigure), eligiblePage = shown.filter(canBulkConfigure);
  const selectedRows = rows.filter(row => selectedLecturers.includes(row.lecturerId) && canBulkConfigure(row));
  useEffect(() => {setSelectedLecturers([]);}, [search, role, needsSetup, semesterId, selectedPlanId]);
  const overviewTop = useRef(0);
  const overviewPage = useRef(1);
  const [draftsOnly,setDraftsOnly] = useState(false);
  const changeView = (next: View) => {
    if (view === 'overview' && next !== 'overview') { overviewTop.current = window.scrollY; overviewPage.current = page; }
    if (next === 'overview') setPage(overviewPage.current);
    setView(next);
  };
  useLayoutEffect(() => {
    const heading = document.querySelector<HTMLElement>('.capacity-workspace h1');
    heading?.setAttribute('tabindex','-1'); heading?.focus({preventScroll:true});
    window.scrollTo({top:view === 'overview' ? overviewTop.current : 0, behavior:'instant'});
  }, [view]);
  const notify = (message: string, tone: 'success' | 'warning' = 'success') => feedback?.(message, tone);
  const load = useCallback(async (id: number) => {
    const token = ++generation.current; setLoading(true); setReady(false); setError(null);
    try {
      const [nextPlans, nextRoster] = await Promise.all([
        readCompleteCapacityHistory(query => getWorkingCapacityPlans(id, query)), getCapacityWorkspace(id),
      ]);
      if (token !== generation.current) return;
      setPlans(current => [...nextPlans, ...current.filter(plan => plan.semesterId === id && !nextPlans.some(next => next.id === plan.id) && !['DRAFT', 'PUBLISHED'].includes(plan.lifecycleStatus))]); setWorkspace(nextRoster); setRevision(value => value + 1); setReady(true); setCommittedRefreshFailed(false); return true;
    } catch (reason) { if (token === generation.current) setError(capacityConflictMessage(reason)); return false; }
    finally { if (token === generation.current) setLoading(false); }
  }, []);
  const loadSemesters = useCallback(async () => {
    const token = ++semesterGeneration.current;
    setLoading(true); setReady(false); setError(null);
    try {
      // Keep archived semesters as copy sources, never as working destinations.
      const next = await readSemesters(true);
      if (token !== semesterGeneration.current) return;
      setSemesters(next);
      const available = next.filter(row => row.lifecycleStatus !== 'ARCHIVED');
      const current = selectedSemesterId.current;
      const requested = current === null ? new URLSearchParams(window.location.search).get('semester') : String(current);
      if (requested && !available.some(row => String(row.id) === requested)) {
        generation.current++; setSemesterId(null); setSelectedPlanId(null); setPlans([]); setWorkspace(null);
        setError(next.some(row => String(row.id) === requested && row.lifecycleStatus === 'ARCHIVED')
          ? 'This semester has been archived. Choose an available semester.'
          : 'The requested semester is unavailable. Choose an available semester.');
        setLoading(false); return null;
      }
      const id = requested ? Number(requested) : available.find(row => row.lifecycleStatus === 'ACTIVE')?.id ?? available.find(row => row.lifecycleStatus === 'DRAFT')?.id ?? available[0]?.id ?? null;
      setSemesterId(id);
      if (id === null) setLoading(false);
      return id;
    } catch (reason) { if (token === semesterGeneration.current) {setError(capacityConflictMessage(reason)); setLoading(false);} }
  }, []);
  useEffect(() => { void loadSemesters(); return () => {semesterGeneration.current++;}; }, [loadSemesters]);
  useEffect(() => { if (semesterId !== null) void load(semesterId); return () => { generation.current++; copyGeneration.current++; }; }, [load, semesterId]);
  useReturnToFocusReload(() => { void loadSemesters().then(id => {if (id != null && id === semesterId) void load(id);}); }, !loading && !saving && drawer === null && discardPlan === null && (view === 'overview' || inspecting));
  useEffect(() => { setPage(1); }, [search, role, needsSetup, semesterId]);
  const close = () => { copyGeneration.current++; setDrawer(null); setDrawerError(null); setEntry(null); setPublishReason(''); setPublishConfirmed(false); setBulkDirty(false); };
  const openPlan = (plan: SemesterCapacityPlan, nextView: View, closePreparation = true) => { setPlans(current => [plan, ...current.filter(item => item.id !== plan.id)]); setSelectedPlanId(plan.id); changeView(nextView); setNeedsSetup(false); setPage(1); if (closePreparation) close(); else setPendingPreparationClose(true); };
  const settlePreparation = () => {setPendingPreparationClose(false); close();};
  const create = async (source: SemesterCapacityPlan | null = null) => {
    if (!ready || !mutable || semesterId === null || writing.current) return; writing.current = true; setSaving(true); setDrawerError(null);
    try { const created = await createSemesterCapacityPlan(semesterId, source?.id ?? null); const refreshed = await load(semesterId); openPlan(created, 'editor', false); if (!refreshed) {setError(null); setCommittedRefreshFailed(true);} notify(refreshed ? `Draft v${created.version} created. You are now editing it.` : `Draft v${created.version} was created, but the latest limits could not be loaded. Reload before another action.`, refreshed ? 'success' : 'warning'); }
    catch (reason) { setDrawerError(capacityConflictMessage(reason)); } finally { writing.current = false; setSaving(false); }
  };
  const revise = async (source: SemesterCapacityPlan) => {
    if (!ready || !mutable || writing.current) return; writing.current = true; setSaving(true); setDrawerError(null);
    try { const created = await cloneSemesterCapacityPlan(source.id); const refreshed = semesterId !== null && await load(semesterId); openPlan(created, 'editor', false); if (!refreshed) {setError(null); setCommittedRefreshFailed(true);} notify(refreshed ? `Draft v${created.version} created from version ${source.version}.` : `Draft v${created.version} was created from version ${source.version}, but the latest limits could not be loaded. Reload before another action.`, refreshed ? 'success' : 'warning'); }
    catch (reason) { setDrawerError(capacityConflictMessage(reason)); } finally { writing.current = false; setSaving(false); }
  };
  const openPreparation = () => { copyGeneration.current++; setCopySource(null); setCopyLoading(false); setDrawerError(null); setDrawer('prepare'); };
  const beginCopy = async () => {
    if (!semester) return; const token = ++copyGeneration.current; setCopyLoading(true); setCopySource(null); setDrawerError(null);
    try { const source = await findEligiblePriorCapacitySource(semesters, semester, id => readCompleteCapacityHistory(query => getSemesterCapacityPlans(id, query))); if (token === copyGeneration.current) setCopySource(source); }
    catch (reason) { if (token === copyGeneration.current) setDrawerError(capacityConflictMessage(reason)); }
    finally { if (token === copyGeneration.current) setCopyLoading(false); }
  };
  const editEntry = (row: CapacityWorkspaceLecturer) => { setEntry(row); setSupervisorLimit(row.supervisorLimit === null ? '' : String(row.supervisorLimit)); setPanelLimit(row.panelLimit === null ? '' : String(row.panelLimit)); setDrawerError(null); setDrawer('entry'); };
  const saveEntry = async () => {
    if (!ready || !editing || !mutable || !selected || !entry || entry.canConfigure === false || writing.current) return;
    const nextSupervisor = entry.supervisor && supervisorLimit.trim() ? Number(supervisorLimit) : null, nextPanel = entry.panel && panelLimit.trim() ? Number(panelLimit) : null;
    const issues = validateCapacityDraftEntry({ hasSupervisorRole: !!entry.supervisor, hasPanelRole: !!entry.panel, supervisorLimit: nextSupervisor, panelLimit: nextPanel });
    if ((nextSupervisor !== null && !Number.isSafeInteger(nextSupervisor)) || (nextPanel !== null && !Number.isSafeInteger(nextPanel))) issues.push('Limits must be whole numbers.');
    if (issues.length) { setDrawerError(issues.join(' ')); return; }
    writing.current = true; setSaving(true); setDrawerError(null);
    try { const updated = await updateLecturerCapacityEntry(selected.id, entry.lecturerId, { supervisorLimit: nextSupervisor, panelLimit: nextPanel, expectedVersion: selected.version, expectedFingerprint: selected.contentFingerprint }); setPlans(current => current.map(plan => plan.id === updated.id ? updated : plan)); close(); notify('Lecturer capacity limits saved.'); }
    catch (reason) { setDrawerError(capacityConflictMessage(reason)); if (semesterId !== null) await load(semesterId); }
    finally { writing.current = false; setSaving(false); }
  };
  const publish = async () => {
    if (!ready || !editing || !mutable || !selected || !selected.isComplete || selected.readinessErrors.length || !publishReason.trim() || !publishConfirmed || writing.current) return false;
    const target = selected;
    writing.current = true; setSaving(true);
    try {
      const outcome = await completeDecision(async () => {
        const updated = await publishSemesterCapacityPlan(target.id, { reason: publishReason.trim(), expectedVersion: target.version, expectedFingerprint: target.contentFingerprint });
        setPlans(current => current.map(plan => plan.id === updated.id ? updated : plan));
      }, async () => { if (semesterId === null || !await load(semesterId)) throw new Error('Could not reload capacity limits.'); });
      changeView('overview');
      return outcome;
    } finally { writing.current = false; setSaving(false); }
  };
  const saveBulk = async (command: CapacityBulkCommand): Promise<void | false> => {
    if (!ready || !editing || !mutable || !selected || writing.current) return false;
    writing.current = true; setSaving(true);
    try {
      const updated = await updateLecturerCapacityEntriesBulk(selected.id, command);
      setPlans(current => current.map(plan => plan.id === updated.id ? updated : plan));
      setSelectedLecturers([]);
    } finally {writing.current = false; setSaving(false);}
  };
  const openCompare = async () => {
    if (semesterId === null) return;
    const token = ++copyGeneration.current; setCompareLoading(true); setDrawerError(null); setDrawer('compare');
    try { const all = await readCompleteCapacityHistory(query => getSemesterCapacityPlans(semesterId, query)); if (token === copyGeneration.current) {setPlans(all); setComparePlanId(all.find(plan => plan.id !== selected?.id)?.id ?? null);} }
    catch (reason) { if (token === copyGeneration.current) setDrawerError(capacityConflictMessage(reason)); }
    finally { if (token === copyGeneration.current) setCompareLoading(false); }
  };
  const compare = plans.find(plan => plan.id === comparePlanId) ?? null;
  const roleValues = (row: CapacityWorkspaceLecturer, proposed = false) => <div className="space-y-2">{(['SUPERVISOR', 'PANEL'] as const).map(value => { const resolution = value === 'SUPERVISOR' ? row.supervisor : row.panel; const savedLimit = value === 'SUPERVISOR' ? row.supervisorLimit : row.panelLimit; if (!resolution && (!proposed || savedLimit === null)) return null; const limit = proposed ? savedLimit : resolution!.limit; return <p key={value}><span className="capacity-role-name">{value === 'SUPERVISOR' ? 'Supervisor' : 'Panel'}</span><strong className={limit === null ? 'text-amber-800' : 'text-brand-navy'}>{limit ?? 'Not set'}</strong>{proposed && <span className="capacity-current-value">Current: {resolution ? resolution.limit ?? 'Not set' : 'Role not held'}</span>}</p>; })}</div>;
  const availability = (row: CapacityWorkspaceLecturer) => {
    const current = row.availabilitySummary?.current ?? Number(row.supervisor?.state === 'TEMPORARILY_UNAVAILABLE' || row.panel?.state === 'TEMPORARILY_UNAVAILABLE');
    const scheduled = row.availabilitySummary?.scheduled ?? 0;
    return current || scheduled ? <div className="space-y-1">{current > 0 && <StatusBadge tone="warning">Unavailable</StatusBadge>}{scheduled > 0 && <p className="text-slate-600">{scheduled} scheduled</p>}</div> : <span className="text-slate-700">No restriction</span>;
  };
  const entryPublicationIssues = entry ? (['SUPERVISOR', 'PANEL'] as const).flatMap(role => {
    const value = role === 'SUPERVISOR' ? supervisorLimit : panelLimit;
    const minimum = committedCapacityLoad(entry, role);
    const proposed = Number(value);
    return value.trim() && Number.isSafeInteger(proposed) && proposed >= 0 && minimum !== null && proposed < minimum
      ? [`${role === 'SUPERVISOR' ? 'Supervisor' : 'Panel'} limit ${proposed} is below committed workload ${minimum}.`]
      : [];
  }) : [];
  const footer = (total: number, current: number, onPage: (value: number) => void, noun: string) => <WorkspacePagination total={total} page={Math.min(current, Math.max(1, Math.ceil(total / size)))} pageCount={Math.max(1, Math.ceil(total / size))} pageSize={size} onPage={onPage} onPageSize={value => { setSize(value); setPage(1); }} noun={noun} />;
  const entryDirty = drawer === 'entry' && !!entry && (supervisorLimit !== String(entry.supervisorLimit ?? '') || panelLimit !== String(entry.panelLimit ?? ''));
  const workspaceDirty = entryDirty || drawer === 'bulk' && bulkDirty || drawer === 'publish' && (!!publishReason.trim() || publishConfirmed) || discardPlan !== null && !!discardReason.trim();
  const workspaceBusy = saving && drawer !== 'prepare' && drawer !== 'compare';
  return <div data-capacity-view={view} className="office-tool-page capacity-workspace space-y-6 pb-12">
    <DraftNavigationGuard dirty={workspaceDirty} busy={workspaceBusy} onDiscard={() => {close(); setDiscardPlan(null); setDiscardReason('');}}/>
    {committedRefreshFailed && <AlertMessage type="warning" title="Draft created; refresh needed" message="The draft was saved, but current limits could not be loaded. Reload before another action." actions={semesterId !== null ? <PortalButton onClick={() => void load(semesterId)}>Reload limits</PortalButton> : undefined}/>}
    <PageHeader title={view === 'history' ? 'Capacity versions' : view === 'availability' ? 'Lecturer availability' : view === 'activity' ? 'Capacity activity log' : 'Lecturer capacity'} subtitle={view === 'overview' ? 'Review workload and manage semester limits.' : undefined} backLabel={view === 'overview' ? backLabel : 'Back to Lecturer capacity'} onBack={view === 'overview' ? onBack : () => { changeView('overview'); setNeedsSetup(false); }} />
    <OfficeAcademicSemesterSelect id="capacity-academic-semester" dateId="capacity-semester-dates" semesters={availableSemesters} selectedId={semesterId}
      disabled={loading || saving || drawer !== null || discardPlan !== null}
      onChange={id => {setReady(false);setSemesterId(id);setAvailabilityLecturer(null);changeView('overview');setSelectedPlanId(null);}}/>
    {loading ? <LoadingState message="Loading Lecturer capacity…" /> : error ? <ErrorState compact title="Couldn’t load lecturer capacity" message={error} onRetry={() => semesterId === null ? void loadSemesters() : void load(semesterId)} /> : !semester ? <EmptyState title="No academic semesters" description="Create a semester before preparing capacity limits." /> : workspace && <>
      {view === 'overview' ? <CapacityPolicySummary published={published} drafts={drafts} mutable={mutable} disabled={!ready || saving}
        onVersions={(onlyDrafts = false) => {setDraftsOnly(onlyDrafts);changeView('history');}} onContinue={plan => openPlan(plan, 'editor')} onPrepare={openPreparation}>
        {published && published.readinessErrors.length > 0 && <details className="capacity-policy-issues"><summary>Current policy needs attention · {published.readinessErrors.length} issues<span className="capacity-issues-hint">View details</span></summary><div className="capacity-policy-issue-details"><p>Some required lecturer limits are missing or no longer match their roles. Prepare a draft to review them.</p><ul className="list-disc pl-5 mt-3 space-y-2">{published.readinessErrors.map(message => <li key={message}>{message}</li>)}</ul></div></details>}
      </CapacityPolicySummary> : null}
      {inspecting && !editing && selected && <OfficeToolSection title={`Viewing version ${selected.version}`} icon={History} description="Published limits remain in force." actions={<>
        <StatusBadge tone={selected.lifecycleStatus === 'PUBLISHED' ? 'success' : selected.lifecycleStatus === 'DRAFT' ? 'warning' : 'neutral'}>{selected.lifecycleStatus}</StatusBadge>
        <PortalButton size="sm" disabled={saving} onClick={()=>{setActivityVersion(selected.version);changeView('activity');}}>View activity</PortalButton>
        <PortalButton size="sm" variant="primary" icon={Eye} disabled={!ready || saving} onClick={() => void openCompare()}>Compare versions</PortalButton>
        {!editing && ['PUBLISHED', 'SUPERSEDED'].includes(selected.lifecycleStatus) && mutable && <PortalButton size="sm" onClick={openPreparation}>Prepare a revision</PortalButton>}
      </>}>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-700">Created by {selected.createdBy.name} · {stamp(selected.createdAt)}{selected.publicationReason ? ` · ${selected.publicationReason}` : ''}</p>
          {view === 'version' && selected.lifecycleStatus === 'DRAFT' && mutable && <PortalButton size="sm" onClick={() => changeView('editor')}>Continue editing this draft</PortalButton>}
        </div></OfficeToolSection>}
      {(view === 'overview' || inspecting) && <OfficeToolSection className={editing ? 'capacity-editor' : ''} title={editing ? `Editing draft v${selected!.version}` : view === 'version' ? 'Version limits' : 'Lecturer workload'} icon={editing || view === 'version' ? SlidersHorizontal : Gauge} description={editing ? undefined : 'Includes active appointments across semesters.'} actions={editing ? <PortalButton size="sm" variant="primary" icon={Eye} disabled={!ready || saving} onClick={() => void openCompare()}>Compare versions</PortalButton> : view === 'overview' ? <PortalButton size="sm" onClick={() => {setAvailabilityLecturer(null);changeView('availability');}}>View availability</PortalButton> : undefined}>
        <div className="p-4 sm:p-5"><WorkspaceFilterCard fieldsClassName={editing ? 'grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3' : 'grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]'} onReset={() => { setSearch(''); setRole('ALL'); setNeedsSetup(false); setPage(1); }}><label className="form-label">Find a lecturer<input type="search" className="form-control form-control-sm mt-1" placeholder="Name or staff number" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="form-label">Role<PortalSelect id="capacity-roster-role" className="form-control form-control-sm mt-1" value={role} onChange={event => setRole(event.target.value as typeof role)}><option value="ALL">All roles</option><option value="SUPERVISOR">Supervisor</option><option value="PANEL">Panel</option></PortalSelect></label>{editing && <label className="form-label">Show<PortalSelect id="capacity-roster-show" className="form-control form-control-sm mt-1" value={needsSetup ? 'issues' : 'all'} onChange={event => setNeedsSetup(event.target.value === 'issues')}><option value="all">All lecturers</option><option value="issues">Lecturers needing attention</option></PortalSelect></label>}</WorkspaceFilterCard></div>
        {editing && <div className="capacity-roster-toolbar" role="group" aria-label="Lecturer selection">
          <div className="capacity-roster-selection">
            <p role="status" className={`capacity-result-summary ${selectedRows.length ? 'capacity-selection-count' : ''}`}>{selectedRows.length ? `${selectedRows.length} ${selectedRows.length === 1 ? 'lecturer' : 'lecturers'} selected` : <>Showing {shown.length} of {visible.length} {visible.length === 1 ? 'lecturer' : 'lecturers'}{needsSetup ? ' needing attention' : ''}{search.trim() || role !== 'ALL' ? ' matching your filters' : ''}</>}</p>
            <OverflowMenu label="Select lecturers" triggerLabel="Select lecturers" align="left" disabled={saving || !eligibleMatching.length} actions={[
              {label: `Select this page (${eligiblePage.length})`, disabled: saving || !eligiblePage.length, onSelect: () => setSelectedLecturers(current => [...new Set([...current, ...eligiblePage.map(row => row.lecturerId)])])},
              {label: `Select all ${eligibleMatching.length} matching`, disabled: saving || !eligibleMatching.length, onSelect: () => setSelectedLecturers(eligibleMatching.map(row => row.lecturerId))},
              {label: 'Clear selection', disabled: saving || !selectedRows.length, onSelect: () => setSelectedLecturers([])},
            ]} />
          </div>
          <PortalButton size="sm" variant="primary" disabled={!ready || saving || !mutable || !eligibleMatching.length} onClick={() => setDrawer('bulk')}>Set limits in bulk</PortalButton>
        </div>}
        <div className="capacity-table p-4 sm:p-5">{!visible.length ? <EmptyState title="No matching lecturers" description="Adjust the search or filters." /> : <CoordinatorDataTable label="Lecturer capacity roster" columns={['Lecturer', 'Active students', editing ? 'Proposed limits' : inspecting ? 'Version limits' : 'Published limits', 'Availability', 'Action']} rows={shown.map(row => ({
key: row.lecturerId, cells: [
            <div><div className="flex items-start gap-2">{editing && <input className="mt-1 shrink-0" type="checkbox" aria-label={`Select ${row.staffNo}`} disabled={saving || !canBulkConfigure(row)} checked={selectedLecturers.includes(row.lecturerId)} onChange={event => setSelectedLecturers(current => event.target.checked ? [...new Set([...current, row.lecturerId])] : current.filter(id => id !== row.lecturerId))} />}<p className="font-semibold text-brand-navy">{row.lecturerName}</p></div><p className="text-slate-600 mt-1">{row.staffNo}</p>{row.userEnabled === false && <p className="text-slate-600 mt-1">Account disabled</p>}{row.participantLifecycle !== 'ACTIVE' && <StatusBadge tone="neutral">{row.participantLifecycle}</StatusBadge>}{editing && capacityRowIssues(row, selected).map(message => <p className="capacity-row-issue" key={message}>{message}</p>)}</div>,
            <div className="space-y-1"><strong className="text-base text-brand-navy tabular-nums">{display(row.activeStudentCount)}</strong><p>Supervisor: {display(row.primaryStudentCount == null || row.supportingStudentCount == null ? null : row.primaryStudentCount + row.supportingStudentCount)}</p><p>Panel: {display(row.panelStudentCount)}</p>{row.workloadIdentityIncomplete && <p className="text-amber-800">Student links need review</p>}{!!row.panel?.reservedLoad && <p className="text-slate-600">+ {row.panel.reservedLoad} pending Panel</p>}</div>, roleValues(row, inspecting), availability(row),
            editing ? <PortalButton size="sm" disabled={!ready || !mutable || row.participantLifecycle !== 'ACTIVE' || row.canConfigure === false || saving} onClick={() => editEntry(row)}>Edit limits</PortalButton> : <PortalButton size="sm" onClick={() => { setEntry(row); setDrawer('details'); }}>View</PortalButton>,
          ]
}))} />}<div className="mt-4">{footer(visible.length, Math.min(page, pages), setPage, 'lecturers')}</div></div>
        {editing && selected && <footer className="capacity-publication-footer" aria-label="Publication readiness">
          {selected.readinessErrors.length > 0 ? <details className="capacity-readiness min-w-0">
            <summary>{selected.readinessErrors.length} {selected.readinessErrors.length === 1 ? 'issue prevents' : 'issues prevent'} publication</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5">{selected.readinessErrors.map(message => <li key={message}>{message}</li>)}</ul>
            {rows.some(row => row.canConfigure === false && capacityRowIssues(row, selected).length > 0) && <div className="mt-4"><PortalButton size="sm" disabled={!ready || !mutable || saving} onClick={openPreparation}>Prepare a fresh draft</PortalButton></div>}
          </details> : <p className="font-semibold text-emerald-800">Ready to publish</p>}
          <PortalButton size="sm" variant="primary" icon={ShieldCheck} disabled={!ready || saving || !mutable || !selected.isComplete || selected.readinessErrors.length > 0} onClick={() => { setPublishSession(value => value + 1); setPublishReason(''); setPublishConfirmed(false); setDrawerError(null); setDrawer('publish'); }}>Review and publish</PortalButton>
        </footer>}
      </OfficeToolSection>}
        {(view === 'history' || view === 'availability' || view === 'activity') && <CapacityCollectionPage key={`${semesterId}-${view}`} collection={view === 'history' ? 'capacity-plans' : view === 'availability' ? 'availability' : 'capacity-audits'} semesterId={semesterId!} revision={revision} initialStatus={view === 'history' && draftsOnly ? 'DRAFT' : undefined} initialVersion={view==='activity'?activityVersion:undefined} mutable={mutable} busy={!ready || saving} lecturer={availabilityLecturer} onClearLecturer={() => setAvailabilityLecturer(null)}
          onPlan={plan => openPlan(plan, plan.lifecycleStatus === 'DRAFT' && mutable ? 'editor' : 'version')} onDiscard={plan => {setDiscardReason('');setDiscardPlan(plan);}} onPrepare={openPreparation} onActivity={version => {setActivityVersion(version);changeView('activity');}} />}

    </>}
    <RightDrawer isOpen={drawer === 'prepare' || drawer === 'compare'} onClose={close} title={drawer === 'prepare' ? 'Prepare capacity limits' : 'Compare versions'} backLabel="Back to lecturer capacity" pageKey="capacity-workspace-record" busy={saving} onNavigationSettled={pendingPreparationClose ? settlePreparation : undefined}>
      {drawerError && <AlertMessage type="error" className="mb-5" title="Capacity action wasn’t completed" message={drawerError}/>}
      {drawer === 'prepare' && <CapacityPreparationForm baseline={workspace?.baseline} drafts={drafts} published={published} previous={copySource} checkingPrevious={copyLoading} disabled={!ready || !mutable || saving} busy={saving} onCheckPrevious={() => void beginCopy()} onContinue={plan => openPlan(plan, 'editor')} onCurrent={() => { if (published) void revise(published); }} onCreate={source => void create(source)} />}
      {drawer === 'compare' && compareLoading && <LoadingState message="Loading comparison versions…" />}
      {drawer === 'compare' && !compareLoading && selected && <div className="space-y-5"><label className="form-label block">Compare version {selected.version} with<PortalSelect className="form-control form-control-md mt-1" value={comparePlanId ?? ''} onChange={event => setComparePlanId(Number(event.target.value))}>{plans.filter(plan => plan.id !== selected.id).map(plan => <option key={plan.id} value={plan.id}>Version {plan.version} · {plan.lifecycleStatus}</option>)}</PortalSelect></label>{compare ? <CoordinatorDataTable label="Capacity version comparison" columns={['Lecturer', `Version ${selected.version}`, `Version ${compare.version}`]} rows={capacityComparisonRows(workspace?.lecturers ?? [], selected, compare).map(row => { const other = compare.entries.find(item => item.lecturerId === row.lecturerId); return { key: row.lecturerId, cells: [row.lecturerName, <p>Supervisor: {row.supervisorLimit ?? 'Not set'}<br />Panel: {row.panelLimit ?? 'Not set'}</p>, <p>Supervisor: {other?.supervisorLimit ?? 'Not set'}<br />Panel: {other?.panelLimit ?? 'Not set'}</p>] }; })} /> : <EmptyState title="No comparison version" />}</div>}

    </RightDrawer>
    {drawer === 'bulk' && selected && <CapacityBulkDialog plan={selected} matching={eligibleMatching} selected={selectedRows} busy={saving} onClose={close} onSave={saveBulk} onDraftChange={setBulkDirty}
      onReload={async () => {if (semesterId === null || !await load(semesterId)) throw new Error('Could not reload capacity limits. Try again.');}} />}
    <DecisionDialog isOpen={drawer === 'publish' && selected !== null} decisionKey={`publish-${selected?.id}-${publishSession}`} title="Review and publish" kind="confirmation"
      context={selected ? <><p>{selected.semesterLabel}</p><p className="mt-1 text-xs font-normal text-slate-600">Draft v{selected.version}</p></> : undefined}
      message={<p>These limits take effect immediately{published ? `, replacing version ${published.version}` : ''}. This version becomes read-only. Existing appointments stay active.</p>}
      confirmLabel="Publish limits" successMessage={`Version ${selected?.version} published. These limits are now in force.`}
      busy={saving} dirty={!!publishReason.trim() || publishConfirmed}
      canConfirm={ready && editing && mutable && !!selected?.isComplete && selected.readinessErrors.length === 0 && !!publishReason.trim() && publishConfirmed}
      onClose={close} onConfirm={publish} onReload={async () => { if (semesterId === null || !await load(semesterId)) throw new Error('Could not reload capacity limits. Try again.'); }}>
      <label className="form-label block">Publication reason<textarea autoFocus className="form-control form-control-md mt-2 min-h-24" value={publishReason} onChange={event => setPublishReason(event.target.value)} /></label>
      <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-700"><input className="mt-0.5 shrink-0" type="checkbox" checked={publishConfirmed} onChange={event => setPublishConfirmed(event.target.checked)} /><span>I have reviewed the Supervisor and Panel limits.</span></label>
    </DecisionDialog>
    {(drawer === 'entry' || drawer === 'details') && entry && <CapacityLecturerDialog title={drawer === 'entry' ? 'Edit lecturer limits' : 'Lecturer details'} lecturerName={entry.lecturerName} staffNo={entry.staffNo} busy={saving}
      dirty={entryDirty} onClose={close}
      footer={requestClose => <><PortalButton disabled={saving} onClick={requestClose}>{drawer === 'entry' ? 'Cancel' : 'Close'}</PortalButton>{drawer === 'entry' && <PortalButton type="submit" form="capacity-entry-form" variant="primary" icon={Save} disabled={!ready || !editing || !mutable || entry.canConfigure === false || saving} isLoading={saving}>Save limits</PortalButton>}</>}>
      {drawerError && <AlertMessage type="error" title="Changes weren’t saved" message={drawerError}/>}
      {drawer === 'entry' ? <form id="capacity-entry-form" className="space-y-5" onSubmit={event => { event.preventDefault(); void saveEntry(); }}>
        <p className="text-sm text-slate-600">Draft v{selected?.version}</p>
        {!editing && <AlertMessage type="warning" title="This version is now read-only" message="Your unsaved values are retained; review the latest version before continuing."/>}
        <fieldset disabled={saving || !editing || !mutable || entry.canConfigure === false} className="grid gap-5 sm:grid-cols-2">
          {entry.supervisor && <label className="block capacity-field-label">Supervisor limit<input className="form-control form-control-md mt-2" type="number" autoFocus min="0" step="1" value={supervisorLimit} onChange={event => setSupervisorLimit(event.target.value)} /><span className="mt-2 block text-xs font-normal text-slate-600">Published: {entry.supervisor.limit ?? 'Not set'} · Minimum: {committedCapacityLoad(entry, 'SUPERVISOR')}</span></label>}
          {entry.panel && <label className="block capacity-field-label">Panel limit<input className="form-control form-control-md mt-2" type="number" autoFocus={!entry.supervisor} min="0" step="1" value={panelLimit} onChange={event => setPanelLimit(event.target.value)} /><span className="mt-2 block text-xs font-normal text-slate-600">Published: {entry.panel.limit ?? 'Not set'} · Minimum: {committedCapacityLoad(entry, 'PANEL')}</span></label>}
        </fieldset>
        {entryPublicationIssues.length > 0 && <AlertMessage type="warning" title="Draft cannot be published yet" message={entryPublicationIssues.join(' ')} />}
      </form> : <div className="space-y-6 text-sm text-slate-700"><dl className="capacity-detail-counts"><div><dt>Total active students</dt><dd>{display(entry.activeStudentCount)}</dd></div><div><dt>Primary supervision</dt><dd>{display(entry.primaryStudentCount)}</dd></div><div><dt>Supporting supervision</dt><dd>{display(entry.supportingStudentCount)}</dd></div><div><dt>Active Panel students</dt><dd>{display(entry.panelStudentCount)}</dd></div><div><dt>Reserved Supervisor places</dt><dd>{entry.supervisor?.reservedLoad ?? 0}</dd></div><div><dt>Pending Panel recommendations</dt><dd>{entry.panel?.reservedLoad ?? 0}</dd></div></dl>{entry.workloadIdentityIncomplete && <p className="text-amber-800">Some active Panel records have no linked student. Unique student totals are unavailable until those records are linked.</p>}<section><h3 className="section-label mb-3">Published limits</h3><div className="grid gap-3 sm:grid-cols-2">{(['SUPERVISOR', 'PANEL'] as const).map(value => { const resolution = value === 'SUPERVISOR' ? entry.supervisor : entry.panel; return resolution ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={value}><p className="font-semibold text-brand-navy">{value === 'SUPERVISOR' ? 'Supervisor' : 'Panel'}</p><p className="mt-1">Limit: <strong>{resolution.limit ?? 'Not set'}</strong></p><p className="mt-1">{capacityStateLabel(resolution.state)}</p><p>{resolution.availableSlots ?? 'Unavailable'} remaining places</p></div> : null; })}</div></section>{inspecting && <section><h3 className="section-label mb-3">Version {selected?.version} limits</h3>{roleValues(entry, true)}</section>}<section><h3 className="section-label mb-2">Availability</h3><p className="mb-3">Lecturers manage their own availability. Existing appointments remain active.</p>{availability(entry)}<button className="capacity-text-link mt-4 block" onClick={() => { const lecturer = {id:entry.lecturerId,name:entry.lecturerName}; close(); setAvailabilityLecturer(lecturer); changeView('availability'); }}>View availability</button></section></div>}
    </CapacityLecturerDialog>}
    <DecisionDialog isOpen={discardPlan !== null} decisionKey={discardPlan?.id} title="Discard capacity draft?" kind="confirmation" tone="danger" context={discardPlan ? `${discardPlan.semesterLabel} · Version ${discardPlan.version}` : undefined} message="This removes the draft from active work. Its limits and audit history are retained, but the draft cannot be edited or published. Published limits stay unchanged." confirmLabel="Discard draft" successMessage={`Draft v${discardPlan?.version} discarded.`} busy={saving} dirty={!!discardReason.trim()} canConfirm={ready && mutable && !!discardReason.trim()} onClose={() => { setDiscardPlan(null); setDiscardReason(''); }} onReload={async () => { if (semesterId === null || !await load(semesterId)) throw new Error('Could not reload capacity versions. Try again.'); }} onConfirm={async () => {
      if (!ready || !mutable || !discardPlan || !discardReason.trim() || writing.current) return false;
      const target = discardPlan;
      writing.current = true; setSaving(true);
      try {
        return await completeDecision(async () => {
          const updated = await discardSemesterCapacityPlan(target.id, {reason: discardReason.trim(), expectedVersion: target.version, expectedFingerprint: target.contentFingerprint, confirmed: true});
          setPlans(current => current.map(plan => plan.id === updated.id ? updated : plan));
        }, async () => { if (semesterId === null || !await load(semesterId)) throw new Error('Could not reload capacity versions.'); });
      } finally { writing.current = false; setSaving(false); }
    }}><label className="form-label block">Reason for discarding<textarea className="form-control form-control-md mt-1 min-h-24" value={discardReason} onChange={event => setDiscardReason(event.target.value)} /></label></DecisionDialog>
  </div>;
}
