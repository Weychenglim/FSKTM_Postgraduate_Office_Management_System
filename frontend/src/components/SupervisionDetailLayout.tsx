import React, {useId} from 'react';
import {BookOpen, type LucideIcon} from 'lucide-react';
import {IconHeading} from './IconHeading';
import {AppointmentIcon} from './AppointmentPrimitives';
import {PortalCard, StatusBadge} from './PortalPrimitives';
import {ResearchAbstract} from './ResearchAbstract';
import {ResearchSummaryProfileAction} from './ResearchSummaryProfileAction';
import {projectStageLabel} from './AttentionProjectStage';
import type {SupervisoryTeam} from '../types/coSupervision';
import type {StudentResearchProfileSummary} from '../types/appointment';

export const supervisionDetailLabel = 'text-xs font-medium leading-6 text-slate-600';
export const supervisionDetailBody = 'text-sm font-normal leading-6 text-slate-900 [overflow-wrap:anywhere]';

export function AppointmentProjectStageField({stage, semester, displayedSemester}: {
  stage?: string | null; semester?: string | null; displayedSemester?: string | null;
}) {
  if (!stage) return null;
  const projectSemester=semester?.trim();
  return <div className="min-w-0 space-y-2">
    <dt className={supervisionDetailLabel}>Project stage</dt>
    <dd className={supervisionDetailBody}>{projectStageLabel(stage)}{projectSemester && projectSemester !== displayedSemester?.trim() && <span className="mt-1 block text-xs leading-5 text-slate-600">{projectSemester}</span>}</dd>
  </div>;
}

export function SupervisionDetailSection({title, icon, actions, children, contentClassName}: {
  title:string; icon:LucideIcon; actions?:React.ReactNode; children:React.ReactNode; contentClassName?:string;
}) {
  const id=useId();
  return <PortalCard padding="lg" role="region" aria-labelledby={id}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <IconHeading titleId={id} title={title} titleClassName="text-base font-semibold text-brand-navy" icon={<AppointmentIcon icon={icon} tone="info"/>}/>
      {actions}
    </div>
    <div className={contentClassName ?? "mt-6 min-w-0 space-y-6"}>{children}</div>
  </PortalCard>;
}

export function SupervisionOverview({team, context, actions}: {
  team:SupervisoryTeam; context?:{semester?:string;email?:string}; actions?:React.ReactNode;
}) {
  const email=team.studentEmail || context?.email;
  return <PortalCard padding="lg" role="region" aria-label="Student overview">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0 space-y-2"><p className={supervisionDetailLabel}>Student</p>
        <h2 className="text-lg font-semibold leading-relaxed text-brand-navy [overflow-wrap:anywhere]">{team.studentName}</h2>
        <p className="text-sm text-slate-600 [overflow-wrap:anywhere]">{team.matricNo}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
    <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
      <div className="min-w-0 space-y-2"><dt className={supervisionDetailLabel}>Programme</dt><dd className={supervisionDetailBody}>{team.programme || 'Not recorded'}</dd></div>
      {email ? <div className="min-w-0 space-y-2"><dt className={supervisionDetailLabel}>Student email</dt><dd className={supervisionDetailBody}><a className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-blue-600" href={`mailto:${email}`}>{email}</a></dd></div> : null}
      <div className="min-w-0 space-y-2 sm:col-start-1"><dt className={supervisionDetailLabel}>Enrolment status</dt><dd className={`${supervisionDetailBody} capitalize`}>{team.studentStatus.replaceAll('_',' ').toLowerCase() || 'Not recorded'}</dd></div>
      <AppointmentProjectStageField stage={team.projectStage} semester={team.projectSemester} displayedSemester={context?.semester}/>
    </dl>
  </PortalCard>;
}

/** Public contact fields use the same reading order for every team member. */
export function SupervisionContactDetails({department,email,appointedOn}: {department?:string;email?:string;appointedOn?:string|null}) {
  return <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
    <div className="min-w-0 space-y-2"><dt className={supervisionDetailLabel}>Department</dt><dd className={supervisionDetailBody}>{department?.trim() || 'Not recorded'}</dd></div>
    <div className="min-w-0 space-y-2"><dt className={supervisionDetailLabel}>Email</dt><dd className={supervisionDetailBody}>{email?.trim() ? <a href={`mailto:${email}`} className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">{email}</a> : 'Not recorded'}</dd></div>
    <div className="min-w-0 space-y-2"><dt className={supervisionDetailLabel}>Appointed on</dt><dd className={supervisionDetailBody}>{appointedOn || 'Not recorded'}</dd></div>
  </dl>;
}

export function SupervisionPerson({name,role,department,email,appointedOn,children,status = 'Active'}: {
  name:string;role:string;department?:string;email?:string;appointedOn?:string|null;children?:React.ReactNode;status?:string;
}) {
  return <article aria-label={role} className="min-w-0 space-y-4">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0 space-y-1"><h3 className="text-sm font-semibold leading-6 text-slate-900 [overflow-wrap:anywhere]">{name}</h3><p className="text-xs leading-6 text-slate-600">{role}</p></div><StatusBadge tone={status === 'Active' ? 'success' : 'neutral'}>{status}</StatusBadge></div>
    <SupervisionContactDetails department={department} email={email} appointedOn={appointedOn}/>
    {children}
  </article>;
}

/** Team members are rows within one team surface, rather than cards inside cards. */
export function SupervisionMember({label,name,status,tone,children,actions}: {
  label:string;name:string;status:string;tone:React.ComponentProps<typeof StatusBadge>['tone'];
  children?:React.ReactNode;actions?:React.ReactNode;
}) {
  return <section aria-label={label} className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-4"><h3 className={supervisionDetailLabel}>{label}</h3>{actions ? <div data-member-heading-actions className="flex flex-wrap items-center gap-3">{actions}</div> : null}</div>
    <div className="flex flex-wrap items-start justify-between gap-3"><p className={supervisionDetailBody}>{name}</p><StatusBadge tone={tone}>{status}</StatusBadge></div>
    {children}
  </section>;
}

export function SupervisionResearchCard({profile, actions, matricNo, returnLabel, showProgramme = true}: {
  profile:Partial<StudentResearchProfileSummary>; actions?:React.ReactNode; matricNo?:string; returnLabel?:string; showProgramme?:boolean;
}) {
  const hasResearch=!!(profile.title?.trim() || profile.area?.trim() || profile.abstract?.trim());
  const abstract = profile.abstract?.trim() ?? '';
  const compactAbstract = abstract.replace(/\s+/g, ' ');
  const limit = 280;
  const preview = compactAbstract.length > limit
    ? compactAbstract.slice(0, limit).replace(/\s+\S*$/, '') + '…'
    : abstract;
  return <section aria-label="Research summary" data-supervision-research>
    <SupervisionDetailSection title="Research summary" icon={BookOpen} actions={actions ?? (returnLabel && <ResearchSummaryProfileAction matricNo={matricNo} returnLabel={returnLabel}/>)}>
      {hasResearch ? <dl className="space-y-6">
        <div className="space-y-2"><dt className={supervisionDetailLabel}>Current research title</dt><dd className="text-lg font-normal leading-8 text-slate-900 [overflow-wrap:anywhere]">{profile.title?.trim() || 'Not recorded'}</dd></div>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{([...(showProgramme ? [['Programme',profile.programme]] : []), ['Research area',profile.area]]).map(([label,value])=><div key={label} className="min-w-0 space-y-2"><dt className={supervisionDetailLabel}>{label}</dt><dd className={supervisionDetailBody}>{value?.trim() || 'Not recorded'}</dd></div>)}</div>
        <div className="space-y-3 border-t border-slate-100 pt-6"><dt className={supervisionDetailLabel}>Abstract</dt><dd>
          {compactAbstract.length > limit ? <details className="group/abstract">
            <summary className="list-none cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
              <span className="block text-sm leading-7 text-slate-700 [overflow-wrap:anywhere] group-open/abstract:hidden">{preview}</span>
              <span className="mt-2 inline-block text-sm font-medium text-blue-700 group-open/abstract:hidden">Read full abstract</span>
              <span className="hidden text-sm font-medium text-blue-700 group-open/abstract:inline-block">Show less</span>
            </summary>
            <div className="mt-2"><ResearchAbstract value={abstract} inset={false}/></div>
          </details> : <ResearchAbstract value={abstract} inset={false}/>}
        </dd></div>
      </dl> : <p className={supervisionDetailBody}>No current research profile is available.</p>}
    </SupervisionDetailSection>
  </section>;
}
