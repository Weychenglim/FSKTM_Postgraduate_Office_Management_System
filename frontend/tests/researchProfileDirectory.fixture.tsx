import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {LecturerResearchWorkspace} from '../src/components/LecturerResearchWorkspace';

const container = document.getElementById('root')!;
const results: {name: string; error: string | null}[] = [];
const check = (value: unknown, message: string) => {if (!value) throw new Error(message);};
const until = async (predicate: () => unknown) => {
  for (let i = 0; i < 120; i++) {if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10));}
  throw new Error(`Timed out: ${container.textContent?.slice(0, 400)}`);
};
let root: Root | null = null;
let calls: URL[] = [];
let fail = false;
let currentSearch = '';
let browserBack: () => void;
const students = Array.from({length: 137}, (_, index) => ({id: index + 1, name: `Student ${String(index).padStart(3, '0')}`, matricNo: `MAT-${index}`, programme: index % 2 ? 'Computing' : 'Data Science', title: `Research title ${index}`}));
students[0].title = 'An explainable artificial intelligence framework for evaluating postgraduate research progress across multidisciplinary programmes';
function Fixture({role}: {role: 'Lecturer' | 'Office Staff/Admin' | 'Programme Coordinator'}) {
  const navigate = useNavigate();
  browserBack = () => { void navigate(-1); };
  currentSearch = useLocation().search;
  return <LecturerResearchWorkspace role={role} routeView="profile" hideHeader />;
}
async function mount(query = '', role: 'Lecturer' | 'Office Staff/Admin' | 'Programme Coordinator' = 'Office Staff/Admin') {
  root?.unmount(); calls = []; fail = false;
  window.fetch = async input => {
    const url = new URL(String(input), location.origin); calls.push(url);
    if (url.pathname.endsWith('/profiles/')) {
      if (fail) return Response.json({error: 'Directory unavailable'}, {status: 500});
      const q = (url.searchParams.get('q') || '').toLowerCase();
      let rows = students.filter(row => `${row.name} ${row.matricNo} ${row.title}`.toLowerCase().includes(q) && (!url.searchParams.get('programme') || row.programme === url.searchParams.get('programme')));
      if (url.searchParams.get('sort') === 'name_desc') rows = [...rows].reverse();
      const size = Number(url.searchParams.get('size') || 10), total = rows.length, pageCount = Math.max(1, Math.ceil(total / size));
      const page = Math.min(Number(url.searchParams.get('page') || 1), pageCount);
      return Response.json({students: rows.slice((page - 1) * size, page * size), programmes: ['Computing', 'Data Science'], pagination: {total, page, pageSize: size, pageCount}});
    }
    const id = Number(url.searchParams.get('studentId'));
    const student = students.find(row => row.id === id)!;
    return Response.json(url.pathname.endsWith('/options/') ? {students: student ? [student] : students, programmes: [], profile: student ? {studentId: id, title: student.title, abstract: 'Saved abstract', programme: student.programme, revision: 0} : null, canSubmitResearch: false, canCorrect: false, canTransfer: false} : {requests: [], revisions: []});
  };
  root = createRoot(container);
  root.render(<MemoryRouter initialEntries={['/supervisor-appointments/research-changes/profile' + query]}><Fixture role={role}/></MemoryRouter>);
  await until(() => !!container.querySelector('table') || container.textContent?.includes('Select a student'));
}
const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent === text)!;
function input(value: string) {
  const field = container.querySelector<HTMLInputElement>('input[type="search"]')!;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
  field.dispatchEvent(new Event('input', {bubbles: true}));
}
async function scenario(name: string, run: () => Promise<void>) {
  try {await run(); results.push({name, error: null});} catch (error) {results.push({name, error: String(error)});}
}
if (new URLSearchParams(location.search).has('preview')) {
  students[0].name = 'Aisyah Nur Farhana binti Abdullah';
  students[1].name = 'Muhammad Danish Hakim';
  students[2].name = 'Tan Wei Ming';
  await mount();
} else {
await scenario('directory uses bounded reads and explicit student actions for every staff role', async () => {
  for (const role of ['Office Staff/Admin', 'Programme Coordinator', 'Lecturer'] as const) {
    await mount('', role);
    check(container.querySelector('table[aria-label="Student research profiles"]'), `${role}: directory missing`);
    check(container.querySelectorAll('tbody tr').length === 10, 'Default page must have ten rows');
    check(container.textContent?.includes('137 students'), 'Total missing');
    check(calls.length === 1 && calls[0].pathname.endsWith('/profiles/'), 'Directory must not fetch full options or requests');
    check(container.querySelector('button[aria-label="View research profile for Student 000"]'), 'Explicit accessible action missing');
  }
});
await scenario('search queries all records and resets page without losing focus', async () => {
  await mount('?profilePage=5'); input('MAT-136');
  await until(() => container.textContent?.includes('Student 136'));
  check(container.querySelectorAll('tbody tr').length === 1, 'Search must reach beyond current page');
  check(document.activeElement === container.querySelector('input[type="search"]'), 'Search lost focus during fetch');
  check(!new URLSearchParams(currentSearch).has('profilePage'), 'Search must reset page');
});
await scenario('filter sort and size are applied on the server and survive profile navigation', async () => {
  await mount('?view=history&sort=newest&profileProgramme=Computing&profileSort=name_desc&profileSize=25&profilePage=2');
  check(container.querySelectorAll('tbody tr').length === 25, 'Page size not applied');
  check(container.querySelector('tbody')?.textContent?.includes('Student 085'), 'Sort/filter/page mismatch');
  container.querySelector<HTMLButtonElement>('tbody button')!.click();
  await until(() => container.textContent?.includes('Saved abstract'));
  check(calls.some(url => url.searchParams.get('selectedOnly') === 'true'), 'Detail still downloads full selector');
  check(container.textContent?.includes('Student 085') && container.textContent?.includes('MAT-85'), 'Selected student identity missing');
  check(!container.querySelector('select option[value="137"]'), 'Full selector must be removed');
  browserBack();
  await until(() => !!container.querySelector('table'));
  check(container.querySelector('tbody')?.textContent?.includes('Student 085'), 'Return lost directory context');
  check(new URLSearchParams(currentSearch).get('sort') === 'newest', 'Directory changed request history context');
});
await scenario('pagination moves forward and clear filters recovers from empty search', async () => {
  await mount(); button('Next').click(); await until(() => container.querySelector('tbody')?.textContent?.includes('Student 010'));
  input('no such student'); await until(() => container.textContent?.includes('No matching students'));
  button('Clear filters').click(); await until(() => container.querySelectorAll('tbody tr').length === 10);
  check(container.querySelector('tbody')?.textContent?.includes('Student 000'), 'Reset should return to first page');
});
await scenario('errors offer retry and do not leave stale student rows actionable', async () => {
  await mount(); fail = true; button('Next').click(); await until(() => container.textContent?.includes('Directory unavailable'));
  check(!container.querySelector('tbody button'), 'Stale profile action remained visible');
  fail = false; button('Retry').click(); await until(() => !!container.querySelector('tbody button'));
});
await scenario('return to students restores directory search and selected identity is never a dropdown', async () => {
  await mount('?profileQ=MAT-136');
  check(container.querySelectorAll('tbody tr').length === 1, 'Saved search not restored');
  container.querySelector<HTMLButtonElement>('tbody button')!.click(); await until(() => container.textContent?.includes('Saved abstract'));
  check(!container.querySelector('label')?.textContent?.includes('Select a student'), 'Profile selector retained');
  browserBack(); await until(() => !!container.querySelector('table'));
  check(container.querySelector<HTMLInputElement>('input[type="search"]')?.value === 'MAT-136', 'Return lost search');
});
await scenario('long research titles fit and desktop table becomes labelled mobile rows', async () => {
  await mount();
  check(document.documentElement.scrollWidth <= window.innerWidth, 'Page overflows horizontally');
  const table = container.querySelector('table')!;
  check(table.scrollWidth <= table.clientWidth + 1, 'Table content overflows');
  const header = table.querySelector('thead')!;
  check(getComputedStyle(header).display === (window.innerWidth >= 1024 ? 'table-header-group' : 'none'), 'Responsive header mismatch');
  const label = table.querySelector('tbody tr td:nth-child(3) span')!;
  check(getComputedStyle(label).display === (window.innerWidth >= 1024 ? 'none' : 'block'), 'Mobile row label mismatch');
});
root?.unmount(); parent.postMessage({type:'research-directory-results', width:innerWidth, results},location.origin);
}
