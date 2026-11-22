import { APP_ROUTES } from '../constants/routes';
import type { MarkRecord } from '../types';

const destinations = {
  'supervisor-pending': APP_ROUTES.supervisorAppointmentRequests,
  'panel-pending': APP_ROUTES.panelAppointments,
  incomplete: APP_ROUTES.marksRecords,
  'panel-capacity': APP_ROUTES.panelAppointmentWorkload,
} as const;
export type OfficeMonitoringView = keyof typeof destinations;

export function officeMonitoringRoute(view: OfficeMonitoringView): string {
  const query = new URLSearchParams({ monitor: view });
  if (view === 'panel-pending') query.set('panelSection', 'requests');
  return `${destinations[view]}?${query}`;
}

export function officeMonitoringView(pathname: string, search: string): OfficeMonitoringView | null {
  const value = new URLSearchParams(search).get('monitor');
  return value && Object.hasOwn(destinations, value) && destinations[value as OfficeMonitoringView] === pathname
    ? value as OfficeMonitoringView : null;
}

export function filterMonitoringMarks(records: MarkRecord[], view: OfficeMonitoringView | null): MarkRecord[] {
  if (view !== 'incomplete') return records;
  return records.filter(record => record.taskLifecycleStatus === 'ACTIVE'
    && record.status !== 'Review Required'
    && record.status !== 'Submitted');
}
