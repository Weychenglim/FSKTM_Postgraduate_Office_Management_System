/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { PortalButton } from './PortalPrimitives';

export type ListChipOption<T extends string> = { value: T; label: string; count?: number | null };

export function ListChips<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: ReadonlyArray<ListChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(option => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30 ${
              on ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
            {typeof option.count === 'number' && <span className={on ? 'text-white/70' : 'text-slate-400'}>{option.count.toLocaleString()}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const ListSearch: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, placeholder, value, onChange }) => (
  <div className="relative min-w-0 flex-1 basis-60">
    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
      <Search className="h-4 w-4" aria-hidden="true" />
    </span>
    <input
      type="search"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={event => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[13px] font-semibold text-slate-700 shadow-3xs outline-none transition placeholder:text-slate-450 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
    />
  </div>
);

export const ListFiltersButton: React.FC<{ open: boolean; active?: number; onToggle: () => void }> = ({ open, active = 0, onToggle }) => (
  <PortalButton variant="secondary" size="md" icon={SlidersHorizontal} aria-expanded={open} onClick={onToggle}>
    Filters{active > 0 ? ` (${active})` : ''}
  </PortalButton>
);

export const ListToolbar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-list-toolbar className="flex flex-col gap-3">{children}</div>
);

export const ListToolbarRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-center gap-2">{children}</div>
);
