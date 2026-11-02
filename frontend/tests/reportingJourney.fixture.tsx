import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { WorkflowReports } from '../src/components/WorkflowReports';
import { StudentProgressDossier } from '../src/components/StudentProgressDossier';
import { WorkflowReconciliationCentre } from '../src/components/WorkflowReconciliationCentre';
import { TimelineManagement } from '../src/components/TimelineManagement';
import { ListState } from '../src/components/ListState';
import { RecordPageProvider } from '../src/components/RecordPage';
import { setAuthToken, request, requestBlob } from '../src/services/apiClient';
import type { UserRole, WorkflowReport, StudentProgressDossier as Dossier, ReconciliationListResponse } from '../src/types';

const checks: string[] = [];
const check = (value: unknown, label: string) => { if (!value) throw Error(label); checks.push(label); };
const pause = () => new Promise(resolve => setTimeout(resolve, 35));
const text = () => document.getElementById('root')!.textContent ?? '';
const until = async (predicate: () => unknown) => {
  for (let i = 0; i < 650; i++) { if (predicate()) return; await pause(); }
  throw Error('A05 timed out: ' + text().slice(-900));
};
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('button')].filter(node => node.getClientRects().length);
const button = (label: string) => buttons().find(node => node.textContent?.trim() === label);
const click = async (label: string, scope: ParentNode = document) => {
  const node = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(node => node.getClientRects().length && node.textContent?.trim() === label);
  if (!node || node.disabled) throw Error('Missing or disabled A05 button: ' + label);
  node.click(); await pause();
};
const enter = async (node: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  if (!node) throw Error('Missing A05 input');
  Object.getOwnPropertyDescriptor(node instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype, 'value')!.set!.call(node, value);
  node.dispatchEvent(new Event('input', { bubbles: true })); await pause();
};
const choose = async (label: string, value: string) => {
  const select = [...document.querySelectorAll('label')].find(node => node.textContent?.includes(label))?.querySelector('select');
  if (!select) throw Error('Missing A05 select ' + label);
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true })); await pause();
};
let root: Root | null = null;
const nativeFetch = window.fetch.bind(window);
const downloads: { filename: string; url: string }[] = [];
const nativeAnchorClick = HTMLAnchorElement.prototype.click;
// Capture only the native save boundary. Real authorized XLSX bytes are fetched
// and independently parsed; filesystem/browser-download acceptance remains A07.
HTMLAnchorElement.prototype.click = function () {
  if (this.download) { downloads.push({ filename: this.download, url: this.href }); return; }
  nativeAnchorClick.call(this);
};
let failingPath = '', holdPath = '', release: (() => void) | undefined;
let held = false, exportReads = 0, injectPrivateClosure = false;
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.origin).pathname;
  if (failingPath && path === failingPath) throw new TypeError('A05 simulated transport outage');
  const response = await nativeFetch(input, init);
  if (path.endsWith('/reports/export/') && response.ok) exportReads++;
  if (holdPath && path === holdPath) {
    holdPath = ''; held = true;
    await new Promise<void>(resolve => { release = resolve; });
  }
  if (injectPrivateClosure && path.includes('/dashboard/progress/') && response.ok) {
    const data = await response.json() as Dossier;
    for (const row of data.supervisor?.records ?? []) {
      if (row.appointment) row.appointment.endReason = 'PRIVATE injected primary closure';
      row.workflow = [{ id: 999999, action: 'OFFICE_CANCEL_PARTICIPANT_LIFECYCLE',
        actorName: 'PRIVATE audit actor', actorRole: 'Office Staff/Admin',
        previousStatus: 'ACTIVE', newStatus: 'WITHDRAWN', reason: 'PRIVATE injected workflow audit',
        createdAt: '2026-10-28T12:00:00Z' }];
    }
    for (const row of data.supervisoryTeam?.appointments ?? []) {
      row.endReason = 'PRIVATE injected supporting closure';
    }
    return new Response(JSON.stringify(data), { status: response.status,
      headers: { 'Content-Type': 'application/json' } });
  }
  return response;
};
const report = (result: unknown) => {
  document.getElementById('journey-results')!.textContent = JSON.stringify(result);
  window.parent.postMessage({ type: 'a05-results', result }, location.origin);
};
try {
  const config = await (await fetch('/journey-config')).json();
  const roles: Record<string, UserRole> = { office: 'Office Staff/Admin', coordinator: 'Programme Coordinator', primary: 'Lecturer', supporting: 'Lecturer', student: 'Student' };
  const render = (content: React.ReactNode) => root!.render(<MemoryRouter><ListState.Provider value={new Map()}><RecordPageProvider>{content}</RecordPageProvider></ListState.Provider></MemoryRouter>);
  const mount = async (actor: string, content: React.ReactNode) => {
    root?.unmount(); root = createRoot(document.getElementById('root')!);
    setAuthToken(config.tokens[actor]); render(content); await pause();
  };
  const dossier = (id: string, role: UserRole = 'Office Staff/Admin') => <StudentProgressDossier studentId={id} currentUserRole={role} onBack={() => {}} onNavigateToRoute={() => {}} />;
  const denied = async (path: string, expected: number) => {
    let code: number | undefined;
    try { await request(path); } catch (error) { code = (error as { status: number }).status; }
    check(code === expected, `${path} rejects outside-scope access with ${expected}`);
  };
  const geometry = () => check(document.documentElement.scrollWidth <= innerWidth + 1, 'Production layout stays within the exact viewport');
  check(innerWidth === config.width, 'Browser uses exact requested CSS width');

  if (config.mode === 'privacy') {
    setAuthToken(config.tokens.student);
    const publicData = await request<Dossier>(`/dashboard/progress/${config.matricNo}/`);
    check(publicData.student.status === 'Withdrawn' && publicData.marks === null, 'Terminal Student dossier retains public status without Marks');
    check(!JSON.stringify(publicData).includes('PRIVATE'), 'Real terminal dossier API excludes private lifecycle and closure reasons');
    const applications = await request<unknown>('/appointments/supervisor/applications/');
    check(!JSON.stringify(applications).includes('PRIVATE'), 'Real Student request list excludes private lifecycle reasons');
    const recordId = publicData.supervisor!.records[0].recordId;
    const application = await request<unknown>(`/appointments/supervisor/applications/${recordId}/`);
    check(!JSON.stringify(application).includes('PRIVATE'), 'Real Student request detail excludes private lifecycle reasons');
    await mount('student', dossier(config.matricNo, 'Student'));
    await until(() => text().includes('My Academic Record') && document.querySelector('[role="tablist"]'));
    await click('Supervision');
    check(!text().includes('PRIVATE') && text().includes('Co-supervisor'), 'Student sees ended team history without staff reasons');
    geometry();
    // Deliberately contaminated supplied data tests the UI's independent guard.
    // The unmodified API was checked above; all underlying records remain real.
    injectPrivateClosure = true;
    await mount('student', dossier(config.matricNo, 'Student'));
    await until(() => text().includes('My Academic Record') && document.querySelector('[role="tablist"]'));
    await click('Supervision');
    check(!text().includes('PRIVATE'), 'Public UI suppresses private closure fields and workflow audits even in contaminated data');
    injectPrivateClosure = false;
    await mount('office', dossier(config.matricNo));
    await until(() => text().includes('Student Progress Dossier') && document.querySelector('[role="tablist"]'));
    await click('Supervisor');
    check(text().includes('PRIVATE lifecycle decision'), 'Office retains persisted closure reasons and history');
    const staff = await request<{ appointmentLifecycle: { endReason: string; lifecycle: unknown[] } }>(`/appointments/supervisor/applications/${recordId}/`);
    check(staff.appointmentLifecycle.endReason === 'PRIVATE lifecycle decision' && staff.appointmentLifecycle.lifecycle.length > 0,
      'Office request API retains closure reason and immutable audit');
    check(!publicData.visibleSections.includes('MARKS'), 'Terminal Student section allowlist still excludes Marks');
    geometry();
  } else if (config.mode === 'race') {
    holdPath = `/api/dashboard/progress/${config.matricNo}/`;
    await mount('office', dossier(config.matricNo));
    await until(() => held);
    check(text().includes('Loading student progress'), 'First dossier response can be held after real HTTP completes');
    render(dossier(config.foreignMatric));
    await until(() => text().includes(config.foreignName));
    check(!text().includes(config.studentName), 'Newer exact student dossier renders without the pending old record');
    release!(); await pause(); await pause();
    check(text().includes(config.foreignName) && !text().includes(config.studentName), 'Late previous-student response cannot replace the current dossier');
    render(dossier('A05-UNKNOWN'));
    await until(() => text().includes('Dossier not available'));
    check(!text().includes(config.foreignName), 'Unknown destination clears the previously visible student');
    held = false; holdPath = `/api/dashboard/progress/${config.matricNo}/`;
    render(dossier(config.matricNo)); await until(() => held);
    const releaseOld = release!;
    held = false; holdPath = `/api/dashboard/progress/${config.foreignMatric}/`;
    render(dossier(config.foreignMatric)); await until(() => held);
    const releaseCurrent = release!;
    releaseOld(); await pause(); await pause();
    check(text().includes('Loading student progress') && !text().includes(config.studentName), 'Old completion cannot dismiss the newer request loading state');
    releaseCurrent(); await until(() => text().includes(config.foreignName));
    check(!text().includes(config.studentName), 'The newer pending request resolves to its own identity');
    held = false; holdPath = '/api/dashboard/progress/A05-UNKNOWN/';
    render(dossier('A05-UNKNOWN')); await until(() => held);
    const releaseError = release!;
    render(dossier(config.foreignMatric)); await until(() => text().includes(config.foreignName));
    releaseError(); await pause(); await pause();
    check(text().includes(config.foreignName) && !text().includes('Dossier not available'), 'Late previous-student 404 cannot hide the current authorized dossier');
    geometry();
  } else if (config.mode === 'reports') {
    for (const actor of ['office', 'coordinator', 'primary', 'supporting']) {
      await mount(actor, <WorkflowReports currentUserRole={roles[actor]} onBack={() => {}} onNavigateToRoute={() => {}} />);
      await until(() => button('Download XLSX') && !button('Download XLSX')!.disabled);
      const data = await request<WorkflowReport>('/dashboard/reports/?semester=all');
      const total = ['supervisor', 'panel', 'researchAmendments', 'marks', 'timeline'].reduce((sum, key) => sum + ((data as any)[key]?.total ?? 0), 0);
      check(total === data.overview.totalRecords, `${actor} totals equal its authorized sections`);
      if (actor === 'coordinator') {
        check(data.marks === null && data.capacity === null, 'Coordinator report omits Marks and faculty capacity');
        check(!JSON.stringify(data).includes(config.foreignMatric), 'Coordinator data excludes foreign programme records');
      }
      if (actor === 'supporting') {
        check(data.marks?.total === 0, 'Supporting appointment alone grants no Marks reporting');
      }
      await choose('Academic semester', 'all');
      await until(() => !button('Download XLSX')!.disabled);
      const count = exportReads;
      await click('Download XLSX');
      await until(() => exportReads > count && document.body.textContent?.includes('Downloaded workflow_analytics_report.xlsx'));
      check(exportReads === count + 1, `${actor} download uses one real authorized export request`);
      check(downloads.at(-1)?.filename === 'workflow_analytics_report.xlsx' && downloads.at(-1)?.url.startsWith('blob:'), `${actor} download prepares the named XLSX blob`);
      const blob = await requestBlob('/dashboard/reports/export/?semester=all');
      check(blob.size > 1000 && blob.type.includes('spreadsheetml'), `${actor} workbook response contains actual XLSX bytes`);
      if (actor === 'office') {
        await choose('Programme', config.programme);
        await until(() => !button('Download XLSX')!.disabled);
        const scoped = await request<WorkflowReport>(`/dashboard/reports/?semester=all&programme=${encodeURIComponent(config.programme)}`);
        check(!JSON.stringify(scoped.supervisor).includes(config.foreignMatric), 'Office programme filter narrows persisted workflow rows');
        failingPath = '/api/dashboard/reports/';
        await choose('Academic semester', 'unassigned');
        await until(() => button('Retry'));
        check(button('Download XLSX')!.disabled, 'Failed report reads disable exporting stale data');
        failingPath = ''; await click('Retry');
        await until(() => !button('Download XLSX')!.disabled);
        check(text().includes('Workflow reports'), 'Report retry recovers through the real backend');
      }
      geometry();
    }
    await mount('student', dossier(config.matricNo, 'Student'));
    await until(() => text().includes('My Academic Record') && document.querySelector('[role="tablist"]'));
    check(!buttons().some(node => node.textContent?.trim() === 'Marks'), 'Student academic-record UI exposes no Marks tab');
    check(!text().includes('PRIVATE'), 'Student rendered academic record contains no private fixture reasons');
    const publicData = await request<Dossier>(`/dashboard/progress/${config.matricNo}/`);
    check(publicData.visibility === 'PUBLIC' && publicData.marks === null, 'Student API also redacts Marks');
    check(!JSON.stringify(publicData).includes('PRIVATE'), 'Student API excludes private Office calendar and nomination reasons');
    await denied(`/dashboard/progress/${config.foreignMatric}/`, 404);
    await denied('/dashboard/reports/', 403);
    await denied('/dashboard/reports/export/', 403);
    await denied('/dashboard/reconciliation/', 403);
    geometry();
    failingPath = `/api/dashboard/progress/${config.matricNo}/`;
    await mount('office', dossier(config.matricNo));
    await until(() => button('Retry'));
    check(!text().includes(config.studentName), 'Failed dossier load exposes no stale student details');
    failingPath = ''; await click('Retry');
    await until(() => text().includes(config.studentName));
    check(text().includes('Student Progress Dossier'), 'Dossier retry recovers exact authorized identity');
    await click('Marks');
    check(text().includes('Historical period') && !text().includes('Foreign research'), 'Office Marks dossier stays scoped to the selected student');
    geometry();
  } else {
    await mount('office', <WorkflowReconciliationCentre onBack={() => {}} onNavigateToRoute={() => {}} />);
    await until(() => document.querySelector('input[type="search"]'));
    await enter(document.querySelector('input[type="search"]')!, config.foreignMatric);
    await until(() => button('Review issue'));
    const listing = await request<ReconciliationListResponse>(`/dashboard/reconciliation/?pageSize=100&search=${config.foreignMatric}`);
    const issue = listing.results.find(row => row.issueType === 'SEMESTER_UNASSIGNED' && row.recordId === String(config.legacyId))!;
    check(!!issue, 'Real reconciliation finds the exact synthetic legacy request');
    const row = [...document.querySelectorAll('tr')].find(node => node.textContent?.includes('Academic semester is unassigned'));
    await click('Review issue', row ?? document);
    await until(() => text().includes('Reason for repair'));
    check(button('Review and confirm repair')!.disabled, 'Repair starts blocked without reason and acknowledgement');
    await enter(document.querySelector('textarea')!, 'A05 verified browser repair');
    document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); await pause();
    check(!button('Review and confirm repair')!.disabled, 'Reason and explicit acknowledgement enable review');
    let stale = 0;
    try { await request(`/dashboard/reconciliation/issues/${issue.issueId}/apply/`, { method: 'POST', body: JSON.stringify({
      expectedFingerprint: '0'.repeat(64), reason: 'Reject stale browser evidence', resolution: { action: 'ASSIGN_SEMESTER', semesterId: config.semesterId },
    }) }); } catch (error) { stale = (error as { status: number }).status; }
    check(stale === 409, 'Real API rejects stale preview without applying the repair');
    await click('Review and confirm repair');
    await until(() => document.querySelector('dialog[open]'));
    check(document.querySelector('dialog[open]')!.textContent?.includes('A05 verified browser repair'), 'Confirmation identifies the entered repair reason');
    await click('Apply audited repair', document.querySelector('dialog[open]')!);
    await until(() => text().includes('Repair completed'));
    check(!button('Review and confirm repair'), 'Committed repair cannot be submitted twice from the detail');
    const audits = await request<any>(`/dashboard/reconciliation/audits/?entityType=SUPERVISOR_APPLICATION&entityId=${config.legacyId}`);
    check(audits.results.length === 1 && audits.results[0].reason === 'A05 verified browser repair', 'Exact real repair audit records the Office reason once');
    const repaired = await request<WorkflowReport>(`/dashboard/reports/?semester=${config.semesterCode}`);
    check(repaired.supervisor?.records.some(row => String(row.recordId) === String(config.legacyId)), 'Repair immediately reconciles the source-semester report');
    geometry();
    await mount('office', <TimelineManagement onBack={() => {}} onManageSemesters={() => {}} />);
    await until(() => button('Entries'));
    await click('Entries');
    await until(() => text().includes('A05 public milestone'));
    check(text().includes('PRIVATE Office calendar'), 'Office calendar reads both authorized audiences');
    // Use production service contracts for persisted CRUD, then verify the real management/history UI.
    const created = await request<any>('/dashboard/timeline/entries/', { method: 'POST', body: JSON.stringify({
      semesterId: config.semesterId, level: 'P1', title: 'A05 browser event', detail: 'A05 browser detail',
      action: 'Student', deadlineStart: config.startDate, deadlineEnd: config.endDate, weekLabel: 'Week A05', targetRoles: ['STUDENT'],
    }) });
    check(Number.isInteger(created.id), 'Real timeline create persists a generated entry identity');
    await request(`/dashboard/timeline/entries/${created.id}/`, { method: 'PATCH', body: JSON.stringify({
      level: 'P1', title: 'A05 edited browser event', detail: 'A05 edited detail', action: 'Student',
      deadlineStart: config.startDate, deadlineEnd: config.endDate, weekLabel: 'Week A05', targetRoles: ['STUDENT'],
    }) });
    await mount('office', <TimelineManagement onBack={() => {}} onManageSemesters={() => {}} />);
    await until(() => text().includes('A05 edited browser event'));
    check(!document.getElementById('timeline-records-box')!.textContent?.includes('A05 browser event'), 'Timeline management reads the persisted revised title');
    await request(`/dashboard/timeline/entries/${created.id}/`, { method: 'DELETE' });
    await mount('office', <TimelineManagement onBack={() => {}} onManageSemesters={() => {}} />);
    await until(() => button('History')); await click('History');
    await until(() => text().includes('Deleted entry'));
    check(text().includes('Added entry') && text().includes('Edited entry'), 'Management history retains all three real CRUD audits');
    failingPath = '/api/dashboard/timeline/active/';
    await mount('office', <TimelineManagement onBack={() => {}} onManageSemesters={() => {}} />);
    await until(() => button('Retry'));
    check(!text().includes('A05 public milestone'), 'Calendar read failure clears prior event rows');
    failingPath = ''; await click('Retry');
    await until(() => text().includes('A05 public milestone'));
    check(!document.getElementById('timeline-records-box')!.textContent?.includes('A05 edited browser event'), 'Calendar retry keeps deletion and restores remaining persisted entries');
    geometry();
  }
  report({ checks, viewportWidth: innerWidth });
} catch (error) {
  report({ checks, viewportWidth: innerWidth, error: String(error) });
}
