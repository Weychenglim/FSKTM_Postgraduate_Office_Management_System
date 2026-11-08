import assert from 'node:assert/strict';
import { toDateTimeLocalValue } from './marksProductionManagement';
import { malaysiaDeadline } from '../components/MarksCompletionWindows';
import { formatMalaysiaDate, formatMalaysiaDateTime, formatMalaysiaDateTimeCompact } from './malaysiaDateTime';

// Editing a stored instant must show Malaysia wall time on every device.
assert.equal(toDateTimeLocalValue('2026-10-01T04:00:00Z'), '2026-10-01T12:00');
assert.equal(toDateTimeLocalValue('2026-12-31T18:30:00Z'), '2027-01-01T02:30');
assert.equal(toDateTimeLocalValue('2026-10-01T12:00:00+08:00'), '2026-10-01T12:00');
assert.equal(toDateTimeLocalValue(null), '');
assert.equal(toDateTimeLocalValue('not-a-date'), '');
assert.equal(toDateTimeLocalValue('2026-10-01T12:00'), '');
assert.equal(formatMalaysiaDateTime(null), 'Not configured');
assert.equal(formatMalaysiaDateTime('not-a-date'), 'Invalid date');
assert.equal(formatMalaysiaDateTimeCompact('2026-11-02T05:03:00Z'), formatMalaysiaDateTimeCompact('2026-11-02T13:03:00+08:00'));
assert.match(formatMalaysiaDateTimeCompact('2026-11-02T05:03:00Z'), /01:03 pm/);
assert.doesNotMatch(formatMalaysiaDateTimeCompact('2026-11-02T05:03:00Z'), /UTC|Malaysia/);
assert.equal(formatMalaysiaDate('2026-10-04T16:40:08Z'), '05 Oct 2026');
assert.equal(formatMalaysiaDate('2026-10-05'), '05 Oct 2026');
assert.equal(formatMalaysiaDate('2026-12-31T18:30:00Z'), '01 Jan 2027');
assert.equal(formatMalaysiaDate('not-a-date'), 'Invalid date');
assert.equal(formatMalaysiaDate('2026-10-05T12:00'), 'Invalid date');
assert.match(formatMalaysiaDateTime('2026-10-01T04:00:00Z'), /12:00.*Malaysia, UTC\+08:00/);
for (const instant of ['2026-10-01T04:00:00.000Z', '2026-12-31T18:30:00.000Z']) {
  assert.equal(malaysiaDeadline(toDateTimeLocalValue(instant)), instant);
}
assert.equal(malaysiaDeadline('2028-02-29T00:15'), '2028-02-28T16:15:00.000Z');
for (const invalid of ['', '0000-10-01T12:00', '2026-02-29T12:00', '2026-04-31T12:00', '2026-13-01T12:00', '2026-10-01T24:00', '2026-10-01T12:60', '2026-10-01', '2026-10-01T12:00Z']) {
  assert.throws(() => malaysiaDeadline(invalid), /valid/);
}
console.log(`Malaysia deadline entry and edit round-trip passed (TZ=${process.env.TZ})`);
