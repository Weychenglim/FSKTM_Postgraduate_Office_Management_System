import React, {useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createMemoryRouter, RouterProvider} from 'react-router';
import {RecordPage} from '../src/components/RecordPage';
import {SupervisorApplicationContactEditor} from '../src/components/SupervisorApplicationContactEditor';
import {CoSupervisorNominationForm} from '../src/components/SupervisoryTeamManagement';
import type {SupervisoryTeam, CoSupervisorAppointment} from '../src/types/coSupervision';
import type {SupervisorStudentParticularsData} from '../src/types/supervisorSectionA';

const container = document.getElementById('root')!;
const results: {name: string; error?: string}[] = [];
const check = (value: unknown, message: string) => {if (!value) throw Error(message);};
const pause = () => new Promise(resolve => setTimeout(resolve, 15));
const until = async (condition: () => unknown) => {for (let i = 0; i < 180; i++) {if (condition()) return; await pause();} throw Error('Timed out: ' + document.body.textContent?.slice(-800));};
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => !node.closest('[hidden]') && node.textContent?.trim() === label);
async function click(label: string) {const node = button(label); check(node, 'Missing ' + label); node!.click(); await pause();}
async function change(selector: string, value: string) {
  const node = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)!;
  check(node, 'Missing field ' + selector);
  const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(node, value);
  node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', {bubbles: true})); await pause();
}
let root: Root | undefined;
let router: ReturnType<typeof createMemoryRouter> | undefined;
let writes = 0, fail = false, hold = false;
let release: (() => void) | undefined;
const particulars: SupervisorStudentParticularsData = {name: 'Fixture Student', studentId: 'TEST1', programme: 'Computing', semester: 'S1', identityNumber: '', identityType: '', email: 'fixture@example.test', phone: '012345', address: 'Original address'};
const team = {studentId: 7, matricNo: 'TEST1', studentName: 'Fixture Student', programme: 'Computing', studentStatus: 'Active', primarySupervisor: {id: 9, name: 'Dr Primary'}, research: {title: 'Title', area: 'Networks', abstract: 'Abstract'}, appointments: [], nominations: [], canNominate: true, timeline: []} as unknown as SupervisoryTeam;
const replacement = {id: 8, supervisor: {id: 10, name: 'Dr Previous'}} as CoSupervisorAppointment;
window.fetch = async (input, init) => {
  const path = String(input);
  if (path.includes('/candidates/')) return Response.json([{id: 12, name: 'Dr Already Supporting', selectable: false, reason:'Already an active co-supervisor', capacityState:'INELIGIBLE',activeLoad:1,limit:4}, {id: 9, name: 'Dr Primary', selectable: false, capacityState: 'INELIGIBLE', activeLoad: 1, limit: 4}, {id: 11, name: 'Dr Candidate', staffId: 'L11', department: 'Data Science', selectable: true, capacityState: 'AVAILABLE', activeLoad: 1, limit: 4}]);
  if (path.includes('/application-contact/')) {
    writes++; if (hold) await new Promise<void>(resolve => {release = resolve;});
    if (fail) return Response.json({phone: ['Fixture phone failure.']}, {status: 400});
    return Response.json({studentParticulars: {...particulars, ...JSON.parse(String(init!.body))}});
  }
  throw Error('Unexpected HTTP ' + path);
};
function Harness({kind, busy = false}: {kind: 'contact' | 'nomination' | 'replacement'; busy?: boolean}) {
  const [parent, setParent] = useState('');
  const [details, setDetails] = useState(particulars);
  const [open, setOpen] = useState(true);
  return <RecordPage title="Application" onBack={() => void router!.navigate('/other')} backLabel="Back to applications" dirty={!!parent}>
    <label>Parent draft<input id="parent-draft" value={parent} onChange={event => setParent(event.target.value)}/></label>
    {kind === 'contact' ? <SupervisorApplicationContactEditor particulars={details} onSaved={setDetails} onEditingChange={() => {}}/> : open ? <CoSupervisorNominationForm team={team} replacement={kind === 'replacement' ? replacement : null} busy={busy} onCancel={() => setOpen(false)} onSubmit={() => {writes++;}}/> : <button onClick={() => setOpen(true)}>Reopen nomination</button>}
  </RecordPage>;
}
async function mount(kind: 'contact' | 'nomination' | 'replacement', busy = false) {
  root?.unmount(); router?.dispose(); container.innerHTML = ''; sessionStorage.clear(); writes = 0; fail = false; hold = false; release = undefined;
  router = createMemoryRouter([{path: '/', element: <Harness kind={kind} busy={busy}/>}, {path: '/other', element: <p>Application list</p>}]);
  root = createRoot(container); root.render(<React.StrictMode><RouterProvider router={router}/></React.StrictMode>);
  await until(() => kind === 'contact' ? button('Edit contact details') : lecturerInput());
}
const lecturerInput = () => document.querySelector<HTMLInputElement>('input[role="combobox"]');
async function openLecturers() {lecturerInput()!.focus(); lecturerInput()!.click(); await pause();}
async function scenario(name: string, run: () => Promise<void>) {try {await run(); results.push({name});} catch (error) {results.push({name, error: String(error)});}}
await scenario('Contact untouched and reverted Cancel stays quiet', async () => {
  await mount('contact'); await click('Edit contact details'); await click('Cancel'); check(button('Edit contact details') && !document.querySelector('dialog[open]'), 'Untouched contact prompted');
  await click('Edit contact details'); await change('#application-phone', '999'); await change('#application-phone', particulars.phone); await click('Cancel'); check(button('Edit contact details') && !document.querySelector('dialog[open]'), 'Reverted contact prompted');
});
await scenario('Contact Keep editing and child discard preserve parent work', async () => {
  await mount('contact'); await change('#parent-draft', 'Keep application writing'); await click('Edit contact details'); await change('#application-phone', '999'); await click('Cancel');
  check(document.querySelector('dialog[open]'), 'Dirty contact Cancel discarded without consent'); await click('Keep editing'); check(document.querySelector<HTMLInputElement>('#application-phone')?.value === '999', 'Keep editing lost contact');
  await click('Cancel'); await click('Discard changes'); await until(() => button('Edit contact details')); await click('Edit contact details'); check(document.querySelector<HTMLInputElement>('#application-phone')?.value === particulars.phone, 'Discarded contact resurrected'); await click('Cancel');
  await click('Back to applications'); check(document.querySelector('dialog[open]') && document.querySelector<HTMLInputElement>('#parent-draft')?.value === 'Keep application writing', 'Child discard cleared parent protection'); check(writes === 0, 'Cancellation wrote');
});
await scenario('Contact successful save leaves unrelated parent draft protected', async () => {
  await mount('contact'); await change('#parent-draft', 'Unsaved application'); await click('Edit contact details'); await change('#application-phone', '999'); await click('Save contact details'); await until(() => button('Edit contact details'));
  check(writes === 1, 'Contact save duplicated'); await click('Edit contact details'); check(document.querySelector<HTMLInputElement>('#application-phone')?.value === '999', 'Saved baseline lost'); await click('Cancel'); check(!document.querySelector('dialog[open]'), 'Saved contact still dirty'); await click('Back to applications'); check(document.querySelector('dialog[open]'), 'Saving contact cleared parent draft');
});
await scenario('Contact pending and failed save retain input', async () => {
  await mount('contact'); await click('Edit contact details'); await change('#application-phone', '999'); hold = true; fail = true; await click('Save contact details'); await until(() => release); await click('Cancel'); check(document.querySelector('#application-phone'), 'Pending save closed editor'); release!(); await until(() => document.body.textContent?.includes('Fixture phone failure.')); check(writes === 1 && document.querySelector<HTMLInputElement>('#application-phone')?.value === '999', 'Failed save lost draft'); await click('Cancel'); check(document.querySelector('dialog[open]'), 'Failed draft unprotected');
});
for (const kind of ['nomination', 'replacement'] as const) {
  await scenario(kind + ' clean and reverted Cancel stays quiet', async () => {
    await mount(kind); await click('Cancel'); check(button('Reopen nomination') && !document.querySelector('dialog[open]'), 'Clean nomination prompted'); await click('Reopen nomination'); await until(() => lecturerInput()); await change('textarea', 'Temporary'); await change('textarea', ''); await click('Cancel'); check(button('Reopen nomination') && !document.querySelector('dialog[open]'), 'Reverted nomination prompted');
  });
  await scenario(kind + ' dirty Cancel retains or discards only this editor', async () => {
    await mount(kind); await change('#parent-draft', 'Parent work'); await openLecturers(); await until(() => document.querySelector('[role="option"]')); document.querySelector<HTMLElement>('[role="option"]')!.click(); await pause(); await change('textarea', 'Keep justification'); await click('Cancel'); check(document.querySelector('dialog[open]'), 'Dirty nomination closed without consent'); await click('Keep editing'); check(document.querySelector<HTMLTextAreaElement>('textarea')?.value === 'Keep justification', 'Keep editing lost justification'); await click('Cancel'); await click('Discard changes'); await click('Reopen nomination'); await until(() => lecturerInput()); check(lecturerInput()?.value === '' && document.querySelector<HTMLTextAreaElement>('textarea')?.value === '', 'Discarded nomination resurrected'); await click('Cancel'); await click('Back to applications'); check(document.querySelector('dialog[open]'), 'Child discard cleared parent guard'); check(writes === 0, 'Cancel submitted');
  });
}
await scenario('Nomination modal Close and Escape protect drafts without moving the workspace', async () => {
  for (const kind of ['nomination', 'replacement'] as const) {
    await mount(kind);
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')!;
    check(dialog && dialog.contains(document.activeElement), 'Nomination did not open as a focused modal');
    await openLecturers(); await until(() => document.querySelector('[role="option"]'));
    check(!document.querySelector('[role="listbox"]')?.textContent?.includes('Dr Primary'), 'Primary supervisor still appears as a co-supervisor candidate');
    check(!document.querySelector('[role="listbox"]')?.textContent?.includes('Dr Already Supporting'), 'Ineligible lecturer still appears as a co-supervisor candidate');
    check(document.querySelector('[role="listbox"]')?.textContent?.includes('Data Science'), 'Missing department');
    await change('input[type="search"]', 'no match');
    check(document.body.textContent?.includes('No matching lecturers found.'), 'Missing lecturer empty search message');
    await change('input[type="search"]', 'L11');
    const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown',bubbles:true})); await pause();
    search.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true})); await pause();
    check(lecturerInput()?.value === 'Dr Candidate', 'Keyboard search selection did not update the field');
    check(dialog.querySelectorAll('input[type="search"]').length === 1, 'Picker contains more than one search field');
    await openLecturers(); await until(() => document.querySelector('[role="option"][aria-selected="true"]'));
    check(document.querySelector('[role="option"][aria-selected="true"]')?.textContent?.includes('Dr Candidate'), 'Missing selected candidate indicator');
    document.querySelector<HTMLInputElement>('input[type="search"]')!.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})); await pause();
    check(!dialog.textContent?.includes('The lecturer reviews first'), 'Removed explanation still visible');
    check(dialog.getAttribute('aria-labelledby') && document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent?.includes('co-supervisor'), 'Modal has no accessible title');
    check(dialog.querySelector('header')?.textContent?.includes(team.studentName), 'Missing compact student context');
    document.querySelector<HTMLButtonElement>('button[aria-label="Close co-supervisor nomination"]')!.click(); await pause();
    await click('Discard changes');
    check(button('Reopen nomination') && !document.querySelector('dialog[open]'), 'Close did not dismiss after discard');
    await click('Reopen nomination'); await until(() => lecturerInput());
    await change('textarea', 'Preserve this justification');
    document.querySelector('dialog[open]')!.dispatchEvent(new Event('cancel', {cancelable:true}));
    await until(() => button('Keep editing')); await click('Keep editing');
    check(document.querySelector<HTMLTextAreaElement>('textarea')?.value === 'Preserve this justification', 'Escape lost draft');
    document.querySelector<HTMLButtonElement>('button[aria-label="Close co-supervisor nomination"]')!.click(); await pause(); await click('Discard changes');
    check(button('Reopen nomination') && !document.querySelector('dialog[open]'), 'Confirmed Close left modal open');
    check(writes === 0, 'Modal dismissal submitted a nomination');
  }
});
await scenario('Pending nomination cannot be cancelled', async () => {await mount('nomination', true); await click('Cancel'); check(document.querySelector('form[aria-label="Co-supervisor nomination"]') && !button('Reopen nomination'), 'Pending nomination closed');});
root?.unmount(); router?.dispose(); document.getElementById('test-results')!.textContent = JSON.stringify(results);
parent.postMessage({type:'appointment-fixture-results',results},location.origin);
