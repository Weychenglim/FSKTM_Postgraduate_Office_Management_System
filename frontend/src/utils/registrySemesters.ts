import type { SemesterOutcome, SemesterTerm, StudentSemesters } from '../services/registrySemestersApi';
import type { BadgeTone } from '../components/PortalPrimitives';

export const semesterCount = (count: number) => `${count} ${count === 1 ? 'semester' : 'semesters'}`;
export const studentCount = (count: number) => `${count} ${count === 1 ? 'student' : 'students'}`;

export const TERM_OPTIONS: Array<{ value: SemesterTerm; label: string }> = [
  { value: 'SEMESTER_I', label: 'Semester I' },
  { value: 'SEMESTER_II', label: 'Semester II' },
  { value: 'SPECIAL', label: 'Special Semester' },
];

export const OUTCOME_OPTIONS: Array<{ value: SemesterOutcome; label: string; description: string }> = [
  { value: 'STUDIED', label: 'Studied', description: 'Counts toward the minimum.' },
  { value: 'LEAVE', label: 'On leave', description: 'Does not count toward the minimum. The maximum stays the same.' },
  { value: 'LEAVE_EXEMPT', label: 'On medical or mobility leave', description: 'Does not count, and pushes the maximum back one semester.' },
];

export const OUTCOME_TONE: Record<SemesterOutcome, BadgeTone> = { STUDIED: 'success', LEAVE: 'warning', LEAVE_EXEMPT: 'info' };

/** Sessions run on consecutive years, like 2026/2027. */
export function validSession(session: string): boolean {
  const match = /^(\d{4})\/(\d{4})$/.exec(session.trim());
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

/** Matric numbers from whatever was pasted: a column from Excel, or a line from a letter. Repeats are dropped. */
export function parseMatricList(text: string): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of text.match(/[A-Za-z0-9][\w-]*/g) ?? []) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push(value);
    }
  }
  return list;
}

export type SemesterNotice = { tone: 'amber' | 'rose'; text: string };

/** The one thing worth saying about where a student stands against their maximum. */
export function maximumNotice(progress: StudentSemesters): SemesterNotice | null {
  if (progress.pastMaximum) {
    return { tone: 'rose', text: `Past the maximum of ${progress.maximumSemester}. The faculty decides what happens next. An appeal can add up to 3 semesters.` };
  }
  if (progress.lastSemester) {
    return { tone: 'amber', text: 'This is the last allowed semester. Any appeal to the Dean for more time must be made now.' };
  }
  return null;
}
