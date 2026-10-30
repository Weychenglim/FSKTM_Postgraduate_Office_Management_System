import assert from 'node:assert/strict';
import { ApiError, MAINTENANCE_EVENT } from './apiClient';
import { endMaintenance, getMaintenance, saveMaintenance } from './maintenanceApi';

const previousFetch = globalThis.fetch;
const page = new EventTarget();
(globalThis as { window?: unknown }).window = page;
const turnedAway: unknown[] = [];
page.addEventListener(MAINTENANCE_EVENT, (event) => turnedAway.push((event as CustomEvent).detail));

const maintenance = { status: 'on', startsAt: '2026-10-31T14:00:00+00:00', expectedEnd: null, message: 'Moving to a new server.' };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const calls: Array<{ url: string; init?: RequestInit }> = [];

try {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (String(input) === '/api/maintenance/') return json(maintenance, 200);
    return json({ detail: 'The portal is under maintenance. Only PG office staff can use it until it ends.', code: 'portal_maintenance', maintenance }, 503);
  }) as typeof fetch;

  assert.deepEqual(await getMaintenance(), maintenance);
  assert.deepEqual(turnedAway, [], 'reading the status is not being turned away');

  await assert.rejects(
    saveMaintenance({ startsAt: null, expectedEnd: null, message: 'Quick fix.' }),
    (err: unknown) => err instanceof ApiError && err.status === 503 && /only PG office staff/i.test(err.message),
  );
  assert.deepEqual(turnedAway, [maintenance], 'the app hears that the portal is under maintenance');
  assert.equal(calls[1].url, '/api/maintenance/manage/');
  assert.equal(calls[1].init?.method, 'PUT');
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { startsAt: null, expectedEnd: null, message: 'Quick fix.' });

  await assert.rejects(endMaintenance());
  assert.equal(calls[2].url, '/api/maintenance/manage/end/');
  assert.equal(calls[2].init?.method, 'POST');

  globalThis.fetch = (async () => new Response('Service Unavailable', { status: 503 })) as typeof fetch;
  await assert.rejects(getMaintenance(), /server is unavailable/);
  assert.equal(turnedAway.length, 2, 'a gateway error is not maintenance');
} finally {
  globalThis.fetch = previousFetch;
  delete (globalThis as { window?: unknown }).window;
}

console.log('Portal maintenance API calls and the turned-away event passed');
