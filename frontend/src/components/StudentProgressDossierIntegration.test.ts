import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../constants/routes.ts', import.meta.url), 'utf8');
const dossier = fs.readFileSync(new URL('./StudentProgressDossier.tsx', import.meta.url), 'utf8');
const studentDashboard = fs.readFileSync(new URL('./StudentDashboard.tsx', import.meta.url), 'utf8');
const reports = fs.readFileSync(new URL('./WorkflowReports.tsx', import.meta.url), 'utf8');
const supervisor = fs.readFileSync(
  new URL('./SupervisorAppointmentManagement.tsx', import.meta.url),
  'utf8',
);
const panel = fs.readFileSync(
  new URL('./PanelAppointmentManagement.tsx', import.meta.url),
  'utf8',
);
const marks = fs.readFileSync(new URL('./MarkEntryRecords.tsx', import.meta.url), 'utf8');
const coordinatorSupervisor = fs.readFileSync(
  new URL('./CoordinatorSupervisorApprovals.tsx', import.meta.url),
  'utf8',
);
const lecturerSupervisor = fs.readFileSync(
  new URL('./LecturerSupervisorAppointments.tsx', import.meta.url),
  'utf8',
);
const lecturerPanel = fs.readFileSync(
  new URL('./LecturerPanelAppointments.tsx', import.meta.url),
  'utf8',
);
const lecturerMarks = fs.readFileSync(
  new URL('./LecturerMarksEntry.tsx', import.meta.url),
  'utf8',
);

assert.match(routes, /dashboardProgress:\s*'\/dashboard\/progress'/);
assert.match(routes, /routeForStudentProgress/);
assert.match(app, /StudentProgressDossier/);
assert.match(app, /dashboardProgressMatch/);
assert.match(studentDashboard, /View My Academic Record/);
assert.match(reports, /View student record/);
assert.match(supervisor, /View student record/);
assert.match(panel, /onOpenStudent=\{onNavigateToDossier\}/);
assert.doesNotMatch(fs.readFileSync(new URL('./PanelBrowse.tsx', import.meta.url),'utf8'), /View student record/, 'Panel tables keep one record action; student navigation lives inside details');
assert.match(marks, /View student record/);
assert.match(coordinatorSupervisor, /View student record/);
assert.match(lecturerSupervisor, /View student record/);
assert.match(lecturerPanel, /onOpenStudent=\{onNavigateToDossier\}/);
assert.doesNotMatch(lecturerMarks, /View student record/, 'Lecturer marking lists keep only the marking action');

assert.match(dossier, /Student Progress Dossier/);
assert.match(dossier, /Overview/);
assert.match(dossier, /Supervisor/);
assert.match(dossier, /Panel/);
assert.match(dossier, /Marks/);
assert.match(dossier, /Timeline/);
assert.doesNotMatch(dossier, />\s*(Approve|Reject|Cancel|Submit)\s*</);

console.log('Student Progress Dossier integration tests passed');
