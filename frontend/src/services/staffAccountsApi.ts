/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Staff and lecturer accounts API (UC03). Live data only: errors are shown with Retry.

import type {
  ActivationOutcome,
  CoordinatorAccountInput,
  ProgrammeMoveCheck,
  StaffAccount,
  StaffAccountChange,
  StaffAccountFilters,
  StaffAccountInput,
  StaffAccountList,
  StaffAccountPage,
  StaffDetailsChange,
  StaffDuty,
  StaffOptions,
} from '../types';
import { request } from './apiClient';

const BASE = '/registry/staff';

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export function staffListQuery(filters: StaffAccountFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  if (filters.page > 1) params.set('page', String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getStaffAccounts(filters: StaffAccountFilters): Promise<StaffAccountList> {
  return request<StaffAccountList>(`${BASE}/${staffListQuery(filters)}`);
}

export function getStaffOptions(): Promise<StaffOptions> {
  return request<StaffOptions>(`${BASE}/options/`);
}

export function createStaffAccount(
  input: StaffAccountInput | CoordinatorAccountInput,
): Promise<{ account: StaffAccount; activation: ActivationOutcome; reopened?: boolean }> {
  return request(`${BASE}/`, json('POST', input));
}

export function getStaffAccount(id: string): Promise<StaffAccountPage> {
  return request<StaffAccountPage>(`${BASE}/${encodeURIComponent(id)}/`);
}

export function updateStaffAccount(id: string, changes: StaffDetailsChange): Promise<{ account: StaffAccountPage; oldAddressTold: boolean | null }> {
  return request(`${BASE}/${encodeURIComponent(id)}/`, json('PATCH', changes));
}

export function setStaffDuties(id: string, duties: StaffDuty[]): Promise<StaffAccountPage> {
  return request<StaffAccountPage>(`${BASE}/${encodeURIComponent(id)}/duties/`, json('POST', { duties }));
}

export function checkProgrammeMove(id: string, programme: string): Promise<ProgrammeMoveCheck> {
  return request<ProgrammeMoveCheck>(`${BASE}/${encodeURIComponent(id)}/programme/`, json('POST', { programme, check: true }));
}

export function changeStaffProgramme(id: string, programme: string): Promise<StaffAccountPage> {
  return request<StaffAccountPage>(`${BASE}/${encodeURIComponent(id)}/programme/`, json('POST', { programme }));
}

export function setStaffSignIn(id: string, on: boolean, reason = ''): Promise<StaffAccountPage> {
  return request<StaffAccountPage>(`${BASE}/${encodeURIComponent(id)}/sign-in/`, json('POST', { on, reason }));
}

export function deleteStaffAccount(id: string): Promise<void> {
  return request<void>(`${BASE}/${encodeURIComponent(id)}/`, { method: 'DELETE' });
}

export function sendStaffLink(id: string): Promise<{ kind: 'activation' | 'reset'; sent: boolean }> {
  return request(`${BASE}/${encodeURIComponent(id)}/send-link/`, { method: 'POST' });
}

export function copyStaffActivationLink(id: string): Promise<{ link: string }> {
  return request(`${BASE}/${encodeURIComponent(id)}/activation-link/`, { method: 'POST' });
}

export function getStaffHistory(id: string): Promise<StaffAccountChange[]> {
  return request<StaffAccountChange[]>(`${BASE}/${encodeURIComponent(id)}/history/`);
}
