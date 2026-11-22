import assert from 'node:assert/strict';
import { getSubmittedEvaluations } from './marksApi';

const calls: Array<{ url: string; method: string; body: unknown }> = [];
const record = { id: 8, evaluatorRole: 'PANEL', status: 'SUBMITTED', submittedAt: '2026-01-01T17:00:00Z', taskLifecycleStatus: 'RETIRED', canEdit: false, canSubmit: false, components: [{ code: 'methodology', marksAwarded: '50.00', feedback: 'Retained' }] };
globalThis.fetch = (async (url, init) => {
  calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body });
  return new Response(JSON.stringify([record]), { headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;
const records = await getSubmittedEvaluations();
assert.deepEqual(calls, [{ url: '/api/marks/my-submitted-evaluations/', method: 'GET', body: undefined }]);
assert.equal(records[0].taskLifecycleStatus, 'RETIRED');
assert.equal(records[0].submittedAt, record.submittedAt);
assert.equal(records[0].canEdit, false);
assert.equal(records[0].methodologyScore, 50);
console.log('Lecturer history uses its own read-only endpoint and retains legacy score compatibility');
