import assert from 'node:assert/strict';
import { lecturerMarksRoute, lecturerMarksTaskRoute, resolveLecturerMarkTask } from './lecturerMarksRoutes';
import type { EvaluationTask } from '../types';

assert.deepEqual(lecturerMarksRoute('/marks'), {view:'dashboard'});
assert.deepEqual(lecturerMarksRoute('/marks/history'), {view:'history'});
assert.deepEqual(lecturerMarksRoute('/marks/tasks/42'), {view:'task',taskId:42});
for (const path of ['/marks/tasks/0','/marks/tasks/-2','/marks/tasks/nope','/marks/tasks/9007199254740992','/marks/config']) {
  assert.equal(lecturerMarksRoute(path).view, 'invalid');
}
assert.equal(lecturerMarksTaskRoute(42), '/marks/tasks/42');
const own = {id:42,studentId:'S1',evaluatorRole:'PANEL',status:'SUBMITTED',taskLifecycleStatus:'RETIRED'} as EvaluationTask;
assert.equal(resolveLecturerMarkTask([own],42), own);
assert.equal(resolveLecturerMarkTask([own],99), null);
assert.equal(resolveLecturerMarkTask([own],42,{studentId:'S2',role:'PANEL'}), null);
assert.equal(resolveLecturerMarkTask([own],42,{studentId:'S1',role:'SUPERVISOR'}), null);
assert.equal(resolveLecturerMarkTask([own],42,{studentId:'S1',role:'PANEL'}), own);
console.log('Lecturer routes identify exact tasks, history and invalid URLs without cross-student fallback');
