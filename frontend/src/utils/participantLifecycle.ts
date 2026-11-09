import type {
  ParticipantLifecycleStatus,
  ParticipantType,
} from '../types';

const TRANSITIONS: Record<ParticipantType, Partial<Record<ParticipantLifecycleStatus, ParticipantLifecycleStatus[]>>> = {
  STUDENT: {
    ACTIVE: ['DEFERRED', 'GRADUATED', 'WITHDRAWN'],
    DEFERRED: ['ACTIVE', 'WITHDRAWN'],
  },
  LECTURER: {
    ACTIVE: ['RETIRING'],
    RETIRING: ['RETIRED', 'RESIGNED', 'ACTIVE'],
    RETIRED: ['ACTIVE'],
    RESIGNED: ['ACTIVE'],
  },
};

export const allowedParticipantTransitions = (
  type: ParticipantType,
  status: ParticipantLifecycleStatus,
): ParticipantLifecycleStatus[] => TRANSITIONS[type][status] ?? [];

const STUDENT_WORDS: Record<string, string> = {
  DEFERRED: 'On semester leave',
  DECEASED: 'Passed away',
  WAITING_FOR_SENATE: 'Waiting for Senate',
};

export const lifecycleLabel = (status: string): string =>
  STUDENT_WORDS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();

export const participantConflictMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'The lifecycle request could not be completed.';

export const blockerTotal = (blockers: Record<string, number>): number =>
  Object.values(blockers).reduce((total, value) => total + value, 0);

const LECTURER_STATUS: Partial<Record<ParticipantLifecycleStatus, string>> = {
  ACTIVE: 'Active',
  RETIRING: 'Leaving',
  RETIRED: 'Retired',
  RESIGNED: 'Resigned',
};

export const lecturerStatusLabel = (status: string): string =>
  LECTURER_STATUS[status as ParticipantLifecycleStatus] ?? lifecycleLabel(status);

export function lecturerAction(from: ParticipantLifecycleStatus, to: ParticipantLifecycleStatus): string {
  if (to === 'RETIRING') return 'Mark as leaving';
  if (to === 'RETIRED') return 'Mark as retired';
  if (to === 'RESIGNED') return 'Mark as resigned';
  return from === 'RETIRING' ? 'Back to active' : 'Returned to work';
}

export function lecturerActionDone(name: string, from: ParticipantLifecycleStatus, to: ParticipantLifecycleStatus): string {
  if (to !== 'ACTIVE') return `${name} marked as ${lecturerStatusLabel(to).toLowerCase()}.`;
  return from === 'RETIRING' ? `${name} is back to active.` : `${name} returned to work.`;
}

export function lecturerActionPrompt(
  name: string,
  from: ParticipantLifecycleStatus,
  to: ParticipantLifecycleStatus,
): { title: string; note?: string } {
  if (to === 'RETIRING') return { title: `Mark ${name} as leaving?`, note: 'No new supervisor, panel or marks work will come to them.' };
  if (to === 'RETIRED' || to === 'RESIGNED') {
    return { title: `Mark ${name} as ${to === 'RETIRED' ? 'retired' : 'resigned'}?`, note: 'Sign-in turns off. Their profile is kept.' };
  }
  return from === 'RETIRING' ? { title: `Keep ${name} active?` } : { title: `${name} returned to work?`, note: 'Sign-in turns back on.' };
}

const PENDING_WORK: Record<string, string> = {
  SUPERVISOR_APPLICATION: 'Supervisor request',
  PANEL_RECOMMENDATION: 'Panel request',
  CO_SUPERVISOR_NOMINATION: 'Co-supervisor request',
};

/** "SUBMITTED_TO_SUPERVISOR" becomes "Submitted to supervisor". */
export function statusWords(status: string): string {
  const words = status.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const pendingWorkLabel = (recordType: string): string => PENDING_WORK[recordType] ?? statusWords(recordType);

export const openWork = (blockers: object): Array<{ key: string; count: number }> =>
  (Object.entries(blockers) as Array<[string, number]>)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count }));
