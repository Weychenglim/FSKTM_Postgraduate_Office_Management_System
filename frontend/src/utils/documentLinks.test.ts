import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { archiveWarnings, submissionDueLine } from './documentDisplay';

const open = { title: 'RP2 final report', dueAt: '2026-11-20T15:59:00+00:00', open: true, student: 'Bella Tan' };
const closed = { ...open, title: 'P1 report', open: false };

assert.equal(submissionDueLine(open), ', due 20 Nov 2026, 23:59');
assert.equal(submissionDueLine(closed), ', due 20 Nov 2026, 23:59 (closed)');

assert.deepEqual(archiveWarnings(undefined), []);
assert.deepEqual(archiveWarnings([]), []);
assert.deepEqual(archiveWarnings([open, closed]), [
  'This file was sent for "RP2 final report", due 20 Nov 2026, 23:59. Bella Tan keeps the sent time and can send a new file before the due date.',
  'This file was sent for "P1 report", which is closed. Bella Tan keeps the sent time.',
]);

const dialogs = readFileSync(resolve(import.meta.dirname, '../components/DocumentDialogs.tsx'), 'utf8');
assert.match(dialogs, /const warnings = archiveWarnings\(document\.submissions\);/);
assert.match(dialogs, /warnings\.length > 0 && \(\s*<div role="alert"/);

const page = readFileSync(resolve(import.meta.dirname, '../components/DocumentPage.tsx'), 'utf8');
assert.match(page, /document\.submissions\.length > 0 &&/);
assert.match(page, /Sent for/);

console.log('A file shows the submission it was sent for, and archiving it warns what happens to the student');
