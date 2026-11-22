import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ResearchAmendments, type ResearchRouteView } from '../src/components/ResearchAmendments';
import { RecordPageProvider } from '../src/components/RecordPage';
import { ListState } from '../src/components/ListState';
import { setAuthToken, request } from '../src/services/apiClient';
import { getResearchAmendments, getResearchAmendment, getResearchAmendmentOptions, decideResearchAmendment, type ResearchAmendment } from '../src/services/researchAmendmentsApi';
import type { UserRole } from '../src/types';

const checks: string[] = [];
const check = (value: unknown, message: string) => { if (!value) throw Error(message); checks.push(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 40));
const until = async (condition: () => unknown) => {
  for (let i = 0; i < 750; i++) { if (condition()) return; await pause(); }
  throw Error(`Timed out waiting for research UI: ${document.getElementById('root')?.textContent?.slice(-700)}`);
};
const visible = (node: Element) => !node.closest('[hidden]') && !!node.getClientRects().length;
const button = (label: string, parent: ParentNode = document) => [...parent.querySelectorAll<HTMLButtonElement>('button')].find(node => visible(node) && node.textContent?.trim() === label);
const click = async (label: string, parent: ParentNode = document) => {
  const node = button(label, parent);
  if (!node || node.disabled) throw Error(`Missing or disabled action: ${label}`);
  node.click(); await pause();
};
const enter = async (node: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  if (!node) throw Error('Missing research field');
  Object.getOwnPropertyDescriptor(node instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype, 'value')!.set!.call(node, value);
  node.dispatchEvent(new Event('input', { bubbles: true })); await pause();
};
const field = (name: string, parent: ParentNode = document) => [...parent.querySelectorAll('label')].filter(node => node.textContent?.trim().startsWith(name))
  .map(node=>node.control).find(control=>control?.matches('input:not([type="checkbox"]),textarea')) as HTMLInputElement|HTMLTextAreaElement;
let root: Root | null = null;
const report = (result: { checks: string[]; viewportWidth?: number; error?: string }) => {
  document.getElementById('journey-results')!.textContent = JSON.stringify(result);
  window.parent.postMessage({ type: 'research-results', result }, window.location.origin);
};
try {
  const config = await (await fetch('/journey-config')).json();
  const roles: Record<string, UserRole> = { student: 'Student', primary: 'Lecturer', supporting: 'Lecturer', unrelated: 'Lecturer', office: 'Office Staff/Admin', source: 'Programme Coordinator', destination: 'Programme Coordinator' };
  const switchActor = (actor: string) => { root?.unmount(); root = null; setAuthToken(config.tokens[actor]); };
  const settled = () => !!document.querySelector('section') && !document.getElementById('root')?.textContent?.includes('Loading');
  const mount = async (actor: string, view: ResearchRouteView, id?: number) => {
    switchActor(actor);
    root = createRoot(document.getElementById('root')!);
    root.render(<MemoryRouter><ListState.Provider value={new Map()}><RecordPageProvider>
      <ResearchAmendments role={roles[actor]} routeView={view} routeRequestId={id === undefined ? undefined : String(id)} studentFilter={config.studentId} onStudentFilter={() => {}} />
    </RecordPageProvider></ListState.Provider></MemoryRouter>);
    await until(settled); await pause();
  };
  const denied = async (path: string, method = 'GET', body?: object) => {
    try { await request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }); return 0; }
    catch (failure) { return (failure as { status: number }).status; }
  };
  const choose = async (label: string, text: string) => {
    const wrapper = [...document.querySelectorAll('label')].find(node => node.textContent?.trim().startsWith(label));
    const control = wrapper?.querySelector<HTMLButtonElement>('[role="combobox"]');
    if (!control) throw Error(`Missing selection field: ${label}`);
    control.click(); await until(() => [...document.querySelectorAll('[role="option"]')].some(node => node.textContent?.trim() === text));
    [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(node => node.textContent?.trim() === text)!.click(); await pause();
  };
  const latest = async () => (await getResearchAmendments(config.studentId)).requests.sort((a, b) => b.id - a.id)[0];
  const profile = async () => (await getResearchAmendmentOptions(config.studentId)).profile!;
  const createResearch = async (title = 'Accepted journey research title') => {
    await mount('student', 'new');
    for (const name of ['Research title', 'Research abstract']) {
      const choice = [...document.querySelectorAll('label')].find(node => node.textContent?.trim() === name && node.control?.matches('input[type="checkbox"]'))?.control;
      check(choice, `Missing field choice: ${name}`);
      choice!.click();
      await until(() => !!field(name));
    }
    await enter(field('Research title'), title);
    await enter(field('Research abstract'), 'Accepted journey research abstract.');
    await enter(field('Reason'), '   ');
    check(button('Submit request')?.disabled, 'Changed research still requires a nonblank reason');
    await enter(field('Reason'), 'Journey research refinement');
    await click('Submit request');
    await until(() => settled() && !!document.getElementById('root')?.textContent?.includes('Research change recorded.'));
    const row = await latest();
    check(row.kind === 'RESEARCH' && row.status === 'PENDING_SUPERVISOR', 'Student UI submits research to the primary Supervisor');
    return row;
  };
  const createTransfer = async () => {
    await mount('office', 'new');
    await choose('Change type', 'Programme transfer');
    await choose('Destination programme', config.destinationProgramme);
    await enter(field('Reason'), ' ');
    check(button('Submit request')?.disabled, 'Selected transfer destination still requires a reason');
    await enter(field('Reason'), 'Journey programme transfer');
    await click('Submit request');
    await until(() => settled() && !!document.getElementById('root')?.textContent?.includes('Research change recorded.'));
    const row = await latest();
    check(row.kind === 'TRANSFER' && row.status === 'PENDING_SOURCE_COORDINATOR', 'Office UI submits transfer to the source Coordinator');
    check(row.teamSnapshot.primary?.userId === config.primaryId && row.teamSnapshot.coSupervisors.some(member => member.userId === config.supportingId) && row.teamSnapshot.panel.some(member => member.userId === config.panelId) && row.unfinishedTaskCount === 1, 'Transfer preview retains the primary, supporting, Panel and unfinished-task context');
    return row;
  };
  const openDecision = async (actor: string, row: ResearchAmendment, action: 'APPROVE' | 'REJECT' | 'CANCEL') => {
    await mount(actor, 'detail', row.id);
    await click(action === 'APPROVE' ? 'Approve request' : action === 'REJECT' ? 'Reject request' : 'Cancel request');
    await until(() => !!document.querySelector('dialog[open]'));
    return document.querySelector<HTMLDialogElement>('dialog[open]')!;
  };
  const confirm = async (dialog: HTMLDialogElement) => {
    const submit = dialog.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submit || submit.disabled) throw Error('Research decision is not ready to confirm');
    submit.click(); await pause();
  };
  const decide = async (actor: string, row: ResearchAmendment, action: 'APPROVE' | 'REJECT' | 'CANCEL') => {
    const dialog = await openDecision(actor, row, action);
    if (action !== 'APPROVE') {
      await enter(dialog.querySelector('textarea')!, ' ');
      check(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, 'Cancellation or rejection requires a nonblank decision reason');
      await enter(dialog.querySelector('textarea')!, `Journey ${action.toLowerCase()} reason`);
    } else if (row.kind === 'TRANSFER') {
      check(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, 'Transfer approval requires explicit team acknowledgement');
      dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); await pause();
      check(!dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, 'Acknowledgement enables only the reviewed transfer decision');
    }
    check(document.documentElement.scrollWidth <= window.innerWidth, 'Research decision dialog fits the actual viewport');
    await confirm(dialog);
    await until(() => !document.querySelector('dialog[open]') && settled());
    return getResearchAmendment(row.id);
  };

  switchActor('student');
  check(await denied('/appointments/research-amendments/', 'POST', { kind: 'RESEARCH', title: 'Changed title', reason: ' ' }) === 400, 'Backend rejects blank research-change reasons');
  check(await denied('/appointments/research-amendments/', 'POST', { kind: 'TRANSFER', studentId: config.studentId, destinationProgramme: config.destinationProgramme, reason: 'Unauthorized' }) === 403, 'Student cannot initiate an Office programme transfer');
  const cancelledResearch = await createResearch();
  check(await denied('/appointments/research-amendments/', 'POST', { kind: 'RESEARCH', title: 'Competing request', reason: 'Another change' }) === 409, 'Only one research or transfer request may remain pending');
  check((await decide('student', cancelledResearch, 'CANCEL')).status === 'CANCELLED', 'Student cancellation retains a cancelled research request');
  check((await profile()).title === config.originalTitle, 'Cancelled research leaves the saved profile unchanged');
  const rejectedResearch = await createResearch();
  check((await decide('primary', rejectedResearch, 'REJECT')).status === 'REJECTED', 'Primary Supervisor rejection is persisted');
  check((await profile()).title === config.originalTitle, 'Rejected research leaves the saved profile unchanged');

  const approvedResearch = await createResearch();
  switchActor('source');
  check(await denied(`/appointments/research-amendments/${approvedResearch.id}/decision/`, 'POST', { decision: 'APPROVE', expectedStatus: 'PENDING_SUPERVISOR' }) === 403, 'Coordinator cannot decide a research-only amendment');
  switchActor('supporting');
  check(await denied(`/appointments/research-amendments/${approvedResearch.id}/`) === 404, 'Supporting membership does not expose primary research-decision records');
  switchActor('unrelated');
  check(await denied(`/appointments/research-amendments/${approvedResearch.id}/`) === 404 && (await getResearchAmendments()).requests.length === 0, 'Unrelated lecturer cannot read exact or listed research requests');
  check((await decide('primary', approvedResearch, 'APPROVE')).status === 'APPROVED', 'Primary Supervisor approves a research change through the production dialog');
  const staleResearch = await createResearch('A separately reviewed stale proposal');
  const staleDialog = await openDecision('primary', staleResearch, 'REJECT');
  await enter(staleDialog.querySelector('textarea')!, 'Stale tab review reason');
  await decideResearchAmendment(staleResearch.id, { decision: 'REJECT', reason: 'Decision recorded in another tab', expectedStatus: 'PENDING_SUPERVISOR' });
  await confirm(staleDialog);
  await until(() => !!button('Review latest record', document.querySelector('dialog[open]')!));
  check(!document.querySelector('dialog[open] button[type="submit"]') && !!document.querySelector('dialog[open] [role="alert"]'), 'A stale research decision is rejected and requires explicit review');
  await click('Review latest record');
  await until(() => !document.querySelector('dialog[open]') && settled());
  check(!button('Approve request') && (await getResearchAmendment(staleResearch.id)).status === 'REJECTED', 'Explicit recovery displays the saved decision without another decision event');
  check((await profile()).revision === 1 && (await profile()).title === 'Accepted journey research title', 'Primary approval applies exactly one saved research revision');

  const cancelledTransfer = await createTransfer();
  check((await decide('office', cancelledTransfer, 'CANCEL')).status === 'CANCELLED', 'Office cancellation preserves a cancelled transfer');
  check((await profile()).programme === config.sourceProgramme, 'Cancelled transfer leaves programme unchanged');
  const sourceRejected = await createTransfer();
  check((await decide('source', sourceRejected, 'REJECT')).status === 'REJECTED', 'Source Coordinator can reject a transfer');
  const destinationRejected = await createTransfer();
  const forwardedRejection = await decide('source', destinationRejected, 'APPROVE');
  check(forwardedRejection.status === 'PENDING_DESTINATION_COORDINATOR' && (await profile()).programme === config.sourceProgramme, 'Source approval forwards a transfer without changing programme');
  check((await decide('destination', forwardedRejection, 'REJECT')).status === 'REJECTED', 'Destination Coordinator can reject the forwarded transfer');

  const transfer = await createTransfer();
  switchActor('destination');
  check(await denied(`/appointments/research-amendments/${transfer.id}/decision/`, 'POST', { decision: 'APPROVE', expectedStatus: transfer.status, retainTeam: true }) === 404, 'Destination Coordinator cannot skip source-programme review');
  switchActor('source');
  check(await denied(`/appointments/research-amendments/${transfer.id}/decision/`, 'POST', { decision: 'APPROVE', expectedStatus: transfer.status }) === 400, 'Backend independently rejects missing transfer acknowledgement');
  const forwarded = await decide('source', transfer, 'APPROVE');
  check(forwarded.status === 'PENDING_DESTINATION_COORDINATOR' && (await profile()).programme === config.sourceProgramme, 'First approval preserves source programme and awaits a separate final decision');
  check(await denied(`/appointments/research-amendments/${transfer.id}/decision/`, 'POST', { decision: 'APPROVE', expectedStatus: transfer.status, retainTeam: true }) === 409, 'Replaying the old source approval cannot advance the destination stage');
  switchActor('destination');
  check(await denied(`/appointments/research-amendments/${transfer.id}/decision/`, 'POST', { decision: 'APPROVE', expectedStatus: forwarded.status }) === 400, 'Destination approval independently requires team acknowledgement');
  const final = await decide('destination', forwarded, 'APPROVE');
  check(final.status === 'APPROVED' && final.events.filter(event => event.action === 'ENDORSE' || event.action === 'APPROVE').every(event => event.retainTeam), 'Both Coordinator decisions retain explicit acknowledgement in history');
  const destinationProfile = await profile();
  check(destinationProfile.programme === config.destinationProgramme && destinationProfile.revision === 2, 'Final approval atomically updates the current programme and research revision');
  check(final.before.title === 'Accepted journey research title' && final.after.title === final.before.title, 'Transfer retains the approved research content');
  switchActor('source');
  check((await getResearchAmendment(transfer.id)).status === 'APPROVED', 'Former programme Coordinator retains their exact decision history');
  check(await denied(`/appointments/research-amendments/options/?studentId=${config.studentId}`) === 404, 'Former programme Coordinator loses current-profile access');
  await mount('source', 'detail', transfer.id);
  check(!button('Approve request') && !button('Reject request'), 'Historical transfer detail gives the former Coordinator no decision controls');
  switchActor('student');
  const studentHistory = await getResearchAmendments(config.studentId);
  check(studentHistory.revisions.length === 3 && studentHistory.requests.length === 8, 'Student history retains baseline, approved revisions and all distinct attempts');
  check(!JSON.stringify(studentHistory).includes('Historical evaluation') && !JSON.stringify(studentHistory).includes('Preserved Panel draft'), 'Research request and revision payloads exclude private evaluation comments');
  await mount('student', 'profile');
  check(document.getElementById('root')?.textContent?.includes(config.destinationProgramme) && document.getElementById('root')?.textContent?.includes('Accepted journey research title'), 'Final transfer preservation is visible in the destination profile');
  check(document.documentElement.scrollWidth <= window.innerWidth, 'The final research profile fits the actual viewport');
  report({ checks, viewportWidth: window.innerWidth });
} catch (failure) {
  report({ checks, error: failure instanceof Error ? failure.message : String(failure) });
} finally {
  root?.unmount();
}
