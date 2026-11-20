import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {MarkEntryRecords} from '../src/components/MarkEntryRecords';
import {ListState} from '../src/components/ListState';

const results: {name: string; error?: string}[] = [];
const wait = () => new Promise(resolve => setTimeout(resolve, 20));
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const until = async (condition: () => unknown) => {
  for (let i = 0; i < 150; i++) { if (condition()) return; await wait(); }
  throw Error('Timed out: ' + document.body.textContent?.slice(-500));
};
const button = () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => /Download Excel|Export Excel|Preparing Excel/.test(b.textContent ?? ''))!;
const records = Array.from({length: 12}, (_, i) => ({
  id: `MRK-${String(i + 1).padStart(5, '0')}`, studentId: `S${i}`, studentName: `Student ${i}`,
  studentInitials: 'ST', researchTitle: 'Research', panelMember: 'Dr Marker', evaluatorRole: 'PANEL',
  semester: 'Semester I', programme: 'MASTER OF DATA SCIENCE (COURSEWORK)',
  status: i < 6 ? 'Submitted' : 'Not Started', totalMark: i < 6 ? 75 : null,
  submittedDate: '-', taskLifecycleStatus: 'ACTIVE', periodId: 1, periodLifecycleStatus: 'PUBLISHED',
  assessment: i < 3 || i === 6 ? 'P1' : i === 11 ? '' : 'P2',
  periodName: i < 3 || i === 6 ? 'First project evaluation' : 'Final project evaluation',
  stageReviewRequired: i === 6,
  ...(i === 6 ? {status: 'Review Required'} : {}),
}));
let root: Root | undefined;
let calls: {recordIds: string[]; scope: string}[] = [];
let release: (() => void) | undefined;
let mode = '';
let downloads = 0;
const clickAnchor = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
  if (this.download) downloads++;
  else clickAnchor.call(this);
};
globalThis.fetch = async (input, init) => {
  if (String(input).endsWith('/marks/export/')) {
    calls.push(JSON.parse(init?.body as string));
    if (mode === 'pending') await new Promise<void>(resolve => { release = resolve; });
    if (mode === 'failure') return new Response(JSON.stringify({error: 'Export unavailable'}), {status: 503});
    return new Response(new Blob(['xlsx']));
  }
  const path = String(input);
  if (path.endsWith('/marks/programme-options/')) return Response.json(['Computing', 'MASTER OF DATA SCIENCE (COURSEWORK)']);
  if (path.includes('/marks/periods/?')) return Response.json([
    { id: 1, name: 'First project evaluation', semester: 'Semester I', assessment: 'P1', lifecycleStatus: 'PUBLISHED', effectiveStatus: 'OPEN' },
    { id: 2, name: 'Second project evaluation', semester: 'Semester I', assessment: 'P2', lifecycleStatus: 'PUBLISHED', effectiveStatus: 'OPEN', closesAt: '2026-11-28T12:00:00Z' },
    { id: 3, name: 'Closed project evaluation', semester: 'Semester I', assessment: 'P2', lifecycleStatus: 'CLOSED', effectiveStatus: 'CLOSED' },
  ]);
  if (path.endsWith('/recipient-preview/')) {
    const periodId = Number(path.match(/periods\/(\d+)\//)?.[1]);
    if (mode === 'statuses' && periodId === 2) return Response.json({ periodId, recipients: [], missingAssignments: [] });
    if (periodId === 3) throw Error('Closed periods must use saved records');
    return Response.json({ periodId, recipients: periodId === 2 ? [{
      matricNo: 'NEW', studentName: 'New Student', programme: 'Computing', evaluatorId: 42,
      evaluatorName: 'Dr Pending', evaluatorRole: 'SUPERVISOR', taskStatus: 'NEW',
    }, {
      matricNo: 'NEW-P2', studentName: 'RP2 Student', programme: 'Computing', evaluatorId: 11,
      evaluatorName: 'Dr Marker', evaluatorRole: 'PANEL', taskStatus: 'NEW',
    }] : [], missingAssignments: periodId === 2 ? [{
      matricNo: 'NO-PANEL', studentName: 'No Panel Student', programme: 'Computing', reason: 'MISSING_PANEL_APPOINTMENT',
    }] : [], missingAppointments: { supervisor: 0, panel: periodId === 2 ? 1 : 0 } });
  }
  const matchingRecords = (mode === 'classified' ? records.filter(record => record.assessment) : records).map(record => ({ ...record, evaluatorId: 11 }));
  if (mode === 'twenty') return Response.json(Array.from({ length: 20 }, (_, index) => ({
    ...matchingRecords[0], periodId: 3, id: `MRK-${index}`, studentId: `TEST-${index}`,
    studentName: `Student ${String(index).padStart(2, '0')}`, stageReviewRequired: index === 19,
    status: index === 19 ? 'Review Required' : index < 16 ? 'Submitted' : 'Not Started',
  })));
  if (mode === 'statuses') {
    const statuses = [
      ['Dr Complete', 'Submitted', false, 1], ['Dr On Time', 'Not Started', false, 1],
      ['Dr Review', 'Submitted', true, 1], ['Dr Closed', 'Not Started', false, 3],
    ] as const;
    return Response.json(statuses.map(([panelMember, status, stageReviewRequired, periodId], index) => ({
      ...matchingRecords[index], panelMember, status, stageReviewRequired, periodId, evaluatorId: 20 + index,
    })));
  }
  return new Response(JSON.stringify(mode === 'empty' ? [] : matchingRecords), {headers: {'Content-Type': 'application/json'}});
};
async function mount(nextMode = '', route = '/marks/records', listState?: Map<string, unknown>) {
  root?.unmount(); calls = []; downloads = 0; mode = nextMode;
  root = createRoot(document.getElementById('root')!);
  root.render(<ListState.Provider value={listState ?? null}><MemoryRouter initialEntries={[route]}><MarkEntryRecords onBack={() => {}} onViewRecordDetail={() => {}} /></MemoryRouter></ListState.Provider>);
  if (nextMode === 'twenty') { await until(() => document.querySelector('tbody tr')); return; }
  if (new URL(route, location.origin).searchParams.get('view') === 'lecturers') {
    await until(() => document.querySelector('table[aria-label="Marking progress by lecturer"]'));
    return;
  }
  const expected = mode === 'empty' ? 'No mark records yet' : mode === 'classified' ? '11 records found' : mode === 'statuses' ? '4 records found' : route.includes('Submitted') ? '6 records found' : '12 records found';
  await until(() => button() && document.body.textContent?.includes(expected));
}
async function scenario(name: string, run: () => Promise<void>) {
  try { await run(); results.push({name}); } catch (e) { results.push({name, error: String(e)}); }
}
await scenario('downloads every filtered page, not the five visible rows', async () => {
  await mount();
  const table = document.querySelector('[data-mark-record-table]')!;
  check([...table.querySelectorAll('th')].map(cell => cell.textContent).join('|') === 'Student|Assessment|Evaluator|Deadline|Mark & status|Action', 'Unexpected Marks Records columns');
  check(button().textContent?.trim() === 'Export Excel', 'Export label differs from appointment export');
  check(button().classList.contains('bg-brand-navy') && button().classList.contains('text-[10px]'), 'Expected compact primary export button');
  check(button().querySelector(':scope > svg') && !button().querySelector('span svg'), 'Icon must sit beside the label');
  button().click(); await until(() => downloads === 1);
  check(calls[0].recordIds.length === 12, 'Export truncated to page');
});
await scenario('status filter and metadata match the selected records', async () => {
  await mount('', '/marks/records?status=Submitted');
  await until(() => document.body.textContent?.includes('6 records found'));
  button().click(); await until(() => downloads === 1);
  check(calls[0].recordIds.length === 6 && calls[0].scope.includes('Status: Submitted'), 'Wrong filtered export');
});
await scenario('empty selection disables export', async () => {
  await mount('empty'); check(button().disabled, 'Empty export enabled'); check(calls.length === 0, 'Empty request sent');
});
await scenario('hides Unclassified when every record has an assessment', async () => {
  const key = 'MarkEntryRecords:assessmentFilter';
  const listState = new Map([[key, 'unclassified']]);
  await mount('classified', '/marks/records', listState);
  const assessment = document.querySelector<HTMLSelectElement>('select[aria-label="Assessment"]')!;
  check([...assessment.options].map(option => option.value).join() === ',P1,P2', 'Unclassified appeared without legacy records');
  check(assessment.value === '', 'Unavailable assessment is still selected');
  await until(() => listState.get(key) === '');
});
await scenario('assessment scopes status counts, visible rows and export', async () => {
  await mount();
  const assessment = document.querySelector<HTMLSelectElement>('select[aria-label="Assessment"]');
  check(assessment, 'Assessment filter is missing');
  assessment!.value = 'P1';
  assessment!.dispatchEvent(new Event('change', {bubbles: true}));
  await until(() => document.body.textContent?.includes('4 records found'));
  const statuses = document.querySelector<HTMLSelectElement>('select[aria-label="Record status"]')!;
  check([...statuses.options].some(option => option.textContent === 'Submitted (3)'), 'Submitted count ignores assessment');
  check([...statuses.options].some(option => option.textContent === 'Review Required (1)'), 'Review count missing');
  check(document.querySelector('tbody')?.textContent?.includes('First project evaluation'), 'Period name missing');
  button().click(); await until(() => downloads === 1);
  check(calls[0].recordIds.join() === 'MRK-00001,MRK-00002,MRK-00003,MRK-00007', 'Wrong assessment records exported');
  check(calls[0].scope.includes('Assessment: RP1'), 'Assessment missing from export scope');
  assessment!.value = 'unclassified';
  assessment!.dispatchEvent(new Event('change', {bubbles: true}));
  await until(() => document.body.textContent?.includes('1 record found'));
  check(document.querySelector('tbody')?.textContent?.includes('Unclassified'), 'Legacy record label missing');
  const clear = [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'Clear filters');
  check(clear, 'Clear filters is missing');
  clear!.click();
  await until(() => document.body.textContent?.includes('12 records found'));
  check(assessment!.value === '', 'Clear filters retained the assessment');
});
await scenario('pending download blocks duplicate requests', async () => {
  await mount('pending'); button().click(); button().click(); await until(() => calls.length === 1);
  check(button().disabled, 'Pending export enabled'); release!(); await until(() => downloads === 1);
  check(calls.length === 1, 'Duplicate download');
});
await scenario('download failure is visible and retry succeeds', async () => {
  await mount('failure'); button().click(); await until(() => document.querySelector('[role="alert"]'));
  check(!button().disabled && downloads === 0, 'Failure left button disabled or downloaded');
  mode = ''; button().click(); await until(() => downloads === 1);
  check(!document.querySelector('[role="alert"]'), 'Old error not cleared');
});
await scenario('period link populates filters and allows selecting a period without records', async () => {
  await mount('', '/marks/records?semester=Semester+I&period=1');
  const semester = document.querySelector<HTMLSelectElement>('select[aria-label="Semester"]');
  const period = document.querySelector<HTMLSelectElement>('select[aria-label="Evaluation period"]');
  check(semester?.value === 'Semester I' && period?.value === '1', 'Linked period and semester must appear in the filters');
  await until(() => [...period!.options].some(option => option.value === '2'));
  period!.value = '2'; period!.dispatchEvent(new Event('change', {bubbles: true}));
  await until(() => document.body.textContent?.includes('No mark records yet'));
  check(period!.value === '2' && button().disabled, 'Empty period did not stay selected');
});
await scenario('all periods shows missing tasks even for lecturers with no records', async () => {
  await mount();
  const view = [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'By lecturer');
  check(view, 'By lecturer view is missing');
  view!.click();
  await until(() => document.body.textContent?.includes('Dr Pending'));
  const row = [...document.querySelectorAll('tr')].find(item => item.textContent?.includes('Dr Pending'));
  check(row?.textContent?.includes('1 task missing'), 'Missing task absent from the lecturer summary');
  const viewTasks = row?.querySelector<HTMLAnchorElement>('a');
  check(viewTasks?.textContent?.trim() === 'View tasks', 'Lecturer rows need a dedicated View tasks link');
  check(document.querySelector<HTMLSelectElement>('select[aria-label="Evaluation period"]')?.value === '', 'Unscoped lecturer list should default to All periods');
  viewTasks!.click();
  await until(() => document.body.textContent?.includes('New Student'));
  check(document.querySelector('h1')?.textContent === 'Dr Pending' && !document.querySelector('table[aria-label="Marking progress by lecturer"]'), 'Lecturer detail should replace the list');
  check(document.querySelector('button[aria-label="Mark entry period"]')?.textContent?.includes('Second project evaluation'), 'Period missing from drilldown');
  check([...document.querySelectorAll('th[scope="col"]')].map(cell => cell.textContent).join('|') === 'Student|Role|Deadline|Status|Action', 'Task details need a standard table');
  check(!document.body.textContent?.includes('Some periods could not be checked'), 'Closed period was checked as current');
  [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'Back to lecturers')!.click();
  await until(() => document.querySelector('table[aria-label="Marking progress by lecturer"]'));
  const marker = [...document.querySelectorAll('tr')].find(item => item.textContent?.includes('Dr Marker'))!;
  check(!marker.textContent?.includes('submitted'), 'All-periods row combines submission progress');
  check(document.body.textContent?.includes('Missing appointments or research profiles'), 'Missing appointments are hidden');
  marker.querySelector('a')!.click();
  await until(() => document.querySelector('button[aria-label="Mark entry period"]')?.textContent?.includes('First project evaluation'));
  check(document.querySelectorAll('table').length === 1 && !document.body.textContent?.includes('RP2 Student'), 'Only one period table should be visible');
  check(document.querySelector('button[aria-label="Mark entry period"]')?.textContent?.trim() === 'First project evaluation', 'Keep the assessment separate from the period name');
  document.querySelector<HTMLButtonElement>('button[aria-label="Mark entry period"]')!.click();
  const secondPeriod = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent?.includes('Second project evaluation'));
  await until(secondPeriod);
  check(secondPeriod()!.textContent?.includes('Deadline 28 Nov 2026'), 'Period options should show the deadline for identification');
  secondPeriod()!.click();
  await until(() => document.body.textContent?.includes('RP2 Student'));
  check(document.querySelector('header')?.textContent?.includes('AssessmentRP2'), 'Assessment did not update when switching periods');
  check(document.body.textContent?.includes('RP2 Student') && document.body.textContent?.includes('0 of 1 submitted'), 'RP2 progress missing from the same lecturer');
});
await scenario('lecturer detail keeps the linked period and restores lecturer search', async () => {
  await mount('', '/marks/records?semester=Semester+I&period=1&view=lecturers');
  await until(() => document.querySelector('select[aria-label="Evaluation period"]')?.textContent?.includes('Second project evaluation'));
  const evaluationPeriod = () => document.querySelector<HTMLSelectElement>('select[aria-label="Evaluation period"]');
  check(evaluationPeriod()?.value === '1', 'Linked lecturer view did not select its evaluation period');
  await until(() => document.querySelector('[aria-label="View tasks for Dr Marker"]'));
  const search = document.querySelector<HTMLInputElement>('#records-search')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Marker');
  search.dispatchEvent(new Event('input', {bubbles: true}));
  document.querySelector<HTMLAnchorElement>('[aria-label="View tasks for Dr Marker"]')!.click();
  await until(() => document.querySelector('h1')?.textContent === 'Dr Marker');
  check(document.querySelector('button[aria-label="Mark entry period"]')?.textContent?.trim() === 'First project evaluation' && !document.body.textContent?.includes('Second project evaluation'), 'Period scope was lost');
  [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'Back to lecturers')!.click();
  await until(() => document.querySelector<HTMLInputElement>('#records-search')?.value === 'Marker');
  await until(() => evaluationPeriod()?.value === '1' && [...evaluationPeriod()!.options].some(option => option.value === '2'));
  const selectPeriod = (id: string) => {
    evaluationPeriod()!.value = id;
    evaluationPeriod()!.dispatchEvent(new Event('change', {bubbles: true}));
  };
  selectPeriod('2');
  const lecturerLink = () => document.querySelector<HTMLAnchorElement>('[aria-label="View tasks for Dr Marker"]');
  await until(() => evaluationPeriod()?.value === '2' && lecturerLink() && new URL(lecturerLink()!.href).searchParams.get('period') === '2');
  selectPeriod('');
  await until(() => evaluationPeriod()?.value === '' && lecturerLink() && !new URL(lecturerLink()!.href).searchParams.has('period'));
  check(document.querySelector<HTMLInputElement>('#records-search')?.value === 'Marker', 'Clearing period scope cleared lecturer search');
  check(document.querySelector<HTMLSelectElement>('select[aria-label="Semester"]')?.value === 'Semester I', 'Clearing period scope cleared the semester');
});
await scenario('lecturer status distinguishes completion, open work and exceptions', async () => {
  await mount('statuses');
  [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'By lecturer')!.click();
  const table = () => document.querySelector('table[aria-label="Marking progress by lecturer"]');
  await until(() => table() && !document.body.textContent?.includes('Checking for missing tasks'));
  const headings = [...table()!.querySelectorAll('th[scope="col"]')];
  check(headings.at(-2)?.textContent === 'Task status', 'Task status heading is missing');
  check(headings.at(-1)?.classList.contains('text-left'), 'Action header should be left-aligned');
  for (const [lecturer, label] of [['Dr Complete', 'All submitted'], ['Dr On Time', 'In progress'], ['Dr Review', '1 needs stage review'], ['Dr Closed', '1 unsubmitted at closure']]) {
    const row = [...table()!.querySelectorAll('tbody tr')].find(row => row.querySelector('th')?.textContent === lecturer)!;
    check(row.querySelector('td:nth-last-child(2)')?.textContent === label, `Wrong task status for ${lecturer}`);
    check(row.lastElementChild?.classList.contains('text-left'), `Action should be left-aligned for ${lecturer}`);
  }
});
await scenario('programme scopes lecturer counts and detail while follow-up filters lecturer rows', async () => {
  await mount();
  [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'By lecturer')!.click();
  const programme = document.querySelector<HTMLSelectElement>('select[aria-label="Programme"]')!;
  check(programme, 'Programme filter is missing');
  await until(() => [...document.querySelector<HTMLSelectElement>('select[aria-label="Programme"]')!.options].some(option => option.value === 'Computing'));
  document.querySelector<HTMLButtonElement>('button[aria-label="Programme"]')!.click();
  const computing = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent?.trim() === 'Computing');
  await until(computing);
  computing()!.click();
  const marker = () => document.querySelector<HTMLAnchorElement>('[aria-label="View tasks for Dr Marker"]');
  await until(() => marker()?.closest('tr')?.querySelector('td:nth-child(3)')?.textContent === '1');
  marker()!.click();
  await until(() => document.body.textContent?.includes('RP2 Student'));
  check(!document.body.textContent?.includes('First project evaluation'), 'Detail included a different programme');
  await mount('statuses');
  [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'By lecturer')!.click();
  await until(() => document.querySelector('[aria-label="View tasks for Dr Complete"]'));
  const filterCard = document.querySelector('[data-workspace-filter-card]')!;
  const followUpLabel = [...filterCard.querySelectorAll('label')].find(label => label.textContent?.trim() === 'Needs follow-up');
  const reset = [...filterCard.querySelectorAll('button')].find(control => control.textContent?.trim() === 'Clear filters');
  check(followUpLabel && reset?.parentElement?.contains(followUpLabel), 'Follow-up should sit in the filter footer');
  followUpLabel!.querySelector('input')!.click();
  await until(() => !document.querySelector('[aria-label="View tasks for Dr Complete"]'));
  check(document.querySelector('[aria-label="View tasks for Dr Review"]'), 'Follow-up filter hid the stage review');
  [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'Clear filters')!.click();
  await until(() => document.querySelector('[aria-label="View tasks for Dr Complete"]'));
});
await scenario('twenty task rows paginate with review work first', async () => {
  await mount('twenty', '/marks/records?view=lecturers&lecturer=11&period=3');
  check(document.querySelectorAll('tbody tr').length === 10, 'Expected ten student tasks on the first page');
  check(document.querySelector('tbody tr')?.textContent?.includes('Student 19'), 'Review hold should appear first');
  check(document.body.textContent?.includes('16 of 19 submitted') && document.body.textContent?.includes('1 task on hold for stage review'), 'Progress should explain the excluded task');
  const period = document.querySelector<HTMLButtonElement>('button[aria-label="Mark entry period"]');
  check(period?.textContent?.trim() === 'Closed project evaluation', 'Keep the period selector when there is only one choice');
  period!.click();
  await until(() => document.querySelector('[role="option"]'));
  check(document.querySelectorAll('[role="option"]').length === 1, 'Expected one available period');
  document.querySelector<HTMLElement>('[role="option"]')!.click();
  check(document.querySelector('header')?.textContent?.includes('Marking period closed'), 'Closed badge should explain which window ended');
  [...document.querySelectorAll('button')].find(control => control.textContent?.trim() === 'Next')!.click();
  await until(() => document.body.textContent?.includes('11–20 of 20 tasks'));
  check(document.querySelectorAll('tbody tr').length === 10 && !document.querySelector('tbody')?.textContent?.includes('Student 19'), 'Expected the remaining ten tasks');
});
parent.postMessage({type: 'marks-export-results', results}, location.origin);
