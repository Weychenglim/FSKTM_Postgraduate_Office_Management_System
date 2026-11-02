/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import { shortProgramme } from '../utils/programmeTransfers';
import { intakeFilterOptions, shortSemester, studentCount } from '../utils/registrySemesters';
import { PortalButton } from './PortalPrimitives';
import { SelectMenu } from './SelectMenu';

export interface RegistryPerson {
  matric: string;
  name: string;
  programme: string;
  avatarText: string;
  avatarBg: string;
  intake?: string;
}

const Avatar: React.FC<{ person: RegistryPerson }> = ({ person }) => (
  <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[12px] font-extrabold ${person.avatarBg}`}>{person.avatarText}</span>
);

const Who: React.FC<{ person: RegistryPerson; detail?: React.ReactNode }> = ({ person, detail }) => (
  <div className="min-w-0 flex-[1_1_12rem]">
    <p className="text-[14px] font-bold text-slate-900 [overflow-wrap:anywhere]">{person.name}</p>
    <p className="text-[12.5px] text-slate-500 [overflow-wrap:anywhere]">
      {person.matric} &middot; {shortProgramme(person.programme) || 'No programme'}
      {person.intake ? <> &middot; {shortSemester(person.intake)}</> : null}
    </p>
    {detail}
  </div>
);

/** One student in a list: who they are, an optional line about them, and what you can do about them. */
export const PersonRow: React.FC<{ person: RegistryPerson; detail?: React.ReactNode; action?: React.ReactNode; muted?: boolean }> = ({ person, detail, action, muted = false }) => (
  <li className={`flex flex-wrap items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0 ${muted ? 'opacity-55' : ''}`}>
    <Avatar person={person} />
    <Who person={person} detail={detail} />
    {action && <div className="ml-12 shrink-0 sm:ml-0">{action}</div>}
  </li>
);

/** A student to tick in a list. The whole row is the tick box. */
export const PersonTickRow: React.FC<{ person: RegistryPerson; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; detail?: React.ReactNode; badge?: React.ReactNode }> = ({ person, checked, onChange, disabled = false, detail, badge }) => (
  <li>
    <label className={`flex cursor-pointer flex-wrap items-start gap-x-3 gap-y-2 px-5 py-3.5 transition sm:px-6 ${checked ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}>
      <input type="checkbox" aria-label={person.name} className="mt-2.5 h-[18px] w-[18px] shrink-0 cursor-pointer" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      <Avatar person={person} />
      <Who person={person} detail={detail} />
      {badge && <div className="ml-[3.75rem] mt-0.5 shrink-0 sm:ml-0">{badge}</div>}
    </label>
  </li>
);

/** Floats at the bottom of the screen once someone is ticked, so the action is always in reach on a long list. */
export const SelectionBar: React.FC<{ count: number; label: string; onClear: () => void; onAction: () => void; busy?: boolean; problem?: string | null }> = ({ count, label, onClear, onAction, busy = false, problem }) => (
  <>
    <div aria-hidden="true" className="h-20" />
    <div role="region" aria-label="Selected students" className="fixed bottom-4 left-1/2 z-30 flex w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-brand-navy px-5 py-3 text-[13.5px] font-bold text-white shadow-lg">
      <span>
        {studentCount(count)} selected
        <button type="button" disabled={busy} className="ml-3 font-semibold text-slate-300 underline cursor-pointer" onClick={onClear}>Clear</button>
      </span>
      <PortalButton isLoading={busy} onClick={onAction}>{label}</PortalButton>
      {problem && <p role="alert" className="w-full text-[12.5px] font-semibold text-rose-200">{problem}</p>}
    </div>
  </>
);

/** Narrow a list of students by programme, intake or name. */
export const PeopleFilters: React.FC<{
  people: Array<{ programme: string; intake?: string }>;
  programme: string;
  intake: string;
  query: string;
  onProgramme: (value: string) => void;
  onIntake: (value: string) => void;
  onQuery: (value: string) => void;
  disabled?: boolean;
}> = ({ people, programme, intake, query, onProgramme, onIntake, onQuery, disabled = false }) => {
  const programmes = useMemo(() => [...new Set(people.map(person => person.programme))].sort(), [people]);
  const intakes = useMemo(() => intakeFilterOptions(people.map(person => person.intake ?? '')), [people]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input type="search" className="form-control form-control-md pl-10" aria-label="Find a student" placeholder="Search name or ID" value={query} disabled={disabled} onChange={event => onQuery(event.target.value)} />
      </div>
      <SelectMenu
        variant="filter"
        prefix="Programme"
        aria-label="Filter by programme"
        value={programme}
        disabled={disabled}
        options={[{ value: 'All', label: 'All programmes', triggerLabel: 'All' }, ...programmes.map(value => ({ value, label: shortProgramme(value) || 'No programme' }))]}
        onChange={onProgramme}
      />
      <SelectMenu
        variant="filter"
        prefix="Intake"
        aria-label="Filter by intake"
        value={intake}
        disabled={disabled}
        options={[{ value: 'All', label: 'All intakes', triggerLabel: 'All' }, ...intakes]}
        onChange={onIntake}
      />
    </div>
  );
};
