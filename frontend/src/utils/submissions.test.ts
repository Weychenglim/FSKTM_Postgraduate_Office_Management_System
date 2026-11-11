import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { routeForNotificationTarget } from '../constants/routes';
import { afterDueText, csvName, defaultDueDate, durationText, fromMalaysia, malaysiaParts, sentText, submissionCsv, timeLeftText } from './submissions';

assert.equal(durationText(0), 'less than a minute');
assert.equal(durationText(59), 'less than a minute');
assert.equal(durationText(60), '1 minute');
assert.equal(durationText(59 * 60), '59 minutes');
assert.equal(durationText(3600), '1 hour');
assert.equal(durationText(3600 + 5 * 60), '1 hour 5 minutes');
assert.equal(durationText(97200), '1 day 3 hours');
assert.equal(durationText(2 * 86400), '2 days');
assert.equal(durationText(-5), 'less than a minute');

const now = Date.parse('2027-01-08T12:00:00+08:00');
assert.equal(timeLeftText('2027-01-09T23:59:00+08:00', now), '1 day 11 hours left');
assert.equal(timeLeftText('2027-01-08T11:00:00+08:00', now), 'Due date passed');

assert.equal(fromMalaysia('2027-01-09', '23:59'), '2027-01-09T23:59:00+08:00');
assert.equal(fromMalaysia('2027-01-09', ''), '2027-01-09T23:59:00+08:00');
assert.deepEqual(malaysiaParts('2027-01-09T15:59:00Z'), { date: '2027-01-09', time: '23:59' });
assert.deepEqual(malaysiaParts('2027-01-09T16:00:00Z'), { date: '2027-01-10', time: '00:00' });
assert.deepEqual(malaysiaParts(null), { date: '', time: '23:59' });
assert.equal(defaultDueDate(now), '2027-01-15');

assert.equal(afterDueText({ afterDue: 'CLOSE', lateUntil: null }), 'Closes at the due date');
assert.equal(afterDueText({ afterDue: 'ACCEPT_LATE', lateUntil: null }), 'Late work accepted');
assert.match(afterDueText({ afterDue: 'ACCEPT_LATE', lateUntil: '2027-01-11T23:59:00+08:00' }), /^Late work until 11 Jan 2027/);

assert.equal(sentText(null, null), 'Not sent');
assert.match(sentText('2027-01-08T22:42:00+08:00', null), /^Sent 8 Jan 2027, 22:42, on time$/);
assert.match(sentText('2027-01-11T09:05:00+08:00', 97200), /, 1 day 3 hours late$/);

const csv = submissionCsv({ students: [
  { matric: 'S1', name: 'Tan, Ali "Junior"', programme: 'MASTER OF DATA SCIENCE (COURSEWORK)', state: 'LATE', expected: true, dueAt: '2027-01-09T23:59:00+08:00', sentAt: '2027-01-11T09:05:00+08:00', firstSentAt: null, lateBySeconds: 97200, documentId: 1, extension: null },
] });
assert.equal(csv.split('\n')[0], 'Matric,Name,Programme,Status,Sent at,Late by,Due,Extension reason');
assert.match(csv.split('\n')[1], /^S1,"Tan, Ali ""Junior""",MASTER OF DATA SCIENCE \(COURSEWORK\),Late,.*,1 day 3 hours,/);
assert.equal(csvName('RP2 final report!'), 'RP2-final-report.csv');

assert.equal(routeForNotificationTarget({ targetModule: 'FILES', recordType: 'SUBMISSION', recordId: '3' } as never), '/files');

const repository = readFileSync(resolve('src/components/FileRepository.tsx'), 'utf8');
const studentPage = readFileSync(resolve('src/components/StudentFileSubmission.tsx'), 'utf8');
assert.match(repository, /options\?\.canSeeSubmissions \? \[\{ value: 'submissions' as const, label: 'Submissions'/);
assert.match(repository, /filters\.view === 'submissions' && !filters\.student \? \(\s*<SubmissionsBoard \/>/);
assert.match(studentPage, /documentSlots\(options\.types, options\.me\?\.stage \?\? '', files, submissions, serverNow\)/);
assert.match(studentPage, /await sendSubmission\(target\.slot\.submission\.id, file\)/, 'A row with a due date sends to its submission');

console.log('Submission checks passed.');
