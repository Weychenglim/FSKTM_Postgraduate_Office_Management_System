import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { AdministrationDashboard } from '../src/components/AdministrationDashboard';
import { OfficeMonitoringProvider } from '../src/components/OfficeMonitoringContext';
import { ListState } from '../src/components/ListState';
import { OfficeDashboardLayout } from '../src/components/OfficeDashboardLayout';
import { StaffSupervisorBrowseContext } from '../src/components/StaffSupervisorBrowseContext';
import { CoordinatorRequestsBrowse } from '../src/components/CoordinatorSupervisorWorkspace';
import { PanelAppointmentManagement } from '../src/components/PanelAppointmentManagement';
import { MarkEntryRecords } from '../src/components/MarkEntryRecords';
import { officeMonitoringRoute, type OfficeMonitoringView } from '../src/utils/officeMonitoring';
import { officeWorkloadNavigationState } from '../src/utils/officeDashboard';

const results: { name: string; error?: string }[] = [];
const check = (condition: unknown, message: string) => { if (!condition) throw Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 20));
const until = async (condition: () => unknown) => { for (let i = 0; i < 250; i++) { if (condition()) return; await pause(); } throw Error('Timed out'); };
let root: Root | undefined;
let supervisorQueries: URLSearchParams[] = [];
const mark = (id: string, status: string, role = 'SUPERVISOR', lifecycle = 'ACTIVE') => ({ id, studentId: id, studentName: id, studentInitials: 'ST', researchTitle: 'Research', panelMember: 'Evaluator', semester: '2026-S1', programme: 'Computing', totalMark: null, submittedDate: '-', status, evaluatorRole: role, taskLifecycleStatus: lifecycle });
const marks = [mark('Draft student', 'Draft'), mark('Not started student', 'Not Started'), mark('Submitted student', 'Submitted'), mark('Panel submitted student', 'Submitted', 'PANEL'), mark('Panel draft student', 'Draft', 'PANEL'), mark('Paused student', 'Draft', 'PANEL', 'PAUSED')];
const panels = ['Pending', 'Recommendation', 'Approved'].map((status, i) => ({ recordId: String(i), id: `ST${i}`, studentName: `Panel ${status} student`, programme: 'Computing', semester: '2026-S1', supervisor: 'Supervisor', panelMember: 'Panel lecturer', status, updatedDate: '-', recommendationId: i + 1 }));
const workloads = ['AVAILABLE', 'FULL', 'OVER_CAPACITY', 'NOT_CONFIGURED'].map((capacityState, i) => ({ id: `L${i}`, name: `Lecturer ${capacityState}`, department: 'Computing', initials: 'LE', currentStudents: 2, workloadLimit: 3, confirmedAppointments: 1, pendingNominations: 1, availability: 'Available', semesterCode: '2026-S1', capacityPlanVersion: 1, capacityState, workloadItems: [] }));
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
window.fetch = async input => {
  const url = new URL(String(input), location.origin), path = url.pathname;
  if (path.endsWith('/dashboard/summary/')) return response({ pendingSupervisorRequests: 2, pendingPanelApprovals: 1, incompleteMarkEntries: 3 });
  if (path.endsWith('/dashboard/attention/')) return response({ summary: [], results: [] });
  if (path.endsWith('/academics/semesters/active/')) return response(null);
  if (path.endsWith('/timeline/active/')) return response({ available: false });
  if (path.endsWith('/panel/workload/')) return response(workloads);
  if (path.endsWith('/appointments/panel/')) return response(panels);
  if (path.endsWith('/marks/')) return response(marks);
  if (path.includes('/office-workspace/requests/')) {
    supervisorQueries.push(url.searchParams);
    return response({ results: [], total: 0, page: 1, pageSize: 10, pageCount: 1, reviewCount: 0, facets: { programmes: [], semesters: [], statuses: [] } });
  }
  throw Error(`Unexpected fixture request ${path}`);
};

function Harness() {
  const location = useLocation(), navigate = useNavigate();
  const path = location.pathname;
  const back = () => navigate('/dashboard');
  return <><output id="current-route">{path + location.search}</output>
    <OfficeDashboardLayout enabled><OfficeMonitoringProvider enabled>
      {path === '/dashboard' ? <AdministrationDashboard onNavigateToTab={() => {}} onNavigateToRoute={route => navigate(route, { state: officeWorkloadNavigationState(route) })} />
        : path === '/supervisor-appointments/requests' ? <StaffSupervisorBrowseContext.Provider value="Office Staff/Admin"><CoordinatorRequestsBrowse refreshVersion={0} onOpen={() => {}} onCarryover={() => {}} /></StaffSupervisorBrowseContext.Provider>
        : path === '/marks/records' ? <MarkEntryRecords initialStatusTab="Submitted" onBack={back} onViewRecordDetail={() => {}} />
        : <PanelAppointmentManagement routeView={path.endsWith('/workload') ? 'workload' : 'list'} workloadBackLabel={location.state?.officeDashboardOrigin ? 'Back to Dashboard' : undefined} onNavigateToList={back} />}
    </OfficeMonitoringProvider></OfficeDashboardLayout></>;
}
const mount = async () => {
  root?.unmount(); supervisorQueries = [];
  // Simulate remembered filters that previously hid dashboard destinations.
  const memory = new Map<string, unknown>([
    ['MarkEntryRecords:searchQuery', 'missing student'], ['MarkEntryRecords:activeTab', 'Submitted'],
    ['MarkEntryRecords:appliedFilters', { search: 'missing student', programme: 'All Programmes', semester: 'All Semesters', status: 'Submitted', panelMember: 'All Members' }],
    ['PanelBrowse:office-requests:view', 'history'], ['PanelBrowse:office-requests:q', 'missing student'],
    ['PanelWorkloadMonitoring:status', 'AVAILABLE'], ['office-supervisor:view', 'history'], ['office-supervisor:search', 'missing student'],
  ]);
  root = createRoot(document.getElementById('root')!);
  root.render(<MemoryRouter initialEntries={['/dashboard']}><ListState.Provider value={memory}><Harness /></ListState.Provider></MemoryRouter>);
  await until(() => document.querySelectorAll('.home-monitoring-item').length === 4);
};
const names: Record<OfficeMonitoringView, string> = { 'supervisor-pending': 'Pending Supervisor requests', 'panel-pending': 'Pending Panel approvals', incomplete: 'Incomplete evaluations', 'panel-capacity': 'Lecturers at or over' };
for (const view of Object.keys(names) as OfficeMonitoringView[]) {
  try {
    await mount();
    const anchor = [...document.querySelectorAll<HTMLAnchorElement>('.home-monitoring-item')].find(node => node.textContent?.includes(names[view]))!;
    check(anchor.getAttribute('href') === officeMonitoringRoute(view), 'Incorrect native link destination');
    anchor.click();
    await until(() => document.querySelector('#current-route')?.textContent === officeMonitoringRoute(view));
    await until(() => document.body.textContent?.includes('Dashboard monitoring'));
    if (view === 'supervisor-pending') {
      await until(() => supervisorQueries.length);
      const query = supervisorQueries.at(-1)!;
      check(query.get('monitor') === 'supervisor-pending' && query.get('view') === 'requests' && !query.get('q') && !query.get('status'), 'Supervisor request scope lost or old filters retained');
    } else if (view === 'panel-pending') {
      await until(() => document.querySelector('table')?.textContent?.includes('Panel Pending student'));
      check(!document.querySelector('table')?.textContent?.includes('Panel Recommendation student'), 'Panel review mixed with Coordinator approval');
    } else if (view === 'panel-capacity') {
      await until(() => document.querySelector('table')?.textContent?.includes('Lecturer OVER_CAPACITY'));
      const table = document.querySelector('table')!.textContent!;
      check(table.includes('Lecturer FULL') && !table.includes('Lecturer AVAILABLE') && !table.includes('Lecturer NOT_CONFIGURED'), 'Workload scope incorrect');
      check(document.body.textContent?.includes('Back to Dashboard'), 'Dashboard workload return context lost');
    } else {
      await until(() => document.querySelector('tbody')?.textContent?.includes('Panel draft student'));
      const table = document.querySelector('tbody')!.textContent!;
      check(!table.includes('Paused student'), 'Inactive tasks included');
      check(table.includes('Draft student') && !table.includes('Panel submitted student'), 'Marks scope or initial status tab incorrect');
    }
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === 'Clear monitoring view')!.click();
    await until(() => !document.querySelector('#current-route')?.textContent?.includes('monitor='));
    check(!document.body.textContent?.includes('Dashboard monitoring'), 'Monitoring scope failed to clear');
    if (view === 'panel-capacity') check(document.body.textContent?.includes('Back to Dashboard'), 'Clearing monitoring lost the dashboard return context');
    results.push({ name: `${view}: actual dashboard link, destination scope, fresh filters and show-all navigation` });
  } catch (error) { results.push({ name: view, error: String(error) }); }
}
parent.postMessage({ type: 'office-monitoring-routes-results', results }, location.origin);
