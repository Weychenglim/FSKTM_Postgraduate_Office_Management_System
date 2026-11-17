import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOAST_MS, toastDuration } from './toastDuration';

assert.equal(toastDuration(), TOAST_MS);
assert.equal(toastDuration('success'), TOAST_MS);
assert.equal(toastDuration('info'), TOAST_MS);
assert.equal(toastDuration('warning'), undefined);
assert.equal(toastDuration('danger'), undefined);

const screens = [
  'DocumentPage', 'FaqDocumentsTab', 'FaqEntryPage', 'ProgrammeRules', 'ProjectStages',
  'StaffAccountPage', 'StudentFileSubmission', 'StudentProjectStageCard', 'SubmissionsBoard',
];
for (const screen of screens) {
  const source = readFileSync(resolve(import.meta.dirname, `../components/${screen}.tsx`), 'utf8');
  const toasts = source.split('\n').filter(line => line.includes('<PortalToast'));
  assert.ok(toasts.length > 0, `${screen} shows a popup`);
  for (const toast of toasts) assert.match(toast, /durationMs=\{toastDuration\(/, `${screen} popup closes by itself`);
}
console.log('Success and info popups close after 4 seconds; warnings and errors stay');
