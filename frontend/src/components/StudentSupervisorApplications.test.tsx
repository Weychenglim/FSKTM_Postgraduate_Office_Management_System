import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { StudentSupervisorApplications, studentApplicationViewParams } from './StudentSupervisorApplications';
import { StudentSupervisorAppointment } from './StudentSupervisorAppointment';
import type { StudentSupervisorApplication } from '../types';

const applications: StudentSupervisorApplication[] = Array.from({ length: 12 }, (_, index) => ({
  applicationId: index + 1, id: `SV-APP-${String(index + 1).padStart(5, '0')}`,
  supervisor: `Dr Proposed ${index + 1}`, title: `Research title ${index + 1}`, researchArea: 'Computing',
  date: '10 Oct 2026', status: 'PENDING REVIEW', workflowStatus: index === 1 ? 'PENDING_COORDINATOR' : 'SUBMITTED_TO_SUPERVISOR',
  waitingDays: 2, waitingSince: '2026-10-10T04:00:00Z', documents: [], replacesAppointmentId: index === 1 ? 100 : null,
}));
applications.push(...(['APPROVED', 'REJECTED_BY_SUPERVISOR', 'CANCELLED_BY_OFFICE'] as const).map((workflowStatus, index) => ({
  ...applications[0], applicationId: 100 + index, id: `SV-FINAL-${index}`, supervisor: `Dr Historical ${index}`,
  workflowStatus, status: workflowStatus === 'APPROVED' ? 'APPROVED' as const : workflowStatus === 'CANCELLED_BY_OFFICE' ? 'CANCELLED' as const : 'RETURNED' as const,
})));
const render = (query = '', rows = applications, compact = false) => renderToStaticMarkup(<MemoryRouter initialEntries={[`/supervisor-appointments/applications${query}`]}><StudentSupervisorApplications applications={rows} compact={compact} onViewApplication={() => {}} /></MemoryRouter>);
for (const [sourceStatus, destination] of [['PENDING_COORDINATOR', 'history'], ['APPROVED', 'requests']] as const) {
  const source = new URLSearchParams(`q=supervisor&type=replacement&from=2026-10-01&size=25&status=${sourceStatus}&page=2`);
  const transitioned = studentApplicationViewParams(source, destination);
  assert.equal(transitioned.toString(), `q=supervisor&type=replacement&from=2026-10-01&size=25&view=${destination}`, 'Switching request views must clear status and page without losing the other filters');
  assert.equal(source.get('status'), sourceStatus, 'View transitions do not mutate the previous query');
}
const first = render();
assert.doesNotMatch(first, /Submission period|Check period|Application availability/, 'Availability belongs beside the page action, outside the records list');
assert.match(first, /aria-label="Request views"/);
assert.match(first, /aria-pressed="true"[^>]*>Requests/);
assert.doesNotMatch(first, /Dr Historical/);
assert.match(first, /role="columnheader"[^>]*>Supervisor</);
const firstRow = first.match(/<tbody[^>]*><tr[^>]*>(.*?)<\/tr>/)?.[1] ?? '';
assert.match(firstRow.split('</td>')[0], /Dr Proposed 1/);
assert.doesNotMatch(firstRow.split('</td>')[0], /Primary supervisor|SV-APP-/);
assert.match(first, /Current stage[\s\S]*Waiting at this stage/);
assert.match(first, /Awaiting Supervisor review/);
assert.match(first, /Awaiting Coordinator approval/);
assert.match(first, /2 calendar days/);
assert.match(first, /10 Oct 2026/);
assert.doesNotMatch(first, /Invalid date|SV-APP-|font-mono|Research title/);
assert.equal((first.match(/>View request</g) ?? []).length, 10);
assert.match(first, /Page 1 of 2 · 12 requests/);
assert.doesNotMatch(first, /Dr Proposed 11|Dr Proposed 12/);
for (const size of [10, 25, 50]) assert.ok(first.includes(`value="${size}"`));
const second = render('?page=2');
assert.equal((second.match(/>View request</g) ?? []).length, 2);
assert.match(second, /Dr Proposed 11|Dr Proposed 12/);
assert.doesNotMatch(second, />Dr Proposed 1</);
assert.equal((render('?size=25').match(/>View request</g) ?? []).length, 12);
assert.match(render('?page=999'), /Page 2 of 2/);
assert.match(render('?page=-1'), /Page 1 of 2/);
assert.match(render('?q=SV-APP-00012'), /Dr Proposed 12/);
assert.equal((render('?q=SV-APP-00012').match(/>View request</g) ?? []).length, 1);
assert.match(render('?status=PENDING_COORDINATOR'), /Dr Proposed 2/);
assert.doesNotMatch(render('?status=PENDING_COORDINATOR'), />Dr Proposed 1</);
assert.match(render('?type=replacement'), /Dr Proposed 2/);
assert.doesNotMatch(render('?type=replacement'), />Dr Proposed 1</);
assert.doesNotMatch(render('?from=2026-10-11'), />View request</);
assert.match(render('?q=unmatched'), /No matching requests/);
assert.equal((render('?from=2026-10-10').match(/>View request</g) ?? []).length, 10);
assert.match(render('', [{ ...applications[0], waitingDays: undefined, waitingSince: undefined }]), /Waiting at this stage[\s\S]*Not recorded/);
assert.doesNotMatch(render('', [{ ...applications[0], date: '2026-10-10T04:00:00Z' }]), /Invalid date/);
const september = render('', [{ ...applications[0], date: '10 Sept 2026' }]);
assert.doesNotMatch(september, /Invalid date/);
assert.match(september, />10 Sept 2026<\/td>/);
const history = render('?view=history');
assert.doesNotMatch(history, /Application availability|Checking availability|Check period/, 'Past requests do not show current submission availability');
assert.equal((history.match(/>View request</g) ?? []).length, 3);
assert.match(history, /Dr Historical 0|Dr Historical 1|Dr Historical 2/);
assert.doesNotMatch(history, /Dr Proposed|2 calendar days/);
assert.match(history, /<th[^>]*>Outcome<\/th>/);
assert.doesNotMatch(history, /Waiting at this stage|Current stage/);
assert.doesNotMatch(history, /aria-label="Not applicable"/);
assert.match(history, /Cancelled by Office/);
const overview = render('', applications, true);
assert.match(overview, /Current request|Dr Proposed 1/);
assert.doesNotMatch(overview, /Dr Historical|Request views|Research title|SV-APP-/);
const unavailable = render('', [{ ...applications[0], unavailableUntil: '2026-11-01' }], true);
assert.match(unavailable, /Unavailable for new appointments until 2026-11-01/);
const missingId = render('', [{ ...applications[0], applicationId: undefined }]);
assert.match(missingId, /disabled=""[^>]*><span>View request/);
for (const routeView of ['overview', 'applications', 'research'] as const) {
  const page = renderToStaticMarkup(<MemoryRouter><StudentSupervisorAppointment routeView={routeView} /></MemoryRouter>);
  assert.equal((page.match(/>Refresh</g) ?? []).length, 0, `${routeView} has no manual refresh action`);
  assert.doesNotMatch(page, /Refresh teams|Refresh research changes/);
  assert.match(page, /aria-label="Supervisor workspace"/, `${routeView} keeps the workspace tabs`);
  for (const label of ['My supervisors', 'Applications', 'Research changes']) assert.ok(page.includes(`>${label}</a>`), `${routeView} retains ${label}`);
}
const detail = renderToStaticMarkup(<MemoryRouter><StudentSupervisorAppointment routeView="applications" initialApplicationId="1" onNavigateToList={() => {}} /></MemoryRouter>);
assert.doesNotMatch(detail, /New application|>Refresh</);
const overviewDetail = renderToStaticMarkup(<MemoryRouter><StudentSupervisorAppointment routeView="applications" initialApplicationId="1" backLabel="Back to My supervisors" onNavigateToList={() => {}} /></MemoryRouter>);
assert.match(overviewDetail, /Back to My supervisors/, 'An exact request keeps the overview return label while loading');
assert.doesNotMatch(overviewDetail, /Back to Applications/);
assert.match(detail, /Back to Applications/, 'Direct request links retain the Applications fallback');
console.log('Student application partitions, supervisor identity, filters, paging without manual refresh pass');
