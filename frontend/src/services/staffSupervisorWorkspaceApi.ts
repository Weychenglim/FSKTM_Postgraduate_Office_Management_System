import { request } from './apiClient';
import { browseQuery, getCoordinatorRequests, getCoordinatorTeams, getCoordinatorAppointments, getCoordinatorCarryover, getCoordinatorCarryoverRecord, getCoordinatorSupportingAppointment, type BrowseParams, type BrowsePage, type CoordinatorRequestRow, type SupervisorGroup, type CoordinatorStudentRow, type CoordinatorAppointmentRow, type CarryoverRow } from './coordinatorWorkspaceApi';
import type { SupervisorApplicationRecord } from '../types';
import type { SupervisoryWorkspace, CoSupervisorNomination, CoSupervisorAppointment } from '../types/coSupervision';
import type { CapacityReassessment, CapacitySemester, CapacityRequestKind } from '../types/capacityReassessment';
const base='/appointments/office-workspace';
export type OfficeAttentionCategory = 'students'|'waiting'|'workload';
export interface OfficeAttentionSummary {withoutSupervisor:number;withoutSupervisorRp1?:number|null;waitingRequests:number;workloadConcerns:number;capacitySemester:{id:number;label:string}|null}
export interface OfficeAttentionStudent {projectStage?:string|null;projectSemester?:string|null;id:number;matricNo:string;studentName:string;programme:string;semester:string;applicationId:number|null;pendingStatus:string|null;reason:string}
export interface OfficeAttentionRequest {key:string;id:number;kind:'primary'|'supporting'|'research'|'transfer';studentId:number;studentName:string;matricNo:string;programme:string;candidateName:string;status:string;submittedAt:string;waitingDays:number|null;waitingOn:string}
export interface OfficeAttentionWorkload {activeLoad?:number;reservedLoad?:number;workloadCount?:number;pendingRequests?:number;id:number;lecturerId:string;lecturerName:string;department:string;currentStudents:number;workloadLimit:number|null;capacityState:string;reason:string}
export type OfficeAttentionRow = OfficeAttentionStudent|OfficeAttentionRequest|OfficeAttentionWorkload;
export const officeSupervisorApi = {
 attentionSummary:()=>request<OfficeAttentionSummary>(`${base}/attention-summary/`),
 attention:(params:BrowseParams)=>request<BrowsePage<OfficeAttentionRow>>(`${base}/attention/?${browseQuery(params)}`),
 requests:(params:BrowseParams)=>request<BrowsePage<CoordinatorRequestRow>>(`${base}/requests/?${browseQuery({...params,focus:'all'})}`),
 supervisors:(params:BrowseParams)=>request<BrowsePage<SupervisorGroup>>(`${base}/teams/?${browseQuery(params)}`),
 students:(params:BrowseParams)=>request<BrowsePage<CoordinatorStudentRow>>(`${base}/teams/?${browseQuery(params)}`),
 appointments:(params:BrowseParams)=>request<BrowsePage<CoordinatorAppointmentRow>>(`${base}/appointments/?${browseQuery(params)}`),
 carryover:(params:BrowseParams)=>request<BrowsePage<CarryoverRow>>(`${base}/carryover/?${browseQuery(params)}`),
 carryoverRecord:(kind:CapacityRequestKind,id:number)=>request<{record:CapacityReassessment;activeSemester:CapacitySemester|null}>(`${base}/carryover/${kind}/${id}/`),
 supportingAppointment:(id:number)=>request<CoSupervisorAppointment>(`${base}/appointments/supporting/${id}/`),
 primary:(id:string)=>request<SupervisorApplicationRecord&{email:string;workloadLimit:string}>(`${base}/requests/primary/${encodeURIComponent(id)}/`),
 supporting:(id:string)=>request<CoSupervisorNomination>(`${base}/requests/supporting/${encodeURIComponent(id)}/`),
 team:(id:string)=>request<SupervisoryWorkspace>(`${base}/teams/${encodeURIComponent(id)}/`),
};
export const coordinatorSupervisorApi = {
 requests:getCoordinatorRequests, supervisors:(params:BrowseParams)=>getCoordinatorTeams<SupervisorGroup>(params),
 students:(params:BrowseParams)=>getCoordinatorTeams<CoordinatorStudentRow>(params), appointments:getCoordinatorAppointments,
 carryover:getCoordinatorCarryover,carryoverRecord:getCoordinatorCarryoverRecord,supportingAppointment:getCoordinatorSupportingAppointment,
};
