import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as components from './MarkEntryPeriodConfig';
import type { EvaluationRecipientPreview } from '../types';

assert.equal(typeof components.MarkEntryRecipientPreview, 'function', 'recipient review must render before publication');
const preview: EvaluationRecipientPreview = {
  periodId: 7, generatedAt: '2026-09-16T08:00:00Z', recipients: [],
  totals: { students: 0, supervisor: 0, panel: 0, total: 0, existing: 0, new: 0 },
  missingAppointments: { supervisor: 2, panel: 1 },
};
const empty = renderToStaticMarkup(<components.MarkEntryRecipientPreview preview={preview} />);
assert.match(empty, /No recipients/);
assert.match(empty, /Supervisor tasks: 2 students not eligible/);
assert.match(empty, /Panel tasks: 1 students not eligible/);
assert.match(empty, /automatically/);
assert.match(empty, /Estimate/);
assert.match(empty, /04:00 pm \(Malaysia, UTC\+08:00\)/);
const populated = renderToStaticMarkup(<components.MarkEntryRecipientPreview preview={{ ...preview,
  recipients: [{ studentId: 1, matricNo: 'PG001', studentName: 'Research Student', programme: 'PhD Computing', evaluatorId: 8, evaluatorName: 'Dr Evaluator', evaluatorRole: 'PANEL', taskStatus: 'NEW' }],
  totals: { students: 1, supervisor: 0, panel: 1, total: 1, existing: 0, new: 1 },
}} />);
for (const value of ['PG001', 'Research Student', 'Dr Evaluator', 'Panel', 'New']) assert.ok(populated.includes(value));
assert.doesNotMatch(populated, /No recipients/);
assert.doesNotMatch(populated, /<th[^>]*>Programme<\/th>/);
console.log('Marks recipient preview rendering passed');
