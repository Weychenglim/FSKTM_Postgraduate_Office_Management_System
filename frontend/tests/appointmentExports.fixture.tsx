import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {SupervisorAppointmentManagement} from '../src/components/SupervisorAppointmentManagement';
import {SupervisorWorkloadMonitoring} from '../src/components/SupervisorWorkloadMonitoring';
import {PanelWorkloadMonitoring} from '../src/components/PanelWorkloadMonitoring';
import {DecisionFeedbackProvider} from '../src/components/DecisionFeedback';
import type {SupervisorRecord} from '../src/types';

// The real hook runs against an isolated generation boundary supplied by the runner.
type ExportFixture = {calls: {name: string; rows: unknown[]; columns: string[]}[]; fail: boolean; hold: boolean; release?: () => void};
const state: ExportFixture = {calls: [], fail: false, hold: false};
(window as unknown as {exportFixture: ExportFixture}).exportFixture = state;
const results: {name: string; error?: string}[] = [];
const check = (value: unknown, message: string) => {if (!value) throw Error(message);};
const pause = () => new Promise(resolve => setTimeout(resolve, 15));
const until = async (condition: () => unknown) => {for (let i = 0; i < 150; i++) {if (condition()) return; await pause();} throw Error('Timed out: ' + document.body.textContent?.slice(-700));};
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label);
const notification = () => document.querySelector('[aria-label="Dismiss notification"]')?.parentElement;
async function click(label: string) {const node = button(label); check(node, 'Missing ' + label); node!.click(); await pause();}
async function search(value: string) {
  const node = document.querySelector<HTMLInputElement>('input[type="search"]')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value);
  node.dispatchEvent(new Event('input', {bubbles: true})); await pause();
}
let root: Root | undefined;
const record = {id: 'S1', studentId: 'S1', studentName: 'Fixture Student', programme: 'Computing', supervisor: 'Dr Primary', status: 'Approved', updatedDate: '2026-10-01', semester: 'S1', researchTopic: 'Synthetic topic'} as unknown as SupervisorRecord;
const workloads = Array.from({length: 13}, (_, index) => ({id: 'L' + index, name: 'Dr Lecturer ' + index, lecturerId: 'L' + index, lecturerName: 'Dr Lecturer ' + index, initials: 'DL', department: 'Computing', email: 'fixture@example.test', currentStudents: 1, workloadLimit: 4, confirmedAppointments: 1, pendingNominations: 0, availability: 'Available', capacityState: 'AVAILABLE', supervisees: [], workloadItems: []}));
window.fetch = async input => {const path = String(input); if (path.includes('/workload/')) return Response.json(workloads); throw Error('Unexpected HTTP ' + path);};
type Kind = 'records' | 'supervisor' | 'panel';
async function mount(kind: Kind, shared = true) {
  root?.unmount(); document.getElementById('root')!.innerHTML = ''; sessionStorage.clear(); localStorage.clear(); state.calls = []; state.fail = false; state.hold = false; state.release = undefined;
  const page = kind === 'records' ? <SupervisorAppointmentManagement administrationMode providedRecord={record}/> : kind === 'panel' ? <PanelWorkloadMonitoring onBack={() => {}}/> : <SupervisorWorkloadMonitoring onBack={() => {}}/>;
  root = createRoot(document.getElementById('root')!);
  root.render(<React.StrictMode><MemoryRouter>{shared ? <DecisionFeedbackProvider scopeKey="export-tests">{page}</DecisionFeedbackProvider> : page}</MemoryRouter></React.StrictMode>);
  await until(() => button('Export Excel') && !button('Export Excel')!.disabled);
}
async function scenario(name: string, run: () => Promise<void>) {try {await run(); results.push({name});} catch (error) {results.push({name, error: String(error)});}}
await scenario('Supervisor record Apply and reset filters remain quiet', async () => {
  await mount('records'); await search('No matching student'); await click('Apply filters'); check(document.body.textContent?.includes('No matching records'), 'Apply did not change records'); check(!notification(), 'Filter apply announced success'); await click('Clear filters'); check(document.body.textContent?.includes('Fixture Student') && !notification(), 'Filter reset was noisy or did not restore records');
});
for (const kind of ['records', 'supervisor', 'panel'] as const) {
  await scenario(kind + ' export is honestly prepared once and repeated text is delivered', async () => {
    await mount(kind); await click('Export Excel'); await until(() => notification());
    check(notification()?.textContent?.includes('prepared') && !notification()?.textContent?.includes('Downloaded'), 'Export claimed file was saved');
    check(state.calls.length === 1 && state.calls[0].rows.length === (kind === 'records' ? 1 : 13), 'Wrong export scope or duplicate generation'); check(state.calls[0].columns.includes(kind === 'records' ? 'Student ID' : 'Staff ID'), 'Export columns changed');
    document.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!.click(); await until(() => !notification()); await click('Export Excel'); await until(() => notification()); check(state.calls.length === 2, 'Independent repeat suppressed'); check(document.querySelectorAll('[aria-label="Dismiss notification"]').length === 1, 'Duplicate feedback hosts');
  });
  await scenario(kind + ' no results does not generate a file', async () => {
    await mount(kind, false); await search('No matching fixture'); if (kind === 'records') await click('Apply filters'); await click('Export Excel'); await until(() => notification()); check(state.calls.length === 0, 'Empty export generated a file'); check(notification()?.textContent?.toLowerCase().includes('no ') && !notification()?.querySelector('[role="alert"]'), 'No-results outcome missing or marked as error');
  });
  await scenario(kind + ' pending and failed export has one persistent contextual error', async () => {
    await mount(kind); state.hold = true; state.fail = true; await click('Export Excel'); await until(() => state.release); await click('Export Excel'); check(state.calls.length === 1, 'Pending export duplicated generation'); state.release!(); await until(() => document.querySelector('[role="alert"]'));
    check(document.querySelector('[role="alert"]')?.textContent?.includes('Fixture generation failed'), 'Failure lost useful error: '+document.querySelector('[role=alert]')?.textContent); check(!notification(), 'Failure had a duplicate or neutral toast');
    state.hold = false; state.fail = false; await click('Export Excel'); await until(() => notification()); check(!document.querySelector('[role="alert"]'), 'Retry left stale failure'); check(state.calls.length === 2, 'Retry did not generate exactly once');
  });
}
root?.unmount(); document.getElementById('test-results')!.textContent = JSON.stringify(results);


parent.postMessage({type:'appointment-fixture-results',results},location.origin);
