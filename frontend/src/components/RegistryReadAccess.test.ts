import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canAccessModule } from '../auth/permissions';
import { SIDEBAR_ITEMS } from '../constants/navigation';

const registry = readFileSync(resolve('src/components/StudentRegistry.tsx'), 'utf8');
const app = readFileSync(resolve('src/App.tsx'), 'utf8');

assert.equal(canAccessModule('Lecturer', SIDEBAR_ITEMS.REGISTRY), true);
assert.equal(canAccessModule('Programme Coordinator', SIDEBAR_ITEMS.REGISTRY), true);
assert.equal(canAccessModule('Student', SIDEBAR_ITEMS.REGISTRY), false);
assert.match(app, /readOnly=\{currentUser\.role !== 'Office Staff\/Admin'\}/);

for (const guarded of [
  /\{!readOnly && \(\s*<PortalButton[\s\S]{0,600}Register New Students/,
  /\{!readOnly && \(\s*<StudentStatusActions/,
  /\{!readOnly && viewingStudent\.accountStatus === 'Verified' && \(/,
  /\{!readOnly && viewingStudent\.accountStatus === 'Suspended' && \(/,
  /currentView === 'register' && !readOnly/,
]) {
  assert.match(registry, guarded, `write action is not hidden from read-only users: ${guarded}`);
}

assert.match(registry, /summariseRegistry\(students\)/);
assert.match(registry, /value: NO_SUPERVISOR, label: 'No supervisor yet'/);
for (const fabricated of [
  '1248 +',
  '982 +',
  'inactiveStudentsMetric = 145',
  '39 +',
  'Wey Cheng',
  'Graduation Thesis Submission Logged',
  'PhD (CS)',
  'Master (SE)',
  '"25/2026"',
  'Intake Semester 1 2025',
]) {
  assert.ok(!registry.includes(fabricated), `fabricated registry content returned: ${fabricated}`);
}

console.log('Registry read access and content checks passed.');
