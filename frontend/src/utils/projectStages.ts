import type { BadgeTone } from '../components/PortalPrimitives';
import type { MarksImpact, StageChangeResult, StageChoice, StageRow, StageShown } from '../services/registrySemestersApi';
import { studentCount } from './registrySemesters';

export type StageChip = 'noSupervisor' | 'notAnswered' | 'needsLook' | 'P1' | 'P2' | 'NOT_STARTED' | 'COMPLETED';

export const STAGE_LABEL: Record<StageShown, string> = {
  P1: 'RP1',
  P2: 'RP2',
  NOT_STARTED: 'Not started',
  COMPLETED: 'Completed',
  NOT_CONFIRMED: 'Needs a look',
};

export const STAGE_TONE: Record<StageShown, BadgeTone> = {
  P1: 'info',
  P2: 'brand',
  NOT_STARTED: 'neutral',
  COMPLETED: 'success',
  NOT_CONFIRMED: 'warning',
};

const CHIPS: Array<{ value: StageChip; label: string; attention: boolean; matches: (row: StageRow) => boolean }> = [
  { value: 'noSupervisor', label: 'RP1, no supervisor yet', attention: true, matches: row => row.noSupervisor },
  { value: 'notAnswered', label: 'Not answered', attention: true, matches: row => row.notAnswered },
  { value: 'needsLook', label: 'Needs a look', attention: true, matches: row => row.shown === 'NOT_CONFIRMED' },
  { value: 'P1', label: 'RP1', attention: false, matches: row => row.shown === 'P1' },
  { value: 'P2', label: 'RP2', attention: false, matches: row => row.shown === 'P2' },
  { value: 'NOT_STARTED', label: 'Not started', attention: false, matches: row => row.shown === 'NOT_STARTED' },
  { value: 'COMPLETED', label: 'Completed', attention: false, matches: row => row.shown === 'COMPLETED' },
];

/** The filter chips with their counts. A "chase" chip only shows when someone is in it. */
export function stageChips(rows: StageRow[]): Array<{ value: StageChip; label: string; count: number; attention: boolean }> {
  return CHIPS
    .map(chip => ({ value: chip.value, label: chip.label, attention: chip.attention, count: rows.filter(chip.matches).length }))
    .filter(chip => !chip.attention || chip.count > 0);
}

export function rowsFor(rows: StageRow[], chip: StageChip): StageRow[] {
  const found = CHIPS.find(item => item.value === chip);
  return found ? rows.filter(found.matches) : rows;
}

/** Open on the first list that needs someone to act, otherwise RP1. */
export function firstChip(rows: StageRow[]): StageChip {
  return stageChips(rows).find(chip => chip.attention)?.value ?? 'P1';
}

export function rowNote(row: StageRow): string | null {
  if (row.shown === 'NOT_CONFIRMED') return row.reason === 'BREAK_AFTER_P1' ? 'Not studying right after RP1' : 'No semester on record';
  if (row.noSupervisor) return row.requestWaiting ? 'Supervisor request waiting' : 'No supervisor request';
  if (row.setByCoordinator) return 'Set by a coordinator';
  return null;
}

const CHOICES: Array<{ value: StageChoice; label: string }> = [
  { value: 'P1', label: 'RP1' },
  { value: 'P2', label: 'RP2' },
  { value: 'NONE', label: 'Not started' },
];

/** "Back to automatic" only makes sense when a coordinator set every one of them. */
export function stageChoices(rows: StageRow[]): Array<{ value: StageChoice; label: string }> {
  return rows.length > 0 && rows.every(row => row.setByCoordinator) ? [...CHOICES, { value: 'AUTO', label: 'Back to automatic' }] : CHOICES;
}

export const touchesMarks = (impact: MarksImpact | null) => Boolean(impact && impact.notStarted + impact.draft + impact.submitted > 0);

export const marksLine = (impact: MarksImpact) =>
  `In Marks: ${impact.notStarted} not started, ${impact.draft} draft, ${impact.submitted} submitted.`;

export function changeSummary(result: StageChangeResult): string {
  if (result.changed.length === 0) return 'Nothing changed.';
  return `${studentCount(result.changed.length)} changed.`;
}

export const questionText = (code: string, name: string) =>
  code ? `Did you register ${code}${name ? ` ${name}` : ''} in Maya this semester?` : 'Did you register your Research Project course in Maya this semester?';

export const answerText = (answer: 'YES' | 'NO', code: string) =>
  answer === 'YES' ? `You registered ${code || 'it'} this semester.` : 'You said not this semester.';
