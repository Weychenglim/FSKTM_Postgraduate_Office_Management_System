import type { EvaluationPeriodOption } from '../types';

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
