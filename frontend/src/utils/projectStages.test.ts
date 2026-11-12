import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StageRow } from '../services/registrySemestersApi';
import { APP_ROUTES, routeForNotificationTarget } from '../constants/routes';
import { answerText, changeSummary, confirmText, correctionLine, firstChip, marksLine, questionText, rowNote, rowsFor, STAGE_LABEL, stageChips, stageChoices, touchesMarks } from './projectStages';
import { validCourseCode } from './registrySemesters';
import { correctionLabel } from '../context/stageCorrections';

const row = (change: Partial<StageRow>): StageRow => ({
  matric: 'M1', name: 'Student', programme: 'MASTER OF DATA SCIENCE (COURSEWORK)', intake: '', avatarText: 'S', avatarBg: '',
  shown: 'NOT_STARTED', reason: '', noSupervisor: false, requestWaiting: false, notAnswered: false, setByCoordinator: false,
  correctionRequested: false, correctionNote: '', ...change,
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
assert.equal(changeSummary({ changed: ['A'], leftOut: [] }, true), 'Answer kept for 1 student.');

// Correction requests
const asked = row({ matric: 'G', shown: 'P1', correctionRequested: true, correctionNote: 'Clicked the wrong one' });
assert.equal(firstChip([...rows, asked]), 'correction', 'Correction requests open first');
assert.equal(stageChips([...rows, asked])[0].label, 'Correction requested');
assert.ok(!stageChips(rows).some(chip => chip.value === 'correction'), 'The chip only shows when someone asked');
assert.equal(rowNote(asked), 'Correction requested: "Clicked the wrong one"');
assert.equal(rowNote(row({ correctionRequested: true, noSupervisor: true })), 'Correction requested');
assert.deepEqual(stageChoices([asked]).map(choice => choice.value), ['P1', 'P2', 'NONE', 'KEEP']);
assert.deepEqual(stageChoices([asked, row({})]).map(choice => choice.value), ['P1', 'P2', 'NONE']);
assert.equal(correctionLine(null), 'Only your programme coordinator can change this.');
assert.equal(correctionLine('REQUESTED'), 'Correction requested. Your programme coordinator will review it.');
assert.equal(correctionLine('KEPT'), 'Your programme coordinator reviewed this and kept your answer.');
assert.equal(
  routeForNotificationTarget({ targetModule: 'REGISTRY', recordType: 'PROJECT_STAGE', recordId: 'M1' }),
  APP_ROUTES.registryProjectStages,
);
assert.equal(routeForNotificationTarget({ targetModule: 'REGISTRY' }), APP_ROUTES.registry);

assert.equal(
  questionText('WQD7025', 'Data Science Research Project', 'Semester I 2026/2027'),
  'Have you registered for WQD7025 Data Science Research Project in MAYA for Semester I 2026/2027?',
);
assert.equal(questionText('', '', ''), 'Have you registered for your Research Project course in MAYA for this semester?');
assert.equal(answerText('YES', 'WQE7023', 'Research Project'), 'Registered: WQE7023 Research Project');
assert.equal(answerText('YES', '', ''), 'Registered for the Research Project');
assert.equal(answerText('NO', 'WQE7023', ''), 'Not registered for the Research Project this semester');
assert.equal(confirmText('YES', 'WQD7025', ''), 'You have registered for WQD7025 in MAYA.');
assert.equal(confirmText('NO', 'WQD7025', ''), 'You have not registered for the Research Project this semester.');

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

// The same Change on the Student Record, and the coordinator's red number
const card = readFileSync(resolve('src/components/StudentProjectStageCard.tsx'), 'utf8');
const dialog = readFileSync(resolve('src/components/ProjectStageChangeDialog.tsx'), 'utf8');
assert.match(page, /<ProjectStageChangeDialog/);
assert.match(card, /<ProjectStageChangeDialog/);
assert.match(card, /getProjectStages\(null, matric\)/);
assert.match(card, /data\.canChange && <PortalButton size="sm" onClick=\{\(\) => setChanging\(true\)\}>Change<\/PortalButton>/);
assert.match(card, /<h4 className="section-label">RP Registration<\/h4>/);
assert.match(page, /<RecordPage title="RP Registration"/);
assert.match(registry, /RP Registration\n/);
assert.match(registry, /\{ label: 'RP Registration', onSelect: \(\) => navigate\(APP_ROUTES\.registryProjectStages\) \}/);
assert.match(dialog, /`Change \$\{single\.name\}'s RP registration`/);
for (const source of [page, card, dialog, registry]) {
  assert.ok(!/['">]Project stages/.test(source), 'the old "Project stages" name is still shown');
}
assert.match(registry, /\{showProjectStages && <StudentProjectStageCard key=\{`stage:\$\{viewingStudent\.id\}`\} matric=\{viewingStudent\.id\} \/>\}/);
assert.match(registry, /\{projectStageAlerts > 0 && \(/);
assert.match(dialog, /keepProjectStageAnswers\(semesterId/);
assert.match(api, /\/project-stages\/waiting\//);
assert.match(api, /\.then\(stagesChanged\)/);
assert.match(app, /useStageCorrections\(currentUser\?\.role === 'Programme Coordinator'/);
assert.match(app, /\[SIDEBAR_ITEMS\.REGISTRY\]: \{ count: stageCorrections, label: correctionLabel\(stageCorrections\) \}/);
assert.match(app, /projectStageAlerts=\{stageCorrections\}/);
assert.equal(correctionLabel(1), '1 correction request');
assert.equal(correctionLabel(3), '3 correction requests');

console.log('Project stage checks passed.');
