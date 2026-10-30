export type MaintenanceStatus = 'off' | 'planned' | 'on';

export interface PortalMaintenance {
  status: MaintenanceStatus;
  startsAt: string | null;
  expectedEnd: string | null;
  message: string;
}

export interface MaintenanceHistoryEntry {
  id: number;
  action: 'PLANNED' | 'STARTED' | 'CHANGED' | 'ENDED' | 'CANCELLED';
  actionLabel: string;
  by: string;
  at: string;
  startsAt: string | null;
  expectedEnd: string | null;
}

export interface OfficeMaintenance extends PortalMaintenance {
  defaultMessage: string;
  setBy: string;
  updatedAt: string | null;
  history: MaintenanceHistoryEntry[];
}

export interface MaintenanceChange {
  startsAt: string | null;
  expectedEnd: string | null;
  message: string;
}
