import React from 'react';
import {BookOpen,UserRound} from 'lucide-react';
import {PortalCard} from './PortalPrimitives';
import {ResearchAbstract} from './ResearchAbstract';
import {AppointmentProjectStageField,SupervisionDetailSection,supervisionDetailLabel as label,supervisionDetailBody as body} from './SupervisionDetailLayout';
import type {PanelPresentation} from '../utils/panelPresentation';

export function PanelDetailFact({title,value}:{title:string;value?:string|null}) {
  return <div className="min-w-0 space-y-2"><dt className={label}>{title}</dt><dd className={`${body} whitespace-pre-wrap`}>{value?.trim()||'Not recorded'}</dd></div>;
}

export function PanelStudentOverview({record,actions,assignment=false,appointmentDetails=false}:{record:Pick<PanelPresentation,'studentName'|'studentId'|'programme'|'semester'|'supervisorName'|'studentEmail'|'supervisorEmail'|'projectStage'|'projectSemester'|'appointmentLifecycle'>;actions?:React.ReactNode;assignment?:boolean;appointmentDetails?:boolean}) {
  const contacts=[['Student email',record.studentEmail],['Supervisor email',record.supervisorEmail]].filter(([,value])=>value);
  return <PortalCard padding="lg" role="region" aria-label="Student overview">
    <div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 space-y-2"><p className={label}>Student</p><h2 className="text-lg font-semibold leading-relaxed text-brand-navy [overflow-wrap:anywhere]">{record.studentName?.trim()||'Not recorded'}</h2><p className="text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{record.studentId||'Not recorded'}</p></div>{actions}</div>
    <dl className={`mt-6 grid gap-x-8 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-2 ${assignment || (!appointmentDetails && record.projectStage) ? '' : 'lg:grid-cols-[1.3fr_1fr_1fr]'}`}>
      <PanelDetailFact title="Programme" value={record.programme}/>
      <AppointmentProjectStageField stage={record.projectStage} semester={record.projectSemester} displayedSemester={record.semester}/>
      {(!appointmentDetails || !record.appointmentLifecycle) && <PanelDetailFact title="Semester" value={record.semester}/>}
      {!assignment && <PanelDetailFact title="Primary supervisor" value={record.supervisorName}/>}
    </dl>
    {assignment ? record.studentEmail ? <dl className="mt-5"><PanelDetailFact title="Student email" value={record.studentEmail}/></dl> : null : contacts.length?<details className="mt-5 border-t border-slate-100 pt-5"><summary className={`${label} cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy`}>Contact details</summary><dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">{contacts.map(([title,value])=><PanelDetailFact key={title} title={title!} value={value}/>)}</dl></details>:null}
  </PortalCard>;
}

export function PanelResearchDetails({record}:{record:Pick<PanelPresentation,'proposedTopic'|'researchArea'|'abstract'>}) {
  return <div data-research-details><SupervisionDetailSection title="Current research" icon={BookOpen}>
    <p className="text-xs leading-6 text-slate-500">Current saved student research profile</p>
    <dl className="space-y-6"><div className="space-y-2"><dt className={label}>Research title</dt><dd className="text-lg font-normal leading-8 text-slate-900 [overflow-wrap:anywhere]">{record.proposedTopic?.trim()||'Not recorded'}</dd></div><PanelDetailFact title="Research area" value={record.researchArea}/></dl>
    <dl className="border-t border-slate-100 pt-6"><div className="space-y-3"><dt className={label}>Abstract</dt><dd><ResearchAbstract value={record.abstract} inset={false}/></dd></div></dl>
  </SupervisionDetailSection></div>;
}

export function PanelMemberDetails({record,title='Appointed Panel member',actions}:{record:Pick<PanelPresentation,'recommendedMember'|'recommendedMemberId'|'panelMemberDepartment'|'panelMemberEmail'>;title?:string;actions?:React.ReactNode}) {
  return <SupervisionDetailSection title={title} icon={UserRound} actions={actions}>
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2"><PanelDetailFact title="Panel member" value={record.recommendedMember}/>
      {record.recommendedMemberId?<PanelDetailFact title="Staff number" value={record.recommendedMemberId}/>:null}
      {record.panelMemberDepartment?<PanelDetailFact title="Department" value={record.panelMemberDepartment}/>:null}
      {record.panelMemberEmail?<PanelDetailFact title="Panel email" value={record.panelMemberEmail}/>:null}
    </dl>
  </SupervisionDetailSection>;
}
