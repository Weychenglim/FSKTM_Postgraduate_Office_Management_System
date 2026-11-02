import {APP_ROUTES,routeForMarkRecord,routeForPanelRecord,routeForSupportingSupervisorRequest,routeForSupervisorApplication,routeForSupervisorResearchRequest} from '../constants/routes';
import type {OfficeAttentionRecord,OfficeAttentionSummary} from '../services/officeAttentionApi';

export const officeAttentionPreview=(summary:OfficeAttentionSummary[])=>summary.slice(0,4);
export const officeAttentionCategoryRoute=(group:OfficeAttentionSummary)=>group.category==='documents'?APP_ROUTES.supervisorAppointmentRequirements:`${APP_ROUTES.dashboardAttention}?${new URLSearchParams({category:group.category,responsibility:group.responsibility})}`;
export function officeAttentionRecordRoute(row:OfficeAttentionRecord):string {
  const id=row.recordId;
  if(row.recordType==='SUPERVISOR_DOCUMENT_REQUIREMENTS')return APP_ROUTES.supervisorAppointmentRequirements;
  if(row.recordType==='RECONCILIATION_ISSUE')return APP_ROUTES.dashboardWorkflowReconciliation;
  if(row.recordType==='LECTURER_CAPACITY')return `${APP_ROUTES.dashboardLecturerCapacity}?${new URLSearchParams(id?{lecturer:id}:{})}`;
  if(row.recordType==='EVALUATION_TASK')return id&&/^\d+$/.test(id)?routeForMarkRecord(`MRK-${id.padStart(5,'0')}`):APP_ROUTES.marksRecords;
  if(row.id==='task_upload')return APP_ROUTES.dashboardTimeline;
  if(id){
    if(row.recordType==='SUPERVISOR_APPLICATION')return routeForSupervisorApplication(`request-${id}`);
    if(row.recordType==='CO_SUPERVISOR_NOMINATION')return routeForSupportingSupervisorRequest(id);
    if(row.recordType==='RESEARCH_AMENDMENT')return routeForSupervisorResearchRequest(id);
    if(row.recordType==='PANEL_RECOMMENDATION')return routeForPanelRecord(`recommendation-${id}`);
  }
  return row.category==='panel'?APP_ROUTES.panelAppointments:APP_ROUTES.supervisorAppointments;
}
