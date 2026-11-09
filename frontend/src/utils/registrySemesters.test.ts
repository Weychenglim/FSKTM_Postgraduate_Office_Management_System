import assert from 'node:assert/strict';
import type { StudentSemesters } from '../services/registrySemestersApi';
import { APP_ROUTES } from '../constants/routes';
import { canonicalSemester, filterPeople, findStudents, fixLink, intakeFilterOptions, intakeNotice, matchesIntake, NO_INTAKE, OUTCOME_OPTIONS, OUTCOME_TONE, semesterChoices, semesterParts, maximumNotice, semesterCount, semesterMovedNotice, semesterMoveWaiting, shortSemester, studentCount, validSession, shortProgramme } from './registrySemesters';

assert.equal(semesterCount(1), '1 semester');
assert.equal(semesterCount(3), '3 semesters');
assert.equal(studentCount(1), '1 student');
assert.equal(studentCount(118), '118 students');

assert.ok(validSession('2026/2027'));
assert.ok(validSession(' 2026/2027 '));
assert.ok(!validSession('2026/2028'));
assert.ok(!validSession('2026'));
assert.ok(!validSession(''));


const progress = (change: Partial<StudentSemesters>): StudentSemesters => ({
  warnings: [],
  matric: 'M1', studied: 3, minimum: 3, maximum: 8, specialCounts: true, hasRule: true, hasRecord: true, shortOfMinimum: 0,
  maximumSemester: 'Semester II, 2029/2030 Session', currentSemester: '', lastSemester: false, pastMaximum: false, intake: '', beforeIntake: [], startsAfterIntake: false,
  extensionSemesters: 0, extensionReason: '', rows: [], ...change,
});
assert.equal(maximumNotice(progress({})), null);
assert.equal(maximumNotice(progress({ lastSemester: true }))?.tone, 'amber');
assert.equal(maximumNotice(progress({ pastMaximum: true }))?.tone, 'rose');
assert.match(maximumNotice(progress({ pastMaximum: true }))?.text ?? '', /Semester II, 2029\/2030/);

assert.equal(APP_ROUTES.registryProgrammes, '/registry/programmes');
assert.equal(APP_ROUTES.registryUpdateSemester, '/registry/update-semester');
assert.equal(APP_ROUTES.registryGraduations, '/registry/graduations');

assert.equal(shortSemester('Semester II, 2026/2027 Session'), 'Semester II, 2026/2027');
const found = [{ name: 'Aisyah binti Rahman', matric: '26990001' }, { name: 'Lim Wei Jie', matric: '26990002' }];
assert.deepEqual(findStudents(found, ''), []);
assert.deepEqual(findStudents(found, 'aisyah').map(row => row.matric), ['26990001']);
assert.deepEqual(findStudents(found, '0002').map(row => row.name), ['Lim Wei Jie']);
assert.equal(semesterMoveWaiting(null), false);
assert.equal(semesterMoveWaiting({ semester: null, waiting: 3, lastMove: null }), false);
assert.equal(semesterMoveWaiting({ semester: {}, waiting: 0, lastMove: null }), false);
assert.equal(semesterMoveWaiting({ semester: {}, waiting: 3, lastMove: {} }), true);
assert.equal(semesterMoveWaiting({ semester: {}, waiting: 3, lastMove: null }), true);
assert.equal(semesterMoveWaiting({ semester: { isSpecial: true }, waiting: 3, lastMove: null }), true);
assert.equal(semesterMoveWaiting({ semester: { isSpecial: true }, waiting: 3, lastMove: {} }), false);

const automatic = { at: '2026-11-01T00:00:00Z', moved: 83, backFromLeave: 3, automatic: true };
const movedOn = { label: 'Semester II, 2026/2027 Session' };
const soon = new Date('2026-11-05T00:00:00Z');
assert.equal(semesterMovedNotice({ semester: movedOn, lastMove: automatic }, soon), '83 students moved to Semester II, 2026/2027. 3 back from leave.');
assert.equal(semesterMovedNotice({ semester: movedOn, lastMove: { ...automatic, backFromLeave: 0 } }, soon), '83 students moved to Semester II, 2026/2027.');
assert.equal(semesterMovedNotice({ semester: movedOn, lastMove: { ...automatic, automatic: false } }, soon), null);
assert.equal(semesterMovedNotice({ semester: movedOn, lastMove: automatic }, new Date('2026-11-16T00:00:00Z')), null);
assert.equal(semesterMovedNotice({ semester: null, lastMove: automatic }, soon), null);
assert.equal(semesterMovedNotice(null), null);
assert.equal(OUTCOME_OPTIONS.some(option => option.value === 'NOT_REGISTERED'), true);
assert.equal(OUTCOME_TONE.NOT_REGISTERED, 'danger');

assert.deepEqual(fixLink({ fix: 'record', recordId: null }, 'A/1'), { label: 'Open record', to: '/registry?student=A%2F1' });
assert.deepEqual(fixLink({ fix: 'transfer', recordId: 7 }, 'M1'), { label: 'Open request', to: '/supervisor-appointments/research-changes/7' });
assert.equal(fixLink({ fix: 'transfer', recordId: null }, 'M1'), null);
assert.equal(fixLink({ fix: '', recordId: null }, 'M1'), null);
assert.equal(fixLink({ fix: 'marks', recordId: null }, 'M1')?.to, APP_ROUTES.marks);
assert.equal(fixLink({ fix: 'documents', recordId: null }, 'M1')?.to, '/files?student=M1');

assert.equal(canonicalSemester('2024/2025 Semester 1'), '2024/2025 Semester I');
assert.equal(canonicalSemester('Semester II, 2026/2027 Session'), '2026/2027 Semester II');
assert.equal(canonicalSemester('Semester III, 2024/2025'), '2024/2025 Special Semester');
assert.equal(canonicalSemester('Special Semester, 2024/2025'), '2024/2025 Special Semester');
assert.equal(canonicalSemester(' next year '), 'next year');
assert.equal(canonicalSemester('2024/2026 Semester I'), '2024/2026 Semester I');

const choices = semesterChoices({ now: new Date('2026-11-02') });
assert.equal(choices[0].value, '2027/2028 Semester II');
assert.equal(choices[1].value, '2027/2028 Semester I');
assert.equal(choices.at(-1)?.value, '2018/2019 Semester I');
assert.ok(!choices.some(choice => choice.value.includes('Special')));
assert.ok(semesterChoices({ special: true, now: new Date('2026-11-02') }).some(choice => choice.value === '2026/2027 Special Semester'));
assert.equal(semesterChoices({ keep: '2001/2002 Semester I', now: new Date('2026-11-02') }).at(-1)?.value, '2001/2002 Semester I');
assert.equal(semesterChoices({ keep: '2026/2027 Semester I', now: new Date('2026-11-02') }).length, choices.length);

assert.deepEqual(semesterParts('Semester II, 2026/2027 Session'), { session: '2026/2027', term: 'SEMESTER_II' });
assert.deepEqual(semesterParts('2026/2027 Special Semester'), { session: '2026/2027', term: 'SPECIAL' });
assert.equal(semesterParts('soon'), null);

assert.deepEqual(
  intakeFilterOptions(['Semester I, 2024/2025 Session', '', 'Semester II, 2026/2027 Session', 'Semester I, 2026/2027 Session', 'Semester I, 2024/2025 Session']).map(option => option.label),
  ['Semester II, 2026/2027', 'Semester I, 2026/2027', 'Semester I, 2024/2025', 'No intake recorded'],
);
assert.deepEqual(intakeFilterOptions(['Semester I, 2024/2025 Session']).map(option => option.value), ['Semester I, 2024/2025 Session']);
assert.equal(matchesIntake('A', 'All'), true);
assert.equal(matchesIntake('A', 'A'), true);
assert.equal(matchesIntake('A', 'B'), false);
assert.equal(matchesIntake('', NO_INTAKE), true);
assert.equal(matchesIntake('A', NO_INTAKE), false);

const people = [
  { name: 'Aisyah', matric: '1', programme: 'DS', intake: 'Semester I, 2026/2027 Session' },
  { name: 'Lim', matric: '2', programme: 'CS', intake: 'Semester II, 2026/2027 Session' },
  { name: 'Tan', matric: '3', programme: 'DS', intake: 'Semester II, 2026/2027 Session' },
];
const names = (filters: { programme?: string; intake?: string; query?: string }) =>
  filterPeople(people, { programme: 'All', intake: 'All', query: '', ...filters }).map(person => person.name);
assert.deepEqual(names({}), ['Aisyah', 'Lim', 'Tan']);
assert.deepEqual(names({ programme: 'DS' }), ['Aisyah', 'Tan']);
assert.deepEqual(names({ intake: 'Semester II, 2026/2027 Session' }), ['Lim', 'Tan']);
assert.deepEqual(names({ programme: 'DS', intake: 'Semester II, 2026/2027 Session' }), ['Tan']);
assert.deepEqual(names({ query: 'lim' }), ['Lim']);
assert.deepEqual(names({ programme: 'DS', query: 'lim' }), []);

assert.equal(intakeNotice({ intake: 'Semester I, 2026/2027 Session', beforeIntake: [], startsAfterIntake: false }), null);
assert.match(intakeNotice({ intake: 'Semester I, 2026/2027 Session', beforeIntake: ['Semester II, 2025/2026 Session'], startsAfterIntake: false })?.text ?? '', /Semester II, 2025\/2026 is before the intake/);
assert.match(intakeNotice({ intake: 'Semester I, 2025/2026 Session', beforeIntake: [], startsAfterIntake: true })?.text ?? '', /start later/);

console.log('registry semester helper tests passed');

assert.equal(shortProgramme('MASTER OF DATA SCIENCE (COURSEWORK)'), 'Data Science');
assert.equal(shortProgramme('Master of Computer Science (By Coursework)'), 'Computer Science');
assert.equal(shortProgramme('MASTER OF SCIENCE AND TECHNOLOGY'), 'Science and Technology');
