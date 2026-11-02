import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProjectCourseCodes, serializeProjectCourseCodes, validateProjectCourseCodes } from './projectCourseCodes';

test('Existing stored codes remain readable without dropping historical values', () => {
  assert.deepEqual(parseProjectCourseCodes(' ABC1234, XYZ9000 '), ['ABC1234', 'XYZ9000']);
  assert.deepEqual(parseProjectCourseCodes(''), ['']);
  assert.equal(serializeProjectCourseCodes([' ABC1234 ', '', 'XYZ9000']), 'ABC1234, XYZ9000');
});

test('New submissions require exactly one nonblank project course code', () => {
  for (const entries of [[], [''], ['   ']]) assert.match(validateProjectCourseCodes(entries)!, /enter.*course code/i);
  for (const entries of [['ABC1234', 'XYZ9000'], ['ABC1234, XYZ9000'], ['ABC1234; XYZ9000'], ['ABC1234\nXYZ9000']]) assert.match(validateProjectCourseCodes(entries)!, /one.*course code/i);
  assert.equal(validateProjectCourseCodes([' ABC1234 ']), null);
  assert.equal(validateProjectCourseCodes(['A'.repeat(255)]), null);
  assert.match(validateProjectCourseCodes(['A'.repeat(256)])!, /255/);
});
