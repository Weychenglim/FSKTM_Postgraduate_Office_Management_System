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
  inRange,
  longDateLabel,
  monthGrid,
  monthTitle,
  parseDate,
  timeLabel,
  timeOptions,
  todayInMalaysia,
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
const times = timeOptions(15);
assert.equal(times.length, 97, '96 quarter hours plus 11:59 PM');
assert.equal(times[times.length - 1].value, '23:59');
assert.ok(timeOptions(15, '17:07').some(option => option.value === '17:07'), 'an existing odd time stays choosable');
assert.match(todayInMalaysia(new Date('2026-11-12T17:30:00Z')), /^2026-11-13$/, 'today follows Malaysia time');

const date = renderToStaticMarkup(<DateField value="2026-11-12" onChange={() => {}} aria-label="Due date" />);
assert.match(date, /aria-haspopup="dialog"/);
assert.match(date, />12 Nov 2026</);
assert.doesNotMatch(date, /type="date"/);
assert.match(renderToStaticMarkup(<DateField value="" onChange={() => {}} placeholder="Any date" />), />Any date</);
assert.match(renderToStaticMarkup(<DateField value="" onChange={() => {}} required />), /required=""/, 'a required date still stops the form');
const time = renderToStaticMarkup(<TimeField value="23:59" onChange={() => {}} aria-label="Time" />);
assert.match(time, />11:59 PM</);
assert.match(time, /role="combobox"/);
const both = renderToStaticMarkup(<DateTimeField label="Publish at" value="" onChange={() => {}} />);
assert.match(both, /aria-label="Publish at, date"/);
assert.match(both, /aria-label="Publish at, time"[^>]*disabled=""/, 'time waits for a date');

for (const file of ['SubmissionsBoard', 'IssuedLetters', 'FileRepository', 'CoordinatorDelegations', 'RecordGraduations', 'StudentStatusActions', 'AnnouncementManagement']) {
  const source = readFileSync(resolve(`src/components/${file}.tsx`), 'utf8');
  assert.doesNotMatch(source, /type="(date|time|datetime-local)"/, `${file} still uses the browser's date or time box`);
}

console.log('Date and time field checks passed.');
