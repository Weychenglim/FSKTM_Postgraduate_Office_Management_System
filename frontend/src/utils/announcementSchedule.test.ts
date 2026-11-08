import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { announcementForm, getAnnouncementRecipientCount } from '../services/announcementsApi';
import { formatScheduleMoment, isScheduledFor, scheduleTime } from './announcementSchedule';

const now = new Date('2026-10-11T04:00:00.000Z'); // 12:00 noon in Malaysia

// form values are Malaysia wall time, whatever the device's zone
assert.equal(scheduleTime(''), null);
assert.equal(scheduleTime('2026-10-12T09:00'), '2026-10-12T01:00:00.000Z');
assert.throws(() => scheduleTime('2026-13-40T09:00'));

assert.equal(isScheduledFor('', now), false);
assert.equal(isScheduledFor('2026-10-11T12:30', now), true);
assert.equal(isScheduledFor('2026-10-11T11:30', now), false);
assert.equal(isScheduledFor('not a date', now), false);

assert.equal(formatScheduleMoment('2026-10-12T09:00:00+08:00'), '12 Oct 2026, 9:00 am');
assert.equal(formatScheduleMoment('2026-10-12T13:30:00Z'), '12 Oct 2026, 9:30 pm');
assert.equal(formatScheduleMoment(null), '');

// the multipart form sends the schedule and the lists the server expects
const form = announcementForm({
  title: 'Briefing',
  content: 'Body',
  target: 'All Students',
  priority: 'Info',
  status: 'Active',
  publishAt: null,
  expiresAt: '2026-10-13T01:00:00.000Z',
  targetProgrammes: ['MASTER OF DATA SCIENCE (COURSEWORK)'],
  targetIntakes: [],
});
assert.equal(form.get('publishAt'), '');
assert.equal(form.get('expiresAt'), '2026-10-13T01:00:00.000Z');
assert.equal(form.get('targetProgrammes'), '["MASTER OF DATA SCIENCE (COURSEWORK)"]');
assert.equal(form.get('targetIntakes'), '[]');
const quick = announcementForm({ title: 'T', content: 'C', target: 'All', priority: 'Info', status: 'Active' });
for (const field of ['publishAt', 'expiresAt', 'targetProgrammes', 'targetIntakes']) {
  assert.equal(quick.has(field), false, `${field} is left alone when not given`);
}

// the recipient preview asks with repeated programme and intake parameters
const originalFetch = globalThis.fetch;
let requested = '';
globalThis.fetch = (async (input: RequestInfo | URL) => {
  requested = String(input);
  return new Response('{"recipients": 4}', { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;
try {
  const count = await getAnnouncementRecipientCount({
    target: 'All Students',
    audiences: ['All Students', 'Lecturers'],
    priority: 'Urgent',
    targetProgrammes: ['A', 'B'],
    targetIntakes: ['Semester 1 2025/2026'],
  });
  assert.equal(count, 4);
} finally {
  globalThis.fetch = originalFetch;
}
const query = new URL(requested, 'http://portal.test').searchParams;
assert.equal(new URL(requested, 'http://portal.test').pathname, '/api/announcements/recipient-count/');
assert.equal(query.get('target'), 'All Students');
assert.deepEqual(query.getAll('audiences'), ['All Students', 'Lecturers']);
assert.equal(query.get('priority'), 'Urgent');
assert.deepEqual(query.getAll('programmes'), ['A', 'B']);
assert.deepEqual(query.getAll('intakes'), ['Semester 1 2025/2026']);

// the composer offers a publish time but no expiry, and saving clears an old one
const composer = readFileSync(resolve('src/components/AnnouncementManagement.tsx'), 'utf8');
assert.match(composer, /id="announcement-publish-at"/);
assert.doesNotMatch(composer, /id="announcement-expires-at"/);
assert.equal(composer.match(/expiresAt: null/g)?.length, 2, 'saving and publishing a draft both clear the expiry');
assert.match(composer, /getAnnouncementRecipientCount\(/);
assert.match(composer, /getAnnouncementAudienceOptions\(\)/);

console.log('Announcement schedule tests passed.');
