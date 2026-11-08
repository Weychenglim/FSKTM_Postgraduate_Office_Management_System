/**
 * Wording and counts for the Student Registry bulk import: which rows will be
 * created, which are skipped (already registered, or repeated in the file) and
 * which need fixing, plus the downloadable import report.
 */

import type { CsvColumn } from './csvExport';
import { describeProgramme } from './programmeLabel';
import type {
  ImportColumn,
  ImportDifference,
  ImportField,
  ImportMapping,
  ImportPreviewRow,
  ImportProgrammeValue,
  RegistryImportBatch,
} from '../types';

// ---------------- Matching the file's columns ----------------

/** "Nama Pelajar", or "Column C" for a column without a name. */
export const columnLabel = (column: Pick<ImportColumn, 'header' | 'letter'>): string =>
  column.header || `Column ${column.letter}`;

/**
 * What stops the office continuing from the Match step: a required field
 * without a column, or one column chosen for two fields. The server checks
 * the same rules again.
 */
export const mappingProblems = (
  mapping: Partial<ImportMapping>,
  fields: ImportField[],
  /** Required fields a setting for every row already fills, such as Programme. */
  covered: string[] = [],
): string[] => {
  const problems: string[] = [];
  const used = new Map<number, string>();
  for (const field of fields) {
    const index = mapping[field.key];
    if (index === null || index === undefined) continue;
    const other = used.get(index);
    if (other) problems.push(`One column is chosen for both ${other} and ${field.label}.`);
    else used.set(index, field.label);
  }
  const missing = fields
    .filter((field) => field.required && !covered.includes(field.key))
    .filter((field) => mapping[field.key] === null || mapping[field.key] === undefined)
    .map((field) => field.label);
  if (missing.length) problems.push(`Choose a column for: ${missing.join(', ')}.`);
  return problems;
};

/** Columns with a name or data that no field uses: ignored, and never saved. */
export const unusedColumns = (columns: ImportColumn[], mapping: Partial<ImportMapping>): string[] => {
  const used = new Set(Object.values(mapping).filter((index): index is number => typeof index === 'number'));
  return columns
    .filter((column) => !used.has(column.index) && (column.header || column.samples.length > 0))
    .map(columnLabel);
};

// ---------------- Programme names in the file ----------------

/** The choice that skips every row with a programme name (accounts/registry_programmes.py). */
export const SKIP_PROGRAMME = '__skip__';

/** The office's choices, plus the suggestion for each name not chosen yet. */
export const withSuggestedProgrammes = (
  values: ImportProgrammeValue[],
  choices: Record<string, string>,
): Record<string, string> => {
  const next = { ...choices };
  for (const value of values) {
    if (!(value.key in next) && value.suggestion) next[value.key] = value.suggestion;
  }
  return next;
};

/** Names the office has not chosen a programme for yet; their rows are left out. */
export const unchosenProgrammes = (values: ImportProgrammeValue[], choices: Record<string, string>): string[] =>
  values.filter((value) => !choices[value.key]).map((value) => value.value);

// ---------------- Emails and Student IDs ----------------

/** The Student ID rule: keep the part before "/" (accounts/registry_import.py). */
export const STUDENT_ID_RULE = 'studentId';

/** What the office's choices changed on a row: shown on the row, in the result and in the report. */
export const derivedNotes = (row: Pick<ImportPreviewRow, 'email' | 'emailFilled' | 'idInFile'>): string[] => [
  ...(row.idInFile ? [`Student ID in the file: ${row.idInFile}.`] : []),
  ...(row.emailFilled ? [`Email filled from the Student ID: ${row.email}.`] : []),
];

/**
 * Rows for a reviewed file. What the office's choices changed goes back as it
 * was in the file (the programme name, a blank email, the Student ID with its
 * programme number), so the choices still apply and the rows stay marked.
 */
export const rowsForReview = <
  T extends Pick<ImportPreviewRow, 'id' | 'email' | 'programme' | 'programmeInFile' | 'emailFilled' | 'idInFile'>,
>(
  rows: T[],
): T[] =>
  rows.map((row) => ({
    ...row,
    id: row.idInFile ?? row.id,
    email: row.emailFilled ? '' : row.email,
    programme: row.programmeInFile ?? row.programme,
  }));

export type ImportRowGroup = 'ready' | 'skipped' | 'fix';
export type ImportRowFilter = 'all' | ImportRowGroup;

export const IMPORT_ROW_FILTERS = ['all', 'ready', 'skipped', 'fix'] as const;

export const importRowGroup = (row: Pick<ImportPreviewRow, 'status'>): ImportRowGroup => {
  if (row.status === 'Ready') return 'ready';
  if (row.status === 'Already Registered' || row.status === 'Duplicate In File' || row.status === 'Programme Skipped') {
    return 'skipped';
  }
  return 'fix';
};

export interface ImportSummary {
  total: number;
  ready: number;
  alreadyRegistered: number;
  repeated: number;
  programmeSkipped: number;
  skipped: number;
  fix: number;
}

export const summariseImportRows = (rows: Pick<ImportPreviewRow, 'status'>[]): ImportSummary => {
  const alreadyRegistered = rows.filter((row) => row.status === 'Already Registered').length;
  const repeated = rows.filter((row) => row.status === 'Duplicate In File').length;
  const programmeSkipped = rows.filter((row) => row.status === 'Programme Skipped').length;
  const ready = rows.filter((row) => row.status === 'Ready').length;
  const skipped = alreadyRegistered + repeated + programmeSkipped;
  return {
    total: rows.length,
    ready,
    alreadyRegistered,
    repeated,
    programmeSkipped,
    skipped,
    fix: rows.length - ready - skipped,
  };
};

export const filterImportRows = <T extends Pick<ImportPreviewRow, 'status'>>(
  rows: T[],
  filter: ImportRowFilter,
): T[] => (filter === 'all' ? rows : rows.filter((row) => importRowGroup(row) === filter));

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "a, b and c" */
const listText = (parts: string[]): string =>
  parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts.join('');

/** "4 already-registered students and 1 repeated row will be skipped." */
export const skipNotice = (summary: ImportSummary): string => {
  const parts = [];
  if (summary.alreadyRegistered) parts.push(plural(summary.alreadyRegistered, 'already-registered student'));
  if (summary.repeated) parts.push(plural(summary.repeated, 'repeated row'));
  if (summary.programmeSkipped) parts.push(`${plural(summary.programmeSkipped, 'row')} of a skipped programme`);
  return parts.length ? `${listText(parts)} will be skipped.` : '';
};

/** Who an already-registered row matched in the registry. */
export const registryMatchText = (row: Pick<ImportPreviewRow, 'existing'>): string => {
  const existing = row.existing;
  if (!existing) return '';
  if (existing.role && existing.role !== 'Student') {
    const article = /^[aeiou]/i.test(existing.role) ? 'an' : 'a';
    return `This email belongs to ${existing.name}, ${article} ${existing.role} account.`;
  }
  const programme = existing.programme ? `, ${describeProgramme(existing.programme).field}` : '';
  return `In the registry as ${existing.name} (${existing.id})${programme}.`;
};

const DIFFERENCE_LABELS: Record<ImportDifference, string> = {
  name: 'Name',
  email: 'Email',
  id: 'Student ID',
};

/** A warning when the file disagrees with the matched record, which usually means a wrong ID or email. */
export const differenceWarning = (row: Pick<ImportPreviewRow, 'differences' | 'matchedBy'>): string => {
  const differences = row.differences ?? [];
  if (differences.length === 0) return '';
  const fields = differences.map((field) => DIFFERENCE_LABELS[field]).join(' and ');
  const check = row.matchedBy === 'email' ? 'this email' : 'this Student ID';
  return `${fields} ${differences.length === 1 ? 'differs' : 'differ'} from the registry: check ${check}.`;
};

/** Why a repeated row is skipped. */
export const repeatedText = (row: Pick<ImportPreviewRow, 'duplicateOf' | 'issue'>): string => {
  if (!row.duplicateOf) return row.issue;
  return row.issue.startsWith('same email')
    ? `Same email as line ${row.duplicateOf}, which is imported instead.`
    : `Same Student ID as line ${row.duplicateOf}, which is imported instead.`;
};

/** The explanation shown for a row that is not simply ready. */
export const rowExplanation = (row: ImportPreviewRow): string => {
  if (row.status === 'Already Registered') return registryMatchText(row) || row.issue;
  if (row.status === 'Duplicate In File') return repeatedText(row);
  return row.status === 'Ready' ? '' : row.issue;
};

export const importOutcome = (row: ImportPreviewRow): string => {
  if (row.result === 'created') {
    if (row.invitationHeld) return 'Created, activation email on hold';
    return row.invitationSent === false ? 'Created, activation email not sent' : 'Created';
  }
  if (row.status === 'Already Registered') return 'Skipped: already registered';
  if (row.status === 'Duplicate In File') return 'Skipped: repeated in this file';
  if (row.status === 'Programme Skipped') return 'Skipped: you chose to skip this programme';
  return 'Not imported';
};

/** Columns of the report the office downloads after an import: every row and what happened to it. */
export const IMPORT_REPORT_COLUMNS: CsvColumn<ImportPreviewRow>[] = [
  { header: 'Line', value: (row) => row.line },
  { header: 'Student ID', value: (row) => row.id },
  { header: 'Full name', value: (row) => row.name },
  { header: 'Email', value: (row) => row.email },
  { header: 'Programme', value: (row) => row.programme },
  { header: 'Outcome', value: importOutcome },
  {
    header: 'Details',
    value: (row) => [rowExplanation(row), differenceWarning(row), ...derivedNotes(row)].filter(Boolean).join(' '),
  },
];

/** "3 created · 4 already registered · 1 not imported · 2 emails not sent" for a past batch. */
export const batchSummary = (batch: RegistryImportBatch): string => {
  const parts = [`${batch.created} created`];
  const repeated = batch.duplicateInFile ?? 0;
  const registered = batch.alreadyRegistered ?? Math.max(batch.skipped - repeated, 0);
  if (registered) parts.push(`${registered} already registered`);
  if (repeated) parts.push(`${repeated} repeated`);
  if (batch.programmeSkipped) parts.push(`${batch.programmeSkipped} skipped by programme`);
  if (batch.failed) parts.push(`${batch.failed} not imported`);
  if (batch.emailsFilled) parts.push(`${plural(batch.emailsFilled, 'email')} filled from Student ID`);
  if (batch.invitationsFailed) parts.push(`${plural(batch.invitationsFailed, 'email')} not sent`);
  return parts.join(' · ');
};
