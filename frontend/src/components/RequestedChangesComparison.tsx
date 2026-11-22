import React, { useId } from 'react';
import type { ResearchSnapshot } from '../services/researchAmendmentsApi';
import { requestBodyTextClass } from './RequestDetailPrimitives';
import { ResearchAbstract } from './ResearchAbstract';
import { SupervisorRequestDisclosure } from './SupervisorRequestFields';

const fieldLabels = {
  programme: 'Programme',
  title: 'Title',
  abstract: 'Abstract',
  researchArea: 'Research area',
  aim: 'Statement of aim',
  researchQuestions: 'Research questions',
  researchObjectives: 'Research objectives',
  methodology: 'Methodology',
  timeline: 'Research timeline',
};
const fields = Object.keys(fieldLabels) as (keyof typeof fieldLabels)[];
const fieldList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

function changedFields(before: ResearchSnapshot, after: ResearchSnapshot) {
  return fields.filter(field => (before[field] ?? '') !== (after[field] ?? ''));
}

export function researchRevisionSummary(before: ResearchSnapshot, after: ResearchSnapshot) {
  const labels = changedFields(before, after).map(field => field === 'timeline' ? 'timeline' : fieldLabels[field].toLowerCase());
  if (!labels.length) return null;
  const summary = fieldList.format(labels);
  return `${summary[0].toUpperCase()}${summary.slice(1)} updated`;
}

/** Displays saved snapshots; never substitutes the student's live profile. */
export function RequestedChangesComparison({ before, after, applied = false, revision = false, initialRecord = false, disclosure }: {
  before: ResearchSnapshot;
  after: ResearchSnapshot;
  applied?: boolean;
  revision?: boolean;
  initialRecord?: boolean;
  disclosure?: 'preview' | 'review';
}) {
  const groupName = useId();
  if (initialRecord) return <dl className="space-y-4">{fields.filter(field => field in after).map(field => <div key={field} className="space-y-2">
    <dt className="card-value">{fieldLabels[field]}</dt>
    {field === 'abstract' ? <dd><ResearchAbstract value={after[field]} /></dd> : <dd className={`${requestBodyTextClass} rounded-lg bg-slate-50 p-3 [overflow-wrap:anywhere]`}>{after[field] || 'Not recorded'}</dd>}
  </div>)}</dl>;
  const changed = changedFields(before, after);
  const expandByDefault = disclosure === 'review' && changed.length <= 2;
  const shortField = (field: keyof typeof fieldLabels) => field === 'programme' || field === 'title' || field === 'researchArea';
  const name = (field: keyof typeof fieldLabels) => field === 'title' || field === 'abstract' ? `Research ${field}` : fieldLabels[field];
  if (!revision) return <div className={disclosure ? 'space-y-2' : 'space-y-8'} data-request-comparison>
    {changed.length ? changed.map(field => {
      const comparison = <dl className={`grid min-w-0 gap-5 ${shortField(field) ? 'sm:grid-cols-2' : ''}`}>
        {[before,after].map((snapshot,index)=><div key={index} className={`min-w-0 space-y-3 border-l-2 pl-4 ${index ? 'border-blue-200' : 'border-slate-200'}`}>
          <dt className={`text-xs font-medium leading-6 ${index ? 'text-blue-700' : 'text-slate-600'}`}>{index ? `${applied ? 'Approved' : 'Proposed'} ${fieldLabels[field].toLowerCase()}` : 'Before this request'}</dt>
          <dd className="whitespace-pre-wrap text-sm font-normal leading-7 text-slate-900 [overflow-wrap:anywhere]">{field==='abstract' ? <ResearchAbstract value={snapshot[field]} inset={false}/> : snapshot[field] || 'Not recorded'}</dd>
        </div>)}
      </dl>;
      return disclosure ? <SupervisorRequestDisclosure key={field}
        title={name(field)} variant="panel" name={expandByDefault ? undefined : groupName} open={expandByDefault || undefined}>
        <div className="py-4">{comparison}</div>
      </SupervisorRequestDisclosure> : <section key={field} aria-label={`${fieldLabels[field]} comparison`} className="min-w-0 space-y-4">
        <h3 className="text-sm font-semibold text-brand-navy">{name(field)}</h3>
        {comparison}
      </section>;
    }) : <p className="card-description">No changed fields were recorded.</p>}
  </div>;
  return <div className="space-y-4">
    {changed.length ? changed.map(field => <div key={field} className="space-y-2">
      <h4 className="card-value">{fieldLabels[field]}</h4>
      <dl className={`grid grid-cols-1 gap-3 ${shortField(field) ? 'sm:grid-cols-2' : ''}`}>
        {[before, after].map((snapshot, index) => <div key={index} className={`min-w-0 rounded-lg border p-3 ${index?'border-blue-100 bg-blue-50/50':'border-slate-100 bg-slate-50'}`}>
          <dt className="card-label">{index ? 'Recorded after revision' : 'Recorded before this revision'}</dt>
          <dd className={field === 'abstract' ? 'mt-3' : `${requestBodyTextClass} mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]`}>{field === 'abstract' ? <ResearchAbstract value={snapshot[field]} inset={false} /> : snapshot[field] || 'Not recorded'}</dd>
        </div>)}
      </dl>
    </div>) : <p className="card-description">No changed fields were recorded.</p>}
  </div>;
}
