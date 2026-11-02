import type { GraduationItem, SemesterOutcome, SemesterTerm, StudentSemesters } from '../services/registrySemestersApi';
import type { BadgeTone } from '../components/PortalPrimitives';
import { APP_ROUTES, routeForProgrammeTransfer } from '../constants/routes';

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

export const shortSemester = (label: string) => label.replace(/ Session$/, '');

/** Students whose name or matric number has the text in it. */
export function findStudents<T extends { name: string; matric: string }>(students: T[], query: string): T[] {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  return students.filter(student => student.name.toLowerCase().includes(text) || student.matric.toLowerCase().includes(text));
}

/** Whether the Students tab should offer to move students: a semester has started and nobody has been moved yet. */
export const semesterMoveWaiting = (summary: { semester: unknown; waiting: number; lastMove: unknown } | null) =>
  Boolean(summary?.semester && summary.waiting > 0 && !summary.lastMove);

/** Where to go to sort out something unfinished. */
export function fixLink(item: Pick<GraduationItem, 'fix' | 'recordId'>, matric: string): { label: string; to: string } | null {
  const encoded = encodeURIComponent(matric);
  switch (item.fix) {
    case 'record': return { label: 'Open record', to: `${APP_ROUTES.registry}?student=${encoded}` };
    case 'marks': return { label: 'Open Marks', to: APP_ROUTES.marks };
    case 'supervisor': return { label: 'Open requests', to: APP_ROUTES.supervisorAppointmentRequests };
    case 'panel': return { label: 'Open requests', to: APP_ROUTES.panelAppointments };
    case 'letters': return { label: 'Open requests', to: APP_ROUTES.lettersRequests };
    case 'documents': return { label: 'View files', to: `${APP_ROUTES.files}?student=${encoded}` };
    case 'research': return { label: 'Open request', to: APP_ROUTES.supervisorResearchChanges };
    case 'programmes': return { label: 'Open Programmes', to: APP_ROUTES.registryProgrammes };
    case 'transfer': return item.recordId ? { label: 'Open transfer', to: routeForProgrammeTransfer(item.recordId) } : null;
    default: return null;
  }
}
