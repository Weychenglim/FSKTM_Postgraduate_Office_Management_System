export type MaintenanceStatus = 'off' | 'planned' | 'on';

export interface PortalMaintenance {
  status: MaintenanceStatus;
  startsAt: string | null;
  expectedEnd: string | null;
  message: string;
}
