import React from 'react';
import {ClipboardList, FilePenLine, ListChecks, UsersRound} from 'lucide-react';
import type {ResearchAmendment} from '../services/researchAmendmentsApi';
import type {ApprovalStep} from '../utils/approvalProcess';
import {ApprovalProcess} from './ApprovalProcess';
import {RequestAuditHistory, RequestDetailActions} from './RequestDetailPrimitives';
import {RequestedChangesComparison} from './RequestedChangesComparison';
import {SupervisionDetailSection, supervisionDetailBody, supervisionDetailLabel} from './SupervisionDetailLayout';

/** Saved request evidence only. The caller owns access, actions and live-profile navigation. */
export function ResearchChangeRequestDetail({row, changeLabel, steps, actions, profileAction, transferTeam}: {
  row:ResearchAmendment; changeLabel:string; steps:ApprovalStep[];
  actions?:React.ReactNode; profileAction?:React.ReactNode; transferTeam?:React.ReactNode;
}) {
  return <div data-research-request-detail className="space-y-7">
    <SupervisionDetailSection title="Request overview" icon={ClipboardList} actions={profileAction}>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {([['Student',row.studentName],['Matric number',row.matricNo],['Programme at submission',row.sourceProgramme || row.before.programme],['Change type',changeLabel]] as const).map(([label,value])=><div key={label} className="min-w-0 space-y-2">
          <dt className={supervisionDetailLabel}>{label}</dt><dd className={supervisionDetailBody}>{value?.trim() || 'Not recorded'}</dd>
        </div>)}
      </dl>
    </SupervisionDetailSection>

    <div data-research-request-columns className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-7">
        <SupervisionDetailSection title="Requested changes" icon={FilePenLine}>
          <dl className="border-b border-slate-100 pb-6"><div className="space-y-2">
            <dt className={supervisionDetailLabel}>Reason for change</dt>
            <dd className={`${supervisionDetailBody} whitespace-pre-wrap`}>{row.reason?.trim() || 'Not recorded'}</dd>
          </div></dl>
          <RequestedChangesComparison key={row.id} before={row.before} after={row.after} applied={row.status==='APPROVED'} disclosure={row.kind === 'RESEARCH' ? 'review' : undefined}/>
        </SupervisionDetailSection>
        {transferTeam ? <SupervisionDetailSection title="Supervisory team at submission" icon={UsersRound}>{transferTeam}</SupervisionDetailSection> : null}
      </div>
      <aside className="min-w-0" aria-label="Request review">
        <SupervisionDetailSection title="Review and outcome" icon={ListChecks}>
          <ApprovalProcess steps={steps} headingAs="h3"/>
          {actions ? <div className="border-t border-slate-100 pt-6"><RequestDetailActions>{actions}</RequestDetailActions></div> : null}
          {row.events.length ? <div className="border-t border-slate-100 pt-6"><RequestAuditHistory events={row.events} showTeamRetention={row.kind==='TRANSFER'}/></div> : null}
        </SupervisionDetailSection>
      </aside>
    </div>
  </div>;
}
