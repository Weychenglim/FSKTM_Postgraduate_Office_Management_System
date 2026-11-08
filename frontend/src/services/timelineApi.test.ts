import assert from 'node:assert/strict';
import { previewTimelineFile, uploadTimelineFile, downloadTimelineTemplate, timelineEntryToLegacy } from './timelineApi';
const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; body: FormData | undefined }> = [];
const reviewed = { previewToken: 'signed-preview-token', warnings: ['Old dates'], rows: [], importedCount: 1, requiresAcknowledgement: true };
const file = new File(['reviewed workbook bytes'], 'reviewed.xlsx');
globalThis.fetch = async (input, init) => {
  const url = String(input);
  calls.push({ url, body: init?.body as FormData | undefined });
  if (url.includes('/template/')) return new Response(new Blob(['template']));
  return new Response(JSON.stringify(url.includes('/preview/') ? reviewed : { importedCount: 1, timeline: { levels: [] } }), { headers: { 'Content-Type': 'application/json' } });
};
try {
  const preview = await previewTimelineFile(file, 42);
  assert.deepEqual(preview, reviewed);
  assert.equal(calls.length, 1, 'Preview makes only one nonmutating preview request');
  assert.equal(calls[0].url, '/api/dashboard/timeline/upload/preview/');
  assert.equal(calls[0].body?.get('semesterId'), '42');
  assert.equal(calls[0].body?.get('mode'), 'ADD');
  assert.equal(await (calls[0].body?.get('file') as File).text(), await file.text());
  assert.equal(calls[0].body?.get('previewToken'), null);
  await uploadTimelineFile(file, 42, preview.previewToken, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, '/api/dashboard/timeline/upload/');
  assert.equal(calls[1].body?.get('previewToken'), reviewed.previewToken);
  assert.equal(calls[1].body?.get('acknowledgeWarnings'), 'true');
  assert.equal(calls[1].body?.get('mode'), 'ADD');
  assert.equal(await (calls[1].body?.get('file') as File).text(), await file.text());
  await downloadTimelineTemplate(42);
  assert.equal(calls[2].url, '/api/dashboard/timeline/template/?semesterId=42');
  const legacy = timelineEntryToLegacy({ id: 1, level: 'P1', step: 1, title: 'Ended event', detail: '', action: '', deadlineStart: '2026-01-01', deadlineEnd: '2026-01-02', weekLabel: '', targetRoles: ['LECTURER'], status: 'Ended', displayOrder: 1, operationalPeriodId: 9, marksPeriodId: null });
  assert.equal(legacy.status, 'Ended');
  assert.equal(legacy.operationalPeriodId, 9);
  console.log('Timeline preview/confirmation API keeps the reviewed file, signed token, warning acknowledgement and selected semester.');
} finally { globalThis.fetch = originalFetch; }
