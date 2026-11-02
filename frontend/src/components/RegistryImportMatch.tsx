/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IconHeading } from './IconHeading';
import React from 'react';
import { AlertTriangle, ArrowRight, AtSign, Check, Columns3, History, Info, Rows3 } from 'lucide-react';
import { PortalButton } from './PortalPrimitives';
import { semesterChoices } from '../utils/registrySemesters';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';
import { PROGRAMME_OPTIONS } from '../constants/programmes';
import { formatMalaysiaDate } from '../utils/malaysiaDateTime';
import { describeProgramme } from '../utils/programmeLabel';
import { columnLabel, mappingProblems, unusedColumns } from '../utils/registryImport';
import type { ImportDefaults, ImportFieldKey, ImportInspectResponse, ImportMapping } from '../types';

export const IMPORT_STEPS = ['Upload', 'Match columns', 'Check rows', 'Import'] as const;

/** Where the office is in the import: Upload, Match columns, Check rows, Import. */
export const ImportSteps: React.FC<{ current: number }> = ({ current }) => (
  <ol aria-label="Import steps" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 select-none">
    {IMPORT_STEPS.map((step, index) => {
      const done = index < current;
      const active = index === current;
      return (
        <li
          key={step}
          aria-current={active ? 'step' : undefined}
          className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide ${
            active ? 'text-brand-navy' : done ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              active ? 'bg-brand-navy text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {done ? <Check className="w-3 h-3" /> : index + 1}
          </span>
          {step}
        </li>
      );
    })}
  </ol>
);

const NOT_IN_FILE = '';
const FROM_FILE = '';
const NO_COLUMN_NAMES = 'none';

// Settings for every row fill these fields when a cell is blank.
const DEFAULTED_FIELD: Partial<Record<ImportFieldKey, keyof ImportDefaults>> = {
  programme: 'programme',
  intake: 'intake',
  current_semester: 'semester',
};

interface RegistryImportMatchProps {
  layout: ImportInspectResponse;
  mapping: ImportMapping;
  defaults: ImportDefaults;
  error?: string | null;
  busy: boolean;
  onMappingChange: (mapping: ImportMapping) => void;
  onDefaultsChange: (defaults: ImportDefaults) => void;
  onSheetChange: (sheet: string) => void;
  /** null: the rows have no column names. */
  onHeaderRowChange: (row: number | null) => void;
  /** Sets aside the matches saved from an earlier import, for the column-name suggestions. */
  onUseSuggestions: () => void;
  /** Fill a missing email with the student's SiswaMail address. */
  fillEmail: boolean;
  onFillEmailChange: (fill: boolean) => void;
  /** Keep the part of a Student ID before "/". */
  dropIdSuffix: boolean;
  onDropIdSuffixChange: (drop: boolean) => void;
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * The office confirms which column of its own file holds each detail. The
 * system's suggestions come from the column names; nothing is guessed from the
 * data, and columns left unmatched are ignored and never saved.
 */
export const RegistryImportMatch: React.FC<RegistryImportMatchProps> = ({
  layout,
  mapping,
  defaults,
  error,
  busy,
  onMappingChange,
  onDefaultsChange,
  onSheetChange,
  onHeaderRowChange,
  onUseSuggestions,
  fillEmail,
  onFillEmailChange,
  dropIdSuffix,
  onDropIdSuffixChange,
  onContinue,
  onCancel,
}) => {
  const emailDomain = fillEmail ? layout.emailDomain ?? '' : '';
  // Required fields a choice below fills, so they need no column.
  const covered: ImportFieldKey[] = [
    ...(defaults.programme ? (['programme'] as const) : []),
    ...(emailDomain ? (['email'] as const) : []),
  ];
  const problems = mappingProblems(mapping, layout.fields, covered);
  const unused = unusedColumns(layout.columns, mapping);
  const columnOptions: SelectMenuOption[] = [
    { value: NOT_IN_FILE, label: 'Not in this file' },
    ...layout.columns.map((column) => ({
      value: String(column.index),
      label: columnLabel(column),
      description: column.samples[0] ? `Column ${column.letter} · e.g. ${column.samples[0]}` : `Column ${column.letter} · empty`,
    })),
  ];
  const setField = (key: ImportFieldKey, value: string) =>
    onMappingChange({ ...mapping, [key]: value === NOT_IN_FILE ? null : Number(value) });
  const setDefault = (key: keyof ImportDefaults, value: string) => onDefaultsChange({ ...defaults, [key]: value });
  const everyRow = (key: ImportFieldKey): string => {
    const option = DEFAULTED_FIELD[key];
    const value = option ? (defaults[option] ?? '').trim() : '';
    if (!value) return '';
    return key === 'programme' ? describeProgramme(value).field : value;
  };
  const idColumn = layout.columns.find((column) => column.index === mapping.student_id);
  const idSample = (idColumn?.samples[0] ?? '').trim().toLowerCase();
  const emailExample = emailDomain
    ? `${(dropIdSuffix ? idSample.split('/')[0] : idSample) || 'studentid'}@${emailDomain}`
    : '';
  const suffixes = layout.studentIdsWithSuffix ?? 0;
  const programmeOptions: SelectMenuOption[] = [
    { value: FROM_FILE, label: "Use the file's programme column" },
    ...PROGRAMME_OPTIONS.map((programme) => ({
      value: programme,
      label: describeProgramme(programme).field,
      description: describeProgramme(programme).detail,
    })),
  ];

  return (
    <section
      id="registry-import-match"
      aria-labelledby="registry-import-match-title"
      className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs space-y-5 text-left"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <IconHeading as="h3" titleId="registry-import-match-title" title="Match Columns"
          description="Check which column of your file holds each detail. Nothing is created until you check the rows and import."
          descriptionClassName="text-[11px] text-slate-500 font-semibold mt-0.5"
          icon={<span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0"><Columns3 className="w-5 h-5" /></span>}
        />
        <ImportSteps current={1} />
      </div>

      {layout.profileAppliedAt && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-[11.5px] font-bold text-emerald-800">
            <History className="w-4 h-4 mt-px shrink-0" />
            <span>
              Matched the same way as your import on {formatMalaysiaDate(layout.profileAppliedAt)}. Check the matches
              below before you continue.
            </span>
          </p>
          <PortalButton variant="secondary" size="sm" onClick={onUseSuggestions} disabled={busy} className="shrink-0">
            Use Suggested Matches
          </PortalButton>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-150 bg-slate-50/60 px-4 py-3">
          <p className="text-[9.5px] uppercase font-black tracking-wider text-slate-400">File</p>
          <p className="text-xs font-extrabold text-slate-800 break-all mt-0.5">{layout.fileName}</p>
          <p className="text-[11px] font-semibold text-slate-500">
            {layout.rowCount} student row{layout.rowCount === 1 ? '' : 's'}
          </p>
        </div>
        {layout.sheets.length > 1 && (
          <div>
            <p className="form-label">Sheet</p>
            <SelectMenu
              size="sm"
              aria-label="Sheet with the student list"
              value={layout.sheet ?? ''}
              options={layout.sheets.map((sheet) => ({ value: sheet, label: sheet }))}
              onChange={onSheetChange}
              disabled={busy}
            />
          </div>
        )}
        <div>
          <p className="form-label">Column names are on</p>
          <SelectMenu
            size="sm"
            aria-label="Row with the column names"
            value={layout.hasHeader === false ? NO_COLUMN_NAMES : String(layout.headerRow)}
            options={[
              ...layout.headerRowOptions.map((option) => ({
                value: String(option.row),
                label: `Row ${option.row}`,
                description: option.preview,
              })),
              { value: NO_COLUMN_NAMES, label: 'No column names', description: 'Every row is a student' },
            ]}
            onChange={(row) => onHeaderRowChange(row === NO_COLUMN_NAMES ? null : Number(row))}
            disabled={busy}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-150 divide-y divide-slate-100">
        {layout.fields.map((field) => {
          const index = mapping[field.key];
          const column = index === null ? undefined : layout.columns.find((candidate) => candidate.index === index);
          const filled = !column && covered.includes(field.key);
          return (
            <div
              key={field.key}
              className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[11rem_minmax(0,17rem)_minmax(0,1fr)] md:items-center md:gap-4"
            >
              <p className="text-xs font-extrabold text-slate-800">
                {field.label}
                <span
                  className={`ml-2 text-[9.5px] font-black uppercase tracking-wide ${
                    filled ? 'text-indigo-600' : field.required ? 'text-rose-600' : 'text-slate-400'
                  }`}
                >
                  {filled ? 'Filled' : field.required ? 'Required' : 'Optional'}
                </span>
              </p>
              <SelectMenu
                size="sm"
                aria-label={`Column for ${field.label}`}
                value={index === null ? NOT_IN_FILE : String(index)}
                options={columnOptions}
                onChange={(value) => setField(field.key, value)}
                disabled={busy}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 truncate" title={column?.samples.join(', ')}>
                  {column
                    ? column.samples.length
                      ? column.samples.join(' · ')
                      : 'This column is empty.'
                    : everyRow(field.key)
                      ? `Every row: ${everyRow(field.key)}`
                      : field.key === 'email' && emailExample
                        ? `From the Student ID, e.g. ${emailExample}`
                        : field.required
                          ? DEFAULTED_FIELD[field.key]
                            ? 'Choose its column, or set it for every row below.'
                            : 'Choose the column that holds this.'
                          : 'Left blank for every student.'}
                </p>
                {column && everyRow(field.key) && (
                  <p className="text-[10.5px] font-bold text-indigo-600 truncate">Blank cells: {everyRow(field.key)}</p>
                )}
                {column && field.key === 'email' && emailExample && (
                  <p className="text-[10.5px] font-bold text-indigo-600 truncate">Blank cells: from the Student ID</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-150 bg-slate-50/50 px-4 py-4 space-y-3">
        <IconHeading as="h4" className="gap-x-2" title="For Every Row"
          titleClassName="text-[10px] uppercase font-black tracking-wider text-slate-500"
          description="Fills cells that are blank in your file, or a column it does not have. Values already in the file are kept."
          descriptionClassName="text-[11px] font-semibold text-slate-500 mt-0.5"
          icon={<Rows3 className="w-4 h-4 text-slate-400 shrink-0" />}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="form-label">Programme</p>
            <SelectMenu
              size="sm"
              aria-label="Programme for every row"
              value={defaults.programme ?? FROM_FILE}
              options={programmeOptions}
              onChange={(value) => setDefault('programme', value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col">
            <span className="form-label">Intake</span>
            <SelectMenu
              size="sm"
              aria-label="Intake for every row"
              value={defaults.intake ?? FROM_FILE}
              options={[{ value: FROM_FILE, label: "Use the file's intake column" }, ...semesterChoices()]}
              onChange={(value) => setDefault('intake', value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col">
            <span className="form-label">Current semester</span>
            <SelectMenu
              size="sm"
              aria-label="Current semester for every row"
              value={defaults.semester ?? FROM_FILE}
              options={[{ value: FROM_FILE, label: "Use the file's semester column" }, ...semesterChoices({ special: true })]}
              onChange={(value) => setDefault('semester', value)}
              disabled={busy}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-150 bg-slate-50/50 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <AtSign aria-hidden="true" className="w-4 h-4 text-slate-400 shrink-0" />
          <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-500">Student Emails And IDs</h4>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={fillEmail}
            onChange={(event) => onFillEmailChange(event.target.checked)}
            disabled={busy || !layout.emailDomain}
            className="mt-0.5 w-4.5 h-4.5 shrink-0 accent-blue-600 cursor-pointer"
          />
          <span className="space-y-0.5">
            <span className="block text-xs font-extrabold text-slate-900">
              Fill a missing email with the student&apos;s SiswaMail address
            </span>
            <span className="block text-[11px] text-slate-500 font-medium leading-normal">
              Student ID@{layout.emailDomain}. Each filled email is marked on its row, so you can check it before importing.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={dropIdSuffix}
            onChange={(event) => onDropIdSuffixChange(event.target.checked)}
            disabled={busy}
            className="mt-0.5 w-4.5 h-4.5 shrink-0 accent-blue-600 cursor-pointer"
          />
          <span className="space-y-0.5">
            <span className="block text-xs font-extrabold text-slate-900">
              Drop the programme number after &quot;/&quot; in Student IDs
            </span>
            <span className="block text-[11px] text-slate-500 font-medium leading-normal">
              23004955/1 becomes 23004955, the Student ID that SiswaMail uses.
              {suffixes > 0 &&
                ` ${suffixes} Student ID${suffixes === 1 ? '' : 's'} in this file ${suffixes === 1 ? 'has' : 'have'} one.`}
            </span>
          </span>
        </label>
      </div>

      {unused.length > 0 && (
        <p className="flex items-start gap-2 text-[11px] font-semibold text-slate-500">
          <Info className="w-4 h-4 shrink-0 text-slate-400" />
          <span>Not used, and not saved: {unused.join(', ')}.</span>
        </p>
      )}

      {(problems.length > 0 || error) && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
          {[...problems, ...(error ? [error] : [])].map((problem) => (
            <p key={problem} className="flex items-start gap-2 text-[11px] font-bold text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              <span>{problem}</span>
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PortalButton variant="secondary" size="md" onClick={onCancel} disabled={busy}>
          Upload a Different File
        </PortalButton>
        <PortalButton
          variant="primary"
          size="md"
          icon={ArrowRight}
          iconPosition="right"
          onClick={onContinue}
          disabled={busy || problems.length > 0}
        >
          {busy ? 'Checking rows…' : 'Check Rows'}
        </PortalButton>
      </div>
    </section>
  );
};
