import React from 'react';
import type { StudentProgressIdentity } from '../types/studentProgress';
import { formatMalaysiaDateTime } from '../utils/malaysiaDateTime';
import { formatProgressStatus } from '../utils/studentProgress';
import { projectStageLabel } from './AttentionProjectStage';

type Lifecycle = StudentProgressIdentity['lifecycle'];

function StatusChangeDate({effectiveAt}: {effectiveAt: string | null}) {
  return effectiveAt ? (
    <p className="card-description mt-2">
      <span className="card-label">Status changed on:</span> {formatMalaysiaDateTime(effectiveAt)}
    </p>
  ) : null;
}

export function StudentLifecycleSummary({lifecycle, projectStage, projectSemester, showStatusChange = true}: {
  lifecycle: Lifecycle;
  projectStage?: string | null;
  projectSemester?: string | null;
  showStatusChange?: boolean;
}) {
  return <section aria-label="Current academic status" className="mt-5 border-t border-slate-100 pt-4">
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      <div><dt className="card-label">Enrolment status</dt><dd className="card-value mt-1">{formatProgressStatus(lifecycle.status)}</dd></div>
      {projectStage && <div><dt className="card-label">Project stage</dt><dd className="card-value mt-1">{projectStageLabel(projectStage)}</dd></div>}
      {projectSemester && <div><dt className="card-label">Current semester</dt><dd className="card-value mt-1">{projectSemester}</dd></div>}
    </dl>
    {showStatusChange && <StatusChangeDate effectiveAt={lifecycle.effectiveAt}/>}
  </section>;
}

export function StudentLifecycleHistory({lifecycle}: {lifecycle: Lifecycle}) {
  return <section aria-label="Lifecycle audit history" className="rounded-lg border border-slate-200 bg-white p-4 font-sans text-xs">
    <h2 className="section-label">Lifecycle audit history</h2>
    <StatusChangeDate effectiveAt={lifecycle.effectiveAt}/>
    {lifecycle.changedBy && <p className="card-description mt-2"><span className="card-label">Changed by:</span> {lifecycle.changedBy}</p>}
    {lifecycle.reason && <p className="card-description mt-1 whitespace-pre-wrap"><span className="card-label">Reason:</span> {lifecycle.reason}</p>}
    {lifecycle.audits?.length ? (
      <ol className="mt-2 space-y-3">
        {lifecycle.audits.map((audit, index) => (
          <li key={`${audit.createdAt}-${index}`} className="border-l-2 border-slate-200 pl-3">
            <strong className="card-value">{formatProgressStatus(audit.previousStatus)} to {formatProgressStatus(audit.newStatus)}</strong>
            <p className="card-description mt-1 whitespace-pre-wrap">{audit.reason}</p>
            <p className="card-description mt-1">{audit.actor} · {formatMalaysiaDateTime(audit.createdAt)}</p>
          </li>
        ))}
      </ol>
    ) : <p className="card-description mt-2">No lifecycle changes recorded.</p>}
  </section>;
}
