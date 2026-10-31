import assert from 'node:assert/strict';
import { ApiError, MAINTENANCE_EVENT, request } from './apiClient';
import { getMaintenance } from './maintenanceApi';

const previousFetch = globalThis.fetch;
const page = new EventTarget();
(globalThis as { window?: unknown }).window = page;
const turnedAway: unknown[] = [];
page.addEventListener(MAINTENANCE_EVENT, (event) => turnedAway.push((event as CustomEvent).detail));

const maintenance = { status: 'on', startsAt: '2026-10-31T14:00:00+00:00', expectedEnd: null, message: 'Moving to a new server.' };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const calls: string[] = [];

try {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (String(input) === '/api/maintenance/') return json(maintenance, 200);
    return json({ detail: 'The portal is under maintenance. Please try again later.', code: 'portal_maintenance', maintenance }, 503);
  }) as typeof fetch;

  assert.deepEqual(await getMaintenance(), maintenance);
  assert.deepEqual(calls, ['/api/maintenance/']);
  assert.deepEqual(turnedAway, [], 'reading the status is not being turned away');

  await assert.rejects(
    request('/auth/settings/'),
    (err: unknown) => err instanceof ApiError && err.status === 503 && /under maintenance/.test(err.message),
  );
  assert.deepEqual(turnedAway, [maintenance], 'the app hears that the portal is under maintenance');

  globalThis.fetch = (async () => new Response('Service Unavailable', { status: 503 })) as typeof fetch;
  await assert.rejects(getMaintenance(), /server is unavailable/);
  assert.equal(turnedAway.length, 1, 'a gateway error is not maintenance');
} finally {
  globalThis.fetch = previousFetch;
  delete (globalThis as { window?: unknown }).window;
}

console.log('Portal maintenance status call and the turned-away event passed');
