import type { ParticipantLifecycleStatus, StudentAcademicStatus, StudentRecord } from '../types';
import { allowedParticipantTransitions, lifecycleLabel } from './participantLifecycle';

export const studentStatusOptions = (
  current: StudentAcademicStatus,
): StudentAcademicStatus[] =>
  allowedParticipantTransitions(
    'STUDENT',
    current.toUpperCase() as ParticipantLifecycleStatus,
  ).map((status) => lifecycleLabel(status) as StudentAcademicStatus);

const blockerLabel = (key: string): string => {
  const words = key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const describeBlockers = (blockers: Record<string, number | undefined>): string[] =>
  Object.entries(blockers)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([key, count]) => `${blockerLabel(key)}: ${count}`);

export interface RegistrySummary {
  total: number;
  active: number;
  deferred: number;
  graduated: number;
  withdrawn: number;
  awaitingActivation: number;
  nearMaximum: number;
}

export const summariseRegistry = (students: StudentRecord[]): RegistrySummary => ({
  total: students.length,
  active: students.filter((s) => s.academicStatus === 'Active').length,
  deferred: students.filter((s) => s.academicStatus === 'Deferred').length,
  graduated: students.filter((s) => s.academicStatus === 'Graduated').length,
  withdrawn: students.filter((s) => s.academicStatus === 'Withdrawn').length,
  awaitingActivation: students.filter((s) => s.activated === false).length,
  nearMaximum: students.filter((s) => s.maximumFlag).length,
});

export type RegistryView = 'All' | StudentAcademicStatus | 'Awaiting activation' | 'Near maximum';

export const registryViewOptions = (
  summary: RegistrySummary,
  selected: RegistryView,
  office: boolean,
): { view: RegistryView; count: number }[] => {
  const views: { view: RegistryView; count: number }[] = [
    { view: 'All', count: summary.total },
    { view: 'Active', count: summary.active },
    { view: 'Deferred', count: summary.deferred },
    { view: 'Graduated', count: summary.graduated },
    { view: 'Withdrawn', count: summary.withdrawn },
    { view: 'Awaiting activation', count: summary.awaitingActivation },
    ...(office ? [{ view: 'Near maximum' as const, count: summary.nearMaximum }] : []),
  ];
  return views.filter(({ view, count }) => view === 'All' || view === selected || count > 0);
};

export const inRegistryView = (student: StudentRecord, view: RegistryView): boolean => {
  if (view === 'All') return true;
  if (view === 'Awaiting activation') return student.activated === false;
  if (view === 'Near maximum') return Boolean(student.maximumFlag);
  return student.academicStatus === view;
};

export const distinctValues = (values: string[]): string[] =>
  [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
