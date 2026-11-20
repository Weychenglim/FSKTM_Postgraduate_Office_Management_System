import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { WorkflowReconciliationCentre } from '../src/components/WorkflowReconciliationCentre';
import { OfficeDashboardLayout } from '../src/components/OfficeDashboardLayout';
import type { ReconciliationIssue, ReconciliationAcceptance } from '../src/types';

const results: { name: string; error?: string }[] = [];
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 20));
const until = async (condition: () => unknown) => { for (let i = 0; i < 250; i++) { if (condition()) return; await pause(); } throw Error('Timed out'); };
const active = <T extends Element>(selector: string) => [...document.querySelectorAll<T>(selector)].filter(node => !node.closest('[hidden]'));
const text = () => document.body.innerText;
const button = (label: string) => { const dialog = [...document.querySelectorAll('dialog[open]')].at(-1); return active<HTMLButtonElement>('button').find(node => (!dialog || dialog.contains(node)) && node.textContent?.trim() === label); };
const click = async (label: string) => { await until(() => button(label)); button(label)!.click(); await pause(); };
const enter = (selector: string, value: string) => {
  const input = active<HTMLInputElement | HTMLTextAreaElement>(selector)[0]; check(input, `Missing ${selector}`);
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const initialIssues = (): ReconciliationIssue[] => [
  ...Array.from({ length: 11 }, (_, i): ReconciliationIssue => ({
    issueId: `LEGACY.${i + 1}`, issueType: 'CAPACITY_ENTRY_ROLE_MISMATCH', module: 'WORKFLOW_TRACKING', severity: 'WARNING', repairability: 'REVIEW_REQUIRED',
    title: 'Capacity entry no longer matches Lecturer roles', summary: 'Lecturer roles and recorded limits differ.', recordType: 'CAPACITY_ENTRY', recordId: String(i + 1), studentId: null, programme: null,
    currentState: { lecturerName: `Dr Lecturer ${i + 1}`, staffNo: `L${String(i + 1).padStart(3, '0')}`, semesterId: 1, semesterLabel: 'Semester I 2026/2027', planVersion: 5, supervisorLimit: 1, hasSupervisorRole: true, hasPanelRole: true, panelLimit: null, capacityPlanId: 5 },
    suggestion: {}, dependencies: [], navigation: { targetModule: 'DASHBOARD' }, fingerprint: 'a'.repeat(64),
  })),
  { issueId: 'SEMESTER.12', issueType: 'SEMESTER_UNASSIGNED', module: 'DASHBOARD', severity: 'WARNING', repairability: 'REVIEW_REQUIRED', title: 'Academic semester is unassigned', summary: 'Timeline is unassigned.',
    recordType: 'SEMESTER_TIMELINE', recordId: '12', studentId: null, programme: null, currentState: { academicSemesterId: null, isCurrentTimeline: false, recordedSemester: 'Semester I 2024/2025', matchingSemesterCount: 0 },
    suggestion: {}, dependencies: ['Select a non-conflicting semester.'], navigation: { targetModule: 'DASHBOARD', recordType: 'SEMESTER_TIMELINE', recordId: '12' }, fingerprint: 'b'.repeat(64) },
  { issueId: 'MISSING.13', issueType: 'CAPACITY_PLAN_MISSING', module: 'WORKFLOW_TRACKING', severity: 'WARNING', repairability: 'REPAIRABLE', title: 'Academic semester has no capacity plan', summary: 'No versioned policy.',
    recordType: 'ACADEMIC_SEMESTER', recordId: '13', studentId: null, programme: null, currentState: { semesterId: 13, semesterLabel: 'Semester I 2027/2028', lifecycleStatus: 'DRAFT', capacityPlanIds: [] },
    suggestion: { sourcePlanId: 5, sourcePlanVersion: 5, sourceSemesterLabel: 'Semester I 2026/2027' }, dependencies: [], navigation: {}, fingerprint: 'c'.repeat(64) },
];
let issues = initialIssues(), requests: URL[] = [], payloads: any[] = [], root: Root | undefined;
let listFailure = false, previewFailure = false, auditFailure = false, conflict = false;
let holdList = false, heldList: (() => void) | undefined;
let route = '';
let acceptances = new Map<string, { fingerprint: string; acceptance: ReconciliationAcceptance }>();
const eligible = (issue: ReconciliationIssue) => issue.severity === 'WARNING' && issue.repairability === 'REVIEW_REQUIRED' && (
  issue.issueType === 'CAPACITY_ENTRY_ROLE_MISMATCH' || issue.issueType === 'SEMESTER_UNASSIGNED' && (
    issue.recordType === 'SEMESTER_TIMELINE' && issue.currentState.isCurrentTimeline === false ||
    ['SUPERVISOR_APPLICATION', 'PANEL_RECOMMENDATION'].includes(issue.recordType) && /^(REJECTED_|CANCELLED_)/.test(String(issue.currentState.recordStatus || ''))));
const accepted = (issue: ReconciliationIssue) => eligible(issue) && acceptances.get(issue.issueId)?.fingerprint === issue.fingerprint;
const issuePayload = (issue: ReconciliationIssue) => ({ ...issue, ...(accepted(issue) ? { acceptance: acceptances.get(issue.issueId)!.acceptance } : {}) });
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin); requests.push(url);
  let body: any = {}, status = 200;
  if (url.pathname.endsWith('/reconciliation/')) {
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const open = issues.filter(issue => !accepted(issue));
    const scoped = issues.filter(issue => url.searchParams.get('reviewStatus') === 'ACCEPTED' ? accepted(issue) : !accepted(issue));
    const selected = scoped.filter(issue => (!search || JSON.stringify(issue).toLowerCase().includes(search)) &&
      (!url.searchParams.get('repairability') || issue.repairability === url.searchParams.get('repairability')))
      .sort((a, b) => Number(a.severity !== 'BLOCKING') - Number(b.severity !== 'BLOCKING') || Number(a.repairability !== 'REPAIRABLE') - Number(b.repairability !== 'REPAIRABLE') || a.title.localeCompare(b.title) || a.issueId.localeCompare(b.issueId));
    const page = Number(url.searchParams.get('page') || 1), size = Number(url.searchParams.get('pageSize') || 10);
    body = { summary: { total: open.length, accepted: issues.length - open.length, blocking: 0, warnings: open.length, repairable: open.filter(row => row.repairability === 'REPAIRABLE').length, reviewRequired: open.filter(row => row.repairability !== 'REPAIRABLE').length },
      checkedAt: '2026-10-23T02:30:00Z', count: selected.length, page, pageSize: size, availableProgrammes: ['Master of AI'], results: selected.slice((page - 1) * size, page * size).map(issuePayload) };
    if (holdList) { holdList = false; await new Promise<void>(resolve => { heldList = resolve; }); }
    if (listFailure) { status = 500; body = { error: 'Checks unavailable.' }; }
  } else if (url.pathname.endsWith('/preview/')) {
    const id = decodeURIComponent(url.pathname.split('/').at(-3)!);
    const issue = issues.find(row => row.issueId === id);
    if (!issue || previewFailure) { status = 409; body = { error: 'The issue changed after preview.' }; }
    else body = { issue: issuePayload(issue), canAccept: eligible(issue) && !accepted(issue), allowedResolutions: issue.repairability === 'REPAIRABLE'
      ? issue.issueType === 'SEMESTER_UNASSIGNED' ? [{ action: 'ASSIGN_SEMESTER', label: 'Assign verified academic semester', semesterId: issue.suggestion.semesterId }]
      : issue.issueType === 'MARKS_TASK_INCONSISTENT' ? [{ action: 'RETIRE_MARKS_TASK', label: 'Retire this task' }]
      : [{ action: 'COPY_CAPACITY_PLAN', label: 'Copy verified earlier policy as a draft' }] : [] };
  } else if (url.pathname.endsWith('/audits/')) {
    check(url.searchParams.has('entityType') && url.searchParams.has('entityId'), 'Audit request is not record scoped');
    body = { count: 1, results: [{ id: 1, action: 'COPY_CAPACITY_PLAN', actor: { name: 'Office reviewer' }, reason: 'Verified against the previous semester.', createdAt: '2026-10-23T02:00:00Z' }] };
    if (auditFailure) { status = 500; body = { error: 'History unavailable.' }; }
  } else if (url.pathname.endsWith('/accept/')) {
    check(init?.method === 'POST', 'Acceptance must POST');
    const payload = JSON.parse(String(init?.body)); payloads.push(payload);
    const id = decodeURIComponent(url.pathname.split('/').at(-3)!);
    const issue = issues.find(row => row.issueId === id);
    if (conflict || !issue || payload.expectedFingerprint !== issue.fingerprint || !eligible(issue) || accepted(issue)) {
      status = 409; body = { error: 'The issue changed after preview.' };
    } else {
      const acceptance = { id: acceptances.size + 100, actor: { id: 1, name: 'Office reviewer' }, reason: payload.reason, createdAt: '2026-10-23T03:00:00Z' };
      acceptances.set(id, { fingerprint: issue.fingerprint, acceptance });
      body = { accepted: true, issueId: id, acceptance };
    }
  } else if (url.pathname.endsWith('/apply/')) {
    check(init?.method === 'POST', 'Apply must POST'); payloads.push(JSON.parse(String(init?.body)));
    if (conflict) { status = 409; body = { error: 'The issue changed after preview.' }; }
    else { const id = decodeURIComponent(url.pathname.split('/').at(-3)!); issues = issues.filter(row => row.issueId !== id); body = { resolved: true }; }
  } else throw Error(`Unexpected API ${url.pathname}`);
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
};
const mount = async () => {
  root?.unmount(); requests = []; payloads = []; route = ''; listFailure = previewFailure = auditFailure = conflict = false; issues = initialIssues(); acceptances = new Map();
  root = createRoot(document.getElementById('root')!);
  root.render(<MemoryRouter><OfficeDashboardLayout enabled><WorkflowReconciliationCentre onBack={() => {}} onNavigateToRoute={value => { route = value; }} /></OfficeDashboardLayout></MemoryRouter>);
  await until(() => active('table[aria-label="Reconciliation issues"]').length);
};
const run = async (name: string, operation: () => Promise<void>) => { try { await operation(); results.push({ name }); } catch (error) { results.push({ name, error: String(error) }); } };
const review = async (id: string) => {
  enter('input[type="search"]', id); await until(() => active('table[aria-label="Reconciliation issues"] tbody tr').length === 1);
  await click('Review issue'); await until(() => text().includes('Why this was flagged'));
};
const audit = () => active<HTMLElement>('summary').find(node => node.textContent === 'Review and repair history for this record')!;

await run('Shared list, explanation, search, paging and explicit recheck', async () => {
  await mount();
  check(active('section[aria-label="Reconciliation summary"] article').length === 3, 'Summary must separate totals and next steps');
  check(requests.every(url => !url.pathname.endsWith('/audits/')), 'History eagerly fetched');
  check(text().includes('L001') && !text().includes('Capacity limits differ'), 'List hides identity or comparison');
  const table = active<HTMLTableElement>('table[aria-label="Reconciliation issues"]')[0];
  check(table.textContent?.includes('Capacity roles differ'), 'List retains the long technical title');
  check(!table.textContent?.includes('in the published semester policy versus'), 'List repeats the full explanation');
  await click('Next'); await until(() => text().includes('Page 2 of 2'));
  enter('input[type="search"]', 'L001'); await until(() => active('table[aria-label="Reconciliation issues"] tbody tr').length === 1);
  check(text().includes('Showing 1–1 of 1'), 'Search did not reset paging');
  await click('Clear filters'); await until(() => active('table[aria-label="Reconciliation issues"] tbody tr').length === 10);
  const before = requests.length; await click('Recheck records'); await until(() => requests.length > before && button('Next'));
  check(!button('Apply filters'), 'Introduced an apply-filter button');
});
await run('Check help uses the available width and keeps explanations brief', async () => {
  await mount();
  const help = active<HTMLElement>('.reconciliation-check-help')[0];
  help.querySelector('summary')!.click(); await pause();
  const content = help.querySelector<HTMLElement>('.reconciliation-check-copy')!;
  check(content, 'Missing compact check explanation');
  check(content.textContent!.length < 420, 'Check help is still a long instruction block');
  check(content.textContent?.includes('Approved capacity increases are not issues'), 'Short help still implies approved increases are issues');
  check(content.textContent?.includes('never changes records'), 'Short help loses read-only explanation');
  check(content.getBoundingClientRect().width >= help.clientWidth - 24, 'Help leaves avoidable empty width');
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'Help overflows the viewport');
});
await run('Repeated student issues retain distinct record references and full programme details', async () => {
  await mount();
  const source = issues.find(row => row.issueId === 'SEMESTER.12')!;
  const programme = 'MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)';
  issues.push(...[14, 15].map(id => ({ ...source, issueId: `SEMESTER.${id}`, module: 'PANEL_APPOINTMENTS',
    recordType: 'PANEL_RECOMMENDATION', recordId: String(id), studentId: 'S001', programme, currentState: { academicSemesterId: null, matchingSemesterCount: 0 } })));
  enter('input[type="search"]', 'S001'); await until(() => active('table[aria-label="Reconciliation issues"] tbody tr').length === 2);
  const table = active<HTMLTableElement>('table[aria-label="Reconciliation issues"]')[0];
  check(table.textContent?.includes('Panel Recommendation #14') && table.textContent?.includes('Panel Recommendation #15'), 'Repeated student rows lose their distinct references');
  check(!table.textContent?.includes(programme), 'Long programme repeats in the list');
  await click('Review issue'); await until(() => text().includes('Why this was flagged'));
  check(text().includes(programme), 'Review page lost programme information');
});
await run('Role evidence, meaningful ownership, lazy history and source route', async () => {
  await mount(); await review('L001');
  check(text().includes('Dr Lecturer 1') && text().includes('Version 5'), 'Missing lecturer or version');
  check(text().includes('Has Panel Role') && text().includes('Yes'), 'Missing lecturer role evidence');
  check(text().includes('current Supervisor or Panel roles'), 'Missing role mismatch explanation');
  check(!button('Review and confirm repair'), 'Manual review offers mutation');
  check(!requests.some(url => url.pathname.endsWith('/audits/')), 'Detail eagerly loaded audits');
  audit().click(); await until(() => text().includes('Office reviewer'));
  check(requests.at(-1)!.searchParams.get('entityId') === '1', 'Wrong record audit');
  await click('Review capacity limits'); check(route === '/dashboard/lecturer-capacity?semester=1&lecturer=L001', 'Source loses semester or lecturer');
  await click('Back to Workflow Reconciliation'); await until(() => active('input[type="search"]')[0]);
  check((active<HTMLInputElement>('input[type="search"]')[0]).value === 'L001', 'Back lost filters');
});
await run('Unassigned semester shows matching evidence and a usable source action', async () => {
  await mount(); await review('SEMESTER.12');
  check(text().includes('no single verified semester match'), 'Missing explanation for withheld repair');
  check(text().includes('Semester I 2024/2025') && text().includes('Semesters matching all available evidence'), 'Hidden assignment evidence');
  await click('Open Timeline'); check(route === '/dashboard/timeline', 'Timeline issue has no source destination');
});
await run('Marks registration finding shows evidence and offers its exact record', async () => {
  await mount();
  issues.push({
    ...initialIssues()[0], issueId: 'MARKS-STAGE.52', issueType: 'MARKS_STAGE_REVIEW', module: 'MARKS',
    severity: 'BLOCKING', recordType: 'EVALUATION_TASK', recordId: '52', studentId: 'S052',
    title: 'Registration change needs Marks review', summary: 'Review the preserved assessment evidence.',
    currentState: { lifecycleStatus: 'RETIRED', entryStatus: 'NOT_STARTED', reviewAuditId: 13,
      stageCorrection: { action: 'RETIRE', studentId: 32, semesterId: 1, registrationRevision: 1, impactFingerprint: 'internal-fingerprint' } },
    navigation: { targetModule: 'MARKS', recordType: 'MARKS_TASK', recordId: '52' },
  });
  await review('MARKS-STAGE.52');
  check(text().includes('The registration correction retired this evaluation task.') && text().includes('No marks entered'), 'Retired and unstarted evidence should be readable');
  check(!text().includes('internal-fingerprint') && !text().includes('impactFingerprint'), 'Raw correction metadata should stay out of the evidence');
  check(text().includes('RP Registration') && text().includes('Programme Coordinator'), 'Missing owner or registration path');
  check(text().includes('What to share') && text().includes('the semester and confirmed RP stage') && text().includes('MRK-00052'), 'The referral should identify what Office needs to send');
  check(text().indexOf('Recorded evidence') >= 0 && text().indexOf('Recorded evidence') < text().indexOf('Recommended next step'), 'Evidence should precede the recommended next step');
  check(!button('Review and confirm repair'), 'Review-only finding offered a repair');
  await click('Open RP Registration'); check(route === '/registry/project-stages', 'Registration shortcut should open the existing Registry workspace');
  await click('View Marks record'); check(route === '/marks/records/MRK-00052', 'Marks finding lost its exact task');
});
await run('Overdue retirement preserves the choice to grant extra time and requires confirmation', async () => {
  await mount();
  issues.push({
    ...initialIssues()[0], issueId: 'MARKS.53', issueType: 'MARKS_TASK_INCONSISTENT', module: 'MARKS',
    severity: 'BLOCKING', repairability: 'REPAIRABLE', recordType: 'EVALUATION_TASK', recordId: '53', studentId: 'S053',
    title: 'Evaluation period ended with an unsubmitted draft', summary: 'The evaluation period ended.',
    currentState: { closedWithUnfinishedWork: true, canGrantCompletionWindow: true, entryStatus: 'DRAFT', periodId: 5, semesterId: 1, evaluator: 'Dr Evaluator' },
    suggestion: { action: 'RETIRE_MARKS_TASK' }, navigation: { targetModule: 'MARKS', recordType: 'MARKS_TASK', recordId: '53' },
  });
  await review('MARKS.53');
  check(!active('textarea').length && !button('Review retirement'), 'The retirement form should stay out of the choice panel');
  const grant = button('Grant individual extra time')!.getBoundingClientRect();
  const retire = button('Retire this task')!.getBoundingClientRect();
  check(innerWidth >= 640 ? Math.abs(grant.top - retire.top) < 2 : grant.bottom < retire.top,
    'Choices should align on desktop and stack on narrow screens');
  await click('Grant individual extra time');
  check(route.includes('task=53'), 'Extra time should target this task');
  await click('Retire this task');
  const confirmation = document.querySelector('dialog[open]')?.textContent;
  check(confirmation?.includes('Dr Evaluator') && confirmation.includes('draft') && confirmation.includes('S053'), 'Confirm the impact on the exact task');
  check(button('Retire this task')?.disabled && payloads.length === 0, 'Retirement should require a reason and acknowledgement');
  enter('dialog[open] textarea', 'Evaluation no longer required.');
  await pause();
  check(button('Retire this task')?.disabled, 'A reason alone should not enable retirement');
  active<HTMLInputElement>('dialog[open] input[type="checkbox"]')[0].click();
  await until(() => button('Retire this task') && !button('Retire this task')!.disabled);
  await click('Retire this task');
  await until(() => text().includes('Task retired'));
  check(payloads.length === 1 && payloads[0].resolution.action === 'RETIRE_MARKS_TASK' && payloads[0].reason === 'Evaluation no longer required.', 'Retirement payload is incomplete');
  await click('Return to issues');
  await until(() => text().includes('No matching issues'));
});
await run('Repair reason, acknowledgement, confirmation and single committed outcome', async () => {
  await mount(); await review('MISSING.13');
  check(button('Review and confirm repair')?.disabled, 'Repair did not require reason and acknowledgement');
  enter('textarea', 'Verified the previous published policy.'); active<HTMLInputElement>('input[type="checkbox"]')[0].click();
  await until(() => !button('Review and confirm repair')?.disabled); await click('Review and confirm repair');
  check(payloads.length === 0, 'Saved before confirmation'); await click('Apply audited repair');
  await until(() => text().includes('Repair completed'));
  check(payloads.length === 1 && payloads[0].expectedFingerprint === 'c'.repeat(64) && payloads[0].resolution.action === 'COPY_CAPACITY_PLAN', 'Repair payload or duplicate submission');
  check(!button('Review and confirm repair'), 'Committed repair can be repeated');
  check(!text().includes('could not be loaded'), 'Successful repair tried to reopen a resolved issue');
  await click('Return to issues'); await until(() => text().includes('No matching issues'));
});
await run('Preview, audit and list errors remain local and retryable', async () => {
  await mount(); previewFailure = true; enter('input[type="search"]', 'L001');
  await until(() => active('table[aria-label="Reconciliation issues"] tbody tr').length === 1); await click('Review issue');
  await until(() => text().includes('Unable to validate this issue')); previewFailure = false; await click('Retry');
  await until(() => text().includes('Why this was flagged')); auditFailure = true; audit().click();
  await until(() => text().includes('History unavailable.')); auditFailure = false; await click('Retry');
  await until(() => text().includes('Office reviewer')); await click('Back to Workflow Reconciliation');
  listFailure = true; await click('Recheck records'); await until(() => text().includes('Checks unavailable.'));
  check(!active('section[aria-label="Reconciliation summary"]').length, 'Failed check shows stale totals');
  listFailure = false; await click('Retry'); await until(() => active('table[aria-label="Reconciliation issues"]').length);
});
await run('Stale filtered responses cannot overwrite newer search results', async () => {
  await mount(); holdList = true; enter('input[type="search"]', 'L001'); await until(() => heldList);
  enter('input[type="search"]', 'L002'); await until(() => active('table[aria-label="Reconciliation issues"]').length && text().includes('Dr Lecturer 2'));
  heldList!(); heldList = undefined; await pause(); await pause();
  check(!text().includes('Dr Lecturer 1'), 'Stale search replaced new results');
});
await run('Committed repair remains saved when its list refresh fails', async () => {
  await mount(); await review('MISSING.13'); enter('textarea', 'Verified source policy.'); active<HTMLInputElement>('input[type="checkbox"]')[0].click();
  await until(() => !button('Review and confirm repair')?.disabled); await click('Review and confirm repair');
  listFailure = true; await click('Apply audited repair');
  await until(() => text().includes('Repair completed') && text().includes('could not be loaded'));
  check(payloads.length === 1 && !button('Review and confirm repair'), 'Refresh failure permits duplicate repair');
  await click('Return to issues'); await until(() => text().includes('Checks unavailable.'));
  listFailure = false; await click('Retry'); await until(() => text().includes('No matching issues'));
});
await run('Repair previews and confirmation identify the exact semester and copy source', async () => {
  await mount(); await review('MISSING.13');
  check(text().includes('Semester I 2026/2027') && text().includes('Version 5'), 'Capacity copy does not identify the source policy');
  await click('Back to Workflow Reconciliation');
  const semesterIssue = issues.find(row => row.issueId === 'SEMESTER.12')!;
  semesterIssue.repairability = 'REPAIRABLE'; semesterIssue.suggestion = { semesterId: 1, semesterCode: '2026-2027-S1', semesterLabel: 'Semester I 2026/2027' };
  await review('SEMESTER.12');
  check(text().includes('Assign to semester') && text().includes('Semester I 2026/2027'), 'The proposed semester is hidden');
  enter('textarea', 'Verified the target semester.'); active<HTMLInputElement>('input[type="checkbox"]')[0].click();
  await until(() => !button('Review and confirm repair')?.disabled); await click('Review and confirm repair');
  const dialog = document.querySelector('dialog[open]')!;
  check(dialog.textContent?.includes('Semester I 2026/2027'), 'Confirmation hides the target semester');
  check(dialog.scrollWidth <= dialog.clientWidth + 1, 'Repair details overflow the confirmation');
});
await run('Coordinator issues retain their workflow module identity', async () => {
  await mount();
  issues.push({ ...issues[0], issueId: 'COORD.1', issueType: 'COORDINATOR_PROFILE_MISSING', title: 'Coordinator profile is missing', currentState: { userId: 20, role: 'COORDINATOR' }, recordType: 'USER' });
  enter('input[type="search"]', 'COORD.1'); await until(() => active('table[aria-label="Reconciliation issues"] tbody tr').length === 1);
  const identityCell = active<HTMLTableCellElement>('table[aria-label="Reconciliation issues"] tbody td')[1];
  check(identityCell.textContent?.includes('Workflow Tracking') && !identityCell.textContent?.includes('Lecturer capacity'), 'Coordinator issue is mislabeled as capacity');
});
await run('A shrinking last page stays in loading state until its replacement arrives', async () => {
  await mount(); await click('Next'); await until(() => text().includes('Page 2 of 2'));
  issues = issues.slice(0, 2); await click('Recheck records');
  // The corrected-page request starts after the debounce. No old rows may flash meanwhile.
  await pause(); await pause();
  check(!active('table[aria-label="Reconciliation issues"]').length, 'Out-of-range refresh briefly restores obsolete rows');
  await until(() => text().includes('Showing 1–2 of 2'));
});
await run('Conflicting repair requires review and layouts fit the viewport', async () => {
  await mount(); check(document.documentElement.scrollWidth <= innerWidth + 1, 'List overflows');
  await review('MISSING.13'); conflict = true; enter('textarea', 'Verified policy.'); active<HTMLInputElement>('input[type="checkbox"]')[0].click();
  await until(() => !button('Review and confirm repair')?.disabled); await click('Review and confirm repair'); await click('Apply audited repair');
  await until(() => text().includes('Record needs review')); check(button('Review latest record'), 'Conflict did not require fresh review');
  check(payloads.length === 1, 'Conflict triggered automatic resubmission');
  await click('Review latest record'); await until(() => !button('Review latest record'));
  check((active<HTMLTextAreaElement>('textarea')[0]).value === 'Verified policy.', 'Fresh review discarded the reason');
  check(button('Review and confirm repair')?.disabled, 'Fresh review did not reset acknowledgement');
  await click('Back to Workflow Reconciliation'); await until(() => button('Discard changes')); await click('Discard changes');
  await until(() => active('input[type="search"]').length); await click('Clear filters'); await until(() => active('table[aria-label="Reconciliation issues"] tbody tr').length === 10);
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'List overflows after navigation');
  if (innerWidth < 640) { await review('L001'); check(document.documentElement.scrollWidth <= innerWidth + 1, 'Review comparison overflows'); }
});
await run('Acceptance modal keeps source action prominent and confirms draft disposal', async () => {
  await mount(); await review('SEMESTER.12');
  const trigger = button('Accept as intentional')!;
  const source = button('Open Timeline')!;
  check(trigger && !active('textarea').length, 'Acceptance is not behind a button');
  check(trigger.getBoundingClientRect().top > source.getBoundingClientRect().bottom, 'Exception action competes with source correction');
  if (innerWidth >= 640) check(Math.abs(trigger.parentElement!.getBoundingClientRect().right - trigger.getBoundingClientRect().right) < 2, 'Exception action is not right aligned');
  await click('Accept as intentional');
  const dialog = document.querySelector<HTMLElement>('dialog[open]')!;
  check(dialog && dialog.querySelector('textarea') && dialog.textContent?.includes('Semester I 2024/2025'), 'Modal hides the form or affected record');
  check(dialog.scrollWidth <= dialog.clientWidth + 1, 'Acceptance modal overflows');
  enter('textarea', 'Retained acceptance draft.'); await click('Cancel');
  await until(() => button('Keep editing')); await click('Keep editing');
  check((active<HTMLTextAreaElement>('textarea')[0]).value === 'Retained acceptance draft.', 'Keep editing lost the draft');
  await click('Cancel'); await click('Discard changes');
  await until(() => !document.querySelector('dialog[open]'));
  await click('Accept as intentional');
  check((active<HTMLTextAreaElement>('textarea')[0]).value === '', 'Discard retained the acceptance draft');
  await click('Cancel'); await click('Back to Workflow Reconciliation');
  await until(() => active('input[type="search"]').length);
  check(payloads.length === 0, 'Closing the draft submitted acceptance');
});
await run('Acceptance conflicts require consent to replace the entered review with fresh evidence', async () => {
  await mount(); await review('SEMESTER.12'); await click('Accept as intentional'); enter('textarea', 'Verified historical exception.');
  active<HTMLInputElement>('input[type="checkbox"]')[0].click();
  await until(() => !button('Accept as intentional')?.disabled);
  issues.find(row => row.issueId === 'SEMESTER.12')!.fingerprint = 'd'.repeat(64);
  await click('Accept as intentional'); await until(() => text().includes('Record needs review'));
  check(payloads.length === 1, 'Stale acceptance automatically retried'); await click('Review latest record');
  await until(() => button('Replace and review')); await click('Keep editing');
  check((active<HTMLTextAreaElement>('textarea')[0]).value === 'Verified historical exception.', 'Cancelling reload lost the reason');
  await click('Review latest record'); await click('Replace and review');
  await until(() => !document.querySelector('dialog[open]'));
  await click('Accept as intentional');
  check((active<HTMLTextAreaElement>('textarea')[0]).value === '', 'Replacing evidence retained the stale review reason');
  check(button('Accept as intentional')?.disabled, 'Fresh evidence did not reset acknowledgement');
});
await run('Committed acceptance survives refresh failure without a second submit', async () => {
  await mount(); await review('SEMESTER.12'); await click('Accept as intentional'); enter('textarea', 'Verified exception before refresh failure.');
  active<HTMLInputElement>('input[type="checkbox"]')[0].click();
  await until(() => !button('Accept as intentional')?.disabled);
  listFailure = true; await click('Accept as intentional');
  await until(() => button('Return to issues') && text().includes('could not be loaded'));
  check(payloads.length === 1 && !button('Accept as intentional'), 'Refresh failure permits repeated acceptance');
  await click('Return to issues'); await until(() => text().includes('Checks unavailable.'));
  listFailure = false; await click('Retry'); await until(() => text().includes('No matching issues'));
});
await run('Blocking and repairable issues cannot be accepted and view survives clearing filters', async () => {
  await mount(); await review('MISSING.13'); check(!button('Accept as intentional'), 'Verified repair can be dismissed');
  await click('Back to Workflow Reconciliation');
  issues.find(row => row.issueId === 'SEMESTER.12')!.severity = 'BLOCKING'; await review('SEMESTER.12');
  check(!button('Accept as intentional') && !active('textarea').length, 'Blocking issue offers acceptance');
  await click('Back to Workflow Reconciliation'); await click('Accepted warnings');
  await until(() => text().includes('No matching issues')); await click('Clear filters');
  await until(() => text().includes('No accepted warnings'));
  check(button('Accepted warnings')?.getAttribute('aria-pressed') === 'true', 'Clearing filters changed the view');
});
await run('Accepting a warning is confirmed, audited, read-only and separate from open issues', async () => {
  await mount(); await review('SEMESTER.12');
  check(button('Accept as intentional'), 'Eligible warning has no acceptance action');
  check(!active('textarea').length, 'Acceptance form crowds the recommendation');
  await click('Accept as intentional');
  check(button('Accept as intentional')!.disabled, 'Acceptance needs reason and acknowledgement');
  enter('textarea', 'Historical timeline retained without a verified academic semester.');
  active<HTMLInputElement>('input[type="checkbox"]')[0].click();
  await until(() => !button('Accept as intentional')?.disabled);
  check(payloads.length === 0, 'Accepted before confirmation'); await click('Accept as intentional');
  await until(() => text().includes('Accepted as intentional') && button('Return to issues'));
  check(payloads.length === 1 && !text().includes('Repair completed'), 'Acceptance is confused with a repair');
  check(!button('Accept as intentional'), 'Accepted warning can be submitted again');
  await click('Return to issues'); await until(() => text().includes('No matching issues'));
  await click('Accepted warnings'); await until(() => active('table[aria-label="Reconciliation issues"] tbody tr').length === 1);
  check(text().includes('Accepted'), 'Accepted list has no status'); await click('Review issue');
  await until(() => text().includes('Historical timeline retained without a verified academic semester.'));
  check(text().includes('Office reviewer') && !button('Accept as intentional') && !button('Review and confirm repair'), 'Accepted view is not read-only or loses audit details');
});
await pause();
parent.postMessage({ type: 'reconciliation-results', results }, location.origin);
