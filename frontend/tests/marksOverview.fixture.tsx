import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router';
import { MarksOverview } from '../src/components/MarksOverview';
import { MarkSubmissionMonitoring } from '../src/components/MarkSubmissionMonitoring';
import { MarkEntryRecords } from '../src/components/MarkEntryRecords';
import { ListState } from '../src/components/ListState';
import type { EvaluationPeriodOption, MarkRecord } from '../src/types';
import { semesterPeriods, semesterMarkTotals } from '../src/utils/marksOverview';

const results: {name: string; error?: string}[] = [];
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const wait = () => new Promise(resolve => setTimeout(resolve, 20));
const until = async (fn: () => unknown) => { for (let i=0;i<100;i++) { if(fn()) return; await wait(); } throw Error('Timed out'); };
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === name);
const period = (id: number, role: 'PANEL'|'SUPERVISOR' = 'SUPERVISOR', status = 'OPEN', semester = 'Semester I') => ({
  id, name: `${role === 'PANEL' ? 'Panel' : 'Supervisor'} assessment ${id}`, semester, semesterId: 1,
  rubricId: id, rubricName: `Rubric ${id}`, evaluatorRoles: [role], lifecycleStatus: status === 'DRAFT' ? 'DRAFT' : status === 'ARCHIVED' ? 'ARCHIVED' : status === 'CLOSED' ? 'CLOSED' : 'PUBLISHED',
  effectiveStatus: status, opensAt: '2026-11-01T09:00:00+08:00', closesAt: '2026-11-20T17:00:00+08:00',
  taskTotals: {total: 10, submitted: 4, overdue: 2, incomplete: 6, supervisor: role === 'SUPERVISOR' ? 10 : 0, panel: role === 'PANEL' ? 10 : 0, backup: 0},
}) as EvaluationPeriodOption;
let periods = [period(1), period(2, 'PANEL')];
const record = (id: number, periodId: number) => ({ id: `MRK-${id}`, periodId, periodName: `Assessment ${periodId}`, periodLifecycleStatus: 'PUBLISHED', studentId: `S${id}`, studentName: `Student ${id}`, studentInitials: 'S', researchTitle: 'Research', panelMember: 'Lecturer', evaluatorRole: 'SUPERVISOR', semester: 'Semester I', programme: 'Computing', status: 'Not Started', totalMark: null, submittedDate: '-', taskLifecycleStatus: 'ACTIVE' }) as MarkRecord;
window.fetch = async url => {
  const path = new URL(String(url), location.origin).pathname;
  const data = path.endsWith('/semesters/') ? [{id:1,label:'Semester I',startsOn:'2026-10-30',endsOn:'2027-06-01'}] : path.endsWith('/periods/') ? periods : path.endsWith('/rubrics/') ? [] : path.endsWith('/marks/') ? [record(1,1), record(2,2)] : {};
  return new Response(JSON.stringify(data), {status: 200, headers: {'Content-Type':'application/json'}});
};
let root: Root | null = null;
let router: ReturnType<typeof createMemoryRouter>;
function Overview() {
  const navigate = useNavigate();
  return <MarksOverview onViewRecords={(status = 'All Records', periodId, semester) => {
    const query = new URLSearchParams({status});
    if(periodId) query.set('period', String(periodId));
    if(semester) query.set('semester', semester);
    navigate(`/records?${query}`);
  }}/>;
}
const mount = async (element = <Overview/>, path='/') => {
  root?.unmount(); root = createRoot(document.getElementById('root')!);
  router = createMemoryRouter([{path:'/', element}, {path:'/records', element:<MarkEntryRecords onBack={() => void router.navigate(-1)} onViewRecordDetail={() => void router.navigate('/detail')}/>}, {path:'/detail',element:<button onClick={() => void router.navigate(-1)}>Back to records</button>}], {initialEntries:[path]});
  root.render(<ListState.Provider value={new Map()}><RouterProvider router={router}/></ListState.Provider>); await wait();
};
const scenario = async (name: string, fn: () => Promise<void>) => { try { await fn(); results.push({name}); } catch(error) { results.push({name,error:String(error)}); } };

await scenario('semester totals include simultaneous roles and exclude draft archived and other semesters', async () => {
  const scope = semesterPeriods([period(1), period(2,'PANEL'), period(3,'PANEL','DRAFT'), period(4,'PANEL','ARCHIVED'), period(5,'PANEL','OPEN','Semester II')], 'Semester I');
  check(JSON.stringify(semesterMarkTotals(scope)) === JSON.stringify({total:20,submitted:8,overdue:4}), 'Mixed summary scope');
  periods = [period(1), period(2,'PANEL')]; await mount();
  await until(() => document.querySelectorAll('#monitoring-card tbody tr').length === 2);
  check(document.querySelector('[aria-label="Evaluation tasks: 20"]'), 'Missing semester total');
  check(!document.body.innerText.includes('Summary for one period') && !document.body.innerText.includes('Recent mark records'), 'Repeated content remains');
});
await scenario('period monitoring paginates and closed periods are accessible', async () => {
  periods = [...Array.from({length:25}, (_,i) => period(i+1,i%2?'PANEL':'SUPERVISOR')), period(30,'PANEL','CLOSED')];
  await mount(<MarkSubmissionMonitoring periods={periods}/>);
  check(document.querySelectorAll('tbody tr').length === 10, 'Unbounded rows');
  button('Next')!.click(); await wait(); check(document.body.innerText.includes('Page 2 of 3'), 'Pagination failed');
  const select = document.querySelector('select')!;
  select.value='CLOSED'; select.dispatchEvent(new Event('change',{bubbles:true})); await wait();
  check(document.querySelectorAll('tbody tr').length === 1 && document.body.innerText.includes('assessment 30'), 'Closed filter failed');
});
await scenario('period link filters records and survives detail return', async () => {
  periods=[period(1),period(2,'PANEL')]; await mount();
  await until(() => document.querySelector('[aria-label="View records for Panel assessment 2"]'));
  (document.querySelector('[aria-label="View records for Panel assessment 2"]') as HTMLButtonElement).click();
  await until(() => document.querySelector('#mark-entry-records-dashboard tbody tr'));
  check(router.state.location.search.includes('period=2'), 'Period not routed');
  check(document.body.innerText.includes('Student 2') && !document.body.innerText.includes('Student 1'), 'Cross-period records leaked');
  const detail = [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === 'View record' || node.getAttribute('aria-label')?.includes('View mark record'));
  if (detail) detail.click(); else await router.navigate('/detail');
  await wait(); button('Back to records')!.click();
  await until(() => document.querySelector('#mark-entry-records-dashboard tbody tr'));
  check(router.state.location.search.includes('period=2') && !document.body.innerText.includes('Student 1'), 'Return lost scope');
});
await scenario('overdue metric routes status and semester and clear removes scope', async () => {
  await mount(); await until(() => document.querySelector('[aria-label="Overdue: 4"]'));
  (document.querySelector('[aria-label="Overdue: 4"]') as HTMLButtonElement).click();
  await until(() => document.querySelector('#mark-entry-records-dashboard'));
  check(new URLSearchParams(router.state.location.search).get('status') === 'Overdue', 'Overdue status lost');
  check(new URLSearchParams(router.state.location.search).get('semester') === 'Semester I', 'Semester lost');
  button('Clear filters')!.click(); await wait();
  const cleared = new URLSearchParams(router.state.location.search);
  check(!cleared.has('period') && !cleared.has('semester') && cleared.get('status') === 'All Records', 'Scope not cleared');
});
window.parent.postMessage({type:'overview-fixture-results',results},location.origin);
