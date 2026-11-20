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
assert.match(empty, /No marking tasks currently match this period/);
assert.match(empty, /Supervisor tasks affected \(2\)/);
assert.match(empty, /Panel tasks affected \(1\)/);
assert.match(empty, /automatically/);
assert.match(empty, /Estimate/);
assert.match(empty, /04:00 pm \(Malaysia, UTC\+08:00\)/);
const populated = renderToStaticMarkup(<components.MarkEntryRecipientPreview preview={{ ...preview,
  recipients: [{ studentId: 1, matricNo: 'PG001', studentName: 'Research Student', programme: 'PhD Computing', evaluatorId: 8, evaluatorName: 'Dr Evaluator', evaluatorRole: 'PANEL', taskStatus: 'NEW' }],
  totals: { students: 1, supervisor: 0, panel: 1, total: 1, existing: 0, new: 1 },
}} />);
for (const value of ['PG001', 'Research Student', 'Dr Evaluator', 'Panel', 'New']) assert.ok(populated.includes(value));
assert.doesNotMatch(populated, /No marking tasks currently match this period/);
assert.doesNotMatch(populated, /<th[^>]*>Programme<\/th>/);
const excluded = renderToStaticMarkup(<components.MarkEntryRecipientPreview preview={{ ...preview,
  eligibility: { expectedStudents: 0, excludedStudents: 2, reasonCounts: { NO_SEMESTER_ROW: 1, BREAK_AFTER_P1: 1 } },
  exclusions: [
    { studentId: 2, matricNo: 'PG002', studentName: 'Needs Confirmation', programme: 'Computing', reason: 'NO_SEMESTER_ROW' },
    { studentId: 3, matricNo: 'PG003', studentName: 'Break After RP1', programme: 'Computing', reason: 'BREAK_AFTER_P1' },
  ],
  configurationIssues: [],
}} />);
assert.match(excluded, /Needs Confirmation/);
assert.match(excluded, /No semester on record/);
assert.match(excluded, /Not studying right after RP1/);
assert.match(excluded, /Review Project Stages/);
assert.match(excluded, /Search excluded students/);
const paused = renderToStaticMarkup(<components.MarkEntryRecipientPreview preview={{ ...preview,
  recipients: [{ studentId: 1, matricNo: 'PG001', studentName: 'Paused Student', programme: '', evaluatorId: 8, evaluatorName: 'Dr Evaluator', evaluatorRole: 'PANEL', taskStatus: 'PAUSED' }],
  totals: { students: 1, supervisor: 0, panel: 1, total: 1, existing: 1, new: 0 },
}} />);
assert.match(paused, />Paused</);
const blocked = renderToStaticMarkup(<components.MarkEntryRecipientPreview preview={{ ...preview,
  recipients: [{ studentId: 1, matricNo: 'PG001', studentName: 'Paused Handover', programme: '', evaluatorId: 9, evaluatorName: 'New Evaluator', evaluatorRole: 'SUPERVISOR', taskStatus: 'BLOCKED' }],
  totals: { students: 1, supervisor: 1, panel: 0, total: 1, existing: 0, new: 0 },
}} />);
assert.match(blocked, /Existing work needs review/);
const missingProfile = renderToStaticMarkup(<components.MarkEntryRecipientPreview preview={{ ...preview,
  missingAssignments: [{ studentId: 3, matricNo: 'PG003', studentName: 'Needs Profile', programme: 'Computing', reason: 'MISSING_RESEARCH_PROFILE' }],
}} />);
assert.match(missingProfile, /Needs Profile/);
assert.match(missingProfile, /Research profile missing/);
assert.match(missingProfile, /Review Student Registry/);
console.log('Marks recipient preview rendering passed');
