import {AppointmentRecordSection} from './AppointmentSidebar';
import React from 'react';
import {BookOpen, ListChecks, UserRound} from 'lucide-react';
import {ApprovalProcess,formatRequestDisplayDate} from './ApprovalProcess';
import {RequestAuditHistory,RequestDetailActions,RequestDetailCard,RequestSection} from './RequestDetailPrimitives';
import {appointmentDetailTypography as text} from './AppointmentPrimitives';
import {PortalCard,StatusBadge} from './PortalPrimitives';
import {RequestSummaryField as Fact} from './AppointmentRequestSections';
import {ResearchAbstract} from './ResearchAbstract';
import {PanelDetailFact} from './PanelDetailLayout';
import {SupervisionDetailSection,supervisionDetailLabel as label,supervisionDetailBody as body} from './SupervisionDetailLayout';
import {buildPanelApprovalSteps,panelRecordedDate,panelStatusLabel,panelStatusTone,type PanelPresentation} from '../utils/panelPresentation';

export function panelRecordMetadata(record:PanelPresentation) {
  const event=(record.workflow??[]).find(e=>['SUBMIT','SUBMITTED'].includes(e.action));
  return {submittedAt:event?.createdAt||panelRecordedDate(record.submittedAt||record.submittedDate),submittedBy:event?.actorName||'',statusLabel:panelStatusLabel(record.status),statusTone:panelStatusTone(record.status)};
}
export function PanelRecommendationDetail({record,actions,administration,contextAction}:{record:PanelPresentation;actions?:React.ReactNode;administration?:React.ReactNode;contextAction?:React.ReactNode}) {
  const started=record.status!=='NOT_SUBMITTED';
  const progress=buildPanelApprovalSteps(record).map(step=>step.reason&&(step.reason===record.rejectionReason||step.reason===record.cancellationReason)?{...step,reason:undefined}:step);
  const replacement=!!(record.replacesAppointmentId||record.replacementReason);
  const continuing=replacement&&['SUBMITTED_TO_PANEL','PENDING_COORDINATOR'].includes(record.status)&&record.replacedAppointmentStatus==='ACTIVE';
  const hasReview=!!(started||actions||record.workflow?.length||record.rejectionReason||record.cancellationReason);
  const hasSidebar=hasReview||!!administration;
  const contacts=[['Student email',record.studentEmail],['Supervisor email',record.supervisorEmail]].filter(([,value])=>value);
  const fact=(title:string,value?:string|null)=><div key={title} className="min-w-0 space-y-2"><dt className={label}>{title}</dt><dd className={`${body} whitespace-pre-wrap`}>{value?.trim()||'Not recorded'}</dd></div>;
  return <div data-panel-recommendation-detail className="space-y-7">
    <PortalCard padding="lg" role="region" aria-label="Request overview" data-request-summary>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 space-y-2"><p className={label}>Student</p><h2 className="text-lg font-semibold leading-relaxed text-brand-navy [overflow-wrap:anywhere]">{record.studentName?.trim()||'Not recorded'}</h2><p className="text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{record.studentId||'Not recorded'}</p></div>
        {contextAction}
      </div>
      <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
        {fact('Programme',record.programme)}{fact('Semester',record.semester)}{fact('Primary supervisor',record.supervisorName)}
      </dl>
      {contacts.length?<details className="mt-5 border-t border-slate-100 pt-5"><summary className={`${label} cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy`}>Contact details</summary><dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">{contacts.map(([title,value])=>fact(title!,value))}</dl></details>:null}
      {!started?<p className={`${body} mt-5`}>No Panel recommendation has been submitted for this record.</p>:null}
      {!started&&record.unavailableUntil?<p className="mt-5 text-sm leading-6 text-amber-800">Unavailable for new appointments until {formatRequestDisplayDate(record.unavailableUntil)}. This recorded recommendation remains available.</p>:null}
    </PortalCard>
    <div data-panel-request-columns className={hasSidebar?'grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]':'min-w-0'}>
      <div className="min-w-0 space-y-7">
        {started||replacement||record.justification?<SupervisionDetailSection title="Nomination details" icon={UserRound}>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {fact(record.status==='APPROVED'?'Nominated Panel member':'Proposed Panel member',record.recommendedMember)}
            {record.recommendedMemberId?fact('Staff number',record.recommendedMemberId):null}
            {record.panelMemberDepartment?fact('Department',record.panelMemberDepartment):null}
            {record.panelMemberEmail?fact('Panel email',record.panelMemberEmail):null}
          </dl>
          <dl className="border-t border-slate-100 pt-6">{fact('Nomination justification',record.justification)}</dl>
          {replacement?<section aria-label="Requested replacement" className="space-y-5 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-brand-navy">Requested replacement</h3>
            {record.replacedPanelMember?<dl>{fact(continuing?'Panel member being replaced':'Previous Panel member',record.replacedPanelMember)}</dl>:null}
            {record.replacementReason?<dl>{fact('Replacement reason',record.replacementReason)}</dl>:null}
            <p className={body}>{continuing?'The current Panel appointment continues until this replacement is approved.':'This nomination requested a replacement of the previous Panel member.'}</p>
          </section>:null}
          {record.unavailableUntil?<p className="text-sm leading-6 text-amber-800">Unavailable for new appointments until {formatRequestDisplayDate(record.unavailableUntil)}. This recorded recommendation remains available.</p>:null}
        </SupervisionDetailSection>:null}
        <div data-research-details><SupervisionDetailSection title="Current research" icon={BookOpen}>
          <p className="text-xs leading-6 text-slate-500">Current saved student research profile</p>
          <dl className="space-y-6"><div className="space-y-2"><dt className={label}>Research title</dt><dd className="text-lg font-normal leading-8 text-slate-900 [overflow-wrap:anywhere]">{record.proposedTopic?.trim()||'Not recorded'}</dd></div>{fact('Research area',record.researchArea)}</dl>
          <dl className="border-t border-slate-100 pt-6"><div className="space-y-3"><dt className={label}>Abstract</dt><dd><ResearchAbstract value={record.abstract} inset={false}/></dd></div></dl>
        </SupervisionDetailSection></div>
      </div>
      {hasSidebar?<aside data-panel-review aria-label="Recommendation review and appointment" className="min-w-0 space-y-7">{hasReview?<SupervisionDetailSection title="Review and outcome" icon={ListChecks}>
        {started?<ApprovalProcess steps={progress} headingAs="h3"/>:null}
        {record.rejectionReason||record.cancellationReason?<dl className="border-t border-slate-100 pt-6">{fact(record.rejectionReason?'Rejection reason':'Cancellation reason',record.rejectionReason||record.cancellationReason)}</dl>:null}
        {actions?<div className="border-t border-slate-100 pt-6"><RequestDetailActions>{actions}</RequestDetailActions></div>:null}
      </SupervisionDetailSection>:null}
      {administration}
      </aside>:null}
    </div>
  </div>;
}
export function PanelAppointmentRecordCard({record,actions,compact=false,showHistory=true,children,markingAction,sourceAction}:{record:PanelPresentation;actions?:React.ReactNode;compact?:boolean;showHistory?:boolean;children?:React.ReactNode;markingAction?:React.ReactNode;sourceAction?:React.ReactNode}) {
  const lifecycle=record.appointmentLifecycle;
  if(!lifecycle)return null;
  const active=lifecycle.status==='ACTIVE';
  const approved=record.coordinatorDecisionAt||lifecycle.lifecycle?.find(e=>e.action==='ACTIVATED')?.createdAt||record.appointmentDate;
  const events=(lifecycle.lifecycle??[]).filter(event=>event.action!=='ACTIVATED').map(e=>({...e,reason:e.reason??undefined}));
  if(compact)return <div data-panel-appointment-record><AppointmentRecordSection actions={actions} history={(showHistory&&events.length>0)||children?<>{showHistory&&events.length?<RequestAuditHistory title="Appointment changes" events={events}/>:null}{children}</>:undefined}>
    <dl className="space-y-5"><div className="space-y-2"><dt className={label}>Appointment status</dt><dd><StatusBadge tone={active?'success':'neutral'}>{panelStatusLabel(lifecycle.status)}</StatusBadge></dd></div>
      <PanelDetailFact title="Appointment date" value={formatRequestDisplayDate(panelRecordedDate(approved))}/>
      {!active?<><PanelDetailFact title="Ended on" value={formatRequestDisplayDate(lifecycle.endedAt)}/>{lifecycle.endOutcome?<PanelDetailFact title="Outcome" value={panelStatusLabel(lifecycle.endOutcome)}/>:null}{lifecycle.endReason?<PanelDetailFact title="Reason" value={lifecycle.endReason}/>:null}{lifecycle.endedBy?<PanelDetailFact title="Recorded by" value={lifecycle.endedBy}/>:null}</>:null}
    </dl>
    {markingAction}
    {sourceAction?<div className="border-t border-slate-100 pt-6"><RequestDetailActions>{sourceAction}</RequestDetailActions></div>:null}
  </AppointmentRecordSection></div>;
  return <div data-panel-appointment-record><RequestDetailCard padding="lg" actions={actions} audit={events.length?<RequestAuditHistory title="Appointment changes" events={events}/>:undefined}>
    <RequestSection title="Appointment record" headingClassName={text.heading}><dl className="grid gap-x-10 gap-y-6 pt-3 sm:grid-cols-2"><Fact label="Student" value={record.studentName} name/><Fact label="Appointed Panel member" value={record.recommendedMember} name/><div><dt className={text.label}>Appointment status</dt><dd className="mt-2"><StatusBadge tone={active?'success':'neutral'}>{panelStatusLabel(lifecycle.status)}</StatusBadge></dd></div><Fact label="Appointment date" value={formatRequestDisplayDate(panelRecordedDate(approved))}/>{!active?<Fact label="Ended on" value={formatRequestDisplayDate(lifecycle.endedAt)}/>:null}</dl></RequestSection>
    {!active&&(lifecycle.endOutcome||lifecycle.endReason)?<RequestSection title="Appointment outcome" headingClassName={text.heading}>{lifecycle.endOutcome?<p className={text.body}>{panelStatusLabel(lifecycle.endOutcome)}</p>:null}{lifecycle.endReason?<p className={`${text.body} max-w-prose whitespace-pre-wrap break-words`}>{lifecycle.endReason}</p>:null}{lifecycle.endedBy?<p className="card-caption">Recorded by {lifecycle.endedBy}</p>:null}</RequestSection>:null}
  </RequestDetailCard></div>;
}
