/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { AppointmentIcon } from './AppointmentPrimitives';

type Tone = React.ComponentProps<typeof AppointmentIcon>['tone'];

interface SummaryCardButtonProps {
  title: string;
  value: React.ReactNode;
  caption?: string;
  description: string;
  icon: LucideIcon;
  tone?: Tone;
  selected?: boolean;
  /** Leave it out for a figure that opens nothing. */
  onClick?: () => void;
}

/** A summary figure at the top of a workspace; clicking it opens the list behind it. */
export const SummaryCardButton: React.FC<SummaryCardButtonProps> = ({ title, value, caption, description, icon, tone = 'info', selected = false, onClick }) => {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <AppointmentIcon icon={icon} tone={tone} />
        {onClick && <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />}
      </div>
      <h2 className="card-value text-slate-800">{title}</h2>
      <p className="flex items-baseline gap-1.5">
        <span className="card-metric">{value}</span>
        {caption && <span className="card-caption">{caption}</span>}
      </p>
      <p className="card-description">{description}</p>
    </>
  );
  if (!onClick) return <article aria-label={title} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">{body}</article>;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`group space-y-3 rounded-2xl border bg-white p-5 text-left shadow-sm transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${selected ? 'border-brand-navy bg-slate-50/70' : 'border-slate-200 hover:border-slate-300'}`}
    >
      {body}
    </button>
  );
};
