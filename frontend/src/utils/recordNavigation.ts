import { APP_ROUTES, isKnownAppPath } from '../constants/routes';

export type RecordReturn = { path: string; label: string; historyIndex?: number };

export function shouldBlockRecordNavigation(dirty: boolean, busy: boolean, complete: boolean, pageKey?: string, nextPageKey?: string): boolean {
  if (pageKey && pageKey === nextPageKey) return false;
  return !complete && (dirty || busy);
}

export function recordFilterParams(current: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(current);
  if (value || key === 'profileStudent') next.set(key, value); else next.delete(key);
  if (key !== 'page' && key !== 'profileStudent') next.delete('page');
  return next;
}

// Return targets are UI context, never authority to access a record.
export function recordReturn(value: unknown, fallback: RecordReturn, modulePath: string): RecordReturn {
  if (!value || typeof value !== 'object') return fallback;
  const target = value as Partial<RecordReturn>;
  if (typeof target.path !== 'string' || typeof target.label !== 'string' || !target.label.trim()) return fallback;
  if (!target.path.startsWith('/') || target.path.startsWith('//') || target.path.includes('\\')) return fallback;
  const path = target.path.split(/[?#]/, 1)[0];
  if ((path !== modulePath && !path.startsWith(`${modulePath}/`)) || !isKnownAppPath(path)) return fallback;
  return { path: target.path, label: target.label, ...(Number.isInteger(target.historyIndex) && target.historyIndex! >= 0 ? { historyIndex: target.historyIndex } : {}) };
}

export function recordBackSteps(currentIndex: unknown, source: RecordReturn): number {
  return Number.isInteger(currentIndex) && Number.isInteger(source.historyIndex) && source.historyIndex! >= 0 && Number(currentIndex) > source.historyIndex!
    ? Number(currentIndex) - source.historyIndex! : 0;
}

export function researchProfileRecordReturn(value: unknown, fallback: RecordReturn): RecordReturn {
  return recordReturn(value, recordReturn(value, fallback, APP_ROUTES.panelAppointments), APP_ROUTES.supervisorAppointments);
}

/** Student requests can be opened from the supervisory overview or the Applications list. */
export function studentSupervisorRequestReturn(pathname: string, search: string, value: unknown, historyIndex?: unknown): RecordReturn {
  const fallback = { path: APP_ROUTES.supervisorAppointmentApplications + search, label: 'Applications' };
  const isOverview = pathname === APP_ROUTES.supervisorAppointments;
  const source = isOverview || pathname === APP_ROUTES.supervisorAppointmentApplications
    ? { path: pathname + search, label: isOverview ? 'My supervisors' : 'Applications', historyIndex }
    : value;
  return recordReturn(source, fallback, APP_ROUTES.supervisorAppointments);
}

export function recordNavigationState(path: string, label: string) {
  return { recordReturn: { path, label } };
}

export function recordSourceLabel(path: string, search = ''): string {
  if (path === APP_ROUTES.panelAppointments) {
    const params = new URLSearchParams(search);
    if (params.get('panelSection') === 'appointments') return params.has('panelLecturer') ? 'Panel students' : 'Panel assignments';
  }
  if (path.startsWith('/supervisor-appointments/student-')) return 'Supervisor appointment overview';
  if (path.startsWith('/panel-appointments/records/profile-')) return 'Panel appointment overview';
  if (path === '/supervisor-appointments/requests') return 'Appointment requests';
  if (/^\/supervisor-appointments\/research-changes\//.test(path)) return 'Research change request';
  if (/^\/supervisor-appointments\/supervisees\//.test(path)) return 'Supervision details';
  if (path === '/supervisor-appointments/supervisees') return 'My supervisees';
  if (path === '/supervisor-appointments/research-changes') return 'Research changes';
  if (/^\/supervisor-appointments\/(supporting-requests\/)?[^/]+$/.test(path) && !['history','workload','new','requirements','applications'].includes(path.split('/').at(-1)!)) return 'Appointment request';
  if (path.startsWith('/supervisor-appointments')) return 'Supervisor Appointments';
  if (path.startsWith('/panel-appointments/assignments/')) return 'Panel assignment';
  if (path.startsWith('/panel-appointments')) return 'Panel Appointments';
  if (path.startsWith('/marks')) return 'Marks Entry';
  if (path.startsWith('/registry')) return 'Student Registry';
  return 'Dashboard';
}

/** Preserve browse context while keeping an exact record's own parameters authoritative. */
export function recordPathWithSearch(path:string,search:string):string {
  const [pathname,query='']=path.split('?',2);
  const params=new URLSearchParams(search);
  for(const [key,value] of new URLSearchParams(query))params.set(key,value);
  const merged=params.toString();
  return pathname+(merged?`?${merged}`:'');
}
