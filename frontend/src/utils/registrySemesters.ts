import type { GraduationItem, LeaveOutcome, SemesterOutcome, SemesterTerm, StudentSemesters } from '../services/registrySemestersApi';
import type { BadgeTone } from '../components/PortalPrimitives';
import { APP_ROUTES, routeForSupervisorResearchRequest } from '../constants/routes';

const SMALL_WORDS = new Set(['of', 'and', 'in', 'the', 'by']);

/** "MASTER OF DATA SCIENCE (COURSEWORK)" becomes "Data Science", for narrow columns. */
export function shortProgramme(programme: string): string {
  const core = programme.trim().replace(/^master of\s+/i, '').replace(/\s*\(.*\)\s*$/, '');
  if (!core) return programme;
  return core.toLowerCase().split(/\s+/).map((word, index) => (index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))).join(' ');
}

export const semesterCount = (count: number) => `${count} ${count === 1 ? 'semester' : 'semesters'}`;
export const studentCount = (count: number) => `${count} ${count === 1 ? 'student' : 'students'}`;

export const TERM_OPTIONS: Array<{ value: SemesterTerm; label: string }> = [
  { value: 'SEMESTER_I', label: 'Semester I' },
  { value: 'SEMESTER_II', label: 'Semester II' },
  { value: 'SPECIAL', label: 'Special Semester' },
];

export const OUTCOME_OPTIONS: Array<{ value: SemesterOutcome; label: string; description: string }> = [
  { value: 'STUDIED', label: 'Registered', description: 'Counts toward the minimum.' },
  { value: 'LEAVE', label: 'Personal leave', description: 'Does not count toward the minimum. The maximum stays the same.' },
  { value: 'LEAVE_MEDICAL', label: 'Medical leave', description: 'Does not count, and pushes the maximum back one semester.' },
  { value: 'LEAVE_MOBILITY', label: 'Mobility leave', description: 'Does not count, and pushes the maximum back one semester.' },
  { value: 'NOT_REGISTERED', label: 'Not registered', description: 'Does not count toward the minimum. The maximum stays the same.' },
];

export const OUTCOME_TONE: Record<SemesterOutcome, BadgeTone> = { STUDIED: 'success', LEAVE: 'warning', LEAVE_MEDICAL: 'info', LEAVE_MOBILITY: 'info', NOT_REGISTERED: 'danger' };

export const LEAVE_OPTIONS: Array<{ value: LeaveOutcome; label: string; description: string }> = OUTCOME_OPTIONS.filter((option): option is { value: LeaveOutcome; label: string; description: string } => option.value.startsWith('LEAVE'));

export const EXIT_REASON_OPTIONS = [
  { value: 'NOT_REGISTERED', label: 'Did not register' },
  { value: 'LEAVE_USED_UP', label: 'Semester leave used up' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'FAILED_AND_EXIT', label: 'Failed and Exit' },
  { value: 'LAPSED', label: 'Lapsed' },
  { value: 'SENATE', label: 'Senate decision' },
];

/** Sessions run on consecutive years, like 2026/2027. */
export const validCourseCode = (code: string) => /^[A-Za-z]{3}\d{4}$/.test(code.trim());

export function validSession(session: string): boolean {
  const match = /^(\d{4})\/(\d{4})$/.exec(session.trim());
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
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

/** Where the semesters on a record disagree with the student's intake. */
export function intakeNotice(progress: Pick<StudentSemesters, 'intake' | 'beforeIntake' | 'startsAfterIntake'>): SemesterNotice | null {
  if (progress.beforeIntake.length) {
    return { tone: 'amber', text: `${shortSemester(progress.beforeIntake[0])} is before the intake. Remove it if it's wrong.` };
  }
  if (progress.startsAfterIntake) {
    return { tone: 'amber', text: `The intake is ${shortSemester(progress.intake)}, but the semesters start later.` };
  }
  return null;
}

export const shortSemester = (label: string) => label.replace(/ Session$/, '');

const TERM_WORDS: Record<string, string> = { i: 'Semester I', 1: 'Semester I', ii: 'Semester II', 2: 'Semester II', iii: 'Special Semester', 3: 'Special Semester' };

/** A semester written the portal's way, like 2026/2027 Semester I. Text that can't be read comes back as it was. */
export function canonicalSemester(text: string): string {
  const value = text.trim();
  const session = /(\d{4})\s*[/-]\s*(\d{4})/.exec(value);
  if (!session || Number(session[2]) !== Number(session[1]) + 1) return value;
  const prefix = `${session[1]}/${session[2]}`;
  if (/\b(?:special|khas|short)\b|-sp\b/i.test(value)) return `${prefix} Special Semester`;
  const term = /\bsem(?:ester)?\s*(iii|ii|i|[123])\b|-s([123])\b/i.exec(value);
  return term ? `${prefix} ${TERM_WORDS[(term[1] ?? term[2]).toLowerCase()]}` : value;
}

/** Semesters to pick from, newest first. A value outside the range is kept so it can still be shown. */
export function semesterChoices(options: { special?: boolean; keep?: string; now?: Date } = {}): Array<{ value: string; label: string }> {
  const year = (options.now ?? new Date()).getFullYear();
  const choices: Array<{ value: string; label: string }> = [];
  for (let start = year + 1; start >= year - 8; start -= 1) {
    const session = `${start}/${start + 1}`;
    if (options.special) choices.push({ value: `${session} Special Semester`, label: `Special Semester, ${session}` });
    choices.push({ value: `${session} Semester II`, label: `Semester II, ${session}` });
    choices.push({ value: `${session} Semester I`, label: `Semester I, ${session}` });
  }
  if (options.keep && !choices.some(choice => choice.value === options.keep)) choices.push({ value: options.keep, label: options.keep });
  return choices;
}

/** The session and term of a semester, or null when it can't be read. */
export function semesterParts(text: string): { session: string; term: SemesterTerm } | null {
  const value = canonicalSemester(text);
  const match = /^(\d{4}\/\d{4}) (Semester I|Semester II|Special Semester)$/.exec(value);
  if (!match) return null;
  const terms: Record<string, SemesterTerm> = { 'Semester I': 'SEMESTER_I', 'Semester II': 'SEMESTER_II', 'Special Semester': 'SPECIAL' };
  return { session: match[1], term: terms[match[2]] };
}

export const NO_INTAKE = 'none';

const newestFirst = (label: string) => {
  const year = Number(/(\d{4})\//.exec(label)?.[1] ?? 0);
  const term = /special/i.test(label) ? 2 : /semester ii\b/i.test(label) ? 1 : 0;
  return year * 10 + term;
};

/** The intakes in a list, newest first, to filter it by. */
export function intakeFilterOptions(labels: string[]): Array<{ value: string; label: string }> {
  const known = [...new Set(labels.filter(Boolean))].sort((first, second) => newestFirst(second) - newestFirst(first));
  const options = known.map(label => ({ value: label, label: shortSemester(label) }));
  return labels.some(label => !label) ? [...options, { value: NO_INTAKE, label: 'No intake recorded' }] : options;
}

export const matchesIntake = (label: string | undefined, filter: string) =>
  filter === 'All' || (filter === NO_INTAKE ? !label : label === filter);

/** Students matching the programme and intake chosen, and the search text if there is any. */
export function filterPeople<T extends { name: string; matric: string; programme: string; intake?: string }>(
  people: T[],
  filters: { programme: string; intake: string; query: string },
): T[] {
  const inFilters = people.filter(person => (filters.programme === 'All' || person.programme === filters.programme) && matchesIntake(person.intake, filters.intake));
  return filters.query.trim() ? findStudents(inFilters, filters.query) : inFilters;
}

/** Students whose name or matric number has the text in it. */
export function findStudents<T extends { name: string; matric: string }>(students: T[], query: string): T[] {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  return students.filter(student => student.name.toLowerCase().includes(text) || student.matric.toLowerCase().includes(text));
}

/** Whether the Students tab should ask about students who aren't on the semester. Most students never take a Special Semester, so that only asks once. */
export const semesterMoveWaiting = (summary: { semester: { isSpecial?: boolean } | null; waiting: number; lastMove: unknown } | null) =>
  Boolean(summary?.semester && summary.waiting > 0 && !(summary.semester.isSpecial && summary.lastMove));

const MOVED_NOTICE_DAYS = 14;

/** What the portal did by itself when the semester started. Shown for its first two weeks. */
export function semesterMovedNotice(
  summary: { semester: { label: string } | null; lastMove: { at: string; moved: number; backFromLeave: number; automatic: boolean } | null } | null,
  now: Date = new Date(),
): string | null {
  const move = summary?.lastMove;
  if (!summary?.semester || !move?.automatic) return null;
  if (now.getTime() - new Date(move.at).getTime() > MOVED_NOTICE_DAYS * 86_400_000) return null;
  const leave = move.backFromLeave ? ` ${move.backFromLeave} back from leave.` : '';
  return `${studentCount(move.moved)} moved to ${shortSemester(summary.semester.label)}.${leave}`;
}

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
    case 'transfer': return item.recordId ? { label: 'Open request', to: routeForSupervisorResearchRequest(String(item.recordId)) } : null;
    default: return null;
  }
}
