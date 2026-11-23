import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateField, DateTimeField, TimeField } from '../components/DateFields';
import {
  addDays,
  addMonths,
  clampDate,
  dateLabel,
  fromClock,
  inRange,
  longDateLabel,
  monthGrid,
  monthTitle,
  normalTime,
  parseDate,
  timeLabel,
  toClock,
  todayInMalaysia,
  typedNumber,
  weekBounds,
} from './dateFields';

assert.deepEqual(parseDate('2026-11-12'), { year: 2026, month: 11, day: 12 });
assert.equal(parseDate('2026-02-30'), null);
assert.equal(parseDate(''), null);
assert.equal(dateLabel('2026-11-05'), '5 Nov 2026');
assert.equal(longDateLabel('2026-11-05'), '5 November 2026');
assert.equal(monthTitle('2026-11-05'), 'November 2026');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');
assert.equal(addDays('2026-03-01', -1), '2026-02-28');
assert.equal(addMonths('2026-01-31', 1), '2026-02-28', 'the day is kept inside the shorter month');
assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
assert.deepEqual(weekBounds('2026-11-12'), ['2026-11-09', '2026-11-15'], 'weeks start on Monday');
assert.equal(clampDate('2026-11-01', '2026-11-10'), '2026-11-10');
assert.equal(clampDate('2026-11-20', undefined, '2026-11-15'), '2026-11-15');
assert.ok(inRange('2026-11-12', '2026-11-12', '2026-11-12'));
assert.ok(!inRange('2026-11-11', '2026-11-12'));

const grid = monthGrid('2026-11-12');
assert.equal(grid.length, 42);
assert.equal(grid[0].iso, '2026-10-26', 'November 2026 starts on a Sunday, so the grid opens on Monday 26 October');
assert.equal(grid.find(cell => cell.inMonth)?.iso, '2026-11-01');
assert.equal(grid.filter(cell => cell.inMonth).length, 30);

assert.equal(timeLabel('00:00'), '12:00 AM');
assert.equal(timeLabel('12:30'), '12:30 PM');
assert.equal(timeLabel('23:59'), '11:59 PM');
assert.equal(timeLabel('09:05'), '9:05 AM');
assert.equal(normalTime('9:05'), '', 'times need two-digit hours');
assert.equal(normalTime('17:07:30'), '17:07', 'seconds are dropped');
assert.deepEqual(toClock('00:15'), { hour: 12, minute: 15, pm: false }, 'midnight is 12 AM');
assert.deepEqual(toClock('12:00'), { hour: 12, minute: 0, pm: true }, 'noon is 12 PM');
assert.deepEqual(toClock('23:59'), { hour: 11, minute: 59, pm: true });
assert.equal(toClock(''), null);
assert.equal(fromClock({ hour: 12, minute: 0, pm: false }), '00:00');
assert.equal(fromClock({ hour: 12, minute: 30, pm: true }), '12:30');
assert.equal(fromClock({ hour: 5, minute: 7, pm: true }), '17:07');
for (const time of ['00:00', '06:45', '12:00', '13:01', '23:59']) assert.equal(fromClock(toClock(time)!), time, `${time} survives the wheels`);

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
assert.deepEqual(typedNumber('', '1', HOURS), { typed: '1', value: 1, complete: false }, '1 may become 10, 11 or 12');
assert.deepEqual(typedNumber('1', '2', HOURS), { typed: '12', value: 12, complete: true });
assert.deepEqual(typedNumber('1', '5', HOURS), { typed: '5', value: 5, complete: true }, '15 is not an hour, so 5 starts again');
assert.deepEqual(typedNumber('', '0', HOURS), { typed: '0', value: null, complete: false });
assert.deepEqual(typedNumber('0', '9', HOURS), { typed: '09', value: 9, complete: true });
assert.deepEqual(typedNumber('', '4', MINUTES), { typed: '4', value: 4, complete: false });
assert.deepEqual(typedNumber('4', '5', MINUTES), { typed: '45', value: 45, complete: true });
assert.deepEqual(typedNumber('', '7', MINUTES), { typed: '7', value: 7, complete: true }, 'no minute starts with 7 and has two digits');
assert.match(todayInMalaysia(new Date('2026-11-12T17:30:00Z')), /^2026-11-13$/, 'today follows Malaysia time');

const date = renderToStaticMarkup(<DateField value="2026-11-12" onChange={() => {}} aria-label="Due date" />);
assert.match(date, /aria-haspopup="dialog"/);
assert.match(date, />12 Nov 2026</);
assert.doesNotMatch(date, /type="date"/);
assert.match(renderToStaticMarkup(<DateField value="" onChange={() => {}} placeholder="Any date" />), />Any date</);
assert.match(renderToStaticMarkup(<DateField value="" onChange={() => {}} required />), /required=""/, 'a required date still stops the form');
const time = renderToStaticMarkup(<TimeField value="23:59" onChange={() => {}} aria-label="Time" />);
assert.match(time, />11:59 PM</);
assert.match(time, /aria-haspopup="dialog"/, 'the time opens the wheel panel, not a long list');
assert.match(time, /data-value="23:59"/);
assert.doesNotMatch(time, /role="combobox"|type="time"/);
assert.match(renderToStaticMarkup(<TimeField value="" onChange={() => {}} />), />Choose a time</);
assert.match(renderToStaticMarkup(<TimeField value="" onChange={() => {}} required />), /required=""/, 'a required time still stops the form');
const both = renderToStaticMarkup(<DateTimeField label="Publish at" value="" onChange={() => {}} />);
assert.match(both, /aria-label="Publish at, date"/);
assert.match(both, /aria-label="Publish at, time"[^>]*disabled=""/, 'time waits for a date');
const filled = renderToStaticMarkup(<DateTimeField label="Closes at" value="2026-11-20T17:00" required describedBy="closes-error" onChange={() => {}} />);
assert.match(filled, />20 Nov 2026</);
assert.match(filled, />5:00 PM</);
assert.equal(filled.match(/aria-describedby="closes-error"/g)?.length, 2, 'both halves point at the error');
assert.equal(filled.match(/required=""/g)?.length, 2);

const pickerSource = readFileSync(resolve('src/components/DateFields.tsx'), 'utf8');
assert.doesNotMatch(pickerSource, /timeOptions|from '\.\/SelectMenu'/, 'no 15-minute list is left');

for (const file of ['SubmissionsBoard', 'IssuedLetters', 'FileRepository', 'CoordinatorDelegations', 'RecordGraduations', 'StudentStatusActions', 'AnnouncementManagement']) {
  const source = readFileSync(resolve(`src/components/${file}.tsx`), 'utf8');
  assert.doesNotMatch(source, /type="(date|time|datetime-local)"/, `${file} still uses the browser's date or time box`);
}
for (const file of ['SubmissionScheduleField', 'MarkEntryPeriodConfig', 'MarksCompletionWindows', 'OperationalPeriodManagement']) {
  const source = readFileSync(resolve(`src/components/${file}.tsx`), 'utf8');
  assert.doesNotMatch(source, /type="(time|datetime-local)"|'datetime-local'/, `${file} still uses the browser's time box`);
}

console.log('Date and time field checks passed.');
