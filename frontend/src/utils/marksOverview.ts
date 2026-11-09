import type { EvaluationPeriodOption } from '../types';

export function monitoringTaskStatus(period: EvaluationPeriodOption, missingTasks: number | undefined): {
  label: string; tone: 'neutral' | 'warning' | 'danger' | 'info' | 'success'; canGenerate: boolean;
} {
  const {total = 0, submitted = 0, overdue = 0} = period.taskTotals ?? {};
  const canGenerate = ['OPEN', 'SCHEDULED'].includes(period.effectiveStatus) && (missingTasks ?? 0) > 0;
  if (overdue > 0) return {label: 'Overdue', tone: 'danger', canGenerate};
  if (canGenerate) return {label: 'Tasks needed', tone: 'warning', canGenerate};
  if (missingTasks === undefined && ['OPEN', 'SCHEDULED'].includes(period.effectiveStatus)) return {label: 'Checking tasks', tone: 'neutral', canGenerate: false};
  if (total > 0 && submitted === total) return {label: 'Complete', tone: 'success', canGenerate};
  if (period.effectiveStatus === 'CLOSED' || period.effectiveStatus === 'ARCHIVED') return {label: total > submitted ? 'Closed with unfinished tasks' : 'Closed', tone: 'neutral', canGenerate: false};
  if (missingTasks === undefined) return {label: 'Checking tasks', tone: 'neutral', canGenerate: false};
  if (!total) return {label: 'No eligible recipients', tone: 'neutral', canGenerate: false};
  return {label: submitted > 0 ? 'In progress' : 'Awaiting submissions', tone: 'info', canGenerate: false};
}

export function semesterPeriods(periods: EvaluationPeriodOption[], semester: string) {
  return periods.filter(period => period.semester === semester && period.lifecycleStatus !== 'ARCHIVED');
}

export function semesterMarkTotals(periods: EvaluationPeriodOption[]) {
  return periods.filter(period => period.lifecycleStatus !== 'DRAFT' && period.lifecycleStatus !== 'ARCHIVED')
    .reduce((sum, period) => ({
      total: sum.total + (period.taskTotals?.total ?? 0),
      submitted: sum.submitted + (period.taskTotals?.submitted ?? 0),
      overdue: sum.overdue + (period.taskTotals?.overdue ?? 0),
    }), { total: 0, submitted: 0, overdue: 0 });
}

export function monitoringPeriods(periods: EvaluationPeriodOption[], status: string) {
  return periods.filter(period => status === 'current'
    ? ['OPEN', 'SCHEDULED'].includes(period.effectiveStatus)
    : period.effectiveStatus === status);
}
