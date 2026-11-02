import {request} from './apiClient';
import type {DashboardTask} from '../types/dashboard';

export type AttentionCategory='reconciliation'|'capacity'|'evaluations'|'calendar'|'documents'|'supervision'|'panel';
export type AttentionResponsibility='review'|'waiting';
export type AttentionUrgency='overdue'|'due'|'blocking'|'normal';
export interface OfficeAttentionRecord extends DashboardTask {
  category:AttentionCategory; responsibility:AttentionResponsibility; urgency:AttentionUrgency; programme:string;
  semester?:string|null;
}
export interface OfficeAttentionSummary {
  id:string; category:AttentionCategory; responsibility:AttentionResponsibility; urgency:AttentionUrgency;
  title:string; count:number; detail:string;
}
export interface OfficeAttentionPage {
  results:OfficeAttentionRecord[]; total:number; page:number; pageSize:number; pageCount:number;
  summary:OfficeAttentionSummary[]; programmes:string[]; categories:{value:AttentionCategory;label:string}[];
}
export const getOfficeAttention=(params:Record<string,string|number>={})=>{
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(params))if(value!=='')query.set(key,String(value));
  return request<OfficeAttentionPage>(`/dashboard/attention/${query.size?`?${query}`:''}`);
};
