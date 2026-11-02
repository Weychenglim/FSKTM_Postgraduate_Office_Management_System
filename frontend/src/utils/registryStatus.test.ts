import assert from 'node:assert/strict';

import type { StudentRecord } from '../types';
import { describeBlockers, distinctValues, inRegistryView, registryViewOptions, studentStatusOptions, summariseRegistry } from './registryStatus';

assert.deepEqual(studentStatusOptions('Active'), ['Deferred', 'Graduated', 'Withdrawn']);
assert.deepEqual(studentStatusOptions('Deferred'), ['Active', 'Withdrawn']);
assert.deepEqual(studentStatusOptions('Graduated'), []);
assert.deepEqual(studentStatusOptions('Withdrawn'), []);

assert.deepEqual(
  describeBlockers({
    pendingSupervisorApplications: 2,
    pendingPanelRecommendations: 0,
    unfinishedMarksTasks: 1,
    pendingCoSupervisorNominations: undefined,
  }),
  ['Pending supervisor applications: 2', 'Unfinished marks tasks: 1'],
);
assert.deepEqual(describeBlockers({}), []);

const record = (overrides: Partial<StudentRecord>): StudentRecord => ({
  id: 'WGA1', name: 'Student', avatarText: 'ST', avatarBg: '', programme: '', academicStatus: 'Active',
  accountStatus: 'Verified', semester: '', email: '', phone: '', supervisor: '', intakeDate: '',
  ...overrides,
});

assert.deepEqual(
  summariseRegistry([
    record({ academicStatus: 'Active', activated: false }),
    record({ academicStatus: 'Active', activated: true }),
    record({ academicStatus: 'Deferred' }),
    record({ academicStatus: 'Graduated' }),
    record({ academicStatus: 'Withdrawn', activated: false }),
  ]),
  { total: 5, active: 2, deferred: 1, graduated: 1, withdrawn: 1, awaitingActivation: 2, nearMaximum: 0 },
);
const noStudents = summariseRegistry([]);
assert.deepEqual(noStudents, { total: 0, active: 0, deferred: 0, graduated: 0, withdrawn: 0, awaitingActivation: 0, nearMaximum: 0 });

const names = (summary: ReturnType<typeof summariseRegistry>, selected: Parameters<typeof registryViewOptions>[1], office = true) =>
  registryViewOptions(summary, selected, office).map(({ view }) => view);
const mixed = summariseRegistry([
  record({ academicStatus: 'Active', activated: false, maximumFlag: 'last' }),
  record({ academicStatus: 'Active', activated: true }),
]);
assert.deepEqual(names(noStudents, 'All'), ['All'], 'empty statuses stay hidden');
assert.deepEqual(names(mixed, 'All'), ['All', 'Active', 'Awaiting activation', 'Near maximum']);
assert.deepEqual(names(mixed, 'All', false), ['All', 'Active', 'Awaiting activation'], 'near maximum is for the office');
assert.deepEqual(names(noStudents, 'Deferred'), ['All', 'Deferred'], 'the chosen status stays visible at zero');

assert.equal(inRegistryView(record({ academicStatus: 'Graduated' }), 'All'), true);
assert.equal(inRegistryView(record({ academicStatus: 'Graduated' }), 'Graduated'), true);
assert.equal(inRegistryView(record({ academicStatus: 'Active' }), 'Graduated'), false);
assert.equal(inRegistryView(record({ activated: false }), 'Awaiting activation'), true);
assert.equal(inRegistryView(record({ activated: true }), 'Awaiting activation'), false);
assert.equal(inRegistryView(record({ maximumFlag: 'past' }), 'Near maximum'), true);
assert.equal(inRegistryView(record({}), 'Near maximum'), false);

assert.deepEqual(distinctValues(['Dr B', '', ' Dr A ', 'Dr B']), ['Dr A', 'Dr B']);

console.log('Registry status helper tests passed.');
