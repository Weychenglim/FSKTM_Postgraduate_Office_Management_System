import type { EvaluationTask, EvaluationTaskRole } from '../types/marks';

export const markingWorkspaces: Record<EvaluationTaskRole, { label: string; title: string; empty: string; roleLabel: string }> = {
  SUPERVISOR: { label: 'My supervisees', title: 'Supervisee marking tasks', empty: 'No supervisee marking tasks assigned.', roleLabel: 'Supervisor' },
  PANEL: { label: 'My panel students', title: 'Panel marking tasks', empty: 'No panel marking tasks assigned.', roleLabel: 'Panel member' },
};

// Older task payloads predate evaluatorRole and represent panel assignments.
export const markingRole = (task: EvaluationTask): EvaluationTaskRole => task.evaluatorRole ?? 'PANEL';

export function tasksForMarkingRole(tasks: EvaluationTask[], role: EvaluationTaskRole): EvaluationTask[] {
  return tasks.filter(task => markingRole(task) === role);
}

export function initialMarkingRole(tasks: EvaluationTask[], remembered: EvaluationTaskRole | null): EvaluationTaskRole {
  if (remembered === 'SUPERVISOR' || remembered === 'PANEL') return remembered;
  return (['SUPERVISOR', 'PANEL'] as const).find(role => tasks.some(task => markingRole(task) === role)) ?? 'SUPERVISOR';
}

/** Keep unfinished work first, with the earliest actual deadline first in each group. */
export function orderMarkingTasks(tasks: EvaluationTask[]): EvaluationTask[] {
  const due = (task: EvaluationTask) => {
    const timestamp = Date.parse(task.effectiveDueAt ?? task.dueAt ?? '');
    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
  };
  return [...tasks].sort((a, b) => Number(a.status === 'SUBMITTED') - Number(b.status === 'SUBMITTED') || due(a) - due(b));
}
