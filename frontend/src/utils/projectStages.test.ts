import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StageRow } from '../services/registrySemestersApi';
import { answerText, changeSummary, firstChip, marksLine, questionText, rowNote, rowsFor, STAGE_LABEL, stageChips, stageChoices, touchesMarks } from './projectStages';
import { validCourseCode } from './registrySemesters';

const row = (change: Partial<StageRow>): StageRow => ({
  matric: 'M1', name: 'Student', programme: 'MASTER OF DATA SCIENCE (COURSEWORK)', intake: '', avatarText: 'S', avatarBg: '',
  shown: 'NOT_STARTED', reason: '', noSupervisor: false, requestWaiting: false, notAnswered: false, setByCoordinator: false, ...change,
});

const rows = [
  row({ matric: 'A', shown: 'P1', noSupervisor: true }),
  row({ matric: 'B', shown: 'P1' }),
  row({ matric: 'C', shown: 'P2' }),
  row({ matric: 'D', shown: 'NOT_STARTED', notAnswered: true, reason: 'NOT_ANSWERED' }),
  row({ matric: 'E', shown: 'NOT_CONFIRMED', reason: 'BREAK_AFTER_P1' }),
  row({ matric: 'F', shown: 'COMPLETED' }),
];

const counts = Object.fromEntries(stageChips(rows).map(chip => [chip.value, chip.count]));
assert.deepEqual(counts, { noSupervisor: 1, notAnswered: 1, needsLook: 1, P1: 2, P2: 1, NOT_STARTED: 1, COMPLETED: 1 });
assert.deepEqual(stageChips([row({ shown: 'P2' })]).map(chip => chip.value), ['P1', 'P2', 'NOT_STARTED', 'COMPLETED']);
assert.equal(firstChip(rows), 'noSupervisor');
assert.equal(firstChip([row({ shown: 'P2' })]), 'P1');
assert.deepEqual(rowsFor(rows, 'P1').map(item => item.matric), ['A', 'B']);
assert.deepEqual(rowsFor(rows, 'needsLook').map(item => item.matric), ['E']);
assert.equal(STAGE_LABEL.P1, 'RP1');
assert.equal(STAGE_LABEL.NOT_CONFIRMED, 'Needs a look');

assert.equal(rowNote(row({ shown: 'NOT_CONFIRMED', reason: 'BREAK_AFTER_P1' })), 'Not studying right after RP1');
assert.equal(rowNote(row({ shown: 'NOT_CONFIRMED', reason: 'NO_SEMESTER_ROW' })), 'No semester on record');
assert.equal(rowNote(row({ shown: 'P1', noSupervisor: true })), 'No supervisor request');
assert.equal(rowNote(row({ shown: 'P1', noSupervisor: true, requestWaiting: true })), 'Supervisor request waiting');
assert.equal(rowNote(row({ shown: 'P2', setByCoordinator: true })), 'Set by a coordinator');
assert.equal(rowNote(row({ shown: 'P2' })), null);

assert.deepEqual(stageChoices([row({})]).map(choice => choice.value), ['P1', 'P2', 'NONE']);
assert.deepEqual(stageChoices([row({ setByCoordinator: true })]).map(choice => choice.value), ['P1', 'P2', 'NONE', 'AUTO']);
assert.deepEqual(stageChoices([row({ setByCoordinator: true }), row({})]).map(choice => choice.value), ['P1', 'P2', 'NONE']);
assert.deepEqual(stageChoices([]).map(choice => choice.value), ['P1', 'P2', 'NONE']);

assert.equal(touchesMarks(null), false);
assert.equal(touchesMarks({ notStarted: 0, draft: 0, submitted: 0, token: '' }), false);
assert.equal(touchesMarks({ notStarted: 0, draft: 1, submitted: 0, token: 't' }), true);
assert.equal(marksLine({ notStarted: 1, draft: 2, submitted: 0, token: 't' }), 'In Marks: 1 not started, 2 draft, 0 submitted.');
assert.equal(changeSummary({ changed: ['A', 'B'], leftOut: [] }), '2 students changed.');
assert.equal(changeSummary({ changed: [], leftOut: [{ matric: 'A', name: 'A', why: 'x' }] }), 'Nothing changed.');

assert.equal(questionText('WQD7025', 'Data Science Research Project'), 'Did you register WQD7025 Data Science Research Project in Maya this semester?');
assert.equal(questionText('', ''), 'Did you register your Research Project course in Maya this semester?');
assert.equal(answerText('YES', 'WQE7023'), 'You registered WQE7023 this semester.');
assert.equal(answerText('NO', 'WQE7023'), 'You said not this semester.');

assert.ok(validCourseCode('WQD7025'));
assert.ok(validCourseCode(' wqf7023 '));
assert.ok(!validCourseCode('7025'));
assert.ok(!validCourseCode('WQD70251'));

const app = readFileSync(resolve('src/App.tsx'), 'utf8');
const registry = readFileSync(resolve('src/components/StudentRegistry.tsx'), 'utf8');
const dashboard = readFileSync(resolve('src/components/StudentDashboard.tsx'), 'utf8');
const api = readFileSync(resolve('src/services/registrySemestersApi.ts'), 'utf8');
const page = readFileSync(resolve('src/components/ProjectStages.tsx'), 'utf8');
assert.match(app, /currentUser\.role === 'Office Staff\/Admin' \|\| currentUser\.role === 'Programme Coordinator' \? <ProjectStages \/>/);
assert.match(app, /showProjectStages=\{currentUser\.role === 'Programme Coordinator'\}/);
assert.match(registry, /\{showProjectStages && \(\s*<PortalButton onClick=\{\(\) => navigate\(APP_ROUTES\.registryProjectStages\)\}/);
assert.match(dashboard, /<ProjectStageQuestion \/>/);
assert.match(api, /\/project-stages\/change\//);
assert.match(api, /\/project-stages\/mine\//);
assert.ok(!api.includes('confirmProjectStages'), 'the old confirm call is still there');
assert.match(page, /data\.canChange \? \(\s*<PersonTickRow/);

console.log('Project stage checks passed.');
