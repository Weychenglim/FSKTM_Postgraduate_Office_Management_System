import React from 'react';
import {BookOpen, BookOpenText, Clock3} from 'lucide-react';
import {AppointmentIcon} from './AppointmentPrimitives';
import {PortalButton, PortalCard} from './PortalPrimitives';
import {ResearchAbstract} from './ResearchAbstract';
import {SupervisionDetailSection, supervisionDetailLabel, supervisionDetailBody} from './SupervisionDetailLayout';
import {SupervisorResearchIntentSection} from './SupervisorResearchIntent';
import type {ResearchAmendmentOptions} from '../services/researchAmendmentsApi';

/** Current values only. Historical comparisons remain separate saved snapshots. */
export function ResearchProfileDetail({options, actions, hasPendingResearch, onViewPendingRequest, busy}: {
  options:ResearchAmendmentOptions; actions?:React.ReactNode; hasPendingResearch?:boolean;
  onViewPendingRequest?:()=>void; busy?:boolean;
}) {
  const profile=options.profile;
  if(!profile)return null;
  const student=options.students.find(row=>row.id===profile.studentId);
  const intent = profile.currentIntent ?? profile.submittedIntent?.record;
  return <div className="space-y-5 sm:space-y-6" data-research-profile-detail>
    <PortalCard padding="md" role="region" aria-label="Student overview">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 space-y-2">
          <h2 className="text-lg font-semibold leading-relaxed text-brand-navy [overflow-wrap:anywhere]">{student?.name || 'Student name not recorded'}</h2>
          {student?.matricNo ? <p className="text-sm text-slate-600 [overflow-wrap:anywhere]">{student.matricNo}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <dl className="mt-3"><div className="space-y-0.5">
        <dt className={supervisionDetailLabel}>Current programme</dt><dd className={supervisionDetailBody}>{profile.programme?.trim() || 'Not recorded'}</dd>
      </div></dl>
      {hasPendingResearch && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AppointmentIcon icon={Clock3} tone="warning" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-amber-900">Awaiting supervisor review</p>
              <p className="text-sm leading-5 text-slate-700">Your research profile updates when your supervisor approves the request.</p>
            </div>
          </div>
          {onViewPendingRequest && (
            <PortalButton size="sm" className="min-h-11 self-start normal-case! tracking-normal! sm:min-h-9 sm:shrink-0 sm:self-auto" disabled={busy} onClick={onViewPendingRequest}>
              View request
            </PortalButton>
          )}
        </div>
      )}
    </PortalCard>
    <div data-current-research>
      <SupervisionDetailSection title="Current research" icon={BookOpen}>
        <dl className="space-y-6">
          <div className="space-y-2">
            <dt className="sr-only">Research title</dt>
            <dd className="text-xl font-semibold leading-snug text-brand-navy [overflow-wrap:anywhere] sm:text-2xl">{profile.title?.trim() || 'Not recorded'}</dd>
          </div>
          <div className="space-y-2">
            <dt className={supervisionDetailLabel}>Research area</dt>
            <dd className={supervisionDetailBody}>{profile.researchArea?.trim() || 'Not recorded'}</dd>
          </div>
          <div className="space-y-3 border-t border-slate-100 pt-6">
            <dt className="text-base font-semibold text-brand-navy">Abstract</dt>
            <dd><ResearchAbstract value={profile.abstract} inset={false}/></dd>
          </div>
        </dl>
      </SupervisionDetailSection>
    </div>
    {intent ? <PortalCard padding="lg">
      <SupervisorResearchIntentSection record={intent} embedded headingAs="h2" profileView />
    </PortalCard> : <SupervisionDetailSection title="Current research plan" icon={BookOpenText}>
      <p className={supervisionDetailBody}>No research intent on record.</p>
    </SupervisionDetailSection>}
  </div>;
}
