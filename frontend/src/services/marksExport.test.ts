import assert from 'node:assert/strict';
import { getMarksExport } from './marksApi';

const original = globalThis.fetch;
const calls: RequestInit[] = [];
globalThis.fetch = async (input, init) => {
  assert.equal(String(input), '/api/marks/export/');
  calls.push(init!);
  return new Response(new Blob(['workbook']), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
};
try {
  const ids = Array.from({ length: 12 }, (_, index) => `MRK-${index + 1}`);
  const blob = await getMarksExport(ids, 'Semester I; All programmes');
  assert.equal(await blob.text(), 'workbook');
  assert.equal(calls[0].method, 'POST');
  assert.equal(new Headers(calls[0].headers).get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(calls[0].body as string), { recordIds: ids, scope: 'Semester I; All programmes' });
  console.log('Marks export sends the complete filtered selection and returns the workbook.');
} finally {
  globalThis.fetch = original;
}
