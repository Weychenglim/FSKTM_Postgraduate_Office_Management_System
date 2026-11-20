import { APP_ROUTES } from '../constants/routes';
import type { StudentSupervisorApplication } from '../types';

export type SupervisorWorkspaceSection = 'overview' | 'applications' | 'requests' | 'supervisees' | 'research';
export type SupervisorWorkspaceRole = 'Student' | 'Lecturer' | 'Office Staff/Admin' | 'Programme Coordinator';

export function supervisorResearchLabel(role?: string) {
  return role === 'Programme Coordinator' ? 'Programme transfers' : role === 'Office Staff/Admin' ? 'Research records' : 'Research changes';
}

export function supervisorResearchPage(view: 'detail' | 'profile' | 'new') {
  return {
    detail: { title: 'Research change request', subtitle: '' },
    profile: { title: 'Research profile', subtitle: 'View the current research record and saved revisions.' },
    new: { title: 'Request research change', subtitle: 'The primary supervisor makes the final decision on your research change request.' },
  }[view];
}

export function supervisorWorkspaceSection(role: SupervisorWorkspaceRole, pathname: string): SupervisorWorkspaceSection {
  if (pathname === APP_ROUTES.supervisorResearchChanges || pathname.startsWith(`${APP_ROUTES.supervisorResearchChanges}/`)) return 'research';
  if (role === 'Student') return pathname === APP_ROUTES.supervisorAppointments ? 'overview' : 'applications';
  if (role === 'Office Staff/Admin' && pathname === APP_ROUTES.supervisorAppointments) return 'overview';
  return pathname === APP_ROUTES.supervisorAppointmentSupervisees || pathname.startsWith(`${APP_ROUTES.supervisorAppointmentSupervisees}/`) ? 'supervisees' : 'requests';
}

export function partitionSupervisorApplications<T extends Pick<StudentSupervisorApplication, 'workflowStatus'>>(records: T[]) {
  const isPending = (row: T) => row.workflowStatus === 'SUBMITTED_TO_SUPERVISOR' || row.workflowStatus === 'PENDING_COORDINATOR';
  return { pending: records.filter(isPending), completed: records.filter(row => !isPending(row)) };
}

export function supervisorWorkspaceLinks(role: SupervisorWorkspaceRole) {
  return role === 'Student' ? [
    { section: 'overview', label: 'My supervisors', route: APP_ROUTES.supervisorAppointments },
    { section: 'applications', label: 'Applications', route: APP_ROUTES.supervisorAppointmentApplications },
    { section: 'research', label: 'Research changes', route: APP_ROUTES.supervisorResearchChanges },
  ] : role !== 'Lecturer' ? [
    ...(role === 'Office Staff/Admin' ? [{section:'overview',label:'Needs attention',route:APP_ROUTES.supervisorAppointments}] : []),
    { section: 'requests', label: 'Appointment requests', route: role==='Office Staff/Admin'?APP_ROUTES.supervisorAppointmentRequests:APP_ROUTES.supervisorAppointments },
    { section: 'supervisees', label: 'Supervisory teams', route: APP_ROUTES.supervisorAppointmentSupervisees },
  ] : [
    { section: 'requests', label: 'Appointment requests', route: APP_ROUTES.supervisorAppointments },
    { section: 'supervisees', label: 'My supervisees', route: APP_ROUTES.supervisorAppointmentSupervisees },
    { section: 'research', label: 'Research changes', route: APP_ROUTES.supervisorResearchChanges },
  ];
}
