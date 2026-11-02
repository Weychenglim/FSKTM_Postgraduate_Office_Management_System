/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router';
import { CircleAlert, ChevronRight } from 'lucide-react';
import { APP_ROUTES } from '../constants/routes';
import type { EvaluationPeriodOption, RubricVersion } from '../types';
import { buildMarksAttentionItems } from '../utils/marksProductionManagement';
import { MarksHeading } from './MarksPrimitives';

interface AlertListCardProps {
  periods: EvaluationPeriodOption[];
  rubrics: RubricVersion[];
  onViewRecords: (filter: 'All Records' | 'Overdue') => void;
  onManageRubrics: () => void;
}

export function AlertListCard({ periods, rubrics, onViewRecords, onManageRubrics }: AlertListCardProps) {
  const items = buildMarksAttentionItems(periods, rubrics).filter(item => item.count > 0);
  const hasTasks = periods.some(period => period.lifecycleStatus !== 'ARCHIVED' && period.taskTotals.total > 0);
  const missingPeriod = !periods.some(period => period.lifecycleStatus !== 'ARCHIVED');
  const missingSetup = missingPeriod || !rubrics.some(rubric => rubric.isActive && !rubric.isArchived && rubric.isReady);
  return <aside id="attention-needed-card" aria-label="Evaluation checks" className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
    <MarksHeading icon={CircleAlert}>Evaluation checks</MarksHeading>
    <p className="card-description mt-2"><span className="font-semibold">All non-archived periods</span> and available rubric families.</p>
    {missingSetup ? <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
      <p>{missingPeriod ? 'Start by configuring a mark entry period.' : 'Prepare an active rubric before lecturers begin mark entry.'}</p>
      {missingPeriod ? <Link to={APP_ROUTES.marksConfig} className="mt-1 inline-flex min-h-11 items-center gap-1 rounded px-1 font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Configure period<ChevronRight aria-hidden="true" focusable="false" className="h-4 w-4" /></Link> : null}
    </div> : null}
    {items.length ? <div className="mt-4 divide-y divide-slate-100">{items.map(item => <button key={item.id} type="button"
      onClick={() => item.id === 'rubric' ? onManageRubrics() : onViewRecords(item.id === 'overdue' ? 'Overdue' : 'All Records')}
      className="flex w-full items-start justify-between gap-3 rounded-lg py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <span className="min-w-0"><span className="text-sm font-semibold text-brand-navy">{item.title}</span><span className={`mt-1 block text-xs leading-relaxed ${item.id === 'overdue' ? 'text-rose-700' : 'text-slate-600'}`}>{item.subtext}</span></span>
      <ChevronRight aria-hidden="true" focusable="false" className="mt-1 h-4 w-4 shrink-0 text-blue-700" />
    </button>)}</div> : !missingSetup ? <p className="card-description mt-4">{!hasTasks ? 'No submissions to review yet.' : 'No submission or rubric issues are currently reported.'}</p> : null}
  </aside>;
}
