import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./MarkEntryDetail.tsx', import.meta.url), 'utf8');

test('submission validation is shown in the shared toast instead of the total footer', () => {
  assert.match(source, /message=\{showValidation && errors\.length > 0 \? `Complete required marks: \$\{errors\.join\(' '\)\}` : saveFeedback\?\.message \?\? null\}/);
  assert.match(source, /onClose=\{\(\) => \{setShowValidation\(false\); setSaveFeedback\(null\);\}\}/);
  assert.doesNotMatch(source, /Complete the required marks/);
});
