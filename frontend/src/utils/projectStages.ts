import type { BadgeTone } from '../components/PortalPrimitives';
import type { MarksImpact, StageChangeResult, StageChoice, StageRow, StageShown } from '../services/registrySemestersApi';
import { studentCount } from './registrySemesters';

export type StageChip = 'correction' | 'noSupervisor' | 'notAnswered' | 'needsLook' | 'P1' | 'P2' | 'NOT_STARTED' | 'COMPLETED';

export type DialogChoice = StageChoice | 'KEEP';

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
  { value: 'correction', label: 'Correction requested', attention: true, matches: row => row.correctionRequested },
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
  if (row.correctionRequested) return row.correctionNote ? `Correction requested: "${row.correctionNote}"` : 'Correction requested';
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

/** "Back to automatic" only makes sense when a coordinator set every one of them, "Keep their answer" when every one asked for a correction. */
export function stageChoices(rows: StageRow[]): Array<{ value: DialogChoice; label: string }> {
  const choices: Array<{ value: DialogChoice; label: string }> = [...CHOICES];
  if (rows.length > 0 && rows.every(row => row.setByCoordinator)) choices.push({ value: 'AUTO', label: 'Back to automatic' });
  if (rows.length > 0 && rows.every(row => row.correctionRequested)) choices.push({ value: 'KEEP', label: 'Keep their answer' });
  return choices;
}

export const touchesMarks = (impact: MarksImpact | null) => Boolean(impact && impact.notStarted + impact.draft + impact.submitted > 0);

export const marksLine = (impact: MarksImpact) =>
  `In Marks: ${impact.notStarted} not started, ${impact.draft} draft, ${impact.submitted} submitted.`;

export function changeSummary(result: StageChangeResult, kept = false): string {
  if (result.changed.length === 0) return 'Nothing changed.';
  return kept ? `Answer kept for ${studentCount(result.changed.length)}.` : `${studentCount(result.changed.length)} changed.`;
}

export function correctionLine(correction: 'REQUESTED' | 'KEPT' | 'DONE' | null): string {
  if (correction === 'REQUESTED') return 'Your programme coordinator will review your correction request.';
  if (correction === 'KEPT') return 'Your programme coordinator reviewed your request and kept this record.';
  return 'Only your programme coordinator can change this record.';
}

const courseName = (code: string, name: string) => (code ? `${code}${name ? ` ${name}` : ''}` : 'your Research Project course');

export const questionText = (code: string, name: string, semester: string) =>
  `Have you registered for ${courseName(code, name)} in MAYA for ${semester || 'this semester'}?`;

export interface StageCardView {
  asking: boolean;
  value: string;
  badge: string;
  badgeTone: 'success' | 'warning' | 'neutral';
  detail: string;
  note: string;
}

interface StageCardQuestion {
  semester: string;
  code: string;
  name: string;
  answer: 'YES' | 'NO' | null;
  canChange: boolean;
  correction: 'REQUESTED' | 'KEPT' | 'DONE' | null;
}

/** What the student's Research Project Registration card shows. */
export function stageCard(question: StageCardQuestion): StageCardView {
  const semester = question.semester || 'this semester';
  if (question.answer === null && question.canChange) {
    return {
      asking: true,
      value: 'Not confirmed',
      badge: 'Action required',
      badgeTone: 'warning',
      detail: questionText(question.code, question.name, question.semester),
      note: '',
    };
  }
  const registered = question.answer === 'YES';
  const requested = question.correction === 'REQUESTED';
  return {
    asking: false,
    value: registered ? 'Registered' : 'Not registered',
    badge: requested ? 'Correction requested' : semester,
    badgeTone: requested ? 'warning' : registered ? 'success' : 'neutral',
    detail: question.code ? courseName(question.code, question.name) : 'Research Project',
    note: correctionLine(question.correction),
  };
}

export const confirmText = (answer: 'YES' | 'NO', code: string, name: string) =>
  answer === 'YES'
    ? `You have registered for ${courseName(code, name)} in MAYA.`
    : 'You have not registered for the Research Project this semester.';
