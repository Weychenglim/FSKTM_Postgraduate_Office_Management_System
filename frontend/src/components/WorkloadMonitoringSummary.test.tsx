import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import type { PanelWorkloadRecord, SupervisorWorkloadRecord } from '../types';
import { WorkloadMonitoringSummary } from './WorkloadMonitoringSummary';
import { getPanelWorkloadPage } from './PanelWorkloadMonitoring';
import { getSupervisorWorkloadPage } from './SupervisorWorkloadMonitoring';

const base: SupervisorWorkloadRecord = { lecturerId: 'L1', lecturerName: 'Example', department: 'Computing', currentStudents: 2, workloadLimit: 5, availability: 'Available', capacityState: 'AVAILABLE', semesterCode: '2026-S1', capacityPlanVersion: 1, email: 'example@example.test', supervisees: [] };
const metric = (html: string, title: string) => html.split(`<article aria-label="${title}"`)[1]?.split('</article>')[0];

test('Supervisor summaries use the full filtered collection across pages and authoritative capacity states', () => {
  const records: SupervisorWorkloadRecord[] = Array.from({ length: 13 }, (_, index) => ({ ...base, lecturerId: `L${index}`, capacityState: index < 10 ? 'AVAILABLE' : index === 10 ? 'FULL' : index === 11 ? 'OVER_CAPACITY' : 'NOT_CONFIGURED' }));
  const browse = getSupervisorWorkloadPage(records, { search: '', department: '', status: '' }, 2, 10);
  assert.equal(browse.rows.length, 3);
  const html = render(<WorkloadMonitoringSummary kind="supervisor" records={browse.filtered} />);
  assert.match(metric(html, 'Lecturers')!, /card-metric">13</);
  assert.match(metric(html, 'Active appointments')!, /card-metric">26</);
  assert.match(metric(html, 'Available')!, /card-metric">10</);
  assert.match(metric(html, 'At or over capacity')!, /card-metric">2</);
  const filtered = getSupervisorWorkloadPage(records, { search: '', department: '', status: 'FULL' }, 2, 10);
  const filteredHtml = render(<WorkloadMonitoringSummary kind="supervisor" records={filtered.filtered} />);
  assert.match(metric(filteredHtml, 'Lecturers')!, /card-metric">1</);
  assert.match(metric(filteredHtml, 'Available')!, /card-metric">0</);
});

test('Panel reservations count towards capacity without inflating active appointments', () => {
  const panel: PanelWorkloadRecord = { ...base, id: 'P1', name: 'Panel example', initials: 'PE', currentStudents: 5, confirmedAppointments: 2, pendingNominations: 3, capacityState: 'FULL', workloadItems: [] };
  const filtered = getPanelWorkloadPage([panel], { search: '', department: '', status: '' }, 1, 10);
  const html = render(<WorkloadMonitoringSummary kind="panel" records={filtered.filtered} />);
  assert.match(metric(html, 'Active appointments')!, /card-metric">2</);
  assert.match(metric(html, 'At or over capacity')!, /card-metric">1</);
});

test('Unconfigured, temporarily unavailable and ineligible lecturers are not advertised as available', () => {
  const records: SupervisorWorkloadRecord[] = [
    { ...base, semesterCode: null, capacityPlanVersion: null },
    { ...base, capacityState: 'TEMPORARILY_UNAVAILABLE' },
    { ...base, capacityState: 'INELIGIBLE' },
  ];
  const html = render(<WorkloadMonitoringSummary kind="supervisor" records={records} />);
  assert.match(metric(html, 'Available')!, /card-metric">0</);
  assert.match(metric(html, 'At or over capacity')!, /card-metric">0</);
  const empty = render(<WorkloadMonitoringSummary kind="panel" records={[]} />);
  assert.equal((empty.match(/card-metric">0</g) ?? []).length, 4);
  assert.doesNotMatch(empty, /NaN|Infinity/);
});
