import {request} from './apiClient';
import {browseQuery,type BrowsePage,type BrowseParams} from './coordinatorWorkspaceApi';
import type {PanelRecord,PanelAssignment} from '../types';
export type PanelAttentionCategory='students'|'waiting'|'workload';
export interface PanelAttentionSummary {withoutPanel:number;waitingRequests:number;workloadConcerns:number;capacitySemester:{id:number;label:string}|null;}
export interface PanelAttentionStudent {projectStage?:string|null;projectSemester?:string|null;id:number;profileId:number;studentName:string;matricNo:string;programme:string;semester:string;supervisorId:number;supervisorName:string;recommendationId:number|null;pendingStatus:string|null;reason:string;}
export interface PanelAttentionRequest {id:number;key:string;studentId:number;profileId:number;studentName:string;matricNo:string;programme:string;semester:string;candidateName:string;status:string;submittedAt:string;waitingSince:string|null;waitingDays:number|null;waitingOn:string;}
export interface PanelAttentionWorkload {id:number;lecturerId:string;lecturerName:string;department:string;activeLoad:number;reservedLoad:number;currentStudents:number;workloadLimit:number|null;reason:string;capacityState:string;availableSlots:number;unavailableUntil:string|null;}
export type PanelAttentionRow=PanelAttentionStudent|PanelAttentionRequest|PanelAttentionWorkload;
export const panelAttentionSummary=()=>request<PanelAttentionSummary>('/appointments/panel/attention/summary/');
export const panelAttentionPage=(params:BrowseParams)=>request<BrowsePage<PanelAttentionRow>>(`/appointments/panel/attention/?${browseQuery(params)}`);
export const getExactPanelRecord=(id:string)=>request<PanelRecord>(`/appointments/panel/records/${encodeURIComponent(id)}/`);
export const getExactPanelAssignment=(id:number)=>request<PanelAssignment>(`/appointments/panel/appointments/${id}/`);
