import assert from 'node:assert/strict';
import { SIDEBAR_ITEMS } from './navigation';
import {
  APP_ROUTES,
  isKnownAppPath,
  routeForDashboardSemesters,
  routeForDashboardTimeline,
  routeForLecturerCapacity,
  routeForWorkflowReconciliation,
  routeForPanelAssignment,
  routeForPanelRecord,
  routeForNotificationTarget,
  routeForPanelSubmittedRecommendations,
  routeForPanelReviewedRequests,
  routeForPanelWorkload,
  routeForSupervisorHistory,
  routeForSupervisorNewApplication,
  routeForSupervisorRequirements,
  routeForSupervisorSupervisee,
  routeForSupervisorWorkload,
  routeForSidebarItem,
  sidebarItemForPath,
} from './routes';

assert.equal(routeForSidebarItem(SIDEBAR_ITEMS.DASHBOARD), APP_ROUTES.dashboard);
assert.equal(routeForSidebarItem(SIDEBAR_ITEMS.MARKS_ENTRY), APP_ROUTES.marks);
assert.equal(routeForSidebarItem(SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS), APP_ROUTES.supervisorAppointments);

assert.equal(routeForDashboardTimeline(), '/dashboard/timeline');
assert.equal(routeForDashboardSemesters(), '/dashboard/semesters');
assert.equal(routeForLecturerCapacity(), '/dashboard/lecturer-capacity');
assert.equal(isKnownAppPath('/registry/acting-coordinators'), true);
assert.equal(routeForWorkflowReconciliation(), '/dashboard/workflow-reconciliation');
assert.equal(sidebarItemForPath('/marks/records/MARK-001'), SIDEBAR_ITEMS.MARKS_ENTRY);
assert.equal(sidebarItemForPath('/dashboard/timeline'), SIDEBAR_ITEMS.DASHBOARD);
assert.equal(sidebarItemForPath('/supervisor-appointments/workload'), SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS);
assert.equal(sidebarItemForPath('/supervisor-appointments/new'), SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS);
assert.equal(sidebarItemForPath('/supervisor-appointments/history'), SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS);
assert.equal(sidebarItemForPath('/supervisor-appointments/supervisees/MEA2209841'), SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS);
assert.equal(sidebarItemForPath('/panel-appointments/recommendations/7'), SIDEBAR_ITEMS.PANEL_APPOINTMENTS);
assert.equal(sidebarItemForPath('/panel-appointments/records/appointment-42'), SIDEBAR_ITEMS.PANEL_APPOINTMENTS);
assert.equal(sidebarItemForPath('/panel-appointments/workload'), SIDEBAR_ITEMS.PANEL_APPOINTMENTS);
assert.equal(sidebarItemForPath('/panel-appointments/submitted'), SIDEBAR_ITEMS.PANEL_APPOINTMENTS);
assert.equal(sidebarItemForPath('/panel-appointments/reviewed'), SIDEBAR_ITEMS.PANEL_APPOINTMENTS);
assert.equal(sidebarItemForPath('/panel-appointments/assignments/MEA2209841'), SIDEBAR_ITEMS.PANEL_APPOINTMENTS);
assert.equal(isKnownAppPath('/marks/records/MARK-001'), true);
assert.equal(isKnownAppPath('/panel-appointments/records/appointment-42'), true);
assert.equal(isKnownAppPath('/panel-appointments/workload'), true);
assert.equal(isKnownAppPath('/panel-appointments/submitted'), true);
assert.equal(isKnownAppPath('/panel-appointments/reviewed'), true);
assert.equal(isKnownAppPath('/panel-appointments/assignments/MEA2209841'), true);
assert.equal(isKnownAppPath('/dashboard'), true);
assert.equal(isKnownAppPath('/dashboard/timeline'), true);
assert.equal(isKnownAppPath('/dashboard/semesters'), true);
assert.equal(isKnownAppPath('/dashboard/lecturer-capacity'), true);
assert.equal(isKnownAppPath('/dashboard/participant-lifecycle'), true);
assert.equal(isKnownAppPath('/dashboard/workflow-reconciliation'), true);
assert.equal(isKnownAppPath('/dashboard/unknown'), false);
assert.equal(isKnownAppPath('/supervisor-appointments/workload'), true);
assert.equal(isKnownAppPath('/supervisor-appointments/new'), true);
assert.equal(isKnownAppPath('/supervisor-appointments/history'), true);
assert.equal(isKnownAppPath('/supervisor-appointments/requirements'), true);
assert.equal(isKnownAppPath('/supervisor-appointments/supervisees/MEA2209841'), true);
assert.equal(isKnownAppPath('/supervisor-appointments/42'), true);
assert.equal(isKnownAppPath('/supervisor-appointments/unknown/path'), false);
assert.equal(isKnownAppPath('/not-a-real-route'), false);

assert.equal(routeForSupervisorWorkload(), '/supervisor-appointments/workload');
assert.equal(routeForSupervisorNewApplication(), '/supervisor-appointments/new');
assert.equal(routeForSupervisorHistory(), '/supervisor-appointments/history');
assert.equal(routeForSupervisorRequirements(), '/supervisor-appointments/requirements');
assert.equal(routeForSupervisorSupervisee('MEA2209841'), '/supervisor-appointments/supervisees/MEA2209841');
assert.equal(routeForPanelRecord('appointment-42'), '/panel-appointments/records/appointment-42');
assert.equal(routeForPanelWorkload(), '/panel-appointments/workload');
assert.equal(routeForPanelSubmittedRecommendations(), '/panel-appointments/submitted');
assert.equal(routeForPanelReviewedRequests(), '/panel-appointments/reviewed');
assert.equal(routeForPanelAssignment('MEA2209841'), '/panel-appointments/assignments/MEA2209841');

assert.equal(
  routeForNotificationTarget({
    targetModule: 'SUPERVISOR_APPOINTMENTS',
    recordType: 'SUPERVISOR_APPLICATION',
    recordId: '42',
  }),
  '/supervisor-appointments/42',
);

assert.equal(
  routeForNotificationTarget({
    targetModule: 'PANEL_APPOINTMENTS',
    recordType: 'PANEL_RECOMMENDATION',
    recordId: '7',
  }),
  '/panel-appointments/recommendations/7',
);

assert.equal(routeForNotificationTarget({ targetModule: 'UNKNOWN' }), APP_ROUTES.notifications);

console.log('routes tests passed');
