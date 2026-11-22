import React from 'react';
import {ChevronDown} from 'lucide-react';

/** Read-only field hierarchy, scoped to the primary appointment request. */
export function SupervisorRequestField({label, value}: {label: string; value?: string | null}) {
  return <div className="grid min-w-0 gap-1 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
    <dt className="text-xs font-medium leading-6 text-slate-600">{label}</dt>
    <dd className="min-w-0 whitespace-pre-wrap text-sm font-normal leading-6 text-slate-900 [overflow-wrap:anywhere]">{value?.trim() || 'Not recorded'}</dd>
  </div>;
}

export function SupervisorRequestDisclosure({title, children, open, onToggle, variant = 'plain', name}: {
  title: string; children: React.ReactNode; open?: boolean; onToggle?: React.ToggleEventHandler<HTMLDetailsElement>;
  variant?: 'plain' | 'panel'; name?: string;
}) {
  const panel = variant === 'panel';
  return <details name={name} open={open} onToggle={onToggle} className={panel ? 'group min-w-0 rounded-xl border border-slate-200 open:border-blue-200' : 'group min-w-0 border-t border-slate-200'}>
    <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden ${panel
      ? 'rounded-xl bg-slate-50 px-4 py-3.5 font-semibold text-brand-navy hover:bg-blue-50 group-open:rounded-b-none group-open:bg-blue-50 group-open:text-blue-900 sm:px-5'
      : 'rounded py-3 font-medium text-brand-navy'}`}>
      <span className="min-w-0 break-words">{title}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
    </summary>
    <div className={panel ? 'min-w-0 border-t border-blue-100 px-4 sm:px-5' : 'min-w-0 space-y-4 pb-4'}>{children}</div>
  </details>;
}
