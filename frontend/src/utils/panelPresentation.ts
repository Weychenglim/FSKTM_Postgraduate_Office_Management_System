import {canReviewPanelRecommendation,type PanelRecommendationReviewerRole} from './panelRecommendationWorkflow';
import type {PanelAssignment, PanelRecord, PanelRecommendationDraft, PanelRecommendationStatus, SubmittedRecommendation} from '../types';
import {orderApprovalEvents, type ApprovalStep} from './approvalProcess';
import {PANEL_RECOMMENDATION_STATUS_LABELS} from './panelRecommendationWorkflow';
import {appointmentRequestStatusLabel,appointmentRequestStatusTone,requestReviewStepLabel} from './appointmentRequestStatus';

export type PanelPresentation = Omit<PanelRecommendationDraft, 'status'> & {status: PanelRecommendationStatus | 'UNKNOWN' | 'NOT_SUBMITTED'};
/** Request lists keep their source nomination even after an appointment is created. */
export function panelBrowseRecordKey(record:PanelPresentation,section:'requests'|'appointments'):string {
  if(section==='requests' && record.id != null)return `recommendation-${record.id}`;
  return record.appointmentLifecycle?`appointment-${record.appointmentLifecycle.appointmentId}`:record.id != null?`recommendation-${record.id}`:`profile-${record.studentId}`;
}
export const panelStatusLabel = (status: string): string => ({ACTIVE:'Active',ENDED:'Ended',COMPLETED:'Completed',WITHDRAWN:'Withdrawn',REPLACED:'Replaced',OTHER:'Other',Approved:'Approved',Ended:'Ended',Pending:appointmentRequestStatusLabel('PENDING_COORDINATOR'),Recommendation:appointmentRequestStatusLabel('SUBMITTED_TO_PANEL'),'No Panel':'Not appointed',Rejected:'Rejected',Cancelled:'Cancelled'}[status] ?? PANEL_RECOMMENDATION_STATUS_LABELS[status as PanelRecommendationStatus] ?? appointmentRequestStatusLabel(status));
export const panelStatusTone = (status: string) => ['ACTIVE','COMPLETED','Approved'].includes(status) ? 'success' as const : status==='Rejected'?'danger' as const:status==='Pending'||status==='Recommendation'?'warning' as const:appointmentRequestStatusTone(status);
export const panelRequestPending = (status:string) => ['SUBMITTED_TO_PANEL','PENDING_COORDINATOR'].includes(status);

/** A legacy display date is a date, never an invented midnight decision time. */
export function panelRecordedDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^\d{1,2} [A-Za-z]{3} \d{4}$/.test(value)) {
    const date = Date.parse(`${value} UTC`);
    return Number.isFinite(date) ? new Date(date).toISOString().slice(0,10) : undefined;
  }
  return /^\d{4}-\d{2}-\d{2}(T|$)/.test(value) ? value : undefined;
}

export function toOfficePanelPresentation(row:PanelRecord):PanelPresentation {
  if(row.recommendation)return {...row.recommendation, projectStage:row.projectStage, projectSemester:row.projectSemester};
  const status:PanelPresentation['status']=row.status==='No Panel'?'NOT_SUBMITTED':row.status==='Recommendation'?'SUBMITTED_TO_PANEL':row.status==='Pending'?'PENDING_COORDINATOR':row.status==='Approved'||row.status==='Ended'?'APPROVED':row.status==='Rejected'&&row.rejectionStage==='Selected Panel'?'REJECTED_BY_PANEL':row.status==='Rejected'&&row.rejectionStage==='Programme Coordinator'?'REJECTED_BY_COORDINATOR':'UNKNOWN';
  return {projectStage:row.projectStage,projectSemester:row.projectSemester,id:row.recommendationId??undefined,studentId:row.id,studentName:row.studentName,programme:row.programme,semester:row.semester,supervisorName:row.supervisor,proposedTopic:row.researchTitle??'',researchArea:row.researchArea,abstract:row.abstract,recommendedMember:row.panelMember,recommendedMemberId:row.panelMemberId??'',panelMemberEmail:row.panelMemberEmail,panelMemberDepartment:row.panelMemberDepartment,status,submittedDate:'',submittedAt:row.recommendationSubmittedAt,panelDecisionAt:row.panelDecisionAt,coordinatorDecisionAt:row.coordinatorDecisionAt,cancelledAt:row.cancelledAt,rejectionReason:row.rejectionReason,cancellationReason:row.cancellationReason,workflow:row.workflow,appointmentLifecycle:row.appointmentLifecycle,appointmentDate:panelRecordedDate(row.appointmentDate),waitingDays:row.waitingDays,waitingOn:row.waitingOn};
}
export function toAssignmentPanelPresentation(row:PanelAssignment):PanelPresentation {
  if(row.recommendation)return {...row.recommendation, projectStage:row.projectStage, projectSemester:row.projectSemester};
  return {projectStage:row.projectStage,projectSemester:row.projectSemester,studentId:row.studentId,studentName:row.studentName,programme:row.programme??'',semester:row.intake,proposedTopic:row.researchTitle,researchArea:row.researchArea,abstract:row.abstract,supervisorName:row.supervisor,supervisorEmail:row.supervisorEmail,recommendedMember:row.panelMemberName??'',recommendedMemberId:row.panelMemberId??'',status:'APPROVED',submittedDate:'',submittedAt:row.recommendationSubmittedAt,panelDecisionAt:row.panelDecisionAt,coordinatorDecisionAt:row.coordinatorDecisionAt,appointmentDate:panelRecordedDate(row.appointmentDate),appointmentLifecycle:row.appointmentLifecycle};
}
export function toSubmittedPanelPresentation(row:SubmittedRecommendation):PanelPresentation {
  if(row.recommendation)return row.recommendation;
  return {id:row.recommendationId,studentId:row.studentId,studentName:row.studentName,programme:row.programme??'',semester:row.semester,proposedTopic:row.researchTitle,researchArea:row.researchArea,abstract:row.abstract,recommendedMember:row.recommendedPanel,recommendedMemberId:row.recommendedPanelId??'',status:row.workflowStatus??(row.status==='Approved'?'APPROVED':'UNKNOWN'),submittedDate:row.date,submittedAt:row.submittedAt,panelDecisionAt:row.panelDecisionAt,selectedPanelDecision:row.selectedPanelDecision,coordinatorDecisionAt:row.coordinatorDecisionAt,cancelledAt:row.cancelledAt,cancellationReason:row.cancellationReason,rejectionReason:row.rejectionReason,justification:row.justification,workflow:row.workflow,waitingDays:row.waitingDays,waitingOn:row.waitingOn};
}

export function buildPanelApprovalSteps(record:PanelPresentation):ApprovalStep[] {
  if(record.status==='NOT_SUBMITTED')return [];
  const events=orderApprovalEvents(record.workflow??[]);
  const latest=(match:(event:typeof events[number])=>boolean)=>events.filter(match).at(-1);
  const submitted=events.find(e=>['SUBMIT','SUBMITTED'].includes(e.action));
  const panel=latest(e=>e.previousStatus==='SUBMITTED_TO_PANEL'&&e.newStatus==='PENDING_COORDINATOR');
  const coordinator=latest(e=>e.previousStatus==='PENDING_COORDINATOR'&&e.newStatus==='APPROVED');
  const terminal=latest(e=>e.newStatus===record.status&&e.previousStatus!==e.newStatus);
  const rejected=record.status.startsWith('REJECTED_'), cancelled=record.status.startsWith('CANCELLED_'), approved=record.status==='APPROVED';
  const stopped=record.status==='REJECTED_BY_PANEL'?0:record.status==='REJECTED_BY_COORDINATOR'?1:terminal?.previousStatus==='SUBMITTED_TO_PANEL'?0:terminal?.previousStatus==='PENDING_COORDINATOR'?1:undefined;
  const current=record.status==='SUBMITTED_TO_PANEL'?0:record.status==='PENDING_COORDINATOR'?1:undefined;
  const details=(event?:typeof events[number],date?:string|null)=>({actorName:event?.actorName||undefined,actorRole:event?.actorRole||undefined,occurredAt:event?.createdAt||date||undefined});
  const steps:ApprovalStep[]=[{id:'submitted',label:'Request submitted',state:submitted||record.submittedAt||record.submittedDate?'completed':'unknown',...details(submitted,panelRecordedDate(record.submittedAt||record.submittedDate))}];
  const stages=[{id:'panel',reviewer:'Panel',event:panel,date:record.panelDecisionAt},{id:'coordinator',reviewer:'Coordinator',event:coordinator,date:record.coordinatorDecisionAt}];
  for(const [index,stage] of stages.entries()) {
    let state:ApprovalStep['state']='unknown';
    const recorded=!!stage.event||!!stage.date;
    if(rejected)state=stopped===index?'rejected':stopped!<index?'not_reached':recorded?'completed':'unknown';
    else if(cancelled)state=recorded&&(stopped==null||index<stopped)?'completed':'not_reached';
    else if(approved)state=recorded?'completed':'unknown';
    else if(current!=null)state=index===current?'current':index>current?'upcoming':recorded?'completed':'unknown';
    const event=state==='rejected'?terminal:state==='completed'?stage.event:undefined;
    steps.push({id:stage.id,label:requestReviewStepLabel(stage.reviewer,state,recorded,index===0?'accepted':'approved'),state,reason:event?.reason||undefined,...details(event,state==='completed'||state==='rejected'?stage.date:undefined),description:state==='current'?`Awaiting ${index===0?'Panel review':'Coordinator approval'}.${Number.isSafeInteger(record.waitingDays)&&record.waitingDays!>=0?` ${record.waitingDays} calendar ${record.waitingDays===1?'day':'days'} at this stage.`:''}`:state==='not_reached'?'Not reached before the request ended.':state==='unknown'?'Stage history: Not recorded.':undefined});
  }
  steps.push({id:'outcome',label:'Outcome',state:approved?'completed':rejected?'rejected':cancelled?'cancelled':current!=null?'upcoming':'unknown',...details(terminal),showRecordedDetails:cancelled||!terminal,reason:cancelled?terminal?.reason||undefined:undefined,description:approved?'Request approved.':cancelled?panelStatusLabel(record.status):rejected?'Request rejected; no appointment was created.':current!=null?'Awaiting a final decision.':'Recorded outcome; detailed review history is unavailable.'});
  return steps;
}

/** Coordinator monitoring rows deliberately lack academic review authority. */
export function canActOnPanelRecord(record:PanelPresentation,role:PanelRecommendationReviewerRole):boolean {
  return record.participantEligible!==false && (role==='PROGRAMME_COORDINATOR'?record.canReview===true:record.canReview!==false)
    && canReviewPanelRecommendation(record.status as PanelRecommendationStatus,role);
}
