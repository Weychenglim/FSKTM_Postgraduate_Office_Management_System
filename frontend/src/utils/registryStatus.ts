import type { StudentDisplayStatus, StudentRecord } from '../types';

const blockerLabel = (key: string): string => {
  const words = key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const describeBlockers = (blockers: Record<string, number | undefined>): string[] =>
  Object.entries(blockers)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([key, count]) => `${blockerLabel(key)}: ${count}`);

const SHOWN_AS: Partial<Record<StudentRecord['academicStatus'], StudentDisplayStatus>> = {
  Deferred: 'On semester leave',
  Deceased: 'Passed away',
};

export const shownStatus = (student: Pick<StudentRecord, 'academicStatus' | 'displayStatus'>): StudentDisplayStatus =>
  student.displayStatus ?? SHOWN_AS[student.academicStatus] ?? (student.academicStatus as StudentDisplayStatus);

export interface RegistrySummary {
  total: number;
  notStarted: number;
  active: number;
  onLeave: number;
  waiting: number;
  graduated: number;
  withdrawn: number;
  terminated: number;
  passedAway: number;
  awaitingActivation: number;
  nearMaximum: number;
}

export const summariseRegistry = (students: StudentRecord[]): RegistrySummary => {
  const count = (status: StudentDisplayStatus) => students.filter((s) => shownStatus(s) === status).length;
  return {
    total: students.length,
    notStarted: count('Not started'),
    active: count('Active'),
    onLeave: count('On semester leave'),
    waiting: count('Waiting for Senate'),
    graduated: count('Graduated'),
    withdrawn: count('Withdrawn'),
    terminated: count('Terminated'),
    passedAway: count('Passed away'),
    awaitingActivation: students.filter((s) => s.activated === false).length,
    nearMaximum: students.filter((s) => s.maximumFlag).length,
  };
};

export type RegistryView = 'All' | StudentDisplayStatus | 'Awaiting activation' | 'Near maximum';

export const registryViewOptions = (
  summary: RegistrySummary,
  selected: RegistryView,
  office: boolean,
): { view: RegistryView; count: number }[] => {
  const views: { view: RegistryView; count: number }[] = [
    { view: 'All', count: summary.total },
    { view: 'Not started', count: summary.notStarted },
    { view: 'Active', count: summary.active },
    { view: 'On semester leave', count: summary.onLeave },
    { view: 'Waiting for Senate', count: summary.waiting },
    { view: 'Graduated', count: summary.graduated },
    { view: 'Withdrawn', count: summary.withdrawn },
    { view: 'Terminated', count: summary.terminated },
    { view: 'Passed away', count: summary.passedAway },
    { view: 'Awaiting activation', count: summary.awaitingActivation },
    ...(office ? [{ view: 'Near maximum' as const, count: summary.nearMaximum }] : []),
  ];
  return views.filter(({ view, count }) => view === 'All' || view === selected || count > 0);
};

export const inRegistryView = (student: StudentRecord, view: RegistryView): boolean => {
  if (view === 'All') return true;
  if (view === 'Awaiting activation') return student.activated === false;
  if (view === 'Near maximum') return Boolean(student.maximumFlag);
  return shownStatus(student) === view;
};

export const distinctValues = (values: string[]): string[] =>
  [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
