import assert from 'node:assert/strict';
import type { EvaluationTask } from '../types/marks';
import { initialMarkingRole, orderMarkingTasks, tasksForMarkingRole } from './lecturerMarking';

const task = (id: number, evaluatorRole: EvaluationTask['evaluatorRole'], status: EvaluationTask['status'] = 'NOT STARTED', dueAt?: string): EvaluationTask => ({
  id, evaluatorRole, status, dueAt, studentId: 'PG001', studentName: 'Same student', initials: 'SS',
  researchTitle: 'Research', semester: 'Semester I', deadline: '-', components: [],
});
const supervisor = task(1, 'SUPERVISOR');
const secondPeriod = { ...supervisor, id: 2, semester: 'Semester II' };
const panel = task(3, 'PANEL');
const legacy = task(5, undefined);
const tasks = [supervisor, secondPeriod, panel, legacy];
assert.deepEqual(tasksForMarkingRole(tasks, 'SUPERVISOR'), [supervisor, secondPeriod], 'Keep separate period tasks even for the same student');
assert.deepEqual(tasksForMarkingRole(tasks, 'PANEL'), [panel, legacy], 'Panel scope includes older payloads but never supervisor assignments');
assert.equal(initialMarkingRole([panel], null), 'PANEL');
assert.equal(initialMarkingRole(tasks, 'PANEL'), 'PANEL');
assert.equal(initialMarkingRole([], 'PANEL'), 'PANEL', 'Remember an explicitly selected empty workspace');
assert.equal(initialMarkingRole([], null), 'SUPERVISOR');
const late = task(6, 'PANEL', 'DRAFT SAVED', '2026-11-03T00:00:00Z');
const early = task(7, 'PANEL', 'NOT STARTED', '2026-11-01T00:00:00Z');
const submitted = task(8, 'PANEL', 'SUBMITTED', '2026-10-01T00:00:00Z');
const unordered = [submitted, supervisor, late, early];
assert.deepEqual(orderMarkingTasks(unordered), [early, late, supervisor, submitted]);
assert.deepEqual(unordered, [submitted, supervisor, late, early], 'Sorting must not mutate loaded assignments');
console.log('Lecturer role separation, multi-period tasks, remembered scope and deadline ordering passed');
