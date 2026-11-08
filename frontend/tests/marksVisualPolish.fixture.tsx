import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { MarkSubmissionMonitoring } from '../src/components/MarkSubmissionMonitoring';
import { MarksOverview } from '../src/components/MarksOverview';
import { MarkEntryPeriodConfig } from '../src/components/MarkEntryPeriodConfig';
import { RubricsManagementView } from '../src/components/RubricsManagementView';
import { EvaluationTaskAssignment } from '../src/components/EvaluationTaskAssignment';
import { MarkEntryRecords } from '../src/components/MarkEntryRecords';
import { ListState } from '../src/components/ListState';
import { OfficeMonitoringProvider } from '../src/components/OfficeMonitoringContext';
import { LecturerMarksEntry } from '../src/components/LecturerMarksEntry';
import { MarksEntryHistory } from '../src/components/MarksEntryHistory';
import { MarkEntryDetail } from '../src/components/MarkEntryDetail';
import { SubmittedMarkDetail } from '../src/components/SubmittedMarkDetail';
import { MarkEntryRecordDetail } from '../src/components/MarkEntryRecordDetail';
import { MarksCompletionWindows } from '../src/components/MarksCompletionWindows';
import type { EvaluationTask, EvaluationPeriodOption } from '../src/types';

const page = new URLSearchParams(location.search).get('page') || 'overview-empty';
let fail = page === 'overview-error' || page === 'records-error' || page === 'lecturer-error' || page === 'history-error', writes = 0;
const unknown: string[] = [], checks: string[] = [];
const periodQueries: string[] = [];
let activeTaskReads = 0, submissionReads = 0;
const component = { id: 3, code: 'research', name: 'Research quality', description: 'Clarity, evidence and research approach.', maxMarks: '100', required: true, isActive: true, displayOrder: 1, marksAwarded: '78', feedback: 'Clear research direction.' };
const rubric = { id: 1, familyCode: 'RES', name: 'Research assessment', description: 'Research evaluation criteria.', version: 1, isActive: true, isReady: true, isLocked: page === 'rubrics-locked', targetMark: '100', componentTotal: '100', components: [component] };
const totals = { total: 3, submitted: 1, incomplete: 2, overdue: 1, supervisor: 1, panel: 2, backup: 0 };
const period = { id: 1, name: 'Research project evaluation', semester: 'Semester I 2026/2027', semesterId: 1, semesterCode: '2026-1', rubricId: 1, rubricName: rubric.name, programmeScope: 'ALL', programmes: [], evaluatorRoles: ['SUPERVISOR', 'PANEL'], opensAt: '2026-10-01T00:00:00+08:00', closesAt: '2026-11-20T23:59:00+08:00', isOpen: true, lifecycleStatus: 'PUBLISHED', effectiveStatus: 'OPEN', taskTotals: totals, auditEvents: [] };
const archivedPeriod = { ...period, id: 2, name: 'Previous research evaluation', lifecycleStatus: 'ARCHIVED', effectiveStatus: 'ARCHIVED', isOpen: false };
const semester = { id: 1, code: '2026-1', label: period.semester, lifecycleStatus: 'ACTIVE', effectiveStatus: 'ACTIVE', startsOn: '2026-10-01', endsOn: '2027-03-31', isEffectiveActive: true, isReadOnly: false };
const task: EvaluationTask = { id: 4, studentId: 'DEMO-001', studentName: 'Fictional Student One', initials: 'FS', researchTitle: 'Explainable AI for learning support', semester: period.semester, status: 'NOT STARTED', evaluatorRole: 'SUPERVISOR', deadline: '20 Nov 2026', deadlineState: 'UPCOMING', canEdit: true, canSubmit: true, components: [{ ...component, marksAwarded: null, feedback: '' }], comments: '' };
const submitted = { ...task, id: 5, status: 'SUBMITTED' as const, totalMark: '78', submittedDate: '20 Oct 2026', submittedAt: '2026-10-20T10:00:00Z', periodId: 1, periodName: period.name, rubricName: rubric.name, rubricVersion: 1, taskLifecycleStatus: 'ACTIVE' as const, canEdit: false, canSubmit: false, components: [component], comments: 'Good progress with clear explanations.' };
const panelTask: EvaluationTask = { ...task, id: 6, evaluatorRole: 'PANEL', studentId: 'PANEL-001', studentName: 'Fictional Panel Student', status: 'DRAFT SAVED', components: [component] };
const panelSubmitted: EvaluationTask = { ...submitted, id: 7, evaluatorRole: 'PANEL', studentId: 'PANEL-002', studentName: 'Fictional Panel Submission' };
const backupTask: EvaluationTask = { ...task, id: 8, evaluatorRole: 'BACKUP', studentId: 'BACKUP-001', studentName: 'Fictional Backup Student' };
const retiredSubmission: EvaluationTask = { ...submitted, id: 20, taskLifecycleStatus: 'RETIRED', periodName: 'Earlier evaluation', submittedAt: '2025-12-31T15:30:00Z', semester: 'Semester II 2025/2026' };
const latestSubmission: EvaluationTask = { ...submitted, id: 21, taskLifecycleStatus: 'PAUSED', periodName: 'January evaluation', submittedAt: '2026-01-01T16:30:00Z' };
const historicalBackup: EvaluationTask = { ...submitted, id: 22, evaluatorRole: 'BACKUP', taskLifecycleStatus: 'RETIRED', studentName: 'Fictional Backup Submission' };
const submissionRows = page === 'history-empty' ? [] : page === 'history-retained' ? [retiredSubmission, latestSubmission, panelSubmitted, historicalBackup] : page === 'lecturer-mixed' ? [submitted, panelSubmitted, historicalBackup] : [submitted];
const lecturerTasks = page === 'lecturer-empty' ? [] : page === 'lecturer-panel-only' ? [panelTask] : page === 'lecturer-backup-only' ? [backupTask] : page === 'lecturer-mixed' ? [task, submitted, panelTask, panelSubmitted, backupTask] : [task, submitted];
const records = ['Submitted', 'Overdue', 'Not Started'].map((status, index) => ({ id: `REC-${index + 1}`, taskId: index + 1, studentId: `DEMO-00${index + 1}`, studentName: `Fictional Student ${index + 1}`, panelMember: 'Fictional Evaluator', programme: index === 2 ? 'Master of Data Science' : 'Master of Computer Science', semester: period.semester, researchTitle: task.researchTitle, totalMark: index === 0 ? '78' : null, status, submittedDate: index === 0 ? '20 Oct 2026' : null, evaluatorRole: 'PANEL', evaluatorRoleLabel: 'Panel', deadlineState: index === 1 ? 'OVERDUE' : 'UPCOMING', taskLifecycleStatus: 'ACTIVE' }));
const detail = { recordId: 'REC-1', taskId: 4, student: { studentId: task.studentId, name: task.studentName, programme: 'Master of Computer Science', semester: task.semester, researchTitle: task.researchTitle }, evaluator: { userId: 2, name: 'Fictional Evaluator', email: 'fictional@example.invalid', staffId: 'DEMO-STAFF', department: 'Computing', role: 'SUPERVISOR', roleLabel: 'Supervisor' }, assignment: { lifecycleStatus: 'ACTIVE', assignedAt: period.opensAt, assignedBy: 'Office', pausedAt: null, pausedBy: null, pauseReason: null, retiredAt: null, retiredBy: null, retirementReason: null }, period, rubric, entry: { status: 'SUBMITTED', totalMark: '78', comments: submitted.comments, submittedAt: submitted.submittedAt, updatedAt: submitted.submittedAt, isLocked: true }, correctionHistory: [], overrideHistory: [], handoverHistory: [], officeActions: { canCorrect: false, canReopen: false, version: null } };
const recordRows = records.map((row, index) => ({ ...row, semester: index === 2 ? 'Semester II 2026/2027' : row.semester, panelMember: index === 2 ? 'Fictional Evaluator Two' : row.panelMember }));
const empty = page === 'overview-empty' || page === 'periods-empty' || page === 'rubrics-empty' || page === 'rubrics-create' || page === 'assignment-empty' || page === 'records-empty';
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
window.fetch = async (input, options = {}) => {
  const path = new URL(String(input), location.origin).pathname;
  if ((options.method || 'GET') !== 'GET') { writes++; throw Error('Read-only visual fixture attempted a write'); }
  if (path.endsWith('/dashboard/summary/')) return fail ? response({ detail: 'Summary unavailable.' }, 500) : response({ submittedMarkEntries: empty ? 0 : 1, incompleteMarkEntries: empty ? 0 : 2, supervisorMarkTasks: empty ? 0 : 1, panelMarkTasks: empty ? 0 : 2, backupMarkTasks: 0 });
  if (path.endsWith('/marks/periods/')) {
    if(page === 'overview-error' && fail) return response({detail: 'Periods unavailable.'},500);
    const query = new URL(String(input), location.origin).search;
    periodQueries.push(query);
    if (page === 'periods-archived-only') return response(query.includes('includeArchived=true') ? [archivedPeriod] : []);
    return response(empty ? [] : [{ ...period, ...(page === 'assignment-closed' ? { effectiveStatus: 'CLOSED', isOpen: false } : {}) }, ...(page === 'periods' ? [{ ...period, id: 3, name: 'Next evaluation', lifecycleStatus: 'DRAFT', effectiveStatus: 'DRAFT' }, { ...period, id: 4, name: 'Completed evaluation', lifecycleStatus: 'CLOSED', effectiveStatus: 'CLOSED' }] : []), ...(page === 'periods-archived' && query.includes('includeArchived=true') ? [archivedPeriod] : [])]);
  }
  if (path.endsWith('/marks/periods/1/')) return response(period);
  if (path.endsWith('/marks/periods/2/')) return response(archivedPeriod);
  if (path.endsWith('/marks/periods/1/closure-preview/')) {
    const counts = { submitted: 1, notStarted: 2, draft: 0, paused: 0, activeWindows: 0, unfinished: 2 };
    return response({ previewToken: 'fictional-preview', periodId: 1, periods: [{ ...counts, periodId: 1, name: period.name }], totals: counts, requiresAcknowledgement: true });
  }
  if (path.endsWith('/marks/rubrics/')) return response(empty ? [] : [rubric]);
  if (path.endsWith('/marks/rubrics/1/')) return response(rubric);
  if (path.endsWith('/marks/programme-options/')) return response(['Master of Computer Science']);
  if (path.endsWith('/academics/semesters/')) return response([semester]);
  if (path.endsWith('/marks/evaluation-tasks/')) return response(empty ? [] : records.map((row, i) => ({ ...row, periodId: 1, taskId: i + 1, status: i === 0 ? 'SUBMITTED' : 'GENERATED' })));
  if (path.includes('/marks/assignment-options/')) return response({ students: [], lecturers: [], tasks: [] });
  if (path.endsWith('/marks/my-evaluation-tasks/')) { activeTaskReads++; return page === 'lecturer-error' && fail ? response({ detail: 'Assignments unavailable.' }, 500) : response(lecturerTasks); }
  if (path.endsWith('/marks/my-submitted-evaluations/')) { submissionReads++; return page === 'history-error' && fail ? response({ detail: 'Submitted evaluations unavailable.' }, 500) : response(submissionRows); }
  if (path.endsWith('/marks/records/REC-1/')) return response(detail);
  if (path.endsWith('/marks/')) return page === 'records-error' && fail ? response({ detail: 'Records unavailable.' }, 500)
    : response(page === 'records-paged' ? Array.from({ length: 120 }, (_, i) => ({ ...records[i % 3], id: `PAGE-${i + 1}` })) : empty ? [] : recordRows);
  unknown.push(path); throw Error(`Unexpected fixture read: ${path}`);
};

function Preview() {
  const navigate = useNavigate(), route = useLocation();
  const back = () => navigate('/marks');
  const viewRecords = (status = 'All Records') => navigate(`/marks/records?status=${encodeURIComponent(status)}`);
  let content: React.ReactNode;
  if (page.startsWith('overview')) content = <MarksOverview onViewRecords={viewRecords} />;
  else if (page.startsWith('periods')) content = <MarkEntryPeriodConfig contextSearch={page === 'periods-context' ? '?semester=1&period=1' : ''} onBack={back} onManageSemesters={() => {}} onManageTimeline={() => navigate('/dashboard/periods')} />;
  else if (page.startsWith('rubrics')) content = <RubricsManagementView onBack={back} />;
  else if (page.startsWith('assignment')) content = <EvaluationTaskAssignment onBack={back} onManageTimeline={() => navigate('/dashboard/periods')} />;
  else if (page === 'monitoring') content = <div className="marks-workspace"><MarkSubmissionMonitoring periods={[period as EvaluationPeriodOption]} onViewRecords={viewRecords} /></div>;
  else if (page.startsWith('records')) content = <MarkEntryRecords onBack={back} onViewRecordDetail={id => navigate(`/marks/records/${id}`)} onNavigateToDossier={id => navigate(`/students/${id}`)} />;
  else if (page.startsWith('lecturer')) content = <LecturerMarksEntry />;
  else if (page === 'history-retained' || page === 'history-error') content = <LecturerMarksEntry />;
  else if (page.startsWith('history')) content = <MarksEntryHistory onBack={back} onSelectRecord={() => {}} />;
  else if (page.startsWith('entry')) content = <MarkEntryDetail task={page === 'entry-readonly' ? { ...task, canEdit: false, canSubmit: false } : page === 'entry-draft-only' ? { ...task, canSubmit: false } : task} onBack={back} onSave={() => {}} onSubmit={() => {}} />;
  else if (page === 'submitted') content = <SubmittedMarkDetail task={submitted} onBack={back} />;
  else if (page === 'completion') content = <MarksCompletionWindows tasks={records.map((row, index) => ({ id: row.id, taskId: index + 1, studentId: row.studentId, studentName: row.studentName, researchTitle: row.researchTitle, semester: row.semester, panelMember: row.panelMember, evaluatorRole: 'PANEL', status: index === 0 ? 'SUBMITTED' : 'NOT_STARTED', canGrantCompletionWindow: index !== 0 }))} onChanged={async () => {}} />;
  else content = <MarkEntryRecordDetail recordId="REC-1" onBack={back} />;
  return <main style={{ padding: '24px', maxWidth: 1280, margin: 'auto', background: '#f1f5f9' }}>{content}<output hidden id="route">{route.pathname}{route.search}</output></main>;
}
const listMemory = new Map<string, unknown>();
if (page === 'records-legacy') listMemory.set('MarkEntryRecords:appliedFilters', { search: '', programme: 'All Programmes', semester: 'All Semesters', status: 'Overdue', panelMember: 'All Members' });
if (page === 'records-legacy') listMemory.set('MarkEntryRecords:currentPage', 99);
createRoot(document.getElementById('root')!).render(<ListState.Provider value={listMemory}><MemoryRouter initialEntries={[page === 'records-monitoring-empty' ? '/marks/records?monitor=backup' : page === 'history-retained' || page === 'history-error' ? '/marks/history' : '/marks']}><OfficeMonitoringProvider enabled={page === 'records-monitoring-empty'}><Preview /></OfficeMonitoringProvider></MemoryRouter></ListState.Provider>);
const pause = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value: unknown, label: string) => { if (!value) throw Error(label); checks.push(label); };
const until = async (test: () => unknown) => { for (let i = 0; i < 180; i++) { if (test()) return; await pause(); } throw Error('Fixture did not settle: ' + document.body.textContent?.slice(-500)); };
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(row => row.textContent?.trim() === label);
try {
  await until(() => !!document.querySelector('#root')?.firstElementChild);
  await until(() => !document.body.textContent?.includes('Loading '));
  await pause(250);
  if (page.startsWith('lecturer')) await until(() => !!document.querySelector('#mark-entry-tasks-list-block > p[role="status"], #mark-entry-tasks-list-block [role="alert"]'));
  if (page.startsWith('history')) await until(() => !!document.querySelector('#submitted-evaluation-results [role="alert"], #marks-entry-history p[role="status"]'));
  if (page.startsWith('assignment')) {
    const workspace = document.querySelector('#eval-assignment-workspace')!;
    const context = document.querySelector('#assignment-period-card');
    assert(!!context, 'assignment starts with one period context');
    const generation = document.querySelector('#assignment-controls')!;
    const results = document.querySelector('#evaluation-preview-card')!;
    assert(context!.contains(generation), 'generation shares the period card');
    assert([...workspace.children].filter(node => node.classList.contains('bg-white')).length === 2, 'assignment has only two main card surfaces');
    assert(!document.querySelector('#summary-cards-row'), 'role counts do not occupy separate summary cards');
    assert(results.getBoundingClientRect().top < (innerWidth >= 1000 ? 500 : 950), 'task management starts without a long stack of summary cards');
    const readiness = context!.querySelector<HTMLDetailsElement>('details')!;
    assert(!!readiness && !readiness.open, 'detailed readiness starts collapsed');
    readiness.querySelector('summary')!.click(); await pause();
    assert(generation.textContent?.includes('Readiness checks'), 'readiness is grouped with generation');
    assert(readiness.open && readiness.textContent?.includes('Eligible students available'), 'readiness remains available on demand');
    readiness.querySelector('summary')!.click(); await pause();
    assert(!document.querySelector('#task-actions-wrapper'), 'task controls do not float in a separate strip');
    const activity = document.querySelector<HTMLDetailsElement>('#recent-assignment-activity-panel');
    assert(activity?.tagName === 'DETAILS' && !activity.open, 'session activity starts collapsed');
    assert(results.contains(activity), 'session activity shares the task card');
    const filterPanel = results.querySelector('[data-workspace-filter-card]')!;
    assert(!!filterPanel, 'task filters reuse the portal workspace filter panel');
    assert(parseFloat(getComputedStyle(filterPanel).paddingTop) === (innerWidth >= 640 ? 20 : 12), 'task panel matches appointment desktop/mobile padding');
    assert(parseFloat(getComputedStyle(filterPanel.querySelector('button[aria-label="Evaluator role"]')!).fontSize) === 12, 'task filter values use the shared 12px font');
    assert(parseFloat(getComputedStyle(filterPanel.querySelector('label')!).fontSize) === 10, 'task filter labels use the shared 10px font');
    assert(!!filterPanel.querySelector('button[aria-label="Evaluator role"]') && !!filterPanel.querySelector('button[aria-label="Task status"]'), 'task filters have labelled role and status fields');
    assert(!results.querySelector('[aria-label="Filter by evaluator role"]'), 'task roles do not use a separate pill filter design');
    const generate = button('Generate missing tasks')!;
    assert(!!generate, 'normal generation retains one primary action');
    if (empty) {
      assert(generate.disabled, 'no-period generation stays disabled');
      assert(!results.querySelector('table'), 'empty assignments avoid an empty wide table');
      assert(context!.querySelector('a')?.getAttribute('href') === '/marks/config', 'no-period guidance links to configuration');
    } else {
      assert(generate.disabled === (page === 'assignment-closed'), 'generation preserves the published/open period gate');
      assert(results.querySelectorAll('tbody tr').length === 3, 'existing task rows remain available');
      const role = results.querySelector<HTMLSelectElement>('select[aria-label="Evaluator role"]')!;
      const status = results.querySelector<HTMLSelectElement>('select[aria-label="Task status"]')!;
      role.value = 'SUPERVISOR'; role.dispatchEvent(new Event('change', { bubbles: true })); await pause();
      assert(role.value === 'SUPERVISOR', 'role dropdown exposes its active filter');
      assert(!results.querySelector('table') && results.textContent?.includes('No tasks match'), 'filtered empty results explain the mismatch');
      status.value = 'SUBMITTED'; status.dispatchEvent(new Event('change', { bubbles: true })); await pause();
      button('Clear filters')!.click(); await pause();
      assert(role.value === 'ALL' && status.value === 'ALL', 'clear filters resets both role and status');
      assert(results.querySelectorAll('tbody tr').length === 3, 'clearing filters restores task rows');
      const view = [...results.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === 'View')!;
      view.click(); await until(() => !!document.querySelector('dialog[open]'));
      assert(document.querySelector('dialog[open]')?.textContent?.includes('Fictional Student 1'), 'existing task detail remains accessible');
      button('Close')!.click();
      await until(() => !document.querySelector('dialog[open]'));
    }
    button('Assign backup evaluator')!.click(); await until(() => !!document.querySelector('textarea'));
    assert(document.body.textContent?.includes('exception assignment'), 'backup entry retains its exception explanation');
    button('Cancel')!.click(); await until(() => !document.querySelector('textarea'));
    const deadlines = button('Manage deadlines')!;
    assert(!results.contains(deadlines) && !context!.contains(deadlines), 'central deadline management is a compact page shortcut');
    deadlines.click(); await pause();
    assert(document.querySelector('#route')?.textContent === '/dashboard/periods', 'deadline navigation is preserved');
  }
  if (page === 'rubrics-empty' || page === 'rubrics-create') {
    const workspace = document.querySelector('#rubric-version-management')!;
    assert(!workspace.textContent?.includes('Select a rubric'), 'empty library does not ask users to select a nonexistent rubric');
    assert(!workspace.querySelector('[aria-label="Rubric version families"]'), 'empty library has no unused sidebar');
    const start = button('Create rubric family');
    assert(!!start, 'empty library offers a direct create action');
    start!.focus(); assert(document.activeElement === start, 'empty-library create action is keyboard focusable');
    const emptyCard = start!.closest('[data-rubric-empty]')!;
    assert(emptyCard.getBoundingClientRect().width >= workspace.getBoundingClientRect().width - 2, 'empty state uses the available workspace width');
    if (page === 'rubrics-create') {
      start!.click(); await until(() => !!document.querySelector('#rubric-family-code'));
      await until(() => document.activeElement === document.querySelector('#rubric-family-code'));
      assert(document.activeElement === document.querySelector('#rubric-family-code'), 'creation moves focus to the first family field');
      const form = workspace.querySelector('form')!;
      assert(!workspace.querySelector('[data-rubric-empty]'), 'starting creation replaces the empty state');
      assert(!workspace.querySelector('[aria-label="Rubric version families"]'), 'first-family form has no empty sidebar');
      assert(form.getBoundingClientRect().width >= workspace.getBoundingClientRect().width - 100, 'first-family form uses the full work surface');
      assert(!!button('Create family'), 'existing family creation form remains usable');
    }
  }
  if (page === 'overview-error') {
    assert(!!document.querySelector('[role="alert"]'), 'failed reads show an error');
    assert([...document.querySelectorAll('h2')].some(node => node.textContent === 'Evaluation checks'), 'error state retains the evaluation checks heading');
    assert(!document.querySelector('#summary-cards-grid'), 'failed reads never display empty totals');
    assert(document.querySelectorAll('#checklist-card-section button').length === 3, 'metadata errors keep setup destinations available');
    assert(document.querySelector('#checklist-card-section')?.textContent?.includes('Not loaded'), 'failed metadata uses unknown setup status');
    assert(!!button('View mark records'), 'metadata errors keep records available');
    assert(!document.querySelector('#monitoring-card'), 'failed period metadata never shows misleading monitoring totals');
    fail = false; button('Retry')!.click();
    await until(() => !!document.querySelector('#summary-cards-grid'));
    assert(!document.querySelector('[role="alert"]'), 'retry recovers the overview');
  }
  if (page.startsWith('overview')) {
    await until(() => !!document.querySelector('#summary-cards-grid') && !document.body.textContent?.includes('Loading '));
    assert(!document.querySelector('[role="tablist"]'), 'overview has no tab navigation');
    const checksPanel = document.querySelector('#attention-needed-card')!;
    assert(checksPanel.getAttribute('aria-label') === 'Evaluation checks', 'evaluation checks have a distinct accessible name');
    assert(checksPanel.querySelector('h2')?.textContent === 'Evaluation checks', 'Marks checks are distinguished from dashboard attention');
    const setup = document.querySelector('#checklist-card-section')!;
    assert(setup.querySelectorAll('h3').length === 3, 'setup has three preparation jobs');
    assert(!setup.textContent?.includes('Monitor mark submissions'), 'monitoring is separate from setup');
    const routes = [['Manage mark entry periods', '/marks/config'], ['Manage rubric components', '/marks/rubrics'], ['Manage evaluation tasks', '/marks/tasks']];
    for (const [label, route] of routes) {
      const target = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
      target.focus(); assert(document.activeElement === target, `${label} is keyboard focusable`);
      target.click(); await until(() => document.querySelector('#route')?.textContent === route); assert(document.querySelector('#route')?.textContent === route, `${label} retains its route`);
    }
    if (empty) {
      assert(!document.querySelector('#summary-cards-grid .card-description'), 'empty summary avoids repeating setup instructions in every card');
      assert(!setup.textContent?.includes('Manage periods, marking criteria'), 'setup has one concise scope caption');
      assert(!checksPanel.textContent?.includes('Submission checks become useful'), 'evaluation checks omit unnecessary pre-task commentary');
      const start = checksPanel.querySelector<HTMLAnchorElement>('a');
      assert(start?.getAttribute('href') === '/marks/config', 'empty evaluation checks link directly to period configuration');
      start!.focus(); assert(document.activeElement === start, 'first setup action is keyboard focusable');
      start!.click(); await pause();
      assert(document.querySelector('#route')?.textContent === '/marks/config', 'first setup action opens period configuration');
      assert(document.body.textContent?.includes('No open or scheduled periods'), 'zero-task monitoring explains the empty state');
      assert(!document.querySelector('[role="progressbar"]'), 'zero tasks do not show a percentage');
      assert(!document.querySelector('#column-followup'), 'empty monitoring omits zero-value follow-up clutter');
    } else {
      assert(document.querySelector('[aria-label="Evaluation summary"]')?.textContent?.includes('Academic semester'), 'summary explicitly identifies semester scope');
      assert(checksPanel.textContent?.includes('All non-archived periods'), 'evaluation checks explicitly describe their broader scope');
      const overdue = document.querySelector<HTMLButtonElement>('[aria-label="Overdue: 1"]')!;
      overdue.click(); await pause();
      assert(document.querySelector('#route')?.textContent?.includes('status=Overdue'), 'monitoring preserves the overdue record filter');
    }
    button('View mark records')!.click(); await pause();
    assert(document.querySelector('#route')?.textContent?.includes('status=All%20Records'), 'all records remain available');
  }
  if (page === 'monitoring') {
    assert(document.querySelectorAll('#monitoring-card tbody tr').length === 1, 'monitoring displays one row per period');
    assert(!document.querySelector('#monitoring-card details'), 'monitoring omits duplicate follow-up and activity');
    const target = document.querySelector<HTMLButtonElement>('[aria-label="View records for Research project evaluation"]')!;
    assert(!!target, 'period progress has an accessible records action');
    target.click(); await pause();
    assert(document.querySelector('#route')?.textContent?.includes('status=All%20Records'), 'period records remain accessible');
  }
  if (page.startsWith('entry')) {
    const mark = document.querySelector<HTMLInputElement>('input[type=number]')!;
    assert(mark.getBoundingClientRect().height >= 42, 'mark input has usable height');
    const total = [...document.querySelectorAll<HTMLElement>('.card-metric')].find(row => row.textContent?.includes('0.00'))!;
    assert(!!total && getComputedStyle(total).color !== 'rgb(255, 255, 255)', 'calculated total is visible on its surface');
    const feedback = document.querySelector<HTMLTextAreaElement>('textarea')!;
    assert(!!feedback.labels?.length && feedback.getAttribute('aria-label')?.includes(component.name), 'component feedback has a persistent associated label and component name');
    assert(!!document.querySelector<HTMLTextAreaElement>(`#marks-comments-${task.id}`)?.labels?.length, 'overall comments have an associated visible label');
    assert(mark.getAttribute('aria-label')?.includes(component.name), 'score field identifies its rubric component');
    assert(!document.body.textContent?.includes('The total updates as you enter marks'), 'calculated total omits redundant instructions');
    if (page === 'entry-readonly') assert(mark.disabled && feedback.disabled && !button('Save draft') && !button('Submit marks'), 'read-only entry retains disabled fields and hides mutations');
    else if (page === 'entry-draft-only') {
      assert(!button('Save draft')?.disabled && button('Submit marks')?.disabled, 'draft-only capability retains save and blocks submission');
      assert(button('Submit marks')?.getAttribute('aria-describedby') === `marks-submit-help-${task.id}` && document.body.textContent?.includes('You can still save a draft'), 'blocked submission has one associated contextual explanation');
    } else {
      assert(!!button('Save draft') && !!button('Submit marks'), 'editable entry retains draft and submit actions');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(mark, '64.5');
      mark.dispatchEvent(new Event('input', { bubbles: true })); await pause();
      assert(total.textContent?.includes('64.50'), 'score edits still update the calculated total');
      button('Submit marks')!.click(); await until(() => !!document.querySelector('dialog[open]'));
      assert(document.querySelector('dialog[open]')?.textContent?.includes('Submitted marks lock immediately'), 'submission consequences remain in confirmation');
      button('Review again')!.click(); await pause();
      assert(mark.value === '64.5', 'cancelling submission retains entered scores');
    }
  }
  if (page === 'history-error') {
    assert(!!document.querySelector('#submitted-evaluation-results [role="alert"]') && !!button('Retry'), 'history failures expose contextual recovery');
    assert(!document.body.textContent?.includes('No submitted evaluations yet'), 'history failure is never shown as empty');
    assert(activeTaskReads === 0, 'restored history never calls active-task generation');
    fail = false; button('Retry')!.click(); await until(() => !!document.querySelector('#marks-entry-history p[role="status"]'));
    assert(document.querySelectorAll('tbody tr').length === 1 && submissionReads === 2 && activeTaskReads === 0, 'retry reads history only and restores submissions');
  }
  if (page === 'history-retained') {
    const root = () => document.querySelector('#marks-entry-history')!;
    const roleButton = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('nav button')].find(node => node.textContent?.includes(label))!;
    const enter = async (id: string, value: string) => { const field = document.getElementById(id) as HTMLInputElement; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); await pause(); };
    assert(activeTaskReads === 0 && submissionReads === 1, 'history has its own read without requiring active tasks');
    assert(root().querySelectorAll('tbody tr').length === 2 && root().querySelector('tbody tr')?.textContent?.includes('January evaluation'), 'cross-year submission timestamps sort newest first');
    assert(root().textContent?.includes('Assignment ended') && root().textContent?.includes('Assignment paused'), 'ended and paused assignments remain visible');
    await enter('marks-history-from', '2026-01-02'); await enter('marks-history-to', '2026-01-02');
    assert(root().querySelectorAll('tbody tr').length === 1 && root().querySelector('tbody')?.textContent?.includes('January evaluation'), 'inclusive date filters use the Malaysia day across midnight UTC');
    await enter('marks-history-from', '2026-02-01');
    assert(!!root().querySelector('#history-date-error') && document.querySelector('#marks-history-to')?.getAttribute('aria-invalid') === 'true', 'invalid date ranges get a local field-linked error');
    button('Clear filters')!.click(); await pause();
    assert(root().querySelectorAll('tbody tr').length === 2, 'clear restores role submissions and clears dates');
    await enter('marks-history-search', 'Earlier evaluation');
    assert(root().querySelectorAll('tbody tr').length === 1, 'period identity is searchable');
    button('Clear filters')!.click(); await pause();
    roleButton('My panel students').click(); await pause();
    assert(root().querySelectorAll('tbody tr').length === 1 && root().querySelector('tbody')?.textContent?.includes('Fictional Panel Submission'), 'history role switching isolates panel submissions');
    roleButton('Backup marking').click(); await pause();
    assert(root().querySelector('tbody')?.textContent?.includes('Fictional Backup Submission'), 'historical backup work remains discoverable without a current backup task');
    const view = button('View submission')!;
    if (innerWidth < 640) assert(view.getBoundingClientRect().right <= innerWidth, 'phone history keeps View submission visible without sideways scrolling');
    view.click(); await until(() => !!document.querySelector('[data-record-page]'));
    const detailPage = document.querySelector('[data-record-page]')!;
    assert(detailPage.textContent?.includes('Fictional Backup Submission') && detailPage.textContent?.includes('Research assessment') && !detailPage.querySelector('input,textarea'), 'retained submission opens with rubric context and no editable fields');
    assert(![...detailPage.querySelectorAll('button')].some(node => /Save draft|Submit marks|Reopen/.test(node.textContent || '')), 'history cannot expose academic write actions');
    button('Back to Marks Entry History')!.click(); await until(() => !document.querySelector('[data-record-page]'));
    assert(roleButton('Backup marking').getAttribute('aria-current') === 'page' && activeTaskReads === 0, 'detail return preserves the history role without generating tasks');
    roleButton('My supervisees').click(); await pause();
  }
  if (page.startsWith('lecturer') || page === 'history' || page === 'history-empty') {
    const history = page.startsWith('history');
    const panel = document.querySelector('[data-workspace-filter-card]')!;
    assert(!!panel && !!button('Clear filters'), 'lecturer lists share the portal filter and reset pattern');
    const search = panel.querySelector<HTMLInputElement>('input[type="search"]')!;
    assert(!!search.labels?.length && parseFloat(getComputedStyle(search).fontSize) === 12, 'lecturer search is labelled and uses shared filter typography');
    assert(!button('Apply') && !button('Apply filters'), 'lecturer lists filter without an Apply action');
    assert(!document.body.textContent?.includes('persisted') && !document.body.textContent?.includes('Important Notice'), 'lecturer lists avoid technical wording and duplicate notices');
    if (page === 'lecturer-error') {
      assert(!!document.querySelector('[role="alert"]') && !!button('Retry'), 'lecturer read failures retain contextual retry');
      assert(!document.querySelector('article[aria-label="Assigned tasks"]'), 'failed lecturer reads never display fabricated zero summary totals');
      fail = false; button('Retry')!.click(); await until(() => !!button('Start marking'));
    }
    if (page === 'lecturer-empty' || page === 'history-empty') {
      assert(document.body.textContent?.includes(history ? 'No submitted evaluations yet' : 'No supervisee marking tasks assigned.'), 'empty lecturer lists explain their actual state');
      assert(!document.body.textContent?.includes('Showing 1 to 0'), 'empty lists never claim the first row exists');
    } else {
      const enter = async (value: string) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, value); search.dispatchEvent(new Event('input', { bubbles: true })); await pause(); };
      await enter('no matching student');
      assert(document.body.textContent?.includes(history ? 'No submissions match your filters' : 'No tasks match your filters'), 'typing automatically produces a distinct filtered empty state');
      button('Clear filters')!.click(); await pause();
      assert(search.value === '' && document.querySelectorAll('tbody tr').length === (history ? 1 : page.endsWith('-only') ? 1 : 2), 'reset restores lecturer results');
      if (!history && !page.endsWith('-only')) {
        const status = panel.querySelector<HTMLSelectElement>('select[aria-label="Task status"]')!;
        status.value = 'SUBMITTED'; status.dispatchEvent(new Event('change', { bubbles: true })); await pause();
        assert(document.querySelectorAll('tbody tr').length === 1 && document.body.textContent?.includes('1 of 2 tasks'), 'status filters update immediately with an accurate result count');
        button('Clear filters')!.click(); await pause();
        assert(!button('View student record'), 'student navigation is hidden when no destination was supplied');
        assert(![...document.querySelectorAll('button')].some(node => node.textContent?.trim() === '1'), 'lecturer results do not show inert pagination');
        button('View submission history')!.click(); await until(() => !!document.querySelector('#marks-entry-history p[role="status"]'));
        assert(document.body.textContent?.includes('Marks Entry History'), 'submission history remains reachable');
        button('Back to Marks Entry')!.click(); await until(() => !!document.querySelector('#mark-entry-tasks-list-block > p[role="status"]'));
        assert(document.querySelectorAll('#mark-entry-tasks-list-block tbody tr').length === 2, 'returning from history restores the task list');
      }
    }
  }
  if (page.startsWith('lecturer')) {
    const roleButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Marking responsibility"] button')].find(node => node.textContent?.includes(label))!;
    assert(!!roleButton('My supervisees') && !!roleButton('My panel students'), 'both responsibilities remain visible even when empty');
    assert(!!document.querySelector('#mark-entry-tasks-list-block [data-workspace-filter-card]'), 'filters belong to the task results card');
    if (page === 'lecturer-empty') assert(!document.querySelector('#mark-entry-tasks-list-block table'), 'an empty queue omits table scaffolding');
    const firstAction = [...document.querySelectorAll<HTMLButtonElement>('#mark-entry-tasks-list-block tbody button')][0];
    if (firstAction && innerWidth < 640) assert(firstAction.getBoundingClientRect().right <= innerWidth && firstAction.getBoundingClientRect().left >= 0, 'phone rows expose the marking action without horizontal scrolling');
    if (page === 'lecturer-mixed') {
      assert(roleButton('My supervisees').textContent?.includes('1 pending marking task') && roleButton('My panel students').textContent?.includes('1 pending marking task'), 'both queues retain accessible pending task counts');
      roleButton('My panel students').click(); await pause();
      assert(roleButton('My panel students').getAttribute('aria-current') === 'page', 'panel responsibility is explicitly selected');
      const rows = document.querySelector('#mark-entry-tasks-list-block tbody')!;
      assert(rows.textContent?.includes('Fictional Panel Student') && !rows.textContent?.includes(task.studentName), 'panel results never mix supervisees');
      assert(document.querySelector('article[aria-label="Assigned tasks"]')?.textContent?.includes('2'), 'summary counts follow the selected responsibility');
      assert(!!button('Continue marking') && !!button('View submission'), 'actions describe draft and submitted states');
      button('Continue marking')!.click(); await until(() => !!document.querySelector('#mark-entry-detail-page'));
      assert(document.querySelector('[data-record-metadata]')?.textContent?.includes('Marking as Panel Member'), 'marking form keeps the panel responsibility visible');
      button('Back to Marks Entry')!.click(); await until(() => !document.querySelector('#mark-entry-detail-page'));
      assert(roleButton('My panel students').getAttribute('aria-current') === 'page', 'returning from a marking record retains role selection');
      button('View submission history')!.click(); await until(() => !!document.querySelector('#marks-entry-history p[role="status"]'));
      assert(document.body.textContent?.includes('as Panel member') && document.querySelector('tbody')?.textContent?.includes('Fictional Panel Submission') && !document.querySelector('tbody')?.textContent?.includes(task.studentName), 'history keeps the chosen marking responsibility');
      button('Back to Marks Entry')!.click(); await until(() => !!document.querySelector('#mark-entry-tasks-list-block > p[role="status"]'));
      assert(roleButton('My panel students').getAttribute('aria-current') === 'page', 'returning preserves the selected responsibility');
      roleButton('Backup marking').click(); await pause();
      assert(document.querySelector('tbody')?.textContent?.includes('Fictional Backup Student') && document.querySelectorAll('tbody tr').length === 1, 'backup tasks remain separate and reachable');
      roleButton('My supervisees').click(); await pause();
    }
    if (page.endsWith('-only')) {
      const selected = page === 'lecturer-panel-only' ? 'My panel students' : 'Backup marking';
      assert(roleButton(selected).getAttribute('aria-current') === 'page', 'first load opens an assigned responsibility');
      roleButton('My supervisees').click(); await pause();
      assert(document.body.textContent?.includes('No supervisee marking tasks assigned.') && !document.querySelector('table'), 'empty role remains selected without misleading rows');
      roleButton(selected).click(); await pause();
    }
  }
  if (page === 'rubrics' || page === 'rubrics-locked') {
    if (page === 'rubrics-locked') assert(document.body.textContent?.includes('Clone a new version') && !button('Add component'), 'locked rubric explains the next action and keeps editing unavailable');
    else for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[placeholder],textarea[placeholder]')) assert(!!field.labels?.length, 'rubric component fields have persistent visible labels');
  }
  if (page.startsWith('periods')) {
    const contextDetail = page === 'periods-context';
    const archiveToggle = () => document.querySelector<HTMLInputElement>('#evaluation-period-list-toolbar input[type="checkbox"]');
    const periodList = () => document.querySelector('[aria-label="Configured evaluation periods"]');
    await until(() => contextDetail ? !!document.querySelector('form') : !!periodList());
    if (contextDetail) {
      assert(!!document.querySelector('form') && !periodList(), 'exact period context opens its editor directly');
      assert(document.querySelector<HTMLInputElement>('#marks-period-name')?.disabled, 'context-selected published identity stays locked');
      button('Back to period list')!.click(); await until(() => !!periodList());
    }
    assert(!document.querySelector('form'), 'browsing periods does not display the editor');
    if (page === 'periods-empty') {
      const emptyCard = document.querySelector('[data-period-empty]');
      assert(!!emptyCard && getComputedStyle(emptyCard).backgroundColor === 'rgb(255, 255, 255)', 'empty periods use the shared white workspace card');
      assert(!document.querySelector('#evaluation-period-list-toolbar'), 'empty page omits the redundant list heading');
      const newActions = [...document.querySelectorAll('button')].filter(node => node.textContent?.trim() === 'New period');
      assert(newActions.length === 1 && emptyCard!.contains(newActions[0]), 'one creation action sits with the empty-state explanation');
      assert(!emptyCard!.querySelector('[role="alert"]'), 'an empty list is not presented as an alert');
    }
    if (page === 'periods') for (const status of ['Draft', 'Published', 'Closed']) assert(periodList()?.textContent?.includes(status), `${status} lifecycle is visible in the list`);
    if (page === 'periods-archived' || page === 'periods-archived-only') {
      const archived = archiveToggle()!;
      assert(!!archived && !archived.checked, 'archive option appears only when archived periods exist and starts off');
      assert(!periodList()?.textContent?.includes(archivedPeriod.name), 'archived periods are hidden initially');
      archived.click(); await until(() => !!periodList()?.textContent?.includes(archivedPeriod.name));
      assert(document.body.textContent?.includes('Archived periods are read-only'), 'historical inclusion explains read-only access');
      [...periodList()!.querySelectorAll('button')].find(node => node.textContent?.includes(archivedPeriod.name))!.click();
      await until(() => !!document.querySelector('form'));
      assert(document.querySelector<HTMLInputElement>('#marks-period-name')?.disabled && !button('Save changes') && !button('Archive'), 'archived detail remains read-only');
      button('Back to period list')!.click(); await until(() => !!periodList());
      archiveToggle()!.click(); await until(() => !periodList()?.textContent?.includes(archivedPeriod.name) && !document.body.textContent?.includes('Loading evaluation periods'));
      assert(!archiveToggle()!.checked, 'archive filter returns to current periods');
    } else assert(!archiveToggle(), 'archive option is hidden when there are no archived periods');
    if (page === 'periods-archived-only') assert(document.body.textContent?.includes('No current evaluation periods'), 'archived-only empty state explains hidden historical periods');
    if (page !== 'periods-empty' && page !== 'periods-archived-only') {
      periodList()!.querySelector<HTMLButtonElement>('button')!.click();
      await until(() => !!document.querySelector('[aria-label="Closure preview"]'));
      assert(!periodList() && !document.querySelector('#evaluation-period-list-toolbar'), 'period detail has its own focused view');
      assert(document.querySelector<HTMLInputElement>('#marks-period-name')?.disabled && !button('Save changes'), 'published period identity remains locked');
      assert(button('Confirm closure / handover')?.disabled, 'closure still requires its reason and acknowledgement');
      assert(!!button('Manage deadlines in Periods & deadlines'), 'published deadline control retains its central destination');
      button('Back to period list')!.click(); await until(() => !!periodList());
    }
    button('New period')!.click();
    await until(() => !!document.querySelector('#marks-period-name') && document.activeElement === document.querySelector('#marks-period-name'));
    const name = document.querySelector<HTMLInputElement>('#marks-period-name')!;
    assert(name.value === '' && !name.disabled && document.body.textContent?.includes('New draft period'), 'New period opens a blank draft and focuses its name');
    assert(!periodList(), 'creation form is separate from period browsing');
    assert(name.getBoundingClientRect().top >= 0 && name.getBoundingClientRect().bottom <= innerHeight, 'first draft field is in view');
    if (page === 'periods-empty') {
      assert(document.querySelector('a[href="/marks/rubrics"]')?.textContent === 'Configure a rubric', 'missing rubric offers a direct setup destination');
      assert(button('Create draft')?.disabled, 'missing rubric still blocks creation');
    }
    button('Back to period list')!.click(); await until(() => !!periodList());
    assert(!document.querySelector('form'), 'returning to the list closes the editor without writing');
    assert(document.activeElement === periodList() || document.activeElement?.textContent?.trim() === 'Evaluation periods', 'returning restores focus to the period list');
    if (page === 'periods-new') { button('New period')!.click(); await until(() => !!document.querySelector('form')); }
    if (page === 'periods-published') { periodList()!.querySelector<HTMLButtonElement>('button')!.click(); await until(() => !!document.querySelector('form')); }
    if (page === 'periods-archived' || page === 'periods-archived-only') { archiveToggle()!.click(); await until(() => !!periodList()?.textContent?.includes(archivedPeriod.name)); }
    window.scrollTo(0, 0);
  }
  if (['rubrics', 'rubrics-locked', 'history', 'submitted', 'office-detail', 'completion'].includes(page)) {
    for (const table of document.querySelectorAll('table')) {
      assert(!!table.querySelector('caption'), 'data tables have an accessible description');
      assert([...table.querySelectorAll('th')].every(node => node.scope === 'col'), 'table headers identify their column scope');
      const region = table.closest<HTMLElement>('[role="region"]');
      assert(!!region?.getAttribute('aria-label') && region.tabIndex === 0, 'wide data tables provide named keyboard-scroll regions');
    }
  }
  if (page.startsWith('records')) {
    const workspace = document.querySelector('#mark-entry-records-dashboard')!;
    assert(!document.querySelector('#records-metrics-grid'), 'records do not duplicate status counts in five cards');
    const surface = document.querySelector('#mark-records-table-container')!;
    assert(surface.contains(document.querySelector('#records-filters-card')), 'search and results share one workspace');
    const search = document.querySelector<HTMLInputElement>('#records-search')!;
    assert(search.labels?.[0]?.textContent?.trim() === 'Search records', 'search has an associated label');
    assert(parseFloat(getComputedStyle(search).paddingLeft) >= 32, 'search text clears its leading icon');
    assert(!document.querySelector('[role=tablist]'), 'status controls are filters rather than navigation tabs');
    const filterPanel = surface.querySelector('[data-workspace-filter-card]')!;
    assert(!!filterPanel, 'records reuse the same workspace filter panel as other modules');
    assert(parseFloat(getComputedStyle(filterPanel).paddingTop) === (innerWidth >= 640 ? 20 : 12), 'record panel matches appointment desktop/mobile padding');
    assert(!document.querySelector('#records-more-filters'), 'record fields use one visible grid without a second filter disclosure');
    assert(filterPanel.querySelectorAll('select').length === 4, 'status and all three secondary filters remain visible');
    const recordStatus = filterPanel.querySelector<HTMLSelectElement>('select[aria-label="Record status"]')!;
    assert(!!recordStatus, 'records have one labelled status control');
    assert(!button('Apply filters') && !search.form, 'records filter automatically without an Apply button or submission form');
    assert(parseFloat(getComputedStyle(search).fontSize) === 12 && parseFloat(getComputedStyle(filterPanel.querySelector('button[aria-label="Record status"]')!).fontSize) === 12, 'record filter values use the shared 12px font');
    assert(parseFloat(getComputedStyle(search.labels![0]).fontSize) === 10, 'record filter labels use the shared 10px font');
    if (innerWidth >= 1280) assert(Math.abs(search.getBoundingClientRect().bottom - filterPanel.querySelector('button[aria-label="Record status"]')!.getBoundingClientRect().bottom) < 2, 'desktop search and status controls align along the same baseline');
    assert(surface.getBoundingClientRect().top < (page === 'records-monitoring-empty' ? 600 : 230), 'records workspace starts close to the heading, allowing its dashboard monitoring notice');
    if (page === 'records-error') {
      assert(!!workspace.querySelector('[role=alert]') && !!button('Retry'), 'record read errors retain retry');
      assert(recordStatus.options[0].textContent?.includes('—'), 'failed reads do not invent zero counts');
      fail = false; button('Retry')!.click(); await until(() => surface.querySelectorAll('tbody tr').length === 3);
      assert(!workspace.querySelector('[role=alert]'), 'records recover after retry');
    } else if (page === 'records-monitoring-empty') {
      assert(!workspace.querySelector('table'), 'empty monitoring scope omits the empty table');
      assert(workspace.textContent?.includes('No records in this monitoring view'), 'empty monitoring scope is distinguished from an empty registry');
      assert(workspace.textContent?.includes('Counts for this dashboard monitoring view'), 'monitoring count scope is labelled correctly');
      assert(!!button('Clear monitoring view'), 'monitoring scope can still be cleared independently');
    } else if (page === 'records-empty') {
      assert(!workspace.querySelector('table'), 'empty registry omits wide table scaffolding');
      assert(workspace.textContent?.includes('No mark records yet'), 'empty registry explains that no records exist');
      assert(!document.querySelector('#records-pagination-footer'), 'empty registry has no meaningless pagination');
    } else if (page === 'records-legacy') {
      assert(recordStatus.value === 'Overdue', 'legacy applied status is visible in the single status filter');
      assert(surface.querySelectorAll('tbody tr').length === 1, 'legacy status continues to constrain records');
      assert(recordStatus.value === 'Overdue', 'restored status stays visible with automatic filtering');
      button('Clear filters')!.click(); await pause();
      assert(surface.querySelectorAll('tbody tr').length === 3, 'reset clears legacy status state');
    } else if (page === 'records-paged') {
      assert(surface.querySelectorAll('tbody tr').length === 5, 'records retain five rows per page');
      assert(document.querySelectorAll('#records-pagination-footer button').length <= 7, 'pagination stays bounded for many records');
      document.querySelector<HTMLButtonElement>('[aria-label="Page 24"]')!.click(); await pause();
      assert(document.querySelector('[aria-current=page]')?.textContent?.trim() === '24', 'last page remains directly accessible');
      assert(document.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.disabled, 'last page disables next');
      recordStatus.value = 'Overdue'; recordStatus.dispatchEvent(new Event('change', { bubbles: true })); await pause();
      assert(document.querySelector('[aria-current=page]')?.textContent?.trim() === '1', 'filtering resets pagination');
    } else {
      assert(surface.querySelectorAll('tbody tr').length === 3, 'initial records are visible');
      const statusControl = filterPanel.querySelector<HTMLButtonElement>('button[aria-label="Record status"]')!;
      statusControl.focus(); assert(document.activeElement === statusControl, 'status filter is keyboard focusable');
      recordStatus.value = 'Overdue'; recordStatus.dispatchEvent(new Event('change', { bubbles: true })); await pause();
      assert(recordStatus.value === 'Overdue' && surface.querySelectorAll('tbody tr').length === 1, 'status dropdown narrows records immediately');
      button('Clear filters')!.click(); await pause();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(search, 'no-such-student'); search.dispatchEvent(new Event('input', { bubbles: true })); await pause();
      assert(workspace.textContent?.includes('No records match your filters'), 'typing filters records automatically');
      assert(!workspace.querySelector('table'), 'filtered empty results omit table scaffolding');
      button('Clear filters')!.click(); await pause();
      assert(search.value === '' && surface.querySelectorAll('tbody tr').length === 3, 'clear restores search and status together');
      const programme = filterPanel.querySelector<HTMLSelectElement>('select[aria-label="Programme"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(programme, 'Master of Computer Science');
      programme.dispatchEvent(new Event('change', { bubbles: true })); await pause();
      assert(surface.querySelectorAll('tbody tr').length === 2, 'programme filter narrows records automatically');
      assert(programme.value === 'Master of Computer Science', 'applied programme remains visible in the filter grid');
      button('Clear filters')!.click(); await pause();
      assert(surface.querySelectorAll('tbody tr').length === 3, 'reset clears secondary filters');
      for (const [field, value, label] of [['Semester', 'Semester II 2026/2027', 'semester'], ['Evaluator', 'Fictional Evaluator Two', 'evaluator']]) {
        const select = filterPanel.querySelector<HTMLSelectElement>(`select[aria-label="${field}"]`)!;
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
        select.dispatchEvent(new Event('change', { bubbles: true })); await pause();
        assert(surface.querySelectorAll('tbody tr').length === 1, `${label} filter narrows records automatically`);
        button('Clear filters')!.click(); await pause();
      }

      assert(surface.querySelectorAll('thead th').length === 8, 'related record metadata is grouped into eight columns');
      assert(!!surface.querySelector('caption'), 'record table has an accessible caption');
      document.querySelector<HTMLButtonElement>('[aria-label="View mark record REC-1"]')!.click(); await pause();
      assert(document.querySelector('#route')?.textContent === '/marks/records/REC-1', 'record detail retains its identifier');
      document.querySelector<HTMLButtonElement>('[aria-label="View student record for Fictional Student 1"]')!.click(); await pause();
      assert(document.querySelector('#route')?.textContent === '/students/DEMO-001', 'student dossier navigation is preserved');
    }
  }
  const pageTitle = document.querySelector('h1');
  if (pageTitle) {
    assert(parseFloat(getComputedStyle(pageTitle).fontSize) >= 24, 'page title retains the portal heading scale');
    assert(parseFloat(getComputedStyle(pageTitle).fontWeight) >= 600, 'page title retains heading emphasis');
  }
  assert(writes === 0, 'visual review performs no writes');
  assert(unknown.length === 0, 'all fixture reads are explicitly mocked');
  assert(document.documentElement.scrollWidth <= innerWidth + 1, 'page has no horizontal overflow');
  const clipped = [...document.querySelectorAll<HTMLElement>('h1,h2,h3')].filter(node => node.getBoundingClientRect().width && node.scrollWidth > node.clientWidth + 1).map(node => node.textContent);
  assert(!clipped.length, 'headings remain readable');
  document.activeElement instanceof HTMLElement && document.activeElement.blur();
  parent.postMessage({ type: 'marks-visual-results', page, width: innerWidth, checks }, location.origin);
} catch (error) { parent.postMessage({ type: 'marks-visual-results', page, width: innerWidth, checks, error: String(error) }, location.origin); }
