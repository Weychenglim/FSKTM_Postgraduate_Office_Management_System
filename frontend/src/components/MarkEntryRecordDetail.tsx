import { MarksHeading, MarksIcon } from './MarksPrimitives';
import { ApiError } from '../services/apiClient';
import { RecordPage } from './RecordPage';
import { formatMalaysiaDateTimeCompact as displayDateTime } from '../utils/malaysiaDateTime';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClipboardCheck,
  Lock,
  MessageSquare,
} from 'lucide-react';

import { getMarkRecordById } from '../services';
import type { MarkRecordDetail } from '../types';
import {
  PortalCard,
  StatusBadge,
  getStatusBadgeTone,
} from './PortalPrimitives';
import { ErrorState, LoadingState } from './StateViews';
import { SubmittedMarksActions, MarkCorrectionHistoryView } from './SubmittedMarksActions';

interface MarkEntryRecordDetailProps {
  onBack: () => void;
  backLabel?: string;
  recordId: string;
}

const entryStatusLabel = (status: MarkRecordDetail['entry']['status']) => ({
  NOT_STARTED: 'Not Started',
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
})[status];

export const MarkEntryRecordDetail: React.FC<MarkEntryRecordDetailProps> = ({
  onBack,
  backLabel = 'Back to Mark Entry Records',
  recordId,
}) => {
  const [record, setRecord] = useState<MarkRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadGeneration = useRef(0);

  const loadRecord = useCallback(async (propagateError = false) => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setRecord(current => current?.recordId === recordId ? current : null);
    setError(null);
    try {
      const loaded = await getMarkRecordById(recordId);
      if (generation === loadGeneration.current) setRecord(loaded);
    } catch (loadError) {
      if (generation !== loadGeneration.current) return;
      if (loadError instanceof ApiError && (loadError.status === 403 || loadError.status === 404)) {
        setRecord(current => current ? {...current, officeActions: {canCorrect: false, canReopen: false, version: null}} : null);
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Mark record could not be loaded.',
      );
      if (propagateError) throw loadError;
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void loadRecord();
    return () => {loadGeneration.current += 1;};
  }, [loadRecord]);

  if (loading && !record) {
    return <RecordPage title="Mark Entry Record Detail" backLabel={backLabel} onBack={onBack}><LoadingState message="Loading mark record..." /></RecordPage>;
  }

  if (!record) {
    return (
        <RecordPage
          title="Mark Entry Record Detail"
          backLabel={backLabel}
          onBack={onBack}
        >
        <ErrorState
          message={error || 'Mark record was not found.'}
          onRetry={loadRecord}
        />
        </RecordPage>
    );
  }

  const statusLabel = entryStatusLabel(record.entry.status);
  const totalMark = record.entry.totalMark || '-';
  const activity = [
    { label: 'Assigned', date: record.assignment.assignedAt, detail: record.assignment.assignedBy ? `By ${record.assignment.assignedBy}` : 'Automatic assignment' },
    { label: 'Submitted', date: record.entry.submittedAt, detail: '' },
    ...(record.entry.updatedAt !== record.entry.submittedAt && record.entry.updatedAt !== record.assignment.assignedAt
      ? [{ label: 'Last updated', date: record.entry.updatedAt, detail: '' }] : []),
  ].filter(event => event.date && Number.isFinite(Date.parse(event.date)))
    .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!));


  return (
      <RecordPage
        title="Mark Entry Record Detail"
        subtitle={record.recordId}
        backLabel={backLabel}
        onBack={onBack}
        actions={(
          <StatusBadge tone={record.assignment.lifecycleStatus === 'ACTIVE' ? getStatusBadgeTone(statusLabel) : record.assignment.lifecycleStatus === 'PAUSED' ? 'warning' : 'neutral'} dot>
            {record.assignment.lifecycleStatus === 'ACTIVE' ? statusLabel : record.assignment.lifecycleStatus === 'PAUSED' ? 'Paused' : 'Retired'}
          </StatusBadge>
        )}
      >

      {loading ? <p role="status" className="card-description text-slate-600">Refreshing mark record…</p> : null}
      {error ? <ErrorState message={error} onRetry={() => { void loadRecord(); }} /> : null}



    <style>{`
        .office-mark-detail dt, .office-mark-detail .card-label { font-size: 14px; font-weight: 600; color: #334155; }
        .office-mark-detail dd, .office-mark-detail .card-value { font-weight: 400; }
        .office-mark-detail aside button { max-width: 100%; }
        .office-mark-detail aside .submission-actions { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .office-mark-detail dd { font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
      `}</style>
    <div id="mark-entry-record-detail"  className="marks-workspace office-mark-detail space-y-7 animate-fade-in text-left">

      <PortalCard padding="lg" className="rounded-lg">
        <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
          <div><dt>Student</dt><dd className="mt-2">{record.student.name}</dd><dd className="mt-1 text-slate-500">{record.student.studentId}</dd></div>
          <div><dt>Programme</dt><dd className="mt-2">{record.student.programme}</dd></div>
          <div className="sm:col-span-2"><dt>Research title</dt><dd className="mt-2">{record.student.researchTitle}</dd></div>
        </dl>
      </PortalCard>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {record.assignment.lifecycleStatus === 'RETIRED' ? (
            <PortalCard padding="lg" className="rounded-lg border-slate-300 bg-slate-50">
              <h2 className="section-label">Retired evaluation task</h2>
              <p className="card-description mt-2">
                {record.assignment.retirementReason || 'The evaluator appointment ended.'}
              </p>
              <p className="card-description mt-2">
                {record.assignment.retiredBy || 'System'} · {displayDateTime(record.assignment.retiredAt)}
              </p>
            </PortalCard>
          ) : record.assignment.lifecycleStatus === 'PAUSED' ? (
            <PortalCard padding="lg" className="rounded-lg border-amber-200 bg-amber-50">
              <h2 className="section-label text-amber-800">Paused evaluation task</h2>
              <p className="card-description mt-2 text-amber-800">
                {record.assignment.pauseReason || 'The Student is temporarily ineligible for evaluation activity.'}
              </p>
              <p className="card-description mt-2 text-amber-700">
                {record.assignment.pausedBy || 'System'} · {displayDateTime(record.assignment.pausedAt)}
              </p>
            </PortalCard>
          ) : null}


          <PortalCard padding="none" className="overflow-hidden rounded-lg">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="flex items-center gap-3"><MarksIcon icon={ClipboardCheck}/><h2 className="section-label">Assessment results</h2></div>
              {record.entry.isLocked ? <StatusBadge tone="neutral" icon={Lock}>Read-only</StatusBadge> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left">
                <caption className="sr-only">Component marks and evaluator feedback</caption>
                <thead className="bg-slate-50 text-sm font-semibold text-slate-700">
                  <tr><th className="w-[56%] px-6 py-4">Component</th><th className="w-[22%] px-3 py-4 text-right">Maximum</th><th className="w-[22%] px-6 py-4 text-right">Awarded</th></tr>
                </thead>
                <tbody>
                  {record.rubric.components.map(component => <React.Fragment key={component.id}>
                    <tr className="border-t border-slate-200 align-top">
                      <th scope="row" className="px-6 pt-5 pb-2 text-sm font-semibold text-slate-800">{component.name}
                        {component.description ? <p className="mt-1 text-[13px] font-normal leading-5 text-slate-500 break-words">{component.description}</p> : null}
                      </th>
                      <td className="px-3 pt-5 pb-2 text-right text-[13px] font-normal tabular-nums">{component.maxMarks}</td>
                      <td className="px-6 pt-5 pb-2 text-right text-[13px] font-normal tabular-nums">{component.marksAwarded ?? '-'}</td>
                    </tr>
                    <tr><td colSpan={3} className="px-6 pb-5">
                      <p className="text-sm font-semibold text-slate-700">Feedback</p>
                      {component.feedback && component.feedback.length > 240 ? <details className="mt-1">
                        <summary className="cursor-pointer text-[13px] leading-6 text-slate-700"><span>{component.feedback.slice(0, 240)}...</span><span className="ml-2 text-blue-700">Show full feedback</span></summary>
                        <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-700">{component.feedback}</p>
                      </details> : <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-700">{component.feedback || 'No feedback entered.'}</p>}
                    </td></tr>
                  </React.Fragment>)}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr><th className="px-6 py-4 text-sm font-semibold">Total mark</th><td className="px-3 py-4 text-right text-[13px] tabular-nums">{record.rubric.targetMark}</td><td className="px-6 py-4 text-right text-[13px] tabular-nums">{totalMark}</td></tr>
                </tfoot>
              </table>
            </div>
          </PortalCard>
          <PortalCard padding="lg" className="rounded-lg">
            <MarksHeading icon={MessageSquare}>Overall comments</MarksHeading>
            <p className="mt-3 whitespace-pre-wrap break-words text-[13px] font-normal leading-6 text-slate-700">{record.entry.comments || 'No overall comments were entered.'}</p>
          </PortalCard>
          {record.correctionHistory.length > 0 ? <PortalCard padding="lg" className="rounded-lg">
            <details><summary className="cursor-pointer text-sm font-semibold">Correction history ({record.correctionHistory.length})</summary>
              <div className="mt-5"><MarkCorrectionHistoryView events={record.correctionHistory} components={record.rubric.components}/></div>
            </details>
          </PortalCard> : null}
          {record.overrideHistory.length > 0 ? (
          <PortalCard padding="lg" className="rounded-lg">
              <h2 className="section-label">Evaluator overrides</h2>
              <div className="mt-4 space-y-4">
                {record.overrideHistory.map((event) => (
                  <div key={event.id} className="text-xs">
                    <p className="card-value">{event.newEvaluator}</p>
                    <p className="card-description mt-1">{event.reason}</p>
                    <p className="card-description mt-1">{displayDateTime(event.createdAt)}</p>
                  </div>
                ))}
              </div>
            </PortalCard>
          ) : null}

          {record.handoverHistory.length > 0 ? (
            <PortalCard padding="lg" className="rounded-lg">
              <h2 className="section-label">Appointment handover audit</h2>
              <div className="mt-4 space-y-4">
                {record.handoverHistory.map((event) => (
                  <div key={event.id} className="text-xs border-l-2 border-slate-200 pl-3">
                    <p className="card-value">{event.reason}</p>
                    <p className="card-description mt-1">{event.actorName} · {displayDateTime(event.createdAt)}</p>
                    {Object.keys(event.draftSnapshot).length > 0 && (
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-2 text-xs text-slate-600 whitespace-pre-wrap">
                        {JSON.stringify(event.draftSnapshot, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </PortalCard>
          ) : null}
        </div>
        <aside>
          <PortalCard padding="lg" className="rounded-lg">
            <h2 className="section-label">Evaluation details</h2>
            <dl className="mt-5 space-y-5">
              {[
                ['Evaluator', record.evaluator.name],
                ['Evaluation period', record.period.name],
                ['Rubric', `${record.rubric.name} / Version ${record.rubric.version}`],
              ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd className="mt-1">{value}</dd>{label === 'Evaluator' ? <dd className="mt-1 text-slate-500">{record.evaluator.roleLabel}</dd> : null}</div>)}
            </dl>
            <details className="mt-5 border-t border-slate-100 pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-600">Dates and activity</summary>

              <div className="mt-5">
                <p className="mb-4 text-[13px] font-normal text-slate-500">Malaysia time (UTC+08:00)</p>
                <h3 className="text-sm font-semibold text-slate-700">Entry schedule</h3>
                <dl className="mt-3 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3">
                  <div><dt>Opens</dt><dd className="mt-1">{displayDateTime(record.period.opensAt)}</dd></div>
                  <div><dt>Closes</dt><dd className="mt-1">{displayDateTime(record.period.closesAt)}</dd></div>
                </dl>
                <h3 className="mt-6 text-sm font-semibold text-slate-700">Activity</h3>
                {activity.length ? <ol className="mt-4 ml-1 border-l border-slate-200">
                  {activity.map(event => <li key={event.label} className="relative ml-4 pb-5 last:pb-0">
                    <span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-4 ring-white"/>
                    <p className="text-sm font-semibold text-slate-700">{event.label}</p>
                    <p className="mt-1 text-[13px] font-normal leading-5 text-slate-600">{displayDateTime(event.date)}</p>
                    {event.detail ? <p className="mt-1 text-[13px] font-normal leading-5 text-slate-500">{event.detail}</p> : null}
                  </li>)}
                </ol> : <p className="mt-3 text-[13px] text-slate-500">No activity recorded.</p>}
              </div>
            </details>
            <SubmittedMarksActions key={record.recordId} record={record}
              onChanged={async () => { await loadRecord(true); }}
              onReload={async () => { await loadRecord(true); }}/>
          </PortalCard>
        </aside>
      </div>
    </div>
    </RecordPage>
  );
};
