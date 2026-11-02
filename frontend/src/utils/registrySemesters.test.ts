import assert from 'node:assert/strict';
import type { StudentSemesters } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { maximumNotice, parseMatricList, semesterCount, studentCount, validSession } from './registrySemesters';

assert.equal(semesterCount(1), '1 semester');
assert.equal(semesterCount(3), '3 semesters');
assert.equal(studentCount(1), '1 student');
assert.equal(studentCount(118), '118 students');

assert.ok(validSession('2026/2027'));
assert.ok(validSession(' 2026/2027 '));
assert.ok(!validSession('2026/2028'));
assert.ok(!validSession('2026'));
assert.ok(!validSession(''));

assert.deepEqual(parseMatricList(''), []);
assert.deepEqual(parseMatricList('25990011\n25990012\t25990013, 25990014'), ['25990011', '25990012', '25990013', '25990014']);
assert.deepEqual(parseMatricList('25990011 25990011 DEMO-STUDENT-003 demo-student-003'), ['25990011', 'DEMO-STUDENT-003']);

const progress = (change: Partial<StudentSemesters>): StudentSemesters => ({
  matric: 'M1', studied: 3, minimum: 3, maximum: 8, specialCounts: true, hasRule: true, hasRecord: true, shortOfMinimum: 0,
  maximumSemester: 'Semester II, 2029/2030 Session', currentSemester: '', lastSemester: false, pastMaximum: false,
  extensionSemesters: 0, extensionReason: '', rows: [], ...change,
});
assert.equal(maximumNotice(progress({})), null);
assert.equal(maximumNotice(progress({ lastSemester: true }))?.tone, 'amber');
assert.equal(maximumNotice(progress({ pastMaximum: true }))?.tone, 'rose');
assert.match(maximumNotice(progress({ pastMaximum: true }))?.text ?? '', /Semester II, 2029\/2030/);

assert.equal(APP_ROUTES.registryProgrammes, '/registry/programmes');
assert.equal(APP_ROUTES.registryMoveStudents, '/registry/move-students');
assert.equal(APP_ROUTES.registryGraduate, '/registry/graduate');

console.log('registry semester helper tests passed');
