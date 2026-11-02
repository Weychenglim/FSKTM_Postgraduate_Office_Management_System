import type {
  AvailabilityWindowCommand,
  CapacityEntryCommand,
  CapacityBulkCommand,
  CapacityHistoryQuery,
  CapacityPublishCommand,
  LecturerAvailabilityWindow,
  LecturerCapacityAudit,
  SemesterCapacityPlan,
} from '../types';
import { request } from './apiClient';

const historyQuery = ({ limit, offset }: CapacityHistoryQuery = {}): string => {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  const query = params.toString();
  return query ? `?${query}` : '';
};

export function getSemesterCapacityPlans(
  semesterId: number,
  query?: CapacityHistoryQuery,
): Promise<SemesterCapacityPlan[]> {
  return request<SemesterCapacityPlan[]>(
    `/academics/semesters/${semesterId}/capacity-plans/${historyQuery(query)}`,
  );
}

export function createSemesterCapacityPlan(
  semesterId: number,
  copyFromPlanId: number | null = null,
): Promise<SemesterCapacityPlan> {
  return request<SemesterCapacityPlan>(
    `/academics/semesters/${semesterId}/capacity-plans/`,
    {
      method: 'POST',
      body: JSON.stringify({ copyFromPlanId }),
    },
  );
}

export function getSemesterCapacityPlan(planId: number): Promise<SemesterCapacityPlan> {
  return request<SemesterCapacityPlan>(`/academics/capacity-plans/${planId}/`);
}

export function discardSemesterCapacityPlan(planId: number, command: CapacityPublishCommand & { confirmed: true }): Promise<SemesterCapacityPlan> {
  return request<SemesterCapacityPlan>(`/academics/capacity-plans/${planId}/discard/`, {
    method: 'POST', body: JSON.stringify(command),
  });
}

export function updateLecturerCapacityEntry(
  planId: number,
  lecturerId: number,
  command: CapacityEntryCommand,
): Promise<SemesterCapacityPlan> {
  return request<SemesterCapacityPlan>(
    `/academics/capacity-plans/${planId}/lecturers/${lecturerId}/`,
    {
      method: 'PATCH',
      body: JSON.stringify(command),
    },
  );
}

export function cloneSemesterCapacityPlan(planId: number): Promise<SemesterCapacityPlan> {
  return request<SemesterCapacityPlan>(`/academics/capacity-plans/${planId}/clone/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function publishSemesterCapacityPlan(
  planId: number,
  command: CapacityPublishCommand,
): Promise<SemesterCapacityPlan> {
  return request<SemesterCapacityPlan>(`/academics/capacity-plans/${planId}/publish/`, {
    method: 'POST',
    body: JSON.stringify(command),
  });
}

export function getLecturerAvailabilityWindows(
  semesterId: number,
  query?: CapacityHistoryQuery,
): Promise<LecturerAvailabilityWindow[]> {
  return request<LecturerAvailabilityWindow[]>(
    `/academics/semesters/${semesterId}/availability/${historyQuery(query)}`,
  );
}

export function createLecturerAvailabilityWindow(
  semesterId: number,
  command: AvailabilityWindowCommand,
): Promise<LecturerAvailabilityWindow> {
  return request<LecturerAvailabilityWindow>(
    `/academics/semesters/${semesterId}/availability/`,
    {
      method: 'POST',
      body: JSON.stringify(command),
    },
  );
}

export function cancelLecturerAvailabilityWindow(
  windowId: number,
  reason: string,
): Promise<LecturerAvailabilityWindow> {
  return request<LecturerAvailabilityWindow>(
    `/academics/availability/${windowId}/cancel/`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

export function getLecturerCapacityAudits(
  semesterId: number,
  query?: CapacityHistoryQuery,
): Promise<LecturerCapacityAudit[]> {
  return request<LecturerCapacityAudit[]>(
    `/academics/semesters/${semesterId}/capacity-audits/${historyQuery(query)}`,
  );
}


export type CapacityCollection = 'capacity-plans' | 'availability' | 'capacity-audits';
export interface CapacityBrowseQuery extends CapacityHistoryQuery {
  q?: string; status?: string; role?: string; lecturerId?: number; version?: number;
}
export interface CapacityPage<T> { rows: T[]; total: number; limit: number; offset: number; versions?: number[] }
export function getCapacityPage<T>(semesterId: number, collection: CapacityCollection, query: CapacityBrowseQuery): Promise<CapacityPage<T>> {
  const params = new URLSearchParams({pageResult: 'true'});
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  return request(`/academics/semesters/${semesterId}/${collection}/?${params}`);
}
export function getWorkingCapacityPlans(semesterId: number, query?: CapacityHistoryQuery): Promise<SemesterCapacityPlan[]> {
  const params = new URLSearchParams(historyQuery(query).slice(1));
  params.set('scope', 'working');
  return request(`/academics/semesters/${semesterId}/capacity-plans/?${params}`);
}

export function updateLecturerCapacityEntriesBulk(planId: number, command: CapacityBulkCommand): Promise<SemesterCapacityPlan> {
  return request(`/academics/capacity-plans/${planId}/entries/bulk/`, {method: 'PATCH', body: JSON.stringify(command)});
}
