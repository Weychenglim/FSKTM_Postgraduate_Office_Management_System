import assert from 'node:assert/strict';

import { createQuickLogins } from './quickLogins';

const rows = [
  { course: '', role: 'Office Staff', name: 'Office', email: 'office@example.test', password: 'p1' },
  { course: 'Data Science', role: 'Coordinator', name: 'Coord DS', email: 'coord.ds@example.test', password: 'p2' },
  { course: 'Data Science', role: 'Student', name: 'Student DS', email: 'student.ds@example.test', password: 'p3' },
  { course: 'Cyber Security', role: 'Lecturer', name: 'Lect CS', email: 'lect.cs@example.test', password: 'p4' },
  { course: 'Cyber Security', role: 'Student', name: 'No password', email: 'nopass@example.test', password: '' },
];
const environment = { DEV: true, VITE_ENABLE_DEMO_LOGIN: 'true', VITE_QUICK_LOGINS: JSON.stringify(rows) };

assert.equal(createQuickLogins({ ...environment, DEV: false }), null, 'Never outside development');
assert.equal(createQuickLogins({ ...environment, VITE_ENABLE_DEMO_LOGIN: 'false' }), null);
assert.equal(createQuickLogins({ ...environment, VITE_QUICK_LOGINS: '' }), null, 'No list, no panel');
assert.equal(createQuickLogins({ ...environment, VITE_QUICK_LOGINS: 'not json' }), null);
assert.equal(createQuickLogins({ ...environment, VITE_QUICK_LOGINS: '{}' }), null);

const groups = createQuickLogins(environment);
assert.ok(groups);
assert.deepEqual(groups.map(group => [group.course, group.logins.map(login => login.role)]), [
  ['', ['Office Staff']],
  ['Data Science', ['Coordinator', 'Student']],
  ['Cyber Security', ['Lecturer']],
], 'Grouped by course in the order given, and rows without a password are skipped');
assert.equal(groups[1].logins[0].password, 'p2');

console.log('quick login configuration tests passed');
