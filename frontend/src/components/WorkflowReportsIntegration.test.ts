import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../constants/routes.ts', import.meta.url), 'utf8');
const adminDashboard = fs.readFileSync(
  new URL('./AdministrationDashboard.tsx', import.meta.url),
  'utf8',
);
const lecturerDashboard = fs.readFileSync(
  new URL('./LecturerDashboard.tsx', import.meta.url),
  'utf8',
);
const coordinatorDashboard = fs.readFileSync(
  new URL('./CoordinatorDashboard.tsx', import.meta.url),
  'utf8',
);
const studentDashboard = fs.readFileSync(
  new URL('./StudentDashboard.tsx', import.meta.url),
  'utf8',
);
const reports = fs.readFileSync(new URL('./WorkflowReports.tsx', import.meta.url), 'utf8');

assert.match(routes, /dashboardReports:\s*'\/dashboard\/reports'/);
assert.match(app, /WorkflowReports/);
assert.match(app, /isDashboardReportsRoute/);
assert.match(adminDashboard, /onClick=\{\(\)=>navigate\(APP_ROUTES.dashboardReports\)\}>View Workflow Reports/);
assert.doesNotMatch(adminDashboard, /label:'Workflow reports'/);
assert.doesNotMatch(adminDashboard, /Manage Participants/);
assert.match(lecturerDashboard, /View Workflow Reports/);
assert.match(coordinatorDashboard, /View Workflow Reports/);
assert.doesNotMatch(studentDashboard, /View Workflow Reports/);
assert.match(reports, /Workflow Analytics/);
assert.match(reports, /Download XLSX/);
assert.match(reports, /Current persisted state/);
assert.doesNotMatch(reports, /\bSLA\b|due soon/i);

console.log('Workflow Reports integration tests passed');
