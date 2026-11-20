import React, { useEffect, useState } from 'react';
import type { ReconciliationAudit, ReconciliationIssue } from '../types';
import { getReconciliationAudits } from '../services/workflowReconciliationApi';
import { reconciliationErrorMessage } from '../utils/workflowReconciliation';
import { CoordinatorDataTable } from './CoordinatorBrowsePrimitives';
import { ErrorState, LoadingState } from './StateViews';
import { formatMalaysiaDateTime } from '../utils/malaysiaDateTime';

export const humanizeReconciliationLabel = (value: string) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
  .toLowerCase().replaceAll('_', ' ')
  .replace(/\b\w/g, letter => letter.toUpperCase())
  .replace(/\bIds\b/g, 'IDs').replace(/\bId\b/g, 'ID');

const stateValue = (value: unknown): string => {
  if (value == null || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(stateValue).join('; ') : 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
const contextKeys = new Set(['lecturerName', 'staffNo', 'semesterLabel', 'semesterCode', 'planVersion', 'planStatus']);
const technicalKey = (key: string) => /Ids?$/.test(key) || key === 'missingAssignments';

const stageCorrectionNotes: Record<string, string> = {
  RETIRE: 'The registration correction retired this evaluation task.',
  PAUSE: 'The registration correction paused this evaluation task and kept the saved draft.',
  PRESERVE_PAUSE: 'The task stayed paused when the registration was corrected.',
  REVIEW_SUBMITTED: 'The submitted marks were kept for academic review after the registration correction.',
  REVIEW_LEGACY: 'The evaluation period has no RP1 or RP2 classification. The correction flagged the task for review.',
};

const marksEntryLabels: Record<string, string> = {
  NOT_STARTED: 'No marks entered',
  DRAFT: 'Draft saved',
  SUBMITTED: 'Submitted',
};

export function ReconciliationEvidence({ issue }: { issue: ReconciliationIssue }) {
  const legacy = issue.issueType === 'CAPACITY_LEGACY_LIMIT_DIVERGENCE';
  const stageReview = issue.issueType === 'MARKS_STAGE_REVIEW';
  const savedCorrection = issue.currentState.stageCorrection;
  const correction = stageReview && savedCorrection && typeof savedCorrection === 'object'
    ? savedCorrection as Record<string, unknown> : null;
  const correctionNote = correction && typeof correction.action === 'string' ? stageCorrectionNotes[correction.action] : undefined;
  const values = Object.entries(issue.currentState).filter(([key]) => !contextKeys.has(key)
    && !['closedWithUnfinishedWork', 'canGrantCompletionWindow', 'completionWindowBlocker'].includes(key)
    && !(stageReview && key === 'stageCorrection'));
  const facts = values.filter(([key]) => !technicalKey(key));
  const identifiers = values.filter(([key]) => technicalKey(key));
  if (correction) {
    for (const key of ['semesterId', 'studentId', 'registrationRevision']) {
      if (typeof correction[key] === 'number') identifiers.push([key, correction[key]]);
    }
  }
  const roles = [['Supervisor', 'supervisorLimit', 'legacySupervisorLimit'], ['Panel', 'panelLimit', 'legacyPanelLimit']];
  return <section aria-label="Evidence" className="space-y-5">
    {correctionNote && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <h3 className="card-value">What happened</h3>
      <p className="card-description mt-1">{correctionNote}</p>
    </div>}
    {legacy ? <CoordinatorDataTable label="Capacity limit comparison"
      columns={['Role', 'Published semester limit', 'Old profile limit', 'Comparison']}
      rows={roles.filter(([, current, old]) => issue.currentState[current] != null || issue.currentState[old] != null).map(([role, current, old]) => ({
        key: role, cells: [role, <strong>{stateValue(issue.currentState[current])}</strong>, stateValue(issue.currentState[old]),
          issue.currentState[current] === issue.currentState[old] ? 'Matches' : <span className="font-semibold text-amber-800">Different</span>],
      }))} />
      : facts.length > 0 ? <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{facts.map(([key, value]) => <div key={key} className="min-w-0">
        <dt className="card-description">{key === 'matchingSemesterCount' ? 'Semesters matching all available evidence'
          : stageReview && key === 'lifecycleStatus' ? 'Evaluation task'
          : stageReview && key === 'entryStatus' ? 'Marks entry'
          : humanizeReconciliationLabel(key)}</dt>
        <dd className="card-value mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{key === 'effectiveDeadline' && typeof value === 'string' ? formatMalaysiaDateTime(value)
          : stageReview && typeof value === 'string' ? (key === 'entryStatus' && marksEntryLabels[value]) || humanizeReconciliationLabel(value)
          : stateValue(value)}</dd>
      </div>)}</dl> : <p className="card-description">{issue.summary}</p>}
    <details className="border-t border-slate-200 pt-4">
      <summary className="card-value cursor-pointer">Record references</summary>
      <dl className="mt-4 space-y-3">
        {[['Record', `${humanizeReconciliationLabel(issue.recordType)} #${issue.recordId}`], ...identifiers].map(([key, value]) => <div key={key} className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)]">
          <dt className="card-description">{humanizeReconciliationLabel(String(key))}</dt>
          <dd className="card-value [overflow-wrap:anywhere]">{stateValue(value)}</dd>
        </div>)}
      </dl>
    </details>
  </section>;
}

export function ReconciliationAuditHistory({ issue }: { issue: ReconciliationIssue }) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ results: ReconciliationAudit[]; count?: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(''); setData(null);
    getReconciliationAudits({ entityType: issue.recordType, entityId: issue.recordId })
      .then(response => { if (active) setData(response); })
      .catch(failure => { if (active) setError(reconciliationErrorMessage(failure)); });
    return () => { active = false; };
  }, [open, issue.recordType, issue.recordId, revision]);
  return <details className="rounded-xl border border-slate-200 bg-white p-5" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="section-heading cursor-pointer">Review and repair history for this record</summary>
    {open && <div className="mt-5 space-y-4">
      {error ? <ErrorState compact message={error} onRetry={() => setRevision(value => value + 1)} />
        : !data ? <LoadingState message="Loading review history…" />
        : !data.results.length ? <p className="card-description">No reviews or repairs have been recorded for this record.</p>
        : <>
          {(data.count ?? data.results.length) > data.results.length && <p className="card-description">Showing the latest {data.results.length} of {data.count} decisions.</p>}
          <CoordinatorDataTable label="Record review history" columns={['When', 'Action', 'Person and reason']}
            rows={data.results.map(audit => ({ key: audit.id, cells: [
              new Date(audit.createdAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
              audit.action === 'ACCEPT_INTENTIONAL' ? 'Accepted as intentional' : humanizeReconciliationLabel(audit.action),
              <><p className="card-value">{audit.actor.name}</p><p className="card-description mt-1">{audit.reason}</p></>,
            ] }))} />
        </>}
    </div>}
  </details>;
}
