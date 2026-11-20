import React from 'react';
import {CircleHelp, Mail, UsersRound} from 'lucide-react';
import {PortalButton} from './PortalPrimitives';
import {SupervisionDetailSection, SupervisionMember, supervisionDetailBody, supervisionDetailLabel} from './SupervisionDetailLayout';
import type {AppointmentGuidanceCard} from './AppointmentPrimitives';
import {projectStageLabel} from './AttentionProjectStage';

/** Common reading order for the student's two appointment overviews. */
export function StudentAppointmentLayout({guidance, children}: {
  guidance?: React.ReactNode; children: React.ReactNode;
}) {
  return <div data-student-appointment-layout className="space-y-7">
    <div data-student-appointment-columns className={`grid items-start gap-7 ${guidance ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
      <div className="min-w-0 space-y-7">{children}</div>
      {guidance ? <aside aria-label="Appointment guidance" className="min-w-0">{guidance}</aside> : null}
    </div>
  </div>;
}

export function StudentAppointmentCard({title, memberLabel, name, status, tone, programme, semester, projectStage, projectSemester, department, email, appointmentDate, actions, children}: {
  title: string; memberLabel: string; name: string; status: string;
  tone: React.ComponentProps<typeof SupervisionMember>['tone'];
  programme?: string; semester?: string; department?: string | null; email?: string | null; appointmentDate?: string | null;
  projectStage?: string | null; projectSemester?: string | null;
  actions?: React.ReactNode; children?: React.ReactNode;
}) {
  return <SupervisionDetailSection title={title} icon={UsersRound} actions={actions}>
    <SupervisionMember label={memberLabel} name={name} status={status} tone={tone}/>
    <dl className="grid gap-x-8 gap-y-6 border-t border-slate-100 pt-6 sm:grid-cols-2">
      <AppointmentFact label="Department" value={department}/>
      <div className="min-w-0 space-y-2"><dt className={supervisionDetailLabel}>Email</dt><dd className={supervisionDetailBody}>{email ? <a href={`mailto:${email}`} className="inline-flex max-w-full items-start gap-2 rounded text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"><Mail aria-hidden="true" className="mt-1 h-4 w-4 shrink-0"/><span className="min-w-0 [overflow-wrap:anywhere]">{email}</span></a> : 'Not recorded'}</dd></div>
      <AppointmentFact label="Appointed on" value={appointmentDate}/>
      <AppointmentFact label="Appointment semester" value={semester}/>
      <StudentAppointmentAcademicFields programme={programme} stage={projectStage} projectSemester={projectSemester} displayedSemester={semester}/>
    </dl>
    {children}
  </SupervisionDetailSection>;
}

export function StudentAppointmentAcademicFields({programme, stage, projectSemester, displayedSemester}: {
  programme?: string; stage?: string | null; projectSemester?: string | null; displayedSemester?: string | null;
}) {
  const semester = projectSemester?.trim();
  return <>
    <AppointmentFact label="Programme" value={programme}/>
    {stage && <div className="min-w-0 space-y-2">
      <dt className={supervisionDetailLabel}>Your project stage</dt>
      <dd className={supervisionDetailBody}>{projectStageLabel(stage)}{semester && semester !== displayedSemester?.trim() && <span className="mt-1 block text-xs leading-5 text-slate-600">{semester}</span>}</dd>
    </div>}
  </>;
}

function AppointmentFact({label, value}: {label: string; value?: string | null}) {
  return <div className="min-w-0 space-y-2"><dt className={supervisionDetailLabel}>{label}</dt><dd className={supervisionDetailBody}>{value?.trim() || 'Not recorded'}</dd></div>;
}

export function StudentAppointmentNextStep({cards, onShowFAQChatbot}: {
  cards: AppointmentGuidanceCard[]; onShowFAQChatbot?: () => void;
}) {
  return <SupervisionDetailSection title="What happens next" icon={CircleHelp}>
    {cards.map(card => <article key={card.title} className="space-y-3">
      <h3 className="text-sm font-medium leading-6 text-slate-900">{card.title}</h3>
      <div className={`${supervisionDetailBody} space-y-3`}>{card.content}</div>
    </article>)}
    {onShowFAQChatbot ? <div className="border-t border-slate-100 pt-5"><PortalButton size="sm" className="min-h-11" icon={CircleHelp} onClick={onShowFAQChatbot}>Appointment FAQ</PortalButton></div> : null}
  </SupervisionDetailSection>;
}
