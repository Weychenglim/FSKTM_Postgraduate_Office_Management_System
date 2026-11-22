import React from 'react';
import type { StudentResearchProfileSummary } from '../types/appointment';
import { appointmentDetailTypography as typography } from './AppointmentPrimitives';
import { ResearchAbstract } from './ResearchAbstract';
import {SupervisionResearchCard} from './SupervisionDetailLayout';

/** The student's current saved profile, shared by both appointment overviews. */
export function StudentResearchProfileSection({ profile, standalone = false, actions }: {
  profile: StudentResearchProfileSummary; standalone?:boolean; actions?:React.ReactNode;
}) {
  if (standalone) return <SupervisionResearchCard profile={profile} actions={actions}/>;
  return <section aria-label="Research profile" className="space-y-6 border-t border-slate-200 pt-6">
    <h3 className={typography.heading}>Research profile</h3>
    <dl className="space-y-6">
      <div className="space-y-2">
        <dt className={typography.label}>Current research title</dt>
        <dd className={`${typography.name} [overflow-wrap:anywhere]`}>{profile.title?.trim() || 'Not recorded'}</dd>
      </div>
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {([['Programme', profile.programme], ['Research area', profile.area]] as const).map(([label, value]) =>
          <div key={label} className="space-y-2"><dt className={typography.label}>{label}</dt>
            <dd className={`${typography.body} [overflow-wrap:anywhere]`}>{value?.trim() || 'Not recorded'}</dd></div>)}
      </div>
      <div className="space-y-2"><dt className={typography.label}>Abstract</dt>
        <dd><ResearchAbstract value={profile.abstract} /></dd>
      </div>
    </dl>
  </section>;
}
