import { request } from './apiClient';
import type { SupervisorApplicationRecord } from '../types';
import type { CoSupervisorNomination, CoSupervisorAppointment, SupervisoryWorkspace } from '../types/coSupervision';
import type { CapacityReassessment, CapacitySemester, CapacityRequestKind } from '../types/capacityReassessment';

export type BrowseParams = Record<string, string | number | undefined>;
export interface BrowsePage<T> { results: T[]; total: number; page: number; pageSize: number; pageCount: number; reviewCount?: number; projectSemester?: string | null; facets: { programmes: string[]; semesters: string[]; statuses: string[] } }
export interface CoordinatorRequestRow { key: string; id: number; kind: 'primary' | 'supporting'; studentName: string; matricNo: string; programme: string; candidateName: string; status: string; submittedAt: string; decidedAt?: string | null; waitingDays: number | null; canDecide: boolean; carryover: boolean }
export interface SupervisorGroup { id: number; name: string; staffNo: string; primaryCount: number; supportingCount: number }
export interface CoordinatorStudentRow { id: number; matricNo: string; studentName: string; programme: string; primarySupervisor: {id: number; name: string} | null; relationship: string | null; projectStage?: string | null }
export interface CoordinatorAppointmentRow { key: string; id: number; kind: 'primary' | 'supporting'; studentName: string; matricNo: string; programme: string; supervisorName: string; appointmentDate: string; endedAt: string | null; outcome: string; applicationId: number | null; studentId: number }
export type CarryoverRow = Pick<CapacityReassessment, 'id' | 'kind' | 'status' | 'student' | 'candidate' | 'originalSemester' | 'authorization'>;
const base = '/appointments/coordinator-workspace';
export const browseQuery = (params: BrowseParams) => { const query = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value)); return query.toString(); };
export const getCoordinatorRequests = (params: BrowseParams) => request<BrowsePage<CoordinatorRequestRow>>(`${base}/requests/?${browseQuery({...params,focus:"decision"})}`);
export const getCoordinatorTeams = <T extends SupervisorGroup | CoordinatorStudentRow>(params: BrowseParams) => request<BrowsePage<T>>(`${base}/teams/?${browseQuery(params)}`);
export const getCoordinatorAppointments = (params: BrowseParams) => request<BrowsePage<CoordinatorAppointmentRow>>(`${base}/appointments/?${browseQuery(params)}`);
export const getCoordinatorCarryover = (params: BrowseParams) => request<BrowsePage<CarryoverRow>>(`${base}/carryover/?${browseQuery(params)}`);
export const getCoordinatorTeam = (id: string) => request<SupervisoryWorkspace & { primaryApplication: SupervisorApplicationRecord | null }>(`${base}/teams/${encodeURIComponent(id)}/`);
export const getCoordinatorSupportingRequest = (id: string) => request<CoSupervisorNomination>(`${base}/requests/supporting/${encodeURIComponent(id)}/`);
export const getCoordinatorSupportingAppointment = (id: number) => request<CoSupervisorAppointment>(`${base}/appointments/supporting/${id}/`);
export const getCoordinatorCarryoverRecord = (kind: CapacityRequestKind, id: number) => request<{record: CapacityReassessment; activeSemester: CapacitySemester | null}>(`${base}/carryover/${kind}/${id}/`);

export const getCoordinatorPrimaryRequest = (id: string) => request<SupervisorApplicationRecord & {canDecide:boolean}>(`${base}/requests/primary/${encodeURIComponent(id)}/`);
