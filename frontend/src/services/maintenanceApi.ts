import type { PortalMaintenance } from '../types';
import { request } from './apiClient';

export const getMaintenance = () => request<PortalMaintenance>('/maintenance/', undefined, { retryAuth: false });
