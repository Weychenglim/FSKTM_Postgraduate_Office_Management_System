import type {AcademicSemesterLifecycle} from '../types/academicSemester';
import type {ActiveSemesterTimeline,TimelineAuditLog} from '../types/timeline';
import type {EvaluationPeriodLifecycle,EvaluationPreviewTask} from '../types/marks';
import {PROGRAMME_OPTIONS} from '../constants/programmes';
export function getOperationalProgrammeOptions(existing:string[]) {
  const seen=new Set<string>();
  return [...PROGRAMME_OPTIONS,...existing].filter(value=>{
    const key=value.trim().toLowerCase();
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  });
}
export const canManagePeriodSemester=(lifecycle:AcademicSemesterLifecycle)=>lifecycle==='DRAFT'||lifecycle==='ACTIVE'||lifecycle==='CLOSED';
export const canEditTimelineSemester=(lifecycle:AcademicSemesterLifecycle|undefined)=>lifecycle==='DRAFT'||lifecycle==='ACTIVE';
export const defaultMarksExtensionScope=(period:EvaluationPeriodLifecycle,semester:AcademicSemesterLifecycle):'everyone'|'selected'=>period==='CLOSED'||!canEditTimelineSemester(semester)?'selected':'everyone';
export function canOfferMarksExtension(period:EvaluationPeriodLifecycle,periodId:number,tasks:Pick<EvaluationPreviewTask,'periodId'|'taskId'|'status'|'canGrantCompletionWindow'>[]) {
  if(period==='DRAFT'||period==='ARCHIVED')return false;
  return period!=='CLOSED'||tasks.some(task=>task.periodId===periodId&&!!task.taskId&&task.status!=='SUBMITTED'&&!!task.canGrantCompletionWindow);
}
export async function loadPeriodTimeline(semesterId:number,lifecycle:AcademicSemesterLifecycle,fetchTimeline:(id:number)=>Promise<ActiveSemesterTimeline>,fetchAuditLogs:(id:number)=>Promise<TimelineAuditLog[]>):Promise<[ActiveSemesterTimeline|null,TimelineAuditLog[]]> {
  if(!canEditTimelineSemester(lifecycle))return [null,[]];
  return Promise.all([fetchTimeline(semesterId),fetchAuditLogs(semesterId)]);
}
