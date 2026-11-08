import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appSource = readFileSync(resolve('src/App.tsx'), 'utf8');

const routeModules = [
  'MarkEntryPeriodConfig',
  'RubricsManagementView',
  'EvaluationTaskAssignment',
  'MarkEntryRecords',
  'MarkEntryRecordDetail',
  'PanelAppointmentManagement',
  'OfficeSupervisorWorkspace',
  'LecturerMarksEntry',
  'LecturerPanelAppointments',
  'LecturerSupervisorAppointments',
  'AdministrationDashboard',
  'TimelineManagement',
  'AcademicSemesterManagement',
  'WorkflowReconciliationCentre',
  'LecturerCapacityManagement',
  'FileRepository',
  'StudentFileSubmission',
  'NotificationsAnnouncements',
  'AnnouncementManagement',
  'AcademicFAQEditor',
  'StudentFAQChatbot',
  'LetterTemplateManagement',
  'StudentLetterGeneration',
  'StudentRegistry',
  'StudentDashboard',
  'LecturerDashboard',
  'CoordinatorDashboard',
  'CoordinatorSupervisorWorkspace',
  'StudentSupervisorAppointment',
  'StudentPanelAppointment',
  'SettingsView',
];

for (const moduleName of routeModules) {
  assert.equal(
    appSource.includes(`import { ${moduleName} } from './components/${moduleName}'`),
    false,
    `${moduleName} should be lazy-loaded instead of eagerly imported in App.tsx`,
  );
  assert.match(
    appSource,
    new RegExp(`const ${moduleName} = lazyNamed\\('${moduleName}'`),
    `${moduleName} should use the shared lazyNamed route loader`,
  );
}

assert.equal(
  appSource.includes('CoordinatorSupervisorDeferred'),
  false,
  'Coordinator supervisor approvals should not use the stale Deferred component name',
);

const coordinatorSupervisorSource = readFileSync(
  resolve('src/components/CoordinatorSupervisorApprovals.tsx'),
  'utf8',
);
const lecturerSupervisorSource = readFileSync(
  resolve('src/components/LecturerSupervisorAppointments.tsx'),
  'utf8',
);

assert.equal(
  coordinatorSupervisorSource.includes('window.prompt'),
  false,
  'Coordinator supervisor rejection should use an in-app reason control instead of window.prompt',
);

assert.equal(
  lecturerSupervisorSource.includes('prompt('),
  false,
  'Lecturer supervisor rejection should use an in-app reason control instead of prompt()',
);

assert.match(
  appSource,
  /<React\.Suspense fallback=\{<ModuleLoadingFallback \/>\}>/,
  'Authenticated route content should be wrapped in a shared Suspense fallback',
);

assert.match(
  appSource,
  /isDashboardLecturerCapacityRoute && currentUser\.role !== 'Office Staff\/Admin'[\s\S]*?<Navigate to=\{APP_ROUTES\.dashboard\} replace \/>/,
  'The Lecturer capacity route should redirect every non-Office role to Dashboard',
);

console.log('route lazy loading tests passed');
