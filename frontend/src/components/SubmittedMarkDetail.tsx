import { MarksHeading } from './MarksPrimitives';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock, ClipboardCheck, MessageSquare } from 'lucide-react';

import { RecordPage } from './RecordPage';
import type { EvaluationTask } from '../types';
import { formatMalaysiaDateTimeCompact as formatMalaysiaDateTime } from '../utils/malaysiaDateTime';
import {
  PortalCard,
  StatusBadge,
} from './PortalPrimitives';

interface SubmittedMarkDetailProps {
  task: EvaluationTask;
  backLabel?: string;
  routed?: boolean;
  onBack: () => void;
}

export const SubmittedMarkDetail: React.FC<SubmittedMarkDetailProps> = ({
  task,
  onBack,
  backLabel = 'Back to Marks Entry',
  routed = false,
}) => {
  const components = task.components || [];
  const calculatedTotal = components.reduce(
    (total, component) => total + Number(component.marksAwarded || 0),
    0,
  );
  const maximum = components.reduce(
    (total, component) => total + Number(component.maxMarks),
    0,
  );
  const total = task.totalMark === null || task.totalMark === undefined
    ? calculatedTotal.toFixed(2)
    : Number(task.totalMark).toFixed(2);

  const role = task.evaluatorRoleLabel || (task.evaluatorRole === 'SUPERVISOR' ? 'Supervisor' : task.evaluatorRole === 'BACKUP' ? 'Backup evaluator' : 'Panel member');
  const activity = [
    ...(task.assignedAt ? [{ label: 'Assigned', date: task.assignedAt }] : []),
    ...(task.submittedAt ? [{ label: 'Submitted', date: task.submittedAt }] : []),
  ].filter(event => Number.isFinite(Date.parse(event.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  return (
    <RecordPage
      title="Submitted Mark Detail"
      subtitle="Review submitted scores and evaluator feedback."
      backLabel={backLabel}
      onBack={onBack}
      pageKey={routed ? undefined : `marks-submitted:${task.id}`}
      actions={<StatusBadge tone="success" icon={Lock}>Submitted</StatusBadge>}
    >
      <div className="marks-workspace space-y-7 text-left">
        <PortalCard padding="lg" className="rounded-lg">
          <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-slate-700">Student</dt>
              <dd className="mt-2 text-[13px] font-normal leading-6 text-slate-700">{task.studentName}</dd>
              <dd className="mt-1 text-[13px] font-normal text-slate-500">{task.studentId}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-700">Semester</dt>
              <dd className="mt-2 text-[13px] font-normal leading-6 text-slate-700">{task.semester || 'Not recorded'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold text-slate-700">Research title</dt>
              <dd className="mt-2 break-words text-[13px] font-normal leading-6 text-slate-700">{task.researchTitle || 'Not recorded'}</dd>
            </div>
          </dl>
        </PortalCard>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <PortalCard padding="none" className="overflow-hidden rounded-lg">
              <div className="border-b border-slate-200 px-6 py-5">
                <MarksHeading icon={ClipboardCheck}>Assessment results</MarksHeading>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left">
                  <caption className="sr-only">Submitted marks and feedback by rubric component</caption>
                  <thead className="bg-slate-50 text-sm font-semibold text-slate-700">
                    <tr>
                      <th scope="col" className="w-[56%] px-6 py-4">Component</th>
                      <th scope="col" className="w-[22%] px-3 py-4 text-right">Maximum</th>
                      <th scope="col" className="w-[22%] px-6 py-4 text-right">Awarded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map(component => (
                      <React.Fragment key={component.id}>
                        <tr className="border-t border-slate-200 align-top">
                          <th scope="row" className="break-words px-6 pt-5 pb-2 text-sm font-semibold text-slate-800">
                            {component.name}
                            {component.description ? <p className="mt-1 break-words text-[13px] font-normal leading-5 text-slate-500">{component.description}</p> : null}
                          </th>
                          <td className="px-3 pt-5 pb-2 text-right text-[13px] font-normal tabular-nums">{component.maxMarks}</td>
                          <td className="px-6 pt-5 pb-2 text-right text-[13px] font-normal tabular-nums">{component.marksAwarded ?? '-'}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-6 pb-5">
                            <p className="text-sm font-semibold text-slate-700">Feedback</p>
                            {component.feedback && component.feedback.length > 240 ? (
                              <details className="group mt-1">
                                <summary className="cursor-pointer text-[13px] leading-6 text-slate-700">
                                  <span className="group-open:hidden">{component.feedback.slice(0, 240)}… </span>
                                  <span className="text-blue-700 group-open:hidden">Show full feedback</span>
                                  <span className="hidden text-blue-700 group-open:inline">Hide full feedback</span>
                                </summary>
                                <p className="mt-2 whitespace-pre-wrap break-words text-[13px] font-normal leading-6 text-slate-700">{component.feedback}</p>
                              </details>
                            ) : <p className="mt-1 whitespace-pre-wrap break-words text-[13px] font-normal leading-6 text-slate-700">{component.feedback || 'No feedback entered.'}</p>}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      <th scope="row" className="px-6 py-4 text-sm font-semibold text-slate-700">Total mark</th>
                      <td className="px-3 py-4 text-right text-[13px] font-normal tabular-nums">{maximum.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-[13px] font-normal tabular-nums">{total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </PortalCard>
            <PortalCard padding="lg" className="rounded-lg">
              <MarksHeading icon={MessageSquare}>Overall comments</MarksHeading>
              <p className="mt-3 whitespace-pre-wrap break-words text-[13px] font-normal leading-6 text-slate-700">{task.comments || 'No overall comments were entered.'}</p>
            </PortalCard>
          </div>

          <aside>
            <PortalCard padding="lg" className="rounded-lg">
              <h2 className="section-label">Evaluation details</h2>
              <dl className="mt-5 space-y-5">
                {[
                  ['Evaluator role', role],
                  ...(task.periodName ? [['Evaluation period', task.periodName]] : []),
                  ...(task.rubricName ? [['Rubric', `${task.rubricName}${task.rubricVersion ? ` / Version ${task.rubricVersion}` : ''}`]] : []),
                ].map(([label, value]) => <div key={label}>
                  <dt className="text-sm font-semibold text-slate-700">{label}</dt>
                  <dd className="mt-1 break-words text-[13px] font-normal leading-6 text-slate-700">{value}</dd>
                </div>)}
              </dl>
              <details className="mt-5 border-t border-slate-100 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-600">Dates and activity</summary>
                <div className="mt-5">                  <p className="mb-4 text-[13px] font-normal text-slate-500">Malaysia time (UTC+08:00)</p>
                  {task.opensAt || task.closesAt ? <>
                    <h3 className="text-sm font-semibold text-slate-700">Entry schedule</h3>
                    <dl className="mt-3 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3">
                      {([['Opens', task.opensAt], ['Closes', task.closesAt]] as const).filter(([, date]) => date).map(([label, date]) => <div key={label}>
                        <dt className="text-sm font-semibold text-slate-700">{label}</dt>
                        <dd className="mt-1 break-words text-[13px] font-normal leading-6 text-slate-700">{formatMalaysiaDateTime(date)}</dd>
                      </div>)}
                    </dl>
                  </> : null}
                  <h3 className={`${task.opensAt || task.closesAt ? 'mt-6 ' : ''}text-sm font-semibold text-slate-700`}>Activity</h3>
                  {activity.length ? <ol className="mt-4 ml-1 border-l border-slate-200">
                    {activity.map(event => <li key={event.label} className="relative ml-4 pb-5 last:pb-0">
                      <span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-4 ring-white" />
                      <p className="text-sm font-semibold text-slate-700">{event.label}</p>
                      <p className="mt-1 text-[13px] font-normal leading-5 text-slate-600">{formatMalaysiaDateTime(event.date)}</p>
                    </li>)}
                  </ol> : task.submittedDate ? <p className="mt-3 text-[13px] font-normal leading-5 text-slate-600">Submitted: {task.submittedDate}</p>
                    : <p className="mt-3 text-[13px] text-slate-500">No activity recorded.</p>}
                </div>
              </details>
              <p className="mt-5 border-t border-slate-100 pt-4 text-[13px] font-normal leading-6 text-slate-500">This submission is locked. Contact the Postgraduate Office if a correction is needed.</p>
            </PortalCard>
          </aside>
        </div>
      </div>
    </RecordPage>
  );
};
