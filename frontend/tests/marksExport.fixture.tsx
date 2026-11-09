import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {MarkEntryRecords} from '../src/components/MarkEntryRecords';

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
}));
let root: Root | undefined;
let calls: {recordIds: string[]; scope: string}[] = [];
let release: (() => void) | undefined;
let mode = '';
let downloads = 0;
HTMLAnchorElement.prototype.click = function () { downloads++; };
globalThis.fetch = async (input, init) => {
  if (String(input).endsWith('/marks/export/')) {
    calls.push(JSON.parse(init?.body as string));
    if (mode === 'pending') await new Promise<void>(resolve => { release = resolve; });
    if (mode === 'failure') return new Response(JSON.stringify({error: 'Export unavailable'}), {status: 503});
    return new Response(new Blob(['xlsx']));
  }
  return new Response(JSON.stringify(mode === 'empty' ? [] : records), {headers: {'Content-Type': 'application/json'}});
};
async function mount(nextMode = '', route = '/marks/records') {
  root?.unmount(); calls = []; downloads = 0; mode = nextMode;
  root = createRoot(document.getElementById('root')!);
  root.render(<MemoryRouter initialEntries={[route]}><MarkEntryRecords onBack={() => {}} onViewRecordDetail={() => {}} /></MemoryRouter>);
  await until(() => button() && document.body.textContent?.includes(mode === 'empty' ? 'No mark records yet' : route.includes('Submitted') ? '6 records found' : '12 records found'));
}
async function scenario(name: string, run: () => Promise<void>) {
  try { await run(); results.push({name}); } catch (e) { results.push({name, error: String(e)}); }
}
await scenario('downloads every filtered page, not the five visible rows', async () => {
  await mount();
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
parent.postMessage({type: 'marks-export-results', results}, location.origin);
