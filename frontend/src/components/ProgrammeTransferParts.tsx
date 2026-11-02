/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, Minus, X } from 'lucide-react';
import type { TransferStep } from '../utils/programmeTransfers';

export const ProgrammePill: React.FC<{ programme: string; muted?: boolean }> = ({ programme, muted = false }) => (
  <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-[12px] font-bold leading-5 [overflow-wrap:anywhere] ${muted ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-800'}`}>
    {programme || 'No programme'}
  </span>
);

const DOT: Record<TransferStep['state'], string> = {
  done: 'bg-emerald-100 text-emerald-700',
  now: 'bg-amber-50 text-amber-800 ring-2 ring-inset ring-amber-400',
  next: 'bg-slate-100 text-slate-500',
  skipped: 'bg-slate-100 text-slate-400',
  rejected: 'bg-rose-100 text-rose-700',
  stopped: 'bg-slate-100 text-slate-400',
};

export const TransferStepList: React.FC<{ steps: TransferStep[] }> = ({ steps }) => (
  <ol className="space-y-0" aria-label="Steps">
    {steps.map((step, index) => (
      <li key={step.key} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
        {index < steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[0.8125rem] top-7 w-0.5 bg-slate-200" />}
        <span className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-extrabold ${DOT[step.state]}`}>
          {step.state === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden="true" />
            : step.state === 'rejected' ? <X className="h-3.5 w-3.5" aria-hidden="true" />
              : step.state === 'skipped' || step.state === 'stopped' ? <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                : index + 1}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[14px] font-extrabold text-brand-navy">{step.label}</p>
          <p className={`text-[13px] ${step.state === 'now' ? 'font-semibold text-amber-800' : step.state === 'rejected' ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>{step.detail}</p>
          {step.note && <p className="mt-1 text-[13px] text-slate-700">"{step.note}"</p>}
        </div>
      </li>
    ))}
  </ol>
);

export const StaysWithStudent: React.FC<{ primary: string; coSupervisors: string[]; panel: string[]; unfinished: number | null }> = ({
  primary, coSupervisors, panel, unfinished,
}) => {
  const rows: Array<[string, string]> = [
    ['Supervisor', primary || 'None yet'],
    ['Co-supervisors', coSupervisors.join(', ') || 'None'],
    ['Panel', panel.join(', ') || 'None yet'],
    ['Unfinished evaluation tasks', unfinished === null ? 'Not shown to you' : String(unfinished)],
  ];
  return (
    <section aria-label="Stays with the student" className="app-card space-y-3 p-5 sm:p-6">
      <h2 className="section-label">Stays with the student</h2>
      <dl className="divide-y divide-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5 text-[13px]">
            <dt className="text-slate-600">{label}</dt>
            <dd className="text-right font-bold text-slate-900 [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[12px] text-slate-500">Supervisors, panel, marks and tasks stay as they are. The transfer adds no workload.</p>
    </section>
  );
};
