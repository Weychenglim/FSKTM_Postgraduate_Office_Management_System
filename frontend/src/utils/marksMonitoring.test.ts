import assert from 'node:assert/strict';
import { monitoringTaskStatus } from './marksOverview';
import type { EvaluationPeriodOption } from '../types';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkSubmissionMonitoring } from '../components/MarkSubmissionMonitoring';

const period = (total: number, submitted = 0, overdue = 0, effectiveStatus = 'OPEN') => ({
  effectiveStatus, taskTotals: {total, submitted, overdue},
}) as EvaluationPeriodOption;
assert.equal(monitoringTaskStatus(period(0), 3).label, 'Tasks needed');
assert.equal(monitoringTaskStatus(period(0), 0).label, 'No eligible recipients');
assert.equal(monitoringTaskStatus(period(0), undefined).label, 'Checking tasks');
assert.equal(monitoringTaskStatus(period(3), 0).label, 'Awaiting submissions');
assert.equal(monitoringTaskStatus(period(3, 1), 0).label, 'In progress');
assert.equal(monitoringTaskStatus(period(3, 3), 0).label, 'Complete');
assert.equal(monitoringTaskStatus(period(3, 3), undefined).label, 'Checking tasks');
assert.equal(monitoringTaskStatus(period(3, 3), 1).label, 'Tasks needed');
assert.equal(monitoringTaskStatus(period(3, 1, 1), 2).label, 'Overdue');
assert.equal(monitoringTaskStatus(period(0, 0, 0, 'CLOSED'), 2).canGenerate, false);
assert.equal(monitoringTaskStatus(period(3, 3, 0, 'CLOSED'), 0).label, 'Complete');
const empty = renderToStaticMarkup(React.createElement(MarkSubmissionMonitoring, {periods: [{
  ...period(0), id: 1, name: 'Panel period', evaluatorRoles: ['PANEL'], opensAt: null, closesAt: null,
} as EvaluationPeriodOption]}));
assert.match(empty, /Task status/);
assert.match(empty, /No evaluation tasks/);
assert.doesNotMatch(empty, /0 \/ 0|View records for Panel period/);
console.log('Monitoring distinguishes missing tasks, empty eligibility, progress and closed periods');
