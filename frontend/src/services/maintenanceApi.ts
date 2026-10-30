import type { MaintenanceChange, OfficeMaintenance, PortalMaintenance } from '../types';
import { request } from './apiClient';

export const getMaintenance = () => request<PortalMaintenance>('/maintenance/', undefined, { retryAuth: false });
export const getOfficeMaintenance = () => request<OfficeMaintenance>('/maintenance/manage/');
export const saveMaintenance = (change: MaintenanceChange) => request<OfficeMaintenance>('/maintenance/manage/', {
  method: 'PUT', body: JSON.stringify(change),
});
export const endMaintenance = () => request<OfficeMaintenance>('/maintenance/manage/end/', { method: 'POST' });
