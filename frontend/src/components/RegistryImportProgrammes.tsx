/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IconHeading } from './IconHeading';
import React from 'react';
import { AlertTriangle, GraduationCap, Info } from 'lucide-react';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { PROGRAMME_OPTIONS } from '../constants/programmes';
import { describeProgramme } from '../utils/programmeLabel';
import { SKIP_PROGRAMME, unchosenProgrammes } from '../utils/registryImport';
import type { ImportProgrammeValue } from '../types';

export const NOT_CHOSEN = '';

const SOURCE_NOTE: Record<'saved' | 'similar', string> = {
  saved: 'Chosen on an earlier import',
  similar: 'The same name, spelt differently',
};

const quoted = (name: string) => `"${name}"`;

interface RegistryImportProgrammesProps {
  values: ImportProgrammeValue[];
  /** Distinct names in the file; only the first 100 are listed. */
  total: number;
  choices: Record<string, string>;
  busy: boolean;
  onChoose: (key: string, choice: string) => void;
}

/**
 * Programme names in the file that are not approved programmes. The office
 * chooses once for each name, or skips its rows, and the choice is remembered
 * for the next import.
 */
export const RegistryImportProgrammes: React.FC<RegistryImportProgrammesProps> = ({
  values,
  total,
  choices,
  busy,
  onChoose,
}) => {
  const options: SelectMenuOption[] = [
    { value: NOT_CHOSEN, label: 'Choose a programme' },
    ...PROGRAMME_OPTIONS.map((programme) => ({
      value: programme,
      label: describeProgramme(programme).field,
      description: describeProgramme(programme).detail,
    })),
    { value: SKIP_PROGRAMME, label: 'Skip these rows', description: 'Not imported, and listed as skipped' },
  ];
  const unchosen = unchosenProgrammes(values, choices);

  return (
    <section
      id="registry-import-programmes"
      aria-labelledby="registry-import-programmes-title"
      className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 text-left space-y-3"
    >
      <IconHeading as="h4" titleId="registry-import-programmes-title" title="Programme Names In This File"
        titleClassName="text-[10px] uppercase font-black tracking-wider text-indigo-700"
        description="Not on the approved list. Choose the programme each one means, or skip it."
        descriptionClassName="text-[11px] font-semibold text-slate-600 mt-0.5"
        icon={<span className="w-8 h-8 rounded-lg bg-white text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0"><GraduationCap className="w-4 h-4" /></span>}
      />

      <ul className="divide-y divide-indigo-100/70 rounded-xl border border-indigo-100 bg-white">
        {values.map((value) => (
          <li
            key={value.key}
            className="grid grid-cols-1 gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:items-center md:gap-4"
          >
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-800 truncate" title={value.value}>
                {quoted(value.value)}
              </p>
              <p className="text-[10.5px] font-semibold text-slate-500">
                {value.rows} row{value.rows === 1 ? '' : 's'}
                {value.source && choices[value.key] === value.suggestion && (
                  <span className="text-indigo-600"> · {SOURCE_NOTE[value.source]}</span>
                )}
              </p>
            </div>
            <SelectMenu
              size="sm"
              aria-label={`Programme for ${quoted(value.value)}`}
              value={choices[value.key] ?? NOT_CHOSEN}
              options={options}
              onChange={(choice) => onChoose(value.key, choice)}
              disabled={busy}
            />
          </li>
        ))}
      </ul>

      {total > values.length && (
        <p className="flex items-start gap-2 text-[11px] font-semibold text-slate-500">
          <Info className="w-3.5 h-3.5 mt-px shrink-0 text-slate-400" />
          <span>
            Showing the first {values.length} of {total} names. So many usually means the Programme column is the wrong
            one: check it under Change column matches.
          </span>
        </p>
      )}

      {unchosen.length > 0 && (
        <p role="status" className="flex items-start gap-2 text-[11px] font-bold text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>
            Choose a programme for {unchosen.map(quoted).join(', ')}. Until then, {unchosen.length === 1 ? 'its' : 'their'}{' '}
            rows are left out.
          </span>
        </p>
      )}
    </section>
  );
};
