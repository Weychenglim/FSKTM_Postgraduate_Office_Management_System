import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { SupervisorWorkloadMonitoring } from '../src/components/SupervisorWorkloadMonitoring';
import { PanelWorkloadMonitoring } from '../src/components/PanelWorkloadMonitoring';
import { OfficeDashboardLayout } from '../src/components/OfficeDashboardLayout';

const results: { name: string; error?: string }[] = [];
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 20));
const until = async (condition: () => unknown) => { for (let i = 0; i < 200; i++) { if (condition()) return; await pause(); } throw Error('Timed out'); };
let root: Root | undefined;
let failing = false;
let release: (() => void) | undefined;
let requests = 0;
const records = Array.from({ length: 13 }, (_, i) => ({
  lecturerId: `L${i}`, lecturerName: `Lecturer ${i}`, id: `L${i}`, name: `Lecturer ${i}`, initials: 'LE', email: 'fixture@example.test', department: 'Computing',
  semesterCode: '2026-2027-S1', capacityPlanVersion: 1,
  currentStudents: 5, workloadLimit: 10, confirmedAppointments: 2, pendingNominations: 3,
  availability: 'Available', capacityState: i < 10 ? 'AVAILABLE' : i === 10 ? 'FULL' : i === 11 ? 'OVER_CAPACITY' : 'NOT_CONFIGURED',
  supervisees: [], workloadItems: [],
}));
window.fetch = async (input, init) => {
  const path = new URL(String(input), location.origin).pathname;
  check(path.endsWith('/workload/') && (!init?.method || init.method === 'GET'), `Unexpected request ${path}`);
  requests++;
  await new Promise<void>(resolve => { release = resolve; });
  return new Response(JSON.stringify(failing ? { error: 'Workload temporarily unavailable.' } : records), { status: failing ? 500 : 200, headers: { 'Content-Type': 'application/json' } });
};
const summary = () => document.querySelector<HTMLElement>('section[aria-label$="workload summary"]');
const metric = (title: string) => summary()?.querySelector(`[aria-label="${title}"] .card-metric`)?.textContent;
const search = (value: string) => {
  const input = document.querySelector<HTMLInputElement>('input[type="search"]')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === text)!;

for (const kind of ['supervisor', 'panel'] as const) {
  try {
    root?.unmount(); sessionStorage.clear(); localStorage.clear(); requests = 0; release = undefined; failing = false;
    root = createRoot(document.getElementById('root')!);
    root.render(<MemoryRouter><OfficeDashboardLayout enabled>{kind === 'panel' ? <PanelWorkloadMonitoring onBack={() => {}} /> : <SupervisorWorkloadMonitoring onBack={() => {}} />}</OfficeDashboardLayout></MemoryRouter>);
    await until(() => release);
    check(!summary(), 'Loading displays false summary totals');
    release!();
    await until(() => summary());
    check(metric('Lecturers') === '13', 'Summary only counted the visible page');
    check(metric('Available') === '10', 'Incorrect available count');
    check(metric('At or over capacity') === '2', 'Incorrect capacity count');
    check(metric('Active appointments') === (kind === 'panel' ? '26' : '65'), 'Incorrect active appointment count');
    const workspace = document.querySelector('[aria-label$="workload workspace"]')!;
    if (kind === 'panel') check(workspace.textContent?.includes('2 active') && workspace.textContent?.includes('3 reserved'), 'Reservations not distinguished in workload rows');
    check(Boolean(summary()!.compareDocumentPosition(workspace) & Node.DOCUMENT_POSITION_FOLLOWING), 'Cards are not above the records');
    const cards = [...summary()!.querySelectorAll<HTMLElement>('article')];
    check(cards.length === 4, 'Expected four shared cards');
    for (const card of cards) check(card.scrollWidth <= card.clientWidth + 1, 'Card content overflow');
    const rects = cards.map(card => card.getBoundingClientRect());
    check(innerWidth < 640 ? rects[1].top > rects[0].top : rects.every(rect => rect.top === rects[0].top), 'Unexpected card layout');
    check(document.documentElement.scrollWidth <= innerWidth + 1, 'Page overflows horizontally');
    search('Lecturer 11');
    await until(() => metric('Lecturers') === '1');
    check(metric('At or over capacity') === '1' && metric('Available') === '0', 'Summary ignores search');
    search('No matching lecturer');
    await until(() => metric('Lecturers') === '0');
    check(document.body.textContent?.includes('No matching lecturers'), 'Empty results missing');
    button('Clear filters').click();
    await until(() => metric('Lecturers') === '13');
    check(requests === 1, 'Filtering unnecessarily refetched workload');
    // Remount with a failed request; old totals must never survive as valid data.
    root.unmount(); failing = true; release = undefined;
    root = createRoot(document.getElementById('root')!);
    root.render(<MemoryRouter><OfficeDashboardLayout enabled>{kind === 'panel' ? <PanelWorkloadMonitoring onBack={() => {}} /> : <SupervisorWorkloadMonitoring onBack={() => {}} />}</OfficeDashboardLayout></MemoryRouter>);
    await until(() => release); release!();
    await until(() => button('Retry'));
    check(!summary(), 'Failure displays false summary totals');
    failing = false; release = undefined; button('Retry').click();
    await until(() => release); release!();
    await until(() => metric('Lecturers') === '13');
    results.push({ name: `${kind}: cards, filtered totals, empty results, loading, retry and responsive layout` });
  } catch (error) { results.push({ name: kind, error: String(error) }); }
}
await pause();
parent.postMessage({ type: 'workload-summary-results', results }, location.origin);
